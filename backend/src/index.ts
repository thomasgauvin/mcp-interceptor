import { Hono } from "hono";
import { cors } from "hono/cors";

export { MCPInterceptorDurableObject } from "./mcpInterceptorDurableObject";

const app = new Hono<{ Bindings: Env }>();

// Enable CORS for all routes
app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  })
);

app.get("/api", (c) => {
  return c.text("Hello, World! Served from Hono!");
});

// Create a new MCP interceptor
app.post("/api/interceptors", async (c) => {
  try {
    const body = (await c.req.json()) as { targetUrl?: string };
    const { targetUrl } = body;

    if (!targetUrl || typeof targetUrl !== "string") {
      return c.json({ error: "Target URL is required" }, 400);
    }

    // Validate URL format
    try {
      new URL(targetUrl);
    } catch {
      return c.json({ error: "Invalid URL format" }, 400);
    }

    // Generate a random interceptor ID
    const interceptorId = crypto.randomUUID();

    // Get the Durable Object for this interceptor
    const durableObjectId = c.env.MCP_INTERCEPTOR.idFromName(interceptorId);
    const durableObject = c.env.MCP_INTERCEPTOR.get(durableObjectId);

    // Set the target URL using RPC
    const result = await durableObject.setTargetUrl(targetUrl);

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    // Return the interceptor info
    const baseUrl = new URL(c.req.url).origin;
    return c.json({
      interceptorId,
      targetUrl,
      proxyUrl: `${baseUrl}/proxy/${interceptorId}`,
      monitorUrl: `${baseUrl}/monitor/${interceptorId}`,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    return c.json({ error: "Invalid JSON" }, 400);
  }
});

// Get interceptor info
app.get("/api/interceptors/:id", async (c) => {
  const interceptorId = c.req.param("id");

  const durableObjectId = c.env.MCP_INTERCEPTOR.idFromName(interceptorId);
  const durableObject = c.env.MCP_INTERCEPTOR.get(durableObjectId);

  // Get info using RPC
  const info = await durableObject.getInfo();
  const baseUrl = new URL(c.req.url).origin;

  return c.json({
    interceptorId,
    ...info,
    proxyUrl: `${baseUrl}/proxy/${interceptorId}`,
    monitorUrl: `${baseUrl}/monitor/${interceptorId}`,
  });
});

// Proxy requests through the interceptor
app.all("/proxy/:id/*", async (c) => {
  const interceptorId = c.req.param("id");

  const durableObjectId = c.env.MCP_INTERCEPTOR.idFromName(interceptorId);
  const durableObject = c.env.MCP_INTERCEPTOR.get(durableObjectId);

  // Get the target URL using RPC
  const targetUrl = await durableObject.getTargetUrl();

  if (!targetUrl) {
    return c.json(
      {
        error: "No target URL configured for this interceptor",
      },
      400
    );
  }

  const requestId = crypto.randomUUID();
  const timestamp = Date.now();
  const request = c.req.raw;

  // Log the incoming request
  const requestHeaders: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    requestHeaders[key] = value;
  });

  let requestBody: string | undefined;
  if (
    request.body &&
    (request.method === "POST" ||
      request.method === "PUT" ||
      request.method === "PATCH")
  ) {
    try {
      const clonedRequest = request.clone();
      requestBody = await clonedRequest.text();
    } catch {
      requestBody = "[Binary data]";
    }
  }

  const requestLog = {
    id: requestId,
    timestamp,
    direction: "request" as const,
    method: request.method,
    url: request.url,
    headers: requestHeaders,
    body: requestBody,
  };

  // Log the request using RPC
  await durableObject.logRequest(requestLog);

  try {
    // Create the target URL by replacing the host and preserving path/query
    const originalUrl = new URL(request.url);
    const targetUrlObj = new URL(targetUrl);

    // Extract the path after /proxy/:id
    const proxyUrl = targetUrlObj;

    console.log("Proxying request to:", proxyUrl.toString());

    // Create new request to target
    const proxyRequest = new Request(proxyUrl.toString(), {
      method: request.method,
      headers: request.headers,
      body: request.body,
    });

    // Make the request to the target
    const response = await fetch(proxyRequest);

    // Log the response
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    let responseBody: string | undefined;
    const responseClone = response.clone();
    try {
      responseBody = await responseClone.text();
    } catch {
      responseBody = "[Binary data]";
    }

    const responseLog = {
      id: requestId + "-response",
      timestamp: Date.now(),
      direction: "response" as const,
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body: responseBody,
    };

    // Log the response using RPC
    await durableObject.logRequest(responseLog);

    return response;
  } catch (error) {
    const errorLog = {
      id: requestId + "-error",
      timestamp: Date.now(),
      direction: "response" as const,
      status: 500,
      statusText: "Proxy Error",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        error: "Failed to proxy request",
        details: error instanceof Error ? error.message : String(error),
      }),
    };

    // Log the error using RPC
    await durableObject.logRequest(errorLog);

    return new Response(errorLog.body, {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

// Handle monitor WebSocket connections
app.get("/monitor/:id", async (c) => {
  const upgradeHeader = c.req.header("upgrade");
  if (upgradeHeader !== "websocket") {
    return c.text("Expected Upgrade: websocket", 426);
  }

  const interceptorId = c.req.param("id");

  const durableObjectId = c.env.MCP_INTERCEPTOR.idFromName(interceptorId);
  const durableObject = c.env.MCP_INTERCEPTOR.get(durableObjectId);

  // Forward the WebSocket upgrade request to the Durable Object
  return durableObject.fetch(c.req.raw);
});

// WebSocket endpoint - supports room-based connections (keeping existing chat functionality)
app.get("/ws/:viewer?", async (c) => {
  const upgradeHeader = c.req.header("upgrade");
  if (upgradeHeader !== "websocket") {
    return c.text("Expected Upgrade: websocket", 426);
  }

  // Get room from URL parameter or default to "general"
  const viewer = c.req.param("viewer") || "general";

  // Get the Durable Object - use room name to create isolated chat rooms
  const durableObjectId = c.env.WEBSOCKET_HIBERNATION_SERVER.idFromName(
    `chat-room-${room}`
  );
  const durableObject = c.env.WEBSOCKET_HIBERNATION_SERVER.get(durableObjectId);

  // Forward the WebSocket upgrade request to the Durable Object
  return durableObject.fetch(c.req.raw);
});

export default app;

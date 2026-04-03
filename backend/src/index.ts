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
    const body = (await c.req.json()) as { targetUrl?: string; headers?: Record<string, string> };
    const { targetUrl, headers: customHeaders } = body;

    if (!targetUrl || typeof targetUrl !== "string") {
      return c.json({ error: "Target URL is required" }, 400);
    }

    // Validate URL format
    try {
      new URL(targetUrl);
    } catch {
      return c.json({ error: "Invalid URL format" }, 400);
    }

    // Generate a shorter random interceptor ID
    const interceptorId = crypto.randomUUID().substring(0, 8);

    // Get the Durable Object for this interceptor
    const durableObjectId = c.env.MCP_INTERCEPTOR.idFromName(interceptorId);
    const durableObject = c.env.MCP_INTERCEPTOR.get(durableObjectId);

    // Set the target URL using RPC
    const result = await durableObject.setTargetUrl(targetUrl);

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    // Store custom headers if provided
    if (customHeaders && typeof customHeaders === "object" && Object.keys(customHeaders).length > 0) {
      await durableObject.setCustomHeaders(customHeaders);
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

// Clear logs for an interceptor
app.delete("/api/interceptors/:id/logs", async (c) => {
  const interceptorId = c.req.param("id");

  const durableObjectId = c.env.MCP_INTERCEPTOR.idFromName(interceptorId);
  const durableObject = c.env.MCP_INTERCEPTOR.get(durableObjectId);

  // Clear logs using RPC
  await durableObject.clearLogs();

  return c.json({ message: "Logs cleared successfully" });
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

  // Log the request using RPC (skip if body is empty/missing - not useful)
  const isRequestBodyEmpty = !requestBody || requestBody.trim() === '' || requestBody.trim() === '{}';
  if (!isRequestBodyEmpty) {
    await durableObject.logRequest(requestLog);
  }

  try {
    // Create the target URL by replacing the host and preserving path/query
    const originalUrl = new URL(request.url);
    const targetUrlObj = new URL(targetUrl);

    // Extract the path after /proxy/:id
    const proxyUrl = targetUrlObj;

    console.log("Proxying request to:", proxyUrl.toString());

    // Create new request to target, injecting stored auth headers
    const proxyHeaders = new Headers(request.headers);
    const customHeaders = await durableObject.getCustomHeaders();
    if (customHeaders) {
      for (const [key, value] of Object.entries(customHeaders)) {
        proxyHeaders.set(key, value);
      }
    }

    const proxyRequest = new Request(proxyUrl.toString(), {
      method: request.method,
      headers: proxyHeaders,
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

    // Log the response using RPC (skip if both request and response bodies are empty)
    const isResponseBodyEmpty = !responseBody || responseBody.trim() === '' || responseBody.trim() === '{}';
    if (!(isRequestBodyEmpty && isResponseBodyEmpty)) {
      await durableObject.logRequest(responseLog);
    }

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
    `chat-room-${viewer}`
  );
  const durableObject = c.env.WEBSOCKET_HIBERNATION_SERVER.get(durableObjectId);

  // Forward the WebSocket upgrade request to the Durable Object
  return durableObject.fetch(c.req.raw);
});

// Validate MCP server endpoint
app.post("/api/validate-mcp", async (c) => {
  try {
    const body = (await c.req.json()) as { targetUrl?: string; headers?: Record<string, string> };
    const { targetUrl, headers: customHeaders } = body;

    console.log("[validate-mcp] Received validation request");
    console.log("[validate-mcp] Target URL:", targetUrl);
    console.log("[validate-mcp] Custom headers provided:", customHeaders ? Object.keys(customHeaders) : "none");

    if (!targetUrl || typeof targetUrl !== "string") {
      console.log("[validate-mcp] Rejected: Target URL is missing or not a string");
      return c.json({ error: "Target URL is required" }, 400);
    }

    // Validate URL format
    let url: URL;
    try {
      url = new URL(targetUrl);
      console.log("[validate-mcp] Parsed URL - protocol:", url.protocol, "host:", url.host, "pathname:", url.pathname);
    } catch {
      console.log("[validate-mcp] Rejected: Invalid URL format for:", targetUrl);
      return c.json({ error: "Invalid URL format" }, 400);
    }

    // Security checks to prevent abuse as arbitrary proxy
    // Only allow HTTP/HTTPS protocols
    if (!["http:", "https:"].includes(url.protocol)) {
      console.log("[validate-mcp] Rejected: Disallowed protocol:", url.protocol);
      return c.json({ error: "Only HTTP and HTTPS protocols are allowed" }, 400);
    }

    console.log("[validate-mcp] URL validation passed, sending MCP initialize request...");

    // Validate that it's an MCP server by sending an initialize request
    try {
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
          'Accept-Language': '*',
          'User-Agent': 'node',
          ...(customHeaders || {}),
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 0,
          method: 'initialize',
          params: {
            protocolVersion: '2025-03-26',
            capabilities: {
              sampling: {},
              roots: {
                listChanged: true
              }
            },
            clientInfo: {
              name: 'mcp-inspector',
              version: '0.14.3',
            },
          },
        }),
        // Add timeout to prevent hanging
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      console.log("[validate-mcp] Response received - status:", response.status, response.statusText);
      console.log("[validate-mcp] Response headers:", JSON.stringify(Object.fromEntries(response.headers.entries())));

      if (!response.ok) {
        console.log("[validate-mcp] Rejected: Non-OK response status:", response.status, response.statusText);
        return c.json({
          error: 'Server did not respond properly to MCP initialize request',
          valid: false
        }, 400);
      }

      const contentType = response.headers.get('content-type') || '';
      console.log("[validate-mcp] Content-Type:", contentType);

      let data;
      
      // Handle Server-Sent Events or streaming response
      if (contentType.includes('text/event-stream') || contentType.includes('text/plain')) {
        console.log("[validate-mcp] Handling streaming response (SSE or text/plain)");
        // Read the stream properly
        const reader = response.body?.getReader();
        if (!reader) {
          console.log("[validate-mcp] Rejected: Unable to get reader from streaming response body");
          return c.json({
            error: 'Unable to read streaming response',
            valid: false
          }, 400);
        }

        const decoder = new TextDecoder();
        let buffer = '';
        let jsonData = null;

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              console.log("[validate-mcp] Stream ended (done=true)");
              break;
            }

            const chunk = decoder.decode(value, { stream: true });
            console.log("[validate-mcp] Stream chunk received, length:", chunk.length);
            buffer += chunk;
            
            // Process complete lines
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep incomplete line in buffer

            for (const line of lines) {
              console.log("[validate-mcp] Stream line:", line);
              
              // Handle SSE format
              if (line.startsWith('data: ')) {
                const jsonString = line.substring(6).trim();
                if (jsonString && jsonString !== '[DONE]') {
                  try {
                    jsonData = JSON.parse(jsonString);
                    console.log("[validate-mcp] Parsed SSE JSON data successfully");
                    await reader.cancel(); // Stop reading once we get valid data
                    break;
                  } catch (e) {
                    console.log("[validate-mcp] Failed to parse SSE data line as JSON:", jsonString);
                    continue;
                  }
                }
              }
              // Handle direct JSON (some servers might stream JSON directly)
              else if (line.trim().startsWith('{')) {
                try {
                  jsonData = JSON.parse(line.trim());
                  console.log("[validate-mcp] Parsed direct JSON line successfully");
                  await reader.cancel();
                  break;
                } catch (e) {
                  console.log("[validate-mcp] Failed to parse direct JSON line:", line.trim().substring(0, 100));
                  continue;
                }
              }
            }

            if (jsonData) break;
          }
        } finally {
          await reader.cancel();
        }
        
        if (!jsonData) {
          console.log("[validate-mcp] Rejected: No valid JSON data found in stream. Remaining buffer:", buffer.substring(0, 200));
          return c.json({
            error: 'Server returned streaming format but no valid JSON data found',
            valid: false
          }, 400);
        }
        
        data = jsonData;
      } else {
        console.log("[validate-mcp] Handling regular JSON response");
        // Handle regular JSON response
        try {
          data = await response.json();
          console.log("[validate-mcp] Parsed JSON response successfully");
        } catch (e) {
          console.log("[validate-mcp] Rejected: Failed to parse response as JSON:", e);
          return c.json({
            error: 'Server response is not valid JSON',
            valid: false
          }, 400);
        }
      }

      console.log("[validate-mcp] Parsed response data:", JSON.stringify(data));

      // Validate MCP response structure
      console.log("[validate-mcp] Validating MCP response structure...");
      console.log("[validate-mcp] Has 'result' key:", data && typeof data === 'object' && 'result' in data);
      if (data?.result) {
        console.log("[validate-mcp] result type:", typeof data.result);
        console.log("[validate-mcp] Has 'protocolVersion':", typeof data.result === 'object' && 'protocolVersion' in data.result);
      }

      if (!data ||
          typeof data !== 'object' ||
          !('result' in data) ||
          !data.result ||
          typeof data.result !== 'object' ||
          !('protocolVersion' in data.result)) {
        console.log("[validate-mcp] Rejected: Invalid MCP response structure. Keys present:", data ? Object.keys(data) : "null");
        return c.json({
          error: 'Server did not return a valid MCP initialize response',
          valid: false
        }, 400);
      }

      console.log("[validate-mcp] ✅ Validation successful! Protocol version:", data.result.protocolVersion);
      return c.json({
        valid: true,
        message: 'MCP server validation successful',
        protocolVersion: data.result.protocolVersion
      });

    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        console.log("[validate-mcp] Rejected: Request timed out after 10s for URL:", targetUrl);
        return c.json({
          error: 'MCP server validation timed out - server may be unresponsive',
          valid: false
        }, 400);
      }

      console.error("[validate-mcp] Unexpected error during validation:", error);
      console.error("[validate-mcp] Error type:", error instanceof Error ? error.constructor.name : typeof error);
      console.error("[validate-mcp] Error message:", error instanceof Error ? error.message : String(error));

      return c.json({
        error: 'The URL does not appear to be a valid MCP server. Please check the URL and ensure the server supports the MCP protocol.',
        valid: false
      }, 400);
    }
  } catch (error) {
    console.error("[validate-mcp] Failed to parse request body as JSON:", error);
    return c.json({ error: "Invalid JSON" }, 400);
  }
});

export default app;

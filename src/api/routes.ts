import { type Context, Hono } from "hono";
import { cors } from "hono/cors";
import type { InterceptorLog } from "../durable-objects/mcp-interceptor";

export interface MCPInterceptorStub {
  setTargetUrl(
    targetUrl: string
  ): Promise<{ success: boolean; error?: string }>;
  getInfo(): Promise<{
    targetUrl: string | null;
    monitorCount: number;
    logCount: number;
  }>;
  logRequest(log: InterceptorLog): Promise<void>;
  getTargetUrl(): Promise<string | null>;
  clearLogs(): void;
  fetch(request: Request): Response | Promise<Response>;
}

export default function createApiRoutes() {
  const app = new Hono<{ Bindings: CloudflareBindings }>();

  // Enable CORS for all routes
  app.use(
    "*",
    cors({
      origin: "*",
      allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"],
    })
  );

  app.get("/", (c: Context<{ Bindings: CloudflareBindings }>) => {
    return c.text("Hello, World! Served from Hono!");
  });

  // Create a new MCP interceptor
  app.post(
    "/interceptors",
    async (c: Context<{ Bindings: CloudflareBindings }>) => {
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

        // Return the interceptor info
        const baseUrl = new URL(c.req.url).origin;
        return c.json({
          interceptorId,
          targetUrl,
          proxyUrl: `${baseUrl}/proxy/${interceptorId}`,
          monitorUrl: `${baseUrl}/monitor/${interceptorId}`,
          createdAt: new Date().toISOString(),
        });
      } catch (_error) {
        return c.json({ error: "Invalid JSON" }, 400);
      }
    }
  );

  // Get interceptor info
  app.get(
    "/interceptors/:id",
    async (c: Context<{ Bindings: CloudflareBindings }>) => {
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
    }
  );

  // Clear logs for an interceptor
  app.delete(
    "/interceptors/:id/logs",
    async (c: Context<{ Bindings: CloudflareBindings }>) => {
      const interceptorId = c.req.param("id");

      const durableObjectId = c.env.MCP_INTERCEPTOR.idFromName(interceptorId);
      const durableObject = c.env.MCP_INTERCEPTOR.get(durableObjectId);

      // Clear logs using RPC
      await durableObject.clearLogs();

      return c.json({ message: "Logs cleared successfully" });
    }
  );

  // Proxy requests through the interceptor
  app.all(
    "/proxy/:id/*",
    async (c: Context<{ Bindings: CloudflareBindings }>) => {
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
      request.headers.forEach((value: string, key: string) => {
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
      durableObject.logRequest(requestLog);

      try {
        // Create the target URL by replacing the host and preserving path/query
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
          id: `${requestId}-response`,
          timestamp: Date.now(),
          direction: "response" as const,
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
          body: responseBody,
        };

        // Log the response using RPC
        durableObject.logRequest(responseLog);

        return response;
      } catch (error) {
        const errorLog = {
          id: `${requestId}-error`,
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
        durableObject.logRequest(errorLog);

        return new Response(errorLog.body, {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }
  );

  // Handle monitor WebSocket connections
  app.get("/monitor/:id", (c: Context<{ Bindings: CloudflareBindings }>) => {
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

  // Helper function to parse a single line from streaming response
  const tryParseStreamLine = (line: string): unknown => {
    if (line.startsWith("data: ")) {
      const jsonString = line.substring(6).trim();
      if (jsonString && jsonString !== "[DONE]") {
        try {
          return JSON.parse(jsonString);
        } catch {
          return null;
        }
      }
    } else if (line.trim().startsWith("{")) {
      try {
        return JSON.parse(line.trim());
      } catch {
        return null;
      }
    }
    return null;
  };

  // Helper function to parse streaming response data
  const parseStreamingData = async (
    reader: ReadableStreamDefaultReader<Uint8Array>
  ): Promise<unknown> => {
    const decoder = new TextDecoder();
    let buffer = "";
    let jsonData: unknown = null;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        // Process complete lines
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete line in buffer

        for (const line of lines) {
          console.log("Stream line:", line);
          const parsed = tryParseStreamLine(line);
          if (parsed) {
            jsonData = parsed;
            await reader.cancel();
            break;
          }
        }

        if (jsonData) {
          break;
        }
      }
    } finally {
      await reader.cancel();
    }

    return jsonData;
  };

  // Helper function to validate MCP response structure
  const validateMcpResponse = (
    data: unknown
  ): {
    valid: boolean;
    protocolVersion?: string;
    error?: string;
  } => {
    if (
      !data ||
      typeof data !== "object" ||
      !("result" in data) ||
      !data.result ||
      typeof data.result !== "object" ||
      !("protocolVersion" in data.result)
    ) {
      return {
        valid: false,
        error: "Server did not return a valid MCP initialize response",
      };
    }
    return {
      valid: true,
      protocolVersion: (data.result as Record<string, unknown>)
        .protocolVersion as string,
    };
  };

  // Helper function to get response data from MCP server response
  const getResponseData = async (
    response: Response
  ): Promise<{ data: unknown; error?: string }> => {
    const contentType = response.headers.get("content-type") || "";
    console.log("Content-Type:", contentType);

    if (
      contentType.includes("text/event-stream") ||
      contentType.includes("text/plain")
    ) {
      const reader = response.body?.getReader();
      if (!reader) {
        return {
          data: null,
          error: "Unable to read streaming response",
        };
      }

      const jsonData = await parseStreamingData(reader);
      if (!jsonData) {
        return {
          data: null,
          error:
            "Server returned streaming format but no valid JSON data found",
        };
      }
      return { data: jsonData };
    }

    try {
      const data = await response.json();
      return { data };
    } catch (_e) {
      return {
        data: null,
        error: "Server response is not valid JSON",
      };
    }
  };

  // Helper function to fetch and validate MCP server
  const validateMcpServerFetch = async (
    targetUrl: string
  ): Promise<{
    data: unknown;
    error?: string;
  }> => {
    try {
      const response = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
          "Accept-Language": "*",
          "User-Agent": "node",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 0,
          method: "initialize",
          params: {
            protocolVersion: "2025-03-26",
            capabilities: {
              sampling: {},
              roots: {
                listChanged: true,
              },
            },
            clientInfo: {
              name: "mcp-inspector",
              version: "0.14.3",
            },
          },
        }),
        signal: AbortSignal.timeout(10_000),
      });

      console.log("MCP server response status:", response.status);
      console.log(
        "MCP server response headers:",
        Object.fromEntries(response.headers.entries())
      );

      if (!response.ok) {
        return {
          data: null,
          error: "Server did not respond properly to MCP initialize request",
        };
      }

      return await getResponseData(response);
    } catch (error) {
      if (error instanceof Error && error.name === "TimeoutError") {
        return {
          data: null,
          error: "MCP server validation timed out - server may be unresponsive",
        };
      }
      return {
        data: null,
        error:
          "The URL does not appear to be a valid MCP server. Please check the URL and ensure the server supports the MCP protocol.",
      };
    }
  };

  // Validate MCP server endpoint
  app.post(
    "/validate-mcp",
    async (c: Context<{ Bindings: CloudflareBindings }>) => {
      try {
        const body = (await c.req.json()) as { targetUrl?: string };
        const { targetUrl } = body;

        console.log("Validating MCP server for URL:", targetUrl);

        if (!targetUrl || typeof targetUrl !== "string") {
          return c.json({ error: "Target URL is required" }, 400);
        }

        // Validate URL format
        try {
          new URL(targetUrl);
        } catch {
          return c.json({ error: "Invalid URL format" }, 400);
        }

        // Validate URL is HTTP/HTTPS
        const url = new URL(targetUrl);
        if (!["http:", "https:"].includes(url.protocol)) {
          return c.json(
            { error: "Only HTTP and HTTPS protocols are allowed" },
            400
          );
        }

        // Fetch and validate MCP server
        const { data, error: fetchError } =
          await validateMcpServerFetch(targetUrl);
        if (fetchError) {
          return c.json(
            {
              error: fetchError,
              valid: false,
            },
            400
          );
        }

        console.log("Parsed data:", data);

        // Validate MCP response
        const validation = validateMcpResponse(data);
        if (!validation.valid) {
          return c.json(
            {
              error: validation.error,
              valid: false,
            },
            400
          );
        }

        return c.json({
          valid: true,
          message: "MCP server validation successful",
          protocolVersion: validation.protocolVersion,
        });
      } catch (_error) {
        return c.json({ error: "Invalid JSON" }, 400);
      }
    }
  );

  return app;
}

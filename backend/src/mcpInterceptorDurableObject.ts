import { DurableObject } from "cloudflare:workers";

export interface InterceptorLog {
  id: string;
  timestamp: number;
  direction: "request" | "response";
  method?: string;
  url?: string;
  headers: Record<string, string>;
  body?: string;
  status?: number;
  statusText?: string;
}

export interface MonitorSession {
  interceptorId: string;
  connectedAt: number;
}

export class MCPInterceptorDurableObject extends DurableObject {
  private monitors = new Map<WebSocket, MonitorSession>();
  private logs: InterceptorLog[] = [];
  private targetUrl: string | null = null;

  // RPC method to set the target URL
  async setTargetUrl(
    targetUrl: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Validate URL
      new URL(targetUrl);

      this.targetUrl = targetUrl;
      await this.ctx.storage.put("targetUrl", targetUrl);

      return { success: true };
    } catch {
      return { success: false, error: "Invalid URL format" };
    }
  }

  // RPC method to get interceptor info
  async getInfo(): Promise<{
    targetUrl: string | null;
    monitorCount: number;
    logCount: number;
  }> {
    // Load target URL from storage if not in memory
    if (!this.targetUrl) {
      this.targetUrl = (await this.ctx.storage.get("targetUrl")) || null;
    }

    return {
      targetUrl: this.targetUrl,
      monitorCount: this.monitors.size,
      logCount: this.logs.length,
    };
  }

  // RPC method to log a request/response
  async logRequest(log: InterceptorLog): Promise<void> {
    this.addLog(log);
  }

  // RPC method to get the target URL
  async getTargetUrl(): Promise<string | null> {
    if (!this.targetUrl) {
      this.targetUrl = (await this.ctx.storage.get("targetUrl")) || null;
    }
    return this.targetUrl;
  }

  async fetch(request: Request): Promise<Response> {
    // Handle WebSocket connections for monitors only
    if (request.headers.get("upgrade") === "websocket") {
      return this.handleWebSocketUpgrade(request);
    }

    return new Response("Not found", { status: 404 });
  }

  private async handleWebSocketUpgrade(request: Request): Promise<Response> {
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    // Accept the WebSocket connection
    this.ctx.acceptWebSocket(server);

    // Get interceptor ID from URL
    const url = new URL(request.url);
    const interceptorId = url.pathname.split("/")[2]; // Format is /monitor/interceptor-id

    // Store monitor session
    this.monitors.set(server, {
      interceptorId,
      connectedAt: Date.now(),
    });

    // Send existing logs to the new monitor
    server.send(
      JSON.stringify({
        type: "initial_logs",
        logs: this.logs,
      })
    );

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  private addLog(log: InterceptorLog): void {
    this.logs.push(log);

    // Keep only the last 1000 logs to prevent memory issues
    if (this.logs.length > 1000) {
      this.logs = this.logs.slice(-1000);
    }

    // Broadcast to all monitors
    this.broadcastToMonitors({
      type: "new_log",
      log,
    });
  }

  private broadcastToMonitors(message: any): void {
    const messageString = JSON.stringify(message);

    this.monitors.forEach((session, socket) => {
      try {
        socket.send(messageString);
      } catch (e) {
        console.error("Failed to send message to monitor:", e);
        this.monitors.delete(socket);
      }
    });
  }

  async webSocketMessage(
    ws: WebSocket,
    message: string | ArrayBuffer
  ): Promise<void> {
    // Handle any WebSocket messages from monitors (currently none expected)
    const messageString =
      typeof message === "string" ? message : new TextDecoder().decode(message);

    try {
      const data = JSON.parse(messageString);

      // For now, we don't handle any monitor messages, but we could add commands here
      console.log("Received monitor message:", data);
    } catch (e) {
      console.error("Invalid JSON from monitor:", e);
    }
  }

  async webSocketClose(
    ws: WebSocket,
    code: number,
    reason: string,
    wasClean: boolean
  ): Promise<void> {
    this.monitors.delete(ws);
  }
}

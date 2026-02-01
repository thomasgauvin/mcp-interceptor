import { WebSocket } from "partysocket";
import { useCallback, useEffect, useRef, useState } from "react";

interface InterceptorLog {
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

interface InterceptorInfo {
  interceptorId: string;
  targetUrl: string;
  proxyUrl: string;
  viewerUrl: string;
  viewerCount: number;
  logCount: number;
}

interface InterceptorViewerProps {
  interceptorId: string;
}

export function InterceptorViewer({ interceptorId }: InterceptorViewerProps) {
  const [info, setInfo] = useState<InterceptorInfo | null>(null);
  const [logs, setLogs] = useState<InterceptorLog[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState("");
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<InterceptorLog | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    // Fetch interceptor info
    const fetchInfo = async () => {
      try {
        const response = await fetch(`/api/interceptors/${interceptorId}`);
        if (!response.ok) {
          throw new Error("Failed to fetch interceptor info");
        }
        const data = (await response.json()) as InterceptorInfo;
        setInfo(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load interceptor"
        );
      }
    };

    fetchInfo();

    // Connect to WebSocket
    const connectWebSocket = () => {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/monitor/${interceptorId}`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.addEventListener("open", () => {
        setIsConnected(true);
        setError("");
      });

      ws.addEventListener("message", (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === "initial_logs") {
            setLogs(data.logs);
            setTimeout(scrollToBottom, 100);
          } else if (data.type === "new_log") {
            setLogs((prev) => [...prev, data.log]);
            setTimeout(scrollToBottom, 100);
          } else if (data.type === "logs_cleared") {
            setLogs([]);
          }
        } catch (err) {
          console.error("Failed to parse WebSocket message:", err);
        }
      });

      ws.addEventListener("close", (_event) => {
        setIsConnected(false);
        // Attempt to reconnect after 3 seconds
        setTimeout(connectWebSocket, 3000);
      });

      ws.addEventListener("error", (error) => {
        console.error("WebSocket error for interceptor:", interceptorId, error);
        setError("WebSocket connection failed");
      });
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [interceptorId, scrollToBottom]);

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedUrl(type);
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const clearLogs = async () => {
    if (!info) {
      return;
    }

    setIsClearing(true);
    try {
      const response = await fetch(`/api/interceptors/${interceptorId}/logs`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to clear logs");
      }

      // The logs will be cleared via WebSocket message, but we can also clear them locally
      setLogs([]);
    } catch (err) {
      console.error("Failed to clear logs:", err);
      setError("Failed to clear logs");
    } finally {
      setIsClearing(false);
    }
  };

  const formatJson = (str: string) => {
    try {
      const obj = JSON.parse(str);
      return JSON.stringify(obj, null, 2);
    } catch {
      return str;
    }
  };

  const formatStreamingResponse = (body: string) => {
    // Handle SSE format
    if (body.includes("data: ")) {
      const lines = body.split("\n");
      const formattedLines = lines.map((line) => {
        if (line.startsWith("data: ")) {
          const jsonPart = line.substring(6);
          try {
            const parsed = JSON.parse(jsonPart);
            return `data: ${JSON.stringify(parsed, null, 2)}`;
          } catch {
            return line;
          }
        }
        return line;
      });
      return formattedLines.join("\n");
    }

    // Handle regular JSON
    return formatJson(body);
  };

  // Group requests with their responses
  const groupedLogs = () => {
    const groups: Array<{
      request: InterceptorLog;
      response?: InterceptorLog;
    }> = [];
    const requestMap = new Map<string, InterceptorLog>();

    // First pass: collect all requests
    for (const log of logs) {
      if (log.direction === "request") {
        requestMap.set(log.id, log);
      }
    }

    // Second pass: match responses to requests and create groups
    for (const log of logs) {
      if (log.direction === "request") {
        groups.push({ request: log });
      } else if (log.direction === "response") {
        // Find the corresponding request (this is simplified - in a real implementation,
        // you'd want to match based on request ID or other correlation)
        const lastGroup = groups.at(-1);
        if (lastGroup && !lastGroup.response) {
          lastGroup.response = log;
        } else {
          // Orphaned response - create a group anyway
          groups.push({ request: log, response: log });
        }
      }
    }

    return groups;
  };

  if (error && !info) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="mx-auto max-w-4xl">
          <div className="border border-red-300 bg-red-50">
            <div className="border-red-300 border-b bg-red-100 px-4 py-3">
              <span className="font-mono text-red-800 text-sm">
                ERROR INTERCEPTOR FAILED
              </span>
            </div>
            <div className="p-6">
              <p className="font-mono text-red-800 text-sm">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!info) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-8">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin border-2 border-gray-900 border-t-transparent" />
          <span className="font-mono text-gray-600 text-sm">
            LOADING INTERCEPTOR DATA
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Header */}
        <div className="mb-6">
          <a
            className="inline-flex items-center border border-gray-300 bg-gray-100 px-4 py-2 font-mono text-black text-sm transition-colors hover:bg-gray-200"
            href="/"
          >
            <svg
              aria-label="Back arrow"
              className="mr-2 h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <title>Back arrow</title>
              <path
                d="M15 19l-7-7 7-7"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
              />
            </svg>
            BACK
          </a>
        </div>
        <div className="border border-gray-300 bg-white">
          <div className="border-gray-300 border-b bg-gray-100 px-6 py-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-gray-900 text-lg tracking-wide">
                MCP INTERCEPTOR MONITOR
              </span>
              <div className="flex items-center space-x-4">
                <div
                  className={`flex items-center space-x-2 border px-3 py-1 font-mono text-xs ${
                    isConnected
                      ? "border-green-600 bg-green-50 text-green-800"
                      : "border-red-600 bg-red-50 text-red-800"
                  }`}
                >
                  <div
                    className={`h-2 w-2 ${isConnected ? "bg-green-600" : "bg-red-600"}`}
                  />
                  <span>{isConnected ? "CONNECTED" : "DISCONNECTED"}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6 p-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div>
                <h3 className="mb-3 font-bold font-mono text-gray-900 text-sm">
                  TARGET SERVER
                </h3>
                <div className="border border-gray-300 bg-gray-50 p-3">
                  <code className="break-all font-mono text-gray-800 text-sm">
                    {info.targetUrl}
                  </code>
                </div>
              </div>

              <div>
                <h3 className="mb-3 font-bold font-mono text-gray-900 text-sm">
                  PROXY ENDPOINT
                </h3>
                <div className="flex space-x-2">
                  <div className="min-w-0 flex-1 border border-gray-300 bg-gray-50 p-3">
                    <code className="block overflow-x-auto whitespace-nowrap font-mono text-gray-800 text-sm">
                      {info.proxyUrl}
                    </code>
                  </div>
                  <button
                    className="bg-gray-900 px-4 py-3 font-mono text-white text-xs transition-colors hover:bg-gray-800"
                    onClick={() => copyToClipboard(info.proxyUrl, "proxy")}
                    type="button"
                  >
                    {copiedUrl === "proxy" ? "COPIED" : "COPY"}
                  </button>
                </div>
                <p className="mt-2 font-mono text-gray-500 text-xs">
                  Configure your MCP client to use this URL
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Request/Response Log */}
        <div className="border border-gray-300 bg-white">
          <div className="border-gray-300 border-b bg-gray-100 px-6 py-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-gray-900 text-lg">
                REQUEST RESPONSE LOG
              </span>
              <div className="flex items-center space-x-4">
                <span className="font-mono text-gray-600 text-sm">
                  {groupedLogs().length} PAIRS
                </span>
                {logs.length > 0 && (
                  <button
                    className="bg-gray-600 px-3 py-1 font-mono text-white text-xs transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isClearing}
                    onClick={clearLogs}
                    type="button"
                  >
                    {isClearing ? "CLEARING..." : "CLEAR LOGS"}
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="p-6">
            {logs.length === 0 ? (
              <div className="py-12 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 animate-pulse items-center justify-center border-2 border-gray-300">
                  <span className="font-mono text-gray-400 text-xs">IDLE</span>
                </div>
                <p className="font-mono text-gray-500 text-sm">
                  No requests yet. Start using your proxy URL to see logs here.
                </p>
              </div>
            ) : (
              <div className="max-h-[600px] space-y-4 overflow-y-auto">
                {groupedLogs().map((group, index) => (
                  <RequestResponsePair
                    key={group.request.id || index}
                    onSelect={setSelectedLog}
                    request={group.request}
                    response={group.response}
                  />
                ))}
                <div ref={logsEndRef} />
              </div>
            )}
          </div>
        </div>

        {/* Log Detail Modal */}
        {selectedLog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/[var(--bg-opacity)] p-4 [--bg-opacity:50%]">
            <div className="max-h-[90vh] w-full max-w-6xl overflow-hidden border-1 border-gray-400 bg-white">
              <div className="border-gray-200 border-b bg-gray-100 px-6 py-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-gray-900 text-lg">
                    {selectedLog.direction === "request"
                      ? "REQUEST"
                      : "RESPONSE"}{" "}
                    DETAILS
                  </span>
                  <button
                    className="flex h-8 w-8 items-center justify-center bg-gray-300 text-black hover:bg-gray-200"
                    onClick={() => setSelectedLog(null)}
                    type="button"
                  >
                    ×
                  </button>
                </div>
              </div>

              <div className="max-h-[calc(90vh-120px)] space-y-6 overflow-y-auto p-6">
                {/* Metadata */}
                <div>
                  <h4 className="mb-3 font-bold font-mono text-gray-900 text-sm">
                    METADATA
                  </h4>
                  <div className="border border-gray-300 bg-gray-50 p-4">
                    <div className="grid grid-cols-2 gap-4 font-mono text-sm">
                      <div>
                        TIMESTAMP:{" "}
                        {new Date(selectedLog.timestamp).toLocaleString()}
                      </div>
                      <div>
                        DIRECTION: {selectedLog.direction.toUpperCase()}
                      </div>
                      {selectedLog.method && (
                        <div>METHOD: {selectedLog.method}</div>
                      )}
                      {selectedLog.status && (
                        <div>
                          STATUS: {selectedLog.status} {selectedLog.statusText}
                        </div>
                      )}
                    </div>
                    {selectedLog.url && (
                      <div className="mt-3 font-mono text-sm">
                        URL:{" "}
                        <code className="text-gray-700">{selectedLog.url}</code>
                      </div>
                    )}
                  </div>
                </div>

                {/* Headers */}
                <div>
                  <h4 className="mb-3 font-bold font-mono text-gray-900 text-sm">
                    HEADERS
                  </h4>
                  <div className="border border-gray-300 bg-gray-50 p-4">
                    <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-gray-700 text-xs">
                      {JSON.stringify(selectedLog.headers, null, 2)}
                    </pre>
                  </div>
                </div>

                {/* Body */}
                {selectedLog.body && (
                  <div>
                    <h4 className="mb-3 font-bold font-mono text-gray-900 text-sm">
                      {selectedLog.direction === "response"
                        ? "RESPONSE BODY"
                        : "REQUEST BODY"}
                    </h4>
                    <div className="border border-gray-300 bg-gray-50 p-4">
                      <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-gray-700 text-xs">
                        {formatStreamingResponse(selectedLog.body)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface RequestResponsePairProps {
  request: InterceptorLog;
  response?: InterceptorLog;
  onSelect: (log: InterceptorLog) => void;
}

function RequestResponsePair({
  request,
  response,
  onSelect,
}: RequestResponsePairProps) {
  const [showDetails, setShowDetails] = useState(false);

  const formatJsonRpcBody = (body: string) => {
    try {
      const obj = JSON.parse(body);
      return JSON.stringify(obj, null, 2);
    } catch {
      return body;
    }
  };

  const formatStreamingBody = (body: string) => {
    // Handle SSE format
    if (body.includes("data: ")) {
      const lines = body.split("\n");
      const dataLines = lines.filter((line) => line.startsWith("data: "));
      if (dataLines.length > 0) {
        try {
          const jsonPart = dataLines[0].substring(6);
          const parsed = JSON.parse(jsonPart);
          return JSON.stringify(parsed, null, 2);
        } catch {
          return body;
        }
      }
    }
    return formatJsonRpcBody(body);
  };

  const getJsonRpcMethod = (body: string) => {
    try {
      // Handle SSE format first
      if (body.includes("data: ")) {
        const lines = body.split("\n");
        const dataLine = lines.find((line) => line.startsWith("data: "));
        if (dataLine) {
          const jsonPart = dataLine.substring(6);
          const obj = JSON.parse(jsonPart);
          if (obj.method || obj.result) {
            return obj.method || "response";
          }
          return "Unknown";
        }
      }

      const obj = JSON.parse(body);
      if (obj.method) {
        return obj.method;
      }
      if (obj.result) {
        return "response";
      }
      if (obj.error) {
        return "error";
      }
      return "Unknown";
    } catch {
      return "Unknown";
    }
  };

  const extractBodyForParsing = (body: string): string => {
    if (body.includes("data: ")) {
      const lines = body.split("\n");
      const dataLine = lines.find((line) => line.startsWith("data: "));
      if (dataLine) {
        return dataLine.substring(6);
      }
    }
    return body;
  };

  const checkJsonRpcStatus = (
    body?: string
  ): "success" | "error" | "pending" => {
    if (!body) {
      return "pending";
    }
    try {
      const bodyToCheck = extractBodyForParsing(body);
      const obj = JSON.parse(bodyToCheck);
      if (obj.error) {
        return "error";
      }
      if (obj.result) {
        return "success";
      }
    } catch {
      // Continue with default
    }
    return "success";
  };

  const getResponseStatus = (response?: InterceptorLog): string => {
    if (!response) {
      return "pending";
    }
    if (response.status && response.status >= 200 && response.status < 300) {
      return checkJsonRpcStatus(response.body);
    }
    return "error";
  };

  const status = getResponseStatus(response);
  const method = getJsonRpcMethod(request.body || "{}");

  return (
    <div className="border border-gray-300 bg-white">
      <div className="border-gray-300 border-b bg-gray-100 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="font-bold font-mono text-gray-900 text-sm">
              {method.toUpperCase()}
            </span>
            <div
              className={`border px-2 py-1 font-mono text-xs ${
                status === "success"
                  ? "border-green-600 bg-green-50 text-green-800"
                  : ""
              } ${status === "error" ? "border-red-600 bg-red-50 text-red-800" : ""} ${
                status !== "success" && status !== "error"
                  ? "border-yellow-600 bg-yellow-50 text-yellow-800"
                  : ""
              }`}
            >
              {status === "pending" ? "PENDING" : response?.status || "UNKNOWN"}
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              className="font-mono text-gray-600 text-xs hover:text-gray-900"
              onClick={() => setShowDetails(!showDetails)}
              type="button"
            >
              {showDetails ? "HIDE" : "SHOW"} DETAILS
            </button>
            <span className="font-mono text-gray-500 text-xs">
              {new Date(request.timestamp).toLocaleTimeString()}
            </span>
          </div>
        </div>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Request */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h5 className="font-bold font-mono text-gray-900 text-xs">
                REQUEST
              </h5>
              <button
                className="font-mono text-gray-600 text-xs hover:text-gray-900"
                onClick={() => onSelect(request)}
                type="button"
              >
                VIEW FULL
              </button>
            </div>
            <div className="h-32 overflow-y-auto border border-gray-300 bg-gray-50 p-3">
              <pre className="whitespace-pre-wrap font-mono text-gray-800 text-xs">
                {formatStreamingBody(request.body || "{}")}
              </pre>
            </div>
          </div>

          {/* Response */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h5 className="font-bold font-mono text-gray-900 text-xs">
                RESPONSE
              </h5>
              {response && (
                <button
                  className="font-mono text-gray-600 text-xs hover:text-gray-900"
                  onClick={() => onSelect(response)}
                  type="button"
                >
                  VIEW FULL
                </button>
              )}
            </div>
            <div className="h-32 overflow-y-auto border border-gray-300 bg-gray-50 p-3">
              {response ? (
                <pre className="whitespace-pre-wrap font-mono text-gray-800 text-xs">
                  {formatStreamingBody(response.body || "{}")}
                </pre>
              ) : (
                <div className="flex h-full items-center justify-center text-gray-500">
                  <div className="mr-2 h-4 w-4 animate-spin border border-gray-500 border-t-transparent" />
                  <span className="font-mono text-xs">
                    WAITING FOR RESPONSE
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Detailed view */}
        {showDetails && (
          <div className="mt-4 border-gray-300 border-t pt-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div>
                <h6 className="mb-2 font-bold font-mono text-gray-900 text-xs">
                  REQUEST HEADERS
                </h6>
                <div className="border border-gray-300 bg-gray-50 p-2">
                  <pre className="max-h-24 overflow-y-auto whitespace-pre-wrap font-mono text-gray-700 text-xs">
                    {JSON.stringify(request.headers, null, 2)}
                  </pre>
                </div>
              </div>
              {response && (
                <div>
                  <h6 className="mb-2 font-bold font-mono text-gray-900 text-xs">
                    RESPONSE HEADERS
                  </h6>
                  <div className="border border-gray-300 bg-gray-50 p-2">
                    <pre className="max-h-24 overflow-y-auto whitespace-pre-wrap font-mono text-gray-700 text-xs">
                      {JSON.stringify(response.headers, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

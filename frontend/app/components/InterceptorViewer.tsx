import { useState, useEffect, useRef } from "react";
import { WebSocket } from "partysocket";

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
  const wsRef = useRef<WebSocket | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    // Fetch interceptor info
    const fetchInfo = async () => {
      try {
        const response = await fetch(
          `${
            import.meta.env.VITE_HTTP_PROTOCOL +
            "://" +
            import.meta.env.VITE_API_HOST
          }/api/interceptors/${interceptorId}`
        );
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
      const wsUrl = `${protocol}//${
        import.meta.env.VITE_API_HOST
      }/monitor/${interceptorId}`;

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
          }
        } catch (err) {
          console.error("Failed to parse WebSocket message:", err);
        }
      });

      ws.addEventListener("close", () => {
        setIsConnected(false);
        // Attempt to reconnect after 3 seconds
        setTimeout(connectWebSocket, 3000);
      });

      ws.addEventListener("error", (error) => {
        console.error("WebSocket error:", error);
        setError("WebSocket connection failed");
      });
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [interceptorId]);

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedUrl(type);
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
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
    if (body.includes('data: ')) {
      const lines = body.split('\n');
      const formattedLines = lines.map(line => {
        if (line.startsWith('data: ')) {
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
      return formattedLines.join('\n');
    }
    
    // Handle regular JSON
    return formatJson(body);
  };

  // Group requests with their responses
  const groupedLogs = () => {
    const groups: Array<{ request: InterceptorLog; response?: InterceptorLog }> = [];
    const requestMap = new Map<string, InterceptorLog>();
    
    // First pass: collect all requests
    logs.forEach(log => {
      if (log.direction === "request") {
        requestMap.set(log.id, log);
      }
    });
    
    // Second pass: match responses to requests and create groups
    logs.forEach(log => {
      if (log.direction === "request") {
        groups.push({ request: log });
      } else if (log.direction === "response") {
        // Find the corresponding request (this is simplified - in a real implementation,
        // you'd want to match based on request ID or other correlation)
        const lastGroup = groups[groups.length - 1];
        if (lastGroup && !lastGroup.response) {
          lastGroup.response = log;
        } else {
          // Orphaned response - create a group anyway
          groups.push({ request: log as any, response: log });
        }
      }
    });
    
    return groups;
  };

  if (error && !info) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="border border-red-300 bg-red-50">
            <div className="border-b border-red-300 px-4 py-3 bg-red-100">
              <span className="text-sm font-mono text-red-800">ERROR INTERCEPTOR FAILED</span>
            </div>
            <div className="p-6">
              <p className="text-red-800 font-mono text-sm">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!info) {
    return (
      <div className="min-h-screen bg-gray-50 p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent animate-spin mx-auto mb-4"></div>
          <span className="text-gray-600 font-mono text-sm">LOADING INTERCEPTOR DATA</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
                <div className="mb-6">
          <a
            href="/"
            className="inline-flex items-center px-4 py-2 bg-gray-100 text-black font-mono text-sm hover:bg-gray-800 transition-colors border border-gray-300"
          >
            <svg
              className="w-4 h-4 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            BACK
          </a>
        </div>
        <div className="border border-gray-300 bg-white">
          <div className="border-b border-gray-300 px-6 py-4 bg-gray-100">
            <div className="flex items-center justify-between">
              <span className="text-lg font-mono text-gray-900 tracking-wide">MCP INTERCEPTOR MONITOR</span>
              <div className="flex items-center space-x-4">
                <div className={`flex items-center space-x-2 px-3 py-1 border font-mono text-xs ${
                  isConnected 
                    ? "border-green-600 bg-green-50 text-green-800" 
                    : "border-red-600 bg-red-50 text-red-800"
                }`}>
                  <div className={`w-2 h-2 ${isConnected ? "bg-green-600" : "bg-red-600"}`}></div>
                  <span>{isConnected ? "CONNECTED" : "DISCONNECTED"}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-mono font-bold text-gray-900 mb-3">TARGET SERVER</h3>
                <div className="border border-gray-300 bg-gray-50 p-3">
                  <code className="text-sm font-mono text-gray-800 break-all">{info.targetUrl}</code>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-mono font-bold text-gray-900 mb-3">PROXY ENDPOINT</h3>
                <div className="flex space-x-2">
                  <div className="flex-1 border border-gray-300 bg-gray-50 p-3 min-w-0">
                    <code className="text-sm font-mono text-gray-800 block overflow-x-auto whitespace-nowrap">{info.proxyUrl}</code>
                  </div>
                  <button
                    onClick={() => copyToClipboard(info.proxyUrl, "proxy")}
                    className="px-4 py-3 bg-gray-900 text-white font-mono text-xs hover:bg-gray-800 transition-colors"
                  >
                    {copiedUrl === "proxy" ? "COPIED" : "COPY"}
                  </button>
                </div>
                <p className="text-xs font-mono text-gray-500 mt-2">
                  Configure your MCP client to use this URL
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Request/Response Log */}
        <div className="border border-gray-300 bg-white">
          <div className="border-b border-gray-300 px-6 py-4 bg-gray-100">
            <div className="flex items-center justify-between">
              <span className="text-lg font-mono text-gray-900">REQUEST RESPONSE LOG</span>
              <span className="text-sm font-mono text-gray-600">{groupedLogs().length} PAIRS</span>
            </div>
          </div>

          <div className="p-6">
            {logs.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 border-2 border-gray-300 mx-auto mb-4 flex items-center justify-center animate-pulse">
                  <span className="text-gray-400 font-mono text-xs">IDLE</span>
                </div>
                <p className="text-gray-500 font-mono text-sm">
                  No requests yet. Start using your proxy URL to see logs here.
                </p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[600px] overflow-y-auto">
                {groupedLogs().map((group, index) => (
                  <RequestResponsePair
                    key={group.request.id || index}
                    request={group.request}
                    response={group.response}
                    onSelect={setSelectedLog}
                  />
                ))}
                <div ref={logsEndRef} />
              </div>
            )}
          </div>
        </div>

        {/* Log Detail Modal */}
        {selectedLog && (
          <div className="fixed inset-0 bg-black/[var(--bg-opacity)] [--bg-opacity:50%] flex items-center justify-center p-4 z-50">
            <div className="bg-white border-1 border-gray-400 w-full max-w-6xl max-h-[90vh] overflow-hidden">
              <div className="border-b border-gray-200 px-6 py-4 bg-gray-100">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-mono text-gray-900">
                    {selectedLog.direction === "request" ? "REQUEST" : "RESPONSE"} DETAILS
                  </span>
                  <button
                    onClick={() => setSelectedLog(null)}
                    className="w-8 h-8 bg-gray-300 text-black flex items-center justify-center hover:bg-gray-200"
                  >
                    ×
                  </button>
                </div>
              </div>

              <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)] space-y-6">
                {/* Metadata */}
                <div>
                  <h4 className="text-sm font-mono font-bold text-gray-900 mb-3">METADATA</h4>
                  <div className="border border-gray-300 bg-gray-50 p-4">
                    <div className="grid grid-cols-2 gap-4 text-sm font-mono">
                      <div>TIMESTAMP: {new Date(selectedLog.timestamp).toLocaleString()}</div>
                      <div>DIRECTION: {selectedLog.direction.toUpperCase()}</div>
                      {selectedLog.method && <div>METHOD: {selectedLog.method}</div>}
                      {selectedLog.status && (
                        <div>STATUS: {selectedLog.status} {selectedLog.statusText}</div>
                      )}
                    </div>
                    {selectedLog.url && (
                      <div className="mt-3 text-sm font-mono">
                        URL: <code className="text-gray-700">{selectedLog.url}</code>
                      </div>
                    )}
                  </div>
                </div>

                {/* Headers */}
                <div>
                  <h4 className="text-sm font-mono font-bold text-gray-900 mb-3">HEADERS</h4>
                  <div className="border border-gray-300 bg-gray-50 p-4">
                    <pre className="text-xs font-mono text-gray-700 whitespace-pre-wrap overflow-x-auto">
                      {JSON.stringify(selectedLog.headers, null, 2)}
                    </pre>
                  </div>
                </div>

                {/* Body */}
                {selectedLog.body && (
                  <div>
                    <h4 className="text-sm font-mono font-bold text-gray-900 mb-3">
                      {selectedLog.direction === "response" ? "RESPONSE BODY" : "REQUEST BODY"}
                    </h4>
                    <div className="border border-gray-300 bg-gray-50 p-4">
                      <pre className="text-xs font-mono text-gray-700 whitespace-pre-wrap overflow-x-auto">
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
    if (body.includes('data: ')) {
      const lines = body.split('\n');
      const dataLines = lines.filter(line => line.startsWith('data: '));
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
      if (body.includes('data: ')) {
        const lines = body.split('\n');
        const dataLine = lines.find(line => line.startsWith('data: '));
        if (dataLine) {
          const jsonPart = dataLine.substring(6);
          const obj = JSON.parse(jsonPart);
          return obj.method || obj.result ? (obj.method || "response") : "Unknown";
        }
      }
      
      const obj = JSON.parse(body);
      return obj.method || (obj.result ? "response" : obj.error ? "error" : "Unknown");
    } catch {
      return "Unknown";
    }
  };

  const getResponseStatus = (response?: InterceptorLog) => {
    if (!response) return "pending";
    if (response.status && response.status >= 200 && response.status < 300) {
      // Check if it's an error response in the JSON-RPC body
      try {
        if (response.body) {
          let bodyToCheck = response.body;
          
          // Handle SSE format
          if (bodyToCheck.includes('data: ')) {
            const lines = bodyToCheck.split('\n');
            const dataLine = lines.find(line => line.startsWith('data: '));
            if (dataLine) {
              bodyToCheck = dataLine.substring(6);
            }
          }
          
          const obj = JSON.parse(bodyToCheck);
          if (obj.error) return "error";
          if (obj.result) return "success";
        }
      } catch {}
      return "success";
    }
    return "error";
  };

  const status = getResponseStatus(response);
  const method = getJsonRpcMethod(request.body || "{}");

  return (
    <div className="border border-gray-300 bg-white">
      <div className="border-b border-gray-300 px-4 py-3 bg-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="font-mono text-sm font-bold text-gray-900">{method.toUpperCase()}</span>
            <div className={`px-2 py-1 text-xs font-mono border ${
              status === "success"
                ? "border-green-600 bg-green-50 text-green-800"
                : status === "error"
                ? "border-red-600 bg-red-50 text-red-800"
                : "border-yellow-600 bg-yellow-50 text-yellow-800"
            }`}>
              {status === "pending" ? "PENDING" : response?.status || "UNKNOWN"}
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-xs font-mono text-gray-600 hover:text-gray-900"
            >
              {showDetails ? "HIDE" : "SHOW"} DETAILS
            </button>
            <span className="text-xs font-mono text-gray-500">
              {new Date(request.timestamp).toLocaleTimeString()}
            </span>
          </div>
        </div>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Request */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h5 className="text-xs font-mono font-bold text-gray-900">REQUEST</h5>
              <button
                onClick={() => onSelect(request)}
                className="text-xs font-mono text-gray-600 hover:text-gray-900"
              >
                VIEW FULL
              </button>
            </div>
            <div className="border border-gray-300 bg-gray-50 p-3 h-32 overflow-y-auto">
              <pre className="text-xs font-mono text-gray-800 whitespace-pre-wrap">
                {formatStreamingBody(request.body || "{}")}
              </pre>
            </div>
          </div>

          {/* Response */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h5 className="text-xs font-mono font-bold text-gray-900">RESPONSE</h5>
              {response && (
                <button
                  onClick={() => onSelect(response)}
                  className="text-xs font-mono text-gray-600 hover:text-gray-900"
                >
                  VIEW FULL
                </button>
              )}
            </div>
            <div className="border border-gray-300 bg-gray-50 p-3 h-32 overflow-y-auto">
              {response ? (
                <pre className="text-xs font-mono text-gray-800 whitespace-pre-wrap">
                  {formatStreamingBody(response.body || "{}")}
                </pre>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <div className="w-4 h-4 border border-gray-500 border-t-transparent animate-spin mr-2"></div>
                  <span className="text-xs font-mono">WAITING FOR RESPONSE</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Detailed view */}
        {showDetails && (
          <div className="mt-4 pt-4 border-t border-gray-300">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <h6 className="text-xs font-mono font-bold text-gray-900 mb-2">REQUEST HEADERS</h6>
                <div className="border border-gray-300 bg-gray-50 p-2">
                  <pre className="text-xs font-mono text-gray-700 whitespace-pre-wrap max-h-24 overflow-y-auto">
                    {JSON.stringify(request.headers, null, 2)}
                  </pre>
                </div>
              </div>
              {response && (
                <div>
                  <h6 className="text-xs font-mono font-bold text-gray-900 mb-2">RESPONSE HEADERS</h6>
                  <div className="border border-gray-300 bg-gray-50 p-2">
                    <pre className="text-xs font-mono text-gray-700 whitespace-pre-wrap max-h-24 overflow-y-auto">
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

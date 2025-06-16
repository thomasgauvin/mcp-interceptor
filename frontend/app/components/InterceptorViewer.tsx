import { useState, useEffect, useRef } from "react";

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

      ws.onopen = () => {
        setIsConnected(true);
        setError("");
      };

      ws.onmessage = (event) => {
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
      };

      ws.onclose = () => {
        setIsConnected(false);
        // Attempt to reconnect after 3 seconds
        setTimeout(connectWebSocket, 3000);
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        setError("WebSocket connection failed");
      };
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

  if (error && !info) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
        <h2 className="text-lg font-bold text-red-600 dark:text-red-400 mb-2">
          Error
        </h2>
        <p className="text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  if (!info) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-2 text-gray-600 dark:text-gray-400"></span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            MCP Interceptor
          </h1>
          <div className="flex items-center space-x-4">
            <div
              className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm ${
                isConnected
                  ? "bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400"
                  : "bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400"
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  isConnected ? "bg-green-500" : "bg-red-500"
                }`}
              ></div>
              <span>{isConnected ? "Connected" : "Disconnected"}</span>
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {info.viewerCount} viewer{info.viewerCount !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Target URL
            </label>
            <div className="flex items-center space-x-2">
              <input
                readOnly
                value={info.targetUrl}
                className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Proxy URL (Use this in your MCP client)
            </label>
            <div className="flex items-center space-x-2">
              <input
                readOnly
                value={info.proxyUrl}
                className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white text-sm"
              />
              <button
                onClick={() => copyToClipboard(info.proxyUrl, "proxy")}
                className="px-3 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                {copiedUrl === "proxy" ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Logs */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            Request Logs ({logs.length})
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Real-time view of all requests and responses
          </p>
        </div>

        <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-96 overflow-y-auto">
          {logs.length === 0 ? (
            <div className="p-6 text-center text-gray-500 dark:text-gray-400">
              No requests yet. Start using your proxy URL to see logs here.
            </div>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                onClick={() => setSelectedLog(log)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded ${
                        log.direction === "request"
                          ? "bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                          : "bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400"
                      }`}
                    >
                      {log.direction.toUpperCase()}
                    </span>
                    {log.method && (
                      <span className="px-2 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                        {log.method}
                      </span>
                    )}
                    {log.status && (
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded ${
                          log.status >= 200 && log.status < 300
                            ? "bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400"
                            : "bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400"
                        }`}
                      >
                        {log.status}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {formatTimestamp(log.timestamp)}
                  </span>
                </div>
                {log.url && (
                  <div className="mt-1 text-sm text-gray-600 dark:text-gray-400 truncate">
                    {log.url}
                  </div>
                )}
              </div>
            ))
          )}
          <div ref={logsEndRef} />
        </div>
      </div>

      {/* Log Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  {selectedLog.direction === "request" ? "Request" : "Response"}{" "}
                  Details
                </h3>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                  Metadata
                </h4>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="font-medium">Timestamp:</span>{" "}
                      {new Date(selectedLog.timestamp).toLocaleString()}
                    </div>
                    <div>
                      <span className="font-medium">Direction:</span>{" "}
                      {selectedLog.direction}
                    </div>
                    {selectedLog.method && (
                      <div>
                        <span className="font-medium">Method:</span>{" "}
                        {selectedLog.method}
                      </div>
                    )}
                    {selectedLog.status && (
                      <div>
                        <span className="font-medium">Status:</span>{" "}
                        {selectedLog.status} {selectedLog.statusText}
                      </div>
                    )}
                  </div>
                  {selectedLog.url && (
                    <div className="mt-2">
                      <span className="font-medium">URL:</span>{" "}
                      {selectedLog.url}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                  Headers
                </h4>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                  <pre className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                    {JSON.stringify(selectedLog.headers, null, 2)}
                  </pre>
                </div>
              </div>

              {selectedLog.body && (
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                    Body
                  </h4>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                    <pre className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                      {formatJson(selectedLog.body)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

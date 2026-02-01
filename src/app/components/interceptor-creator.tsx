import { useState } from "react";

interface InterceptorCreatorProps {
  onCreateInterceptor: (interceptorData: {
    interceptorId: string;
    targetUrl: string;
    proxyUrl: string;
    monitorUrl: string;
    createdAt: string;
  }) => void;
}

export function InterceptorCreator({
  onCreateInterceptor,
}: InterceptorCreatorProps) {
  const [targetUrl, setTargetUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const normalizeUrl = (url: string) => {
    const trimmed = url.trim();
    if (!(trimmed.startsWith("http://") || trimmed.startsWith("https://"))) {
      return `https://${trimmed}`;
    }
    return trimmed;
  };

  const validateMcpServer = async (url: string) => {
    try {
      const response = await fetch("/api/validate-mcp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          targetUrl: url,
        }),
      });

      const data = (await response.json()) as {
        valid?: boolean;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error || "Server validation failed");
      }

      if (!data.valid) {
        throw new Error(data.error || "Server is not a valid MCP server");
      }

      return true;
    } catch (err) {
      throw new Error(
        err instanceof Error
          ? err.message
          : "The URL does not appear to be a valid MCP server. Please check the URL and ensure the server supports the MCP protocol."
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUrl.trim()) {
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      // Normalize URL (add https:// if missing)
      const normalizedUrl = normalizeUrl(targetUrl);

      // Validate URL format
      new URL(normalizedUrl);

      // Validate that it's an MCP server
      await validateMcpServer(normalizedUrl);

      const response = await fetch("/api/interceptors", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          targetUrl: normalizedUrl,
        }),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as { error: string };
        throw new Error(errorData.error || "Failed to create interceptor");
      }

      const interceptorData = (await response.json()) as {
        interceptorId: string;
        targetUrl: string;
        proxyUrl: string;
        monitorUrl: string;
        createdAt: string;
      };
      onCreateInterceptor(interceptorData);
    } catch (err) {
      if (err instanceof TypeError && err.message.includes("Invalid URL")) {
        setError("Please enter a valid URL");
      } else {
        setError(
          err instanceof Error ? err.message : "Failed to create interceptor"
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-12xl">
        {/* Header */}
        <div className="mb-12 flex justify-center">
          <div className="w-full max-w-lg">
            <h1 className="mb-4 font-bold text-4xl text-black tracking-tight">
              MCP INTERCEPTOR
            </h1>
            <p className="font-mono text-gray-600 text-lg uppercase">
              Proxy to monitor MCP requests made by agents like Claude
            </p>
            <p className="font-mono text-gray-400 text-md">
              Built with WebSockets and Cloudflare Durable Objects
            </p>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex justify-center">
          {/* Form */}
          <div className="w-full max-w-lg">
            <div className="border border-gray-300 bg-white">
              {/* Terminal Header */}
              <div className="border-gray-300 border-b bg-gray-100 px-4 py-3">
                <span className="font-mono text-gray-600 text-sm">
                  CREATE INTERCEPTOR
                </span>
              </div>

              {/* Form Content */}
              <div className="p-6">
                {/* How it works */}
                <div className="mb-8">
                  <h2 className="mb-4 font-bold text-black text-lg">
                    HOW IT WORKS
                  </h2>
                  <div className="space-y-3 text-gray-600 text-sm">
                    <div className="flex items-start">
                      <span className="mr-3 font-mono text-black">1.</span>
                      <span className="font-mono">
                        Create a unique proxy URL
                      </span>
                    </div>
                    <div className="flex items-start">
                      <span className="mr-3 font-mono text-black">2.</span>
                      <span className="font-mono">
                        Configure Claude or any agent client with the proxy URL
                      </span>
                    </div>
                    <div className="flex items-start">
                      <span className="mr-3 font-mono text-black">3.</span>
                      <span className="font-mono">
                        Monitor requests in real-time
                      </span>
                    </div>
                  </div>
                </div>

                <form className="space-y-6" onSubmit={handleSubmit}>
                  <div>
                    <label
                      className="mb-3 block font-mono text-gray-700 text-sm"
                      htmlFor="mcp-url-input"
                    >
                      MCP SERVER URL
                    </label>
                    <div className="relative">
                      <input
                        className="w-full border border-gray-300 bg-white px-4 py-3 font-mono text-sm placeholder-gray-400 focus:border-black focus:outline-none"
                        disabled={isLoading}
                        id="mcp-url-input"
                        onChange={(e) => setTargetUrl(e.target.value)}
                        placeholder="https://your-mcp-server.com"
                        required
                        type="url"
                        value={targetUrl}
                      />
                      <div className="absolute top-1/2 right-4 -translate-y-1/2 transform">
                        <div className="h-2 w-2 rounded-full bg-gray-400" />
                      </div>
                    </div>

                    {/* Test Server Section */}
                    <div className="mt-4 border border-gray-200 bg-gray-50 p-4">
                      <h3 className="mb-2 font-bold font-mono text-gray-700 text-xs">
                        TRY WITH TEST SERVER
                      </h3>
                      <p className="mb-3 font-mono text-gray-600 text-xs">
                        Use our demo weather MCP server to test the interceptor
                      </p>
                      <button
                        className="font-mono text-blue-600 text-xs underline hover:text-blue-800"
                        disabled={isLoading}
                        onClick={() =>
                          setTargetUrl(
                            "https://random-weather-mcp.tgauvin.workers.dev/mcp"
                          )
                        }
                        type="button"
                      >
                        Use: https://random-weather-mcp.tgauvin.workers.dev/mcp
                      </button>
                    </div>

                    {/* Important Notice */}
                    <div className="mt-3">
                      <p className="font-mono text-gray-500 text-xs">
                        Note: Only supports Streamable HTTP transport (MCP
                        2025-03-26+)
                      </p>
                    </div>
                  </div>

                  {error && (
                    <div className="border border-red-300 bg-red-50 p-4">
                      <div className="font-mono text-red-800 text-sm">
                        {error}
                      </div>
                    </div>
                  )}

                  <button
                    className="w-full bg-black px-6 py-3 font-mono text-sm text-white transition-colors duration-200 hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!targetUrl.trim() || isLoading}
                    type="submit"
                  >
                    {isLoading ? (
                      <span className="flex items-center justify-center">
                        <span className="mr-2">VALIDATING</span>
                        <span className="animate-pulse">...</span>
                      </span>
                    ) : (
                      "CREATE INTERCEPTOR"
                    )}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

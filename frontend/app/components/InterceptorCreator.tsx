import { useState } from "react";

interface InterceptorCreatorProps {
  onCreateInterceptor: (interceptorData: any) => void;
}

export function InterceptorCreator({
  onCreateInterceptor,
}: InterceptorCreatorProps) {
  const [targetUrl, setTargetUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const normalizeUrl = (url: string) => {
    const trimmed = url.trim();
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      return `https://${trimmed}`;
    }
    return trimmed;
  };

  const validateMcpServer = async (url: string) => {
    try {
      const response = await fetch(
        import.meta.env.VITE_HTTP_PROTOCOL +
          "://" +
          import.meta.env.VITE_API_HOST +
          "/api/validate-mcp",
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            targetUrl: url,
          }),
        }
      );

      const data = await response.json() as { valid?: boolean; error?: string };
      
      if (!response.ok) {
        throw new Error(data.error || 'Server validation failed');
      }

      if (!data.valid) {
        throw new Error(data.error || 'Server is not a valid MCP server');
      }

      return true;
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'The URL does not appear to be a valid MCP server. Please check the URL and ensure the server supports the MCP protocol.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUrl.trim()) return;

    setIsLoading(true);
    setError("");

    try {
      // Normalize URL (add https:// if missing)
      const normalizedUrl = normalizeUrl(targetUrl);
      
      // Validate URL format
      new URL(normalizedUrl);

      // Validate that it's an MCP server
      await validateMcpServer(normalizedUrl);

      console.log(import.meta.env.VITE_API_HOST);

      const response = await fetch(
        import.meta.env.VITE_HTTP_PROTOCOL +
          "://" +
          import.meta.env.VITE_API_HOST +
          "/api/interceptors",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            targetUrl: normalizedUrl,
          }),
        }
      );

      if (!response.ok) {
        const errorData = (await response.json()) as { error: string };
        throw new Error(errorData.error || "Failed to create interceptor");
      }

      const interceptorData = await response.json();
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
      <div className="max-w-12xl mx-auto">
        {/* Header */}
        <div className="mb-12 flex justify-center">
          <div className="w-full max-w-lg">
            <h1 className="text-4xl font-bold text-black mb-4 tracking-tight">
              MCP INTERCEPTOR
            </h1>
            <p className="text-gray-600 text-lg font-mono uppercase" >
              Proxy to monitor MCP requests made by agents like Claude
            </p>
            <p className="text-gray-400 text-md font-mono " >
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
              <div className="border-b border-gray-300 px-4 py-3 bg-gray-100">
                <span className="text-sm font-mono text-gray-600">CREATE INTERCEPTOR</span>
              </div>

              {/* Form Content */}
              <div className="p-6">
                {/* How it works */}
                <div className="mb-8">
                  <h2 className="text-lg font-bold text-black mb-4">HOW IT WORKS</h2>
                  <div className="space-y-3 text-gray-600 text-sm">
                    <div className="flex items-start">
                      <span className="text-black font-mono mr-3">1.</span>
                      <span className="font-mono">Create a unique proxy URL</span>
                    </div>
                    <div className="flex items-start">
                      <span className="text-black font-mono mr-3">2.</span>
                      <span className="font-mono">Configure Claude or any agent client with the proxy URL</span>
                    </div>
                    <div className="flex items-start">
                      <span className="text-black font-mono mr-3">3.</span>
                      <span className="font-mono">Monitor requests in real-time</span>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label className="block text-sm font-mono text-gray-700 mb-3">
                      MCP SERVER URL
                    </label>
                    <div className="relative">
                      <input
                        type="url"
                        value={targetUrl}
                        onChange={(e) => setTargetUrl(e.target.value)}
                        placeholder="https://your-mcp-server.com"
                        className="w-full px-4 py-3 border border-gray-300 font-mono text-sm
                                  focus:outline-none focus:border-black bg-white
                                  placeholder-gray-400"
                        required
                        disabled={isLoading}
                      />
                      <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                        <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                      </div>
                    </div>
                    
                    {/* Test Server Section */}
                    <div className="mt-4 p-4 border border-gray-200 bg-gray-50">
                      <h3 className="text-xs font-mono font-bold text-gray-700 mb-2">TRY WITH TEST SERVER</h3>
                      <p className="text-xs font-mono text-gray-600 mb-3">
                        Use our demo weather MCP server to test the interceptor
                      </p>
                      <button
                        type="button"
                        onClick={() => setTargetUrl("https://random-weather-mcp.tgauvin.workers.dev/mcp")}
                        className="text-xs font-mono text-blue-600 hover:text-blue-800 underline"
                        disabled={isLoading}
                      >
                        Use: https://random-weather-mcp.tgauvin.workers.dev/mcp
                      </button>
                    </div>

                    {/* Important Notice */}
                    <div className="mt-3">
                      <p className="text-xs font-mono text-gray-500">
                        Note: Only supports Streamable HTTP transport (MCP 2025-03-26+)
                      </p>
                    </div>
                  </div>

                  {error && (
                    <div className="border border-red-300 bg-red-50 p-4">
                      <div className="text-red-800 text-sm font-mono">{error}</div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={!targetUrl.trim() || isLoading}
                    className="w-full bg-black text-white py-3 px-6 font-mono text-sm
                              hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed
                              transition-colors duration-200"
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

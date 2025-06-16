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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUrl.trim()) return;

    setIsLoading(true);
    setError("");

    try {
      // Validate URL format
      new URL(targetUrl.trim());

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
            targetUrl: targetUrl.trim(),
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
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          Create MCP Interceptor
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Enter the URL of the MCP server you want to monitor
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="targetUrl"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            MCP Server URL
          </label>
          <input
            type="url"
            id="targetUrl"
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            placeholder="https://your-mcp-server.com"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                       placeholder-gray-500 dark:placeholder-gray-400
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
            disabled={isLoading}
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            This will be the target server that your proxy will forward requests
            to
          </p>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={!targetUrl.trim() || isLoading}
          className="w-full px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                     disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
        >
          {isLoading ? (
            <>
              <svg
                className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Creating Interceptor...
            </>
          ) : (
            "Create Interceptor"
          )}
        </button>
      </form>

      <div className="mt-6 text-xs text-gray-500 dark:text-gray-400">
        <p className="font-medium mb-2">What happens next:</p>
        <ul className="space-y-1">
          <li>• You'll get a unique proxy URL to use with your MCP client</li>
          <li>• You'll get a viewer URL to monitor requests in real-time</li>
          <li>• All traffic will be logged and displayed in the viewer</li>
        </ul>
      </div>
    </div>
  );
}

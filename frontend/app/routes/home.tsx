import type { Route } from "./+types/home";
import { useNavigate } from "react-router";
import { InterceptorCreator } from "../components/InterceptorCreator";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "MCP Interceptor" },
    {
      name: "description",
      content:
        "Create MCP proxy servers to intercept and view requests in real-time",
    },
  ];
}

export function loader({ context }: Route.LoaderArgs) {
  return { message: "MCP Interceptor powered by Cloudflare Durable Objects" };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const navigate = useNavigate();

  const handleJoinRoom = (username: string, room: string) => {
    // Store username in session storage for the room
    sessionStorage.setItem("chat-username", username);

    // Navigate to the room URL
    navigate(`/room/${encodeURIComponent(room)}`);
  };

  const handleCreateInterceptor = (interceptorData: any) => {
    // Navigate to the monitor viewer
    navigate(`/monitor/${interceptorData.interceptorId}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            MCP Interceptor
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-2">
            Create proxy servers to intercept and monitor MCP requests in
            real-time
          </p>
          <p className="text-gray-500 dark:text-gray-500">
            Built with WebSockets and Cloudflare Durable Objects
          </p>
        </div>

        <div className="max-w-md mx-auto mb-12">
          <InterceptorCreator onCreateInterceptor={handleCreateInterceptor} />
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              How it works
            </h2>
            <div className="space-y-4 text-gray-600 dark:text-gray-400">
              <div className="flex items-start space-x-3">
                <div className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
                  1
                </div>
                <p>Enter the URL of your MCP server that you want to monitor</p>
              </div>
              <div className="flex items-start space-x-3">
                <div className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
                  2
                </div>
                <p>
                  Get a unique proxy URL to use in place of your original MCP
                  server URL
                </p>
              </div>
              <div className="flex items-start space-x-3">
                <div className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
                  3
                </div>
                <p>Configure your MCP client to use the proxy URL</p>
              </div>
              <div className="flex items-start space-x-3">
                <div className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
                  4
                </div>
                <p>
                  View all requests and responses in real-time through the
                  viewer interface
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Legacy Chat Feature
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              The original WebSocket chat functionality is still available:
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

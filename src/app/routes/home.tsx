import { useNavigate } from "react-router";
import { InterceptorCreator } from "../components/interceptor-creator";
import type { Route } from "./+types/home";

export function meta(): Route.MetaDescriptors {
  return [
    { title: "MCP Interceptor" },
    {
      name: "description",
      content:
        "Create MCP proxy servers to intercept and view requests in real-time",
    },
  ];
}

export function loader(): { message: string } {
  return { message: "MCP Interceptor powered by Cloudflare Durable Objects" };
}

export default function Home(): React.ReactNode {
  const navigate = useNavigate();

  const handleCreateInterceptor = (interceptorData: {
    interceptorId: string;
    targetUrl: string;
    proxyUrl: string;
    monitorUrl: string;
    createdAt: string;
  }): void => {
    // Navigate to the monitor viewer
    navigate(`/monitor/${interceptorData.interceptorId}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="mx-auto">
          <InterceptorCreator onCreateInterceptor={handleCreateInterceptor} />
        </div>
      </div>
    </div>
  );
}

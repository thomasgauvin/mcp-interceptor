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

  const handleCreateInterceptor = (interceptorData: any) => {
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

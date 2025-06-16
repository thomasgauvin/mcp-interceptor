import type { Route } from "./+types/monitor";
import { useParams } from "react-router";
import { InterceptorViewer } from "../components/InterceptorViewer";

export function meta({ params }: Route.MetaArgs) {
  return [
    { title: `MCP Monitor - ${params.id}` },
    {
      name: "description",
      content: "View MCP requests and responses in real-time",
    },
  ];
}

export function loader({ params }: Route.LoaderArgs) {
  return { interceptorId: params.id };
}

export default function MonitorPage({ loaderData }: Route.ComponentProps) {
  const { interceptorId } = loaderData;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <a
            href="/"
            className="inline-flex items-center text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
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
            Back to Home
          </a>
        </div>

        <InterceptorViewer interceptorId={interceptorId} />
      </div>
    </div>
  );
}

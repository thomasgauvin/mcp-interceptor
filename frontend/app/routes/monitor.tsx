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


        <InterceptorViewer interceptorId={interceptorId} />
      </div>
    </div>
  );
}

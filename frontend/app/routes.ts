import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("monitor/:id", "routes/monitor.tsx"),
] satisfies RouteConfig;

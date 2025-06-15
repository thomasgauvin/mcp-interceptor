import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("room/:roomName", "routes/room.tsx"),
] satisfies RouteConfig;

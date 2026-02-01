import { type Context, Hono } from "hono";
import { createRequestHandler } from "react-router";
import createApiRoutes from "./api/routes";

const app = new Hono<{ Bindings: CloudflareBindings }>();

// Mount API routes
const apiRoutes = createApiRoutes();
app.route("/api", apiRoutes);
app.route("/proxy", apiRoutes);
app.route("/monitor", apiRoutes);

// Handle React Router SSR
const reactRouterHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE
);

// Fallback: React Router for all other paths
app.all("*", async (c: Context<{ Bindings: CloudflareBindings }>) => {
  return await reactRouterHandler(c.req.raw, {
    cloudflare: { env: c.env, ctx: c.executionCtx },
  });
});

export default app;

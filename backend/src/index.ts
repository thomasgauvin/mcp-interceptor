import { Hono } from "hono";

export { WebSocketHibernationServer } from "./websocketDurableObject";

const app = new Hono<{ Bindings: Env }>();

app.get("/api", (c) => {
  return c.text("Hello, World! Served from Hono!");
});

// WebSocket endpoint - supports room-based connections
app.get("/ws/:room?", async (c) => {
  const upgradeHeader = c.req.header("upgrade");
  if (upgradeHeader !== "websocket") {
    return c.text("Expected Upgrade: websocket", 426);
  }

  // Get room from URL parameter or default to "general"
  const room = c.req.param("room") || "general";

  // Get the Durable Object - use room name to create isolated chat rooms
  const durableObjectId = c.env.WEBSOCKET_HIBERNATION_SERVER.idFromName(
    `chat-room-${room}`
  );
  const durableObject = c.env.WEBSOCKET_HIBERNATION_SERVER.get(durableObjectId);

  // Forward the WebSocket upgrade request to the Durable Object
  return durableObject.fetch(c.req.raw);
});

export default app;

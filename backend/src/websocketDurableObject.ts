import { DurableObject } from "cloudflare:workers";

interface UserSession {
  username: string;
  room: string;
  userId: string;
  joinedAt: number;
}

// Durable Object
export class WebSocketHibernationServer extends DurableObject {
  private sessions = new Map<WebSocket, UserSession>();
  async fetch(request: Request): Promise<Response> {
    // Creates two ends of a WebSocket connection.
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    // Calling `acceptWebSocket()` informs the runtime that this WebSocket is to begin terminating
    // request within the Durable Object. It has the effect of "accepting" the connection,
    // and allowing the WebSocket to send and receive messages.
    // Unlike `ws.accept()`, `state.acceptWebSocket(ws)` informs the Workers Runtime that the WebSocket
    // is "hibernatable", so the runtime does not need to pin this Durable Object to memory while
    // the connection is open. During periods of inactivity, the Durable Object can be evicted
    // from memory, but the WebSocket connection will remain open. If at some later point the
    // WebSocket receives a message, the runtime will recreate the Durable Object
    // (run the `constructor`) and deliver the message to the appropriate handler.
    this.ctx.acceptWebSocket(server);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  async webSocketMessage(
    ws: WebSocket,
    message: string | ArrayBuffer
  ): Promise<void> {
    // Convert ArrayBuffer to string if necessary
    const messageString =
      typeof message === "string" ? message : new TextDecoder().decode(message);

    // Parse the incoming message
    let messageData;
    try {
      messageData = JSON.parse(messageString);
    } catch (e) {
      // If it's not valid JSON, treat it as a simple text message
      messageData = {
        type: "message",
        content: messageString,
        timestamp: Date.now(),
      };
    }

    // Handle different message types
    switch (messageData.type) {
      case "join":
        await this.handleJoinRoom(ws, messageData);
        break;
      case "leave":
        await this.handleLeaveRoom(ws, messageData);
        break;
      case "message":
        await this.handleChatMessage(ws, messageData);
        break;
      default:
        // Unknown message type, treat as regular message
        await this.handleChatMessage(ws, messageData);
    }
  }

  private async handleJoinRoom(ws: WebSocket, data: any): Promise<void> {
    const { username, room, userId } = data;

    // Store user session
    this.sessions.set(ws, {
      username,
      room,
      userId,
      joinedAt: Date.now(),
    });

    // Get users in the same room
    const roomUsers = this.getUsersInRoom(room);

    // Notify all users in the room that someone joined
    const joinMessage = {
      type: "user_joined",
      username,
      userId,
      room,
      timestamp: Date.now(),
      users: roomUsers,
    };

    this.broadcastToRoom(room, joinMessage);
  }

  private async handleLeaveRoom(ws: WebSocket, data: any): Promise<void> {
    const session = this.sessions.get(ws);
    if (!session) return;

    const { username, room, userId } = session;

    // Remove user session
    this.sessions.delete(ws);

    // Get remaining users in the room
    const roomUsers = this.getUsersInRoom(room);

    // Notify remaining users in the room
    const leaveMessage = {
      type: "user_left",
      username,
      userId,
      room,
      timestamp: Date.now(),
      users: roomUsers,
    };

    this.broadcastToRoom(room, leaveMessage);
  }

  private async handleChatMessage(ws: WebSocket, data: any): Promise<void> {
    const session = this.sessions.get(ws);
    if (!session) {
      // If no session, reject the message
      ws.send(
        JSON.stringify({
          type: "error",
          message: "You must join a room first",
          timestamp: Date.now(),
        })
      );
      return;
    }

    // Add session info to message
    const messageWithSession = {
      ...data,
      username: session.username,
      userId: session.userId,
      room: session.room,
      timestamp: data.timestamp || Date.now(),
    };

    // Broadcast to room
    this.broadcastToRoom(session.room, messageWithSession);
  }

  private getUsersInRoom(
    room: string
  ): Array<{ username: string; userId: string; joinedAt: number }> {
    const users: Array<{ username: string; userId: string; joinedAt: number }> =
      [];

    this.sessions.forEach((session, ws) => {
      if (session.room === room) {
        users.push({
          username: session.username,
          userId: session.userId,
          joinedAt: session.joinedAt,
        });
      }
    });

    return users;
  }

  private broadcastToRoom(room: string, message: any): void {
    const roomUsers = Array.from(this.sessions.entries()).filter(
      ([ws, session]) => session.room === room
    );

    const messageWithStats = {
      ...message,
      connections: roomUsers.length,
      totalConnections: this.sessions.size,
    };

    const messageString = JSON.stringify(messageWithStats);

    roomUsers.forEach(([socket, session]) => {
      try {
        socket.send(messageString);
      } catch (e) {
        console.error("Failed to send message to socket:", e);
        // Clean up dead connection
        this.sessions.delete(socket);
      }
    });
  }

  async webSocketClose(
    ws: WebSocket,
    code: number,
    reason: string,
    wasClean: boolean
  ): Promise<void> {
    // Handle user leaving when connection closes
    const session = this.sessions.get(ws);
    if (session) {
      await this.handleLeaveRoom(ws, session);
    }

    // If the client closes the connection, the runtime will invoke the webSocketClose() handler.
    ws.close(code, "Durable Object is closing WebSocket");
  }
}

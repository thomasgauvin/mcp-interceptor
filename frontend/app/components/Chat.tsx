import { useState, useEffect, useRef } from "react";

interface User {
  username: string;
  userId: string;
  joinedAt: number;
}

interface Message {
  type: string;
  content?: string;
  timestamp: number;
  connections?: number;
  totalConnections?: number;
  userId?: string;
  username?: string;
  room?: string;
  users?: User[];
}

interface ChatProps {
  username: string;
  room: string;
  userId: string;
  onLeaveRoom: () => void;
}

export function Chat({ username, room, userId, onLeaveRoom }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Create WebSocket connection
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//localhost:8787/ws/${encodeURIComponent(room)}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      console.log("WebSocket connected");

      // Send join message
      ws.send(
        JSON.stringify({
          type: "join",
          username,
          room,
          userId,
          timestamp: Date.now(),
        })
      );
    };

    ws.onmessage = (event) => {
      try {
        const message: Message = JSON.parse(event.data);

        // Handle different message types
        if (message.type === "user_joined" || message.type === "user_left") {
          setUsers(message.users || []);
        }

        setMessages((prev) => [...prev, message]);
      } catch (e) {
        console.error("Failed to parse message:", e);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      console.log("WebSocket disconnected");
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      setIsConnected(false);
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        // Send leave message before closing
        ws.send(
          JSON.stringify({
            type: "leave",
            username,
            room,
            userId,
            timestamp: Date.now(),
          })
        );
      }
      ws.close();
    };
  }, [username, room, userId]);

  const sendMessage = () => {
    if (
      !inputMessage.trim() ||
      !wsRef.current ||
      wsRef.current.readyState !== WebSocket.OPEN
    ) {
      return;
    }

    const message = {
      type: "message",
      content: inputMessage.trim(),
      timestamp: Date.now(),
    };

    wsRef.current.send(JSON.stringify(message));
    setInputMessage("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const renderMessage = (message: Message, index: number) => {
    if (message.type === "user_joined") {
      return (
        <div key={index} className="text-center">
          <div className="inline-block bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-3 py-1 rounded-full text-sm">
            {message.username} joined the room
          </div>
        </div>
      );
    }

    if (message.type === "user_left") {
      return (
        <div key={index} className="text-center">
          <div className="inline-block bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 px-3 py-1 rounded-full text-sm">
            {message.username} left the room
          </div>
        </div>
      );
    }

    if (message.type === "message" && message.content) {
      const isOwnMessage = message.userId === userId;
      return (
        <div
          key={index}
          className={`flex flex-col ${
            isOwnMessage ? "items-end" : "items-start"
          }`}
        >
          <div
            className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
              isOwnMessage
                ? "bg-blue-500 text-white"
                : "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white"
            }`}
          >
            {!isOwnMessage && message.username && (
              <div className="text-xs font-semibold mb-1 opacity-70">
                {message.username}
              </div>
            )}
            <p className="text-sm">{message.content}</p>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {formatTime(message.timestamp)}
            </span>
            {isOwnMessage && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                You
              </span>
            )}
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="flex gap-4 h-full max-w-6xl mx-auto p-4">
      {/* Main Chat Area */}
      <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg flex flex-col h-96">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              #{room}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {users.length} user{users.length !== 1 ? "s" : ""} online
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div
                className={`w-3 h-3 rounded-full ${
                  isConnected ? "bg-green-500" : "bg-red-500"
                }`}
              />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {isConnected ? "Connected" : "Disconnected"}
              </span>
            </div>
            <button
              onClick={onLeaveRoom}
              className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Leave Room
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 ? (
            <div className="text-center text-gray-500 dark:text-gray-400">
              Welcome to #{room}! Start the conversation.
            </div>
          ) : (
            messages.map((message, index) => renderMessage(message, index))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex gap-2">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={`Message #${room}...`}
              disabled={!isConnected}
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                         placeholder-gray-500 dark:placeholder-gray-400
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                         disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              onClick={sendMessage}
              disabled={!inputMessage.trim() || !isConnected}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Send
            </button>
          </div>
        </div>
      </div>

      {/* Users Sidebar */}
      <div className="w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Users Online
        </h3>
        <div className="space-y-2">
          {users.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No users online
            </p>
          ) : (
            users.map((user) => (
              <div
                key={user.userId}
                className={`flex items-center gap-3 p-2 rounded ${
                  user.userId === userId
                    ? "bg-blue-100 dark:bg-blue-900"
                    : "bg-gray-50 dark:bg-gray-700"
                }`}
              >
                <div className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    {user.username.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {user.username}
                    {user.userId === userId && " (You)"}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Joined {formatTime(user.joinedAt)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            <p>Room: #{room}</p>
            <p>Your ID: {userId.slice(-6)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

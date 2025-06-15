import type { Route } from "./+types/room";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Chat } from "../components/Chat";
import { RoomSelector } from "../components/RoomSelector";

export function meta({ params }: Route.MetaArgs) {
  return [
    { title: `Chat Room: ${params.roomName} | Real-time Chat App` },
    {
      name: "description",
      content: `Join the ${params.roomName} chat room powered by WebSockets and Cloudflare Durable Objects!`,
    },
  ];
}

export function loader({ params }: Route.LoaderArgs) {
  return {
    roomName: params.roomName,
    message: `WebSocket chat room: ${params.roomName}`,
  };
}

export default function Room({ params, loaderData }: Route.ComponentProps) {
  const navigate = useNavigate();
  const roomName = params.roomName;

  const [currentUser, setCurrentUser] = useState<{
    username: string;
    userId: string;
  } | null>(null);

  const [showUsernamePrompt, setShowUsernamePrompt] = useState(false);

  useEffect(() => {
    // Check if we have a stored username for this session
    const storedUsername = sessionStorage.getItem("chat-username");
    if (storedUsername) {
      const userId = `user-${Math.random().toString(36).substr(2, 9)}`;
      setCurrentUser({ username: storedUsername, userId });
    } else {
      setShowUsernamePrompt(true);
    }
  }, []);

  const handleJoinRoom = (username: string, room: string) => {
    // Store username in session storage
    sessionStorage.setItem("chat-username", username);

    const userId = `user-${Math.random().toString(36).substr(2, 9)}`;
    setCurrentUser({ username, userId });
    setShowUsernamePrompt(false);

    // If they selected a different room, navigate to it
    if (room !== roomName) {
      navigate(`/room/${encodeURIComponent(room)}`);
    }
  };

  const handleLeaveRoom = () => {
    sessionStorage.removeItem("chat-username");
    setCurrentUser(null);
    navigate("/");
  };

  // Show username prompt if no user is set
  if (showUsernamePrompt || !currentUser) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 w-full max-w-md">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Join #{roomName}
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Enter your username to join this chat room
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const username = formData.get("username") as string;
              if (username?.trim()) {
                handleJoinRoom(username.trim(), roomName);
              }
            }}
            className="space-y-6"
          >
            <div>
              <label
                htmlFor="username"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Username
              </label>
              <input
                type="text"
                id="username"
                name="username"
                placeholder="Enter your username..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                           placeholder-gray-500 dark:placeholder-gray-400
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
                autoFocus
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => navigate("/")}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 
                           focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              >
                Back to Home
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Join #{roomName}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            #{roomName}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Welcome, {currentUser.username}! Share this URL to invite others to
            join.
          </p>
          <div className="mt-2">
            <code className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-sm text-gray-700 dark:text-gray-300">
              {window.location.href}
            </code>
          </div>
        </div>

        <Chat
          username={currentUser.username}
          room={roomName}
          userId={currentUser.userId}
          onLeaveRoom={handleLeaveRoom}
        />
      </div>
    </div>
  );
}

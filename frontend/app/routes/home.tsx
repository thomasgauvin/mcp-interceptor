import type { Route } from "./+types/home";
import { useNavigate } from "react-router";
import { RoomSelector } from "../components/RoomSelector";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Real-time Chat App" },
    {
      name: "description",
      content:
        "Real-time chat powered by WebSockets and Cloudflare Durable Objects!",
    },
  ];
}

export function loader({ context }: Route.LoaderArgs) {
  return { message: "WebSocket chat powered by Cloudflare Durable Objects" };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const navigate = useNavigate();

  const handleJoinRoom = (username: string, room: string) => {
    // Store username in session storage for the room
    sessionStorage.setItem("chat-username", username);

    // Navigate to the room URL
    navigate(`/room/${encodeURIComponent(room)}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Real-time Chat App
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-2">
            Create or join chat rooms with shareable URLs
          </p>
          <p className="text-gray-500 dark:text-gray-500">
            Powered by WebSockets and Cloudflare Durable Objects, built with
            Hono.js and React Router
          </p>
        </div>

        <div className="max-w-md mx-auto mb-12">
          <RoomSelector onJoinRoom={handleJoinRoom} />
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              How it works
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-xl">1️⃣</span>
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                  Create a Room
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Enter your username and a room name to create a new chat room
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-xl">2️⃣</span>
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                  Share the URL
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Copy and share the room URL with friends to invite them
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-xl">3️⃣</span>
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                  Chat in Real-time
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Send messages instantly and see who's online in the room
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

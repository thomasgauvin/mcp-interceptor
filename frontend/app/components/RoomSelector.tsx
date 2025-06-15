import { useState } from "react";

interface RoomSelectorProps {
  onJoinRoom: (username: string, room: string) => void;
}

export function RoomSelector({ onJoinRoom }: RoomSelectorProps) {
  const [username, setUsername] = useState("");
  const [room, setRoom] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !room.trim()) return;

    onJoinRoom(username.trim(), room.trim().toLowerCase());
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          Join or Create a Room
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Enter your details to start chatting
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Username Input */}
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
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your username..."
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                       placeholder-gray-500 dark:placeholder-gray-400
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>

        {/* Room Selection */}
        <div>
          <label
            htmlFor="room"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            Room Name
          </label>
          <input
            type="text"
            id="room"
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            placeholder="Enter room name (e.g., general, tech, gaming)..."
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                       placeholder-gray-500 dark:placeholder-gray-400
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Room names are case-insensitive and will create a shareable URL
          </p>
        </div>

        {/* Join Button */}
        <button
          type="submit"
          disabled={!username.trim() || !room.trim()}
          className="w-full px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Join Room
        </button>
      </form>
    </div>
  );
}

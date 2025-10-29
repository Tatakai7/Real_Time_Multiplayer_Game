import { useState } from 'react';
import { usePlayer } from './hooks/usePlayer';
import { Login } from './components/Login';
import { Lobby } from './components/Lobby';
import { GameRoom } from './components/GameRoom';

function App() {
  const { player, loading, createPlayer, logout } = usePlayer();
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);

  const handleLogin = async (username: string) => {
    await createPlayer(username);
  };

  const handleJoinRoom = (roomId: string) => {
    setCurrentRoomId(roomId);
  };

  const handleLeaveRoom = () => {
    setCurrentRoomId(null);
  };

  const handleLogout = () => {
    logout();
    setCurrentRoomId(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (!player) {
    return <Login onLogin={handleLogin} />;
  }

  if (currentRoomId) {
    return (
      <GameRoom
        roomId={currentRoomId}
        player={player}
        onLeaveRoom={handleLeaveRoom}
      />
    );
  }

  return (
    <Lobby
      player={player}
      onJoinRoom={handleJoinRoom}
      onLogout={handleLogout}
    />
  );
}

export default App;

import { useState, useEffect } from 'react';
import { supabase, GameRoom, Player } from '../lib/supabase';
import { Plus, Users, Play, Trophy, LogOut, RefreshCw } from 'lucide-react';

interface LobbyProps {
  player: Player;
  onJoinRoom: (roomId: string) => void;
  onLogout: () => void;
}

export function Lobby({ player, onJoinRoom, onLogout }: LobbyProps) {
  const [rooms, setRooms] = useState<GameRoom[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [gameType, setGameType] = useState('collector');
  const [loading, setLoading] = useState(false);
  const [leaderboard, setLeaderboard] = useState<Player[]>([]);

  useEffect(() => {
    loadRooms();
    loadLeaderboard();

    const roomsSubscription = supabase
      .channel('game_rooms_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_rooms' }, () => {
        loadRooms();
      })
      .subscribe();

    return () => {
      roomsSubscription.unsubscribe();
    };
  }, []);

  const loadRooms = async () => {
    const { data, error } = await supabase
      .from('game_rooms')
      .select('*')
      .eq('status', 'waiting')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setRooms(data);
    }
  };

  const loadLeaderboard = async () => {
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .order('total_score', { ascending: false })
      .limit(5);

    if (!error && data) {
      setLeaderboard(data);
    }
  };

  const createRoom = async () => {
    if (roomName.trim().length < 3) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('game_rooms')
        .insert([
          {
            name: roomName.trim(),
            host_player_id: player.id,
            game_type: gameType,
            current_players: 0,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      setShowCreateModal(false);
      setRoomName('');
      onJoinRoom(data.id);
    } catch (error) {
      console.error('Error creating room:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.1),transparent_50%)]"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(16,185,129,0.1),transparent_50%)]"></div>

      <div className="relative max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Game Lobby</h1>
            <p className="text-slate-400">Welcome back, {player.username}!</p>
          </div>
          <button
            onClick={onLogout}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 rounded-lg transition border border-slate-700/50"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl border border-slate-700/50 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <Users className="w-6 h-6 text-blue-400" />
                  Active Rooms
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={loadRooms}
                    className="p-2 bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 rounded-lg transition"
                    aria-label="Refresh Rooms"
                  >
                    <RefreshCw className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-lg transition font-medium"
                  >
                    <Plus className="w-5 h-5" />
                    Create Room
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {rooms.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                    <p className="text-slate-400">No active rooms. Create one to get started!</p>
                  </div>
                ) : (
                  rooms.map((room) => (
                    <div
                      key={room.id}
                      className="bg-slate-900/50 rounded-lg p-4 border border-slate-700/50 hover:border-blue-500/50 transition"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-white mb-1">{room.name}</h3>
                          <div className="flex items-center gap-4 text-sm text-slate-400">
                            <span className="flex items-center gap-1">
                              <Users className="w-4 h-4" />
                              {room.current_players}/{room.max_players}
                            </span>
                            <span className="capitalize bg-slate-800 px-2 py-1 rounded">
                              {room.game_type}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => onJoinRoom(room.id)}
                          disabled={room.current_players >= room.max_players}
                          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-lg transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Play className="w-4 h-4" />
                          Join
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl border border-slate-700/50 p-6">
              <h3 className="text-xl font-bold text-white mb-4">Game Modes</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30 rounded-lg p-4">
                  <h4 className="text-white font-semibold mb-1">Collector</h4>
                  <p className="text-sm text-slate-300">Gather items and score points!</p>
                </div>
                <div className="bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 rounded-lg p-4">
                  <h4 className="text-white font-semibold mb-1">Racer</h4>
                  <p className="text-sm text-slate-300">Race to the finish line!</p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl border border-slate-700/50 p-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-4">
                <Trophy className="w-6 h-6 text-yellow-400" />
                Leaderboard
              </h2>
              <div className="space-y-3">
                {leaderboard.map((p, index) => (
                  <div
                    key={p.id}
                    className={`flex items-center gap-3 p-3 rounded-lg ${
                      p.id === player.id ? 'bg-blue-500/20 border border-blue-500/30' : 'bg-slate-900/50'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                        index === 0
                          ? 'bg-yellow-500 text-slate-900'
                          : index === 1
                          ? 'bg-slate-400 text-slate-900'
                          : index === 2
                          ? 'bg-amber-700 text-white'
                          : 'bg-slate-700 text-slate-300'
                      }`}
                    >
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-medium truncate">{p.username}</div>
                      <div className="text-xs text-slate-400">
                        {p.wins} wins · {p.games_played} games
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-blue-400">{p.total_score}</div>
                      <div className="text-xs text-slate-500">points</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl border border-slate-700/50 p-6">
              <h3 className="text-lg font-bold text-white mb-3">Your Stats</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Score</span>
                  <span className="text-white font-bold">{player.total_score}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Games Played</span>
                  <span className="text-white font-bold">{player.games_played}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Wins</span>
                  <span className="text-white font-bold">{player.wins}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold text-white mb-4">Create New Room</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Room Name</label>
                <input
                  type="text"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="Enter room name..."
                  className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  maxLength={30}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Game Type</label>
                <select
                  value={gameType}
                  onChange={(e) => setGameType(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="Select Game Type"
                >
                  <option value="collector">Collector</option>
                  <option value="racer">Racer</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  onClick={createRoom}
                  disabled={loading || roomName.trim().length < 3}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-lg transition font-medium disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

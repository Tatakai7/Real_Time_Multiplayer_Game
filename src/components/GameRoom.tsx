import { useState, useEffect, useRef } from 'react';
import { supabase, RoomPlayer, Player, ChatMessage } from '../lib/supabase';
import type { GameRoom } from '../lib/supabase';
import { ArrowLeft, Send, Users, Trophy } from 'lucide-react';
import { GameCanvas } from './GameCanvas';

interface GameRoomProps {
  roomId: string;
  player: Player;
  onLeaveRoom: () => void;
}

export function GameRoom({ roomId, player, onLeaveRoom }: GameRoomProps) {
  const [room, setRoom] = useState<GameRoom | null>(null);
  const [roomPlayers, setRoomPlayers] = useState<RoomPlayer[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [isReady, setIsReady] = useState(false);
  const [myRoomPlayer, setMyRoomPlayer] = useState<RoomPlayer | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadRoom();
    joinRoom();
    loadMessages();

    const roomChannel = supabase
      .channel(`room:${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_rooms', filter: `id=eq.${roomId}` }, (payload) => {
        if (payload.eventType === 'UPDATE') {
          setRoom(payload.new as GameRoom);
        } else if (payload.eventType === 'DELETE') {
          onLeaveRoom();
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_players', filter: `room_id=eq.${roomId}` }, () => {
        loadRoomPlayers();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${roomId}` }, (payload) => {
        loadPlayerForMessage(payload.new as ChatMessage);
      })
      .subscribe();

    return () => {
      leaveRoom();
      roomChannel.unsubscribe();
    };
  }, [roomId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const loadRoom = async () => {
    const { data, error } = await supabase
      .from('game_rooms')
      .select('*')
      .eq('id', roomId)
      .maybeSingle();

    if (!error && data) {
      setRoom(data);
    }
  };

  const loadRoomPlayers = async () => {
    const { data, error } = await supabase
      .from('room_players')
      .select('*, players(*)')
      .eq('room_id', roomId);

    if (!error && data) {
      setRoomPlayers(data);
      const me = data.find(rp => rp.player_id === player.id);
      if (me) {
        setMyRoomPlayer(me);
        setIsReady(me.is_ready);
      }
    }
  };

  const loadMessages = async () => {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*, players(*)')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })
      .limit(50);

    if (!error && data) {
      setChatMessages(data);
    }
  };

  const loadPlayerForMessage = async (message: ChatMessage) => {
    const { data: playerData } = await supabase
      .from('players')
      .select('*')
      .eq('id', message.player_id)
      .single();

    if (playerData) {
      setChatMessages(prev => [...prev, { ...message, players: playerData }]);
    }
  };

  const joinRoom = async () => {
    const { data: existing } = await supabase
      .from('room_players')
      .select('*')
      .eq('room_id', roomId)
      .eq('player_id', player.id)
      .maybeSingle();

    if (existing) {
      setMyRoomPlayer(existing);
      setIsReady(existing.is_ready);
      return;
    }

    const { data, error } = await supabase
      .from('room_players')
      .insert([{ room_id: roomId, player_id: player.id }])
      .select()
      .single();

    if (!error && data) {
      setMyRoomPlayer(data);
      await updateRoomPlayerCount();
      loadRoomPlayers();
    }
  };

  const leaveRoom = async () => {
    if (myRoomPlayer) {
      await supabase
        .from('room_players')
        .delete()
        .eq('id', myRoomPlayer.id);

      await updateRoomPlayerCount();

      if (room?.host_player_id === player.id) {
        await supabase
          .from('game_rooms')
          .delete()
          .eq('id', roomId);
      }
    }
  };

  const updateRoomPlayerCount = async () => {
    const { count } = await supabase
      .from('room_players')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', roomId);

    await supabase
      .from('game_rooms')
      .update({ current_players: count || 0 })
      .eq('id', roomId);
  };

  const toggleReady = async () => {
    if (!myRoomPlayer) return;

    const newReadyState = !isReady;
    await supabase
      .from('room_players')
      .update({ is_ready: newReadyState })
      .eq('id', myRoomPlayer.id);

    setIsReady(newReadyState);
  };

  const startGame = async () => {
    if (room?.host_player_id !== player.id) return;

    const allReady = roomPlayers.every(rp => rp.is_ready || rp.player_id === player.id);
    if (!allReady || roomPlayers.length < 2) return;

    await supabase
      .from('game_rooms')
      .update({ status: 'playing', started_at: new Date().toISOString() })
      .eq('id', roomId);
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (messageInput.trim() === '') return;

    await supabase
      .from('chat_messages')
      .insert([{ room_id: roomId, player_id: player.id, message: messageInput.trim() }]);

    setMessageInput('');
  };

  const updatePlayerPosition = async (x: number, y: number) => {
    if (!myRoomPlayer) return;

    await supabase
      .from('room_players')
      .update({ position_x: x, position_y: y })
      .eq('id', myRoomPlayer.id);
  };

  const updatePlayerScore = async (score: number) => {
    if (!myRoomPlayer) return;

    await supabase
      .from('room_players')
      .update({ score })
      .eq('id', myRoomPlayer.id);
  };

  if (!room) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white">Loading room...</div>
      </div>
    );
  }

  const isHost = room.host_player_id === player.id;
  const canStart = isHost && roomPlayers.length >= 2 && roomPlayers.every(rp => rp.is_ready || rp.player_id === player.id);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.1),transparent_50%)]"></div>

      <div className="relative">
        <div className="border-b border-slate-700/50 bg-slate-800/50 backdrop-blur-xl">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={onLeaveRoom}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700/50 hover:bg-slate-600/50 text-white rounded-lg transition"
              >
                <ArrowLeft className="w-4 h-4" />
                Leave
              </button>
              <div>
                <h1 className="text-2xl font-bold text-white">{room.name}</h1>
                <p className="text-sm text-slate-400 capitalize">
                  {room.game_type} · {room.status}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {room.status === 'waiting' && (
                <>
                  <button
                    onClick={toggleReady}
                    className={`px-6 py-2 rounded-lg font-medium transition ${
                      isReady
                        ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                        : 'bg-slate-700 hover:bg-slate-600 text-white'
                    }`}
                  >
                    {isReady ? 'Ready!' : 'Not Ready'}
                  </button>
                  {isHost && (
                    <button
                      onClick={startGame}
                      disabled={!canStart}
                      className="px-6 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Start Game
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto p-4">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-3">
              {room.status === 'playing' ? (
                <GameCanvas
                  roomId={roomId}
                  player={player}
                  roomPlayers={roomPlayers}
                  gameType={room.game_type}
                  onPositionUpdate={updatePlayerPosition}
                  onScoreUpdate={updatePlayerScore}
                />
              ) : (
                <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl border border-slate-700/50 p-8 h-[600px] flex items-center justify-center">
                  <div className="text-center">
                    <Users className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                    <h3 className="text-2xl font-bold text-white mb-2">Waiting for players...</h3>
                    <p className="text-slate-400 mb-6">
                      {roomPlayers.filter(rp => rp.is_ready).length}/{roomPlayers.length} players ready
                    </p>
                    <div className="inline-flex flex-col gap-2">
                      {roomPlayers.map((rp) => (
                        <div
                          key={rp.id}
                          className="flex items-center gap-3 bg-slate-900/50 px-4 py-2 rounded-lg"
                        >
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: rp.players?.avatar_color || '#3B82F6' }}
                          />
                          <span className="text-white">{rp.players?.username}</span>
                          {rp.is_ready && (
                            <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded">
                              Ready
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-4">
              <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl border border-slate-700/50 p-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-3">
                  <Users className="w-5 h-5 text-blue-400" />
                  Players ({roomPlayers.length})
                </h3>
                <div className="space-y-2">
                  {roomPlayers.map((rp) => (
                    <div key={rp.id} className="flex items-center justify-between bg-slate-900/50 p-2 rounded-lg">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
                          style={{ backgroundColor: rp.players?.avatar_color || '#3B82F6' }}
                        >
                          {rp.players?.username.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-white text-sm">{rp.players?.username}</span>
                      </div>
                      {room.status === 'playing' && (
                        <div className="flex items-center gap-1 text-yellow-400">
                          <Trophy className="w-4 h-4" />
                          <span className="text-sm font-bold">{rp.score}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl border border-slate-700/50 p-4 flex flex-col h-[400px]">
                <h3 className="text-lg font-bold text-white mb-3">Chat</h3>
                <div className="flex-1 overflow-y-auto space-y-2 mb-3">
                  {chatMessages.map((msg) => (
                    <div key={msg.id} className="bg-slate-900/50 p-2 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: msg.players?.avatar_color || '#3B82F6' }}
                        />
                        <span className="text-xs font-medium text-slate-300">
                          {msg.players?.username}
                        </span>
                      </div>
                      <p className="text-sm text-white">{msg.message}</p>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
                <form onSubmit={sendMessage} className="flex gap-2">
                  <input
                    type="text"
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    maxLength={200}
                  />
                  <button
                    type="submit"
                    className="p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition"
                    aria-label="Submit message"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

export type Player = {
  id: string;
  username: string;
  avatar_color: string;
  total_score: number;
  games_played: number;
  wins: number;
  created_at: string;
  last_seen: string;
};

export type GameRoom = {
  id: string;
  name: string;
  host_player_id: string;
  max_players: number;
  current_players: number;
  game_type: string;
  status: string;
  started_at?: string;
  created_at: string;
};

export type RoomPlayer = {
  id: string;
  room_id: string;
  player_id: string;
  position_x: number;
  position_y: number;
  score: number;
  is_ready: boolean;
  joined_at: string;
  players?: Player;
};

export type ChatMessage = {
  id: string;
  room_id: string;
  player_id: string;
  message: string;
  created_at: string;
  players?: Player;
};

export type GameScore = {
  id: string;
  room_id: string;
  player_id: string;
  score: number;
  rank: number;
  game_type: string;
  created_at: string;
  players?: Player;
};

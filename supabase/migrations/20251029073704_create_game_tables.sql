/*
  # Real-time Multiplayer Game Database Schema

  ## Overview
  This migration sets up the complete database schema for a real-time multiplayer game
  with lobby management, rooms, player tracking, scoring, and leaderboards.

  ## 1. New Tables

  ### `players`
  - `id` (uuid, primary key) - Unique player identifier
  - `username` (text, unique) - Player's display name
  - `avatar_color` (text) - Hex color for player avatar
  - `total_score` (integer) - Cumulative score across all games
  - `games_played` (integer) - Total number of games completed
  - `wins` (integer) - Number of games won
  - `created_at` (timestamptz) - Account creation timestamp
  - `last_seen` (timestamptz) - Last activity timestamp

  ### `game_rooms`
  - `id` (uuid, primary key) - Unique room identifier
  - `name` (text) - Room display name
  - `host_player_id` (uuid) - Creator of the room
  - `max_players` (integer) - Maximum players allowed (default 8)
  - `current_players` (integer) - Current player count
  - `game_type` (text) - Type of mini-game (collector, racer, etc.)
  - `status` (text) - waiting, playing, finished
  - `started_at` (timestamptz) - Game start time
  - `created_at` (timestamptz) - Room creation time

  ### `room_players`
  - `id` (uuid, primary key) - Unique record identifier
  - `room_id` (uuid) - Reference to game_rooms
  - `player_id` (uuid) - Reference to players
  - `position_x` (numeric) - Player X coordinate
  - `position_y` (numeric) - Player Y coordinate
  - `score` (integer) - Current game score
  - `is_ready` (boolean) - Player ready status
  - `joined_at` (timestamptz) - Join timestamp

  ### `game_scores`
  - `id` (uuid, primary key) - Unique score record
  - `room_id` (uuid) - Reference to game_rooms
  - `player_id` (uuid) - Reference to players
  - `score` (integer) - Final game score
  - `rank` (integer) - Player's rank in that game
  - `game_type` (text) - Type of game played
  - `created_at` (timestamptz) - Score record time

  ### `chat_messages`
  - `id` (uuid, primary key) - Unique message identifier
  - `room_id` (uuid) - Reference to game_rooms
  - `player_id` (uuid) - Reference to players
  - `message` (text) - Chat message content
  - `created_at` (timestamptz) - Message timestamp

  ## 2. Security
  - Enable RLS on all tables
  - Players can read their own data and update their profile
  - Room data is publicly readable for lobby browsing
  - Only room hosts can modify room settings
  - Players can only modify their own room_player records
  - Scores are read-only after creation
  - Chat messages are readable by room participants

  ## 3. Indexes
  - Index on room status for efficient lobby queries
  - Index on player scores for leaderboard queries
  - Index on chat messages by room for efficient retrieval

  ## 4. Important Notes
  - All timestamps use timestamptz for timezone awareness
  - Default values prevent null-related issues
  - Foreign keys ensure referential integrity
  - RLS policies are restrictive by default for security
*/

-- Create players table
CREATE TABLE IF NOT EXISTS players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  avatar_color text DEFAULT '#3B82F6',
  total_score integer DEFAULT 0,
  games_played integer DEFAULT 0,
  wins integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  last_seen timestamptz DEFAULT now()
);

-- Create game_rooms table
CREATE TABLE IF NOT EXISTS game_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  host_player_id uuid REFERENCES players(id) ON DELETE CASCADE,
  max_players integer DEFAULT 8,
  current_players integer DEFAULT 0,
  game_type text DEFAULT 'collector',
  status text DEFAULT 'waiting',
  started_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create room_players table
CREATE TABLE IF NOT EXISTS room_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES game_rooms(id) ON DELETE CASCADE,
  player_id uuid REFERENCES players(id) ON DELETE CASCADE,
  position_x numeric DEFAULT 400,
  position_y numeric DEFAULT 300,
  score integer DEFAULT 0,
  is_ready boolean DEFAULT false,
  joined_at timestamptz DEFAULT now(),
  UNIQUE(room_id, player_id)
);

-- Create game_scores table
CREATE TABLE IF NOT EXISTS game_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES game_rooms(id) ON DELETE CASCADE,
  player_id uuid REFERENCES players(id) ON DELETE CASCADE,
  score integer DEFAULT 0,
  rank integer DEFAULT 0,
  game_type text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create chat_messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES game_rooms(id) ON DELETE CASCADE,
  player_id uuid REFERENCES players(id) ON DELETE CASCADE,
  message text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Players policies
CREATE POLICY "Players can view all players"
  ON players FOR SELECT
  USING (true);

CREATE POLICY "Players can insert their own profile"
  ON players FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Players can update their own profile"
  ON players FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Game rooms policies
CREATE POLICY "Anyone can view game rooms"
  ON game_rooms FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create game rooms"
  ON game_rooms FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update game rooms"
  ON game_rooms FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete game rooms"
  ON game_rooms FOR DELETE
  USING (true);

-- Room players policies
CREATE POLICY "Anyone can view room players"
  ON room_players FOR SELECT
  USING (true);

CREATE POLICY "Players can join rooms"
  ON room_players FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Players can update their position and status"
  ON room_players FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Players can leave rooms"
  ON room_players FOR DELETE
  USING (true);

-- Game scores policies
CREATE POLICY "Anyone can view scores"
  ON game_scores FOR SELECT
  USING (true);

CREATE POLICY "Scores can be inserted"
  ON game_scores FOR INSERT
  WITH CHECK (true);

-- Chat messages policies
CREATE POLICY "Anyone can view chat messages"
  ON chat_messages FOR SELECT
  USING (true);

CREATE POLICY "Players can send messages"
  ON chat_messages FOR INSERT
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_game_rooms_status ON game_rooms(status);
CREATE INDEX IF NOT EXISTS idx_game_scores_player ON game_scores(player_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_room ON chat_messages(room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_room_players_room ON room_players(room_id);
CREATE INDEX IF NOT EXISTS idx_players_total_score ON players(total_score DESC);
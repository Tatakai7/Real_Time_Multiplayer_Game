import { useState, useEffect } from 'react';
import { supabase, Player } from '../lib/supabase';

export function usePlayer() {
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedPlayerId = localStorage.getItem('playerId');

    if (storedPlayerId) {
      loadPlayer(storedPlayerId);
    } else {
      setLoading(false);
    }
  }, []);

  const loadPlayer = async (playerId: string) => {
    try {
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('id', playerId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setPlayer(data);
        await supabase
          .from('players')
          .update({ last_seen: new Date().toISOString() })
          .eq('id', playerId);
      } else {
        localStorage.removeItem('playerId');
      }
    } catch (error) {
      console.error('Error loading player:', error);
      localStorage.removeItem('playerId');
    } finally {
      setLoading(false);
    }
  };

  const createPlayer = async (username: string) => {
    try {
      const colors = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'];
      const avatarColor = colors[Math.floor(Math.random() * colors.length)];

      const { data, error } = await supabase
        .from('players')
        .insert([{ username, avatar_color: avatarColor }])
        .select()
        .single();

      if (error) throw error;

      setPlayer(data);
      localStorage.setItem('playerId', data.id);
      return data;
    } catch (error) {
      console.error('Error creating player:', error);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('playerId');
    setPlayer(null);
  };

  return { player, loading, createPlayer, logout };
}

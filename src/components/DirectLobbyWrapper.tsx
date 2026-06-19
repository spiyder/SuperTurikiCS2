// src/components/DirectLobbyWrapper.tsx
// Обёртка для прямых ссылок на лобби (?lobby=ID).
// Определяет команду игрока (team1/team2) по составу его команды
// и совпадению с названиями команд в матче, затем рендерит MatchLobbyPage.

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { MatchLobbyPage } from '../pages/MatchLobbyPage';
import type { User as SupabaseUser } from '@supabase/supabase-js';

interface Props {
  matchId: string;
  user: SupabaseUser | null;
  onBack: () => void;
}

export function DirectLobbyWrapper({ matchId, user, onBack }: Props) {
  const [userTeam, setUserTeam] = useState<'team1' | 'team2' | null>(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => { resolve(); }, [matchId, user]);

  const resolve = async () => {
    setLoading(true);
    if (!user) { setLoading(false); return; }

    // 1. Найти матч чтобы знать названия команд
    const { data: match } = await supabase
      .from('lobby_matches')
      .select('team1_name, team2_name')
      .eq('id', matchId)
      .single();

    if (!match) { setLoading(false); return; }

    // 2. Найти команду текущего пользователя
    const { data: membership } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (membership) {
      const { data: myTeam } = await supabase
        .from('teams')
        .select('name')
        .eq('id', membership.team_id)
        .maybeSingle();

      if (myTeam) {
        if (myTeam.name === match.team1_name) setUserTeam('team1');
        else if (myTeam.name === match.team2_name) setUserTeam('team2');
      }
    }

    setLoading(false);
  };

  if (loading) return (
    <div className="min-h-screen bg-dark-300 flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
    </div>
  );

  return (
    <MatchLobbyPage
      matchId={matchId}
      user={user}
      userTeam={userTeam}
      onBack={onBack}
    />
  );
}

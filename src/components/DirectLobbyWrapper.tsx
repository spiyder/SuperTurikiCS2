// src/components/DirectLobbyWrapper.tsx
// Простая обёртка для прямых ссылок на лобби (?lobby=ID).
// MatchLobbyPage сам определяет команду игрока из таблицы lobby_ready
// после того как он выбирает сторону кнопками "Войти за команду 1/2".

import { MatchLobbyPage } from '../pages/MatchLobbyPage';
import type { User as SupabaseUser } from '@supabase/supabase-js';

interface Props {
  matchId: string;
  user: SupabaseUser | null;
  onBack: () => void;
}

export function DirectLobbyWrapper({ matchId, user, onBack }: Props) {
  return <MatchLobbyPage matchId={matchId} user={user} onBack={onBack} />;
}

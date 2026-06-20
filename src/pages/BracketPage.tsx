// src/pages/BracketPage.tsx
// Отдельная страница турнирной сетки Single Elimination.
// Клик на матч → открывается MatchLobbyPage.
// Данные берутся из таблицы tournament_matches + lobby_matches.

import { useState, useEffect } from 'react';
import {
  ArrowLeft, GitBranch, Swords, Trophy, Clock, Shield,
  ChevronRight, Play, Users, RefreshCw, Plus,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { MatchLobbyPage } from './MatchLobbyPage';
import type { User as SupabaseUser } from '@supabase/supabase-js';

// ─── Types ───────────────────────────────────────────────────

interface Tournament {
  id: number;
  name: string;
  slots_total: number;
  status: string;
}

interface BracketMatch {
  id: number;
  tournament_id: number;
  round: number;           // 1=финал, 2=полуфинал, 4=четвертьфинал…
  match_index: number;     // позиция в раунде (0-based)
  team1_name: string | null;
  team2_name: string | null;
  team1_score: number;
  team2_score: number;
  winner_name: string | null;
  status: 'pending' | 'live' | 'finished';
  scheduled_at: string | null;
  lobby_match_id: string | null;  // UUID лобби-матча
}

interface LobbyMatch {
  id: string;
  team1_name: string;
  team2_name: string;
  phase: string;
}

interface Props {
  tournament: Tournament;
  user: SupabaseUser | null;
  userTeam: 'team1' | 'team2' | null;
  isAdmin: boolean;
  onBack: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────

function nextPow2(n: number) {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

function getRoundName(round: number): string {
  if (round === 1)  return 'Финал';
  if (round === 2)  return 'Полуфинал';
  if (round === 4)  return 'Четвертьфинал';
  if (round === 8)  return '1/8 финала';
  if (round === 16) return '1/16 финала';
  if (round === 32) return '1/32 финала';
  return `Раунд`;
}

const PHASE_COLOR: Record<string, string> = {
  scheduled:  'bg-gray-500/20 text-gray-400',
  open:       'bg-blue-500/20 text-blue-400',
  readycheck: 'bg-yellow-500/20 text-yellow-400',
  veto:       'bg-purple-500/20 text-purple-400',
  playing:    'bg-green-500/20 text-green-400',
  finished:   'bg-dark-50/50 text-gray-500',
};

const PHASE_LABEL: Record<string, string> = {
  scheduled: 'Ожидает', open: 'Лобби', readycheck: 'Готовность',
  veto: 'Вето', playing: 'Live', finished: 'Завершён',
};

// ─── Match Card ───────────────────────────────────────────────

function MatchCard({
  match, lobby, isAdmin, onOpenLobby, onCreateLobby,
}: {
  match: BracketMatch;
  lobby: LobbyMatch | null;
  isAdmin: boolean;
  onOpenLobby: (lobbyId: string, t1: string, t2: string) => void;
  onCreateLobby: (match: BracketMatch) => void;
}) {
  const t1wins = match.winner_name === match.team1_name && match.winner_name;
  const t2wins = match.winner_name === match.team2_name && match.winner_name;
  const isLive = match.status === 'live' || lobby?.phase === 'playing';
  const isFinished = match.status === 'finished';
  const hasBoth = match.team1_name && match.team2_name;

  return (
    <div className={`rounded-xl border overflow-hidden transition-all ${
      isLive     ? 'border-green-500/50 shadow-lg shadow-green-500/10' :
      isFinished ? 'border-dark-50/40' :
      lobby      ? 'border-primary-500/30' : 'border-dark-50'
    } bg-dark-200`}>

      {/* Live badge */}
      {isLive && (
        <div className="bg-green-500/20 px-3 py-1 flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-green-400 text-xs font-medium">LIVE</span>
        </div>
      )}

      {/* Lobby phase badge */}
      {lobby && !isLive && !isFinished && (
        <div className={`px-3 py-1 text-xs font-medium ${PHASE_COLOR[lobby.phase] ?? 'bg-dark-50/50 text-gray-500'}`}>
          {PHASE_LABEL[lobby.phase] ?? lobby.phase}
        </div>
      )}

      <div className="p-3 space-y-1">
        {/* Team 1 */}
        <div className={`flex items-center justify-between gap-2 py-1.5 px-2 rounded-lg transition-all ${
          t1wins ? 'bg-primary-500/10' : isFinished && !t1wins ? 'opacity-40' : ''
        }`}>
          <span className={`text-sm font-medium truncate flex-1 ${
            t1wins ? 'text-white' : match.team1_name ? 'text-gray-300' : 'text-gray-600 italic'
          }`}>
            {match.team1_name ?? 'TBD'}
          </span>
          {(isFinished || isLive) && (
            <span className={`text-sm font-bold w-5 text-center ${t1wins ? 'text-primary-400' : 'text-gray-500'}`}>
              {match.team1_score}
            </span>
          )}
        </div>

        <div className="border-t border-dark-50/40 mx-2" />

        {/* Team 2 */}
        <div className={`flex items-center justify-between gap-2 py-1.5 px-2 rounded-lg transition-all ${
          t2wins ? 'bg-primary-500/10' : isFinished && !t2wins ? 'opacity-40' : ''
        }`}>
          <span className={`text-sm font-medium truncate flex-1 ${
            t2wins ? 'text-white' : match.team2_name ? 'text-gray-300' : 'text-gray-600 italic'
          }`}>
            {match.team2_name ?? 'TBD'}
          </span>
          {(isFinished || isLive) && (
            <span className={`text-sm font-bold w-5 text-center ${t2wins ? 'text-primary-400' : 'text-gray-500'}`}>
              {match.team2_score}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      {hasBoth && !isFinished && (
        <div className="px-3 pb-3">
          {lobby ? (
            <button
              onClick={() => onOpenLobby(lobby.id, match.team1_name!, match.team2_name!)}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-primary-500/20 hover:bg-primary-500/30 text-primary-400 text-xs font-medium transition-colors"
            >
              <Swords className="w-3 h-3" /> Войти в лобби
            </button>
          ) : isAdmin ? (
            <button
              onClick={() => onCreateLobby(match)}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-dark-100 hover:bg-dark-50/50 border border-dark-50 text-gray-400 hover:text-white text-xs transition-colors"
            >
              <Plus className="w-3 h-3" /> Создать лобби
            </button>
          ) : (
            <div className="text-center text-gray-600 text-xs py-1">Лобби не создано</div>
          )}
        </div>
      )}

      {/* Scheduled time */}
      {match.scheduled_at && !isFinished && (
        <div className="px-3 pb-2 flex items-center gap-1 text-gray-600 text-xs">
          <Clock className="w-3 h-3" />
          {new Date(match.scheduled_at).toLocaleString('ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────

export function BracketPage({ tournament, user, userTeam, isAdmin, onBack }: Props) {
  const [matches, setMatches]   = useState<BracketMatch[]>([]);
  const [lobbies, setLobbies]   = useState<LobbyMatch[]>([]);
  const [loading, setLoading]   = useState(true);
  const [activeLobby, setActiveLobby] = useState<{ id: string; t1: string; t2: string } | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => { load(); }, [tournament.id]);

  const load = async () => {
    setLoading(true);
    const [mRes, lRes] = await Promise.all([
      supabase.from('tournament_matches')
        .select('*')
        .eq('tournament_id', tournament.id)
        .order('round', { ascending: false })
        .order('match_index'),
      supabase.from('lobby_matches')
        .select('id, team1_name, team2_name, phase')
        .eq('tournament_id', tournament.id),
    ]);
    if (mRes.data) setMatches(mRes.data);
    if (lRes.data) setLobbies(lRes.data);
    setLoading(false);
  };

  // Генерация сетки из зарегистрированных команд (только для админа)
  const generateBracket = async () => {
    const { data: regs } = await supabase
      .from('tournament_registrations')
      .select('team_name')
      .eq('tournament_id', tournament.id);

    if (!regs || regs.length < 2) { alert('Нужно минимум 2 команды'); return; }

    const size = nextPow2(regs.length);
    const shuffled = [...regs.map(r => r.team_name)].sort(() => Math.random() - .5);
    while (shuffled.length < size) shuffled.push('');

    // Удаляем старую сетку
    await supabase.from('tournament_matches').delete().eq('tournament_id', tournament.id);

    // Создаём матчи первого раунда
    const firstRound = size;
    const insertData = [];
    for (let i = 0; i < size; i += 2) {
      const t1 = shuffled[i] || null;
      const t2 = shuffled[i + 1] || null;
      const winner = t1 && !t2 ? t1 : !t1 && t2 ? t2 : null;
      insertData.push({
        tournament_id: tournament.id,
        round: firstRound,
        match_index: i / 2,
        team1_name: t1,
        team2_name: t2,
        team1_score: 0,
        team2_score: 0,
        winner_name: winner,
        status: winner ? 'finished' : 'pending',
        lobby_match_id: null,
      });
    }

    // Создаём пустые матчи для следующих раундов
    let round = firstRound / 2;
    while (round >= 1) {
      const count = round;
      for (let i = 0; i < count; i++) {
        insertData.push({
          tournament_id: tournament.id,
          round,
          match_index: i,
          team1_name: null,
          team2_name: null,
          team1_score: 0,
          team2_score: 0,
          winner_name: null,
          status: 'pending',
          lobby_match_id: null,
        });
      }
      round = Math.floor(round / 2);
    }

    await supabase.from('tournament_matches').insert(insertData);
    await load();
  };

  // Создать лобби для матча
  const handleCreateLobby = async (match: BracketMatch) => {
    if (!match.team1_name || !match.team2_name) return;
    setCreating(true);
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    const { data: lobby } = await supabase.from('lobby_matches').insert({
      tournament_id: tournament.id,
      team1_name: match.team1_name,
      team2_name: match.team2_name,
      round: getRoundName(match.round),
      phase: 'scheduled',
      created_by: currentUser?.id,
    }).select().single();

    if (lobby) {
      await supabase.from('tournament_matches')
        .update({ lobby_match_id: lobby.id })
        .eq('id', match.id);
      await load();
    }
    setCreating(false);
  };

  const handleOpenLobby = (id: string, t1: string, t2: string) => {
    setActiveLobby({ id, t1, t2 });
  };

  // Если открыто лобби — показываем MatchLobbyPage
  if (activeLobby) {
    return (
      <MatchLobbyPage
        matchId={activeLobby.id}
        user={user}
        onBack={() => setActiveLobby(null)}
      />
    );
  }

  // Группируем матчи по раундам
  const rounds = Array.from(new Set(matches.map(m => m.round))).sort((a, b) => b - a);
  const champion = matches.find(m => m.round === 1)?.winner_name ?? null;

  // Лобби по id
  const lobbyById = (id: string | null) => id ? lobbies.find(l => l.id === id) ?? null : null;
  const lobbyByTeams = (t1: string | null, t2: string | null) =>
    t1 && t2 ? lobbies.find(l => l.team1_name === t1 && l.team2_name === t2) ?? null : null;

  return (
    <div className="min-h-screen bg-dark-300 text-white">
      {/* Header */}
      <header className="bg-dark-100/95 backdrop-blur-md border-b border-dark-50 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="text-gray-400 hover:text-white transition-colors flex items-center gap-1.5 text-sm">
              <ArrowLeft className="w-4 h-4" /> Назад
            </button>
            <div className="h-5 w-px bg-dark-50" />
            <div className="flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-primary-500" />
              <span className="font-display font-bold text-white truncate">{tournament.name}</span>
              <span className="text-gray-500 text-sm hidden sm:block">— Турнирная сетка</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="p-2 text-gray-500 hover:text-white transition-colors">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            {isAdmin && (
              <button
                onClick={generateBracket}
                className="btn-primary text-sm py-1.5 px-4 flex items-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5" /> Сгенерировать сетку
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">

        {/* Champion banner */}
        {champion && (
          <div className="mb-6 flex items-center gap-4 px-5 py-4 bg-yellow-500/10 border border-yellow-500/30 rounded-2xl">
            <div className="w-12 h-12 bg-yellow-500/20 rounded-xl flex items-center justify-center shrink-0">
              <Trophy className="w-6 h-6 text-yellow-400" />
            </div>
            <div>
              <p className="text-yellow-400 text-xs font-medium uppercase tracking-wider mb-0.5">Победитель турнира</p>
              <p className="font-display font-bold text-white text-2xl">{champion}</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20 gap-3">
            <RefreshCw className="w-5 h-5 text-primary-500 animate-spin" />
            <span className="text-gray-400">Загружаем сетку…</span>
          </div>
        ) : matches.length === 0 ? (
          <div className="text-center py-20">
            <GitBranch className="w-14 h-14 text-gray-700 mx-auto mb-4" />
            <p className="text-white font-display font-bold text-xl mb-2">Сетка ещё не сформирована</p>
            <p className="text-gray-500 text-sm mb-6">
              {isAdmin ? 'Нажми «Сгенерировать сетку» когда все команды зарегистрированы' : 'Появится после старта турнира'}
            </p>
            {isAdmin && (
              <button onClick={generateBracket} className="btn-primary flex items-center gap-2 mx-auto">
                <Play className="w-4 h-4" /> Сгенерировать сетку
              </button>
            )}
          </div>
        ) : (
          /* ── Bracket ── */
          <div className="overflow-x-auto pb-6">
            <div className="flex gap-1 min-w-max items-start">
              {rounds.map((round, ri) => {
                const roundMatches = matches
                  .filter(m => m.round === round)
                  .sort((a, b) => a.match_index - b.match_index);

                // Height multiplier so matches align vertically
                const totalHeight = 600;
                const matchHeight = totalHeight / roundMatches.length;

                return (
                  <div key={round} className="flex flex-col" style={{ width: 196 }}>
                    {/* Round label */}
                    <div className="text-center mb-3 px-3">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                        {getRoundName(round)}
                      </span>
                    </div>

                    {/* Matches */}
                    <div className="flex flex-col" style={{ gap: 0 }}>
                      {roundMatches.map((match, mi) => {
                        const lobby = match.lobby_match_id
                          ? lobbyById(match.lobby_match_id)
                          : lobbyByTeams(match.team1_name, match.team2_name);
                        return (
                          <div
                            key={match.id}
                            style={{ height: matchHeight, display: 'flex', alignItems: 'center', padding: '4px 0' }}
                          >
                            <div style={{ flex: 1, position: 'relative' }}>
                              <MatchCard
                                match={match}
                                lobby={lobby}
                                isAdmin={isAdmin}
                                onOpenLobby={handleOpenLobby}
                                onCreateLobby={handleCreateLobby}
                              />
                              {/* Connector right */}
                              {ri < rounds.length - 1 && (
                                <div style={{
                                  position: 'absolute',
                                  right: -13,
                                  top: '50%',
                                  width: 13,
                                  height: 1,
                                  background: 'var(--color-border-tertiary, #333)',
                                }} />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Trophy column */}
              {rounds.length > 0 && (
                <div className="flex flex-col" style={{ width: 160 }}>
                  <div className="text-center mb-3">
                    <span className="text-xs font-bold text-yellow-500 uppercase tracking-wider">🏆 Победитель</span>
                  </div>
                  <div style={{ height: 600, display: 'flex', alignItems: 'center', paddingLeft: 12 }}>
                    <div className={`px-4 py-3 rounded-xl border text-center ${
                      champion
                        ? 'bg-yellow-500/10 border-yellow-500/40'
                        : 'bg-dark-200 border-dark-50'
                    }`}>
                      <Trophy className={`w-6 h-6 mx-auto mb-1.5 ${champion ? 'text-yellow-400' : 'text-gray-700'}`} />
                      <p className={`font-display font-bold text-sm ${champion ? 'text-yellow-300' : 'text-gray-600 italic font-normal'}`}>
                        {champion ?? 'Не определён'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Legend */}
        {matches.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500/60" /> Live матч</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-primary-500/60" /> Лобби открыто</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-dark-50" /> Ожидает</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-gray-600/40" /> Завершён</span>
            {isAdmin && <span className="ml-auto text-gray-600">Кликни на матч → создай лобби</span>}
          </div>
        )}
      </div>
    </div>
  );
}

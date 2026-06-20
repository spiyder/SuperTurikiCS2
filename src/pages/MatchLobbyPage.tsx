// src/pages/MatchLobbyPage.tsx
// Лобби матча с поддержкой форматов 1v1 / 2v2 / 5v5
// Маппул и порядок вето зависят от формата турнира

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft, CheckCircle2, Clock, Shield, Swords, MessageSquare,
  Users, ChevronRight, AlertCircle, Crown, Circle, Loader2,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { MAPS_BY_FORMAT, VETO_ORDER_BY_FORMAT, getPlayersPerTeam, type MatchFormat } from '../lib/maps';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ─── Types ───────────────────────────────────────────────────

interface LobbyMatch {
  id: string;
  team1_name: string;
  team2_name: string;
  round: string;
  scheduled_at: string | null;
  phase: 'scheduled' | 'open' | 'readycheck' | 'veto' | 'playing' | 'finished';
  winner_name: string | null;
  score1: number;
  score2: number;
  format: MatchFormat | null;
}

interface ReadyPlayer {
  user_id: string;
  username: string;
  team: 'team1' | 'team2';
  is_ready: boolean;
}

interface VetoAction {
  step: number;
  map_name: string;
  action: 'ban' | 'pick' | 'decider';
  team: 'team1' | 'team2' | 'auto';
  acted_at: string;
}

interface ChatMsg {
  id: string;
  user_id: string | null;
  username: string;
  team: 'team1' | 'team2' | null;
  channel: 'global' | 'team1' | 'team2' | 'system';
  message: string;
  created_at: string;
}

interface Props {
  matchId: string;
  user: SupabaseUser | null;
  onBack: () => void;
}

// ─── Component ───────────────────────────────────────────────

export function MatchLobbyPage({ matchId, user, onBack }: Props) {
  const [match, setMatch]             = useState<LobbyMatch | null>(null);
  const [players, setPlayers]         = useState<ReadyPlayer[]>([]);
  const [vetoActions, setVetoActions] = useState<VetoAction[]>([]);
  const [messages, setMessages]       = useState<ChatMsg[]>([]);
  const [loading, setLoading]         = useState(true);
  const [chatInput, setChatInput]     = useState('');
  const [chatChannel, setChatChannel] = useState<'global' | 'team'>('global');
  const [vetoTimer, setVetoTimer]     = useState(30);
  const [readyTimer, setReadyTimer]   = useState(60);
  const [joining, setJoining]         = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const chatEndRef  = useRef<HTMLDivElement>(null);
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  const myName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Игрок';

  // Команда игрока определяется по тому, за какую сторону он зашёл в лобби
  const userTeam: 'team1' | 'team2' | null = players.find(p => p.user_id === user?.id)?.team ?? null;

  // Формат матча — дефолт 5v5
  const format: MatchFormat = (match?.format as MatchFormat) ?? '5v5';
  const maps      = MAPS_BY_FORMAT[format];
  const vetoOrder = VETO_ORDER_BY_FORMAT[format];
  const teamSize  = getPlayersPerTeam(format);

  useEffect(() => { loadAll(); subscribeRealtime(); return () => { channelRef.current?.unsubscribe(); }; }, [matchId]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Veto timer
  useEffect(() => {
    if (match?.phase !== 'veto') return;
    if (vetoOrder.length === 0) return; // 1v1 — нет вето
    const currentStep = vetoActions.length;
    if (currentStep >= vetoOrder.length) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setVetoTimer(30);
    timerRef.current = setInterval(() => {
      setVetoTimer(v => {
        if (v <= 1) { clearInterval(timerRef.current!); handleAutoVeto(); return 30; }
        return v - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [vetoActions.length, match?.phase]);

  // Ready timer
  useEffect(() => {
    if (match?.phase !== 'readycheck') return;
    if (timerRef.current) clearInterval(timerRef.current);
    setReadyTimer(60);
    timerRef.current = setInterval(() => {
      setReadyTimer(v => { if (v <= 1) { clearInterval(timerRef.current!); return 0; } return v - 1; });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [match?.phase]);

  const loadAll = async () => {
    setLoading(true);
    const [mRes, pRes, vRes, cRes] = await Promise.all([
      supabase.from('lobby_matches').select('*').eq('id', matchId).single(),
      supabase.from('lobby_ready').select('*').eq('match_id', matchId),
      supabase.from('lobby_veto').select('*').eq('match_id', matchId).order('step'),
      supabase.from('lobby_chat').select('*').eq('match_id', matchId).order('created_at').limit(200),
    ]);
    if (mRes.data) setMatch(mRes.data);
    if (pRes.data) setPlayers(pRes.data);
    if (vRes.data) setVetoActions(vRes.data);
    if (cRes.data) setMessages(cRes.data);
    setLoading(false);
  };

  const loadPlayers = async () => {
    const { data } = await supabase.from('lobby_ready').select('*').eq('match_id', matchId);
    if (data) setPlayers(data);
  };

  const subscribeRealtime = () => {
    const ch = supabase.channel(`lobby:${matchId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lobby_matches', filter: `id=eq.${matchId}` },
        payload => { if (payload.new) setMatch(payload.new as LobbyMatch); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lobby_ready', filter: `match_id=eq.${matchId}` },
        () => loadPlayers())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'lobby_veto', filter: `match_id=eq.${matchId}` },
        payload => { if (payload.new) setVetoActions(prev => [...prev, payload.new as VetoAction].sort((a,b)=>a.step-b.step)); })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'lobby_chat', filter: `match_id=eq.${matchId}` },
        payload => { if (payload.new) setMessages(prev => [...prev, payload.new as ChatMsg]); })
      .subscribe();
    channelRef.current = ch;
  };

  const joinLobby = async (team: 'team1' | 'team2') => {
    if (!user) return;
    setJoining(true);
    await supabase.from('lobby_ready').upsert({
      match_id: matchId, user_id: user.id, username: myName, team, is_ready: false,
    }, { onConflict: 'match_id,user_id' });
    await loadPlayers();
    setJoining(false);
  };

  const handleReady = async () => {
    if (!user) return;
    await supabase.from('lobby_ready').update({ is_ready: true }).eq('match_id', matchId).eq('user_id', user.id);
    await postSystemMsg(`${myName} подтвердил(а) готовность.`);
  };

  const handleVetoMap = async (mapName: string) => {
    if (!match || !user || !userTeam) return;
    const currentStep = vetoActions.length;
    if (currentStep >= vetoOrder.length) return;
    const step = vetoOrder[currentStep];
    if (step.team !== userTeam) return;
    if (timerRef.current) clearInterval(timerRef.current);
    await commitVeto(currentStep, mapName, step.action, step.team);
  };

  const handleAutoVeto = async () => {
    if (!match) return;
    const currentStep = vetoActions.length;
    if (currentStep >= vetoOrder.length) return;
    const step = vetoOrder[currentStep];
    const taken = vetoActions.map(a => a.map_name);
    const available = maps.filter(m => !taken.includes(m.name));
    if (!available.length) return;
    const chosen = available[Math.floor(Math.random() * available.length)];
    await commitVeto(currentStep, chosen.name, step.action, 'auto');
  };

  const commitVeto = async (step: number, mapName: string, action: 'ban' | 'pick', team: string) => {
    await supabase.from('lobby_veto').insert({
      match_id: matchId, step, map_name: mapName, action, team, acted_by: user?.id ?? null,
    });
    const teamLabel = team === 'team1' ? match!.team1_name : team === 'team2' ? match!.team2_name : 'Авто';
    await postSystemMsg(`${teamLabel} ${action === 'ban' ? 'забанила' : 'выбрала'} карту ${mapName}.`);

    const nextStep = step + 1;
    if (nextStep >= vetoOrder.length) {
      const takenMaps = [...vetoActions.map(a => a.map_name), mapName];
      const decider = maps.find(m => !takenMaps.includes(m.name));
      if (decider) {
        await supabase.from('lobby_veto').insert({
          match_id: matchId, step: nextStep, map_name: decider.name,
          action: 'decider', team: 'auto', acted_by: null,
        });
        await postSystemMsg(`Карта-децайдер: ${decider.displayName}!`);
      }
    }
  };

  const postSystemMsg = useCallback(async (text: string) => {
    await supabase.from('lobby_chat').insert({
      match_id: matchId, user_id: null, username: 'Система', channel: 'system', message: text,
    });
  }, [matchId]);

  const sendMessage = async () => {
    if (!chatInput.trim() || !user) return;
    const channel = chatChannel === 'team' ? (userTeam ?? 'global') : 'global';
    await supabase.from('lobby_chat').insert({
      match_id: matchId, user_id: user.id, username: myName, team: userTeam, channel, message: chatInput.trim(),
    });
    setChatInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  // ── Derived ───────────────────────────────────────────────
  const myRecord     = players.find(p => p.user_id === user?.id);
  const isJoined     = !!myRecord;
  const isReady      = myRecord?.is_ready ?? false;
  const readyCount   = players.filter(p => p.is_ready).length;
  const team1Players = players.filter(p => p.team === 'team1');
  const team2Players = players.filter(p => p.team === 'team2');

  // Строим отображение карт
  const mapDisplay = maps.map(m => {
    const action = vetoActions.find(a => a.map_name === m.name);
    if (!action) return { ...m, status: 'available' as const, actionBy: '' };
    const teamLabel = action.team === 'team1' ? match?.team1_name ?? 'К1'
                    : action.team === 'team2' ? match?.team2_name ?? 'К2' : 'Авто';
    return { ...m, status: action.action as 'ban' | 'pick' | 'decider', actionBy: teamLabel };
  });

  const currentVetoStep = vetoActions.length < vetoOrder.length ? vetoOrder[vetoActions.length] : null;
  const isMyVetoTurn    = currentVetoStep?.team === userTeam;
  const pickedMaps      = mapDisplay.filter(m => m.status === 'picked' || m.status === 'decider');

  const visibleMessages = messages.filter(msg =>
    msg.channel === 'system' || msg.channel === 'global' ||
    (chatChannel === 'team' && msg.channel === (userTeam ?? ''))
  );

  // ── Format badge ─────────────────────────────────────────
  const formatBadge: Record<MatchFormat, { label: string; color: string }> = {
    '1v1': { label: '1v1 Duel',       color: 'bg-red-500/20 text-red-400' },
    '2v2': { label: '2v2 Wingman',    color: 'bg-purple-500/20 text-purple-400' },
    '5v5': { label: '5v5 Competitive',color: 'bg-primary-500/20 text-primary-400' },
  };

  if (loading) return (
    <div className="min-h-screen bg-dark-300 flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
    </div>
  );
  if (!match) return (
    <div className="min-h-screen bg-dark-300 flex flex-col items-center justify-center gap-4">
      <AlertCircle className="w-12 h-12 text-red-400" />
      <p className="text-white font-bold text-lg">Лобби не найдено</p>
      <button onClick={onBack} className="btn-outline">Назад</button>
    </div>
  );

  // ─── Render ───────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-dark-300 text-white">
      {/* Header */}
      <header className="bg-dark-100/95 backdrop-blur-md border-b border-dark-50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="text-gray-400 hover:text-white transition-colors flex items-center gap-1 text-sm">
              <ArrowLeft className="w-4 h-4" /> Назад
            </button>
            <div className="h-5 w-px bg-dark-50" />
            <span className="font-display font-bold text-white">
              {match.team1_name} <span className="text-primary-500">vs</span> {match.team2_name}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${formatBadge[format].color}`}>
              {formatBadge[format].label}
            </span>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${
            match.phase === 'readycheck' ? 'bg-yellow-500/20 text-yellow-400' :
            match.phase === 'veto'       ? 'bg-primary-500/20 text-primary-400' :
            match.phase === 'playing'    ? 'bg-green-500/20 text-green-400' :
            match.phase === 'open'       ? 'bg-blue-500/20 text-blue-400' :
                                           'bg-gray-500/20 text-gray-400'
          }`}>
            {{ scheduled:'Ожидание', open:'Лобби открыто', readycheck:'Готовность', veto:'Вето карт', playing:'Матч идёт', finished:'Завершён' }[match.phase]}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 grid lg:grid-cols-[1fr_360px] gap-6">
        <div className="space-y-6">

          {/* Scheduled */}
          {match.phase === 'scheduled' && (
            <div className="card flex items-center gap-4">
              <div className="w-12 h-12 bg-gray-500/20 rounded-xl flex items-center justify-center shrink-0">
                <Clock className="w-6 h-6 text-gray-400" />
              </div>
              <div>
                <p className="font-display font-bold text-white">Лобби ещё не открыто</p>
                <p className="text-gray-400 text-sm">
                  {match.scheduled_at
                    ? `Начало: ${new Date(match.scheduled_at).toLocaleString('ru', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}`
                    : 'Судья откроет лобби когда придёт время'}
                </p>
              </div>
            </div>
          )}

          {/* Join button — выбор стороны */}
          {match.phase === 'open' && !isJoined && user && (
            <div className="card">
              <p className="text-gray-300 mb-4">Лобби открыто. Выбери за какую команду играешь.</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <button onClick={() => joinLobby('team1')} disabled={joining}
                  className="flex items-center justify-center gap-2 py-4 rounded-xl bg-primary-500/10 hover:bg-primary-500/20 border border-primary-500/40 text-primary-300 font-semibold transition-colors disabled:opacity-50">
                  {joining ? <Loader2 className="w-5 h-5 animate-spin" /> : <Shield className="w-5 h-5" />}
                  {match.team1_name}
                </button>
                <button onClick={() => joinLobby('team2')} disabled={joining}
                  className="flex items-center justify-center gap-2 py-4 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/40 text-blue-300 font-semibold transition-colors disabled:opacity-50">
                  {joining ? <Loader2 className="w-5 h-5 animate-spin" /> : <Shield className="w-5 h-5" />}
                  {match.team2_name}
                </button>
              </div>
            </div>
          )}

          {/* Ready check */}
          {(match.phase === 'open' || match.phase === 'readycheck') && (
            <section className="card">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-display font-bold text-xl flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-primary-500" />
                  {match.phase === 'readycheck' ? 'Подтверждение готовности' : 'Игроки в лобби'}
                </h2>
                {match.phase === 'readycheck' && (
                  <span className={`font-display text-2xl font-bold tabular-nums ${readyTimer <= 10 ? 'text-red-400 animate-pulse' : 'text-primary-500'}`}>
                    {readyTimer}с
                  </span>
                )}
              </div>

              {match.phase === 'readycheck' && (
                <>
                  <div className="h-2 bg-dark-50 rounded-full overflow-hidden mb-2">
                    <div className="h-full bg-primary-500 rounded-full transition-all duration-500"
                         style={{ width: `${players.length ? (readyCount / players.length) * 100 : 0}%` }} />
                  </div>
                  <p className="text-gray-400 text-sm text-center mb-5">{readyCount} / {players.length} готовы</p>
                </>
              )}

              <div className="grid sm:grid-cols-2 gap-4 mb-5">
                {[
                  { label: match.team1_name, list: team1Players, side: 'team1' as const, color: 'text-primary-500' },
                  { label: match.team2_name, list: team2Players, side: 'team2' as const, color: 'text-blue-400' },
                ].map(({ label, list, side, color }) => (
                  <div key={side} className="bg-dark-100 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Shield className={`w-4 h-4 ${color}`} />
                      <span className="font-semibold text-sm text-white">{label}</span>
                      <span className="text-gray-600 text-xs ml-auto">{list.length}/{teamSize}</span>
                    </div>
                    {list.length === 0 ? (
                      <p className="text-gray-600 text-sm">Никто не зашёл</p>
                    ) : (
                      <ul className="space-y-2">
                        {list.map(p => (
                          <li key={p.user_id} className="flex items-center justify-between">
                            <span className={`text-sm ${p.user_id === user?.id ? 'text-white font-medium' : 'text-gray-300'}`}>
                              {p.username}{p.user_id === user?.id ? ' (ты)' : ''}
                            </span>
                            {p.is_ready
                              ? <CheckCircle2 className="w-4 h-4 text-green-400" />
                              : <Circle className="w-4 h-4 text-gray-600 animate-pulse" />}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>

              {match.phase === 'readycheck' && isJoined && (
                !isReady ? (
                  <button onClick={handleReady} className="w-full btn-primary text-lg py-4 flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-5 h-5" /> Я готов
                  </button>
                ) : (
                  <div className="w-full py-4 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400 font-semibold text-center flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-5 h-5" /> Готовность подтверждена
                  </div>
                )
              )}
            </section>
          )}

          {/* Veto / Mappoll */}
          {(match.phase === 'veto' || match.phase === 'playing' || match.phase === 'finished') && (
            <section className="card">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-display font-bold text-xl flex items-center gap-2">
                  <Swords className="w-5 h-5 text-primary-500" /> Маппул
                  <span className={`text-xs px-2 py-0.5 rounded-full font-normal ${formatBadge[format].color}`}>
                    {format}
                  </span>
                </h2>
                {match.phase === 'veto' && currentVetoStep && (
                  <span className={`font-display text-2xl font-bold tabular-nums ${vetoTimer <= 10 ? 'text-red-400 animate-pulse' : 'text-primary-500'}`}>
                    {vetoTimer}с
                  </span>
                )}
              </div>

              {/* 1v1 — нет вето, просто показываем карту */}
              {format === '1v1' ? (
                <div className="text-center py-6">
                  <div className="w-32 h-24 mx-auto rounded-xl overflow-hidden mb-3" style={{ background: maps[0]?.gradient }}>
                    <div className="w-full h-full bg-dark-400/30 flex items-center justify-center">
                      <span className="font-display font-bold text-white">{maps[0]?.displayName}</span>
                    </div>
                  </div>
                  <p className="text-gray-400 text-sm">В формате 1v1 карта фиксирована</p>
                </div>
              ) : (
                <>
                  {/* Вето — чья очередь */}
                  {match.phase === 'veto' && currentVetoStep && (
                    <div className={`mb-4 flex items-center gap-2 px-4 py-2.5 rounded-xl border ${
                      isMyVetoTurn ? 'bg-primary-500/10 border-primary-500/40 text-primary-300' : 'bg-dark-100 border-dark-50 text-gray-400'
                    }`}>
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span className="text-sm font-medium">
                        {isMyVetoTurn
                          ? `Твоя очередь — ${currentVetoStep.action === 'ban' ? 'забань' : 'выбери'} карту`
                          : `${currentVetoStep.team === 'team1' ? match.team1_name : match.team2_name} ${currentVetoStep.label}…`}
                      </span>
                    </div>
                  )}

                  {/* Progress */}
                  {match.phase === 'veto' && vetoOrder.length > 0 && (
                    <div className="flex gap-1.5 mb-5 flex-wrap">
                      {vetoOrder.map((s, i) => (
                        <div key={i} className={`h-1.5 flex-1 min-w-[20px] rounded-full transition-all ${
                          i < vetoActions.length
                            ? (s.action === 'ban' ? 'bg-red-500' : 'bg-green-500')
                            : i === vetoActions.length ? 'bg-primary-500 animate-pulse' : 'bg-dark-50'
                        }`} />
                      ))}
                    </div>
                  )}

                  {/* Maps grid */}
                  <div className={`grid gap-3 ${maps.length <= 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4'}`}>
                    {mapDisplay.map(m => {
                      const canAct = match.phase === 'veto' && m.status === 'available' && isMyVetoTurn;
                      return (
                        <button key={m.name}
                          onClick={() => canAct && handleVetoMap(m.name)}
                          disabled={!canAct}
                          className={`relative rounded-xl overflow-hidden aspect-[4/3] transition-all duration-200 focus:outline-none
                            ${canAct ? 'hover:scale-105 hover:ring-2 hover:ring-primary-500 cursor-pointer' : 'cursor-default'}
                            ${m.status === 'banned'  ? 'opacity-30 grayscale' : ''}
                            ${m.status === 'picked'  ? 'ring-2 ring-green-500' : ''}
                            ${m.status === 'decider' ? 'ring-2 ring-yellow-400' : ''}
                          `}>
                          <div className="absolute inset-0" style={{ background: m.gradient }} />
                          <div className="absolute inset-0 bg-dark-400/40" />
                          <div className="absolute bottom-0 inset-x-0 px-2 py-2 bg-gradient-to-t from-dark-400/90 to-transparent">
                            <p className="font-display text-xs font-bold text-white leading-tight">{m.displayName}</p>
                          </div>
                          {m.status !== 'available' && (
                            <div className={`absolute inset-0 flex items-center justify-center ${
                              m.status === 'banned'  ? 'bg-red-900/60' :
                              m.status === 'picked'  ? 'bg-green-900/40' : 'bg-yellow-900/40'
                            }`}>
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                m.status === 'banned'  ? 'bg-red-500/80 text-white' :
                                m.status === 'picked'  ? 'bg-green-500/80 text-white' :
                                                         'bg-yellow-400/80 text-black'
                              }`}>
                                {m.status === 'banned' ? `Бан — ${m.actionBy}` :
                                 m.status === 'picked' ? `Пик — ${m.actionBy}` : '⚡ Децайдер'}
                              </span>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Picked maps */}
                  {pickedMaps.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-dark-50">
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Карты матча</p>
                      <div className="flex flex-wrap gap-2">
                        {pickedMaps.map(m => (
                          <span key={m.name} className={`px-3 py-1 rounded-full text-sm font-semibold ${
                            m.status === 'decider'
                              ? 'bg-yellow-400/20 text-yellow-300 border border-yellow-400/40'
                              : 'bg-green-500/20 text-green-300 border border-green-500/40'
                          }`}>
                            {m.displayName} {m.status === 'decider' ? '⚡' : ''}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </section>
          )}

          {/* Playing */}
          {match.phase === 'playing' && (
            <div className="card border-green-500/40 bg-green-500/5 flex items-center gap-4">
              <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <p className="font-display font-bold text-green-400 text-lg">Матч начался!</p>
                <p className="text-gray-400 text-sm">Подключитесь к серверу CS2 и удачи.</p>
              </div>
            </div>
          )}

          {/* Finished */}
          {match.phase === 'finished' && (
            <div className="card border-gray-500/40 text-center py-8">
              <p className="font-display font-bold text-2xl text-white mb-2">Матч завершён</p>
              {match.winner_name && <p className="text-primary-400 text-lg">🏆 Победитель: <strong>{match.winner_name}</strong></p>}
              {(match.score1 > 0 || match.score2 > 0) && (
                <p className="text-gray-400 mt-2 text-lg font-mono">
                  {match.team1_name} <span className="text-white font-bold">{match.score1}:{match.score2}</span> {match.team2_name}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Chat */}
        <aside className="flex flex-col" style={{ height: 'calc(100vh - 120px)', position: 'sticky', top: '80px' }}>
          <div className="card flex flex-col h-full overflow-hidden p-0">
            <div className="flex items-center justify-between p-4 border-b border-dark-50 shrink-0">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-primary-500" />
                <span className="font-semibold text-sm">Чат</span>
              </div>
              {userTeam && (
                <div className="flex bg-dark-100 rounded-lg p-0.5 gap-0.5">
                  {(['global', 'team'] as const).map(ch => (
                    <button key={ch} onClick={() => setChatChannel(ch)}
                      className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                        chatChannel === ch ? 'bg-primary-500 text-white' : 'text-gray-400 hover:text-white'
                      }`}>
                      {ch === 'global'
                        ? <span className="flex items-center gap-1"><Users className="w-3 h-3" /> Общий</span>
                        : <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> Команда</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
              {visibleMessages.map(msg => {
                const isSystem = msg.channel === 'system';
                const isMe = msg.user_id === user?.id;
                return (
                  <div key={msg.id} className={isSystem ? 'text-center' : ''}>
                    {isSystem ? (
                      <span className="text-xs text-gray-500 bg-dark-100 px-2 py-0.5 rounded-full">{msg.message}</span>
                    ) : (
                      <div className={`flex flex-col gap-0.5 ${isMe ? 'items-end' : 'items-start'}`}>
                        <span className={`text-xs font-medium ${msg.team === 'team1' ? 'text-primary-400' : 'text-blue-400'}`}>
                          {msg.username}
                        </span>
                        <div className={`px-3 py-2 rounded-xl text-sm max-w-[85%] break-words ${
                          isMe ? 'bg-primary-500/20 text-white' : 'bg-dark-100 text-gray-200'
                        }`}>
                          {msg.message}
                        </div>
                        <span className="text-[10px] text-gray-600">
                          {new Date(msg.created_at).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>
            <div className="p-3 border-t border-dark-50 shrink-0">
              {user ? (
                <>
                  <div className="flex gap-2">
                    <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={chatChannel === 'global' ? 'Общий чат…' : 'Только команда…'}
                      className="flex-1 bg-dark-100 border border-dark-50 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-primary-500"
                      maxLength={300} />
                    <button onClick={sendMessage} className="bg-primary-500 hover:bg-primary-600 text-white rounded-lg px-3 py-2 transition-colors">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-600 mt-1.5">
                    {chatChannel === 'team' ? '🔒 Видно только вашей команде' : '🌐 Видно всем участникам'}
                  </p>
                </>
              ) : (
                <p className="text-gray-600 text-sm text-center">Войдите чтобы писать в чат</p>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

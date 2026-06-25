// src/pages/QuickLobbyPage.tsx
//
// Публичное лобби без регистрации. Любой создаёт ссылку и делится ею.
// Гости идентифицируются через session_id (localStorage), без аккаунта.
// Командное вето (FACEIT-style) валидируется на сервере через Edge Function.

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Copy, Check, Users, Shield, Crown, MessageSquare, ChevronRight,
  Swords, Link2, ExternalLink, Loader2, AlertCircle, Plus, RefreshCw, ArrowLeft,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

// ─── Session identity (без аккаунта) ──────────────────────────

function getSessionId(): string {
  let id = localStorage.getItem('quick_session_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('quick_session_id', id);
  }
  return id;
}

function getSavedUsername(): string {
  return localStorage.getItem('quick_username') ?? '';
}
function saveUsername(name: string) {
  localStorage.setItem('quick_username', name);
}

// ─── Maps config (синхронизировано с Edge Function) ───────────

type Format = '1v1' | '2v2' | '5v5';

import deMirage from '../assets/maps/de_mirage.jpg';
import deDust2 from '../assets/maps/de_dust2.jpg';
import deOverpass from '../assets/maps/de_overpass.jpg';
import deAnubis from '../assets/maps/de_anubis.jpg';
import deInferno from '../assets/maps/de_inferno.jpg';
import deAncient from '../assets/maps/de_ancient.jpg';
import deNuke from '../assets/maps/de_nuke.jpg';

const MAPS: Record<Format, { name: string; display: string; image?: string }[]> = {
  '1v1': [{ name: 'aim_map', display: 'Aim Map' }],
  '2v2': [
    { name: 'de_nuke', display: 'Nuke', image: deNuke },
    { name: 'de_inferno', display: 'Inferno', image: deInferno },
    { name: 'de_dust2_wingman', display: 'Dust2 Wingman', image: deDust2 },
    { name: 'de_mirage_wingman', display: 'Mirage Wingman', image: deMirage },
    { name: 'de_train_wingman', display: 'Train Wingman' },
    { name: 'de_anubis_wingman', display: 'Anubis Wingman', image: deAnubis },
    { name: 'de_overpass', display: 'Overpass', image: deOverpass },
  ],
  '5v5': [
    { name: 'de_mirage', display: 'Mirage', image: deMirage },
    { name: 'de_dust2', display: 'Dust2', image: deDust2 },
    { name: 'de_overpass', display: 'Overpass', image: deOverpass },
    { name: 'de_anubis', display: 'Anubis', image: deAnubis },
    { name: 'de_inferno', display: 'Inferno', image: deInferno },
    { name: 'de_ancient', display: 'Ancient', image: deAncient },
    { name: 'de_nuke', display: 'Nuke', image: deNuke },
  ],
};

function buildVetoOrder(mapCount: number): ('team1' | 'team2')[] {
  const order: ('team1' | 'team2')[] = [];
  for (let i = 0; i < mapCount - 1; i++) order.push(i % 2 === 0 ? 'team1' : 'team2');
  return order;
}

// ─── Types ───────────────────────────────────────────────────

interface Lobby {
  id: string;
  host_session_id: string;
  format: Format;
  phase: 'lobby' | 'ready' | 'veto' | 'done';
  team1_name: string;
  team2_name: string;
  team1_captain_session: string | null;
  team2_captain_session: string | null;
  current_veto_step: number;
  final_map: string | null;
  server_link: string | null;
}

interface LobbyPlayer {
  session_id: string;
  username: string;
  team: 'team1' | 'team2';
  is_ready: boolean;
  is_host: boolean;
}

interface VetoStep { step: number; team: string; action: string; map_name: string; }

interface ChatMsg { id: string; session_id: string | null; username: string; message: string; created_at: string; }

const EDGE_FN_URL = 'https://pfvfjuvthywxcmzojgyd.supabase.co/functions/v1/quick-lobby-veto';

// ─── Component ───────────────────────────────────────────────

interface Props {
  lobbyId?: string;       // если открыт по ссылке ?qlobby=ID
  onCreated?: (id: string) => void;
}

export function QuickLobbyPage({ lobbyId: initialLobbyId }: Props) {
  const sessionId = useRef(getSessionId()).current;
  const [username, setUsername]   = useState(getSavedUsername());
  const [needsName, setNeedsName] = useState(!getSavedUsername());

  const [lobbyId, setLobbyId]     = useState<string | null>(initialLobbyId ?? null);
  const [lobby, setLobby]         = useState<Lobby | null>(null);
  const [players, setPlayers]     = useState<LobbyPlayer[]>([]);
  const [vetoSteps, setVetoSteps] = useState<VetoStep[]>([]);
  const [messages, setMessages]   = useState<ChatMsg[]>([]);
  const [loading, setLoading]     = useState(!!initialLobbyId);
  const [chatInput, setChatInput] = useState('');
  const [copied, setCopied]       = useState(false);
  const [banning, setBanning]     = useState(false);
  const [error, setError]        = useState('');

  // Create form
  const [createFormat, setCreateFormat] = useState<Format>('5v5');
  const [creating, setCreating] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (lobbyId) { loadAll(); subscribeRealtime(); }
  }, [lobbyId]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // ── Identity ──────────────────────────────────────────────
  const confirmName = (name: string) => {
    if (!name.trim()) return;
    saveUsername(name.trim());
    setUsername(name.trim());
    setNeedsName(false);
  };

  // ── Load ──────────────────────────────────────────────────
  const loadAll = async () => {
    if (!lobbyId) return;
    setLoading(true);
    const [lRes, pRes, vRes, cRes] = await Promise.all([
      supabase.from('quick_lobbies').select('*').eq('id', lobbyId).single(),
      supabase.from('quick_lobby_players').select('*').eq('lobby_id', lobbyId),
      supabase.from('quick_lobby_veto').select('*').eq('lobby_id', lobbyId).order('step'),
      supabase.from('quick_lobby_chat').select('*').eq('lobby_id', lobbyId).order('created_at').limit(100),
    ]);
    if (lRes.data) setLobby(lRes.data);
    if (pRes.data) setPlayers(pRes.data);
    if (vRes.data) setVetoSteps(vRes.data);
    if (cRes.data) setMessages(cRes.data);
    setLoading(false);
  };

  const subscribeRealtime = () => {
    const ch = supabase.channel(`quicklobby:${lobbyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quick_lobbies', filter: `id=eq.${lobbyId}` },
        p => { if (p.new) setLobby(p.new as Lobby); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quick_lobby_players', filter: `lobby_id=eq.${lobbyId}` },
        () => reloadPlayers())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'quick_lobby_veto', filter: `lobby_id=eq.${lobbyId}` },
        p => { if (p.new) setVetoSteps(prev => [...prev, p.new as VetoStep].sort((a, b) => a.step - b.step)); })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'quick_lobby_chat', filter: `lobby_id=eq.${lobbyId}` },
        p => { if (p.new) setMessages(prev => [...prev, p.new as ChatMsg]); })
      .subscribe();
    return () => { ch.unsubscribe(); };
  };

  const reloadPlayers = async () => {
    if (!lobbyId) return;
    const { data } = await supabase.from('quick_lobby_players').select('*').eq('lobby_id', lobbyId);
    if (data) setPlayers(data);
  };

  // ── Create lobby ──────────────────────────────────────────
  const createLobby = async () => {
    if (needsName) return;
    setCreating(true);
    const { data: newLobby, error: err } = await supabase.from('quick_lobbies').insert({
      host_session_id: sessionId,
      format: createFormat,
      phase: 'lobby',
    }).select().single();

    if (err || !newLobby) { setError('Не удалось создать лобби'); setCreating(false); return; }

    await supabase.from('quick_lobby_players').insert({
      lobby_id: newLobby.id, session_id: sessionId, username, team: 'team1', is_host: true,
    });

    setLobbyId(newLobby.id);
    window.history.replaceState({}, '', `?qlobby=${newLobby.id}`);
    setCreating(false);
  };

  // ── Join existing lobby ──────────────────────────────────
  const joinTeam = async (team: 'team1' | 'team2') => {
    if (!lobbyId || needsName) return;
    await supabase.from('quick_lobby_players').upsert({
      lobby_id: lobbyId, session_id: sessionId, username, team, is_host: false,
    }, { onConflict: 'lobby_id,session_id' });
  };

  const toggleReady = async () => {
    const me = players.find(p => p.session_id === sessionId);
    if (!me || !lobbyId) return;
    await supabase.from('quick_lobby_players').update({ is_ready: !me.is_ready }).eq('lobby_id', lobbyId).eq('session_id', sessionId);
  };

  // ── Host controls ─────────────────────────────────────────
  const isHost = lobby?.host_session_id === sessionId;
  const me = players.find(p => p.session_id === sessionId);
  const myTeam = me?.team ?? null;

  const startReadyPhase = async () => {
    if (!lobbyId) return;
    await supabase.from('quick_lobbies').update({ phase: 'ready' }).eq('id', lobbyId);
  };

  const startVeto = async () => {
    if (!lobbyId || !lobby) return;
    // Назначаем капитанов — первый игрок каждой команды по умолчанию, хост может это сделать явно
    const t1Captain = players.find(p => p.team === 'team1')?.session_id ?? null;
    const t2Captain = players.find(p => p.team === 'team2')?.session_id ?? null;
    await supabase.from('quick_lobbies').update({
      phase: 'veto',
      team1_captain_session: lobby.team1_captain_session ?? t1Captain,
      team2_captain_session: lobby.team2_captain_session ?? t2Captain,
      current_veto_step: 0,
    }).eq('id', lobbyId);
  };

  const setCaptain = async (team: 'team1' | 'team2', session_id: string) => {
    if (!lobbyId) return;
    const field = team === 'team1' ? 'team1_captain_session' : 'team2_captain_session';
    await supabase.from('quick_lobbies').update({ [field]: session_id }).eq('id', lobbyId);
  };

  const setServerLink = async (link: string) => {
    if (!lobbyId) return;
    await supabase.from('quick_lobbies').update({ server_link: link }).eq('id', lobbyId);
  };

  // ── Veto action (через Edge Function — серверная валидация) ──
  const banMap = async (mapName: string) => {
    if (!lobbyId) return;
    setBanning(true); setError('');
    try {
      const res = await fetch(EDGE_FN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lobby_id: lobbyId, session_id: sessionId, map_name: mapName }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? 'Ошибка');
    } catch {
      setError('Не удалось связаться с сервером');
    }
    setBanning(false);
  };

  // ── Chat ──────────────────────────────────────────────────
  const sendMessage = async () => {
    if (!chatInput.trim() || !lobbyId) return;
    await supabase.from('quick_lobby_chat').insert({ lobby_id: lobbyId, session_id: sessionId, username, message: chatInput.trim() });
    setChatInput('');
  };

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}?qlobby=${lobbyId}`);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const leaveLobby = async () => {
    if (lobbyId) {
      await supabase.from('quick_lobby_players').delete().eq('lobby_id', lobbyId).eq('session_id', sessionId);
    }
    window.location.href = window.location.origin + window.location.pathname;
  };

  // ── Derived ───────────────────────────────────────────────
  const format = lobby?.format ?? '5v5';
  const allMaps = MAPS[format];
  const vetoOrder = buildVetoOrder(allMaps.length);
  const currentStep = lobby ? vetoOrder[lobby.current_veto_step] : null;
  const bannedMapNames = vetoSteps.filter(v => v.action === 'ban').map(v => v.map_name);
  const isMyTurn = currentStep === 'team1' ? lobby?.team1_captain_session === sessionId
                  : currentStep === 'team2' ? lobby?.team2_captain_session === sessionId : false;

  const team1Players = players.filter(p => p.team === 'team1');
  const team2Players = players.filter(p => p.team === 'team2');
  const allReady = players.length > 0 && players.every(p => p.is_ready);

  // ═══════════════════════════════════════════════════════════
  // RENDER: Name prompt
  // ═══════════════════════════════════════════════════════════
  if (needsName) {
    return (
      <div className="min-h-screen bg-dark-300 flex items-center justify-center px-4">
        <div className="card max-w-sm w-full text-center">
          <Users className="w-10 h-10 text-primary-500 mx-auto mb-4" />
          <h2 className="font-display font-bold text-xl text-white mb-2">Как тебя зовут?</h2>
          <p className="text-gray-500 text-sm mb-5">Это имя увидят остальные в лобби</p>
          <input
            autoFocus
            placeholder="Введи ник"
            maxLength={20}
            onKeyDown={e => e.key === 'Enter' && confirmName((e.target as HTMLInputElement).value)}
            className="w-full bg-dark-100 border border-dark-50 rounded-xl px-4 py-3 text-white text-center placeholder-gray-600 focus:outline-none focus:border-primary-500 mb-4"
          />
          <button
            onClick={() => {
              const input = document.querySelector('input') as HTMLInputElement;
              confirmName(input?.value ?? '');
            }}
            className="btn-primary w-full"
          >
            Продолжить
          </button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // RENDER: No lobby — create form
  // ═══════════════════════════════════════════════════════════
  if (!lobbyId) {
    return (
      <div className="min-h-screen bg-dark-300 flex items-center justify-center px-4">
        <div className="card max-w-md w-full">
          <div className="text-center mb-6">
            <Swords className="w-10 h-10 text-primary-500 mx-auto mb-3" />
            <h2 className="font-display font-bold text-2xl text-white mb-1">Быстрое лобби</h2>
            <p className="text-gray-500 text-sm">Создай лобби и поделись ссылкой — без регистрации</p>
          </div>

          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Формат</p>
          <div className="grid grid-cols-3 gap-2 mb-6">
            {(['1v1', '2v2', '5v5'] as Format[]).map(f => (
              <button key={f} onClick={() => setCreateFormat(f)}
                className={`py-3 rounded-xl border font-semibold text-sm transition-all ${
                  createFormat === f ? 'bg-primary-500/20 text-primary-400 border-primary-500/50' : 'bg-dark-100 border-dark-50 text-gray-400 hover:text-white'
                }`}>
                {f}
              </button>
            ))}
          </div>

          <button onClick={createLobby} disabled={creating} className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50">
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Создать лобби
          </button>
        </div>
      </div>
    );
  }

  if (loading || !lobby) return (
    <div className="min-h-screen bg-dark-300 flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
    </div>
  );

  // ═══════════════════════════════════════════════════════════
  // RENDER: Lobby itself
  // ═══════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-dark-300 text-white">
      <header className="bg-dark-100/95 backdrop-blur-md border-b border-dark-50 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={leaveLobby} className="text-gray-400 hover:text-white flex items-center gap-1.5 text-sm transition-colors">
              <ArrowLeft className="w-4 h-4" /> Выйти
            </button>
            <div className="h-5 w-px bg-dark-50" />
            <div className="flex items-center gap-2">
              <Swords className="w-4 h-4 text-primary-500" />
              <span className="font-display font-bold">Быстрое лобби</span>
              <span className="px-2 py-0.5 rounded-full bg-primary-500/20 text-primary-400 text-xs font-semibold">{format}</span>
            </div>
          </div>
          <button onClick={copyLink} className="flex items-center gap-1.5 text-xs px-3 py-2 bg-dark-100 border border-dark-50 rounded-xl text-gray-300 hover:text-white transition-colors">
            {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Link2 className="w-3.5 h-3.5" />}
            {copied ? 'Скопировано' : 'Скопировать ссылку'}
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6 grid lg:grid-cols-[1fr_340px] gap-6">
        <div className="space-y-5">

          {error && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          {/* PHASE: lobby — собираются игроки */}
          {lobby.phase === 'lobby' && (
            <section className="card">
              <h2 className="font-display font-bold text-lg mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-primary-500" /> Игроки в лобби
              </h2>
              <div className="grid sm:grid-cols-2 gap-4 mb-5">
                {[
                  { team: 'team1' as const, name: lobby.team1_name, list: team1Players, color: 'text-primary-400' },
                  { team: 'team2' as const, name: lobby.team2_name, list: team2Players, color: 'text-blue-400' },
                ].map(col => (
                  <div key={col.team} className="bg-dark-100 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className={`font-semibold text-sm ${col.color}`}>{col.name}</span>
                      <span className="text-gray-600 text-xs">{col.list.length}</span>
                    </div>
                    {col.list.length === 0 ? (
                      <p className="text-gray-600 text-sm mb-3">Никого нет</p>
                    ) : (
                      <ul className="space-y-1.5 mb-3">
                        {col.list.map(p => (
                          <li key={p.session_id} className="flex items-center gap-2 text-sm">
                            {p.is_host && <Crown className="w-3 h-3 text-yellow-400 shrink-0" />}
                            <span className={p.session_id === sessionId ? 'text-white font-medium' : 'text-gray-300'}>
                              {p.username}{p.session_id === sessionId ? ' (ты)' : ''}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {myTeam !== col.team && (
                      <button onClick={() => joinTeam(col.team)}
                        className={`w-full text-xs py-2 rounded-lg transition-colors ${
                          col.team === 'team1' ? 'bg-primary-500/10 hover:bg-primary-500/20 text-primary-400' : 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-400'
                        }`}>
                        Войти за {col.name}
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {isHost && (
                <button onClick={startReadyPhase} disabled={players.length < 2} className="btn-primary w-full disabled:opacity-40">
                  Начать подтверждение готовности
                </button>
              )}
            </section>
          )}

          {/* PHASE: ready */}
          {lobby.phase === 'ready' && (
            <section className="card">
              <h2 className="font-display font-bold text-lg mb-4 flex items-center gap-2">
                <Check className="w-5 h-5 text-primary-500" /> Готовность
              </h2>
              <div className="grid sm:grid-cols-2 gap-4 mb-5">
                {[team1Players, team2Players].map((list, i) => (
                  <div key={i} className="bg-dark-100 rounded-xl p-4">
                    <p className={`font-semibold text-sm mb-3 ${i === 0 ? 'text-primary-400' : 'text-blue-400'}`}>
                      {i === 0 ? lobby.team1_name : lobby.team2_name}
                    </p>
                    <ul className="space-y-1.5">
                      {list.map(p => (
                        <li key={p.session_id} className="flex items-center justify-between text-sm">
                          <span className="text-gray-300">{p.username}</span>
                          {p.is_ready ? <Check className="w-4 h-4 text-green-400" /> : <span className="text-gray-600 text-xs">не готов</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              {me && (
                <button onClick={toggleReady}
                  className={`w-full py-3 rounded-xl font-semibold transition-colors ${
                    me.is_ready ? 'bg-green-500/10 border border-green-500/30 text-green-400' : 'btn-primary'
                  }`}>
                  {me.is_ready ? 'Готов ✓ (нажми чтобы отменить)' : 'Я готов'}
                </button>
              )}
              {isHost && (
                <div className="mt-4 pt-4 border-t border-dark-50">
                  <p className="text-xs text-gray-500 mb-2">Капитаны (выбери кто будет банить карты):</p>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <select onChange={e => setCaptain('team1', e.target.value)} className="bg-dark-100 border border-dark-50 rounded-lg px-2 py-1.5 text-xs text-white">
                      <option value="">Капитан {lobby.team1_name}</option>
                      {team1Players.map(p => <option key={p.session_id} value={p.session_id}>{p.username}</option>)}
                    </select>
                    <select onChange={e => setCaptain('team2', e.target.value)} className="bg-dark-100 border border-dark-50 rounded-lg px-2 py-1.5 text-xs text-white">
                      <option value="">Капитан {lobby.team2_name}</option>
                      {team2Players.map(p => <option key={p.session_id} value={p.session_id}>{p.username}</option>)}
                    </select>
                  </div>
                  <button onClick={startVeto} disabled={!allReady} className="btn-primary w-full disabled:opacity-40">
                    Начать вето карт {!allReady && '(ждём готовности всех)'}
                  </button>
                </div>
              )}
            </section>
          )}

          {/* PHASE: veto */}
          {lobby.phase === 'veto' && (
            <section className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display font-bold text-lg flex items-center gap-2">
                  <Swords className="w-5 h-5 text-primary-500" /> Вето карт
                </h2>
                {currentStep && (
                  <span className="text-xs px-3 py-1 bg-dark-100 rounded-full text-gray-400">
                    Шаг {lobby.current_veto_step + 1} из {vetoOrder.length}
                  </span>
                )}
              </div>

              {currentStep && (
                <div className={`mb-4 flex items-center gap-2 px-4 py-2.5 rounded-xl border ${
                  isMyTurn ? 'bg-primary-500/10 border-primary-500/40 text-primary-300' : 'bg-dark-100 border-dark-50 text-gray-400'
                }`}>
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span className="text-sm font-medium">
                    {isMyTurn ? 'Твоя очередь — забань карту' : `Капитан команды ${currentStep === 'team1' ? lobby.team1_name : lobby.team2_name} банит карту...`}
                  </span>
                </div>
              )}

              <div className={`grid gap-3 ${allMaps.length <= 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3'}`}>
                {allMaps.map(m => {
                  const isBanned = bannedMapNames.includes(m.name);
                  const isFinal = lobby.final_map === m.name;
                  const canBan = !isBanned && !isFinal && isMyTurn && lobby.phase === 'veto';
                  return (
                    <button key={m.name} onClick={() => canBan && banMap(m.name)} disabled={!canBan || banning}
                      className={`relative rounded-xl overflow-hidden aspect-[4/3] border transition-all ${
                        isFinal ? 'ring-2 ring-yellow-400 border-yellow-400' :
                        isBanned ? 'opacity-30 grayscale border-dark-50' :
                        canBan ? 'border-primary-500/40 hover:scale-105 hover:ring-2 hover:ring-primary-500 cursor-pointer' : 'border-dark-50'
                      } bg-dark-100`}>
                      {m.image ? (
                        <img src={m.image} alt={m.display} className="absolute inset-0 w-full h-full object-cover" />
                      ) : null}
                      <div className="absolute inset-0 bg-gradient-to-t from-dark-400/90 via-dark-400/10 to-transparent" />
                      <div className="absolute bottom-0 inset-x-0 px-2 py-2 flex items-center justify-center">
                        <span className="font-display font-bold text-sm text-white drop-shadow-lg">{m.display}</span>
                      </div>
                      {isBanned && <div className="absolute inset-0 bg-red-900/60 flex items-center justify-center"><span className="text-xs font-bold text-white">БАН</span></div>}
                      {isFinal && <div className="absolute top-1.5 right-1.5 text-yellow-400 text-base drop-shadow">⚡</div>}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* PHASE: done */}
          {lobby.phase === 'done' && (
            <section className="card text-center py-8">
              <Swords className="w-10 h-10 text-yellow-400 mx-auto mb-3" />
              <p className="text-gray-400 text-sm mb-1">Финальная карта</p>
              <p className="font-display font-bold text-3xl text-white mb-5">{lobby.final_map}</p>

              {lobby.server_link ? (
                <a href={lobby.server_link} target="_blank" rel="noopener noreferrer"
                  className="btn-primary inline-flex items-center gap-2">
                  <ExternalLink className="w-4 h-4" /> Перейти на сервер
                </a>
              ) : isHost ? (
                <div className="max-w-sm mx-auto">
                  <p className="text-gray-500 text-xs mb-2">Вставь ссылку на сервер Cybershoke:</p>
                  <div className="flex gap-2">
                    <input id="server-link-input" placeholder="https://cybershoke.net/..."
                      className="flex-1 bg-dark-100 border border-dark-50 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-primary-500" />
                    <button onClick={() => {
                      const input = document.getElementById('server-link-input') as HTMLInputElement;
                      if (input?.value) setServerLink(input.value);
                    }} className="btn-primary text-sm px-4">Сохранить</button>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500 text-sm">Хост ещё не добавил ссылку на сервер</p>
              )}
            </section>
          )}
        </div>

        {/* Chat */}
        <aside className="flex flex-col" style={{ height: 'calc(100vh - 120px)', position: 'sticky', top: '80px' }}>
          <div className="card flex flex-col h-full overflow-hidden p-0">
            <div className="flex items-center gap-2 p-4 border-b border-dark-50 shrink-0">
              <MessageSquare className="w-4 h-4 text-primary-500" />
              <span className="font-semibold text-sm">Чат лобби</span>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
              {messages.map(msg => {
                const isSystem = !msg.session_id;
                const isMe = msg.session_id === sessionId;
                return isSystem ? (
                  <div key={msg.id} className="text-center">
                    <span className="text-xs text-gray-500 bg-dark-100 px-2 py-0.5 rounded-full">{msg.message}</span>
                  </div>
                ) : (
                  <div key={msg.id} className={`flex flex-col gap-0.5 ${isMe ? 'items-end' : 'items-start'}`}>
                    <span className="text-xs font-medium text-gray-500">{msg.username}</span>
                    <div className={`px-3 py-2 rounded-xl text-sm max-w-[85%] break-words ${isMe ? 'bg-primary-500/20 text-white' : 'bg-dark-100 text-gray-200'}`}>
                      {msg.message}
                    </div>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>
            <div className="p-3 border-t border-dark-50 shrink-0 flex gap-2">
              <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
                placeholder="Сообщение..." maxLength={300}
                className="flex-1 bg-dark-100 border border-dark-50 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-primary-500" />
              <button onClick={sendMessage} className="bg-primary-500 hover:bg-primary-600 text-white rounded-lg px-3 py-2 transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

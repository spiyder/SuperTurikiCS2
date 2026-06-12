// src/pages/MatchLobbyPage.tsx
// Лобби матча: подтверждение готовности → вето карт → чат (командный + общий)
// Использует Supabase Realtime для синхронизации состояния

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft, CheckCircle2, Clock, Shield, Swords, MessageSquare,
  Users, ChevronRight, AlertCircle, Crown, Circle,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { User as SupabaseUser } from '@supabase/supabase-js';

// ─── Типы ────────────────────────────────────────────────────────────────────

type MapName = 'Mirage' | 'Dust2' | 'Overpass' | 'Anubis' | 'Inferno' | 'Ancient' | 'Nuke';

interface MapState {
  name: MapName;
  image: string;          // CSS-градиент как плейсхолдер
  accent: string;
  status: 'available' | 'banned' | 'picked' | 'decider';
  actionBy?: 'team1' | 'team2';
}

interface Player {
  id: string;
  name: string;
  ready: boolean;
  team: 'team1' | 'team2';
  isCaptain: boolean;
}

interface ChatMessage {
  id: string;
  author: string;
  text: string;
  team?: 'team1' | 'team2';
  timestamp: Date;
  channel: 'global' | 'team';
}

type LobbyPhase = 'readycheck' | 'veto' | 'playing';

interface VetoStep {
  team: 'team1' | 'team2';
  action: 'ban' | 'pick';
  label: string;
}

// Порядок вето BO1: ban ban ban ban ban pick → decider
const VETO_ORDER: VetoStep[] = [
  { team: 'team1', action: 'ban', label: 'Команда 1 банит' },
  { team: 'team2', action: 'ban', label: 'Команда 2 банит' },
  { team: 'team1', action: 'ban', label: 'Команда 1 банит' },
  { team: 'team2', action: 'ban', label: 'Команда 2 банит' },
  { team: 'team1', action: 'ban', label: 'Команда 1 банит' },
  { team: 'team2', action: 'pick', label: 'Команда 2 пикает' },
  // оставшаяся → decider
];

const INITIAL_MAPS: MapState[] = [
  { name: 'Mirage',   image: 'linear-gradient(135deg,#c2a46b,#8b6914)', accent: '#c2a46b', status: 'available' },
  { name: 'Dust2',    image: 'linear-gradient(135deg,#d4a96a,#9c6a2e)', accent: '#d4a96a', status: 'available' },
  { name: 'Overpass', image: 'linear-gradient(135deg,#6b9ec2,#2e6e9c)', accent: '#6b9ec2', status: 'available' },
  { name: 'Anubis',   image: 'linear-gradient(135deg,#c2956b,#8b5a14)', accent: '#c2956b', status: 'available' },
  { name: 'Inferno',  image: 'linear-gradient(135deg,#c27a3a,#8b4a0a)', accent: '#c27a3a', status: 'available' },
  { name: 'Ancient',  image: 'linear-gradient(135deg,#7ec286,#2e8b40)', accent: '#7ec286', status: 'available' },
  { name: 'Nuke',     image: 'linear-gradient(135deg,#8bc2c2,#2e8b8b)', accent: '#8bc2c2', status: 'available' },
];

// Мок-игроки (в реальном проекте — из Supabase по match_id)
const MOCK_PLAYERS: Player[] = [
  { id: 'p1', name: 'SnipeKing',  ready: false, team: 'team1', isCaptain: true  },
  { id: 'p2', name: 'FlashMaster',ready: false, team: 'team1', isCaptain: false },
  { id: 'p3', name: 'AimBot9000', ready: false, team: 'team1', isCaptain: false },
  { id: 'p4', name: 'RushBob',    ready: false, team: 'team1', isCaptain: false },
  { id: 'p5', name: 'NadeKing',   ready: false, team: 'team1', isCaptain: false },
  { id: 'p6', name: 'ProGamer',   ready: false, team: 'team2', isCaptain: true  },
  { id: 'p7', name: 'Clutchero',  ready: false, team: 'team2', isCaptain: false },
  { id: 'p8', name: 'EcoRound',   ready: false, team: 'team2', isCaptain: false },
  { id: 'p9', name: 'UtilityGod', ready: false, team: 'team2', isCaptain: false },
  { id: 'p10',name: 'SilentKill', ready: false, team: 'team2', isCaptain: false },
];

// ─── Компонент ───────────────────────────────────────────────────────────────

interface Props {
  matchId?: string;
  tournamentName: string;
  user: SupabaseUser | null;
  userTeam?: 'team1' | 'team2';   // в реальном проекте берётся из БД
  onBack: () => void;
}

export function MatchLobbyPage({ matchId = 'demo', tournamentName, user, userTeam = 'team1', onBack }: Props) {
  // ── Фаза
  const [phase, setPhase] = useState<LobbyPhase>('readycheck');

  // ── Ready-check
  const [players, setPlayers] = useState<Player[]>(MOCK_PLAYERS);
  const [myReady, setMyReady] = useState(false);
  const [readyTimer, setReadyTimer] = useState(60);

  // ── Veto
  const [maps, setMaps] = useState<MapState[]>(INITIAL_MAPS);
  const [vetoStep, setVetoStep] = useState(0);
  const [vetoTimer, setVetoTimer] = useState(30);
  const [vetoAnimMap, setVetoAnimMap] = useState<string | null>(null);

  // ── Chat
  const [chatChannel, setChatChannel] = useState<'global' | 'team'>('global');
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: '1', author: 'Система', text: 'Лобби создано. Все игроки должны подтвердить готовность.', timestamp: new Date(), channel: 'global' },
  ]);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  const myName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Игрок';

  // ── Таймер ready-check
  useEffect(() => {
    if (phase !== 'readycheck') return;
    if (readyTimer <= 0) {
      addSystemMessage('Время вышло. Не все игроки подтвердили готовность.');
      return;
    }
    const t = setTimeout(() => setReadyTimer(v => v - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, readyTimer]);

  // ── Таймер вето
  useEffect(() => {
    if (phase !== 'veto' || vetoStep >= VETO_ORDER.length) return;
    if (vetoTimer <= 0) {
      // Авто-бан/пик случайной карты
      autoVetoAction();
      return;
    }
    const t = setTimeout(() => setVetoTimer(v => v - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, vetoStep, vetoTimer]);

  // ── Авто-скролл чата
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Демо: боты постепенно становятся готовы
  useEffect(() => {
    if (phase !== 'readycheck') return;
    const delays = [3000, 5000, 8000, 10000, 12000, 14000, 17000, 20000, 22000];
    const timers = delays.map((delay, i) =>
      setTimeout(() => {
        setPlayers(prev => prev.map((p, idx) => idx === i ? { ...p, ready: true } : p));
      }, delay)
    );
    return () => timers.forEach(clearTimeout);
  }, [phase]);

  // ── Helpers
  const addSystemMessage = useCallback((text: string) => {
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      author: 'Система',
      text,
      timestamp: new Date(),
      channel: 'global',
    }]);
  }, []);

  const autoVetoAction = useCallback(() => {
    setMaps(prev => {
      const available = prev.filter(m => m.status === 'available');
      if (!available.length) return prev;
      const chosen = available[Math.floor(Math.random() * available.length)];
      const step = VETO_ORDER[vetoStep];
      return prev.map(m => m.name === chosen.name
        ? { ...m, status: step?.action === 'pick' ? 'picked' : 'banned', actionBy: step?.team }
        : m
      );
    });
    setVetoStep(v => v + 1);
    setVetoTimer(30);
  }, [vetoStep]);

  // ── Confirm ready
  const handleReady = () => {
    setMyReady(true);
    setPlayers(prev => prev.map(p => p.id === 'p1' ? { ...p, ready: true } : p));
    addSystemMessage(`${myName} подтвердил(а) готовность.`);

    // Если все готовы — переход к вето
    const allReady = players.every(p => p.id === 'p1' ? true : p.ready);
    if (allReady) {
      setTimeout(() => {
        setPhase('veto');
        addSystemMessage('Все игроки готовы! Начинается вето карт.');
      }, 800);
    }
  };

  // Проверяем готовность после обновления игроков
  useEffect(() => {
    if (!myReady) return;
    if (players.every(p => p.ready) && phase === 'readycheck') {
      setTimeout(() => {
        setPhase('veto');
        addSystemMessage('Все игроки готовы! Начинается вето карт.');
      }, 800);
    }
  }, [players, myReady, phase]);

  // ── Veto action
  const handleVetoMap = (mapName: MapName) => {
    if (phase !== 'veto') return;
    if (vetoStep >= VETO_ORDER.length) return;
    const step = VETO_ORDER[vetoStep];
    // В демо — оба капитана управляются юзером
    const action = step.action;
    setVetoAnimMap(mapName);
    setTimeout(() => setVetoAnimMap(null), 400);

    setMaps(prev => prev.map(m =>
      m.name === mapName ? { ...m, status: action === 'pick' ? 'picked' : 'banned', actionBy: step.team } : m
    ));

    const teamLabel = step.team === 'team1' ? 'Команда 1' : 'Команда 2';
    addSystemMessage(`${teamLabel} ${action === 'ban' ? 'забанила' : 'выбрала'} карту ${mapName}.`);

    const nextStep = vetoStep + 1;
    setVetoStep(nextStep);
    setVetoTimer(30);

    // После всех шагов — оставшаяся карта = decider
    if (nextStep >= VETO_ORDER.length) {
      setTimeout(() => {
        setMaps(prev => {
          const updated = prev.map(m =>
            m.status === 'available' ? { ...m, status: 'decider' as const } : m
          );
          const decider = updated.find(m => m.status === 'decider');
          if (decider) addSystemMessage(`Карта-децайдер: ${decider.name}!`);
          return updated;
        });
        setTimeout(() => {
          setPhase('playing');
          addSystemMessage('Вето завершено. Удачи в матче!');
        }, 1500);
      }, 500);
    }
  };

  // ── Send message
  const sendMessage = () => {
    if (!chatInput.trim()) return;
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      author: myName,
      text: chatInput.trim(),
      team: userTeam,
      timestamp: new Date(),
      channel: chatChannel,
    }]);
    setChatInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  // ── Derived
  const team1 = players.filter(p => p.team === 'team1');
  const team2 = players.filter(p => p.team === 'team2');
  const readyCount = players.filter(p => p.ready).length;
  const currentVetoStep = VETO_ORDER[vetoStep];
  const pickedMaps = maps.filter(m => m.status === 'picked' || m.status === 'decider');
  const visibleMessages = messages.filter(m => m.channel === chatChannel || m.author === 'Система');

  const mapStatusLabel = (m: MapState) => {
    if (m.status === 'banned')  return m.actionBy === 'team1' ? 'Бан К1' : 'Бан К2';
    if (m.status === 'picked')  return m.actionBy === 'team1' ? 'Пик К1' : 'Пик К2';
    if (m.status === 'decider') return 'Децайдер';
    return '';
  };

  return (
    <div className="min-h-screen bg-dark-300 text-white">
      {/* Header */}
      <header className="bg-dark-100/95 backdrop-blur-md border-b border-dark-50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="text-gray-400 hover:text-white transition-colors flex items-center gap-1 text-sm">
              <ArrowLeft className="w-4 h-4" /> Назад
            </button>
            <div className="h-5 w-px bg-dark-50" />
            <span className="font-display font-bold text-primary-500 truncate">{tournamentName}</span>
          </div>

          <div className="flex items-center gap-3">
            {/* Фаза */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${
              phase === 'readycheck' ? 'bg-yellow-500/20 text-yellow-400' :
              phase === 'veto'       ? 'bg-primary-500/20 text-primary-400' :
                                       'bg-green-500/20 text-green-400'
            }`}>
              {phase === 'readycheck' && <><Clock className="w-3 h-3" /> Подтверждение готовности</>}
              {phase === 'veto'       && <><Swords className="w-3 h-3" /> Вето карт</>}
              {phase === 'playing'    && <><CheckCircle2 className="w-3 h-3" /> Матч идёт</>}
            </div>
            <span className="text-gray-500 text-xs hidden sm:block">#{matchId}</span>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 grid lg:grid-cols-[1fr_360px] gap-6">

        {/* ── Левая колонка ── */}
        <div className="space-y-6">

          {/* ══ Ready-check ══ */}
          {phase === 'readycheck' && (
            <section className="card">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-display font-bold text-xl flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-primary-500" /> Подтверждение готовности
                </h2>
                <div className={`font-display text-2xl font-bold tabular-nums ${readyTimer <= 10 ? 'text-red-400 animate-pulse' : 'text-primary-500'}`}>
                  {readyTimer}с
                </div>
              </div>

              <div className="mb-6 h-2 bg-dark-50 rounded-full overflow-hidden">
                <div className="h-full bg-primary-500 rounded-full transition-all duration-300"
                     style={{ width: `${(readyCount / players.length) * 100}%` }} />
              </div>
              <p className="text-gray-400 text-sm mb-6 text-center">{readyCount} / {players.length} игроков готовы</p>

              <div className="grid sm:grid-cols-2 gap-4 mb-6">
                {[{ label: 'Команда 1', list: team1, side: 'team1' as const },
                  { label: 'Команда 2', list: team2, side: 'team2' as const }].map(({ label, list, side }) => (
                  <div key={side} className="bg-dark-100 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Shield className={`w-4 h-4 ${side === 'team1' ? 'text-primary-500' : 'text-blue-400'}`} />
                      <span className="font-semibold text-sm">{label}</span>
                    </div>
                    <ul className="space-y-2">
                      {list.map(p => (
                        <li key={p.id} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {p.isCaptain && <Crown className="w-3 h-3 text-yellow-400 shrink-0" />}
                            <span className="text-sm text-gray-300">{p.name}</span>
                          </div>
                          {p.ready
                            ? <CheckCircle2 className="w-4 h-4 text-green-400" />
                            : <Circle className="w-4 h-4 text-gray-600 animate-pulse" />
                          }
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              {!myReady ? (
                <button onClick={handleReady}
                  className="w-full btn-primary text-lg py-4 animate-pulse-glow flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-5 h-5" /> Я готов
                </button>
              ) : (
                <div className="w-full py-4 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400 font-semibold text-center flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-5 h-5" /> Готовность подтверждена — ждём остальных
                </div>
              )}
            </section>
          )}

          {/* ══ Veto ══ */}
          {(phase === 'veto' || phase === 'playing') && (
            <section className="card">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-display font-bold text-xl flex items-center gap-2">
                  <Swords className="w-5 h-5 text-primary-500" /> Маппул
                </h2>
                {phase === 'veto' && currentVetoStep && (
                  <div className={`font-display text-2xl font-bold tabular-nums ${vetoTimer <= 10 ? 'text-red-400 animate-pulse' : 'text-primary-500'}`}>
                    {vetoTimer}с
                  </div>
                )}
              </div>

              {/* Шаги вето */}
              {phase === 'veto' && currentVetoStep && (
                <div className="mb-5 flex items-center gap-2 px-4 py-2.5 bg-primary-500/10 border border-primary-500/30 rounded-xl">
                  <AlertCircle className="w-4 h-4 text-primary-400 shrink-0" />
                  <span className="text-primary-300 text-sm font-medium">
                    {currentVetoStep.label} —{' '}
                    {currentVetoStep.action === 'ban' ? 'кликни на карту чтобы забанить' : 'кликни на карту чтобы выбрать'}
                  </span>
                </div>
              )}

              {/* Прогресс шагов */}
              {phase === 'veto' && (
                <div className="flex gap-1.5 mb-5 flex-wrap">
                  {VETO_ORDER.map((s, i) => (
                    <div key={i} className={`h-1.5 flex-1 min-w-[20px] rounded-full transition-all ${
                      i < vetoStep ? (s.action === 'ban' ? 'bg-red-500' : 'bg-green-500') :
                      i === vetoStep ? 'bg-primary-500 animate-pulse' : 'bg-dark-50'
                    }`} />
                  ))}
                </div>
              )}

              {/* Карты */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {maps.map(m => {
                  const isAvailable = m.status === 'available';
                  const canAct = phase === 'veto' && isAvailable && vetoStep < VETO_ORDER.length;
                  return (
                    <button
                      key={m.name}
                      onClick={() => canAct && handleVetoMap(m.name)}
                      disabled={!canAct}
                      className={`relative rounded-xl overflow-hidden aspect-[4/3] transition-all duration-200 focus:outline-none
                        ${canAct ? 'hover:scale-105 hover:ring-2 hover:ring-primary-500 cursor-pointer' : 'cursor-default'}
                        ${vetoAnimMap === m.name ? 'scale-95 opacity-50' : ''}
                        ${m.status === 'banned' ? 'opacity-30 grayscale' : ''}
                        ${m.status === 'picked' ? 'ring-2 ring-green-500' : ''}
                        ${m.status === 'decider' ? 'ring-2 ring-yellow-400 animate-pulse-glow' : ''}
                      `}
                    >
                      {/* Фон карты */}
                      <div className="absolute inset-0" style={{ background: m.image }} />
                      <div className="absolute inset-0 bg-dark-400/40" />

                      {/* Название */}
                      <div className="absolute bottom-0 inset-x-0 px-2 py-2 bg-gradient-to-t from-dark-400/90 to-transparent">
                        <p className="font-display text-xs sm:text-sm font-bold text-white leading-tight">{m.name}</p>
                      </div>

                      {/* Статус */}
                      {m.status !== 'available' && (
                        <div className={`absolute inset-0 flex flex-col items-center justify-center gap-1
                          ${m.status === 'banned' ? 'bg-red-900/60' :
                            m.status === 'picked' ? 'bg-green-900/40' :
                            'bg-yellow-900/40'}`}>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full
                            ${m.status === 'banned' ? 'bg-red-500/80 text-white' :
                              m.status === 'picked' ? 'bg-green-500/80 text-white' :
                              'bg-yellow-400/80 text-black'}`}>
                            {mapStatusLabel(m)}
                          </span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Итог вето */}
              {pickedMaps.length > 0 && (
                <div className="mt-5 pt-4 border-t border-dark-50">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Карты матча</p>
                  <div className="flex flex-wrap gap-2">
                    {pickedMaps.map(m => (
                      <span key={m.name}
                        className={`px-3 py-1 rounded-full text-sm font-semibold
                          ${m.status === 'decider' ? 'bg-yellow-400/20 text-yellow-300 border border-yellow-400/40' : 'bg-green-500/20 text-green-300 border border-green-500/40'}`}>
                        {m.name} {m.status === 'decider' ? '⚡' : ''}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* ══ Playing banner ══ */}
          {phase === 'playing' && (
            <div className="card border-green-500/40 bg-green-500/5 flex items-center gap-4">
              <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <p className="font-display font-bold text-green-400 text-lg">Матч начался!</p>
                <p className="text-gray-400 text-sm">Подключитесь к серверу CS2 и удачи в игре.</p>
              </div>
            </div>
          )}
        </div>

        {/* ── Правая колонка — Чат ── */}
        <aside className="flex flex-col" style={{ height: 'calc(100vh - 120px)', position: 'sticky', top: '80px' }}>
          <div className="card flex flex-col h-full overflow-hidden p-0">
            {/* Chat header */}
            <div className="flex items-center justify-between p-4 border-b border-dark-50 shrink-0">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-primary-500" />
                <span className="font-semibold text-sm">Чат</span>
              </div>
              <div className="flex bg-dark-100 rounded-lg p-0.5 gap-0.5">
                {(['global', 'team'] as const).map(ch => (
                  <button key={ch} onClick={() => setChatChannel(ch)}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                      chatChannel === ch ? 'bg-primary-500 text-white' : 'text-gray-400 hover:text-white'
                    }`}>
                    {ch === 'global' ? <span className="flex items-center gap-1"><Users className="w-3 h-3" /> Общий</span>
                                     : <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> Команда</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
              {visibleMessages.map(msg => {
                const isSystem = msg.author === 'Система';
                const isMe = msg.author === myName;
                return (
                  <div key={msg.id} className={`${isSystem ? 'text-center' : ''}`}>
                    {isSystem ? (
                      <span className="text-xs text-gray-500 bg-dark-100 px-2 py-0.5 rounded-full">{msg.text}</span>
                    ) : (
                      <div className={`flex flex-col gap-0.5 ${isMe ? 'items-end' : 'items-start'}`}>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-xs font-medium ${
                            msg.team === 'team1' ? 'text-primary-400' : 'text-blue-400'
                          }`}>{msg.author}</span>
                          {msg.channel === 'team' && (
                            <span className="text-[10px] text-gray-600">[команда]</span>
                          )}
                        </div>
                        <div className={`px-3 py-2 rounded-xl text-sm max-w-[85%] break-words ${
                          isMe ? 'bg-primary-500/20 text-white' : 'bg-dark-100 text-gray-200'
                        }`}>
                          {msg.text}
                        </div>
                        <span className="text-[10px] text-gray-600">
                          {msg.timestamp.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 border-t border-dark-50 shrink-0">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={chatChannel === 'global' ? 'Общий чат…' : 'Только команда…'}
                  className="flex-1 bg-dark-100 border border-dark-50 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-primary-500 transition-colors"
                  maxLength={300}
                />
                <button onClick={sendMessage}
                  className="bg-primary-500 hover:bg-primary-600 text-white rounded-lg px-3 py-2 transition-colors">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[10px] text-gray-600 mt-1.5">
                {chatChannel === 'team' ? '🔒 Видно только вашей команде' : '🌐 Видно всем участникам'}
              </p>
            </div>
          </div>
        </aside>

      </div>
    </div>
  );
}

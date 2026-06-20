import { useState, useEffect } from 'react';
import {
  ArrowLeft, Trophy, Calendar, Users, Award, CheckCircle,
  AlertCircle, ChevronDown, ChevronUp, Shield, Gamepad2,
  Clock, Check, X, Crown, UserCheck, Swords, GitBranch,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { MatchLobbyPage } from './MatchLobbyPage';
import { BracketPage } from './BracketPage';
import type { User as SupabaseUser } from '@supabase/supabase-js';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Tournament {
  id: number;
  name: string;
  date: string;
  prize: string;
  slots_taken: number;
  slots_total: number;
  status: string;
  format?: string;
  bracket_generated?: boolean;
}

interface TeamMember {
  id: string;
  username: string;
  avatar_url: string | null;
  role: string;
}

interface Team {
  id: number;
  name: string;
  tag: string;
  captain_id: string;
  avatar_url: string | null;
  members: TeamMember[];
}

interface TournamentRegistration {
  id: number;
  tournament_id: number;
  team_name: string;
  captain_username: string;
  registered_at: string;
}

interface TournamentMatch {
  id: number;
  tournament_id: number;
  round: number;
  match_index: number;
  team1_name: string | null;
  team2_name: string | null;
  team1_score: number;
  team2_score: number;
  winner_name: string | null;
  status: string;
  scheduled_at: string | null;
}

interface TournamentPageProps {
  tournament: Tournament;
  user: SupabaseUser | null;
  onBack: () => void;
  onOpenLogin: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const RULES = [
  'Турнир проводится в формате Single Elimination.',
  'Каждая команда должна состоять ровно из 5 игроков (замены не допускаются).',
  'Игроки обязаны иметь верифицированный Steam аккаунт с не менее чем 100 часами в CS2.',
  'Использование читов, багоюза или запрещённого ПО ведёт к немедленной дисквалификации.',
  'Матчи проводятся на официальных серверах платформы. Сервер назначается автоматически.',
  'В случае технических неполадок команда обязана уведомить администратора в течение 5 минут.',
  'Расписание матчей публикуется за 24 часа. Опоздание более 10 минут = техническое поражение.',
  'Все спорные ситуации решаются администрацией платформы. Решение администратора окончательно.',
];

const PRIZE_DISTRIBUTION = [
  { place: '1 место', prize_pct: '50%', icon: '🥇' },
  { place: '2 место', prize_pct: '30%', icon: '🥈' },
  { place: '3–4 место', prize_pct: '10% каждому', icon: '🥉' },
];

// ─── Bracket helpers ──────────────────────────────────────────────────────────
function getRoundName(round: number, totalRounds: number): string {
  if (round === 1) return 'Финал';
  if (round === 2) return 'Полуфинал';
  if (round === 4) return 'Четвертьфинал';
  if (round === 8) return '1/8 финала';
  if (round === 16) return '1/16 финала';
  return `Раунд ${Math.log2(round) + 1}`;
}

function getStatusColor(status: string) {
  if (status === 'finished') return 'text-gray-500';
  if (status === 'live') return 'text-green-400';
  return 'text-gray-400';
}

// ─── Match card ───────────────────────────────────────────────────────────────
function MatchCard({ match }: { match: TournamentMatch }) {
  const t1wins = match.winner_name === match.team1_name;
  const t2wins = match.winner_name === match.team2_name;
  const isFinished = match.status === 'finished';
  const isLive = match.status === 'live';
  const isBye = !match.team1_name || !match.team2_name;

  return (
    <div className={`rounded-xl border overflow-hidden transition-all ${
      isLive ? 'border-green-500/50 shadow-lg shadow-green-500/10' :
      isFinished ? 'border-dark-50/50' : 'border-dark-50'
    } bg-dark-200`}>
      {isLive && (
        <div className="bg-green-500/20 px-3 py-1 flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-green-400 text-xs font-medium">LIVE</span>
        </div>
      )}
      <div className="p-3 space-y-1.5">
        {/* Team 1 */}
        <div className={`flex items-center justify-between gap-2 py-1.5 px-2 rounded-lg ${
          t1wins ? 'bg-primary-500/10' : isFinished && !t1wins ? 'opacity-40' : ''
        }`}>
          <span className={`text-sm font-medium truncate flex-1 ${
            t1wins ? 'text-white' : 'text-gray-300'
          }`}>
            {match.team1_name ?? <span className="text-gray-600 italic">TBD</span>}
          </span>
          {isFinished || isLive ? (
            <span className={`text-sm font-bold w-5 text-center ${t1wins ? 'text-primary-400' : 'text-gray-500'}`}>
              {match.team1_score}
            </span>
          ) : null}
          {t1wins && <Check className="w-3.5 h-3.5 text-primary-400 flex-shrink-0" />}
        </div>

        <div className="border-t border-dark-50/50" />

        {/* Team 2 */}
        <div className={`flex items-center justify-between gap-2 py-1.5 px-2 rounded-lg ${
          t2wins ? 'bg-primary-500/10' : isFinished && !t2wins ? 'opacity-40' : ''
        }`}>
          <span className={`text-sm font-medium truncate flex-1 ${
            t2wins ? 'text-white' : 'text-gray-300'
          }`}>
            {match.team2_name ?? <span className="text-gray-600 italic">TBD</span>}
          </span>
          {isFinished || isLive ? (
            <span className={`text-sm font-bold w-5 text-center ${t2wins ? 'text-primary-400' : 'text-gray-500'}`}>
              {match.team2_score}
            </span>
          ) : null}
          {t2wins && <Check className="w-3.5 h-3.5 text-primary-400 flex-shrink-0" />}
        </div>
      </div>
    </div>
  );
}

// ─── Bracket view ─────────────────────────────────────────────────────────────
function BracketView({ matches, totalSlots }: { matches: TournamentMatch[]; totalSlots: number }) {
  if (matches.length === 0) {
    return (
      <div className="text-center py-16">
        <GitBranch className="w-12 h-12 text-gray-700 mx-auto mb-3" />
        <p className="text-gray-500 font-medium">Сетка ещё не сформирована</p>
        <p className="text-gray-600 text-sm mt-1">Появится после заполнения всех слотов и старта турнира</p>
      </div>
    );
  }

  // Group matches by round descending (largest round number = earliest round)
  const rounds = Array.from(new Set(matches.map(m => m.round))).sort((a, b) => b - a);

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-4 min-w-max">
        {rounds.map(round => {
          const roundMatches = matches.filter(m => m.round === round).sort((a, b) => a.match_index - b.match_index);
          return (
            <div key={round} className="flex flex-col gap-3" style={{ width: 200 }}>
              <div className="text-center">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  {getRoundName(round, rounds.length)}
                </span>
              </div>
              <div className="flex flex-col justify-around flex-1 gap-6">
                {roundMatches.map(match => (
                  <MatchCard key={match.id} match={match} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Registration Modal ───────────────────────────────────────────────────────
function RegModal({
  tournament, user, myTeam, onClose, onSuccess,
}: {
  tournament: Tournament;
  user: SupabaseUser;
  myTeam: Team | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [step, setStep] = useState<'form' | 'done'>('form');
  const [gameNick, setGameNick] = useState('');
  const [steamId, setSteamId] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const canRegister = !!myTeam && myTeam.members.length === 5 && gameNick.trim() && agreed;

  const handleRegister = async () => {
    if (!myTeam || !canRegister) return;
    setLoading(true);
    setError('');

    const { data: profile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .single();

    const { error: insertError } = await supabase
      .from('tournament_registrations')
      .insert({
        tournament_id: tournament.id,
        team_name: myTeam.name,
        captain_username: profile?.username ?? 'Captain',
        captain_id: user.id,
        game_nick: gameNick.trim(),
        steam_id: steamId.trim() || null,
      });

    if (insertError) {
      if (insertError.code === '23505') setError('Твоя команда уже зарегистрирована на этот турнир');
      else setError('Ошибка регистрации. Попробуй ещё раз.');
      setLoading(false);
      return;
    }

    await supabase.rpc('increment_slots', { tournament_id: tournament.id });
    setLoading(false);
    setStep('done');
    setTimeout(onSuccess, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-dark-100 border border-dark-50 rounded-2xl shadow-2xl shadow-black/50 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-dark-50 sticky top-0 bg-dark-100 z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg flex items-center justify-center">
              <Trophy className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-display font-bold text-white">Регистрация</h2>
              <p className="text-gray-500 text-xs truncate max-w-[200px]">{tournament.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {step === 'done' ? (
            <div className="text-center py-10">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-400" />
              </div>
              <h3 className="font-display font-bold text-xl text-white mb-2">Готово!</h3>
              <p className="text-gray-400">Ваша команда зарегистрирована на турнир.</p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Warnings */}
              {!myTeam && (
                <div className="flex items-start gap-3 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                  <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                  <p className="text-yellow-200/80 text-sm">
                    У тебя нет команды. Перейди в <strong className="text-yellow-300">Профиль → Моя команда</strong>, создай команду и добавь 4 игрока.
                  </p>
                </div>
              )}
              {myTeam && myTeam.members.length !== 5 && (
                <div className="flex items-start gap-3 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                  <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                  <p className="text-yellow-200/80 text-sm">
                    В команде <strong className="text-yellow-300">{myTeam.members.length}/5 игроков</strong>. Добавь недостающих в разделе <strong className="text-yellow-300">Моя команда</strong>.
                  </p>
                </div>
              )}

              {/* Team preview */}
              {myTeam && (
                <div className="bg-dark-200 rounded-xl p-4 border border-dark-50">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl overflow-hidden bg-dark-300 border border-dark-50 flex items-center justify-center flex-shrink-0">
                      {myTeam.avatar_url
                        ? <img src={myTeam.avatar_url} alt="" className="w-full h-full object-cover" />
                        : <Crown className="w-5 h-5 text-primary-400" />
                      }
                    </div>
                    <div>
                      <div className="text-white font-bold">{myTeam.name}</div>
                      <div className="text-gray-500 text-xs">[{myTeam.tag}] · {myTeam.members.length}/5 игроков</div>
                    </div>
                    {myTeam.members.length === 5 && <UserCheck className="w-5 h-5 text-green-400 ml-auto" />}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {myTeam.members.map((m) => (
                      <div key={m.id} className="flex flex-col items-center gap-1" title={m.username}>
                        <div className="w-9 h-9 rounded-lg bg-dark-300 border border-dark-50 overflow-hidden flex items-center justify-center">
                          {m.avatar_url
                            ? <img src={m.avatar_url} alt="" className="w-full h-full object-cover" />
                            : <Gamepad2 className="w-4 h-4 text-gray-600" />
                          }
                        </div>
                        <span className="text-gray-500 text-xs max-w-[44px] truncate text-center">{m.username}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Game nick */}
              <div>
                <label className="block text-gray-400 text-sm mb-2">Ник в CS2 <span className="text-red-400">*</span></label>
                <input
                  value={gameNick} onChange={e => setGameNick(e.target.value)}
                  placeholder="Твой ник в игре"
                  className="w-full bg-dark-200 border border-dark-50 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-primary-500 transition-colors"
                />
              </div>

              {/* Steam ID */}
              <div>
                <label className="block text-gray-400 text-sm mb-2">Steam ID <span className="text-gray-600 text-xs">(необязательно)</span></label>
                <input
                  value={steamId} onChange={e => setSteamId(e.target.value)}
                  placeholder="76561198XXXXXXXXX"
                  className="w-full bg-dark-200 border border-dark-50 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-primary-500 transition-colors"
                />
              </div>

              {/* Rules */}
              <div className="border border-dark-50 rounded-xl overflow-hidden">
                <button
                  onClick={() => setRulesOpen(!rulesOpen)}
                  className="w-full flex items-center justify-between px-4 py-3 text-gray-300 hover:bg-dark-200/50 transition-colors"
                >
                  <span className="text-sm font-medium flex items-center gap-2">
                    <Shield className="w-4 h-4 text-primary-500" /> Правила участия
                  </span>
                  {rulesOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {rulesOpen && (
                  <div className="px-4 pb-4 pt-1 border-t border-dark-50 max-h-48 overflow-y-auto space-y-1.5">
                    {RULES.map((r, i) => (
                      <p key={i} className="text-gray-400 text-xs leading-relaxed">{i + 1}. {r}</p>
                    ))}
                  </div>
                )}
              </div>

              {/* Agree */}
              <label className="flex items-start gap-3 cursor-pointer group">
                <div
                  onClick={() => setAgreed(!agreed)}
                  className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${
                    agreed ? 'bg-primary-500 border-primary-500' : 'border-dark-50 bg-dark-200 group-hover:border-primary-500/50'
                  }`}
                >
                  {agreed && <Check className="w-3 h-3 text-white" />}
                </div>
                <span className="text-gray-400 text-sm">Я прочитал(а) правила турнира и согласен(а) их соблюдать</span>
              </label>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
                </div>
              )}

              <button
                onClick={handleRegister}
                disabled={loading || !canRegister}
                className="w-full btn-primary py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading
                  ? <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Регистрируемся...
                    </span>
                  : 'Зарегистрироваться на турнир'
                }
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export function TournamentPage({ tournament, user, onBack, onOpenLogin }: TournamentPageProps) {
  const [activeTab, setActiveTab] = useState<'info' | 'bracket' | 'participants' | 'rules'>('info');
  const [showRegModal, setShowRegModal] = useState(false);
  const [showLobby, setShowLobby] = useState(false);
  const [showBracket, setShowBracket] = useState(false);
  const [registrations, setRegistrations] = useState<TournamentRegistration[]>([]);
  const [matches, setMatches] = useState<TournamentMatch[]>([]);
  const [myTeam, setMyTeam] = useState<Team | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [loadingReg, setLoadingReg] = useState(true);

  useEffect(() => {
    loadRegistrations();
    loadMatches();
    if (user) { loadMyTeam(); checkIfRegistered(); }
  }, [user]);

  const loadRegistrations = async () => {
    const { data } = await supabase
      .from('tournament_registrations')
      .select('*')
      .eq('tournament_id', tournament.id)
      .order('registered_at', { ascending: true });
    setRegistrations(data || []);
    setLoadingReg(false);
  };

  const loadMatches = async () => {
    const { data } = await supabase
      .from('tournament_matches')
      .select('*')
      .eq('tournament_id', tournament.id)
      .order('round', { ascending: false })
      .order('match_index', { ascending: true });
    setMatches(data || []);
  };

  const loadMyTeam = async () => {
    if (!user) return;
    const { data: membership } = await supabase
      .from('team_members').select('team_id').eq('user_id', user.id).maybeSingle();
    if (!membership) return;

    const { data: team } = await supabase
      .from('teams').select('*').eq('id', membership.team_id).single();
    if (!team) return;

    const { data: rows } = await supabase
      .from('team_members').select('user_id, role').eq('team_id', team.id);
    const userIds = (rows || []).map((r: any) => r.user_id);
    const { data: profiles } = await supabase
      .from('profiles').select('id, username, avatar_url').in('id', userIds);
    const profileMap = Object.fromEntries((profiles || []).map((p: any) => [p.id, p]));
    const enriched: TeamMember[] = (rows || []).map((r: any) => ({
      id: r.user_id,
      username: profileMap[r.user_id]?.username ?? 'Player',
      avatar_url: profileMap[r.user_id]?.avatar_url ?? null,
      role: r.role,
    }));
    setMyTeam({ ...team, members: enriched });
  };

  const checkIfRegistered = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('tournament_registrations')
      .select('id')
      .eq('tournament_id', tournament.id)
      .eq('captain_id', user.id)
      .maybeSingle();
    setIsRegistered(!!data);
  };

  const handleRegSuccess = () => {
    setShowRegModal(false);
    setIsRegistered(true);
    loadRegistrations();
  };

  const slotsLeft = tournament.slots_total - tournament.slots_taken;
  const fillPct = Math.round((tournament.slots_taken / tournament.slots_total) * 100);
  const isFull = slotsLeft <= 0;
  const isClosed = tournament.status === 'finished';

  const TABS = [
    { id: 'info', label: 'Инфо' },
    { id: 'bracket', label: 'Сетка' },
    { id: 'participants', label: `Участники (${registrations.length})` },
    { id: 'rules', label: 'Правила' },
  ] as const;

  const isAdmin = user?.email === 'gergenov10@gmail.com';
  const userTeam = isRegistered ? 'team1' as const : null;

  return (
    <div className="min-h-screen bg-dark-300">
      {/* ── Лобби матча ── */}
      {showBracket && (
        <BracketPage
          tournament={tournament}
          user={user}
          isAdmin={isAdmin}
          onBack={() => setShowBracket(false)}
        />
      )}
      {showLobby && (
        <MatchLobbyPage
          tournamentName={tournament.name}
          user={user}
          onBack={() => setShowLobby(false)}
        />
      )}
      {!showLobby && (<>
      {/* Header */}
      <div className="sticky top-0 z-50 bg-dark-100/90 backdrop-blur-md border-b border-dark-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-4">
          <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span className="hidden sm:block">Назад</span>
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-7 h-7 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <Trophy className="w-4 h-4 text-white" />
            </div>
            <span className="font-display font-bold text-white truncate">{tournament.name}</span>
          </div>
          <button
              onClick={() => setShowBracket(true)}
              className="py-2 px-4 text-sm flex-shrink-0 flex items-center gap-2 border border-dark-50 rounded-lg text-gray-300 hover:text-white hover:border-primary-500 transition-colors"
            >
              <GitBranch className="w-4 h-4" /> Сетка
            </button>
          {isRegistered && (
            <button
              onClick={() => setShowLobby(true)}
              className="btn-primary py-2 px-4 text-sm flex-shrink-0 flex items-center gap-2"
            >
              <Swords className="w-4 h-4" /> Войти в лобби
            </button>
          )}
          {!isClosed && !isRegistered && (
            <button
              onClick={user ? () => setShowRegModal(true) : onOpenLogin}
              className="btn-primary py-2 px-4 text-sm flex-shrink-0"
            >
              {user ? 'Участвовать' : 'Войти'}
            </button>
          )}
          {isRegistered && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/15 rounded-lg text-green-400 text-sm font-medium flex-shrink-0">
              <CheckCircle className="w-4 h-4" /> Зарегистрированы
            </div>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Hero */}
        <div className="relative rounded-2xl overflow-hidden bg-dark-200 border border-dark-50">
          <div className="absolute inset-0 bg-gradient-to-br from-primary-500/15 via-transparent to-transparent" />
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/5 rounded-full blur-3xl" />
          <div className="relative p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                    isClosed ? 'bg-gray-500/20 text-gray-400' :
                    isFull ? 'bg-red-500/20 text-red-400' :
                    'bg-green-500/20 text-green-400'
                  }`}>
                    {isClosed ? 'Завершён' : isFull ? 'Набор закрыт' : 'Регистрация открыта'}
                  </span>
                  <span className="px-2.5 py-1 bg-dark-100/80 rounded-lg text-gray-400 text-xs">
                    Single Elimination
                  </span>
                </div>
                <h1 className="font-display font-bold text-3xl sm:text-4xl text-white mb-2">{tournament.name}</h1>
                <div className="flex flex-wrap gap-4 text-sm text-gray-400">
                  <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4 text-primary-500" />{tournament.date}</span>
                  <span className="flex items-center gap-1.5"><Award className="w-4 h-4 text-yellow-500" />{tournament.prize}</span>
                  <span className="flex items-center gap-1.5"><Users className="w-4 h-4 text-blue-400" />{tournament.slots_taken}/{tournament.slots_total} команд</span>
                </div>
              </div>
              {/* Slot meter */}
              <div className="sm:w-48 flex-shrink-0">
                <div className="flex justify-between text-xs text-gray-400 mb-2">
                  <span>Заполнено</span>
                  <span className="font-medium text-white">{fillPct}%</span>
                </div>
                <div className="h-2 bg-dark-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${isFull ? 'bg-red-500' : 'bg-primary-500'}`}
                    style={{ width: `${fillPct}%` }}
                  />
                </div>
                <div className="text-xs text-gray-500 mt-1.5 text-right">
                  {isFull ? 'Все слоты заняты' : `Осталось ${slotsLeft} мест`}
                </div>
              </div>
            </div>

            {!isClosed && !isRegistered && (
              <button
                onClick={user ? () => setShowRegModal(true) : onOpenLogin}
                className="mt-6 btn-primary py-3 px-8 text-base"
              >
                {user ? 'Зарегистрировать команду' : 'Войти для участия'}
              </button>
            )}
            {isRegistered && (
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center gap-2 px-5 py-3 bg-green-500/15 border border-green-500/30 rounded-xl text-green-400 font-medium">
                  <CheckCircle className="w-5 h-5" /> Ваша команда зарегистрирована
                </div>
                <button
                  onClick={() => setShowLobby(true)}
                  className="btn-primary py-3 px-8 text-base flex items-center gap-2"
                >
                  <Swords className="w-5 h-5" /> Войти в лобби матча
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-dark-200 p-1 rounded-xl border border-dark-50">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/20'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'info' && (
          <div className="grid sm:grid-cols-2 gap-4">
            {/* Prize */}
            <div className="card">
              <h3 className="font-display font-bold text-white mb-4 flex items-center gap-2">
                <Award className="w-5 h-5 text-yellow-500" /> Призовой фонд
              </h3>
              <div className="text-3xl font-display font-bold text-primary-400 mb-4">{tournament.prize}</div>
              <div className="space-y-2">
                {PRIZE_DISTRIBUTION.map((p) => (
                  <div key={p.place} className="flex items-center justify-between py-2 border-b border-dark-50 last:border-0">
                    <span className="text-gray-300 text-sm flex items-center gap-2">{p.icon} {p.place}</span>
                    <span className="text-white font-medium text-sm">{p.prize_pct}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Schedule */}
            <div className="card">
              <h3 className="font-display font-bold text-white mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-400" /> Расписание
              </h3>
              <div className="space-y-3">
                {[
                  { round: 'Регистрация', date: 'до начала турнира', active: true },
                  { round: 'Round of 16', date: 'День 1 · 19:00 МСК', active: false },
                  { round: 'Четвертьфиналы', date: 'День 2 · 19:00 МСК', active: false },
                  { round: 'Полуфиналы', date: 'День 3 · 19:00 МСК', active: false },
                  { round: 'Финал', date: 'День 4 · 20:00 МСК', active: false },
                ].map((s, i) => (
                  <div key={i} className={`flex items-center gap-3 py-2 ${s.active ? 'opacity-100' : 'opacity-50'}`}>
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${s.active ? 'bg-primary-500' : 'bg-gray-600'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-sm font-medium">{s.round}</div>
                      <div className="text-gray-500 text-xs">{s.date}</div>
                    </div>
                    {s.active && <span className="text-xs text-primary-400 font-medium bg-primary-500/10 px-2 py-0.5 rounded-full">Сейчас</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* Format */}
            <div className="card sm:col-span-2">
              <h3 className="font-display font-bold text-white mb-4 flex items-center gap-2">
                <Swords className="w-5 h-5 text-red-400" /> Формат
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Формат', value: 'Single Elimination' },
                  { label: 'Карты', value: 'Best of 1 / BO3 финал' },
                  { label: 'Платформа', value: 'CS2 Official' },
                  { label: 'Регион', value: 'EU / RU' },
                ].map(item => (
                  <div key={item.label} className="bg-dark-200 rounded-xl p-3 border border-dark-50">
                    <div className="text-gray-500 text-xs mb-1">{item.label}</div>
                    <div className="text-white text-sm font-medium">{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'bracket' && (
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-display font-bold text-white flex items-center gap-2">
                <GitBranch className="w-5 h-5 text-primary-500" /> Турнирная сетка
              </h3>
              {matches.length > 0 && (
                <span className="text-xs text-gray-500 bg-dark-200 px-3 py-1 rounded-full border border-dark-50">
                  {matches.filter(m => m.status === 'finished').length} / {matches.length} матчей сыграно
                </span>
              )}
            </div>
            <BracketView matches={matches} totalSlots={tournament.slots_total} />
          </div>
        )}

        {activeTab === 'participants' && (
          <div className="card">
            <h3 className="font-display font-bold text-white mb-5 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-400" />
              Зарегистрированные команды
              <span className="ml-auto text-gray-500 font-normal text-sm">{registrations.length} / {tournament.slots_total}</span>
            </h3>
            {loadingReg ? (
              <div className="flex justify-center py-10">
                <div className="w-7 h-7 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
              </div>
            ) : registrations.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-10 h-10 text-gray-700 mx-auto mb-3" />
                <p className="text-gray-500">Пока никто не зарегистрировался</p>
                <p className="text-gray-600 text-sm mt-1">Будь первым!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {registrations.map((reg, i) => (
                  <div key={reg.id} className="flex items-center gap-3 py-3 px-4 bg-dark-200 rounded-xl border border-dark-50">
                    <span className={`text-sm font-bold w-6 text-center flex-shrink-0 ${
                      i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-orange-400' : 'text-gray-600'
                    }`}>#{i + 1}</span>
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500/30 to-primary-600/30 border border-dark-50 flex items-center justify-center flex-shrink-0">
                      <Shield className="w-4 h-4 text-primary-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-medium text-sm truncate">{reg.team_name}</div>
                      <div className="text-gray-500 text-xs">капитан: {reg.captain_username}</div>
                    </div>
                    <div className="text-gray-600 text-xs flex-shrink-0">
                      {new Date(reg.registered_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'rules' && (
          <div className="card">
            <h3 className="font-display font-bold text-white mb-5 flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary-500" /> Правила турнира
            </h3>
            <div className="space-y-3">
              {RULES.map((rule, i) => (
                <div key={i} className="flex gap-3 py-3 border-b border-dark-50 last:border-0">
                  <span className="w-6 h-6 rounded-lg bg-primary-500/20 text-primary-400 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <p className="text-gray-300 text-sm leading-relaxed">{rule}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Reg modal */}
      {showRegModal && user && (
        <RegModal
          tournament={tournament}
          user={user}
          myTeam={myTeam}
          onClose={() => setShowRegModal(false)}
          onSuccess={handleRegSuccess}
        />
      )}
      </>)}
    </div>
  );
}

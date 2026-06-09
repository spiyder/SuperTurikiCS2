
raw
Tournamentpage · TSX
import { useState, useEffect } from 'react';
import {
  ArrowLeft, Trophy, Calendar, Users, Award, CheckCircle,
  AlertCircle, ChevronDown, ChevronUp, Shield, Gamepad2,
  Clock, Check, X, Crown, UserCheck, Swords,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { User as SupabaseUser } from '@supabase/supabase-js';
 
interface Tournament {
  id: number;
  name: string;
  date: string;
  prize: string;
  slots_taken: number;
  slots_total: number;
  status: string;
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
  members: TeamMember[];
}
 
interface TournamentRegistration {
  id: number;
  tournament_id: number;
  team_name: string;
  captain_username: string;
  registered_at: string;
}
 
interface TournamentPageProps {
  tournament: Tournament;
  user: SupabaseUser | null;
  onBack: () => void;
  onOpenLogin: () => void;
}
 
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
 
const SCHEDULE = [
  { round: 'Регистрация', date: 'до начала турнира', status: 'active' },
  { round: 'Round of 16', date: 'День 1 · 19:00 МСК', status: 'upcoming' },
  { round: 'Четвертьфиналы', date: 'День 2 · 19:00 МСК', status: 'upcoming' },
  { round: 'Полуфиналы', date: 'День 3 · 19:00 МСК', status: 'upcoming' },
  { round: 'Финал', date: 'День 4 · 20:00 МСК', status: 'upcoming' },
];
 
export function TournamentPage({ tournament, user, onBack, onOpenLogin }: TournamentPageProps) {
  const [activeTab, setActiveTab] = useState<'info' | 'participants' | 'rules'>('info');
  const [showRegModal, setShowRegModal] = useState(false);
  const [registrations, setRegistrations] = useState<TournamentRegistration[]>([]);
  const [myTeam, setMyTeam] = useState<Team | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [loadingReg, setLoadingReg] = useState(true);
 
  useEffect(() => {
    loadRegistrations();
    if (user) {
      loadMyTeam();
      checkIfRegistered();
    }
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
 
  const loadMyTeam = async () => {
    if (!user) return;
    // Load team where user is captain or member
    const { data: membership } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', user.id)
      .maybeSingle();
 
    if (!membership) return;
 
    const { data: team } = await supabase
      .from('teams')
      .select('*')
      .eq('id', membership.team_id)
      .single();
 
    if (!team) return;
 
    const { data: members } = await supabase
      .from('team_members')
      .select('user_id, role, profiles(id, username, avatar_url)')
      .eq('team_id', team.id);
 
    const enriched: TeamMember[] = (members || []).map((m: any) => ({
      id: m.profiles?.id || m.user_id,
      username: m.profiles?.username || 'Игрок',
      avatar_url: m.profiles?.avatar_url || null,
      role: m.role,
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
 
  const slotsLeft = tournament.slots_total - tournament.slots_taken;
  const fillPct = Math.round((tournament.slots_taken / tournament.slots_total) * 100);
  const isFull = slotsLeft <= 0;
  const isClosed = tournament.status === 'finished';
 
  return (
    <div className="min-h-screen bg-dark-300">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-dark-100/90 backdrop-blur-md border-b border-dark-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="hidden sm:block">Назад</span>
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-7 h-7 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <Trophy className="w-4 h-4 text-white" />
            </div>
            <span className="font-display font-bold text-white truncate">{tournament.name}</span>
          </div>
          {/* Register CTA in header on scroll */}
          {!isClosed && !isRegistered && (
            <button
              onClick={user ? () => setShowRegModal(true) : onOpenLogin}
              className="btn-primary py-2 px-4 text-sm flex-shrink-0"
            >
              {user ? 'Участвовать' : 'Войти'}
            </button>
          )}
        </div>
      </div>
 
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
 
        {/* Hero banner */}
        <div className="relative rounded-2xl overflow-hidden bg-dark-200 border border-dark-50">
          <div className="absolute inset-0 bg-gradient-to-br from-primary-500/15 via-transparent to-transparent" />
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/5 rounded-full blur-3xl" />
          <div className="relative p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold mb-3 ${
                  isClosed ? 'bg-gray-500/20 text-gray-400' :
                  isFull ? 'bg-red-500/20 text-red-400' :
                  tournament.status === 'open' ? 'bg-green-500/20 text-green-400' :
                  'bg-primary-500/20 text-primary-400'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    isClosed ? 'bg-gray-400' :
                    isFull ? 'bg-red-400' :
                    tournament.status === 'open' ? 'bg-green-400 animate-pulse' : 'bg-primary-400'
                  }`} />
                  {isClosed ? 'Завершён' : isFull ? 'Регистрация закрыта' : tournament.status === 'open' ? 'Открыта регистрация' : 'Скоро'}
                </span>
                <h1 className="font-display text-2xl sm:text-3xl font-bold text-white">{tournament.name}</h1>
              </div>
 
              {isRegistered ? (
                <div className="flex items-center gap-2 px-5 py-3 bg-green-500/10 border border-green-500/30 rounded-xl text-green-400 font-semibold flex-shrink-0">
                  <CheckCircle className="w-5 h-5" />
                  Вы зарегистрированы
                </div>
              ) : isClosed ? null : (
                <button
                  onClick={user ? () => setShowRegModal(true) : onOpenLogin}
                  disabled={isFull}
                  className="btn-primary px-8 py-3 flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed animate-pulse-glow"
                >
                  {user ? (isFull ? 'Мест нет' : 'Участвовать') : 'Войти и участвовать'}
                </button>
              )}
            </div>
 
            {/* Key stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { icon: Award, label: 'Призовой фонд', value: tournament.prize, color: 'text-yellow-400' },
                { icon: Calendar, label: 'Дата', value: tournament.date, color: 'text-primary-400' },
                { icon: Users, label: 'Слотов', value: `${tournament.slots_taken}/${tournament.slots_total}`, color: 'text-blue-400' },
                { icon: Swords, label: 'Формат', value: 'Single Elim', color: 'text-purple-400' },
              ].map(({ icon: Icon, label, value, color }) => (
                <div key={label} className="bg-dark-300/60 rounded-xl p-4">
                  <Icon className={`w-4 h-4 ${color} mb-2`} />
                  <div className="text-white font-semibold text-sm leading-tight">{value}</div>
                  <div className="text-gray-500 text-xs mt-0.5">{label}</div>
                </div>
              ))}
            </div>
 
            {/* Slots progress */}
            <div className="mt-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-xs">Заполненность</span>
                <span className="text-gray-400 text-xs">
                  {isFull ? (
                    <span className="text-red-400 font-medium">Мест нет</span>
                  ) : (
                    <span className="text-green-400 font-medium">{slotsLeft} мест свободно</span>
                  )}
                </span>
              </div>
              <div className="h-2 bg-dark-50 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${fillPct >= 90 ? 'bg-red-500' : fillPct >= 70 ? 'bg-yellow-500' : 'bg-primary-500'}`}
                  style={{ width: `${fillPct}%` }}
                />
              </div>
            </div>
          </div>
        </div>
 
        {/* Tabs */}
        <div className="flex gap-1 bg-dark-200 rounded-xl p-1.5">
          {([
            { id: 'info', label: 'Информация', icon: Trophy },
            { id: 'participants', label: `Участники (${registrations.length})`, icon: Users },
            { id: 'rules', label: 'Правила', icon: Shield },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === id
                  ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/30'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:block">{label}</span>
            </button>
          ))}
        </div>
 
        {/* INFO TAB */}
        {activeTab === 'info' && (
          <div className="space-y-5">
            {/* Prize distribution */}
            <div className="card">
              <h3 className="font-display font-bold text-white mb-4 flex items-center gap-2">
                <Award className="w-5 h-5 text-yellow-400" />
                Призовые места
              </h3>
              <div className="space-y-3">
                {PRIZE_DISTRIBUTION.map(({ place, prize_pct, icon }) => (
                  <div key={place} className="flex items-center justify-between py-2 border-b border-dark-50 last:border-0">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{icon}</span>
                      <span className="text-white font-medium">{place}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-primary-400 font-bold">{prize_pct}</div>
                      <div className="text-gray-500 text-xs">от призового фонда</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
 
            {/* Schedule */}
            <div className="card">
              <h3 className="font-display font-bold text-white mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary-500" />
                Расписание
              </h3>
              <div className="relative">
                <div className="absolute left-3 top-2 bottom-2 w-px bg-dark-50" />
                <div className="space-y-4">
                  {SCHEDULE.map(({ round, date, status }, idx) => (
                    <div key={idx} className="flex items-start gap-4 pl-8 relative">
                      <div className={`absolute left-0 top-1 w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                        status === 'active' ? 'bg-primary-500' : 'bg-dark-200 border border-dark-50'
                      }`}>
                        {status === 'active'
                          ? <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                          : <span className="w-1.5 h-1.5 bg-dark-50 rounded-full" />
                        }
                      </div>
                      <div>
                        <div className={`font-medium text-sm ${status === 'active' ? 'text-primary-400' : 'text-white'}`}>
                          {round}
                        </div>
                        <div className="text-gray-500 text-xs mt-0.5">{date}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
 
            {/* Format */}
            <div className="card">
              <h3 className="font-display font-bold text-white mb-4 flex items-center gap-2">
                <Swords className="w-5 h-5 text-primary-500" />
                Формат
              </h3>
              <div className="grid sm:grid-cols-2 gap-4">
                {[
                  { label: 'Тип сетки', value: 'Single Elimination' },
                  { label: 'Состав команды', value: '5 игроков' },
                  { label: 'Карты', value: 'Bo1 / Bo3 в финале' },
                  { label: 'Сервер', value: 'Официальный (128 tick)' },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between py-2 border-b border-dark-50 last:border-0 sm:last:border-b sm:border-b">
                    <span className="text-gray-400 text-sm">{label}</span>
                    <span className="text-white font-medium text-sm">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
 
        {/* PARTICIPANTS TAB */}
        {activeTab === 'participants' && (
          <div className="space-y-3">
            {loadingReg ? (
              <div className="text-center py-16">
                <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto" />
              </div>
            ) : registrations.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                <Users className="w-12 h-12 mx-auto mb-4 text-gray-700" />
                <p className="font-medium text-gray-400 mb-1">Никто ещё не зарегистрировался</p>
                <p className="text-sm">Стань первым участником!</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between px-1 mb-2">
                  <span className="text-gray-400 text-sm">{registrations.length} команд зарегистрировано</span>
                  <span className="text-gray-500 text-sm">{slotsLeft} мест свободно</span>
                </div>
                {registrations.map((reg, idx) => (
                  <div key={reg.id} className="card flex items-center gap-4">
                    <div className="w-9 h-9 bg-dark-300 border border-dark-50 rounded-lg flex items-center justify-center text-gray-500 font-display font-bold text-sm flex-shrink-0">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{reg.team_name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-gray-500 text-xs mt-0.5">
                        <Crown className="w-3 h-3" />
                        {reg.captain_username}
                      </div>
                    </div>
                    <div className="text-gray-600 text-xs flex-shrink-0">
                      {new Date(reg.registered_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
 
        {/* RULES TAB */}
        {activeTab === 'rules' && (
          <div className="card space-y-4">
            <h3 className="font-display font-bold text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary-500" />
              Правила турнира
            </h3>
            <div className="space-y-3">
              {RULES.map((rule, idx) => (
                <div key={idx} className="flex items-start gap-3 py-2 border-b border-dark-50 last:border-0">
                  <div className="w-6 h-6 rounded-lg bg-primary-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-primary-500 text-xs font-bold">{idx + 1}</span>
                  </div>
                  <p className="text-gray-300 text-sm leading-relaxed">{rule}</p>
                </div>
              ))}
            </div>
            <div className="pt-2 flex items-start gap-3 p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-xl">
              <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
              <p className="text-yellow-200/80 text-sm">
                Регистрируясь на турнир, вы подтверждаете, что ознакомились с правилами и согласны их соблюдать.
              </p>
            </div>
          </div>
        )}
      </div>
 
      {/* Registration Modal */}
      {showRegModal && user && (
        <RegistrationModal
          tournament={tournament}
          user={user}
          myTeam={myTeam}
          onClose={() => setShowRegModal(false)}
          onSuccess={() => {
            setIsRegistered(true);
            setShowRegModal(false);
            loadRegistrations();
          }}
        />
      )}
    </div>
  );
}
 
// ─── Registration Modal ────────────────────────────────────────────────────────
 
interface RegistrationModalProps {
  tournament: Tournament;
  user: SupabaseUser;
  myTeam: Team | null;
  onClose: () => void;
  onSuccess: () => void;
}
 
function RegistrationModal({ tournament, user, myTeam, onClose, onSuccess }: RegistrationModalProps) {
  const [step, setStep] = useState<'team' | 'confirm' | 'done'>(myTeam ? 'confirm' : 'team');
  const [gameNick, setGameNick] = useState('');
  const [steamId, setSteamId] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rulesOpen, setRulesOpen] = useState(false);
 
  const canRegister = myTeam && myTeam.members.length === 5;
 
  const handleRegister = async () => {
    if (!agreed) { setError('Подтверди согласие с правилами'); return; }
    if (!gameNick.trim()) { setError('Укажи ник в игре'); return; }
    if (!myTeam) { setError('Сначала создай команду в профиле'); return; }
    if (myTeam.members.length !== 5) { setError('Команда должна состоять ровно из 5 игроков'); return; }
 
    setLoading(true);
    setError('');
 
    // Get captain username from profiles
    const { data: profile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .single();
 
    const { error: insertError } = await supabase.from('tournament_registrations').insert({
      tournament_id: tournament.id,
      team_id: myTeam.id,
      team_name: myTeam.name,
      captain_id: user.id,
      captain_username: profile?.username || user.email?.split('@')[0] || 'Игрок',
      game_nick: gameNick.trim(),
      steam_id: steamId.trim() || null,
    });
 
    if (insertError) {
      if (insertError.code === '23505') setError('Твоя команда уже зарегистрирована на этот турнир');
      else setError('Ошибка регистрации. Попробуй ещё раз.');
      setLoading(false);
      return;
    }
 
    // Increment slots_taken
    await supabase.rpc('increment_slots', { tournament_id: tournament.id });
 
    setLoading(false);
    setStep('done');
    setTimeout(onSuccess, 1500);
  };
 
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-dark-100 border border-dark-50 rounded-2xl shadow-2xl shadow-black/50 animate-slide-up">
 
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-dark-50">
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
          {/* Done state */}
          {step === 'done' ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-400" />
              </div>
              <h3 className="font-display font-bold text-xl text-white mb-2">Готово!</h3>
              <p className="text-gray-400">Ваша команда зарегистрирована на турнир.</p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* No team warning */}
              {!myTeam && (
                <div className="flex items-start gap-3 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                  <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                  <p className="text-yellow-200/80 text-sm">
                    У тебя нет команды. Перейди в <strong className="text-yellow-300">Профиль → Моя команда</strong>, создай команду и добавь 4 игрока, затем возвращайся.
                  </p>
                </div>
              )}
 
              {/* Team wrong size warning */}
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
                    <div className="w-9 h-9 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg flex items-center justify-center">
                      <Crown className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <div className="text-white font-bold">{myTeam.name}</div>
                      <div className="text-gray-500 text-xs">[{myTeam.tag}] · {myTeam.members.length}/5 игроков</div>
                    </div>
                    {myTeam.members.length === 5 && (
                      <UserCheck className="w-5 h-5 text-green-400 ml-auto" />
                    )}
                  </div>
                  <div className="flex gap-2">
                    {myTeam.members.map((m) => (
                      <div key={m.id} className="flex flex-col items-center gap-1" title={m.username}>
                        <div className="w-8 h-8 rounded-lg bg-dark-300 border border-dark-50 overflow-hidden flex items-center justify-center">
                          {m.avatar_url
                            ? <img src={m.avatar_url} alt="" className="w-full h-full object-cover" />
                            : <Gamepad2 className="w-4 h-4 text-gray-600" />
                          }
                        </div>
                        <span className="text-gray-500 text-xs max-w-[40px] truncate text-center">{m.username}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
 
              {/* Game nick */}
              <div>
                <label className="block text-gray-400 text-sm mb-2">Ник в CS2 <span className="text-red-400">*</span></label>
                <input
                  value={gameNick}
                  onChange={e => setGameNick(e.target.value)}
                  placeholder="Твой ник в игре"
                  className="w-full bg-dark-200 border border-dark-50 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-primary-500 transition-colors"
                />
              </div>
 
              {/* Steam ID */}
              <div>
                <label className="block text-gray-400 text-sm mb-2">Steam ID <span className="text-gray-600 text-xs">(необязательно)</span></label>
                <input
                  value={steamId}
                  onChange={e => setSteamId(e.target.value)}
                  placeholder="76561198XXXXXXXXX"
                  className="w-full bg-dark-200 border border-dark-50 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-primary-500 transition-colors"
                />
              </div>
 
              {/* Rules accordion */}
              <div className="border border-dark-50 rounded-xl overflow-hidden">
                <button
                  onClick={() => setRulesOpen(!rulesOpen)}
                  className="w-full flex items-center justify-between px-4 py-3 text-gray-300 hover:bg-dark-200/50 transition-colors"
                >
                  <span className="text-sm font-medium flex items-center gap-2">
                    <Shield className="w-4 h-4 text-primary-500" />
                    Правила участия
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
 
              {/* Agree checkbox */}
              <label className="flex items-start gap-3 cursor-pointer group">
                <div
                  onClick={() => setAgreed(!agreed)}
                  className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${
                    agreed ? 'bg-primary-500 border-primary-500' : 'border-dark-50 bg-dark-200 group-hover:border-primary-500/50'
                  }`}
                >
                  {agreed && <Check className="w-3 h-3 text-white" />}
                </div>
                <span className="text-gray-400 text-sm">
                  Я прочитал(а) правила турнира и согласен(а) их соблюдать
                </span>
              </label>
 
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
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
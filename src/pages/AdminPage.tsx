// src/pages/AdminPage.tsx
// Полная админ-панель SuperTurikiCS2
// Разделы: Дашборд, Турниры, Матчи/Лобби, Пользователи, Новости, Финансы, Жалобы, Настройки
// Роли: admin (всё), referee (только лобби + матчи)

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  LayoutDashboard, Trophy, Swords, Users, Newspaper, Wallet,
  AlertTriangle, Settings, LogOut, Plus, Trash2, Save, X,
  ChevronRight, TrendingUp, Shield, Clock, CheckCircle2,
  RefreshCw, Eye, Ban, Crown, Search, Filter, Bell,
  DollarSign, Flag, Edit3, ToggleLeft, ToggleRight, UserCog,
  Play, Pause, StopCircle, Calendar, Hash, Loader2,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type AdminRole = 'admin' | 'referee';

interface Profile {
  id: string;
  username: string;
  email: string;
  role: 'player' | 'referee' | 'admin';
  created_at: string;
  avatar_url?: string;
  is_banned?: boolean;
}

interface Tournament {
  id?: number;
  name: string;
  date: string;
  prize: string;
  slots_taken: number;
  slots_total: number;
  status: 'open' | 'soon' | 'finished';
  entry_fee?: number;
  prize_pool?: number;
  description?: string;
}

interface LobbyMatch {
  id: string;
  tournament_id: number | null;
  team1_name: string;
  team2_name: string;
  round: string;
  scheduled_at: string | null;
  phase: 'scheduled' | 'open' | 'readycheck' | 'veto' | 'playing' | 'finished';
  referee_id: string | null;
  score1: number;
  score2: number;
  winner_name: string | null;
  created_at: string;
}

interface NewsItem {
  id?: number;
  title: string;
  body: string;
  is_published: boolean;
  created_at?: string;
  published_at?: string;
}

interface Report {
  id?: number;
  reporter_username: string;
  reported_username: string;
  reason: string;
  details: string;
  status: 'open' | 'reviewed' | 'resolved' | 'dismissed';
  created_at?: string;
  admin_note?: string;
}

interface FinanceEntry {
  id?: number;
  type: 'entry_fee' | 'prize_payout' | 'refund' | 'other';
  amount: number;
  description: string;
  tournament_id?: number;
  created_at?: string;
  status: 'pending' | 'completed' | 'cancelled';
}

interface SiteStats {
  players_count: string;
  tournaments_count: string;
  prize_pool: string;
  support: string;
}

interface DashStats {
  totalUsers: number;
  activeTournaments: number;
  liveMatches: number;
  openReports: number;
  totalRevenue: number;
  newUsersWeek: number;
}

type Tab =
  | 'dashboard'
  | 'tournaments'
  | 'matches'
  | 'users'
  | 'news'
  | 'finance'
  | 'reports'
  | 'settings';

// ─── Constants ────────────────────────────────────────────────────────────────

const PHASE_META: Record<LobbyMatch['phase'], { label: string; color: string }> = {
  scheduled:  { label: 'Запланирован',     color: 'bg-gray-500/20 text-gray-400' },
  open:       { label: 'Лобби открыто',    color: 'bg-blue-500/20 text-blue-400' },
  readycheck: { label: 'Готовность',       color: 'bg-yellow-500/20 text-yellow-400' },
  veto:       { label: 'Вето карт',        color: 'bg-purple-500/20 text-purple-400' },
  playing:    { label: 'Идёт матч',        color: 'bg-green-500/20 text-green-400' },
  finished:   { label: 'Завершён',         color: 'bg-dark-50/60 text-gray-500' },
};

const REPORT_META: Record<Report['status'], { label: string; color: string }> = {
  open:      { label: 'Открыта',     color: 'bg-red-500/20 text-red-400' },
  reviewed:  { label: 'На рассмотрении', color: 'bg-yellow-500/20 text-yellow-400' },
  resolved:  { label: 'Решена',      color: 'bg-green-500/20 text-green-400' },
  dismissed: { label: 'Отклонена',   color: 'bg-gray-500/20 text-gray-500' },
};

const INPUT = "w-full bg-dark-400 border border-dark-50 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary-500 transition-colors placeholder-gray-600";
const SELECT = "w-full bg-dark-400 border border-dark-50 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary-500 transition-colors";
const LABEL = "text-gray-400 text-xs mb-1 block font-medium uppercase tracking-wide";

// ─── Sidebar nav ─────────────────────────────────────────────────────────────

const ALL_TABS: { id: Tab; label: string; icon: React.FC<{ className?: string }>; adminOnly?: boolean }[] = [
  { id: 'dashboard',   label: 'Дашборд',      icon: LayoutDashboard },
  { id: 'tournaments', label: 'Турниры',       icon: Trophy,          adminOnly: true },
  { id: 'matches',     label: 'Матчи / Лобби', icon: Swords },
  { id: 'users',       label: 'Пользователи',  icon: Users,           adminOnly: true },
  { id: 'news',        label: 'Новости',        icon: Newspaper,       adminOnly: true },
  { id: 'finance',     label: 'Финансы',        icon: Wallet,          adminOnly: true },
  { id: 'reports',     label: 'Жалобы',         icon: AlertTriangle,   adminOnly: true },
  { id: 'settings',    label: 'Настройки',      icon: Settings,        adminOnly: true },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export function AdminPage({ onLogout, adminRole = 'admin' }: { onLogout: () => void; adminRole?: AdminRole }) {
  const [tab, setTab] = useState<Tab>(adminRole === 'referee' ? 'matches' : 'dashboard');
  const [toast, setToast] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const visibleTabs = ALL_TABS.filter(t => adminRole === 'admin' || !t.adminOnly);

  return (
    <div className="min-h-screen bg-dark-300 text-white flex">
      {/* ── Sidebar ── */}
      <aside className={`flex-shrink-0 bg-dark-100 border-r border-dark-50 flex flex-col transition-all duration-200 ${sidebarOpen ? 'w-56' : 'w-16'}`}>
        {/* Logo */}
        <div className="h-16 flex items-center gap-3 px-4 border-b border-dark-50">
          <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center shrink-0">
            <Crown className="w-4 h-4 text-white" />
          </div>
          {sidebarOpen && (
            <span className="font-display font-bold text-sm leading-tight">
              Super<span className="text-primary-500">Turiki</span><br />
              <span className="text-gray-500 text-xs font-normal">
                {adminRole === 'admin' ? 'Admin' : 'Referee'}
              </span>
            </span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 space-y-0.5 px-2">
          {visibleTabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                tab === id
                  ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30'
                  : 'text-gray-400 hover:text-white hover:bg-dark-50/50'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {sidebarOpen && <span>{label}</span>}
            </button>
          ))}
        </nav>

        {/* Bottom */}
        <div className="p-2 border-t border-dark-50 space-y-1">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-gray-600 hover:text-gray-400 transition-colors text-sm"
          >
            <ChevronRight className={`w-4 h-4 shrink-0 transition-transform ${sidebarOpen ? 'rotate-180' : ''}`} />
            {sidebarOpen && <span>Свернуть</span>}
          </button>
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-gray-400 hover:text-red-400 transition-colors text-sm"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {sidebarOpen && <span>Выйти</span>}
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-16 bg-dark-100/80 backdrop-blur border-b border-dark-50 flex items-center justify-between px-6 shrink-0">
          <h1 className="font-display font-bold text-lg">
            {visibleTabs.find(t => t.id === tab)?.label}
          </h1>
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
              adminRole === 'admin' ? 'bg-primary-500/20 text-primary-400' : 'bg-blue-500/20 text-blue-400'
            }`}>
              <Shield className="w-3 h-3" />
              {adminRole === 'admin' ? 'Администратор' : 'Рефери'}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-6">
          {tab === 'dashboard'   && <DashboardTab showToast={showToast} />}
          {tab === 'tournaments' && <TournamentsTab showToast={showToast} />}
          {tab === 'matches'     && <MatchesTab showToast={showToast} adminRole={adminRole} />}
          {tab === 'users'       && <UsersTab showToast={showToast} />}
          {tab === 'news'        && <NewsTab showToast={showToast} />}
          {tab === 'finance'     && <FinanceTab showToast={showToast} />}
          {tab === 'reports'     && <ReportsTab showToast={showToast} />}
          {tab === 'settings'    && <SettingsTab showToast={showToast} />}
        </main>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-dark-100 border border-primary-500/40 text-white px-5 py-3 rounded-xl shadow-xl z-50 flex items-center gap-2 animate-slide-up">
          <CheckCircle2 className="w-4 h-4 text-green-400" />
          {toast}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════════

function DashboardTab({ showToast }: { showToast: (s: string) => void }) {
  const [stats, setStats] = useState<DashStats>({
    totalUsers: 0, activeTournaments: 0, liveMatches: 0,
    openReports: 0, totalRevenue: 0, newUsersWeek: 0,
  });
  const [recentMatches, setRecentMatches] = useState<LobbyMatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const [users, tours, matches, reports, finance] = await Promise.all([
      supabase.from('profiles').select('id, created_at', { count: 'exact' }),
      supabase.from('tournaments').select('id, status'),
      supabase.from('lobby_matches').select('*').order('created_at', { ascending: false }).limit(5),
      supabase.from('reports').select('id, status'),
      supabase.from('finance_entries').select('amount, status'),
    ]);

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const newUsers = (users.data ?? []).filter(u => new Date(u.created_at) > weekAgo).length;
    const revenue = (finance.data ?? [])
      .filter(f => f.status === 'completed')
      .reduce((sum, f) => sum + (f.amount || 0), 0);

    setStats({
      totalUsers:        users.count ?? 0,
      activeTournaments: (tours.data ?? []).filter(t => t.status === 'open').length,
      liveMatches:       (matches.data ?? []).filter(m => m.phase === 'playing').length,
      openReports:       (reports.data ?? []).filter(r => r.status === 'open').length,
      totalRevenue:      revenue,
      newUsersWeek:      newUsers,
    });
    if (matches.data) setRecentMatches(matches.data);
    setLoading(false);
  };

  const statCards = [
    { label: 'Игроков',          value: stats.totalUsers,        icon: Users,        color: 'text-primary-400', sub: `+${stats.newUsersWeek} за неделю` },
    { label: 'Активных турниров', value: stats.activeTournaments, icon: Trophy,       color: 'text-yellow-400',  sub: 'открыта регистрация' },
    { label: 'Матчей live',      value: stats.liveMatches,       icon: Swords,       color: 'text-green-400',   sub: 'сейчас играют' },
    { label: 'Открытых жалоб',   value: stats.openReports,       icon: AlertTriangle, color: 'text-red-400',    sub: 'требуют внимания' },
    { label: 'Выручка (₽)',      value: `${stats.totalRevenue.toLocaleString('ru')}`, icon: DollarSign, color: 'text-blue-400', sub: 'всего собрано' },
  ];

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <p className="text-gray-400 text-sm">Обзор платформы в реальном времени</p>
        <button onClick={load} className="text-gray-500 hover:text-white transition-colors">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {statCards.map(({ label, value, icon: Icon, color, sub }) => (
          <div key={label} className="bg-dark-100 border border-dark-50 rounded-xl p-4 hover:border-primary-500/30 transition-colors">
            <div className="flex items-start justify-between mb-2">
              <p className="text-gray-500 text-xs font-medium">{label}</p>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <p className={`font-display text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-gray-600 text-xs mt-1">{sub}</p>
          </div>
        ))}
      </div>

      {/* Recent matches */}
      <div className="bg-dark-100 border border-dark-50 rounded-xl p-5">
        <h3 className="font-display font-bold text-base mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary-500" /> Последние матчи
        </h3>
        {recentMatches.length === 0 ? (
          <p className="text-gray-600 text-sm text-center py-6">Матчей пока нет</p>
        ) : (
          <div className="space-y-2">
            {recentMatches.map(m => (
              <div key={m.id} className="flex items-center justify-between py-2.5 border-b border-dark-50 last:border-0">
                <div>
                  <span className="text-white font-medium text-sm">{m.team1_name}</span>
                  <span className="text-gray-500 mx-2 text-sm">vs</span>
                  <span className="text-white font-medium text-sm">{m.team2_name}</span>
                  <span className="text-gray-600 text-xs ml-3">{m.round}</span>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${PHASE_META[m.phase].color}`}>
                  {PHASE_META[m.phase].label}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// TOURNAMENTS
// ═══════════════════════════════════════════════════════════════════

function TournamentsTab({ showToast }: { showToast: (s: string) => void }) {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const blank: Tournament = { name: '', date: '', prize: '', slots_taken: 0, slots_total: 16, status: 'open', entry_fee: 0, prize_pool: 0, description: '' };
  const [form, setForm] = useState<Tournament>(blank);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const { data } = await supabase.from('tournaments').select('*').order('created_at', { ascending: false });
    if (data) setTournaments(data);
  };

  const save = async () => {
    if (!form.name || !form.date) return;
    setLoading(true);
    if (editId) {
      await supabase.from('tournaments').update(form).eq('id', editId);
      showToast('Турнир обновлён');
    } else {
      await supabase.from('tournaments').insert(form);
      showToast('Турнир создан');
    }
    setForm(blank); setEditId(null);
    await load(); setLoading(false);
  };

  const del = async (id: number) => {
    await supabase.from('tournaments').delete().eq('id', id);
    await load(); showToast('Удалено');
  };

  const startEdit = (t: Tournament) => { setForm(t); setEditId(t.id!); };

  const statusColor: Record<string, string> = {
    open:     'bg-green-500/20 text-green-400',
    soon:     'bg-yellow-500/20 text-yellow-400',
    finished: 'bg-gray-500/20 text-gray-400',
  };
  const statusLabel: Record<string, string> = { open: 'Регистрация', soon: 'Скоро', finished: 'Завершён' };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Form */}
      <div className="bg-dark-100 border border-dark-50 rounded-xl p-5">
        <h2 className="font-display font-bold text-base mb-4 flex items-center gap-2">
          {editId ? <Edit3 className="w-4 h-4 text-primary-500" /> : <Plus className="w-4 h-4 text-primary-500" />}
          {editId ? 'Редактировать турнир' : 'Новый турнир'}
        </h2>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="col-span-2">
            <label className={LABEL}>Название</label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="LEAGUE OPEN QUALIFIER" className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Дата</label>
            <input value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} placeholder="15 июня в 19:00 МСК" className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Статус</label>
            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as Tournament['status'] })} className={SELECT}>
              <option value="open">Открыта регистрация</option>
              <option value="soon">Скоро</option>
              <option value="finished">Завершён</option>
            </select>
          </div>
          <div>
            <label className={LABEL}>Призовой фонд (текст)</label>
            <input value={form.prize} onChange={e => setForm({ ...form, prize: e.target.value })} placeholder="50 000 ₽" className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Слотов всего</label>
            <input type="number" value={form.slots_total} onChange={e => setForm({ ...form, slots_total: +e.target.value })} className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Взнос (₽, 0 = бесплатно)</label>
            <input type="number" value={form.entry_fee ?? 0} onChange={e => setForm({ ...form, entry_fee: +e.target.value })} className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Призовой фонд (₽)</label>
            <input type="number" value={form.prize_pool ?? 0} onChange={e => setForm({ ...form, prize_pool: +e.target.value })} className={INPUT} />
          </div>
          <div className="col-span-2">
            <label className={LABEL}>Описание</label>
            <textarea value={form.description ?? ''} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Правила, формат, дополнительно…" className={INPUT + ' resize-none'} />
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={save} disabled={loading} className="btn-primary flex items-center gap-2 disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {editId ? 'Сохранить' : 'Создать'}
          </button>
          {editId && (
            <button onClick={() => { setForm(blank); setEditId(null); }} className="btn-outline">
              Отмена
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="space-y-2">
        {tournaments.map(t => (
          <div key={t.id} className="bg-dark-100 border border-dark-50 rounded-xl px-5 py-4 flex items-center gap-4 hover:border-dark-50/80">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-display font-bold text-white">{t.name}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusColor[t.status]}`}>
                  {statusLabel[t.status]}
                </span>
                {(t.entry_fee ?? 0) > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-400">
                    {t.entry_fee} ₽ взнос
                  </span>
                )}
              </div>
              <p className="text-gray-400 text-sm mt-0.5">{t.date} · {t.slots_taken}/{t.slots_total} команд · приз: {t.prize}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => startEdit(t)} className="p-2 text-gray-400 hover:text-white transition-colors"><Edit3 className="w-4 h-4" /></button>
              <button onClick={() => del(t.id!)} className="p-2 text-red-400 hover:text-red-300 transition-colors"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
        {tournaments.length === 0 && <Empty text="Турниров пока нет" />}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MATCHES / LOBBY
// ═══════════════════════════════════════════════════════════════════

function MatchesTab({ showToast, adminRole }: { showToast: (s: string) => void; adminRole: AdminRole }) {
  const [matches, setMatches] = useState<LobbyMatch[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [referees, setReferees] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | LobbyMatch['phase']>('all');

  const blank = { tournament_id: '', team1_name: '', team2_name: '', round: 'Round 1', scheduled_at: '', referee_id: '' };
  const [form, setForm] = useState(blank);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const [m, t, r] = await Promise.all([
      supabase.from('lobby_matches').select('*').order('created_at', { ascending: false }),
      supabase.from('tournaments').select('id, name'),
      supabase.from('profiles').select('id, username, email').in('role', ['referee', 'admin']),
    ]);
    if (m.data) setMatches(m.data);
    if (t.data) setTournaments(t.data);
    if (r.data) setReferees(r.data);
  };

  const create = async () => {
    if (!form.team1_name.trim() || !form.team2_name.trim()) return;
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('lobby_matches').insert({
      tournament_id: form.tournament_id ? +form.tournament_id : null,
      team1_name: form.team1_name.trim(),
      team2_name: form.team2_name.trim(),
      round: form.round,
      scheduled_at: form.scheduled_at || null,
      referee_id: form.referee_id || null,
      created_by: user?.id,
      phase: 'scheduled',
    });
    setForm(blank);
    await load(); setLoading(false); showToast('Матч создан');
  };

  const setPhase = async (id: string, phase: LobbyMatch['phase']) => {
    const upd: Record<string, unknown> = { phase };
    if (phase === 'open') upd.lobby_open_at = new Date().toISOString();
    await supabase.from('lobby_matches').update(upd).eq('id', id);
    await supabase.from('lobby_chat').insert({ match_id: id, username: 'Судья', channel: 'system',
      message: {
        open: 'Лобби открыто. Игроки могут заходить.',
        readycheck: 'Подтверждение готовности начато.',
        veto: 'Все готовы. Вето карт начинается.',
        playing: 'Матч начался! Удачи обеим командам.',
        finished: 'Матч завершён.',
      }[phase] ?? `Фаза изменена: ${phase}`,
    });
    await load(); showToast('Фаза обновлена');
  };

  const saveScore = async (id: string, s1: number, s2: number, t1: string, t2: string) => {
    const winner = s1 > s2 ? t1 : s2 > s1 ? t2 : '';
    await supabase.from('lobby_matches').update({ score1: s1, score2: s2, winner_name: winner, phase: 'finished' }).eq('id', id);
    await load(); showToast('Счёт сохранён');
  };

  const del = async (id: string) => {
    await supabase.from('lobby_matches').delete().eq('id', id);
    await load(); showToast('Удалено');
  };

  const copyLink = (id: string) => {
    navigator.clipboard.writeText(`${window.location.origin}?lobby=${id}`);
    showToast('Ссылка скопирована');
  };

  const phaseOrder: LobbyMatch['phase'][] = ['scheduled','open','readycheck','veto','playing','finished'];
  const nextPhase = (p: LobbyMatch['phase']): LobbyMatch['phase'] | null => {
    const i = phaseOrder.indexOf(p);
    return i < phaseOrder.length - 1 ? phaseOrder[i + 1] : null;
  };

  const filtered = filter === 'all' ? matches : matches.filter(m => m.phase === filter);

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Create form — только для admin */}
      {adminRole === 'admin' && (
        <div className="bg-dark-100 border border-dark-50 rounded-xl p-5">
          <h2 className="font-display font-bold text-base mb-4 flex items-center gap-2">
            <Plus className="w-4 h-4 text-primary-500" /> Создать матч
          </h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className={LABEL}>Команда 1</label>
              <input value={form.team1_name} onChange={e => setForm({ ...form, team1_name: e.target.value })} placeholder="Team Alpha" className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Команда 2</label>
              <input value={form.team2_name} onChange={e => setForm({ ...form, team2_name: e.target.value })} placeholder="Team Beta" className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Турнир</label>
              <select value={form.tournament_id} onChange={e => setForm({ ...form, tournament_id: e.target.value })} className={SELECT}>
                <option value="">— без турнира —</option>
                {tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL}>Раунд</label>
              <select value={form.round} onChange={e => setForm({ ...form, round: e.target.value })} className={SELECT}>
                {['Round 1','Round 2','Round 3','Quarterfinal','Semifinal','Final'].map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL}>Время матча</label>
              <input type="datetime-local" value={form.scheduled_at} onChange={e => setForm({ ...form, scheduled_at: e.target.value })} className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Рефери</label>
              <select value={form.referee_id} onChange={e => setForm({ ...form, referee_id: e.target.value })} className={SELECT}>
                <option value="">— без рефери —</option>
                {referees.map(r => <option key={r.id} value={r.id}>{r.username}</option>)}
              </select>
            </div>
          </div>
          <button onClick={create} disabled={loading || !form.team1_name || !form.team2_name} className="btn-primary flex items-center gap-2 disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Создать матч
          </button>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {(['all', ...phaseOrder] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filter === f ? 'bg-primary-500 text-white' : 'bg-dark-100 border border-dark-50 text-gray-400 hover:text-white'
            }`}>
            {f === 'all' ? 'Все' : PHASE_META[f as LobbyMatch['phase']].label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-3">
        {filtered.map(m => (
          <MatchCard key={m.id} match={m} onPhase={setPhase} onScore={saveScore} onDelete={del} onCopyLink={copyLink} nextPhase={nextPhase} />
        ))}
        {filtered.length === 0 && <Empty text="Матчей нет" />}
      </div>
    </div>
  );
}

function MatchCard({ match: m, onPhase, onScore, onDelete, onCopyLink, nextPhase }: {
  match: LobbyMatch;
  onPhase: (id: string, p: LobbyMatch['phase']) => void;
  onScore: (id: string, s1: number, s2: number, t1: string, t2: string) => void;
  onDelete: (id: string) => void;
  onCopyLink: (id: string) => void;
  nextPhase: (p: LobbyMatch['phase']) => LobbyMatch['phase'] | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const [s1, setS1] = useState(m.score1?.toString() ?? '0');
  const [s2, setS2] = useState(m.score2?.toString() ?? '0');
  const next = nextPhase(m.phase);

  const phaseIcons: Partial<Record<LobbyMatch['phase'], React.ReactNode>> = {
    scheduled: <Play className="w-3 h-3" />,
    open:      <Users className="w-3 h-3" />,
    readycheck:<CheckCircle2 className="w-3 h-3" />,
    veto:      <Swords className="w-3 h-3" />,
    playing:   <StopCircle className="w-3 h-3" />,
  };

  const nextLabels: Partial<Record<LobbyMatch['phase'], string>> = {
    scheduled:  'Открыть лобби',
    open:       'Начать готовность',
    readycheck: 'Начать вето',
    veto:       'Начать матч',
    playing:    'Завершить',
  };

  return (
    <div className={`bg-dark-100 border rounded-xl transition-all ${
      m.phase === 'playing' ? 'border-green-500/30' : m.phase === 'finished' ? 'border-dark-50/40' : 'border-dark-50'
    }`}>
      <div className="px-5 py-4 flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${PHASE_META[m.phase].color}`}>
              {PHASE_META[m.phase].label}
            </span>
            <span className="text-gray-500 text-xs">{m.round}</span>
            {m.scheduled_at && (
              <span className="text-gray-600 text-xs flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {new Date(m.scheduled_at).toLocaleString('ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
          <div className="font-display font-bold text-white text-lg leading-tight">
            {m.team1_name} <span className="text-gray-500 font-normal text-base">vs</span> {m.team2_name}
          </div>
          {m.phase === 'finished' && m.winner_name && (
            <p className="text-green-400 text-xs mt-0.5">🏆 {m.winner_name} · {m.score1}:{m.score2}</p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {(m.phase === 'open' || m.phase === 'readycheck' || m.phase === 'veto') && (
            <button onClick={() => onCopyLink(m.id)} className="text-xs px-3 py-1.5 bg-dark-400 border border-dark-50 rounded-lg text-gray-300 hover:text-white">
              📋 Ссылка
            </button>
          )}
          {next && (
            <button onClick={() => onPhase(m.id, next)}
              className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5">
              {phaseIcons[m.phase]} {nextLabels[m.phase]}
            </button>
          )}
          <button onClick={() => setExpanded(!expanded)} className="text-xs px-3 py-1.5 bg-dark-400 border border-dark-50 rounded-lg text-gray-400 hover:text-white">
            {expanded ? 'Свернуть' : 'Детали'}
          </button>
          <button onClick={() => onDelete(m.id)} className="p-1.5 text-red-400 hover:text-red-300"><Trash2 className="w-4 h-4" /></button>
        </div>
      </div>

      {expanded && (
        <div className="px-5 pb-4 pt-0 border-t border-dark-50/50 mt-0">
          <div className="pt-4 flex items-center gap-3 flex-wrap">
            <span className="text-gray-400 text-sm">Счёт:</span>
            <span className="text-white text-sm font-medium">{m.team1_name}</span>
            <input value={s1} onChange={e => setS1(e.target.value)} className="w-12 bg-dark-400 border border-dark-50 rounded px-2 py-1 text-center text-white text-sm focus:outline-none focus:border-primary-500" />
            <span className="text-gray-500">:</span>
            <input value={s2} onChange={e => setS2(e.target.value)} className="w-12 bg-dark-400 border border-dark-50 rounded px-2 py-1 text-center text-white text-sm focus:outline-none focus:border-primary-500" />
            <span className="text-white text-sm font-medium">{m.team2_name}</span>
            <button onClick={() => onScore(m.id, +s1, +s2, m.team1_name, m.team2_name)} className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1">
              <Save className="w-3 h-3" /> Сохранить
            </button>
          </div>
          <p className="text-gray-700 text-xs font-mono mt-3">ID: {m.id}</p>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// USERS
// ═══════════════════════════════════════════════════════════════════

function UsersTab({ showToast }: { showToast: (s: string) => void }) {
  const [users, setUsers] = useState<Profile[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'player' | 'referee' | 'admin'>('all');
  const [loading, setLoading] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (data) setUsers(data);
    setLoading(false);
  };

  const setRole = async (id: string, role: Profile['role']) => {
    await supabase.from('profiles').update({ role }).eq('id', id);
    await load(); showToast('Роль изменена');
  };

  const toggleBan = async (id: string, banned: boolean) => {
    await supabase.from('profiles').update({ is_banned: !banned }).eq('id', id);
    await load(); showToast(banned ? 'Бан снят' : 'Игрок забанен');
  };

  const filtered = users.filter(u => {
    const matchSearch = !search || u.username?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === 'all' || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const roleColors: Record<string, string> = {
    admin:   'bg-primary-500/20 text-primary-400',
    referee: 'bg-blue-500/20 text-blue-400',
    player:  'bg-gray-500/20 text-gray-400',
  };

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск по нику или email…" className={INPUT + ' pl-9'} />
        </div>
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value as typeof roleFilter)} className={SELECT + ' w-auto'}>
          <option value="all">Все роли</option>
          <option value="player">Игроки</option>
          <option value="referee">Рефери</option>
          <option value="admin">Админы</option>
        </select>
        <button onClick={load} className="p-2 bg-dark-100 border border-dark-50 rounded-lg text-gray-400 hover:text-white">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="bg-dark-100 border border-dark-50 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-dark-50 text-gray-500 text-xs uppercase tracking-wide">
              <th className="text-left px-5 py-3">Игрок</th>
              <th className="text-left px-4 py-3">Роль</th>
              <th className="text-left px-4 py-3 hidden md:table-cell">Дата регистрации</th>
              <th className="text-right px-5 py-3">Действия</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(u => (
              <tr key={u.id} className={`border-b border-dark-50/50 last:border-0 hover:bg-dark-50/20 ${u.is_banned ? 'opacity-50' : ''}`}>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-dark-400 rounded-lg flex items-center justify-center text-xs font-bold text-primary-400 shrink-0">
                      {(u.username ?? u.email ?? '?')[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-white font-medium">{u.username ?? '—'}</p>
                      <p className="text-gray-500 text-xs">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <select
                    value={u.role}
                    onChange={e => setRole(u.id, e.target.value as Profile['role'])}
                    className={`text-xs px-2 py-1 rounded-lg border-0 font-semibold cursor-pointer focus:outline-none ${roleColors[u.role]} bg-transparent`}
                  >
                    <option value="player">Игрок</option>
                    <option value="referee">Рефери</option>
                    <option value="admin">Админ</option>
                  </select>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs hidden md:table-cell">
                  {u.created_at ? new Date(u.created_at).toLocaleDateString('ru') : '—'}
                </td>
                <td className="px-5 py-3 text-right">
                  <button
                    onClick={() => toggleBan(u.id, u.is_banned ?? false)}
                    className={`text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 ml-auto transition-colors ${
                      u.is_banned
                        ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                        : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                    }`}
                  >
                    <Ban className="w-3 h-3" />
                    {u.is_banned ? 'Снять бан' : 'Забанить'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="py-10 text-center text-gray-600 text-sm">Пользователей не найдено</div>}
      </div>

      <p className="text-gray-600 text-xs">Всего: {users.length} · Показано: {filtered.length}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// NEWS
// ═══════════════════════════════════════════════════════════════════

function NewsTab({ showToast }: { showToast: (s: string) => void }) {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const blank: NewsItem = { title: '', body: '', is_published: false };
  const [form, setForm] = useState<NewsItem>(blank);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const { data } = await supabase.from('news').select('*').order('created_at', { ascending: false });
    if (data) setNews(data);
  };

  const save = async () => {
    if (!form.title.trim() || !form.body.trim()) return;
    setLoading(true);
    const payload = { ...form, published_at: form.is_published ? new Date().toISOString() : null };
    if (editId) {
      await supabase.from('news').update(payload).eq('id', editId);
      showToast('Новость обновлена');
    } else {
      await supabase.from('news').insert(payload);
      showToast(form.is_published ? 'Новость опубликована' : 'Черновик сохранён');
    }
    setForm(blank); setEditId(null);
    await load(); setLoading(false);
  };

  const del = async (id: number) => {
    await supabase.from('news').delete().eq('id', id);
    await load(); showToast('Удалено');
  };

  const togglePublish = async (item: NewsItem) => {
    await supabase.from('news').update({ is_published: !item.is_published }).eq('id', item.id!);
    await load(); showToast(item.is_published ? 'Снято с публикации' : 'Опубликовано');
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="bg-dark-100 border border-dark-50 rounded-xl p-5">
        <h2 className="font-display font-bold text-base mb-4 flex items-center gap-2">
          {editId ? <Edit3 className="w-4 h-4 text-primary-500" /> : <Plus className="w-4 h-4 text-primary-500" />}
          {editId ? 'Редактировать' : 'Новость / Анонс'}
        </h2>
        <div className="space-y-3 mb-4">
          <div>
            <label className={LABEL}>Заголовок</label>
            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Анонс летнего турнира" className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Текст</label>
            <textarea value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} rows={5} placeholder="Подробности, дата, условия участия…" className={INPUT + ' resize-none'} />
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <button type="button" onClick={() => setForm({ ...form, is_published: !form.is_published })}>
              {form.is_published
                ? <ToggleRight className="w-6 h-6 text-primary-500" />
                : <ToggleLeft className="w-6 h-6 text-gray-500" />}
            </button>
            <span className="text-sm text-gray-300">Опубликовать сразу</span>
          </label>
        </div>
        <div className="flex gap-3">
          <button onClick={save} disabled={loading} className="btn-primary flex items-center gap-2 disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {editId ? 'Сохранить' : 'Создать'}
          </button>
          {editId && <button onClick={() => { setForm(blank); setEditId(null); }} className="btn-outline">Отмена</button>}
        </div>
      </div>

      <div className="space-y-3">
        {news.map(n => (
          <div key={n.id} className="bg-dark-100 border border-dark-50 rounded-xl p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${n.is_published ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                    {n.is_published ? 'Опубликовано' : 'Черновик'}
                  </span>
                  {n.created_at && <span className="text-gray-600 text-xs">{new Date(n.created_at).toLocaleDateString('ru')}</span>}
                </div>
                <p className="font-bold text-white">{n.title}</p>
                <p className="text-gray-400 text-sm mt-1 line-clamp-2">{n.body}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => togglePublish(n)} className="p-2 text-gray-400 hover:text-white" title={n.is_published ? 'Снять' : 'Опубликовать'}>
                  {n.is_published ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>
                <button onClick={() => { setForm(n); setEditId(n.id!); }} className="p-2 text-gray-400 hover:text-white"><Edit3 className="w-4 h-4" /></button>
                <button onClick={() => del(n.id!)} className="p-2 text-red-400 hover:text-red-300"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          </div>
        ))}
        {news.length === 0 && <Empty text="Новостей пока нет" />}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// FINANCE
// ═══════════════════════════════════════════════════════════════════

function FinanceTab({ showToast }: { showToast: (s: string) => void }) {
  const [entries, setEntries] = useState<FinanceEntry[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(false);
  const blank: FinanceEntry = { type: 'entry_fee', amount: 0, description: '', status: 'pending' };
  const [form, setForm] = useState<FinanceEntry>(blank);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const [f, t] = await Promise.all([
      supabase.from('finance_entries').select('*').order('created_at', { ascending: false }),
      supabase.from('tournaments').select('id, name'),
    ]);
    if (f.data) setEntries(f.data);
    if (t.data) setTournaments(t.data);
  };

  const save = async () => {
    if (!form.description.trim() || form.amount <= 0) return;
    setLoading(true);
    await supabase.from('finance_entries').insert(form);
    setForm(blank);
    await load(); setLoading(false); showToast('Запись добавлена');
  };

  const updateStatus = async (id: number, status: FinanceEntry['status']) => {
    await supabase.from('finance_entries').update({ status }).eq('id', id);
    await load(); showToast('Статус обновлён');
  };

  const del = async (id: number) => {
    await supabase.from('finance_entries').delete().eq('id', id);
    await load(); showToast('Удалено');
  };

  const total = entries.filter(e => e.status === 'completed').reduce((s, e) => s + e.amount, 0);
  const pending = entries.filter(e => e.status === 'pending').reduce((s, e) => s + e.amount, 0);

  const typeLabel: Record<string, string> = {
    entry_fee: 'Взнос', prize_payout: 'Выплата приза', refund: 'Возврат', other: 'Прочее',
  };

  const statusStyle: Record<string, string> = {
    pending:   'bg-yellow-500/20 text-yellow-400',
    completed: 'bg-green-500/20 text-green-400',
    cancelled: 'bg-gray-500/20 text-gray-400',
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Собрано',      value: total,   color: 'text-green-400',  icon: TrendingUp },
          { label: 'Ожидает',      value: pending, color: 'text-yellow-400', icon: Clock },
          { label: 'Транзакций',   value: entries.length, color: 'text-blue-400', icon: Hash },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="bg-dark-100 border border-dark-50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-gray-500 text-xs font-medium">{label}</p>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <p className={`font-display text-2xl font-bold ${color}`}>
              {typeof value === 'number' && label !== 'Транзакций' ? `${value.toLocaleString('ru')} ₽` : value}
            </p>
          </div>
        ))}
      </div>

      {/* Add form */}
      <div className="bg-dark-100 border border-dark-50 rounded-xl p-5">
        <h2 className="font-display font-bold text-base mb-4 flex items-center gap-2">
          <Plus className="w-4 h-4 text-primary-500" /> Добавить запись
        </h2>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className={LABEL}>Тип</label>
            <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as FinanceEntry['type'] })} className={SELECT}>
              <option value="entry_fee">Взнос участника</option>
              <option value="prize_payout">Выплата приза</option>
              <option value="refund">Возврат</option>
              <option value="other">Прочее</option>
            </select>
          </div>
          <div>
            <label className={LABEL}>Сумма (₽)</label>
            <input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: +e.target.value })} className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Описание</label>
            <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Взнос Team Alpha, Round 1" className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Турнир</label>
            <select value={form.tournament_id ?? ''} onChange={e => setForm({ ...form, tournament_id: e.target.value ? +e.target.value : undefined })} className={SELECT}>
              <option value="">— без турнира —</option>
              {tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL}>Статус</label>
            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as FinanceEntry['status'] })} className={SELECT}>
              <option value="pending">Ожидает</option>
              <option value="completed">Выполнено</option>
              <option value="cancelled">Отменено</option>
            </select>
          </div>
        </div>
        <button onClick={save} disabled={loading} className="btn-primary flex items-center gap-2 disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Добавить
        </button>
      </div>

      {/* Table */}
      <div className="bg-dark-100 border border-dark-50 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-dark-50 text-gray-500 text-xs uppercase tracking-wide">
              <th className="text-left px-5 py-3">Описание</th>
              <th className="text-left px-4 py-3">Тип</th>
              <th className="text-right px-4 py-3">Сумма</th>
              <th className="text-left px-4 py-3">Статус</th>
              <th className="text-right px-5 py-3">Дата</th>
              <th className="px-3 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {entries.map(e => (
              <tr key={e.id} className="border-b border-dark-50/50 last:border-0 hover:bg-dark-50/20">
                <td className="px-5 py-3 text-white">{e.description}</td>
                <td className="px-4 py-3 text-gray-400 text-xs">{typeLabel[e.type]}</td>
                <td className={`px-4 py-3 text-right font-mono font-bold ${e.type === 'prize_payout' || e.type === 'refund' ? 'text-red-400' : 'text-green-400'}`}>
                  {e.type === 'prize_payout' || e.type === 'refund' ? '-' : '+'}{e.amount.toLocaleString('ru')} ₽
                </td>
                <td className="px-4 py-3">
                  <select value={e.status} onChange={ev => updateStatus(e.id!, ev.target.value as FinanceEntry['status'])}
                    className={`text-xs px-2 py-1 rounded-lg border-0 font-semibold cursor-pointer focus:outline-none bg-transparent ${statusStyle[e.status]}`}>
                    <option value="pending">Ожидает</option>
                    <option value="completed">Выполнено</option>
                    <option value="cancelled">Отменено</option>
                  </select>
                </td>
                <td className="px-5 py-3 text-right text-gray-600 text-xs">
                  {e.created_at ? new Date(e.created_at).toLocaleDateString('ru') : '—'}
                </td>
                <td className="px-3 py-3">
                  <button onClick={() => del(e.id!)} className="text-red-400 hover:text-red-300"><Trash2 className="w-3.5 h-3.5" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {entries.length === 0 && <div className="py-10 text-center text-gray-600 text-sm">Записей пока нет</div>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// REPORTS
// ═══════════════════════════════════════════════════════════════════

function ReportsTab({ showToast }: { showToast: (s: string) => void }) {
  const [reports, setReports] = useState<Report[]>([]);
  const [filter, setFilter] = useState<'all' | Report['status']>('all');
  const [notes, setNotes] = useState<Record<number, string>>({});

  useEffect(() => { load(); }, []);

  const load = async () => {
    const { data } = await supabase.from('reports').select('*').order('created_at', { ascending: false });
    if (data) setReports(data);
  };

  const updateStatus = async (id: number, status: Report['status'], note?: string) => {
    await supabase.from('reports').update({ status, admin_note: note ?? null }).eq('id', id);
    await load(); showToast('Жалоба обновлена');
  };

  const filtered = filter === 'all' ? reports : reports.filter(r => r.status === filter);

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex gap-2 flex-wrap">
        {(['all', 'open', 'reviewed', 'resolved', 'dismissed'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filter === f ? 'bg-primary-500 text-white' : 'bg-dark-100 border border-dark-50 text-gray-400 hover:text-white'
            }`}>
            {f === 'all' ? `Все (${reports.length})` : `${REPORT_META[f as Report['status']].label} (${reports.filter(r => r.status === f).length})`}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map(r => (
          <div key={r.id} className={`bg-dark-100 border rounded-xl p-5 ${r.status === 'open' ? 'border-red-500/30' : 'border-dark-50'}`}>
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${REPORT_META[r.status].color}`}>
                    {REPORT_META[r.status].label}
                  </span>
                  {r.created_at && <span className="text-gray-600 text-xs">{new Date(r.created_at).toLocaleDateString('ru')}</span>}
                </div>
                <p className="text-white font-medium">
                  <span className="text-primary-400">{r.reporter_username}</span>
                  <span className="text-gray-500 mx-2">жалуется на</span>
                  <span className="text-red-400">{r.reported_username}</span>
                </p>
                <p className="text-gray-400 text-sm mt-1"><span className="text-gray-500">Причина:</span> {r.reason}</p>
                {r.details && <p className="text-gray-500 text-sm mt-1">{r.details}</p>}
              </div>
              <div className="flex gap-2 shrink-0 flex-wrap justify-end">
                {r.status === 'open' && (
                  <button onClick={() => updateStatus(r.id!, 'reviewed')}
                    className="text-xs px-3 py-1.5 bg-yellow-500/20 text-yellow-400 rounded-lg hover:bg-yellow-500/30">
                    На рассмотрение
                  </button>
                )}
                {r.status !== 'resolved' && r.status !== 'dismissed' && (
                  <>
                    <button onClick={() => updateStatus(r.id!, 'resolved', notes[r.id!])}
                      className="text-xs px-3 py-1.5 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30">
                      Решить
                    </button>
                    <button onClick={() => updateStatus(r.id!, 'dismissed')}
                      className="text-xs px-3 py-1.5 bg-dark-400 border border-dark-50 text-gray-400 rounded-lg hover:text-white">
                      Отклонить
                    </button>
                  </>
                )}
              </div>
            </div>
            {r.admin_note && (
              <p className="text-gray-500 text-xs bg-dark-400 rounded-lg px-3 py-2 mt-2">📝 {r.admin_note}</p>
            )}
            {(r.status === 'open' || r.status === 'reviewed') && (
              <div className="flex gap-2 mt-3">
                <input
                  value={notes[r.id!] ?? ''}
                  onChange={e => setNotes({ ...notes, [r.id!]: e.target.value })}
                  placeholder="Заметка для себя (необязательно)…"
                  className={INPUT + ' text-xs'}
                />
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && <Empty text="Жалоб нет" />}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════════════════════════

function SettingsTab({ showToast }: { showToast: (s: string) => void }) {
  const [stats, setStats] = useState<SiteStats>({ players_count: '', tournaments_count: '', prize_pool: '', support: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from('site_stats').select('*').single().then(({ data }) => { if (data) setStats(data); });
  }, []);

  const save = async () => {
    setLoading(true);
    await supabase.from('site_stats').update(stats).eq('id', 1);
    setLoading(false); showToast('Настройки сохранены');
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="bg-dark-100 border border-dark-50 rounded-xl p-5">
        <h2 className="font-display font-bold text-base mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary-500" /> Счётчики на главной странице
        </h2>
        <div className="grid grid-cols-2 gap-4 mb-5">
          {([
            { key: 'players_count',     label: 'Игроков',         placeholder: '1 200+' },
            { key: 'tournaments_count', label: 'Турниров',         placeholder: '48' },
            { key: 'prize_pool',        label: 'Призовой фонд',    placeholder: '500 000 ₽' },
            { key: 'support',           label: 'Поддержка',        placeholder: '24/7' },
          ] as const).map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className={LABEL}>{label}</label>
              <input value={stats[key]} onChange={e => setStats({ ...stats, [key]: e.target.value })}
                placeholder={placeholder} className={INPUT} />
            </div>
          ))}
        </div>
        <button onClick={save} disabled={loading} className="btn-primary flex items-center gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Сохранить
        </button>
      </div>

      <div className="bg-dark-100 border border-dark-50 rounded-xl p-5">
        <h2 className="font-display font-bold text-base mb-3 flex items-center gap-2">
          <Bell className="w-4 h-4 text-primary-500" /> Важно: таблицы в Supabase
        </h2>
        <div className="space-y-2 text-sm text-gray-400">
          {['tournaments', 'lobby_matches', 'lobby_ready', 'lobby_veto', 'lobby_chat', 'profiles', 'news', 'reports', 'finance_entries', 'site_stats'].map(t => (
            <div key={t} className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-primary-500 shrink-0" />
              <code className="text-primary-400 text-xs">{t}</code>
            </div>
          ))}
        </div>
        <p className="text-gray-600 text-xs mt-3">Убедись что все таблицы созданы по migration.sql и Realtime включён для lobby_*</p>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Empty({ text }: { text: string }) {
  return (
    <div className="bg-dark-100 border border-dark-50 rounded-xl py-12 text-center">
      <p className="text-gray-600 text-sm">{text}</p>
    </div>
  );
}

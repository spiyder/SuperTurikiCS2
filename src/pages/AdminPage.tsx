import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Save, Trash2, Trophy, BarChart3, Swords, LogOut, X } from 'lucide-react';

interface Tournament {
  id?: number;
  name: string;
  date: string;
  prize: string;
  slots_taken: number;
  slots_total: number;
  status: 'open' | 'soon' | 'finished';
}

interface Match {
  id?: number;
  tournament_id: number;
  team1: string;
  team2: string;
  score1: number | null;
  score2: number | null;
  round: string;
  status: 'pending' | 'live' | 'finished';
}

interface SiteStats {
  players_count: string;
  tournaments_count: string;
  prize_pool: string;
  support: string;
}

type Tab = 'tournaments' | 'matches' | 'stats';

export function AdminPage({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>('tournaments');
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [stats, setStats] = useState<SiteStats>({ players_count: '', tournaments_count: '', prize_pool: '', support: '' });
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const [newTournament, setNewTournament] = useState<Tournament>({
    name: '', date: '', prize: '', slots_taken: 0, slots_total: 128, status: 'open'
  });

  const [newMatch, setNewMatch] = useState<Match>({
    tournament_id: 0, team1: '', team2: '', score1: null, score2: null, round: 'Round 1', status: 'pending'
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [t, m, s] = await Promise.all([
      supabase.from('tournaments').select('*').order('created_at', { ascending: false }),
      supabase.from('matches').select('*').order('created_at', { ascending: false }),
      supabase.from('site_stats').select('*').single(),
    ]);
    if (t.data) setTournaments(t.data);
    if (m.data) setMatches(m.data);
    if (s.data) setStats(s.data);
  };

  const showSaved = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };

  // Tournaments
  const addTournament = async () => {
    if (!newTournament.name || !newTournament.date || !newTournament.prize) return;
    setLoading(true);
    await supabase.from('tournaments').insert(newTournament);
    setNewTournament({ name: '', date: '', prize: '', slots_taken: 0, slots_total: 128, status: 'open' });
    await loadData();
    setLoading(false);
    showSaved();
  };

  const deleteTournament = async (id: number) => {
    await supabase.from('tournaments').delete().eq('id', id);
    await loadData();
  };

  const updateTournamentStatus = async (id: number, status: string) => {
    await supabase.from('tournaments').update({ status }).eq('id', id);
    await loadData();
  };

  // Matches
  const addMatch = async () => {
    if (!newMatch.team1 || !newMatch.team2 || !newMatch.tournament_id) return;
    setLoading(true);
    await supabase.from('matches').insert(newMatch);
    setNewMatch({ tournament_id: 0, team1: '', team2: '', score1: null, score2: null, round: 'Round 1', status: 'pending' });
    await loadData();
    setLoading(false);
    showSaved();
  };

  const updateMatchScore = async (id: number, score1: number, score2: number) => {
    const status = 'finished';
    await supabase.from('matches').update({ score1, score2, status }).eq('id', id);
    await loadData();
    showSaved();
  };

  const deleteMatch = async (id: number) => {
    await supabase.from('matches').delete().eq('id', id);
    await loadData();
  };

  // Stats
  const saveStats = async () => {
    setLoading(true);
    await supabase.from('site_stats').update(stats).eq('id', 1);
    setLoading(false);
    showSaved();
  };

  return (
    <div className="min-h-screen bg-dark-300 text-white">
      {/* Header */}
      <header className="bg-dark-100 border-b border-dark-50 px-6 py-4 flex items-center justify-between">
        <h1 className="font-display text-xl font-bold">
          Super<span className="text-primary-500">Turiki</span>CS2 — Админ
        </h1>
        <div className="flex items-center gap-4">
          {saved && <span className="text-green-400 text-sm">✓ Сохранено</span>}
          <button onClick={onLogout} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
            <LogOut className="w-4 h-4" /> Выйти
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-dark-200 border-b border-dark-50 px-6">
        <div className="flex gap-1">
          {([
            { id: 'tournaments', label: 'Турниры', icon: Trophy },
            { id: 'matches', label: 'Матчи', icon: Swords },
            { id: 'stats', label: 'Статистика', icon: BarChart3 },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === id ? 'border-primary-500 text-primary-500' : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">

        {/* TOURNAMENTS TAB */}
        {tab === 'tournaments' && (
          <>
            {/* Add tournament */}
            <div className="card space-y-4">
              <h2 className="font-display font-bold text-lg flex items-center gap-2">
                <Plus className="w-5 h-5 text-primary-500" /> Добавить турнир
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-gray-400 text-sm mb-1 block">Название</label>
                  <input
                    value={newTournament.name}
                    onChange={e => setNewTournament({ ...newTournament, name: e.target.value })}
                    placeholder="LEAGUE OPEN QUALIFIER"
                    className="w-full bg-dark-300 border border-dark-50 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-sm mb-1 block">Дата</label>
                  <input
                    value={newTournament.date}
                    onChange={e => setNewTournament({ ...newTournament, date: e.target.value })}
                    placeholder="15 июня в 19:00 МСК"
                    className="w-full bg-dark-300 border border-dark-50 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-sm mb-1 block">Призовой фонд</label>
                  <input
                    value={newTournament.prize}
                    onChange={e => setNewTournament({ ...newTournament, prize: e.target.value })}
                    placeholder="50,000 ₽"
                    className="w-full bg-dark-300 border border-dark-50 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-sm mb-1 block">Слоты (занято / всего)</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={newTournament.slots_taken}
                      onChange={e => setNewTournament({ ...newTournament, slots_taken: +e.target.value })}
                      className="w-full bg-dark-300 border border-dark-50 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary-500"
                    />
                    <input
                      type="number"
                      value={newTournament.slots_total}
                      onChange={e => setNewTournament({ ...newTournament, slots_total: +e.target.value })}
                      className="w-full bg-dark-300 border border-dark-50 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-gray-400 text-sm mb-1 block">Статус</label>
                  <select
                    value={newTournament.status}
                    onChange={e => setNewTournament({ ...newTournament, status: e.target.value as any })}
                    className="w-full bg-dark-300 border border-dark-50 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary-500"
                  >
                    <option value="open">Открыта регистрация</option>
                    <option value="soon">Скоро</option>
                    <option value="finished">Завершён</option>
                  </select>
                </div>
              </div>
              <button onClick={addTournament} disabled={loading} className="btn-primary flex items-center gap-2">
                <Plus className="w-4 h-4" /> Добавить
              </button>
            </div>

            {/* Tournaments list */}
            <div className="space-y-3">
              {tournaments.map(t => (
                <div key={t.id} className="card flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="font-display font-bold text-white">{t.name}</div>
                    <div className="text-gray-400 text-sm">{t.date} · {t.prize} · {t.slots_taken}/{t.slots_total} слотов</div>
                  </div>
                  <select
                    value={t.status}
                    onChange={e => updateTournamentStatus(t.id!, e.target.value)}
                    className="bg-dark-300 border border-dark-50 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-primary-500"
                  >
                    <option value="open">Открыта регистрация</option>
                    <option value="soon">Скоро</option>
                    <option value="finished">Завершён</option>
                  </select>
                  <button onClick={() => deleteTournament(t.id!)} className="text-red-400 hover:text-red-300 transition-colors p-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {tournaments.length === 0 && <p className="text-gray-500 text-center py-8">Турниров пока нет</p>}
            </div>
          </>
        )}

        {/* MATCHES TAB */}
        {tab === 'matches' && (
          <>
            <div className="card space-y-4">
              <h2 className="font-display font-bold text-lg flex items-center gap-2">
                <Plus className="w-5 h-5 text-primary-500" /> Добавить матч
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-gray-400 text-sm mb-1 block">Турнир</label>
                  <select
                    value={newMatch.tournament_id}
                    onChange={e => setNewMatch({ ...newMatch, tournament_id: +e.target.value })}
                    className="w-full bg-dark-300 border border-dark-50 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary-500"
                  >
                    <option value={0}>Выбери турнир</option>
                    {tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-gray-400 text-sm mb-1 block">Раунд</label>
                  <select
                    value={newMatch.round}
                    onChange={e => setNewMatch({ ...newMatch, round: e.target.value })}
                    className="w-full bg-dark-300 border border-dark-50 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary-500"
                  >
                    {['Round 1', 'Round 2', 'Quarterfinal', 'Semifinal', 'Final'].map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-gray-400 text-sm mb-1 block">Команда 1</label>
                  <input
                    value={newMatch.team1}
                    onChange={e => setNewMatch({ ...newMatch, team1: e.target.value })}
                    placeholder="Team Alpha"
                    className="w-full bg-dark-300 border border-dark-50 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-sm mb-1 block">Команда 2</label>
                  <input
                    value={newMatch.team2}
                    onChange={e => setNewMatch({ ...newMatch, team2: e.target.value })}
                    placeholder="Team Beta"
                    className="w-full bg-dark-300 border border-dark-50 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary-500"
                  />
                </div>
              </div>
              <button onClick={addMatch} disabled={loading} className="btn-primary flex items-center gap-2">
                <Plus className="w-4 h-4" /> Добавить матч
              </button>
            </div>

            {/* Matches list */}
            <div className="space-y-3">
              {matches.map(m => (
                <MatchRow key={m.id} match={m} tournaments={tournaments} onUpdate={updateMatchScore} onDelete={deleteMatch} />
              ))}
              {matches.length === 0 && <p className="text-gray-500 text-center py-8">Матчей пока нет</p>}
            </div>
          </>
        )}

        {/* STATS TAB */}
        {tab === 'stats' && (
          <div className="card space-y-4">
            <h2 className="font-display font-bold text-lg flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary-500" /> Статистика на главной
            </h2>
            <div className="grid grid-cols-2 gap-4">
              {([
                { key: 'players_count', label: 'Игроков' },
                { key: 'tournaments_count', label: 'Турниров' },
                { key: 'prize_pool', label: 'Призовой фонд' },
                { key: 'support', label: 'Поддержка' },
              ] as const).map(({ key, label }) => (
                <div key={key}>
                  <label className="text-gray-400 text-sm mb-1 block">{label}</label>
                  <input
                    value={stats[key]}
                    onChange={e => setStats({ ...stats, [key]: e.target.value })}
                    className="w-full bg-dark-300 border border-dark-50 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary-500"
                  />
                </div>
              ))}
            </div>
            <button onClick={saveStats} disabled={loading} className="btn-primary flex items-center gap-2">
              <Save className="w-4 h-4" /> Сохранить
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function MatchRow({ match, tournaments, onUpdate, onDelete }: {
  match: Match;
  tournaments: Tournament[];
  onUpdate: (id: number, s1: number, s2: number) => void;
  onDelete: (id: number) => void;
}) {
  const [s1, setS1] = useState(match.score1?.toString() ?? '');
  const [s2, setS2] = useState(match.score2?.toString() ?? '');
  const tournament = tournaments.find(t => t.id === match.tournament_id);

  return (
    <div className="card">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <div className="text-xs text-primary-500 mb-1">{tournament?.name} · {match.round}</div>
          <div className="flex items-center gap-3">
            <span className="font-bold text-white">{match.team1}</span>
            <div className="flex items-center gap-2">
              <input
                value={s1}
                onChange={e => setS1(e.target.value)}
                className="w-10 bg-dark-300 border border-dark-50 rounded px-2 py-1 text-center text-white text-sm focus:outline-none focus:border-primary-500"
              />
              <span className="text-gray-500">:</span>
              <input
                value={s2}
                onChange={e => setS2(e.target.value)}
                className="w-10 bg-dark-300 border border-dark-50 rounded px-2 py-1 text-center text-white text-sm focus:outline-none focus:border-primary-500"
              />
            </div>
            <span className="font-bold text-white">{match.team2}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-1 rounded text-xs font-medium ${
            match.status === 'finished' ? 'bg-gray-500/20 text-gray-400' :
            match.status === 'live' ? 'bg-green-500/20 text-green-400' :
            'bg-primary-500/20 text-primary-400'
          }`}>
            {match.status === 'finished' ? 'Завершён' : match.status === 'live' ? 'Live' : 'Ожидает'}
          </span>
          <button
            onClick={() => onUpdate(match.id!, +s1, +s2)}
            className="text-primary-500 hover:text-primary-400 transition-colors p-1"
          >
            <Save className="w-4 h-4" />
          </button>
          <button onClick={() => onDelete(match.id!)} className="text-red-400 hover:text-red-300 transition-colors p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

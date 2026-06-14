// src/pages/TeamPage.tsx
// Страница команды: состав, статистика, история матчей, управление

import { useState, useEffect } from 'react';
import {
  ArrowLeft, Shield, Crown, Users, Trophy, Swords,
  Edit3, Save, X, UserPlus, UserMinus, Upload,
  TrendingUp, Clock, CheckCircle2, Star, Loader2,
  Copy, Check,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { User as SupabaseUser } from '@supabase/supabase-js';

// ─── Types ───────────────────────────────────────────────────

interface Team {
  id: string;
  name: string;
  tag: string;              // короткий тег [TAG]
  logo_url: string | null;
  description: string | null;
  captain_id: string;
  created_at: string;
  wins: number;
  losses: number;
}

interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role: 'captain' | 'member';
  joined_at: string;
  profile?: {
    username: string;
    avatar_url: string | null;
    steam_id: string | null;
  };
}

interface MatchHistory {
  id: string;
  team1_name: string;
  team2_name: string;
  score1: number;
  score2: number;
  winner_name: string | null;
  phase: string;
  created_at: string;
  round: string;
}

interface Props {
  user: SupabaseUser;
  teamId?: string;          // если открываем чужую команду
  onBack: () => void;
  showToast: (msg: string) => void;
}

// ─── Component ───────────────────────────────────────────────

export function TeamPage({ user, teamId: propTeamId, onBack, showToast }: Props) {
  const [team, setTeam]         = useState<Team | null>(null);
  const [members, setMembers]   = useState<TeamMember[]>([]);
  const [history, setHistory]   = useState<MatchHistory[]>([]);
  const [loading, setLoading]   = useState(true);
  const [myTeamId, setMyTeamId] = useState<string | null>(null);
  const [tab, setTab]           = useState<'overview' | 'roster' | 'history'>('overview');

  // Edit states
  const [editingName, setEditingName]   = useState(false);
  const [editingDesc, setEditingDesc]   = useState(false);
  const [nameVal, setNameVal]           = useState('');
  const [tagVal, setTagVal]             = useState('');
  const [descVal, setDescVal]           = useState('');
  const [uploading, setUploading]       = useState(false);
  const [inviteEmail, setInviteEmail]   = useState('');
  const [inviting, setInviting]         = useState(false);
  const [copied, setCopied]             = useState(false);
  const [creating, setCreating]         = useState(false);

  // Create form
  const [showCreate, setShowCreate]     = useState(false);
  const [createName, setCreateName]     = useState('');
  const [createTag, setCreateTag]       = useState('');
  const [createDesc, setCreateDesc]     = useState('');

  const isCaptain = team?.captain_id === user.id;
  const isMyTeam  = !propTeamId || propTeamId === myTeamId;

  useEffect(() => { load(); }, [propTeamId]);

  const load = async () => {
    setLoading(true);

    // Найти команду юзера или открыть по ID
    const targetId = propTeamId ?? await getMyTeamId();

    if (!targetId) { setLoading(false); return; }

    const [teamRes, membersRes, histRes] = await Promise.all([
      supabase.from('teams').select('*').eq('id', targetId).single(),
      supabase.from('team_members').select('*, profile:profiles(username, avatar_url, steam_id)').eq('team_id', targetId),
      supabase.from('lobby_matches')
        .select('id, team1_name, team2_name, score1, score2, winner_name, phase, created_at, round')
        .or(`team1_name.eq.${team?.name ?? ''},team2_name.eq.${team?.name ?? ''}`)
        .eq('phase', 'finished')
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    if (teamRes.data) {
      setTeam(teamRes.data);
      setNameVal(teamRes.data.name);
      setTagVal(teamRes.data.tag);
      setDescVal(teamRes.data.description ?? '');
    }
    if (membersRes.data) setMembers(membersRes.data as TeamMember[]);
    if (histRes.data)    setHistory(histRes.data);
    setLoading(false);
  };

  const getMyTeamId = async (): Promise<string | null> => {
    const { data } = await supabase.from('team_members').select('team_id').eq('user_id', user.id).maybeSingle();
    const id = data?.team_id ?? null;
    setMyTeamId(id);
    return id;
  };

  // ── Create team ─────────────────────────────────────────
  const createTeam = async () => {
    if (!createName.trim() || !createTag.trim()) return;
    if (createTag.length > 5) { showToast('Тег максимум 5 символов'); return; }
    setCreating(true);
    const { data: newTeam, error } = await supabase.from('teams').insert({
      name: createName.trim(),
      tag:  createTag.toUpperCase().trim(),
      description: createDesc.trim() || null,
      captain_id: user.id,
      wins: 0, losses: 0,
    }).select().single();

    if (error) { showToast('Ошибка создания команды'); setCreating(false); return; }

    await supabase.from('team_members').insert({
      team_id: newTeam.id, user_id: user.id, role: 'captain',
    });
    // Обновляем профиль
    await supabase.from('profiles').update({ team_id: newTeam.id }).eq('id', user.id);

    setMyTeamId(newTeam.id);
    setShowCreate(false);
    setCreating(false);
    showToast('Команда создана!');
    await load();
  };

  // ── Edit team ───────────────────────────────────────────
  const saveName = async () => {
    if (!nameVal.trim() || !tagVal.trim()) return;
    await supabase.from('teams').update({ name: nameVal.trim(), tag: tagVal.toUpperCase().trim() }).eq('id', team!.id);
    setTeam(prev => prev ? { ...prev, name: nameVal.trim(), tag: tagVal.toUpperCase().trim() } : prev);
    setEditingName(false); showToast('Название обновлено');
  };

  const saveDesc = async () => {
    await supabase.from('teams').update({ description: descVal }).eq('id', team!.id);
    setTeam(prev => prev ? { ...prev, description: descVal } : prev);
    setEditingDesc(false); showToast('Описание обновлено');
  };

  // ── Logo upload ─────────────────────────────────────────
  const uploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !team) return;
    if (file.size > 2 * 1024 * 1024) { showToast('Максимум 2 МБ'); return; }
    setUploading(true);
    const ext  = file.name.split('.').pop();
    const path = `${team.id}/logo.${ext}`;
    await supabase.storage.from('team-logos').upload(path, file, { upsert: true });
    const { data } = supabase.storage.from('team-logos').getPublicUrl(path);
    const url = data.publicUrl + '?t=' + Date.now();
    await supabase.from('teams').update({ logo_url: url }).eq('id', team.id);
    setTeam(prev => prev ? { ...prev, logo_url: url } : prev);
    setUploading(false); showToast('Логотип обновлён!');
  };

  // ── Invite ──────────────────────────────────────────────
  const inviteMember = async () => {
    if (!inviteEmail.trim() || !team) return;
    setInviting(true);
    const { data: profile } = await supabase.from('profiles').select('id, username').eq('email', inviteEmail.trim()).maybeSingle();
    if (!profile) { showToast('Игрок не найден'); setInviting(false); return; }

    const { data: existing } = await supabase.from('team_members').select('id').eq('user_id', profile.id).maybeSingle();
    if (existing) { showToast('Игрок уже в команде'); setInviting(false); return; }

    await supabase.from('team_members').insert({ team_id: team.id, user_id: profile.id, role: 'member' });
    await supabase.from('profiles').update({ team_id: team.id }).eq('id', profile.id);
    setInviteEmail('');
    await load(); showToast(`${profile.username} добавлен в команду!`);
    setInviting(false);
  };

  // ── Kick ────────────────────────────────────────────────
  const kickMember = async (userId: string, username: string) => {
    if (!team) return;
    await supabase.from('team_members').delete().eq('team_id', team.id).eq('user_id', userId);
    await supabase.from('profiles').update({ team_id: null }).eq('id', userId);
    await load(); showToast(`${username} удалён из команды`);
  };

  // ── Leave ───────────────────────────────────────────────
  const leaveTeam = async () => {
    if (!team) return;
    await supabase.from('team_members').delete().eq('team_id', team.id).eq('user_id', user.id);
    await supabase.from('profiles').update({ team_id: null }).eq('id', user.id);
    setTeam(null); setMyTeamId(null);
    showToast('Ты покинул команду'); onBack();
  };

  // ── Copy invite link ────────────────────────────────────
  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}?team=${team?.id}`);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  // ── Derived stats ───────────────────────────────────────
  const totalGames = (team?.wins ?? 0) + (team?.losses ?? 0);
  const winRate    = totalGames > 0 ? Math.round(((team?.wins ?? 0) / totalGames) * 100) : 0;

  // ─── Loading ─────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-dark-300 flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
    </div>
  );

  // ─── No team ─────────────────────────────────────────────
  if (!team) return (
    <div className="min-h-screen bg-dark-300 text-white">
      <header className="bg-dark-100/95 backdrop-blur-md border-b border-dark-50 h-16 flex items-center px-6 gap-4">
        <button onClick={onBack} className="text-gray-400 hover:text-white flex items-center gap-1.5 text-sm">
          <ArrowLeft className="w-4 h-4" /> Назад
        </button>
        <span className="font-display font-bold text-white">Моя команда</span>
      </header>

      <div className="max-w-md mx-auto px-6 py-20 text-center">
        <div className="w-20 h-20 bg-dark-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <Shield className="w-10 h-10 text-gray-600" />
        </div>
        <h2 className="font-display font-bold text-2xl text-white mb-2">У тебя нет команды</h2>
        <p className="text-gray-500 text-sm mb-8">Создай команду или попроси капитана добавить тебя</p>

        {!showCreate ? (
          <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2 mx-auto">
            <Shield className="w-4 h-4" /> Создать команду
          </button>
        ) : (
          <div className="bg-dark-100 border border-dark-50 rounded-2xl p-5 text-left space-y-3">
            <h3 className="font-display font-bold text-base">Новая команда</h3>
            <div>
              <label className="text-gray-400 text-xs mb-1 block uppercase tracking-wide">Название</label>
              <input value={createName} onChange={e => setCreateName(e.target.value)} placeholder="Team Alpha"
                className="w-full bg-dark-300 border border-dark-50 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary-500" />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block uppercase tracking-wide">Тег (макс 5 символов)</label>
              <input value={createTag} onChange={e => setCreateTag(e.target.value.toUpperCase())} placeholder="ALPHA" maxLength={5}
                className="w-full bg-dark-300 border border-dark-50 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary-500 uppercase" />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block uppercase tracking-wide">Описание (необязательно)</label>
              <textarea value={createDesc} onChange={e => setCreateDesc(e.target.value)} rows={2} placeholder="О команде..."
                className="w-full bg-dark-300 border border-dark-50 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary-500 resize-none" />
            </div>
            <div className="flex gap-3">
              <button onClick={createTeam} disabled={creating || !createName || !createTag}
                className="btn-primary flex items-center gap-2 disabled:opacity-50">
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                Создать
              </button>
              <button onClick={() => setShowCreate(false)} className="btn-outline">Отмена</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // ─── Team page ───────────────────────────────────────────
  return (
    <div className="min-h-screen bg-dark-300 text-white">
      {/* Header */}
      <header className="bg-dark-100/95 backdrop-blur-md border-b border-dark-50 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="text-gray-400 hover:text-white flex items-center gap-1.5 text-sm">
              <ArrowLeft className="w-4 h-4" /> Назад
            </button>
            <div className="h-5 w-px bg-dark-50" />
            <span className="font-display font-bold text-white">[{team.tag}] {team.name}</span>
          </div>
          <div className="flex items-center gap-2">
            {isCaptain && (
              <button onClick={copyLink} className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-dark-100 border border-dark-50 rounded-lg text-gray-400 hover:text-white transition-colors">
                {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Скопировано' : 'Пригласить'}
              </button>
            )}
            {!isCaptain && isMyTeam && (
              <button onClick={leaveTeam} className="text-xs px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 hover:bg-red-500/20 transition-colors">
                Покинуть
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

        {/* Hero card */}
        <div className="card relative overflow-hidden">
          {/* Background glow */}
          {team.logo_url && (
            <div className="absolute inset-0 opacity-5 blur-2xl scale-110 pointer-events-none">
              <img src={team.logo_url} alt="" className="w-full h-full object-cover" />
            </div>
          )}
          <div className="absolute top-0 left-0 right-0 h-28 bg-gradient-to-br from-primary-500/10 to-transparent pointer-events-none" />

          <div className="relative flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {/* Logo */}
            <div className="relative flex-shrink-0">
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary-500/30 to-dark-100 border border-dark-50 flex items-center justify-center overflow-hidden ring-4 ring-dark-50">
                {team.logo_url
                  ? <img src={team.logo_url} alt="logo" className="w-full h-full object-cover" />
                  : <span className="font-display font-bold text-3xl text-primary-400">{team.tag[0]}</span>
                }
              </div>
              {isCaptain && (
                <label className="absolute -bottom-2 -right-2 w-8 h-8 bg-primary-500 hover:bg-primary-400 rounded-xl flex items-center justify-center cursor-pointer transition-all hover:scale-110 shadow-lg">
                  {uploading ? <Loader2 className="w-3.5 h-3.5 text-white animate-spin" /> : <Upload className="w-3.5 h-3.5 text-white" />}
                  <input type="file" accept="image/*" onChange={uploadLogo} className="hidden" />
                </label>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 text-center sm:text-left">
              {editingName ? (
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <input value={nameVal} onChange={e => setNameVal(e.target.value)} maxLength={32}
                    className="font-display text-xl font-bold bg-dark-300 border border-primary-500 rounded-lg px-2 py-0.5 text-white focus:outline-none" />
                  <input value={tagVal} onChange={e => setTagVal(e.target.value.toUpperCase())} maxLength={5} placeholder="TAG"
                    className="w-20 font-bold bg-dark-300 border border-primary-500 rounded-lg px-2 py-0.5 text-primary-400 focus:outline-none uppercase" />
                  <button onClick={saveName} className="p-1.5 bg-primary-500 rounded-lg text-white"><Save className="w-4 h-4" /></button>
                  <button onClick={() => setEditingName(false)} className="p-1.5 bg-dark-200 rounded-lg text-gray-400"><X className="w-4 h-4" /></button>
                </div>
              ) : (
                <div className="flex items-center gap-2 justify-center sm:justify-start group mb-1">
                  <h1 className="font-display font-bold text-2xl text-white">[{team.tag}] {team.name}</h1>
                  {isCaptain && (
                    <button onClick={() => setEditingName(true)} className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-primary-500">
                      <Edit3 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}

              <div className="flex items-center gap-1.5 justify-center sm:justify-start mb-3">
                <Crown className="w-3.5 h-3.5 text-yellow-400" />
                <span className="text-gray-400 text-sm">
                  Капитан: {members.find(m => m.user_id === team.captain_id)?.profile?.username ?? '—'}
                </span>
                <span className="text-gray-600 text-xs">· {members.length} игроков</span>
              </div>

              {editingDesc ? (
                <div className="space-y-2">
                  <textarea value={descVal} onChange={e => setDescVal(e.target.value)} rows={2} maxLength={300}
                    className="w-full bg-dark-300 border border-dark-50 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-primary-500 resize-none" />
                  <div className="flex gap-2">
                    <button onClick={saveDesc} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-500 rounded-lg text-white text-sm"><Save className="w-3.5 h-3.5" /> Сохранить</button>
                    <button onClick={() => setEditingDesc(false)} className="flex items-center gap-1.5 px-3 py-1.5 bg-dark-200 rounded-lg text-gray-400 text-sm"><X className="w-3.5 h-3.5" /> Отмена</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2 group justify-center sm:justify-start">
                  <p className="text-gray-400 text-sm">{team.description || <span className="text-gray-600 italic">Нет описания</span>}</p>
                  {isCaptain && (
                    <button onClick={() => setEditingDesc(true)} className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-primary-500 shrink-0 mt-0.5">
                      <Edit3 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}

              {/* Stats row */}
              <div className="flex items-center gap-5 mt-4 justify-center sm:justify-start">
                <div className="text-center">
                  <div className="font-display font-bold text-xl text-green-400">{team.wins}</div>
                  <div className="text-gray-500 text-xs">Побед</div>
                </div>
                <div className="w-px h-8 bg-dark-50" />
                <div className="text-center">
                  <div className="font-display font-bold text-xl text-red-400">{team.losses}</div>
                  <div className="text-gray-500 text-xs">Поражений</div>
                </div>
                <div className="w-px h-8 bg-dark-50" />
                <div className="text-center">
                  <div className="font-display font-bold text-xl text-primary-400">{winRate}%</div>
                  <div className="text-gray-500 text-xs">Винрейт</div>
                </div>
                <div className="w-px h-8 bg-dark-50" />
                <div className="text-center">
                  <div className="font-display font-bold text-xl text-white">{members.length}</div>
                  <div className="text-gray-500 text-xs">Игроков</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-dark-200 rounded-xl p-1.5">
          {([
            { id: 'overview', label: 'Обзор',   icon: Star },
            { id: 'roster',   label: 'Состав',  icon: Users },
            { id: 'history',  label: 'История матчей', icon: Swords },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                tab === id ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/30' : 'text-gray-400 hover:text-white'
              }`}>
              <Icon className="w-4 h-4" />
              <span className="hidden sm:block">{label}</span>
            </button>
          ))}
        </div>

        {/* OVERVIEW */}
        {tab === 'overview' && (
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { icon: Trophy,     label: 'Турниров сыграно', value: totalGames,        color: 'text-yellow-400' },
              { icon: TrendingUp, label: 'Серия побед',      value: '—',               color: 'text-primary-400' },
              { icon: Clock,      label: 'Создана',          value: new Date(team.created_at).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' }), color: 'text-blue-400' },
            ].map(({ icon: Icon, label, value, color }) => (
              <div key={label} className="card text-center py-6">
                <Icon className={`w-7 h-7 mx-auto mb-3 ${color}`} />
                <div className={`font-display font-bold text-2xl ${color} mb-1`}>{value}</div>
                <div className="text-gray-500 text-sm">{label}</div>
              </div>
            ))}
          </div>
        )}

        {/* ROSTER */}
        {tab === 'roster' && (
          <div className="space-y-4">
            {/* Invite form (captain only) */}
            {isCaptain && (
              <div className="card">
                <h3 className="font-display font-bold text-sm mb-3 flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-primary-500" /> Добавить игрока
                </h3>
                <div className="flex gap-3">
                  <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && inviteMember()}
                    placeholder="Email игрока"
                    className="flex-1 bg-dark-300 border border-dark-50 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary-500" />
                  <button onClick={inviteMember} disabled={inviting || !inviteEmail}
                    className="btn-primary text-sm py-2 px-4 flex items-center gap-1.5 disabled:opacity-50">
                    {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                    Добавить
                  </button>
                </div>
              </div>
            )}

            {/* Members list */}
            <div className="space-y-2">
              {members.map(m => (
                <div key={m.id} className="card flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center overflow-hidden shrink-0">
                    {m.profile?.avatar_url
                      ? <img src={m.profile.avatar_url} alt="" className="w-full h-full object-cover" />
                      : <span className="font-bold text-white">{(m.profile?.username ?? '?')[0]}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">{m.profile?.username ?? '—'}</span>
                      {m.role === 'captain' && (
                        <span className="flex items-center gap-1 text-yellow-400 text-xs">
                          <Crown className="w-3 h-3" /> Капитан
                        </span>
                      )}
                      {m.profile?.steam_id && (
                        <span className="text-xs px-1.5 py-0.5 bg-[#1b2838]/50 text-[#66c0f4] rounded">Steam</span>
                      )}
                    </div>
                    <p className="text-gray-500 text-xs">
                      в команде с {new Date(m.joined_at).toLocaleDateString('ru', { day: 'numeric', month: 'long' })}
                    </p>
                  </div>
                  {isCaptain && m.user_id !== user.id && (
                    <button onClick={() => kickMember(m.user_id, m.profile?.username ?? '?')}
                      className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors">
                      <UserMinus className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* HISTORY */}
        {tab === 'history' && (
          <div className="space-y-2">
            {history.length === 0 ? (
              <div className="card text-center py-12">
                <Swords className="w-10 h-10 text-gray-700 mx-auto mb-3" />
                <p className="text-gray-500">Матчей пока нет</p>
              </div>
            ) : history.map(m => {
              const isTeam1 = m.team1_name === team.name;
              const myScore  = isTeam1 ? m.score1 : m.score2;
              const oppScore = isTeam1 ? m.score2 : m.score1;
              const opp      = isTeam1 ? m.team2_name : m.team1_name;
              const won      = m.winner_name === team.name;
              return (
                <div key={m.id} className={`card flex items-center gap-4 border ${
                  won ? 'border-green-500/20' : 'border-red-500/10'
                }`}>
                  <div className={`w-2 h-full rounded-full shrink-0 self-stretch ${won ? 'bg-green-500' : 'bg-red-500'}`} style={{ minHeight: 48, width: 3 }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${won ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                        {won ? 'Победа' : 'Поражение'}
                      </span>
                      <span className="text-gray-500 text-xs">{m.round}</span>
                    </div>
                    <p className="text-white font-medium text-sm">vs {opp}</p>
                    <p className="text-gray-500 text-xs">{new Date(m.created_at).toLocaleDateString('ru')}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`font-display font-bold text-xl ${won ? 'text-green-400' : 'text-red-400'}`}>
                      {myScore} : {oppScore}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

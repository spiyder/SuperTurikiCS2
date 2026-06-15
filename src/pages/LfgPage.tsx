// src/pages/LfgPage.tsx
// LFG доска — игроки ищут команду

import { useState, useEffect } from 'react';
import {
  ArrowLeft, Plus, Search, Users, Clock, Crosshair,
  Shield, Target, Zap, Brain, RefreshCw, X, Check,
  MessageSquare, User, Trash2,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { User as SupabaseUser } from '@supabase/supabase-js';

// ─── Types ───────────────────────────────────────────────────

type Role = 'AWPer' | 'Rifler' | 'Entry' | 'Support' | 'IGL';
type Format = '1v1' | '2v2' | '5v5' | 'Любой';
type PlayTime = 'Утро' | 'День' | 'Вечер' | 'Ночь' | 'Любое';

interface LfgPost {
  id: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  steam_id: string | null;
  role: Role;
  format: Format;
  play_time: PlayTime;
  comment: string;
  discord: string;
  created_at: string;
  is_active: boolean;
}

interface Props {
  user: SupabaseUser | null;
  onBack: () => void;
  onOpenLogin: () => void;
}

// ─── Role config ─────────────────────────────────────────────

const ROLE_CONFIG: Record<Role, { icon: React.FC<{className?:string}>; color: string; bg: string; desc: string }> = {
  AWPer:   { icon: Target,     color: 'text-red-400',    bg: 'bg-red-500/20',    desc: 'Снайпер' },
  Rifler:  { icon: Crosshair,  color: 'text-primary-400',bg: 'bg-primary-500/20',desc: 'Рифлер' },
  Entry:   { icon: Zap,        color: 'text-yellow-400', bg: 'bg-yellow-500/20', desc: 'Первый вход' },
  Support: { icon: Shield,     color: 'text-blue-400',   bg: 'bg-blue-500/20',   desc: 'Поддержка' },
  IGL:     { icon: Brain,      color: 'text-purple-400', bg: 'bg-purple-500/20', desc: 'Лидер' },
};

const ROLES: Role[]     = ['AWPer', 'Rifler', 'Entry', 'Support', 'IGL'];
const FORMATS: Format[] = ['1v1', '2v2', '5v5', 'Любой'];
const TIMES: PlayTime[] = ['Утро', 'День', 'Вечер', 'Ночь', 'Любое'];

const TIME_HOURS: Record<PlayTime, string> = {
  Утро: '6:00–12:00', День: '12:00–18:00', Вечер: '18:00–00:00', Ночь: '00:00–6:00', Любое: 'В любое время',
};

// ─── Component ───────────────────────────────────────────────

export function LfgPage({ user, onBack, onOpenLogin }: Props) {
  const [posts, setPosts]       = useState<LfgPost[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterRole, setFilterRole]     = useState<Role | 'all'>('all');
  const [filterFormat, setFilterFormat] = useState<Format | 'all'>('all');
  const [search, setSearch]     = useState('');
  const [myPost, setMyPost]     = useState<LfgPost | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast]       = useState('');

  // Form state
  const [role, setRole]         = useState<Role>('Rifler');
  const [format, setFormat]     = useState<Format>('5v5');
  const [playTime, setPlayTime] = useState<PlayTime>('Вечер');
  const [comment, setComment]   = useState('');
  const [discord, setDiscord]   = useState('');

  const myName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Игрок';

  useEffect(() => { load(); }, []);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('lfg_posts')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    if (data) {
      setPosts(data);
      if (user) setMyPost(data.find(p => p.user_id === user.id) ?? null);
    }
    setLoading(false);
  };

  const submit = async () => {
    if (!user) { onOpenLogin(); return; }
    if (myPost) { showToast('У тебя уже есть активное объявление'); return; }
    setSubmitting(true);

    const { data: profile } = await supabase
      .from('profiles')
      .select('avatar_url, steam_id')
      .eq('id', user.id)
      .single();

    const { data, error } = await supabase.from('lfg_posts').insert({
      user_id:    user.id,
      username:   myName,
      avatar_url: profile?.avatar_url ?? null,
      steam_id:   profile?.steam_id ?? null,
      role, format, play_time: playTime,
      comment: comment.trim(),
      discord: discord.trim(),
      is_active: true,
    }).select().single();

    if (error) { showToast('Ошибка: ' + error.message); }
    else {
      setMyPost(data);
      setShowForm(false);
      showToast('Объявление опубликовано!');
      await load();
    }
    setSubmitting(false);
  };

  const deletePost = async (id: string) => {
    await supabase.from('lfg_posts').update({ is_active: false }).eq('id', id);
    setMyPost(null);
    showToast('Объявление удалено');
    await load();
  };

  // Filtered posts
  const filtered = posts.filter(p => {
    const matchRole   = filterRole === 'all'   || p.role === filterRole;
    const matchFormat = filterFormat === 'all' || p.format === filterFormat || p.format === 'Любой';
    const matchSearch = !search || p.username.toLowerCase().includes(search.toLowerCase()) || p.comment.toLowerCase().includes(search.toLowerCase());
    return matchRole && matchFormat && matchSearch;
  });

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'только что';
    if (m < 60) return `${m} мин назад`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} ч назад`;
    return `${Math.floor(h / 24)} д назад`;
  };

  // ─── Render ───────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-dark-300 text-white">
      {/* Toast */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 px-4 py-3 bg-dark-100 border border-primary-500/40 rounded-xl text-white text-sm shadow-xl animate-slide-up flex items-center gap-2">
          <Check className="w-4 h-4 text-green-400" /> {toast}
        </div>
      )}

      {/* Header */}
      <header className="bg-dark-100/95 backdrop-blur-md border-b border-dark-50 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="text-gray-400 hover:text-white flex items-center gap-1.5 text-sm transition-colors">
              <ArrowLeft className="w-4 h-4" /> Назад
            </button>
            <div className="h-5 w-px bg-dark-50" />
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-primary-500" />
              <span className="font-display font-bold text-white">LFG — Ищу команду</span>
              <span className="px-2 py-0.5 rounded-full bg-primary-500/20 text-primary-400 text-xs font-medium">{posts.length}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="p-2 text-gray-500 hover:text-white transition-colors">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            {myPost ? (
              <button onClick={() => deletePost(myPost.id)}
                className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors">
                <Trash2 className="w-4 h-4" /> Удалить объявление
              </button>
            ) : (
              <button onClick={() => user ? setShowForm(!showForm) : onOpenLogin()}
                className="btn-primary text-sm py-2 px-4 flex items-center gap-1.5">
                <Plus className="w-4 h-4" /> Создать объявление
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">

        {/* Create form */}
        {showForm && (
          <div className="card border-primary-500/30 bg-primary-500/5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-base">Новое объявление</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Role */}
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Роль</p>
              <div className="flex gap-2 flex-wrap">
                {ROLES.map(r => {
                  const cfg = ROLE_CONFIG[r];
                  const Icon = cfg.icon;
                  return (
                    <button key={r} onClick={() => setRole(r)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
                        role === r ? `${cfg.bg} ${cfg.color} border-current` : 'bg-dark-100 border-dark-50 text-gray-400 hover:text-white'
                      }`}>
                      <Icon className="w-4 h-4" /> {r}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Format */}
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Формат</p>
                <div className="flex gap-2 flex-wrap">
                  {FORMATS.map(f => (
                    <button key={f} onClick={() => setFormat(f)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                        format === f ? 'bg-primary-500/20 text-primary-400 border-primary-500/50' : 'bg-dark-100 border-dark-50 text-gray-400 hover:text-white'
                      }`}>
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {/* Play time */}
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Время игры</p>
                <div className="flex gap-2 flex-wrap">
                  {TIMES.map(t => (
                    <button key={t} onClick={() => setPlayTime(t)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                        playTime === t ? 'bg-primary-500/20 text-primary-400 border-primary-500/50' : 'bg-dark-100 border-dark-50 text-gray-400 hover:text-white'
                      }`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Discord */}
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Discord (необязательно)</p>
              <input value={discord} onChange={e => setDiscord(e.target.value)}
                placeholder="username#0000 или ссылка"
                className="w-full bg-dark-300 border border-dark-50 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary-500 placeholder-gray-600" />
            </div>

            {/* Comment */}
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Комментарий (необязательно)</p>
              <textarea value={comment} onChange={e => setComment(e.target.value)} rows={2}
                placeholder="Расскажи о себе, уровне игры, предпочтениях..."
                maxLength={200}
                className="w-full bg-dark-300 border border-dark-50 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary-500 resize-none placeholder-gray-600" />
              <p className="text-gray-600 text-xs mt-1 text-right">{comment.length}/200</p>
            </div>

            <button onClick={submit} disabled={submitting}
              className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50">
              {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Опубликовать
            </button>
          </div>
        )}

        {/* My active post banner */}
        {myPost && (
          <div className="flex items-center gap-3 px-4 py-3 bg-green-500/10 border border-green-500/30 rounded-xl">
            <Check className="w-4 h-4 text-green-400 shrink-0" />
            <p className="text-green-400 text-sm">Твоё объявление активно — капитаны могут написать тебе</p>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Поиск по нику или комментарию..."
              className="w-full bg-dark-100 border border-dark-50 rounded-xl pl-9 pr-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-primary-500" />
          </div>
          <div className="flex gap-2 flex-wrap">
            <select value={filterRole} onChange={e => setFilterRole(e.target.value as typeof filterRole)}
              className="bg-dark-100 border border-dark-50 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-500">
              <option value="all">Все роли</option>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <select value={filterFormat} onChange={e => setFilterFormat(e.target.value as typeof filterFormat)}
              className="bg-dark-100 border border-dark-50 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-500">
              <option value="all">Все форматы</option>
              {FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
        </div>

        {/* Posts */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-6 h-6 text-primary-500 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Users className="w-14 h-14 text-gray-700 mx-auto mb-4" />
            <p className="font-display font-bold text-xl text-white mb-2">Объявлений пока нет</p>
            <p className="text-gray-500 text-sm mb-6">Стань первым — создай объявление и найди команду</p>
            {!user && (
              <button onClick={onOpenLogin} className="btn-primary mx-auto flex items-center gap-2">
                Войти и создать объявление
              </button>
            )}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {filtered.map(post => {
              const cfg = ROLE_CONFIG[post.role];
              const Icon = cfg.icon;
              const isMe = post.user_id === user?.id;
              return (
                <div key={post.id} className={`card relative flex flex-col gap-4 transition-all hover:border-dark-50/80 ${isMe ? 'border-primary-500/30 bg-primary-500/5' : ''}`}>
                  {isMe && (
                    <span className="absolute top-3 right-3 text-xs px-2 py-0.5 bg-primary-500/20 text-primary-400 rounded-full">Моё</span>
                  )}

                  {/* Header */}
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center overflow-hidden shrink-0">
                      {post.avatar_url
                        ? <img src={post.avatar_url} alt="" className="w-full h-full object-cover" />
                        : <span className="font-bold text-white text-lg">{post.username[0]}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-white text-sm truncate">{post.username}</p>
                        {post.steam_id && (
                          <span className="text-xs px-1.5 py-0.5 bg-[#1b2838]/60 text-[#66c0f4] rounded shrink-0">Steam</span>
                        )}
                      </div>
                      <p className="text-gray-500 text-xs">{timeAgo(post.created_at)}</p>
                    </div>
                  </div>

                  {/* Role + badges */}
                  <div className="flex flex-wrap gap-2">
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl ${cfg.bg}`}>
                      <Icon className={`w-4 h-4 ${cfg.color}`} />
                      <span className={`text-sm font-bold ${cfg.color}`}>{post.role}</span>
                      <span className={`text-xs ${cfg.color} opacity-70`}>{cfg.desc}</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-dark-100 border border-dark-50">
                      <Users className="w-3.5 h-3.5 text-gray-400" />
                      <span className="text-xs text-gray-300 font-medium">{post.format}</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-dark-100 border border-dark-50">
                      <Clock className="w-3.5 h-3.5 text-gray-400" />
                      <span className="text-xs text-gray-300">{post.play_time}</span>
                      <span className="text-xs text-gray-600">{TIME_HOURS[post.play_time]}</span>
                    </div>
                  </div>

                  {/* Comment */}
                  {post.comment && (
                    <p className="text-gray-400 text-sm leading-relaxed border-t border-dark-50 pt-3">{post.comment}</p>
                  )}

                  {/* Discord + actions */}
                  <div className="flex items-center justify-between gap-2 mt-auto">
                    {post.discord ? (
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span className="font-mono">{post.discord}</span>
                      </div>
                    ) : (
                      <div />
                    )}
                    {!isMe && user && (
                      <button
                        onClick={() => { navigator.clipboard.writeText(post.discord || post.username); }}
                        className="text-xs px-3 py-1.5 bg-primary-500/20 hover:bg-primary-500/30 text-primary-400 rounded-lg transition-colors flex items-center gap-1">
                        <User className="w-3 h-3" /> Написать
                      </button>
                    )}
                    {isMe && (
                      <button onClick={() => deletePost(post.id)}
                        className="text-xs px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors flex items-center gap-1">
                        <Trash2 className="w-3 h-3" /> Удалить
                      </button>
                    )}
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

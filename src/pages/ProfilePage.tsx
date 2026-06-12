import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft, Camera, User, UserPlus, UserCheck, UserX,
  Search, Trophy, Gamepad2, Shield, Clock, Check, X,
  Users, Edit3, Save, Crosshair, Target, Zap, RefreshCw,
  TrendingUp, Award, Flame, Star,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { TeamTab } from '../components/TeamTab';

interface Profile {
  id: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  steam_id: string | null;
  created_at: string;
}

interface FriendRequest {
  id: number;
  sender_id: string;
  receiver_id: string;
  status: 'pending' | 'accepted' | 'declined';
  sender?: Profile;
  receiver?: Profile;
}

interface CS2Stats {
  kills: number;
  deaths: number;
  wins: number;
  hoursPlayed: number;
  headshotKills: number;
  mvps: number;
  roundsPlayed: number;
  bombsPlanted: number;
  bombsDefused: number;
  kd: string;
  hsPct: number;
  accuracy: number;
  winRate: number;
}

interface ProfilePageProps {
  user: SupabaseUser;
  onBack: () => void;
  onAvatarChange: (url: string | null) => void;
}

export function ProfilePage({ user, onBack, onAvatarChange }: ProfilePageProps) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tab, setTab] = useState<'profile' | 'friends' | 'search' | 'team'>('profile');
  const [uploading, setUploading] = useState(false);
  const [editingBio, setEditingBio] = useState(false);
  const [bioValue, setBioValue] = useState('');
  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameValue, setUsernameValue] = useState('');
  const [friends, setFriends] = useState<Profile[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequest[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [toast, setToast] = useState('');
  const [cs2Stats, setCs2Stats] = useState<CS2Stats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

  useEffect(() => {
    loadProfile();
    loadFriends();
    loadFriendRequests();
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const loadProfile = async () => {
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();

    const metaSteamId = user.user_metadata?.steam_id ?? null;
    const metaAvatar  = user.user_metadata?.avatar_url ?? null;

    if (data) {
      const needsUpdate: Record<string, string> = {};
      if (!data.steam_id && metaSteamId) needsUpdate.steam_id = metaSteamId;
      if (!data.avatar_url && metaAvatar) needsUpdate.avatar_url = metaAvatar;
      if (Object.keys(needsUpdate).length > 0) {
        await supabase.from('profiles').update(needsUpdate).eq('id', user.id);
        Object.assign(data, needsUpdate);
      }
      setProfile(data);
      setBioValue(data.bio || '');
      setUsernameValue(data.username || '');
      if (!data.avatar_url && data.steam_id) syncSteamAvatar(data.steam_id);
      if (data.avatar_url) onAvatarChange(data.avatar_url);
      if (data.steam_id) loadCS2Stats(data.steam_id);
    } else {
      const username = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Игрок';
      const { data: created } = await supabase
        .from('profiles')
        .insert({ id: user.id, username, steam_id: metaSteamId, avatar_url: metaAvatar })
        .select().single();
      if (created) {
        setProfile(created);
        setBioValue('');
        setUsernameValue(created.username || '');
        if (metaSteamId) loadCS2Stats(metaSteamId);
        if (metaAvatar)  onAvatarChange(metaAvatar);
      }
    }
  };

  const linkSteam = () => {
    window.location.href = 'https://pfvfjuvthywxcmzojgyd.supabase.co/functions/v1/steam-auth';
  };

  // Синхронизировать аватар из Steam API
  const syncSteamAvatar = async (steamId: string) => {
    try {
      const res = await fetch(
        `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${import.meta.env.VITE_STEAM_API_KEY}&steamids=${steamId}`
      );
      const data = await res.json();
      const avatar = data?.response?.players?.[0]?.avatarfull;
      if (!avatar) return;
      await supabase.from('profiles').update({ avatar_url: avatar }).eq('id', user.id);
      setProfile(prev => prev ? { ...prev, avatar_url: avatar } : prev);
      onAvatarChange(avatar);
    } catch {}
  };

  // Загрузить CS2 статистику через Edge Function
  const loadCS2Stats = useCallback(async (steamId: string) => {
    setStatsLoading(true);
    setStatsError(null);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/steam-cs2stats?steam_id=${steamId}`, {
        headers: { Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}` },
      });
      const data = await res.json();
      if (data.error) {
        setStatsError('Профиль Steam закрыт или нет статистики CS2');
      } else {
        setCs2Stats(data);
      }
    } catch {
      setStatsError('Не удалось загрузить статистику');
    }
    setStatsLoading(false);
  }, [SUPABASE_URL]);

  const loadFriends = async () => {
    const { data } = await supabase
      .from('friend_requests').select('*').eq('status', 'accepted')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);
    if (!data) return;
    const friendIds = data.map(r => r.sender_id === user.id ? r.receiver_id : r.sender_id);
    if (friendIds.length === 0) return setFriends([]);
    const { data: profiles } = await supabase.from('profiles').select('*').in('id', friendIds);
    setFriends(profiles || []);
  };

  const loadFriendRequests = async () => {
    const { data: incoming } = await supabase
      .from('friend_requests')
      .select('*, sender:profiles!friend_requests_sender_id_fkey(*)')
      .eq('receiver_id', user.id).eq('status', 'pending');
    const { data: outgoing } = await supabase
      .from('friend_requests')
      .select('*, receiver:profiles!friend_requests_receiver_id_fkey(*)')
      .eq('sender_id', user.id).eq('status', 'pending');
    setIncomingRequests((incoming as FriendRequest[]) || []);
    setOutgoingRequests((outgoing as FriendRequest[]) || []);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { showToast('Файл слишком большой. Максимум 2 МБ'); return; }
    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `${user.id}/avatar.${ext}`;
    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (uploadError) { showToast('Ошибка загрузки'); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
    const avatarUrl = urlData.publicUrl + '?t=' + Date.now();
    await supabase.from('profiles').update({ avatar_url: avatarUrl }).eq('id', user.id);
    setProfile(prev => prev ? { ...prev, avatar_url: avatarUrl } : prev);
    onAvatarChange(avatarUrl);
    showToast('Аватар обновлён!');
    setUploading(false);
  };

  const saveBio = async () => {
    const { error } = await supabase.from('profiles').update({ bio: bioValue }).eq('id', user.id);
    if (error) { showToast('Ошибка сохранения'); return; }
    setProfile(prev => prev ? { ...prev, bio: bioValue } : prev);
    setEditingBio(false); showToast('Описание сохранено');
  };

  const saveUsername = async () => {
    const trimmed = usernameValue.trim();
    if (!trimmed || trimmed.length < 3) { showToast('Ник должен быть не менее 3 символов'); return; }
    if (trimmed.length > 24) { showToast('Ник не может быть длиннее 24 символов'); return; }
    const { error } = await supabase.from('profiles').update({ username: trimmed }).eq('id', user.id);
    if (error) { showToast('Ошибка сохранения'); return; }
    setProfile(prev => prev ? { ...prev, username: trimmed } : prev);
    setEditingUsername(false); showToast('Ник обновлён!');
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    const { data } = await supabase.from('profiles').select('*').ilike('username', `%${searchQuery}%`).neq('id', user.id).limit(10);
    setSearchResults(data || []); setSearchLoading(false);
  };

  const sendFriendRequest = async (receiverId: string) => {
    const { data: existing } = await supabase.from('friend_requests').select('*')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${user.id})`)
      .maybeSingle();
    if (existing) { showToast('Запрос уже отправлен или вы уже друзья'); return; }
    await supabase.from('friend_requests').insert({ sender_id: user.id, receiver_id: receiverId, status: 'pending' });
    showToast('Запрос в друзья отправлен!'); loadFriendRequests();
  };

  const acceptRequest  = async (id: number) => { await supabase.from('friend_requests').update({ status: 'accepted' }).eq('id', id); showToast('Друг добавлен!'); loadFriends(); loadFriendRequests(); };
  const declineRequest = async (id: number) => { await supabase.from('friend_requests').update({ status: 'declined' }).eq('id', id); loadFriendRequests(); };
  const removeFriend   = async (friendId: string) => {
    await supabase.from('friend_requests').delete().or(`and(sender_id.eq.${user.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${user.id})`);
    showToast('Друг удалён'); loadFriends();
  };

  const getFriendStatus = (profileId: string) => {
    if (friends.some(f => f.id === profileId)) return 'friends';
    if (outgoingRequests.some(r => r.receiver_id === profileId)) return 'pending_sent';
    if (incomingRequests.some(r => r.sender_id === profileId)) return 'pending_received';
    return 'none';
  };

  const joinedDate = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('ru-RU', { year: 'numeric', month: 'long' })
    : '';

  // ─── CS2 Stats Block ─────────────────────────────────────────
  const CS2StatsBlock = () => {
    if (!profile?.steam_id) return (
      <div className="card border-dashed border-dark-50 bg-transparent text-center py-8">
        <Gamepad2 className="w-10 h-10 text-gray-600 mx-auto mb-3" />
        <p className="text-gray-400 text-sm font-medium mb-1">Привяжи Steam аккаунт</p>
        <p className="text-gray-600 text-xs mb-4">Чтобы видеть статистику CS2 и аватар из Steam</p>
        <button
          onClick={linkSteam}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all bg-[#1b2838] hover:bg-[#2a475e] border border-[#1b2838] hover:border-[#66c0f4] text-white"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.029 4.524 4.524s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.718L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.606 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.497 1.009 2.455-.397.957-1.494 1.409-2.455 1.012zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.252 0-2.265-1.014-2.265-2.265z"/></svg>
          Привязать Steam
        </button>
      </div>
    );

    if (statsLoading) return (
      <div className="card flex items-center justify-center py-10 gap-3">
        <RefreshCw className="w-5 h-5 text-primary-500 animate-spin" />
        <span className="text-gray-400 text-sm">Загружаем статистику CS2…</span>
      </div>
    );

    if (statsError) return (
      <div className="card border-yellow-500/20 bg-yellow-500/5 text-center py-6">
        <Shield className="w-8 h-8 text-yellow-500/50 mx-auto mb-2" />
        <p className="text-yellow-400 text-sm font-medium">{statsError}</p>
        <p className="text-gray-600 text-xs mt-1">Убедись что профиль Steam открыт</p>
        <button onClick={() => loadCS2Stats(profile.steam_id!)} className="mt-3 text-xs px-4 py-1.5 bg-dark-100 border border-dark-50 rounded-lg text-gray-400 hover:text-white transition-colors">
          Попробовать снова
        </button>
      </div>
    );

    if (!cs2Stats) return null;

    const bigStats = [
      { label: 'K/D',         value: cs2Stats.kd,                  icon: Crosshair, color: 'text-primary-400' },
      { label: 'Убийств',     value: cs2Stats.kills.toLocaleString('ru'), icon: Target, color: 'text-red-400' },
      { label: 'Побед',       value: cs2Stats.wins.toLocaleString('ru'), icon: Trophy, color: 'text-yellow-400' },
      { label: 'Часов',       value: cs2Stats.hoursPlayed.toLocaleString('ru'), icon: Clock, color: 'text-blue-400' },
    ];

    const smallStats = [
      { label: 'Хедшоты',  value: `${cs2Stats.hsPct}%`,  icon: Flame },
      { label: 'Точность', value: `${cs2Stats.accuracy}%`, icon: TrendingUp },
      { label: 'Винрейт',  value: `${cs2Stats.winRate}%`,  icon: Star },
      { label: 'MVP',       value: cs2Stats.mvps.toLocaleString('ru'), icon: Award },
      { label: 'Бомб устан.', value: cs2Stats.bombsPlanted.toLocaleString('ru'), icon: Zap },
      { label: 'Бомб обезвр.', value: cs2Stats.bombsDefused.toLocaleString('ru'), icon: Shield },
    ];

    return (
      <div className="space-y-3">
        {/* CS2 баннер */}
        <div className="relative card overflow-hidden p-0">
          {/* Фон баннера */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary-900/40 via-dark-200 to-dark-300" />
          <div className="absolute top-0 right-0 w-48 h-48 bg-primary-500/5 rounded-full -translate-y-1/2 translate-x-1/2" />

          <div className="relative p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-primary-500/20 rounded-lg flex items-center justify-center">
                  <Gamepad2 className="w-4 h-4 text-primary-400" />
                </div>
                <div>
                  <p className="font-display font-bold text-white text-sm">CS2 Статистика</p>
                  <p className="text-gray-500 text-xs">Steam ID: {profile.steam_id}</p>
                </div>
              </div>
              <button
                onClick={() => loadCS2Stats(profile.steam_id!)}
                className="p-1.5 text-gray-500 hover:text-primary-400 transition-colors"
                title="Обновить"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Главные цифры */}
            <div className="grid grid-cols-4 gap-3 mb-4">
              {bigStats.map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="text-center">
                  <Icon className={`w-4 h-4 mx-auto mb-1 ${color}`} />
                  <div className={`font-display font-bold text-xl ${color}`}>{value}</div>
                  <div className="text-gray-500 text-xs">{label}</div>
                </div>
              ))}
            </div>

            {/* Разделитель */}
            <div className="h-px bg-dark-50 mb-4" />

            {/* Мелкая стата */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {smallStats.map(({ label, value, icon: Icon }) => (
                <div key={label} className="bg-dark-300/50 rounded-xl px-2 py-2 text-center">
                  <Icon className="w-3 h-3 text-gray-500 mx-auto mb-1" />
                  <div className="font-bold text-white text-sm">{value}</div>
                  <div className="text-gray-600 text-[10px] leading-tight mt-0.5">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ─── Render ──────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-dark-300">
      {toast && (
        <div className="fixed top-6 right-6 z-[100] px-4 py-3 bg-dark-100 border border-primary-500/50 rounded-xl text-white text-sm shadow-xl animate-slide-up flex items-center gap-2">
          <Check className="w-4 h-4 text-primary-500" /> {toast}
        </div>
      )}

      {/* Header */}
      <div className="sticky top-0 z-50 bg-dark-100/90 backdrop-blur-md border-b border-dark-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-4">
          <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span className="hidden sm:block">Назад</span>
          </button>
          <h1 className="font-display font-bold text-lg text-white">
            Super<span className="text-primary-500">Turiki</span>CS2 — Профиль
          </h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Profile card */}
        <div className="card relative overflow-hidden">
          {/* Баннер — аватар из Steam как фон */}
          {profile?.avatar_url && (
            <div className="absolute inset-0 opacity-10 blur-xl scale-110 pointer-events-none">
              <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
            </div>
          )}
          <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-br from-primary-500/10 to-transparent pointer-events-none" />

          <div className="relative flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center ring-4 ring-dark-50">
                {profile?.avatar_url
                  ? <img src={profile.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                  : <User className="w-12 h-12 text-white" />
                }
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute -bottom-2 -right-2 w-9 h-9 bg-primary-500 hover:bg-primary-400 rounded-xl flex items-center justify-center shadow-lg transition-all hover:scale-110 disabled:opacity-50"
              >
                {uploading
                  ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <Camera className="w-4 h-4 text-white" />
                }
              </button>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarUpload} className="hidden" />
            </div>

            {/* Info */}
            <div className="flex-1 text-center sm:text-left">
              {editingUsername ? (
                <div className="flex items-center gap-2 mb-1">
                  <input value={usernameValue} onChange={e => setUsernameValue(e.target.value)} maxLength={24}
                    onKeyDown={e => { if (e.key === 'Enter') saveUsername(); if (e.key === 'Escape') { setEditingUsername(false); setUsernameValue(profile?.username || ''); } }}
                    autoFocus className="font-display text-2xl font-bold bg-dark-300 border border-primary-500 rounded-lg px-2 py-0.5 text-white focus:outline-none w-full sm:w-auto" />
                  <button onClick={saveUsername} className="p-1.5 bg-primary-500 hover:bg-primary-400 rounded-lg text-white transition-colors flex-shrink-0"><Save className="w-4 h-4" /></button>
                  <button onClick={() => { setEditingUsername(false); setUsernameValue(profile?.username || ''); }} className="p-1.5 bg-dark-200 hover:bg-dark-50 rounded-lg text-gray-400 transition-colors flex-shrink-0"><X className="w-4 h-4" /></button>
                </div>
              ) : (
                <div className="flex items-center justify-center sm:justify-start gap-2 mb-1 group">
                  <h2 className="font-display text-2xl font-bold text-white">{profile?.username || user.email?.split('@')[0]}</h2>
                  {profile?.steam_id && (
                    <span className="px-2 py-0.5 bg-[#1b2838]/80 border border-[#66c0f4]/30 text-[#66c0f4] text-xs rounded-full font-medium">Steam</span>
                  )}
                  <button onClick={() => { setEditingUsername(true); setUsernameValue(profile?.username || ''); }} className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-primary-500">
                    <Edit3 className="w-4 h-4" />
                  </button>
                </div>
              )}
              <p className="text-gray-500 text-sm mb-4">
                {profile?.steam_id ? `Steam: ${profile.steam_id}` : user.email}
              </p>

              {editingBio ? (
                <div className="space-y-2">
                  <textarea value={bioValue} onChange={e => setBioValue(e.target.value)} maxLength={200} rows={3} placeholder="Расскажи о себе..."
                    className="w-full bg-dark-300 border border-dark-50 rounded-xl px-3 py-2 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-primary-500 resize-none" />
                  <div className="flex gap-2">
                    <button onClick={saveBio} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-500 hover:bg-primary-400 rounded-lg text-white text-sm font-medium transition-colors"><Save className="w-3.5 h-3.5" /> Сохранить</button>
                    <button onClick={() => { setEditingBio(false); setBioValue(profile?.bio || ''); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-dark-200 hover:bg-dark-50 rounded-lg text-gray-300 text-sm transition-colors"><X className="w-3.5 h-3.5" /> Отмена</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2 group">
                  <p className="text-gray-400 text-sm flex-1">{profile?.bio || <span className="text-gray-600 italic">Нет описания</span>}</p>
                  <button onClick={() => setEditingBio(true)} className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-primary-500 mt-0.5 flex-shrink-0"><Edit3 className="w-4 h-4" /></button>
                </div>
              )}

              <div className="flex items-center justify-center sm:justify-start gap-5 mt-4">
                <div className="text-center">
                  <div className="font-display font-bold text-primary-500 text-xl">{friends.length}</div>
                  <div className="text-gray-500 text-xs">друзей</div>
                </div>
                <div className="w-px h-8 bg-dark-50" />
                {cs2Stats && (
                  <>
                    <div className="text-center">
                      <div className="font-display font-bold text-red-400 text-xl">{cs2Stats.kd}</div>
                      <div className="text-gray-500 text-xs">K/D</div>
                    </div>
                    <div className="w-px h-8 bg-dark-50" />
                    <div className="text-center">
                      <div className="font-display font-bold text-yellow-400 text-xl">{cs2Stats.wins.toLocaleString('ru')}</div>
                      <div className="text-gray-500 text-xs">побед</div>
                    </div>
                    <div className="w-px h-8 bg-dark-50" />
                  </>
                )}
                <div className="flex items-center gap-1.5 text-gray-500 text-sm">
                  <Clock className="w-4 h-4" />
                  <span>с {joinedDate}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-dark-200 rounded-xl p-1.5 overflow-x-auto">
          {([
            { id: 'profile', label: 'Обзор',         icon: Gamepad2 },
            { id: 'team',    label: 'Моя команда',   icon: Shield },
            { id: 'friends', label: `Друзья${friends.length ? ` (${friends.length})` : ''}`, icon: Users },
            { id: 'search',  label: 'Найти игроков', icon: Search },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                tab === id ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/30' : 'text-gray-400 hover:text-white'
              }`}>
              <Icon className="w-4 h-4" />
              <span className="hidden sm:block">{label}</span>
            </button>
          ))}
        </div>

        {/* PROFILE TAB */}
        {tab === 'profile' && (
          <div className="space-y-4">
            {/* CS2 Statistics */}
            <CS2StatsBlock />

            {/* Pending friend requests */}
            {incomingRequests.length > 0 && (
              <div className="card border-primary-500/30 bg-primary-500/5">
                <h3 className="font-bold text-white mb-3 flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-primary-500" /> Запросы в друзья ({incomingRequests.length})
                </h3>
                <div className="space-y-2">
                  {incomingRequests.map(req => (
                    <div key={req.id} className="flex items-center justify-between gap-3 py-2 border-t border-dark-50">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center overflow-hidden">
                          {(req.sender as any)?.avatar_url
                            ? <img src={(req.sender as any).avatar_url} alt="" className="w-full h-full object-cover rounded-lg" />
                            : <User className="w-4 h-4 text-white" />}
                        </div>
                        <span className="text-white text-sm font-medium">{(req.sender as any)?.username || '?'}</span>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => acceptRequest(req.id)} className="p-1.5 bg-green-500/20 hover:bg-green-500/30 rounded-lg text-green-400 transition-colors"><Check className="w-4 h-4" /></button>
                        <button onClick={() => declineRequest(req.id)} className="p-1.5 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-red-400 transition-colors"><X className="w-4 h-4" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick stats */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { icon: Trophy,  label: 'Турниров', value: '0' },
                { icon: Shield,  label: 'Побед',    value: '0' },
                { icon: Users,   label: 'Друзей',   value: String(friends.length) },
              ].map((s, i) => (
                <div key={i} className="card text-center py-5">
                  <s.icon className="w-6 h-6 text-primary-500 mx-auto mb-2" />
                  <div className="font-display font-bold text-xl text-white">{s.value}</div>
                  <div className="text-gray-500 text-xs mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TEAM TAB */}
        {tab === 'team' && <TeamTab user={user} showToast={showToast} />}

        {/* FRIENDS TAB */}
        {tab === 'friends' && (
          <div className="space-y-3">
            {friends.length === 0 && incomingRequests.length === 0 && (
              <div className="text-center py-16 text-gray-500">
                <Users className="w-12 h-12 mx-auto mb-4 text-gray-700" />
                <p className="font-medium text-gray-400 mb-1">Друзей пока нет</p>
                <p className="text-sm">Найди игроков во вкладке «Найти игроков»</p>
              </div>
            )}
            {incomingRequests.length > 0 && (
              <div>
                <h3 className="text-gray-500 text-xs uppercase tracking-wider mb-2 px-1">Входящие запросы</h3>
                {incomingRequests.map(req => (
                  <div key={req.id} className="card flex items-center justify-between gap-3 mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center overflow-hidden">
                        {(req.sender as any)?.avatar_url ? <img src={(req.sender as any).avatar_url} className="w-full h-full object-cover" alt="" /> : <User className="w-5 h-5 text-white" />}
                      </div>
                      <div>
                        <div className="text-white font-medium text-sm">{(req.sender as any)?.username}</div>
                        <div className="text-gray-500 text-xs">хочет добавить тебя в друзья</div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => acceptRequest(req.id)} className="px-3 py-1.5 bg-primary-500 hover:bg-primary-400 rounded-lg text-white text-xs font-medium transition-colors flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Принять</button>
                      <button onClick={() => declineRequest(req.id)} className="px-3 py-1.5 bg-dark-200 hover:bg-dark-50 rounded-lg text-gray-400 text-xs transition-colors"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {friends.length > 0 && (
              <div>
                <h3 className="text-gray-500 text-xs uppercase tracking-wider mb-2 px-1">Друзья · {friends.length}</h3>
                {friends.map(friend => (
                  <div key={friend.id} className="card flex items-center justify-between gap-3 mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center overflow-hidden">
                        {friend.avatar_url ? <img src={friend.avatar_url} className="w-full h-full object-cover" alt="" /> : <User className="w-5 h-5 text-white" />}
                      </div>
                      <div>
                        <div className="text-white font-medium text-sm">{friend.username}</div>
                        <div className="flex items-center gap-1 text-green-400 text-xs"><UserCheck className="w-3 h-3" /> Друг</div>
                      </div>
                    </div>
                    <button onClick={() => removeFriend(friend.id)} className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"><UserX className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            )}
            {outgoingRequests.length > 0 && (
              <div>
                <h3 className="text-gray-500 text-xs uppercase tracking-wider mb-2 px-1">Отправленные запросы</h3>
                {outgoingRequests.map(req => (
                  <div key={req.id} className="card flex items-center justify-between gap-3 mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center overflow-hidden">
                        {(req.receiver as any)?.avatar_url ? <img src={(req.receiver as any).avatar_url} className="w-full h-full object-cover" alt="" /> : <User className="w-5 h-5 text-white" />}
                      </div>
                      <div>
                        <div className="text-white font-medium text-sm">{(req.receiver as any)?.username}</div>
                        <div className="text-gray-500 text-xs flex items-center gap-1"><Clock className="w-3 h-3" /> Ожидает</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SEARCH TAB */}
        {tab === 'search' && (
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} placeholder="Ник игрока..."
                  className="w-full bg-dark-200 border border-dark-50 rounded-xl pl-9 pr-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-primary-500 transition-colors" />
              </div>
              <button onClick={handleSearch} disabled={searchLoading} className="btn-primary px-5 py-3 flex-shrink-0">
                {searchLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Найти'}
              </button>
            </div>
            {searchResults.length === 0 && searchQuery && !searchLoading && (
              <div className="text-center py-10 text-gray-500">
                <Search className="w-10 h-10 mx-auto mb-3 text-gray-700" />
                <p>Игроки не найдены</p>
              </div>
            )}
            {searchResults.map(p => {
              const status = getFriendStatus(p.id);
              return (
                <div key={p.id} className="card flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {p.avatar_url ? <img src={p.avatar_url} className="w-full h-full object-cover" alt="" /> : <User className="w-5 h-5 text-white" />}
                    </div>
                    <div>
                      <div className="text-white font-semibold text-sm">{p.username}</div>
                      {p.bio && <div className="text-gray-500 text-xs truncate max-w-[180px]">{p.bio}</div>}
                    </div>
                  </div>
                  {status === 'friends' && <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 rounded-lg text-green-400 text-xs font-medium"><UserCheck className="w-3.5 h-3.5" /> Друг</div>}
                  {status === 'pending_sent' && <div className="flex items-center gap-1.5 px-3 py-1.5 bg-dark-200 rounded-lg text-gray-400 text-xs"><Clock className="w-3.5 h-3.5" /> Запрос отправлен</div>}
                  {status === 'pending_received' && (
                    <button onClick={() => acceptRequest(incomingRequests.find(r => r.sender_id === p.id)!.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-500 hover:bg-primary-400 rounded-lg text-white text-xs font-medium transition-colors">
                      <Check className="w-3.5 h-3.5" /> Принять
                    </button>
                  )}
                  {status === 'none' && (
                    <button onClick={() => sendFriendRequest(p.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-500/20 hover:bg-primary-500/30 rounded-lg text-primary-400 hover:text-primary-300 text-xs font-medium transition-colors">
                      <UserPlus className="w-3.5 h-3.5" /> Добавить
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

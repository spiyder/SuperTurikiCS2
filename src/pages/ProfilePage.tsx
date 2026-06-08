import { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft, Camera, User, UserPlus, UserCheck, UserX,
  Search, Trophy, Gamepad2, Shield, Clock, Check, X,
  Users, Edit3, Save,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { User as SupabaseUser } from '@supabase/supabase-js';

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

interface ProfilePageProps {
  user: SupabaseUser;
  onBack: () => void;
  onAvatarChange: (url: string | null) => void;
}

export function ProfilePage({ user, onBack, onAvatarChange }: ProfilePageProps) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tab, setTab] = useState<'profile' | 'friends' | 'search'>('profile');
  const [uploading, setUploading] = useState(false);
  const [editingBio, setEditingBio] = useState(false);
  const [bioValue, setBioValue] = useState('');
  const [friends, setFriends] = useState<Profile[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequest[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [toast, setToast] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (data) {
      setProfile(data);
      setBioValue(data.bio || '');
    } else {
      // Create profile if doesn't exist
      const username = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Игрок';
      const { data: created } = await supabase
        .from('profiles')
        .insert({ id: user.id, username })
        .select()
        .single();
      if (created) {
        setProfile(created);
        setBioValue(created.bio || '');
      }
    }
  };

  const loadFriends = async () => {
    const { data } = await supabase
      .from('friend_requests')
      .select('*')
      .eq('status', 'accepted')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);

    if (!data) return;

    const friendIds = data.map(r =>
      r.sender_id === user.id ? r.receiver_id : r.sender_id
    );

    if (friendIds.length === 0) return setFriends([]);

    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .in('id', friendIds);

    setFriends(profiles || []);
  };

  const loadFriendRequests = async () => {
    // Incoming
    const { data: incoming } = await supabase
      .from('friend_requests')
      .select('*, sender:profiles!friend_requests_sender_id_fkey(*)')
      .eq('receiver_id', user.id)
      .eq('status', 'pending');

    // Outgoing
    const { data: outgoing } = await supabase
      .from('friend_requests')
      .select('*, receiver:profiles!friend_requests_receiver_id_fkey(*)')
      .eq('sender_id', user.id)
      .eq('status', 'pending');

    setIncomingRequests((incoming as FriendRequest[]) || []);
    setOutgoingRequests((outgoing as FriendRequest[]) || []);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      showToast('Файл слишком большой. Максимум 2 МБ');
      return;
    }

    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `${user.id}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true });

    if (uploadError) {
      showToast('Ошибка загрузки. Проверь настройки Supabase Storage (бакет avatars)');
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
    const avatarUrl = urlData.publicUrl + '?t=' + Date.now();

    await supabase.from('profiles').update({ avatar_url: avatarUrl }).eq('id', user.id);
    setProfile(prev => prev ? { ...prev, avatar_url: avatarUrl } : prev);
    onAvatarChange(avatarUrl);
    showToast('Аватар обновлён!');
    setUploading(false);
  };

  const saveBio = async () => {
    await supabase.from('profiles').update({ bio: bioValue }).eq('id', user.id);
    setProfile(prev => prev ? { ...prev, bio: bioValue } : prev);
    setEditingBio(false);
    showToast('Описание сохранено');
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .ilike('username', `%${searchQuery}%`)
      .neq('id', user.id)
      .limit(10);
    setSearchResults(data || []);
    setSearchLoading(false);
  };

  const sendFriendRequest = async (receiverId: string) => {
    // Check if already sent or friends
    const { data: existing } = await supabase
      .from('friend_requests')
      .select('*')
      .or(
        `and(sender_id.eq.${user.id},receiver_id.eq.${receiverId}),` +
        `and(sender_id.eq.${receiverId},receiver_id.eq.${user.id})`
      )
      .maybeSingle();

    if (existing) {
      showToast('Запрос уже отправлен или вы уже друзья');
      return;
    }

    await supabase.from('friend_requests').insert({
      sender_id: user.id,
      receiver_id: receiverId,
      status: 'pending',
    });

    showToast('Запрос в друзья отправлен!');
    loadFriendRequests();
  };

  const acceptRequest = async (requestId: number) => {
    await supabase.from('friend_requests').update({ status: 'accepted' }).eq('id', requestId);
    showToast('Друг добавлен!');
    loadFriends();
    loadFriendRequests();
  };

  const declineRequest = async (requestId: number) => {
    await supabase.from('friend_requests').update({ status: 'declined' }).eq('id', requestId);
    loadFriendRequests();
  };

  const removeFriend = async (friendId: string) => {
    await supabase
      .from('friend_requests')
      .delete()
      .or(
        `and(sender_id.eq.${user.id},receiver_id.eq.${friendId}),` +
        `and(sender_id.eq.${friendId},receiver_id.eq.${user.id})`
      );
    showToast('Друг удалён');
    loadFriends();
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

  return (
    <div className="min-h-screen bg-dark-300">
      {/* Toast */}
      {toast && (
        <div className="fixed top-6 right-6 z-[100] px-4 py-3 bg-dark-100 border border-primary-500/50 rounded-xl text-white text-sm shadow-xl animate-slide-up flex items-center gap-2">
          <Check className="w-4 h-4 text-primary-500" /> {toast}
        </div>
      )}

      {/* Header */}
      <div className="sticky top-0 z-50 bg-dark-100/90 backdrop-blur-md border-b border-dark-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
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
          {/* Background glow */}
          <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-br from-primary-500/10 to-transparent pointer-events-none" />

          <div className="relative flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center ring-4 ring-dark-50">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-12 h-12 text-white" />
                )}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute -bottom-2 -right-2 w-9 h-9 bg-primary-500 hover:bg-primary-400 rounded-xl flex items-center justify-center shadow-lg transition-all hover:scale-110 disabled:opacity-50"
              >
                {uploading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Camera className="w-4 h-4 text-white" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleAvatarUpload}
                className="hidden"
              />
            </div>

            {/* Info */}
            <div className="flex-1 text-center sm:text-left">
              <h2 className="font-display text-2xl font-bold text-white mb-1">
                {profile?.username || user.email?.split('@')[0]}
              </h2>
              <p className="text-gray-500 text-sm mb-4">{user.email}</p>

              {/* Bio */}
              {editingBio ? (
                <div className="space-y-2">
                  <textarea
                    value={bioValue}
                    onChange={e => setBioValue(e.target.value)}
                    maxLength={200}
                    rows={3}
                    placeholder="Расскажи о себе..."
                    className="w-full bg-dark-300 border border-dark-50 rounded-xl px-3 py-2 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-primary-500 resize-none"
                  />
                  <div className="flex gap-2">
                    <button onClick={saveBio} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-500 hover:bg-primary-400 rounded-lg text-white text-sm font-medium transition-colors">
                      <Save className="w-3.5 h-3.5" /> Сохранить
                    </button>
                    <button onClick={() => { setEditingBio(false); setBioValue(profile?.bio || ''); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-dark-200 hover:bg-dark-50 rounded-lg text-gray-300 text-sm transition-colors">
                      <X className="w-3.5 h-3.5" /> Отмена
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2 group">
                  <p className="text-gray-400 text-sm flex-1">
                    {profile?.bio || <span className="text-gray-600 italic">Нет описания</span>}
                  </p>
                  <button
                    onClick={() => setEditingBio(true)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-primary-500 mt-0.5 flex-shrink-0"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Stats row */}
              <div className="flex items-center justify-center sm:justify-start gap-5 mt-4">
                <div className="text-center">
                  <div className="font-display font-bold text-primary-500 text-xl">{friends.length}</div>
                  <div className="text-gray-500 text-xs">друзей</div>
                </div>
                <div className="w-px h-8 bg-dark-50" />
                <div className="flex items-center gap-1.5 text-gray-500 text-sm">
                  <Clock className="w-4 h-4" />
                  <span>с {joinedDate}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-dark-200 rounded-xl p-1.5">
          {([
            { id: 'profile', label: 'Обзор', icon: Gamepad2 },
            { id: 'friends', label: `Друзья${friends.length ? ` (${friends.length})` : ''}`, icon: Users },
            { id: 'search', label: 'Найти игроков', icon: Search },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                tab === id
                  ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/30'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:block">{label}</span>
              <span className="sm:hidden">{id === 'friends' ? friends.length : ''}</span>
            </button>
          ))}
        </div>

        {/* PROFILE TAB */}
        {tab === 'profile' && (
          <div className="space-y-4">
            {/* Incoming requests alert */}
            {incomingRequests.length > 0 && (
              <div className="card border-primary-500/30 bg-primary-500/5">
                <h3 className="font-bold text-white mb-3 flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-primary-500" />
                  Запросы в друзья ({incomingRequests.length})
                </h3>
                <div className="space-y-2">
                  {incomingRequests.map(req => (
                    <div key={req.id} className="flex items-center justify-between gap-3 py-2 border-t border-dark-50">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center">
                          {(req.sender as any)?.avatar_url ? (
                            <img src={(req.sender as any).avatar_url} alt="" className="w-full h-full object-cover rounded-lg" />
                          ) : (
                            <User className="w-4 h-4 text-white" />
                          )}
                        </div>
                        <span className="text-white text-sm font-medium">{(req.sender as any)?.username || '?'}</span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => acceptRequest(req.id)}
                          className="p-1.5 bg-green-500/20 hover:bg-green-500/30 rounded-lg text-green-400 transition-colors"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => declineRequest(req.id)}
                          className="p-1.5 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-red-400 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick stats cards */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { icon: Trophy, label: 'Турниров', value: '0' },
                { icon: Shield, label: 'Побед', value: '0' },
                { icon: Users, label: 'Друзей', value: String(friends.length) },
              ].map((s, i) => (
                <div key={i} className="card text-center py-5">
                  <s.icon className="w-6 h-6 text-primary-500 mx-auto mb-2" />
                  <div className="font-display font-bold text-xl text-white">{s.value}</div>
                  <div className="text-gray-500 text-xs mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Upload hint */}
            <div className="card border-dashed border-dark-50 bg-transparent text-center py-6">
              <Camera className="w-8 h-8 text-gray-600 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">
                Нажми на иконку камеры на аватаре, чтобы загрузить фото
              </p>
              <p className="text-gray-600 text-xs mt-1">JPG, PNG или WebP · не более 2 МБ</p>
            </div>
          </div>
        )}

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
                        {(req.sender as any)?.avatar_url ? (
                          <img src={(req.sender as any).avatar_url} className="w-full h-full object-cover" alt="" />
                        ) : <User className="w-5 h-5 text-white" />}
                      </div>
                      <div>
                        <div className="text-white font-medium text-sm">{(req.sender as any)?.username}</div>
                        <div className="text-gray-500 text-xs">хочет добавить тебя в друзья</div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => acceptRequest(req.id)}
                        className="px-3 py-1.5 bg-primary-500 hover:bg-primary-400 rounded-lg text-white text-xs font-medium transition-colors flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Принять
                      </button>
                      <button onClick={() => declineRequest(req.id)}
                        className="px-3 py-1.5 bg-dark-200 hover:bg-dark-50 rounded-lg text-gray-400 text-xs transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {friends.length > 0 && (
              <div>
                <h3 className="text-gray-500 text-xs uppercase tracking-wider mb-2 px-1">
                  Друзья · {friends.length}
                </h3>
                {friends.map(friend => (
                  <div key={friend.id} className="card flex items-center justify-between gap-3 mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center overflow-hidden">
                        {friend.avatar_url ? (
                          <img src={friend.avatar_url} className="w-full h-full object-cover" alt="" />
                        ) : <User className="w-5 h-5 text-white" />}
                      </div>
                      <div>
                        <div className="text-white font-medium text-sm">{friend.username}</div>
                        <div className="flex items-center gap-1 text-green-400 text-xs">
                          <UserCheck className="w-3 h-3" /> Друг
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => removeFriend(friend.id)}
                      className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      title="Удалить из друзей"
                    >
                      <UserX className="w-4 h-4" />
                    </button>
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
                        {(req.receiver as any)?.avatar_url ? (
                          <img src={(req.receiver as any).avatar_url} className="w-full h-full object-cover" alt="" />
                        ) : <User className="w-5 h-5 text-white" />}
                      </div>
                      <div>
                        <div className="text-white font-medium text-sm">{(req.receiver as any)?.username}</div>
                        <div className="text-gray-500 text-xs flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Ожидает подтверждения
                        </div>
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
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  placeholder="Ник игрока..."
                  className="w-full bg-dark-200 border border-dark-50 rounded-xl pl-9 pr-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-primary-500 transition-colors"
                />
              </div>
              <button
                onClick={handleSearch}
                disabled={searchLoading}
                className="btn-primary px-5 py-3 flex-shrink-0"
              >
                {searchLoading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  'Найти'
                )}
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
                      {p.avatar_url ? (
                        <img src={p.avatar_url} className="w-full h-full object-cover" alt="" />
                      ) : <User className="w-5 h-5 text-white" />}
                    </div>
                    <div>
                      <div className="text-white font-semibold text-sm">{p.username}</div>
                      {p.bio && <div className="text-gray-500 text-xs truncate max-w-[180px]">{p.bio}</div>}
                    </div>
                  </div>

                  {status === 'friends' && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 rounded-lg text-green-400 text-xs font-medium">
                      <UserCheck className="w-3.5 h-3.5" /> Друг
                    </div>
                  )}
                  {status === 'pending_sent' && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-dark-200 rounded-lg text-gray-400 text-xs">
                      <Clock className="w-3.5 h-3.5" /> Запрос отправлен
                    </div>
                  )}
                  {status === 'pending_received' && (
                    <button
                      onClick={() => acceptRequest(incomingRequests.find(r => r.sender_id === p.id)!.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-500 hover:bg-primary-400 rounded-lg text-white text-xs font-medium transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" /> Принять
                    </button>
                  )}
                  {status === 'none' && (
                    <button
                      onClick={() => sendFriendRequest(p.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-500/20 hover:bg-primary-500/30 rounded-lg text-primary-400 hover:text-primary-300 text-xs font-medium transition-colors"
                    >
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

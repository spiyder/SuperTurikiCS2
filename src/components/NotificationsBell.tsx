// src/components/NotificationsBell.tsx
// Колокольчик с уведомлениями — приглашения в команду и др.

import { useState, useEffect, useRef } from 'react';
import { Bell, X, Check, Shield, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { User as SupabaseUser } from '@supabase/supabase-js';

interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  meta: string | null;
  is_read: boolean;
  created_at: string;
}

interface TeamInvite {
  id: string;
  team_id: string;
  team_name: string;
  team_tag: string;
  user_id: string;
  invited_by_name: string;
  status: 'pending' | 'accepted' | 'declined';
}

interface Props {
  user: SupabaseUser;
  onTeamJoined?: () => void;
}

export function NotificationsBell({ user, onTeamJoined }: Props) {
  const [open, setOpen]               = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [invites, setInvites]         = useState<TeamInvite[]>([]);
  const [loading, setLoading]         = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const unread = notifications.filter(n => !n.is_read).length;

  useEffect(() => {
    load();
    // Realtime подписка на новые уведомления
    const ch = supabase.channel(`notifications:${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, () => load())
      .subscribe();
    return () => { ch.unsubscribe(); };
  }, [user.id]);

  // Закрывать при клике вне
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const load = async () => {
    setLoading(true);
    const [nRes, iRes] = await Promise.all([
      supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20),
      supabase.from('team_invites').select('*').eq('user_id', user.id).eq('status', 'pending'),
    ]);
    if (nRes.data) setNotifications(nRes.data);
    if (iRes.data) setInvites(iRes.data);
    setLoading(false);
  };

  const markRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const markAllRead = async () => {
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const acceptInvite = async (invite: TeamInvite) => {
    // Принять приглашение
    await supabase.from('team_invites').update({ status: 'accepted' }).eq('id', invite.id);
    await supabase.from('team_members').insert({ team_id: invite.team_id, user_id: user.id, role: 'member' });
    await supabase.from('profiles').update({ team_id: invite.team_id }).eq('id', user.id);

    // Пометить уведомление как прочитанное
    await supabase.from('notifications').update({ is_read: true })
      .eq('user_id', user.id).eq('type', 'team_invite');

    await load();
    onTeamJoined?.();
  };

  const declineInvite = async (invite: TeamInvite) => {
    await supabase.from('team_invites').update({ status: 'declined' }).eq('id', invite.id);
    await supabase.from('notifications').update({ is_read: true })
      .eq('user_id', user.id).eq('type', 'team_invite');
    await load();
  };

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'только что';
    if (m < 60) return `${m} мин`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} ч`;
    return `${Math.floor(h / 24)} д`;
  };

  return (
    <div className="relative" ref={ref}>
      {/* Bell button */}
      <button onClick={() => setOpen(!open)}
        className="relative p-2 text-gray-400 hover:text-white transition-colors rounded-xl hover:bg-dark-50/50">
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-primary-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-dark-100 border border-dark-50 rounded-2xl shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-dark-50">
            <span className="font-semibold text-white text-sm">Уведомления</span>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button onClick={markAllRead} className="text-xs text-gray-500 hover:text-primary-400 transition-colors">
                  Прочитать все
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-gray-600 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Pending invites first */}
          {invites.length > 0 && (
            <div className="border-b border-dark-50">
              {invites.map(inv => (
                <div key={inv.id} className="px-4 py-3 bg-primary-500/5">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-primary-500/20 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                      <Shield className="w-4 h-4 text-primary-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium leading-tight">
                        Приглашение в команду
                      </p>
                      <p className="text-gray-400 text-xs mt-0.5">
                        <span className="text-primary-400 font-semibold">[{inv.team_tag}] {inv.team_name}</span>
                        {' '}· от {inv.invited_by_name}
                      </p>
                      <div className="flex gap-2 mt-2">
                        <button onClick={() => acceptInvite(inv)}
                          className="flex items-center gap-1 px-3 py-1 bg-primary-500 hover:bg-primary-400 rounded-lg text-white text-xs font-medium transition-colors">
                          <Check className="w-3 h-3" /> Принять
                        </button>
                        <button onClick={() => declineInvite(inv)}
                          className="flex items-center gap-1 px-3 py-1 bg-dark-200 hover:bg-dark-50 rounded-lg text-gray-400 text-xs transition-colors">
                          <X className="w-3 h-3" /> Отклонить
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Notifications list */}
          <div className="max-h-64 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-5 h-5 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
              </div>
            ) : notifications.length === 0 && invites.length === 0 ? (
              <div className="text-center py-10">
                <Bell className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">Уведомлений нет</p>
              </div>
            ) : (
              notifications.map(n => (
                <div key={n.id}
                  onClick={() => !n.is_read && markRead(n.id)}
                  className={`px-4 py-3 border-b border-dark-50/50 last:border-0 cursor-pointer hover:bg-dark-50/30 transition-colors ${!n.is_read ? 'bg-primary-500/5' : ''}`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${!n.is_read ? 'bg-primary-500' : 'bg-transparent'}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-tight ${!n.is_read ? 'text-white font-medium' : 'text-gray-400'}`}>
                        {n.title}
                      </p>
                      {n.body && <p className="text-gray-500 text-xs mt-0.5">{n.body}</p>}
                      <p className="text-gray-600 text-xs mt-1">{timeAgo(n.created_at)} назад</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

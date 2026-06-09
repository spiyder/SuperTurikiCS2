import { useState, useEffect } from 'react';
import {
  Crown, Users, UserPlus, UserX, Edit3, Save, X, Search,
  Check, Shield, Gamepad2, User, AlertCircle, Plus, Trash2,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { User as SupabaseUser } from '@supabase/supabase-js';
 
interface TeamMember {
  user_id: string;
  role: 'captain' | 'member';
  username: string;
  avatar_url: string | null;
}
 
interface Team {
  id: number;
  name: string;
  tag: string;
  captain_id: string;
  created_at: string;
}
 
interface TeamTabProps {
  user: SupabaseUser;
  showToast: (msg: string) => void;
}
 
export function TeamTab({ user, showToast }: TeamTabProps) {
  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
 
  // Create form
  const [newName, setNewName] = useState('');
  const [newTag, setNewTag] = useState('');
 
  // Edit form
  const [editName, setEditName] = useState('');
  const [editTag, setEditTag] = useState('');
 
  // Player search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ id: string; username: string; avatar_url: string | null }[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
 
  useEffect(() => {
    loadTeam();
  }, []);
 
  const loadTeam = async () => {
    setLoading(true);
    const { data: membership } = await supabase
      .from('team_members')
      .select('team_id, role')
      .eq('user_id', user.id)
      .maybeSingle();
 
    if (!membership) { setTeam(null); setMembers([]); setLoading(false); return; }
 
    const { data: teamData } = await supabase
      .from('teams')
      .select('*')
      .eq('id', membership.team_id)
      .single();
 
    if (!teamData) { setTeam(null); setLoading(false); return; }
    setTeam(teamData);
    setEditName(teamData.name);
    setEditTag(teamData.tag);
    await loadMembers(teamData.id);
    setLoading(false);
  };
 
  const loadMembers = async (teamId: number) => {
    const { data } = await supabase
      .from('team_members')
      .select('user_id, role, profiles(id, username, avatar_url)')
      .eq('team_id', teamId);
 
    const enriched: TeamMember[] = (data || []).map((m: any) => ({
      user_id: m.user_id,
      role: m.role,
      username: m.profiles?.username || 'Игрок',
      avatar_url: m.profiles?.avatar_url || null,
    }));
    setMembers(enriched);
  };
 
  const createTeam = async () => {
    const name = newName.trim();
    const tag = newTag.trim().toUpperCase();
    if (!name || name.length < 3) { showToast('Название команды — минимум 3 символа'); return; }
    if (!tag || tag.length < 2 || tag.length > 5) { showToast('Тег: 2–5 символов'); return; }
 
    const { data: created, error } = await supabase
      .from('teams')
      .insert({ name, tag, captain_id: user.id })
      .select()
      .single();
 
    if (error) { showToast('Ошибка создания команды'); return; }
 
    await supabase.from('team_members').insert({ team_id: created.id, user_id: user.id, role: 'captain' });
 
    showToast('Команда создана!');
    setCreating(false);
    setNewName(''); setNewTag('');
    await loadTeam();
  };
 
  const saveTeamEdits = async () => {
    if (!team) return;
    const name = editName.trim();
    const tag = editTag.trim().toUpperCase();
    if (!name || name.length < 3) { showToast('Минимум 3 символа'); return; }
    if (!tag || tag.length < 2 || tag.length > 5) { showToast('Тег: 2–5 символов'); return; }
 
    await supabase.from('teams').update({ name, tag }).eq('id', team.id);
    setTeam(prev => prev ? { ...prev, name, tag } : prev);
    setEditing(false);
    showToast('Команда обновлена');
  };
 
  const disbandTeam = async () => {
    if (!team) return;
    if (!confirm(`Расформировать команду "${team.name}"? Это действие нельзя отменить.`)) return;
    await supabase.from('team_members').delete().eq('team_id', team.id);
    await supabase.from('teams').delete().eq('id', team.id);
    setTeam(null);
    setMembers([]);
    showToast('Команда расформирована');
  };
 
  const leaveTeam = async () => {
    if (!team) return;
    if (!confirm('Покинуть команду?')) return;
    await supabase.from('team_members').delete().eq('team_id', team.id).eq('user_id', user.id);
    setTeam(null);
    setMembers([]);
    showToast('Вы покинули команду');
  };
 
  const searchPlayers = async () => {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .ilike('username', `%${searchQuery}%`)
      .neq('id', user.id)
      .limit(8);
    // Filter out existing members
    const memberIds = members.map(m => m.user_id);
    setSearchResults((data || []).filter(p => !memberIds.includes(p.id)));
    setSearchLoading(false);
  };
 
  const addMember = async (playerId: string, username: string) => {
    if (!team) return;
    if (members.length >= 5) { showToast('В команде уже 5 игроков'); return; }
    setAddingId(playerId);
 
    // Check if player is already on another team
    const { data: existing } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', playerId)
      .maybeSingle();
 
    if (existing) { showToast(`${username} уже состоит в другой команде`); setAddingId(null); return; }
 
    await supabase.from('team_members').insert({ team_id: team.id, user_id: playerId, role: 'member' });
    showToast(`${username} добавлен в команду`);
    setAddingId(null);
    setSearchResults(prev => prev.filter(p => p.id !== playerId));
    await loadMembers(team.id);
  };
 
  const removeMember = async (memberId: string, username: string) => {
    if (!team) return;
    await supabase.from('team_members').delete().eq('team_id', team.id).eq('user_id', memberId);
    showToast(`${username} удалён из команды`);
    await loadMembers(team.id);
  };
 
  const isCaptain = team?.captain_id === user.id;
 
  if (loading) {
    return (
      <div className="text-center py-16">
        <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto" />
      </div>
    );
  }
 
  // ── No team ──────────────────────────────────────────────────────────────────
  if (!team) {
    return (
      <div className="space-y-5">
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-dark-200 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-dark-50">
            <Shield className="w-8 h-8 text-gray-600" />
          </div>
          <p className="font-medium text-gray-300 mb-1">У тебя нет команды</p>
          <p className="text-gray-500 text-sm">Создай свою или попроси капитана добавить тебя</p>
        </div>
 
        {creating ? (
          <div className="card space-y-4">
            <h3 className="font-display font-bold text-white flex items-center gap-2">
              <Plus className="w-4 h-4 text-primary-500" /> Новая команда
            </h3>
            <div>
              <label className="text-gray-400 text-sm block mb-1.5">Название команды</label>
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Team Liquid, Navi, FAZE..."
                maxLength={32}
                className="w-full bg-dark-200 border border-dark-50 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-primary-500 transition-colors"
              />
            </div>
            <div>
              <label className="text-gray-400 text-sm block mb-1.5">Тег (2–5 букв)</label>
              <input
                value={newTag}
                onChange={e => setNewTag(e.target.value.toUpperCase())}
                placeholder="NaVi"
                maxLength={5}
                className="w-full bg-dark-200 border border-dark-50 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-primary-500 transition-colors uppercase tracking-widest"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={createTeam} className="btn-primary flex items-center gap-2 flex-1 justify-center">
                <Check className="w-4 h-4" /> Создать
              </button>
              <button onClick={() => setCreating(false)} className="btn-outline flex-1">
                Отмена
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setCreating(true)}
            className="w-full btn-primary flex items-center justify-center gap-2 py-3"
          >
            <Plus className="w-5 h-5" /> Создать команду
          </button>
        )}
      </div>
    );
  }
 
  // ── Has team ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Team card */}
      <div className="card relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-br from-primary-500/10 to-transparent pointer-events-none" />
        <div className="relative">
          {editing ? (
            <div className="space-y-3 mb-4">
              <input
                value={editName}
                onChange={e => setEditName(e.target.value)}
                maxLength={32}
                placeholder="Название команды"
                className="w-full bg-dark-300 border border-primary-500/50 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-primary-500 font-display font-bold text-xl"
              />
              <input
                value={editTag}
                onChange={e => setEditTag(e.target.value.toUpperCase())}
                maxLength={5}
                placeholder="TAG"
                className="w-full bg-dark-300 border border-dark-50 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-primary-500 uppercase tracking-widest text-sm"
              />
              <div className="flex gap-2">
                <button onClick={saveTeamEdits} className="btn-primary flex items-center gap-1.5 px-4 py-2 text-sm">
                  <Save className="w-3.5 h-3.5" /> Сохранить
                </button>
                <button onClick={() => setEditing(false)} className="px-4 py-2 bg-dark-200 rounded-lg text-gray-400 text-sm hover:text-white transition-colors">
                  Отмена
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="font-display font-bold text-2xl text-white">{team.name}</h2>
                  <span className="px-2 py-0.5 bg-primary-500/20 rounded-lg text-primary-400 text-xs font-bold tracking-widest">[{team.tag}]</span>
                </div>
                <div className="flex items-center gap-3 text-gray-500 text-sm">
                  <span className="flex items-center gap-1.5">
                    <Users className="w-4 h-4" />
                    {members.length}/5 игроков
                  </span>
                  {members.length === 5
                    ? <span className="flex items-center gap-1.5 text-green-400"><Check className="w-3.5 h-3.5" /> Готова к турниру</span>
                    : <span className="text-yellow-400">Нужно ещё {5 - members.length}</span>
                  }
                </div>
              </div>
              {isCaptain && (
                <div className="flex gap-1">
                  <button
                    onClick={() => setEditing(true)}
                    className="p-2 text-gray-500 hover:text-primary-400 hover:bg-primary-500/10 rounded-lg transition-colors"
                    title="Редактировать"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={disbandTeam}
                    className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    title="Расформировать"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}
 
          {/* Slot meter */}
          <div className="mb-5">
            <div className="flex gap-1.5">
              {Array.from({ length: 5 }).map((_, i) => {
                const m = members[i];
                return (
                  <div
                    key={i}
                    className={`flex-1 h-1.5 rounded-full transition-all duration-300 ${
                      m ? 'bg-primary-500' : 'bg-dark-50'
                    }`}
                  />
                );
              })}
            </div>
          </div>
 
          {/* Members list */}
          <div className="space-y-2">
            {members.map(m => (
              <div key={m.user_id} className="flex items-center gap-3 py-2 px-3 bg-dark-300/60 rounded-xl border border-dark-50">
                <div className="w-9 h-9 rounded-lg overflow-hidden bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center flex-shrink-0">
                  {m.avatar_url
                    ? <img src={m.avatar_url} alt="" className="w-full h-full object-cover" />
                    : <User className="w-4 h-4 text-white" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-white font-medium text-sm truncate">{m.username}</div>
                  <div className="flex items-center gap-1 text-xs mt-0.5">
                    {m.role === 'captain'
                      ? <span className="flex items-center gap-1 text-yellow-400"><Crown className="w-3 h-3" /> Капитан</span>
                      : <span className="text-gray-500">Игрок</span>
                    }
                  </div>
                </div>
                {isCaptain && m.user_id !== user.id && (
                  <button
                    onClick={() => removeMember(m.user_id, m.username)}
                    className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors flex-shrink-0"
                    title="Удалить из команды"
                  >
                    <UserX className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
 
            {/* Empty slots */}
            {Array.from({ length: Math.max(0, 5 - members.length) }).map((_, i) => (
              <div key={`empty-${i}`} className="flex items-center gap-3 py-2 px-3 bg-dark-300/30 rounded-xl border border-dashed border-dark-50">
                <div className="w-9 h-9 rounded-lg border border-dashed border-dark-50 flex items-center justify-center flex-shrink-0">
                  <Gamepad2 className="w-4 h-4 text-gray-700" />
                </div>
                <span className="text-gray-600 text-sm italic">Свободный слот</span>
              </div>
            ))}
          </div>
 
          {/* Leave button for non-captain */}
          {!isCaptain && (
            <button
              onClick={leaveTeam}
              className="mt-4 w-full py-2 text-sm text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors border border-transparent hover:border-red-500/20"
            >
              Покинуть команду
            </button>
          )}
        </div>
      </div>
 
      {/* Add players (captain only, room available) */}
      {isCaptain && members.length < 5 && (
        <div className="card space-y-4">
          <h3 className="font-display font-bold text-white flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-primary-500" />
            Добавить игрока
          </h3>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && searchPlayers()}
                placeholder="Ник игрока..."
                className="w-full bg-dark-200 border border-dark-50 rounded-xl pl-9 pr-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-primary-500 transition-colors"
              />
            </div>
            <button
              onClick={searchPlayers}
              disabled={searchLoading}
              className="btn-primary px-5 flex-shrink-0"
            >
              {searchLoading
                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : 'Найти'
              }
            </button>
          </div>
 
          {searchResults.length === 0 && searchQuery && !searchLoading && (
            <p className="text-gray-500 text-sm text-center py-4">Игроки не найдены</p>
          )}
 
          {searchResults.map(p => (
            <div key={p.id} className="flex items-center gap-3 py-2.5 px-3 bg-dark-200 rounded-xl border border-dark-50">
              <div className="w-9 h-9 rounded-lg overflow-hidden bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center flex-shrink-0">
                {p.avatar_url
                  ? <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                  : <User className="w-4 h-4 text-white" />
                }
              </div>
              <span className="flex-1 text-white font-medium text-sm">{p.username}</span>
              <button
                onClick={() => addMember(p.id, p.username)}
                disabled={addingId === p.id}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-500/20 hover:bg-primary-500/30 rounded-lg text-primary-400 text-xs font-medium transition-colors disabled:opacity-50"
              >
                {addingId === p.id
                  ? <div className="w-3.5 h-3.5 border-2 border-primary-400/30 border-t-primary-400 rounded-full animate-spin" />
                  : <><UserPlus className="w-3.5 h-3.5" /> Добавить</>
                }
              </button>
            </div>
          ))}
 
          <div className="flex items-start gap-2 text-gray-600 text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>Игрок будет добавлен, только если он не состоит в другой команде</span>
          </div>
        </div>
      )}
 
      {/* Ready banner */}
      {members.length === 5 && (
        <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
          <Check className="w-5 h-5 text-green-400 flex-shrink-0" />
          <div>
            <div className="text-green-400 font-semibold text-sm">Команда готова!</div>
            <div className="text-green-400/70 text-xs mt-0.5">Можешь регистрироваться на турнир в разделе «Турниры»</div>
          </div>
        </div>
      )}
    </div>
  );
}
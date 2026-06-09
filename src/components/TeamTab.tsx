import { useState, useEffect, useRef } from 'react';
import {
  Crown, Users, UserPlus, UserX, Edit3, Save, Search,
  Check, Shield, Gamepad2, User, AlertCircle, Trash2,
  ChevronDown, ChevronRight, Upload, X, ArrowLeft,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { User as SupabaseUser } from '@supabase/supabase-js';

// ─── Game roles ───────────────────────────────────────────────────────────────
const GAME_ROLES = [
  { value: 'Captain',     label: 'Captain',     color: 'text-yellow-400',  emoji: '👑' },
  { value: 'Open Fragger',label: 'Open Fragger', color: 'text-red-400',    emoji: '🔥' },
  { value: 'Sniper',      label: 'Sniper',       color: 'text-blue-400',   emoji: '🎯' },
  { value: 'Lurker',      label: 'Lurker',       color: 'text-purple-400', emoji: '👤' },
  { value: 'Support',     label: 'Support',      color: 'text-green-400',  emoji: '🛡️' },
] as const;

type GameRoleValue = typeof GAME_ROLES[number]['value'];

function getRoleInfo(role: string) {
  return GAME_ROLES.find(r => r.value === role) ?? { label: role, color: 'text-gray-400', emoji: '🎮' };
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface TeamMember {
  user_id: string;
  role: string;
  username: string;
  avatar_url: string | null;
}

interface Team {
  id: number;
  name: string;
  tag: string;
  description: string | null;
  avatar_url: string | null;
  captain_id: string;
  created_at: string;
}

interface TeamTabProps {
  user: SupabaseUser;
  showToast: (msg: string) => void;
}

// ─── Avatar component ─────────────────────────────────────────────────────────
function Avatar({ src, name, size = 9 }: { src: string | null; name: string; size?: number }) {
  const cls = `w-${size} h-${size} rounded-lg overflow-hidden bg-gradient-to-br from-primary-500/40 to-primary-600/40 border border-dark-50 flex items-center justify-center flex-shrink-0`;
  return (
    <div className={cls}>
      {src
        ? <img src={src} alt={name} className="w-full h-full object-cover" />
        : <User className="w-4 h-4 text-white/50" />
      }
    </div>
  );
}

// ─── Role dropdown ────────────────────────────────────────────────────────────
function RoleDropdown({
  member, members, canChange, onchange,
}: {
  member: TeamMember;
  members: TeamMember[];
  canChange: boolean;
  onchange: (userId: string, role: GameRoleValue) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const info = getRoleInfo(member.role);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!canChange) {
    return (
      <span className={`flex items-center gap-1 text-xs font-medium ${info.color}`}>
        {info.emoji} {info.label}
      </span>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md transition-colors ${info.color} bg-white/5 hover:bg-white/10`}
      >
        {info.emoji} {info.label} <ChevronDown className="w-3 h-3 opacity-60" />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-40 bg-dark-100 border border-dark-50 rounded-xl shadow-2xl shadow-black/60 py-1 min-w-[170px]">
          {GAME_ROLES.map(r => {
            const taken = members.find(m => m.role === r.value && m.user_id !== member.user_id);
            return (
              <button
                key={r.value}
                disabled={!!taken}
                onClick={() => { onchange(member.user_id, r.value); setOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors text-left disabled:opacity-35 ${
                  member.role === r.value
                    ? 'bg-primary-500/20 text-primary-400'
                    : 'text-gray-300 hover:bg-dark-200 hover:text-white'
                }`}
              >
                <span>{r.emoji}</span>
                <span className={r.color}>{r.label}</span>
                {taken && <span className="ml-auto text-gray-600 text-xs truncate max-w-[55px]">{taken.username}</span>}
                {member.role === r.value && <Check className="w-3.5 h-3.5 ml-auto text-primary-400" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function TeamTab({ user, showToast }: TeamTabProps) {
  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'main' | 'create' | 'edit'>('main');

  // Create wizard
  const [step, setStep] = useState(1);
  const [cName, setCName] = useState('');
  const [cTag, setCTag] = useState('');
  const [cDesc, setCDesc] = useState('');
  const [cAvatar, setCAvatar] = useState<string | null>(null);
  const [cAvatarFile, setCAvatarFile] = useState<File | null>(null);
  const [cAvatarPreview, setCAvatarPreview] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Edit form
  const [eName, setEName] = useState('');
  const [eTag, setETag] = useState('');
  const [eDesc, setEDesc] = useState('');
  const [eAvatarFile, setEAvatarFile] = useState<File | null>(null);
  const [eAvatarPreview, setEAvatarPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Player search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ id: string; username: string; avatar_url: string | null }[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);

  useEffect(() => { loadTeam(); }, []);

  const loadTeam = async () => {
    setLoading(true);
    const { data: membership } = await supabase
      .from('team_members')
      .select('team_id')
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
    await loadMembers(teamData.id);
    setLoading(false);
  };

  const loadMembers = async (teamId: number) => {
    // Two-step load to avoid FK join issues
    const { data: rows } = await supabase
      .from('team_members')
      .select('user_id, role')
      .eq('team_id', teamId);

    if (!rows || rows.length === 0) { setMembers([]); return; }

    const userIds = rows.map(r => r.user_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .in('id', userIds);

    const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]));

    const enriched: TeamMember[] = rows.map(r => ({
      user_id: r.user_id,
      role: r.role ?? 'Support',
      username: profileMap[r.user_id]?.username ?? 'Player',
      avatar_url: profileMap[r.user_id]?.avatar_url ?? null,
    }));
    setMembers(enriched);
  };

  // ── Upload avatar ──────────────────────────────────────────────────────────
  const uploadAvatar = async (file: File, path: string): Promise<string | null> => {
    const { error } = await supabase.storage.from('team-avatars').upload(path, file, { upsert: true });
    if (error) return null;
    const { data } = supabase.storage.from('team-avatars').getPublicUrl(path);
    return data.publicUrl;
  };

  // ── Create team wizard ─────────────────────────────────────────────────────
  const handleAvatarPick = (e: React.ChangeEvent<HTMLInputElement>, setFile: (f: File) => void, setPreview: (s: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const submitCreate = async () => {
    const name = cName.trim();
    const tag = cTag.trim().toUpperCase();
    if (!name || name.length < 3) { showToast('Min 3 chars for name'); return; }
    if (!tag || tag.length < 2 || tag.length > 5) { showToast('Tag: 2–5 chars'); return; }

    setCreating(true);

    let avatarUrl: string | null = null;
    if (cAvatarFile) {
      avatarUrl = await uploadAvatar(cAvatarFile, `team_${Date.now()}`);
    }

    const { data: created, error } = await supabase
      .from('teams')
      .insert({ name, tag, captain_id: user.id, description: cDesc.trim() || null, avatar_url: avatarUrl })
      .select()
      .single();

    if (error) { showToast('Error creating team'); setCreating(false); return; }

    await supabase.from('team_members').insert({ team_id: created.id, user_id: user.id, role: 'Captain' });

    showToast('Team created!');
    setCreating(false);
    setView('main');
    setStep(1); setCName(''); setCTag(''); setCDesc(''); setCAvatarPreview(null); setCAvatarFile(null);
    await loadTeam();
  };

  // ── Edit team ──────────────────────────────────────────────────────────────
  const openEdit = () => {
    if (!team) return;
    setEName(team.name);
    setETag(team.tag);
    setEDesc(team.description ?? '');
    setEAvatarPreview(team.avatar_url);
    setEAvatarFile(null);
    setView('edit');
  };

  const submitEdit = async () => {
    if (!team) return;
    const name = eName.trim();
    const tag = eTag.trim().toUpperCase();
    if (!name || name.length < 3) { showToast('Min 3 chars'); return; }
    if (!tag || tag.length < 2 || tag.length > 5) { showToast('Tag: 2–5 chars'); return; }

    setSaving(true);
    let avatarUrl = team.avatar_url;
    if (eAvatarFile) {
      avatarUrl = await uploadAvatar(eAvatarFile, `team_${team.id}`);
    }

    await supabase.from('teams').update({ name, tag, description: eDesc.trim() || null, avatar_url: avatarUrl }).eq('id', team.id);
    showToast('Team updated');
    setSaving(false);
    setView('main');
    await loadTeam();
  };

  // ── Members ────────────────────────────────────────────────────────────────
  const changeRole = async (userId: string, newRole: GameRoleValue) => {
    if (!team) return;
    const conflict = members.find(m => m.role === newRole && m.user_id !== userId);
    if (conflict) { showToast(`${newRole} is already taken by ${conflict.username}`); return; }
    await supabase.from('team_members').update({ role: newRole }).eq('team_id', team.id).eq('user_id', userId);
    setMembers(prev => prev.map(m => m.user_id === userId ? { ...m, role: newRole } : m));
    showToast(`Role updated: ${newRole}`);
  };

  const removeMember = async (memberId: string, username: string) => {
    if (!team) return;
    if (!confirm(`Remove ${username} from the team?`)) return;
    await supabase.from('team_members').delete().eq('team_id', team.id).eq('user_id', memberId);
    showToast(`${username} removed`);
    await loadMembers(team.id);
  };

  const leaveTeam = async () => {
    if (!team) return;
    if (!confirm('Leave team?')) return;
    await supabase.from('team_members').delete().eq('team_id', team.id).eq('user_id', user.id);
    setTeam(null); setMembers([]);
    showToast('You left the team');
  };

  const disbandTeam = async () => {
    if (!team) return;
    if (!confirm(`Disband "${team.name}"? This cannot be undone.`)) return;
    await supabase.from('team_members').delete().eq('team_id', team.id);
    await supabase.from('teams').delete().eq('id', team.id);
    setTeam(null); setMembers([]);
    showToast('Team disbanded');
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
    const memberIds = members.map(m => m.user_id);
    setSearchResults((data || []).filter(p => !memberIds.includes(p.id)));
    setSearchLoading(false);
  };

  const addMember = async (playerId: string, username: string) => {
    if (!team) return;
    if (members.length >= 5) { showToast('Team is full (5/5)'); return; }
    setAddingId(playerId);
    const { data: existing } = await supabase.from('team_members').select('team_id').eq('user_id', playerId).maybeSingle();
    if (existing) { showToast(`${username} is already on another team`); setAddingId(null); return; }
    const usedRoles = members.map(m => m.role);
    const defaultRole = GAME_ROLES.find(r => !usedRoles.includes(r.value))?.value ?? 'Support';
    await supabase.from('team_members').insert({ team_id: team.id, user_id: playerId, role: defaultRole });
    showToast(`${username} added`);
    setAddingId(null);
    setSearchResults(prev => prev.filter(p => p.id !== playerId));
    await loadMembers(team.id);
  };

  const isCaptain = team?.captain_id === user.id;

  // ─────────────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
    </div>
  );

  // ── CREATE WIZARD ──────────────────────────────────────────────────────────
  if (view === 'create') {
    return (
      <div className="space-y-5 max-w-lg mx-auto">
        {/* Progress */}
        <div className="flex items-center gap-2">
          {[1, 2, 3].map(s => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                step > s ? 'bg-primary-500 text-white' :
                step === s ? 'bg-primary-500/80 text-white ring-2 ring-primary-500/40' :
                'bg-dark-200 text-gray-500'
              }`}>
                {step > s ? <Check className="w-3.5 h-3.5" /> : s}
              </div>
              {s < 3 && <div className={`flex-1 h-0.5 rounded-full transition-all ${step > s ? 'bg-primary-500' : 'bg-dark-50'}`} />}
            </div>
          ))}
        </div>

        <div className="card space-y-5">
          {/* Step 1 */}
          {step === 1 && <>
            <div>
              <h3 className="font-display font-bold text-white text-lg mb-0.5">Team Identity</h3>
              <p className="text-gray-500 text-sm">Name and tag that will appear in tournaments</p>
            </div>
            <div>
              <label className="text-gray-400 text-sm block mb-1.5">Team name <span className="text-red-400">*</span></label>
              <input
                value={cName} onChange={e => setCName(e.target.value)} maxLength={32}
                placeholder="Team Liquid, NaVi, FAZE..."
                className="w-full bg-dark-200 border border-dark-50 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-primary-500 transition-colors"
              />
            </div>
            <div>
              <label className="text-gray-400 text-sm block mb-1.5">Tag (2–5 chars) <span className="text-red-400">*</span></label>
              <input
                value={cTag} onChange={e => setCTag(e.target.value.toUpperCase())} maxLength={5}
                placeholder="NAVI"
                className="w-full bg-dark-200 border border-dark-50 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-primary-500 transition-colors uppercase tracking-widest"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setView('main')} className="flex-1 py-3 bg-dark-200 rounded-xl text-gray-400 hover:text-white transition-colors">Cancel</button>
              <button
                onClick={() => {
                  if (!cName.trim() || cName.trim().length < 3) { showToast('Min 3 chars'); return; }
                  if (!cTag.trim() || cTag.trim().length < 2) { showToast('Tag: 2–5 chars'); return; }
                  setStep(2);
                }}
                className="flex-1 btn-primary py-3 flex items-center justify-center gap-2"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </>}

          {/* Step 2 */}
          {step === 2 && <>
            <div>
              <h3 className="font-display font-bold text-white text-lg mb-0.5">About the team</h3>
              <p className="text-gray-500 text-sm">Tell players what your team is about</p>
            </div>
            <div>
              <label className="text-gray-400 text-sm block mb-1.5">Description <span className="text-gray-600 text-xs">(optional)</span></label>
              <textarea
                value={cDesc} onChange={e => setCDesc(e.target.value)} maxLength={300} rows={4}
                placeholder="Your playstyle, goals, requirements..."
                className="w-full bg-dark-200 border border-dark-50 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-primary-500 transition-colors resize-none"
              />
              <div className="text-right text-gray-600 text-xs mt-1">{cDesc.length}/300</div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex-1 py-3 bg-dark-200 rounded-xl text-gray-400 hover:text-white transition-colors flex items-center justify-center gap-2"><ArrowLeft className="w-4 h-4" /> Back</button>
              <button onClick={() => setStep(3)} className="flex-1 btn-primary py-3 flex items-center justify-center gap-2">Next <ChevronRight className="w-4 h-4" /></button>
            </div>
          </>}

          {/* Step 3 */}
          {step === 3 && <>
            <div>
              <h3 className="font-display font-bold text-white text-lg mb-0.5">Team avatar</h3>
              <p className="text-gray-500 text-sm">Upload a logo for your team</p>
            </div>
            <div className="flex flex-col items-center gap-4">
              <div className="w-24 h-24 rounded-2xl overflow-hidden bg-dark-200 border-2 border-dashed border-dark-50 flex items-center justify-center">
                {cAvatarPreview
                  ? <img src={cAvatarPreview} alt="" className="w-full h-full object-cover" />
                  : <Gamepad2 className="w-10 h-10 text-gray-600" />
                }
              </div>
              <label className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-dark-200 hover:bg-dark-50/20 border border-dark-50 rounded-xl text-gray-300 text-sm transition-colors">
                <Upload className="w-4 h-4" /> Choose image
                <input type="file" accept="image/*" className="hidden" onChange={e => handleAvatarPick(e, setCAvatarFile, setCAvatarPreview)} />
              </label>
              {cAvatarPreview && (
                <button onClick={() => { setCAvatarPreview(null); setCAvatarFile(null); }} className="text-gray-500 hover:text-red-400 text-xs transition-colors">Remove</button>
              )}
            </div>

            {/* Summary */}
            <div className="bg-dark-200 rounded-xl p-4 border border-dark-50 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Name</span><span className="text-white font-medium">{cName}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Tag</span><span className="text-primary-400 font-bold">[{cTag}]</span></div>
              {cDesc && <div className="flex justify-between gap-4"><span className="text-gray-500 flex-shrink-0">About</span><span className="text-gray-300 text-right truncate">{cDesc}</span></div>}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="flex-1 py-3 bg-dark-200 rounded-xl text-gray-400 hover:text-white transition-colors flex items-center justify-center gap-2"><ArrowLeft className="w-4 h-4" /> Back</button>
              <button onClick={submitCreate} disabled={creating} className="flex-1 btn-primary py-3 flex items-center justify-center gap-2 disabled:opacity-60">
                {creating ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Check className="w-4 h-4" /> Create team</>}
              </button>
            </div>
          </>}
        </div>
      </div>
    );
  }

  // ── EDIT VIEW ──────────────────────────────────────────────────────────────
  if (view === 'edit' && team) {
    return (
      <div className="space-y-5 max-w-lg mx-auto">
        <div className="flex items-center gap-3">
          <button onClick={() => setView('main')} className="p-2 text-gray-400 hover:text-white hover:bg-dark-200 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h3 className="font-display font-bold text-white text-lg">Edit team</h3>
        </div>
        <div className="card space-y-5">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl overflow-hidden bg-dark-200 border border-dark-50 flex items-center justify-center flex-shrink-0">
              {eAvatarPreview
                ? <img src={eAvatarPreview} alt="" className="w-full h-full object-cover" />
                : <Gamepad2 className="w-7 h-7 text-gray-600" />
              }
            </div>
            <div className="space-y-1.5">
              <label className="cursor-pointer flex items-center gap-2 px-3 py-1.5 bg-dark-200 hover:bg-dark-50/20 border border-dark-50 rounded-lg text-gray-300 text-sm transition-colors">
                <Upload className="w-3.5 h-3.5" /> Change logo
                <input type="file" accept="image/*" className="hidden" onChange={e => handleAvatarPick(e, setEAvatarFile, setEAvatarPreview)} />
              </label>
              {eAvatarPreview && (
                <button onClick={() => { setEAvatarPreview(null); setEAvatarFile(null); }} className="text-gray-600 hover:text-red-400 text-xs transition-colors block">Remove</button>
              )}
            </div>
          </div>

          <div>
            <label className="text-gray-400 text-sm block mb-1.5">Team name</label>
            <input value={eName} onChange={e => setEName(e.target.value)} maxLength={32}
              className="w-full bg-dark-200 border border-dark-50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary-500 transition-colors" />
          </div>
          <div>
            <label className="text-gray-400 text-sm block mb-1.5">Tag</label>
            <input value={eTag} onChange={e => setETag(e.target.value.toUpperCase())} maxLength={5}
              className="w-full bg-dark-200 border border-dark-50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary-500 transition-colors uppercase tracking-widest" />
          </div>
          <div>
            <label className="text-gray-400 text-sm block mb-1.5">Description</label>
            <textarea value={eDesc} onChange={e => setEDesc(e.target.value)} maxLength={300} rows={3}
              className="w-full bg-dark-200 border border-dark-50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary-500 transition-colors resize-none" />
          </div>
          <div className="flex gap-3">
            <button onClick={() => setView('main')} className="flex-1 py-3 bg-dark-200 rounded-xl text-gray-400 hover:text-white transition-colors">Cancel</button>
            <button onClick={submitEdit} disabled={saving} className="flex-1 btn-primary py-3 flex items-center justify-center gap-2 disabled:opacity-60">
              {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Save className="w-4 h-4" /> Save</>}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── NO TEAM ────────────────────────────────────────────────────────────────
  if (!team) {
    return (
      <div className="space-y-5">
        <div className="text-center py-14">
          <div className="w-16 h-16 bg-dark-200 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-dark-50">
            <Shield className="w-8 h-8 text-gray-600" />
          </div>
          <p className="font-medium text-gray-300 mb-1">You're not on a team</p>
          <p className="text-gray-500 text-sm">Create your own or ask a captain to add you</p>
        </div>
        <button onClick={() => { setStep(1); setView('create'); }} className="w-full btn-primary flex items-center justify-center gap-2 py-3">
          <Users className="w-5 h-5" /> Create a team
        </button>
      </div>
    );
  }

  // ── MAIN TEAM VIEW ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Team header card */}
      <div className="card relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-br from-primary-500/10 to-transparent pointer-events-none" />
        <div className="relative">
          {/* Header */}
          <div className="flex items-start gap-4 mb-5">
            <div className="w-14 h-14 rounded-xl overflow-hidden bg-dark-200 border border-dark-50 flex items-center justify-center flex-shrink-0">
              {team.avatar_url
                ? <img src={team.avatar_url} alt={team.name} className="w-full h-full object-cover" />
                : <Gamepad2 className="w-7 h-7 text-gray-500" />
              }
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-display font-bold text-2xl text-white leading-tight">{team.name}</h2>
                <span className="px-2 py-0.5 bg-primary-500/20 rounded-lg text-primary-400 text-xs font-bold tracking-widest">[{team.tag}]</span>
              </div>
              <div className="flex items-center gap-3 text-gray-500 text-sm mt-1 flex-wrap">
                <span className="flex items-center gap-1.5"><Users className="w-4 h-4" />{members.length}/5</span>
                {members.length === 5
                  ? <span className="flex items-center gap-1.5 text-green-400"><Check className="w-3.5 h-3.5" /> Ready</span>
                  : <span className="text-yellow-400">Need {5 - members.length} more</span>
                }
              </div>
              {team.description && <p className="text-gray-400 text-sm mt-1.5 line-clamp-2">{team.description}</p>}
            </div>
            {isCaptain && (
              <div className="flex gap-1 flex-shrink-0">
                <button onClick={openEdit} className="p-2 text-gray-500 hover:text-primary-400 hover:bg-primary-500/10 rounded-lg transition-colors" title="Edit"><Edit3 className="w-4 h-4" /></button>
                <button onClick={disbandTeam} className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors" title="Disband"><Trash2 className="w-4 h-4" /></button>
              </div>
            )}
          </div>

          {/* Slot bar */}
          <div className="flex gap-1.5 mb-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className={`flex-1 h-1.5 rounded-full transition-all duration-500 ${i < members.length ? 'bg-primary-500' : 'bg-dark-50'}`} />
            ))}
          </div>

          {/* Members */}
          <div className="space-y-2">
            {members.map(m => (
              <div key={m.user_id} className="flex items-center gap-3 py-2.5 px-3 bg-dark-300/60 rounded-xl border border-dark-50">
                <Avatar src={m.avatar_url} name={m.username} size={9} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-white font-medium text-sm truncate">{m.username}</span>
                    {m.user_id === team.captain_id && <Crown className="w-3 h-3 text-yellow-400 flex-shrink-0" />}
                  </div>
                  <RoleDropdown
                    member={m}
                    members={members}
                    canChange={isCaptain || m.user_id === user.id}
                    onchange={changeRole}
                  />
                </div>
                {isCaptain && m.user_id !== user.id && (
                  <button onClick={() => removeMember(m.user_id, m.username)} className="p-1.5 text-gray-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors flex-shrink-0">
                    <UserX className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}

            {/* Empty slots */}
            {Array.from({ length: Math.max(0, 5 - members.length) }).map((_, i) => (
              <div key={`empty-${i}`} className="flex items-center gap-3 py-2.5 px-3 bg-dark-300/20 rounded-xl border border-dashed border-dark-50/50">
                <div className="w-9 h-9 rounded-lg border border-dashed border-dark-50 flex items-center justify-center flex-shrink-0">
                  <Gamepad2 className="w-4 h-4 text-gray-700" />
                </div>
                <span className="text-gray-600 text-sm italic">Open slot</span>
              </div>
            ))}
          </div>

          {!isCaptain && (
            <button onClick={leaveTeam} className="mt-4 w-full py-2 text-sm text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors border border-transparent hover:border-red-500/20">
              Leave team
            </button>
          )}
        </div>
      </div>

      {/* Add players (captain only) */}
      {isCaptain && members.length < 5 && (
        <div className="card space-y-4">
          <h3 className="font-display font-bold text-white flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-primary-500" /> Add player
          </h3>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && searchPlayers()}
                placeholder="Search by username..."
                className="w-full bg-dark-200 border border-dark-50 rounded-xl pl-9 pr-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-primary-500 transition-colors"
              />
            </div>
            <button onClick={searchPlayers} disabled={searchLoading} className="btn-primary px-5 flex-shrink-0">
              {searchLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Find'}
            </button>
          </div>

          {searchResults.length === 0 && searchQuery && !searchLoading && (
            <p className="text-gray-500 text-sm text-center py-3">No players found</p>
          )}

          {searchResults.map(p => (
            <div key={p.id} className="flex items-center gap-3 py-2.5 px-3 bg-dark-200 rounded-xl border border-dark-50">
              <Avatar src={p.avatar_url} name={p.username} size={9} />
              <span className="flex-1 text-white font-medium text-sm">{p.username}</span>
              <button
                onClick={() => addMember(p.id, p.username)} disabled={addingId === p.id}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-500/20 hover:bg-primary-500/30 rounded-lg text-primary-400 text-xs font-medium transition-colors disabled:opacity-50"
              >
                {addingId === p.id
                  ? <div className="w-3.5 h-3.5 border-2 border-primary-400/30 border-t-primary-400 rounded-full animate-spin" />
                  : <><UserPlus className="w-3.5 h-3.5" /> Add</>
                }
              </button>
            </div>
          ))}

          <div className="flex items-start gap-2 text-gray-600 text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>Player can only be added if they're not on another team</span>
          </div>
        </div>
      )}

      {/* Ready banner */}
      {members.length === 5 && (
        <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
          <Check className="w-5 h-5 text-green-400 flex-shrink-0" />
          <div>
            <div className="text-green-400 font-semibold text-sm">Team is ready!</div>
            <div className="text-green-400/70 text-xs mt-0.5">You can now register for a tournament</div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useRef, useEffect } from 'react';
import { User, LogOut, UserCircle, ChevronDown } from 'lucide-react';
import type { User as SupabaseUser } from '@supabase/supabase-js';

interface ProfileDropdownProps {
  user: SupabaseUser;
  avatarUrl: string | null;
  onLogout: () => void;
  onOpenProfile: () => void;
}

export function ProfileDropdown({ user, avatarUrl, onLogout, onOpenProfile }: ProfileDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const getUserName = () =>
    user.user_metadata?.full_name || user.email?.split('@')[0] || 'Игрок';

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-2 py-1.5 bg-dark-200 border border-dark-50 rounded-xl hover:border-primary-500/50 transition-all group"
      >
        {/* Avatar */}
        <div className="w-8 h-8 rounded-lg overflow-hidden bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center flex-shrink-0">
          {avatarUrl ? (
            <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
          ) : (
            <User className="w-4 h-4 text-white" />
          )}
        </div>
        <span className="text-white text-sm font-medium max-w-[100px] truncate hidden sm:block">
          {getUserName()}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 transition-transform hidden sm:block ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-52 bg-dark-100 border border-dark-50 rounded-xl shadow-2xl shadow-black/50 overflow-hidden z-50 animate-slide-up">
          {/* User info */}
          <div className="px-4 py-3 border-b border-dark-50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg overflow-hidden bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center flex-shrink-0">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-5 h-5 text-white" />
                )}
              </div>
              <div className="min-w-0">
                <div className="text-white text-sm font-semibold truncate">{getUserName()}</div>
                <div className="text-gray-500 text-xs truncate">{user.email}</div>
              </div>
            </div>
          </div>

          {/* Menu items */}
          <div className="p-1.5">
            <button
              onClick={() => { setOpen(false); onOpenProfile(); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-300 hover:bg-dark-50 hover:text-white transition-colors text-sm"
            >
              <UserCircle className="w-4 h-4 text-primary-500" />
              Мой профиль
            </button>
            <button
              onClick={() => { setOpen(false); onLogout(); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-300 hover:bg-red-500/10 hover:text-red-400 transition-colors text-sm"
            >
              <LogOut className="w-4 h-4" />
              Выйти
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

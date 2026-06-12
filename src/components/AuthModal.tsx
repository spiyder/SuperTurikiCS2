// src/components/AuthModal.tsx
// Модальное окно авторизации: Steam, Google, email/пароль

import { useState } from 'react';
import { X, Mail, Lock, User, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

// ── Steam icon (SVG) ────────────────────────────────────────
function SteamIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.029 4.524 4.524s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.718L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.606 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.497 1.009 2.455-.397.957-1.494 1.409-2.455 1.012zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.252 0-2.265-1.014-2.265-2.265z"/>
    </svg>
  );
}

// ── Google icon ──────────────────────────────────────────────
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

// ── Props ────────────────────────────────────────────────────
interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register';
}

// ── Component ────────────────────────────────────────────────
export function AuthModal({ isOpen, onClose, initialMode = 'login' }: Props) {
  const [mode, setMode]       = useState<'login' | 'register'>(initialMode);
  const [email, setEmail]     = useState('');
  const [password, setPass]   = useState('');
  const [username, setUser]   = useState('');
  const [loading, setLoading] = useState<string | null>(null); // 'email' | 'google' | 'steam'
  const [error, setError]     = useState<string | null>(null);
  const [done, setDone]       = useState(false);

  if (!isOpen) return null;

  const reset = () => { setError(null); setDone(false); };

  // ── Steam ────────────────────────────────────────────────
  const handleSteam = () => {
    setLoading('steam');
    // Edge Function URL: https://<project>.supabase.co/functions/v1/steam-auth
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    window.location.href = `${supabaseUrl}/functions/v1/steam-auth`;
  };

  // ── Google ───────────────────────────────────────────────
  const handleGoogle = async () => {
    setLoading('google'); reset();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) { setError(error.message); setLoading(null); }
  };

  // ── Email ────────────────────────────────────────────────
  const handleEmail = async () => {
    if (!email || !password) { setError('Заполни email и пароль'); return; }
    setLoading('email'); reset();

    if (mode === 'register') {
      if (!username.trim()) { setError('Введи никнейм'); setLoading(null); return; }
      if (password.length < 6) { setError('Пароль минимум 6 символов'); setLoading(null); return; }

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: username.trim() } },
      });
      if (error) { setError(error.message); }
      else       { setDone(true); }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { setError('Неверный email или пароль'); }
      else       { onClose(); }
    }
    setLoading(null);
  };

  const handleKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter') handleEmail(); };

  // ─── Render ──────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-dark-200 border border-dark-50 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header gradient */}
        <div className="h-1 bg-gradient-to-r from-primary-600 via-primary-500 to-primary-400" />

        <div className="p-6">
          {/* Close */}
          <button onClick={onClose} className="absolute top-5 right-5 text-gray-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>

          {/* Title */}
          <div className="mb-6">
            <h2 className="font-display font-bold text-2xl text-white">
              {mode === 'login' ? 'Вход' : 'Регистрация'}
            </h2>
            <p className="text-gray-400 text-sm mt-1">
              {mode === 'login' ? 'Рады видеть тебя снова' : 'Присоединяйся к SuperTurikiCS2'}
            </p>
          </div>

          {/* Success */}
          {done && (
            <div className="mb-4 p-4 bg-green-500/10 border border-green-500/30 rounded-xl text-green-400 text-sm">
              📬 Проверь почту — мы отправили письмо для подтверждения.
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {!done && (
            <>
              {/* ── Steam button ── */}
              <button
                onClick={handleSteam}
                disabled={!!loading}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 mb-3 rounded-xl font-semibold text-sm transition-all
                           bg-[#1b2838] hover:bg-[#2a475e] border border-[#1b2838] hover:border-[#66c0f4]
                           text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading === 'steam'
                  ? <Loader2 className="w-5 h-5 animate-spin" />
                  : <SteamIcon className="w-5 h-5" />
                }
                {loading === 'steam' ? 'Перенаправление...' : 'Войти через Steam'}
              </button>

              {/* ── Google button ── */}
              <button
                onClick={handleGoogle}
                disabled={!!loading}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 mb-5 rounded-xl font-semibold text-sm transition-all
                           bg-white hover:bg-gray-100 text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading === 'google'
                  ? <Loader2 className="w-5 h-5 animate-spin text-gray-600" />
                  : <GoogleIcon className="w-5 h-5" />
                }
                {loading === 'google' ? 'Подключение...' : 'Войти через Google'}
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3 mb-5">
                <div className="flex-1 h-px bg-dark-50" />
                <span className="text-gray-600 text-xs">или через email</span>
                <div className="flex-1 h-px bg-dark-50" />
              </div>

              {/* ── Email form ── */}
              <div className="space-y-3">
                {mode === 'register' && (
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                      value={username}
                      onChange={e => setUser(e.target.value)}
                      onKeyDown={handleKey}
                      placeholder="Никнейм"
                      className="w-full bg-dark-300 border border-dark-50 rounded-xl pl-10 pr-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-primary-500 transition-colors"
                    />
                  </div>
                )}
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    onKeyDown={handleKey}
                    placeholder="Email"
                    className="w-full bg-dark-300 border border-dark-50 rounded-xl pl-10 pr-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-primary-500 transition-colors"
                  />
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPass(e.target.value)}
                    onKeyDown={handleKey}
                    placeholder="Пароль"
                    className="w-full bg-dark-300 border border-dark-50 rounded-xl pl-10 pr-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-primary-500 transition-colors"
                  />
                </div>

                <button
                  onClick={handleEmail}
                  disabled={!!loading}
                  className="w-full btn-primary py-3 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading === 'email' && <Loader2 className="w-4 h-4 animate-spin" />}
                  {mode === 'login' ? 'Войти' : 'Создать аккаунт'}
                </button>
              </div>

              {/* Toggle mode */}
              <p className="text-center text-gray-500 text-sm mt-5">
                {mode === 'login' ? 'Нет аккаунта?' : 'Уже есть аккаунт?'}
                {' '}
                <button
                  onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); reset(); }}
                  className="text-primary-400 hover:text-primary-300 font-medium transition-colors"
                >
                  {mode === 'login' ? 'Зарегистрироваться' : 'Войти'}
                </button>
              </p>

              {/* Steam disclaimer */}
              <p className="text-center text-gray-700 text-xs mt-3">
                При входе через Steam мы получаем только ник и аватар — без доступа к инвентарю и играм.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// src/hooks/useSteamAuth.ts
// Обрабатывает редирект после Steam авторизации.
// Суpabase получает hashed_token → verifyOtp → сессия создана.

import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useSteamAuth(onSuccess?: () => void) {
  useEffect(() => {
    const url    = new URL(window.location.href);
    const token  = url.searchParams.get('steam_token');
    const error  = url.searchParams.get('auth_error');

    // Убираем параметры из URL сразу
    if (token || error) {
      url.searchParams.delete('steam_token');
      url.searchParams.delete('steam_user');
      url.searchParams.delete('auth_error');
      window.history.replaceState({}, '', url.toString());
    }

    if (error) {
      console.error('Steam auth error:', error);
      return;
    }

    if (!token) return;

    // Верифицируем magic link токен — Supabase создаст сессию
    supabase.auth
      .verifyOtp({ token_hash: token, type: 'magiclink' })
      .then(({ error: otpError }) => {
        if (otpError) {
          console.error('Steam OTP error:', otpError.message);
        } else {
          onSuccess?.();
        }
      });
  }, []);
}

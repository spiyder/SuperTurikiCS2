// supabase/functions/steam-callback/index.ts
// Принимает ответ от Steam, верифицирует OpenID, создаёт/находит юзера в Supabase
// и редиректит на сайт с токеном сессии.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL        = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const STEAM_API_KEY       = Deno.env.get('STEAM_API_KEY')!;

// URL сайта куда вернуть пользователя после входа
// Поменяй на свой домен в продакшене
const SITE_URL = Deno.env.get('SITE_URL') ?? 'http://localhost:5173';

serve(async (req) => {
  const url = new URL(req.url);
  const params = url.searchParams;

  // ── 1. Верификация OpenID у Steam ─────────────────────────
  const verifyParams = new URLSearchParams(params);
  verifyParams.set('openid.mode', 'check_authentication');

  const verifyRes = await fetch('https://steamcommunity.com/openid/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: verifyParams.toString(),
  });

  const verifyText = await verifyRes.text();

  if (!verifyText.includes('is_valid:true')) {
    return Response.redirect(`${SITE_URL}?auth_error=steam_invalid`, 302);
  }

  // ── 2. Извлекаем Steam ID из claimed_id ───────────────────
  // claimed_id выглядит как: https://steamcommunity.com/openid/id/76561198XXXXXXXXX
  const claimedId = params.get('openid.claimed_id') ?? '';
  const steamId = claimedId.split('/').pop();

  if (!steamId) {
    return Response.redirect(`${SITE_URL}?auth_error=no_steam_id`, 302);
  }

  // ── 3. Получаем профиль из Steam API ──────────────────────
  let steamUsername = `steam_${steamId}`;
  let steamAvatar   = '';

  try {
    const profileRes = await fetch(
      `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${STEAM_API_KEY}&steamids=${steamId}`
    );
    const profileData = await profileRes.json();
    const player = profileData?.response?.players?.[0];
    if (player) {
      steamUsername = player.personaname ?? steamUsername;
      steamAvatar   = player.avatarfull  ?? '';
    }
  } catch {
    // Не критично — продолжаем без аватара
  }

  // ── 4. Создаём или находим юзера в Supabase ───────────────
  // Используем email вида steamid@steam.superturiki.local — уникальный, не настоящий
  const fakeEmail  = `${steamId}@steam.superturiki.local`;
  const supabase   = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Ищем существующего юзера
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const existingUser = existingUsers?.users?.find(u => u.email === fakeEmail);

  let userId: string;

  if (existingUser) {
    // Юзер уже есть — просто берём его ID
    userId = existingUser.id;
  } else {
    // Создаём нового юзера
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: fakeEmail,
      email_confirm: true,
      user_metadata: {
        full_name:   steamUsername,
        avatar_url:  steamAvatar,
        steam_id:    steamId,
        provider:    'steam',
      },
    });

    if (createError || !newUser?.user) {
      return Response.redirect(`${SITE_URL}?auth_error=create_failed`, 302);
    }

    userId = newUser.user.id;

    // Обновляем профиль
    await supabase.from('profiles').upsert({
      id:         userId,
      username:   steamUsername,
      avatar_url: steamAvatar,
      email:      fakeEmail,
      steam_id:   steamId,
      role:       'player',
    }, { onConflict: 'id' });
  }

  // ── 5. Создаём сессию ─────────────────────────────────────
  const { data: sessionData, error: sessionError } =
    await supabase.auth.admin.generateLink({
      type:  'magiclink',
      email: fakeEmail,
    });

  if (sessionError || !sessionData?.properties?.hashed_token) {
    return Response.redirect(`${SITE_URL}?auth_error=session_failed`, 302);
  }

  // Редиректим на сайт — клиент поймает токен и создаст сессию
  const redirectUrl = new URL(SITE_URL);
  redirectUrl.searchParams.set('steam_token', sessionData.properties.hashed_token);
  redirectUrl.searchParams.set('steam_user',  steamUsername);

  return Response.redirect(redirectUrl.toString(), 302);
});

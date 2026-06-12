// supabase/functions/steam-auth/index.ts
// Редиректит пользователя на Steam OpenID авторизацию

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
      },
    });
  }

  // URL куда Steam вернёт пользователя после авторизации
  const callbackUrl = `${SUPABASE_URL}/functions/v1/steam-callback`;

  const params = new URLSearchParams({
    'openid.ns':         'http://specs.openid.net/auth/2.0',
    'openid.mode':       'checkid_setup',
    'openid.return_to':  callbackUrl,
    'openid.realm':      callbackUrl,
    'openid.identity':   'http://specs.openid.net/auth/2.0/identifier_select',
    'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
  });

  const steamLoginUrl = `https://steamcommunity.com/openid/login?${params.toString()}`;

  return Response.redirect(steamLoginUrl, 302);
});

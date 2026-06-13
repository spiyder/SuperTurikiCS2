// supabase/functions/match-reminder/index.ts
// Cron-функция: каждую минуту проверяет матчи за час и шлёт email
// Настроить в Supabase: Dashboard → Edge Functions → match-reminder → Schedule
// Cron: * * * * *  (каждую минуту)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY       = Deno.env.get('RESEND_API_KEY')!;  // resend.com — бесплатно до 100 писем/день
const FROM_EMAIL           = Deno.env.get('FROM_EMAIL') ?? 'noreply@superturiki.cs2';

serve(async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const now     = new Date();
  const in60min = new Date(now.getTime() + 60 * 60 * 1000);
  const in59min = new Date(now.getTime() + 59 * 60 * 1000);

  // Матчи которые начинаются ровно через час (±1 минута)
  const { data: matches } = await supabase
    .from('lobby_matches')
    .select('id, team1_name, team2_name, round, scheduled_at, tournament_id')
    .gte('scheduled_at', in59min.toISOString())
    .lte('scheduled_at', in60min.toISOString())
    .eq('phase', 'scheduled')
    .is('reminder_sent', null);  // не отправляли ещё

  if (!matches || matches.length === 0) {
    return new Response('No matches in 1 hour', { status: 200 });
  }

  for (const match of matches) {
    const matchTime = new Date(match.scheduled_at).toLocaleString('ru', {
      day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow',
    });

    // Найти команды и их участников (через lobby_ready или team_members)
    const { data: teams } = await supabase
      .from('teams')
      .select('id, name, captain_id')
      .in('name', [match.team1_name, match.team2_name]);

    const teamIds = (teams ?? []).map(t => t.id);

    const { data: members } = await supabase
      .from('team_members')
      .select('user_id')
      .in('team_id', teamIds);

    const userIds = [...new Set((members ?? []).map(m => m.user_id))];
    if (userIds.length === 0) continue;

    // Получаем emails из auth.users через admin API
    const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const targetUsers = users.filter(u => userIds.includes(u.id) && u.email);

    // Отправляем email каждому игроку через Resend
    for (const u of targetUsers) {
      if (!u.email) continue;

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `SuperTurikiCS2 <${FROM_EMAIL}>`,
          to: u.email,
          subject: `⚔️ Твой матч через 1 час — ${match.team1_name} vs ${match.team2_name}`,
          html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: system-ui, sans-serif; background: #0f0f0f; color: #fff; margin: 0; padding: 0; }
    .wrap { max-width: 520px; margin: 0 auto; padding: 40px 20px; }
    .logo { font-size: 22px; font-weight: 800; margin-bottom: 32px; }
    .logo span { color: #f97316; }
    .card { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 16px; padding: 28px; margin-bottom: 24px; }
    .badge { display: inline-block; background: #f97316; color: #fff; font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 99px; text-transform: uppercase; letter-spacing: .08em; margin-bottom: 16px; }
    .vs { display: flex; align-items: center; justify-content: center; gap: 16px; margin: 20px 0; }
    .team { font-size: 20px; font-weight: 700; }
    .divider { color: #f97316; font-size: 14px; font-weight: 600; }
    .info { color: #888; font-size: 13px; margin-top: 16px; }
    .info strong { color: #ccc; }
    .cta { display: block; text-align: center; background: #f97316; color: #fff; text-decoration: none; font-weight: 600; padding: 14px; border-radius: 12px; margin-top: 24px; font-size: 15px; }
    .footer { color: #444; font-size: 12px; text-align: center; margin-top: 32px; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="logo">Super<span>Turiki</span>CS2</div>
    <div class="card">
      <div class="badge">⏰ Через 1 час</div>
      <p style="color:#aaa;font-size:14px;margin:0 0 8px">Твой матч начинается скоро. Будь готов!</p>
      <div class="vs">
        <div class="team">${match.team1_name}</div>
        <div class="divider">VS</div>
        <div class="team">${match.team2_name}</div>
      </div>
      <div class="info">
        <p>🗓 <strong>${matchTime} МСК</strong></p>
        <p>🏆 <strong>${match.round}</strong></p>
      </div>
      <a href="https://superturikics2.vercel.app?lobby=${match.id}" class="cta">
        Войти в лобби →
      </a>
    </div>
    <div class="footer">SuperTurikiCS2 · Не хочешь получать уведомления? Отпишись в настройках профиля.</div>
  </div>
</body>
</html>`,
        }),
      });
    }

    // Помечаем что напоминание отправлено
    await supabase.from('lobby_matches').update({ reminder_sent: now.toISOString() }).eq('id', match.id);
  }

  return new Response(`Sent reminders for ${matches.length} matches`, { status: 200 });
});

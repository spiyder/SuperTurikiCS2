// supabase/functions/steam-cs2stats/index.ts
// Возвращает CS2 статистику игрока по steam_id

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const STEAM_API_KEY = Deno.env.get('STEAM_API_KEY')!;
const CS2_APP_ID = '730';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Content-Type': 'application/json',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  const url = new URL(req.url);
  const steamId = url.searchParams.get('steam_id');

  if (!steamId) {
    return new Response(JSON.stringify({ error: 'steam_id required' }), { status: 400, headers: CORS });
  }

  try {
    // Запрашиваем статистику CS2
    const statsRes = await fetch(
      `https://api.steampowered.com/ISteamUserStats/GetUserStatsForGame/v2/?appid=${CS2_APP_ID}&key=${STEAM_API_KEY}&steamid=${steamId}`
    );
    const statsData = await statsRes.json();
    const stats = statsData?.playerstats?.stats ?? [];

    const get = (name: string) => stats.find((s: { name: string; value: number }) => s.name === name)?.value ?? 0;

    // Основные метрики CS2
    const kills         = get('total_kills');
    const deaths        = get('total_deaths');
    const wins          = get('total_wins');
    const timePlayed    = get('total_time_played'); // секунды
    const headshotKills = get('total_kills_headshot');
    const mvps          = get('total_mvps');
    const roundsPlayed  = get('total_rounds_played');
    const bombsPlanted  = get('total_planted_bombs');
    const bombsDefused  = get('total_defused_bombs');
    const damageDealt   = get('total_damage_done');
    const shotsFired    = get('total_shots_fired');
    const shotsHit      = get('total_shots_hit');

    const kd            = deaths > 0 ? (kills / deaths).toFixed(2) : kills.toFixed(2);
    const hsPct         = kills > 0 ? Math.round((headshotKills / kills) * 100) : 0;
    const accuracy      = shotsFired > 0 ? Math.round((shotsHit / shotsFired) * 100) : 0;
    const hoursPlayed   = Math.round(timePlayed / 3600);
    const winRate       = roundsPlayed > 0 ? Math.round((wins / roundsPlayed) * 100) : 0;

    return new Response(JSON.stringify({
      kills, deaths, wins, hoursPlayed, headshotKills, mvps,
      roundsPlayed, bombsPlanted, bombsDefused, damageDealt,
      kd, hsPct, accuracy, winRate,
    }), { headers: CORS });

  } catch (e) {
    return new Response(JSON.stringify({ error: 'Failed to fetch stats', detail: String(e) }), { status: 500, headers: CORS });
  }
});

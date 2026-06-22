// supabase/functions/quick-lobby-veto/index.ts
//
// Серверная валидация хода вето для публичных лобби (без авторизации).
// Логика в стиле FACEIT: team1 банит, team2 банит, по очереди,
// пока не останется 1 карта — она становится финальной (decider).
//
// КРИТИЧНО: вся проверка "чья сейчас очередь" и "может ли этот session_id
// банить за эту команду" происходит ТУТ, на сервере — а не на клиенте.
// Иначе любой гость мог бы просто послать banов в обход хода.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
  'Content-Type': 'application/json',
};

// Маппулы — держим in sync с фронтендом (src/lib/maps.ts)
const MAPS: Record<string, string[]> = {
  '1v1': ['aim_map'],
  '2v2': ['de_nuke', 'de_inferno', 'de_dust2_wingman', 'de_mirage_wingman', 'de_train_wingman', 'de_anubis_wingman', 'de_overpass'],
  '5v5': ['de_mirage', 'de_dust2', 'de_overpass', 'de_anubis', 'de_inferno', 'de_ancient', 'de_nuke'],
};

// Порядок ходов: team1, team2, team1, team2... до 1 карты, потом decider
function buildVetoOrder(mapCount: number): ('team1' | 'team2')[] {
  const order: ('team1' | 'team2')[] = [];
  const bansNeeded = mapCount - 1; // банят пока не останется 1 карта
  for (let i = 0; i < bansNeeded; i++) {
    order.push(i % 2 === 0 ? 'team1' : 'team2');
  }
  return order;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'POST only' }), { status: 405, headers: CORS });

  try {
    const body = await req.json();
    const { lobby_id, session_id, map_name } = body;

    if (!lobby_id || !session_id || !map_name) {
      return new Response(JSON.stringify({ error: 'lobby_id, session_id, map_name required' }), { status: 400, headers: CORS });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // 1. Загружаем лобби
    const { data: lobby, error: lobbyErr } = await supabase
      .from('quick_lobbies')
      .select('*')
      .eq('id', lobby_id)
      .single();

    if (lobbyErr || !lobby) {
      return new Response(JSON.stringify({ error: 'Lobby not found' }), { status: 404, headers: CORS });
    }

    if (lobby.phase !== 'veto') {
      return new Response(JSON.stringify({ error: 'Lobby is not in veto phase' }), { status: 409, headers: CORS });
    }

    // 2. Проверяем что отправитель — капитан нужной команды
    const allMaps = MAPS[lobby.format] ?? MAPS['5v5'];
    const vetoOrder = buildVetoOrder(allMaps.length);
    const currentStepIndex = lobby.current_veto_step;

    if (currentStepIndex >= vetoOrder.length) {
      return new Response(JSON.stringify({ error: 'Veto already complete' }), { status: 409, headers: CORS });
    }

    const expectedTeam = vetoOrder[currentStepIndex];
    const expectedCaptainSession = expectedTeam === 'team1' ? lobby.team1_captain_session : lobby.team2_captain_session;

    if (expectedCaptainSession !== session_id) {
      return new Response(JSON.stringify({ error: 'Not your turn to ban' }), { status: 403, headers: CORS });
    }

    // 3. Проверяем что карта реально доступна (не забанена ранее) и принадлежит формату
    const { data: previousBans } = await supabase
      .from('quick_lobby_veto')
      .select('map_name')
      .eq('lobby_id', lobby_id);

    const bannedMaps = (previousBans ?? []).map(b => b.map_name);

    if (!allMaps.includes(map_name)) {
      return new Response(JSON.stringify({ error: 'Map not in pool for this format' }), { status: 400, headers: CORS });
    }
    if (bannedMaps.includes(map_name)) {
      return new Response(JSON.stringify({ error: 'Map already banned' }), { status: 409, headers: CORS });
    }

    // 4. Записываем бан
    await supabase.from('quick_lobby_veto').insert({
      lobby_id, step: currentStepIndex, team: expectedTeam, action: 'ban', map_name, acted_session: session_id,
    });

    const newBannedMaps = [...bannedMaps, map_name];
    const remainingMaps = allMaps.filter(m => !newBannedMaps.includes(m));

    // 5. Если осталась 1 карта — это decider, завершаем вето
    let lobbyUpdate: Record<string, unknown> = { current_veto_step: currentStepIndex + 1 };

    if (remainingMaps.length === 1) {
      const decider = remainingMaps[0];
      await supabase.from('quick_lobby_veto').insert({
        lobby_id, step: currentStepIndex + 1, team: 'auto', action: 'decider', map_name: decider, acted_session: null,
      });
      lobbyUpdate = { current_veto_step: currentStepIndex + 1, phase: 'done', final_map: decider };

      await supabase.from('quick_lobby_chat').insert({
        lobby_id, session_id: null, username: 'Система',
        message: `Финальная карта: ${decider}. Вето завершено!`,
      });
    } else {
      await supabase.from('quick_lobby_chat').insert({
        lobby_id, session_id: null, username: 'Система',
        message: `Команда ${expectedTeam === 'team1' ? lobby.team1_name : lobby.team2_name} забанила ${map_name}.`,
      });
    }

    await supabase.from('quick_lobbies').update(lobbyUpdate).eq('id', lobby_id);

    return new Response(JSON.stringify({
      ok: true,
      remaining_maps: remainingMaps.length === 1 ? [] : remainingMaps,
      final_map: remainingMaps.length === 1 ? remainingMaps[0] : null,
      done: remainingMaps.length === 1,
    }), { headers: CORS });

  } catch (e) {
    return new Response(JSON.stringify({ error: 'Internal error', detail: String(e) }), { status: 500, headers: CORS });
  }
});

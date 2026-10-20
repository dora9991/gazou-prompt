// 先生の道具箱：LINE の本人確認の窓口（Edge Function「sensei-line」）
//   公式LINE の LIFF から開いたページが、LINE の ID トークンを送ってくる。
//   1. LINE（api.line.me/oauth2/v2.1/verify）に、そのトークンが本物か・このチャネル宛てか・期限内かを確かめる
//   2. 確かめられたら、sensei_usage.line_session_start で「記録用の札」を作って返す（ページはこの札をつけて記録する）
//   画面が名乗った LINE の ID は使わない（なりすまし防止）。秘密の値は使わない（チャネル ID は公開してよい値）。
//
// 設定（Supabase の Edge Function の Secrets）
//   SENSEI_LINE_CHANNEL_ID   … LINE ログインのチャネル ID（数字）。LIFF を作ったチャネル（公式LINE アラフォーと同じプロバイダー）
//   SENSEI_ALLOWED_ORIGINS   … 呼んでよいページの元（既定 https://dora9991.github.io）。カンマ区切り
//   SENSEI_LINE_VERIFY_URL   … 確かめ先（テストのときだけ差しかえる。既定は LINE の本物）
// デプロイ：supabase functions deploy sensei-line --project-ref <ref> --no-verify-jwt

const SB_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const CHANNEL_ID = (Deno.env.get('SENSEI_LINE_CHANNEL_ID') ?? '').trim();
const ALLOWED = (Deno.env.get('SENSEI_ALLOWED_ORIGINS') ?? 'https://dora9991.github.io').split(',').map((s) => s.trim()).filter(Boolean);
const VERIFY_URL = Deno.env.get('SENSEI_LINE_VERIFY_URL') ?? 'https://api.line.me/oauth2/v2.1/verify';

function cors(origin: string | null): Record<string, string> {
  const ok = origin && (ALLOWED.includes('*') || ALLOWED.includes(origin));
  return {
    'Access-Control-Allow-Origin': ok ? origin! : ALLOWED[0] ?? 'null',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  };
}
function reply(origin: string | null, status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(origin), 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
  if (req.method !== 'POST') return reply(origin, 405, { ok: false, error: 'method' });
  if (origin && !ALLOWED.includes('*') && !ALLOWED.includes(origin)) return reply(origin, 403, { ok: false, error: 'origin' });
  if (!CHANNEL_ID || !/^\d{6,20}$/.test(CHANNEL_ID) || !SB_URL || !SERVICE) return reply(origin, 503, { ok: false, error: 'not_configured' });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return reply(origin, 400, { ok: false, error: 'bad_request' }); }
  const idToken = typeof body.id_token === 'string' ? body.id_token : '';
  if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(idToken) || idToken.length > 4096) return reply(origin, 400, { ok: false, error: 'bad_token' });

  // 1. LINE に確かめる
  let v: Record<string, unknown>;
  try {
    const r = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ id_token: idToken, client_id: CHANNEL_ID }),
    });
    if (!r.ok) return reply(origin, 401, { ok: false, error: 'invalid_token' });
    v = await r.json();
  } catch {
    return reply(origin, 502, { ok: false, error: 'line_unreachable' });
  }
  const sub = typeof v.sub === 'string' ? v.sub : '';
  const aud = String(v.aud ?? '');
  const exp = Number(v.exp ?? 0);
  if (!/^U[0-9a-f]{32}$/.test(sub) || aud !== CHANNEL_ID || v.iss !== 'https://access.line.me' || !(exp * 1000 > Date.now())) {
    return reply(origin, 401, { ok: false, error: 'invalid_token' });
  }
  const name = typeof v.name === 'string' ? v.name.slice(0, 100) : null;

  // 2. 記録用の札を作る（sensei_usage.line_session_start は service_role だけが呼べる）
  try {
    const r = await fetch(SB_URL.replace(/\/+$/, '') + '/rest/v1/rpc/line_session_start', {
      method: 'POST',
      headers: { apikey: SERVICE, Authorization: 'Bearer ' + SERVICE, 'Content-Type': 'application/json', 'Content-Profile': 'sensei_usage' },
      body: JSON.stringify({ p_line_user_id: sub, p_display_name: name }),
    });
    const out = await r.json().catch(() => null);
    if (!r.ok || !out || !out.ok) return reply(origin, 500, { ok: false, error: 'session_failed' });
    return reply(origin, 200, { ok: true, session: out.session, expires_in: out.expires_in, name });
  } catch {
    return reply(origin, 500, { ok: false, error: 'session_failed' });
  }
});

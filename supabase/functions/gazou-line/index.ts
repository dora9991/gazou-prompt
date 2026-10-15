// gazou-line ― LINE の ID トークンを確かめて、「記録用の札」を返す
//
// 流れ：
//   1. 処方箋のページ（js/line.js）が、LIFF で受け取った ID トークンをここに送る
//   2. LINE（oauth2/v2.1/verify）に、本物か・このチャネルのものか・期限内かを確かめてもらう
//   3. 札（ランダムな64桁の16進数）を作り、そのハッシュだけを DB（create_line_session）に預ける
//   4. 札と LINE の表示名を返す。以後の記録は、この札をつけて送られる（log_event が札から「だれ」を決める）
//
// 必要な設定（Edge Functions → Secrets）：
//   LINE_CHANNEL_ID    LINEログインのチャネルID（10桁の数字）
//   ALLOWED_ORIGINS    （任意）ページの出どころ。カンマ区切り。既定は https://dora9991.github.io
// SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY は、Supabase が自動で入れる。
//
// デプロイ時は「Verify JWT」をオフにすること（ページは公開用キーだけで呼ぶため）。

const LINE_VERIFY = "https://api.line.me/oauth2/v2.1/verify";
const LINE_ISSUER = "https://access.line.me";
const SCHEMA = "gazou_prompt";
const TTL_SECONDS = 43200; // 札の有効期間（12時間）。js/line.js の既定と同じ

const env = (k: string) => Deno.env.get(k) ?? "";

function allowedOrigins(): string[] {
  const v = env("ALLOWED_ORIGINS") || "https://dora9991.github.io";
  return v.split(",").map((s) => s.trim()).filter(Boolean);
}

function corsHeaders(origin: string | null): Record<string, string> {
  const h: Record<string, string> = {
    "Vary": "Origin",
    "Cache-Control": "no-store",
  };
  if (origin && allowedOrigins().includes(origin)) {
    h["Access-Control-Allow-Origin"] = origin;
    h["Access-Control-Allow-Headers"] = "content-type, apikey, authorization, x-client-info";
    h["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    h["Access-Control-Max-Age"] = "86400";
  }
  return h;
}

function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders(origin) },
  });
}

const hex = (buf: ArrayBuffer | Uint8Array) =>
  Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");

async function sha256Hex(s: string): Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
}

function cleanName(v: unknown): string {
  // 制御文字を除いて、前後の空白を落とし、60文字まで
  return String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 60);
}

export async function handle(req: Request): Promise<Response> {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405, origin);

  const channelId = env("LINE_CHANNEL_ID");
  const supabaseUrl = env("SUPABASE_URL").replace(/\/+$/, "");
  const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!/^\d{5,20}$/.test(channelId) || !supabaseUrl || !serviceKey) {
    console.error("gazou-line: not_configured");
    return json({ ok: false, error: "not_configured" }, 500, origin);
  }

  // 入力：{ id_token }
  let idToken = "";
  try {
    const text = await req.text();
    if (text.length > 8192) return json({ ok: false, error: "too_large" }, 413, origin);
    const body = JSON.parse(text);
    idToken = typeof body?.id_token === "string" ? body.id_token : "";
  } catch {
    return json({ ok: false, error: "bad_request" }, 400, origin);
  }
  if (idToken.length < 20 || idToken.length > 4096) return json({ ok: false, error: "bad_request" }, 400, origin);

  // LINE に確かめてもらう
  let claims: Record<string, unknown>;
  try {
    const r = await fetch(LINE_VERIFY, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ id_token: idToken, client_id: channelId }),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return json({ ok: false, error: "invalid_token" }, 401, origin);
    claims = await r.json();
  } catch {
    return json({ ok: false, error: "line_unreachable" }, 502, origin);
  }

  const sub = String(claims.sub ?? "");
  const exp = Number(claims.exp ?? 0);
  if (
    claims.iss !== LINE_ISSUER ||
    String(claims.aud ?? "") !== channelId ||
    !/^U[0-9a-f]{32}$/.test(sub) ||
    !(exp * 1000 > Date.now())
  ) {
    return json({ ok: false, error: "invalid_token" }, 401, origin);
  }
  const name = cleanName(claims.name);

  // 札を作る。DB には、ハッシュだけ預ける
  const token = hex(crypto.getRandomValues(new Uint8Array(32)));
  const tokenHash = await sha256Hex(token);
  try {
    const r = await fetch(`${supabaseUrl}/rest/v1/rpc/create_line_session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": serviceKey,
        "Authorization": `Bearer ${serviceKey}`,
        "Content-Profile": SCHEMA,
      },
      body: JSON.stringify({
        p_token_hash: tokenHash,
        p_line_user_id: sub,
        p_name: name,
        p_ttl_seconds: TTL_SECONDS,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) {
      console.error("gazou-line: create_line_session failed", r.status);
      return json({ ok: false, error: "store_failed" }, 500, origin);
    }
  } catch {
    console.error("gazou-line: create_line_session unreachable");
    return json({ ok: false, error: "store_failed" }, 500, origin);
  }

  return json({ ok: true, session: token, name, expires_in: TTL_SECONDS }, 200, origin);
}

Deno.serve(handle);

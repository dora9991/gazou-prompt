/* 利用の記録：公式LINE「アラフォー」の特典として開かれたときだけ、「どの道具で、何をしたか」を記録する。
   送るのは道具の名前と操作の名前だけ（例：seats / run）。生徒の名前・名簿・入力した中身・アカウント保存の中身は送らない。

   だれの記録か（どちらもないときは、何も送らない）：
     LINE  … LIFF（https://liff.line.me/<LIFF ID>）から開くと、LINE がページに ID トークンを渡す。
             Edge Function「sensei-line」が LINE に本物か確かめて「記録用の札」を返す（画面が名乗った ID は使わない）。
             LINE の中で開いたときは「ブラウザで開く」で、1回だけ使える受け渡しの札（?h=…）つきで Safari・Chrome に開き直せる。
     コード … line-hub の「その人専用のリンク」から開くと、?c=lh-… が付いてくる。この端末に覚えて、記録に付ける。
   利用者は「記録を止める」で、いつでも止められる（この端末に覚える）。
   設定：config.js の SENSEI_CONFIG.line = { enabled, liffId, endpoint?, sdkUrl? }。enabled が false か無いときは、まるごと止まっている。
   保存（localStorage）：sensei:usage:device（端末の番号）・sensei:usage:code・sensei:usage:line（札と表示名）・sensei:usage:off・sensei:usage:queue */
(function () {
  'use strict';
  const { h } = Kit;
  const CFG = window.SENSEI_CONFIG || {};
  const L = CFG.line || {};
  const BASE = String(CFG.supabaseUrl || '').replace(/\/+$/, '');
  const ON = !!(L.enabled && BASE && CFG.supabaseKey && !Kit.env.artifact);
  const SDK = L.sdkUrl || 'https://static.line-scdn.net/liff/edge/versions/2.31.2/sdk.js'; // 2.20.0〜2.31.0 は弱点のため使わない
  const ENDPOINT = L.endpoint || BASE + '/functions/v1/sensei-line';
  const K = { dev: 'sensei:usage:device', code: 'sensei:usage:code', line: 'sensei:usage:line', off: 'sensei:usage:off', q: 'sensei:usage:queue' };
  const APP_RE = /^[a-z][a-z0-9-]{0,30}$/, ACT_RE = /^[a-z][a-z0-9_.:-]{0,40}$/, CODE_RE = /^[A-Za-z0-9_-]{1,64}$/;

  const get = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const set = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* 保存できない環境 */ } };
  const S = { state: 'off', name: '', session: '', exp: 0, code: '', error: '', inClient: false };
  const listeners = new Set();
  const emit = () => { for (const fn of listeners) { try { fn(S); } catch (e) { console.error(e); } } };

  function device() {
    let d = get(K.dev);
    if (!d || !/^[A-Za-z0-9_-]{16,64}$/.test(d)) { d = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join(''); set(K.dev, d); }
    return d;
  }
  function restore() {
    try {
      const o = JSON.parse(get(K.line) || 'null');
      if (o && /^[0-9a-f]{64}$/.test(o.session) && o.exp > Date.now() + 60000) { S.session = o.session; S.name = o.name || ''; S.exp = o.exp; return true; }
    } catch (e) { /* noop */ }
    return false;
  }
  function saveSession(session, name, expiresIn) {
    S.session = session; S.name = name || ''; S.exp = Date.now() + (Number(expiresIn) || 86400) * 1000 - 60000;
    set(K.line, JSON.stringify({ session: S.session, name: S.name, exp: S.exp }));
  }
  function forgetSession() { S.session = ''; S.exp = 0; set(K.line, null); }
  const off = () => get(K.off) === '1';
  const identity = () => (S.session && S.exp > Date.now()) || !!S.code;
  const active = () => ON && !off() && identity();

  async function rpc(name, body, o = {}) {
    const r = await fetch(BASE + '/rest/v1/rpc/' + name, { method: 'POST', keepalive: !!o.keepalive, credentials: 'omit', cache: 'no-store',
      headers: { apikey: CFG.supabaseKey, Authorization: 'Bearer ' + CFG.supabaseKey, 'Content-Type': 'application/json', 'Content-Profile': 'sensei_usage', 'Accept-Profile': 'sensei_usage' },
      body: JSON.stringify(body) });
    const out = await r.json().catch(() => null);
    if (!r.ok) throw Object.assign(new Error((out && out.message) || 'http_' + r.status), { status: r.status });
    return out;
  }

  /* ── 送るもの（同じ道具・操作は数をまとめる。ページを閉じても次に送れるよう端末に覚える） ── */
  let queue = [];
  try { queue = JSON.parse(get(K.q) || '[]').filter((e) => e && APP_RE.test(e.app) && ACT_RE.test(e.action)).slice(-200); } catch (e) { queue = []; }
  const saveQueue = () => set(K.q, queue.length ? JSON.stringify(queue.slice(-200)) : null);
  let timer = 0, sending = null;
  function record(app, action, n = 1) {
    if (!active()) return;
    if (Kit.store && Kit.store.demo && !/^demo/.test(action)) return;       // デモの中の操作（自動）は数えない。デモを見たことだけ
    if (!APP_RE.test(app) || !ACT_RE.test(action)) return;
    const last = queue[queue.length - 1];
    if (last && last.app === app && last.action === action && last.n < 1000) last.n += n;
    else queue.push({ app, action, n });
    saveQueue();
    clearTimeout(timer); timer = setTimeout(() => flush(), 4000);
  }
  async function flush(o = {}) {
    if (!active() || !queue.length) return;
    if (sending) return sending;
    sending = (async () => {
      const batch = queue.slice(0, 50);
      try {
        const out = await rpc('log_events', { p: { session: S.session && S.exp > Date.now() ? S.session : null, code: S.code || null, device: device(), events: batch } }, o);
        if (out && out.expired) { forgetSession(); if (S.inClient) startLine(); }
        if (out && (out.ok || ['no_identity', 'limit', 'off', 'bad_events', 'too_many'].includes(out.error))) { queue = queue.slice(batch.length); saveQueue(); }
      } catch (e) {
        if (e && e.status && e.status >= 400 && e.status < 500) { queue = queue.slice(batch.length); saveQueue(); }   // 形の合わない記録は捨てる（何度も送らない）
      } finally { sending = null; }
      if (queue.length) { clearTimeout(timer); timer = setTimeout(() => flush(), 5000); }
    })();
    return sending;
  }

  /* ── LINE（LIFF） ── */
  const inLineApp = () => /\bLine\//i.test(navigator.userAgent || '');
  const viaLiff = () => { try { const q = new URLSearchParams(location.search); return q.has('liff.state') || q.has('liff.referrer') || (q.has('code') && q.has('liffClientId')); } catch (e) { return false; } };
  const loadSdk = () => new Promise((resolve, reject) => {
    if (window.liff) { resolve(window.liff); return; }
    const s = document.createElement('script');
    s.src = SDK; s.async = true;
    s.onload = () => (window.liff ? resolve(window.liff) : reject(new Error('sdk_missing')));
    s.onerror = () => reject(new Error('sdk_load_failed'));
    document.head.appendChild(s);
  });
  let lineRunning = null;
  function startLine() {
    if (!ON || !L.liffId || off()) return Promise.resolve(S);
    if (lineRunning) return lineRunning;
    lineRunning = (async () => {
      S.state = 'loading'; emit();
      try {
        const liff = await loadSdk();
        await liff.init({ liffId: L.liffId });
        S.inClient = !!(liff.isInClient && liff.isInClient());
        if (!liff.isLoggedIn()) { liff.login({ redirectUri: location.href }); return S; }   // LINE のログイン → 戻ってきたら続き
        let dec = null;
        try { dec = liff.getDecodedIDToken && liff.getDecodedIDToken(); } catch (e) { dec = null; }
        if (dec && dec.exp && dec.exp * 1000 < Date.now() + 30000) { try { liff.logout(); } catch (e) { /* noop */ } liff.login({ redirectUri: location.href }); return S; }
        const token = liff.getIDToken();
        if (!token) throw new Error('no_id_token');
        const r = await fetch(ENDPOINT, { method: 'POST', credentials: 'omit', cache: 'no-store', headers: { 'Content-Type': 'application/json', apikey: CFG.supabaseKey }, body: JSON.stringify({ id_token: token }) });
        const out = await r.json().catch(() => null);
        if (!r.ok || !out || !out.ok || !/^[0-9a-f]{64}$/.test(out.session || '')) throw new Error((out && out.error) || 'http_' + r.status);
        saveSession(out.session, out.name, out.expires_in);
        S.state = 'line'; S.error = '';
      } catch (e) {
        S.state = S.code ? 'code' : 'error'; S.error = String((e && e.message) || e);
      } finally { lineRunning = null; emit(); }
      return S;
    })();
    return lineRunning;
  }

  // LINE の中 → 外のブラウザ（Safari・Chrome）へ。1回だけ使える受け渡しの札（10分）を付けて開き直す
  async function openInBrowser() {
    try {
      const out = await rpc('handoff_create', { p_session: S.session });
      if (!out || !out.ok) throw new Error((out && out.error) || 'handoff');
      const url = location.href.split('#')[0].split('?')[0] + '?h=' + out.code + (location.hash || '');
      if (window.liff && window.liff.openWindow) window.liff.openWindow({ url, external: true });
      else window.open(url, '_blank', 'noopener');
    } catch (e) { Kit.toast('ブラウザで開けませんでした。もう一度押してください', { type: 'bad' }); }
  }

  /* ── 開いたとき ── */
  async function start() {
    if (!ON) return;
    const q = new URLSearchParams(location.search);
    const c = q.get('c'), hh = q.get('h');
    let strip = false;
    if (c && CODE_RE.test(c)) { set(K.code, c); strip = true; }
    if (hh) {
      strip = true;
      if (/^[0-9a-f]{64}$/.test(hh)) {
        try { const out = await rpc('handoff_redeem', { p_code: hh }); if (out && out.ok) saveSession(out.session, out.name, out.expires_in); } catch (e) { /* 受け渡しに失敗しても、ふつうに使える */ }
      }
    }
    if (strip) {                                                 // 合言葉・受け渡しの札は、アドレス欄と履歴から消す
      q.delete('c'); q.delete('h');
      const rest = q.toString();
      try { history.replaceState(null, '', location.pathname + (rest ? '?' + rest : '') + location.hash); } catch (e) { /* noop */ }
    }
    S.code = get(K.code) && CODE_RE.test(get(K.code)) ? get(K.code) : '';
    const had = restore();
    S.inClient = inLineApp();
    S.state = had ? 'line' : S.code ? 'code' : 'off';
    if (!had && L.liffId && (inLineApp() || viaLiff())) await startLine();
    emit();
    if (active()) { record('kit', 'start'); if (Kit.current && Kit.current()) record(Kit.current(), 'open'); }
    window.addEventListener('pagehide', () => { flush({ keepalive: true }); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) flush({ keepalive: true }); });
  }

  /* ── 画面：LINE の中で開いているときの帯・ホームの説明 ── */
  Kit.css('usage', `
.us-bar{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;padding:8px var(--gutter-r) 8px var(--gutter-l);background:var(--gosu-wash);border-bottom:1px solid var(--line);font-size:13.5px;color:var(--ink)}
.us-bar b{font-weight:700}
.us-bar .us-bar-btns{margin-left:auto;display:flex;gap:6px}
.us-note{margin-top:10px;padding:10px 12px;border-radius:var(--r-sm);background:var(--surface-2);font-size:13.5px;color:var(--ink-2);display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center}
.us-note>span{flex:1 1 260px;min-width:0}
`);
  let bar = null;
  function drawBar() {
    const main = document.querySelector('.mb-main');
    if (!main) return;
    const show = ON && !off() && S.inClient && S.session && S.exp > Date.now() && !(Kit.store && Kit.store.demo) && get('sensei:usage:bar-closed') !== '1';
    if (!show) { if (bar) { bar.remove(); bar = null; } return; }
    if (bar) bar.remove();
    bar = h('div', { class: 'us-bar', role: 'note' },
      h('span', null, 'LINE の中で開いています。', h('b', null, '保存が消えないよう、ブラウザで開くのがおすすめです。')),
      h('span', { class: 'us-bar-btns' },
        Kit.btn('ブラウザで開く', openInBrowser, { sm: true, kind: 'primary', icon: 'external' }),
        Kit.btn('', () => { set('sensei:usage:bar-closed', '1'); drawBar(); }, { sm: true, kind: 'ghost', icon: 'close', title: '閉じる' })));
    main.prepend(bar);
  }
  listeners.add(drawBar);

  // ホームの「データの扱い」に入れる説明（記録しているときだけ）
  function note() {
    if (!ON || !identity()) return null;
    const who = S.session && S.exp > Date.now() ? 'LINE（' + (S.name || '名前なし') + '）' : '公式LINE のリンク';
    if (off()) return h('div', { class: 'us-note' }, h('span', null, '使った道具の記録は止めています。'), Kit.btn('記録を再開する', () => { set(K.off, null); Kit.remount(); }, { sm: true }));
    return h('div', { class: 'us-note' },
      h('span', null, who + ' から開いたので、', h('b', null, 'どの道具を使ったか'), 'を記録しています（公式LINE の特典をよくするため）。生徒の名前や入力した中身は送りません。'),
      Kit.btn('記録を止める', () => { set(K.off, '1'); queue = []; saveQueue(); Kit.toast('記録を止めました'); Kit.remount(); }, { sm: true, kind: 'ghost' }));
  }

  Kit.usage = Object.assign((app, action, n) => record(app, action, n), {
    enabled: ON,
    state: () => Object.assign({}, S, { active: active(), off: off(), queued: queue.length }),
    on: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    flush, start, note, openInBrowser,
    open: (id) => record(id, 'open'),
  });
})();

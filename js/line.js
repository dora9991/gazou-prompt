/*
 * プロンプト処方箋 ― LINE とつなぐ（公式LINE の LIFF から開いたときだけ）
 *   1. LINE の中で開かれたら、LIFF の仕組み（LINE が配る SDK）で、LINE の ID トークンを受け取る
 *   2. それを Edge Function「gazou-line」に送り、LINE に本物か確かめてもらい、「記録用の札」を受け取る
 *   3. 記録（js/api.js）は、この札をつけて送る → 管理画面で「だれが」がわかる
 * LINE の外（ふつうのブラウザ）で開いたときは、SDK を読み込まず、いままでどおり名前なしで動く。
 * 設定（config.js）：liffId（LIFF ID）が空なら、この機能はまるごと止まっている。
 */
(function (root) {
  'use strict';
  var C = root.GP_CONFIG || {};
  var KEY = 'gp.line';
  var OFF_KEY = 'gp.lineoff';   // 利用者が「LINE の名前をつけない」を選んだ
  // LIFF SDK は版を固定する（2.20.0〜2.31.0 は弱点のため使わない。2026-10 時点の最新 2.31.2）
  var SDK = 'https://static.line-scdn.net/liff/edge/versions/2.31.2/sdk.js';
  var S = { state: 'off', name: '', session: '', exp: 0, error: '' };
  var listeners = [];
  var running = null;

  function emit() { listeners.forEach(function (fn) { try { fn(S); } catch (e) { /* 表示の不具合で止めない */ } }); }
  function enabled() { return !!(C.liffId && (C.lineEndpoint || C.supabaseUrl)); }
  function endpoint() { return C.lineEndpoint || String(C.supabaseUrl || '').replace(/\/+$/, '') + '/functions/v1/gazou-line'; }
  function sdkUrl() { return C.liffSdkUrl || SDK; }
  function off() { try { return root.localStorage.getItem(OFF_KEY) === '1'; } catch (e) { return false; } }
  function setOff(on) { try { if (on) root.localStorage.setItem(OFF_KEY, '1'); else root.localStorage.removeItem(OFF_KEY); } catch (e) { /* 何もしない */ } }
  function inLineApp() { return /\bLine\//i.test((root.navigator && root.navigator.userAgent) || ''); }
  function viaLiff() {
    try { var q = new URLSearchParams(root.location.search); return q.has('liff.state') || q.has('liff.referrer') || q.has('code') && q.has('liffClientId'); } catch (e) { return false; }
  }
  function restore() {
    try {
      var o = JSON.parse(root.sessionStorage.getItem(KEY) || 'null');
      if (o && /^[0-9a-f]{64}$/.test(o.session) && o.exp > Date.now() + 60000) { S.session = o.session; S.name = o.name || ''; S.exp = o.exp; S.state = 'ready'; return true; }
    } catch (e) { /* 保存できない環境 */ }
    return false;
  }
  function save() { try { root.sessionStorage.setItem(KEY, JSON.stringify({ session: S.session, name: S.name, exp: S.exp })); } catch (e) { /* 何もしない */ } }
  function forget() { try { root.sessionStorage.removeItem(KEY); } catch (e) { /* 何もしない */ } }

  function loadSdk() {
    return new Promise(function (resolve, reject) {
      if (root.liff) { resolve(root.liff); return; }
      var s = document.createElement('script');
      s.src = sdkUrl();
      s.async = true;
      s.onload = function () { if (root.liff) resolve(root.liff); else reject(new Error('sdk_missing')); };
      s.onerror = function () { reject(new Error('sdk_load_failed')); };
      document.head.appendChild(s);
    });
  }

  function set(state, extra) { S.state = state; if (extra) Object.keys(extra).forEach(function (k) { S[k] = extra[k]; }); emit(); }

  // つなぐ。opts.force：LINE の外でも LINE ログインをする（「LINE でつなぐ」を押したとき）
  function start(opts) {
    if (running) return running;
    running = (async function () {
      if (!enabled()) { set('off'); return S; }
      var force = !!(opts && opts.force);
      if (force) setOff(false);
      if (off()) { set('anon', { optedOff: true }); return S; }
      if (restore()) { emit(); return S; }
      if (!force && !inLineApp() && !viaLiff()) { set('anon'); return S; }
      set('loading');
      try {
        var liff = await loadSdk();
        await liff.init({ liffId: C.liffId });
        if (!liff.isLoggedIn()) {
          if (liff.isInClient() || force) { liff.login({ redirectUri: root.location.href }); return S; }   // LINE のログイン画面へ（戻ってきたら続き）
          set('anon');
          return S;
        }
        // SDK が期限切れのトークンを返すことがあるので、送る前に期限だけ確かめる（中身はサーバーに送らない）
        var dec = null;
        try { dec = liff.getDecodedIDToken && liff.getDecodedIDToken(); } catch (e) { dec = null; }
        if (dec && dec.exp && dec.exp * 1000 < Date.now() + 30000) {
          if (liff.isInClient() || force) { try { liff.logout(); } catch (e) { /* 何もしない */ } liff.login({ redirectUri: root.location.href }); return S; }
          set('anon');
          return S;
        }
        var token = liff.getIDToken();
        if (!token) throw new Error('no_id_token');
        var headers = { 'Content-Type': 'application/json' };
        if (C.supabaseKey) headers.apikey = C.supabaseKey;
        var r = await fetch(endpoint(), { method: 'POST', headers: headers, body: JSON.stringify({ id_token: token }), credentials: 'omit', cache: 'no-store' });
        var out = null;
        try { out = await r.json(); } catch (e) { out = null; }
        if (!r.ok || !out || !out.ok || !/^[0-9a-f]{64}$/.test(out.session || '')) throw new Error((out && out.error) || ('http_' + r.status));
        S.session = out.session;
        S.name = out.name || '';
        S.exp = Date.now() + (Number(out.expires_in) || 43200) * 1000 - 60000;
        save();
        set('ready', { error: '' });
      } catch (e) {
        set('error', { error: String((e && e.message) || e) });
      }
      return S;
    })().then(function (v) { running = null; return v; });
    return running;
  }

  function session() { return S.state === 'ready' && S.exp > Date.now() ? S.session : ''; }
  // 記録で「札が古い」と言われたら、もう一度つなぎ直す（記録そのものは名前なしで残っている）
  function expired() {
    S.session = ''; S.exp = 0; forget();
    set('anon');
    if (inLineApp() || viaLiff()) start();
  }

  // 利用者が「このページでは LINE の名前をつけない」を選んだ（記録は名前なしになる。もう一度つなぐときは start({ force: true })）
  function disconnect() {
    setOff(true);
    S.session = ''; S.exp = 0; S.name = ''; forget();
    set('anon', { optedOff: true });
  }

  root.GP_LINE = { start: start, session: session, expired: expired, disconnect: disconnect, enabled: enabled, inLineApp: inLineApp, state: function () { return S; }, on: function (fn) { listeners.push(fn); } };
})(typeof self !== 'undefined' ? self : this);

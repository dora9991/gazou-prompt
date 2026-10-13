/*
 * 画像生成プロンプト処方箋 ― 記録（Supabase）とのやりとり
 * 追加のライブラリは使わず、fetch だけで、スキーマ gazou_prompt の関数（RPC）を呼ぶ。
 * 表を直接読み書きすることはない（表は公開用キーでは読めないようにしてある）。
 */
(function (root) {
  'use strict';
  var C = root.GP_CONFIG || {};
  var SCHEMA = 'gazou_prompt';
  var VISITOR_KEY = 'gp.visitor';
  var OPTOUT_KEY = 'gp.optout';
  var COHORT_KEY = 'gp.cohort';

  function store(key, value) {
    try {
      if (value === undefined) return root.localStorage.getItem(key);
      if (value === null) root.localStorage.removeItem(key);
      else root.localStorage.setItem(key, value);
    } catch (e) { /* 保存できない環境（プライベートブラウズなど）でも動くように */ }
    return null;
  }

  function uuid() {
    var c = root.crypto;
    if (c && typeof c.randomUUID === 'function') { try { return c.randomUUID(); } catch (e) { /* 下へ */ } }
    var b = new Uint8Array(16);
    if (c && c.getRandomValues) c.getRandomValues(b);
    else for (var i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
    b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
    var h = Array.prototype.map.call(b, function (x) { return (x + 0x100).toString(16).slice(1); }).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  }

  var memVisitor = null;
  function visitorId() {
    var v = store(VISITOR_KEY);
    if (v && /^[0-9a-f-]{36}$/.test(v)) return v;
    v = memVisitor || uuid();
    memVisitor = v;
    store(VISITOR_KEY, v);
    return v;
  }

  function configured() { return !!(C.supabaseUrl && C.supabaseKey); }
  function optedOut() { return store(OPTOUT_KEY) === '1'; }
  function setOptOut(on) { store(OPTOUT_KEY, on ? '1' : null); }
  function canLog() { return configured() && !optedOut(); }

  // 講座コード：URL の ?c= → 前回の値 → 設定の既定
  function cohort() {
    var q = '';
    try { q = new URLSearchParams(root.location.search).get('c') || ''; } catch (e) { q = ''; }
    q = q.trim();
    if (q && /^[A-Za-z0-9_-]{1,32}$/.test(q)) { store(COHORT_KEY, q); return q; }
    var saved = store(COHORT_KEY);
    if (saved && /^[A-Za-z0-9_-]{1,32}$/.test(saved)) return saved;
    var d = String(C.cohort || '');
    return /^[A-Za-z0-9_-]{1,32}$/.test(d) ? d : '';
  }

  function headers(key) {
    key = key || C.supabaseKey;
    var h = { 'Content-Type': 'application/json', 'Accept': 'application/json', 'apikey': key, 'Content-Profile': SCHEMA };
    // 旧来の公開キー（JWT の形）は Authorization にも入れる。新しい公開用キー（sb_publishable_）は apikey だけ
    if (/^eyJ/.test(key)) h.Authorization = 'Bearer ' + key;
    return h;
  }

  // 関数を呼ぶ。返事の JSON を返す。通信できない・断られたときは { ok:false, error } を返す（例外にしない）
  function rpc(fn, args, opts) {
    opts = opts || {};
    var base = String(opts.url || C.supabaseUrl || '').replace(/\/+$/, '');
    if (!base) return Promise.resolve({ ok: false, error: 'not_configured' });
    var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, opts.timeout || 15000) : null;
    return fetch(base + '/rest/v1/rpc/' + fn, {
      method: 'POST',
      headers: headers(opts.key),
      body: JSON.stringify(args || {}),
      keepalive: !!opts.keepalive,
      credentials: 'omit',
      cache: 'no-store',
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (res) {
      return res.text().then(function (t) {
        var body = null;
        try { body = t ? JSON.parse(t) : null; } catch (e) { body = null; }
        if (!res.ok) return { ok: false, error: 'http_' + res.status, detail: body && (body.message || body.code) };
        return body && typeof body === 'object' ? body : { ok: false, error: 'bad_response' };
      });
    }).catch(function (e) {
      return { ok: false, error: e && e.name === 'AbortError' ? 'timeout' : 'network' };
    }).then(function (r) { if (timer) clearTimeout(timer); return r; });
  }

  // 参加者の画面からの記録。失敗しても画面の動きには影響させない
  var sent = 0;
  function log(ev) {
    if (!canLog()) return Promise.resolve({ ok: false, error: 'off' });
    var p = Object.assign({ visitor_id: visitorId(), cohort: cohort(), client: clientKind() }, ev);
    // LINE とつながっていれば、記録用の札をつける（だれの記録かは、サーバーが札から決める）
    var L = root.GP_LINE;
    var sess = L && L.session ? L.session() : '';
    if (sess) p.session = sess;
    sent++;
    return rpc('log_event', { p: p }, { keepalive: true, timeout: 10000 }).then(function (r) {
      if (!r || !r.ok) { try { console.info('[記録] 送れませんでした:', r && r.error); } catch (e) { /* 何もしない */ } }
      else if (r.session === 'expired' && L && L.expired) L.expired();
      return r;
    });
  }

  function clientKind() {
    var w = 0;
    try { w = Math.min(root.screen.width, root.screen.height); } catch (e) { w = 0; }
    var touch = 'ontouchstart' in root || (root.navigator && root.navigator.maxTouchPoints > 1);
    return (touch && w && w < 820) ? 'phone' : (touch ? 'tablet' : 'pc');
  }

  root.GP_API = {
    SCHEMA: SCHEMA, rpc: rpc, log: log, uuid: uuid, visitorId: visitorId, cohort: cohort,
    configured: configured, optedOut: optedOut, setOptOut: setOptOut, canLog: canLog, store: store,
    sentCount: function () { return sent; }
  };
})(typeof self !== 'undefined' ? self : this);

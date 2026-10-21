/* 先生の道具箱：アカウントに保存（鍵つき）
   ジーニー会員のアカウントでログインすると、どの端末でも同じ内容を使える。保存先は会員サイトの Supabase（スキーマ sensei。supabase/sensei.sql）。
   中身は、この端末の中で暗号にしてから送る（AES-GCM・256 ビット）。鍵は先生の「合言葉」から端末の中で作る（PBKDF2・60 万回）。
   合言葉も鍵もサーバーには送らない。サーバーに残るのは読めない文字列だけ＝運営も中身を読めない。
   鍵は、この端末のブラウザ（IndexedDB）に「取り出せない形」で覚えておく。ログアウトで消す。

   しくみ：
   - 画面が読み書きするのは、いままでどおり端末の写し（localStorage の 'sensei:u:<アカウント>:'。kit.js の cloudBackend）。
   - 写しに書くたびに Kit.cloud.mark() で「送るもの」に入れ、少し待ってまとめて送る（sensei.push）。電波がないときは、つながってから。
   - ほかの端末で変わったものは、開いたとき・画面に戻ったとき・1分ごとに受け取る（sensei.pull）。まだ送っていないものは、こちらを残す。
   - 2台で同じものを同時に直したら、あとから送った方が残る。
   - ログインしないときは、いままでどおり「この端末だけ」（'sensei:'）。2つは混ざらない。
   設定は config.js の window.SENSEI_CONFIG（cloud: true で使えるようになる）。 */
(function () {
  'use strict';
  const { h } = Kit;
  const CFG = window.SENSEI_CONFIG || {};
  const ok = !!(CFG.cloud && CFG.supabaseUrl && CFG.supabaseKey && !Kit.env.artifact && window.crypto && crypto.subtle && window.fetch);
  const BASE = String(CFG.supabaseUrl || '').replace(/\/+$/, '');
  const SKEY = 'sensei:cloud:session';
  const ITER = 600000;
  const CHECK = 'sensei-kit:v1';
  const NAME_RE = /^[a-z][a-z0-9_]{0,39}$/, ID_RE = /^[A-Za-z0-9_.:-]{0,100}$/;
  const te = new TextEncoder(), td = new TextDecoder();
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /* ───────── 小物 ───────── */
  const b64 = (buf) => { const u = buf instanceof Uint8Array ? buf : new Uint8Array(buf); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  const unb64 = (str) => { const s = String(str).replace(/-/g, '+').replace(/_/g, '/'); const bin = atob(s + '==='.slice((s.length + 3) % 4)); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; };
  const aad = (kind, name, id) => 'sensei-kit|' + kind + '|' + name + '|' + id;   // 中身を、その置き場所に結びつける（すり替え防止）

  /* ───────── 鍵（合言葉 → 鍵・暗号にする・開く） ───────── */
  async function deriveKey(pass, salt, iterations) {
    const raw = await crypto.subtle.importKey('raw', te.encode(String(pass).normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, raw, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function seal(key, ad, value) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: te.encode(ad) }, key, te.encode(JSON.stringify(value)));
    return { iv: b64(iv), data: b64(data) };
  }
  async function unseal(key, ad, iv, data) {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv), additionalData: te.encode(ad) }, key, unb64(data));
    return JSON.parse(td.decode(pt));
  }

  /* ───────── 鍵をこの端末に覚えておく（IndexedDB。取り出せない形の鍵のまま） ───────── */
  const IDB = 'sensei-kit-keys';
  const idb = () => new Promise((res, rej) => { const r = indexedDB.open(IDB, 1); r.onupgradeneeded = () => r.result.createObjectStore('keys'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const idbDo = async (mode, fn) => { const db = await idb(); try { return await new Promise((res, rej) => { const tx = db.transaction('keys', mode); const rq = fn(tx.objectStore('keys')); tx.oncomplete = () => res(rq && rq.result); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error); }); } finally { db.close(); } };
  let memKey = null; // IndexedDB が使えないとき（ページを閉じるまで）
  async function saveKey(uid, key, vaultAt) { memKey = { uid, key, vaultAt }; try { await idbDo('readwrite', (s) => s.put({ key, vaultAt }, uid)); } catch (e) { /* 覚えられなくても、このページの間は使える */ } }
  async function loadKey(uid) { if (memKey && memKey.uid === uid) return memKey; try { const v = await idbDo('readonly', (s) => s.get(uid)); return v && v.key ? Object.assign({ uid }, v) : null; } catch (e) { return null; } }
  async function dropKey(uid) { memKey = null; try { await idbDo('readwrite', (s) => s.delete(uid)); } catch (e) { /* noop */ } }

  /* ───────── ログイン（会員サイトの Supabase Auth を、そのまま使う） ───────── */
  const readSession = () => { try { const s = JSON.parse(localStorage.getItem(SKEY) || 'null'); return s && s.user && s.user.id ? s : null; } catch (e) { return null; } };
  const writeSession = (s) => { try { if (s) localStorage.setItem(SKEY, JSON.stringify(s)); else localStorage.removeItem(SKEY); } catch (e) { /* noop */ } };
  const fromToken = (t) => ({ access_token: t.access_token, refresh_token: t.refresh_token, expires_at: Date.now() + (t.expires_in || 3600) * 1000, user: { id: t.user && t.user.id, email: t.user && t.user.email } });
  let session = ok ? readSession() : null;
  let refreshing = null;

  async function http(path, { body, auth = true, headers = {} } = {}) {
    const hd = Object.assign({ apikey: CFG.supabaseKey, 'Content-Type': 'application/json' }, headers);
    if (auth && session) hd.Authorization = 'Bearer ' + session.access_token;
    let res;
    try { res = await fetch(BASE + path, { method: 'POST', headers: hd, body: JSON.stringify(body || {}) }); }
    catch (e) { throw Object.assign(new Error('offline'), { offline: true }); }
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch (e) { /* 文字だけの返事 */ }
    if (!res.ok) throw Object.assign(new Error((json && (json.message || json.msg || json.error_description || json.error)) || 'HTTP ' + res.status), { status: res.status, code: json && (json.error_code || json.code) });
    return json;
  }
  async function fresh() {
    if (!session) throw Object.assign(new Error('not_logged_in'), { code: 'not_logged_in' });
    if (session.expires_at - Date.now() > 90 * 1000) return;
    if (!refreshing) {
      refreshing = (async () => {
        try { const t = await http('/auth/v1/token?grant_type=refresh_token', { body: { refresh_token: session.refresh_token }, auth: false }); session = fromToken(t); writeSession(session); state.expired = false; }
        catch (e) { if (!e.offline && e.status >= 400 && e.status < 500) state.expired = true; throw e; }
        finally { refreshing = null; }
      })();
    }
    return refreshing;
  }
  async function rpc(name, args) {
    await fresh();
    const call = () => http('/rest/v1/rpc/' + name, { body: args || {}, headers: { 'Content-Profile': 'sensei', 'Accept-Profile': 'sensei' } });
    try { return await call(); }
    catch (e) { if (e.status === 401 && session) { session.expires_at = 0; await fresh(); return call(); } throw e; }
  }

  /* ───────── 送るもの・受け取った所まで（端末の写しの隣に置く） ───────── */
  const state = { key: null, vaultAt: null, locked: false, expired: false, busy: false, offline: false, error: null, pending: 0, lastSync: null, usage: null, started: false };
  const P = () => 'sensei:u:' + session.user.id + ':';
  let pend = {};
  const loadPend = () => { try { pend = JSON.parse(localStorage.getItem(P() + '~pending') || '{}') || {}; } catch (e) { pend = {}; } state.pending = Object.keys(pend).length; };
  const savePend = () => { try { localStorage.setItem(P() + '~pending', JSON.stringify(pend)); } catch (e) { /* 書けなくても、このページの間は送る */ } state.pending = Object.keys(pend).length; };
  const getSince = () => { try { return localStorage.getItem(P() + '~since'); } catch (e) { return null; } };
  const setSince = (v) => { try { if (v) localStorage.setItem(P() + '~since', v); else localStorage.removeItem(P() + '~since'); } catch (e) { /* noop */ } };
  const label = () => Kit.saveState();

  function mark(kind, name, id, del) {
    if (!session) return;
    if (!NAME_RE.test(name) || !ID_RE.test(id)) { console.warn('アカウントに送れない名前なので、この端末だけに置きます', kind, name, id); return; }
    const k = kind + '|' + name + '|' + id, o = pend[k];
    pend[k] = { k: kind, n: name, i: id, v: (o ? o.v : 0) + 1 };
    savePend(); label(); later();
  }
  let pushTimer = 0;
  const later = (ms = 1200) => { clearTimeout(pushTimer); pushTimer = setTimeout(() => { push().catch(() => {}); }, ms); };

  const backend = () => { const b = Kit.store.backend(); return b && b.mode === 'cloud' ? b : null; };
  const readRaw = (be, kind, name, id) => (kind === 'd' ? be.read('d:' + name) : (be.read('c:' + name) || {})[id]);
  const canSync = () => !!(ok && session && state.key && !state.locked && !state.expired && backend());

  // エラーを、画面の言葉に
  function noteError(e) {
    const m = String((e && e.message) || e);
    if (e && e.offline) { state.offline = true; return; }
    state.offline = false;
    if (/quota|too_many_rows|total_quota/.test(m)) state.error = 'quota';
    else if (/not_member|plan_required/.test(m)) state.error = 'not_member';
    else if (/no_vault|bad_key/.test(m)) { state.locked = true; state.key = null; }
    else if (state.expired) { /* ログインし直し */ }
    else state.error = 'other';
    console.error('アカウントとの同期', e);
  }

  /* ───────── 送る ───────── */
  let pushing = null;
  async function push() {
    if (!canSync() || !Object.keys(pend).length) return;
    if (pushing) { later(); return pushing; }
    pushing = (async () => {
      state.busy = true; label();
      try {
        const be = backend();
        const all = Object.entries(pend);
        for (let i = 0; i < all.length;) {
          const batch = []; let size = 0;
          for (; i < all.length; i++) {
            const [k, p] = all[i];
            const raw = readRaw(be, p.k, p.n, p.i);
            let row;
            if (raw === undefined || raw === null) row = { kind: p.k, name: p.n, item_id: p.i, deleted: true };
            else { const s = await seal(state.key, aad(p.k, p.n, p.i), raw); row = { kind: p.k, name: p.n, item_id: p.i, iv: s.iv, data: s.data, deleted: false }; }
            const sz = (row.data || '').length + 200;
            if (batch.length && (batch.length >= 150 || size + sz > 2400000)) break;
            batch.push({ k, v: p.v, row }); size += sz;
          }
          const r = await rpc('push', { p_rows: batch.map((b) => b.row) });
          for (const b of batch) if (pend[b.k] && pend[b.k].v === b.v) delete pend[b.k];
          savePend();
          if (r && r.bytes != null) state.usage = Object.assign({}, state.usage, { bytes: r.bytes });
        }
        state.error = null; state.offline = false; state.lastSync = new Date();
      } catch (e) { noteError(e); if (state.offline) later(30000); }
      finally { state.busy = false; pushing = null; label(); }
      if (Object.keys(pend).length && !state.offline && !state.error) later();
    })();
    return pushing;
  }

  /* ───────── 受け取る ───────── */
  let pulling = null;
  async function pull() {
    if (!canSync()) return;
    if (pulling) return pulling;
    pulling = (async () => {
      state.busy = true; label();
      const be = backend();
      const since = getSince();
      const first = !since;
      let cursor = since ? new Date(new Date(since).getTime() - 5000).toISOString() : null; // 5 秒さかのぼる（同じころに書かれた行の取りこぼしを防ぐ。2 回当てても同じ）
      let maxAt = since, n = 0;
      const docs = new Set(), colls = new Set();
      try {
        for (let page = 0; page < 400; page++) {
          const rows = await rpc('pull', { p_since: cursor, p_limit: 500 });
          for (const r of rows || []) {
            if (!maxAt || r.updated_at > maxAt) maxAt = r.updated_at;
            if (pend[r.kind + '|' + r.name + '|' + r.item_id]) continue;          // まだ送っていない、この端末の変更を残す
            let val;
            if (!r.deleted) {
              try { val = await unseal(state.key, aad(r.kind, r.name, r.item_id), r.iv, r.data); }
              catch (e) { throw Object.assign(new Error('bad_key'), { code: 'bad_key' }); }
            }
            if (r.kind === 'd') { be.write('d:' + r.name, r.deleted ? undefined : val); docs.add(r.name); }
            else {
              const o = be.read('c:' + r.name) || {};
              if (r.deleted) delete o[r.item_id]; else o[r.item_id] = val;
              be.write('c:' + r.name, Object.keys(o).length ? o : undefined); colls.add(r.name);
            }
            n++;
          }
          if (!rows || rows.length < 500) break;
          cursor = rows[rows.length - 1].updated_at;
        }
        if (maxAt) setSince(maxAt);
        state.error = null; state.offline = false; state.lastSync = new Date();
        if (docs.size || colls.size) Kit.store.remoteChanged({ docs: [...docs], colls: [...colls] });
        if (first && n) await Kit.remount();                     // はじめてこの端末に受け取ったときは、画面を開き直す
      } catch (e) { noteError(e); }
      finally { state.busy = false; pulling = null; label(); }
    })();
    return pulling;
  }

  async function sync() { await push(); await pull(); await push(); }

  // 鍵が今のアカウントの合言葉と合っているか（ほかの端末で「作り直す」をしたら合わなくなる）
  async function checkVault() {
    const st = await rpc('status');
    state.usage = { bytes: st.bytes, rows: st.rows, limit: st.limit_bytes };
    if (!st.vault) { state.locked = true; state.key = null; return st; }
    if (state.vaultAt && st.vault.updated_at !== state.vaultAt) {
      try { if ((await unseal(state.key, 'check', st.vault.check_iv, st.vault.check_data)) !== CHECK) throw new Error('x'); }
      catch (e) { state.locked = true; state.key = null; state.relock = true; await dropKey(session.user.id); setSince(null); }
    }
    return st;
  }

  /* ───────── はじめに（Kit.start のあと） ───────── */
  let wired = false;
  function wire() {
    if (wired) return;
    wired = true;
    setInterval(() => { if (!document.hidden) pull().then(push); }, 60000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) pull().then(push); else push(); });
    window.addEventListener('online', () => { state.offline = false; sync(); });
    window.addEventListener('pagehide', () => { push(); });
  }
  // 開いたとき・合言葉を入れたあと：鍵を出して、合っているか確かめ、ほかの端末と合わせる
  async function start() {
    if (!ok || !session || !backend()) return;                    // ログインしていない・デモ中・別の保存先
    loadPend(); label();
    if (!state.key) { const k = await loadKey(session.user.id); if (k) { state.key = k.key; state.vaultAt = k.vaultAt; } }
    if (!state.key) { state.locked = true; label(); ask(); return; }
    try { await fresh(); await checkVault(); } catch (e) { noteError(e); }
    label();
    if (state.expired || state.locked) { ask(); return; }
    wire();
    await sync();
  }
  // 開いたときに一度だけ、ログイン・合言葉の画面を出す（閉じても、左下からいつでも開ける）
  const ask = () => { if (state.asked || Kit.store.demo) return; state.asked = true; setTimeout(() => open(), 400); };

  /* ───────── 合言葉を決める・入れる・作り直す ───────── */
  async function makeVault(pass) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await deriveKey(pass, salt, ITER);
    const chk = await seal(key, 'check', CHECK);
    return { key, args: { p_salt: b64(salt), p_iterations: ITER, p_check_iv: chk.iv, p_check_data: chk.data } };
  }
  async function unlockWith(pass, vault) {
    const key = await deriveKey(pass, unb64(vault.salt), vault.iterations);
    try { if ((await unseal(key, 'check', vault.check_iv, vault.check_data)) !== CHECK) return null; } catch (e) { return null; }
    return key;
  }
  // この端末の写しを全部「送るもの」にする（作り直したあと・この端末のデータをアカウントに入れるとき）
  function markAll(prefix) {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(prefix)) continue;
      const rest = k.slice(prefix.length);
      let v; try { v = JSON.parse(localStorage.getItem(k)); } catch (e) { continue; }
      if (rest.startsWith('d:')) { const name = rest.slice(2); if (NAME_RE.test(name)) pend['d|' + name + '|'] = { k: 'd', n: name, i: '', v: 1 }; }
      else if (rest.startsWith('c:') && v && typeof v === 'object') { const name = rest.slice(2); if (!NAME_RE.test(name)) continue; for (const id of Object.keys(v)) if (ID_RE.test(id)) pend['c|' + name + '|' + id] = { k: 'c', n: name, i: id, v: 1 }; }
    }
    savePend();
  }
  // この端末だけのデータ（ログインしないで使っていた分）があるか
  function localHasData() {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i) || '';
      if (/^sensei:c:/.test(k)) { try { const o = JSON.parse(localStorage.getItem(k)); if (o && Object.values(o).some((x) => x && !x.sample)) return true; } catch (e) { /* noop */ } }
      if (k === 'sensei:d:profile') return true;
    }
    return false;
  }
  function copyLocalToAccount() {
    const to = P(), keys = [];
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i) || ''; if (/^sensei:(d|c):/.test(k)) keys.push(k); }
    for (const k of keys) localStorage.setItem(to + k.slice('sensei:'.length), localStorage.getItem(k));
    markAll(to);
  }
  const cacheHasData = () => { if (!session) return false; const pre = P(); for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i) || ''; if (k.startsWith(pre + 'c:') || k.startsWith(pre + 'd:')) return true; } return false; };

  /* ───────── 画面（ダイアログ） ───────── */
  const NOTE_PRIVACY = '中身は、この端末の中で鍵をかけてから送ります。運営も中身を読めません。学校の決まりで、生徒の情報を外に保存できないときは、ログインしないで使ってください（この端末だけに保存）。';
  const passInput = (id, ph) => h('input', { type: 'password', id, autocomplete: id.includes('new') ? 'new-password' : 'current-password', placeholder: ph || '', minlength: 8 });
  const errBox = () => h('p', { class: 'small', role: 'alert', style: { color: 'var(--bad)', minHeight: '1.4em', margin: 0 } });
  function busyBtn(btn, on, text) { btn.disabled = on; if (text) btn.querySelector('span') ? (btn.querySelector('span').textContent = text) : (btn.textContent = text); }

  function open() {
    if (!ok) return;
    if (Kit.store.demo) { Kit.toast('デモの中では使えません。上の帯の「デモを終わる」で戻ってから'); return; }
    if (!session || state.expired) return openLogin();
    if (state.locked) return openUnlockFlow();
    return openStatus();
  }

  function openLogin() {
    const email = h('input', { type: 'email', id: 'cl-email', autocomplete: 'username', placeholder: 'ジーニー会員サイトのメールアドレス', value: session && session.user.email ? session.user.email : '' });
    const pass = passInput('cl-pass');
    const err = errBox();
    const go = h('button', { type: 'submit', class: 'btn primary' }, Kit.icon('lock'), h('span', null, 'ログイン'));
    const form = h('form', { class: 'stack', onsubmit: async (e) => {
      e.preventDefault();
      err.textContent = '';
      if (!email.value.trim() || !pass.value) { err.textContent = 'メールアドレスとパスワードを入れてください'; return; }
      busyBtn(go, true, 'たしかめています…');
      try {
        const t = await http('/auth/v1/token?grant_type=password', { body: { email: email.value.trim(), password: pass.value }, auth: false });
        const prev = session && session.user.id;
        session = fromToken(t); writeSession(session); state.expired = false;
        let st;
        try { st = await rpc('status'); }
        catch (e2) {
          if (/not_member|plan_required/.test(e2.message)) { await logoutQuiet(); err.textContent = 'このアカウントでは使えません。ジーニー会員のアカウントでログインしてください。'; busyBtn(go, false, 'ログイン'); return; }
          throw e2;
        }
        m.close();
        if (prev && prev === session.user.id && state.key) { state.expired = false; await start(); return; } // ログインし直しただけ
        if (!st.vault) openCreate(); else openUnlock(st.vault);
      } catch (e2) {
        err.textContent = e2.offline ? 'つながりません。インターネットを確かめてください。' : /invalid|credentials|grant/i.test(e2.message) || e2.status === 400 ? 'メールアドレスかパスワードがちがいます。' : 'ログインできませんでした（' + e2.message + '）';
        busyBtn(go, false, 'ログイン');
      }
    } },
    h('p', { class: 'small ink-2' }, 'ジーニー会員のアカウントでログインすると、学校のパソコンでも家のパソコンでも、同じ内容を使えます。'),
    Kit.field({ label: 'メールアドレス', input: email }),
    Kit.field({ label: 'パスワード', input: pass, hint: '会員サイトと同じパスワードです。忘れたときは、会員サイトで再設定してください。' }),
    err,
    h('div', { class: 'btn-row', style: { justifyContent: 'flex-end' } }, h('button', { type: 'button', class: 'btn ghost', onclick: () => m.close() }, 'やめる'), go),
    h('p', { class: 'tiny muted' }, NOTE_PRIVACY));
    const m = Kit.modal({ title: state.expired ? 'ログインし直してください' : 'ログインして、どの端末でも使う', body: form, autofocus: 'input' });
  }

  function openCreate() {
    const p1 = passInput('cl-new1', '8文字以上'), p2 = passInput('cl-new2');
    const err = errBox();
    const go = h('button', { type: 'submit', class: 'btn primary' }, Kit.icon('lock'), h('span', null, '合言葉を決める'));
    const form = h('form', { class: 'stack', onsubmit: async (e) => {
      e.preventDefault(); err.textContent = '';
      if (p1.value.length < 8) { err.textContent = '合言葉は 8 文字以上にしてください'; return; }
      if (p1.value !== p2.value) { err.textContent = '2つの合言葉がちがいます'; return; }
      busyBtn(go, true, '鍵を作っています…');
      try {
        const v = await makeVault(p1.value);
        await rpc('vault_init', v.args);
        const st = await rpc('status');
        await saveKey(session.user.id, v.key, st.vault.updated_at);
        m.close();
        afterUnlock(true);
      } catch (e2) { err.textContent = /vault_exists/.test(e2.message) ? 'このアカウントには、もう合言葉があります。開き直してください。' : '決められませんでした（' + (e2.offline ? 'つながりません' : e2.message) + '）'; busyBtn(go, false, '合言葉を決める'); }
    } },
    h('p', null, 'はじめに「合言葉」を1つ決めます。この合言葉で鍵をかけて保存するので、運営も中身を読めません。'),
    h('ul', { class: 'small', style: { margin: 0, paddingLeft: '1.3em', color: 'var(--ink-2)' } },
      h('li', null, h('b', null, '忘れると、ほかの端末では開けません。'), '運営も戻せません。'),
      h('li', null, '紙に書いて、なくさない所にしまっておいてください。'),
      h('li', null, 'ログインのパスワードとは別のものにしてください。')),
    Kit.field({ label: '合言葉（8文字以上）', input: p1 }), Kit.field({ label: 'もう一度', input: p2 }),
    err,
    h('div', { class: 'btn-row', style: { justifyContent: 'flex-end' } }, go));
    const m = Kit.modal({ title: '合言葉を決める', body: form, autofocus: 'input', dismissable: false });
  }

  async function openUnlockFlow() {
    try { const st = await rpc('status'); if (!st.vault) return openCreate(); openUnlock(st.vault); }
    catch (e) { if (state.expired) return openLogin(); Kit.toast(e.offline ? 'つながりません。インターネットを確かめてください' : '開けませんでした（' + e.message + '）', { type: 'bad' }); }
  }
  function openUnlock(vault) {
    const p = passInput('cl-pass1');
    const err = errBox();
    const go = h('button', { type: 'submit', class: 'btn primary' }, Kit.icon('lock'), h('span', null, '開く'));
    const form = h('form', { class: 'stack', onsubmit: async (e) => {
      e.preventDefault(); err.textContent = '';
      busyBtn(go, true, 'たしかめています…');
      const key = await unlockWith(p.value, vault);
      if (!key) { err.textContent = '合言葉がちがいます。'; busyBtn(go, false, '開く'); return; }
      await saveKey(session.user.id, key, vault.updated_at);
      m.close();
      afterUnlock(false);
    } },
    h('p', null, state.relock ? 'ほかの端末で合言葉が作り直されました。新しい合言葉を入れてください。' : 'この端末で使うのがはじめてなので、合言葉を入れてください。次からは聞きません。'),
    Kit.field({ label: '合言葉', input: p }),
    err,
    h('div', { class: 'btn-row' }, h('button', { type: 'button', class: 'btn ghost sm', onclick: () => { m.close(); openForgot(); } }, '合言葉を忘れた'), h('span', { class: 'grow' }), go));
    const m = Kit.modal({ title: '合言葉を入れる', body: form, autofocus: 'input' });
  }

  function openForgot() {
    const has = cacheHasData();
    const p1 = passInput('cl-new1', '8文字以上'), p2 = passInput('cl-new2');
    const reseed = h('input', { type: 'checkbox', id: 'cl-reseed', checked: has, disabled: !has });
    const err = errBox();
    const go = h('button', { type: 'submit', class: 'btn danger' }, h('span', null, '作り直す'));
    const form = h('form', { class: 'stack', onsubmit: async (e) => {
      e.preventDefault(); err.textContent = '';
      if (p1.value.length < 8) { err.textContent = '合言葉は 8 文字以上にしてください'; return; }
      if (p1.value !== p2.value) { err.textContent = '2つの合言葉がちがいます'; return; }
      if (!(await Kit.confirm({ title: '本当に作り直しますか', body: 'アカウントに保存した中身は消えます。' + (reseed.checked ? 'この端末の写しを、新しい合言葉で入れ直します。' : 'アカウントは空から始まります。'), ok: '作り直す', danger: true }))) return;
      busyBtn(go, true, '作り直しています…');
      try {
        const v = await makeVault(p1.value);
        await rpc('vault_reset', v.args);
        const st = await rpc('status');
        await saveKey(session.user.id, v.key, st.vault.updated_at);
        setSince(null);
        pend = {};
        if (reseed.checked) markAll(P()); else { const pre = P(); const ks = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i) || ''; if (k.startsWith(pre)) ks.push(k); } ks.forEach((k) => localStorage.removeItem(k)); }
        savePend();
        m.close();
        location.reload();
      } catch (e2) { err.textContent = '作り直せませんでした（' + (e2.offline ? 'つながりません' : e2.message) + '）'; busyBtn(go, false, '作り直す'); }
    } },
    h('p', null, '合言葉は、運営も戻せません。新しい合言葉で「作り直す」と、アカウントに保存した中身は消えます。'),
    has ? h('label', { class: 'check', for: 'cl-reseed' }, reseed, 'この端末に残っている写しを、新しい合言葉で入れ直す（おすすめ）') : h('p', { class: 'small muted' }, 'この端末には写しがありません。アカウントは空から始まります。ほかに使っていた端末があれば、そちらで作り直すと中身を残せます。'),
    Kit.field({ label: '新しい合言葉（8文字以上）', input: p1 }), Kit.field({ label: 'もう一度', input: p2 }),
    err,
    h('div', { class: 'btn-row', style: { justifyContent: 'flex-end' } }, h('button', { type: 'button', class: 'btn ghost', onclick: () => m.close() }, 'やめる'), go));
    const m = Kit.modal({ title: '合言葉を作り直す', body: form, autofocus: 'input' });
  }

  // 合言葉を決めた・入れたあと：はじめてなら「この端末のデータ」を入れるか聞いてから、アカウントの保存に切りかえる
  async function afterUnlock(created) {
    state.locked = false; state.relock = false; state.key = null;   // 鍵は start() で覚えた所から出す
    if (created && localHasData() && !cacheHasData()) {
      const yes = await Kit.confirm({ title: 'この端末のデータをアカウントに入れますか？', body: 'ログインしないで使っていた名簿・席・予定などを、アカウントに入れます（鍵をかけて）。この端末の元のデータは、そのまま残ります。', ok: '入れる', cancel: '入れない（空から）' });
      if (yes) copyLocalToAccount();
    }
    if (!backend()) await Kit.store.reopen();                       // この端末だけ → アカウントに切りかえる
    await start();
    if (Kit.renderNav) Kit.renderNav();                              // 会員限定の道具（動画編集（β））をメニューに出す
    await Kit.remount();
    Kit.toast(state.locked ? '合言葉を確かめられませんでした' : 'アカウントに保存します（鍵つき）');
  }

  function openStatus() {
    const u = state.usage || {};
    const mb = (b) => (b / 1024 / 1024).toFixed(b < 1024 * 1024 ? 2 : 1) + ' MB';
    const rows = [
      ['ログイン', session.user.email || ''],
      ['保存', state.locked ? '合言葉を入れてください' : state.error === 'quota' ? 'アカウントの容量がいっぱいです' : state.error === 'not_member' ? 'このアカウントでは保存できません' : '鍵をかけて保存しています'],
      ['まだ送っていない', state.pending ? state.pending + ' 件' + (state.offline ? '（つながったら送ります）' : '') : 'なし'],
      ['最後に合わせた時刻', state.lastSync ? Kit.fmtDate(Kit.ymd(state.lastSync), 'M/D') + ' ' + String(state.lastSync.getHours()).padStart(2, '0') + ':' + String(state.lastSync.getMinutes()).padStart(2, '0') : '—'],
      ['使っている量', u.bytes != null ? mb(u.bytes) + (u.limit ? '（上限 ' + mb(u.limit) + '）' : '') : '—'],
    ];
    const body = h('div', { class: 'stack' },
      h('table', { class: 'tbl' }, h('tbody', null, rows.map(([a, b]) => h('tr', null, h('th', { style: { width: '42%' } }, a), h('td', null, b))))),
      h('p', { class: 'small ink-2' }, 'どの端末でも、同じアカウントでログインして合言葉を入れると、同じ内容になります。2台で同じものを同時に直したときは、あとから保存した方が残ります。'),
      h('p', { class: 'tiny muted' }, NOTE_PRIVACY));
    const m = Kit.modal({ title: 'アカウントに保存しています', body, actions: [
      { label: 'ログアウト', kind: 'ghost', onClick: () => { setTimeout(openLogout, 0); } },
      { label: 'いま合わせる', kind: 'primary', onClick: async () => { await sync(); Kit.toast(state.error || state.offline ? '合わせられませんでした。あとでもう一度' : 'ほかの端末と同じ内容にしました'); } },
    ] });
    return m;
  }

  function openLogout() {
    const wipe = h('input', { type: 'checkbox', id: 'cl-wipe', checked: true });
    const body = h('div', { class: 'stack' },
      state.pending ? h('p', { style: { color: 'var(--bad)' } }, 'まだ送っていない変更が ' + state.pending + ' 件あります。ログアウトすると送れません（写しを残せば、次にログインしたときに送ります）。') : null,
      h('label', { class: 'check', for: 'cl-wipe' }, wipe, 'この端末に残っている写し（名簿など）も消す'),
      h('p', { class: 'small muted' }, '学校の共用パソコンでは、必ず消してください。消しても、アカウントの中身は残ります。'));
    Kit.modal({ title: 'ログアウト', body, actions: [{ label: 'やめる', kind: 'ghost' }, { label: 'ログアウト', kind: 'primary', onClick: async () => { await logout({ wipe: wipe.checked }); } }] });
  }

  async function logoutQuiet() {
    try { await http('/auth/v1/logout', { body: {} }); } catch (e) { /* つながらなくても、この端末からは消す */ }
    session = null; writeSession(null);
  }
  async function logout({ wipe }) {
    const uid = session && session.user.id;
    if (!wipe) { try { await push(); } catch (e) { /* noop */ } }
    await logoutQuiet();
    if (uid) {
      await dropKey(uid);
      if (wipe) { const pre = 'sensei:u:' + uid + ':', ks = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i) || ''; if (k.startsWith(pre)) ks.push(k); } ks.forEach((k) => localStorage.removeItem(k)); }
    }
    location.reload();
  }

  /* ───────── 入口 ───────── */
  Kit.cloud = {
    enabled: ok,
    user: () => (session ? session.user : null),
    state: () => Object.assign({}, state, { key: !!state.key }),
    label() {
      if (!session) return null;
      if (state.expired) return { tone: 'bad', text: 'ログインし直してください' };
      if (state.locked) return { tone: 'warn', text: '合言葉を入れてください' };
      if (state.error === 'quota') return { tone: 'bad', text: 'アカウントの容量がいっぱい' };
      if (state.error === 'not_member') return { tone: 'bad', text: 'このアカウントでは保存できません' };
      if (state.busy) return { tone: 'busy', text: 'ほかの端末と合わせています…' };
      if (state.pending) return { tone: 'warn', text: (state.offline ? 'つながっていません・' : '') + '未送信 ' + state.pending + ' 件' };
      if (state.error) return { tone: 'warn', text: 'あとで合わせます' };
      return { tone: 'ok', text: 'アカウントに保存（鍵つき）' };
    },
    mark, start, sync, push, pull, open, logout,
    // テスト用（中身は返さない）
    _debug: () => ({ pending: Object.keys(pend), since: session ? getSince() : null }),
  };
})();

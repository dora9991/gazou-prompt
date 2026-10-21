#!/usr/bin/env node
/* アカウントに保存（鍵つき）の確かめ。手元の Supabase（tools/cloud-local.sh で起こす。本番ではない）を使う。
   1. サーバー：ログインしていない人・会員でない人（保護者会アプリの人）・利用停止の人は使えない／先生どうしの中身は見えない／
      表を直接読めない／名前や大きさの決まり／容量の上限で全部が取り消される／作り直し・全部消す
   2. 画面（Chrome と WebKit。端末を2台にみたてる）：
      端末1 … この端末だけで使っていたデータ → ログイン → 合言葉を決める → アカウントに入れる → サーバーには暗号だけ（名前が読めない）
      端末2 … ログイン → ちがう合言葉は断られる → 正しい合言葉 → 端末1のデータが届く → 直す・足す
      端末1 … 受け取る／消す → 端末2 に届く／電波がないときは、つながってから送る／デモはアカウントに何も送らない
      端末1 … ログアウト（写しも消す）→ アカウントの写しが消え、この端末だけのデータは残る → ログインし直すと戻る
      端末2 … 合言葉を作り直す（写しで入れ直す）→ 端末1 は古い鍵を使わず、新しい合言葉を聞く
   使い方：./tools/cloud-local.sh → node tools/cloud-test.cjs [--engines chrome,webkit] → ./tools/cloud-local.sh --stop */
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const LIB = path.join(os.homedir(), '.claude/skills/shiage/scripts/lib');
const ROOT = path.resolve(__dirname, '..');
const L = JSON.parse(fs.readFileSync(path.join(__dirname, '_out/cloud-local.json'), 'utf8'));
const API = L.API_URL, ANON = L.PUBLISHABLE_KEY || L.ANON_KEY, SERVICE = L.SERVICE_ROLE_KEY;
const DB = 'supabase_db_sensei-kit';
const args = process.argv.slice(2);
const ENGINES = (args[args.indexOf('--engines') + 1] && args.includes('--engines') ? args[args.indexOf('--engines') + 1] : 'chrome,webkit').split(',');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let okN = 0, ngN = 0;
const ok = (cond, msg, extra) => { if (cond) { okN++; console.log('  OK  ' + msg); } else { ngN++; console.log('  NG  ' + msg + (extra ? '：' + extra : '')); } };
const psql = (sql) => execFileSync('docker', ['exec', '-i', DB, 'psql', '-q', '-t', '-A', '-U', 'postgres', '-c', sql], { encoding: 'utf8' }).trim();

/* ── サーバーに直接 ── */
async function call(p, { token, body, profile = 'sensei', method = 'POST' } = {}) {
  const hd = { apikey: ANON, 'Content-Type': 'application/json', 'Content-Profile': profile, 'Accept-Profile': profile };
  if (token) hd.Authorization = 'Bearer ' + token;
  const r = await fetch(API + p, { method, headers: hd, body: method === 'GET' ? undefined : JSON.stringify(body || {}) });
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (e) { j = t; }
  return { status: r.status, body: j, err: r.ok ? null : (j && (j.message || j.msg)) || String(r.status) };
}
const rpc = (name, token, body) => call('/rest/v1/rpc/' + name, { token, body });
async function makeUser(tag, meta) {
  const email = 't' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex') + '-' + tag + '@example.test';
  const password = crypto.randomBytes(12).toString('base64url');
  const r = await fetch(API + '/auth/v1/admin/users', { method: 'POST', headers: { apikey: SERVICE, Authorization: 'Bearer ' + SERVICE, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, email_confirm: true, user_metadata: meta || {} }) });
  const j = await r.json(); if (!r.ok) throw new Error('アカウントを作れません：' + JSON.stringify(j));
  const t = await (await fetch(API + '/auth/v1/token?grant_type=password', { method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })).json();
  return { id: j.id, email, password, token: t.access_token };
}
// サーバーの側でも「合言葉の確かめ用」を作れるように（ブラウザと同じ作り方）
async function fakeVault() {
  const salt = crypto.randomBytes(16);
  const key = crypto.pbkdf2Sync('test-pass-123', salt, 100000, 32, 'sha256');
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key, iv); c.setAAD(Buffer.from('check'));
  const data = Buffer.concat([c.update(JSON.stringify('sensei-kit:v1')), c.final(), c.getAuthTag()]);
  return { p_salt: salt.toString('base64url'), p_iterations: 100000, p_check_iv: iv.toString('base64url'), p_check_data: data.toString('base64url') };
}

async function serverTests() {
  console.log('── サーバー（手元の Supabase）');
  const A = await makeUser('a'), B = await makeUser('b'), H = await makeUser('h', { app: 'hogosha' }), S = await makeUser('s'), C = await makeUser('c');
  psql(`update public.profiles set suspended_at = now() where id = '${S.id}'`);
  let r = await rpc('status', null);
  ok(r.status === 401 || /permission denied/.test(r.err), 'ログインしていない人は呼べない', r.err);
  r = await rpc('status', H.token); ok(/not_member/.test(r.err), '会員でない人（保護者会アプリの人）は使えない', r.err);
  r = await rpc('status', S.token); ok(/not_member/.test(r.err), '利用停止の人は使えない', r.err);
  r = await rpc('status', A.token); ok(r.status === 200 && r.body.vault === null, '会員は使える（はじめは合言葉なし）', JSON.stringify(r.body));
  r = await rpc('push', C.token, { p_rows: [] }); ok(/no_vault/.test(r.err), '合言葉を決める前は送れない', r.err);
  const va = await fakeVault();
  r = await rpc('vault_init', A.token, va); ok(r.status === 200, '合言葉を決める', r.err);
  r = await rpc('vault_init', A.token, va); ok(/vault_exists/.test(r.err), '合言葉は上書きできない（作り直しは別の操作）', r.err);
  r = await rpc('vault_init', B.token, await fakeVault()); ok(r.status === 200, '先生B も合言葉を決める', r.err);
  r = await rpc('push', A.token, { p_rows: [{ kind: 'c', name: 'classes', item_id: 'x-1', iv: 'AAAAAAAAAAAAAAAA', data: 'Zm9vYmFy', deleted: false }, { kind: 'd', name: 'profile', item_id: '', iv: 'AAAAAAAAAAAAAAAA', data: 'YmFy', deleted: false }] });
  ok(r.status === 200 && r.body.saved === 2, '送る（2行）', r.err);
  r = await rpc('pull', B.token, { p_since: null }); ok(r.status === 200 && r.body.length === 0, '先生B には先生A の中身が見えない', JSON.stringify(r.body).slice(0, 80));
  r = await rpc('pull', A.token, { p_since: null }); ok(r.status === 200 && r.body.length === 2, '先生A は自分の中身を受け取れる', JSON.stringify(r.body).slice(0, 80));
  r = await call('/rest/v1/blobs?select=*', { token: A.token, method: 'GET' }); ok(r.status >= 400, '表は直接読めない（関数だけ）', r.status + ' ' + r.err);
  r = await call('/rest/v1/vaults?select=*', { token: A.token, method: 'GET' }); ok(r.status >= 400, '合言葉の確かめ用の表も直接読めない', r.status + ' ' + r.err);
  r = await rpc('push', A.token, { p_rows: [{ kind: 'c', name: 'Bad Name', item_id: '1', iv: 'AAAAAAAAAAAAAAAA', data: 'eA', deleted: false }] }); ok(r.status >= 400, '名前の決まりに合わない行は断る', r.err);
  r = await rpc('push', A.token, { p_rows: [{ kind: 'x', name: 'classes', item_id: '1', iv: '', data: '', deleted: false }] }); ok(r.status >= 400, '種類の決まりに合わない行は断る', r.err);
  // 容量：上限を小さくして、こえる送り方は全部取り消される
  psql(`update sensei.settings set user_bytes = 2000 where id = 1`);
  r = await rpc('push', A.token, { p_rows: [{ kind: 'c', name: 'images', item_id: 'big', iv: 'AAAAAAAAAAAAAAAA', data: 'A'.repeat(3000), deleted: false }, { kind: 'c', name: 'classes', item_id: 'x-2', iv: 'AAAAAAAAAAAAAAAA', data: 'eA', deleted: false }] });
  const n2 = psql(`select count(*) from sensei.blobs where user_id = '${A.id}' and item_id in ('big','x-2')`);
  ok(/quota/.test(r.err) && n2 === '0', '1人の上限をこえると、その回は全部取り消す', r.err + ' 残った行 ' + n2);
  psql(`update sensei.settings set user_bytes = 10 * 1024 * 1024 where id = 1`);
  r = await rpc('push', A.token, { p_rows: [{ kind: 'c', name: 'classes', item_id: 'x-1', deleted: true }] });
  r = await rpc('pull', A.token, { p_since: '2000-01-01T00:00:00Z' });
  ok(r.body.some((x) => x.item_id === 'x-1' && x.deleted && x.data === ''), '消した行は印だけ残る（中身は空）', JSON.stringify(r.body).slice(0, 120));
  r = await rpc('pull', A.token, { p_since: null }); ok(!r.body.some((x) => x.item_id === 'x-1'), 'はじめて受け取るときは、消した印は来ない');
  r = await rpc('vault_reset', A.token, await fakeVault()); ok(r.status === 200 && r.body.removed >= 1, '作り直すと中身が消える', JSON.stringify(r.body));
  r = await rpc('forget_me', B.token); ok(r.status === 200, '全部消す（先生B）', r.err);
  r = await rpc('status', B.token); ok(r.body && r.body.vault === null, '全部消したら合言葉の確かめ用も消える');
  const fn = psql(`select count(*) from information_schema.routine_privileges where routine_schema = 'sensei' and grantee in ('anon','PUBLIC')`);
  ok(fn === '0', 'anon・PUBLIC が呼べる関数は 0', fn);
  const rls = psql(`select bool_and(rowsecurity) from pg_tables where schemaname = 'sensei'`);
  ok(rls === 't', 'sensei の表は全部 RLS オン', rls);
  const sdf = psql(`select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'sensei' and p.prosecdef and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')`);
  ok(sdf === '0', 'security definer の関数は search_path を固定', sdf);
  // 退会（auth.users を消す）を止めない
  execFileSync('docker', ['exec', '-i', DB, 'psql', '-q', '-U', 'postgres', '-c', `delete from auth.users where id = '${C.id}'`]);
  ok(psql(`select count(*) from auth.users where id = '${C.id}'`) === '0', '退会（アカウントを消す）を止めない');
}

/* ── 画面：手元の小さな配信（config.js だけ差し替える） ── */
function serve() {
  const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' };
  const srv = http.createServer((req, res) => {
    const u = decodeURIComponent(req.url.split('?')[0]);
    if (u === '/config.js') { res.writeHead(200, { 'Content-Type': TYPES['.js'], 'Cache-Control': 'no-store' }); return res.end(`window.SENSEI_CONFIG = ${JSON.stringify({ cloud: true, supabaseUrl: API, supabaseKey: ANON })};`); }
    const f = path.join(ROOT, u === '/' ? 'index.html' : u);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise((r) => srv.listen(0, '127.0.0.1', () => r({ srv, url: 'http://127.0.0.1:' + srv.address().port + '/' })));
}

const J = JSON.stringify;
async function waitFor(p, expr, ms = 15000, what) { try { return await p.wait(expr, ms); } catch (e) { throw new Error((what || expr) + ' を待ちきれませんでした'); } }
async function fillModal(p, values) {
  // 式1つで（WebKit の道具の決まり）。値を入れて input を知らせる
  await p.eval(`(() => { const v = ${J(values)}; for (const id of Object.keys(v)) { const e = document.getElementById(id); if (!e) throw new Error('入力欄がありません：' + id); e.value = v[id]; e.dispatchEvent(new Event('input', { bubbles: true })); } return 1; })()`);
}
const clickModal = (p, text) => p.clickText('.modal button', text);
const state = (p) => p.eval(`(() => { const s = Kit.cloud.state(); return { mode: Kit.store.mode, locked: s.locked, pending: s.pending, busy: s.busy, error: s.error, offline: s.offline, key: s.key, user: Kit.cloud.user() && Kit.cloud.user().email }; })()`);
const settled = (p, ms = 20000) => waitFor(p, `(() => { const s = Kit.cloud.state(); return Kit.store.mode === 'cloud' && s.key && !s.locked && !s.busy && s.pending === 0; })()`, ms, '同期が落ち着く');
const classNames = (p) => p.eval(`School.classes.list().then((a) => a.map((c) => c.name))`);

async function browserTests(engine, site) {
  console.log('── 画面（' + engine + '）');
  const { launch } = require(path.join(LIB, engine === 'webkit' ? 'wk.cjs' : 'cdp.cjs'));
  const T = await makeUser('t-' + engine), PASS = 'aikotoba-' + crypto.randomBytes(4).toString('hex');
  const d1 = await launch({ width: 1366, height: 800, maxMs: 10 * 60 * 1000 });
  const d2 = await launch({ width: 1366, height: 800, maxMs: 10 * 60 * 1000 });
  try {
    const p1 = await d1.page(site);
    await waitFor(p1, 'window.Kit && Kit.current && Kit.current() === "home"');
    ok(await p1.eval('!!(Kit.cloud && Kit.cloud.enabled && !Kit.cloud.user())'), '設定が cloud: true なら、ログインの入口が使える（まだログインしていない）');
    ok(await p1.eval(`['beta-grades','beta-mendan'].every((id) => !!document.querySelector('.mb-nav-item[data-app="' + id + '"]')) && !document.querySelector('.mb-nav-item[data-app="beta-video"]')`), 'ログインしていなくても、成績・面談（β）はメニューに出る。動画編集（β）は出ない');
    await p1.eval(`(location.hash = '#beta-video', 1)`); await sleep(700);
    ok(await p1.eval(`!!document.querySelector('.bt-gate') && !document.querySelector('a.btn[href="beta/video/index.html"]')`), '動画編集（β）を URL で直接開いても、ログインの案内だけ');
    await p1.eval(`(location.hash = '#home', 1)`); await sleep(500);
    // この端末だけで使っていたデータ
    await p1.eval(`(async () => { await Kit.store.samplesOff(); await School.classes.save({ id: 'real-1', name: '本物1組', students: [{ id: 'r1', no: 1, name: '本物 たろう', gender: 'm' }, { id: 'r2', no: 2, name: '秘密 はなこ', gender: 'f', note: '配慮メモ' }] }); School.classes.setCurrent('real-1'); await Kit.store.flush(); return 1; })()`);
    await p1.eval('(location.reload(), 1)'); await sleep(800);
    await waitFor(p1, 'window.Kit && Kit.current && Kit.current() === "home"');
    ok(await p1.eval('!!document.querySelector(".hm-cloud")'), 'ホームの「データの扱い」に、ログインの入口が出る');
    await p1.clickText('.hm-cloud button', 'ログインして');
    await waitFor(p1, '!!document.getElementById("cl-email")', 5000, 'ログインの画面');
    await fillModal(p1, { 'cl-email': T.email, 'cl-pass': 'machigai-pass' });
    await clickModal(p1, 'ログイン');
    await waitFor(p1, `(document.querySelector('.modal [role=alert]') || {}).textContent.includes('ちがいます')`, 10000, 'パスワードちがいの知らせ');
    ok(true, 'パスワードがちがうと、ちがうと出る');
    await fillModal(p1, { 'cl-pass': T.password });
    await clickModal(p1, 'ログイン');
    await waitFor(p1, '!!document.getElementById("cl-new1")', 10000, '合言葉を決める画面');
    ok(true, 'はじめてのログインで「合言葉を決める」が出る');
    await fillModal(p1, { 'cl-new1': PASS, 'cl-new2': PASS + 'x' });
    await clickModal(p1, '合言葉を決める');
    await waitFor(p1, `(document.querySelector('.modal [role=alert]') || {}).textContent.includes('ちがいます')`, 5000, '2つの合言葉がちがう知らせ');
    await fillModal(p1, { 'cl-new2': PASS });
    await clickModal(p1, '合言葉を決める');
    await waitFor(p1, `[...document.querySelectorAll('.modal h2')].some((e) => e.textContent.includes('アカウントに入れますか'))`, 20000, '「この端末のデータを入れますか」');
    await clickModal(p1, '入れる');
    await settled(p1, 30000);
    ok((await classNames(p1)).includes('本物1組'), '端末1：アカウントに切りかえても、この端末のデータがそのまま見える');
    ok(await p1.eval(`['beta-grades','beta-mendan','beta-video'].every((id) => !!document.querySelector('.mb-nav-item[data-app="' + id + '"]'))`), 'ログインすると、β版の道具（成績・面談・動画編集）がメニューに出る');
    await p1.eval(`(location.hash = '#beta-grades', 1)`); await sleep(700);
    ok(await p1.eval(`(() => { const f = document.querySelector('.bt-frame'); return !!f && f.getAttribute('src').includes('kantan-seiseki'); })()`), '成績（β）は、この画面の中に開く');
    await p1.eval(`(location.hash = '#beta-video', 1)`); await sleep(500);
    ok(await p1.eval(`(() => { const a = [...document.querySelectorAll('a.btn')].find((x) => x.textContent.includes('動画編集を開く')); return !!a && a.getAttribute('href') === 'beta/video/index.html'; })()`), '動画編集（β）は、新しいタブで開くボタン');
    await p1.eval(`(location.hash = '#home', 1)`); await sleep(500);
    // 暗号を base64 から戻したバイト列の中に、名前・メモ・JSON の手がかり（UTF-8）が無いこと
    const plain = psql(`with x as (select decode(translate(data, '-_', '+/') || repeat('=', (4 - length(data) % 4) % 4), 'base64') as b from sensei.blobs where data <> '') select count(*) from x where position(convert_to('本物', 'UTF8') in b) > 0 or position(convert_to('配慮メモ', 'UTF8') in b) > 0 or position(convert_to('students', 'UTF8') in b) > 0 or position(convert_to('"name"', 'UTF8') in b) > 0`);
    const rows = psql(`select count(*) from sensei.blobs b join auth.users u on u.id = b.user_id where u.email = '${T.email}' and not deleted`);
    ok(+rows > 0 && plain === '0', 'サーバーには暗号だけ（名前・メモ・番号の手がかりが読めない）', '行 ' + rows + '・読めた行 ' + plain);

    // 端末2
    const p2 = await d2.page(site);
    await waitFor(p2, 'window.Kit && Kit.current && Kit.current() === "home"');
    await p2.eval('(Kit.cloud.open(), 1)');
    await waitFor(p2, '!!document.getElementById("cl-email")', 5000, 'ログインの画面（端末2）');
    await fillModal(p2, { 'cl-email': T.email, 'cl-pass': T.password });
    await clickModal(p2, 'ログイン');
    await waitFor(p2, '!!document.getElementById("cl-pass1")', 10000, '合言葉を入れる画面');
    await fillModal(p2, { 'cl-pass1': 'chigau-aikotoba' });
    await clickModal(p2, '開く');
    await waitFor(p2, `(document.querySelector('.modal [role=alert]') || {}).textContent.includes('ちがいます')`, 20000, '合言葉ちがいの知らせ');
    ok(true, '端末2：ちがう合言葉では開かない');
    await fillModal(p2, { 'cl-pass1': PASS });
    await clickModal(p2, '開く');
    await settled(p2, 30000);
    await waitFor(p2, `School.classes.list().then((a) => a.some((c) => c.name === '本物1組'))`, 15000, '端末2 に名簿が届く');
    ok(await p2.eval(`School.classes.list().then((a) => { const c = a.find((x) => x.name === '本物1組'); return !!c && c.students.some((s) => s.note === '配慮メモ'); })`), '端末2：端末1 の名簿（メモまで）が届く');
    // 端末2 で足す → 端末1 に届く
    await p2.eval(`Kit.store.put('reminders', { id: 'rm-from-2', title: '端末2で足した', date: Kit.ymd() }).then(() => Kit.store.flush()).then(() => 1)`);
    await settled(p2);
    await p1.eval('Kit.cloud.pull().then(() => 1)');
    ok(await p1.eval(`Kit.store.list('reminders').then((a) => a.some((r) => r.id === 'rm-from-2'))`), '端末2 で足したリマインダーが、端末1 に届く');
    // 端末1 で消す → 端末2 から消える
    await p1.eval(`Kit.store.remove('reminders', 'rm-from-2').then(() => Kit.store.flush()).then(() => 1)`);
    await settled(p1);
    await p2.eval('Kit.cloud.pull().then(() => 1)');
    ok(await p2.eval(`Kit.store.list('reminders').then((a) => !a.some((r) => r.id === 'rm-from-2'))`), '端末1 で消すと、端末2 からも消える');
    // 電波がないとき
    await p1.eval(`(window.__f = window.fetch, window.fetch = () => Promise.reject(new TypeError('offline')), 1)`);
    await p1.eval(`Kit.store.put('reminders', { id: 'rm-offline', title: '電波なしで足した', date: Kit.ymd() }).then(() => Kit.store.flush()).then(() => 1)`);
    await sleep(2200);
    const s1 = await state(p1);
    ok(s1.pending >= 1 && s1.offline, '電波がないときは「未送信」として残る', J(s1));
    ok(/未送信/.test(await p1.eval(`document.querySelector('.mb-save-state').textContent`)), '左下に「未送信」と出る');
    await p1.eval(`(window.fetch = window.__f, 1)`);
    await p1.eval('Kit.cloud.sync().then(() => 1)');
    await settled(p1);
    await p2.eval('Kit.cloud.pull().then(() => 1)');
    ok(await p2.eval(`Kit.store.list('reminders').then((a) => a.some((r) => r.id === 'rm-offline'))`), 'つながったら送られ、端末2 に届く');
    // デモはアカウントに何も送らない
    const before = psql(`select count(*) || '/' || coalesce(max(b.updated_at)::text, '') from sensei.blobs b join auth.users u on u.id = b.user_id where u.email = '${T.email}'`);
    const cacheBefore = await p1.eval(`(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith('sensei:u:')) o[k] = localStorage.getItem(k); } return JSON.stringify(o); })()`);
    await p1.eval(`(Kit.demo.speed = 0.2, Kit.demo.start('seats').then(() => 1))`);
    await waitFor(p1, `Kit.demo.running() && Kit.demo.running().ready`, 10000, 'デモの1手目');
    for (let i = 0; i < 12; i++) {
      const st = await p1.eval(`(() => { const r = Kit.demo.running(); const b = document.querySelector('.tour-card .tour-btn.primary'); return r ? { done: r.done, ready: r.ready, can: !!(b && !b.disabled) } : null; })()`);
      if (!st || st.done) break;
      if (st.ready && st.can) await p1.clickEl('.tour-card .tour-btn.primary');
      await sleep(900);
    }
    await p1.eval('Kit.demo.end().then(() => 1)');
    await sleep(2500);
    const after = psql(`select count(*) || '/' || coalesce(max(b.updated_at)::text, '') from sensei.blobs b join auth.users u on u.id = b.user_id where u.email = '${T.email}'`);
    const cacheAfter = await p1.eval(`(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith('sensei:u:')) o[k] = localStorage.getItem(k); } return JSON.stringify(o); })()`);
    ok(before === after, 'デモ（席替え）を最後までしても、アカウントには何も送らない', before + ' → ' + after);
    ok(cacheBefore === cacheAfter, 'デモのあと、アカウントの写しも1文字も変わらない');
    // ログアウト（写しも消す）
    await p1.eval('(Kit.cloud.open(), 1)');
    await waitFor(p1, `[...document.querySelectorAll('.modal h2')].some((e) => e.textContent.includes('アカウントに保存'))`, 5000, 'アカウントの画面');
    await clickModal(p1, 'ログアウト');
    await waitFor(p1, '!!document.getElementById("cl-wipe")', 5000, 'ログアウトの画面');
    await p1.clickText('.modal .modal-f button', 'ログアウト');
    await sleep(1500);
    await waitFor(p1, 'window.Kit && Kit.current && !!Kit.current() && Kit.store.mode === "local"', 15000, 'ログアウトして、この端末だけに戻る');
    const left = await p1.eval(`(() => { let n = 0; for (let i = 0; i < localStorage.length; i++) if (localStorage.key(i).startsWith('sensei:u:')) n++; return { n, session: !!localStorage.getItem('sensei:cloud:session') }; })()`);
    ok(left.n === 0 && !left.session, 'ログアウトで、アカウントの写しとログインの記録が消える', J(left));
    ok(await p1.eval(`!document.querySelector('.mb-nav-item[data-app="beta-video"]') && !!document.querySelector('.mb-nav-item[data-app="beta-grades"]')`), 'ログアウトすると、動画編集（β）はメニューから消える（成績は残る）');
    ok((await classNames(p1)).includes('本物1組'), 'この端末だけのデータは残る（ログインしないで使っていた分）');
    // 端末2 で合言葉を作り直す（写しで入れ直す）
    const PASS2 = PASS + '-new';
    // 作り直しは「合言葉を入れる」画面の「合言葉を忘れた」から入る。端末2 の鍵を消して開き直し、合言葉を聞かれる状態にする
    await p2.eval(`(() => new Promise((res) => { const r = indexedDB.deleteDatabase('sensei-kit-keys'); r.onsuccess = r.onerror = () => res(1); }))()`);
    await p2.eval('(location.reload(), 1)'); await sleep(800);
    await waitFor(p2, '!!document.getElementById("cl-pass1")', 15000, '鍵がない端末で、合言葉を聞かれる');
    ok(true, '鍵を忘れた端末では、開いたときに合言葉を聞く（写しは見えたまま）');
    await p2.clickText('.modal button', '合言葉を忘れた');
    await waitFor(p2, '!!document.getElementById("cl-reseed")', 5000, '作り直す画面');
    ok(await p2.eval('document.getElementById("cl-reseed").checked'), '写しがある端末では「写しで入れ直す」が最初から選ばれている');
    await fillModal(p2, { 'cl-new1': PASS2, 'cl-new2': PASS2 });
    await p2.clickText('.modal button.danger', '作り直す');
    await waitFor(p2, `[...document.querySelectorAll('.modal h2')].some((e) => e.textContent.includes('本当に作り直しますか'))`, 5000, '確かめ');
    await p2.clickText('.modal .modal-f button', '作り直す');
    await sleep(1500);
    await waitFor(p2, 'window.Kit && Kit.current && !!Kit.current()', 15000, '開き直し');
    await settled(p2, 30000);
    ok((await classNames(p2)).includes('本物1組'), '作り直したあとも、写しで入れ直した名簿が残る');
    // 端末1 でログインし直す：古い鍵は消えているので、新しい合言葉を聞く。古い合言葉は通らない
    await p1.eval('(Kit.cloud.open(), 1)');
    await waitFor(p1, '!!document.getElementById("cl-email")', 5000, 'ログインの画面（端末1）');
    await fillModal(p1, { 'cl-email': T.email, 'cl-pass': T.password });
    await clickModal(p1, 'ログイン');
    await waitFor(p1, '!!document.getElementById("cl-pass1")', 10000, '合言葉を入れる画面（端末1）');
    await fillModal(p1, { 'cl-pass1': PASS });
    await clickModal(p1, '開く');
    await waitFor(p1, `(document.querySelector('.modal [role=alert]') || {}).textContent.includes('ちがいます')`, 20000, '古い合言葉が断られる');
    ok(true, '作り直したあとは、古い合言葉では開かない');
    await fillModal(p1, { 'cl-pass1': PASS2 });
    await clickModal(p1, '開く');
    await settled(p1, 30000);
    await waitFor(p1, `School.classes.list().then((a) => a.some((c) => c.name === '本物1組'))`, 15000, '端末1 に戻る');
    ok(await p1.eval(`Kit.store.list('reminders').then((a) => a.some((r) => r.id === 'rm-offline'))`), '新しい合言葉で、端末1 にも全部戻る');
    const errs = p1.errors().concat(p2.errors()).filter((l) => !/Failed to load resource|offline|net::ERR/.test(l.text));
    ok(errs.length === 0, 'コンソールにエラーがない', errs.map((l) => l.text.slice(0, 120)).join(' / '));
  } finally { await d1.close(); await d2.close(); }
}

(async () => {
  await serverTests();
  const { srv, url } = await serve();
  try { for (const e of ENGINES) await browserTests(e, url); }
  catch (e) { ngN++; console.log('  NG  止まりました：' + e.message); }
  finally { srv.close(); }
  console.log(`\n${okN} 件 OK・${ngN} 件 NG`);
  process.exit(ngN ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });

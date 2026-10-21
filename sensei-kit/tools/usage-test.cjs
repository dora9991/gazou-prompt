#!/usr/bin/env node
/* 利用の記録（公式LINE アラフォーの特典）の確かめ。手元の Supabase（./tools/cloud-local.sh。sensei_usage と関数 sensei-line 入り）と、
   LINE の本人確認のまね（tools/fixtures/line-mock.cjs・57471）・LIFF のまね（tools/fixtures/liff-fake.js）を使う。本番にはつながない。
   1. サーバー：だれか分からない記録は断る／形のおかしい記録は1件も入らない／LINE の本人確認（本物の札だけ）／受け渡しの札は1回だけ／
      札の期限切れ／端末ごとの上限／管理キー（まちがい・集計・消す・記録を止める）／表は直接読めない
   2. 画面（Chrome と WebKit）：line-hub のリンク（?c=lh-…）から開く → 記録される・アドレス欄から合言葉が消える・デモの中の操作は数えない・記録を止める
      LIFF から開く → LINE の本人確認 → 記録に名前 → 「ブラウザで開く」→ 別の端末（ブラウザ）で受け渡しの札 → 同じ人として記録
      LINE のトークでふつうのリンク（LIFF ではない）→ ログインに飛ばない（コードがあればコードで記録・なければ何もしない）
      利用状況の画面（管理キー）に人と道具が出る・消せる
   node tools/usage-test.cjs [--engines chrome,webkit] */
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { execFileSync } = require('child_process');
const LIB = path.join(os.homedir(), '.claude/skills/shiage/scripts/lib');
const ROOT = path.resolve(__dirname, '..');
const L = JSON.parse(fs.readFileSync(path.join(__dirname, '_out/cloud-local.json'), 'utf8'));
const API = L.API_URL, ANON = L.PUBLISHABLE_KEY || L.ANON_KEY;
const DB = 'supabase_db_sensei-kit';
const mock = require('./fixtures/line-mock.cjs');
const args = process.argv.slice(2);
const ENGINES = (args.includes('--engines') ? args[args.indexOf('--engines') + 1] : 'chrome,webkit').split(',');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let okN = 0, ngN = 0;
const ok = (c, m, d) => { if (c) { okN++; console.log('  OK  ' + m); } else { ngN++; console.log('  NG  ' + m + (d ? '：' + d : '')); } };
const psql = (sql) => execFileSync('docker', ['exec', '-i', DB, 'psql', '-q', '-t', '-A', '-U', 'postgres', '-c', sql], { encoding: 'utf8' }).trim();
const J = JSON.stringify;

async function rpc(name, body, key = ANON) {
  const r = await fetch(API + '/rest/v1/rpc/' + name, { method: 'POST', headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', 'Content-Profile': 'sensei_usage', 'Accept-Profile': 'sensei_usage' }, body: J(body) });
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (e) { j = t; }
  return { status: r.status, body: j };
}
async function lineSession(p) {
  const r = await fetch(API + '/functions/v1/sensei-line', { method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: J({ id_token: mock.token(p) }) });
  return { status: r.status, body: await r.json().catch(() => null) };
}
const dev = (n) => ('dev' + n + '0000000000000000000').slice(0, 20);
const U1 = 'U' + '1'.repeat(32), U2 = 'U' + '2'.repeat(32);

async function serverTests() {
  console.log('── サーバー（手元の Supabase）');
  psql(`truncate sensei_usage.events, sensei_usage.handoffs, sensei_usage.line_sessions, sensei_usage.usage_day; delete from sensei_usage.line_users; update sensei_usage.settings set logging_enabled = true, max_per_device_10min = 300 where id`);
  let r = await rpc('log_events', { p: { device: dev(1), events: [{ app: 'seats', action: 'open' }] } });
  ok(r.body && r.body.error === 'no_identity', 'だれか分からない（LINE もコードもない）記録は断る', J(r.body));
  r = await rpc('log_events', { p: { device: 'x', code: 'lh-a', events: [{ app: 'seats', action: 'open' }] } });
  ok(r.body && r.body.error === 'bad_device', '端末の番号の形がおかしいと断る');
  r = await rpc('log_events', { p: { device: dev(1), code: 'lh-a', events: [{ app: 'seats', action: 'open' }, { app: 'Seats!', action: 'open' }] } });
  ok(r.status >= 400 && psql(`select count(*) from sensei_usage.events`) === '0', '形のおかしい記録が1つでもあれば、その回は1件も入らない', r.status);
  r = await rpc('log_events', { p: { device: dev(1), code: 'lh-a', events: [{ app: 'seats', action: 'open' }, { app: 'seats', action: 'run', n: 2 }] } });
  ok(r.body && r.body.ok && r.body.who === 'code' && r.body.saved === 2, 'コードつきの記録は入る', J(r.body));
  r = await rpc('log_events', { p: { device: dev(1), code: 'lh-a', events: Array.from({ length: 51 }, () => ({ app: 'seats', action: 'open' })) } });
  ok(r.body && r.body.error === 'too_many', '1回に 51 件以上は断る');
  // LINE の本人確認
  r = await lineSession({ sub: U1, name: 'テスト先生' });
  ok(r.status === 200 && r.body.ok && /^[0-9a-f]{64}$/.test(r.body.session) && r.body.name === 'テスト先生', 'LINE の本物の札なら、記録用の札が出る', J(r.body));
  const s1 = r.body.session;
  r = await lineSession({ sub: U1, sig: 'bad' }); ok(r.status === 401, '署名がにせものの札は断る', r.status);
  r = await lineSession({ sub: U1, aud: '999' }); ok(r.status === 401, 'ほかのチャネル宛ての札は断る', r.status);
  r = await lineSession({ sub: U1, exp: Math.floor(Date.now() / 1000) - 10 }); ok(r.status === 401, '期限切れの札は断る', r.status);
  r = await lineSession({ sub: 'Uxyz' }); ok(r.status === 401, 'LINE の ID の形がおかしい札は断る', r.status);
  r = await rpc('log_events', { p: { device: dev(2), session: s1, events: [{ app: 'flyer', action: 'print' }] } });
  ok(r.body && r.body.who === 'line' && psql(`select line_user_id from sensei_usage.events where app = 'flyer'`) === U1, '記録用の札で送ると、LINE の人の記録になる');
  r = await rpc('line_session_start', { p_line_user_id: U2 });
  ok(r.status >= 400, '公開用キーからは、札を作る関数を呼べない（Edge Function だけ）', r.status);
  // 受け渡しの札
  r = await rpc('handoff_create', { p_session: s1 });
  ok(r.body && r.body.ok && /^[0-9a-f]{64}$/.test(r.body.code), '札を持っている人は、受け渡しの札を作れる');
  const hc = r.body.code;
  r = await rpc('handoff_redeem', { p_code: hc });
  ok(r.body && r.body.ok && r.body.name === 'テスト先生' && r.body.session !== s1, '受け渡しの札で、別のブラウザ用の札が出る（同じ人）');
  r = await rpc('handoff_redeem', { p_code: hc }); ok(r.body && r.body.error === 'used_or_expired', '受け渡しの札は1回だけ');
  r = await rpc('handoff_create', { p_session: 'f'.repeat(64) }); ok(r.body && r.body.error === 'expired', '札がないと受け渡しの札は作れない');
  // 期限切れ
  psql(`update sensei_usage.line_sessions set expires_at = now() - interval '1 minute' where line_user_id = '${U1}'`);
  r = await rpc('log_events', { p: { device: dev(2), session: s1, code: 'lh-b', events: [{ app: 'seats', action: 'open' }] } });
  ok(r.body && r.body.ok && r.body.who === 'code' && r.body.expired === true, '札が期限切れでも、コードがあればコードの記録になり「期限切れ」を知らせる', J(r.body));
  r = await rpc('log_events', { p: { device: dev(2), session: s1, events: [{ app: 'seats', action: 'open' }] } });
  ok(r.body && r.body.error === 'no_identity' && r.body.expired === true, '札が期限切れでコードもなければ断る（画面は本人確認をやり直す）');
  // 上限
  psql(`update sensei_usage.settings set max_per_device_10min = 3 where id`);
  r = await rpc('log_events', { p: { device: dev(3), code: 'lh-c', events: [1, 2, 3, 4].map(() => ({ app: 'seats', action: 'open' })) } });
  ok(r.body && r.body.error === 'limit', '同じ端末から 10 分に上限をこえると断る');
  psql(`update sensei_usage.settings set max_per_device_10min = 300 where id`);
  // 表は直接読めない
  const g = await fetch(API + '/rest/v1/events?select=*', { headers: { apikey: ANON, 'Accept-Profile': 'sensei_usage' } });
  ok(g.status >= 400, '公開用キーから表は直接読めない', g.status);
  ok(psql(`select bool_and(rowsecurity) from pg_tables where schemaname = 'sensei_usage'`) === 't', 'sensei_usage の表は全部 RLS オン');
  ok(psql(`select string_agg(routine_name, ',' order by routine_name) from information_schema.routine_privileges where routine_schema = 'sensei_usage' and grantee = 'anon'`) === 'admin_events,admin_forget,admin_set_logging,admin_status,handoff_create,handoff_redeem,log_events', '公開用キーで呼べるのは決めた7つの関数だけ');
  // 管理キー
  const key = psql(`select sensei_usage.issue_admin_key()`);
  r = await rpc('admin_status', { p_key: 'su_wrong_wrong_wrong_wrong' }); ok(r.body && r.body.error === 'bad_key', '管理キーがちがうと読めない');
  r = await rpc('admin_events', { p_key: key });
  ok(r.body && r.body.ok && r.body.events.length >= 4 && r.body.people.some((p) => p.name === 'テスト先生'), '管理キーで、記録と人が読める', r.body && r.body.events && r.body.events.length);
  r = await rpc('admin_set_logging', { p_key: key, p_enabled: false });
  r = await rpc('log_events', { p: { device: dev(4), code: 'lh-d', events: [{ app: 'seats', action: 'open' }] } }); ok(r.body && r.body.error === 'off', '記録を止めると、送っても入らない');
  await rpc('admin_set_logging', { p_key: key, p_enabled: true });
  r = await rpc('admin_forget', { p_key: key, p_line_user_id: U1 });
  ok(r.body && r.body.ok && psql(`select count(*) from sensei_usage.events where line_user_id = '${U1}'`) === '0' && psql(`select count(*) from sensei_usage.line_users where line_user_id = '${U1}'`) === '0', '人を消すと、その人の記録・札も消える');
  return key;
}

function serve() {
  const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' };
  const srv = http.createServer((req, res) => {
    const u = decodeURIComponent(req.url.split('?')[0]);
    if (u === '/config.js') { res.writeHead(200, { 'Content-Type': TYPES['.js'], 'Cache-Control': 'no-store' }); return res.end(`(function(){try{var u=localStorage.getItem('fake-ua');if(u)Object.defineProperty(navigator,'userAgent',{get:function(){return u;},configurable:true});}catch(e){}})();\nwindow.SENSEI_CONFIG = ${J({ cloud: false, supabaseUrl: API, supabaseKey: ANON, line: { enabled: true, liffId: '1234567890-testliff', sdkUrl: '/tools/fixtures/liff-fake.js' } })};`); }
    const f = path.join(ROOT, u === '/' ? 'index.html' : u);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise((r) => srv.listen(0, '127.0.0.1', () => r({ srv, url: 'http://127.0.0.1:' + srv.address().port + '/' })));
}
const waitFor = async (p, expr, ms = 15000, what) => { try { return await p.wait(expr, ms); } catch (e) { throw new Error((what || expr) + ' を待ちきれませんでした'); } };
const count = (where) => +psql(`select coalesce(sum(n), 0) from sensei_usage.events where ${where}`);

async function browserTests(engine, site, key) {
  console.log('── 画面（' + engine + '）');
  const { launch } = require(path.join(LIB, engine === 'webkit' ? 'wk.cjs' : 'cdp.cjs'));
  const code = 'lh-' + engine + Date.now().toString(36);
  const UL = 'U' + (engine === 'webkit' ? 'b' : 'a').repeat(32);
  const b1 = await launch({ width: 1366, height: 800, maxMs: 8 * 60 * 1000 });
  const b2 = await launch({ width: 1366, height: 800, maxMs: 8 * 60 * 1000 });
  const b3 = await launch({ width: 390, height: 760, maxMs: 8 * 60 * 1000 });
  try {
    // A. line-hub のリンクから
    const p = await b1.page(site + '?c=' + code + '#seats');
    await waitFor(p, `window.Kit && Kit.current && Kit.current() === 'seats' && Kit.usage.state().state === 'code'`, 15000, 'リンクから開く');
    ok(!(await p.eval('location.search')).includes('c=') && (await p.eval(`localStorage.getItem('sensei:usage:code')`)) === code, 'リンクの合言葉は端末に覚えて、アドレス欄からは消す');
    await p.clickText('.app-head button', '席替えする'); await sleep(1500);
    await p.eval('Kit.usage.flush().then(() => 1)'); await sleep(500);
    ok(count(`code = '${code}' and app = 'kit' and action = 'start'`) === 1 && count(`code = '${code}' and app = 'seats' and action = 'open'`) >= 1 && count(`code = '${code}' and app = 'seats' and action = 'run'`) === 1, 'リンクから開いた人の「開いた・席替えをした」が記録される');
    // デモの中の操作は数えない
    await p.eval(`(Kit.demo.speed = 0.2, Kit.demo.start('seats').then(() => 1))`);
    await waitFor(p, `Kit.demo.running() && Kit.demo.running().ready`, 10000, 'デモ');
    for (let i = 0; i < 14; i++) {
      const st = await p.eval(`(() => { const r = Kit.demo.running(); const b = document.querySelector('.tour-card .tour-btn.primary'); return r ? { done: r.done, ready: r.ready, can: !!(b && !b.disabled) } : null; })()`);
      if (!st || st.done) break;
      if (st.ready && st.can) await p.clickEl('.tour-card .tour-btn.primary');
      await sleep(800);
    }
    await p.eval('Kit.demo.end().then(() => Kit.usage.flush()).then(() => 1)'); await sleep(800);
    ok(count(`code = '${code}' and app = 'seats' and action = 'demo-start'`) === 1 && count(`code = '${code}' and app = 'seats' and action = 'demo-done'`) === 1, 'デモを見た・最後まで見た、は記録される');
    ok(count(`code = '${code}' and app = 'seats' and action = 'run'`) === 1, 'デモの中の「席替えする」（自動）は数えない');
    // ホームの説明と「記録を止める」
    await p.eval(`(location.hash = '#home', 1)`); await waitFor(p, `!!document.querySelector('.us-note')`, 8000, 'ホームの説明');
    ok(/どの道具を使ったか/.test(await p.eval(`document.querySelector('.us-note').textContent`)), 'ホームの「データの扱い」に、記録していることと止め方が出る');
    await p.clickText('.us-note button', '記録を止める'); await sleep(600);
    await p.eval(`(location.hash = '#roulette', 1)`); await sleep(1200);
    await p.eval('Kit.usage.flush().then(() => 1)'); await sleep(400);
    ok(count(`code = '${code}' and app = 'roulette'`) === 0 && (await p.eval(`Kit.usage.state().off`)), '「記録を止める」と、それからは送らない');

    // B. LIFF から（LINE の中）
    const q = await b2.page(site + 'index.html?liff.state=%2F');
    await q.eval(`(localStorage.removeItem('sensei:usage:line'), localStorage.setItem('fake-liff-user', '${UL}'), localStorage.setItem('fake-liff-name', 'LINEの先生'), 1)`);
    await q.goto(site + 'index.html?liff.state=%2F');
    await waitFor(q, `window.Kit && Kit.usage && Kit.usage.state().state === 'line'`, 15000, 'LIFF で本人確認');
    ok((await q.eval(`Kit.usage.state().name`)) === 'LINEの先生', 'LIFF から開くと、LINE で本人確認して名前が分かる');
    await waitFor(q, `!!document.querySelector('.us-bar')`, 5000, 'LINE の中の帯');
    ok(true, 'LINE の中で開いていると「ブラウザで開く」の帯が出る');
    await q.eval(`(location.hash = '#flyer', 1)`); await sleep(1200);
    await q.eval('Kit.usage.flush().then(() => 1)'); await sleep(500);
    ok(count(`line_user_id = '${UL}' and app = 'flyer' and action = 'open'`) >= 1, 'LINE の人として「チラシを開いた」が記録される');
    // ブラウザで開く → 別のブラウザ（端末）で受け渡し
    await q.eval(`(window.liff.openWindow = (o) => { window.__opened = o.url; }, 1)`);
    await q.clickText('.us-bar button', 'ブラウザで開く');
    const opened = await waitFor(q, `window.__opened || ''`, 8000, '受け渡しの URL');
    ok(/\?h=[0-9a-f]{64}#/.test(opened), '「ブラウザで開く」で、受け渡しの札つきの URL を外のブラウザへ渡す');
    const r3 = await b3.page(opened);
    await waitFor(r3, `window.Kit && Kit.usage && Kit.usage.state().state === 'line' && Kit.usage.state().name === 'LINEの先生'`, 15000, '外のブラウザで同じ人');
    ok(!(await r3.eval('location.search')).includes('h='), '外のブラウザでも同じ人になり、受け渡しの札はアドレス欄から消える');
    await r3.eval(`(location.hash = '#roulette', 1)`); await sleep(1200);
    await r3.eval('Kit.usage.flush().then(() => 1)'); await sleep(500);
    ok(count(`line_user_id = '${UL}' and app = 'roulette' and action = 'open'`) >= 1, '外のブラウザで使った道具も、同じ LINE の人の記録になる');
    ok(psql(`select count(*) from sensei_usage.events where app !~ '^[a-z][a-z0-9-]*$' or action !~ '^[a-z][a-z0-9_.:-]*$'`) === '0', '記録は道具と操作の名前だけ（名前や中身は入る場所がない）');

    // D. LINE のトークで、ふつうのリンク（LIFF ではない LINE の中のブラウザ）を押したとき：ログインに飛ばさない
    const LINE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/14.16.0';
    const d = await b3.page(site + 'index.html');
    const codeD = 'lh-talk' + engine + Date.now().toString(36);
    const fresh = `(localStorage.clear(), localStorage.setItem('fake-ua', ${J(LINE_UA)}), localStorage.setItem('fake-liff-inclient', '0'), localStorage.setItem('fake-liff-loggedin', '0'), 1)`;
    await d.eval(fresh);
    await d.goto(site + 'index.html?c=' + codeD + '#roulette');
    await waitFor(d, `window.Kit && Kit.usage && !!window.__liffInit && Kit.usage.state().state === 'code'`, 15000, 'LINE の中のブラウザ（コードあり）');
    ok(/Line\//.test(await d.eval('navigator.userAgent')) && !(await d.eval('window.__liffLogin || 0')), 'LINE のトークでリンクを押しても、ログインに飛ばない（コードあり）');
    await d.eval('Kit.usage.flush().then(() => 1)'); await sleep(500);
    ok(count(`code = '${codeD}' and app = 'roulette' and action = 'open'`) >= 1, 'そのときは、リンクのコードで記録される');
    await d.eval(fresh);
    await d.goto(site + 'index.html?again=1#seats');   // ハッシュだけ変えると読み込み直さないので、別の URL に
    await waitFor(d, `window.Kit && Kit.usage && !!window.__liffInit && Kit.usage.state().state === 'off'`, 15000, 'LINE の中のブラウザ（コードなし）');
    await sleep(600);
    ok(!(await d.eval('window.__liffLogin || 0')) && (await d.eval('Kit.usage.state().queued')) === 0 && !(await d.eval('localStorage.getItem("sensei:usage:queue") || ""')).includes('seats'), 'コードもないときは、ログインに飛ばさず、何も記録しない');
    // 外のブラウザで特典のリンク（liff.line.me → ?liff.state=）から来たときは、これまでどおり LINE のログインへ
    await d.eval(`(localStorage.clear(), localStorage.setItem('fake-liff-inclient', '0'), localStorage.setItem('fake-liff-loggedin', '0'), 1)`);
    await d.goto(site + 'index.html?liff.state=%2F');
    await waitFor(d, `window.Kit && Kit.usage && (window.__liffLogin || 0) > 0`, 15000, '特典のリンクから外のブラウザ');
    ok(true, '特典のリンクから外のブラウザで開いたときは、これまでどおり LINE のログインへ進む');

    // C. 利用状況の画面
    const a = await b1.page(site + 'usage-admin.html');
    await a.eval(`(document.getElementById('ua-k').value = ${J(key)}, 1)`);
    await a.clickText('button', '見る');
    await waitFor(a, `!!document.querySelector('#ua-body:not([hidden]) .ua-kpis')`, 10000, '利用状況');
    const txt = await a.eval(`document.getElementById('ua-body').textContent`);
    ok(txt.includes('LINEの先生') && txt.includes('リンク ' + code) && txt.includes('チラシ') && txt.includes('席替えをした'), '利用状況の画面に、人（LINE の名前・リンクのコード）と道具・操作が出る');
    const errs = p.errors().concat(q.errors(), r3.errors(), d.errors(), a.errors()).filter((l) => !/Failed to load resource|favicon/.test(l.text));
    ok(errs.length === 0, 'コンソールにエラーがない', errs.map((l) => l.text.slice(0, 120)).join(' / '));
  } finally { await b1.close(); await b2.close(); await b3.close(); }
}

(async () => {
  const m = await mock.start(57471, '0.0.0.0');
  let key = null;
  try {
    key = await serverTests();
    const { srv, url } = await serve();
    try { for (const e of ENGINES) await browserTests(e, url, key); }
    catch (e) { ngN++; console.log('  NG  止まりました：' + e.message); }
    finally { srv.close(); }
  } finally { m.server.close(); }
  console.log(`\n${okN} 件 OK・${ngN} 件 NG`);
  process.exit(ngN ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });

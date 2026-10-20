#!/usr/bin/env node
/* バックアップの声かけ・ほかの端末へ移す・番号だけで使う、の確かめ（Chrome と WebKit。この端末だけで使う場合）
   node tools/test-backup.cjs [--engines chrome,webkit]
   ・サンプルだけのときは声をかけない／自分のデータを入れた日も声をかけない
   ・入れはじめてから 14 日たつと「まだ書き出していません」、最後に書き出してから 14 日で「◯日たちました」
   ・「あとで」で 7 日しまう／書き出すと消える／デモの中では出ない
   ・ほかの端末へ移す：全部なら名簿も入る。「名簿を入れない」なら生徒の名前・記録が1つも入らない
   ・「名簿を入れない」ファイルを別の端末で取り込むと、予定は入り、その端末の名簿はそのまま
   ・名簿の貼り付けに「番号だけで作る」がある */
const fs = require('fs');
const os = require('os');
const path = require('path');
const LIB = path.join(os.homedir(), '.claude/skills/shiage/scripts/lib');
const url = 'file://' + path.resolve(__dirname, '..', 'index.html');
const args = process.argv.slice(2);
const ENGINES = (args.includes('--engines') ? args[args.indexOf('--engines') + 1] : 'chrome,webkit').split(',');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let okN = 0, ngN = 0;
const ok = (c, m, d) => { if (c) { okN++; console.log('  OK  ' + m); } else { ngN++; console.log('  NG  ' + m + (d ? '：' + d : '')); } };
const J = JSON.stringify;

// 式1つ（WebKit の道具の決まり）
const home = async (p) => { await p.eval(`(location.hash = '#roster', 1)`); await sleep(250); await p.eval(`(location.hash = '#home', 1)`); await p.wait(`Kit.current() === 'home' && !!document.querySelector('#hm-backup')`, 8000); await sleep(300); };
const remindText = (p) => p.eval(`(() => { const e = document.querySelector('.hm-remind'); return e ? e.textContent : ''; })()`);
const setPref = (p, k, v) => p.eval(`(Kit.pref.set(${J(k)}, ${J(v)}), 1)`);
const days = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
// 下に出る知らせ（数秒で消える）がボタンに重なっているあいだは押さない
const noToast = (p) => p.wait(`!document.querySelector('.toast')`, 10000);
const HOOK = `(window.__dl = [], Kit.download = async (name, data) => { window.__dl.push({ name, data: String(data) }); return true; }, 1)`;

async function run(engine) {
  console.log('── ' + engine);
  const { launch } = require(path.join(LIB, engine === 'webkit' ? 'wk.cjs' : 'cdp.cjs'));
  const b1 = await launch({ width: 1366, height: 800, maxMs: 6 * 60 * 1000 });
  const b2 = await launch({ width: 1366, height: 800, maxMs: 6 * 60 * 1000 });
  try {
    const p = await b1.page(url);
    await p.wait('window.Kit && Kit.current && Kit.current() === "home"', 15000);
    await p.eval(HOOK);
    await home(p);
    ok((await remindText(p)) === '', 'サンプルだけのときは、声をかけない');
    await p.eval(`(async () => { await School.classes.save({ id: 'own-1', name: '自分の1組', students: [{ id: 'o1', no: 1, name: '本物 たろう' }, { id: 'o2', no: 2, name: '' }] }); await Kit.store.put('events', { id: 'ev-own', title: '自分の行事', date: Kit.rel(3) }); await Kit.store.flush(); return 1; })()`);
    await home(p);
    ok((await remindText(p)) === '', '自分のデータを入れた日は、声をかけない');
    ok((await p.eval(`Kit.pref.get('backup:since', null)`)) === days(0), '自分のデータを見つけた日を覚える');
    await setPref(p, 'backup:since', days(15)); await home(p);
    let t = await remindText(p);
    ok(/15 日/.test(t) && /まだバックアップ/.test(t), '入れはじめてから 15 日：まだ書き出していない、と声をかける', t.slice(0, 60));
    await p.clickText('.hm-remind button', 'あとで'); await sleep(400);
    ok((await remindText(p)) === '' && (await p.eval(`Kit.pref.get('backup:snooze', null)`)) > days(0), '「あとで」でしまう（7日後まで）');
    await home(p);
    ok((await remindText(p)) === '', '「あとで」のあと、開き直しても出ない');
    await setPref(p, 'backup:snooze', null); await setPref(p, 'backup:last', days(3)); await home(p);
    ok((await remindText(p)) === '', '最後に書き出してから 3 日なら出ない');
    await setPref(p, 'backup:last', days(20)); await home(p);
    t = await remindText(p);
    ok(/20 日たちました/.test(t), '最後に書き出してから 20 日：◯日たちました、と声をかける', t.slice(0, 60));
    await p.clickText('.hm-remind button', '書き出す'); await sleep(600);
    ok((await p.eval(`window.__dl.length`)) === 1 && (await p.eval(`Kit.pref.get('backup:last', null)`)) === days(0) && (await remindText(p)) === '', '「書き出す」でバックアップが出て、声かけが消える');
    // デモの中では出ない
    await setPref(p, 'backup:last', days(30));
    await p.eval(`Kit.demo.start('home').then(() => 1)`); await sleep(800);
    ok((await remindText(p)) === '', 'デモの中では声をかけない');
    await p.eval(`Kit.demo.end().then(() => 1)`); await sleep(600);
    await p.eval(HOOK);
    await home(p);
    ok(/30 日/.test(await remindText(p)), 'デモを終えると、また声をかける');

    // ほかの端末へ移す（ホームの描き直しが落ち着いてから押す）
    await sleep(600); await noToast(p);
    await p.clickText('#hm-backup button', 'ほかの端末へ移す');
    await p.wait(`[...document.querySelectorAll('.modal h2')].some((e) => e.textContent.includes('ほかの端末へ移す'))`, 5000);
    await p.clickText('.modal .modal-f button', '移すファイルを書き出す'); await sleep(600);
    const all = await p.eval(`window.__dl[window.__dl.length - 1]`);
    const allData = JSON.parse(all.data);
    ok(/sensei-kit-move-\d/.test(all.name) && (allData.colls.classes || []).some((c) => c.name === '自分の1組') && all.data.includes('本物 たろう'), '全部：名簿も入る');
    ok((await p.eval(`Kit.pref.get('backup:last', null)`)) === days(0), '全部を書き出すと、バックアップを書き出した日としても覚える');
    await noToast(p);
    await p.clickText('#hm-backup button', 'ほかの端末へ移す');
    await p.wait(`[...document.querySelectorAll('.modal h2')].some((e) => e.textContent.includes('ほかの端末へ移す'))`, 5000);
    await p.clickText('.modal .seg button', '名簿を入れない'); await sleep(200);
    ok(/生徒の名前や記録は入りません/.test(await p.eval(`document.querySelector('.modal').textContent`)), '「名簿を入れない」を選ぶと、入るものの説明が変わる');
    await p.clickText('.modal .modal-f button', '移すファイルを書き出す'); await sleep(600);
    const safe = await p.eval(`window.__dl[window.__dl.length - 1]`);
    const safeData = JSON.parse(safe.data);
    const bad = Object.keys(safeData.colls).filter((k) => !['events', 'reminders', 'ttgrids', 'ttplans', 'msgtemplates'].includes(k));
    ok(/nonames/.test(safe.name) && safeData.scope === 'no-roster' && !bad.length && !safe.data.includes('本物 たろう') && !safe.data.includes('自分の1組') && (safeData.colls.events || []).some((e) => e.id === 'ev-own'), '名簿を入れない：生徒の名前・クラス・記録が1つも入らず、予定は入る', bad.join(','));

    // 別の端末で取り込む（その端末の名簿はそのまま）
    const q = await b2.page(url);
    await q.wait('window.Kit && Kit.current && Kit.current() === "home"', 15000);
    await q.eval(`(async () => { await Kit.store.samplesOff(); await School.classes.save({ id: 'home-1', name: '家の端末の組', students: [{ id: 'h1', no: 1, name: '' }] }); await Kit.store.flush(); return 1; })()`);
    await q.eval(`Kit.store.importAll(${J(safeData)}).then(() => 1)`);
    const after = await q.eval(`Promise.all([School.classes.list(), Kit.store.list('events')]).then(([c, e]) => ({ classes: c.map((x) => x.name), ev: e.some((x) => x.id === 'ev-own') }))`);
    ok(after.ev && after.classes.includes('家の端末の組') && !after.classes.includes('自分の1組'), '「名簿を入れない」ファイルを取り込むと、予定が入り、その端末の名簿はそのまま', J(after));

    // 番号だけで作る
    await noToast(p);
    await p.eval(`(location.hash = '#roster', 1)`); await p.wait(`Kit.current() === 'roster'`, 5000); await sleep(400);
    await p.clickText('.app-head button', '名簿を貼り付ける');
    await p.wait(`!!document.querySelector('.modal .ro-numonly')`, 5000);
    ok(true, '名簿の貼り付けに「名前を入れなくても使えます」がある');
    await p.clickText('.modal .ro-numonly button', '番号だけで作る');
    await p.wait(`[...document.querySelectorAll('.modal h2')].some((e) => e.textContent.includes('クラスを追加'))`, 5000);
    ok(true, '「番号だけで作る」で、番号だけのクラスを作る画面が開く');
    const errs = p.errors().concat(q.errors());
    ok(errs.length === 0, 'コンソールにエラーがない', errs.map((l) => l.text.slice(0, 100)).join(' / '));
  } finally { await b1.close(); await b2.close(); }
}

(async () => {
  for (const e of ENGINES) { try { await run(e); } catch (err) { ngN++; console.log('  NG  止まりました：' + err.message); } }
  console.log(`\n${okN} 件 OK・${ngN} 件 NG`);
  process.exit(ngN ? 1 : 0);
})();

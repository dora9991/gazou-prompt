#!/usr/bin/env node
/* 使い方のデモの確かめ：道具ごとのデモを最後まで進めて、次を調べる。
   ・どの手順も、囲む所が見つかるか（見つからないと「説明だけ」になる）
   ・途中でエラーが出ないか
   ・デモを終えたあと、本物のデータ（このブラウザの保存）が1文字も変わっていないか。本物のクラスに戻っているか
   Chrome と、Safari と同じエンジン（WebKit・macOS のみ）の両方で、パソコンとスマホの大きさで。
   画面を動かすのは /shiage の道具（~/.claude/skills/shiage/scripts/lib の cdp.cjs・wk.cjs。追加ライブラリなし）。

   node tools/demo-check.cjs                       … 全部の道具 × Chrome・WebKit × パソコン・スマホ
   node tools/demo-check.cjs seats roster          … 道具をしぼる
   node tools/demo-check.cjs --engines chrome --sizes pc --shots tools/_out/demo   … 手順ごとに画面を撮る */
const fs = require('fs');
const os = require('os');
const path = require('path');
const LIB = path.join(os.homedir(), '.claude/skills/shiage/scripts/lib');
const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const ids = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
const ENGINES = opt('engines', 'chrome,webkit').split(',');
const SIZES = { pc: { width: 1366, height: 657 }, phone: { width: 390, height: 700, mobile: true } };
const sizes = opt('sizes', 'pc,phone').split(',');
const shotsDir = opt('shots', null);
const html = opt('html', path.join(ROOT, 'index.html'));
const url = 'file://' + path.resolve(html);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dbg = (...a) => { if (process.env.DEBUG) console.log('   …', ...a); };

// 本物のデータのかわり：自分のクラスを1つ入れて、サンプルを片付けた状態
const SEED = `(async () => {
  await Kit.store.samplesOff();
  await School.classes.save({ id: 'real-1', name: '本物1組', students: [{ id: 'r1', no: 1, name: '本物 たろう', gender: 'm' }, { id: 'r2', no: 2, name: '本物 はなこ', gender: 'f' }] });
  School.classes.setCurrent('real-1');
  await Kit.store.put('reminders', { id: 'real-rm', title: '本物のリマインダー', date: Kit.ymd() });
  await Kit.store.flush();
  return 1;
})()`;
const SNAP = `(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith('sensei:')) o[k] = localStorage.getItem(k); } return JSON.stringify(o); })()`;
const STATE = `(() => { const r = Kit.demo.running(); if (!r) return null; const c = document.querySelector('.tour-card'); const b = c && c.querySelector('.tour-btn.primary'); return Object.assign(r, { card: c ? (c.querySelector('.tour-title') || {}).textContent : '', can: !!(b && !b.disabled), note: !!(c && c.querySelector('.tour-note')) }); })()`;

async function runOne(engine, sizeName, tourIds) {
  const { launch } = require(path.join(LIB, engine === 'webkit' ? 'wk.cjs' : 'cdp.cjs'));
  const sz = SIZES[sizeName];
  const b = await launch({ width: sz.width, height: sz.height, maxMs: 15 * 60 * 1000 });
  const out = [];
  try {
    const p = await b.page(url);
    if (engine === 'chrome' && sz.mobile) await p.send('Emulation.setDeviceMetricsOverride', { width: sz.width, height: sz.height, deviceScaleFactor: 2, mobile: true });
    await p.wait('window.Kit && Kit.current && Kit.current() === "home"', 15000);
    dbg('開いた'); await p.eval(SEED); dbg('本物のデータを入れた');
    // WebKit の道具は「1つの式」しか受け付けない（文を並べると返事が来ない）。どの eval も式1つで書く
    await p.eval('(location.hash = "#home", 1)');
    await sleep(400);
    const before = await p.eval(SNAP);
    const list = tourIds.length ? tourIds : await p.eval('JSON.stringify(Kit.apps().map((a) => a.id).filter((id) => Kit.demo.has(id)))').then(JSON.parse);
    for (const id of list) {
      const r = { engine, size: sizeName, id, steps: 0, n: 0, missing: [], errors: [], dataSame: false, backToReal: false, ms: 0 };
      const t0 = Date.now();
      const errBefore = p.errors().length;
      try {
        await p.eval(`(Kit.demo.speed = 0.25, location.hash = '#${id}', 1)`);
        await p.wait(`Kit.current() === '${id}'`, 8000);
        await sleep(300);
        // 見出しの「使い方を見る」を、本物のクリックで押す
        dbg(id, '使い方を見る'); await p.clickEl('.app-head .demo-btn');
        await p.wait(`Kit.demo.running() && Kit.demo.running().id === '${id}'`, 8000);
        for (let guard = 0; guard < 60; guard++) {
          let st = null;
          const tw = Date.now();
          for (;;) {
            st = await p.eval(STATE);
            if (st && st.ready && st.can && (st.done || st.card === st.title)) break;
            if (Date.now() - tw > 20000) throw new Error('手順 ' + (st ? st.i + 1 : '?') + ' から進みません（' + JSON.stringify(st) + '）');
            await sleep(120);
          }
          if (st.done) break;
          r.n = st.n; r.steps = st.i + 1; dbg(id, '手順', st.i + 1, st.title);
          if (!st.found || st.note) r.missing.push((st.i + 1) + '「' + st.title + '」');
          if (shotsDir) { const dir = path.join(shotsDir, engine + '-' + sizeName); fs.mkdirSync(dir, { recursive: true }); await p.shot(path.join(dir, id + '-' + String(st.i + 1).padStart(2, '0') + '.png')); }
          await p.clickEl('.tour-card .tour-btn.primary');
          await sleep(150);
        }
        if (shotsDir) { const dir = path.join(shotsDir, engine + '-' + sizeName); await p.shot(path.join(dir, id + '-99-end.png')); }
        // 最後のカードの「デモを終わる」
        dbg(id, 'デモを終わる'); await p.clickEl('.tour-card .tour-btn.primary');
        await p.wait('!Kit.store.demo && !document.documentElement.classList.contains("is-demo")', 8000);
        await sleep(500);
        const after = await p.eval(SNAP);
        r.dataSame = before === after;
        if (!r.dataSame) {
          const a = JSON.parse(before), z = JSON.parse(after);
          r.diff = [...new Set(Object.keys(a).concat(Object.keys(z)))].filter((k) => a[k] !== z[k]);
        }
        r.backToReal = await p.eval(`School.classes.current().then((c) => !!c && c.id === 'real-1')`);
      } catch (e) {
        r.errors.push(e.message.slice(0, 300));
        try { await p.eval('Kit.demo.end().then(() => 1)'); } catch (e2) { /* noop */ }
      }
      for (const l of p.errors().slice(errBefore)) r.errors.push(l.text.slice(0, 300));
      r.ms = Date.now() - t0;
      out.push(r);
      const ok = !r.errors.length && r.dataSame && r.backToReal && !r.missing.length;
      console.log(`${ok ? '○' : '×'} ${engine.padEnd(6)} ${sizeName.padEnd(5)} ${id.padEnd(11)} 手順 ${r.steps}/${r.n}  ${(r.ms / 1000).toFixed(1)}秒` +
        (r.missing.length ? `  見つからない：${r.missing.join('・')}` : '') + (r.dataSame ? '' : `  本物のデータが変わった：${(r.diff || []).join(',')}`) +
        (r.backToReal ? '' : '  本物のクラスに戻っていない') + (r.errors.length ? `  エラー：${r.errors.join(' / ')}` : ''));
    }
  } finally { await b.close(); }
  return out;
}

(async () => {
  const all = [];
  for (const engine of ENGINES) for (const s of sizes) all.push(...await runOne(engine, s, ids));
  const bad = all.filter((r) => r.errors.length || !r.dataSame || !r.backToReal || r.missing.length);
  console.log(`\n${all.length - bad.length}/${all.length} 合格`);
  process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });

#!/usr/bin/env node
/* 簡易版（lite/index.html：席替え・チラシ・画像生成プロンプト）の確かめ。Chrome と WebKit（Safari と同じエンジン）× パソコン・スマホ。
   メニューに3つ（と、席替えの付き物の名簿）だけが出る／見出しが「簡易版」／ホームのカード／3つが動く／ほかの道具の名前が出ない／エラーなし。
   使い方：node tools/lite-check.cjs [出力フォルダ]   （手元の Mac では CHROME=… を渡す。画面は出力フォルダに保存）
   使い方のデモ（席替え・名簿・チラシ）の通しは、別に： node tools/demo-check.cjs --html lite/index.html */
const path = require('path'), os = require('os'), fs = require('fs');
const LIB = path.join(os.homedir(), '.claude/skills/shiage/scripts/lib');
const site = 'file://' + path.resolve(__dirname, '..', 'lite', 'index.html');
const out = process.argv[2] || path.join(os.tmpdir(), 'lite-shots');
fs.mkdirSync(out, { recursive: true });
let okN = 0, ngN = 0;
const t = (c, m, d) => { if (c) { okN++; console.log('  OK  ' + m); } else { ngN++; console.log('  NG  ' + m + (d ? '：' + d : '')); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const REST = ['係決め', '当番表', '時間割', 'カレンダー', 'リマインダー', '宿題', '学級通信', '連絡テンプレート', 'ルーレット', '指導案', '成績', '面談', '動画編集', '生徒指導'];

(async () => {
  for (const engine of ['chrome', 'webkit']) {
    const { launch } = require(path.join(LIB, engine === 'webkit' ? 'wk.cjs' : 'cdp.cjs'));
    for (const [w, hgt, label] of [[1366, 860, 'pc'], [390, 800, 'phone']]) {
      console.log('── ' + engine + ' ' + label);
      const b = await launch({ width: w, height: hgt, maxMs: 240000 });
      try {
        const p = await b.page(site + '#home');
        await p.wait(`!!(window.Kit && Kit.current && Kit.current() === 'home' && document.querySelector('.hl-tools'))`, 20000);
        const ids = (await p.eval(`JSON.stringify(Kit.apps().map((a) => a.id).sort())`));
        t(ids === JSON.stringify(['flyer', 'home', 'image-prompt', 'roster', 'seats']), 'メニューは 席替え・チラシ・画像生成プロンプト（と、席替えの付き物の名簿・ホーム）だけ', ids);
        const brand = await p.eval(`JSON.stringify({ sub: (document.querySelector('.kokuban-sub') || {}).textContent, top: (document.querySelector('.mb-top-brand') || {}).textContent, title: document.title })`).then(JSON.parse);
        t(brand.title === '先生の道具箱 簡易版' && /簡易版/.test(brand.top) && (label === 'phone' || brand.sub === '簡易版'), '見出しが「簡易版」になっている', JSON.stringify(brand));
        const home = await p.eval(`JSON.stringify({ cards: [...document.querySelectorAll('.hl-title')].map((e) => e.textContent), demos: document.querySelectorAll('.hl-wrap .demo-btn').length, full: (document.querySelector('.hl-full a') || {}).getAttribute && document.querySelector('.hl-full a').getAttribute('href'), over: document.documentElement.scrollWidth > innerWidth + 1, text: (() => { const c = document.querySelector('.mb-main').cloneNode(true); c.querySelectorAll('[aria-label="フル版"]').forEach((e) => e.remove()); return c.innerText; })() })`).then(JSON.parse);
        t(home.cards.join('|') === '席替え|チラシ|画像生成プロンプト' && home.demos === 2, 'ホームに3つのカード（席替え・チラシに「使い方を見る」）', JSON.stringify(home.cards) + ' デモ' + home.demos);
        t(home.full === '../' && !home.over, 'フル版へのリンクがある・横にはみ出さない', home.full);
        const leaked = REST.filter((x) => home.text.includes(x));
        t(leaked.length === 0, 'ホームに、入っていない道具の名前が出ない（フル版の案内の所だけ別）', leaked.join('・'));
        // 表示：最初は明るい（端末が暗い表示でも）。ボタンで 暗い → 自動 → 明るい と切りかわる
        const bg = await p.eval(`getComputedStyle(document.body).backgroundColor`);
        t(await p.eval(`document.documentElement.dataset.theme`) === 'light' && /^rgb\((2[0-9]{2}|1[5-9][0-9]),/.test(bg), '最初は明るい表示（端末が暗い表示でも暗くしない）', bg);
        await p.shot(path.join(out, engine + '-' + label + '-home.png'));
        const cyc = [];
        for (let i = 0; i < 3; i++) { await p.eval(`(document.querySelector('.mb-theme').click(), 1)`); cyc.push(await p.eval(`(document.documentElement.dataset.theme || 'auto') + '/' + (localStorage.getItem('sensei:theme') || '-')`)); }
        t(cyc.join(' ') === 'dark/dark auto/auto light/-', '表示ボタンで 暗い → 自動 → 明るい と切りかわり、選んだものを覚える', cyc.join(' '));

        // 名簿（席替えの付き物）：説明から「係・当番・宿題」が消えている
        await p.eval(`(Kit.go('roster'), 1)`); await sleep(900);
        const ro = await p.eval(`document.querySelector('.mb-main').innerText`);
        t(/席替えで使えます/.test(ro) && !/係|当番|宿題/.test(ro), '名簿の説明が「席替えで使えます」（係・当番・宿題の名前が出ない）', ro.slice(0, 80).replace(/\s+/g, ' '));

        // 席替え：架空のクラスで「席替えする」→ 席が決まる
        await p.eval(`(Kit.go('seats'), 1)`); await p.wait(`!!document.querySelector('.st-wrap')`, 10000);
        await p.clickText('.app-head button', '席替えする'); await sleep(1500);
        const seated = await p.eval(`document.querySelectorAll('.st-seat, .st-desk, [data-k]').length`);
        t(seated >= 20, '席替え：架空のクラスで「席替えする」と席が決まる', '席 ' + seated);
        await p.shot(path.join(out, engine + '-' + label + '-seats.png'));

        // チラシ：テンプレートを開く。「カレンダーの予定から入れる」は出ない
        await p.eval(`(Kit.go('flyer'), 1)`); await p.wait(`!!document.querySelector('.fl-tpl')`, 10000);
        await p.eval(`(document.querySelector('.fl-tpl-go').click(), 1)`); await p.wait(`!!document.querySelector('.fl-edit')`, 8000);
        const fl = await p.eval(`document.querySelector('.mb-main').innerText`);
        t(/日時・場所/.test(fl) && !/カレンダー/.test(fl), 'チラシ：テンプレートを開いて書きかえられる（カレンダーの文字が出ない）');
        await p.shot(path.join(out, engine + '-' + label + '-flyer.png'));

        // 画像生成プロンプト：中のページが開く
        await p.eval(`(Kit.go('image-prompt'), 1)`);
        let title = '';
        for (let i = 0; i < 30 && !/プロンプト処方箋/.test(title); i++) { await sleep(500); title = await p.eval(`(() => { try { const f = document.querySelector('.bt-frame'); return (f && f.contentDocument && f.contentDocument.title) || ''; } catch (e) { return ''; } })()`); }
        const fr = await p.eval(`(() => { const f = document.querySelector('.bt-frame'); return f ? f.getAttribute('src') : ''; })()`);
        t(/gazou-prompt/.test(fr), '画像生成プロンプト：画面の中に開く', fr);

        // ほかの道具の入口は開かない（URL を直接打っても、ホームに戻る）
        await p.eval(`(location.hash = '#roles', 1)`); await sleep(700);
        t(await p.eval(`Kit.current() !== 'roles'`), '入っていない道具（係決め）の URL を打っても開かない', await p.eval('Kit.current()'));

        const errs = p.errors().filter((l) => !/Failed to load resource|favicon|ERR_|net::/.test(l.text));
        t(errs.length === 0, 'コンソールにエラーがない', errs.map((e) => e.text.slice(0, 140)).join(' / '));
      } finally { await b.close(); }
    }
  }
  console.log(`\n${okN} 件 OK・${ngN} 件 NG`);
  process.exit(ngN ? 1 : 0);
})().catch((e) => { console.error('止まりました：' + e.message); process.exit(1); });

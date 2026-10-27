#!/usr/bin/env node
/* 「中で開く道具」（js/apps/embeds.js）の確かめ：メニューとホームのカード・画面の中に開く行き先・見た目。Chrome と WebKit × パソコン・スマホ。
   指導案・画像生成プロンプト・成績（β）・面談（β）が出る／動画編集（β）は会員だけ（ログインなしでは出ない）／別のページで開く「かんたん成績」は消えている。
   使い方：node tools/embed-check.cjs [画面の保存先]   （手元の Mac では CHROME=… を渡す。行き先のページは、公開中のものを iframe で読む） */
const path = require('path'), os = require('os'), fs = require('fs');
const LIB = path.join(os.homedir(), '.claude/skills/shiage/scripts/lib');
const site = 'file://' + path.resolve(__dirname, '..', 'index.html');
const out = process.argv[2] || path.join(os.tmpdir(), 'embed-shots');
fs.mkdirSync(out, { recursive: true });
let okN = 0, ngN = 0;
const t = (c, m, d) => { if (c) { okN++; console.log('  OK  ' + m); } else { ngN++; console.log('  NG  ' + m + (d ? '：' + d : '')); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  for (const engine of ['chrome', 'webkit']) {
    const { launch } = require(path.join(LIB, engine === 'webkit' ? 'wk.cjs' : 'cdp.cjs'));
    for (const [w, hgt] of [[1366, 860], [390, 800]]) {
      console.log('── ' + engine + ' ' + w);
      const b = await launch({ width: w, height: hgt, maxMs: 180000 });
      try {
        const p = await b.page(site + '#home');
        await p.wait(`!!(window.Kit && Kit.current && Kit.current() === 'home' && document.querySelector('.hm-tools'))`, 20000);
        const nav = await p.eval(`JSON.stringify(Kit.visibleApps().map((a) => a.id + ':' + a.group))`);
        t(['lesson-plan:lesson', 'image-prompt:write', 'beta-grades:beta', 'beta-mendan:beta'].every((x) => nav.includes(x)) && !nav.includes('beta-video'), 'メニューに 指導案（授業）・画像生成プロンプト（通信・連絡）・成績と面談（β）が出る。動画編集は出ない', nav);
        const cards = await p.eval(`[...document.querySelectorAll('.hm-tool-title')].map((e) => e.textContent).join('|')`);
        t(/指導案/.test(cards) && /画像生成プロンプト/.test(cards) && /成績（β）/.test(cards) && !/かんたん成績/.test(cards), 'ホームのカードにも出る（別のページで開く「かんたん成績」は消えた）', cards);
        const label = await p.eval(`[...document.querySelectorAll('.hm-group-label')].map((e) => e.textContent).join('|')`);
        t(label.includes('β版（試しの段階）') && !label.includes('会員限定'), 'β版の見出しは「試しの段階」（会員限定と書かない）', label);
        for (const [id, host] of [['lesson-plan', 'shidoan-sakusei'], ['image-prompt', 'gazou-prompt'], ['beta-grades', 'kantan-seiseki'], ['beta-mendan', 'mendan-scheduler']]) {
          await p.eval(`(Kit.go(${JSON.stringify(id)}), 1)`); await sleep(1200);
          const r = await p.eval(`(() => { const f = document.querySelector('.bt-frame'); const bar = document.querySelector('.bt-bar'); return JSON.stringify({ src: f && f.getAttribute('src'), h: f ? Math.round(f.getBoundingClientRect().height) : 0, w: f ? Math.round(f.getBoundingClientRect().width) : 0, chip: !!(bar && bar.querySelector('.bt-chip')), over: document.documentElement.scrollWidth > innerWidth + 1 }); })()`).then(JSON.parse);
          t(r.src && r.src.includes(host) && r.h >= 400 && r.w >= w * 0.6 && !r.over && r.chip === id.startsWith('beta-'), id + '：画面の中に開く（' + r.w + '×' + r.h + '、β の札 ' + (r.chip ? 'あり' : 'なし') + '、横にはみ出さない）', JSON.stringify(r));
          if (id === 'lesson-plan' || id === 'beta-grades') { await sleep(2500); await p.shot(path.join(out, engine + '-' + w + '-' + id + '.png')); }
        }
        await p.eval(`(Kit.go('beta-video'), 1)`); await sleep(600);
        t(await p.eval(`!!document.querySelector('.bt-gate')`), '動画編集（β）を直接開くと、会員の案内だけ');
        const errs = p.errors().filter((l) => !/Failed to load resource|favicon/.test(l.text));
        t(errs.length === 0, 'コンソールにエラーがない', errs.map((e) => e.text.slice(0, 140)).join(' / '));
      } finally { await b.close(); }
    }
  }
  console.log(`\n${okN} 件 OK・${ngN} 件 NG`);
  process.exit(ngN ? 1 : 0);
})().catch((e) => { console.error('止まりました：' + e.message); process.exit(1); });

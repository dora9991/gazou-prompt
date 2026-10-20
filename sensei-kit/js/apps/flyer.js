// チラシ：学習会・行事・募集のお知らせを、テンプレートからさっと作って印刷する
// テンプレート・日付・見出しの大きさ・あふれの判定は js/core/flyer-templates.js（Node でも動く。tools/test-flyer.cjs で確かめる）
// 流れ：テンプレートを選ぶ → 紙面を見ながら文字を書きかえる → 雰囲気・色・紙を選ぶ → 印刷。書いたものは 'flyers' に保存して一覧から開ける
(function () {
  'use strict';
  const { h } = Kit;
  const FT = window.FlyerTemplates;
  if (!FT) return;                      // index.html に js/core/flyer-templates.js の行がないとき（この道具は出さない。ほかの道具は止めない）
  const sv = Kit.svg;
  const MM = 96 / 25.4;                 // 1mm の画面の大きさ（px）
  const PT = 72 / 25.4;                 // 1mm は何 pt
  const STYLE_IDS = new Set(FT.STYLES.map((s) => s.id));
  const STYLE_LABEL = Object.fromEntries(FT.STYLES.map((s) => [s.id, s.label]));
  const HEADK = { clean: 1, pop: 0.94, wa: 0.9, board: 0.94, news: 1 };     // 雰囲気ごとの見出しの大きさ（字体の太さ・幅に合わせる）
  const HEADLS = { clean: 0.03, pop: 0.03, wa: 0.08, board: 0.03, news: 0.02 };
  const IB_HEAD = { wa: '記', news: 'ご案内' };
  const LI = /^([・●○◎■□◆◇※＊*\-－]|[①-⑳]|[0-9０-９]+[.)．）])/;   // 箇条書きの行（字下げしない・ぶら下げる）
  const paperOf = (f) => FT.PAPERS[f.paper] || FT.PAPERS.a4;
  const styleOf = (f) => (STYLE_IDS.has(f.style) ? f.style : 'clean');
  const lines = (s) => String(s || '').replace(/\s+$/, '').split('\n');
  const one = (s) => String(s || '').replace(/\s*\n\s*/g, '').trim();
  const titleOf = (f) => one(f.head) || one(f.kicker) || 'チラシ';

  // 読みこんだチラシの形をそろえる（足りない項目は空、テンプレートの項目名を下じきに）
  function norm(x) {
    const o = Object.assign({}, x || {});
    const t = FT.get(o.tpl) || FT.TEMPLATES[0];
    o.tpl = t.id;
    if (!STYLE_IDS.has(o.style)) o.style = t.style;
    if (!FT.PALETTES.some((p) => p.id === o.palette)) o.palette = t.palette;
    if (!FT.PAPERS[o.paper]) o.paper = 'a4';
    if (o.motif == null) o.motif = t.motif; else if (o.motif && !FT.MOTIFS[o.motif]) o.motif = '';
    for (const k of FT.TEXT_KEYS) if (o[k] == null) o[k] = '';
    for (const k of ['date', 'endDate', 'start', 'end', 'deadline', 'qr', 'photo', 'photoCap']) if (o[k] == null) o[k] = '';
    o.start = FT.hhmm(o.start); o.end = FT.hhmm(o.end);
    o.labels = Object.assign({}, FT.LABELS, t.labels, o.labels || {});
    return o;
  }
  async function ctxNow() {
    const p = await Kit.profile.get();
    const c = await School.classes.current();
    return { today: Kit.ymd(), school: p.school, teacher: p.teacher, cls: c ? c.name : '', isOff: School.isOff };
  }

  // サンプル（架空の学校）：テスト前の学習会
  Kit.store.sample('flyers', [Object.assign(FT.make('study-test', { today: Kit.ymd(), school: Kit.PROFILE_SAMPLE.school, teacher: Kit.PROFILE_SAMPLE.teacher, cls: School.SAMPLE_CLASS.name, isOff: School.isOff }), { id: 's-fl-1' })]);

  /* ───────── QRコード・写真（作ったものは覚えておく） ───────── */
  const qrCache = new Map();
  function qrOf(text) {
    const t = String(text || '').trim();
    if (!t) return { url: '', err: '' };
    if (qrCache.has(t)) return qrCache.get(t);
    let r;
    try {
      if (t.length > 900) throw new Error('long');
      r = { url: Kit.qr(t, { cell: 8, margin: 2, level: 'M' }).toDataURL('image/png'), err: '' };
    } catch (e) { r = { url: '', err: 'この長さでは QRコードにできません。短い URL にしてください。' }; }
    qrCache.set(t, r);
    return r;
  }
  const imgCache = new Map();
  async function photoOf(ref) {
    if (!ref) return '';
    if (imgCache.has(ref)) return imgCache.get(ref);
    let u = '';
    try { u = await Kit.img.resolve(ref); } catch (e) { u = ''; }
    imgCache.set(ref, u || '');
    return u || '';
  }

  /* ───────── 紙面（画面の見た目と印刷で同じものを使う） ───────── */
  function motifSvg(id) {
    const m = FT.MOTIFS[id];
    if (!m) return null;
    const svg = sv('svg', { viewBox: '0 0 100 100', 'aria-hidden': 'true', focusable: 'false' });
    const g = m.k ? sv('g', { transform: 'scale(' + m.k + ')' }) : svg;
    for (const s of m.shapes) {
      const p = sv('path', { d: s.d, class: 'mo-s mo-' + s.f });
      if (m.k) p.style.strokeWidth = (3.2 / m.k).toFixed(2);
      g.append(p);
    }
    if (m.k) svg.append(g);
    return svg;
  }
  // 和風の帯（七宝つなぎ）
  function waveSvg() {
    const id = Kit.uid('flp');
    const pat = sv('pattern', { id, width: 16, height: 16, patternUnits: 'userSpaceOnUse' });
    for (const [x, y] of [[0, 0], [16, 0], [0, 16], [16, 16], [8, 8]]) pat.append(sv('circle', { cx: x, cy: y, r: 8, class: 'fl-wv' }));
    return sv('svg', { class: 'fl-wave', 'aria-hidden': 'true' }, sv('defs', null, pat),
      sv('rect', { width: '100%', height: '100%', class: 'fl-wv-bg' }), sv('rect', { width: '100%', height: '100%', fill: 'url(#' + id + ')' }));
  }

  function pageEl(f, o = {}) {
    const P = paperOf(f), st = styleOf(f), pal = FT.palette(f.palette), M = FT.MARGIN;
    const txt = (s) => String(s || '').trim();
    const df = (k, cls) => ({ class: cls, 'data-f': k });
    const hasMotif = !!(f.motif && FT.MOTIFS[f.motif]);
    const page = h('div', { class: 'fl-page fl-s-' + st + (P.land ? ' fl-land' : ' fl-port') + (hasMotif ? ' has-motif' : '') });
    page.style.width = P.w - 2 * M + 'mm';
    page.style.height = P.h - 2 * M - (o.print ? 0.4 : 0) + 'mm';   // 印刷では、ほんの少し低く（2枚目に白い紙が出ないように）
    for (const [k, v] of [['--fm', pal.main], ['--fw', pal.wash], ['--fa', pal.accent], ['--fl', pal.light], ['--fb', P.base + 'pt'], ['--fk', '1'], ['--fph', P.photoH + 'mm'], ['--mw', (P.land || f.paper === 'b5' ? 30 : 34) + 'mm']]) page.style.setProperty(k, v);

    if (st === 'clean') page.append(h('div', { class: 'fl-band', 'aria-hidden': 'true' }));
    if (st === 'wa') page.append(h('div', { class: 'fl-frame', 'aria-hidden': 'true' }));

    // 見出し
    const hx = h('div', { class: 'fl-hx' },
      st !== 'news' && txt(f.kicker) ? h('div', df('kicker', 'fl-kicker'), txt(f.kicker)) : null,
      txt(f.head) ? h('h1', df('head', 'fl-head'), lines(f.head).map((l) => l.trim()).filter(Boolean).join('\n')) : null,
      txt(f.sub) ? h('p', df('sub', 'fl-sub'), txt(f.sub)) : null);
    const mast = st === 'news' ? h('div', { class: 'fl-mast' }, h('div', df('kicker', 'fl-mast-t'), txt(f.kicker) || 'お知らせ'), txt(f.org) ? h('div', df('org', 'fl-mast-o'), txt(f.org)) : null) : null;
    const hd = h('header', { class: 'fl-hd' }, mast, st === 'wa' ? waveSvg() : null, hx,
      hasMotif && st !== 'wa' ? h('div', df('motif', 'fl-motif'), motifSvg(f.motif)) : null,
      st === 'board' ? [h('i', { class: 'fl-mag l', 'aria-hidden': 'true' }), h('i', { class: 'fl-mag r', 'aria-hidden': 'true' }), h('span', { class: 'fl-chalk', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'))] : null);

    // 本文・写真・日時などの表
    const photo = o.photo ? h('figure', df('photo', 'fl-photo'), h('img', { src: o.photo, alt: txt(f.photoCap) }), txt(f.photoCap) ? h('figcaption', null, txt(f.photoCap)) : null) : null;
    const body = txt(f.body) ? h('div', df('body', 'fl-body'), lines(f.body).map((t) => (t.trim() ? h('p', { class: LI.test(t.trim()) ? 'li' : null }, t.trim()) : h('p', { class: 'gap' })))) : null;
    const rows = FT.rows(f), b = FT.badge(f);
    const info = rows.length ? h('dl', { class: 'fl-info' }, rows.map((r) => h('div', df(r.key === 'when' ? 'date' : r.key, 'fl-r fl-r-' + r.key),
      h('dt', null, r.label),
      h('dd', null, r.key === 'when' ? [r.date ? h('span', { class: 'fl-date' }, r.date) : null, r.time ? h('span', { class: 'fl-time' }, r.time) : null, r.note ? h('span', { class: 'fl-wnote' }, r.note) : null] : r.value)))) : null;
    const badge = b ? h('div', df('date', 'fl-badge'), h('b', null, b.md), h('span', { class: 'fl-bd-w' }, '（' + b.wd + '）'), b.sub ? h('span', { class: 'fl-bd-s' }, b.sub) : null) : null;
    const ib = info || badge ? h('section', { class: 'fl-ib' }, IB_HEAD[st] ? h('div', { class: 'fl-ib-h' }, IB_HEAD[st]) : null, h('div', { class: 'fl-ib-in' + (badge && info ? ' has-badge' : '') }, badge, info)) : null;
    const main = h('div', { class: 'fl-main' }, photo || body ? h('div', { class: 'fl-col fl-col-a' + (photo && body ? ' has-photo' : '') }, photo, body) : null, ib ? h('div', { class: 'fl-col fl-col-b' }, ib) : null);

    // 問い合わせ・QRコード
    const contact = lines(f.contact).map((l) => l.trim()).filter(Boolean).join('\n');
    const ftx = h('div', { class: 'fl-ftx' },
      contact ? h('div', df('contact', 'fl-contact'), h('b', null, '問い合わせ'), h('span', null, contact)) : null,
      st !== 'news' && txt(f.org) && !contact.includes(txt(f.org)) ? h('div', df('org', 'fl-org'), txt(f.org)) : null);   // 問い合わせに同じ名前があれば、くり返さない
    const qr = o.qr ? h('div', df('qr', 'fl-qr'), h('img', { src: o.qr, alt: 'QRコード' + (txt(f.qrLabel) ? '（' + txt(f.qrLabel) + '）' : '') }), txt(f.qrLabel) ? h('span', null, txt(f.qrLabel)) : null) : null;
    const mo = hasMotif && st === 'wa' ? h('div', df('motif', 'fl-motif'), motifSvg(f.motif)) : null;   // 和風は、絵を下のすみに
    const ft = ftx.childNodes.length || qr || mo ? h('footer', { class: 'fl-ft' + (qr ? ' has-qr' : '') + (mo ? ' has-mo' : '') }, mo, ftx, qr) : null;
    page.append(hd, main, ft);
    return page;
  }

  // 紙に合わせる：見出しは幅に入るいちばん大きい大きさ、本文は紙に入るいちばん大きい倍率（入らなければ知らせる）
  function fitPage(page, f) {
    const H = page.clientHeight;
    if (!H) return null;
    const P = paperOf(f), st = styleOf(f), head = page.querySelector('.fl-head');
    let wPt = 0;
    if (head) { const cs = getComputedStyle(head); wPt = (head.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0)) * 0.75; }
    let hs = null;
    const at = (k) => {
      page.style.setProperty('--fk', String(k));
      if (head) {
        hs = FT.headFit(f.head, wPt, { maxPt: P.headMax * HEADK[st] * Math.min(1, 0.55 + 0.45 * k), minPt: 18, maxHeightPt: P.headH * PT, ls: HEADLS[st], join: !!P.land });
        head.style.fontSize = hs.pt + 'pt';
        if (head.textContent !== hs.text) head.textContent = hs.text;
      }
      page.classList.add('is-measure');
      const n = page.offsetHeight;
      page.classList.remove('is-measure');
      return n / H;
    };
    const r = FT.chooseScale(at);
    at(r.k);
    r.head = hs;
    return r;
  }
  function applyFit(page, r) {
    if (!r) return;
    page.style.setProperty('--fk', String(r.k));
    const head = page.querySelector('.fl-head');
    if (head && r.head) { head.style.fontSize = r.head.pt + 'pt'; head.textContent = r.head.text; }
  }

  Kit.css('flyer-fonts', `@import url("https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@500;700&family=Zen+Old+Mincho:wght@400;700;900&display=swap");`);
  Kit.css('flyer', `
.fl-steps{margin-bottom:14px}
.fl-steps .sk-step:disabled{opacity:.5;cursor:default}
.fl-steps .sk-step:disabled:hover{border-color:var(--line)}
.fl-h2{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 10px;font-size:16px;font-weight:700;margin:4px 0 10px}
.fl-h2 .small{font-weight:400}
.fl-cards{display:grid;gap:10px;grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr));margin-bottom:24px}
.fl-card{display:grid;grid-template-columns:84px minmax(0,1fr);gap:12px;align-items:start;padding:10px;border:1px solid var(--line);border-radius:var(--r);background:var(--surface)}
.fl-card-th{cursor:pointer}
.fl-card-tx{display:grid;gap:3px;min-width:0}
.fl-card-t{font-size:15px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fl-card-d{font-size:12.5px;color:var(--ink-3)}
.fl-card .btn-row{margin-top:6px;gap:4px}
.fl-cats{margin:0 0 12px}
.fl-tpls{display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(min(100%,164px),1fr))}
.fl-tpl{position:relative;display:grid;gap:8px;align-content:start;padding:8px 8px 10px;border:1px solid var(--line);border-radius:var(--r);background:var(--surface);transition:border-color .15s,transform .15s,box-shadow .15s}
.fl-tpl:hover{border-color:var(--gosu);transform:translateY(-2px);box-shadow:var(--shadow-2)}
.fl-tpl:focus-within{border-color:var(--gosu);box-shadow:0 0 0 2px var(--focus)}
.fl-tpl-go{display:grid;gap:2px;padding:0 4px;border:0;background:transparent;color:var(--ink);font:inherit;text-align:left;cursor:pointer}
.fl-tpl-go::after{content:'';position:absolute;inset:0;border-radius:inherit}
.fl-tpl-go:focus-visible{outline:none}
.fl-tpl-go b{font-size:14.5px;line-height:1.35}
.fl-tpl-d{font-size:12px;color:var(--ink-3);line-height:1.45}
.fl-tpl-tag{display:inline-block;margin-right:6px;padding:0 7px;border-radius:99px;background:var(--surface-2);color:var(--ink-2);font-size:11.5px;font-weight:700;line-height:1.6}
.fl-th{position:relative;overflow:hidden;border-radius:6px;background:var(--surface-2);border:1px solid var(--line)}
.fl-th>.fl-sheet{position:absolute;top:0;left:0;transform-origin:0 0}
.fl-sheet{background:#fff;box-sizing:border-box}
.fl-bar{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;margin-bottom:12px}
.fl-bar-t{font-size:16px;margin-right:auto;min-width:0;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fl-st-s{display:none}
@media (max-width:640px){.fl-steps{flex-wrap:nowrap}.fl-steps .sk-step{padding-right:10px;font-size:13.5px;flex:0 1 auto;min-width:0}.fl-st-l{display:none}.fl-st-s{display:inline}}
.fl-edit{display:grid;gap:16px;grid-template-columns:minmax(0,1fr)}
@media (min-width:1100px){.fl-edit{grid-template-columns:minmax(0,1fr) minmax(380px,.95fr);align-items:start}.fl-edit>.fl-design{grid-column:1/-1;display:flex;flex-wrap:wrap;align-items:center;gap:10px 28px;padding:12px 16px}.fl-side{position:sticky;top:12px}}
@media (max-width:1099px){.fl-edit[data-pane="write"] .fl-side,.fl-edit[data-pane="write"] .fl-design,.fl-edit[data-pane="look"] .fl-ed{display:none}}
.fl-ed{display:grid;gap:14px;min-width:0}
.fl-side{display:grid;gap:10px;min-width:0}
.fl-sec{display:grid;gap:10px}
.fl-sec-h{display:flex;flex-wrap:wrap;align-items:baseline;gap:2px 10px}
.fl-sec-h h2{font-size:15px;font-weight:700}
.fl-sec-when{border-color:color-mix(in srgb,var(--gosu) 45%,var(--line));box-shadow:inset 4px 0 0 var(--gosu)}
.fl-g2{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(min(100%,160px),1fr))}
.fl-tbl{display:grid;gap:6px}
.fl-tr{display:grid;grid-template-columns:7.5em minmax(0,1fr);gap:6px;align-items:start}
.fl-tr.fl-thr{font-size:12px;color:var(--ink-3);font-weight:700}
.fl-tr>input:first-child{font-weight:700}
.fl-apply{display:grid;gap:6px;min-width:0}
.fl-dl{display:flex;align-items:center;gap:6px;min-width:0}
.fl-dl input{flex:1 1 auto;min-width:0;width:auto}
@media (max-width:480px){.fl-tr{grid-template-columns:6.2em minmax(0,1fr)}}
.fl-more summary{display:flex;align-items:center;gap:4px;min-height:36px;cursor:pointer;font-size:13px;color:var(--ink-2)}
.fl-more[open] summary{margin-bottom:8px}
.fl-motifs{display:grid;gap:6px;grid-template-columns:repeat(auto-fill,minmax(52px,1fr))}
.fl-motifs button{display:grid;place-items:center;height:52px;border-radius:8px;border:1.5px solid var(--line);background:#fff;color:#444;cursor:pointer;padding:4px;font:inherit;font-size:12px}
.fl-motifs button[aria-pressed="true"]{border-color:var(--gosu);box-shadow:0 0 0 3px var(--gosu-wash)}
.fl-motifs svg{width:36px;height:36px;overflow:visible}
.fl-photo-row{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-start}
.fl-pthumb{width:120px;min-height:80px;border-radius:8px;border:1px solid var(--line);background:var(--surface-2);display:grid;place-items:center;overflow:hidden}
.fl-pthumb img{display:block;width:100%;height:auto}
.fl-design{display:grid;gap:10px}
.fl-opt{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px}
.fl-bw,.fl-chk{min-height:36px}
.fl-opt>.fl-opt-l{font-size:13px;color:var(--ink-2);min-width:3.5em;font-weight:700}
.fl-pal{display:flex;flex-wrap:wrap;gap:6px}
.fl-pal button{width:36px;height:36px;padding:0;border-radius:50%;border:2px solid var(--surface);box-shadow:0 0 0 1px var(--line-strong);background:linear-gradient(135deg,var(--sw-m) 0 56%,var(--sw-a) 56% 74%,var(--sw-w) 74%);cursor:pointer;transition:transform .12s}
.fl-pal button:hover{transform:scale(1.08)}
.fl-pal button[aria-pressed="true"]{box-shadow:0 0 0 2px var(--gosu),0 0 0 4px var(--gosu-wash)}
.fl-pal-n{font-size:13px}
.fl-pv{position:relative;overflow:hidden;border-radius:6px;background:var(--surface-2);border:1px solid var(--line);cursor:pointer}
.fl-pv>.fl-th{border:0;border-radius:0;background:transparent}
.fl-pv .fl-sheet{box-shadow:0 1px 6px rgba(0,0,0,.18)}
.fl-pv.is-bw .fl-sheet{filter:grayscale(1)}
.fl-pv [data-f]:hover{outline:1mm dashed rgba(38,128,95,.7);outline-offset:.8mm}
.fl-pv.is-over::after{content:'ここから下が切れます';position:absolute;left:0;right:0;bottom:0;padding:4px 8px;background:var(--bad);color:#fff;font-size:12px;font-weight:700;text-align:center}
.fl-status{margin:0;min-height:1.6em;line-height:1.5}
.fl-status.ok{color:var(--ok)}
.fl-status.warn{color:var(--warn)}
.fl-status.bad{color:var(--bad);font-weight:700}
.fl-qrmsg{font-size:12.5px;color:var(--bad);margin:0}
.fl-evs{display:flex;flex-direction:column;gap:6px;max-height:min(50vh,420px);overflow:auto;padding:2px}
.fl-ev{flex:none;display:grid;grid-template-columns:5.6em minmax(0,1fr);gap:10px;align-items:center;min-height:48px;height:auto;padding:7px 10px;line-height:1.4;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--ink);font:inherit;text-align:left;cursor:pointer}
.fl-ev:hover{border-color:var(--gosu);background:var(--gosu-wash)}
.fl-ev-d{font-weight:700;font-variant-numeric:tabular-nums}
.fl-ev-t{display:grid;gap:2px;min-width:0}
.fl-ev-t b{font-size:14px}
.fl-flash{animation:flFlash 1.1s ease}
@keyframes flFlash{0%,45%{box-shadow:0 0 0 3px var(--demo)}100%{box-shadow:0 0 0 0 transparent}}
@media (prefers-reduced-motion:reduce){.fl-tpl{transition:none}.fl-tpl:hover{transform:none}.fl-flash{animation:none}}

/* ───── 紙面（画面の見た目と印刷で同じ。紙の上なので、表示の明るさに関係なく決まった色） ───── */
.fl-page{--fi:#1a1a1a;--fi2:#454545;--fgo:"Zen Kaku Gothic New","Hiragino Kaku Gothic ProN","Yu Gothic",Meiryo,sans-serif;--fma:"Zen Maru Gothic","Hiragino Maru Gothic ProN","Zen Kaku Gothic New","Yu Gothic",sans-serif;--fmi:"Zen Old Mincho","Hiragino Mincho ProN","Yu Mincho","Noto Serif JP",serif;--fha:"Klee One","Hiragino Maru Gothic ProN","Yu Gothic",sans-serif;
  position:relative;display:flex;flex-direction:column;overflow:hidden;box-sizing:border-box;background:#fff;color:var(--fi);font-family:var(--fgo);font-size:calc(var(--fb) * var(--fk));line-height:1.65;text-align:left;line-break:strict;overflow-wrap:anywhere;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.fl-page *{box-sizing:border-box}
.fl-page.is-measure{height:auto!important}
.fl-page p,.fl-page h1,.fl-page dl,.fl-page dd,.fl-page figure{margin:0}
.fl-hd{position:relative;flex:none}
.fl-hx{min-width:0}
.fl-kicker{display:inline-block;font-weight:700;line-height:1.35}
.fl-head{font-weight:700;line-height:1.2;letter-spacing:.03em;white-space:pre-line;text-wrap:balance;word-break:auto-phrase;font-feature-settings:'palt'}
.fl-sub{font-weight:700;font-size:1.32em;line-height:1.45;text-wrap:balance;word-break:auto-phrase}
.fl-kicker,.fl-mast-t{font-feature-settings:'palt'}
.fl-main{flex:1 1 auto;display:flex;flex-direction:column;justify-content:space-evenly;gap:5mm;min-height:0}
.fl-col{display:flex;flex-direction:column;gap:4mm;min-width:0}
.fl-body{font-size:1.04em;line-height:1.85}
.fl-body p.gap{height:.55em}
.fl-body p.li{padding-left:1em;text-indent:-1em!important}
.fl-photo{text-align:center}
.fl-photo img{display:block;margin:0 auto;max-width:100%;max-height:min(calc(var(--fph) * 1.1),calc(var(--fph) * var(--fk) * var(--fk)));width:auto;height:auto}
.fl-photo figcaption{font-size:.84em;margin-top:1.2mm;color:var(--fi2)}
.fl-port .fl-col-a.has-photo{display:grid;grid-template-columns:minmax(0,.92fr) minmax(0,1fr);gap:6mm;align-items:center}
.fl-port.fl-s-news .fl-col-a.has-photo .fl-body{columns:1}
.fl-ib-h{display:none}
.fl-ib-in.has-badge{display:grid;grid-template-columns:auto minmax(0,1fr);gap:5mm;align-items:center}
.fl-info{display:grid;grid-template-columns:fit-content(8.5em) minmax(0,1fr);column-gap:3.5mm;row-gap:1.8mm}
.fl-r{grid-column:1/-1;display:grid;grid-template-columns:6.5em minmax(0,1fr);column-gap:3.5mm;align-items:baseline}
@supports (grid-template-columns:subgrid){.fl-r{grid-template-columns:subgrid}}
.fl-r dt{font-weight:700;line-height:1.5;padding:0 1.6mm}
.fl-r dd{line-height:1.5;white-space:pre-line;min-width:0}
.fl-date{display:inline-block;max-width:100%;font-weight:700;font-size:1.28em;margin-right:.5em}
.fl-time{display:inline-block;max-width:100%;font-weight:700;font-size:1.12em}
.fl-wnote{display:block;font-size:.9em;color:var(--fi2)}
.fl-badge{display:grid;justify-items:center;align-content:center;text-align:center;line-height:1.15}
.fl-badge b{font-size:2.3em;font-weight:800;letter-spacing:-.01em;line-height:1}
.fl-bd-w{font-size:1.05em;font-weight:700}
.fl-bd-s{font-size:.86em;font-weight:700;margin-top:.6mm}
.fl-ft{flex:none;position:relative;display:grid;grid-template-columns:minmax(0,1fr);gap:5mm;align-items:end}
.fl-ft.has-qr{grid-template-columns:minmax(0,1fr) auto}
.fl-ftx{display:grid;gap:1.4mm;min-width:0}
.fl-contact{font-size:.95em;line-height:1.5;white-space:pre-line}
.fl-contact b{display:inline-block;margin-right:.7em}
.fl-org{font-weight:700;font-size:.95em}
.fl-qr{display:grid;justify-items:center;gap:.8mm;width:27mm;font-size:.78em;font-weight:700;line-height:1.3;text-align:center}
.fl-qr img{display:block;width:25mm;height:25mm;image-rendering:pixelated;background:#fff}
.fl-motif{flex:none}
.fl-motif svg{display:block;width:100%;height:100%;overflow:visible}
.mo-s{stroke:var(--fm);stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round}
.mo-m{fill:var(--fm)}.mo-w{fill:var(--fw)}.mo-a{fill:var(--fa)}.mo-n{fill:none}
.fl-s-clean .fl-hd,.fl-s-board .fl-hd,.fl-s-news .fl-hd{display:grid;grid-template-columns:minmax(0,1fr);column-gap:5mm;align-items:center}
.fl-s-clean.has-motif .fl-hd,.fl-s-board.has-motif .fl-hd{grid-template-columns:minmax(0,1fr) var(--mw)}
.fl-s-news.has-motif .fl-hd{grid-template-columns:minmax(0,1fr) calc(var(--mw) - 4mm)}
.fl-s-clean .fl-motif,.fl-s-board .fl-motif{width:var(--mw);height:var(--mw)}
.fl-s-news .fl-motif{width:calc(var(--mw) - 4mm);height:calc(var(--mw) - 4mm)}

/* すっきり：しま模様の帯・色の札・線で区切る */
.fl-s-clean .fl-band{flex:none;height:6mm;background:repeating-linear-gradient(-45deg,var(--fm) 0 1.6mm,#fff 1.6mm 3.2mm);border-bottom:1.2mm solid var(--fm)}
.fl-s-clean .fl-hd{padding:8mm 12mm 0}
.fl-s-clean .fl-kicker{background:var(--fm);color:#fff;padding:1mm 3.5mm;border-radius:1mm;font-size:1.05em;letter-spacing:.08em}
.fl-s-clean .fl-head{color:var(--fm);margin-top:3.5mm}
.fl-s-clean .fl-sub{margin-top:3.5mm;padding-left:3mm;border-left:1.4mm solid var(--fm)}
.fl-s-clean .fl-main{padding:6mm 12mm}
.fl-s-clean .fl-ib{border-top:.8mm solid var(--fm);border-bottom:.8mm solid var(--fm);padding:4mm 0}
.fl-s-clean .fl-badge{min-width:30mm;padding:3mm 3.5mm;background:var(--fm);color:#fff;border-radius:2mm}
.fl-s-clean .fl-r dt{background:var(--fw);color:var(--fm);text-align:center;border-radius:1mm}
.fl-s-clean .fl-r+.fl-r{border-top:.25mm dashed #9a9a9a;padding-top:1.8mm}
.fl-s-clean .fl-ft{padding:0 12mm 9mm}
.fl-s-clean .fl-contact{background:var(--fw);border-left:1.4mm solid var(--fm);padding:2.4mm 4mm}
.fl-s-clean::after{content:'';position:absolute;left:0;right:0;bottom:0;height:3mm;background:var(--fm)}

/* ポップ：水玉・ふきだしの見出し・まるい札 */
.fl-s-pop{font-family:var(--fma);background-color:#fff;background-image:radial-gradient(circle,var(--fw) 1.3mm,transparent 1.45mm);background-size:8mm 8mm;background-position:2mm 2mm}
.fl-s-pop .fl-hd{margin:10mm 10mm 0;padding:9mm 8mm 7mm;background:#fff;border:1mm solid var(--fm);border-radius:8mm;box-shadow:2.2mm 2.2mm 0 var(--fm);text-align:center}
.fl-s-pop .fl-kicker{position:absolute;top:0;left:50%;transform:translate(-50%,-55%) rotate(-2deg);max-width:86%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;background:var(--fm);color:#fff;padding:1.4mm 6mm;border-radius:99px;font-size:1.12em}
.fl-s-pop .fl-head{color:var(--fm);font-family:var(--fma)}
.fl-s-pop.has-motif .fl-head{padding:0 14mm}
.fl-s-pop .fl-sub{margin-top:3mm;text-decoration:underline wavy var(--fa);text-decoration-thickness:.5mm;text-underline-offset:.42em;text-decoration-skip-ink:none}
.fl-s-pop .fl-motif{position:absolute;top:-8mm;right:-6mm;width:30mm;height:30mm;transform:rotate(10deg)}
.fl-s-pop .fl-main{padding:7mm 10mm 6mm}
.fl-s-pop .fl-body{background:#fff;border:.5mm dashed var(--fm);border-radius:5mm;padding:4mm 5mm}
.fl-s-pop .fl-ib{background:#fff;border:.6mm solid var(--fm);border-radius:6mm;padding:4mm 5mm}
.fl-s-pop .fl-badge{width:31mm;height:31mm;border-radius:50%;background:var(--fm);color:#fff;box-shadow:0 0 0 1mm #fff,0 0 0 1.6mm var(--fm)}
.fl-s-pop .fl-badge b{font-size:2.1em}
.fl-s-pop .fl-r dt{background:var(--fw);color:var(--fm);border-radius:99px;text-align:center}
.fl-s-pop .fl-ft{margin:0 10mm 9mm;padding:3mm 7mm;background:#fff;border:.6mm solid var(--fm);border-radius:6mm}

/* 和風：二重の枠・七宝の帯・明朝・記 */
.fl-s-wa{font-family:var(--fmi);padding:7mm}
.fl-s-wa .fl-frame{position:absolute;inset:2.5mm;border:2.2mm double var(--fm);pointer-events:none}
.fl-s-wa .fl-hd{position:static;text-align:center;padding:0 6mm}
.fl-s-wa .fl-wave{display:block;width:100%;height:10mm;margin:0 0 5mm}
.fl-wv-bg{fill:var(--fw)}
.fl-wv{fill:none;stroke:var(--fm);stroke-width:1.1}
.fl-s-wa .fl-kicker{display:flex;align-items:center;justify-content:center;gap:4mm;color:var(--fm);font-size:1.12em;letter-spacing:.3em}
.fl-s-wa .fl-kicker::before,.fl-s-wa .fl-kicker::after{content:'';flex:0 0 12mm;height:.35mm;background:var(--fm)}
.fl-s-wa .fl-head{font-family:var(--fmi);font-weight:900;letter-spacing:.08em;margin-top:4mm}
.fl-s-wa .fl-sub{font-family:var(--fmi);color:var(--fm);font-size:1.22em;margin-top:3mm}
.fl-s-wa .fl-main{padding:6mm 9mm 4mm}
.fl-s-wa .fl-body{line-height:1.95}
.fl-s-wa .fl-body p{text-indent:1em}
.fl-s-wa .fl-ib-h{display:block;text-align:center;font-size:1.2em;font-weight:700;color:var(--fm);margin-bottom:2mm}
.fl-s-wa .fl-badge,.fl-s-news .fl-badge{display:none}
.fl-s-wa .fl-ib-in.has-badge,.fl-s-news .fl-ib-in.has-badge{display:block}
.fl-s-wa .fl-r{border-bottom:.3mm dotted var(--fm);padding:1.6mm 2mm}
.fl-s-wa .fl-r dt{text-align-last:justify;color:var(--fm)}
.fl-s-wa .fl-motif{width:24mm;height:24mm}
.fl-s-wa .fl-ft{padding:0 9mm 4mm 7mm;text-align:right}
.fl-s-wa .fl-ft.has-mo{grid-template-columns:24mm minmax(0,1fr)}
.fl-s-wa .fl-ft.has-mo.has-qr{grid-template-columns:24mm minmax(0,1fr) auto}

/* 黒板風：木のわく・チョークの文字・マグネット */
.fl-s-board .fl-hd{margin:8mm 8mm 0;padding:7mm 9mm 12mm;background:var(--fm);color:#fff;border:3mm solid #8a6640;border-radius:2.5mm;box-shadow:inset 0 0 0 .5mm rgba(0,0,0,.28),inset 0 0 14mm rgba(255,255,255,.07);font-family:var(--fha)}
.fl-s-board .fl-kicker{color:var(--fl);font-size:1.12em;border-bottom:.45mm dashed var(--fl);padding-bottom:.5mm}
.fl-s-board .fl-head{font-family:var(--fha);font-weight:600;color:#fff;margin-top:3mm}
.fl-s-board .fl-sub{font-weight:600;color:var(--fl);margin-top:3mm}
.fl-s-board .mo-s{stroke:var(--fl)}.fl-s-board .mo-a{fill:color-mix(in srgb,var(--fl) 30%,transparent)}.fl-s-board .mo-w{fill:none}.fl-s-board .mo-m{fill:var(--fl)}
.fl-s-board .fl-mag{position:absolute;top:-1.6mm;width:6mm;height:6mm;border-radius:50%;background:var(--fa);border:.5mm solid rgba(0,0,0,.35)}
.fl-s-board .fl-mag.l{left:6mm}.fl-s-board .fl-mag.r{right:6mm}
.fl-s-board .fl-chalk{position:absolute;right:8mm;bottom:2.6mm;display:flex;gap:2mm}
.fl-s-board .fl-chalk i{display:block;width:9mm;height:2mm;border-radius:1mm;background:#fff}
.fl-s-board .fl-chalk i:nth-child(2){background:var(--fl)}
.fl-s-board .fl-chalk i:nth-child(3){background:var(--fa);width:6mm}
.fl-s-board .fl-main{padding:7mm 11mm 5mm}
.fl-s-board .fl-badge{position:relative;min-width:30mm;padding:3mm;border:.7mm solid var(--fm);border-radius:2mm;background:var(--fw);color:var(--fm);font-family:var(--fha);transform:rotate(-2deg)}
.fl-s-board .fl-badge::before{content:'';position:absolute;top:-2.4mm;left:50%;width:14mm;height:4mm;transform:translateX(-50%) rotate(3deg);background:rgba(140,140,140,.38)}
.fl-s-board .fl-r dt{background:var(--fm);color:#fff;border-radius:1.2mm;text-align:center;font-family:var(--fha);font-weight:600}
.fl-s-board .fl-r{border-bottom:.3mm solid #cfcfcf;padding-bottom:1.6mm}
.fl-s-board .fl-ft{margin:0 11mm 8mm;padding-top:3mm;border-top:.6mm dashed var(--fm)}

/* 新聞風：題字と二重線・明朝の見出し・2段の記事・ご案内の囲み */
.fl-s-news{padding:8mm 10mm 0}
.fl-s-news .fl-mast{grid-column:1/-1;position:relative;display:flex;align-items:flex-end;justify-content:space-between;gap:4mm;padding-bottom:1.6mm;border-bottom:1.6mm solid var(--fm);margin-bottom:5.5mm}
.fl-s-news .fl-mast::after{content:'';position:absolute;left:0;right:0;bottom:-2.6mm;border-bottom:.35mm solid var(--fm)}
.fl-mast-t{font-family:var(--fmi);font-weight:900;font-size:2.2em;line-height:1.1;letter-spacing:.12em;color:var(--fm)}
.fl-mast-o{font-size:.9em;font-weight:700;text-align:right;line-height:1.4}
.fl-s-news .fl-head{font-family:var(--fmi);font-weight:900;letter-spacing:.02em}
.fl-s-news .fl-sub{font-size:1.2em;margin-top:3mm;padding:1.4mm 3mm;border-left:1.6mm solid var(--fm);background:var(--fw)}
.fl-s-news .fl-main{padding:6mm 0 5mm}
.fl-s-news .fl-body{columns:2;column-gap:7mm;column-rule:.3mm solid #9a9a9a;line-height:1.8}
.fl-s-news .fl-body p{text-indent:1em}
.fl-s-news .fl-ib{border:.6mm solid var(--fm)}
.fl-s-news .fl-ib-h{display:block;background:var(--fm);color:#fff;font-weight:700;letter-spacing:.3em;padding:1mm 4mm}
.fl-s-news .fl-ib-in{padding:2mm 4mm 3mm}
.fl-s-news .fl-r{border-bottom:.3mm dotted #888;padding:1.4mm 0}
.fl-s-news .fl-r:last-child{border-bottom:0}
.fl-s-news .fl-r dt{color:var(--fm);padding:0}
.fl-s-news .fl-r dt::before{content:'■';margin-right:.25em}
.fl-s-news .fl-ft{border-top:.4mm solid var(--fi);padding:2.5mm 0 7mm}

/* よこ向き：見出しの下を左右2つに分ける */
.fl-land .fl-main{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,1fr);gap:8mm;align-items:center;align-content:center}
.fl-land .fl-main>.fl-col:only-child{grid-column:1/-1}
.fl-land.fl-s-news .fl-main{align-items:start}
.fl-land.fl-s-wa .fl-wave{height:7mm;margin-bottom:3mm}
.fl-land.fl-s-wa .fl-motif{width:18mm;height:18mm}
.fl-land.fl-s-wa .fl-ft.has-mo{grid-template-columns:18mm minmax(0,1fr)}
.fl-land.fl-s-wa .fl-ft.has-mo.has-qr{grid-template-columns:18mm minmax(0,1fr) auto}
`);

  /* ───────── 画面 ───────── */
  Kit.app({
    id: 'flyer', title: 'チラシ', group: 'write', icon: 'megaphone', order: 62,
    desc: '学習会・行事・募集のお知らせを、15のテンプレートからさっと。A4・B5 で印刷',
    colls: ['flyers'],
    async mount(root, params) {
      const S = { list: [], cur: null, isNew: false, pane: Kit.pref.get('flyer:pane', 'write'), bw: false, fit: null, cat: Kit.pref.get('flyer:cat', 'all'), ctx: null, pv: null, grid: null, title: null };
      let alive = true;
      const pages = new Set();   // 描いた紙面 { page, f, box, fit }。字体を読みこんだら合わせ直す
      const slot = h('div');
      root.append(Kit.appHead({ title: 'チラシ', desc: 'テンプレートを選んで、日時と場所を書きかえるだけ。A4・B5 で印刷できます。' }), slot);
      const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => scaleAll()) : null;
      const onResize = () => scaleAll();
      window.addEventListener('resize', onResize);

      async function load() {
        S.ctx = await ctxNow();
        S.list = (await Kit.store.list('flyers')).map(norm).sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
        for (const f of S.list) if (f.photo) await photoOf(f.photo);
      }
      const save = Kit.debounce(() => {
        if (!S.cur || S.isNew) return;
        const it = Kit.clone(S.cur);
        delete it.sample;
        S.cur.sample = false;
        return Kit.store.put('flyers', it);
      }, 400);
      const preview = Kit.debounce(() => refresh(), 160);
      const changed = () => { S.isNew = false; save(); preview(); };

      /* ── 縮めた紙（一覧の小さな紙・テンプレートの見本・書いている紙面） ── */
      function thumb(f, kind) {
        const P = paperOf(f);
        const page = pageEl(f, { qr: qrOf(f.qr).url, photo: imgCache.get(f.photo) || '' });
        const sheet = h('div', { class: 'fl-sheet' }, page);
        Object.assign(sheet.style, { width: P.w + 'mm', height: P.h + 'mm', padding: FT.MARGIN + 'mm' });
        const box = h('div', { class: 'fl-th' + (kind ? ' fl-th-' + kind : '') }, sheet);
        const it = { page, f, box, sheet, P, fit: null };
        pages.add(it);
        if (ro) ro.observe(box);
        for (const im of page.querySelectorAll('img')) im.addEventListener('load', () => fitAll(), { once: true });
        return box;
      }
      // 縮める。書いている紙面は、広い画面では1枚がまるごと画面に入る大きさに（紙面を見ながら書けるように）
      function scaleAll() {
        for (const it of pages) {
          const w = it.box.clientWidth;
          if (!w) continue;
          let k = w / (it.P.w * MM);
          if (S.pv && it.box === S.pv.box && window.innerWidth >= 1100) k = Math.min(k, Math.max(320, window.innerHeight - 110) / (it.P.h * MM));
          it.sheet.style.transform = 'scale(' + k + ')';
          it.sheet.style.left = Math.max(0, (w - it.P.w * MM * k) / 2) + 'px';
          it.box.style.height = Math.ceil(it.P.h * MM * k) + 'px';
        }
      }
      function fitAll() {
        if (!alive) return;
        for (const it of [...pages]) {
          if (!it.page.isConnected) { pages.delete(it); continue; }
          const r = fitPage(it.page, it.f);
          if (r) it.fit = r;
        }
        scaleAll();
        showStatus();
      }
      function showStatus() {
        if (!S.cur || !S.pv || !S.pv.box) return;
        const it = [...pages].find((x) => x.box === S.pv.box);
        S.fit = it ? it.fit : null;
        const n = FT.fitNote(S.fit, S.cur.paper);
        S.pv.status.textContent = n.text;
        S.pv.status.className = 'small fl-status ' + n.tone;
        S.pv.pv.classList.toggle('is-over', !!(S.fit && S.fit.over));
      }

      /* ── 作る順番（1 選ぶ → 2 書きかえる → 3 色と紙・印刷） ── */
      function steps(n) {
        const go = [() => toList(), () => setPane('write', true), () => setPane('look', true)];
        const names = [['テンプレートを選ぶ', '選ぶ'], ['文字を書きかえる', '書く'], ['色と紙を選んで印刷', '色と紙・印刷']];
        return h('nav', { class: 'sk-steps fl-steps', 'aria-label': '作る順番' }, names.map(([t, short], i) =>
          h('button', { type: 'button', class: 'sk-step', 'aria-current': i === n ? 'step' : null, disabled: i > 0 && !S.cur, onclick: go[i], 'aria-label': (i + 1) + ' ' + t }, h('b', null, i + 1), h('span', { class: 'fl-st-l' }, t), h('span', { class: 'fl-st-s' }, short))));
      }
      function markStep(n) { slot.querySelectorAll('.fl-steps .sk-step').forEach((b, i) => { if (i === n) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); }); }

      async function render() {
        Kit.clear(slot);
        pages.clear();
        S.pv = null; S.grid = null;
        if (ro) ro.disconnect();
        if (S.cur) renderEdit(); else renderList();
        requestAnimationFrame(() => fitAll());
      }

      /* ── 一覧とテンプレート ── */
      function renderList() {
        slot.append(steps(0));
        if (S.list.some((x) => x.sample)) slot.append(Kit.sampleBar('架空の学校のチラシです。開いて書きかえて試せます。'));
        if (S.list.length) {
          slot.append(h('h2', { class: 'fl-h2' }, 'つくったチラシ', h('span', { class: 'small muted' }, S.list.length + '枚')),
            h('div', { class: 'fl-cards' }, S.list.map((f) => h('article', { class: 'fl-card' },
              h('div', { class: 'fl-card-th', 'aria-hidden': 'true', onclick: () => open(f.id) }, thumb(f, 'mini')),
              h('div', { class: 'fl-card-tx' },
                h('b', { class: 'fl-card-t' }, titleOf(f)),
                h('span', { class: 'fl-card-d' }, [FT.whenText(f).date, paperOf(f).label, STYLE_LABEL[f.style]].filter(Boolean).join('・')),
                h('div', { class: 'btn-row' },
                  Kit.btn('開く', () => open(f.id), { sm: true, icon: 'edit' }),
                  Kit.btn('写す', () => dup(f), { sm: true, icon: 'copy', kind: 'ghost', title: 'このチラシを写して、新しく作る' }),
                  Kit.btn('', () => remove(f), { sm: true, icon: 'trash', kind: 'ghost', title: '「' + titleOf(f) + '」を消す' })))))));
        }
        const grid = h('div', { class: 'fl-tpls' });
        const drawGrid = () => {
          for (const it of [...pages]) if (grid.contains(it.box)) pages.delete(it);
          Kit.clear(grid);
          for (const t of FT.TEMPLATES.filter((x) => S.cat === 'all' || x.cat === S.cat)) {
            const f = norm(FT.make(t.id, S.ctx));
            grid.append(h('article', { class: 'fl-tpl', 'data-tpl': t.id },
              h('div', { 'aria-hidden': 'true' }, thumb(f)),
              h('button', { type: 'button', class: 'fl-tpl-go', onclick: () => fromTemplate(t.id) }, h('b', null, t.label), h('span', { class: 'fl-tpl-d' }, h('span', { class: 'fl-tpl-tag' }, STYLE_LABEL[t.style]), t.desc))));
          }
          requestAnimationFrame(() => fitAll());
        };
        slot.append(h('section', { class: 'fl-gallery', 'aria-label': 'テンプレート' },
          h('h2', { class: 'fl-h2' }, 'テンプレートから作る', h('span', { class: 'small muted' }, 'どれも見本の文入り。日時と場所を変えるだけで出せます')),
          h('div', { class: 'fl-cats' }, Kit.seg([{ value: 'all', label: 'すべて' }].concat(FT.CATS.map((c) => ({ value: c.id, label: c.label }))), S.cat, (v) => { S.cat = v; Kit.pref.set('flyer:cat', v); drawGrid(); }, { label: 'テンプレートの種類' })),
          grid));
        drawGrid();
      }

      /* ── 書きかえる ── */
      function renderEdit() {
        const f = S.cur;
        slot.append(steps(S.pane === 'look' ? 2 : 1));
        if (f.sample) slot.append(Kit.sampleBar('架空の学校のチラシです。そのまま書きかえて試せます。'));
        S.title = h('b', { class: 'fl-bar-t' }, titleOf(f));
        slot.append(h('div', { class: 'fl-bar' },
          Kit.btn('一覧', () => toList(), { icon: 'left', kind: 'ghost', sm: true }),
          S.title,
          h('div', { class: 'btn-row' },
            Kit.btn('写して作る', () => dup(S.cur), { icon: 'copy', kind: 'ghost', sm: true, title: 'このチラシを写して、別のチラシを作る' }),
            Kit.btn('印刷', print, { icon: 'printer', kind: 'primary', sm: true }))));
        const grid = h('div', { class: 'fl-edit', 'data-pane': S.pane });
        S.grid = grid;
        slot.append(grid);
        grid.append(design(), editor(), side());
        refresh();
      }
      function setPane(v, jump) {
        if (!S.cur) return;
        S.pane = v;
        Kit.pref.set('flyer:pane', v);
        if (S.grid) S.grid.dataset.pane = v;
        markStep(v === 'look' ? 2 : 1);
        requestAnimationFrame(() => {
          fitAll();
          if (jump) { const el = slot.querySelector(v === 'look' ? '.fl-design' : '.fl-sec-when'); if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
        });
      }
      // 編集の画面だけ描き直す（スクロールの位置はそのまま）
      function rerender() {
        const y = window.scrollY;
        Kit.clear(slot); pages.clear(); S.pv = null;
        if (ro) ro.disconnect();
        renderEdit();
        window.scrollTo(0, y);
      }

      function editor() {
        const f = S.cur;
        const bind = (el, key) => {
          el.id = 'fl-in-' + key;
          el.value = f[key] == null ? '' : f[key];
          el.addEventListener('input', () => { f[key] = el.value; if (key === 'head' || key === 'kicker') S.title.textContent = titleOf(f); changed(); });
          return el;
        };
        const inp = (key, label, attrs, hint) => Kit.field({ label, hint, input: bind(h('input', Object.assign({ type: 'text' }, attrs || {})), key) });
        const area = (key, label, rows, attrs, hint) => Kit.field({ label, hint, input: bind(h('textarea', Object.assign({ rows }, attrs || {})), key) });
        const sec = (cls, title, note, ...kids) => h('section', { class: 'card fl-sec ' + cls, 'aria-label': title }, h('div', { class: 'fl-sec-h' }, h('h2', null, title), note ? h('span', { class: 'small muted' }, note) : null), kids);

        // 日時：日付を変えたら、終わりの日と締切も同じだけずらす
        const dateIn = h('input', { type: 'date', id: 'fl-in-date' });
        dateIn.value = f.date || '';
        const endIn = h('input', { type: 'date' }), dlIn = h('input', { type: 'date', 'aria-label': '申込みの締切' });
        dateIn.addEventListener('input', () => {
          Object.assign(f, FT.shiftDate(f, dateIn.value, Kit.ymd(), School.isOff));
          endIn.value = f.endDate || ''; dlIn.value = f.deadline || '';
          changed();
        });
        bind(endIn, 'endDate'); bind(dlIn, 'deadline');
        const labelIn = (key) => {
          const el = h('input', { type: 'text', maxlength: 12, id: 'fl-lb-' + key, 'aria-label': '項目の名前（' + (FT.LABELS[key] || 'そのほか') + '）', placeholder: FT.LABELS[key] || '項目の名前' });
          el.value = f.labels[key] || '';
          el.addEventListener('input', () => { f.labels[key] = el.value; changed(); });
          return el;
        };
        const valIn = (key, ph, label) => bind(h('input', { type: 'text', maxlength: 100, placeholder: ph, 'aria-label': label }), key);

        const ed = h('div', { class: 'fl-ed' });
        ed.append(
          sec('fl-sec-when', '日時・場所', 'まず、ここを変えるだけで出せます',
            h('div', { class: 'fl-g2' }, Kit.field({ label: '日付', input: dateIn }), Kit.field({ label: '終わりの日（何日か続くとき）', input: endIn })),
            h('div', { class: 'fl-g2' }, inp('start', '始まり', { type: 'time' }), inp('end', '終わり', { type: 'time' })),
            inp('place', '場所', { maxlength: 60, placeholder: '例：図書室' }),
            inp('whenNote', '日時のひとこと（なくてもよい）', { maxlength: 40, placeholder: '例：雨の場合は次の日に延期' }),
            h('div', { class: 'btn-row' }, Kit.btn('カレンダーの予定から入れる', fromCalendar, { icon: 'calendar', sm: true })),
            h('details', { class: 'fl-more' }, h('summary', null, '項目の名前を変える（「日時」→「期間」など）'),
              h('div', { class: 'fl-tbl' }, h('div', { class: 'fl-tr' }, h('span', { class: 'small ink-2' }, '日時'), labelIn('when')), h('div', { class: 'fl-tr' }, h('span', { class: 'small ink-2' }, '場所'), labelIn('place'))))),
          sec('fl-sec-head', '見出し', '',
            inp('kicker', '上の小さな札', { maxlength: 30, placeholder: '例：学習会のお知らせ' }),
            area('head', '大きな見出し', 2, { maxlength: 60 }, 'Enter で改行できます。文字の大きさは、紙の幅に合わせて自動で決まります。'),
            inp('sub', 'ひとこと（サブ見出し）', { maxlength: 60 })),
          sec('fl-sec-info', 'くわしく', '中身を空にした行は、紙面に出ません',
            h('div', { class: 'fl-tbl' },
              h('div', { class: 'fl-tr fl-thr', 'aria-hidden': 'true' }, h('span', null, '項目の名前'), h('span', null, '中身')),
              h('div', { class: 'fl-tr' }, labelIn('target'), valIn('target', '例：2年の希望者', '対象の中身')),
              h('div', { class: 'fl-tr' }, labelIn('bring'), valIn('bring', '例：筆記用具・ワーク', '持ち物の中身')),
              h('div', { class: 'fl-tr' }, labelIn('apply'), h('div', { class: 'fl-apply' },
                h('label', { class: 'fl-dl small' }, dlIn, h('span', null, 'までに')),
                valIn('apply', '例：申込用紙を担任の先生に出してください', '申込みの方法'))),
              h('div', { class: 'fl-tr' }, labelIn('extra'), valIn('extra', '例：無料', 'そのほかの中身')))),
          sec('fl-sec-body', '本文', '', area('body', '本文', 6, { maxlength: 800, 'aria-label': '本文' }, '改行はそのまま。空の行は、すき間になります。')),
          contactSec(sec, inp, area),
          picSec(sec));
        return ed;
      }
      function contactSec(sec, inp, area) {
        const msg = h('p', { class: 'fl-qrmsg', role: 'status' });
        const s = sec('fl-sec-contact', '問い合わせ・QRコード', '',
          area('contact', '問い合わせ先', 2, { maxlength: 120 }),
          inp('org', '発行（学校名など）', { maxlength: 40 }),
          h('div', { class: 'fl-g2' }, inp('qr', 'QRコードにする URL（なくてもよい）', { type: 'url', inputmode: 'url', maxlength: 900, placeholder: 'https://…（申込みフォームなど）' }), inp('qrLabel', 'QRコードの説明', { maxlength: 20, placeholder: '例：申込みフォーム' })),
          msg);
        S.qrMsg = msg;
        return s;
      }
      function picSec(sec) {
        const f = S.cur, pal = FT.palette(f.palette);
        const mBox = h('div', { class: 'fl-motifs', role: 'group', 'aria-label': '絵' });
        for (const [k, v] of [['--fm', pal.main], ['--fw', pal.wash], ['--fa', pal.accent], ['--fl', pal.light]]) mBox.style.setProperty(k, v);
        const pick = (id) => { f.motif = id; for (const b of mBox.children) b.setAttribute('aria-pressed', String(b.dataset.v === id)); changed(); };
        mBox.append(h('button', { type: 'button', 'data-v': '', 'aria-pressed': String(!f.motif), title: '絵なし', onclick: () => pick('') }, 'なし'));
        for (const [id, m] of Object.entries(FT.MOTIFS)) mBox.append(h('button', { type: 'button', 'data-v': id, 'aria-pressed': String(f.motif === id), title: m.label, 'aria-label': '絵：' + m.label, onclick: () => pick(id) }, motifSvg(id)));
        const pthumb = h('div', { class: 'fl-pthumb' });
        const showPhoto = async () => { const u = await photoOf(f.photo); Kit.clear(pthumb).append(u ? h('img', { src: u, alt: '' }) : h('span', { class: 'small muted' }, '写真なし')); };
        showPhoto();
        const cap = h('input', { type: 'text', id: 'fl-in-photoCap', maxlength: 60, placeholder: '写真の説明（なくてもよい）', 'aria-label': '写真の説明' });
        cap.value = f.photoCap || '';
        cap.addEventListener('input', () => { f.photoCap = cap.value; changed(); });
        return sec('fl-sec-pic', '絵・写真', '',
          h('div', { class: 'small ink-2' }, '絵（見出しのそばに入ります）'), mBox,
          h('div', { class: 'small ink-2', style: { marginTop: '6px' } }, '写真（なくてもよい。このブラウザの中で小さくして保存します）'),
          h('div', { class: 'fl-photo-row' }, pthumb, h('div', { class: 'stack tight' },
            Kit.btn(f.photo ? '写真を変える' : '写真を選ぶ', () => pickPhoto(), { sm: true, icon: 'image' }),
            f.photo ? Kit.btn('写真を外す', () => dropPhotoOfCur(), { sm: true, icon: 'trash', kind: 'ghost' }) : null)),
          cap,
          h('p', { class: 'small muted' }, '生徒が写った写真は、学校の決まり（掲載の同意など）を確かめてから使ってください。'));
      }
      async function pickPhoto() {
        const file = await Kit.img.pick('image/*');
        if (!file || !S.cur) return;
        try {
          const it = await Kit.img.save(file, { max: 1400, maxBytes: 200000 });
          const old = S.cur.photo;
          S.cur.photo = 'img:' + it.id;
          imgCache.set(S.cur.photo, it.dataUrl);
          changed();
          if (old) { await save.flush(); await dropPhoto(old, ''); }
          rerender();
        } catch (e) { Kit.toast((e && e.message) || '写真を入れられませんでした', { type: 'bad' }); }
      }
      async function dropPhotoOfCur() {
        if (!S.cur || !S.cur.photo) return;
        if (!(await Kit.confirm({ title: '写真を外しますか', body: 'チラシから写真を外します（このブラウザに保存した写真も消えます）。', ok: '外す', danger: true }))) return;
        const old = S.cur.photo;
        S.cur.photo = '';
        changed();
        await save.flush();
        await dropPhoto(old, '');
        rerender();
      }
      // 使っていない写真を消す（ほかのチラシが同じ写真を使っていれば残す）
      async function dropPhoto(ref, exceptId) {
        if (!ref || !String(ref).startsWith('img:')) return;
        const all = await Kit.store.list('flyers');
        if (all.some((y) => y.id !== exceptId && y.photo === ref)) return;
        await Kit.store.remove('images', String(ref).slice(4));
        imgCache.delete(ref);
      }

      /* ── 紙面と、雰囲気・色・紙 ── */
      function design() {
        const f = S.cur;
        const palName = h('b', { class: 'fl-pal-n' }, FT.palette(f.palette).label);
        const pal = h('div', { class: 'fl-pal', role: 'group', 'aria-label': '色の組み合わせ' }, FT.PALETTES.map((p) => h('button', {
          type: 'button', 'data-v': p.id, 'aria-pressed': String(f.palette === p.id), title: p.label, 'aria-label': '色：' + p.label,
          onclick: () => { f.palette = p.id; palName.textContent = p.label; for (const b of pal.children) b.setAttribute('aria-pressed', String(b.dataset.v === p.id)); markStep(2); changed(); rerenderPics(); },
        })));
        for (const b of pal.children) { const p = FT.palette(b.dataset.v); b.style.setProperty('--sw-m', p.main); b.style.setProperty('--sw-a', p.accent); b.style.setProperty('--sw-w', p.wash); }
        const bw = h('input', { type: 'checkbox', id: 'fl-bw', checked: S.bw });
        bw.addEventListener('change', () => { S.bw = bw.checked; if (S.pv) S.pv.pv.classList.toggle('is-bw', S.bw); });
        const design = h('section', { class: 'card fl-design', 'aria-label': '雰囲気・色・紙' },
          h('div', { class: 'fl-opt fl-opt-style' }, h('span', { class: 'fl-opt-l' }, '雰囲気'), Kit.seg(FT.STYLES.map((s) => ({ value: s.id, label: s.label })), f.style, (v) => { f.style = v; markStep(2); changed(); }, { label: '雰囲気' })),
          h('div', { class: 'fl-opt fl-opt-color' }, h('span', { class: 'fl-opt-l' }, '色'), pal, palName),
          h('div', { class: 'fl-opt fl-opt-paper' }, h('span', { class: 'fl-opt-l' }, '紙'), Kit.seg(Object.entries(FT.PAPERS).map(([k, p]) => ({ value: k, label: p.label })), f.paper, (v) => { f.paper = v; markStep(2); changed(); }, { label: '紙の大きさ' })),
          h('label', { class: 'check small fl-bw', for: 'fl-bw' }, bw, '白黒で印刷したときの見え方にする（色の確かめ）'));
        return design;
      }
      function side() {
        const pv = h('div', { class: 'fl-pv' + (S.bw ? ' is-bw' : ''), title: '押すと、その所を書きかえられます' });
        const status = h('p', { class: 'small fl-status', role: 'status', 'aria-live': 'polite' });
        S.pv = { pv, status, box: null };
        pv.addEventListener('click', (e) => { const t = e.target.closest('[data-f]'); if (t) goField(t.dataset.f); });
        return h('aside', { class: 'fl-side', 'aria-label': '紙面' }, pv, status,
          h('p', { class: 'small muted' }, '紙面の文字を押すと、そこを書きかえる欄に移ります。'));
      }
      // 絵の見本の色を、選んだ色に合わせる
      function rerenderPics() {
        const box = slot.querySelector('.fl-motifs'), pal = FT.palette(S.cur.palette);
        if (box) for (const [k, v] of [['--fm', pal.main], ['--fw', pal.wash], ['--fa', pal.accent], ['--fl', pal.light]]) box.style.setProperty(k, v);
      }
      async function refresh() {
        if (!alive || !S.cur || !S.pv) return;
        const f = S.cur;
        if (f.photo && !imgCache.has(f.photo)) await photoOf(f.photo);
        if (!S.pv) return;
        for (const it of [...pages]) if (S.pv.pv.contains(it.box)) pages.delete(it);
        Kit.clear(S.pv.pv);
        const box = thumb(f, 'pv');
        S.pv.pv.append(box);
        S.pv.box = box;
        if (S.qrMsg) S.qrMsg.textContent = qrOf(f.qr).err;
        if (S.title) S.title.textContent = titleOf(f);
        fitAll();
      }
      // 紙面を押したら、その所の欄へ
      function goField(key) {
        const map = { date: 'fl-in-date', motif: '.fl-sec-pic', photo: '.fl-sec-pic' };
        const sel = map[key] || 'fl-in-' + key;
        setPane('write');
        requestAnimationFrame(() => {
          const el = sel.startsWith('.') ? slot.querySelector(sel) : document.getElementById(sel);
          if (!el) return;
          el.scrollIntoView({ block: 'center', behavior: 'smooth' });
          if (/INPUT|TEXTAREA/.test(el.tagName)) el.focus({ preventScroll: true });
          const fl = el.closest('.field') || el;
          fl.classList.remove('fl-flash'); void fl.offsetWidth; fl.classList.add('fl-flash');
        });
      }

      /* ── カレンダーの予定から ── */
      async function fromCalendar() {
        const C = window.SenseiCalendar;
        const from = Kit.ymd(), to = Kit.ymd(Kit.addDays(Kit.today(), 120));
        const events = await Kit.store.list('events');
        const all = (C ? C.occurrences(events, from, to) : events.filter((e) => e.date >= from && e.date <= to).map((e) => Object.assign({}, e, { occ: e.date })))
          .sort((a, b) => (a.occ + (a.allDay ? '' : a.start || '')).localeCompare(b.occ + (b.allDay ? '' : b.start || '')));
        const CAT = C ? Object.fromEntries(C.CATS.map((c) => [c.id, c.label])) : {};
        const headCb = h('input', { type: 'checkbox', id: 'fl-ev-head' });
        const allCb = h('input', { type: 'checkbox', id: 'fl-ev-all' });
        const list = h('div', { class: 'fl-evs' });
        let m = null;
        const use = (e) => {
          const f = S.cur;
          Object.assign(f, FT.shiftDate(f, e.occ, Kit.ymd(), School.isOff), { endDate: '', start: e.allDay ? '' : e.start || '', end: e.allDay ? '' : e.end || '', eventId: e.id });
          if (e.place) f.place = e.place;
          if (headCb.checked && e.title) f.head = e.title;
          changed();
          if (m) m.close();
          rerender();
          Kit.toast('「' + e.title + '」の日時' + (e.place ? 'と場所' : '') + 'を入れました');
        };
        const draw = () => {
          Kit.clear(list);
          const show = all.filter((e) => allCb.checked || !['meeting', 'private'].includes(e.cat));
          if (!show.length) list.append(h('p', { class: 'small muted' }, 'これから4か月の予定がありません。カレンダーの道具で予定を入れると、ここから選べます。'));
          for (const e of show.slice(0, 80)) {
            list.append(h('button', { type: 'button', class: 'fl-ev', onclick: () => use(e) },
              h('span', { class: 'fl-ev-d' }, Kit.fmtDate(e.occ, 'M/D(W)')),
              h('span', { class: 'fl-ev-t' }, h('b', null, e.title), h('span', { class: 'small muted' }, [e.allDay || !e.start ? '終日' : e.start + '〜' + (e.end || ''), e.place, CAT[e.cat]].filter(Boolean).join('・')))));
          }
        };
        allCb.addEventListener('change', draw);
        draw();
        m = Kit.modal({
          title: 'カレンダーの予定から入れる',
          body: h('div', { class: 'stack' },
            h('p', { class: 'small muted' }, 'これから4か月の予定です。押すと、日時（と場所）が入ります。'),
            h('label', { class: 'check small fl-chk', for: 'fl-ev-head' }, headCb, '見出しも、予定の名前にする'),
            list,
            h('label', { class: 'check small fl-chk', for: 'fl-ev-all' }, allCb, '会議・個人の予定も出す')),
          actions: [{ label: 'やめる', kind: 'ghost' }],
        });
      }

      /* ── 印刷・写す・消す・開く ── */
      async function print() {
        const f = S.cur;
        if (!f) return;
        if (S.isNew) { S.isNew = false; save(); }
        await save.flush();
        if (S.fit && S.fit.over && !(await Kit.confirm({ title: '1枚に入りきっていません', body: '下のほうが切れて印刷されます。本文を短くするか、写真を外すと入ります。このまま印刷しますか？', ok: 'このまま印刷する' }))) return;
        const P = paperOf(f), fit = S.fit, photo = f.photo ? await photoOf(f.photo) : '', qr = qrOf(f.qr).url, x = Kit.clone(f);
        School.print({ size: P.w + 'mm ' + P.h + 'mm', margin: FT.MARGIN + 'mm', build: () => { const pg = pageEl(x, { photo, qr, print: true }); applyFit(pg, fit); return pg; } });
      }
      async function dup(x) {
        await save.flush();
        const o = norm(Kit.clone(x));
        delete o.sample; delete o.createdAt; delete o.updatedAt;
        o.id = Kit.uid('fl');
        await Kit.store.put('flyers', o);
        await load();
        S.cur = norm(Kit.clone(S.list.find((y) => y.id === o.id) || o));
        S.isNew = false;
        await render();
        window.scrollTo(0, 0);
        Kit.toast('「' + titleOf(o) + '」を写しました。日時を変えて使えます');
      }
      async function remove(x) {
        if (!(await Kit.confirm({ title: '「' + titleOf(x) + '」を消しますか', body: '消したチラシは、元に戻せません。', ok: '消す', danger: true }))) return;
        await save.flush();
        await Kit.store.remove('flyers', x.id);
        if (x.photo) await dropPhoto(x.photo, x.id);
        if (S.cur && S.cur.id === x.id) S.cur = null;
        await load();
        await render();
        Kit.toast('消しました');
      }
      async function open(id) {
        await save.flush();
        const x = S.list.find((y) => y.id === id);
        if (!x) return;
        S.cur = norm(Kit.clone(x));
        S.isNew = false;
        await render();
        window.scrollTo(0, 0);
      }
      async function fromTemplate(id) {
        S.ctx = await ctxNow();
        S.cur = norm(Object.assign(FT.make(id, S.ctx), { id: Kit.uid('fl') }));
        S.isNew = true;                                  // 書きかえるまでは保存しない（見るだけなら一覧に残らない）
        await render();
        window.scrollTo(0, 0);
      }
      async function toList() {
        await save.flush();
        S.cur = null; S.isNew = false;
        await load();
        await render();
        window.scrollTo(0, 0);
      }

      await load();
      if (params && params.id && S.list.some((x) => x.id === params.id)) S.cur = norm(Kit.clone(S.list.find((x) => x.id === params.id)));
      else if (params && params.tpl && FT.get(params.tpl)) { S.cur = norm(Object.assign(FT.make(params.tpl, S.ctx), { id: Kit.uid('fl') })); S.isNew = true; }
      await render();
      const onFonts = () => { if (alive) fitAll(); };
      if (document.fonts) { document.fonts.addEventListener('loadingdone', onFonts); document.fonts.ready.then(onFonts); }
      return () => {
        alive = false;
        if (ro) ro.disconnect();
        preview.cancel();
        save.flush();
        if (document.fonts) document.fonts.removeEventListener('loadingdone', onFonts);
        window.removeEventListener('resize', onResize);
      };
    },
  });

  // ほかの道具・テストから
  window.SenseiFlyer = { pageEl, fitPage, applyFit, norm, qrOf, motifSvg };
})();

// 学級通信：題字（通信の名前・号・発行日）の下に、文章・予定表・箇条書き・囲み・写真・切り取りの返事を並べる。A4・B4 で印刷、Word（.docx）にも書き出せる
// テンプレート（紙面の型 10）と題字の型（11）は js/core/newsletter-templates.js（NLTemplates）。号をつくるときに選べて、あとから題字だけ・全体の型だけを切りかえられる
(function () {
  'use strict';
  const { h } = Kit;
  const L = window.Letters;
  const MM = 96 / 25.4; // 1mm の画面の大きさ（px）
  const PAPERS = { a4: { label: 'A4 たて', w: 210, h: 297 }, b4: { label: 'B4 たて', w: 257, h: 364 }, a4l: { label: 'A4 よこ', w: 297, h: 210 } };
  const MARGIN = 12, GAP = 7;
  const FONTS = L.FONTS;
  // テンプレートの部品。index.html で先に読んでいなければ、ここから読みこむ（読み終わるまで、道具を開くのを待つ）
  const NLT_READY = window.NLTemplates ? Promise.resolve(window.NLTemplates) : new Promise((res) => {
    const me = document.currentScript, src = me && me.src ? me.src.replace(/js\/apps\/newsletter\.js(\?.*)?$/, 'js/core/newsletter-templates.js') : 'js/core/newsletter-templates.js';
    const s = document.createElement('script');
    s.src = src; s.onload = () => res(window.NLTemplates || null); s.onerror = () => res(null);
    document.head.append(s);
  });
  const NLT = () => window.NLTemplates;
  const OLD_LOOKS = [{ value: 'line', label: 'すっきり' }, { value: 'bar', label: 'しっかり' }, { value: 'round', label: 'やわらか' }];
  const LOOKS = () => (NLT() ? NLT().LOOKS : OLD_LOOKS);
  const BLOCKS = [
    { type: 'text', label: '文章', icon: 'text' },
    { type: 'schedule', label: '予定表', icon: 'calendar' },
    { type: 'list', label: '箇条書き', icon: 'checks' },
    { type: 'box', label: '囲み', icon: 'layout' },
    { type: 'image', label: '写真・イラスト', icon: 'image' },
    { type: 'reply', label: '切り取りの返事', icon: 'scissors' },
  ];
  const BL = Object.fromEntries(BLOCKS.map((b) => [b.type, b]));
  const SIZES = { small: 0.4, half: 0.65, full: 1 };

  const addDays = (s, n) => Kit.ymd(Kit.addDays(s, n));
  const mondayOf = (s) => { const d = Kit.parseYmd(s); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return Kit.ymd(d); };
  const isWeekend = (s) => { const w = Kit.parseYmd(s).getDay(); return w === 0 || w === 6; };
  const md = (s) => Kit.fmtDate(s, 'M/D(W)');
  const lines = (s) => String(s || '').split('\n');
  const items = (s) => lines(s).map((t) => t.replace(/^\s*[・\-－●○]\s*/, '').trim()).filter(Boolean);
  const dateText = (x) => (x.era === 'seireki' ? L.seireki(x.date, { week: true }) : L.wareki(x.date, { week: true }));

  // ブロック
  const nb = (type, o) => Object.assign({ id: Kit.uid('b'), type },
    type === 'schedule' ? { head: '予定', col3: '持ち物・連絡', rows: [] } : type === 'image' ? { src: '', caption: '', size: 'half' }
      : type === 'reply' ? { head: '出欠票', body: '生徒氏名：\n出席　・　欠席　（どちらかに○をつけてください）\n保護者氏名：' } : { head: '', body: '' }, o || {});
  // base の次の週の月〜金（祝日は名前を入れておく）
  function weekRows(base) {
    const mon = addDays(mondayOf(base || Kit.ymd()), 7);
    return Array.from({ length: 5 }, (_, i) => { const d = addDays(mon, i), hol = School.holiday(d); return { date: d, text: hol ? '（' + hol + '）' : '', note: '' }; });
  }
  const month = (d) => Kit.parseYmd(d || Kit.ymd()).getMonth() + 1;

  // テンプレートの中身に入れる日付など（発行日 d から見て）
  const nthWeekday = (d, n) => { let x = d, k = 0; for (let g = 0; k < n && g < 400; g++) { x = addDays(x, 1); if (!isWeekend(x) && !School.holiday(x)) k++; } return x; };
  function tplCtx(d, o = {}) {
    return {
      month: month(d), jiko: L.jiko(month(d)), teacher: String(o.teacher || '').replace(/\s*先生$/, ''), cls: o.cls || '',
      at: (n) => nthWeekday(d, n), day: (n) => Kit.fmtDate(nthWeekday(d, n), 'M月D日(W)'),
      week: (k = 1) => weekRows(addDays(d, 7 * (k - 1))),
    };
  }
  const tplBlocks = (t, d, o) => NLT().blocksOf(t, tplCtx(d, o)).map((b) => nb(b.type, b));

  function norm(x) {
    const o = Object.assign({ name: '学級通信', catch: '', no: 1, date: Kit.ymd(), school: '', from: '', paper: 'a4', cols: 1, look: 'line', banner: '', accent: 'k', tpl: '', font: 'goth', era: 'wareki', blocks: [] }, x || {});
    if (!PAPERS[o.paper]) o.paper = 'a4';
    o.cols = +o.cols === 2 ? 2 : 1;
    if (!LOOKS().some((l) => l.value === o.look)) o.look = 'line';
    // 題字の型がない号（前からある号）は、見出しと同じ名前の題字（すっきり／しっかり／やわらか）＝前と同じ見た目
    const NL = NLT();
    if (!NL || !NL.BANNER_MAP[o.banner]) o.banner = ['line', 'bar', 'round'].includes(o.look) ? o.look : 'line';
    if (!NL || !NL.ACCENT_MAP[o.accent]) o.accent = 'k';
    if (!NL || !NL.TEMPLATE_MAP[o.tpl]) o.tpl = '';
    if (!FONTS[o.font]) o.font = 'goth';
    o.no = Math.max(1, parseInt(o.no, 10) || 1);
    o.blocks = (o.blocks || []).filter((b) => b && BL[b.type]);
    for (const b of o.blocks) if (b.type === 'schedule' && !Array.isArray(b.rows)) b.rows = [];
    return o;
  }

  // サンプル（架空のクラス）：第12号
  const SC = School.SAMPLE_CLASS;
  const sRows = weekRows(Kit.ymd());
  [['委員会（放課後）', ''], ['避難訓練（3校時）', '上ばきをそろえておく'], ['テスト前の学習会（放課後）', '数学ワーク'], ['中間テスト（1日目）\n国語・数学・理科', '提出：数学ワーク'], ['中間テスト（2日目）\n社会・英語', '午前中で下校']]
    .forEach(([t, n], i) => { if (!sRows[i].text) Object.assign(sRows[i], { text: t, note: n }); });
  Kit.store.sample('newsletters', [{
    id: 'nl-' + SC.id + '-12', classId: SC.id, name: 'かけはし', catch: '学級目標：やさしく、まっすぐ、おもしろく', no: 12, date: Kit.ymd(),
    school: 'ひかり中学校（架空）', from: '2年3組 担任 かず先生', paper: 'a4', cols: 2, look: 'line', font: 'goth', era: 'wareki',
    blocks: [
      nb('text', { id: 'nl-sb1', head: '体育祭、おつかれさまでした', body: L.jiko(month()).soft + '。\n先日の体育祭では、温かいご声援をありがとうございました。\n学級リレーは4位でしたが、バトンを落とした仲間に「だいじょうぶ！」と声がかかり、最後まで全員で走りきりました。練習でうまくいかなかった日に、自分たちで話し合って走る順番を決め直したのも、このクラスの力です。' }),
      nb('schedule', { id: 'nl-sb2', head: '来週の予定', rows: sRows }),
      nb('list', { id: 'nl-sb3', head: 'お知らせ・お願い', body: 'テストの1週間前から、部活動はお休みになります。\n朝晩が冷えてきました。上着の準備をお願いします。\n欠席・遅刻の連絡は、朝8時までに連絡アプリでお願いします。' }),
      nb('box', { id: 'nl-sb4', head: '三者面談のお知らせ', body: '11月の中ごろに、三者面談を行います。\n日程の希望票は、来週配ります。' }),
    ],
  }]);
  // 使っていない写真を消す（ほかの号が同じ写真を使っていれば残す）
  async function dropImage(ref, exceptId) {
    if (!ref || !String(ref).startsWith('img:')) return;
    const all = await Kit.store.list('newsletters');
    if (all.some((x) => x.id !== exceptId && (x.blocks || []).some((b) => b.src === ref))) return;
    await Kit.store.remove('images', String(ref).slice(4));
  }
  async function dropIssue(x) {
    for (const b of x.blocks || []) if (b.src) await dropImage(b.src, x.id);
    await Kit.store.remove('newsletters', x.id);
  }
  School.classes.onRemove(async (classId) => { for (const x of await Kit.store.list('newsletters')) if (x.classId === classId) await dropIssue(x); });

  Kit.css('newsletter', `
.nl-list{display:grid;gap:10px;grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr))}
.nl-card{display:grid;gap:8px;padding:12px 14px;border:1px solid var(--line);border-radius:var(--r);background:var(--surface)}
.nl-card-main{display:grid;gap:2px;text-align:left;border:0;background:transparent;padding:0;font:inherit;color:var(--ink);cursor:pointer}
.nl-card-t{font-weight:700;font-size:16px}
.nl-card-d{font-size:12.5px;color:var(--ink-3)}
.nl-card-s{font-size:13px;color:var(--ink-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nl-bar{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;margin-bottom:12px}
.nl-bar-t{font-size:16px;margin-right:auto}
.nl-pane-seg{margin-bottom:12px}
.nl-edit{display:grid;gap:16px;grid-template-columns:minmax(0,1fr)}
@media (min-width:1100px){.nl-edit{grid-template-columns:minmax(0,1fr) minmax(360px,.95fr);align-items:start}.nl-pane-seg{display:none}.nl-side{position:sticky;top:12px}}
@media (max-width:1099px){.nl-edit[data-pane="write"] .nl-side,.nl-edit[data-pane="look"] .nl-ed{display:none}}
.nl-sec{font-size:15px;font-weight:700}
.nl-grid2{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(min(100%,200px),1fr))}
.nl-grid3{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(min(100%,130px),1fr));align-items:end}
.nl-look summary{cursor:pointer;font-weight:700;font-size:14px}
.nl-look .dt-row{margin-top:10px}
.nl-opt{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;margin-top:10px}
.nl-opt>span{font-size:13px;color:var(--ink-2);min-width:4.5em}
.nl-be{display:grid;gap:8px}
.nl-be-h{display:flex;align-items:center;gap:6px}
.nl-be-h .sp{flex:1}
.nl-be-ic{width:28px;height:28px;border-radius:7px;display:grid;place-items:center;background:var(--gosu-wash);color:var(--gosu)}
.nl-be-ic svg{width:16px;height:16px}
.nl-be textarea{resize:vertical}
.nl-rows{display:grid;gap:6px}
.nl-row{display:grid;grid-template-columns:150px minmax(0,1.3fr) minmax(0,1fr) auto;gap:6px;align-items:start}
.nl-row textarea{min-height:38px;padding:6px 8px;resize:none;overflow:hidden}
.nl-row input[type=date]{min-height:38px}
.nl-row-h{font-size:12px;color:var(--ink-3);font-weight:700}
@media (max-width:640px){.nl-row{grid-template-columns:minmax(0,1fr) auto}.nl-row>textarea{grid-column:1/-1}.nl-row>.btn{grid-row:1;grid-column:2}.nl-row-h{display:none}}
.nl-add{display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:10px 12px;border:1px dashed var(--line-strong);border-radius:var(--r)}
.nl-img-row{display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap}
.nl-thumb{width:140px;min-height:90px;border-radius:8px;border:1px solid var(--line);display:grid;place-items:center;overflow:hidden;background:var(--surface-2)}
.nl-thumb img{display:block;width:100%;height:auto}
.nl-kata{display:grid;gap:12px}
.nl-kata-it{display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border:1px solid var(--line);border-radius:var(--r);cursor:pointer}
.nl-kata-it:has(input:checked){border-color:var(--gosu);background:var(--gosu-wash);box-shadow:0 0 0 1px var(--gosu)}
.nl-kata-it:has(input:focus-visible){outline:2px solid var(--focus);outline-offset:2px}
.nl-kata-it input{margin-top:4px}
.nl-kata-sec{font-size:13px;font-weight:700;color:var(--ink-2);margin:2px 0 -4px}
/* テンプレート・題字を選ぶ（見本の小さな絵つき） */
.nl-tp-grid{display:grid;gap:10px;grid-template-columns:repeat(auto-fill,minmax(148px,1fr))}
.nl-tp-grid.mast{grid-template-columns:repeat(auto-fill,minmax(min(100%,232px),1fr))}
.nl-tp{position:relative;flex-direction:column;gap:6px;padding:8px;align-items:stretch}
.nl-tp input{position:absolute;opacity:0;width:1px;height:1px;margin:0;pointer-events:none}
.nl-tp-t{display:grid;gap:1px;line-height:1.35}
.nl-tp-t b{font-size:14px}
.nl-tp-t span{font-size:12px;color:var(--ink-3)}
.nl-tp:has(input:checked) .nl-tp-t span{color:var(--ink-2)}
.nl-tp-now{position:absolute;top:4px;right:4px;z-index:2;font-size:12px;font-weight:700;padding:2px 8px;border-radius:99px;background:var(--gosu);color:var(--on-gosu)}
.nl-mini{display:block;position:relative;width:100%;overflow:hidden;border-radius:4px;background:#fff;box-shadow:0 0 0 1px var(--line),0 1px 3px rgba(0,0,0,.12);pointer-events:none}
.nl-mini-s{display:block;position:absolute;top:0;left:0;transform-origin:0 0;background:#fff;box-sizing:border-box}
.nl-tp-note{margin:0}
.modal.nl-pick{scroll-padding:76px 0 84px}
.modal.nl-pick .modal-h{position:sticky;top:0;z-index:3;background:var(--surface);padding-bottom:10px;border-bottom:1px solid var(--line)}
.modal.nl-pick .modal-f{position:sticky;bottom:0;z-index:3;background:var(--surface);border-top:1px solid var(--line)}
/* デザインの欄（編集の画面） */
.nl-design{display:grid;gap:10px}
.nl-design-t{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 14px}
.nl-design-s{display:flex;flex-wrap:wrap;gap:2px 12px}
.nl-design-s span{white-space:nowrap}
.nl-design-s b{color:var(--ink)}
@media (min-width:1100px){.nl-design-pv{display:none}}
.nl-chips{display:grid;gap:6px;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));flex:1;min-width:min(100%,300px)}
.nl-chip{display:grid;gap:4px;padding:5px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--ink-2);font:inherit;font-size:12.5px;cursor:pointer;text-align:center;min-height:40px}
.nl-chip:hover{border-color:var(--line-strong)}
.nl-chip[aria-pressed="true"]{border-color:var(--gosu);background:var(--gosu-wash);color:var(--ink);font-weight:700;box-shadow:0 0 0 1px var(--gosu)}
.nl-chip .nl-mini{height:34px}
.nl-sw{display:inline-block;width:14px;height:14px;border-radius:50%;margin-right:2px;box-shadow:0 0 0 1px var(--line-strong);flex:none}
.nl-cats{display:flex;flex-wrap:wrap;gap:4px 14px;margin-top:6px}
.nl-pv{position:relative;overflow:hidden;border-radius:6px;background:var(--surface-2);border:1px solid var(--line)}
.nl-sheet{position:absolute;top:0;left:0;transform-origin:0 0;background:#fff;box-shadow:0 1px 6px rgba(0,0,0,.18);box-sizing:border-box}
.nl-end{position:absolute;left:0;right:0;border-top:3px dashed #c0392b;pointer-events:none}
.nl-end span{position:absolute;right:6mm;top:1mm;background:#c0392b;color:#fff;font-size:9pt;padding:.5mm 2mm;border-radius:2mm}
.nl-status{margin:8px 0}
.nl-status.bad{color:var(--bad)}
/* 紙面（画面の見た目と印刷で同じ） */
.nl-page{color:#000;background:#fff;font-size:10.5pt;line-height:1.6;text-align:left;line-break:strict;overflow-wrap:anywhere}
.nl-page *{box-sizing:border-box}
.nl-mast{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2mm 6mm;align-items:end;margin-bottom:4mm}
.nl-name{font-size:28pt;font-weight:700;line-height:1.15;letter-spacing:.06em}
.nl-catch{font-size:10pt;margin-top:1mm}
.nl-mast-r{text-align:right;font-size:9.5pt;line-height:1.45}
.nl-no{font-size:12pt;font-weight:700}
.nl-body.c2{columns:2;column-gap:7mm;column-rule:.5pt solid #888}
.nl-blk{margin:0 0 4mm}
.nl-h{font-size:12.5pt;font-weight:700;line-height:1.35;margin:0 0 1.5mm;break-after:avoid}
.k-line .nl-h{border-bottom:1pt solid var(--ac,#000);padding-bottom:.6mm}
.k-bar .nl-h{border-left:2.4mm solid var(--ac,#000);padding-left:2mm}
.k-round .nl-h{display:inline-block;border:1pt solid var(--ac,#000);border-radius:99px;padding:.2mm 3.5mm}
.nl-txt p{margin:0}
.nl-txt p.gap{height:.7em}
.nl-boxed{border:1pt solid var(--ac,#000);padding:2.5mm 3.5mm;break-inside:avoid}
.k-bar .nl-boxed{border-width:1.6pt}
.k-round .nl-boxed{border-style:dashed;border-radius:4mm}
.nl-boxed .nl-h{border:0;padding:0;display:block}
.nl-ul{margin:0;padding:0;list-style:none}
.nl-ul li{padding-left:1em;text-indent:-1em}
.nl-ul li::before{content:'・'}
.nl-tbl{width:100%;border-collapse:collapse;font-size:9.5pt;line-height:1.4;break-inside:avoid}
.nl-tbl th,.nl-tbl td{border:.6pt solid #000;padding:1mm 1.5mm;vertical-align:middle;white-space:pre-line}
.nl-tbl th{background:#e8e8e8;font-weight:700;text-align:center;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.nl-tbl td.d{white-space:nowrap;text-align:center}
.nl-fig{text-align:center;break-inside:avoid}
.nl-fig img{display:block;margin:0 auto;max-width:100%;height:auto}
.nl-fig figcaption{font-size:9pt;margin-top:1mm}
.nl-fig.ph{border:1pt dashed #999;padding:8mm 2mm;color:#888;font-size:9pt}
`);
  // 題字・見出しの飾り（テンプレートの部品から）
  NLT_READY.then((NL) => { if (NL) Kit.css('newsletter-tpl', NL.CSS); });

  // 紙面をつくる（画面の見た目と印刷で同じものを使う）
  function blockEl(b, imgs, o, x) {
    const orn = b.head && NLT() ? NLT().headOrn(x.look, x.accent) : '';
    const head = b.head ? h('h2', { class: 'nl-h' }, orn ? h('span', { class: 'nl-ho', 'aria-hidden': 'true', html: orn }) : null, b.head) : null;
    if (b.type === 'text' || b.type === 'box') {
      if (o.print && !b.head && !String(b.body || '').trim()) return null;
      return h('section', { class: 'nl-blk' + (b.type === 'box' ? ' nl-boxed' : '') }, head, h('div', { class: 'nl-txt' }, lines(String(b.body || '').replace(/\s+$/, '')).map((t) => (t.trim() ? h('p', null, t) : h('p', { class: 'gap' })))));
    }
    if (b.type === 'list') return h('section', { class: 'nl-blk' }, head, h('ul', { class: 'nl-ul' }, items(b.body).map((t) => h('li', null, t))));
    if (b.type === 'schedule') {
      return h('section', { class: 'nl-blk' }, head, h('table', { class: 'nl-tbl' },
        h('thead', null, h('tr', null, h('th', { style: { width: '18%' } }, '日'), h('th', null, '予定'), h('th', { style: { width: '34%' } }, b.col3 || '持ち物・連絡'))),
        h('tbody', null, (b.rows || []).map((r) => h('tr', null, h('td', { class: 'd' }, r.date ? md(r.date) : ''), h('td', null, r.text || ''), h('td', null, r.note || ''))))));
    }
    if (b.type === 'image') {
      const src = b.src ? imgs.get(b.src) : '';
      if (!src && o.print) return null;
      return h('figure', { class: 'nl-blk nl-fig' + (src ? '' : ' ph') }, src ? h('img', { src, alt: b.caption || '', style: { width: (SIZES[b.size] || SIZES.half) * 100 + '%' } }) : '写真・イラスト（選ぶと、ここに入ります）', b.caption ? h('figcaption', null, b.caption) : null);
    }
    if (b.type === 'reply') {
      const rows = NLT() ? NLT().replyLines(b.body) : [];
      if (o.print && !b.head && !rows.length) return null;
      return h('section', { class: 'nl-blk nl-reply' },
        h('div', { class: 'nl-cut', 'aria-hidden': 'true' }, h('span', { class: 'nl-ho', html: NLT() ? NLT().scissors('#000') : '' }), h('span', null, 'きりとり')),
        h('div', { class: 'nl-reply-in' }, b.head ? h('h2', { class: 'nl-h' }, b.head) : null,
          rows.map((r) => (r.field ? h('div', { class: 'nl-fld' }, h('span', null, r.text), h('i')) : h('p', null, r.text)))));
    }
    return null;
  }
  function pageEl(x, imgs, o = {}) {
    const NL = NLT();
    const page = h('div', { class: 'nl-page k-' + x.look + ' ac-' + (x.accent || 'k'), style: { fontFamily: FONTS[x.font].css } });
    const P = PAPERS[x.paper] || PAPERS.a4;
    page.append(NL ? NL.mast(x, { h, date: dateText(x), w: P.w - MARGIN * 2 }) : h('header', { class: 'nl-mast b-line' },
      h('div', null, h('div', { class: 'nl-name' }, x.name || '　'), x.catch ? h('div', { class: 'nl-catch' }, x.catch) : null),
      h('div', { class: 'nl-mast-r' }, h('div', { class: 'nl-no' }, '第' + x.no + '号'), h('div', null, dateText(x)), x.school ? h('div', null, x.school) : null, x.from ? h('div', null, x.from) : null)));
    // 新しい飾りは、ブロックの間に区切り線を入れる
    const sep = NL && NL.hasSep(x.look), kids = [];
    for (const b of x.blocks) {
      const el = blockEl(b, imgs, o, x);
      if (!el) continue;
      if (sep && kids.length) kids.push(h('div', { class: 'nl-sep', 'aria-hidden': 'true' }));
      kids.push(el);
    }
    page.append(h('div', { class: 'nl-body' + (x.cols === 2 ? ' c2' : '') }, kids));
    return page;
  }
  // 縮めた見本（テンプレート・題字を選ぶところ）。mast：題字だけ。置いた場所の幅に合わせて縮める（fitMinis。それまでは wpx の幅で）
  function miniEl(x, imgs, wpx, o = {}) {
    const P = PAPERS[x.paper] || PAPERS.a4, pw = P.w * MM, k = wpx / pw;
    const box = h('span', { class: 'nl-mini' + (o.mast ? ' mast' : ''), 'aria-hidden': 'true', dataset: { pw: String(pw), ph: o.mast ? '' : String(P.h * MM) }, style: { height: Math.round((o.mast ? 40 : P.h) * MM * k) + 'px' } });
    const sheet = h('span', { class: 'nl-mini-s', style: { width: P.w + 'mm', padding: (o.mast ? '5mm ' : '') + MARGIN + 'mm', transform: 'scale(' + k + ')' } });
    sheet.append(pageEl(o.mast ? Object.assign({}, x, { blocks: [] }) : x, imgs));
    box.append(sheet);
    return box;
  }
  // 見本を、置いた場所の幅いっぱいに縮め直す（ダイアログ・欄に入れたあとで。題字だけの見本は高さも中身に合わせる）
  function fitMinis(root) {
    for (const box of root.querySelectorAll('.nl-mini[data-pw]')) {
      const s = box.firstChild, w = box.clientWidth, pw = +box.dataset.pw;
      if (!s || !w || !pw) continue;
      const k = w / pw;
      s.style.transform = 'scale(' + k + ')';
      box.style.height = Math.ceil((box.dataset.ph ? +box.dataset.ph : s.offsetHeight) * k) + 'px';
    }
  }
  // ダイアログを開いたあと：見本を合わせる（字体を読みこんだあとにも、もう一度）
  // 見本の多いダイアログは、見出しとボタンを上下に止める（スマホで下まで送らなくても「つくる」が押せる）
  const fitLater = (el) => { el.classList.add('nl-pick'); requestAnimationFrame(() => fitMinis(el)); if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => fitMinis(el)); };

  // 連絡アプリ・メールに貼る文
  function plainText(x) {
    const out = ['【' + x.name + '　第' + x.no + '号】' + dateText(x)];
    const who = [x.school, x.from].filter(Boolean).join('　');
    if (who) out.push(who);
    for (const b of x.blocks) {
      const part = [];
      if (b.head) part.push('■' + b.head);
      if (b.type === 'text' || b.type === 'box') part.push(String(b.body || '').trim());
      if (b.type === 'list') part.push(...items(b.body).map((t) => '・' + t));
      if (b.type === 'schedule') part.push(...(b.rows || []).filter((r) => r.text || r.note).map((r) => (r.date ? md(r.date) + '　' : '') + String(r.text || '').replace(/\n/g, '／') + (r.note ? '（' + (b.col3 || '持ち物・連絡') + '：' + String(r.note).replace(/\n/g, '／') + '）' : '')));
      if (b.type === 'image' && b.caption) part.push('（写真：' + b.caption + '）');
      if (b.type === 'reply') part.push(...String(b.body || '').split('\n').map((t) => t.trim()).filter(Boolean).map((t) => (/[：:]$/.test(t) ? t + '＿＿＿＿＿＿' : t)));
      const t = part.filter(Boolean).join('\n');
      if (t) out.push('', t);
    }
    return out.join('\n');
  }

  // Word（.docx）の中身
  async function imgBytes(ref) {
    const url = await Kit.img.resolve(ref);
    if (!url) return null;
    const im = await new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = url; });
    if (!im) return null;
    let x = window.Docx.fromDataUrl(url);
    if (!x) { // webp・svg などは png に描き直す（Word は webp を読めない）
      const c = h('canvas', { width: im.naturalWidth || 800, height: im.naturalHeight || 600 }), g = c.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(im, 0, 0, c.width, c.height);
      x = window.Docx.fromDataUrl(c.toDataURL('image/png'));
    }
    return x && Object.assign(x, { ratio: (im.naturalHeight || 3) / (im.naturalWidth || 4) });
  }
  // 題字・見出し・囲みの形は NLTemplates（もとからある3つの形は、前と同じ Word になる）。崩れやすい飾り（模様・花・リボンの形）は、線・地の色・記号に置きかえる
  async function docxOf(x0) {
    const NL = (await NLT_READY) || NLT();
    const x = norm(Kit.clone(x0));
    const P = PAPERS[x.paper], F = FONTS[x.font];
    const st = NL.docxStyle(x.look, x.accent);
    const txt = (s) => lines(String(s || '').replace(/\s+$/, '')).map((t) => ({ p: t, line: 1.3 }));
    const gap = { p: '', line: 0.6 };
    const head = NL.docxHead(x, { date: dateText(x), fonts: { goth: FONTS.goth.word, mincho: FONTS.mincho.word, hand: FONTS.hand.word }, w: P.w - MARGIN * 2 });
    const body = [];
    for (const b of x.blocks) {
      const part = [];
      if (b.type === 'text') { if (!b.head && !String(b.body || '').trim()) continue; if (b.head) part.push(st.heading(b.head)); part.push(...txt(b.body), gap); }
      else if (b.type === 'box') part.push(st.box(b.head, txt(b.body)));
      else if (b.type === 'list') { if (b.head) part.push(st.heading(b.head)); part.push(...items(b.body).map((t) => st.item(t)), gap); }
      else if (b.type === 'schedule') {
        if (b.head) part.push(st.heading(b.head));
        part.push({ table: [['日', '予定', b.col3 || '持ち物・連絡'].map((t) => ({ p: t, size: 9.5, color: st.th.color }))].concat((b.rows || []).map((r) => [{ p: r.date ? md(r.date) : '', align: 'center', size: 9.5 }, { p: r.text || '', size: 9.5 }, { p: r.note || '', size: 9.5 }])), widths: [0.21, 0.45, 0.34], header: true, pad: 0.8, shade: st.th.shade });
      } else if (b.type === 'image' && b.src) {
        const im = await imgBytes(b.src);
        if (im) { part.push({ img: im.bytes, type: im.type, frac: SIZES[b.size] || SIZES.half, ratio: im.ratio, align: 'center' }); if (b.caption) part.push({ p: b.caption, align: 'center', size: 9, after: 4 }); }
      } else if (b.type === 'reply') part.push(...NL.docxReply(b));
      if (!part.length) continue;
      if (st.sep && body.length) body.push(Object.assign({}, st.sep, part[0].full ? { full: true } : null));
      body.push(...part);
    }
    return { title: x.name + ' 第' + x.no + '号', author: x.from, page: { w: P.w, h: P.h, margin: MARGIN, cols: x.cols, gap: GAP, sep: true }, font: F.word, latin: F.latin, size: 10.5, head, body };
  }

  Kit.app({
    id: 'newsletter', title: '学級通信', group: 'write', icon: 'news', order: 60,
    desc: '題字・文章・予定表・お知らせを並べて、A4・B4 で印刷。Word にも書き出せる',
    colls: ['newsletters'],
    async mount(root, params) {
      await NLT_READY;
      const S = { cls: null, list: [], cur: null, pane: Kit.pref.get('newsletter:pane', 'write'), imgs: new Map(), profile: null, pv: null, lookOpen: false };
      let alive = true;
      const classSlot = h('div'), sampleSlot = h('div'), main = h('div');
      root.append(Kit.appHead({
        title: '学級通信',
        desc: '題字・文章・予定表・写真を並べて、A4・B4 で印刷します。',
        actions: [Kit.btn('新しい号をつくる', () => newIssue(), { kind: 'primary', icon: 'plus' })],
      }), classSlot, sampleSlot, main);
      const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => fit()) : null;

      async function load() {
        S.profile = await Kit.profile.get();
        S.cls = await School.classes.current();
        const all = await Kit.store.list('newsletters');
        S.list = all.filter((x) => !x.classId || !S.cls || x.classId === S.cls.id).map(norm)
          .sort((a, b) => String(b.date).localeCompare(String(a.date)) || b.no - a.no);
      }
      const save = Kit.debounce(() => {
        if (!S.cur) return;
        const it = Kit.clone(S.cur);
        delete it.sample;
        S.cur.sample = false;
        return Kit.store.put('newsletters', it);
      }, 400);
      const preview = Kit.debounce(() => refresh(), 220);
      const changed = () => { save(); preview(); };
      const defaultFrom = () => { const t = String(S.profile.teacher || '').replace(/\s*先生$/, ''); return [S.cls ? S.cls.name : '', t ? '担任 ' + t : ''].filter(Boolean).join(' '); };
      const maxNo = (name) => Math.max(0, ...S.list.filter((x) => x.name === name).map((x) => x.no));

      async function render() {
        Kit.clear(classSlot); Kit.clear(sampleSlot); Kit.clear(main);
        S.pv = null; S.updDesign = null;
        if (ro) ro.disconnect();
        classSlot.append(await School.classBar({ onChange: async () => { await save.flush(); S.cur = null; await load(); render(); } }));
        if (S.cur) renderEdit(); else renderList();
      }

      /* ── 一覧 ── */
      function renderList() {
        if (S.list.some((x) => x.sample)) sampleSlot.append(Kit.sampleBar('架空のクラスの通信（第12号）です。開いて書きかえたり、「次の号」で続きをつくったりできます。'));
        if (!S.list.length) {
          main.append(Kit.empty({ title: 'まだ通信がありません', body: '「新しい号をつくる」から始めます。2号目からは、前の号を写して、すぐにつくれます。', actions: [Kit.btn('新しい号をつくる', () => newIssue(), { kind: 'primary', icon: 'plus' })] }));
        } else {
          main.append(h('div', { class: 'nl-list' }, S.list.map((x) => h('article', { class: 'nl-card' },
            h('button', { type: 'button', class: 'nl-card-main', onclick: () => open(x.id) },
              h('span', { class: 'nl-card-t' }, x.name + '　第' + x.no + '号'),
              h('span', { class: 'nl-card-d' }, dateText(x) + '・' + PAPERS[x.paper].label + (x.cols === 2 ? '・2段' : '')),
              h('span', { class: 'nl-card-s' }, x.blocks.map((b) => b.head || BL[b.type].label).slice(0, 4).join('／') || '（まだ中身がありません）')),
            h('div', { class: 'btn-row' },
              Kit.btn('開く', () => open(x.id), { sm: true, icon: 'edit' }),
              Kit.btn('次の号', () => nextIssue(x), { sm: true, icon: 'copy', kind: 'ghost', title: 'この号を写して、次の号をつくる' }),
              Kit.btn('', () => removeIssue(x), { sm: true, icon: 'trash', kind: 'ghost', title: '第' + x.no + '号を消す' }))))));
        }
        main.append(h('details', { class: 'help', style: { marginTop: '18px' } }, h('summary', null, 'ほかの道具とのつながり・気をつけること'),
          h('ul', { style: { paddingLeft: '1.2em', margin: '8px 0 0' } },
            h('li', null, '予定表は「カレンダーから入れる」で、行事・テストなどを日ごとに入れられます（会議・個人の予定は、はじめは入れません）。'),
            h('li', null, '箇条書きは「宿題・提出物から足す」で、宿題・提出の道具に出している宿題を入れられます。'),
            h('li', null, 'Word に書き出すと、学校の決まった様式に写したり、管理職に見てもらったりするときに便利です。'),
            h('li', null, '写真は、このブラウザに小さくして保存します。生徒が写った写真は、学校の決まり（掲載の同意など）を確かめてから使ってください。'))));
      }

      /* ── 編集 ── */
      function renderEdit() {
        const x = S.cur;
        if (x.sample) sampleSlot.append(Kit.sampleBar('架空のクラスの通信です。そのまま書きかえて試せます。'));
        const title = h('b', { class: 'nl-bar-t' });
        const setTitle = () => { title.textContent = (x.name || '学級通信') + '　第' + x.no + '号'; };
        setTitle();
        S.setTitle = setTitle;
        main.append(h('div', { class: 'nl-bar' },
          Kit.btn('一覧', async () => { await save.flush(); S.cur = null; await load(); render(); }, { icon: 'left', kind: 'ghost', sm: true }),
          title,
          h('div', { class: 'btn-row' },
            Kit.btn('印刷', print, { icon: 'printer', kind: 'primary', sm: true }),
            Kit.btn('Word に書き出す', word, { icon: 'download', sm: true }),
            Kit.btn('文章をコピー', () => Kit.copy(plainText(S.cur), '通信の文章をコピーしました（連絡アプリ・メールに貼れます）'), { icon: 'copy', sm: true, kind: 'ghost' }),
            Kit.btn('次の号', () => nextIssue(S.cur), { icon: 'plus', sm: true, kind: 'ghost', title: 'この号を写して、次の号をつくる' }))));
        const grid = h('div', { class: 'nl-edit', 'data-pane': S.pane });
        main.append(h('div', { class: 'nl-pane-seg' }, Kit.seg([{ value: 'write', label: 'つくる', icon: 'edit' }, { value: 'look', label: '見る', icon: 'eye' }], S.pane, (v) => { S.pane = v; Kit.pref.set('newsletter:pane', v); grid.dataset.pane = v; requestAnimationFrame(fit); }, { label: '表示の切り替え' })), grid);
        grid.append(editor(), side());
        refresh();
      }
      /* ── デザイン（テンプレート・題字） ── */
      function designCard() {
        const NL = NLT();
        const pv = h('div', { class: 'nl-design-pv' }), sum = h('div', { class: 'nl-design-s small ink-2' });
        S.updDesign = () => {
          const x = S.cur, t = NL.TEMPLATE_MAP[x.tpl], b = NL.BANNER_MAP[x.banner], l = NL.LOOK_MAP[x.look];
          Kit.clear(pv); Kit.clear(sum);
          pv.append(miniEl(x, S.imgs, 300, { mast: true }));
          requestAnimationFrame(() => fitMinis(pv));
          sum.append(t ? h('span', null, 'テンプレート：', h('b', null, t.label)) : null, h('span', null, '題字：', h('b', null, b.label)), h('span', null, '見出し：', h('b', null, l ? l.label : '')));
        };
        S.updDesign();
        return h('section', { class: 'card nl-design', 'aria-label': 'デザイン' },
          h('div', { class: 'nl-design-t' }, h('h2', { class: 'nl-sec' }, 'デザイン'), sum), pv,
          h('div', { class: 'btn-row' }, Kit.btn('テンプレートを変える', () => pickTemplate(), { sm: true, icon: 'layout' }), Kit.btn('題字を変える', () => pickBanner(), { sm: true, icon: 'wand' })));
      }
      // 見本つきの選択肢（ラジオ）。x は見本に描く号
      function tpCard(group, id, label, sub, x, o = {}) {
        const r = h('input', { type: 'radio', name: group, id: group + '-' + id, value: id, checked: !!o.checked });
        if (o.onPick) r.addEventListener('change', () => o.onPick(id));
        return h('label', { class: 'nl-kata-it nl-tp', for: group + '-' + id }, r,
          o.now ? h('span', { class: 'nl-tp-now' }, 'いま') : null,
          miniEl(x, S.imgs, o.mast ? 216 : 132, { mast: o.mast }),
          h('span', { class: 'nl-tp-t' }, h('b', null, label), sub ? h('span', null, sub) : null));
      }
      // 見た目を変えたあと：「元に戻す」つきで知らせる
      function restyled(msg, before) {
        changed(); rerender();
        Kit.toast(msg, { ms: 5000, action: { label: '元に戻す', onClick: () => { if (!S.cur) return; Object.assign(S.cur, before); changed(); rerender(); } } });
      }
      const LOOK_KEYS = ['tpl', 'banner', 'look', 'cols', 'font'];
      const pickOf = (o) => Object.fromEntries(LOOK_KEYS.map((k) => [k, o[k]]));
      async function pickTemplate() {
        const NL = NLT(), x = S.cur;
        let pick = '';
        const grid = h('div', { class: 'nl-tp-grid', role: 'radiogroup', 'aria-label': 'テンプレート' },
          NL.TEMPLATES.map((t) => tpCard('nl-tpc', t.id, t.label, t.scene + '・' + t.mood, NL.applyTemplate(x, t.id), { now: t.id === x.tpl, onPick: (v) => { pick = v; } })));
        const ok = await new Promise((res) => fitLater(Kit.modal({
          title: 'テンプレートを変える', wide: true, onClose: (v) => res(v === true),
          body: h('div', { class: 'stack' }, h('p', { class: 'small ink-2 nl-tp-note' }, '書いた中身はそのままで、題字・見出しの飾り・段・字体が変わります。見本は、この号の中身で描いています。'), grid),
          actions: [{ label: 'やめる', kind: 'ghost', value: null }, { label: 'この型にする', kind: 'primary', onClick: () => (pick ? true : (Kit.toast('テンプレートを選んでください'), false)) }],
        }).el));
        if (!ok || !pick || !S.cur) return;
        const before = pickOf(S.cur);
        Object.assign(S.cur, pickOf(NL.applyTemplate(S.cur, pick)));
        restyled('見た目を「' + NL.TEMPLATE_MAP[pick].label + '」にしました（中身はそのまま）', before);
      }
      async function pickBanner() {
        const NL = NLT(), x = S.cur;
        let pick = x.banner;
        const grid = h('div', { class: 'nl-tp-grid mast', role: 'radiogroup', 'aria-label': '題字の型' },
          NL.BANNERS.map((b) => tpCard('nl-bnc', b.id, b.label, b.desc, NL.applyBanner(x, b.id), { mast: true, checked: b.id === x.banner, now: b.id === x.banner, onPick: (v) => { pick = v; } })));
        let done = null;
        const closed = new Promise((res) => { done = res; });
        const m = Kit.modal({
          title: '題字を変える', wide: true, onClose: (v) => done(v === true),
          body: h('div', { class: 'stack' }, h('p', { class: 'small ink-2 nl-tp-note' }, '題字だけが変わります。見出し・中身はそのままです。'), grid),
          actions: [{ label: 'やめる', kind: 'ghost', value: null }, { label: 'この題字にする', kind: 'primary', value: true }],
        });
        fitLater(m.el);
        const ok = await closed;
        if (!ok || !S.cur || pick === S.cur.banner) return;
        const before = pickOf(S.cur);
        S.cur.banner = pick;
        restyled('題字を「' + NL.BANNER_MAP[pick].label + '」にしました', before);
      }

      function editor() {
        const x = S.cur;
        const inp = (key, label, attrs) => {
          const el = h('input', Object.assign({ type: 'text' }, attrs || {}));
          el.value = x[key] == null ? '' : x[key];
          el.addEventListener('input', () => {
            if (key === 'no') x.no = Math.max(1, parseInt(el.value, 10) || 1);
            else if (key === 'date') { if (!el.value) return; x.date = el.value; }
            else x[key] = el.value;
            changed();
            if (key === 'name' || key === 'no') S.setTitle();
          });
          return Kit.field({ label, input: el, id: 'nl-' + key });
        };
        const NL = NLT();
        const opt = (label, seg) => h('div', { class: 'nl-opt' }, h('span', null, label), seg);
        const seg = (list, key, label, then) => Kit.seg(list, x[key], (v) => { x[key] = key === 'cols' ? +v : v; changed(); if (then) then(v); }, { label });
        // 見出し・囲みの飾り：見本つきのボタン
        const chips = h('div', { class: 'nl-chips', role: 'group', 'aria-label': '見出し・囲みの飾り' });
        const drawChips = () => {
          Kit.clear(chips);
          for (const l of NL.LOOKS) {
            const orn = NL.headOrn(l.value, x.accent);
            const pv = h('span', { class: 'nl-mini', 'aria-hidden': 'true' }, h('span', { class: 'nl-mini-s', style: { width: '44mm', padding: '2.6mm 3mm', transform: 'scale(.55)' } },
              h('div', { class: 'nl-page k-' + l.value + ' ac-' + x.accent, style: { fontFamily: FONTS[x.font].css } }, h('h2', { class: 'nl-h', style: { margin: 0 } }, orn ? h('span', { class: 'nl-ho', html: orn }) : null, '見出し'))));
            chips.append(h('button', { type: 'button', class: 'nl-chip', 'aria-pressed': String(x.look === l.value), 'data-v': l.value, onclick: () => { x.look = l.value; changed(); for (const c of chips.children) c.setAttribute('aria-pressed', String(c.dataset.v === l.value)); } }, pv, l.label));
          }
        };
        drawChips();
        const acSeg = seg(NL.ACCENTS.map((a) => ({ value: a.id, label: a.label })), 'accent', '飾りの色', () => drawChips());
        for (const b of acSeg.children) { const a = NL.ACCENT_MAP[b.dataset.v]; if (a) b.prepend(h('i', { class: 'nl-sw', style: { background: a.ac } })); }
        const looks = h('details', { class: 'nl-look', open: S.lookOpen }, h('summary', null, '紙・段・見た目'),
          opt('紙', seg(Object.entries(PAPERS).map(([k, p]) => ({ value: k, label: p.label })), 'paper', '紙')),
          opt('段', seg([{ value: 1, label: '1段' }, { value: 2, label: '2段' }], 'cols', '段')),
          opt('見出し・囲み', chips),
          opt('飾りの色', acSeg),
          opt('字体', seg(Object.entries(FONTS).map(([k, f]) => ({ value: k, label: f.label })), 'font', '字体', () => drawChips())),
          h('p', { class: 'small muted', style: { marginTop: '8px' } }, '色は飾りの線と地だけに使います（文字は黒）。白黒の印刷機で刷っても、線の形と模様で見分けられます。'));
        looks.addEventListener('toggle', () => { S.lookOpen = looks.open; });
        const ed = h('div', { class: 'nl-ed stack' });
        ed.append(designCard());
        ed.append(h('section', { class: 'card stack', 'aria-label': '題字' },
          h('h2', { class: 'nl-sec' }, '題字（通信の名前・号・日付）'),
          h('div', { class: 'nl-grid2' }, inp('name', '通信の名前', { maxlength: 20, placeholder: '例：かけはし' }), inp('catch', 'そえる言葉', { maxlength: 40, placeholder: '例：学級目標・今月のめあて' })),
          h('div', { class: 'nl-grid3' }, inp('no', '号', { type: 'number', min: 1, max: 999 }), inp('date', '発行日', { type: 'date' }),
            h('div', { class: 'field' }, h('span', { class: 'small ink-2' }, '日付の書き方'), seg([{ value: 'wareki', label: '和暦' }, { value: 'seireki', label: '西暦' }], 'era', '日付の書き方'))),
          h('div', { class: 'nl-grid2' }, inp('school', '学校名', { maxlength: 40 }), inp('from', '発行（クラス・担任）', { maxlength: 40, placeholder: defaultFrom() })),
          looks));
        x.blocks.forEach((b, i) => ed.append(blockEditor(b, i)));
        ed.append(h('div', { class: 'nl-add', role: 'group', 'aria-label': 'ブロックを足す' }, h('span', { class: 'small ink-2' }, '足す：'), BLOCKS.map((t) => Kit.btn(t.label, () => addBlock(t.type), { sm: true, icon: t.icon }))));
        return ed;
      }
      const grow = (t) => { t.style.height = 'auto'; t.style.height = t.scrollHeight + 2 + 'px'; };
      function blockEditor(b, i) {
        const x = S.cur, T = BL[b.type];
        const card = h('section', { class: 'card nl-be', id: 'nl-be-' + b.id, 'aria-label': T.label + '（' + (i + 1) + '）' },
          h('div', { class: 'nl-be-h' }, h('span', { class: 'nl-be-ic' }, Kit.icon(T.icon)), h('b', null, T.label), h('span', { class: 'sp' }),
            Kit.btn('', () => move(i, -1), { icon: 'up', sm: true, kind: 'ghost', title: '上へ', disabled: i === 0 }),
            Kit.btn('', () => move(i, 1), { icon: 'down', sm: true, kind: 'ghost', title: '下へ', disabled: i === x.blocks.length - 1 }),
            Kit.btn('', () => removeBlock(i), { icon: 'trash', sm: true, kind: 'ghost', title: T.label + 'を消す' })));
        const headIn = () => { const el = h('input', { type: 'text', maxlength: 40, placeholder: '見出し（なくてもよい）', 'aria-label': '見出し' }); el.value = b.head || ''; el.addEventListener('input', () => { b.head = el.value; changed(); }); return el; };
        const area = (rows, ph, label) => { const el = h('textarea', { rows, placeholder: ph, 'aria-label': label }); el.value = b.body || ''; el.addEventListener('input', () => { b.body = el.value; changed(); }); return el; };
        if (b.type === 'text') card.append(headIn(), area(7, '本文（改行はそのまま。空の行は、すき間になります）', '本文'));
        else if (b.type === 'box') card.append(headIn(), area(4, '目立たせたいこと（日時・場所・持ち物など）', '囲みの中の文'));
        else if (b.type === 'list') card.append(headIn(), area(5, '1行に1つ（「・」は自動でつきます）', '箇条書き'), h('div', { class: 'btn-row' }, Kit.btn('宿題・提出物から足す', () => fromHomework(b), { sm: true, icon: 'clipboard', kind: 'ghost' })));
        else if (b.type === 'schedule') card.append(headIn(), scheduleEditor(b));
        else if (b.type === 'image') card.append(imageEditor(b));
        else if (b.type === 'reply') card.append(headIn(), area(4, '1行に1つ。「：」で終わる行は、書きこむ線になります', '返事の票の中身'), h('p', { class: 'small muted' }, '紙面では、上に「きりとり」の線が入ります。2段のときも、全部の幅に入ります。'));
        return card;
      }
      function scheduleEditor(b) {
        const tbl = h('div', { class: 'nl-rows' });
        const draw = () => {
          Kit.clear(tbl);
          tbl.append(h('div', { class: 'nl-row nl-row-h', 'aria-hidden': 'true' }, h('span', null, '日付'), h('span', null, '予定'), h('span', null, b.col3 || '持ち物・連絡'), h('span')));
          b.rows.forEach((r, ri) => {
            const d = h('input', { type: 'date', 'aria-label': (ri + 1) + '行目の日付' });
            d.value = r.date || '';
            d.addEventListener('change', () => { r.date = d.value; changed(); });
            const t = h('textarea', { rows: 1, placeholder: '予定', 'aria-label': (ri + 1) + '行目の予定' });
            t.value = r.text || '';
            t.addEventListener('input', () => { r.text = t.value; grow(t); changed(); });
            const n = h('textarea', { rows: 1, placeholder: b.col3 || '持ち物・連絡', 'aria-label': (ri + 1) + '行目の' + (b.col3 || '持ち物・連絡') });
            n.value = r.note || '';
            n.addEventListener('input', () => { r.note = n.value; grow(n); changed(); });
            tbl.append(h('div', { class: 'nl-row' }, d, t, n, Kit.btn('', () => { b.rows.splice(ri, 1); changed(); draw(); }, { icon: 'close', sm: true, kind: 'ghost', title: (ri + 1) + '行目を消す' })));
            requestAnimationFrame(() => { grow(t); grow(n); });
          });
          if (!b.rows.length) tbl.append(h('p', { class: 'small muted' }, 'まだ行がありません。「カレンダーから入れる」か「行を足す」で。'));
        };
        draw();
        const col3 = h('input', { type: 'text', id: 'nl-col3-' + b.id, maxlength: 12, style: { width: '9em' } });
        col3.value = b.col3 || '持ち物・連絡';
        col3.addEventListener('input', () => { b.col3 = col3.value; changed(); });
        return h('div', { class: 'stack tight' }, tbl, h('div', { class: 'btn-row' },
          Kit.btn('カレンダーから入れる', () => importSchedule(b, draw), { sm: true, icon: 'calendar' }),
          Kit.btn('行を足す', () => { const last = b.rows[b.rows.length - 1]; b.rows.push({ date: last && last.date ? addDays(last.date, 1) : Kit.ymd(), text: '', note: '' }); changed(); draw(); }, { sm: true, icon: 'plus', kind: 'ghost' }),
          h('span', { class: 'dt-row', style: { display: 'inline-flex', gap: '6px', alignItems: 'center' } }, h('label', { for: 'nl-col3-' + b.id, class: 'small ink-2' }, '3つ目の列'), col3)));
      }
      function imageEditor(b) {
        const thumb = h('div', { class: 'nl-thumb' });
        const show = async () => {
          const src = b.src ? S.imgs.get(b.src) || (await Kit.img.resolve(b.src)) : '';
          if (src) S.imgs.set(b.src, src);
          Kit.clear(thumb);
          thumb.append(src ? h('img', { src, alt: '' }) : h('span', { class: 'small muted' }, 'まだ選んでいません'));
        };
        show();
        const pickBtn = Kit.btn(b.src ? '写真を変える' : '写真を選ぶ', async () => {
          const f = await Kit.img.pick('image/*');
          if (!f) return;
          try {
            const it = await Kit.img.save(f, { max: 1400, maxBytes: 220000 });
            const old = b.src;
            b.src = 'img:' + it.id;
            S.imgs.set(b.src, it.dataUrl);
            if (old) { await save.flush(); await dropImage(old); }
            changed(); show();
          } catch (e) { Kit.toast((e && e.message) || '写真を入れられませんでした', { type: 'bad' }); }
        }, { sm: true, icon: 'image' });
        const cap = h('input', { type: 'text', maxlength: 60, placeholder: '写真の説明（なくてもよい）', 'aria-label': '写真の説明' });
        cap.value = b.caption || '';
        cap.addEventListener('input', () => { b.caption = cap.value; changed(); });
        return h('div', { class: 'stack tight' },
          h('div', { class: 'nl-img-row' }, thumb, h('div', { class: 'stack tight' }, pickBtn,
            Kit.seg([{ value: 'small', label: '小' }, { value: 'half', label: '中' }, { value: 'full', label: '大' }], b.size || 'half', (v) => { b.size = v; changed(); }, { label: '写真の大きさ' }))),
          cap, h('p', { class: 'small muted' }, '生徒が写った写真は、学校の決まり（掲載の同意など）を確かめてから使ってください。'));
      }
      async function addBlock(type) {
        const b = nb(type, type === 'schedule' ? { head: '来週の予定', rows: weekRows(S.cur.date) } : type === 'list' ? { head: 'お知らせ' } : null);
        S.cur.blocks.push(b);
        changed();
        rerender();
        setTimeout(() => { const el = document.getElementById('nl-be-' + b.id); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); const f = el.querySelector('input, textarea'); if (f) f.focus({ preventScroll: true }); } }, 60);
      }
      function move(i, d) { const bs = S.cur.blocks, j = i + d; if (j < 0 || j >= bs.length) return; [bs[i], bs[j]] = [bs[j], bs[i]]; changed(); rerender(); }
      async function removeBlock(i) {
        const b = S.cur.blocks[i];
        const has = b.head || String(b.body || '').trim() || (b.rows || []).some((r) => r.text || r.note) || b.src;
        if (has && !(await Kit.confirm({ title: BL[b.type].label + 'を消しますか', body: '中に書いたものも消えます。', ok: '消す', danger: true }))) return;
        S.cur.blocks.splice(i, 1);
        changed();
        if (b.src) { await save.flush(); await dropImage(b.src); }
        rerender();
      }
      // 編集の画面だけ描き直す（スクロールの位置はそのまま）
      function rerender() {
        const y = window.scrollY, sc = document.querySelector('.mb-main'), st = sc ? sc.scrollTop : 0;
        Kit.clear(sampleSlot); Kit.clear(main);
        if (ro) ro.disconnect();
        renderEdit();
        window.scrollTo(0, y); if (sc) sc.scrollTop = st;
      }

      /* ── 見た目（縮めた紙） ── */
      function side() {
        const pv = h('div', { class: 'nl-pv' }), sheet = h('div', { class: 'nl-sheet' }), end = h('div', { class: 'nl-end', hidden: true }, h('span', null, '1枚目のおわり'));
        pv.append(sheet);
        const status = h('p', { class: 'small nl-status', role: 'status' });
        S.pv = { pv, sheet, end, status };
        if (ro) ro.observe(pv);
        return h('aside', { class: 'nl-side', 'aria-label': '紙面の見た目' }, pv, status,
          h('div', { class: 'btn-row' }, Kit.btn('印刷', print, { sm: true, icon: 'printer' }), Kit.btn('Word に書き出す', word, { sm: true, icon: 'download', kind: 'ghost' })));
      }
      async function refresh() {
        if (!alive || !S.pv || !S.cur) return;
        const x = S.cur, P = PAPERS[x.paper];
        for (const b of x.blocks) if (b.type === 'image' && b.src && !S.imgs.has(b.src)) S.imgs.set(b.src, await Kit.img.resolve(b.src));
        if (!S.pv) return;
        const { sheet, end } = S.pv;
        Kit.clear(sheet);
        Object.assign(sheet.style, { width: P.w + 'mm', minHeight: P.h + 'mm', padding: MARGIN + 'mm' });
        end.style.top = P.h + 'mm';
        sheet.append(pageEl(x, S.imgs), end);
        fit();
        if (S.updDesign) S.updDesign();
        for (const im of sheet.querySelectorAll('img')) if (!im.complete) im.addEventListener('load', fit, { once: true });
      }
      function fit() {
        if (!S.pv || !S.cur) return;
        const { pv, sheet, end, status } = S.pv, P = PAPERS[S.cur.paper];
        const W = pv.clientWidth;
        if (!W) return;
        const k = Math.min(1, W / (P.w * MM));
        sheet.style.transform = 'scale(' + k + ')';
        const page = sheet.querySelector('.nl-page');
        const full = (page ? page.offsetHeight : 0) + MARGIN * 2 * MM, pageH = P.h * MM;
        pv.style.height = Math.ceil(Math.max(full, pageH) * k) + 'px';
        const over = full > pageH + 1;
        end.hidden = !over;
        const x = S.cur, tips = ['文章を短くする'];
        if (x.blocks.some((b) => b.type === 'image' && b.src && b.size !== 'small')) tips.push('写真を小さくする');
        if (x.cols === 1) tips.push('2段にする');
        if (x.paper === 'a4') tips.push('B4 にする');
        status.textContent = over ? '1枚に入りきりません（およそ ' + (Math.ceil((full / pageH) * 10) / 10) + '枚ぶん）。' + tips.join('・') + 'などで、1枚にできます。' : P.label + '・' + (x.cols === 2 ? '2段' : '1段') + '　1枚に入っています。';
        status.classList.toggle('bad', over);
      }

      /* ── 出す ── */
      async function ready() {
        await save.flush();
        for (const b of S.cur.blocks) if (b.type === 'image' && b.src && !S.imgs.has(b.src)) S.imgs.set(b.src, await Kit.img.resolve(b.src));
      }
      async function print() {
        await ready();
        const x = Kit.clone(S.cur), P = PAPERS[x.paper];
        School.print({ size: P.w + 'mm ' + P.h + 'mm', margin: MARGIN + 'mm', build: () => pageEl(x, S.imgs, { print: true }) });
      }
      async function word() {
        await ready();
        const x = S.cur;
        try {
          const bytes = window.Docx.build(await docxOf(x));
          const ok = await Kit.download(Kit.safeName((x.name || '学級通信') + '_第' + x.no + '号') + '.docx', new Blob([bytes], { type: window.Docx.MIME }));
          if (ok) Kit.toast('Word のファイルを書き出しました。Word・Googleドキュメントで開いて直せます');
        } catch (e) { console.error(e); Kit.toast('Word に書き出せませんでした', { type: 'bad' }); }
      }

      /* ── カレンダー・宿題から入れる ── */
      function rowsFrom(from, to, cats, withHw, events, homework) {
        if (!from || !to || to < from || !window.SenseiCalendar) return [];
        const occ = window.SenseiCalendar.occurrences(events, from, to).filter((e) => cats.has(e.cat || 'class'));
        const t0 = (e) => (e.allDay || !e.start ? '' : e.start);
        const rows = [];
        for (let d = from, g = 0; d <= to && g < 93; d = addDays(d, 1), g++) {
          const evs = occ.filter((e) => e.occ === d).sort((a, b) => t0(a).localeCompare(t0(b)));
          const hol = School.holiday(d);
          const hws = withHw && S.cls ? homework.filter((x) => x.classId === S.cls.id && !x.closed && x.due === d) : [];
          if ((isWeekend(d) || hol) && !evs.length && !hws.length) continue; // 土日・祝日は、予定があるときだけ
          rows.push({
            date: d,
            text: [hol ? '（' + hol + '）' : ''].concat(evs.map((e) => e.title + (t0(e) ? '（' + t0(e) + '〜）' : ''))).filter(Boolean).join('\n'),
            note: hws.map((x) => '提出：' + (x.subject ? x.subject + ' ' : '') + x.title).join('\n'),
          });
        }
        return rows;
      }
      async function importSchedule(b, redraw) {
        const C = window.SenseiCalendar;
        if (!C) { Kit.toast('カレンダーの道具が見つかりません', { type: 'bad' }); return; }
        const base = S.cur.date || Kit.ymd();
        const RANGES = [
          { value: 'next', label: '次の週', get: () => { const m = addDays(mondayOf(base), 7); return [m, addDays(m, 6)]; } },
          { value: 'this', label: 'その週', get: () => { const m = mondayOf(base); return [m, addDays(m, 6)]; } },
          { value: 'two', label: '2週間', get: () => { const m = mondayOf(base); return [m, addDays(m, 13)]; } },
          { value: 'month', label: '次の月', get: () => { const d = Kit.parseYmd(base); const a = new Date(d.getFullYear(), d.getMonth() + 1, 1), z = new Date(d.getFullYear(), d.getMonth() + 2, 0); return [Kit.ymd(a), Kit.ymd(z)]; } },
        ];
        let range = 'next';
        const fromIn = h('input', { type: 'date', id: 'nl-imp-from', 'aria-label': 'はじめの日' }), toIn = h('input', { type: 'date', id: 'nl-imp-to', 'aria-label': 'おわりの日' });
        const setRange = () => { const r = RANGES.find((x) => x.value === range); if (r) [fromIn.value, toIn.value] = r.get(); };
        setRange();
        const cats = new Set(['gyoji', 'test', 'class', 'parent']);
        const hw = h('input', { type: 'checkbox', id: 'nl-imp-hw', checked: true });
        const info = h('p', { class: 'small ink-2', role: 'status' });
        const [events, homework] = await Promise.all([Kit.store.list('events'), Kit.store.list('homework')]);
        const build = () => rowsFrom(fromIn.value, toIn.value, cats, hw.checked, events, homework);
        const upd = () => { const rows = build(); info.textContent = Kit.fmtDate(fromIn.value, 'M/D(W)') + '〜' + Kit.fmtDate(toIn.value, 'M/D(W)') + '：' + rows.length + '日ぶん（予定のある日 ' + rows.filter((r) => r.text || r.note).length + '日）'; };
        const rangeSeg = Kit.seg(RANGES.map((r) => ({ value: r.value, label: r.label })), range, (v) => { range = v; setRange(); upd(); }, { label: '期間' });
        for (const el of [fromIn, toIn]) el.addEventListener('change', () => { range = ''; rangeSeg.setValue(''); upd(); });
        hw.addEventListener('change', upd);
        const catBox = h('div', { class: 'nl-cats' }, C.CATS.map((c) => {
          const cb = h('input', { type: 'checkbox', id: 'nl-cat-' + c.id, checked: cats.has(c.id) });
          cb.addEventListener('change', () => { if (cb.checked) cats.add(c.id); else cats.delete(c.id); upd(); });
          return h('label', { class: 'check small', for: 'nl-cat-' + c.id }, cb, c.label);
        }));
        upd();
        Kit.modal({
          title: 'カレンダーから予定を入れる',
          body: h('div', { class: 'stack' },
            h('div', null, h('b', { class: 'small' }, '期間（発行日 ' + Kit.fmtDate(base, 'M/D') + ' から見て）'), h('div', { style: { marginTop: '6px' } }, rangeSeg)),
            h('div', { class: 'dt-row' }, fromIn, h('span', null, '〜'), toIn),
            h('div', null, h('b', { class: 'small' }, '入れる予定の種類'), catBox),
            h('label', { class: 'check small', for: 'nl-imp-hw' }, hw, '宿題の締切も入れる' + (S.cls ? '（' + S.cls.name + '）' : '')),
            h('p', { class: 'small muted' }, '平日は、予定がなくても行をつくります（持ち物などを書けるように）。土日・祝日は、予定があるときだけ。会議・個人の予定は、はじめは入れません。'),
            info),
          actions: [{ label: 'やめる', kind: 'ghost' }, {
            label: '入れる', kind: 'primary', onClick: async () => {
              const rows = build();
              if (!rows.length) { Kit.toast('その期間には、入れる日がありません', { type: 'bad' }); return false; }
              if (b.rows.some((r) => r.text || r.note) && !(await Kit.confirm({ title: 'いまの行を置きかえますか', body: '予定表の行を、カレンダーの内容で置きかえます。', ok: '置きかえる' }))) return false;
              b.rows = rows;
              changed(); redraw();
              Kit.toast(rows.length + '日ぶんの予定を入れました');
            },
          }],
        });
      }
      async function fromHomework(b) {
        if (!S.cls) { Kit.toast('名簿にクラスがありません', { type: 'bad' }); return; }
        const t = Kit.ymd();
        const list = (await Kit.store.list('homework')).filter((x) => x.classId === S.cls.id && !x.closed && (!x.due || x.due >= t)).sort((a, c) => String(a.due || '9').localeCompare(String(c.due || '9')));
        if (!list.length) { Kit.toast('出している宿題がありません（宿題・提出の道具で出したものが入ります）'); return; }
        const add = list.map((x) => (x.subject ? x.subject + '：' : '') + x.title + (x.due ? '（' + md(x.due) + 'まで）' : ''));
        b.body = (String(b.body || '').trim() ? String(b.body).replace(/\s+$/, '') + '\n' : '') + add.join('\n');
        changed(); rerender();
        Kit.toast(add.length + '件を足しました');
      }

      /* ── 号をつくる・写す・消す ── */
      // テンプレート k から新しい号（題字・見出し・段・字体はテンプレートから。白紙は前の号の見た目のまま。紙・色・日付の書き方は前の号から）
      function fresh(k) {
        const prev = S.list[0], p = S.profile, d = Kit.ymd();
        const look = k.banner ? { tpl: k.id, banner: k.banner, look: k.look, cols: k.cols, font: k.font }
          : { tpl: '', banner: prev ? prev.banner : 'line', look: prev ? prev.look : 'line', cols: prev ? prev.cols : 1, font: prev ? prev.font : 'goth' };
        return norm(Object.assign({
          id: Kit.uid('nl'), classId: S.cls ? S.cls.id : '', name: prev ? prev.name : '学級通信', catch: prev ? prev.catch : '', no: prev ? maxNo(prev.name) + 1 : 1, date: d,
          school: prev ? prev.school : p.school || '', from: prev ? prev.from : defaultFrom(),
          paper: prev ? prev.paper : 'a4', accent: prev ? prev.accent : 'k', era: prev ? prev.era : 'wareki',
          blocks: tplBlocks(k, d, { teacher: p.teacher, cls: S.cls ? S.cls.name : '' }),
        }, look));
      }
      // 前の号を写す：見出し・文章・見た目はそのまま。予定表は次の週の空の行、写真は空に
      function nextOf(prev) {
        const t = Kit.ymd(), d = prev.date < t ? t : addDays(prev.date, 7);
        const o = Kit.clone(prev);
        delete o.sample; delete o.createdAt; delete o.updatedAt;
        o.blocks = o.blocks.map((b) => Object.assign(b, { id: Kit.uid('b') }, b.type === 'image' ? { src: '' } : null, b.type === 'schedule' ? { rows: weekRows(d) } : null));
        return norm(Object.assign(o, { id: Kit.uid('nl'), no: maxNo(prev.name) + 1, date: d }));
      }
      async function create(x) {
        await save.flush();
        await Kit.store.put('newsletters', x);
        await load();
        S.cur = norm(Kit.clone(S.list.find((y) => y.id === x.id) || x));
        await render();
        window.scrollTo(0, 0);
      }
      // 新しい号：前の号を写すか、テンプレート（見本の小さな絵つき）から選ぶ
      async function newIssue() {
        const NL = NLT();
        const prev = S.list[0] || null;
        let pick = prev ? 'prev' : 'week';
        const onPick = (v) => { pick = v; };
        const prevCard = prev ? (() => {
          const r = h('input', { type: 'radio', name: 'nl-kata', id: 'nl-kata-prev', value: 'prev', checked: true });
          r.addEventListener('change', () => { pick = 'prev'; });
          return h('label', { class: 'nl-kata-it', for: 'nl-kata-prev' }, r, h('span', null, h('b', null, '前の号から（' + prev.name + ' 第' + prev.no + '号を写す）'),
            h('span', { class: 'small muted', style: { display: 'block' } }, '題字・見出し・文章・見た目はそのまま。予定表は次の週の空の行、写真は空にします')));
        })() : null;
        const cards = NL.TEMPLATES.map((t) => tpCard('nl-kata', t.id, t.label, t.scene + '・' + t.mood, fresh(t), { checked: pick === t.id, onPick }))
          .concat(tpCard('nl-kata', 'blank', NL.BLANK.label, NL.BLANK.desc, fresh(NL.BLANK), { onPick }));
        const box = h('div', { class: 'nl-kata', role: 'radiogroup', 'aria-label': 'つくり方' }, prevCard,
          h('p', { class: 'nl-kata-sec' }, prev ? 'または、テンプレートから（中身の例文つき）' : 'テンプレートを選ぶ（中身の例文つき）'),
          h('div', { class: 'nl-tp-grid' }, cards));
        const ok = await new Promise((res) => fitLater(Kit.modal({ title: '新しい号をつくる', wide: true, body: box, onClose: (v) => res(v === true), actions: [{ label: 'やめる', kind: 'ghost', value: null }, { label: 'つくる', kind: 'primary', value: true }] }).el));
        if (!ok) return;
        await create(pick === 'prev' ? nextOf(prev) : fresh(pick === 'blank' ? NL.BLANK : NL.TEMPLATE_MAP[pick]));
        Kit.toast('第' + S.cur.no + '号をつくりました');
      }
      async function nextIssue(x) {
        await create(nextOf(x));
        Kit.toast('第' + x.no + '号を写して、第' + S.cur.no + '号をつくりました');
      }
      async function removeIssue(x) {
        const yes = await Kit.confirm({ title: x.name + ' 第' + x.no + '号を消しますか', body: '中の文章・予定表・写真も消えます。元に戻せません。', ok: '消す', danger: true });
        if (!yes) return;
        await save.flush();
        await dropIssue(x);
        if (S.cur && S.cur.id === x.id) S.cur = null;
        await load();
        render();
        Kit.toast('消しました');
      }
      async function open(id) {
        await save.flush();
        const x = S.list.find((y) => y.id === id);
        if (!x) return;
        S.cur = norm(Kit.clone(x));
        await render();
        window.scrollTo(0, 0);
      }

      await load();
      if (params && params.id && S.list.some((x) => x.id === params.id)) S.cur = norm(Kit.clone(S.list.find((x) => x.id === params.id)));
      await render();
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (alive) fit(); });
      const offC = School.onClassChange(async () => { await save.flush(); S.cur = null; await load(); if (alive) render(); });
      return () => { alive = false; offC(); if (ro) ro.disconnect(); preview.cancel(); save.flush(); };
    },
  });

  // ほかの道具（ホーム）から：いちばん新しい号
  window.SenseiNewsletter = {
    async latest() {
      const cls = await School.classes.current();
      const all = (await Kit.store.list('newsletters')).filter((x) => !x.classId || !cls || x.classId === cls.id).map(norm);
      all.sort((a, b) => String(b.date).localeCompare(String(a.date)) || b.no - a.no);
      return all[0] ? { id: all[0].id, name: all[0].name, no: all[0].no, date: all[0].date } : null;
    },
    plainText, docxOf, pageEl,
  };
})();

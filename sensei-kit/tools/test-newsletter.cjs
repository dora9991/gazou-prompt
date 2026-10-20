#!/usr/bin/env node
/* 学級通信のテンプレート（10）と題字（11）の確かめ
   ・Node で：テンプレートの中身・場面と雰囲気・見た目だけを写す・題字の中身（名前・号・日付・学校・発行）・Word の部品（どの題字×色でも正しい XML）
             Word の組み立て（docx.js）の今までの形が1文字も変わらない・段組みの中の「全部の幅」
   ・本物のブラウザで（Chrome）：10のテンプレート × A4 たて・B4 たて・A4 よこ × 1段・2段 で、紙の横からはみ出さない・題字に名前と号が入る・
             そのままの形（A4）で1枚に入る／新しい号をテンプレートから（見本の小さな絵つき）／題字だけ・全体の型だけ切りかえ（中身はそのまま・元に戻す）／
             前からある号は見た目も Word も変わらない／Word の XML が正しい／印刷の中身・連絡アプリ用の文に「切り取りの返事」
   使い方：  node tools/test-newsletter.cjs
            （手元の Mac：PLAYWRIGHT=…/node_modules/playwright-core CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" をつける） */
const path = require('path');
const crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..');
const NL = require(path.join(ROOT, 'js/core/newsletter-templates.js'));
const Docx = require(path.join(ROOT, 'js/core/docx.js'));
const Letters = require(path.join(ROOT, 'js/core/letters.js'));

let failed = 0, passed = 0;
const ok = (cond, msg) => { if (cond) passed++; else { failed++; console.log('NG  ' + msg); } };
const section = (t) => console.log('── ' + t);
const sha1 = (s) => crypto.createHash('sha1').update(s).digest('hex');

// ZIP（圧縮なし）から部品を取り出す
function unzip(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = bytes.length - 22;
  while (end >= 0 && dv.getUint32(end, true) !== 0x06054b50) end--;
  const files = {};
  let p = dv.getUint32(end + 16, true);
  for (let i = 0; i < dv.getUint16(end + 10, true); i++) {
    const size = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), off = dv.getUint32(p + 42, true);
    const name = Buffer.from(bytes.subarray(p + 46, p + 46 + nl)).toString();
    const start = off + 30 + dv.getUint16(off + 26, true);
    files[name] = Buffer.from(bytes.subarray(start, start + size)).toString();
    p += 46 + nl;
  }
  return files;
}
// XML として正しく閉じているか（タグの入れ子・属性の引用符・& の書きかえ）
function xmlOk(s) {
  const body = s.replace(/^<\?xml[^>]*\?>\s*/, '');
  if (/&(?!(amp|lt|gt|quot|apos|#\d+);)/.test(body)) return 'ばらの &';
  const stack = [];
  const re = /<(\/?)([A-Za-z_][\w:.-]*)((?:\s+[\w:.-]+="[^"<]*")*)\s*(\/?)>|<|>/g;
  let m;
  while ((m = re.exec(body))) {
    if (!m[2]) return 'こわれたタグ：' + body.slice(Math.max(0, m.index - 40), m.index + 40);
    if (m[1]) { if (stack.pop() !== m[2]) return '閉じ方がちがう：' + m[2]; } else if (!m[4]) stack.push(m[2]);
  }
  return stack.length ? '閉じていない：' + stack.join(',') : '';
}

/* ───────── Node：テンプレートと題字 ───────── */
section('テンプレート（10）と題字（11）');
const ctx = {
  month: 10, jiko: Letters.jiko(10), teacher: 'かず', cls: '2年3組',
  at: (n) => '2026-11-' + String(n).padStart(2, '0'), day: (n) => '11月' + n + '日(水)',
  week: () => ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30'].map((d) => ({ date: d, text: '', note: '' })),
};
{
  const T = NL.TEMPLATES;
  ok(T.length === 10 && new Set(T.map((t) => t.id)).size === 10, 'テンプレートは10こ（名前がかぶらない）');
  ok(T.every((t) => NL.BANNER_MAP[t.banner] && NL.LOOK_MAP[t.look] && [1, 2].includes(t.cols) && Letters.FONTS[t.font]), 'どのテンプレートも、題字・見出しの飾り・段・字体がそろっている');
  const scenes = T.map((t) => t.scene).join(' ');
  for (const s of ['学期はじめ', '行事の前', '行事のあと', 'テスト前', '長期休み前', '保護者会', '学年末']) ok(scenes.includes(s), '場面「' + s + '」のテンプレートがある');
  ok(new Set(T.map((t) => t.mood)).size >= 8, '雰囲気が8種類以上（' + [...new Set(T.map((t) => t.mood))].join('・') + '）');
  ok(new Set(T.map((t) => t.banner)).size >= 8 && new Set(T.map((t) => t.look)).size >= 8, '題字と見出しの飾りが、テンプレートごとにちがう（題字 ' + new Set(T.map((t) => t.banner)).size + '・飾り ' + new Set(T.map((t) => t.look)).size + '）');
  ok(T.some((t) => t.cols === 1) && T.some((t) => t.cols === 2), '1段と2段のテンプレートがある');
  for (const t of T) {
    const bs = NL.blocksOf(t, ctx);
    const text = JSON.stringify(bs);
    ok(bs.length >= 4 && bs.every((b) => ['text', 'schedule', 'list', 'box', 'image', 'reply'].includes(b.type)), t.label + '：ブロックが4つ以上（' + bs.map((b) => b.type).join(',') + '）');
    ok(!/undefined|NaN|null|\[object/.test(text), t.label + '：例文に「undefined」などが入らない');
    ok(bs.filter((b) => b.head).length >= 3 && bs.some((b) => String(b.body || '').length > 40), t.label + '：見出しと、そのまま使える例文がある');
    ok(bs.filter((b) => b.type === 'schedule').every((b) => b.rows.length && b.rows.every((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.date))), t.label + '：予定表の行に日付が入る');
  }
  ok(JSON.stringify(NL.blocksOf(NL.TEMPLATE_MAP.start, ctx)).includes('担任になりました、かずです'), '新学期のあいさつに、担任の名前が入る');
  ok(!JSON.stringify(NL.blocksOf(NL.TEMPLATE_MAP.start, Object.assign({}, ctx, { teacher: '' }))).includes('、です'), '担任の名前がないときも、文が切れない');
  ok(JSON.stringify(NL.blocksOf(NL.TEMPLATE_MAP.parents, ctx)).includes('2年3組の教室') && NL.blocksOf(NL.TEMPLATE_MAP.parents, ctx).some((b) => b.type === 'reply'), '保護者会のご案内：クラスの名前と、切り取りの出欠票が入る');
  ok(JSON.stringify(NL.blocksOf(NL.TEMPLATE_MAP.parents, ctx)).includes(Letters.jiko(10).formal), '保護者会のご案内：時候のあいさつ（' + Letters.jiko(10).formal + '）');
  ok(NL.blocksOf(NL.BLANK, ctx).length === 1, '白紙は文章1つ');

  const B = NL.BANNERS;
  ok(B.length >= 10 && new Set(B.map((b) => b.id)).size === B.length, '題字は10こ以上（' + B.length + 'こ）');
  for (const id of ['board', 'ribbon', 'flower', 'wa', 'news', 'bubble']) ok(!!NL.BANNER_MAP[id], '題字「' + (NL.BANNER_MAP[id] || { label: id }).label + '」がある');
  ok(NL.LOOKS.length >= 6 && ['line', 'bar', 'round'].every((v) => NL.LOOK_MAP[v]), '見出しの飾り：前からの3つ（すっきり・しっかり・やわらか）＋新しい飾り');
  ok(NL.ACCENTS[0].id === 'k' && NL.ACCENTS[0].ac === '#000000', '色の始めは黒（白黒の印刷向け）');
}

section('見た目だけを写す（中身はそのまま）');
{
  const x = { name: 'かけはし', catch: 'めあて', no: 7, date: '2026-10-20', school: 'ひかり中', from: '2年3組', paper: 'b4', accent: 'navy', era: 'seireki', cols: 1, look: 'line', banner: 'line', font: 'goth', tpl: '', blocks: [{ id: 'a', type: 'text', head: 'h', body: 'b' }] };
  const y = NL.applyTemplate(x, 'month');
  ok(y.banner === 'board' && y.look === 'chalk' && y.cols === 2 && y.font === 'hand' && y.tpl === 'month', '全体の型：題字・飾り・段・字体・テンプレート名が変わる');
  ok(['name', 'catch', 'no', 'date', 'school', 'from', 'paper', 'accent', 'era'].every((k) => y[k] === x[k]) && JSON.stringify(y.blocks) === JSON.stringify(x.blocks), '全体の型：名前・号・日付・紙・色・中身はそのまま');
  const z = NL.applyBanner(x, 'ribbon');
  ok(z.banner === 'ribbon' && Object.keys(x).every((k) => k === 'banner' || JSON.stringify(z[k]) === JSON.stringify(x[k])), '題字だけ：題字のほかは何も変わらない');
  ok(JSON.stringify(NL.applyTemplate(x, 'nai')) === JSON.stringify(x) && JSON.stringify(NL.applyBanner(x, 'nai')) === JSON.stringify(x), 'ないテンプレート・題字の名前では、何も変わらない');
  ok(NL.bannerOf({ look: 'bar' }) === 'bar' && NL.bannerOf({ look: 'round' }) === 'round' && NL.bannerOf({ look: 'pop' }) === 'line' && NL.bannerOf({ look: 'line', banner: 'wa' }) === 'wa', '題字のない号（前からある号）は、見出しと同じ形の題字');
  ok(NL.nameSize('かけはし', 30, 120) === 30 && NL.nameSize('あいうえおかきくけこさしすせそたちつてと', 30, 120) < 20 && NL.nameSize('あ'.repeat(40), 30, 50) === 14, '題字の名前の大きさ：長い名前は小さくして入れる（14pt より小さくしない）');
}

section('題字の中身（どの題字でも名前・号・日付・学校・発行が入る）');
{
  // Kit.h と同じ形の、文字だけを集める小さな h
  const h = (tag, attrs, ...kids) => ({ tag, attrs: attrs || {}, kids: kids.flat(Infinity).filter((k) => k != null && k !== false) });
  const text = (n) => (typeof n === 'string' ? n : n && n.kids ? n.kids.map(text).join('') : '');
  const has = (n, cls) => !!n && typeof n === 'object' && (String(n.attrs.class || '').split(' ').includes(cls) || n.kids.some((k) => has(k, cls)));
  const x = { name: 'かけはし', catch: '学級目標：やさしく', no: 12, date: '2026-10-20', school: 'ひかり中学校', from: '2年3組 担任', accent: 'k', look: 'line' };
  for (const b of NL.BANNERS) {
    const m = NL.mast(Object.assign({}, x, { banner: b.id }), { h, date: '令和8年10月20日（火）', w: 186 });
    const t = text(m);
    ok(m.tag === 'header' && String(m.attrs.class).includes('nl-mast b-' + b.id) && has(m, 'nl-name'), b.label + '：題字の箱と名前');
    ok(['かけはし', '12', '令和8年10月20日（火）', 'ひかり中学校', '2年3組 担任', '学級目標：やさしく'].every((s) => t.includes(s)), b.label + '：名前・号・日付・学校・発行・そえる言葉が入る');
  }
  ok(text(NL.mast(Object.assign({}, x, { banner: 'line', catch: '', school: '', from: '' }), { h, date: 'D', w: 186 })) === 'かけはし第12号D', '学校・発行・そえる言葉がないときは、出さない');
}

section('Word（.docx）の部品');
{
  const FONTS = { goth: Letters.FONTS.goth.word, mincho: Letters.FONTS.mincho.word, hand: Letters.FONTS.hand.word };
  const x0 = { name: 'かけはし & <通信>', catch: 'めあて', no: 12, date: '2026-10-20', school: 'ひかり中', from: '2年3組', cols: 2 };
  let bad = [];
  for (const b of NL.BANNERS) for (const a of NL.ACCENTS) {
    const x = Object.assign({}, x0, { banner: b.id, accent: a.id, look: NL.TEMPLATES.find((t) => t.banner === b.id) ? NL.TEMPLATES.find((t) => t.banner === b.id).look : 'line' });
    const st = NL.docxStyle(x.look, a.id);
    const body = [st.heading('見出し'), { p: '本文' }, st.box('囲み', [{ p: '中' }]), st.item('箇条'), st.sep, { table: [['日', '予定'].map((t) => ({ p: t, color: st.th.color }))].concat([['10/1', '行事']]), header: true, shade: st.th.shade }].concat(NL.docxReply({ head: '出欠票', body: '氏名：\n出席・欠席' })).filter(Boolean);
    const files = unzip(Docx.build({ title: 't', page: { w: 210, h: 297, margin: 12, cols: 2, gap: 7, sep: true }, head: NL.docxHead(x, { date: '令和8年10月20日（火）', fonts: FONTS, w: 186 }), body }));
    const doc = files['word/document.xml'];
    const e = xmlOk(doc);
    if (e || !doc.includes('かけはし &amp; &lt;通信&gt;') || !doc.includes('令和8年10月20日（火）') || !doc.includes('きりとり')) bad.push(b.id + '×' + a.id + ' ' + e);
    if (a.id !== 'k' && !doc.includes(a.ac.slice(1).toUpperCase()) && !doc.includes(a.board.slice(1).toUpperCase())) bad.push(b.id + '×' + a.id + ' 色が入らない');
  }
  ok(!bad.length, 'どの題字×色でも、Word の XML が正しく、名前・日付・切り取りが入り、色が線に入る ' + bad.slice(0, 4).join(' / '));
  // 前からある3つの題字（黒）は、前と同じ Word の部品
  const right = (p, s) => Object.assign({ p, size: 9.5, align: 'right', line: 1.15 }, s);
  const want = (look, x) => [{ table: [[{ blocks: [{ p: x.name || '', b: true, size: 26, line: 1.05 }].concat(x.catch ? [{ p: x.catch, size: 10, before: 2 }] : []), valign: 'bottom' },
    { blocks: [right('第' + x.no + '号', { b: true, size: 12 }), right('D')].concat(x.school ? [right(x.school)] : [], x.from ? [right(x.from)] : []), valign: 'bottom' }]],
  widths: [0.6, 0.4], border: look === 'line' ? 'none' : 'box', thick: look === 'bar', pad: look === 'line' ? 0.3 : 2.5, noGap: look === 'line' },
  look === 'line' ? { p: '', border: { bottom: 'double' }, after: 6, line: 0.3 } : { p: '', line: 0.5 }];
  for (const look of ['line', 'bar', 'round']) {
    const x = Object.assign({}, x0, { look, banner: look, accent: 'k' });
    const a = unzip(Docx.build({ head: NL.docxHead(x, { date: 'D', fonts: FONTS }), body: [NL.docxStyle(look, 'k').heading('見出し'), NL.docxStyle(look, 'k').box('囲み', [{ p: '中' }]), NL.docxStyle(look, 'k').item('箇条')] }))['word/document.xml'];
    const hb = look === 'line' ? { bottom: 'single' } : look === 'bar' ? { left: 'thick' } : { top: 'single', bottom: 'single', left: 'single', right: 'single' };
    const b = unzip(Docx.build({ head: want(look, x), body: [{ p: '見出し', b: true, size: 12.5, keep: true, before: 4, after: 2, border: hb }, { table: [[{ blocks: [{ p: '囲み', b: true, size: 11.5, after: 1 }].concat([{ p: '中' }]) }]], border: 'box', thick: look === 'bar', pad: 2.2 }, { p: '・箇条', hanging: 3.7, line: 1.3 }] }))['word/document.xml'];
    ok(a === b, '前からの形「' + NL.LOOK_MAP[look].label + '」：題字・見出し・囲み・箇条が、前と同じ Word');
    ok(NL.docxStyle(look, 'k').sep === null && JSON.stringify(NL.docxStyle(look, 'k').th) === '{}', '前からの形「' + NL.LOOK_MAP[look].label + '」：区切り線なし・表の見出し行は前のまま');
  }
  // 白抜きの見出しは Word では使わない（地の色を描かない表示で字が消えるため）
  ok(NL.LOOKS.every((l) => { const o = NL.docxStyle(l.value, 'k').heading('x'); return !o.color || o.color === '000000'; }), 'Word の見出しは、どの飾りでも黒い字（白抜きにしない）');
}

section('Word の組み立て（docx.js）');
{
  // 今までの形（新しい項目を使わない）は、前と1文字も変わらない（2026-10-20 の docx.js で作った XML の指紋）
  const png = new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'));
  const files = unzip(Docx.build({
    title: 'テスト & <確認>', page: { w: 257, h: 364, margin: 12, cols: 2, gap: 7, sep: true }, font: '游ゴシック', size: 10.5,
    head: [{ table: [[{ blocks: [{ p: 'かけはし', b: true, size: 26 }], valign: 'bottom' }, { blocks: [{ p: '第1号', align: 'right' }] }]], widths: [0.6, 0.4], border: 'box', thick: true, pad: 2.5 }, { p: '', border: { bottom: 'double' }, after: 6, line: 0.3 }],
    body: [{ p: '見出し', b: true, border: { left: 'thick' }, keep: true }, { p: '1行目\n2行目 <b>&"', line: 1.3 }, { p: '・箇条', hanging: 3.7 },
      { table: [['日', '予定'], [{ p: '10/1', align: 'center' }, '行事']], header: true, widths: [0.3, 0.7] }, { table: [[{ blocks: [{ p: '囲み', b: true }, { p: '中' }] }]], border: 'box', pad: 2.2 },
      { img: png, type: 'png', frac: 0.5, ratio: 1, align: 'center' }, { p: '', border: { top: 'single', bottom: 'dashed', left: 'double', right: 'thick' }, shade: 'EEEEEE' }],
  }));
  ok(sha1(files['word/document.xml']) === 'e020f642a1161e2dc4f0f0542757374f685aba73' && sha1(files['word/styles.xml']) === '87006cb18ea5aacba6fa2078a6152c7ee11c00eb', '今までの形の Word は、前と1文字も変わらない');
  // 新しい項目：字の色・字体・字の間、線の色と種類、セルごとの線
  const doc = unzip(Docx.build({ body: [{ p: [{ t: '★', color: '1f3a68' }, { t: '見出し' }], font: '游明朝', sp: 2, b: true, border: { bottom: 'dotted', color: '8C1D2F' } },
    { table: [[{ p: 'セル', color: 'FFFFFF', shade: '000000', borders: { top: 'double', bottom: 'single' } }]], border: 'box', line: 'dashed', color: '1D5A3C', sz: 16 }] }))['word/document.xml'];
  ok(/<w:rPr><w:rFonts w:ascii="游明朝" w:hAnsi="游明朝" w:eastAsia="游明朝"\/><w:b\/><w:bCs\/><w:color w:val="1F3A68"\/><w:spacing w:val="40"\/>/.test(doc), 'docx：字の字体・色・字の間（決まった順で）');
  ok(doc.includes('<w:bottom w:val="dotted" w:sz="12" w:space="1" w:color="8C1D2F"/>'), 'docx：段落の線の色と点線');
  ok(doc.includes('<w:top w:val="dashed" w:sz="16" w:space="0" w:color="1D5A3C"/>') && /<w:tcBorders><w:top w:val="double"[^>]*\/><w:bottom w:val="single"[^>]*\/><\/w:tcBorders><w:shd/.test(doc) && doc.includes('<w:color w:val="FFFFFF"/>'), 'docx：表の線の種類と色・セルごとの線・セルの字の色');
  ok(!xmlOk(doc), 'docx：新しい項目を使っても XML が正しい ' + xmlOk(doc));
  // 段組みの本文の中で「全部の幅」（切り取りの返事）：前後で段を区切る
  const two = unzip(Docx.build({ page: { cols: 2 }, head: [{ p: '題字' }], body: [{ p: '本文1' }, { p: 'きりとり', full: true }, { p: '返事', full: true }] }))['word/document.xml'];
  const secs = two.match(/<w:sectPr>.*?<\/w:sectPr>/g) || [];
  ok(secs.length === 3 && /w:num="1"/.test(secs[0]) && /continuous.*w:num="2"/.test(secs[1]) && /continuous.*w:num="1"/.test(secs[2]) && two.indexOf('本文1') < two.indexOf(secs[1]) && two.indexOf('きりとり') > two.indexOf(secs[1]), 'docx：2段の本文の中の「全部の幅」は、1段の区切りになる');
  const one = unzip(Docx.build({ page: { cols: 1 }, head: [{ p: '題字' }], body: [{ p: '本文1' }, { p: 'きりとり', full: true }] }))['word/document.xml'];
  ok((one.match(/<w:sectPr>/g) || []).length === 1, 'docx：1段のときは区切りを増やさない');
}

/* ───────── 本物のブラウザで ───────── */
(async () => {
  section('ブラウザ（紙面・テンプレートを選ぶ・切りかえ・前からある号・Word・印刷）');
  const { open, closeAll } = require('./check.cjs');
  const { page, errs, close } = await open({ app: 'newsletter', fresh: true, wait: 900 });
  try {
    await page.waitForFunction(() => window.NLTemplates && window.SenseiNewsletter && document.querySelector('.nl-card'), null, { timeout: 15000 });

    // 1) 10のテンプレート × 紙3つ × 1段・2段：はみ出さない・題字・1枚に入るか
    const lay = await page.evaluate(async () => {
      const NL = window.NLTemplates, MM = 96 / 25.4;
      const base = (await Kit.store.list('newsletters'))[0];
      const ctx = { month: 10, jiko: Letters.jiko(10), teacher: 'かず', cls: '2年3組', at: (n) => Kit.ymd(Kit.addDays('2026-10-20', n)), day: (n) => Kit.fmtDate(Kit.ymd(Kit.addDays('2026-10-20', n)), 'M月D日(W)'), week: () => [0, 1, 2, 3, 4].map((i) => ({ date: Kit.ymd(Kit.addDays('2026-10-26', i)), text: i === 1 ? '避難訓練（3校時）' : '', note: '' })) };
      const P = { a4: [210, 297], b4: [257, 364], a4l: [297, 210] };
      const host = document.createElement('div'); host.style.cssText = 'position:absolute;left:0;top:0;'; document.body.append(host);
      const out = [];
      for (const t of NL.TEMPLATES) for (const paper of ['a4', 'b4', 'a4l']) for (const cols of [1, 2]) for (const name of ['かけはし', 'みんなでつくる学級通信あおぞら']) {
        const x = Object.assign(JSON.parse(JSON.stringify(base)), NL.applyTemplate(base, t.id), { paper, cols, name, accent: 'k' });
        x.blocks = NL.blocksOf(t, ctx).map((b, i) => Object.assign({ id: 'b' + i }, b));
        host.innerHTML = '';
        const sheet = document.createElement('div'); sheet.style.cssText = 'box-sizing:border-box;background:#fff;width:' + P[paper][0] + 'mm;padding:12mm';
        const pg = SenseiNewsletter.pageEl(x, new Map()); sheet.append(pg); host.append(sheet);
        const r = pg.getBoundingClientRect();
        const over = [...pg.querySelectorAll('*')].filter((e) => { const q = e.getBoundingClientRect(); return q.width && (q.right > r.right + 1.5 || q.left < r.left - 1.5); }).map((e) => e.className || e.tagName);
        const mast = pg.querySelector('.nl-mast');
        out.push({ t: t.id, paper, cols, long: name.length > 6, over: over.slice(0, 3), name: !!mast.querySelector('.nl-name') && mast.textContent.includes(name) && mast.textContent.includes('12'), h: pg.offsetHeight / ((P[paper][1] - 24) * MM), def: paper === 'a4' && cols === t.cols && name === 'かけはし' });
      }
      host.remove();
      return out;
    });
    const over = lay.filter((r) => r.over.length);
    ok(lay.length === 120 && !over.length, '10のテンプレート × A4 たて・B4 たて・A4 よこ × 1段・2段 × 名前の長さ2つ：紙の横からはみ出さない ' + over.slice(0, 3).map((r) => JSON.stringify(r)).join(' '));
    ok(lay.every((r) => r.name), 'どの組み合わせでも、題字に名前と号が入る');
    const def = lay.filter((r) => r.def);
    ok(def.length === 10 && def.every((r) => r.h <= 1), 'テンプレートのままの形（A4 たて・その段）で、1枚に入る（' + def.map((r) => r.t + ' ' + Math.round(r.h * 100) + '%').join('・') + '）');

    // 2) 前からある号は、見た目も Word も変わらない（2026-10-20 の前のコードで作った Word の指紋）
    const legacy = await page.evaluate(async () => {
      const L = (look, paper, cols, font) => ({ id: 'legacy-1', classId: '', name: 'かけはし', catch: '学級目標：やさしく、まっすぐ、おもしろく', no: 12, date: '2026-10-20', school: 'ひかり中学校（架空）', from: '2年3組 担任 かず先生', paper, cols, look, font, era: 'wareki',
        blocks: [
          { id: 'l1', type: 'text', head: '体育祭、おつかれさまでした', body: '朝夕はめっきり涼しくなってまいりました。\n先日の体育祭では、温かいご声援をありがとうございました。\n\n学級リレーは4位でしたが、最後まで全員で走りきりました。' },
          { id: 'l2', type: 'schedule', head: '来週の予定', col3: '持ち物・連絡', rows: [{ date: '2026-10-26', text: '委員会（放課後）', note: '' }, { date: '2026-10-27', text: '避難訓練（3校時）', note: '上ばきをそろえておく' }, { date: '2026-10-28', text: '中間テスト（1日目）\n国語・数学・理科', note: '提出：数学ワーク' }] },
          { id: 'l3', type: 'list', head: 'お知らせ・お願い', body: 'テストの1週間前から、部活動はお休みになります。\n・朝晩が冷えてきました。上着の準備をお願いします。' },
          { id: 'l4', type: 'box', head: '三者面談のお知らせ', body: '11月の中ごろに、三者面談を行います。\n日程の希望票は、来週配ります。' },
          { id: 'l5', type: 'image', src: '', caption: '', size: 'half' },
        ] });
      const doc = async (x) => { const bytes = Docx.build(await SenseiNewsletter.docxOf(x)); const dv = new DataView(bytes.buffer); let end = bytes.length - 22; while (dv.getUint32(end, true) !== 0x06054b50) end--; let p = dv.getUint32(end + 16, true); for (let i = 0; i < dv.getUint16(end + 10, true); i++) { const size = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), off = dv.getUint32(p + 42, true); const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nl)); if (name === 'word/document.xml') { const s = off + 30 + dv.getUint16(off + 26, true); return new TextDecoder().decode(bytes.subarray(s, s + size)); } p += 46 + nl; } return ''; };
      const hex = async (s) => [...new Uint8Array(await crypto.subtle.digest('SHA-1', new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, '0')).join('');
      const res = {};
      for (const v of [['line', 'a4', 1, 'goth'], ['bar', 'b4', 2, 'mincho'], ['round', 'a4l', 2, 'hand'], ['line', 'a4', 2, 'goth']]) res[v.join('-')] = await hex(await doc(L(...v)));
      // 見た目：題字の箱は見出しと同じ形（b-line など）で、区切り線・飾りの絵は入らない
      const pg = SenseiNewsletter.pageEl(L('bar', 'a4', 2, 'goth'), new Map());
      res.dom = pg.querySelector('.nl-mast').className + '|' + pg.querySelectorAll('.nl-sep,.nl-ho,.nl-orn').length + '|' + pg.className;
      return res;
    });
    const WANT = { 'line-a4-1-goth': 'f90eb53d0540050391f2da35eb10aa9fe5967915', 'bar-b4-2-mincho': '497216c738ae099dcabb602c6dee5a8d2950036c', 'round-a4l-2-hand': '927c0ce7d1be879858c83331efe9dac0046f5acf', 'line-a4-2-goth': 'c182bddbe4b53626313480306a74195f9c2f3244' };
    for (const k of Object.keys(WANT)) ok(legacy[k] === WANT[k], '前からある号の Word が前と同じ（' + k + '）');
    ok(legacy.dom === 'nl-mast b-bar|0|nl-page k-bar ac-k', '前からある号の紙面：題字は見出しと同じ形・新しい飾りは入らない（' + legacy.dom + '）');

    // 3) 新しい号：テンプレートを選ぶ（見本の小さな絵つき）
    const sampleBefore = await page.evaluate(async () => JSON.stringify((await Kit.store.list('newsletters')).find((x) => x.sample) || null));
    await page.click('.app-actions button:has-text("新しい号をつくる")');
    await page.waitForSelector('.modal .nl-tp-grid');
    await page.waitForTimeout(400);
    const pick = await page.evaluate(() => ({ cards: document.querySelectorAll('.modal .nl-tp').length, minis: document.querySelectorAll('.modal .nl-tp .nl-mini .nl-page').length, prev: !!document.querySelector('.modal #nl-kata-prev:checked'), w: [...document.querySelectorAll('.modal .nl-tp .nl-mini')].every((m) => Math.abs(m.getBoundingClientRect().width - m.parentElement.clientWidth + 16) < 3) }));
    ok(pick.cards === 11 && pick.minis === 11 && pick.prev, '新しい号：10のテンプレート＋白紙に見本の小さな絵、はじめは「前の号から」 ' + JSON.stringify(pick));
    ok(pick.w, '見本の絵は、カードの幅いっぱいに縮める');
    await page.locator('.modal .modal-f button', { hasText: 'やめる' }).click();
    await page.waitForTimeout(250);
    ok(await page.evaluate(() => !document.querySelector('.modal')), '「やめる」でダイアログが閉じる');
    await page.click('.app-actions button:has-text("新しい号をつくる")');
    await page.waitForSelector('.modal .nl-tp-grid');
    await page.click('.modal .nl-kata-it:has-text("保護者会のご案内")');
    await page.locator('.modal .modal-f button', { hasText: 'つくる' }).click();
    await page.waitForSelector('.nl-design');
    await page.waitForTimeout(700);
    const made = await page.evaluate(async () => { const x = (await Kit.store.list('newsletters')).find((y) => y.tpl === 'parents'); return x && { no: x.no, banner: x.banner, look: x.look, cols: x.cols, font: x.font, name: x.name, types: x.blocks.map((b) => b.type).join(','), box: (x.blocks.find((b) => b.type === 'box') || {}).body, page: !!document.querySelector('.nl-sheet .nl-page.k-wa .nl-mast.b-wa .wa-band svg pattern'), reply: document.querySelectorAll('.nl-sheet .nl-reply .nl-fld').length }; });
    ok(made && made.no === 13 && made.banner === 'wa' && made.look === 'wa' && made.cols === 1 && made.font === 'mincho' && made.name === 'かけはし', '保護者会のご案内で13号：題字・飾り・段・字体はテンプレートから、通信の名前は前の号から ' + JSON.stringify(made));
    ok(made && made.types === 'text,box,list,reply' && /2年3組の教室/.test(made.box), '例文が入る（クラスの名前・切り取りの出欠票）');
    ok(made && made.page && made.reply === 3, '紙面：和風の帯（青海波の模様）と、書きこむ線が3本の出欠票');
    const status = await page.textContent('.nl-status');
    ok(/1枚に入っています/.test(status), '「1枚に入るか」の表示が出る（' + status + '）');

    // 4) 題字だけ切りかえ
    const before = await page.evaluate(async () => JSON.stringify((await Kit.store.list('newsletters')).find((y) => y.tpl === 'parents').blocks));
    await page.click('.nl-design button:has-text("題字を変える")');
    await page.waitForSelector('.modal .nl-tp-grid.mast');
    await page.waitForTimeout(300);
    const bm = await page.evaluate(() => ({ n: document.querySelectorAll('.modal .nl-tp').length, now: (document.querySelector('.modal .nl-tp .nl-tp-now') || {}).parentElement && document.querySelector('.modal .nl-tp-now').parentElement.textContent.includes('和風の帯'), h: [...document.querySelectorAll('.modal .nl-mini.mast')].every((m) => m.offsetHeight > 20 && m.offsetHeight < 200) }));
    ok(bm.n === NL.BANNERS.length && bm.now && bm.h, '題字を変える：' + NL.BANNERS.length + 'の見本（いまの題字に印・高さは中身に合わせる） ' + JSON.stringify(bm));
    await page.click('.modal .nl-kata-it:has-text("リボン")');
    await page.locator('.modal .modal-f button', { hasText: 'この題字にする' }).click();
    await page.waitForTimeout(700);
    const afterB = await page.evaluate(async () => { const x = (await Kit.store.list('newsletters')).find((y) => y.tpl === 'parents'); return { banner: x.banner, look: x.look, cols: x.cols, blocks: JSON.stringify(x.blocks), dom: !!document.querySelector('.nl-sheet .nl-mast.b-ribbon .rb-band .nl-name') }; });
    ok(afterB.banner === 'ribbon' && afterB.look === 'wa' && afterB.cols === 1 && afterB.blocks === before && afterB.dom, '題字だけがリボンに変わり、見出し・段・中身はそのまま');

    // 5) 全体の型を切りかえ → 元に戻す
    await page.waitForTimeout(5200); // 前の知らせが消えるまで
    await page.click('.nl-design button:has-text("テンプレートを変える")');
    await page.waitForSelector('.modal .nl-tp-grid');
    await page.click('.modal .nl-kata-it:has-text("今月の学級")');
    await page.locator('.modal .modal-f button', { hasText: 'この型にする' }).click();
    await page.waitForTimeout(700);
    const afterT = await page.evaluate(async () => { const x = (await Kit.store.list('newsletters')).find((y) => y.no === 13 && !y.sample); return { tpl: x.tpl, banner: x.banner, look: x.look, cols: x.cols, font: x.font, blocks: JSON.stringify(x.blocks), sep: document.querySelectorAll('.nl-sheet .nl-sep').length, c2: !!document.querySelector('.nl-sheet .nl-body.c2') }; });
    ok(afterT.tpl === 'month' && afterT.banner === 'board' && afterT.look === 'chalk' && afterT.cols === 2 && afterT.font === 'hand' && afterT.blocks === before, '全体の型を「今月の学級」に：題字・飾り・2段・字体が変わり、中身はそのまま');
    ok(afterT.sep >= 3 && afterT.c2, '紙面：2段になり、ブロックの間に区切り線');
    await page.locator('.toast button', { hasText: '元に戻す' }).click();
    await page.waitForTimeout(700);
    const undone = await page.evaluate(async () => { const x = (await Kit.store.list('newsletters')).find((y) => y.no === 13 && !y.sample); return [x.tpl, x.banner, x.look, x.cols, x.font].join(','); });
    ok(undone === 'parents,ribbon,wa,1,mincho', '「元に戻す」で、前の見た目にもどる（' + undone + '）');

    // 6) 見出し・囲みの飾りと色
    await page.click('.nl-look summary');
    await page.click('.nl-chip:has-text("ポップ")');
    await page.click('.nl-look .seg button:has-text("紺")');
    await page.waitForTimeout(600);
    const lk = await page.evaluate(async () => { const x = (await Kit.store.list('newsletters')).find((y) => y.no === 13 && !y.sample); const pg = document.querySelector('.nl-sheet .nl-page'); const h = pg.querySelector('.nl-body > .nl-blk:not(.nl-boxed):not(.nl-reply) > .nl-h'); return { look: x.look, accent: x.accent, cls: pg.className, color: getComputedStyle(h).borderBottomColor, ink: getComputedStyle(pg.querySelector('.nl-txt p')).color, orn: !!h.querySelector('.nl-ho svg') }; });
    ok(lk.look === 'pop' && lk.accent === 'navy' && /k-pop/.test(lk.cls) && /ac-navy/.test(lk.cls) && lk.orn, '見出し・囲みの飾り「ポップ」と色「紺」を選べる');
    ok(lk.color === 'rgb(31, 58, 104)' && lk.ink === 'rgb(0, 0, 0)', '色は飾りの線だけ・文字は黒のまま（' + lk.color + ' / ' + lk.ink + '）');

    // 7) Word：10のテンプレート × 黒・えんじ で XML が正しい
    const wd = await page.evaluate(async () => {
      const NL = window.NLTemplates, base = (await Kit.store.list('newsletters')).find((y) => y.no === 13 && !y.sample);
      const ctx = { month: 10, jiko: Letters.jiko(10), teacher: 'かず', cls: '2年3組', at: (n) => Kit.ymd(Kit.addDays('2026-10-20', n)), day: (n) => Kit.fmtDate(Kit.ymd(Kit.addDays('2026-10-20', n)), 'M月D日(W)'), week: () => [0, 1, 2].map((i) => ({ date: Kit.ymd(Kit.addDays('2026-10-26', i)), text: '', note: '' })) };
      const bad = [];
      for (const t of NL.TEMPLATES) for (const accent of ['k', 'red']) {
        const x = Object.assign(JSON.parse(JSON.stringify(base)), NL.applyTemplate(base, t.id), { accent });
        x.blocks = NL.blocksOf(t, ctx).map((b, i) => Object.assign({ id: 'b' + i }, b));
        const bytes = Docx.build(await SenseiNewsletter.docxOf(x));
        const dv = new DataView(bytes.buffer); let end = bytes.length - 22; while (dv.getUint32(end, true) !== 0x06054b50) end--;
        let p = dv.getUint32(end + 16, true), doc = '';
        for (let i = 0; i < dv.getUint16(end + 10, true); i++) { const size = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), off = dv.getUint32(p + 42, true); const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nl)); const s = off + 30 + dv.getUint16(off + 26, true); const txt = new TextDecoder().decode(bytes.subarray(s, s + size)); if (/\.(xml|rels)$/.test(name) && new DOMParser().parseFromString(txt, 'application/xml').getElementsByTagName('parsererror').length) bad.push(t.id + '/' + accent + ':' + name); if (name === 'word/document.xml') doc = txt; p += 46 + nl; }
        const first = x.blocks.find((b) => b.head);
        if (!doc.includes('かけはし') || (first && !doc.includes(first.head.replace(/&/g, '&amp;')))) bad.push(t.id + '/' + accent + ': 中身がない');
        if (t.id === 'parents' && !doc.includes('きりとり')) bad.push('parents: きりとり');
      }
      return bad;
    });
    ok(!wd.length, '10のテンプレート × 黒・えんじ：Word のどの XML も正しく読め、題字と見出しが入る ' + wd.slice(0, 3).join(' '));

    // 8) 印刷の中身・連絡アプリ用の文
    await page.evaluate(() => { window.print = () => {}; });
    await page.click('.nl-bar button:has-text("印刷")');
    await page.waitForTimeout(400);
    const pr = await page.evaluate(() => ({ reply: document.querySelectorAll('#sk-print .nl-reply .nl-fld').length, cut: /きりとり/.test((document.querySelector('#sk-print .nl-cut') || {}).textContent || ''), ph: document.querySelectorAll('#sk-print .nl-fig.ph').length, mast: !!document.querySelector('#sk-print .nl-mast.b-ribbon') }));
    ok(pr.reply === 3 && pr.cut && pr.ph === 0 && pr.mast, '印刷の中身：題字（リボン）・切り取り線と出欠票（空の写真の枠は刷らない） ' + JSON.stringify(pr));
    const plain = await page.evaluate(async () => SenseiNewsletter.plainText((await Kit.store.list('newsletters')).find((y) => y.no === 13 && !y.sample)));
    ok(/■学級保護者会 出欠票\n生徒氏名：＿+\n出席　・　欠席/.test(plain), '連絡アプリ用の文に、出欠票の行が入る');

    // 9) サンプルの号（前からある号）は、どの操作でも変わらない
    const sampleAfter = await page.evaluate(async () => JSON.stringify((await Kit.store.list('newsletters')).find((x) => x.sample) || null));
    ok(sampleBefore === sampleAfter && sampleBefore !== 'null', '前からある号（サンプル）は、新しい号・切りかえのあとも変わらない');

    // 10) スマホの幅：新しい号のダイアログで「つくる」がいつも見える
    await page.setViewportSize({ width: 390, height: 700 });
    await page.click('.app-actions button:has-text("新しい号をつくる")');
    await page.waitForSelector('.modal .nl-tp-grid');
    await page.waitForTimeout(300);
    const ph = await page.evaluate(() => { const b = [...document.querySelectorAll('.modal .modal-f button')].find((x) => x.textContent === 'つくる'); const r = b.getBoundingClientRect(); const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); const m = document.querySelector('.modal'); return { inView: r.bottom <= innerHeight && r.top >= 0, hit: at === b || b.contains(at), long: m.scrollHeight > m.clientHeight * 1.5, wide: document.documentElement.scrollWidth <= innerWidth + 1 }; });
    ok(ph.inView && ph.hit && ph.long && ph.wide, 'スマホ：見本が長くても「つくる」は下に止まって押せる・横にはみ出さない ' + JSON.stringify(ph));
    await page.locator('.modal .modal-f button', { hasText: 'やめる' }).click();
  } catch (e) {
    ok(false, 'ブラウザの確かめが途中で止まった：' + (e && e.message));
  }
  const mine = errs.filter((e) => /newsletter|NLTemplates|nl-/.test(e));
  ok(mine.length === 0, '学級通信のエラーがない' + (mine.length ? '\n    ' + mine.join('\n    ') : ''));
  if (errs.length > mine.length) console.log('（ほかの道具のエラー：' + (errs.length - mine.length) + '件。この確かめでは数えない）\n    ' + errs.filter((e) => !mine.includes(e)).slice(0, 3).join('\n    '));
  await close();
  await closeAll();
  console.log(`\n${passed} 件 OK` + (failed ? ` / ${failed} 件 NG` : '・すべて OK'));
  process.exit(failed ? 1 : 0);
})();

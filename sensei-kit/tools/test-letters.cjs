#!/usr/bin/env node
/* 連絡テンプレートの確かめ（時候のあいさつの例文と、改まった文書のひな形）。画面を通さずに、数と決まりを見る。
   ・時候のあいさつ：30こ以上・月ごとに2こ以上（改まった言い方とやわらかい言い方の両方）・季語の時期がずれていない
   ・ひな形：全部の差し込みがうまる・改まった文書は 拝啓〜敬具・記・以上 がそろう・Word でも右寄せ／中央の形になる
   使い方：  node tools/test-letters.cjs */
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const Letters = require(path.join(ROOT, 'js/core/letters.js'));
const Docx = require(path.join(ROOT, 'js/core/docx.js'));

let failed = 0, passed = 0;
const ok = (cond, msg) => { if (cond) passed++; else { failed++; console.log('NG  ' + msg); } };
const section = (t) => console.log('── ' + t);
const L = Letters;
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

/* ───────── 時候のあいさつ ───────── */
section('時候のあいさつの例文');
{
  const J = L.JIKO_LIST;
  const seasonal = J.filter((e) => e.style !== 'any');
  ok(J.length >= 30, '例文が30こ以上（' + J.length + 'こ）');
  ok(new Set(J.map((e) => e.id)).size === J.length && new Set(J.map((e) => e.text)).size === J.length, '例文の id と文がかぶらない');
  for (const m of MONTHS) {
    const r = seasonal.filter((e) => e.months.includes(m));
    ok(r.length >= 2, m + '月：季節の例文が2こ以上（' + r.length + 'こ）');
    ok(r.some((e) => e.style === 'kango') && r.some((e) => e.style === 'soft'), m + '月：「〜の候」とやわらかい言い方の両方がある');
    ok(L.jikoList(m).some((e) => e.id === 'jika'), m + '月：季節を問わない「時下」も出る');
  }
  const AITE = L.AITE.map((a) => a.id);
  for (const e of J) {
    const where = `「${e.text}」`;
    ok(['kango', 'soft', 'any'].includes(e.style), where + '：言い方の種類');
    ok(Array.isArray(e.months) && e.months.length >= 1 && e.months.every((m) => MONTHS.includes(m)), where + '：月が1〜12');
    ok(typeof e.when === 'string' && e.when.length >= 2, where + '：使う時期が書いてある');
    ok(e.aite.length >= 1 && e.aite.every((a) => AITE.includes(a)) && e.aite.includes('parent'), where + '：使える相手（保護者には使える）');
    if (e.style === 'kango') ok(/^.{2}の候$/.test(e.text), where + '：改まった言い方は「〇〇の候」');
    if (e.style === 'soft') {
      ok(!/の候/.test(e.text) && !/[。、]$/.test(e.text), where + '：やわらかい言い方は「の候」なし・句読点で終わらない');
      ok(!e.aite.includes('school'), where + '：やわらかい言い方は、ほかの学校（公の文書）には出さない');
    }
    if (e.style === 'any') ok(e.text === '時下' && e.months.length === 12, where + '：季節を問わないのは「時下」で、どの月にも出る');
  }
  // 季語の時期：二十四節気の名前は、その節気の月から始まる
  const SEKKI = { 小寒: 1, 大寒: 1, 立春: 2, 立夏: 5, 小暑: 7, 大暑: 7, 立秋: 8, 処暑: 8, 白露: 9, 秋分: 9, 寒露: 10, 立冬: 11 };
  for (const e of seasonal) {
    const name = Object.keys(SEKKI).find((k) => e.text.startsWith(k) && e.style === 'kango');
    if (name) ok(e.months[0] === SEKKI[name] && /日ごろ/.test(e.when), `「${e.text}」：${name}（${SEKKI[name]}月）から・日付つき`);
  }
  // 季節のことばと月がずれていない（二十四節気の名前は上で見たので除く）
  const RULE = [
    [/春/, [1, 2, 3, 4, 5], '春'], [/夏/, [5, 6, 7, 8], '夏'], [/秋/, [8, 9, 10, 11], '秋'], [/冬|寒/, [11, 12, 1, 2], '冬・寒'],
    [/梅雨|入梅/, [6, 7], '梅雨'], [/桜/, [3, 4], '桜'], [/紅葉|色づ/, [10, 11], '紅葉'], [/師走|歳末|残りわずか/, [12], '年の暮れ'],
    [/新緑|若葉|薫/, [5, 6], '若葉'], [/^梅の/, [2, 3], '梅'], [/松の内/, [1], '松の内'], [/あじさい/, [6, 7], 'あじさい'], [/ひぐらし|残暑/, [8, 9], '晩夏'],
  ];
  for (const e of seasonal) {
    if (e.style === 'kango' && Object.keys(SEKKI).some((k) => e.text.startsWith(k))) continue;
    for (const [re, ok12, label] of RULE) if (re.test(e.text)) ok(e.months.every((m) => ok12.includes(m)), `「${e.text}」：「${label}」のことばの月（${e.months.join('・')}月）`);
  }
  // 使える日（range）：'MM-DD' の始めと終わりが、一覧に出す月と合っている
  const MD = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
  for (const e of J) {
    const where = `「${e.text}」`;
    const r = e.range || [];
    ok(r.length === 2 && MD.test(r[0]) && MD.test(r[1]) && r[0] <= r[1], where + '：使える日（MM-DD〜MM-DD）');
    if (!(r.length === 2 && r[0] <= r[1])) continue;
    const m1 = +r[0].slice(0, 2), m2 = +r[1].slice(0, 2), d2 = +r[1].slice(3);
    const span = []; for (let m = m1; m <= m2; m++) span.push(m);
    // 終わりの月が7日まで（立春・立秋などの前日まで）なら、その月の一覧には出さなくてよい
    ok(span.every((m) => e.months.includes(m) || (m === m2 && m2 > m1 && d2 <= 7)) && e.months.every((m) => span.includes(m)), where + '：使える日（' + r.join('〜') + '）と一覧の月（' + e.months.join('・') + '月）が合う');
  }
  // 1年のどの日にも、使える「〜の候」とやわらかい言い方がある。自動で選ぶものは、その日に使える
  for (const y of [2026, 2028]) {
    let gapK = [], gapS = [], bad = [], kept = 0, days = 0;
    for (let d = new Date(y, 0, 1); d.getFullYear() === y; d.setDate(d.getDate() + 1)) {
      const ymd = y + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      days++;
      if (!J.some((e) => e.style === 'kango' && L.jikoFits(e, ymd))) gapK.push(ymd);
      if (!J.some((e) => e.style === 'soft' && L.jikoFits(e, ymd))) gapS.push(ymd);
      const a = L.jikoFor(ymd), s = L.jikoFor(ymd, 'soft');
      if (!(a && a.style === 'kango' && L.jikoFits(a, ymd) && s && s.style === 'soft' && L.jikoFits(s, ymd))) bad.push(ymd);
      const base = L.jikoByText(L.jiko(d.getMonth() + 1).formal);
      if (L.jikoFits(base, ymd)) { if (a === base) kept++; else bad.push(ymd + '（いつもの言い方を使わない）'); }
    }
    ok(!gapK.length, y + '年：どの日にも使える「〜の候」がある' + (gapK.length ? '（' + gapK.slice(0, 5).join('・') + '…）' : ''));
    ok(!gapS.length, y + '年：どの日にも使えるやわらかい言い方がある' + (gapS.length ? '（' + gapS.slice(0, 5).join('・') + '…）' : ''));
    ok(!bad.length, y + '年（' + days + '日）：自動で選ぶあいさつは、その日に使える。その月のいつもの言い方が使える日はそれを選ぶ（' + kept + '日）' + (bad.length ? '（' + bad.slice(0, 5).join('・') + '…）' : ''));
  }
  ok(L.jikoFor('2026-08-03').text === '盛夏の候' && L.jikoFor('2026-08-10').text === '残暑の候', '8月はじめ（立秋の前）は「盛夏の候」、立秋のあとは「残暑の候」');
  ok(L.jikoFor('2026-02-02').text === '厳寒の候' && L.jikoFor('2026-02-05').text === '余寒の候' && L.jikoFor('2026-12-28').text === '師走の候' && L.jikoFor('2026-01-03').text === '新春の候', '立春の前後・年末・年はじめ');
  ok(L.jikoFits(L.jikoById('shuubun'), '2026-10-07') && !L.jikoFits(L.jikoById('shuubun'), '2026-10-20'), '「秋分の候」は10月7日ごろまで（10月20日には合わない）');
  const zansho = L.jikoById('zansho');
  ok(zansho && zansho.months.join() === '8,9' && /9月上旬/.test(zansho.when), '「残暑の候」は8月〜9月上旬（7月には出ない）');
  ok(!L.jikoList(7).some((e) => e.id === 'zansho') && !L.jikoList(10).some((e) => e.id === 'zansho'), '「残暑の候」は7月・10月の一覧に出ない');
  ok(L.jikoById('shinshun').months.join() === '1' && L.jikoById('seika').months.join() === '7,8' && /立秋の前/.test(L.jikoById('seika').when), '新春は1月、盛夏は立秋の前まで');
  // いままでの自動（Letters.jiko）は残し、その月の一覧に入っている
  for (const m of MONTHS) {
    const j = L.jiko(m);
    const f = L.jikoByText(j.formal), s = L.jikoByText(j.soft);
    ok(f && f.style === 'kango' && f.months.includes(m), m + '月の自動のあいさつ「' + j.formal + '」は一覧の' + m + '月にある');
    ok(s && s.style === 'soft' && s.months.includes(m), m + '月の自動のやわらかいあいさつも一覧の' + m + '月にある');
  }
  // しぼりこみ
  ok(L.jikoList(10, 'school').every((e) => e.style !== 'soft') && L.jikoList(10, 'parent').some((e) => e.style === 'soft'), '相手が「ほかの学校」なら、改まった言い方だけ');
  const order = L.jikoList(6).map((e) => e.style);
  ok(order.join() === order.slice().sort((a, b) => ['kango', 'soft', 'any'].indexOf(a) - ['kango', 'soft', 'any'].indexOf(b)).join(), '一覧は 改まった → やわらかい → 季節を問わない の順');
  // {時候} に入れる形と、書き出しの1文
  ok(L.jikoLead(L.jikoById('shuurei')) === '秋冷の候' && L.jikoLead(L.jikoById('s-suzushiku')) === '朝夕はめっきり涼しくなってまいりましたが', '{時候} に入れる形（やわらかい言い方は「〜ましたが」）');
  ok(L.jikoOpening(L.jikoById('shuurei'), 'parent') === '秋冷の候、保護者の皆様にはますますご清祥のこととお喜び申し上げます。', '書き出しの1文（保護者）');
  ok(L.jikoOpening(L.jikoById('jika'), 'school') === '時下、貴校におかれましてはますますご清栄のこととお慶び申し上げます。', '書き出しの1文（ほかの学校・時下）');
  for (const e of J) for (const a of e.aite) {
    const s = L.jikoOpening(e, a);
    ok(s.startsWith(e.text) && /、/.test(s) && /申し上げます。$/.test(s) && !/。が|、、|が、が/.test(s), `書き出しの1文が正しくつながる（${e.text}・${a}）`);
  }
}

/* ───────── ひな形 ───────── */
section('ひな形（改まった文書・すべての差し込み）');
const AUTO = { 学校名: 'ひかり中学校', 先生名: '山田', クラス: '2年3組', 学年: '第2学年', 発行日: '令和8年10月15日', 今日: '10月15日（木）', 明日: '10月16日（金）', 年度: '令和8年度', 時候: '秋冷の候', 時候やわらか: '朝夕はめっきり涼しく', 生徒名: '青木 そら' };
// 画面（js/apps/templates.js）と同じ、宛名・発信者のきまり
const TO = { parent: '保護者 様', formal: '保護者 各位', student: '{クラス}の皆さん', staff: '先生方' };
const fromOf = (t) => t.from || (t.group === 'formal' ? '{学校名}\n校長　{校長名}' : '{学校名}\n{クラス}担任　{先生名}');
const make = (t, extra) => {
  const v = Object.assign({}, AUTO, t.examples, extra || {});
  const f = (s) => L.fill(s, v);
  return { date: AUTO.発行日, to: f(t.to || TO[t.group] || ''), from: f(fromOf(t)), title: f(t.title), body: f(t.body), note: f(t.note), reply: f(t.reply), font: 'mincho' };
};
{
  const T = L.TEMPLATES;
  ok(new Set(T.map((t) => t.id)).size === T.length, 'ひな形の id がかぶらない（' + T.length + 'こ）');
  ok(L.GROUPS.every((g) => T.some((t) => t.group === g.id)) && T.every((t) => L.GROUPS.some((g) => g.id === t.group)), 'どのひな形も分類のどれかに入る');
  for (const t of T) {
    const o = make(t);
    const left = L.keys(o.title, o.to, t.kind === 'letter' ? o.from : '', o.body, o.note, o.reply);
    ok(left.length === 0, `「${t.id}」：自動の値と例で、宛名・発信者もふくめて差し込みが全部うまる` + (left.length ? '（' + left.join('・') + '）' : ''));
    ok(!/\{時候\}(?!、)/.test(t.body), `「${t.id}」：{時候} のあとは「、」（やわらかい言い方も「〜ましたが、」でつながる）`);
  }
  const F = T.filter((t) => t.group === 'formal');
  ok(F.length >= 10, '改まった文書が10こ以上（' + F.length + 'こ）');
  ok(['parent', 'meue', 'school'].every((a) => F.some((t) => t.aite === a)), '改まった文書：保護者あて・目上の方あて・ほかの学校あてがそろう');
  for (const t of F) {
    const where = `「${t.title}」`;
    const body = t.body.split('\n');
    ok(t.kind === 'letter', where + '：文書（印刷・Word）');
    ok(body[0].startsWith('拝啓　{時候}、'), where + '：「拝啓　{時候}、」で始まる');
    ok(/ご清祥|ご健勝|ご清栄/.test(body[0]) && /申し上げます。/.test(body[0]), where + '：安否のあいさつがある');
    ok(L.isKetsugo(body[body.length - 1]) && body[body.length - 1] === '敬具' && body.filter((x) => L.isKetsugo(x)).length === 1, where + '：最後の行が「敬具」（1回だけ）');
    ok(body.slice(1, -1).every((x) => x.startsWith('　')), where + '：本文の段落は1字下げ');
    ok(/。$/.test(body[body.length - 2]) && body.slice(2, -1).some((x) => /(ご案内|お願い|御礼|ご依頼)申し上げます。|お待ちしております。/.test(x)), where + '：さての段落のあとに、結びのあいさつがある');
    ok(String(t.note).trim() && t.note.split('\n').every((x, i) => x.startsWith('１２３４５６７８９'[i] + '　')), where + '：記の項目が「１　」「２　」…と並ぶ');
    ok(t.note.split('\n').every((x) => /^[１-９]　[^　]{1,3}(　[^　])?　　/.test(x) && x.split('　　')[0].slice(2).length === 3), where + '：記の項目名は3字の幅（「日　時」「持ち物」）で、中身の列がそろう');
    ok(fromOf(t).includes('{学校名}') && (t.to || '').trim(), where + '：宛名と、学校名の入った発信者がある');
    // できあがりの文字：日付 → 宛名 → 発信者 → 件名 → 拝啓 … 敬具 → 記 → 以上
    const o = make(t);
    const lines = L.letterText(o).split('\n');
    const at = (s) => lines.findIndex((x) => x === s || x.startsWith(s));
    const iTitle = lines.indexOf(o.title), iHaikei = at('拝啓'), iKeigu = at('敬具'), iKi = lines.indexOf('記'), iIjo = lines.indexOf('以上');
    ok(lines[0] === AUTO.発行日 && 0 < iTitle && iTitle < iHaikei && iHaikei < iKeigu && iKeigu < iKi && iKi < iIjo, where + '：日付 → 件名 → 拝啓 → 敬具 → 記 → 以上 の順');
    ok(lines[iHaikei].startsWith('拝啓　秋冷の候、'), where + '：拝啓のあとに時候のあいさつが入る');
  }
  // やわらかい言い方を選んだとき・時下のとき
  const kai = T.find((t) => t.id === 'f-hogoshakai');
  const soft = make(kai, { 時候: L.jikoLead(L.jikoById('s-suzushiku')) });
  ok(soft.body.startsWith('拝啓　朝夕はめっきり涼しくなってまいりましたが、保護者の皆様には'), 'やわらかい言い方を選ぶと「〜ましたが、保護者の皆様には」とつながる');
  const heisa = T.find((t) => t.id === 'f-heisa');
  ok(heisa.jiko === 'jika' && L.jikoById(heisa.jiko), '学級閉鎖（急ぎのお知らせ）は、はじめから「時下」');
  ok(make(heisa, { 時候: L.jikoLead(L.jikoById('jika')) }).body.startsWith('拝啓　時下、保護者の皆様には'), '「時下、保護者の皆様には」とつながる');
  // 返信票（切り取り）
  for (const id of ['f-hogoshakai', 'f-shinro', 'f-pta', 'f-shotai']) ok(String(T.find((t) => t.id === id).reply).includes('欠席'), `「${id}」：切り取りの出欠票がある`);
  ok(/委任/.test(T.find((t) => t.id === 'f-pta').reply), 'PTA総会：委任状がある');
  ok(L.kiHang('１　日　時　　11月13日') === 7 && L.kiHang('４　持ち物　　上ばき') === 7 && L.kiHang('ふつうの行') === 0, '記の行の、中身が始まるまでの字数');
  // 結語の見分け
  ok(L.isKetsugo('敬具') && L.isKetsugo('　敬具 ') && L.isKetsugo('草々') && !L.isKetsugo('敬具です') && !L.isKetsugo('　よろしくお願いいたします。'), '結語（敬具・草々）の行だけを見分ける');
}

/* ───────── Word（.docx）の形 ───────── */
section('Word（.docx）の形');
function unzip(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let end = buf.length - 22;
  while (end >= 0 && dv.getUint32(end, true) !== 0x06054b50) end--;
  const n = dv.getUint16(end + 10, true);
  let p = dv.getUint32(end + 16, true);
  const out = {};
  for (let i = 0; i < n; i++) {
    const size = dv.getUint32(p + 20, true), nameLen = dv.getUint16(p + 28, true), off = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(buf.subarray(p + 46, p + 46 + nameLen));
    const lnl = dv.getUint16(off + 26, true);
    out[name] = new TextDecoder().decode(buf.subarray(off + 30 + lnl, off + 30 + lnl + size));
    p += 46 + nameLen;
  }
  return out;
}
const unesc = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
function paras(xml) {
  return [...xml.matchAll(/<w:p>([\s\S]*?)<\/w:p>/g)].map((m) => ({
    text: unesc([...m[1].matchAll(/<w:t xml:space="preserve">([\s\S]*?)<\/w:t>/g)].map((x) => x[1]).join('')),
    jc: (/<w:jc w:val="(\w+)"\/>/.exec(m[1]) || [])[1] || 'left',
    b: /<w:b\/>/.test(m[1]),
    ind: /<w:ind /.test(m[1]),
  }));
}
for (const t of L.TEMPLATES.filter((x) => x.group === 'formal')) {
  const o = make(t);
  const doc = unzip(Docx.build(L.letterDocx(o)))['word/document.xml'];
  const P = paras(doc);
  const find = (s) => P.find((p) => p.text === s);
  const where = `「${o.title}」`;
  const fromLines = o.from.split('\n');
  ok(find(o.date) && find(o.date).jc === 'right', where + '：日付は右');
  ok(fromLines.every((s) => find(s) && find(s).jc === 'right'), where + '：発信者は右');
  ok(o.to.split('\n').every((s) => find(s) && find(s).jc === 'left'), where + '：宛名は左');
  ok(find(o.title) && find(o.title).jc === 'center' && find(o.title).b, where + '：件名は真ん中・太字');
  ok(find('敬具') && find('敬具').jc === 'right', where + '：敬具は右');
  ok(find('記') && find('記').jc === 'center', where + '：記は真ん中');
  ok(find('以上') && find('以上').jc === 'right', where + '：以上は右');
  ok(o.note.split('\n').every((s) => find(s) && find(s).ind), where + '：記の項目は字下げ');
  ok(/<w:ind w:left="\d+" w:hanging="\d+"\/>/.test(doc), where + '：記の折り返した行は、中身の列にそろう（ぶら下げ）');
  const order = [o.date, o.title, '敬具', '記', '以上'].map((s) => P.findIndex((p) => p.text === s));
  ok(order.every((x, i) => x >= 0 && (i === 0 || x > order[i - 1])), where + '：Word でも 日付 → 件名 → 敬具 → 記 → 以上 の順');
  ok(!/\{[^{}]+\}/.test(doc), where + '：Word に差し込みの { } が残らない');
}

console.log(`\n${failed ? '✗' : '✓'} ${passed} 件 OK${failed ? ` / ${failed} 件 NG` : ''}`);
process.exit(failed ? 1 : 0);

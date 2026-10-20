#!/usr/bin/env node
/* チラシの確かめ（js/core/flyer-templates.js と js/apps/flyer.js）
   ・Node で：テンプレートが必要な項目をすべて持つ・差し込みが全部うまる・日付と締切の決まり・雰囲気と色のかたより・
             色の見やすさ（白黒の印刷でも）・見出しの大きさ・あふれの判定・日付をずらしたときの締切
   ・本物のブラウザ（Chrome）で：全テンプレート × A4 たて・A4 よこ・B5 たて が、見本の文のまま1枚に入る／横にはみ出さない／
             差し込みの印 { } が紙面に残らない／文字が多いと小さくなり、もっと多いと「入りきらない」になる／
             画面の流れ（選ぶ → 書きかえると保存 → 一覧 → 写す → 消す、カレンダーから入れる、日付を変えると締切もずれる）
   使い方：  node tools/test-flyer.cjs            （ブラウザの確かめを省くときは --node） */
const fs = require('fs');
const os = require('os');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const FT = require(path.join(ROOT, 'js/core/flyer-templates.js'));

let failed = 0, passed = 0;
const ok = (cond, msg) => { if (cond) passed++; else { failed++; console.log('NG  ' + msg); } };
const section = (t) => console.log('── ' + t);
const isYmd = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const dow = (s) => new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)).getDay();
const weekend = (s) => dow(s) === 0 || dow(s) === 6;
const holes = (f) => FT.TEXT_KEYS.concat(['date', 'endDate', 'start', 'end', 'deadline']).filter((k) => /\{[^{}]*\}/.test(String(f[k] || '')));

/* ───────── テンプレートの中身 ───────── */
section('テンプレート');
{
  const T = FT.TEMPLATES;
  ok(T.length >= 12, 'テンプレートは12こ以上（' + T.length + 'こ）');
  ok(new Set(T.map((t) => t.id)).size === T.length && new Set(T.map((t) => t.label)).size === T.length, 'id と名前が重ならない');
  const STY = new Set(FT.STYLES.map((s) => s.id)), PAL = new Set(FT.PALETTES.map((p) => p.id)), CAT = new Set(FT.CATS.map((c) => c.id));
  const NEED = ['kicker', 'head', 'sub', 'body', 'target', 'contact', 'org'];
  for (const t of T) {
    ok(t.label && t.desc && CAT.has(t.cat) && STY.has(t.style) && PAL.has(t.palette) && FT.MOTIFS[t.motif], t.id + '：名前・説明・種類・雰囲気・色・絵がそろう');
    ok(t.when && (Number.isFinite(t.when.in) || /^\d{2}-\d{2}$/.test(t.when.md || '')), t.id + '：日付の決め方がある');
    ok(FT.TEXT_KEYS.every((k) => typeof t.text[k] === 'string'), t.id + '：文字の項目をすべて持つ（' + FT.TEXT_KEYS.filter((k) => typeof t.text[k] !== 'string').join(',') + '）');
    ok(NEED.every((k) => t.text[k].trim()), t.id + '：見出し・本文・対象・問い合わせなど、なくてはならない項目に見本の文が入っている');
    ok(FT.ROWS.every((k) => k in t.labels) && ['when', 'place', 'target', 'bring', 'apply'].every((k) => t.labels[k]), t.id + '：表の項目の名前がそろう');
    ok(!t.when.start || /^\d{1,2}:\d{2}$/.test(t.when.start), t.id + '：時刻の形');
    ok(t.text.body.split('\n').length >= 3 && t.text.body.length <= 220, t.id + '：本文は3行以上・220字まで（' + t.text.body.length + '字）');
  }
  // 依頼された場面がそろっているか
  const want = { 'テスト前の学習会': 'study-test', '夏休みの学習会': 'study-summer', 保護者会: 'parents', 学校説明会: 'school-info', 体験授業: 'trial-lesson', 大会の応援: 'club-cheer', 文化祭: 'culture-fes', 体育祭: 'sports-day', ボランティア募集: 'volunteer', 係の募集: 'role-recruit', 図書室だより: 'library', 保健のお知らせ: 'health', 進路の講演会: 'career-talk', 地域のイベント: 'community', 'お知らせ（汎用）': 'notice' };
  for (const [name, id] of Object.entries(want)) ok(!!FT.get(id), '場面「' + name + '」のテンプレートがある');
  // 雰囲気が偏らない
  const count = FT.STYLES.map((s) => T.filter((t) => t.style === s.id).length);
  ok(count.every((n) => n >= 2) && Math.max(...count) <= 2 * Math.min(...count), '雰囲気（すっきり・ポップ・和風・黒板風・新聞風）がかたよらない：' + count.join('・'));
  ok(new Set(T.map((t) => t.palette)).size >= 7, '色の組み合わせもいろいろ（' + new Set(T.map((t) => t.palette)).size + '種類）');
  ok(new Set(T.map((t) => t.motif)).size === T.length, '絵はテンプレートごとにちがう');
  ok(FT.CATS.every((c) => T.some((t) => t.cat === c.id)), 'どの種類（学習・行事・保護者と地域・募集・おたより）にもテンプレートがある');
}

/* ───────── 新しいチラシ（差し込み・日付） ───────── */
section('差し込みと日付');
{
  const ctxs = [
    { name: '学校の設定あり', c: { school: 'ひかり中学校', teacher: 'かず先生', cls: '2年3組' } },
    { name: '学校の設定なし', c: {} },
  ];
  for (const today of ['2026-10-20', '2027-01-04', '2027-06-30', '2027-12-24']) {
    for (const { name, c } of ctxs) {
      for (const t of FT.TEMPLATES) {
        const f = FT.make(t.id, Object.assign({ today }, c));
        const tag = t.id + '（' + today + '・' + name + '）';
        ok(holes(f).length === 0, tag + '：差し込みが全部うまる ' + holes(f).join(','));
        ok(isYmd(f.date) && f.date > today, tag + '：日付は今日より先 ' + f.date);
        if (t.when.dow != null) ok(dow(f.date) === t.when.dow, tag + '：決めた曜日');
        ok([f.start, f.end].every((x) => x === '' || /^\d{2}:\d{2}$/.test(x)), tag + '：時刻は入力欄が読める形（09:30）' + f.start);
        if (t.when.days > 1) ok(isYmd(f.endDate) && f.endDate > f.date, tag + '：何日か続く行事は終わりの日がある');
        else ok(f.endDate === '', tag + '：1日の行事は終わりの日なし');
        if (t.deadline) ok(isYmd(f.deadline) && f.deadline >= today && f.deadline < f.date && !weekend(f.deadline), tag + '：締切は今日以降・日付より前・平日 ' + f.deadline);
        else ok(f.deadline === '', tag + '：締切のないテンプレートは締切なし');
        if (t.when.md) ok(f.date.slice(5, 7) === t.when.md.slice(0, 2), tag + '：夏休みの学習会は7月');
        ok(FT.TEXT_KEYS.every((k) => typeof f[k] === 'string') && f.style === t.style && f.palette === t.palette && f.paper === 'a4' && f.qr === '' && f.photo === '', tag + '：形がそろう');
      }
    }
  }
  const full = FT.make('school-info', { today: '2026-10-20', school: 'ひかり中学校', teacher: 'かず先生', cls: '2年3組' });
  ok(full.sub.includes('ひかり中学校') && full.contact.includes('かず先生') && full.org === 'ひかり中学校', '学校名・先生の名前が入る');
  ok(FT.make('study-test', { today: '2026-10-20', cls: '2年3組' }).target === '2年の希望者', 'クラスから学年（2年）を入れる');
  const none = FT.make('school-info', { today: '2026-10-20' });
  ok(none.org === '' && none.sub.includes('本校') && !/\{/.test(none.contact), '学校名がないときは「本校」、発行の欄は空');
  ok(FT.gradeOf('2年3組') === '2年' && FT.gradeOf('３年Ａ組') === '3年' && FT.gradeOf('ひまわり学級') === '', '学年の読み取り（全角の数字も）');
  ok(FT.fill('{学校名}の{なぞ}', {}) === '本校の{なぞ}', '知らない差し込みは残す（入れ忘れが分かる）');
  ok(FT.hhmm('9:30') === '09:30' && FT.hhmm('15:05') === '15:05' && FT.hhmm('25:00') === '' && FT.hhmm('') === '', '時刻をそろえる');
  // 平日の行事が休みの日に当たったら、次の週へ
  const plain = FT.make('study-test', { today: '2026-10-20' });
  const moved = FT.make('study-test', { today: '2026-10-20', isOff: (s) => weekend(s) || s === plain.date });
  ok(moved.date === FT.dateOf({ in: 15, dow: 3 }, '2026-10-20').date && moved.date > plain.date, '休みの日に当たった平日の行事は、次の週へ（' + plain.date + ' → ' + moved.date + '）');
}

/* ───────── 日時・申込みの書き方・表の行 ───────── */
section('日時と申込みの書き方');
{
  const w = (o) => FT.whenText(Object.assign({ date: '2026-10-24', endDate: '', start: '', end: '' }, o));
  ok(w({ start: '13:30', end: '15:00' }).full === '10月24日（土） 13:30〜15:00', '1日・時刻あり：' + w({ start: '13:30', end: '15:00' }).full);
  ok(w({ start: '09:30' }).full === '10月24日（土） 9:30〜', '始まりだけ（0 を取る）');
  ok(w({ endDate: '2026-10-28' }).date === '10月24日（土）〜28日（水）', '同じ月の何日か');
  ok(w({ endDate: '2026-11-06' }).date === '10月24日（土）〜11月6日（金）', '月をまたぐ');
  ok(w({ endDate: '2026-10-20' }).date === '10月24日（土）', '終わりの日が前なら出さない');
  ok(FT.whenText({ date: '' }).full === '', '日付なし');
  const b = FT.badge({ date: '2026-10-24', start: '13:30' });
  ok(b.md === '10/24' && b.wd === '土' && b.sub === '13:30〜', '日付の札');
  ok(FT.badge({ date: '2026-07-26', endDate: '2026-07-30' }).sub === '〜7/30（木）', '日付の札（何日か）');
  ok(FT.applyText({ deadline: '2026-10-16', apply: '担任の先生へ' }) === '10月16日（金）までに、担任の先生へ', '締切つきの申込み');
  ok(FT.applyText({ deadline: '', apply: 'いりません' }) === 'いりません' && FT.applyText({ deadline: '2026-10-16', apply: '' }) === '10月16日（金）まで', '締切だけ・方法だけ');
  const n = FT.make('notice', { today: '2026-10-20' });
  const rows = FT.rows(n);
  ok(!rows.some((r) => r.key === 'place' || r.key === 'bring' || r.key === 'apply') && rows[0].label === '下校', '中身が空の行は出さない・項目の名前はテンプレートのもの');
  ok(FT.rows({ date: '', whenNote: '', place: '', labels: {} }).length === 0, '何もなければ行なし');
}

/* ───────── 日付をずらす ───────── */
section('日付を変えたとき');
{
  const f = { date: '2026-10-28', endDate: '2026-10-30', deadline: '2026-10-23' };
  const g = FT.shiftDate(f, '2026-11-04', '2026-10-20');
  ok(g.date === '2026-11-04' && g.endDate === '2026-11-06' && g.deadline === '2026-10-30', '1週間ずらすと、終わりの日と締切も1週間ずれる');
  const h2 = FT.shiftDate({ date: '2026-10-28', deadline: '2026-10-26' }, '2026-11-03', '2026-10-20');
  ok(h2.deadline === '2026-10-30', '締切が日曜日になるときは、前の金曜日へ（' + h2.deadline + '）');
  const near = FT.shiftDate({ date: '2026-11-20', deadline: '2026-11-06' }, '2026-10-23', '2026-10-20');
  ok(near.deadline === '2026-10-20', '締切が過去になるときは今日（' + near.deadline + '）');
  ok(FT.shiftDate(f, '', '2026-10-20').date === '' && FT.shiftDate(f, '', '2026-10-20').deadline === f.deadline, '日付を消しても、ほかはそのまま');
  ok(FT.shiftDate({ date: '', deadline: '' }, '2026-11-04', '2026-10-20').date === '2026-11-04', '日付がなかったときは入れるだけ');
}

/* ───────── 色（白黒の印刷でも） ───────── */
section('色の組み合わせ');
{
  const P = FT.PALETTES;
  ok(P.length >= 8 && new Set(P.map((p) => p.id)).size === P.length && new Set(P.map((p) => p.label)).size === P.length, '色の組み合わせ ' + P.length + 'つ（名前が重ならない）');
  ok(P.some((p) => p.id === 'sumi'), '白黒の組み合わせもある');
  for (const p of P) {
    const r = (a, b) => Math.min(FT.contrast(a, b), FT.grayContrast(a, b));
    ok(r('#ffffff', p.main) >= 7, p.label + '：濃い色の上の白い文字（カラーでも白黒でも 7 以上）' + r('#ffffff', p.main).toFixed(1));
    ok(r('#1a1a1a', p.wash) >= 12, p.label + '：うすい地の上の黒い文字 ' + r('#1a1a1a', p.wash).toFixed(1));
    ok(r(p.main, p.wash) >= 6, p.label + '：うすい地の上の濃い色の文字 ' + r(p.main, p.wash).toFixed(1));
    ok(r(p.light, p.main) >= 4.5, p.label + '：黒板の上のチョークの色 ' + r(p.light, p.main).toFixed(1));
    ok(FT.lum(FT.gray(p.wash)) >= 0.75, p.label + '：うすい地は、白黒で刷ってもうすい灰色');
    ok(/^#[0-9a-f]{6}$/i.test(p.main + '') && [p.accent, p.wash, p.light].every((c) => /^#[0-9a-f]{6}$/i.test(c)), p.label + '：色の書き方');
  }
  ok(FT.gray('#ff0000') === '#4c4c4c' && Math.abs(FT.contrast('#000000', '#ffffff') - 21) < 0.01, '明るさの計算');
}

/* ───────── 絵・紙 ───────── */
section('絵と紙');
{
  for (const [id, m] of Object.entries(FT.MOTIFS)) {
    ok(m.label && m.shapes.length && m.shapes.every((s) => /^[MmLlHhVvCcSsQqTtAaZz0-9.,\s-]+$/.test(s.d) && ['m', 'w', 'a', 'n'].includes(s.f)), '絵「' + id + '」の形');
  }
  ok(Object.keys(FT.MOTIFS).length >= 15, '絵は15こ以上');
  const P = FT.PAPERS;
  ok(P.a4.w === 210 && P.a4.h === 297 && P.a4l.w === 297 && P.a4l.h === 210 && P.b5.w === 182 && P.b5.h === 257 && P.a4l.land, '紙：A4 たて・A4 よこ・B5 たて');
}

/* ───────── 見出しの大きさ ───────── */
section('見出しの大きさ');
{
  const W = 480;
  const a = FT.headSize('学校説明会', W, { maxPt: 66 }), b = FT.headSize('令和8年度 学校説明会と授業公開', W, { maxPt: 66 });
  ok(a.pt === 66 && b.pt < a.pt, '短い見出しは大きく、長い見出しは小さく（' + a.pt + ' / ' + b.pt + 'pt）');
  for (const t of FT.TEMPLATES) {
    const r = FT.headSize(t.text.head, W, { maxPt: 66, maxHeightPt: 62 * 72 / 25.4 });
    const longest = Math.max(...t.text.head.split('\n').map((l) => FT.textEm(l, 0.03)));
    ok(r.pt * (longest / r.wrap) <= W + 0.5 || r.wrap > 1, t.id + '：見出しが幅に入る（' + r.pt + 'pt）');
    ok(r.lines * r.pt * 1.2 <= 62 * 72 / 25.4 + 1, t.id + '：見出しの高さが上限まで');
  }
  ok(FT.headSize('あ'.repeat(80), W, { maxPt: 66, minPt: 20 }).tooLong, 'とても長い見出しは「長すぎ」と分かる');
  ok(FT.headSize('', W, { maxPt: 60 }).lines === 0, '見出しなし');
  ok(FT.textEm('ABC') < 3 && FT.textEm('あいう') === 3 && FT.textEm('ｱｲｳ') === 1.5, '文字の幅の見積もり（全角1・半角は半分ほど）');
  const wide = FT.headFit('テスト前の\n学習会', 700, { maxPt: 60, join: true }), narrow = FT.headFit('テスト前の\n学習会', 220, { maxPt: 60, join: true });
  ok(wide.joined && wide.text === 'テスト前の学習会' && wide.lines === 1, 'よこ向きで幅があれば、改行をはずして1行に');
  ok(!narrow.joined && narrow.text === 'テスト前の\n学習会', '幅がなければ改行のまま');
  ok(!FT.headFit('テスト前の\n学習会', 700, { maxPt: 60 }).joined, 'たて向きでは改行のまま');
  ok(FT.joinLines('Welcome\nParty') === 'Welcome Party' && FT.joinLines('がんばれ！\nバスケ部') === 'がんばれ！バスケ部', '1行にするときの空白（英語だけ）');
}

/* ───────── あふれの判定 ───────── */
section('あふれの判定');
{
  const at = (base) => (k) => base * k;           // 倍率に比例して高さが増える見立て
  const r1 = FT.chooseScale(at(0.7));
  ok(r1.k === 1.2 && !r1.over && !r1.shrunk, 'ゆとりがあれば少し大きく（' + r1.k + '）');
  const r2 = FT.chooseScale(at(1.05));
  ok(r2.k === 0.94 && !r2.over && r2.shrunk, '少しあふれるなら小さく（' + r2.k + '）');
  const r3 = FT.chooseScale(at(1.6));
  ok(r3.over && r3.k === 0.7, 'どうしても入らなければ over（いちばん小さい 0.7 のまま）');
  const r4 = FT.chooseScale(at(0.86));
  ok(r4.k === 1.06, '大きくするのは紙の 92% まで（' + r4.k + '）');
  const r5 = FT.chooseScale((k) => (k > 1 ? 2 : 1));
  ok(r5.k === 1 && !r5.over && !r5.shrunk, 'ちょうど入るなら、そのまま');
  ok(FT.fitNote(r3, 'b5').tone === 'bad' && /入りきりません/.test(FT.fitNote(r3, 'b5').text) && /A4 たて/.test(FT.fitNote(r3, 'b5').text), '入らないときは赤で知らせ、B5 なら A4 をすすめる');
  ok(!/A4 たてにする/.test(FT.fitNote(r3, 'a4').text), 'A4 たてのときは A4 をすすめない');
  ok(FT.fitNote(r2, 'a4').tone === 'warn' && /94%/.test(FT.fitNote(r2, 'a4').text), '小さくしたときは何%か知らせる');
  ok(FT.fitNote(r1, 'a4').tone === 'ok' && /A4 たて・1枚に入っています/.test(FT.fitNote(r1, 'a4').text), '入っているとき');
  ok(/Enter で2行/.test(FT.fitNote(Object.assign({}, r1, { head: { tooLong: true } }), 'a4').text), '見出しが長すぎるときは、改行をすすめる');
  ok(FT.fitNote(null, 'a4').text === '', 'まだ測っていないとき');
}

/* ───────── 本物のブラウザで ───────── */
async function browser() {
  const LIB = path.join(os.homedir(), '.claude/skills/shiage/scripts/lib/cdp.cjs');
  const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  if (!fs.existsSync(LIB) || !fs.existsSync(CHROME)) { console.log('（Chrome か /shiage の道具がないので、ブラウザの確かめは省きます）'); return; }
  // index.html にチラシのテンプレートの行がまだなければ、足した写しを一時フォルダに作って開く
  let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  let url = 'file://' + path.join(ROOT, 'index.html');
  if (!html.includes('js/core/flyer-templates.js')) {
    html = html.replace('<script src="js/apps/home.js"></script>', '<script src="js/core/flyer-templates.js"></script>\n<script src="js/apps/home.js"></script>').replace('<head>', '<head>\n<base href="file://' + encodeURI(ROOT) + '/">');
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sk-flyer-'));
    fs.writeFileSync(path.join(tmp, 'index.html'), html);
    url = 'file://' + path.join(tmp, 'index.html');
    console.log('（index.html に js/core/flyer-templates.js の行がないので、足した写しで確かめます）');
  }
  const { launch } = require(LIB);
  const b = await launch({ width: 1366, height: 900, maxMs: 6 * 60 * 1000 });
  try {
    const p = await b.page(url + '#flyer');
    await p.wait('window.Kit && Kit.current && Kit.current() === "flyer" && document.querySelector(".fl-tpl")', 20000);
    await p.eval('document.fonts.ready.then(() => 1)');

    section('紙面（ブラウザ）：全テンプレート × 3つの紙');
    const res = JSON.parse(await p.eval(`(async () => {
      const out = [];
      const box = document.createElement('div'); box.style.cssText = 'position:absolute;left:-5000px;top:0'; document.body.append(box);
      for (const t of FlyerTemplates.TEMPLATES) for (const paper of ['a4', 'a4l', 'b5']) {
        const f = SenseiFlyer.norm(Object.assign(FlyerTemplates.make(t.id, { today: Kit.ymd(), school: 'ひかり中学校（架空）', teacher: 'かず先生', cls: '2年3組', isOff: School.isOff }), { paper }));
        const pg = SenseiFlyer.pageEl(f, {}); box.append(pg);
        const r = SenseiFlyer.fitPage(pg, f);
        const text = pg.textContent;
        const need = [f.kicker, f.sub, f.contact.split('\\n')[0], f.body.split('\\n')[0]].map((s) => s.trim()).filter(Boolean);
        const R = pg.getBoundingClientRect();
        const wide = [...pg.querySelectorAll('*')].filter((e) => { if (e.closest('svg') && e.tagName.toLowerCase() !== 'svg') return false; const q = e.getBoundingClientRect(); return q.width > 0 && (q.left < R.left - 0.5 || q.right > R.right + 0.5 || q.top < R.top - 0.5); }).map((e) => e.className && e.className.baseVal != null ? e.className.baseVal : e.className);
        out.push({ id: t.id, paper, k: r.k, over: r.over, head: r.head && r.head.pt, rows: pg.querySelectorAll('.fl-r').length, want: FlyerTemplates.rows(f).length,
          missing: need.filter((s) => !text.includes(s)), headOk: FlyerTemplates.joinLines(f.head).replace(/\\s/g, '') === pg.querySelector('.fl-head').textContent.replace(/\\s/g, ''),
          holes: /\\{[^{}]*\\}/.test(text), wide, pageW: pg.scrollWidth - pg.clientWidth });
        pg.remove();
      }
      box.remove();
      return JSON.stringify(out);
    })()`));
    for (const r of res) {
      const tag = r.id + '（' + r.paper + '）';
      ok(!r.over && r.k >= 0.82, tag + '：見本の文のまま1枚に入る（倍率 ' + r.k + '）');
      ok(r.rows === r.want && r.missing.length === 0 && r.headOk, tag + '：見出し・本文・表・問い合わせがすべて紙面に出る ' + r.missing.join('／'));
      ok(!r.holes, tag + '：差し込みの印 { } が残らない');
      ok(r.wide.length === 0 && r.pageW <= 1, tag + '：紙の外にはみ出さない ' + r.wide.join(','));
    }
    ok(res.filter((r) => r.paper === 'a4').every((r) => r.k >= 1), 'A4 たてでは、どのテンプレートも小さくしないで入る');

    section('あふれ（ブラウザ）');
    const of = JSON.parse(await p.eval(`(() => {
      const box = document.createElement('div'); box.style.cssText = 'position:absolute;left:-5000px;top:0'; document.body.append(box);
      const base = SenseiFlyer.norm(FlyerTemplates.make('school-info', { today: Kit.ymd() }));
      const out = [];
      for (const n of [1, 2, 3, 4, 6, 10]) {
        const f = Object.assign({}, base, { body: Array.from({ length: n }, () => base.body).join('\\n') });
        const pg = SenseiFlyer.pageEl(f, {}); box.append(pg);
        const r = SenseiFlyer.fitPage(pg, f);
        out.push({ n, k: r.k, over: r.over, shrunk: r.shrunk, note: FlyerTemplates.fitNote(r, 'a4') });
        pg.remove();
      }
      const lf = Object.assign({}, base, { head: 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん' });
      const pg = SenseiFlyer.pageEl(lf, {}); box.append(pg); const r = SenseiFlyer.fitPage(pg, lf);
      const hd = pg.querySelector('.fl-head');
      out.push({ long: true, pt: r.head.pt, tooLong: r.head.tooLong, fitsW: hd.scrollWidth <= hd.clientWidth + 2 });
      box.remove();
      return JSON.stringify(out);
    })()`));
    const ks = of.filter((x) => !x.long);
    ok(ks.every((x, i) => i === 0 || x.k <= ks[i - 1].k), '本文が長くなるほど、文字は小さくなる（' + ks.map((x) => x.k).join(' → ') + '）');
    ok(ks.some((x) => x.shrunk && !x.over && x.note.tone === 'warn'), '少し長いときは、小さくして1枚に入れ、知らせる');
    ok(ks[ks.length - 1].over && ks[ks.length - 1].note.tone === 'bad', 'とても長いときは「入りきらない」と赤で知らせる');
    const lg = of.find((x) => x.long);
    ok(lg.fitsW && lg.pt <= 30, 'とても長い見出しは小さくなり、横にはみ出さない（' + lg.pt + 'pt）');

    section('QRコード・印刷用の紙面');
    const q = JSON.parse(await p.eval(`(() => {
      const a = SenseiFlyer.qrOf('https://example.com/form?id=123'), z = SenseiFlyer.qrOf('x'.repeat(1200));
      const f = SenseiFlyer.norm(Object.assign(FlyerTemplates.make('trial-lesson', { today: Kit.ymd() }), { qr: 'https://example.com/form' }));
      const box = document.createElement('div'); box.style.cssText = 'position:absolute;left:-5000px;top:0'; document.body.append(box);
      const pg = SenseiFlyer.pageEl(f, { qr: SenseiFlyer.qrOf(f.qr).url }); box.append(pg);
      const r = SenseiFlyer.fitPage(pg, f);
      const pr = SenseiFlyer.pageEl(f, { qr: SenseiFlyer.qrOf(f.qr).url, print: true }); box.append(pr); SenseiFlyer.applyFit(pr, r);
      const o = { a: a.url.slice(0, 22), aErr: a.err, zErr: z.err, qrImg: !!pg.querySelector('.fl-qr img'), qrLabel: (pg.querySelector('.fl-qr span') || {}).textContent,
        same: pr.querySelector('.fl-head').style.fontSize === pg.querySelector('.fl-head').style.fontSize && pr.style.getPropertyValue('--fk') === pg.style.getPropertyValue('--fk'),
        lower: pg.offsetHeight - pr.offsetHeight, over: r.over,
        times: FlyerTemplates.TEMPLATES.filter((t) => t.when.start).every((t) => { const i = document.createElement('input'); i.type = 'time'; i.value = FlyerTemplates.make(t.id, { today: Kit.ymd() }).start; return i.value !== ''; }) };
      box.remove();
      return JSON.stringify(o);
    })()`));
    ok(q.a === 'data:image/png;base64,' && !q.aErr && /QRコードにできません/.test(q.zErr), 'URL から QRコード（長すぎるときは知らせる）');
    ok(q.qrImg && q.qrLabel === '申込みフォーム' && !q.over, 'QRコードが紙面に入り、説明がつく');
    ok(q.same && q.lower > 0 && q.lower < 3, '印刷用の紙面は、画面と同じ大きさの文字（2枚目が出ないよう、わずかに低い）');
    ok(q.times, 'どのテンプレートの時刻も、時刻の入力欄に入る');

    section('画面の流れ（ブラウザ）');
    const n0 = await p.eval('Kit.store.list("flyers").then((a) => a.length)');
    await p.eval(`(document.querySelector('.fl-tpl[data-tpl="parents"] .fl-tpl-go').click(), 1)`);
    await p.wait('document.querySelector(".fl-edit") && document.querySelector(".fl-status").textContent.length > 0', 8000);
    ok(/1枚に入っています/.test(await p.eval('document.querySelector(".fl-status").textContent')), 'テンプレートを選ぶと、書きかえの画面と「1枚に入っています」');
    await p.eval(`(document.querySelector('.fl-bar .btn').click(), 1)`);
    await p.wait('document.querySelector(".fl-tpl")', 8000);
    await new Promise((r) => setTimeout(r, 600));
    ok(await p.eval('Kit.store.list("flyers").then((a) => a.length)') === n0, '書きかえずに戻ると、保存しない（一覧が増えない）');
    await p.eval(`(document.querySelector('.fl-tpl[data-tpl="parents"] .fl-tpl-go').click(), 1)`);
    await p.wait('document.querySelector("#fl-in-place")', 8000);
    const before = JSON.parse(await p.eval(`JSON.stringify({ date: document.getElementById('fl-in-date').value, dl: document.getElementById('fl-in-deadline').value })`));
    await p.eval(`(() => { const e = document.getElementById('fl-in-place'); e.value = '本物の体育館'; e.dispatchEvent(new Event('input', { bubbles: true })); const d = document.getElementById('fl-in-date'); const x = new Date(d.value); x.setDate(x.getDate() + 7); d.value = Kit.ymd(x); d.dispatchEvent(new Event('input', { bubbles: true })); return 1; })()`);
    await new Promise((r) => setTimeout(r, 900));
    const after = JSON.parse(await p.eval(`JSON.stringify({ date: document.getElementById('fl-in-date').value, dl: document.getElementById('fl-in-deadline').value, page: document.querySelector('.fl-pv .fl-page').textContent })`));
    ok(Math.round((new Date(after.dl) - new Date(before.dl)) / 86400000) >= 5 && after.dl < after.date, '日付を1週間ずらすと、締切もずれる（' + before.dl + ' → ' + after.dl + '）');
    ok(after.page.includes('本物の体育館'), '書いたそばから紙面に入る');
    ok(await p.eval('Kit.store.list("flyers").then((a) => a.length)') === n0 + 1, '書きかえると保存される');
    // カレンダーから
    await p.eval(`(Kit.demo.btn('カレンダーの予定から入れる')().click(), 1)`);
    await p.wait('document.querySelector(".modal .fl-ev")', 5000);
    const ev = await p.eval(`(() => { const b = document.querySelector('.modal .fl-ev'); const t = b.querySelector('b').textContent; b.click(); return t; })()`);
    await new Promise((r) => setTimeout(r, 700));
    const cal = JSON.parse(await p.eval(`Kit.store.list('events').then((evs) => { const C = window.SenseiCalendar; const occ = C.occurrences(evs, Kit.ymd(), Kit.ymd(Kit.addDays(Kit.today(), 120))).filter((e) => !['meeting','private'].includes(e.cat)).sort((a, b) => (a.occ + (a.allDay ? '' : a.start || '')).localeCompare(b.occ + (b.allDay ? '' : b.start || '')))[0]; return JSON.stringify({ occ: occ.occ, val: document.getElementById('fl-in-date').value, title: occ.title }); })`));
    ok(cal.title === ev && cal.val === cal.occ, 'カレンダーの予定を選ぶと、その日付が入る（' + ev + '）');
    // 一覧・写す・消す
    await p.eval(`(document.querySelector('.fl-bar .btn').click(), 1)`);
    await p.wait('document.querySelector(".fl-card")', 8000);
    const cards = await p.eval('document.querySelectorAll(".fl-card").length');
    ok(cards === n0 + 1, '一覧に入る（' + cards + '枚）');
    await p.eval(`(Kit.demo.btn('写す', '.fl-card')().click(), 1)`);
    await p.wait('document.querySelector(".fl-edit")', 8000);
    await p.eval(`(document.querySelector('.fl-bar .btn').click(), 1)`);
    await p.wait('document.querySelector(".fl-card")', 8000);
    ok(await p.eval('document.querySelectorAll(".fl-card").length') === n0 + 2, '「写す」で1枚ふえる');
    await p.eval(`(document.querySelector('.fl-card button[title*="消す"]').click(), 1)`);
    await p.wait('document.querySelector(".modal")', 5000);
    ok(/元に戻せません/.test(await p.eval('document.querySelector(".modal").textContent')), '消す前に確かめる');
    await p.eval(`(Kit.demo.modalBtn('消す')().click(), 1)`);
    await new Promise((r) => setTimeout(r, 800));
    ok(await p.eval('document.querySelectorAll(".fl-card").length') === n0 + 1, '消すと1枚へる');
    // 写真：選ぶ → 小さくして保存 → 紙面に入る → 外す（確かめてから）と、保存した写真も消える
    await p.eval(`(document.querySelector('.fl-card .btn').click(), 1)`);
    await p.wait('document.querySelector(".fl-sec-pic")', 8000);
    const png = await p.eval(`(() => { const c = document.createElement('canvas'); c.width = 1600; c.height = 1000; const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 1600, 1000); gr.addColorStop(0, '#2f6fd0'); gr.addColorStop(1, '#f3cf4a'); g.fillStyle = gr; g.fillRect(0, 0, 1600, 1000); return c.toDataURL('image/png'); })()`);
    const pngFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'sk-flyer-img-')), 'photo.png');
    fs.writeFileSync(pngFile, Buffer.from(png.split(',')[1], 'base64'));
    const imgs0 = await p.eval('Kit.store.list("images").then((a) => a.length)');
    await p.eval(`(Kit.demo.btn('写真を選ぶ', '.fl-sec-pic')().click(), 1)`);
    await p.wait('document.querySelector("input[type=file]")', 3000);
    await p.setFiles('input[type=file]', [pngFile]);                // Chrome は入れたときに「選んだ」の通知を出す（出なければ出す）
    await p.eval(`(document.querySelector('input[type=file]') && document.querySelector('input[type=file]').dispatchEvent(new Event('change', { bubbles: true })), 1)`);
    await p.wait('document.querySelector(".fl-pv .fl-photo img")', 8000);
    await new Promise((r) => setTimeout(r, 700));
    const ph = JSON.parse(await p.eval(`Kit.store.list('images').then((a) => JSON.stringify({ n: a.length, size: a.length ? a[a.length - 1].dataUrl.length : 0, w: a.length ? a[a.length - 1].w : 0, status: document.querySelector('.fl-status').textContent }))`));
    ok(ph.n === imgs0 + 1 && ph.size <= 200000 && ph.w <= 1400, '写真は小さくして保存する（' + Math.round(ph.size / 1024) + 'KB・幅 ' + ph.w + '）');
    ok(/1枚に入って|小さくしました/.test(ph.status), '写真を入れても1枚に入る（' + ph.status + '）');
    await p.eval(`(Kit.demo.btn('写真を外す', '.fl-sec-pic')().click(), 1)`);
    await p.wait('document.querySelector(".modal")', 3000);
    await p.eval(`(Kit.demo.modalBtn('外す')().click(), 1)`);
    await new Promise((r) => setTimeout(r, 900));
    ok(await p.eval('Kit.store.list("images").then((a) => a.length)') === imgs0 && !(await p.eval('!!document.querySelector(".fl-pv .fl-photo")')), '写真を外すと、紙面からも保存からも消える');
    const errs = p.errors();
    ok(errs.length === 0, 'エラーなし ' + JSON.stringify(errs).slice(0, 300));
  } finally { await b.close(); }
}

(async () => {
  if (!process.argv.includes('--node')) {
    try { await browser(); } catch (e) { failed++; console.log('NG  ブラウザの確かめが止まりました：' + (e && e.stack || e)); }
  }
  console.log(`\nチラシ：${passed} 件 OK / ${failed} 件 NG`);
  process.exit(failed ? 1 : 0);
})();

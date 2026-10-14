#!/usr/bin/env node
/* 計算の確かめ（画面を通さずに、決まりを守れているかを数で見る）
   ・Node で：席替え・時間割・係決めの「解く部品」
   ・本物のブラウザで：祝日・名簿の読み取り・共有リンクの往復・年間行事の読み取り・ICS の往復・くり返しの次の日
   使い方：  node tools/test.cjs */
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const SeatSolver = require(path.join(ROOT, 'js/core/seat-solver.js'));
const TimetableSolver = require(path.join(ROOT, 'js/core/timetable-solver.js'));
const RolesData = require(path.join(ROOT, 'js/core/roles-data.js'));

let failed = 0, passed = 0;
const ok = (cond, msg) => { if (cond) passed++; else { failed++; console.log('NG  ' + msg); } };
const section = (t) => console.log('── ' + t);

/* ───────── 席替え ───────── */
section('席替え');
{
  const students = Array.from({ length: 32 }, (_, i) => ({ id: 's' + (i + 1), gender: i % 2 ? 'f' : 'm', front: [4, 13, 21].includes(i) }));
  const base = { rows: 6, cols: 6, pairs: true, students, frontRows: 2, apart: [['s3', 's27'], ['s1', 's2'], ['s10', 's11']], emptyBack: true };
  const near = (seats, a, b) => { const pa = Object.keys(seats).find((k) => seats[k] === a).split('-').map(Number), pb = Object.keys(seats).find((k) => seats[k] === b).split('-').map(Number); return Math.abs(pa[0] - pb[0]) <= 1 && Math.abs(pa[1] - pb[1]) <= 1; };
  for (const mix of ['none', 'side', 'checker', 'cols']) {
    for (let seed = 1; seed <= 5; seed++) {
      const r = SeatSolver.solve(Object.assign({}, base, { mix, seed }));
      const placed = Object.values(r.seats);
      ok(r.ok && placed.length === 32 && new Set(placed).size === 32, `全員が1つずつ席につく（mix=${mix}, seed=${seed}）`);
      for (const k of Object.keys(r.seats)) { const [rr] = k.split('-').map(Number); const s = students.find((x) => x.id === r.seats[k]); if (s.front) ok(rr < 2, `「前の席」の人は前から2列目まで（${s.id} → ${k}）`); }
      for (const [a, b] of base.apart) ok(!near(r.seats, a, b), `はなす2人が近くにならない（${a}・${b}, mix=${mix}）`);
      ok(r.issues.length === 0, `守れなかった条件がない（mix=${mix}, seed=${seed}）: ` + JSON.stringify(r.issues.map((x) => x.text)));
      // 空いた4席は後ろの列に
      const empty = []; for (let rr = 0; rr < 6; rr++) for (let c = 0; c < 6; c++) if (!r.seats[rr + '-' + c]) empty.push(rr);
      ok(empty.every((x) => x === 5), '空いた席は後ろの列（' + empty.join(',') + '）');
    }
  }
  // 男女の並び：となり同士は男女
  const side = SeatSolver.solve(Object.assign({}, base, { mix: 'side', seed: 9 }));
  const nb = SeatSolver.neighborsOf(side.seats, 6, 6, [], true);
  let same = 0; for (const [id, list] of Object.entries(nb)) for (const o of list) if (students.find((x) => x.id === id).gender === students.find((x) => x.id === o).gender) same++;
  ok(same === 0, 'となり同士は男女（同じ性別のとなり：' + same + '）');
  // 固定の席は動かない
  const fx = SeatSolver.solve(Object.assign({}, base, { fixed: { '0-0': 's20', '5-5': 's21', '3-2': 's22' }, seed: 3 }));
  ok(fx.seats['0-0'] === 's20' && fx.seats['5-5'] === 's21' && fx.seats['3-2'] === 's22', '固定の席はそのまま');
  // 前回と同じとなりを避ける
  const first = SeatSolver.solve(Object.assign({}, base, { seed: 4 }));
  const second = SeatSolver.solve(Object.assign({}, base, { seed: 5, prev: first.seats }));
  const nb1 = SeatSolver.neighborsOf(first.seats, 6, 6, [], true), nb2 = SeatSolver.neighborsOf(second.seats, 6, 6, [], true);
  let again = 0; for (const [id, list] of Object.entries(nb2)) for (const o of list) if ((nb1[id] || []).includes(o)) again++;
  ok(again === 0, '前回と同じとなりにならない（' + again / 2 + '組）');
  // 机のない場所には座らない・足りないときは知らせる
  const bl = SeatSolver.solve(Object.assign({}, base, { blocked: ['5-0', '5-1'], seed: 2 }));
  ok(!bl.seats['5-0'] && !bl.seats['5-1'] && Object.keys(bl.seats).length === 32, '机のない場所には座らない');
  const few = SeatSolver.solve({ rows: 2, cols: 2, students });
  ok(!few.ok && /席が足りません/.test(few.error), '席が足りないときは理由を返す');
  // 前の席が足りないとき
  const many = SeatSolver.solve(Object.assign({}, base, { students: students.map((s, i) => Object.assign({}, s, { front: i < 15 })), seed: 1 }));
  ok(many.issues.some((x) => x.kind === 'front' && /前の席は12こ/.test(x.text)), '「前の席」が足りないときは、数を添えて知らせる');
}

/* ───────── 時間割 ───────── */
section('時間割');
function makePlan(perGrade, classesPerTeacher) {
  const subjects = [
    ['kokugo', '国語', { 1: 4, 2: 4, 3: 3 }], ['shakai', '社会', { 1: 3, 2: 3, 3: 4 }], ['sugaku', '数学', { 1: 4, 2: 3, 3: 4 }], ['rika', '理科', { 1: 3, 2: 4, 3: 4 }],
    ['ongaku', '音楽', { 1: 1, 2: 1, 3: 1 }], ['bijutsu', '美術', { 1: 1, 2: 1, 3: 1 }], ['taiiku', '保健体育', { 1: 3, 2: 3, 3: 3 }], ['gika', '技術・家庭', { 1: 2, 2: 2, 3: 1 }, true],
    ['eigo', '英語', { 1: 4, 2: 4, 3: 4 }], ['doutoku', '道徳', { 1: 1, 2: 1, 3: 1 }], ['sougou', '総合', { 1: 2, 2: 2, 3: 2 }], ['gakkatsu', '学活', { 1: 1, 2: 1, 3: 1 }],
  ].map(([id, name, hours, block]) => ({ id, name, hours, block: !!block }));
  const classes = []; for (let g = 1; g <= 3; g++) for (let k = 1; k <= perGrade; k++) classes.push({ id: g + '-' + k, name: g + '-' + k, grade: g });
  const teachers = []; const T = (name, off) => { const t = { id: 't' + teachers.length, name, off: off || [] }; teachers.push(t); return t.id; };
  const assign = {}; for (const c of classes) assign[c.id] = {};
  for (const s of ['kokugo', 'shakai', 'sugaku', 'rika', 'eigo', 'taiiku']) { let cur = null, n = 0; for (const c of classes) { if (!cur || n >= classesPerTeacher) { cur = T(s + teachers.length); n = 0; } assign[c.id][s] = [cur]; n++; } }
  const ong = T('音楽', ['3-0', '3-1', '3-2', '3-3', '3-4', '3-5', '4-0', '4-1', '4-2', '4-3', '4-4', '4-5']);
  const bij = T('美術'); const gika = T('技家', ['0-0', '0-1', '0-2', '0-3', '0-4', '0-5']);
  for (const c of classes) { assign[c.id].ongaku = [ong]; assign[c.id].bijutsu = [bij]; assign[c.id].gika = [gika]; const hr = T('担任' + c.id); for (const s of ['doutoku', 'sougou', 'gakkatsu']) assign[c.id][s] = [hr]; }
  const fixed = [{ d: 0, p: 5, subjectId: 'doutoku', grades: null }, { d: 4, p: 5, subjectId: 'gakkatsu', grades: null }, { d: 3, p: 4, subjectId: 'sougou', grades: null }, { d: 3, p: 5, subjectId: 'sougou', grades: null }];
  return { days: 5, perDay: [6, 6, 5, 6, 6], lunchAfter: 4, classes, subjects, teachers, assign, fixed };
}
for (const [pg, cpt] of [[2, 2], [3, 3], [4, 4], [4, 6]]) {
  const plan = makePlan(pg, cpt);
  for (let seed = 1; seed <= 4; seed++) {
    const r = TimetableSolver.solve(plan, { seed });
    ok(r.ok, `${plan.classes.length}クラス（先生1人${cpt}クラス）で全部入る（seed=${seed}）: 入らない ${r.unplaced.length}`);
    const chk = TimetableSolver.check(plan, r.cells);
    ok(!chk.clash.length && !chk.off.length && !chk.twice.length, '先生の重なり・都合・同じ日の2回がない ' + JSON.stringify({ clash: chk.clash.length, off: chk.off.length, twice: chk.twice.length }));
    // 週の時間数どおり
    let wrong = 0;
    for (const c of plan.classes) for (const s of plan.subjects) { const want = TimetableSolver.hoursOf(plan, c, s); const got = Object.values(r.cells[c.id]).filter((x) => x.subjectId === s.id).length; if (want !== got) wrong++; }
    ok(wrong === 0, '教科ごとの週の時間数どおり（ちがう：' + wrong + '）');
    // 固定のコマ
    ok(plan.classes.every((c) => r.cells[c.id]['0-5'].subjectId === 'doutoku' && r.cells[c.id]['4-5'].subjectId === 'gakkatsu'), '固定のコマ（月6 道徳・金6 学活）');
    // 2時間続きは昼休みをまたがず、同じ日に続く
    let badBlock = 0;
    for (const c of plan.classes) for (const [k, x] of Object.entries(r.cells[c.id])) if (x.part === 1) { const [d, p] = k.split('-').map(Number); const nx = r.cells[c.id][d + '-' + (p + 1)]; if (!nx || nx.part !== 2 || nx.subjectId !== x.subjectId || p + 1 === 4) badBlock++; }
    ok(badBlock === 0, '2時間続き（技術・家庭）は続けて、昼休みをまたがない');
  }
}
{
  const plan = makePlan(6, 5);
  const pre = TimetableSolver.precheck(plan);
  ok(pre.length > 0 && pre.some((t) => /持ち時間/.test(t)), 'できない条件（持ち時間がコマより多い）は前もって知らせる');
}

/* ───────── 係決め ───────── */
section('係決め');
{
  ok(RolesData.ITEMS.length >= 100, '係の例が100こ以上（' + RolesData.ITEMS.length + '）');
  ok(new Set(RolesData.ITEMS.map((x) => x.id)).size === RolesData.ITEMS.length, '係の例の id が重ならない');
  ok(['es', 'jhs', 'hs'].every((lv) => RolesData.set(lv, 'kakari').length >= 10 && RolesData.set(lv, 'iinkai').length >= 8), '校種ごとのおすすめがそろっている');
  const roles = RolesData.set('jhs', 'kakari').map((x, i) => ({ id: 'r' + i, name: x.name, count: x.n }));
  const students = Array.from({ length: 32 }, (_, i) => ({ id: 's' + i }));
  for (let seed = 1; seed <= 6; seed++) {
    const wishes = {}; students.forEach((s, i) => { wishes[s.id] = ['r' + ((i * 7 + seed) % 5), 'r' + ((i + seed) % roles.length), 'r' + ((i * 3) % roles.length)]; });
    const r = RolesData.byWish(roles, students, { wishes, seed });
    ok(roles.every((x) => r.assign[x.id].length <= x.count), '定員をこえない（希望, seed=' + seed + '）');
    const all = Object.values(r.assign).flat();
    ok(all.length === 32 && new Set(all).size === 32, '全員がちょうど1つの係（希望, seed=' + seed + '）');
    // 第1希望がかなった人は、くじに負けた人より先に決まっている（くじの記録がある）
    const lot = r.log.filter((l) => l.kind === 'lottery');
    ok(lot.every((l) => l.win.length && l.win.every((w) => l.ids.includes(w))), '当たりは、希望した人の中から（seed=' + seed + '）');
  }
  const keep = { r0: ['s5'], r1: ['s6', 's7'] };
  const k = RolesData.byLottery(roles, students, { keep, seed: 3 });
  ok(k.assign.r0.includes('s5') && k.assign.r1.includes('s6') && k.assign.r1.includes('s7'), 'くじでも、決まっている人はそのまま');
  const small = [{ id: 'a', name: 'A', count: 2 }, { id: 'b', name: 'B', count: 2 }];
  const sm = RolesData.byLottery(small, students.slice(0, 6), { seed: 1 });
  ok(sm.left.length === 2 && sm.log.some((l) => l.kind === 'left'), '定員が足りないときは、決まらなかった人を返す');
}

/* ───────── 本物のブラウザで ───────── */
(async () => {
  section('ブラウザ（祝日・名簿・共有・年間行事・ICS）');
  const { open, closeAll } = require('./check.cjs');
  const { page, errs, close } = await open({ app: 'home', fresh: true, wait: 600 });
  const res = await page.evaluate(async () => {
    const out = {};
    // 祝日（2026〜2027年は、みせびらき の表と同じになるか）
    const ref = { '2026-05-06': '振替休日', '2026-09-22': '国民の休日', '2026-10-12': 'スポーツの日', '2027-03-22': '振替休日', '2027-03-21': '春分の日', '2025-02-24': '振替休日', '2019-05-01': '即位の日', '2020-07-24': 'スポーツの日', '2032-09-21': '国民の休日' };
    out.hol = Object.entries(ref).filter(([k, v]) => School.holiday(k) !== v);
    out.holCount = Object.keys(School.holidaysOf(2026)).length + Object.keys(School.holidaysOf(2027)).length;
    // 名簿の読み取り
    out.r1 = School.parseRoster('番号\t氏名\tふりがな\t性別\n1\t青木 そら\tあおき そら\t男\n2\t井上 ゆい\tいのうえ ゆい\t女');
    out.r2 = School.parseRoster('1\t青木\tそら\n2\t井上\tゆい');
    out.r3 = School.parseRoster('青木 そら\n井上 ゆい\n上田 はると');
    out.r4 = School.parseRoster('3組,5,青木 そら,男');
    // 共有の往復
    const pack = School.share.pack('events', [{ title: '体育祭', date: '2026-10-20', allDay: true, cat: 'gyoji' }, { title: '学年会（第2回）', date: '2026-10-21', start: '15:40', end: '16:30', cat: 'meeting' }], { title: '予定', from: 'テスト' });
    const code = await School.share.encode(pack);
    out.codeKind = code[0];
    out.round = await School.share.decode(code);
    try { await School.share.decode('j' + btoa(JSON.stringify({ app: 'x' }))); out.badRejected = false; } catch (e) { out.badRejected = true; }
    // 年間行事の読み取り（年度 2026）
    const b = SenseiCalendar.bulkParse('4/7(火) 始業式\n4月8日 入学式\n4/20〜4/24 家庭訪問\n5/19 9:00 体育祭\n3/19 修了式\n7/21〜8/31 夏休み\nよくわからない行', 2026);
    out.bulk = b.items.map((x) => [x.date, x.title, x.start || '', x.cat]);
    out.bulkSkipped = b.skipped;
    // すばやく追加の読み取り
    out.q1 = SenseiCalendar.parseQuick('10/20 15:40 学年会', new Date(2026, 9, 14));
    out.q2 = SenseiCalendar.parseQuick('明日 中間テスト', new Date(2026, 9, 14));
    // ICS の往復
    const ics = SenseiCalendar.toIcs([{ id: 'a', title: '職員会議, 第3回', date: '2026-10-15', allDay: false, start: '15:40', end: '17:00', place: '会議室', memo: '行事;確認', repeat: 'none' }, { id: 'b', title: '週案を出す', date: '2026-10-16', allDay: true, repeat: 'weekly', alarm: 'PT8H' }], 'テスト');
    out.icsBack = SenseiCalendar.parseIcs(ics).map((e) => [e.title, e.date, e.start, e.end, e.place, e.memo, e.repeat]);
    out.icsAlarm = /BEGIN:VALARM[\s\S]*TRIGGER;RELATED=START:PT8H/.test(ics);
    // くり返しの次の日（平日は土日・祝日をとばす）
    out.n1 = SenseiReminders.nextDate({ date: '2026-10-09', repeat: 'weekdays' }); // 金 → 10/12 はスポーツの日 → 10/13
    out.n2 = SenseiReminders.nextDate({ date: '2026-01-31', repeat: 'monthly' });
    return out;
  });
  ok(res.hol.length === 0, '祝日（振替休日・国民の休日・特別な年）' + JSON.stringify(res.hol));
  ok(res.holCount === 35, '2026〜2027年の祝日の数（35）: ' + res.holCount);
  ok(res.r1.length === 2 && res.r1[0].name === '青木 そら' && res.r1[0].kana === 'あおき そら' && res.r1[0].gender === 'm' && res.r1[1].gender === 'f', '名簿：見出しつき（番号・氏名・ふりがな・性別）');
  ok(res.r2.length === 2 && res.r2[0].name === '青木 そら' && res.r2[1].no === 2, '名簿：番号・姓・名の3列');
  ok(res.r3.length === 3 && res.r3[2].no === 3 && res.r3[0].name === '青木 そら', '名簿：名前だけ（番号は1から）');
  ok(res.r4.length === 1 && res.r4[0].no === 5 && res.r4[0].gender === 'm', '名簿：組・番号・氏名・性別（CSV）');
  ok(res.codeKind === 'z' && res.round.items.length === 2 && res.round.items[1].title === '学年会（第2回）', '共有リンク：縮めて、元どおりに戻る');
  ok(res.badRejected, '共有リンク：ほかのデータは受け取らない');
  const want = [['2026-04-07', '始業式', '', 'gyoji'], ['2026-04-08', '入学式', '', 'gyoji'], ['2026-04-20', '家庭訪問', '', 'parent'], ['2026-04-24', '家庭訪問', '', 'parent'], ['2026-05-19', '体育祭', '09:00', 'gyoji'], ['2027-03-19', '修了式', '', 'gyoji']];
  for (const w of want) ok(res.bulk.some((x) => x[0] === w[0] && x[1] === w[1] && x[2] === w[2] && x[3] === w[3]), '年間行事の読み取り：' + w.join(' '));
  ok(res.bulk.filter((x) => x[1] === '家庭訪問').length === 5, '「4/20〜4/24」は5日ぶんになる');
  ok(res.bulk.some((x) => x[0] === '2026-07-21' && /夏休み（〜/.test(x[1])) && res.bulk.some((x) => x[0] === '2026-08-31' && /おわり/.test(x[1])), '長い期間は、はじめとおわりの2つにする');
  ok(res.bulkSkipped.length === 1, '日付のない行は読めないとして返す');
  ok(res.q1.date === '2026-10-20' && res.q1.start === '15:40' && res.q1.title === '学年会' && res.q1.cat === 'meeting', 'すばやく追加：10/20 15:40 学年会');
  ok(res.q2.date === '2026-10-15' && res.q2.cat === 'test', 'すばやく追加：明日 中間テスト');
  ok(res.icsBack.length === 2 && res.icsBack[0][0] === '職員会議, 第3回' && res.icsBack[0][2] === '15:40' && res.icsBack[0][3] === '17:00' && res.icsBack[0][5] === '行事;確認' && res.icsBack[1][6] === 'weekly', 'ICS：書き出して読み直すと同じ ' + JSON.stringify(res.icsBack));
  ok(res.icsAlarm, 'ICS：リマインダーの知らせ（VALARM）が入る');
  ok(res.n1 === '2026-10-13', '平日くり返し：金曜の次は、祝日をとばして火曜（' + res.n1 + '）');
  ok(res.n2 === '2026-02-28', '毎月くり返し：1/31 の次は 2/28（' + res.n2 + '）');
  ok(errs.length === 0, 'コンソールにエラーがない' + (errs.length ? '\n    ' + errs.join('\n    ') : ''));
  await close();
  await closeAll();
  console.log(`\n${passed} 件 OK` + (failed ? ` / ${failed} 件 NG` : '・すべて OK'));
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

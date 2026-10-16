#!/usr/bin/env node
/* 計算の確かめ（画面を通さずに、決まりを守れているかを数で見る）
   ・Node で：席替え・時間割・係決め・当番表の「解く部品」、和暦と差し込み、Word（.docx）の組み立て
   ・本物のブラウザで：祝日・名簿の読み取り・共有リンクの往復・年間行事の読み取り・ICS の往復・くり返しの次の日・Word の XML の正しさ
   使い方：  node tools/test.cjs */
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const SeatSolver = require(path.join(ROOT, 'js/core/seat-solver.js'));
const TimetableSolver = require(path.join(ROOT, 'js/core/timetable-solver.js'));
const RolesData = require(path.join(ROOT, 'js/core/roles-data.js'));
const Duty = require(path.join(ROOT, 'js/core/duty.js'));
const Letters = require(path.join(ROOT, 'js/core/letters.js'));
const Docx = require(path.join(ROOT, 'js/core/docx.js'));

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

/* ───────── 当番表 ───────── */
section('当番表');
{
  const st = Array.from({ length: 32 }, (_, i) => ({ id: 's' + (i + 1), no: i + 1, gender: i % 2 ? 'f' : 'm' }));
  for (const n of [4, 5, 6, 7, 8]) {
    for (const m of ['number', 'random']) {
      const r = Duty.makeGroups(st, n, m, { seed: n * 7, mix: true });
      ok(Object.keys(r.of).length === 32 && r.sizes.length === n, `班：全員がどこかの班に（${n}班, ${m}）`);
      ok(Math.max(...r.sizes) - Math.min(...r.sizes) <= 1, `班の人数の差は1人まで（${n}班, ${m}: ${r.sizes.join('・')}）`);
      if (m === 'random') {
        const boys = Array(n).fill(0);
        for (const s of st) if (s.gender === 'm') boys[r.of[s.id]]++;
        ok(Math.max(...boys) - Math.min(...boys) <= 1, `男女をまぜると、男子の数の差も1人まで（${n}班: ${boys.join('・')}）`);
      }
    }
  }
  // 席の近い人：6×6 の席（2人席）で、班の人は同じ2列の帯の、続いた前後の席
  const seats = {};
  let k = 0;
  for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) if (k < 32) seats[r + '-' + c] = st[k++].id;
  const sg = Duty.makeGroups(st, 6, 'seat', { seats, pairs: true });
  const pos = Object.fromEntries(Object.entries(seats).map(([key, id]) => [id, key.split('-').map(Number)]));
  const mem = Duty.membersOf(st, sg.of, 6);
  ok(mem.every((ids) => { const bands = new Set(ids.map((id) => Math.floor(pos[id][1] / 2))); const rows = ids.map((id) => pos[id][0]); return bands.size <= 2 && Math.max(...rows) - Math.min(...rows) <= 3; }), '席の近い人：班は、となりと前後の近い席でできる');
  // 掃除：6班・6か所なら、6週でどの班もすべての場所を1回ずつ
  const A6 = ['a', 'b', 'c', 'd', 'e', 'f'];
  const cl = Duty.cleaning({ groups: 6, areas: A6, start: '2026-10-14', count: 6 });
  const seen = new Set();
  for (const p of cl) p.byArea.forEach((g, a) => seen.add(g + ':' + a));
  ok(seen.size === 36 && cl.every((p) => new Set(p.byArea).size === 6), '掃除：6週で、どの班もどの場所も1回ずつ・同じ週に2か所を持たない');
  ok(cl[0].from === '2026-10-12' && cl[0].to === '2026-10-16' && cl[1].from === '2026-10-19', '掃除：週は月曜はじまり（水曜を選んでも、その週の月曜から）');
  // 回転盤と同じ向き：次の週は、班が1つ先（時計まわり）の場所へ
  ok(cl.slice(1).every((p, i) => p.byArea.every((g, a) => cl[i].byArea[(a + 5) % 6] === g)), '掃除：次の週は、どの班も1つ先の場所へ（回転盤を時計まわりに1つ）');
  const cl2 = Duty.cleaning({ groups: 7, areas: ['a', 'b', 'c', 'd', 'e'], start: '2026-10-12', count: 7 });
  const rest = Array(7).fill(0);
  for (const p of cl2) for (const g of p.rest) rest[g]++;
  ok(cl2.every((p) => p.rest.length === 2 && p.byArea.every((g) => g >= 0)) && rest.every((x) => x === 2), '7班・5か所：毎週2班が休み・7週で休みは2回ずつ');
  const cl3 = Duty.cleaning({ groups: 6, areas: A6, start: '2026-10-12', count: 3, skip: ['2026-10-21'] });
  ok(cl3.length === 4 && cl3[1].skip && cl3[2].k === 1 && cl3[2].from === '2026-10-26', 'お休みの週は、番を進めずにとばす');
  ok(Duty.periodOf(cl3, '2026-10-18').k === 0 && Duty.periodOf(cl3, '2026-10-19').skip, 'その週は日曜まで・月曜から次の週');
  const cl4 = Duty.cleaning({ groups: 6, areas: A6, start: '2026-10-14', count: 2, every: 2 });
  ok(cl4[0].from === '2026-10-12' && cl4[0].to === '2026-10-23' && cl4[1].from === '2026-10-26' && !Duty.periodOf(cl4, '2026-11-09'), '2週ごと：2週ずつ区切る');
  // 給食
  const roles = ['おかず', '汁物', 'ごはん', '牛乳', '食器', '台'];
  const lu = Duty.lunch({ mode: 'group', groups: 6, members: mem, roles, start: '2026-10-12', count: 12 });
  ok(lu.map((p) => p.group).join('') === '012345012345', '給食（班ごと）：1班から順に回る');
  ok(lu.every((p) => p.assign.every((a) => p.team.includes(a.id))) && lu[6].assign[0].id === lu[0].assign[1].id, '給食：仕事はその週の班の人だけ・2回目は仕事を1つずらす');
  const lu2 = Duty.lunch({ mode: 'number', students: st.map((s) => s.id), size: 8, roles, start: '2026-10-12', count: 4 });
  ok(new Set(lu2.flatMap((p) => p.team)).size === 32 && lu2.every((p) => p.team.length === 8), '給食（番号順に区切る）：4回で32人が1回ずつ');
  // 日直：土日・祝日・行事の日をとばして、番号順に2人ずつ
  const weekend = (d) => [0, 6].includes(new Date(d + 'T00:00').getDay());
  const nk = Duty.nicchoku({ students: st.map((s) => s.id), per: 2, start: '2026-10-09', days: 4, isOff: (d) => weekend(d) || d === '2026-10-12', skip: ['2026-10-14'] });
  ok(nk.map((x) => x.date).join(',') === '2026-10-09,2026-10-13,2026-10-15,2026-10-16' && nk[1].ids.join() === 's3,s4', '日直：休みの日と行事の日をとばして、2人ずつ順に');
  const nk2 = Duty.nicchoku({ students: st.map((s) => s.id), per: 3, start: '2026-10-12', days: 12, startIndex: 30 });
  ok(nk2[0].ids.join() === 's31,s32,s1' && nk2[1].ids[0] === 's2', '日直：名簿の最後までいったら、最初にもどる');
}

/* ───────── 文書のことば ───────── */
section('和暦・時候・差し込み');
{
  ok(Letters.wareki('2026-10-16', { week: true }) === '令和8年10月16日（金）', '和暦：' + Letters.wareki('2026-10-16', { week: true }));
  ok(Letters.wareki('2019-05-01') === '令和元年5月1日' && Letters.wareki('2019-04-30') === '平成31年4月30日', '和暦：令和元年・平成31年');
  ok(Letters.warekiYear(2026) === '令和8年度' && Letters.seireki('2026-04-07', { week: true }) === '2026年4月7日（火）', '年度・西暦');
  ok(Array.from({ length: 12 }, (_, i) => Letters.jiko(i + 1)).every((j) => /の候$/.test(j.formal) && j.soft.length > 5) && Letters.jiko(10).formal === '秋冷の候', '時候のあいさつ（12か月）');
  ok(Letters.fill('持ち物\n・{持ち物}', { 持ち物: '弁当・水筒\n・雨具\nしおり' }) === '持ち物\n・弁当・水筒\n・雨具\n・しおり', '「・{…}」に2行以上を入れると、行ごとに「・」');
  ok(Letters.fill('{a}と{b}', { a: 'A', b: '' }) === 'Aと{b}', '値のない差し込みは、そのまま残す（入れ忘れが分かる）');
  ok(Letters.keys('{行事名}のお知らせ', '{時候}、{行事名}を{日時}に').join() === '行事名,時候,日時', '差し込みの名前を、出てきた順に');
  const T = Letters.TEMPLATES;
  ok(T.length >= 18 && new Set(T.map((t) => t.id)).size === T.length && Letters.GROUPS.every((g) => T.filter((t) => t.group === g.id).length >= 4), 'ひな形：' + T.length + 'こ（保護者へ・生徒へ・先生へ それぞれ4こ以上）');
  const AUTO = { 学校名: 'ひかり中学校', 先生名: '山田', クラス: '2年3組', 学年: '第2学年', 発行日: '令和8年10月15日', 今日: '10月15日（木）', 明日: '10月16日（金）', 年度: '令和8年度', 時候: '秋冷の候', 時候やわらか: '朝夕はめっきり涼しく', 生徒名: '青木 そら' };
  for (const t of T) {
    const all = [t.title, t.body, t.note, t.reply, t.from || ''].join('\n');
    const left = Letters.keys(Letters.fill(all, Object.assign({}, AUTO, t.examples)));
    ok(left.length === 0, `ひな形「${t.id}」：自動の値と例で、差し込みが全部うまる` + (left.length ? '（' + left.join('・') + '）' : ''));
  }
}

/* ───────── Word（.docx） ───────── */
section('Word（.docx）');
// ZIP をひらく（圧縮なしで書いているので、そのまま切り出せる）。CRC も確かめる
function unzip(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let end = buf.length - 22;
  while (end >= 0 && dv.getUint32(end, true) !== 0x06054b50) end--;
  const n = dv.getUint16(end + 10, true), cd = dv.getUint32(end + 16, true);
  const out = {};
  let p = cd, crcOk = true;
  for (let i = 0; i < n; i++) {
    const size = dv.getUint32(p + 20, true), nameLen = dv.getUint16(p + 28, true), off = dv.getUint32(p + 42, true), crc = dv.getUint32(p + 16, true);
    const name = new TextDecoder().decode(buf.subarray(p + 46, p + 46 + nameLen));
    const lnl = dv.getUint16(off + 26, true), data = buf.subarray(off + 30 + lnl, off + 30 + lnl + size);
    if (dv.getUint32(off, true) !== 0x04034b50 || Docx.crc32(data) !== crc) crcOk = false;
    out[name] = data;
    p += 46 + nameLen;
  }
  return { files: out, crcOk };
}
const PNG1 = new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64'));
{
  ok(Docx.crc32(new TextEncoder().encode('123456789')) === 0xCBF43926, 'CRC32 の検査値');
  const bytes = Docx.build({ title: 'テスト & <確認>', page: { w: 257, h: 364, margin: 12, cols: 2, gap: 7, sep: true }, font: '游ゴシック',
    head: [{ table: [[{ blocks: [{ p: 'かけはし', b: true, size: 26 }] }, { blocks: [{ p: '第1号', align: 'right' }] }]], widths: [0.6, 0.4], border: 'none' }, { p: '', border: { bottom: 'double' } }],
    body: [{ p: '見出し', b: true, border: { left: 'thick' }, keep: true }, { p: '1行目\n2行目 <b>&"' }, { table: [['日', '予定'], ['10/19(月)', '生徒総会']], header: true }, { img: PNG1, type: 'png', frac: 0.5, ratio: 1 }, { p: '・箇条', hanging: 3.7 }] });
  const { files, crcOk } = unzip(bytes);
  const need = ['[Content_Types].xml', '_rels/.rels', 'docProps/core.xml', 'docProps/app.xml', 'word/document.xml', 'word/styles.xml', 'word/settings.xml', 'word/_rels/document.xml.rels', 'word/media/image1.png'];
  ok(need.every((x) => files[x]) && crcOk, 'docx：必要な部品がそろい、ZIP の CRC が正しい');
  const doc = new TextDecoder().decode(files['word/document.xml']);
  const rels = new TextDecoder().decode(files['word/_rels/document.xml.rels']);
  ok((doc.match(/<w:sectPr>/g) || []).length === 2 && /<w:cols w:num="1"/.test(doc) && /<w:type w:val="continuous"\/>.*<w:cols w:num="2" w:space="397" w:sep="1"\/>/.test(doc), 'docx：題字は1段、本文は2段（同じページで続けて）');
  ok(/<w:pgSz w:w="14570" w:h="20636"\/>/.test(doc), 'docx：B4（257×364mm）の紙');
  ok(doc.includes('r:embed="rIdImg1"') && rels.includes('Id="rIdImg1"') && rels.includes('Target="media/image1.png"'), 'docx：写真がつながっている');
  ok(doc.includes('2行目 &lt;b&gt;&amp;&quot;') && doc.includes('<w:br/>') && !/[<>]確認/.test(doc), 'docx：記号は文字として入る（&・<・> を書きかえる）');
  ok(/<w:tblHeader\/>/.test(doc) && /<w:ind w:left="210" w:hanging="210"\/>/.test(doc), 'docx：表の見出し行・箇条のぶら下げ');
  ok(new TextDecoder().decode(files['docProps/core.xml']).includes('テスト &amp; &lt;確認&gt;'), 'docx：題名（文書のプロパティ）');
}

/* ───────── 本物のブラウザで ───────── */
(async () => {
  section('ブラウザ（祝日・名簿・共有・年間行事・ICS・Word）');
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
    // Word：学級通信のサンプルと、連絡の文書を組み立てて、どの XML も正しく読めるか（ブラウザの XML の読み取りで確かめる）
    const unzipB = (buf) => {
      const dv = new DataView(buf.buffer); let end = buf.length - 22;
      while (end >= 0 && dv.getUint32(end, true) !== 0x06054b50) end--;
      const files = {}; let p = dv.getUint32(end + 16, true);
      for (let i = 0; i < dv.getUint16(end + 10, true); i++) {
        const size = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), off = dv.getUint32(p + 42, true);
        files[new TextDecoder().decode(buf.subarray(p + 46, p + 46 + nl))] = buf.subarray(off + 30 + dv.getUint16(off + 26, true), off + 30 + dv.getUint16(off + 26, true) + size);
        p += 46 + nl;
      }
      return files;
    };
    const issue = (await Kit.store.list('newsletters'))[0];
    const model = await SenseiNewsletter.docxOf(issue);
    const files = unzipB(Docx.build(model));
    out.xmlBad = Object.keys(files).filter((n) => /\.(xml|rels)$/.test(n)).filter((n) => new DOMParser().parseFromString(new TextDecoder().decode(files[n]), 'application/xml').getElementsByTagName('parsererror').length);
    out.xmlCount = Object.keys(files).filter((n) => /\.(xml|rels)$/.test(n)).length;
    const doc = new TextDecoder().decode(files['word/document.xml']);
    out.docHas = ['かけはし', '第12号', '来週の予定', '三者面談のお知らせ'].every((t) => doc.includes(t));
    out.plain = SenseiNewsletter.plainText(issue);
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
  ok(res.xmlCount >= 8 && res.xmlBad.length === 0, '学級通信の Word：どの XML も正しく読める（' + res.xmlCount + 'こ）' + JSON.stringify(res.xmlBad));
  ok(res.docHas, '学級通信の Word：題字・見出しが入る');
  ok(/^【かけはし　第12号】令和/.test(res.plain) && /■来週の予定\n\d+\/\d+\(.\)　/.test(res.plain) && /・朝晩が冷えてきました/.test(res.plain), '学級通信の文章コピー（連絡アプリ用）');
  ok(errs.length === 0, 'コンソールにエラーがない' + (errs.length ? '\n    ' + errs.join('\n    ') : ''));
  await close();
  await closeAll();
  console.log(`\n${passed} 件 OK` + (failed ? ` / ${failed} 件 NG` : '・すべて OK'));
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

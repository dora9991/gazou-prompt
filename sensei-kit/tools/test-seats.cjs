#!/usr/bin/env node
/* 席替えの「列を決める人」の確かめ（画面を通さず、js/core/seat-solver.js だけを Node で）
   ・守れる指定なら、何度くじを引いても守る：いろいろな人数・机の数・机のない場所、
     「前の席」・固定の席・はなす2人・男女の並び・前回と同じとなりを避ける と一緒に
   ・守れない指定では、理由（何人に対して座れる席が何こ・机がない・固定を優先・前の席と重ならない）を出す
   ・列の決めごとを先生の言葉にする（黒板に向かって左から／前から）
   使い方：  node tools/test-seats.cjs */
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const SeatSolver = require(path.join(ROOT, 'js/core/seat-solver.js'));

let failed = 0, passed = 0;
const ok = (cond, msg) => { if (cond) passed++; else { failed++; console.log('NG  ' + msg); } };
const cpu = () => { const u = process.cpuUsage(); return (u.user + u.system) / 1e6; };
let lastCpu = cpu();
const section = (t) => { const now = cpu(); if (passed + failed) console.log('   （計算 ' + (now - lastCpu).toFixed(1) + ' 秒）'); lastCpu = now; console.log('── ' + t); };
const t0 = Date.now();

// 決まったくじ（テストの組み立て用。SeatSolver とは別）
function rng(seed) {
  let a = seed >>> 0;
  const f = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  f.int = (n) => Math.floor(f() * n);
  f.shuffle = (arr) => { const a2 = arr.slice(); for (let i = a2.length - 1; i > 0; i--) { const j = f.int(i + 1); [a2[i], a2[j]] = [a2[j], a2[i]]; } return a2; };
  return f;
}
const rc = (k) => k.split('-').map(Number);
const posOf = (seats) => { const o = {}; for (const [k, id] of Object.entries(seats)) o[id] = rc(k); return o; };
const inZone = (p, z) => (!(z.cols || []).length || z.cols.includes(p[1])) && (!(z.rows || []).length || z.rows.includes(p[0]));
const near = (pa, pb) => Math.abs(pa[0] - pb[0]) <= 1 && Math.abs(pa[1] - pb[1]) <= 1;
const kinds = (res) => res.issues.map((x) => x.kind);
const HARD = ['zone', 'zoneFront', 'zoneFixed', 'front', 'apart'];

// 全員が1つずつ・机のない場所に座らない・固定はそのまま
function basic(res, input, label) {
  const placed = Object.values(res.seats);
  const bl = new Set(input.blocked || []);
  ok(res.ok && placed.length === input.students.length && new Set(placed).size === placed.length, `全員が1つずつ席につく（${label}）`);
  ok(Object.keys(res.seats).every((k) => !bl.has(k) && rc(k)[0] < input.rows && rc(k)[1] < input.cols), `机のない場所・教室の外に座らない（${label}）`);
  for (const [k, id] of Object.entries(input.fixed || {})) ok(res.seats[k] === id, `固定の席はそのまま（${id} → ${k}、${label}）`);
}
// 守れる指定：列・前の席・はなす2人を全部守り、守れなかった条件に出ない
function allKept(res, input, label) {
  basic(res, input, label);
  const pos = posOf(res.seats);
  const fr = input.frontRows == null ? 2 : input.frontRows;
  let bad = [];
  for (const [id, z] of Object.entries(input.zones || {})) if (pos[id] && !inZone(pos[id], z)) bad.push(id + '→' + pos[id].join('-'));
  ok(!bad.length, `列を決めた人は、決めた列に座る（${label}）` + (bad.length ? ' ' + bad.join(' ') : ''));
  bad = input.students.filter((s) => s.front && pos[s.id][0] >= fr).map((s) => s.id);
  ok(!bad.length, `「前の席」の人は前から${fr}列目まで（${label}）` + (bad.length ? ' ' + bad.join(' ') : ''));
  bad = (input.apart || []).filter(([a, b]) => near(pos[a], pos[b]));
  ok(!bad.length, `はなす2人が近くにならない（${label}）` + (bad.length ? ' ' + JSON.stringify(bad) : ''));
  const hard = res.issues.filter((x) => HARD.includes(x.kind));
  ok(!hard.length, `守れなかった条件に、列・前の席・はなす2人が出ない（${label}）` + (hard.length ? ' ' + JSON.stringify(hard.map((x) => x.text)) : ''));
}

const mkStudents = (n, r) => Array.from({ length: n }, (_, i) => ({ id: 's' + (i + 1), gender: r ? (r() < 0.5 ? 'm' : 'f') : i % 2 ? 'f' : 'm' }));

/* ───────── 1. 先生がよくやる指定 ───────── */
section('よくある指定（縦の1・2列目／前から3列目まで／窓側・廊下側）');
{
  const students = mkStudents(32);
  for (const i of [4, 13, 21]) students[i].front = true;
  const zones = {
    s1: { cols: [0, 1] },                      // 窓側の2列
    s2: { cols: [0, 1], rows: [0, 1, 2] },     // 窓側の2列で、前から3列目まで
    s8: { rows: [0, 1, 2] },                   // 前から3列目まで（縦はどこでも）
    s9: { cols: [5] },                         // 廊下側の1列
    s14: { cols: [2, 3] },                     // 「前の席」の人を、まん中の2列に（前から2列目まで と両方）
    s30: { rows: [4, 5] },                     // 後ろの2列
  };
  const base = { rows: 6, cols: 6, pairs: true, students, frontRows: 2, zones, apart: [['s1', 's2'], ['s3', 's27'], ['s9', 's30']], emptyBack: true };
  for (const mix of ['none', 'side', 'checker', 'cols']) {
    for (let seed = 1; seed <= 8; seed++) {
      const input = Object.assign({}, base, { mix, seed });
      const res = SeatSolver.solve(input);
      allKept(res, input, `mix=${mix}, くじ${seed}`);
      // 「前の席」と列の両方を決めた人は、両方に合う席（前から2列目まで × 縦の3・4列目）
      const p = posOf(res.seats).s14;
      ok(p[0] < 2 && (p[1] === 2 || p[1] === 3), `「前の席」＋列の人は、両方に合う席（${p.join('-')}、mix=${mix}, くじ${seed}）`);
      // 空いた席は後ろに（列を決めても）
      const empty = []; for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) if (!res.seats[r + '-' + c]) empty.push(r);
      ok(empty.every((r) => r === 5), `空いた席は後ろの列（${empty.join(',')}、mix=${mix}, くじ${seed}）`);
    }
  }
  // となり同士は男女も、列を決めても守れる
  const side = SeatSolver.solve(Object.assign({}, base, { mix: 'side', seed: 21 }));
  const nb = SeatSolver.neighborsOf(side.seats, 6, 6, [], true);
  const g = Object.fromEntries(students.map((s) => [s.id, s.gender]));
  let same = 0; for (const [id, list] of Object.entries(nb)) for (const o of list) if (g[id] === g[o]) same++;
  ok(same === 0 && !kinds(side).includes('mix'), '列を決めても、となり同士は男女（同じ性別のとなり：' + same + '）');
  // 固定の席と一緒に
  const fixed = { '0-0': 's20', '5-5': 's21', '2-3': 's23' };
  for (let seed = 1; seed <= 6; seed++) { const input = Object.assign({}, base, { fixed, seed }); allKept(SeatSolver.solve(input), input, `固定の席と一緒に, くじ${seed}`); }
  // 前回と同じとなりを避ける、と一緒に
  const first = SeatSolver.solve(Object.assign({}, base, { seed: 4 }));
  for (let seed = 5; seed <= 10; seed++) {
    const input = Object.assign({}, base, { seed, prev: first.seats });
    const res = SeatSolver.solve(input);
    allKept(res, input, `前回のとなりを避ける, くじ${seed}`);
    const nb1 = SeatSolver.neighborsOf(first.seats, 6, 6, [], true), nb2 = SeatSolver.neighborsOf(res.seats, 6, 6, [], true);
    let again = 0; for (const [id, list] of Object.entries(nb2)) for (const o of list) if ((nb1[id] || []).includes(o)) again++;
    ok(again === 0, `列を決めても、前回と同じとなりにならない（${again / 2}組、くじ${seed}）`);
  }
  // 1人ずつの机（2人席でない）・机のない場所があっても
  for (let seed = 1; seed <= 6; seed++) {
    const input = Object.assign({}, base, { pairs: false, blocked: ['5-0', '5-1', '0-5'], seed, mix: seed % 2 ? 'checker' : 'none' });
    allKept(SeatSolver.solve(input), input, `1人ずつ・机のない場所あり, くじ${seed}`);
  }
  // 列を決めた人が1つの席にしか座れないとき（縦1列目×前から1列目）でも、その席に
  for (let seed = 1; seed <= 5; seed++) {
    const input = Object.assign({}, base, { zones: Object.assign({}, zones, { s5: { cols: [0], rows: [0] } }), seed });
    const res = SeatSolver.solve(input);
    allKept(res, input, `座れる席が1つだけの人, くじ${seed}`);
    ok(res.seats['0-0'] === 's5', `座れる席が1つだけの人は、その席（くじ${seed}）`);
  }
}

/* ───────── 2. いろいろな教室で、くじを何度引いても守る ───────── */
section('いろいろな人数・机の数・ほかの条件と一緒に（守れる指定）');
{
  // 「どこかに守れる並びがある」指定を作る：先に1つの並び（答えの見本）をくじで作り、そこから条件を決める
  const ROOMS = [
    { rows: 6, cols: 6, pairs: true, n: 32 },
    { rows: 5, cols: 7, pairs: false, n: 35 },                         // ちょうど満席
    { rows: 7, cols: 6, pairs: true, n: 40, blocked: ['6-0', '6-5'] },  // 満席・机のない場所
    { rows: 4, cols: 5, pairs: false, n: 18 },
    { rows: 3, cols: 4, pairs: true, n: 12 },                          // 小さな教室・満席
    { rows: 6, cols: 7, pairs: false, n: 38, blocked: ['3-3'] },
    { rows: 8, cols: 8, pairs: true, n: 58, blocked: ['0-0', '0-7'] },
  ];
  const MIXES = ['none', 'side', 'checker', 'cols'];
  let scen = 0;
  for (const room of ROOMS) {
    for (let sc = 1; sc <= 3; sc++) {
      scen++;
      const r = rng(1000 * scen + 7);
      const students = mkStudents(room.n, r);
      const bl = new Set(room.blocked || []);
      const cells = []; for (let y = 0; y < room.rows; y++) for (let x = 0; x < room.cols; x++) if (!bl.has(y + '-' + x)) cells.push([y, x]);
      const witness = {}; // id → [r, c]
      r.shuffle(cells).slice(0, room.n).forEach((p, i) => { witness[students[i].id] = p; });
      const frontRows = 1 + r.int(Math.min(3, room.rows));
      const order = r.shuffle(students.map((s) => s.id));
      // 列を決める人：2割ほど。縦だけ／横だけ／両方
      const zones = {};
      const nz = Math.max(2, Math.round(room.n * 0.2));
      for (const id of order.slice(0, nz)) {
        const [wr, wc] = witness[id];
        const kind = r.int(3);
        const z = {};
        if (kind !== 1) { const cols = new Set([wc]); for (let k = r.int(3); k > 0; k--) cols.add(r.int(room.cols)); z.cols = [...cols].sort((a, b) => a - b); }
        if (kind !== 0) { const upTo = Math.min(room.rows - 1, wr + r.int(3)); z.rows = r() < 0.6 ? Array.from({ length: upTo + 1 }, (_, i) => i) : [wr]; }
        zones[id] = z;
      }
      // 「前の席」の人：見本で前の列にいる人から（列を決めた人とも重なってよい）
      for (const id of order.slice(nz - 1, nz + 6)) if (witness[id][0] < frontRows && r() < 0.7) students.find((s) => s.id === id).front = true;
      // 固定の席：1〜2人（見本の席に）
      const fixed = {};
      for (const id of order.slice(nz + 6, nz + 6 + 1 + r.int(2))) fixed[witness[id].join('-')] = id;
      // はなす2人：見本で2つ以上はなれている組を2つ
      const apart = [];
      for (let k = 0; k < 400 && apart.length < 2; k++) {
        const a = order[r.int(order.length)], b = order[r.int(order.length)];
        if (a !== b && !near(witness[a], witness[b])) apart.push([a, b]);
      }
      const mix = MIXES[(scen + sc) % 4];
      // くじの探し方は少なめ（restarts 3・iterations 8000。画面では 8・最大 30000）。最初の並びで列・前の席を守るので、少なくても守れることを見る
      const base = Object.assign({}, room, { students, zones, frontRows, fixed, apart, mix, emptyBack: true, restarts: 3, iterations: 8000 });
      delete base.n;
      const label = (seed) => `${room.rows}×${room.cols}${room.pairs ? '・2人席' : ''}・${room.n}人・列${nz}人・前${frontRows}列・${mix}・場面${sc}・くじ${seed}`;
      let prev = null;
      for (let seed = 1; seed <= 5; seed++) {
        const input = Object.assign({}, base, { seed: scen * 100 + seed }, prev && sc % 2 === 0 ? { prev } : {});
        const res = SeatSolver.solve(input);
        allKept(res, input, label(seed));
        prev = res.seats;
      }
    }
  }
}

/* ───────── 3. 守れない指定は、理由を出す ───────── */
section('守れない指定のときの理由');
{
  const students = mkStudents(32);
  const base = { rows: 6, cols: 6, pairs: true, students, frontRows: 2, seed: 3 };
  const find = (res, kind) => res.issues.find((x) => x.kind === kind);

  // 3人が同じ1つの席を指定
  {
    const input = Object.assign({}, base, { zones: { s1: { cols: [0], rows: [0] }, s2: { cols: [0], rows: [0] }, s3: { cols: [0], rows: [0] }, s10: { cols: [3, 4] } } });
    for (let seed = 1; seed <= 3; seed++) {
      const res = SeatSolver.solve(Object.assign({}, input, { seed }));
      basic(res, input, '3人が1つの席');
      const it = find(res, 'zone');
      ok(it && /列を決めた人のうち 2人を/.test(it.text) && /3人に対して、座れる席が1こ/.test(it.text), '3人が1つの席：「3人に対して、座れる席が1こ」と出る（' + (it && it.text) + '）');
      ok(it && it.ids.length === 2 && it.ids.every((id) => ['s1', 's2', 's3'].includes(id)), '入れられなかった2人の名前がわかる（ids）');
      const pos = posOf(res.seats);
      ok(['s1', 's2', 's3'].filter((id) => inZone(pos[id], { cols: [0], rows: [0] })).length === 1, 'そのうち1人は、決めた席に座る');
      ok(inZone(pos.s10, { cols: [3, 4] }), '守れる人（ほかの列を決めた人）は守る');
    }
  }
  // 固定の席が、決めた列をふさいでいる
  {
    const input = Object.assign({}, base, { zones: { s1: { cols: [0], rows: [0, 1] }, s2: { cols: [0], rows: [0, 1] } }, fixed: { '0-0': 's9' } });
    const res = SeatSolver.solve(input);
    basic(res, input, '固定の席がふさぐ');
    const it = find(res, 'zone');
    ok(it && /2人に対して、座れる席が1こ/.test(it.text) && /固定の席/.test(it.text), '固定の席がふさいでいるときは、そう出る（' + (it && it.text) + '）');
  }
  // 決めた列に机がない（列の数を減らした・机をなくした）
  {
    const input = Object.assign({}, base, { zones: { s1: { cols: [7] }, s2: { cols: [0], rows: [0] } }, blocked: ['0-0'] });
    const res = SeatSolver.solve(input);
    basic(res, input, '机がない');
    const it = find(res, 'zone');
    ok(it && /2人は、決めた列に机がありません/.test(it.text) && it.ids.length === 2, '決めた列に机がないときは、そう出る（' + (it && it.text) + '）');
    const pos = posOf(res.seats);
    ok(pos.s1[1] === 5, '机がない列を決めた人は、いちばん近い列に（' + pos.s1.join('-') + '）');
    ok(Math.abs(pos.s2[0]) + Math.abs(pos.s2[1]) === 1, '机をなくした席を決めた人は、そのとなりに（' + pos.s2.join('-') + '）');
  }
  // 「前の席」の人に、後ろの横の列を決めた
  {
    const st = students.map((s) => Object.assign({}, s, { front: s.id === 's5' }));
    const input = Object.assign({}, base, { students: st, zones: { s5: { rows: [4, 5] } } });
    for (let seed = 1; seed <= 4; seed++) {
      const res = SeatSolver.solve(Object.assign({}, input, { seed }));
      basic(res, input, '前の席と重ならない');
      const pos = posOf(res.seats);
      ok(pos.s5[0] >= 4, '「前の席」と重ならないときは、決めた列を優先（' + pos.s5.join('-') + '）');
      const it = find(res, 'zoneFront');
      ok(it && /前から2列目までと重ならない/.test(it.text) && it.ids[0] === 's5', '「前の席」と重ならないことが出る');
      ok(!find(res, 'front'), 'このとき「前の席」の守れなかった知らせは出ない');
    }
  }
  // 固定の席が、決めた列の外
  {
    const input = Object.assign({}, base, { zones: { s9: { cols: [5] } }, fixed: { '0-0': 's9' } });
    const res = SeatSolver.solve(input);
    basic(res, input, '固定が列の外');
    const it = find(res, 'zoneFixed');
    ok(res.seats['0-0'] === 's9' && it && /固定を優先/.test(it.text) && it.ids[0] === 's9', '固定の席が決めた列の外なら、固定を優先して知らせる');
  }
  // 「前の席」の人どうしで、前の席を取り合う
  {
    const st = students.map((s) => Object.assign({}, s, { front: ['s1', 's2', 's3'].includes(s.id) }));
    const input = Object.assign({}, base, { students: st, frontRows: 1, zones: { s1: { cols: [0] }, s2: { cols: [0] }, s3: { cols: [0] } } });
    const res = SeatSolver.solve(input);
    basic(res, input, '前の席の取り合い');
    const all = res.issues.map((x) => x.text).join(' / ');
    ok(res.issues.some((x) => (x.kind === 'front' && /取り合って/.test(x.text)) || (x.kind === 'zone' && /「前の席」の人と合わせて/.test(x.text))), '「前の席」と列で席を取り合うときは、そう出る（' + all + '）');
    const pos = posOf(res.seats);
    ok(['s1', 's2', 's3'].every((id) => pos[id][1] === 0 || pos[id][0] === 0), '取り合っても、列か前の席のどちらかは守る');
  }
  // おかしな指定は無視する（空・名簿にいない人・負の数）
  {
    const input = Object.assign({}, base, { zones: { s1: {}, s2: { cols: [], rows: [] }, nobody: { cols: [0] }, s3: { cols: [-1, 'x', 1.5] } }, seed: 1 });
    const res = SeatSolver.solve(input);
    basic(res, input, 'おかしな指定');
    ok(!res.issues.some((x) => x.kind.startsWith('zone')), 'おかしな指定（空・名簿にいない人・番号でない）は無視する');
  }
  // 席が足りないときは、これまでどおり
  const few = SeatSolver.solve({ rows: 2, cols: 2, students, zones: { s1: { cols: [0] } } });
  ok(!few.ok && /席が足りません/.test(few.error), '席が足りないときは、これまでどおり理由を返す');
}

/* ───────── 4. 列を決めないときは、これまでと同じ ───────── */
section('列を決めないときは、これまでと同じ');
{
  const students = mkStudents(32);
  for (const i of [4, 13, 21]) students[i].front = true;
  const base = { rows: 6, cols: 6, pairs: true, students, frontRows: 2, apart: [['s3', 's27']], mix: 'side' };
  for (let seed = 1; seed <= 4; seed++) {
    const a = SeatSolver.solve(Object.assign({}, base, { seed }));
    const b = SeatSolver.solve(Object.assign({}, base, { seed, zones: {} }));
    const c = SeatSolver.solve(Object.assign({}, base, { seed, zones: { nobody: { cols: [1] } } }));
    ok(JSON.stringify(a.seats) === JSON.stringify(b.seats) && JSON.stringify(a.seats) === JSON.stringify(c.seats), `列の指定が空なら、同じくじで同じ席（くじ${seed}）`);
  }
}

/* ───────── 5. 先生の言葉 ───────── */
section('列の決めごとを先生の言葉に');
{
  const T = SeatSolver.zoneText;
  const eq = (got, want) => ok(got === want, `「${want}」（実際：「${got}」）`);
  eq(T({ cols: [0, 1], rows: [0, 1, 2] }, { cols: 6, window: 'left' }), '縦の列：黒板に向かって左から1・2列目（窓側）、横の列：前から1〜3列目');
  eq(T({ cols: [5] }, { cols: 6, window: 'left' }), '縦の列：黒板に向かって左から6列目（廊下側）');
  eq(T({ cols: [0] }, { cols: 6, window: 'right' }), '縦の列：黒板に向かって左から1列目（廊下側）');
  eq(T({ cols: [4, 5] }, { cols: 6, window: 'right' }), '縦の列：黒板に向かって左から5・6列目（窓側）');
  eq(T({ cols: [0, 5] }, { cols: 6, window: 'left' }), '縦の列：黒板に向かって左から1・6列目');
  eq(T({ cols: [2, 3] }, { cols: 6, window: 'left' }), '縦の列：黒板に向かって左から3・4列目');
  eq(T({ rows: [0, 2, 3, 4] }), '横の列：前から1・3〜5列目');
  eq(T({ cols: [1, 0, 1], rows: [] }, { short: true }), '縦の列：左から1・2列目');
  eq(T({}), '');
  // 図の向き（生徒から見た図・教卓から見た図）にかかわらず、同じ言葉
  ok(!/右から|教卓/.test(T({ cols: [0, 1, 2, 3, 4, 5], rows: [0] }, { cols: 6, window: 'left' })), '言葉は図の向きによらない（いつも「黒板に向かって左から」「前から」）');
}

console.log('   （計算 ' + (cpu() - lastCpu).toFixed(1) + ' 秒）');
console.log(`\n${passed} 件 OK` + (failed ? ` / ${failed} 件 NG` : '・すべて OK') + `（${((Date.now() - t0) / 1000).toFixed(1)} 秒）`);
process.exit(failed ? 1 : 0);

/* 当番表の計算（画面と切りはなした、ただの計算。tools/test.cjs から Node でも動かす）
   ・班をつくる      Duty.makeGroups(生徒, 班の数, 'number'|'seat'|'random', { seats, pairs, mix, seed })
   ・掃除の分担      Duty.cleaning({ groups: 班の数, areas: [場所], start, count, every, skip })
                     期間 k に、班 g は場所 (g + k) mod M を受け持つ（M は班と場所の多いほう。場所をこえた番は「休み」）
   ・給食当番        Duty.lunch({ mode: 'group'|'number', groups, members, students, size, roles, start, count, every, skip })
                     班ごとなら期間 k の当番は班 (k mod 班の数)。役割は、その班が何回目の当番かでずらす
   ・日直            Duty.nicchoku({ students, per, start, days, isOff, skip, startIndex }) … 授業のある日に番号順で
   日付はすべて 'YYYY-MM-DD'。週は月曜はじまり。 */
(function (root) {
  'use strict';
  const pad = (n) => String(n).padStart(2, '0');
  const parse = (s) => { const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(s || '')); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(NaN); };
  const fmt = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return fmt(d); };
  const mondayOf = (s) => { const d = parse(s); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return fmt(d); };
  const isWeekend = (s) => { const w = parse(s).getDay(); return w === 0 || w === 6; };
  const byNo = (a, b) => (a.no || 0) - (b.no || 0);

  function rng(seed) {
    let a = (seed == null ? Math.floor(Math.random() * 0xffffffff) : seed) >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function shuffle(arr, rand) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  /* ───────── 班をつくる ───────── */
  function finish(of, n) { const sizes = Array(n).fill(0); for (const g of Object.values(of)) sizes[g]++; return { of, sizes }; }
  // 前から順に、人数ができるだけそろうように区切る
  function chunk(order, n) {
    const of = {}, base = Math.floor(order.length / n), extra = order.length % n;
    let i = 0;
    for (let g = 0; g < n; g++) { const size = base + (g < extra ? 1 : 0); for (let k = 0; k < size; k++) of[order[i++].id] = g; }
    return finish(of, n);
  }
  function makeGroups(students, n, method, o = {}) {
    const list = (students || []).filter((s) => s && s.id);
    n = Math.max(1, Math.min(n | 0 || 1, Math.max(1, list.length)));
    if (method === 'seat' && o.seats) {
      // 席の近い人：机の列（2人席なら2列ずつ）ごとに、前から順に並べて区切る → 前後左右の近い人が同じ班になる
      const pos = new Map();
      for (const [k, id] of Object.entries(o.seats)) { const [r, c] = k.split('-').map(Number); pos.set(id, { r, c }); }
      const band = o.pairs === false ? 1 : 2;
      const seated = list.filter((s) => pos.has(s.id)).sort((a, b) => { const A = pos.get(a.id), B = pos.get(b.id); return Math.floor(A.c / band) - Math.floor(B.c / band) || A.r - B.r || A.c - B.c; });
      return chunk(seated.concat(list.filter((s) => !pos.has(s.id)).sort(byNo)), n);
    }
    if (method === 'random') {
      const rand = rng(o.seed);
      let order = shuffle(list, rand);
      // 男女をまぜる：男子・女子・そのほかの順に、班へ1人ずつ配る（人数も男女もそろう）
      if (o.mix) order = order.filter((s) => s.gender === 'm').concat(order.filter((s) => s.gender === 'f'), order.filter((s) => s.gender !== 'm' && s.gender !== 'f'));
      const of = {};
      order.forEach((s, i) => { of[s.id] = i % n; });
      return finish(of, n);
    }
    return chunk(list.slice().sort(byNo), n);
  }
  // 班ごとのメンバー（番号順）
  function membersOf(students, of, n) {
    const out = Array.from({ length: n }, () => []);
    for (const s of (students || []).slice().sort(byNo)) { const g = of[s.id]; if (g != null && g >= 0 && g < n) out[g].push(s.id); }
    return out;
  }

  /* ───────── 期間（週）の並び ─────────
     start の週の月曜から、every 週ずつ区切る。skip にある週はお休み（番を進めない）。
     count は番のある期間の数（お休みの行は数に入れずに、あいだに入る） */
  function periods(start, count, every, skip) {
    every = Math.max(1, every | 0 || 1);
    const sk = new Set((skip || []).map(mondayOf));
    const out = [];
    let wk = mondayOf(start), k = 0, guard = 0;
    while (k < count && guard++ < 600) {
      if (sk.has(wk)) { out.push({ from: wk, to: addDays(wk, 4), end: addDays(wk, 6), k: null, skip: true }); wk = addDays(wk, 7); continue; }
      // to … 最後の週の金曜（表に出す日付）、end … 最後の週の日曜（その期間にふくまれる最後の日）
      out.push({ from: wk, to: addDays(wk, 7 * every - 3), end: addDays(wk, 7 * every - 1), k });
      k++;
      wk = addDays(wk, 7 * every);
    }
    return out;
  }
  // その日がふくまれる期間
  const periodOf = (list, day) => list.find((p) => day >= p.from && day <= p.end) || null;

  /* ───────── 掃除 ───────── */
  function cleaning(o) {
    const G = Math.max(1, o.groups | 0), A = (o.areas || []).length, M = Math.max(G, A);
    return periods(o.start, o.count || 10, o.every || 1, o.skip).map((p) => {
      if (p.skip) return Object.assign({}, p, { byArea: [], rest: [] });
      const byArea = Array.from({ length: A }, (_, a) => { const g = (((a - p.k) % M) + M) % M; return g < G ? g : -1; });
      const rest = [];
      for (let g = 0; g < G; g++) if ((g + p.k) % M >= A) rest.push(g);
      return Object.assign({}, p, { byArea, rest });
    });
  }

  /* ───────── 給食 ───────── */
  function lunch(o) {
    const roles = o.roles || [];
    const students = o.students || []; // 番号順の id
    const G = Math.max(1, o.groups | 0);
    return periods(o.start, o.count || 10, o.every || 1, o.skip).map((p) => {
      if (p.skip) return Object.assign({}, p, { group: -1, team: [], assign: [], extra: [] });
      let team = [], group = -1, round = 0;
      if (o.mode === 'number') {
        const N = students.length, size = Math.max(1, Math.min(o.size | 0 || 6, N || 1));
        if (N) { const s0 = (p.k * size) % N; team = Array.from({ length: size }, (_, i) => students[(s0 + i) % N]); round = Math.floor((p.k * size) / N); }
      } else {
        group = p.k % G;
        team = (o.members && o.members[group]) || [];
        round = Math.floor(p.k / G);
      }
      const assign = roles.map((role, i) => ({ role, id: team.length ? team[(i + round) % team.length] : null }));
      const extra = team.filter((id) => !assign.some((a) => a.id === id));
      return Object.assign({}, p, { group, team, assign, extra });
    });
  }

  /* ───────── 日直 ───────── */
  function nicchoku(o) {
    const st = o.students || [], N = st.length, out = [];
    if (!N) return out;
    const per = Math.max(1, Math.min(o.per | 0 || 2, N));
    const off = o.isOff || isWeekend, sk = new Set(o.skip || []);
    let d = o.start, i = ((o.startIndex | 0) % N + N) % N, guard = 0;
    while (out.length < (o.days || 30) && guard++ < 3000) {
      if (!off(d) && !sk.has(d)) { out.push({ date: d, ids: Array.from({ length: per }, (_, j) => st[(i + j) % N]) }); i = (i + per) % N; }
      d = addDays(d, 1);
    }
    return out;
  }

  const api = { makeGroups, membersOf, periods, periodOf, cleaning, lunch, nicchoku, mondayOf, addDays };
  root.Duty = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

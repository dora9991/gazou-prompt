/* 席替えを解く部品（画面とは切りはなした、ただの計算。tools/test.cjs から Node でも動かす）
   SeatSolver.solve({
     rows, cols,            … 縦の数（0 が黒板に近い前の列）、横の数
     blocked: ['r-c'],      … 机のない場所
     pairs: true,           … 2人ずつ机をくっつける（0-1, 2-3, … 列がとなり同士）
     students: [{ id, gender: 'm'|'f'|'', front: true }],
     fixed: { 'r-c': id },  … この席に決めておく人
     apart: [[idA, idB]],   … 近く（前後左右・ななめ）にしない2人
     frontRows: 2,          … 「前の席」の人は、前から何列目までに
     zones: { id: { cols: [0, 1], rows: [0, 1, 2] } },
                            … 座ってよい列。cols は縦の列（黒板に向かって左から 0,1,…）、rows は横の列（前から 0,1,…）。
                              両方あれば両方に合う席だけ、片方だけでもよい。固定の席があれば固定を優先し、
                              「前の席」と重ならなければ決めた列を優先する（どちらも issues で知らせる）
     mix: 'none'|'side'|'checker'|'cols',  … 男女の並び（となり同士は男女／市松／縦の列ごと）
     prev: { 'r-c': id },   … 前回の席（同じとなり・同じ席を避ける）
     emptyBack: true,       … 空いた席は後ろに
     seed, restarts, iterations,
   }) → { ok, seats: {'r-c': id}, cost, issues: [{kind, text, ids}], error }
   決まり（固定の席）は必ず守り、それ以外は「重み」の合計が小さくなるよう、入れかえを何千回も試す。
   列を決めた人がいるときは、最初の並びを「座れる席」の組み合わせ（二部マッチング）で作るので、守れる指定なら必ず守る。
   守れない指定は、どの人たちが何こ足りないかを数えて理由を出す。
   SeatSolver.zoneText(zone, { cols, window }) … 列の決めごとを先生の言葉に（「縦の列：黒板に向かって左から1・2列目（窓側）」） */
(function (root) {
  'use strict';

  const W = { front: 1000, zone: 1000, apart: 600, mix: 30, prevSide: 40, prevFB: 10, sameSeat: 12, nearSeat: 2, empty: 1 };
  const key = (r, c) => r + '-' + c;
  const pairKey = (a, b) => (a < b ? a + '|' + b : b + '|' + a);
  // 列の番号の並び（0 から。重なり・負の数・小数は捨てて、小さい順）
  const normIdx = (a) => [...new Set((Array.isArray(a) ? a : []).map(Number).filter((x) => Number.isInteger(x) && x >= 0 && x < 64))].sort((x, y) => x - y);

  function rng(seed) {
    let a = (seed == null ? Math.floor(Math.random() * 0xffffffff) : seed) >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  // 席のつながり：となり（2人席なら相方、そうでなければ左右）・前後・まわり8つ
  function geometry(rows, cols, blocked, pairs) {
    const bl = new Set(blocked || []);
    const cells = [], at = {};
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (bl.has(key(r, c))) continue;
      at[key(r, c)] = cells.length;
      cells.push({ r, c, k: key(r, c) });
    }
    const idx = (r, c) => (at[key(r, c)] == null ? -1 : at[key(r, c)]);
    for (const cell of cells) {
      const { r, c } = cell;
      const side = [];
      if (pairs) { const mate = c % 2 === 0 ? c + 1 : c - 1; if (idx(r, mate) >= 0) side.push(idx(r, mate)); }
      else { if (idx(r, c - 1) >= 0) side.push(idx(r, c - 1)); if (idx(r, c + 1) >= 0) side.push(idx(r, c + 1)); }
      const fb = [idx(r - 1, c), idx(r + 1, c)].filter((i) => i >= 0);
      const near = [];
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { if (!dr && !dc) continue; const j = idx(r + dr, c + dc); if (j >= 0) near.push(j); }
      Object.assign(cell, { side, fb, near });
    }
    return { cells, at };
  }

  function solve(o) {
    const rows = Math.max(1, o.rows | 0), cols = Math.max(1, o.cols | 0);
    const { cells, at } = geometry(rows, cols, o.blocked, !!o.pairs);
    const students = (o.students || []).filter((s) => s && s.id);
    const sIndex = new Map(students.map((s, i) => [s.id, i]));
    const n = students.length, m = cells.length;
    if (n > m) return { ok: false, error: '席が足りません（' + n + '人に対して席が' + m + 'こ）。列か行をふやすか、机のない場所を減らしてください。', seats: {}, issues: [] };
    const gender = students.map((s) => (s.gender === 'm' ? 1 : s.gender === 'f' ? 2 : 0));
    const front = students.map((s) => !!s.front);
    const frontRows = Math.max(1, Math.min(rows, o.frontRows == null ? 2 : o.frontRows | 0));
    const mix = ['side', 'checker', 'cols'].includes(o.mix) ? o.mix : 'none';

    // 固定の席（名簿にいる人・机のある席だけ。同じ人が2か所なら最初だけ）
    const fixedCell = new Map(); // cellIndex → studentIndex
    const fixedStudent = new Set();
    for (const [k, id] of Object.entries(o.fixed || {})) {
      const ci = at[k], si = sIndex.get(id);
      if (ci == null || si == null || fixedStudent.has(si) || fixedCell.has(ci)) continue;
      fixedCell.set(ci, si); fixedStudent.add(si);
    }
    // 前回の席・となり
    const prevSeat = new Array(n).fill(-1);
    const prevSide = new Set(), prevFB = new Set();
    if (o.prev) {
      const pAt = {};
      for (const [k, id] of Object.entries(o.prev)) { const si = sIndex.get(id); if (si == null) continue; pAt[k] = si; const ci = at[k]; prevSeat[si] = ci == null ? -2 : ci; }
      const pg = geometry(o.prevRows || rows, o.prevCols || cols, o.prevBlocked || o.blocked, o.prevPairs == null ? !!o.pairs : !!o.prevPairs);
      for (const cell of pg.cells) {
        const a = pAt[cell.k]; if (a == null) continue;
        for (const j of cell.side) { const b = pAt[pg.cells[j].k]; if (b != null) prevSide.add(pairKey(a, b)); }
        for (const j of cell.fb) { const b = pAt[pg.cells[j].k]; if (b != null) prevFB.add(pairKey(a, b)); }
      }
    }
    const apart = [];
    for (const pr of o.apart || []) { const a = sIndex.get(pr && pr[0]), b = sIndex.get(pr && pr[1]); if (a != null && b != null && a !== b) apart.push([a, b]); }
    const emptyBack = o.emptyBack !== false;

    // 列を決めた人：座ってよい席（縦の列・横の列の両方に合う席）。外れた席は、決めた列からはなれるほど重い
    const zone = new Array(n).fill(null); // { ok: 席ごとに 1/0, dist: 決めた列までの近さ, any: 座ってよい席の数 }
    for (const [id, z] of Object.entries(o.zones || {})) {
      const si = sIndex.get(id);
      if (si == null || !z) continue;
      const zc = normIdx(z.cols), zr = normIdx(z.rows);
      if (!zc.length && !zr.length) continue;
      const ok = new Uint8Array(m), dist = new Uint16Array(m);
      let any = 0;
      for (let i = 0; i < m; i++) {
        const { r, c } = cells[i];
        const d = (zc.length ? Math.min(...zc.map((x) => Math.abs(x - c))) : 0) + (zr.length ? Math.min(...zr.map((x) => Math.abs(x - r))) : 0);
        dist[i] = d;
        if (!d) { ok[i] = 1; any++; }
      }
      zone[si] = { ok, dist, any };
    }
    const zoneOn = zone.some(Boolean);
    // 「前の席」の人で、決めた列が前から frontRows 列目までと重ならない人は、決めた列を優先する
    const frontOn = front.slice(), frontClash = [];
    for (let s = 0; s < n; s++) {
      const z = zone[s];
      if (!front[s] || !z || !z.any || fixedStudent.has(s)) continue;
      if (!cells.some((cell, i) => z.ok[i] && cell.r < frontRows)) { frontOn[s] = false; frontClash.push(s); }
    }

    function cost(slot, pos, orient, detail) {
      let total = 0;
      const add = (w, kind, ids) => { total += w; if (detail) detail.push({ kind, ids }); };
      for (let i = 0; i < m; i++) {
        const s = slot[i], cell = cells[i];
        if (s < 0) { if (emptyBack && !detail) total += W.empty * (rows - 1 - cell.r); continue; }
        if (frontOn[s] && cell.r >= frontRows) add(W.front * (1 + cell.r - frontRows), 'front', [s]);
        const z = zone[s];
        if (z && !z.ok[i] && !fixedStudent.has(s)) add(W.zone * (1 + z.dist[i]), 'zone', [s]);
        if (gender[s] && (mix === 'checker' || mix === 'cols')) {
          const par = mix === 'checker' ? (cell.r + cell.c) % 2 : cell.c % 2;
          if ((par === orient ? 1 : 2) !== gender[s]) add(W.mix, 'mix', [s]);
        }
        if (prevSeat[s] >= 0 && !fixedStudent.has(s) && !(z && z.any === 1)) {
          if (prevSeat[s] === i) add(W.sameSeat, 'sameSeat', [s]);
          else if (!front[s]) { const p = cells[prevSeat[s]]; if (p && Math.abs(p.r - cell.r) <= 1 && Math.abs(p.c - cell.c) <= 1) total += W.nearSeat; }
        }
        for (const j of cell.side) {
          if (j < i) continue;
          const t = slot[j]; if (t < 0) continue;
          if (mix === 'side' && gender[s] && gender[t] && gender[s] === gender[t]) add(W.mix, 'mix', [s, t]);
          if (prevSide.has(pairKey(s, t))) add(W.prevSide, 'prevSide', [s, t]);
        }
        for (const j of cell.fb) {
          if (j < i) continue;
          const t = slot[j]; if (t < 0) continue;
          if (prevFB.has(pairKey(s, t))) add(W.prevFB, 'prevFB', [s, t]);
        }
      }
      for (const [a, b] of apart) {
        const pa = cells[pos[a]], pb = cells[pos[b]];
        if (pa && pb && Math.abs(pa.r - pb.r) <= 1 && Math.abs(pa.c - pb.c) <= 1) add(W.apart, 'apart', [a, b]);
      }
      return total;
    }

    const free = []; // 動かしてよい席
    for (let i = 0; i < m; i++) if (!fixedCell.has(i)) free.push(i);
    const movers = []; for (let s = 0; s < n; s++) if (!fixedStudent.has(s)) movers.push(s);

    // 席の決まりがある人（列を決めた人・「前の席」の人）と、その人が座れる席。列を決めた人がいるときだけ使う
    const canSit = (s, i) => (!zone[s] || !zone[s].any || zone[s].ok[i]) && (!frontOn[s] || cells[i].r < frontRows);
    const need = zoneOn ? movers.filter((s) => (zone[s] && zone[s].any) || frontOn[s]) : [];
    const adj = new Map(need.map((s) => [s, free.filter((i) => canSit(s, i))]));
    // 二部マッチング（増加道）。order の人から順に、座れる席を lists の順にさがす
    function match(order, lists) {
      const owner = new Map(), seatOf = new Map();
      const tryS = (s, seen) => {
        for (const i of lists.get(s)) {
          if (seen.has(i)) continue;
          seen.add(i);
          const o = owner.get(i);
          if (o == null || tryS(o, seen)) { owner.set(i, s); seatOf.set(s, i); return true; }
        }
        return false;
      };
      for (const s of order) tryS(s, new Set());
      return { owner, seatOf };
    }
    // どうやっても座りきれない組（ホールの条件をみたさない人たち）：その人たちと、座れる席の数
    let short = null;
    if (need.length) {
      const mt = match(need, adj);
      const lost = need.filter((s) => !mt.seatOf.has(s));
      if (lost.length) {
        const R = new Set(lost), C = new Set(), queue = lost.slice();
        while (queue.length) {
          const s = queue.shift();
          for (const i of adj.get(s)) {
            if (C.has(i)) continue;
            C.add(i);
            const w = mt.owner.get(i);
            if (w != null && !R.has(w)) { R.add(w); queue.push(w); }
          }
        }
        let fixedIn = 0;
        for (const [ci] of fixedCell) if ([...R].some((s) => canSit(s, ci))) fixedIn++;
        short = { people: [...R], seats: C.size, fixedIn };
      }
    }

    const restarts = Math.max(1, o.restarts || 8);
    const iterations = Math.max(100, o.iterations || Math.min(30000, 600 * Math.max(10, n)));
    const rand = rng(o.seed);
    let best = null;

    for (let run = 0; run < restarts; run++) {
      const orient = run % 2;
      const slot = new Array(m).fill(-1), pos = new Array(n).fill(-1);
      for (const [ci, si] of fixedCell) { slot[ci] = si; pos[si] = ci; }
      // 最初の並び：「前の席」の人を前の空き席に、ほかはくじで
      const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
      const frontFree = shuffle(free.filter((i) => cells[i].r < frontRows)), backFree = shuffle(free.filter((i) => cells[i].r >= frontRows));
      const order = shuffle(movers.filter((s) => front[s])).concat(shuffle(movers.filter((s) => !front[s])));
      // 空き席は後ろにまわしたいので、後ろの席ほどあとに使う
      const seatOrder = frontFree.concat(backFree.sort((x, y) => cells[x].r - cells[y].r || rand() - 0.5));
      if (!zoneOn) order.forEach((s, k) => { const ci = seatOrder[k]; slot[ci] = s; pos[s] = ci; });
      else {
        // 列を決めた人・「前の席」の人を、座れる席にくじで組み合わせてから、ほかの人を残りの席に
        const mt = match(shuffle(need), new Map(need.map((s) => [s, shuffle(adj.get(s))])));
        for (const [s, ci] of mt.seatOf) { slot[ci] = s; pos[s] = ci; }
        const rest = order.filter((s) => !mt.seatOf.has(s));
        const left = seatOrder.filter((ci) => slot[ci] < 0);
        rest.forEach((s, k) => { const ci = left[k]; slot[ci] = s; pos[s] = ci; });
      }

      let cur = cost(slot, pos, orient);
      let runBest = cur, runSlot = slot.slice();
      let T = 30;
      const cool = Math.pow(0.02 / T, 1 / iterations);
      for (let it = 0; it < iterations && runBest > 0; it++) {
        const a = free[Math.floor(rand() * free.length)], b = free[Math.floor(rand() * free.length)];
        if (a === b || (slot[a] < 0 && slot[b] < 0)) continue;
        const sa = slot[a], sb = slot[b];
        slot[a] = sb; slot[b] = sa;
        if (sa >= 0) pos[sa] = b;
        if (sb >= 0) pos[sb] = a;
        const next = cost(slot, pos, orient);
        const d = next - cur;
        if (d <= 0 || rand() < Math.exp(-d / T)) {
          cur = next;
          if (cur < runBest) { runBest = cur; runSlot = slot.slice(); }
        } else {
          slot[a] = sa; slot[b] = sb;
          if (sa >= 0) pos[sa] = a;
          if (sb >= 0) pos[sb] = b;
        }
        T *= cool;
      }
      if (!best || runBest < best.cost) best = { cost: runBest, slot: runSlot, orient };
      if (best.cost === 0) break; // 全部の条件を満たせたら、それ以上探さない
    }

    // 結果と、守れなかったこと
    const slot = best.slot, pos = new Array(n).fill(-1);
    slot.forEach((s, i) => { if (s >= 0) pos[s] = i; });
    const detail = [];
    cost(slot, pos, best.orient, detail);
    const seats = {};
    slot.forEach((s, i) => { if (s >= 0) seats[cells[i].k] = students[s].id; });
    const ids = (list) => list.map((s) => students[s].id);
    const issues = [];
    const frontMiss = detail.filter((d) => d.kind === 'front');
    const frontSeats = cells.filter((c) => c.r < frontRows).length;
    const frontWant = front.filter(Boolean).length;
    if (frontMiss.length) issues.push({ kind: 'front', ids: ids(frontMiss.map((d) => d.ids[0])), text: '「前の席」の人のうち ' + frontMiss.length + '人を、前から' + frontRows + '列目までに入れられませんでした' + (frontWant > frontSeats ? '（前の席は' + frontSeats + 'こ・希望は' + frontWant + '人）' : short && short.people.some((s) => zone[s] && zone[s].any) ? '（列を決めた人と、前の席を取り合っています）' : '（固定の席が前をふさいでいるかもしれません）') + '。' });
    // 列を決めた人
    const zoneMiss = [...new Set(detail.filter((d) => d.kind === 'zone').map((d) => d.ids[0]))];
    if (zoneMiss.length) {
      const inShort = new Set(short ? short.people : []);
      const noDesk = zoneMiss.filter((s) => !zone[s].any);
      const tight = zoneMiss.filter((s) => zone[s].any && inShort.has(s));
      const other = zoneMiss.filter((s) => zone[s].any && !inShort.has(s));
      if (noDesk.length) issues.push({ kind: 'zone', ids: ids(noDesk), text: '列を決めた人のうち ' + noDesk.length + '人は、決めた列に机がありません（机の数を減らしたか、机をなくしたため）。いちばん近い席にしました。' });
      if (tight.length) {
        const withFront = short.people.some((s) => !(zone[s] && zone[s].any));
        issues.push({ kind: 'zone', ids: ids(tight), text: '列を決めた人のうち ' + tight.length + '人を、決めた列に入れられませんでした（' + (withFront ? '「前の席」の人と合わせて ' : '') + short.people.length + '人に対して、座れる席が' + short.seats + 'こ' + (short.fixedIn ? '。決めた列のうち' + short.fixedIn + 'こは固定の席です' : '') + '）。' });
      }
      if (other.length) issues.push({ kind: 'zone', ids: ids(other), text: '列を決めた人のうち ' + other.length + '人を、決めた列に入れられませんでした。もう一度くじを引いてみてください。' });
    }
    if (frontClash.length) issues.push({ kind: 'zoneFront', ids: ids(frontClash), text: '「前の席」の人のうち ' + frontClash.length + '人は、決めた横の列が前から' + frontRows + '列目までと重ならないので、決めた列を優先しました。' });
    const zoneFixed = [];
    for (const [ci, s] of fixedCell) if (zone[s] && !zone[s].ok[ci]) zoneFixed.push(s);
    if (zoneFixed.length) issues.push({ kind: 'zoneFixed', ids: ids(zoneFixed), text: '固定の席の人のうち ' + zoneFixed.length + '人は、固定の席が決めた列の外にあります（固定を優先しました）。' });
    const apartMiss = detail.filter((d) => d.kind === 'apart');
    if (apartMiss.length) issues.push({ kind: 'apart', ids: ids(apartMiss.flatMap((d) => d.ids)), text: '「はなす」組のうち ' + apartMiss.length + '組が、近くの席になりました。' });
    const mixMiss = detail.filter((d) => d.kind === 'mix');
    if (mixMiss.length && mix !== 'none') {
      const mN = gender.filter((g) => g === 1).length, fN = gender.filter((g) => g === 2).length;
      issues.push({ kind: 'mix', ids: [], text: '男女の並びが合わないところが ' + mixMiss.length + 'か所あります' + (mN !== fN ? '（男子' + mN + '人・女子' + fN + '人で、人数がちがうため）' : '') + '。' });
    }
    const ps = detail.filter((d) => d.kind === 'prevSide');
    if (ps.length) issues.push({ kind: 'prevSide', ids: ids(ps.flatMap((d) => d.ids)), text: '前回と同じとなり同士が ' + ps.length + '組あります。' });
    const same = detail.filter((d) => d.kind === 'sameSeat');
    if (same.length) issues.push({ kind: 'sameSeat', ids: ids(same.map((d) => d.ids[0])), text: '前回と同じ席の人が ' + same.length + '人います。' });
    return { ok: true, seats, cost: best.cost, issues, cells: cells.length, students: n };
  }

  // 席の表から、だれがどこか・となりはだれかを調べる小物（画面と印刷で使う）
  function neighborsOf(seats, rows, cols, blocked, pairs) {
    const g = geometry(rows, cols, blocked, pairs);
    const out = {};
    for (const cell of g.cells) {
      const id = seats[cell.k]; if (!id) continue;
      out[id] = cell.side.map((j) => seats[g.cells[j].k]).filter(Boolean);
    }
    return out;
  }

  // 列の決めごとを、先生の言葉に。縦の列は「黒板に向かって左から」、横の列は「前から」数える（図の向きを変えても同じ）
  //   zoneText({ cols: [0, 1], rows: [0, 1, 2] }, { cols: 6, window: 'left' }) → '縦の列：黒板に向かって左から1・2列目（窓側）、横の列：前から1〜3列目'
  //   o.cols … 教室の縦の列の数 / o.window … 窓の側（'left'|'right'。黒板に向かって）/ o.short … 「黒板に向かって」を省く
  const numsText = (list) => {
    const a = normIdx(list).map((x) => x + 1), out = [];
    for (let i = 0; i < a.length;) {
      let j = i;
      while (j + 1 < a.length && a[j + 1] === a[j] + 1) j++;
      out.push(j - i >= 2 ? a[i] + '〜' + a[j] : a.slice(i, j + 1).join('・'));
      i = j + 1;
    }
    return out.join('・');
  };
  function zoneText(z, o = {}) {
    const cols = normIdx(z && z.cols), rows = normIdx(z && z.rows), parts = [];
    if (cols.length) {
      let side = '';
      if (o.cols > 1 && (o.window === 'left' || o.window === 'right')) {
        const win = o.window === 'right' ? o.cols - 1 : 0, hall = o.window === 'right' ? 0 : o.cols - 1;
        const w = cols.includes(win), hl = cols.includes(hall);
        side = w && !hl ? '（窓側）' : hl && !w ? '（廊下側）' : '';
      }
      parts.push('縦の列：' + (o.short ? '左から' : '黒板に向かって左から') + numsText(cols) + '列目' + side);
    }
    if (rows.length) parts.push('横の列：前から' + numsText(rows) + '列目');
    return parts.join('、');
  }

  const api = { solve, geometry, neighborsOf, zoneText, normIdx, WEIGHTS: W, key };
  root.SeatSolver = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

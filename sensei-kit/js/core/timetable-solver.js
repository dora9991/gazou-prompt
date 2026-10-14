/* 時間割を組む部品（画面とは切りはなした、ただの計算。tools/test.cjs から Node でも動かす）
   TimetableSolver.solve(plan, { seed, maxSteps, timeLimit })
   plan = {
     days: 5, perDay: [6,6,5,6,6],     … 曜日の数と、曜日ごとの時限の数
     lunchAfter: 4,                    … 何時間目のあとが昼休みか（2時間続きの授業は、ここをまたがない）
     classes:  [{ id, name, grade }],
     subjects: [{ id, name, hours: {1:4, 2:4, 3:3}, block: false }],   … 学年ごとの週の時間数。block … 2時間続けてとる
     teachers: [{ id, name, off: ['d-p'] }],                            … off … 授業に入れないコマ（0はじまり）
     assign:   { [classId]: { [subjectId]: [teacherId] } },             … 担当（いない・未定は空）
     fixed:    [{ d, p, subjectId, grades: [1,2] | null }],            … 固定のコマ（学活など）。grades が null なら全学年
     hoursOverride: { [classId]: { [subjectId]: 3 } },                  … そのクラスだけ時間数を変えるとき
   }
   返り値 { ok, cells: { [classId]: { 'd-p': { subjectId, teacherIds, fixed, part } } }, unplaced: [{classId, subjectId, len}], problems: [文], steps, ms }
   やり方：むずかしい授業から順に、空いているコマへ入れる。入れる場所がないときは、ぶつかる授業を外して入れ直し、
   外した授業をもう一度並べる（同じ場所に戻らないよう少しのあいだ覚えておく）。決められた回数で全部入らなければ、入らなかった授業を返す。 */
(function (root) {
  'use strict';

  function rng(seed) {
    let a = (seed == null ? Math.floor(Math.random() * 0xffffffff) : seed) >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const now = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());

  // 1つのクラス・教科の、週の時間数
  function hoursOf(plan, cls, subj) {
    const o = plan.hoursOverride && plan.hoursOverride[cls.id] && plan.hoursOverride[cls.id][subj.id];
    if (o != null && o !== '') return Math.max(0, +o || 0);
    const hrs = subj.hours || {};
    const v = hrs[cls.grade] != null ? hrs[cls.grade] : hrs.all;
    return Math.max(0, +v || 0);
  }

  // 前もって分かる無理（コマが足りない・先生の持ち時間が多すぎる）
  function precheck(plan) {
    const problems = [];
    const P = Math.max(...plan.perDay.slice(0, plan.days));
    const slots = plan.perDay.slice(0, plan.days).reduce((a, b) => a + b, 0);
    const load = new Map();
    for (const c of plan.classes) {
      let total = 0;
      for (const s of plan.subjects) {
        const h = hoursOf(plan, c, s);
        total += h;
        for (const t of (plan.assign[c.id] && plan.assign[c.id][s.id]) || []) load.set(t, (load.get(t) || 0) + h);
      }
      if (total > slots) problems.push(c.name + ' の授業は週' + total + '時間ですが、コマは' + slots + 'しかありません。');
    }
    for (const t of plan.teachers) {
      const n = load.get(t.id) || 0;
      const free = slots - (t.off || []).filter((k) => { const [d, p] = k.split('-').map(Number); return d < plan.days && p < plan.perDay[d]; }).length;
      if (n > free) problems.push(t.name + ' 先生の持ち時間は週' + n + '時間ですが、入れるコマは' + free + 'しかありません。');
    }
    void P;
    return problems;
  }

  function solve(plan, opt = {}) {
    const t0 = now();
    const rand = rng(opt.seed);
    const D = plan.days | 0, perDay = plan.perDay.slice(0, D).map((x) => x | 0);
    const P = Math.max(1, ...perDay);
    const T = D * P;
    const lunch = plan.lunchAfter == null ? 4 : plan.lunchAfter | 0; // この時限のあと（1はじまり）で区切る
    const valid = new Array(T).fill(false);
    for (let d = 0; d < D; d++) for (let p = 0; p < perDay[d]; p++) valid[d * P + p] = true;
    const key = (t) => Math.floor(t / P) + '-' + (t % P);
    const classes = plan.classes, subjects = plan.subjects, teachers = plan.teachers;
    const cIndex = new Map(classes.map((c, i) => [c.id, i]));
    const sIndex = new Map(subjects.map((s, i) => [s.id, i]));
    const tIndex = new Map(teachers.map((t, i) => [t.id, i]));
    const off = teachers.map((t) => { const a = new Array(T).fill(false); for (const k of t.off || []) { const [d, p] = String(k).split('-').map(Number); if (d < D && p < P) a[d * P + p] = true; } return a; });
    const problems = precheck(plan);

    // 置くもの（ユニット）をつくる。固定のコマは先に置く
    const units = [];
    const fixedCount = classes.map(() => subjects.map(() => 0));
    const fixedUnits = [];
    for (const f of plan.fixed || []) {
      const si = sIndex.get(f.subjectId);
      if (si == null || f.d >= D || f.p >= perDay[f.d]) continue;
      for (let ci = 0; ci < classes.length; ci++) {
        const c = classes[ci];
        if (f.grades && f.grades.length && !f.grades.includes(c.grade)) continue;
        const tids = ((plan.assign[c.id] && plan.assign[c.id][f.subjectId]) || []).map((id) => tIndex.get(id)).filter((x) => x != null);
        fixedUnits.push({ ci, si, tids, len: 1, fixed: true, at: f.d * P + f.p });
        fixedCount[ci][si]++;
      }
    }
    for (let ci = 0; ci < classes.length; ci++) {
      for (let si = 0; si < subjects.length; si++) {
        let h = hoursOf(plan, classes[ci], subjects[si]) - fixedCount[ci][si];
        if (h <= 0) continue;
        const tids = ((plan.assign[classes[ci].id] && plan.assign[classes[ci].id][subjects[si].id]) || []).map((id) => tIndex.get(id)).filter((x) => x != null);
        if (subjects[si].block) { while (h >= 2) { units.push({ ci, si, tids, len: 2 }); h -= 2; } }
        while (h > 0) { units.push({ ci, si, tids, len: 1 }); h--; }
      }
    }
    // 1日に同じ教科を何回まで（2時間続きは1回と数える）
    const unitsPer = classes.map(() => subjects.map(() => 0));
    for (const u of units) unitsPer[u.ci][u.si]++;
    for (const u of fixedUnits) unitsPer[u.ci][u.si]++;
    const maxDay = classes.map((c, ci) => subjects.map((s, si) => Math.max(1, Math.ceil(unitsPer[ci][si] / D))));

    // 置き場所の表
    const classAt = classes.map(() => new Array(T).fill(-1));
    const teacherAt = teachers.map(() => new Array(T).fill(-1));
    const dayCount = classes.map(() => subjects.map(() => new Array(D).fill(0)));
    const all = fixedUnits.concat(units);
    const pos = new Array(all.length).fill(-1);
    const isFixed = (u) => !!all[u].fixed;
    function place(u, t) {
      const x = all[u];
      for (let k = 0; k < x.len; k++) { classAt[x.ci][t + k] = u; for (const te of x.tids) teacherAt[te][t + k] = u; }
      dayCount[x.ci][x.si][Math.floor(t / P)]++;
      pos[u] = t;
    }
    function unplace(u) {
      const x = all[u], t = pos[u];
      if (t < 0) return;
      for (let k = 0; k < x.len; k++) { if (classAt[x.ci][t + k] === u) classAt[x.ci][t + k] = -1; for (const te of x.tids) if (teacherAt[te][t + k] === u) teacherAt[te][t + k] = -1; }
      dayCount[x.ci][x.si][Math.floor(t / P)]--;
      pos[u] = -1;
    }
    // その形で置けるか（ほかの授業とのぶつかりは見ない）
    function shapeOk(x, t) {
      if (!valid[t]) return false;
      const d = Math.floor(t / P), p = t % P;
      if (x.len === 2) {
        if (p + 1 >= perDay[d]) return false;
        if (lunch > 0 && p + 1 === lunch) return false; // 昼休みをまたぐ
      }
      for (let k = 0; k < x.len; k++) for (const te of x.tids) if (off[te][t + k]) return false;
      return true;
    }
    function free(x, t) {
      for (let k = 0; k < x.len; k++) {
        if (classAt[x.ci][t + k] >= 0) return false;
        for (const te of x.tids) if (teacherAt[te][t + k] >= 0) return false;
      }
      return dayCount[x.ci][x.si][Math.floor(t / P)] < maxDay[x.ci][x.si];
    }
    // その場所に置くと、外さないといけない授業
    function clashes(u, t) {
      const x = all[u], out = new Set();
      for (let k = 0; k < x.len; k++) {
        const a = classAt[x.ci][t + k]; if (a >= 0) out.add(a);
        for (const te of x.tids) { const b = teacherAt[te][t + k]; if (b >= 0) out.add(b); }
      }
      const d = Math.floor(t / P);
      if (dayCount[x.ci][x.si][d] >= maxDay[x.ci][x.si]) {
        // 同じ日の同じ教科のうち1つ（すでに外す予定のものがあればそれで足りる）
        let already = false;
        for (const v of out) if (all[v].ci === x.ci && all[v].si === x.si && Math.floor(pos[v] / P) === d) already = true;
        if (!already) {
          const same = [];
          for (let q = d * P; q < d * P + P; q++) { const v = classAt[x.ci][q]; if (v >= 0 && v !== u && all[v].si === x.si && !same.includes(v)) same.push(v); }
          if (same.length) out.add(same[Math.floor(rand() * same.length)]);
        }
      }
      return [...out];
    }

    // 固定のコマを置く（ぶつかったら知らせる）
    for (let u = 0; u < fixedUnits.length; u++) {
      const x = all[u];
      if (classAt[x.ci][x.at] >= 0) { problems.push(classes[x.ci].name + ' の ' + key(x.at) + ' に固定のコマが重なっています。'); continue; }
      let busy = false;
      for (const te of x.tids) if (teacherAt[te][x.at] >= 0) busy = true;
      if (busy) problems.push(subjects[x.si].name + ' の固定のコマで、先生が2つのクラスに重なっています（' + classes[x.ci].name + '）。');
      for (let k = 0; k < x.len; k++) { classAt[x.ci][x.at + k] = u; for (const te of x.tids) if (teacherAt[te][x.at + k] < 0) teacherAt[te][x.at + k] = u; }
      dayCount[x.ci][x.si][Math.floor(x.at / P)]++;
      pos[u] = x.at;
    }

    // むずかしい順：2時間続き → 先生の持ち時間が多い → 先生の都合が多い
    const tLoad = teachers.map(() => 0);
    for (const x of all) for (const te of x.tids) tLoad[te] += x.len;
    const offN = off.map((a) => a.filter(Boolean).length);
    const diff = (x) => (x.len === 2 ? 1000 : 0) + Math.max(0, ...x.tids.map((te) => tLoad[te] + offN[te] * 2)) + (x.tids.length > 1 ? 50 : 0);
    const queue = [];
    for (let u = fixedUnits.length; u < all.length; u++) queue.push(u);
    queue.sort((a, b) => diff(all[b]) - diff(all[a]) || rand() - 0.5);

    const shapeSlots = all.map((x) => { const s = []; for (let t = 0; t < T; t++) if (shapeOk(x, t)) s.push(t); return s; });
    const tabu = new Map(); // u → { t, until }
    const maxSteps = opt.maxSteps || 60000;
    const timeLimit = opt.timeLimit || 4000;
    let steps = 0, bestLeft = Infinity, bestPos = null;
    const impossible = new Set();
    while (queue.length && steps < maxSteps) {
      steps++;
      if ((steps & 255) === 0 && now() - t0 > timeLimit) break;
      const u = queue.shift();
      const x = all[u];
      const cand = shapeSlots[u];
      if (!cand.length) { impossible.add(u); continue; }
      const open = cand.filter((t) => free(x, t));
      if (open.length) { place(u, open[Math.floor(rand() * open.length)]); }
      else {
        let best = null, bestScore = Infinity;
        for (const t of cand) {
          const cs = clashes(u, t);
          if (cs.some(isFixed)) continue;
          const tb = tabu.get(u);
          let score = cs.reduce((s, v) => s + all[v].len, 0) + rand() * 0.9;
          if (tb && tb.t === t && tb.until > steps) score += 50;
          for (const v of cs) { const tv = tabu.get(v); if (tv && tv.until > steps) score += 2; }
          if (score < bestScore) { bestScore = score; best = { t, cs }; }
        }
        if (!best) { impossible.add(u); continue; }
        for (const v of best.cs) { tabu.set(v, { t: pos[v], until: steps + 12 }); unplace(v); queue.push(v); }
        place(u, best.t);
      }
      if (queue.length < bestLeft) { bestLeft = queue.length; bestPos = pos.slice(); }
    }
    if (queue.length > 0 && bestPos && bestLeft < queue.length) {
      // いちばん入っていたときに戻す
      for (let u = fixedUnits.length; u < all.length; u++) unplace(u);
      for (let u = fixedUnits.length; u < all.length; u++) if (bestPos[u] >= 0) place(u, bestPos[u]);
    }

    // 結果
    const cells = {};
    for (const c of classes) cells[c.id] = {};
    for (let u = 0; u < all.length; u++) {
      const x = all[u], t = pos[u];
      if (t < 0) continue;
      for (let k = 0; k < x.len; k++) {
        cells[classes[x.ci].id][key(t + k)] = { subjectId: subjects[x.si].id, teacherIds: x.tids.map((te) => teachers[te].id), fixed: !!x.fixed, part: x.len === 2 ? k + 1 : 0 };
      }
    }
    const unplaced = [];
    for (let u = fixedUnits.length; u < all.length; u++) if (pos[u] < 0) unplaced.push({ classId: classes[all[u].ci].id, subjectId: subjects[all[u].si].id, teacherIds: all[u].tids.map((te) => teachers[te].id), len: all[u].len });
    for (const u of impossible) {
      const x = all[u];
      if (pos[u] < 0) problems.push(classes[x.ci].name + ' の ' + subjects[x.si].name + (x.len === 2 ? '（2時間続き）' : '') + ' を入れられるコマがありません（先生の都合・昼休み・時限の数を確かめてください）。');
    }
    return { ok: unplaced.length === 0, cells, unplaced, problems: [...new Set(problems)], steps, ms: Math.round(now() - t0), units: units.length + fixedUnits.length };
  }

  // できた時間割の確かめ（手で入れかえたあとに使う）：先生の重なり・先生の都合・1日の回数
  function check(plan, cells) {
    const D = plan.days | 0, perDay = plan.perDay;
    const out = { clash: [], off: [], twice: [] }; // それぞれ { classId, key, ... }
    const byTeacher = {};
    const offSet = new Map(plan.teachers.map((t) => [t.id, new Set(t.off || [])]));
    for (const c of plan.classes) {
      const cc = cells[c.id] || {};
      const perDaySubj = {};
      for (const [k, cell] of Object.entries(cc)) {
        if (!cell) continue;
        const [d, p] = k.split('-').map(Number);
        if (d >= D || p >= perDay[d]) continue;
        for (const te of cell.teacherIds || []) {
          (byTeacher[te + '@' + k] = byTeacher[te + '@' + k] || []).push(c.id);
          if (offSet.get(te) && offSet.get(te).has(k)) out.off.push({ classId: c.id, key: k, teacherId: te });
        }
        if (cell.part !== 2 && !cell.fixed) { const kk = d + ':' + cell.subjectId; perDaySubj[kk] = (perDaySubj[kk] || 0) + 1; }
      }
      for (const [kk, n] of Object.entries(perDaySubj)) {
        const [d, sid] = kk.split(':');
        const subj = plan.subjects.find((s) => s.id === sid);
        let hours = 0;
        if (subj) { const o = plan.hoursOverride && plan.hoursOverride[c.id] && plan.hoursOverride[c.id][sid]; hours = o != null && o !== '' ? +o : +((subj.hours || {})[c.grade] != null ? subj.hours[c.grade] : (subj.hours || {}).all) || 0; }
        const fixedN = (plan.fixed || []).filter((f) => f.subjectId === sid && (!f.grades || !f.grades.length || f.grades.includes(c.grade))).length;
        const rest = Math.max(0, hours - fixedN);
        const unitsN = (subj && subj.block ? Math.floor(rest / 2) + (rest % 2) : rest) + fixedN;
        if (n > Math.max(1, Math.ceil(unitsN / D))) out.twice.push({ classId: c.id, day: +d, subjectId: sid });
      }
    }
    for (const [k, list] of Object.entries(byTeacher)) if (list.length > 1) { const [te, key] = k.split('@'); for (const cid of list) out.clash.push({ classId: cid, key, teacherId: te }); }
    return out;
  }

  const api = { solve, check, precheck, hoursOf };
  root.TimetableSolver = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

// 時間割：わたしの時間割（表をつくって印刷・ホームに今日の分）と、学校の時間割を自動でつくる（教務向け）
(function () {
  'use strict';
  const { h } = Kit;
  const TS = window.TimetableSolver;
  const WD = ['月', '火', '水', '木', '金', '土'];
  const K = (d, p) => d + '-' + p;
  const range = (n) => Array.from({ length: n }, (_, i) => i);
  // 教科の色（名前から決める。同じ名前はいつも同じ色）
  const colorOf = (name) => { let x = 0; for (const ch of String(name || '')) x = (x * 31 + ch.charCodeAt(0)) >>> 0; return 'var(--series-' + ((x % 8) + 1) + ')'; };
  const DEFAULT_BELL = [['08:50', '09:40'], ['09:50', '10:40'], ['10:50', '11:40'], ['11:50', '12:40'], ['13:30', '14:20'], ['14:30', '15:20'], ['15:30', '16:20'], ['16:30', '17:20']];

  /* ───────── 教科の初期値（中学校は学習指導要領の標準時数を週あたりにしたもの） ───────── */
  const JHS_SUBJECTS = [
    ['国語', '国', { 1: 4, 2: 4, 3: 3 }], ['社会', '社', { 1: 3, 2: 3, 3: 4 }], ['数学', '数', { 1: 4, 2: 3, 3: 4 }], ['理科', '理', { 1: 3, 2: 4, 3: 4 }],
    ['音楽', '音', { 1: 1, 2: 1, 3: 1 }], ['美術', '美', { 1: 1, 2: 1, 3: 1 }], ['保健体育', '体', { 1: 3, 2: 3, 3: 3 }], ['技術・家庭', '技家', { 1: 2, 2: 2, 3: 1 }, true],
    ['英語', '英', { 1: 4, 2: 4, 3: 4 }], ['道徳', '道', { 1: 1, 2: 1, 3: 1 }], ['総合', '総', { 1: 2, 2: 2, 3: 2 }], ['学活', '学活', { 1: 1, 2: 1, 3: 1 }],
  ];
  const ES_SUBJECTS = ['国語', '社会', '算数', '理科', '生活', '音楽', '図画工作', '家庭', '体育', '外国語', '外国語活動', '道徳', '総合', '学活'];
  const HS_SUBJECTS = ['国語', '地理歴史', '公民', '数学', '理科', '保健体育', '芸術', '外国語', '家庭', '情報', '総合的な探究', 'HR'];
  const SHORT = { 図画工作: '図工', 外国語活動: '外活', 地理歴史: '地歴', 総合的な探究: '探究', 保健体育: '体', 外国語: '外' };
  const jhsSubjects = () => JHS_SUBJECTS.map(([name, short, hours, block], i) => ({ id: 'sub-' + i, name, short, hours: Object.assign({}, hours), block: !!block }));
  const listSubjects = (names) => names.map((name, i) => ({ id: 'sub-' + i, name, short: SHORT[name] || name.slice(0, 1), hours: {}, block: false }));
  const subjectsFor = (level) => (level === 'es' ? listSubjects(ES_SUBJECTS) : level === 'hs' ? listSubjects(HS_SUBJECTS) : jhsSubjects());

  /* ───────── サンプル（架空の中学校 6クラス） ───────── */
  function samplePlan() {
    const subjects = jhsSubjects();
    const sid = (name) => subjects.find((s) => s.name === name).id;
    const classes = [];
    for (let g = 1; g <= 3; g++) for (let k = 1; k <= 2; k++) classes.push({ id: 'c' + g + k, name: g + '-' + k, grade: g });
    const names = ['青山', '石井', '上野', '江口', '小川', '加藤', '木下', '久保', '小松', '佐藤', '島田', '杉山', '高橋', '田村', '中村'];
    const teachers = names.map((n, i) => ({ id: 't' + i, name: n, off: [] }));
    const T = (n) => teachers.find((t) => t.name === n).id;
    teachers.find((t) => t.name === '島田').off = ['3-0', '3-1', '3-2', '3-3', '3-4', '3-5', '4-0', '4-1', '4-2', '4-3', '4-4', '4-5']; // 非常勤（木・金はいない）
    teachers.find((t) => t.name === '中村').off = ['0-0', '0-1', '0-2', '0-3', '0-4', '0-5']; // 月は出張が多い
    const assign = {};
    const set = (cls, subj, who) => { (assign[cls] = assign[cls] || {})[sid(subj)] = who.map(T); };
    const homeroom = { c11: '青山', c12: '上野', c21: '石井', c22: '木下', c31: '江口', c32: '久保' };
    for (const c of classes) {
      const g = c.grade;
      set(c.id, '国語', [g === 2 ? '石井' : '青山']); set(c.id, '社会', [g === 3 ? '江口' : '上野']); set(c.id, '数学', [g === 2 ? '加藤' : '小川']);
      set(c.id, '理科', [g === 3 ? '久保' : '木下']); set(c.id, '英語', [g === 3 ? '佐藤' : '小松']); set(c.id, '音楽', ['島田']); set(c.id, '美術', ['杉山']);
      set(c.id, '保健体育', [g === 3 ? '田村' : '高橋']); set(c.id, '技術・家庭', ['中村']);
      for (const s of ['道徳', '総合', '学活']) set(c.id, s, [homeroom[c.id]]);
    }
    const fixed = [{ d: 0, p: 5, subjectId: sid('道徳'), grades: null }, { d: 3, p: 4, subjectId: sid('総合'), grades: null }, { d: 3, p: 5, subjectId: sid('総合'), grades: null }, { d: 4, p: 5, subjectId: sid('学活'), grades: null }];
    const used = new Set(Object.values(assign).flatMap((x) => Object.values(x).flat()));
    const plan = { id: 's-ttplan-1', name: 'ひかり中（架空）2学期', days: 5, perDay: [6, 6, 5, 6, 6], lunchAfter: 4, classes, subjects, teachers: teachers.filter((t) => used.has(t.id)), assign, fixed, hoursOverride: {} };
    const r = TS.solve(plan, { seed: 2026 });
    plan.result = { cells: r.cells, unplaced: r.unplaced, problems: r.problems, at: new Date().toISOString(), stale: false };
    return plan;
  }
  const SAMPLE_PLAN = samplePlan();
  // サンプルの「わたしの時間割」：数学の小川先生の時間割を写したもの
  function teacherGrid(plan, teacherId, name) {
    const cells = {};
    for (const c of plan.classes) for (const [k, cell] of Object.entries((plan.result && plan.result.cells[c.id]) || {})) {
      if (!(cell.teacherIds || []).includes(teacherId)) continue;
      const s = plan.subjects.find((x) => x.id === cell.subjectId);
      cells[k] = { s: s ? s.name : '', n: c.name };
    }
    return { name, days: plan.days, perDay: plan.perDay.slice(), cells, bell: DEFAULT_BELL.slice(0, Math.max(...plan.perDay)).map((x) => ({ start: x[0], end: x[1] })) };
  }
  const SAMPLE_GRID = Object.assign({ id: 's-ttgrid-1' }, teacherGrid(SAMPLE_PLAN, 't4', 'わたしの時間割（例：数学の小川先生）'));
  Kit.store.sample('ttplans', [SAMPLE_PLAN]);
  Kit.store.sample('ttgrids', [SAMPLE_GRID]);

  const normGrid = (g) => {
    const o = Object.assign({ name: '時間割', days: 5, perDay: [6, 6, 6, 6, 6], cells: {}, bell: [] }, g || {});
    o.days = o.days === 6 ? 6 : 5;
    o.perDay = range(o.days).map((d) => Kit.clamp((o.perDay && o.perDay[d]) | 0 || 6, 1, 8));
    const P = Math.max(...o.perDay);
    o.bell = range(P).map((p) => Object.assign({ start: '', end: '' }, (o.bell || [])[p] || {}));
    return o;
  };
  const normPlan = (p) => {
    const o = Object.assign({ name: '時間割', days: 5, perDay: [6, 6, 5, 6, 6], lunchAfter: 4, classes: [], subjects: [], teachers: [], assign: {}, fixed: [], hoursOverride: {}, result: null }, p || {});
    o.days = o.days === 6 ? 6 : 5;
    o.perDay = range(o.days).map((d) => Kit.clamp((o.perDay && o.perDay[d]) | 0 || 6, 1, 8));
    return o;
  };

  Kit.css('timetable', `
.tt-tabs{margin-bottom:14px}
.tt-top{display:flex;flex-wrap:wrap;align-items:center;gap:8px 10px;margin-bottom:12px}
.tt-top select{width:auto;max-width:100%}
.tt-grid-wrap{overflow-x:auto}
.tt-grid{display:grid;grid-template-columns:76px repeat(var(--days),minmax(92px,1fr));border:1px solid var(--line);border-radius:var(--r);overflow:hidden;background:var(--surface);min-width:calc(76px + var(--days) * 92px)}
.tt-h{background:var(--surface-2);font-size:12.5px;font-weight:700;color:var(--ink-2);text-align:center;padding:6px 4px;border-bottom:1px solid var(--line)}
.tt-h.is-today{background:var(--gosu);color:var(--on-gosu)}
.tt-ph{display:grid;align-content:center;justify-items:center;gap:0;background:var(--surface-2);border-top:1px solid var(--line);font-weight:700;font-size:15px;padding:4px 2px}
.tt-ph small{font-weight:400;font-size:10.5px;color:var(--ink-3);font-variant-numeric:tabular-nums;line-height:1.3}
.tt-c{position:relative;min-height:64px;border:0;border-top:1px solid var(--line);border-left:1px solid var(--line);border-radius:0;padding:5px 6px;display:grid;align-content:center;justify-items:center;text-align:center;gap:1px;background:var(--surface);font:inherit;color:var(--ink);cursor:pointer}
button.tt-c:hover{background:var(--surface-2)}
.tt-c.has{background:color-mix(in srgb,var(--c) 15%,var(--surface))}
.tt-c.has::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--c)}
.tt-c .s{font-weight:700;font-size:15px;line-height:1.25}
.tt-c .n{font-size:12px;color:var(--ink-2);line-height:1.3}
.tt-c.none{background:repeating-linear-gradient(135deg,var(--surface-2) 0 6px,var(--surface) 6px 12px);cursor:default}
.tt-c.is-sel{outline:3px solid var(--shu);outline-offset:-3px}
.tt-c.bad{box-shadow:inset 0 0 0 2px var(--bad)}
.tt-c.warn{box-shadow:inset 0 0 0 2px var(--warn)}
.tt-c.fixed .s::after{content:" 固";font-size:10px;color:var(--ink-3);font-weight:400}
.tt-c.lunch-after{border-bottom:3px double var(--line-strong)}
.tt-palette{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:10px 0}
.tt-palette .chip{min-height:32px;cursor:pointer;border:1px solid var(--line);font-size:13px}
.tt-palette .chip .dot{background:var(--c)}
.tt-palette .chip[aria-pressed="true"]{border-color:var(--shu);box-shadow:0 0 0 2px color-mix(in srgb,var(--shu) 30%,transparent);font-weight:700}
.tt-steps{margin-bottom:12px}
.tt-mx-wrap{overflow:auto;max-height:min(70vh,700px);border:1px solid var(--line);border-radius:var(--r);background:var(--surface)}
.tt-mx{border-collapse:separate;border-spacing:0;font-size:13px}
.tt-mx th,.tt-mx td{border-bottom:1px solid var(--line);border-right:1px solid var(--line);padding:3px 4px;background:var(--surface)}
.tt-mx thead th{position:sticky;top:0;z-index:2;background:var(--surface-2);font-size:12px;white-space:nowrap}
.tt-mx tbody th{position:sticky;left:0;z-index:1;background:var(--surface-2);text-align:left;white-space:nowrap;font-size:13px}
.tt-mx thead th:first-child{left:0;z-index:3}
.tt-mx input[type=text]{min-height:30px;padding:2px 6px;font-size:13px;min-width:5.5em}
.tt-mx input[type=number]{min-height:30px;padding:2px 4px;font-size:13px;width:4.2em;text-align:right}
.tt-mx td.c{text-align:center}
.tt-sum{font-size:13px;color:var(--ink-2)}
.tt-sum b{color:var(--ink)}
.tt-sum .bad{color:var(--bad);font-weight:700}
.tt-off{display:grid;gap:12px;grid-template-columns:1fr}
@media (min-width:900px){.tt-off{grid-template-columns:220px minmax(0,1fr)}}
.tt-tlist{display:grid;gap:4px;max-height:420px;overflow:auto}
.tt-tlist button{display:flex;justify-content:space-between;gap:8px;text-align:left;padding:6px 10px;border-radius:8px;border:1px solid var(--line);background:var(--surface);font:inherit;font-size:13.5px;cursor:pointer;color:var(--ink)}
.tt-tlist button[aria-pressed="true"]{background:var(--gosu-wash);border-color:var(--gosu);font-weight:700}
.tt-mini{display:grid;grid-template-columns:44px repeat(var(--days),minmax(46px,1fr));gap:3px;max-width:520px}
.tt-mini .h{font-size:12px;text-align:center;color:var(--ink-3);font-weight:700}
.tt-mini button{min-height:34px;border-radius:6px;border:1px solid var(--line);background:var(--surface);font:inherit;font-size:12px;cursor:pointer;color:var(--ink)}
.tt-mini button.on{background:var(--bad-wash);border-color:var(--bad);color:var(--bad);font-weight:700}
.tt-mini button.fx{background:color-mix(in srgb,var(--c) 18%,var(--surface));border-color:var(--c);font-weight:700}
.tt-mini button.none{visibility:hidden}
.tt-res{display:grid;gap:10px}
.tt-msg{display:flex;gap:8px;align-items:flex-start;font-size:13.5px;padding:9px 12px;border-radius:8px}
.tt-msg svg{flex:none;width:16px;height:16px;margin-top:3px}
.tt-msg.ok{background:var(--ok-wash)}.tt-msg.ok svg{color:var(--ok)}
.tt-msg.bad{background:var(--bad-wash)}.tt-msg.bad svg{color:var(--bad)}
.tt-msg.warn{background:var(--warn-wash)}.tt-msg.warn svg{color:var(--warn)}
.tt-all-wrap{overflow:auto;border:1px solid var(--line);border-radius:var(--r);background:var(--surface);max-height:70vh}
.tt-all{border-collapse:separate;border-spacing:0;font-size:12px}
.tt-all th,.tt-all td{border-right:1px solid var(--line);border-bottom:1px solid var(--line);padding:3px 4px;text-align:center;white-space:nowrap;background:var(--surface)}
.tt-all thead th{position:sticky;top:0;background:var(--surface-2);z-index:2}
.tt-all thead tr:nth-child(2) th{top:26px}
.tt-all tbody th{position:sticky;left:0;background:var(--surface-2);z-index:1}
.tt-all td.has{background:color-mix(in srgb,var(--c) 15%,var(--surface))}
.tt-all td.dayend,.tt-all th.dayend{border-right:2px solid var(--line-strong)}
.tt-all td.bad{box-shadow:inset 0 0 0 2px var(--bad)}
@media (max-width:640px){
  .tt-grid{grid-template-columns:44px repeat(var(--days),minmax(54px,1fr));min-width:calc(44px + var(--days) * 54px)}
  .tt-c{min-height:52px;padding:3px 2px}
  .tt-c .s{font-size:13px}
  .tt-c .n{font-size:10.5px}
  .tt-ph small{display:none}
}
/* 印刷 */
.tt-print{color:#000;font-family:var(--font-body)}
.tt-print h1{font-size:18pt;margin:0 0 3mm;font-family:var(--font-display)}
.tt-print .pg{page-break-after:always}
.tt-print .pg:last-child{page-break-after:auto}
.tt-print table{width:100%;border-collapse:collapse;table-layout:fixed}
.tt-print th,.tt-print td{border:1pt solid #000;text-align:center;vertical-align:middle;padding:1.5mm}
.tt-print th{background:#eee;font-size:11pt}
.tt-print td{height:var(--rh,22mm)}
.tt-print td .s{display:block;font-size:var(--fs,16pt);font-weight:700}
.tt-print td .n{display:block;font-size:9pt}
.tt-print td.none{background:#ddd}
.tt-print th small{display:block;font-weight:400;font-size:8pt}
.tt-print.all table{font-size:8pt}
.tt-print.all td{height:auto;padding:.8mm .5mm}
.tt-print.all th{font-size:8pt;padding:.8mm}
`);

  Kit.app({
    id: 'timetable', title: '時間割', group: 'lesson', icon: 'table', order: 40,
    desc: 'わたしの時間割をつくって印刷。学校の時間割を条件から自動でつくることも',
    colls: ['ttgrids', 'ttplans'],
    async mount(root, params) {
      const S = { tab: Kit.pref.get('tt:tab', 'mine'), grids: [], grid: null, plans: [], plan: null, paint: null, sel: null, pstep: Kit.pref.get('tt:pstep', 'base'), view: 'class', viewId: null, tsel: null, offT: null, fxSubject: null, fxGrades: [] };
      let alive = true;
      const tabsBox = h('div', { class: 'tt-tabs' }), sampleSlot = h('div'), main = h('div');
      root.append(Kit.appHead({
        title: '時間割',
        desc: '自分の時間割をつくって印刷。学校の時間割を自動で組むこともできます。',
      }), tabsBox, sampleSlot, main);

      async function load() {
        S.grids = (await Kit.store.list('ttgrids', { sample: [SAMPLE_GRID] })).map((g) => Object.assign(normGrid(g), { id: g.id, sample: g.sample }));
        S.plans = (await Kit.store.list('ttplans', { sample: [SAMPLE_PLAN] })).map((p) => Object.assign(normPlan(p), { id: p.id, sample: p.sample }));
        const gid = (S.grid && S.grid.id) || Kit.pref.get('tt:grid', null);
        S.grid = Kit.clone(S.grids.find((g) => g.id === gid) || S.grids[0] || null);
        const pid = (S.plan && S.plan.id) || Kit.pref.get('tt:plan', null);
        S.plan = Kit.clone(S.plans.find((p) => p.id === pid) || S.plans[0] || null);
      }
      const saveGrid = Kit.debounce(async () => { if (S.grid) { delete S.grid.sample; await Kit.store.put('ttgrids', S.grid); } }, 350);
      const savePlan = Kit.debounce(async () => { if (S.plan) { delete S.plan.sample; await Kit.store.put('ttplans', S.plan); } }, 400);

      function render() {
        Kit.clear(tabsBox); Kit.clear(sampleSlot); Kit.clear(main);
        tabsBox.append(h('div', { class: 'tabs', role: 'tablist' },
          [['mine', 'わたしの時間割'], ['school', '学校の時間割をつくる（自動）']].map(([id, label]) => h('button', { type: 'button', role: 'tab', 'aria-selected': String(S.tab === id), onclick: () => { S.tab = id; Kit.pref.set('tt:tab', id); S.sel = null; render(); } }, label))));
        if (S.tab === 'mine') renderMine(); else renderSchool();
      }

      /* ═════════ わたしの時間割 ═════════ */
      function renderMine() {
        if (S.grid && S.grid.sample) sampleSlot.append(Kit.sampleBar('数学の先生の時間割の例です。マスを押して書きかえられます。'));
        if (!S.grid) {
          main.append(Kit.empty({ title: 'まだ時間割がありません', body: '自分の授業の時間割や、クラスの時間割をつくれます。', actions: [Kit.btn('時間割をつくる', () => newGrid(), { kind: 'primary', icon: 'plus' })] }));
          return;
        }
        const g = S.grid;
        const sel = h('select', { id: 'tt-gsel', 'aria-label': '時間割を選ぶ' }, S.grids.map((x) => h('option', { value: x.id }, x.name)));
        sel.value = g.id;
        sel.addEventListener('change', async () => { await saveGrid.flush(); Kit.pref.set('tt:grid', sel.value); S.grid = Kit.clone(S.grids.find((x) => x.id === sel.value)); S.paint = null; S.sel = null; render(); });
        const homeId = Kit.pref.get('tt:home', null);
        const onHome = homeId ? homeId === g.id : S.grids[0] && S.grids[0].id === g.id;
        main.append(h('div', { class: 'tt-top' },
          sel,
          Kit.btn('新しい時間割', () => newGrid(), { sm: true, icon: 'plus' }),
          Kit.btn('名前・時限・日課表', () => gridSettings(), { sm: true, kind: 'ghost', icon: 'sliders' }),
          Kit.btn('', () => removeGrid(), { sm: true, kind: 'ghost', icon: 'trash', title: 'この時間割を消す' }),
          h('span', { class: 'grow' }),
          onHome ? h('span', { class: 'chip ok' }, Kit.icon('home', 14), 'ホームに表示中') : Kit.btn('ホームに出す', () => { Kit.pref.set('tt:home', g.id); render(); Kit.toast('ホームに今日の時間割を出します'); }, { sm: true, icon: 'home' }),
          Kit.btn('共有', async () => { const p = await Kit.profile.get(); School.share.open(School.share.pack('timetable', [{ name: g.name, days: g.days, perDay: g.perDay, cells: g.cells, bell: g.bell }], { title: g.name, from: p._sample ? '' : p.teacher }), { what: '時間割「' + g.name + '」', note: '受け取った人の「わたしの時間割」に追加されます。' }); }, { sm: true, icon: 'share' }),
          Kit.btn('印刷', () => printGrids([g], g.name), { sm: true, icon: 'printer' })));
        // パレット（よく使う教科）
        const used = [...new Set(Object.values(g.cells).map((c) => c && c.s).filter(Boolean))];
        const lv = S.level || 'jhs';
        const base = (lv === 'es' ? ES_SUBJECTS : lv === 'hs' ? HS_SUBJECTS : JHS_SUBJECTS.map((x) => x[0]));
        const pal = [...new Set(used.concat(base))].slice(0, 22);
        main.append(h('div', { class: 'tt-palette', role: 'group', 'aria-label': '教科で塗る' },
          h('span', { class: 'small ink-2' }, '塗る：'),
          pal.map((s) => h('button', { type: 'button', class: 'chip', style: '--c:' + colorOf(s), 'aria-pressed': String(S.paint === s), onclick: () => { S.paint = S.paint === s ? null : s; render(); } }, h('span', { class: 'dot' }), s)),
          h('button', { type: 'button', class: 'chip', 'aria-pressed': String(S.paint === ''), onclick: () => { S.paint = S.paint === '' ? null : ''; render(); } }, '消しゴム'),
          h('span', { class: 'small muted' }, S.paint == null ? '教科を選んでマスを押すと、どんどん塗れます。マスだけ押すと、くわしく入力できます。' : '塗る教科：' + (S.paint || '消す') + '（もう一度押すと終わり）')));
        main.append(h('div', { class: 'tt-grid-wrap' }, gridEl(g, { interactive: true })));
        main.append(h('p', { class: 'small muted', style: { marginTop: '8px' } }, '「学校の時間割をつくる」でできた時間割から、クラス別・先生別に写すこともできます。'));
      }
      function gridEl(g, o = {}) {
        const P = Math.max(...g.perDay);
        const todayW = (new Date().getDay() + 6) % 7;
        const grid = h('div', { class: 'tt-grid', style: '--days:' + g.days, role: 'group', 'aria-label': g.name });
        grid.append(h('div', { class: 'tt-h' }, ''));
        range(g.days).forEach((d) => grid.append(h('div', { class: 'tt-h' + (d === todayW ? ' is-today' : '') }, WD[d])));
        for (let p = 0; p < P; p++) {
          const b = g.bell[p] || {};
          grid.append(h('div', { class: 'tt-ph' }, (p + 1), b.start ? h('small', null, b.start + (b.end ? '〜' + b.end : '')) : null));
          for (let d = 0; d < g.days; d++) {
            const k = K(d, p), cell = g.cells[k];
            if (p >= g.perDay[d]) { grid.append(h('div', { class: 'tt-c none', 'aria-hidden': 'true' })); continue; }
            const tag = o.interactive ? 'button' : 'div';
            grid.append(h(tag, { type: o.interactive ? 'button' : null, class: 'tt-c' + (cell && cell.s ? ' has' : ''), style: cell && cell.s ? '--c:' + colorOf(cell.s) : null, 'data-k': k, 'aria-label': WD[d] + '曜' + (p + 1) + '時間目' + (cell && cell.s ? '：' + cell.s : '（空き）') },
              cell && cell.s ? h('span', { class: 's' }, cell.s) : h('span', { class: 'n' }, ''), cell && cell.n ? h('span', { class: 'n' }, cell.n) : null));
          }
        }
        if (o.interactive) grid.addEventListener('click', (e) => { const b = e.target.closest('button[data-k]'); if (b) onGridCell(b.dataset.k); });
        return grid;
      }
      function onGridCell(k) {
        const g = S.grid;
        if (S.paint != null) {
          if (S.paint === '') delete g.cells[k]; else g.cells[k] = Object.assign({}, g.cells[k] || {}, { s: S.paint });
          saveGrid(); render(); return;
        }
        const cell = g.cells[k] || {};
        const s = h('input', { type: 'text', id: 'tt-c-s', maxlength: 20, placeholder: '例：数学', value: cell.s || '' });
        const n = h('input', { type: 'text', id: 'tt-c-n', maxlength: 30, placeholder: '例：2年3組・理科室・田中先生', value: cell.n || '' });
        const [d, p] = k.split('-').map(Number);
        const pal = [...new Set(Object.values(g.cells).map((c) => c && c.s).filter(Boolean))];
        Kit.modal({
          title: WD[d] + '曜 ' + (p + 1) + '時間目', autofocus: 'input',
          body: h('div', { class: 'stack' }, Kit.field({ label: '教科', input: s }),
            pal.length ? h('div', { class: 'btn-row' }, pal.map((x) => h('button', { type: 'button', class: 'chip', onclick: () => { s.value = x; } }, x))) : null,
            Kit.field({ label: 'そえる言葉（クラス・教室・先生など）', input: n })),
          actions: [{ label: '空きにする', kind: 'ghost', onClick: () => { delete g.cells[k]; saveGrid(); render(); } }, { label: 'やめる', kind: 'ghost' }, {
            label: '決める', kind: 'primary', onClick: () => {
              if (!s.value.trim() && !n.value.trim()) delete g.cells[k]; else g.cells[k] = { s: s.value.trim(), n: n.value.trim() };
              saveGrid(); render();
            },
          }],
        });
      }
      async function newGrid(from) {
        const name = await Kit.ask({ title: '新しい時間割', label: '名前', value: from ? from.name : 'わたしの時間割', ok: 'つくる' });
        if (name == null) return;
        const g = normGrid(Object.assign({}, from || { days: 5, perDay: [6, 6, 6, 6, 6], cells: {}, bell: DEFAULT_BELL.slice(0, 6).map((x) => ({ start: x[0], end: x[1] })) }, { name: name.trim() || '時間割' }));
        const saved = await Kit.store.put('ttgrids', g);
        Kit.pref.set('tt:grid', saved.id);
        S.grid = null; S.tab = 'mine'; Kit.pref.set('tt:tab', 'mine');
        await load(); render();
        Kit.toast('「' + saved.name + '」をつくりました');
      }
      async function removeGrid() {
        const ok = await Kit.confirm({ title: '「' + S.grid.name + '」を消しますか？', body: 'この時間割を消します。', ok: '消す', danger: true });
        if (!ok) return;
        saveGrid.cancel();
        await Kit.store.remove('ttgrids', S.grid.id);
        S.grid = null; await load(); render();
      }
      function gridSettings() {
        const g = S.grid;
        const name = h('input', { type: 'text', id: 'tt-g-name', value: g.name, maxlength: 40 });
        let days = g.days;
        const perIn = range(6).map((d) => { const i = h('input', { type: 'number', min: 1, max: 8, step: 1, value: g.perDay[d] || 6, 'aria-label': WD[d] + '曜の時限の数', style: { width: '4.5em' } }); return i; });
        const P = 8;
        const bellIn = range(P).map((p) => [h('input', { type: 'time', value: (g.bell[p] || {}).start || '', 'aria-label': (p + 1) + '時間目のはじまり' }), h('input', { type: 'time', value: (g.bell[p] || {}).end || '', 'aria-label': (p + 1) + '時間目の終わり' })]);
        const perRow = h('div', { class: 'row' }, range(6).map((d) => h('label', { class: 'small', style: { display: 'grid', gap: '2px', justifyItems: 'center' } }, WD[d], perIn[d])));
        const body = h('div', { class: 'stack' },
          Kit.field({ label: '名前', input: name }),
          Kit.field({ label: '曜日', input: Kit.seg([{ value: 5, label: '月〜金' }, { value: 6, label: '月〜土' }], days, (v) => { days = +v; }, { label: '曜日' }) }),
          Kit.field({ label: '曜日ごとの時限の数', input: perRow }),
          h('details', { class: 'help' }, h('summary', null, '日課表（時刻）'), h('div', { style: { display: 'grid', gridTemplateColumns: 'auto 1fr auto 1fr', gap: '6px', alignItems: 'center', marginTop: '10px' } },
            range(P).map((p) => [h('span', { class: 'small' }, (p + 1) + '限'), bellIn[p][0], h('span', null, '〜'), bellIn[p][1]]))));
        Kit.modal({
          title: '時間割の設定', wide: true, body,
          actions: [{ label: 'やめる', kind: 'ghost' }, {
            label: '保存する', kind: 'primary', onClick: () => {
              g.name = name.value.trim() || '時間割'; g.days = days;
              g.perDay = range(days).map((d) => Kit.clamp(parseInt(perIn[d].value, 10) || 6, 1, 8));
              g.bell = range(P).map((p) => ({ start: bellIn[p][0].value, end: bellIn[p][1].value }));
              const n = normGrid(g); Object.assign(g, n);
              saveGrid(); saveGrid.flush(); load().then(render);
            },
          }],
        });
      }
      function printGrids(list, title) {
        School.print({ landscape: true, build: () => h('div', { class: 'tt-print' }, list.map((g) => {
          const P = Math.max(...g.perDay);
          const rh = P > 6 ? '17mm' : '22mm';
          return h('div', { class: 'pg', style: '--rh:' + rh }, h('h1', null, g.name || title),
            h('table', null, h('thead', null, h('tr', null, h('th', { style: { width: '18mm' } }, ''), range(g.days).map((d) => h('th', null, WD[d])))),
              h('tbody', null, range(P).map((p) => h('tr', null, h('th', null, (p + 1), g.bell && g.bell[p] && g.bell[p].start ? h('small', null, g.bell[p].start + '〜' + (g.bell[p].end || '')) : null),
                range(g.days).map((d) => { if (p >= g.perDay[d]) return h('td', { class: 'none' }); const c = g.cells[K(d, p)]; return h('td', null, c && c.s ? h('span', { class: 's' }, c.s) : '', c && c.n ? h('span', { class: 'n' }, c.n) : null); }))))));
        })) });
      }

      /* ═════════ 学校の時間割をつくる ═════════ */
      const PSTEPS = [{ id: 'base', label: '曜日とクラス' }, { id: 'subjects', label: '教科と時間数' }, { id: 'assign', label: '担当' }, { id: 'rules', label: '先生の都合・固定のコマ' }, { id: 'make', label: 'つくる' }];
      function renderSchool() {
        if (S.plan && S.plan.sample) sampleSlot.append(Kit.sampleBar('架空の中学校（6クラス・先生15人）の例です。「つくる」で組み直したり、担当を変えたりして試せます。'));
        if (!S.plan) {
          main.append(Kit.empty({ title: '学校の時間割は、まだありません', body: '曜日とクラス・教科と時間数・担当（だれがどのクラスのどの教科か）を入れると、先生が重ならないように自動で組みます。', actions: [Kit.btn('はじめる', () => newPlan(), { kind: 'primary', icon: 'plus' })] }));
          return;
        }
        const sel = h('select', { id: 'tt-psel', 'aria-label': '時間割（学校）を選ぶ' }, S.plans.map((x) => h('option', { value: x.id }, x.name)));
        sel.value = S.plan.id;
        sel.addEventListener('change', async () => { await savePlan.flush(); Kit.pref.set('tt:plan', sel.value); S.plan = Kit.clone(S.plans.find((x) => x.id === sel.value)); render(); });
        main.append(h('div', { class: 'tt-top' }, sel,
          Kit.btn('新しくつくる', () => newPlan(), { sm: true, icon: 'plus' }),
          Kit.btn('名前を変える', async () => { const t = await Kit.ask({ title: '名前', label: '名前', value: S.plan.name }); if (t && t.trim()) { S.plan.name = t.trim(); savePlan(); await savePlan.flush(); await load(); render(); } }, { sm: true, kind: 'ghost', icon: 'edit' }),
          Kit.btn('', () => removePlan(), { sm: true, kind: 'ghost', icon: 'trash', title: 'この時間割（学校）を消す' })));
        main.append(h('nav', { class: 'sk-steps tt-steps', 'aria-label': '手順' }, PSTEPS.map((s, i) => h('button', { type: 'button', class: 'sk-step', 'aria-current': S.pstep === s.id ? 'step' : null, onclick: () => { S.pstep = s.id; Kit.pref.set('tt:pstep', s.id); render(); } }, h('b', null, i + 1), s.label))));
        const box = { base: stepBase, subjects: stepSubjects, assign: stepAssign, rules: stepRules, make: stepMake }[S.pstep] || stepBase;
        main.append(box());
      }
      const touch = () => { if (S.plan.result) S.plan.result.stale = true; savePlan(); };
      const nextBtn = (id, label) => h('div', { class: 'btn-row', style: { marginTop: '14px' } }, Kit.btn('次へ：' + label, () => { S.pstep = id; Kit.pref.set('tt:pstep', id); render(); }, { kind: 'primary', icon: 'right' }));
      async function newPlan() {
        const p0 = await Kit.profile.get();
        const name = await Kit.ask({ title: '学校の時間割をつくる', label: '名前', value: p0.year + '年度 時間割', ok: 'つくる' });
        if (name == null) return;
        const lv = p0.level;
        const plan = normPlan({ name: name.trim() || '時間割', days: 5, perDay: lv === 'es' ? [6, 6, 5, 6, 5] : [6, 6, 5, 6, 6], classes: [], subjects: subjectsFor(lv), teachers: [], assign: {}, fixed: [] });
        const saved = await Kit.store.put('ttplans', plan);
        Kit.pref.set('tt:plan', saved.id);
        S.plan = null; S.pstep = 'base'; Kit.pref.set('tt:pstep', 'base');
        await load(); render();
      }
      async function removePlan() {
        const ok = await Kit.confirm({ title: '「' + S.plan.name + '」を消しますか？', body: 'クラス・教科・担当・できた時間割をすべて消します。', ok: '消す', danger: true });
        if (!ok) return;
        savePlan.cancel();
        await Kit.store.remove('ttplans', S.plan.id);
        S.plan = null; await load(); render();
      }

      // ① 曜日とクラス
      function stepBase() {
        const pl = S.plan;
        const card = h('section', { class: 'card stack' });
        const perIn = range(pl.days).map((d) => { const i = h('input', { type: 'number', min: 1, max: 8, value: pl.perDay[d], 'aria-label': WD[d] + '曜の時限の数', style: { width: '4.5em' } }); i.addEventListener('change', () => { pl.perDay[d] = Kit.clamp(parseInt(i.value, 10) || 6, 1, 8); touch(); render(); }); return i; });
        const lunch = h('select', { id: 'tt-lunch', style: { width: 'auto' } }, range(9).map((n) => h('option', { value: n }, n === 0 ? '区切らない' : n + '時間目のあと')));
        lunch.value = String(pl.lunchAfter);
        lunch.addEventListener('change', () => { pl.lunchAfter = +lunch.value; touch(); });
        const slots = pl.perDay.reduce((a, b) => a + b, 0);
        card.append(h('h2', { class: 'small', style: { fontSize: '16px', fontWeight: 700 } }, '曜日と時限'),
          Kit.seg([{ value: 5, label: '月〜金' }, { value: 6, label: '月〜土' }], pl.days, (v) => { pl.days = +v; Object.assign(pl, normPlan(pl)); touch(); render(); }, { label: '曜日' }),
          h('div', { class: 'row' }, range(pl.days).map((d) => h('label', { class: 'small', style: { display: 'grid', gap: '2px', justifyItems: 'center' } }, WD[d] + '曜', perIn[d])), h('span', { class: 'tt-sum' }, '1週間で ', h('b', null, slots), ' コマ')),
          h('div', { class: 'row' }, h('label', { for: 'tt-lunch', class: 'small ink-2' }, '昼休み'), lunch, h('span', { class: 'small muted' }, '2時間続きの授業は、昼休みをまたぎません。')));
        // クラス
        const list = h('div', { class: 'stack tight' });
        pl.classes.forEach((c, i) => {
          const nm = h('input', { type: 'text', value: c.name, maxlength: 16, 'aria-label': 'クラスの名前', style: { width: '8em' } });
          nm.addEventListener('change', () => { c.name = nm.value.trim() || c.name; touch(); });
          const gr = h('input', { type: 'number', min: 1, max: 6, value: c.grade, 'aria-label': c.name + 'の学年', style: { width: '4em' } });
          gr.addEventListener('change', () => { c.grade = Kit.clamp(parseInt(gr.value, 10) || 1, 1, 6); touch(); });
          list.append(h('div', { class: 'row' }, nm, h('span', { class: 'small ink-2' }, '学年'), gr, Kit.btn('', () => { pl.classes.splice(i, 1); delete pl.assign[c.id]; touch(); render(); }, { sm: true, kind: 'ghost', icon: 'trash', title: c.name + 'を消す' })));
        });
        const gIn = [1, 2, 3, 4, 5, 6].map((g) => h('input', { type: 'number', min: 0, max: 12, value: pl.classes.filter((c) => c.grade === g).length || '', placeholder: '0', 'aria-label': g + '年のクラス数', style: { width: '4.5em' } }));
        const nGrades = S.level === 'es' ? 6 : 3;
        card.append(h('hr', { class: 'divider' }), h('h2', { class: 'small', style: { fontSize: '16px', fontWeight: 700 } }, 'クラス（' + pl.classes.length + '）'),
          h('div', { class: 'row' }, range(nGrades).map((i) => h('label', { class: 'small', style: { display: 'grid', gap: '2px', justifyItems: 'center' } }, (i + 1) + '年', gIn[i])),
            Kit.btn('この数でクラスをつくる', async () => {
              if (pl.classes.length && !(await Kit.confirm({ title: 'クラスをつくり直しますか？', body: 'いまのクラスと担当を消して、「1-1, 1-2 …」の形でつくり直します。', ok: 'つくり直す' }))) return;
              pl.classes = []; pl.assign = {};
              range(nGrades).forEach((i) => { const n = Kit.clamp(parseInt(gIn[i].value, 10) || 0, 0, 12); for (let k = 1; k <= n; k++) pl.classes.push({ id: Kit.uid('c'), name: (i + 1) + '-' + k, grade: i + 1 }); });
              touch(); render();
            }, { sm: true, icon: 'refresh' })),
          list,
          h('div', null, Kit.btn('1つ足す', () => { pl.classes.push({ id: Kit.uid('c'), name: '新しいクラス', grade: 1 }); touch(); render(); }, { sm: true, icon: 'plus', kind: 'ghost' })));
        return h('div', null, card, nextBtn('subjects', '教科と時間数'));
      }

      // ② 教科と時間数
      function stepSubjects() {
        const pl = S.plan;
        const grades = [...new Set(pl.classes.map((c) => c.grade))].sort((a, b) => a - b);
        const gs = grades.length ? grades : [1, 2, 3];
        const tb = h('tbody');
        pl.subjects.forEach((s, i) => {
          const nm = h('input', { type: 'text', value: s.name, maxlength: 16, 'aria-label': '教科の名前' });
          nm.addEventListener('change', () => { s.name = nm.value.trim() || s.name; touch(); });
          const sh = h('input', { type: 'text', value: s.short || '', maxlength: 4, 'aria-label': s.name + 'の略', style: { minWidth: '3.5em', width: '3.5em' } });
          sh.addEventListener('change', () => { s.short = sh.value.trim(); touch(); });
          const hrs = gs.map((g) => { const x = h('input', { type: 'number', min: 0, max: 12, step: 1, value: s.hours[g] != null ? s.hours[g] : '', 'aria-label': s.name + ' ' + g + '年の時間数' }); x.addEventListener('change', () => { if (x.value === '') delete s.hours[g]; else s.hours[g] = Kit.clamp(parseInt(x.value, 10) || 0, 0, 12); touch(); renderSums(); }); return h('td', { class: 'c' }, x); });
          const bl = h('input', { type: 'checkbox', checked: !!s.block, 'aria-label': s.name + 'は2時間続き', onchange: () => { s.block = bl.checked; touch(); } });
          tb.append(h('tr', null, h('th', null, nm), h('td', null, sh), hrs, h('td', { class: 'c' }, bl), h('td', null, Kit.btn('', () => { pl.subjects.splice(i, 1); for (const c of Object.keys(pl.assign)) delete pl.assign[c][s.id]; pl.fixed = pl.fixed.filter((f) => f.subjectId !== s.id); touch(); render(); }, { sm: true, kind: 'ghost', icon: 'trash', title: s.name + 'を消す' }))));
        });
        const sumsRow = h('tr');
        const renderSums = () => {
          Kit.clear(sumsRow);
          const slots = pl.perDay.reduce((a, b) => a + b, 0);
          Kit.add(sumsRow, [h('th', null, '合計'), h('td'), gs.map((g) => { const n = pl.subjects.reduce((a, s) => a + (+s.hours[g] || 0), 0); return h('td', { class: 'c' }, h('b', { class: n > slots ? 'bad' : '' }, n), h('span', { class: 'small muted' }, '/' + slots)); }), h('td'), h('td')]);
        };
        renderSums();
        const table = h('div', { class: 'tt-mx-wrap' }, h('table', { class: 'tt-mx' },
          h('thead', null, h('tr', null, h('th', null, '教科'), h('th', null, '略'), gs.map((g) => h('th', null, g + '年')), h('th', null, '2時間続き'), h('th', null, ''))),
          tb, h('tfoot', { class: 'tt-sum' }, sumsRow)));
        return h('div', null, h('section', { class: 'card stack' },
          h('p', { class: 'small ink-2' }, '学年ごとの「週の時間数」を入れます。合計がコマの数をこえないようにします（ちょうど同じなら、空きのない時間割になります）。' + (S.level === 'jhs' || !S.level ? '中学校は、学習指導要領の標準時数を週あたりにした数を入れてあります。' : '')),
          table,
          h('div', { class: 'btn-row' },
            Kit.btn('教科を足す', async () => { const n = await Kit.ask({ title: '教科を足す', label: '教科の名前', placeholder: '例：選択数学', ok: '足す' }); if (n && n.trim()) { pl.subjects.push({ id: Kit.uid('sub'), name: n.trim(), short: n.trim().slice(0, 1), hours: {}, block: false }); touch(); render(); } }, { sm: true, icon: 'plus' }),
            Kit.btn('中学校の標準に戻す', async () => { if (!(await Kit.confirm({ title: '中学校の標準に戻しますか？', body: '教科と時間数を、中学校の標準に置きかえます。担当と固定のコマも消えます。', ok: '戻す' }))) return; pl.subjects = jhsSubjects(); pl.assign = {}; pl.fixed = []; touch(); render(); }, { sm: true, kind: 'ghost', icon: 'refresh' }))),
        nextBtn('assign', '担当'));
      }

      // ③ 担当（クラス × 教科 → 先生）
      function teacherByName(name) {
        const pl = S.plan;
        const n = String(name || '').trim();
        if (!n) return null;
        let t = pl.teachers.find((x) => x.name === n);
        if (!t) { t = { id: Kit.uid('t'), name: n, off: [] }; pl.teachers.push(t); }
        return t.id;
      }
      const tName = (id) => { const t = S.plan.teachers.find((x) => x.id === id); return t ? t.name : ''; };
      function stepAssign() {
        const pl = S.plan;
        const dl = h('datalist', { id: 'tt-teachers' }, pl.teachers.map((t) => h('option', { value: t.name })));
        const tb = h('tbody');
        for (const c of pl.classes) {
          const tr = h('tr', null, h('th', null, c.name));
          for (const s of pl.subjects) {
            const hrs = TS.hoursOf(pl, c, s);
            const ids = (pl.assign[c.id] && pl.assign[c.id][s.id]) || [];
            const inp = h('input', { type: 'text', list: 'tt-teachers', value: ids.map(tName).join('・'), placeholder: hrs ? '' : '—', disabled: !hrs, 'aria-label': c.name + ' ' + s.name + 'の先生' });
            inp.addEventListener('change', () => {
              const names = inp.value.split(/[・,、，\/]/).map((x) => x.trim()).filter(Boolean);
              (pl.assign[c.id] = pl.assign[c.id] || {})[s.id] = names.map(teacherByName);
              cleanTeachers(); touch(); renderLoads();
              if (!dl.querySelector('option[value="' + CSS.escape(inp.value) + '"]')) { Kit.clear(dl); pl.teachers.forEach((t) => dl.append(h('option', { value: t.name }))); }
            });
            tr.append(h('td', null, inp));
          }
          tb.append(tr);
        }
        const loads = h('div', { class: 'tt-sum' });
        const renderLoads = () => {
          Kit.clear(loads);
          const slots = pl.perDay.reduce((a, b) => a + b, 0);
          const m = new Map();
          for (const c of pl.classes) for (const s of pl.subjects) for (const t of (pl.assign[c.id] && pl.assign[c.id][s.id]) || []) m.set(t, (m.get(t) || 0) + TS.hoursOf(pl, c, s));
          const list = pl.teachers.filter((t) => m.get(t.id)).sort((a, b) => m.get(b.id) - m.get(a.id));
          Kit.add(loads, [h('b', null, '持ち時間：'), list.length ? list.map((t, i) => h('span', null, (i ? '、' : '') + t.name + ' ', h('span', { class: m.get(t.id) > slots - (t.off || []).length ? 'bad' : '' }, m.get(t.id)))) : 'まだ担当がありません']);
        };
        renderLoads();
        const fillSel = h('select', { id: 'tt-fill-s', style: { width: 'auto' } }, pl.subjects.map((s) => h('option', { value: s.id }, s.name)));
        const fillG = h('select', { id: 'tt-fill-g', style: { width: 'auto' } }, h('option', { value: '' }, '全学年'), [...new Set(pl.classes.map((c) => c.grade))].sort().map((g) => h('option', { value: g }, g + '年')));
        const fillT = h('input', { type: 'text', id: 'tt-fill-t', list: 'tt-teachers', placeholder: '先生の名前', style: { width: '9em' } });
        return h('div', null, h('section', { class: 'card stack' },
          h('p', { class: 'small ink-2' }, 'クラスと教科の交わるところに、教える先生の名前を入れます（2人で教えるときは「田中・佐藤」）。同じ名前は同じ先生として、重ならないように組みます。担任が受け持つ道徳・学活なども入れてください。'),
          h('div', { class: 'row small' }, h('span', { class: 'ink-2' }, 'まとめて入れる：'), fillSel, fillG, fillT, Kit.btn('入れる', () => {
            const id = teacherByName(fillT.value);
            if (!id) { Kit.toast('先生の名前を入れてください', { type: 'bad' }); return; }
            for (const c of pl.classes) { if (fillG.value && c.grade !== +fillG.value) continue; if (!TS.hoursOf(pl, c, pl.subjects.find((s) => s.id === fillSel.value))) continue; (pl.assign[c.id] = pl.assign[c.id] || {})[fillSel.value] = [id]; }
            cleanTeachers(); touch(); render();
          }, { sm: true, icon: 'check' })),
          dl,
          pl.classes.length ? h('div', { class: 'tt-mx-wrap' }, h('table', { class: 'tt-mx' }, h('thead', null, h('tr', null, h('th', null, ''), pl.subjects.map((s) => h('th', null, s.name)))), tb)) : h('p', { class: 'small muted' }, '先に ①「曜日とクラス」でクラスをつくってください。'),
          loads,
          h('p', { class: 'small muted' }, 'まだできないこと：2クラス合同の授業（男女別の体育など）は入れられません。合同にしたい授業は、組み上がったあとで手で入れかえてください。')),
        nextBtn('rules', '先生の都合・固定のコマ'));
      }
      function cleanTeachers() {
        const pl = S.plan;
        const used = new Set();
        for (const c of Object.values(pl.assign)) for (const ids of Object.values(c || {})) for (const id of ids || []) used.add(id);
        pl.teachers = pl.teachers.filter((t) => used.has(t.id) || (t.off && t.off.length));
      }

      // ④ 先生の都合・固定のコマ
      function stepRules() {
        const pl = S.plan;
        const P = Math.max(...pl.perDay);
        const ts = pl.teachers.slice().sort((a, b) => a.name.localeCompare(b.name, 'ja'));
        if (!S.offT || !ts.some((t) => t.id === S.offT)) S.offT = ts[0] ? ts[0].id : null;
        const t = ts.find((x) => x.id === S.offT);
        const offCard = h('section', { class: 'card stack' }, h('h2', { class: 'small', style: { fontSize: '16px', fontWeight: 700 } }, '先生の都合（授業に入れないコマ）'));
        if (!ts.length) offCard.append(h('p', { class: 'small muted' }, '③「担当」で先生を入れると、ここで都合を入れられます。'));
        else {
          const grid = h('div', { class: 'tt-mini', style: '--days:' + pl.days }, h('span'), range(pl.days).map((d) => h('span', { class: 'h' }, WD[d])));
          for (let p = 0; p < P; p++) {
            grid.append(h('span', { class: 'h' }, (p + 1)));
            for (let d = 0; d < pl.days; d++) {
              const k = K(d, p), on = (t.off || []).includes(k);
              grid.append(h('button', { type: 'button', class: (p >= pl.perDay[d] ? 'none' : '') + (on ? ' on' : ''), 'aria-pressed': String(on), 'aria-label': WD[d] + '曜' + (p + 1) + '時間目' + (on ? '（入れない）' : ''), onclick: () => { t.off = on ? t.off.filter((x) => x !== k) : (t.off || []).concat(k); touch(); render(); } }, on ? '×' : ''));
            }
          }
          offCard.append(h('div', { class: 'tt-off' },
            h('div', { class: 'tt-tlist' }, ts.map((x) => h('button', { type: 'button', 'aria-pressed': String(x.id === S.offT), onclick: () => { S.offT = x.id; render(); } }, h('span', null, x.name), (x.off || []).length ? h('span', { class: 'chip bad' }, '×' + x.off.length) : null))),
            h('div', { class: 'stack tight' }, h('p', { class: 'small ink-2' }, h('b', null, t.name + ' 先生'), '：授業に入れないコマを押して × にします（非常勤の先生の来ない日・出張が決まっている日など）。'), grid,
              h('div', { class: 'btn-row' }, range(pl.days).map((d) => Kit.btn(WD[d] + 'はいない', () => { const ks = range(pl.perDay[d]).map((p) => K(d, p)); const all = ks.every((k) => (t.off || []).includes(k)); t.off = all ? t.off.filter((k) => !ks.includes(k)) : [...new Set((t.off || []).concat(ks))]; touch(); render(); }, { sm: true, kind: 'ghost' }))))));
        }
        // 固定のコマ
        const subj = (id) => pl.subjects.find((s) => s.id === id);
        if (!S.fxSubject || !subj(S.fxSubject)) S.fxSubject = (pl.subjects.find((s) => s.name === '学活') || pl.subjects[0] || {}).id;
        const grades = [...new Set(pl.classes.map((c) => c.grade))].sort((a, b) => a - b);
        const fxGrid = h('div', { class: 'tt-mini', style: '--days:' + pl.days }, h('span'), range(pl.days).map((d) => h('span', { class: 'h' }, WD[d])));
        for (let p = 0; p < P; p++) {
          fxGrid.append(h('span', { class: 'h' }, (p + 1)));
          for (let d = 0; d < pl.days; d++) {
            const here = pl.fixed.filter((f) => f.d === d && f.p === p);
            const lab = here.map((f) => { const s = subj(f.subjectId); return (s ? s.short || s.name : '') + (f.grades && f.grades.length ? f.grades.join('') : ''); }).join('/');
            grid2(d, p, here, lab);
          }
        }
        function grid2(d, p, here, lab) {
          const s0 = here[0] && subj(here[0].subjectId);
          fxGrid.append(h('button', { type: 'button', class: (p >= pl.perDay[d] ? 'none' : '') + (here.length ? ' fx' : ''), style: s0 ? '--c:' + colorOf(s0.name) : null, 'aria-label': WD[d] + '曜' + (p + 1) + '時間目' + (lab ? '：' + lab : ''),
            onclick: () => {
              const want = S.fxGrades.length ? S.fxGrades.slice() : null;
              const same = here.find((f) => f.subjectId === S.fxSubject && JSON.stringify(f.grades || null) === JSON.stringify(want));
              if (same) pl.fixed = pl.fixed.filter((f) => f !== same);
              else { pl.fixed = pl.fixed.filter((f) => !(f.d === d && f.p === p && overlap(f.grades, want))); pl.fixed.push({ d, p, subjectId: S.fxSubject, grades: want }); }
              touch(); render();
            } }, lab));
        }
        function overlap(a, b) { if (!a || !a.length || !b || !b.length) return true; return a.some((x) => b.includes(x)); }
        const fxSel = h('select', { id: 'tt-fx-s', style: { width: 'auto' } }, pl.subjects.map((s) => h('option', { value: s.id }, s.name)));
        fxSel.value = S.fxSubject || '';
        fxSel.addEventListener('change', () => { S.fxSubject = fxSel.value; });
        const fxCard = h('section', { class: 'card stack' }, h('h2', { class: 'small', style: { fontSize: '16px', fontWeight: 700 } }, '固定のコマ（学活・道徳・総合など、曜日と時間が決まっているもの）'),
          h('div', { class: 'row small' }, h('span', { class: 'ink-2' }, '入れる教科'), fxSel, h('span', { class: 'ink-2' }, '学年'),
            h('span', { class: 'row' }, grades.map((g) => { const cb = h('input', { type: 'checkbox', id: 'tt-fx-g' + g, checked: S.fxGrades.includes(g), onchange: () => { S.fxGrades = cb.checked ? S.fxGrades.concat(g) : S.fxGrades.filter((x) => x !== g); } }); return h('label', { class: 'check', for: 'tt-fx-g' + g }, cb, g + '年'); }), h('span', { class: 'muted' }, '（チェックなし＝全学年）'))),
          h('p', { class: 'small ink-2' }, 'マスを押すと、その教科を固定します。もう一度押すと外れます。'), fxGrid,
          pl.fixed.length ? h('p', { class: 'small muted' }, '固定：' + pl.fixed.map((f) => WD[f.d] + (f.p + 1) + ' ' + ((subj(f.subjectId) || {}).name || '') + (f.grades && f.grades.length ? '（' + f.grades.join('・') + '年）' : '（全学年）')).join('、')) : null);
        return h('div', { class: 'stack' }, offCard, fxCard, nextBtn('make', 'つくる'));
      }

      // ⑤ つくる・見る・直す
      function stepMake() {
        const pl = S.plan;
        const res = pl.result;
        const box = h('div', { class: 'stack' });
        const pre = pl.classes.length ? TS.precheck(pl) : ['クラスがありません。'];
        box.append(h('section', { class: 'card tt-res' },
          h('div', { class: 'row' }, Kit.btn(res ? '組み直す' : '時間割をつくる', () => make(), { kind: 'primary', icon: 'wand' }),
            res ? h('span', { class: 'small muted' }, Kit.fmtDateTime(res.at) + ' につくりました' + (res.stale ? '（そのあと条件が変わりました）' : '')) : null),
          pre.map((t) => h('div', { class: 'tt-msg bad' }, Kit.icon('warn'), h('span', null, t))),
          res ? resultMsgs(res) : h('p', { class: 'small ink-2' }, '押すと、先生が重ならず、先生の都合・固定のコマ・2時間続き・「同じ教科は1日1回まで」を守るように組みます。何度でも組み直せます。')));
        if (!res) return box;
        const chk = TS.check(pl, res.cells);
        const views = Kit.seg([{ value: 'class', label: 'クラス別' }, { value: 'teacher', label: '先生別' }, { value: 'all', label: '全体' }], S.view, (v) => { S.view = v; S.tsel = null; render(); }, { label: '見かた' });
        const top = h('div', { class: 'tt-top' }, views);
        let gridBox;
        if (S.view === 'all') gridBox = overview(chk);
        else {
          const list = S.view === 'class' ? pl.classes : pl.teachers.filter((t) => pl.classes.some((c) => Object.values(res.cells[c.id] || {}).some((x) => (x.teacherIds || []).includes(t.id))));
          if (!S.viewId || !list.some((x) => x.id === S.viewId)) S.viewId = list[0] ? list[0].id : null;
          const sel = h('select', { id: 'tt-vsel', style: { width: 'auto' }, 'aria-label': S.view === 'class' ? 'クラスを選ぶ' : '先生を選ぶ' }, list.map((x) => h('option', { value: x.id }, x.name)));
          sel.value = S.viewId || '';
          sel.addEventListener('change', () => { S.viewId = sel.value; S.tsel = null; render(); });
          top.append(sel);
          gridBox = S.viewId ? (S.view === 'class' ? classView(S.viewId, chk) : teacherView(S.viewId)) : h('p', { class: 'small muted' }, 'ありません。');
        }
        top.append(h('span', { class: 'grow' }),
          Kit.btn('わたしの時間割に写す', () => copyToMine(), { sm: true, icon: 'copy', disabled: S.view === 'all' }),
          Kit.btn('印刷', () => printPlan(), { sm: true, icon: 'printer' }),
          Kit.btn('CSV', () => exportCsv(), { sm: true, icon: 'download', kind: 'ghost' }));
        box.append(h('section', { class: 'card stack' }, top, gridBox,
          S.view === 'class' ? h('p', { class: 'small muted' }, 'マスを2つ押すと入れかわります（同じクラスの中）。先生が重なるところは赤、同じ教科が1日に2回のところは黄色の枠になります。') : null));
        return box;
      }
      function resultMsgs(res) {
        const pl = S.plan, out = [];
        if (!res.unplaced.length) out.push(h('div', { class: 'tt-msg ok' }, Kit.icon('check'), h('span', null, 'すべての授業を入れられました（' + pl.classes.length + 'クラス）。')));
        else {
          const name = (u) => { const c = pl.classes.find((x) => x.id === u.classId), s = pl.subjects.find((x) => x.id === u.subjectId); return (c ? c.name : '') + ' ' + (s ? s.name : '') + (u.len === 2 ? '（2時間続き）' : '') + (u.teacherIds.length ? '［' + u.teacherIds.map(tName).join('・') + '］' : ''); };
          out.push(h('div', { class: 'tt-msg warn' }, Kit.icon('warn'), h('span', null, res.unplaced.length + 'こ の授業が入りませんでした：' + res.unplaced.slice(0, 12).map(name).join('、') + (res.unplaced.length > 12 ? ' ほか' : '') + '。もう一度「組み直す」か、先生の都合・担当・固定のコマを見直してください。')));
        }
        for (const t of res.problems || []) out.push(h('div', { class: 'tt-msg bad' }, Kit.icon('warn'), h('span', null, t)));
        return out;
      }
      function make() {
        const pl = S.plan;
        if (!pl.classes.length) { Kit.toast('先にクラスをつくってください', { type: 'bad' }); return; }
        const r = TS.solve(pl, { seed: School.newSeed() });
        pl.result = { cells: r.cells, unplaced: r.unplaced, problems: r.problems, at: new Date().toISOString(), stale: false };
        savePlan(); render();
        Kit.toast(r.ok ? '時間割ができました（' + r.ms + 'ミリ秒）' : r.unplaced.length + 'この授業が入りませんでした', r.ok ? {} : { type: 'bad' });
      }
      const subjOf = (id) => S.plan.subjects.find((s) => s.id === id) || { name: '?', short: '?' };
      function classView(cid, chk) {
        const pl = S.plan, cells = pl.result.cells[cid] || {};
        const P = Math.max(...pl.perDay);
        const bad = new Set(chk.clash.concat(chk.off).filter((x) => x.classId === cid).map((x) => x.key));
        const twice = chk.twice.filter((x) => x.classId === cid);
        const grid = h('div', { class: 'tt-grid', style: '--days:' + pl.days });
        Kit.add(grid, [h('div', { class: 'tt-h' }, ''), range(pl.days).map((d) => h('div', { class: 'tt-h' }, WD[d]))]);
        for (let p = 0; p < P; p++) {
          grid.append(h('div', { class: 'tt-ph' + (pl.lunchAfter === p + 1 ? ' lunch-after' : '') }, p + 1));
          for (let d = 0; d < pl.days; d++) {
            const k = K(d, p), c = cells[k];
            if (p >= pl.perDay[d]) { grid.append(h('div', { class: 'tt-c none' })); continue; }
            const s = c ? subjOf(c.subjectId) : null;
            const tw = c && twice.some((x) => x.day === d && x.subjectId === c.subjectId);
            grid.append(h('button', { type: 'button', class: 'tt-c' + (c ? ' has' : '') + (c && c.fixed ? ' fixed' : '') + (S.tsel === k ? ' is-sel' : '') + (bad.has(k) ? ' bad' : tw ? ' warn' : '') + (pl.lunchAfter === p + 1 ? ' lunch-after' : ''), style: s ? '--c:' + colorOf(s.name) : null, 'data-k': k, 'aria-label': WD[d] + '曜' + (p + 1) + '時間目' + (s ? '：' + s.name : '（空き）') },
              s ? h('span', { class: 's' }, s.name + (c.part ? (c.part === 1 ? ' ①' : ' ②') : '')) : h('span', { class: 'n' }, '空き'),
              c && c.teacherIds.length ? h('span', { class: 'n' }, c.teacherIds.map(tName).join('・')) : null));
          }
        }
        grid.addEventListener('click', (e) => { const b = e.target.closest('button[data-k]'); if (b) swapCell(cid, b.dataset.k); });
        return h('div', { class: 'tt-grid-wrap' }, grid);
      }
      function swapCell(cid, k) {
        const cells = S.plan.result.cells[cid];
        if (!S.tsel) { S.tsel = k; render(); return; }
        if (S.tsel === k) { S.tsel = null; render(); return; }
        const a = S.tsel, b = k, ca = cells[a], cb = cells[b];
        const isDouble = (c) => c && c.part;
        const mate = (key, c) => { const [d, p] = key.split('-').map(Number); return K(d, c.part === 1 ? p + 1 : p - 1); };
        if (isDouble(ca) || isDouble(cb)) {
          if (!(isDouble(ca) && isDouble(cb))) { Kit.toast('2時間続きの授業は、2時間続きの授業とだけ入れかえられます', { type: 'bad' }); S.tsel = null; render(); return; }
          const a2 = mate(a, ca), b2 = mate(b, cb);
          const first = (x, y) => (x < y ? [x, y] : [y, x]);
          const [a1s, a2s] = first(a, a2).sort(); const [b1s, b2s] = first(b, b2).sort();
          const A1 = cells[a1s], A2 = cells[a2s], B1 = cells[b1s], B2 = cells[b2s];
          cells[a1s] = B1; cells[a2s] = B2; cells[b1s] = A1; cells[b2s] = A2;
        } else {
          if (cb) cells[a] = cb; else delete cells[a];
          if (ca) cells[b] = ca; else delete cells[b];
        }
        S.tsel = null;
        savePlan(); render();
      }
      function teacherView(tid) {
        const pl = S.plan;
        const P = Math.max(...pl.perDay);
        const t = pl.teachers.find((x) => x.id === tid);
        const at = {};
        for (const c of pl.classes) for (const [k, cell] of Object.entries(pl.result.cells[c.id] || {})) if ((cell.teacherIds || []).includes(tid)) (at[k] = at[k] || []).push({ c, cell });
        const grid = h('div', { class: 'tt-grid', style: '--days:' + pl.days });
        Kit.add(grid, [h('div', { class: 'tt-h' }, ''), range(pl.days).map((d) => h('div', { class: 'tt-h' }, WD[d]))]);
        let n = 0;
        for (let p = 0; p < P; p++) {
          grid.append(h('div', { class: 'tt-ph' }, p + 1));
          for (let d = 0; d < pl.days; d++) {
            const k = K(d, p), list = at[k] || [];
            if (p >= pl.perDay[d]) { grid.append(h('div', { class: 'tt-c none' })); continue; }
            const off = t && (t.off || []).includes(k);
            n += list.length;
            const s = list[0] ? subjOf(list[0].cell.subjectId) : null;
            grid.append(h('div', { class: 'tt-c' + (s ? ' has' : '') + (list.length > 1 ? ' bad' : ''), style: s ? '--c:' + colorOf(s.name) : null },
              s ? h('span', { class: 's' }, list.map((x) => x.c.name).join('・')) : h('span', { class: 'n' }, off ? '×（入れない）' : ''),
              s ? h('span', { class: 'n' }, s.name) : null));
          }
        }
        return h('div', null, h('p', { class: 'small ink-2', style: { marginBottom: '8px' } }, (t ? t.name : '') + ' 先生：週 ' + n + ' 時間'), h('div', { class: 'tt-grid-wrap' }, grid));
      }
      function overview(chk) {
        const pl = S.plan;
        const bad = new Set(chk.clash.map((x) => x.classId + '@' + x.key));
        const head1 = h('tr', null, h('th', { rowspan: 2 }, ''), range(pl.days).map((d) => h('th', { colspan: pl.perDay[d], class: 'dayend' }, WD[d])));
        const head2 = h('tr', null, range(pl.days).flatMap((d) => range(pl.perDay[d]).map((p) => h('th', { class: p === pl.perDay[d] - 1 ? 'dayend' : '' }, p + 1))));
        const tb = h('tbody', null, pl.classes.map((c) => h('tr', null, h('th', null, c.name), range(pl.days).flatMap((d) => range(pl.perDay[d]).map((p) => {
          const cell = (pl.result.cells[c.id] || {})[K(d, p)];
          const s = cell ? subjOf(cell.subjectId) : null;
          return h('td', { class: (s ? 'has' : '') + (p === pl.perDay[d] - 1 ? ' dayend' : '') + (bad.has(c.id + '@' + K(d, p)) ? ' bad' : ''), style: s ? '--c:' + colorOf(s.name) : null, title: s ? s.name + '（' + cell.teacherIds.map(tName).join('・') + '）' : '' }, s ? s.short || s.name : '');
        })))));
        return h('div', { class: 'tt-all-wrap' }, h('table', { class: 'tt-all' }, h('thead', null, head1, head2), tb));
      }
      async function copyToMine() {
        const pl = S.plan;
        let g;
        if (S.view === 'teacher') { const t = pl.teachers.find((x) => x.id === S.viewId); g = teacherGrid(pl, S.viewId, (t ? t.name + '先生' : '') + 'の時間割'); }
        else {
          const c = pl.classes.find((x) => x.id === S.viewId);
          const cells = {};
          for (const [k, cell] of Object.entries(pl.result.cells[c.id] || {})) cells[k] = { s: subjOf(cell.subjectId).name, n: cell.teacherIds.map(tName).join('・') };
          g = { name: c.name + 'の時間割', days: pl.days, perDay: pl.perDay.slice(), cells, bell: DEFAULT_BELL.slice(0, Math.max(...pl.perDay)).map((x) => ({ start: x[0], end: x[1] })) };
        }
        await newGrid(g);
      }
      function printPlan() {
        const pl = S.plan;
        if (S.view === 'all') {
          School.print({ landscape: true, margin: '8mm', build: () => h('div', { class: 'tt-print all' }, h('h1', null, pl.name), overviewTable(pl)) });
          return;
        }
        const grids = (S.view === 'class' ? pl.classes : pl.teachers.filter((t) => t.id === S.viewId)).map((x) => {
          if (S.view === 'class') { const cells = {}; for (const [k, cell] of Object.entries(pl.result.cells[x.id] || {})) cells[k] = { s: subjOf(cell.subjectId).name, n: cell.teacherIds.map(tName).join('・') }; return { name: x.name + '　時間割', days: pl.days, perDay: pl.perDay, cells, bell: [] }; }
          return Object.assign(teacherGrid(pl, x.id, x.name + '先生　時間割'), { bell: [] });
        });
        const only = S.view === 'class' ? grids.filter((g, i) => pl.classes[i].id === S.viewId) : grids;
        Kit.modal({
          title: '印刷', body: h('p', null, S.view === 'class' ? 'いま見ているクラスだけか、全クラス（1クラス1枚）を印刷します。' : 'この先生の時間割を印刷します。'),
          actions: [{ label: 'やめる', kind: 'ghost' }].concat(S.view === 'class' ? [{ label: '全クラス', onClick: () => printGrids(grids) }] : []).concat([{ label: S.view === 'class' ? 'このクラス' : '印刷する', kind: 'primary', onClick: () => printGrids(only) }]),
        });
      }
      function overviewTable(pl) {
        return h('table', null, h('thead', null, h('tr', null, h('th', null, ''), range(pl.days).flatMap((d) => range(pl.perDay[d]).map((p) => h('th', null, WD[d] + (p + 1)))))),
          h('tbody', null, pl.classes.map((c) => h('tr', null, h('th', null, c.name), range(pl.days).flatMap((d) => range(pl.perDay[d]).map((p) => { const cell = (pl.result.cells[c.id] || {})[K(d, p)]; return h('td', null, cell ? (subjOf(cell.subjectId).short || subjOf(cell.subjectId).name) : ''); }))))));
      }
      async function exportCsv() {
        const pl = S.plan;
        const head = [''].concat(range(pl.days).flatMap((d) => range(pl.perDay[d]).map((p) => WD[d] + (p + 1))));
        const rows = [head].concat(pl.classes.map((c) => [c.name].concat(range(pl.days).flatMap((d) => range(pl.perDay[d]).map((p) => { const cell = (pl.result.cells[c.id] || {})[K(d, p)]; return cell ? subjOf(cell.subjectId).name + (cell.teacherIds.length ? '（' + cell.teacherIds.map(tName).join('・') + '）' : '') : ''; })))));
        if (await Kit.download('時間割-' + Kit.safeName(pl.name) + '.csv', Kit.csv(rows))) Kit.toast('書き出しました');
      }

      S.level = (await Kit.profile.get()).level;
      await load();
      if (params && params.tab) S.tab = params.tab;
      render();
      const reload = Kit.debounce(async () => { if (!alive) return; await saveGrid.flush(); await savePlan.flush(); await load(); render(); }, 200);
      const offs = [Kit.store.on('doc:profile', async () => { S.level = (await Kit.profile.get()).level; reload(); })];
      return () => { alive = false; offs.forEach((f) => f()); reload.cancel(); saveGrid.flush(); savePlan.flush(); };
    },
  });

  // 共有で受け取った「わたしの時間割」（画面が開いていなくても受け取れるよう、ここで登録）
  School.share.receive('timetable', async (pack) => {
    const g = pack.items[0];
    if (!g) return;
    const ok = await Kit.confirm({ title: '時間割を受け取りますか？', body: '「' + (g.name || '時間割') + '」' + (pack.from ? '（' + pack.from + 'から）' : '') + 'を、わたしの時間割に追加します。', ok: '追加する' });
    if (!ok) return;
    const saved = await Kit.store.put('ttgrids', Object.assign(normGrid(g), { name: (g.name || '時間割') + (pack.from ? '（' + pack.from + 'から）' : '') }));
    Kit.pref.set('tt:grid', saved.id); Kit.pref.set('tt:tab', 'mine');
    if (Kit.current() === 'timetable') Kit.remount(); else Kit.go('timetable');
    Kit.toast('時間割を受け取りました');
  });

  // ほかのアプリ（ホーム）から：今日の時間割
  window.SenseiTimetable = {
    async today() {
      const grids = await Kit.store.list('ttgrids', { sample: [SAMPLE_GRID] });
      if (!grids.length) return null;
      const id = Kit.pref.get('tt:home', null);
      const g = normGrid(grids.find((x) => x.id === id) || grids[0]);
      const d = (new Date().getDay() + 6) % 7;
      if (d >= g.days) return { grid: g, day: d, items: [] };
      return { grid: g, day: d, items: range(g.perDay[d]).map((p) => ({ p, cell: g.cells[K(d, p)] || null, bell: g.bell[p] || {} })) };
    },
    WD,
  };
})();

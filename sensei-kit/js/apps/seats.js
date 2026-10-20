// 席替え：条件（前の席・列を決める人・はなす2人・男女・前回のとなり）をつけて、くじで席を決める。発表・印刷も
(function () {
  'use strict';
  const { h } = Kit;
  const K = (r, c) => r + '-' + c;
  const range = (n) => Array.from({ length: n }, (_, i) => i);

  // zones … 列を決める人 { 生徒id: { cols: [縦の列。黒板に向かって左から 0,1,…], rows: [横の列。前から 0,1,…] } } / window … 窓の側（黒板に向かって）
  const CFG_DEFAULT = { rows: 6, cols: 6, pairs: true, blocked: [], frontRows: 2, mix: 'none', avoidPrev: true, emptyBack: true, apart: [], fixed: {}, zones: {}, window: 'left', view: 'student' };
  const MIX = [
    { value: 'none', label: '気にしない' },
    { value: 'side', label: 'となり同士は男女' },
    { value: 'checker', label: '市松（前後左右が交互）' },
    { value: 'cols', label: '縦の列ごとに男女' },
  ];
  const normCfg = (c, classId) => {
    const o = Object.assign(Kit.clone(CFG_DEFAULT), c || {});
    o.rows = Kit.clamp(o.rows | 0 || 6, 1, 12); o.cols = Kit.clamp(o.cols | 0 || 6, 1, 12);
    o.blocked = (o.blocked || []).filter((k) => { const [r, cc] = String(k).split('-').map(Number); return r < o.rows && cc < o.cols; });
    o.frontRows = Kit.clamp(o.frontRows | 0 || 2, 1, 3);
    if (!MIX.some((x) => x.value === o.mix)) o.mix = 'none';
    o.apart = Array.isArray(o.apart) ? o.apart.filter((p) => Array.isArray(p) && p[0] && p[1]) : [];
    o.fixed = o.fixed && typeof o.fixed === 'object' ? o.fixed : {};
    const zones = {};
    for (const [id, z] of Object.entries(o.zones && typeof o.zones === 'object' ? o.zones : {})) {
      const cols = SeatSolver.normIdx(z && z.cols).filter((x) => x < 12), rows = SeatSolver.normIdx(z && z.rows).filter((x) => x < 12);
      if (cols.length || rows.length) zones[id] = { cols, rows };
    }
    o.zones = zones;
    o.window = o.window === 'right' ? 'right' : 'left';
    o.view = o.view === 'teacher' ? 'teacher' : 'student';
    if (classId) { o.classId = classId; o.id = 'cfg-' + classId; }
    return o;
  };

  // サンプル：架空のクラスの設定と、前回の席
  const SC = School.SAMPLE_CLASS;
  const sampleCfg = normCfg({ apart: [[School.sampleStudent(3), School.sampleStudent(27)]] }, SC.id);
  const sampleRes = SeatSolver.solve({ rows: 6, cols: 6, pairs: true, students: SC.students, frontRows: 2, seed: 20261001, restarts: 1, iterations: 3000, apart: sampleCfg.apart });
  Kit.store.sample('seatcfg', [sampleCfg]);
  Kit.store.sample('seatplans', [{ id: 's-seat-1', classId: SC.id, title: '9月の席', date: Kit.rel(-20), rows: 6, cols: 6, blocked: [], pairs: true, seats: sampleRes.seats, seed: 20261001 }]);
  School.classes.onRemove(School.removeByClass('seatcfg'));
  School.classes.onRemove(School.removeByClass('seatplans'));

  Kit.css('seats', `
.st-wrap{display:grid;gap:16px;grid-template-columns:1fr}
@media (min-width:1100px){.st-wrap{grid-template-columns:minmax(0,1fr) 340px;align-items:start}}
.st-boardcard{padding:14px}
.st-bar{display:flex;flex-wrap:wrap;align-items:center;gap:8px 10px;margin-bottom:10px}
.st-bar .st-title{font-weight:700;font-size:16px;margin-right:auto;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.st-modes{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;margin-bottom:10px}
.st-modehint{font-size:12.5px;color:var(--ink-2)}
.st-board{--seat-h:62px;--gap:6px;--aisle:16px;display:grid;gap:10px;justify-items:center;padding:6px 0 4px;overflow-x:auto}
.st-front{display:flex;align-items:center;justify-content:center;gap:10px;width:min(100%,520px)}
.st-kokuban{flex:1;text-align:center;padding:4px 0;border-radius:4px;background:var(--board);color:var(--on-board);font-family:var(--font-display);font-weight:600;letter-spacing:.3em;font-size:13px;border:3px solid var(--frame)}
.st-kyotaku{flex:none;padding:3px 10px;border-radius:4px;border:1.5px solid var(--line-strong);font-size:12px;color:var(--ink-2);background:var(--surface-2)}
.st-grid{display:grid;grid-template-columns:var(--tpl);gap:var(--gap);width:max-content;max-width:100%}
.st-aisle{width:var(--aisle)}
.st-seat{position:relative;display:grid;align-content:center;justify-items:center;gap:1px;width:var(--seat-w,90px);min-height:var(--seat-h);padding:4px 3px;border-radius:8px;border:1.5px solid var(--line-strong);background:var(--surface);color:var(--ink);font:inherit;text-align:center;cursor:pointer;transition:transform .08s,border-color .1s,background .1s}
.st-seat:hover{border-color:var(--gosu)}
.st-seat .no{font-size:12px;color:var(--ink-3);line-height:1.1;font-variant-numeric:tabular-nums}
.st-seat .nm{font-size:14px;font-weight:700;line-height:1.25;max-width:100%;overflow-wrap:anywhere}
.st-seat .nm .sei,.st-seat .nm .mei{white-space:nowrap}
.st-seat .nm .mei{font-weight:500}
.st-seat.is-empty{border-style:dashed;background:transparent;color:var(--ink-3)}
.st-seat.is-empty .nm{font-weight:400;font-size:12px}
.st-seat.is-none{border:1.5px dashed transparent;background:transparent;cursor:default}
.st-seat.is-none.can-edit{cursor:pointer;border-color:var(--line)}
.st-seat.is-none.can-edit::after{content:"＋";color:var(--ink-3);font-size:16px}
.st-seat.is-sel{border-color:var(--shu);box-shadow:0 0 0 3px color-mix(in srgb,var(--shu) 30%,transparent);transform:translateY(-1px)}
.st-seat.is-fixed{background:color-mix(in srgb,var(--gosu-wash) 70%,var(--surface))}
.st-seat.is-issue{border-color:var(--bad);background:var(--bad-wash)}
.st-seat.is-new{animation:st-pop .35s ease-out}
.st-mk{position:absolute;top:3px;display:flex;gap:2px}
.st-mk.l{left:4px}.st-mk.r{right:4px}
.st-mk svg{width:12px;height:12px;color:var(--gosu)}
.st-mk b{font-size:12px;line-height:1.2;padding:0 3px;border-radius:3px;background:var(--surface-2);color:var(--ink-2);font-weight:700}
.st-mk b.fr{background:var(--warn-wash);color:var(--warn)}
.st-mk.bl{top:auto;bottom:2px;left:4px}
.st-mk b.zn{background:var(--gosu-wash);color:var(--gosu);line-height:1.15}
.st-ruler{display:flex;align-items:flex-end;justify-content:center;gap:1px;padding:0 0 2px;border-bottom:2px solid var(--line-strong);font-size:12px;color:var(--ink-2);line-height:1.3;white-space:nowrap}
.st-ruler b{font-size:13px;font-variant-numeric:tabular-nums;color:var(--ink)}
.st-ruler.is-under{align-items:flex-start;padding:2px 0 0;border-bottom:0;border-top:2px solid var(--line-strong)}
.st-rulernote{font-size:12.5px;color:var(--ink-2);text-align:center;margin-top:4px}
.st-rulernote b{display:inline-block;font-size:12px;line-height:1.2;padding:0 3px;border-radius:3px;background:var(--gosu-wash);color:var(--gosu)}
@keyframes st-pop{from{transform:scale(.85);opacity:.3}to{transform:none;opacity:1}}
.st-issues{display:grid;gap:6px;margin-top:10px}
.st-issue{display:flex;gap:8px;align-items:flex-start;font-size:13.5px;padding:8px 10px;border-radius:8px;background:var(--warn-wash);color:var(--ink)}
.st-issue svg{flex:none;width:16px;height:16px;color:var(--warn);margin-top:3px}
.st-ok{display:flex;gap:8px;align-items:center;font-size:13.5px;padding:8px 10px;border-radius:8px;background:var(--ok-wash);color:var(--ink)}
.st-ok svg{width:16px;height:16px;color:var(--ok)}
.st-unseated{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:10px;font-size:13px}
.st-unseated .chip{cursor:pointer;min-height:30px;font-size:13px}
.st-unseated .chip[aria-pressed="true"]{background:var(--shu);color:var(--on-shu)}
.st-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
.st-set{display:grid;gap:14px}
.st-set h3{font-size:14px;font-weight:700}
.st-num{display:inline-flex;align-items:center;gap:4px}
.st-num b{min-width:2.2em;text-align:center;font-variant-numeric:tabular-nums;font-size:16px}
.st-dims{display:flex;flex-wrap:wrap;gap:10px 18px;align-items:center}
.st-pairs{display:grid;gap:6px}
.st-pair{display:flex;align-items:center;gap:6px;font-size:13.5px;padding:4px 4px 4px 10px;border:1px solid var(--line);border-radius:8px}
.st-pair span{flex:1;min-width:0}
.st-addpair{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) auto;gap:6px}
.st-sum{font-size:13px;color:var(--ink-2)}
/* 列を決める人 */
.st-zone-ed{display:grid;gap:8px;padding:10px;border:1px solid var(--line);border-radius:10px;background:var(--surface-2)}
.st-zone-ed .st-who-now{font-size:14px;font-weight:700}
.st-lanes-h{display:flex;flex-wrap:wrap;align-items:baseline;gap:2px 8px;font-size:13.5px}
.st-lanes-h span{font-size:12.5px;color:var(--ink-2)}
.st-lanes{display:flex;flex-wrap:wrap;gap:5px}
.st-lane{display:inline-flex;flex-direction:column;align-items:center;justify-content:center;min-width:40px;min-height:42px;padding:3px 5px;border-radius:8px;border:1.5px solid var(--line-strong);background:var(--surface);color:var(--ink);font:inherit;line-height:1.15;cursor:pointer;transition:background .12s,border-color .12s}
.st-lane b{font-size:15px;font-variant-numeric:tabular-nums}
.st-lane small{font-size:12px;color:var(--ink-2)}
.st-lane:hover{border-color:var(--gosu)}
.st-lane[aria-pressed="true"]{background:var(--gosu);border-color:var(--gosu);color:var(--on-gosu)}
.st-lane[aria-pressed="true"] small{color:inherit}
.st-win{display:flex;flex-wrap:wrap;align-items:center;gap:6px}
.st-zmap{display:grid;grid-template-columns:auto auto auto;gap:4px 6px;align-items:center;justify-content:start}
.st-zmap-grid{display:grid;grid-template-columns:repeat(var(--zc),16px);gap:3px}
.st-zmap-grid i{display:block;width:16px;height:12px;border-radius:3px;border:1.5px solid var(--line-strong);background:var(--surface)}
.st-zmap-grid i.on{background:var(--gosu);border-color:var(--gosu)}
.st-zmap-grid i.none{background:transparent;border-color:transparent}
.st-zmap-board{font-size:12px;line-height:1.5;text-align:center;letter-spacing:.3em;border-radius:3px;background:var(--board);color:var(--on-board)}
.st-zmap-side{font-size:12px;color:var(--ink-2);writing-mode:vertical-rl;letter-spacing:.15em}
.st-zsum{font-size:13px}
.st-zsum.is-bad{color:var(--bad)}
.st-znote{font-size:12.5px;color:var(--ink-2)}
.st-pair.st-zitem{display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;gap:0 2px;padding:4px 4px 8px 10px}
.st-zitem .st-ztext{grid-column:1/-1;display:grid;gap:1px;font-size:12.5px;color:var(--ink-2)}
.st-zitem .st-zwarn{color:var(--bad)}
.st-who{display:block;font-size:12.5px;color:var(--ink-2);margin-top:2px}
/* 発表 */
.st-show{position:fixed;inset:0;z-index:150;background:var(--bg);display:flex;flex-direction:column;padding:max(14px,env(safe-area-inset-top)) var(--gutter-r) max(14px,env(safe-area-inset-bottom)) var(--gutter-l);overflow:auto}
.st-show-top{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;margin-bottom:10px}
.st-show-top h2{font-family:var(--font-display);font-weight:600;font-size:clamp(20px,3vw,30px);margin-right:auto}
.st-show .st-board{--seat-h:clamp(56px,9vh,96px);flex:1;align-content:center}
.st-show .st-seat{--seat-w:clamp(70px,12vw,150px)}
.st-show .st-seat .nm{font-size:clamp(14px,2.2vw,24px)}
.st-show .st-seat .no{font-size:clamp(11px,1.3vw,15px)}
.st-seat.is-hidden{background:var(--gosu-wash);border-color:var(--gosu);color:var(--gosu)}
.st-seat.is-hidden .nm{font-size:clamp(18px,3vw,30px);font-family:var(--font-display)}
.st-seat.is-flip{animation:st-flip .45s ease-out}
@keyframes st-flip{0%{transform:rotateY(90deg)}100%{transform:none}}
@media (max-width:640px){
  .st-board{--seat-h:54px;--gap:4px;--aisle:8px}
  .st-seat{--seat-w:calc((100vw - 2 * var(--gutter-l) - 60px - var(--extra-aisles, 0px)) / var(--ncols))}
  .st-seat .nm{font-size:12.5px}
  .st-seat .nm .mei{display:none}
  .st-board.has-zones{--seat-h:64px}
  .st-boardcard{padding:10px}
}
/* 印刷 */
.st-print{font-family:var(--font-body);color:#000}
.st-print h1{font-size:20pt;margin:0 0 2mm;font-family:var(--font-display)}
.st-print .sub{font-size:10pt;margin-bottom:5mm}
.st-print .pg{page-break-after:always}
.st-print .pg:last-child{page-break-after:auto}
.st-print .front{display:flex;justify-content:center;gap:6mm;margin:3mm auto;width:70%}
.st-print .front span{flex:1;text-align:center;border:1.5pt solid #000;padding:1.5mm 0;font-size:11pt;letter-spacing:.4em}
.st-print .front span.k{flex:none;width:28mm;letter-spacing:.2em}
.st-print table{border-collapse:separate;border-spacing:2.5mm;margin:0 auto}
.st-print td{border:1pt solid #000;border-radius:2mm;width:var(--pw);height:var(--ph);text-align:center;vertical-align:middle;padding:1mm}
.st-print td.none{border:0}
.st-print td.aisle{border:0;width:4mm;padding:0}
.st-print td .no{display:block;font-size:8pt;color:#333}
.st-print td .nm{display:block;font-size:var(--pf);font-weight:700;line-height:1.2}
.st-print td.empty .nm{font-weight:400;color:#777;font-size:9pt}
`);

  Kit.app({
    id: 'seats', title: '席替え', group: 'class', icon: 'seats', order: 20,
    desc: '条件をつけて、くじで席を決める。発表・印刷も',
    colls: ['seatcfg', 'seatplans'],
    async mount(root) {
      const blankZone = () => ({ id: '', cols: [], rows: [] });
      const S = { cls: null, cfg: null, plans: [], draft: null, sel: null, selStudent: null, mode: 'swap', viewPlanId: null, busy: false, zoneEdit: blankZone() };
      const mq = window.matchMedia('(max-width: 640px)');
      let alive = true;

      const classSlot = h('div'), sampleSlot = h('div'), main = h('div');
      const runBtn = Kit.btn('席替えする', () => run(), { kind: 'primary', icon: 'shuffle' });
      root.append(Kit.appHead({
        title: '席替え',
        desc: '条件をつけて、くじで席を決めます。発表と座席表の印刷も。',
        actions: [runBtn, Kit.btn('発表する', () => show(), { icon: 'eye' }), Kit.btn('印刷', () => printDlg(), { icon: 'printer' })],
      }), classSlot, sampleSlot, main);

      /* ── 読み込み ── */
      async function load() {
        S.cls = await School.classes.current();
        if (!S.cls) { S.cfg = null; S.plans = []; S.draft = null; return; }
        const cfgs = await Kit.store.list('seatcfg', { sample: [sampleCfg] });
        S.cfg = normCfg(cfgs.find((c) => c.classId === S.cls.id), S.cls.id);
        const all = await Kit.store.list('seatplans');
        S.plans = all.filter((p) => p.classId === S.cls.id).sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.createdAt).localeCompare(String(a.createdAt)));
        const show = (S.viewPlanId && S.plans.find((p) => p.id === S.viewPlanId)) || S.plans[0] || null;
        if (!S.draft || S.draft.classId !== S.cls.id || S.draft.saved) S.draft = show ? fromPlan(show) : blankDraft();
        if (S.zoneEdit.id && !S.cls.students.some((s) => s.id === S.zoneEdit.id)) S.zoneEdit = blankZone();
      }
      const fromPlan = (p) => ({ classId: p.classId, planId: p.id, title: p.title || '', date: p.date, rows: p.rows, cols: p.cols, blocked: (p.blocked || []).slice(), pairs: !!p.pairs, seats: Object.assign({}, p.seats || {}), seed: p.seed, saved: true, issues: null });
      const blankDraft = () => ({ classId: S.cls.id, planId: null, title: '', date: Kit.ymd(), rows: S.cfg.rows, cols: S.cfg.cols, blocked: S.cfg.blocked.slice(), pairs: S.cfg.pairs, seats: {}, saved: false, issues: null });
      const latest = () => S.plans[0] || null;
      const stById = () => new Map((S.cls ? S.cls.students : []).map((s) => [s.id, s]));
      const saveCfg = Kit.debounce(() => { if (S.cfg) Kit.store.put('seatcfg', Object.assign({}, S.cfg)); }, 300);

      /* ── 描く ── */
      async function render() {
        Kit.clear(classSlot); Kit.clear(sampleSlot); Kit.clear(main);
        classSlot.append(await School.classBar({ onChange: async () => { S.draft = null; S.viewPlanId = null; S.sel = null; await load(); render(); } }));
        if (!S.cls) { main.append(Kit.empty({ title: '席替えには名簿が要ります', body: '名簿にクラスを入れると、ここで席替えができます（出席番号だけでも使えます）。', actions: [Kit.btn('名簿を開く', () => Kit.go('roster'), { kind: 'primary', icon: 'users' })] })); return; }
        if (S.cls.sample) sampleSlot.append(Kit.sampleBar('架空のクラス（2年3組）で試せます。「席替えする」を押してみてください。'));
        main.append(h('div', { class: 'st-wrap' }, boardCard(), settingsCard()));
      }

      function boardCard() {
        const d = S.draft;
        const card = h('section', { class: 'card st-boardcard', 'aria-label': '座席' });
        const histSel = h('select', { id: 'st-hist', 'aria-label': '保存した席', style: { width: 'auto', maxWidth: '100%' } },
          h('option', { value: '' }, S.plans.length ? '保存した席（' + S.plans.length + '）' : '保存した席はまだありません'),
          S.plans.map((p) => h('option', { value: p.id }, Kit.fmtDate(p.date, 'M/D') + ' ' + (p.title || '席'))));
        histSel.value = d.planId || '';
        histSel.addEventListener('change', async () => {
          if (!histSel.value) return;
          if (!d.saved && Object.keys(d.seats).length && !(await Kit.confirm({ title: '保存していない席があります', body: 'いま表示している席は、まだ保存していません。ほかの席を開くと消えます。', ok: '開く' }))) { histSel.value = d.planId || ''; return; }
          const p = S.plans.find((x) => x.id === histSel.value);
          if (p) { S.viewPlanId = p.id; S.draft = fromPlan(p); S.sel = null; render(); }
        });
        const status = d.saved ? h('span', { class: 'chip ok' }, Kit.fmtDate(d.date, 'M/D') + ' に保存') : Object.keys(d.seats).length ? h('span', { class: 'chip shu' }, 'まだ保存していません') : null;
        card.append(h('div', { class: 'st-bar' },
          h('div', { class: 'st-title' }, (S.cls.name || '') + ' の席', status),
          histSel,
          Kit.seg([{ value: 'student', label: '生徒から見た図' }, { value: 'teacher', label: '教卓から見た図' }], S.cfg.view, (v) => { S.cfg.view = v; saveCfg(); render(); }, { label: '図の向き' })));
        const hint = { swap: '席を2つ押すと、入れかわります。', pin: '押した席の人を「固定」にします（次の席替えでも動きません）。', layout: '押した場所の机を、出す・なくすを切りかえます。' }[S.mode];
        card.append(h('div', { class: 'st-modes' },
          Kit.seg([{ value: 'swap', label: '入れかえ', icon: 'swap' }, { value: 'pin', label: '固定する', icon: 'pin' }, { value: 'layout', label: '机の配置', icon: 'seats' }], S.mode, (v) => { S.mode = v; S.sel = null; S.selStudent = null; render(); }, { label: '押したときの動き' }),
          h('span', { class: 'st-modehint' }, hint)));
        card.append(board({ interactive: true }));
        if (hasZones()) {
          card.append(h('p', { class: 'st-rulernote' }, '列の番号は、黒板に向かって左から数えます（1列目が' + (S.cfg.window === 'left' ? '窓側' : '廊下側') + '）。' + (S.cfg.view === 'teacher' ? '教卓から見た図では、右はしが1列目です。' : ''),
            ' ', h('b', null, '列'), ' は列を決めた人。'));
        }
        card.append(unseatedEl());
        card.append(issuesEl());
        card.append(h('div', { class: 'st-actions' },
          Kit.btn(d.saved ? 'この席を保存しなおす' : 'この席で決定（保存）', () => savePlan(), { kind: d.saved ? '' : 'primary', icon: 'save', disabled: !Object.keys(d.seats).length }),
          Kit.btn(Object.keys(d.seats).length ? 'もう一度くじ' : '席替えする', () => run(), { icon: 'shuffle' }),
          !d.saved && latest() ? Kit.btn('保存した席に戻す', () => { S.draft = fromPlan(latest()); S.sel = null; render(); }, { kind: 'ghost', icon: 'undo' }) : null,
          h('span', { class: 'grow' }),
          d.saved && d.planId ? Kit.btn('', () => removePlan(d.planId), { icon: 'trash', kind: 'ghost', title: 'この保存した席を消す' }) : null));
        return card;
      }

      // 座席の図。o.big … 発表用 / o.hiddenSet … 発表で伏せている席 / o.interactive … 押せる
      function board(o = {}) {
        const d = o.draft || S.draft, view = o.view || S.cfg.view;
        const st = stById();
        const blocked = new Set(d.blocked || []);
        const issueIds = new Set((d.issues || []).filter((x) => ['front', 'apart', 'zone', 'zoneFront', 'zoneFixed'].includes(x.kind)).flatMap((x) => x.ids || []));
        const fixedAt = o.interactive ? S.cfg.fixed : {};
        const zones = o.interactive ? S.cfg.zones : {};
        const rowsOrder = view === 'teacher' ? range(d.rows).reverse() : range(d.rows);
        const colsOrder = view === 'teacher' ? range(d.cols).reverse() : range(d.cols);
        const aisleAfter = (c, i) => d.pairs && i < colsOrder.length - 1 && (view === 'teacher' ? c % 2 === 0 : c % 2 === 1);
        const tpl = [];
        colsOrder.forEach((c, i) => { tpl.push('auto'); if (aisleAfter(c, i)) tpl.push('var(--aisle)'); });
        const nAisles = tpl.length - colsOrder.length;
        const grid = h('div', { class: 'st-grid', role: 'group', 'aria-label': view === 'teacher' ? '教卓から見た座席' : '生徒から見た座席', style: '--tpl:' + tpl.join(' ') + ';--ncols:' + d.cols + ';--extra-aisles:' + nAisles * 8 + 'px' });
        const showMix = S.cfg.mix !== 'none';
        // 列の番号（列を決めた人がいるとき）。黒板に近い側に、黒板に向かって左から 1, 2, …
        const ruler = (under) => colsOrder.forEach((c, i) => {
          grid.append(h('span', { class: 'st-ruler' + (under ? ' is-under' : ''), 'aria-hidden': 'true' }, h('b', null, c + 1), d.cols > 8 && mq.matches ? null : '列目'));
          if (aisleAfter(c, i)) grid.append(h('span', { class: 'st-aisle', 'aria-hidden': 'true' }));
        });
        const showRuler = o.interactive && hasZones();
        if (showRuler && view !== 'teacher') ruler(false);
        for (const r of rowsOrder) {
          colsOrder.forEach((c, i) => {
            const k = K(r, c);
            const none = blocked.has(k);
            const id = d.seats[k], s = id ? st.get(id) : null;
            let el;
            if (none) {
              el = h(o.interactive && S.mode === 'layout' ? 'button' : 'div', { class: 'st-seat is-none' + (o.interactive && S.mode === 'layout' ? ' can-edit' : ''), 'data-k': k, type: o.interactive && S.mode === 'layout' ? 'button' : null, 'aria-label': o.interactive && S.mode === 'layout' ? (r + 1) + '列目の' + (c + 1) + '番目に机を出す' : null });
            } else if (!s) {
              el = h(o.interactive ? 'button' : 'div', { type: o.interactive ? 'button' : null, class: 'st-seat is-empty' + (S.sel === k ? ' is-sel' : ''), 'data-k': k, 'aria-label': '空いた席' }, h('span', { class: 'nm' }, '空き'));
            } else {
              const hiddenNow = o.hiddenSet && o.hiddenSet.has(k);
              const name = School.label(s, { noNumber: true });
              const parts = name.split(' ');
              const nm = hiddenNow ? h('span', { class: 'nm' }, '？') : School.hidden() || !s.name ? h('span', { class: 'nm' }, s.no + '番') : h('span', { class: 'nm' }, h('span', { class: 'sei' }, parts[0]), parts[1] ? h('span', { class: 'mei' }, ' ' + parts.slice(1).join(' ')) : null);
              el = h(o.interactive || o.big ? 'button' : 'div', {
                type: o.interactive || o.big ? 'button' : null,
                class: 'st-seat' + (S.sel === k && o.interactive ? ' is-sel' : '') + (fixedAt[k] === id ? ' is-fixed' : '') + (o.interactive && issueIds.has(id) ? ' is-issue' : '') + (hiddenNow ? ' is-hidden' : '') + (o.flipKey === k ? ' is-flip' : '') + (o.popAll ? ' is-new' : ''),
                'data-k': k, 'aria-label': hiddenNow ? 'まだ伏せている席' : (s.no + '番' + (School.hidden() ? '' : ' ' + (s.name || ''))) + (fixedAt[k] === id ? '（固定）' : '') + (zones[id] ? '（列を決めた人）' : ''),
              },
              hiddenNow || !s.name || School.hidden() ? null : h('span', { class: 'no' }, s.no),
              nm,
              o.interactive ? h('span', { class: 'st-mk l' }, fixedAt[k] === id ? Kit.icon('pin') : null, s.front ? h('b', { class: 'fr', title: '前の席' }, '前') : null) : null,
              o.interactive && showMix && s.gender ? h('span', { class: 'st-mk r' }, h('b', null, s.gender === 'm' ? '男' : '女')) : null,
              o.interactive && zones[id] ? h('span', { class: 'st-mk bl' }, h('b', { class: 'zn', title: '列を決めた人：' + SeatSolver.zoneText(zones[id], { cols: S.cfg.cols, window: S.cfg.window }) }, '列')) : null);
            }
            grid.append(el);
            if (aisleAfter(c, i)) grid.append(h('span', { class: 'st-aisle', 'aria-hidden': 'true' }));
          });
        }
        if (showRuler && view === 'teacher') ruler(true);
        const front = h('div', { class: 'st-front', 'aria-hidden': 'true' }, h('span', { class: 'st-kokuban' }, '黒板'), h('span', { class: 'st-kyotaku' }, '教卓'));
        const wrap = h('div', { class: 'st-board' + (o.big ? ' is-big' : '') + (showRuler ? ' has-zones' : '') });
        if (view === 'teacher') wrap.append(grid, front); else wrap.append(front, grid);
        if (o.interactive) grid.addEventListener('click', onSeat);
        return wrap;
      }

      function unseatedEl() {
        const d = S.draft;
        const seated = new Set(Object.values(d.seats));
        const left = S.cls.students.filter((s) => !seated.has(s.id));
        if (!left.length || !Object.keys(d.seats).length) return h('div');
        return h('div', { class: 'st-unseated' },
          h('span', null, '席がまだない人：'),
          left.map((s) => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(S.selStudent === s.id), onclick: () => { S.selStudent = S.selStudent === s.id ? null : s.id; S.sel = null; render(); } }, School.label(s))),
          h('span', { class: 'small muted' }, '名前を押してから、空いた席を押すと座ります。'));
      }
      function issuesEl() {
        const d = S.draft, box = h('div', { class: 'st-issues', 'aria-live': 'polite' });
        if (d.error) { box.append(h('div', { class: 'st-issue' }, Kit.icon('warn'), h('span', null, d.error))); return box; }
        if (!d.issues) return box;
        if (!d.issues.length) box.append(h('div', { class: 'st-ok' }, Kit.icon('check'), h('span', null, '条件をすべて満たしました。')));
        const byId = stById();
        for (const it of d.issues) {
          // 列の知らせには、だれのことかを添える（「名前を隠す」なら番号だけ）
          const who = /^zone/.test(it.kind) ? (it.ids || []).map((id) => byId.get(id)).filter(Boolean).sort((a, b) => (a.no || 0) - (b.no || 0)).map((s) => School.label(s)).join('、') : '';
          box.append(h('div', { class: 'st-issue' }, Kit.icon('warn'), h('span', null, it.text, who ? h('span', { class: 'st-who' }, '対象：' + who) : null)));
        }
        return box;
      }

      /* ── 押したとき ── */
      function onSeat(e) {
        const b = e.target.closest('[data-k]');
        if (!b) return;
        const k = b.dataset.k, d = S.draft;
        if (S.mode === 'layout') return toggleDesk(k);
        if ((d.blocked || []).includes(k)) return;
        if (S.mode === 'pin') {
          const id = d.seats[k];
          if (!id) { Kit.toast('空いた席は固定できません'); return; }
          const fx = S.cfg.fixed;
          for (const kk of Object.keys(fx)) if (fx[kk] === id && kk !== k) delete fx[kk];
          if (fx[k] === id) delete fx[k]; else fx[k] = id;
          saveCfg(); render(); return;
        }
        // 席がない人を座らせる
        if (S.selStudent) {
          if (d.seats[k]) { Kit.toast('空いた席を押してください'); return; }
          d.seats[k] = S.selStudent; S.selStudent = null; changed(); return;
        }
        if (!S.sel) { if (!d.seats[k]) return; S.sel = k; render(); return; }
        if (S.sel === k) { S.sel = null; render(); return; }
        const a = S.sel, ia = d.seats[a], ib = d.seats[k];
        if (ib) d.seats[a] = ib; else delete d.seats[a];
        if (ia) d.seats[k] = ia; else delete d.seats[k];
        // 固定は人についていく
        const fx = S.cfg.fixed;
        const fa = fx[a], fb = fx[k];
        delete fx[a]; delete fx[k];
        if (fa) fx[k] = fa;
        if (fb) fx[a] = fb;
        S.sel = null;
        saveCfg();
        changed();
      }
      function changed() { S.draft.saved = false; S.draft.issues = null; render(); }
      function toggleDesk(k) {
        const set = new Set(S.cfg.blocked);
        if (set.has(k)) set.delete(k);
        else {
          if (S.draft.seats[k]) { Kit.toast('人が座っている席はなくせません。先に入れかえてください', { type: 'bad' }); return; }
          set.add(k);
        }
        S.cfg.blocked = [...set];
        S.draft.blocked = S.cfg.blocked.slice();
        for (const kk of Object.keys(S.cfg.fixed)) if (set.has(kk)) delete S.cfg.fixed[kk];
        saveCfg(); S.draft.saved = false; render();
      }

      /* ── 設定 ── */
      function settingsCard() {
        const c = S.cfg, st = S.cls.students;
        const seatsN = c.rows * c.cols - c.blocked.length;
        const num = (label, val, min, max, set) => h('span', { class: 'st-num' }, h('span', { class: 'small ink-2' }, label),
          Kit.btn('', () => set(Math.max(min, val - 1)), { icon: 'minus', sm: true, title: label + 'を減らす', disabled: val <= min }),
          h('b', { 'aria-live': 'polite' }, val),
          Kit.btn('', () => set(Math.min(max, val + 1)), { icon: 'plus', sm: true, title: label + 'をふやす', disabled: val >= max }));
        const setDims = (rows, cols) => {
          c.rows = rows; c.cols = cols;
          c.blocked = c.blocked.filter((k) => { const [r, cc] = k.split('-').map(Number); return r < rows && cc < cols; });
          for (const k of Object.keys(c.fixed)) { const [r, cc] = k.split('-').map(Number); if (r >= rows || cc >= cols) delete c.fixed[k]; }
          const d = S.draft;
          d.rows = rows; d.cols = cols; d.blocked = c.blocked.slice();
          for (const k of Object.keys(d.seats)) { const [r, cc] = k.split('-').map(Number); if (r >= rows || cc >= cols) delete d.seats[k]; }
          d.saved = false; d.issues = null;
          saveCfg(); render();
        };
        const genders = st.filter((s) => s.gender).length;
        const fronts = st.filter((s) => s.front);
        const pick = (id) => h('select', { id, 'aria-label': '生徒を選ぶ' }, h('option', { value: '' }, '選ぶ'), st.map((s) => h('option', { value: s.id }, School.label(s))));
        const pa = pick('st-pa'), pb = pick('st-pb');
        const byId = stById();
        const fixedList = Object.entries(c.fixed).filter(([, id]) => byId.has(id));
        return h('section', { class: 'card st-set', 'aria-label': '席替えの条件' },
          h('h2', { class: 'small', style: { fontSize: '16px', fontWeight: 700 } }, '条件'),
          h('div', { class: 'stack tight' },
            h('h3', null, '机の数'),
            h('div', { class: 'st-dims' }, num('横', c.cols, 1, 12, (v) => setDims(c.rows, v)), num('縦', c.rows, 1, 12, (v) => setDims(v, c.cols))),
            h('p', { class: 'st-sum' + (seatsN < st.length ? '' : ''), style: seatsN < st.length ? { color: 'var(--bad)' } : null }, '席 ' + seatsN + 'こ・生徒 ' + st.length + '人' + (seatsN < st.length ? '（席が足りません）' : seatsN > st.length ? '（空き ' + (seatsN - st.length) + '）' : '')),
            Kit.seg([{ value: 'single', label: '1人ずつ' }, { value: 'pair', label: '2人ずつ（となりとくっつける）' }], c.pairs ? 'pair' : 'single', (v) => { c.pairs = v === 'pair'; S.draft.pairs = c.pairs; S.draft.saved = false; saveCfg(); render(); }, { label: '机の並び' })),
          h('div', { class: 'stack tight' },
            h('h3', null, '「前の席」の人'),
            h('p', { class: 'small ink-2' }, fronts.length ? fronts.map((s) => School.label(s)).join('、') + ' を、' : '名簿で「前の席」に印をつけた人を、'),
            Kit.seg([1, 2, 3].map((n) => ({ value: n, label: '前から' + n + '列目まで' })), c.frontRows, (v) => { c.frontRows = +v; saveCfg(); if (S.zoneEdit.id) render(); }, { label: '前の席の範囲' })),
          zoneSection(byId),
          h('div', { class: 'stack tight' },
            h('h3', null, '男女の並び'),
            Kit.seg(MIX, c.mix, (v) => { c.mix = v; saveCfg(); render(); }, { label: '男女の並び' }),
            c.mix !== 'none' && genders < st.length ? h('p', { class: 'small muted' }, '名簿で性別が空欄の人（' + (st.length - genders) + '人）は、どの席でもよいことにします。') : null),
          h('div', { class: 'stack tight' },
            h('label', { class: 'check', for: 'st-prev' }, h('input', { type: 'checkbox', id: 'st-prev', checked: c.avoidPrev, onchange: (e) => { c.avoidPrev = e.target.checked; saveCfg(); } }), '前回と同じとなり・同じ席にしない'),
            h('label', { class: 'check', for: 'st-empty' }, h('input', { type: 'checkbox', id: 'st-empty', checked: c.emptyBack, onchange: (e) => { c.emptyBack = e.target.checked; saveCfg(); } }), '空いた席は後ろに')),
          h('div', { class: 'stack tight' },
            h('h3', null, 'はなす2人'),
            h('p', { class: 'small muted' }, '前後左右・ななめのとなりにしません。'),
            h('div', { class: 'st-pairs' }, c.apart.map((p, i) => {
              const a = byId.get(p[0]), b = byId.get(p[1]);
              if (!a || !b) return null;
              return h('div', { class: 'st-pair' }, h('span', null, School.label(a) + ' と ' + School.label(b)), Kit.btn('', () => { c.apart.splice(i, 1); saveCfg(); render(); }, { icon: 'close', sm: true, kind: 'ghost', title: 'この組を外す' }));
            })),
            h('div', { class: 'st-addpair' }, pa, pb, Kit.btn('足す', () => {
              if (!pa.value || !pb.value || pa.value === pb.value) { Kit.toast('ちがう2人を選んでください', { type: 'bad' }); return; }
              if (c.apart.some((p) => (p[0] === pa.value && p[1] === pb.value) || (p[0] === pb.value && p[1] === pa.value))) { Kit.toast('その2人は、もう入っています'); return; }
              c.apart.push([pa.value, pb.value]); saveCfg(); render();
            }, { sm: true, icon: 'plus' }))),
          h('div', { class: 'stack tight' },
            h('h3', null, '固定の席'),
            fixedList.length ? h('div', { class: 'st-pairs' }, fixedList.map(([k, id]) => h('div', { class: 'st-pair' }, h('span', null, School.label(byId.get(id)) + '（' + (+k.split('-')[0] + 1) + '列目）'), Kit.btn('', () => { delete c.fixed[k]; saveCfg(); render(); }, { icon: 'close', sm: true, kind: 'ghost', title: '固定を外す' }))))
              : h('p', { class: 'small muted' }, '「固定する」にして席を押すと、その人は席替えで動きません（配慮が必要なときなど）。')));
      }

      /* ── 列を決める人 ──
         縦の列は「黒板に向かって左から」、横の列は「前から」数える。図の向き（生徒から／教卓から）を変えても同じ数え方 */
      const hasZones = () => !!S.cls && S.cls.students.some((s) => S.cfg.zones[s.id]);
      const zoneHasDesk = (z) => {
        const bl = new Set(S.cfg.blocked);
        for (let r = 0; r < S.cfg.rows; r++) for (let c = 0; c < S.cfg.cols; c++) {
          if (!bl.has(K(r, c)) && (!z.cols.length || z.cols.includes(c)) && (!z.rows.length || z.rows.includes(r))) return true;
        }
        return false;
      };
      function zoneSection(byId) {
        const c = S.cfg, E = S.zoneEdit;
        const list = Object.entries(c.zones).filter(([id]) => byId.has(id));
        const who = h('select', { id: 'st-zone-who', 'aria-label': '列を決める生徒を選ぶ' }, h('option', { value: '' }, '生徒を選ぶ'),
          S.cls.students.map((s) => h('option', { value: s.id }, School.label(s) + (c.zones[s.id] ? '（決めてあります）' : ''))));
        who.value = E.id || '';
        who.addEventListener('change', () => openZone(who.value, true));
        return h('div', { class: 'stack tight st-zone' },
          h('h3', null, '列を決める人'),
          h('p', { class: 'small muted' }, '窓側・廊下側、前のほうなど、座ってよい列を生徒ごとに決めます。'),
          who,
          E.id && byId.has(E.id) ? zoneEditor(byId.get(E.id)) : null,
          list.length ? h('div', { class: 'st-pairs' }, list.map(([id, z]) => h('div', { class: 'st-pair st-zitem' },
            h('b', null, School.label(byId.get(id))),
            Kit.btn('', () => openZone(id), { icon: 'edit', sm: true, kind: 'ghost', title: 'この人の列を直す' }),
            Kit.btn('', () => { delete c.zones[id]; if (S.zoneEdit.id === id) S.zoneEdit = blankZone(); saveCfg(); render(); }, { icon: 'close', sm: true, kind: 'ghost', title: 'この人の列の決めごとを外す' }),
            // 縦の列・横の列を1行ずつ
            h('span', { class: 'st-ztext' }, SeatSolver.zoneText(z, { cols: c.cols, window: c.window }).split('、').map((t) => h('span', null, t)),
              zoneHasDesk(z) ? null : h('span', { class: 'st-zwarn' }, 'いまは、この列に机がありません'))))) : null);
      }
      async function openZone(id, keepFocus) {
        const z = S.cfg.zones[id];
        S.zoneEdit = id ? { id, cols: z ? z.cols.slice() : [], rows: z ? z.rows.slice() : [] } : blankZone();
        await render();
        const ed = main.querySelector('.st-zone-ed');
        if (keepFocus) { const sel = document.getElementById('st-zone-who'); if (sel) sel.focus({ preventScroll: true }); }
        else if (ed) { ed.scrollIntoView({ block: 'nearest' }); const b = ed.querySelector('.st-lane'); if (b) b.focus({ preventScroll: true }); }
      }
      function zoneEditor(s) {
        const c = S.cfg, E = S.zoneEdit;
        const winAt = c.window === 'right' ? c.cols - 1 : 0, hallAt = c.window === 'right' ? 0 : c.cols - 1;
        const colSub = (i) => (c.cols < 2 ? '' : i === winAt ? '窓側' : i === hallAt ? '廊下側' : '');
        const rowSub = (i) => (c.rows < 2 ? '' : i === 0 ? '前' : i === c.rows - 1 ? '後ろ' : '');
        const live = h('div', { class: 'stack tight', 'aria-live': 'polite' });
        const draw = () => { Kit.clear(live); Kit.add(live, zonePreview(s, E)); };
        const chips = (axis, n, sub, label) => h('div', { class: 'st-lanes', role: 'group', 'aria-label': label }, range(n).map((i) => {
          const arr = axis === 'c' ? E.cols : E.rows;
          const b = h('button', { type: 'button', class: 'st-lane', 'data-lane': axis + i, 'aria-pressed': String(arr.includes(i)), 'aria-label': (axis === 'c' ? '縦の列、左から' : '横の列、前から') + (i + 1) + '列目' + (sub(i) ? '（' + sub(i) + '）' : '') },
            h('b', null, i + 1), sub(i) ? h('small', null, sub(i)) : null);
          b.addEventListener('click', () => {
            const list = axis === 'c' ? E.cols : E.rows;
            const at = list.indexOf(i);
            if (at >= 0) list.splice(at, 1); else { list.push(i); list.sort((x, y) => x - y); }
            b.setAttribute('aria-pressed', String(at < 0));
            draw();
          });
          return b;
        }));
        draw();
        return h('div', { class: 'st-zone-ed', role: 'group', 'aria-label': School.label(s) + ' の座ってよい列' },
          h('div', { class: 'st-who-now' }, School.label(s), c.zones[s.id] ? h('span', { class: 'small muted', style: { fontWeight: 400 } }, '（決めてあります）') : null),
          h('div', { class: 'st-lanes-h' }, h('b', null, '縦の列'), h('span', null, '黒板に向かって左から')),
          chips('c', c.cols, colSub, '縦の列（黒板に向かって左から）'),
          h('div', { class: 'st-win' }, h('span', { class: 'small ink-2' }, '窓は、黒板に向かって'),
            Kit.seg([{ value: 'left', label: '左' }, { value: 'right', label: '右' }], c.window, (v) => { c.window = v; saveCfg(); render(); }, { label: '窓の側' })),
          h('div', { class: 'st-lanes-h' }, h('b', null, '横の列'), h('span', null, '前から')),
          chips('r', c.rows, rowSub, '横の列（前から）'),
          live,
          h('div', { class: 'btn-row' },
            Kit.btn('この列にする', () => saveZone(), { sm: true, icon: 'check' }),
            Kit.btn('やめる', () => { S.zoneEdit = blankZone(); render(); }, { sm: true, kind: 'ghost' })));
      }
      // 座ってよい席の小さな図（いまの図の向き）と、席の数・ほかの条件との重なり
      function zonePreview(s, E) {
        const c = S.cfg, teacher = c.view === 'teacher';
        const fr = c.frontRows;
        const fixed = Object.values(c.fixed).includes(s.id);
        const any = E.cols.length || E.rows.length;
        const clash = s.front && E.rows.length && E.rows.every((r) => r >= fr);
        const rowsOrder = teacher ? range(c.rows).reverse() : range(c.rows);
        const colsOrder = teacher ? range(c.cols).reverse() : range(c.cols);
        const bl = new Set(c.blocked);
        let n = 0;
        const grid = h('div', { class: 'st-zmap-grid', style: '--zc:' + c.cols });
        for (const r of rowsOrder) for (const cc of colsOrder) {
          const none = bl.has(K(r, cc));
          const on = !!any && !none && (!E.cols.length || E.cols.includes(cc)) && (!E.rows.length || E.rows.includes(r)) && (!s.front || clash || r < fr);
          if (on) n++;
          grid.append(h('i', { class: none ? 'none' : on ? 'on' : '' }));
        }
        const winLeft = (c.window === 'left') !== teacher;
        const side = (t) => h('span', { class: 'st-zmap-side' }, t);
        const kokuban = () => [h('span'), h('span', { class: 'st-zmap-board' }, '黒板'), h('span')];
        const map = h('div', { class: 'st-zmap', 'aria-hidden': 'true' },
          teacher ? null : kokuban(), side(winLeft ? '窓' : '廊下'), grid, side(winLeft ? '廊下' : '窓'), teacher ? kokuban() : null);
        const sum = !any ? h('p', { class: 'st-zsum muted' }, '縦の列か横の列を選ぶと、座ってよい席に色がつきます。')
          : n ? h('p', { class: 'st-zsum' }, '座ってよい席：' + n + 'こ' + (teacher ? '（教卓から見た図）' : ''))
            : h('p', { class: 'st-zsum is-bad' }, '座ってよい席がありません（机のない場所です）。');
        const note = fixed ? '固定の席の人です。席替えでは、固定の席が優先されます。'
          : s.front && any ? (clash ? '「前の席」の人です。前から' + fr + '列目までと重ならないので、決めた列を優先します。' : '「前の席」の人なので、前から' + fr + '列目までの中で座ります。')
            : '';
        return [map, sum, note ? h('p', { class: 'st-znote' }, note) : null];
      }
      function saveZone() {
        const E = S.zoneEdit, c = S.cfg;
        if (!E.id) return;
        if (!E.cols.length && !E.rows.length) { Kit.toast('縦の列か横の列を、1つ以上選んでください', { type: 'bad' }); return; }
        c.zones[E.id] = { cols: E.cols.slice(), rows: E.rows.slice() };
        const s = stById().get(E.id);
        S.zoneEdit = blankZone();
        saveCfg(); render();
        Kit.toast((s ? School.label(s) + ' の' : '') + '列を決めました。次の「席替えする」から守ります');
      }

      /* ── 席替え（くじ） ── */
      async function run() {
        if (!S.cls || S.busy) return;
        const c = S.cfg, d = S.draft;
        if (!S.cls.students.length) { Kit.toast('名簿に生徒がいません', { type: 'bad' }); return; }
        if (!d.saved && Object.keys(d.seats).length && d.issues == null && !(await Kit.confirm({ title: 'もう一度くじを引きますか？', body: '手で入れかえた席は、新しいくじの結果で置きかわります。', ok: 'くじを引く' }))) return;
        S.busy = true; runBtn.disabled = true;
        const prev = c.avoidPrev ? latest() : null;
        const seed = School.newSeed();
        const input = {
          rows: c.rows, cols: c.cols, blocked: c.blocked, pairs: c.pairs, students: S.cls.students, fixed: c.fixed, apart: c.apart, zones: c.zones,
          frontRows: c.frontRows, mix: c.mix, emptyBack: c.emptyBack, seed,
          prev: prev ? prev.seats : null, prevRows: prev && prev.rows, prevCols: prev && prev.cols, prevBlocked: prev && prev.blocked, prevPairs: prev && prev.pairs,
        };
        await shuffleShow();
        const res = SeatSolver.solve(input);
        S.busy = false; runBtn.disabled = false;
        if (!alive) return;
        S.draft = { classId: S.cls.id, planId: null, title: '', date: Kit.ymd(), rows: c.rows, cols: c.cols, blocked: c.blocked.slice(), pairs: c.pairs, seats: res.ok ? res.seats : {}, seed, saved: false, issues: res.ok ? res.issues : null, error: res.ok ? null : res.error };
        S.sel = null; S.selStudent = null; S.viewPlanId = null;
        render();
        const g = main.querySelector('.st-grid');
        if (g && !matchMedia('(prefers-reduced-motion: reduce)').matches) for (const el of g.querySelectorAll('.st-seat:not(.is-none)')) el.classList.add('is-new');
        if (res.ok) Kit.toast(res.issues.length ? '席を決めました（守れなかった条件があります）' : '席を決めました。よければ「この席で決定」を押してください');
      }
      // くじの演出：名前を少しのあいだ入れかえて見せる
      function shuffleShow() {
        return new Promise((resolve) => {
          const g = main.querySelector('.st-grid');
          if (!g || matchMedia('(prefers-reduced-motion: reduce)').matches) { setTimeout(resolve, 30); return; }
          const names = S.cls.students.map((s) => (School.hidden() || !s.name ? s.no + '番' : s.name.split(' ')[0]));
          const seats = [...g.querySelectorAll('.st-seat:not(.is-none) .nm')];
          let n = 0;
          const t = setInterval(() => {
            for (const el of seats) el.textContent = names[Math.floor(Math.random() * names.length)];
            if (++n >= 9) { clearInterval(t); resolve(); }
          }, 70);
        });
      }

      async function savePlan() {
        const d = S.draft;
        if (!Object.keys(d.seats).length) return;
        const title = await Kit.ask({ title: '席を保存', label: '名前（あとで見分けるため）', value: d.title || Kit.fmtDate(Kit.ymd(), 'M月D日') + 'の席替え', ok: '保存する' });
        if (title == null) return;
        const it = { id: d.planId || Kit.uid('seat'), classId: S.cls.id, title: title.trim() || '席替え', date: d.planId ? d.date : Kit.ymd(), rows: d.rows, cols: d.cols, blocked: d.blocked, pairs: d.pairs, seats: d.seats, seed: d.seed || null };
        const saved = await Kit.store.put('seatplans', it);
        S.viewPlanId = saved.id;
        S.draft = null;
        await load(); render();
        Kit.toast('席を保存しました。次の席替えでは、この席の「となり」を避けます');
      }
      async function removePlan(id) {
        const ok = await Kit.confirm({ title: 'この保存した席を消しますか？', body: '消すと、次の席替えで「前回のとなり」を避けるときに使われなくなります。', ok: '消す', danger: true });
        if (!ok) return;
        await Kit.store.remove('seatplans', id);
        S.viewPlanId = null; S.draft = null;
        await load(); render();
        Kit.toast('消しました');
      }

      /* ── 発表（1人ずつめくる） ── */
      function show() {
        const d = S.draft;
        if (!Object.keys(d.seats).length) { Kit.toast('先に「席替えする」で席を決めてください', { type: 'bad' }); return; }
        const keys = School.rng().shuffle(Object.keys(d.seats));
        const hidden = new Set(keys);
        let timer = 0, flipKey = null;
        const overlay = h('div', { class: 'st-show', role: 'dialog', 'aria-modal': 'true', 'aria-label': '席の発表' });
        const left = h('span', { class: 'small ink-2 num', 'aria-live': 'polite' });
        const boardBox = h('div', { style: { display: 'contents' } });
        const draw = () => {
          Kit.clear(boardBox);
          boardBox.append(board({ big: true, hiddenSet: hidden, flipKey }));
          left.textContent = hidden.size ? 'のこり ' + hidden.size + '人' : 'ぜんぶ発表しました';
        };
        const next = () => { const k = keys.find((x) => hidden.has(x)); if (!k) { stop(); return; } hidden.delete(k); flipKey = k; draw(); };
        const stop = () => { clearInterval(timer); timer = 0; autoBtn.querySelector('span').textContent = '自動でめくる'; };
        const autoBtn = Kit.btn('自動でめくる', () => { if (timer) { stop(); return; } autoBtn.querySelector('span').textContent = '止める'; timer = setInterval(next, 650); }, { icon: 'play' });
        const close = () => { stop(); overlay.remove(); document.removeEventListener('keydown', onKey, true); };
        const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } else if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') { e.preventDefault(); next(); } };
        overlay.append(h('div', { class: 'st-show-top' },
          h('h2', null, (S.cls.name || '') + ' 新しい席'), left,
          Kit.btn('1人めくる', next, { kind: 'primary', icon: 'right' }), autoBtn,
          Kit.btn('ぜんぶ見せる', () => { stop(); hidden.clear(); flipKey = null; draw(); }, { icon: 'eye' }),
          Kit.btn('閉じる', close, { kind: 'ghost', icon: 'close' })), boardBox);
        overlay.addEventListener('click', (e) => { const b = e.target.closest('[data-k]'); if (b && hidden.has(b.dataset.k)) { hidden.delete(b.dataset.k); flipKey = b.dataset.k; draw(); } });
        document.addEventListener('keydown', onKey, true);
        document.body.append(overlay);
        draw();
        overlay.tabIndex = -1; overlay.focus();
      }

      /* ── 印刷 ── */
      function printDlg() {
        const d = S.draft;
        if (!Object.keys(d.seats).length) { Kit.toast('先に席を決めてください', { type: 'bad' }); return; }
        let which = S.cfg.view;
        const title = h('input', { type: 'text', id: 'st-print-title', value: (S.cls.name || '') + ' 座席表' });
        const date = h('input', { type: 'text', id: 'st-print-date', value: Kit.fmtDate(d.date || Kit.ymd(), 'M月D日(W)') + 'から' });
        Kit.modal({
          title: '座席表を印刷', body: h('div', { class: 'stack' },
            Kit.field({ label: '見出し', input: title }), Kit.field({ label: '日付など', input: date }),
            Kit.field({ label: '図の向き', input: Kit.seg([{ value: 'student', label: '生徒から見た図' }, { value: 'teacher', label: '教卓から見た図' }, { value: 'both', label: '両方（2枚）' }], which, (v) => { which = v; }, { label: '図の向き' }) }),
            h('p', { class: 'small muted' }, 'A4横で印刷します。「前の席」・固定・列の印は、印刷には出ません。' + (School.hidden() ? '「名前を隠す」がオンなので、番号だけで印刷します。' : ''))),
          actions: [{ label: 'やめる', kind: 'ghost' }, { label: '印刷する', kind: 'primary', onClick: () => { doPrint(which, title.value, date.value); } }],
        });
      }
      function doPrint(which, title, sub) {
        const d = S.draft, st = stById();
        const blocked = new Set(d.blocked || []);
        const n = d.cols;
        const pw = Math.min(40, Math.floor((260 - (n - 1) * 3) / n)) + 'mm', ph = d.rows > 7 ? '15mm' : '19mm', pf = n > 7 ? '11pt' : '14pt';
        const page = (view) => {
          const rowsOrder = view === 'teacher' ? range(d.rows).reverse() : range(d.rows);
          const colsOrder = view === 'teacher' ? range(d.cols).reverse() : range(d.cols);
          const table = h('table', { style: '--pw:' + pw + ';--ph:' + ph + ';--pf:' + pf });
          for (const r of rowsOrder) {
            const tr = h('tr');
            colsOrder.forEach((c, i) => {
              const k = K(r, c), id = d.seats[k], s = id ? st.get(id) : null;
              if (blocked.has(k)) tr.append(h('td', { class: 'none' }));
              else if (!s) tr.append(h('td', { class: 'empty' }, h('span', { class: 'nm' }, '')));
              else tr.append(h('td', null, School.hidden() || !s.name ? h('span', { class: 'nm' }, s.no + '番') : [h('span', { class: 'no' }, s.no), h('span', { class: 'nm' }, s.name)]));
              if (d.pairs && i < colsOrder.length - 1 && (view === 'teacher' ? c % 2 === 0 : c % 2 === 1)) tr.append(h('td', { class: 'aisle' }));
            });
            table.append(tr);
          }
          const front = h('div', { class: 'front' }, h('span', null, '黒　板'), h('span', { class: 'k' }, '教卓'));
          return h('div', { class: 'pg' }, h('h1', null, title), h('div', { class: 'sub' }, [sub, view === 'teacher' ? '（教卓から見た図）' : '（生徒から見た図）'].filter(Boolean).join('　')),
            view === 'teacher' ? [table, front] : [front, table]);
        };
        School.print({ landscape: true, build: () => h('div', { class: 'st-print' }, which === 'both' ? [page('student'), page('teacher')] : page(which)) });
      }

      await load();
      await render();
      const reload = Kit.debounce(async () => { if (!alive || S.busy) return; await load(); render(); }, 150);
      const offs = [Kit.store.on('coll:classes', reload), School.onClassChange(async () => { S.draft = null; S.viewPlanId = null; await load(); render(); })];
      const onMq = () => render();
      mq.addEventListener('change', onMq);
      return () => { alive = false; offs.forEach((f) => f()); reload.cancel(); saveCfg.flush(); mq.removeEventListener('change', onMq); };
    },
  });
})();

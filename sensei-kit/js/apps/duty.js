// 当番表：班をつくって、掃除の分担（回転盤も）・給食当番・日直を、週ごとに回す
(function () {
  'use strict';
  const { h } = Kit;
  const D = window.Duty;
  const TABS = [{ id: 'groups', label: '班' }, { id: 'clean', label: '掃除' }, { id: 'lunch', label: '給食' }, { id: 'nicchoku', label: '日直' }];
  const AREAS = ['教室（前）', '教室（後ろ）', '廊下', '階段', 'トイレ', '特別教室'];
  const ROLES = ['おかず', '汁物', 'ごはん・パン', '牛乳', '食器', '配膳台・おぼん'];
  const md = (s) => Kit.fmtDate(s, 'M/D');
  const mdw = (s) => Kit.fmtDate(s, 'M/D(W)');
  const thisMonday = () => D.mondayOf(Kit.ymd());

  const normGroups = (g, cls) => {
    const o = Object.assign({ n: 6, names: [], of: {} }, g || {});
    o.n = Kit.clamp(o.n | 0 || 6, 1, 12);
    o.names = Array.from({ length: o.n }, (_, i) => String((o.names || [])[i] || (i + 1) + '班'));
    if (cls) { const ids = new Set(cls.students.map((s) => s.id)); for (const k of Object.keys(o.of)) if (!ids.has(k) || o.of[k] >= o.n) delete o.of[k]; }
    return o;
  };
  const normDuty = (d) => {
    const o = Object.assign({}, d || {});
    o.clean = Object.assign({ areas: AREAS.slice(), start: thisMonday(), every: 1, count: 12, skip: [] }, o.clean || {});
    o.lunch = Object.assign({ mode: 'group', size: 8, roles: ROLES.slice(), start: thisMonday(), every: 1, count: 12, skip: [] }, o.lunch || {});
    o.nicchoku = Object.assign({ per: 2, start: Kit.ymd(), days: 40, startIndex: 0, skip: [] }, o.nicchoku || {});
    return o;
  };

  // サンプル（架空のクラス）：番号順に6班
  const SC = School.SAMPLE_CLASS;
  const sg = D.makeGroups(SC.students, 6, 'number');
  Kit.store.sample('groups', [{ id: 'grp-' + SC.id, classId: SC.id, n: 6, names: ['1班', '2班', '3班', '4班', '5班', '6班'], of: sg.of }]);
  Kit.store.sample('duties', [Object.assign(normDuty(null), { id: 'duty-' + SC.id, classId: SC.id })]);
  School.classes.onRemove(School.removeByClass('groups'));
  School.classes.onRemove(School.removeByClass('duties'));

  Kit.css('duty', `
.dt-tabs{margin-bottom:14px}
.dt-split{display:grid;gap:16px;grid-template-columns:1fr}
@media (min-width:1050px){.dt-split{grid-template-columns:minmax(0,1fr) 340px;align-items:start}}
.dt-groups{display:grid;gap:10px;grid-template-columns:repeat(auto-fill,minmax(min(100%,210px),1fr))}
.dt-g{display:grid;gap:6px;align-content:start;padding:10px 12px;border:1px solid var(--line);border-radius:var(--r);background:var(--surface);min-height:90px}
.dt-g.can-drop{border-color:var(--shu);box-shadow:0 0 0 2px color-mix(in srgb,var(--shu) 25%,transparent);cursor:pointer}
.dt-g-h{display:flex;align-items:center;gap:6px}
.dt-g-h input{font-weight:700;min-height:32px;padding:3px 8px;width:8em}
.dt-g-h .n{margin-left:auto;font-size:12.5px;color:var(--ink-3)}
.dt-mem{display:flex;flex-wrap:wrap;gap:4px}
.dt-mem .chip{cursor:pointer;border:1px solid var(--line);font-size:13px;min-height:28px}
.dt-mem .chip[aria-pressed="true"]{background:var(--shu);color:var(--on-shu);border-color:var(--shu)}
.dt-now{display:grid;gap:8px;padding:14px;border-radius:var(--r);border:1px solid var(--line);background:color-mix(in srgb,var(--gosu-wash) 55%,var(--surface));margin-bottom:14px}
.dt-now h2{font-size:16px;font-weight:700;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.dt-now-list{display:grid;gap:6px;grid-template-columns:repeat(auto-fill,minmax(min(100%,230px),1fr))}
.dt-now-it{display:grid;gap:1px;padding:8px 10px;border-radius:8px;background:var(--surface);border:1px solid var(--line)}
.dt-now-it b{font-size:15px}
.dt-now-it span{font-size:12.5px;color:var(--ink-2)}
.dt-set{display:grid;gap:12px}
.dt-set h3{font-size:14px;font-weight:700}
.dt-items{display:grid;gap:6px}
.dt-item{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px;align-items:center}
.dt-item input{min-height:34px;padding:4px 8px}
.dt-row{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center}
.dt-row input[type=date]{width:auto}
.dt-row input[type=number]{width:5em}
.dt-skips{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.dt-tbl td.k,.dt-tbl th.k{white-space:nowrap}
.dt-tbl tr.is-now td{background:color-mix(in srgb,var(--gosu-wash) 70%,var(--surface))}
.dt-tbl tr.is-skip td{color:var(--ink-3);background:var(--surface-2)}
.dt-tbl td{font-size:13.5px}
.dt-nk{display:grid;gap:4px}
.dt-nk-row{display:grid;grid-template-columns:96px minmax(0,1fr);gap:10px;align-items:center;padding:6px 10px;border-radius:8px;background:var(--surface);border:1px solid var(--line);font-size:14px}
.dt-nk-row.is-today{border-color:var(--gosu);background:var(--gosu-wash);font-weight:700}
.dt-nk-row.wk{margin-top:8px}
.dt-nk-row .d{font-variant-numeric:tabular-nums}
@media (max-width:640px){.dt-g-h input{width:6.5em}}
/* 印刷 */
.dt-print{color:#000;font-family:var(--font-body)}
.dt-print h1{font-size:18pt;margin:0 0 2mm;font-family:var(--font-display)}
.dt-print .sub{font-size:10pt;margin-bottom:4mm}
.dt-print table{width:100%;border-collapse:collapse;font-size:10.5pt}
.dt-print th,.dt-print td{border:1pt solid #000;padding:1.6mm 2mm;text-align:center;vertical-align:middle}
.dt-print th{background:#eee}
.dt-print td.l{text-align:left}
.dt-print .legend{margin-top:4mm;font-size:9.5pt;columns:2;column-gap:8mm}
.dt-print .legend div{break-inside:avoid;margin-bottom:1mm}
.dt-print .big{display:grid;grid-template-columns:1fr 1fr;gap:4mm;margin-top:4mm}
.dt-print .big div{border:1.5pt solid #000;border-radius:3mm;padding:4mm;text-align:center}
.dt-print .big b{display:block;font-size:14pt;margin-bottom:1mm}
.dt-print .big span{font-size:22pt;font-weight:700}
.dt-print .wheel{display:flex;flex-direction:column;align-items:center;gap:6mm}
.dt-print .wheel svg{display:block}
.dt-print .note{font-size:9pt;margin-top:2mm}
`);

  Kit.app({
    id: 'duty', title: '当番表', group: 'class', icon: 'refresh', order: 35,
    desc: '班をつくって、掃除の分担・給食当番・日直を週ごとに回す。回転盤も印刷できる',
    colls: ['groups', 'duties'],
    async mount(root, params) {
      const S = { cls: null, g: null, d: null, tab: (params && params.tab) || Kit.pref.get('duty:tab', 'groups'), sel: null, plan: null };
      if (!TABS.some((t) => t.id === S.tab)) S.tab = 'groups';
      let alive = true;
      const classSlot = h('div'), sampleSlot = h('div'), tabsBox = h('div', { class: 'dt-tabs' }), main = h('div');
      root.append(Kit.appHead({
        title: '当番表',
        desc: '班をつくって、掃除・給食・日直を週ごとに回します。',
      }), classSlot, sampleSlot, tabsBox, main);

      async function load() {
        S.cls = await School.classes.current();
        if (!S.cls) return;
        const gs = await Kit.store.list('groups'), ds = await Kit.store.list('duties');
        const g = gs.find((x) => x.classId === S.cls.id), d = ds.find((x) => x.classId === S.cls.id);
        S.g = Object.assign(normGroups(g, S.cls), { id: 'grp-' + S.cls.id, classId: S.cls.id, sample: !!(g && g.sample) });
        S.d = Object.assign(normDuty(d), { id: 'duty-' + S.cls.id, classId: S.cls.id, sample: !!(d && d.sample) });
        const plans = (await Kit.store.list('seatplans')).filter((p) => p.classId === S.cls.id).sort((a, b) => String(b.date).localeCompare(String(a.date)));
        S.plan = plans[0] || null;
      }
      const saveG = Kit.debounce(() => { if (S.g) { const it = Kit.clone(S.g); delete it.sample; Kit.store.put('groups', it); } }, 300);
      const saveD = Kit.debounce(() => { if (S.d) { const it = Kit.clone(S.d); delete it.sample; Kit.store.put('duties', it); } }, 300);
      const stMap = () => new Map(S.cls.students.map((s) => [s.id, s]));
      const members = () => D.membersOf(S.cls.students, S.g.of, S.g.n);
      const nameOf = (id) => { const s = stMap().get(id); return s ? School.label(s) : ''; };
      const short = (id) => { const s = stMap().get(id); return s ? School.label(s, { short: true }) : ''; };

      async function render() {
        Kit.clear(classSlot); Kit.clear(sampleSlot); Kit.clear(tabsBox); Kit.clear(main);
        classSlot.append(await School.classBar({ onChange: async () => { S.sel = null; await load(); render(); } }));
        if (!S.cls) { main.append(Kit.empty({ title: '当番表には名簿が要ります', body: '名簿にクラスを入れると、ここで班と当番を決められます。', actions: [Kit.btn('名簿を開く', () => Kit.go('roster'), { kind: 'primary', icon: 'users' })] })); return; }
        if (S.g.sample || S.d.sample) sampleSlot.append(Kit.sampleBar('架空のクラスの班と当番です。班のつくり方や、掃除の場所を変えて試せます。'));
        tabsBox.append(h('div', { class: 'tabs', role: 'tablist' }, TABS.map((t) => h('button', { type: 'button', role: 'tab', 'aria-selected': String(S.tab === t.id), onclick: () => { S.tab = t.id; Kit.pref.set('duty:tab', t.id); S.sel = null; render(); } }, t.label))));
        main.append({ groups: groupsTab, clean: cleanTab, lunch: lunchTab, nicchoku: nicchokuTab }[S.tab]());
      }

      /* ── 班 ── */
      function groupsTab() {
        const g = S.g, mem = members(), st = stMap();
        const none = S.cls.students.filter((s) => g.of[s.id] == null);
        const nIn = h('input', { type: 'number', id: 'dt-n', min: 1, max: 12, value: g.n, style: { width: '5em' } });
        nIn.addEventListener('change', () => { g.n = Kit.clamp(parseInt(nIn.value, 10) || g.n, 1, 12); Object.assign(g, normGroups(g, S.cls)); saveG(); render(); });
        const make = (method, o) => {
          const r = D.makeGroups(S.cls.students, g.n, method, Object.assign({ seed: School.newSeed() }, o || {}));
          g.of = r.of; saveG(); render();
          Kit.toast('班をつくりました（' + r.sizes.join('・') + '人）');
        };
        const mix = h('input', { type: 'checkbox', id: 'dt-mix', checked: true });
        const box = h('div', { class: 'stack' },
          h('section', { class: 'card stack' },
            h('div', { class: 'dt-row' }, h('label', { for: 'dt-n', class: 'ink-2' }, '班の数'), nIn,
              h('span', { class: 'small muted' }, S.cls.students.length + '人を ' + g.n + 'つの班に（1班 ' + Math.floor(S.cls.students.length / g.n) + '〜' + Math.ceil(S.cls.students.length / g.n) + '人）')),
            h('div', { class: 'dt-row' }, h('span', { class: 'ink-2 small' }, 'つくり方'),
              Kit.btn('番号順', () => make('number'), { sm: true, icon: 'users' }),
              Kit.btn('席の近い人で', () => { if (!S.plan) { Kit.toast('保存した席がありません。席替えで席を保存すると使えます', { type: 'bad' }); return; } make('seat', { seats: S.plan.seats, pairs: S.plan.pairs }); }, { sm: true, icon: 'seats', disabled: !S.plan, title: S.plan ? '保存した席（' + (S.plan.title || '') + '）の、前後左右の近い人で' : '席替えで席を保存すると使えます' }),
              Kit.btn('くじ', () => make('random', { mix: mix.checked }), { sm: true, icon: 'shuffle' }),
              h('label', { class: 'check small', for: 'dt-mix' }, mix, '男女をまぜる')),
            h('p', { class: 'small muted' }, '名前を押してから、ほかの班のカードを押すと移ります。班の名前（1班・A班など）はカードで変えられます。')),
          none.length ? h('div', { class: 'dt-mem rl-tray', style: { padding: '10px', border: '1px dashed var(--line-strong)', borderRadius: 'var(--r)' } }, h('b', { class: 'small' }, '班がまだない人：'), none.map((s) => chip(s.id))) : null,
          h('div', { class: 'dt-groups' }, mem.map((ids, gi) => {
            const can = S.sel && g.of[S.sel] !== gi;
            const name = h('input', { type: 'text', value: g.names[gi], maxlength: 12, 'aria-label': (gi + 1) + 'つ目の班の名前' });
            name.addEventListener('click', (e) => e.stopPropagation());
            name.addEventListener('input', () => { g.names[gi] = name.value.trim() || (gi + 1) + '班'; saveG(); });
            const card = h('div', { class: 'dt-g' + (can ? ' can-drop' : ''), role: can ? 'button' : null, tabindex: can ? 0 : null, 'aria-label': can ? g.names[gi] + 'に移す' : null },
              h('div', { class: 'dt-g-h' }, name, h('span', { class: 'n' }, ids.length + '人')),
              h('div', { class: 'dt-mem' }, ids.map((id) => chip(id))));
            if (can) { const go = () => { g.of[S.sel] = gi; S.sel = null; saveG(); render(); }; card.addEventListener('click', go); card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } }); }
            return card;
          })));
        function chip(id) { const s = st.get(id); return h('button', { type: 'button', class: 'chip', 'aria-pressed': String(S.sel === id), onclick: (e) => { e.stopPropagation(); S.sel = S.sel === id ? null : id; render(); } }, School.label(s)); }
        return box;
      }

      /* ── 設定の小物（場所・役割の一覧、期間） ── */
      function itemsEditor(list, label, placeholder, onChange) {
        const box = h('div', { class: 'dt-items' });
        list.forEach((v, i) => {
          const inp = h('input', { type: 'text', value: v, maxlength: 20, 'aria-label': label + (i + 1) });
          inp.addEventListener('input', () => { list[i] = inp.value; onChange(false); });
          inp.addEventListener('change', () => onChange(true));
          box.append(h('div', { class: 'dt-item' }, inp, h('span', { class: 'rl-ops', style: { display: 'inline-flex' } },
            Kit.btn('', () => { if (i > 0) { [list[i - 1], list[i]] = [list[i], list[i - 1]]; onChange(true); } }, { icon: 'up', sm: true, kind: 'ghost', title: '上へ', disabled: i === 0 }),
            Kit.btn('', () => { list.splice(i, 1); onChange(true); }, { icon: 'trash', sm: true, kind: 'ghost', title: v + 'を消す' }))));
        });
        box.append(h('div', null, Kit.btn(label + 'を足す', () => { list.push(placeholder); onChange(true); }, { sm: true, icon: 'plus', kind: 'ghost' })));
        return box;
      }
      function periodEditor(cfg, prefix) {
        const start = h('input', { type: 'date', id: prefix + '-start', value: cfg.start });
        start.addEventListener('change', () => { if (start.value) { cfg.start = start.value; saveD(); render(); } });
        const count = h('input', { type: 'number', id: prefix + '-count', min: 1, max: 60, value: cfg.count });
        count.addEventListener('change', () => { cfg.count = Kit.clamp(parseInt(count.value, 10) || 12, 1, 60); saveD(); render(); });
        const skipIn = h('input', { type: 'date', id: prefix + '-skip', 'aria-label': 'お休みにする週（その週のどの日でも）' });
        return h('div', { class: 'stack tight' },
          h('div', { class: 'dt-row' }, h('label', { for: prefix + '-start', class: 'small ink-2' }, 'はじめる週'), start),
          h('div', { class: 'dt-row' }, h('span', { class: 'small ink-2' }, '交代'), Kit.seg([{ value: 1, label: '1週ごと' }, { value: 2, label: '2週ごと' }], cfg.every, (v) => { cfg.every = +v; saveD(); render(); }, { label: '交代' }),
            h('span', { class: 'dt-row' }, h('label', { for: prefix + '-count', class: 'small ink-2' }, '回数'), count)),
          h('div', { class: 'dt-row' }, h('label', { for: prefix + '-skip', class: 'small ink-2' }, 'お休みの週'), skipIn,
            Kit.btn('足す', () => { if (!skipIn.value) return; const m = D.mondayOf(skipIn.value); if (!cfg.skip.includes(m)) cfg.skip.push(m); cfg.skip.sort(); saveD(); render(); }, { sm: true, icon: 'plus' })),
          cfg.skip.length ? h('div', { class: 'dt-skips' }, cfg.skip.map((w) => h('span', { class: 'chip line' }, md(w) + 'の週', h('button', { type: 'button', class: 'linklike', style: { border: 0, background: 'transparent', cursor: 'pointer', color: 'var(--ink-3)' }, 'aria-label': md(w) + 'の週のお休みを外す', onclick: () => { cfg.skip = cfg.skip.filter((x) => x !== w); saveD(); render(); } }, '×')))) : h('p', { class: 'small muted' }, '夏休み・テスト週間など、当番をしない週を入れると、番を進めずにとばします。'));
      }
      const nowRow = (list) => D.periodOf(list, Kit.ymd());
      const range = (p) => md(p.from) + '〜' + md(p.to);

      /* ── 掃除 ── */
      function cleanTab() {
        const c = S.d.clean, g = S.g, mem = members();
        const areas = c.areas.map((a) => a.trim()).filter(Boolean);
        const sched = D.cleaning({ groups: g.n, areas, start: c.start, count: c.count, every: c.every, skip: c.skip });
        const now = nowRow(sched);
        const left = h('div', { class: 'stack' });
        if (now && !now.skip) {
          left.append(h('section', { class: 'dt-now', 'aria-label': '今週の掃除' }, h('h2', null, Kit.icon('calendar', 18), '今週の掃除', h('span', { class: 'chip' }, range(now))),
            h('div', { class: 'dt-now-list' }, areas.map((a, i) => { const gi = now.byArea[i]; return h('div', { class: 'dt-now-it' }, h('b', null, a + '：' + (gi >= 0 ? g.names[gi] : 'なし')), gi >= 0 ? h('span', null, mem[gi].map(short).join('・')) : null); })),
            now.rest.length ? h('p', { class: 'small ink-2' }, 'お休み：' + now.rest.map((x) => g.names[x]).join('・')) : null));
        } else if (now && now.skip) left.append(h('p', { class: 'dt-now small' }, '今週は掃除の当番がお休みの週です。'));
        if (g.n !== areas.length) left.append(h('p', { class: 'small', style: { color: 'var(--warn)' } }, g.n > areas.length ? '班（' + g.n + '）が場所（' + areas.length + '）より多いので、毎週 ' + (g.n - areas.length) + 'つの班がお休みになります。' : '場所（' + areas.length + '）が班（' + g.n + '）より多いので、毎週 ' + (areas.length - g.n) + 'か所の担当がいません。'));
        left.append(h('div', { class: 'btn-row' },
          Kit.btn('分担表を印刷', () => printClean(sched, areas), { kind: 'primary', icon: 'printer' }),
          Kit.btn('回転盤を印刷（切って使う）', () => printWheel(areas), { icon: 'printer' }),
          Kit.btn('Excel 用にコピー', () => Kit.copy(School.tsv([['期間'].concat(areas, ['お休み'])].concat(sched.map((p) => [range(p)].concat(p.skip ? areas.map(() => 'お休み') : p.byArea.map((x) => (x >= 0 ? g.names[x] : '')), [p.skip ? '' : p.rest.map((x) => g.names[x]).join('・')])))), '分担表をコピーしました'), { icon: 'copy', kind: 'ghost' })));
        left.append(h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl dt-tbl' },
          h('thead', null, h('tr', null, h('th', { class: 'k' }, '期間'), areas.map((a) => h('th', null, a)), h('th', null, 'お休み'))),
          h('tbody', null, sched.map((p) => h('tr', { class: (p === now ? 'is-now' : '') + (p.skip ? ' is-skip' : '') }, h('td', { class: 'k' }, range(p)),
            p.skip ? h('td', { colspan: areas.length + 1 }, 'お休みの週') : [areas.map((a, i) => h('td', null, p.byArea[i] >= 0 ? g.names[p.byArea[i]] : '—')), h('td', null, p.rest.map((x) => g.names[x]).join('・'))]))))));
        const right = h('section', { class: 'card dt-set', 'aria-label': '掃除の設定' },
          h('h3', null, '掃除の場所'), itemsEditor(c.areas, '場所', '新しい場所', (re) => { saveD(); if (re) render(); }),
          h('h3', null, '期間'), periodEditor(c, 'dt-c'));
        return h('div', { class: 'dt-split' }, left, right);
      }

      /* ── 給食 ── */
      function lunchTab() {
        const L = S.d.lunch, g = S.g, mem = members();
        const roles = L.roles.map((r) => r.trim()).filter(Boolean);
        const ids = S.cls.students.map((s) => s.id);
        const sched = D.lunch({ mode: L.mode, groups: g.n, members: mem, students: ids, size: L.size, roles, start: L.start, count: L.count, every: L.every, skip: L.skip });
        const now = nowRow(sched);
        const teamName = (p) => (p.skip ? 'お休み' : L.mode === 'number' ? p.team.length ? nameOf(p.team[0]).split(' ')[0] + '〜' + nameOf(p.team[p.team.length - 1]).split(' ')[0] : '' : g.names[p.group]);
        const left = h('div', { class: 'stack' });
        if (now && !now.skip) {
          left.append(h('section', { class: 'dt-now', 'aria-label': '今週の給食当番' }, h('h2', null, Kit.icon('users', 18), '今週の給食当番：' + teamName(now), h('span', { class: 'chip' }, range(now))),
            h('div', { class: 'dt-now-list' }, now.assign.map((a) => h('div', { class: 'dt-now-it' }, h('b', null, a.role), h('span', null, a.id ? nameOf(a.id) : '—')))),
            now.extra.length ? h('p', { class: 'small ink-2' }, 'おてつだい：' + now.extra.map(nameOf).join('・')) : null));
        } else if (now && now.skip) left.append(h('p', { class: 'dt-now small' }, '今週は給食当番がお休みの週です。'));
        left.append(h('div', { class: 'btn-row' },
          Kit.btn('今週のカードを印刷', () => printLunchCard(now, teamName), { kind: 'primary', icon: 'printer', disabled: !now || now.skip }),
          Kit.btn('当番表を印刷', () => printLunch(sched, roles, teamName), { icon: 'printer' })));
        left.append(h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl dt-tbl' },
          h('thead', null, h('tr', null, h('th', { class: 'k' }, '期間'), h('th', null, '当番'), roles.map((r) => h('th', null, r)))),
          h('tbody', null, sched.map((p) => h('tr', { class: (p === now ? 'is-now' : '') + (p.skip ? ' is-skip' : '') }, h('td', { class: 'k' }, range(p)), h('td', null, teamName(p)),
            p.skip ? h('td', { colspan: roles.length }, 'お休みの週') : p.assign.map((a) => h('td', null, a.id ? short(a.id) : '—'))))))));
        const sizeIn = h('input', { type: 'number', id: 'dt-l-size', min: 1, max: 20, value: L.size, style: { width: '5em' } });
        sizeIn.addEventListener('change', () => { L.size = Kit.clamp(parseInt(sizeIn.value, 10) || 8, 1, 20); saveD(); render(); });
        const right = h('section', { class: 'card dt-set', 'aria-label': '給食当番の設定' },
          h('h3', null, '当番のまわし方'),
          Kit.seg([{ value: 'group', label: '班ごと' }, { value: 'number', label: '番号順に区切る' }], L.mode, (v) => { L.mode = v; saveD(); render(); }, { label: '当番のまわし方' }),
          L.mode === 'number' ? h('div', { class: 'dt-row' }, h('label', { for: 'dt-l-size', class: 'small ink-2' }, '1回の人数'), sizeIn) : h('p', { class: 'small muted' }, '1つの班が当番をして、次の週は次の班へ。班が2回目のときは、役割を1つずらします。'),
          h('h3', null, '仕事（役割）'), itemsEditor(L.roles, '仕事', '新しい仕事', (re) => { saveD(); if (re) render(); }),
          h('h3', null, '期間'), periodEditor(L, 'dt-l'));
        return h('div', { class: 'dt-split' }, left, right);
      }

      /* ── 日直 ── */
      function nicchokuTab() {
        const N = S.d.nicchoku, st = S.cls.students;
        const list = D.nicchoku({ students: st.map((s) => s.id), per: N.per, start: N.start, days: N.days, isOff: School.isOff, skip: N.skip, startIndex: N.startIndex });
        const t = Kit.ymd();
        const box = h('div', { class: 'dt-nk' });
        let lastWeek = '';
        for (const it of list) {
          const wk = D.mondayOf(it.date);
          box.append(h('div', { class: 'dt-nk-row' + (it.date === t ? ' is-today' : '') + (wk !== lastWeek && lastWeek ? ' wk' : '') }, h('span', { class: 'd' }, mdw(it.date)), h('span', null, it.ids.map(nameOf).join('・'))));
          lastWeek = wk;
        }
        const start = h('input', { type: 'date', id: 'dt-n-start', value: N.start });
        start.addEventListener('change', () => { if (start.value) { N.start = start.value; saveD(); render(); } });
        const who = h('select', { id: 'dt-n-who', style: { width: 'auto' } }, st.map((s, i) => h('option', { value: i }, School.label(s))));
        who.value = String(Kit.clamp(N.startIndex | 0, 0, Math.max(0, st.length - 1)));
        who.addEventListener('change', () => { N.startIndex = +who.value; saveD(); render(); });
        const days = h('input', { type: 'number', id: 'dt-n-days', min: 5, max: 200, value: N.days });
        days.addEventListener('change', () => { N.days = Kit.clamp(parseInt(days.value, 10) || 40, 5, 200); saveD(); render(); });
        const skipIn = h('input', { type: 'date', id: 'dt-n-skip' });
        const right = h('section', { class: 'card dt-set', 'aria-label': '日直の設定' },
          h('h3', null, '1日の人数'), Kit.seg([1, 2, 3].map((n) => ({ value: n, label: n + '人' })), N.per, (v) => { N.per = +v; saveD(); render(); }, { label: '1日の人数' }),
          h('div', { class: 'dt-row' }, h('label', { for: 'dt-n-start', class: 'small ink-2' }, 'はじめる日'), start),
          h('div', { class: 'dt-row' }, h('label', { for: 'dt-n-who', class: 'small ink-2' }, 'はじめの人'), who),
          h('div', { class: 'dt-row' }, h('label', { for: 'dt-n-days', class: 'small ink-2' }, '何日ぶん'), days),
          h('div', { class: 'dt-row' }, h('label', { for: 'dt-n-skip', class: 'small ink-2' }, '授業のない日'), skipIn, Kit.btn('足す', () => { if (skipIn.value && !N.skip.includes(skipIn.value)) { N.skip.push(skipIn.value); N.skip.sort(); saveD(); render(); } }, { sm: true, icon: 'plus' })),
          N.skip.length ? h('div', { class: 'dt-skips' }, N.skip.map((d) => h('span', { class: 'chip line' }, mdw(d), h('button', { type: 'button', style: { border: 0, background: 'transparent', cursor: 'pointer', color: 'var(--ink-3)' }, 'aria-label': mdw(d) + 'を外す', onclick: () => { N.skip = N.skip.filter((x) => x !== d); saveD(); render(); } }, '×')))) : null,
          h('p', { class: 'small muted' }, '土日と祝日は、自動でとばします。行事の代休・振替などは「授業のない日」に足してください。'));
        const left = h('div', { class: 'stack' },
          h('div', { class: 'btn-row' }, Kit.btn('日直表を印刷', () => printNicchoku(list), { kind: 'primary', icon: 'printer' }), Kit.btn('Excel 用にコピー', () => Kit.copy(School.tsv([['日付', '日直']].concat(list.map((x) => [mdw(x.date), x.ids.map(nameOf).join('・')]))), '日直表をコピーしました'), { icon: 'copy', kind: 'ghost' })),
          box);
        return h('div', { class: 'dt-split' }, left, right);
      }

      /* ── 印刷 ── */
      async function head(title) { const p = await Kit.profile.get(); return [h('h1', null, (S.cls.name || '') + '　' + title), h('div', { class: 'sub' }, [p.school && !p._sample ? p.school : '', p.year + '年度'].filter(Boolean).join('　'))]; }
      const legend = () => h('div', { class: 'legend' }, members().map((ids, gi) => h('div', null, h('b', null, S.g.names[gi] + '：'), ids.map(nameOf).join('・'))));
      async function printClean(sched, areas) {
        const hd = await head('掃除の分担表');
        School.print({ landscape: areas.length > 5, build: () => h('div', { class: 'dt-print' }, hd,
          h('table', null, h('thead', null, h('tr', null, h('th', null, '期間'), areas.map((a) => h('th', null, a)), h('th', null, 'お休み'))),
            h('tbody', null, sched.map((p) => h('tr', null, h('td', null, range(p)), p.skip ? h('td', { colspan: areas.length + 1 }, 'お休みの週') : [areas.map((a, i) => h('td', null, p.byArea[i] >= 0 ? S.g.names[p.byArea[i]] : '—')), h('td', null, p.rest.map((x) => S.g.names[x]).join('・'))])))),
          legend()) });
      }
      /* 回転盤：外の円のふちに場所、内の円に班（とメンバー）。内の円を時計まわりに1つ回すと、次の週の分担になる。
         文字は、その区切りが上に来たときにまっすぐ読める向き。メンバーの名前は、日本語の縦書きのように1字ずつ中心へ向けて並べる */
      function wheelSvg(labels, rOut, o) {
        const SV = Kit.svg, n = labels.length, pad = 2, cx = rOut + pad, cy = rOut + pad, size = (rOut + pad) * 2;
        const svg = SV('svg', { width: size + 'mm', height: size + 'mm', viewBox: '0 0 ' + size + ' ' + size });
        const ang = (i) => (-90 + (360 / n) * i) * Math.PI / 180;
        const at = (r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
        const text = (s, r, a, fs, bold) => {
          const [x, y] = at(r, a);
          const t = SV('text', { x, y, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': fs, 'font-weight': bold ? 700 : 400, transform: 'rotate(' + ((a * 180 / Math.PI) + 90) + ' ' + x + ' ' + y + ')' });
          t.textContent = s;
          svg.append(t);
        };
        svg.append(SV('circle', { cx, cy, r: rOut, fill: 'none', stroke: '#000', 'stroke-width': 0.6 }));
        if (o.ring) svg.append(SV('circle', { cx, cy, r: o.ring, fill: 'none', stroke: '#000', 'stroke-width': 0.35, 'stroke-dasharray': '1.5 1.2' }));
        const r0 = o.ring || 0, arc = (r) => (2 * Math.PI * r) / n;
        for (let i = 0; i < n; i++) {
          const [x1, y1] = at(r0, ang(i)), [x2, y2] = at(rOut, ang(i));
          svg.append(SV('line', { x1, y1, x2, y2, stroke: '#000', 'stroke-width': 0.4 }));
          const mid = ang(i + 0.5), lab = String(labels[i] || '');
          // 見出し（場所・班の名前）：ふちの近くに、区切りの幅に合う大きさで
          const rl = o.ring ? (o.ring + rOut) / 2 : rOut * 0.84;
          text(lab, rl, mid, Math.max(3.2, Math.min(o.ring ? 7 : 6.5, (arc(rl) * 0.8) / Math.max(2, lab.length))), true);
          const names = (o.names && o.names[i]) || [];
          if (!names.length) continue;
          // メンバー：区切りの中に、縦書きの列を右から並べる（1字ずつ、外から中心へ）
          const fs = Math.min(3.8, Math.max(2.6, (arc(rOut * 0.66) * 0.8) / (names.length + 0.5)));
          const cut = Math.floor((rOut * 0.52) / fs), longest = Math.min(cut, Math.max(...names.map((nm) => Array.from(String(nm)).length)));
          const rTop = rOut * 0.68 - fs * 0.55, rLast = Math.max(fs * 2, rTop - (longest - 1) * fs * 1.02);
          const step = Math.min(((2 * Math.PI) / n) * 0.8 / names.length, (fs * 1.15) / rLast);
          names.forEach((nm, j) => {
            const a = mid + ((names.length - 1) / 2 - j) * step;
            Array.from(String(nm)).slice(0, cut).forEach((ch, k) => text(ch, rTop - k * fs * 1.02, a, fs, false));
          });
        }
        svg.append(SV('circle', { cx, cy, r: 1.2, fill: '#000' }));
        return svg;
      }
      async function printWheel(areas) {
        const g = S.g, M = Math.max(g.n, areas.length);
        const outer = Array.from({ length: M }, (_, i) => (i < areas.length ? areas[i] : 'お休み'));
        const mem = members();
        const inner = Array.from({ length: M }, (_, i) => (i < g.n ? g.names[i] : '—'));
        const surname = (id) => { const s = stMap().get(id); return !s ? '' : School.hidden() ? s.no + '番' : School.label(s, { short: true }); };
        const names = Array.from({ length: M }, (_, i) => (i < g.n ? mem[i].map(surname) : []));
        const hd = await head('掃除の回転盤');
        School.print({ landscape: false, margin: '8mm', build: () => h('div', { class: 'dt-print' }, hd,
          h('div', { class: 'wheel' }, wheelSvg(outer, 92, { ring: 64 }),
            h('p', { class: 'note' }, '① 外の円（場所）と内の円（班）を、それぞれ線にそって切りぬきます。② 内の円を上に重ねて、まん中を割りピンでとめます。③ 1週ごとに、内の円を時計まわりに1つ回すと、次の週の分担になります（この道具の表と同じ順です）。')),
          h('div', { class: 'wheel', style: { breakBefore: 'page' } }, h('div', { class: 'sub' }, (S.cls.name || '') + '　掃除の回転盤（内の円）'), wheelSvg(inner, 62, { names }),
            h('div', { class: 'legend', style: { alignSelf: 'stretch' } }, mem.map((ids, gi) => h('div', null, h('b', null, g.names[gi] + '：'), ids.map(nameOf).join('・')))))) });
      }
      async function printLunchCard(now, teamName) {
        if (!now || now.skip) return;
        const hd = await head('今週の給食当番');
        School.print({ landscape: true, build: () => h('div', { class: 'dt-print' }, hd, h('div', { class: 'sub' }, range(now) + '　' + teamName(now)),
          h('div', { class: 'big' }, now.assign.map((a) => h('div', null, h('b', null, a.role), h('span', null, a.id ? (School.hidden() ? (stMap().get(a.id) || {}).no + '番' : nameOf(a.id).replace(/^\d+ /, '')) : '—'))))) });
      }
      async function printLunch(sched, roles, teamName) {
        const hd = await head('給食当番表');
        School.print({ landscape: roles.length > 5, build: () => h('div', { class: 'dt-print' }, hd,
          h('table', null, h('thead', null, h('tr', null, h('th', null, '期間'), h('th', null, '当番'), roles.map((r) => h('th', null, r)))),
            h('tbody', null, sched.map((p) => h('tr', null, h('td', null, range(p)), h('td', null, teamName(p)), p.skip ? h('td', { colspan: roles.length }, 'お休みの週') : p.assign.map((a) => h('td', null, a.id ? short(a.id) : '—')))))),
          S.d.lunch.mode === 'group' ? legend() : null) });
      }
      async function printNicchoku(list) {
        const hd = await head('日直表');
        const half = Math.ceil(list.length / 2);
        const tbl = (rows) => h('table', null, h('thead', null, h('tr', null, h('th', null, '日付'), h('th', null, '日直'))), h('tbody', null, rows.map((x) => h('tr', null, h('td', null, mdw(x.date)), h('td', { class: 'l' }, x.ids.map(nameOf).join('・'))))));
        School.print({ landscape: false, build: () => h('div', { class: 'dt-print' }, hd, h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6mm' } }, tbl(list.slice(0, half)), tbl(list.slice(half)))) });
      }

      await load();
      await render();
      const reload = Kit.debounce(async () => { if (!alive) return; await saveG.flush(); await saveD.flush(); await load(); render(); }, 150);
      const offs = [Kit.store.on('coll:classes', reload), Kit.store.on('coll:seatplans', reload), School.onClassChange(async () => { S.sel = null; await saveG.flush(); await saveD.flush(); await load(); render(); })];
      return () => { alive = false; offs.forEach((f) => f()); reload.cancel(); saveG.flush(); saveD.flush(); };
    },
  });

  // ほかの道具（ホーム）から：今日の日直・今週の当番
  window.SenseiDuty = {
    async today() {
      const cls = await School.classes.current();
      if (!cls) return null;
      const g0 = (await Kit.store.list('groups')).find((x) => x.classId === cls.id), d0 = (await Kit.store.list('duties')).find((x) => x.classId === cls.id);
      if (!g0 && !d0) return null;
      const g = normGroups(g0, cls), d = normDuty(d0);
      const label = (id) => { const s = cls.students.find((x) => x.id === id); return s ? School.label(s, { short: true }) : ''; };
      const t = Kit.ymd();
      const nk = D.nicchoku({ students: cls.students.map((s) => s.id), per: d.nicchoku.per, start: d.nicchoku.start, days: d.nicchoku.days, isOff: School.isOff, skip: d.nicchoku.skip, startIndex: d.nicchoku.startIndex }).find((x) => x.date === t);
      const mem = D.membersOf(cls.students, g.of, g.n);
      const L = d.lunch;
      const lu = D.periodOf(D.lunch({ mode: L.mode, groups: g.n, members: mem, students: cls.students.map((s) => s.id), size: L.size, roles: L.roles.filter(Boolean), start: L.start, count: L.count, every: L.every, skip: L.skip }), t);
      return { cls, nicchoku: nk ? nk.ids.map(label) : [], lunch: lu && !lu.skip ? (L.mode === 'number' ? lu.team.map(label).slice(0, 2).join('・') + '…' : g.names[lu.group]) : '' };
    },
  };
})();

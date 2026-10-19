// 係決め：たくさんの例から係を選び（自分でもつくれる）、手・希望・くじで人を決めて、表にする
(function () {
  'use strict';
  const { h } = Kit;
  const RD = window.RolesData;
  const STEPS = [{ id: 'roles', label: '係を選ぶ' }, { id: 'people', label: '人を決める' }, { id: 'table', label: '表にする' }];

  const roleFrom = (x) => ({ id: Kit.uid('role'), name: x.name, count: x.n || 1, desc: x.d || '', src: x.id || '' });
  const normBoard = (b) => {
    const o = Object.assign({ title: '係', roles: [], assign: {}, wishes: {}, maxPer: 1, avoidBoard: '', log: [], method: 'hand' }, b || {});
    o.roles = (o.roles || []).map((r) => ({ id: r.id || Kit.uid('role'), name: String(r.name || ''), count: Kit.clamp(r.count | 0 || 1, 1, 40), desc: String(r.desc || ''), src: r.src || '' }));
    for (const r of o.roles) o.assign[r.id] = Array.isArray(o.assign[r.id]) ? o.assign[r.id] : [];
    for (const k of Object.keys(o.assign)) if (!o.roles.some((r) => r.id === k)) delete o.assign[k];
    o.maxPer = [1, 2, 99].includes(o.maxPer) ? o.maxPer : 1;
    return o;
  };

  // サンプル：架空のクラスの「前期の係」（中学校のおすすめを、くじで決めたもの）
  const SC = School.SAMPLE_CLASS;
  const sampleRoles = RD.set('jhs', 'kakari').map((x, i) => Object.assign(roleFrom(x), { id: 's-role-' + i }));
  const sampleAssign = RD.byLottery(sampleRoles, SC.students, { seed: 4242 }).assign;
  Kit.store.sample('roleboards', [{ id: 's-board-1', classId: SC.id, title: '前期の係', roles: sampleRoles, assign: sampleAssign, wishes: {}, maxPer: 1, method: 'lottery', log: [] }]);
  School.classes.onRemove(School.removeByClass('roleboards'));

  Kit.css('roles', `
.rl-top{display:flex;flex-wrap:wrap;align-items:center;gap:8px 10px;margin-bottom:12px}
.rl-top select{width:auto;max-width:100%}
.rl-split{display:grid;gap:16px;grid-template-columns:1fr}
@media (min-width:1000px){.rl-split{grid-template-columns:minmax(0,1fr) minmax(0,1fr);align-items:start}}
.rl-lib-tools{display:grid;gap:8px;margin-bottom:10px}
.rl-lib-list{display:grid;gap:6px;max-height:min(70vh,640px);overflow:auto;padding-right:2px}
.rl-lib-it{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 10px;align-items:center;padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:var(--surface)}
.rl-lib-it .nm{font-weight:700;font-size:14.5px}
.rl-lib-it .nm small{font-weight:400;color:var(--ink-3);margin-left:6px;font-size:12px}
.rl-lib-it .ds{grid-column:1/2;font-size:12.5px;color:var(--ink-2);line-height:1.5}
.rl-lib-it .btn{grid-row:1/3;grid-column:2}
.rl-lib-it.is-in{background:var(--surface-2)}
.rl-mine{display:grid;gap:8px}
.rl-role{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:6px 8px;align-items:center;padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:var(--surface)}
.rl-role input[type=text]{font-weight:700;min-height:34px;padding:4px 8px}
.rl-role textarea{grid-column:1/-1;min-height:40px;font-size:13px;padding:5px 8px}
.rl-cnt{display:inline-flex;align-items:center;gap:2px}
.rl-cnt b{min-width:2.4em;text-align:center;font-variant-numeric:tabular-nums}
.rl-ops{display:inline-flex;gap:0}
.rl-sum{font-size:13px;color:var(--ink-2)}
.rl-sum.bad{color:var(--bad)}
.rl-method{display:grid;gap:10px;margin-bottom:14px}
.rl-tray{display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:10px;border:1px dashed var(--line-strong);border-radius:var(--r);background:var(--surface);margin-bottom:12px;font-size:13px}
.rl-tray .chip{cursor:pointer;min-height:30px;font-size:13px;border:1px solid var(--line)}
.rl-tray .chip[aria-pressed="true"]{background:var(--shu);color:var(--on-shu);border-color:var(--shu)}
.rl-cards{display:grid;gap:10px;grid-template-columns:repeat(auto-fill,minmax(min(100%,230px),1fr))}
.rl-card{display:grid;gap:6px;align-content:start;padding:10px 12px;border:1px solid var(--line);border-radius:var(--r);background:var(--surface);min-height:92px}
.rl-card.can-drop{border-color:var(--shu);box-shadow:0 0 0 2px color-mix(in srgb,var(--shu) 25%,transparent);cursor:pointer}
.rl-card.is-full .rl-card-n{color:var(--ok)}
.rl-card.is-over .rl-card-n{color:var(--bad)}
.rl-card-h{display:flex;align-items:center;gap:6px}
.rl-card-h b{flex:1;min-width:0;font-size:15px}
.rl-card-n{font-size:12.5px;color:var(--ink-3);font-variant-numeric:tabular-nums;white-space:nowrap}
.rl-mem{display:flex;flex-wrap:wrap;gap:4px}
.rl-mem .chip{gap:2px;padding-right:2px}
.rl-mem .chip button{border:0;background:transparent;color:var(--ink-3);cursor:pointer;padding:0 4px;font:inherit;line-height:1}
.rl-mem .chip button:hover{color:var(--bad)}
.rl-wish{display:grid;gap:4px}
.rl-wish-row{display:grid;grid-template-columns:minmax(90px,150px) repeat(3,minmax(0,1fr));gap:6px;align-items:center;padding:4px 0;border-bottom:1px solid var(--line)}
.rl-wish-row select{min-height:34px;padding:3px 6px;font-size:13.5px}
.rl-wish-row.th{font-size:12px;font-weight:700;color:var(--ink-3);border-bottom-color:var(--line-strong)}
.rl-log{display:grid;gap:6px;margin:12px 0}
.rl-log li{font-size:13.5px}
.rl-log details summary{cursor:pointer}
.rl-out-opts{display:flex;flex-wrap:wrap;gap:10px 16px;align-items:center;margin-bottom:12px}
.rl-table td.mem{min-width:12em}
.rl-table td:first-child{white-space:nowrap}
.rl-table td.desc{color:var(--ink-2);font-size:13px}
@media (max-width:640px){
  .rl-table thead{display:none}
  .rl-table tr{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 10px;padding:9px 12px;border-bottom:1px solid var(--line)}
  .rl-table tr:last-child{border-bottom:0}
  .rl-table td{border:0!important;padding:0!important}
  .rl-table td.mem,.rl-table td.desc{grid-column:1/-1;min-width:0}
  .rl-wish-row{grid-template-columns:1fr 1fr 1fr;grid-template-areas:"who who who" "a b c"}
  .rl-wish-row>.who{grid-area:who;font-weight:700;font-size:13.5px}
  .rl-wish-row.th{display:none}
}
/* 印刷 */
.rl-print{color:#000;font-family:var(--font-body)}
.rl-print h1{font-size:18pt;margin:0 0 1mm;font-family:var(--font-display)}
.rl-print .sub{font-size:10pt;margin-bottom:4mm}
.rl-print table{width:100%;border-collapse:collapse;font-size:11pt}
.rl-print th,.rl-print td{border:1pt solid #000;padding:2mm 3mm;text-align:left;vertical-align:top}
.rl-print th{background:#eee;font-size:10pt}
.rl-print td.n{text-align:center;width:12mm}
.rl-print td.desc{font-size:9.5pt}
.rl-print .cards{display:grid;grid-template-columns:1fr 1fr;gap:5mm}
.rl-print .cardp{border:1.5pt solid #000;border-radius:3mm;padding:4mm 5mm;break-inside:avoid}
.rl-print .cardp h2{font-size:20pt;margin:0 0 2mm;font-family:var(--font-display)}
.rl-print .cardp .m{font-size:15pt;font-weight:700;line-height:1.5}
.rl-print .cardp .d{font-size:10pt;margin-top:2mm;color:#222}
`);

  Kit.app({
    id: 'roles', title: '係決め', group: 'class', icon: 'badge', order: 30,
    desc: 'たくさんの例から係を選び、手・希望・くじで決めて表にする',
    colls: ['roleboards'],
    async mount(root, params) {
      const S = { cls: null, boards: [], b: null, step: Kit.pref.get('roles:step', 'roles'), group: 'kakari', ev: '', q: '', allLv: false, sel: null, level: 'jhs' };
      if (!STEPS.some((x) => x.id === S.step)) S.step = 'roles';
      let alive = true;
      const classSlot = h('div'), sampleSlot = h('div'), main = h('div');
      root.append(Kit.appHead({
        title: '係決め',
        desc: '120ほどの例から係を選び、希望やくじで決めて、掲示用の表にします。',
        actions: [Kit.btn('新しい表', () => newBoard(), { icon: 'plus' })],
      }), classSlot, sampleSlot, main);

      async function load() {
        S.cls = await School.classes.current();
        S.level = (await Kit.profile.get()).level;
        if (!S.cls) { S.boards = []; S.b = null; return; }
        const all = await Kit.store.list('roleboards');
        S.boards = all.filter((b) => b.classId === S.cls.id).sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
        const want = (S.b && S.b.id) || Kit.pref.get('roles:board', null);
        const pick = S.boards.find((b) => b.id === want) || S.boards[0] || null;
        S.b = pick ? normBoard(Kit.clone(pick)) : null;
      }
      const persist = Kit.debounce(async () => { if (S.b) { delete S.b.sample; await Kit.store.put('roleboards', S.b); } }, 350);
      const stMap = () => new Map((S.cls ? S.cls.students : []).map((s) => [s.id, s]));
      const roleOf = (sid) => S.b.roles.filter((r) => (S.b.assign[r.id] || []).includes(sid));

      async function render() {
        Kit.clear(classSlot); Kit.clear(sampleSlot); Kit.clear(main);
        classSlot.append(await School.classBar({ onChange: async () => { S.b = null; await load(); render(); } }));
        if (!S.cls) { main.append(Kit.empty({ title: '係決めには名簿が要ります', body: '名簿にクラスを入れると、ここで係を決められます。', actions: [Kit.btn('名簿を開く', () => Kit.go('roster'), { kind: 'primary', icon: 'users' })] })); return; }
        if (S.b && S.b.sample) sampleSlot.append(Kit.sampleBar('架空のクラスの「前期の係」です。係を足したり、くじを引き直したりして試せます。'));
        if (!S.b) { main.append(startPanel()); return; }
        main.append(topBar(), stepsBar());
        main.append(S.step === 'roles' ? rolesStep() : S.step === 'people' ? peopleStep() : tableStep());
      }

      /* ── はじめ方 ── */
      function startPanel() {
        const lv = Kit.levelLabel(S.level);
        const go = (title, items) => createBoard(title, items.map(roleFrom));
        return h('div', { class: 'stack' },
          Kit.empty({ title: (S.cls.name || 'このクラス') + 'の係の表は、まだありません', body: 'おすすめの係で始めて、あとから足したり消したりできます（' + lv + 'の例。校種は ホーム →「学校の設定」で変えられます）。' }),
          h('div', { class: 'rl-cards' },
            card('学級の係（おすすめ）', RD.set(S.level, 'kakari'), () => go('前期の係', RD.set(S.level, 'kakari'))),
            card('委員会（おすすめ）', RD.set(S.level, 'iinkai'), () => go('前期の委員会', RD.set(S.level, 'iinkai'))),
            card('体育祭・運動会の係', RD.ITEMS.filter((x) => x.ev === 'sports'), () => go('体育祭の係', RD.ITEMS.filter((x) => x.ev === 'sports'))),
            card('文化祭の係', RD.ITEMS.filter((x) => x.ev === 'culture'), () => go('文化祭の係', RD.ITEMS.filter((x) => x.ev === 'culture'))),
            h('div', { class: 'rl-card' }, h('div', { class: 'rl-card-h' }, h('b', null, '空の表から')), h('p', { class: 'small ink-2' }, '係をひとつずつ選んだり、自分でつくったりします。'), Kit.btn('空の表をつくる', () => createBoard('係', []), { sm: true, icon: 'plus' }))));
        function card(title, items, fn) {
          return h('div', { class: 'rl-card' }, h('div', { class: 'rl-card-h' }, h('b', null, title), h('span', { class: 'rl-card-n' }, items.length + 'こ')),
            h('p', { class: 'small ink-2' }, items.slice(0, 8).map((x) => x.name).join('・') + (items.length > 8 ? '…' : '')),
            Kit.btn('これで始める', fn, { sm: true, kind: 'primary', icon: 'check' }));
        }
      }
      async function createBoard(title, roles, more) {
        const b = normBoard(Object.assign({ id: Kit.uid('board'), classId: S.cls.id, title, roles }, more || {}));
        const saved = await Kit.store.put('roleboards', b);
        Kit.pref.set('roles:board', saved.id);
        S.b = normBoard(saved); S.step = 'roles';
        await load(); render();
        Kit.toast('「' + title + '」をつくりました');
      }
      async function newBoard() {
        if (!S.cls) return;
        const tl = h('input', { type: 'text', id: 'rl-new-title', maxlength: 40, value: S.boards.length ? '後期の係' : '前期の係' });
        const from = h('select', { id: 'rl-new-from' }, h('option', { value: '' }, 'コピーしない（空から）'), S.boards.map((b) => h('option', { value: b.id }, b.title + '（' + (b.roles || []).length + 'こ）')));
        if (S.b) from.value = S.b.id;
        const avoid = h('input', { type: 'checkbox', id: 'rl-new-avoid', checked: true });
        const body = h('div', { class: 'stack' }, Kit.field({ label: '表の名前', input: tl }), Kit.field({ label: '係をコピーする表', input: from, hint: '係の名前・人数・仕事内容だけをコピーします（人は決め直し）。' }),
          h('label', { class: 'check', for: 'rl-new-avoid' }, avoid, 'コピーした表と同じ係にならないように決める'));
        const ok = await new Promise((resolve) => Kit.modal({ title: '新しい表', body, autofocus: 'input', onClose: (v) => resolve(v), actions: [{ label: 'やめる', kind: 'ghost', value: false }, { label: 'つくる', kind: 'primary', value: true }] }));
        if (!ok) return;
        const src = S.boards.find((b) => b.id === from.value);
        const roles = src ? normBoard(Kit.clone(src)).roles.map((r) => Object.assign({}, r, { id: Kit.uid('role') })) : [];
        await createBoard(tl.value.trim() || '係', roles, { avoidBoard: src && avoid.checked ? src.id : '' });
      }

      function topBar() {
        const sel = h('select', { id: 'rl-board', 'aria-label': '係の表を選ぶ' }, S.boards.map((b) => h('option', { value: b.id }, b.title)));
        sel.value = S.b.id;
        sel.addEventListener('change', async () => { await persist.flush(); Kit.pref.set('roles:board', sel.value); S.b = null; const p = S.boards.find((b) => b.id === sel.value); S.b = p ? normBoard(Kit.clone(p)) : null; render(); });
        const assigned = new Set(Object.values(S.b.assign).flat());
        return h('div', { class: 'rl-top' },
          h('label', { for: 'rl-board', class: 'small ink-2' }, '表'), sel,
          Kit.btn('名前を変える', async () => { const t = await Kit.ask({ title: '表の名前', label: '名前', value: S.b.title }); if (t && t.trim()) { S.b.title = t.trim(); await Kit.store.put('roleboards', S.b); await load(); render(); } }, { sm: true, kind: 'ghost', icon: 'edit' }),
          Kit.btn('', () => removeBoard(), { sm: true, kind: 'ghost', icon: 'trash', title: 'この表を消す' }),
          h('span', { class: 'grow' }),
          h('span', { class: 'small ink-2 num' }, '係 ' + S.b.roles.length + 'こ・決まった人 ' + S.cls.students.filter((s) => assigned.has(s.id)).length + ' / ' + S.cls.students.length + '人'));
      }
      async function removeBoard() {
        const ok = await Kit.confirm({ title: '「' + S.b.title + '」を消しますか？', body: '係と、決まった人の記録を消します。', ok: '消す', danger: true });
        if (!ok) return;
        persist.cancel();
        await Kit.store.remove('roleboards', S.b.id);
        S.b = null; Kit.pref.set('roles:board', null);
        await load(); render();
        Kit.toast('表を消しました');
      }
      function stepsBar() {
        return h('nav', { class: 'sk-steps', 'aria-label': '手順' }, STEPS.map((s, i) => h('button', { type: 'button', class: 'sk-step', 'aria-current': S.step === s.id ? 'step' : null, onclick: () => { S.step = s.id; Kit.pref.set('roles:step', s.id); S.sel = null; render(); } }, h('b', null, i + 1), s.label)));
      }

      /* ── ① 係を選ぶ ── */
      function rolesStep() {
        return h('div', { class: 'rl-split' }, libraryCard(), mineCard());
      }
      function libraryCard() {
        const card = h('section', { class: 'card', 'aria-label': '係の例' });
        const list = h('div', { class: 'rl-lib-list', role: 'list' });
        const q = h('input', { type: 'search', id: 'rl-q', placeholder: 'さがす（例：黒板、委員、応援）', value: S.q, autocomplete: 'off' });
        const draw = () => {
          Kit.clear(list);
          const inSrc = new Set(S.b.roles.map((r) => r.src).filter(Boolean));
          const inName = new Set(S.b.roles.map((r) => r.name));
          let items = S.allLv ? RD.ITEMS : RD.forLevel(S.level);
          const word = S.q.trim();
          if (word) items = items.filter((x) => (x.name + x.d + RD.eventLabel(x.ev)).includes(word));
          else items = items.filter((x) => x.g === S.group && (S.group !== 'event' || !S.ev || x.ev === S.ev));
          if (!items.length) list.append(h('p', { class: 'small muted' }, '見つかりませんでした。右の「自分で係をつくる」で足せます。'));
          for (const x of items) {
            const isIn = inSrc.has(x.id) || inName.has(x.name);
            list.append(h('div', { class: 'rl-lib-it' + (isIn ? ' is-in' : ''), role: 'listitem' },
              h('span', { class: 'nm' }, x.name, h('small', null, x.n + '人' + (x.ev && (word || !S.ev) ? '・' + RD.eventLabel(x.ev) : ''))),
              h('span', { class: 'ds' }, x.d),
              isIn ? Kit.btn('入っています', null, { sm: true, kind: 'ghost', icon: 'check', disabled: true }) : Kit.btn('追加', () => { S.b.roles.push(roleFrom(x)); S.b.assign[S.b.roles[S.b.roles.length - 1].id] = []; persist(); draw(); redrawMine(); }, { sm: true, icon: 'plus' })));
          }
        };
        q.addEventListener('input', () => { S.q = q.value; draw(); });
        const groups = Kit.seg(RD.GROUPS.map((g) => ({ value: g.id, label: g.label })), S.group, (v) => { S.group = v; S.ev = ''; S.q = ''; q.value = ''; render(); }, { label: '係の種類' });
        const evSel = S.group === 'event' ? Kit.seg([{ value: '', label: 'すべて' }].concat(RD.EVENTS.map((e) => ({ value: e.id, label: e.label }))), S.ev, (v) => { S.ev = v; draw(); }, { label: '行事' }) : null;
        const lv = h('input', { type: 'checkbox', id: 'rl-alllv', checked: S.allLv, onchange: () => { S.allLv = lv.checked; draw(); } });
        card.append(h('div', { class: 'card-h' }, h('h2', null, '係の例から選ぶ')),
          h('div', { class: 'rl-lib-tools' }, groups, evSel, q,
            h('label', { class: 'check small', for: 'rl-alllv' }, lv, Kit.levelLabel(S.level) + '以外の例も見る')),
          list);
        draw();
        return card;
      }
      let mineBox = null;
      function mineCard() {
        mineBox = h('section', { class: 'card', 'aria-label': 'この表の係' });
        redrawMine();
        return mineBox;
      }
      function redrawMine() {
        if (!mineBox) return;
        Kit.clear(mineBox);
        const cap = Kit.sum(S.b.roles, (r) => r.count), n = S.cls.students.length;
        const sum = h('p', { class: 'rl-sum' + (cap < n && S.b.maxPer === 1 ? ' bad' : '') }, '係 ' + S.b.roles.length + 'こ・定員の合計 ' + cap + '人／クラス ' + n + '人' + (cap < n ? '（全員に係を割り当てるには、あと' + (n - cap) + '人ぶん足りません）' : ''));
        const list = h('div', { class: 'rl-mine' });
        S.b.roles.forEach((r, i) => {
          const name = h('input', { type: 'text', value: r.name, maxlength: 30, 'aria-label': '係の名前', id: 'rl-r-' + i });
          name.addEventListener('input', () => { r.name = name.value; persist(); });
          const desc = h('textarea', { rows: 2, maxlength: 200, placeholder: '仕事の内容（掲示に出ます）', 'aria-label': r.name + 'の仕事の内容' });
          desc.value = r.desc || '';
          desc.addEventListener('input', () => { r.desc = desc.value; persist(); });
          const cnt = h('b', { 'aria-live': 'polite' }, r.count + '人');
          const setCount = (v) => { r.count = Kit.clamp(v, 1, 40); cnt.textContent = r.count + '人'; persist(); redrawMine(); };
          list.append(h('div', { class: 'rl-role' }, name,
            h('span', { class: 'rl-cnt' }, Kit.btn('', () => setCount(r.count - 1), { icon: 'minus', sm: true, kind: 'ghost', title: '人数を減らす', disabled: r.count <= 1 }), cnt, Kit.btn('', () => setCount(r.count + 1), { icon: 'plus', sm: true, kind: 'ghost', title: '人数をふやす' })),
            h('span', { class: 'rl-ops' },
              Kit.btn('', () => move(i, -1), { icon: 'up', sm: true, kind: 'ghost', title: '上へ', disabled: i === 0 }),
              Kit.btn('', () => move(i, 1), { icon: 'down', sm: true, kind: 'ghost', title: '下へ', disabled: i === S.b.roles.length - 1 }),
              Kit.btn('', () => removeRole(i), { icon: 'trash', sm: true, kind: 'ghost', title: r.name + 'を消す' })),
            desc));
        });
        if (!S.b.roles.length) list.append(h('p', { class: 'small muted' }, 'まだ係がありません。左の例から「追加」するか、下で自分の係をつくってください。'));
        mineBox.append(h('div', { class: 'card-h' }, h('h2', null, 'この表の係'), h('span', { class: 'spacer' }), Kit.btn('自分で係をつくる', addOwn, { sm: true, kind: 'primary', icon: 'plus' })), sum, list,
          S.b.roles.length ? h('div', { class: 'btn-row', style: { marginTop: '12px' } }, Kit.btn('次へ：人を決める', () => { S.step = 'people'; Kit.pref.set('roles:step', 'people'); render(); }, { kind: 'primary', icon: 'right' })) : null);
      }
      function move(i, d) { const a = S.b.roles; const j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; persist(); redrawMine(); }
      async function removeRole(i) {
        const r = S.b.roles[i];
        if ((S.b.assign[r.id] || []).length && !(await Kit.confirm({ title: r.name + 'を消しますか？', body: 'この係に決まっている ' + S.b.assign[r.id].length + '人も外れます。', ok: '消す', danger: true }))) return;
        S.b.roles.splice(i, 1); delete S.b.assign[r.id];
        persist(); render();
      }
      async function addOwn() {
        const name = await Kit.ask({ title: '自分で係をつくる', label: '係の名前', placeholder: '例：ありがとう係、タブレット係', ok: '足す' });
        if (!name || !name.trim()) return;
        const r = { id: Kit.uid('role'), name: name.trim(), count: 2, desc: '', src: '' };
        S.b.roles.push(r); S.b.assign[r.id] = [];
        persist(); render();
        setTimeout(() => { const t = root.querySelectorAll('.rl-role textarea'); if (t.length) t[t.length - 1].focus(); }, 50);
      }

      /* ── ② 人を決める ── */
      function peopleStep() {
        const box = h('div');
        const m = S.b.method || 'hand';
        const avoidSel = h('select', { id: 'rl-avoid', style: { width: 'auto' } }, h('option', { value: '' }, 'しない'), S.boards.filter((b) => b.id !== S.b.id).map((b) => h('option', { value: b.id }, '「' + b.title + '」と同じ係にしない')));
        avoidSel.value = S.b.avoidBoard || '';
        avoidSel.addEventListener('change', () => { S.b.avoidBoard = avoidSel.value; persist(); });
        const methodBox = h('section', { class: 'card rl-method', 'aria-label': '決め方' },
          h('div', { class: 'row' }, h('b', null, '決め方'), Kit.seg([{ value: 'hand', label: '手で決める', icon: 'hand' }, { value: 'wish', label: '希望で決める', icon: 'star' }, { value: 'lottery', label: 'くじで決める', icon: 'shuffle' }], m, (v) => { S.b.method = v; persist(); render(); }, { label: '決め方' })),
          h('div', { class: 'row small' },
            h('span', { class: 'ink-2' }, '1人がもてる係'), Kit.seg([{ value: 1, label: '1つまで' }, { value: 2, label: '2つまで' }, { value: 99, label: 'いくつでも' }], S.b.maxPer, (v) => { S.b.maxPer = +v; persist(); render(); }, { label: '1人がもてる係の数' }),
            S.boards.length > 1 ? h('span', { class: 'row' }, h('label', { for: 'rl-avoid', class: 'ink-2' }, '前の表'), avoidSel) : null),
          m === 'hand' ? h('p', { class: 'small ink-2' }, '下の「まだ係がない人」から名前を押して、入れたい係のカードを押します。カードの「＋」でまとめて選ぶこともできます。')
            : m === 'wish' ? wishPanel()
              : h('div', { class: 'stack tight' }, h('p', { class: 'small ink-2' }, 'まだ係がない人を、空いている係にくじで入れます。いま決まっている人はそのままです（全部やり直すときは「全員を外す」を先に）。'),
                h('div', { class: 'btn-row' }, Kit.btn('くじで決める', runLottery, { kind: 'primary', icon: 'shuffle' }), Kit.btn('全員を外す', clearAll, { kind: 'ghost', icon: 'trash' }))));
        box.append(methodBox);
        if (S.b.log && S.b.log.length) box.append(logEl());
        box.append(trayEl(), cardsEl());
        box.append(h('div', { class: 'btn-row', style: { marginTop: '14px' } }, Kit.btn('次へ：表にする', () => { S.step = 'table'; Kit.pref.set('roles:step', 'table'); render(); }, { kind: 'primary', icon: 'right' })));
        return box;
      }
      function wishPanel() {
        const st = S.cls.students;
        const opts = () => [h('option', { value: '' }, '—')].concat(S.b.roles.map((r) => h('option', { value: r.id }, r.name)));
        const rows = h('div', { class: 'rl-wish', role: 'group', 'aria-label': '希望' },
          h('div', { class: 'rl-wish-row th', 'aria-hidden': 'true' }, ['名前', '第1希望', '第2希望', '第3希望'].map((t) => h('span', null, t))));
        for (const s of st) {
          const w = (S.b.wishes[s.id] = S.b.wishes[s.id] || ['', '', '']);
          const sels = [0, 1, 2].map((k) => { const sel = h('select', { 'aria-label': School.label(s) + 'の第' + (k + 1) + '希望' }, opts()); sel.value = w[k] || ''; sel.addEventListener('change', () => { w[k] = sel.value; persist(); }); return sel; });
          rows.append(h('div', { class: 'rl-wish-row' }, h('span', { class: 'who' }, School.label(s)), sels));
        }
        const fill = h('input', { type: 'checkbox', id: 'rl-fill', checked: S.b.fillRest !== false, onchange: () => { S.b.fillRest = fill.checked; persist(); } });
        return h('div', { class: 'stack' },
          h('p', { class: 'small ink-2' }, '第1希望から順に決めます。定員より多いときは、くじで決めます（だれが当たったかは、下に記録が残ります）。'),
          h('details', { class: 'help' }, h('summary', null, '希望を入れる（' + st.filter((s) => (S.b.wishes[s.id] || []).some(Boolean)).length + ' / ' + st.length + '人）'), h('div', { style: { marginTop: '8px' } }, rows)),
          h('label', { class: 'check small', for: 'rl-fill' }, fill, '希望がかなわなかった人・希望がない人は、空いている係にくじで入れる'),
          h('div', { class: 'btn-row' }, Kit.btn('希望で決める', runWish, { kind: 'primary', icon: 'star' }), Kit.btn('全員を外す', clearAll, { kind: 'ghost', icon: 'trash' })));
      }
      function avoidMap() {
        const src = S.boards.find((b) => b.id === S.b.avoidBoard);
        if (!src) return null;
        const out = {};
        for (const r of src.roles || []) for (const sid of (src.assign || {})[r.id] || []) (out[sid] = out[sid] || []).push(r.name);
        return out;
      }
      async function runWish() {
        const any = Object.values(S.b.wishes).some((w) => (w || []).some(Boolean));
        if (!any) { Kit.toast('先に希望を入れてください', { type: 'bad' }); return; }
        const res = RD.byWish(S.b.roles, S.cls.students, { wishes: S.b.wishes, keep: S.b.assign, avoid: avoidMap(), fillRest: S.b.fillRest !== false, seed: School.newSeed() });
        apply(res, '希望で決めました');
      }
      async function runLottery() {
        const res = RD.byLottery(S.b.roles, S.cls.students, { keep: S.b.assign, avoid: avoidMap(), seed: School.newSeed() });
        apply(res, 'くじで決めました');
      }
      function apply(res, msg) {
        S.b.assign = res.assign;
        S.b.log = res.log.map((l) => ({ text: l.text, kind: l.kind, ids: l.ids || [], win: l.win || [], at: new Date().toISOString() }));
        persist(); render();
        Kit.toast(msg + (res.left.length ? '（' + res.left.length + '人がまだ決まっていません）' : ''));
      }
      async function clearAll() {
        const ok = await Kit.confirm({ title: '全員を外しますか？', body: 'この表で決まっている人を、すべての係から外します（係はそのまま）。', ok: '外す' });
        if (!ok) return;
        for (const r of S.b.roles) S.b.assign[r.id] = [];
        S.b.log = [];
        persist(); render();
      }
      function logEl() {
        const st = stMap();
        const nm = (id) => (st.get(id) ? School.label(st.get(id)) : '');
        return h('section', { class: 'card', 'aria-label': '決め方の記録' },
          h('div', { class: 'card-h' }, h('h3', null, '決め方の記録'), h('span', { class: 'spacer' }), Kit.btn('記録を消す', () => { S.b.log = []; persist(); render(); }, { sm: true, kind: 'ghost' })),
          h('ul', { class: 'rl-log', style: { paddingLeft: '1.2em', margin: 0 } }, S.b.log.map((l) => h('li', null, l.text,
            l.kind === 'lottery' && l.win && l.win.length ? h('span', { class: 'small ink-2' }, '　当たり：' + l.win.map(nm).join('、') + '（希望した人：' + l.ids.map(nm).join('、') + '）') : null,
            l.kind === 'left' ? h('span', { class: 'small ink-2' }, '　' + l.ids.map(nm).join('、')) : null))));
      }
      function trayEl() {
        const max = S.b.maxPer;
        const none = S.cls.students.filter((s) => roleOf(s.id).length === 0);
        const box = h('div', { class: 'rl-tray', role: 'group', 'aria-label': 'まだ係がない人' });
        box.append(h('b', null, none.length ? 'まだ係がない人（' + none.length + '人）' : '全員の係が決まりました'));
        for (const s of (max === 1 ? none : S.cls.students.filter((x) => roleOf(x.id).length < max))) {
          box.append(h('button', { type: 'button', class: 'chip', 'aria-pressed': String(S.sel === s.id), onclick: () => { S.sel = S.sel === s.id ? null : s.id; render(); } }, School.label(s) + (max > 1 && roleOf(s.id).length ? '（' + roleOf(s.id).length + '）' : '')));
        }
        if (S.sel) box.append(h('span', { class: 'small', style: { color: 'var(--shu)' } }, '→ 入れたい係のカードを押してください'));
        return box;
      }
      function cardsEl() {
        const st = stMap();
        const wrap = h('div', { class: 'rl-cards' });
        for (const r of S.b.roles) {
          const mem = (S.b.assign[r.id] || []).filter((id) => st.has(id));
          const full = mem.length >= r.count, over = mem.length > r.count;
          const can = !!S.sel && !mem.includes(S.sel);
          const c = h('div', { class: 'rl-card' + (full ? ' is-full' : '') + (over ? ' is-over' : '') + (can ? ' can-drop' : ''), 'data-role': r.id, role: can ? 'button' : null, tabindex: can ? 0 : null, 'aria-label': can ? r.name + 'に入れる' : null },
            h('div', { class: 'rl-card-h' }, h('b', null, r.name), h('span', { class: 'rl-card-n' }, mem.length + ' / ' + r.count + '人'),
              Kit.btn('', (e) => { e.stopPropagation(); pickFor(r); }, { icon: 'plus', sm: true, kind: 'ghost', title: r.name + 'に入れる人を選ぶ' })),
            h('div', { class: 'rl-mem' }, mem.map((id) => h('span', { class: 'chip blue' }, School.label(st.get(id)), h('button', { type: 'button', 'aria-label': School.label(st.get(id)) + 'を' + r.name + 'から外す', onclick: (e) => { e.stopPropagation(); S.b.assign[r.id] = S.b.assign[r.id].filter((x) => x !== id); persist(); render(); } }, '×')))));
          if (can) {
            const put = () => drop(r);
            c.addEventListener('click', put);
            c.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); put(); } });
          }
          wrap.append(c);
        }
        if (!S.b.roles.length) wrap.append(h('p', { class: 'small muted' }, '係がありません。「係を選ぶ」で足してください。'));
        return wrap;
      }
      function drop(r) {
        const sid = S.sel;
        if (!sid) return;
        const has = roleOf(sid);
        if (has.length >= S.b.maxPer) {
          if (S.b.maxPer === 1) { for (const x of has) S.b.assign[x.id] = S.b.assign[x.id].filter((id) => id !== sid); }
          else { Kit.toast('1人がもてる係の数をこえます', { type: 'bad' }); return; }
        }
        S.b.assign[r.id] = (S.b.assign[r.id] || []).concat(sid);
        if (S.b.assign[r.id].length > r.count) Kit.toast(r.name + 'の定員（' + r.count + '人）をこえました', { type: 'bad' });
        S.sel = null;
        persist(); render();
      }
      function pickFor(r) {
        const st = S.cls.students;
        const cur = new Set(S.b.assign[r.id] || []);
        const boxes = st.map((s) => {
          const other = roleOf(s.id).filter((x) => x.id !== r.id);
          const cb = h('input', { type: 'checkbox', id: 'rl-pk-' + s.id, checked: cur.has(s.id) });
          return { s, cb, row: h('label', { class: 'check', for: 'rl-pk-' + s.id, style: { padding: '3px 0' } }, cb, School.label(s), other.length ? h('span', { class: 'small muted' }, '（' + other.map((x) => x.name).join('・') + '）') : null) };
        });
        const body = h('div', { class: 'stack tight' }, h('p', { class: 'small ink-2' }, r.name + '（定員 ' + r.count + '人）に入れる人にチェック。' + (S.b.maxPer === 1 ? 'ほかの係の人を選ぶと、そちらから外れます。' : '')),
          h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: '2px 12px' } }, boxes.map((x) => x.row)));
        Kit.modal({
          title: r.name + 'に入れる人', body, wide: true,
          actions: [{ label: 'やめる', kind: 'ghost' }, {
            label: '決める', kind: 'primary', onClick: () => {
              const pick = boxes.filter((x) => x.cb.checked).map((x) => x.s.id);
              if (S.b.maxPer === 1) for (const sid of pick) for (const other of S.b.roles) if (other.id !== r.id) S.b.assign[other.id] = (S.b.assign[other.id] || []).filter((id) => id !== sid);
              S.b.assign[r.id] = pick;
              if (pick.length > r.count) Kit.toast(r.name + 'の定員（' + r.count + '人）をこえています', { type: 'bad' });
              persist(); render();
            },
          }],
        });
      }

      /* ── ③ 表にする ── */
      function tableStep() {
        const opt = Object.assign({ desc: true, names: 'full' }, Kit.pref.get('roles:out', {}));
        const st = stMap();
        const who = (id) => { const s = st.get(id); if (!s) return ''; return opt.names === 'no' || School.hidden() || !s.name ? s.no + '番' : opt.names === 'name' ? s.name : s.no + ' ' + s.name; };
        const rows = S.b.roles.map((r) => ({ r, mem: (S.b.assign[r.id] || []).filter((id) => st.has(id)).map(who) }));
        const setOpt = (k, v) => { opt[k] = v; Kit.pref.set('roles:out', opt); render(); };
        const dsc = h('input', { type: 'checkbox', id: 'rl-o-desc', checked: opt.desc, onchange: () => setOpt('desc', dsc.checked) });
        const tsv = () => School.tsv([['係', '人数', '担当', opt.desc ? '仕事の内容' : null].filter((x) => x != null)].concat(rows.map(({ r, mem }) => [r.name, r.count, mem.join('、'), opt.desc ? r.desc : null].filter((x) => x != null))));
        const csv = () => Kit.csv([['係', '人数', '担当', '仕事の内容']].concat(rows.map(({ r, mem }) => [r.name, r.count, mem.join('、'), r.desc])));
        const noRole = S.cls.students.filter((s) => roleOf(s.id).length === 0);
        return h('div', { class: 'stack' },
          h('div', { class: 'rl-out-opts' },
            h('span', { class: 'small ink-2' }, '名前の出し方'), Kit.seg([{ value: 'full', label: '番号と名前' }, { value: 'name', label: '名前だけ' }, { value: 'no', label: '番号だけ' }], opt.names, (v) => setOpt('names', v), { label: '名前の出し方' }),
            h('label', { class: 'check small', for: 'rl-o-desc' }, dsc, '仕事の内容も入れる')),
          h('div', { class: 'btn-row' },
            Kit.btn('一覧表を印刷', () => printList(rows, opt), { kind: 'primary', icon: 'printer' }),
            Kit.btn('掲示用の札を印刷', () => printCards(rows, opt), { icon: 'printer' }),
            Kit.btn('Excel 用にコピー', () => Kit.copy(tsv(), '表をコピーしました（Excel に貼れます）'), { icon: 'copy' }),
            Kit.btn('CSV', async () => { if (await Kit.download('係-' + Kit.safeName(S.cls.name + '-' + S.b.title) + '.csv', csv())) Kit.toast('書き出しました'); }, { icon: 'download', kind: 'ghost' })),
          noRole.length ? h('p', { class: 'small', style: { color: 'var(--warn)' } }, 'まだ係がない人：' + noRole.map((s) => School.label(s)).join('、')) : null,
          h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl rl-table' },
            h('thead', null, h('tr', null, h('th', null, '係'), h('th', { class: 'r' }, '人数'), h('th', null, '担当'), opt.desc ? h('th', null, '仕事の内容') : null)),
            h('tbody', null, rows.map(({ r, mem }) => h('tr', null, h('td', null, h('b', null, r.name)), h('td', { class: 'r' }, mem.length + '/' + r.count), h('td', { class: 'mem' }, mem.join('、') || h('span', { class: 'muted' }, '—')), opt.desc ? h('td', { class: 'desc' }, r.desc) : null))))));
      }
      async function heading() { const p = await Kit.profile.get(); return { title: (S.cls.name || '') + '　' + S.b.title, sub: [p.school && !p._sample ? p.school : '', p.year + '年度'].filter(Boolean).join('　') }; }
      async function printList(rows, opt) {
        const hd = await heading();
        School.print({ landscape: false, build: () => h('div', { class: 'rl-print' }, h('h1', null, hd.title), h('div', { class: 'sub' }, hd.sub),
          h('table', null, h('thead', null, h('tr', null, h('th', null, '係'), h('th', null, '人数'), h('th', null, '担当'), opt.desc ? h('th', null, '仕事の内容') : null)),
            h('tbody', null, rows.map(({ r, mem }) => h('tr', null, h('td', null, h('b', null, r.name)), h('td', { class: 'n' }, r.count), h('td', null, mem.join('、')), opt.desc ? h('td', { class: 'desc' }, r.desc) : null))))) });
      }
      async function printCards(rows, opt) {
        const hd = await heading();
        School.print({ landscape: false, build: () => h('div', { class: 'rl-print' }, h('h1', null, hd.title), h('div', { class: 'sub' }, hd.sub),
          h('div', { class: 'cards' }, rows.map(({ r, mem }) => h('div', { class: 'cardp' }, h('h2', null, r.name), h('div', { class: 'm' }, mem.join('　') || '　'), opt.desc && r.desc ? h('div', { class: 'd' }, r.desc) : null)))) });
      }

      await load();
      if (params && params.board) { const p = S.boards.find((b) => b.id === params.board); if (p) S.b = normBoard(Kit.clone(p)); }
      await render();
      const reload = Kit.debounce(async () => { if (!alive) return; await persist.flush(); await load(); render(); }, 200);
      const offs = [Kit.store.on('coll:classes', reload), Kit.store.on('doc:profile', reload), School.onClassChange(async () => { await persist.flush(); S.b = null; await load(); render(); })];
      return () => { alive = false; offs.forEach((f) => f()); reload.cancel(); persist.flush(); };
    },
  });
})();

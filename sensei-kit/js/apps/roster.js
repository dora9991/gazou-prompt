// 名簿：クラスの名簿を1回入れると、席替え・係決め・宿題チェックで使える
(function () {
  'use strict';
  const { h } = Kit;
  const norm = (s) => String(s || '').replace(/\s+/g, '');
  const GENDER_LABEL = { m: '男', f: '女', '': '—' };

  Kit.css('roster', `
.ro-tabs{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px}
.ro-tab{display:inline-flex;align-items:center;gap:6px;min-height:36px;padding:4px 14px;border-radius:999px;border:1px solid var(--line);background:var(--surface);color:var(--ink-2);font:inherit;font-size:14px;cursor:pointer}
.ro-tab:hover{border-color:var(--gosu)}
.ro-tab[aria-pressed="true"]{background:var(--gosu);border-color:var(--gosu);color:var(--on-gosu);font-weight:700}
.ro-tab .n{font-size:12px;opacity:.8;font-variant-numeric:tabular-nums}
.ro-head{display:flex;flex-wrap:wrap;align-items:flex-end;gap:10px 14px;margin-bottom:12px}
.ro-head .field{flex:1 1 220px;max-width:360px}
.ro-name-input{font-size:17px;font-weight:700}
.ro-table{display:grid;border:1px solid var(--line);border-radius:var(--r);background:var(--surface);overflow:hidden}
.ro-row{display:grid;grid-template-columns:64px minmax(140px,1.4fr) minmax(110px,1fr) 70px 54px minmax(110px,1fr) 40px;gap:6px;align-items:center;padding:6px 10px;border-bottom:1px solid var(--line)}
.ro-row:last-child{border-bottom:0}
.ro-row.ro-th{background:var(--surface-2);font-size:12px;font-weight:700;color:var(--ink-3);padding-top:7px;padding-bottom:7px}
.ro-row input[type=text],.ro-row input[type=number],.ro-row select{min-height:34px;padding:4px 8px;font-size:14.5px}
.ro-row input[type=number]{text-align:right;font-variant-numeric:tabular-nums}
.ro-row .ro-front{justify-self:center}
.ro-row.is-dup input[type=number]{border-color:var(--bad);background:var(--bad-wash)}
.ro-veil{position:relative}
.ro-veil.is-veiled .ro-table{filter:blur(7px);pointer-events:none;user-select:none}
.ro-veil-msg{position:absolute;inset:0;display:grid;place-items:center;z-index:2}
.ro-veil-msg>div{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:14px 16px;box-shadow:var(--shadow-2);display:grid;gap:8px;justify-items:center;text-align:center;max-width:320px}
.ro-tools{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
.ro-paste-prev{max-height:min(40vh,320px);overflow:auto}
.ro-paste-prev td,.ro-paste-prev th{font-size:13px;padding:5px 10px}
.ro-help{margin-top:16px}
.ro-danger{display:flex;justify-content:flex-end;margin-top:16px;padding-top:12px;border-top:1px dashed var(--line)}
/* 空の欄は静かに（入っている欄が目立つように）。番号の上下の矢印は出さない */
.ro-row input[type=text]:placeholder-shown{background:transparent;border-color:var(--line)}
.ro-row input[type=text]:placeholder-shown:focus{background:var(--surface);border-color:var(--focus)}
.ro-row input[type=number]{-moz-appearance:textfield;appearance:textfield}
.ro-row input[type=number]::-webkit-inner-spin-button,.ro-row input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
@media (max-width:760px){
  .ro-row{grid-template-columns:50px minmax(0,1fr) minmax(0,1fr) 62px 38px;grid-template-areas:"no name name gender del" "no kana note front front";row-gap:6px;column-gap:6px;padding:8px}
  .ro-row.ro-th{display:none}
  .ro-row>.c-no{grid-area:no;align-self:start}.ro-row>.c-name{grid-area:name}.ro-row>.c-kana{grid-area:kana}
  .ro-row>.c-gender{grid-area:gender}.ro-row>.c-front{grid-area:front;justify-self:start;display:flex;align-items:center;gap:4px;font-size:12px}
  .ro-row>.c-note{grid-area:note}.ro-row>.c-del{grid-area:del}
  .ro-front-l{display:inline!important}
}
.ro-front-l{display:none}
`);

  Kit.app({
    id: 'roster', title: '名簿', group: 'class', icon: 'users', order: 10,
    desc: 'クラスの名簿。1回入れると、席替え・係決め・宿題チェックで使えます',
    colls: ['classes'],
    async mount(root, params) {
      let classes = [], cur = null, showAnyway = false;
      const sampleSlot = h('div'), tabs = h('div', { class: 'ro-tabs', role: 'group', 'aria-label': 'クラス' }), body = h('div');
      root.append(Kit.appHead({
        title: '名簿',
        desc: '1回入れると、席替え・係・当番・宿題で使えます。番号だけでも使えます。',
        actions: [Kit.btn('クラスを追加', () => addClass(), { icon: 'plus' }), Kit.btn('名簿を貼り付ける', () => openPaste(), { kind: 'primary', icon: 'copy' })],
      }), sampleSlot, tabs, body);

      const sig = (c) => (c ? JSON.stringify([c.name, c.students]) : '');
      async function load() {
        classes = await School.classes.list();
        const want = (params && params.class) || Kit.pref.get('class', null) || (cur && cur.id);
        cur = Kit.clone(classes.find((c) => c.id === want) || classes[0] || null);
      }
      function render() { renderSample(); renderTabs(); renderBody(); }

      function renderSample() {
        Kit.clear(sampleSlot);
        if (!classes.some((c) => c.sample)) return;
        sampleSlot.append(Kit.sampleBar('「2年3組」は架空のクラスです。名簿を貼り付けると、自分のクラスで使えます。', clearSamples));
      }
      async function clearSamples() {
        const ok = await Kit.confirm({ title: 'サンプルを片付けますか？', body: 'すべての道具から、架空のクラス（2年3組）とその席・係・宿題などの例を消します。自分で入れたものは消えません。', ok: '片付ける' });
        if (!ok) return;
        await Kit.store.samplesOff();
        Kit.toast('サンプルを片付けました');
        await load(); render();
      }
      function renderTabs() {
        Kit.clear(tabs);
        if (classes.length < 2) return;
        for (const c of classes) {
          tabs.append(h('button', { type: 'button', class: 'ro-tab', 'aria-pressed': String(!!cur && c.id === cur.id), onclick: () => { School.classes.setCurrent(c.id); cur = Kit.clone(c); showAnyway = false; render(); } },
            c.name || '（名前なし）', h('span', { class: 'n' }, c.students.length + '人')));
        }
      }

      /* ── クラスの中身（表） ── */
      const persist = Kit.debounce(async () => { if (cur) { await School.classes.save(cur); } }, 400);
      function renderBody() {
        Kit.clear(body);
        if (!cur) {
          body.append(Kit.empty({
            title: 'まだクラスがありません',
            body: 'Excel の名簿をコピーして貼り付けるか、人数だけ入れて出席番号の名簿を作れます。',
            actions: [Kit.btn('名簿を貼り付ける', () => openPaste(), { kind: 'primary', icon: 'copy' }), Kit.btn('番号だけで作る', () => addClass(), { icon: 'plus' })],
          }));
          return;
        }
        const nameIn = h('input', { type: 'text', id: 'ro-class-name', class: 'ro-name-input', maxlength: 30, placeholder: '例：2年3組' });
        nameIn.value = cur.name || '';
        nameIn.addEventListener('input', () => { cur.name = nameIn.value.trim(); persist(); });
        nameIn.addEventListener('change', async () => { await persist.flush(); await reload(); });
        const genderN = (g) => cur.students.filter((s) => s.gender === g).length;
        body.append(h('div', { class: 'ro-head' },
          Kit.field({ label: 'クラスの名前', input: nameIn }),
          h('span', { class: 'small ink-2 num', style: { paddingBottom: '8px' } }, cur.students.length + '人' + (genderN('m') + genderN('f') ? '（男 ' + genderN('m') + '・女 ' + genderN('f') + '）' : '')),
          h('span', { class: 'grow' })));

        const veil = h('div', { class: 'ro-veil' + (School.hidden() && !showAnyway ? ' is-veiled' : '') });
        const table = h('div', { class: 'ro-table', role: 'group', 'aria-label': (cur.name || 'クラス') + 'の名簿' });
        table.append(h('div', { class: 'ro-row ro-th', 'aria-hidden': 'true' },
          ['番号', '氏名', 'ふりがな', '性別', '前の席', 'メモ（配慮など）', ''].map((t) => h('span', null, t))));
        const counts = {};
        for (const s of cur.students) counts[s.no] = (counts[s.no] || 0) + 1;
        cur.students.forEach((s, i) => table.append(row(s, i, counts[s.no] > 1)));
        if (!cur.students.length) table.append(h('p', { class: 'small muted', style: { padding: '14px' } }, 'まだ生徒がいません。「名簿を貼り付ける」か「1人ふやす」で入れてください。'));
        veil.append(table);
        if (School.hidden() && !showAnyway) {
          veil.append(h('div', { class: 'ro-veil-msg' }, h('div', null, h('b', null, '「名前を隠す」がオンです'), h('span', { class: 'small ink-2' }, '教室で画面を映しているときのために、名簿を隠しています。'),
            Kit.btn('この画面だけ表示する', () => { showAnyway = true; renderBody(); }, { sm: true, icon: 'eye' }))));
        }
        body.append(veil);
        if (Object.values(counts).some((n) => n > 1)) body.append(h('p', { class: 'small', style: { color: 'var(--bad)', marginTop: '8px' } }, '同じ番号の人がいます（赤い枠）。番号を直すか「番号をつけ直す」を押してください。'));

        body.append(h('div', { class: 'ro-tools' },
          Kit.btn('1人ふやす', addStudent, { icon: 'plus' }),
          Kit.btn('番号をつけ直す（1から順に）', renumber, { icon: 'refresh', kind: 'ghost' }),
          h('span', { class: 'grow' }),
          Kit.btn('番号と氏名をコピー', copyRoster, { icon: 'copy', title: 'かんたん成績・Excel にそのまま貼れます' }),
          Kit.btn('CSV で書き出す', exportCsv, { icon: 'download', kind: 'ghost' })));
        body.append(h('details', { class: 'help ro-help' }, h('summary', null, 'ほかの道具とのつながり・名簿の扱い'),
          h('ul', null,
            h('li', null, '「番号と氏名をコピー」は、かんたん成績の名簿や Excel にそのまま貼れる形（1行に「番号　氏名」）です。'),
            h('li', null, '「前の席」に印をつけた人は、席替えで前のほうの席になります。性別は、席替えの「男女を交互に」だけに使います（空欄でもかまいません）。'),
            h('li', null, '名簿はこのブラウザの中だけに保存されます。学校の決まりで名前を入れられないときは、番号だけで使ってください。'),
            h('li', null, '生徒を消すと、その人の席・係・提出の記録は表示されなくなります。'))));
        // クラスを消すのは、いちばん下に（ふだん押さないので目立たせない）
        body.append(h('div', { class: 'ro-danger' }, Kit.btn('このクラスを消す', () => removeClass(), { sm: true, kind: 'danger', icon: 'trash' })));
      }

      function row(s, i, dup) {
        const id = 'ro-' + i;
        const no = h('input', { type: 'number', min: 1, max: 999, step: 1, inputmode: 'numeric', 'aria-label': '番号', id: id + '-no', class: 'c-no-in' });
        no.value = s.no == null ? '' : String(s.no);
        const name = h('input', { type: 'text', maxlength: 40, placeholder: '（番号だけでも可）', 'aria-label': (s.no || '') + '番の氏名', id: id + '-name' });
        name.value = s.name || '';
        const kana = h('input', { type: 'text', maxlength: 40, placeholder: 'ふりがな', 'aria-label': (s.no || '') + '番のふりがな', id: id + '-kana' });
        kana.value = s.kana || '';
        const gender = h('select', { 'aria-label': (s.no || '') + '番の性別', id: id + '-g' }, [['', '—'], ['m', '男'], ['f', '女']].map(([v, l]) => h('option', { value: v }, l)));
        gender.value = s.gender || '';
        const front = h('input', { type: 'checkbox', checked: !!s.front, id: id + '-front', 'aria-label': (s.no || '') + '番は前の席' });
        const note = h('input', { type: 'text', maxlength: 60, placeholder: 'メモ', 'aria-label': (s.no || '') + '番のメモ', id: id + '-note' });
        note.value = s.note || '';
        const upd = () => {
          const n = parseInt(no.value, 10);
          Object.assign(s, { no: Number.isFinite(n) && n > 0 ? n : s.no, name: name.value.replace(/\s+/g, ' ').trim(), kana: kana.value.trim(), gender: gender.value, front: front.checked, note: note.value.trim() });
          persist();
        };
        for (const el of [name, kana, note]) el.addEventListener('input', upd);
        for (const el of [gender, front]) el.addEventListener('change', upd);
        no.addEventListener('change', () => { upd(); cur.students.sort((a, b) => a.no - b.no); renderBody(); });
        return h('div', { class: 'ro-row' + (dup ? ' is-dup' : '') },
          h('span', { class: 'c-no' }, no), h('span', { class: 'c-name' }, name), h('span', { class: 'c-kana' }, kana),
          h('span', { class: 'c-gender' }, gender), h('label', { class: 'c-front ro-front', for: id + '-front' }, front, h('span', { class: 'ro-front-l' }, '前')),
          h('span', { class: 'c-note' }, note),
          h('span', { class: 'c-del' }, Kit.btn('', () => removeStudent(s), { icon: 'trash', kind: 'ghost', sm: true, title: (s.no || '') + '番を名簿から消す' })));
      }

      async function addStudent() {
        const next = cur.students.reduce((m, s) => Math.max(m, s.no || 0), 0) + 1;
        cur.students.push({ id: Kit.uid('st'), no: next, name: '', kana: '', gender: '', front: false, note: '' });
        await School.classes.save(cur);
        renderBody();
        const inp = body.querySelector('.ro-row:last-child .c-name input');
        if (inp) inp.focus();
      }
      async function removeStudent(s) {
        const ok = await Kit.confirm({ title: '名簿から消しますか？', body: (s.no || '') + '番 ' + (School.hidden() ? '' : s.name || '') + ' を名簿から消します。この人の席・係・提出の記録は表示されなくなります。', ok: '消す', danger: true });
        if (!ok) return;
        const before = Kit.clone(cur);
        cur.students = cur.students.filter((x) => x.id !== s.id);
        await School.classes.save(cur);
        renderBody();
        Kit.toast('名簿から消しました', { action: { label: '元に戻す', onClick: async () => { cur = before; await School.classes.save(cur); renderBody(); } } });
      }
      async function renumber() {
        const ok = await Kit.confirm({ title: '番号をつけ直しますか？', body: 'いまの並び順のまま、1番から順に番号をつけ直します。', ok: 'つけ直す' });
        if (!ok) return;
        cur.students.forEach((s, i) => { s.no = i + 1; });
        await School.classes.save(cur);
        renderBody();
      }
      async function copyRoster() {
        if (!cur.students.length) { Kit.toast('まだ生徒がいません', { type: 'bad' }); return; }
        await Kit.copy(School.tsv(cur.students.map((s) => [s.no, s.name || ''])), '番号と氏名をコピーしました（かんたん成績・Excel に貼れます）');
      }
      async function exportCsv() {
        if (!cur.students.length) { Kit.toast('まだ生徒がいません', { type: 'bad' }); return; }
        const rows = [['番号', '氏名', 'ふりがな', '性別', '前の席', 'メモ']].concat(cur.students.map((s) => [s.no, s.name || '', s.kana || '', s.gender ? GENDER_LABEL[s.gender] : '', s.front ? '○' : '', s.note || '']));
        if (await Kit.download('名簿-' + Kit.safeName(cur.name || 'クラス') + '.csv', Kit.csv(rows))) Kit.toast('名簿を書き出しました');
      }

      /* ── クラスの追加・削除 ── */
      async function addClass(o = {}) {
        const name = h('input', { type: 'text', id: 'ro-new-name', maxlength: 30, placeholder: '例：2年3組' });
        const count = h('input', { type: 'number', id: 'ro-new-count', min: 0, max: 60, step: 1, inputmode: 'numeric', placeholder: '例：32' });
        name.value = o.name || '';
        const body2 = h('div', { class: 'stack' },
          Kit.field({ label: 'クラスの名前', input: name }),
          Kit.field({ label: '人数（番号だけの名簿を作るとき）', input: count, hint: '空欄なら空のクラスを作ります。あとから「名簿を貼り付ける」で名前を入れられます。' }));
        const res = await new Promise((resolve) => Kit.modal({
          title: 'クラスを追加', body: body2, autofocus: 'input', onClose: (v) => resolve(v || null),
          actions: [{ label: 'やめる', kind: 'ghost' }, {
            label: '追加する', kind: 'primary', onClick: () => {
              if (!name.value.trim()) { Kit.toast('クラスの名前を入れてください', { type: 'bad' }); name.focus(); return false; }
              const n = Kit.clamp(parseInt(count.value, 10) || 0, 0, 60);
              return { name: name.value.trim(), n };
            },
          }],
        }));
        if (!res) return null;
        const c = { id: Kit.uid('class'), name: res.name, students: Array.from({ length: res.n }, (_, i) => ({ id: Kit.uid('st'), no: i + 1, name: '', kana: '', gender: '', front: false, note: '' })) };
        const saved = await School.classes.save(c);
        School.classes.setCurrent(saved.id);
        Kit.toast('「' + saved.name + '」を追加しました');
        await load(); render();
        return saved;
      }
      async function removeClass() {
        const ok = await Kit.confirm({ title: '「' + (cur.name || 'このクラス') + '」を消しますか？', body: '名簿と、このクラスの席・係・宿題の記録をすべて消します。元に戻せません（心配なら、先にホームからバックアップを書き出してください）。', ok: '消す', danger: true });
        if (!ok) return;
        await School.classes.remove(cur.id);
        cur = null;
        Kit.toast('クラスを消しました');
        await load(); render();
      }

      /* ── 貼り付け ── */
      function merge(old, parsed) {
        const used = new Set();
        return parsed.map((p) => {
          let m = null;
          if (p.name) m = old.find((s) => !used.has(s.id) && s.name && norm(s.name) === norm(p.name));
          if (!m) m = old.find((s) => !used.has(s.id) && s.no === p.no && (!s.name || !p.name));
          if (m) used.add(m.id);
          return { id: m ? m.id : Kit.uid('st'), no: p.no, name: p.name, kana: p.kana || (m && m.kana) || '', gender: p.gender || (m && m.gender) || '', front: p.front || !!(m && m.front), note: (m && m.note) || '' };
        });
      }
      function openPaste() {
        const ta = h('textarea', { id: 'ro-paste', rows: 8, placeholder: '例）\n1\t青木 そら\n2\t井上 ゆい\n3\t上田 はると\n（Excel の名簿をそのままコピーして貼り付けられます）' });
        const prev = h('div', { 'aria-live': 'polite' });
        const newName = h('input', { type: 'text', id: 'ro-paste-name', maxlength: 30, placeholder: '例：2年3組' });
        const canReplace = !!cur;
        let mode = canReplace && !cur.sample ? 'replace' : 'new';
        let parsed = [];
        const modeSeg = Kit.seg([
          ...(canReplace ? [{ value: 'replace', label: '「' + (cur.name || 'いまのクラス') + '」を置きかえる' }, { value: 'add', label: '「' + (cur.name || 'いまのクラス') + '」に追加' }] : []),
          { value: 'new', label: '新しいクラスにする' },
        ], mode, (v) => { mode = v; nameF.hidden = mode !== 'new'; }, { label: '入れ方' });
        const nameF = Kit.field({ label: '新しいクラスの名前', input: newName });
        nameF.hidden = mode !== 'new';
        const show = () => {
          parsed = School.parseRoster(ta.value);
          Kit.clear(prev);
          if (!ta.value.trim()) { prev.append(h('p', { class: 'small muted' }, '1行に1人。「氏名」「番号 氏名」「組 番号 氏名」「番号 姓 名」などの形を読めます。見出しの行（番号・氏名・ふりがな・性別）があれば、それに合わせます。')); return; }
          if (!parsed.length) { prev.append(h('p', { class: 'small', style: { color: 'var(--bad)' } }, '名簿として読めませんでした。1行に1人ずつ並んでいるか確かめてください。')); return; }
          const g = (x) => GENDER_LABEL[x.gender || ''];
          prev.append(h('p', { class: 'small' }, parsed.length + '人を読み取りました。確かめてください。'),
            h('div', { class: 'tbl-wrap ro-paste-prev' }, h('table', { class: 'tbl' },
              h('thead', null, h('tr', null, ['番号', '氏名', 'ふりがな', '性別', '前の席'].map((t) => h('th', null, t)))),
              h('tbody', null, parsed.map((p) => h('tr', null, h('td', { class: 'r' }, p.no), h('td', null, p.name || '（名前なし）'), h('td', null, p.kana || ''), h('td', null, g(p)), h('td', null, p.front ? '○' : '')))))));
        };
        ta.addEventListener('input', show);
        show();
        const body2 = h('div', { class: 'stack' }, Kit.field({ label: '名簿（Excel からコピーして貼り付け）', input: ta }), prev, Kit.field({ label: '入れ方', input: modeSeg }), nameF,
          h('p', { class: 'small muted' }, '置きかえるときは、同じ名前（名前がなければ同じ番号）の人の席・係・提出の記録を引き継ぎます。'));
        Kit.modal({
          title: '名簿を貼り付ける', wide: true, body: body2, autofocus: 'input',
          actions: [{ label: 'やめる', kind: 'ghost' }, {
            label: '名簿に入れる', kind: 'primary', onClick: async () => {
              show();
              if (!parsed.length) { Kit.toast('名簿を貼り付けてください', { type: 'bad' }); ta.focus(); return false; }
              if (mode === 'new') {
                if (!newName.value.trim()) { Kit.toast('新しいクラスの名前を入れてください', { type: 'bad' }); newName.focus(); return false; }
                const c = await School.classes.save({ id: Kit.uid('class'), name: newName.value.trim(), students: merge([], parsed) });
                School.classes.setCurrent(c.id);
                Kit.toast('「' + c.name + '」に' + parsed.length + '人を入れました');
              } else if (mode === 'replace') {
                cur.students = merge(cur.students, parsed);
                await School.classes.save(cur);
                Kit.toast('名簿を置きかえました（' + parsed.length + '人）');
              } else {
                const fresh = merge([], parsed);
                cur.students = cur.students.concat(fresh);
                await School.classes.save(cur);
                Kit.toast(parsed.length + '人を追加しました');
              }
              await load(); render();
              return true;
            },
          }],
        });
      }

      async function reload() { await load(); render(); }
      await load();
      render();
      // ほかのタブ・バックアップからの読み込みなどで変わったときだけ描きなおす（自分の入力中は描きなおさない）
      const onStore = Kit.debounce(async () => {
        const before = sig(cur);
        const all = await School.classes.list();
        const now = cur ? all.find((c) => c.id === cur.id) : null;
        if (!cur || !now || sig(now) !== before) { classes = all; if (!now) cur = null; await load(); render(); }
        else { classes = all; renderTabs(); renderSample(); }
      }, 250);
      const offs = [Kit.store.on('coll:classes', onStore), School.onClassChange(() => { showAnyway = false; load().then(render); })];
      return () => { offs.forEach((f) => f()); onStore.cancel(); persist.flush(); };
    },
  });
})();

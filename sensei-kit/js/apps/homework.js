// 宿題・提出チェック：出した宿題を、名簿で「済・遅れ・免除」をつけて数える。配る文・QR、かんたん成績へのCSVも
(function () {
  'use strict';
  const { h } = Kit;
  const STATES = [
    { id: '', label: 'まだ', short: '—' },
    { id: 'done', label: '済', short: '済' },
    { id: 'late', label: '遅れ', short: '遅' },
    { id: 'exempt', label: '免除', short: '免' },
  ];
  const next = (s) => { const i = STATES.findIndex((x) => x.id === (s || '')); return STATES[(i + 1) % STATES.length].id; };
  const md = (s) => Kit.fmtDate(s, 'M/D(W)');

  // サンプル（架空のクラス）
  const SC = School.SAMPLE_CLASS;
  const checks = (seed, rate) => { const rand = School.rng(seed), o = {}; for (const s of SC.students) { const x = rand(); o[s.id] = x < rate ? 'done' : x < rate + 0.08 ? 'late' : ''; } return o; };
  const SAMPLE = [
    { id: 's-hw-1', classId: SC.id, subject: '数学', title: 'ワーク P.24〜25（連立方程式）', assigned: Kit.rel(-3), due: Kit.rel(0), note: '答え合わせまでして出す', link: '', checks: checks(11, 0.72), closed: false },
    { id: 's-hw-2', classId: SC.id, subject: '数学', title: '学習プリント No.7', assigned: Kit.rel(-1), due: Kit.rel(2), note: '', link: '', checks: {}, closed: false },
    { id: 's-hw-3', classId: SC.id, subject: '数学', title: '夏休みの課題（数学）', assigned: Kit.rel(-80), due: Kit.rel(-40), note: '', link: '', checks: checks(5, 0.86), closed: true },
  ];
  Kit.store.sample('homework', SAMPLE);
  School.classes.onRemove(School.removeByClass('homework'));

  Kit.css('homework', `
.hw-list{display:grid;gap:10px}
.hw-card{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px 14px;align-items:center;padding:12px 14px;border:1px solid var(--line);border-radius:var(--r);background:var(--surface)}
.hw-card.is-closed{opacity:.75}
.hw-title{font-weight:700;font-size:15.5px;overflow-wrap:anywhere}
.hw-meta{display:flex;flex-wrap:wrap;gap:4px 10px;align-items:center;font-size:12.5px;color:var(--ink-3)}
.hw-meta .late{color:var(--bad);font-weight:700}
.hw-prog{display:grid;gap:4px;min-width:150px}
.hw-prog .num{font-size:13px;color:var(--ink-2)}
.hw-acts{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:6px}
.hw-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(98px,1fr));gap:6px}
.hw-st{display:grid;gap:1px;justify-items:center;align-content:center;min-height:62px;padding:4px;border-radius:8px;border:1.5px solid var(--line-strong);background:var(--surface);color:var(--ink);font:inherit;cursor:pointer;text-align:center}
.hw-st .no{font-size:11px;color:var(--ink-3);font-variant-numeric:tabular-nums}
.hw-st .nm{font-size:13.5px;font-weight:700;line-height:1.2;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hw-st .s{font-size:12px;font-weight:700}
.hw-st.done{background:var(--ok-wash);border-color:var(--ok)}.hw-st.done .s{color:var(--ok)}
.hw-st.late{background:var(--warn-wash);border-color:var(--warn)}.hw-st.late .s{color:var(--warn)}
.hw-st.exempt{background:var(--surface-2);border-style:dashed}.hw-st.exempt .s{color:var(--ink-3)}
.hw-st.none .s{color:var(--ink-3)}
.hw-legend{display:flex;flex-wrap:wrap;gap:6px 12px;font-size:12.5px;color:var(--ink-2);align-items:center}
.hw-sum{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:14px;align-items:center}
.hw-sum b{font-variant-numeric:tabular-nums}
.hw-dist{font-size:15px;line-height:1.8;white-space:pre-wrap;background:var(--surface-2);border-radius:8px;padding:10px 12px}
.hw-qr{width:160px;height:160px;image-rendering:pixelated;border:1px solid var(--line);border-radius:6px}
`);

  Kit.app({
    id: 'homework', title: '宿題・提出', group: 'lesson', icon: 'clipboard', order: 50,
    desc: '出した宿題を名簿でチェック。未提出がすぐ分かる。かんたん成績へも',
    colls: ['homework'],
    async mount(root, params) {
      const S = { cls: null, list: [], open: null, past: false };
      let alive = true;
      const classSlot = h('div'), sampleSlot = h('div'), main = h('div');
      root.append(Kit.appHead({
        title: '宿題・提出',
        desc: '出した宿題を、名簿をタップしてチェック。まだの人がすぐ分かります。',
        actions: [Kit.btn('宿題を出す', () => edit(null), { kind: 'primary', icon: 'plus' }), Kit.btn('かんたん成績へ（CSV）', () => exportCsv(), { icon: 'download', kind: 'ghost' })],
      }), classSlot, sampleSlot, main);

      async function load() {
        S.cls = await School.classes.current();
        const all = await Kit.store.list('homework');
        S.list = S.cls ? all.filter((x) => x.classId === S.cls.id) : [];
      }
      const stats = (hw) => {
        const st = S.cls.students, c = hw.checks || {};
        const n = { done: 0, late: 0, exempt: 0, none: 0 };
        for (const s of st) { const v = c[s.id] || ''; if (v === 'done') n.done++; else if (v === 'late') n.late++; else if (v === 'exempt') n.exempt++; else n.none++; }
        n.total = st.length - n.exempt;
        n.in = n.done + n.late;
        return n;
      };
      async function render() {
        Kit.clear(classSlot); Kit.clear(sampleSlot); Kit.clear(main);
        classSlot.append(await School.classBar({ onChange: async () => { await load(); render(); } }));
        if (!S.cls) { main.append(Kit.empty({ title: '提出チェックには名簿が要ります', body: '名簿にクラスを入れると、ここで宿題の提出を記録できます。', actions: [Kit.btn('名簿を開く', () => Kit.go('roster'), { kind: 'primary', icon: 'users' })] })); return; }
        if (S.list.some((x) => x.sample)) sampleSlot.append(Kit.sampleBar('架空のクラスの宿題の例です。「チェック」を押して、名前をタップしてみてください。'));
        const t = Kit.ymd();
        const open = S.list.filter((x) => !x.closed).sort((a, b) => String(a.due || '9999').localeCompare(String(b.due || '9999')));
        const closed = S.list.filter((x) => x.closed).sort((a, b) => String(b.due || '').localeCompare(String(a.due || '')));
        if (!S.list.length) main.append(Kit.empty({ title: 'まだ宿題がありません', body: '「宿題を出す」で、題名と締切を入れてください。', actions: [Kit.btn('宿題を出す', () => edit(null), { kind: 'primary', icon: 'plus' })] }));
        main.append(h('div', { class: 'hw-list' }, open.map((x) => card(x, t))));
        if (closed.length) {
          const cb = h('input', { type: 'checkbox', id: 'hw-past', checked: S.past, onchange: () => { S.past = cb.checked; render(); } });
          main.append(h('div', { style: { marginTop: '16px' } }, h('label', { class: 'check', for: 'hw-past' }, cb, '締めた宿題も見る（' + closed.length + '）')));
          if (S.past) main.append(h('div', { class: 'hw-list', style: { marginTop: '8px' } }, closed.map((x) => card(x, t))));
        }
        main.append(h('details', { class: 'help', style: { marginTop: '18px' } }, h('summary', null, '生徒に配る・ほかの道具とのつながり'),
          h('ul', null,
            h('li', null, '「配る文」で、そのまま黒板に書いたり、Classroom・Teams・連絡帳アプリに貼れる文と、資料のQRコードを出せます。'),
            h('li', null, '「かんたん成績へ（CSV）」で、1人ずつの提出数を書き出せます。かんたん成績の「取り込み」から入れられます（確認画面で番号・名前を合わせます）。'),
            h('li', null, '生徒の端末に宿題を配って、そのまま提出してもらうしくみ（配布・提出）は、名簿とアカウントのある数学ポータル側でつくるのが近道です（この道具箱はサーバーを使わないため）。'))));
        if (params && params.id) { const p = params; params = {}; const hw = S.list.find((x) => x.id === p.id); if (hw) openCheck(hw); }
      }
      function card(x, t) {
        const n = stats(x);
        const late = x.due && x.due < t && !x.closed;
        const rel = x.due ? (x.due === t ? '今日まで' : x.due === Kit.rel(1) ? '明日まで' : md(x.due) + 'まで') : '締切なし';
        return h('div', { class: 'hw-card' + (x.closed ? ' is-closed' : '') },
          h('div', { style: { minWidth: 0 } },
            h('div', { class: 'hw-title' }, x.title || '（題名なし）'),
            h('div', { class: 'hw-meta' }, x.subject ? h('span', { class: 'chip blue' }, x.subject) : null, h('span', { class: late ? 'late' : '' }, rel + (late ? '（' + (-Kit.daysBetween(t, x.due)) + '日すぎ）' : '')), x.closed ? h('span', { class: 'chip' }, '締めた') : null, x.sample ? h('span', { class: 'chip sample' }, '例') : null)),
          h('div', { class: 'hw-prog' },
            h('span', { class: 'num' }, '提出 ', h('b', null, n.in), ' / ' + n.total + '人' + (n.late ? '（遅れ ' + n.late + '）' : '')),
            h('div', { class: 'meter' + (n.in >= n.total ? ' ok' : ''), role: 'progressbar', 'aria-label': '提出の割合', 'aria-valuenow': n.total ? Math.round((n.in / n.total) * 100) : 0, 'aria-valuemin': 0, 'aria-valuemax': 100 }, h('i', { style: { width: (n.total ? (n.in / n.total) * 100 : 0).toFixed(1) + '%' } }))),
          h('div', { class: 'hw-acts' },
            Kit.btn('チェック', () => openCheck(x), { sm: true, kind: 'primary', icon: 'checks' }),
            Kit.btn('まだの人をコピー', () => copyMissing(x), { sm: true, icon: 'copy', disabled: !n.none }),
            Kit.btn('配る文', () => dist(x), { sm: true, icon: 'send' }),
            Kit.btn('直す', () => edit(x), { sm: true, kind: 'ghost', icon: 'edit' }),
            Kit.btn(x.closed ? '締めを外す' : '締める', () => save(Object.assign({}, x, { closed: !x.closed })), { sm: true, kind: 'ghost', icon: x.closed ? 'undo' : 'lock' })));
      }
      const save = (x) => { const it = Object.assign({}, x); delete it.sample; return Kit.store.put('homework', it); };
      const missing = (x) => S.cls.students.filter((s) => !(x.checks || {})[s.id]);
      async function copyMissing(x) {
        const m = missing(x);
        if (!m.length) { Kit.toast('全員出しています'); return; }
        await Kit.copy('【まだの人】' + (x.title || '') + '\n' + m.map((s) => School.label(s)).join('、'), 'まだの人（' + m.length + '人）をコピーしました');
      }
      function openCheck(x0) {
        let x = Kit.clone(x0);
        x.checks = x.checks || {};
        const grid = h('div', { class: 'hw-grid', role: 'group', 'aria-label': '提出のチェック' });
        const sum = h('div', { class: 'hw-sum', 'aria-live': 'polite' });
        const persist = Kit.debounce(() => save(x), 300);
        const draw = () => {
          Kit.clear(grid);
          for (const s of S.cls.students) {
            const v = x.checks[s.id] || '';
            const st = STATES.find((y) => y.id === v);
            grid.append(h('button', { type: 'button', class: 'hw-st ' + (v || 'none'), 'aria-label': School.label(s) + '：' + st.label + '（押すと次へ）', onclick: () => { const nv = next(v); if (nv) x.checks[s.id] = nv; else delete x.checks[s.id]; persist(); draw(); } },
              h('span', { class: 'no' }, s.no), h('span', { class: 'nm' }, School.hidden() || !s.name ? s.no + '番' : s.name.split(' ')[0]), h('span', { class: 's' }, st.label)));
          }
          const n = stats(x);
          Kit.clear(sum);
          sum.append(h('span', null, '済 ', h('b', null, n.done)), h('span', null, '遅れ ', h('b', null, n.late)), h('span', null, '免除 ', h('b', null, n.exempt)), h('span', { style: { color: n.none ? 'var(--bad)' : 'var(--ok)' } }, 'まだ ', h('b', null, n.none)));
        };
        draw();
        const m = Kit.modal({
          title: x.title || '提出のチェック', wide: true,
          body: h('div', { class: 'stack' },
            h('div', { class: 'hw-legend' }, '名前を押すたびに', STATES.map((y, i) => h('span', null, (i ? '→ ' : '') + y.label)), 'と変わります。'),
            sum, grid,
            h('div', { class: 'btn-row' },
              Kit.btn('まだの人を全員「済」に', () => { for (const s of S.cls.students) if (!x.checks[s.id]) x.checks[s.id] = 'done'; persist(); draw(); }, { sm: true, icon: 'check' }),
              Kit.btn('全部を「まだ」に戻す', () => { x.checks = {}; persist(); draw(); }, { sm: true, kind: 'ghost', icon: 'undo' }),
              Kit.btn('まだの人をコピー', () => copyMissing(x), { sm: true, icon: 'copy' }),
              Kit.appDef('templates') ? Kit.btn('保護者への連絡文', () => { persist.flush(); m.close(); Kit.go('templates', { id: 'p-teishutsu', vals: { 提出物: x.title || '', 締切: x.due && window.Letters ? window.Letters.jpDate(x.due) : '' } }); }, { sm: true, icon: 'mail', kind: 'ghost' }) : null)),
          actions: [{ label: '閉じる', kind: 'primary', onClick: () => { persist.flush(); } }],
          onClose: () => persist.flush(),
        });
      }
      function dist(x) {
        const text = '【宿題】' + (x.subject ? x.subject + '　' : '') + (x.title || '') + (x.due ? '\n締切：' + Kit.fmtDate(x.due, 'M月D日(W)') : '') + (x.note ? '\n' + x.note : '') + (x.link ? '\n資料：' + x.link : '');
        const body = h('div', { class: 'stack' }, h('div', { class: 'hw-dist' }, text), h('div', { class: 'btn-row' }, Kit.btn('文をコピー', () => Kit.copy(text, '配る文をコピーしました'), { kind: 'primary', icon: 'copy' })));
        if (x.link && window.qrcode) {
          try { const c = Kit.qr(x.link, { cell: 5, level: 'M' }); c.classList.add('hw-qr'); c.setAttribute('role', 'img'); c.setAttribute('aria-label', '資料のQRコード'); body.append(h('div', { class: 'row' }, c, h('span', { class: 'small muted' }, '教室で映すと、生徒がタブレットで読み取れます。'))); } catch (e) { /* 長すぎる */ }
        }
        Kit.modal({ title: '配る文', body, actions: [{ label: '閉じる', kind: 'ghost' }] });
      }
      async function edit(x) {
        const isNew = !x;
        const p = await Kit.profile.get();
        const d = Object.assign({ subject: p.subject || '', title: '', assigned: Kit.ymd(), due: Kit.rel(2), note: '', link: '' }, x || {});
        const f = {
          subject: h('input', { type: 'text', id: 'hw-f-subj', maxlength: 20, value: d.subject, placeholder: '例：数学' }),
          title: h('input', { type: 'text', id: 'hw-f-title', maxlength: 120, value: d.title, placeholder: '例：ワーク P.24〜25' }),
          assigned: h('input', { type: 'date', id: 'hw-f-as', value: d.assigned || '' }),
          due: h('input', { type: 'date', id: 'hw-f-due', value: d.due || '' }),
          note: h('textarea', { id: 'hw-f-note', rows: 2, placeholder: '例：答え合わせまでして出す' }),
          link: h('input', { type: 'url', id: 'hw-f-link', value: d.link || '', placeholder: '資料のURL（あればQRにできます）' }),
        };
        f.note.value = d.note || '';
        const m = Kit.modal({
          title: isNew ? '宿題を出す（' + S.cls.name + '）' : '宿題を直す', autofocus: 'input', wide: true,
          body: h('div', { class: 'stack' }, h('div', { class: 'grid cols-2' }, Kit.field({ label: '題名', input: f.title }), Kit.field({ label: '教科', input: f.subject })),
            h('div', { class: 'grid cols-2' }, Kit.field({ label: '出した日', input: f.assigned }), Kit.field({ label: '締切', input: f.due, hint: '締切はカレンダーにも出ます。' })),
            Kit.field({ label: 'メモ', input: f.note }), Kit.field({ label: '資料のURL（任意）', input: f.link })),
          actions: (isNew ? [] : [{ label: '消す', kind: 'danger', onClick: async () => { if (!(await Kit.confirm({ title: 'この宿題を消しますか？', body: '提出の記録も消えます。', ok: '消す', danger: true }))) return false; await Kit.store.remove('homework', x.id); Kit.toast('消しました'); return true; } }])
            .concat([{ label: 'やめる', kind: 'ghost' }, {
              label: isNew ? '出す' : '保存する', kind: 'primary', onClick: async () => {
                if (!f.title.value.trim()) { Kit.toast('題名を入れてください', { type: 'bad' }); f.title.focus(); return false; }
                const it = Object.assign({ checks: {}, closed: false }, x || {}, { classId: S.cls.id, subject: f.subject.value.trim(), title: f.title.value.trim(), assigned: f.assigned.value, due: f.due.value, note: f.note.value.trim(), link: f.link.value.trim() });
                await save(it);
                Kit.toast(isNew ? '宿題を出しました' : '保存しました');
                return true;
              },
            }]),
        });
        const delBtn = m.el.querySelector('.modal-f .btn.danger');
        if (delBtn) delBtn.style.marginRight = 'auto';
      }
      async function exportCsv() {
        if (!S.cls || !S.list.length) { Kit.toast('宿題がありません', { type: 'bad' }); return; }
        const list = S.list.slice().sort((a, b) => String(a.due || '').localeCompare(String(b.due || '')));
        const mark = { done: '○', late: '△', exempt: '免', '': '×' };
        const rows = [['番号', '氏名'].concat(list.map((x) => x.title), ['出した数', '期限内に出した数', '出す数'])];
        for (const s of S.cls.students) {
          let inN = 0, onTime = 0, need = 0;
          const cells = list.map((x) => { const v = (x.checks || {})[s.id] || ''; if (v !== 'exempt') need++; if (v === 'done') { inN++; onTime++; } if (v === 'late') inN++; return mark[v]; });
          rows.push([s.no, s.name || ''].concat(cells, [inN, onTime, need]));
        }
        if (await Kit.download('提出-' + Kit.safeName(S.cls.name) + '-' + Kit.ymd() + '.csv', Kit.csv(rows))) {
          Kit.modal({ title: 'かんたん成績に入れる', body: h('div', { class: 'stack small' }, h('p', null, S.cls.name + 'の ' + list.length + 'この宿題の提出を書き出しました（○ 済・△ 遅れ・× まだ・免 免除）。'),
            h('p', null, '右の3列（出した数・期限内に出した数・出す数）を、かんたん成績の「ワーク・プリント」などの項目に取り込めます。何点にするかは、学校・教科の決まりに合わせてください。')), actions: [{ label: '閉じる', kind: 'primary' }] });
        }
      }

      await load();
      await render();
      const reload = Kit.debounce(async () => { if (!alive) return; await load(); render(); }, 120);
      const offs = [Kit.store.on('coll:homework', reload), Kit.store.on('coll:classes', reload), School.onClassChange(reload)];
      return () => { alive = false; offs.forEach((f) => f()); reload.cancel(); };
    },
  });
})();

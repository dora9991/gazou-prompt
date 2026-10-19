// 連絡テンプレート：保護者・生徒・先生への連絡のひな形。クラス・先生の名前・日付・時候のあいさつは自動で入り、
// 行事はカレンダーから、生徒の名前は名簿から入れられる。メッセージはコピー・メール、文書は印刷・Word に
(function () {
  'use strict';
  const { h } = Kit;
  const L = window.Letters;
  const GROUPS = [{ value: 'all', label: 'すべて' }].concat(L.GROUPS.map((g) => ({ value: g.id, label: g.label })), [{ value: 'mine', label: 'わたしの' }]);
  const GL = Object.fromEntries(L.GROUPS.map((g) => [g.id, g.label]));
  const AUTO = ['学校名', '先生名', 'クラス', '学年', '発行日', '今日', '明日', '年度', '時候', '時候やわらか'];
  const AUTO_NOTE = { 明日: '次の授業の日', 時候: '発行日の月', 時候やわらか: '発行日の月' };
  const TO = { parent: '保護者 様', student: '{クラス}の皆さん', staff: '先生方' };
  const FROM = '{学校名}\n{クラス}担任　{先生名}';
  const EVENT_KEYS = ['行事名', '会議名', '面談名', 'テスト名'];
  const lines = (s) => String(s || '').split('\n');
  const slotTitle = (t) => String(t || '').replace(/\{([^{}]+)\}/g, '〈$1〉');
  const addDays = (s, n) => Kit.ymd(Kit.addDays(s, n));
  const evDate = (e) => L.jpDate(e.occ || e.date) + (e.allDay || !e.start ? '' : e.start + (e.end ? '〜' + e.end : '〜'));

  Kit.css('templates', `
.tp-split{display:grid;gap:16px;grid-template-columns:1fr}
@media (min-width:980px){.tp-split{grid-template-columns:300px minmax(0,1fr);align-items:start}.tp-back{display:none}}
@media (max-width:979px){.tp-split[data-view="list"] .tp-main,.tp-split[data-view="edit"] .tp-side{display:none}}
.tp-side{display:grid;gap:10px}
.tp-groups .seg{flex-wrap:wrap}
.tp-items{display:grid;gap:6px}
.tp-gl{font-size:12px;letter-spacing:.14em;color:var(--ink-3);font-weight:700;margin:8px 2px 0}
.tp-it{display:grid;gap:1px;text-align:left;padding:9px 12px;border-radius:8px;border:1px solid var(--line);background:var(--surface);color:var(--ink);font:inherit;cursor:pointer}
.tp-it:hover{border-color:var(--gosu)}
.tp-it[aria-current="true"]{border-color:var(--gosu);background:var(--gosu-wash)}
.tp-it b{font-size:14px}
.tp-it span{font-size:12px;color:var(--ink-3)}
.tp-main{display:grid;gap:14px}
.tp-head{display:grid;gap:6px}
.tp-head h2{font-size:19px;font-weight:700;display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.tp-fields{display:grid;gap:10px;grid-template-columns:repeat(auto-fill,minmax(min(100%,220px),1fr))}
.tp-fields .wide{grid-column:1/-1}
.tp-fields textarea{min-height:60px}
.tp-auto{display:flex;flex-wrap:wrap;gap:4px 6px;align-items:center;font-size:13px}
.tp-auto .chip{font-size:12.5px}
.tp-auto input[type=date]{width:auto}
.tp-help{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.tp-help select{width:auto;max-width:100%}
.tp-out textarea{font-size:15px;line-height:1.7;min-height:240px}
.tp-edited{display:flex;flex-wrap:wrap;gap:8px;align-items:center;font-size:13px;color:var(--warn)}
.tp-paper{background:#fff;color:#000;border:1px solid var(--line);border-radius:6px;padding:clamp(16px,4vw,40px);box-shadow:0 1px 6px rgba(0,0,0,.12);max-width:760px}
.tp-letter{font-size:11pt;line-height:1.75;color:#000}
.tp-letter p{margin:0}
.tp-letter .r{text-align:right}
.tp-letter .to{margin:3mm 0 2mm}
.tp-letter .from{margin-bottom:6mm}
.tp-letter .ttl{text-align:center;font-weight:700;font-size:14pt;margin:5mm 0 6mm}
.tp-letter .ki{text-align:center;margin:6mm 0 3mm}
.tp-letter .nt{margin-left:6mm}
.tp-letter .cut{margin:12mm 0 6mm;border-top:1pt dashed #000;text-align:center;height:0}
.tp-letter .cut span{position:relative;top:-.85em;background:#fff;padding:0 3mm;font-size:9pt}
.tp-parts{display:grid;gap:8px}
.tp-parts textarea{min-height:70px}
`);

  // 文書の見た目（画面と印刷で同じ）
  function letterEl(o) {
    const para = (s) => lines(s).map((t) => h('p', null, t || '　'));
    return h('div', { class: 'tp-letter', style: { fontFamily: (L.FONTS[o.font] || L.FONTS.mincho).css } },
      h('div', { class: 'r' }, o.date),
      h('div', { class: 'to' }, o.to),
      h('div', { class: 'r from' }, para(o.from)),
      h('div', { class: 'ttl' }, o.title),
      h('div', { class: 'bd' }, para(o.body)),
      String(o.note || '').trim() ? [h('div', { class: 'ki' }, '記'), h('div', { class: 'nt' }, para(o.note)), h('div', { class: 'r' }, '以上')] : null,
      String(o.reply || '').trim() ? [h('div', { class: 'cut' }, h('span', null, 'きりとり')), h('div', { class: 'rp' }, para(o.reply))] : null);
  }
  function letterText(o) {
    return [o.date, o.to, o.from, '', o.title, '', o.body].concat(String(o.note || '').trim() ? ['', '記', o.note, '以上'] : [], String(o.reply || '').trim() ? ['', '－－－－－－　きりとり　－－－－－－', o.reply] : []).join('\n');
  }
  function letterDocx(o) {
    const P = (t, x) => Object.assign({ p: t }, x || {});
    const body = [P(o.date, { align: 'right' }), P(o.to, { before: 4, after: 2 })].concat(lines(o.from).map((t) => P(t, { align: 'right' })),
      [P(o.title, { b: true, size: 14, align: 'center', before: 14, after: 12 })], lines(o.body).map((t) => P(t, { line: 1.5 })));
    if (String(o.note || '').trim()) body.push(P('記', { align: 'center', before: 10, after: 6 }), ...lines(o.note).map((t) => P(t, { indent: 6, line: 1.5 })), P('以上', { align: 'right', before: 4 }));
    if (String(o.reply || '').trim()) body.push(P('', { before: 20, after: 0, border: { bottom: 'dashed' } }), P('（きりとり）', { align: 'center', size: 8.5, after: 8 }), ...lines(o.reply).map((t) => P(t, { line: 1.4 })));
    const F = L.FONTS[o.font] || L.FONTS.mincho;
    return { title: o.title, page: { w: 210, h: 297, margin: 20 }, font: F.word, latin: F.latin, size: 10.5, body };
  }

  Kit.app({
    id: 'templates', title: '連絡テンプレート', group: 'write', icon: 'mail', order: 61,
    desc: '保護者・生徒・先生への連絡のひな形。クラス・日付・時候のあいさつが自動で入る',
    colls: ['msgtemplates'],
    async mount(root, params) {
      const p0 = params || {};
      const S = {
        sel: p0.id || Kit.pref.get('templates:sel', 'p-event'), group: Kit.pref.get('templates:group', 'all'), q: '',
        vals: Object.assign({}, p0.vals || {}), autoOver: {}, out: null, date: Kit.ymd(), font: 'mincho', view: p0.id ? 'edit' : 'list',
        mine: [], cls: null, profile: null,
      };
      let alive = true;
      const main = h('div');
      root.append(Kit.appHead({
        title: '連絡テンプレート',
        desc: '保護者・生徒・先生への連絡のひな形。日付やあいさつは自動で入ります。',
        actions: [Kit.btn('新しいひな形', () => editTemplate(null), { icon: 'plus' })],
      }), main);

      async function load() {
        S.profile = await Kit.profile.get();
        S.cls = await School.classes.current();
        S.mine = (await Kit.store.list('msgtemplates')).map((t) => Object.assign({ group: 'parent', kind: 'message', title: '', body: '', note: '', reply: '', examples: {} }, t, { mine: true }));
      }
      const all = () => S.mine.concat(L.TEMPLATES);
      const cur = () => all().find((t) => t.id === S.sel) || L.TEMPLATES[0];
      const month = () => Kit.parseYmd(S.date).getMonth() + 1;
      function autoVals() {
        const p = S.profile, c = S.cls;
        const m = /(\d+)\s*年/.exec(c ? c.name : '');
        let next = Kit.rel(1);
        for (let i = 0; i < 14 && School.isOff(next); i++) next = addDays(next, 1);
        const v = { 学校名: p.school || '', 先生名: String(p.teacher || '').replace(/\s*先生$/, ''), クラス: c ? c.name : '', 学年: m ? '第' + m[1] + '学年' : '', 発行日: L.wareki(S.date), 今日: L.jpDate(Kit.ymd()), 明日: L.jpDate(next), 年度: L.warekiYear(p.year), 時候: L.jiko(month()).formal, 時候やわらか: L.jiko(month()).soft };
        return Object.assign(v, S.autoOver);
      }
      // いまの差し込みで、できあがりをつくる
      function result() {
        const t = cur(), v = Object.assign(autoVals(), S.vals);
        const f = (s) => L.fill(s, v);
        const o = { title: f(t.title), body: f(t.body), note: f(t.note), reply: f(t.reply), to: f(S.vals.__to != null ? S.vals.__to : t.to || TO[t.group] || ''), from: f(S.vals.__from != null ? S.vals.__from : t.from || FROM), date: L.wareki(S.date), font: S.font };
        return Object.assign(o, S.out || {});
      }
      const keysOf = (t) => L.keys(t.title, t.to || TO[t.group] || '', t.kind === 'letter' ? t.from || FROM : '', t.body, t.note, t.reply);

      async function render() {
        Kit.clear(main);
        const split = h('div', { class: 'tp-split', 'data-view': S.view }, side(), editor());
        main.append(split);
      }

      /* ── ひな形の一覧 ── */
      function side() {
        const q = h('input', { type: 'search', placeholder: 'さがす（例：面談・持ち物・自習）', 'aria-label': 'ひな形をさがす' });
        q.value = S.q;
        const list = h('div', { class: 'tp-items' });
        const draw = () => {
          Kit.clear(list);
          const words = S.q.trim().split(/\s+/).filter(Boolean);
          const hit = (t) => words.every((w) => (t.title + ' ' + (t.desc || '') + ' ' + t.body).includes(w));
          const show = all().filter((t) => (S.group === 'all' || (S.group === 'mine' ? t.mine : t.group === S.group && !t.mine)) && hit(t));
          if (!show.length) { list.append(h('p', { class: 'small muted' }, S.group === 'mine' && !S.mine.length ? 'まだありません。ひな形を開いて「このひな形を直して保存」で、自分のひな形をつくれます。' : '見つかりませんでした。')); return; }
          const sections = S.group === 'all' ? [['mine', 'わたしのひな形']].concat(L.GROUPS.map((g) => [g.id, g.label])) : [[S.group, '']];
          for (const [gid, label] of sections) {
            const rows = show.filter((t) => (gid === 'mine' ? t.mine : !t.mine && t.group === gid));
            if (!rows.length) continue;
            if (label) list.append(h('div', { class: 'tp-gl' }, label));
            for (const t of rows) list.append(h('button', { type: 'button', class: 'tp-it', 'aria-current': String(t.id === S.sel), onclick: () => pick(t.id) },
              h('b', null, slotTitle(t.title)), h('span', null, (t.kind === 'letter' ? '文書' : 'メッセージ') + (t.mine ? '・' + (GL[t.group] || '') : '') + (t.desc ? '　' + t.desc : ''))));
          }
        };
        q.addEventListener('input', () => { S.q = q.value; draw(); });
        draw();
        return h('aside', { class: 'tp-side', 'aria-label': 'ひな形の一覧' }, q,
          h('div', { class: 'tp-groups' }, Kit.seg(GROUPS, S.group, (v) => { S.group = v; Kit.pref.set('templates:group', v); draw(); }, { label: '相手' })), list);
      }
      function pick(id) {
        if (id !== S.sel) { S.sel = id; S.out = null; Kit.pref.set('templates:sel', id); const keep = {}; for (const k of keysOf(cur())) if (S.vals[k]) keep[k] = S.vals[k]; S.vals = keep; }
        S.view = 'edit';
        render();
        window.scrollTo(0, 0);
      }

      /* ── 差し込みと、できあがり ── */
      function editor() {
        const t = cur(), letter = t.kind === 'letter';
        const box = h('div', { class: 'tp-main' });
        box.append(h('div', { class: 'tp-back' }, Kit.btn('ひな形の一覧', () => { S.view = 'list'; render(); }, { icon: 'left', kind: 'ghost', sm: true })));
        box.append(h('section', { class: 'tp-head' },
          h('h2', null, slotTitle(t.title), h('span', { class: 'chip' }, GL[t.group] || ''), h('span', { class: 'chip line' }, letter ? '文書（印刷・Word）' : 'メッセージ（コピー・メール）'), t.mine ? h('span', { class: 'chip shu' }, 'わたしの') : null),
          t.desc ? h('p', { class: 'small ink-2' }, t.desc) : null));
        const keys = keysOf(t);
        const manual = keys.filter((k) => !AUTO.includes(k));
        const autos = keys.filter((k) => AUTO.includes(k));
        const outSlot = h('div');
        const upd = () => { if (alive) drawOut(outSlot, t); };

        // 差し込み
        const sec = h('section', { class: 'card stack', 'aria-label': '差し込み' }, h('h3', { class: 'nl-sec' }, '入れること'));
        if (autos.length || letter) {
          const av = autoVals();
          const dIn = h('input', { type: 'date', id: 'tp-date', 'aria-label': '発行日' });
          dIn.value = S.date;
          dIn.addEventListener('change', () => { if (dIn.value) { S.date = dIn.value; render(); } });
          sec.append(h('div', { class: 'tp-auto' }, h('span', { class: 'small ink-2' }, '自動で入るもの：'),
            autos.map((k) => h('span', { class: 'chip', title: AUTO_NOTE[k] || '' }, k + '：' + (av[k] || '（未設定）'))),
            h('label', { for: 'tp-date', class: 'small ink-2', style: { marginLeft: '6px' } }, '発行日'), dIn));
          if (autos.some((k) => !av[k])) sec.append(h('p', { class: 'small', style: { color: 'var(--warn)' } }, '「未設定」は、ホームの「学校の設定」（学校名・先生の名前）か、名簿のクラスで入ります。下の欄で直接書いても入ります。'));
        }
        const fields = h('div', { class: 'tp-fields' });
        const inputs = {};
        for (const k of manual.concat(autos.filter((k) => !autoVals()[k]))) {
          const ex = (t.examples || {})[k] || '';
          const multi = /\n/.test(ex) || ex.length > 26;
          const el = h(multi ? 'textarea' : 'input', Object.assign({ id: 'tp-v-' + k, placeholder: ex ? '例：' + ex.replace(/\n/g, '・') : '' }, multi ? { rows: 2 } : { type: 'text' }));
          el.value = S.vals[k] || '';
          el.addEventListener('input', () => { S.vals[k] = el.value; upd(); });
          inputs[k] = el;
          fields.append(Kit.field({ label: k, input: el, class: multi ? 'wide' : '' }));
        }
        if (manual.length || fields.childNodes.length) sec.append(fields);
        else sec.append(h('p', { class: 'small muted' }, 'このひな形は、入れることがありません。そのまま使えます。'));
        // カレンダー・名簿から
        const help = h('div', { class: 'tp-help' });
        if (keys.some((k) => EVENT_KEYS.includes(k) || k === '日時' || k === '日付')) help.append(Kit.btn('カレンダーの予定から入れる', () => fromCalendar(keys, inputs, upd), { sm: true, icon: 'calendar' }));
        if (keys.includes('生徒名') && S.cls) {
          const sel = h('select', { 'aria-label': '名簿から生徒を選ぶ' }, h('option', { value: '' }, '名簿から選ぶ（' + S.cls.name + '）'), S.cls.students.map((s) => h('option', { value: s.id }, School.label(s))));
          sel.addEventListener('change', () => { const s = S.cls.students.find((x) => x.id === sel.value); if (!s) return; S.vals['生徒名'] = s.name || (s.no + '番'); if (inputs['生徒名']) inputs['生徒名'].value = S.vals['生徒名']; upd(); });
          help.append(sel);
        }
        if (help.childNodes.length) sec.append(help);
        if (letter) {
          const toIn = h('input', { type: 'text', id: 'tp-to' }), fromIn = h('textarea', { id: 'tp-from', rows: 2 });
          const r0 = result();
          toIn.value = S.vals.__to != null ? S.vals.__to : r0.to;
          fromIn.value = S.vals.__from != null ? S.vals.__from : r0.from;
          toIn.addEventListener('input', () => { S.vals.__to = toIn.value; upd(); });
          fromIn.addEventListener('input', () => { S.vals.__from = fromIn.value; upd(); });
          sec.append(h('div', { class: 'tp-fields' }, Kit.field({ label: '宛名', input: toIn }), Kit.field({ label: '発信者（右に寄せる）', input: fromIn }),
            h('div', { class: 'field' }, h('span', { class: 'small ink-2' }, '字体'), Kit.seg(Object.entries(L.FONTS).map(([k, f]) => ({ value: k, label: f.label })), S.font, (v) => { S.font = v; upd(); }, { label: '字体' }))));
        }
        box.append(sec, outSlot);
        drawOut(outSlot, t);
        box.append(h('div', { class: 'btn-row' },
          Kit.btn(t.mine ? 'このひな形を直す' : 'このひな形を直して保存（わたしのひな形）', () => editTemplate(t), { sm: true, icon: 'edit', kind: 'ghost' }),
          t.mine ? Kit.btn('このひな形を消す', () => removeTemplate(t), { sm: true, icon: 'trash', kind: 'ghost' }) : null));
        return box;
      }
      function drawOut(slot, t) {
        const o = result(), letter = t.kind === 'letter';
        Kit.clear(slot);
        const sec = h('section', { class: 'card stack tp-out', 'aria-label': 'できあがり' }, h('h3', { class: 'nl-sec' }, 'できあがり'));
        const left = (o.title + o.body + o.note + o.reply + o.to + o.from).match(/\{[^{}\n]{1,20}\}/g);
        if (left && !S.out) sec.append(h('p', { class: 'small', style: { color: 'var(--warn)' } }, 'まだ入っていないところ：' + [...new Set(left)].join('・')));
        if (S.out) sec.append(h('div', { class: 'tp-edited' }, '文章を直接直しています（上の「入れること」を変えても、ここは変わりません）。', Kit.btn('入れたことから作り直す', () => { S.out = null; drawOut(slot, t); }, { sm: true, kind: 'ghost', icon: 'refresh' })));
        if (!letter) {
          const ta = h('textarea', { 'aria-label': 'できあがりの文' });
          ta.value = o.body;
          ta.addEventListener('input', () => { S.out = Object.assign(S.out || {}, { body: ta.value }); });
          ta.addEventListener('change', () => drawOut(slot, t));
          sec.append(h('div', { class: 'small ink-2' }, '件名：' + o.title), ta, h('div', { class: 'btn-row' },
            Kit.btn('コピー', () => Kit.copy(ta.value, 'コピーしました。連絡アプリ・メール・Classroom に貼れます'), { kind: 'primary', icon: 'copy' }),
            Kit.btn('件名もコピー', () => Kit.copy(o.title + '\n\n' + ta.value, '件名と本文をコピーしました'), { icon: 'copy', kind: 'ghost' }),
            h('a', { class: 'btn ghost', href: 'mailto:?subject=' + encodeURIComponent(o.title) + '&body=' + encodeURIComponent(ta.value.replace(/\n/g, '\r\n')) }, Kit.icon('mail'), h('span', null, 'メールで開く'))));
        } else {
          sec.append(h('div', { class: 'tp-paper' }, letterEl(o)), h('div', { class: 'btn-row' },
            Kit.btn('印刷', () => School.print({ margin: '20mm', build: () => letterEl(result()) }), { kind: 'primary', icon: 'printer' }),
            Kit.btn('Word に書き出す', () => word(), { icon: 'download' }),
            Kit.btn('文章をコピー', () => Kit.copy(letterText(result()), '文書の文章をコピーしました'), { icon: 'copy', kind: 'ghost' })));
          const parts = h('div', { class: 'tp-parts' });
          for (const [k, label] of [['title', '題'], ['body', '本文'], ['note', '記（なければ空に）'], ['reply', '切り取りの返信票（なければ空に）']]) {
            if (k !== 'title' && k !== 'body' && !String(o[k] || '').trim() && !(S.out && k in S.out)) continue;
            const el = h(k === 'title' ? 'input' : 'textarea', Object.assign({ id: 'tp-part-' + k }, k === 'title' ? { type: 'text' } : { rows: k === 'body' ? 6 : 4 }));
            el.value = o[k] || '';
            el.addEventListener('input', () => { S.out = Object.assign(S.out || {}, { [k]: el.value }); });
            el.addEventListener('change', () => drawOut(slot, t));
            parts.append(Kit.field({ label, input: el }));
          }
          sec.append(h('details', { class: 'help', open: !!S.out }, h('summary', null, '文章を直接直す'), parts));
        }
        slot.append(sec);
      }
      async function word() {
        const o = result();
        try {
          const bytes = window.Docx.build(letterDocx(o));
          const ok = await Kit.download(Kit.safeName(o.title || '文書') + '.docx', new Blob([bytes], { type: window.Docx.MIME }));
          if (ok) Kit.toast('Word のファイルを書き出しました');
        } catch (e) { console.error(e); Kit.toast('Word に書き出せませんでした', { type: 'bad' }); }
      }
      async function fromCalendar(keys, inputs, upd) {
        const C = window.SenseiCalendar;
        if (!C) return;
        const t = Kit.ymd();
        const list = C.occurrences(await Kit.store.list('events'), t, addDays(t, 90)).filter((e) => e.cat !== 'private').sort((a, b) => (a.occ + (a.start || '')).localeCompare(b.occ + (b.start || '')));
        if (!list.length) { Kit.toast('これから90日の予定がありません（カレンダーに入れると選べます）'); return; }
        const m = Kit.modal({
          title: 'どの予定のお知らせですか', wide: false,
          body: h('div', { class: 'list' }, list.slice(0, 60).map((e) => h('button', { type: 'button', class: 'list-item', onclick: () => {
            const key = EVENT_KEYS.find((k) => keys.includes(k));
            const set = (k, v) => { if (!keys.includes(k) || !v) return; S.vals[k] = v; if (inputs[k]) inputs[k].value = v; };
            if (key) set(key, e.title);
            set('日時', evDate(e)); set('日付', L.jpDate(e.occ)); set('場所', e.place);
            upd(); m.close();
            Kit.toast('「' + e.title + '」を入れました');
          } }, h('span', { class: 'chip' }, Kit.fmtDate(e.occ, 'M/D(W)')), h('span', { style: { flex: 1, minWidth: 0 } }, h('b', null, e.title), e.place ? h('span', { class: 'small muted' }, '　' + e.place) : null)))),
          actions: [{ label: 'やめる', kind: 'ghost' }],
        });
      }

      /* ── わたしのひな形 ── */
      async function editTemplate(t) {
        const base = t || { group: 'parent', kind: 'message', title: '', body: '', note: '', reply: '' };
        const f = {
          title: h('input', { type: 'text', maxlength: 60, placeholder: '例：{行事名}のお知らせ' }),
          body: h('textarea', { rows: 8, placeholder: '差し込みたいところは {行事名} {日時} のように { } でかこみます。{クラス} {先生名} {発行日} {時候} などは自動で入ります。' }),
          note: h('textarea', { rows: 3, placeholder: '文書の「記」（なければ空に）' }),
          reply: h('textarea', { rows: 3, placeholder: '切り取りの返信票（なければ空に）' }),
        };
        f.title.value = base.title; f.body.value = base.body; f.note.value = base.note || ''; f.reply.value = base.reply || '';
        let group = base.group, kind = base.kind;
        const res = await new Promise((resolve) => Kit.modal({
          title: t && t.mine ? 'わたしのひな形を直す' : 'わたしのひな形をつくる', wide: true, onClose: resolve,
          body: h('div', { class: 'stack' },
            h('div', { class: 'tp-help' }, h('span', { class: 'small ink-2' }, '相手'), Kit.seg(L.GROUPS.map((g) => ({ value: g.id, label: g.label })), group, (v) => { group = v; }, { label: '相手' }),
              h('span', { class: 'small ink-2' }, '形'), Kit.seg([{ value: 'message', label: 'メッセージ' }, { value: 'letter', label: '文書' }], kind, (v) => { kind = v; }, { label: '形' })),
            Kit.field({ label: '題（件名）', input: f.title, id: 'tp-e-title' }), Kit.field({ label: '本文', input: f.body, id: 'tp-e-body' }),
            Kit.field({ label: '記（文書のとき）', input: f.note, id: 'tp-e-note' }), Kit.field({ label: '返信票（文書のとき）', input: f.reply, id: 'tp-e-reply' })),
          actions: [{ label: 'やめる', kind: 'ghost' }, { label: '保存する', kind: 'primary', onClick: () => {
            if (!f.title.value.trim() || !f.body.value.trim()) { Kit.toast('題と本文を入れてください', { type: 'bad' }); return false; }
            return { group, kind, title: f.title.value.trim(), body: f.body.value, note: kind === 'letter' ? f.note.value : '', reply: kind === 'letter' ? f.reply.value : '' };
          } }],
        }));
        if (!res) return;
        const it = Object.assign({}, t && t.mine ? { id: t.id } : {}, res, { examples: (t && t.examples) || {}, desc: t && t.mine ? t.desc || '' : t ? 'もとは「' + slotTitle(t.title) + '」' : '' });
        const saved = await Kit.store.put('msgtemplates', it);
        await load();
        S.sel = saved.id; S.out = null; S.group = S.group === 'all' ? 'all' : 'mine';
        Kit.pref.set('templates:sel', saved.id);
        Kit.toast('わたしのひな形に保存しました');
        render();
      }
      async function removeTemplate(t) {
        if (!(await Kit.confirm({ title: '「' + slotTitle(t.title) + '」を消しますか', body: 'わたしのひな形から消します。', ok: '消す', danger: true }))) return;
        await Kit.store.remove('msgtemplates', t.id);
        await load();
        S.sel = 'p-event'; S.out = null;
        render();
      }

      await load();
      if (!all().some((t) => t.id === S.sel)) S.sel = 'p-event';
      await render();
      const offC = School.onClassChange(async () => { await load(); if (alive) render(); });
      const offP = Kit.store.on('doc:profile', async () => { await load(); if (alive) render(); });
      return () => { alive = false; offC(); offP(); };
    },
  });
})();

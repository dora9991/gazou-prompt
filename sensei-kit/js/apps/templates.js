// 連絡テンプレート：保護者・生徒・先生への連絡のひな形と、拝啓〜敬具の改まった文書。クラス・先生の名前・日付・時候のあいさつは自動で入り、
// 時候のあいさつは月ごとの例文から選べる。行事はカレンダーから、生徒の名前は名簿から入れられる。メッセージはコピー・メール、文書は印刷・Word に
(function () {
  'use strict';
  const { h } = Kit;
  const L = window.Letters;
  const GROUPS = [{ value: 'all', label: 'すべて' }].concat(L.GROUPS.map((g) => ({ value: g.id, label: g.label })), [{ value: 'mine', label: 'わたしの' }]);
  const GL = Object.fromEntries(L.GROUPS.map((g) => [g.id, g.label]));
  const AITE_L = Object.fromEntries(L.AITE.map((a) => [a.id, a.label]));
  const AUTO = ['学校名', '先生名', 'クラス', '学年', '発行日', '今日', '明日', '年度', '時候', '時候やわらか'];
  const AUTO_NOTE = { 明日: '次の授業の日', 時候やわらか: '発行日に合わせる' };
  const TO = { parent: '保護者 様', formal: '保護者 各位', student: '{クラス}の皆さん', staff: '先生方' };
  const FROM = '{学校名}\n{クラス}担任　{先生名}';
  const FROM_KOCHO = '{学校名}\n校長　{校長名}';
  const fromOf = (t) => t.from || (t.group === 'formal' ? FROM_KOCHO : FROM);
  // 一度入れたら、ほかのひな形でも使う（このブラウザに覚える）
  const REMEMBER = ['校長名', 'PTA会長名', '電話'];
  const EVENT_KEYS = ['行事名', '会議名', '面談名', 'テスト名'];
  const lines = (s) => String(s || '').split('\n');
  const slotTitle = (t) => String(t || '').replace(/\{([^{}]+)\}/g, '〈$1〉');
  const addDays = (s, n) => Kit.ymd(Kit.addDays(s, n));
  const evDate = (e) => L.jpDate(e.occ || e.date) + (e.allDay || !e.start ? '' : e.start + (e.end ? '〜' + e.end : '〜'));
  const MINCHO = L.FONTS.mincho.css;
  // 季節の印（葉っぱ）。Kit.icon と同じ線の太さ
  const leaf = (size) => {
    const s = Kit.svg('svg', { viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' },
      Kit.svg('path', { d: 'M5 19C5 10.5 10.5 5 20 4c-.6 9.5-6 15-15 15z' }), Kit.svg('path', { d: 'M5 19c3-4 6-7 10-10' }));
    return s;
  };
  const jikoBtn = (label, onClick) => { const b = Kit.btn(label, onClick, { sm: true }); b.prepend(leaf(16)); return b; };

  Kit.css('templates', `
.tp-split{display:grid;gap:16px;grid-template-columns:1fr}
@media (min-width:980px){.tp-split{grid-template-columns:300px minmax(0,1fr);align-items:start}.tp-back{display:none}}
@media (max-width:979px){.tp-split[data-view="list"] .tp-main,.tp-split[data-view="edit"] .tp-side{display:none}}
.tp-side{display:grid;gap:10px}
.tp-groups .seg{flex-wrap:wrap}
.tp-items{display:grid;gap:6px}
.tp-gl{font-size:12px;letter-spacing:.14em;color:var(--ink-3);font-weight:700;margin:8px 2px 0}
.tp-gl small{font-size:12px;letter-spacing:.04em;font-weight:500;margin-left:6px}
.tp-it{display:grid;gap:1px;text-align:left;padding:9px 12px;border-radius:8px;border:1px solid var(--line);background:var(--surface);color:var(--ink);font:inherit;cursor:pointer}
.tp-it:hover{border-color:var(--gosu)}
.tp-it[aria-current="true"]{border-color:var(--gosu);background:var(--gosu-wash)}
.tp-it b{font-size:14px}
.tp-it span{font-size:12px;color:var(--ink-3)}
.tp-it.is-formal{border-left:3px double var(--ink-3)}
.tp-jk-open{display:flex;gap:10px;align-items:center;text-align:left;padding:9px 12px;border-radius:8px;border:1px dashed var(--line-strong);background:var(--surface-2);color:var(--ink);font:inherit;cursor:pointer;min-height:44px}
.tp-jk-open:hover{border-color:var(--gosu);border-style:solid}
.tp-jk-open>svg{flex:none;width:22px;height:22px;color:var(--gosu)}
.tp-jk-open b{display:block;font-size:14px}
.tp-jk-open small{display:block;font-size:12px;color:var(--ink-3)}
.tp-main{display:grid;gap:14px}
.tp-head{display:grid;gap:6px}
.tp-head h2{font-size:19px;font-weight:700;display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.tp-fields{display:grid;gap:10px;grid-template-columns:repeat(auto-fill,minmax(min(100%,220px),1fr));align-items:start}
.tp-fields .wide{grid-column:1/-1}
.tp-fields textarea{min-height:60px}
.tp-auto{display:flex;flex-wrap:wrap;gap:4px 6px;align-items:center;font-size:13px}
.tp-auto .chip{font-size:12.5px}
.tp-auto input[type=date]{width:auto}
.tp-jiko{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;padding:8px 10px 8px 12px;border:1px solid var(--line);border-left:4px solid var(--gosu);border-radius:8px;background:var(--surface-2)}
.tp-jiko-k{font-size:12.5px;color:var(--ink-2);font-weight:700}
.tp-jiko-v{font-size:16px;font-family:${MINCHO};font-weight:700}
.tp-jiko-btns{display:flex;flex-wrap:wrap;gap:6px;margin-left:auto}
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
.tp-jk-bar{position:sticky;top:0;z-index:2;background:var(--surface);display:grid;gap:8px;padding:4px 0 10px;border-bottom:1px solid var(--line)}
.tp-jk-bar .seg{display:flex}
.tp-months>button{flex:1 0 auto;min-width:46px;padding:5px 6px}
.tp-jk-aite{display:flex;flex-wrap:wrap;gap:6px 8px;align-items:center}
.tp-jk-list{display:grid;gap:8px}
.tp-jk-list .tp-gl{margin-top:6px}
.tp-jk{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px;align-items:center;border:1px solid var(--line);border-radius:10px;background:var(--surface);padding:3px 8px 3px 3px}
.tp-jk:hover{border-color:var(--gosu)}
.tp-jk.is-on{border:2px solid var(--gosu);background:var(--gosu-wash);padding:2px 7px 2px 2px}
.tp-jk-main{display:grid;gap:3px;text-align:left;border:0;background:transparent;color:var(--ink);font:inherit;padding:8px 10px;border-radius:8px;cursor:pointer;min-height:44px;min-width:0}
.tp-jk-row{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center}
.tp-jk-t{font-size:17px;font-family:${MINCHO};font-weight:700;line-height:1.45}
.tp-jk-m{display:flex;flex-wrap:wrap;gap:0 14px;font-size:12px;color:var(--ink-3)}
.tp-jk.is-fit:not(.is-on){border-color:var(--line-strong)}
.tp-jk-ex{font-size:12.5px;color:var(--ink-2);line-height:1.6}
@media (max-width:520px){.tp-jk{grid-template-columns:1fr;padding:3px}.tp-jk>.btn{justify-self:end;margin:0 6px 6px}}
`);

  // 文書の見た目（画面と印刷で同じ）。日付・発信者は右、件名は真ん中、敬具は右、記は真ん中、以上は右
  function letterEl(o) {
    const para = (s) => lines(s).map((t) => h('p', null, t || '　'));
    return h('div', { class: 'tp-letter', style: { fontFamily: (L.FONTS[o.font] || L.FONTS.mincho).css } },
      h('div', { class: 'r' }, o.date),
      h('div', { class: 'to' }, para(o.to)),
      h('div', { class: 'r from' }, para(o.from)),
      h('div', { class: 'ttl' }, o.title),
      h('div', { class: 'bd' }, lines(o.body).map((t) => (L.isKetsugo(t) ? h('p', { class: 'r kg' }, t.trim()) : h('p', null, t || '　')))),
      String(o.note || '').trim() ? [h('div', { class: 'ki' }, '記'), h('div', { class: 'nt' }, lines(o.note).map((t) => { const n = L.kiHang(t); return h('p', n ? { style: { paddingLeft: n + 'em', textIndent: -n + 'em' } } : null, t || '　'); })), h('div', { class: 'r' }, '以上')] : null,
      String(o.reply || '').trim() ? [h('div', { class: 'cut' }, h('span', null, 'きりとり')), h('div', { class: 'rp' }, para(o.reply))] : null);
  }

  Kit.app({
    id: 'templates', title: '連絡テンプレート', group: 'write', icon: 'mail', order: 61,
    desc: '保護者・生徒・先生への連絡と、拝啓〜敬具の改まった文書。クラス・日付・時候のあいさつが自動で入る',
    colls: ['msgtemplates'],
    async mount(root, params) {
      const p0 = params || {};
      const S = {
        sel: p0.id || Kit.pref.get('templates:sel', 'p-event'), group: Kit.pref.get('templates:group', 'all'), q: '',
        vals: Object.assign({}, p0.vals || {}), keep: Kit.pref.get('templates:keep', {}) || {}, jiko: null, out: null, date: Kit.ymd(), font: 'mincho', view: p0.id ? 'edit' : 'list',
        mine: [], cls: null, profile: null,
      };
      let alive = true;
      const main = h('div');
      root.append(Kit.appHead({
        title: '連絡テンプレート',
        desc: '保護者・生徒・先生への連絡と、改まった文書のひな形。日付やあいさつは自動で入ります。',
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
      const dateLabel = () => { const d = Kit.parseYmd(S.date); return (d.getMonth() + 1) + '月' + d.getDate() + '日'; };
      // いま入る時候のあいさつ：選んだもの → ひな形の決まり（時下など）→ 発行日に使えるもの（自動）
      const jikoNow = () => { const t = cur(); return (S.jiko && L.jikoById(S.jiko)) || (t.jiko && L.jikoById(t.jiko)) || L.jikoFor(S.date); };
      function autoVals() {
        const p = S.profile, c = S.cls;
        const m = /(\d+)\s*年/.exec(c ? c.name : '');
        let next = Kit.rel(1);
        for (let i = 0; i < 14 && School.isOff(next); i++) next = addDays(next, 1);
        return { 学校名: p.school || '', 先生名: String(p.teacher || '').replace(/\s*先生$/, ''), クラス: c ? c.name : '', 学年: m ? '第' + m[1] + '学年' : '', 発行日: L.wareki(S.date), 今日: L.jpDate(Kit.ymd()), 明日: L.jpDate(next), 年度: L.warekiYear(p.year), 時候: L.jikoLead(jikoNow()) || L.jiko(month()).formal, 時候やわらか: (L.jikoFor(S.date, 'soft') || {}).text || L.jiko(month()).soft };
      }
      // いまの差し込みで、できあがりをつくる
      function result() {
        const t = cur(), v = Object.assign(autoVals(), S.keep, S.vals);
        const f = (s) => L.fill(s, v);
        const o = { title: f(t.title), body: f(t.body), note: f(t.note), reply: f(t.reply), to: f(S.vals.__to != null ? S.vals.__to : t.to || TO[t.group] || ''), from: f(S.vals.__from != null ? S.vals.__from : fromOf(t)), date: L.wareki(S.date), font: S.font };
        return Object.assign(o, S.out || {});
      }
      const keysOf = (t) => L.keys(t.title, t.to || TO[t.group] || '', t.kind === 'letter' ? fromOf(t) : '', t.body, t.note, t.reply);

      async function render() {
        Kit.clear(main);
        const split = h('div', { class: 'tp-split', 'data-view': S.view }, side(), editor());
        main.append(split);
      }

      /* ── ひな形の一覧 ── */
      function side() {
        const q = h('input', { type: 'search', placeholder: 'さがす（例：面談・持ち物・ご案内）', 'aria-label': 'ひな形をさがす' });
        q.value = S.q;
        const list = h('div', { class: 'tp-items' });
        const draw = () => {
          Kit.clear(list);
          const words = S.q.trim().split(/\s+/).filter(Boolean);
          const hit = (t) => words.every((w) => (t.title + ' ' + (t.desc || '') + ' ' + t.body).includes(w));
          const show = all().filter((t) => (S.group === 'all' || (S.group === 'mine' ? t.mine : t.group === S.group && !t.mine)) && hit(t));
          if (!show.length) { list.append(h('p', { class: 'small muted' }, S.group === 'mine' && !S.mine.length ? 'まだありません。ひな形を開いて「このひな形を直して保存」で、自分のひな形をつくれます。' : '見つかりませんでした。')); return; }
          const sections = S.group === 'all' ? [['mine', 'わたしのひな形']].concat(L.GROUPS.map((g) => [g.id, g.label, g.sub])) : [[S.group, '', (L.GROUPS.find((g) => g.id === S.group) || {}).sub]];
          for (const [gid, label, sub] of sections) {
            const rows = show.filter((t) => (gid === 'mine' ? t.mine : !t.mine && t.group === gid));
            if (!rows.length) continue;
            if (label || sub) list.append(h('div', { class: 'tp-gl' }, label, sub ? h('small', null, sub) : null));
            for (const t of rows) list.append(h('button', { type: 'button', class: 'tp-it' + (t.group === 'formal' ? ' is-formal' : ''), 'aria-current': String(t.id === S.sel), onclick: () => pick(t.id) },
              h('b', null, slotTitle(t.title)), h('span', null, (t.kind === 'letter' ? '文書' : 'メッセージ') + (t.mine ? '・' + (GL[t.group] || '') : '') + (t.desc ? '　' + t.desc : ''))));
          }
        };
        q.addEventListener('input', () => { S.q = q.value; draw(); });
        draw();
        const jk = h('button', { type: 'button', class: 'tp-jk-open', onclick: () => openJiko() }, leaf(22),
          h('span', null, h('b', null, '時候のあいさつ'), h('small', null, '月ごとの例文 ' + L.JIKO_LIST.length + 'こ。選んで入れる・コピー')));
        return h('aside', { class: 'tp-side', 'aria-label': 'ひな形の一覧' }, q, jk,
          h('div', { class: 'tp-groups' }, Kit.seg(GROUPS, S.group, (v) => { S.group = v; Kit.pref.set('templates:group', v); draw(); }, { label: '相手' })), list);
      }
      function pick(id) {
        if (id !== S.sel) { S.sel = id; S.out = null; Kit.pref.set('templates:sel', id); const keep = {}; for (const k of keysOf(cur())) if (S.vals[k]) keep[k] = S.vals[k]; S.vals = keep; }
        S.view = 'edit';
        render();
        window.scrollTo(0, 0);
      }

      /* ── 時候のあいさつを選ぶ（月でしぼる・押すと文書に入る・コピー） ── */
      function openJiko() {
        const t = cur();
        const can = keysOf(t).includes('時候'); // いまのひな形に入れられるか
        let mon = month(), aite = t.aite || 'parent', m = null;
        const list = h('div', { class: 'tp-jk-list' });
        const insert = (e) => {
          const old = autoVals()['時候'];
          S.jiko = e.id;
          // 文章を直接直しているときも、書き出しのあいさつだけは入れかえる
          if (S.out && typeof S.out.body === 'string' && old) S.out.body = S.out.body.replace(old + '、', L.jikoLead(e) + '、');
          m.close();
          render();
          Kit.toast('「' + e.text + '」を入れました');
        };
        const draw = () => {
          Kit.clear(list);
          const rows = L.jikoList(mon, aite), on = can ? (jikoNow() || {}).id : null;
          for (const [style, label] of [['kango', '改まった言い方（〜の候）'], ['soft', 'やわらかい言い方'], ['any', '季節を問わない']]) {
            const rs = rows.filter((e) => e.style === style);
            if (!rs.length) continue;
            list.append(h('div', { class: 'tp-gl' }, label));
            for (const e of rs) {
              const ex = L.jikoOpening(e, aite), isOn = e.id === on, fit = e.style !== 'any' && L.jikoFits(e, S.date);
              const copy = () => Kit.copy(ex, '書き出しの1文をコピーしました');
              list.append(h('div', { class: 'tp-jk' + (isOn ? ' is-on' : '') + (fit ? ' is-fit' : ''), 'data-style': e.style },
                h('button', { type: 'button', class: 'tp-jk-main', 'aria-current': String(isOn), title: can ? 'この文書に入れる' : '書き出しの1文をコピー', onclick: () => (can ? insert(e) : copy()) },
                  h('span', { class: 'tp-jk-row' }, h('b', { class: 'tp-jk-t' }, e.text),
                    isOn ? h('span', { class: 'chip blue' }, Kit.icon('check', 12), 'いま入っています') : null,
                    fit && !isOn ? h('span', { class: 'chip line' }, '発行日（' + dateLabel() + '）に合う') : null),
                  h('span', { class: 'tp-jk-m' }, h('span', null, '時期：' + e.when), h('span', null, '相手：' + e.aite.map((a) => AITE_L[a]).join('・'))),
                  h('span', { class: 'tp-jk-ex' }, '例）' + ex)),
                Kit.btn('コピー', copy, { sm: true, kind: 'ghost', icon: 'copy', title: '書き出しの1文（あいさつ＋安否）をコピー' })));
            }
          }
        };
        const months = Kit.seg(Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: (i + 1) + '月' })), mon, (v) => { mon = +v; draw(); }, { label: '月' });
        months.classList.add('tp-months');
        draw();
        m = Kit.modal({
          title: '時候のあいさつ', wide: true,
          body: h('div', { class: 'stack' },
            h('p', { class: 'small ink-2' }, can ? '押すと、この文書の「拝啓」のあとに入ります。「コピー」は、あいさつと安否のあいさつの1文をコピーします。' : '押すと、書き出しの1文（あいさつと安否のあいさつ）をコピーします。ほかの文書にも使えます。'),
            h('div', { class: 'tp-jk-bar' }, months, h('div', { class: 'tp-jk-aite' }, h('span', { class: 'small ink-2' }, '相手'), Kit.seg(L.AITE.map((a) => ({ value: a.id, label: a.label })), aite, (v) => { aite = v; draw(); }, { label: '相手' }))),
            list,
            h('p', { class: 'small muted' }, '桜・梅雨・紅葉のころは、地域によって前後します。立春・立秋などの日付は、年によって1日ほどずれます。')),
          actions: [{ label: '閉じる', kind: 'ghost' }],
        });
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
        let syncTo = () => {};
        const upd = () => { if (!alive) return; drawOut(outSlot, t); syncTo(); };

        // 差し込み
        const sec = h('section', { class: 'card stack', 'aria-label': '差し込み' }, h('h3', { class: 'nl-sec' }, '入れること'));
        const av = autoVals();
        if (autos.length || letter) {
          const dIn = h('input', { type: 'date', id: 'tp-date', 'aria-label': '発行日' });
          dIn.value = S.date;
          dIn.addEventListener('change', () => { if (dIn.value) { S.date = dIn.value; render(); } });
          sec.append(h('div', { class: 'tp-auto' }, h('span', { class: 'small ink-2' }, '自動で入るもの：'),
            autos.filter((k) => k !== '時候').map((k) => h('span', { class: 'chip', title: AUTO_NOTE[k] || '' }, k + '：' + (av[k] || '（未設定）'))),
            h('label', { for: 'tp-date', class: 'small ink-2', style: { marginLeft: '6px' } }, '発行日'), dIn));
          if (autos.some((k) => !av[k])) sec.append(h('p', { class: 'small', style: { color: 'var(--warn)' } }, '「未設定」は、ホームの「学校の設定」（学校名・先生の名前）か、名簿のクラスで入ります。下の欄で直接書いても入ります。'));
        }
        // 時候のあいさつ（自動で入る。選んで変えられる）
        if (keys.includes('時候')) {
          const e = jikoNow();
          const src = S.jiko ? '選んだもの' : t.jiko ? 'このひな形の決まり' : '発行日（' + dateLabel() + '）に合わせて自動';
          const off = e && e.style !== 'any' && !L.jikoFits(e, S.date);
          sec.append(h('div', { class: 'tp-jiko' },
            h('span', { class: 'tp-jiko-k' }, '時候のあいさつ'),
            h('b', { class: 'tp-jiko-v' }, e ? e.text : av['時候']),
            h('span', { class: 'chip' + (S.jiko ? ' blue' : '') }, src),
            off ? h('span', { class: 'chip warn' }, Kit.icon('warn', 12), '発行日（' + dateLabel() + '）と時期がちがいます') : null,
            h('span', { class: 'tp-jiko-btns' },
              jikoBtn('時候のあいさつを選ぶ', () => openJiko()),
              S.jiko ? Kit.btn('自動にもどす', () => { const old = av['時候']; S.jiko = null; if (S.out && typeof S.out.body === 'string') S.out.body = S.out.body.replace(old + '、', autoVals()['時候'] + '、'); render(); }, { sm: true, kind: 'ghost', icon: 'refresh' }) : null)));
        }
        const fields = h('div', { class: 'tp-fields' });
        const inputs = {};
        for (const k of manual.concat(autos.filter((k) => !av[k]))) {
          const ex = (t.examples || {})[k] || '';
          const multi = /\n/.test(ex) || ex.length > 26;
          const el = h(multi ? 'textarea' : 'input', Object.assign({ id: 'tp-v-' + k, placeholder: ex ? '例：' + ex.replace(/\n/g, '・') : '' }, multi ? { rows: 2 } : { type: 'text' }));
          el.value = S.vals[k] != null ? S.vals[k] : S.keep[k] || '';
          el.addEventListener('input', () => {
            S.vals[k] = el.value;
            if (REMEMBER.includes(k)) { S.keep[k] = el.value.trim(); Kit.pref.set('templates:keep', S.keep); }
            upd();
          });
          inputs[k] = el;
          fields.append(Kit.field({ label: k, input: el, class: multi ? 'wide' : '', hint: REMEMBER.includes(k) ? '一度入れると、ほかのひな形にも入ります' : null }));
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
          const r0 = result();
          const toIn = h(/\n/.test(r0.to) ? 'textarea' : 'input', /\n/.test(r0.to) ? { id: 'tp-to', rows: 2 } : { type: 'text', id: 'tp-to' }), fromIn = h('textarea', { id: 'tp-from', rows: 2 });
          toIn.value = r0.to;
          fromIn.value = r0.from;
          toIn.addEventListener('input', () => { S.vals.__to = toIn.value; drawOut(outSlot, t); });
          fromIn.addEventListener('input', () => { S.vals.__from = fromIn.value; drawOut(outSlot, t); });
          // 直接直していなければ、上の欄に入れたことを宛名・発信者にもすぐ映す
          syncTo = () => { const r = result(); if (S.vals.__to == null) toIn.value = r.to; if (S.vals.__from == null) fromIn.value = r.from; };
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
            Kit.btn('コピー', () => { if (Kit.usage) Kit.usage('templates', 'copy'); Kit.copy(ta.value, 'コピーしました。連絡アプリ・メール・Classroom に貼れます'); }, { kind: 'primary', icon: 'copy' }),
            Kit.btn('件名もコピー', () => Kit.copy(o.title + '\n\n' + ta.value, '件名と本文をコピーしました'), { icon: 'copy', kind: 'ghost' }),
            h('a', { class: 'btn ghost', href: 'mailto:?subject=' + encodeURIComponent(o.title) + '&body=' + encodeURIComponent(ta.value.replace(/\n/g, '\r\n')) }, Kit.icon('mail'), h('span', null, 'メールで開く'))));
        } else {
          sec.append(h('div', { class: 'tp-paper' }, letterEl(o)), h('div', { class: 'btn-row' },
            Kit.btn('印刷', () => { if (Kit.usage) Kit.usage('templates', 'print'); School.print({ margin: '20mm', build: () => letterEl(result()) }); }, { kind: 'primary', icon: 'printer' }),
            Kit.btn('Word に書き出す', () => word(), { icon: 'download' }),
            Kit.btn('文章をコピー', () => Kit.copy(L.letterText(result()), '文書の文章をコピーしました'), { icon: 'copy', kind: 'ghost' })));
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
        if (Kit.usage) Kit.usage('templates', 'word');
        const o = result();
        try {
          const bytes = window.Docx.build(L.letterDocx(o));
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
            h('div', { class: 'tp-help' }, h('span', { class: 'small ink-2' }, '分類'), Kit.seg(L.GROUPS.map((g) => ({ value: g.id, label: g.label })), group, (v) => { group = v; }, { label: '分類' }),
              h('span', { class: 'small ink-2' }, '形'), Kit.seg([{ value: 'message', label: 'メッセージ' }, { value: 'letter', label: '文書' }], kind, (v) => { kind = v; }, { label: '形' })),
            Kit.field({ label: '題（件名）', input: f.title, id: 'tp-e-title' }), Kit.field({ label: '本文', input: f.body, id: 'tp-e-body', hint: '改まった文書は「拝啓　{時候}、…」で始め、最後の行に「敬具」と書くと右に寄ります。' }),
            Kit.field({ label: '記（文書のとき）', input: f.note, id: 'tp-e-note' }), Kit.field({ label: '返信票（文書のとき）', input: f.reply, id: 'tp-e-reply' })),
          actions: [{ label: 'やめる', kind: 'ghost' }, { label: '保存する', kind: 'primary', onClick: () => {
            if (!f.title.value.trim() || !f.body.value.trim()) { Kit.toast('題と本文を入れてください', { type: 'bad' }); return false; }
            return { group, kind, title: f.title.value.trim(), body: f.body.value, note: kind === 'letter' ? f.note.value : '', reply: kind === 'letter' ? f.reply.value : '' };
          } }],
        }));
        if (!res) return;
        // もとのひな形の宛名・発信者・時候の決まりは引きつぐ
        const carry = {};
        for (const k of ['to', 'from', 'aite', 'jiko']) if (base[k]) carry[k] = base[k];
        const it = Object.assign({}, t && t.mine ? { id: t.id } : {}, carry, res, { examples: (t && t.examples) || {}, desc: t && t.mine ? t.desc || '' : t ? 'もとは「' + slotTitle(t.title) + '」' : '' });
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

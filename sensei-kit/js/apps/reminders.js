// リマインダー：やること（期限・時刻・くり返し）。ページを開いている間は知らせる。スマホのカレンダーに書き出して確実に知らせることも
(function () {
  'use strict';
  const { h } = Kit;
  const pad = (n) => String(n).padStart(2, '0');
  const isYmd = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
  const md = (s) => Kit.fmtDate(s, 'M/D(W)');
  const REPEAT = [
    { value: 'none', label: 'しない' },
    { value: 'daily', label: '毎日' },
    { value: 'weekdays', label: '平日（月〜金）' },
    { value: 'weekly', label: '毎週' },
    { value: 'monthly', label: '毎月' },
  ];
  const repLabel = (r) => (REPEAT.find((x) => x.value === r) || REPEAT[0]).label;

  // くり返しの次の日付（平日は土日と祝日をとばす）
  function nextDate(r) {
    const d = r.date || Kit.ymd();
    if (r.repeat === 'daily') return Kit.ymd(Kit.addDays(d, 1));
    if (r.repeat === 'weekdays') { let x = Kit.addDays(d, 1); while (School.isOff(Kit.ymd(x))) x = Kit.addDays(x, 1); return Kit.ymd(x); }
    if (r.repeat === 'weekly') return Kit.ymd(Kit.addDays(d, 7));
    if (r.repeat === 'monthly') return Kit.ymd(Kit.addMonths(d, 1));
    return d;
  }
  const dueAt = (r) => { if (!isYmd(r.date)) return null; const d = Kit.parseYmd(r.date); if (r.time) { const [H, M] = r.time.split(':').map(Number); d.setHours(H, M, 0, 0); } else d.setHours(8, 0, 0, 0); return d; };

  // サンプル（先生のやること）
  const rr = (n, title, date, time, more) => Object.assign({ id: 's-rm-' + n, title, date, time: time || '', repeat: 'none', done: false, star: false, memo: '' }, more || {});
  const SAMPLE = [
    rr(1, '学年通信を印刷する', Kit.rel(0), '08:00', { star: true, memo: '120部。両面' }),
    rr(2, '保護者に電話（欠席の確認）', Kit.rel(0), '16:00'),
    rr(3, '宿題プリントを集める', Kit.rel(1), '08:30'),
    rr(4, '研究授業の指導案を配る', Kit.rel(4), '', { memo: '学年の先生と教務へ' }),
    rr(5, '週案を出す', Kit.rel((5 - new Date().getDay() + 7) % 7), '16:30', { repeat: 'weekly' }),
    rr(6, '出席簿の確認', Kit.rel(-1), '', { memo: '月末までに' }),
    rr(7, '成績入力（中間テストの分）', Kit.rel(18), ''),
    rr(8, '教室の観葉植物に水やり', Kit.rel(-3), '', { done: true, doneAt: new Date(Date.now() - 86400000).toISOString() }),
  ];
  Kit.store.sample('reminders', SAMPLE);

  Kit.css('reminders', `
.rm-quick{display:grid;gap:6px;margin-bottom:12px}
.rm-quick-row{display:flex;gap:8px}
.rm-quick-row input{flex:1}
.rm-pre{font-size:13px;color:var(--ink-2);min-height:22px}
.rm-groups{display:grid;gap:16px}
.rm-gh{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:700;margin-bottom:6px}
.rm-gh .chip{font-weight:500}
.rm-gh.bad{color:var(--bad)}
.rm-item{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:4px 10px;align-items:center;padding:9px 12px;border-bottom:1px solid var(--line);background:var(--surface)}
.rm-item:last-child{border-bottom:0}
.rm-item input[type=checkbox]{width:22px;height:22px}
.rm-main{display:grid;gap:1px;min-width:0;text-align:left;border:0;background:transparent;font:inherit;color:inherit;cursor:pointer;padding:0}
.rm-title{font-weight:700;overflow-wrap:anywhere}
.rm-meta{display:flex;flex-wrap:wrap;gap:4px 10px;font-size:12.5px;color:var(--ink-3);align-items:center}
.rm-meta svg{width:13px;height:13px}
.rm-meta .late{color:var(--bad);font-weight:700}
.rm-item.is-done .rm-title{text-decoration:line-through;color:var(--ink-3);font-weight:500}
.rm-star{border:0;background:transparent;cursor:pointer;color:var(--ink-3);padding:4px;border-radius:6px;display:grid;place-items:center}
.rm-star[aria-pressed="true"]{color:var(--series-4)}
.rm-star[aria-pressed="true"] svg{fill:currentColor}
.rm-star svg{width:20px;height:20px}
.rm-notice{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center;padding:10px 12px;border:1px solid var(--line);border-radius:var(--r);background:var(--surface);margin-bottom:14px;font-size:13.5px}
.rm-notice .grow{flex:1 1 200px}
`);

  // ページを開いている間の知らせ（時刻が来たら1回だけ）
  let ticker = 0;
  const notified = new Set(Kit.pref.get('rm:notified', []));
  async function tick() {
    let list;
    try { list = await Kit.store.list('reminders'); } catch (e) { return; }
    const now = Date.now();
    for (const r of list) {
      if (r.done || r.sample || !isYmd(r.date) || !r.time) continue;
      const t = dueAt(r).getTime();
      const key = r.id + '@' + r.date + 'T' + r.time;
      if (t <= now && now - t < 30 * 60000 && !notified.has(key)) {
        notified.add(key);
        Kit.pref.set('rm:notified', [...notified].slice(-200));
        Kit.toast('リマインダー：' + r.title, { ms: 10000, action: { label: '見る', onClick: () => Kit.go('reminders', { id: r.id }) } });
        try { if (window.Notification && Notification.permission === 'granted') new Notification('先生の道具箱', { body: r.title + (r.memo ? '\n' + r.memo : ''), tag: key }); } catch (e) { /* 知らせられない環境 */ }
      }
    }
  }
  function startTicker() { if (!ticker) { ticker = setInterval(tick, 30000); setTimeout(tick, 4000); } }
  Kit.store.init().then(startTicker);

  // 共有で受け取る
  School.share.receive('reminders', async (pack) => {
    const items = pack.items.filter((x) => x && x.title).map((x) => ({ title: String(x.title).slice(0, 120), date: isYmd(x.date) ? x.date : '', time: /^\d{2}:\d{2}$/.test(x.time || '') ? x.time : '', repeat: REPEAT.some((r) => r.value === x.repeat) ? x.repeat : 'none', memo: String(x.memo || '').slice(0, 1000), done: false, star: false }));
    const boxes = items.map((it, i) => ({ it, cb: h('input', { type: 'checkbox', id: 'rm-in-' + i, checked: true }) }));
    Kit.modal({
      title: '共有されたリマインダー' + (pack.from ? '（' + pack.from + 'から）' : ''), wide: true,
      body: h('div', { class: 'stack tight' }, h('p', null, items.length + '件のリマインダーが届きました。入れるものにチェックを入れてください。'),
        boxes.map(({ it, cb }, i) => h('label', { class: 'check', for: 'rm-in-' + i }, cb, h('span', null, h('b', null, it.title), '　', h('span', { class: 'small muted' }, (it.date ? md(it.date) : '日付なし') + (it.time ? ' ' + it.time : '') + (it.repeat !== 'none' ? '・' + repLabel(it.repeat) : '')))))),
      actions: [{ label: 'やめる', kind: 'ghost' }, {
        label: '入れる', kind: 'primary', onClick: async () => {
          const pick = boxes.filter((x) => x.cb.checked).map((x) => x.it);
          if (!pick.length) { Kit.toast('選んでください', { type: 'bad' }); return false; }
          for (const it of pick) await Kit.store.put('reminders', it);
          Kit.toast(pick.length + '件のリマインダーを入れました');
          if (Kit.current() !== 'reminders') Kit.go('reminders');
          return true;
        },
      }],
    });
  });

  Kit.app({
    id: 'reminders', title: 'リマインダー', group: 'plan', icon: 'bell', order: 70,
    desc: 'やることを期限つきで。時刻が来たら知らせる。共有も',
    colls: ['reminders'],
    async mount(root, params) {
      let list = [], showDone = Kit.pref.get('rm:done', false), alive = true;
      const sampleSlot = h('div'), notice = h('div'), body = h('div');
      root.append(Kit.appHead({
        title: 'リマインダー',
        desc: '「明日 8時 学年通信を印刷」のように書くと、日付と時刻を読み取ります。時刻が来ると知らせます（このページを開いている間）。',
        actions: [Kit.btn('追加', () => edit(null), { kind: 'primary', icon: 'plus' }), Kit.btn('共有', () => share(), { icon: 'share' }), Kit.btn('スマホのカレンダーへ', () => exportIcs(), { icon: 'download', kind: 'ghost' })],
      }), sampleSlot, quick(), notice, body);

      function quick() {
        const inp = h('input', { type: 'text', id: 'rm-quick', placeholder: '例：明日 8時 学年通信を印刷', autocomplete: 'off', enterkeyhint: 'done' });
        const pre = h('div', { class: 'rm-pre', 'aria-live': 'polite' });
        const parse = () => {
          const v = inp.value.trim();
          if (!v) return null;
          const q = window.SenseiCalendar ? SenseiCalendar.parseQuick(v) : { title: v, date: Kit.ymd(), dateGiven: false, allDay: true, start: '' };
          return { title: q.title, date: q.dateGiven ? q.date : '', time: q.allDay ? '' : q.start, bad: q.bad };
        };
        const show = () => {
          const p = parse();
          Kit.clear(pre);
          if (!p) { pre.textContent = '日付を書かなければ「日付なし」で入ります。'; return; }
          if (p.bad) { pre.textContent = 'その日付はありません。'; return; }
          pre.append('→ ', h('b', null, p.title || '（名前を入れてください）'), '　', p.date ? md(p.date) + (p.time ? ' ' + p.time : '') : '日付なし');
        };
        const go = async () => {
          const p = parse();
          if (!p || p.bad || !p.title) { inp.focus(); Kit.toast('「明日 8時 学年通信を印刷」のように入れてください', { type: 'bad' }); return; }
          await Kit.store.put('reminders', { title: p.title, date: p.date, time: p.time, repeat: 'none', done: false, star: false, memo: '' });
          Kit.toast('「' + p.title + '」を入れました');
          inp.value = ''; show();
        };
        inp.addEventListener('input', show);
        inp.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); go(); } });
        show();
        return h('div', { class: 'rm-quick' }, h('label', { for: 'rm-quick', style: { fontWeight: 700 } }, 'すばやく追加'), h('div', { class: 'rm-quick-row' }, inp, Kit.btn('追加', go, { kind: 'primary', icon: 'plus' })), pre);
      }

      async function load() { list = await Kit.store.list('reminders'); }
      function render() {
        Kit.clear(sampleSlot); Kit.clear(notice); Kit.clear(body);
        if (list.some((r) => r.sample)) sampleSlot.append(Kit.sampleBar('先生のやることの例です。チェックを入れたり、書きかえたりして試せます。'));
        // 知らせの状態
        const perm = window.Notification ? Notification.permission : 'unsupported';
        notice.append(h('div', { class: 'rm-notice' }, Kit.icon('bell', 18),
          h('span', { class: 'grow' }, perm === 'granted' ? 'このページを開いている間は、時刻が来たら知らせます。' : perm === 'denied' ? '通知がブロックされています（画面の中の知らせだけ出します）。' : 'このページを開いている間、時刻が来たら知らせます。', h('br'), h('span', { class: 'small muted' }, 'ページを閉じていても知らせてほしいときは「スマホのカレンダーへ」で書き出し、スマホのカレンダーの通知を使ってください。')),
          perm === 'default' ? Kit.btn('通知をオンにする', async () => { try { await Notification.requestPermission(); } catch (e) { /* noop */ } render(); }, { sm: true, icon: 'bell' }) : null));
        const t = Kit.ymd(), tm = Kit.rel(1), wk = Kit.rel(7);
        const open = list.filter((r) => !r.done);
        const by = (a, b) => (a.date || '9999').localeCompare(b.date || '9999') || (a.time || '99').localeCompare(b.time || '99') || (b.star ? 1 : 0) - (a.star ? 1 : 0);
        const groups = [
          { id: 'late', label: '期限切れ', tone: 'bad', items: open.filter((r) => r.date && r.date < t) },
          { id: 'today', label: '今日', items: open.filter((r) => r.date === t) },
          { id: 'tomorrow', label: '明日', items: open.filter((r) => r.date === tm) },
          { id: 'week', label: 'この1週間', items: open.filter((r) => r.date > tm && r.date <= wk) },
          { id: 'later', label: 'それより先', items: open.filter((r) => r.date > wk) },
          { id: 'nodate', label: '日付なし', items: open.filter((r) => !r.date) },
        ];
        const box = h('div', { class: 'rm-groups' });
        let any = false;
        for (const g of groups) {
          if (!g.items.length) continue;
          any = true;
          box.append(h('section', { 'aria-label': g.label },
            h('div', { class: 'rm-gh' + (g.tone ? ' ' + g.tone : '') }, g.label, h('span', { class: 'chip' }, g.items.length)),
            h('div', { class: 'list' }, g.items.sort(by).map(item))));
        }
        if (!any) box.append(Kit.empty({ title: 'やることはありません', body: '上の「すばやく追加」から入れられます。ひと息つけます。' }));
        const done = list.filter((r) => r.done).sort((a, b) => String(b.doneAt || '').localeCompare(String(a.doneAt || '')));
        if (done.length) {
          const cb = h('input', { type: 'checkbox', id: 'rm-show-done', checked: showDone, onchange: () => { showDone = cb.checked; Kit.pref.set('rm:done', showDone); render(); } });
          box.append(h('section', { 'aria-label': '終わったもの' },
            h('div', { class: 'rm-gh' }, h('label', { class: 'check', for: 'rm-show-done' }, cb, '終わったもの（' + done.length + '）'), h('span', { class: 'grow' }),
              showDone ? Kit.btn('終わったものを消す', clearDone, { sm: true, kind: 'ghost', icon: 'trash' }) : null),
            showDone ? h('div', { class: 'list' }, done.slice(0, 50).map(item)) : null));
        }
        body.append(box);
        if (params && params.id) { const el = body.querySelector('[data-id="' + params.id + '"]'); if (el) { el.scrollIntoView({ block: 'center' }); el.style.outline = '2px solid var(--shu)'; } params = {}; }
      }
      function item(r) {
        const t = Kit.ymd();
        const late = !r.done && r.date && r.date < t;
        const cb = h('input', { type: 'checkbox', checked: !!r.done, 'aria-label': r.title + 'を終わりにする', onchange: () => toggle(r, cb.checked) });
        return h('div', { class: 'rm-item' + (r.done ? ' is-done' : ''), 'data-id': r.id },
          cb,
          h('button', { type: 'button', class: 'rm-main', onclick: () => edit(r) },
            h('span', { class: 'rm-title' }, r.title || '（名前なし）'),
            h('span', { class: 'rm-meta' },
              r.date ? h('span', { class: late ? 'late' : '' }, md(r.date) + (r.time ? ' ' + r.time : '') + (late ? '（' + (-Kit.daysBetween(t, r.date)) + '日すぎ）' : '')) : null,
              r.repeat && r.repeat !== 'none' ? h('span', null, Kit.icon('refresh'), repLabel(r.repeat)) : null,
              r.memo ? h('span', null, r.memo.length > 40 ? r.memo.slice(0, 40) + '…' : r.memo) : null,
              r.sample ? h('span', { class: 'chip sample' }, '例') : null)),
          h('button', { type: 'button', class: 'rm-star', 'aria-pressed': String(!!r.star), 'aria-label': r.star ? '大事の印を外す' : '大事の印をつける', onclick: () => { Kit.store.put('reminders', Object.assign({}, r, { star: !r.star })); } }, Kit.icon('star')));
      }
      async function toggle(r, on) {
        if (on && r.repeat && r.repeat !== 'none') {
          const next = nextDate(r);
          await Kit.store.put('reminders', Object.assign({}, r, { date: next, done: false }));
          Kit.toast('次は ' + md(next) + '（' + repLabel(r.repeat) + '）');
          return;
        }
        await Kit.store.put('reminders', Object.assign({}, r, { done: on, doneAt: on ? new Date().toISOString() : '' }));
        if (on) Kit.toast('「' + r.title + '」おつかれさまでした', { action: { label: '元に戻す', onClick: () => Kit.store.put('reminders', Object.assign({}, r, { done: false })) } });
      }
      async function clearDone() {
        const ok = await Kit.confirm({ title: '終わったものを消しますか？', body: '終わったリマインダーを、すべて消します。', ok: '消す', danger: true });
        if (!ok) return;
        for (const r of list.filter((x) => x.done)) await Kit.store.remove('reminders', r.id);
      }
      function edit(r) {
        const isNew = !r;
        const d = Object.assign({ title: '', date: Kit.ymd(), time: '', repeat: 'none', memo: '', star: false }, r || {});
        const f = {
          title: h('input', { type: 'text', id: 'rm-f-title', maxlength: 120, value: d.title, placeholder: '例：学年通信を印刷する' }),
          date: h('input', { type: 'date', id: 'rm-f-date', value: d.date || '' }),
          time: h('input', { type: 'time', id: 'rm-f-time', value: d.time || '', step: 300 }),
          repeat: h('select', { id: 'rm-f-repeat' }, REPEAT.map((x) => h('option', { value: x.value }, x.label))),
          memo: h('textarea', { id: 'rm-f-memo', rows: 3, placeholder: 'メモ（部数・持ち物・相手など）' }),
        };
        f.repeat.value = d.repeat || 'none'; f.memo.value = d.memo || '';
        const save = async () => {
          if (!f.title.value.trim()) { Kit.toast('名前を入れてください', { type: 'bad' }); f.title.focus(); return false; }
          if (f.repeat.value !== 'none' && !f.date.value) { Kit.toast('くり返すときは、日付を入れてください', { type: 'bad' }); f.date.focus(); return false; }
          const it = Object.assign({}, r || {}, { title: f.title.value.trim(), date: f.date.value || '', time: f.time.value || '', repeat: f.repeat.value, memo: f.memo.value.trim(), done: r ? !!r.done : false, star: !!d.star });
          delete it.sample;
          await Kit.store.put('reminders', it);
          Kit.toast(isNew ? '入れました' : '保存しました');
          return true;
        };
        const del = async () => {
          await Kit.store.remove('reminders', r.id);
          Kit.toast('消しました', { action: { label: '元に戻す', onClick: () => Kit.store.put('reminders', r) } });
          return true;
        };
        const m = Kit.modal({
          title: isNew ? 'リマインダーを追加' : 'リマインダーを直す', autofocus: 'input',
          body: h('div', { class: 'stack' }, Kit.field({ label: 'やること', input: f.title }),
            h('div', { class: 'grid cols-2' }, Kit.field({ label: '日付（空欄なら日付なし）', input: f.date }), Kit.field({ label: '時刻（空欄なら知らせない）', input: f.time })),
            Kit.field({ label: 'くり返し', input: f.repeat, hint: '終わりにすると、次の日付に進みます（平日は土日・祝日をとばします）。' }),
            Kit.field({ label: 'メモ', input: f.memo })),
          actions: (isNew ? [] : [{ label: '消す', kind: 'danger', onClick: del }]).concat([{ label: 'やめる', kind: 'ghost' }, { label: isNew ? '追加する' : '保存する', kind: 'primary', onClick: save }]),
        });
        const delBtn = m.el.querySelector('.modal-f .btn.danger');
        if (delBtn) delBtn.style.marginRight = 'auto';
      }
      async function share() {
        const p = await Kit.profile.get();
        const items = list.filter((r) => !r.done && !r.sample).map((r) => ({ title: r.title, date: r.date || '', time: r.time || '', repeat: r.repeat || 'none', memo: r.memo || '' }));
        if (!items.length) { Kit.toast('共有するリマインダーがありません（例は共有されません）', { type: 'bad' }); return; }
        School.share.open(School.share.pack('reminders', items, { title: 'リマインダー', from: p._sample ? '' : p.teacher }), { what: 'まだ終わっていないリマインダー', note: '学年の先生と「やること」をそろえたいときに。受け取った人は、選んで自分のリマインダーに入れられます。' });
      }
      async function exportIcs() {
        const items = list.filter((r) => !r.done && r.date).map((r) => ({ id: r.id, title: r.title, date: r.date, allDay: !r.time, start: r.time || '', end: '', memo: r.memo || '', repeat: r.repeat, alarm: r.time ? '-PT0M' : 'PT8H' }));
        if (!items.length) { Kit.toast('日付のあるリマインダーがありません', { type: 'bad' }); return; }
        if (!Kit.canDownload('ics')) { Kit.toast('この画面では .ics を書き出せません。手元のブラウザで開いてください', { type: 'bad' }); return; }
        const ics = SenseiCalendar.toIcs(items, '先生の道具箱のリマインダー');
        if (await Kit.download('reminders-' + Kit.ymd() + '.ics', ics)) {
          Kit.modal({ title: 'スマホのカレンダーに入れる', body: h('div', { class: 'stack small' }, h('p', null, items.length + '件を .ics ファイルに書き出しました。時刻のあるものは、その時刻に（ないものは朝8時に）スマホのカレンダーが知らせます。'),
            h('ul', { style: { paddingLeft: '1.2em', margin: 0 } }, h('li', null, 'iPhone：ファイルを開いて「すべてを追加」。'), h('li', null, 'Android・パソコン：Googleカレンダー（パソコンのブラウザ）→ 設定 → インポート。'), h('li', null, '書き出したあとに直したものは、もう一度書き出してください（同じものは上書きされます）。'))), actions: [{ label: '閉じる', kind: 'primary' }] });
        }
      }

      await load();
      render();
      const reload = Kit.debounce(async () => { if (!alive) return; await load(); render(); }, 80);
      const off = Kit.store.on('coll:reminders', reload);
      return () => { alive = false; off(); reload.cancel(); };
    },
  });

  window.SenseiReminders = { nextDate, dueAt, REPEAT };
})();

// ホーム：今日の時間割・日直と当番・予定・やること・宿題の締切、道具の入口、すでにある道具、保存とバックアップ
(function () {
  'use strict';
  const { h } = Kit;

  // すでにある道具（作り直さずに、つなぐ）
  const OTHER_TOOLS = [
    { title: 'かんたん成績', url: 'https://dora9991.github.io/kantan-seiseki/', icon: 'chart', desc: '観点別のA・B・Cと5段階評定。名簿は「番号と氏名をコピー」で、宿題の提出は「かんたん成績へ（CSV）」で入れられます。' },
    { title: '面談スケジューラ', url: 'https://dora9991.github.io/mendan-scheduler/', icon: 'clock', desc: '三者・二者面談の日程を、空き枠から自動で組みます。決まった日程はカレンダーへ。' },
    { title: '数学ポータル（先生用）', url: 'https://math-portal.pages.dev/portal/teacher.html', icon: 'school', desc: '小テストの配布・生徒の学習記録（Classi のような入口）。公開していれば開けます。' },
  ];

  Kit.css('home', `
.hm-top{display:grid;gap:16px;grid-template-columns:1fr}
@media (min-width:980px){.hm-top{grid-template-columns:minmax(0,1.1fr) minmax(0,1fr)}}
.hm-h2{font-size:15px;font-weight:700;display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px;white-space:nowrap}
.hm-h2 .chip{max-width:100%;overflow:hidden;text-overflow:ellipsis}
.hm-start{margin-bottom:16px;border-color:color-mix(in srgb,var(--gosu) 35%,var(--line));background:linear-gradient(180deg,color-mix(in srgb,var(--gosu-wash) 55%,var(--surface)) 0,var(--surface) 70%)}
.hm-start-title{font-family:var(--font-display);font-size:20px;font-weight:600;letter-spacing:.03em}
.hm-start-lead{margin-top:4px;font-size:14.5px;color:var(--ink-2);max-width:46em}
.hm-steps{list-style:none;margin:14px 0 0;padding:0;display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr))}
.hm-step{position:relative;display:flex;flex-direction:column;gap:8px;padding:14px;border-radius:var(--r);background:var(--surface);border:1px solid var(--line)}
.hm-step-go{display:grid;grid-template-columns:auto minmax(0,1fr);gap:0 12px;align-items:center;padding:0;border:0;background:transparent;color:var(--ink);font:inherit;text-align:left;cursor:pointer}
.hm-step-go:hover .hm-step-name{color:var(--gosu)}
.hm-step-no{grid-row:span 2;width:40px;height:40px;border-radius:50%;display:grid;place-items:center;background:var(--board);color:var(--on-board);font-family:var(--font-display);font-weight:600;font-size:19px}
.hm-step-name{font-weight:700;font-size:16.5px}
.hm-step-sub{font-size:13px;color:var(--ink-3)}
.hm-step .demo-btn{align-self:flex-start}
/* カードの中の「使い方を見る」は控えめに（黄色の塗りは見出しの1つだけ） */
.hm-step .demo-btn,.hm-tools .demo-btn{background:transparent;border-color:var(--line-strong)}
.hm-step .demo-btn:hover,.hm-tools .demo-btn:hover{background:var(--demo-wash)}
.hm-start-foot{margin-top:14px}
.hm-tool-wrap{position:relative;display:grid}
.hm-tool-wrap .hm-tool{padding-bottom:50px}
.hm-tool-wrap .demo-btn{position:absolute;right:12px;bottom:10px}
.hm-tt{display:grid;gap:4px;margin-top:10px}
.hm-tt-row{display:grid;grid-template-columns:32px 74px minmax(0,1fr);gap:8px;align-items:center;padding:5px 8px;border-radius:8px;background:var(--surface-2);font-size:14px}
.hm-tt-row.has{background:color-mix(in srgb,var(--c) 14%,var(--surface))}
.hm-tt-row .p{font-weight:700;text-align:center}
.hm-tt-row .t{font-size:12px;color:var(--ink-3);font-variant-numeric:tabular-nums}
.hm-tt-row .s b{font-weight:700}
.hm-tt-row.now{outline:2px solid var(--shu)}
.hm-todo{margin-top:10px}
.hm-todo .list-item{align-items:center}
.hm-ic{flex:none;width:32px;height:32px;border-radius:8px;display:grid;place-items:center;background:var(--gosu-wash);color:var(--gosu)}
.hm-ic svg{width:17px;height:17px}
.hm-ic.bad{background:var(--bad-wash);color:var(--bad)}
.hm-ic.shu{background:var(--shu-wash);color:var(--shu)}
.hm-main{flex:1;min-width:0}
.hm-sub{font-size:12.5px;color:var(--ink-3)}
.hm-group{display:grid;gap:8px}
.hm-group+.hm-group{margin-top:16px}
.hm-group-label{font-size:12px;letter-spacing:.16em;color:var(--ink-3);font-weight:700}
.hm-tools{display:grid;gap:10px;grid-template-columns:repeat(auto-fill,minmax(min(100%,270px),1fr))}
.hm-tools .demo-btn{min-height:32px;font-size:12.5px}
.hm-tool{display:grid;grid-template-columns:auto minmax(0,1fr);gap:2px 12px;align-items:start;text-align:left;padding:14px;border-radius:var(--r);background:var(--surface);border:1px solid var(--line);color:var(--ink);font:inherit;cursor:pointer;text-decoration:none;transition:border-color .12s,transform .06s}
.hm-tool:hover{border-color:var(--gosu);color:var(--ink)}
.hm-tool:active{transform:translateY(1px)}
.hm-tool-ic{grid-row:span 3;width:36px;height:36px;border-radius:9px;display:grid;place-items:center;background:var(--gosu-wash);color:var(--gosu)}
.hm-tool-ic svg{width:19px;height:19px}
.hm-tool-title{font-weight:700;font-size:15px;display:flex;align-items:center;gap:6px}
.hm-tool-title svg{width:14px;height:14px;color:var(--ink-3)}
.hm-tool-desc{font-size:12.5px;color:var(--ink-3);line-height:1.5}
.hm-tool-stat{font-size:13px;color:var(--ink-2);margin-top:4px;font-variant-numeric:tabular-nums}
.hm-flow{display:flex;flex-wrap:wrap;gap:6px;align-items:stretch}
.hm-flow-step{flex:1 1 calc(25% - 6px);display:grid;gap:2px;padding:10px 12px;border-radius:8px;background:var(--surface-2);border:0;color:var(--ink);font:inherit;text-align:left;cursor:pointer;min-width:0}
.hm-flow-step:hover{background:var(--gosu-wash)}
@media (max-width:640px){.hm-flow-step{flex-basis:calc(50% - 6px)}}
.hm-flow-no{font-family:var(--font-display);font-weight:600;color:var(--gosu);font-size:13px}
.hm-flow-name{font-weight:700;font-size:14px}
.hm-flow-tool{font-size:12px;color:var(--ink-3)}
.hm-data ul{margin:6px 0 0;padding-left:1.3em;font-size:13.5px;color:var(--ink-2)}
.hm-data li+li{margin-top:3px}
.hm-duty{display:flex;flex-wrap:wrap;gap:4px 14px;margin-top:10px;padding:8px 10px;border-radius:8px;background:var(--surface-2);font-size:13.5px;border:0;width:100%;text-align:left;color:var(--ink);font-family:inherit;cursor:pointer}
.hm-duty:hover{background:var(--gosu-wash)}
.hm-duty b{font-weight:700}
`);

  // くり返しの予定が、その日にあるか
  function occursOn(ev, ymd) {
    if (!ev || !ev.date) return false;
    if (ev.date === ymd) return true;
    if (!ev.repeat || ev.repeat === 'none' || ymd < ev.date) return false;
    if (ev.repeatUntil && ymd > ev.repeatUntil) return false;
    const a = Kit.parseYmd(ev.date), b = Kit.parseYmd(ymd);
    if (ev.repeat === 'weekly') return a.getDay() === b.getDay();
    if (ev.repeat === 'monthly') return a.getDate() === b.getDate();
    return false;
  }
  const colorOf = (name) => { let x = 0; for (const ch of String(name || '')) x = (x * 31 + ch.charCodeAt(0)) >>> 0; return 'var(--series-' + ((x % 8) + 1) + ')'; };
  const dayTag = (ymd, today) => {
    const n = Kit.daysBetween(today, ymd);
    if (n < 0) return h('span', { class: 'chip bad' }, n === -1 ? '昨日まで' : (-n) + '日すぎ');
    if (n === 0) return h('span', { class: 'chip shu' }, '今日');
    if (n === 1) return h('span', { class: 'chip blue' }, '明日');
    return h('span', { class: 'chip' }, Kit.fmtDate(ymd, 'M/D(W)'));
  };

  Kit.app({
    id: 'home', title: 'ホーム', group: 'home', icon: 'home', order: 1,
    desc: '今日の時間割・予定・やること、道具の入口',
    async mount(root) {
      let alive = true;
      const rerender = Kit.debounce(() => { if (alive) render(); }, 120);
      const off = Kit.store.on('*', rerender);
      const offC = School.onClassChange(rerender);

      async function render() {
        const [profile, events, reminders, homework, classes, tt, duty, letter, mine] = await Promise.all([
          Kit.profile.get(), Kit.store.list('events'), Kit.store.list('reminders'), Kit.store.list('homework'), School.classes.list(),
          window.SenseiTimetable ? window.SenseiTimetable.today() : null,
          window.SenseiDuty ? window.SenseiDuty.today().catch(() => null) : null,
          window.SenseiNewsletter ? window.SenseiNewsletter.latest().catch(() => null) : null,
          Kit.appDef('templates') ? Kit.store.list('msgtemplates') : [],
        ]);
        if (!alive) return;
        const today = Kit.ymd(), tomorrow = Kit.rel(1);
        const hour = new Date().getHours();
        const hello = hour < 10 ? 'おはようございます' : hour < 17 ? 'こんにちは' : 'おつかれさまです';
        const hol = School.holiday(today);
        Kit.clear(root);
        root.append(Kit.appHead({
          title: hello + (profile.teacher ? '、' + profile.teacher : ''),
          desc: Kit.fmtDate(today, 'YYYY年M月D日(W)') + (hol ? '・' + hol : '') + '　' + profile.year + '年度' + (profile.school ? '　' + profile.school : ''),
          actions: [Kit.btn('学校の設定', () => Kit.profile.edit().then(render), { icon: 'school' }), Kit.btn('バックアップ', () => root.querySelector('#hm-backup').scrollIntoView({ behavior: 'smooth' }), { icon: 'save', kind: 'ghost' })],
        }));

        if (Kit.store.samplesShown() && (classes.some((c) => c.sample) || events.some((e) => e.sample))) {
          // はじめての方へ：3つの手順と、それぞれの使い方のデモ。デモ中は出さない（帯が出ているので）
          const STEPS = [['1', '名簿を入れる', 'Excel から貼るだけ。番号だけでも', 'roster'], ['2', '席替えをする', '条件つきのくじ。発表・印刷も', 'seats'], ['3', '係・当番を決める', '名簿からそのまま表に', 'roles']].filter((x) => Kit.appDef(x[3]));
          root.append(h('section', { class: 'card pad-lg hm-start', 'aria-label': 'はじめての方へ' },
            h('h2', { class: 'hm-start-title' }, 'はじめての方へ'),
            h('p', { class: 'hm-start-lead' }, '架空のクラス「2年3組」で、全部の道具を試せます。「使い方を見る」を押すと、操作の流れを実際に動かして見せます（あなたのデータは変わりません）。'),
            h('ol', { class: 'hm-steps' }, STEPS.map(([no, name, sub, id]) => h('li', { class: 'hm-step' },
              h('button', { type: 'button', class: 'hm-step-go', onclick: () => Kit.go(id) }, h('span', { class: 'hm-step-no' }, no), h('span', { class: 'hm-step-name' }, name), h('span', { class: 'hm-step-sub' }, sub)),
              Kit.demo && Kit.demo.has(id) ? h('button', { type: 'button', class: 'demo-btn', onclick: () => Kit.demo.start(id) }, Kit.icon('play', 12), h('span', null, '使い方を見る')) : null))),
            Kit.store.demo ? null : h('div', { class: 'btn-row hm-start-foot' },
              Kit.btn('自分のクラスで始める', startOwn, { kind: 'primary', icon: 'users' }),
              Kit.btn('サンプルを片付ける', clearSamples, { kind: 'ghost', icon: 'trash' }))));
        }

        /* ── 今日の時間割 ── */
        const ttCard = h('section', { class: 'card', 'aria-label': '今日の時間割' }, h('h2', { class: 'hm-h2' }, Kit.icon('table', 18), '今日の時間割', tt && tt.grid ? h('span', { class: 'chip' }, tt.grid.name) : null));
        if (!tt) ttCard.append(h('p', { class: 'small muted', style: { marginTop: '10px' } }, '「時間割」で わたしの時間割 をつくると、ここに今日の分が出ます。'), h('div', { class: 'btn-row', style: { marginTop: '8px' } }, Kit.btn('時間割をつくる', () => Kit.go('timetable'), { sm: true, icon: 'plus' })));
        else if (School.isOff(today) || !tt.items.length) ttCard.append(h('p', { class: 'small muted', style: { marginTop: '10px' } }, hol ? '今日は' + hol + 'です。' : '今日は授業のない日です。ゆっくり休めますように。'));
        else {
          const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
          const toMin = (t) => { const m = /^(\d{1,2}):(\d{2})/.exec(t || ''); return m ? +m[1] * 60 + +m[2] : null; };
          ttCard.append(h('div', { class: 'hm-tt' }, tt.items.map((it) => {
            const s = it.cell && it.cell.s, a = toMin(it.bell.start), b = toMin(it.bell.end);
            const now = a != null && b != null && nowMin >= a && nowMin < b;
            return h('div', { class: 'hm-tt-row' + (s ? ' has' : '') + (now ? ' now' : ''), style: s ? '--c:' + colorOf(s) : null },
              h('span', { class: 'p' }, it.p + 1), h('span', { class: 't' }, it.bell.start ? it.bell.start + '〜' : ''),
              h('span', { class: 's' }, s ? h('b', null, s) : h('span', { class: 'muted' }, '空き'), it.cell && it.cell.n ? '　' + it.cell.n : ''));
          })));
        }

        // 今日の日直・今週の給食当番（当番表を使っていれば）
        if (duty && (duty.nicchoku.length || duty.lunch) && !School.isOff(today)) {
          ttCard.append(h('button', { type: 'button', class: 'hm-duty', onclick: () => Kit.go('duty'), 'aria-label': '当番表を開く' },
            duty.nicchoku.length ? h('span', null, '今日の日直：', h('b', null, duty.nicchoku.join('・'))) : null,
            duty.lunch ? h('span', null, '今週の給食当番：', h('b', null, duty.lunch)) : null));
        }

        /* ── 今日・明日やること ── */
        const todo = [];
        for (const day of [today, tomorrow]) {
          for (const e of events.filter((x) => occursOn(x, day)).sort((a, b) => String(a.start || '').localeCompare(String(b.start || '')))) {
            todo.push({ rank: day === today ? 3 : 6, icon: 'calendar', text: h('span', null, e.title || '予定'), sub: e.allDay || !e.start ? '終日' + (e.place ? '・' + e.place : '') : e.start + (e.end ? '〜' + e.end : '') + (e.place ? '・' + e.place : ''), tag: dayTag(day, today), go: () => Kit.go('calendar', { date: day }) });
          }
        }
        for (const r of reminders) {
          if (r.done || !r.date || r.date > tomorrow) continue;
          const late = r.date < today;
          todo.push({ rank: late ? 0 : r.date === today ? (r.star ? 1 : 2) : 5, icon: 'bell', tone: late ? 'bad' : r.star ? 'shu' : '', text: h('span', null, h('b', null, r.title)), sub: (r.time ? r.time : '') + (r.memo ? (r.time ? '・' : '') + r.memo : ''), tag: dayTag(r.date, today), go: () => Kit.go('reminders', { id: r.id }) });
        }
        for (const hw of homework) {
          if (hw.closed || !hw.due || hw.due > tomorrow) continue;
          const c = classes.find((x) => x.id === hw.classId);
          if (!c) continue;
          const left = c.students.filter((s) => !(hw.checks || {})[s.id]).length;
          const late = hw.due < today;
          todo.push({ rank: late ? 1 : 4, icon: 'clipboard', tone: late && left ? 'bad' : '', text: h('span', null, '宿題：', h('b', null, hw.title)), sub: c.name + (left ? '・まだ ' + left + '人' : '・全員提出'), tag: dayTag(hw.due, today), go: () => Kit.go('homework', { id: hw.id }) });
        }
        todo.sort((a, b) => a.rank - b.rank);
        const SHOW = 7;
        const list = h('div', { class: 'list hm-todo' });
        const item = (t) => h('button', { type: 'button', class: 'list-item', onclick: t.go },
          h('span', { class: 'hm-ic' + (t.tone ? ' ' + t.tone : '') }, Kit.icon(t.icon)),
          h('span', { class: 'hm-main' }, h('span', { class: 'ellipsis', style: { display: 'block' } }, t.text), t.sub ? h('span', { class: 'hm-sub ellipsis', style: { display: 'block' } }, t.sub) : null),
          t.tag || null);
        todo.slice(0, SHOW).forEach((t) => list.append(item(t)));
        const todoCard = h('section', { class: 'card', 'aria-label': '今日・明日やること' },
          h('h2', { class: 'hm-h2' }, Kit.icon('checks', 18), '今日・明日やること', todo.length ? h('span', { class: 'chip' }, todo.length + '件') : null),
          todo.length ? list : h('p', { class: 'small muted', style: { marginTop: '10px' } }, '今日・明日の予定や、期限のせまったことはありません。ひと息つけます。'));
        if (todo.length > SHOW) { const more = Kit.btn('ほかに ' + (todo.length - SHOW) + '件', () => { todo.slice(SHOW).forEach((t) => list.append(item(t))); more.remove(); }, { sm: true, kind: 'ghost', icon: 'down' }); more.style.marginTop = '8px'; todoCard.append(more); }
        root.append(h('div', { class: 'hm-top' }, todoCard, ttCard));

        /* ── 道具箱 ── */
        const cur = await School.classes.current();
        const stat = {
          roster: () => (classes.length ? classes.length + 'クラス・' + Kit.sum(classes, (c) => c.students.length) + '人' : 'まだありません'),
          seats: () => (cur ? cur.name + 'の席' : '名簿を入れると使えます'),
          roles: () => (cur ? cur.name + 'の係' : '名簿を入れると使えます'),
          duty: () => (duty && duty.nicchoku.length ? '今日の日直：' + duty.nicchoku.join('・') : cur ? cur.name + 'の班と当番' : '名簿を入れると使えます'),
          newsletter: () => (letter ? '最新：' + letter.name + ' 第' + letter.no + '号（' + Kit.fmtDate(letter.date, 'M/D') + '）' : 'まだありません'),
          templates: () => (window.Letters ? window.Letters.TEMPLATES.length + 'のひな形' : '') + (mine.length ? '・わたしの ' + mine.length : ''),
          timetable: () => (tt && tt.grid ? tt.grid.name : 'わたしの時間割・自動作成'),
          homework: () => { const open = homework.filter((x) => !x.closed); return open.length ? '出している宿題 ' + open.length + '件' : 'まだありません'; },
          calendar: () => { let n = 0; for (let i = 0; i < 7; i++) { const d = Kit.rel(i); n += events.filter((e) => occursOn(e, d)).length; } return 'この7日の予定 ' + n + '件'; },
          reminders: () => { const open = reminders.filter((r) => !r.done); return open.length ? 'のこり ' + open.length + '件' : 'やることはありません'; },
        };
        const LABEL = { class: 'クラス', lesson: '授業', plan: '予定', write: '通信・連絡' };
        const tools = h('section', { style: { marginTop: '24px' }, 'aria-label': '道具箱' }, h('h2', { class: 'section-title' }, '道具箱'));
        for (const g of ['class', 'lesson', 'plan', 'write']) {
          const apps = Kit.apps().filter((a) => a.group === g);
          if (!apps.length) continue;
          tools.append(h('div', { class: 'hm-group' }, h('div', { class: 'hm-group-label' }, LABEL[g]),
            h('div', { class: 'hm-tools' }, apps.map((a) => {
              const card = h('button', { type: 'button', class: 'hm-tool', onclick: () => Kit.go(a.id) },
                h('span', { class: 'hm-tool-ic' }, Kit.icon(a.icon)), h('span', { class: 'hm-tool-title' }, a.title), h('span', { class: 'hm-tool-desc' }, a.desc || ''), h('span', { class: 'hm-tool-stat' }, stat[a.id] ? stat[a.id]() : ''));
              if (!(Kit.demo && Kit.demo.has(a.id))) return card;
              return h('div', { class: 'hm-tool-wrap' }, card,
                h('button', { type: 'button', class: 'demo-btn', onclick: () => Kit.demo.start(a.id), 'aria-label': a.title + 'の使い方を見る' }, Kit.icon('play', 12), h('span', null, '使い方を見る')));
            }))));
        }
        tools.append(h('div', { class: 'hm-group' }, h('div', { class: 'hm-group-label' }, 'すでにある道具（別のページで開きます）'),
          h('div', { class: 'hm-tools' }, OTHER_TOOLS.map((t) => h('a', { class: 'hm-tool', href: t.url, target: '_blank', rel: 'noopener' },
            h('span', { class: 'hm-tool-ic' }, Kit.icon(t.icon)), h('span', { class: 'hm-tool-title' }, t.title, Kit.icon('external')), h('span', { class: 'hm-tool-desc' }, t.desc))))));
        root.append(tools);

        /* ── 1年の流れ ── */
        const FLOW = [['名簿を入れる', '名簿', 'roster'], ['席を決める', '席替え', 'seats'], ['係を決める', '係決め', 'roles'], ['班と当番を決める', '当番表', 'duty'], ['時間割をつくる', '時間割', 'timetable'], ['行事を入れる', 'カレンダー', 'calendar'], ['宿題を見守る', '宿題・提出', 'homework'], ['通信を出す', '学級通信', 'newsletter']].filter((x) => Kit.appDef(x[2]));
        root.append(h('section', { style: { marginTop: '24px' }, 'aria-label': '使う順番の例' },
          h('h2', { class: 'section-title' }, '学級びらきの順番の例'),
          h('p', { class: 'small ink-2', style: { marginBottom: '10px' } }, '名簿を1回入れると、席替え・係決め・当番表・宿題チェックがそのまま使えます。行事の予定と宿題の締切は、カレンダーとホームに集まり、学級通信の予定表にも入れられます。'),
          h('div', { class: 'hm-flow' }, FLOW.map(([name, tool, id], i) => h('button', { type: 'button', class: 'hm-flow-step', onclick: () => Kit.go(id) },
            h('span', { class: 'hm-flow-no' }, String(i + 1)), h('span', { class: 'hm-flow-name' }, name), h('span', { class: 'hm-flow-tool' }, tool))))));

        /* ── データの扱い・共有・バックアップ ── */
        const where = Kit.store.mode === 'db' ? 'あなたのアカウントに保存しています。ほかの端末で開いても同じ内容です。'
          : Kit.env.artifact ? '共有されたページとして開いているため、このブラウザだけに保存しています。'
            : Kit.store.mode === 'memory' ? 'この環境では保存できません。閉じる前にバックアップを書き出してください。'
              : 'このブラウザの中だけに保存しています（サーバーには送りません）。ブラウザのデータを消すと消えるので、ときどきバックアップを書き出してください。';
        root.append(h('section', { class: 'card hm-data', style: { marginTop: '24px' }, 'aria-label': 'データの扱い' },
          h('h2', { class: 'hm-h2' }, Kit.icon('lock', 18), 'データの扱い'),
          h('ul', null,
            h('li', null, where),
            h('li', null, '名簿は出席番号だけでも使えます。教室で画面を映すときは、クラスの帯の「名前を隠す」を使ってください。'),
            h('li', null, '共有（予定・リマインダー・時間割）には、生徒の名前は入りません。'),
            h('li', null, '学校の共用パソコンで使ったときは、バックアップを書き出してから「すべて消して最初から」を押してください。'))));
        root.append(h('section', { class: 'card', style: { marginTop: '16px' }, 'aria-label': '共有を受け取る' },
          h('h2', { class: 'hm-h2' }, Kit.icon('share', 18), '共有を受け取る'),
          h('p', { class: 'small ink-2', style: { marginTop: '6px' } }, 'ほかの先生から「共有用のファイル（.json）」をもらったら、ここから開きます。共有リンクをもらったときは、リンクを開くだけで取り込みの画面が出ます。'),
          h('div', { class: 'btn-row', style: { marginTop: '10px' } }, Kit.btn('共有ファイルを開く', () => School.share.fromFile(), { icon: 'upload' }))));
        root.append(h('section', { class: 'card', id: 'hm-backup', style: { marginTop: '16px' }, 'aria-label': '保存とバックアップ' },
          h('h2', { class: 'hm-h2' }, Kit.icon('save', 18), '保存とバックアップ'),
          h('p', { class: 'small muted', style: { marginTop: '6px' } }, 'バックアップ（JSON）には、すべての道具の内容が入ります。名簿もふくまれるので、置き場所に気をつけてください。'),
          h('div', { class: 'btn-row', style: { marginTop: '10px' } },
            Kit.btn('バックアップを書き出す', backup, { icon: 'download' }),
            Kit.btn('バックアップから戻す', restore, { icon: 'upload' }),
            Kit.btn('すべて消して最初から', wipe, { icon: 'trash', kind: 'danger' }))));
      }

      async function startOwn() {
        if (Kit.store.demo) { Kit.toast('デモの中ではできません。上の帯の「デモを終わる」で戻ってから使ってください'); return; }
        const p = await Kit.profile.edit();
        if (!p) return;
        const yes = await Kit.confirm({ title: 'サンプルも片付けますか', body: '架空のクラス・学校の例（名簿・席・係・時間割・予定など）を消して、空の状態から始めます。自分で入力したものは残ります。', ok: '片付ける', cancel: 'あとで' });
        if (yes) { await Kit.store.samplesOff(); Kit.toast('サンプルを片付けました。まず名簿を入れましょう'); Kit.go('roster'); return; }
        render();
      }
      async function clearSamples() {
        if (Kit.store.demo) { Kit.toast('デモの中ではできません。上の帯の「デモを終わる」で戻ってから使ってください'); return; }
        const yes = await Kit.confirm({ title: 'サンプルを片付けますか', body: 'すべての道具から、架空のクラス・学校の例を消します。自分で入力・編集したものは残ります。', ok: '片付ける' });
        if (!yes) return;
        await Kit.store.samplesOff();
        Kit.toast('サンプルを片付けました');
        render();
      }
      async function backup() {
        if (Kit.store.demo) { Kit.toast('デモの中ではできません。上の帯の「デモを終わる」で戻ってから使ってください'); return; }
        await Kit.store.flush();
        const data = await Kit.store.exportAll();
        const ok = await Kit.download('sensei-kit-backup-' + Kit.ymd() + '.json', JSON.stringify(data, null, 1));
        if (ok) Kit.toast('バックアップを書き出しました');
      }
      async function restore() {
        if (Kit.store.demo) { Kit.toast('デモの中ではできません。上の帯の「デモを終わる」で戻ってから使ってください'); return; }
        const f = await Kit.img.pick('application/json,.json');
        if (!f) return;
        let data;
        try { data = JSON.parse(await f.text()); } catch (e) { Kit.toast('ファイルを読めませんでした。先生の道具箱のバックアップ（.json）を選んでください', { type: 'bad' }); return; }
        if (!data || data.app !== 'sensei-kit') { Kit.toast(data && data.kind ? 'これは共有ファイルです。「共有ファイルを開く」から開いてください' : '先生の道具箱のバックアップではありません', { type: 'bad' }); return; }
        const n = Object.values(data.colls || {}).reduce((s, a) => s + (a ? a.length : 0), 0);
        const yes = await Kit.confirm({ title: 'バックアップから戻しますか', body: Kit.fmtDate(String(data.exportedAt || '').slice(0, 10), 'YYYY年M月D日') + 'のバックアップ（' + n + '件のデータ）で、いまの内容を置きかえます。', ok: '戻す', danger: true });
        if (!yes) return;
        try { await Kit.store.importAll(data); Kit.toast('バックアップから戻しました'); render(); }
        catch (e) { Kit.toast('戻せませんでした：' + ((e && e.message) || e), { type: 'bad' }); }
      }
      async function wipe() {
        if (Kit.store.demo) { Kit.toast('デモの中ではできません。上の帯の「デモを終わる」で戻ってから使ってください'); return; }
        const yes = await Kit.confirm({ title: 'すべて消しますか', body: 'すべての道具の内容（名簿・席・係・当番・時間割・予定・リマインダー・宿題・通信・わたしのひな形）を消して、最初の状態（サンプル表示）に戻します。元に戻せないので、先にバックアップを書き出しておくと安心です。', ok: 'すべて消す', danger: true });
        if (!yes) return;
        await Kit.store.wipeAll();
        Kit.pref.set('class', null);
        Kit.toast('すべて消しました');
        render();
      }

      await render();
      return () => { alive = false; off(); offC(); rerender.cancel(); };
    },
  });
})();

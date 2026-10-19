// カレンダー：行事・テスト・会議・締切をひとつに。リマインダー・宿題の締切も重ねて見る
// （みせびらき のカレンダーを学校向けに直したもの。予約枠の機能は外し、年間行事のまとめて追加・共有を足した）
(function () {
  'use strict';
  const { h } = Kit;

  /* ───────── 種類・祝日・時刻の小物 ───────── */
  const CATS = [
    { id: 'gyoji', label: '行事' },
    { id: 'test', label: 'テスト' },
    { id: 'class', label: '授業・学級' },
    { id: 'meeting', label: '会議・研修' },
    { id: 'parent', label: '面談・保護者' },
    { id: 'deadline', label: '締切・提出' },
    { id: 'club', label: '部活' },
    { id: 'private', label: '個人' },
  ];
  const CAT = Object.fromEntries(CATS.map((c) => [c.id, c]));
  const catOf = (c) => (CAT[c] ? c : 'class');

  // 祝日は School.holiday（法律の決まりから計算。2000〜2099年）
  const holiday = (s) => School.holiday(s);

  const DAY_START = 7, DAY_END = 22; // 週の表示は 7時〜22時
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => Kit.ymd(d);
  const add = (d, n) => Kit.ymd(Kit.addDays(d, n));
  const todayS = () => Kit.ymd(Kit.today());
  const isYmd = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
  const toMin = (t) => { const m = /^(\d{1,2}):(\d{2})/.exec(t || ''); return m ? +m[1] * 60 + +m[2] : null; };
  const hm = (n) => pad(Math.floor(n / 60)) + ':' + pad(n % 60);
  const md = (s) => Kit.fmtDate(s, 'M/D(W)');
  const d8 = (s) => String(s).replace(/-/g, '');

  // 終わりの日時（終わりがなければ1時間後。日をまたげば翌日）
  function endOf(it) {
    const s = toMin(it.start), e = toMin(it.end);
    const t = e != null && e > s ? e : s + 60;
    return { date: t >= 1440 ? add(it.date, 1) : it.date, time: hm(t % 1440) };
  }

  /* ───────── くり返しの予定を、表示する範囲の回に広げる ───────── */
  // from〜to（両端ふくむ）。各回の日付は occ。毎月は「同じ日」、その日がない月（31日など）はとばす
  function occurrences(events, from, to) {
    const out = [];
    for (const ev of events || []) {
      if (!ev || !isYmd(ev.date)) continue;
      const rep = ev.repeat === 'weekly' || ev.repeat === 'monthly' ? ev.repeat : 'none';
      if (rep === 'none') { if (ev.date >= from && ev.date <= to) out.push(Object.assign({}, ev, { occ: ev.date })); continue; }
      const last = isYmd(ev.repeatUntil) && ev.repeatUntil < to ? ev.repeatUntil : to;
      if (ev.date > last) continue;
      if (rep === 'weekly') {
        for (let k = ev.date < from ? Math.floor(Kit.daysBetween(ev.date, from) / 7) : 0; ; k++) {
          const s = add(ev.date, k * 7);
          if (s > last) break;
          if (s >= from) out.push(Object.assign({}, ev, { occ: s }));
        }
      } else {
        const b = Kit.parseYmd(ev.date), day = b.getDate(), f = Kit.parseYmd(from);
        let k = Math.max(0, (f.getFullYear() - b.getFullYear()) * 12 + f.getMonth() - b.getMonth() - 1);
        for (let guard = 0; guard < 400; k++, guard++) {
          const d = new Date(b.getFullYear(), b.getMonth() + k, day);
          if (d.getDate() !== day) continue;
          const s = ymd(d);
          if (s > last) break;
          if (s >= from) out.push(Object.assign({}, ev, { occ: s }));
        }
      }
    }
    return out;
  }

  /* ───────── すばやく追加：「10/20 15:40 学年会」を読み取る ───────── */
  const WD = { 日: 0, 月: 1, 火: 2, 水: 3, 木: 4, 金: 5, 土: 6 };
  const CAT_WORDS = [
    ['test', /テスト|試験|考査|模試|検定|実力/],
    ['meeting', /会議|研修|学年会|委員会|打ち?合わ?せ|打合せ|研究授業|校内研|職員|ミーティング|MTG/i],
    ['parent', /面談|家庭訪問|保護者|三者|二者|PTA|懇談|参観/],
    ['deadline', /締め?切|〆切|期限|提出|〆|入力|通知表|指導要録|報告書|回収/],
    ['gyoji', /入学式|卒業式|始業式|終業式|修了式|式典|開校記念|体育祭|運動会|文化祭|学習発表会|合唱|修学旅行|遠足|校外学習|避難訓練|健康診断|身体測定|集会|宿泊|球技大会|行事|夏休み|冬休み|春休み|休業/],
    ['club', /部活|練習試合|大会|試合|遠征|総体|新人戦/],
    ['private', /通院|病院|歯医者|私用|家族|子ども|子供|保育園|幼稚園|お迎え|誕生日|帰省|旅行|美容院|年休/],
  ];
  const guessCat = (t) => { for (const [c, re] of CAT_WORDS) if (re.test(t)) return c; return 'class'; };

  function parseQuick(input, today) {
    const base = Kit.parseYmd(today ? Kit.ymd(today) : todayS());
    let s = ' ' + String(input || '').normalize('NFKC').replace(/[〜～]/g, '~').replace(/\s+/g, ' ').trim() + ' ';
    let date = null, start = '', end = '', bad = false;
    const take = (re) => { const m = re.exec(s); if (m) s = s.slice(0, m.index) + ' ' + s.slice(m.index + m[0].length); return m; };
    const P = '(?:の|に|は|、|,)?';
    const WDP = '(?:\\s*\\([月火水木金土日](?:曜日?)?\\)|\\s*[月火水木金土日]曜日?)?';
    const ymdOf = (y, mo, d) => { const x = new Date(y, mo - 1, d); return x.getMonth() === mo - 1 && x.getDate() === d ? x : null; };
    // 年がない日付は「近いほう」。1か月以上前なら来年
    const near = (mo, d) => { let x = ymdOf(base.getFullYear(), mo, d); if (x && Kit.daysBetween(base, x) < -31) x = ymdOf(base.getFullYear() + 1, mo, d); return x; };
    let m;
    if ((m = take(new RegExp('(\\d{4})[/.\\-年](\\d{1,2})[/.\\-月](\\d{1,2})日?' + WDP + P)))) { date = ymdOf(+m[1], +m[2], +m[3]); bad = !date; }
    else if ((m = take(new RegExp('(\\d{1,2})/(\\d{1,2})(?![\\d/])' + WDP + P))) || (m = take(new RegExp('(\\d{1,2})月(\\d{1,2})日' + WDP + P)))) { date = near(+m[1], +m[2]); bad = !date; }
    else if ((m = take(new RegExp('(?:今日|本日|きょう(?=[のには]|[^ぁ-ゖ]))' + P)))) date = base;
    else if ((m = take(new RegExp('(?:明後日|あさって)' + P)))) date = Kit.addDays(base, 2);
    else if ((m = take(new RegExp('(?:明日|あした(?=[のには]|[^ぁ-ゖ])|あす(?=[のには]|[^ぁ-ゖ]))' + P)))) date = Kit.addDays(base, 1);
    else if ((m = take(new RegExp('(\\d{1,3})日後' + P)))) date = Kit.addDays(base, +m[1]);
    else if ((m = take(new RegExp('(再来週|来週|今週)の?\\s*([月火水木金土日])曜日?' + P)))) {
      // 週は月曜はじまりで数える（「来週の日曜」は次の次の日曜）
      const mon = Kit.addDays(base, -((base.getDay() + 6) % 7));
      date = Kit.addDays(mon, ({ 今週: 0, 来週: 7, 再来週: 14 })[m[1]] + (WD[m[2]] + 6) % 7);
    } else if ((m = take(new RegExp('(?:次の|今度の)?([月火水木金土日])曜日?' + P)))) {
      date = Kit.addDays(base, (WD[m[1]] - base.getDay() + 7) % 7);
    }
    // 時刻：午後3時 / 19時半 / 19:30 / 14時〜16時 / 14〜16時
    const Q = '(午前|午後|朝|昼|夕方|夜)?\\s*';
    const T = '(\\d{1,2})(?::(\\d{2})|時(?:(半)|(\\d{1,2})分)?)';
    const time = (q, hh, mm, half, mk) => {
      let H = +hh;
      const M = mm != null ? +mm : half ? 30 : mk != null ? +mk : 0;
      if (q === '午後' || q === '夕方' || q === '夜' || q === '昼') { if (H < 12) H += 12; }
      else if (q === '午前' || q === '朝') { if (H === 12) H = 0; }
      else if (String(hh).length === 1 && H >= 1 && H <= 5) H += 12; // 「3時」はたいてい午後
      return H <= 23 && M <= 59 ? pad(H) + ':' + pad(M) : '';
    };
    if ((m = take(new RegExp(Q + T + '\\s*(?:~|-|ー|−|–|から)\\s*' + Q + T + '(?:まで)?' + P)))) {
      start = time(m[1], m[2], m[3], m[4], m[5]);
      end = time(m[6] || m[1], m[7], m[8], m[9], m[10]);
    } else if ((m = take(new RegExp(Q + '(\\d{1,2})\\s*(?:~|-|から)\\s*' + T + '(?:まで)?' + P)))) {
      start = time(m[1], m[2]);
      end = time(m[1], m[3], m[4], m[5], m[6]);
    } else if ((m = take(new RegExp(Q + T + '(?:から|~)?' + P)))) {
      start = time(m[1], m[2], m[3], m[4], m[5]);
    }
    if (start && (!end || toMin(end) <= toMin(start))) end = hm(Math.min(toMin(start) + 60, 1439));
    if (!start) end = '';
    const title = s.replace(/\s+/g, ' ').trim()
      .replace(/^(?:の|に|は|から|より|、|,)\s+/, '').replace(/\s+(?:に|から|まで|より|、|,)$/, '').trim();
    return { title, date: ymd(date || base), dateGiven: !!date, bad, allDay: !start, start, end, cat: guessCat(title) };
  }

  /* ───────── 書き出し（Googleカレンダー用CSV・ICS・追加リンク） ───────── */
  function googleCsv(items) {
    const us = (s) => { const d = Kit.parseYmd(s); return pad(d.getMonth() + 1) + '/' + pad(d.getDate()) + '/' + d.getFullYear(); };
    const t12 = (t) => { const n = toMin(t), H = Math.floor(n / 60); return pad(H % 12 || 12) + ':' + pad(n % 60) + ' ' + (H < 12 ? 'AM' : 'PM'); };
    const rows = [['Subject', 'Start Date', 'Start Time', 'End Date', 'End Time', 'All Day Event', 'Description', 'Location']];
    for (const it of items) {
      if (it.allDay || toMin(it.start) == null) rows.push([it.title, us(it.date), '', us(it.date), '', 'True', it.memo || '', it.place || '']);
      else { const e = endOf(it); rows.push([it.title, us(it.date), t12(it.start), us(e.date), t12(e.time), 'False', it.memo || '', it.place || '']); }
    }
    return Kit.csv(rows).replace(/^\ufeff/, ''); // Google の取り込み用なので BOM なし
  }

  const icsEsc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  // 75バイトごとに折り返す（UTF-8 の文字の途中では切らない）
  function icsFold(line) {
    const enc = new TextEncoder();
    if (enc.encode(line).length <= 75) return line;
    let out = '', cur = '', bytes = 0, limit = 75;
    for (const ch of line) {
      const b = enc.encode(ch).length;
      if (bytes + b > limit) { out += cur + '\r\n '; cur = ''; bytes = 0; limit = 74; }
      cur += ch; bytes += b;
    }
    return out + cur;
  }
  function toIcs(items, name) {
    const n = new Date();
    const stamp = n.getUTCFullYear() + pad(n.getUTCMonth() + 1) + pad(n.getUTCDate()) + 'T' + pad(n.getUTCHours()) + pad(n.getUTCMinutes()) + pad(n.getUTCSeconds()) + 'Z';
    const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//sensei-kit//calendar//JA', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:' + icsEsc(name || '先生の道具箱')];
    for (const it of items) {
      const allDay = it.allDay || toMin(it.start) == null;
      L.push('BEGIN:VEVENT', 'UID:' + String(it.uid || it.id || Kit.uid('ev')).replace(/[^\w.-]/g, '-') + '@sensei-kit', 'DTSTAMP:' + stamp);
      if (allDay) L.push('DTSTART;VALUE=DATE:' + d8(it.date), 'DTEND;VALUE=DATE:' + d8(add(it.date, 1)));
      else { const e = endOf(it); L.push('DTSTART:' + d8(it.date) + 'T' + it.start.replace(':', '') + '00', 'DTEND:' + d8(e.date) + 'T' + e.time.replace(':', '') + '00'); }
      L.push('SUMMARY:' + icsEsc(it.title));
      if (it.place) L.push('LOCATION:' + icsEsc(it.place));
      if (it.memo) L.push('DESCRIPTION:' + icsEsc(it.memo));
      if (CAT[it.cat]) L.push('CATEGORIES:' + icsEsc(CAT[it.cat].label));
      if (it.repeat === 'weekly' || it.repeat === 'monthly' || it.repeat === 'daily') {
        L.push('RRULE:FREQ=' + it.repeat.toUpperCase() + (isYmd(it.repeatUntil) ? ';UNTIL=' + d8(it.repeatUntil) + (allDay ? '' : 'T235959') : ''));
      } else if (it.repeat === 'weekdays') {
        L.push('RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR' + (isYmd(it.repeatUntil) ? ';UNTIL=' + d8(it.repeatUntil) + (allDay ? '' : 'T235959') : ''));
      }
      // 知らせ（リマインダー）：alarm は ICS の TRIGGER の値（例：-PT10M、PT8H）
      if (it.alarm) L.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEsc(it.title), 'TRIGGER' + (allDay ? ';RELATED=START' : '') + ':' + it.alarm, 'END:VALARM');
      L.push('END:VEVENT');
    }
    L.push('END:VCALENDAR');
    return L.map(icsFold).join('\r\n') + '\r\n';
  }

  function googleLink(it) {
    let dates;
    if (it.allDay || toMin(it.start) == null) dates = d8(it.date) + '/' + d8(add(it.date, 1));
    else { const e = endOf(it); dates = d8(it.date) + 'T' + it.start.replace(':', '') + '00/' + d8(e.date) + 'T' + e.time.replace(':', '') + '00'; }
    const q = new URLSearchParams({ action: 'TEMPLATE', text: it.title || '', dates });
    if (it.memo) q.set('details', it.memo);
    if (it.place) q.set('location', it.place);
    return 'https://calendar.google.com/calendar/render?' + q.toString();
  }

  /* ───────── 読み込み（.ics） ───────── */
  const icsText = (v) => String(v || '').replace(/\\([\\;,nN])/g, (_, c) => (c === 'n' || c === 'N' ? '\n' : c));
  function icsTime(p) {
    if (!p) return null;
    const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(String(p.value || '').trim());
    if (!m || +m[2] < 1 || +m[2] > 12 || +m[3] < 1 || +m[3] > 31) return null;
    if (!m[4] || String((p.params || {}).VALUE || '').toUpperCase() === 'DATE') return { date: m[1] + '-' + m[2] + '-' + m[3], time: '', allDay: true };
    // 末尾 Z は世界時 → この端末の時刻に。TZID は見ずに、その時刻のまま
    if (m[7]) { const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0))); return { date: ymd(d), time: pad(d.getHours()) + ':' + pad(d.getMinutes()), allDay: false }; }
    return { date: m[1] + '-' + m[2] + '-' + m[3], time: m[4] + ':' + m[5], allDay: false };
  }
  function icsDuration(st, v) {
    const m = /^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(String(v || '').trim());
    if (!m) return null;
    const days = (+m[1] || 0) * 7 + (+m[2] || 0), mins = (+m[3] || 0) * 60 + (+m[4] || 0);
    if (st.allDay) return { date: add(st.date, days || 1), time: '', allDay: true };
    const t = toMin(st.time) + mins + days * 1440;
    return { date: add(st.date, Math.floor(t / 1440)), time: hm(t % 1440), allDay: false };
  }
  function icsRule(v, ev) {
    const r = {};
    for (const kv of String(v || '').split(';')) { const i = kv.indexOf('='); if (i > 0) r[kv.slice(0, i).toUpperCase()] = kv.slice(i + 1).toUpperCase(); }
    const freq = r.FREQ === 'WEEKLY' ? 'weekly' : r.FREQ === 'MONTHLY' ? 'monthly' : null;
    if (!freq || (r.INTERVAL && r.INTERVAL !== '1') || r.BYMONTH || r.BYSETPOS || r.BYWEEKNO || r.BYYEARDAY) return null;
    const d = Kit.parseYmd(ev.date);
    if (r.BYDAY && (freq !== 'weekly' || r.BYDAY !== ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][d.getDay()])) return null;
    if (r.BYMONTHDAY && (freq !== 'monthly' || +r.BYMONTHDAY !== d.getDate())) return null;
    let until = '';
    if (r.UNTIL) { const t = icsTime({ value: r.UNTIL, params: {} }); until = t ? t.date : ''; }
    else if (r.COUNT) {
      const n = Math.max(1, +r.COUNT || 1);
      const occ = occurrences([Object.assign({}, ev, { repeat: freq, repeatUntil: '' })], ev.date, add(ev.date, freq === 'weekly' ? 7 * n : 40 * n));
      until = (occ[n - 1] || occ[occ.length - 1] || { occ: '' }).occ;
    }
    return { repeat: freq, until };
  }
  function parseIcs(text) {
    const lines = String(text || '').replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n');
    const out = [];
    let cur = null, depth = 0;
    for (const line of lines) {
      if (!line.trim()) continue;
      const up = line.trim().toUpperCase();
      if (up === 'BEGIN:VEVENT') { cur = {}; depth = 0; continue; }
      if (!cur) continue;
      if (up === 'END:VEVENT') { const ev = icsEvent(cur); if (ev) out.push(ev); cur = null; continue; }
      if (up.startsWith('BEGIN:')) { depth++; continue; } // VALARM などの中身は読まない
      if (up.startsWith('END:')) { depth = Math.max(0, depth - 1); continue; }
      if (depth) continue;
      let q = false, i = 0;
      for (; i < line.length; i++) { const c = line[i]; if (c === '"') q = !q; else if (c === ':' && !q) break; }
      if (i >= line.length) continue;
      const parts = line.slice(0, i).split(';');
      const name = parts[0].toUpperCase(), params = {};
      for (const p of parts.slice(1)) { const k = p.indexOf('='); if (k > 0) params[p.slice(0, k).toUpperCase()] = p.slice(k + 1).replace(/^"|"$/g, ''); }
      if (!(name in cur)) cur[name] = { value: line.slice(i + 1), params };
    }
    return out;
  }
  function icsEvent(c) {
    const st = icsTime(c.DTSTART);
    if (!st) return null;
    const en = c.DTEND ? icsTime(c.DTEND) : c.DURATION ? icsDuration(st, c.DURATION.value) : null;
    const title = icsText(c.SUMMARY && c.SUMMARY.value).replace(/\s+/g, ' ').trim() || '（名前なし）';
    const ev = { title, date: st.date, allDay: st.allDay, start: st.allDay ? '' : st.time, end: '', cat: guessCat(title), place: icsText(c.LOCATION && c.LOCATION.value).trim(), memo: icsText(c.DESCRIPTION && c.DESCRIPTION.value).trim(), repeat: 'none', repeatUntil: '' };
    const notes = [];
    if (en) {
      if (st.allDay) { const last = add(en.date, -1); if (last > st.date) notes.push('複数日（〜' + md(last) + '）は初日だけ'); }
      else if (en.date === st.date) { if (en.time > st.time) ev.end = en.time; }
      else if (en.date > st.date) notes.push('日をまたぐので終わりの時刻なし');
    }
    if (c.RRULE) { const r = icsRule(c.RRULE.value, ev); if (r) { ev.repeat = r.repeat; ev.repeatUntil = r.until; } else notes.push('くり返しの形が複雑なので1回分だけ'); }
    ev.notes = notes;
    return ev;
  }

  /* ───────── サンプル（架空の学校）。日付は今日からの相対 ───────── */
  const ev = (n, title, date, start, end, cat, more) => Object.assign({ id: 's-ev-' + n, title, date, allDay: !start, start: start || '', end: end || '', cat, place: '', memo: '', repeat: 'none', repeatUntil: '' }, more || {});
  const r = Kit.rel;
  const SAMPLE_EVENTS = [
    ev(1, '職員会議', r(1), '15:40', '17:00', 'meeting', { place: '会議室', memo: '行事の確認・生徒指導の情報交換' }),
    ev(2, '学年会', r(-6), '15:40', '16:30', 'meeting', { place: '学年室', repeat: 'weekly' }),
    ev(3, '中間テスト（1日目）', r(9), '', '', 'test', { memo: '国語・数学・理科' }),
    ev(4, '中間テスト（2日目）', r(10), '', '', 'test', { memo: '社会・英語' }),
    ev(5, 'テスト問題の提出（数学）', r(4), '', '', 'deadline', { memo: '教務の先生へ（印刷の都合）' }),
    ev(6, '三者面談', r(16), '13:30', '17:00', 'parent', { place: '2年3組', memo: '日程は面談スケジューラで組む' }),
    ev(7, '避難訓練', r(3), '10:50', '11:40', 'gyoji', { memo: '3時間目。避難経路を前日に確かめる' }),
    ev(8, '研究授業（数学）', r(7), '13:30', '14:20', 'class', { place: '2年3組', memo: '指導案を3日前までに配る' }),
    ev(9, '部活 練習試合', r(5), '09:00', '12:00', 'club', { place: '市民体育館' }),
    ev(10, '子どもの参観日', r(12), '13:30', '15:00', 'private', { place: '保育園', memo: '年休を出しておく' }),
    ev(11, '成績入力の締切', r(20), '', '', 'deadline', { memo: '中間テストの分' }),
  ];
  const CFG_BLANK = { weekStart: 0 };
  Kit.store.sample('events', SAMPLE_EVENTS);
  function normCfg(c) {
    const o = Object.assign(Kit.clone(CFG_BLANK), c || {});
    o.weekStart = +o.weekStart === 1 ? 1 : 0;
    return o;
  }

  /* ───────── 見た目 ───────── */
  Kit.css('calendar', `
.cal-c-gyoji{--c:var(--series-4)}.cal-c-test{--c:var(--series-2)}.cal-c-class{--c:var(--series-1)}.cal-c-meeting{--c:var(--series-3)}
.cal-c-parent{--c:var(--series-5)}.cal-c-deadline{--c:var(--series-8)}.cal-c-club{--c:var(--series-6)}.cal-c-private{--c:var(--series-7)}
.cal-quick{display:grid;gap:6px;margin-bottom:4px}
.cal-quick>label{font-weight:700}
.cal-quick-row{display:flex;gap:8px;min-width:0}
.cal-quick-row input{flex:1 1 auto}
.cal-quick-pre{display:flex;flex-wrap:wrap;align-items:center;gap:4px 10px;font-size:13px;color:var(--ink-2);min-height:30px}
.cal-qp{display:inline-flex;flex-wrap:wrap;align-items:center;gap:4px 8px;min-width:0}
.cal-qp b{color:var(--ink);font-variant-numeric:tabular-nums}
.cal-qp-title{font-weight:700;color:var(--ink);overflow-wrap:anywhere}
.chip.cal-cat{background:color-mix(in srgb,var(--c) 15%,var(--surface));color:var(--ink-2)}
.chip.cal-cat .dot{background:var(--c)}
.cal-bar{gap:8px 12px}
.cal-nav{display:flex;align-items:center;gap:4px}
.cal-title{font-family:var(--font-display);font-weight:800;font-size:21px;letter-spacing:.04em;white-space:nowrap;margin-right:auto}
.cal-filters{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:2px 0 12px}
.cal-filters .chip{min-height:32px;padding:2px 12px;border-color:var(--line);background:var(--surface);color:var(--ink-2)}
.cal-filters .chip .dot{background:var(--c)}
.cal-filters .chip[aria-pressed="true"]{background:color-mix(in srgb,var(--c) 14%,var(--surface));border-color:color-mix(in srgb,var(--c) 50%,var(--line));color:var(--ink)}
.cal-filters .chip[aria-pressed="false"]{color:var(--ink-3)}
.cal-filters .chip[aria-pressed="false"] .dot{background:transparent;box-shadow:inset 0 0 0 1.5px var(--c)}
.cal-others{margin-left:6px;white-space:nowrap;min-height:32px}
.cal-hint{font-size:13px;color:var(--ink-2);margin:-4px 0 10px}
/* 月 */
.cal-month{border:1px solid var(--line);border-radius:var(--r);background:var(--surface);overflow:hidden}
.cal-dow,.cal-week{display:grid;grid-template-columns:repeat(7,minmax(0,1fr))}
.cal-dow{background:var(--surface-2);border-bottom:1px solid var(--line)}
.cal-dow>span{text-align:center;font-size:12px;font-weight:700;color:var(--ink-3);padding:5px 0}
.cal-dow .is-sun{color:var(--shu)}.cal-dow .is-sat{color:var(--gosu)}
.cal-week+.cal-week{border-top:1px solid var(--line)}
.cal-day{position:relative;min-width:0;min-height:112px;padding:4px 4px 6px;display:flex;flex-direction:column;gap:2px;background:var(--surface);cursor:pointer}
.cal-day+.cal-day{border-left:1px solid var(--line)}
.cal-day.is-out{background:var(--surface-2)}
.cal-dhead{display:flex;align-items:center;gap:4px;min-width:0}
.cal-dnum{flex:none;min-width:26px;height:26px;padding:0 5px;border-radius:99px;border:0;background:transparent;font:inherit;font-size:13px;font-weight:700;color:var(--ink);font-variant-numeric:tabular-nums;cursor:pointer;display:inline-grid;place-items:center;line-height:1}
button.cal-dnum:hover{background:var(--surface-3)}
.cal-day.is-sun .cal-dnum,.cal-day.is-hol .cal-dnum{color:var(--shu)}
.cal-day.is-sat .cal-dnum{color:var(--gosu)}
.cal-day.is-out .cal-dnum{opacity:.55}
.cal-day.is-today .cal-dnum{background:var(--gosu);color:var(--on-gosu);opacity:1}
.cal-hol{font-size:11px;color:var(--shu);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.cal-ev{display:flex;align-items:center;gap:4px;width:100%;min-width:0;min-height:21px;padding:1px 5px;border:1px solid transparent;border-left:3px solid var(--c);border-radius:4px;background:color-mix(in srgb,var(--c) 14%,var(--surface));color:var(--ink);font:inherit;font-size:12px;line-height:1.35;text-align:left;cursor:pointer}
.cal-ev:hover{background:color-mix(in srgb,var(--c) 26%,var(--surface))}
.cal-ev .t{flex:none;color:var(--ink-2);font-variant-numeric:tabular-nums}
.cal-ev .n{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cal-ev svg{flex:none;width:13px;height:13px;color:var(--c)}
.cal-ev.is-ext,.cal-wev.is-ext{background:var(--surface);border:1.5px dashed var(--c)}
.cal-s{flex:none;margin-left:auto;font-size:10px;font-weight:700;line-height:1;padding:2px 3px;border-radius:3px;background:var(--shu-wash);color:var(--shu)}
.cal-more{align-self:flex-start;border:0;background:transparent;font:inherit;font-size:11.5px;color:var(--ink-2);padding:1px 5px;border-radius:4px;cursor:pointer}
.cal-more:hover{background:var(--surface-3);color:var(--ink)}
.cal-dayc{min-height:60px;padding:4px 1px 5px;border:0;border-radius:0;font:inherit;color:inherit;align-items:center;gap:2px;text-align:center}
.cal-dayc .cal-hol{font-size:9.5px;max-width:100%;line-height:1.2}
.cal-dots{display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:3px;max-width:100%;padding:0 2px}
.cal-dots i{width:6px;height:6px;border-radius:50%;background:var(--c)}
.cal-dots i.is-ext{background:transparent;box-shadow:inset 0 0 0 1.5px var(--c)}
.cal-dots b{font-size:10px;line-height:1;color:var(--ink-3)}
.cal-dayc.is-sel{background:var(--gosu-wash);box-shadow:inset 0 0 0 2px var(--gosu)}
.cal-daypanel{margin-top:12px;border:1px solid var(--line);border-radius:var(--r);background:var(--surface);padding:12px}
.cal-dp-h{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;margin-bottom:10px}
.cal-dp-h h3{font-size:16px}
.cal-dp-h .cal-hol{font-size:12.5px}
/* 週 */
.cal-wk{border:1px solid var(--line);border-radius:var(--r);background:var(--surface);overflow:hidden}
.cal-wk-row{display:grid;grid-template-columns:46px repeat(var(--n),minmax(0,1fr))}
.cal-wk-head{background:var(--surface-2);border-bottom:1px solid var(--line)}
.cal-wk-dh{display:grid;justify-items:center;align-content:start;gap:1px;min-width:0;padding:6px 2px 5px;border:0;border-left:1px solid var(--line);background:transparent;font:inherit;color:var(--ink);cursor:pointer}
.cal-wk-dh:hover{background:var(--surface-3)}
.cal-wk-dh .w{font-size:11.5px;color:var(--ink-3);line-height:1.3}
.cal-wk-dh .d{font-size:16px;font-weight:700;line-height:1.55;min-width:30px;padding:0 6px;border-radius:99px;font-variant-numeric:tabular-nums}
.cal-wk-dh.is-sun .w,.cal-wk-dh.is-sun .d,.cal-wk-dh.is-hol .w,.cal-wk-dh.is-hol .d{color:var(--shu)}
.cal-wk-dh.is-sat .w,.cal-wk-dh.is-sat .d{color:var(--gosu)}
.cal-wk-dh.is-today .d{background:var(--gosu);color:var(--on-gosu)}
.cal-wk-dh .cal-hol{max-width:100%;font-size:10.5px}
.cal-wk-all{border-bottom:1px solid var(--line-strong)}
.cal-wk-gut{font-size:11px;color:var(--ink-3);text-align:right;padding:6px 6px 0 0;font-variant-numeric:tabular-nums}
.cal-wk-ac{display:grid;align-content:start;gap:2px;min-width:0;min-height:32px;padding:3px;border-left:1px solid var(--line)}
.cal-wk-body{position:relative}
.cal-wk-hours{position:relative;padding:0}
.cal-wk-hl{position:absolute;right:6px;line-height:1;padding-top:3px}
.cal-wk-col{position:relative;min-width:0;border-left:1px solid var(--line);cursor:pointer}
.cal-wk-col.is-today{background:color-mix(in srgb,var(--gosu-wash) 40%,var(--surface))}
.cal-wk-line{position:absolute;left:0;right:0;height:0;border-top:1px solid var(--chart-grid);pointer-events:none}
.cal-wev{position:absolute;z-index:1;display:flex;flex-direction:column;align-items:stretch;min-width:0;padding:2px 5px;margin-left:2px;border:1px solid color-mix(in srgb,var(--c) 40%,transparent);border-left:3px solid var(--c);border-radius:6px;background:color-mix(in srgb,var(--c) 16%,var(--surface));color:var(--ink);font:inherit;font-size:12px;line-height:1.3;text-align:left;overflow:hidden;cursor:pointer}
.cal-wev:hover{background:color-mix(in srgb,var(--c) 26%,var(--surface))}
.cal-wev .t{font-size:11px;color:var(--ink-2);font-variant-numeric:tabular-nums;white-space:nowrap;display:flex;align-items:center;gap:3px}
.cal-wev .n{font-weight:500;overflow-wrap:anywhere;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:var(--lines,2);overflow:hidden}
.cal-wev.is-short{justify-content:center;padding-top:0;padding-bottom:0}
.cal-wev.is-short .t{min-width:0}
.cal-wev.is-short .n{display:block;flex:1 1 auto;min-width:0;white-space:nowrap;text-overflow:ellipsis;color:var(--ink);font-size:12px}
.cal-wev svg{flex:none;width:12px;height:12px;color:var(--c)}
.cal-now{position:absolute;left:0;right:0;height:2px;background:var(--shu);z-index:2;pointer-events:none}
.cal-now::before{content:"";position:absolute;left:-4px;top:-3px;width:8px;height:8px;border-radius:50%;background:var(--shu)}
/* 予定リスト */
.cal-ag-top{display:flex;flex-wrap:wrap;align-items:center;gap:6px 14px;margin-bottom:4px}
.cal-ag-day{display:grid;grid-template-columns:118px minmax(0,1fr);gap:4px 14px;padding:12px 0;border-top:1px solid var(--line)}
.cal-ag-date{display:flex;flex-wrap:wrap;align-items:baseline;align-content:flex-start;gap:2px 6px;padding-top:6px}
.cal-ag-md{font-size:18px;font-weight:700;font-variant-numeric:tabular-nums}
.cal-ag-w{font-size:13px;color:var(--ink-2)}
.cal-ag-day.is-sun .cal-ag-md,.cal-ag-day.is-sun .cal-ag-w,.cal-ag-day.is-hol .cal-ag-md,.cal-ag-day.is-hol .cal-ag-w{color:var(--shu)}
.cal-ag-day.is-sat .cal-ag-md,.cal-ag-day.is-sat .cal-ag-w{color:var(--gosu)}
.cal-ag-rel{font-size:11.5px;font-weight:700;line-height:1.7;color:var(--on-gosu);background:var(--gosu);border-radius:99px;padding:0 8px}
.cal-ag-day .cal-hol{flex-basis:100%;font-size:12px}
.cal-ag-day.is-past .cal-ag-items{opacity:.72}
.cal-ag-items{display:grid;gap:6px;min-width:0}
.cal-ag-it{display:grid;grid-template-columns:104px minmax(0,1fr);gap:2px 12px;align-items:start;width:100%;min-height:44px;padding:8px 10px;border:1px solid var(--line);border-left:4px solid var(--c);border-radius:8px;background:var(--surface);color:var(--ink);font:inherit;text-align:left;cursor:pointer}
.cal-ag-it:hover{background:var(--surface-2)}
.cal-ag-it.is-ext{border:1.5px dashed var(--c)}
.cal-ag-time{font-size:13px;color:var(--ink-2);font-variant-numeric:tabular-nums;padding-top:1px}
.cal-ag-main{display:grid;gap:3px;min-width:0}
.cal-ag-title{display:flex;align-items:center;gap:6px;font-weight:700;overflow-wrap:anywhere;min-width:0}
.cal-ag-title svg{flex:none;width:15px;height:15px;color:var(--c)}
.cal-ag-title .rep{color:var(--ink-3)}
.cal-ag-meta{display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px;font-size:12.5px;color:var(--ink-3);min-width:0}
.cal-ag-hol{color:var(--shu);font-size:13px;padding-top:8px}
.cal-foot{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;margin-top:14px;font-size:13px;color:var(--ink-2)}
/* ダイアログの中 */
.cal-2col{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px}
.cal-allday{display:flex;align-items:center;gap:8px;min-height:38px}
.cal-note{font-size:12.5px;color:var(--ink-2);background:var(--surface-2);border-radius:8px;padding:8px 10px}
.cal-gl{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px}
.cal-drop{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:8px;padding:18px;border:1.5px dashed var(--line-strong);border-radius:var(--r);background:var(--surface-2);color:var(--ink-2);text-align:center;font-size:13.5px}
.cal-drop svg{width:20px;height:20px}
.cal-drop.is-over{border-color:var(--gosu);background:var(--gosu-wash)}
.cal-imp{max-height:min(48vh,420px);overflow:auto}
.cal-imp td{font-size:13px}
.cal-imp td:first-child{width:36px}
.cal-imp .chip{margin:2px 4px 0 0}
@media (max-width:640px){
  .cal-title{font-size:18px}
  .cal-quick-idle{display:none}
  .cal-quick-pre:has(.cal-quick-idle){min-height:0}
  .cal-filters{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;margin-left:calc(-1 * var(--gutter-l));margin-right:calc(-1 * var(--gutter-r));padding:2px var(--gutter-r) 4px var(--gutter-l)}
  .cal-filters::-webkit-scrollbar{display:none}
  .cal-filters .chip,.cal-others{min-height:36px;flex:none}
  .cal-wk-row{grid-template-columns:38px repeat(var(--n),minmax(0,1fr))}
  .cal-ag-day{grid-template-columns:1fr;padding:10px 0}
  .cal-ag-date{padding-top:0}
  .cal-ag-it{grid-template-columns:1fr}
  .cal-2col.cal-stack-sm{grid-template-columns:1fr}
  .cal-io-btn{width:38px;min-width:38px;padding:0}
  .cal-io-btn span{display:none}
}
`);

  /* ───────── 年間行事の読み取り（まとめて追加） ───────── */
  // 年のない日付は、年度に合わせる（4〜12月はその年、1〜3月は次の年）
  const syYear = (m, year) => (+m >= 4 ? year : year + 1);
  function withSchoolYear(line, year) {
    return String(line).replace(/(^|[^\d\/年.\-])(\d{1,2})([\/月])(\d{1,2})(?!\d)/, (all, pre, m, sep, d) => (+m >= 1 && +m <= 12 ? pre + syYear(m, year) + '/' + m + '/' + d + (sep === '月' ? '' : '') : all));
  }
  function bulkParse(text, year) {
    const items = [], skipped = [];
    const mk = (y, m, d) => { const yy = y ? +y : syYear(m, year); const x = new Date(yy, +m - 1, +d); return x.getMonth() === +m - 1 ? ymd(x) : null; };
    const DATE = '(?:(\\d{4})[\\/年.\\-])?(\\d{1,2})[\\/月.](\\d{1,2})日?(?:\\s*[(（]?[月火水木金土日](?:曜日?)?[)）]?)?';
    const reRange = new RegExp('^' + DATE + '\\s*[〜~\\-ー－]\\s*(?:' + DATE + '|(\\d{1,2})日?)\\s+(.+)$');
    const reOne = new RegExp('^' + DATE + '\\s*(.*)$');
    const reCols = /^(\d{1,2})\s+(\d{1,2})\s+(?:[(（]?[月火水木金土日][)）]?\s+)?(.+)$/;
    for (const raw of String(text || '').split(/\r?\n/)) {
      const line = raw.normalize('NFKC').replace(/\t+/g, ' ').replace(/\s+/g, ' ').trim();
      if (!line) continue;
      let m = reRange.exec(line);
      if (m) {
        const from = mk(m[1], m[2], m[3]);
        const to = m[6] ? mk(m[4], m[5], m[6]) : m[7] ? mk(m[1], m[2], m[7]) : null;
        const title = m[8].trim();
        if (from && to && to >= from && title) {
          const n = Kit.daysBetween(from, to);
          const cat = guessCat(title);
          if (n <= 14) for (let i = 0; i <= n; i++) items.push({ title, date: add(from, i), allDay: true, start: '', end: '', cat, place: '', memo: n ? (i + 1) + '日目（' + md(from) + '〜' + md(to) + '）' : '', repeat: 'none', repeatUntil: '', notes: [] });
          else { items.push({ title: title + '（〜' + md(to) + '）', date: from, allDay: true, start: '', end: '', cat, place: '', memo: '', repeat: 'none', repeatUntil: '', notes: [] }); items.push({ title: title + '（おわり）', date: to, allDay: true, start: '', end: '', cat, place: '', memo: '', repeat: 'none', repeatUntil: '', notes: [] }); }
          continue;
        }
      }
      m = reOne.exec(line);
      let dateStr = null, rest = '';
      if (m) { const d = mk(m[1], m[2], m[3]); if (d) { dateStr = d; rest = m[4]; } }
      if (!dateStr && (m = reCols.exec(line))) { const d = mk(null, m[1], m[2]); if (d) { dateStr = d; rest = m[3]; } }
      if (!dateStr) {
        const q = parseQuick(withSchoolYear(line, year));
        if (q.dateGiven && !q.bad && q.title) items.push(Object.assign(q, { place: '', memo: '', repeat: 'none', repeatUntil: '', notes: [] }));
        else skipped.push(line);
        continue;
      }
      const q = parseQuick(dateStr.replace(/-/g, '/') + ' ' + rest);
      if (!q.title) { skipped.push(line); continue; }
      items.push({ title: q.title, date: dateStr, allDay: q.allDay, start: q.start, end: q.end, cat: q.cat, place: '', memo: '', repeat: 'none', repeatUntil: '', notes: [] });
    }
    return { items, skipped };
  }

  /* ───────── 取り込みの確かめ（.ics・共有・まとめて追加で同じ画面） ───────── */
  async function previewImport(found, o = {}) {
    if (!found.length) { Kit.toast('予定が見つかりませんでした', { type: 'bad' }); return; }
    const cut = found.length > 1000;
    if (cut) found = found.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 1000);
    found = found.slice().sort((a, b) => (a.date + (a.start || '')).localeCompare(b.date + (b.start || '')));
    const events = await Kit.store.list('events');
    const t = todayS(), have = new Set(events.filter((e) => !e.sample).map((e) => (e.title || '') + '|' + e.date + '|' + (e.start || '')));
    const rows = found.map((ev) => {
      const past = !o.keepPast && (ev.repeat && ev.repeat !== 'none' ? ev.repeatUntil && ev.repeatUntil < t : ev.date < t);
      const dup = have.has(ev.title + '|' + ev.date + '|' + (ev.start || ''));
      return { ev: Object.assign({ place: '', memo: '', repeat: 'none', repeatUntil: '', notes: [] }, ev, { cat: catOf(ev.cat) }), past: !!past, dup, on: !dup && !past };
    });
    const pastN = rows.filter((x) => x.past).length;
    const tbody = h('tbody');
    let okBtn = null;
    const label = o.okLabel || '読み込む';
    const count = () => { const n = rows.filter((x) => x.on).length; if (okBtn) okBtn.textContent = n + '件を' + label; };
    rows.forEach((x, i) => {
      const cb = h('input', { type: 'checkbox', id: 'cal-imp-' + i, checked: x.on, 'aria-label': x.ev.title + 'を' + label, onchange: () => { x.on = cb.checked; count(); } });
      const cat = h('select', { 'aria-label': x.ev.title + 'の種類', style: { minHeight: '30px', padding: '2px 6px', fontSize: '13px', width: 'auto' } }, CATS.map((c) => h('option', { value: c.id }, c.label)));
      cat.value = x.ev.cat;
      cat.addEventListener('change', () => { x.ev.cat = cat.value; });
      x.cb = cb;
      tbody.append(h('tr', null, h('td', null, cb),
        h('td', { class: 'nowrap num' }, md(x.ev.date), h('br'), x.ev.allDay ? '終日' : x.ev.start + (x.ev.end ? '〜' + x.ev.end : '')),
        h('td', null, h('label', { for: 'cal-imp-' + i, style: { color: 'var(--ink)', fontWeight: 700 } }, x.ev.title), x.ev.place ? h('div', { class: 'small muted' }, x.ev.place) : null,
          h('div', null,
            x.ev.repeat && x.ev.repeat !== 'none' ? h('span', { class: 'chip' }, x.ev.repeat === 'weekly' ? '毎週' : x.ev.repeat === 'monthly' ? '毎月' : 'くり返し') : null,
            x.dup ? h('span', { class: 'chip warn' }, 'もう入っています') : null,
            x.past ? h('span', { class: 'chip' }, '過去の予定') : null,
            (x.ev.notes || []).map((n) => h('span', { class: 'chip line' }, n)))),
        h('td', null, cat)));
    });
    const pastCb = h('input', { type: 'checkbox', id: 'cal-imp-past', onchange: () => { for (const x of rows) if (x.past && !x.dup) { x.on = pastCb.checked; x.cb.checked = x.on; } count(); } });
    const body = h('div', { class: 'stack' },
      h('p', null, o.intro || found.length + '件の予定が見つかりました。読み込む予定にチェックを入れてください。'),
      cut ? h('p', { class: 'small', style: { color: 'var(--warn)' } }, '多すぎるので、新しい順に1000件までにしました。') : null,
      pastN ? h('label', { class: 'check', for: 'cal-imp-past' }, pastCb, '過去の予定（' + pastN + '件）もふくめる') : null,
      h('div', { class: 'tbl-wrap cal-imp' }, h('table', { class: 'tbl' }, h('thead', null, h('tr', null, h('th', null, ''), h('th', null, '日時'), h('th', null, '予定'), h('th', null, '種類'))), tbody)));
    const m = Kit.modal({
      title: o.title || '予定を読み込む', wide: true, body,
      actions: [{ label: 'やめる', kind: 'ghost' }, {
        label, kind: 'primary', onClick: async () => {
          const pick = rows.filter((x) => x.on);
          if (!pick.length) { Kit.toast('予定を選んでください', { type: 'bad' }); return false; }
          for (const x of pick) { const it = Object.assign({}, x.ev); delete it.notes; delete it.dateGiven; delete it.bad; await Kit.store.put('events', it); }
          if (o.onDone) o.onDone(pick[0].ev.date);
          Kit.toast(pick.length + '件の予定を入れました');
          return true;
        },
      }],
    });
    okBtn = m.el.querySelector('.modal-f .btn.primary');
    count();
  }

  // 共有された予定を受け取る（#share=… のリンク・共有ファイル）
  School.share.receive('events', async (pack) => {
    const items = pack.items.filter((x) => x && isYmd(x.date) && x.title).map((x) => ({ title: String(x.title).slice(0, 120), date: x.date, allDay: !!x.allDay || !x.start, start: x.start || '', end: x.end || '', cat: catOf(x.cat), place: String(x.place || '').slice(0, 120), memo: String(x.memo || '').slice(0, 1000), repeat: ['weekly', 'monthly'].includes(x.repeat) ? x.repeat : 'none', repeatUntil: isYmd(x.repeatUntil) ? x.repeatUntil : '', notes: [] }));
    await previewImport(items, { title: '共有された予定' + (pack.from ? '（' + pack.from + 'から）' : ''), intro: (pack.from ? pack.from + 'から' : '') + items.length + '件の予定が届きました。入れる予定にチェックを入れてください。', okLabel: '入れる', onDone: () => { if (Kit.current() === 'calendar') Kit.remount(); } });
  });

  /* ───────── 画面 ───────── */
  Kit.app({
    id: 'calendar', title: 'カレンダー', group: 'plan', icon: 'calendar', order: 60,
    desc: '行事・テスト・会議・締切をひとつに。共有も',
    docs: ['calendar'],
    colls: ['events'],
    async mount(root, params) {
      const S = {
        view: ['month', 'week', 'list'].includes(Kit.pref.get('cal:view', 'month')) ? Kit.pref.get('cal:view', 'month') : 'month',
        cursor: todayS(), sel: todayS(),
        hide: new Set(Kit.pref.get('cal:hide', [])),
        others: Kit.pref.get('cal:others', true) !== false,
        past: !!Kit.pref.get('cal:past', false),
        events: [], reminders: [], homework: [], classes: [], cfg: normCfg(null), map: new Map(),
      };
      if (params && isYmd(params.date)) S.cursor = S.sel = params.date;
      const mq = window.matchMedia('(max-width: 640px)');
      const compact = () => mq.matches;

      const sampleSlot = h('div');
      const bar = h('div', { class: 'toolbar cal-bar' });
      const filters = h('div', { class: 'cal-filters', role: 'group', 'aria-label': '表示する種類' });
      const hint = h('div');
      const viewBox = h('div', { class: 'cal-view' });
      const dayBox = h('div');
      const foot = h('div', { class: 'cal-foot' });
      const ioBtn = Kit.btn('書き出し・読み込み', () => openIO(), { icon: 'download', class: 'cal-io-btn' });
      ioBtn.title = 'Googleカレンダー用CSV・.ics の書き出しと読み込み';
      ioBtn.setAttribute('aria-label', '書き出し・読み込み');
      root.append(
        Kit.appHead({
          title: 'カレンダー', desc: '行事・テスト・会議・締切をひとつに。宿題の締切も重なって見えます。',
          actions: [
            Kit.btn('予定を追加', () => openEvent(null, { date: addDate() }), { kind: 'primary', icon: 'plus' }),
            Kit.btn('年間行事をまとめて追加', () => openBulk(), { icon: 'copy' }),
            Kit.btn('共有', () => openShare(), { icon: 'share' }),
            ioBtn,
          ],
        }),
        sampleSlot, buildQuick(), bar, filters, hint, viewBox, dayBox, foot);

      async function load() {
        const [events, reminders, homework, classes, cfg] = await Promise.all([
          Kit.store.list('events', { sample: SAMPLE_EVENTS }), Kit.store.list('reminders'), Kit.store.list('homework'), School.classes.list(),
          Kit.store.get('calendar', { blank: CFG_BLANK }),
        ]);
        Object.assign(S, { events, reminders, homework, classes, cfg: normCfg(cfg) });
      }

      /* ── 表示するもの ── */
      function eventItem(o) {
        const allDay = !!o.allDay || toMin(o.start) == null;
        return {
          key: 'e:' + o.id + ':' + o.occ, id: o.id, date: o.occ, title: o.title || '（名前なし）', allDay,
          start: allDay ? '' : o.start, end: allDay || !(toMin(o.end) > toMin(o.start)) ? '' : o.end,
          cat: catOf(o.cat), place: o.place || '', memo: o.memo || '', repeat: o.repeat === 'weekly' || o.repeat === 'monthly' ? o.repeat : '', sample: !!o.sample,
        };
      }
      // ほかの道具の予定（読むだけ。押すとその道具へ）：リマインダー・宿題の締切
      function externals(from, to) {
        const out = [], inR = (d) => isYmd(d) && d >= from && d <= to;
        for (const rm of S.reminders) {
          if (!rm || rm.done || !inR(rm.date)) continue;
          const st = toMin(rm.time);
          out.push({ key: 'rm:' + rm.id, ext: true, src: 'リマインダー', icon: 'bell', id: rm.id, date: rm.date, title: rm.title || 'リマインダー', allDay: st == null, start: st == null ? '' : hm(st), end: st == null ? '' : hm(Math.min(st + 30, 1439)), cat: 'deadline', place: '', memo: rm.memo || '', sample: !!rm.sample, go: () => Kit.go('reminders', { id: rm.id }) });
        }
        const cname = (id) => { const c = S.classes.find((x) => x.id === id); return c ? c.name : ''; };
        for (const hw of S.homework) {
          if (!hw || hw.closed || !inR(hw.due)) continue;
          out.push({ key: 'hw:' + hw.id, ext: true, src: '宿題', icon: 'clipboard', id: hw.id, date: hw.due, title: '宿題の締切：' + (hw.title || '') + (cname(hw.classId) ? '（' + cname(hw.classId) + '）' : ''), allDay: true, start: '', end: '', cat: 'deadline', place: '', memo: hw.note || '', sample: !!hw.sample, go: () => Kit.go('homework', { id: hw.id }) });
        }
        return out;
      }
      const byTime = (a, b) => a.date.localeCompare(b.date) || (a.allDay === b.allDay ? 0 : a.allDay ? -1 : 1) || (a.start || '').localeCompare(b.start || '') || a.title.localeCompare(b.title, 'ja');
      function itemsBetween(from, to) {
        let list = occurrences(S.events, from, to).map(eventItem);
        if (S.others) list = list.concat(externals(from, to));
        list = list.filter((it) => !S.hide.has(it.cat)).sort(byTime);
        for (const it of list) S.map.set(it.key, it);
        return list;
      }
      const byDate = (list) => { const o = {}; for (const it of list) (o[it.date] = o[it.date] || []).push(it); return o; };
      const timeText = (it) => (it.allDay ? '終日' : it.start + (it.end ? '〜' + it.end : ''));
      const tip = (it) => [md(it.date) + ' ' + timeText(it), it.title, it.place, it.ext ? it.src + 'から（押すと開きます）' : '', it.sample ? 'サンプル' : ''].filter(Boolean).join('\n');
      const relLabel = (s) => { const n = Kit.daysBetween(todayS(), s); return n === 0 ? '今日' : n === 1 ? '明日' : n === -1 ? '昨日' : ''; };
      const dayCls = (s) => { const w = Kit.parseYmd(s).getDay(); return (w === 0 ? ' is-sun' : w === 6 ? ' is-sat' : '') + (holiday(s) ? ' is-hol' : '') + (s === todayS() ? ' is-today' : ''); };
      const weekStartOf = (s) => { const d = Kit.parseYmd(s); return add(d, -((d.getDay() - S.cfg.weekStart + 7) % 7)); };

      // 見えている範囲
      function range() {
        if (S.view === 'month') {
          const c = Kit.parseYmd(S.cursor), first = new Date(c.getFullYear(), c.getMonth(), 1);
          const from = add(first, -((first.getDay() - S.cfg.weekStart + 7) % 7));
          const days = Kit.daysBetween(from, new Date(c.getFullYear(), c.getMonth() + 1, 0)) + 1;
          return { from, to: add(from, Math.ceil(days / 7) * 7 - 1), first: ymd(first), last: ymd(new Date(c.getFullYear(), c.getMonth() + 1, 0)) };
        }
        if (S.view === 'week') { const n = compact() ? 3 : 7, from = n === 7 ? weekStartOf(S.cursor) : S.cursor; return { from, to: add(from, n - 1), first: from, last: add(from, n - 1) }; }
        const from = S.past ? add(S.cursor, -30) : S.cursor;
        return { from, to: add(S.cursor, 29), first: S.cursor, last: add(S.cursor, 29) };
      }
      function addDate() {
        const t = todayS(), rg = range();
        if (S.view === 'month' && compact()) return S.sel;
        return t >= rg.first && t <= rg.last ? t : rg.first;
      }
      function rangeTitle(a, b) {
        const A = Kit.parseYmd(a), B = Kit.parseYmd(b);
        if (A.getFullYear() !== B.getFullYear()) return Kit.fmtDate(a, 'YYYY年M月D日') + '〜' + Kit.fmtDate(b, 'YYYY年M月D日');
        return Kit.fmtDate(a, 'YYYY年M月D日') + '〜' + (A.getMonth() === B.getMonth() ? B.getDate() + '日' : Kit.fmtDate(b, 'M月D日'));
      }

      /* ── 上の帯・絞り込み ── */
      function renderSample() {
        Kit.clear(sampleSlot);
        const has = S.events.some((e) => e.sample);
        if (!has) return;
        sampleSlot.append(Kit.sampleBar('予定の例（架空の学校）です。書きかえて使えます。', async () => {
          const ok = await Kit.confirm({ title: 'サンプルを片付けますか？', body: 'すべての道具の例（架空のクラス・学校）を消して、空の状態から始めます。自分で入れたものは消えません。', ok: '片付ける' });
          if (!ok) return;
          await Kit.store.samplesOff();
          Kit.toast('サンプルを片付けました');
        }));
      }
      function renderBar() {
        Kit.clear(bar);
        const rg = range();
        const title = S.view === 'month' ? Kit.fmtDate(S.cursor, 'YYYY年M月') : rangeTitle(rg.first, rg.last);
        bar.append(
          h('div', { class: 'cal-nav' },
            Kit.btn('', () => move(-1), { icon: 'left', title: S.view === 'month' ? '前の月' : '前へ' }),
            Kit.btn('今日', () => { S.cursor = S.sel = todayS(); renderAll(); }),
            Kit.btn('', () => move(1), { icon: 'right', title: S.view === 'month' ? '次の月' : '次へ' })),
          h('h2', { class: 'cal-title', 'aria-live': 'polite' }, title),
          Kit.seg([{ value: 'month', label: '月' }, { value: 'week', label: '週' }, { value: 'list', label: '予定リスト' }], S.view, (v) => {
            if (S.view === 'month' && compact()) S.cursor = S.sel;
            S.view = v; Kit.pref.set('cal:view', v); renderAll();
          }, { label: '表示のしかた' }));
      }
      function move(dir) {
        if (S.view === 'month') {
          const c = Kit.parseYmd(S.cursor), d = new Date(c.getFullYear(), c.getMonth() + dir, 1);
          const t = todayS();
          S.cursor = ymd(d);
          S.sel = Kit.ym(t) === Kit.ym(d) ? t : S.cursor;
        } else S.cursor = S.sel = add(S.cursor, dir * (S.view === 'week' ? (compact() ? 3 : 7) : 30));
        renderAll();
      }
      function renderFilters() {
        Kit.clear(filters);
        for (const c of CATS) {
          filters.append(h('button', {
            type: 'button', class: 'chip cal-c-' + c.id, 'aria-pressed': String(!S.hide.has(c.id)), title: c.label + 'を' + (S.hide.has(c.id) ? '表示する' : '隠す'),
            onclick: () => { if (S.hide.has(c.id)) S.hide.delete(c.id); else S.hide.add(c.id); Kit.pref.set('cal:hide', [...S.hide]); renderFilters(); renderView(); },
          }, h('span', { class: 'dot' }), c.label));
        }
        const cb = h('input', { type: 'checkbox', id: 'cal-others', checked: S.others, onchange: () => { S.others = cb.checked; Kit.pref.set('cal:others', S.others); renderView(); } });
        filters.append(h('label', { class: 'check cal-others', for: 'cal-others' }, cb, 'リマインダー・宿題の締切も表示'));
      }

      /* ── 月 ── */
      function evChip(it) {
        return h('button', { type: 'button', class: 'cal-ev cal-c-' + it.cat + (it.ext ? ' is-ext' : ''), 'data-key': it.key, title: tip(it) },
          it.ext ? Kit.icon(it.icon) : null,
          it.allDay ? null : h('span', { class: 't' }, it.start),
          h('span', { class: 'n' }, it.title),
          it.sample ? h('span', { class: 'cal-s', title: 'サンプル' }, '例') : null);
      }
      function renderMonth() {
        const rg = range(), items = byDate(itemsBetween(rg.from, rg.to)), small = compact();
        const box = h('div', { class: 'cal-month' });
        const dow = h('div', { class: 'cal-dow', 'aria-hidden': 'true' });
        for (let i = 0; i < 7; i++) { const w = (S.cfg.weekStart + i) % 7; dow.append(h('span', { class: w === 0 ? 'is-sun' : w === 6 ? 'is-sat' : '' }, Kit.WDAY[w])); }
        box.append(dow);
        const curM = Kit.ym(S.cursor);
        for (let wk = rg.from; wk <= rg.to; wk = add(wk, 7)) {
          const row = h('div', { class: 'cal-week' });
          for (let i = 0; i < 7; i++) {
            const s = add(wk, i), d = Kit.parseYmd(s), list = items[s] || [], hol = holiday(s);
            const cls = 'cal-day' + dayCls(s) + (Kit.ym(s) === curM ? '' : ' is-out');
            const num = d.getDate() === 1 ? (d.getMonth() + 1) + '/1' : String(d.getDate());
            if (small) {
              row.append(h('button', {
                type: 'button', class: cls + ' cal-dayc' + (s === S.sel ? ' is-sel' : ''), 'data-date': s, 'aria-pressed': String(s === S.sel),
                'aria-label': Kit.fmtDate(s, 'M月D日(W)') + (hol ? ' ' + hol : '') + (list.length ? '　予定' + list.length + '件' : ''),
              }, h('span', { class: 'cal-dnum' }, num), hol ? h('span', { class: 'cal-hol' }, hol) : null,
              list.length ? h('span', { class: 'cal-dots' }, list.slice(0, 4).map((it) => h('i', { class: 'cal-c-' + it.cat + (it.ext ? ' is-ext' : '') })), list.length > 4 ? h('b', null, '+') : null) : null));
            } else {
              const shown = list.length > 4 ? list.slice(0, 3) : list;
              row.append(h('div', { class: cls, 'data-date': s },
                h('div', { class: 'cal-dhead' },
                  h('button', { type: 'button', class: 'cal-dnum', 'data-add': s, title: 'この日に予定を追加', 'aria-label': Kit.fmtDate(s, 'M月D日(W)') + 'に予定を追加' }, num),
                  hol ? h('span', { class: 'cal-hol', title: hol }, hol) : null),
                shown.map(evChip),
                list.length > shown.length ? h('button', { type: 'button', class: 'cal-more', 'data-day': s }, 'ほか' + (list.length - shown.length) + '件') : null));
            }
          }
          box.append(row);
        }
        return box;
      }
      function agItem(it) {
        return h('button', { type: 'button', class: 'cal-ag-it cal-c-' + it.cat + (it.ext ? ' is-ext' : ''), 'data-key': it.key, title: it.ext ? it.src + 'で開く' : '予定を開く' },
          h('span', { class: 'cal-ag-time' }, timeText(it)),
          h('span', { class: 'cal-ag-main' },
            h('span', { class: 'cal-ag-title' }, it.ext ? Kit.icon(it.icon) : null, h('span', null, it.title), it.repeat ? h('span', { class: 'rep', title: it.repeat === 'weekly' ? '毎週' : '毎月' }, Kit.icon('refresh')) : null),
            h('span', { class: 'cal-ag-meta' },
              h('span', { class: 'chip cal-cat cal-c-' + it.cat }, h('span', { class: 'dot' }), CAT[it.cat].label),
              it.marks ? h('span', null, it.marks) : null,
              it.place ? h('span', null, it.place) : null,
              it.ext ? h('span', null, it.src + 'から') : null,
              it.repeat ? h('span', null, it.repeat === 'weekly' ? '毎週' : '毎月') : null,
              it.sample ? h('span', { class: 'chip sample' }, 'サンプル') : null)));
      }
      function renderDayPanel() {
        Kit.clear(dayBox);
        if (S.view !== 'month' || !compact()) return;
        const s = S.sel, list = itemsBetween(s, s), rel = relLabel(s), hol = holiday(s);
        dayBox.append(h('section', { class: 'cal-daypanel', 'aria-label': Kit.fmtDate(s, 'M月D日') + 'の予定' },
          h('div', { class: 'cal-dp-h' },
            h('h3', null, Kit.fmtDate(s, 'M月D日(W)')), rel ? h('span', { class: 'cal-ag-rel' }, rel) : null,
            hol ? h('span', { class: 'cal-hol' }, hol) : null, h('span', { class: 'grow' }),
            Kit.btn('この日に追加', () => openEvent(null, { date: s }), { sm: true, icon: 'plus' })),
          list.length ? h('div', { class: 'cal-ag-items' }, list.map(agItem)) : h('p', { class: 'small muted' }, '予定はありません。')));
      }

      /* ── 週（スマホは3日） ── */
      function lanes(list) {
        let cluster = [], cols = [], end = -1;
        const flush = () => { for (const it of cluster) it.n = cols.length; cluster = []; cols = []; end = -1; };
        for (const it of list) {
          if (cluster.length && it.s >= end) flush();
          let c = cols.findIndex((e) => e <= it.s);
          if (c < 0) { c = cols.length; cols.push(0); }
          cols[c] = it.e; it.col = c; cluster.push(it); end = Math.max(end, it.e);
        }
        flush();
      }
      function nowTop(RH) { const n = new Date(), m = n.getHours() * 60 + n.getMinutes(); return m >= DAY_START * 60 && m <= DAY_END * 60 ? ((m - DAY_START * 60) / 60) * RH : null; }
      function renderWeek() {
        const rg = range(), n = Kit.daysBetween(rg.from, rg.to) + 1;
        const days = Array.from({ length: n }, (_, i) => add(rg.from, i));
        const items = itemsBetween(rg.from, rg.to), RH = compact() ? 40 : 44, H = (DAY_END - DAY_START) * RH;
        const wrap = h('div', { class: 'cal-wk', style: '--n:' + n });
        const head = h('div', { class: 'cal-wk-row cal-wk-head' }, h('div', { class: 'cal-wk-gut' }));
        const all = h('div', { class: 'cal-wk-row cal-wk-all' }, h('div', { class: 'cal-wk-gut' }, '終日'));
        const body = h('div', { class: 'cal-wk-row cal-wk-body', style: 'height:' + H + 'px' });
        const gut = h('div', { class: 'cal-wk-gut cal-wk-hours' });
        for (let hh = DAY_START; hh < DAY_END; hh++) gut.append(h('div', { class: 'cal-wk-hl', style: 'top:' + (hh - DAY_START) * RH + 'px' }, hh + ':00'));
        body.append(gut);
        for (const s of days) {
          const d = Kit.parseYmd(s), hol = holiday(s);
          head.append(h('button', { type: 'button', class: 'cal-wk-dh' + dayCls(s), 'data-add': s, title: 'この日に予定を追加', 'aria-label': Kit.fmtDate(s, 'M月D日(W)') + (hol ? ' ' + hol : '') + 'に予定を追加' },
            h('span', { class: 'w' }, Kit.WDAY[d.getDay()]), h('span', { class: 'd' }, String(d.getDate())), hol ? h('span', { class: 'cal-hol' }, hol) : null));
          all.append(h('div', { class: 'cal-wk-ac' }, items.filter((it) => it.date === s && it.allDay).map(evChip)));
          const col = h('div', { class: 'cal-wk-col' + (s === todayS() ? ' is-today' : ''), 'data-col': s });
          for (let k = 1; k < DAY_END - DAY_START; k++) col.append(h('i', { class: 'cal-wk-line', style: 'top:' + k * RH + 'px' }));
          const timed = items.filter((it) => it.date === s && !it.allDay).map((it) => {
            const a = toMin(it.start), e = toMin(it.end);
            return Object.assign({}, it, { s: a, e: e != null && e > a ? e : a + 60 });
          }).sort((a, b) => a.s - b.s || b.e - a.e);
          lanes(timed);
          for (const it of timed) {
            const top = Kit.clamp(((it.s - DAY_START * 60) / 60) * RH, 0, H - RH / 2);
            const bot = Kit.clamp(((it.e - DAY_START * 60) / 60) * RH, top + RH / 2, H);
            const hgt = Math.max(18, bot - top - 2), short = hgt < 34;
            col.append(h('button', {
              type: 'button', class: 'cal-wev cal-c-' + it.cat + (it.ext ? ' is-ext' : '') + (short ? ' is-short' : ''), 'data-key': it.key, title: tip(it),
              style: 'top:' + top + 'px;height:' + hgt + 'px;left:calc(' + it.col + ' * 100% / ' + it.n + ');width:calc(100% / ' + it.n + ' - 4px);--lines:' + Math.max(1, Math.floor((hgt - 20) / 15.6)),
            }, h('span', { class: 't' }, it.ext ? Kit.icon(it.icon) : null, short || it.n > 1 ? it.start : it.start + (it.end ? '〜' + it.end : ''), short ? h('span', { class: 'n' }, it.title) : null, it.sample ? h('span', { class: 'cal-s' }, '例') : null),
            short ? null : h('span', { class: 'n' }, it.title)));
          }
          if (s === todayS() && nowTop(RH) != null) col.append(h('div', { class: 'cal-now', style: 'top:' + nowTop(RH) + 'px', 'aria-hidden': 'true' }));
          col.addEventListener('click', (e) => {
            if (e.target.closest('[data-key]')) return;
            const y = e.clientY - col.getBoundingClientRect().top;
            const m = Kit.clamp(DAY_START * 60 + Math.floor((y / RH) * 2) * 30, 0, 23 * 60);
            openEvent(null, { date: s, start: hm(m), end: hm(Math.min(m + 60, 1439)) });
          });
          body.append(col);
        }
        wrap.append(head, all, body);
        return wrap;
      }

      /* ── 予定リスト ── */
      function renderList() {
        const rg = range(), list = itemsBetween(rg.from, rg.to), by = byDate(list), t = todayS();
        const box = h('div', { class: 'cal-ag' });
        const cb = h('input', { type: 'checkbox', id: 'cal-past', checked: S.past, onchange: () => { S.past = cb.checked; Kit.pref.set('cal:past', S.past); renderAll(); } });
        box.append(h('div', { class: 'cal-ag-top' },
          h('label', { class: 'check', for: 'cal-past' }, cb, '過去30日も表示'),
          h('span', { class: 'small muted' }, Kit.fmtDate(rg.from, 'M/D') + 'から30日' + (S.past ? '（と、その前の30日）' : '') + 'の予定')));
        const days = [];
        for (let s = rg.from; s <= rg.to; s = add(s, 1)) if (by[s] || holiday(s)) days.push(s);
        if (!list.length) box.append(Kit.empty({ title: 'この期間の予定はありません', body: '上の「すばやく追加」か、「予定を追加」から入れられます。', actions: [Kit.btn('予定を追加', () => openEvent(null, { date: addDate() }), { kind: 'primary', icon: 'plus' })] }));
        else {
          for (const s of days) {
            const d = Kit.parseYmd(s), rel = relLabel(s), hol = holiday(s);
            box.append(h('section', { class: 'cal-ag-day' + dayCls(s) + (s < t ? ' is-past' : ''), 'aria-label': Kit.fmtDate(s, 'M月D日(W)') },
              h('div', { class: 'cal-ag-date' }, h('span', { class: 'cal-ag-md' }, (d.getMonth() + 1) + '/' + d.getDate()), h('span', { class: 'cal-ag-w' }, '(' + Kit.WDAY[d.getDay()] + ')'), rel ? h('span', { class: 'cal-ag-rel' }, rel) : null, hol ? h('span', { class: 'cal-hol' }, hol) : null),
              by[s] ? h('div', { class: 'cal-ag-items' }, by[s].map(agItem)) : h('div', { class: 'cal-ag-hol' }, hol + '（予定なし）')));
          }
        }
        return box;
      }

      function renderView() {
        S.map = new Map();
        Kit.clear(viewBox);
        viewBox.append(S.view === 'month' ? renderMonth() : S.view === 'week' ? renderWeek() : renderList());
        renderDayPanel();
        Kit.clear(hint);
        if (!S.events.length) hint.append(h('p', { class: 'cal-hint' }, 'まだ予定がありません。上の「すばやく追加」に「10/20 15:40 学年会」のように書くと、すぐ入ります。学校の年間行事は「年間行事をまとめて追加」で貼り付けられます。'));
      }
      function renderFoot() {
        Kit.clear(foot);
        foot.append(h('span', null, '週のはじまり'),
          Kit.seg([{ value: 0, label: '日曜' }, { value: 1, label: '月曜' }], S.cfg.weekStart, (v) => saveCfg({ weekStart: +v }), { label: '週のはじまり' }),
          h('span', { class: 'muted' }, '祝日は法律の決まりから計算しています（振替休日・国民の休日をふくむ）。'));
      }
      function renderAll() { renderSample(); renderBar(); renderFilters(); renderView(); renderFoot(); }
      function saveCfg(patch) {
        const c = Object.assign({}, S.cfg, patch);
        delete c._sample;
        S.cfg = Object.assign(normCfg(c), { _sample: false });
        return Kit.store.set('calendar', c);
      }

      // クリック：予定を開く・この日に追加・ほかの件
      function openItem(it) {
        if (!it) return;
        if (it.ext) { it.go(); return; }
        const ev = S.events.find((e) => e.id === it.id);
        if (ev) openEvent(ev, { occ: it.date });
      }
      root.addEventListener('click', (e) => {
        const k = e.target.closest('[data-key]');
        if (k && root.contains(k)) { openItem(S.map.get(k.dataset.key)); return; }
        const more = e.target.closest('[data-day]');
        if (more) { openDay(more.dataset.day); return; }
        const a = e.target.closest('[data-add]');
        if (a) { openEvent(null, { date: a.dataset.add }); return; }
        const cell = e.target.closest('.cal-day[data-date]');
        if (!cell) return;
        if (compact()) { S.sel = cell.dataset.date; renderView(); const b = viewBox.querySelector('.cal-day[data-date="' + S.sel + '"]'); if (b) b.focus(); }
        else openEvent(null, { date: cell.dataset.date });
      });

      /* ── すばやく追加 ── */
      function buildQuick() {
        const inp = h('input', { type: 'text', id: 'cal-quick', placeholder: '例：10/20 15:40 学年会', autocomplete: 'off', enterkeyhint: 'done' });
        const pre = h('div', { class: 'cal-quick-pre', 'aria-live': 'polite' });
        let parsed = null;
        const fill = () => ({ title: parsed.title, date: parsed.date, allDay: parsed.allDay, start: parsed.start, end: parsed.end, cat: parsed.cat });
        const show = () => {
          Kit.clear(pre);
          const v = inp.value.trim();
          parsed = v ? parseQuick(v) : null;
          if (!parsed) { pre.append(h('span', { class: 'muted cal-quick-idle' }, '「明日 16時 職員会議」「来週火曜 中間テスト」のように書くと、日付と時刻を読み取ります。')); return; }
          if (parsed.bad) { pre.append(h('span', null, 'その日付はありません。「10/20」のように入れてください。')); return; }
          if (!parsed.title) { pre.append(h('span', null, '予定の名前も入れてください。')); return; }
          Kit.add(pre, [h('span', { class: 'cal-qp' }, h('span', null, '→'), h('b', null, md(parsed.date)), h('span', null, parsed.allDay ? '終日' : parsed.start + '〜' + parsed.end),
            h('span', { class: 'cal-qp-title' }, parsed.title), h('span', { class: 'chip cal-cat cal-c-' + parsed.cat }, h('span', { class: 'dot' }), CAT[parsed.cat].label)),
          parsed.dateGiven ? null : h('span', { class: 'small muted' }, '日付がないので今日にします'),
          Kit.btn('くわしく入力', () => openEvent(null, fill()), { sm: true, kind: 'ghost' })]);
        };
        const go = async () => {
          show();
          if (!parsed || parsed.bad || !parsed.title) { inp.focus(); Kit.toast('「10/20 15:40 学年会」のように、日付・時刻・名前を入れてください', { type: 'bad' }); return; }
          const it = Object.assign(fill(), { place: '', memo: '', repeat: 'none', repeatUntil: '' });
          S.cursor = S.sel = it.date;
          await Kit.store.put('events', it);
          Kit.toast(md(it.date) + 'に「' + it.title + '」を入れました');
          inp.value = '';
          show();
        };
        inp.addEventListener('input', show);
        inp.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); go(); } });
        show();
        return h('div', { class: 'cal-quick' },
          h('label', { for: 'cal-quick' }, 'すばやく追加'),
          h('div', { class: 'cal-quick-row' }, inp, Kit.btn('追加', go, { kind: 'primary', icon: 'plus' })), pre);
      }

      /* ── 予定のダイアログ ── */
      function openEvent(ev, o = {}) {
        const isNew = !ev;
        const d = Object.assign({ title: '', date: S.cursor, allDay: false, start: '10:00', end: '11:00', cat: 'class', place: '', memo: '', repeat: 'none', repeatUntil: '' }, isNew ? o : Kit.clone(ev));
        const f = {
          title: h('input', { type: 'text', id: 'cal-f-title', placeholder: '例：職員会議、中間テスト', maxlength: 120 }),
          date: h('input', { type: 'date', id: 'cal-f-date' }),
          allDay: h('input', { type: 'checkbox', id: 'cal-f-allday', checked: !!d.allDay || (!isNew && !d.start) }),
          start: h('input', { type: 'time', id: 'cal-f-start', step: 300 }),
          end: h('input', { type: 'time', id: 'cal-f-end', step: 300 }),
          cat: h('select', { id: 'cal-f-cat' }, CATS.map((c) => h('option', { value: c.id }, c.label))),
          place: h('input', { type: 'text', id: 'cal-f-place', placeholder: '例：会議室、体育館、2年3組' }),
          memo: h('textarea', { id: 'cal-f-memo', rows: 3, placeholder: '持ち物・連絡先など' }),
          repeat: h('select', { id: 'cal-f-repeat' }),
          until: h('input', { type: 'date', id: 'cal-f-until' }),
        };
        f.title.value = d.title || ''; f.date.value = d.date || todayS();
        f.start.value = d.start || (isNew ? '10:00' : ''); f.end.value = d.end || '';
        f.cat.value = catOf(d.cat); f.place.value = d.place || ''; f.memo.value = d.memo || ''; f.until.value = d.repeatUntil || '';
        const times = h('div', { class: 'cal-2col' }, Kit.field({ label: '始まり', input: f.start }), Kit.field({ label: '終わり', input: f.end }));
        const untilF = Kit.field({ label: 'くり返しの終わり（空欄ならずっと）', input: f.until });
        const repNote = h('p', { class: 'cal-note' }, 'くり返しの予定を直すと、すべての回が変わります（1回だけ変えることはできません）。');
        const gl = h('a', { class: 'btn ghost sm', target: '_blank', rel: 'noopener', href: '#' }, Kit.icon('external'), h('span', null, 'Googleカレンダーに追加'));
        const glNote = h('span', { class: 'small muted' }, 'くり返しは Googleカレンダーの画面で設定してください。');
        const fillRepeat = () => {
          const dt = Kit.parseYmd(f.date.value), ok = !isNaN(dt), cur = f.repeat.value || d.repeat || 'none';
          Kit.clear(f.repeat);
          f.repeat.append(h('option', { value: 'none' }, 'しない'), h('option', { value: 'weekly' }, ok ? '毎週（' + Kit.WDAY[dt.getDay()] + '曜日）' : '毎週'), h('option', { value: 'monthly' }, ok ? '毎月（' + dt.getDate() + '日）' : '毎月'));
          f.repeat.value = ['none', 'weekly', 'monthly'].includes(cur) ? cur : 'none';
        };
        const sync = () => {
          times.hidden = f.allDay.checked;
          const rep = f.repeat.value !== 'none';
          untilF.hidden = !rep; repNote.hidden = !rep; glNote.hidden = !rep;
          gl.href = googleLink({ title: f.title.value.trim() || '予定', date: isYmd(f.date.value) ? f.date.value : todayS(), allDay: f.allDay.checked || !f.start.value, start: f.start.value, end: f.end.value, memo: f.memo.value.trim(), place: f.place.value.trim() });
        };
        fillRepeat();
        f.date.addEventListener('change', () => { fillRepeat(); sync(); });
        // 終日を外したら、時刻を入れておく
        f.allDay.addEventListener('change', () => { if (!f.allDay.checked && !f.start.value) { f.start.value = '10:00'; f.end.value = f.end.value || '11:00'; } });
        for (const k of ['title', 'allDay', 'start', 'end', 'place', 'memo', 'repeat']) f[k].addEventListener(k === 'allDay' || k === 'repeat' ? 'change' : 'input', sync);
        const body = h('div', { class: 'stack' },
          ev && ev.sample ? h('p', { class: 'cal-note' }, h('span', { class: 'chip sample' }, 'サンプル'), '　例の予定です。書きかえて保存すると、自分の予定になります。') : null,
          ev && o.occ && ev.repeat !== 'none' && o.occ !== ev.date ? h('p', { class: 'cal-note' }, md(o.occ) + ' の回から開きました。日付はくり返しの最初の日です。') : null,
          Kit.field({ label: '予定の名前', input: f.title }),
          h('div', { class: 'cal-2col' }, Kit.field({ label: '日付', input: f.date }), h('div', { class: 'cal-allday' }, h('label', { class: 'check', for: 'cal-f-allday' }, f.allDay, '終日'))),
          times,
          h('div', { class: 'cal-2col cal-stack-sm' }, Kit.field({ label: '種類', input: f.cat }), Kit.field({ label: 'くり返し', input: f.repeat })),
          untilF, repNote,
          Kit.field({ label: '場所', input: f.place }),
          Kit.field({ label: 'メモ', input: f.memo }),
          h('div', { class: 'cal-gl' }, gl, glNote,
            !isNew && Kit.appDef('templates') ? Kit.btn('お知らせ文をつくる', () => {
              const dt = f.date.value || d.date, L = window.Letters, tm = f.allDay.checked || !f.start.value ? '' : f.start.value + '〜' + (f.end.value || '');
              m.close();
              Kit.go('templates', { id: 'p-event', vals: { 行事名: f.title.value.trim(), 日時: (L ? L.jpDate(dt) : dt) + tm, 場所: f.place.value.trim() } });
            }, { sm: true, kind: 'ghost', icon: 'mail', title: '保護者へのお知らせの文書を、連絡テンプレートでつくる' }) : null));
        sync();
        const save = async () => {
          const title = f.title.value.trim();
          if (!title) { Kit.toast('予定の名前を入れてください', { type: 'bad' }); f.title.focus(); return false; }
          const date = f.date.value;
          if (!isYmd(date)) { Kit.toast('日付を入れてください', { type: 'bad' }); f.date.focus(); return false; }
          let allDay = f.allDay.checked, start = f.start.value, end = f.end.value;
          if (!start) allDay = true;
          if (allDay) start = end = '';
          if (start && end && end <= start) { Kit.toast('終わりの時刻は、始まりより後にしてください', { type: 'bad' }); f.end.focus(); return false; }
          const repeat = f.repeat.value, until = repeat === 'none' ? '' : f.until.value;
          if (until && until < date) { Kit.toast('くり返しの終わりは、最初の日より後にしてください', { type: 'bad' }); f.until.focus(); return false; }
          const it = Object.assign({}, ev || {}, { title, date, allDay, start, end, cat: f.cat.value, place: f.place.value.trim(), memo: f.memo.value.trim(), repeat, repeatUntil: until });
          delete it.sample;
          if (isNew) { S.cursor = S.sel = date; }
          await Kit.store.put('events', it);
          Kit.toast(isNew ? md(date) + 'に予定を入れました' : '予定を保存しました');
          return true;
        };
        const del = async () => {
          const ok = await Kit.confirm({ title: 'この予定を消しますか？', body: ev.repeat && ev.repeat !== 'none' ? '「' + ev.title + '」はくり返しの予定なので、すべての回が消えます。' : '「' + ev.title + '」を消します。', ok: '消す', danger: true });
          if (!ok) return false;
          await Kit.store.remove('events', ev.id);
          Kit.toast('予定を消しました', { action: { label: '元に戻す', onClick: () => Kit.store.put('events', ev) } });
          return true;
        };
        const actions = (isNew ? [] : [{ label: '消す', kind: 'danger', onClick: del }]).concat([{ label: 'やめる', kind: 'ghost' }, { label: isNew ? '追加する' : '保存する', kind: 'primary', onClick: save }]);
        const m = Kit.modal({ title: isNew ? '予定を追加' : '予定を直す', body, actions });
        const delBtn = m.el.querySelector('.modal-f .btn.danger');
        if (delBtn) delBtn.style.marginRight = 'auto';
        f.title.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); save().then((r) => { if (r) m.close(); }); } });
      }

      // その日の予定をまとめて（月の「ほか◯件」）
      function openDay(s) {
        const list = itemsBetween(s, s), hol = holiday(s);
        const box = h('div', { class: 'cal-ag-items' }, list.map(agItem));
        const m = Kit.modal({
          title: Kit.fmtDate(s, 'M月D日(W)') + (hol ? '　' + hol : ''), body: box,
          actions: [{ label: '閉じる', kind: 'ghost' }, { label: 'この日に予定を追加', kind: 'primary', onClick: () => { setTimeout(() => openEvent(null, { date: s }), 0); } }],
        });
        box.addEventListener('click', (e) => { const b = e.target.closest('[data-key]'); if (!b) return; const it = S.map.get(b.dataset.key); m.close(); setTimeout(() => openItem(it), 0); });
      }

      /* ── 書き出し・読み込み ── */
      function exportList(range_, withOthers, expand) {
        const t = todayS();
        const ds = S.events.flatMap((e) => [e.date, e.repeatUntil]).filter(isYmd).sort();
        const from = range_ === 'future' ? t : (ds[0] && ds[0] < t ? ds[0] : t);
        const far = add(t, 365), to = ds.length && ds[ds.length - 1] > far ? ds[ds.length - 1] : far;
        let list = expand
          ? occurrences(S.events, from, to).map((o) => Object.assign({}, o, { date: o.occ, uid: o.id + '-' + d8(o.occ) }))
          : S.events.filter((e) => isYmd(e.date) && (range_ !== 'future' || (e.repeat === 'weekly' || e.repeat === 'monthly' ? !e.repeatUntil || e.repeatUntil >= t : e.date >= t)));
        list = list.map((e) => Object.assign({}, e, { title: e.title || '（名前なし）', cat: catOf(e.cat) }));
        if (withOthers) list = list.concat(externals(from, to).map((x) => Object.assign({}, x, { uid: x.key, memo: [x.memo, x.src + 'から'].filter(Boolean).join('\n') })));
        return list.sort((a, b) => (a.date + (a.start || '')).localeCompare(b.date + (b.start || '')));
      }
      function openIO() {
        const rangeSel = h('select', { id: 'cal-io-range' }, h('option', { value: 'future' }, '今日から先の予定'), h('option', { value: 'all' }, 'すべての予定'));
        const others = h('input', { type: 'checkbox', id: 'cal-io-others' });
        const csv = async () => {
          const list = exportList(rangeSel.value, others.checked, true);
          if (!list.length) { Kit.toast('書き出す予定がありません', { type: 'bad' }); return; }
          if (await Kit.download('calendar-' + todayS() + '.csv', googleCsv(list))) Kit.toast(list.length + '件の予定を書き出しました');
        };
        const ics = async () => {
          const list = exportList(rangeSel.value, others.checked, false);
          if (!list.length) { Kit.toast('書き出す予定がありません', { type: 'bad' }); return; }
          const p = await Kit.profile.get();
          if (await Kit.download('calendar-' + todayS() + '.ics', toIcs(list, (p.school && !p._sample ? p.school : '先生の道具箱') + 'の予定'))) Kit.toast(list.length + '件の予定を書き出しました');
        };
        const file = h('input', { type: 'file', id: 'cal-ics-file', accept: '.ics,text/calendar', hidden: true });
        const drop = h('div', { class: 'cal-drop' }, Kit.icon('upload'), h('span', null, '.ics ファイルをここに落とすか'), Kit.btn('ファイルを選ぶ', () => file.click(), { sm: true }), file);
        let m = null;
        const take = (fl) => { if (!fl) return; if (m) m.close(); importIcs(fl); };
        file.addEventListener('change', () => take(file.files && file.files[0]));
        drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('is-over'); });
        drop.addEventListener('dragleave', () => drop.classList.remove('is-over'));
        drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('is-over'); take(e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]); });
        const body = h('div', { class: 'stack' },
          h('h3', { class: 'small', style: { fontWeight: 700, fontSize: '15px' } }, '書き出す'),
          h('div', { class: 'cal-2col' }, Kit.field({ label: '書き出す範囲', input: rangeSel }), h('div', { class: 'cal-allday' }, h('label', { class: 'check', for: 'cal-io-others' }, others, 'リマインダー・宿題の締切もふくめる'))),
          h('div', { class: 'btn-row' },
            Kit.btn('Googleカレンダー用CSV', csv, { kind: 'primary', icon: 'download' }),
            Kit.canDownload('ics') ? Kit.btn('.ics ファイル', ics, { icon: 'download' }) : null),
          Kit.canDownload('ics') ? null : h('p', { class: 'small muted' }, '.ics の書き出しは、手元のブラウザで開いたときに使えます。'),
          h('details', { class: 'help' }, h('summary', null, 'Googleカレンダーへの取り込み方'),
            h('ol', null,
              h('li', null, 'パソコンのブラウザで Googleカレンダーを開きます（スマホのアプリからは取り込めません）。'),
              h('li', null, '右上の歯車 →「設定」→ 左の「インポート / エクスポート」を開きます。'),
              h('li', null, '書き出したファイルを選び、入れるカレンダーを選んで「インポート」を押します。'),
              h('li', null, 'CSV ではくり返しの予定を1回ずつに分けます（終わりのないものは1年先まで）。'))),
          h('hr', { class: 'divider' }),
          h('h3', { class: 'small', style: { fontWeight: 700, fontSize: '15px' } }, '読み込む（.ics）'),
          h('p', { class: 'small ink-2' }, 'Googleカレンダーなどで書き出した .ics ファイルから、予定を取りこみます。読み込む前に中身を確かめられます。'),
          drop);
        m = Kit.modal({ title: '書き出し・読み込み', body, actions: [{ label: '閉じる', kind: 'ghost' }] });
      }
      async function importIcs(fl) {
        let text = '';
        try { text = await fl.text(); } catch (e) { Kit.toast('ファイルを読めませんでした', { type: 'bad' }); return; }
        const found = parseIcs(text);
        if (!found.length) { Kit.toast('予定が見つかりませんでした。.ics のファイルか確かめてください', { type: 'bad' }); return; }
        await previewImport(found, { title: '.ics から読み込む', onDone: (d) => { S.cursor = S.sel = d; } });
      }

      /* ── 年間行事をまとめて追加 ── */
      async function openBulk() {
        const p = await Kit.profile.get();
        let year = p.year;
        const ta = h('textarea', { id: 'cal-bulk', rows: 9, placeholder: '例）\n4/7(火) 始業式\n4/8 入学式\n4/20〜4/24 家庭訪問\n5/19 9:00 体育祭\n（学校の年間行事予定を、Excel などからそのままコピーして貼り付けられます）' });
        const prev = h('p', { class: 'small ink-2', 'aria-live': 'polite' });
        const yIn = h('input', { type: 'number', id: 'cal-bulk-year', value: year, min: 2000, max: 2099, style: { width: '6.5em' } });
        const show = () => { const r = bulkParse(ta.value, +yIn.value || year); prev.textContent = ta.value.trim() ? r.items.length + '件の予定を読み取りました' + (r.skipped.length ? '（日付が読めない行：' + r.skipped.length + '）' : '') + '。' : '1行に1つ。「4/7 始業式」「4月20日〜24日 家庭訪問」「5/19 9:00 体育祭」のような形を読めます。年のない日付は、年度（4月〜翌3月）に合わせます。'; };
        ta.addEventListener('input', show); yIn.addEventListener('input', show); show();
        Kit.modal({
          title: '年間行事をまとめて追加', wide: true, autofocus: 'input',
          body: h('div', { class: 'stack' }, Kit.field({ label: '年間行事（1行に1つ）', input: ta }), prev, h('div', { class: 'row' }, h('label', { for: 'cal-bulk-year', class: 'small ink-2' }, '年度'), yIn, h('span', { class: 'small muted' }, '年度（4月〜翌年3月）'))),
          actions: [{ label: 'やめる', kind: 'ghost' }, {
            label: '確かめる', kind: 'primary', onClick: () => {
              const r = bulkParse(ta.value, +yIn.value || year);
              if (!r.items.length) { Kit.toast('予定を読み取れませんでした。「4/7 始業式」のように書いてください', { type: 'bad' }); return false; }
              setTimeout(() => previewImport(r.items, { title: 'まとめて追加', keepPast: true, intro: r.items.length + '件の予定を読み取りました。種類（色）は名前から決めています。ちがっていたら直してから追加してください。' + (r.skipped.length ? '（読めなかった行：' + r.skipped.slice(0, 3).join('／') + (r.skipped.length > 3 ? ' ほか' : '') + '）' : ''), okLabel: '追加する', onDone: (d) => { S.cursor = S.sel = d; } }), 0);
              return true;
            },
          }],
        });
      }

      /* ── 共有する ── */
      async function openShare() {
        const p = await Kit.profile.get();
        let span = 'month3';
        const hide = new Set(['private']);
        const memo = h('input', { type: 'checkbox', id: 'cal-sh-memo' });
        const count = h('p', { class: 'small ink-2', 'aria-live': 'polite' });
        const pick = () => {
          const t = todayS();
          const to = span === 'month' ? Kit.ymd(new Date(Kit.parseYmd(t).getFullYear(), Kit.parseYmd(t).getMonth() + 1, 0)) : span === 'month3' ? add(t, 92) : '9999-12-31';
          return S.events.filter((e) => !e.sample && !hide.has(catOf(e.cat)) && (e.repeat && e.repeat !== 'none' ? (!e.repeatUntil || e.repeatUntil >= t) && e.date <= to : e.date >= t && e.date <= to));
        };
        const upd = () => { const n = pick().length; count.textContent = n ? n + '件の予定を共有します。' : '共有する予定がありません（サンプルの予定は共有されません）。'; };
        const cats = h('div', { class: 'row' }, CATS.map((c) => { const cb = h('input', { type: 'checkbox', id: 'cal-sh-' + c.id, checked: !hide.has(c.id), onchange: () => { if (cb.checked) hide.delete(c.id); else hide.add(c.id); upd(); } }); return h('label', { class: 'check small', for: 'cal-sh-' + c.id }, cb, c.label); }));
        upd();
        Kit.modal({
          title: '予定を共有する', wide: true,
          body: h('div', { class: 'stack' },
            Kit.field({ label: '期間', input: Kit.seg([{ value: 'month', label: '今月' }, { value: 'month3', label: 'これから3か月' }, { value: 'all', label: 'これから全部' }], span, (v) => { span = v; upd(); }, { label: '期間' }) }),
            Kit.field({ label: '共有する種類', input: cats }),
            h('label', { class: 'check small', for: 'cal-sh-memo' }, memo, 'メモもふくめる'),
            count,
            h('p', { class: 'small muted' }, '共有は、そのときの予定を写して渡すしくみです（あとで直しても、相手の予定は変わりません）。学年で同じ予定をずっと見たいときは、学年の Googleカレンダーを1つつくり、「書き出し・読み込み」の .ics を取り込むのが確実です。')),
          actions: [{ label: 'やめる', kind: 'ghost' }, {
            label: '次へ', kind: 'primary', onClick: () => {
              const list = pick();
              if (!list.length) { Kit.toast('共有する予定がありません', { type: 'bad' }); return false; }
              const items = list.map((e) => ({ title: e.title, date: e.date, allDay: !!e.allDay || !e.start, start: e.start || '', end: e.end || '', cat: catOf(e.cat), place: e.place || '', memo: memo.checked ? e.memo || '' : '', repeat: e.repeat || 'none', repeatUntil: e.repeatUntil || '' }));
              setTimeout(() => School.share.open(School.share.pack('events', items, { title: '予定', from: p._sample ? '' : p.teacher }), { what: '予定' }), 0);
              return true;
            },
          }],
        });
      }

      /* ── 読み込み・描きなおし・あとかたづけ ── */
      await load();
      renderAll();
      if (params && isYmd(params.date) && S.view === 'month' && !compact()) {
        const cell = viewBox.querySelector('.cal-day[data-date="' + params.date + '"]');
        if (cell) cell.scrollIntoView({ block: 'nearest' });
      }
      const reload = Kit.debounce(async () => { await load(); renderAll(); }, 60);
      const offs = ['coll:events', 'coll:reminders', 'coll:homework', 'coll:classes', 'doc:calendar'].map((k) => Kit.store.on(k, reload));
      const onMq = () => { renderBar(); renderView(); };
      mq.addEventListener('change', onMq);
      // 「今」の線を1分ごとに動かす
      const timer = setInterval(() => {
        for (const el of viewBox.querySelectorAll('.cal-now')) { const RH = compact() ? 40 : 44, top = nowTop(RH); if (top == null) el.remove(); else el.style.top = top + 'px'; }
      }, 60000);
      return () => { offs.forEach((f) => f()); reload.cancel(); mq.removeEventListener('change', onMq); clearInterval(timer); };
    },
  });

  // ほかのアプリやテストから使える小物（祝日・くり返しの展開・読み取り）
  window.SenseiCalendar = { CATS, holiday, occurrences, parseQuick, guessCat, googleCsv, toIcs, parseIcs, googleLink, previewImport, withSchoolYear, bulkParse };
})();

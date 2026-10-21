/* 道具箱の利用状況（usage-admin.html）：管理キーで sensei_usage の記録を読み、画面の中で集計する。
   キーはこのタブの中だけに覚える（sessionStorage）。記録は「だれ（LINE の表示名・リンクのコード）× 道具 × 操作 × 日時」だけ。 */
(function () {
  'use strict';
  const CFG = window.SENSEI_CONFIG || {};
  const BASE = String(CFG.supabaseUrl || '').replace(/\/+$/, '');
  const $ = (s) => document.querySelector(s);
  const el = (tag, attrs, ...kids) => { const e = document.createElement(tag); for (const k in attrs || {}) { const v = attrs[k]; if (v == null || v === false) continue; if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v); } for (const c of kids.flat(Infinity)) if (c != null && c !== false) e.append(c instanceof Node ? c : String(c)); return e; };
  const APPS = { kit: '道具箱を開いた', home: 'ホーム', roster: '名簿', seats: '席替え', roulette: 'ルーレット', roles: '係決め', duty: '当番表', timetable: '時間割', homework: '宿題・提出', calendar: 'カレンダー', reminders: 'リマインダー', newsletter: '学級通信', templates: '連絡テンプレート', flyer: 'チラシ', 'lesson-plan': '指導案', 'image-prompt': '画像生成プロンプト', 'beta-grades': '成績（β）', 'beta-mendan': '面談の日程（β）', 'beta-video': '動画編集（β）' };
  const ACTS = { open: '開いた', start: '開いた', run: '席替えをした', save: '保存した', print: '印刷', word: 'Word に書き出し', create: '新しく作った', spin: '回した', copy: 'コピー', paste: '名簿を入れた', add: '追加した', backup: 'バックアップ', move: 'ほかの端末へ移す', show: '発表した', 'demo-start': '使い方のデモを見た', 'demo-done': 'デモを最後まで見た' };
  const appName = (a) => APPS[a] || a;
  const actName = (a) => ACTS[a] || a;
  let KEY = '';
  try { KEY = sessionStorage.getItem('sensei:usage:admin') || ''; } catch (e) { /* noop */ }

  async function rpc(name, body) {
    const r = await fetch(BASE + '/rest/v1/rpc/' + name, { method: 'POST', credentials: 'omit', cache: 'no-store',
      headers: { apikey: CFG.supabaseKey, Authorization: 'Bearer ' + CFG.supabaseKey, 'Content-Type': 'application/json', 'Content-Profile': 'sensei_usage', 'Accept-Profile': 'sensei_usage' },
      body: JSON.stringify(body) });
    const out = await r.json().catch(() => null);
    if (!r.ok) throw new Error((out && out.message) || 'HTTP ' + r.status);
    if (out && out.ok === false) throw new Error(out.error === 'bad_key' ? '管理キーがちがいます' : out.error);
    return out;
  }
  const fmt = (t) => { const d = new Date(t * 1000); return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  const kpi = (label, value, sub) => el('div', { class: 'kpi' }, el('span', { class: 'kpi-label' }, label), el('span', { class: 'kpi-value' }, value), sub ? el('span', { class: 'kpi-sub' }, sub) : null);

  let days = 30, data = null, status = null;
  async function load() {
    $('#ua-err').textContent = '';
    try {
      status = await rpc('admin_status', { p_key: KEY });
      const since = days ? new Date(Date.now() - days * 86400000).toISOString() : null;
      data = await rpc('admin_events', { p_key: KEY, p_since: since, p_limit: 20000 });
      try { sessionStorage.setItem('sensei:usage:admin', KEY); } catch (e) { /* noop */ }
      $('#ua-key').hidden = true;
      draw();
    } catch (e) { $('#ua-err').textContent = String(e.message || e); }
  }

  function draw() {
    const body = $('#ua-body'); body.hidden = false; body.textContent = '';
    const names = new Map((data.people || []).map((p) => [p.id, p.name || '（名前なし）']));
    const ev = (data.events || []).map(([t, u, c, app, action, n, dev]) => ({ t, who: u ? 'u:' + u : 'c:' + c, label: u ? names.get(u) || u.slice(0, 8) : 'リンク ' + c, kind: u ? 'LINE' : 'コード', app, action, n, dev }));
    const whoCount = new Set(ev.map((e) => e.who)).size;
    body.append(el('div', { class: 'ua-bar' },
      el('span', { class: 'small ink-2' }, '期間'),
      ...[7, 30, 90, 0].map((d) => el('button', { type: 'button', class: 'btn sm' + (d === days ? ' primary' : ''), onclick: () => { days = d; load(); } }, d ? 'この' + d + '日' : 'ぜんぶ')),
      el('span', { class: 'grow' }),
      el('button', { type: 'button', class: 'btn sm', onclick: csv }, 'CSV で書き出す'),
      el('button', { type: 'button', class: 'btn sm ghost', onclick: toggle }, status.logging ? '記録を止める' : '記録を再開する'),
      el('button', { type: 'button', class: 'btn sm ghost', onclick: () => { KEY = ''; try { sessionStorage.removeItem('sensei:usage:admin'); } catch (e) { /* noop */ } location.reload(); } }, 'キーを忘れる')));
    body.append(el('div', { class: 'ua-kpis' },
      kpi('使った人', String(whoCount), 'LINE ' + new Set(ev.filter((e) => e.kind === 'LINE').map((e) => e.who)).size + '・リンク ' + new Set(ev.filter((e) => e.kind === 'コード').map((e) => e.who)).size),
      kpi('記録', String(ev.reduce((s, e) => s + e.n, 0)), '行 ' + ev.length + (data.events.length >= 20000 ? '（多いので新しい 20000 行まで）' : '')),
      kpi('今日', String(status.today), status.logging ? '記録中' : '止めています'),
      kpi('ぜんぶの記録', String(status.events), '断った数（7日）' + status.refused_7d)));

    // 道具ごと：使った人の数・回数・主な操作
    const byApp = new Map();
    for (const e of ev) {
      if (e.app === 'kit') continue;
      const a = byApp.get(e.app) || { people: new Set(), n: 0, acts: new Map() };
      a.people.add(e.who); a.n += e.n; a.acts.set(e.action, (a.acts.get(e.action) || 0) + e.n);
      byApp.set(e.app, a);
    }
    const apps = [...byApp.entries()].sort((x, y) => y[1].people.size - x[1].people.size || y[1].n - x[1].n);
    const maxP = Math.max(1, ...apps.map(([, a]) => a.people.size));
    const appCard = el('section', { class: 'card' }, el('div', { class: 'card-h' }, el('h2', null, '道具ごと（使った人の数）')),
      apps.length ? apps.map(([id, a]) => el('div', null,
        el('div', { class: 'meterline' }, el('span', null, appName(id)), el('div', { class: 'meter' }, el('i', { style: 'width:' + Math.round(a.people.size / maxP * 100) + '%' })), el('b', null, a.people.size + '人')),
        el('div', { class: 'chips', style: 'margin:0 0 6px 9.5em' }, [...a.acts.entries()].sort((x, y) => y[1] - x[1]).slice(0, 5).map(([k, n]) => el('span', { class: 'chip' }, actName(k) + ' ' + n))))) : el('p', { class: 'small muted' }, 'まだ記録がありません。'));

    // 人ごと
    const byWho = new Map();
    for (const e of ev) {
      const w = byWho.get(e.who) || { label: e.label, kind: e.kind, last: 0, days: new Set(), apps: new Map(), n: 0 };
      w.last = Math.max(w.last, e.t); w.days.add(new Date(e.t * 1000).toDateString()); w.n += e.n;
      if (e.app !== 'kit') w.apps.set(e.app, (w.apps.get(e.app) || 0) + e.n);
      byWho.set(e.who, w);
    }
    const people = [...byWho.entries()].sort((x, y) => y[1].last - x[1].last);
    const detail = el('div', { class: 'detail' });
    const tbody = el('tbody', null, people.map(([key, w]) => el('tr', null,
      el('td', null, el('span', { class: 'who' }, w.label), el('div', { class: 'tiny muted' }, w.kind)),
      el('td', { class: 'num' }, fmt(w.last)),
      el('td', { class: 'r' }, String(w.days.size)),
      el('td', null, el('div', { class: 'chips' }, [...w.apps.entries()].sort((x, y) => y[1] - x[1]).slice(0, 6).map(([a, n]) => el('span', { class: 'chip' }, appName(a) + ' ' + n)))),
      el('td', null, el('button', { type: 'button', class: 'btn sm ghost', onclick: () => showWho(key, w, ev, detail) }, 'くわしく')))));
    const peopleCard = el('section', { class: 'card' }, el('div', { class: 'card-h' }, el('h2', null, '人ごと（新しい順）')),
      people.length ? el('div', { class: 'tbl-wrap' }, el('table', { class: 'tbl' }, el('thead', null, el('tr', null, ['だれ', '最後', '日数', 'よく使った道具', ''].map((t) => el('th', null, t)))), tbody)) : el('p', { class: 'small muted' }, 'まだ記録がありません。'),
      detail);
    body.append(el('div', { class: 'ua-grid' }, appCard, peopleCard));
    body.append(el('p', { class: 'small muted', style: 'margin-top:14px' }, '「リンク」の人がだれかは、line-hub の管理画面（リンク → 押した人）のコードで分かります。'));
  }

  function showWho(key, w, ev, box) {
    box.textContent = '';
    const mine = ev.filter((e) => e.who === key).slice(0, 200);
    box.append(el('h3', { class: 'small', style: 'font-weight:700;margin:6px 0' }, w.label + ' の記録（新しい 200 件まで）'),
      el('div', { class: 'tbl-wrap' }, el('table', { class: 'tbl' }, el('tbody', null, mine.map((e) => el('tr', null, el('td', { class: 'num' }, fmt(e.t)), el('td', null, appName(e.app)), el('td', null, actName(e.action)), el('td', { class: 'r' }, e.n > 1 ? '×' + e.n : '')))))),
      el('div', { class: 'btn-row', style: 'margin-top:8px' }, el('button', { type: 'button', class: 'btn sm danger', onclick: () => forget(key, w) }, 'この人の記録を消す')));
  }
  async function forget(key, w) {
    if (!confirm(w.label + ' の記録を、すべて消します。元に戻せません。よろしいですか？')) return;
    try {
      const [t, id] = [key.slice(0, 1), key.slice(2)];
      await rpc('admin_forget', { p_key: KEY, p_line_user_id: t === 'u' ? id : null, p_code: t === 'c' ? id : null });
      load();
    } catch (e) { $('#ua-err').textContent = String(e.message || e); }
  }
  async function toggle() { try { await rpc('admin_set_logging', { p_key: KEY, p_enabled: !status.logging }); load(); } catch (e) { $('#ua-err').textContent = String(e.message || e); } }
  function csv() {
    const names = new Map((data.people || []).map((p) => [p.id, p.name || '']));
    const rows = [['日時', '種類', 'だれ', 'LINE の ID', 'コード', '道具', '操作', '回数']].concat((data.events || []).map(([t, u, c, app, action, n]) => [new Date(t * 1000).toISOString(), u ? 'LINE' : 'コード', u ? names.get(u) || '' : '', u || '', c || '', appName(app), actName(action), n]));
    const text = '﻿' + rows.map((r) => r.map((v) => { const s = String(v == null ? '' : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',')).join('\r\n');
    const a = el('a', { href: URL.createObjectURL(new Blob([text], { type: 'text/csv' })), download: 'sensei-kit-usage.csv' });
    document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  $('#ua-key').addEventListener('submit', (e) => { e.preventDefault(); KEY = $('#ua-k').value.trim(); load(); });
  if (KEY) load();
})();

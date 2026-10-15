/* 先生の道具箱 — 共通の土台（どのアプリもこれを使う）
   みせびらき（math-dialogue/startup-kit）の kit.js を写して、学校向けに直したもの。
   アプリの書き方・保存のしかたは みせびらき と同じなので、アプリを行き来させられる。
   ・保存       Kit.store … Artifact で開いたときは db（アカウントに保存・端末をまたいで同じ内容）、
                            手元のブラウザで開いたときは localStorage。アプリ側はどちらか気にしなくてよい
   ・画面       Kit.app / Kit.go … #calendar のようなハッシュで切り替える
   ・部品       Kit.h / Kit.toast / Kit.modal / Kit.confirm / Kit.ask / Kit.appHead …
   ・書き出し   Kit.download … Artifact では downloads、手元では <a download>
   ・AI         Kit.ai … Artifact の sample。使えない画面では .ai-only の部品ごと隠れる
   ・グラフ     Kit.chart / QR … Kit.qr / 画像 … Kit.img / 日付の書式 … Kit.ymd, Kit.fmtDate …
   ・学校       Kit.profile … 学校・学年・年度などの設定（みせびらき の「事業プロフィール」のかわり）
   アプリの書き方は README.md の「ツールを足す・直すときの約束」を参照。 */
(function () {
  'use strict';

  const Kit = (window.Kit = {});
  const clone = (v) => (v === undefined ? undefined : typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v)));

  /* ───────── 動いている場所 ───────── */
  const env = (Kit.env = {
    artifact: !!(window.claude && typeof window.claude.use === 'function'),
    file: location.protocol === 'file:',
  });
  document.documentElement.classList.toggle('is-artifact', env.artifact);

  const cap = (Kit.cap = { db: null, user: null, sample: null, downloads: null });
  const capPromises = {};
  function use(name) {
    if (!env.artifact) return Promise.resolve(null);
    if (!capPromises[name]) {
      capPromises[name] = Promise.race([
        Promise.resolve().then(() => window.claude.use(name)).catch(() => null),
        new Promise((r) => setTimeout(() => r(null), 12000)),
      ]).then((ns) => (cap[name] = ns || null));
    }
    return capPromises[name];
  }
  Kit.use = use;

  /* ───────── 小物 ───────── */
  Kit.uid = (p) => (p ? p + '-' : '') + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  // 待ってから1回だけ呼ぶ。flush() で待たずに今すぐ（待っているものがあれば）、cancel() で取り消し
  Kit.debounce = (fn, ms = 300) => {
    let t = 0, args = null;
    const d = (...a) => { args = a; clearTimeout(t); t = setTimeout(() => { const x = args; args = null; fn(...x); }, ms); };
    d.cancel = () => { clearTimeout(t); args = null; };
    d.flush = () => { if (!args) return undefined; clearTimeout(t); const x = args; args = null; return fn(...x); };
    return d;
  };
  Kit.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  Kit.clone = clone;
  Kit.clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  Kit.sum = (arr, f = (x) => x) => arr.reduce((s, x) => s + (Number(f(x)) || 0), 0);

  // お金・数
  const nf = new Intl.NumberFormat('ja-JP');
  Kit.num = (n, d = 0) => (Number.isFinite(+n) ? (+n).toLocaleString('ja-JP', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—');
  Kit.yen = (n) => (Number.isFinite(+n) ? (n < 0 ? '−¥' : '¥') + nf.format(Math.round(Math.abs(n))) : '—');
  // 4桁ごとの日本式の短縮（¥12.5万・¥1.2億）
  Kit.yenShort = (n) => {
    if (!Number.isFinite(+n)) return '—';
    const a = Math.abs(n), s = n < 0 ? '−' : '';
    if (a >= 1e8) return s + '¥' + trim(a / 1e8) + '億';
    if (a >= 1e4) return s + '¥' + trim(a / 1e4) + '万';
    return s + '¥' + nf.format(Math.round(a));
  };
  const trim = (x) => (x >= 100 ? Math.round(x).toString() : (Math.round(x * 10) / 10).toString());
  Kit.pct = (x, d = 0) => (Number.isFinite(+x) ? (x * 100).toFixed(d) + '%' : '—');

  // 日付（すべて端末の時刻で。保存は 'YYYY-MM-DD' の文字列）
  const pad = (n) => String(n).padStart(2, '0');
  Kit.WDAY = ['日', '月', '火', '水', '木', '金', '土'];
  Kit.today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  Kit.ymd = (d = new Date()) => { d = d instanceof Date ? d : Kit.parseYmd(d); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  Kit.ym = (d = new Date()) => { d = d instanceof Date ? d : Kit.parseYmd(d); return d.getFullYear() + '-' + pad(d.getMonth() + 1); };
  Kit.parseYmd = (s) => {
    if (s instanceof Date) return new Date(s);
    const m = /^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?/.exec(String(s || ''));
    if (!m) return new Date(NaN);
    return new Date(+m[1], +m[2] - 1, m[3] ? +m[3] : 1);
  };
  Kit.addDays = (d, n) => { const x = Kit.parseYmd(d); x.setDate(x.getDate() + n); return x; };
  Kit.addMonths = (d, n) => { const x = Kit.parseYmd(d); const day = x.getDate(); x.setDate(1); x.setMonth(x.getMonth() + n); const last = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate(); x.setDate(Math.min(day, last)); return x; };
  Kit.rel = (n) => Kit.ymd(Kit.addDays(Kit.today(), n)); // 今日から n 日後（サンプルの日付に使う）
  Kit.daysBetween = (a, b) => Math.round((Kit.parseYmd(b) - Kit.parseYmd(a)) / 86400000);
  // 'M/D(曜)' 'YYYY年M月D日' など
  Kit.fmtDate = (d, f = 'M/D(W)') => {
    const x = Kit.parseYmd(d);
    if (isNaN(x)) return '—';
    return f.replace('YYYY', x.getFullYear()).replace('MM', pad(x.getMonth() + 1)).replace('DD', pad(x.getDate()))
      .replace('M', x.getMonth() + 1).replace('D', x.getDate()).replace('W', Kit.WDAY[x.getDay()]);
  };
  Kit.fmtDateTime = (iso) => { if (!iso) return '—'; const d = new Date(iso); if (isNaN(d)) return '—'; return (d.getMonth() + 1) + '/' + d.getDate() + '(' + Kit.WDAY[d.getDay()] + ') ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  Kit.ago = (iso) => {
    const t = new Date(iso).getTime(); if (!t) return '';
    const s = (Date.now() - t) / 1000;
    if (s < 60) return 'たった今'; if (s < 3600) return Math.floor(s / 60) + '分前';
    if (s < 86400) return Math.floor(s / 3600) + '時間前'; if (s < 86400 * 30) return Math.floor(s / 86400) + '日前';
    return Kit.fmtDate(new Date(t), 'YYYY/M/D');
  };

  // CSV（Excel で文字化けしないよう BOM 付き）
  Kit.csv = (rows) => '﻿' + rows.map((r) => r.map((c) => { const s = String(c == null ? '' : c); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',')).join('\r\n');
  Kit.parseCsv = (text) => {
    const rows = []; let row = [], cell = '', q = false;
    text = String(text || '').replace(/^﻿/, '');
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
      else if (c === '"') q = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += c;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows.filter((r) => r.some((c) => c.trim() !== ''));
  };

  // 端末ごとの好み（最後に開いたタブなど）。消えても困らないものだけ
  Kit.pref = {
    get(k, d) { try { const v = localStorage.getItem('sensei:pref:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('sensei:pref:' + k, JSON.stringify(v)); } catch (e) { /* 保存できなくても動く */ } },
  };

  /* ───────── DOM 部品 ───────── */
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k === 'dataset') Object.assign(el.dataset, v);
        else if (k === 'html') el.innerHTML = v;
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
        else if (typeof v !== 'string' && k in el) el[k] = v;
        else if (v === true) el.setAttribute(k, '');
        else el.setAttribute(k, v);
      }
    }
    add(el, kids);
    return el;
  }
  function add(el, kids) {
    for (const k of kids.flat(Infinity)) {
      if (k == null || k === false || k === true) continue;
      el.append(k instanceof Node ? k : String(k));
    }
    return el;
  }
  Kit.h = h;
  Kit.add = add;
  Kit.clear = (el) => { while (el.firstChild) el.firstChild.remove(); return el; };
  Kit.$ = (sel, root = document) => root.querySelector(sel);
  Kit.$$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const injected = new Set();
  Kit.css = (id, text) => {
    if (injected.has(id)) return;
    injected.add(id);
    document.head.append(h('style', { 'data-app': id }, text));
  };

  // アイコン（24×24 の線画）
  const ICONS = {
    home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
    globe: 'M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18zM3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z',
    edit: 'M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4',
    layout: 'M4 4h16v16H4zM4 9h16M9 9v11',
    film: 'M4 5h16v14H4zM8 5v14M16 5v14M4 9h4M4 15h4M16 9h4M16 15h4',
    calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
    inbox: 'M4 13l2.5-8h11L20 13v6H4zM4 13h5l1 2h4l1-2h5',
    megaphone: 'M4 10v4h3l7 4V6L7 10H4zM17 9.5a3 3 0 0 1 0 5M7 14l1 5h2.5l-1-4.4',
    yen: 'M6 4l6 8 6-8M12 12v8M8 13h8M8 16.5h8',
    receipt: 'M6 3h12v18l-2-1.5L14 21l-2-1.5L10 21l-2-1.5L6 21zM9 8h6M9 12h6M9 16h4',
    canvas: 'M3 4h18v16H3zM9 4v10M15 4v10M3 14h18M12 14v6',
    flag: 'M5 21V4M5 4h11l-2 4 2 4H5',
    plus: 'M12 5v14M5 12h14',
    minus: 'M5 12h14',
    trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
    download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
    upload: 'M12 20V9M7 14l5-5 5 5M5 4h14',
    copy: 'M8 8h11v12H8zM5 16V4h11',
    sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z',
    play: 'M7 5l12 7-12 7z',
    pause: 'M8 5v14M16 5v14',
    stop: 'M6 6h12v12H6z',
    scissors: 'M6 4.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM6 14.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM8.2 8.3 20 18M8.2 15.7 20 6',
    text: 'M5 6V4h14v2M12 4v16M9 20h6',
    image: 'M4 5h16v14H4zM4 16l5-5 4 4 2.5-2.5L20 17M15.5 9.5h.01',
    music: 'M9 18V6l10-2v12M6.5 15.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM16.5 13.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
    left: 'M15 5l-7 7 7 7',
    right: 'M9 5l7 7-7 7',
    down: 'M5 9l7 7 7-7',
    up: 'M5 15l7-7 7 7',
    menu: 'M4 7h16M4 12h16M4 17h16',
    close: 'M6 6l12 12M18 6 6 18',
    check: 'M5 12.5l4.5 4.5L19 7',
    sliders: 'M4 7h10M18 7h2M4 17h4M12 17h8M14 4v6M8 14v6',
    phone: 'M8 3h8v18H8zM11 18h2',
    desktop: 'M3 5h18v11H3zM8 20h8M12 16v4',
    eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
    undo: 'M9 5L4 10l5 5M4 10h10a6 6 0 0 1 0 12h-2',
    redo: 'M15 5l5 5-5 5M20 10H10a6 6 0 0 0 0 12h2',
    arrowUp: 'M12 19V5M6 11l6-6 6 6',
    arrowDown: 'M12 5v14M6 13l6 6 6-6',
    external: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
    user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
    mail: 'M3 6h18v12H3zM3 7l9 6 9-6',
    link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
    qr: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2',
    clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
    search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
    filter: 'M4 5h16l-6 8v6l-4-2v-4z',
    star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
    chart: 'M4 20V4M4 20h16M8 16v-5M12 16V8M16 16v-3',
    book: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19V5',
    save: 'M5 4h11l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6',
    refresh: 'M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5',
    grip: 'M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01',
    more: 'M5 12h.01M12 12h.01M19 12h.01',
    info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v6M12 7.5h.01',
    warn: 'M12 4 2.5 20h19zM12 10v4.5M12 17.5h.01',
    lock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
    volume: 'M4 10v4h3l5 4V6l-5 4zM16 9a4 4 0 0 1 0 6',
    layers: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5',
    palette: 'M12 3a9 9 0 0 0 0 18c1.1 0 1.5-.8 1.5-1.5 0-.9-.6-1.2-.6-2 0-.8.7-1.5 1.5-1.5H17a4 4 0 0 0 4-4c0-5-4-9-9-9zM7.5 11.5h.01M10 7.5h.01M15 7.5h.01',
    send: 'M4 12l16-8-6 16-2.5-6.5z',
    store: 'M4 9l1.5-5h13L20 9M4 9v11h16V9M4 9c0 1.7 1.3 3 3 3s3-1.3 3-3c0 1.7 1.3 3 3 3s3-1.3 3-3c0 1.7 1.3 3 3 3M10 20v-5h4v5',
    // ここから 先生の道具箱 で足したもの
    users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14a6 6 0 0 1 3.5 6',
    seats: 'M4 4h6v5H4zM14 4h6v5h-6zM4 15h6v5H4zM14 15h6v5h-6zM7 9v2M17 9v2M7 20v1M17 20v1',
    badge: 'M4 7h16v13H4zM9 7V4h6v3M8 12h8M8 16h5',
    table: 'M3 5h18v15H3zM3 10h18M3 15h18M9 5v15M15 5v15',
    bell: 'M6 16v-5a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0',
    clipboard: 'M9 3h6v3H9zM7 4.5H5V21h14V4.5h-2M9 13l2 2 4-4.5',
    share: 'M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.6 13.5l6.8 4M15.4 6.5l-6.8 4',
    shuffle: 'M4 7h3c5 0 5 10 10 10h3M17 14l3 3-3 3M4 17h3c1.7 0 2.8-1.2 3.7-2.7M13.3 9.7C14.2 8.2 15.3 7 17 7h3M17 4l3 3-3 3',
    printer: 'M7 9V3h10v6M7 17H4V9h16v8h-3M7 14h10v7H7z',
    swap: 'M7 4 4 7l3 3M4 7h13M17 20l3-3-3-3M20 17H7',
    pin: 'M12 16v6M8 3h8l-1 6 3 4H6l3-4z',
    school: 'M3 10 12 4l9 6M5 9v11h14V9M10 20v-5h4v5M12 9.5h.01',
    board: 'M3 4h18v12H3zM8 20l2-4M16 20l-2-4M6 13h5',
    checks: 'M4 4h16v16H4zM8 12l3 3 5-6',
    wand: 'M4 20 15 9M14 4v3M12.5 5.5h3M19 9v3M17.5 10.5h3M18 3l1 1',
    news: 'M4 5h13v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM17 9h3v9a2 2 0 0 1-2 2M7 9h7M7 12.5h7M7 16h4',
    hand: 'M8 13V5.5a1.5 1.5 0 0 1 3 0V11M11 10V4.5a1.5 1.5 0 0 1 3 0V11M14 10.5V6a1.5 1.5 0 0 1 3 0v8a7 7 0 0 1-7 7h-.5a6 6 0 0 1-5-2.7L3 15.5a1.5 1.5 0 0 1 2.4-1.8L8 16',
  };
  const FILLED = new Set(['play', 'stop']);
  const THICK = new Set(['grip', 'more']);
  Kit.icon = (name, size) => {
    const ns = 'http://www.w3.org/2000/svg';
    const s = document.createElementNS(ns, 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('aria-hidden', 'true');
    s.setAttribute('fill', FILLED.has(name) ? 'currentColor' : 'none');
    s.setAttribute('stroke', 'currentColor');
    s.setAttribute('stroke-width', THICK.has(name) ? '3' : '1.8');
    s.setAttribute('stroke-linecap', 'round');
    s.setAttribute('stroke-linejoin', 'round');
    if (size) { s.setAttribute('width', size); s.setAttribute('height', size); }
    const p = document.createElementNS(ns, 'path');
    p.setAttribute('d', ICONS[name] || ICONS.info);
    s.append(p);
    return s;
  };
  Kit.ICONS = ICONS;

  // ボタン：Kit.btn('保存', onClick, {kind:'primary', icon:'save', title})
  Kit.btn = (label, onClick, o = {}) => h('button', {
    type: 'button',
    class: 'btn' + (o.kind ? ' ' + o.kind : '') + (o.sm ? ' sm' : '') + (!label ? ' icon' : '') + (o.class ? ' ' + o.class : ''),
    title: o.title || (!label ? o.label : null), 'aria-label': !label ? (o.title || o.label) : null,
    onclick: onClick, disabled: !!o.disabled,
  }, o.icon ? Kit.icon(o.icon) : null, label ? h('span', null, label) : null);

  Kit.appHead = ({ title, desc, actions }) => h('header', { class: 'app-head' },
    h('div', { class: 'app-title' }, h('h1', null, title), desc ? h('p', { class: 'app-desc' }, desc) : null),
    actions && actions.length ? h('div', { class: 'app-actions' }, actions) : null);

  Kit.field = ({ label, hint, input, id, class: cls }) => {
    if (id && input && !input.id) input.id = id;
    return h('div', { class: 'field' + (cls ? ' ' + cls : '') },
      label ? h('label', { for: input && input.id ? input.id : null }, label) : null, input, hint ? h('div', { class: 'hint' }, hint) : null);
  };

  // 切り替え：Kit.seg([{value:'month',label:'月'}...], 'month', v => ...)
  Kit.seg = (options, value, onChange, o = {}) => {
    const wrap = h('div', { class: 'seg', role: 'group', 'aria-label': o.label || null });
    const set = (v) => { for (const b of wrap.children) b.setAttribute('aria-pressed', String(b.dataset.v === String(v))); };
    for (const op of options) {
      wrap.append(h('button', { type: 'button', 'data-v': String(op.value), onclick: () => { set(op.value); onChange(op.value); } }, op.icon ? Kit.icon(op.icon, 16) : null, op.label));
    }
    set(value);
    wrap.setValue = set;
    return wrap;
  };

  Kit.empty = ({ title, body, actions }) => h('div', { class: 'empty' },
    h('div', { class: 'empty-title' }, title), body ? h('p', { class: 'small' }, body) : null,
    actions && actions.length ? h('div', { class: 'btn-row' }, actions) : null);

  // サンプル表示中の帯。onClear で「サンプルを片付ける」
  Kit.sampleBar = (text, onClear) => h('div', { class: 'sample-bar', role: 'note' },
    h('span', null, h('strong', null, 'サンプル表示中'), '　', text || 'これは架空のクラスの例です。そのまま書きかえて使えます。'),
    onClear ? h('div', { class: 'btn-row' }, Kit.btn('サンプルを片付ける', onClear, { sm: true, kind: 'ghost', icon: 'trash' })) : null);

  /* ───────── 知らせ・ダイアログ（alert / confirm / prompt は使わない） ───────── */
  let toastBox = null;
  Kit.toast = (msg, o = {}) => {
    if (!toastBox) { toastBox = h('div', { class: 'mb-toasts', 'aria-live': 'polite' }); document.body.append(toastBox); }
    const t = h('div', { class: 'toast' + (o.type === 'bad' ? ' bad' : ''), role: o.type === 'bad' ? 'alert' : 'status' }, h('span', null, msg));
    if (o.action) t.append(h('button', { type: 'button', class: 'btn', onclick: () => { o.action.onClick(); t.remove(); } }, o.action.label));
    toastBox.append(t);
    setTimeout(() => t.remove(), o.ms || (o.action ? 6000 : 3200));
  };

  const modalStack = []; // 重なったダイアログ。Escape はいちばん上だけが受け取る
  // autofocus: 'input' … 最初の入力欄に（Kit.ask など）。既定はダイアログ自体（スマホでキーボードが勝手に開かない・下まで飛ばない）
  Kit.modal = ({ title, body, actions, wide, onClose, dismissable = true, autofocus }) => {
    const prevFocus = document.activeElement;
    const box = h('div', { class: 'modal' + (wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': title || null });
    const back = h('div', { class: 'modal-back' }, box);
    let closed = false;
    const close = (v) => {
      if (closed) return; closed = true;
      back.remove(); document.removeEventListener('keydown', onKey, true);
      const i = modalStack.indexOf(back); if (i >= 0) modalStack.splice(i, 1);
      if (prevFocus && prevFocus.focus) try { prevFocus.focus(); } catch (e) { /* noop */ }
      if (onClose) onClose(v);
    };
    const onKey = (e) => { if (e.key === 'Escape' && dismissable && modalStack[modalStack.length - 1] === back) { e.stopPropagation(); close(undefined); } };
    if (title) box.append(h('div', { class: 'modal-h' }, h('h2', null, title), dismissable ? Kit.btn('', () => close(undefined), { icon: 'close', title: '閉じる', kind: 'ghost', sm: true }) : null));
    const b = h('div', { class: 'modal-b' });
    if (body != null) add(b, [typeof body === 'string' ? h('p', null, body) : body]);
    box.append(b);
    if (actions && actions.length) {
      box.append(h('div', { class: 'modal-f' }, actions.map((a) => h('button', {
        type: 'button', class: 'btn' + (a.kind ? ' ' + a.kind : ''),
        onclick: async () => { const r = a.onClick ? await a.onClick() : a.value; if (r !== false) close(r === undefined ? a.value : r); },
      }, a.label))));
    }
    back.addEventListener('mousedown', (e) => { if (e.target === back && dismissable) close(undefined); });
    document.addEventListener('keydown', onKey, true);
    modalStack.push(back);
    document.body.append(back);
    box.tabIndex = -1;
    setTimeout(() => {
      const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
      const f = autofocus === 'input' && !coarse ? b.querySelector('input, textarea, select') : null;
      (f || box).focus({ preventScroll: true });
    }, 30);
    return { el: box, body: b, close };
  };

  Kit.confirm = ({ title, body, ok = 'OK', cancel = 'やめる', danger = false }) => new Promise((resolve) => {
    Kit.modal({ title, body, onClose: (v) => resolve(v === true), actions: [{ label: cancel, value: false, kind: 'ghost' }, { label: ok, value: true, kind: danger ? 'danger' : 'primary' }] });
  });

  Kit.ask = ({ title, label, value = '', placeholder = '', multiline = false, ok = '決定' }) => new Promise((resolve) => {
    const input = multiline ? h('textarea', { placeholder, rows: 5 }) : h('input', { type: 'text', placeholder });
    input.value = value;
    const m = Kit.modal({
      title, body: Kit.field({ label, input, id: 'mb-ask-input' }), autofocus: 'input', onClose: (v) => resolve(v === undefined ? null : v),
      actions: [{ label: 'やめる', value: null, kind: 'ghost' }, { label: ok, kind: 'primary', onClick: () => input.value }],
    });
    if (!multiline) input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); m.close(input.value); } });
  });

  // コピー。できなければ、選べる文字として見せる
  Kit.copy = async (text, okMsg = 'コピーしました') => {
    try { await navigator.clipboard.writeText(text); Kit.toast(okMsg); return true; }
    catch (e) {
      const ta = h('textarea', { rows: 8, readonly: true });
      ta.value = text;
      Kit.modal({ title: 'コピーしてください', body: h('div', { class: 'stack' }, h('p', { class: 'small muted' }, '自動でコピーできなかったので、下の文字を選んでコピーしてください。'), ta), actions: [{ label: '閉じる', kind: 'primary' }] });
      setTimeout(() => { ta.focus(); ta.select(); }, 60);
      return false;
    }
  };

  /* ───────── 保存（Kit.store） ─────────
     ひとつもの（doc）  … get(key) / set(key, value)              例：profile, site, plan
     ならぶもの（coll） … list(name) / put(name, item) / remove()    例：leads, events, invoices
     サンプル … 初めて開いたときは sample を見せ、最初に書きかえた時点で保存する（勝手には書かない）。 */
  const META = 'meta';
  const known = { docs: new Set(['profile', 'meta']), colls: new Set(['images']) };
  const cache = { docs: new Map(), colls: new Map() };
  const virtual = new Map(); // サンプルを見せているだけのコレクション
  const samples = new Map(); // 登録されたサンプル（doc / coll の名前 → 値）
  const listeners = new Map();
  let backend = null;
  let meta = { samplesOff: false, touched: {} };

  function emit(key) {
    for (const k of [key, '*']) {
      const set = listeners.get(k);
      if (set) for (const fn of [...set]) { try { fn(key); } catch (e) { console.error(e); } }
    }
  }

  // 手元（localStorage）。使えないときはメモリだけ（閉じると消える）
  function localBackend() {
    const P = 'sensei:';
    const mem = new Map();
    let ok = true;
    try { localStorage.setItem(P + '__t', '1'); localStorage.removeItem(P + '__t'); } catch (e) { ok = false; }
    let warned = false;
    const read = (k) => { if (!ok) return clone(mem.get(k)); try { const s = localStorage.getItem(P + k); return s == null ? undefined : JSON.parse(s); } catch (e) { return clone(mem.get(k)); } };
    const write = (k, v) => {
      if (!ok) { mem.set(k, clone(v)); return; }
      try { if (v === undefined) localStorage.removeItem(P + k); else localStorage.setItem(P + k, JSON.stringify(v)); }
      catch (e) {
        mem.set(k, clone(v));
        if (!warned) { warned = true; Kit.toast('このブラウザの保存容量がいっぱいです。古い記録を消すか、ホームからバックアップを書き出してください', { type: 'bad', ms: 8000 }); }
      }
    };
    return {
      mode: ok ? 'local' : 'memory',
      async getDoc(key) { return read('d:' + key); },
      async setDoc(key, v) { write('d:' + key, v); },
      async delDoc(key) { write('d:' + key, undefined); },
      async listColl(name) { const o = read('c:' + name) || {}; return Object.values(o); },
      async putItem(name, item) { const o = read('c:' + name) || {}; o[item.id] = item; write('c:' + name, o); },
      async delItem(name, id) { const o = read('c:' + name) || {}; delete o[id]; write('c:' + name, o); },
      async clearColl(name) { write('c:' + name, undefined); },
      watch() {
        window.addEventListener('storage', (e) => {
          if (!e.key || !e.key.startsWith(P)) return;
          const rest = e.key.slice(P.length);
          if (rest.startsWith('d:')) { const key = rest.slice(2); cache.docs.delete(key); if (key === META) meta = Object.assign({ samplesOff: false, touched: {} }, read('d:' + META)); emit('doc:' + key); }
          else if (rest.startsWith('c:')) { const name = rest.slice(2); cache.colls.delete(name); emit('coll:' + name); }
        });
      },
    };
  }

  // Artifact の db。ひとつもの → kit/<key> に {v}、ならぶもの → kit_<name>/<id>
  function dbBackend(db) {
    const retry = async (fn) => { try { return await fn(); } catch (e) { if (e && e.code === 'unavailable') { await new Promise((r) => setTimeout(r, 400 + Math.random() * 600)); return fn(); } throw e; } };
    return {
      mode: 'db',
      async getDoc(key) { const s = await retry(() => db.doc('kit/' + key).get()); return s.exists ? clone((s.data() || {}).v) : undefined; },
      async setDoc(key, v) { await db.doc('kit/' + key).set({ v: v === undefined ? null : v, at: Date.now() }); },
      async delDoc(key) { await db.doc('kit/' + key).delete(); },
      async listColl(name) { const s = await retry(() => db.collection('kit_' + name).limit(1000).get()); return s.docs.map((d) => clone(d.data())); },
      async putItem(name, item) { await db.collection('kit_' + name).doc(item.id).set(item); },
      async delItem(name, id) { await db.collection('kit_' + name).doc(id).delete(); },
      async clearColl(name) { const s = await db.collection('kit_' + name).limit(1000).get(); for (const d of s.docs) await db.collection('kit_' + name).doc(d.id).delete(); },
      watch() { /* 開くたびに読み直す。同時に2台で編集するときは、あとから保存したほうが残る */ },
    };
  }

  // 書き込みの順番待ち：同じものへの書き込みは1つずつ、最後の値だけ
  const jobs = new Map();
  let failedOnce = false;
  function queue(key, fn, delay = 350) {
    let j = jobs.get(key);
    if (!j) { j = { fn: null, timer: 0, running: null }; jobs.set(key, j); }
    j.fn = fn;
    clearTimeout(j.timer);
    j.timer = setTimeout(() => run(key), delay);
    saveState('saving');
  }
  async function run(key) {
    const j = jobs.get(key);
    if (!j || j.running) return;
    clearTimeout(j.timer);
    j.running = (async () => {
      while (j.fn) {
        const fn = j.fn; j.fn = null;
        try { await fn(); }
        catch (e) {
          console.error('保存に失敗', key, e);
          if (!failedOnce) { failedOnce = true; Kit.toast(saveError(e), { type: 'bad', ms: 8000 }); setTimeout(() => (failedOnce = false), 15000); }
          saveState('error');
        }
      }
    })();
    await j.running;
    j.running = null;
    if (![...jobs.values()].some((x) => x.fn || x.running)) saveState('saved');
  }
  function saveError(e) {
    const c = e && e.code;
    if (c === 'quota_exceeded') return '保存できる量の上限に達しました。古いデータや画像を消してください';
    if (c === 'invalid_argument') return '保存できませんでした（大きすぎるデータか、保存の権限がありません）';
    if (c === 'revoked') return '保存の権限がなくなりました。ページを開き直してください';
    return '保存に失敗しました。通信を確かめて、もう一度操作してください';
  }

  const store = (Kit.store = {
    mode: 'local',
    known,
    ready: null,
    declare(kind, names) { for (const n of [].concat(names || [])) known[kind].add(n); },
    on(key, fn) { if (!listeners.has(key)) listeners.set(key, new Set()); listeners.get(key).add(fn); return () => listeners.get(key).delete(fn); },

    async init() {
      if (store.ready) return store.ready;
      store.ready = (async () => {
        backend = await chooseBackend();
        store.mode = backend.mode;
        try { meta = Object.assign({ samplesOff: false, touched: {} }, await backend.getDoc(META)); } catch (e) { console.error(e); }
        backend.watch();
      })();
      return store.ready;
    },

    // サンプルの登録。アプリは読み込み時に Kit.store.sample('leads', [...]) としておくと、
    // ほかのアプリ（ホームなど）から読んでも同じサンプルが見える
    sample(name, value) { samples.set(name, value); },
    async get(key, o = {}) {
      await store.init();
      if (o.sample && !samples.has(key)) samples.set(key, o.sample);
      o = Object.assign({}, o, { sample: o.sample || samples.get(key) });
      if (!cache.docs.has(key)) {
        let v;
        try { v = await backend.getDoc(key); } catch (e) { console.error(e); }
        cache.docs.set(key, v === null ? undefined : v);
      }
      const v = cache.docs.get(key);
      if (v !== undefined) return clone(v);
      if (o.sample && !meta.samplesOff) return Object.assign(clone(o.sample), { _sample: true });
      return clone(o.blank);
    },
    async set(key, value) {
      await store.init();
      const v = clone(value);
      if (v && typeof v === 'object' && !Array.isArray(v)) delete v._sample;
      cache.docs.set(key, v);
      known.docs.add(key);
      queue('d:' + key, () => backend.setDoc(key, v));
      emit('doc:' + key);
      return clone(v);
    },
    async del(key) {
      await store.init();
      cache.docs.set(key, undefined);
      queue('d:' + key, () => backend.delDoc(key));
      emit('doc:' + key);
    },
    isSample(value) { return !!(value && value._sample); },

    async list(name, o = {}) {
      await store.init();
      known.colls.add(name);
      if (o.sample && !samples.has(name)) samples.set(name, o.sample);
      o = Object.assign({}, o, { sample: o.sample || samples.get(name) });
      if (!cache.colls.has(name)) {
        let items = [];
        try { items = await backend.listColl(name); } catch (e) { console.error(e); }
        items.sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
        cache.colls.set(name, new Map(items.map((x) => [x.id, x])));
      }
      const m = cache.colls.get(name);
      if (m.size === 0 && o.sample && !meta.samplesOff && !meta.touched[name]) {
        if (!virtual.has(name)) {
          const now = new Date().toISOString();
          virtual.set(name, o.sample.map((x) => Object.assign({ id: Kit.uid('s'), createdAt: now, updatedAt: now }, clone(x), { sample: true })));
        }
        return clone(virtual.get(name));
      }
      return clone([...m.values()]);
    },
    isVirtual(name) { return virtual.has(name) && !meta.touched[name]; },
    async getItem(name, id) { const all = await store.list(name); return all.find((x) => x.id === id); },

    // サンプルを見せていたコレクションに初めて書くとき、見せていた分も保存する
    async _materialize(name) {
      if (!virtual.has(name) || meta.touched[name]) return;
      const items = virtual.get(name);
      virtual.delete(name);
      const m = cache.colls.get(name) || new Map();
      for (const it of items) { m.set(it.id, it); queue('c:' + name + ':' + it.id, () => backend.putItem(name, it), 100); }
      cache.colls.set(name, m);
      await touch(name);
    },
    async put(name, item) {
      await store.list(name);
      await store._materialize(name);
      const now = new Date().toISOString();
      const it = clone(item);
      if (!it.id) it.id = Kit.uid();
      if (!it.createdAt) it.createdAt = now;
      it.updatedAt = now;
      cache.colls.get(name).set(it.id, it);
      if (!meta.touched[name]) await touch(name);
      queue('c:' + name + ':' + it.id, () => backend.putItem(name, it), 200);
      emit('coll:' + name);
      return clone(it);
    },
    async putMany(name, items) { const out = []; for (const it of items) out.push(await store.put(name, it)); return out; },
    async remove(name, id) {
      await store.list(name);
      await store._materialize(name);
      cache.colls.get(name).delete(id);
      if (!meta.touched[name]) await touch(name);
      queue('c:' + name + ':' + id, () => backend.delItem(name, id), 100);
      emit('coll:' + name);
    },
    async clear(name) {
      await store.list(name);
      virtual.delete(name);
      const m = cache.colls.get(name);
      const ids = [...m.keys()];
      m.clear();
      await touch(name);
      for (const id of ids) queue('c:' + name + ':' + id, () => backend.delItem(name, id), 100);
      emit('coll:' + name);
    },

    // サンプルを片付ける：サンプルの行を消し、まだ保存していない画面は空から始める
    async samplesOff() {
      await store.init();
      meta.samplesOff = true;
      for (const name of known.colls) {
        const items = await store.list(name);
        virtual.delete(name);
        for (const it of items) if (it.sample) await store.remove(name, it.id);
        emit('coll:' + name);
      }
      queue('d:' + META, () => backend.setDoc(META, clone(meta)));
      for (const key of known.docs) emit('doc:' + key);
    },
    samplesShown() { return !meta.samplesOff; },

    // 全部をひとつのJSONに（バックアップ）
    async exportAll() {
      await store.init();
      const out = { app: 'sensei-kit', version: 1, exportedAt: new Date().toISOString(), docs: {}, colls: {} };
      for (const key of known.docs) { if (key === META) continue; const v = cache.docs.has(key) ? cache.docs.get(key) : await backend.getDoc(key).catch(() => undefined); if (v !== undefined && v !== null) out.docs[key] = clone(v); }
      for (const name of known.colls) { await store.list(name); if (store.isVirtual(name)) continue; out.colls[name] = clone([...cache.colls.get(name).values()]); }
      return out;
    },
    async importAll(data) {
      if (!data || data.app !== 'sensei-kit') throw new Error('先生の道具箱のバックアップではありません');
      await store.init();
      for (const [key, v] of Object.entries(data.docs || {})) { if (key !== META) await store.set(key, v); }
      for (const [name, items] of Object.entries(data.colls || {})) {
        await store.clear(name);
        for (const it of items || []) { const m = cache.colls.get(name); m.set(it.id, it); queue('c:' + name + ':' + it.id, () => backend.putItem(name, it), 100); }
        emit('coll:' + name);
      }
      meta.samplesOff = true;
      queue('d:' + META, () => backend.setDoc(META, clone(meta)));
      await store.flush();
    },
    async wipeAll() {
      await store.init();
      for (const name of known.colls) await store.clear(name);
      for (const key of known.docs) if (key !== META) await store.del(key);
      meta = { samplesOff: false, touched: {} };
      virtual.clear();
      queue('d:' + META, () => backend.setDoc(META, clone(meta)));
      await store.flush();
      for (const name of known.colls) emit('coll:' + name);
    },
    async flush() { await Promise.all([...jobs.keys()].map((k) => run(k))); await Promise.all([...jobs.values()].map((j) => j.running).filter(Boolean)); },
  });

  async function touch(name) {
    if (meta.touched[name]) return;
    meta.touched[name] = true;
    queue('d:' + META, () => backend.setDoc(META, clone(meta)));
  }

  async function chooseBackend() {
    if (!env.artifact) return localBackend();
    const [db, user] = await Promise.all([use('db'), use('user')]);
    if (!db) return localBackend();
    let canEdit = false;
    try { canEdit = user ? await user.canEdit() : false; } catch (e) { canEdit = false; }
    if (!canEdit) return localBackend(); // 持ち主と編集者だけがアカウントに保存。共有で見ている人は自分のブラウザに保存
    try { await db.doc('kit/' + META).get(); } catch (e) { return localBackend(); }
    return dbBackend(db);
  }

  /* ───────── 学校の設定（どのアプリからも使う） ─────────
     みせびらき の「事業プロフィール」のかわり。名簿（クラス）は名簿アプリが持つ。
     学校名・呼び名は画面とファイル名に出るだけ。空欄でも使える。 */
  // 年度（4月はじまり）
  Kit.schoolYear = (d = new Date()) => { const x = d instanceof Date ? d : Kit.parseYmd(d); return x.getMonth() >= 3 ? x.getFullYear() : x.getFullYear() - 1; };
  const LEVELS = [
    { value: 'es', label: '小学校' },
    { value: 'jhs', label: '中学校' },
    { value: 'hs', label: '高校' },
    { value: 'other', label: 'そのほか' },
  ];
  Kit.LEVELS = LEVELS;
  Kit.levelLabel = (v) => (LEVELS.find((x) => x.value === v) || LEVELS[1]).label;
  const PROFILE_SAMPLE = { teacher: 'かず先生', school: 'ひかり中学校（架空）', level: 'jhs', year: Kit.schoolYear(), terms: 3, subject: '数学' };
  const PROFILE_BLANK = { teacher: '', school: '', level: 'jhs', year: Kit.schoolYear(), terms: 3, subject: '' };
  Kit.PROFILE_SAMPLE = PROFILE_SAMPLE;
  const normProfile = (p) => {
    const o = Object.assign(clone(PROFILE_BLANK), p || {});
    if (!LEVELS.some((x) => x.value === o.level)) o.level = 'jhs';
    o.year = Number.isFinite(+o.year) && +o.year > 1990 && +o.year < 2200 ? Math.round(+o.year) : Kit.schoolYear();
    o.terms = +o.terms === 2 ? 2 : 3;
    return o;
  };

  Kit.profile = {
    async get() { const p = await store.get('profile', { sample: PROFILE_SAMPLE, blank: PROFILE_BLANK }); return Object.assign(normProfile(p), p && p._sample ? { _sample: true } : {}); },
    async set(p) { return store.set('profile', normProfile(p)); },
    // 学期の名前（3学期制なら 1学期〜3学期、2期制なら 前期・後期）
    termNames(p) { return p && +p.terms === 2 ? ['前期', '後期'] : ['1学期', '2学期', '3学期']; },
    // 編集ダイアログ。保存したら新しい設定で resolve（やめたら null）
    async edit() {
      const p = await Kit.profile.get();
      const f = {
        teacher: h('input', { type: 'text', placeholder: '例：かず先生', maxlength: 40 }),
        school: h('input', { type: 'text', placeholder: '空欄でも使えます', maxlength: 60 }),
        subject: h('input', { type: 'text', placeholder: '例：数学（担任だけなら空欄）', maxlength: 40 }),
        year: h('input', { type: 'number', min: 1990, max: 2199, step: 1, inputmode: 'numeric' }),
      };
      f.teacher.value = p.teacher || ''; f.school.value = p.school || ''; f.subject.value = p.subject || ''; f.year.value = String(p.year);
      let level = p.level, terms = p.terms;
      const body = h('div', { class: 'stack' },
        p._sample ? h('p', { class: 'small', style: { color: 'var(--shu)' } }, 'いまはサンプル（架空の学校）です。自分の学校に書きかえて保存してください。') : null,
        h('div', { class: 'grid cols-2' },
          Kit.field({ label: '呼び名', input: f.teacher, id: 'pf-teacher', hint: '画面のあいさつに出るだけです。' }),
          Kit.field({ label: '学校名（任意）', input: f.school, id: 'pf-school', hint: '印刷物の見出しに出ます。' })),
        Kit.field({ label: '校種', input: Kit.seg(LEVELS, level, (v) => { level = v; }, { label: '校種' }), hint: '係の例や、時間割の時限の数の目安が変わります。' }),
        h('div', { class: 'grid cols-2' },
          Kit.field({ label: '年度', input: f.year, id: 'pf-year', hint: '4月はじまり。' }),
          Kit.field({ label: '学期', input: Kit.seg([{ value: 3, label: '3学期制' }, { value: 2, label: '2期制（前期・後期）' }], terms, (v) => { terms = +v; }, { label: '学期' }) })),
        Kit.field({ label: '担当の教科（任意）', input: f.subject, id: 'pf-subject' }),
        h('p', { class: 'small muted' }, '名簿・成績のもとになる記録は、このブラウザの中だけに保存されます（外には送りません）。'));
      return new Promise((resolve) => {
        Kit.modal({
          title: '学校の設定', wide: true, body, onClose: (v) => resolve(v || null),
          actions: [{ label: 'やめる', kind: 'ghost', value: null }, {
            label: '保存する', kind: 'primary', onClick: async () => {
              const np = normProfile({ teacher: f.teacher.value.trim(), school: f.school.value.trim(), subject: f.subject.value.trim(), year: f.year.value, level, terms });
              await Kit.profile.set(np);
              Kit.toast('学校の設定を保存しました');
              return np;
            },
          }],
        });
      });
    },
  };

  /* ───────── 書き出し ───────── */
  const DL_EXT = ['gif', 'png', 'jpg', 'jpeg', 'webp', 'mp4', 'webm', 'mov', 'txt', 'json', 'md', 'docx', 'pptx', 'epub', 'csv', 'ttf', 'html', 'svg', 'pdf', 'xlsx', 'zip'];
  const MIME = { json: 'application/json', csv: 'text/csv', html: 'text/html', txt: 'text/plain', md: 'text/markdown', svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', pdf: 'application/pdf', webm: 'video/webm', mp4: 'video/mp4', ics: 'text/calendar', zip: 'application/zip' };
  Kit.canDownload = (ext) => !env.artifact || DL_EXT.includes(String(ext).toLowerCase());
  Kit.download = async (filename, data, mime) => {
    const ext = (filename.split('.').pop() || '').toLowerCase();
    if (env.artifact) {
      const dl = await use('downloads');
      if (!dl) { Kit.toast('この画面ではファイルを保存できません', { type: 'bad' }); return false; }
      try { await dl.save({ filename, data }); return true; }
      catch (e) {
        const c = e && e.code;
        if (c === 'declined') return false;
        Kit.toast(c === 'rate_limited' ? '保存の確認が開いています。閉じてから、もう一度どうぞ' : c === 'rejected_extension' ? 'この形式のファイルは保存できません' : 'ファイルを保存できませんでした', { type: 'bad' });
        return false;
      }
    }
    const blob = data instanceof Blob ? data : new Blob([data], { type: mime || MIME[ext] || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: filename, style: { display: 'none' } });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return true;
  };
  Kit.safeName = (s) => String(s || 'file').replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 60);

  /* ───────── AI（Artifact の sample） ───────── */
  const AI_MSG = {
    not_granted: 'AI の利用が許可されていません（この画面の設定から許可できます）',
    sampling_disabled: 'このアカウントでは AI が使えません',
    rate_limited: '少し時間をおいてから、もう一度どうぞ',
    refused: 'この内容には AI が答えられませんでした。言い方を変えてみてください',
    invalid_json: 'うまく形にできませんでした。もう一度お試しください',
    prompt_too_large: '文章が長すぎます。短くしてから試してください',
    empty_completion: '答えが空でした。頼み方を変えてみてください',
    session_expired: 'ログインし直してください',
    unavailable: 'AI はこの画面では使えません',
  };
  const ai = (Kit.ai = {
    _ready: null,
    ready() {
      if (!ai._ready) ai._ready = use('sample').then((s) => { document.documentElement.classList.toggle('has-ai', !!s); return !!s; });
      return ai._ready;
    },
    message(code) { return AI_MSG[code] || 'AI との通信がうまくいきませんでした。もう一度どうぞ'; },
    // 文章で：await Kit.ai.ask('…', {onText}) / JSON で：await Kit.ai.ask('…', {json:true})
    async ask(prompt, o = {}) {
      const s = cap.sample || (await use('sample'));
      if (!s) throw { code: 'unavailable', message: AI_MSG.unavailable };
      const opts = {};
      if (o.onText) opts.onText = o.onText;
      if (o.signal) opts.signal = o.signal;
      if (o.tier) opts.modelTier = o.tier;
      if (o.cache !== undefined) opts.cache = o.cache;
      try { return o.json ? await s.json(prompt, opts) : (await s(prompt, opts)).text; }
      catch (e) { const code = (e && e.code) || 'upstream_error'; throw { code, message: code === 'cancelled' ? '' : ai.message(code), text: e && e.text }; }
    },
    // 学校の要約（プロンプトの前置きに使う）。学校名・生徒の名前は入れない
    async context() {
      const p = await Kit.profile.get();
      return ['【校種】' + Kit.levelLabel(p.level), p.subject ? '【担当の教科】' + p.subject : ''].filter(Boolean).join('\n');
    },
    // AI ボタン：使えない画面では出ない（.ai-only）。押している間は「考え中…」
    button(label, run, o = {}) {
      const b = Kit.btn(label, null, { kind: 'ai' + (o.kind ? ' ' + o.kind : ''), icon: 'sparkle', sm: o.sm, class: 'ai-only' });
      const span = b.querySelector('span');
      b.addEventListener('click', async () => {
        if (b.disabled) return;
        b.disabled = true;
        const old = span ? span.textContent : '';
        if (span) span.textContent = '考え中…';
        try { await run(); }
        catch (e) { if (e && e.code !== 'cancelled') Kit.toast((e && e.message) || ai.message(), { type: 'bad' }); }
        finally { b.disabled = false; if (span) span.textContent = old; }
      });
      return b;
    },
  });

  /* ───────── 画像 ───────── */
  Kit.img = {
    // ファイル → 小さくした dataURL（db の1件に入る大きさ。既定 180KB まで）
    async fromFile(file, o = {}) {
      const max = o.max || 1600, maxBytes = o.maxBytes || 180000;
      const src = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
      if (/svg/.test(file.type) && src.length <= maxBytes) return { dataUrl: src, w: 0, h: 0 };
      const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('画像を読み込めませんでした')); i.src = src; });
      const alpha = /png|webp|gif|svg/.test(file.type);
      let scale = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
      for (let round = 0; round < 7; round++) {
        const w = Math.max(1, Math.round(im.naturalWidth * scale)), hh = Math.max(1, Math.round(im.naturalHeight * scale));
        const c = h('canvas', { width: w, height: hh });
        const ctx = c.getContext('2d');
        if (!alpha) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, hh); }
        ctx.drawImage(im, 0, 0, w, hh);
        const tries = alpha ? [['image/webp', 0.85], ['image/png']] : [['image/jpeg', 0.86], ['image/jpeg', 0.72], ['image/jpeg', 0.6]];
        for (const [type, q] of tries) {
          const url = c.toDataURL(type, q);
          if (alpha && type === 'image/webp' && !url.startsWith('data:image/webp')) continue; // webp で書けないブラウザ
          if (url.length <= maxBytes) return { dataUrl: url, w, h: hh };
        }
        scale *= 0.75;
      }
      throw new Error('画像が大きすぎて保存できません');
    },
    async save(file, o) { const r = await Kit.img.fromFile(file, o); const it = await store.put('images', { name: file.name || '画像', dataUrl: r.dataUrl, w: r.w, h: r.h }); return it; },
    async get(id) { return store.getItem('images', id); },
    // 'img:<id>' → dataURL。URL や dataURL はそのまま返す
    async resolve(ref) {
      if (!ref) return '';
      if (String(ref).startsWith('img:')) { const it = await Kit.img.get(String(ref).slice(4)); return it ? it.dataUrl : ''; }
      return ref;
    },
    pick(accept = 'image/*') {
      return new Promise((resolve) => {
        const i = h('input', { type: 'file', accept, style: { display: 'none' } });
        i.addEventListener('change', () => { resolve(i.files && i.files[0] ? i.files[0] : null); i.remove(); });
        document.body.append(i);
        i.click();
      });
    },
    toBlob(canvas, type = 'image/png', q) { return new Promise((r) => canvas.toBlob(r, type, q)); },
  };

  /* ───────── QR コード（vendor/qrcode.js） ───────── */
  Kit.qr = (text, o = {}) => {
    if (!window.qrcode) throw new Error('QR の部品が読み込まれていません');
    if (window.qrcode.stringToBytesFuncs && window.qrcode.stringToBytesFuncs['UTF-8']) window.qrcode.stringToBytes = window.qrcode.stringToBytesFuncs['UTF-8'];
    const q = window.qrcode(0, o.level || 'M');
    q.addData(String(text || ' '), 'Byte');
    q.make();
    const n = q.getModuleCount(), cell = o.cell || 8, margin = o.margin == null ? 4 : o.margin;
    const size = (n + margin * 2) * cell;
    const c = h('canvas', { width: size, height: size });
    const ctx = c.getContext('2d');
    ctx.fillStyle = o.light || '#ffffff';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = o.dark || '#000000';
    for (let r = 0; r < n; r++) for (let cc = 0; cc < n; cc++) if (q.isDark(r, cc)) ctx.fillRect((cc + margin) * cell, (r + margin) * cell, cell, cell);
    return c;
  };

  /* ───────── グラフ（SVG・ホバーで値・表でも見られる） ─────────
     Kit.chart.bars(el, {labels, series:[{name, values}], stacked, lines:[{name, values}], format})
     Kit.chart.line(el, {labels, series:[{name, values}], area, format})
     Kit.chart.hbars(el, {items:[{label, value}], format})
     色は --series-1.. を順番に使う（系列に color: 'var(--series-3)' のように指定もできる） */
  const SVGNS = 'http://www.w3.org/2000/svg';
  const sv = (tag, attrs, ...kids) => { const e = document.createElementNS(SVGNS, tag); for (const k in attrs || {}) if (attrs[k] != null) e.setAttribute(k, attrs[k]); for (const c of kids) if (c != null) e.append(c); return e; };
  Kit.svg = sv;
  function niceTicks(min, max, count = 4) {
    if (min === max) { max = min + 1; }
    const span = max - min, raw = span / count, mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= count) || 10 * mag;
    const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
    const out = []; for (let v = lo; v <= hi + step / 2; v += step) out.push(Math.round(v / step) * step);
    return out;
  }
  function chartFrame(el, opt, draw) {
    Kit.clear(el);
    el.classList.add('chart');
    const series = (opt.series || []).concat(opt.lines || []);
    if (series.length >= 2 || (opt.lines && opt.lines.length)) {
      el.append(h('div', { class: 'chart-legend' }, series.map((s, i) => h('span', null, h('i', { class: s._line ? 'line' : null, style: { background: s.color || 'var(--series-' + ((i % 8) + 1) + ')' } }), s.name))));
    }
    const holder = h('div', { style: { position: 'relative' } });
    const tip = h('div', { class: 'chart-tip', hidden: true });
    holder.append(tip);
    el.append(holder);
    const fmt = opt.format || ((v) => Kit.num(v));
    let tableOpen = false;
    const tbl = h('div', { class: 'tbl-wrap', hidden: true, style: { marginTop: '8px' } });
    if (opt.table !== false && opt.labels) {
      const toggle = Kit.btn('表で見る', () => { tableOpen = !tableOpen; tbl.hidden = !tableOpen; toggle.querySelector('span').textContent = tableOpen ? '表を閉じる' : '表で見る'; }, { sm: true, kind: 'ghost', class: 'chart-table-toggle' });
      const t = h('table', { class: 'tbl' }, h('thead', null, h('tr', null, h('th', null, ''), series.map((s) => h('th', { class: 'r' }, s.name)))),
        h('tbody', null, opt.labels.map((lb, i) => h('tr', null, h('td', null, lb), series.map((s) => h('td', { class: 'r' }, fmtOrDash(fmt, s.values[i])))))));
      tbl.append(t);
      el.append(toggle, tbl);
    }
    const render = () => {
      const w = Math.max(260, holder.clientWidth || el.clientWidth || 600);
      [...holder.querySelectorAll('svg')].forEach((s) => s.remove());
      const svg = draw(w, tip, fmt);
      holder.insertBefore(svg, tip);
    };
    render();
    // 幅が変わったら描き直す。描き直しのたびに前の見張りを外す（たまらないように）
    if (el._kitRO) el._kitRO.disconnect();
    if (window.ResizeObserver) {
      let last = holder.clientWidth;
      const ro = new ResizeObserver(() => {
        if (!holder.isConnected) { ro.disconnect(); return; }
        if (Math.abs(holder.clientWidth - last) > 4) { last = holder.clientWidth; render(); }
      });
      ro.observe(holder);
      el._kitRO = ro;
    }
    return el;
  }
  function showTip(tip, holder, x, y, head, rows) {
    Kit.clear(tip);
    tip.append(h('div', { class: 'tip-h' }, head));
    for (const r of rows) tip.append(h('div', { class: 'tip-row' }, h('i', { style: { background: r.color } }), h('span', null, r.name), h('b', null, r.value)));
    tip.hidden = false;
    const W = holder.clientWidth, tw = tip.offsetWidth;
    tip.style.left = Math.min(Math.max(0, x + 12), Math.max(0, W - tw)) + 'px';
    tip.style.top = Math.max(0, y - 10) + 'px';
  }
  const colorOf = (s, i) => s.color || 'var(--series-' + ((i % 8) + 1) + ')';
  const fmtOrDash = (fmt, v) => (v == null || v === '' ? '—' : fmt(v));
  // 折れ線の道筋。値が null の点で線を途切れさせる
  function linePath(values, X, Y) {
    let d = '', pen = false, last = null, first = null;
    values.forEach((v, i) => {
      if (v == null || v === '' || !Number.isFinite(+v)) { pen = false; return; }
      const p = [X(i), Y(+v)];
      d += (pen ? 'L' : 'M') + p[0] + ',' + p[1];
      pen = true; last = p; if (!first) first = p;
    });
    return { d, last, first };
  }
  const xLabelEvery = (n, plotW, avg = 40) => Math.max(1, Math.ceil(n / Math.max(1, Math.floor(plotW / avg))));

  Kit.chart = {
    bars(el, opt) {
      const lines = (opt.lines || []).map((s) => Object.assign({}, s, { _line: true }));
      return chartFrame(el, Object.assign({}, opt, { lines }), (W, tip, fmt) => {
        const H = opt.height || 220, padL = 48, padR = 10, padT = 10, padB = 26;
        const labels = opt.labels, n = labels.length, series = opt.series || [];
        let lo = 0, hi = 0;
        labels.forEach((_, i) => {
          if (opt.stacked) { let p = 0, m = 0; series.forEach((s) => { const v = +s.values[i] || 0; if (v >= 0) p += v; else m += v; }); hi = Math.max(hi, p); lo = Math.min(lo, m); }
          else series.forEach((s) => { const v = +s.values[i] || 0; hi = Math.max(hi, v); lo = Math.min(lo, v); });
          lines.forEach((s) => { const v = +s.values[i] || 0; hi = Math.max(hi, v); lo = Math.min(lo, v); });
        });
        const ticks = niceTicks(lo, hi === lo ? lo + 1 : hi);
        const y0 = ticks[0], y1 = ticks[ticks.length - 1];
        const plotW = W - padL - padR, plotH = H - padT - padB;
        const Y = (v) => padT + plotH - ((v - y0) / (y1 - y0)) * plotH;
        const band = plotW / n;
        const svg = sv('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': opt.title || 'グラフ' });
        ticks.forEach((t) => {
          svg.append(sv('line', { x1: padL, x2: W - padR, y1: Y(t), y2: Y(t), stroke: t === 0 ? 'var(--chart-axis)' : 'var(--chart-grid)', 'stroke-width': 1 }));
          svg.append(sv('text', { x: padL - 6, y: Y(t) + 4, 'text-anchor': 'end' }, (opt.tick || fmt)(t)));
        });
        const every = xLabelEvery(n, plotW, opt.labelWidth || 44);
        labels.forEach((lb, i) => { if (i % every === 0) svg.append(sv('text', { x: padL + band * i + band / 2, y: H - 8, 'text-anchor': 'middle' }, lb)); });
        const groups = opt.stacked ? 1 : Math.max(1, series.length);
        const bw = Math.min(24, (band * 0.72) / groups);
        const rounded = (x, yTop, w, hgt, up) => {
          if (hgt <= 0.5) return '';
          const r = Math.min(4, w / 2, hgt);
          return up
            ? `M${x},${yTop + hgt}V${yTop + r}Q${x},${yTop} ${x + r},${yTop}H${x + w - r}Q${x + w},${yTop} ${x + w},${yTop + r}V${yTop + hgt}Z`
            : `M${x},${yTop}V${yTop + hgt - r}Q${x},${yTop + hgt} ${x + r},${yTop + hgt}H${x + w - r}Q${x + w},${yTop + hgt} ${x + w},${yTop + hgt - r}V${yTop}Z`;
        };
        labels.forEach((_, i) => {
          const cx = padL + band * i + band / 2;
          if (opt.stacked) {
            let pos = 0, neg = 0;
            const last = series.length - 1 - [...series].reverse().findIndex((s) => (+s.values[i] || 0) > 0);
            series.forEach((s, si) => {
              const v = +s.values[i] || 0; if (!v) return;
              const from = v >= 0 ? pos : neg, to = from + v;
              if (v >= 0) pos = to; else neg = to;
              const top = Y(Math.max(from, to)), bot = Y(Math.min(from, to));
              const gap = si > 0 ? 2 : 0;
              const hh = Math.max(0, bot - top - gap);
              svg.append(sv('path', { d: si === last && v > 0 ? rounded(cx - bw / 2, top, bw, hh, true) : `M${cx - bw / 2},${top}h${bw}v${hh}h${-bw}Z`, fill: colorOf(s, si) }));
            });
          } else {
            series.forEach((s, si) => {
              const v = +s.values[i] || 0; if (!v) return;
              const x = cx - (bw * groups) / 2 + bw * si + (groups > 1 ? 1 : 0);
              const w = groups > 1 ? bw - 2 : bw;
              const top = Y(Math.max(0, v)), bot = Y(Math.min(0, v));
              svg.append(sv('path', { d: rounded(x, top, w, bot - top, v > 0), fill: colorOf(s, si) }));
            });
          }
        });
        lines.forEach((s, li) => {
          const col = colorOf(s, series.length + li);
          const { d, last } = linePath(s.values, (i) => padL + band * i + band / 2, Y);
          if (d) svg.append(sv('path', { d, fill: 'none', stroke: col, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
          if (last) svg.append(sv('circle', { cx: last[0], cy: last[1], r: 4, fill: col, stroke: 'var(--surface)', 'stroke-width': 2 }));
        });
        const hover = sv('rect', { x: 0, y: padT, width: band, height: plotH, fill: 'var(--ink)', opacity: 0, 'pointer-events': 'none' });
        svg.append(hover);
        labels.forEach((lb, i) => {
          const hit = sv('rect', { x: padL + band * i, y: padT, width: band, height: plotH, fill: 'transparent', tabindex: 0 });
          const on = () => {
            hover.setAttribute('x', padL + band * i); hover.setAttribute('opacity', 0.05);
            const rows = series.map((s, si) => ({ name: s.name, value: fmtOrDash(fmt, s.values[i]), color: colorOf(s, si) })).concat(lines.map((s, li) => ({ name: s.name, value: fmtOrDash(fmt, s.values[i]), color: colorOf(s, series.length + li) })));
            showTip(tip, el.querySelector('.chart > div') || el, padL + band * i + band / 2, padT, lb, rows);
          };
          const off = () => { hover.setAttribute('opacity', 0); tip.hidden = true; };
          hit.addEventListener('pointerenter', on); hit.addEventListener('focus', on);
          hit.addEventListener('pointerleave', off); hit.addEventListener('blur', off);
          svg.append(hit);
        });
        return svg;
      });
    },

    line(el, opt) {
      return chartFrame(el, opt, (W, tip, fmt) => {
        const H = opt.height || 220, padL = 48, padR = 14, padT = 12, padB = 26;
        const labels = opt.labels, n = labels.length, series = opt.series || [];
        const all = series.flatMap((s) => s.values.filter((v) => v != null).map((v) => +v || 0));
        const ticks = niceTicks(Math.min(0, ...all), Math.max(1, ...all));
        const y0 = ticks[0], y1 = ticks[ticks.length - 1];
        const plotW = W - padL - padR, plotH = H - padT - padB;
        const X = (i) => padL + (n <= 1 ? plotW / 2 : (plotW * i) / (n - 1));
        const Y = (v) => padT + plotH - ((v - y0) / (y1 - y0)) * plotH;
        const svg = sv('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': opt.title || 'グラフ' });
        ticks.forEach((t) => { svg.append(sv('line', { x1: padL, x2: W - padR, y1: Y(t), y2: Y(t), stroke: t === 0 ? 'var(--chart-axis)' : 'var(--chart-grid)', 'stroke-width': 1 })); svg.append(sv('text', { x: padL - 6, y: Y(t) + 4, 'text-anchor': 'end' }, (opt.tick || fmt)(t))); });
        const every = xLabelEvery(n, plotW, opt.labelWidth || 44);
        // 最後の目盛りは必ず出し、その手前で近すぎるものは出さない（重ならないように）
        labels.forEach((lb, i) => { if ((i % every === 0 && n - 1 - i >= every) || i === n - 1) svg.append(sv('text', { x: X(i), y: H - 8, 'text-anchor': i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle' }, lb)); });
        series.forEach((s, si) => {
          const col = colorOf(s, si);
          const { d, last, first } = linePath(s.values, X, Y);
          if (!d) return;
          if (opt.area && series.length === 1 && !s.values.some((v) => v == null)) svg.append(sv('path', { d: d + `L${X(n - 1)},${Y(Math.max(y0, 0))}L${X(0)},${Y(Math.max(y0, 0))}Z`, fill: col, opacity: 0.1 }));
          svg.append(sv('path', { d, fill: 'none', stroke: col, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
          if (last) svg.append(sv('circle', { cx: last[0], cy: last[1], r: 4, fill: col, stroke: 'var(--surface)', 'stroke-width': 2 }));
          if (first && first === last) svg.append(sv('circle', { cx: first[0], cy: first[1], r: 4, fill: col }));
        });
        const cross = sv('line', { x1: 0, x2: 0, y1: padT, y2: padT + plotH, stroke: 'var(--ink-3)', 'stroke-width': 1, opacity: 0 });
        svg.append(cross);
        const hit = sv('rect', { x: padL, y: padT, width: plotW, height: plotH, fill: 'transparent' });
        hit.addEventListener('pointermove', (e) => {
          const r = svg.getBoundingClientRect(); const px = ((e.clientX - r.left) / r.width) * W;
          const i = Kit.clamp(Math.round(((px - padL) / plotW) * (n - 1)), 0, n - 1);
          cross.setAttribute('x1', X(i)); cross.setAttribute('x2', X(i)); cross.setAttribute('opacity', 0.5);
          showTip(tip, el.querySelector('.chart > div') || el, (X(i) / W) * r.width, padT, labels[i], series.map((s, si) => ({ name: s.name, value: fmtOrDash(fmt, s.values[i]), color: colorOf(s, si) })));
        });
        hit.addEventListener('pointerleave', () => { cross.setAttribute('opacity', 0); tip.hidden = true; });
        svg.append(hit);
        return svg;
      });
    },

    hbars(el, opt) {
      Kit.clear(el);
      el.classList.add('chart');
      const fmt = opt.format || ((v) => Kit.num(v));
      const max = Math.max(1, ...opt.items.map((x) => +x.value || 0));
      const wrap = h('div', { class: 'stack tight' });
      for (const it of opt.items) {
        const pct = ((+it.value || 0) / max) * 100;
        wrap.append(h('div', { style: { display: 'grid', gridTemplateColumns: 'minmax(80px, 34%) 1fr auto', gap: '10px', alignItems: 'center', fontSize: '13px' } },
          h('span', { class: 'ellipsis ink-2', title: it.label }, it.label),
          h('span', { style: { height: '14px', borderRadius: '0 4px 4px 0', background: 'var(--surface-2)', position: 'relative', overflow: 'hidden' } },
            h('i', { style: { position: 'absolute', inset: '0 auto 0 0', width: pct + '%', background: it.color || opt.color || 'var(--series-1)', borderRadius: '0 4px 4px 0' } })),
          h('b', { class: 'num', style: { fontWeight: 600 } }, fmt(it.value))));
      }
      el.append(wrap);
      return el;
    },

    spark(values, o = {}) {
      const W = o.width || 96, H = o.height || 28, n = values.length;
      const lo = Math.min(...values), hi = Math.max(...values);
      const X = (i) => (n <= 1 ? W / 2 : 2 + ((W - 4) * i) / (n - 1));
      const Y = (v) => H - 3 - ((v - lo) / (hi - lo || 1)) * (H - 6);
      const pts = values.map((v, i) => X(i) + ',' + Y(v)).join(' ');
      const svg = sv('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, 'aria-hidden': 'true' });
      svg.append(sv('polyline', { points: pts, fill: 'none', stroke: o.color || 'var(--ink-3)', 'stroke-width': 1.5, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
      if (n) svg.append(sv('circle', { cx: X(n - 1), cy: Y(values[n - 1]), r: 3, fill: o.accent || 'var(--gosu)' }));
      return svg;
    },
  };

  /* ───────── 画面（アプリの登録と切り替え） ───────── */
  Kit.GROUPS = [
    { id: 'home', label: '' },
    { id: 'class', label: 'クラス' },
    { id: 'lesson', label: '授業' },
    { id: 'plan', label: '予定' },
    { id: 'write', label: '通信・連絡' },
  ];
  const apps = [];
  const appMap = new Map();
  // Kit.app({id, title, group, icon, desc, order, wide, docs:[], colls:[], mount(root, params) → cleanup?})
  Kit.app = (def) => {
    if (!def || !def.id || typeof def.mount !== 'function') throw new Error('Kit.app: id と mount が必要です');
    if (appMap.has(def.id)) throw new Error('Kit.app: id が重複しています: ' + def.id);
    apps.push(def);
    appMap.set(def.id, def);
    store.declare('docs', def.docs);
    store.declare('colls', def.colls);
  };
  Kit.apps = () => apps.slice().sort((a, b) => (a.order || 99) - (b.order || 99));
  Kit.appDef = (id) => appMap.get(id);

  let shell = null;
  let current = null;
  let params = {};
  let mountSeq = 0;

  Kit.go = (id, p) => {
    params = p || {};
    if (location.hash.slice(1) !== id) {
      try { location.hash = id; } catch (e) { mount(id); }
      // ハッシュが変わらない環境でも切り替える
      setTimeout(() => { if (!current || current.id !== id) mount(id); }, 60);
    } else mount(id);
  };

  function buildShell() {
    const root = document.getElementById('kit') || document.body.appendChild(h('div', { id: 'kit' }));
    const mb = h('div', { class: 'mb' });
    const top = h('header', { class: 'mb-top' },
      h('button', { type: 'button', class: 'mb-menu-btn', 'aria-label': 'メニューを開く', onclick: () => drawer(true) }, Kit.icon('menu', 22)),
      h('span', { class: 'mb-top-brand' }, '先生の道具箱'),
      h('span', { class: 'mb-top-app' }));
    const nav = h('nav', { class: 'mb-nav', 'aria-label': 'ツール' });
    const side = h('aside', { class: 'mb-side' },
      h('a', { class: 'kokuban', href: '#home', onclick: (e) => { e.preventDefault(); Kit.go('home'); } },
        h('span', { class: 'kokuban-name' }, '先生の道具箱'), h('span', { class: 'kokuban-sub' }, '学級・授業・予定'),
        h('span', { class: 'kokuban-tray', 'aria-hidden': 'true' }, h('i', { class: 'c1' }), h('i', { class: 'c2' }), h('i', { class: 'c3' }))),
      nav,
      h('div', { class: 'mb-side-foot' }, h('span', { class: 'mb-save-state', 'data-mode': 'local' }, '読み込み中…'), h('span', { class: 'mb-save-where' })));
    const scrim = h('div', { class: 'mb-scrim', hidden: true, onclick: () => drawer(false) });
    const view = h('div', { class: 'mb-view', id: 'mb-view' });
    const main = h('main', { class: 'mb-main' }, view);
    mb.append(side, h('div', { style: { minWidth: 0 } }, top, main));
    root.append(mb, scrim);
    shell = { mb, top, nav, side, scrim, view };
    renderNav();
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && mb.classList.contains('is-drawer')) drawer(false); });
  }
  function renderNav() {
    Kit.clear(shell.nav);
    const list = Kit.apps();
    for (const g of Kit.GROUPS) {
      const items = list.filter((a) => (a.group || 'home') === g.id);
      if (!items.length) continue;
      shell.nav.append(h('div', { class: 'mb-nav-group' },
        g.label ? h('div', { class: 'mb-nav-label' }, g.label) : null,
        items.map((a) => h('a', { class: 'mb-nav-item', href: '#' + a.id, 'data-app': a.id, onclick: (e) => { e.preventDefault(); Kit.go(a.id); } }, Kit.icon(a.icon || 'info'), h('span', null, a.title)))));
    }
  }
  function drawer(open) {
    shell.mb.classList.toggle('is-drawer', open);
    shell.scrim.hidden = !open;
    if (open) { const f = shell.nav.querySelector('[aria-current="page"]') || shell.nav.querySelector('a'); if (f) f.focus(); }
  }
  function saveState(s) {
    if (!shell) return;
    const el = shell.side.querySelector('.mb-save-state');
    el.dataset.mode = store.mode === 'db' ? 'db' : 'local';
    el.textContent = s === 'saving' ? '保存中…' : s === 'error' ? '保存できませんでした' : store.mode === 'db' ? 'アカウントに保存済み' : store.mode === 'memory' ? '保存できない環境です' : 'このブラウザに保存済み';
  }
  function saveWhere() {
    const el = shell.side.querySelector('.mb-save-where');
    el.textContent = store.mode === 'db' ? 'ほかの端末で開いても同じ内容です。'
      : env.artifact ? '共有で開いているため、このブラウザだけに保存されます。'
        : store.mode === 'memory' ? 'ページを閉じると消えます。バックアップを書き出してください。'
          : 'ときどきホームからバックアップを。';
  }

  async function mount(id) {
    const def = appMap.get(id) || appMap.get('home') || apps[0];
    if (!def) return;
    const seq = ++mountSeq;
    if (current && current.cleanup) { try { current.cleanup(); } catch (e) { console.error(e); } }
    current = { id: def.id, cleanup: null };
    const view = shell.view;
    Kit.clear(view);
    view.classList.toggle('is-wide', !!def.wide);
    for (const a of shell.nav.querySelectorAll('.mb-nav-item')) { if (a.dataset.app === def.id) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); }
    shell.top.querySelector('.mb-top-app').textContent = def.title;
    drawer(false);
    const root = h('div', { class: 'app app-' + def.id });
    view.append(root);
    const p = params; params = {};
    try {
      const c = await def.mount(root, p || {});
      if (seq !== mountSeq) { if (typeof c === 'function') c(); return; }
      current.cleanup = typeof c === 'function' ? c : null;
    } catch (e) {
      console.error(e);
      if (seq === mountSeq) root.append(h('div', { class: 'empty' }, h('div', { class: 'empty-title' }, 'この画面を開けませんでした'), h('p', { class: 'small mono' }, String((e && e.message) || e))));
    }
    if (seq === mountSeq) window.scrollTo(0, 0);
  }
  Kit.current = () => (current ? current.id : null);
  // ハッシュを先に受け取る係：fn(ハッシュ) → 開く画面の id（自分の担当でなければ null）
  Kit.hashHandlers = [];
  Kit.remount = () => { if (current) mount(current.id); };

  Kit.start = async () => {
    buildShell();
    shell.view.append(h('p', { class: 'muted', style: { padding: '40px 0' } }, '道具箱をひらいています…'));
    ai.ready();
    await store.init();
    saveState('saved');
    saveWhere();
    // 共有リンク（#share=…）のように、画面の名前ではないハッシュは、受け取る係（Kit.hashHandlers）に先に渡す
    const route = () => {
      const raw = location.hash.slice(1);
      for (const fn of Kit.hashHandlers) {
        let to = null;
        try { to = fn(raw); } catch (e) { console.error(e); }
        if (to) { try { history.replaceState(null, '', '#' + to); } catch (e) { /* noop */ } mount(to); return; }
      }
      mount(raw || 'home');
    };
    window.addEventListener('hashchange', route);
    route();
    const flush = () => { store.flush(); };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
  };
})();

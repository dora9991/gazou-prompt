/*
 * 画像生成プロンプト処方箋 ― 需要ダッシュボード（管理画面）
 * 記録は Supabase の関数（管理キーが要る）から受け取り、集計はこの画面の中でする（js/analyze.js）。
 * 参加者が書いた文は、すべて textContent で表示する（HTML として読まない）。
 */
(function () {
  'use strict';
  var T = window.GP_TAGS, A = window.GP_ANALYZE, API = window.GP_API;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  }
  function add(el, kid) {
    if (kid == null || kid === false) return;
    if (Array.isArray(kid)) { kid.forEach(function (k) { add(el, k); }); return; }
    el.appendChild(typeof kid === 'string' ? document.createTextNode(kid) : kid);
  }
  function svg(tag, attrs) {
    var el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.keys(attrs || {}).forEach(function (k) { if (attrs[k] != null) el.setAttribute(k, attrs[k]); });
    for (var i = 2; i < arguments.length; i++) if (arguments[i]) el.appendChild(arguments[i]);
    return el;
  }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }
  function fmt(n) { return Number(n || 0).toLocaleString('ja-JP'); }
  function p100(x) { return Math.round((x || 0) * 100) + '%'; }
  var DAY = 86400000;

  // ------------------------------------------------------------ 状態
  var KEY_STORE = 'gp.adminKey';
  var S = {
    key: '', demo: false, rows: [], all: [], status: null, truncated: false, fetchedAt: 0, loading: false,
    range: 'all', from: '', to: '', cohort: '*', noPreset: false, tag: '', tag2: '', user: '', userName: '',
    textKind: 'all', q: '', shown: 40, sel: new Set(), views: {}, expand: {}, sum: null
  };
  var RANGES = [['today', '今日'], ['7', '7日'], ['30', '30日'], ['all', '全期間'], ['custom', '期間を指定']];
  var KINDS = [['all', 'すべて'], ['wish', '描きたいもの'], ['trouble', '困っていること'], ['comment', 'いまいちの声'], ['fix', '直したいこと'], ['title', '入れたい文字']];
  var KIND_LABEL = { wish: '描きたいもの', trouble: '困っていること', comment: 'いまいちの声', fix: '直したいこと', title: '入れたい文字' };

  function readKey() {
    try { return sessionStorage.getItem(KEY_STORE) || localStorage.getItem(KEY_STORE) || ''; } catch (e) { return ''; }
  }
  function saveKey(k, remember) {
    try {
      sessionStorage.setItem(KEY_STORE, k);
      if (remember) localStorage.setItem(KEY_STORE, k); else localStorage.removeItem(KEY_STORE);
    } catch (e) { /* 保存できなくても、この画面の間は使える */ }
  }
  function forgetKey() { try { sessionStorage.removeItem(KEY_STORE); localStorage.removeItem(KEY_STORE); } catch (e) { /* 何もしない */ } }

  var toastTimer = null;
  function toast(msg) {
    var el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2600);
  }

  function errText(r) {
    var e = r && r.error;
    if (e === 'bad_key') return '管理キーがちがいます（作り直した場合は、新しいキーを入れてください）。';
    if (e === 'not_configured') return '記録の送り先が設定されていません（config.js に Supabase の URL と公開用キーを入れてください）。';
    if (e === 'network') return '通信できませんでした。インターネットにつながっているか確かめてください。';
    if (e === 'timeout') return '時間内に返事がありませんでした。もう一度ためしてください。';
    if (/^http_(404|406)$/.test(e || '') || (r && /PGRST106|schema/i.test(String(r.detail || '')))) return 'Supabase の準備（SQL を流す・Exposed schemas に gazou_prompt を足す）がまだ終わっていないようです。';
    return '読み込めませんでした（' + (e || '不明') + '）。';
  }

  // ------------------------------------------------------------ ログインと読み込み
  function showDash(on) {
    $('#login').hidden = on;
    $('#dash').hidden = !on;
    $('#top-actions').hidden = !on;
  }

  function login(key, remember) {
    var err = $('#login-err');
    err.textContent = '';
    key = String(key || '').trim();
    if (!/^gp_[0-9a-f]{20,}$/.test(key)) { err.textContent = '管理キーは gp_ で始まる長い文字です。コピーした全体を貼ってください。'; return Promise.resolve(false); }
    var btn = $('#login-go');
    btn.disabled = true;
    return API.rpc('admin_status', { p_key: key }).then(function (st) {
      btn.disabled = false;
      if (!st || !st.ok) { err.textContent = errText(st); if (st && st.error === 'bad_key') forgetKey(); return false; }
      S.key = key; S.demo = false;
      saveKey(key, remember);
      $('#key').value = '';
      S.status = st;
      showDash(true);
      return load();
    });
  }

  function load() {
    if (S.demo) { render(); return Promise.resolve(true); }
    S.loading = true;
    $('#dash').classList.add('loading');
    $('#sync-line').textContent = '読み込み中…';
    return Promise.all([API.rpc('admin_status', { p_key: S.key }), API.rpc('admin_events', { p_key: S.key, p_limit: 50000 }, { timeout: 60000 })]).then(function (res) {
      S.loading = false;
      $('#dash').classList.remove('loading');
      var st = res[0], ev = res[1];
      if (!st.ok || !ev.ok) {
        var bad = !st.ok ? st : ev;
        if (bad.error === 'bad_key') { forgetKey(); S.key = ''; showDash(false); $('#login-err').textContent = errText(bad); return false; }
        $('#sync-line').textContent = errText(bad);
        return false;
      }
      S.status = st;
      S.rows = ev.rows || [];
      S.truncated = !!ev.truncated;
      S.all = A.prepare(S.rows);
      S.fetchedAt = Date.now();
      S.sel.clear();
      render();
      return true;
    });
  }

  function startDemo() {
    S.demo = true; S.key = '';
    var now = Date.now();
    S.rows = window.GP_SAMPLE.make({ now: now });
    S.all = A.prepare(S.rows);
    var cohorts = {};
    S.all.forEach(function (g) { var c = cohorts[g.cohort] = cohorts[g.cohort] || { cohort: g.cohort, generates: 0, visitors: {}, last_at: g.at }; c.generates++; c.visitors[g.visitor] = 1; c.last_at = Math.max(c.last_at, g.at); });
    S.status = { ok: true, demo: true, settings: { logging_enabled: true, max_events_per_day: 5000, max_bytes_per_day: 3000000, max_total_bytes: 30000000, stored_bytes: 412345, admin_failures: 0 },
      today: { events: 37, bytes: 9800, refused: 0 }, total_events: S.rows.length,
      cohorts: Object.keys(cohorts).map(function (k) { var c = cohorts[k]; return { cohort: c.cohort, generates: c.generates, visitors: Object.keys(c.visitors).length, last_at: new Date(c.last_at).toISOString() }; }) };
    S.fetchedAt = now;
    showDash(true);
    render();
  }

  // ------------------------------------------------------------ しぼりこみ
  function todayStart() { return A.dayStart(A.jstDay(Date.now())); }
  function opts(shift) {
    var o = { cohort: S.cohort, excludePresets: S.noPreset, tag: S.tag || null, tag2: S.tag2 || null, user: S.user || null, now: Date.now() };
    var t0 = todayStart();
    var len = 0;
    if (S.range === 'today') { o.since = t0; o.until = t0 + DAY; len = 1; }
    else if (S.range === '7') { o.since = t0 - 6 * DAY; o.until = t0 + DAY; len = 7; }
    else if (S.range === '30') { o.since = t0 - 29 * DAY; o.until = t0 + DAY; len = 30; }
    else if (S.range === 'custom') {
      if (S.from) o.since = A.dayStart(S.from);
      if (S.to) o.until = A.dayStart(S.to) + DAY;
    }
    if (shift && len) { o.since -= len * DAY; o.until -= len * DAY; }
    return o;
  }
  function filtered(o) {
    var gens = A.filterGens(S.all, o);
    if (o.tag2) gens = gens.filter(function (g) { return g.tags.indexOf(o.tag2) >= 0; });
    return gens;
  }

  function renderFilters() {
    var seg = clear($('#range'));
    RANGES.forEach(function (r) {
      seg.appendChild(h('button', { type: 'button', role: 'radio', 'aria-checked': S.range === r[0] ? 'true' : 'false', 'data-range': r[0], text: r[1] }));
    });
    $('#custom-range').hidden = S.range !== 'custom';
    var sel = clear($('#cohort'));
    sel.appendChild(h('option', { value: '*', text: 'すべて' }));
    ((S.status && S.status.cohorts) || []).forEach(function (c) {
      sel.appendChild(h('option', { value: c.cohort, text: (c.cohort || '（コードなし）') + '　' + fmt(c.generates) + '回' }));
    });
    sel.value = S.cohort;
    if (sel.value !== S.cohort) { S.cohort = '*'; sel.value = '*'; }
    $('#no-preset').checked = S.noPreset;
    var act = clear($('#active-filter'));
    act.hidden = !S.tag && !S.user;
    if (S.tag || S.user) {
      var parts = [];
      if (S.user) parts.push('👤 ' + (S.userName || '（表示名なし）'));
      if (S.tag) parts.push(label(S.tag) + (S.tag2 ? ' × ' + label(S.tag2) : ''));
      act.appendChild(h('span', { text: 'しぼりこみ中：' + parts.join('・') }));
      act.appendChild(h('button', { type: 'button', 'data-act': 'clear-tag', 'aria-label': 'しぼりこみをやめる', text: '×' }));
    }
    $('#demo-banner').hidden = !S.demo;
    var when = S.fetchedAt ? new Date(S.fetchedAt) : null;
    $('#sync-line').textContent = (S.demo ? '見本データ' : '読み込み ' + (when ? pad(when.getHours()) + ':' + pad(when.getMinutes()) : '')) +
      (S.truncated ? '（新しい5万件まで）' : '');
    $('#refresh').hidden = S.demo;
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function label(id) { var t = T.byId(id); return t ? t.label : id; }

  // ------------------------------------------------------------ 描く
  function render() {
    var o = opts();
    var sum = A.summarize(filtered(o), o);
    S.sum = sum;
    var prev = null;
    if (S.range === '7' || S.range === '30' || S.range === 'today') { var po = opts(true); prev = A.summarize(filtered(po), po); }
    renderFilters();
    renderKpis(sum, prev);
    renderInsights(sum);
    renderCards(sum);
    renderTexts(sum);
    renderNewWords(sum);
    renderData();
    renderShare();
  }

  function tile(lab, value, unit, sub, delta) {
    return h('div', { class: 'kpi' }, h('p', { class: 'kpi-label', text: lab }), h('p', { class: 'kpi-value' }, value, unit ? h('small', { text: unit }) : null),
      sub ? h('p', { class: 'kpi-sub', text: sub }) : null, delta ? h('p', { class: 'kpi-delta', text: delta }) : null);
  }
  function deltaText(now, before, name) {
    if (before == null) return '';
    var d = now - before;
    return '前の' + name + 'より ' + (d > 0 ? '+' : d < 0 ? '−' : '±') + fmt(Math.abs(d));
  }
  function renderKpis(sum, prev) {
    var k = sum.kpi, box = clear($('#kpis'));
    var name = S.range === 'today' ? '日' : S.range + '日';
    box.appendChild(tile('処方箋を出した回数', fmt(k.gens), '回', 'おためし ' + fmt(k.presets) + '回・直す用 ' + fmt(k.edit) + '回', prev ? deltaText(k.gens, prev.kpi.gens, name) : ''));
    box.appendChild(tile('使った人（端末の数）', fmt(k.visitors), '台', '1台あたり ' + (k.perVisitor ? k.perVisitor.toFixed(1) : '0') + '回', prev ? deltaText(k.visitors, prev.kpi.visitors, name) : ''));
    box.appendChild(tile('指示文がコピーされた', p100(k.copyRate), '', fmt(k.copied) + '回 ／ ' + fmt(k.gens) + '回'));
    box.appendChild(tile('「うまくいった」', k.rated ? p100(k.goodRate) : '—', '', k.rated ? '評価 ' + fmt(k.rated) + '回のうち ' + fmt(k.good) + '回' : 'まだ評価はありません'));
    box.appendChild(tile('自由記述のあった回', fmt(k.texts), '回', 'いまいちの声 ' + fmt(k.comments) + '件'));
    if (lineOn() || k.lineUsers) box.appendChild(tile('LINE でつながった人', fmt(k.lineUsers), '人', 'LINE つきの回 ' + fmt(k.lineGens) + '回（' + p100(k.gens ? k.lineGens / k.gens : 0) + '）'));
  }

  function renderInsights(sum) {
    var ul = clear($('#insights'));
    if (!sum.n) { ul.appendChild(h('li', { text: S.all.length ? 'この範囲には、まだ記録がありません。期間や講座コードを変えてみてください。' : 'まだ記録がありません。参加者が「処方箋を出す」を押すと、ここに集まります。' })); return; }
    sum.insights.forEach(function (x) { ul.appendChild(h('li', { text: x.text })); });
  }

  // ---- カードの見出し（表で見る の切りかえつき）
  function cardHead(card, title, sub, toggleable) {
    var view = S.views[card.id] || 'chart';
    return h('div', { class: 'card-head' },
      h('div', null, h('h2', { class: 'card-h', text: title }), sub ? h('p', { class: 'card-note', text: sub }) : null),
      toggleable ? h('button', { type: 'button', class: 'view-toggle', 'data-view': card.id, 'aria-pressed': view === 'table' ? 'true' : 'false', text: view === 'table' ? 'グラフで見る' : '表で見る' }) : null);
  }
  function isTable(card) { return S.views[card.id] === 'table'; }
  function table(head, rows, numCols) {
    numCols = numCols || [];
    return h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' },
      h('thead', null, h('tr', null, head.map(function (x, i) { return h('th', { class: numCols.indexOf(i) >= 0 ? 'num' : null, scope: 'col', text: x }); }))),
      h('tbody', null, rows.map(function (r) { return h('tr', null, r.map(function (x, i) { return h('td', { class: numCols.indexOf(i) >= 0 ? 'num' : null, text: String(x) }); })); }))));
  }

  // ---- 横棒の一覧
  function barList(items, cfg) {
    cfg = cfg || {};
    if (!items.length) return h('p', { class: 'empty', text: cfg.empty || 'まだありません。' });
    var limit = cfg.limit || 10;
    var key = cfg.key || '';
    var showAll = S.expand[key];
    var shown = showAll ? items : items.slice(0, limit);
    var max = Math.max.apply(null, items.map(function (x) { return cfg.value ? cfg.value(x) : x.n; }).concat([1e-9]));
    var ul = h('ul', { class: 'bars' });
    shown.forEach(function (x) {
      var v = cfg.value ? cfg.value(x) : x.n;
      var fill = h('span', { class: 'bar-fill' });
      fill.style.width = Math.max(0.5, (v / max) * 100) + '%';
      var tag = cfg.clickable && T.byId(x.id) ? x.id : null;
      var row = h(tag ? 'button' : 'div', {
        class: 'bar-row', type: tag ? 'button' : null, 'data-tag': tag, 'aria-pressed': tag ? (S.tag === tag ? 'true' : 'false') : null,
        tabindex: tag ? null : '0', 'data-tv': cfg.tipValue ? cfg.tipValue(x) : fmt(x.n) + '回', 'data-tl': x.label, 'data-ts': cfg.tipSub ? cfg.tipSub(x) : (x.share != null ? '処方箋を出した回の ' + p100(x.share) : '')
      },
        h('span', { class: 'bar-label', text: x.label }),
        h('span', { class: 'bar-track' }, fill),
        h('span', { class: 'bar-val' }, cfg.valText ? cfg.valText(x) : fmt(x.n), cfg.subText ? h('small', { text: cfg.subText(x) }) : (x.share != null ? h('small', { text: p100(x.share) }) : null)));
      ul.appendChild(h('li', null, row));
    });
    var wrap = h('div', null, ul);
    if (items.length > limit) {
      wrap.appendChild(h('button', { type: 'button', class: 'btn-small bars-more', 'data-expand': key, text: showAll ? '上位だけにする' : 'すべて見る（' + items.length + '）' }));
    }
    return wrap;
  }

  function barCard(id, title, sub, items, cfg) {
    var card = clear($('#' + id));
    card.appendChild(cardHead(card, title, sub, true));
    if (isTable(card)) {
      card.appendChild(items.length ? table(['項目', '回数', '割合'], items.map(function (x) { return [x.label, fmt(x.n), x.share != null ? p100(x.share) : '']; }), [1, 2]) : h('p', { class: 'empty', text: 'まだありません。' }));
    } else {
      card.appendChild(barList(items, Object.assign({ key: id }, cfg || {})));
    }
  }

  // ---- 日ごとの縦棒
  function niceMax(m) {
    if (m <= 4) return 4;
    var p = Math.pow(10, Math.floor(Math.log10(m)));
    var steps = [1, 2, 2.5, 5, 10];
    for (var i = 0; i < steps.length; i++) { var top = steps[i] * p; if (top >= m) return top; }
    return 10 * p;
  }
  function dailyCard(sum) {
    var card = clear($('#card-daily'));
    card.appendChild(cardHead(card, '日ごとの回数', '処方箋を出した回数（日本時間）', true));
    var data = sum.daily;
    if (!data.length) { card.appendChild(h('p', { class: 'empty', text: 'まだありません。' })); return; }
    if (isTable(card)) { card.appendChild(table(['日付', '回数'], data.slice().reverse().map(function (d) { return [d.day, fmt(d.n)]; }), [1])); return; }
    var W = Math.max(280, Math.min(card.clientWidth - 32, 900) || 560), H = 190, padL = 34, padR = 8, padT = 22, axisH = 24;
    var plotW = W - padL - padR, plotH = H - padT - axisH;
    var max = Math.max.apply(null, data.map(function (d) { return d.n; }));
    var top = niceMax(max);
    var g = svg('svg', { class: 'cols', viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, role: 'img', 'aria-label': '日ごとの回数。最大 ' + max + '回' });
    var grid = svg('g', { class: 'grid' }), axis = svg('g', { class: 'axis' }), labels = svg('g', null), bars = svg('g', null);
    var ticks = 4;
    for (var i = 0; i <= ticks; i++) {
      var v = top * i / ticks, y = padT + plotH - plotH * v / top;
      if (i > 0) grid.appendChild(svg('line', { x1: padL, x2: W - padR, y1: y, y2: y }));
      var tx = svg('text', { x: padL - 6, y: y + 4, 'text-anchor': 'end' }); tx.textContent = fmt(Math.round(v)); labels.appendChild(tx);
    }
    axis.appendChild(svg('line', { x1: padL, x2: W - padR, y1: padT + plotH, y2: padT + plotH }));
    var band = plotW / data.length;
    var bw = Math.max(2, Math.min(24, band * 0.72));
    var every = Math.max(1, Math.ceil(data.length / 8));
    var peakI = data.reduce(function (bi, d, i2) { return d.n > data[bi].n ? i2 : bi; }, 0);
    data.forEach(function (d, i3) {
      var cx = padL + band * (i3 + 0.5);
      var hgt = plotH * d.n / top;
      var x = cx - bw / 2, base = padT + plotH, y0 = base - hgt;
      var r = Math.min(4, hgt, bw / 2);
      var path = hgt <= 0 ? '' : 'M' + x + ',' + base + 'V' + (y0 + r) + 'Q' + x + ',' + y0 + ' ' + (x + r) + ',' + y0 + 'H' + (x + bw - r) + 'Q' + (x + bw) + ',' + y0 + ' ' + (x + bw) + ',' + (y0 + r) + 'V' + base + 'Z';
      var md = d.day.slice(5).replace('-', '/').replace(/^0/, '').replace('/0', '/');
      var hit = svg('rect', { class: 'hit', x: padL + band * i3, y: padT, width: band, height: plotH, tabindex: '0', 'data-tv': fmt(d.n) + '回', 'data-tl': d.day.replace(/-/g, '/'), 'data-ts': '' });
      bars.appendChild(hit);
      if (path) bars.appendChild(svg('path', { class: 'col', d: path }));
      // 日付は、最後の日から数えて等間隔に（右端の2つが重ならないように）
      if ((data.length - 1 - i3) % every === 0) { var t = svg('text', { x: cx, y: H - 6, 'text-anchor': 'middle' }); t.textContent = md; labels.appendChild(t); }
      if (i3 === peakI && d.n > 0) { var pl = svg('text', { class: 'peak-label', x: cx, y: y0 - 6, 'text-anchor': 'middle' }); pl.textContent = fmt(d.n); labels.appendChild(pl); }
    });
    g.appendChild(grid); g.appendChild(axis); g.appendChild(bars); g.appendChild(labels);
    card.appendChild(g);
  }

  // ---- 困りごと × 作りたいもの
  function matrixCard(sum) {
    var card = clear($('#card-matrix'));
    card.appendChild(cardHead(card, '困りごと × 作りたいもの', 'どの使い道で、どんな困りごとが多いか（数が多いほど濃い。押すと、その組み合わせでしぼりこみ）', true));
    var m = sum.matrix;
    if (!m.rows.length || !m.cols.length) { card.appendChild(h('p', { class: 'empty', text: '困りごとと作りたいものの両方が選ばれた回が、まだありません。' })); return; }
    if (isTable(card)) {
      card.appendChild(table(['困りごと'].concat(m.cols.map(function (c) { return c.label; })), m.rows.map(function (r, i) { return [r.label].concat(m.cells[i].map(fmt)); }), m.cols.map(function (_, i) { return i + 1; })));
      return;
    }
    var max = Math.max.apply(null, m.cells.map(function (r) { return Math.max.apply(null, r); }).concat([1]));
    var tb = h('table', { class: 'heat' },
      h('thead', null, h('tr', null, h('th', { scope: 'col', text: '' }), m.cols.map(function (c) { return h('th', { scope: 'col', text: c.label }); }))),
      h('tbody', null, m.rows.map(function (r, i) {
        return h('tr', null, h('th', { scope: 'row', text: r.label }), m.cells[i].map(function (v, j) {
          if (!v) return h('td', { class: 'z', 'data-tv': '0回', 'data-tl': r.label + ' × ' + m.cols[j].label, tabindex: '0', text: '' });
          var bin = Math.min(7, Math.max(1, Math.ceil(7 * v / max)));
          var td = h('td', { class: 's' + bin + ' ink-' + bin });
          td.appendChild(h('button', { type: 'button', 'data-pair': r.id + '|' + m.cols[j].id, 'data-tv': fmt(v) + '回', 'data-tl': r.label + ' × ' + m.cols[j].label, 'data-ts': '押すと、この組み合わせでしぼりこみ', 'aria-label': r.label + ' と ' + m.cols[j].label + '：' + v + '回', text: fmt(v) }));
          return td;
        }));
      })));
    card.appendChild(h('div', { class: 'heat-wrap' }, tb));
    var lg = h('div', { class: 'heat-legend' }, h('span', { text: '少ない' }));
    for (var b = 1; b <= 7; b++) { var sw = h('span', { class: 'sw s' + b }); lg.appendChild(sw); }
    lg.appendChild(h('span', { text: '多い（いちばん多いマス ' + fmt(max) + '回）' }));
    card.appendChild(lg);
  }

  // ---- 人ごと（LINE でつながった人）
  function lineOn() { return !!((window.GP_CONFIG || {}).liffId) || !!(S.status && S.status.line_users); }
  function usersCard(sum) {
    var card = clear($('#card-users'));
    var list = sum.byUser || [];
    card.hidden = !(lineOn() || list.length);
    if (card.hidden) return;
    card.appendChild(cardHead(card, '人ごと（LINE でつながった人）', '公式LINE から開いた人の記録。名前を押すと、その人の記録だけにしぼりこめます', true));
    if (!list.length) { card.appendChild(h('p', { class: 'empty', text: 'この範囲には、LINE でつながった人の記録がまだありません。' })); return; }
    if (isTable(card)) {
      card.appendChild(table(['LINE の表示名', '処方箋を出した回数', 'よく選ぶ困りごと', '自由記述', 'いまいち', '最後に使った日'], list.map(function (u) { return [u.label, fmt(u.n), u.troubles.join('・'), fmt(u.texts), fmt(u.bad), jst(u.last)]; }), [1, 3, 4]));
      return;
    }
    var limit = 12, key = 'card-users';
    var shown = S.expand[key] ? list : list.slice(0, limit);
    var max = Math.max.apply(null, list.map(function (u) { return u.n; }).concat([1]));
    var ul = h('ul', { class: 'bars users' });
    shown.forEach(function (u) {
      var fill = h('span', { class: 'bar-fill' });
      fill.style.width = Math.max(0.5, u.n / max * 100) + '%';
      ul.appendChild(h('li', null, h('button', { type: 'button', class: 'bar-row', 'data-user': u.id, 'data-user-name': u.label, 'aria-pressed': S.user === u.id ? 'true' : 'false',
        'data-tv': fmt(u.n) + '回', 'data-tl': u.label, 'data-ts': (u.troubles.length ? 'よく選ぶ困りごと：' + u.troubles.join('・') : '') + '　最後 ' + jst(u.last) },
        h('span', { class: 'bar-label', text: u.label }), h('span', { class: 'bar-track' }, fill),
        h('span', { class: 'bar-val' }, fmt(u.n), h('small', { text: u.troubles[0] || '' })))));
    });
    card.appendChild(ul);
    if (list.length > limit) card.appendChild(h('button', { type: 'button', class: 'btn-small bars-more', 'data-expand': key, text: S.expand[key] ? '上位だけにする' : 'すべて見る（' + list.length + '）' }));
    if (S.user) {
      card.appendChild(h('div', { class: 'ad-user-actions' },
        h('p', { class: 'card-note', text: '「' + (S.userName || '（表示名なし）') + '」さんから、記録を消してほしいと頼まれたとき：' }),
        h('div', { class: 'ad-btns' },
          h('button', { type: 'button', class: 'btn-small', 'data-act': 'forget-user', text: '名前から切り離す（記録は名前なしで残す）' }),
          h('button', { type: 'button', class: 'btn-small danger', 'data-act': 'delete-user', text: 'この人の記録をすべて消す' }))));
    }
  }

  function renderCards(sum) {
    usersCard(sum);
    var n = sum.n;
    barCard('card-trouble', '困りごと', '処方箋を出した回のうち、その困りごとが選ばれた回数（押すと、その困りごとでしぼりこみ）', sum.byCat.trouble, { clickable: true, empty: 'まだ困りごとは選ばれていません。' });
    barCard('card-use', '作りたいもの', '何に使う絵を作ろうとしているか（押すと、しぼりこみ）', sum.byCat.use, { clickable: true });
    dailyCard(sum);
    barCard('card-area', '困りごとのまとまり', '困りごとを種類ごとにまとめたもの（1回の中で同じまとまりは1回と数える）', sum.areas, { limit: 8 });
    matrixCard(sum);
    barCard('card-tool', '使うAI', '指示文を貼る先として選ばれたAI', sum.byCat.tool, { clickable: true, limit: 7 });
    barCard('card-style', '絵のタッチ', '選ばれたタッチ', sum.byCat.style, { clickable: true });
    barCard('card-scene', '場面・テーマ', '選ばれた場面・テーマ', sum.byCat.scene, { clickable: true });
    var look = [].concat(
      sum.byCat.mood.map(function (x) { return Object.assign({}, x, { label: '雰囲気：' + x.label }); }),
      sum.byCat.color.map(function (x) { return Object.assign({}, x, { label: '色：' + x.label }); }),
      sum.byCat.ratio.map(function (x) { return Object.assign({}, x, { label: '形：' + x.label }); }),
      sum.byCat.people.map(function (x) { return Object.assign({}, x, { label: '人物：' + x.label }); })
    ).sort(function (a, b) { return b.n - a.n; });
    barCard('card-look', '雰囲気・色・形・人物', '「どんな感じに」「細かく決める」で選ばれたもの', look, { clickable: true });
    // うまくいかなかった困りごと
    var hard = sum.hardTroubles;
    barCard('card-hard', '「いまいち」が多い困りごと', '評価が5回以上ついた困りごとのうち、「いまいち」の割合（指示文だけでは解決しにくい＝講座で扱いたいところ）', hard, {
      clickable: true, value: function (x) { return x.badRate; }, valText: function (x) { return p100(x.badRate); }, subText: function (x) { return 'いまいち ' + x.bad + '／' + x.rated; },
      tipValue: function (x) { return 'いまいち ' + p100(x.badRate); }, tipSub: function (x) { return '評価 ' + x.rated + '回のうち ' + x.bad + '回'; }, empty: '評価が5回以上ついた困りごとは、まだありません。'
    });
    var edit = [].concat(sum.byCat.change.map(function (x) { return Object.assign({}, x, { label: '直す：' + x.label }); }), sum.byCat.keep.map(function (x) { return Object.assign({}, x, { label: '残す：' + x.label }); }))
      .sort(function (a, b) { return b.n - a.n; });
    barCard('card-edit', 'できた画像を直す', '「できた画像を直す」で選ばれたもの（直したいところ・残したいところ）', edit, { clickable: true, empty: '「できた画像を直す」は、まだ使われていません。' });
    void n;
  }

  // ------------------------------------------------------------ 自由記述
  function textsAll(sum) {
    var q = S.q.trim();
    var words = q ? q.split(/[\s　]+/).filter(Boolean) : [];
    return sum.texts.filter(function (x) {
      if (S.textKind !== 'all' && x.kind !== S.textKind) return false;
      return words.every(function (w) { return x.text.indexOf(w) >= 0 || A.norm(x.text).indexOf(A.norm(w)) >= 0; });
    });
  }
  function highlight(text, q) {
    var words = String(q || '').trim().split(/[\s　]+/).filter(Boolean);
    if (!words.length) return document.createTextNode(text);
    var frag = document.createDocumentFragment();
    var re = new RegExp('(' + words.map(function (w) { return w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|') + ')', 'g');
    String(text).split(re).forEach(function (part, i) {
      if (!part) return;
      frag.appendChild(i % 2 ? h('mark', { class: 'hit', text: part }) : document.createTextNode(part));
    });
    return frag;
  }
  function jst(t) { var d = new Date(t + 9 * 3600000); return d.toISOString().slice(5, 16).replace('T', ' ').replace('-', '/'); }

  function renderTexts(sum) {
    var counts = {};
    sum.texts.forEach(function (x) { counts[x.kind] = (counts[x.kind] || 0) + 1; });
    var seg = clear($('#text-kinds'));
    KINDS.forEach(function (k) {
      var c = k[0] === 'all' ? sum.texts.length : (counts[k[0]] || 0);
      if (k[0] !== 'all' && !c) return;
      seg.appendChild(h('button', { type: 'button', role: 'radio', 'aria-checked': S.textKind === k[0] ? 'true' : 'false', 'data-kind': k[0], text: k[1] + ' ' + fmt(c) }));
    });
    if (S.textKind !== 'all' && !counts[S.textKind]) S.textKind = 'all';
    var q = $('#text-q');
    if (q.value !== S.q) q.value = S.q;
    var wbox = clear($('#words'));
    sum.words.slice(0, 18).forEach(function (w) {
      wbox.appendChild(h('button', { type: 'button', class: 'word', 'data-word': w.w, 'aria-pressed': S.q === w.w ? 'true' : 'false' }, w.w, h('small', { text: fmt(w.n) })));
    });
    var list = textsAll(sum);
    $('#texts-count').textContent = fmt(list.length) + '件';
    var ol = clear($('#text-list'));
    if (!list.length) ol.appendChild(h('li', { class: 'empty', text: sum.texts.length ? '当てはまる文はありません。' : 'まだ自由記述はありません。' }));
    list.slice(0, S.shown).forEach(function (x) {
      var key = x.id + ':' + x.kind;
      ol.appendChild(h('li', { class: 'txt' },
        h('input', { type: 'checkbox', 'data-sel': String(x.id), 'aria-label': '選ぶ', checked: S.sel.has(x.id) ? true : null }),
        h('div', { class: 'txt-body' },
          h('p', { class: 'txt-text' }, highlight(x.text, S.q)),
          h('p', { class: 'txt-meta' }, h('span', { class: 'txt-kind', text: KIND_LABEL[x.kind] || x.kind }), x.who ? h('span', { class: 'txt-who', text: '👤 ' + x.who }) : null, h('span', { text: jst(x.at) }), x.cohort ? h('span', { text: x.cohort }) : null,
            x.tags.slice(0, 4).map(function (t) { return h('span', { class: 'txt-tag', text: t }); })))));
      void key;
    });
    $('#more-texts').hidden = list.length <= S.shown;
    syncBulk();
  }
  function syncBulk() {
    var n = S.sel.size;
    $('#bulk').hidden = n === 0;
    $('#bulk-count').textContent = n + '件 選んでいます';
  }

  function renderNewWords(sum) {
    var card = clear($('#card-newwords'));
    card.appendChild(h('h2', { class: 'card-h', text: 'タグにない言葉（新しいタグの候補）' }));
    card.appendChild(h('p', { class: 'card-note', text: '自由記述に2回以上出てくるのに、いまのタグ（名前・別の言い方）にない言葉です。押すと、その言葉の入った文を探します。' }));
    if (!sum.newWords.length) { card.appendChild(h('p', { class: 'empty', text: 'まだありません。' })); return; }
    card.appendChild(h('div', { class: 'nw-list' }, sum.newWords.map(function (w) {
      return h('button', { type: 'button', class: 'word', 'data-word': w.w }, w.w, h('small', { text: fmt(w.n) + '回' }));
    })));
  }

  // ------------------------------------------------------------ 記録の管理
  function mb(b) { return (Number(b || 0) / 1e6).toFixed(b < 1e6 ? 2 : 1) + 'MB'; }
  function renderData() {
    var st = S.status || {}, s = st.settings || {}, td = st.today || {};
    $('#logging-line').textContent = S.demo ? '見本データでは変えられません。' : (s.logging_enabled ? 'いま：参加者の記録を受けつけています。' : 'いま：記録を止めています（参加者の画面はそのまま使えます）。');
    var tb = $('#toggle-logging');
    tb.textContent = s.logging_enabled ? '記録を止める' : '記録を再開する';
    tb.disabled = S.demo;
    var ul = clear($('#usage'));
    ul.appendChild(h('li', { text: '今日の記録：' + fmt(td.events) + '件 ／ 上限 ' + fmt(s.max_events_per_day) + '件' + (td.refused ? '（断った ' + fmt(td.refused) + '件）' : '') }));
    ul.appendChild(h('li', { text: '保存している量：' + mb(s.stored_bytes) + ' ／ 上限 ' + mb(s.max_total_bytes) }));
    ul.appendChild(h('li', { text: '記録の全件数：' + fmt(st.total_events) + '件' }));
    ul.appendChild(h('li', { text: '管理キーの入力まちがい：' + fmt(s.admin_failures) + '回' + (s.admin_failed_at ? '（最後 ' + jst(Date.parse(s.admin_failed_at)) + '）' : '') }));
    var ps = clear($('#purge-cohort'));
    ((st.cohorts) || []).forEach(function (c) { ps.appendChild(h('option', { value: c.cohort, text: (c.cohort || '（コードなし）') + '　' + fmt(c.generates) + '回' })); });
    $('#purge').disabled = S.demo || !ps.options.length;
  }

  // ------------------------------------------------------------ 配るリンクと QR
  function defaultBase() {
    try {
      if (/^https?:$/.test(location.protocol)) return new URL('./', location.href).href;
    } catch (e) { /* 下へ */ }
    return '';
  }
  function liffId() { return String((window.GP_CONFIG || {}).liffId || ''); }
  function shareUrl() {
    var base = $('#share-base').value.trim() || defaultBase();
    var code = $('#share-code').value.trim();
    // 公式LINE 用：LIFF の URL（https://liff.line.me/<LIFF ID>?c=…）。LINE の中で開き、だれが押したかが分かる
    if (liffId() && $('#share-liff').checked) {
      return 'https://liff.line.me/' + encodeURIComponent(liffId()) + (code ? '?c=' + encodeURIComponent(code) : '');
    }
    if (!base) return '';
    try {
      var u = new URL(base);
      if (/admin\.html$/.test(u.pathname)) u.pathname = u.pathname.replace(/admin\.html$/, '');
      if (code) u.searchParams.set('c', code); else u.searchParams.delete('c');
      return u.href;
    } catch (e) { return ''; }
  }
  var qrCanvas = null;
  function renderShare() {
    $('#share-liff-wrap').hidden = !liffId();
    var base = $('#share-base');
    if (!base.value && defaultBase()) base.value = defaultBase();
    var code = $('#share-code').value.trim();
    var okCode = !code || /^[A-Za-z0-9_-]{1,32}$/.test(code);
    var url = okCode ? shareUrl() : '';
    $('#share-url').textContent = url || (okCode ? '参加者用ページの URL を入れてください（公開したあとの https://… の URL）' : '講座コードは英数字・- ・_ の32文字までです');
    var box = clear($('#qr'));
    qrCanvas = null;
    $('#copy-url').disabled = !url; $('#save-qr').disabled = !url;
    if (!url || typeof window.qrcode !== 'function') return;
    var qr = window.qrcode(0, 'M');
    qr.addData(url);
    qr.make();
    var n = qr.getModuleCount(), cell = 8, margin = 4;
    var c = document.createElement('canvas');
    c.width = c.height = (n + margin * 2) * cell;
    var ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = '#000000';
    for (var r = 0; r < n; r++) for (var k = 0; k < n; k++) if (qr.isDark(r, k)) ctx.fillRect((k + margin) * cell, (r + margin) * cell, cell, cell);
    c.setAttribute('role', 'img');
    c.setAttribute('aria-label', 'QRコード：' + url);
    box.appendChild(c);
    qrCanvas = c;
  }

  // ------------------------------------------------------------ 書き出し
  function download(name, blob) {
    var a = h('a', { href: URL.createObjectURL(blob), download: name });
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  function stamp() { var d = new Date(); return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + pad(d.getHours()) + pad(d.getMinutes()); }

  // ------------------------------------------------------------ 確認ダイアログ（画面の中に出す）
  function confirmBox(text, typeWord) {
    return new Promise(function (resolve) {
      var dlg = $('#confirm');
      $('#confirm-text').textContent = text;
      var wrap = $('#confirm-type-wrap'), inp = $('#confirm-type'), yes = $('#confirm-yes');
      wrap.hidden = !typeWord;
      inp.value = '';
      $('#confirm-type-label').textContent = typeWord ? '確認のため「' + typeWord + '」と入力してください' : '';
      yes.disabled = !!typeWord;
      function onInput() { yes.disabled = inp.value.trim() !== typeWord; }
      function done(v) { inp.removeEventListener('input', onInput); yes.onclick = null; $('#confirm-no').onclick = null; dlg.close(); resolve(v); }
      inp.addEventListener('input', onInput);
      yes.onclick = function () { done(true); };
      $('#confirm-no').onclick = function () { done(false); };
      dlg.oncancel = function () { done(false); };
      dlg.showModal();
      if (typeWord) inp.focus();
    });
  }

  function redact(del) {
    var ids = Array.from(S.sel);
    if (!ids.length) return;
    var msg = del ? '選んだ ' + ids.length + '件の回を、記録ごと消します（タグの数からも消えます）。もとに戻せません。' : '選んだ ' + ids.length + '件の回の、入力された文（描きたいもの・困っていること・入れたい文字・いまいちの声）を消します。タグの数は残ります。もとに戻せません。';
    confirmBox(msg).then(function (ok) {
      if (!ok) return;
      if (S.demo) {
        var set = new Set(ids);
        if (del) S.rows = S.rows.filter(function (r) { return !set.has(r.id); });
        else S.rows.forEach(function (r) { if (set.has(r.id)) { r.wish = null; r.trouble = null; r.title_text = null; } });
        S.all = A.prepare(S.rows); S.sel.clear(); render();
        toast('見本データの中だけで消しました');
        return;
      }
      API.rpc('admin_redact', { p_key: S.key, p_ids: ids, p_delete: !!del }).then(function (r) {
        if (!r.ok) { toast(errText(r)); return; }
        toast((del ? '記録を消しました：' : '文を消しました：') + r.changed + '件');
        load();
      });
    });
  }

  // LINE の人を忘れる（本人から頼まれたとき）。del=false：名前から切り離す／true：記録ごと消す
  function forgetUser(del) {
    var id = S.user, name = S.userName || '（表示名なし）';
    if (!id) return;
    var msg = del ? '「' + name + '」さんの記録を、すべて消します（タグの数からも消えます）。もとに戻せません。'
      : '「' + name + '」さんの記録を、名前から切り離します（記録は名前なしで残ります）。LINE の表示名と番号は消えます。もとに戻せません。';
    confirmBox(msg, del ? '消す' : null).then(function (ok) {
      if (!ok) return;
      if (S.demo) {
        if (del) S.rows = S.rows.filter(function (r) { return r.line_user_id !== id; });
        else S.rows.forEach(function (r) { if (r.line_user_id === id) { r.line_user_id = null; r.line_name = null; } });
        S.all = A.prepare(S.rows); S.user = ''; S.userName = ''; render();
        toast('見本データの中だけで変えました');
        return;
      }
      API.rpc('admin_forget_user', { p_key: S.key, p_line_user_id: id, p_delete: !!del }).then(function (r) {
        if (!r.ok) { toast(errText(r)); return; }
        toast((del ? '記録を消しました：' : '名前から切り離しました：') + fmt(r.events) + '件');
        S.user = ''; S.userName = '';
        load();
      });
    });
  }

  // ------------------------------------------------------------ ツールチップ（値が先、名前があと）
  var tipEl = null;
  function showTip(el, x, y) {
    var v = el.getAttribute('data-tv');
    if (!v) return;
    tipEl = tipEl || $('#tip');
    clear(tipEl);
    tipEl.appendChild(h('span', { class: 'tip-v', text: v }));
    if (el.getAttribute('data-tl')) tipEl.appendChild(h('span', { class: 'tip-l', text: el.getAttribute('data-tl') }));
    if (el.getAttribute('data-ts')) tipEl.appendChild(h('span', { class: 'tip-s', text: el.getAttribute('data-ts') }));
    tipEl.hidden = false;
    var r = tipEl.getBoundingClientRect();
    var left = Math.min(window.innerWidth - r.width - 8, Math.max(8, x + 14));
    var top = y - r.height - 12;
    if (top < 8) top = y + 18;
    tipEl.style.left = left + 'px';
    tipEl.style.top = top + 'px';
  }
  function hideTip() { if (tipEl) tipEl.hidden = true; }

  // ------------------------------------------------------------ つなぐ
  function wire() {
    $('#login-go').addEventListener('click', function () { login($('#key').value, $('#remember').checked); });
    $('#key').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); login($('#key').value, $('#remember').checked); } });
    $('#demo-go').addEventListener('click', startDemo);
    $('#logout').addEventListener('click', function () {
      forgetKey(); S.key = ''; S.demo = false; S.rows = []; S.all = []; S.status = null; S.tag = ''; S.tag2 = '';
      showDash(false); $('#login-err').textContent = '';
    });
    $('#refresh').addEventListener('click', function () { load().then(function (ok) { if (ok) toast('最新の記録を読み込みました'); }); });

    document.addEventListener('click', function (e) {
      var el = e.target.closest('button');
      if (!el) return;
      if (el.hasAttribute('data-range')) { S.range = el.getAttribute('data-range'); S.shown = 40; render(); return; }
      if (el.hasAttribute('data-tag')) { var t = el.getAttribute('data-tag'); S.tag = S.tag === t && !S.tag2 ? '' : t; S.tag2 = ''; S.shown = 40; render(); return; }
      if (el.hasAttribute('data-pair')) { var p = el.getAttribute('data-pair').split('|'); S.tag = p[0]; S.tag2 = p[1]; S.shown = 40; render(); $('#filters').scrollIntoView({ block: 'start' }); return; }
      if (el.getAttribute('data-act') === 'clear-tag') { S.tag = ''; S.tag2 = ''; S.user = ''; S.userName = ''; render(); return; }
      if (el.hasAttribute('data-user')) { var u = el.getAttribute('data-user'); if (S.user === u) { S.user = ''; S.userName = ''; } else { S.user = u; S.userName = el.getAttribute('data-user-name') || ''; } S.shown = 40; render(); return; }
      if (el.getAttribute('data-act') === 'forget-user' || el.getAttribute('data-act') === 'delete-user') { forgetUser(el.getAttribute('data-act') === 'delete-user'); return; }
      if (el.hasAttribute('data-view')) { var id = el.getAttribute('data-view'); S.views[id] = S.views[id] === 'table' ? 'chart' : 'table'; render(); return; }
      if (el.hasAttribute('data-expand')) { var k = el.getAttribute('data-expand'); S.expand[k] = !S.expand[k]; render(); return; }
      if (el.hasAttribute('data-kind')) { S.textKind = el.getAttribute('data-kind'); S.shown = 40; renderTexts(S.sum); return; }
      if (el.hasAttribute('data-word')) {
        var w = el.getAttribute('data-word');
        S.q = S.q === w ? '' : w; S.shown = 40; renderTexts(S.sum);
        if (el.closest('#card-newwords')) $('#card-texts').scrollIntoView({ block: 'start' });
        return;
      }
      if (el.id === 'more-texts') { S.shown += 40; renderTexts(S.sum); return; }
      if (el.id === 'redact') { redact(false); return; }
      if (el.id === 'delete') { redact(true); return; }
      if (el.id === 'csv-gens') { download('処方箋の記録_' + stamp() + '.csv', new Blob([A.gensCsv(S.sum.gens)], { type: 'text/csv;charset=utf-8' })); return; }
      if (el.id === 'csv-tags') { download('タグごとの数_' + stamp() + '.csv', new Blob([A.tagsCsv(S.sum)], { type: 'text/csv;charset=utf-8' })); return; }
      if (el.id === 'copy-url') {
        var url = shareUrl();
        if (!url) return;
        (navigator.clipboard && window.isSecureContext ? navigator.clipboard.writeText(url) : Promise.reject()).then(function () { toast('リンクをコピーしました'); }, function () { toast('コピーできませんでした。リンクを選んでコピーしてください'); });
        return;
      }
      if (el.id === 'save-qr') {
        if (!qrCanvas) return;
        qrCanvas.toBlob(function (b) { if (b) download('QR_' + ($('#share-code').value.trim() || 'link') + '.png', b); }, 'image/png');
        return;
      }
      if (el.id === 'toggle-logging') {
        if (S.demo || !S.status) return;
        var on = !(S.status.settings && S.status.settings.logging_enabled);
        (on ? Promise.resolve(true) : confirmBox('記録を止めます。止めている間も参加者の画面は使えますが、何も記録されません。')).then(function (ok) {
          if (!ok) return;
          API.rpc('admin_set_logging', { p_key: S.key, p_enabled: on }).then(function (r) {
            if (!r.ok) { toast(errText(r)); return; }
            toast(on ? '記録を再開しました' : '記録を止めました');
            load();
          });
        });
        return;
      }
      if (el.id === 'purge') {
        var code = $('#purge-cohort').value;
        var name = code || '（コードなし）';
        confirmBox('講座コード「' + name + '」の記録を、すべて消します。もとに戻せません。', code || 'コードなし').then(function (ok) {
          if (!ok) return;
          API.rpc('admin_purge', { p_key: S.key, p_cohort: code }).then(function (r) {
            if (!r.ok) { toast(errText(r)); return; }
            toast('消しました：' + fmt(r.deleted) + '件');
            if (S.cohort === code) S.cohort = '*';
            load();
          });
        });
        return;
      }
    });

    document.addEventListener('change', function (e) {
      var el = e.target;
      if (el.id === 'cohort') { S.cohort = el.value; S.shown = 40; render(); }
      else if (el.id === 'no-preset') { S.noPreset = el.checked; render(); }
      else if (el.id === 'from' || el.id === 'to') { S.from = $('#from').value; S.to = $('#to').value; render(); }
      else if (el.hasAttribute && el.hasAttribute('data-sel')) {
        var id = Number(el.getAttribute('data-sel'));
        if (el.checked) S.sel.add(id); else S.sel.delete(id);
        syncBulk();
      }
    });
    var qTimer = null;
    $('#text-q').addEventListener('input', function (e) { clearTimeout(qTimer); var v = e.target.value; qTimer = setTimeout(function () { S.q = v; S.shown = 40; renderTexts(S.sum); }, 200); });
    ['#share-code', '#share-base'].forEach(function (s) { $(s).addEventListener('input', renderShare); });
    $('#share-liff').addEventListener('change', renderShare);

    // ツールチップ：マウスでも、キーボードで選んだときも
    document.addEventListener('pointermove', function (e) {
      var el = e.target.closest && e.target.closest('[data-tv]');
      if (el) showTip(el, e.clientX, e.clientY); else hideTip();
    });
    document.addEventListener('focusin', function (e) {
      var el = e.target.closest && e.target.closest('[data-tv]');
      if (el) { var r = el.getBoundingClientRect(); showTip(el, r.left + r.width / 2, r.top); } else hideTip();
    });
    document.addEventListener('scroll', hideTip, true);
    var rt = null;
    window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { if (S.sum) dailyCard(S.sum); }, 200); });
  }

  function init() {
    wire();
    $('#conn-note').textContent = API.configured() ? '接続先：' + String((window.GP_CONFIG || {}).supabaseUrl).replace(/^https?:\/\//, '') : '接続先（config.js）がまだ設定されていません。見本データでだけ見られます。';
    var k = readKey();
    if (k && API.configured()) {
      $('#remember').checked = (function () { try { return !!localStorage.getItem(KEY_STORE); } catch (e) { return false; } })();
      login(k, $('#remember').checked);
    }
    if (/[?&]demo=1/.test(location.search)) startDemo();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.GP_ADMIN = { state: S, render: render, load: load, startDemo: startDemo };
})();

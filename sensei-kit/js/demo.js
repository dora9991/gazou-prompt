/* 使い方のデモ：道具ごとの「操作の流れ」を、架空のクラスで実際に動かして見せる。
   デモのあいだは Kit.store が砂場（メモリ）に切りかわり、Kit.pref もメモリだけになる。本物のデータは読まず・書かない。
   上に「デモ中」の帯が出て、「デモを終わる」で元のデータに戻る（ページを読み込み直しても戻る）。

   手順の書き方（js/tours/<道具>.js）：
     Kit.tour('seats', [
       { el: '#sk-class-select', title: 'クラスを選ぶ', text: '…' },
       { el: Kit.demo.btn('席替えする'), title: 'くじで決める', text: '…', click: true, after: 2400 },
       { el: '.st-board', title: '…', text: '…', do: async (d) => { await d.click(d.q('.st-seat')); } },
     ]);
     el     … CSS セレクタか、要素を返す関数（Kit.demo.btn / q / text）。見つかるまで少し待つ。省くと説明だけを真ん中に出す
     click  … 「やってみる」で、その要素を押す（指が動いて押す）。利用者が自分で押しても進む
     do     … 自分で動かす。d.click(el) / d.type(input, '文字') / d.pick(select, 値) / d.check(input, true) / d.wait(ms) / d.q(sel)
     after  … 動かしたあと、次の説明を出すまで待つミリ秒（演出のある操作に）
     before … 説明を出す前に、見せたい場所を準備する（タブを開く・下までスクロール、など）。指は出さない
     wide   … 囲みを要素より大きくする（px） */
(function () {
  'use strict';
  const { h } = Kit;
  const tours = new Map();
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms * speed()));
  const speed = () => (typeof Kit.demo.speed === 'number' ? Kit.demo.speed : 1);
  const reduced = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const narrow = () => window.innerWidth < 640;

  Kit.tour = (id, steps) => { tours.set(id, steps); };

  /* ── 要素をさがす小物 ── */
  const visible = (e) => {
    if (!e || !e.isConnected) return false;
    const r = e.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    const cs = getComputedStyle(e);
    return cs.visibility !== 'hidden' && cs.display !== 'none';
  };
  const textOf = (e) => String(e.innerText || e.value || e.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim();
  const scopeOf = (scope) => (typeof scope === 'string' ? document.querySelector(scope) : scope) || document.getElementById('mb-view') || document;
  // ボタン・タブ・リンクを文字でさがす（同じ文字なら、ぴったり一致を先に）
  const btn = (text, scope) => () => {
    const root = scopeOf(scope);
    const all = [...root.querySelectorAll('button, a, [role="tab"], [role="button"], label, summary')].filter(visible);
    return all.find((e) => textOf(e) === text) || all.find((e) => textOf(e).startsWith(text)) || all.find((e) => textOf(e).includes(text)) || null;
  };
  const q = (sel, scope) => () => [...scopeOf(scope).querySelectorAll(sel)].find(visible) || null;
  // セレクタに合う要素のうち、文字をふくむもの
  const text = (sel, t, scope) => () => [...scopeOf(scope).querySelectorAll(sel)].filter(visible).find((e) => textOf(e).includes(t)) || null;
  const modal = (sel) => () => { const m = [...document.querySelectorAll('.modal')].pop(); if (!m) return null; return sel ? [...m.querySelectorAll(sel)].find(visible) || null : m; };
  const modalBtn = (t) => () => { const m = [...document.querySelectorAll('.modal')].pop(); return m ? btn(t, m)() : null; };

  async function resolve(target, ms = 2500) {
    if (!target) return null;
    const t0 = Date.now();
    for (;;) {
      let el = null;
      try { el = typeof target === 'function' ? target() : typeof target === 'string' ? q(target)() : target; } catch (e) { el = null; }
      if (el && visible(el)) return el;
      if (Date.now() - t0 > ms) return null;
      await new Promise((r) => setTimeout(r, 60));
    }
  }

  /* ── 帯（デモ中） ── */
  let ribbon = null;
  function showRibbon() {
    if (ribbon) return;
    const main = document.querySelector('.mb-main') || document.body;
    ribbon = h('div', { class: 'demo-ribbon', role: 'status' },
      h('span', { class: 'demo-ribbon-tag' }, Kit.icon('play', 12), 'デモ中'),
      h('span', { class: 'demo-ribbon-text' }, h('span', { class: 'demo-ribbon-long' }, '架空のクラスで動かしています。'), h('b', null, 'あなたのデータは変わりません。')),
      h('span', { class: 'demo-ribbon-btns' },
        h('button', { type: 'button', class: 'demo-ribbon-end', onclick: () => Kit.demo.end() }, Kit.icon('close', 14), 'デモを終わる')));
    main.prepend(ribbon);
  }

  /* ── 吹き出し・囲み・指 ── */
  let T = null; // 動いているデモ { id, steps, i, auto, el, seq, busy, timer, raf, layer… }

  function buildLayer() {
    const block = () => h('div', { class: 'tour-block' });
    const blocks = [block(), block(), block(), block()];
    const spot = h('div', { class: 'tour-spot', 'aria-hidden': 'true' });
    const finger = h('div', { class: 'tour-finger', 'aria-hidden': 'true' });
    const card = h('div', { class: 'tour-card', role: 'dialog', 'aria-modal': 'false', 'aria-label': '使い方' });
    const layer = h('div', { class: 'tour' }, blocks, spot, card, finger);
    // 囲みの外を押したら、ほかの所が動かないように止める（囲みの中は押せる）
    for (const b of blocks) b.addEventListener('pointerdown', (e) => { e.preventDefault(); card.classList.remove('nudge'); void card.offsetWidth; card.classList.add('nudge'); });
    document.body.append(layer);
    return { layer, blocks, spot, finger, card };
  }

  function place() {
    if (!T) return;
    const { spot, blocks, card } = T.ui;
    const vw = window.innerWidth, vh = window.innerHeight;
    const el = T.el && T.el.isConnected ? T.el : null;
    let r = null;
    if (el) {
      const b = el.getBoundingClientRect();
      const pad = (T.steps[T.i] && T.steps[T.i].wide) || 6;
      r = { x: Math.max(4, b.left - pad), y: Math.max(4, b.top - pad), w: 0, h: 0 };
      r.w = Math.min(vw - 4, b.right + pad) - r.x; r.h = Math.min(vh - 4, b.bottom + pad) - r.y;
      if (r.w <= 0 || r.h <= 0) r = null;
    }
    const key = r ? [r.x, r.y, r.w, r.h].map(Math.round).join(',') + ',' + vw + ',' + vh + ',' + card.offsetHeight : 'none,' + vw + ',' + vh;
    if (key === T.lastKey) return;
    T.lastKey = key;
    if (r) {
      Object.assign(spot.style, { display: 'block', left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
      // 囲みの外の4枚（上・下・左・右）
      Object.assign(blocks[0].style, { left: '0', top: '0', width: '100%', height: r.y + 'px' });
      Object.assign(blocks[1].style, { left: '0', top: r.y + r.h + 'px', width: '100%', height: Math.max(0, vh - r.y - r.h) + 'px' });
      Object.assign(blocks[2].style, { left: '0', top: r.y + 'px', width: r.x + 'px', height: r.h + 'px' });
      Object.assign(blocks[3].style, { left: r.x + r.w + 'px', top: r.y + 'px', width: Math.max(0, vw - r.x - r.w) + 'px', height: r.h + 'px' });
      T.ui.layer.classList.remove('no-spot');
    } else {
      spot.style.display = 'none';
      Object.assign(blocks[0].style, { left: '0', top: '0', width: '100%', height: '100%' });
      for (const b of blocks.slice(1)) Object.assign(b.style, { width: '0', height: '0' });
      T.ui.layer.classList.add('no-spot');
    }
    // 吹き出し：スマホは下にくっつける。パソコンは要素の下か上、入らなければ右下
    card.classList.toggle('docked', narrow());
    if (narrow()) { card.style.left = ''; card.style.top = ''; return; }
    const cw = card.offsetWidth, ch = card.offsetHeight, gap = 14;
    let x, y;
    if (!r) { x = (vw - cw) / 2; y = (vh - ch) / 2; }
    else {
      x = Math.min(Math.max(12, r.x + r.w / 2 - cw / 2), vw - cw - 12);
      if (r.y + r.h + gap + ch <= vh - 12) y = r.y + r.h + gap;
      else if (r.y - gap - ch >= 12) y = r.y - gap - ch;
      else if (r.x + r.w + gap + cw <= vw - 12) { x = r.x + r.w + gap; y = Math.min(Math.max(12, r.y), vh - ch - 12); }
      else if (r.x - gap - cw >= 12) { x = r.x - gap - cw; y = Math.min(Math.max(12, r.y), vh - ch - 12); }
      else { x = vw - cw - 16; y = vh - ch - 16; }
    }
    card.style.left = Math.round(x) + 'px'; card.style.top = Math.round(y) + 'px';
  }
  // 上にかぶさる物（スマホの上のバー・デモ中の帯）の下の端
  function coverBottom() {
    let y = 0;
    for (const sel of ['.mb-top', '.demo-ribbon']) {
      const e = document.querySelector(sel);
      if (!e) continue;
      const r = e.getBoundingClientRect();
      if (r.height > 0 && getComputedStyle(e).display !== 'none' && r.top < 4 + y) y = Math.max(y, r.bottom);
    }
    return y;
  }
  // 見せたい所が、上の帯にも下の吹き出し（スマホ）にも隠れない位置まで送る
  function keepVisible(el) {
    if (!T || !el) return;
    const top = coverBottom() + 10;
    const bottom = narrow() ? window.innerHeight - T.ui.card.offsetHeight - 16 : window.innerHeight - 10;
    const need = () => {
      const r = el.getBoundingClientRect();
      if (r.top < top) return r.top - top;
      if (r.bottom > bottom) return Math.min(r.bottom - bottom, r.top - top);
      return 0;
    };
    // ダイアログの中など、送れる箱の中にあれば、先にその箱を送る
    for (let box = el.parentElement; box && box !== document.body; box = box.parentElement) {
      const d = need();
      if (!d) break;
      const cs = getComputedStyle(box);
      if (/(auto|scroll)/.test(cs.overflowY) && box.scrollHeight > box.clientHeight + 1) box.scrollTop += d;
    }
    const d = need();
    if (d) window.scrollBy(0, d);
    T.lastKey = '';
  }
  function loop() {
    if (!T) return;
    // 描きなおしで要素が入れかわったら、さがしなおす
    const step = T.steps[T.i];
    if (step && step.el && (!T.el || !T.el.isConnected) && Date.now() - (T.lastFind || 0) > 150) {
      T.lastFind = Date.now();
      try { const e = typeof step.el === 'function' ? step.el() : q(step.el)(); if (e) T.el = e; } catch (e) { /* noop */ }
    }
    place();
    T.raf = requestAnimationFrame(loop);
  }

  function renderCard(step, o = {}) {
    const { card } = T.ui;
    Kit.clear(card);
    const n = T.steps.length;
    const acts = !!(step.click || step.do);
    const last = T.i === n - 1;
    const back = h('button', { type: 'button', class: 'tour-btn ghost tour-back', disabled: T.i === 0 || T.busy, onclick: () => prev(), 'aria-label': '戻る' }, Kit.icon('left', 16), h('span', null, '戻る'));
    const auto = h('button', { type: 'button', class: 'tour-btn ghost tour-auto', 'aria-pressed': String(T.auto), onclick: () => toggleAuto(), title: T.auto ? '自動で進むのを止める' : '自動で最後まで進める', 'aria-label': T.auto ? '自動で進むのを止める' : '自動で最後まで進める' }, Kit.icon(T.auto ? 'pause' : 'play', 14), h('span', null, T.auto ? '止める' : '自動で'));
    const go = h('button', { type: 'button', class: 'tour-btn primary', disabled: T.busy, onclick: () => next() },
      acts ? [Kit.icon('play', 14), step.doLabel || 'やってみる'] : last ? ['おわる', Kit.icon('check', 16)] : ['次へ', Kit.icon('right', 16)]);
    Kit.add(card, [
      h('div', { class: 'tour-top' },
        h('span', { class: 'tour-count' }, '使い方　', h('b', null, T.i + 1), ' / ' + n),
        h('span', { class: 'tour-dots', 'aria-hidden': 'true' }, T.steps.map((_, k) => h('i', { class: k < T.i ? 'done' : k === T.i ? 'now' : '' }))),
        h('button', { type: 'button', class: 'tour-x', 'aria-label': '使い方を閉じる', title: '閉じる（デモの画面はそのまま）', onclick: () => stopTour({ keep: true }) }, Kit.icon('close', 16))),
      h('div', { class: 'tour-title' }, step.title || ''),
      step.text ? h('p', { class: 'tour-text' }, step.text) : null,
      o.note ? h('p', { class: 'tour-note' }, o.note) : null,
      acts && !T.auto ? h('p', { class: 'tour-hint' }, step.click ? '光っている所を押しても進みます。' : '「' + (step.doLabel || 'やってみる') + '」で、指が動いて操作します。') : null,
      T.auto ? h('div', { class: 'tour-bar' }, h('i', { style: { animationDuration: dwell(step) + 'ms' } })) : null,
      h('div', { class: 'tour-foot' }, back, auto, h('span', { class: 'grow' }), go)]);
    T.goBtn = go;
  }
  const dwell = (step) => Math.round(Math.min(7000, Math.max(2800, 1600 + String((step.title || '') + (step.text || '')).length * 55)) * speed());

  async function show(i) {
    if (!T) return;
    const my = ++T.seq;
    clearTimeout(T.timer);
    T.i = i; T.el = null; T.lastKey = ''; T.ready = false;
    const step = T.steps[i];
    T.busy = true; renderCard(step); T.busy = false;
    try { if (step.before) { await step.before(api); await Kit.mounted(); } } catch (e) { console.error(e); }
    if (!T || my !== T.seq) return;
    const el = await resolve(step.el, step.el ? 2500 : 0);
    if (!T || my !== T.seq) return;
    T.el = el;
    if (el) { el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: reduced() ? 'auto' : 'smooth' }); await sleep(reduced() ? 60 : 320); }
    if (!T || my !== T.seq) return;
    renderCard(step, { note: step.el && !el ? '（この画面では見つかりませんでした。説明だけ出しています）' : '' });
    T.lastKey = '';
    place();
    if (el) keepVisible(el);
    T.ready = true; T.found = !!el || !step.el;
    try { T.goBtn.focus({ preventScroll: true }); } catch (e) { /* noop */ }
    if (T.auto) T.timer = setTimeout(() => { if (T && my === T.seq) next(); }, dwell(step));
  }

  async function next(o = {}) {
    if (!T || T.busy) return;
    const my = T.seq;
    clearTimeout(T.timer);
    T.ready = false;
    const step = T.steps[T.i];
    if ((step.click || step.do) && !o.done) {
      T.busy = true; renderCard(step);
      try {
        if (step.do) await step.do(api);
        else if (T.el) await api.click(T.el);
      } catch (e) { console.error('デモの操作', e); }
      await sleep(step.after || 700);
      await Kit.mounted();
      if (!T || my !== T.seq) return;
      T.busy = false;
    } else if (o.done) {
      await sleep(step.after || 700);
      await Kit.mounted();
      if (!T || my !== T.seq) return;
    }
    if (T.i + 1 >= T.steps.length) return finish();
    show(T.i + 1);
  }
  function prev() { if (T && !T.busy && T.i > 0) show(T.i - 1); }
  function toggleAuto() { if (!T) return; T.auto = !T.auto; if (T.auto) next(); else { clearTimeout(T.timer); renderCard(T.steps[T.i]); } }

  function finish() {
    if (!T) return;
    clearTimeout(T.timer);
    const id = T.id;
    T.i = T.steps.length - 1; T.el = null; T.lastKey = ''; T.seq++; T.done = true; T.ready = true;
    if (Kit.usage) Kit.usage(id, 'demo-done');
    const { card } = T.ui;
    Kit.clear(card);
    Kit.add(card, [
      h('div', { class: 'tour-top' }, h('span', { class: 'tour-count' }, '使い方'), h('span', { class: 'grow' }),
        h('button', { type: 'button', class: 'tour-x', 'aria-label': '閉じる', onclick: () => stopTour({ keep: true }) }, Kit.icon('close', 16))),
      h('div', { class: 'tour-title' }, 'これで一通りです'),
      h('p', { class: 'tour-text' }, 'このままデモの中で、自由にさわってみることもできます。終わるときは、上の帯の「デモを終わる」で、あなたのデータに戻ります。'),
      h('div', { class: 'tour-foot' },
        h('button', { type: 'button', class: 'tour-btn ghost', onclick: () => Kit.demo.start(id) }, Kit.icon('refresh', 14), 'もう一度'),
        h('span', { class: 'grow' }),
        h('button', { type: 'button', class: 'tour-btn', onclick: () => stopTour({ keep: true }) }, '自由にさわる'),
        h('button', { type: 'button', class: 'tour-btn primary', onclick: () => Kit.demo.end() }, 'デモを終わる'))]);
    place();
    try { card.querySelector('.tour-btn.primary').focus({ preventScroll: true }); } catch (e) { /* noop */ }
  }

  // 囲みの中を利用者が自分で押したとき：click の手順なら、そのまま次へ
  function onUserClick(e) {
    if (!T || T.busy || !T.el || !e.isTrusted) return;
    const step = T.steps[T.i];
    if (!step || !step.click) return;
    if (T.el === e.target || T.el.contains(e.target)) { T.busy = true; setTimeout(() => { if (T) { T.busy = false; next({ done: true }); } }, 0); }
  }
  function onKey(e) {
    if (!T) return;
    if (e.key === 'Escape' && !Kit.modalOpen()) { e.preventDefault(); stopTour({ keep: true }); }
    else if (e.key === 'ArrowRight' && !T.busy && !/INPUT|TEXTAREA|SELECT/.test((e.target && e.target.tagName) || '')) { e.preventDefault(); next(); }
    else if (e.key === 'ArrowLeft' && !T.busy && !/INPUT|TEXTAREA|SELECT/.test((e.target && e.target.tagName) || '')) { e.preventDefault(); prev(); }
  }
  const onResize = () => { if (T) T.lastKey = ''; };

  function run(id) {
    stopTour({ keep: true });
    const steps = tours.get(id);
    if (!steps || !steps.length) return;
    T = { id, steps, i: 0, auto: false, el: null, seq: 0, busy: false, timer: 0, raf: 0, lastKey: '', ui: buildLayer() };
    document.documentElement.classList.add('is-touring');
    document.addEventListener('click', onUserClick, true);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', onResize);
    T.raf = requestAnimationFrame(loop);
    show(0);
  }
  function stopTour() {
    if (!T) return;
    clearTimeout(T.timer); cancelAnimationFrame(T.raf);
    T.seq++;
    T.ui.layer.remove();
    T = null;
    document.documentElement.classList.remove('is-touring');
    document.removeEventListener('click', onUserClick, true);
    document.removeEventListener('keydown', onKey, true);
    window.removeEventListener('resize', onResize);
  }

  /* ── 指で動かす（手順の do から使う） ── */
  async function moveFinger(el) {
    if (!T || !el) return;
    el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'auto' });
    await sleep(80);
    const r = el.getBoundingClientRect();
    const f = T.ui.finger;
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    if (reduced() || speed() < 0.5) { f.style.transition = 'none'; f.style.transform = `translate(${x}px, ${y}px)`; f.classList.add('on'); await sleep(60); }
    else {
      if (!f.classList.contains('on')) {
        const c = T.ui.card.getBoundingClientRect();
        f.style.transition = 'none'; f.style.transform = `translate(${c.left + c.width / 2}px, ${c.top + 20}px)`;
        void f.offsetWidth; f.classList.add('on');
      }
      f.style.transition = '';
      f.style.transform = `translate(${x}px, ${y}px)`;
      await sleep(520);
    }
    T.el = el; T.lastKey = '';
    { const y0 = el.getBoundingClientRect().top; keepVisible(el); if (el.getBoundingClientRect().top !== y0) { await sleep(60); const r2 = el.getBoundingClientRect(); f.style.transform = `translate(${r2.left + r2.width / 2}px, ${r2.top + r2.height / 2}px)`; } }
    f.classList.remove('tap'); void f.offsetWidth; f.classList.add('tap');
    await sleep(140);
  }
  const hideFinger = () => { if (T) T.ui.finger.classList.remove('on', 'tap'); };
  const api = {
    q: (sel, scope) => q(sel, scope)(),
    btn: (t, scope) => btn(t, scope)(),
    find: (target, ms) => resolve(target, ms),
    wait: (ms) => sleep(ms),
    async click(target) {
      const el = await resolve(target, 2500);
      if (!el) throw new Error('押す所が見つかりません');
      await moveFinger(el);
      el.click();
      await sleep(120);
      hideFinger();
      return el;
    },
    async type(target, value, o = {}) {
      const el = await resolve(target, 2500);
      if (!el) throw new Error('入力欄が見つかりません');
      await moveFinger(el);
      hideFinger();
      el.focus({ preventScroll: true });
      if (!o.append) { el.value = ''; el.dispatchEvent(new Event('input', { bubbles: true })); }
      const per = reduced() || speed() < 0.5 ? 0 : Math.max(18, Math.min(60, 900 / String(value).length));
      if (!per) { el.value = (o.append ? el.value : '') + value; el.dispatchEvent(new Event('input', { bubbles: true })); }
      else for (const ch of String(value)) { el.value += ch; el.dispatchEvent(new Event('input', { bubbles: true })); await new Promise((r) => setTimeout(r, per)); }
      el.dispatchEvent(new Event('change', { bubbles: true }));
      if (o.enter) el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      el.blur();
      return el;
    },
    async pick(target, value) {
      const el = await resolve(target, 2500);
      if (!el) throw new Error('選ぶ所が見つかりません');
      await moveFinger(el);
      hideFinger();
      el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return el;
    },
    async check(target, on = true) {
      const el = await resolve(target, 2500);
      if (!el) throw new Error('チェックの所が見つかりません');
      if (!!el.checked !== !!on) { await moveFinger(el); el.click(); hideFinger(); }
      return el;
    },
    // 見せたい所まで、画面をゆっくり送る（指は出さない）
    async scrollTo(target) {
      const el = await resolve(target, 2500);
      if (el) { el.scrollIntoView({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' }); await sleep(380); }
      return el;
    },
    closeModals() { Kit.closeModals(); },
  };

  /* ── 入口 ── */
  Kit.demo = {
    speed: 1,
    has: (id) => tours.has(id) && tours.get(id).length > 0,
    on: () => !!Kit.store.demo,
    // いま動いているデモ（テストからも読む）。ready … 説明を出し終えた / found … 囲む所が見つかった / done … 最後まで来た
    running: () => (T ? { id: T.id, i: T.i, n: T.steps.length, title: (T.steps[T.i] || {}).title, ready: !!T.ready, found: !!T.found, busy: !!T.busy, done: !!T.done } : null),
    btn, q, text, modal, modalBtn, api,
    // デモを始める：砂場に切りかえて、その道具を開き直し、手順を出す
    async start(id) {
      if (!tours.has(id)) return;
      stopTour();
      if (!Kit.store.demo) {
        Kit.closeModals();
        Kit.pref.demo = new Map();
        await Kit.store.sandbox(true);
        document.documentElement.classList.add('is-demo');
        showRibbon();
      } else Kit.closeModals();
      if (Kit.current() !== id) {
        Kit.go(id);
        for (let k = 0; k < 60 && Kit.current() !== id; k++) await new Promise((r) => setTimeout(r, 30));
      } else Kit.remount();
      await Kit.mounted();
      window.scrollTo(0, 0);
      if (Kit.usage) Kit.usage(id, 'demo-start');
      run(id);
    },
    // デモを終えて、本物のデータに戻る
    async end() {
      stopTour();
      Kit.closeModals();
      if (Kit.store.demo) await Kit.store.sandbox(false);
      Kit.pref.demo = null;
      document.documentElement.classList.remove('is-demo');
      if (ribbon) { ribbon.remove(); ribbon = null; }
      await Kit.remount();
      Kit.toast('デモを終えました。あなたのデータに戻っています');
    },
    stopTour,
  };
})();

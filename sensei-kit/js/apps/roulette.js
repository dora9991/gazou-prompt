// ルーレット：行事や発表の「だれから？」「何番から？」を、派手なルーレットで決める。発表モード（画面いっぱい）・順番の一覧・印刷も
(function (root) {
  'use strict';

  /* ───────── くじの計算（画面と切りはなした部分。tools/test-roulette.cjs から Node でも動かす） ─────────
     ・pickIndex(n, rand)   … 0〜n-1 を同じ確率で1つ。rand は School.rng() のような 0≦x<1 を返す関数
     ・shuffle(arr, rand)   … 全員の順番（フィッシャー–イェーツ。どの並びも同じ確率）
     ・plan({ n, index, from, rand, speed, reduced, scale }) … 盤の回り方。当たりは先に pickIndex で決め、
                              盤はその区画の中（区画の端から 25% 以上内側）に必ず止まる。止まる直前は、1つ前の区画で
                              いったん止まりかけてから、スローで当たりの区画に入る（寸止め）
     ・angleAt(plan, ms)    … その時刻の盤の角度（度・時計回り）  ・phaseAt(plan, ms) … いまの段階
     ・indexAt(angle, n)    … 針（真上）の下にある区画
     盤の区画 i は、盤の真上から時計回りに [i·s, (i+1)·s)（s = 360/n）。盤を R 度回すと、針の下は盤の角度 (−R) mod 360 */
  const mod = (a, m) => ((a % m) + m) % m;
  const SPEEDS = {
    quick: { wind: 150, main: 2100, turns: 4, hold: 120, creep: 650 },
    slow: { wind: 260, main: 4300, turns: 7, hold: 340, creep: 1500 },
  };
  const EASE = {
    none: () => 0,
    out2: (u) => 1 - (1 - u) * (1 - u),
    out3: (u) => 1 - Math.pow(1 - u, 3),
    inout: (u) => (1 - Math.cos(Math.PI * u)) / 2,
  };
  const MAX_ITEMS = 200, MAX_RANGE = 500;
  const Core = {
    SPEEDS, MAX_ITEMS, MAX_RANGE,
    pickIndex(n, rand) { if (!(n > 0)) return -1; const i = Math.floor(rand() * n); return i >= n ? n - 1 : i; },
    shuffle(arr, rand) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },
    indexAt(angle, n) { if (!(n > 0)) return -1; return Math.min(n - 1, Math.floor(mod(-angle, 360) / (360 / n))); },
    plan(o) {
      const n = Math.max(1, o.n | 0), s = 360 / n, rand = o.rand || Math.random;
      const k = Math.min(n - 1, Math.max(0, o.index | 0));
      const sc = o.scale > 0 ? o.scale : 1;
      const from = Number(o.from) || 0;
      const reduced = !!o.reduced;
      const sp = SPEEDS[o.speed] || SPEEDS.slow;
      const f = 0.3 + rand() * 0.45;                         // 当たりの区画に入ってから、区画の 30〜75% まで進んで止まる
      const theta = (k + 1 - f) * s;                         // 止まったときに針の下にくる、盤の角度
      const turns = reduced ? 1 : sp.turns + (rand() < 0.5 ? 0 : 1);
      const base = from + turns * 360;
      const to = base + mod(-theta - base, 360);
      const phases = [];
      let t = 0;
      const add = (name, dur, a0, a1, ease) => { dur = Math.max(0, Math.round(dur * sc)); phases.push({ name, t0: t, t1: t + dur, a0, a1, ease }); t += dur; };
      let holdAt = to;
      if (reduced) add('main', 700, from, to, 'out3');      // 動きを減らす設定：短く1回転だけ
      else {
        const w = Math.min(10, s * 0.3);                     // 回す前に少し引く（ため）
        const eps = 0.05 + rand() * 0.07;
        holdAt = to - Math.min((f + eps) * s, 48);           // 1つ前の区画の終わり近くで、いったん止まりかける
        add('wind', sp.wind, from, from - w, 'out2');
        add('main', sp.main, from - w, holdAt, 'out3');
        add('hold', sp.hold, holdAt, holdAt, 'none');
        add('creep', sp.creep, holdAt, to, 'inout');
      }
      return { n, index: k, from, to, holdAt, f, phases, total: t };
    },
    angleAt(p, t) {
      if (!(t > 0)) return p.from;
      for (const ph of p.phases) if (t < ph.t1) { const u = ph.t1 > ph.t0 ? (t - ph.t0) / (ph.t1 - ph.t0) : 1; return ph.a0 + (ph.a1 - ph.a0) * EASE[ph.ease](u); }
      return p.to;
    },
    phaseAt(p, t) { for (const ph of p.phases) if (t < ph.t1) return ph.name; return 'done'; },
    // 自由な項目：1行に1つ。空の行は飛ばす
    parseItems(text) { return String(text || '').split(/\r?\n/).map((l) => l.replace(/[\s　]+/g, ' ').trim()).filter(Boolean).slice(0, MAX_ITEMS); },
    // 外す番号：'5, 12、13-15 ２０' → [5, 12, 13, 14, 15, 20]
    parseNums(text) {
      const out = new Set();
      for (const part of String(text || '').normalize('NFKC').split(/[,、，;\s]+/)) {
        const m = /^(\d{1,4})(?:\s*[-~〜−‐–—]\s*(\d{1,4}))?$/.exec(part.trim());
        if (!m) continue;
        let a = +m[1], b = m[2] != null ? +m[2] : a;
        if (a > b) [a, b] = [b, a];
        for (let x = a; x <= b && x - a < 1000; x++) out.add(x);
      }
      return [...out].sort((x, y) => x - y);
    },
    // 番号の範囲：はじめ〜おわり（逆でもよい）
    rangeList(a, b, max) {
      max = max || MAX_RANGE;
      const num = (v) => (v == null || String(v).trim() === '' ? NaN : parseInt(String(v).normalize('NFKC'), 10));
      a = num(a); b = num(b);
      if (!Number.isFinite(a) || !Number.isFinite(b)) return { nums: [], from: a, to: b, error: 'はじめと おわりの番号を入れてください' };
      if (a > b) [a, b] = [b, a];
      a = Math.max(0, a); b = Math.max(0, b);
      if (b - a + 1 > max) return { nums: [], from: a, to: b, error: '数が多すぎます（' + max + 'こまで）' };
      return { nums: Array.from({ length: b - a + 1 }, (_, i) => a + i), from: a, to: b, error: '' };
    },
  };
  root.RouletteCore = Core;
  if (typeof module === 'object' && module.exports) { module.exports = Core; return; }
  if (!root.Kit || !root.School) return;

  /* ───────── ここから画面 ───────── */
  const { h } = Kit;
  const SVGNS = 'http://www.w3.org/2000/svg';
  const sv = (tag, attrs, ...kids) => { const e = document.createElementNS(SVGNS, tag); for (const k in attrs || {}) if (attrs[k] != null) e.setAttribute(k, attrs[k]); for (const c of kids) if (c != null) e.append(c); return e; };
  const reduced = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  // デモの中では、デモの速さに合わせて短くする（ふだんは 1）
  const scale = () => (Kit.store.demo && Kit.demo && typeof Kit.demo.speed === 'number' ? Math.max(0.15, Math.min(1, Kit.demo.speed)) : 1);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms * scale()));
  const hash = (s) => { let x = 0; for (let i = 0; i < s.length; i++) x = (Math.imul(x, 31) + s.charCodeAt(i)) | 0; return (x >>> 0).toString(36); };
  const pad = (n) => String(n).padStart(2, '0');
  const hm = (d) => pad(d.getHours()) + ':' + pad(d.getMinutes());
  // デモ中は上に「デモ中」の帯が出ている（いつでも「デモを終わる」を押せるよう、いちばん上）。画面いっぱいの表示は、その下から始める
  const belowRibbon = (ov) => {
    const rb = document.documentElement.classList.contains('is-demo') && document.querySelector('.demo-ribbon');
    if (rb) { const b = rb.getBoundingClientRect().bottom; if (b > 0) ov.style.paddingTop = Math.round(b + 12) + 'px'; }
  };

  // アイコン（ルーレット盤と針）。共通のアイコンにまだないので、ここで足す
  if (!Kit.ICONS.roulette) Kit.ICONS.roulette = 'M12 5.5a7.5 7.5 0 1 0 0 15a7.5 7.5 0 0 0 0-15zM12 13 12 5.5M12 13l6.5 3.7M12 13l-6.5 3.7M9.6 1.8h4.8L12 5z';

  const SAMPLE_LISTS = [
    { id: 's-ru-theme', kind: 'list', title: '発表のテーマ（例）', text: ['修学旅行の思い出', '夏休みに読んだ本', 'わたしの町の自まん', '将来の夢', '好きな教科とその理由', '最近うれしかったこと'].join('\n') },
    { id: 's-ru-han', kind: 'list', title: '班（1班〜8班）', text: Array.from({ length: 8 }, (_, i) => (i + 1) + '班').join('\n') },
  ];
  Kit.store.sample('roulettes', SAMPLE_LISTS);
  const PRESETS = [
    { title: '1班〜6班', text: Array.from({ length: 6 }, (_, i) => (i + 1) + '班').join('\n') },
    { title: 'A〜Eグループ', text: 'ABCDE'.split('').map((c) => c + 'グループ').join('\n') },
    { title: '問題1〜10', text: Array.from({ length: 10 }, (_, i) => '問題' + (i + 1)).join('\n') },
  ];

  // その場の記録・決めている途中の順番・お休みの人は、ページを開いている間だけ覚える（ほかの道具へ行って戻っても残る）。
  // デモの中は別に持つ（本物の記録にまざらない）
  const newMem = () => ({ rounds: new Map(), excl: new Map(), hist: [], angle: 0 });
  const MEM = { real: newMem(), demo: newMem() };
  const mem = () => (Kit.store.demo ? MEM.demo : MEM.real);

  /* ───────── 音（その場で作る。音のファイルは使わない） ─────────
     デモ中・自動テスト中は鳴らさない。最初に「回す」を押したときに音の準備をする（ブラウザの決まり） */
  const Snd = (() => {
    let ctx = null, master = null, noise = null, roll = null;
    const allowed = () => Kit.pref.get('roulette.sound', true) !== false && !Kit.store.demo && !navigator.webdriver;
    function ensure() {
      if (!allowed()) return null;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      if (!ctx) {
        try { ctx = new AC(); } catch (e) { return null; }
        master = ctx.createGain();
        const comp = ctx.createDynamicsCompressor();
        master.connect(comp); comp.connect(ctx.destination);
      }
      master.gain.value = reduced() ? 0.22 : 0.55;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return ctx;
    }
    const noiseBuf = () => { if (!noise) { noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; } return noise; };
    const env = (g, t, a, peak, dec) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); };
    const tone = (type, f, t, a, peak, dec, dest, detune) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (detune) o.detune.value = detune; env(g, t, a, peak, dec); o.connect(g); g.connect(dest || master); o.start(t); o.stop(t + a + dec + 0.05); return o; };
    const crash = (t, peak, dec) => { const n = ctx.createBufferSource(); n.buffer = noiseBuf(); n.loop = true; const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 5200; const g = ctx.createGain(); env(g, t, 0.004, peak, dec); n.connect(hp); hp.connect(g); g.connect(master); n.start(t); n.stop(t + dec + 0.1); };
    const chord = (t, notes, peak, dec) => {
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
      lp.frequency.setValueAtTime(1300, t); lp.frequency.exponentialRampToValueAtTime(4200, t + 0.07); lp.frequency.exponentialRampToValueAtTime(1500, t + dec);
      lp.connect(master);
      for (const f of notes) for (const dt of [-7, 7]) tone('sawtooth', f, t, 0.018, peak, dec, lp, dt);
    };
    return {
      unlock() { ensure(); },
      // 針が区切りを越えるたびの「カチッ」
      tick() { const c = ensure(); if (!c || reduced()) return; const t = c.currentTime; const o = tone('triangle', 1900, t, 0.002, 0.2, 0.045); o.frequency.exponentialRampToValueAtTime(700, t + 0.035); },
      // ドラムロール（雑音を 1 秒に 24 回きざむ）
      rollStart() {
        const c = ensure(); if (!c || reduced()) return;
        this.rollStop();
        const t = c.currentTime;
        const src = c.createBufferSource(); src.buffer = noiseBuf(); src.loop = true;
        const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2100; bp.Q.value = 0.7;
        const trem = c.createGain(); trem.gain.value = 0.5;
        const lfo = c.createOscillator(); lfo.type = 'sawtooth'; lfo.frequency.value = 22;
        const lfoG = c.createGain(); lfoG.gain.value = -0.5;
        lfo.connect(lfoG); lfoG.connect(trem.gain);
        const out = c.createGain(); out.gain.setValueAtTime(0.0001, t); out.gain.exponentialRampToValueAtTime(0.1, t + 0.5);
        src.connect(bp); bp.connect(trem); trem.connect(out); out.connect(master);
        src.start(t); lfo.start(t);
        roll = { src, lfo, out };
      },
      // 止まる直前：ロールを大きく・速く
      rollSwell() { if (!roll || !ctx) return; const t = ctx.currentTime; roll.out.gain.cancelScheduledValues(t); roll.out.gain.setValueAtTime(Math.max(0.0001, roll.out.gain.value), t); roll.out.gain.linearRampToValueAtTime(0.26, t + 0.5); roll.lfo.frequency.linearRampToValueAtTime(30, t + 0.6); },
      rollStop() { if (!roll || !ctx) return; const t = ctx.currentTime, r = roll; roll = null; r.out.gain.cancelScheduledValues(t); r.out.gain.setValueAtTime(Math.max(0.0001, r.out.gain.value), t); r.out.gain.exponentialRampToValueAtTime(0.0001, t + 0.06); try { r.src.stop(t + 0.1); r.lfo.stop(t + 0.1); } catch (e) { /* もう止まっている */ } },
      // 寸止めのあいだの「ドクン」
      heart() { const c = ensure(); if (!c || reduced()) return; const t = c.currentTime; for (const [d, p] of [[0, 0.5], [0.17, 0.35]]) { const o = tone('sine', 78, t + d, 0.01, p, 0.16); o.frequency.exponentialRampToValueAtTime(42, t + d + 0.15); } },
      // 決まった音：'win'（ジャーン）／'finale'（全員決まった）／動きを減らす設定では、やわらかい「ポーン」
      fanfare(kind) {
        const c = ensure(); if (!c) return;
        const t = c.currentTime + 0.02;
        if (reduced()) { tone('sine', 880, t, 0.01, 0.16, 0.6); tone('sine', 1318.5, t + 0.12, 0.01, 0.1, 0.6); return; }
        if (kind === 'finale') {
          [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone('square', f, t + i * 0.1, 0.01, 0.07, 0.16));
          chord(t + 0.42, [523.25, 659.25, 783.99, 1046.5], 0.07, 1.8); crash(t + 0.42, 0.32, 1.8);
          return;
        }
        tone('square', 392, t, 0.008, 0.08, 0.09);
        chord(t + 0.11, [523.25, 659.25, 783.99, 1046.5], 0.075, 1.3); crash(t + 0.11, 0.3, 1.4);
      },
    };
  })();

  /* ───────── 見た目 ───────── */
  Kit.css('roulette', `
.ru-wrap{display:grid;gap:16px;grid-template-columns:minmax(0,1fr)}
@media (min-width:1100px){.ru-wrap{grid-template-columns:minmax(0,1fr) 360px;align-items:start}}
.ru-side{display:grid;gap:16px;min-width:0}
.ru-stagecard{padding:14px 14px 16px;overflow:hidden}
.ru-stagebox{container-type:inline-size;min-width:0}
.ru-stage{display:grid;justify-items:center;gap:8px;min-width:0;grid-template-columns:minmax(0,1fr);grid-template-areas:"meta" "read" "wheel" "ctrl" "sub" "fair"}
.ru-meta{grid-area:meta}.ru-read{grid-area:read}.ru-wheel{grid-area:wheel}.ru-ctrl{grid-area:ctrl}.ru-sub{grid-area:sub}.ru-fair{grid-area:fair}
/* 横に余裕があるとき：左に大きな盤、右に「いまの名前」と「回す」 */
@container (min-width:620px){
  .ru-stage{grid-template-columns:auto minmax(200px,1fr);grid-template-rows:1fr auto auto auto auto auto 1fr;grid-template-areas:"wheel ." "wheel meta" "wheel read" "wheel ctrl" "wheel sub" "wheel fair" "wheel .";column-gap:24px;row-gap:12px;align-items:center}
  .ru-stage>.ru-wheel{width:min(560px,calc(100vh - 210px),60cqw);margin:0}
  .ru-stage>.ru-read{min-height:72px;width:100%;border-radius:18px}
}
.ru-meta{display:flex;flex-wrap:wrap;gap:6px;justify-content:center}
.ru-meta .chip{font-size:12.5px}
.ru-meta .ru-left-chip{background:var(--demo-wash);color:var(--ink);font-weight:700}
.ru-read{display:flex;align-items:center;justify-content:center;text-wrap:balance;max-width:100%;min-height:56px;min-width:min(100%,280px);padding:4px 24px;border-radius:999px;background:var(--surface-2);border:1px solid var(--line);color:var(--ink);font-family:var(--font-display);font-weight:600;font-size:clamp(21px,2.8vw,32px);line-height:1.2;text-align:center;overflow-wrap:anywhere}
.ru-read{flex-wrap:wrap;column-gap:.35em}
.ru-ph{display:inline-block;white-space:nowrap}
.ru-read.is-idle{font-size:clamp(16px,2vw,20px);color:var(--ink-2);font-family:var(--font-body);font-weight:500}
.ru-read.is-win{background:var(--demo);border-color:var(--demo);color:var(--on-demo)}
.ru-wheel{position:relative;width:min(100%,540px,calc(100vh - 270px));min-width:min(100%,250px);aspect-ratio:1/1;margin:2px auto 0}
.ru-wheel::before{content:"";position:absolute;inset:1.4%;border-radius:50%;box-shadow:var(--shadow-2)}
.ru-wheel svg{position:absolute;inset:0;width:100%;height:100%;max-width:none;overflow:visible;pointer-events:none}   /* 回っている盤（四角い svg）の角が「回す」の上にかぶっても、押せるように */
.ru-disc{transform-origin:50% 50%}
.ru-ring{fill:var(--frame)}
.ru-ring-in{fill:var(--board)}
.ru-bulb{fill:color-mix(in srgb,var(--demo) 28%,var(--frame));stroke:transparent;stroke-width:10}
.ru-bulb.on{fill:var(--demo);stroke:color-mix(in srgb,var(--demo) 40%,transparent)}
.ru-w{fill:color-mix(in srgb,var(--c) 44%,var(--surface));stroke:var(--surface);stroke-width:2;transition:opacity .25s,fill .25s}
.ru-w.is-empty{fill:var(--surface-2)}
:root[data-theme="dark"] .ru-w:not(.is-win):not(.is-empty){fill:color-mix(in srgb,var(--c) 62%,var(--surface))}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) .ru-w:not(.is-win):not(.is-empty){fill:color-mix(in srgb,var(--c) 62%,var(--surface))}}
.ru-t{fill:var(--ink);font-family:var(--font-body);font-weight:700;transition:opacity .25s}
.ru-disc.has-win .ru-w:not(.is-win),.ru-disc.has-win .ru-t:not(.is-win){opacity:.3}
.ru-w.is-win{fill:var(--demo)}
.ru-t.is-win{fill:var(--on-demo)}
.ru-hub{fill:var(--board);stroke:var(--frame);stroke-width:12}
.ru-hub-t{fill:var(--on-board);font-family:var(--font-display);font-weight:600;text-anchor:middle}
.ru-ptr{fill:var(--shu);stroke:var(--surface);stroke-width:7;stroke-linejoin:round}
.ru-ptr-pin{fill:var(--surface);stroke:var(--shu);stroke-width:5}
.ru-ctrl{display:flex;flex-wrap:wrap;justify-content:center;gap:10px;margin-top:8px}
.ru-stage .btn,.ru-set .seg button{scroll-margin:96px 0 24px}
.ru-spin{min-height:56px;min-width:200px;padding:10px 34px;border-radius:999px;font-size:20px;letter-spacing:.24em}
.ru-spin svg{width:20px;height:20px}
.ru-sub{display:flex;flex-wrap:wrap;justify-content:center;gap:8px}
.ru-fair{font-size:12.5px;color:var(--ink-3);text-align:center}
.ru-away{display:grid;justify-items:center;gap:10px;padding:40px 10px;color:var(--ink-2);text-align:center}
.ru-away svg{width:40px;height:40px;color:var(--gosu)}
.ru-set{display:grid;gap:16px}
.ru-set h3{font-size:14px;font-weight:700}
.ru-set .seg{max-width:100%}
.ru-range{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);gap:8px;align-items:end}
.ru-tilde{padding-bottom:8px;color:var(--ink-2)}
.ru-lists{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.ru-lists select{flex:1 1 120px;width:auto;min-width:0}
.ru-presets{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.ru-presets .chip,.ru-excl-list .chip{min-height:32px;font-size:13px;border:1px solid var(--line);cursor:pointer}
.ru-excl{border:1px solid var(--line);border-radius:8px;padding:6px 10px}
.ru-excl>summary{cursor:pointer;font-size:14px;font-weight:700;color:var(--ink-2);min-height:40px;display:flex;align-items:center}
.ru-excl-list{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 6px}
.ru-excl-list .chip[aria-pressed="true"]{background:var(--surface-2);color:var(--ink-3);text-decoration:line-through;border-style:dashed}
.ru-h2{display:flex;align-items:center;gap:8px;font-size:16px;font-weight:700;margin-bottom:10px}
.ru-h2 svg{width:18px;height:18px;color:var(--gosu)}
.ru-ol{list-style:none;margin:0;padding:0;display:grid;gap:6px}
.ru-ol li{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:10px;padding:5px 10px 5px 6px;border-radius:8px;background:var(--surface);border:1px solid var(--line);font-weight:700;overflow-wrap:anywhere}
.ru-ol-n{display:inline-grid;place-items:center;min-width:30px;height:30px;padding:0 6px;border-radius:999px;background:var(--gosu);color:var(--on-gosu);font-size:14px;font-weight:700;font-variant-numeric:tabular-nums}
.ru-ordercard .ru-ol{max-height:min(46vh,420px);overflow:auto;margin-bottom:10px}
.ru-ol.big{display:block;font-size:clamp(17px,1.9vw,28px);columns:11.5em;column-gap:14px}
.ru-ol.big li{break-inside:avoid;margin-bottom:10px;padding:6px 12px 6px 6px;gap:12px}
.ru-ol.big .ru-ol-n{min-width:1.7em;height:1.7em;font-size:.72em}
.ru-hlist{list-style:none;margin:0 0 10px;padding:0;display:grid;max-height:min(40vh,360px);overflow:auto}
.ru-hlist li{display:grid;grid-template-columns:auto minmax(0,1fr);gap:0 10px;padding:6px 2px;border-bottom:1px solid var(--line)}
.ru-hlist li:last-child{border-bottom:0}
.ru-ht{grid-row:span 2;font-size:12.5px;color:var(--ink-3);padding-top:2px}
.ru-hl{font-weight:700;overflow-wrap:anywhere}
.ru-hs{font-size:12px;color:var(--ink-3)}
/* 発表モード：黒板の色で画面いっぱい */
.ru-show{position:fixed;inset:0;z-index:150;display:flex;flex-direction:column;gap:8px;background:radial-gradient(120% 90% at 30% 15%,color-mix(in srgb,var(--board) 86%,var(--on-board)) 0%,var(--board) 62%);color:var(--on-board);padding:max(12px,env(safe-area-inset-top)) var(--gutter-r) max(12px,env(safe-area-inset-bottom)) var(--gutter-l);overflow:auto}
.ru-show-top{display:flex;flex-wrap:wrap;align-items:center;gap:8px 10px}
.ru-show-top h2{font-family:var(--font-display);font-weight:600;font-size:clamp(20px,2.6vw,32px);letter-spacing:.06em;margin-right:auto}
.ru-show .btn{--btn-bg:color-mix(in srgb,var(--on-board) 10%,transparent);--btn-fg:var(--on-board);--btn-line:color-mix(in srgb,var(--on-board) 38%,transparent)}
.ru-show .btn:hover{--btn-bg:color-mix(in srgb,var(--on-board) 22%,transparent)}
.ru-show .btn[aria-pressed="false"]{opacity:.8}
.ru-show .btn.ghost{color:var(--on-board);--btn-line:color-mix(in srgb,var(--on-board) 22%,transparent)}
.ru-show .ru-spin{--btn-bg:var(--shu);--btn-line:var(--shu);--btn-fg:var(--on-shu);min-height:68px;min-width:min(100%,300px);font-size:clamp(22px,2.6vw,30px)}
.ru-show .ru-spin:hover{--btn-bg:var(--shu);filter:brightness(1.07)}
.ru-show-main{flex:1;display:grid;grid-template-columns:minmax(0,1fr);gap:16px;align-items:center;min-height:0}
@media (min-width:900px){.ru-show-main.has-side{grid-template-columns:minmax(0,1fr) minmax(240px,27vw)}}
.ru-show .ru-meta{display:none}
.ru-show .ru-read{background:color-mix(in srgb,var(--on-board) 12%,transparent);border-color:color-mix(in srgb,var(--on-board) 32%,transparent);color:var(--on-board);font-size:clamp(28px,4.4vw,62px);min-height:1.55em}
.ru-show .ru-read.is-idle{font-size:clamp(18px,2.2vw,26px)}
.ru-show .ru-read.is-win{background:var(--demo);color:var(--on-demo);border-color:var(--demo)}
.ru-show .ru-wheel{width:min(100%,calc(100vh - 260px));width:min(100%,calc(100dvh - 260px))}
@container (min-width:620px){.ru-show .ru-wheel{width:min(64cqw,calc(100vh - 120px));width:min(64cqw,calc(100dvh - 120px))}.ru-show .ru-read{min-height:2.2em}}
.ru-show .ru-fair{color:color-mix(in srgb,var(--on-board) 75%,transparent)}
.ru-show-side{align-self:stretch;display:flex;flex-direction:column;gap:8px;min-height:0;max-height:calc(100dvh - 120px)}
.ru-show-side h3{font-family:var(--font-display);font-weight:600;font-size:clamp(18px,1.8vw,24px);letter-spacing:.08em}
.ru-show-side .ru-ol{overflow:auto;min-height:0}
.ru-show .ru-ol li{background:color-mix(in srgb,var(--on-board) 9%,transparent);border-color:color-mix(in srgb,var(--on-board) 26%,transparent);color:var(--on-board);font-size:clamp(17px,1.7vw,24px)}
.ru-show .ru-ol-n{background:var(--demo);color:var(--on-demo)}
.ru-show .ru-ol li.is-new{outline:3px solid var(--demo)}
.ru-show-empty{color:color-mix(in srgb,var(--on-board) 70%,transparent);font-size:15px}
@media (max-width:899px){.ru-show-side{max-height:none}}
/* 決まった瞬間 */
.ru-reveal{position:fixed;inset:0;z-index:155;display:grid;place-items:center;padding:16px;overflow:hidden;background:color-mix(in srgb,var(--board) 86%,transparent);cursor:pointer}
.ru-rays{position:absolute;left:50%;top:50%;width:170vmax;height:170vmax;margin:-85vmax 0 0 -85vmax;border-radius:50%;pointer-events:none;background:repeating-conic-gradient(from 0deg,color-mix(in srgb,var(--demo) 34%,transparent) 0deg 8deg,transparent 8deg 20deg);-webkit-mask-image:radial-gradient(circle,var(--ink) 0,transparent 50%);mask-image:radial-gradient(circle,var(--ink) 0,transparent 50%);animation:ru-rays 18s linear infinite}
@keyframes ru-rays{to{transform:rotate(360deg)}}
.ru-card{position:relative;display:grid;justify-items:center;gap:4px;width:auto;min-width:min(92vw,480px);max-width:min(94vw,960px);max-height:calc(100dvh - 32px);overflow:auto;padding:clamp(18px,4vmin,40px) clamp(18px,5vmin,56px);border-radius:28px;background:var(--surface);color:var(--ink);border:6px solid var(--frame);box-shadow:var(--shadow-2),0 0 0 10px color-mix(in srgb,var(--demo) 55%,transparent),0 0 80px color-mix(in srgb,var(--demo) 60%,transparent);text-align:center;cursor:default;animation:ru-pop .55s cubic-bezier(.2,1.5,.4,1)}
@keyframes ru-pop{0%{transform:scale(.35) rotate(-8deg);opacity:0}55%{transform:scale(1.07) rotate(1.5deg);opacity:1}100%{transform:none}}
.ru-kicker{font-family:var(--font-display);font-weight:600;font-size:clamp(18px,3.4vmin,32px);letter-spacing:.18em;color:var(--ink-2)}
.ru-big{font-family:var(--font-display);font-weight:600;font-size:clamp(88px,26vmin,250px);line-height:1.05;color:var(--shu);font-variant-numeric:tabular-nums;overflow-wrap:anywhere;max-width:100%}
.ru-big small{font-size:.3em;margin-left:.08em;color:var(--ink)}
.ru-big.is-text{font-size:clamp(44px,12vmin,130px);line-height:1.2}
.ru-big.is-long{font-size:clamp(32px,7.5vmin,84px);line-height:1.25}
.ru-name{font-weight:700;font-size:clamp(28px,7.5vmin,76px);line-height:1.2;overflow-wrap:anywhere}
.ru-left{margin-top:4px;font-size:clamp(14px,2.2vmin,18px);color:var(--ink-2)}
.ru-left.is-done{color:var(--ok);font-weight:700}
.ru-card .btn-row{justify-content:center;margin-top:14px}
.ru-card .btn.primary{min-height:52px;padding:8px 28px;font-size:18px;border-radius:999px}
.ru-confetti{position:absolute;inset:0;width:100%;height:100%;max-width:none;pointer-events:none}
@media (prefers-reduced-motion:reduce){.ru-rays{animation:none}.ru-card{animation:none}}
/* 順番の一覧（大きく） */
.ru-list{position:fixed;inset:0;z-index:152;display:flex;flex-direction:column;background:var(--bg);color:var(--ink);padding:max(14px,env(safe-area-inset-top)) var(--gutter-r) max(14px,env(safe-area-inset-bottom)) var(--gutter-l);overflow:auto}
.ru-list-head{display:flex;flex-wrap:wrap;align-items:center;gap:8px 10px;margin-bottom:14px}
.ru-list-head h2{font-family:var(--font-display);font-weight:600;font-size:clamp(20px,3vw,34px);letter-spacing:.04em;margin-right:auto}
.ru-list-sub{font-size:14px;color:var(--ink-2);flex-basis:100%;margin-top:-6px}
body:has(.ru-show) .modal-back,body:has(.ru-list) .modal-back,body:has(.ru-reveal) .modal-back{z-index:158}
body:has(.ru-show) .mb-toasts,body:has(.ru-list) .mb-toasts{z-index:170}
@media (max-width:640px){
  .ru-stagecard{padding:10px 8px 14px}
  .ru-spin{min-width:min(100%,240px)}
  .ru-read{min-height:48px;padding:4px 16px}
  .ru-show-top h2{flex-basis:100%}
}
/* 印刷（白黒でも読めるように、線の太さで区切る） */
.ru-print{font-family:var(--font-body);color:#000}
.ru-print h1{font-family:var(--font-display);font-size:20pt;margin:0 0 2mm}
.ru-print .sub{font-size:10.5pt;margin-bottom:5mm}
.ru-print .cols{display:flex;gap:7mm;align-items:flex-start}
.ru-print table{border-collapse:collapse;flex:1;width:100%}
.ru-print th,.ru-print td{border:1pt solid #000;padding:1.2mm 3mm;font-size:13pt;text-align:left;height:9mm}
.ru-print th{font-size:9.5pt;font-weight:700;height:7mm;border-bottom:2pt solid #000}
.ru-print td.n{width:15mm;text-align:center;font-weight:700;font-size:15pt}
.ru-print td.no{width:14mm;text-align:center}
.ru-print tbody tr:nth-child(5n) td{border-bottom-width:2pt}
`);

  const SRC = [{ value: 'class', label: '名簿のクラス' }, { value: 'range', label: '番号の範囲' }, { value: 'items', label: '自由な項目' }];
  const SPEED_OPTS = [{ value: 'quick', label: 'さっと（約3秒）' }, { value: 'slow', label: 'じっくり（約6秒）' }];
  const oneOf = (v, list, d) => (list.includes(v) ? v : d);

  Kit.app({
    id: 'roulette', title: 'ルーレット', group: 'class', icon: 'roulette', order: 25,
    desc: '行事や発表の「だれから？」を、派手なルーレットで決める。順番の一覧・印刷も',
    colls: ['roulettes'],
    async mount(rootEl) {
      // デモの記録は、デモを始めるたび・終えたあとに空にする
      if (!Kit.store.demo || !(Kit.demo && Kit.demo.running())) MEM.demo = newMem();
      const M = mem();
      const P = (k, d) => Kit.pref.get('roulette.' + k, d);
      const setP = (k, v) => Kit.pref.set('roulette.' + k, v);
      const normRange = (r) => ({ from: r && r.from != null ? r.from : 1, to: r && r.to != null ? r.to : 40, skip: r && r.skip ? String(r.skip) : '' });
      const S = {
        src: oneOf(P('src', 'class'), ['class', 'range', 'items'], 'class'),
        mode: oneOf(P('mode', 'one'), ['one', 'order', 'remove'], 'one'),
        speed: oneOf(P('speed', 'slow'), ['quick', 'slow'], 'slow'),
        sound: P('sound', true) !== false,
        names: P('names', true) !== false,
        range: normRange(P('range', null)),
        listId: P('list', null),
        cls: null, lists: [], spinning: false, dirty: false, hold: false, lastWin: null, exclOpen: false,
        show: null, reveal: null, list: null, selfWrite: 0,
      };
      let alive = true, renderSeq = 0, wheelSig = null;
      // くじの乱数：School.rng（種は端末の暗号用の乱数から。なければ時刻から）
      const seed = () => { try { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0]; } catch (e) { return School.newSeed(); } };
      const rng = School.rng(seed());

      /* ── 何から選ぶか ── */
      const curList = () => S.lists.find((l) => l.id === S.listId) || S.lists[0] || null;
      const unitOf = () => (S.src === 'items' ? 'つ' : '人');
      // 生徒の出し方は、そのときの「名前を隠す」に合わせる（記録も印刷も同じ）
      function viewOf(e) {
        if (!e.st) return e;
        const st = e.st;
        if (S.names && !School.hidden() && st.name) { const l = School.label(st, { hide: false }); return { big: String(st.no), small: '', name: st.name, label: l, wheel: l }; }
        return { big: String(st.no), small: '番', name: '', label: st.no + '番', wheel: String(st.no) };
      }
      function entries() {
        if (S.src === 'class') {
          if (!S.cls) return { list: [], title: '名簿のクラス', error: '名簿にクラスがありません' };
          return { list: S.cls.students.map((st) => ({ key: 'st:' + st.id, st })), title: S.cls.name || 'クラス', id: S.cls.id };
        }
        if (S.src === 'range') {
          const r = Core.rangeList(S.range.from, S.range.to);
          return { list: r.nums.map((k) => ({ key: 'n:' + k, big: String(k), small: '番', name: '', label: k + '番', wheel: String(k) })), title: r.error ? '番号の範囲' : r.from + '〜' + r.to + '番', id: r.from + '-' + r.to, error: r.error };
        }
        const L = curList();
        const items = Core.parseItems(L ? L.text : '');
        return { list: items.map((t, i) => ({ key: 'it:' + i + ':' + t, big: t, small: '', name: '', label: t, wheel: t })), title: L ? L.title || '自由な項目' : '自由な項目', id: (L ? L.id : '') + ':' + hash(items.join('\n')), error: items.length ? '' : '項目を1行に1つずつ書いてください' };
      }
      const exclSet = () => { if (!S.cls) return new Set(); if (!M.excl.has(S.cls.id)) M.excl.set(S.cls.id, new Set()); return M.excl.get(S.cls.id); };
      function excluded() {
        if (S.src === 'class') return new Set([...exclSet()].map((id) => 'st:' + id));
        if (S.src === 'range') return new Set(Core.parseNums(S.range.skip).map((k) => 'n:' + k));
        return new Set();
      }
      // 決めている途中の順番：何から選ぶか・決め方ごとに覚える（元に戻すと続きから）
      const roundKey = () => S.src + '|' + entries().id + '|' + S.mode;
      function round() { const k = roundKey(); if (!M.rounds.has(k)) M.rounds.set(k, { picked: [] }); return M.rounds.get(k); }
      function pool() {
        const ex = excluded(), picked = S.mode === 'one' ? new Set() : new Set(round().picked.map((e) => e.key));
        return entries().list.filter((e) => !ex.has(e.key) && !picked.has(e.key));
      }
      const isDone = () => S.mode !== 'one' && round().picked.length > 0 && pool().length === 0;
      const modeOpts = () => [
        { value: 'one', label: S.src === 'items' ? '1つだけ選ぶ' : '1人だけ選ぶ' },
        { value: 'order', label: S.src === 'items' ? '全部の順番を決める' : '全員の順番を決める' },
        { value: 'remove', label: '当たったら外して続ける' }];
      const modeName = (m) => (modeOpts().find((x) => x.value === m) || {}).label || '';
      const nthWord = (n) => (S.mode === 'order' ? n + '番目' : n + (S.src === 'items' ? 'つ目' : '人目'));

      /* ── 盤（作るのは1回。中身は選ぶものが変わったときだけ描き直す） ── */
      const VB = '-520 -520 1040 1040';
      const frame = sv('svg', { class: 'ru-frame', viewBox: VB, 'aria-hidden': 'true' }, sv('circle', { class: 'ru-ring', r: 506 }), sv('circle', { class: 'ru-ring-in', r: 458 }));
      const bulbs = Array.from({ length: 24 }, (_, i) => { const a = (i / 24) * Math.PI * 2; return sv('circle', { class: 'ru-bulb' + (i % 2 ? '' : ' on'), cx: (482 * Math.sin(a)).toFixed(1), cy: (-482 * Math.cos(a)).toFixed(1), r: 10 }); });
      bulbs.forEach((b) => frame.append(b));
      const discG = sv('g');
      const disc = sv('svg', { class: 'ru-disc', viewBox: VB, 'aria-hidden': 'true' }, discG);
      const hubSmall = sv('text', { class: 'ru-hub-t', y: -16, 'font-size': 26 });
      const hubBig = sv('text', { class: 'ru-hub-t', y: 30, 'font-size': 64 });
      const ptrG = sv('g', null, sv('path', { class: 'ru-ptr', d: 'M0,-410 L-36,-498 Q0,-526 36,-498 Z' }), sv('circle', { class: 'ru-ptr-pin', cy: -494, r: 10 }));
      const topSvg = sv('svg', { class: 'ru-top', viewBox: VB, 'aria-hidden': 'true' }, sv('circle', { class: 'ru-hub', r: 92 }), hubSmall, hubBig, ptrG);
      const wheel = h('div', { class: 'ru-wheel', role: 'img', 'aria-label': 'ルーレット盤' }, frame, disc, topSvg);
      const metaEl = h('div', { class: 'ru-meta' });
      const readEl = h('div', { class: 'ru-read is-idle', 'aria-live': 'polite' });
      const spinBtn = Kit.btn('回す', () => spin(), { kind: 'primary', icon: 'play', class: 'ru-spin' });
      const subEl = h('div', { class: 'ru-sub' });
      const fairEl = h('p', { class: 'ru-fair' });
      const stage = h('div', { class: 'ru-stage' }, metaEl, readEl, wheel, h('div', { class: 'ru-ctrl' }, spinBtn), subEl, fairEl);
      const stageBox = h('div', { class: 'ru-stagebox' }, stage);   // 幅を見て、盤と操作を横に並べる（container）
      disc.style.transform = 'rotate(' + M.angle + 'deg)';

      const pt = (a, r) => [r * Math.sin((a * Math.PI) / 180), -r * Math.cos((a * Math.PI) / 180)];
      const wedgePath = (a0, a1, r) => { const [x0, y0] = pt(a0, r), [x1, y1] = pt(a1, r); return 'M0,0L' + x0.toFixed(2) + ',' + y0.toFixed(2) + 'A' + r + ',' + r + ' 0 ' + (a1 - a0 > 180 ? 1 : 0) + ' 1 ' + x1.toFixed(2) + ',' + y1.toFixed(2) + 'Z'; };
      // となりの区画が同じ色にならないように（最後と最初も）
      function colorsFor(n) {
        const c = Array.from({ length: n }, (_, i) => i % 8);
        if (n > 2 && c[n - 1] === c[0]) c[n - 1] = [0, 1, 2, 3, 4, 5, 6, 7].find((x) => x !== c[0] && x !== c[n - 2]);
        return c;
      }
      function drawDisc(list) {
        Kit.clear(discG);
        disc.classList.remove('has-win');
        const n = list.length, R = 452;
        if (!n) { discG.append(sv('circle', { class: 'ru-w is-empty', r: R })); return; }
        const s = 360 / n, col = colorsFor(n);
        const base = Math.min(60, ((2 * Math.PI * 290) / n) * 0.56);   // 区画の幅に入る文字の大きさ
        const texts = base >= 12;                                      // 区画が細すぎるときは文字を出さない（上の表示で読む）
        list.forEach((e, i) => {
          const w = n === 1 ? sv('circle', { r: R }) : sv('path', { d: wedgePath(i * s, (i + 1) * s, R) });
          w.setAttribute('class', 'ru-w'); w.setAttribute('data-i', i); w.style.setProperty('--c', 'var(--series-' + (col[i] + 1) + ')');
          discG.append(w);
        });
        if (!texts) return;
        // 字の大きさは、だいたいの長さ（長いほうから2割を除いた長さ）でそろえる。それより長いものだけ小さく・はみ出す分は「…」
        const lens = list.map((e) => [...viewOf(e).wheel].length).sort((a, b) => a - b);
        const ref = Math.max(2, lens[Math.floor((lens.length - 1) * 0.8)]);
        const fsRef = Math.min(base, 330 / ref);
        list.forEach((e, i) => {
          const chars = [...viewOf(e).wheel];
          const fs = Math.max(13, Math.min(fsRef, 330 / Math.max(1, chars.length)));
          const max = Math.floor(330 / fs);
          const t = chars.length > max ? chars.slice(0, Math.max(1, max - 1)).join('') + '…' : chars.join('');
          const mid = i * s + s / 2;
          discG.append(sv('text', { class: 'ru-t', 'data-i': i, x: 432, y: 0, 'text-anchor': 'end', 'dominant-baseline': 'central', 'font-size': fs.toFixed(1), transform: 'rotate(' + (n === 1 ? -90 : mid - 90).toFixed(3) + ')' }, t));
        });
      }
      function markWin(i) {
        disc.classList.add('has-win');
        for (const el of discG.querySelectorAll('.is-win')) el.classList.remove('is-win');
        for (const el of discG.querySelectorAll('[data-i="' + i + '"]')) el.classList.add('is-win');
      }
      const setBulbs = (fn) => bulbs.forEach((b, i) => b.classList.toggle('on', !!fn(i)));
      // 上の表示。配列で渡すと、句の切れ目でだけ折り返す
      const setRead = (text, cls) => { if (Array.isArray(text)) Kit.add(Kit.clear(readEl), text.map((t) => h('span', { class: 'ru-ph' }, t))); else readEl.textContent = text; readEl.className = 'ru-read' + (cls ? ' ' + cls : ''); };

      function updateStage() {
        const E = entries(), list = pool(), r = round(), unit = unitOf();
        const sig = list.map((e) => e.key + '=' + viewOf(e).wheel).join('|');
        if (sig !== wheelSig && !S.hold) { wheelSig = sig; drawDisc(list); if (S.mode !== 'one' || !S.lastWin || !list.some((e) => e.key === S.lastWin.key)) S.lastWin = null; }
        if (!S.hold && !S.spinning && !(S.lastWin && S.mode === 'one')) disc.classList.remove('has-win');   // 前に当たった区画の光を消す
        disc.style.transform = 'rotate(' + M.angle + 'deg)';
        const done = isDone();
        // 真ん中
        if (S.mode === 'one') { hubSmall.textContent = ''; hubBig.textContent = '？'; hubBig.setAttribute('y', 24); }
        else { hubSmall.textContent = 'のこり'; hubBig.textContent = String(list.length); hubBig.setAttribute('y', 40); }
        hubBig.setAttribute('font-size', S.mode !== 'one' && list.length > 99 ? 52 : 64);
        // 上の札
        Kit.add(Kit.clear(metaEl), [h('span', { class: 'chip blue' }, E.title + '・' + E.list.length + unit), h('span', { class: 'chip' }, modeName(S.mode)),
          S.mode !== 'one' ? h('span', { class: 'chip' + (done ? ' ok' : ' ru-left-chip') }, done ? (S.mode === 'order' ? '全員決まりました' : '全員当たりました') : 'のこり ' + list.length + unit) : null]);
        // 上の表示
        if (!S.spinning) {
          if (S.lastWin && S.mode === 'one') { setRead(viewOf(S.lastWin).label, 'is-win'); markWinByKey(); }
          else if (done) setRead(S.mode === 'order' ? '順番が決まりました' : '全員当たりました', 'is-idle');
          else if (!list.length) setRead(E.error || '選ぶものがありません', 'is-idle');
          else {
            const one = S.src === 'items' ? '1つ' : '1人';
            setRead(S.mode === 'one' ? [list.length + unit + 'から', one + 'を選びます'] : r.picked.length ? ['のこり' + list.length + unit + 'から', '次を選びます'] : S.mode === 'order' ? [list.length + unit + 'の', '順番を決めます'] : [list.length + unit + 'から', '順に選びます'], 'is-idle');
          }
        }
        // ボタン
        spinBtn.querySelector('span').textContent = done ? 'はじめからやり直す' : '回す';
        spinBtn.classList.toggle('primary', !done);
        spinBtn.disabled = S.spinning || (!list.length && !done);
        Kit.clear(subEl);
        if (S.mode !== 'one' && !S.spinning) {
          if (S.mode === 'order' && list.length >= 2) subEl.append(Kit.btn('のこりをまとめて決める', () => decideRest(), { sm: true, icon: 'shuffle' }));
          if (r.picked.length) subEl.append(Kit.btn('1つ戻す', () => undo(), { sm: true, kind: 'ghost', icon: 'undo' }));
          if (r.picked.length && !done) subEl.append(Kit.btn('はじめからやり直す', () => restart(), { sm: true, kind: 'ghost', icon: 'refresh' }));
        }
        fairEl.textContent = S.src === 'items' ? 'どの項目も同じ確率で選ばれます（毎回その場でくじを引きます）。' : 'どの人も同じ確率で当たります（毎回その場でくじを引きます）。';
        if (S.show) { updateShowTop(); renderShowSide(); }
      }
      function markWinByKey() {
        const i = pool().findIndex((e) => S.lastWin && e.key === S.lastWin.key);
        if (i >= 0) markWin(i);
      }

      /* ── 回す ── */
      async function spin() {
        if (S.spinning || !alive) return;
        Snd.unlock();
        closeReveal();
        if (isDone()) { await restart(); return; }
        const list = pool();
        if (!list.length) { Kit.toast(entries().error || '選ぶものがありません', { type: 'bad' }); return; }
        S.lastWin = null;
        updateStage();
        disc.classList.remove('has-win');
        if (S.mode === 'order' && list.length === 1) { await decide(list[0], 0, { last: true }); return; }  // のこり1人は回さずに決まり
        const idx = Core.pickIndex(list.length, rng);
        const plan = Core.plan({ n: list.length, index: idx, from: M.angle, rand: rng, speed: S.speed, reduced: reduced(), scale: scale() });
        S.spinning = true; stage.classList.add('is-spinning'); spinBtn.disabled = true; Kit.clear(subEl);
        await animate(plan, list);
        M.angle = mod(plan.to, 360);
        disc.style.transform = 'rotate(' + M.angle + 'deg)';
        if (!alive) return;
        await decide(list[idx], idx);
      }
      function animate(plan, list) {
        return new Promise((resolve) => {
          const n = list.length, red = reduced(), t0 = performance.now();
          let last = -1, lastTick = 0, kick = 0, phase = '', bulbStep = -1, done = false, raf = 0;
          Snd.rollStart();
          disc.style.willChange = 'transform';
          const finish = () => {
            if (done) return; done = true;
            cancelAnimationFrame(raf); clearTimeout(safety);
            disc.style.transform = 'rotate(' + plan.to + 'deg)'; disc.style.willChange = '';
            ptrG.removeAttribute('transform');
            Snd.rollStop();
            resolve();
          };
          // 画面が隠れて描画が止まっても、決まるところまでは進める
          const safety = setTimeout(finish, plan.total + 1500);
          const frameFn = (now) => {
            if (done) return;
            if (!alive) { finish(); return; }
            const t = now - t0;
            const a = Core.angleAt(plan, t);
            disc.style.transform = 'rotate(' + a.toFixed(3) + 'deg)';
            const i = Core.indexAt(a, n);
            if (i !== last) {
              if (last >= 0 && now - lastTick > 34) { lastTick = now; Snd.tick(); if (!red) kick = 1; }
              last = i; setRead(viewOf(list[i]).label, '');
            }
            const ph = Core.phaseAt(plan, t);
            if (ph !== phase) { phase = ph; stage.dataset.phase = ph; if (ph === 'hold') Snd.heart(); if (ph === 'creep') Snd.rollSwell(); }
            // 針：区切りを越えるたびに、はじかれて戻る
            kick *= 0.8;
            if (kick > 0.03) ptrG.setAttribute('transform', 'rotate(' + (-15 * kick).toFixed(2) + ' 0 -494)'); else ptrG.removeAttribute('transform');
            // 光：回っている間は追いかけっこ、止まりかけはゆっくり点滅
            if (!red) {
              const slow = ph === 'hold' || ph === 'creep';
              const k = Math.floor(t / (slow ? 240 : 85));
              if (k !== bulbStep) { bulbStep = k; setBulbs(slow ? (j) => (j + k) % 2 === 0 : (j) => (j + k) % 3 === 0); }
            }
            if (t >= plan.total) { finish(); return; }
            raf = requestAnimationFrame(frameFn);
          };
          raf = requestAnimationFrame(frameFn);
        });
      }
      // 決まった：記録して、盤を光らせて、大きく見せる
      async function decide(e, idx, o = {}) {
        S.spinning = true; stage.classList.add('is-spinning'); spinBtn.disabled = true;
        const r = round();
        if (S.mode !== 'one') r.picked.push(e);
        const nth = r.picked.length;
        const done = isDone();
        const E = entries();
        M.hist.unshift({ at: new Date(), e, sub: E.title + '・' + (S.mode === 'one' ? modeName('one') : nthWord(nth)) });
        if (M.hist.length > 300) M.hist.length = 300;
        S.lastWin = e; S.hold = true;
        markWin(idx);
        setRead(viewOf(e).label, 'is-win');
        Snd.fanfare(done && S.mode === 'order' ? 'finale' : 'win');
        if (!reduced()) { for (let k = 0; k < 6; k++) { setBulbs(() => k % 2 === 0); await wait(70); } }
        setBulbs(() => true);
        S.spinning = false; stage.classList.remove('is-spinning');
        if (!alive) return;
        renderPanels();
        showReveal(e, { nth, done, last: o.last });
      }
      async function decideRest() {
        const list = pool();
        if (list.length < 2) return;
        const ok = await Kit.confirm({ title: 'のこりをまとめて決めますか？', body: 'のこりの ' + list.length + unitOf() + 'の順番を、くじでまとめて決めます（1人ずつ回すのと同じ確率です）。', ok: 'まとめて決める' });
        if (!ok || !alive) return;
        const r = round(), E = entries();
        for (const e of Core.shuffle(list, rng)) { r.picked.push(e); M.hist.unshift({ at: new Date(), e, sub: E.title + '・' + nthWord(r.picked.length) + '（まとめて）' }); }
        S.lastWin = null;
        Snd.unlock(); Snd.fanfare('finale');
        render();
        openList();
      }
      function undo() {
        const r = round();
        if (!r.picked.length) return;
        const e = r.picked.pop();
        Kit.toast((viewOf(e).label) + ' を盤に戻しました');
        render();
      }
      async function restart() {
        const r = round();
        if (r.picked.length) {
          const ok = await Kit.confirm({ title: 'はじめからやり直しますか？', body: '決まった ' + r.picked.length + unitOf() + 'の' + (S.mode === 'order' ? '順番' : '当たり') + 'を消して、全員を盤に戻します（その場の記録は残ります）。' + (isDone() && S.mode === 'order' ? '印刷やコピーがまだなら、先に「大きく見る」からどうぞ。' : ''), ok: 'やり直す', danger: true });
          if (!ok || !alive) return;
        }
        M.rounds.delete(roundKey());
        S.lastWin = null;
        render();
      }

      /* ── 決まった瞬間（大きく・紙吹雪・光） ── */
      function showReveal(e, o) {
        closeReveal(true);
        const v = viewOf(e), unit = unitOf(), left = pool().length;
        const kicker = S.mode === 'one' ? '決定！' : o.last ? '最後は…' : nthWord(o.nth);
        const isText = !e.st && S.src === 'items';
        const len = [...v.big].length;
        const big = h('div', { class: 'ru-big' + (isText ? (len > 8 ? ' is-long' : len > 3 ? ' is-text' : '') : '') }, v.big, v.small ? h('small', null, v.small) : null);
        const leftText = S.mode === 'one' ? '' : o.done ? (S.mode === 'order' ? '全員の順番が決まりました！' : '全員当たりました！') : 'のこり ' + left + unit;
        const close = () => closeReveal();
        let primary;
        if (o.done) primary = Kit.btn(S.mode === 'order' ? '順番の一覧を見る' : '当たった順を見る', () => { closeReveal(); openList(); }, { kind: 'primary', icon: 'eye' });
        else primary = Kit.btn(S.mode === 'one' ? 'もう一度回す' : '次を回す', () => { closeReveal(); spin(); }, { kind: 'primary', icon: 'play' });
        const card = h('div', { class: 'ru-card', role: 'document' },
          h('div', { class: 'ru-kicker' }, kicker), big, v.name ? h('div', { class: 'ru-name' }, v.name) : null,
          leftText ? h('div', { class: 'ru-left' + (o.done ? ' is-done' : '') }, leftText) : null,
          h('div', { class: 'btn-row' }, primary, Kit.btn('閉じる', close, { kind: 'ghost', icon: 'close' })));
        const ov = h('div', { class: 'ru-reveal', role: 'dialog', 'aria-modal': 'true', 'aria-label': kicker + ' ' + v.label }, reduced() ? null : h('div', { class: 'ru-rays', 'aria-hidden': 'true' }), card);
        ov.addEventListener('click', (ev) => { if (ev.target === ov) close(); });
        const onKey = (ev) => {
          if (Kit.modalOpen()) return;
          if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); close(); }
          else if ((ev.key === 'Enter' || ev.key === ' ') && !/BUTTON|A|INPUT|TEXTAREA|SELECT/.test(ev.target.tagName)) { ev.preventDefault(); ev.stopPropagation(); primary.click(); }
        };
        document.addEventListener('keydown', onKey, true);
        document.body.append(ov);
        belowRibbon(ov);
        S.reveal = { ov, onKey };
        if (!reduced()) confetti(ov, o.done ? 1.5 : 1);
        setTimeout(() => { try { primary.focus({ preventScroll: true }); } catch (err) { /* noop */ } }, 30);
      }
      function closeReveal(keepHold) {
        if (!S.reveal) { if (!keepHold && S.hold) { S.hold = false; updateStage(); } return; }
        const { ov, onKey } = S.reveal;
        S.reveal = null;
        document.removeEventListener('keydown', onKey, true);
        ov.remove();
        if (!keepHold) { S.hold = false; updateStage(); try { spinBtn.focus({ preventScroll: true }); } catch (e) { /* noop */ } }
      }
      // 紙吹雪（色は道具箱の色の変数から）
      function confetti(host, power) {
        const cv = h('canvas', { class: 'ru-confetti', 'aria-hidden': 'true' });
        host.append(cv);
        const W = host.clientWidth || window.innerWidth, H = host.clientHeight || window.innerHeight;
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
        const c = cv.getContext('2d');
        if (!c) return;
        c.scale(dpr, dpr);
        const cs = getComputedStyle(document.documentElement);
        const cols = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => cs.getPropertyValue('--series-' + i).trim()).concat([cs.getPropertyValue('--demo').trim(), cs.getPropertyValue('--shu').trim()]).filter(Boolean);
        const N = Math.round((W < 640 ? 90 : 170) * power);
        const R = Math.random;
        const ps = Array.from({ length: N }, (_, i) => {
          const side = i % 3;   // 0 … 真ん中から上へ、1・2 … 左下・右下から斜めに
          const x = side === 0 ? W / 2 + (R() - 0.5) * W * 0.2 : side === 1 ? -10 : W + 10;
          const y = side === 0 ? H * 0.45 : H * 0.85;
          const ang = side === 0 ? -Math.PI / 2 + (R() - 0.5) * 2.2 : side === 1 ? -Math.PI / 3 + (R() - 0.5) * 0.6 : (-2 * Math.PI) / 3 + (R() - 0.5) * 0.6;
          const sp = (side === 0 ? 9 : 14) + R() * 9;
          return { x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, w: 7 + R() * 7, h: 4 + R() * 6, r: R() * 6, vr: (R() - 0.5) * 0.4, col: cols[Math.floor(R() * cols.length)], shape: R() < 0.25 ? 1 : 0, wob: R() * 6 };
        });
        const t0 = performance.now();
        let prev = t0;
        const step = (now) => {
          if (!cv.isConnected) return;
          const dt = Math.min(3, (now - prev) / 16.7); prev = now;
          c.clearRect(0, 0, W, H);
          let alive2 = 0;
          for (const p of ps) {
            p.vy += 0.32 * dt; p.vx *= Math.pow(0.985, dt); p.vy *= Math.pow(0.985, dt);
            p.x += (p.vx + Math.sin(p.wob + now / 260) * 0.6) * dt; p.y += p.vy * dt; p.r += p.vr * dt;
            if (p.y > H + 30) continue;
            alive2++;
            c.save(); c.translate(p.x, p.y); c.rotate(p.r); c.fillStyle = p.col;
            if (p.shape) { c.beginPath(); c.arc(0, 0, p.w / 2.4, 0, Math.PI * 2); c.fill(); }
            else { c.scale(1, Math.cos(p.r * 2.2)); c.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); }
            c.restore();
          }
          if (alive2 && now - t0 < 4200) requestAnimationFrame(step); else cv.remove();
        };
        requestAnimationFrame(step);
      }

      /* ── 順番の一覧（大きく）・印刷・コピー ── */
      const orderTitle = () => entries().title + (S.mode === 'order' ? ' の順番' : ' 当たった順');
      function orderList(o = {}) {
        const items = round().picked;
        return h('ol', { class: 'ru-ol' + (o.big ? ' big' : '') }, items.map((e, i) => h('li', { class: o.markLast && i === items.length - 1 ? 'is-new' : null }, h('b', { class: 'ru-ol-n' }, i + 1), h('span', null, viewOf(e).label))));
      }
      function openList() {
        closeList();
        const r = round();
        if (!r.picked.length) { Kit.toast('まだ決まっていません'); return; }
        const done = isDone();
        const ov = h('div', { class: 'ru-list', role: 'dialog', 'aria-modal': 'true', 'aria-label': orderTitle() },
          h('div', { class: 'ru-list-head' },
            h('h2', null, orderTitle()),
            Kit.btn('印刷', () => printDlg(), { icon: 'printer' }),
            Kit.btn('コピー', () => copyOrder(), { icon: 'copy' }),
            Kit.btn('閉じる', () => closeList(), { kind: 'ghost', icon: 'close' }),
            h('p', { class: 'ru-list-sub' }, Kit.fmtDate(Kit.ymd(), 'YYYY年M月D日(W)') + '　' + r.picked.length + unitOf() + (done ? '' : '（のこり ' + pool().length + unitOf() + 'は、まだ決まっていません）'))),
          orderList({ big: true }));
        const onKey = (ev) => { if (ev.key === 'Escape' && !Kit.modalOpen()) { ev.preventDefault(); ev.stopPropagation(); closeList(); } };
        document.addEventListener('keydown', onKey, true);
        document.body.append(ov);
        belowRibbon(ov);
        S.list = { ov, onKey };
        ov.tabIndex = -1; ov.focus({ preventScroll: true });
      }
      function closeList() {
        if (!S.list) return;
        document.removeEventListener('keydown', S.list.onKey, true);
        S.list.ov.remove(); S.list = null;
      }
      function printDlg() {
        const r = round();
        if (!r.picked.length) { Kit.toast('まだ決まっていません', { type: 'bad' }); return; }
        const title = h('input', { type: 'text', id: 'ru-print-title', value: orderTitle() });
        const date = h('input', { type: 'text', id: 'ru-print-date', value: Kit.fmtDate(Kit.ymd(), 'M月D日(W)') });
        Kit.modal({
          title: '順番を印刷', body: h('div', { class: 'stack' }, Kit.field({ label: '見出し', input: title }), Kit.field({ label: '日付など', input: date }),
            h('p', { class: 'small muted' }, 'A4 たてで印刷します。' + (S.src === 'class' && School.hidden() ? '「名前を隠す」がオンなので、番号だけで印刷します。' : ''))),
          actions: [{ label: 'やめる', kind: 'ghost' }, { label: '印刷する', kind: 'primary', onClick: () => doPrint(title.value, date.value) }],
        });
      }
      function rowsOf() {
        const list = round().picked;
        if (S.src === 'class') {
          const names = list.some((e) => viewOf(e).name);
          return { head: names ? ['順番', '番号', '名前'] : ['順番', '番号'], rows: list.map((e, i) => { const v = viewOf(e); return names ? [i + 1, e.st.no, v.name] : [i + 1, e.st.no]; }) };
        }
        if (S.src === 'range') return { head: ['順番', '番号'], rows: list.map((e, i) => [i + 1, e.big]) };
        return { head: ['順番', '項目'], rows: list.map((e, i) => [i + 1, e.label]) };
      }
      function doPrint(title, sub) {
        const { head, rows } = rowsOf();
        const table = (part) => h('table', null, h('thead', null, h('tr', null, head.map((x) => h('th', null, x)))),
          h('tbody', null, part.map((r) => h('tr', null, r.map((c, j) => h('td', { class: j === 0 ? 'n' : head[j] === '番号' ? 'no' : null }, String(c)))))));
        const half = rows.length > 24 ? Math.ceil(rows.length / 2) : rows.length;
        School.print({ build: () => h('div', { class: 'ru-print' }, h('h1', null, title || orderTitle()), h('div', { class: 'sub' }, [sub, rows.length + unitOf()].filter(Boolean).join('　')),
          h('div', { class: 'cols' }, table(rows.slice(0, half)), rows.length > half ? table(rows.slice(half)) : null)) });
      }
      function copyOrder() {
        const { head, rows } = rowsOf();
        if (!rows.length) { Kit.toast('まだ決まっていません', { type: 'bad' }); return; }
        Kit.copy(School.tsv([head].concat(rows)), '順番をコピーしました（Excel にそのまま貼れます）');
      }

      /* ── 発表モード（画面いっぱい） ── */
      const fsTarget = document.documentElement;
      const canFull = !!(fsTarget.requestFullscreen || fsTarget.webkitRequestFullscreen) && document.fullscreenEnabled !== false;
      function openShow() {
        if (S.show) return;
        Snd.unlock();
        const title = h('h2');
        const sndBtn = Kit.btn(S.sound ? '音：オン' : '音：オフ', () => setSound(!S.sound), { icon: 'volume' });
        const top = h('div', { class: 'ru-show-top' }, title, sndBtn,
          canFull ? Kit.btn('全画面', () => toggleFull(), { icon: 'desktop' }) : null,
          Kit.btn('閉じる', () => closeShow(), { icon: 'close' }));
        const side = h('aside', { class: 'ru-show-side', 'aria-label': '決まった順' });
        const mainBox = h('div', { class: 'ru-show-main' }, stageBox, side);
        const ov = h('div', { class: 'ru-show', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'ルーレット（発表モード）' }, top, mainBox);
        const onKey = (ev) => {
          if (S.reveal || S.list || Kit.modalOpen()) return;
          if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); closeShow(); }
          else if ((ev.key === ' ' || ev.key === 'Enter') && !/BUTTON|A|INPUT|TEXTAREA|SELECT/.test(ev.target.tagName)) { ev.preventDefault(); spin(); }
        };
        document.addEventListener('keydown', onKey, true);
        document.body.append(ov);
        belowRibbon(ov);
        S.show = { ov, title, sndBtn, side, mainBox, onKey };
        render();
        ov.tabIndex = -1; ov.focus({ preventScroll: true });
      }
      function updateShowTop() {
        if (!S.show) return;
        const E = entries(), list = pool();
        S.show.title.textContent = E.title + '　' + (S.mode === 'one' ? modeName('one') : 'のこり ' + list.length + unitOf());
        const b = S.show.sndBtn;
        b.querySelector('span').textContent = S.sound ? '音：オン' : '音：オフ';
        b.setAttribute('aria-pressed', String(S.sound));
      }
      function renderShowSide() {
        if (!S.show) return;
        const side = S.show.side;
        Kit.clear(side);
        if (S.mode === 'one') {
          const recent = M.hist.filter((x) => x.sub.startsWith(entries().title + '・')).slice(0, 8);
          S.show.mainBox.classList.toggle('has-side', recent.length > 0);
          if (!recent.length) return;
          side.append(h('h3', null, 'これまでの当たり'), h('ol', { class: 'ru-ol' }, recent.map((x, i) => h('li', { class: i === 0 ? 'is-new' : null }, h('b', { class: 'ru-ol-n' }, hm(x.at)), h('span', null, viewOf(x.e).label)))));
          return;
        }
        S.show.mainBox.classList.add('has-side');
        const r = round();
        side.append(h('h3', null, S.mode === 'order' ? '決まった順番' : '当たった順'));
        if (!r.picked.length) side.append(h('p', { class: 'ru-show-empty' }, '「回す」で決まった順に、ここに並びます。'));
        else { const ol = orderList({ markLast: true }); side.append(ol); requestAnimationFrame(() => { ol.scrollTop = ol.scrollHeight; }); }
        if (r.picked.length) side.append(h('div', { class: 'btn-row' }, Kit.btn('大きく見る', () => openList(), { sm: true, icon: 'eye' })));
      }
      function toggleFull() {
        try {
          if (document.fullscreenElement || document.webkitFullscreenElement) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
          else { const p = (fsTarget.requestFullscreen || fsTarget.webkitRequestFullscreen).call(fsTarget); if (p && p.catch) p.catch(() => Kit.toast('全画面にできませんでした', { type: 'bad' })); }
        } catch (e) { Kit.toast('全画面にできませんでした', { type: 'bad' }); }
      }
      function closeShow() {
        if (!S.show) return;
        document.removeEventListener('keydown', S.show.onKey, true);
        S.show.ov.remove(); S.show = null;
        try { if (document.fullscreenElement || document.webkitFullscreenElement) (document.exitFullscreen || document.webkitExitFullscreen).call(document); } catch (e) { /* noop */ }
        if (alive) { render(); try { showBtn.focus({ preventScroll: true }); } catch (e) { /* noop */ } }
      }
      function setSound(on) {
        S.sound = !!on; setP('sound', S.sound);
        if (S.sound) Snd.unlock();
        updateShowTop();
        const cb = rootEl.querySelector('#ru-sound');
        if (cb) cb.checked = S.sound;
      }

      /* ── 画面の組み立て ── */
      const classSlot = h('div'), main = h('div');
      const showBtn = Kit.btn('発表モード', () => openShow(), { icon: 'desktop' });
      rootEl.append(Kit.appHead({ title: 'ルーレット', desc: '行事や発表の「だれから？」を決めます。教室では「発表モード」で大きく映せます。', actions: [showBtn] }), classSlot, main);

      async function render() {
        if (!alive) return;
        if (S.spinning) { S.dirty = true; return; }
        const seq = ++renderSeq;
        updateStage();   // 盤と「回す」は先に（下の欄を描き直すのを待たずに、すぐ形を決める）
        const bar = S.src === 'class' ? await School.classBar({}) : null;
        if (seq !== renderSeq || !alive) return;
        Kit.clear(classSlot); if (bar) classSlot.append(bar);
        Kit.clear(main);
        const stageCard = h('section', { class: 'card ru-stagecard', 'aria-label': 'ルーレット' },
          S.show ? h('div', { class: 'ru-away' }, Kit.icon('desktop'), h('p', null, '発表モードで表示しています。'), Kit.btn('発表モードを閉じる', () => closeShow(), { icon: 'close' })) : stageBox);
        if (S.show && !S.show.mainBox.contains(stageBox)) S.show.mainBox.prepend(stageBox);
        main.append(h('div', { class: 'ru-wrap' }, stageCard, h('div', { class: 'ru-side' }, settingsCard(), S.mode !== 'one' ? orderCard() : null, histCard())));
        updateStage();
      }
      // 盤はそのままで、右の欄（設定・順番・記録）だけ描き直す
      function renderPanels() {
        const side = main.querySelector('.ru-side');
        if (!side) return;
        Kit.add(Kit.clear(side), [settingsCard(), S.mode !== 'one' ? orderCard() : null, histCard()]);
        if (S.show) { updateShowTop(); renderShowSide(); }
      }

      function settingsCard() {
        const unit = unitOf(), r = round(), list = pool();
        const card = h('section', { class: 'card ru-set', 'aria-label': 'ルーレットの設定' });
        card.append(h('div', { class: 'stack tight' }, h('h3', null, '何から選ぶ'),
          Kit.seg(SRC, S.src, (v) => { saveList.flush(); S.src = v; setP('src', v); S.lastWin = null; render(); }, { label: '選ぶもの' })));
        card.append(S.src === 'class' ? classBlock() : S.src === 'range' ? rangeBlock() : itemsBlock());
        const hint = {
          one: 'ルーレットで1' + (S.src === 'items' ? 'つ' : '人') + 'を選びます。何度でも回せます（同じ' + (S.src === 'items' ? '項目' : '人') + 'がまた当たることもあります）。',
          order: '1' + (S.src === 'items' ? 'つ' : '人') + 'ずつ回して、当たった順に並べます（発表の順番など）。当たったら盤から外れます。',
          remove: '当たったら盤から外して、続けて回します（指名・くじ引きなど）。',
        }[S.mode];
        card.append(h('div', { class: 'stack tight' }, h('h3', null, '決め方'),
          Kit.seg(modeOpts(), S.mode, (v) => { S.mode = v; setP('mode', v); S.lastWin = null; render(); }, { label: '決め方' }),
          h('p', { class: 'small muted' }, hint),
          S.mode !== 'one' && r.picked.length && list.length ? h('p', { class: 'sk-note' }, '決めている途中です（' + r.picked.length + unit + '決定）。上の「何から選ぶ」を変えると、新しく始まります（元に戻すと続きから）。') : null));
        card.append(h('div', { class: 'stack tight ru-speed' }, h('h3', null, '速さと音'),
          Kit.seg(SPEED_OPTS, S.speed, (v) => { S.speed = v; setP('speed', v); }, { label: '速さ' }),
          h('label', { class: 'check', for: 'ru-sound' }, h('input', { type: 'checkbox', id: 'ru-sound', checked: S.sound, onchange: (e) => setSound(e.target.checked) }), '音を鳴らす（ドラムロールと、決まったときの音）'),
          reduced() ? h('p', { class: 'small muted' }, 'この端末は「動きを減らす」設定なので、短く静かに決めます。') : null));
        return card;
      }
      function classBlock() {
        const wrap = h('div', { class: 'stack tight' }, h('h3', null, '名簿のクラス'));
        if (!S.cls) {
          wrap.append(h('p', { class: 'small muted' }, '名簿にクラスを入れると、生徒から選べます（出席番号だけでも使えます）。「番号の範囲」なら名簿なしで使えます。'),
            h('div', { class: 'btn-row' }, Kit.btn('名簿を開く', () => Kit.go('roster'), { sm: true, icon: 'users' })));
          return wrap;
        }
        const hidden = School.hidden();
        const seg = Kit.seg([{ value: 'name', label: '名前つき' }, { value: 'no', label: '番号だけ' }], S.names && !hidden ? 'name' : 'no', (v) => { S.names = v === 'name'; setP('names', S.names); render(); }, { label: '出し方' });
        if (hidden) for (const b of seg.querySelectorAll('button')) b.disabled = true;
        Kit.add(wrap, [seg, hidden ? h('p', { class: 'small muted' }, '「名前を隠す」がオンなので、番号だけを出します。') : null]);
        const ex = exclSet();
        const det = h('details', { class: 'ru-excl', open: ex.size > 0 || S.exclOpen ? true : null },
          h('summary', null, 'お休みの人を外す' + (ex.size ? '（' + ex.size + '人）' : '')),
          h('div', { class: 'ru-excl-list' }, S.cls.students.map((st) => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(ex.has(st.id)), title: ex.has(st.id) ? '押すと盤に戻します' : '押すと盤から外します', onclick: () => { if (ex.has(st.id)) ex.delete(st.id); else ex.add(st.id); S.exclOpen = true; render(); } }, School.label(st)))),
          h('p', { class: 'small muted' }, '押した人はルーレットに出ません。もう一度押すと戻ります（ページを閉じると元に戻ります）。'));
        det.addEventListener('toggle', () => { S.exclOpen = det.open; });
        wrap.append(det);
        return wrap;
      }
      function rangeBlock() {
        const from = h('input', { type: 'number', id: 'ru-from', min: 0, max: 9999, step: 1, inputmode: 'numeric', value: String(S.range.from) });
        const to = h('input', { type: 'number', id: 'ru-to', min: 0, max: 9999, step: 1, inputmode: 'numeric', value: String(S.range.to) });
        const skip = h('input', { type: 'text', id: 'ru-skip', placeholder: '例：7, 12, 30-32', value: S.range.skip });
        const msg = h('p', { class: 'small', 'aria-live': 'polite' });
        const show = () => {
          const r = Core.rangeList(S.range.from, S.range.to), sk = Core.parseNums(S.range.skip).filter((k) => k >= r.from && k <= r.to);
          msg.textContent = r.error || r.nums.length + '人（' + r.from + '〜' + r.to + '番）' + (sk.length ? '・外す ' + sk.length + '人' : '');
          msg.style.color = r.error ? 'var(--bad)' : 'var(--ink-2)';
        };
        const upd = () => { S.range = { from: from.value, to: to.value, skip: skip.value }; setP('range', S.range); show(); if (!S.spinning) updateStage(); };
        for (const i of [from, to, skip]) i.addEventListener('input', upd);
        show();
        return h('div', { class: 'stack tight' }, h('h3', null, '番号の範囲'),
          h('div', { class: 'ru-range' }, Kit.field({ label: 'はじめ', input: from }), h('span', { class: 'ru-tilde', 'aria-hidden': 'true' }, '〜'), Kit.field({ label: 'おわり', input: to })),
          Kit.field({ label: '外す番号（なくてもよい）', input: skip, hint: 'お休みの人など。「,」で区切り、「30-32」のようにまとめても書けます。' }), msg);
      }
      function itemsBlock() {
        const L = curList();
        const ta = h('textarea', { id: 'ru-items', rows: 7, placeholder: '1行に1つずつ書きます。\n例：\n1班\n2班\n3班' });
        ta.value = L ? L.text || '' : '';
        const count = h('span', { class: 'small muted' });
        const setCount = () => { count.textContent = Core.parseItems(ta.value).length + 'こ'; };
        setCount();
        const redraw = Kit.debounce(() => { if (alive && !S.spinning) updateStage(); }, 200);
        ta.addEventListener('input', () => {
          let cur = curList();
          if (!cur) { cur = { id: Kit.uid('ru'), kind: 'list', title: 'わたしの項目', text: '' }; S.lists.push(cur); S.listId = cur.id; setP('list', cur.id); }
          cur.text = ta.value; setCount(); saveList(cur); redraw();
        });
        const sel = h('select', { id: 'ru-list', 'aria-label': '保存した項目' }, S.lists.map((l) => h('option', { value: l.id }, l.title || '（名前なし）')));
        if (L) sel.value = L.id;
        sel.addEventListener('change', () => { saveList.flush(); S.listId = sel.value; setP('list', sel.value); S.lastWin = null; render(); });
        return h('div', { class: 'stack tight' }, h('h3', null, '自由な項目'),
          h('div', { class: 'ru-lists' }, S.lists.length ? sel : h('span', { class: 'small muted grow' }, '下に書くと「わたしの項目」として保存されます'),
            Kit.btn('新しく', () => newList(), { sm: true, icon: 'plus' }),
            L ? Kit.btn('', () => renameList(L), { sm: true, kind: 'ghost', icon: 'edit', title: '名前を変える' }) : null,
            L ? Kit.btn('', () => delList(L), { sm: true, kind: 'ghost', icon: 'trash', title: 'この項目を消す' }) : null),
          Kit.field({ label: '項目（1行に1つ。書いたものは保存されます）', input: ta }),
          h('div', { class: 'ru-presets' }, count, h('span', { class: 'grow' }), h('span', { class: 'small muted' }, '例から作る：'),
            PRESETS.map((p) => h('button', { type: 'button', class: 'chip', onclick: () => newList(p) }, p.title))));
      }
      const saveList = Kit.debounce(async (l) => { const it = Object.assign({}, l); delete it.sample; S.selfWrite = Date.now(); await Kit.store.put('roulettes', it); }, 400);
      async function loadLists() { S.lists = (await Kit.store.list('roulettes')).filter((x) => x && x.kind === 'list'); }
      async function newList(preset) {
        let title = preset ? preset.title : await Kit.ask({ title: '新しい項目', label: '名前（あとで見分けるため）', value: '項目' + (S.lists.length + 1), ok: '作る' });
        if (title == null || !alive) return;
        title = String(title).trim() || '項目';
        saveList.flush();
        S.selfWrite = Date.now();
        const it = await Kit.store.put('roulettes', { id: Kit.uid('ru'), kind: 'list', title, text: preset ? preset.text : '' });
        await loadLists();
        S.listId = it.id; setP('list', it.id); S.lastWin = null;
        await render();
        if (!preset) { const ta = rootEl.querySelector('#ru-items'); if (ta) ta.focus(); }
      }
      async function renameList(l) {
        const t = await Kit.ask({ title: '名前を変える', label: '項目の名前', value: l.title || '', ok: '変える' });
        if (t == null || !alive) return;
        saveList.flush();
        l.title = String(t).trim() || l.title;
        const it = Object.assign({}, l); delete it.sample;
        S.selfWrite = Date.now();
        await Kit.store.put('roulettes', it);
        await loadLists(); render();
      }
      async function delList(l) {
        const ok = await Kit.confirm({ title: '「' + (l.title || '項目') + '」を消しますか？', body: '書いた項目が消えます。元には戻せません。', ok: '消す', danger: true });
        if (!ok || !alive) return;
        saveList.cancel();
        S.selfWrite = Date.now();
        await Kit.store.remove('roulettes', l.id);
        await loadLists();
        S.listId = S.lists[0] ? S.lists[0].id : null; setP('list', S.listId);
        render();
        Kit.toast('消しました');
      }

      function orderCard() {
        const r = round(), list = pool(), done = isDone();
        const title = S.mode === 'order' ? '決まった順番' : '当たった順';
        const card = h('section', { class: 'card ru-ordercard', 'aria-label': title },
          h('h2', { class: 'ru-h2' }, Kit.icon('checks'), title, h('span', { class: 'chip' + (done ? ' ok' : '') }, r.picked.length + ' / ' + (r.picked.length + list.length))));
        if (!r.picked.length) { card.append(h('p', { class: 'small muted' }, '「回す」を押すと、当たった順にここに並びます。')); return card; }
        card.append(orderList(), h('div', { class: 'btn-row' },
          Kit.btn('大きく見る', () => openList(), { sm: true, icon: 'eye', kind: done ? 'primary' : '' }),
          Kit.btn('印刷', () => printDlg(), { sm: true, icon: 'printer' }),
          Kit.btn('コピー', () => copyOrder(), { sm: true, icon: 'copy' })));
        requestAnimationFrame(() => { const ol = card.querySelector('.ru-ol'); if (ol) ol.scrollTop = ol.scrollHeight; });
        return card;
      }
      function histCard() {
        const H = M.hist;
        const card = h('section', { class: 'card ru-hist', 'aria-label': 'その場の記録' },
          h('h2', { class: 'ru-h2' }, Kit.icon('clock'), 'その場の記録', H.length ? h('span', { class: 'chip' }, H.length + '件') : null));
        if (!H.length) { card.append(h('p', { class: 'small muted' }, '決まった結果が、新しい順にここに残ります（このページを閉じると消えます）。')); return card; }
        card.append(h('ol', { class: 'ru-hlist' }, H.slice(0, 40).map((x) => h('li', null, h('span', { class: 'ru-ht num' }, hm(x.at)), h('b', { class: 'ru-hl' }, viewOf(x.e).label), h('span', { class: 'ru-hs' }, x.sub)))));
        if (H.length > 40) card.append(h('p', { class: 'small muted', style: { marginBottom: '8px' } }, 'ほかに ' + (H.length - 40) + '件（コピーにはすべて入ります）'));
        card.append(h('div', { class: 'btn-row' },
          Kit.btn('コピー', () => Kit.copy(School.tsv([['時刻', '結果', 'どこから・決め方']].concat(H.map((x) => [hm(x.at), viewOf(x.e).label, x.sub]))), '記録をコピーしました'), { sm: true, icon: 'copy' }),
          Kit.btn('記録を消す', async () => { if (await Kit.confirm({ title: 'その場の記録を消しますか？', body: 'ここに残っている ' + H.length + '件の記録を消します（決めている途中の順番はそのままです）。', ok: '消す', danger: true })) { H.length = 0; render(); } }, { sm: true, kind: 'ghost', icon: 'trash' })));
        return card;
      }

      /* ── 読み込みと、ほかの所からの知らせ ── */
      async function load() {
        S.cls = await School.classes.current();
        await loadLists();
        warmFonts();
      }
      // 決まった札で使う字を先に読みこんでおく（はじめて出たときに、字が入れかわって札の大きさが変わらないように）
      function warmFonts() {
        try {
          if (!document.fonts || !document.fonts.load) return;
          const txt = '0123456789番決定！最後は…目人つのこり全員の順番が決まりましたもう一度回す次を閉じる' + (S.cls ? S.cls.students.map((st) => st.name || '').join('') : '') + (curList() ? curList().text || '' : '').slice(0, 2000);
          document.fonts.load('600 64px "Klee One"', txt).catch(() => {});
          document.fonts.load('700 40px "Zen Kaku Gothic New"', txt).catch(() => {});
        } catch (e) { /* 字が読みこめなくても動く */ }
      }
      await load();
      await render();
      const reload = Kit.debounce(async () => { if (!alive) return; if (S.spinning) { S.dirty = true; return; } await load(); render(); }, 150);
      const offs = [
        Kit.store.on('coll:classes', reload),
        Kit.store.on('coll:roulettes', () => { if (Date.now() - S.selfWrite < 1500) return; reload(); }),
        School.onClassChange(reload),
      ];
      // 回している間に変わったものは、止まってから描き直す
      const dirtyTimer = setInterval(() => { if (S.dirty && !S.spinning && alive) { S.dirty = false; reload(); } }, 400);
      return () => {
        alive = false;
        offs.forEach((f) => f()); reload.cancel(); saveList.flush(); clearInterval(dirtyTimer);
        Snd.rollStop();
        closeReveal(true); closeList(); if (S.show) { document.removeEventListener('keydown', S.show.onKey, true); S.show.ov.remove(); S.show = null; }
        try { if (document.fullscreenElement || document.webkitFullscreenElement) (document.exitFullscreen || document.webkitExitFullscreen).call(document); } catch (e) { /* noop */ }
      };
    },
  });
})(typeof window !== 'undefined' ? window : globalThis);

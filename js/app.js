/*
 * 画像生成プロンプト処方箋 ― 参加者の画面
 *
 * 画面の考え方：まず「ざっくり書く」大きな欄。書いた文章から、当てはまるタグを自動で見つけて指示文に反映する。
 * ボタンで選びたい人のために、よく使う12個だけを先に出し、そのほか（タグ 275 個）は閉じた項目の中に置く。
 * 画面は最初に1回だけ組み立て、あとは「押されている／いない」などの状態だけを書きかえる
 * （押している最中のボタンを作り直すと、Safari でクリックが届かなくなるため）。
 */
(function () {
  'use strict';
  var T = window.GP_TAGS, E = window.GP_ENGINE, I = window.GP_INFER, API = window.GP_API;
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

  // ------------------------------------------------------------ 画面の組み立て方
  // よく使う12個だけを、最初から出す（ほかは閉じた項目の中）
  var MODES = {
    new: {
      q: '作りたい絵や、困っていることを書いてください',
      sub: 'ひとこと・箇条書きでかまいません。書いた内容から、当てはまるタグも自動で見つけます。',
      ph: '例：学級通信にのせる運動会のイラスト。子どもの手が毎回おかしくなって困っている',
      examples: ['pr-newsletter', 'pr-slide', 'pr-thumbnail', 'pr-character'],
      quick: [
        { title: '作りたいもの', cat: 'use', open: 'use', ids: ['u-newsletter', 'u-slides', 'u-poster', 'u-worksheet', 'u-youtube', 'u-class-character'] },
        { title: '困っていること', cat: 'trouble', open: 'trouble', ids: ['t-text-broken', 't-hands', 't-chara-consistency', 't-not-as-imagined', 't-partial-edit', 't-what-to-write'] }
      ],
      acc: [
        { id: 'use', title: '作りたいもの（使い道）', parts: [{ cat: 'use' }] },
        { id: 'trouble', title: '困っていること', parts: [{ cat: 'trouble' }, { text: 'trouble', label: 'ほかに困っていること（自由に）', ph: '例：子どもを描くと、毎回大人っぽくなってしまう' }] },
        { id: 'look', title: '絵のタッチ・雰囲気・色', parts: [{ cat: 'style', head: true }, { cat: 'mood', head: true }, { cat: 'color', head: true }] },
        { id: 'scene', title: '場面・テーマ（行事・季節・教科）', parts: [{ cat: 'scene' }] },
        { id: 'layout', title: '形・構図・背景', parts: [{ cat: 'ratio', head: true }, { cat: 'frame', head: true }, { cat: 'bg', head: true }] },
        { id: 'people', title: '登場人物・人数', parts: [{ cat: 'people' }, { cat: 'count', head: true }] },
        { id: 'extra', title: '画像に入れる文字・添えるもの', parts: [{ text: 'title', label: '画像に入れる文字（なければ空欄）', ph: '例：うんどうかい', max: 80, line: true }, { cat: 'option', head: true }] }
      ]
    },
    edit: {
      q: 'どう直したいですか？',
      sub: '例：手を自然に／背景を夕方に。変えたくないところも書けます。書いた内容から、タグも自動で見つけます。',
      ph: '例：右の男の子の手を自然にしたい。ほかは変えないでほしい',
      examples: ['pr-fix-hands'],
      quick: [
        { title: 'どこを直す？', cat: 'change', open: 'change', ids: ['e-hands', 'e-face', 'e-text-fix', 'e-text-remove', 'e-background', 'e-color'] },
        { title: 'そのままにしたい所', cat: 'keep', open: 'keep', ids: ['k-face', 'k-composition', 'k-style', 'k-colors'] }
      ],
      acc: [
        { id: 'change', title: '直したいところ', parts: [{ cat: 'change' }] },
        { id: 'keep', title: 'そのままにしたいところ', parts: [{ cat: 'keep' }] },
        { id: 'trouble', title: '困っていること', parts: [{ cat: 'trouble' }, { text: 'trouble', label: 'ほかに困っていること（自由に）', ph: '例：直してと頼むと、顔まで変わってしまう' }] },
        { id: 'extra', title: '形・入れる文字', parts: [{ text: 'title', label: '正しい文字・入れたい文字（なければ空欄）', ph: '例：うんどうかい', max: 80, line: true }, { cat: 'ratio', head: true }] }
      ]
    }
  };
  var TOOL_CHOICES = [['', 'どのAIでも（おまかせ）'], ['ai-chatgpt', 'ChatGPT'], ['ai-gemini', 'Gemini'], ['ai-copilot', 'Microsoft Copilot'], ['ai-canva', 'Canva'], ['ai-firefly', 'Adobe Firefly'], ['ai-midjourney', 'Midjourney（英語）']];
  var OPEN_URL = {
    'ai-chatgpt': 'https://chatgpt.com/', 'ai-gemini': 'https://gemini.google.com/app', 'ai-copilot': 'https://copilot.microsoft.com/',
    'ai-canva': 'https://www.canva.com/', 'ai-firefly': 'https://firefly.adobe.com/', 'ai-midjourney': 'https://www.midjourney.com/imagine'
  };

  // ------------------------------------------------------------ 状態
  // 選んだタグは「新しく作る」と「できた画像を直す」で別々に持つ（片方で選んだものが、もう片方に隠れて残らないように）。
  // 使うAIだけは共通（S.tool）。
  var S = {
    mode: 'new',
    sels: { new: new Set(), edit: new Set() },   // 自分で押したタグ
    offs: { new: new Set(), edit: new Set() },   // 文章から見つかったが、いらないと消したタグ
    tool: '',                                    // 自分で選んだ使うAI（空＝おまかせ）
    found: [],             // 文章から見つかったタグ（消したものも含む）
    eff: new Set(),        // 実際に使うタグ（押したもの＋文章から見つけて消していないもの）
    autoUsed: [],          // 文章から見つけて使っているタグ（画面に出す）
    text: { mainnew: '', mainedit: '', trouble: '', title: '' },
    last: null
  };
  var STATE_KEY = 'gp.state3';
  function sel() { return S.sels[S.mode]; }
  function off() { return S.offs[S.mode]; }

  function saveState() {
    var arr = function (set) { return Array.from(set); };
    API.store(STATE_KEY, JSON.stringify({ mode: S.mode, tool: S.tool, sels: { new: arr(S.sels.new), edit: arr(S.sels.edit) }, offs: { new: arr(S.offs.new), edit: arr(S.offs.edit) }, text: S.text }));
  }
  function loadState() {
    var raw = API.store(STATE_KEY);
    if (!raw) return;
    try {
      var o = JSON.parse(raw);
      if (o.mode === 'edit' || o.mode === 'new') S.mode = o.mode;
      if (o.tool && T.byId(o.tool) && T.byId(o.tool).cat === 'tool') S.tool = o.tool;
      ['new', 'edit'].forEach(function (m) {
        ((o.sels || {})[m] || []).forEach(function (id) { if (T.byId(id)) S.sels[m].add(id); });
        ((o.offs || {})[m] || []).forEach(function (id) { if (T.byId(id)) S.offs[m].add(id); });
      });
      if (o.text) Object.keys(S.text).forEach(function (k) { if (typeof o.text[k] === 'string') S.text[k] = o.text[k].slice(0, 400); });
    } catch (e) { /* 壊れていたら使わない */ }
  }

  function mainText() { return S.text['main' + S.mode]; }
  function inMode(id) { var t = T.byId(id); return !!(t && T.CAT[t.cat].modes.indexOf(S.mode) >= 0); }

  // 文章を読みなおして、「実際に使うタグ」を決める。文字・タグ・モードが変わるたびに呼ぶ
  function recompute() {
    S.found = I.infer(mainText(), S.mode);
    var eff = new Set(), explicit = {};
    sel().forEach(function (id) {
      if (!inMode(id)) return;
      eff.add(id);
      var t = T.byId(id);
      if (!T.CAT[t.cat].multi) explicit[t.cat] = 1;
    });
    if (S.tool) { eff.add(S.tool); explicit.tool = 1; }
    var used = [];
    S.found.forEach(function (id) {
      if (off().has(id) || !inMode(id)) return;
      var t = T.byId(id);
      if (!T.CAT[t.cat].multi && explicit[t.cat]) return;          // 1つだけ選べる種類は、自分で選んだものを優先
      if (!eff.has(id)) used.push(id);
      eff.add(id);
    });
    S.eff = eff;
    S.autoUsed = used;
  }

  function toolOf(set) { var r = ''; set.forEach(function (id) { var t = T.byId(id); if (t && t.cat === 'tool') r = id; }); return r; }

  function currentInput() {
    var sp = I.split(mainText(), S.mode);
    var extra = S.text.trouble.trim();
    var trouble = [sp.trouble, extra].filter(Boolean).join(sp.trouble && extra ? ' ／ ' : '').slice(0, 400);
    return { mode: S.mode, tags: Array.from(S.eff), wish: sp.wish, trouble: trouble, title: S.text.title, tool: toolOf(S.eff) };
  }
  function sig(input) {
    var picked = E.build(input).picked.map(function (p) { return p.id; }).sort();
    return JSON.stringify([input.mode, picked, input.wish.trim(), input.trouble.trim(), input.title.trim()]);
  }

  // ------------------------------------------------------------ 組み立て
  function chip(t) {
    return h('button', { type: 'button', class: 'chip c-' + (T.CAT[t.cat].color || 'gray'), 'data-id': t.id, 'aria-pressed': 'false', title: t.label },
      h('span', { class: 'chip-ck', 'aria-hidden': 'true' }), h('span', { class: 'chip-tx', text: t.label }));
  }

  function catBlock(cat, opts) {
    opts = opts || {};
    var c = T.CAT[cat];
    var main = c.groups.filter(function (g) { return !g.more; });
    var more = c.groups.filter(function (g) { return g.more; });
    function grp(g) {
      return h('div', { class: 'grp', 'data-grp': g.id },
        g.label && c.groups.length > 1 ? h('p', { class: 'grp-label', text: g.label }) : null,
        h('div', { class: 'chips' }, g.tags.map(chip)));
    }
    var kids = [];
    if (opts.head) kids.push(h('div', { class: 'cat-h' }, h('h3', { class: 'cat-title', text: c.label }), h('span', { class: 'cat-hint', text: c.hint })));
    kids.push(main.map(grp));
    if (more.length) {
      var n = more.reduce(function (a, g) { return a + g.tags.length; }, 0);
      kids.push(h('details', { class: 'fold fold-more' }, h('summary', null, h('span', { text: 'ほかの' + c.label + '（' + n + '）' })), h('div', { class: 'fold-body' }, more.map(grp))));
    }
    return h('div', { class: 'cat', 'data-cat': cat }, kids);
  }

  function textField(mode, part) {
    var key = part.text;
    var id = 'f-' + mode + '-' + part.text;
    var max = part.max || 400;
    var input = part.line
      ? h('input', { id: id, type: 'text', maxlength: String(max), autocomplete: 'off', 'data-text': key, placeholder: part.ph || '' })
      : h('textarea', { id: id, rows: '2', maxlength: String(max), 'data-text': key, placeholder: part.ph || '' });
    return h('div', { class: 'field' }, h('label', { for: id, class: 'field-label', text: part.label }), input,
      h('div', { class: 'field-foot' }, h('span', { class: 'field-count', 'data-count': id, text: '0/' + max })));
  }

  function accOf(mode, a) {
    var total = 0, cats = [];
    a.parts.forEach(function (p) { if (p.cat) { cats.push(p.cat); total += T.CAT[p.cat].groups.reduce(function (n, g) { return n + g.tags.length; }, 0); } });
    var body = h('div', { class: 'acc-body' }, a.parts.map(function (p) { return p.cat ? catBlock(p.cat, { head: !!p.head }) : textField(mode, p); }));
    return h('details', { class: 'acc', 'data-acc': a.id, 'data-cats': cats.join(' '), 'data-texts': a.parts.filter(function (p) { return p.text; }).map(function (p) { return p.text; }).join(' ') },
      h('summary', null, h('div', { class: 'acc-h' }, h('span', { class: 'acc-t', text: a.title }), h('span', { class: 'acc-n', text: total + '個' }), h('span', { class: 'acc-sel', 'data-acc-sel': a.id }))),
      body);
  }

  function buildPane(mode) {
    var M = MODES[mode];
    var tid = 'f-' + mode + '-main';
    var pane = h('div', { class: 'pane', 'data-mode': mode, hidden: mode !== S.mode });

    // ---- 大きな入力欄
    var examples = M.examples.map(function (pid) {
      var p = T.PRESETS.filter(function (x) { return x.id === pid; })[0];
      return p ? h('button', { type: 'button', class: 'example', 'data-preset': p.id }, h('span', { text: p.label })) : null;
    });
    var select = h('select', { class: 'tool-select', 'aria-label': '使うAI', 'data-tool-select': mode }, TOOL_CHOICES.map(function (c) { return h('option', { value: c[0], text: c[1] }); }));
    var quick = h('div', { class: 'quick' }, M.quick.map(function (q) {
      return h('div', { class: 'quick-block' },
        h('div', { class: 'quick-h' }, h('h2', { class: 'quick-title', text: q.title }), h('button', { type: 'button', class: 'more-link', 'data-open-acc': q.open, text: 'ほかも見る' })),
        h('div', { class: 'chips' }, q.ids.map(function (id) { return chip(T.byId(id)); })));
    }));
    // 大きな入力欄 → 例 → よく使うボタン（12個）→ 見つけたタグ → 使うAIと「処方箋を出す」。ここまでが1枚のカード
    var hero = h('div', { class: 'hero', id: 'hero-' + mode },
      h('label', { class: 'hero-q', for: tid, text: M.q }),
      h('p', { class: 'hero-sub', id: tid + '-sub', text: M.sub }),
      h('textarea', { id: tid, class: 'hero-input', rows: '3', maxlength: '400', 'data-text': 'main' + mode, placeholder: M.ph, 'aria-describedby': tid + '-sub' }),
      h('div', { class: 'hero-foot' },
        h('span', { class: 'nudge', role: 'alert', 'data-nudge': mode, hidden: true, text: 'まず、ひとこと書くか、下の例やボタンを押してください。' }),
        h('span', { class: 'field-count', 'data-count': tid, text: '0/400' })),
      h('div', { class: 'examples' }, h('span', { class: 'examples-lab', text: '例（押すと、すぐ処方箋が出ます）' }), examples),
      quick,
      h('div', { class: 'auto', 'data-auto': mode, hidden: true }, h('span', { class: 'auto-lab', text: '文章から見つけた項目（押すと外せます）' }), h('div', { class: 'auto-chips' })),
      h('div', { class: 'hint-box', 'data-hints': mode }),
      h('div', { class: 'hero-go' },
        h('label', { class: 'tool-pick' }, h('span', { class: 'tool-lab', text: '使うAI' }), select),
        h('button', { type: 'button', class: 'btn-go btn-hero', 'data-go': mode, text: '処方箋を出す' })));
    pane.appendChild(hero);

    // ---- 細かく決める（閉じた項目）
    pane.appendChild(h('div', { class: 'more' },
      h('h2', { class: 'more-h', text: 'もっと細かく決めたいとき' }),
      h('p', { class: 'more-sub', text: '閉じている項目を開くと、ボタンがもっと出てきます。' }),
      h('div', { class: 'finder' },
        h('label', { class: 'finder-label', for: 'finder-' + mode, text: 'ボタンをさがす' }),
        h('div', { class: 'finder-row' },
          h('input', { id: 'finder-' + mode, class: 'finder-input', type: 'search', autocomplete: 'off', enterkeyhint: 'search', placeholder: '例：文字、手、運動会、ロゴ', 'data-finder': mode }),
          h('span', { class: 'finder-count', 'data-finder-count': mode, 'aria-live': 'polite' }))),
      h('div', { class: 'accs' }, M.acc.map(function (a) { return accOf(mode, a); }))));
    return pane;
  }

  function buildPanes() {
    var root = $('#panes');
    ['new', 'edit'].forEach(function (m) { root.appendChild(buildPane(m)); });
  }

  // ------------------------------------------------------------ 表示を状態に合わせる
  function pane() { return $('.pane[data-mode="' + S.mode + '"]'); }

  function syncMode() {
    $$('.mode').forEach(function (b) { b.setAttribute('aria-selected', b.getAttribute('data-mode') === S.mode ? 'true' : 'false'); });
    $$('.pane').forEach(function (p) { p.hidden = p.getAttribute('data-mode') !== S.mode; });
    document.body.setAttribute('data-mode', S.mode);
  }

  function syncChips() {
    $$('.chip').forEach(function (b) {
      var id = b.getAttribute('data-id');
      var on = S.eff.has(id);
      if ((b.getAttribute('aria-pressed') === 'true') !== on) b.setAttribute('aria-pressed', on ? 'true' : 'false');
      var auto = on && !sel().has(id);
      if (b.classList.contains('is-auto') !== auto) b.classList.toggle('is-auto', auto);
    });
    // 閉じた項目の見出しに、選んでいる数を出す
    $$('.acc').forEach(function (a) {
      var cats = (a.getAttribute('data-cats') || '').split(' ').filter(Boolean);
      var texts = (a.getAttribute('data-texts') || '').split(' ').filter(Boolean);
      var n = 0;
      S.eff.forEach(function (id) { var t = T.byId(id); if (t && cats.indexOf(t.cat) >= 0) n++; });
      texts.forEach(function (k) { if (S.text[k].trim()) n++; });
      var el = $('[data-acc-sel]', a);
      var txt = n ? n + '個 選択中' : '';
      if (el.textContent !== txt) el.textContent = txt;
    });
  }

  // 文章から見つけたタグ（消せる）
  function syncAuto() {
    $$('.auto').forEach(function (box) {
      var mode = box.getAttribute('data-auto');
      var ids = mode === S.mode ? S.autoUsed : [];
      var key = ids.join(',');
      if (box.getAttribute('data-key') === key) return;       // 変わったときだけ作り直す
      box.setAttribute('data-key', key);
      box.hidden = !ids.length;
      var wrap = $('.auto-chips', box);
      wrap.textContent = '';
      ids.forEach(function (id) {
        var t = T.byId(id);
        wrap.appendChild(h('button', { type: 'button', class: 'auto-chip c-' + (T.CAT[t.cat].color || 'gray'), 'data-dismiss': id, 'aria-label': '「' + t.label + '」をはずす' },
          h('span', { class: 'auto-tx', text: t.label }), h('span', { class: 'auto-x', 'aria-hidden': 'true', text: '×' })));
      });
    });
  }

  function syncTool() {
    var v = toolOf(S.eff);
    $$('.tool-select').forEach(function (s) { if (s.value !== v) s.value = v; });
  }

  function syncHints() {
    ['new', 'edit'].forEach(function (mode) {
      var box = $('[data-hints="' + mode + '"]');
      if (!box) return;
      var hints = [];
      if (mode === 'new' && mode === S.mode) {
        if (S.eff.has('t-partial-edit') || I.looksLikeEdit(mainText())) hints.push({ text: 'できた画像の一部を直したいときは、「できた画像を直す」に切りかえると、変えないところまで書いた指示文になります。', btn: '切りかえる', act: 'to-edit' });
      }
      if (mode === S.mode && (S.eff.has('t-want-text') || S.eff.has('t-text-broken')) && !S.text.title.trim()) {
        hints.push({ text: '画像に入れたい文字があるときは、「画像に入れる文字」に書いてください。ないときは、文字なしの指示になります。', btn: '文字を書く', act: 'to-title' });
      }
      var key = JSON.stringify(hints.map(function (x) { return x.act; }));
      if (box.getAttribute('data-key') === key) return;
      box.setAttribute('data-key', key);
      box.textContent = '';
      hints.forEach(function (x) {
        box.appendChild(h('div', { class: 'hint' }, h('p', { text: x.text }), h('button', { type: 'button', class: 'btn-small', 'data-act': x.act, text: x.btn })));
      });
    });
  }

  function countSelected() {
    var n = S.eff.size;
    if (mainText().trim()) n++;
    if (S.text.trouble.trim()) n++;
    if (S.text.title.trim()) n++;
    return n;
  }
  function syncDock() {
    var n = countSelected();
    var t = n ? '入力 ' + n + ' 項目' : 'まだ何も入れていません';
    var el = $('#dock-count');
    if (el.textContent !== t) el.textContent = t;
    document.body.classList.toggle('has-input', n > 0);   // 何も入れていないあいだは、下の帯を出さない（ボタンは大きな1つだけ）
  }

  function syncStale() {
    var body = $('#rx-body');
    var stale = !!(S.last && !body.hidden && sig(currentInput()) !== S.last.sig);
    if (S.last && !body.hidden) {
      body.classList.toggle('stale', stale);
      var bar = $('#stale-bar');
      if (bar) bar.hidden = !stale;
    }
    var label = stale ? '処方箋を出し直す' : '処方箋を出す';
    $$('[data-go], #go-dock').forEach(function (b) { if (b.textContent !== label && !b.matches(':active')) b.textContent = label; });
  }

  function syncTextFields() {
    $$('[data-text]').forEach(function (el) {
      var key = el.getAttribute('data-text');
      if (el.value !== S.text[key]) el.value = S.text[key];
      var c = $('[data-count="' + el.id + '"]');
      if (c) c.textContent = el.value.length + '/' + el.getAttribute('maxlength');
    });
  }

  function syncAll() {
    recompute();
    syncChips(); syncAuto(); syncTool(); syncHints(); syncDock(); syncStale();
    var n = $('[data-nudge="' + S.mode + '"]');
    if (n && !n.hidden && (mainText().trim() || S.eff.size)) n.hidden = true;
  }

  // ------------------------------------------------------------ 操作
  // タグを押す／はずす。文章から見つけたタグをはずすと「いらない」と覚える
  function toggle(id) {
    var t = T.byId(id);
    if (!t) return;
    var cat = T.CAT[t.cat];
    if (S.eff.has(id)) {
      sel().delete(id);
      if (S.found.indexOf(id) >= 0) off().add(id);
    } else {
      off().delete(id);
      if (!cat.multi) {
        sel().forEach(function (x) { var o = T.byId(x); if (o && o.cat === t.cat) sel().delete(x); });
        S.found.forEach(function (x) { var o = T.byId(x); if (o && o.cat === t.cat && x !== id) off().add(x); });
      }
      sel().add(id);
    }
    saveState();
    syncAll();
  }
  function dismiss(id) {
    sel().delete(id);
    off().add(id);
    saveState();
    syncAll();
  }
  function setTool(id) {
    S.tool = id || '';
    // どちらの側でも、文章から見つけた別のAIは使わない。選んだものを優先する
    ['new', 'edit'].forEach(function (m) {
      I.infer(S.text['main' + m], m).forEach(function (x) { var o = T.byId(x); if (o && o.cat === 'tool' && x !== id) S.offs[m].add(x); });
      if (id) S.offs[m].delete(id);
    });
    saveState();
    syncAll();
  }

  function setMode(mode, carry) {
    if (mode !== 'new' && mode !== 'edit') return;
    if (carry && mode === 'edit' && !S.text.mainedit.trim()) S.text.mainedit = S.text.mainnew;   // 書いた文を、直す側にも持っていく
    S.mode = mode;
    saveState();
    syncMode(); syncTextFields(); syncAll();
  }

  function applyPreset(id) {
    var p = T.PRESETS.filter(function (x) { return x.id === id; })[0];
    if (!p) return;
    var keepTool = toolOf(S.eff);
    if (keepTool) S.tool = keepTool;                       // 文章から見つけたAIも、そのまま使う
    S.sels[p.mode] = new Set(p.tags.filter(function (x) { return T.byId(x) && T.byId(x).cat !== 'tool'; }));
    S.offs[p.mode] = new Set();
    S.mode = p.mode;
    S.text['main' + p.mode] = p.wish || '';
    S.text.title = p.title || '';
    S.text.trouble = '';
    saveState();
    syncMode(); syncTextFields(); syncAll();
    generate(id);
  }

  function resetAll() {
    S.sels = { new: new Set(), edit: new Set() }; S.offs = { new: new Set(), edit: new Set() }; S.tool = '';
    S.text = { mainnew: '', mainedit: '', trouble: '', title: '' };
    saveState();
    syncTextFields(); syncAll();
    var t = $('#f-' + S.mode + '-main');
    if (t) t.focus();
    toast('最初からやり直せます');
  }

  function openAcc(id) {
    var a = $('.pane[data-mode="' + S.mode + '"] .acc[data-acc="' + id + '"]');
    if (!a) return null;
    a.open = true;
    a.scrollIntoView({ block: 'start' });          // すぐ動く（ゆっくり動かさない。動きは控えめに）
    return a;
  }

  // ------------------------------------------------------------ 処方箋
  function nothingYet(input) {
    return !mainText().trim() && !input.trouble && !input.title.trim() && !input.tags.some(function (id) { return T.byId(id).cat !== 'tool'; });
  }

  function generate(presetId) {
    recompute();
    var input = currentInput();
    if (!presetId && nothingYet(input)) {
      var n = $('[data-nudge="' + S.mode + '"]');
      if (n) n.hidden = false;
      var t = $('#f-' + S.mode + '-main');
      if (t) { t.scrollIntoView({ block: 'center' }); t.focus(); }
      return;
    }
    var out = E.build(input, { now: new Date() });
    var gen = API.uuid();
    S.last = { id: gen, input: input, out: out, sig: sig(input), copied: {}, rated: 0 };
    renderResult(out);
    API.log({
      kind: 'generate', gen_id: gen, mode: out.mode, tool: out.tool, preset: presetId || null,
      tags: out.picked.map(function (p) { return p.id; }).concat(input.tool && out.picked.every(function (p) { return p.id !== input.tool; }) ? [input.tool] : []),
      wish: input.wish.trim() || null, trouble: input.trouble.trim() || null, title_text: input.title.trim() || null
    });
    syncStale();
    showResult();
  }

  function showResult() {
    var r = $('#result');
    var narrow = window.matchMedia('(max-width: 959px)').matches;
    if (narrow) r.scrollIntoView({ block: 'start' });
    try { r.focus({ preventScroll: true }); } catch (e) { r.focus(); }
  }

  function withMarks(text) {
    var frag = document.createDocumentFragment();
    String(text).split(/(〔[^〕]*〕)/).forEach(function (part, i) {
      if (!part) return;
      if (i % 2 === 1) frag.appendChild(h('mark', { class: 'ph', text: part }));
      else frag.appendChild(document.createTextNode(part));
    });
    return frag;
  }

  function renderResult(out) {
    $('#rx-empty').hidden = true;
    var body = $('#rx-body');
    body.hidden = false;
    body.classList.remove('stale');
    body.textContent = '';
    var now = new Date();
    var dateText = now.getFullYear() + '.' + (now.getMonth() + 1) + '.' + now.getDate();

    body.appendChild(h('div', { class: 'rx-head' },
      h('div', null, h('p', { class: 'rx-kicker', text: out.mode === 'edit' ? 'できた画像を直す' : '新しく作る' }), h('h2', { class: 'rx-title', text: '処方箋' })),
      h('p', { class: 'rx-meta' }, h('span', { text: out.toolLabel === 'そのほか' ? 'どのAIでも' : out.toolLabel + ' 向け' }), h('span', { class: 'rx-date', text: dateText }))));

    body.appendChild(h('div', { class: 'stale-bar', id: 'stale-bar', hidden: true },
      h('p', { text: '書き直しました。下の指示文は、前の内容のものです。' }),
      h('button', { type: 'button', class: 'btn-small', 'data-act': 'regen', text: '出し直す' })));

    if (out.picked.length) {
      body.appendChild(h('ul', { class: 'rx-picked', 'aria-label': '指示文に使った項目' }, out.picked.map(function (p) {
        return h('li', { class: 'pk c-' + (T.CAT[p.cat].color || 'gray'), text: p.label });
      })));
    }

    if (out.notes.length) body.appendChild(h('ul', { class: 'rx-notes' }, out.notes.map(function (n) { return h('li', { text: n }); })));

    // 指示文（いくつかの版）
    var VNOTE = { full: 'ていねいに全部伝える版です。まずはこれを貼ってください。', short: '短くまとめた版です。入力欄が小さいAIや、手早く試したいとき向け。' };
    var tabs = h('div', { class: 'vtabs', role: 'tablist', 'aria-label': '指示文の種類' });
    var panels = h('div', { class: 'vpanels' });
    out.versions.forEach(function (v) {
      var sel = v.id === out.recommended;
      var tabId = 'vt-' + v.id, panelId = 'vp-' + v.id;
      tabs.appendChild(h('button', { type: 'button', role: 'tab', class: 'vtab', id: tabId, 'aria-controls': panelId, 'aria-selected': sel ? 'true' : 'false', 'data-v': v.id },
        h('span', { text: v.label }), sel ? h('span', { class: 'rec', text: 'おすすめ' }) : null));
      panels.appendChild(h('div', { class: 'vpanel', role: 'tabpanel', id: panelId, 'aria-labelledby': tabId, hidden: !sel },
        (v.note || VNOTE[v.id]) ? h('p', { class: 'vnote', text: v.note || VNOTE[v.id] }) : null,
        h('div', { class: 'copy-row' },
          h('button', { type: 'button', class: 'btn-copy', 'data-copy': 'v-' + v.id }, h('span', { class: 'ic-copy', 'aria-hidden': 'true' }), h('span', { text: 'この指示文をコピー' })),
          OPEN_URL[out.tool] ? h('a', { class: 'btn-open', href: OPEN_URL[out.tool], target: '_blank', rel: 'noopener noreferrer', text: out.toolLabel + ' を開く ↗' }) : null),
        h('div', { class: 'prompt', tabindex: '0', 'aria-label': v.label + 'の指示文' }, withMarks(v.text))));
    });
    body.appendChild(h('section', { class: 'rx-sec rx-main' }, h('h3', { class: 'rx-h', text: 'AIに貼る指示文' }), tabs, panels));

    if (out.fixes.length) {
      body.appendChild(h('section', { class: 'rx-sec' },
        h('h3', { class: 'rx-h', text: 'うまくいかなかったら（続けて送る一言）' }),
        h('ol', { class: 'fixes' }, out.fixes.map(function (f, i) {
          return h('li', { class: 'fix' },
            h('div', { class: 'fix-h' }, h('span', { class: 'fix-label', text: f.label }), f.from ? h('span', { class: 'fix-from', text: f.from }) : null),
            h('p', { class: 'fix-tx' }, withMarks(f.text)),
            h('button', { type: 'button', class: 'btn-small btn-copy-s', 'data-copy': 'fix-' + i, text: 'コピー' }));
        }))));
    }

    if (out.tips.length) {
      body.appendChild(h('section', { class: 'rx-sec' },
        h('h3', { class: 'rx-h', text: 'コツ' }),
        h('ul', { class: 'tips' }, out.tips.map(function (t) {
          return h('li', null, h('span', { text: t.text }), t.from ? h('span', { class: 'tip-from', text: t.from }) : null);
        }))));
    }

    body.appendChild(h('section', { class: 'rx-sec fb', id: 'fb' },
      h('h3', { class: 'rx-h', text: 'ためしてみて、どうでしたか？' }),
      h('div', { class: 'fb-btns' },
        h('button', { type: 'button', class: 'fb-btn', 'data-rate': '1', 'aria-pressed': 'false', text: 'うまくいった' }),
        h('button', { type: 'button', class: 'fb-btn', 'data-rate': '-1', 'aria-pressed': 'false', text: 'いまいち' })),
      h('div', { class: 'fb-more', id: 'fb-more', hidden: true },
        h('label', { for: 'fb-text', class: 'field-label', text: 'どこがうまくいかなかったですか？（任意・講座で取り上げます）' }),
        h('textarea', { id: 'fb-text', rows: '2', maxlength: '400', placeholder: '例：文字がやっぱり崩れた／キャラの顔が変わった' }),
        h('button', { type: 'button', class: 'btn-small', 'data-act': 'fb-send', text: '送る' })),
      h('p', { class: 'fb-done', id: 'fb-done', hidden: true, text: 'ありがとうございます。講座づくりに使わせてください。' })));
  }

  function versionText(id) {
    if (!S.last) return '';
    if (id.indexOf('v-') === 0) {
      var v = S.last.out.versions.filter(function (x) { return 'v-' + x.id === id; })[0];
      return v ? v.text : '';
    }
    if (id.indexOf('fix-') === 0) {
      var f = S.last.out.fixes[Number(id.slice(4))];
      return f ? f.text : '';
    }
    return '';
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return legacyCopy(text); });
    }
    return Promise.resolve(legacyCopy(text));
  }
  function legacyCopy(text) {
    var ta = h('textarea', { class: 'copy-buf', readonly: true, 'aria-hidden': 'true' });
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }

  var toastTimer = null;
  function toast(msg) {
    var el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2200);
  }

  function onCopy(part) {
    var text = versionText(part);
    if (!text) return;
    copyText(text).then(function (ok) {
      if (ok) {
        toast(/〔/.test(text) ? 'コピーしました。〔 〕のところを書きかえてから貼りましょう' : 'コピーしました。AIの入力欄に貼りつけてください');
        if (S.last && !S.last.copied[part]) {
          S.last.copied[part] = 1;
          API.log({ kind: 'copy', gen_id: S.last.id, part: part });
        }
      } else {
        // コピーできない環境：文字を選んだ状態にして、手でコピーしてもらう
        var box = part.indexOf('v-') === 0 ? $('#vp-' + part.slice(2) + ' .prompt') : null;
        if (box) { var r = document.createRange(); r.selectNodeContents(box); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); }
        toast('自動でコピーできませんでした。選んだ文字を長押し（右クリック）でコピーしてください');
      }
    });
  }

  function onRate(rate) {
    if (!S.last) return;
    S.last.rated = rate;
    $$('.fb-btn').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-rate') === String(rate) ? 'true' : 'false'); });
    API.log({ kind: 'feedback', gen_id: S.last.id, rating: rate });
    $('#fb-more').hidden = rate !== -1;
    $('#fb-done').hidden = rate !== 1;
    if (rate === -1) $('#fb-text').focus();
  }
  function onFeedbackSend() {
    if (!S.last) return;
    var t = $('#fb-text').value.trim();
    if (t) API.log({ kind: 'feedback', gen_id: S.last.id, trouble: t });
    $('#fb-more').hidden = true;
    $('#fb-done').hidden = false;
  }

  // ------------------------------------------------------------ ボタンをさがす（閉じた項目の中）
  function norm(s) {
    return String(s || '').toLowerCase()
      .replace(/[！-～]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xfee0); })
      .replace(/[ァ-ヶ]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0x60); })
      .replace(/\s+/g, '');
  }
  var SEARCH = {};
  Object.keys(T.INDEX).forEach(function (id) { var t = T.INDEX[id]; SEARCH[id] = norm(t.label + ' ' + (t.kw || '')); });

  function runFinder(q, mode) {
    var root = $('.pane[data-mode="' + mode + '"] .accs');
    if (!root) return;
    var words = String(q || '').trim().split(/[\s　、,]+/).map(norm).filter(Boolean);
    var hits = 0;
    root.classList.toggle('finding', words.length > 0);
    $$('.chip', root).forEach(function (b) {
      var id = b.getAttribute('data-id');
      var ok = !words.length || words.every(function (w) { return SEARCH[id].indexOf(w) >= 0; });
      b.classList.toggle('miss', !ok);
      if (ok && words.length) hits++;
    });
    $$('.grp', root).forEach(function (g) { g.classList.toggle('miss', words.length > 0 && !$('.chip:not(.miss)', g)); });
    $$('.cat', root).forEach(function (c) { c.classList.toggle('miss', words.length > 0 && !$('.chip:not(.miss)', c)); });
    $$('details', root).forEach(function (d) {
      if (words.length) {
        if (!d.hasAttribute('data-was')) d.setAttribute('data-was', d.open ? '1' : '0');
        d.open = !!$('.chip:not(.miss)', d);
      } else if (d.hasAttribute('data-was')) {
        d.open = d.getAttribute('data-was') === '1';
        d.removeAttribute('data-was');
      }
    });
    $$('.acc', root).forEach(function (a) { a.classList.toggle('miss', words.length > 0 && !$('.chip:not(.miss)', a)); });
    var c = $('[data-finder-count="' + mode + '"]');
    if (c) c.textContent = words.length ? (hits ? hits + '件' : '見つかりません') : '';
  }

  // ------------------------------------------------------------ 記録の案内
  function syncPrivacy() {
    var line = $('#privacy-line');
    var state = $('#log-state');
    var on = API.canLog();
    if (!API.configured()) {
      line.textContent = 'この画面で選んだ内容は、どこにも送られません（記録はオフです）。';
      state.textContent = 'いまは記録の送り先が設定されていないので、何も送っていません。';
    } else if (API.optedOut()) {
      line.textContent = 'この端末からは、記録を送らない設定になっています。';
      state.textContent = '記録を送っていません。';
    } else if (lineReady()) {
      line.textContent = 'LINE の表示名（' + (window.GP_LINE.state().name || '表示名なし') + '）と、選んだタグ・入力した文を記録します。講座の運営が、講座づくりのために見ます。入力欄に、ほかの人の名前などは書かないでください。';
      state.textContent = 'LINE とつないで記録を送っています（' + API.sentCount() + '件）。';
    } else {
      line.textContent = '選んだタグと入力した文は、講座をよくするために、名前なしで記録します。入力欄に名前・学校名などは書かないでください。';
      state.textContent = '記録を送っています（' + API.sentCount() + '件）。';
    }
    var lineOn = !!(window.GP_LINE && window.GP_LINE.enabled());
    $('#privacy-line-item').hidden = !lineOn;
    $('#line-off-box').hidden = !lineReady();
    $('#privacy-names').firstChild.textContent = lineOn ? 'メールアドレスは記録しません。' : '名前・メールアドレスは記録しません。';
    $('#optout').checked = API.optedOut();
    var c = API.cohort();
    $('#foot-cohort').textContent = c ? '講座コード：' + c : '';
    document.body.classList.toggle('logging', on);
  }

  // ------------------------------------------------------------ LINE とつながっているか（公式LINE の LIFF から開いたとき）
  function lineReady() { return !!(window.GP_LINE && window.GP_LINE.state().state === 'ready'); }
  function syncLine() {
    var L = window.GP_LINE;
    if (!L) return;
    var st = L.state();
    var text = st.state === 'loading' ? 'LINE とつないでいます…'
      : st.state === 'ready' ? 'LINE：' + (st.name || '表示名なし') + ' さんとして記録します'
      : st.state === 'error' ? 'LINE とつなげませんでした。名前なしで記録します' : '';
    var b = $('#line-badge');
    if (b.textContent !== text) b.textContent = text;
    b.hidden = !text;
    b.className = 'line-badge is-' + st.state;
    $('#line-connect').hidden = !(L.enabled() && st.state === 'anon' && API.canLog());
    syncPrivacy();
  }

  // ------------------------------------------------------------ つなぐ
  function wire() {
    document.addEventListener('click', function (e) {
      var el = e.target.closest('button, a');
      if (!el) return;
      if (el.classList.contains('chip')) { toggle(el.getAttribute('data-id')); return; }
      if (el.hasAttribute('data-dismiss')) { dismiss(el.getAttribute('data-dismiss')); return; }
      if (el.classList.contains('mode')) { setMode(el.getAttribute('data-mode')); return; }
      if (el.hasAttribute('data-preset')) { applyPreset(el.getAttribute('data-preset')); return; }
      if (el.hasAttribute('data-open-acc')) { openAcc(el.getAttribute('data-open-acc')); return; }
      if (el.hasAttribute('data-go') || el.id === 'go-dock') { generate(); return; }
      if (el.hasAttribute('data-copy')) { onCopy(el.getAttribute('data-copy')); return; }
      if (el.hasAttribute('data-rate')) { onRate(Number(el.getAttribute('data-rate'))); return; }
      if (el.classList.contains('vtab')) {
        var v = el.getAttribute('data-v');
        $$('.vtab').forEach(function (t) { t.setAttribute('aria-selected', t === el ? 'true' : 'false'); });
        $$('.vpanel').forEach(function (p) { p.hidden = p.id !== 'vp-' + v; });
        return;
      }
      var act = el.getAttribute('data-act');
      if (act === 'to-edit') { setMode('edit', true); var m = $('#f-edit-main'); if (m) { m.scrollIntoView({ block: 'center' }); m.focus(); } return; }
      if (act === 'to-title') {
        openAcc('extra');
        var f = $('#f-' + S.mode + '-title');
        if (f) setTimeout(function () { f.focus(); }, 50);
        return;
      }
      if (act === 'regen') { generate(); return; }
      if (act === 'fb-send') { onFeedbackSend(); return; }
      if (el.id === 'reset') { resetAll(); return; }
      if (el.id === 'open-privacy') { syncPrivacy(); $('#dlg-privacy').showModal(); return; }
      if (el.id === 'line-connect') { if (window.GP_LINE) window.GP_LINE.start({ force: true }); return; }
      if (el.id === 'line-off') { if (window.GP_LINE) window.GP_LINE.disconnect(); toast('このページでは、LINE の名前をつけずに記録します'); return; }
      if (el.id === 'close-privacy') { $('#dlg-privacy').close(); return; }
    });

    document.addEventListener('input', function (e) {
      var el = e.target;
      if (el.hasAttribute && el.hasAttribute('data-text')) {
        S.text[el.getAttribute('data-text')] = el.value;
        var c = $('[data-count="' + el.id + '"]');
        if (c) c.textContent = el.value.length + '/' + el.getAttribute('maxlength');
        saveState();
        syncAll();
      } else if (el.hasAttribute && el.hasAttribute('data-finder')) {
        runFinder(el.value, el.getAttribute('data-finder'));
      }
    });

    document.addEventListener('change', function (e) {
      var el = e.target;
      if (el.classList && el.classList.contains('tool-select')) setTool(el.value);
    });

    $('#optout').addEventListener('change', function (e) { API.setOptOut(e.target.checked); syncPrivacy(); syncLine(); });

    // 入力欄で ⌘（Ctrl）+ Enter：処方箋を出す
    document.addEventListener('keydown', function (e) {
      var t = e.target;
      if (t && t.classList && t.classList.contains('hero-input') && e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !e.isComposing) { e.preventDefault(); generate(); return; }
      if (!t.classList || !(t.classList.contains('vtab') || t.classList.contains('mode'))) return;
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      var list = $$(t.classList.contains('vtab') ? '.vtab' : '.mode');
      var i = list.indexOf(t) + (e.key === 'ArrowRight' ? 1 : -1);
      var next = list[(i + list.length) % list.length];
      next.focus(); next.click();
      e.preventDefault();
    });

    // スマホ：処方箋か「処方箋を出す」ボタンが見えている間は、下の帯を隠す
    if ('IntersectionObserver' in window) {
      // 処方箋の上のふちが、画面の上から55%より上に入ってきたら「処方箋を見ている」とみなす（下のふちが少し見えただけでは、帯を隠さない）
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { document.body.classList.toggle('result-visible', en.isIntersecting); });
      }, { rootMargin: '0px 0px -45% 0px', threshold: 0 });
      io.observe($('#result'));
      var seen = {};
      var io2 = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { seen[en.target.getAttribute('data-go')] = en.isIntersecting; });
        document.body.classList.toggle('go-visible', Object.keys(seen).some(function (k) { return seen[k]; }));
      });
      $$('[data-go]').forEach(function (b) { io2.observe(b); });
    }
  }

  function init() {
    loadState();
    buildPanes();
    syncMode();
    syncTextFields();
    syncAll();
    syncPrivacy();
    wire();
    // 公式LINE（LIFF）から開いたときは LINE とつなぐ。記録しない設定・記録の送り先がないときは、つながない
    if (window.GP_LINE) {
      window.GP_LINE.on(syncLine);
      if (API.canLog()) window.GP_LINE.start(); else syncLine();
    }
    document.body.classList.add('ready');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  // 確認用（テストから中身を見る）
  window.GP_APP = { state: S, generate: generate, currentInput: currentInput };
})();

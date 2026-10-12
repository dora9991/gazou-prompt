/*
 * 画像生成プロンプト処方箋 ― 参加者の画面
 * 画面は最初に1回だけ組み立て、あとは「押されている／いない」などの状態だけを書きかえる
 * （押している最中のボタンを作り直すと、Safari でクリックが届かなくなるため）。
 */
(function () {
  'use strict';
  var T = window.GP_TAGS, E = window.GP_ENGINE, API = window.GP_API;
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
  var WISH_PH = {
    new: '例：運動会でリレーをしている子どもたち／本と電球を組み合わせたロゴ',
    edit: '例：右の男の子の手を自然にしたい／背景を夕方の校庭にしたい'
  };
  var STEPS = {
    new: [
      { id: 'what', title: '何を描きますか？', sub: '自由に書くか、場面・テーマから選びます', parts: [{ text: 'wish', label: '描いてほしいもの（自由に）' }, { cat: 'scene', fold: '場面・テーマから選ぶ' }] },
      { id: 'use', title: '何に使いますか？', sub: '使い道に合わせて、見やすさや形を整えます', parts: [{ cat: 'use' }] },
      { id: 'trouble', title: '困っていることは？', sub: 'あれば選んでください。対策を指示文に入れます', parts: [{ cat: 'trouble' }, { text: 'trouble', label: 'ほかに困っていること（自由に）', ph: '例：子どもを描くと、毎回大人っぽくなってしまう' }] },
      { id: 'look', title: 'どんな感じにしますか？', sub: 'タッチ・雰囲気・色', parts: [{ cat: 'style' }, { cat: 'mood' }, { cat: 'color' }] },
      { id: 'detail', title: '細かく決める', sub: '形・構図・人物・入れる文字など（なくても大丈夫）', fold: true, parts: [{ cat: 'ratio' }, { cat: 'frame' }, { cat: 'bg' }, { cat: 'people' }, { cat: 'count' }, { text: 'title', label: '画像に入れる文字（なければ空欄）', ph: '例：うんどうかい', max: 80, line: true }, { cat: 'option' }] },
      { id: 'tool', title: 'どのAIに貼りますか？', sub: 'AIに合わせて、書き方を変えます', parts: [{ cat: 'tool' }] }
    ],
    edit: [
      { id: 'change', title: 'どこを直しますか？', sub: '直したいところを選び、どう直したいかを書きます', parts: [{ cat: 'change' }, { text: 'wish', label: 'どう直したいか（自由に）' }] },
      { id: 'keep', title: 'そのままにしたいところは？', sub: '変えてほしくないところを、はっきり伝えます', parts: [{ cat: 'keep' }] },
      { id: 'trouble', title: '困っていることは？', sub: 'あれば選んでください', parts: [{ cat: 'trouble' }, { text: 'trouble', label: 'ほかに困っていること（自由に）', ph: '例：直してと頼むと、顔まで変わってしまう' }] },
      { id: 'detail', title: '細かく決める', sub: '形・入れる文字（なくても大丈夫）', fold: true, parts: [{ cat: 'ratio' }, { text: 'title', label: '正しい文字・入れたい文字（なければ空欄）', ph: '例：うんどうかい', max: 80, line: true }] },
      { id: 'tool', title: 'どのAIに貼りますか？', sub: 'AIに合わせて、書き方を変えます', parts: [{ cat: 'tool' }] }
    ]
  };
  var OPEN_URL = {
    'ai-chatgpt': 'https://chatgpt.com/', 'ai-gemini': 'https://gemini.google.com/app', 'ai-copilot': 'https://copilot.microsoft.com/',
    'ai-canva': 'https://www.canva.com/', 'ai-firefly': 'https://firefly.adobe.com/', 'ai-midjourney': 'https://www.midjourney.com/imagine'
  };

  // ------------------------------------------------------------ 状態
  var S = {
    mode: 'new',
    sel: new Set(),
    text: { wishnew: '', wishedit: '', trouble: '', title: '' },
    preset: '',
    last: null
  };
  var STATE_KEY = 'gp.state';

  function saveState() {
    API.store(STATE_KEY, JSON.stringify({ mode: S.mode, tags: Array.from(S.sel), text: S.text }));
  }
  function loadState() {
    var raw = API.store(STATE_KEY);
    if (!raw) return;
    try {
      var o = JSON.parse(raw);
      if (o.mode === 'edit' || o.mode === 'new') S.mode = o.mode;
      (o.tags || []).forEach(function (id) { if (T.byId(id)) S.sel.add(id); });
      if (o.text) Object.keys(S.text).forEach(function (k) { if (typeof o.text[k] === 'string') S.text[k] = o.text[k].slice(0, 400); });
    } catch (e) { /* 壊れていたら使わない */ }
  }

  function wishKey() { return 'wish' + S.mode; }
  function currentInput() {
    var tool = '';
    S.sel.forEach(function (id) { var t = T.byId(id); if (t && t.cat === 'tool') tool = id; });
    return { mode: S.mode, tags: Array.from(S.sel), wish: S.text[wishKey()], trouble: S.text.trouble, title: S.text.title, tool: tool };
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

  function catBlock(cat, part) {
    var c = T.CAT[cat];
    var groups = c.groups.filter(function (g) { return !g.more; });
    var more = c.groups.filter(function (g) { return g.more; });
    function grp(g) {
      return h('div', { class: 'grp', 'data-grp': g.id },
        g.label && c.groups.length > 1 ? h('p', { class: 'grp-label', text: g.label }) : null,
        h('div', { class: 'chips' }, g.tags.map(chip)));
    }
    var head = h('div', { class: 'cat-h' }, h('h3', { class: 'cat-title', text: c.label }), h('span', { class: 'cat-hint', text: c.hint }));
    var inner = [groups.map(grp)];
    if (more.length) {
      var n = more.reduce(function (a, g) { return a + g.tags.length; }, 0);
      inner.push(h('details', { class: 'fold fold-more' }, h('summary', null, h('span', { text: 'ほかの' + c.label + '（' + n + '）' })), h('div', { class: 'fold-body' }, more.map(grp))));
    }
    var block = h('div', { class: 'cat', 'data-cat': cat }, part && part.fold ? null : head, inner);
    if (part && part.fold) {
      var total = c.groups.reduce(function (a, g) { return a + g.tags.length; }, 0);
      return h('details', { class: 'fold fold-cat', 'data-cat-fold': cat }, h('summary', null, h('span', { text: part.fold + '（' + total + '）' }), h('span', { class: 'fold-sel', 'data-fold-count': cat })), h('div', { class: 'fold-body' }, block));
    }
    return block;
  }

  function textField(mode, part) {
    var key = part.text === 'wish' ? 'wish' + mode : part.text;
    var id = 'f-' + mode + '-' + part.text;
    var max = part.max || 400;
    var input = part.line
      ? h('input', { id: id, type: 'text', maxlength: String(max), autocomplete: 'off', 'data-text': key, placeholder: part.ph || '' })
      : h('textarea', { id: id, rows: '2', maxlength: String(max), 'data-text': key, placeholder: part.ph || WISH_PH[mode] });
    var count = h('span', { class: 'field-count', 'data-count': id, text: '0/' + max });
    return h('div', { class: 'field' }, h('label', { for: id, class: 'field-label', text: part.label }), input, h('div', { class: 'field-foot' }, count));
  }

  function buildSteps() {
    var root = $('#steps');
    ['new', 'edit'].forEach(function (mode) {
      STEPS[mode].forEach(function (st, i) {
        var body = h('div', { class: 'step-body' }, st.parts.map(function (p) { return p.cat ? catBlock(p.cat, p) : textField(mode, p); }));
        if (st.id === 'trouble') body.appendChild(h('div', { class: 'hint-box', 'data-hints': mode }));
        var head = h('div', { class: 'step-h' },
          h('span', { class: 'step-num', text: String(i + 1) }),
          h('div', { class: 'step-tt' }, h('h2', { class: 'step-title', text: st.title }), h('p', { class: 'step-sub', text: st.sub })),
          h('span', { class: 'step-badge', 'data-badge': mode + '-' + st.id }));
        var sec;
        if (st.fold) {
          sec = h('section', { class: 'step step-fold', 'data-mode': mode, 'data-step': st.id },
            h('details', { class: 'fold fold-step', 'data-step-fold': mode }, h('summary', null, head), body));
        } else {
          sec = h('section', { class: 'step', 'data-mode': mode, 'data-step': st.id }, head, body);
        }
        root.appendChild(sec);
      });
    });
  }

  function buildPresets() {
    var box = $('#preset-list');
    T.PRESETS.forEach(function (p) {
      box.appendChild(h('button', { type: 'button', class: 'preset', 'data-preset': p.id, 'data-pmode': p.mode },
        h('span', { class: 'preset-mode', text: p.mode === 'edit' ? '直す' : '作る' }), h('span', { text: p.label })));
    });
  }

  // ------------------------------------------------------------ 表示を状態に合わせる
  function syncMode() {
    $$('.mode').forEach(function (b) { b.setAttribute('aria-selected', b.getAttribute('data-mode') === S.mode ? 'true' : 'false'); });
    $$('.step').forEach(function (s) { s.hidden = s.getAttribute('data-mode') !== S.mode; });
    document.body.setAttribute('data-mode', S.mode);
  }

  function syncChips() {
    $$('.chip').forEach(function (b) {
      var on = S.sel.has(b.getAttribute('data-id'));
      if ((b.getAttribute('aria-pressed') === 'true') !== on) b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    // 見出しの数
    ['new', 'edit'].forEach(function (mode) {
      STEPS[mode].forEach(function (st) {
        var n = 0;
        st.parts.forEach(function (p) {
          if (p.cat) S.sel.forEach(function (id) { var t = T.byId(id); if (t && t.cat === p.cat) n++; });
          if (p.text) { var key = p.text === 'wish' ? 'wish' + mode : p.text; if (S.text[key].trim()) n++; }
        });
        var b = $('[data-badge="' + mode + '-' + st.id + '"]');
        if (b) { b.textContent = n ? n + '個' : ''; b.classList.toggle('on', n > 0); }
      });
    });
    $$('[data-fold-count]').forEach(function (el) {
      var cat = el.getAttribute('data-fold-count'), n = 0;
      S.sel.forEach(function (id) { var t = T.byId(id); if (t && t.cat === cat) n++; });
      el.textContent = n ? n + '個 選択中' : '';
    });
    syncHints();
    syncDock();
    syncStale();
  }

  function syncHints() {
    ['new', 'edit'].forEach(function (mode) {
      var box = $('[data-hints="' + mode + '"]');
      if (!box) return;
      var hints = [];
      if (mode === 'new' && S.sel.has('t-partial-edit')) hints.push({ text: 'できた画像の一部を直したいときは、「できた画像を直す」に切りかえると、変えないところまで書いた指示文になります。', btn: '切りかえる', act: 'to-edit' });
      if ((S.sel.has('t-want-text') || S.sel.has('t-text-broken')) && !S.text.title.trim()) hints.push({ text: '画像に入れたい文字があるときは、「細かく決める」の「画像に入れる文字」に書いてください。ないときは、文字なしの指示になります。', btn: '文字を書く', act: 'to-title' });
      var key = JSON.stringify(hints.map(function (x) { return x.act; }));
      if (box.getAttribute('data-key') === key) return;   // 変わったときだけ作り直す
      box.setAttribute('data-key', key);
      box.textContent = '';
      hints.forEach(function (x) {
        box.appendChild(h('div', { class: 'hint' }, h('p', { text: x.text }), h('button', { type: 'button', class: 'btn-small', 'data-act': x.act, text: x.btn })));
      });
    });
  }

  function countSelected() {
    var n = 0;
    S.sel.forEach(function (id) {
      var t = T.byId(id);
      if (t && T.CAT[t.cat].modes.indexOf(S.mode) >= 0) n++;
    });
    if (S.text[wishKey()].trim()) n++;
    if (S.text.trouble.trim()) n++;
    if (S.text.title.trim()) n++;
    return n;
  }
  function syncDock() {
    var n = countSelected();
    var t = n ? n + '個 えらんでいます' : 'まだ選んでいません';
    var el = $('#dock-count');
    if (el.textContent !== t) el.textContent = t;
  }

  function syncStale() {
    var body = $('#rx-body');
    if (!S.last || body.hidden) return;
    var stale = sig(currentInput()) !== S.last.sig;
    body.classList.toggle('stale', stale);
    var bar = $('#stale-bar');
    if (bar) bar.hidden = !stale;
    var label = stale ? '処方箋を出し直す' : '処方箋を出す';
    ['#go', '#go-dock'].forEach(function (s) { var b = $(s); if (b && b.textContent !== label && !b.matches(':active')) b.textContent = label; });
  }

  function syncTextFields() {
    $$('[data-text]').forEach(function (el) {
      var key = el.getAttribute('data-text');
      if (el.value !== S.text[key]) el.value = S.text[key];
      var c = $('[data-count="' + el.id + '"]');
      if (c) c.textContent = el.value.length + '/' + el.getAttribute('maxlength');
    });
  }

  // ------------------------------------------------------------ 操作
  function toggle(id) {
    var t = T.byId(id);
    if (!t) return;
    var cat = T.CAT[t.cat];
    if (S.sel.has(id)) S.sel.delete(id);
    else {
      if (!cat.multi) S.sel.forEach(function (x) { var o = T.byId(x); if (o && o.cat === t.cat) S.sel.delete(x); });
      S.sel.add(id);
    }
    S.preset = '';
    saveState();
    syncChips();
  }

  function setMode(mode) {
    if (mode !== 'new' && mode !== 'edit') return;
    S.mode = mode;
    saveState();
    syncMode();
    syncChips();
  }

  function applyPreset(id) {
    var p = T.PRESETS.filter(function (x) { return x.id === id; })[0];
    if (!p) return;
    var keepTool = '';
    S.sel.forEach(function (x) { var t = T.byId(x); if (t && t.cat === 'tool') keepTool = x; });
    S.sel = new Set(p.tags.filter(function (x) { return T.byId(x); }));
    if (keepTool) S.sel.add(keepTool);
    S.mode = p.mode;
    S.text['wish' + p.mode] = p.wish || '';
    S.text.title = p.title || '';
    S.text.trouble = '';
    syncMode(); syncTextFields(); syncChips();
    generate(id);
  }

  function resetAll() {
    S.sel = new Set();
    S.text = { wishnew: '', wishedit: '', trouble: '', title: '' };
    S.preset = '';
    saveState();
    syncTextFields(); syncChips();
    toast('選んだものを全部はずしました');
  }

  // ------------------------------------------------------------ 処方箋
  function generate(presetId) {
    var input = currentInput();
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
    if (narrow) {
      var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      r.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    }
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
      h('p', { text: '選び直しました。下の指示文は、前の選び方のものです。' }),
      h('button', { type: 'button', class: 'btn-small', 'data-act': 'regen', text: '出し直す' })));

    if (out.picked.length) {
      body.appendChild(h('ul', { class: 'rx-picked', 'aria-label': '選んだもの' }, out.picked.map(function (p) {
        return h('li', { class: 'pk c-' + (T.CAT[p.cat].color || 'gray'), text: p.label });
      })));
    }

    if (out.notes.length) body.appendChild(h('ul', { class: 'rx-notes' }, out.notes.map(function (n) { return h('li', { text: n }); })));

    // 指示文（いくつかの版）
    var tabs = h('div', { class: 'vtabs', role: 'tablist', 'aria-label': '指示文の種類' });
    var panels = h('div', { class: 'vpanels' });
    out.versions.forEach(function (v) {
      var sel = v.id === out.recommended;
      var tabId = 'vt-' + v.id, panelId = 'vp-' + v.id;
      tabs.appendChild(h('button', { type: 'button', role: 'tab', class: 'vtab', id: tabId, 'aria-controls': panelId, 'aria-selected': sel ? 'true' : 'false', 'data-v': v.id },
        h('span', { text: v.label }), sel ? h('span', { class: 'rec', text: 'おすすめ' }) : null));
      panels.appendChild(h('div', { class: 'vpanel', role: 'tabpanel', id: panelId, 'aria-labelledby': tabId, hidden: !sel },
        v.note ? h('p', { class: 'vnote', text: v.note }) : null,
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

  // ------------------------------------------------------------ タグをさがす
  function norm(s) {
    return String(s || '').toLowerCase()
      .replace(/[！-～]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xfee0); })
      .replace(/[ァ-ヶ]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0x60); })
      .replace(/\s+/g, '');
  }
  var SEARCH = {};
  Object.keys(T.INDEX).forEach(function (id) { var t = T.INDEX[id]; SEARCH[id] = norm(t.label + ' ' + (t.kw || '')); });

  function runFinder(q) {
    var words = String(q || '').trim().split(/[\s　、,]+/).map(norm).filter(Boolean);
    var hits = 0;
    var root = $('#steps');
    root.classList.toggle('finding', words.length > 0);
    $$('.chip', root).forEach(function (b) {
      var id = b.getAttribute('data-id');
      var ok = !words.length || words.every(function (w) { return SEARCH[id].indexOf(w) >= 0; });
      b.classList.toggle('miss', !ok);
      if (ok && words.length && !b.closest('.step').hidden) hits++;
    });
    $$('.grp', root).forEach(function (g) { g.classList.toggle('miss', words.length > 0 && !$('.chip:not(.miss)', g)); });
    $$('.cat', root).forEach(function (c) { c.classList.toggle('miss', words.length > 0 && !$('.chip:not(.miss)', c)); });
    $$('details.fold', root).forEach(function (d) {
      if (words.length) {
        if (!d.hasAttribute('data-was')) d.setAttribute('data-was', d.open ? '1' : '0');
        d.open = !!$('.chip:not(.miss)', d);
      } else if (d.hasAttribute('data-was')) {
        d.open = d.getAttribute('data-was') === '1';
        d.removeAttribute('data-was');
      }
    });
    $$('.step', root).forEach(function (s) { s.classList.toggle('miss', words.length > 0 && !$('.chip:not(.miss)', s)); });
    $('#finder-count').textContent = words.length ? (hits ? hits + '件' : '見つかりません') : '';
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
    } else {
      line.textContent = '選んだタグと入力した文は、講座をよくするために、名前なしで記録します。入力欄に名前・学校名などは書かないでください。';
      state.textContent = '記録を送っています（' + API.sentCount() + '件）。';
    }
    $('#optout').checked = API.optedOut();
    var c = API.cohort();
    $('#foot-cohort').textContent = c ? '講座コード：' + c : '';
    document.body.classList.toggle('logging', on);
  }

  // ------------------------------------------------------------ つなぐ
  function wire() {
    document.addEventListener('click', function (e) {
      var el = e.target.closest('button, a');
      if (!el) return;
      if (el.classList.contains('chip')) { toggle(el.getAttribute('data-id')); return; }
      if (el.classList.contains('mode')) { setMode(el.getAttribute('data-mode')); return; }
      if (el.hasAttribute('data-preset')) { applyPreset(el.getAttribute('data-preset')); return; }
      if (el.hasAttribute('data-copy')) { onCopy(el.getAttribute('data-copy')); return; }
      if (el.hasAttribute('data-rate')) { onRate(Number(el.getAttribute('data-rate'))); return; }
      if (el.classList.contains('vtab')) {
        var v = el.getAttribute('data-v');
        $$('.vtab').forEach(function (t) { t.setAttribute('aria-selected', t === el ? 'true' : 'false'); });
        $$('.vpanel').forEach(function (p) { p.hidden = p.id !== 'vp-' + v; });
        return;
      }
      var act = el.getAttribute('data-act');
      if (act === 'to-edit') { setMode('edit'); $('#steps').scrollIntoView({ block: 'start' }); return; }
      if (act === 'to-title') {
        var d = $('[data-step-fold="' + S.mode + '"]');
        if (d) d.open = true;
        var f = $('#f-' + S.mode + '-title');
        if (f) { f.scrollIntoView({ block: 'center' }); f.focus(); }
        return;
      }
      if (act === 'regen') { generate(); return; }
      if (act === 'fb-send') { onFeedbackSend(); return; }
      if (el.id === 'go' || el.id === 'go-dock') { generate(); return; }
      if (el.id === 'reset') { resetAll(); return; }
      if (el.id === 'open-privacy') { syncPrivacy(); $('#dlg-privacy').showModal(); return; }
      if (el.id === 'close-privacy') { $('#dlg-privacy').close(); return; }
    });

    document.addEventListener('input', function (e) {
      var el = e.target;
      if (el.hasAttribute && el.hasAttribute('data-text')) {
        S.text[el.getAttribute('data-text')] = el.value;
        var c = $('[data-count="' + el.id + '"]');
        if (c) c.textContent = el.value.length + '/' + el.getAttribute('maxlength');
        saveState();
        syncChips();
      } else if (el.id === 'finder') {
        runFinder(el.value);
      }
    });

    $('#optout').addEventListener('change', function (e) { API.setOptOut(e.target.checked); syncPrivacy(); });

    // タブを矢印キーで
    document.addEventListener('keydown', function (e) {
      var t = e.target;
      if (!t.classList || !(t.classList.contains('vtab') || t.classList.contains('mode'))) return;
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      var list = $$(t.classList.contains('vtab') ? '.vtab' : '.mode');
      var i = list.indexOf(t) + (e.key === 'ArrowRight' ? 1 : -1);
      var next = list[(i + list.length) % list.length];
      next.focus(); next.click();
      e.preventDefault();
    });

    // スマホ：処方箋が見えている間は、下の「処方箋を出す」を隠す
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { document.body.classList.toggle('result-visible', en.isIntersecting); });
      }, { threshold: 0.05 });
      io.observe($('#result'));
      var io2 = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { document.body.classList.toggle('go-visible', en.isIntersecting); });
      });
      io2.observe($('#go'));
    }
  }

  function init() {
    loadState();
    buildSteps();
    buildPresets();
    syncMode();
    syncTextFields();
    syncChips();
    syncPrivacy();
    wire();
    document.body.classList.add('ready');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  // 確認用（テストから中身を見る）
  window.GP_APP = { state: S, generate: generate, currentInput: currentInput };
})();

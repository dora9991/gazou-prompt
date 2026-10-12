/*
 * 画像生成プロンプト処方箋 ― 記録の集計（管理画面用）
 * 画面にも通信にも触らない「純粋な関数」だけ。Node でも試せる（tests/unit）。
 *
 *   GP_ANALYZE.summarize(rows, { since, until, cohort, excludePresets, tag, mode, now })
 *     rows：admin_events が返す記録（generate / copy / feedback が混ざったまま）
 *     since・until：ミリ秒（日本時間の日付の区切りで渡す）
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./tags.js'));
  else root.GP_ANALYZE = factory(root.GP_TAGS);
})(typeof self !== 'undefined' ? self : this, function (TAGS) {
  'use strict';

  var AREA = {
    imagine: '思い通りにならない', people: '人物・キャラクター', text: '文字', finish: '仕上がり・質感',
    edit: '直す・やりとり', start: '何から始めれば', safety: '安心・ルール', cost: '回数・時間・お金'
  };
  var DAY = 86400000;
  var JST = 9 * 3600000;

  function jstDay(t) { return new Date(new Date(t).getTime() + JST).toISOString().slice(0, 10); }
  function dayStart(dayStr) { return Date.parse(dayStr + 'T00:00:00+09:00'); }
  function label(id) { var t = TAGS.byId(id); return t ? t.label : id; }
  function catOf(id) { var t = TAGS.byId(id); return t ? t.cat : 'unknown'; }
  function pct(a, b) { return b ? a / b : 0; }

  // ------------------------------------------------------------ 1回ごと（処方箋を出した回）にまとめる
  function prepare(rows) {
    var gens = [], byGen = {};
    (rows || []).forEach(function (r) {
      if (r.kind === 'generate') {
        var g = { id: r.id, gen: r.gen_id, at: Date.parse(r.created_at), visitor: r.visitor_id, cohort: r.cohort || '', mode: r.mode || 'new', tool: r.tool || '',
          preset: r.preset || '', tags: r.tags || [], wish: r.wish || '', trouble: r.trouble || '', title: r.title_text || '', client: r.client || '',
          copies: [], rating: 0, comments: [] };
        gens.push(g);
        byGen[r.gen_id] = g;
      }
    });
    (rows || []).slice().sort(function (a, b) { return a.id - b.id; }).forEach(function (r) {
      var g = byGen[r.gen_id];
      if (!g) return;
      if (r.kind === 'copy') g.copies.push(r.part || '');
      else if (r.kind === 'feedback') {
        if (r.rating === 1 || r.rating === -1) g.rating = r.rating;
        if (r.trouble) g.comments.push({ id: r.id, at: Date.parse(r.created_at), text: r.trouble });
      }
    });
    gens.sort(function (a, b) { return a.at - b.at; });
    return gens;
  }

  function filterGens(gens, o) {
    o = o || {};
    return gens.filter(function (g) {
      if (o.since != null && g.at < o.since) return false;
      if (o.until != null && g.at >= o.until) return false;
      if (o.cohort != null && o.cohort !== '*' && g.cohort !== o.cohort) return false;
      if (o.excludePresets && g.preset) return false;
      if (o.mode && g.mode !== o.mode) return false;
      if (o.tag && g.tags.indexOf(o.tag) < 0) return false;
      return true;
    });
  }

  // ------------------------------------------------------------ 言葉を数える
  var SEG = (typeof Intl !== 'undefined' && Intl.Segmenter) ? new Intl.Segmenter('ja', { granularity: 'word' }) : null;
  var STOP = {};
  ('する ある いる なる なっ こと もの よう ため これ それ あれ どれ この その あの どの ので から まで けど けれど ください ほしい たい です ます でし まし ない なく られ させ みたい ような ように とき ところ もう すこし 少し ちょっと とても など なに なん 何か なか うまく でき できる できない 思う 思っ ぽい っぽい いい よい ほう 方 感じ 自分 画像 イラスト 作成 生成 作っ 作る 作り 描い 描く 描き 使い 使う 使っ 場合 時 中 的 化 さん たち ちゃん くん 使える 入れる 入れ 出し 出す 出る 添える 添え 見える 見せる 書く 書い 書き 合う 選ぶ 変え 変える 変わる 変わっ 直し 直す 直っ しまう しまっ くる くれ いく 行く 欲しい 入っ').split(' ').forEach(function (w) { STOP[w] = 1; });
  function norm(s) {
    return String(s || '').toLowerCase()
      .replace(/[！-～]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xfee0); })
      .replace(/[ァ-ヶ]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0x60); })
      .replace(/\s+/g, '');
  }
  // 漢字・カタカナ・英数字が続くところは1つの言葉にまとめる（「卒業」「アルバム」→「卒業アルバム」）
  var SOLID = /^[\u4e00-\u9fff々\u30a0-\u30ffーA-Za-z0-9\uff21-\uff3a\uff41-\uff5a\uff10-\uff19]+$/;
  function tokens(text) {
    text = String(text || '');
    var out = [];
    if (SEG) {
      var buf = '';
      var it = SEG.segment(text);
      var arr = typeof it[Symbol.iterator] === 'function' ? Array.from(it) : [];
      arr.forEach(function (s) {
        var w = s.segment;
        if (s.isWordLike && SOLID.test(w)) { buf += w; return; }
        if (buf) { out.push(buf); buf = ''; }
        if (s.isWordLike) out.push(w);
      });
      if (buf) out.push(buf);
    } else {
      // Intl.Segmenter が無い環境：漢字・カタカナ・英字のかたまりだけ拾う
      (text.match(/[\u4e00-\u9fff々\u30a0-\u30ffーA-Za-z0-9]{2,}/g) || []).forEach(function (w) { out.push(w); });
    }
    return out.filter(function (w) {
      if (STOP[w] || w.length > 16) return false;
      if (/^[0-9０-９]+$/.test(w)) return false;
      if (/^[\u3041-\u309f]+$/.test(w)) return w.length >= 4;      // ひらがなだけの言葉は4文字以上（てにをは・活用の切れはしを除く）
      return w.length >= 2;
    });
  }
  var TAG_TEXT = null;
  function tagText() {
    if (TAG_TEXT) return TAG_TEXT;
    TAG_TEXT = Object.keys(TAGS.INDEX).map(function (id) { var t = TAGS.INDEX[id]; return norm(t.label + ' ' + (t.kw || '')); }).join(' ');
    return TAG_TEXT;
  }

  // ------------------------------------------------------------ 本体
  function summarize(rows, o) {
    o = o || {};
    var all = Array.isArray(rows) && rows.length && rows[0] && rows[0].copies ? rows : prepare(rows);
    var gens = filterGens(all, o);
    var n = gens.length;

    // ---- 数字
    var visitors = {}, copied = 0, rated = 0, good = 0, comments = 0, texts = 0, presets = 0, edit = 0;
    gens.forEach(function (g) {
      visitors[g.visitor] = 1;
      if (g.copies.length) copied++;
      if (g.rating) { rated++; if (g.rating === 1) good++; }
      comments += g.comments.length;
      if (g.wish || g.trouble || g.title) texts++;
      if (g.preset) presets++;
      if (g.mode === 'edit') edit++;
    });
    var nv = Object.keys(visitors).length;
    var kpi = { gens: n, visitors: nv, perVisitor: nv ? n / nv : 0, copied: copied, copyRate: pct(copied, n), rated: rated, good: good,
      goodRate: pct(good, rated), comments: comments, texts: texts, presets: presets, edit: edit };

    // ---- タグごと
    var counts = {}, badBy = {}, ratedBy = {};
    gens.forEach(function (g) {
      g.tags.forEach(function (id) {
        counts[id] = (counts[id] || 0) + 1;
        if (g.rating) { ratedBy[id] = (ratedBy[id] || 0) + 1; if (g.rating === -1) badBy[id] = (badBy[id] || 0) + 1; }
      });
    });
    var byCat = {};
    TAGS.CATEGORIES.forEach(function (c) { byCat[c.id] = []; });
    byCat.unknown = [];
    Object.keys(counts).forEach(function (id) {
      var cat = catOf(id);
      (byCat[cat] || byCat.unknown).push({ id: id, label: label(id), n: counts[id], share: pct(counts[id], n), rated: ratedBy[id] || 0, bad: badBy[id] || 0 });
    });
    Object.keys(byCat).forEach(function (k) { byCat[k].sort(function (a, b) { return b.n - a.n || (a.label < b.label ? -1 : 1); }); });

    // 困りごとの「まとまり」（その回答に、そのまとまりの困りごとが1つでもあれば1回）
    var areaN = {};
    gens.forEach(function (g) {
      var seen = {};
      g.tags.forEach(function (id) { var t = TAGS.byId(id); if (t && t.cat === 'trouble' && t.area && !seen[t.area]) { seen[t.area] = 1; areaN[t.area] = (areaN[t.area] || 0) + 1; } });
    });
    var areas = Object.keys(AREA).map(function (a) { return { id: a, label: AREA[a], n: areaN[a] || 0, share: pct(areaN[a] || 0, n) }; })
      .filter(function (a) { return a.n > 0; }).sort(function (a, b) { return b.n - a.n; });
    var withTrouble = gens.filter(function (g) { return g.tags.some(function (id) { return catOf(id) === 'trouble'; }) || g.trouble; }).length;

    // ---- 日ごと
    var dayN = {};
    gens.forEach(function (g) { var d = jstDay(g.at); dayN[d] = (dayN[d] || 0) + 1; });
    var daily = [];
    if (n) {
      var d0 = o.since != null ? jstDay(o.since) : jstDay(gens[0].at);
      var d1 = jstDay(o.until != null ? Math.min(o.until - 1, (o.now || Date.now())) : gens[n - 1].at);
      if (d1 < d0) d1 = d0;
      for (var t = dayStart(d0), guard = 0; t <= dayStart(d1) && guard < 800; t += DAY, guard++) {
        var ds = jstDay(t);
        daily.push({ day: ds, n: dayN[ds] || 0 });
      }
    }

    // ---- 困りごと × 作りたいもの
    var tops = byCat.trouble.slice(0, 8), topu = byCat.use.slice(0, 6);
    var cells = tops.map(function (tr) {
      return topu.map(function (u) {
        var c = 0;
        gens.forEach(function (g) { if (g.tags.indexOf(tr.id) >= 0 && g.tags.indexOf(u.id) >= 0) c++; });
        return c;
      });
    });
    var pairs = [];
    var pairN = {};
    gens.forEach(function (g) {
      var tr = g.tags.filter(function (id) { return catOf(id) === 'trouble'; });
      var us = g.tags.filter(function (id) { return catOf(id) === 'use'; });
      tr.forEach(function (a) { us.forEach(function (b) { var k = a + '|' + b; pairN[k] = (pairN[k] || 0) + 1; }); });
    });
    Object.keys(pairN).forEach(function (k) { var p = k.split('|'); pairs.push({ a: p[0], b: p[1], al: label(p[0]), bl: label(p[1]), n: pairN[k] }); });
    pairs.sort(function (a, b) { return b.n - a.n; });

    // ---- 自由記述
    var list = [];
    gens.forEach(function (g) {
      var tagLabels = g.tags.filter(function (id) { var c = catOf(id); return c === 'trouble' || c === 'use' || c === 'change'; }).map(label);
      if (g.wish) list.push({ id: g.id, at: g.at, kind: g.mode === 'edit' ? 'fix' : 'wish', text: g.wish, cohort: g.cohort, tags: tagLabels, gen: g.gen });
      if (g.trouble) list.push({ id: g.id, at: g.at, kind: 'trouble', text: g.trouble, cohort: g.cohort, tags: tagLabels, gen: g.gen });
      if (g.title) list.push({ id: g.id, at: g.at, kind: 'title', text: g.title, cohort: g.cohort, tags: tagLabels, gen: g.gen });
      g.comments.forEach(function (c) { list.push({ id: c.id, at: c.at, kind: 'comment', text: c.text, cohort: g.cohort, tags: tagLabels, gen: g.gen }); });
    });
    list.sort(function (a, b) { return b.at - a.at; });

    // ---- 言葉（1つの文の中では1回と数える）
    var wordN = {}, wordShow = {};
    list.forEach(function (x) {
      if (x.kind === 'title') return;
      var seen = {};
      tokens(x.text).forEach(function (w) { var k = norm(w); if (seen[k]) return; seen[k] = 1; wordN[k] = (wordN[k] || 0) + 1; if (!wordShow[k]) wordShow[k] = w; });
    });
    var words = Object.keys(wordN).map(function (k) { return { w: wordShow[k], key: k, n: wordN[k] }; }).sort(function (a, b) { return b.n - a.n || (a.w < b.w ? -1 : 1); });
    var tt = tagText();
    var newWords = words.filter(function (x) { return x.n >= 2 && /[\u4e00-\u9fff\u30a0-\u30ffA-Za-z]/.test(x.w) && tt.indexOf(x.key) < 0; });

    // ---- 「いまいち」が多い困りごと
    var hardTroubles = byCat.trouble.filter(function (x) { return x.rated >= 5; })
      .map(function (x) { return Object.assign({ badRate: pct(x.bad, x.rated) }, x); })
      .sort(function (a, b) { return b.badRate - a.badRate || b.rated - a.rated; });

    // ---- 増えているもの（直近7日と、その前の7日）
    var rising = [];
    if (daily.length >= 14) {
      var lastDay = dayStart(daily[daily.length - 1].day) + DAY;
      var a0 = lastDay - 7 * DAY, b0 = lastDay - 14 * DAY;
      var recent = {}, before = {};
      gens.forEach(function (g) {
        var bucket = g.at >= a0 && g.at < lastDay ? recent : (g.at >= b0 && g.at < a0 ? before : null);
        if (!bucket) return;
        g.tags.forEach(function (id) { var c = catOf(id); if (c === 'trouble' || c === 'use') bucket[id] = (bucket[id] || 0) + 1; });
      });
      Object.keys(recent).forEach(function (id) { var d = recent[id] - (before[id] || 0); if (d >= 3) rising.push({ id: id, label: label(id), now: recent[id], prev: before[id] || 0, diff: d }); });
      rising.sort(function (a, b) { return b.diff - a.diff; });
    }

    // ---- 気づき（ことばで）
    var insights = [];
    function p100(x) { return Math.round(x * 100) + '%'; }
    if (n) {
      if (byCat.trouble[0]) insights.push({ k: 'trouble', text: 'いちばん多い困りごとは「' + byCat.trouble[0].label + '」です（' + byCat.trouble[0].n + '回・全体の' + p100(byCat.trouble[0].share) + '）。' + (byCat.trouble[1] ? '次は「' + byCat.trouble[1].label + '」（' + byCat.trouble[1].n + '回）。' : '') });
      if (areas[0]) insights.push({ k: 'area', text: '困りごとをまとまりで見ると「' + areas[0].label + '」が' + p100(areas[0].share) + 'の回で選ばれています。' });
      if (byCat.use[0]) insights.push({ k: 'use', text: 'いちばん作りたいものは「' + byCat.use[0].label + '」です（' + byCat.use[0].n + '回）。' + (byCat.use[1] ? '次は「' + byCat.use[1].label + '」（' + byCat.use[1].n + '回）。' : '') });
      if (pairs[0] && pairs[0].n >= 2) insights.push({ k: 'pair', text: 'よく一緒に選ばれる組み合わせ：「' + pairs[0].bl + '」×「' + pairs[0].al + '」（' + pairs[0].n + '回）。講座の例題にすると響きやすい組み合わせです。' });
      if (hardTroubles[0] && hardTroubles[0].bad > 0) insights.push({ k: 'hard', text: '「いまいち」が多い困りごと：「' + hardTroubles[0].label + '」（評価' + hardTroubles[0].rated + '回のうち いまいち ' + hardTroubles[0].bad + '回）。指示文だけでは解決しにくいので、講座で手順を見せると効果的です。' });
      if (rising[0]) insights.push({ k: 'rising', text: '最近ふえているもの：「' + rising[0].label + '」（直近7日 ' + rising[0].now + '回、その前の7日 ' + rising[0].prev + '回）。' });
      if (byCat.tool[0]) insights.push({ k: 'tool', text: '使うAIは ' + byCat.tool.slice(0, 3).map(function (x) { return x.label + ' ' + p100(x.share); }).join('・') + '。' });
      if (newWords.length) insights.push({ k: 'words', text: '自由記述に何度も出てくるのに、タグにない言葉：' + newWords.slice(0, 5).map(function (x) { return '「' + x.w + '」'; }).join('') + '。新しいタグの候補です。' });
      insights.push({ k: 'copy', text: '処方箋を出した回のうち、指示文がコピーされたのは ' + p100(kpi.copyRate) + (kpi.rated ? '。評価があった ' + kpi.rated + '回のうち「うまくいった」は ' + p100(kpi.goodRate) + '。' : '。') });
    }

    return { gens: gens, n: n, kpi: kpi, byCat: byCat, areas: areas, withTrouble: withTrouble, daily: daily,
      matrix: { rows: tops, cols: topu, cells: cells }, pairs: pairs.slice(0, 12), texts: list, words: words.slice(0, 40), newWords: newWords.slice(0, 20),
      hardTroubles: hardTroubles.slice(0, 8), rising: rising.slice(0, 8), insights: insights };
  }

  // ------------------------------------------------------------ CSV（Excel で開けるよう BOM つき）
  function csvCell(v) {
    var s = v == null ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;           // 表計算ソフトで式として動かないように
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function toCsv(header, rows) {
    return '﻿' + [header].concat(rows).map(function (r) { return r.map(csvCell).join(','); }).join('\r\n') + '\r\n';
  }
  function jstText(t) { var d = new Date(t + JST); return d.toISOString().slice(0, 16).replace('T', ' '); }
  function gensCsv(gens) {
    var head = ['日時（日本時間）', '講座コード', 'つくりかた', '使うAI', 'おためし', '困っていること（タグ）', '作りたいもの（タグ）', 'そのほかのタグ', '描きたいもの・直したいこと', '困っていること（自由記述）', '入れたい文字', 'コピー', '評価', 'いまいちの声', '端末の番号'];
    var rows = gens.map(function (g) {
      var tr = [], us = [], other = [];
      g.tags.forEach(function (id) { var c = catOf(id); (c === 'trouble' ? tr : c === 'use' ? us : other).push(label(id)); });
      return [jstText(g.at), g.cohort, g.mode === 'edit' ? '直す' : '作る', label(g.tool), g.preset ? (TAGS.PRESETS.filter(function (p) { return p.id === g.preset; })[0] || {}).label || g.preset : '',
        tr.join('／'), us.join('／'), other.join('／'), g.wish, g.trouble, g.title, g.copies.length ? 'あり' : '', g.rating === 1 ? 'うまくいった' : g.rating === -1 ? 'いまいち' : '',
        g.comments.map(function (c) { return c.text; }).join('／'), g.visitor.slice(0, 8)];
    });
    return toCsv(head, rows);
  }
  function tagsCsv(sum) {
    var head = ['種類', 'タグ', '回数', '割合（処方箋を出した回のうち）', '評価された回', 'いまいち'];
    var rows = [];
    TAGS.CATEGORIES.forEach(function (c) {
      (sum.byCat[c.id] || []).forEach(function (x) { rows.push([c.label, x.label, x.n, (x.share * 100).toFixed(1) + '%', x.rated, x.bad]); });
    });
    (sum.byCat.unknown || []).forEach(function (x) { rows.push(['（今はないタグ）', x.label, x.n, (x.share * 100).toFixed(1) + '%', x.rated, x.bad]); });
    return toCsv(head, rows);
  }

  return { AREA: AREA, jstDay: jstDay, dayStart: dayStart, prepare: prepare, filterGens: filterGens, summarize: summarize, tokens: tokens, norm: norm, gensCsv: gensCsv, tagsCsv: tagsCsv, csvCell: csvCell };
});

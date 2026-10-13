/*
 * 管理画面の「見本データで見る」用の、架空の記録を作る（実在の人・発言ではありません）。
 * 乱数の種を固定しているので、毎回同じ見本になる。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./tags.js'));
  else root.GP_SAMPLE = factory(root.GP_TAGS);
})(typeof self !== 'undefined' ? self : this, function (TAGS) {
  'use strict';

  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function uuidFrom(r) {
    var h = '';
    for (var i = 0; i < 32; i++) h += Math.floor(r() * 16).toString(16);
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-4' + h.slice(13, 16) + '-a' + h.slice(17, 20) + '-' + h.slice(20, 32);
  }
  function pickW(r, table) {
    var sum = 0, k;
    for (k in table) sum += table[k];
    var x = r() * sum;
    for (k in table) { x -= table[k]; if (x <= 0) return k; }
    return k;
  }
  function pickSome(r, table, min, max) {
    var n = min + Math.floor(r() * (max - min + 1)), out = [], tries = 0;
    while (out.length < n && tries++ < 40) { var k = pickW(r, table); if (out.indexOf(k) < 0) out.push(k); }
    return out;
  }

  var USES = { 'u-newsletter': 30, 'u-slides': 24, 'u-worksheet': 14, 'u-poster': 12, 'u-youtube': 9, 'u-blog': 9, 'u-sns': 10, 'u-material': 9, 'u-class-character': 8,
    'u-icon': 6, 'u-newyear': 5, 'u-manga': 7, 'u-event': 5, 'u-flyer': 6, 'u-logo': 4, 'u-picture-book': 4, 'u-certificate': 3, 'u-photo-to-illust': 3, 'u-diagram': 4, 'u-stamp': 2, 'u-cover': 3 };
  var TROUBLES = { 't-text-broken': 30, 't-chara-consistency': 22, 't-not-as-imagined': 20, 't-hands': 17, 't-partial-edit': 15, 't-ignored': 12, 't-what-to-write': 11,
    't-inconsistent-style': 10, 't-too-busy': 7, 't-copyright': 9, 't-ratio-wrong': 8, 't-count-wrong': 7, 't-not-japanese': 6, 't-age-wrong': 6, 't-same-face': 4, 't-famous-style': 5,
    't-want-text': 6, 't-ai-look': 4, 't-worse-each-time': 5, 't-want-transparent': 4, 't-school-rules': 5, 't-child-photo': 3, 't-limit': 4, 't-accuracy': 3, 't-layout': 4, 't-english': 2 };
  var STYLES = { 'st-clipart': 22, 'st-handdrawn': 20, 'st-watercolor': 12, 'st-flat': 12, 'st-anime': 9, 'st-3d': 7, 'st-picture-book': 8, 'st-photo': 6, 'st-line-art': 6, 'st-chibi': 4, 'st-colored-pencil': 4, 'st-paper-cut': 3, 'st-anime-film': 3 };
  var MOODS = { 'm-cheerful': 18, 'm-warm': 16, 'm-cute': 14, 'm-fun': 9, 'm-calm': 6, 'm-fresh': 5, 'm-trust': 4, 'm-cool': 3, 'm-humor': 3 };
  var COLORS = { 'c-pastel': 14, 'c-vivid': 8, 'c-mono': 5, 'c-warm': 4, 'c-few': 4, 'c-muted': 3 };
  var SCENES = { 's-sports-day': 10, 's-lesson': 10, 's-discussion': 7, 's-lunch': 6, 's-experiment': 6, 's-tablet': 6, 's-graduation': 5, 's-entrance': 5, 's-school-trip': 4, 's-autumn': 6,
    's-christmas': 3, 's-halloween': 4, 's-math': 4, 's-english': 3, 's-cleaning': 2, 's-recess': 3, 's-festival': 3, 's-moral': 2 };
  var RATIOS = { 'r-16-9': 12, 'r-1-1': 9, 'r-4-3': 7, 'r-a4-v': 5, 'r-9-16': 2, 'r-postcard-v': 2 };
  var PEOPLE = { 'p-elem-low': 9, 'p-elem-high': 7, 'p-junior-high': 6, 'p-teacher': 6, 'p-diverse': 3, 'p-japanese': 4, 'p-animal-chara': 3, 'p-none': 2, 'p-uniform': 2, 'p-gym': 2 };
  var TOOLS = { 'ai-chatgpt': 45, 'ai-gemini': 28, 'ai-canva': 12, 'ai-copilot': 7, 'ai-firefly': 3, 'ai-midjourney': 2, 'ai-other': 3 };
  var CHANGES = { 'e-hands': 10, 'e-face': 6, 'e-text-fix': 8, 'e-text-remove': 6, 'e-background': 6, 'e-color': 4, 'e-count': 3, 'e-size': 3, 'e-remove': 3 };
  var KEEPS = { 'k-face': 8, 'k-composition': 7, 'k-style': 6, 'k-colors': 3 };

  var WISHES = ['運動会でリレーをしている子どもたち', '給食をおいしそうに食べている小学生', '理科の実験でびっくりしている中学生', '学級目標「笑顔あふれるクラス」に合う絵',
    'クラスTシャツのデザイン案', 'クラスTシャツに入れるキャラクター', '卒業アルバムの表紙のイメージ', '朝の会で発表している子', 'タブレットで調べ学習をしている様子',
    '百人一首大会のポスター', '算数の図形の問題に使う、ピザを分ける絵', '英語の授業で自己紹介している場面', '秋の読書週間のポスター', '避難訓練で机の下にかくれる子どもたち',
    'ハロウィンの学級通信の飾り', '修学旅行で京都のお寺をめぐる中学生', '学習発表会の劇の背景', 'プログラミングでロボットを動かす子', '保護者会のお知らせに添える絵',
    '先生がひらめいた顔をしているYouTubeサムネ', 'ブログ「宿題を出さない数学」のアイキャッチ', '漫画の吹き出しつきの4コマで、手洗いの大切さ', '学級のマスコット（ひよこ）',
    'クラスのマスコットを同じ顔でいろいろなポーズに', '年賀状のひつじ', 'クリスマス会の招待状', '音楽会で合唱している子どもたち', '図書室の新着本コーナーの看板', '道徳の教材で、友だちに声をかける場面',
    '漫画の吹き出しに先生のセリフを入れたい', 'スライドの背景に使えるやさしい模様', '朝の会で使う天気のアイコン', '面談の案内に添える落ち着いた絵', '職員室のコーヒーコーナーの貼り紙',
    'SDGsの授業で地球を守るイメージ', 'クラスTシャツの背中のデザイン', '卒業アルバムの寄せ書きページの飾り', '部活動（バスケ部）の募集ポスター'];
  var EDIT_WISHES = ['右の男の子の手を自然にしたい', '文字を「うんどうかい」に直したい', '背景だけ夕焼けの校庭にしたい', '人数を4人から3人に減らしたい', '顔はそのままで服を体操服に', '変な英語の文字を消したい'];
  var TROUBLE_TEXTS = ['子どもを描くと、毎回大人っぽくなってしまう', '日本の教室なのに外国の教室みたいになる', '同じキャラで2枚目を作ると顔が変わる', '漫画の吹き出しの文字がでたらめになる',
    'クラスTシャツ用に線をはっきりさせたいのに、ぼやける', '直してと頼むと、ほかのところまで変わる', '白黒で印刷すると何が描いてあるかわからない', '無料だとすぐ上限になる',
    '学校で使ってよいのか、ルールがわからない', 'ひらがなの文字が崩れる', '有名なキャラに似てしまう気がして不安', '卒業アルバムに使えるか著作権が心配', 'プロンプトを考えるのに時間がかかる'];
  var COMMENTS = ['やっぱり文字が崩れた', 'キャラの顔が2枚目で変わった', '手は直ったけど顔が変わった', '日本っぽくはなったが、子どもが大人びている', '吹き出しの文字が読めない',
    'Geminiだと横長にならなかった', '線画にしたのに色が少しついた', 'クラスTシャツ用にはまだ線が細い'];
  var TITLES = ['うんどうかい', '3年2組', 'がっきゅうつうしん', '読書の秋', 'Happy Halloween', '卒業おめでとう', '学年だより'];

  function make(opt) {
    opt = opt || {};
    var r = rng(opt.seed || 20261013);
    var now = opt.now || Date.now();
    var days = opt.days || 28;
    var total = opt.gens || 640;
    var visitors = [];
    for (var i = 0; i < Math.round(total / 3.6); i++) visitors.push(uuidFrom(r));
    // 公式LINE から開いた人（見本の名前。架空）：7割の端末を、だれかの LINE に結びつける
    var NAMES = ['さくら', 'ゆう', 'みほ', 'たける', 'あおい', 'けんじ', 'なな', 'しょう', 'りか', 'だいき', 'まい', 'こうへい', 'ちひろ', 'ひろし', 'あや', 'ゆうた', 'えみ', 'りょう', 'かな', 'しん'];
    var lineOf = {};
    visitors.forEach(function (v, k) {
      if (r() < 0.7) {
        var hex = ''; for (var j = 0; j < 32; j++) hex += Math.floor(r() * 16).toString(16);
        lineOf[v] = { id: 'U' + hex, name: NAMES[k % NAMES.length] + (r() < 0.5 ? '先生' : '') + '（見本' + (k + 1) + '）' };
      }
    });
    var rows = [];
    var id = 1;
    var start = now - days * 86400000;
    // 講座の日（2回）にどっと増え、そのあと少しずつ減る
    var peaks = [start + 3 * 86400000, start + 17 * 86400000];
    function when() {
      var p = peaks[r() < 0.48 ? 0 : 1];
      var t = p + Math.pow(r(), 2.2) * (days * 86400000 * 0.55) + (r() - 0.5) * 3 * 3600000;
      var hour = 8 + Math.floor(r() * 14);
      var d = new Date(Math.min(t, now - 60000));
      d.setHours(hour, Math.floor(r() * 60), Math.floor(r() * 60));
      return Math.min(d.getTime(), now - 60000);
    }
    for (var g = 0; g < total; g++) {
      var at = when();
      var gen = uuidFrom(r);
      var v = visitors[Math.floor(Math.pow(r(), 1.3) * visitors.length)];
      var cohort = at < peaks[1] - 86400000 ? 'kouza-1108' : 'kouza-1122';
      if (r() < 0.08) cohort = '';
      var mode = r() < 0.14 ? 'edit' : 'new';
      var tags = [], preset = null, wish = null, trouble = null, title = null;
      var tool = pickW(r, TOOLS);
      if (mode === 'new' && r() < 0.14) {
        var pr = TAGS.PRESETS.filter(function (p) { return p.mode === 'new'; });
        var p = pr[Math.floor(r() * pr.length)];
        preset = p.id; tags = p.tags.slice(); wish = p.wish || null; title = p.title || null;
      } else if (mode === 'new') {
        tags = tags.concat(pickSome(r, USES, 1, r() < 0.2 ? 2 : 1));
        if (r() < 0.78) tags = tags.concat(pickSome(r, TROUBLES, 1, 3));
        if (r() < 0.75) tags = tags.concat(pickSome(r, STYLES, 1, 2));
        if (r() < 0.6) tags = tags.concat(pickSome(r, MOODS, 1, 2));
        if (r() < 0.35) tags = tags.concat(pickSome(r, COLORS, 1, 1));
        if (r() < 0.55) tags = tags.concat(pickSome(r, SCENES, 1, 2));
        if (r() < 0.55) tags.push(pickW(r, RATIOS));
        if (r() < 0.5) tags = tags.concat(pickSome(r, PEOPLE, 1, 2));
        if (r() < 0.62) wish = WISHES[Math.floor(r() * WISHES.length)];
        if (r() < 0.16) trouble = TROUBLE_TEXTS[Math.floor(r() * TROUBLE_TEXTS.length)];
        if (tags.indexOf('t-want-text') >= 0 || tags.indexOf('t-text-broken') >= 0 ? r() < 0.5 : r() < 0.05) title = TITLES[Math.floor(r() * TITLES.length)];
      } else {
        tags = pickSome(r, CHANGES, 1, 2).concat(pickSome(r, KEEPS, 1, 2));
        tags = tags.concat(r() < 0.7 ? ['t-partial-edit'] : []).concat(r() < 0.4 ? pickSome(r, { 't-hands': 4, 't-text-broken': 4, 't-worse-each-time': 3, 't-face-broken': 2 }, 1, 1) : []);
        if (r() < 0.6) wish = EDIT_WISHES[Math.floor(r() * EDIT_WISHES.length)];
      }
      tags.push(tool);
      tags = tags.filter(function (x, i2, a) { return TAGS.byId(x) && a.indexOf(x) === i2; }).sort();
      var lu = lineOf[v] || null;
      rows.push({ id: id++, created_at: new Date(at).toISOString(), kind: 'generate', visitor_id: v, gen_id: gen, cohort: cohort, mode: mode, tool: tool, preset: preset,
        tags: tags, wish: wish, trouble: trouble, title_text: title, part: null, rating: null, client: r() < 0.55 ? 'phone' : 'pc',
        line_user_id: lu ? lu.id : null, line_name: lu ? lu.name : null });
      if (r() < 0.68) rows.push({ id: id++, created_at: new Date(Math.min(at + 40000, now - 1000)).toISOString(), kind: 'copy', visitor_id: v, gen_id: gen, cohort: cohort, part: r() < 0.8 ? 'v-full' : 'v-short', tags: [] });
      if (r() < 0.12) rows.push({ id: id++, created_at: new Date(Math.min(at + 300000, now - 1000)).toISOString(), kind: 'copy', visitor_id: v, gen_id: gen, cohort: cohort, part: 'fix-0', tags: [] });
      if (r() < 0.3) {
        var hard = tags.indexOf('t-text-broken') >= 0 || tags.indexOf('t-chara-consistency') >= 0;
        var rating = r() < (hard ? 0.5 : 0.75) ? 1 : -1;
        rows.push({ id: id++, created_at: new Date(Math.min(at + 600000, now - 1000)).toISOString(), kind: 'feedback', visitor_id: v, gen_id: gen, cohort: cohort, rating: rating, tags: [] });
        if (rating === -1 && r() < 0.45) rows.push({ id: id++, created_at: new Date(Math.min(at + 660000, now - 1000)).toISOString(), kind: 'feedback', visitor_id: v, gen_id: gen, cohort: cohort, trouble: COMMENTS[Math.floor(r() * COMMENTS.length)], tags: [] });
      }
    }
    rows.sort(function (a, b) { return Date.parse(a.created_at) - Date.parse(b.created_at); });
    rows.forEach(function (x, i3) { x.id = i3 + 1; });
    return rows;
  }

  return { make: make };
});

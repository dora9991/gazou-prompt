/*
 * 画像生成プロンプト処方箋 ― 指示文（プロンプト）を組み立てる
 * 画面にも通信にも触らない「純粋な関数」だけ。Node でもそのまま試せる（tests/unit）。
 *
 *   GP_ENGINE.build({ mode, tags, wish, trouble, title, tool }, { now })
 *     mode    'new'（新しく作る）| 'edit'（できた画像を直す）
 *     tags    選んだタグの id の配列（使うAIのタグも含めてよい）
 *     wish    描いてほしいもの（直すときは「どう直したいか」）
 *     trouble ほかに困っていること（自由記述）
 *     title   画像に入れる文字
 *     tool    使うAIのタグ id（tags の中にあれば省略可）
 *   → { versions:[{id,label,text,note}], recommended, fixes:[{label,text}], tips:[{text,from}], notes:[], picked:[] }
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./tags.js'));
  else root.GP_ENGINE = factory(root.GP_TAGS);
})(typeof self !== 'undefined' ? self : this, function (TAGS) {
  'use strict';

  // ------------------------------------------------------------ 使うAIごとの違い（2026年10月に各社の公式ヘルプで確かめた内容）
  // kind:    chat＝会話で頼むAI（見出しつきの指示文が通る）／box＝入力欄に入れるAI（1段落にまとめる）／en＝英語のAI
  // ratios:  作れる縦横比（'*' はどれでも）。ここにない比率を選んだら、いちばん近い形で頼み、切り取りをすすめる
  // inUI:    比率は画面の設定で選ぶ（指示文には書かない）
  // ratioTip 比率を選んだときに添える一言／mismatch 作れない比率のときの一言（{want}{near}）
  // noVerb:  「作って」などの動詞を書かない（Firefly の公式のコツ）
  var TOOLS = {
    'ai-chatgpt': { label: 'ChatGPT', kind: 'chat', open: '次の内容で、画像を1枚作ってください。',
      ratios: ['*'],
      ratioTip: 'ChatGPT は、画面の比率ボタンで選ぶか、指示文に書いた比率で作れます。できたあと、エディタの「縦横比」で作り直すこともできます。',
      tips: ['一部だけ直したいときは、画像を開いて「選択」で直したいところをなぞってから指示すると、ほかが変わりにくくなります。',
        '直すときは、1回に1つずつ。「ほかは変えないで」を毎回書くと、崩れにくくなります。'] },
    'ai-gemini': { label: 'Gemini', kind: 'chat', open: '次の内容で、画像を1枚作成してください。',
      ratios: ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'],
      ratioTip: 'Gemini では、縦横の比率は指示文で伝えます。画像を添えるとその画像の形に引っぱられるので、ずれるときは、作りたい形の白い画像を添えて「この白い画像の形で描いて」と頼みましょう。',
      mismatch: 'Gemini では {want} の形は作れないので、近い「{near}」で頼むようにしました。あとで切り取って使いましょう。',
      tips: ['Gemini は、できた画像を会話で少しずつ直すのが得意です。「〇〇だけ変えて。ほかはそのまま」と続けて頼みましょう。',
        '「〜しないで」より「〜にして」と、してほしいことを書くほうが伝わります。'] },
    'ai-copilot': { label: 'Microsoft Copilot', kind: 'chat', open: '次の内容で、画像を1枚作成してください。',
      ratios: ['1:1', '3:2', '2:3'],
      mismatch: 'Copilot（Microsoft 365 の「作成」）で選べる形は、正方形・横長（3:2）・縦長（2:3）です。{want} にしたいときは、近い「{near}」で作って、あとで切り取りましょう。',
      tips: ['画像の中の日本語の文字は、崩れたり英語になったりすることがあります。文字は PowerPoint などで、あとから入れるのが確実です。'] },
    'ai-canva': { label: 'Canva', kind: 'box', inUI: true,
      ratios: ['*'],
      ratioTip: 'Canva では、縦横の比率（{want}）とスタイルを、画面の設定で選んでください。指示文に書くより確実です。',
      tips: ['小中高の先生は、無料の「Canva 教育版」を使うと、個人の無料プランより AI を使える回数にゆとりがあります。',
        '文字は画像に入れず、Canva の文字機能で重ねるのが確実です。',
        '一部だけ直すときは「マジック加工」で、直したいところをブラシで塗ってから指示します。'] },
    'ai-firefly': { label: 'Adobe Firefly', kind: 'box', inUI: true, noVerb: true, maxChars: 1000,
      ratios: ['1:1', '4:3', '3:4', '16:9', '9:16'],
      ratioTip: 'Firefly では、縦横比（{want}）とスタイルを、画面の設定で選んでください（指示文には書きません）。',
      mismatch: 'Firefly で選べる縦横比に {want} はありません。近い「{near}」で作って、あとで切り取りましょう。',
      tips: ['Firefly は、日本語の指示を英語に直してから読みます。思った絵にならないときは、言い方を変えてみましょう。',
        '画像の中の文字は崩れやすいので、文字なしで作って、あとから入れましょう。',
        '一部だけ直すときは「生成塗りつぶし」で、直したいところを塗ってから指示します。'] },
    'ai-midjourney': { label: 'Midjourney', kind: 'en',
      ratios: ['*'],
      tips: ['Midjourney は英語の短い指示がいちばん伝わります。「英語にしてもらう版」を ChatGPT などに貼ると、英語の指示文を作ってくれます。',
        '同じキャラクターを描くときは、画像を添えて（Attach to prompt）頼みます。画風をそろえるには --sref を使います。'] },
    'ai-other': { label: 'そのほか', kind: 'chat', open: '次の内容で、画像を1枚作ってください。', ratios: ['*'], tips: [] }
  };
  var DEFAULT_TOOL = 'ai-other';

  // いちばん近い縦横比（比の対数の差で比べる）
  function nearest(ar, list) {
    var p = String(ar).split(':').map(Number), want = p[0] / p[1], best = null, bd = Infinity;
    list.forEach(function (x) {
      var q = x.split(':').map(Number), d = Math.abs(Math.log((q[0] / q[1]) / want));
      if (d < bd) { bd = d; best = x; }
    });
    return best;
  }
  function arLabel(ar) {
    var p = String(ar).split(':').map(Number);
    return (p[0] > p[1] ? '横長' : p[0] < p[1] ? '縦長' : '正方形') + '（' + ar + '）';
  }

  // 干支：7月からは次の年の干支（年賀状を作る時期に合わせる）
  var ETO = ['ねずみ（子）', 'うし（丑）', 'とら（寅）', 'うさぎ（卯）', 'たつ（辰）', 'へび（巳）', 'うま（午）', 'ひつじ（未）', 'さる（申）', 'とり（酉）', 'いぬ（戌）', 'いのしし（亥）'];
  function eto(now) {
    var d = now instanceof Date ? now : new Date();
    var y = d.getMonth() >= 6 ? d.getFullYear() + 1 : d.getFullYear();
    return { year: y, animal: ETO[((y - 2020) % 12 + 12) % 12] };
  }

  // ------------------------------------------------------------ 小さな道具
  function uniq(list) {
    var seen = {}, out = [];
    list.forEach(function (x) { if (x && !seen[x]) { seen[x] = 1; out.push(x); } });
    return out;
  }
  function clean(s, max) {
    s = String(s == null ? '' : s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').replace(/\r\n?/g, '\n').trim();
    return max ? s.slice(0, max) : s;
  }
  function noParen(s) { return String(s || '').replace(/（[^）]*）/g, '').trim(); }
  function endDot(s) { s = String(s || '').trim(); return !s || /[。！？」）]$/.test(s) ? s : s + '。'; }
  function bullets(list) { return list.map(function (x) { return '・' + x; }).join('\n'); }
  function section(title, body) { return body ? '【' + title + '】\n' + body : ''; }
  function join(parts) { return parts.filter(Boolean).join('\n\n'); }
  var PLACEHOLDER = /〔[^〕]*〕/;

  // ------------------------------------------------------------ 本体
  function build(input, opts) {
    input = input || {};
    opts = opts || {};
    var mode = input.mode === 'edit' ? 'edit' : 'new';
    var wish = clean(input.wish, 400);
    var trouble = clean(input.trouble, 400);
    var title = clean(input.title, 80).replace(/\n+/g, ' ');

    // 選んだタグを、種類ごとに分ける（いまのモードで使わない種類は無視する）
    var ids = uniq((input.tags || []).map(String));
    var picked = ids.map(TAGS.byId).filter(Boolean).filter(function (t) {
      var cat = TAGS.CAT[t.cat];
      return cat && cat.modes.indexOf(mode) >= 0;
    });
    var by = {};
    picked.forEach(function (t) { (by[t.cat] = by[t.cat] || []).push(t); });
    function list(cat) { return by[cat] || []; }
    function first(cat) { return list(cat)[0] || null; }

    var toolId = input.tool && TOOLS[input.tool] ? input.tool : (first('tool') ? first('tool').id : DEFAULT_TOOL);
    var tool = TOOLS[toolId] || TOOLS[DEFAULT_TOOL];
    var flags = {};
    picked.forEach(function (t) { (t.flags || []).forEach(function (f) { flags[f] = true; }); });

    // 比率：選んだもの → なければ使い道のおすすめ
    var ratio = first('ratio');
    var ratioSuggested = false;
    if (!ratio) {
      var u = list('use').filter(function (x) { return x.ratio; })[0];
      if (u && mode === 'new') { ratio = TAGS.byId(u.ratio); ratioSuggested = !!ratio; }
    }

    var notes = [];
    var tips = [];
    var fixes = [];
    function addTips(t, from) { (t.tips || []).forEach(function (x) { tips.push({ text: x, from: from }); }); }

    // 指示文に書く比率：その AI が作れない形なら、いちばん近い形にする
    var ratioText = '', ratioAr = '';
    if (ratio) {
      ratioText = ratio.ja; ratioAr = ratio.ar;
      if (ratioSuggested) notes.push('縦横の比率は、使い道に合わせて「' + ratio.label + '」にしました（変えるときは「縦横の比率」で選べます）。');
      if (tool.ratios.indexOf('*') < 0 && tool.ratios.indexOf(ratio.ar) < 0) {
        var near = nearest(ratio.ar, tool.ratios);
        ratioAr = near;
        ratioText = arLabel(near) + '（' + noParen(ratio.label) + 'に近い形）';
        if (tool.mismatch) notes.push(tool.mismatch.replace('{want}', ratio.label).replace('{near}', arLabel(near)));
      }
      if (tool.ratioTip) notes.push(tool.ratioTip.replace('{want}', ratioAr !== ratio.ar ? arLabel(ratioAr) : ratio.label));
    }

    // 困りごとの「気をつけてほしいこと」
    var rules = [];
    list('trouble').forEach(function (t) { (t.rules || []).forEach(function (r) { rules.push(r); }); });
    if (title) {
      rules = rules.filter(function (r) { return r.indexOf('文字・数字・ロゴ') < 0; });
    }
    if (trouble) rules.push('次のことで困っています。特に気をつけてください：' + trouble);
    rules = uniq(rules);

    var versions = [];
    var recommended = 'full';

    if (mode === 'new') {
      // ---- 描くもの
      var scenes = list('scene');
      var subject = [];
      if (wish) subject.push(endDot(wish));
      scenes.forEach(function (s) { subject.push((wish ? '・場面：' : '・') + s.ja); });
      if (!wish && !scenes.length) subject.push('〔ここに描いてほしいものを書く（例：運動会でリレーをしている子どもたち）〕');

      // ---- 使い道
      var uses = list('use');
      var useRules = [];
      uses.forEach(function (x) { (x.rules || []).forEach(function (r) { useRules.push(r); }); });
      if (uses.some(function (x) { return x.id === 'u-newyear'; })) {
        var e = eto(opts.now);
        useRules.push('干支を入れる場合は、' + e.year + '年の「' + e.animal + '」をかわいらしく');
      }
      useRules = uniq(useRules);

      // ---- タッチ・雰囲気・色
      var styles = list('style'), moods = list('mood'), colors = list('color');
      var styleText = styles.map(function (x) { return x.ja; }).join('／');
      if (styles.length > 1) styleText += '（これらを組み合わせて）';
      var moodText = moods.length ? moods.map(function (x) { return noParen(x.ja); }).join('、') + '雰囲気' : '';
      var moodDetail = moods.map(function (x) { var m = /（([^）]*)）/.exec(x.ja); return m ? m[1] : ''; }).filter(Boolean);
      var colorText = colors.map(function (x) { return x.ja; }).join('、');

      // ---- 構図・サイズ
      var comp = [];
      if (ratio && !tool.inUI) comp.push('縦横の比率：' + ratioText);
      list('frame').forEach(function (x) { comp.push(x.ja); });
      var bg = first('bg');
      if (bg) comp.push(bg.ja);

      // ---- 登場人物
      var ppl = list('people').map(function (x) { return x.ja; });
      var cnt = first('count');
      var noPeople = list('people').some(function (x) { return x.id === 'p-none'; });
      if (cnt && !noPeople) ppl.push('人数：' + (flags.priority || ids.indexOf('t-count-wrong') >= 0 ? 'ちょうど' : '') + cnt.ja);

      // ---- 添えるもの
      var opt = list('option').filter(function (x) { return x.ja; }).map(function (x) { return x.ja; });
      if (flags.ref && !opt.length) opt.push('添付した画像を参考に（〔構図・人物・雰囲気など、いかしたいところ〕をいかす）');

      // ---- 文字
      var margin = list('frame').filter(function (x) { return /^f-margin-/.test(x.id); })[0];
      var textRule = title
        ? '「' + title + '」という文字だけを、' + (margin ? '文字用に空けた余白の部分' : '画面の上の方') + 'に入れてください（一字一字正確に。太めの読みやすいゴシック体で、はっきり大きく）。ほかの文字は入れないでください。'
        : '文字のない、絵だけの画像にしてください（文字はあとから自分で入れます）。';

      // ---- キャラクター設定
      var charsheet = flags.charsheet ? bullets(['名前：〔　〕', '年齢・体つき：〔　〕', '髪型・髪の色：〔　〕', '服装と色：〔　〕', '持ち物・特徴：〔　〕']) : '';

      // ---- 大事な順
      var prio = [];
      if (flags.priority) {
        prio.push('描くもの：' + (wish ? noParen(wish).slice(0, 40) : scenes.length ? scenes.map(function (s) { return s.label; }).join('・') : '〔描いてほしいもの〕'));
        if (uses.length) prio.push('使い道：' + uses.map(function (x) { return x.label; }).join('・'));
        if (styles.length) prio.push('タッチ：' + styles.map(function (x) { return x.label; }).join('・'));
        else if (moods.length) prio.push('雰囲気：' + moods.map(function (x) { return x.label; }).join('・'));
      }

      var closing = uses.length ? '条件どうしがぶつかるときや、あいまいなところは、【使い道】に合うように判断してください。' : 'あいまいなところは、全体の雰囲気に合うように判断してください。';

      // ===== しっかり版
      var bodySections = [
        section('描いてほしいもの', subject.join('\n')),
        section('使い道', uses.length ? uses.map(function (x) { return x.ja; }).join('／') + (useRules.length ? '\n' + bullets(useRules) : '') : ''),
        section('絵のタッチ', styleText),
        section('雰囲気・色', [moodText ? moodText + (moodDetail.length ? '（' + moodDetail.join('、') + '）' : '') : '', colorText].filter(Boolean).map(endDot).join('')),
        section('構図・サイズ', comp.length ? bullets(comp) : ''),
        section('配置', ids.indexOf('t-layout') >= 0 ? '〔例：画面の左に先生、右に子どもたち、奥に黒板〕' : ''),
        section('登場人物', ppl.length ? bullets(ppl) : ''),
        section('キャラクター設定', charsheet),
        section('添付する画像について', opt.length ? bullets(opt) : ''),
        section('画像に入れる文字', textRule),
        section('特に気をつけてほしいこと', rules.length ? bullets(rules) : ''),
        section('いちばん大事なこと（この順で優先してください）', prio.length >= 2 ? prio.map(function (p, i) { return (i + 1) + '. ' + p; }).join('\n') : '')
      ];

      if (tool.kind === 'chat') {
        versions.push({ id: 'full', label: 'しっかり版', text: join([tool.open].concat(bodySections).concat([closing])) });
      } else if (tool.kind === 'box') {
        // 入力欄に入れるAI：見出しをやめて1段落に
        var para = [];
        para.push(endDot(wish || (scenes.length ? scenes.map(function (s) { return s.ja; }).join('。') : '〔ここに描いてほしいものを書く〕')));
        if (wish && scenes.length) para.push(endDot('場面は' + scenes.map(function (s) { return noParen(s.ja); }).join('、')));
        if (uses.length) para.push(endDot(uses.map(function (x) { return x.ja; }).join('、') + (useRules.length ? '。' + useRules.join('。') : '')));
        if (styleText) para.push(endDot(styleText));
        if (moodText) para.push(endDot(moodText));
        if (colorText) para.push(endDot(colorText));
        list('frame').forEach(function (x) { para.push(endDot(x.ja)); });
        if (bg) para.push(endDot(bg.ja));
        if (ppl.length) para.push(endDot('登場人物は' + ppl.join('、')));
        if (opt.length) para.push(endDot(opt.join('。')));
        para.push(title ? '文字は「' + title + '」だけを、正確に大きく入れる。' : '文字のない、絵だけの画像。');
        rules.forEach(function (r) { para.push(endDot(r)); });
        versions.push({ id: 'full', label: 'しっかり版', text: para.join('') });
      } else {
        // 英語のAI（Midjourney）
        var params = '--ar ' + (ratioAr || '1:1') + (title ? '' : ' --no text, letters, watermark');
        versions.push({ id: 'en-ask', label: '英語にしてもらう版', note: 'ChatGPT や Gemini に貼ると、Midjourney 用の英語の指示文を作ってくれます。',
          text: join(['次の条件を、Midjourney で使う英語のプロンプトにしてください。\n・英語で1行。短い言葉をカンマで区切って並べる\n・最後に「' + params + '」をつける\n・説明はいらないので、プロンプトだけを出してください',
            ].concat(bodySections)) });
        var en = [];
        en.push(wish ? '〔描くものを英語で：' + noParen(wish).slice(0, 60) + '〕' : scenes.length ? scenes.map(function (s) { return s.en; }).join(', ') : '〔描くものを英語で〕');
        uses.forEach(function (x) { if (x.en) en.push(x.en); });
        styles.forEach(function (x) { if (x.en) en.push(x.en); });
        moods.forEach(function (x) { if (x.en) en.push(x.en); });
        colors.forEach(function (x) { if (x.en) en.push(x.en); });
        list('frame').forEach(function (x) { if (x.en) en.push(x.en); });
        if (bg && bg.en) en.push(bg.en);
        list('people').forEach(function (x) { if (x.en) en.push(x.en); });
        if (cnt && !noPeople && cnt.en) en.push(cnt.en);
        if (title) {
          en.push('with the words "' + title + '"');
          if (/[^\x20-\x7e]/.test(title)) notes.push('Midjourney は、日本語の文字を画像に入れるのが苦手です。文字は、あとから Canva などで入れるのが確実です。');
        }
        versions.push({ id: 'en', label: '英語のキーワード版', note: '〔 〕のところを英語にしてから、Midjourney に貼ります。', text: uniq(en).join(', ') + ' ' + params });
        recommended = 'en-ask';
      }

      // ===== かんたん版
      var subj = wish ? noParen(wish).replace(/[。．.]$/, '') : scenes.length ? scenes.map(function (s) { return s.label; }).join('・') + 'の場面' : '〔描いてほしいもの〕';
      var styleSh = styles.map(function (x) { return x.sh || noParen(x.ja); }).join('と');
      var s1 = tool.noVerb
        ? subj + (styleSh ? '、' + styleSh : '') + '。'
        : subj + 'を、' + (styleSh ? styleSh + 'で' : '') + '描いてください。';
      var short = [s1];
      if (uses.length) short.push(uses.map(function (x) { return x.label; }).join('・') + 'に使います。');
      if (moodText || colorText) short.push([moodText, colors.map(function (x) { return x.sh || noParen(x.ja); }).join('・')].filter(Boolean).join('、') + 'で。');
      if (ratio && !tool.inUI) short.push('形は' + ratioText.replace(/（縦横の比は[^）]*）/, '') + '。');
      if (tool.kind !== 'en') short.push(title ? '文字は「' + title + '」だけを入れてください。' : (tool.noVerb ? '文字のない、絵だけの画像。' : '文字のない、絵だけの画像にしてください。'));
      if (tool.kind === 'en') {
        versions.push({ id: 'short', label: 'かんたん版（日本語）', note: '英語にしてから使います。', text: short.join('') });
      } else {
        versions.push({ id: 'short', label: 'かんたん版', text: short.join('') });
      }

      // ===== 質問してもらう版（会話できるAIだけ）
      var known = [];
      if (uses.length) known.push('使い道：' + uses.map(function (x) { return x.label; }).join('・'));
      if (wish) known.push('描きたいもの：' + noParen(wish).slice(0, 80));
      if (scenes.length) known.push('場面：' + scenes.map(function (s) { return s.label; }).join('・'));
      if (styles.length) known.push('タッチ：' + styles.map(function (x) { return x.label; }).join('・'));
      if (moods.length) known.push('雰囲気：' + moods.map(function (x) { return x.label; }).join('・'));
      if (ratio) known.push('形：' + ratio.label);
      if (title) known.push('入れたい文字：「' + title + '」');
      var troubleLabels = list('trouble').map(function (x) { return x.label; });
      if (troubleLabels.length || trouble) known.push('困っていること：' + troubleLabels.concat(trouble ? [trouble] : []).join('／'));
      var interview = join([
        'これから画像を作りたいので、手伝ってください。いきなり描かずに、まず私に質問をして、イメージを一緒に固めてください。',
        bullets(['質問は1回に3つまで。答えやすいように、選択肢もつけてください', '私の答えがそろったら、内容を短くまとめて確認してから、画像を作ってください']),
        'いま決まっていること：\n' + (known.length ? bullets(known) : '・まだ何も決まっていません')
      ]);
      if (tool.kind === 'chat') {
        versions.push({ id: 'interview', label: '質問してもらう版', note: 'AIが質問してくれるので、答えていくうちにイメージが固まります。', text: interview });
        if (flags.interview) recommended = 'interview';
        else if (flags.short) recommended = 'short';
      } else if (tool.kind === 'box') {
        if (flags.short) recommended = 'short';
        if (flags.interview) tips.push({ text: '質問しながらイメージを固めたいときは、ChatGPT や Gemini で「質問してもらう版」を使い、できた指示文を ' + tool.label + ' に貼る方法もあります。', from: tool.label });
      }

      // 長すぎて入らない AI
      if (tool.maxChars) {
        var fv = versions.filter(function (v) { return v.id === 'full'; })[0];
        if (fv && fv.text.length > tool.maxChars) {
          notes.push(tool.label + ' では、長い指示文は入りきらないことがあります（この指示文は ' + fv.text.length + ' 字）。入らないときは「かんたん版」を使いましょう。');
          recommended = 'short';
        }
      }
      if (title) tips.push({ text: '文字が崩れたときは、文字なしで作って、あとから Canva や PowerPoint で文字を重ねるのが確実です。', from: '画像に入れる文字' });
    } else {
      // ========================= できた画像を直す
      var changes = list('change'), keeps = list('keep');
      var changeLines = [];
      if (wish) changeLines.push(endDot(wish).replace(/。$/, ''));
      changes.forEach(function (c) {
        var line = c.ja;
        if (c.id === 'e-text-fix' && title) line = line.replace('〔正しい文字〕', title);
        if (c.id === 'e-size' && ratio) line = line.replace('〔縦横の比率〕', ratioText);
        changeLines.push(line);
      });
      if (!changeLines.length) changeLines.push('〔直したいところと、どう直したいか〕');
      var keepLines = keeps.map(function (k) { return k.ja; });
      keepLines.push('上に書いたところ以外も、できるだけ変えないでください');
      var extra = [];
      if (ratio && !changes.some(function (c) { return c.id === 'e-size'; })) extra.push('仕上がりの縦横の比率：' + ratioText);
      if (title && !changes.some(function (c) { return c.id === 'e-text-fix'; })) extra.push('文字は「' + title + '」だけにする（一字一字正確に）');

      var editFull = join([
        '添付した画像（または、直前に作った画像）を、次のように直してください。',
        section('直してほしいところ', bullets(changeLines)),
        section('そのままにしてほしいところ', bullets(keepLines)),
        section('仕上がり', extra.length ? bullets(extra) : ''),
        section('特に気をつけてほしいこと', rules.length ? bullets(rules) : '')
      ]);
      versions.push({ id: 'full', label: 'しっかり版', text: editFull });
      var editShort = 'この画像の、次のところだけを直してください：' + (changes.length ? changes.map(function (c) { return c.label; }).join('／') : '〔直したいところ〕') + '。' +
        (wish ? '直し方：' + endDot(noParen(wish)) : '') + (keeps.length ? keeps.map(function (k) { return k.label; }).join('／') + 'は変えないでください。' : 'ほかは変えないでください。');
      versions.push({ id: 'short', label: 'かんたん版', text: editShort });
      if (flags.short) recommended = 'short';
      if (tool.kind === 'en') tips.push({ text: 'Midjourney では、画像の「Editor」で直したい範囲を選び、そこに英語で指示を入れます。この指示文を ChatGPT などで英語にしてから使いましょう。', from: tool.label });
      if (tool.kind === 'box') tips.push({ text: tool.label + ' では、画像を選んで「編集」系の機能（消しゴム・生成塗りつぶし など）を使うと、一部だけ直せます。', from: tool.label });
    }

    // ------------------------------------------------------------ コツと追加の一言
    list('trouble').forEach(function (t) { addTips(t, t.label); (t.fixes || []).forEach(function (f) { fixes.push({ label: f.label, text: f.text, from: t.label }); }); });
    list('use').forEach(function (t) { addTips(t, t.label); });
    (tool.tips || []).forEach(function (x) { tips.push({ text: x, from: tool.label }); });
    if (mode === 'new') {
      fixes.push({ label: '雰囲気を変える', text: '描いてある内容はそのままで、全体をもっと〔明るく／シンプルに／やさしい色に〕してください。', from: '' });
      fixes.push({ label: '一部だけ変えた別案', text: 'この画像をもとに、〔変えたいところ〕だけを変えた別の案を作ってください。ほかは変えないでください。', from: '' });
    } else {
      fixes.push({ label: 'もう一度だけ直す', text: 'まだ〔直っていないところ〕が直っていません。ここだけ、もう一度直してください。ほかは変えないでください。', from: '' });
    }
    if (!tips.length) tips.push({ text: 'うまくいった指示文は、メモに保存しておくと次から使い回せます。', from: '' });

    // 同じ文は1回だけ
    var seenTip = {};
    tips = tips.filter(function (t) { if (seenTip[t.text]) return false; seenTip[t.text] = 1; return true; });
    var seenFix = {};
    fixes = fixes.filter(function (f) { if (seenFix[f.text]) return false; seenFix[f.text] = 1; return true; });

    var hasPh = versions.some(function (v) { return PLACEHOLDER.test(v.text); });
    if (hasPh) notes.unshift('〔 〕のところは、あなたの内容に書きかえてから貼りましょう。');
    if (!versions.some(function (v) { return v.id === recommended; })) recommended = versions[0].id;

    return {
      mode: mode,
      tool: toolId,
      toolLabel: tool.label,
      versions: versions,
      recommended: recommended,
      fixes: fixes,
      tips: tips,
      notes: notes,
      picked: picked.map(function (t) { return { id: t.id, label: t.label, cat: t.cat }; }),
      flags: flags
    };
  }

  return { build: build, TOOLS: TOOLS, eto: eto, PLACEHOLDER: PLACEHOLDER };
});

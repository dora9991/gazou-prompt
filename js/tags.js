/*
 * 画像生成プロンプト処方箋 ― タグの定義
 *
 * ここを書きかえると、タグを足したり、言い回しを変えたりできます。
 * ・id は記録（Supabase）に使います。いちど使い始めたら変えないでください（label は変えて大丈夫）。
 * ・id の形：英小文字・数字・ハイフンだけ（48文字まで）。頭の文字で種類がわかるようにしています。
 * ・〔 〕で囲んだところは「使う人が自分の内容に書きかえる場所」として画面で色がつきます。
 *
 * タグの中身（使うものだけ書く）
 *   label  画面に出す名前          kw     探すときの別の言い方（空白区切り）
 *   ja     プロンプトに入る文       en     英語のキーワード（Midjourney など英語向け）
 *   rules  「気をつけてほしいこと」に足す文
 *   tips   画面に出すコツ（プロンプトには入らない）
 *   fixes  うまくいかなかったときの「追加の一言」 { label, text }
 *   flags  特別な動き（priority=大事な順を足す／interview=質問してもらう版をすすめる／title=文字の欄を開く
 *          ref=参考画像の一文を足す／charsheet=キャラクター設定を足す／short=かんたん版を先に見せる／edit=直す用をすすめる）
 *   ratio  （使い道）比率を選んでいないときのおすすめ          ar  （比率）比率の表し方
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GP_TAGS = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VERSION = '2026-10-13';

  // ---------------------------------------------------------------- 作りたいもの（使い道）
  var USE = {
    id: 'use', label: '作りたいもの', q: '何に使う絵ですか？', hint: 'いくつでも', multi: true, modes: ['new'], color: 'teal',
    groups: [
      { id: 'school', label: '学校・授業', tags: [
        { id: 'u-newsletter', label: '学級通信・おたより', kw: '学年だより 保健だより 図書だより 給食だより お便り',
          ja: '学級通信・おたよりに載せる挿絵', ratio: 'r-4-3', en: 'simple illustration for a school newsletter',
          rules: ['白黒で印刷しても見やすいよう、輪郭線をはっきりさせ、色の濃さに差をつける', '小さく載せても何の絵かわかるよう、主役を大きく、シンプルに'] },
        { id: 'u-slides', label: '授業スライドの挿絵', kw: 'パワポ PowerPoint Googleスライド Keynote 授業',
          ja: '授業のスライドに入れる挿絵', ratio: 'r-16-9', en: 'illustration for a classroom slide',
          rules: ['スライドの文字のじゃまをしないよう、片側に余白を広くとる', '後ろの席からも見えるよう、形と色をはっきり'] },
        { id: 'u-worksheet', label: 'ワークシート・プリント', kw: 'プリント 小テスト 宿題 カット',
          ja: 'ワークシート・プリントに入れる小さなカット', ratio: 'r-1-1', en: 'small spot illustration for a worksheet, black and white',
          rules: ['白黒の線画にして、細かすぎる模様は入れない', '小さく印刷しても形がわかるように'] },
        { id: 'u-poster', label: '教室の掲示物', kw: '掲示 ポスター 壁面 学級目標',
          ja: '教室に貼る掲示物の絵', ratio: 'r-a4-v', en: 'classroom poster illustration, bold and clear',
          rules: ['遠くからでも目に入るよう、太い線とはっきりした色で', '背景はすっきりさせて、主役を目立たせる'] },
        { id: 'u-material', label: '教材の場面絵', kw: '物語 歴史 理科 社会 国語 場面 挿絵 教材',
          ja: '授業の教材として、場面や内容を伝える絵', en: 'educational illustration, accurate depiction',
          rules: ['内容が正しく伝わることを優先し、大げさな表現はひかえる', '学習に関係のない飾りは入れない'],
          tips: ['教材に使う前に、時代・道具・しくみなどが正しく描かれているか、教科書や資料集と見比べましょう。'] },
        { id: 'u-event', label: '行事のしおり・プログラム', kw: 'しおり プログラム 遠足 修学旅行 運動会',
          ja: '行事のしおり・プログラムの表紙や挿絵', ratio: 'r-a4-v', en: 'cover illustration for a school event booklet',
          rules: ['行事の楽しさが伝わる、明るい雰囲気で', 'タイトルなどの文字を後から入れる余白をとる'] },
        { id: 'u-certificate', label: '賞状・メッセージカード', kw: '表彰 感謝状 寄せ書き カード 枠',
          ja: '賞状やメッセージカードの飾り', ratio: 'r-a4-h', en: 'decorative border for a certificate, empty center',
          rules: ['まわりを囲む飾り枠にして、中央は文字を書くために広く空ける', '上品で落ち着いた飾りに'] },
        { id: 'u-manga', label: '説明用の4コマ・マンガ', kw: '漫画 まんが 4コマ コマ割り',
          ja: '内容を説明する4コマ漫画', ratio: 'r-a4-v', en: 'four-panel comic strip, empty speech bubbles',
          rules: ['4つのコマを縦に並べ、読む順番がはっきりわかるように', 'セリフの吹き出しは空けておく（文字は後から入れる）'],
          tips: ['セリフは後から入れるほうがきれいです。うまくいかないときは、1コマずつ作って並べる方法もあります。'] },
        { id: 'u-diagram', label: '図解・説明のイラスト', kw: '図 説明 しくみ 手順 インフォグラフィック',
          ja: 'しくみや手順を説明する、図解風のイラスト', en: 'simple explanatory infographic-style illustration',
          rules: ['描く要素は3〜5つにしぼり、配置や矢印で関係がわかるように', 'アイコン風のシンプルな絵で'],
          tips: ['数字や文字がたくさん入る図（グラフ・地図・表）は、画像生成よりも PowerPoint や Canva で作るほうが確実です。'] },
        { id: 'u-parents', label: '保護者向けのお知らせ', kw: '保護者会 懇談会 お知らせ PTA 説明会',
          ja: '保護者向けのお知らせ・資料に添える絵', ratio: 'r-4-3', en: 'friendly illustration for a notice to parents',
          rules: ['落ち着いた、信頼感のある雰囲気で', '人物は特定のだれかに見えないように'] },
        { id: 'u-class-character', label: '学級・学校のキャラクター', kw: 'マスコット ゆるキャラ 学級',
          ja: '学級（学校）のオリジナルキャラクター', ratio: 'r-1-1', flags: ['charsheet'], en: 'original mascot character design',
          rules: ['子どもがまねして描けるくらい、シンプルな形に', '色は3色くらいにしぼる'] },
        { id: 'u-name-tag', label: '名札・ラベル', kw: 'ロッカー 靴箱 名前 シール アイコン',
          ja: '名札やロッカーのラベルに使う小さなイラスト', ratio: 'r-1-1', en: 'tiny simple icon for a name label',
          rules: ['小さくても形がわかる、シンプルなアイコン風に', '白い背景で、切り抜いて使いやすく'] },
        { id: 'u-board', label: '黒板・ホワイトボード用', kw: '黒板 板書 掲示 マグネット',
          ja: '黒板やホワイトボードに貼って使う絵', ratio: 'r-1-1', en: 'clear illustration to stick on a blackboard',
          rules: ['離れて見てもわかる、はっきりした輪郭線で', '背景は白にして、切り抜いて使えるように'] }
      ] },
      { id: 'work', label: '発信・仕事', tags: [
        { id: 'u-blog', label: 'ブログのアイキャッチ', kw: 'ブログ 記事 サムネ アイキャッチ WordPress',
          ja: 'ブログ記事の先頭に置くアイキャッチ画像', ratio: 'r-16-9', en: 'blog header image',
          rules: ['記事の内容がひと目でわかる絵に', 'タイトル文字を後から重ねられる余白をとる'] },
        { id: 'u-sns', label: 'SNSの投稿画像', kw: 'Instagram インスタ X Twitter Facebook Threads 投稿',
          ja: 'SNSの投稿に使う画像', ratio: 'r-1-1', en: 'eye-catching social media post image',
          rules: ['スマホの小さな画面でも、主役がひと目でわかるように', '見た瞬間に目をひく、はっきりした色で'] },
        { id: 'u-youtube', label: 'YouTubeのサムネイル', kw: 'ユーチューブ 動画 サムネ',
          ja: 'YouTube動画のサムネイル', ratio: 'r-16-9', en: 'YouTube thumbnail, high contrast, expressive',
          rules: ['小さく表示されても目立つよう、明暗の差を強く', '人物の表情は大きく、はっきり', 'タイトル文字を入れる余白を片側にとる'] },
        { id: 'u-cover', label: '資料・スライドの表紙', kw: 'プレゼン 表紙 研修 発表',
          ja: '資料やプレゼンの表紙に使う画像', ratio: 'r-16-9', en: 'presentation cover image',
          rules: ['内容を象徴する絵を1つ、落ち着いた構図で', 'タイトルを入れる余白を広くとる'] },
        { id: 'u-flyer', label: 'チラシ・ポスター', kw: '告知 ビラ ポスター 募集',
          ja: 'チラシ・ポスターのメインの絵', ratio: 'r-a4-v', en: 'flyer main visual',
          rules: ['遠くからでも目をひく構図に', '日時や場所などの文字を後から入れる余白を、上か下にとる'] },
        { id: 'u-banner', label: 'イベント告知のバナー', kw: 'バナー 告知 セミナー 講座 イベント',
          ja: 'イベントを告知する横長のバナー', ratio: 'r-16-9', en: 'wide event banner',
          rules: ['横長の画面いっぱいに、楽しさが伝わる絵を', '中央か片側に、文字を置く余白をとる'] },
        { id: 'u-logo', label: 'ロゴ・マーク', kw: 'ロゴ マーク シンボル 団体',
          ja: 'ロゴマーク（図形の部分）', ratio: 'r-1-1', en: 'simple flat logo mark, no text',
          rules: ['小さくしてもわかる、シンプルな図形で', '色は2〜3色まで、グラデーションは使わない', '背景は白の無地'],
          tips: ['ロゴの文字は崩れやすいので、マーク（図形）だけ作って、文字は Canva などで入れましょう。', '看板や商品などに使うときは、似たロゴがないか確かめましょう。'] },
        { id: 'u-icon', label: 'アイコン・プロフィール画像', kw: 'アイコン プロフィール SNS アバター 似顔絵',
          ja: 'SNSなどのアイコン（プロフィール画像）', ratio: 'r-1-1', en: 'profile avatar icon',
          rules: ['丸く切り抜かれても大事なところが欠けないよう、顔や主役を中央に', '背景は1色でシンプルに'] },
        { id: 'u-header', label: 'note・ホームページのヘッダー', kw: 'note ヘッダー ホームページ カバー',
          ja: 'note やホームページの上部に置く横長のヘッダー画像', ratio: 'r-16-9', en: 'wide website header image',
          rules: ['上下が少し切れても大丈夫な構図に', '主役は中央からすこし外して、余白をいかす'] },
        { id: 'u-business-card', label: '名刺のワンポイント', kw: '名刺 カード',
          ja: '名刺に入れるワンポイントのイラスト', ratio: 'r-1-1', en: 'tiny spot illustration for a business card',
          rules: ['とても小さく印刷しても形がわかる、シンプルな絵に', '背景は白'] }
      ] },
      { id: 'life', label: 'くらし・趣味', tags: [
        { id: 'u-newyear', label: '年賀状', kw: '年賀 お正月 干支 えと',
          ja: '年賀状の絵', ratio: 'r-postcard-v', en: 'Japanese New Year greeting card illustration',
          rules: ['お正月らしい、おめでたい雰囲気で', '「謹賀新年」などの文字は後から入れるので、余白を空けておく'] },
        { id: 'u-season-card', label: '季節のカード', kw: '暑中見舞い 寒中見舞い グリーティング はがき',
          ja: '季節のあいさつカードの絵', ratio: 'r-postcard-v', en: 'seasonal greeting card illustration',
          rules: ['季節が伝わるモチーフを入れる', 'メッセージを書く余白をとる'] },
        { id: 'u-birthday', label: '誕生日・お祝いカード', kw: '誕生日 お祝い 卒業 結婚 カード',
          ja: '誕生日やお祝いのカードの絵', ratio: 'r-postcard-v', en: 'celebration card illustration',
          rules: ['明るく、お祝いの気持ちが伝わる絵に', 'メッセージを書く余白をとる'] },
        { id: 'u-picture-book', label: '絵本・物語の挿絵', kw: '絵本 物語 童話 紙芝居 読み聞かせ',
          ja: '絵本・物語の1場面の挿絵', ratio: 'r-4-3', en: "children's picture book scene",
          rules: ['場面の様子と、登場人物の気持ちが伝わるように'],
          tips: ['何枚も作るときは、1枚目を見本として添え「同じタッチで」と頼むと、絵本らしくそろいます。'] },
        { id: 'u-photo-to-illust', label: '写真をイラスト風に', kw: '写真 イラスト化 似顔絵 変換',
          ja: '添付した写真をもとにしたイラスト', flags: ['ref'], en: 'illustration based on the attached photo',
          rules: ['写真の構図・ポーズ・特徴は残したまま、イラストのタッチで描き直す'],
          tips: ['人が写った写真は、写っている人の許可をとってから使いましょう。児童生徒の写真はアップロードしないのが安心です。'] },
        { id: 'u-wallpaper', label: 'スマホ・パソコンの壁紙', kw: '壁紙 待ち受け ロック画面',
          ja: 'スマホ（パソコン）の壁紙', ratio: 'r-9-16', en: 'phone wallpaper',
          rules: ['時計やアイコンが重なっても見やすいよう、上の方と中央はすっきりさせる'] },
        { id: 'u-stamp', label: 'スタンプ風イラスト', kw: 'LINE スタンプ 絵文字',
          ja: 'スタンプのような、表情ゆたかなキャラクターのイラスト', ratio: 'r-1-1', en: 'sticker-style character illustration, thick outlines',
          rules: ['太い輪郭線で、1枚に1キャラ・1つの表情', '背景は白（または透明）で、切り抜きやすく'],
          tips: ['販売・配布するときは、そのサービスの規約（AIで作った画像の扱い）を必ず確かめましょう。'] },
        { id: 'u-original-character', label: 'オリジナルキャラクター', kw: 'キャラ デザイン 創作',
          ja: 'オリジナルキャラクターのデザイン', ratio: 'r-1-1', flags: ['charsheet'], en: 'original character design, full body',
          rules: ['全身が見えるよう、正面を向いた姿で', '髪型・服・持ち物などの特徴がはっきりわかるように'] },
        { id: 'u-pet-family', label: '家族・ペットの似顔絵', kw: 'ペット 犬 猫 家族 似顔絵',
          ja: '家族やペットの似顔絵イラスト', flags: ['ref'], en: 'portrait illustration based on the attached photo',
          rules: ['添付した写真の特徴（毛の色・模様・髪型など）をいかして、やさしく描く'] },
        { id: 'u-hobby-art', label: '趣味の作品・アート', kw: 'アート 作品 鑑賞 趣味',
          ja: '自分で楽しむためのアート作品', en: 'fine art piece',
          rules: ['構図や光にこだわった、見ごたえのある1枚に'] }
      ] },
      { id: 'material', label: '写真風・素材', tags: [
        { id: 'u-photo', label: '写真のような画像', kw: 'リアル 実写 フォト',
          ja: '本物の写真のような画像', en: 'realistic photo',
          rules: ['自然な光と影、本物らしい質感で', '人物を入れる場合は、実在しない架空の人物に'] },
        { id: 'u-food-product', label: '料理・商品の写真風', kw: '料理 商品 物撮り メニュー',
          ja: '料理や商品を紹介する、写真のような画像', en: 'product / food photography',
          rules: ['主役にピントを合わせ、背景はすこしぼかす', '明るく清潔感のある光で'] },
        { id: 'u-background', label: '背景素材', kw: '背景 素材 テクスチャ',
          ja: '背景に使う素材画像', en: 'background image, no people, no text',
          rules: ['人物や文字は入れない', '上に文字や写真を重ねても見やすいよう、細かすぎない絵に'] },
        { id: 'u-icon-set', label: 'アイコン素材（同じタッチで複数）', kw: 'アイコン セット 素材 そろえる',
          ja: '同じタッチでそろえたアイコン素材', ratio: 'r-1-1', en: 'set of icons in a consistent style',
          rules: ['1つ1つは単純な形で、線の太さ・色数・角の丸みをそろえる', '白い背景に、間をあけて並べる'],
          tips: ['「1枚に4つ並べて」と頼むと、タッチがそろいやすくなります。'] },
        { id: 'u-pattern', label: '模様・パターン', kw: '柄 包装紙 テクスチャ 背景 くり返し',
          ja: 'くり返して使える模様（パターン）', ratio: 'r-1-1', en: 'seamless repeating pattern',
          rules: ['上下左右につなげても違和感のない、くり返し模様に', 'モチーフは小さめに、すき間をそろえて'] }
      ] }
    ]
  };

  // ---------------------------------------------------------------- こまっていること
  var TROUBLE = {
    id: 'trouble', label: 'こまっていること', q: '画像生成で、こまっていることは？', hint: 'いくつでも', multi: true, modes: ['new', 'edit'], color: 'coral',
    groups: [
      { id: 'common', label: 'よくある困りごと', tags: [
        { id: 't-not-as-imagined', label: 'イメージと違う絵になる', kw: '思い通り ならない ちがう 違う', area: 'imagine', flags: ['priority'],
          tips: ['一度で完ぺきを目指さず、まず「70点の1枚」を作ってから、会話で少しずつ近づけるのが近道です。', '言葉で伝えにくいときは、似た雰囲気の写真や手描きのラフを添えると伝わります。'],
          fixes: [{ label: '方向性はそのまま近づける', text: 'おおまかな方向性はこのままで、次の点だけ変えてください：〔変えたいこと〕' }] },
        { id: 't-text-broken', label: '文字が崩れる・読めない', kw: '文字化け 日本語 変な字 崩れる 文字', area: 'text', flags: ['title'],
          tips: ['文字は画像に入れず、あとから Canva や PowerPoint で入れるのがいちばん確実です。', '入れるときは短く（10文字くらいまで）、言葉を「」でくくって正確に書き、書体・大きさ・位置もそえましょう。'],
          fixes: [{ label: '文字を全部消す', text: '画像の中の文字をすべて消してください。消したところは、まわりの絵に合わせて自然に埋めてください。' },
                  { label: '文字を正しく直す', text: '画像の中の文字を「〔正しい文字〕」に直してください。一字一字正確に。文字以外は変えないでください。' }] },
        { id: 't-hands', label: '手や指がおかしい', kw: '指 手 6本 変 崩れ', area: 'people',
          rules: ['手と指は自然な形で（指は5本）。手が目立たないポーズでもかまわない'],
          tips: ['手を後ろで組む・ポケットに入れるなど、手が見えにくいポーズにするのも手です。', '直すときは「手だけ直して」と頼むと、ほかが崩れにくくなります。'],
          fixes: [{ label: '手だけ直す', text: '手の部分だけを、自然な形（指は5本）に直してください。顔・服・背景・構図は変えないでください。' }] },
        { id: 't-chara-consistency', label: '同じキャラなのに毎回顔が変わる', kw: '一貫性 同じ キャラクター 顔 変わる 統一', area: 'people', flags: ['charsheet'],
          rules: ['【キャラクター設定】の見た目（顔・髪型・服・色）を必ず守る'],
          tips: ['まず「キャラクター設定画（正面・横・後ろ）」を1枚作り、次からはその画像を毎回添えて頼むと、顔がそろいやすくなります。', 'キャラクターの説明文は、毎回まったく同じ文を使い回しましょう。ずれてきたら、特徴を書き直して伝えます。', '同じチャットの中で続けて頼むほうが、そろいやすくなります。'],
          fixes: [{ label: '設定画を作る', text: 'このキャラクターの設定画を作ってください。白い背景に、正面・横向き・後ろ姿の3つを横に並べてください。顔・髪型・服・色は3つとも同じにしてください。' },
                  { label: '同じキャラで別の場面', text: '添付した画像のキャラクターと同じ顔・髪型・服装・色のまま、〔○○しているところ〕を描いてください。' }] },
        { id: 't-partial-edit', label: '一部だけ直したいのに全部変わる', kw: '修正 直す 部分 一部 全部変わる', area: 'edit', flags: ['edit'],
          tips: ['「〇〇だけ」「ほかは変えないで」と、はっきり書きましょう。', '直す用の処方箋（上の「できた画像を直す」）を使うと、変えないところまで書いた指示文になります。'],
          fixes: [{ label: '一部だけ直す', text: 'この画像の〔直したいところ〕だけを〔どう変えたいか〕に変えてください。それ以外（人物・構図・色・画風）は一切変えないでください。' }] },
        { id: 't-ignored', label: '細かい指示が無視される', kw: '無視 反映されない 聞いてくれない', area: 'imagine', flags: ['priority'],
          tips: ['指示は大事な順に3つまで。長い説明ほど、一部が無視されやすくなります。', '「〜しないで」より「〜にして」と言いかえると伝わりやすくなります。'],
          fixes: [{ label: '反映されなかった点を伝える', text: '次の点が反映されていません：〔反映されなかったこと〕。それ以外は変えずに、この点だけ直してください。' }] },
        { id: 't-what-to-write', label: '何を書けばいいかわからない', kw: '書き方 わからない 初心者 プロンプト', area: 'start', flags: ['interview'],
          tips: ['まずは「何に使うか」と「何を描くか」の2つだけで大丈夫です。あとはAIに質問してもらいましょう（「質問してもらう版」）。'] },
        { id: 't-inconsistent-style', label: '何枚か作ると画風がバラバラ', kw: '統一 そろわない 画風 タッチ バラバラ', area: 'imagine',
          rules: ['線の太さ・塗り方・色数を【絵のタッチ】のとおりにそろえる'],
          tips: ['気に入った1枚を「見本」として添え、「この画像と同じタッチで」と頼みましょう。', '絵のタッチの説明文を、毎回まったく同じ文で貼るとそろいやすくなります。'],
          fixes: [{ label: '同じタッチで続きを描く', text: '添付した画像（1枚目）と同じ画風・線の太さ・色合いで、〔次の場面〕を描いてください。' }] },
        { id: 't-too-busy', label: 'ごちゃごちゃしてしまう', kw: '情報 多い うるさい 散らかる シンプル', area: 'finish',
          rules: ['描くものは少なめに（主役1つと、小物2〜3つまで）。背景はすっきりと'],
          fixes: [{ label: 'すっきりさせる', text: '背景の小物を減らして、もっとすっきりさせてください。主役はそのままで。' }] },
        { id: 't-copyright', label: '著作権・ルールが心配', kw: '著作権 規約 商用 権利 肖像権', area: 'safety',
          rules: ['既存のキャラクター・作品・作家の画風に似せず、オリジナルで描く'],
          tips: ['作品名・キャラクター名・作家名は、プロンプトに入れないのが基本です。', '商用利用などのルールはサービスごとに違います。販売・配布するときは利用規約を確かめましょう。'] },
        { id: 't-ratio-wrong', label: 'サイズ・縦横の比率が合わない', kw: '比率 サイズ 縦長 横長 アスペクト', area: 'finish',
          rules: ['縦横の比率は【構図・サイズ】のとおりにする'],
          tips: ['AIによって作れる比率が決まっています。近い比率で作って、あとでトリミング（切り取り）するのも手です。', 'Gemini で比率が効かないときは、作りたい形の白い画像を添えて「この白い画像の形で描いて」と頼むと、そろいやすくなります。'],
          fixes: [{ label: '横に広げる', text: 'この画像の絵柄はそのままで、左右に背景を描き足して、横長（16:9）にしてください。' }] },
        { id: 't-count-wrong', label: '人数・数がおかしい', kw: '人数 数 多い 少ない 増える', area: 'imagine',
          rules: ['人数（物の数）は、指定した数をちょうど守る'],
          tips: ['数は「3人」のように数字で書きましょう。人数が多いほど崩れやすいので、5人くらいまでがおすすめです。'],
          fixes: [{ label: '人数を直す', text: '人物をちょうど〔3〕人にしてください（いまは〔4〕人います）。ほかは変えないでください。' }] }
      ] },
      { id: 'imagine', label: '思い通りにならない', more: true, tags: [
        { id: 't-layout', label: '配置・構図が思い通りにならない', kw: '配置 位置 構図 レイアウト', area: 'imagine',
          rules: ['配置は【配置】のとおりにする'],
          tips: ['位置は「左・右・中央・手前・奥」で書きましょう。丸と棒で描いた手描きのラフを写真で添えると、いちばん伝わります。'],
          fixes: [{ label: '配置を直す', text: '〔○○〕を画面の左側に、〔△△〕を右側に置き直してください。絵のタッチと色はそのままで。' }] },
        { id: 't-color-wrong', label: '色が思い通りにならない', kw: '色 カラー 配色', area: 'imagine',
          tips: ['「青」より「淡い水色」「紺色」のように具体的に。色見本の画像を添えるのも効果的です。'],
          fixes: [{ label: '色だけ変える', text: '形や構図はそのままで、全体の色を〔淡いパステル調〕に変えてください。' }] },
        { id: 't-mood-wrong', label: '雰囲気（かわいい・かっこいい）が出ない', kw: '雰囲気 かわいく ならない かっこよく', area: 'imagine',
          rules: ['雰囲気は、形（丸み・線の太さ）と色ではっきり表す'],
          tips: ['「かわいい」は人によって違います。「丸みのある形・大きな目・パステル色」のように、形と色で言いかえましょう。'],
          fixes: [{ label: 'もっと〇〇な雰囲気に', text: '全体を、もっと〔かわいい〕雰囲気にしてください。形を丸く、色をやわらかくしてください。' }] },
        { id: 't-same-every-time', label: '何度やっても似た絵になる', kw: 'ワンパターン 同じ 似た 変わらない', area: 'imagine',
          tips: ['新しいチャットで頼み直すと、前の流れに引っぱられにくくなります。', '「まったく違う構図で」「別のタッチで」と、変えたい点をはっきり伝えましょう。'],
          fixes: [{ label: '別の案を出してもらう', text: 'いまの案とはまったく違う構図・視点で、別の案を描いてください。' }] },
        { id: 't-famous-style', label: '有名な作品の「〇〇風」にしたい', kw: 'ジブリ ディズニー ピクサー 風 作家 まね', area: 'imagine',
          rules: ['特定の作品名・作家名・会社名は使わず、特徴（線・色・光・背景の描き込み）で表現する'],
          tips: ['作品名や作家名を入れると、断られたり、権利の問題になったりします。「やわらかい手描きの背景・淡い色・ていねいな光」のように、特徴を言葉にしましょう（タッチの「手描きアニメ映画風」も使えます）。'] }
      ] },
      { id: 'people', label: '人物・キャラクター', more: true, tags: [
        { id: 't-face-broken', label: '顔が崩れる・不自然', kw: '顔 目 崩れる 不気味', area: 'people',
          rules: ['顔は自然で整った形に（目・鼻・口のバランスを自然に）'],
          tips: ['人物が小さいと顔が崩れやすくなります。人数を減らすか、上半身のアップにしましょう。'],
          fixes: [{ label: '顔だけ整える', text: '人物の顔だけを、自然で整った表情に直してください。ほかは変えないでください。' }] },
        { id: 't-same-face', label: 'みんな同じ顔になる', kw: '同じ顔 描き分け クローン', area: 'people',
          rules: ['一人ひとり、顔立ち・髪型・背の高さ・表情を描き分ける'],
          fixes: [{ label: '描き分けてもらう', text: '人物を一人ずつ描き分けてください。髪型・顔立ち・背の高さ・服の色を、それぞれ変えてください。' }] },
        { id: 't-expression', label: '表情が思い通りにならない', kw: '表情 笑顔 泣き顔 感情', area: 'people',
          rules: ['表情ははっきりと（どんな顔の動きかがわかるように）'],
          tips: ['「うれしそう」より「目を細めて、口を大きく開けて笑う」のように、顔の動きで書くと伝わります。'],
          fixes: [{ label: '表情だけ変える', text: '〔左の子〕の表情だけを〔目を細めて口を大きく開けた笑顔〕に変えてください。ほかは変えないでください。' }] },
        { id: 't-age-wrong', label: '年齢が思った通りにならない', kw: '大人っぽい 子どもっぽい 年齢 幼い', area: 'people',
          rules: ['年齢が見た目ではっきりわかるように（頭身・顔つき・体の大きさ）'],
          tips: ['「小学生」より「8歳くらい、頭が大きめでほっぺがふっくら」のように、数字と見た目で書きましょう。'],
          fixes: [{ label: '年齢を直す', text: '人物を〔8歳くらい〕の見た目に直してください。頭身を低く、顔をあどけなくしてください。' }] },
        { id: 't-not-japanese', label: '日本人・日本の学校らしくならない', kw: '外国人 欧米 日本 学校 教室', area: 'people',
          rules: ['日本人らしい顔立ちと、日本の学校（教室・制服・持ち物）の様子で描く'],
          tips: ['「日本の小学校の教室（黒板・木の机・ランドセル）」のように、日本らしい物の名前を入れると近づきます（場面・テーマのタグも使えます）。'] },
        { id: 't-clothes', label: '服装・制服がおかしい', kw: '服 制服 体操服 衣装', area: 'people',
          rules: ['服装は指定どおりに（色と形）。全員の服装に気を配る'],
          tips: ['制服は「紺のブレザー・グレーのズボン・赤いネクタイ」のように、色と形を書くとそろいます。'] },
        { id: 't-pose', label: 'ポーズ・動きが不自然', kw: 'ポーズ 動き 姿勢 体', area: 'people',
          rules: ['動きは自然に（体の向きと手足の位置が自然になるように）'],
          tips: ['「走る」より「腕を大きくふって、前に走っている」のように、体の動きを具体的に書きましょう。'],
          fixes: [{ label: 'ポーズだけ変える', text: '人物のポーズだけを〔どんなポーズ〕に変えてください。顔・服・背景は変えないでください。' }] },
        { id: 't-bias', label: '性別や見た目がかたよる', kw: '多様性 ジェンダー かたより 偏り', area: 'people',
          rules: ['性別や見た目（背の高さ・髪型・めがね など）がかたよらないよう、いろいろな人を自然に描く'],
          tips: ['AIは「先生は男性」のように、かたよった絵を出すことがあります。気になるときは、人物を一人ずつ書きましょう。'] },
        { id: 't-kid-safe', label: '子どもに見せても安心な絵にしたい', kw: 'こわい 安心 子ども向け 不適切', area: 'people',
          rules: ['子どもが見ても安心な、こわくない、やさしい表現で（暴力的・刺激的な表現は入れない）'] }
      ] },
      { id: 'text', label: '文字', more: true, tags: [
        { id: 't-want-text', label: 'タイトルなどの文字を入れたい', kw: 'タイトル 文字入れ 見出し ロゴ文字', area: 'text', flags: ['title'],
          tips: ['文字は短いほど正確になります。崩れるときは、文字なしで作って後から入れましょう。'] },
        { id: 't-extra-text', label: '頼んでいない文字・記号が入る', kw: '余計 文字 記号 ロゴ 透かし', area: 'text',
          rules: ['文字・数字・ロゴ・記号・サインは一切入れない'],
          fixes: [{ label: '余計な文字を消す', text: '画像の中の文字・記号をすべて消してください。消したところは、まわりの絵に合わせて自然に埋めてください。' }] }
      ] },
      { id: 'finish', label: '仕上がり・質感', more: true, tags: [
        { id: 't-ai-look', label: 'AIっぽさ（つるつる・不自然）が気になる', kw: 'AIっぽい 不自然 テカテカ CG', area: 'finish',
          rules: ['つるつるしたCGのような質感や、不自然な光沢は避ける。手描きらしいゆらぎ（写真なら自然な光とざらつき）を残す'],
          tips: ['水彩・色鉛筆などの画材や、写真なら光の様子（くもりの日のやわらかい光 など）を指定すると、AIっぽさが減ります。'] },
        { id: 't-too-plain', label: '地味・物足りない', kw: 'さみしい 物足りない 地味', area: 'finish',
          rules: ['背景や小物で、場面の楽しさや季節感をすこし足す'],
          fixes: [{ label: 'にぎやかにする', text: '主役はそのままで、背景に〔季節の小物〕を足して、もうすこしにぎやかにしてください。' }] },
        { id: 't-low-quality', label: '画質が粗い・ぼやける', kw: '画質 解像度 ぼやける 荒い', area: 'finish',
          rules: ['細かいところまで、くっきりと'],
          tips: ['細かいところは、その部分だけアップで作り直すときれいになります。Canva などの「アップスケール（高画質化）」も便利です。'] },
        { id: 't-background-noise', label: '背景がじゃま', kw: '背景 じゃま 消したい', area: 'finish',
          rules: ['背景はシンプルに（白・1色・ぼかし）'],
          fixes: [{ label: '背景を白にする', text: '背景だけを白の無地に変えてください。人物（主役）はそのままで。' }] },
        { id: 't-want-transparent', label: '背景を透明にしたい', kw: '透過 透明 PNG 切り抜き', area: 'finish',
          rules: ['背景は透明（透過PNG）に。透明にできない場合は白の無地に'],
          tips: ['ChatGPT は「背景を透明に」と頼めます（うまくいかず、市松模様が描かれることもあります）。', '透明にできないAIでは、1色の背景で作って、Canva の「背景除去」や iPhone の写真の長押し（被写体の切り抜き）で切り抜けます。'] },
        { id: 't-lighting', label: '明るさ・光がおかしい', kw: '暗い 明るさ 光 影', area: 'finish',
          rules: ['光は自然に（光の向きをそろえ、影の向きもそれに合わせる）'],
          fixes: [{ label: '明るくする', text: '全体をもうすこし明るく、やわらかい光にしてください。ほかは変えないでください。' }] }
      ] },
      { id: 'edit', label: '直す・やりとり', more: true, tags: [
        { id: 't-worse-each-time', label: '直すたびに悪くなる', kw: '修正 悪化 崩れる 繰り返し', area: 'edit',
          tips: ['やりとりが長くなったら、いちばん良かった画像を保存して、新しいチャットで「この画像の〇〇だけ直して」と頼み直しましょう。', '一度に頼む修正は、1つか2つまでにしましょう。'] },
        { id: 't-use-my-image', label: '手持ちの写真・絵をいかしたい', kw: '写真 元画像 参考 アップロード', area: 'edit', flags: ['ref'],
          tips: ['人が写った写真は、写っている人の許可をとってから使いましょう。'] },
        { id: 't-mix-images', label: '2枚の画像を組み合わせたい', kw: '合成 組み合わせ 2枚 背景 入れ替え', area: 'edit',
          tips: ['ChatGPT や Gemini は、複数の画像を添えて「1枚目の人物を、2枚目の背景に」のように頼めます。'],
          fixes: [{ label: '2枚を組み合わせる', text: '1枚目の画像の〔人物〕を、2枚目の画像の〔背景〕の中に、自然になじむように入れてください。人物の見た目は変えないでください。' }] }
      ] },
      { id: 'start', label: '何から始めれば', more: true, tags: [
        { id: 't-cant-verbalize', label: 'イメージはあるのに言葉にできない', kw: '言語化 伝わらない 説明できない', area: 'start', flags: ['interview', 'ref'],
          tips: ['似た雰囲気の写真やイラストを添えて「この雰囲気で」と頼むのが近道です（そのまま使うためではなく、雰囲気を伝えるために）。'] },
        { id: 't-english', label: '英語のプロンプトが難しい', kw: '英語 英文 翻訳', area: 'start',
          tips: ['ChatGPT・Gemini・Copilot・Canva・Firefly は日本語で大丈夫です。英語が必要なAI（Midjourney など）は、「英語にしてもらう版」を使いましょう。'] },
        { id: 't-too-long', label: 'プロンプトが長くなりすぎる', kw: '長い 短く まとめる', area: 'start', flags: ['short'],
          tips: ['まず「かんたん版」で作ってみて、足りないところだけ足していきましょう。'] },
        { id: 't-which-ai', label: 'どのAIを使えばいいかわからない', kw: 'ツール 選び方 比較 どれ', area: 'start',
          tips: ['まずは、ふだん使っているAI（ChatGPT や Gemini など）で十分です。うまくいかないときに、別のAIで同じ指示文を試すと、得意・不得意が見えてきます。'] },
        { id: 't-prompt-reuse', label: 'うまくいった指示を使い回したい', kw: '保存 テンプレート 使い回し', area: 'start',
          tips: ['うまくいった指示文は、メモアプリに「用途別」に保存しておきましょう。このページの結果もコピーして保存できます。'] }
      ] },
      { id: 'safety', label: '安心・ルール', more: true, tags: [
        { id: 't-famous-chara', label: '有名なキャラクターに似てしまう', kw: 'キャラ 似る パクリ 既存', area: 'safety',
          rules: ['既存のキャラクターに似ないよう、オリジナルのデザインで（髪型・色・服を独自に）'],
          fixes: [{ label: '似ないように直す', text: 'このキャラクターが既存の作品のキャラクターに似ないように、髪型・服・配色をオリジナルのデザインに変えてください。' }] },
        { id: 't-real-person', label: '実在の人に似てしまうのが心配', kw: '実在 有名人 そっくり 肖像', area: 'safety',
          rules: ['実在の人物に似せない、架空の人物として描く'] },
        { id: 't-school-rules', label: '学校で使ってよいか不安', kw: 'ガイドライン 校内 授業 文科省 決まり', area: 'safety',
          tips: ['学校での生成AIの使い方は、文部科学省のガイドライン（初等中等教育段階における生成AIの利活用に関するガイドライン）と、自治体・学校の決まりを確かめましょう。', '児童生徒の名前や顔写真などの個人情報は、AIに入力しないのが基本です。', '子どもに使わせるときは、サービスごとの年齢の決まりも確かめましょう（例：Gemini の個人アカウントは、画像の生成は13歳以上・画像の編集は18歳以上）。'] },
        { id: 't-child-photo', label: '子どもの写真を使ってよいか', kw: '写真 児童 生徒 個人情報 顔', area: 'safety',
          rules: ['実在の子どもではなく、架空の子どもとして描く'],
          tips: ['児童生徒の写真をAIにアップロードするのは避けましょう（個人情報・肖像の問題）。イラストで表すのが安心です。'] },
        { id: 't-accuracy', label: '内容の正確さが心配（歴史・理科など）', kw: '正確 間違い 史実 科学', area: 'safety',
          rules: ['時代・道具・しくみ・生き物の形などは、できるだけ正確に。はっきりしない部分はシンプルに描く'],
          tips: ['AIの絵は、細かいところが事実と違うことがあります。教材に使う前に、教科書や資料集と見比べましょう。'] }
      ] },
      { id: 'cost', label: '回数・時間・お金', more: true, tags: [
        { id: 't-limit', label: 'すぐ回数の上限になる', kw: '制限 上限 回数 無料', area: 'cost',
          tips: ['いきなり細かく頼まず、まず「かんたん版」で方向性を確かめると、回数を節約できます。', '無料で作れる回数はAIごとに違い、よく変わります。いくつかのAIを使い分けるのも手です。', '小中高の先生は、無料の「Canva 教育版」も使えます（AI を使える回数にゆとりがあります）。'] },
        { id: 't-slow', label: '時間がかかる', kw: '遅い 待つ 時間', area: 'cost',
          tips: ['混んでいる時間帯は遅くなりがちです。待つ間に、次の指示文を用意しておきましょう。'] },
        { id: 't-paid-plan', label: '有料プランにするか迷う', kw: '課金 有料 プラン 料金', area: 'cost',
          tips: ['まず無料で1〜2週間、どんな用途で何枚くらい作るかを試してから決めるのがおすすめです。'] }
      ] }
    ]
  };

  // ---------------------------------------------------------------- 絵のタッチ・雰囲気・色
  var STYLE = {
    id: 'style', label: '絵のタッチ', q: 'どんなタッチの絵？', hint: '1〜2個がおすすめ', multi: true, modes: ['new'], color: 'violet',
    groups: [{ id: 'all', label: '', tags: [
      { id: 'st-handdrawn', sh: 'やさしい手描き風のイラスト', label: 'やさしい手描き風', kw: '手書き ゆるい ほんわか', ja: 'やさしい手描き風のイラスト（線はやわらかく、塗りはシンプル）', en: 'soft hand-drawn illustration, gentle lines, simple coloring' },
      { id: 'st-clipart', sh: '素材集のようなシンプルなイラスト', label: '素材集風のシンプルなイラスト', kw: 'フリー素材 プリント 素材 シンプル', ja: 'プリントや資料に使いやすい、素材集のようなシンプルなイラスト（くっきりした輪郭線と、ベタ塗り）', en: 'simple clip art, clean outlines, flat colors' },
      { id: 'st-flat', sh: 'フラットデザインのイラスト', label: 'フラットデザイン', kw: 'フラット ベクター 図形', ja: '影や立体感を使わない、フラットデザインのイラスト（図形を組み合わせた、すっきりした形）', en: 'flat vector illustration, geometric shapes, no shading' },
      { id: 'st-watercolor', sh: '透明感のある水彩画', label: '水彩画', kw: '水彩 にじみ 透明感', ja: 'にじみやかすれのある、透明感のある水彩画', en: 'watercolor painting, soft bleeding edges, translucent colors' },
      { id: 'st-colored-pencil', sh: '色鉛筆の絵', label: '色鉛筆', kw: '色えんぴつ 鉛筆', ja: '色鉛筆でていねいに描いたような、やさしい質感の絵', en: 'colored pencil drawing, visible pencil strokes' },
      { id: 'st-crayon', sh: 'クレヨンで描いたような絵', label: 'クレヨン・パステル', kw: 'クレヨン パステル 子どもの絵', ja: 'クレヨン（パステル）で描いたような、温かみのある素朴なタッチ', en: 'crayon drawing, warm naive texture' },
      { id: 'st-picture-book', sh: '絵本の挿絵のようなタッチ', label: '絵本風', kw: '絵本 童話', ja: '子ども向け絵本の挿絵のような、やわらかく、あたたかいタッチ', en: "children's picture book illustration" },
      { id: 'st-anime', sh: 'アニメ・マンガ風のイラスト', label: 'アニメ・マンガ風', kw: 'アニメ マンガ 漫画', ja: '日本のアニメ・マンガのようなタッチ（オリジナルのキャラクターで）', en: 'anime style, manga style, original character' },
      { id: 'st-anime-film', sh: '手描きのアニメ映画のようなタッチ', label: '手描きアニメ映画風', kw: 'ジブリ風 背景美術 アニメ映画', ja: '手描きのアニメ映画のような、ていねいに描かれた背景と、やわらかい光（特定の作品・会社に似せない）', en: 'hand-drawn animated film style, lush painted background, soft light' },
      { id: 'st-3d', sh: 'ふんわりした3DCGアニメ風', label: 'ふんわり3D（立体アニメ風）', kw: '3D CG 立体 ピクサー風', ja: '丸みのある、ふんわりした立体の3DCGアニメーション風', en: 'soft 3D render, cute rounded shapes, animated film look' },
      { id: 'st-photo', sh: '本物の写真のようなリアルな画像', label: '写真のようにリアル', kw: 'リアル 実写 写真', ja: '本物の写真のようにリアル（自然な光、本物らしい質感）', en: 'photorealistic, natural lighting, realistic textures' },
      { id: 'st-line-art', sh: '白黒の線画（ぬりえ）', label: '線画（ぬりえ）', kw: 'ぬりえ 白黒 線だけ', ja: '白黒の線画だけ（色は塗らない）。ぬりえに使えるよう、線を閉じて、はっきりと', en: 'black and white line art, coloring page, clean closed outlines, no shading' },
      { id: 'st-pencil-sketch', sh: '鉛筆スケッチ', label: '鉛筆スケッチ', kw: 'デッサン スケッチ', ja: '鉛筆でさっと描いたスケッチ風（陰影は鉛筆のタッチで）', en: 'pencil sketch' },
      { id: 'st-paper-cut', sh: '切り絵（ちぎり絵）風', label: '切り絵・ちぎり絵', kw: '切り絵 ちぎり絵 貼り絵 コラージュ', ja: '色紙を切って重ねたような、切り絵（ちぎり絵）風', en: 'paper cut-out collage, layered paper' },
      { id: 'st-pixel', sh: 'ドット絵', label: 'ドット絵', kw: 'ピクセル レトロゲーム', ja: '昔のゲームのようなドット絵（ピクセルアート）', en: 'pixel art, retro game style' },
      { id: 'st-ukiyoe', sh: '浮世絵のような和風のタッチ', label: '和風・浮世絵風', kw: '和風 浮世絵 日本画', ja: '浮世絵のような和風のタッチ（はっきりした線と、落ち着いた和の色）', en: 'ukiyo-e style, Japanese woodblock print' },
      { id: 'st-sumie', sh: '水墨画', label: '水墨画・墨絵', kw: '墨 書道 和風', ja: '墨の濃淡で描いた水墨画', en: 'sumi-e ink wash painting' },
      { id: 'st-oil', sh: '油絵', label: '油絵', kw: '油彩 絵画', ja: '筆あとが残る、厚塗りの油絵', en: 'oil painting, visible brush strokes' },
      { id: 'st-pop', sh: 'ポップアート風', label: 'ポップアート', kw: 'アメコミ ポップ', ja: 'あざやかな色と太い線のポップアート風', en: 'pop art, bold outlines, halftone dots' },
      { id: 'st-chalk', sh: '黒板にチョークで描いたような絵', label: '黒板アート（チョーク）', kw: '黒板 チョーク', ja: '黒板にチョークで描いたような絵（深い緑の黒板に、白や色のチョークの線）', en: 'chalkboard art, chalk drawing on a green blackboard' },
      { id: 'st-clay', sh: '粘土（フェルト）人形のような立体', label: '粘土・フェルト風', kw: '粘土 フェルト クレイ 人形', ja: '粘土（フェルト）で作った人形をそのまま撮ったような、手作り感のある立体', en: 'claymation style, felt craft' },
      { id: 'st-minimal', sh: 'ミニマルなアイコン風', label: 'ミニマル・アイコン風', kw: 'アイコン シンプル 最小限', ja: '必要な線と形だけの、ミニマルなアイコン風', en: 'minimal icon style' },
      { id: 'st-chibi', sh: '2〜3頭身のかわいいデフォルメキャラ', label: 'ちびキャラ（2〜3頭身）', kw: 'デフォルメ SD かわいい', ja: '頭が大きい2〜3頭身の、かわいいデフォルメのキャラクター', en: 'chibi style, cute super-deformed' },
      { id: 'st-retro', sh: '昭和風のレトロなタッチ', label: 'レトロ・昭和風', kw: '昭和 レトロ なつかしい', ja: '昭和の雑誌や看板のような、レトロなタッチ（すこしくすんだ色、印刷のかすれ）', en: 'retro Showa-era illustration, vintage print' },
      { id: 'st-stained-glass', sh: 'ステンドグラス風', label: 'ステンドグラス風', kw: 'ステンドグラス', ja: 'ステンドグラスのような、黒い枠線と透ける色', en: 'stained glass style' }
    ] }]
  };

  var MOOD = {
    id: 'mood', label: '雰囲気', q: 'どんな雰囲気？', hint: 'いくつでも', multi: true, modes: ['new'], color: 'amber',
    groups: [{ id: 'all', label: '', tags: [
      { id: 'm-warm', label: 'あたたかい・やさしい', ja: 'あたたかく、やさしい', en: 'warm, gentle' },
      { id: 'm-cheerful', label: '明るく元気', ja: '明るく元気な', en: 'cheerful, energetic' },
      { id: 'm-cute', label: 'かわいい', ja: 'かわいらしい（丸みのある形、やわらかい色）', en: 'cute' },
      { id: 'm-cool', label: 'かっこいい', ja: 'かっこいい（シャープな形、引きしまった色）', en: 'cool, stylish' },
      { id: 'm-calm', label: '落ち着いた・上品', ja: '落ち着いた、上品な', en: 'calm, elegant' },
      { id: 'm-fresh', label: 'さわやか', ja: 'さわやかで、すがすがしい', en: 'fresh, airy' },
      { id: 'm-fun', label: 'わくわく・楽しい', ja: 'わくわくする、楽しい', en: 'fun, exciting' },
      { id: 'm-fantasy', label: 'ふしぎ・幻想的', ja: 'ふしぎで幻想的な', en: 'magical, dreamy' },
      { id: 'm-nostalgic', label: 'なつかしい', ja: 'どこかなつかしい', en: 'nostalgic' },
      { id: 'm-trust', label: 'まじめ・信頼感', ja: 'まじめで、信頼感のある', en: 'trustworthy, professional' },
      { id: 'm-humor', label: 'クスッと笑える', ja: '思わずクスッと笑える、ユーモアのある', en: 'humorous, playful' },
      { id: 'm-moving', label: '感動的', ja: '心に残る、感動的な', en: 'emotional, moving' },
      { id: 'm-quiet', label: '静か・おだやか', ja: '静かで、おだやかな', en: 'quiet, peaceful' },
      { id: 'm-dynamic', label: '動き・迫力がある', ja: '動きと迫力のある', en: 'dynamic, powerful' }
    ] }]
  };

  var COLOR = {
    id: 'color', label: '色', q: '色の感じは？', hint: 'いくつでも', multi: true, modes: ['new'], color: 'amber',
    groups: [{ id: 'all', label: '', tags: [
      { id: 'c-pastel', sh: 'パステルカラー', label: 'パステルカラー', ja: 'やわらかいパステルカラー', en: 'pastel colors' },
      { id: 'c-vivid', sh: 'あざやかな色', label: 'あざやか', kw: 'ビビッド 原色', ja: 'あざやかで、くっきりした色', en: 'vivid colors' },
      { id: 'c-muted', sh: 'くすみカラー', label: 'くすみカラー', kw: 'ニュアンス 落ち着いた', ja: 'すこしグレーを混ぜたような、落ち着いたくすみカラー', en: 'muted colors' },
      { id: 'c-mono', sh: '白黒', label: '白黒（モノクロ）', kw: 'モノクロ 白黒 グレー', ja: '白黒（グレーの濃淡だけ）', en: 'monochrome, black and white' },
      { id: 'c-sepia', sh: 'セピア色', label: 'セピア', ja: 'セピア色', en: 'sepia tone' },
      { id: 'c-warm', sh: '暖色', label: '暖色（赤・オレンジ・黄）', kw: '暖色 あたたかい色', ja: '赤・オレンジ・黄色などの暖色を中心に', en: 'warm color palette' },
      { id: 'c-cool', sh: '寒色', label: '寒色（青・緑）', kw: '寒色 すずしい色', ja: '青・水色・緑などの寒色を中心に', en: 'cool color palette' },
      { id: 'c-few', sh: '2〜3色だけの配色', label: '2〜3色だけ', kw: '色数 少ない シンプル', ja: '使う色は2〜3色だけにしぼる', en: 'limited palette of 2-3 colors' },
      { id: 'c-earth', sh: 'ナチュラルな色', label: 'ナチュラル（茶・緑）', kw: 'アース ナチュラル', ja: '茶色・ベージュ・深い緑などのナチュラルな色', en: 'earth tones' },
      { id: 'c-japanese', sh: '和の色', label: '和の色', kw: '和色 藍 朱', ja: '藍・朱・抹茶色などの和の色', en: 'traditional Japanese colors' },
      { id: 'c-gold', sh: '金色のアクセント', label: '金・きらきら', kw: 'ゴールド 豪華 きらきら', ja: '金色やきらめきをアクセントに', en: 'gold accents, sparkles' }
    ] }]
  };

  // ---------------------------------------------------------------- 細かく決める
  var SCENE = {
    id: 'scene', label: '場面・テーマ', q: '何の場面？', hint: 'いくつでも（学校らしさが出ます）', multi: true, modes: ['new'], color: 'green',
    groups: [
      { id: 'school-life', label: '学校生活', tags: [
        { id: 's-lesson', label: '授業中', ja: '日本の学校の教室で授業をしている場面（黒板、木の机といす、窓からの光）', en: 'classroom lesson in a Japanese school' },
        { id: 's-discussion', label: '話し合い・グループ活動', kw: 'グループ 協働 班', ja: '机をくっつけて、4人くらいのグループで話し合っている場面', en: 'students discussing in small groups' },
        { id: 's-presentation', label: '発表', kw: 'スピーチ プレゼン', ja: '子どもが前に出て、みんなの前で発表している場面', en: 'student giving a presentation' },
        { id: 's-tablet', label: 'タブレット学習', kw: 'ICT GIGA 端末 Chromebook iPad', ja: '子どもたちがタブレット端末を使って学習している場面', en: 'students learning with tablets' },
        { id: 's-recess', label: '休み時間', kw: '遊び 校庭 友だち', ja: '休み時間に、校庭や教室で楽しく過ごしている場面', en: 'recess, children playing' },
        { id: 's-lunch', label: '給食', kw: '給食当番 配膳 食事', ja: '給食の時間。白い給食着と帽子の当番が配膳し、みんなで食べている日本の学校の場面', en: 'school lunch time in a Japanese school' },
        { id: 's-cleaning', label: 'そうじ', kw: '掃除 清掃 ほうき ぞうきん', ja: 'そうじの時間。ほうきやぞうきんで教室をきれいにしている場面', en: 'students cleaning the classroom' },
        { id: 's-commute', label: '登下校', kw: '通学 ランドセル 通学路', ja: 'ランドセルを背負って、通学路を歩いている登下校の場面', en: 'children walking to school with randoseru backpacks' },
        { id: 's-library', label: '読書・図書室', kw: '本 図書館 読書', ja: '図書室で本を読んでいる場面', en: 'reading books in the school library' },
        { id: 's-club', label: '部活動', kw: '部活 クラブ 放課後', ja: '放課後の部活動の場面（どの部活かを書くと、より近づきます）', en: 'after-school club activity' },
        { id: 's-experiment', label: '実験・観察', kw: '理科室 ビーカー 顕微鏡', ja: '理科室で実験・観察をしている場面（安全めがね、ビーカーや顕微鏡）', en: 'science experiment in a school lab, safety goggles' },
        { id: 's-pe', label: '体育', kw: '運動 体育館 校庭', ja: '体育の授業で、体操服を着て運動している場面', en: 'physical education class' },
        { id: 's-music', label: '音楽', kw: '合奏 歌 リコーダー 鍵盤ハーモニカ', ja: '音楽の授業で、歌ったり楽器を演奏したりしている場面', en: 'music class, singing and playing instruments' },
        { id: 's-art', label: '図工・美術', kw: '工作 絵 美術', ja: '図工（美術）の時間に、絵をかいたり工作をしたりしている場面', en: 'art class, drawing and crafting' },
        { id: 's-staffroom', label: '職員室・先生の仕事', kw: '職員室 校務 先生', ja: '職員室で先生が仕事をしている場面', en: 'teachers working in a staff room' },
        { id: 's-meeting', label: '面談・懇談', kw: '面談 懇談 三者面談', ja: '先生と保護者が向かい合って、おだやかに話している面談の場面', en: 'parent-teacher meeting' }
      ] },
      { id: 'events', label: '行事', tags: [
        { id: 's-entrance', label: '入学式', kw: '入学 新入生 桜', ja: '入学式。桜の咲く校門、新しいランドセルや制服、晴れやかな表情', en: 'school entrance ceremony, cherry blossoms' },
        { id: 's-graduation', label: '卒業式', kw: '卒業 旅立ち', ja: '卒業式。体育館、紅白幕、胸の花飾り、卒業証書の筒', en: 'graduation ceremony in a Japanese school gym' },
        { id: 's-sports-day', label: '運動会・体育祭', kw: '運動会 リレー 玉入れ 綱引き', ja: '日本の学校の運動会。赤白帽子、万国旗、校庭の白線（リレー・玉入れ・綱引きなど）', en: 'Japanese school sports day, red and white caps, flags of the world' },
        { id: 's-excursion', label: '遠足・校外学習', kw: '遠足 見学 社会科見学', ja: '遠足・校外学習。リュックを背負って、公園や施設を見学している場面', en: 'school excursion with backpacks' },
        { id: 's-school-trip', label: '修学旅行', kw: '京都 奈良 沖縄 旅行', ja: '修学旅行（行き先：〔京都の寺・奈良の鹿・沖縄の海 など〕）', en: 'school trip' },
        { id: 's-festival', label: '文化祭・学習発表会', kw: '文化祭 学芸会 発表会 劇', ja: '文化祭・学習発表会（飾りつけた教室や、ステージでの発表）', en: 'school festival' },
        { id: 's-chorus', label: '合唱・音楽会', kw: '合唱コンクール 音楽会', ja: '合唱・音楽会（ステージに並んで歌っている場面）', en: 'school choir performance on stage' },
        { id: 's-drill', label: '避難訓練', kw: '防災 地震 防災ずきん', ja: '避難訓練。防災ずきんをかぶり、先生の指示で落ち着いて避難している場面', en: 'school evacuation drill' },
        { id: 's-open-class', label: '授業参観', kw: '参観 保護者', ja: '授業参観。教室の後ろで保護者が見守っている場面', en: 'parents observing a class' },
        { id: 's-ceremony', label: '始業式・終業式', kw: '始業式 終業式 全校集会', ja: '始業式・終業式。体育館に整列している場面', en: 'school assembly in the gym' }
      ] },
      { id: 'season', label: '季節・年中行事', tags: [
        { id: 's-spring', label: '春（桜・新学期）', ja: '春。満開の桜、新学期のわくわく感', en: 'spring, cherry blossoms' },
        { id: 's-rainy', label: '梅雨（あじさい・かさ）', ja: '梅雨。あじさい、かさ、長ぐつ、かたつむり', en: 'rainy season, hydrangeas, umbrellas' },
        { id: 's-summer', label: '夏（ひまわり・夏休み）', ja: '夏。青い空、入道雲、ひまわり、夏休み', en: 'summer, sunflowers, blue sky' },
        { id: 's-autumn', label: '秋（紅葉・読書・スポーツ）', ja: '秋。紅葉、どんぐり、読書やスポーツの秋', en: 'autumn, colorful leaves' },
        { id: 's-winter', label: '冬（雪・あたたかい部屋）', ja: '冬。雪、マフラー、あたたかい部屋', en: 'winter, snow' },
        { id: 's-new-year', label: 'お正月', ja: 'お正月。初日の出、鏡もち、凧あげ、こま', en: 'Japanese New Year' },
        { id: 's-setsubun', label: '節分', ja: '節分。豆まき、かわいい鬼のお面', en: 'Setsubun bean-throwing festival, cute oni mask' },
        { id: 's-hinamatsuri', label: 'ひなまつり', ja: 'ひなまつり。ひな人形、桃の花、ひしもち', en: 'Hinamatsuri doll festival' },
        { id: 's-childrens-day', label: 'こどもの日', ja: 'こどもの日。こいのぼり、かぶと', en: "Children's Day, carp streamers" },
        { id: 's-tanabata', label: '七夕', ja: '七夕。笹かざり、短冊、天の川', en: 'Tanabata star festival, bamboo decorations' },
        { id: 's-moon', label: 'お月見', ja: 'お月見。満月、すすき、月見団子', en: 'moon viewing, pampas grass, dango' },
        { id: 's-halloween', label: 'ハロウィン', ja: 'ハロウィン。かぼちゃのランタン、仮装（こわすぎない雰囲気）', en: 'Halloween, pumpkins, costumes, not scary' },
        { id: 's-christmas', label: 'クリスマス', ja: 'クリスマス。ツリー、プレゼント、雪', en: 'Christmas' }
      ] },
      { id: 'subject', label: '教科・学び', tags: [
        { id: 's-japanese', label: '国語', kw: '読書 物語 書写 作文', ja: '国語の学び（本・物語・文字を書くこと）を表すモチーフ', en: 'Japanese language class, books and writing' },
        { id: 's-math', label: '算数・数学', kw: '図形 計算 数', ja: '算数・数学の学び（図形・数・考えること）を表すモチーフ', en: 'math, shapes and numbers' },
        { id: 's-science', label: '理科', kw: '自然 生き物 宇宙 実験', ja: '理科の学び（自然・生き物・実験）を表すモチーフ', en: 'science, nature and experiments' },
        { id: 's-social', label: '社会・歴史', kw: '地図 歴史 地理 昔のくらし', ja: '社会・歴史の学び（地図・地域・昔のくらし）を表すモチーフ', en: 'social studies and history, maps' },
        { id: 's-english', label: '英語・外国語', kw: '英語 外国語 国際 会話', ja: '英語・外国語の学び（会話・世界の国々）を表すモチーフ', en: 'English lesson, world and conversation' },
        { id: 's-moral', label: '道徳', kw: '思いやり 友だち 心', ja: '道徳の学び（思いやり・友だち・心）を表す場面', en: 'kindness and friendship' },
        { id: 's-programming', label: 'プログラミング・情報', kw: 'プログラミング ICT ロボット 情報', ja: 'プログラミング・情報の学びを表すモチーフ', en: 'programming and technology education' },
        { id: 's-sdgs', label: '環境・SDGs', kw: 'SDGs 環境 地球 エコ', ja: '環境・SDGsの学び（地球・自然・くらし）を表すモチーフ', en: 'environment and sustainability' },
        { id: 's-career', label: 'キャリア・将来の夢', kw: '職業 夢 将来 仕事', ja: '将来の夢・いろいろな仕事を表す場面', en: 'future dreams and careers' },
        { id: 's-health', label: '保健・食育', kw: '手洗い 歯みがき 栄養 健康', ja: '保健・食育（手洗い・歯みがき・栄養）を表す場面', en: 'health education, hand washing, nutrition' }
      ] },
      { id: 'other', label: 'そのほか', tags: [
        { id: 's-nature', label: '自然・風景', ja: '自然の風景', en: 'nature landscape' },
        { id: 's-animals', label: '動物・生き物', ja: '動物・生き物', en: 'animals' },
        { id: 's-city', label: '街・建物', ja: '街並み・建物', en: 'town and buildings' },
        { id: 's-space', label: '宇宙・未来', ja: '宇宙・未来', en: 'space and future' },
        { id: 's-food', label: '食べ物', ja: '食べ物', en: 'food' },
        { id: 's-fantasy', label: 'ファンタジー・冒険', ja: 'ファンタジーの世界・冒険', en: 'fantasy adventure' }
      ] }
    ]
  };

  var RATIO = {
    id: 'ratio', label: '縦横の比率', q: '形（縦横の比率）は？', hint: '1つ', multi: false, modes: ['new', 'edit'], color: 'blue',
    groups: [{ id: 'all', label: '', tags: [
      { id: 'r-1-1', label: '正方形（1:1）', ja: '正方形（1:1）', ar: '1:1', w: 1, h: 1 },
      { id: 'r-16-9', label: '横長 16:9（スライド・動画）', ja: '横長（16:9）', ar: '16:9', w: 16, h: 9 },
      { id: 'r-4-3', label: '横長 4:3', ja: '横長（4:3）', ar: '4:3', w: 4, h: 3 },
      { id: 'r-3-2', label: '横長 3:2（写真）', ja: '横長（3:2）', ar: '3:2', w: 3, h: 2 },
      { id: 'r-9-16', label: '縦長 9:16（スマホ）', ja: '縦長（9:16）', ar: '9:16', w: 9, h: 16 },
      { id: 'r-4-5', label: '縦長 4:5（Instagram）', ja: '縦長（4:5）', ar: '4:5', w: 4, h: 5 },
      { id: 'r-a4-v', label: 'A4 縦（プリント・チラシ）', ja: 'A4の縦向き（縦横の比は約1:1.4）', ar: '5:7', w: 5, h: 7 },
      { id: 'r-a4-h', label: 'A4 横', ja: 'A4の横向き（縦横の比は約1.4:1）', ar: '7:5', w: 7, h: 5 },
      { id: 'r-postcard-v', label: 'はがき 縦', ja: 'はがきの縦向き（縦横の比は約2:3）', ar: '2:3', w: 2, h: 3 }
    ] }]
  };

  var FRAME = {
    id: 'frame', label: '構図', q: 'どう写す？', hint: 'いくつでも', multi: true, modes: ['new'], color: 'blue',
    groups: [{ id: 'all', label: '', tags: [
      { id: 'f-closeup', label: '顔のアップ', ja: '顔を大きくアップで', en: 'close-up portrait' },
      { id: 'f-bust', label: '上半身', ja: '上半身が入る大きさで', en: 'upper body shot' },
      { id: 'f-full', label: '全身', ja: '頭から足まで全身が入るように', en: 'full body shot' },
      { id: 'f-wide', label: '引き（まわりの様子まで）', ja: '引いた構図で、まわりの様子まで見えるように', en: 'wide shot' },
      { id: 'f-center', label: '中央に大きく', ja: '主役を画面の中央に大きく', en: 'centered subject' },
      { id: 'f-top', label: '真上から', ja: '真上から見下ろした構図', en: "top-down view, bird's-eye view" },
      { id: 'f-high', label: 'ななめ上から', ja: 'ななめ上から見下ろした構図', en: 'high angle view' },
      { id: 'f-low', label: '下から見上げる', ja: '下から見上げる構図（迫力が出る）', en: 'low angle view' },
      { id: 'f-symmetry', label: '左右対称', ja: '左右対称の、バランスのよい構図', en: 'symmetrical composition' },
      { id: 'f-margin-right', label: '右に文字用の余白', ja: '画面の右側3分の1は、文字を置くために何も描かずに空けておく（主役は左寄せ）', en: 'subject on the left, empty space on the right for text' },
      { id: 'f-margin-left', label: '左に文字用の余白', ja: '画面の左側3分の1は、文字を置くために何も描かずに空けておく（主役は右寄せ）', en: 'subject on the right, empty space on the left for text' },
      { id: 'f-margin-top', label: '上に文字用の余白', ja: '画面の上3分の1は、文字を置くために何も描かずに空けておく', en: 'empty space at the top for text' },
      { id: 'f-margin-bottom', label: '下に文字用の余白', ja: '画面の下4分の1は、文字を置くために何も描かずに空けておく', en: 'empty space at the bottom for text' }
    ] }]
  };

  var BG = {
    id: 'bg', label: '背景', q: '背景は？', hint: '1つ', multi: false, modes: ['new'], color: 'blue',
    groups: [{ id: 'all', label: '', tags: [
      { id: 'b-white', label: '白の無地（切り抜きやすい）', ja: '背景は白の無地', en: 'plain white background' },
      { id: 'b-transparent', label: '透明（透過PNG）', ja: '背景は透明（透過PNG）。透明にできない場合は白の無地', en: 'transparent background' },
      { id: 'b-color', label: '1色の無地', ja: '背景は1色の無地（主役が映える色）', en: 'solid color background' },
      { id: 'b-simple', label: 'シンプル（うすい色・ぼかし）', ja: '背景はシンプルに（うすい色や、ぼかした背景）', en: 'simple blurred background' },
      { id: 'b-detailed', label: '背景もしっかり描く', ja: '背景も、場面がわかるようにしっかり描く', en: 'detailed background' }
    ] }]
  };

  var PEOPLE = {
    id: 'people', label: '登場人物', q: 'だれが出てくる？', hint: 'いくつでも', multi: true, modes: ['new'], color: 'green',
    groups: [
      { id: 'who', label: '年齢・立場', tags: [
        { id: 'p-preschool', label: '幼児', kw: '保育園 幼稚園', ja: '3〜5歳くらいの幼児', en: 'preschool children' },
        { id: 'p-elem-low', label: '小学生（低学年）', kw: '1年生 2年生', ja: '小学1〜2年生くらい（6〜8歳）の子ども（頭が大きめで、あどけない顔）', en: 'young elementary school children, 6-8 years old' },
        { id: 'p-elem-high', label: '小学生（高学年）', kw: '5年生 6年生', ja: '小学5〜6年生くらい（10〜12歳）の子ども', en: 'older elementary school children, 10-12 years old' },
        { id: 'p-junior-high', label: '中学生', ja: '中学生（13〜15歳）', en: 'junior high school students' },
        { id: 'p-high-school', label: '高校生', ja: '高校生（16〜18歳）', en: 'high school students' },
        { id: 'p-young', label: '若い大人', kw: '大学生 20代', ja: '20代くらいの若い大人', en: 'young adults' },
        { id: 'p-teacher', label: '先生', ja: '学校の先生（落ち着いた服装の大人）', en: 'school teacher' },
        { id: 'p-parent', label: '保護者・おとな', ja: '30〜40代くらいの保護者（大人）', en: 'parents' },
        { id: 'p-senior', label: 'おじいさん・おばあさん', kw: '高齢者 祖父母', ja: 'おじいさん・おばあさん', en: 'grandparents' },
        { id: 'p-baby', label: '赤ちゃん', ja: '赤ちゃん', en: 'baby' },
        { id: 'p-animal-chara', label: '動物のキャラクター', ja: '人のかわりに、服を着た動物のキャラクター', en: 'anthropomorphic animal characters' },
        { id: 'p-robot', label: 'ロボット', ja: 'かわいいロボット', en: 'cute robot' },
        { id: 'p-none', label: '人物なし', ja: '人物は描かない（物や風景だけ）', en: 'no people' }
      ] },
      { id: 'look', label: '見た目・服装', tags: [
        { id: 'p-japanese', label: '日本人らしく', ja: '日本人らしい顔立ち', en: 'Japanese people' },
        { id: 'p-diverse', label: 'いろいろな子どもたち', kw: '多様性 男女', ja: '男女や見た目がかたよらない、いろいろな人（めがねの子、背の高さのちがう子など）', en: 'diverse group of children' },
        { id: 'p-uniform', label: '制服', kw: 'ブレザー セーラー 学ラン', ja: '日本の学校の制服（〔ブレザー・セーラー服・学ランなど〕）', en: 'Japanese school uniform' },
        { id: 'p-gym', label: '体操服', ja: '日本の学校の体操服', en: 'Japanese school gym clothes' },
        { id: 'p-casual', label: '私服', ja: 'ふだん着の私服', en: 'casual clothes' }
      ] }
    ]
  };

  var COUNT = {
    id: 'count', label: '人数', q: '何人くらい？', hint: '1つ', multi: false, modes: ['new'], color: 'green',
    groups: [{ id: 'all', label: '', tags: [
      { id: 'n-1', label: '1人', ja: '1人', num: '1', en: 'one person' },
      { id: 'n-2', label: '2人', ja: '2人', num: '2', en: 'two people' },
      { id: 'n-3-5', label: '3〜5人', ja: '3〜5人', num: '3〜5', en: 'a small group of 3-5 people' },
      { id: 'n-many', label: '大勢（クラス全員など）', ja: '大勢（クラス全員くらい）', num: '大勢', en: 'a large group' }
    ] }]
  };

  var OPTION = {
    id: 'option', label: '添えるもの・頼み方', q: '画像を添える？', hint: 'いくつでも', multi: true, modes: ['new'], color: 'gray',
    groups: [{ id: 'all', label: '', tags: [
      { id: 'o-ref-image', label: '参考にしたい画像を添える', kw: '参考 画像 アップロード', ja: '添付した画像を参考に（構図・雰囲気・タッチを近づける。そのまま写さない）', en: 'use the attached image as a reference' },
      { id: 'o-rough-sketch', label: '手描きのラフを添える', kw: 'ラフ 下書き スケッチ', ja: '添付した手描きのラフの配置どおりに', en: 'follow the layout of the attached rough sketch' },
      { id: 'o-chara-ref', label: 'キャラクターの画像を添える', kw: 'キャラ 参照 同じキャラ', ja: '添付したキャラクターと同じ見た目（顔・髪型・服・色）で', en: 'same character as the attached image' },
      { id: 'o-variations', label: 'いくつかの案を見たい', kw: 'バリエーション 複数 案', ja: 'すこしずつ違う案を、2〜3パターン（1枚ずつでもかまいません）', en: 'a few variations' },
      { id: 'o-ask-first', label: '描く前に質問してほしい', kw: '質問 相談 インタビュー', ja: '', flags: ['interview'] }
    ] }]
  };

  var TOOL = {
    id: 'tool', label: '使うAI', q: 'どのAIに貼りますか？', hint: '1つ', multi: false, modes: ['new', 'edit'], color: 'gray',
    groups: [{ id: 'all', label: '', tags: [
      { id: 'ai-chatgpt', label: 'ChatGPT' },
      { id: 'ai-gemini', label: 'Gemini' },
      { id: 'ai-copilot', label: 'Microsoft Copilot' },
      { id: 'ai-canva', label: 'Canva' },
      { id: 'ai-firefly', label: 'Adobe Firefly' },
      { id: 'ai-midjourney', label: 'Midjourney（英語）' },
      { id: 'ai-other', label: 'そのほか・わからない' }
    ] }]
  };

  // ---------------------------------------------------------------- できた画像を直す
  var CHANGE = {
    id: 'change', label: '直したいところ', q: 'どこを直したいですか？', hint: 'いくつでも', multi: true, modes: ['edit'], color: 'coral',
    groups: [{ id: 'all', label: '', tags: [
      { id: 'e-hands', label: '手・指', ja: '手と指を自然な形に（指は5本、関節の向きも自然に）' },
      { id: 'e-face', label: '顔・表情', ja: '顔と表情を〔どんな表情〕に整える' },
      { id: 'e-pose', label: 'ポーズ・向き', ja: 'ポーズ（体の向き）を〔どんなポーズ〕に変える' },
      { id: 'e-clothes', label: '服装', ja: '服装を〔どんな服〕に変える' },
      { id: 'e-age', label: '年齢感', ja: '人物を〔○歳くらい〕の見た目にする' },
      { id: 'e-count', label: '人数・数', ja: '人数を〔○人〕にする' },
      { id: 'e-background', label: '背景', ja: '背景を〔どんな背景〕に変える' },
      { id: 'e-color', label: '色・明るさ', ja: '色（明るさ）を〔どう変えたいか〕にする' },
      { id: 'e-add', label: '何かを足す', ja: '〔足したいもの〕を〔どこ〕に足す' },
      { id: 'e-remove', label: '何かを消す', ja: '〔消したいもの〕を消して、消したところはまわりに合わせて自然に埋める' },
      { id: 'e-text-remove', label: '文字を消す', ja: '画像の中の文字をすべて消す（消したところは、まわりの絵で自然に埋める）' },
      { id: 'e-text-fix', label: '文字を直す', ja: '文字を「〔正しい文字〕」に直す（一字一字正確に）', flags: ['title'] },
      { id: 'e-style', label: '画風・タッチ', ja: '絵のタッチを〔どんなタッチ〕に変える（描いてある内容はそのまま）' },
      { id: 'e-size', label: '比率を変える・広げる', ja: '絵柄はそのままで、まわりを描き足して〔縦横の比率〕に広げる' },
      { id: 'e-quality', label: '画質・細かいところ', ja: '細かいところをくっきりさせて、画質を上げる（絵柄は変えない）' }
    ] }]
  };

  var KEEP = {
    id: 'keep', label: 'そのままにしたいところ', q: '変えてほしくないところは？', hint: 'いくつでも', multi: true, modes: ['edit'], color: 'teal',
    groups: [{ id: 'all', label: '', tags: [
      { id: 'k-face', label: '顔・人物の見た目', ja: '人物の顔・髪型・見た目' },
      { id: 'k-composition', label: '構図・配置', ja: '構図と、ものの配置' },
      { id: 'k-colors', label: '色合い', ja: '全体の色合い' },
      { id: 'k-style', label: '画風・タッチ', ja: '絵のタッチ（線の太さ・塗り方）' },
      { id: 'k-background', label: '背景', ja: '背景' },
      { id: 'k-text', label: '文字', ja: '画像の中の文字' }
    ] }]
  };

  var CATEGORIES = [USE, TROUBLE, STYLE, MOOD, COLOR, SCENE, RATIO, FRAME, BG, PEOPLE, COUNT, OPTION, TOOL, CHANGE, KEEP];

  // ---------------------------------------------------------------- おためし（よくある組み合わせ）
  var PRESETS = [
    { id: 'pr-newsletter', label: '学級通信の運動会イラスト', mode: 'new', wish: '運動会でリレーをしている子どもたち',
      tags: ['u-newsletter', 's-sports-day', 'st-clipart', 'm-cheerful', 'r-4-3', 'p-elem-low', 'p-gym', 'n-3-5', 'b-white'] },
    { id: 'pr-slide', label: '授業スライドの挿絵', mode: 'new', wish: '理科の実験を楽しそうにしている中学生',
      tags: ['u-slides', 's-experiment', 'st-flat', 'm-fun', 'r-16-9', 'f-margin-right', 'p-junior-high', 'n-2'] },
    { id: 'pr-thumbnail', label: 'ブログ・YouTubeのサムネイル', mode: 'new', wish: 'ノートパソコンを前に、ひらめいた表情の先生',
      tags: ['u-youtube', 'st-3d', 'm-cheerful', 'c-vivid', 'r-16-9', 'f-margin-right', 'f-bust', 'p-teacher', 'n-1', 't-want-text'], title: '画像生成のコツ' },
    { id: 'pr-character', label: 'オリジナルキャラクター', mode: 'new', wish: '学級のマスコット。まるいフォルムの、ひよこの男の子',
      tags: ['u-class-character', 'st-handdrawn', 'm-cute', 'c-pastel', 'r-1-1', 'f-full', 'b-white', 't-chara-consistency', 'p-animal-chara'] },
    { id: 'pr-worksheet', label: 'ぬりえ・プリントの線画', mode: 'new', wish: '秋の落ち葉とどんぐり',
      tags: ['u-worksheet', 's-autumn', 'st-line-art', 'c-mono', 'r-1-1', 'b-white', 'p-none'] },
    { id: 'pr-poster', label: '教室の季節の掲示物', mode: 'new', wish: '',
      tags: ['u-poster', 's-tanabata', 'st-paper-cut', 'm-warm', 'r-a4-v', 'f-margin-top', 'p-elem-low', 'n-2'] },
    { id: 'pr-newyear', label: '年賀状', mode: 'new', wish: '',
      tags: ['u-newyear', 's-new-year', 'st-watercolor', 'm-warm', 'c-japanese', 'r-postcard-v', 'f-margin-top', 'p-animal-chara', 'n-1'] },
    { id: 'pr-fix-hands', label: 'できた画像の手を直したい', mode: 'edit', wish: '',
      tags: ['e-hands', 'k-face', 'k-composition', 'k-style', 't-hands', 't-partial-edit'] }
  ];

  // ---------------------------------------------------------------- 索引
  var INDEX = {};
  CATEGORIES.forEach(function (cat) {
    cat.groups.forEach(function (g) {
      g.tags.forEach(function (t) {
        if (INDEX[t.id]) throw new Error('タグの id が重複しています: ' + t.id);
        t.cat = cat.id; t.group = g.id;
        INDEX[t.id] = t;
      });
    });
  });
  var CAT = {};
  CATEGORIES.forEach(function (c) { CAT[c.id] = c; });

  function byId(id) { return INDEX[id] || null; }

  return { VERSION: VERSION, CATEGORIES: CATEGORIES, CAT: CAT, PRESETS: PRESETS, INDEX: INDEX, byId: byId };
});

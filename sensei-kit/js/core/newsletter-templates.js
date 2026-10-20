/* 学級通信のテンプレート（紙面の型）と題字（タイトルバナー）。画面と切りはなした部品なので、Node でも動く（tools/test-newsletter.cjs）。
   ・NLTemplates.TEMPLATES … 紙面のテンプレート 10（場面・雰囲気・題字・見出しの飾り・段・字体・はじめに並べるブロック）。BLANK は白紙
   ・NLTemplates.BANNERS   … 題字の型 11（二重線・太い枠・角丸の枠・黒板・リボン・花と葉・和風の帯・新聞・吹き出し・まるい号数・ノート）
   ・NLTemplates.LOOKS     … 見出し・囲み・区切り線・箇条の印の飾り 9
   ・NLTemplates.ACCENTS   … 飾りの色（黒＝白黒の印刷向け・紺・緑・えんじ・茶）。文字はいつも黒。白黒で刷っても、線の種類・太さ・模様で見分けられる
   ・NLTemplates.blocksOf(テンプレート, ctx) … はじめのブロック（id なし）。ctx = { month, jiko: { formal, soft }, at(n), day(n), week(k), teacher, cls }
   ・NLTemplates.applyTemplate(号, id) / applyBanner(号, id) … 見た目だけを写した新しい号（中身はそのまま）
   ・NLTemplates.mast(号, { h, date, w }) … 題字の要素（h は Kit.h と同じ形。w は紙の中の幅 mm）
   ・NLTemplates.headOrn(飾り, 色) … 見出しの前の小さな絵（SVG の文字列。なければ ''）
   ・NLTemplates.docxHead(号, { date, fonts, w }) / docxStyle(飾り, 色) / docxReply(ブロック) … Word（.docx）の部品（Docx.build の形）
   ・NLTemplates.CSS … 題字と飾りの見た目（Kit.css で入れる）
   もとからある号（題字なし・見出し「すっきり／しっかり／やわらか」）は、題字＝見出しと同じ名前として、前と同じ見た目になる。 */
(function (root) {
  'use strict';

  /* ───────── 題字・飾り・色 ───────── */
  const BANNERS = [
    { id: 'line', label: '二重線', desc: 'すっきり' },
    { id: 'bar', label: '太い枠', desc: 'しっかり' },
    { id: 'round', label: '角丸の枠', desc: 'やわらか' },
    { id: 'board', label: '黒板', desc: 'チョークの字', font: 'hand' },
    { id: 'ribbon', label: 'リボン', desc: 'お祝い・節目に', font: 'mincho' },
    { id: 'flower', label: '花と葉の枠', desc: '春・学期はじめ', font: 'hand' },
    { id: 'wa', label: '和風の帯', desc: '青海波の模様', font: 'mincho' },
    { id: 'news', label: '新聞', desc: '太い罫と白抜き', font: 'mincho' },
    { id: 'bubble', label: '吹き出し', desc: '手書き風', font: 'hand' },
    { id: 'pop', label: 'まるい号数', desc: 'ポップ' },
    { id: 'note', label: 'ノート', desc: 'ラベルとしま模様' },
  ];
  const LOOKS = [
    { value: 'line', label: 'すっきり' }, { value: 'bar', label: 'しっかり' }, { value: 'round', label: 'やわらか' },
    { value: 'soft', label: '花' }, { value: 'note', label: 'ノート' }, { value: 'news', label: '新聞' },
    { value: 'pop', label: 'ポップ' }, { value: 'wa', label: '和風' }, { value: 'chalk', label: '黒板' },
  ];
  // ac：線・帯の色、wash：うすい地の色、board：黒板の色。どれも白黒で刷ると「黒・こい灰色／うすい灰色」になる
  const ACCENTS = [
    { id: 'k', label: '黒', ac: '#000000', wash: '#e9e9e9', board: '#26392f' },
    { id: 'navy', label: '紺', ac: '#1f3a68', wash: '#e2e9f4', board: '#1f3a68' },
    { id: 'green', label: '緑', ac: '#1d5a3c', wash: '#e0eee5', board: '#1d4a35' },
    { id: 'red', label: 'えんじ', ac: '#8c1d2f', wash: '#f5e1e4', board: '#5a1a24' },
    { id: 'brown', label: '茶', ac: '#6b4423', wash: '#f0e6d9', board: '#4a3220' },
  ];
  const OLD = new Set(['line', 'bar', 'round']); // もとからある3つ（前と同じ見た目・同じ Word）
  const WOOD = '#8a6a44';
  const map = (list, k) => Object.fromEntries(list.map((x) => [x[k], x]));
  const BANNER_MAP = map(BANNERS, 'id'), LOOK_MAP = map(LOOKS, 'value'), ACCENT_MAP = map(ACCENTS, 'id');
  const accent = (id) => ACCENT_MAP[id] || ACCENTS[0];
  const hex = (c) => String(c || '#000000').replace('#', '').toUpperCase();

  /* ───────── テンプレート（10） ─────────
     blocks(c) の c：month（発行日の月）・jiko（時候のあいさつ）・at(n)（発行日から n 日目の平日 yyyy-mm-dd）・day(n)（その日の「M月D日(W)」）
                     week(k)（k 週あとの月〜金の行）・teacher（担任の名前。なければ ''）・cls（クラスの名前。なければ ''） */
  const TEMPLATES = [
    {
      id: 'week', label: '週の通信', scene: 'ふだんの週', mood: 'すっきり', banner: 'line', look: 'line', cols: 2, font: 'goth',
      desc: '今週のようす・来週の予定・お知らせ',
      blocks: (c) => [
        { type: 'text', head: '今週のようす', body: c.jiko.soft + '。\n今週は、朝の会のスピーチが一巡しました。話す人のほうを向いて、うなずきながら聞く姿が増えてきています。\n金曜日の学級活動では、「教室をもっと過ごしやすくするには？」を話し合いました。「ロッカーの上に物を置かない」「黒板を消す人を日替わりにする」など、具体的な案がたくさん出ました。\n来週も、一人ひとりの「いいところ」を見つけて、学級で伝え合っていきます。' },
        { type: 'box', head: 'キラリ見つけた', body: '給食の片付けのとき、だれに言われなくても、ほかの班の食器を運ぶ人がいました。\n小さな「ありがとう」が、あちこちで聞こえるクラスになってきています。' },
        { type: 'schedule', head: '来週の予定', rows: c.week(1) },
        { type: 'list', head: 'お知らせ・お願い', body: '欠席・遅刻の連絡は、朝8時までに連絡アプリでお願いします。\n持ち物には、すべて名前を書いてください。\n提出物は、週のはじめにまとめて出しましょう。\n朝と昼の気温の差が大きくなっています。体調管理にお気をつけください。' },
        { type: 'text', head: '担任のひとこと', body: '「失敗しても、やり直せばいい」。今週、ある生徒がスピーチで話してくれた言葉です。\nうまくいかないことがあっても、もう一度やってみる。そんな一人ひとりの姿を、これからも応援していきます。' },
      ],
    },
    {
      id: 'start', label: '新学期のごあいさつ', scene: '学期はじめ', mood: 'やわらか', banner: 'flower', look: 'soft', cols: 1, font: 'hand',
      desc: '担任のあいさつ・3つのお願い・持ち物',
      blocks: (c) => [
        { type: 'text', head: 'はじめまして', body: '新しい学期が始まりました。\n' + (c.teacher ? 'このクラスの担任になりました、' + c.teacher + 'です。' : 'このクラスの担任になりました。') + '一人ひとりの「できた！」を、みんなで喜び合えるクラスにしていきたいと思っています。\n好きなことは、山歩きと料理です。休み時間には、気軽に話しかけてください。' },
        { type: 'box', head: '担任から 3つのお願い', body: 'あいさつは、自分から。\n困ったときは、ひとりで抱えずに相談しよう。\n人のがんばりを、笑わない。' },
        { type: 'list', head: 'はじめの1週間の持ち物', body: '上ばき・体育館シューズ\n筆記用具・下じき・ノート\n提出書類（家庭調査票・保健調査票）\n雑巾 2枚' },
        { type: 'schedule', head: '来週の予定', rows: c.week(1) },
        { type: 'text', head: '保護者の皆様へ', body: '学校のことで気になることがありましたら、連絡帳や連絡アプリで、いつでもお知らせください。小さなことでも、早めに伺えると助かります。\n1年間、どうぞよろしくお願いいたします。' },
      ],
    },
    {
      id: 'event', label: '行事のお知らせ', scene: '行事の前', mood: 'しっかり', banner: 'bar', look: 'bar', cols: 1, font: 'goth',
      desc: '日時・場所・持ち物を、囲みで目立たせる',
      blocks: (c) => [
        { type: 'text', head: '校外学習のお知らせ', body: c.jiko.soft + '。\n' + c.day(10) + '、学年で校外学習に出かけます。いま、班ごとに見学の計画を立てているところです。当日の流れと持ち物を、ご家庭でもご確認ください。' },
        { type: 'box', head: '日時・場所・持ち物', body: '日時：' + c.day(10) + '　8:20 学校集合／15:30 学校で解散（予定）\n場所：市立こども科学館（雨でも行きます）\n持ち物：弁当・水筒・しおり・筆記用具・雨具・ハンカチ' },
        { type: 'list', head: '当日の流れ', body: '8:20　学校に集合・出発式\n9:30　科学館に着く・班ごとに見学\n12:00　昼食（中庭）\n13:00　プラネタリウム\n14:30　科学館を出る\n15:30　学校に着く・解散' },
        { type: 'text', head: '事前学習のようす', body: '総合的な学習の時間に、班ごとに「いちばん見たい展示」と「調べたい問い」を決めました。「雷はなぜ光るのか」「宇宙で水はどうなるのか」など、どの班も楽しみにしています。' },
        { type: 'list', head: 'お願い', body: '前の日は早めに寝て、体調を整えてください。\n体調がすぐれないときは、当日の朝7時45分までに連絡アプリでお知らせください。\n乗り物に酔いやすい人は、酔い止めの薬を飲んでから登校してください。' },
      ],
    },
    {
      id: 'after', label: '行事のふり返り', scene: '行事のあと', mood: '手書き風', banner: 'bubble', look: 'round', cols: 2, font: 'hand',
      desc: '写真と生徒の声で、がんばりを伝える',
      blocks: () => [
        { type: 'text', head: '合唱コンクール、おつかれさまでした', body: '温かい拍手を、ありがとうございました。\n本番では、練習でいちばん苦労したサビの部分を、全員が前を向いて歌いきりました。指揮者と伴奏の二人を、クラスのみんなで支えた結果です。' },
        { type: 'image', caption: '本番の舞台で', size: 'full' },
        { type: 'text', head: '練習の日々', body: '練習を始めたころは、男声と女声の声がなかなか合わず、休み時間に言い合いになったこともありました。\nそこから、パートリーダーが中心になって朝の練習を計画し、少しずつ「聞き合う」合唱に変わっていきました。' },
        { type: 'text', head: '生徒の声から', body: '「最初はバラバラだったけど、最後はひとつになれた」\n「指揮を見ながら歌うと、声がそろうのがわかった」\n「来年は、もっと大きな声で歌いたい」' },
        { type: 'box', head: '担任から', body: '結果よりも、自分たちで話し合い、練習を重ねてきた時間が、このクラスの宝物です。\nぜひ、ご家庭でも当日の話を聞いてみてください。' },
        { type: 'list', head: 'お知らせ', body: '当日の写真の申し込みは、来週の金曜日までです。\n来週から、ふだんの時間割にもどります。' },
      ],
    },
    {
      id: 'test', label: 'テスト前の特集', scene: 'テスト前', mood: '新聞風', banner: 'news', look: 'news', cols: 2, font: 'goth',
      desc: 'テストの日程・家庭学習のこつ・ご家庭へ',
      blocks: (c) => [
        { type: 'text', head: 'テストまで、あと2週間', body: '定期テストが近づいてきました。\nテスト勉強は「量」よりも「計画」です。まずはテスト範囲を確かめて、1日ごとの計画を立てるところから始めましょう。' },
        { type: 'schedule', head: 'テストの日程', col3: '提出物', rows: [{ date: c.at(10), text: '1日目\n国語・数学・理科', note: '数学ワーク' }, { date: c.at(11), text: '2日目\n社会・英語', note: '英語ノート' }] },
        { type: 'list', head: '家庭学習の4つのこつ', body: 'まずは、ワークを1回ぜんぶ解く。\nまちがえた問題に印をつけ、2回目はそこだけ解く。\n寝る前の10分は、暗記の時間に。\n勉強のあいだ、スマホは別の部屋に。' },
        { type: 'text', head: '先輩に聞きました', body: '「前の日に徹夜するより、1週間前から毎日30分のほうが、ずっと覚えていられた」（3年生）\n「わからない問題は、その日のうちに先生に聞きに行った。それだけで点数が変わった」（3年生）' },
        { type: 'list', head: 'テストの日の持ち物', body: '筆記用具（鉛筆・消しゴムは多めに）\n定規・コンパス（数学）\n提出物（ワーク・ノート）' },
        { type: 'box', head: 'ご家庭へのお願い', body: 'テストの1週間前から、部活動はお休みになります。\n「何時から何をするか」を、お子さんと一緒に確かめていただけると助かります。' },
      ],
    },
    {
      id: 'vacation', label: '長い休みの前に', scene: '長期休み前', mood: 'ポップ', banner: 'pop', look: 'pop', cols: 2, font: 'goth',
      desc: '休み中の約束・宿題・登校日',
      blocks: (c) => [
        { type: 'text', head: 'もうすぐ長いお休み', body: 'まとまった時間がとれる、長いお休みが始まります。\n生活のリズムをくずさずに、「休み明けにみんなと会うのが楽しみ」と思える毎日を過ごしてください。\n本を読む、家の手伝いをする、気になることを調べてみる。ふだんはできないことに、ひとつ挑戦してみましょう。' },
        { type: 'box', head: '休み中の3つの約束', body: '早寝・早起き・朝ごはん\n出かけるときは、行き先と帰る時間を家の人に伝える\n水の事故・交通事故に気をつける' },
        { type: 'list', head: '宿題・提出物', body: '各教科のワーク（休み明けの最初の授業で提出）\n読書感想文（原稿用紙2枚以上）\n生活の記録カード（毎日記入）\n自由研究（テーマは自由）' },
        { type: 'schedule', head: '休み中の予定', col3: '持ち物', rows: [{ date: c.at(6), text: '登校日（10:00〜11:30）', note: '生活の記録カード' }, { date: c.at(10), text: '学年の学習会（午前）', note: '筆記用具・ワーク' }, { date: c.at(20), text: '始業式', note: '宿題・上ばき' }] },
        { type: 'text', head: '困ったときは', body: '学校は、休み中も平日の8:30〜16:30に電話を受けています。\n心配なことや、だれかに話したいことがあれば、いつでも連絡してください。' },
      ],
    },
    {
      id: 'parents', label: '保護者会のご案内', scene: '保護者会', mood: '和風', banner: 'wa', look: 'wa', cols: 1, font: 'mincho',
      desc: 'あいさつ文・日時と場所・切り取りの出欠票',
      blocks: (c) => [
        { type: 'text', head: '', body: c.jiko.formal + '、保護者の皆様におかれましては、ますますご清祥のこととお喜び申し上げます。日ごろより、学級の活動にご理解とご協力をいただき、ありがとうございます。\nさて、下記のとおり学級保護者会を開きます。お忙しいところ恐縮ですが、ご出席くださいますよう、お願いいたします。' },
        { type: 'box', head: '学級保護者会', body: '日時：' + c.day(8) + '　15:00〜16:00（受付 14:45から）\n場所：' + (c.cls ? c.cls + 'の教室' : '各学級の教室') + '\n持ち物：上ばき・筆記用具\n内容：学級のようす・これからの行事・個別のご相談' },
        { type: 'list', head: 'お願い', body: '自動車での来校は、ご遠慮ください。\n出欠票は、' + c.day(4) + 'までに、お子さんを通して担任へお出しください。\nご都合がつかない方には、別の日に個別にお話しする時間をとります。出欠票の「ご質問・ご相談」の欄にお書きください。' },
        { type: 'reply', head: '学級保護者会 出欠票', body: '生徒氏名：\n出席　・　欠席　（どちらかに○をつけてください）\n保護者氏名：\nご質問・ご相談したいこと：' },
      ],
    },
    {
      id: 'month', label: '今月の学級', scene: '月はじめ', mood: '黒板', banner: 'board', look: 'chalk', cols: 2, font: 'hand',
      desc: '今月のめあて・行事・クラスの「いいね」',
      blocks: (c) => [
        { type: 'text', head: c.month + '月のめあて', body: '「時間を守って、けじめのある生活をしよう」\n先月のふり返りで、「チャイムが鳴っても席についていない人がいる」という声が出ました。今月は、学級委員を中心に、チャイム着席に取り組みます。' },
        { type: 'list', head: '今月のおもな行事', body: c.day(2) + '　避難訓練\n' + c.day(5) + '　委員会\n' + c.day(9) + '　授業参観・学級懇談会' },
        { type: 'box', head: 'クラスの「いいね！」', body: '給食の準備が、先月より3分早くなりました。\n朝読書の時間、教室がしーんと静かです。\n落とし物を見つけた人が、そっと届けてくれています。' },
        { type: 'schedule', head: '来週の予定', rows: c.week(1) },
        { type: 'text', head: '先生のひとこと', body: '先月、休み時間に、黒板の落書きをだれかがきれいに消してくれていました。名前は書いてありませんでしたが、気持ちのよい朝になりました。\n見えないところでのがんばりも、ちゃんと見ています。' },
        { type: 'list', head: '今月の提出物', body: '家庭学習ノート（毎週月曜日）\n保健の調査票（' + c.day(3) + 'まで）' },
      ],
    },
    {
      id: 'class', label: 'クラスの紹介', scene: '学級びらきのあと', mood: 'ノート', banner: 'note', look: 'note', cols: 2, font: 'goth',
      desc: '学級目標・係のめあて・話し合いの写真',
      blocks: () => [
        { type: 'text', head: '係と委員会が決まりました', body: '学級活動の時間に、係と委員会を決めました。\nどの係も「クラスがもっと楽しくなるには？」を話し合い、自分たちで仕事の中身を考えています。' },
        { type: 'box', head: '学級目標', body: '笑顔・挑戦・思いやり\nだれかの「できた」を、みんなで喜べるクラスに' },
        { type: 'list', head: '係のめあて', body: '学習係：授業の前に、次の時間の準備を声かけします\n生活係：毎朝、窓を開けて空気を入れかえます\nレク係：月に1回、クラス遊びを計画します\n掲示係：みんなの作品を、季節ごとに貼りかえます' },
        { type: 'image', caption: '係の話し合いのようす', size: 'full' },
        { type: 'text', head: '学級目標にこめた思い', body: '目標を決める話し合いでは、「笑っていられるクラスがいい」「失敗しても挑戦できるクラスがいい」という意見がたくさん出ました。\n3つの言葉は、教室の前に大きく貼ってあります。授業参観の折に、ぜひご覧ください。' },
        { type: 'list', head: '委員会', body: '学級委員・保健委員・図書委員・放送委員・美化委員\n委員会の仕事は、毎月の学年だよりでもお知らせします' },
      ],
    },
    {
      id: 'yearend', label: '1年間ありがとう', scene: '学年末', mood: 'リボン', banner: 'ribbon', look: 'soft', cols: 1, font: 'mincho',
      desc: '1年のふり返り・先生から・保護者へのお礼',
      blocks: () => [
        { type: 'text', head: '1年間、ありがとうございました', body: 'このクラスで過ごす日々も、あとわずかとなりました。\n4月のはじめは、名前を呼び合うのもぎこちなかったみんなが、いまでは、だれかが困っていると自然に声をかけられるようになりました。' },
        { type: 'list', head: 'この1年のできごと', body: '4月　学級びらき・係決め\n6月　体育祭（学級リレーで全員がバトンをつなぐ）\n9月　合唱コンクール\n11月　校外学習\n1月　百人一首大会\n3月　学年レクリエーション' },
        { type: 'text', head: '先生から、みんなへ', body: 'うまくいかなかった日も、あきらめずに続けてきたことを、先生は知っています。\n次の学年でも、このクラスで育てた「やさしさ」を、大切にしてください。' },
        { type: 'box', head: '保護者の皆様へ', body: '1年間、温かいご支援とご協力をいただき、心より感謝申し上げます。\nこれからも、子どもたちの成長を見守っていただければ幸いです。' },
        { type: 'list', head: '修了式までのお願い', body: '持ち帰る荷物が増えます。大きめの袋を持たせてください。\n上ばき・体育館シューズは、洗って新しい学年に備えましょう。' },
      ],
    },
  ];
  const BLANK = { id: 'blank', label: '白紙', scene: '', mood: '', desc: '文章のブロック1つから', blocks: () => [{ type: 'text' }] };
  const TEMPLATE_MAP = map(TEMPLATES, 'id');
  const BLOCK_TYPES = new Set(['text', 'schedule', 'list', 'box', 'image', 'reply']);

  function blocksOf(t, c) {
    const list = (t && typeof t.blocks === 'function' ? t.blocks(c) : []) || [];
    return list.filter((b) => b && BLOCK_TYPES.has(b.type)).map((b) => Object.assign({}, b, b.rows ? { rows: b.rows.map((r) => Object.assign({ date: '', text: '', note: '' }, r)) } : null));
  }
  // 見た目だけを写す（名前・号・日付・学校・中身・紙・色はそのまま）
  function applyTemplate(x, id) {
    const t = TEMPLATE_MAP[id];
    return t ? Object.assign({}, x, { tpl: t.id, banner: t.banner, look: t.look, cols: t.cols, font: t.font }) : Object.assign({}, x);
  }
  const applyBanner = (x, id) => (BANNER_MAP[id] ? Object.assign({}, x, { banner: id }) : Object.assign({}, x));

  /* ───────── 小さな絵（SVG の文字列。色は直接書く＝どこに置いても同じ色） ───────── */
  const SVGA = 'xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"';
  const r2 = (v) => Math.round(v * 100) / 100;
  // 5枚の花びら（白でぬって重ねる）
  function flower(cx, cy, R, r, ac, wash) {
    let s = '';
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
      s += `<circle cx="${r2(cx + R * Math.cos(a))}" cy="${r2(cy + R * Math.sin(a))}" r="${r}" fill="${wash}" stroke="${ac}" stroke-width=".8"/>`;
    }
    return s + `<circle cx="${cx}" cy="${cy}" r="${r2(r * 0.6)}" fill="${ac}"/>`;
  }
  const leaf = (d, vein, ac, wash) => `<path d="${d}" fill="${wash}" stroke="${ac}" stroke-width=".8" stroke-linejoin="round"/><path d="${vein}" fill="none" stroke="${ac}" stroke-width=".6" stroke-linecap="round"/>`;
  // 花と葉の束（題字の角に置く）
  const flowerCluster = (ac, wash) => `<svg ${SVGA} viewBox="0 0 48 34">`
    + leaf('M17 19 C24 9 34 7 45 9 C39 18 29 23 17 19 Z', 'M17 19 C27 14 35 11 45 9', ac, wash)
    + leaf('M11 22 C5 25 2 30 3 34 C9 33 13 28 11 22 Z', 'M11 22 C8 27 6 30 3 34', ac, wash)
    + flower(12.5, 12.5, 5.2, 4.3, ac, '#fff') + flower(30, 23.5, 3.1, 2.6, ac, '#fff')
    + `<circle cx="40" cy="20" r="1.3" fill="${ac}"/><circle cx="23" cy="5" r="1" fill="${ac}"/></svg>`;
  const STAR = 'M12 2.2 L14.9 8.6 L21.8 9.3 L16.6 14 L18.1 20.9 L12 17.4 L5.9 20.9 L7.4 14 L2.2 9.3 L9.1 8.6 Z';
  const ORN = {
    soft: (ac) => `<svg ${SVGA} viewBox="0 0 24 24">${flower(12, 12, 5.6, 4.6, ac, '#fff')}</svg>`,
    pop: (ac) => `<svg ${SVGA} viewBox="0 0 24 24"><path d="${STAR}" fill="${ac}" stroke="${ac}" stroke-width="1" stroke-linejoin="round"/></svg>`,
    wa: (ac) => `<svg ${SVGA} viewBox="0 0 24 24"><path d="M12 3 L21 12 L12 21 L3 12 Z" fill="${ac}"/><path d="M12 8.2 L15.8 12 L12 15.8 L8.2 12 Z" fill="#fff"/></svg>`,
  };
  const headOrn = (look, acId) => (ORN[look] ? ORN[look](accent(acId).ac) : '');
  const scissors = (ac) => `<svg ${SVGA} viewBox="0 0 24 24" fill="none" stroke="${ac || '#000'}" stroke-width="1.6" stroke-linecap="round"><circle cx="6" cy="6.5" r="3"/><circle cx="6" cy="17.5" r="3"/><path d="M8.4 8.2 L21 17.5 M8.4 15.8 L21 6.5"/></svg>`;
  const sparkle = (ac, wash) => `<svg ${SVGA} viewBox="0 0 24 24"><path d="M10 1.5 C10.8 7 13 9.2 18.5 10 C13 10.8 10.8 13 10 18.5 C9.2 13 7 10.8 1.5 10 C7 9.2 9.2 7 10 1.5 Z" fill="${wash}" stroke="${ac}" stroke-width="1" stroke-linejoin="round"/><circle cx="20" cy="19" r="1.6" fill="${ac}"/><circle cx="20.5" cy="4" r="1" fill="${ac}"/></svg>`;
  const starSvg = (ac) => `<svg ${SVGA} viewBox="0 0 24 24"><path d="${STAR}" fill="${ac}"/></svg>`;
  // 青海波（和風の帯）。同じページに何枚あっても混ざらないよう、模様の名前は毎回かえる
  let seq = 0;
  function seigaiha(ac) {
    const id = 'nlt-sg' + (++seq);
    const arcs = (cx, cy) => [10, 7.5, 5, 2.5].map((r, i) => `<path d="M${cx - r} ${cy} A${r} ${r} 0 0 1 ${cx + r} ${cy}${i === 0 ? ' Z' : ''}" fill="${i === 0 ? '#fff' : 'none'}" stroke="${ac}" stroke-width=".7"/>`).join('');
    return `<svg ${SVGA} width="100%" height="100%"><defs><pattern id="${id}" width="20" height="10" patternUnits="userSpaceOnUse">${arcs(10, 5)}${arcs(0, 10)}${arcs(20, 10)}${arcs(10, 15)}</pattern></defs><rect width="100%" height="100%" fill="url(#${id})"/></svg>`;
  }
  // リボンのはし（左右）
  const tail = (side, ac, wash) => `<svg ${SVGA} viewBox="0 0 16 20" preserveAspectRatio="none"><path d="${side === 'l' ? 'M0 0 H16 V20 H0 L5 10 Z' : 'M0 0 H16 L11 10 L16 20 H0 Z'}" fill="${wash}" stroke="${ac}" stroke-width="1.2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></svg>`;
  // 吹き出しのしっぽ（ふちの線を白でかくして、つなげる）
  const bubbleTail = (ac) => `<svg ${SVGA} viewBox="0 0 14 9.2" style="overflow:visible"><rect x="1.4" y="-.4" width="10.4" height="1.6" fill="#fff"/><path d="M1 .8 L3.6 9 L12.2 .8" fill="#fff" stroke="${ac}" stroke-width=".8" stroke-linejoin="round"/></svg>`;

  // 題字の型。ない号（前からある号）は、見出しと同じ名前（すっきり／しっかり／やわらか）＝前と同じ見た目
  const bannerOf = (x) => (BANNER_MAP[x.banner] ? x.banner : OLD.has(x.look) ? x.look : 'line');

  /* ───────── 題字の要素 ───────── */
  // 名前の字の大きさ（pt）：入る幅に合わせて小さくする（半角は 0.55 字ぶん）
  function nameSize(name, base, availMm) {
    const n = [...String(name || '')].reduce((s, ch) => s + (/[\x20-\x7e｡-ﾟ]/.test(ch) ? 0.55 : 1), 0) || 1;
    const fit = (availMm / (n * 1.12)) * 2.835;
    return Math.max(14, Math.min(base, Math.floor(fit * 2) / 2));
  }
  function mast(x, o) {
    const h = o.h, W = o.w || 186;
    const b = bannerOf(x);
    const A = accent(x.accent), ac = A.ac, wash = A.wash;
    const name = x.name || '　', no = '第' + x.no + '号';
    const orn = (cls, svg) => h('span', { class: 'nl-orn ' + cls, 'aria-hidden': 'true', html: svg });
    const nm = (base, avail) => h('div', { class: 'nl-name', style: { fontSize: nameSize(name, base, avail) + 'pt' } }, name);
    const cat = () => (x.catch ? h('div', { class: 'nl-catch' }, x.catch) : null);
    const right = (withNo) => h('div', { class: 'nl-mast-r' }, withNo ? h('div', { class: 'nl-no' }, no) : null, h('div', null, o.date), x.school ? h('div', null, x.school) : null, x.from ? h('div', null, x.from) : null);
    const line = () => [h('b', { class: 'nl-no' }, no), h('span', null, o.date), x.school ? h('span', null, x.school) : null, x.from ? h('span', null, x.from) : null];
    const head = (...kids) => h('header', { class: 'nl-mast b-' + b }, ...kids);
    switch (b) {
      case 'board':
        return head(
          h('div', { class: 'bd-in' }, h('div', null, nm(30, W - 70), cat()), right(true)),
          h('div', { class: 'bd-tray', 'aria-hidden': 'true' }, h('span', { class: 'bd-er' }), h('span', { class: 'bd-ch c1' }), h('span', { class: 'bd-ch c2' })));
      case 'ribbon':
        return head(
          h('div', { class: 'rb' }, orn('rb-tail l', tail('l', ac, wash)), orn('rb-tail r', tail('r', ac, wash)), h('span', { class: 'rb-fold l' }), h('span', { class: 'rb-fold r' }),
            h('div', { class: 'rb-band' }, nm(28, W - 58))),
          cat(), h('div', { class: 'rb-info' }, line()));
      case 'flower':
        return head(orn('tl', flowerCluster(ac, wash)), orn('br', flowerCluster(ac, wash)), nm(30, W - 44), cat(), h('div', { class: 'fl-info' }, line()));
      case 'wa':
        return head(
          h('div', { class: 'wa-band', 'aria-hidden': 'true', html: seigaiha(ac) }),
          h('div', { class: 'wa-mid' },
            h('div', { class: 'wa-seal' }, h('span', null, '第'), h('b', { class: 'nl-no' }, String(x.no)), h('span', null, '号')),
            h('div', { class: 'wa-t' }, nm(30, W - 90), cat()), right(false)),
          h('div', { class: 'wa-end' }));
      case 'news':
        return head(
          h('div', { class: 'nw-top' },
            h('div', { class: 'nw-no' }, h('span', null, '第'), h('b', { class: 'nl-no' }, String(x.no)), h('span', null, '号')),
            nm(32, W - (x.catch ? 95 : 35)), x.catch ? h('div', { class: 'nw-catch' }, x.catch) : h('span')),
          h('div', { class: 'nw-line' }, h('span', null, o.date), h('span', null, [x.school, x.from].filter(Boolean).join('　'))));
      case 'bubble':
        return head(
          h('div', { class: 'bb' }, nm(28, W - 80), cat(), orn('bb-tail', bubbleTail(ac)), orn('bb-sp', sparkle(ac, wash))),
          right(true));
      case 'pop':
        return head(
          h('div', { class: 'pp-no' }, h('span', null, '第'), h('b', { class: 'nl-no' }, String(x.no)), h('span', null, '号')),
          h('div', { class: 'pp-t' }, h('div', { class: 'pp-nm' }, nm(30, W - 105), orn('pp-st', starSvg(ac))), cat()),
          right(false));
      case 'note':
        return head(h('div', { class: 'nt-lb' },
          h('div', null, nm(28, W - 85), cat()),
          h('div', { class: 'nt-f' }, h('span', null, 'No.'), h('b', { class: 'nl-no' }, String(x.no)), h('span', null, '日付'), h('b', null, o.date),
            x.school ? [h('span', null, '学校'), h('b', null, x.school)] : null, x.from ? [h('span', null, '発行'), h('b', null, x.from)] : null)));
      default: // line・bar・round：もとからある形（名前は 28pt のまま）
        return head(h('div', null, h('div', { class: 'nl-name' }, name), cat()), right(true));
    }
  }

  /* ───────── Word（.docx）の部品 ───────── */
  // 題字：Docx.build の head に入れるブロックの並び。o = { date, fonts: { goth, mincho, hand }（Word の字体名）, w（紙の中の幅 mm） }
  function docxHead(x, o) {
    const b = bannerOf(x);
    const A = accent(x.accent), ac = hex(A.ac), wash = hex(A.wash), board = hex(A.board), W = o.w || 186;
    const F = o.fonts || {}, bf = BANNER_MAP[b].font ? F[BANNER_MAP[b].font] : null;
    const no = '第' + x.no + '号';
    const right = (p, s) => Object.assign({ p, size: 9.5, align: 'right', line: 1.15 }, s);
    const info = (s) => [right(no, Object.assign({ b: true, size: 12 }, s)), right(o.date, s)].concat(x.school ? [right(x.school, s)] : [], x.from ? [right(x.from, s)] : []);
    const center = (p, s) => Object.assign({ p, size: 9.5, align: 'center', line: 1.2 }, s);
    const infoLine = () => [{ t: no, b: true }, { t: '　' + o.date + (x.school ? '　' + x.school : '') + (x.from ? '　' + x.from : '') }];
    const nameP = (base, avail, s) => Object.assign({ p: x.name || '', b: true, size: nameSize(x.name, base, avail), line: 1.05, font: bf || undefined }, s);
    const catchP = (s) => (x.catch ? [Object.assign({ p: x.catch, size: 10, before: 2 }, s)] : []);
    const vno = (s) => [{ p: '第', size: 8.5, align: 'center', line: 1 }, { p: String(x.no), b: true, size: 18, align: 'center', line: 1 }, { p: '号', size: 8.5, align: 'center', line: 1 }].map((p) => Object.assign(p, s));
    switch (b) {
      case 'board': {
        const wt = { color: 'FFFFFF' };
        return [{ table: [[{ blocks: [nameP(30, W - 70, wt)].concat(catchP(wt)), valign: 'bottom', shade: board }, { blocks: info(wt), valign: 'bottom', shade: board }]], widths: [0.62, 0.38], border: 'box', color: hex(WOOD), sz: 36, pad: 3 }, { p: '', line: 0.5 }];
      }
      case 'ribbon':
        return [
          { table: [[{ p: '', shade: wash, borders: { top: 'single', bottom: 'single', left: 'single' } }, { blocks: [nameP(28, W - 58, { align: 'center', sp: 2 })], shade: wash, borders: { top: 'double', bottom: 'double', left: 'single', right: 'single' } }, { p: '', shade: wash, borders: { top: 'single', bottom: 'single', right: 'single' } }]], widths: [0.1, 0.8, 0.1], border: 'none', color: ac, pad: 1.6 },
        ].concat(catchP({ align: 'center' }), [center(infoLine(), { before: 2, after: 6, border: { top: 'single', bottom: 'single', color: ac } })]);
      case 'flower':
        return [{ table: [[{ blocks: [center([{ t: '＊　＊　＊', color: ac }], { size: 9 }), nameP(30, W - 44, { align: 'center' })].concat(catchP({ align: 'center' }), [center(infoLine(), { before: 3 })]) }]], border: 'box', color: ac, pad: 3 }, { p: '', line: 0.5 }];
      case 'wa':
        return [
          { p: '', border: { bottom: 'double', color: ac }, line: 0.3, after: 2 },
          { table: [[{ blocks: vno({ font: F.mincho }), borders: { top: 'double', bottom: 'double', left: 'double', right: 'double' }, valign: 'center' }, { blocks: [nameP(30, W - 90, { align: 'center', sp: 6 })].concat(catchP({ align: 'center' })), valign: 'center' }, { blocks: info().slice(1).concat([]), valign: 'bottom' }]], widths: [0.11, 0.55, 0.34], border: 'none', color: ac, pad: 1.5, noGap: true },
          { p: '', border: { bottom: 'double', color: ac }, line: 0.3, after: 6 },
        ];
      case 'news':
        return [
          { table: [[{ blocks: vno({ color: 'FFFFFF' }), shade: ac, valign: 'center' }, { blocks: [nameP(32, W - (x.catch ? 95 : 35), { sp: 3 })], valign: 'center' }, { blocks: x.catch ? [{ p: x.catch, size: 9.5, line: 1.2 }] : [{ p: '' }], valign: 'center' }]], widths: [0.1, 0.6, 0.3], border: 'none', pad: 1.5, noGap: true },
          { p: [{ t: o.date }, { t: (x.school || x.from) ? '　｜　' + [x.school, x.from].filter(Boolean).join('　') : '' }], size: 9.5, border: { top: 'heavy', bottom: 'single', color: ac }, before: 2, after: 6 },
        ];
      case 'bubble':
        return [{ table: [[{ blocks: [nameP(28, W - 80)].concat(catchP()), borders: { top: 'single', bottom: 'single', left: 'single', right: 'single' }, sz: 10 }, { p: '', }, { blocks: info({ font: F.hand }), valign: 'bottom' }]], widths: [0.6, 0.04, 0.36], border: 'none', color: ac, pad: 2.5 }, { p: '', line: 0.5 }];
      case 'pop':
        return [
          { table: [[{ blocks: vno(), borders: { top: 'thick', bottom: 'thick', left: 'thick', right: 'thick' }, valign: 'center' }, { blocks: [nameP(30, W - 105, { border: { bottom: 'heavy', color: ac } })].concat(catchP()), valign: 'center' }, { blocks: info().slice(1), valign: 'bottom' }]], widths: [0.12, 0.54, 0.34], border: 'none', color: ac, pad: 1.5, noGap: true },
          { p: '', border: { bottom: 'dotted', color: ac }, line: 0.3, after: 6 },
        ];
      case 'note':
        return [{ table: [[{ blocks: [{ table: [[{ blocks: [nameP(28, W - 85)].concat(catchP()) }, { blocks: [right('No. ' + x.no, { b: true, size: 12 }), right(o.date)].concat(x.school ? [right(x.school)] : [], x.from ? [right(x.from)] : []), valign: 'bottom' }]], widths: [0.6, 0.4], border: 'box', color: ac, pad: 2.2, noGap: true }], shade: wash }]], border: 'box', color: ac, pad: 2.5 }, { p: '', line: 0.5 }];
      default: { // line・bar・round：もとからある形（前と同じ Word になる）
        const look = b;
        return [
          { table: [[{ blocks: [{ p: x.name || '', b: true, size: 26, line: 1.05 }].concat(x.catch ? [{ p: x.catch, size: 10, before: 2 }] : []), valign: 'bottom' },
            { blocks: [right(no, { b: true, size: 12 }), right(o.date)].concat(x.school ? [right(x.school)] : [], x.from ? [right(x.from)] : []), valign: 'bottom' }]],
          widths: [0.6, 0.4], border: look === 'line' ? 'none' : 'box', thick: look === 'bar', pad: look === 'line' ? 0.3 : 2.5, noGap: look === 'line', color: ac },
          look === 'line' ? { p: '', border: { bottom: 'double', color: ac }, after: 6, line: 0.3 } : { p: '', line: 0.5 },
        ];
      }
    }
  }
  // 見出し・囲み・箇条の印・区切り・表の見出し行（Word）
  function docxStyle(look, acId) {
    const L = LOOK_MAP[look] ? look : 'line';
    const A = accent(acId), ac = hex(A.ac), wash = hex(A.wash), board = hex(A.board);
    const hb = { line: { bottom: 'single' }, bar: { left: 'thick' }, round: { top: 'single', bottom: 'single', left: 'single', right: 'single' }, soft: { bottom: 'dotted' }, note: { bottom: 'dashed' }, pop: { bottom: 'heavy' }, wa: { top: 'single', bottom: 'single' } }[L];
    const pre = { soft: '＊ ', pop: '★ ', wa: '◆ ' }[L];
    const mark = { pop: '★', wa: '◇' }[L] || '・';
    return {
      heading(t) {
        const o = { p: pre ? [{ t: pre, color: ac }, { t }] : t, b: true, size: 12.5, keep: true, before: 4, after: 2 };
        if (hb) o.border = Object.assign({ color: ac }, hb);
        // 白抜き（黒い地に白い字）は、地の色を描かない表示（スマホのプレビューなど）で字が消えるので、Word では「うすい地＋太い罫」にする
        if (L === 'news') Object.assign(o, { shade: wash, border: { top: 'heavy', bottom: 'single', color: ac } });
        if (L === 'chalk') Object.assign(o, { shade: wash, border: { left: 'heavy', bottom: 'single', color: board } });
        return o;
      },
      box(head, blocks) {
        const cell = { blocks: (head ? [{ p: pre ? [{ t: pre, color: ac }, { t: head }] : head, b: true, size: 11.5, after: 1 }] : []).concat(blocks) };
        if (L === 'soft') cell.shade = wash;
        const t = { table: [[cell]], border: 'box', thick: L === 'bar' || L === 'pop', pad: 2.2, color: ac };
        if (L === 'note') t.line = 'dashed';
        if (L === 'news' || L === 'wa') t.line = 'double';
        if (L === 'chalk') Object.assign(t, { color: board, sz: 18 });
        return t;
      },
      item(t) { return { p: mark === '・' ? '・' + t : [{ t: mark, color: ac }, { t }], hanging: 3.7, line: 1.3 }; },
      sep: OLD.has(L) ? null : { p: '', border: { bottom: { soft: 'dotted', note: 'dashed', news: 'single', pop: 'dotted', wa: 'double', chalk: 'single' }[L], color: L === 'chalk' ? board : ac }, line: 0.3, after: 5 },
      th: OLD.has(L) ? {} : L === 'news' ? { shade: ac, color: 'FFFFFF' } : L === 'chalk' ? { shade: board, color: 'FFFFFF' } : { shade: wash },
    };
  }
  // 切り取りの返事（Word）：段組みでも全部の幅に置く（full）
  function docxReply(b) {
    const rows = String(b.body || '').split('\n').map((t) => t.trim()).filter(Boolean).map((t) => (/[：:]$/.test(t)
      ? [{ p: t, size: 10.5 }, { p: '', borders: { bottom: 'single' } }]
      : [{ p: t, size: 10.5, span: 2 }]));
    return [
      { table: [[{ p: '', borders: { bottom: 'dashed' } }, { p: 'きりとり', size: 8.5, align: 'center' }, { p: '', borders: { bottom: 'dashed' } }]], widths: [0.42, 0.16, 0.42], border: 'none', pad: 0.4, full: true },
      b.head ? { p: b.head, b: true, size: 12, align: 'center', before: 4, after: 3, full: true } : null,
      rows.length ? { table: rows, widths: [0.34, 0.66], border: 'none', pad: 1.4, full: true } : null,
    ].filter(Boolean);
  }
  // 返事の票の1行：「：」で終わる行は、書きこむ線になる
  const replyLines = (body) => String(body || '').split('\n').map((t) => t.trim()).filter(Boolean).map((t) => ({ text: t, field: /[：:]$/.test(t) }));

  /* ───────── 見た目（CSS） ───────── */
  const GOTH = '"Zen Kaku Gothic New","Hiragino Kaku Gothic ProN","Yu Gothic",Meiryo,sans-serif';
  const MIN = '"Hiragino Mincho ProN","Yu Mincho","Noto Serif JP",serif';
  const HAND = '"Klee One","UD デジタル 教科書体 NK-R","Yu Gothic",sans-serif';
  const NEW = '.nl-page:is(.k-soft,.k-note,.k-news,.k-pop,.k-wa,.k-chalk)';
  const CSS = `
.nl-page{--ac:#000;--acw:#e9e9e9;--acb:#26392f;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.nl-page *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
${ACCENTS.slice(1).map((a) => `.nl-page.ac-${a.id}{--ac:${a.ac};--acw:${a.wash};--acb:${a.board}}`).join('\n')}
.nl-orn{display:block;pointer-events:none}
.nl-orn svg,.nl-ho svg{display:block;width:100%;height:100%;overflow:visible}
.nl-ho{display:inline-block;flex:none;width:1.05em;height:1.05em;vertical-align:-.15em;margin-right:1.6mm}
/* 題字：もとからある3つ */
.nl-mast.b-line{padding-bottom:2mm;border-bottom:3pt double var(--ac)}
.nl-mast.b-bar{padding:3mm 4mm;border:1.6pt solid var(--ac)}
.nl-mast.b-round{padding:3mm 5mm;border:1.2pt solid var(--ac);border-radius:6mm}
/* 黒板 */
.nl-mast.b-board{display:block;margin-bottom:5.5mm}
.b-board .bd-in{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2mm 6mm;align-items:end;background:var(--acb);color:#fff;border:2.4mm solid ${WOOD};border-radius:1.8mm;padding:4mm 6mm 4.5mm;box-shadow:inset 0 0 0 .45mm rgba(255,255,255,.25)}
.b-board .nl-name{font-family:${HAND};font-weight:600;letter-spacing:.1em;line-height:1.15}
.b-board .nl-catch{display:inline-block;margin-top:1.6mm;padding-top:1mm;border-top:.45mm dashed rgba(255,255,255,.8)}
.b-board .nl-mast-r{color:#fff}
.b-board .bd-tray{position:relative;height:2.4mm;margin:0 5mm;background:${WOOD};border-radius:0 0 1.2mm 1.2mm}
.b-board .bd-ch{position:absolute;top:-1.5mm;height:1.5mm;border-radius:.75mm;background:#fff;border:.25mm solid #444}
.b-board .bd-ch.c1{right:18%;width:9mm}
.b-board .bd-ch.c2{right:11%;width:5mm}
.b-board .bd-er{position:absolute;top:-2.8mm;left:9%;width:13mm;height:2.8mm;border-radius:.7mm;background:#fff;border:.25mm solid #444;box-shadow:inset 0 -1.1mm 0 #777}
/* リボン */
.nl-mast.b-ribbon{display:block;text-align:center;margin-bottom:4mm}
.b-ribbon .rb{position:relative;display:inline-block;max-width:calc(100% - 34mm);margin:0 17mm 5.5mm}
.b-ribbon .rb-band{position:relative;z-index:2;background:var(--acw);border:.9pt solid var(--ac);padding:2.2mm 9mm 2.6mm;outline:.6pt dashed var(--ac);outline-offset:-1.5mm}
.b-ribbon .nl-name{font-family:${MIN};font-weight:700;letter-spacing:.14em;line-height:1.2}
.b-ribbon .rb-tail{position:absolute;z-index:0;top:4mm;bottom:-4mm;width:16mm}
.b-ribbon .rb-tail.l{left:-13mm}
.b-ribbon .rb-tail.r{right:-13mm}
.b-ribbon .rb-fold{position:absolute;z-index:1;bottom:-4mm;width:3mm;height:4mm;background:var(--ac)}
.b-ribbon .rb-fold.l{left:0;clip-path:polygon(0 0,100% 0,100% 100%)}
.b-ribbon .rb-fold.r{right:0;clip-path:polygon(0 0,100% 0,0 100%)}
.b-ribbon .nl-catch{margin:0 0 1.2mm}
.b-ribbon .rb-info,.b-flower .fl-info{display:flex;flex-wrap:wrap;justify-content:center;align-items:baseline;gap:0 4mm;font-size:9.5pt;line-height:1.45}
.b-ribbon .rb-info{border-top:.6pt solid var(--ac);border-bottom:.6pt solid var(--ac);padding:.7mm 0}
.b-ribbon .nl-no,.b-flower .nl-no{font-size:11pt}
/* 花と葉の枠 */
.nl-mast.b-flower{display:block;position:relative;margin:4.5mm 4mm 6.5mm;padding:5mm 18mm 3.5mm;border:.9pt solid var(--ac);border-radius:7mm;text-align:center}
.b-flower .nl-name{font-family:${HAND};font-weight:600;letter-spacing:.1em;line-height:1.2}
.b-flower .nl-catch{margin-top:.8mm}
.b-flower .fl-info{margin-top:1.8mm;padding-top:1.2mm;border-top:.9pt dotted var(--ac)}
.b-flower .nl-orn{position:absolute;width:25mm;height:17.7mm}
.b-flower .nl-orn.tl{left:-4mm;top:-4.5mm}
.b-flower .nl-orn.br{right:-4mm;bottom:-4.5mm;transform:rotate(180deg)}
/* 和風の帯 */
.nl-mast.b-wa{display:block;margin-bottom:4mm}
.b-wa .wa-band{height:5mm;border-top:.8pt solid var(--ac);border-bottom:.8pt solid var(--ac);overflow:hidden}
.b-wa .wa-band svg{display:block;width:100%;height:100%}
.b-wa .wa-mid{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:2mm 6mm;align-items:center;padding:3mm 1mm 2.5mm}
.b-wa .wa-seal{display:grid;justify-items:center;line-height:1.15;border:2.4pt double var(--ac);padding:1.2mm 2.2mm;font-family:${MIN};font-weight:700;font-size:9pt;min-width:12mm}
.b-wa .wa-seal b{font-size:17pt;line-height:1.05}
.b-wa .wa-t{text-align:center;min-width:0}
.b-wa .nl-name{font-family:${MIN};font-weight:700;letter-spacing:.3em;text-indent:.3em;line-height:1.2}
.b-wa .nl-catch{margin-top:1mm}
.b-wa .wa-end{border-bottom:3pt double var(--ac)}
/* 新聞 */
.nl-mast.b-news{display:block;margin-bottom:4mm}
.b-news .nw-top{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:2mm 5mm;align-items:center;padding-bottom:1.6mm}
.b-news .nw-no{display:grid;justify-items:center;background:var(--ac);color:#fff;padding:1.5mm 2.8mm;line-height:1.1;font-size:8.5pt;font-weight:700}
.b-news .nw-no b{font-size:18pt;line-height:1.05}
.b-news .nl-name{font-family:${MIN};font-weight:800;letter-spacing:.16em;line-height:1.1}
.b-news .nw-catch{max-width:62mm;font-size:9.5pt;line-height:1.45;border-left:.6pt solid var(--ac);padding-left:3mm}
.b-news .nw-line{display:flex;flex-wrap:wrap;justify-content:space-between;gap:0 4mm;border-top:2.6pt solid var(--ac);border-bottom:.7pt solid var(--ac);padding:.8mm 1mm;font-size:9.5pt;line-height:1.4}
/* 吹き出し */
.nl-mast.b-bubble{grid-template-columns:minmax(0,1fr) auto;margin-bottom:5mm}
.b-bubble .bb{position:relative;justify-self:start;max-width:calc(100% - 8mm);border:1.1pt solid var(--ac);border-radius:9mm;padding:2.6mm 9mm 3mm;margin:1.5mm 0 4.5mm}
.b-bubble .nl-name{font-family:${HAND};font-weight:600;letter-spacing:.08em;line-height:1.2}
.b-bubble .bb-tail{position:absolute;left:11mm;bottom:-4.4mm;width:7mm;height:4.6mm}
.b-bubble .bb-sp{position:absolute;right:-6.5mm;top:-3mm;width:7mm;height:7mm}
.b-bubble .nl-mast-r{font-family:${HAND}}
/* まるい号数 */
.nl-mast.b-pop{grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:2mm 5mm;padding-bottom:2.4mm;border-bottom:2.4pt dotted var(--ac)}
.b-pop .pp-no{position:relative;width:20mm;height:20mm;margin:1.8mm;border-radius:50%;border:1.6pt solid var(--ac);display:grid;align-content:center;justify-items:center;line-height:1.05;font-weight:700;font-size:8.5pt}
.b-pop .pp-no::before{content:'';position:absolute;inset:-1.7mm;border-radius:50%;border:.8pt dashed var(--ac)}
.b-pop .pp-no b{font-size:19pt}
.b-pop .pp-t{min-width:0}
.b-pop .pp-nm{display:flex;align-items:flex-start;gap:1.5mm}
.b-pop .nl-name{font-family:${GOTH};font-weight:700;letter-spacing:.06em;line-height:1.25;padding:0 1mm;background:linear-gradient(transparent 60%,var(--acw) 60%);-webkit-box-decoration-break:clone;box-decoration-break:clone;min-width:0}
.b-pop .pp-st{flex:none;width:6mm;height:6mm}
.b-pop .nl-catch{margin-top:1mm}
/* ノート */
.nl-mast.b-note{display:block;padding:3.5mm 5mm;border:.8pt solid var(--ac);border-radius:2.5mm;background:repeating-linear-gradient(135deg,var(--acw) 0 1.4mm,#fff 1.4mm 2.8mm)}
.b-note .nt-lb{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2mm 6mm;align-items:center;background:#fff;border:1pt solid var(--ac);border-radius:2mm;padding:2.6mm 5mm}
.b-note .nl-name{font-weight:700;letter-spacing:.08em;line-height:1.2}
.b-note .nl-catch{margin-top:.8mm;padding-top:.6mm;border-top:.6pt dashed var(--ac)}
.b-note .nt-f{display:grid;grid-template-columns:auto auto;gap:.4mm 2mm;align-items:baseline;font-size:9pt;line-height:1.45}
.b-note .nt-f span{font-size:7.5pt;letter-spacing:.04em}
.b-note .nt-f b{font-weight:400;border-bottom:.6pt solid var(--ac);padding:0 1mm;min-width:28mm}
.b-note .nt-f b.nl-no{font-weight:700;font-size:11pt}
/* 見出し・囲み・区切り線（新しい6つ） */
${NEW} .nl-blk{margin-bottom:2.6mm}
${NEW} .nl-ul li{padding-left:1.25em;text-indent:-1.25em}
${NEW} .nl-ul li::before{display:inline-block;width:1.25em;text-indent:0}
.nl-sep{height:0;margin:0 0 2.8mm;border-top:.6pt solid var(--ac);break-after:avoid}
${NEW} .nl-tbl th{background:var(--acw)}
.nl-page .nl-boxed .nl-h{display:block;border:0;padding:0;background:none;color:inherit;box-shadow:none;border-radius:0}
.k-soft .nl-h{display:flex;align-items:center;border-bottom:1.2pt dotted var(--ac);padding-bottom:.6mm}
.k-soft .nl-boxed{border-color:var(--ac);border-radius:3.5mm;background:var(--acw)}
.k-soft .nl-ul li::before{content:'✿';color:var(--ac)}
.k-soft .nl-sep{margin:0 12mm 2.8mm;border-top:1pt dotted var(--ac)}
.k-note .nl-h{display:table;padding:0 1.2mm;background:linear-gradient(transparent 55%,var(--acw) 55%);border-bottom:.9pt dashed var(--ac)}
.k-note .nl-boxed{position:relative;border:1pt dashed var(--ac);border-radius:1.5mm;margin-top:3mm}
.k-note .nl-boxed::before{content:'';position:absolute;top:-2.2mm;left:50%;width:16mm;height:4.2mm;margin-left:-8mm;background:var(--acw);border:.4pt solid #999;transform:rotate(-3deg)}
.k-note .nl-sep{border-top:.9pt dashed var(--ac)}
.k-news .nl-h{background:var(--ac);color:#fff;padding:.5mm 2.5mm .6mm}
.k-news .nl-boxed{border:3pt double var(--ac)}
.nl-page.k-news .nl-tbl th{background:var(--ac);color:#fff}
.k-news .nl-body.c2{column-rule:.6pt solid var(--ac)}
.k-pop .nl-h{display:flex;align-items:center;border-bottom:2.2pt solid var(--ac);padding-bottom:.5mm}
.k-pop .nl-boxed{border:1.4pt solid var(--ac);border-radius:2.5mm;box-shadow:1.2mm 1.2mm 0 var(--ac);margin-right:1.2mm;margin-bottom:3.8mm}
.k-pop .nl-ul li::before{content:'★';color:var(--ac)}
.k-pop .nl-sep{border-top:2pt dotted var(--ac);margin:0 8mm 2.8mm}
.k-wa .nl-h{display:flex;align-items:center;border-top:.6pt solid var(--ac);border-bottom:.6pt solid var(--ac);padding:.5mm 1mm}
.k-wa .nl-boxed{border:3pt double var(--ac)}
.k-wa .nl-ul li::before{content:'◇';color:var(--ac)}
.k-wa .nl-sep{width:40%;height:1.2mm;margin:0 auto 2.8mm;border-top:.6pt solid var(--ac);border-bottom:.6pt solid var(--ac)}
.k-chalk .nl-h{display:table;background:var(--acb);color:#fff;border-radius:1.6mm;padding:.3mm 3mm .5mm;box-shadow:0 .9mm 0 ${WOOD};margin-bottom:2.4mm}
.k-chalk .nl-boxed{border:1.6pt solid var(--acb);border-radius:2mm;box-shadow:inset 0 0 0 .8mm #fff,inset 0 0 0 1.05mm var(--acb);padding:3.2mm 4.2mm}
.nl-page.k-chalk .nl-tbl th{background:var(--acb);color:#fff}
.k-chalk .nl-sep{border-top:.9pt solid var(--acb)}
/* 切り取りの返事 */
.nl-reply{break-inside:avoid;column-span:all;-webkit-column-span:all;margin-top:2mm}
.nl-cut{display:flex;align-items:center;gap:2mm;font-size:8.5pt;margin:0 0 2.5mm}
.nl-cut::before,.nl-cut::after{content:'';flex:1;border-top:1pt dashed #000}
.nl-cut .nl-ho{width:4.6mm;height:4.6mm;margin:0}
.nl-reply-in{padding:0 2mm}
.nl-page .nl-reply .nl-h{display:block;text-align:center;border:0;background:none;color:#000;box-shadow:none;padding:0;margin:0 0 2mm;letter-spacing:.1em}
.nl-fld{display:flex;align-items:flex-end;gap:2mm;margin:0 0 2mm}
.nl-fld i{flex:1;min-height:6.5mm;border-bottom:.6pt solid #000}
.nl-reply-in p{margin:0 0 2mm}
`;

  const api = {
    BANNERS, LOOKS, ACCENTS, TEMPLATES, BLANK, BANNER_MAP, LOOK_MAP, ACCENT_MAP, TEMPLATE_MAP, OLD,
    blocksOf, applyTemplate, applyBanner, bannerOf, accent, nameSize, mast, headOrn, scissors, replyLines,
    hasSep: (look) => !!LOOK_MAP[look] && !OLD.has(look),
    docxHead, docxStyle, docxReply, CSS,
  };
  root.NLTemplates = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

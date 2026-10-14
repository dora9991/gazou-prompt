/* 係の例（係決めで選ぶもと）。lv は使う校種：e=小学校 j=中学校 h=高校。n は人数の目安。
   ev は行事の係のときの行事名。文はそのまま掲示に使えるよう、です・ます を使わず短く。
   足したいときは、ここに1行足すだけでよい（id はほかと重ならないように）。 */
(function (root) {
  'use strict';
  const GROUPS = [
    { id: 'kakari', label: '学級の係' },
    { id: 'kyoka', label: '教科係' },
    { id: 'iinkai', label: '委員会' },
    { id: 'toban', label: '当番' },
    { id: 'event', label: '行事の係' },
  ];
  const EVENTS = [
    { id: 'sports', label: '体育祭・運動会' },
    { id: 'culture', label: '文化祭・学習発表会' },
    { id: 'chorus', label: '合唱コンクール' },
    { id: 'trip', label: '修学旅行・宿泊学習' },
    { id: 'outing', label: '遠足・校外学習' },
  ];
  const R = (id, g, name, lv, n, d, ev) => ({ id, g, name, lv, n, d, ev: ev || '' });
  const ITEMS = [
    // ── 学級の係 ──
    R('k-kokuban', 'kakari', '黒板係', 'ejh', 2, '授業のあとに黒板を消す。チョークや黒板消しを整える。'),
    R('k-kubari', 'kakari', '配り係', 'ej', 3, 'プリントや配布物を配る。集めた提出物を先生にとどける。'),
    R('k-gorei', 'kakari', '号令係', 'ej', 2, '授業のはじめと終わりのあいさつの号令をかける。'),
    R('k-renraku', 'kakari', '連絡係', 'ejh', 2, '次の日の時間割・持ち物・連絡を、連絡黒板に書く。'),
    R('k-denki', 'kakari', '電気係', 'ej', 1, '教室の電気をつけ消しする。移動教室のときは消してから出る。'),
    R('k-mado', 'kakari', '窓係', 'ejh', 2, '窓を開けて換気をする。帰りに窓のかぎを確かめる。'),
    R('k-keiji', 'kakari', '掲示係', 'ejh', 2, '掲示物をはったり、はがしたりする。掲示板をきれいに保つ。'),
    R('k-hoken', 'kakari', '保健係', 'ej', 2, '健康観察を手伝う。体調の悪い人を保健室へつきそう。'),
    R('k-tosho', 'kakari', '図書係', 'ej', 2, '学級文庫を整える。本の貸し出しと返却を手伝う。'),
    R('k-ikimono', 'kakari', '生き物係', 'e', 2, 'クラスの生き物にえさをあげ、水そうやケースをきれいにする。'),
    R('k-shokubutsu', 'kakari', '植物係', 'ej', 2, '花や植物に水をやる。プランターの世話をする。'),
    R('k-shinbun', 'kakari', '新聞係', 'ej', 3, '学級新聞をつくって、クラスのできごとを伝える。'),
    R('k-asobi', 'kakari', '遊び係', 'e', 3, 'みんな遊びや、お楽しみ会を計画して進める。'),
    R('k-rec', 'kakari', 'レク係', 'jh', 3, '学級レクや行事の打ち上げを計画して進める。'),
    R('k-tanjobi', 'kakari', '誕生日係', 'ej', 2, '友だちの誕生日をお祝いする（カードや掲示）。'),
    R('k-ongaku', 'kakari', '音楽係', 'e', 2, '朝の歌や合唱の練習の準備をする。'),
    R('k-taiiku', 'kakari', '体育係', 'e', 2, '体育の準備運動の号令や、用具の準備と片付けをする。'),
    R('k-otoshimono', 'kakari', '落とし物係', 'ej', 1, '落とし物を集めて、持ち主をさがす。'),
    R('k-seiton', 'kakari', '整頓係', 'ej', 2, 'ロッカー・たな・学級文庫を整える。'),
    R('k-jikan', 'kakari', '時間係', 'ej', 1, 'チャイム前の着席や、時間を守るよう声をかける。'),
    R('k-kyushoku', 'kakari', '給食係', 'ej', 2, '配膳台をふく。いただきます・ごちそうさまの号令をかける。'),
    R('k-gakushu', 'kakari', '学習係', 'ej', 2, '朝自習の内容を伝える。宿題の提出を呼びかける。'),
    R('k-teishutsu', 'kakari', '提出物係', 'jh', 2, '提出物を番号順にそろえ、まだの人に声をかける。'),
    R('k-calendar', 'kakari', 'カレンダー係', 'e', 1, '日めくりや予定表を、毎日新しくする。'),
    R('k-kazari', 'kakari', '飾り係', 'e', 3, '季節の飾りで、教室を明るくする。'),
    R('k-ict', 'kakari', 'ICT係', 'ejh', 2, 'タブレットの充電保管庫や、プロジェクター・テレビの準備をする。'),
    R('k-souji', 'kakari', '清掃用具係', 'ej', 2, 'ほうき・ぞうきんなどの数と置き方を整える。'),
    R('k-bika', 'kakari', '美化係', 'ejh', 2, '教室をきれいに保つ。ごみの分別を呼びかける。'),
    R('k-shashin', 'kakari', '写真係', 'ejh', 2, '行事や毎日のようすを写真に撮って記録する。'),
    R('k-post', 'kakari', 'ポスト係', 'e', 1, '学級ポストの意見や手紙をまとめて、先生にとどける。'),
    R('k-dougu', 'kakari', '遊び道具係', 'e', 2, 'ボールや遊び道具の数を数え、片付けを確かめる。'),
    R('k-aisatsu', 'kakari', 'あいさつ係', 'e', 2, '朝、教室の入り口であいさつを呼びかける。'),
    R('k-gakkyukai', 'kakari', '学級会係', 'e', 3, '学級会の司会・黒板記録・ノート記録をする。'),
    R('k-quiz', 'kakari', 'クイズ係', 'e', 2, '朝の会や帰りの会で、クイズを出す。'),
    R('k-iitoko', 'kakari', 'いいとこ見つけ係', 'ej', 2, '友だちのいいところを見つけて、帰りの会で紹介する。'),
    R('k-kenkou', 'kakari', '手洗い・換気係', 'ej', 2, '手洗いや換気を呼びかける。消毒液の残りを確かめる。'),
    R('k-nisshi', 'kakari', '学級日誌係', 'jh', 1, '学級日誌のまわり方を確かめ、先生にとどける。'),
    // ── 教科係 ──
    R('s-kokugo', 'kyoka', '国語係', 'ejh', 2, '国語の先生と連絡をとり、授業の準備や持ち物を伝える。提出物を集める。'),
    R('s-sansu', 'kyoka', '算数係', 'e', 2, '算数の先生と連絡をとり、授業の準備や持ち物を伝える。'),
    R('s-sugaku', 'kyoka', '数学係', 'jh', 2, '数学の先生と連絡をとり、授業の準備や持ち物を伝える。提出物を集める。'),
    R('s-shakai', 'kyoka', '社会係', 'ejh', 2, '社会の先生と連絡をとり、授業の準備や持ち物を伝える。地図などを運ぶ。'),
    R('s-rika', 'kyoka', '理科係', 'ejh', 2, '理科室への移動を呼びかける。実験の準備と片付けを手伝う。'),
    R('s-eigo', 'kyoka', '英語係', 'jh', 2, '英語の先生と連絡をとり、授業の準備や持ち物を伝える。'),
    R('s-gaikokugo', 'kyoka', '外国語係', 'e', 2, '外国語の授業の準備や、あいさつの号令をする。'),
    R('s-ongaku', 'kyoka', '音楽係', 'jh', 2, '音楽室への移動を呼びかける。教科書や楽器の持ち物を伝える。'),
    R('s-bijutsu', 'kyoka', '美術係', 'jh', 2, '美術室への移動を呼びかける。作品や道具の持ち物を伝える。'),
    R('s-zuko', 'kyoka', '図工係', 'e', 2, '図工の準備物を伝え、道具の準備と片付けを手伝う。'),
    R('s-taiiku', 'kyoka', '保健体育係', 'jh', 2, '体育の準備運動の号令や用具の準備をする。見学者を先生に伝える。'),
    R('s-gijutsu', 'kyoka', '技術係', 'j', 2, '技術室への移動を呼びかける。作品や道具の持ち物を伝える。'),
    R('s-katei', 'kyoka', '家庭科係', 'ejh', 2, '家庭科室への移動を呼びかける。実習の持ち物を伝える。'),
    R('s-joho', 'kyoka', '情報係', 'h', 2, 'コンピュータ室への移動を呼びかける。提出の方法を伝える。'),
    R('s-geijutsu', 'kyoka', '芸術係', 'h', 2, '選択の芸術（音楽・美術・書道）の連絡を伝える。'),
    // ── 委員会 ──
    R('i-gakkyu', 'iinkai', '学級委員（室長）', 'jh', 1, 'クラスの代表。学級会の司会や、学級の話し合いをまとめる。'),
    R('i-fuku', 'iinkai', '副学級委員（副室長）', 'jh', 1, '学級委員を助け、いないときは代わりをする。'),
    R('i-hr', 'iinkai', 'ホームルーム委員', 'h', 2, 'ホームルームの司会や、クラスの意見のとりまとめをする。'),
    R('i-daihyo', 'iinkai', '代表委員', 'e', 2, 'クラスの代表として代表委員会に出て、学校のことを話し合う。'),
    R('i-seikatsu', 'iinkai', '生活委員', 'jh', 2, '身だしなみや時間を守るなど、学校生活のきまりを呼びかける。'),
    R('i-hoken', 'iinkai', '保健委員', 'ejh', 2, '健康観察の記録や、手洗い・うがいの呼びかけをする。'),
    R('i-tosho', 'iinkai', '図書委員', 'ejh', 2, '図書室のカウンター当番や、本の紹介をする。'),
    R('i-bika', 'iinkai', '美化委員（環境委員）', 'ejh', 2, 'そうじの呼びかけや、清掃用具の点検をする。'),
    R('i-taiiku', 'iinkai', '体育委員', 'ejh', 2, '体育の準備や号令、体育祭・球技大会の運営を手伝う。'),
    R('i-hoso', 'iinkai', '放送委員', 'ejh', 2, 'お昼の放送や、行事の放送・音響を担当する。'),
    R('i-kyushoku', 'iinkai', '給食委員', 'ej', 2, '配膳のきまりや、残さず食べる呼びかけをする。'),
    R('i-koho', 'iinkai', '広報委員', 'ejh', 2, '学校新聞や掲示で、学校のできごとを伝える。'),
    R('i-bunka', 'iinkai', '文化委員', 'jh', 2, '文化祭や合唱コンクールなど、文化的な行事の運営を手伝う。'),
    R('i-senkyo', 'iinkai', '選挙管理委員', 'jh', 2, '生徒会選挙の準備と運営をする。'),
    R('i-shiiku', 'iinkai', '飼育委員', 'e', 2, '学校で飼っている生き物の世話をする。'),
    R('i-saibai', 'iinkai', '栽培委員', 'e', 2, '花壇や畑の世話をする。'),
    R('i-shukai', 'iinkai', '集会委員', 'e', 2, '全校集会の計画と司会をする。'),
    R('i-volunteer', 'iinkai', 'ボランティア委員', 'jh', 2, '募金や地域のボランティア活動を呼びかける。'),
    // ── 当番 ──
    R('t-nicchoku', 'toban', '日直', 'ejh', 2, '号令・学級日誌・黒板の日付・戸じまりなど、その日の仕事をする。'),
    R('t-kyushoku', 'toban', '給食当番', 'ej', 8, '給食の準備・配膳・片付けをする。'),
    R('t-souji-kyoshitsu', 'toban', '掃除当番（教室）', 'ejh', 8, '教室をそうじする。机を運び、ゴミを捨てる。'),
    R('t-souji-rouka', 'toban', '掃除当番（廊下・階段）', 'ejh', 4, '廊下と階段をそうじする。'),
    R('t-souji-toilet', 'toban', '掃除当番（トイレ）', 'ejh', 4, 'トイレをそうじする。'),
    R('t-souji-tokubetsu', 'toban', '掃除当番（特別教室）', 'ejh', 4, '受け持ちの特別教室をそうじする。'),
    // ── 行事の係：体育祭・運動会 ──
    R('e-ouen', 'event', '応援団', 'ejh', 4, '応援のふりつけを考え、練習と本番でクラスを盛り上げる。', 'sports'),
    R('e-yogu', 'event', '用具係', 'ejh', 4, '競技の用具を準備し、すばやく出し入れする。', 'sports'),
    R('e-shoshu', 'event', '招集係', 'ejh', 2, '出場する人を集めて、並ばせる。', 'sports'),
    R('e-kessho', 'event', '決勝・審判係', 'ejh', 2, '着順を判定し、記録係に伝える。', 'sports'),
    R('e-tokuten', 'event', '得点係', 'ejh', 2, '得点を計算し、得点板に表示する。', 'sports'),
    R('e-hoso-s', 'event', '放送係', 'ejh', 2, '競技の案内やアナウンスをする。', 'sports'),
    R('e-kyugo', 'event', '救護係', 'ejh', 2, 'けがをした人の手当てを手伝い、先生に伝える。', 'sports'),
    R('e-kiroku-s', 'event', '記録係', 'ejh', 2, '競技の結果を記録する。', 'sports'),
    R('e-flag', 'event', '旗・横断幕係', 'ejh', 3, 'クラスの旗や横断幕をつくる。', 'sports'),
    // ── 行事の係：文化祭・学習発表会 ──
    R('e-jikko', 'event', '実行委員', 'ejh', 2, 'クラスの出し物の計画をまとめ、全体の進み具合を確かめる。', 'culture'),
    R('e-soshoku', 'event', '装飾係', 'ejh', 4, '教室や会場の飾りつけをする。', 'culture'),
    R('e-kaikei', 'event', '会計係', 'jh', 2, '材料費の予算を立て、買ったものとお金を記録する。', 'culture'),
    R('e-koho-c', 'event', '広報係', 'ejh', 2, 'ポスターやチラシで出し物を知らせる。', 'culture'),
    R('e-butai', 'event', '舞台係', 'ejh', 3, '大道具を動かし、場面の転換をする。', 'culture'),
    R('e-shomei', 'event', '照明係', 'jh', 2, '照明の操作をする。', 'culture'),
    R('e-onkyo', 'event', '音響係', 'ejh', 2, 'BGMや効果音、マイクの準備と操作をする。', 'culture'),
    R('e-isho', 'event', '衣装係', 'ejh', 3, '劇や発表の衣装を準備する。', 'culture'),
    R('e-kodogu', 'event', '小道具係', 'ejh', 3, '劇や展示で使う小道具をつくる。', 'culture'),
    R('e-kyakuhon', 'event', '脚本係', 'ejh', 2, '劇の脚本や発表の原稿を書く。', 'culture'),
    R('e-kantoku', 'event', '監督・演出', 'jh', 1, '劇の練習を進め、演技や場面の見せ方をまとめる。', 'culture'),
    R('e-uketsuke', 'event', '受付係', 'ejh', 2, 'お客さんの受付や案内をする。', 'culture'),
    R('e-kanban', 'event', '看板係', 'ejh', 3, '出し物の看板をつくる。', 'culture'),
    R('e-movie', 'event', '写真・動画係', 'jh', 2, '準備から本番までを写真や動画で記録する。', 'culture'),
    // ── 行事の係：合唱コンクール ──
    R('e-shiki', 'event', '指揮者', 'ejh', 1, '合唱の指揮をする。パートリーダーと練習の進め方を決める。', 'chorus'),
    R('e-banso', 'event', '伴奏者', 'ejh', 1, 'ピアノの伴奏をする。', 'chorus'),
    R('e-part', 'event', 'パートリーダー', 'ejh', 4, 'パートの練習をまとめる（ソプラノ・アルト・テノール・バス など）。', 'chorus'),
    R('e-chorus-jikko', 'event', '合唱実行委員', 'jh', 2, '練習の計画を立て、クラスの目標をまとめる。', 'chorus'),
    // ── 行事の係：修学旅行・宿泊学習 ──
    R('e-hancho', 'event', '班長', 'ejh', 6, '班をまとめ、集合や点呼を確かめる。', 'trip'),
    R('e-fukuhancho', 'event', '副班長', 'ejh', 6, '班長を助け、いないときは代わりをする。', 'trip'),
    R('e-hoken-t', 'event', '保健係', 'ejh', 6, '班の人の体調を確かめ、薬や救急セットを持つ。', 'trip'),
    R('e-kiroku-t', 'event', '記録係（写真係）', 'ejh', 6, '見学のようすを記録し、写真を撮る。', 'trip'),
    R('e-shokuji', 'event', '食事係', 'ejh', 6, '食事のときの準備や、いただきますの号令をする。', 'trip'),
    R('e-jikan-t', 'event', '時間係', 'ejh', 6, '行動の時間を確かめ、班に声をかける。', 'trip'),
    R('e-kaikei-t', 'event', '会計係', 'jh', 6, '班の交通費や入場料をまとめて払い、記録する。', 'trip'),
    R('e-shiori', 'event', 'しおり係', 'ejh', 3, '旅行のしおりをつくる。', 'trip'),
    R('e-rec-t', 'event', 'レク係', 'ejh', 3, '夜のレクリエーションを計画して進める。', 'trip'),
    R('e-heyacho', 'event', '部屋長', 'ejh', 6, '部屋の人をまとめ、消灯や片付けを確かめる。', 'trip'),
    // ── 行事の係：遠足・校外学習 ──
    R('e-hancho-o', 'event', '班長', 'ejh', 6, '班をまとめ、集合や点呼を確かめる。', 'outing'),
    R('e-jikan-o', 'event', '時間係', 'ejh', 6, '行動の時間を確かめ、班に声をかける。', 'outing'),
    R('e-hoken-o', 'event', '保健係', 'ejh', 6, '班の人の体調を確かめ、先生に伝える。', 'outing'),
    R('e-kiroku-o', 'event', '記録係', 'ejh', 6, '見学したことをメモし、写真を撮る。', 'outing'),
  ];
  // すぐ使える組み合わせ（「おすすめで始める」）
  const SETS = {
    es: { kakari: ['k-kokuban', 'k-kubari', 'k-gorei', 'k-denki', 'k-mado', 'k-keiji', 'k-hoken', 'k-tosho', 'k-ikimono', 'k-shinbun', 'k-asobi', 'k-tanjobi', 'k-otoshimono', 'k-kyushoku', 'k-gakushu'], iinkai: ['i-daihyo', 'i-hoken', 'i-tosho', 'i-bika', 'i-taiiku', 'i-hoso', 'i-kyushoku', 'i-shiiku', 'i-saibai', 'i-shukai'] },
    jhs: { kakari: ['s-kokugo', 's-sugaku', 's-shakai', 's-rika', 's-eigo', 's-ongaku', 's-bijutsu', 's-taiiku', 's-gijutsu', 's-katei', 'k-kokuban', 'k-kubari', 'k-renraku', 'k-mado', 'k-keiji', 'k-teishutsu', 'k-ict', 'k-rec'], iinkai: ['i-gakkyu', 'i-fuku', 'i-seikatsu', 'i-hoken', 'i-tosho', 'i-bika', 'i-taiiku', 'i-hoso', 'i-kyushoku', 'i-koho', 'i-bunka', 'i-senkyo'] },
    hs: { kakari: ['s-kokugo', 's-sugaku', 's-shakai', 's-rika', 's-eigo', 's-taiiku', 's-joho', 's-geijutsu', 'k-kokuban', 'k-renraku', 'k-mado', 'k-keiji', 'k-ict', 'k-rec', 'k-shashin'], iinkai: ['i-hr', 'i-taiiku', 'i-bunka', 'i-tosho', 'i-hoken', 'i-bika', 'i-hoso', 'i-koho', 'i-senkyo'] },
  };
  const LV = { es: 'e', jhs: 'j', hs: 'h' };

  /* ───────── 人を決める計算（画面から切りはなして、テストで確かめる） ─────────
     roles: [{id, name, count}]、students: [{id}]
     o.keep: {roleId: [studentId]} … いま決まっている人（そのまま残す）
     o.wishes: {studentId: [roleId, roleId, roleId]} … 第1〜第3希望
     o.avoid: {studentId: [係の名前]} … 前の表と同じ係にしない
     o.fillRest … 希望がかなわなかった人・希望がない人を、空いている係にくじで入れる
     返り値：{ assign: {roleId: [studentId]}, log: [{text}], left: [studentId] } */
  function rng(seed) {
    let a = (seed == null ? Math.floor(Math.random() * 0xffffffff) : seed) >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function shuffle(arr, rand) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function start(roles, students, o) {
    const ids = new Set(students.map((s) => s.id));
    const assign = {}, has = new Map(students.map((s) => [s.id, 0]));
    for (const r of roles) {
      assign[r.id] = ((o.keep && o.keep[r.id]) || []).filter((id) => ids.has(id)).slice(0, Math.max(0, r.count | 0));
      for (const id of assign[r.id]) has.set(id, has.get(id) + 1);
    }
    const avoid = (sid, r) => !!(o.avoid && o.avoid[sid] && o.avoid[sid].includes(r.name));
    const cap = (r) => Math.max(0, (r.count | 0) - assign[r.id].length);
    return { assign, has, avoid, cap };
  }
  function fill(roles, students, st, rand, label) {
    const { assign, has, avoid, cap } = st;
    const left = shuffle(students.filter((s) => !has.get(s.id)).map((s) => s.id), rand);
    const placed = [], stuck = [];
    for (const sid of left) {
      const open = shuffle(roles.filter((r) => cap(r) > 0 && !avoid(sid, r) && !assign[r.id].includes(sid)), rand);
      // 空きの多い係から（かたよらないように）
      open.sort((a, b) => cap(b) - cap(a));
      const r = open[0];
      if (!r) { stuck.push(sid); continue; }
      assign[r.id].push(sid); has.set(sid, has.get(sid) + 1); placed.push([sid, r.id]);
    }
    return { placed, stuck, label };
  }
  function byWish(roles, students, o = {}) {
    const rand = rng(o.seed);
    const st = start(roles, students, o);
    const { assign, has, avoid, cap } = st;
    const log = [];
    const rankName = ['第1希望', '第2希望', '第3希望'];
    for (let rank = 0; rank < 3; rank++) {
      for (const r of shuffle(roles, rand)) {
        const want = students.filter((s) => !has.get(s.id) && o.wishes && o.wishes[s.id] && o.wishes[s.id][rank] === r.id);
        if (!want.length) continue;
        const ok = want.filter((s) => !avoid(s.id, r));
        if (ok.length < want.length) log.push({ kind: 'avoid', roleId: r.id, ids: want.filter((s) => avoid(s.id, r)).map((s) => s.id), text: r.name + '：前の表と同じ係なので、' + (want.length - ok.length) + '人の' + rankName[rank] + 'をとばしました。' });
        if (!ok.length) continue;
        const c = cap(r);
        if (c <= 0) { log.push({ kind: 'full', roleId: r.id, ids: ok.map((s) => s.id), text: r.name + '：もう定員なので、' + rankName[rank] + 'の' + ok.length + '人は' + (rank < 2 ? '次の希望へ。' : '空いている係へ。') }); continue; }
        if (ok.length <= c) { for (const s of ok) { assign[r.id].push(s.id); has.set(s.id, 1); } continue; }
        const win = shuffle(ok, rand).slice(0, c);
        for (const s of win) { assign[r.id].push(s.id); has.set(s.id, 1); }
        log.push({ kind: 'lottery', roleId: r.id, rank, ids: ok.map((s) => s.id), win: win.map((s) => s.id), text: r.name + '：' + rankName[rank] + 'が' + ok.length + '人（定員の残り' + c + '人）なので、くじで決めました。' });
      }
    }
    let left = students.filter((s) => !has.get(s.id)).map((s) => s.id);
    if (o.fillRest !== false && left.length) {
      const f = fill(roles, students, st, rand);
      if (f.placed.length) log.push({ kind: 'fill', ids: f.placed.map((x) => x[0]), text: '希望がかなわなかった人・希望がない人 ' + f.placed.length + '人を、空いている係にくじで入れました。' });
      left = f.stuck;
    }
    if (left.length) log.push({ kind: 'left', ids: left, text: left.length + '人の係が決まっていません（係の定員が足りません）。' });
    return { assign, log, left };
  }
  function byLottery(roles, students, o = {}) {
    const rand = rng(o.seed);
    const st = start(roles, students, o);
    const f = fill(roles, students, st, rand);
    const log = [];
    if (f.placed.length) log.push({ kind: 'fill', ids: f.placed.map((x) => x[0]), text: f.placed.length + '人をくじで決めました。' });
    if (f.stuck.length) log.push({ kind: 'left', ids: f.stuck, text: f.stuck.length + '人の係が決まっていません（係の定員が足りません）。' });
    return { assign: st.assign, log, left: f.stuck };
  }
  const api = {
    GROUPS, EVENTS, ITEMS, SETS, byWish, byLottery,
    // おすすめの組み合わせ（校種と種類）→ 係の一覧
    set(level, kind) { const lv = SETS[level] ? level : 'jhs'; return (SETS[lv][kind] || []).map((id) => ITEMS.find((x) => x.id === id)).filter(Boolean); },
    // 校種で絞る（other は全部）
    forLevel(level) { const k = LV[level]; return k ? ITEMS.filter((x) => x.lv.includes(k)) : ITEMS.slice(); },
    get(id) { return ITEMS.find((x) => x.id === id) || null; },
    eventLabel(id) { const e = EVENTS.find((x) => x.id === id); return e ? e.label : ''; },
  };
  root.RolesData = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

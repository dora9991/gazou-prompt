/* チラシのテンプレートと、紙面の計算（画面と切りはなした部品なので、Node でも動く：tools/test-flyer.cjs）
   ・FlyerTemplates.TEMPLATES … 15 のテンプレート（学習会・保護者会・学校説明会・体験授業・大会の応援・文化祭・体育祭・
       ボランティアと実行委員の募集・図書室・保健・進路の講演会・地域のイベント・お知らせ）。どれも見本の文入り
   ・FlyerTemplates.make(id, { today, school, teacher, grade, cls, isOff }) → 新しいチラシ（日付は今日から計算、{学校名} などは差し込み済み）
   ・STYLES（雰囲気 5つ）・PALETTES（色の組み合わせ。白黒で刷っても読める濃さ）・PAPERS（A4 たて・A4 よこ・B5 たて）・MOTIFS（絵）
   ・whenText / badge / applyText … 日時・申込みの書き方
   ・headSize(見出し, 幅pt, {maxPt, minPt, maxHeightPt}) … 見出しの文字の大きさ（幅に入る、いちばん大きい大きさ）
     headFit(…, {join}) … よこ向きの紙では、改行をはずして1行にしたほうがよいかも決める
   ・chooseScale(ratioAt) … 本文の大きさの倍率（紙に入るいちばん大きい倍率。入らなければ over）。fitNote … 紙面の下に出す知らせ
   ・shiftDate(f, 新しい日付) … 日付を変えたとき、終わりの日と締切も同じだけずらす
   ・contrast / grayContrast … 色の見やすさ（白黒の印刷機は、明るさだけで刷る） */
(function (root) {
  'use strict';
  const WD = ['日', '月', '火', '水', '木', '金', '土'];
  const pad = (n) => String(n).padStart(2, '0');
  const parse = (s) => { const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(String(s || '')); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
  const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
  const weekend = (s) => { const w = parse(s).getDay(); return w === 0 || w === 6; };

  /* ───────── 雰囲気・色・紙 ───────── */
  const STYLES = [
    { id: 'clean', label: 'すっきり' },
    { id: 'pop', label: 'ポップ' },
    { id: 'wa', label: '和風' },
    { id: 'board', label: '黒板風' },
    { id: 'news', label: '新聞風' },
  ];
  // main … 見出し・帯（白い文字をのせる。白黒でも濃い灰色になる濃さ）／wash … 地の色（黒い文字をのせる。白黒ではうすい灰色）
  // light … 濃い地の上の明るい色（黒板のチョーク）／accent … 飾りだけ（文字はのせない）
  const PALETTES = [
    { id: 'kon', label: '紺', main: '#1f3a68', accent: '#e8a317', wash: '#e9eef7', light: '#ffd96a' },
    { id: 'midori', label: '緑', main: '#1d5b43', accent: '#f0b429', wash: '#e5f2ea', light: '#fff1a8' },
    { id: 'aka', label: '朱', main: '#9e2f1c', accent: '#f2b134', wash: '#fbeae4', light: '#ffe0a3' },
    { id: 'momo', label: '桃', main: '#9b2f63', accent: '#f6a5c0', wash: '#fcebf2', light: '#ffd6e6' },
    { id: 'daidai', label: '橙', main: '#8f4300', accent: '#ffb23e', wash: '#fff1df', light: '#ffe2a8' },
    { id: 'murasaki', label: '紫', main: '#4a3486', accent: '#b9a6ec', wash: '#efebf9', light: '#e6dcff' },
    { id: 'sora', label: '空', main: '#0f5a78', accent: '#7cc7e2', wash: '#e4f3f8', light: '#c8f0ff' },
    { id: 'cha', label: '茶', main: '#5e3d22', accent: '#c99a5b', wash: '#f5ede3', light: '#f3dcb4' },
    { id: 'sumi', label: '白黒', main: '#222222', accent: '#9a9a9a', wash: '#eeeeee', light: '#ffffff' },
  ];
  // 紙（mm）。印刷の余白は MARGIN。base … 本文の大きさ（pt）、headMax … 見出しのいちばん大きい大きさ、headH … 見出しの高さの上限（mm）
  const MARGIN = 8;
  const PAPERS = {
    a4: { label: 'A4 たて', w: 210, h: 297, base: 12, headMax: 66, headH: 62, photoH: 62 },
    a4l: { label: 'A4 よこ', w: 297, h: 210, base: 11.5, headMax: 60, headH: 44, photoH: 56, land: true },
    b5: { label: 'B5 たて', w: 182, h: 257, base: 11, headMax: 58, headH: 54, photoH: 52 },
  };
  const CATS = [
    { id: 'study', label: '学習' },
    { id: 'event', label: '行事' },
    { id: 'family', label: '保護者・地域' },
    { id: 'boshu', label: '募集' },
    { id: 'dayori', label: 'おたより・お知らせ' },
  ];
  // 表の行（日時・場所・対象・持ち物・申込み・そのほか）。名前はテンプレートごとに変えられる
  const ROWS = ['when', 'place', 'target', 'bring', 'apply', 'extra'];
  const LABELS = { when: '日時', place: '場所', target: '対象', bring: '持ち物', apply: '申込み', extra: '' };
  // チラシが持つ文字の項目（どのテンプレートも、すべて持つ）
  const TEXT_KEYS = ['kicker', 'head', 'sub', 'body', 'place', 'target', 'bring', 'apply', 'extra', 'whenNote', 'contact', 'org', 'qrLabel'];

  /* ───────── 絵（100×100 の線画。f … 塗り m=濃い色 w=地の色 a=飾りの色 n=なし。k … 24 の目盛りの線を何倍にするか） ───────── */
  const circ = (cx, cy, r) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
  const MOTIFS = {
    pencil: { label: 'えんぴつ', shapes: [
      { d: 'M24 68L66 26L78 38L36 80Z', f: 'a' }, { d: 'M66 26L71 21L83 33L78 38Z', f: 'm' },
      { d: 'M71 21L74 18Q78 14 82 18L86 22Q90 26 86 30L83 33Z', f: 'w' }, { d: 'M24 68L36 80L15 89Z', f: 'w' },
      { d: 'M15 89L18.6 80.6L23.4 85.4Z', f: 'm' }, { d: 'M30 74L72 32', f: 'n' }, { d: 'M26 18v12M20 24h12', f: 'n' }] },
    sun: { label: 'たいよう', shapes: [
      { d: 'M50 6v11M50 83v11M6 50h11M83 50h11M19 19l8 8M73 73l8 8M19 81l8-8M73 27l8-8', f: 'n' },
      { d: circ(50, 50, 22), f: 'a' }, { d: 'M41 55q9 8 18 0', f: 'n' }, { d: 'M42 44v3M58 44v3', f: 'n' }] },
    book: { label: '本', shapes: [
      { d: 'M50 30C40 23 26 22 12 27V77C26 72 40 73 50 80Z', f: 'w' }, { d: 'M50 30C60 23 74 22 88 27V77C74 72 60 73 50 80Z', f: 'w' },
      { d: 'M20 38C28 36 36 37 42 40M20 48C28 46 36 47 42 50M20 58C28 56 36 57 42 60M58 40C64 37 72 36 80 38M58 50C64 47 72 46 80 48', f: 'n' },
      { d: 'M70 25V45L74.5 40.5L79 45V24.5', f: 'a' }] },
    star: { label: 'ほし', shapes: [
      { d: 'M50 10L61 37L90 39L67 57L75 86L50 70L25 86L33 57L10 39L39 37Z', f: 'a' }, { d: 'M86 10v10M81 15h10M14 72v8M10 76h8', f: 'n' }] },
    flag: { label: '旗', shapes: [
      { d: 'M4 20Q50 44 96 20', f: 'n' }, { d: 'M14.8 24.3L27.1 28.8L22 46Z', f: 'm' }, { d: 'M34.2 30.4L46.5 31.9L41 50Z', f: 'w' },
      { d: 'M53.5 31.9L65.8 30.4L60 50Z', f: 'a' }, { d: 'M72.9 28.8L85.2 24.3L80 46Z', f: 'w' }, { d: 'M18 66v20M58 62v20', f: 'n' }, { d: 'M18 66L34 71L18 76Z', f: 'a' }, { d: 'M58 62L74 67L58 72Z', f: 'm' }] },
    megaphone: { label: 'メガホン', shapes: [
      { d: 'M12 40H22V60H12Z', f: 'm' }, { d: 'M22 40L62 22V78L22 60Z', f: 'a' }, { d: 'M62 22C68 32 68 68 62 78', f: 'n' },
      { d: 'M30 63L34 80H42L39 66', f: 'w' }, { d: 'M74 38Q80 50 74 62M83 30Q93 50 83 70', f: 'n' }] },
    heart: { label: 'ハート', shapes: [
      { d: 'M50 84C20 64 10 48 14 34C18 20 36 16 50 32C64 16 82 20 86 34C90 48 80 64 50 84Z', f: 'a' }, { d: 'M27 35C29 29 33 27 38 26', f: 'n' }, { d: 'M86 62v9M81.5 66.5h9', f: 'n' }] },
    cross: { label: '保健', shapes: [
      { d: 'M24 14H76Q86 14 86 24V76Q86 86 76 86H24Q14 86 14 76V24Q14 14 24 14Z', f: 'w' }, { d: 'M42 28H58V42H72V58H58V72H42V58H28V42H42Z', f: 'a' }] },
    ume: { label: '梅', shapes: [
      { d: circ(50, 33, 14), f: 'w' }, { d: circ(66.2, 44.7, 14), f: 'w' }, { d: circ(60, 63.8, 14), f: 'w' }, { d: circ(40, 63.8, 14), f: 'w' }, { d: circ(33.8, 44.7, 14), f: 'w' },
      { d: circ(50, 50, 7), f: 'a' }, { d: 'M50 43v-7M56.7 47.8l6.6-2.2M54.1 55.7l4.1 5.6M45.9 55.7l-4.1 5.6M43.3 47.8l-6.6-2.2', f: 'n' }] },
    school: { label: '学校', shapes: [
      { d: 'M50 22V8L61 11.5L50 15', f: 'm' }, { d: 'M18 46H82V88H18Z', f: 'w' }, { d: 'M10 48L50 22L90 48Z', f: 'a' },
      { d: circ(50, 38, 6), f: 'w' }, { d: 'M50 35V38H53', f: 'n' }, { d: 'M43 88V70H57V88', f: 'm' }, { d: 'M25 56H35V64H25ZM65 56H75V64H65Z', f: 'w' }] },
    lantern: { label: 'ちょうちん', shapes: [
      { d: 'M50 16V7', f: 'n' }, { d: 'M40 24C14 34 14 66 40 76H60C86 66 86 34 60 24Z', f: 'a' }, { d: 'M28 37Q50 42 72 37M24 50H76M28 63Q50 58 72 63', f: 'n' },
      { d: 'M37 16H63V24H37Z', f: 'm' }, { d: 'M37 76H63V84H37Z', f: 'm' }, { d: 'M50 84V94M45 94H55', f: 'n' }] },
    mic: { label: 'マイク', shapes: [
      { d: 'M38 20A12 12 0 0 1 62 20V44A12 12 0 0 1 38 44Z', f: 'a' }, { d: 'M38 27H62M38 35H62', f: 'n' }, { d: 'M28 40V44A22 22 0 0 0 72 44V40', f: 'n' },
      { d: 'M50 66V82M34 86H66', f: 'n' }, { d: 'M84 18v10M79 23h10', f: 'n' }] },
    bulb: { label: '電球', shapes: [
      { d: 'M50 14C31 14 21 29 25 45C28 56 38 61 38 70H62C62 61 72 56 75 45C79 29 69 14 50 14Z', f: 'a' }, { d: 'M38 74H62V80H38ZM41 84H59V89H41Z', f: 'w' },
      { d: 'M44 70V58C44 52 40 50 40 46A4 4 0 0 1 48 46C48 50 46 52 50 52S52 50 52 46A4 4 0 0 1 60 46C60 50 56 52 56 58V70', f: 'n' }, { d: 'M10 22l7 4M90 22l-7 4M6 46h8M94 46h-8', f: 'n' }] },
    note: { label: '音符', shapes: [
      { d: 'M38 27L80 18V29L38 38Z', f: 'm' }, { d: 'M38 32V72M80 23V63', f: 'n' },
      { d: 'M25 72a13 9 0 1 0 26 0a13 9 0 1 0 -26 0Z', f: 'a' }, { d: 'M67 63a13 9 0 1 0 26 0a13 9 0 1 0 -26 0Z', f: 'a' }, { d: 'M16 16v10M11 21h10', f: 'n' }] },
    bell: { label: 'ベル', shapes: [
      { d: 'M46 15a4 4 0 0 1 8 0', f: 'n' }, { d: 'M50 15C34 15 28 29 28 45V62L20 72H80L72 62V45C72 29 66 15 50 15Z', f: 'a' },
      { d: 'M42 76a8 8 0 0 0 16 0', f: 'm' }, { d: 'M38 31Q35 41 36 52', f: 'n' }, { d: 'M12 32Q8 42 12 52M88 32Q92 42 88 52', f: 'n' }] },
    hand: { label: '手', k: 4, shapes: [
      { d: 'M8 13V5.5a1.5 1.5 0 0 1 3 0V11M11 10V4.5a1.5 1.5 0 0 1 3 0V11M14 10.5V6a1.5 1.5 0 0 1 3 0v8a7 7 0 0 1-7 7h-.5a6 6 0 0 1-5-2.7L3 15.5a1.5 1.5 0 0 1 2.4-1.8L8 16Z', f: 'a' },
      { d: 'M19.5 3.5l1.5-1.5M20.5 7h2', f: 'n' }] },
  };

  /* ───────── テンプレート ─────────
     when … 日付の決め方：in（今日から何日後より先）・dow（曜日 0=日）・md（毎年の月日 'MM-DD' より先）・days（何日間）・start/end（時刻）
     deadline … 申込みの締切（日付の何日前。なければ締切なし）
     文の {学校名} {先生名} {学年} {クラス} は、作るときに差しこむ */
  const T = (id, label, cat, style, palette, motif, desc, when, text, labels, more) =>
    Object.assign({ id, label, cat, style, palette, motif, desc, when, text, labels: Object.assign({}, LABELS, labels || {}) }, more || {});
  const TEMPLATES = [
    T('study-test', 'テスト前の学習会', 'study', 'board', 'midori', 'pencil', '放課後の学習会。わからない問題を持ってきてもらう',
      { in: 8, dow: 3, start: '15:50', end: '16:50' },
      {
        kicker: '{学年} 学習会のお知らせ', head: 'テスト前の\n学習会', sub: 'わからないを、そのままにしない。',
        body: '中間テストの前に、放課後の学習会を開きます。\nワークでつまずいた問題、授業で聞きそびれたところを持ってきてください。先生や友だちといっしょに解決しましょう。\n途中からの参加も、途中で帰るのも大丈夫です。',
        place: '図書室', target: '{学年}の希望者', bring: '筆記用具・ワーク・わからない問題', apply: 'いりません。直接来てください',
        extra: '', whenNote: '', contact: '{学校名}　学習係　{先生名}', org: '{学校名}', qrLabel: '',
      }),
    T('study-summer', '夏休みの学習会', 'study', 'pop', 'daidai', 'sun', '長い休みの学習会（5日間）。宿題と復習',
      { md: '07-21', dow: 1, days: 5, start: '9:30', end: '11:30' },
      {
        kicker: '夏休み 学習会', head: '夏休みの\n学習会', sub: '宿題も、苦手な単元も。5日間、いっしょにがんばろう！',
        body: '夏休みのはじめに、学習会を開きます。\n宿題を進めたい人、1学期の復習をしたい人、だれでも参加できます。\nわからないところは、先生や大学生のサポーターに気軽に聞いてください。',
        place: '多目的室（エアコンあり）', target: '全学年の希望者', bring: '筆記用具・夏休みの宿題・水筒', apply: '申込用紙を担任の先生に出してください',
        extra: '無料', whenNote: '1日だけの参加もできます', contact: '{学校名}　{先生名}', org: '{学校名}', qrLabel: '',
      }, { extra: '参加費' }, { deadline: -10 }),
    T('parents', '保護者会のお知らせ', 'family', 'wa', 'kon', 'ume', '学年保護者会の案内。出欠は連絡アプリで',
      { in: 13, dow: 5, start: '14:30', end: '16:00' },
      {
        kicker: '保護者の皆様へ', head: '学年保護者会の\nお知らせ', sub: '2学期の学習と生活、進路についてお話しします',
        body: '日ごろより、本校の教育活動にご理解とご協力をいただき、ありがとうございます。\n下記のとおり、学年保護者会を開きます。お忙しいところ恐れ入りますが、ご出席くださいますようお願いいたします。\n全体会のあと、学級ごとの懇談会があります。',
        place: '体育館（全体会）・各教室（学級懇談）', target: '{学年}の保護者の皆様', bring: '上ばき・この案内', apply: '連絡アプリで出欠をお知らせください',
        extra: 'ありません。徒歩か自転車でお越しください', whenNote: '', contact: '{学校名}　{先生名}', org: '{学校名}', qrLabel: '',
      }, { extra: '駐車場' }, { deadline: -6 }),
    T('school-info', '学校説明会', 'family', 'clean', 'sora', 'school', '小学6年生と保護者向け。授業・部活動の見学つき',
      { in: 20, dow: 6, start: '9:30', end: '11:30' },
      {
        kicker: '小学6年生と保護者の皆様へ', head: '学校説明会', sub: 'ようこそ、{学校名}へ。授業と部活動を見に来てください',
        body: '中学校の学習や生活について、校長と生徒会からご説明します。\n説明のあとは、授業と部活動の見学ができます。中学校の雰囲気を、ぜひ肌で感じてください。\n上ばきをお持ちでない方には、スリッパをご用意します。',
        place: '{学校名} 体育館', target: '小学6年生とその保護者', bring: '上ばき・筆記用具', apply: '学校のホームページの申込みフォームから',
        extra: 'グラウンドを開放します（台数に限りがあります）', whenNote: '', contact: '{学校名}　教務　{先生名}', org: '{学校名}', qrLabel: '申込みフォーム',
      }, { extra: '駐車場' }, { deadline: -7 }),
    T('trial-lesson', '体験授業', 'study', 'pop', 'murasaki', 'bulb', '小学生向けの体験授業。理科の実験・英語のゲーム',
      { in: 23, dow: 6, start: '13:30', end: '15:00' },
      {
        kicker: '小学生のみなさんへ', head: '中学校の授業を\n体験しよう！', sub: '理科の実験と、英語のゲーム。先輩もお手伝いします',
        body: '中学校の先生が、小学生のみなさんのために特別な授業をします。\n理科では、色が変わるふしぎな実験。英語では、ゲームで話す練習をします。\n友だちといっしょでも、ひとりでも参加できます。',
        place: '{学校名} 理科室・英語教室', target: '小学5・6年生（保護者の見学もできます）', bring: '筆記用具・上ばき・水筒', apply: '申込みフォームから（各30名・先着順）',
        extra: '無料', whenNote: '', contact: '{学校名}　{先生名}', org: '{学校名}', qrLabel: '申込みフォーム',
      }, { extra: '参加費' }, { deadline: -10 }),
    T('club-cheer', '部活の大会の応援', 'event', 'board', 'kon', 'megaphone', '大会の応援のお願い。会場・服装・きまり',
      { in: 11, dow: 6, start: '10:00' },
      {
        kicker: '応援のお願い', head: 'がんばれ！\nバスケットボール部', sub: '県大会に出場します。みんなの声援をとどけよう',
        body: '地区大会で優勝し、県大会への出場が決まりました。\n選手たちは、毎朝の自主練習を続けてきました。会場で、学校のみんなの応援を力にしたいと思っています。\nご家族・地域の皆様の応援も、お待ちしています。',
        place: '県立総合体育館 メインアリーナ', target: '応援に来られる方は、どなたでも', bring: '学校のジャージ・飲み物・タオル', apply: '',
        extra: '拍手と声援で。フラッシュでの撮影はできません', whenNote: '1回戦。勝てば午後に2回戦', contact: '{学校名}　バスケットボール部　{先生名}', org: '{学校名}', qrLabel: '',
      }, { when: '試合', target: '応援', bring: '服装・持ち物', extra: '応援のきまり' }),
    T('culture-fes', '文化祭', 'event', 'pop', 'momo', 'note', '文化祭の案内。合唱・展示・ステージ',
      { in: 29, dow: 6, start: '9:00', end: '15:00' },
      {
        kicker: '文化祭のご案内', head: '文化祭へ\nようこそ！', sub: 'テーマ「つなぐ」― 合唱・展示・ステージ発表',
        body: '生徒たちが準備してきた合唱コンクール、学級展示、ステージ発表をご覧いただけます。\n午前は合唱コンクール、午後はステージ発表と展示です。\nどなたでもご来場いただけます。生徒の作品にも、ぜひ声をかけてください。',
        place: '{学校名} 体育館・各教室', target: 'どなたでも（保護者・地域の皆様・小学生）', bring: '上ばき（スリッパもご用意しています）', apply: '',
        extra: 'ありません。公共交通機関でお越しください', whenNote: '', contact: '{学校名}　文化祭担当　{先生名}', org: '{学校名}', qrLabel: '',
      }, { target: 'ご来場', extra: '駐車場' }),
    T('sports-day', '体育祭', 'event', 'news', 'aka', 'flag', '体育祭の案内。見どころ・雨の日・撮影のお願い',
      { in: 20, dow: 6, start: '8:45', end: '15:00' },
      {
        kicker: '体育祭のお知らせ', head: '全力で走れ、\n心をひとつに。', sub: 'スローガンは「一致団結」。3学年の縦割りの団で競います',
        body: '生徒たちは、学年をこえた縦割りの団で、応援と競技の練習を重ねてきました。\n見どころは、午前の学年リレーと、午後の団対抗の大縄跳び。最後の全員リレーまで、目がはなせません。\n日差しが強くなります。帽子と飲み物をお持ちください。',
        place: '{学校名} グラウンド', target: '保護者・地域の皆様', bring: '帽子・飲み物・敷物', apply: '',
        extra: '保護者席からお願いします。SNSへの投稿はご遠慮ください', whenNote: '雨の場合は、次の月曜日に延期します', contact: '{学校名}　体育祭担当　{先生名}', org: '{学校名}', qrLabel: '',
      }, { target: '観覧', extra: '撮影' }),
    T('volunteer', 'ボランティア募集', 'boshu', 'clean', 'midori', 'heart', '生徒のボランティア募集（あいさつ運動）',
      { in: 6, dow: 1, days: 5, start: '7:50', end: '8:10' },
      {
        kicker: 'ボランティア募集', head: 'あいさつ運動\nボランティア', sub: '朝のあいさつで、学校をもっと明るく',
        body: '生徒会では、朝のあいさつ運動に参加してくれる人を募集します。\n校門に立って、登校してくる人に「おはようございます」と声をかけます。1日だけの参加でも大歓迎です。\n参加した人には、ボランティアの記録カードにスタンプを押します。',
        place: '正門・東門', target: '全学年', bring: '名札（ジャージでも参加できます）', apply: '生徒会室の前の用紙に、名前と参加する日を書いてください',
        extra: '1日10人まで', whenNote: '', contact: '{学校名}　生徒会担当　{先生名}', org: '{学校名} 生徒会', qrLabel: '',
      }, { target: '募集', extra: '定員' }, { deadline: -3 }),
    T('role-recruit', '係・実行委員の募集', 'boshu', 'board', 'sumi', 'hand', '体育祭の実行委員を募集。仕事の中身と集まり',
      { in: 9, dow: 2, start: '15:50', end: '16:30' },
      {
        kicker: '{学年} 実行委員募集', head: '体育祭の\n実行委員を募集！', sub: 'みんなの体育祭を、いちばん近くでつくる仕事です',
        body: '体育祭の実行委員を、各クラス2名募集します。\n種目の準備、当日の進行、応援合戦の打ち合わせなどを担当します。\nやってみたい人、話を聞いてみたい人は、気軽に担任の先生に声をかけてください。',
        place: '会議室', target: '{学年}の各クラス2名', bring: '筆記用具', apply: '担任の先生に、名前を伝えてください',
        extra: '昼休み・放課後に、週1回ほど', whenNote: '', contact: '{学校名}　体育祭担当　{先生名}', org: '{学校名}', qrLabel: '',
      }, { when: '1回目の集まり', target: '募集', extra: '活動' }, { deadline: -4 }),
    T('library', '図書室だより', 'dayori', 'news', 'cha', 'book', '読書週間の企画。貸し出しの冊数・展示',
      { in: 5, dow: 1, days: 12 },
      {
        kicker: '図書室だより', head: '秋の読書週間', sub: '1冊の本が、新しい世界への入口になる',
        body: '読書週間にあわせて、図書室で特別企画を行います。\n期間中は、1人5冊まで借りられます（ふだんは3冊）。新しく入った本のコーナーや、先生たちのおすすめの本の展示もあります。\n本のしおりを作るコーナーもあります。ぜひ図書室に来てください。',
        place: '図書室（2階）', target: '全校生徒', bring: '1人5冊まで（2週間）', apply: '',
        extra: 'おすすめ本の展示・しおり作り・ビブリオバトル', whenNote: '昼休みと放課後に開いています', contact: '図書委員会・図書館担当　{先生名}', org: '{学校名} 図書委員会', qrLabel: '',
      }, { when: '期間', bring: '貸し出し', extra: '企画' }),
    T('health', '保健のお知らせ', 'dayori', 'news', 'sora', 'cross', 'かぜ・インフルエンザの予防週間。3つのポイント',
      { in: 3, dow: 1, days: 5 },
      {
        kicker: 'ほけんだより', head: 'かぜ・インフルエンザ\n予防週間', sub: '「手洗い・換気・早寝」の3つで、元気に冬をこえよう',
        body: 'これからの季節は、かぜやインフルエンザがはやりやすくなります。\n① 外から帰ったら、石けんで30秒の手洗い\n② 休み時間ごとに、窓を開けて換気\n③ 夜は早めに寝て、朝ごはんをしっかり\n熱やせきがあるときは、無理をせずに休みましょう。',
        place: '各教室・保健室', target: '全校生徒', bring: 'ハンカチ・ティッシュ・マスク（必要な人）', apply: '',
        extra: '体調が悪いときは、がまんせずに来てください', whenNote: '', contact: '保健室　{先生名}', org: '{学校名} 保健室', qrLabel: '',
      }, { when: '期間', extra: '保健室' }),
    T('career-talk', '進路の講演会', 'study', 'wa', 'murasaki', 'mic', '卒業生の話を聞く進路講演会。保護者の参観も',
      { in: 17, dow: 4, start: '13:40', end: '15:20' },
      {
        kicker: '進路講演会のご案内', head: '「働く」を\n知る一日', sub: '地域で活躍する先輩3人に、仕事と進路の話を聞きます',
        body: '{学年}では、進路学習の一つとして、講演会を開きます。\n看護師、大工、IT企業で働く3人の卒業生をお招きし、仕事のやりがいや、中学生のうちにしておくとよいことをお話しいただきます。\n保護者の皆様も、ぜひご参観ください。',
        place: '体育館', target: '{学年}の生徒・保護者の皆様', bring: '筆記用具・進路ノート', apply: '参観を希望される保護者の方は、連絡アプリでお知らせください',
        extra: '本校の卒業生3名', whenNote: '5・6時間目', contact: '{学校名}　進路指導　{先生名}', org: '{学校名}', qrLabel: '',
      }, { extra: '講師' }, { deadline: -6 }),
    T('community', '地域のイベント', 'family', 'wa', 'aka', 'lantern', '地域のおまつり。中学生のボランティアの出番',
      { in: 19, dow: 0, start: '10:00', end: '14:00' },
      {
        kicker: '地域の皆様へ', head: 'ふれあい\n秋まつり', sub: '中学生のボランティアが、おまつりをお手伝いします',
        body: '今年も、地域の秋まつりが開かれます。\n中学生は、模擬店の手伝い、こども向けのゲームコーナー、吹奏楽部の演奏で参加します。\nご家族おそろいで、ぜひお出かけください。',
        place: '中央公園（{学校名}のとなり）', target: 'どなたでも', bring: 'ごみは、お持ち帰りください', apply: '',
        extra: '地域まちづくり協議会', whenNote: '小雨決行', contact: '{学校名}　地域連携担当　{先生名}', org: '{学校名}', qrLabel: '',
      }, { bring: 'お願い', extra: '主催' }),
    T('notice', 'お知らせ（なんでも）', 'dayori', 'clean', 'aka', 'bell', 'どんな連絡にも使える形。例は短縮授業',
      { in: 5, dow: 3, start: '14:20' },
      {
        kicker: 'お知らせ', head: '短縮授業の\nお知らせ', sub: 'この日は、下校の時刻が早くなります',
        body: '職員の研修のため、下記の日は短縮授業になります。\n給食のあと、5時間目で下校します。部活動はありません。\n下校の時刻が早くなりますので、ご家庭でもお声かけをお願いします。',
        place: '', target: '全校生徒', bring: '', apply: '',
        extra: 'ありません', whenNote: '一斉に下校します', contact: '{学校名}　教務　{先生名}', org: '{学校名}', qrLabel: '',
      }, { when: '下校', extra: '部活動' }),
  ];
  const byId = Object.fromEntries(TEMPLATES.map((t) => [t.id, t]));

  /* ───────── 差し込み ───────── */
  const FALLBACK = { 学校名: '本校', 先生名: '担当の先生', 学年: '全学年', クラス: '学級' };
  function fill(text, vars) {
    return String(text || '').replace(/\{([^{}]+)\}/g, (all, k) => {
      const v = vars && vars[k];
      if (v != null && String(v).trim() !== '') return String(v).trim();
      return FALLBACK[k] != null ? FALLBACK[k] : all;
    }).replace(/[ 　]{2,}/g, '　').split('\n').map((l) => l.trim()).join('\n');
  }
  // クラスの名前から学年（'2年3組' → '2年'）
  const gradeOf = (cls) => { const m = /(\d+)\s*年/.exec(String(cls || '').normalize('NFKC')); return m ? m[1] + '年' : ''; };

  /* ───────── 日付 ───────── */
  // テンプレートの決め方から、日付（と終わりの日）を出す。平日の行事が休みの日に当たれば、次の週へ
  function dateOf(when, today, isOff) {
    const off = isOff || weekend;
    const t = parse(today) || new Date();
    let d;
    if (when.md) {
      const [m, dd] = when.md.split('-').map(Number);
      d = new Date(t.getFullYear(), m - 1, dd);
      if (d - t < 3 * 86400000) d = new Date(t.getFullYear() + 1, m - 1, dd);
    } else { d = new Date(t); d.setDate(d.getDate() + (when.in || 14)); }
    if (when.dow != null) while (d.getDay() !== when.dow) d.setDate(d.getDate() + 1);
    let s = ymd(d);
    if (when.dow >= 1 && when.dow <= 5) for (let g = 0; g < 8 && off(s); g++) s = addDays(s, 7);
    return { date: s, endDate: when.days > 1 ? addDays(s, when.days - 1) : '' };
  }
  // 締切：日付の n 日前。休みの日なら、その前の日
  function deadlineOf(date, n, today, isOff) {
    if (n == null || n === false || !date) return '';
    const off = isOff || weekend;
    let s = addDays(date, n);
    for (let g = 0; g < 10 && off(s); g++) s = addDays(s, -1);
    if (today && s < today) s = today;
    return s;
  }

  // 時刻を 'HH:MM' に（入力欄の time は '9:30' を読めない）
  const hhmm = (s) => { const m = /^(\d{1,2}):(\d{2})/.exec(String(s || '').trim()); return m && +m[1] < 24 ? pad(+m[1]) + ':' + m[2] : ''; };

  /* ───────── 新しいチラシ ───────── */
  function make(id, ctx = {}) {
    const t = byId[id] || TEMPLATES[0];
    const today = ctx.today || ymd(new Date());
    const vars = { 学校名: ctx.school, 先生名: ctx.teacher, 学年: ctx.grade || gradeOf(ctx.cls), クラス: ctx.cls };
    const w = dateOf(t.when, today, ctx.isOff);
    const f = { tpl: t.id, style: t.style, palette: t.palette, paper: 'a4', motif: t.motif };
    for (const k of TEXT_KEYS) f[k] = fill(t.text[k] || '', vars);
    if (!ctx.school && /^\{学校名\}$/.test(t.text.org || '')) f.org = '';
    Object.assign(f, { date: w.date, endDate: w.endDate, start: hhmm(t.when.start), end: hhmm(t.when.end), deadline: t.deadline ? deadlineOf(w.date, t.deadline, today, ctx.isOff) : '' });
    f.labels = Object.assign({}, t.labels);
    Object.assign(f, { qr: '', photo: '', photoCap: '' });
    return f;
  }

  /* ───────── 日時・申込みの書き方 ───────── */
  const hm = (s) => { const m = /^(\d{1,2}):(\d{2})/.exec(String(s || '')); return m ? +m[1] + ':' + m[2] : ''; };
  const jd = (s) => { const d = parse(s); return d ? (d.getMonth() + 1) + '月' + d.getDate() + '日（' + WD[d.getDay()] + '）' : ''; };
  function whenText(f) {
    const d = parse(f.date), e = parse(f.endDate);
    let date = jd(f.date);
    if (d && e && e > d) date += '〜' + (e.getMonth() === d.getMonth() && e.getFullYear() === d.getFullYear() ? '' : (e.getMonth() + 1) + '月') + e.getDate() + '日（' + WD[e.getDay()] + '）';
    const s = hm(f.start), en = hm(f.end);
    const time = s && en ? s + '〜' + en : s ? s + '〜' : en ? '〜' + en : '';
    return { date, time, full: [date, time].filter(Boolean).join(' ') };
  }
  function badge(f) {
    const d = parse(f.date), e = parse(f.endDate);
    if (!d) return null;
    const s = hm(f.start);
    return { md: (d.getMonth() + 1) + '/' + d.getDate(), wd: WD[d.getDay()], sub: e && e > d ? '〜' + (e.getMonth() + 1) + '/' + e.getDate() + '（' + WD[e.getDay()] + '）' : s ? s + '〜' : '' };
  }
  function applyText(f) {
    const a = String(f.apply || '').trim(), dl = jd(f.deadline);
    if (dl && a) return dl + 'までに、' + a;
    if (dl) return dl + 'まで';
    return a;
  }
  // 表に出す行（中身のない行は出さない）
  function rows(f) {
    const L = Object.assign({}, LABELS, f.labels || {});
    const out = [];
    const w = whenText(f);
    if (w.full || String(f.whenNote || '').trim()) out.push({ key: 'when', label: L.when, value: w.full, date: w.date, time: w.time, note: String(f.whenNote || '').trim() });
    for (const k of ['place', 'target', 'bring']) if (String(f[k] || '').trim()) out.push({ key: k, label: L[k], value: String(f[k]).trim() });
    const ap = applyText(f);
    if (ap) out.push({ key: 'apply', label: L.apply, value: ap });
    if (String(f.extra || '').trim()) out.push({ key: 'extra', label: L.extra || 'そのほか', value: String(f.extra).trim() });
    return out;
  }

  /* ───────── 見出しの大きさ ─────────
     日本語の文字は 1文字＝1em、英数字は約 0.55〜0.66em として幅を見積もる。
     改行はそのまま。1行が長いときは 2〜3行に折り返す前提で、いちばん大きくなる大きさを選ぶ */
  function textEm(s, ls = 0) {
    let w = 0;
    for (const ch of String(s || '')) {
      const c = ch.codePointAt(0);
      if (c === 0x20) w += 0.3;
      else if (c < 0x7f) w += /[A-Z0-9MWmw@%&#]/.test(ch) ? 0.66 : 0.55;
      else if (c >= 0xff61 && c <= 0xff9f) w += 0.5;
      else w += 1;
      w += ls;
    }
    return w;
  }
  function headSize(text, widthPt, o = {}) {
    const maxPt = o.maxPt || 60, minPt = o.minPt || 20, lh = o.lineHeight || 1.2, ls = o.ls == null ? 0.03 : o.ls;
    const lines = String(text || '').split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lines.length || !(widthPt > 0)) return { pt: maxPt, lines: 0, wrap: 1, tooLong: false };
    const longest = Math.max(...lines.map((l) => textEm(l, ls)));
    let best = null;
    for (let wrap = 1; wrap <= 3; wrap++) {
      if (wrap > 1 && longest < 4) break;
      const per = longest / wrap + (wrap > 1 ? 1 : 0);       // 折り返すと行の長さがそろわないので、1文字ぶん余らせる
      const n = lines.length * wrap;
      let pt = Math.min(maxPt, widthPt / per);
      if (o.maxHeightPt) pt = Math.min(pt, o.maxHeightPt / (n * lh));
      if (!best || pt > best.pt * 1.2) best = { pt, lines: n, wrap };       // 折り返すのは、2割以上大きくなるときだけ
    }
    const pt = Math.max(minPt, Math.floor(best.pt * 2) / 2);
    return { pt, lines: best.lines, wrap: best.wrap, tooLong: best.pt < minPt };
  }

  // 改行をはずして1行にする（日本語どうしはそのまま、英数字どうしは空白をはさむ）
  function joinLines(text) {
    return String(text || '').split('\n').map((l) => l.trim()).filter(Boolean)
      .reduce((a, l) => a + (a && /[\x21-\x7e]$/.test(a) && /^[\x21-\x7e]/.test(l) ? ' ' : '') + l, '');
  }
  // 見出しの並べ方。o.join（よこ向きの紙など、幅に余裕があるとき）は、改行をはずして1行に入れたほうが
  // 大きさがあまり変わらない（3/4 以上）なら1行にする（高さが浮く）。text … 紙面に出す見出しの文字
  function headFit(text, widthPt, o = {}) {
    const asIs = Object.assign(headSize(text, widthPt, o), { text: String(text || '').split('\n').map((l) => l.trim()).filter(Boolean).join('\n'), joined: false });
    if (!o.join || asIs.lines < 2 || !/\n/.test(asIs.text)) return asIs;
    const t = joinLines(text);
    const one = headSize(t, widthPt, o);
    return one.lines === 1 && one.pt >= asIs.pt * 0.75 ? Object.assign(one, { text: t, joined: true }) : asIs;
  }

  /* ───────── 本文の大きさ ─────────
     ratioAt(k) … 倍率 k のときの「中身の高さ ÷ 紙の高さ」。1 より大きいとあふれる。
     ゆとりがあれば少し大きく（1.2 倍まで。ただし紙の 92% まで）、あふれれば小さく（0.7 倍まで）。それでも入らなければ over */
  const STEPS = [1.2, 1.12, 1.06, 1, 0.94, 0.88, 0.82, 0.76, 0.7];
  function chooseScale(ratioAt, o = {}) {
    const steps = o.steps || STEPS, room = o.room == null ? 0.92 : o.room;
    let last = 1;
    for (const k of steps) {
      const r = ratioAt(k);
      last = r;
      if (k > 1 ? r <= room : r <= 1.002) return { k, ratio: r, over: false, shrunk: k < 1 };
    }
    return { k: steps[steps.length - 1], ratio: last, over: true, shrunk: true };
  }

  // 紙面の下に出す知らせ（r … chooseScale の結果に、見出しの結果 head をそえたもの）。tone … ok／warn（小さくした）／bad（入りきらない）
  function fitNote(r, paperId) {
    if (!r) return { tone: '', text: '' };
    const P = PAPERS[paperId] || PAPERS.a4;
    const headNote = r.head && r.head.tooLong ? '見出しが長いので、小さくなっています。Enter で2行に分けると大きくなります。' : '';
    if (r.over) {
      const tips = ['本文を短くする', '写真を外す'];
      if (paperId !== 'a4') tips.push('紙を A4 たてにする');
      return { tone: 'bad', text: '文字が多くて、1枚に入りきりません（下が切れて印刷されます）。' + tips.join('・') + 'と、入ります。' };
    }
    if (r.shrunk) return { tone: 'warn', text: '文字が多いので、文字を少し小さくしました（' + Math.round(r.k * 100) + '%）。' + headNote };
    return { tone: headNote ? 'warn' : 'ok', text: P.label + '・1枚に入っています。' + headNote };
  }

  // 日付を変えたとき、終わりの日と締切も同じだけずらす（締切は休みの日なら前の日へ）
  function shiftDate(f, date, today, isOff) {
    const o = Object.assign({}, f);
    if (!parse(date)) { o.date = ''; return o; }
    if (parse(f.date)) {
      const delta = Math.round((parse(date) - parse(f.date)) / 86400000);
      if (parse(f.endDate)) o.endDate = addDays(f.endDate, delta);
      if (parse(f.deadline)) o.deadline = deadlineOf(date, Math.round((parse(f.deadline) - parse(f.date)) / 86400000), today, isOff);
    }
    o.date = date;
    if (o.endDate && o.endDate <= o.date) o.endDate = '';
    if (o.deadline && o.deadline > o.date) o.deadline = '';
    return o;
  }

  /* ───────── 色の見やすさ ───────── */
  const rgb = (hex) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim()); const n = m ? parseInt(m[1], 16) : 0; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const lum = (hex) => { const [r, g, b] = rgb(hex); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); };
  const ratio = (a, b) => { const x = Math.max(a, b), y = Math.min(a, b); return (x + 0.05) / (y + 0.05); };
  const contrast = (a, b) => ratio(lum(a), lum(b));
  // 白黒の印刷機・コピー機は、色を明るさ（0.299R+0.587G+0.114B）にして刷る
  const gray = (hex) => { const [r, g, b] = rgb(hex); const v = Math.round(0.299 * r + 0.587 * g + 0.114 * b); const hh = v.toString(16).padStart(2, '0'); return '#' + hh + hh + hh; };
  const grayContrast = (a, b) => contrast(gray(a), gray(b));
  const palette = (id) => PALETTES.find((p) => p.id === id) || PALETTES[0];

  const api = {
    STYLES, PALETTES, PAPERS, MARGIN, CATS, ROWS, LABELS, TEXT_KEYS, MOTIFS, TEMPLATES, FALLBACK, STEPS,
    get: (id) => byId[id] || null, palette, make, fill, gradeOf, dateOf, deadlineOf, hhmm,
    whenText, badge, applyText, rows, textEm, headSize, headFit, joinLines, chooseScale, fitNote, shiftDate, contrast, grayContrast, gray, lum,
  };
  root.FlyerTemplates = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

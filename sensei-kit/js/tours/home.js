// 使い方のデモ：ホーム（手順の書き方は js/demo.js の先頭）
// ホームは保存が変わるたびに描き直すので、囲む所は毎回さがし直せる指し方（セレクタ・関数）にする
(function () {
  const D = Kit.demo;
  const narrow = () => window.innerWidth < 640;
  const room = () => {}; // スマホの下の余白は、土台（デモの説明中は .mb-view の下に余白）がつける
  // ほかの道具を開いたあとに「戻る」などで来たときは、ホームに戻しておく
  const goHome = async () => {
    if (Kit.current() !== 'home') {
      Kit.go('home');
      for (let k = 0; k < 60 && Kit.current() !== 'home'; k++) await new Promise((r) => setTimeout(r, 30));
      await Kit.mounted();
    }
    room();
  };
  const sec = (label) => D.q('section[aria-label="' + label + '"]');
  // スマホでは長い箱の全体は入らないので、中の最初の1つを囲む（なければ箱ごと）
  const first = (label, inner) => () => (narrow() && D.q('section[aria-label="' + label + '"] ' + inner)()) || sec(label)();
  // 道具箱：パソコンは最初の段（クラスの道具）、スマホは最初のカード1枚を囲む
  const tools = () => D.q('section[aria-label="道具箱"] ' + (narrow() ? '.hm-tool' : '.hm-group'))() || sec('道具箱')();
  // 道具箱のカード（名前でさがして、カード全体を返す）
  const tool = (name) => () => { const t = D.text('.hm-tool-title', name)(); return t ? t.closest('.hm-tool') : null; };
  // 開いた道具の見出しの「使い方を見る」。出ていなければ、上の「デモ中」の帯（#mb-view の外にあるので、ページ全体からさがす）
  const demoBtn = () => D.q('.app-head .demo-btn')() || document.querySelector('.demo-ribbon');
  Kit.tour('home', [
    { before: goHome, el: () => sec('はじめての方へ')() || first('今日・明日やること', '.list-item')(), title: 'はじめの3歩', text: '名簿 → 席替え → 係・当番の順に使うと、ほかの道具にもつながります。それぞれ「使い方を見る」でデモが見られます。' },
    { before: goHome, el: first('今日・明日やること', '.list-item'), title: '今日・明日やること', text: '予定・リマインダー・宿題の締切から、今日と明日の分がここに集まります。押すと、その道具が開きます。' },
    { before: goHome, el: sec('今日の時間割'), title: '今日の時間割と当番', text: '「時間割」でつくった今日の授業と、今日の日直・今週の給食当番が出ます。' },
    { before: goHome, el: tools, title: '道具箱', text: 'クラス・授業・予定・通信の道具が並びます。カードの下に、いまの様子（何件あるか など）が出ます。' },
    { before: goHome, el: tool('席替え'), title: '道具を開く', text: 'カードを押すと、その道具が開きます。例として「席替え」を開いてみます。', doLabel: '開いてみる', do: async (d) => { await d.click(tool('席替え')); }, after: 900 },
    { el: demoBtn, title: 'どの道具にもデモ', text: 'どの道具も、見出しの横の「使い方を見る」で、いまのようなデモが見られます。あなたのデータは変わりません。' },
    { before: goHome, el: sec('データの扱い'), title: 'データの扱い', text: 'どこに保存しているかと、名前の扱いの注意がまとめてあります。一度読んでおくと安心です。' },
    { before: goHome, el: '#hm-backup', title: 'バックアップと引っ越し', text: 'ときどき「バックアップを書き出す」で保存しておくと安心です。「ほかの端末へ移す」で、家のパソコンにも移せます。' },
  ]);
})();

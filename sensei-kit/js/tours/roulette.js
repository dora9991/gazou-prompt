// 使い方のデモ：ルーレット（手順の書き方は js/demo.js の先頭）。デモの中では音は鳴らない
(function () {
  const D = Kit.demo;
  const MODE = '.ru-set [aria-label="決め方"]';
  // 決まった札・順番の一覧・発表モードは、画面の外側（body の直下）に出るので、ページ全体からさがす
  const top = (sel) => () => { const e = document.querySelector(sel); return e && e.getBoundingClientRect().width > 0 ? e : null; };
  const card = top('.ru-reveal .ru-card');
  // 回して、決まった瞬間の大きな札が出るまで待つ
  const spinAndWait = async (d, scope) => { await d.click(D.btn('回す', scope)); await d.find(card, 20000); await d.wait(500); };
  Kit.tour('roulette', [
    {
      el: '.ru-set [aria-label="選ぶもの"]', title: '何から選ぶか',
      text: '名簿のクラスの生徒・番号の範囲（1〜40番など）・自由な項目（班やテーマ）から選べます。デモは架空の「2年3組」です。',
    },
    { el: D.text(MODE + ' button', '1人だけ選ぶ'), title: '決め方を選ぶ', text: '「1人だけ選ぶ」「全員の順番を決める」「当たったら外して続ける」の3つ。まずは1人だけ選びます。', click: true, after: 400 },
    {
      el: '.ru-stage', title: 'ルーレットを回す', doLabel: '回してみる',
      text: '「回す」を押すと盤が回り、だんだん遅くなります。止まる直前は、となりで止まりかけてからスローで決まります。',
      do: async (d) => { await spinAndWait(d, '.ru-stage'); },
      after: 200,
    },
    {
      el: card, title: '決まった瞬間を大きく', doLabel: '閉じる',
      text: '番号と名前が大きく出て、紙吹雪が舞います。クラスの帯の「名前を隠す」をオンにすると、番号だけになります。',
      do: async (d) => { await d.click(D.btn('閉じる', '.ru-reveal')); },
      after: 300,
    },
    { el: D.text(MODE + ' button', '全員の順番を決める'), title: '発表の順番を決める', text: '「全員の順番を決める」にすると、当たった人から順に並びます。当たった人は盤から外れます。', click: true, after: 500 },
    {
      el: '.ru-stage', title: '1人ずつ回す', doLabel: '2人決めてみる',
      text: '回すたびに1人ずつ決まります。決まった札の「次を回す」で、続けて回せます。',
      do: async (d) => {
        await spinAndWait(d, '.ru-stage');
        await d.click(D.btn('次を回す', '.ru-reveal'));
        await d.find(card, 20000); await d.wait(500);
        await d.click(D.btn('閉じる', '.ru-reveal'));
      },
      after: 300,
    },
    { el: '.ru-ordercard', title: '決まった順に並ぶ', text: '決まった順番は、ここに並びます。まちがえたときは、盤の下の「1つ戻す」で取り消せます。' },
    {
      el: D.btn('発表モード', '.app-head'), title: '発表モード（画面いっぱい）', doLabel: '開いてみる',
      text: 'プロジェクターで映すときは、黒板の色の大きな画面に。スペースキーでも回せます。',
      do: async (d) => {
        await d.click(D.btn('発表モード', '.app-head'));
        await d.wait(400);
        await spinAndWait(d, '.ru-show');
        await d.click(D.btn('閉じる', '.ru-reveal'));
        await d.wait(700);
        await d.click(D.btn('閉じる', '.ru-show-top'));
      },
      after: 300,
    },
    {
      el: D.btn('のこりをまとめて決める', '.ru-stage'), title: 'のこりは、まとめて', doLabel: 'まとめて決める',
      text: '人数が多いときは、のこりの順番をまとめてくじで決められます（1人ずつ回すのと同じ確率です）。',
      do: async (d) => { await d.click(D.btn('のこりをまとめて決める', '.ru-stage')); await d.click(D.modalBtn('まとめて決める')); await d.find(top('.ru-list-head'), 4000); },
      after: 500,
    },
    {
      el: top('.ru-list-head'), title: '順番の一覧', doLabel: '閉じる',
      text: '決まった順番を画面いっぱいに映せます。A4 の印刷と、Excel に貼れるコピーもここからできます。',
      do: async (d) => { await d.click(D.btn('閉じる', '.ru-list-head')); },
      after: 300,
    },
    { el: '.ru-speed', title: '速さと音', text: '「さっと」と「じっくり」を選べます。ドラムロールと決まったときの音は、ここで止められます（デモでは鳴りません）。' },
    { el: '.ru-hist', title: 'その場の記録', text: '当たった結果は、新しい順にここに残ります。ページを閉じると消えるので、残したい順番は印刷かコピーで。' },
  ]);
})();

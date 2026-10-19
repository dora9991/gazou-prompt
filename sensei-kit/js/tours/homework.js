// 使い方のデモ：宿題・提出（手順の書き方は js/demo.js の先頭）
(function () {
  const D = Kit.demo;
  const TITLE = 'ワーク P.30〜31';
  const card = () => D.text('.hw-card', TITLE)();
  const inCard = (sel) => () => { const c = card(); return c ? D.q(sel, c)() : null; };
  // チェックの画面の n 番目の名前
  const student = (n) => () => { const m = D.modal()(); return m ? [...m.querySelectorAll('.hw-st')][n] || null : null; };

  Kit.tour('homework', [
    { el: '.hw-list', title: '出した宿題の一覧', text: '宿題ごとに、何人出したかが一目で分かります。締切をすぎると赤い字になります。' },
    {
      el: D.btn('宿題を出す', '.app-head'), title: '宿題を出す', text: '題名と締切を入れて「出す」を押します。締切はカレンダーにも出ます。', doLabel: '出してみる',
      do: async (d) => {
        await d.click(D.btn('宿題を出す', '.app-head'));
        await d.type(D.modal('#hw-f-title'), TITLE);
        await d.pick(D.modal('#hw-f-due'), Kit.rel(1)); // 締切は明日（一覧の上のほうに並ぶ）
        await d.wait(300);
        await d.click(D.modalBtn('出す'));
      },
      after: 700,
    },
    {
      el: () => { const c = card(); return c ? D.btn('チェック', c)() : null; }, title: '名簿でチェック', text: '一覧に入りました。「チェック」を押すと、クラスの名簿が出ます。',
      click: true, after: 500,
    },
    {
      // スマホは名簿が画面より長いので、最初の1人を囲む
      el: () => (window.innerWidth < 640 ? student(0)() : D.modal('.hw-grid')()), title: '名前をタップ', text: '押すたびに「まだ → 済 → 遅れ → 免除」と変わります。出した人から押していきます。', doLabel: 'つけてみる',
      do: async (d) => {
        for (const n of [0, 1, 3, 4]) { await d.click(student(n)); await d.wait(120); }
        await d.click(student(2)); // 2回押すと「遅れ」
        await d.wait(200);
        await d.click(student(2));
      },
      after: 600,
    },
    {
      el: D.modal('.hw-sum'), title: 'まだの人が分かる', text: '済・遅れ・まだの人数が出ます。「まだ」のまま残った人に、声をかけられます。', doLabel: '閉じる',
      do: async (d) => { await d.click(D.modal('.modal-f .btn.primary')); },
      after: 600,
    },
    { el: inCard('.hw-prog'), title: '一覧にも数が出る', text: '一覧にも提出の人数が出ます。「まだの人をコピー」で、まだの人の名前を連絡に使えます。' },
    { el: D.btn('かんたん成績へ（CSV）', '.app-head'), title: '成績にもつなげる', text: '1人ずつの提出の数を書き出して、かんたん成績に取り込めます。' },
  ]);
})();

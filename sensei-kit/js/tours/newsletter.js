// 使い方のデモ：学級通信（手順の書き方は js/demo.js の先頭）
(function () {
  const D = Kit.demo;
  const narrow = () => window.innerWidth < 640;
  const room = () => {}; // スマホの下の余白は、土台（デモの説明中は .mb-view の下に余白）がつける
  // せまい画面は「つくる／見る」を切りかえて見せる（広い画面では切りかえが出ないので、何もしない）
  const pane = (label) => { const b = D.btn(label, '.nl-pane-seg')(); if (b && b.getAttribute('aria-pressed') !== 'true') b.click(); };
  // 手順の前の準備：開いたままのダイアログ（「戻る」で来たとき）を閉じて、余白を足す
  const prep = (fn) => async (d) => { Kit.closeModals(); if (fn) await fn(d); room(); };
  // 号を開いた画面にいるとき（「もう一度」「戻る」で来たとき）は、一覧に戻しておく
  const toList = prep(async (d) => { const b = D.btn('一覧', '.nl-bar')(); if (b) { b.click(); await d.find(D.q('.nl-card'), 2500); } });
  const write = prep(async () => pane('つくる'));
  // 紙面の見た目と「1枚に入るか」の行。広い画面では紙面が右に貼りついて（sticky）下の行が画面の外に出るので、
  // ページのいちばん下まで送ってから見せる（そこで紙面の下の行が画面に入る）
  const look = prep(async (d) => {
    pane('見る');
    if (window.innerWidth >= 1100) { window.scrollTo(0, document.documentElement.scrollHeight); await d.wait(200); }
  });
  // 「戻る」で来たときは、カレンダーから入れるダイアログを開き直しておく
  const calendar = async (d) => {
    if (D.modal()()) return;
    const b = D.btn('カレンダーから入れる', '.nl-ed')();
    if (b) { b.click(); await d.find(D.modal(), 2500); }
  };
  // 題字：スマホは欄が縦に並んで長いので、通信の名前の段だけ囲む
  const mast = () => (narrow() ? D.q('section[aria-label="題字"] .nl-grid2')() : D.q('section[aria-label="題字"]')());
  // 予定表の行：スマホは1行が縦に長いので、最初の1行だけ囲む
  const rows = () => (narrow() ? D.q('.nl-rows .nl-row:not(.nl-row-h)')() : D.q('.nl-rows')());
  Kit.tour('newsletter', [
    { before: toList, el: D.btn('開く', '.nl-card'), title: '号を開く', text: '架空のクラスの「かけはし 第12号」を開きます。「次の号」を押すと、前の号を写して続きをつくれます。', click: true, after: 900 },
    { before: write, el: mast, title: '題字を決める', text: '通信の名前・号・発行日を入れます。「紙・段・見た目」で、A4・B4や2段組みを選べます。' },
    {
      before: write, el: D.q('.nl-be'), title: '文章を書く', text: '見出しと本文を書きます。書いたそばから紙面に入ります。見出しを書きかえてみます。', doLabel: '書きかえてみる',
      do: async (d) => { await d.type(D.q('.nl-be input[aria-label="見出し"]'), '全員で走りきった体育祭'); },
      after: 800,
    },
    { before: write, el: D.btn('カレンダーから入れる', '.nl-ed'), title: '予定はカレンダーから', text: '予定表は、カレンダーに入れた行事・テストから、日ごとに入れられます。', doLabel: '開いてみる', do: async (d) => { await d.click(D.btn('カレンダーから入れる', '.nl-ed')); }, after: 600 },
    {
      before: calendar, el: D.modal(), title: '期間と種類を選ぶ', text: '「次の週」「2週間」などの期間と、入れる予定の種類を選びます。宿題の締切も入れられます。', doLabel: '入れてみる',
      do: async (d) => {
        await d.click(D.modalBtn('入れる'));
        // いまの行が埋まっていると「置きかえますか」と聞かれる
        if (await d.find(D.modalBtn('置きかえる'), 1500)) await d.click(D.modalBtn('置きかえる'));
      },
      after: 900,
    },
    { before: write, el: rows, title: '予定が入りました', text: '平日は予定がなくても行ができるので、持ち物などを書き足せます。土日・祝日は予定のある日だけです。' },
    { before: look, el: '.nl-status', title: '1枚に入るか見る', text: '紙面の見た目の下に、1枚に入るかが出ます。入りきらないときは、切れる所に赤い線と、直し方が出ます。' },
    { before: prep(), el: '.nl-bar .btn-row', title: '印刷・Word・コピー', text: '「印刷」でA4・B4に刷れます。「Word に書き出す」で学校の様式へ、「文章をコピー」で連絡アプリに貼れます。' },
  ]);
})();

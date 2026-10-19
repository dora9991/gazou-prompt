// 使い方のデモ：連絡テンプレート（手順の書き方は js/demo.js の先頭）
(function () {
  const D = Kit.demo;
  const room = () => {}; // スマホの下の余白は、土台（デモの説明中は .mb-view の下に余白）がつける
  // スマホは「一覧」と「入れる画面」が分かれるので、一覧を見せたい手順の前に戻しておく（広い画面では何もしない）
  const toList = async () => { Kit.closeModals(); const b = D.btn('ひな形の一覧', '.tp-back')(); if (b) b.click(); room(); };
  const isOpen = (t) => { const h2 = document.querySelector('#mb-view .tp-head h2'); return !!h2 && h2.textContent.includes(t); };
  // 「戻る」で来たときも、そのひな形を開いた状態にしておく（指は出さない）
  const ensure = (t) => async (d) => { if (!isOpen(t)) { await toList(); const it = await d.find(D.text('.tp-it', t), 1500); if (it) it.click(); } room(); };
  const MOTI = '持ち物のお願い';
  Kit.tour('templates', [
    { before: toList, el: D.btn('保護者へ', '.tp-groups'), title: '相手でしぼる', text: 'ひな形は、保護者・生徒・先生あてに分かれています。「保護者へ」でしぼってみます。', click: true, after: 500 },
    { before: toList, el: D.text('.tp-it', MOTI), title: 'ひな形を選ぶ', text: '使いたいひな形を押します。例として「持ち物のお願い」を開きます。', click: true, after: 700 },
    { before: ensure(MOTI), el: '.tp-auto', title: '自動で入るもの', text: 'クラスと先生の名前は、名簿と学校の設定から自動で入ります。入れるのは、残りの空欄だけです。' },
    {
      before: ensure(MOTI), el: '.tp-fields', title: '空欄を入れる', text: '行事名・日付・持ち物を入れます。行事は「カレンダーの予定から入れる」で選ぶこともできます。', doLabel: '入れてみる',
      do: async (d) => {
        await d.type('#tp-v-行事名', '校外学習');
        await d.type('#tp-v-日付', '11月6日（金）');
        await d.type('#tp-v-持ち物', '弁当・水筒\n雨具\nしおり');
      },
      after: 600,
    },
    { before: ensure(MOTI), el: 'textarea[aria-label="できあがりの文"]', title: 'できた文を見る', text: '入れたそばから、文ができあがります。この欄で、直接直すこともできます。' },
    { before: ensure(MOTI), el: '.tp-out .btn-row', title: 'コピー・メールで送る', text: '「コピー」で連絡アプリや Classroom に貼れます。「メールで開く」で、メールの下書きになります。' },
    { before: toList, el: D.text('.tp-it', '〈行事名〉のお知らせ'), title: '文書のひな形', text: '紙で配る「お知らせ」も同じように使えます。入れた行事名は、そのまま引きつぎます。', click: true, after: 700 },
    { before: ensure('〈行事名〉のお知らせ'), el: '.tp-out .btn-row', title: '印刷・Word に', text: '文書は紙の形で見えます。「印刷」でそのまま配れます。「Word に書き出す」で学校の様式にも写せます。' },
  ]);
})();

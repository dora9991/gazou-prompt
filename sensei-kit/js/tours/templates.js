// 使い方のデモ：連絡テンプレート（手順の書き方は js/demo.js の先頭）
(function () {
  const D = Kit.demo;
  const room = () => {}; // スマホの下の余白は、土台（デモの説明中は .mb-view の下に余白）がつける
  // スマホは「一覧」と「入れる画面」が分かれるので、一覧を見せたい手順の前に戻しておく（広い画面では何もしない）
  const toList = async () => { Kit.closeModals(); const b = D.btn('ひな形の一覧', '.tp-back')(); if (b) b.click(); room(); };
  const isOpen = (t) => { const h2 = document.querySelector('#mb-view .tp-head h2'); return !!h2 && h2.textContent.includes(t); };
  // 「戻る」で来たときも、そのひな形を開いた状態にしておく（指は出さない）
  const ensure = (t) => async (d) => { if (!isOpen(t) || document.querySelector('.modal')) { await toList(); const it = await d.find(D.text('.tp-it', t), 1500); if (it) it.click(); } room(); };
  // 時候のあいさつの一覧を開いた状態にしておく
  const jikoOpen = (t) => async (d) => {
    if (document.querySelector('.modal .tp-jk-list')) return;
    await ensure(t)(d);
    const b = await d.find(D.btn('時候のあいさつを選ぶ', '.tp-jiko'), 1500);
    if (b) b.click();
    await d.find(D.modal('.tp-jk-list'), 1500);
  };
  const MOTI = '持ち物のお願い';
  const KAI = '保護者会のご案内';
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
    // 改まった文書（拝啓〜敬具）と、時候のあいさつ
    { before: toList, el: D.btn('改まった文書', '.tp-groups'), title: '改まった文書', text: '「拝啓〜敬具」の正式な文書です。保護者会・行事へのご招待・お礼状・ほかの学校へのお願いなどがあります。', click: true, after: 500 },
    { before: toList, el: D.text('.tp-it', KAI), title: '保護者会のご案内', text: '例として「保護者会のご案内」を開きます。', click: true, after: 700 },
    { before: ensure(KAI), el: '.tp-paper', title: '正式な文書の形', text: '日付と発信者は右、件名は真ん中。拝啓で始めて敬具で結び、「記」と「以上」がつきます。印刷も Word もこの形です。' },
    { before: ensure(KAI), el: D.btn('時候のあいさつを選ぶ', '.tp-jiko'), title: '時候のあいさつ', text: '拝啓のあとのあいさつは、発行日に合わせて自動で入ります。「選ぶ」で、ほかの言い方に変えられます。', click: true, after: 500 },
    { before: jikoOpen(KAI), el: D.modal('.tp-jk-bar'), title: '月と相手でしぼる', text: '発行日の月の例文が出ます。発行日に合うものには印がつきます。相手を変えると、合う言い方だけになります。' },
    { before: jikoOpen(KAI), el: () => D.modal('.tp-jk.is-fit:not(.is-on) .tp-jk-main')() || D.modal('.tp-jk:not(.is-on) .tp-jk-main')(), title: '押すと文書に入る', text: '使いたいあいさつを押すと、文書に入ります。「コピー」で、ほかの文書に使う書き出しの1文もコピーできます。', click: true, after: 700 },
    { before: ensure(KAI), el: '.tp-jiko', title: '入れかわりました', text: '選んだあいさつが文書に入りました。「自動にもどす」で、発行日に合わせたあいさつに戻せます。' },
  ]);
})();

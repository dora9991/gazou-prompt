// 使い方のデモ：係決め（手順の書き方は js/demo.js の先頭）
(function () {
  const D = Kit.demo;
  const METHOD = 'section[aria-label="決め方"]';
  // 希望の欄：k 番目の人の、第 rank 希望（0 から）
  const wishSel = (k, rank) => () => {
    const rows = [...document.querySelectorAll('#mb-view .rl-wish-row:not(.th)')];
    return rows[k] ? rows[k].querySelectorAll('select')[rank] || null : null;
  };
  const optionOf = (sel, name) => { const o = [...sel.options].find((x) => x.text === name); return o ? o.value : sel.options[1] ? sel.options[1].value : ''; };
  Kit.tour('roles', [
    {
      el: '.sk-steps', title: '3つの段階で進む',
      text: '①係を選ぶ → ②人を決める → ③表にする、の順に進みます。デモは架空のクラスの「前期の係」です。',
      before: async (d) => { const b = d.btn('係を選ぶ', '.sk-steps'); if (b && b.getAttribute('aria-current') !== 'step') { b.click(); await Kit.mounted(); } },
    },
    {
      el: 'section[aria-label="係の例"]', title: '係の例から選ぶ', doLabel: '追加してみる',
      text: '学級の係・委員会・行事の係など、120ほどの例があります。言葉でさがして「追加」すると表に入ります。',
      do: async (d) => {
        await d.type('#rl-q', '号令');
        const add = await d.find(D.btn('追加', '.rl-lib-list'), 800);
        if (add) await d.click(add);
      },
      after: 600,
    },
    {
      el: D.btn('人を決める', '.sk-steps'), title: '次は人を決める',
      text: '「号令係」は「この表の係」のいちばん下に入りました。人数や仕事の内容も直せます。次は②へ。', click: true, after: 500,
    },
    {
      el: METHOD + ' .seg', title: '決め方を選ぶ', doLabel: '希望にしてみる',
      text: '手で・希望で・くじで決められます。ここでは希望を聞いて、かなわなかった人はくじで決めます。',
      do: async (d) => { await d.click(D.btn('希望で決める', METHOD + ' .seg')); },
      after: 500,
    },
    {
      el: D.text(METHOD + ' details summary', '希望を入れる'), title: '希望を入れる', doLabel: '入れてみる',
      text: '1人ずつ第3希望まで選べます。例として3人が「黒板係」（定員2人）を第1希望にします。',
      do: async (d) => {
        await d.click(D.text(METHOD + ' details summary', '希望を入れる'));
        for (let k = 0; k < 3; k++) { const s = await d.find(wishSel(k, 0)); if (s) await d.pick(s, optionOf(s, '黒板係')); }
      },
      after: 500,
    },
    {
      el: METHOD + ' .btn-row', title: '希望とくじで決める', doLabel: '決めてみる',
      text: '「全員を外す」でいまの係を空けてから、「希望で決める」を押します。',
      do: async (d) => {
        await d.click(D.btn('全員を外す', METHOD));
        await d.click(D.modalBtn('外す'));
        await d.wait(300);
        await d.click(D.btn('希望で決める', METHOD + ' .btn-row'));
      },
      after: 900,
    },
    {
      el: 'section[aria-label="決め方の記録"]', title: 'くじの結果も残る',
      text: '希望が定員をこえた係は、くじで決めた記録が残ります。下の係のカードで、手で入れかえることもできます。',
    },
    { el: D.btn('表にする', '.sk-steps'), title: '表にする', text: '決まったら、③で掲示用の表にします。', click: true, after: 500 },
    {
      el: () => { const b = D.btn('一覧表を印刷')(); return b ? b.closest('.btn-row') : null; }, title: '掲示用の表ができる',
      text: '係・人数・担当・仕事の内容の表です。名前の出し方を選んで、一覧表や掲示用の札を印刷できます。',
    },
  ]);
})();

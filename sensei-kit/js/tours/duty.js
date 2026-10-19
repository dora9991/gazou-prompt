// 使い方のデモ：当番表（手順の書き方は js/demo.js の先頭）
(function () {
  const D = Kit.demo;
  const tab = (label) => D.btn(label, '.dt-tabs');
  // 班のカード（0 から）と、その中の k 番目の名前
  const groupCard = (i) => () => document.querySelectorAll('#mb-view .dt-groups .dt-g')[i] || null;
  const member = (i, k) => () => { const c = groupCard(i)(); return c ? c.querySelectorAll('.dt-mem .chip')[k] || null : null; };
  Kit.tour('duty', [
    {
      el: '.dt-tabs', title: '班から当番を回す',
      text: '班をつくると、掃除・給食・日直が週ごとに回ります。デモは架空のクラス（32人・6班）です。',
      before: async (d) => { const b = d.btn('班', '.dt-tabs'); if (b && b.getAttribute('aria-selected') !== 'true') { b.click(); await Kit.mounted(); } },
    },
    {
      el: D.text('.dt-row', 'つくり方'), title: '班をつくり直す', doLabel: 'くじでつくってみる',
      text: '番号順・席の近い人で・くじ、から選べます。席替えで保存した席から班にもできます。',
      do: async (d) => { await d.click(D.btn('くじ', '#mb-view section.card')); },
      after: 900,
    },
    {
      el: groupCard(0), title: '1人ずつ移す', doLabel: '移してみる',
      text: '名前を押してから、ほかの班のカードを押すと、その人が移ります。班の名前も変えられます。',
      do: async (d) => {
        await d.click(member(0, 0));
        await d.wait(300);
        await d.click(groupCard(1));
      },
      after: 700,
    },
    { el: tab('掃除'), title: '掃除の分担', text: '班ごとの掃除の場所が、1週ごとに回ります。', click: true, after: 600 },
    {
      el: '.dt-now', title: '今週の掃除が一目で',
      text: '今週の分担と、先の週までの表が出ます。場所や、夏休みなどお休みの週は右（下）で変えられます。',
    },
    {
      el: D.btn('回転盤を印刷'), title: '回転盤も印刷できる',
      text: '切りぬいて割りピンでとめる回転盤です。1週ごとに内の円を1つ回すと、次の週の分担になります。',
    },
    { el: tab('給食'), title: '給食当番', text: '給食当番も、班ごとに1週ずつ回ります。番号順に区切って回すこともできます。', click: true, after: 600 },
    {
      el: '.dt-now', title: '役割まで決まる', doLabel: '日直を見る',
      text: 'おかず・汁物・牛乳などの役割まで、1人ずつ決まります。最後に「日直」のタブを見ます。',
      do: async (d) => { await d.click(tab('日直')); },
      after: 600,
    },
    {
      el: () => D.q('.dt-nk-row.is-today')() || D.q('.dt-nk-row')(), title: '日直は毎日回る',
      text: '番号順に、毎日2人ずつ回ります。土日と祝日は自動でとばします。人数やはじめる日は右（下）で変えられます。',
    },
  ]);
})();

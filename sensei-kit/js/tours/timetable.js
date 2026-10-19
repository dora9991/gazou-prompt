// 使い方のデモ：時間割（手順の書き方は js/demo.js の先頭）
(function () {
  const D = Kit.demo;
  const view = () => document.getElementById('mb-view') || document;
  // タブを切りかえる（指は出さない。すでに開いていれば何もしない）
  const openTab = async (label) => {
    const t = D.btn(label, '.tt-tabs')();
    if (t && t.getAttribute('aria-selected') !== 'true') { t.click(); await Kit.mounted(); }
  };
  const chip = (s) => D.text('.tt-palette .chip', s);
  // 空いているマス（今日の曜日の列にあれば、そこを先に）
  const emptyCell = () => () => {
    const all = [...view().querySelectorAll('.tt-grid button.tt-c:not(.has)')];
    const d = (new Date().getDay() + 6) % 7;
    return all.find((b) => String(b.dataset.k || '').startsWith(d + '-')) || all[0] || null;
  };
  const homeMark = () => D.text('.tt-top .chip', 'ホームに表示中')() || D.btn('ホームに出す', '.tt-top')();
  const makeBtn = () => D.btn('組み直す', '.tt-res')() || D.btn('時間割をつくる', '.tt-res')();

  Kit.tour('timetable', [
    {
      el: '.tt-tabs', title: '2つの使い方', before: () => openTab('わたしの時間割'),
      text: '「わたしの時間割」は自分の授業の表です。「学校の時間割をつくる」は、条件から学校全体を自動で組みます。',
    },
    {
      el: '.tt-palette', title: '教科を選んで塗る', text: '教科を選んでマスを押すと、どんどん塗れます。例として「学活」で空きを2つ塗ってみます。', doLabel: '塗ってみる',
      do: async (d) => {
        await d.click(chip('学活'));
        await d.click(emptyCell());
        await d.wait(200);
        await d.click(emptyCell());
        await d.wait(300);
        await d.click(chip('学活')); // もう一度押すと、塗るのを終わる
      },
      after: 600,
    },
    { el: homeMark, title: 'ホームに今日の分', text: 'この時間割は、ホームに「今日の時間割」として出ます。朝ひらけば、今日の授業がすぐ分かります。' },
    {
      el: D.btn('学校の時間割をつくる（自動）', '.tt-tabs'), title: '学校の時間割を自動で', text: '教務の先生向けです。担当と条件を入れると、先生が重ならないように自動で組みます。',
      click: true, after: 500,
    },
    { el: '.tt-steps', title: '条件を順に入れる', text: '①曜日とクラス ②教科と時間数 ③担当 ④先生の都合 の順に入れて、⑤で組みます。例は架空の中学校です。' },
    {
      el: D.btn('先生の都合', '.tt-steps'), title: '先生の都合も入れる', text: '非常勤の先生が来ない曜日や出張の日を×にすると、そこには授業を入れません。', doLabel: '見てみる',
      do: async (d) => {
        await d.click(D.btn('先生の都合', '.tt-steps'));
        await d.wait(300);
        await d.click(D.text('.tt-tlist button', '島田'));
      },
      after: 700,
    },
    {
      el: D.btn('つくる', '.tt-steps'), title: '自動で組む', text: '「組み直す」を押すと、先生の重なり・都合・固定のコマを守って組みます。何度でもやり直せます。', doLabel: '組んでみる',
      do: async (d) => {
        await d.click(D.btn('つくる', '.tt-steps'));
        await d.wait(300);
        await d.click(makeBtn);
      },
      after: 1000,
    },
    { el: '.tt-res', title: 'すべて入ったか分かる', text: 'すべての授業が入ったか、入らなかった授業はどれかが、ここに出ます。' },
    { el: D.btn('わたしの時間割に写す'), title: '見る・直す・写す', text: 'クラス別・先生別に見て、マスを2つ押すと入れかわります。できた表は「わたしの時間割」に写せます。' },
  ]);
})();

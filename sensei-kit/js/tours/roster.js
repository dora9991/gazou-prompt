// 使い方のデモ：名簿（手順の書き方は js/demo.js の先頭）
(function () {
  const D = Kit.demo;
  // Excel の名簿を選んでコピーしたときの文字（列はタブ区切り・1行目は見出し）
  const PASTE = [
    '番号\t氏名\tふりがな\t性別',
    '1\t青木 そら\tあおき そら\t男',
    '2\t石田 ゆい\tいしだ ゆい\t女',
    '3\t内田 はると\tうちだ はると\t男',
    '4\t江口 さくら\tえぐち さくら\t女',
    '5\t小川 りく\tおがわ りく\t男',
  ].join('\n');
  const firstRow = '.ro-table .ro-row:not(.ro-th)';
  Kit.tour('roster', [
    {
      el: D.btn('名簿を貼り付ける', '.app-head'), title: 'Excel から貼り付ける',
      text: 'Excel の名簿を選んでコピーし、ここに貼り付けるだけで入ります。1行に1人です。', click: true, after: 500,
    },
    {
      el: D.modal('#ro-paste'), title: 'コピーした行を貼る',
      text: '番号・氏名・ふりがな・性別の列を、そのまま貼れます。見出しの行があっても大丈夫です。', doLabel: '貼り付けてみる',
      do: async (d) => {
        const ta = await d.click(D.modal('#ro-paste'));
        ta.value = PASTE;
        ta.dispatchEvent(new Event('input', { bubbles: true }));
      },
      after: 500,
    },
    {
      el: D.modal('.ro-paste-prev'), title: '読み取りを確かめる',
      text: '5人を、番号・氏名・ふりがな・性別に分けて読み取りました。違っていたら、上の文を直します。',
    },
    {
      el: D.modal('.seg'), title: '入れ方を選んで入れる',
      text: 'いまのクラスを置きかえるか、新しいクラスにするかを選びます。ここでは新しい「2年4組」にします。', doLabel: '入れてみる',
      do: async (d) => {
        await d.click(D.modalBtn('新しいクラスにする'));
        await d.type(D.modal('#ro-paste-name'), '2年4組');
        await d.click(D.modalBtn('名簿に入れる'));
      },
      after: 900,
    },
    {
      el: firstRow, title: 'ふりがな・性別も入る',
      text: 'ふりがなと性別も、そのまま入りました。性別は席替えの男女の並びだけに使います（空欄でもかまいません）。',
    },
    {
      el: firstRow, title: '前の席・メモ', doLabel: '印をつけてみる',
      text: '「前の席」に印をつけた人は、席替えで前のほうの席になります。メモには配慮などを書けます。',
      do: async (d) => {
        await d.check('#ro-0-front', true);
        await d.type('#ro-0-note', '視力（前の席）');
      },
      after: 600,
    },
    {
      el: D.btn('クラスを追加', '.app-head'), title: '番号だけでも使える', doLabel: '番号だけで作ってみる',
      text: '名前を入れられないときは、人数だけで出席番号の名簿を作れます。例として30人のクラスを作ります。',
      do: async (d) => {
        await d.click(D.btn('クラスを追加', '.app-head'));
        await d.type(D.modal('#ro-new-name'), '2年5組');
        await d.type(D.modal('#ro-new-count'), '30');
        await d.click(D.modalBtn('追加する'));
      },
      after: 900,
    },
    {
      el: firstRow, title: '番号だけの名簿',
      text: '1番から30番までの名簿ができました。名前が空のままでも、席替え・係決め・当番表を番号で使えます。',
    },
  ]);
})();

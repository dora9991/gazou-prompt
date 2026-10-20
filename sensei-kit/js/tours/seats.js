// 使い方のデモ：席替え（手順の書き方は js/demo.js の先頭）
(function () {
  const D = Kit.demo;
  const seat = (n) => () => [...document.querySelectorAll('#mb-view .st-grid .st-seat:not(.is-none):not(.is-empty)')][n] || null;
  Kit.tour('seats', [
    { el: '.sk-classbar', title: 'クラスを選ぶ', text: '名簿に入れたクラスから選びます。デモは架空の「2年3組」（32人）です。教室で映すときは「名前を隠す」で番号だけにできます。' },
    { el: '.st-set', title: '条件を決める', text: '机の数、「前の席」にする人、男女の並び、はなしたい2人などを決めます。決めた条件は、次の席替えにも残ります。' },
    { el: D.text('.st-set .seg button', 'となり同士は男女'), title: '男女の並びも選べる', text: '例として「となり同士は男女」にしてみます。', click: true, after: 500 },
    {
      el: '.st-zone', title: '座ってよい列を決める', text: '窓側・廊下側など、生徒ごとに座ってよい列を決められます。例として9番の人を「縦の1・2列目」にします。席には「列」の印が出ます。', doLabel: '決めてみる',
      do: async (d) => {
        await d.pick('#st-zone-who', School.sampleStudent(9));
        await d.wait(300);
        for (const k of ['c0', 'c1']) { await d.click(() => document.querySelector('.st-zone-ed [data-lane="' + k + '"]')); await d.wait(150); }
        await d.wait(450);
        await d.click(D.btn('この列にする', '.st-zone'));
      },
      after: 700,
    },
    { el: D.btn('席替えする', '.app-head'), title: 'くじで席を決める', text: '条件を守るように、くじで席を決めます。気に入らなければ何度でも引き直せます。', click: true, after: 1700 },
    { el: '.st-issues', title: '条件を守れたか確かめる', text: '条件をすべて満たしたかが、ここに出ます。守れなかったときは、どの条件かが出ます。' },
    {
      el: '.st-modes', title: '手で入れかえる', text: '席を2つ続けて押すと、2人が入れかわります。配慮が必要な席は「固定する」で動かないようにできます。', doLabel: '入れかえてみる',
      do: async (d) => { await d.click(seat(0)); await d.wait(250); await d.click(seat(9)); },
      after: 600,
    },
    {
      el: D.btn('この席で決定（保存）'), title: '保存する', text: '「この席で決定」で保存します。次の席替えでは、この席で「となり」だった人どうしを避けます。', doLabel: '保存してみる',
      do: async (d) => { await d.click(D.btn('この席で決定（保存）')); await d.click(D.modalBtn('保存する')); },
      after: 800,
    },
    {
      el: D.btn('発表する', '.app-head'), title: '1人ずつめくって発表', text: '教室で映して、1人ずつめくって発表できます。盛り上がります。', doLabel: '発表してみる',
      do: async (d) => {
        await d.click(D.btn('発表する', '.app-head'));
        for (let k = 0; k < 3; k++) { await d.click(D.btn('1人めくる', '.st-show')); await d.wait(250); }
        await d.click(D.btn('ぜんぶ見せる', '.st-show'));
        await d.wait(1400);
        await d.click(D.btn('閉じる', '.st-show'));
      },
      after: 400,
    },
    { el: D.btn('印刷', '.app-head'), title: '座席表を印刷', text: 'A4 横の座席表を印刷できます。「生徒から見た図」と「教卓から見た図」を選べます。' },
  ]);
})();

// 使い方のデモ：カレンダー（手順の書き方は js/demo.js の先頭）
(function () {
  const D = Kit.demo;
  const WORD = '学年打ち合わせ'; // サンプルの「職員会議」と同じ日に入るので、別の名前にする
  // 入れた予定（月はパソコンだと日の中、スマホだと下の一覧。週の表示にも）
  // 1日に5件以上あると「ほか○件」にまとまるので、見つからなければ明日のマスを囲む
  const added = () => D.text('.cal-ev, .cal-ag-it, .cal-wev', WORD)() || D.q('.cal-day[data-date="' + Kit.rel(1) + '"]')();

  Kit.tour('calendar', [
    {
      el: '.cal-quick', title: 'すばやく追加', text: '「明日 16時 職員会議」のように1行で書くと、日付・時刻・種類を読み取ります。', doLabel: '書いてみる',
      do: async (d) => { await d.type('#cal-quick', '明日 16時 ' + WORD); },
      after: 500,
    },
    {
      el: '.cal-quick', title: '読み取って追加', text: '下に日付・時刻・名前・種類が出ます。合っていれば「追加」で入ります。', doLabel: '追加する',
      do: async (d) => { await d.click(D.btn('追加', '.cal-quick')); },
      after: 800,
    },
    { el: added, title: 'カレンダーに入りました', text: '明日の16時に入りました。会議・テスト・行事など種類ごとに色が分かれ、押すと直せます。' },
    {
      el: '.cal-bar .seg', title: '月・週・一覧', text: '「月」「週」「予定リスト」で、見かたを切りかえられます。', doLabel: '切りかえてみる',
      do: async (d) => {
        await d.click(D.btn('週', '.cal-bar'));
        await d.wait(1000);
        await d.click(D.btn('予定リスト', '.cal-bar'));
        await d.wait(1000);
        await d.click(D.btn('月', '.cal-bar'));
      },
      after: 500,
    },
    { el: D.btn('年間行事をまとめて追加', '.app-head'), title: '年間行事はまとめて', text: '学校の年間行事予定を Excel などからコピーして貼ると、1行ずつ読み取って、まとめて入ります。' },
    { el: '.cal-others', title: 'ほかの道具ともつながる', text: 'リマインダーと宿題の締切も重ねて出ます。行事・テストなどの色の札で、種類ごとに隠すこともできます。' },
    { el: '.cal-io-btn', title: 'Google・スマホへ', text: 'Googleカレンダー用やスマホ用のファイルに書き出したり、読み込んだりできます。' },
  ]);
})();

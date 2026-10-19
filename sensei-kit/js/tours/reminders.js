// 使い方のデモ：リマインダー（手順の書き方は js/demo.js の先頭）
(function () {
  const D = Kit.demo;
  const WORD = '漢字テストを印刷';
  const item = D.text('.rm-item', WORD);
  const itemCheck = () => { const it = item(); return it ? it.querySelector('input[type=checkbox]') : null; };

  Kit.tour('reminders', [
    {
      el: '.rm-quick', title: 'すばやく追加', text: '「明日 8時 漢字テストを印刷」のように書くと、日付と時刻を読み取ります。', doLabel: '書いてみる',
      do: async (d) => { await d.type('#rm-quick', '明日 8時 ' + WORD); },
      after: 500,
    },
    {
      el: '.rm-quick', title: '読み取って追加', text: '下に日付と時刻が出ます。合っていれば「追加」で入ります。', doLabel: '追加する',
      do: async (d) => { await d.click(D.btn('追加', '.rm-quick')); },
      after: 700,
    },
    { el: item, title: '日にちごとに並ぶ', text: '今日・明日・この1週間…と分かれて並びます。押すと、くり返し（毎週など）やメモも入れられます。' },
    {
      // 「終わったもの」の欄はページのいちばん下にあり、スマホでは吹き出しに隠れるので、ここで言葉で伝える
      el: item, title: '終わったらチェック', text: '終わったら左の四角にチェック。下の「終わったもの」にまとまり、くり返しのものは次の日付に進みます。', doLabel: 'チェックする',
      do: async (d) => { await d.check(itemCheck, true); },
      after: 1200,
    },
    { el: '.rm-notice', title: '時刻が来たら知らせる', text: 'このページを開いている間、時刻が来ると画面でお知らせします。' },
    { el: D.btn('スマホのカレンダーへ', '.app-head'), title: 'スマホにも入れる', text: 'ページを閉じていても知らせてほしいときは、ここで書き出して、スマホのカレンダーの通知を使います。' },
  ]);
})();

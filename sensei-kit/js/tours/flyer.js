// 使い方のデモ：チラシ（手順の書き方は js/demo.js の先頭）。印刷は押さない（場所を見せるだけ）
(function () {
  const D = Kit.demo;
  const phone = () => window.innerWidth < 640;
  // せまい画面は「2 文字を書きかえる／3 色と紙を選んで印刷」で、書く所と紙面を切りかえる（広い画面は両方見えているので、何もしない）
  const pane = (n) => {
    if (window.innerWidth >= 1100) return;
    const b = document.querySelectorAll('.fl-steps .sk-step')[n];
    if (b && b.getAttribute('aria-current') !== 'step') b.click();
  };
  const prep = (fn) => async (d) => { Kit.closeModals(); if (fn) await fn(d); };
  // 書きかえの画面にいるとき（「戻る」「もう一度」で来たとき）は、一覧に戻す
  const toList = prep(async (d) => { const b = D.btn('一覧', '.fl-bar')(); if (b) { b.click(); await d.find(D.q('.fl-tpl'), 3000); } });
  // 書きかえの画面にいないときは、「テスト前の学習会」を開く
  const toEdit = async (d) => {
    if (D.q('.fl-edit')()) return;
    const b = D.text('.fl-tpl-go', 'テスト前の学習会')();
    if (b) { b.click(); await d.find(D.q('.fl-edit'), 3000); }
  };
  const write = prep(async (d) => { await toEdit(d); pane(1); });
  const look = prep(async (d) => { await toEdit(d); pane(2); await d.wait(120); });
  const calendar = async (d) => {
    await toEdit(d); pane(1);
    if (D.modal('.fl-evs')()) return;
    const b = D.btn('カレンダーの予定から入れる', '.fl-ed')();
    if (b) { b.click(); await d.find(D.modal('.fl-evs'), 2500); }
  };
  const fieldOf = (id) => () => { const e = document.getElementById(id); return e ? e.closest('.field') : null; };
  // 日時・場所：スマホは縦に長いので、場所の欄だけ囲む
  const when = () => (phone() ? fieldOf('fl-in-place')() : D.q('.fl-sec-when')());
  Kit.tour('flyer', [
    { before: toList, el: '.fl-gallery', title: 'テンプレートを選ぶ', text: '学習会・保護者会・文化祭・募集・おたよりなど15こ。どれも見本の文が入っていて、そのまま出せます。' },
    {
      before: toList, el: D.text('.fl-tpl', 'テスト前の学習会'), title: '1つ選ぶ', text: '「テスト前の学習会」を開きます。開くだけでは保存されません（書きかえると保存します）。', doLabel: '開いてみる',
      do: async (d) => { await d.click(D.text('.fl-tpl-go', 'テスト前の学習会')); }, after: 900,
    },
    {
      before: write, el: when, title: 'まず日時と場所', text: '日時と場所を変えるだけで出せます。日付を変えると、申込みの締切も同じだけずれます。', doLabel: '書きかえてみる',
      do: async (d) => { await d.type(D.q('#fl-in-place'), '2年1組の教室'); }, after: 700,
    },
    { before: write, el: D.btn('カレンダーの予定から入れる', '.fl-ed'), title: 'カレンダーから入れる', text: 'カレンダーに入れた行事から選ぶと、日時と場所が入ります。', doLabel: '開いてみる', do: async (d) => { await d.click(D.btn('カレンダーの予定から入れる', '.fl-ed')); }, after: 600 },
    {
      before: calendar, el: D.modal('.fl-evs'), title: '予定を選ぶ', text: 'これから4か月の予定が出ます。押すと、その日時（と場所）が入ります。', doLabel: '選んでみる',
      do: async (d) => { await d.click(D.modal('.fl-ev')); }, after: 900,
    },
    {
      before: write, el: fieldOf('fl-in-head'), title: '見出しを書きかえる', text: '見出しの大きさは、紙の幅に合わせて自動で決まります。Enter で改行できます。', doLabel: '書きかえてみる',
      do: async (d) => { await d.type(D.q('#fl-in-head'), 'テスト前の\n数学 学習会'); }, after: 900,
    },
    { before: look, el: '.fl-opt-style', title: '雰囲気を選ぶ', text: 'すっきり・ポップ・和風・黒板風・新聞風。文字はそのままで、見た目だけが変わります。', doLabel: 'ポップにしてみる', do: async (d) => { await d.click(D.btn('ポップ', '.fl-opt-style')); }, after: 900 },
    { before: look, el: '.fl-opt-color', title: '色を選ぶ', text: '9つの色の組み合わせ。どれも、白黒の印刷機で刷っても読める濃さにしてあります。', doLabel: '色を変えてみる', do: async (d) => { await d.click(D.q('.fl-pal button[data-v="momo"]')); }, after: 900 },
    {
      before: look, el: '.fl-bw', title: '白黒で確かめる', text: '学校の印刷機（白黒）で刷ったときの見え方を、紙面で確かめられます。', doLabel: '白黒にしてみる',
      do: async (d) => { await d.check(D.q('#fl-bw'), true); await d.wait(1600); await d.check(D.q('#fl-bw'), false); }, after: 400,
    },
    { before: look, el: '.fl-opt-paper', title: '紙の大きさ', text: 'A4 たて・A4 よこ・B5 たて。紙に合わせて、文字の大きさと並びが変わります。', doLabel: 'A4 よこにしてみる', do: async (d) => { await d.click(D.btn('A4 よこ', '.fl-opt-paper')); }, after: 900 },
    { before: look, el: '.fl-status', title: '1枚に入るか', text: '文字が多いときは自動で小さくします。それでも入らないときは、赤い字で知らせます。' },
    { before: prep(), el: D.btn('印刷', '.fl-bar'), title: '印刷する', text: '「印刷」で、選んだ紙の大きさで刷れます（デモでは押しません）。' },
    { before: prep(), el: D.btn('一覧', '.fl-bar'), title: '一覧に戻る', text: '書きかえたチラシは自動で保存されます。一覧に戻ってみます。', click: true, after: 900 },
    { before: prep(), el: '.fl-cards', title: 'つくったチラシ', text: 'いま作ったチラシが入りました。「写す」で、次の回の分もすぐ作れます。' },
  ]);
})();

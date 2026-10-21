// 別に作った道具を、この画面の中に開く（iframe）。どれも dora9991.github.io の同じ置き場所にある。
//   授業     … 指導案（学習指導案サポート）
//   通信・連絡 … 画像生成プロンプト（プロンプト処方箋）
//   β版      … 成績（かんたん成績）・面談の日程（面談スケジューラ）・動画編集（おまかせ動画エディタの Web 版）
// β版の成績と面談は、いまはだれでも使える（2026-10-21 kazu。会員だけに絞るのは、アカウント保存を本番に入れてから）。
// 動画編集はまだ公開していない（GitHub のプッシュ保護の誤検知）ので、会員のアカウントでログインしたときだけ出す。
// ※ アプリそのものの URL は公開の置き場所にあるので、URL を知っていればだれでも開ける。有料にするときは README の「β版」。
(function () {
  'use strict';
  const { h } = Kit;
  const member = () => !!(Kit.cloud && Kit.cloud.enabled && Kit.cloud.user() && Kit.cloud.state().error !== 'not_member');

  const TOOLS = [
    {
      id: 'lesson-plan', title: '指導案', group: 'lesson', icon: 'book', order: 35, embed: true,
      url: 'https://dora9991.github.io/shidoan-sakusei/',
      desc: '単元・目標・本時の展開を選んで、学習指導案をつくる。Word・印刷も',
      note: '入れた内容は、この端末（ブラウザ）の中だけに保存されます。',
      tip: '仕上げは「AI清書プロンプトをコピー」で、生成AIに整えてもらえます。',
    },
    {
      id: 'image-prompt', title: '画像生成プロンプト', group: 'write', icon: 'image', order: 75, embed: true,
      url: 'https://dora9991.github.io/gazou-prompt/',
      desc: '学級通信やチラシのイラストを、生成AIに頼む指示文を選ぶだけでつくる',
      note: '選んだ内容から、ChatGPT・Gemini などにそのまま貼れる指示文をつくります。',
      tip: 'できた絵は、学級通信やチラシの「画像を入れる」で使えます。',
    },
    {
      id: 'beta-grades', title: '成績（β）', group: 'beta', icon: 'chart', order: 91, embed: true, beta: true,
      url: 'https://dora9991.github.io/kantan-seiseki/',
      desc: '観点別のA・B・Cと5段階評定。Excel・写真から取り込みも',
      note: '成績のデータは、この端末（ブラウザ）の中だけに保存されます。ときどき「保存ファイル」に書き出してください。',
      tip: '名簿は「名簿」の道具の「番号と氏名をコピー」で、そのまま貼れます。',
    },
    {
      id: 'beta-mendan', title: '面談の日程（β）', group: 'beta', icon: 'clock', order: 92, embed: true, beta: true,
      url: 'https://dora9991.github.io/mendan-scheduler/',
      desc: '三者・二者面談の日程を、空き枠から自動で組む',
      note: '入れた内容は、この端末（ブラウザ）の中だけに保存されます。',
      tip: '決まった日程は、カレンダーの「まとめて貼り付け」で予定に入れられます。',
    },
    {
      id: 'beta-video', title: '動画編集（β）', group: 'beta', icon: 'film', order: 93, embed: false, beta: true, membersOnly: true,
      url: 'beta/video/index.html',
      desc: '写真と動画を入れるだけで、見どころ・字幕・BGM まで自動で編集',
      note: '写真や動画は、どこにも送りません（この端末の中だけで編集します）。字幕を使うときだけ、はじめに字幕のしくみ（数百MB）を読み込みます。',
      tip: 'Chrome（パソコン）がおすすめです。iPhone の写真や動画がそのまま読めないときは、Mac 版を使ってください。',
    },
  ];

  Kit.css('embeds', `
.bt-bar{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;padding:10px var(--gutter-r) 10px var(--gutter-l);border-bottom:1px solid var(--line);background:var(--surface)}
.bt-bar h1{font-family:var(--font-display);font-weight:600;font-size:20px;letter-spacing:.03em;display:flex;align-items:center;gap:10px}
.bt-chip{display:inline-flex;align-items:center;padding:1px 10px;border-radius:999px;font-size:12px;font-weight:700;letter-spacing:.06em;background:var(--demo-wash);color:var(--ink);border:1px solid color-mix(in srgb,var(--demo) 70%,var(--line))}
.bt-note{flex:1 1 280px;min-width:0;font-size:13px;color:var(--ink-2);line-height:1.5}
@media (max-width:599px){.bt-bar{padding-top:8px;padding-bottom:8px;gap:4px 10px}.bt-bar h1{font-size:18px}.bt-note{font-size:12.5px}.bt-note .bt-tip{display:none}}
.bt-frame{display:block;width:100%;height:calc(100dvh - var(--bt-top,64px));min-height:480px;border:0;background:var(--surface)}
@media (max-width:999px){.bt-frame{height:calc(100dvh - var(--bt-top,64px) - var(--top-h))}}
.bt-gate{max-width:640px;margin:32px auto;padding:0 var(--gutter-r) 0 var(--gutter-l)}
.bt-gate .card{display:grid;gap:12px;padding:22px}
.bt-gate h2{font-family:var(--font-display);font-size:21px;font-weight:600}
.bt-open{display:grid;gap:14px;max-width:720px;margin:28px auto;padding:0 var(--gutter-r) 0 var(--gutter-l)}
.bt-open .card{display:grid;gap:12px;padding:22px}
.bt-open ul{margin:0;padding-left:1.3em;color:var(--ink-2);font-size:14px}
`);

  function gate(root, b) {
    const logged = Kit.cloud && Kit.cloud.user();
    root.append(h('div', { class: 'bt-gate' }, h('section', { class: 'card' },
      h('div', null, h('span', { class: 'bt-chip' }, 'β版・会員限定')),
      h('h2', null, b.title.replace('（β）', '')),
      h('p', { class: 'ink-2' }, b.desc + '。'),
      h('p', null, logged ? 'このアカウントでは使えません。ジーニー会員のアカウントでログインしてください。' : 'この道具は、ジーニー会員のアカウントでログインすると使えます（いまは試しの段階です）。'),
      Kit.cloud && Kit.cloud.enabled ? h('div', { class: 'btn-row' }, Kit.btn(logged ? 'アカウント' : 'ログインする', () => Kit.cloud.open(), { kind: 'primary', icon: 'lock' })) : h('p', { class: 'small muted' }, 'まだ準備中です。'))));
  }

  for (const b of TOOLS) {
    Kit.app({
      id: b.id, title: b.title, group: b.group, icon: b.icon, order: b.order, desc: b.desc, wide: b.embed,
      hidden: () => !!b.membersOnly && !member(),
      mount(root) {
        if (b.membersOnly && !member()) { gate(root, b); return; }
        const name = b.title.replace('（β）', '');
        if (b.embed) {
          const frame = h('iframe', { class: 'bt-frame', src: b.url, title: name, allow: 'clipboard-write; fullscreen', referrerpolicy: 'no-referrer' });
          const bar = h('header', { class: 'bt-bar' },
            h('h1', null, name, b.beta ? h('span', { class: 'bt-chip' }, 'β版') : null),
            h('p', { class: 'bt-note' }, b.note, h('span', { class: 'bt-tip' }, ' ' + b.tip)),
            h('a', { class: 'btn ghost sm', href: b.url, target: '_blank', rel: 'noopener' }, Kit.icon('external'), h('span', null, '新しいタブで開く')));
          root.append(bar, frame);
          const fit = () => { frame.style.setProperty('--bt-top', Math.round(bar.getBoundingClientRect().height + 2) + 'px'); };
          requestAnimationFrame(fit);
          window.addEventListener('resize', fit);
          return () => window.removeEventListener('resize', fit);
        }
        // 動画編集は重いので、新しいタブで開く
        root.append(Kit.appHead({ title: name, desc: b.desc + '。', demo: false }),
          h('div', { class: 'bt-open' }, h('section', { class: 'card' },
            h('div', null, h('span', { class: 'bt-chip' }, b.membersOnly ? 'β版・会員限定' : 'β版')),
            h('ul', null, h('li', null, b.note), h('li', null, b.tip), h('li', null, 'まだ試しの段階です。うまく動かないときは、気づいたことを教えてください。')),
            h('div', { class: 'btn-row' }, h('a', { class: 'btn primary', href: b.url, target: '_blank', rel: 'noopener' }, Kit.icon(b.icon), h('span', null, name + 'を開く（新しいタブ）'))))));
      },
    });
  }
})();

// β版の道具（会員限定）：成績・面談の日程・動画編集
// ジーニー会員のアカウントでログインしている人にだけ、メニューとホームに出す（Kit.cloud。設定 config.js の cloud が true のとき）。
// 中身は別に作ったアプリ（かんたん成績・面談スケジューラ・おまかせ動画エディタの Web 版）を、この画面の中に開く。
// ※「会員限定」は画面の上でのしぼり込み。アプリそのものの URL は公開の置き場所にあるので、URL を知っていれば開ける。
//   有料にするときは、アプリ本体を会員だけが取り出せる置き場所に移す（README の「β版」）。
(function () {
  'use strict';
  const { h } = Kit;
  const member = () => !!(Kit.cloud && Kit.cloud.enabled && Kit.cloud.user() && Kit.cloud.state().error !== 'not_member');

  const BETA = [
    {
      id: 'beta-grades', title: '成績（β）', icon: 'chart', order: 91, embed: true,
      url: 'https://dora9991.github.io/kantan-seiseki/',
      desc: '観点別のA・B・Cと5段階評定。Excel・写真から取り込みも',
      note: '成績のデータは、この端末（ブラウザ）の中だけに保存されます。アカウントには入りません。ときどき「保存ファイル」に書き出してください。',
      tip: '名簿は「名簿」の道具の「番号と氏名をコピー」で、そのまま貼れます。',
    },
    {
      id: 'beta-mendan', title: '面談の日程（β）', icon: 'clock', order: 92, embed: true,
      url: 'https://dora9991.github.io/mendan-scheduler/',
      desc: '三者・二者面談の日程を、空き枠から自動で組む',
      note: '入れた内容は、この端末（ブラウザ）の中だけに保存されます。アカウントには入りません。',
      tip: '決まった日程は、カレンダーの「まとめて貼り付け」で予定に入れられます。',
    },
    {
      id: 'beta-video', title: '動画編集（β）', icon: 'film', order: 93, embed: false,
      url: 'beta/video/index.html',
      desc: '写真と動画を入れるだけで、見どころ・字幕・BGM まで自動で編集',
      note: '写真や動画は、どこにも送りません（この端末の中だけで編集します）。字幕を使うときだけ、はじめに字幕のしくみ（数百MB）を読み込みます。',
      tip: 'Chrome（パソコン）がおすすめです。iPhone の写真や動画がそのまま読めないときは、Mac 版を使ってください。',
    },
  ];

  Kit.css('beta', `
.bt-bar{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;padding:10px var(--gutter-r) 10px var(--gutter-l);border-bottom:1px solid var(--line);background:var(--surface)}
.bt-bar h1{font-family:var(--font-display);font-weight:600;font-size:20px;letter-spacing:.03em;display:flex;align-items:center;gap:10px}
.bt-chip{display:inline-flex;align-items:center;padding:1px 10px;border-radius:999px;font-size:12px;font-weight:700;letter-spacing:.06em;background:var(--demo-wash);color:var(--ink);border:1px solid color-mix(in srgb,var(--demo) 70%,var(--line))}
.bt-note{flex:1 1 280px;min-width:0;font-size:13px;color:var(--ink-2);line-height:1.5}
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
      h('p', null, logged ? 'このアカウントでは使えません。ジーニー会員のアカウントでログインしてください。' : 'β版の道具は、ジーニー会員のアカウントでログインすると使えます（いまは試しの段階です）。'),
      Kit.cloud && Kit.cloud.enabled ? h('div', { class: 'btn-row' }, Kit.btn(logged ? 'アカウント' : 'ログインする', () => Kit.cloud.open(), { kind: 'primary', icon: 'lock' })) : h('p', { class: 'small muted' }, 'まだ準備中です。'))));
  }

  for (const b of BETA) {
    Kit.app({
      id: b.id, title: b.title, group: 'beta', icon: b.icon, order: b.order, desc: b.desc, wide: b.embed,
      hidden: () => !member(),
      mount(root) {
        if (!member()) { gate(root, b); return; }
        if (b.embed) {
          const frame = h('iframe', { class: 'bt-frame', src: b.url, title: b.title, allow: 'clipboard-write; fullscreen', referrerpolicy: 'no-referrer' });
          const bar = h('header', { class: 'bt-bar' },
            h('h1', null, b.title.replace('（β）', ''), h('span', { class: 'bt-chip' }, 'β版')),
            h('p', { class: 'bt-note' }, b.note + ' ' + b.tip),
            h('a', { class: 'btn ghost sm', href: b.url, target: '_blank', rel: 'noopener' }, Kit.icon('external'), h('span', null, '新しいタブで開く')));
          root.append(bar, frame);
          const fit = () => { frame.style.setProperty('--bt-top', Math.round(bar.getBoundingClientRect().height + 2) + 'px'); };
          requestAnimationFrame(fit);
          window.addEventListener('resize', fit);
          return () => window.removeEventListener('resize', fit);
        }
        // 動画編集は重いので、新しいタブで開く
        root.append(Kit.appHead({ title: b.title.replace('（β）', ''), desc: b.desc + '。', demo: false }),
          h('div', { class: 'bt-open' }, h('section', { class: 'card' },
            h('div', null, h('span', { class: 'bt-chip' }, 'β版・会員限定')),
            h('ul', null, h('li', null, b.note), h('li', null, b.tip), h('li', null, 'まだ試しの段階です。うまく動かないときは、気づいたことを教えてください。')),
            h('div', { class: 'btn-row' }, h('a', { class: 'btn primary', href: b.url, target: '_blank', rel: 'noopener' }, Kit.icon('film'), h('span', null, '動画編集を開く（新しいタブ）'))))));
      },
    });
  }
})();

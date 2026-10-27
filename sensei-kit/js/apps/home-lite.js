// ホーム（簡易版）：席替え・チラシ・画像生成プロンプトの3つだけ。lite/index.html が、js/apps/home.js のかわりに読みこむ。
// 名簿は、席替えに使うので付き物として入っている（メニューの「クラス」の中）。
// フル版（全部の道具）へのリンクは FULL_URL の1か所だけ。有料にするときは、ここを差し替える（または消す）。
(function () {
  'use strict';
  const { h } = Kit;
  const FULL_URL = '../';

  Kit.css('home-lite', `
.hl-start{margin-bottom:16px;border-color:color-mix(in srgb,var(--gosu) 35%,var(--line));background:linear-gradient(180deg,color-mix(in srgb,var(--gosu-wash) 55%,var(--surface)) 0,var(--surface) 70%)}
.hl-start-title{font-family:var(--font-display);font-size:20px;font-weight:600;letter-spacing:.03em}
.hl-start-lead{margin-top:4px;font-size:14.5px;color:var(--ink-2);max-width:46em}
.hl-tools{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr))}
.hl-wrap{position:relative;display:grid}
.hl-tool{display:grid;grid-template-columns:auto minmax(0,1fr);gap:2px 14px;align-items:start;text-align:left;padding:18px 16px 56px;border-radius:var(--r);background:var(--surface);border:1px solid var(--line);color:var(--ink);font:inherit;cursor:pointer;min-height:132px}
.hl-tool:hover{border-color:var(--gosu);color:var(--ink)}
.hl-tool:active{transform:translateY(1px)}
.hl-ic{grid-row:span 3;width:44px;height:44px;border-radius:11px;display:grid;place-items:center;background:var(--gosu-wash);color:var(--gosu)}
.hl-ic svg{width:23px;height:23px}
.hl-title{font-family:var(--font-display);font-weight:600;font-size:19px;letter-spacing:.03em}
.hl-desc{font-size:13.5px;color:var(--ink-2);line-height:1.55}
.hl-stat{font-size:13px;color:var(--ink-3);margin-top:2px}
.hl-wrap .demo-btn{position:absolute;right:12px;bottom:12px;min-height:32px;font-size:12.5px;background:transparent;border-color:var(--line-strong)}
.hl-wrap .demo-btn:hover{background:var(--demo-wash)}
.hl-roster{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;margin-top:14px;padding:10px 14px;border-radius:var(--r);background:var(--surface-2);font-size:14px;color:var(--ink-2)}
.hl-roster span{flex:1 1 240px;min-width:0}
.hl-h2{font-size:15px;font-weight:700;display:flex;align-items:center;gap:8px}
.hl-data ul{margin:6px 0 0;padding-left:1.3em;font-size:13.5px;color:var(--ink-2)}
.hl-data li+li{margin-top:3px}
.hl-full{display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px}
.hl-full p{flex:1 1 260px;min-width:0;font-size:14px;color:var(--ink-2);line-height:1.6}
`);

  const TOOLS = [
    { id: 'seats', title: '席替え', desc: '条件をつけて、くじで席を決める。発表・印刷も', icon: 'seats' },
    { id: 'flyer', title: 'チラシ', desc: '学習会・行事・募集のお知らせを、15のテンプレートからさっと。A4・B5 で印刷', icon: 'megaphone' },
    { id: 'image-prompt', title: '画像生成プロンプト', desc: 'チラシやおたより、授業の挿絵を、生成AIに頼む指示文を選ぶだけでつくる', icon: 'image' },
  ];

  Kit.app({
    id: 'home', title: 'ホーム', group: 'home', icon: 'home', order: 1,
    desc: '席替え・チラシ・画像生成プロンプトの簡易版',
    async mount(root) {
      let alive = true;
      const rerender = Kit.debounce(() => { if (alive) render(); }, 120);
      const off = Kit.store.on('*', rerender);
      const offC = School.onClassChange(rerender);

      async function render() {
        const [profile, classes, cur] = await Promise.all([Kit.profile.get(), School.classes.list(), School.classes.current()]);
        if (!alive) return;
        const today = Kit.ymd();
        const hour = new Date().getHours();
        const hello = hour < 10 ? 'おはようございます' : hour < 17 ? 'こんにちは' : 'おつかれさまです';
        const hol = School.holiday(today);
        Kit.clear(root);
        root.append(Kit.appHead({
          title: hello + (profile.teacher ? '、' + profile.teacher : ''),
          desc: Kit.fmtDate(today, 'YYYY年M月D日(W)') + (hol ? '・' + hol : '') + (profile.school ? '　' + profile.school : ''),
          actions: [Kit.btn('学校の設定', () => Kit.profile.edit().then(render), { icon: 'school' })],
        }));

        // はじめての方へ：架空のクラスがあるあいだ（サンプルを片付けると出ない）
        if (Kit.store.samplesShown() && classes.some((c) => c.sample)) {
          root.append(h('section', { class: 'card pad-lg hl-start', 'aria-label': 'はじめての方へ' },
            h('h2', { class: 'hl-start-title' }, 'はじめての方へ'),
            h('p', { class: 'hl-start-lead' }, '架空のクラス「2年3組」で、すぐ試せます。「使い方を見る」を押すと、操作の流れを実際に動かして見せます（あなたのデータは変わりません）。'),
            Kit.store.demo ? null : h('div', { class: 'btn-row', style: { marginTop: '14px' } }, Kit.btn('自分のクラスで始める', startOwn, { kind: 'primary', icon: 'users' }))));
        }

        const stat = { seats: cur ? cur.name + 'の席' : '名簿を入れると使えます' };
        root.append(h('section', { 'aria-label': '道具' }, h('div', { class: 'hl-tools' }, TOOLS.filter((t) => Kit.appDef(t.id)).map((t) => {
          const card = h('button', { type: 'button', class: 'hl-tool', onclick: () => Kit.go(t.id) },
            h('span', { class: 'hl-ic' }, Kit.icon(t.icon)), h('span', { class: 'hl-title' }, t.title), h('span', { class: 'hl-desc' }, t.desc), h('span', { class: 'hl-stat' }, stat[t.id] || ''));
          return h('div', { class: 'hl-wrap' }, card,
            Kit.demo && Kit.demo.has(t.id) ? h('button', { type: 'button', class: 'demo-btn', onclick: () => Kit.demo.start(t.id), 'aria-label': t.title + 'の使い方を見る' }, Kit.icon('play', 12), h('span', null, '使い方を見る')) : null);
        }))));

        root.append(h('div', { class: 'hl-roster' },
          h('span', null, h('b', null, '席替えには名簿が要ります。'), '名前を入れなくても、番号だけで使えます。'),
          Kit.btn('名簿を開く', () => Kit.go('roster'), { sm: true, icon: 'users' })));

        root.append(h('section', { class: 'card hl-data', style: { marginTop: '24px' }, 'aria-label': 'データの扱い' },
          h('h2', { class: 'hl-h2' }, Kit.icon('lock', 18), 'データの扱い'),
          h('ul', null,
            h('li', null, '名簿やチラシの内容は、このブラウザの中だけに保存します（サーバーには送りません）。ブラウザのデータを消すと消えます。'),
            h('li', null, '学校の共用パソコンで使ったときは、使い終わったら下のボタンで消してください。')),
          h('div', { class: 'btn-row', style: { marginTop: '10px' } }, Kit.btn('すべて消して最初から', wipe, { icon: 'trash', kind: 'danger' }))));

        root.append(h('section', { class: 'card', style: { marginTop: '16px' }, 'aria-label': 'フル版' },
          h('div', { class: 'hl-full' },
            h('p', null, h('b', null, 'もっと使いたい方へ。'), 'フル版には、名簿を使う係決め・当番表・時間割・カレンダー・学級通信など、ほかの道具もそろっています。'),
            h('a', { class: 'btn', href: FULL_URL }, Kit.icon('external'), h('span', null, 'フル版を開く')))));
      }

      async function startOwn() {
        if (Kit.store.demo) { Kit.toast('デモの中ではできません。上の帯の「デモを終わる」で戻ってから使ってください'); return; }
        const p = await Kit.profile.edit();
        if (!p) return;
        const yes = await Kit.confirm({ title: 'サンプルも片付けますか', body: '架空のクラス（2年3組）とその席の例を消して、空の状態から始めます。あとで戻すことはできません。', ok: '片付ける' });
        if (yes) { await Kit.store.samplesOff(); Kit.toast('サンプルを片付けました。まず名簿を入れましょう'); Kit.go('roster'); return; }
        render();
      }
      async function wipe() {
        if (Kit.store.demo) { Kit.toast('デモの中ではできません。上の帯の「デモを終わる」で戻ってから使ってください'); return; }
        const yes = await Kit.confirm({ title: 'すべて消しますか', body: 'このブラウザに保存した内容（名簿・席・チラシ・学校の設定）を消して、最初の状態（サンプル表示）に戻します。フル版で入れた内容も同じ場所にあるので、一緒に消えます。元に戻せません。', ok: '消す', danger: true });
        if (!yes) return;
        await Kit.store.wipeAll();
        Kit.pref.set('class', null);
        Kit.toast('すべて消しました');
        render();
      }

      await render();
      return () => { alive = false; off(); offC(); rerender.cancel(); };
    },
  });
})();

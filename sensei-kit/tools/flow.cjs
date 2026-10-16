#!/usr/bin/env node
/* つながりの確認：道具どうしの受け渡しを、本物のブラウザで通しで試す。
   ・初めて開いた状態で、ホームに各道具のサンプルが集まっているか
   ・名簿を貼り付けて新しいクラス → 席替え → 係決め（おすすめ＋くじ）→ 当番表（席の近い人で班・分担表・回転盤）→ 宿題のチェック
   ・時間割を自動でつくる → わたしの時間割に写す → ホームに今日の時間割
   ・年間行事をまとめて追加 → カレンダーに出る／リマインダーの締切・宿題の締切もカレンダーに出る
   ・共有リンクを、別の人（まっさらなブラウザ）が開くと取り込める
   ・学級通信：新しい号 → カレンダーから予定表 → 宿題から提出物 → 印刷・Word
   ・連絡テンプレート：宿題の「まだの人」から保護者への連絡文・予定からお知らせ文
   ・「名前を隠す」で番号だけになる・印刷の中身ができる
   ・サンプルを片付けても全部の道具が開ける・バックアップ → すべて消す → 戻す
   使い方：  node tools/flow.cjs */
const fs = require('fs');
const path = require('path');
const { open, closeAll, OUT } = require('./check.cjs');

const APPS = ['home', 'roster', 'seats', 'roles', 'duty', 'timetable', 'homework', 'calendar', 'reminders', 'newsletter', 'templates'];
let failed = 0;
const ok = (cond, msg) => { console.log((cond ? 'OK  ' : 'NG  ') + msg); if (!cond) failed++; };
const ROSTER = ['番号\t氏名\tふりがな\t性別', '1\t青木 そら\tあおき そら\t男', '2\t井上 ゆい\tいのうえ ゆい\t女', '3\t上田 はると\tうえだ はると\t男', '4\t遠藤 さくら\tえんどう さくら\t女',
  '5\t大野 りく\tおおの りく\t男', '6\t加藤 ひなた\tかとう ひなた\t女', '7\t木村 そうた\tきむら そうた\t男', '8\t久保 あおい\tくぼ あおい\t女', '9\t小林 ゆうと\tこばやし ゆうと\t男', '10\t斉藤 めい\tさいとう めい\t女',
  '11\t佐野 けんと\tさの けんと\t男', '12\t島田 りん\tしまだ りん\t女', '13\t杉本 たくみ\tすぎもと たくみ\t男', '14\t関 ここな\tせき ここな\t女', '15\t田中 こうき\tたなか こうき\t男', '16\t千葉 みお\tちば みお\t女',
  '17\t土屋 はやと\tつちや はやと\t男', '18\t中島 あかり\tなかじま あかり\t女', '19\t西村 しょう\tにしむら しょう\t男', '20\t野口 ゆな\tのぐち ゆな\t女', '21\t橋本 だいち\tはしもと だいち\t男', '22\t林 こはる\tはやし こはる\t女',
  '23\t平野 れん\tひらの れん\t男', '24\t藤田 ほのか\tふじた ほのか\t女', '25\t星野 いぶき\tほしの いぶき\t男', '26\t前田 ちさと\tまえだ ちさと\t女', '27\t松本 かいと\tまつもと かいと\t男', '28\t宮崎 みゆ\tみやざき みゆ\t女'].join('\n');

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const { page, errs, close } = await open({ app: 'home', fresh: true, wait: 800 });
  await page.addInitScript(() => { window.print = () => { window.__printed = (window.__printed || 0) + 1; }; });
  await page.evaluate(() => { window.print = () => { window.__printed = (window.__printed || 0) + 1; }; });
  const wait = (ms) => page.waitForTimeout(ms);
  const go = async (id, params) => { await page.evaluate(([i, p]) => Kit.go(i, p), [id, params || null]); await page.waitForSelector('.app-' + id); await wait(450); };
  const modalBtn = async (label) => { await page.locator('.modal .modal-f button', { hasText: label }).last().click(); await wait(300); };

  // 1. ホームにサンプルが集まる
  const todo = await page.$$eval('.hm-todo .list-item', (els) => els.length);
  ok(todo >= 4, `ホームの「今日・明日やること」にサンプルが出る（${todo}件）`);
  ok(await page.$$eval('.hm-tt-row', (e) => e.length) >= 0, 'ホームに今日の時間割の枠がある');
  await page.screenshot({ path: path.join(OUT, 'flow-1-home.png'), fullPage: true });

  // 2. 名簿を貼り付けて、新しいクラス
  await go('roster');
  await page.click('.app-actions button:has-text("名簿を貼り付ける")');
  await page.fill('#ro-paste', ROSTER);
  await page.click('.modal .seg button:has-text("新しいクラスにする")');
  await page.fill('#ro-paste-name', '1年2組');
  await modalBtn('名簿に入れる');
  const cls = await page.evaluate(async () => { const c = await School.classes.current(); return { name: c.name, n: c.students.length, kana: c.students[0].kana, g: c.students.filter((s) => s.gender === 'f').length }; });
  ok(cls.name === '1年2組' && cls.n === 28 && cls.kana === 'あおき そら' && cls.g === 14, '名簿の貼り付けで新しいクラスができる ' + JSON.stringify(cls));
  // 前の席の印をつける
  await page.check('#ro-4-front');
  await wait(600);

  // 3. 席替え（男女はとなり同士、前の席、はなす2人）
  await go('seats');
  await page.click('.st-set .seg button:has-text("となり同士は男女")');
  await page.selectOption('#st-pa', { label: '1 青木 そら' });
  await page.selectOption('#st-pb', { label: '2 井上 ゆい' });
  await page.click('.st-addpair button:has-text("足す")');
  await page.click('.app-actions button:has-text("席替えする")');
  await wait(1400);
  const seat = await page.evaluate(async () => { const c = await School.classes.current(); return { seated: document.querySelectorAll('.st-grid .st-seat:not(.is-none):not(.is-empty)').length, ok: !!document.querySelector('.st-ok'), n: c.students.length }; });
  ok(seat.seated === seat.n && seat.ok, `席替えで全員が座り、条件を満たす（${seat.seated}/${seat.n}）`);
  await page.click('.st-actions button:has-text("この席で決定")');
  await modalBtn('保存する');
  ok(await page.evaluate(async () => (await Kit.store.list('seatplans')).some((p) => !p.sample)), '席を保存できる');
  await page.click('.app-actions button:has-text("印刷")');
  await modalBtn('印刷する');
  await wait(300);
  ok(await page.evaluate(() => document.querySelectorAll('#sk-print .st-print td').length >= 28 && window.__printed >= 1), '座席表の印刷の中身ができる');
  await page.screenshot({ path: path.join(OUT, 'flow-2-seats.png'), fullPage: true });

  // 4. 係決め（おすすめで始めて、くじ）
  await go('roles');
  await page.click('.rl-card button:has-text("これで始める") >> nth=0');
  await wait(400);
  await page.click('.sk-step:has-text("人を決める")');
  await page.click('.rl-method .seg button:has-text("くじで決める")');
  await page.click('.rl-method button:has-text("くじで決める") >> nth=1');
  await wait(500);
  const roles = await page.evaluate(async () => { const c = await School.classes.current(); const b = (await Kit.store.list('roleboards')).find((x) => x.classId === c.id); const all = Object.values(b.assign).flat(); return { n: all.length, uniq: new Set(all).size, students: c.students.length, over: b.roles.filter((r) => (b.assign[r.id] || []).length > r.count).length }; });
  ok(roles.uniq === roles.students && roles.over === 0, '係をくじで決めると、全員が1つずつ・定員をこえない ' + JSON.stringify(roles));
  await page.click('.sk-step:has-text("表にする")');
  await wait(300);
  ok(await page.$$eval('.rl-table tbody tr', (e) => e.length) >= 10, '係の表ができる');
  await page.click('button:has-text("掲示用の札を印刷")');
  await wait(300);
  ok(await page.evaluate(() => document.querySelectorAll('#sk-print .cardp').length >= 10), '掲示用の札の印刷の中身ができる');
  await page.screenshot({ path: path.join(OUT, 'flow-3-roles.png'), fullPage: true });

  // 4b. 当番表（保存した席から、席の近い人で班 → 掃除の分担表・回転盤・日直）
  await go('duty');
  await page.click('.dt-tabs button:has-text("班")');
  await page.click('button:has-text("席の近い人で")');
  await wait(500);
  const grp = await page.evaluate(async () => { const c = await School.classes.current(); const g = (await Kit.store.list('groups')).find((x) => x.classId === c.id); const sizes = Array(g.n).fill(0); for (const v of Object.values(g.of)) sizes[v]++; return { sizes, all: Object.keys(g.of).length, n: c.students.length }; });
  ok(grp.all === grp.n && Math.max(...grp.sizes) - Math.min(...grp.sizes) <= 1, '当番表：保存した席から、席の近い人で班をつくる ' + JSON.stringify(grp.sizes));
  await page.click('.dt-tabs button:has-text("掃除")');
  await wait(300);
  await page.click('button:has-text("分担表を印刷")');
  await wait(300);
  ok(await page.evaluate(() => document.querySelectorAll('#sk-print .dt-print tbody tr').length >= 10), '掃除の分担表の印刷の中身ができる');
  await page.click('button:has-text("回転盤を印刷")');
  await wait(300);
  ok(await page.evaluate(() => document.querySelectorAll('#sk-print svg').length === 2 && document.querySelector('#sk-print svg').textContent.includes('廊下') && document.querySelectorAll('#sk-print svg')[1].textContent.includes('青')), '回転盤（外の円に場所・内の円に班とメンバー）の印刷の中身ができる');
  await page.click('.dt-tabs button:has-text("日直")');
  await wait(300);
  ok(await page.$$eval('.dt-nk-row', (e) => e.length) >= 20, '日直の表ができる');
  await page.screenshot({ path: path.join(OUT, 'flow-3b-duty.png'), fullPage: true });
  if (!(await page.evaluate(() => School.isOff(Kit.ymd())))) {
    await go('home');
    ok(/今日の日直：/.test(await page.evaluate(() => (document.querySelector('.hm-duty') || {}).textContent || '')), 'ホームに今日の日直が出る');
  }

  // 5. 宿題を出して、チェック
  await go('homework');
  await page.click('.app-actions button:has-text("宿題を出す")');
  await page.fill('#hw-f-title', 'ワーク P.10');
  await page.fill('#hw-f-due', await page.evaluate(() => Kit.rel(1)));
  await modalBtn('出す');
  await page.click('.hw-card button:has-text("チェック")');
  await wait(300);
  for (let i = 0; i < 5; i++) await page.locator('.modal .hw-st').nth(i).click();
  await page.locator('.modal .hw-st').nth(0).click(); // 1人は「遅れ」に
  await modalBtn('閉じる');
  await wait(500);
  const hw = await page.evaluate(async () => { const c = await School.classes.current(); const x = (await Kit.store.list('homework')).find((h) => h.classId === c.id && h.title === 'ワーク P.10'); return Object.values(x.checks); });
  ok(hw.filter((v) => v === 'done').length === 4 && hw.filter((v) => v === 'late').length === 1, '提出チェック：済4人・遅れ1人 ' + JSON.stringify(hw));

  // 6. 時間割（自動でつくる → わたしの時間割に写す）
  await go('timetable');
  await page.click('.tabs button:has-text("学校の時間割")');
  await page.click('.sk-step:has-text("つくる")');
  await page.click('.tt-res button:has-text("組み直す")');
  await wait(400);
  ok(await page.isVisible('.tt-msg.ok'), '学校の時間割を自動でつくれる（全部入る）');
  await page.click('.seg button:has-text("先生別")');
  await page.click('button:has-text("わたしの時間割に写す")');
  await page.locator('.modal button:has-text("つくる")').click();
  await wait(500);
  ok(await page.evaluate(async () => (await Kit.store.list('ttgrids')).some((g) => /先生の時間割/.test(g.name))), '先生別の時間割を「わたしの時間割」に写せる');
  await page.screenshot({ path: path.join(OUT, 'flow-4-timetable.png'), fullPage: true });

  // 7. 年間行事をまとめて追加 → カレンダー
  await go('calendar');
  await page.click('.app-actions button:has-text("年間行事をまとめて追加")');
  const y = await page.evaluate(() => Kit.schoolYear());
  await page.fill('#cal-bulk', '4/7(火) 始業式\n5/19 9:00 体育祭\n11/2〜11/4 中間テスト\n3/19 修了式');
  await modalBtn('確かめる');
  await wait(400);
  await page.check('#cal-imp-past').catch(() => {});
  await modalBtn('追加する');
  await wait(400);
  const ev = await page.evaluate(async () => (await Kit.store.list('events')).filter((e) => !e.sample).map((e) => e.date + ' ' + e.title));
  ok(ev.includes(y + '-04-07 始業式') && ev.includes((y + 1) + '-03-19 修了式') && ev.filter((x) => /中間テスト/.test(x)).length === 3, '年間行事をまとめて追加できる（年度に合わせる） ' + ev.length + '件');
  // リマインダーと宿題の締切がカレンダーに出る
  await page.evaluate(async () => { await Kit.store.put('reminders', { title: '通し確認のリマインダー', date: Kit.rel(2), time: '08:00', repeat: 'none', done: false }); });
  await go('calendar', { date: await page.evaluate(() => Kit.rel(1)) }); // 予定リストは、開いた日から30日ぶん
  await page.click('.cal-bar .seg button:has-text("予定リスト")');
  await wait(300);
  const calText = await page.evaluate(() => document.querySelector('.app-calendar').textContent);
  ok(calText.includes('通し確認のリマインダー') && calText.includes('宿題の締切：ワーク P.10'), 'リマインダーと宿題の締切がカレンダーに出る');
  await page.screenshot({ path: path.join(OUT, 'flow-5-calendar.png'), fullPage: true });

  // 8. 共有リンク（別の人のまっさらなブラウザで開く）
  const link = await page.evaluate(async () => {
    const items = (await Kit.store.list('events')).filter((e) => !e.sample).map((e) => ({ title: e.title, date: e.date, allDay: e.allDay, start: e.start, end: e.end, cat: e.cat }));
    return School.share.link(School.share.pack('events', items, { title: '予定', from: '通しの先生' }));
  });
  ok(/#share=z/.test(link), '共有リンクができる（' + link.length + '文字）');
  const other = await open({ app: 'home', fresh: true, wait: 400 });
  await other.page.goto(link);
  await other.page.waitForSelector('.modal', { timeout: 6000 }).catch(() => {});
  const seen = await other.page.evaluate(() => (document.querySelector('.modal') || {}).textContent || '');
  ok(/通しの先生から/.test(seen) && /始業式/.test(seen), '共有リンクを開くと、取り込みの確認が出る');
  await other.page.check('#cal-imp-past').catch(() => {});
  await other.page.locator('.modal .modal-f button', { hasText: '入れる' }).last().click();
  await other.page.waitForTimeout(500);
  const got = await other.page.evaluate(async () => (await Kit.store.list('events')).filter((e) => !e.sample).length);
  ok(got >= 4, '別の人のカレンダーに取り込める（' + got + '件）');
  ok(other.errs.length === 0, '別の人の画面でエラーがない' + (other.errs.length ? '\n    ' + other.errs.join('\n    ') : ''));
  await other.close();

  // 8b. 学級通信（新しい号 → カレンダーから予定表 → 宿題から提出物 → 印刷・Word）
  await go('newsletter');
  await page.click('.app-actions button:has-text("新しい号をつくる")');
  await page.click('.modal .nl-kata-it:has-text("週の通信")');
  await modalBtn('つくる');
  await wait(500);
  await page.fill('#nl-name', 'あしあと');
  await page.click('.nl-be:has-text("予定表") button:has-text("カレンダーから入れる")');
  await wait(300);
  await page.evaluate(() => { const set = (id, v) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('change')); }; set('nl-imp-from', Kit.ymd()); set('nl-imp-to', Kit.rel(6)); });
  await page.locator('.modal .modal-f button', { hasText: '入れる' }).last().click();
  await wait(300);
  if (await page.isVisible('.modal .modal-f button:has-text("置きかえる")')) await modalBtn('置きかえる');
  await page.click('.nl-be:has-text("箇条書き") button:has-text("宿題・提出物から足す")');
  await wait(900);
  const nl = await page.evaluate(async () => { const x = (await Kit.store.list('newsletters')).find((y) => y.name === 'あしあと'); const sc = x.blocks.find((b) => b.type === 'schedule'), li = x.blocks.find((b) => b.type === 'list'); return { no: x.no, rows: sc.rows.length, hw: sc.rows.some((r) => /提出：.*ワーク P\.10/.test(r.note)), ev: sc.rows.map((r) => r.text).join(' '), list: li.body }; });
  ok(nl.rows >= 5 && nl.hw && /避難訓練/.test(nl.ev), '学級通信：カレンダーから予定表（行事と宿題の締切が入る） ' + JSON.stringify({ rows: nl.rows, hw: nl.hw }));
  ok(/ワーク P\.10（\d+\/\d+\(.\)まで）/.test(nl.list), '学級通信：宿題・提出物を、お知らせに足せる');
  await page.click('.nl-bar button:has-text("印刷")');
  await wait(500);
  ok(await page.evaluate(() => !!document.querySelector('#sk-print .nl-page .nl-name') && document.querySelectorAll('#sk-print .nl-tbl tbody tr').length >= 5 && /size: 210mm 297mm/.test([...document.querySelectorAll('style')].map((x) => x.textContent).join(''))), '学級通信の印刷の中身ができる（A4）');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('.nl-bar button:has-text("Word に書き出す")')]);
  const docx = path.join(OUT, 'flow-newsletter.docx');
  await dl.saveAs(docx);
  const head = fs.readFileSync(docx).subarray(0, 2).toString();
  ok(head === 'PK' && /^あしあと_第1号\.docx$/.test(dl.suggestedFilename()), '学級通信を Word（.docx）に書き出せる（' + dl.suggestedFilename() + '）');
  await page.screenshot({ path: path.join(OUT, 'flow-5b-newsletter.png'), fullPage: false });

  // 8c. 連絡テンプレート（宿題の「まだの人」から保護者への連絡文・予定からお知らせ文）
  await go('homework');
  await page.click('.hw-card:has-text("ワーク P.10") button:has-text("チェック")');
  await wait(300);
  await page.click('.modal button:has-text("保護者への連絡文")');
  await page.waitForSelector('.app-templates');
  await wait(400);
  await page.selectOption('.tp-help select', { index: 2 });
  await wait(200);
  const msg = await page.inputValue('.tp-out textarea');
  ok(msg.startsWith('井上 ゆいさんの保護者様') && msg.includes('ワーク P.10の提出が') && msg.includes('1年2組担任の'), '宿題の「まだの人」から、保護者への連絡文（名簿から名前）');
  await go('calendar', { date: await page.evaluate(() => Kit.rel(1)) });
  await page.click('.cal-bar .seg button:has-text("予定リスト")');
  await wait(300);
  await page.click('.cal-ag-it:has-text("三者面談")');
  await wait(300);
  await page.click('.modal button:has-text("お知らせ文をつくる")');
  await page.waitForSelector('.app-templates');
  await wait(400);
  const letter = await page.evaluate(() => ({ name: document.getElementById('tp-v-行事名').value, paper: document.querySelector('.tp-paper').textContent }));
  ok(letter.name === '三者面談' && /三者面談のお知らせ/.test(letter.paper) && /記/.test(letter.paper), '予定から、保護者へのお知らせの文書をつくる');
  await page.click('.tp-out button:has-text("印刷")');
  await wait(300);
  ok(await page.evaluate(() => /三者面談のお知らせ/.test((document.querySelector('#sk-print .tp-letter') || {}).textContent || '')), '連絡の文書の印刷の中身ができる');
  await page.screenshot({ path: path.join(OUT, 'flow-5c-templates.png'), fullPage: false });

  // 9. 名前を隠す
  await go('seats');
  await page.check('#sk-hide-names');
  await wait(400);
  const hidden = await page.evaluate(() => [...document.querySelectorAll('.st-grid .st-seat .nm')].map((e) => e.textContent).filter(Boolean));
  ok(hidden.length && hidden.every((t) => /番$|^空き$/.test(t)), '「名前を隠す」で席は番号だけになる');
  await go('roster');
  ok(await page.isVisible('.ro-veil.is-veiled'), '「名前を隠す」で名簿はぼかしてある');
  await page.evaluate(() => School.setHidden(false));

  // 10. サンプルを片付けても全部の道具が開ける
  await page.evaluate(async () => { await Kit.store.samplesOff(); await Kit.store.flush(); });
  for (const id of APPS) { const n = errs.length; await go(id); ok(errs.length === n, `サンプルを片付けたあと「${id}」がエラーなく開ける`); }
  await go('home');
  await page.screenshot({ path: path.join(OUT, 'flow-6-home-after.png'), fullPage: true });

  // 11. バックアップ → すべて消す → 戻す
  const snap = await page.evaluate(async () => { await Kit.store.flush(); return Kit.store.exportAll(); });
  await page.evaluate(async () => { await Kit.store.wipeAll(); });
  const wiped = await page.evaluate(async () => (await School.classes.list()).some((c) => c.name === '1年2組'));
  await page.evaluate(async (d) => { await Kit.store.importAll(d); }, snap);
  const back = await page.evaluate(async () => { const c = (await School.classes.list()).find((x) => x.name === '1年2組'); const plans = await Kit.store.list('seatplans'); return !!c && c.students.length === 28 && plans.some((p) => p.classId === c.id); });
  ok(!wiped && back, 'バックアップから戻すと、名簿と席が元どおりになる');

  ok(errs.length === 0, 'コンソールにエラーがない' + (errs.length ? '\n    ' + errs.join('\n    ') : ''));
  await close();

  // 12. まとめた1ファイルでも動く
  const allInOne = path.join(__dirname, '..', 'sensei-kit-all-in-one.html');
  if (fs.existsSync(allInOne)) {
    const r = await open({ file: 'sensei-kit-all-in-one.html', app: 'home', fresh: true, wait: 800 });
    for (const id of APPS) { await r.page.evaluate((i) => Kit.go(i), id); await r.page.waitForSelector('.app-' + id).catch(() => r.errs.push('開けない: ' + id)); await r.page.waitForTimeout(250); }
    ok(r.errs.length === 0, 'all-in-one でも全部の道具がエラーなく開ける' + (r.errs.length ? '\n    ' + r.errs.join('\n    ') : ''));
    await r.close();
  }
  await closeAll();
  console.log(failed ? `\n${failed} 件に問題あり` : '\nすべて OK');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

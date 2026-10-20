#!/usr/bin/env node
/* ルーレットの確かめ（くじの公平さ・盤の止まる場所・範囲／項目の読み取り）
   ・Node で：くじは School.rng（js/core/school.js をそのまま読む）、計算は js/apps/roulette.js の RouletteCore
       - どの人も同じ確率で当たるか（カイ二乗検定。種を決めた乱数＝毎回同じ結果／種なしの乱数も）
       - 全員の順番・「当たったら外して続ける」：どの並びも同じ確率か。何番目に来るかにかたよりがないか
       - 盤は必ず当たりの区画の中に止まるか（区画の端から 25% 以上内側）・止まりかける所は1つ前の区画か・かかる時間
       - 盤の回り方（何回転・どこで止まりかけるか）が、当たりの決め方にまざっていないか（盤の向きと当たりが無関係か）
   ・本物のブラウザで（Chrome・画面なし・消音）：画面の「回す」を押して、針の下の区画と、大きく出た番号・名前が同じか。
       外す番号は出ないか・順番を決める・まとめて決める・名前を隠す・動きを減らす設定で短く静かに
   使い方： node tools/test-roulette.cjs            （--no-browser でブラウザの確かめを省く） */
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const Core = require(path.join(ROOT, 'js/apps/roulette.js'));

let failed = 0, passed = 0;
const ok = (cond, msg) => { if (cond) passed++; else { failed++; console.log('NG  ' + msg); } };
const section = (t) => console.log('── ' + t);

// School.rng を、本物の school.js から取り出す（画面の部品は最小の代わりを渡す）
function loadSchool() {
  const ctx = { console, Date, Math, JSON, Promise, Map, Set, setTimeout, clearTimeout };
  ctx.window = ctx;
  ctx.Kit = { h: () => ({}), css() {}, store: { sample() {} }, hashHandlers: [], parseYmd: (s) => new Date(s), addDays: (d) => d, ymd: () => '' };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/core/school.js'), 'utf8'), ctx, { filename: 'school.js' });
  return ctx.School;
}
const School = loadSchool();

// カイ二乗の上側の境目（Wilson–Hilferty の近似）。z = 3.29 で 0.05%、z = 4.75 で 0.0001%
const crit = (df, z) => { const a = 2 / (9 * df); return df * Math.pow(1 - a + z * Math.sqrt(a), 3); };
const chi2 = (counts) => { const total = counts.reduce((s, c) => s + c, 0), e = total / counts.length; return counts.reduce((s, c) => s + ((c - e) * (c - e)) / e, 0); };
const perms = (n) => { const out = []; const go = (a, rest) => { if (!rest.length) { out.push(a.join('')); return; } rest.forEach((x, i) => go(a.concat(x), rest.slice(0, i).concat(rest.slice(i + 1)))); }; go([], Array.from({ length: n }, (_, i) => i)); return out; };

/* ───────── 1人だけ選ぶ：どの人も同じ確率 ───────── */
section('1人だけ選ぶ（どの人も同じ確率か）');
for (const n of [2, 7, 32, 40]) {
  for (const seed of [1, 20261020, 987654321]) {
    const rand = School.rng(seed), c = Array(n).fill(0), N = n * 4000;
    for (let k = 0; k < N; k++) c[Core.pickIndex(n, rand)]++;
    const x = chi2(c), lim = crit(n - 1, 3.29);
    ok(x < lim, `${n}人・種 ${seed}：かたよりなし（χ²=${x.toFixed(1)} < ${lim.toFixed(1)}）`);
    ok(Math.min(...c) > 0, `${n}人・種 ${seed}：全員が1回以上当たる`);
  }
  // 種なし（ふだんの使い方と同じ）。境目をゆるく（0.0001%）して、たまたまの失敗を起こさない
  const rand = School.rng(), c = Array(n).fill(0), N = n * 4000;
  for (let k = 0; k < N; k++) c[Core.pickIndex(n, rand)]++;
  ok(chi2(c) < crit(n - 1, 4.75), `${n}人・種なし：かたよりなし（χ²=${chi2(c).toFixed(1)}）`);
}
ok(Core.pickIndex(0, Math.random) === -1, '0人のときは選ばない');
ok(Core.pickIndex(5, () => 0.9999999999) === 4 && Core.pickIndex(5, () => 0) === 0, '乱数の端でも範囲の外に出ない');

/* ───────── 全員の順番・当たったら外して続ける ───────── */
section('全員の順番（どの並びも同じ確率か）');
{
  const all = perms(4), idx = new Map(all.map((p, i) => [p, i]));
  // まとめて決める（shuffle）
  for (const seed of [3, 77]) {
    const rand = School.rng(seed), c = Array(all.length).fill(0);
    for (let k = 0; k < 24 * 3000; k++) c[idx.get(Core.shuffle([0, 1, 2, 3], rand).join(''))]++;
    ok(chi2(c) < crit(23, 3.29), `まとめて決める：4人の24通りが同じ確率（種 ${seed}、χ²=${chi2(c).toFixed(1)}）`);
  }
  // 1人ずつ回して外していく（画面の「全員の順番」「当たったら外して続ける」と同じ手順）
  for (const seed of [5, 2026]) {
    const rand = School.rng(seed), c = Array(all.length).fill(0);
    for (let k = 0; k < 24 * 3000; k++) {
      const pool = [0, 1, 2, 3], order = [];
      while (pool.length) order.push(pool.splice(Core.pickIndex(pool.length, rand), 1)[0]);
      c[idx.get(order.join(''))]++;
    }
    ok(chi2(c) < crit(23, 3.29), `1人ずつ回す：4人の24通りが同じ確率（種 ${seed}、χ²=${chi2(c).toFixed(1)}）`);
  }
  // 10人：だれが何番目に来るか（10×10 のどのますも同じ）
  const rand = School.rng(11), n = 10, M = Array.from({ length: n }, () => Array(n).fill(0));
  for (let k = 0; k < 40000; k++) Core.shuffle(Array.from({ length: n }, (_, i) => i), rand).forEach((who, pos) => M[who][pos]++);
  ok(M.every((row) => chi2(row) < crit(n - 1, 3.89)), '10人：どの人も、どの順番にも同じ確率で来る');
  const sh = Core.shuffle([1, 2, 3, 4, 5], School.rng(1));
  ok(sh.slice().sort().join() === '1,2,3,4,5', 'まとめて決めても、人数が増えたり減ったりしない');
}

/* ───────── 盤の止まる場所 ───────── */
section('盤の止まる場所（見えている当たり＝決まった当たり）');
{
  const rand = School.rng(42);
  let bad = 0, badEdge = 0, badHold = 0, badMono = 0, badTime = 0, cases = 0;
  const maxTime = { quick: 3200, slow: 6600 };
  for (let n = 1; n <= 90; n++) {
    for (let k = 0; k < 120; k++) {
      const index = Core.pickIndex(n, rand), speed = k % 2 ? 'quick' : 'slow', red = k % 7 === 0, scale = k % 5 === 0 ? 0.25 : 1;
      const from = (rand() - 0.5) * 7200;
      const p = Core.plan({ n, index, from, rand, speed, reduced: red, scale });
      cases++;
      const end = Core.angleAt(p, p.total);
      if (Core.indexAt(end, n) !== index || Core.indexAt(Core.angleAt(p, p.total + 500), n) !== index || end !== p.to) bad++;
      // 区画の端から 25% 以上内側
      const s = 360 / n, pos = (((-end % 360) + 360) % 360) / s - index;
      if (n > 1 && (pos < 0.249 || pos > 0.751)) badEdge++;
      // 止まりかける所は、1つ前（針を先に通る）の区画
      if (!red && n >= 6 && Core.indexAt(p.holdAt, n) !== (index + 1) % n) badHold++;
      // 回す前に少し引いたあとは、逆に回らない（少しずつ進むだけ）
      let prev = Core.angleAt(p, p.phases[0].t1);
      for (let t = p.phases[0].t1; t <= p.total; t += 16) { const a = Core.angleAt(p, t); if (a < prev - 1e-9) { badMono++; break; } prev = a; }
      if (p.total > (red ? 760 : maxTime[speed]) * scale + 1) badTime++;
    }
  }
  ok(bad === 0, `止まった区画が当たりと同じ（${cases}回のうち、ちがった ${bad}回）`);
  ok(badEdge === 0, `区画の端から 25% 以上内側に止まる（はみ出し ${badEdge}回）`);
  ok(badHold === 0, `止まりかけるのは、1つ前の区画（ちがった ${badHold}回）`);
  ok(badMono === 0, `回りはじめたあとは、逆にもどらない（もどった ${badMono}回）`);
  ok(badTime === 0, `かかる時間：さっと 3.2秒・じっくり 6.6秒・動きを減らす 0.76秒まで（こえた ${badTime}回）`);
  const q = Core.plan({ n: 30, index: 3, from: 0, rand: School.rng(1), speed: 'quick' });
  const sl = Core.plan({ n: 30, index: 3, from: 0, rand: School.rng(1), speed: 'slow' });
  const rd = Core.plan({ n: 30, index: 3, from: 0, rand: School.rng(1), speed: 'slow', reduced: true });
  ok(q.total >= 2500 && sl.total >= 5500 && sl.total > q.total, `さっと ${(q.total / 1000).toFixed(1)}秒・じっくり ${(sl.total / 1000).toFixed(1)}秒`);
  ok(rd.total <= 800 && rd.phases.length === 1 && rd.to - rd.from <= 720, `動きを減らす設定は、短く（${rd.total}ミリ秒・寸止めなし）`);
  ok(sl.phases.map((x) => x.name).join(',') === 'wind,main,hold,creep', '回し方：ため → 回る → 止まりかける → スローで決まる');
  const creep = sl.phases[3], main = sl.phases[1];
  ok((creep.a1 - creep.a0) / (creep.t1 - creep.t0) < (main.a1 - main.a0) / (main.t1 - main.t0) / 10, '最後のスローは、回っているときの 1/10 より遅い');
  // 盤の向き（前回止まった所）と当たりは無関係：同じ乱数の並びから、同じ当たりが出る
  const r1 = School.rng(9), r2 = School.rng(9);
  let same = true;
  for (let k = 0; k < 200; k++) { const a = Core.pickIndex(17, r1), b = Core.pickIndex(17, r2); if (a !== b) same = false; Core.plan({ n: 17, index: a, from: k * 97, rand: r1, speed: 'slow' }); Core.plan({ n: 17, index: b, from: -k * 13, rand: r2, speed: 'quick' }); }
  ok(same, '盤の向きや速さは、当たりの決め方に影響しない');
  // 画面と同じ流れ（当たりを決める → 回す → 止まった区画を読む）を 13人で 13万回
  const rr = School.rng(), c = Array(13).fill(0);
  let ang = 0;
  for (let k = 0; k < 13 * 10000; k++) { const i = Core.pickIndex(13, rr); const p = Core.plan({ n: 13, index: i, from: ang, rand: rr, speed: 'quick' }); ang = p.to % 360; c[Core.indexAt(ang, 13)]++; }
  ok(chi2(c) < crit(12, 4.75), `回して止まった区画で数えても、かたよりなし（χ²=${chi2(c).toFixed(1)}）`);
}

/* ───────── 読み取り ───────── */
section('番号の範囲・外す番号・自由な項目');
{
  const r = Core.rangeList(1, 40);
  ok(r.nums.length === 40 && r.nums[0] === 1 && r.nums[39] === 40 && !r.error, '1〜40番');
  const rv = Core.rangeList('40', '１');
  ok(rv.nums.length === 40 && rv.from === 1 && rv.to === 40, '逆に書いても・全角でも 1〜40番');
  ok(Core.rangeList(1, 1000).error.includes('多すぎ'), '多すぎるときは知らせる');
  ok(Core.rangeList('', 5).error && !Core.rangeList('', 5).nums.length, '空欄のときは知らせる');
  ok(Core.rangeList(7, 7).nums.join() === '7', '1つだけの範囲');
  ok(Core.parseNums('5, 12、13-15 ２０').join() === '5,12,13,14,15,20', '外す番号：区切り・まとめ・全角');
  ok(Core.parseNums('30〜32,9-7').join() === '7,8,9,30,31,32', '外す番号：〜・逆向き');
  ok(Core.parseNums('あ, -, 3x').length === 0, '外す番号：数でないものは無視');
  ok(Core.parseItems('1班\n\n 2班 \r\n3　班\n').join('|') === '1班|2班|3 班', '自由な項目：空の行は飛ばし、前後の空白を取る');
  ok(Core.parseItems(Array.from({ length: 300 }, (_, i) => 'x' + i).join('\n')).length === Core.MAX_ITEMS, '自由な項目は ' + Core.MAX_ITEMS + 'こまで');
}

/* ───────── 本物のブラウザ ───────── */
async function browser() {
  section('本物のブラウザ（Chrome・画面なし・消音）');
  const LIB = path.join(os.homedir(), '.claude/skills/shiage/scripts/lib/cdp.cjs');
  if (!fs.existsSync(LIB)) { console.log('   （~/.claude/skills/shiage の道具がないので、ブラウザの確かめは省きます）'); return; }
  const { launch } = require(LIB);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const b = await launch({ width: 1366, height: 820, maxMs: 5 * 60 * 1000 });
  try {
    const p = await b.page('file://' + path.join(ROOT, 'index.html') + '#roulette');
    await p.wait('window.Kit && Kit.current && Kit.current() === "roulette" && document.querySelector(".ru-spin")', 15000);
    const errBase = p.errors().length;
    // 針の下の区画・大きく出た札・上の表示を読む
    const READ = `(() => {
      const d = document.querySelector('.ru-disc'); const m = getComputedStyle(d).transform.match(/matrix\\(([^,]+), ([^,]+)/);
      const a = m ? Math.atan2(+m[2], +m[1]) * 180 / Math.PI : 0; const n = document.querySelectorAll('.ru-w').length;
      const i = RouletteCore.indexAt(a, n); const t = document.querySelector('.ru-t[data-i="' + i + '"]');
      const big = document.querySelector('.ru-reveal .ru-big'); const nm = document.querySelector('.ru-reveal .ru-name');
      return { n, i, under: t ? t.textContent : null, big: big ? big.firstChild.textContent : null, small: big && big.querySelector('small') ? big.querySelector('small').textContent : '',
        name: nm ? nm.textContent : '', read: document.querySelector('.ru-read').textContent, win: [...document.querySelectorAll('.ru-t.is-win')].map((x) => x.textContent),
        labels: [...document.querySelectorAll('.ru-t')].map((x) => x.textContent), rays: !!document.querySelector('.ru-rays'), confetti: !!document.querySelector('.ru-confetti') };
    })()`;
    const setup = (o) => p.eval(`(() => { ${Object.entries(o).map(([k, v]) => `Kit.pref.set('roulette.${k}', ${JSON.stringify(v)});`).join(' ')} return Kit.remount().then(() => 1); })()`);
    // 押してから札が出るまでの時間は、ページの中で測る（テストの道具の待ち時間を入れない）
    await p.eval(`(() => { window.__ru = {}; document.addEventListener('click', (e) => { if (e.target.closest('.ru-spin')) window.__ru.t0 = performance.now(); }, true);
      new MutationObserver(() => { if (document.querySelector('.ru-reveal') && window.__ru.t0 && !window.__ru.t1) window.__ru.t1 = performance.now(); }).observe(document.body, { childList: true }); return 1; })()`);
    const took = () => p.eval(`(() => { const r = window.__ru; const ms = r.t1 - r.t0; window.__ru = {}; return ms; })()`);
    const spinOnce = async () => {
      await p.clickEl('.ru-spin');
      await p.wait('document.querySelector(".ru-reveal .ru-card")', 15000);
      const r = await p.eval(READ);
      // 札が飛び出す動き（0.55 秒）と、字の読みこみが終わってから押す
      await p.wait(`(() => { const c = document.querySelector('.ru-reveal .ru-card'); return !c || (document.fonts.status === 'loaded' && !c.getAnimations().length); })()`, 5000).catch(() => {});
      await sleep(150);
      return r;
    };
    const closeReveal = async () => {
      for (let k = 0; k < 3; k++) {
        await p.clickText('.ru-reveal button', '閉じる');
        try { await p.wait('!document.querySelector(".ru-reveal")', 1500); return; } catch (e) { /* 押す前に札が動いた → もう一度 */ }
      }
      throw new Error('決まった札が閉じません');
    };

    // 回っている盤（四角い svg を回している）の角が、「回す」にかぶって押せなくならないか（盤を 45° にして、どこを押しても「回す」に届く）
    const reach = await p.eval(`(() => { const d = document.querySelector('.ru-disc'); const old = d.style.transform; d.style.transform = 'rotate(45deg)';
      const b = document.querySelector('.ru-spin'); b.scrollIntoView({ block: 'center' }); const r = b.getBoundingClientRect(); let hit = 0, n = 0;
      for (const fx of [0.1, 0.3, 0.5, 0.7, 0.9]) for (const fy of [0.2, 0.5, 0.8]) { n++; const e = document.elementFromPoint(r.left + r.width * fx, r.top + r.height * fy); if (e && b.contains(e)) hit++; }
      d.style.transform = old; return hit + '/' + n; })()`);
    ok(reach === '15/15', '盤が斜めに止まっていても「回す」を押せる（' + reach + '）');
    // 盤が 45° 近くで止まると、回した svg の四角い角が「回す」にかぶって、押しても反応しないことがあった（2026-10-20 に見つけた）。盤は押せない作りにしておく
    ok(await p.eval(`[...document.querySelectorAll('.ru-wheel svg')].every((e) => getComputedStyle(e).pointerEvents === 'none')`), '盤（3枚の svg）は押せない作り＝「回す」の上にかぶらない');
    // 1〜12番（5番は外す）・さっと・ふつうの動き
    await setup({ src: 'range', range: { from: 1, to: 12, skip: '5' }, mode: 'one', speed: 'quick' });
    await sleep(300);
    const first = await p.eval(READ);
    const normalMs = [];
    ok(first.n === 11 && !first.labels.includes('5'), `外す番号（5番）は盤に出ない（区画 ${first.n}）`);
    for (let k = 0; k < 3; k++) {
      const r = await spinOnce();
      const ms = await took();
      ok(r.under === r.big && r.small === '番' && r.win.join() === r.under && r.read === r.big + '番', `ふつうの動き ${k + 1}回目：針の下（${r.under}）＝大きく出た番号（${r.big}${r.small}）＝上の表示（${r.read}）`);
      ok(ms >= 2800 && ms < 6000, `さっと：押してから決まるまで ${(ms / 1000).toFixed(1)}秒（計算は約3.4秒。パソコンが忙しいと少しのびる）`);
      normalMs.push(ms);
      ok(r.rays && r.confetti, '決まった瞬間に光と紙吹雪が出る');
      await closeReveal();
    }
    // 動きを減らす設定：短く・光と紙吹雪なし
    await p.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    for (let k = 0; k < 8; k++) {
      const r = await spinOnce();
      const ms = await took();
      ok(r.under === r.big && r.read === r.big + '番', `動きを減らす ${k + 1}回目：針の下（${r.under}）＝決まった番号（${r.big}）`);
      ok(ms < Math.min(...normalMs) * 0.5 && !r.rays && !r.confetti, `動きを減らす：短く（${(ms / 1000).toFixed(2)}秒）、光と紙吹雪なし`);
      await closeReveal();
    }
    // 全員の順番：2人回して、のこりをまとめて
    await setup({ mode: 'order' });
    await sleep(300);
    const seen = [];
    for (let k = 0; k < 2; k++) {
      const r = await spinOnce();
      ok(r.under === r.big && !seen.includes(r.big), `順番 ${k + 1}番目：針の下＝決まった番号（${r.big}）・前に出た番号ではない`);
      seen.push(r.big);
      await closeReveal();
      const n2 = await p.eval(`document.querySelectorAll('.ru-w').length`);
      ok(n2 === 11 - (k + 1), `当たった番号は盤から外れる（のこり ${n2}）`);
    }
    await p.clickText('.ru-stage button', 'のこりをまとめて決める');
    await p.wait('document.querySelector(".modal")', 3000);
    await p.clickText('.modal button', 'まとめて決める');
    await p.wait('document.querySelector(".ru-list")', 5000);
    const list = await p.eval(`[...document.querySelectorAll('.ru-list .ru-ol li span')].map((x) => x.textContent)`);
    const nums = list.map((x) => parseInt(x, 10));
    ok(list.length === 11 && new Set(nums).size === 11 && !nums.includes(5) && nums.every((x) => x >= 1 && x <= 12), `まとめて決める：11人がちょうど1回ずつ（${list.join(' ')}）`);
    ok(list[0] === seen[0] + '番' && list[1] === seen[1] + '番', '先に回して決まった2人は、1番目・2番目のまま');
    const tsv = await p.eval(`(() => { let got = ''; const o = Kit.copy; Kit.copy = (t) => { got = t; return Promise.resolve(true); }; [...document.querySelectorAll('.ru-list button')].find((x) => x.textContent.includes('コピー')).click(); Kit.copy = o; return got; })()`);
    ok(tsv.split('\n').length === 12 && tsv.split('\n')[0] === '順番\t番号' && tsv.split('\n')[1] === '1\t' + seen[0], 'コピーは Excel に貼れる形（見出し＋11行）');
    await p.clickText('.ru-list-head button', '閉じる');
    const spinLabel = await p.eval(`document.querySelector('.ru-spin').textContent`);
    ok(spinLabel.includes('はじめから'), '全員決まったら「回す」は「はじめからやり直す」に');

    // 名簿のクラス・名前を隠す：番号だけ
    await p.eval(`(School.setHidden(true), 1)`);
    await setup({ src: 'class', mode: 'one' });
    await sleep(300);
    const hid = await spinOnce();
    ok(/^\d+$/.test(hid.big) && hid.small === '番' && !hid.name && hid.under === hid.big, `名前を隠す：番号だけ（${hid.big}${hid.small}）・針の下と同じ`);
    await closeReveal();
    await p.eval(`(School.setHidden(false), 1)`);
    await sleep(400);
    const shown = await spinOnce();
    ok(shown.name && shown.under === shown.big + ' ' + shown.name, `名前つき：${shown.big} ${shown.name}（針の下：${shown.under}）`);
    await closeReveal();
    // お休みの人を外す
    await p.eval(`(() => { const d = document.querySelector('.ru-excl'); d.open = true; const c = [...d.querySelectorAll('.chip')]; c[0].click(); return 1; })()`);
    await sleep(400);
    const ex = await p.eval(READ);
    ok(ex.n === 31 && !ex.labels.some((x) => x.startsWith('1 ')), `お休みの人を外すと、盤から外れる（${ex.n}人）`);
    // 発表モード：スペースで回る・閉じると元に戻る
    await p.clickText('.app-head button', '発表モード');
    await p.wait('document.querySelector(".ru-show .ru-wheel")', 3000);
    await p.key('Space', ' ', ' ');
    await p.wait('document.querySelector(".ru-reveal .ru-card")', 8000);
    const sr = await p.eval(READ);
    ok(sr.under === sr.big + ' ' + sr.name, `発表モード：スペースキーで回り、針の下＝決まった人（${sr.under}）`);
    await p.key('Escape', 'Escape');
    await sleep(200);
    await p.key('Escape', 'Escape');
    await sleep(300);
    ok(await p.eval(`!document.querySelector('.ru-show') && !!document.querySelector('.ru-stagecard .ru-wheel')`), 'Esc で発表モードを閉じると、盤は元の場所に戻る');
    const errs = p.errors().slice(errBase);
    ok(!errs.length, 'ルーレットを使っている間のエラーなし' + (errs.length ? '：' + errs.map((e) => e.text.slice(0, 160)).join(' / ') : ''));
  } finally { await b.close(); }
}

(async () => {
  if (!process.argv.includes('--no-browser')) await browser();
  console.log(`\n${passed} 件 OK${failed ? `、${failed} 件 NG` : ''}`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });

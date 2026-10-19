#!/usr/bin/env node
/* 動作確認：本物のブラウザ（Playwright の Chromium）で各アプリを開き、
   エラー・横はみ出しを調べて、スクリーンショットを tools/_out/ に保存する。
   使い方：  node tools/check.cjs                       … 全アプリ × PC/スマホ × ライト/ダーク
            node tools/check.cjs --app editor,video    … 指定したアプリだけ
            node tools/check.cjs --app inbox --phone --dark   … スマホ幅・ダークだけ
            node tools/check.cjs --fresh               … 保存データを消した状態（初めて開いた人）で
            node tools/check.cjs --full                … ページ全体を撮る（既定は画面1枚ぶん）
   自分で操作したいときは require して使う：
     const { open } = require('./check.cjs');
     const { page, errs, close } = await open({ app: 'seats', phone: true });
     await page.click('text=今日'); … await close(); */
const http = require('http');
const fs = require('fs');
const path = require('path');
// Playwright の場所：既定はクラウドの作業場所。手元の Mac では PLAYWRIGHT=…/node_modules/playwright-core と CHROME=…/Google Chrome を渡す
const { chromium } = require(process.env.PLAYWRIGHT || '/opt/node22/lib/node_modules/playwright');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(__dirname, '_out');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webm': 'video/webm', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg' };

let server = null;
function serve() {
  if (server) return Promise.resolve(server.address().port);
  server = http.createServer((req, res) => {
    const u = decodeURIComponent(req.url.split('?')[0]);
    let f = path.join(ROOT, u === '/' ? 'index.html' : u);
    if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
    if (!fs.existsSync(f)) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r(server.address().port)));
}

let browser = null;
// 日本語のファイル名を正しく扱えるよう、UTF-8 の言語設定で起動する
async function getBrowser() { if (!browser) browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, env: Object.assign({}, process.env, { LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8' }) }); return browser; }

// 1画面を開く。外部への通信（Google Fonts など）は止めて、手元の字体で表示する
async function open(o = {}) {
  const port = await serve();
  const b = await getBrowser();
  const phone = !!o.phone;
  const ctx = await b.newContext({
    viewport: phone ? { width: 390, height: 844 } : { width: o.width || 1280, height: o.height || 860 },
    deviceScaleFactor: phone ? 2 : 1, isMobile: phone, hasTouch: phone,
    colorScheme: o.dark ? 'dark' : 'light', locale: 'ja-JP', timezoneId: 'Asia/Tokyo', acceptDownloads: true,
  });
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message + '\n' + String(e.stack || '').split('\n').slice(1, 4).join('\n')));
  page.on('console', (m) => {
    if (m.type() !== 'error' && m.type() !== 'warning') return;
    const t = m.text();
    if (/fonts\.(googleapis|gstatic)\.com|net::ERR_FAILED|ERR_BLOCKED/.test(t) || /Failed to load resource/.test(t)) return;
    errs.push(m.type() + ': ' + t);
  });
  const base = 'http://127.0.0.1:' + port + '/' + (o.file || 'index.html');
  if (o.fresh || o.state) {
    await page.goto(base + '#__blank');
    await page.evaluate((state) => { localStorage.clear(); if (state) for (const [k, v] of Object.entries(state)) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); }, o.state || null);
  }
  await page.goto(base + (o.app ? '#' + o.app : ''));
  if (o.fresh || o.state) await page.reload(); // ハッシュだけの移動では読み直さないので、保存データを読ませるために再読み込み
  if (o.app) await page.waitForSelector('.app-' + o.app, { timeout: 8000 }).catch(() => errs.push('timeout: .app-' + o.app + ' が出てこない'));
  await page.waitForTimeout(o.wait == null ? 500 : o.wait);
  const close = async () => { await ctx.close(); };
  return { page, ctx, errs, close, port };
}

async function overflow(page) {
  return page.evaluate(() => {
    const W = document.documentElement.clientWidth;
    const over = document.documentElement.scrollWidth - W;
    if (over <= 1) return null;
    // はみ出している要素を探す（表・図など、自分で横スクロールする箱の中は除く）
    const bad = [];
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.right > W + 1 && r.width > 0) {
        let p = el.parentElement, scroller = false;
        while (p && p !== document.body) { const s = getComputedStyle(p); if (/(auto|scroll|hidden)/.test(s.overflowX)) { scroller = true; break; } p = p.parentElement; }
        if (!scroller) bad.push((el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').join('.') : el.tagName.toLowerCase()) + ' → ' + Math.round(r.right - W) + 'px');
      }
      if (bad.length > 6) break;
    }
    return { over, bad };
  });
}

async function main() {
  const args = process.argv.slice(2);
  const get = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
  const has = (k) => args.includes(k);
  fs.mkdirSync(OUT, { recursive: true });
  let apps = get('--app') ? get('--app').split(',') : null;
  if (!apps) {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    apps = [...html.matchAll(/js\/apps\/([\w-]+)\.js/g)].map((m) => m[1]);
  }
  const widths = has('--phone') ? [true] : has('--pc') ? [false] : [false, true];
  const themes = has('--dark') ? [true] : has('--light') ? [false] : [false, true];
  let failed = 0;
  for (const app of apps) {
    for (const phone of widths) {
      for (const dark of themes) {
        const { page, errs, close } = await open({ app, phone, dark, fresh: has('--fresh'), wait: +(get('--wait') || 600) });
        const ov = await overflow(page);
        const name = `${app}-${phone ? 'phone' : 'pc'}-${dark ? 'dark' : 'light'}.png`;
        await page.screenshot({ path: path.join(OUT, name), fullPage: has('--full') });
        const ok = !errs.length && !ov;
        if (!ok) failed++;
        console.log(`${ok ? 'OK ' : 'NG '} ${name}` + (ov ? `  横はみ出し ${ov.over}px: ${ov.bad.join(', ')}` : '') + (errs.length ? '\n    ' + errs.join('\n    ') : ''));
        await close();
      }
    }
  }
  await browser.close();
  server.close();
  console.log(failed ? `\n${failed} 件に問題あり（スクリーンショット：${OUT}）` : `\nすべて OK（スクリーンショット：${OUT}）`);
  process.exit(failed ? 1 : 0);
}

module.exports = { open, overflow, serve, ROOT, OUT, closeAll: async () => { if (browser) await browser.close(); browser = null; if (server) server.close(); server = null; } };
if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });

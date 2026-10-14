#!/usr/bin/env node
/* 全部を 1 つの HTML にまとめる（index.html の CSS・スクリプトを、書いてある順に埋めこむ）。
   使い方：  node tools/bundle.cjs              … sensei-kit-all-in-one.html（ダブルクリックで開ける1ファイル）
            node tools/bundle.cjs --artifact   … dist/artifact.html（Artifact に公開する本体。<html> などの枠なし）
   アプリを直したら、もう一度実行して作り直す（できたファイルは手で直さない）。 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const artifact = args.includes('--artifact');
const out = path.resolve(args.find((a) => !a.startsWith('--')) || path.join(root, artifact ? 'dist/artifact.html' : 'sensei-kit-all-in-one.html'));
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

const fonts = [...html.matchAll(/<link rel="stylesheet" href="(https:[^"]+)">/g)].map((m) => `<link rel="stylesheet" href="${m[1]}">`).join('\n');
const css = [...html.matchAll(/<link rel="stylesheet" href="((?!https:)[^"]+)">/g)].map((m) => read(m[1])).join('\n');
const js = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)]
  .map((m) => `/* ---- ${m[1]} ---- */\n${read(m[1])}`).join('\n')
  .replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
const title = '先生の道具箱';

const body = artifact
  ? `<title>${title}</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n${fonts}\n<style>\n${css}\n</style>\n<div id="kit"></div>\n<script>\n${js}\n</script>\n`
  : `<!doctype html>\n<html lang="ja">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<meta name="robots" content="noindex,nofollow">\n<meta name="theme-color" content="#24473b">\n<title>${title}</title>\n${fonts}\n<style>\n${css}\n</style>\n</head>\n<body>\n<div id="kit"></div>\n<script>\n${js}\n</script>\n</body>\n</html>\n`;
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, body);
console.log(`書き出した：${path.relative(process.cwd(), out)}（${Math.round(Buffer.byteLength(body) / 1024)} KB）`);

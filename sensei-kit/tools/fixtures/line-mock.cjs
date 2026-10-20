// LINE の「ID トークンの確認」（api.line.me/oauth2/v2.1/verify）のまね。テスト専用。
// トークンは「ヘッダー.中身.署名」。署名が ok-sig で、client_id が中身の aud と同じで、期限内なら「本物」として中身を返す。
const http = require('http');
function start(port, host) {
  const calls = [];
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      const q = new URLSearchParams(body);
      const tok = q.get('id_token') || '', cid = q.get('client_id') || '';
      calls.push({ path: req.url, cid, tok: tok.slice(0, 20) });
      const parts = tok.split('.');
      let payload = null;
      try { payload = JSON.parse(Buffer.from(parts[1] || '', 'base64url').toString('utf8')); } catch (e) { payload = null; }
      const ok = req.url === '/verify' && parts.length === 3 && parts[2] === 'ok-sig' && payload && String(payload.aud) === cid && payload.exp * 1000 > Date.now();
      res.writeHead(ok ? 200 : 400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(ok ? Object.assign({ iat: Math.floor(Date.now() / 1000) - 5, amr: ['linesso'] }, payload) : { error: 'invalid_request', error_description: 'Invalid IdToken.' }));
    });
  });
  // ポートがふさがっていたら、待ち続けずに失敗にする（前のテストの残りなど）
  return new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, host || '127.0.0.1', () => resolve({ server, calls })); });
}
function token(p) {
  const b = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return b({ alg: 'HS256', typ: 'JWT' }) + '.' + b(Object.assign({ iss: 'https://access.line.me', aud: '1234567890', exp: Math.floor(Date.now() / 1000) + 3600 }, p)) + '.' + (p.sig || 'ok-sig');
}
module.exports = { start, token };
if (require.main === module) start(Number(process.env.PORT) || 57471).then(() => console.log('LINE のまね: 57471'));

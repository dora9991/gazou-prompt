// LIFF SDK のまね（テスト専用）。localStorage の fake-liff-* で、だれになりすますかを決める
(function () {
  function b64u(o) { return btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function get(k, d) { try { return localStorage.getItem(k) || d; } catch (e) { return d; } }
  window.liff = {
    init: function (o) { window.__liffInit = o; return o && o.liffId ? Promise.resolve() : Promise.reject(new Error('no liffId')); },
    isInClient: function () { return get('fake-liff-inclient', '1') === '1'; },
    isLoggedIn: function () { return get('fake-liff-loggedin', '1') === '1'; },
    login: function () { window.__liffLogin = (window.__liffLogin || 0) + 1; },
    logout: function () { window.__liffLogout = (window.__liffLogout || 0) + 1; },
    getDecodedIDToken: function () { return { exp: Math.floor(Date.now() / 1000) + Number(get('fake-liff-exp-in', '3600')) }; },
    getIDToken: function () {
      return b64u({ alg: 'HS256', typ: 'JWT' }) + '.' + b64u({ iss: 'https://access.line.me', sub: get('fake-liff-user', 'U00000000000000000000000000000001'), aud: get('fake-liff-aud', '1234567890'),
        exp: Math.floor(Date.now() / 1000) + 3600, name: get('fake-liff-name', 'テスト先生') }) + '.' + get('fake-liff-sig', 'ok-sig');
    }
  };
})();

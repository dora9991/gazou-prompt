/* 先生の道具箱 — 学校向けの共通部品（kit.js のあと、アプリより先に読む）
   ・祝日       School.holiday('2026-05-06') → '振替休日'。法律の決まりから計算する（2000〜2099年）
   ・くじ       School.rng(種) … 同じ種なら同じ並び（テストと「やり直し」に使う）
   ・名簿       School.classes … クラスの一覧・いま選んでいるクラス・名前を隠す・クラスの切り替え帯
   ・共有       School.share … 予定などを、リンク（#share=…）かファイルにして渡す。生徒の名前は入れない
   ・印刷       School.print … 印刷用の中身だけを、用紙の向きを決めて印刷する
   ・表計算     School.tsv … Excel にそのまま貼れる文字（タブ区切り）
   どれも、ほかのアプリやテスト（tools/test.cjs）から使えるよう window.School に置く。 */
(function () {
  'use strict';
  const { h } = Kit;
  const School = (window.School = {});
  const pad = (n) => String(n).padStart(2, '0');
  const ymdOf = (y, m, d) => y + '-' + pad(m) + '-' + pad(d);

  /* ───────── 祝日（国民の祝日に関する法律の決まりから計算） ───────── */
  // 第n月曜日
  const nthMonday = (y, m, n) => { const first = new Date(y, m - 1, 1).getDay(); return 1 + ((8 - first) % 7) + (n - 1) * 7; };
  const shunbun = (y) => Math.floor(20.8431 + 0.242194 * (y - 1980) - Math.floor((y - 1980) / 4));
  const shubun = (y) => Math.floor(23.2488 + 0.242194 * (y - 1980) - Math.floor((y - 1980) / 4));
  const holidayCache = new Map();
  function holidaysOf(y) {
    if (holidayCache.has(y)) return holidayCache.get(y);
    const out = {};
    if (y < 2000 || y > 2099) { holidayCache.set(y, out); return out; }
    const put = (m, d, name) => { out[ymdOf(y, m, d)] = name; };
    put(1, 1, '元日');
    put(1, nthMonday(y, 1, 2), '成人の日');
    put(2, 11, '建国記念の日');
    if (y >= 2020) put(2, 23, '天皇誕生日');
    put(3, shunbun(y), '春分の日');
    put(4, 29, y >= 2007 ? '昭和の日' : 'みどりの日');
    put(5, 3, '憲法記念日');
    if (y >= 2007) put(5, 4, 'みどりの日');
    put(5, 5, 'こどもの日');
    if (y === 2020) put(7, 23, '海の日'); else if (y === 2021) put(7, 22, '海の日'); else if (y >= 2003) put(7, nthMonday(y, 7, 3), '海の日'); else put(7, 20, '海の日');
    if (y === 2020) put(8, 10, '山の日'); else if (y === 2021) put(8, 8, '山の日'); else if (y >= 2016) put(8, 11, '山の日');
    put(9, y >= 2003 ? nthMonday(y, 9, 3) : 15, '敬老の日');
    put(9, shubun(y), '秋分の日');
    if (y === 2020) put(7, 24, 'スポーツの日'); else if (y === 2021) put(7, 23, 'スポーツの日'); else put(10, nthMonday(y, 10, 2), y >= 2020 ? 'スポーツの日' : '体育の日');
    put(11, 3, '文化の日');
    put(11, 23, '勤労感謝の日');
    if (y <= 2018) put(12, 23, '天皇誕生日');
    if (y === 2019) { put(4, 30, '国民の休日'); put(5, 1, '即位の日'); put(5, 2, '国民の休日'); put(10, 22, '即位礼正殿の儀'); }
    // 国民の休日：祝日にはさまれた平日
    const keys = Object.keys(out).sort();
    for (const k of keys) {
      const d = Kit.parseYmd(k);
      const next2 = Kit.ymd(Kit.addDays(d, 2)), next1 = Kit.ymd(Kit.addDays(d, 1));
      if (out[next2] && !out[next1] && Kit.parseYmd(next1).getDay() !== 0) out[next1] = '国民の休日';
    }
    // 振替休日：日曜の祝日のあと、最初の祝日でない日
    for (const k of Object.keys(out).sort()) {
      if (Kit.parseYmd(k).getDay() !== 0 || out[k] === '振替休日') continue;
      let d = Kit.addDays(k, 1);
      while (out[Kit.ymd(d)]) d = Kit.addDays(d, 1);
      if (d.getFullYear() === y) out[Kit.ymd(d)] = '振替休日';
    }
    holidayCache.set(y, out);
    return out;
  }
  School.holidaysOf = holidaysOf;
  School.holiday = (s) => { const k = String(s || ''); if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) return ''; return holidaysOf(+k.slice(0, 4))[k] || ''; };
  // 土日・祝日か
  School.isOff = (s) => { const d = Kit.parseYmd(s).getDay(); return d === 0 || d === 6 || !!School.holiday(s); };

  /* ───────── くじ（種つきの乱数） ───────── */
  // mulberry32：同じ種なら同じ数の並び。種がなければ毎回ちがう
  School.rng = (seed) => {
    let a = (seed == null ? (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) : seed) >>> 0;
    const next = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    next.int = (n) => Math.floor(next() * n);
    next.pick = (arr) => arr[Math.floor(next() * arr.length)];
    next.shuffle = (arr) => { const a2 = arr.slice(); for (let i = a2.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [a2[i], a2[j]] = [a2[j], a2[i]]; } return a2; };
    return next;
  };
  School.newSeed = () => (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;

  /* ───────── 表計算に貼る文字・名簿の読み取り ───────── */
  School.tsv = (rows) => rows.map((r) => r.map((c) => String(c == null ? '' : c).replace(/[\t\r\n]+/g, ' ')).join('\t')).join('\n');

  const GENDER = { 男: 'm', 男子: 'm', m: 'm', M: 'm', male: 'm', 女: 'f', 女子: 'f', f: 'f', F: 'f', female: 'f' };
  const HEAD = {
    no: /^(番号|出席番号|出席|No\.?|NO\.?|no\.?|#|番)$/, name: /^(氏名|名前|生徒名|生徒氏名|なまえ|name)$/i, sei: /^(姓|苗字|名字)$/, mei: /^(名)$/,
    kana: /^(ふりがな|フリガナ|よみ|読み|よみがな|かな|カナ)$/, gender: /^(性別|男女)$/, front: /^(配慮|前の席|視力|前方)$/,
  };
  const isKana = (c) => /^[ぁ-ゖァ-ヺー・ 　]+$/.test(c);
  const isNum = (c) => /^\d{1,3}$/.test(String(c).normalize('NFKC'));
  const isClassCell = (c) => /^(\d+年)?\d+組$|^\d+-\d+$|^[A-ZＡ-Ｚ]組$/.test(String(c).normalize('NFKC'));
  const YES = /^(○|◯|〇|1|はい|あり|前|要|yes|true)$/i;
  // Excel・名簿から貼り付けた文字を読む。1行1人。
  // 「氏名」「番号 氏名」「組 番号 氏名」「番号 姓 名」「番号 氏名 ふりがな 性別」など。見出しの行があれば、それに合わせる
  School.parseRoster = (text) => {
    const lines = String(text || '').replace(/^﻿/, '').split(/\r?\n/).map((l) => l.replace(/　/g, ' ').trim()).filter(Boolean);
    const sep = lines.some((l) => l.includes('\t')) ? '\t' : lines.some((l) => l.includes(',')) ? ',' : ' ';
    let rows = lines.map((l) => (sep === ' ' ? l.split(/ +/) : l.split(sep)).map((c) => c.trim()));
    let cols = null;
    if (rows.length) {
      const map = {};
      rows[0].forEach((c, i) => { for (const k in HEAD) if (HEAD[k].test(c) && map[k] == null) map[k] = i; });
      if (map.name != null || map.sei != null || map.no != null) { cols = map; rows = rows.slice(1); }
    }
    const out = [];
    for (const r of rows) {
      let no = null, name = '', kana = '', gender = '', front = false;
      if (cols) {
        const at = (k) => (cols[k] != null ? String(r[cols[k]] || '').trim() : '');
        if (cols.no != null) no = parseInt(at('no').normalize('NFKC'), 10);
        name = cols.name != null ? at('name') : [at('sei'), at('mei')].filter(Boolean).join(' ');
        kana = at('kana');
        gender = GENDER[at('gender')] || '';
        front = YES.test(at('front'));
      } else {
        const text = [];
        for (const c of r) {
          if (!c) continue;
          if (isNum(c)) no = +String(c).normalize('NFKC'); // 2つあれば（組 番号）あとのほう
          else if (GENDER[c]) gender = GENDER[c];
          else if (isClassCell(c)) continue;
          else text.push(c);
        }
        if (sep === ' ' || text.length <= 1) name = text.join(' ');
        else if (/\s/.test(text[0])) { name = text[0]; if (isKana(text[1])) kana = text[1]; }
        else if (isKana(text[1]) && (/\s/.test(text[1]) || text[1].length >= 5)) { name = text[0]; kana = text[1]; }
        else { name = text[0] + ' ' + text[1]; if (text[2] && isKana(text[2])) kana = text[2]; }
      }
      name = name.replace(/\s+/g, ' ').trim();
      if (!name && !(no > 0)) continue;
      out.push({ no: Number.isFinite(no) && no > 0 ? no : null, name, kana, gender, front });
    }
    // 番号がない行は、前の人の次の番号に
    let last = 0;
    for (const s of out) { if (s.no == null) s.no = last + 1; last = s.no; }
    return out;
  };

  /* ───────── 名簿（クラス） ───────── */
  // 架空のクラス（サンプル）。id を決めておくと、ほかのアプリのサンプルから名前で指せる
  const SAMPLE_NAMES = [
    ['相川 そら', 'm'], ['井上 ゆい', 'f'], ['上田 はると', 'm'], ['遠藤 さくら', 'f'], ['大野 りく', 'm'], ['加藤 ひなた', 'f'],
    ['木村 そうた', 'm'], ['久保 あおい', 'f'], ['小林 ゆうと', 'm'], ['斉藤 めい', 'f'], ['佐野 けんと', 'm'], ['島田 りん', 'f'],
    ['杉本 たくみ', 'm'], ['関 ここな', 'f'], ['田中 こうき', 'm'], ['千葉 みお', 'f'], ['土屋 はやと', 'm'], ['中島 あかり', 'f'],
    ['西村 しょう', 'm'], ['野口 ゆな', 'f'], ['橋本 だいち', 'm'], ['林 こはる', 'f'], ['平野 れん', 'm'], ['藤田 ほのか', 'f'],
    ['星野 いぶき', 'm'], ['前田 ちさと', 'f'], ['松本 かいと', 'm'], ['宮崎 みゆ', 'f'], ['村上 ゆうせい', 'm'], ['森 さな', 'f'],
    ['山口 りょう', 'm'], ['吉田 ひより', 'f'],
  ];
  const SAMPLE_CLASS = {
    id: 's-class-1', name: '2年3組', note: '架空のクラスです',
    students: SAMPLE_NAMES.map(([name, gender], i) => ({ id: 's-st-' + (i + 1), no: i + 1, name, kana: '', gender, front: i === 4 || i === 13 || i === 21, note: i === 4 ? '視力（前の席）' : '' })),
  };
  School.SAMPLE_CLASS = SAMPLE_CLASS;
  School.sampleStudent = (no) => 's-st-' + no;
  Kit.store.sample('classes', [SAMPLE_CLASS]);

  const byNo = (a, b) => (a.no || 0) - (b.no || 0) || String(a.name || '').localeCompare(String(b.name || ''), 'ja');
  School.classes = {
    async list() {
      const all = await Kit.store.list('classes', { sample: [SAMPLE_CLASS] });
      for (const c of all) c.students = (Array.isArray(c.students) ? c.students : []).slice().sort(byNo);
      return all.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ja', { numeric: true }));
    },
    // いま選んでいるクラス（なければ最初のクラス。1つもなければ null）
    async current() {
      const all = await School.classes.list();
      const id = Kit.pref.get('class', null);
      return all.find((c) => c.id === id) || all[0] || null;
    },
    setCurrent(id) { Kit.pref.set('class', id); emitClass(); },
    async get(id) { const all = await School.classes.list(); return all.find((c) => c.id === id) || null; },
    async save(c) { const it = Kit.clone(c); delete it.sample; it.students = (it.students || []).slice().sort(byNo); return Kit.store.put('classes', it); },
    // クラスを消す。席・係・宿題など、そのクラスの記録も一緒に消す（各アプリが onRemove で登録）
    async remove(id) {
      for (const fn of removeHooks) { try { await fn(id); } catch (e) { console.error(e); } }
      await Kit.store.remove('classes', id);
      if (Kit.pref.get('class', null) === id) Kit.pref.set('class', null);
      emitClass();
    },
    onRemove(fn) { removeHooks.push(fn); },
  };
  const removeHooks = [];
  // そのクラスの記録をまとめて消す小物（アプリの onRemove 用）
  School.removeByClass = (coll) => async (classId) => { for (const it of await Kit.store.list(coll)) if (it.classId === classId) await Kit.store.remove(coll, it.id); };
  // クラスの切り替えを、開いている画面に知らせる
  const classListeners = new Set();
  function emitClass() { for (const fn of [...classListeners]) { try { fn(); } catch (e) { console.error(e); } } }
  School.onClassChange = (fn) => { classListeners.add(fn); return () => classListeners.delete(fn); };

  // 名前を隠す（教室で画面を映すとき）。番号だけを出す
  School.hidden = () => !!Kit.pref.get('hideNames', false);
  School.setHidden = (v) => { Kit.pref.set('hideNames', !!v); emitClass(); };
  // 生徒の呼び方：'3 青木 そら' / 名前を隠すときは '3番'
  School.label = (st, o = {}) => {
    if (!st) return '';
    const hide = o.hide == null ? School.hidden() : o.hide;
    if (hide || !st.name) return st.no + '番';
    if (o.short) return st.name.split(' ')[0] || st.name;
    return o.noNumber ? st.name : st.no + ' ' + st.name;
  };

  // アプリの上に出す「クラスの切り替え帯」。onChange(クラス) を呼ぶ。返り値は帯の要素
  School.classBar = async ({ onChange, extra } = {}) => {
    const all = await School.classes.list();
    const cur = await School.classes.current();
    const bar = h('div', { class: 'sk-classbar', role: 'group', 'aria-label': 'クラス' });
    if (!cur) {
      bar.append(h('span', { class: 'small' }, 'まだクラスがありません。'), Kit.btn('名簿をつくる', () => Kit.go('roster'), { sm: true, kind: 'primary', icon: 'users' }));
      return bar;
    }
    const sel = h('select', { id: 'sk-class-select', 'aria-label': 'クラスを選ぶ' }, all.map((c) => h('option', { value: c.id }, c.name || '（名前なし）')));
    sel.value = cur.id;
    sel.addEventListener('change', async () => { School.classes.setCurrent(sel.value); if (onChange) onChange(await School.classes.current()); });
    const hide = h('input', { type: 'checkbox', id: 'sk-hide-names', checked: School.hidden(), onchange: () => School.setHidden(hide.checked) });
    Kit.add(bar, [
      h('label', { for: 'sk-class-select', class: 'sk-classbar-l' }, 'クラス'), sel,
      h('span', { class: 'small muted num sk-classbar-n' }, cur.students.length + '人'),
      cur.sample ? h('span', { class: 'chip sample' }, '架空') : null,
      h('span', { class: 'grow' }),
      h('label', { class: 'check small', for: 'sk-hide-names', title: '教室で画面を映すときに' }, hide, '名前を隠す'),
      Kit.btn('名簿', () => Kit.go('roster'), { sm: true, kind: 'ghost', icon: 'users', class: 'sk-classbar-roster' }),
      extra || null]);
    return bar;
  };

  /* ───────── 共有（リンク・ファイル） ─────────
     中身は JSON → deflate-raw で縮める → base64url。先頭の1文字で形式（z=縮めた / j=そのまま）。
     リンクの # より後ろはサーバーに送られないので、共有の中身がサーバーの記録に残らない。 */
  const b64url = (bytes) => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  const unb64url = (str) => { const s = String(str).replace(/-/g, '+').replace(/_/g, '/'); const bin = atob(s + '==='.slice((s.length + 3) % 4)); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; };
  async function pipe(bytes, stream) { return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer()); }
  // 縮めたものを戻す。大きすぎるもの（わざと作った圧縮爆弾など）は途中でやめる
  async function inflate(bytes, limit) {
    const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
    const parts = []; let n = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      n += value.length;
      if (n > limit) { try { await reader.cancel(); } catch (e) { /* noop */ } throw new Error('共有の中身が大きすぎます'); }
      parts.push(value);
    }
    const out = new Uint8Array(n); let o = 0;
    for (const p of parts) { out.set(p, o); o += p.length; }
    return out;
  }
  const SHARE_LIMIT = 2 * 1024 * 1024;
  School.share = {
    KINDS: { events: '予定', reminders: 'リマインダー', timetable: '時間割' },
    async encode(obj) {
      const bytes = new TextEncoder().encode(JSON.stringify(obj));
      if (typeof CompressionStream === 'function') {
        try { return 'z' + b64url(await pipe(bytes, new CompressionStream('deflate-raw'))); } catch (e) { /* 縮められなければそのまま */ }
      }
      return 'j' + b64url(bytes);
    },
    async decode(str) {
      const s = String(str || '').trim();
      const kind = s[0], bytes = unb64url(s.slice(1));
      let raw = bytes;
      if (kind === 'z') {
        if (typeof DecompressionStream !== 'function') throw new Error('このブラウザでは共有リンクを開けません。新しいブラウザで開いてください');
        raw = await inflate(bytes, SHARE_LIMIT);
      } else if (kind !== 'j') throw new Error('共有リンクの形が正しくありません');
      else if (raw.length > SHARE_LIMIT) throw new Error('共有の中身が大きすぎます');
      const obj = JSON.parse(new TextDecoder().decode(raw));
      if (!obj || obj.app !== 'sensei-kit' || !School.share.KINDS[obj.kind] || !Array.isArray(obj.items)) throw new Error('先生の道具箱の共有ではありません');
      return obj;
    },
    // 共有の中身を作る（生徒の名前・メモの持ち出しを防ぐため、決めた項目だけを入れる）
    pack(kind, items, o = {}) {
      return { app: 'sensei-kit', v: 1, kind, title: String(o.title || '').slice(0, 80), from: String(o.from || '').slice(0, 40), at: new Date().toISOString(), items };
    },
    // リンクにできる場所か（file:// や Artifact の中では、相手が開けるリンクにならない）
    canLink() { return /^https?:$/.test(location.protocol) && !Kit.env.artifact; },
    baseUrl() { return location.href.split('#')[0]; },
    async link(pack) { return School.share.baseUrl() + '#share=' + (await School.share.encode(pack)); },
    // 共有ダイアログ：リンク（とQR）・ファイル・コピー
    async open(pack, o = {}) {
      const n = pack.items.length;
      const body = h('div', { class: 'stack' });
      const what = h('p', null, (o.what || School.share.KINDS[pack.kind]) + ' ' + n + '件を共有します。', h('br'), h('span', { class: 'small muted' }, o.note || '受け取った人は、中身を確かめてから自分の道具箱に取り込めます。生徒の名前は入りません。'));
      body.append(what);
      if (School.share.canLink()) {
        const url = await School.share.link(pack);
        const inp = h('input', { type: 'text', readonly: true, value: url, id: 'sk-share-url', 'aria-label': '共有リンク' });
        inp.addEventListener('focus', () => inp.select());
        body.append(Kit.field({ label: '共有リンク', input: inp, hint: url.length > 1800 ? 'リンクが長いので、メールやチャットで送るのがおすすめです（QRコードにはできません）。' : 'メール・チャット・Classroom などに貼って送れます。' }));
        const row = h('div', { class: 'btn-row' }, Kit.btn('リンクをコピー', () => Kit.copy(url, '共有リンクをコピーしました'), { kind: 'primary', icon: 'copy' }));
        if (navigator.share) row.append(Kit.btn('ほかのアプリで送る', () => navigator.share({ title: pack.title || '先生の道具箱', url }).catch(() => {}), { icon: 'share' }));
        body.append(row);
        if (url.length <= 1100 && window.qrcode) {
          try { const c = Kit.qr(url, { cell: 4, level: 'L' }); c.classList.add('sk-share-qr'); c.setAttribute('role', 'img'); c.setAttribute('aria-label', '共有リンクのQRコード'); body.append(h('div', { class: 'sk-share-qrbox' }, c, h('span', { class: 'small muted' }, 'となりの先生のスマホで読み取れます。'))); }
          catch (e) { /* QR にできない長さ */ }
        }
      } else {
        body.append(h('p', { class: 'sk-note' }, Kit.env.artifact ? 'この画面からは、相手が開けるリンクを作れません。下のファイルで渡してください。' : 'このファイルをパソコンで直接開いているので、リンクは作れません。下のファイルで渡してください（Web に置いたページで開くと、リンクも作れます）。'));
      }
      const file = async () => {
        const name = 'sensei-share-' + pack.kind + '-' + Kit.ymd() + '.json';
        if (await Kit.download(name, JSON.stringify(pack, null, 1))) Kit.toast('共有用のファイルを書き出しました');
      };
      body.append(h('hr', { class: 'divider' }), h('div', { class: 'btn-row' }, Kit.btn('共有用のファイル（.json）', file, { icon: 'download' }), h('span', { class: 'small muted' }, '相手は ホーム →「共有を受け取る」で開けます。')));
      if (o.extra) body.append(o.extra);
      Kit.modal({ title: o.title || '共有する', body, wide: false, actions: [{ label: '閉じる', kind: 'ghost' }] });
    },
  };

  // 受け取る係：#share=… で開かれたら、その種類の画面を開いてから、取り込みの確認を出す
  const receivers = new Map(); // kind → async (pack) => void
  School.share.receive = (kind, fn) => receivers.set(kind, fn);
  const pending = { pack: null, error: null };
  School.share.take = async (pack) => {
    const fn = receivers.get(pack.kind);
    if (!fn) { Kit.toast('この種類の共有は、まだ受け取れません', { type: 'bad' }); return; }
    await fn(pack);
  };
  const ROUTE = { events: 'calendar', reminders: 'reminders', timetable: 'timetable' };
  Kit.hashHandlers.push((raw) => {
    if (!raw.startsWith('share=')) return null;
    const code = raw.slice(6);
    pending.pack = null; pending.error = null;
    School.share.decode(code).then((p) => { pending.pack = p; }).catch((e) => { pending.error = e; }).finally(() => {
      setTimeout(() => {
        if (pending.error) { Kit.toast('共有リンクを開けませんでした：' + ((pending.error && pending.error.message) || pending.error), { type: 'bad', ms: 8000 }); return; }
        if (pending.pack) { if (ROUTE[pending.pack.kind] && Kit.current() !== ROUTE[pending.pack.kind]) Kit.go(ROUTE[pending.pack.kind]); setTimeout(() => School.share.take(pending.pack), 250); }
      }, 300);
    });
    return 'home';
  });
  // ファイルから受け取る（ホームの「共有を受け取る」）
  School.share.fromFile = async () => {
    const f = await Kit.img.pick('application/json,.json');
    if (!f) return;
    if (f.size > SHARE_LIMIT) { Kit.toast('ファイルが大きすぎます（共有ファイルではないかもしれません）', { type: 'bad' }); return; }
    let pack;
    try { pack = JSON.parse(await f.text()); } catch (e) { Kit.toast('ファイルを読めませんでした', { type: 'bad' }); return; }
    if (!pack || pack.app !== 'sensei-kit' || !School.share.KINDS[pack.kind] || !Array.isArray(pack.items)) { Kit.toast('先生の道具箱の共有ファイルではありません', { type: 'bad' }); return; }
    if (ROUTE[pack.kind]) Kit.go(ROUTE[pack.kind]);
    setTimeout(() => School.share.take(pack), 250);
  };

  /* ───────── 印刷 ─────────
     School.print({ landscape, size, margin, build: () => 要素 }) … 道具箱の画面は隠して、渡した中身だけを印刷する。
     size は '257mm 364mm'（B4）のように紙の大きさを決めるとき（決めなければ A4） */
  let printRoot = null, pageStyle = null;
  School.print = ({ landscape = false, build, margin = '12mm', size }) => {
    if (!printRoot) { printRoot = h('div', { id: 'sk-print', 'aria-hidden': 'true' }); document.body.append(printRoot); }
    Kit.clear(printRoot);
    printRoot.append(build());
    if (pageStyle) pageStyle.remove();
    pageStyle = h('style', null, '@page { size: ' + (size || 'A4 ' + (landscape ? 'landscape' : 'portrait')) + '; margin: ' + margin + '; }');
    document.head.append(pageStyle);
    document.documentElement.classList.add('sk-printing');
    const done = () => { document.documentElement.classList.remove('sk-printing'); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    setTimeout(() => { try { window.print(); } catch (e) { Kit.toast('この画面では印刷できません。手元のブラウザで開いてください', { type: 'bad' }); done(); } }, 60);
  };

  /* ───────── 共通の見た目 ───────── */
  Kit.css('school', `
.sk-classbar{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;padding:6px 8px 6px 12px;margin-bottom:12px;border:1px solid var(--line);border-radius:var(--r);background:var(--surface)}
.sk-classbar select{width:auto;min-width:8em;max-width:100%;font-weight:700}
@media (max-width:640px){.sk-classbar{gap:6px}.sk-classbar-l,.sk-classbar-n{display:none}.sk-classbar .sk-classbar-roster span{display:none}.sk-classbar .sk-classbar-roster{padding:0;width:40px}}
.sk-classbar-l{font-weight:700;color:var(--ink-2)}
.sk-note{font-size:12.5px;color:var(--ink-2);background:var(--surface-2);border-radius:8px;padding:8px 10px}
.sk-share-qrbox{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.sk-share-qr{width:148px;height:148px;image-rendering:pixelated;border-radius:6px;border:1px solid var(--line)}
.sk-steps{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 14px}
.sk-step{display:inline-flex;align-items:center;gap:8px;min-height:36px;padding:4px 14px 4px 6px;border-radius:999px;border:1px solid var(--line);background:var(--surface);color:var(--ink-2);font:inherit;font-size:14px;cursor:pointer}
.sk-step b{display:inline-grid;place-items:center;width:24px;height:24px;border-radius:50%;background:var(--surface-2);font-size:12.5px;color:var(--ink-2)}
.sk-step[aria-current="step"]{border-color:var(--gosu);background:var(--gosu-wash);color:var(--ink);font-weight:700}
.sk-step[aria-current="step"] b{background:var(--gosu);color:var(--on-gosu)}
.sk-step:hover{border-color:var(--gosu)}
#sk-print{display:none}
@media print{
  html.sk-printing body>*:not(#sk-print){display:none!important}
  html.sk-printing #sk-print{display:block!important;color:#000;background:#fff}
  html.sk-printing body{background:#fff}
}
`);
})();

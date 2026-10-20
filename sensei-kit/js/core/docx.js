/* Word（.docx）を、その場でつくる（サーバーも部品の読み込みもなし）。画面と切りはなした計算なので、Node でも動く（tools/test.cjs）。
   Docx.build({
     page: { w: 210, h: 297, margin: 12, cols: 1, gap: 7 },  … 大きさ・余白・段の間は mm。cols は body の段の数
     font: '游ゴシック', size: 10.5,                       … 字体（日本語）と、ふつうの字の大きさ（pt）
     title, head: [ブロック…], body: [ブロック…] })       … head は1段（全部の幅）、body は cols 段。→ Uint8Array（.docx の中身）
   ブロック：
     { p: '文字' | [{ t, b, size, u, color, font, sp }], b, size, color（'FFFFFF' など）, font（字体名）, sp（字の間 pt）,
       align: 'left'|'center'|'right'|'both', before, after（pt）, line（行の高さの倍率）, shade（地の色）,
       border: { top, bottom, left, right: 'single'|'double'|'thick'|'heavy'|'dashed'|'dotted', color }, indent・first（1行目）・hanging（2行目から）（mm）, keep（次とはなさない） }
     { table: [[セル…]…], widths: [割合…], border: 'all'|'box'|'none', line: 'single'|'double'|'dashed'|'dotted', thick, sz（線の太さ 1/8pt）, color,
       header（1行目を見出しに）, shade: 'E8E8E8' }
        セル：'文字' | { p, b, size, align, color, font, shade, span, valign, borders: { top… , sz }, blocks: [ブロック…] }（blocks があればそれを中に入れる）
     { img: Uint8Array, type: 'png'|'jpeg', w・h（mm）か frac（幅の割合）・ratio（高さ÷幅）, align }
     どのブロックも full: true で、段組みの本文の中でも全部の幅に置く（前後で段を区切る）
   ZIP は「圧縮なし」で書く（写真はもともと縮んでいるので、大きさはほぼ変わらない） */
(function (root) {
  'use strict';
  const TW = 56.6929; // 1mm = 56.69 twip（1/20 pt）
  const EMU = 36000; // 1mm = 36000 EMU
  const tw = (mm) => Math.round(mm * TW);
  const enc = (s) => new TextEncoder().encode(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  /* ───────── ZIP（圧縮なし） ───────── */
  let CRC = null;
  function crc32(buf) {
    if (!CRC) { CRC = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; CRC[n] = c >>> 0; } }
    let c = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  function zip(files) {
    const parts = [], central = [];
    let offset = 0;
    const DATE = ((2026 - 1980) << 9) | (1 << 5) | 1, TIME = 0;
    for (const f of files) {
      const name = enc(f.name), data = typeof f.data === 'string' ? enc(f.data) : f.data, crc = crc32(data);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
      lh.setUint16(10, TIME, true); lh.setUint16(12, DATE, true); lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true);
      lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
      parts.push(new Uint8Array(lh.buffer), name, data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
      ch.setUint16(12, TIME, true); ch.setUint16(14, DATE, true); ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true);
      ch.setUint16(28, name.length, true); ch.setUint32(42, offset, true);
      central.push(new Uint8Array(ch.buffer), name);
      offset += 30 + name.length + data.length;
    }
    const cdSize = central.reduce((s, a) => s + a.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
    const all = parts.concat(central, [new Uint8Array(end.buffer)]);
    const out = new Uint8Array(all.reduce((s, a) => s + a.length, 0));
    let p = 0;
    for (const a of all) { out.set(a, p); p += a.length; }
    return out;
  }

  /* ───────── 文書 ───────── */
  const BORDER = { single: ['single', 6], double: ['double', 6], thick: ['single', 18], heavy: ['single', 24], dashed: ['dashed', 6], dotted: ['dotted', 12] };
  const col = (c) => (/^[0-9A-Fa-f]{6}$/.test(String(c || '')) ? String(c).toUpperCase() : '000000');
  const bd = (side, kind, color) => { const b = BORDER[kind]; return b ? `<w:${side} w:val="${b[0]}" w:sz="${b[1]}" w:space="${side === 'left' || side === 'right' ? 4 : 1}" w:color="${col(color)}"/>` : ''; };

  function runs(p, base) {
    const list = Array.isArray(p) ? p : [{ t: p }];
    return list.map((r) => {
      const o = typeof r === 'string' ? { t: r } : r;
      const b = o.b != null ? o.b : base.b, size = o.size || base.size, color = o.color || base.color, font = o.font || base.font, sp = o.sp != null ? o.sp : base.sp;
      const rpr = (font ? `<w:rFonts w:ascii="${esc(font)}" w:hAnsi="${esc(font)}" w:eastAsia="${esc(font)}"/>` : '') + (b ? '<w:b/><w:bCs/>' : '')
        + (color ? `<w:color w:val="${col(color)}"/>` : '') + (sp ? `<w:spacing w:val="${Math.round(sp * 20)}"/>` : '')
        + (size ? `<w:sz w:val="${Math.round(size * 2)}"/><w:szCs w:val="${Math.round(size * 2)}"/>` : '') + (o.u ? '<w:u w:val="single"/>' : '');
      const text = String(o.t == null ? '' : o.t).split('\n').map((s) => `<w:t xml:space="preserve">${esc(s)}</w:t>`).join('<w:br/>');
      return `<w:r>${rpr ? '<w:rPr>' + rpr + '</w:rPr>' : ''}${text}</w:r>`;
    }).join('');
  }
  function para(b) {
    let ppr = '';
    if (b.keep) ppr += '<w:keepNext/>';
    if (b.border) ppr += '<w:pBdr>' + ['top', 'left', 'bottom', 'right'].map((s) => bd(s, b.border[s], b.border.color)).join('') + '</w:pBdr>';
    if (b.shade) ppr += `<w:shd w:val="clear" w:color="auto" w:fill="${b.shade}"/>`;
    const sp = [];
    if (b.before != null) sp.push(`w:before="${Math.round(b.before * 20)}"`);
    if (b.after != null) sp.push(`w:after="${Math.round(b.after * 20)}"`);
    if (b.line) sp.push(`w:line="${Math.round(b.line * 240)}" w:lineRule="auto"`);
    if (sp.length) ppr += '<w:spacing ' + sp.join(' ') + '/>';
    if (b.indent || b.first || b.hanging) ppr += `<w:ind w:left="${tw((b.indent || 0) + (b.hanging || 0))}"${b.first ? ` w:firstLine="${tw(b.first)}"` : ''}${b.hanging ? ` w:hanging="${tw(b.hanging)}"` : ''}/>`;
    if (b.align && b.align !== 'left') ppr += `<w:jc w:val="${b.align === 'both' ? 'both' : b.align}"/>`;
    return `<w:p>${ppr ? '<w:pPr>' + ppr + '</w:pPr>' : ''}${runs(b.p == null ? '' : b.p, b)}</w:p>`;
  }

  function build(o) {
    const page = Object.assign({ w: 210, h: 297, margin: 12, cols: 1, gap: 7 }, o.page || {});
    const media = [];
    const full = page.w - page.margin * 2;
    const colW = page.cols > 1 ? (full - page.gap * (page.cols - 1)) / page.cols : full;
    let pics = 0;

    function image(b, avail) {
      const id = 'rIdImg' + (media.length + 1), ext = b.type === 'png' ? 'png' : 'jpeg';
      media.push({ id, name: 'media/image' + (media.length + 1) + '.' + ext, data: b.img });
      const w = b.frac ? avail * Math.min(1, b.frac) : Math.min(b.w || avail, avail), hh = b.ratio ? w * b.ratio : b.h ? (b.h * w) / (b.w || w) : w * 0.66;
      const cx = Math.round(w * EMU), cy = Math.round(hh * EMU), n = ++pics;
      const draw = `<w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${n}" name="図 ${n}"/>`
        + '<wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>'
        + '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic>'
        + `<pic:nvPicPr><pic:cNvPr id="${n}" name="image${n}.${ext}"/><pic:cNvPicPr/></pic:nvPicPr>`
        + `<pic:blipFill><a:blip r:embed="${id}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>`
        + `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>`
        + '</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing>';
      return `<w:p><w:pPr><w:spacing w:before="0" w:after="60"/>${b.align && b.align !== 'left' ? `<w:jc w:val="${b.align}"/>` : ''}</w:pPr><w:r>${draw}</w:r></w:p>`;
    }
    function table(b, avail) {
      const rows = b.table || [];
      const nCols = Math.max(1, ...rows.map((r) => r.reduce((s, c) => s + ((c && c.span) || 1), 0)));
      const fr = (b.widths && b.widths.length === nCols ? b.widths : Array(nCols).fill(1));
      const sum = fr.reduce((s, x) => s + x, 0) || 1;
      const widths = fr.map((x) => tw((avail * x) / sum));
      const kind = b.border || 'all';
      const style = { double: 'double', dashed: 'dashed', dotted: 'dotted' }[b.line] || 'single';
      const line = (side, on) => (on ? `<w:${side} w:val="${style}" w:sz="${b.sz || (b.thick ? 12 : 4)}" w:space="0" w:color="${col(b.color)}"/>` : `<w:${side} w:val="nil"/>`);
      // セルごとの線（table の線より先に効く）
      const cellLine = (kind, color, sz) => { const k = BORDER[kind]; return k ? `w:val="${k[0]}" w:sz="${sz || (kind === 'thick' || kind === 'heavy' ? 12 : 6)}" w:space="0" w:color="${col(color)}"` : 'w:val="nil"'; };
      const tcb = (c) => (c.borders ? '<w:tcBorders>' + ['top', 'left', 'bottom', 'right'].filter((s) => c.borders[s]).map((s) => `<w:${s} ${cellLine(c.borders[s], c.borders.color || b.color, c.sz)}/>`).join('') + '</w:tcBorders>' : '');
      const borders = '<w:tblBorders>' + line('top', kind !== 'none') + line('left', kind !== 'none') + line('bottom', kind !== 'none') + line('right', kind !== 'none') + line('insideH', kind === 'all') + line('insideV', kind === 'all') + '</w:tblBorders>';
      let xml = `<w:tbl><w:tblPr><w:tblW w:w="${widths.reduce((s, x) => s + x, 0)}" w:type="dxa"/>${borders}<w:tblLayout w:type="fixed"/>`
        + `<w:tblCellMar><w:top w:w="${b.pad != null ? tw(b.pad) : 40}" w:type="dxa"/><w:left w:w="${b.pad != null ? tw(b.pad) : 85}" w:type="dxa"/><w:bottom w:w="${b.pad != null ? tw(b.pad) : 40}" w:type="dxa"/><w:right w:w="${b.pad != null ? tw(b.pad) : 85}" w:type="dxa"/></w:tblCellMar></w:tblPr>`;
      xml += '<w:tblGrid>' + widths.map((w) => `<w:gridCol w:w="${w}"/>`).join('') + '</w:tblGrid>';
      rows.forEach((r, ri) => {
        const head = b.header && ri === 0;
        xml += '<w:tr><w:trPr><w:cantSplit/>' + (head ? '<w:tblHeader/>' : '') + '</w:trPr>';
        let ci = 0;
        for (const c0 of r) {
          const c = c0 && typeof c0 === 'object' && !Array.isArray(c0) ? c0 : { p: c0 };
          const span = c.span || 1;
          const w = widths.slice(ci, ci + span).reduce((s, x) => s + x, 0);
          const cellW = (w / TW) - 3; // セルの中の幅（mm、左右の余白をひく）
          ci += span;
          const shade = c.shade || (head ? b.shade || 'E8E8E8' : '');
          xml += `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${span > 1 ? `<w:gridSpan w:val="${span}"/>` : ''}${tcb(c)}${shade ? `<w:shd w:val="clear" w:color="auto" w:fill="${shade}"/>` : ''}<w:vAlign w:val="${c.valign || 'center'}"/></w:tcPr>`;
          if (c.blocks && c.blocks.length) {
            const inner = c.blocks.map((x) => block(x, cellW)).join('');
            xml += inner + (/<\/w:tbl>$/.test(inner) || !inner ? '<w:p/>' : '');
          } else {
            const lines = String(c.p == null ? '' : Array.isArray(c.p) ? '' : c.p).split('\n');
            xml += Array.isArray(c.p) ? para(Object.assign({ after: 0, before: 0 }, c, { b: c.b != null ? c.b : head, shade: null, border: null })) : lines.map((t) => para({ p: t, b: c.b != null ? c.b : head, size: c.size, color: c.color, font: c.font, align: c.align || (head ? 'center' : null), after: 0, before: 0 })).join('');
          }
          xml += '</w:tc>';
        }
        xml += '</w:tr>';
      });
      return xml + '</w:tbl>';
    }
    function block(b, avail) {
      if (!b) return '';
      if (b.br === 'page') return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
      if (b.img) return image(b, avail);
      if (b.table) return table(b, avail) + (b.noGap ? '' : '<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="160" w:lineRule="exact"/></w:pPr></w:p>');
      return para(b);
    }

    const pgSz = `<w:pgSz w:w="${tw(page.w)}" w:h="${tw(page.h)}"${page.w > page.h ? ' w:orient="landscape"' : ''}/>`;
    const m = tw(page.margin);
    const pgMar = `<w:pgMar w:top="${m}" w:right="${m}" w:bottom="${m}" w:left="${m}" w:header="0" w:footer="0" w:gutter="0"/>`;
    const sect = (cols, cont) => `<w:sectPr>${cont ? '<w:type w:val="continuous"/>' : ''}${pgSz}${pgMar}<w:cols w:num="${cols}" w:space="${tw(page.gap)}"${cols > 1 && page.sep ? ' w:sep="1"' : ''}/><w:docGrid w:linePitch="360"/></w:sectPr>`;
    // 段の区切り：題字（head）は1段、本文（body）は cols 段。本文の full: true のブロックは1段（全部の幅）
    const secs = [];
    const put = (cols, xml) => { const last = secs[secs.length - 1]; if (last && last.cols === cols) last.xml += xml; else secs.push({ cols, xml }); };
    for (const b of o.head || []) put(1, block(b, full));
    for (const b of o.body || []) { if (!b) continue; const one = page.cols > 1 && b.full; put(one ? 1 : page.cols, block(b, one ? full : colW)); }
    if (!secs.length) secs.push({ cols: page.cols, xml: '' });
    let body = '';
    secs.forEach((s, i) => {
      body += s.xml;
      if (i < secs.length - 1) body += `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="120" w:lineRule="exact"/>${sect(s.cols, i > 0)}</w:pPr></w:p>`;
      else body += sect(s.cols, i > 0);
    });

    const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
    const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
    const font = esc(o.font || '游ゴシック'), latin = esc(o.latin || o.font || 'Yu Gothic');
    const size2 = Math.round((o.size || 10.5) * 2);
    const files = [
      { name: '[Content_Types].xml', data: XML + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>'
        + '<Default Extension="png" ContentType="image/png"/><Default Extension="jpeg" ContentType="image/jpeg"/>'
        + '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
        + '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
        + '<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>'
        + '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>'
        + '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>' },
      { name: '_rels/.rels', data: XML + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
        + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>'
        + '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>' },
      { name: 'docProps/core.xml', data: XML + '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
        + `<dc:title>${esc(o.title || '')}</dc:title><dc:creator>${esc(o.author || '')}</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString().slice(0, 19)}Z</dcterms:created></cp:coreProperties>` },
      { name: 'docProps/app.xml', data: XML + '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>先生の道具箱</Application></Properties>' },
      { name: 'word/_rels/document.xml.rels', data: XML + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        + '<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
        + '<Relationship Id="rIdSettings" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>'
        + media.map((x) => `<Relationship Id="${x.id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${x.name}"/>`).join('') + '</Relationships>' },
      { name: 'word/styles.xml', data: XML + '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults>'
        + `<w:rPrDefault><w:rPr><w:rFonts w:ascii="${latin}" w:hAnsi="${latin}" w:eastAsia="${font}" w:cs="${latin}"/><w:sz w:val="${size2}"/><w:szCs w:val="${size2}"/><w:lang w:val="en-US" w:eastAsia="ja-JP" w:bidi="ar-SA"/></w:rPr></w:rPrDefault>`
        + '<w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="300" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>'
        + '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>'
        + '<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>'
        + '</w:styles>' },
      { name: 'word/settings.xml', data: XML + '<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:defaultTabStop w:val="840"/><w:characterSpacingControl w:val="compressPunctuation"/>'
        + '<w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>' },
      { name: 'word/document.xml', data: XML + `<w:document ${NS}><w:body>${body}</w:body></w:document>` },
    ];
    for (const x of media) files.push({ name: 'word/' + x.name, data: x.data });
    return zip(files);
  }

  // dataURL → { bytes, type }（png・jpeg のほかは null。画面側で png に描き直してから渡す）
  function fromDataUrl(url) {
    const m = /^data:image\/(png|jpe?g);base64,(.*)$/.exec(String(url || ''));
    if (!m) return null;
    const bin = typeof atob === 'function' ? atob(m[2]) : Buffer.from(m[2], 'base64').toString('binary');
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { bytes, type: m[1] === 'png' ? 'png' : 'jpeg' };
  }

  const api = { build, zip, crc32, fromDataUrl, MIME: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
  root.Docx = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

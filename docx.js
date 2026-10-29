/* Exportación de la memoria a Word (.docx, WordprocessingML) sin dependencias:
   portada con cajetín, tabla de revisiones y firmas, índice (campo TOC que Word actualiza al abrir),
   encabezado y pie con número de página, títulos con estilos, tablas, listas de comprobaciones e imágenes (3D, esquema y gráficos SVG). */
var DOCX = (function(){
  'use strict';
  // ---------- ZIP (almacenado, sin compresión) ----------
  var CRC = (function(){ var t = new Uint32Array(256); for (var n = 0; n < 256; n++){ var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(u8){ var c = 0xFFFFFFFF; for (var i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function utf8(s){ return new TextEncoder().encode(s); }
  function zip(files){ // files: [{ name, data: Uint8Array }]
    var parts = [], central = [], off = 0, d = new Date(), dt = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(), tm = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    files.forEach(function(f){
      var nm = utf8(f.name), data = f.data, crc = crc32(data), h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true); h.setUint16(10, tm, true); h.setUint16(12, dt, true);
      h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, nm.length, true); h.setUint16(28, 0, true);
      parts.push(new Uint8Array(h.buffer), nm, data);
      var c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true); c.setUint16(12, tm, true); c.setUint16(14, dt, true);
      c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, nm.length, true); c.setUint16(30, 0, true); c.setUint16(32, 0, true);
      c.setUint16(34, 0, true); c.setUint16(36, 0, true); c.setUint32(38, 0, true); c.setUint32(42, off, true);
      central.push(new Uint8Array(c.buffer), nm);
      off += 30 + nm.length + data.length;
    });
    var csize = central.reduce(function(a, x){ return a + x.length; }, 0), e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, csize, true); e.setUint32(16, off, true);
    return new Blob(parts.concat(central, [new Uint8Array(e.buffer)]), { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  }
  // ---------- XML ----------
  function x(s){ return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  var NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
  function run(t, o){ o = o || {}; var pr = (o.b ? '<w:b/>' : '') + (o.i ? '<w:i/>' : '') + (o.color ? '<w:color w:val="' + o.color + '"/>' : '') + (o.sz ? '<w:sz w:val="' + o.sz + '"/><w:szCs w:val="' + o.sz + '"/>' : '') + (o.mono ? '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/>' : '');
    return String(t).split('\n').map(function(s, k){ return (k ? '<w:r><w:br/></w:r>' : '') + '<w:r>' + (pr ? '<w:rPr>' + pr + '</w:rPr>' : '') + '<w:t xml:space="preserve">' + x(s) + '</w:t></w:r>'; }).join(''); }
  function para(content, o){ o = o || {}; var pr = (o.style ? '<w:pStyle w:val="' + o.style + '"/>' : '') + (o.keep ? '<w:keepNext/>' : '') + (o.pb ? '<w:pageBreakBefore/>' : '') + (o.jc ? '<w:jc w:val="' + o.jc + '"/>' : '') + (o.ind ? '<w:ind w:left="' + o.ind + '"/>' : '') + (o.sp != null ? '<w:spacing w:before="0" w:after="' + o.sp + '"/>' : '');
    return '<w:p>' + (pr ? '<w:pPr>' + pr + '</w:pPr>' : '') + content + '</w:p>'; }
  function cell(content, o){ o = o || {}; return '<w:tc><w:tcPr>' + (o.w ? '<w:tcW w:w="' + o.w + '" w:type="dxa"/>' : '') + (o.fill ? '<w:shd w:val="clear" w:color="auto" w:fill="' + o.fill + '"/>' : '') + (o.span ? '<w:gridSpan w:val="' + o.span + '"/>' : '') + '</w:tcPr>' + (content || '<w:p/>') + '</w:tc>'; }
  function table(rows, o){ o = o || {};
    var ncol = Math.max.apply(null, rows.map(function(r){ return r.reduce(function(a, c){ return a + (c.span || 1); }, 0); })), W = 9638;
    var grid = '<w:tblGrid>' + new Array(ncol + 1).join('<w:gridCol w:w="' + Math.floor(W / ncol) + '"/>') + '</w:tblGrid>';
    var b = '<w:tblBorders>' + ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(function(k){ return '<w:' + k + ' w:val="single" w:sz="4" w:space="0" w:color="A0A6AE"/>'; }).join('') + '</w:tblBorders>';
    return '<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/>' + b + '<w:tblLayout w:type="autofit"/><w:tblCellMar><w:left w:w="60" w:type="dxa"/><w:right w:w="60" w:type="dxa"/></w:tblCellMar></w:tblPr>' + grid +
      rows.map(function(r, i){ return '<w:tr>' + (i === 0 && o.header ? '<w:trPr><w:tblHeader/></w:trPr>' : '<w:trPr><w:cantSplit/></w:trPr>') + r.map(function(c){ return cell(para(run(c.t, { b: c.b, sz: o.sz || 16, mono: c.mono, color: c.color }), { sp: 0, jc: c.jc }), { fill: c.fill, span: c.span }); }).join('') + '</w:tr>'; }).join('') + '</w:tbl>' + para('', { sp: 60 }); }
  function img(rid, id, wpx, hpx, maxCm){ var maxE = (maxCm || 16) * 360000, cx = wpx * 9525, cy = hpx * 9525; if (cx > maxE){ cy = Math.round(cy * maxE / cx); cx = maxE; } if (cy > 20 * 360000){ cx = Math.round(cx * 20 * 360000 / cy); cy = 20 * 360000; }
    return '<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="' + cx + '" cy="' + cy + '"/><wp:docPr id="' + id + '" name="Imagen ' + id + '"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="' + id + '" name="imagen' + id + '.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="' + rid + '"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + cx + '" cy="' + cy + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>'; }
  // ---------- SVG → PNG ----------
  var PROPS = ['fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'font-size', 'font-family', 'font-weight', 'opacity', 'fill-opacity', 'stroke-opacity', 'text-anchor'];
  function inlineSvg(svg){
    var clone = svg.cloneNode(true), src = svg.querySelectorAll('*'), dst = clone.querySelectorAll('*');
    if (svg.isConnected && window.getComputedStyle) for (var i = 0; i < src.length; i++){ var cs = getComputedStyle(src[i]), st = ''; PROPS.forEach(function(p){ var v = cs.getPropertyValue(p); if (v) st += p + ':' + v + ';'; }); dst[i].setAttribute('style', st); }
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    var s = new XMLSerializer().serializeToString(clone).replace(/currentColor/g, '#222').replace(/var\(--[a-z-]+,\s*([^)]+)\)/g, '$1').replace(/var\(--[a-z-]+\)/g, '#222');
    return s;
  }
  function svgPng(svgEl, scale){
    return new Promise(function(res){
      var vb = (svgEl.getAttribute('viewBox') || '0 0 400 300').split(/[\s,]+/).map(Number), w = vb[2] || 400, h = vb[3] || 300, k = scale || Math.max(1, 900 / w);
      var s = typeof svgEl === 'string' ? svgEl : inlineSvg(svgEl), blob = new Blob([s], { type: 'image/svg+xml' }), url = URL.createObjectURL(blob), im = new Image();
      im.onload = function(){ var c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k); var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(url); res({ data: c.toDataURL('image/png'), w: c.width, h: c.height }); };
      im.onerror = function(){ URL.revokeObjectURL(url); res(null); };
      im.src = url;
    });
  }
  function dataBytes(durl){ var b = atob(durl.split(',')[1]), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
  function pngSize(durl){ return new Promise(function(res){ var im = new Image(); im.onload = function(){ res({ w: im.naturalWidth, h: im.naturalHeight }); }; im.onerror = function(){ res({ w: 800, h: 600 }); }; im.src = durl; }); }

  // ---------- HTML de la memoria → cuerpo WordprocessingML ----------
  function fromMemoria(html, opts){
    opts = opts || {};
    var doc = new DOMParser().parseFromString('<div id="root">' + html + '</div>', 'text/html'), root = doc.getElementById('root');
    var media = [], jobs = [], body = [], imgId = 0;
    function addImage(promise, maxCm){ var k = ++imgId, ph = '@@IMG' + k + '@@'; jobs.push(promise.then(function(r){ if (!r) return ''; media.push({ name: 'image' + k + '.png', data: dataBytes(r.data) }); return para(img('rIdImg' + k, k, r.w, r.h, maxCm), { jc: 'center' }); }).then(function(s){ body.forEach(function(b, i){ if (b === ph) body[i] = s; }); })); return ph; }
    function textOf(el){ return (el.textContent || '').replace(/\s+/g, ' ').trim(); }
    function tableRows(t){
      var rows = []; t.querySelectorAll('tr').forEach(function(tr){ var r = []; tr.querySelectorAll('th,td').forEach(function(c){ var th = c.tagName === 'TH'; var cls = c.className || ''; r.push({ t: textOf(c), b: th, fill: th ? 'EEF2F7' : null, mono: /num/.test(cls), color: /koc/.test(cls) ? 'C93A39' : /okc/.test(cls) ? '1A8A55' : null, jc: /num/.test(cls) ? 'right' : null, span: +c.getAttribute('colspan') || 0 }); }); if (r.length) rows.push(r); });
      return rows; }
    function walk(el){
      el.childNodes.forEach(function(n){
        if (n.nodeType === 3){ var t = n.textContent.replace(/\s+/g, ' ').trim(); if (t) body.push(para(run(t))); return; }
        if (n.nodeType !== 1) return;
        var tag = n.tagName, cls = n.className && n.className.baseVal == null ? n.className : '';
        if (tag === 'H2') body.push(para(run(textOf(n)), { style: 'Heading1', keep: true }));
        else if (tag === 'H3') body.push(para(run(textOf(n)), { style: 'Heading2', keep: true }));
        else if (tag === 'TABLE'){ var rows = tableRows(n); if (rows.length) body.push(table(rows, { header: /steps/.test(cls) })); }
        else if (tag === 'UL' && /checks/.test(cls)){ n.querySelectorAll(':scope > li').forEach(function(li){ var c = li.className, sym = { ok: '✓', ko: '✕', warn: '!', info: 'i' }[c] || '·', col = { ok: '1A8A55', ko: 'C93A39', warn: 'B5590B', info: '6B7280' }[c];
            body.push(para(run(sym + '  ', { b: true, color: col }) + run(textOf(li), { color: c === 'ko' ? 'C93A39' : null }), { ind: 284, sp: 20 })); }); }
        else if (tag === 'UL' || tag === 'OL'){ if (/m-toc/.test(cls)){ body.push('<w:p><w:pPr><w:pStyle w:val="TOC1"/></w:pPr><w:r><w:fldChar w:fldCharType="begin" w:dirty="true"/></w:r><w:r><w:instrText xml:space="preserve"> TOC \\o "1-2" \\h \\z \\u </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>Índice: pulse F9 o acepte actualizar campos al abrir el documento.</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>'); return; }
          n.querySelectorAll(':scope > li').forEach(function(li, k){ body.push(para(run((tag === 'OL' ? (k + 1) + '. ' : '• ') + textOf(li)), { ind: 284, sp: 30 })); }); }
        else if (tag === 'svg') body.push(addImage(svgPng(n)));
        else if (tag === 'IMG' && /^data:image\/png/.test(n.getAttribute('src') || '')){ var src = n.getAttribute('src'); body.push(addImage(pngSize(src).then(function(sz){ return { data: src, w: sz.w, h: sz.h }; }))); }
        else if (tag === 'P' && n.getAttribute('data-fig')){ if (opts.img3d) body.push(addImage(pngSize(opts.img3d).then(function(sz){ return { data: opts.img3d, w: sz.w, h: sz.h }; }), 11)); if (opts.sketch) body.push(addImage(svgPng(opts.sketch, 2), 9)); }
        else if (/m-cover/.test(cls)) cover(n);
        else if (/^(DIV|SECTION|SPAN|P|B|SMALL|LABEL)$/.test(tag)){ if (n.querySelector('table,ul,ol,svg,img,h2,h3,div')) walk(n); else { var t2 = textOf(n); if (t2) body.push(para(run(t2, { b: tag === 'B', sz: /f-note/.test(cls) ? 16 : null, i: /f-note/.test(cls) }))); } }
        else walk(n);
      });
    }
    function cover(n){
      var t = n.querySelector('.m-t'), s = n.querySelector('.m-s');
      body.push(para('', { sp: 1200 }));
      body.push(para(run(t ? textOf(t) : 'Memoria de cálculo'), { style: 'Title', jc: 'center' }));
      if (s) body.push(para(run(textOf(s), { sz: 26 }), { jc: 'center', sp: 600 }));
      n.childNodes.forEach(function(c){ if (c.nodeType !== 1) return; if (c.tagName === 'TABLE') body.push(table(tableRows(c), { sz: 18 })); else if (/m-st/.test(c.className) && !/ndice/.test(textOf(c))) body.push(para(run(textOf(c), { b: true, sz: 20 }), { keep: true, sp: 60 })); else if (c.tagName === 'OL') { body.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>'); body.push(para(run('Índice', { b: true, sz: 28 }))); walk({ childNodes: [c] }); } });
    }
    walk(root);
    var p = opts.prj || { info: {} }, i = p.info || {}, lastRev = (p.fab && p.fab.revs && p.fab.revs.length) ? p.fab.revs[p.fab.revs.length - 1].rev : (i.rev || '0');
    return Promise.all(jobs).then(function(){
      var sect = '<w:sectPr><w:headerReference w:type="default" r:id="rIdHdr"/><w:footerReference w:type="default" r:id="rIdFtr"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1247" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/><w:titlePg/></w:sectPr>';
      var docXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ' + NS + '><w:body>' + body.join('') + sect + '</w:body></w:document>';
      var hdr = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr ' + NS + '>' + para(run('Memoria de cálculo · ' + (i.equipo || '') + ' · TAG ' + (i.tag || '') + ' · Rev. ' + lastRev, { sz: 16, color: '6B7280' }), { jc: 'right' }) + '</w:hdr>';
      var ftr = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr ' + NS + '><w:p><w:pPr><w:jc w:val="center"/></w:pPr>' + run('ASME BPVC VIII-1 · ' + (i.proyecto || '') + ' · página ', { sz: 16, color: '6B7280' }) +
        '<w:r><w:rPr><w:sz w:val="16"/></w:rPr><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:rPr><w:sz w:val="16"/></w:rPr><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:rPr><w:sz w:val="16"/></w:rPr><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:rPr><w:sz w:val="16"/></w:rPr><w:t>1</w:t></w:r><w:r><w:rPr><w:sz w:val="16"/></w:rPr><w:fldChar w:fldCharType="end"/></w:r>' +
        run(' de ', { sz: 16, color: '6B7280' }) + '<w:r><w:rPr><w:sz w:val="16"/></w:rPr><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:rPr><w:sz w:val="16"/></w:rPr><w:instrText xml:space="preserve"> NUMPAGES </w:instrText></w:r><w:r><w:rPr><w:sz w:val="16"/></w:rPr><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:rPr><w:sz w:val="16"/></w:rPr><w:t>1</w:t></w:r><w:r><w:rPr><w:sz w:val="16"/></w:rPr><w:fldChar w:fldCharType="end"/></w:r></w:p></w:ftr>';
      var styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
        '<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/><w:sz w:val="19"/><w:szCs w:val="19"/><w:lang w:val="es-ES"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="60" w:line="252" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
        '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>' +
        '<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="240"/></w:pPr><w:rPr><w:b/><w:sz w:val="44"/><w:color w:val="1F3B5C"/></w:rPr></w:style>' +
        '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:pageBreakBefore/><w:pBdr><w:bottom w:val="single" w:sz="8" w:space="2" w:color="1F3B5C"/></w:pBdr><w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="30"/><w:color w:val="1F3B5C"/></w:rPr></w:style>' +
        '<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="200" w:after="80"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="23"/><w:color w:val="2A5A8C"/></w:rPr></w:style>' +
        '<w:style w:type="paragraph" w:styleId="TOC1"><w:name w:val="toc 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:spacing w:after="40"/></w:pPr></w:style>' +
        '<w:style w:type="paragraph" w:styleId="TOC2"><w:name w:val="toc 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:ind w:left="284"/><w:spacing w:after="20"/></w:pPr></w:style>' +
        '<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style></w:styles>';
      var settings = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:updateFields w:val="true"/><w:defaultTabStop w:val="708"/><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>';
      var rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rIdSettings" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>' +
        '<Relationship Id="rIdHdr" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/><Relationship Id="rIdFtr" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>' +
        media.map(function(m){ return '<Relationship Id="rIdImg' + m.name.replace(/\D/g, '') + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/' + m.name + '"/>'; }).join('') + '</Relationships>';
      var ct = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/>' +
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>' +
        '<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>' +
        '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>';
      var root = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>';
      var now = new Date().toISOString().slice(0, 19) + 'Z';
      var core = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>' + x('Memoria de cálculo ' + (i.tag || '')) + '</dc:title><dc:creator>' + x(i.autor || '') + '</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">' + now + '</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">' + now + '</dcterms:modified></cp:coreProperties>';
      var app = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>ASME VIII-1 web</Application></Properties>';
      var files = [{ name: '[Content_Types].xml', data: utf8(ct) }, { name: '_rels/.rels', data: utf8(root) }, { name: 'word/document.xml', data: utf8(docXml) }, { name: 'word/styles.xml', data: utf8(styles) }, { name: 'word/settings.xml', data: utf8(settings) },
        { name: 'word/header1.xml', data: utf8(hdr) }, { name: 'word/footer1.xml', data: utf8(ftr) }, { name: 'word/_rels/document.xml.rels', data: utf8(rels) }, { name: 'docProps/core.xml', data: utf8(core) }, { name: 'docProps/app.xml', data: utf8(app) }]
        .concat(media.map(function(m){ return { name: 'word/media/' + m.name, data: m.data }; }));
      var blob = zip(files);
      if (opts.noDownload) return blob;
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = opts.file || 'memoria.docx'; document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      return blob;
    });
  }
  return { fromMemoria: fromMemoria, zip: zip, svgPng: svgPng };
})();

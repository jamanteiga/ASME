/* Plano de fabricación automático: alzado con cotas, vista de orientaciones, tablas de datos de diseño,
   conexiones y materiales, notas, revisiones y cajetín. Salida DXF (R12, por capas) y SVG. */
var PLANO = (function(){
  'use strict';
  var SHEETS = { A0: [1189, 841], A1: [841, 594], A2: [594, 420], A3: [420, 297] };
  var SCALES = [1, 2, 2.5, 5, 10, 15, 20, 25, 30, 40, 50, 75, 100, 150, 200];
  var LAYERS = { MARCO: 7, CAJETIN: 7, CONTORNO: 7, OCULTAS: 8, EJES: 1, COTAS: 3, TEXTOS: 7, TABLAS: 7, CONEXIONES: 5, SOLDADURAS: 30, SOPORTES: 6 };
  function f0(x){ return String(Math.round(x)); } function f1(x){ return (Math.round(x * 10) / 10).toString().replace('.', ','); } function f2(x){ return (Math.round(x * 100) / 100).toFixed(2).replace('.', ','); }
  function asc(s){ return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[·•]/g, '.').replace(/[≤]/g, '<=').replace(/[≥]/g, '>=').replace(/[°º]/g, '%%d').replace(/[ØΦ]/g, '%%c').replace(/[^\x20-\x7e%]/g, '?'); }

  function build(prj, res){
    var M = VMODEL, V = VESSEL, d = prj.design, fb = prj.fab || {}, sz = SHEETS[fb.sheet] || SHEETS.A1, W = sz[0], H = sz[1], E = [];
    function L(a, b, ly){ E.push({ t: 'L', a: a, b: b, ly: ly }); }
    function PL(pts, cl, ly){ E.push({ t: 'P', pts: pts, cl: !!cl, ly: ly }); }
    function C(c, r, ly){ E.push({ t: 'C', c: c, r: r, ly: ly }); }
    function T(p, h, s, ly, al){ E.push({ t: 'T', p: p, h: h, s: String(s), ly: ly || 'TEXTOS', al: al || 'l' }); }
    function rect(x, y, w, h, ly){ PL([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], true, ly); }
    var m = 10, ml = 20, small = W < 500, th = small ? 2.2 : 2.8, rowH = small ? 4.2 : 5;
    rect(ml, m, W - ml - m, H - 2 * m, 'MARCO'); rect(5, 5, W - 10, H - 10, 'MARCO');
    // -------- columna derecha: cajetín, revisiones, tablas --------
    var colW = small ? 170 : 250, cx = W - m - colW, y = m;
    // cajetín
    var cjH = small ? 44 : 56, i = prj.info, ds = fb.dossier || {}, revs = fb.revs || [], last = revs[revs.length - 1] || { rev: i.rev || '0', date: i.fecha };
    rect(cx, y, colW, cjH, 'CAJETIN');
    var r1 = cjH / 4;
    [1, 2, 3].forEach(function(k){ L([cx, y + k * r1], [cx + colW, y + k * r1], 'CAJETIN'); });
    L([cx + colW * 0.5, y], [cx + colW * 0.5, y + 2 * r1], 'CAJETIN'); L([cx + colW * 0.75, y], [cx + colW * 0.75, y + 2 * r1], 'CAJETIN'); L([cx + colW * 0.25, y], [cx + colW * 0.25, y + r1], 'CAJETIN');
    var sc0 = null; // se fija tras calcular la escala
    T([cx + 2, y + 3 * r1 + r1 * 0.35], th * 1.5, (ds.firm || prj.info.cliente || '').slice(0, 40), 'CAJETIN');
    T([cx + 2, y + 2 * r1 + r1 * 0.35], th * 1.25, ('Recipiente ' + (i.equipo || '') + ' · TAG ' + (i.tag || '')).slice(0, 55), 'CAJETIN');
    T([cx + 2, y + r1 + r1 * 0.55], th * 0.75, 'Plano n.', 'CAJETIN'); T([cx + 2, y + r1 + r1 * 0.12], th, fb.dwg || ds.doc || '—', 'CAJETIN');
    T([cx + colW * 0.5 + 2, y + r1 + r1 * 0.55], th * 0.75, 'Proyecto', 'CAJETIN'); T([cx + colW * 0.5 + 2, y + r1 + r1 * 0.12], th, (i.proyecto || '').slice(0, 18), 'CAJETIN');
    T([cx + colW * 0.75 + 2, y + r1 + r1 * 0.55], th * 0.75, 'Rev.', 'CAJETIN'); T([cx + colW * 0.75 + 2, y + r1 + r1 * 0.12], th * 1.3, last.rev, 'CAJETIN');
    T([cx + 2, y + r1 * 0.55], th * 0.75, 'Dibujado / revisado / aprobado', 'CAJETIN'); T([cx + 2, y + r1 * 0.12], th * 0.8, [i.autor, ds.chk, ds.app].map(function(x){ return x || '—'; }).join(' / ').slice(0, 30), 'CAJETIN');
    T([cx + colW * 0.5 + 2, y + r1 * 0.55], th * 0.75, 'Fecha', 'CAJETIN'); T([cx + colW * 0.5 + 2, y + r1 * 0.12], th, last.date || i.fecha || '', 'CAJETIN');
    T([cx + colW * 0.75 + 2, y + r1 * 0.55], th * 0.75, 'Escala / formato', 'CAJETIN'); var scTextIdx = E.length; T([cx + colW * 0.75 + 2, y + r1 * 0.12], th, '', 'CAJETIN');
    y += cjH;
    // tabla genérica
    function table(x0, yTop, cols, rows, title){ // cols: [[titulo, ancho]]
      var wT = cols.reduce(function(a, c){ return a + c[1]; }, 0), n = rows.length + 1 + (title ? 1 : 0), h = n * rowH, y0 = yTop - h;
      rect(x0, y0, wT, h, 'TABLAS');
      for (var k = 1; k < n; k++) L([x0, y0 + k * rowH], [x0 + wT, y0 + k * rowH], 'TABLAS');
      var yy = yTop;
      if (title){ T([x0 + 2, yy - rowH + rowH * 0.28], th, title, 'TABLAS'); yy -= rowH; }
      var xx = x0; cols.forEach(function(c, j){ if (j > 0) L([xx, y0], [xx, yy], 'TABLAS'); T([xx + 1.2, yy - rowH + rowH * 0.28], th * 0.85, c[0], 'TABLAS'); xx += c[1]; });
      rows.forEach(function(r, k2){ var x1 = x0, yr = yy - (k2 + 2) * rowH + rowH * 0.28; r.forEach(function(v, j){ var maxc = Math.floor(cols[j][1] / (th * 0.62)); T([x1 + 1.2, yr], th * 0.85, String(v == null ? '' : v).slice(0, maxc), 'TABLAS'); x1 += cols[j][1]; }); });
      return y0;
    }
    // revisiones (encima del cajetín)
    var revRows = revs.slice(-5).map(function(r){ return [r.rev, r.date, r.desc, r.by, r.chk, r.app]; });
    var cwR = [[ 'Rev', colW * 0.08 ], [ 'Fecha', colW * 0.17 ], [ 'Descripcion', colW * 0.39 ], [ 'Dib.', colW * 0.12 ], [ 'Rev.', colW * 0.12 ], [ 'Apr.', colW * 0.12 ]];
    var yRevTop = y + (revRows.length + 1) * rowH; table(cx, yRevTop, cwR, revRows); y = yRevTop + 3;
    // datos de diseño (arriba a la derecha)
    var F2 = res.fab || {}, ped = F2.ped, mw = res.mawp ? res.mawp.v : d.P;
    function matOf(type){ var c = prj.comps.filter(function(x){ return x.type === type; })[0]; var mm = c && V.BYID[c.mat.id]; return mm ? mm.t : '—'; }
    var nzM = prj.nozzles[0] && V.BYID[prj.nozzles[0].mat.id], flM = prj.nozzles.filter(function(n){ return n.fl && n.fl.type !== 'none'; })[0];
    var drows = [['Codigo de diseno', 'ASME BPVC VIII-1 2017' + (ped && /^(I|II|III|IV)$/.test(ped.cat) ? ' + PED 2014/68/UE' : '')],
      ['Presion de diseno / MAWP', f2(d.P) + ' / ' + f2(mw) + ' MPa'], ['Temperatura de diseno', f0(d.T) + ' %%dC'], ['Presion exterior', d.Pext > 0 ? f2(d.Pext) + ' MPa' + (res.maep ? ' (MAEP ' + f2(res.maep.v) + ')' : '') : 'no'],
      ['MDMT', f0(d.MDMT) + ' %%dC a ' + f2(mw) + ' MPa'], ['Prueba hidrostatica', f2(ped && ped.PT ? ped.PT : res.test.PT) + ' MPa (parte superior)'],
      ['Sobreespesor de corrosion', f1(d.c) + ' mm'], ['Radiografia / junta', d.rt + ' / tipo ' + d.jt], ['TTPS', d.pwht ? 'si' : 'no'],
      ['Fluido / densidad', (d.fluid || '') + ' / ' + f0(d.rho) + ' kg/m3'], ['Volumen', f0(res.mass.vol * 1000) + ' L'],
      ['Masa vacio / servicio / prueba', [res.loads && res.loads.mass ? res.loads.mass.empty : res.mass.empty, res.loads && res.loads.mass ? res.loads.mass.oper : res.mass.oper, res.loads && res.loads.mass ? res.loads.mass.test : res.mass.test].map(f0).join(' / ') + ' kg'],
      ped ? ['PED categoria / modulo', (ped.cat === 'SEP' ? 'art. 4(3)' : ped.cat) + ' / ' + (FAB.MODS[ped.cat] || '').split(' · ')[0]] : null,
      ['Viento / sismo', (prj.loads.windOn ? (prj.loads.code === 'EN' ? 'EN 1991-1-4' : 'ASCE 7-16') : 'no') + ' / ' + (prj.loads.seisOn ? (prj.loads.code === 'EN' ? 'EN 1998-1' : 'ASCE 7-16') : 'no')],
      ['Material virolas', matOf('shell')], ['Material fondos', matOf('ellip') !== '—' ? matOf('ellip') : matOf('tori') !== '—' ? matOf('tori') : matOf('hemi')],
      ['Material conexiones / bridas', (nzM ? nzM.t : '—') + ' / ' + (flM && V.BYID[flM.fl.mat.id] ? V.BYID[flM.fl.mat.id].t : '—')]].filter(Boolean);
    var yTop = H - m - 2, yDat = table(cx, yTop, [['Datos de diseno', colW * 0.45], ['', colW * 0.55]], drows);
    // tabla de conexiones
    var Lr = res.L, sH = d.orient === 'H';
    var nzRows = prj.nozzles.map(function(n){ var host = prj.comps.filter(function(c){ return c.id === n.host; })[0], p = host ? Lr.pos[host.id] : null, el = '';
      if (host && p){ if (/ellip|tori|hemi|flat/.test(host.type)){ var hz = M.headNoz(host, p, n); el = 'r=' + f0(n.rad || 0); } else el = (sH ? 'X=' : 'Z=') + f0(p.s0 + (+n.a || 0)); }
      return [n.mark, n.kind === 'cpl' ? n.cnps : n.nps || f0(n.od), n.kind === 'cpl' ? n.ccls + ' ' + n.cend : n.fl.type !== 'none' ? n.fl.type + ' ' + n.fl.cls + ' RF' : 'sin brida', f1(n.tn), (n.service || '').slice(0, 14), el, f0(n.theta || 0), f0(n.proj || 0)]; });
    var cwN = [['Marca', colW * 0.09], ['NPS', colW * 0.09], ['Brida', colW * 0.17], ['t', colW * 0.08], ['Servicio', colW * 0.22], ['Posicion', colW * 0.14], ['Orient.', colW * 0.1], ['Saliente', colW * 0.11]];
    var yNz = table(cx, yDat - 3, cwN, nzRows, 'Tabla de conexiones');
    // lista de materiales resumida
    var doc = res.doc || {}, bomRows = (doc.bom ? doc.bom.items : []).filter(function(x){ return x.grp !== 'Tornillería y juntas'; });
    var space = Math.floor((yNz - 3 - y - rowH * 2) / rowH);
    if (bomRows.length && space > 2){ var shown = bomRows.slice(0, Math.max(0, space)); table(cx, yNz - 3, [['Pos', colW * 0.07], ['Descripcion', colW * 0.47], ['Material', colW * 0.25], ['Cant', colW * 0.08], ['kg', colW * 0.13]],
      shown.map(function(x){ return [x.pos, x.desc, x.mat, x.qty, x.mass ? f0(x.mass * (x.qty > 1 && x.form !== 'Perno' ? x.qty : 1)) : '']; }), 'Lista de materiales' + (shown.length < bomRows.length ? ' (extracto; ver dossier)' : '')); }
    // -------- vistas --------
    var vx0 = ml + 8, vx1 = cx - 8, vy0 = m + 8, vy1 = H - m - 8, vw = vx1 - vx0, vh = vy1 - vy0;
    // geometría del alzado en coordenadas modelo (u: transversal/axial, v)
    var geo = { lines: [], hid: [], nz: [], sup: [], dims: [] }, e = sH ? (d.hdir === 'L' ? -1 : 1) : 1;
    function P2(s, r){ return sH ? [s * e, r] : [r, s]; }
    function addPoly(pts, hidden, ly){ (hidden ? geo.hid : geo.lines).push({ pts: pts, ly: ly || 'CONTORNO' }); }
    var rmax = 0;
    prj.comps.forEach(function(c){
      var p = Lr.pos[c.id];
      if (c.type === 'shell' || c.type === 'cone'){
        var ri0 = M.innerR(c, p, p.s0), ri1 = M.innerR(c, p, p.s1), t2 = c.type === 'cone' ? c.tn / Math.cos(c.alpha * Math.PI / 180) : c.tn;
        [1, -1].forEach(function(sg){ addPoly([P2(p.s0, sg * (ri0 + t2)), P2(p.s1, sg * (ri1 + t2))]); addPoly([P2(p.s0, sg * ri0), P2(p.s1, sg * ri1)], true); });
        rmax = Math.max(rmax, ri0 + t2, ri1 + t2);
        if (c.type === 'shell' && +c.rn > 0) for (var q = 1; q <= +c.rn; q++){ var sr = p.s0 + q * (p.s1 - p.s0) / (+c.rn + 1), hb = (+c.rb || 10) / 2, ro = ri0 + c.tn + (c.rside === 'int' ? 0 : (+c.rh || 0)); [1, -1].forEach(function(sg){ addPoly([P2(sr - hb, sg * (ri0 + c.tn)), P2(sr - hb, sg * ro), P2(sr + hb, sg * ro), P2(sr + hb, sg * (ri0 + c.tn))]); }); }
      } else if (/ellip|tori|hemi/.test(c.type)){
        var oc = Object.assign({}, c, { D: c.D + 2 * c.tn }); if (c.type === 'ellip') oc.ratio = (c.D + 2 * c.tn) / (2 * (M.headDepth(c) + c.tn)); if (c.type === 'tori'){ oc.Lc = M.toriL(c) + c.tn; oc.rk = M.toriR(c) + c.tn; }
        [[oc, false], [c, true]].forEach(function(q2){ var pr = M.headProfile(q2[0]).map(function(x){ return [p.side === 'start' ? p.s1 - x[0] : p.s0 + x[0], x[1]]; });
          var pts = pr.map(function(x){ return P2(x[0], x[1]); }), pts2 = pr.slice().reverse().map(function(x){ return P2(x[0], -x[1]); }); addPoly(pts.concat(pts2), q2[1]); });
        rmax = Math.max(rmax, c.D / 2 + c.tn);
      } else if (c.type === 'flat'){ var rf = (c.d || 0) / 2 + Math.max(c.tn * 0.4, 15); addPoly([P2(p.s0, -rf), P2(p.s0, rf), P2(p.s1, rf), P2(p.s1, -rf), P2(p.s0, -rf)]); rmax = Math.max(rmax, rf); }
      else if (c.type === 'bflange'){ var t0 = p.side === 'start' ? p.s0 : p.s1 - c.t; [1, -1].forEach(function(sg){ addPoly([P2(t0, sg * c.B / 2), P2(t0, sg * c.A / 2), P2(t0 + c.t, sg * c.A / 2), P2(t0 + c.t, sg * c.B / 2)]); }); rmax = Math.max(rmax, c.A / 2); }
      // línea de soldadura circunferencial
    });
    for (var k = 0; k < prj.comps.length - 1; k++){ var a = prj.comps[k], pa = Lr.pos[a.id], sj = pa.s1; geo.lines.push({ pts: [P2(sj, -rmax * 1.02), P2(sj, rmax * 1.02)], ly: 'SOLDADURAS' }); }
    // virolas parciales y longitudinales (proyectadas; trazo oculto si quedan detrás)
    prj.comps.forEach(function(c){ if (!/shell|cone/.test(c.type)) return; var cs = M.courses(prj, c), p = Lr.pos[c.id];
      cs.list.forEach(function(cr, k){ var z0 = p.s0 + cr.z0, z1 = p.s0 + cr.z1, R0 = M.innerR(c, p, z0) + c.tn, R1 = M.innerR(c, p, z1) + c.tn;
        if (k > 0) geo.lines.push({ pts: [P2(z0, -R0), P2(z0, R0)], ly: 'SOLDADURAS' });
        cr.ang.forEach(function(an){ var ar = an * Math.PI / 180, front = sH ? Math.cos(ar) >= 0 : Math.sin(ar) <= 0, f2 = sH ? Math.sin(ar) : Math.cos(ar);
          (front ? geo.lines : geo.hid).push({ pts: [P2(z0, R0 * f2), P2(z1, R1 * f2)], ly: 'SOLDADURAS' }); }); }); });
    // conexiones abatidas al plano del alzado
    prj.nozzles.forEach(function(n){
      var host = prj.comps.filter(function(c){ return c.id === n.host; })[0]; if (!host) return;
      var p = Lr.pos[host.id], th2 = ((+n.theta || 0) % 360 + 360) % 360, sg = sH ? (Math.sin(th2 * Math.PI / 180) >= -1e-9 ? 1 : -1) : (Math.cos(th2 * Math.PI / 180) >= -1e-9 ? 1 : -1);
      var s0, r0, ds, dr, L0;
      if (/ellip|tori|hemi|flat/.test(host.type)){ var hz = M.headNoz(host, p, n); var al = Math.hypot(hz.ds, hz.dr) || 1; ds = hz.ds / al; dr = hz.dr / al; s0 = hz.s; r0 = hz.r; L0 = hz.L0; }
      else { s0 = p.s0 + (+n.a || 0); r0 = (M.innerR(host, p, s0) || host.D / 2) - (n.hin || 0); ds = 0; dr = 1; L0 = host.tn + (n.hin || 0) + n.proj; }
      var fl = n.kind !== 'cpl' && n.fl && n.fl.type !== 'none' ? V.b165dims(n.fl.cls, n.nps) : null, tf = fl ? fl.tf : 0, O = fl ? fl.O : 0, od = n.od;
      function Q(alg, tr){ return P2(s0 + ds * alg + (-dr) * tr, sg * (r0 + dr * alg + ds * tr)); }
      geo.nz.push({ pts: [Q(0, -od / 2), Q(L0 - tf, -od / 2), Q(L0 - tf, od / 2), Q(0, od / 2)], cl: true, ly: 'CONEXIONES' });
      if (fl) geo.nz.push({ pts: [Q(L0 - tf, -O / 2), Q(L0, -O / 2), Q(L0, O / 2), Q(L0 - tf, O / 2)], cl: true, ly: 'CONEXIONES' });
      if (n.pad && n.Dp > od) geo.nz.push({ pts: [Q(L0 - n.proj, -n.Dp / 2), Q(L0 - n.proj + (n.te || 6), -n.Dp / 2), Q(L0 - n.proj + (n.te || 6), n.Dp / 2), Q(L0 - n.proj, n.Dp / 2)], cl: true, ly: 'CONEXIONES' });
      geo.nz.push({ axis: [Q(-20, 0), Q(L0 + 25, 0)] });
      geo.nz.push({ mark: n.mark, at: Q(L0 + 25 + 8, 0), ref: Q(L0, 0) });
      if (!/ellip|tori|hemi|flat/.test(host.type)) geo.dims.push({ s: s0, mark: n.mark, side: sg });
      rmax = Math.max(rmax, Math.abs(r0) + L0 + 40);
    });
    // soportes
    var LD = res.loads, sp = prj.support || {};
    if (LD && !LD.err){
      if (!sH && LD.skirt){ var Ds = LD.skirt.Ds, tk = +sp.t || 10; [1, -1].forEach(function(sg){ geo.sup.push([P2(LD.zg, sg * Ds / 2), P2(LD.sAtt, sg * Ds / 2)]); geo.sup.push([P2(LD.zg, sg * (Ds / 2 - tk)), P2(LD.sAtt, sg * (Ds / 2 - tk))]); });
        geo.sup.push([P2(LD.zg, -LD.skirt.Dbo / 2), P2(LD.zg, LD.skirt.Dbo / 2), P2(LD.zg + (+sp.tb || 20), LD.skirt.Dbo / 2), P2(LD.zg + (+sp.tb || 20), -LD.skirt.Dbo / 2), P2(LD.zg, -LD.skirt.Dbo / 2)]); geo.ground = LD.zg; }
      if (!sH && LD.legs){ var bl = (LD.legs.LG && LD.legs.LG.b) || (sp.lsec === 'user' ? (+sp.lb || 100) : (+sp.lod || 168)), th0 = sp.th0 != null && sp.th0 !== '' ? +sp.th0 : 45; for (var jl = 0; jl < LD.legs.n; jl++){ var xl = LD.legs.Dl / 2 * Math.cos((th0 + 360 * jl / LD.legs.n) * Math.PI / 180); geo.sup.push([P2(LD.zg, xl - bl / 2), P2(LD.legs.top || LD.sAtt + 300, xl - bl / 2), P2(LD.legs.top || LD.sAtt + 300, xl + bl / 2), P2(LD.zg, xl + bl / 2), P2(LD.zg, xl - bl / 2)]); var pdp = LD.legs.pad; if (pdp){ var z0p = pdp.z0 || LD.sAtt, z1p = z0p + pdp.L; geo.sup.push([P2(z0p, xl - pdp.w / 2 * Math.abs(Math.sin((th0 + 360 * jl / LD.legs.n) * Math.PI / 180)) - 1), P2(z1p, xl - pdp.w / 2 * Math.abs(Math.sin((th0 + 360 * jl / LD.legs.n) * Math.PI / 180)) - 1)]); geo.sup.push([P2(z0p, xl - bl / 2 - 20), P2(z0p, xl + bl / 2 + 20)]); geo.sup.push([P2(z1p, xl - bl / 2 - 20), P2(z1p, xl + bl / 2 + 20)]); } } geo.ground = LD.zg; geo.legs = { n: LD.legs.n, th0: th0, Dl: LD.legs.Dl, b: bl }; }
      if (!sH && LD.lugs && LD.lugs.geo){ var Gp = LD.lugs.geo, shp = prj.comps.filter(function(c){ return c.type === 'shell'; })[0], Rp = shp ? (shp.basis === 'od' ? shp.D / 2 : shp.D / 2 + shp.tn) : 800;
        for (var jm = 0; jm < Gp.n; jm++){ var cm = Math.cos((Gp.th0 + 360 * jm / Gp.n) * Math.PI / 180); if (Math.abs(cm) < 0.2) continue; var sg = cm > 0 ? 1 : -1, x0 = sg * (Rp + Gp.pt), x1 = sg * (Rp + Gp.pt + Gp.L);
          geo.sup.push([P2(LD.sB, x0), P2(LD.sB, x1), P2(LD.sB + Gp.H, x1), P2(LD.sB + Gp.H, x0), P2(LD.sB, x0)]); geo.sup.push([P2(LD.sB - 50, sg * Rp), P2(LD.sB - 50, sg * (Rp + Gp.pt)), P2(LD.sB + Gp.ph - 50, sg * (Rp + Gp.pt)), P2(LD.sB + Gp.ph - 50, sg * Rp)]); }
        geo.legs = { lbl: 'M', n: Gp.n, th0: Gp.th0, Dl: 2 * (Rp + Gp.pt + Gp.L / 2), b: Gp.S + 2 * Gp.t }; geo.dims.push({ s: LD.sB, mark: 'apoyo', side: -1 }); }
      if (sH && sp.type === 'saddle' && LD.saddle){ var body = prj.comps.filter(function(c){ return !/ellip|tori|hemi|flat/.test(c.type); }), sT0 = Math.min.apply(null, body.map(function(c){ return Lr.pos[c.id].s0; })), sT1 = Math.max.apply(null, body.map(function(c){ return Lr.pos[c.id].s1; }));
        var Ro = Math.max.apply(null, body.map(function(c){ return (c.D || 0) / 2 + c.tn; })), hA = LD.saddle.hAx, bS = +sp.b || 200;
        [sT0 + (+sp.A || 0), sT1 - (+sp.A || 0)].forEach(function(s1){ var twq = +sp.twp || 0, b1q = sp.bwp > 0 ? +sp.bwp : bS + 1.56 * Math.sqrt(Ro * (body[0].tn || 10)); if (twq > 0) geo.sup.push([P2(s1 - b1q / 2, -Ro), P2(s1 - b1q / 2, -Ro - twq), P2(s1 + b1q / 2, -Ro - twq), P2(s1 + b1q / 2, -Ro), P2(s1 - b1q / 2, -Ro)]); geo.sup.push([P2(s1 - bS / 2, -Ro - twq), P2(s1 - bS / 2, -hA), P2(s1 + bS / 2, -hA), P2(s1 + bS / 2, -Ro - twq)]); geo.dims.push({ s: s1, mark: 'cuna', side: -1 }); }); geo.ground = -hA; }
    }
    // extensión del modelo
    var all = []; geo.lines.concat(geo.hid).forEach(function(g){ all = all.concat(g.pts); }); geo.nz.forEach(function(g){ if (g.pts) all = all.concat(g.pts); }); geo.sup.forEach(function(g){ all = all.concat(g); });
    var umin = Math.min.apply(null, all.map(function(q){ return q[0]; })), umax = Math.max.apply(null, all.map(function(q){ return q[0]; })), vmin = Math.min.apply(null, all.map(function(q){ return q[1]; })), vmax = Math.max.apply(null, all.map(function(q){ return q[1]; }));
    var elevW = vw * (sH ? 1 : 0.62), elevH = vh * (sH ? 0.6 : 1), pad = 40;
    var need = Math.max((umax - umin) / (elevW - pad), (vmax - vmin) / (elevH - pad)), sc = SCALES.filter(function(s2){ return s2 >= need; })[0] || Math.ceil(need);
    E[scTextIdx].s = '1:' + String(sc).replace('.', ',') + ' / ' + (fb.sheet || 'A1');
    var ox = vx0 + (elevW - (umax - umin) / sc) / 2 - umin / sc, oy = (sH ? vy1 - elevH : vy0) + (elevH - (vmax - vmin) / sc) / 2 - vmin / sc;
    function S(q){ return [ox + q[0] / sc, oy + q[1] / sc]; }
    geo.lines.forEach(function(g){ PL(g.pts.map(S), false, g.ly); });
    geo.hid.forEach(function(g){ PL(g.pts.map(S), false, 'OCULTAS'); });
    geo.sup.forEach(function(g){ PL(g.map(S), false, 'SOPORTES'); });
    geo.nz.forEach(function(g){ if (g.pts) PL(g.pts.map(S), g.cl, g.ly); else if (g.axis) PL(g.axis.map(S), false, 'EJES'); else if (g.mark){ var c2 = S(g.at); C(c2, th * 1.3, 'CONEXIONES'); T([c2[0], c2[1] - th * 0.45], th, g.mark, 'CONEXIONES', 'c'); } });
    // eje del recipiente
    PL([S(P2(Lr.smin - 60, 0)), S(P2(Lr.smax + 60, 0))], false, 'EJES');
    if (geo.ground != null){ if (sH){ var gA = S([umin, geo.ground]), gB = S([umax, geo.ground]); L([gA[0] - 15, gA[1]], [gB[0] + 15, gB[1]], 'SOPORTES'); } else { var g1 = S(P2(geo.ground, -rmax)), g2 = S(P2(geo.ground, rmax)); L([g1[0] - 15, g1[1]], [g2[0] + 15, g2[1]], 'SOPORTES'); } }
    // cotas
    function dim(a, b, off, txt, vertical){ // a, b en coordenadas de hoja; off: desplazamiento perpendicular
      var A = vertical ? [a[0] + off, a[1]] : [a[0], a[1] + off], B = vertical ? [a[0] + off, b[1]] : [b[0], a[1] + off];
      L(a, A, 'COTAS'); L(b, vertical ? [a[0] + off, b[1]] : [b[0], a[1] + off], 'COTAS'); L(A, B, 'COTAS');
      var tk = th * 0.6; [A, B].forEach(function(q){ L([q[0] - tk, q[1] - tk], [q[0] + tk, q[1] + tk], 'COTAS'); });
      var mid = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2]; T(vertical ? [mid[0] - 1.5, mid[1]] : [mid[0], mid[1] + 1.2], th * 0.9, txt, 'COTAS', vertical ? 'r' : 'c');
    }
    var lo = Lr.smin, hi = Lr.smax;
    var tl = prj.comps.filter(function(c){ return /shell|cone|bflange/.test(c.type); }), t0 = tl.length ? Math.min.apply(null, tl.map(function(c){ return Lr.pos[c.id].s0; })) : lo, t1 = tl.length ? Math.max.apply(null, tl.map(function(c){ return Lr.pos[c.id].s1; })) : hi;
    var base = geo.ground != null ? geo.ground : lo;
    if (!sH){
      var xr = S([umax, 0])[0] + 6;
      dim(S(P2(t0, umax)), S(P2(t1, umax)), xr - S(P2(t0, umax))[0] + 10, 'TL-TL ' + f0(t1 - t0), true);
      dim(S(P2(base, umax)), S(P2(hi, umax)), xr - S(P2(base, umax))[0] + 22, 'Total ' + f0(hi - base), true);
      var xl = S([umin, 0])[0] - 8, used = [];
      geo.dims.forEach(function(q){ var yq = S(P2(q.s, 0))[1]; if (used.some(function(u){ return Math.abs(u - yq) < th * 1.6; })) return; used.push(yq); var xA = S(P2(q.s, -rmax))[0]; L([xA, yq], [xl - 4, yq], 'COTAS'); T([xl - 6, yq - th * 0.45], th * 0.85, q.mark + ' ' + f0(q.s - base), 'COTAS', 'r'); });
      L([xl - 4, S(P2(base, 0))[1]], [xl + 4, S(P2(base, 0))[1]], 'COTAS'); T([xl - 6, S(P2(base, 0))[1] - th * 0.45], th * 0.85, 'Ref. 0', 'COTAS', 'r');
    } else {
      var yb = S([0, vmin])[1] - 6;
      dim(S(P2(t0, vmin)), S(P2(t1, vmin)), yb - S(P2(t0, vmin))[1] - 8, 'TL-TL ' + f0(t1 - t0), false);
      dim(S(P2(lo, vmin)), S(P2(hi, vmin)), yb - S(P2(lo, vmin))[1] - 20, 'Total ' + f0(hi - lo), false);
      var yt = S([0, vmax])[1] + 6, used2 = [];
      geo.dims.forEach(function(q){ var xq = S(P2(q.s, 0))[0]; if (used2.some(function(u){ return Math.abs(u - xq) < th * 2.4; })) return; used2.push(xq); L([xq, S(P2(q.s, rmax))[1]], [xq, yt + 3], 'COTAS'); T([xq, yt + 4], th * 0.85, q.mark + ' ' + f0(q.s - t0), 'COTAS', 'c'); });
    }
    // diámetro
    var sh0 = prj.comps.filter(function(c){ return c.type === 'shell'; })[0];
    if (sh0){ var psh = Lr.pos[sh0.id], smid = psh.s0 + 0.3 * (psh.s1 - psh.s0), Di = sh0.basis === 'od' ? sh0.D - 2 * sh0.tn : sh0.D;
      var a1 = S(P2(smid, -Di / 2)), b1 = S(P2(smid, Di / 2)); L(a1, b1, 'COTAS'); T(sH ? [a1[0] + 1.5, (a1[1] + b1[1]) / 2] : [(a1[0] + b1[0]) / 2, a1[1] + 1.2], th, '%%c' + 'DI ' + f0(Di) + ' x ' + f1(sh0.tn), 'COTAS', sH ? 'l' : 'c'); }
    T([vx0 + 2, (sH ? vy1 - elevH : vy0) + 3], th * 1.2, 'ALZADO  E 1:' + String(sc).replace('.', ',') + '  (conexiones abatidas al plano del dibujo)', 'TEXTOS');
    // -------- vista de orientaciones --------
    var pr0 = sh0 ? (sh0.basis === 'od' ? sh0.D / 2 : sh0.D / 2 + sh0.tn) : rmax, pW = sH ? vw * 0.4 : vw * 0.36, pH = sH ? vh * 0.36 : vh * 0.42;
    var pcx = sH ? vx0 + pW / 2 + 10 : vx0 + elevW + pW / 2 + 4, pcy = sH ? vy0 + pH / 2 + 10 : vy1 - pH / 2 - 6;
    var maxL = Math.max.apply(null, [pr0].concat(prj.nozzles.map(function(n){ var host = prj.comps.filter(function(c){ return c.id === n.host; })[0]; return host && host.type === 'shell' ? pr0 + (n.proj || 0) + 30 : pr0 * 0.9; })));
    if (geo.legs) maxL = Math.max(maxL, geo.legs.Dl / 2 + geo.legs.b + 40);
    var psc = SCALES.filter(function(s2){ return s2 >= 2 * maxL / (Math.min(pW, pH) - 24); })[0] || 200;
    C([pcx, pcy], pr0 / psc, 'CONTORNO'); if (sh0) C([pcx, pcy], (pr0 - sh0.tn) / psc, 'OCULTAS');
    L([pcx - maxL / psc - 6, pcy], [pcx + maxL / psc + 6, pcy], 'EJES'); L([pcx, pcy - maxL / psc - 6], [pcx, pcy + maxL / psc + 6], 'EJES');
    [[0, '0%%d'], [90, '90%%d'], [180, '180%%d'], [270, '270%%d']].forEach(function(q){ var a2 = q[0] * Math.PI / 180, rr = maxL / psc + 9; T([pcx + rr * Math.cos(a2), pcy + rr * Math.sin(a2) - th * 0.45], th, q[1], 'TEXTOS', 'c'); });
    prj.nozzles.forEach(function(n){ var host = prj.comps.filter(function(c){ return c.id === n.host; })[0]; if (!host) return; var a3 = (+n.theta || 0) * Math.PI / 180, isH = /ellip|tori|hemi|flat/.test(host.type);
      var r0 = isH ? (+n.rad || 0) : pr0, r1 = isH ? r0 : pr0 + (n.proj || 0), u = [Math.cos(a3), Math.sin(a3)], w = [-u[1], u[0]], hw = n.od / 2;
      if (isH){ C([pcx + r0 * u[0] / psc, pcy + r0 * u[1] / psc], hw / psc, 'CONEXIONES'); }
      else PL([[pcx + (r0 * u[0] - hw * w[0]) / psc, pcy + (r0 * u[1] - hw * w[1]) / psc], [pcx + (r1 * u[0] - hw * w[0]) / psc, pcy + (r1 * u[1] - hw * w[1]) / psc], [pcx + (r1 * u[0] + hw * w[0]) / psc, pcy + (r1 * u[1] + hw * w[1]) / psc], [pcx + (r0 * u[0] + hw * w[0]) / psc, pcy + (r0 * u[1] + hw * w[1]) / psc]], false, 'CONEXIONES');
      var rm = (isH ? r0 : r1) / psc + th * 2.2; C([pcx + rm * u[0], pcy + rm * u[1]], th * 1.2, 'CONEXIONES'); T([pcx + rm * u[0], pcy + rm * u[1] - th * 0.45], th * 0.9, n.mark, 'CONEXIONES', 'c');
      L([pcx, pcy], [pcx + (isH ? r0 : pr0) * u[0] / psc, pcy + (isH ? r0 : pr0) * u[1] / psc], 'EJES'); });
    if (geo.legs) for (var jg = 0; jg < geo.legs.n; jg++){ var ag = (geo.legs.th0 + 360 * jg / geo.legs.n) * Math.PI / 180, rg = geo.legs.Dl / 2 / psc; C([pcx + rg * Math.cos(ag), pcy + rg * Math.sin(ag)], geo.legs.b / 2 / psc, 'SOPORTES'); T([pcx + (rg + geo.legs.b / psc + th) * Math.cos(ag), pcy + (rg + geo.legs.b / psc + th) * Math.sin(ag) - th * 0.4], th * 0.75, (geo.legs.lbl || 'P') + (jg + 1) + ' ' + Math.round((geo.legs.th0 + 360 * jg / geo.legs.n) % 360) + '%%d', 'SOPORTES', 'c'); }
    prj.comps.forEach(function(c){ if (c.type !== 'shell' && c.type !== 'cone') return; var cs = M.courses(prj, c), r2 = pr0 / psc;
      cs.list.forEach(function(cr, k){ cr.ang.forEach(function(an){ var a4 = an * Math.PI / 180; L([pcx + r2 * 0.82 * Math.cos(a4), pcy + r2 * 0.82 * Math.sin(a4)], [pcx + r2 * 1.06 * Math.cos(a4), pcy + r2 * 1.06 * Math.sin(a4)], 'SOLDADURAS');
        T([pcx + r2 * 0.68 * Math.cos(a4), pcy + r2 * 0.68 * Math.sin(a4) - th * 0.4], th * 0.65, 'L ' + c.name.slice(0, 8) + (cs.nC > 1 ? '/' + (k + 1) : '') + ' ' + Math.round(an) + '%%d', 'SOLDADURAS', 'c'); }); }); });
    T([pcx - pW / 2 + 2, pcy - pH / 2 + 2], th * 1.2, 'ORIENTACIONES ' + (sH ? '(vista segun el eje)' : '(planta)') + '  E 1:' + psc + '  0%%d = 3 h, 90%%d = 12 h, antihorario', 'TEXTOS');
    // -------- notas --------
    var notes = ['Dimensiones en mm. Cotas de conexiones desde la referencia 0 (' + (sH ? 'linea de tangencia izquierda' : geo.ground != null ? 'base del soporte' : 'extremo inferior') + ').',
      'Soldaduras segun mapa de soldaduras y WPS cualificadas (ASME IX). Examen ' + d.rt + '.',
      'Bridas ASME B16.5 cara con resalte (RF). Taladros de bridas a caballo de los ejes principales.',
      'Chapas de refuerzo con taladro testigo M10 roscado y prueba neumatica a 0,1 MPa.',
      'Prueba hidrostatica a ' + f2(ped && ped.PT ? ped.PT : res.test.PT) + ' MPa en la parte superior.' + (d.pwht ? ' TTPS antes de la prueba.' : ''),
      'Fondos: espesor minimo tras conformado igual al nominal indicado.'];
    var nx = sH ? vx0 + pW + 20 : vx0 + elevW + 4, ny = sH ? vy0 + pH : vy1 - pH - 14;
    T([nx, ny], th * 1.1, 'NOTAS', 'TEXTOS'); notes.forEach(function(t2, k2){ T([nx, ny - (k2 + 1) * th * 1.8], th * 0.85, (k2 + 1) + '. ' + t2, 'TEXTOS'); });
    return { W: W, H: H, ents: E, sc: sc, psc: psc };
  }

  function dxf(prj, res){
    var B = build(prj, res), body = [];
    function ly(n){ return n || '0'; }
    B.ents.forEach(function(e){
      if (e.t === 'L') body.push('0', 'LINE', '8', ly(e.ly), '10', e.a[0].toFixed(3), '20', e.a[1].toFixed(3), '30', '0', '11', e.b[0].toFixed(3), '21', e.b[1].toFixed(3), '31', '0');
      else if (e.t === 'P'){ body.push('0', 'POLYLINE', '8', ly(e.ly), '66', '1', '70', e.cl ? '1' : '0', '10', '0', '20', '0', '30', '0'); e.pts.forEach(function(q){ body.push('0', 'VERTEX', '8', ly(e.ly), '10', q[0].toFixed(3), '20', q[1].toFixed(3), '30', '0'); }); body.push('0', 'SEQEND', '8', ly(e.ly)); }
      else if (e.t === 'C') body.push('0', 'CIRCLE', '8', ly(e.ly), '10', e.c[0].toFixed(3), '20', e.c[1].toFixed(3), '30', '0', '40', e.r.toFixed(3));
      else if (e.t === 'T'){ var s = asc(e.s); if (!s) return; body.push('0', 'TEXT', '8', ly(e.ly), '10', e.p[0].toFixed(3), '20', e.p[1].toFixed(3), '30', '0', '40', e.h.toFixed(2), '1', s);
        if (e.al !== 'l') body.push('72', e.al === 'c' ? '1' : '2', '11', e.p[0].toFixed(3), '21', e.p[1].toFixed(3), '31', '0'); }
    });
    var head = ['0', 'SECTION', '2', 'HEADER', '9', '$ACADVER', '1', 'AC1009', '9', '$INSUNITS', '70', '4', '9', '$EXTMIN', '10', '0', '20', '0', '30', '0', '9', '$EXTMAX', '10', String(B.W), '20', String(B.H), '30', '0', '9', '$LIMMAX', '10', String(B.W), '20', String(B.H), '0', 'ENDSEC',
      '0', 'SECTION', '2', 'TABLES', '0', 'TABLE', '2', 'LTYPE', '70', '3',
      '0', 'LTYPE', '2', 'CONTINUOUS', '70', '0', '3', 'Solid line', '72', '65', '73', '0', '40', '0.0',
      '0', 'LTYPE', '2', 'DASHED', '70', '0', '3', '__ __ __', '72', '65', '73', '2', '40', '6.0', '49', '4.0', '49', '-2.0',
      '0', 'LTYPE', '2', 'CENTER', '70', '0', '3', '____ _ ____', '72', '65', '73', '4', '40', '16.0', '49', '10.0', '49', '-2.0', '49', '2.0', '49', '-2.0', '0', 'ENDTAB',
      '0', 'TABLE', '2', 'LAYER', '70', String(Object.keys(LAYERS).length)];
    Object.keys(LAYERS).forEach(function(l){ head.push('0', 'LAYER', '2', l, '70', '0', '62', String(LAYERS[l]), '6', l === 'OCULTAS' ? 'DASHED' : l === 'EJES' ? 'CENTER' : 'CONTINUOUS'); });
    head.push('0', 'ENDTAB', '0', 'ENDSEC', '0', 'SECTION', '2', 'ENTITIES');
    var nm = String(prj.info.tag || prj.info.equipo || 'Recipiente').replace(/[^\w.-]+/g, '_');
    return { text: head.concat(body, ['0', 'ENDSEC', '0', 'EOF']).join('\r\n'), file: nm + '_plano.dxf', n: B.ents.length };
  }
  function svg(prj, res, standalone){
    var B = build(prj, res), W = B.W, H = B.H, out = [];
    var COL = { OCULTAS: '#8a8f98', EJES: '#c93a39', COTAS: '#1a8a55', CONEXIONES: '#2a78d6', SOLDADURAS: '#b86b2c', SOPORTES: '#7a5cc0' };
    function Y(y){ return (H - y).toFixed(2); }
    function sty(ly){ var c = COL[ly] || (standalone ? '#111' : 'currentColor'); return 'stroke="' + c + '" stroke-width="' + (ly === 'CONTORNO' ? 0.45 : ly === 'MARCO' ? 0.6 : 0.22) + '"' + (ly === 'OCULTAS' ? ' stroke-dasharray="3 1.5"' : ly === 'EJES' ? ' stroke-dasharray="8 1.5 1.5 1.5"' : ''); }
    function txt(s){ return String(s).replace(/%%d/g, '°').replace(/%%c/g, 'Ø').replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
    B.ents.forEach(function(e){
      if (e.t === 'L') out.push('<line x1="' + e.a[0].toFixed(2) + '" y1="' + Y(e.a[1]) + '" x2="' + e.b[0].toFixed(2) + '" y2="' + Y(e.b[1]) + '" ' + sty(e.ly) + '/>');
      else if (e.t === 'P') out.push('<' + (e.cl ? 'polygon' : 'polyline') + ' points="' + e.pts.map(function(q){ return q[0].toFixed(2) + ',' + Y(q[1]); }).join(' ') + '" fill="none" ' + sty(e.ly) + '/>');
      else if (e.t === 'C') out.push('<circle cx="' + e.c[0].toFixed(2) + '" cy="' + Y(e.c[1]) + '" r="' + e.r.toFixed(2) + '" fill="none" ' + sty(e.ly) + '/>');
      else if (e.t === 'T') out.push('<text x="' + e.p[0].toFixed(2) + '" y="' + Y(e.p[1]) + '" font-size="' + (e.h * 1.25).toFixed(2) + '" text-anchor="' + (e.al === 'c' ? 'middle' : e.al === 'r' ? 'end' : 'start') + '" fill="' + (COL[e.ly] || (standalone ? '#111' : 'currentColor')) + '">' + txt(e.s) + '</text>');
    });
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '"' + (standalone ? ' width="' + W + 'mm" height="' + H + 'mm"' : ' style="width:100%;height:auto;background:var(--card,#fff)"') + ' font-family="IBM Plex Mono, monospace">' + (standalone ? '<rect width="100%" height="100%" fill="#fff"/>' : '') + out.join('') + '</svg>';
  }
  return { build: build, dxf: dxf, svg: svg, SHEETS: SHEETS };
})();
if (typeof module !== 'undefined') module.exports = PLANO;

/* Exportación del modelo 3D a Autodesk Inventor (.iam + .ipt) y SolidWorks (.sldasm + .sldprt)
   mediante macros nativas: regla iLogic (VB.NET) para Inventor y macro VBA para SolidWorks.
   Cada pieza se define en su propio sistema local (eje de revolución = Y local, croquis en el plano XY)
   y se coloca en el ensamblaje con su matriz de posición. Unidades internas: mm. */
var EXPORT3D = (function(){
  'use strict';
  var M = window.VMODEL, V = window.VESSEL;
  // ---------- vectores ----------
  function v(x, y, z){ return [x, y, z]; }
  function add(a, b){ return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function sc(a, k){ return [a[0] * k, a[1] * k, a[2] * k]; }
  function adds(a, b, k){ return [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k]; }
  function dot(a, b){ return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b){ return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function nrm(a){ var l = Math.sqrt(dot(a, a)) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
  function perp(a, ref){ var u = adds(ref, a, -dot(ref, a)); if (dot(u, u) < 1e-9){ ref = Math.abs(a[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]; u = adds(ref, a, -dot(ref, a)); } return nrm(u); }
  // sistema local: Y = eje dado, X = referencia perpendicular
  function frameY(o, y, xref){ y = nrm(y); var x = perp(y, xref || [1, 0, 0]), z = cross(x, y); return { o: o, x: x, y: y, z: z }; }
  function fracN(t){ return String(t || '').split(' ').reduce(function(a, p){ var q = p.split('/'); return a + (q.length > 1 ? +q[0] / +q[1] : +q[0] || 0); }, 0); }
  function safe(s){ return String(s || 'pieza').replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 60); }
  // perfiles: loops = [ [ {t:'L'|'S', p:[[x,y],...]} | {t:'C', c:[x,y], r} ] ]
  function poly(pts){ var segs = []; for (var k = 0; k < pts.length; k++){ var a = pts[k], b = pts[(k + 1) % pts.length]; if (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) > 1e-6) segs.push({ t: 'L', p: [a, b] }); } return segs; }
  function ring(r0, r1, y0, y1){ return poly([[r0, y0], [r1, y0], [r1, y1], [r0, y1]]); }

  // ---------- generación de piezas ----------
  function build(prj, res){
    var d = prj.design, H = d.orient === 'H', e = H ? v(d.hdir === 'L' ? -1 : 1, 0, 0) : v(0, 0, 1), Lr = res.L, parts = [], cnt = {};
    function rad(th){ th = th * Math.PI / 180; return H ? v(0, -Math.cos(th) * (d.hdir === 'L' ? -1 : 1), Math.sin(th)) : v(Math.cos(th), Math.sin(th), 0); }
    function P(s, rv, r){ return adds(sc(e, s), rv, r); }
    var VF = { o: [0, 0, 0], y: e, x: rad(0) }; VF.z = cross(VF.x, VF.y);
    function name(base){ cnt[base] = (cnt[base] || 0) + 1; return base + (cnt[base] > 1 ? ' ' + cnt[base] : ''); }
    var used = {};
    function part(nm, feats, xf, mat){ var b = safe(nm), u = b, k = 2; while (used[u.toLowerCase()]) u = b + ' (' + (k++) + ')'; used[u.toLowerCase()] = 1; parts.push({ name: u, feats: feats, xf: xf, mat: mat || '' }); }
    function matName(ref){ var m = ref && V.BYID[ref.id]; return m ? m.t : ''; }
    function headPts(c, p, outer){
      var oc = c;
      if (outer){ oc = Object.assign({}, c, { D: c.D + 2 * c.tn }); if (c.type === 'ellip') oc.ratio = (c.D + 2 * c.tn) / (2 * (M.headDepth(c) + c.tn)); if (c.type === 'tori'){ oc.Lc = M.toriL(c) + c.tn; oc.rk = M.toriR(c) + c.tn; } }
      return M.headProfile(oc).map(function(q){ return [q[1], p.side === 'start' ? p.s1 - q[0] : p.s0 + q[0]]; });
    }
    // envolvente
    prj.comps.forEach(function(c){
      var p = Lr.pos[c.id], f = [], nm = c.name || M.TYPES[c.type];
      if (c.type === 'shell'){ var ri = M.innerR(c, p, p.s0); f.push({ k: 'rev', loops: [ring(ri, ri + c.tn, p.s0, p.s1)] });
        if (+c.rn > 0) for (var q = 1; q <= +c.rn; q++){ var sr = p.s0 + q * (p.s1 - p.s0) / (+c.rn + 1), hb = (+c.rb || 10) / 2, r0 = c.rside === 'int' ? ri - (+c.rh || 0) : ri + c.tn, r1 = c.rside === 'int' ? ri : ri + c.tn + (+c.rh || 0);
          part(name('Anillo ' + nm), [{ k: 'rev', loops: [ring(r0, r1, sr - hb, sr + hb)] }], VF, matName(c.rmat)); } }
      else if (c.type === 'cone'){ var t2 = c.tn / Math.cos(c.alpha * Math.PI / 180), a0 = M.innerR(c, p, p.s0), a1 = M.innerR(c, p, p.s1); f.push({ k: 'rev', loops: [poly([[a0, p.s0], [a1, p.s1], [a1 + t2, p.s1], [a0 + t2, p.s0]])] }); }
      else if (/ellip|tori|hemi/.test(c.type)){
        var pi = headPts(c, p, false), po = headPts(c, p, true);
        // perfil: arco interior (spline), tapa en el eje, arco exterior (spline), cierre en la tangencia
        var inS = pi.filter(function(x, i){ return i === 0 || Math.abs(x[1] - pi[i - 1][1]) + Math.abs(x[0] - pi[i - 1][0]) > 1e-6; });
        var outS = po.filter(function(x, i){ return i === 0 || Math.abs(x[1] - po[i - 1][1]) + Math.abs(x[0] - po[i - 1][0]) > 1e-6; });
        var sfi = (c.sf || 0) > 0 ? 1 : 0, loop = [];
        if (sfi){ loop.push({ t: 'L', p: [inS[0], inS[1]] }); }
        loop.push({ t: 'S', p: inS.slice(sfi) });
        loop.push({ t: 'L', p: [inS[inS.length - 1], outS[outS.length - 1]] });
        var oR = outS.slice(sfi).reverse(); loop.push({ t: 'S', p: oR });
        if (sfi) loop.push({ t: 'L', p: [outS[1], outS[0]] });
        loop.push({ t: 'L', p: [outS[0], inS[0]] });
        f.push({ k: 'rev', loops: [loop] });
      }
      else if (c.type === 'flat'){ f.push({ k: 'rev', loops: [poly([[0, p.s0], [(c.d || 0) / 2 + Math.max(c.tn * 0.4, 15), p.s0], [(c.d || 0) / 2 + Math.max(c.tn * 0.4, 15), p.s1], [0, p.s1]])] }); }
      else if (c.type === 'bflange'){
        var t0 = p.side === 'start' ? p.s0 : p.s1 - c.t;
        f.push({ k: 'rev', loops: [ring(c.B / 2, c.A / 2, t0, t0 + c.t)] });
        if (c.ftype !== 'ring' && c.ftype !== 'lap'){ var sA = p.side === 'start' ? p.s0 + c.t : t0, sB = p.side === 'start' ? sA + c.h : t0 - c.h;
          f.push({ k: 'rev', loops: [poly([[c.B / 2, sA], [c.B / 2 + c.g1, sA], [c.B / 2 + c.g0, sB], [c.B / 2, sB]])] }); }
      }
      if (f.length) part(nm, f, VF, matName(c.mat));
    });
    // conexiones y manguitos
    prj.nozzles.forEach(function(n){
      var host = prj.comps.filter(function(c){ return c.id === n.host; })[0]; if (!host) return;
      var p = Lr.pos[host.id], rv = rad(n.theta || 0), o, a, L0, ref, padAt = null;
      if (/ellip|tori|hemi|flat/.test(host.type)){
        var hz = M.headNoz(host, p, n); a = nrm(adds(sc(e, hz.ds), rv, hz.dr)); o = adds(P(hz.s, rv, hz.r), a, -(n.hin || 0)); L0 = hz.L0;
        ref = hz.r > 1 ? rv : (H ? [0, 0, 1] : [1, 0, 0]); if (n.hor === 'normal' && host.type !== 'flat') padAt = adds(o, a, (n.hin || 0) + host.tn);
      } else { var s = p.s0 + (n.a || 0), Ri = M.innerR(host, p, s) || host.D / 2; a = rv; o = P(s, rv, Ri - (n.hin || 0)); L0 = host.tn + (n.hin || 0) + n.proj; ref = e; padAt = P(s, rv, Ri + host.tn); }
      var od = n.od, id = Math.max(od - 2 * n.tn, 1), mk = (n.kind === 'cpl' ? 'Manguito ' : 'Conexion ') + n.mark, mn = matName(n.mat);
      var fl = n.kind !== 'cpl' && n.fl && n.fl.type !== 'none' ? n.fl : null, dm = fl ? V.b165dims(fl.cls, n.nps) : null;
      var O = dm ? dm.O : od + 2 * Math.max(45, 0.35 * od), tf = dm ? dm.tf : Math.max(18, 0.12 * O), X = dm ? dm.X : od * 1.25, Ah = dm ? (dm.Ah || od) : od;
      var Yh = fl ? (fl.type === 'WN' ? (dm ? dm.Ywn : 2.2 * tf) : fl.type === 'SO' ? (dm ? dm.Ythr : 1.3 * tf) : tf) : 0;
      var segs = [{ L: L0 }]; (n.kind !== 'cpl' ? (n.elb || []) : []).forEach(function(eb){ if (eb && +eb.ang > 0){ segs.push({ elb: eb }); segs.push({ L: Math.max(+eb.L || 0, 0) }); } });
      var cur = o, last = segs.length - 1, k = 0;
      segs.forEach(function(sg, i){
        if (sg.L != null){
          var Lc = sg.L - ((i === last && fl) ? tf : 0);
          if (Lc > 0.1){ k++; part(mk + (n.kind === 'cpl' ? '' : ' tubo ' + k), [{ k: 'rev', loops: [ring(id / 2, od / 2, 0, Lc)] }], frameY(cur, a, ref), mn); }
          cur = adds(cur, a, sg.L);
        } else {
          var eb = sg.elb, ang = +eb.ang * Math.PI / 180, R = (eb.rt === 'SR' ? 1.0 : 1.5) * (fracN(n.nps) > 0 ? fracN(n.nps) * 25.4 : od);
          var u = perp(a, ref), w = nrm(cross(a, u)), ph = (+eb.phi || 0) * Math.PI / 180, b = nrm(add(sc(u, Math.cos(ph)), sc(w, Math.sin(ph))));
          var C = adds(cur, b, R), mid = nrm(add(sc(b, -Math.cos(ang / 2)), sc(a, Math.sin(ang / 2)))), yax = nrm(cross(a, b));
          // codo: sección anular en (R, 0) del plano XY local, revolución simétrica ±ang/2 alrededor de Y local
          part(mk + ' codo', [{ k: 'revSym', ang: +eb.ang, loops: [[{ t: 'C', c: [R, 0], r: od / 2 }], [{ t: 'C', c: [R, 0], r: id / 2 }]] }], { o: C, x: mid, y: yax, z: cross(mid, yax) }, matName(n.fl && n.fl.mat ? n.mat : n.mat));
          cur = adds(C, add(sc(b, -Math.cos(ang)), sc(a, Math.sin(ang))), R); var a2 = nrm(add(sc(a, Math.cos(ang)), sc(b, Math.sin(ang)))); ref = b; a = a2;
        }
      });
      if (fl){
        var back = adds(cur, a, -tf), f2 = [{ k: 'rev', loops: [ring(id / 2, O / 2, 0, tf)] }];
        if (fl.type === 'WN' && Yh > tf) f2.push({ k: 'rev', loops: [poly([[id / 2, 0], [X / 2, 0], [Ah / 2, -(Yh - tf)], [id / 2, -(Yh - tf)]])] });
        else if (fl.type === 'SO' && Yh > tf) f2.push({ k: 'rev', loops: [ring(od / 2, X / 2, -(Yh - tf), 0)] });
        part('Brida ' + n.mark + ' ' + fl.type + ' ' + (n.nps || '') + ' cl' + fl.cls, f2, frameY(back, a, ref), matName(fl.mat));
      }
      if (n.kind !== 'cpl' && n.pad && n.Dp > od && padAt) part('Refuerzo ' + n.mark, [{ k: 'rev', loops: [ring(od / 2, n.Dp / 2, 0, n.te || 6)] }], frameY(padAt, a, ref), matName(n.pmat));
    });
    // soportes
    var L = res.loads, sp = prj.support || {};
    if (L && !L.err){
      if (!H && L.skirt){ var zg = L.zg, Ds = L.skirt.Ds, tk = +sp.t || 10, tb = +sp.tb || 20;
        part('Faldon', [{ k: 'rev', loops: [ring(Ds / 2 - tk, Ds / 2, zg, L.sAtt)] }], VF, matName(sp.mat));
        part('Anillo base', [{ k: 'rev', loops: [ring(L.skirt.Dbi / 2, L.skirt.Dbo / 2, zg - tb, zg)] }], VF, matName(sp.bmat)); }
      if (!H && L.legs){ var bl = sp.lsec === 'user' ? (+sp.lb || 100) : (+sp.lod || 168), ti = sp.lsec === 'user' ? 0 : bl / 2 - (+sp.lt || 7);
        for (var j = 0; j < L.legs.n; j++){ var r2 = rad(360 * j / L.legs.n + 45); part(name('Pata'), [{ k: 'rev', loops: [ring(ti, bl / 2, 0, L.sAtt - L.zg + 300)] }], frameY(P(L.zg, r2, L.legs.Dl / 2), e, r2), matName(sp.lmat)); } }
      if (!H && L.lugs){ var ng = Math.max(2, +sp.nlug || 4), sh = prj.comps.filter(function(c){ return c.type === 'shell'; })[0], Ro = sh ? sh.D / 2 + sh.tn : 800;
        for (var q2 = 0; q2 < ng; q2++){ var r3 = rad(360 * q2 / ng + 45); part(name('Orejeta'), [{ k: 'ext', depth: 240, loops: [poly([[-110, -90], [110, -90], [110, 90], [-110, 90]])] }], { o: adds(P(L.sB + 120, r3, Ro + 110), rad(360 * q2 / ng + 135), 0), x: cross(e, r3), y: e, z: r3 }, ''); } }
      if (H && sp.type === 'saddle' && L.saddle){
        var body = prj.comps.filter(function(c){ return !/ellip|tori|hemi|flat/.test(c.type); });
        if (body.length){
          var sT0 = Math.min.apply(null, body.map(function(c){ return Lr.pos[c.id].s0; })), sT1 = Math.max.apply(null, body.map(function(c){ return Lr.pos[c.id].s1; }));
          var Ro2 = Math.max.apply(null, body.map(function(c){ return (c.D || 0) / 2 + c.tn; })) + (sp.wear ? (+sp.twp || 0) : 0), hAx = L.saddle.hAx, th = (+sp.theta || 120) * Math.PI / 180, bS = +sp.b || 200, tbp = +sp.tbp || 20;
          var Lb = sp.Lbp > 0 ? +sp.Lbp : 2 * Ro2 * Math.sin(th / 2) + 100, xh = Ro2 * Math.sin(th / 2), yh = -Ro2 * Math.cos(th / 2);
          var arc = []; for (var t3 = th / 2; t3 >= -th / 2 - 1e-9; t3 -= th / 24) arc.push([Ro2 * Math.sin(t3), -Ro2 * Math.cos(t3)]);
          var loopS = [{ t: 'L', p: [[-Lb / 2, -hAx], [Lb / 2, -hAx]] }, { t: 'L', p: [[Lb / 2, -hAx], [Lb / 2, -hAx + tbp]] }, { t: 'L', p: [[Lb / 2, -hAx + tbp], [xh + 10, yh]] }, { t: 'L', p: [[xh + 10, yh], arc[0]] },
            { t: 'S', p: arc }, { t: 'L', p: [arc[arc.length - 1], [-xh - 10, yh]] }, { t: 'L', p: [[-xh - 10, yh], [-Lb / 2, -hAx + tbp]] }, { t: 'L', p: [[-Lb / 2, -hAx + tbp], [-Lb / 2, -hAx]] }];
          var xS = H ? v(0, d.hdir === 'L' ? 1 : -1, 0) : v(1, 0, 0), yS = v(0, 0, 1);
          var zS = cross(xS, yS); [sT0 + (+sp.A || 0), sT1 - (+sp.A || 0)].forEach(function(s0){ part(name('Cuna'), [{ k: 'ext', depth: bS, loops: [loopS] }], { o: adds(sc(e, s0), zS, -bS / 2), x: xS, y: yS, z: zS }, matName(sp.smat)); });
        }
      }
    }
    return parts;
  }

  // ---------- números ----------
  function f(x, k){ var y = x * k; return (Math.abs(y) < 1e-9 ? 0 : Math.round(y * 1e6) / 1e6).toString(); }

  // ---------- Inventor: regla iLogic (VB.NET) ----------
  function inventor(prj, res){
    var parts = build(prj, res), K = 0.1, nm = safe(prj.info.tag || prj.info.equipo || 'Recipiente'), L = [];
    L.push("' Regla iLogic generada por ASME VIII-1 · Cálculo de recipientes (" + new Date().toISOString().slice(0, 10) + ")");
    L.push("' Crea una pieza .ipt por componente y el ensamblaje " + nm + ".iam en Documentos\\" + nm);
    L.push("' Uso: Inventor > Herramientas > iLogic > Explorador de iLogic > Reglas externas > Añadir regla externa (este archivo) > Ejecutar.");
    L.push("' Unidades de la API de Inventor: cm (se convierten desde mm).");
    L.push("Sub Main()");
    L.push("  Dim app As Inventor.Application = ThisApplication");
    L.push("  Dim folder As String = System.IO.Path.Combine(System.Environment.GetFolderPath(System.Environment.SpecialFolder.MyDocuments), \"" + nm + "\")");
    L.push("  System.IO.Directory.CreateDirectory(folder)");
    L.push("  Dim tplP As String = app.FileManager.GetTemplateFile(DocumentTypeEnum.kPartDocumentObject, SystemOfMeasureEnum.kMetricSystemOfMeasure)");
    L.push("  Dim tplA As String = app.FileManager.GetTemplateFile(DocumentTypeEnum.kAssemblyDocumentObject, SystemOfMeasureEnum.kMetricSystemOfMeasure)");
    L.push("  Dim paths As New System.Collections.Generic.List(Of String)");
    L.push("  Dim mats As New System.Collections.Generic.List(Of Double())");
    parts.forEach(function(p, i){
      L.push("  ' --- " + p.name + (p.mat ? " (" + p.mat + ")" : ""));
      L.push("  paths.Add(MakePart(app, tplP, folder, \"" + p.name.replace(/"/g, "'") + "\", \"" + (p.mat || '').replace(/"/g, "'") + "\", New Object() {" + p.feats.map(function(ft){
        return "New Object() {\"" + ft.k + "\", " + f(ft.ang || 0, 1) + ", " + f(ft.depth || 0, K) + ", New Object() {" + ft.loops.map(function(lp){
          return "New Object() {" + lp.map(function(sg){
            if (sg.t === 'C') return "New Object() {\"C\", New Double() {" + f(sg.c[0], K) + ", " + f(sg.c[1], K) + ", " + f(sg.r, K) + "}}";
            return "New Object() {\"" + sg.t + "\", New Double() {" + sg.p.map(function(q){ return f(q[0], K) + ", " + f(q[1], K); }).join(", ") + "}}";
          }).join(", ") + "}";
        }).join(", ") + "}}";
      }).join(", ") + "}))");
      var x = p.xf; L.push("  mats.Add(New Double() {" + [x.o[0] * K, x.o[1] * K, x.o[2] * K].concat(x.x, x.y, x.z || cross(x.x, x.y)).map(function(q){ return f(q, 1); }).join(", ") + "})");
    });
    L.push("  Dim asm As AssemblyDocument = app.Documents.Add(DocumentTypeEnum.kAssemblyDocumentObject, tplA, True)");
    L.push("  Dim tg As TransientGeometry = app.TransientGeometry");
    L.push("  For i As Integer = 0 To paths.Count - 1");
    L.push("    Dim m As Double() = mats(i)");
    L.push("    Dim mx As Matrix = tg.CreateMatrix()");
    L.push("    mx.SetCoordinateSystem(tg.CreatePoint(m(0), m(1), m(2)), tg.CreateVector(m(3), m(4), m(5)), tg.CreateVector(m(6), m(7), m(8)), tg.CreateVector(m(9), m(10), m(11)))");
    L.push("    Dim occ As ComponentOccurrence = asm.ComponentDefinition.Occurrences.Add(paths(i), mx)");
    L.push("    occ.Grounded = True");
    L.push("  Next");
    L.push("  asm.SaveAs(System.IO.Path.Combine(folder, \"" + nm + ".iam\"), False)");
    L.push("  MessageBox.Show(\"Ensamblaje creado en \" & folder, \"ASME VIII-1\")");
    L.push("End Sub");
    L.push("");
    L.push("Function MakePart(app As Inventor.Application, tpl As String, folder As String, name As String, matName As String, feats As Object()) As String");
    L.push("  Dim doc As PartDocument = app.Documents.Add(DocumentTypeEnum.kPartDocumentObject, tpl, False)");
    L.push("  Dim cd As PartComponentDefinition = doc.ComponentDefinition");
    L.push("  Dim tg As TransientGeometry = app.TransientGeometry");
    L.push("  Dim first As Boolean = True");
    L.push("  For Each ft As Object() In feats");
    L.push("    Dim sk As PlanarSketch = cd.Sketches.Add(cd.WorkPlanes(3))   ' plano XY: X, Y del croquis = X, Y de la pieza");
    L.push("    For Each lp As Object() In CType(ft(3), Object())");
    L.push("      Dim p0 As SketchPoint = Nothing, prev As SketchPoint = Nothing");
    L.push("      For Each sg As Object() In lp");
    L.push("        Dim t As String = CStr(sg(0)), c As Double() = CType(sg(1), Double())");
    L.push("        If t = \"C\" Then");
    L.push("          sk.SketchCircles.AddByCenterRadius(tg.CreatePoint2d(c(0), c(1)), c(2))");
    L.push("        ElseIf t = \"L\" Then");
    L.push("          Dim a As Object = If(prev Is Nothing, CType(tg.CreatePoint2d(c(0), c(1)), Object), CType(prev, Object))");
    L.push("          Dim ln As SketchLine = sk.SketchLines.AddByTwoPoints(a, tg.CreatePoint2d(c(2), c(3)))");
    L.push("          If p0 Is Nothing Then p0 = ln.StartSketchPoint");
    L.push("          prev = ln.EndSketchPoint");
    L.push("        Else");
    L.push("          Dim col As ObjectCollection = app.TransientObjects.CreateObjectCollection()");
    L.push("          If prev Is Nothing Then col.Add(tg.CreatePoint2d(c(0), c(1))) Else col.Add(prev)");
    L.push("          For k As Integer = 2 To c.Length - 2 Step 2 : col.Add(tg.CreatePoint2d(c(k), c(k + 1))) : Next");
    L.push("          Dim sp As SketchSpline = sk.SketchSplines.Add(col)");
    L.push("          If p0 Is Nothing Then p0 = sp.StartSketchPoint");
    L.push("          prev = sp.EndSketchPoint");
    L.push("        End If");
    L.push("      Next");
    L.push("      If Not p0 Is Nothing AndAlso Not prev Is Nothing Then");
    L.push("        If p0.Geometry.DistanceTo(prev.Geometry) < 0.0001 Then prev.Merge(p0)");
    L.push("      End If");
    L.push("    Next");
    L.push("    Dim prof As Profile = sk.Profiles.AddForSolid()");
    L.push("    Dim op As PartFeatureOperationEnum = If(first, PartFeatureOperationEnum.kNewBodyOperation, PartFeatureOperationEnum.kJoinOperation)");
    L.push("    Dim kind As String = CStr(ft(0))");
    L.push("    If kind = \"rev\" Then");
    L.push("      cd.Features.RevolveFeatures.AddFull(prof, cd.WorkAxes(2), op)");
    L.push("    ElseIf kind = \"revSym\" Then");
    L.push("      cd.Features.RevolveFeatures.AddByAngle(prof, cd.WorkAxes(2), CDbl(ft(1)) * Math.PI / 180, PartFeatureExtentDirectionEnum.kSymmetricExtentDirection, op)");
    L.push("    Else");
    L.push("      Dim ed As ExtrudeDefinition = cd.Features.ExtrudeFeatures.CreateExtrudeDefinition(prof, op)");
    L.push("      ed.SetDistanceExtent(CDbl(ft(2)), PartFeatureExtentDirectionEnum.kPositiveExtentDirection)");
    L.push("      cd.Features.ExtrudeFeatures.Add(ed)");
    L.push("    End If");
    L.push("    first = False");
    L.push("  Next");
    L.push("  Try : doc.PropertySets.Item(\"Design Tracking Properties\").Item(\"Description\").Value = matName : Catch : End Try");
    L.push("  Dim path As String = System.IO.Path.Combine(folder, name & \".ipt\")");
    L.push("  doc.SaveAs(path, False)");
    L.push("  doc.Close(True)");
    L.push("  Return path");
    L.push("End Function");
    return { text: L.join('\r\n'), parts: parts, file: nm + '_Inventor.iLogicVb' };
  }

  // ---------- SolidWorks: macro VBA ----------
  function solidworks(prj, res){
    var parts = build(prj, res), K = 0.001, nm = safe(prj.info.tag || prj.info.equipo || 'Recipiente'), L = [];
    L.push('Attribute VB_Name = "ASME_Export"');
    L.push("' Macro VBA generada por ASME VIII-1 · Cálculo de recipientes (" + new Date().toISOString().slice(0, 10) + ")");
    L.push("' Crea una pieza .sldprt por componente y el ensamblaje " + nm + ".sldasm en Documentos\\" + nm);
    L.push("' Uso: SolidWorks > Herramientas > Macro > Nueva (o Editar), en el editor VBA: Archivo > Importar archivo (este .bas) y ejecutar Main.");
    L.push("' Unidades de la API de SolidWorks: m (se convierten desde mm). Croquis en el primer plano de referencia (Alzado / Front, plano XY).");
    L.push("Option Explicit");
    L.push("Dim swApp As Object, folder As String, nParts As Long");
    L.push("Dim pPath() As String, pMat() As Variant");
    L.push("");
    L.push("Sub Main()");
    L.push("  Set swApp = Application.SldWorks");
    L.push("  folder = Environ(\"USERPROFILE\") & \"\\Documents\\" + nm + "\\\"");
    L.push("  On Error Resume Next: MkDir folder: On Error GoTo 0");
    L.push("  ReDim pPath(" + Math.max(parts.length - 1, 0) + "): ReDim pMat(" + Math.max(parts.length - 1, 0) + ")");
    parts.forEach(function(p, i){ L.push("  Part" + (i + 1)); });
    L.push("  BuildAssembly");
    L.push("  MsgBox \"Ensamblaje creado en \" & folder");
    L.push("End Sub");
    L.push("");
    L.push("Function NewPart() As Object");
    L.push("  Set NewPart = swApp.NewDocument(swApp.GetUserPreferenceStringValue(8), 0, 0, 0)   ' swDefaultTemplatePart");
    L.push("End Function");
    L.push("Sub StartSketch(doc As Object)");
    L.push("  Dim f As Object: Set f = doc.FirstFeature");
    L.push("  Do While Not f Is Nothing");
    L.push("    If f.GetTypeName2 = \"RefPlane\" Then f.Select2 False, 0: Exit Do");
    L.push("    Set f = f.GetNextFeature");
    L.push("  Loop");
    L.push("  doc.SketchManager.InsertSketch True");
    L.push("  doc.SketchManager.DisplayWhenAdded = False");
    L.push("End Sub");
    L.push("Sub DrawLoop(doc As Object, spec As String)");
    L.push("  ' spec: segmentos separados por | ; L:x1,y1,x2,y2  S:x,y,x,y,...  C:x,y,r  (metros, punto decimal)");
    L.push("  Dim segs() As String, i As Long, t As String, cs() As String, c() As Double, k As Long, n As Long, pts() As Double");
    L.push("  segs = Split(spec, \"|\")");
    L.push("  For i = 0 To UBound(segs)");
    L.push("    If Len(segs(i)) < 3 Then GoTo nxt");
    L.push("    t = Left(segs(i), 1): cs = Split(Mid(segs(i), 3), \",\"): ReDim c(UBound(cs))");
    L.push("    For k = 0 To UBound(cs): c(k) = Val(cs(k)): Next");
    L.push("    If t = \"C\" Then");
    L.push("      doc.SketchManager.CreateCircleByRadius c(0), c(1), 0, c(2)");
    L.push("    ElseIf t = \"L\" Then");
    L.push("      doc.SketchManager.CreateLine c(0), c(1), 0, c(2), c(3), 0");
    L.push("    Else");
    L.push("      n = (UBound(c) + 1) / 2: ReDim pts(3 * n - 1)");
    L.push("      For k = 0 To n - 1: pts(3 * k) = c(2 * k): pts(3 * k + 1) = c(2 * k + 1): pts(3 * k + 2) = 0: Next");
    L.push("      doc.SketchManager.CreateSpline2 (pts), True");
    L.push("    End If");
    L.push("nxt:");
    L.push("  Next");
    L.push("End Sub");
    L.push("Sub EndFeature(doc As Object, kind As String, ang As Double, depth As Double, first As Boolean)");
    L.push("  Dim fm As Object: Set fm = doc.FeatureManager");
    L.push("  If kind <> \"ext\" Then doc.SketchManager.CreateCenterLine 0, -1, 0, 0, 1, 0");
    L.push("  doc.SketchManager.DisplayWhenAdded = True");
    L.push("  doc.SketchManager.InsertSketch True");
    L.push("  doc.ClearSelection2 True");
    L.push("  doc.FeatureByPositionReverse(0).Select2 False, 0");
    L.push("  If kind = \"rev\" Then");
    L.push("    fm.FeatureRevolve2 True, True, False, False, False, False, 0, 0, 6.283185307, 0, False, False, 0, 0, 0, 0, 0, Not first, True, True");
    L.push("  ElseIf kind = \"revSym\" Then");
    L.push("    fm.FeatureRevolve2 True, True, False, False, False, False, 6, 0, ang * 3.14159265358979 / 180, 0, False, False, 0, 0, 0, 0, 0, Not first, True, True");
    L.push("  Else");
    L.push("    fm.FeatureExtrusion2 True, False, False, 0, 0, depth, 0, False, False, False, False, 0, 0, False, False, False, False, Not first, True, True, 0, 0, False");
    L.push("  End If");
    L.push("End Sub");
    L.push("Sub SavePart(doc As Object, idx As Long, name As String, matName As String)");
    L.push("  Dim p As String: p = folder & name & \".SLDPRT\"");
    L.push("  On Error Resume Next");
    L.push("  doc.CustomInfo2(\"\", \"Material\") = matName");
    L.push("  doc.AddCustomInfo3 \"\", \"Material ASME\", 30, matName");
    L.push("  On Error GoTo 0");
    L.push("  doc.SaveAs3 p, 0, 2");
    L.push("  swApp.CloseDoc doc.GetTitle");
    L.push("  pPath(idx) = p");
    L.push("End Sub");
    parts.forEach(function(p, i){
      L.push("");
      L.push("Sub Part" + (i + 1) + "()   ' " + p.name + (p.mat ? " (" + p.mat + ")" : ""));
      L.push("  Dim doc As Object, sp As String: Set doc = NewPart()");
      p.feats.forEach(function(ft, j){
        L.push("  StartSketch doc");
        ft.loops.forEach(function(lp){
          var spec = lp.map(function(sg){
            if (sg.t === 'C') return 'C:' + f(sg.c[0], K) + ',' + f(sg.c[1], K) + ',' + f(sg.r, K);
            return sg.t + ':' + sg.p.map(function(q){ return f(q[0], K) + ',' + f(q[1], K); }).join(',');
          }).join('|');
          L.push('  sp = ""');
          for (var q = 0; q < spec.length; q += 700) L.push('  sp = sp & "' + spec.slice(q, q + 700) + '"');
          L.push('  DrawLoop doc, sp');
        });
        L.push("  EndFeature doc, \"" + ft.k + "\", " + f(ft.ang || 0, 1) + ", " + f(ft.depth || 0, K) + ", " + (j === 0 ? 'True' : 'False'));
      });
      var x = p.xf, z = x.z || cross(x.x, x.y);
      L.push("  pMat(" + i + ") = Array(" + x.x.concat(x.y, z).map(function(q){ return f(q, 1); }).join(", ") + ", " + [x.o[0] * K, x.o[1] * K, x.o[2] * K].map(function(q){ return f(q, 1); }).join(", ") + ", 1, 0, 0, 0)");
      L.push("  SavePart doc, " + i + ", \"" + p.name.replace(/"/g, "'") + "\", \"" + (p.mat || '').replace(/"/g, "'") + "\"");
      L.push("End Sub");
    });
    L.push("");
    L.push("Sub BuildAssembly()");
    L.push("  Dim asm As Object, mu As Object, comp As Object, i As Long, e As Long, w As Long, d(15) As Double, k As Long, m As Variant");
    L.push("  Set asm = swApp.NewDocument(swApp.GetUserPreferenceStringValue(9), 0, 0, 0)   ' swDefaultTemplateAssembly");
    L.push("  Set mu = swApp.GetMathUtility");
    L.push("  For i = 0 To UBound(pPath)");
    L.push("    swApp.OpenDoc6 pPath(i), 1, 1, \"\", e, w");
    L.push("    Set comp = asm.AddComponent5(pPath(i), 0, \"\", False, \"\", 0, 0, 0)");
    L.push("    m = pMat(i): For k = 0 To 15: d(k) = m(k): Next");
    L.push("    If Not comp Is Nothing Then comp.Transform2 = mu.CreateTransform((d))");
    L.push("    swApp.CloseDoc pPath(i)");
    L.push("  Next");
    L.push("  asm.EditRebuild3");
    L.push("  asm.SaveAs3 folder & \"" + nm + ".SLDASM\", 0, 2");
    L.push("End Sub");
    return { text: L.join('\r\n'), parts: parts, file: nm + '_SolidWorks.bas' };
  }
  return { build: build, inventor: inventor, solidworks: solidworks };
})();

/* ================= STEP AP214 (B-rep exacto, ensamblaje), STL y DXF ================= */
(function(X){
  'use strict';
  // ---------- B-spline cúbica de interpolación global (Piegl & Tiller, A9.1) ----------
  function bsInterp(Q){
    var n = Q.length - 1, p = Math.min(3, n), d = 0, ch = [0];
    for (var k = 1; k <= n; k++){ d += Math.hypot(Q[k][0] - Q[k-1][0], Q[k][1] - Q[k-1][1], (Q[k][2] || 0) - (Q[k-1][2] || 0)); ch.push(d); }
    var u = ch.map(function(c){ return d > 0 ? c / d : 0; }), U = [];
    for (var i = 0; i <= p; i++) U.push(0);
    for (var j = 1; j <= n - p; j++){ var s = 0; for (var i2 = j; i2 <= j + p - 1; i2++) s += u[i2]; U.push(s / p); }
    for (var i3 = 0; i3 <= p; i3++) U.push(1);
    function span(t){ if (t >= U[n + 1]) return n; var lo = p, hi = n + 1; while (t < U[lo] || t >= U[lo + 1]){ var mid = (lo + hi) >> 1; if (t < U[mid]) hi = mid; else lo = mid; } return lo; }
    function basis(sp, t){ var N = [1], left = [], right = []; for (var jj = 1; jj <= p; jj++){ left[jj] = t - U[sp + 1 - jj]; right[jj] = U[sp + jj] - t; var saved = 0;
      for (var r = 0; r < jj; r++){ var tmp = N[r] / (right[r + 1] + left[jj - r]); N[r] = saved + right[r + 1] * tmp; saved = left[jj - r] * tmp; } N[jj] = saved; } return N; }
    var A = [], m = n + 1; for (var a = 0; a < m; a++){ A.push(new Array(m).fill(0)); var sp2 = span(u[a]), Nb = basis(sp2, u[a]); for (var b = 0; b <= p; b++) A[a][sp2 - p + b] = Nb[b]; }
    // resolver A·P = Q (eliminación de Gauss con pivote)
    var dim = Q[0].length, Pm = Q.map(function(q){ return q.slice(); });
    for (var c = 0; c < m; c++){ var piv = c; for (var r2 = c + 1; r2 < m; r2++) if (Math.abs(A[r2][c]) > Math.abs(A[piv][c])) piv = r2;
      var t1 = A[c]; A[c] = A[piv]; A[piv] = t1; var t2 = Pm[c]; Pm[c] = Pm[piv]; Pm[piv] = t2;
      for (var r3 = c + 1; r3 < m; r3++){ var fct = A[r3][c] / A[c][c]; if (!fct) continue; for (var cc = c; cc < m; cc++) A[r3][cc] -= fct * A[c][cc]; for (var dd = 0; dd < dim; dd++) Pm[r3][dd] -= fct * Pm[c][dd]; } }
    for (var c2 = m - 1; c2 >= 0; c2--){ for (var dd2 = 0; dd2 < dim; dd2++){ var sacc = Pm[c2][dd2]; for (var cc2 = c2 + 1; cc2 < m; cc2++) sacc -= A[c2][cc2] * Pm[cc2][dd2]; Pm[c2][dd2] = sacc / A[c2][c2]; } }
    var kn = [], mu = []; U.forEach(function(x){ if (kn.length && Math.abs(kn[kn.length - 1] - x) < 1e-12) mu[mu.length - 1]++; else { kn.push(x); mu.push(1); } });
    return { p: p, cp: Pm, knots: kn, mults: mu };
  }
  // ---------- escritor STEP ----------
  function Step(){
    var ents = [], id = 0;
    function R(x){ if (Math.abs(x) < 1e-12) x = 0; var s = String(+(+x).toPrecision(14)); if (!/[.eE]/.test(s)) s += '.'; return s.replace('e', 'E').replace(/E\+?/, function(m){ return m.indexOf('+') >= 0 ? 'E+' : m; }).replace(/^(-?\d+)E/, '$1.E'); }
    function add(t){ ents.push('#' + (++id) + ' = ' + t + ';'); return '#' + id; }
    function str(s){ return "'" + String(s).replace(/'/g, "''").replace(/[^\x20-\x7e]/g, function(ch){ return { 'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'ñ': 'n', 'Á': 'A', 'É': 'E', 'Í': 'I', 'Ó': 'O', 'Ú': 'U', 'Ñ': 'N', 'º': 'o', '°': 'o', '·': '.' }[ch] || '_'; }) + "'"; }
    function pt(p){ return add("CARTESIAN_POINT('',(" + R(p[0]) + ',' + R(p[1]) + ',' + R(p[2] || 0) + '))'); }
    function dir(v){ var l = Math.hypot(v[0], v[1], v[2]) || 1; return add("DIRECTION('',(" + R(v[0] / l) + ',' + R(v[1] / l) + ',' + R(v[2] / l) + '))'); }
    function ax3(o, z, x){ return add("AXIS2_PLACEMENT_3D(''," + pt(o) + ',' + dir(z) + ',' + dir(x) + ')'); }
    return { add: add, R: R, str: str, pt: pt, dir: dir, ax3: ax3, out: function(){ return ents; } };
  }
  function signedArea(loop){ var pts = []; loop.forEach(function(sg){ if (sg.t === 'C'){ for (var k = 0; k < 16; k++){ var a = 2 * Math.PI * k / 16; pts.push([sg.c[0] + sg.r * Math.cos(a), sg.c[1] + sg.r * Math.sin(a)]); } } else sg.p.slice(0, -1).forEach(function(q){ pts.push(q); }); });
    var A = 0; for (var i = 0; i < pts.length; i++){ var a2 = pts[i], b = pts[(i + 1) % pts.length]; A += a2[0] * b[1] - b[0] * a2[1]; } return A / 2; }
  function revLoop(loop){ return loop.slice().reverse().map(function(sg){ return sg.t === 'C' ? Object.assign({}, sg, { cw: !sg.cw }) : { t: sg.t, p: sg.p.slice().reverse() }; }); }
  function orientLoops(loops){ // primer lazo (mayor) CCW, resto CW
    var ar = loops.map(function(l){ return Math.abs(signedArea(l)); }), iMax = ar.indexOf(Math.max.apply(null, ar));
    return loops.map(function(l, i){ var cw = signedArea(l) < 0; var want = i === iMax ? false : true; l = l.map(function(sg){ return sg.t === 'C' ? Object.assign({ cw: false }, sg) : sg; });
      if (l.length === 1 && l[0].t === 'C'){ l[0].cw = want; return l; } return cw === want ? l : revLoop(l); }).sort(function(a, b){ return Math.abs(signedArea(b)) - Math.abs(signedArea(a)); });
  }
  // sólido de revolución alrededor del eje Y local (perfil en XY con x = radio); a0..a1 en radianes (full si a1 − a0 = 2π)
  function revolveSolid(S, loops, a0, a1){
    var full = Math.abs(a1 - a0 - 2 * Math.PI) < 1e-9, faces = [];
    function rot(p, a){ return [p[0] * Math.cos(a), p[1], -p[0] * Math.sin(a)]; }
    function rho(a){ return [Math.cos(a), 0, -Math.sin(a)]; }
    function nplane(a){ return [Math.sin(a), 0, Math.cos(a)]; }
    var axis1 = S.add("AXIS1_PLACEMENT(''," + S.pt([0, 0, 0]) + ',' + S.dir([0, 1, 0]) + ')');
    var capLoops0 = [], capLoops1 = [];
    loops.forEach(function(loop){
      // vértices del perfil
      var V = [], onAxis = [];
      loop.forEach(function(sg){ var p0 = sg.t === 'C' ? [sg.c[0] + sg.r, sg.c[1]] : sg.p[0]; V.push(p0); onAxis.push(Math.abs(p0[0]) < 1e-7); });
      var nV = V.length;
      function vtx(i, a){ return S.add("VERTEX_POINT(''," + S.pt(rot(V[i], a)) + ')'); }
      var V0 = V.map(function(p, i){ return vtx(i, a0); }), V1 = full ? V0 : V.map(function(p, i){ return onAxis[i] ? V0[i] : vtx(i, a1); });
      if (!full) V0.forEach(function(v, i){ if (onAxis[i]) V1[i] = v; });
      // arcos / círculos de cada vértice
      var A = V.map(function(p, i){ if (onAxis[i]) return null;
        var c = S.add("CIRCLE(''," + S.ax3([0, p[1], 0], [0, 1, 0], rho(a0)) + ',' + S.R(p[0]) + ')');
        return S.add("EDGE_CURVE(''," + V0[i] + ',' + V1[i] + ',' + c + ',.T.)'); });
      // curva de perfil en un ángulo
      function profCurve(sg, a){
        if (sg.t === 'L'){ var P0 = rot(sg.p[0], a), P1 = rot(sg.p[1], a), dv = [P1[0] - P0[0], P1[1] - P0[1], P1[2] - P0[2]], L = Math.hypot(dv[0], dv[1], dv[2]);
          return S.add("LINE(''," + S.pt(P0) + ',' + S.add("VECTOR(''," + S.dir(dv) + ',' + S.R(L) + ')') + ')'); }
        if (sg.t === 'S'){ var bs = sg.bs || (sg.bs = bsInterp(sg.p.map(function(q){ return [q[0], q[1], 0]; })));
          return S.add("B_SPLINE_CURVE_WITH_KNOTS(''," + bs.p + ',(' + bs.cp.map(function(q){ return S.pt(rot(q, a)); }).join(',') + '),.UNSPECIFIED.,.F.,.F.,(' + bs.mults.join(',') + '),(' + bs.knots.map(S.R).join(',') + '),.UNSPECIFIED.)'); }
        var n = nplane(a); if (sg.cw) n = [-n[0], -n[1], -n[2]];
        return S.add("CIRCLE(''," + S.ax3(rot(sg.c, a), n, rho(a)) + ',' + S.R(sg.r) + ')');
      }
      function segEdge(i, a, Vset){ var sg = loop[i], j = (i + 1) % nV, crv = profCurve(sg, a); return { e: S.add("EDGE_CURVE(''," + Vset[i] + ',' + (sg.t === 'C' ? Vset[i] : Vset[j]) + ',' + crv + ',.T.)'), crv: crv }; }
      var E0 = loop.map(function(sg, i){ var b = sg.t === 'L' && onAxis[i] && onAxis[(i + 1) % nV]; return b ? null : segEdge(i, a0, V0); });
      var E1 = full ? E0 : loop.map(function(sg, i){ var b = sg.t === 'L' && onAxis[i] && onAxis[(i + 1) % nV]; return b ? null : segEdge(i, a1, V1); });
      // caras laterales
      loop.forEach(function(sg, i){
        if (!E0[i]) return;
        var j = sg.t === 'C' ? i : (i + 1) % nV, oe = [];
        if (A[i]) oe.push("ORIENTED_EDGE('',*,*," + A[i] + ',.T.)');
        oe.push("ORIENTED_EDGE('',*,*," + E1[i].e + ',.T.)');
        if (A[j]) oe.push("ORIENTED_EDGE('',*,*," + A[j] + ',.F.)');
        oe.push("ORIENTED_EDGE('',*,*," + E0[i].e + ',.F.)');
        var lp = S.add("EDGE_LOOP('',(" + oe.map(function(o){ return S.add(o); }).join(',') + '))');
        var srf = S.add("SURFACE_OF_REVOLUTION(''," + E0[i].crv + ',' + axis1 + ')');
        faces.push(S.add("ADVANCED_FACE('',(" + S.add("FACE_BOUND(''," + lp + ',.T.)') + '),' + srf + ',.F.)'));
      });
      if (!full){
        capLoops0.push(S.add("EDGE_LOOP('',(" + E0.filter(Boolean).map(function(x){ return S.add("ORIENTED_EDGE('',*,*," + x.e + ',.T.)'); }).join(',') + '))'));
        capLoops1.push(S.add("EDGE_LOOP('',(" + E1.filter(Boolean).map(function(x){ return S.add("ORIENTED_EDGE('',*,*," + x.e + ',.T.)'); }).join(',') + '))'));
      }
    });
    if (!full){
      var pl0 = S.add("PLANE(''," + S.ax3([0, 0, 0], nplane(a0), rho(a0)) + ')'), pl1 = S.add("PLANE(''," + S.ax3([0, 0, 0], nplane(a1), rho(a1)) + ')');
      faces.push(S.add("ADVANCED_FACE('',(" + capLoops0.map(function(l){ return S.add("FACE_BOUND(''," + l + ',.T.)'); }).join(',') + '),' + pl0 + ',.T.)'));
      faces.push(S.add("ADVANCED_FACE('',(" + capLoops1.map(function(l){ return S.add("FACE_BOUND(''," + l + ',.F.)'); }).join(',') + '),' + pl1 + ',.T.)'));
    }
    return S.add("MANIFOLD_SOLID_BREP(''," + S.add("CLOSED_SHELL('',(" + faces.join(',') + '))') + ')');
  }
  // sólido extruido según +Z local (perfil CCW en XY)
  function extrudeSolid(S, loop, depth){
    var V = loop.map(function(sg){ return sg.p[0]; }), n = V.length, faces = [];
    var B = V.map(function(p){ return S.add("VERTEX_POINT(''," + S.pt([p[0], p[1], 0]) + ')'); }), T = V.map(function(p){ return S.add("VERTEX_POINT(''," + S.pt([p[0], p[1], depth]) + ')'); });
    function curve(sg, z){ if (sg.t === 'L'){ var dv = [sg.p[1][0] - sg.p[0][0], sg.p[1][1] - sg.p[0][1], 0]; return S.add("LINE(''," + S.pt([sg.p[0][0], sg.p[0][1], z]) + ',' + S.add("VECTOR(''," + S.dir(dv) + ',' + S.R(Math.hypot(dv[0], dv[1])) + ')') + ')'); }
      var bs = sg.bs || (sg.bs = bsInterp(sg.p.map(function(q){ return [q[0], q[1], 0]; })));
      return S.add("B_SPLINE_CURVE_WITH_KNOTS(''," + bs.p + ',(' + bs.cp.map(function(q){ return S.pt([q[0], q[1], z]); }).join(',') + '),.UNSPECIFIED.,.F.,.F.,(' + bs.mults.join(',') + '),(' + bs.knots.map(S.R).join(',') + '),.UNSPECIFIED.)'); }
    var Eb = [], Et = [], Ev = [], Cb = [];
    loop.forEach(function(sg, i){ var j = (i + 1) % n, cb = curve(sg, 0); Cb.push(cb); Eb.push(S.add("EDGE_CURVE(''," + B[i] + ',' + B[j] + ',' + cb + ',.T.)')); Et.push(S.add("EDGE_CURVE(''," + T[i] + ',' + T[j] + ',' + curve(sg, depth) + ',.T.)')); });
    V.forEach(function(p, i){ var ln = S.add("LINE(''," + S.pt([p[0], p[1], 0]) + ',' + S.add("VECTOR(''," + S.dir([0, 0, 1]) + ',' + S.R(depth) + ')') + ')'); Ev.push(S.add("EDGE_CURVE(''," + B[i] + ',' + T[i] + ',' + ln + ',.T.)')); });
    loop.forEach(function(sg, i){
      var j = (i + 1) % n, srf;
      if (sg.t === 'L'){ var tx = sg.p[1][0] - sg.p[0][0], ty = sg.p[1][1] - sg.p[0][1]; srf = S.add("PLANE(''," + S.ax3([sg.p[0][0], sg.p[0][1], 0], [ty, -tx, 0], [tx, ty, 0]) + ')'); }
      else srf = S.add("SURFACE_OF_LINEAR_EXTRUSION(''," + Cb[i] + ',' + S.add("VECTOR(''," + S.dir([0, 0, 1]) + ',' + S.R(depth) + ')') + ')');
      var lp = S.add("EDGE_LOOP('',(" + [[Eb[i], 'T'], [Ev[j], 'T'], [Et[i], 'F'], [Ev[i], 'F']].map(function(x){ return S.add("ORIENTED_EDGE('',*,*," + x[0] + ',.' + x[1] + '.)'); }).join(',') + '))');
      faces.push(S.add("ADVANCED_FACE('',(" + S.add("FACE_BOUND(''," + lp + ',.T.)') + '),' + srf + ',.T.)'));
    });
    var lb = S.add("EDGE_LOOP('',(" + Eb.map(function(e){ return S.add("ORIENTED_EDGE('',*,*," + e + ',.T.)'); }).join(',') + '))');
    var lt = S.add("EDGE_LOOP('',(" + Et.map(function(e){ return S.add("ORIENTED_EDGE('',*,*," + e + ',.T.)'); }).join(',') + '))');
    faces.push(S.add("ADVANCED_FACE('',(" + S.add("FACE_BOUND(''," + lb + ',.F.)') + '),' + S.add("PLANE(''," + S.ax3([0, 0, 0], [0, 0, -1], [1, 0, 0]) + ')') + ',.T.)'));
    faces.push(S.add("ADVANCED_FACE('',(" + S.add("FACE_BOUND(''," + lt + ',.T.)') + '),' + S.add("PLANE(''," + S.ax3([0, 0, depth], [0, 0, 1], [1, 0, 0]) + ')') + ',.T.)'));
    return S.add("MANIFOLD_SOLID_BREP(''," + S.add("CLOSED_SHELL('',(" + faces.join(',') + '))') + ')');
  }
  function stepFile(prj, res){
    var parts = X.build(prj, res), S = Step(), nm = prj.info.tag || prj.info.equipo || 'Recipiente';
    var appc = S.add("APPLICATION_CONTEXT('core data for automotive mechanical design processes')");
    S.add("APPLICATION_PROTOCOL_DEFINITION('international standard','automotive_design',2000," + appc + ')');
    function ctx(){ var lu = S.add('( LENGTH_UNIT() NAMED_UNIT(*) SI_UNIT(.MILLI.,.METRE.) )'), au = S.add('( NAMED_UNIT(*) PLANE_ANGLE_UNIT() SI_UNIT($,.RADIAN.) )'), su = S.add('( NAMED_UNIT(*) SI_UNIT($,.STERADIAN.) SOLID_ANGLE_UNIT() )');
      var un = S.add("UNCERTAINTY_MEASURE_WITH_UNIT(LENGTH_MEASURE(1.E-05)," + lu + ",'distance_accuracy_value','confusion accuracy')");
      return S.add("( GEOMETRIC_REPRESENTATION_CONTEXT(3) GLOBAL_UNCERTAINTY_ASSIGNED_CONTEXT((" + un + ')) GLOBAL_UNIT_ASSIGNED_CONTEXT((' + lu + ',' + au + ',' + su + ")) REPRESENTATION_CONTEXT('Context #1','3D Context with UNIT and UNCERTAINTY') )"); }
    function product(name, rep){
      var pc = S.add("PRODUCT_CONTEXT(''," + appc + ",'mechanical')"), pr = S.add('PRODUCT(' + S.str(name) + ',' + S.str(name) + ",''," + '(' + pc + '))');
      var pdf = S.add("PRODUCT_DEFINITION_FORMATION(''," + "''," + pr + ')'), pdc = S.add("PRODUCT_DEFINITION_CONTEXT('part definition'," + appc + ",'design')");
      var pd = S.add("PRODUCT_DEFINITION('design',''," + pdf + ',' + pdc + ')'), pds = S.add("PRODUCT_DEFINITION_SHAPE(''," + "''," + pd + ')');
      S.add('SHAPE_DEFINITION_REPRESENTATION(' + pds + ',' + rep + ')'); S.add("PRODUCT_RELATED_PRODUCT_CATEGORY('part',$,(" + pr + '))');
      return pd;
    }
    // ensamblaje
    var actx = ctx(), aorg = S.ax3([0, 0, 0], [0, 0, 1], [1, 0, 0]), places = parts.map(function(p){ return S.ax3(p.xf.o, p.xf.z, p.xf.x); });
    var arep = S.add("SHAPE_REPRESENTATION(''," + '(' + [aorg].concat(places).join(',') + '),' + actx + ')');
    var apd = product(nm, arep);
    parts.forEach(function(p, k){
      var pctx = ctx(), porg = S.ax3([0, 0, 0], [0, 0, 1], [1, 0, 0]), solids = [];
      p.feats.forEach(function(ft){
        if (ft.k === 'ext') solids.push(extrudeSolid(S, orientLoops(ft.loops)[0], ft.depth));
        else { var a = ft.k === 'revSym' ? (+ft.ang || 90) * Math.PI / 180 : 2 * Math.PI; solids.push(revolveSolid(S, orientLoops(ft.loops), ft.k === 'revSym' ? -a / 2 : 0, ft.k === 'revSym' ? a / 2 : a)); }
      });
      var prep = S.add("ADVANCED_BREP_SHAPE_REPRESENTATION(" + S.str(p.name) + ',(' + [porg].concat(solids).join(',') + '),' + pctx + ')');
      var ppd = product(p.name, prep);
      var idt = S.add("ITEM_DEFINED_TRANSFORMATION(''," + "''," + porg + ',' + places[k] + ')');
      var rr = S.add("( REPRESENTATION_RELATIONSHIP(''," + "''," + prep + ',' + arep + ') REPRESENTATION_RELATIONSHIP_WITH_TRANSFORMATION(' + idt + ') SHAPE_REPRESENTATION_RELATIONSHIP() )');
      var nauo = S.add("NEXT_ASSEMBLY_USAGE_OCCURRENCE(" + S.str(String(k + 1)) + ',' + S.str(p.name) + ",''," + apd + ',' + ppd + ',$)');
      S.add('CONTEXT_DEPENDENT_SHAPE_REPRESENTATION(' + rr + ',' + S.add("PRODUCT_DEFINITION_SHAPE('Placement','Placement of an item'," + nauo + ')') + ')');
    });
    var now = new Date().toISOString().slice(0, 19);
    var head = ['ISO-10303-21;', 'HEADER;', "FILE_DESCRIPTION(('ASME VIII-1 vessel model'),'2;1');", 'FILE_NAME(' + S.str(nm + '.stp') + ",'" + now + "',(''),(''),'ASME VIII-1 Calculo de recipientes','ASME VIII-1 web','');", "FILE_SCHEMA(('AUTOMOTIVE_DESIGN { 1 0 10303 214 1 1 1 1 }'));", 'ENDSEC;', 'DATA;'];
    return { text: head.concat(S.out(), ['ENDSEC;', 'END-ISO-10303-21;']).join('\n'), file: S.str(nm).slice(1, -1) + '.stp', parts: parts };
  }
  // ---------- STL (binario) y DXF 3D a partir de las mallas del visor ----------
  function tris(meshes){ // meshes: [{ pos: Float32Array (x,y,z por vértice, ya en coordenadas mundo), idx: array|null, name }]
    var out = []; meshes.forEach(function(m){ var p = m.pos, I = m.idx, n = I ? I.length : p.length / 3;
      for (var k = 0; k + 2 < n; k += 3){ var a = I ? I[k] : k, b = I ? I[k + 1] : k + 1, c = I ? I[k + 2] : k + 2; out.push([m.name, [p[3 * a], p[3 * a + 1], p[3 * a + 2]], [p[3 * b], p[3 * b + 1], p[3 * b + 2]], [p[3 * c], p[3 * c + 1], p[3 * c + 2]]]); } });
    return out;
  }
  function stl(meshes, nm){
    var T = tris(meshes), buf = new ArrayBuffer(84 + 50 * T.length), dv = new DataView(buf), hdr = 'ASME VIII-1 vessel ' + nm;
    for (var i = 0; i < 80; i++) dv.setUint8(i, i < hdr.length ? hdr.charCodeAt(i) & 127 : 32);
    dv.setUint32(80, T.length, true);
    T.forEach(function(t, k){ var o = 84 + 50 * k, a = t[1], b = t[2], c = t[3], u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      var n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]], l = Math.hypot(n[0], n[1], n[2]) || 1;
      [n[0] / l, n[1] / l, n[2] / l].concat(a, b, c).forEach(function(x, j){ dv.setFloat32(o + 4 * j, x, true); }); dv.setUint16(o + 48, 0, true); });
    return { data: buf, file: nm + '.stl', n: T.length };
  }
  function dxfLayerName(s){ return String(s || '0').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9_-]+/g, '_').slice(0, 31) || '0'; }
  function dxfDoc(layers, body){
    var L = ['0', 'SECTION', '2', 'HEADER', '9', '$ACADVER', '1', 'AC1009', '9', '$INSBASE', '10', '0.0', '20', '0.0', '30', '0.0', '0', 'ENDSEC',
      '0', 'SECTION', '2', 'TABLES', '0', 'TABLE', '2', 'LAYER', '70', String(Object.keys(layers).length)];
    Object.keys(layers).forEach(function(n){ L.push('0', 'LAYER', '2', n, '70', '0', '62', String(layers[n]), '6', 'CONTINUOUS'); });
    L.push('0', 'ENDTAB', '0', 'ENDSEC', '0', 'SECTION', '2', 'ENTITIES');
    return L.concat(body, ['0', 'ENDSEC', '0', 'EOF']).join('\r\n');
  }
  function F6(x){ return (Math.abs(x) < 1e-9 ? 0 : Math.round(x * 1e4) / 1e4).toFixed(4); }
  function dxf3d(meshes, nm){
    var T = tris(meshes), layers = {}, body = [], col = 1;
    T.forEach(function(t){ var ly = dxfLayerName(t[0]); if (!layers[ly]) layers[ly] = (col++ % 7) + 1;
      body.push('0', '3DFACE', '8', ly); [t[1], t[2], t[3], t[3]].forEach(function(p, i){ body.push(String(10 + i), F6(p[0]), String(20 + i), F6(p[1]), String(30 + i), F6(p[2])); }); });
    return { text: dxfDoc(layers, body), file: nm + '_3D.dxf', n: T.length };
  }
  // ---------- DXF 2D: alzado a partir del esquema SVG ----------
  var CLS = { wall: ['ENVOLVENTE', 7], noz: ['CONEXIONES', 3], fln: ['BRIDAS', 3], sup: ['SOPORTES', 8], seam: ['SOLDADURAS', 30], axis: ['EJES', 1], tick: ['COTAS', 9], dim: ['COTAS', 9], liq: ['NIVEL', 5], ground: ['SUELO', 8], bolt: ['PERNOS', 8], nzt: ['TEXTOS', 2], liqt: ['TEXTOS', 2], axl: ['TEXTOS', 2], orig: ['EJES', 1] };
  function dxf2d(svg, map, nm){
    var layers = {}, body = [];
    function lay(el){ var c = (el.getAttribute('class') || '').split(/\s+/)[0]; var d = CLS[c] || ['ESQUEMA', 7]; layers[d[0]] = d[1]; return d[0]; }
    function W(X, Y){ return map.H ? [(X - map.W / 2) / map.sc + map.sCenter * map.sign, (map.Hh / 2 - Y) / map.sc] : [(X - map.W / 2) / map.sc, map.sCenter + (map.Hh / 2 - Y) / map.sc]; }
    function poly(pts, closed, ly){ if (pts.length < 2) return; body.push('0', 'POLYLINE', '8', ly, '66', '1', '70', closed ? '1' : '0', '10', '0.0', '20', '0.0', '30', '0.0');
      pts.forEach(function(p){ body.push('0', 'VERTEX', '8', ly, '10', F6(p[0]), '20', F6(p[1]), '30', '0.0'); }); body.push('0', 'SEQEND', '8', ly); }
    Array.prototype.forEach.call(svg.querySelectorAll('path, line, circle, text'), function(el){
      var ly = lay(el), tg = el.tagName.toLowerCase();
      if (tg === 'path'){ var d = el.getAttribute('d') || '', subs = d.split(/(?=M)/);
        subs.forEach(function(sp){ var nums = sp.match(/-?\d+(\.\d+)?(e-?\d+)?/gi) || [], pts = []; for (var k = 0; k + 1 < nums.length; k += 2) pts.push(W(+nums[k], +nums[k + 1])); poly(pts, /Z/i.test(sp), ly); }); }
      else if (tg === 'line'){ var a = W(+el.getAttribute('x1'), +el.getAttribute('y1')), b = W(+el.getAttribute('x2'), +el.getAttribute('y2')); body.push('0', 'LINE', '8', ly, '10', F6(a[0]), '20', F6(a[1]), '30', '0.0', '11', F6(b[0]), '21', F6(b[1]), '31', '0.0'); }
      else if (tg === 'circle'){ var c = W(+el.getAttribute('cx'), +el.getAttribute('cy')); body.push('0', 'CIRCLE', '8', ly, '10', F6(c[0]), '20', F6(c[1]), '30', '0.0', '40', F6(+el.getAttribute('r') / map.sc)); }
      else { var t = W(+el.getAttribute('x'), +el.getAttribute('y')), txt = (el.textContent || '').replace(/[^\x20-\x7e]/g, function(ch){ return ch === '°' ? '%%d' : ch.normalize('NFD').replace(/[̀-ͯ]/g, '') || '_'; });
        body.push('0', 'TEXT', '8', 'TEXTOS', '10', F6(t[0]), '20', F6(t[1]), '30', '0.0', '40', F6(10 / map.sc), '1', txt); layers.TEXTOS = 2; }
    });
    return { text: dxfDoc(layers, body), file: nm + '_alzado.dxf' };
  }
  X.step = stepFile; X.stl = stl; X.dxf3d = dxf3d; X.dxf2d = dxf2d; X._bs = bsInterp;
})(EXPORT3D);

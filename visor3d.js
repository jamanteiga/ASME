/* Visor 3D del recipiente (three.js r128). Eje Z hacia arriba; origen 0,0,0 en el centro inferior de la primera virola. */
var VISOR3D = (function(){
  'use strict';
  var T = window.THREE, M = window.VMODEL, V = window.VESSEL;
  var el, scene, cam, ren, ctl, root, grid, labels = [], onPick = null, clip = false, plane, fitted = false, lastKey = '';
  var Y = new T.Vector3(0, 1, 0);
  var COL = { ok: 0xa9b3bf, ko: 0xd9534f, sel: 0x3b82f6, sup: 0x7d8590, noz: 0xc3cad3, fl: 0x8f98a3, liq: 0x2a78d6 };
  function mat(c, opt){ return new T.MeshStandardMaterial(Object.assign({ color: c, metalness: 0.35, roughness: 0.55, side: T.DoubleSide, clippingPlanes: clip ? [plane] : [] }, opt || {})); }

  function init(container, pickCb){
    el = container; onPick = pickCb;
    if (!T || !(function(){ try { var c = document.createElement('canvas'); return !!(c.getContext('webgl') || c.getContext('experimental-webgl')); } catch (e){ return false; } })()) return false;
    ren = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: true });
    ren.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); ren.localClippingEnabled = true;
    el.appendChild(ren.domElement);
    scene = new T.Scene();
    cam = new T.PerspectiveCamera(35, 1, 10, 1e6); cam.up.set(0, 0, 1);
    scene.add(new T.HemisphereLight(0xffffff, 0x8a8f98, 0.85));
    var dl = new T.DirectionalLight(0xffffff, 0.75); dl.position.set(1, -1.5, 2); scene.add(dl);
    var dl2 = new T.DirectionalLight(0xffffff, 0.3); dl2.position.set(-1, 1, -0.5); scene.add(dl2);
    ctl = new T.OrbitControls(cam, ren.domElement); ctl.enableDamping = true; ctl.dampingFactor = 0.12;
    plane = new T.Plane(new T.Vector3(0, 1, 0), 0);
    var down = null;
    ren.domElement.addEventListener('pointerdown', function(e){ down = [e.clientX, e.clientY]; });
    ren.domElement.addEventListener('pointerup', function(e){
      if (!down || Math.abs(e.clientX - down[0]) + Math.abs(e.clientY - down[1]) > 5 || !root) return;
      var r = ren.domElement.getBoundingClientRect(), m = new T.Vector2((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
      var rc = new T.Raycaster(); rc.setFromCamera(m, cam);
      var hits = rc.intersectObjects(root.children, true).filter(function(h){ return !clip || plane.distanceToPoint(h.point) >= -1e-3; });
      for (var k = 0; k < hits.length; k++){ var o = hits[k].object; while (o && !o.userData.kind) o = o.parent; if (o && onPick){ onPick(o.userData.kind, o.userData.id); return; } }
    });
    window.addEventListener('resize', resize);
    var tPrev = performance.now();
    (function loop(now){ requestAnimationFrame(loop); var dt = Math.min(0.1, ((now || performance.now()) - tPrev) / 1000); tPrev = now || performance.now();
      if (!el.offsetParent) return; pollGamepad(); sm3d(dt); ctl.update(); ren.render(scene, cam); })();
    if (navigator.hid && navigator.hid.getDevices) navigator.hid.getDevices().then(function(ds){ ds.filter(isSM).forEach(openHID); }).catch(function(){});
    resize();
    return true;
  }
  function resize(){ if (!ren || !el) return; var w = el.clientWidth || 400, h = el.clientHeight || 500; ren.setSize(w, h); cam.aspect = w / h; cam.updateProjectionMatrix(); }

  // ---------- primitivas ----------
  function lathe(pts, e, m, ud){ // pts [[s, r]] perfil cerrado, revolucionado alrededor del eje e por el origen
    var v = pts.map(function(p){ return new T.Vector2(Math.max(p[1], 0), p[0]); }); v.push(v[0].clone());
    var g = new T.LatheGeometry(v, 72), me = new T.Mesh(g, m);
    me.quaternion.setFromUnitVectors(Y, e); if (ud) me.userData = ud; return me;
  }
  function along(o, d, prof, m, ud){ // perfil [[x a lo largo de d, r]] a partir del punto o
    var me = lathe(prof, d.clone().normalize(), m, ud); me.position.copy(o); return me;
  }
  function tube(o, d, L, ro, ri, m, ud){ return along(o, d, [[0, ri], [L, ri], [L, ro], [0, ro]], m, ud); }
  function arcCurve(C, a, b, R, ang){ var pts = [];
    for (var k = 0; k <= 24; k++){ var th = k / 24 * ang; pts.push(C.clone().addScaledVector(b, -Math.cos(th) * R).addScaledVector(a, Math.sin(th) * R)); }
    return new T.CatmullRomCurve3(pts); }
  function label(txt, pos, size){
    var c = document.createElement('canvas'), x = c.getContext('2d'); c.width = 256; c.height = 96;
    x.font = '600 52px IBM Plex Mono, monospace'; x.fillStyle = 'rgba(255,255,255,0.85)'; var w = x.measureText(txt).width + 24;
    x.fillRect((256 - w) / 2, 14, w, 68); x.fillStyle = '#1b2533'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(txt, 128, 50);
    var sp = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(c), depthTest: false, transparent: true }));
    sp.position.copy(pos); sp.scale.set(size * 2.67, size, 1); sp.renderOrder = 10; return sp;
  }
  function fracN(t){ return String(t || '').split(' ').reduce(function(a, p){ var q = p.split('/'); return a + (q.length > 1 ? +q[0] / +q[1] : +q[0] || 0); }, 0); }

  // ---------- geometría del recipiente ----------
  function frame(prj){
    var d = prj.design, H = d.orient === 'H', e = H ? new T.Vector3(d.hdir === 'L' ? -1 : 1, 0, 0) : new T.Vector3(0, 0, 1);
    function rad(th){ th = th * Math.PI / 180; return H ? new T.Vector3(0, Math.sin(th), Math.cos(th)) : new T.Vector3(Math.cos(th), Math.sin(th), 0); }
    function P(s, rv, r){ return e.clone().multiplyScalar(s).addScaledVector(rv, r); }
    return { H: H, e: e, rad: rad, P: P };
  }
  function headPts(c, p, outer){
    var oc = c;
    if (outer){ oc = Object.assign({}, c, { D: c.D + 2 * c.tn }); if (c.type === 'ellip') oc.ratio = (c.D + 2 * c.tn) / (2 * (M.headDepth(c) + c.tn)); if (c.type === 'tori'){ oc.Lc = M.toriL(c) + c.tn; oc.rk = M.toriR(c) + c.tn; } }
    return M.headProfile(oc).map(function(q){ return [p.side === 'start' ? p.s1 - q[0] : p.s0 + q[0], q[1]]; });
  }
  function compMesh(prj, c, p, st, F){
    var e = F.e, m = mat(st), ud = { kind: 'comp', id: c.id }, g = new T.Group(); g.userData = ud;
    if (c.type === 'shell'){ var ri = M.innerR(c, p, p.s0); g.add(lathe([[p.s0, ri], [p.s1, ri], [p.s1, ri + c.tn], [p.s0, ri + c.tn]], e, m));
      if (+c.rn > 0){ var mr = mat(COL.sup); for (var q = 1; q <= +c.rn; q++){ var sr = p.s0 + q * (p.s1 - p.s0) / (+c.rn + 1), hb = (+c.rb || 10) / 2, r0 = c.rside === 'int' ? ri - (+c.rh || 0) : ri + c.tn, r1 = c.rside === 'int' ? ri : ri + c.tn + (+c.rh || 0);
        g.add(lathe([[sr - hb, r0], [sr + hb, r0], [sr + hb, r1], [sr - hb, r1]], e, mr)); } } }
    else if (c.type === 'cone'){ var t2 = c.tn / Math.cos(c.alpha * Math.PI / 180), a0 = M.innerR(c, p, p.s0), a1 = M.innerR(c, p, p.s1); g.add(lathe([[p.s0, a0], [p.s1, a1], [p.s1, a1 + t2], [p.s0, a0 + t2]], e, m)); }
    else if (/ellip|tori|hemi/.test(c.type)){ var pi = headPts(c, p, false), po = headPts(c, p, true); g.add(lathe(pi.concat(po.slice().reverse()), e, m)); }
    else if (c.type === 'flat'){ var R0 = (c.d || 0) / 2 + Math.max(c.tn * 0.4, 15); g.add(lathe([[p.s0, 0], [p.s1, 0], [p.s1, R0], [p.s0, R0]], e, m)); }
    else if (c.type === 'bflange'){
      var t0 = p.side === 'start' ? p.s0 : p.s1 - c.t, h0 = p.side === 'start' ? p.s0 + c.t : p.s0, hd = p.side === 'start' ? 1 : -1;
      g.add(lathe([[t0, c.B / 2], [t0 + c.t, c.B / 2], [t0 + c.t, c.A / 2], [t0, c.A / 2]], e, m));
      if (c.ftype !== 'ring' && c.ftype !== 'lap'){ var sA = p.side === 'start' ? h0 : t0, sB = p.side === 'start' ? h0 + c.h : t0 - c.h;
        g.add(lathe([[sA, c.B / 2], [sB, c.B / 2], [sB, c.B / 2 + c.g0], [sA, c.B / 2 + c.g1]], e, m)); }
      // pernos
      var mb = mat(0x5b6470), nb = Math.min(+c.n || 0, 96), sb0 = t0 - 20, sb1 = t0 + c.t + 20;
      for (var k = 0; k < nb; k++){ var rv = F.rad(360 * k / nb); g.add(tube(F.P(p.side === 'start' ? sb0 : sb0, rv, c.C / 2), e, sb1 - sb0, (+c.a || 20) / 2, 0, mb)); }
    }
    return g;
  }
  // ---------- boquillas ----------
  function nozGeom(prj, n, host, p, F){
    var e = F.e, th = n.theta || 0, rv = F.rad(th), o, a, sIn, ref, Ro, Ri;
    if (/ellip|tori|hemi|flat/.test(host.type)){
      var hz = M.headNoz(host, p, n);
      a = e.clone().multiplyScalar(hz.ds).addScaledVector(rv, hz.dr).normalize();
      o = F.P(hz.s, rv, hz.r).addScaledVector(a, -(n.hin || 0));
      ref = hz.r > 1 ? rv.clone() : (F.H ? new T.Vector3(0, 0, 1) : new T.Vector3(1, 0, 0));
      return { o: o, a: a, L0: hz.L0, ref: ref, padAt: n.hor === 'normal' && host.type !== 'flat' ? o.clone().addScaledVector(a, (n.hin || 0) + host.tn) : null };
    }
    var s = p.s0 + (n.a || 0); Ri = M.innerR(host, p, s) || host.D / 2; Ro = Ri + host.tn;
    a = rv.clone(); o = F.P(s, rv, Ri - (n.hin || 0));
    return { o: o, a: a, L0: host.tn + (n.hin || 0) + n.proj, ref: e.clone(), padAt: F.P(s, rv, Ro), s: s };
  }
  function nozMesh(prj, n, host, p, st, F){
    var g = new T.Group(); g.userData = { kind: 'noz', id: n.id };
    var m = mat(st), mf = mat(st === COL.ok ? COL.fl : st), od = n.od, id = Math.max(od - 2 * n.tn, 1), G0 = nozGeom(prj, n, host, p, F);
    var fl = n.fl && n.fl.type !== 'none' ? n.fl : null, dm = fl ? V.b165dims(fl.cls, n.nps) : null;
    var O = dm ? dm.O : od + 2 * Math.max(45, 0.35 * od), tf = dm ? dm.tf : Math.max(18, 0.12 * O), X = dm ? dm.X : od * 1.25, Ah = dm ? (dm.Ah || od) : od;
    var Yh = fl ? (fl.type === 'WN' ? (dm ? dm.Ywn : 2.2 * tf) : fl.type === 'SO' ? (dm ? dm.Ythr : 1.3 * tf) : tf) : 0;
    // tramos: recto inicial, codos y rectos
    var segs = [{ L: G0.L0 }], cur = G0.o.clone(), a = G0.a.clone();
    (n.elb || []).forEach(function(eb){ if (!eb || !(+eb.ang > 0)) return; segs.push({ elb: eb }); segs.push({ L: Math.max(+eb.L || 0, 0) }); });
    var last = segs.length - 1;
    segs.forEach(function(sg, i){
      if (sg.L != null){
        var L = sg.L, cut = (i === last && fl) ? tf : 0;
        if (L - cut > 0) g.add(tube(cur, a, L - cut, od / 2, id / 2, m));
        cur.addScaledVector(a, L);
      } else {
        var eb = sg.elb, ang = +eb.ang * Math.PI / 180, R = (eb.rt === 'SR' ? 1.0 : 1.5) * (fracN(n.nps) > 0 ? fracN(n.nps) * 25.4 : od);
        var u = G0.ref.clone().addScaledVector(a, -G0.ref.dot(a)); if (u.lengthSq() < 1e-6) u = new T.Vector3(0, 0, 1).addScaledVector(a, -a.z); u.normalize();
        var w = new T.Vector3().crossVectors(a, u).normalize(), ph = (+eb.phi || 0) * Math.PI / 180, b = u.clone().multiplyScalar(Math.cos(ph)).addScaledVector(w, Math.sin(ph)).normalize();
        var C = cur.clone().addScaledVector(b, R), crv = arcCurve(C, a.clone(), b.clone(), R, ang);
        g.add(new T.Mesh(new T.TubeGeometry(crv, 24, od / 2, 28, false), m));
        cur = crv.getPoint(1); a = a.clone().multiplyScalar(Math.cos(ang)).addScaledVector(b, Math.sin(ang)).normalize();
        G0.ref = b.clone();
      }
    });
    // refuerzo
    if (n.pad && n.Dp > od && G0.padAt) g.add(tube(G0.padAt, G0.a, n.te || 6, n.Dp / 2, od / 2, mat(COL.sup)));
    // brida en el extremo (cara en cur, normal a)
    if (fl){
      var back = cur.clone().addScaledVector(a, -tf);
      g.add(along(back, a, [[0, id / 2], [tf, id / 2], [tf, O / 2], [0, O / 2]], mf));
      if (fl.type === 'WN' && Yh > tf){ g.add(along(back, a.clone().negate(), [[0, id / 2], [Yh - tf, id / 2], [Yh - tf, Ah / 2], [0, X / 2]], mf)); }
      else if (fl.type === 'SO' && Yh > tf){ g.add(along(back, a.clone().negate(), [[0, od / 2], [Yh - tf, od / 2], [Yh - tf, X / 2], [0, X / 2]], mf)); }
      // taladros (cilindros oscuros en el círculo de pernos)
      var bc = dm && dm.BC ? dm.BC : (O + od) / 2 * 1.02, nb = dm && dm.nb ? dm.nb : (od < 120 ? 4 : od < 300 ? 8 : 12), u2 = G0.ref.clone().addScaledVector(a, -G0.ref.dot(a));
      if (u2.lengthSq() < 1e-6) u2 = new T.Vector3(1, 0, 0).addScaledVector(a, -a.x); u2.normalize(); var w2 = new T.Vector3().crossVectors(a, u2);
      var mh = mat(0x3b4350), rb = Math.max(6, (O - od) * 0.06);
      for (var k = 0; k < nb; k++){ var t = 2 * Math.PI * (k + 0.5) / nb, pc = back.clone().addScaledVector(u2, Math.cos(t) * bc / 2).addScaledVector(w2, Math.sin(t) * bc / 2).addScaledVector(a, -2);
        g.add(tube(pc, a, tf + 4, rb, 0, mh)); }
    }
    g.add(label(n.mark || n.id, cur.clone().addScaledVector(a, Math.max(120, O * 0.6)), Math.max(140, F.span * 0.035)));
    return g;
  }
  // ---------- soportes ----------
  function supports(prj, res, F, g){
    var L = res.loads, sp = prj.support || {}, ms = mat(COL.sup);
    if (!L || L.err) return null;
    if (!F.H && L.skirt){ var zg = L.zg, Ds = L.skirt.Ds, tk = +sp.t || 10, tb = +sp.tb || 20;
      g.add(lathe([[zg, Ds / 2 - tk], [L.sAtt, Ds / 2 - tk], [L.sAtt, Ds / 2], [zg, Ds / 2]], F.e, ms));
      g.add(lathe([[zg - tb, L.skirt.Dbi / 2], [zg, L.skirt.Dbi / 2], [zg, L.skirt.Dbo / 2], [zg - tb, L.skirt.Dbo / 2]], F.e, ms));
      var nb = Math.max(1, +sp.nb || 8), mb = mat(0x4b5563); for (var k = 0; k < nb; k++){ var rv = F.rad(360 * (k + 0.5) / nb); g.add(tube(F.P(zg - tb - 150, rv, L.skirt.BC / 2), F.e, tb + 250, 12, 0, mb)); }
      return zg - tb; }
    if (!F.H && L.legs){ var nl = L.legs.n, bl = sp.lsec === 'user' ? (+sp.lb || 100) : (+sp.lod || 168); for (var j = 0; j < nl; j++){ var r2 = F.rad(360 * j / nl + 45); g.add(tube(F.P(L.zg, r2, L.legs.Dl / 2), F.e, L.sAtt - L.zg + 300, bl / 2, sp.lsec === 'user' ? 0 : bl / 2 - (+sp.lt || 7), ms)); }
      return L.zg; }
    if (!F.H && L.lugs){ var ng = Math.max(2, +sp.nlug || 4), sh = prj.comps.filter(function(c){ return c.type === 'shell'; })[0], Ro = sh ? sh.D / 2 + sh.tn : 800;
      for (var q = 0; q < ng; q++){ var r3 = F.rad(360 * q / ng + 45), bx = new T.Mesh(new T.BoxGeometry(220, 180, 240), ms);
        bx.position.copy(F.P(L.sB + 120, r3, Ro + 110)); bx.lookAt(F.P(L.sB + 120, r3, Ro + 500)); g.add(bx); }
      return null; }
    if (F.H && sp.type === 'saddle' && L.saddle){
      var body = prj.comps.filter(function(c){ return !/ellip|tori|hemi|flat/.test(c.type); }), Lr = res.L;
      if (!body.length) return null;
      var sT0 = Math.min.apply(null, body.map(function(c){ return Lr.pos[c.id].s0; })), sT1 = Math.max.apply(null, body.map(function(c){ return Lr.pos[c.id].s1; }));
      var Ro2 = Math.max.apply(null, body.map(function(c){ return (c.D || 0) / 2 + c.tn; })) + (sp.wear ? (+sp.twp || 0) : 0), hAx = L.saddle.hAx, th = (+sp.theta || 120) * Math.PI / 180, b = +sp.b || 200;
      var Lb = sp.Lbp > 0 ? +sp.Lbp : 2 * Ro2 * Math.sin(th / 2) + 100;
      [sT0 + (+sp.A || 0), sT1 - (+sp.A || 0)].forEach(function(sc){
        var sh2 = new T.Shape(); sh2.moveTo(-Lb / 2, -hAx); sh2.lineTo(Lb / 2, -hAx); sh2.lineTo(Lb / 2, -hAx + (+sp.tbp || 20));
        var xh = Ro2 * Math.sin(th / 2), yh = -Ro2 * Math.cos(th / 2); sh2.lineTo(xh + 10, yh);
        for (var t = th / 2; t >= -th / 2; t -= th / 40) sh2.lineTo(Ro2 * Math.sin(t), -Ro2 * Math.cos(t));
        sh2.lineTo(-xh - 10, yh); sh2.lineTo(-Lb / 2, -hAx + (+sp.tbp || 20)); sh2.lineTo(-Lb / 2, -hAx);
        var ge = new T.ExtrudeGeometry(sh2, { depth: b, bevelEnabled: false }), me = new T.Mesh(ge, ms);
        // base: x de la forma → Y mundo, y de la forma → Z mundo, extrusión → eje del recipiente
        var mx = new T.Matrix4().makeBasis(new T.Vector3(0, 1, 0), new T.Vector3(0, 0, 1), F.e.clone());
        me.applyMatrix4(mx); me.position.copy(F.e.clone().multiplyScalar(sc - b / 2)); g.add(me);
      });
      return -hAx;
    }
    return null;
  }
  // ---------- construcción ----------
  function update(prj, res, sel){
    if (!ren || !res) return;
    if (root){ scene.remove(root); root.traverse(function(o){ if (o.geometry) o.geometry.dispose(); if (o.material){ if (o.material.map) o.material.map.dispose(); o.material.dispose(); } }); }
    root = new T.Group(); var F = frame(prj), Lr = res.L; F.span = Lr.smax - Lr.smin;
    prj.comps.forEach(function(c){ var p = Lr.pos[c.id], r = res.byId[c.id], on = sel.kind === 'comp' && sel.id === c.id;
      root.add(compMesh(prj, c, p, on ? COL.sel : (r && !r.ok ? COL.ko : COL.ok), F)); });
    prj.nozzles.forEach(function(n){ var host = prj.comps.filter(function(c){ return c.id === n.host; })[0]; if (!host) return;
      var rz = res.nozzles.filter(function(x){ return x.n.id === n.id; })[0], on = sel.kind === 'noz' && sel.id === n.id;
      try { root.add(nozMesh(prj, n, host, Lr.pos[host.id], on ? COL.sel : (rz && !rz.ok ? COL.ko : COL.noz), F)); } catch (e){ if (window.console) console.error(e); } });
    var gs = new T.Group(); gs.userData = { kind: 'loads', id: null }; var zgr = supports(prj, res, F, gs); root.add(gs);
    // origen y ejes
    var org = new T.Mesh(new T.SphereGeometry(18, 16, 12), new T.MeshBasicMaterial({ color: 0xe0453a })); root.add(org);
    var span = Lr.smax - Lr.smin, ax = new T.AxesHelper(Math.max(300, span * 0.12)); root.add(ax);
    // suelo
    if (grid){ scene.remove(grid); grid.geometry.dispose(); }
    var bb = new T.Box3().setFromObject(root), sz = bb.getSize(new T.Vector3()), gsz = Math.ceil(Math.max(sz.x, sz.y, sz.z) * 1.6 / 1000) * 1000;
    grid = new T.GridHelper(gsz, gsz / 500, 0x9aa3ad, 0xd5dae0); grid.rotation.x = Math.PI / 2;
    grid.position.set(0, 0, zgr != null ? zgr : bb.min.z); scene.add(grid);
    if (clip){ root.traverse(function(o){ if (o.material && !(o.material instanceof T.SpriteMaterial)) { o.material.clippingPlanes = [plane]; } }); }
    scene.add(root);
    var key = prj.design.orient + (prj.design.hdir || '') + '|' + prj.comps.length + '|' + prj.nozzles.length + '|' + Math.round(Math.max(sz.x, sz.y, sz.z) / 250);
    if (!fitted || key !== lastKey){ fit(); fitted = true; lastKey = key; }
  }
  // ---------- ratón 3D (3Dconnexion SpaceMouse / SpaceNavigator): WebHID y Gamepad API ----------
  var SM = { t: [0, 0, 0], r: [0, 0, 0], sens: 1, dev: null, name: '', btn: 0, last: 0, cb: null };
  try { SM.sens = +localStorage.getItem('asme-sm-sens') || 1; SM.inv = localStorage.getItem('asme-sm-inv') === '1'; } catch (e) {}
  var SM_VID = [0x046d, 0x256f];
  function isSM(d){ return SM_VID.indexOf(d.vendorId) >= 0 && (/3d|space|navigator|mouse|cad/i.test(d.productName || '') || d.vendorId === 0x256f); }
  function i16(dv, o){ return dv.byteLength >= o + 2 ? dv.getInt16(o, true) : 0; }
  function onReport(e){
    var dv = e.data, id = e.reportId, k = 1 / 350;
    if (id === 1){ SM.t = [i16(dv, 0) * k, i16(dv, 2) * k, i16(dv, 4) * k]; if (dv.byteLength >= 12) SM.r = [i16(dv, 6) * k, i16(dv, 8) * k, i16(dv, 10) * k]; }
    else if (id === 2) SM.r = [i16(dv, 0) * k, i16(dv, 2) * k, i16(dv, 4) * k];
    else if (id === 3){ var b = dv.byteLength ? dv.getUint8(0) : 0; if (b && !SM.btn){ if (b & 1) fit(); else if (b & 2) fit('front'); } SM.btn = b; }
    SM.last = performance.now();
  }
  function openHID(d){
    var go = d.opened ? Promise.resolve() : d.open();
    return go.then(function(){ d.removeEventListener('inputreport', onReport); d.addEventListener('inputreport', onReport); SM.dev = d; SM.name = d.productName || 'Ratón 3D'; if (SM.cb) SM.cb(SM.name); });
  }
  function connectHID(cb){
    SM.cb = cb || SM.cb;
    if (!navigator.hid) return Promise.reject(new Error('Este navegador no admite WebHID (usar Chrome o Edge en https). Se intentará como mando (Gamepad API).'));
    return navigator.hid.requestDevice({ filters: SM_VID.map(function(v){ return { vendorId: v }; }) }).then(function(ds){
      if (!ds.length) throw new Error('No se ha seleccionado ningún dispositivo');
      return openHID(ds[0]).then(function(){ return SM.name; });
    });
  }
  function pollGamepad(){
    if (SM.dev || !navigator.getGamepads) return;
    var gps = navigator.getGamepads() || [];
    for (var k = 0; k < gps.length; k++){ var g = gps[k];
      if (g && /3dconnexion|space ?(mouse|navigator|pilot)|046d.*c6|256f/i.test(g.id) && g.axes.length >= 6){
        SM.t = [g.axes[0], g.axes[1], g.axes[2]]; SM.r = [g.axes[3], g.axes[4], g.axes[5]]; SM.last = performance.now();
        if (!SM.gp){ SM.gp = g.id; if (SM.cb) SM.cb(g.id); }
        var b0 = g.buttons[0] && g.buttons[0].pressed, b1 = g.buttons[1] && g.buttons[1].pressed;
        if (b0 && !SM.b0) fit(); if (b1 && !SM.b1) fit('front'); SM.b0 = b0; SM.b1 = b1; return; } }
  }
  function dz(v){ return Math.abs(v) < 0.04 ? 0 : v; }
  function sm3d(dt){
    if (!SM.last || performance.now() - SM.last > 400) return;
    var t = SM.t.map(dz), r = SM.r.map(dz); if (!t[0] && !t[1] && !t[2] && !r[0] && !r[1] && !r[2]) return;
    var sp = SM.sens * dt, off = cam.position.clone().sub(ctl.target), dist = off.length();
    var right = new T.Vector3().setFromMatrixColumn(cam.matrixWorld, 0), up = new T.Vector3().setFromMatrixColumn(cam.matrixWorld, 1), fwd = off.clone().normalize().negate();
    // traslación: X → desplazar lateral, Z (empujar abajo/subir) → desplazar vertical, Y (empujar/tirar) → acercar/alejar
    var pan = right.clone().multiplyScalar(t[0]).addScaledVector(up, -t[2]).multiplyScalar(dist * 0.9 * sp);
    cam.position.add(pan); ctl.target.add(pan);
    var zoom = Math.exp((SM.inv ? -1 : 1) * t[1] * 1.6 * sp); off = cam.position.clone().sub(ctl.target).multiplyScalar(zoom);
    // rotación alrededor del objetivo: Rx inclinar, Rz girar, Ry balancear
    var q = new T.Quaternion();
    q.multiply(new T.Quaternion().setFromAxisAngle(right, -r[0] * 1.8 * sp));
    q.multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 0, 1), -r[2] * 1.8 * sp));
    q.multiply(new T.Quaternion().setFromAxisAngle(fwd, r[1] * 1.2 * sp));
    off.applyQuaternion(q); cam.up.applyQuaternion(new T.Quaternion().setFromAxisAngle(fwd, r[1] * 1.2 * sp));
    cam.position.copy(ctl.target).add(off); cam.lookAt(ctl.target);
  }
  function setSens(v){ SM.sens = +v || 1; try { localStorage.setItem('asme-sm-sens', String(SM.sens)); } catch (e) {} }
  function smStatus(cb){ SM.cb = cb; if (SM.name || SM.gp) cb(SM.name || SM.gp); }
  function fit(view){
    if (!root) return;
    var bb = new T.Box3().setFromObject(root), c = bb.getCenter(new T.Vector3()), r = bb.getSize(new T.Vector3()).length() / 2 || 1000;
    var dist = r / Math.sin(cam.fov * Math.PI / 360) * 1.12, dir;
    if (view === 'front') dir = new T.Vector3(0, -1, 0.0001); else if (view === 'top') dir = new T.Vector3(0.0001, -0.0001, 1); else if (view === 'side') dir = new T.Vector3(1, 0, 0.0001);
    else dir = new T.Vector3(0.9, -1.4, 0.75);
    dir.normalize(); cam.up.set(0, 0, 1); ctl.target.copy(c); cam.position.copy(c).addScaledVector(dir, dist); cam.near = dist / 200; cam.far = dist * 20; cam.updateProjectionMatrix(); ctl.update();
  }
  function setClip(on){ clip = !!on; if (root) root.traverse(function(o){ if (o.material && !(o.material instanceof T.SpriteMaterial)) o.material.clippingPlanes = clip ? [plane] : []; }); }
  function snapshot(){ if (!ren) return null; ren.render(scene, cam); try { return ren.domElement.toDataURL('image/png'); } catch (e){ return null; } }
  return { init: init, update: update, fit: fit, setClip: setClip, snapshot: snapshot, resize: resize, connectHID: connectHID, setSens: setSens, smStatus: smStatus, getSens: function(){ return SM.sens; }, setInv: function(v){ SM.inv = !!v; try { localStorage.setItem('asme-sm-inv', v ? '1' : '0'); } catch (e) {} }, getInv: function(){ return !!SM.inv; } };
})();

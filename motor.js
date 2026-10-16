/* Motor de cálculo ASME VIII-1 — generado */
/* Motor de cálculo ASME VIII-1 (2017), presión interior.
   Unidades internas: mm, MPa, N, N·mm.
   Cada función devuelve { steps:[{k,eq,v,u,ref}], checks:[{t,ok,warn}], out:{...} }.
   u: 'len' | 'p' | 's' | 'f' | 'm' | 'a' | '' (adimensional) */
var VIII = (function(){
  'use strict';
  function R(){ return { steps: [], checks: [], out: {} }; }
  function st(r, k, eq, v, u, ref){ r.steps.push({ k: k, eq: eq, v: v, u: u || '', ref: ref || '' }); return v; }
  function ck(r, t, ok, warn){ r.checks.push({ t: t, ok: !!ok, warn: !!warn }); }
  function note(r, t){ r.checks.push({ t: t, ok: true, info: true }); }
  var FM = { s: function(x){ return x.toFixed(1) + ' MPa'; }, len: function(x){ return x.toFixed(0) + ' mm'; } };
  var UG16 = 1.5; // UG-16(b): 1/16 in (1,5 mm) sin sobreespesor de corrosión

  // ---------- Tabla UG-37: K1 (interpolable) ----------
  var K1T = [[1.0,0.50],[1.2,0.57],[1.4,0.65],[1.6,0.73],[1.8,0.81],[2.0,0.90],[2.2,0.99],[2.4,1.08],[2.6,1.18],[2.8,1.27],[3.0,1.36]];
  function K1(x){
    if (x <= 1) return 0.5; if (x >= 3) return 1.36;
    for (var i = 0; i < K1T.length - 1; i++){
      if (x >= K1T[i][0] && x <= K1T[i+1][0]){
        var f = (x - K1T[i][0]) / (K1T[i+1][0] - K1T[i][0]);
        return K1T[i][1] + f * (K1T[i+1][1] - K1T[i][1]);
      }
    }
  }

  // ---------- VIROLA CILÍNDRICA: UG-27(c), Ap. 1-1, 1-2 ----------
  // i: P, S, E (junta longitudinal), Ec (junta circunferencial), D (int. u ext.), basis 'id'|'od', tn, c
  function shell(i){
    var r = R(), P = i.P, S = i.S, E = i.E, Ec = i.Ec, c = i.c || 0, tc, tl, Rr;
    if (i.basis === 'od'){
      var Ro = st(r, 'Ro', 'D_o / 2', i.D / 2, 'len');
      tc = st(r, 't (circunferencial)', 'P·Ro / (S·E + 0,4·P)', P * Ro / (S * E + 0.4 * P), 'len', 'Ap. 1-1(a) ec. (1)');
      Rr = Ro - tc;
      ck(r, 'Ap. 1-1 equivale a UG-27(c)(1): requiere t ≤ R/2 y P ≤ 0,385·S·E', P <= 0.385 * S * E && tc <= Rr / 2);
    } else {
      Rr = st(r, 'R', 'D/2 + c  (radio interior corroído)', i.D / 2 + c, 'len');
      if (P <= 0.385 * S * E){
        tc = st(r, 't (circunferencial)', 'P·R / (S·E − 0,6·P)', P * Rr / (S * E - 0.6 * P), 'len', 'UG-27(c)(1) ec. (1)');
        if (tc > Rr / 2) tc = st(r, 't (circunferencial)', 'R·[exp(P/(S·E)) − 1]   (t > R/2)', Rr * (Math.exp(P / (S * E)) - 1), 'len', 'Ap. 1-2(a) ec. (1)');
      } else {
        tc = st(r, 't (circunferencial)', 'R·[exp(P/(S·E)) − 1]   (P > 0,385·S·E)', Rr * (Math.exp(P / (S * E)) - 1), 'len', 'Ap. 1-2(a) ec. (1)');
      }
    }
    if (P <= 1.25 * S * Ec){
      tl = st(r, 't (longitudinal)', 'P·R / (2·S·Ec + 0,4·P)', P * Rr / (2 * S * Ec + 0.4 * P), 'len', 'UG-27(c)(2) ec. (2)');
    } else {
      var Z = P / (S * Ec) + 1;
      tl = st(r, 't (longitudinal)', 'R·(Z^½ − 1),  Z = P/(S·Ec) + 1', Rr * (Math.sqrt(Z) - 1), 'len', 'Ap. 1-2(b) ec. (3)');
    }
    var t = Math.max(tc, tl);
    var treq = st(r, 't requerido', 'máx(t circ., t long.) + c', t + c, 'len', 'UG-27(c), UG-25');
    var tmin = st(r, 't mínimo UG-16', '1,5 mm + c', UG16 + c, 'len', 'UG-16(b)');
    var tfin = Math.max(treq, tmin);
    r.out.treq = tfin; r.out.t = t;
    if (i.tn > 0){
      var te = i.tn - c;
      var Ri = i.basis === 'od' ? i.D / 2 - te : Rr;
      var Pc = S * E * te / (Ri + 0.6 * te), Pl = 2 * S * Ec * te / (Ri - 0.4 * te);
      st(r, 'MAWP (circunferencial)', 'S·E·t / (R + 0,6·t),  t = t_nom − c', Pc, 'p', 'UG-27(c)(1)');
      st(r, 'MAWP (longitudinal)', '2·S·Ec·t / (R − 0,4·t)', Pl, 'p', 'UG-27(c)(2)');
      r.out.mawp = st(r, 'MAWP', 'mín(circunferencial, longitudinal)', Math.min(Pc, Pl), 'p');
      ck(r, 'Espesor nominal ≥ requerido', i.tn >= tfin - 1e-9);
      r.out.ok = i.tn >= tfin - 1e-9;
    }
    note(r, 'Solo presión interior. Otras cargas (UG-22) y presión exterior (UG-28) no incluidas.');
    return r;
  }

  // ---------- FONDOS: UG-32, Ap. 1-4 ----------
  // i: type 'ellip'|'tori'|'hemi'|'cone', P,S,E, D (interior), ratio (D/2h), L, rk, alpha (grados), tn, c
  function head(i){
    var r = R(), P = i.P, S = i.S, E = i.E, c = i.c || 0, t, D = i.D + 2 * c, L;
    st(r, 'D', 'D + 2·c  (diámetro interior corroído)', D, 'len');
    if (i.type === 'ellip'){
      var q = i.ratio || 2;
      var K = st(r, 'K', '(1/6)·[2 + (D/2h)²],  D/2h = ' + q, (2 + q * q) / 6, '', 'Ap. 1-4(c)');
      t = st(r, 't', 'P·D·K / (2·S·E − 0,2·P)', P * D * K / (2 * S * E - 0.2 * P), 'len', q === 2 ? 'UG-32(c) ec. (1) / Ap. 1-4(c) ec. (1)' : 'Ap. 1-4(c) ec. (1)');
      L = K1(q) * D;
      st(r, 'L', 'K1·D,  K1 = ' + K1(q).toFixed(2) + '  (radio esférico equivalente)', L, 'len', 'Tabla UG-37');
      if (i.tn > 0) r.out.mawp = st(r, 'MAWP', '2·S·E·t / (K·D + 0,2·t),  t = t_nom − c', 2 * S * E * (i.tn - c) / (K * D + 0.2 * (i.tn - c)), 'p', 'Ap. 1-4(c) ec. (1)');
    } else if (i.type === 'tori'){
      L = st(r, 'L', 'L + c  (radio de corona interior corroído)', i.L + c, 'len');
      var rk = st(r, 'r', 'r + c  (radio de rebordeo interior corroído)', i.rk + c, 'len');
      var M = st(r, 'M', '¼·[3 + √(L/r)]', 0.25 * (3 + Math.sqrt(L / rk)), '', 'Ap. 1-4(d)');
      t = st(r, 't', 'P·L·M / (2·S·E − 0,2·P)', P * L * M / (2 * S * E - 0.2 * P), 'len', 'Ap. 1-4(d) ec. (3)');
      if (i.tn > 0){
        var Do = i.D + 2 * i.tn;
        r.out.mawp = st(r, 'MAWP', '2·S·E·t / (L·M + 0,2·t),  t = t_nom − c', 2 * S * E * (i.tn - c) / (L * M + 0.2 * (i.tn - c)), 'p', 'Ap. 1-4(d) ec. (3)');
        ck(r, 'UG-32(i): L ≤ diámetro exterior de la falda', i.L <= Do + 1e-9);
        ck(r, 'UG-32(i): r ≥ 6 % del diámetro exterior de la falda', i.rk >= 0.06 * Do - 1e-9);
        ck(r, 'UG-32(i): r ≥ 3·t', i.rk >= 3 * i.tn - 1e-9);
      }
      note(r, 'UG-32(d): si la resistencia a tracción mínima del material supera 485 MPa, usar S = 138 MPa a temperatura ambiente, reducida en proporción a la temperatura.');
    } else if (i.type === 'hemi'){
      L = st(r, 'L', 'D/2  (radio interior corroído)', D / 2, 'len');
      if (P <= 0.665 * S * E){
        t = st(r, 't', 'P·L / (2·S·E − 0,2·P)', P * L / (2 * S * E - 0.2 * P), 'len', 'UG-32(e) ec. (3)');
      } else {
        t = st(r, 't', 'L·[exp(0,5·P/(S·E)) − 1]   (P > 0,665·S·E)', L * (Math.exp(0.5 * P / (S * E)) - 1), 'len', 'Ap. 1-3 ec. (1)');
      }
      if (i.tn > 0) r.out.mawp = st(r, 'MAWP', '2·S·E·t / (L + 0,2·t),  t = t_nom − c', 2 * S * E * (i.tn - c) / (L + 0.2 * (i.tn - c)), 'p', 'UG-32(e) ec. (3)');
    } else {
      var a = i.alpha * Math.PI / 180, ca = Math.cos(a);
      t = st(r, 't', 'P·D / [2·cos α·(S·E − 0,6·P)],  α = ' + i.alpha + '°', P * D / (2 * ca * (S * E - 0.6 * P)), 'len', 'UG-32(f) ec. (4)');
      if (i.tn > 0) r.out.mawp = st(r, 'MAWP', '2·S·E·t·cos α / (D + 1,2·t·cos α),  t = t_nom − c', 2 * S * E * (i.tn - c) * ca / (D + 1.2 * (i.tn - c) * ca), 'p', 'UG-32(f) ec. (4)');
      ck(r, 'UG-32(f): semiángulo α ≤ 30° (si no, Ap. 1-5(g) o fondo toricónico)', i.alpha <= 30);
      note(r, 'Comprobar el refuerzo de la unión cono-cilindro según Ap. 1-5 (no incluido).');
      L = null;
    }
    var treq = st(r, 't requerido', 't + c', t + c, 'len', 'UG-32, UG-25');
    var tmin = st(r, 't mínimo UG-16', '1,5 mm + c', UG16 + c, 'len', 'UG-16(b)');
    var tfin = Math.max(treq, tmin);
    r.out.treq = tfin; r.out.t = t;
    if (i.tn > 0){
      ck(r, 'Espesor mínimo tras conformado ≥ requerido', i.tn >= tfin - 1e-9);
      r.out.ok = i.tn >= tfin - 1e-9;
      if (L && (i.type === 'ellip' || i.type === 'tori')){
        var rat = (i.tn - c) / L;
        ck(r, 'ts/L = ' + rat.toFixed(4) + ' ≥ 0,002 (si no, aplicar además Ap. 1-4(f))', rat >= 0.002, true);
      }
    }
    note(r, 'El espesor es el mínimo tras conformado (UG-32(a)); añadir la pérdida por conformado al pedir la chapa.');
    return r;
  }

  // ---------- JUNTA Y PERNOS: Ap. 2-5 ----------
  // g: Go (D.E. contacto), Gi (D.I. contacto), b0mode, w, T, m, y, Gfix ; bolts: n, a, Ar ; P, Sb, Sa, C
  function bolting(r, i){
    var N = st(r, 'N', '(D.E. − D.I. de contacto de la junta) / 2', (i.Go - i.Gi) / 2, 'len', 'Tabla 2-5.2');
    var w = i.w || 0, T = i.T || 0, b0, eq;
    switch (i.b0mode){
      case 'wT':  b0 = Math.min((w + T) / 2, (w + N) / 4); eq = 'mín[(w+T)/2 ; (w+N)/4]'; break;
      case 'wN4': b0 = (w + N) / 4; eq = '(w + N)/4'; break;
      case 'w3N8':b0 = (w + 3 * N) / 8; eq = '(w + 3N)/8'; break;
      case 'N4':  b0 = N / 4; eq = 'N/4'; break;
      case '3N8': b0 = 3 * N / 8; eq = '3N/8'; break;
      case '7N16':b0 = 7 * N / 16; eq = '7N/16'; break;
      case 'w8':  b0 = w / 8; eq = 'w/8'; break;
      default:    b0 = N / 2; eq = 'N/2';
    }
    st(r, 'b₀', eq, b0, 'len', 'Tabla 2-5.2');
    var b = b0 <= 6 ? b0 : 2.5 * Math.sqrt(b0);
    st(r, 'b', b0 <= 6 ? 'b₀  (b₀ ≤ 6 mm)' : '2,5·√b₀  (b₀ > 6 mm, Cb = 2,5 en SI)', b, 'len', 'Tabla 2-5.2');
    var G;
    if (i.Gfix > 0) G = st(r, 'G', 'impuesto por el usuario (p. ej. brida loca, fig. 2-4 (1))', i.Gfix, 'len', '2-3');
    else G = st(r, 'G', b0 <= 6 ? 'diámetro medio de contacto de la junta' : 'D.E. de contacto − 2·b', b0 <= 6 ? (i.Go + i.Gi) / 2 : i.Go - 2 * b, 'len', '2-3');
    var H = st(r, 'H', '0,785·G²·P', 0.785 * G * G * i.P, 'f', '2-3');
    var Hp = st(r, 'Hp', '2·b·3,14·G·m·P', 2 * b * 3.14 * G * i.m * i.P, 'f', '2-3');
    var Wm1 = st(r, 'Wm1', 'H + Hp', H + Hp, 'f', '2-5(c)(1) ec. (1)');
    var Wm2 = st(r, 'Wm2', '3,14·b·G·y', 3.14 * b * G * i.y, 'f', '2-5(c)(2) ec. (2)');
    var Am1 = st(r, 'Am1', 'Wm1 / Sb', Wm1 / i.Sb, 'a', '2-5(d)');
    var Am2 = st(r, 'Am2', 'Wm2 / Sa', Wm2 / i.Sa, 'a', '2-5(d)');
    var Am = st(r, 'Am', 'máx(Am1, Am2)', Math.max(Am1, Am2), 'a', '2-5(d)');
    var Ab = st(r, 'Ab', 'n · área de raíz = ' + i.n + ' pernos', i.n * i.Ar, 'a', '2-3');
    ck(r, 'Área de pernos Ab ≥ Am', Ab >= Am);
    var Wo = st(r, 'W (operación)', 'Wm1', Wm1, 'f', '2-5(e) ec. (4)');
    var Wg = st(r, 'W (asiento)', '(Am + Ab)·Sa / 2', (Am + Ab) * i.Sa / 2, 'f', '2-5(e) ec. (5)');
    var hG = st(r, 'hG', '(C − G) / 2', (i.C - G) / 2, 'len', 'Tabla 2-6');
    ck(r, 'La junta queda por dentro de los taladros (nota general Tabla 2-5.2)', i.Go <= i.C - i.a, true);
    return { N: N, b0: b0, b: b, G: G, H: H, Hp: Hp, Wm1: Wm1, Wm2: Wm2, Am: Am, Ab: Ab, Wo: Wo, Wg: Wg, hG: hG, okBolts: Ab >= Am };
  }

  // ---------- TAPAS PLANAS CIRCULARES: UG-34 ----------
  // i: sk (croquis), P,S,E, d, tn, c ; soldadas con m: tr, ts ; atornilladas (j,k): gasket/bolts + Sa (S a T amb.)
  var FLAT = {
    'a':   { C: 0.17, d: '(a) Fondo plano rebordeado, forjado o soldado a tope, r ≥ 3t' },
    'a10': { C: 0.10, d: '(a) Ídem, cumpliendo la longitud de pestaña Y de ec. (6)/(7)' },
    'b1':  { C: 0.17, d: '(b-1) Forjado integral, tf ≥ 2·ts, r ≥ 3·tf' },
    'b2':  { C: 0.33, m: 1, d: '(b-2) Forjado integral, C = 0,33·m ≥ 0,20' },
    'c':   { C: 0.13, d: '(c) Solapado soldado/soldadura fuerte, r ≥ 3t y Y según ec. (6)' },
    'c20': { C: 0.20, d: '(c) Solapado sin requisito sobre Y' },
    'c30': { C: 0.30, d: '(c) Placa rebordeada roscada sobre el extremo' },
    'd':   { C: 0.13, d: '(d) Integral, d ≤ 600 mm, 0,05 ≤ th/d ≤ 0,25' },
    'efg': { C: 0.33, m: 1, d: '(e)(f)(g) Placa soldada por dentro de la virola, C = 0,33·m ≥ 0,20' },
    'h':   { C: 0.33, d: '(h) Placa soldada al extremo de la virola, ts ≥ 1,25·tr' },
    'i':   { C: 0.33, m: 1, d: '(i) Con soldadura interior en ángulo, C = 0,33·m ≥ 0,20' },
    'jk':  { C: 0.30, bolted: 1, d: '(j)(k) Tapa atornillada con junta (brida ciega)' },
    'mno': { C: 0.30, d: '(m)(n)(o) Placa retenida mecánicamente' },
    'p':   { C: 0.25, d: '(p) Atornillada con junta de cara completa' },
    'q':   { C: 0.75, d: '(q) Placa roscada en el extremo, d ≤ 300 mm' },
    'rs':  { C: 0.33, d: '(r)(s) Insertada y engatillada, d ≤ 450 mm' }
  };
  function flat(i){
    var r = R(), sk = FLAT[i.sk], P = i.P, S = i.S, E = i.E, c = i.c || 0, C = sk.C, t, d = i.d;
    if (sk.m){
      var m = st(r, 'm', 'tr / ts  (espesor requerido de virola sin costura / espesor nominal de virola)', i.tr / i.ts, '', 'UG-34(b)');
      C = st(r, 'C', 'máx(0,33·m ; 0,20)', Math.max(0.33 * m, 0.20), '', 'UG-34(d), croquis ' + sk.d.split(' ')[0]);
    } else {
      st(r, 'C', 'según croquis ' + sk.d.split(' ')[0], C, '', 'UG-34(d), Fig. UG-34');
    }
    if (sk.bolted){
      var b = bolting(r, i);
      d = st(r, 'd', 'G  (diámetro de reacción de la junta)', b.G, 'len', 'Fig. UG-34 (j)(k)');
      var to = st(r, 't (operación)', 'd·√[C·P/(S·E) + 1,9·W·hG/(S·E·d³)],  W = Wm1', d * Math.sqrt(C * P / (S * E) + 1.9 * b.Wo * b.hG / (S * E * d * d * d)), 'len', 'UG-34(c)(2) ec. (2)');
      var tg = st(r, 't (asiento de junta)', 'd·√[1,9·W·hG/(Sa·E·d³)],  P = 0, W = (Am+Ab)·Sa/2', d * Math.sqrt(1.9 * b.Wg * b.hG / (i.Sf_a * E * d * d * d)), 'len', 'UG-34(c)(2) ec. (2)');
      t = Math.max(to, tg);
      r.out.okBolts = b.okBolts;
      note(r, 'Si la tapa lleva ranura para la junta (croquis k), el espesor neto bajo la ranura debe ser ≥ d·√(1,9·W·hG/(S·d³)).');
    } else {
      t = st(r, 't', 'd·√(C·P / (S·E))', d * Math.sqrt(C * P / (S * E)), 'len', 'UG-34(c)(2) ec. (1)');
    }
    var treq = st(r, 't requerido', 't + c', t + c, 'len', 'UG-34, UG-25');
    r.out.treq = treq; r.out.t = t;
    if (i.tn > 0){
      var te = i.tn - c;
      if (!sk.bolted) r.out.mawp = st(r, 'MAWP', 'S·E·(t/d)² / C,  t = t_nom − c', S * E * te * te / (d * d) / C, 'p', 'UG-34(c)(2) ec. (1)');
      ck(r, 'Espesor nominal ≥ requerido', i.tn >= treq - 1e-9);
      r.out.ok = i.tn >= treq - 1e-9 && r.out.okBolts !== false;
    }
    note(r, 'Solo tapas circulares. Aberturas en la tapa: UG-39 (no incluido).');
    return r;
  }

  // ---------- BOQUILLAS: UG-45, UG-36(c)(3), UG-37, UG-40 ----------
  var NPS = [[10.3,'NPS 1/8 (DN 6)',1.51],[13.7,'NPS 1/4 (DN 8)',1.96],[17.1,'NPS 3/8 (DN 10)',2.02],[21.3,'NPS 1/2 (DN 15)',2.42],
    [26.7,'NPS 3/4 (DN 20)',2.51],[33.4,'NPS 1 (DN 25)',2.96],[42.2,'NPS 1¼ (DN 32)',3.12],[48.3,'NPS 1½ (DN 40)',3.22],[60.3,'NPS 2 (DN 50)',3.42],
    [73.0,'NPS 2½ (DN 65)',4.52],[88.9,'NPS 3 (DN 80)',4.80],[101.6,'NPS 3½ (DN 90)',5.02],[114.3,'NPS 4 (DN 100)',5.27],[141.3,'NPS 5 (DN 125)',5.73],
    [168.3,'NPS 6 (DN 150)',6.22],[219.1,'NPS 8 (DN 200)',7.16],[273.0,'NPS 10 (DN 250)',8.11],[323.8,'≥ NPS 12 (DN 300)',8.34]];
  function ug45row(od){
    for (var k = 0; k < NPS.length; k++){ if (od <= NPS[k][0] + 0.05) return NPS[k]; }
    return NPS[NPS.length - 1];
  }
  // i: host 'cyl'|'ellip'|'ellipOut'|'tori'|'hemi', D (int. recipiente), ratio, L, t (nominal pared), Sv, c,
  //    od, tn, Sn, pipe (bool, −12,5 %), hin (proyección interior), ti, E1,
  //    pad (bool), Dp, te, Sp, leg41, leg42, leg43, access (bool)
  function nozzle(i){
    var r = R(), P = i.P, c = i.c || 0, Sv = i.Sv, Sn = i.Sn, F = 1, E1 = i.E1 || 1;
    var t = st(r, 't', 't_nom − c  (pared del recipiente, corroída)', i.t - c, 'len', 'UG-36(c)(1)');
    var tn = st(r, 'tn', 'tn_nom − c  (cuello, corroído)', i.tn - c, 'len', 'UG-37(a)');
    var d = st(r, 'd', 'D.E. − 2·tn  (abertura terminada, corroída)', i.od - 2 * tn, 'len', 'UG-37(a)');
    var Rn = d / 2, Dc = i.D + 2 * c, tr, ref;
    if (i.host === 'cyl'){
      tr = st(r, 'tr', 'P·R / (Sv·1 − 0,6·P),  R = D/2 + c,  E = 1', P * (Dc / 2) / (Sv - 0.6 * P), 'len', 'UG-37(a), UG-27(c)(1)');
    } else if (i.host === 'ellip'){
      var k1 = K1(i.ratio || 2);
      tr = st(r, 'tr', 'P·(K1·D) / (2·Sv − 0,2·P),  K1 = ' + k1.toFixed(2) + '  (abertura dentro del círculo 0,8·D)', P * k1 * Dc / (2 * Sv - 0.2 * P), 'len', 'UG-37(a) tr (c), Tabla UG-37');
    } else if (i.host === 'ellipOut'){
      var q = i.ratio || 2, K = (2 + q * q) / 6;
      tr = st(r, 'tr', 'P·D·K / (2·Sv − 0,2·P),  K = ' + K.toFixed(3) + ',  E = 1', P * Dc * K / (2 * Sv - 0.2 * P), 'len', 'UG-37(a), Ap. 1-4(c)');
    } else if (i.host === 'tori'){
      tr = st(r, 'tr', 'P·L·M / (2·Sv − 0,2·P),  M = 1  (abertura en la zona esférica)', P * (i.L + c) / (2 * Sv - 0.2 * P), 'len', 'UG-37(a) tr (a), Ap. 1-4(d)');
    } else {
      tr = st(r, 'tr', 'P·L / (2·Sv − 0,2·P),  L = D/2 + c,  E = 1', P * (Dc / 2) / (2 * Sv - 0.2 * P), 'len', 'UG-37(a), UG-32(e)');
    }
    if (i.trOverride != null){ tr = st(r, 'tr (presión exterior)', 'espesor requerido del recipiente a presión exterior (UG-37(d))', i.trOverride, 'len', 'UG-37(d)(1)'); }
    var trn = i.trnOverride != null ? st(r, 'trn (presión exterior)', 'espesor requerido del cuello a presión exterior', i.trnOverride, 'len', 'UG-37(d)(1)') : st(r, 'trn', 'P·Rn / (Sn·1 − 0,6·P),  Rn = d/2', P * Rn / (Sn - 0.6 * P), 'len', 'UG-37(a), UG-27(c)(1)');

    // --- UG-45
    var ta = st(r, 'ta', 'trn + c', trn + c, 'len', 'UG-45');
    var t45;
    if (i.access){
      t45 = st(r, 't UG-45', 'ta  (abertura de acceso o inspección)', ta, 'len', 'UG-45');
    } else {
      var tb1 = st(r, 'tb1', 'máx(tr ; 1,5 mm) + c  (pared del recipiente con E = 1)', Math.max(tr, UG16) + c, 'len', 'UG-45, UG-16(b)');
      var row = ug45row(i.od);
      var tb3 = st(r, 'tb3', 'Tabla UG-45 (' + row[1] + ') + c', row[2] + c, 'len', 'Tabla UG-45');
      var tb = st(r, 'tb', 'mín(tb3 ; tb1)  (sin presión exterior)', Math.min(tb3, tb1), 'len', 'UG-45');
      t45 = st(r, 't UG-45', 'máx(ta ; tb)', Math.max(ta, tb), 'len', 'UG-45');
    }
    var tnAvail = i.pipe ? i.tn * 0.875 : i.tn;
    if (i.pipe) st(r, 'tn disponible', '0,875·tn_nom  (tolerancia de fabricación −12,5 %)', tnAvail, 'len', 'UG-16(d)');
    var ok45 = tnAvail >= t45 - 1e-9;
    ck(r, 'UG-45: espesor del cuello ≥ t UG-45', ok45);

    // --- UG-36(b)(1) tamaño
    if (i.host === 'cyl'){
      var lim = i.D <= 1520 ? Math.min(i.D / 2, 510) : Math.min(i.D / 3, 1020);
      ck(r, 'UG-36(b)(1): d ≤ ' + FM.len(lim) + ' (si no, aplicar además Ap. 1-7)', d <= lim, true);
    }
    // --- UG-36(c)(3) exención
    var limEx = tr <= 10 ? 89 : 60;
    var exempt = d <= limEx;
    st(r, 'Límite de exención', tr <= 10 ? '89 mm  (espesor requerido ≤ 10 mm)' : '60 mm  (espesor requerido > 10 mm)', limEx, 'len', 'UG-36(c)(3)(-a)');
    if (exempt) note(r, 'UG-36(c)(3): abertura ≤ ' + FM.len(limEx) + '. No requiere cálculo de refuerzo si es conexión soldada, sin fluctuaciones rápidas de presión y respetando las separaciones entre aberturas. Se muestra el cálculo de áreas a título informativo.');

    // --- factores de resistencia
    var fr1 = Math.min(1, Sn / Sv), fr2 = fr1, Sp = i.Sp || Sv;
    var fr3 = Math.min(1, Math.min(Sn, Sp) / Sv), fr4 = Math.min(1, Sp / Sv);
    st(r, 'fr1 = fr2', 'mín(Sn/Sv ; 1)  (cuello insertado)', fr1, '', 'UG-37(a)');
    if (i.pad){ st(r, 'fr3', 'mín(Sn ; Sp)/Sv ≤ 1', fr3, '', 'UG-37(a)'); st(r, 'fr4', 'Sp/Sv ≤ 1', fr4, '', 'UG-37(a)'); }

    // --- UG-40 límites
    var te = i.pad ? i.te : 0;
    var X = st(r, 'Límite paralelo a la pared', 'máx(d ; Rn + tn + t)  a cada lado del eje', Math.max(d, Rn + tn + t), 'len', 'UG-40(b)');
    var Yl = st(r, 'Límite normal a la pared', 'mín(2,5·t ; 2,5·tn + te)', Math.min(2.5 * t, 2.5 * tn + te), 'len', 'UG-40(c)');

    // --- áreas (Fig. UG-37.1)
    var Af = i.extFactor || 1;
    var A = st(r, 'A', (Af < 1 ? '0,5·' : '') + '[d·tr·F + 2·tn·tr·F·(1 − fr1)],  F = 1', Af * (d * tr * F + 2 * tn * tr * F * (1 - fr1)), 'a', Af < 1 ? 'UG-37(d)(1)' : 'UG-37(c), Fig. UG-37.1');
    var ex = E1 * t - F * tr;
    var A1a = d * ex - 2 * tn * ex * (1 - fr1), A1b = 2 * (t + tn) * ex - 2 * tn * ex * (1 - fr1);
    var A1 = st(r, 'A1', 'máx{ d·(E1·t − F·tr) ; 2·(t + tn)·(E1·t − F·tr) } − 2·tn·(E1·t − F·tr)·(1 − fr1)', Math.max(0, Math.max(A1a, A1b)), 'a', 'Fig. UG-37.1');
    var A2;
    if (i.pad) A2 = st(r, 'A2', 'mín{ 5·(tn − trn)·fr2·t ; 2·(tn − trn)·(2,5·tn + te)·fr2 }', Math.max(0, Math.min(5 * (tn - trn) * fr2 * t, 2 * (tn - trn) * (2.5 * tn + te) * fr2)), 'a', 'Fig. UG-37.1');
    else A2 = st(r, 'A2', 'mín{ 5·(tn − trn)·fr2·t ; 5·(tn − trn)·fr2·tn }', Math.max(0, Math.min(5 * (tn - trn) * fr2 * t, 5 * (tn - trn) * fr2 * tn)), 'a', 'Fig. UG-37.1');
    var A3 = 0;
    if (i.hin > 0 && i.ti > 0){
      var ti = i.ti - 2 * c, h = i.hin - c;
      if (ti > 0 && h > 0) A3 = st(r, 'A3', 'mín{ 5·t·ti ; 5·ti² ; 2·h·ti }·fr2,  ti = ' + ti.toFixed(2) + ' mm corroído', Math.min(5 * t * ti, 5 * ti * ti, 2 * h * ti) * fr2, 'a', 'Fig. UG-37.1');
    }
    var A41 = st(r, 'A41', i.pad ? 'cateto²·fr3  (soldadura exterior del cuello)' : 'cateto²·fr2  (soldadura exterior del cuello)', (i.leg41 || 0) * (i.leg41 || 0) * (i.pad ? fr3 : fr2), 'a', 'Fig. UG-37.1');
    var A43 = i.leg43 > 0 ? st(r, 'A43', 'cateto²·fr2  (soldadura interior)', i.leg43 * i.leg43 * fr2, 'a', 'Fig. UG-37.1') : 0;
    var A42 = 0, A5 = 0;
    if (i.pad){
      A42 = st(r, 'A42', 'cateto²·fr4  (soldadura exterior del refuerzo)', (i.leg42 || 0) * (i.leg42 || 0) * fr4, 'a', 'Fig. UG-37.1');
      var Dp = Math.min(i.Dp, 2 * X);
      if (i.Dp > 2 * X) note(r, 'El diámetro del refuerzo excede los límites de UG-40: solo se acredita hasta ' + FM.len(2 * X) + '.');
      var teA = Math.min(i.te, Yl);
      if (i.te > Yl) note(r, 'El espesor del refuerzo excede el límite normal de UG-40(c): en A5 solo se acredita te = ' + FM.len(Yl) + '.');
      A5 = st(r, 'A5', '(Dp − d − 2·tn)·te·fr4,  te ≤ límite normal', Math.max(0, (Dp - d - 2 * tn) * teA * fr4), 'a', 'Fig. UG-37.1, UG-40');
    }
    var Aav = st(r, 'A disponible', i.pad ? 'A1 + A2 + A3 + A41 + A42 + A43 + A5' : 'A1 + A2 + A3 + A41 + A43', A1 + A2 + A3 + A41 + A42 + A43 + A5, 'a', 'Fig. UG-37.1');
    var okA = Aav >= A - 1e-9;
    if (exempt) ck(r, 'Refuerzo (informativo): A disponible ' + (okA ? '≥' : '<') + ' A requerida', okA, true);
    else ck(r, 'UG-37: A disponible ≥ A requerida', okA);
    r.out.A = A; r.out.Aav = Aav; r.out.t45 = t45; r.out.exempt = exempt;
    r.out.ok = ok45 && (okA || exempt);
    if (i.pad) note(r, 'UG-37(h): si el refuerzo va en segmentos sin cumplir sus condiciones, multiplicar A5 por 0,75.');
    note(r, 'No incluido: resistencia de las soldaduras de unión (UG-41, UW-15/UW-16), aberturas múltiples (UG-42) ni cargas exteriores en la boquilla.');
    return r;
  }

  // ---------- BRIDAS: Apéndice 2 ----------
  function tuyz(K){
    var K2 = K * K, lg = Math.log(K) / Math.LN10;
    return {
      T: (K2 * (1 + 8.55246 * lg) - 1) / ((1.04720 + 1.9448 * K2) * (K - 1)),
      U: (K2 * (1 + 8.55246 * lg) - 1) / (1.36136 * (K2 - 1) * (K - 1)),
      Y: (0.66845 + 5.71690 * K2 * lg / (K2 - 1)) / (K - 1),
      Z: (K2 + 1) / (K2 - 1)
    };
  }
  // Tabla 2-7.1: factores F, V, f (integral) y FL, VL (suelta con cubo)
  function hubFactors(g1g0, hh0){
    var A = g1g0 - 1, C = 43.68 * Math.pow(hh0, 4);
    var C1 = 1/3 + A/12, C2 = 5/42 + 17*A/336, C3 = 1/210 + A/360;
    var C4 = 11/360 + 59*A/5040 + (1 + 3*A)/C;
    var C5 = 1/90 + 5*A/1008 - Math.pow(1 + A, 3)/C;
    var C6 = 1/120 + 17*A/5040 + 1/C;
    var C7 = 215/2772 + 51*A/1232 + (60/7 + 225*A/14 + 75*A*A/7 + 5*A*A*A/2)/C;
    var C8 = 31/6930 + 128*A/45045 + (6/7 + 15*A/7 + 12*A*A/7 + 5*A*A*A/11)/C;
    var C9 = 533/30240 + 653*A/73920 + (1/2 + 33*A/14 + 39*A*A/28 + 25*A*A*A/84)/C;
    var C10 = 29/3780 + 3*A/704 - (1/2 + 33*A/14 + 81*A*A/28 + 13*A*A*A/12)/C;
    var C11 = 31/6048 + 1763*A/665280 + (1/2 + 6*A/7 + 15*A*A/28 + 5*A*A*A/42)/C;
    var C12 = 1/2925 + 71*A/300300 + (8/35 + 18*A/35 + 156*A*A/385 + 6*A*A*A/55)/C;
    var C13 = 761/831600 + 937*A/1663200 + (1/35 + 6*A/35 + 11*A*A/70 + 3*A*A*A/70)/C;
    var C14 = 197/415800 + 103*A/332640 - (1/35 + 6*A/35 + 17*A*A/70 + A*A*A/10)/C;
    var C15 = 233/831600 + 97*A/554400 + (1/35 + 3*A/35 + A*A/14 + 2*A*A*A/105)/C;
    var C16 = C1*C7*C12 + C2*C8*C3 + C3*C8*C2 - (C3*C3*C7 + C8*C8*C1 + C2*C2*C12);
    var C17 = (C4*C7*C12 + C2*C8*C13 + C3*C8*C9 - (C13*C7*C3 + C8*C8*C4 + C12*C2*C9)) / C16;
    var C18 = (C5*C7*C12 + C2*C8*C14 + C3*C8*C10 - (C14*C7*C3 + C8*C8*C5 + C12*C2*C10)) / C16;
    var C19 = (C6*C7*C12 + C2*C8*C15 + C3*C8*C11 - (C15*C7*C3 + C8*C8*C6 + C12*C2*C11)) / C16;
    var C20 = (C1*C9*C12 + C4*C8*C3 + C3*C13*C2 - (C3*C3*C9 + C13*C8*C1 + C12*C4*C2)) / C16;
    var C21 = (C1*C10*C12 + C5*C8*C3 + C3*C14*C2 - (C3*C3*C10 + C14*C8*C1 + C12*C5*C2)) / C16;
    var C22 = (C1*C11*C12 + C6*C8*C3 + C3*C15*C2 - (C3*C3*C11 + C15*C8*C1 + C12*C6*C2)) / C16;
    var C23 = (C1*C7*C13 + C2*C9*C3 + C4*C8*C2 - (C3*C7*C4 + C8*C9*C1 + C2*C2*C13)) / C16;
    var C24 = (C1*C7*C14 + C2*C10*C3 + C5*C8*C2 - (C3*C7*C5 + C8*C10*C1 + C2*C2*C14)) / C16;
    var C25 = (C1*C7*C15 + C2*C11*C3 + C6*C8*C2 - (C3*C7*C6 + C8*C11*C1 + C2*C2*C15)) / C16;
    var C26 = -Math.pow(C/4, 0.25);
    var C27 = C20 - C17 - 5/12 + C17*C26;
    var C28 = C22 - C19 - 1/12 + C19*C26;
    var C29 = -Math.pow(C/4, 0.5);
    var C30 = -Math.pow(C/4, 0.75);
    var C31 = 3*A/2 - C17*C30;
    var C32 = 1/2 - C19*C30;
    var C33 = 0.5*C26*C32 + C28*C31*C29 - (0.5*C30*C28 + C32*C27*C29);
    var C34 = 1/12 + C18 - C21 - C18*C26;
    var C35 = -C18*Math.pow(C/4, 0.75);
    var C36 = (C28*C35*C29 - C32*C34*C29) / C33;
    var C37 = (0.5*C26*C35 + C34*C31*C29 - (0.5*C30*C34 + C35*C27*C29)) / C33;
    var E1 = C17*C36 + C18 + C19*C37;
    var E2 = C20*C36 + C21 + C22*C37;
    var E3 = C23*C36 + C24 + C25*C37;
    var E4 = 1/4 + C37/12 + C36/4 - E3/5 - 3*E2/2 - E1;
    var E5 = E1*(1/2 + A/6) + E2*(1/4 + 11*A/84) + E3*(1/70 + A/105);
    var E6 = E5 - C36*(7/120 + A/36 + 3*A/C) - 1/40 - A/72 - C37*(1/60 + A/120 + 1/C);
    var q = Math.pow(C/2.73, 0.25), p3 = Math.pow(1 + A, 3);
    return {
      F: -E6 / (q * p3 / C),
      V: E4 / (Math.pow(2.73/C, 0.25) * p3),
      f: Math.max(1, C36 / (1 + A)),
      FL: -(C18*(1/2 + A/6) + C21*(1/4 + 11*A/84) + C24*(1/70 + A/105) - (1/40 + A/72)) / (q * p3 / C),
      VL: (1/4 - C24/5 - 3*C21/2 - C18) / (Math.pow(2.73/C, 0.25) * p3)
    };
  }

  // i: type 'integral'|'optional'|'loosehub'|'ring'|'lap', A,B,C,t,g0,g1,h, c, P,
  //    Sf_d,Sf_a,Sn_d,Sn_a,Sb,Sa, E_d,E_a (opcionales), junta + pernos (ver bolting)
  function flange(i){
    var r = R(), c = i.c || 0;
    var hub = i.type === 'integral' || i.type === 'optional' || i.type === 'loosehub';
    var integ = i.type === 'integral' || i.type === 'optional';
    var B = st(r, 'B', 'B + 2·c  (diámetro interior corroído)', i.B + 2 * c, 'len', '2-3');
    var g0 = hub ? st(r, 'g₀', 'g₀ − c', i.g0 - c, 'len', '2-3') : 0;
    var g1 = hub ? st(r, 'g₁', 'g₁ − c', i.g1 - c, 'len', '2-3') : 0;
    var A = i.A, C = i.C, t = i.t, h = i.h;
    var b = bolting(r, i), G = b.G, hG = b.hG;

    // cargas y brazos (operación)
    var HD = st(r, 'HD', '0,785·B²·P', 0.785 * B * B * i.P, 'f', '2-3');
    var HG = st(r, 'HG', 'W − H  (operación)', b.Wo - b.H, 'f', '2-3');
    var HT = st(r, 'HT', 'H − HD', b.H - HD, 'f', '2-3');
    var hD, hT;
    if (integ){
      var Rr = st(r, 'R', '(C − B)/2 − g₁', (C - B) / 2 - g1, 'len', '2-3');
      hD = st(r, 'hD', 'R + 0,5·g₁', Rr + 0.5 * g1, 'len', 'Tabla 2-6');
      hT = st(r, 'hT', '(R + g₁ + hG)/2', (Rr + g1 + hG) / 2, 'len', 'Tabla 2-6');
    } else if (i.type === 'lap'){
      hD = st(r, 'hD', '(C − B)/2', (C - B) / 2, 'len', 'Tabla 2-6');
      hT = st(r, 'hT', '(C − G)/2', (C - G) / 2, 'len', 'Tabla 2-6');
    } else {
      hD = st(r, 'hD', '(C − B)/2', (C - B) / 2, 'len', 'Tabla 2-6');
      hT = st(r, 'hT', '(hD + hG)/2', (hD + hG) / 2, 'len', 'Tabla 2-6');
    }
    var MD = st(r, 'MD', 'HD·hD', HD * hD, 'm', '2-3');
    var MT = st(r, 'MT', 'HT·hT', HT * hT, 'm', '2-3');
    var MG = st(r, 'MG', 'HG·hG', HG * hG, 'm', '2-3');
    var Mop = st(r, 'Mo (operación)', 'MD + MT + MG', MD + MT + MG, 'm', '2-6');
    var Mgs = st(r, 'Mo (asiento)', 'W·(C − G)/2', b.Wg * (C - G) / 2, 'm', '2-6 ec. (6)');

    // separación de pernos
    var Bs = st(r, 'Bs', 'π·C / n', Math.PI * C / i.n, 'len', '2-3');
    var Bsc = 1;
    if (Bs > 2 * i.a + t) Bsc = st(r, 'Bsc', '√[Bs / (2a + t)]   (Bs > 2a + t)', Math.sqrt(Bs / (2 * i.a + t)), '', '2-6 ec. (7)');
    st(r, 'Bs máx', '2a + 6t/(m + 0,5)', 2 * i.a + 6 * t / (i.m + 0.5), 'len', '2-5(d) ec. (3)');
    ck(r, 'Separación de pernos Bs ≤ Bs máx (obligatorio en servicio letal o si lo exige el usuario)', Bs <= 2 * i.a + 6 * t / (i.m + 0.5), true);

    // factores
    var K = st(r, 'K', 'A / B', A / B, '', '2-3');
    var k = tuyz(K);
    st(r, 'T', 'Fig. 2-7.1', k.T, '', 'Fig. 2-7.1'); st(r, 'U', 'Fig. 2-7.1', k.U, '', 'Fig. 2-7.1');
    st(r, 'Y', 'Fig. 2-7.1', k.Y, '', 'Fig. 2-7.1'); st(r, 'Z', '(K² + 1)/(K² − 1)', k.Z, '', 'Fig. 2-7.1');
    var L = null, e = 0, f = 1, V = null, h0 = 0;
    if (hub){
      h0 = st(r, 'h₀', '√(B·g₀)', Math.sqrt(B * g0), 'len', '2-3');
      st(r, 'g₁/g₀', '', g1 / g0, ''); st(r, 'h/h₀', '', h / h0, '');
      var hf = g1 / g0 > 1.000001 ? hubFactors(g1 / g0, h / h0) : { F: 0.908920, V: 0.550103, f: 1, FL: null, VL: null };
      if (!integ && hf.FL === null) hf = hubFactors(1.000001, h / h0);
      var Fv;
      if (integ){
        Fv = st(r, 'F', 'Tabla 2-7.1 (Fig. 2-7.2)', hf.F, '', 'Tabla 2-7.1');
        V = st(r, 'V', 'Tabla 2-7.1 (Fig. 2-7.3)', hf.V, '', 'Tabla 2-7.1');
        f = st(r, 'f', 'Tabla 2-7.1 (Fig. 2-7.6), mín. 1', hf.f, '', 'Tabla 2-7.1');
      } else {
        Fv = st(r, 'FL', 'Tabla 2-7.1 (Fig. 2-7.4)', hf.FL, '', 'Tabla 2-7.1');
        V = st(r, 'VL', 'Tabla 2-7.1 (Fig. 2-7.5)', hf.VL, '', 'Tabla 2-7.1');
        st(r, 'f', '1  (brida suelta con cubo)', 1, '', 'Tabla 2-7.1');
      }
      e = st(r, 'e', integ ? 'F / h₀' : 'FL / h₀', Fv / h0, '', '2-3');
      var dd = st(r, 'd', integ ? '(U/V)·h₀·g₀²' : '(U/VL)·h₀·g₀²', k.U / V * h0 * g0 * g0, '', '2-3');
      L = st(r, 'L', '(t·e + 1)/T + t³/d', (t * e + 1) / k.T + t * t * t / dd, '', '2-3');
    }

    // tensiones en ambas condiciones
    function stress(tag, Mo, Sf, Sn){
      var M = Mo * Bsc, SH = 0, SR = 0, ST, o = {};
      if (hub){
        SH = st(r, 'SH (' + tag + ')', 'f·Mo / (L·g₁²·B)', f * M / (L * g1 * g1 * B), 's', '2-7 ec. (8)');
        SR = st(r, 'SR (' + tag + ')', '(1,33·t·e + 1)·Mo / (L·t²·B)', (1.33 * t * e + 1) * M / (L * t * t * B), 's', '2-7 ec. (9)');
        ST = st(r, 'ST (' + tag + ')', 'Y·Mo/(t²·B) − Z·SR', k.Y * M / (t * t * B) - k.Z * SR, 's', '2-7 ec. (10)');
      } else {
        ST = st(r, 'ST (' + tag + ')', 'Y·Mo / (t²·B);  SR = SH = 0', k.Y * M / (t * t * B), 's', '2-7 ec. (11)');
      }
      var limH = 1.5 * Sf, limTxt = '1,5·Sf';
      if (i.type === 'integral'){ limH = Math.min(1.5 * Sf, 2.5 * Sn); limTxt = 'mín(1,5·Sf ; 2,5·Sn)'; }
      else if (i.type === 'optional'){ limH = Math.min(1.5 * Sf, 1.5 * Sn); limTxt = 'mín(1,5·Sf ; 1,5·Sn)'; }
      o.ok = true;
      function c1(txt, val, lim){ var ok = val <= lim + 1e-9; o.ok = o.ok && ok; ck(r, tag + ': ' + txt + ' → ' + FM.s(val) + (ok ? ' ≤ ' : ' > ') + FM.s(lim), ok); }
      if (hub){
        c1('SH ≤ ' + limTxt, SH, limH);
        c1('SR ≤ Sf', SR, Sf);
      }
      c1('ST ≤ Sf', ST, Sf);
      if (hub){
        c1('(SH + SR)/2 ≤ Sf', (SH + SR) / 2, Sf);
        c1('(SH + ST)/2 ≤ Sf', (SH + ST) / 2, Sf);
      }
      o.SH = SH; o.SR = SR; o.ST = ST;
      return o;
    }
    var so = stress('operación', Mop, i.Sf_d, i.Sn_d);
    var sg = stress('asiento', Mgs, i.Sf_a, i.Sn_a);

    // rigidez 2-14
    var okJ = true;
    function rig(tag, Mo, E){
      if (!(E > 0)){ ck(r, 'Rigidez (' + tag + '): no evaluada, falta el módulo de elasticidad E (II-D, Tabla TM)', false, true); return; }
      var J, eq;
      if (integ){ J = 52.14 * V * Mo / (L * E * g0 * g0 * 0.3 * h0); eq = '52,14·V·Mo / (L·E·g₀²·KI·h₀),  KI = 0,3'; }
      else if (i.type === 'loosehub'){ J = 52.14 * V * Mo / (L * E * g0 * g0 * 0.2 * h0); eq = '52,14·VL·Mo / (L·E·g₀²·KL·h₀),  KL = 0,2'; }
      else { J = 109.4 * Mo / (E * t * t * t * 0.2 * Math.log(K)); eq = '109,4·Mo / (E·t³·KL·ln K),  KL = 0,2'; }
      st(r, 'J (' + tag + ')', eq, J, '', '2-14, Tabla 2-14');
      var ok = J <= 1 + 1e-9; okJ = okJ && ok;
      ck(r, 'Rigidez (' + tag + '): J = ' + J.toFixed(3) + ' ≤ 1', ok);
    }
    rig('operación', Mop, i.E_d); rig('asiento', Mgs, i.E_a);

    if (i.type === 'optional'){
      ck(r, '2-4(c): brida opcional; puede calcularse como suelta solo si g₀ ≤ 16 mm, B/g₀ ≤ 300, P ≤ 2 MPa y T ≤ 370 °C', true, true);
    }
    if (hub) ck(r, 'Fig. 2-4: longitud del cubo h ≥ 1,5·g₀ (croquis 6)', i.type !== 'integral' || h >= 1.5 * g0 - 1e-9, true);
    r.out.ok = b.okBolts && so.ok && sg.ok && okJ;
    r.out.so = so; r.out.sg = sg; r.out.Mop = Mop; r.out.Mgs = Mgs; r.out.Am = b.Am; r.out.Ab = b.Ab;
    note(r, 'El espesor t no incluye resaltes ni ranuras de más de 1,5 mm (Fig. 2-4, nota 4). No incluido: presión exterior (2-11), tensión cortante en soldaduras o solapas (2-8(c)) ni bridas partidas, no circulares o inversas.');
    return r;
  }

  return { setFmt: function(f){ FM = f; }, shell: shell, head: head, flat: flat, FLAT: FLAT, nozzle: nozzle, flange: flange, tuyz: tuyz, hubFactors: hubFactors, K1: K1, NPS: NPS };
})();

/* ===================================================================
   Extensiones del motor: presión exterior (UG-28/UG-33 + II-D Subparte 3),
   MDMT (UCS-66, UCS-66.1, UG-20(f), UHA-51, UNF-65), bridas B16.5,
   materiales y modelo de recipiente (MAWP, MAP, MAEP, prueba hidrostática).
   Unidades internas: mm, MPa, N, °C.
   =================================================================== */
var VESSEL = (function(){
  'use strict';
  var G0 = (typeof window !== 'undefined') ? window : global;
  var NOR = G0.ASME_NORMAS, MATS = G0.ASME_MATERIALS;
  var BYID = {}; MATS.forEach(function(m){ BYID[m.id] = m; });
  var RHO_STEEL = { def: 7850, '8': 7930, '10H': 7800, al: 2700, cu: 8900, ni: 8500, ti: 4510 };

  function R(){ return { steps: [], checks: [], out: {} }; }
  function st(r, k, eq, v, u, ref){ r.steps.push({ k: k, eq: eq, v: v, u: u || '', ref: ref || '' }); return v; }
  function ck(r, t, ok, warn){ r.checks.push({ t: t, ok: !!ok, warn: !!warn }); }
  function note(r, t){ r.checks.push({ t: t, ok: true, info: true }); }
  function lerp(x, x0, x1, y0, y1){ return x1 === x0 ? y0 : y0 + (y1 - y0) * (x - x0) / (x1 - x0); }
  function llerp(x, x0, x1, y0, y1){ // interpolación log-log
    if (x0 <= 0 || x1 <= 0 || y0 <= 0 || y1 <= 0) return lerp(x, x0, x1, y0, y1);
    return Math.exp(lerp(Math.log(x), Math.log(x0), Math.log(x1), Math.log(y0), Math.log(y1)));
  }
  function bisect(f, lo, hi, n){ // máximo x en [lo,hi] con f(x) verdadero (f monótona decreciente)
    if (!f(lo)) return null;
    if (f(hi)) return hi;
    for (var k = 0; k < (n || 50); k++){ var m = (lo + hi) / 2; if (f(m)) lo = m; else hi = m; }
    return lo;
  }

  // ---------------- MATERIALES ----------------
  function decFor(x){ return x >= 100 ? 0 : (x >= 10 ? 1 : 2); }
  function sAt(v, T){
    var p = v.p, tm = v.tm;
    if (T > tm + 1e-9) return { S: NaN, over: true, tm: tm };
    var t = Math.max(T, p[0][0]);
    for (var k = 0; k < p.length - 1; k++){
      if (t >= p[k][0] && t <= p[k+1][0]){
        var f = (t - p[k][0]) / (p[k+1][0] - p[k][0]);
        var s = p[k][1] + f * (p[k+1][1] - p[k][1]);
        if (f > 0 && f < 1){ var d = decFor(p[k+1][1]); s = Math.round(s * Math.pow(10, d)) / Math.pow(10, d); }
        return { S: s, over: false, tm: tm };
      }
    }
    return { S: p[p.length-1][1], over: false, tm: tm };
  }
  // ref = { id, vi, Sman?, Saman? }
  function mat(ref, T){
    var m = BYID[ref && ref.id]; if (!m) return null;
    var v = m.v[ref.vi || 0] || m.v[0];
    var sd = sAt(v, T), sa = sAt(v, 40);
    var o = { m: m, v: v, id: m.id, name: m.t + (m.v.length > 1 ? ' — ' + v.l : ''), ref: v.ref,
      S: ref.Sman > 0 ? ref.Sman : sd.S, Sa: ref.Saman > 0 ? ref.Saman : sa.S, over: sd.over, tm: v.tm,
      ch: v.ch || null, ty: v.ty || null, pno: m.pno || '', grp: m.grp || null };
    var p = (m.pno || '').split(' ')[0];
    o.family = /^(1|3|4|5A|5B|5C|9A|9B|10A|10B|10C|11A|15E)$/.test(p) ? 'UCS' : p === '8' ? 'UHA8' : /^10[H-K]$/.test(p) ? 'UHAF' :
      /^2[1-5]$/.test(p) ? 'AL' : /^3[1-5]$/.test(p) ? 'CU' : /^4[1-7]$/.test(p) ? 'NI' : /^5[1-3]$/.test(p) ? 'TI' : (m.cat === 'pernos' ? 'BOLT' : 'OTRO');
    o.rho = o.family === 'AL' ? RHO_STEEL.al : o.family === 'CU' ? RHO_STEEL.cu : o.family === 'NI' ? RHO_STEEL.ni : o.family === 'TI' ? RHO_STEEL.ti : p === '8' ? RHO_STEEL['8'] : RHO_STEEL.def;
    return o;
  }

  // ---------------- PRESIÓN EXTERIOR: Tabla G y cartas ----------------
  var GK = Object.keys(NOR.G).map(Number).sort(function(a, b){ return a - b; });
  function curveA(key, LDo){
    var p = NOR.G[String(key)];
    if (LDo <= p[0][0]) return p[0][1];
    if (LDo >= p[p.length-1][0]) return p[p.length-1][1];
    for (var k = 0; k < p.length - 1; k++){
      if (LDo >= p[k][0] && LDo <= p[k+1][0]) return llerp(LDo, p[k][0], p[k+1][0], p[k][1], p[k+1][1]);
    }
  }
  function factorA(LDo, Dot){
    LDo = Math.min(50, Math.max(0.05, LDo));
    if (Dot > GK[GK.length-1]) return NaN;
    var d0 = GK[0], d1 = GK[0];
    if (Dot <= GK[0]) return curveA(GK[0], LDo);
    for (var k = 0; k < GK.length - 1; k++){ if (Dot >= GK[k] && Dot <= GK[k+1]){ d0 = GK[k]; d1 = GK[k+1]; break; } }
    return Math.min(0.1, llerp(Dot, d0, d1, curveA(d0, LDo), curveA(d1, LDo)));
  }
  function evalCurve(p, A){
    var E = 2 * p[0][1] / p[0][0];
    if (A <= p[0][0]) return { B: A * E / 2, left: true, E: E };
    if (A >= p[p.length-1][0]) return { B: p[p.length-1][1], E: E };
    for (var k = 0; k < p.length - 1; k++){
      if (A >= p[k][0] && A <= p[k+1][0]) return { B: llerp(A, p[k][0], p[k+1][0], p[k][1], p[k+1][1]), E: E };
    }
  }
  // Devuelve { B, E, Sy (2·B extremo derecho), left, err }
  function factorB(chart, T, A, ys){
    var C = NOR.CH[chart];
    if (!C) return { err: 'Carta ' + chart + ' no disponible en este programa' };
    var keys = Object.keys(C);
    if (chart === 'CS-3'){ // curvas por límite elástico
      var yk = keys.map(Number).sort(function(a, b){ return a - b; }), pick = yk[0];
      yk.forEach(function(y){ if (ys >= y) pick = y; });
      var e3 = evalCurve(C[String(pick)], A), p3 = C[String(pick)];
      return { B: e3.B, E: e3.E, left: e3.left, Sy: 2 * p3[p3.length-1][1], curve: 'σy ' + pick + ' MPa' };
    }
    // varias curvas a la misma temperatura (p. ej. NFA-11): se toma la más baja
    var byT = {};
    keys.forEach(function(k){ var t = +k.split(':')[0]; (byT[t] = byT[t] || []).push(C[k]); });
    var Ts = Object.keys(byT).map(Number).sort(function(a, b){ return a - b; });
    function atT(t){
      var best = null;
      byT[t].forEach(function(p){
        var e = evalCurve(p, A), sy = 2 * p[p.length-1][1];
        if (!best || e.B < best.B) best = { B: e.B, E: e.E, left: e.left, Sy: sy };
      });
      return best;
    }
    if (T > Ts[Ts.length-1] + 1e-9) return { err: 'T = ' + T + ' °C supera la máxima de la carta ' + chart + ' (' + Ts[Ts.length-1] + ' °C)' };
    if (T <= Ts[0]) { var b0 = atT(Ts[0]); b0.curve = Ts[0] + ' °C'; return b0; }
    for (var k = 0; k < Ts.length - 1; k++){
      if (T >= Ts[k] && T <= Ts[k+1]){
        var a = atT(Ts[k]), b = atT(Ts[k+1]);
        return { B: lerp(T, Ts[k], Ts[k+1], a.B, b.B), E: lerp(T, Ts[k], Ts[k+1], a.E, b.E), Sy: lerp(T, Ts[k], Ts[k+1], a.Sy, b.Sy),
          left: a.left && b.left, curve: 'interpolada ' + Ts[k] + '–' + Ts[k+1] + ' °C' };
      }
    }
  }

  // Cilindro a presión exterior UG-28(c). i: Do, t (corroído), L, chart, T, S, ys
  function cylPa(i, r){
    var Dot = i.Do / i.t, LDo = i.L / i.Do, A, B, fb, Pa;
    if (Dot < 4) A = Math.min(0.1, 1.1 / (Dot * Dot));
    else A = factorA(LDo, Dot);
    if (isNaN(A)) return { err: 'Do/t = ' + Dot.toFixed(0) + ' fuera de la Tabla G (máx. 1000)' };
    fb = factorB(i.chart, i.T, A, i.ys);
    if (fb.err) return { err: fb.err };
    B = fb.B;
    var o = { A: A, B: B, Dot: Dot, LDo: LDo, fb: fb };
    if (Dot >= 10){
      o.Pa = 4 * B / (3 * Dot);
    } else {
      var Pa1 = (2.167 / Dot - 0.0833) * B;
      var S2 = Math.min(2 * i.S, 0.9 * fb.Sy);
      var Pa2 = 2 * S2 / Dot * (1 - 1 / Dot);
      o.Pa = Math.min(Pa1, Pa2); o.Pa1 = Pa1; o.Pa2 = Pa2; o.S2 = S2;
    }
    if (r){
      st(r, 'Do/t', 'Do / t,  Do = ' + i.Do.toFixed(1) + ' mm (sin corrosión), t = ' + i.t.toFixed(2) + ' mm (corroído)', Dot, '', 'UG-28(c)');
      st(r, 'L/Do', 'L = ' + i.L.toFixed(0) + ' mm, entrada limitada a 0,05–50', LDo, '', 'UG-28(c)(1) paso 2');
      st(r, 'A', Dot < 4 ? '1,1 / (Do/t)²' : 'Fig. G (Tabla G de II-D, interpolación log-log)', A, '', 'II-D Subparte 3, Tabla G');
      st(r, 'B', 'Carta ' + i.chart + ', ' + fb.curve + (fb.left ? ' — A a la izquierda de la curva: B = A·E/2' : ''), B, 's', 'II-D Subparte 3, Tabla ' + i.chart);
      if (Dot >= 10) st(r, 'Pa', fb.left ? '2·A·E / [3·(Do/t)],  E = ' + fb.E.toFixed(0) + ' MPa' : '4·B / [3·(Do/t)]', o.Pa, 'p', fb.left ? 'UG-28(c)(1) paso 7' : 'UG-28(c)(1) paso 6');
      else {
        st(r, 'Pa1', '[2,167/(Do/t) − 0,0833]·B', o.Pa1, 'p', 'UG-28(c)(2) paso 2');
        st(r, 'Pa2', '2·S/(Do/t)·[1 − 1/(Do/t)],  S = mín(2·S ; 0,9·Sy) = ' + o.S2.toFixed(1), o.Pa2, 'p', 'UG-28(c)(2) paso 3');
        st(r, 'Pa', 'mín(Pa1 ; Pa2)', o.Pa, 'p', 'UG-28(c)(2) paso 4');
      }
    }
    return o;
  }
  function sphPa(i, r){ // UG-28(d): Ro, t, chart, T
    var A = 0.125 / (i.Ro / i.t), fb = factorB(i.chart, i.T, A, i.ys);
    if (fb.err) return { err: fb.err };
    var Pa = fb.B / (i.Ro / i.t);
    if (r){
      st(r, 'A', '0,125 / (Ro/t),  Ro = ' + i.Ro.toFixed(1) + ' mm', A, '', 'UG-28(d) paso 1');
      st(r, 'B', 'Carta ' + i.chart + ', ' + fb.curve + (fb.left ? ' — A a la izquierda: B = A·E/2' : ''), fb.B, 's', 'II-D Subparte 3');
      st(r, 'Pa', fb.left ? '0,0625·E / (Ro/t)²' : 'B / (Ro/t)', Pa, 'p', 'UG-28(d)');
    }
    return { A: A, B: fb.B, Pa: Pa, fb: fb };
  }
  // espesor mínimo a presión exterior (bisección sobre t)
  function treqExt(fn, Pe, tmax){
    var f = function(t){ var o = fn(t); return o && !o.err && o.Pa >= Pe; };
    var lo = 0.05, hi = Math.max(tmax * 6, 50);
    if (!f(hi)) return null;
    for (var k = 0; k < 60; k++){ var m = (lo + hi) / 2; if (f(m)) hi = m; else lo = m; }
    return hi;
  }
  var KO = [[1.0,0.50],[1.2,0.57],[1.4,0.65],[1.6,0.73],[1.8,0.81],[2.0,0.90],[2.2,0.99],[2.4,1.08],[2.6,1.18],[2.8,1.27],[3.0,1.36]];
  function Ko(x){ x = Math.max(1, Math.min(3, x)); for (var k = 0; k < KO.length - 1; k++){ if (x >= KO[k][0] && x <= KO[k+1][0]) return lerp(x, KO[k][0], KO[k+1][0], KO[k][1], KO[k+1][1]); } return 1.36; }

  // ---------------- MDMT ----------------
  function ucsCurve(curve, tg){
    var T = NOR.UCS66, col = { A: 1, B: 2, C: 3, D: 4 }[curve];
    if (tg <= T[0][0]) return T[0][col];
    if (tg >= T[T.length-1][0]) return T[T.length-1][col];
    for (var k = 0; k < T.length - 1; k++){ if (tg >= T[k][0] && tg <= T[k+1][0]) return lerp(tg, T[k][0], T[k+1][0], T[k][col], T[k+1][col]); }
  }
  // Fig. UCS-66.1M digitalizada (cociente → reducción en °C)
  var RED = [[1.0,0],[0.9,5.6],[0.8,11.1],[0.7,16.7],[0.6,22.2],[0.5,32.2],[0.43,44.4],[0.39,55.6],[0.37,66.7],[0.35,77.8]];
  function reduction(ratio){
    if (ratio >= 1) return 0;
    for (var k = 0; k < RED.length - 1; k++){ if (ratio <= RED[k][0] && ratio >= RED[k+1][0]) return lerp(ratio, RED[k][0], RED[k+1][0], RED[k][1], RED[k+1][1]); }
    return 77.8;
  }
  // i: mat (de mat()), tg, ratio (tr·E*/(tn−c)), welded, normalized, pwhtVol, ug20f (bool cumple condiciones), MDMTreq
  function mdmt(i){
    var r = R(), m = i.mat, fam = m.family, res = null, curve;
    var pnoMain = (m.pno || '').split(' ')[0];
    if (fam === 'UCS' || (fam === 'OTRO' && m.m.ucs)){
      curve = (i.normalized && m.m.ucsN) ? m.m.ucsN : m.m.ucs;
      if (!curve){ ck(r, 'Material sin curva de exención asignada en este programa: ensayo de impacto o asignación manual', false, true); return { r: r, mdmt: null }; }
      if (curve === 'IMPACT'){ ck(r, 'Fundición no incluida en las notas (1)-(2) de la Fig. UCS-66: requiere ensayo de impacto (nota (f))', false, true); return { r: r, mdmt: null, impact: true }; }
      st(r, 'Curva', 'Fig. UCS-66, notas (1)–(4)' + (i.normalized && m.m.ucsN ? ' (normalizado)' : ''), curve, '', 'UCS-66(a)');
      st(r, 'tg', 'espesor de gobierno', i.tg, 'len', 'UCS-66(a)(1)');
      var t1 = st(r, 'MDMT curva', 'Tabla UCS-66 (SI), curva ' + curve, ucsCurve(curve, i.tg), 't', 'Tabla UCS-66');
      if (i.tg > 100 && i.welded) ck(r, 'UCS-66(a)(1)(-a)(-5): tg > 100 mm en unión soldada con MDMT < 50 °C exige material ensayado al impacto', false, true);
      res = t1;
      if (i.pwhtVol && pnoMain === '1'){ res = st(r, 'MDMT con TTPS', 'MDMT − 17 °C (30 °F) por TTPS no exigido', res - 17, 't', 'UCS-68(c)'); }
      if (i.ratio != null && i.ratio < 1){
        st(r, 'Rts', 'tr·E* / (tn − c),  E* = máx(E ; 0,80)', i.ratio, '', 'Fig. UCS-66.2, nota (3)');
        if (i.ratio <= 0.35){
          res = st(r, 'MDMT', 'Rts ≤ 0,35: exento de ensayo hasta −105 °C', -105, 't', 'UCS-66(b)(3)');
        } else {
          var dT = st(r, 'ΔT', 'Fig. UCS-66.1M (curva digitalizada)', reduction(i.ratio), 'dt', 'UCS-66(b)(1)(-a)');
          res = st(r, 'MDMT reducida', 'MDMT − ΔT', res - dT, 't', 'UCS-66(b)(1)');
          if (res < -48){ res = st(r, 'MDMT límite', 'la reducción de UCS-66(b)(1) no baja de −48 °C', -48, 't', 'UCS-66(b)(1)(-a), UCS-66(b)(2)'); }
        }
      }
      if (i.ug20f){
        var lim = curve === 'A' ? 13 : 25;
        var okf = /^1 Gr [12]$/.test(m.pno) && i.tg <= lim;
        if (okf && res > -29){ res = st(r, 'MDMT UG-20(f)', 'P-No. 1 Gr. 1/2, tg ≤ ' + lim + ' mm, prueba hidrostática, −29 ≤ T ≤ 345 °C', -29, 't', 'UG-20(f)'); }
      }
    } else if (fam === 'UHA8'){
      if (m.m.cast){ res = st(r, 'MDMT', 'Fundición austenítica: exenta a −29 °C y más', -29, 't', 'UHA-51(d)(1)(-c)'); }
      else {
        var base = -196;
        st(r, 'MDMT metal base', 'Austenítico Cr-Ni con C ≤ 0,10 %: exento a −196 °C', base, 't', 'UHA-51(d)(1)(-a)');
        res = base;
        if (i.welded){ res = st(r, 'MDMT metal de aporte', 'Soldaduras SFA-5.4/5.9/5.11/5.14/5.22 con C ≤ 0,10 %: exentas a −104 °C', -104, 't', 'UHA-51(e)(2)(-a)'); }
      }
    } else if (fam === 'UHAF'){
      if (i.tg <= 10) res = st(r, 'MDMT', 'Dúplex con espesor ≤ 10 mm: exento a −29 °C', -29, 't', 'UHA-51(d)(3)(-a)');
      else { ck(r, 'Dúplex con espesor > 10 mm: requiere ensayo de impacto (UHA-51)', false, true); return { r: r, mdmt: null, impact: true }; }
    } else if (fam === 'AL'){ res = st(r, 'MDMT', 'Aleaciones de aluminio forjadas: −269 °C', -269, 't', 'UNF-65'); }
    else if (fam === 'CU' || fam === 'NI'){ res = st(r, 'MDMT', 'Cobre, níquel y sus aleaciones: −198 °C', -198, 't', 'UNF-65'); }
    else if (fam === 'TI'){ res = st(r, 'MDMT', 'Titanio y sus aleaciones: −59 °C', -59, 't', 'UNF-65'); }
    else if (fam === 'BOLT'){
      var bt = { sa193b7: -48, sa193b7m: -48, sa193b16: -29 }[m.id];
      if (m.id === 'sa193b7' && i.tg > 64) bt = -40;
      if (bt != null) res = st(r, 'MDMT pernos', 'Fig. UCS-66, nota general (c)', bt, 't', 'Fig. UCS-66 nota (c)');
      else { note(r, 'Pernos: ver Fig. UCS-66 nota (c) / Fig. UG-84.1 nota (c) o UHA-51 según el material.'); return { r: r, mdmt: null }; }
    } else { note(r, 'Familia de material sin reglas de MDMT en este programa.'); return { r: r, mdmt: null }; }
    if (i.MDMTreq != null){
      var ok = res <= i.MDMTreq + 1e-9;
      ck(r, ok ? 'MDMT sin ensayo de impacto ' + res.toFixed(0) + ' °C ≤ MDMT requerida ' + i.MDMTreq + ' °C' : 'Requiere ensayo de impacto: MDMT alcanzable ' + res.toFixed(0) + ' °C > requerida ' + i.MDMTreq + ' °C', ok);
    }
    return { r: r, mdmt: res };
  }

  // ---------------- B16.5 ----------------
  var CLASSES = [150, 300, 400, 600, 900, 1500, 2500];
  function b165rating(grp, cls, T){
    var g = NOR.B165R[grp]; if (!g) return null;
    var rows = g.si, ci = CLASSES.indexOf(+cls) + 1;
    if (ci < 1) return null;
    if (T <= rows[0][0]) return rows[0][ci] / 10;
    for (var k = 0; k < rows.length - 1; k++){
      if (T >= rows[k][0] && T <= rows[k+1][0]){
        if (rows[k][ci] == null || rows[k+1][ci] == null) return null;
        return lerp(T, rows[k][0], rows[k+1][0], rows[k][ci], rows[k+1][ci]) / 10;
      }
    }
    return null;
  }
  function b165dims(cls, nps){
    var d = NOR.B165D[String(cls)] || {};
    if (d[nps]) return d[nps];
    var fb = { 400: 600, 900: 1500 }[cls];
    return fb ? (NOR.B165D[String(fb)] || {})[nps] || null : null;
  }
  var NPSLIST = ['1/2','3/4','1','1 1/4','1 1/2','2','2 1/2','3','3 1/2','4','5','6','8','10','12','14','16','18','20','24'];

  return { mat: mat, sAt: sAt, BYID: BYID, factorA: factorA, factorB: factorB, cylPa: cylPa, sphPa: sphPa, treqExt: treqExt, Ko: Ko,
    ucsCurve: ucsCurve, reduction: reduction, mdmt: mdmt, b165rating: b165rating, b165dims: b165dims, CLASSES: CLASSES, NPSLIST: NPSLIST,
    bisect: bisect, lerp: lerp, R: R, st: st, ck: ck, note: note };
})();

/* ===================================================================
   Modelo de recipiente: geometría a lo largo del eje, presiones por
   componente (columna hidrostática), eficiencias de junta (UW-11/UW-12),
   cálculo de cada componente, boquillas, MAWP/MAP/MAEP del conjunto,
   prueba hidrostática (UG-99), MDMT del conjunto y requisitos de END.
   =================================================================== */
var VMODEL = (function(){
  'use strict';
  var V = VESSEL, C = VIII;
  var G = 9.80665;
  function hyd(rho, h){ return rho * G * Math.max(0, h) * 1e-9; } // MPa (h en mm)
  function num(x, d){ return (x === null || x === undefined || x === '' || isNaN(+x)) ? d : +x; }

  var TYPES = {
    shell: 'Virola', ellip: 'Fondo elíptico', tori: 'Fondo torisférico', hemi: 'Fondo hemisférico',
    cone: 'Cono / reducción', bflange: 'Brida de cuerpo (Ap. 2)', flat: 'Tapa plana'
  };
  var UW12 = { '1': [1.00, 0.85, 0.70], '2': [0.90, 0.80, 0.65] };
  var UCS57 = { '1': 32, '3': 19, '4': 16, '5A': 0, '5B': 0, '5C': 0, '15E': 0, '9A': 16, '9B': 16, '10A': 19, '10B': 16, '10C': 16 };

  function newProject(orient){
    return {
      version: 1,
      info: { proyecto: '', equipo: '', tag: '', cliente: '', autor: '', rev: '0', fecha: new Date().toISOString().slice(0, 10) },
      design: { orient: orient || 'V', hdir: 'R', P: 1.0, T: 150, Pext: 0, c: 3, MDMT: -10, fluid: 'Agua', rho: 1000, level: null,
        lethal: false, rt: 'RT-1', jt: '1', ndt: { VT: true, RT: true, UT: false, MT: false, PT: false },
        pwht: false, pwhtVol: false, ug20f: true, normalized: false, testPos: 'oper', testUseP: false },
      comps: [ newComp('shell', null) ],
      base: 'C1', seq: 1, nseq: 0,
      nozzles: []
    };
  }
  function newComp(type, prj, near){
    var id = 'C' + (prj ? (++prj.seq) : 1);
    var D = near ? (near.Ds && near.largeAt === 'base' ? near.Ds : near.D) : 1500;
    var base = { id: id, type: type, name: TYPES[type], mat: { id: 'sa516', vi: 0 }, tn: 10, c: null, E: null, Ec: null };
    if (type === 'shell') return Object.assign(base, { D: D || 1500, basis: 'id', L: 3000, Lext: null });
    if (type === 'ellip') return Object.assign(base, { D: D || 1500, ratio: 2, sf: 50, seamless: true });
    if (type === 'tori') return Object.assign(base, { D: D || 1500, Lc: null, rk: null, sf: 50, seamless: true });
    if (type === 'hemi') return Object.assign(base, { D: D || 1500, sf: 0, seamless: true });
    if (type === 'cone') return Object.assign(base, { D: D || 1500, Ds: Math.round((D || 1500) * 0.6), alpha: 30, largeAt: 'base' });
    if (type === 'flat') return Object.assign(base, { sk: 'efg', d: D || 1500, tn: 40, ts: null });
    if (type === 'bflange') return Object.assign(base, { mat: { id: 'sa105', vi: 0 }, ftype: 'integral', B: D || 1500, A: (D || 1500) + 250, C: (D || 1500) + 160,
      t: 80, g0: 10, g1: 25, h: 60, Go: (D || 1500) + 60, Gi: (D || 1500) + 20, b0mode: 'N2', w: 0, Tg: 0, m: 2.75, y: 25.5,
      bmat: { id: 'sa193b7', vi: 0 }, n: 44, a: 22.2, Ar: 270.3, bsize: '7/8', Gfix: 0, Ed: 0, Ea: 0 });
    return base;
  }
  function newNozzle(prj){
    var id = 'N' + (++prj.nseq);
    var host = prj.comps.filter(function(c){ return c.type === 'shell'; })[0] || prj.comps[0];
    return { id: id, mark: id, service: '', host: host.id, a: 500, rad: 0, theta: 0, nps: '6', od: 168.3, tn: 7.11, pipe: true,
      mat: { id: 'sa106b', vi: 0 }, proj: 200, hin: 0, ti: 0, pad: false, Dp: 0, te: 0, pmat: { id: 'sa516', vi: 0 },
      leg41: 6, leg42: 6, leg43: 0, E1: 1, access: false,
      fl: { type: 'WN', cls: 150, mat: { id: 'sa105', vi: 0 } } };
  }

  // ---------------- geometría ----------------
  function headDepth(c){ // profundidad interior del abombado (sin falda)
    var D = c.D;
    if (c.type === 'ellip') return D / (2 * (c.ratio || 2));
    if (c.type === 'hemi') return D / 2;
    if (c.type === 'tori'){
      var L = toriL(c), r = toriR(c);
      return L - Math.sqrt(Math.pow(L - r, 2) - Math.pow(D / 2 - r, 2));
    }
    return 0;
  }
  function toriL(c){ return c.Lc > 0 ? c.Lc : c.D + 2 * c.tn; }               // por defecto L = D exterior (F&D ASME)
  function toriR(c){ return c.rk > 0 ? c.rk : 0.06 * (c.D + 2 * c.tn); }       // por defecto r = 6 % D exterior
  function axLen(c){
    if (c.type === 'shell') return c.L;
    if (c.type === 'ellip' || c.type === 'tori' || c.type === 'hemi') return (c.sf || 0) + headDepth(c) + c.tn;
    if (c.type === 'cone') return Math.abs(c.D - c.Ds) / 2 / Math.tan(c.alpha * Math.PI / 180);
    if (c.type === 'flat') return c.tn;
    if (c.type === 'bflange') return c.t + c.h;
    return 0;
  }
  // perfil interior: puntos [s_local, radio] desde el extremo de unión (s=0) hacia fuera
  function headProfile(c){
    var pts = [], D = c.D, sf = c.sf || 0, h = headDepth(c), n = 40;
    pts.push([0, D / 2]); if (sf > 0) pts.push([sf, D / 2]);
    if (c.type === 'ellip' || c.type === 'hemi'){
      for (var k = 1; k <= n; k++){ var th = k / n * Math.PI / 2; pts.push([sf + h * Math.sin(th), D / 2 * Math.cos(th)]); }
    } else if (c.type === 'tori'){
      var L = toriL(c), r = toriR(c), a = D / 2 - r, zc = L - h;        // centro del radio de rebordeo en (z=0,x=a); corona centrada en eje a -zc
      var phi = Math.asin(a / (L - r));                                   // ángulo en que el rebordeo enlaza con la corona
      for (var k1 = 1; k1 <= n / 2; k1++){ var t1 = k1 / (n / 2) * (Math.PI / 2 - phi); pts.push([sf + r * Math.sin(t1), a + r * Math.cos(t1)]); }
      var zKn = r * Math.sin(Math.PI / 2 - phi);
      for (var k2 = 1; k2 <= n / 2; k2++){ var t2 = phi - k2 / (n / 2) * phi; pts.push([sf + (Math.sqrt(L * L - Math.pow(L * Math.sin(t2), 2)) - (L - h)), L * Math.sin(t2)]); }
    }
    return pts;
  }
  // Posiciones a lo largo del eje (s) de cada componente; base: virola de origen en s = 0
  function layout(prj){
    var comps = prj.comps, bi = 0;
    comps.forEach(function(c, i){ if (c.id === prj.base) bi = i; });
    var pos = {};
    var s = 0;
    for (var i = bi; i < comps.length; i++){ var L = axLen(comps[i]); pos[comps[i].id] = { s0: s, s1: s + L, side: i === bi ? 'base' : 'end', idx: i }; s += L; }
    s = 0;
    for (var j = bi - 1; j >= 0; j--){ var L2 = axLen(comps[j]); pos[comps[j].id] = { s0: s - L2, s1: s, side: 'start', idx: j }; s -= L2; }
    var smin = Infinity, smax = -Infinity;
    comps.forEach(function(c){ smin = Math.min(smin, pos[c.id].s0); smax = Math.max(smax, pos[c.id].s1); });
    return { pos: pos, smin: smin, smax: smax, bi: bi };
  }
  // radio interior en la posición s (para dibujo, nivel y boquillas)
  function innerR(c, p, s){
    var u = s - p.s0, L = p.s1 - p.s0;
    if (c.type === 'shell') return c.basis === 'od' ? c.D / 2 - c.tn : c.D / 2;
    if (c.type === 'cone'){
      var big = c.D / 2, small = c.Ds / 2;
      var fromBig = p.side === 'start' ? (c.largeAt === 'base' ? L - u : u) : (c.largeAt === 'base' ? u : L - u);
      return big - (big - small) * fromBig / L;
    }
    return null;
  }

  // ---------------- eficiencias ----------------
  function effFor(prj, c){
    var d = prj.design, col = { 'RT-1': [0, 0], 'RT-2': [0, 1], 'RT-3': [1, 1], 'RT-4': [2, 2] }[d.rt] || [2, 2];
    var tab = UW12[d.jt] || UW12['1'];
    var EA = tab[col[0]], EB = tab[col[1]], txt;
    txt = 'Tabla UW-12, junta tipo ' + d.jt + ', ' + d.rt + ': E (cat. A) = ' + EA.toFixed(2) + ', E (cat. B) = ' + EB.toFixed(2);
    var head = c.type === 'ellip' || c.type === 'tori' || c.type === 'hemi';
    if (head && c.seamless){
      EA = (d.rt === 'RT-1' || d.rt === 'RT-2') ? 1.0 : 0.85;
      txt = 'Fondo sin costura: E = ' + EA.toFixed(2) + (EA === 1 ? ' (cumple UW-11(a)(5)(-b))' : ' (sin radiografía por puntos de UW-11(a)(5)(-b))') + ' — UW-12(d)';
    }
    return { EA: c.E > 0 ? c.E : EA, EB: c.Ec > 0 ? c.Ec : EB, txt: (c.E > 0 || c.Ec > 0) ? 'E impuesta por el usuario' : txt };
  }

  // ---------------- cálculo de un componente ----------------
  function calcComp(prj, c, L, Tdes){
    var d = prj.design, p = L.pos[c.id], cc = c.c != null ? +c.c : +d.c;
    var T = Tdes != null ? Tdes : d.T;
    var m = V.mat(c.mat, T), res = { c: c, pos: p, sec: [], ok: true, mat: m, cc: cc };
    if (!m){ res.err = 'Material no definido'; res.ok = false; return res; }
    if (m.over){ res.err = 'T de diseño ' + T + ' °C supera el límite VIII-1 del material (' + m.tm + ' °C)'; res.ok = false; }
    var e = effFor(prj, c); res.eff = e;
    // presión hidrostática en operación
    var zmin = Math.min(p.s0, p.s1), Dint = c.D || 0, hL;
    if (d.orient === 'V'){
      var zL = d.level != null && d.level !== '' ? +d.level : L.smax;
      hL = Math.max(0, zL - zmin);
    } else {
      hL = d.level != null && d.level !== '' ? Math.min(+d.level, Dint) : Dint;
    }
    res.ph = hyd(d.rho || 0, hL); res.hL = hL;
    var P = d.P + res.ph;
    res.P = P;
    var S = m.S, Sa = m.Sa, I = null, Imap = null;
    function run(Pv, Sv, cor){
      if (c.type === 'shell') return C.shell({ P: Pv, S: Sv, E: e.EA, Ec: e.EB, D: c.D, basis: c.basis, tn: c.tn, c: cor });
      if (c.type === 'ellip') return C.head({ type: 'ellip', P: Pv, S: Sv, E: e.EA, D: c.D, ratio: c.ratio, tn: c.tn, c: cor });
      if (c.type === 'tori') return C.head({ type: 'tori', P: Pv, S: Sv, E: e.EA, D: c.D, L: toriL(c), rk: toriR(c), tn: c.tn, c: cor });
      if (c.type === 'hemi') return C.head({ type: 'hemi', P: Pv, S: Sv, E: e.EA, D: c.D, tn: c.tn, c: cor });
      if (c.type === 'cone') return C.head({ type: 'cone', P: Pv, S: Sv, E: e.EA, D: c.D, alpha: c.alpha, tn: c.tn, c: cor });
      if (c.type === 'flat'){
        var adj = adjShell(prj, c), fl = adjFlange(prj, c);
        var tsh = c.ts > 0 ? c.ts : (adj ? adj.tn : c.tn);
        var trs = adj ? (Pv * (adj.D / 2 + cor) / (Sv * 1 - 0.6 * Pv)) : 0;
        var inp = { sk: c.sk, P: Pv, S: Sv, E: 1, d: c.d + 2 * cor, tn: c.tn, c: cor, tr: trs, ts: tsh - cor };
        if (c.sk === 'jk' || c.sk === 'p'){
          if (!fl) return { steps: [], checks: [{ t: 'La tapa atornillada necesita una brida de cuerpo adyacente (datos de junta y pernos)', ok: false }], out: { ok: false } };
          var bm = V.mat(fl.bmat, T);
          Object.assign(inp, boltIn(fl, Pv, bm), { sk: 'jk', Sf_a: Sa });
        }
        return C.flat(inp);
      }
      if (c.type === 'bflange'){
        var bm2 = V.mat(c.bmat, T), sh = adjShell(prj, c), shm = sh ? V.mat(sh.mat, T) : m;
        var Ed = c.Ed > 0 ? c.Ed : modulus(m, T), Ea = c.Ea > 0 ? c.Ea : modulus(m, 40);
        return C.flange(Object.assign(boltIn(c, Pv, bm2), { type: c.ftype, A: c.A, B: c.B, t: c.t, g0: c.g0, g1: c.g1, h: c.h, c: cor, P: Pv,
          Sf_d: Sv, Sf_a: Sa, Sn_d: shm ? shm.S : Sv, Sn_a: shm ? shm.Sa : Sa, E_d: Ed, E_a: Ea }));
      }
    }
    I = run(P, S, cc);
    res.int = I;
    res.treq = I.out.treq; res.okInt = I.out.ok !== false && !I.checks.some(function(k){ return !k.ok && !k.warn; });
    // MAWP en el componente (caliente y corroído) y referida a la parte superior
    var mawp = I.out.mawp;
    if (mawp == null){
      mawp = V.bisect(function(Pv){ var o = run(Pv, S, cc); return !o.checks.some(function(k){ return !k.ok && !k.warn; }); }, 1e-4, 100, 40);
    }
    res.mawp = mawp; res.mawpTop = mawp != null ? mawp - res.ph : null;
    // MAP: nuevo y frío, sin corrosión ni columna
    var J = run(P, Sa, 0);
    var map = J.out.mawp;
    if (map == null) map = V.bisect(function(Pv){ var o = run(Pv, Sa, 0); return !o.checks.some(function(k){ return !k.ok && !k.warn; }); }, 1e-4, 100, 40);
    res.map = map;
    // presión exterior
    if (d.Pext > 0 || true){ res.ext = extComp(prj, c, L, m, T, cc, e); }
    // MDMT
    res.md = mdmtComp(prj, c, m, cc, e, P, Sa);
    // pesos
    var wv = massVol(c, m);
    res.mass = wv.mass; res.vol = wv.vol;
    res.ok = res.ok && res.okInt && (!res.ext || !(d.Pext > 0) || res.ext.ok) && (res.md.ok !== false);
    return res;
  }
  function modulus(m, T){
    if (!m.ch) return 0;
    var fb = V.factorB(m.ch, T, 1e-6, m.ty ? m.ty[1] : 0);
    return fb && !fb.err ? fb.E : 0;
  }
  function boltIn(fl, P, bm){
    return { Go: fl.Go, Gi: fl.Gi, b0mode: fl.b0mode, w: fl.w, T: fl.Tg, m: fl.m, y: fl.y, Gfix: fl.Gfix, n: fl.n, a: fl.a, Ar: fl.Ar, C: fl.C,
      P: P, Sb: bm ? bm.S : 172, Sa: bm ? bm.Sa : 172 };
  }
  function neighbors(prj, c){
    var i = prj.comps.indexOf(c);
    return [prj.comps[i - 1], prj.comps[i + 1]].filter(Boolean);
  }
  function adjShell(prj, c){
    var i = prj.comps.indexOf(c);
    for (var k = 1; k < prj.comps.length; k++){
      var a = prj.comps[i - k], b = prj.comps[i + k];
      if (a && a.type === 'shell') return a; if (b && b.type === 'shell') return b;
    }
    return null;
  }
  function adjFlange(prj, c){ var n = neighbors(prj, c).filter(function(x){ return x.type === 'bflange'; }); return n[0] || null; }

  // longitud de cálculo a presión exterior: virola + h/3 de fondos adyacentes (Fig. UG-28.1 a-1)
  function extLength(prj, c, L){
    if (c.Lext > 0) return { L: c.Lext, txt: 'impuesta por el usuario' };
    var i = prj.comps.indexOf(c), Ltot = c.L, parts = [c.name], k;
    for (k = i - 1; k >= 0; k--){ var a = prj.comps[k]; if (a.type === 'shell'){ Ltot += a.L; parts.push(a.name); continue; } if (/ellip|tori|hemi/.test(a.type)){ Ltot += headDepth(a) / 3 + (a.sf || 0); parts.push('h/3 ' + a.name); } break; }
    for (k = i + 1; k < prj.comps.length; k++){ var b = prj.comps[k]; if (b.type === 'shell'){ Ltot += b.L; parts.push(b.name); continue; } if (/ellip|tori|hemi/.test(b.type)){ Ltot += headDepth(b) / 3 + (b.sf || 0); parts.push('h/3 ' + b.name); } break; }
    return { L: Ltot, txt: parts.join(' + ') };
  }
  function extComp(prj, c, L, m, T, cc, e){
    var d = prj.design, Pe = d.Pext, r = V.R(), o = { r: r, ok: true, maep: null };
    if (!m.ch && /shell|ellip|tori|hemi|cone/.test(c.type)){ V.ck(r, 'El material no tiene carta de presión exterior asignada: no se puede calcular', !(Pe > 0), true); o.ok = !(Pe > 0); return o; }
    var t = c.tn - cc, ys = m.ty ? m.ty[1] : 0;
    if (c.type === 'shell'){
      var Do = c.basis === 'od' ? c.D : c.D + 2 * c.tn, le = extLength(prj, c, L);
      V.st(r, 'L', 'longitud de cálculo: ' + le.txt, le.L, 'len', 'UG-28(b), Fig. UG-28.1');
      var q = V.cylPa({ Do: Do, t: t, L: le.L, chart: m.ch, T: T, S: m.S, ys: ys }, r);
      if (q.err){ V.ck(r, q.err, false, !(Pe > 0)); o.ok = !(Pe > 0); return o; }
      o.maep = q.Pa;
      if (Pe > 0){
        var tr = V.treqExt(function(tt){ return V.cylPa({ Do: c.basis === 'od' ? c.D : c.D + 2 * (tt + cc), t: tt, L: le.L, chart: m.ch, T: T, S: m.S, ys: ys }); }, Pe, c.tn);
        if (tr) V.st(r, 't requerido (exterior)', 'mínimo t con Pa ≥ P exterior, + c', tr + cc, 'len', 'UG-28(c) paso 8');
        o.treq = tr ? tr + cc : null;
      }
    } else if (c.type === 'hemi'){
      var Ro = c.D / 2 + c.tn;
      var q2 = V.sphPa({ Ro: Ro, t: t, chart: m.ch, T: T, ys: ys }, r);
      if (q2.err){ V.ck(r, q2.err, false, !(Pe > 0)); o.ok = !(Pe > 0); return o; }
      o.maep = q2.Pa;
    } else if (c.type === 'ellip' || c.type === 'tori'){
      var Do2 = c.D + 2 * c.tn, Ro2;
      if (c.type === 'ellip'){
        var ho = headDepth(c) + c.tn, kk = Do2 / (2 * ho), ko = V.Ko(kk);
        Ro2 = V.st(r, 'Ro', 'Ko·Do,  Do/2ho = ' + kk.toFixed(2) + ', Ko = ' + ko.toFixed(3), ko * Do2, 'len', 'UG-33(d), Tabla UG-33.1');
      } else Ro2 = V.st(r, 'Ro', 'radio exterior de la corona = L + t', toriL(c) + c.tn, 'len', 'UG-33(e)');
      var q3 = V.sphPa({ Ro: Ro2, t: t, chart: m.ch, T: T, ys: ys }, r);
      if (q3.err){ V.ck(r, q3.err, false, !(Pe > 0)); o.ok = !(Pe > 0); return o; }
      // (a)(1)(-a): fórmula interior con 1,67·P y E = 1
      var hi = c.type === 'ellip' ? C.head({ type: 'ellip', P: 1, S: m.S, E: 1, D: c.D, ratio: c.ratio, tn: c.tn, c: cc })
                                  : C.head({ type: 'tori', P: 1, S: m.S, E: 1, D: c.D, L: toriL(c), rk: toriR(c), tn: c.tn, c: cc });
      var Pa1 = V.st(r, 'Pa (a)(1)(-a)', 'MAWP interior con E = 1 dividida por 1,67', hi.out.mawp / 1.67, 'p', 'UG-33(a)(1)(-a)');
      o.maep = V.st(r, 'Pa', 'mín[(a)(1)(-a) ; (a)(1)(-b)]', Math.min(q3.Pa, Pa1), 'p', 'UG-33(a)(1)');
    } else if (c.type === 'cone'){
      var al = c.alpha * Math.PI / 180;
      if (c.alpha > 60){ V.note(r, 'α > 60°: se calcula como tapa plana (UG-33(f)(2)); no incluido'); return o; }
      var DL = c.D + 2 * c.tn, Ds = c.Ds + 2 * c.tn, Lc = axLen(c);
      var te = V.st(r, 'te', 't·cos α', t * Math.cos(al), 'len', 'UG-33(b)');
      var Le = V.st(r, 'Le', '(Lc/2)·(1 + Ds/DL)', Lc / 2 * (1 + Ds / DL), 'len', 'UG-33(g)(1)');
      var q4 = V.cylPa({ Do: DL, t: te, L: Le, chart: m.ch, T: T, S: m.S, ys: ys }, r);
      if (q4.err){ V.ck(r, q4.err, false, !(Pe > 0)); o.ok = !(Pe > 0); return o; }
      o.maep = q4.Pa;
      V.note(r, 'Comprobar momento de inercia y refuerzo de las uniones cono-cilindro según Ap. 1-8 (no incluido).');
    } else if (c.type === 'flat'){
      var fr = C.flat({ sk: c.sk === 'jk' || c.sk === 'p' ? 'efg' : c.sk, P: Pe || 0.1, S: m.S, E: 1, d: c.d + 2 * cc, tn: c.tn, c: cc, tr: 0.5, ts: 1 });
      o.maep = fr.out.mawp; V.note(r, 'Tapa plana: UG-34 con la presión exterior actuando sobre la cara convexa no aplica; se usa la misma fórmula.');
    } else return null;
    if (Pe > 0 && o.maep != null){
      o.ok = o.maep >= Pe - 1e-9;
      V.ck(r, 'Presión exterior admisible ' + o.maep.toFixed(4) + ' MPa ≥ P exterior ' + Pe + ' MPa', o.ok);
    }
    return o;
  }

  // ---------------- MDMT del componente ----------------
  function mdmtComp(prj, c, m, cc, e, P, Sa){
    var d = prj.design, tg = c.tn, welded = true, ratio = null;
    if (c.type === 'flat'){ var sh = adjShell(prj, c); tg = (c.sk === 'jk' || c.sk === 'p') ? c.tn / 4 : Math.max(Math.min(c.tn, sh ? sh.tn : c.tn), c.tn / 4); welded = !(c.sk === 'jk' || c.sk === 'p'); }
    if (c.type === 'bflange') tg = Math.max(c.g0, c.t / 4);
    if (/shell|ellip|tori|hemi|cone/.test(c.type) && Sa > 0){
      // espesor requerido a la MDMT (S a temperatura ambiente) con E* = máx(E, 0,8)
      var Es = Math.max(e.EA, 0.8), tr;
      if (c.type === 'shell'){ var Rr = c.basis === 'od' ? c.D / 2 - c.tn + cc : c.D / 2 + cc; tr = P * Rr / (Sa * e.EA - 0.6 * P); }
      else if (c.type === 'ellip'){ var K = (2 + c.ratio * c.ratio) / 6; tr = P * (c.D + 2 * cc) * K / (2 * Sa * e.EA - 0.2 * P); }
      else if (c.type === 'tori'){ var Lt = toriL(c) + cc, rt = toriR(c) + cc, M = 0.25 * (3 + Math.sqrt(Lt / rt)); tr = P * Lt * M / (2 * Sa * e.EA - 0.2 * P); }
      else if (c.type === 'hemi'){ tr = P * (c.D / 2 + cc) / (2 * Sa * e.EA - 0.2 * P); }
      else { tr = P * (c.D + 2 * cc) / (2 * Math.cos(c.alpha * Math.PI / 180) * (Sa * e.EA - 0.6 * P)); }
      ratio = tr * Es / (c.tn - cc);
    }
    var o = V.mdmt({ mat: m, tg: tg, ratio: ratio, welded: welded, normalized: d.normalized, pwhtVol: d.pwhtVol, ug20f: d.ug20f, MDMTreq: d.MDMT });
    if (c.type === 'bflange'){
      var bm = V.mat(c.bmat, d.T);
      if (bm){ var ob = V.mdmt({ mat: bm, tg: c.a, MDMTreq: d.MDMT }); o.bolt = ob; }
    }
    o.ok = o.mdmt == null ? (o.impact ? false : null) : o.mdmt <= d.MDMT + 1e-9;
    o.tg = tg;
    return o;
  }

  // ---------------- masas y volúmenes ----------------
  function revolve(pts){ // pts [s, r] → área lateral y volumen
    var A = 0, Vv = 0;
    for (var k = 1; k < pts.length; k++){
      var ds = pts[k][0] - pts[k-1][0], r0 = pts[k-1][1], r1 = pts[k][1];
      var sl = Math.sqrt(ds * ds + (r1 - r0) * (r1 - r0));
      A += Math.PI * (r0 + r1) * sl;
      Vv += Math.PI * Math.abs(ds) * (r0 * r0 + r0 * r1 + r1 * r1) / 3;
    }
    return { A: A, V: Vv };
  }
  function massVol(c, m){
    var rho = m ? m.rho : 7850, mm3 = 1e-9, mv = 0, vol = 0;
    if (c.type === 'shell'){
      var Di = c.basis === 'od' ? c.D - 2 * c.tn : c.D, Do = Di + 2 * c.tn;
      mv = Math.PI / 4 * (Do * Do - Di * Di) * c.L; vol = Math.PI / 4 * Di * Di * c.L;
    } else if (/ellip|tori|hemi/.test(c.type)){
      var rv = revolve(headProfile(c)); mv = rv.A * c.tn; vol = rv.V;
    } else if (c.type === 'cone'){
      var L = axLen(c), r1 = c.D / 2, r2 = c.Ds / 2, sl = Math.sqrt(L * L + (r1 - r2) * (r1 - r2));
      mv = Math.PI * (r1 + r2) * sl * c.tn; vol = Math.PI * L * (r1 * r1 + r1 * r2 + r2 * r2) / 3;
    } else if (c.type === 'flat'){ mv = Math.PI / 4 * c.d * c.d * c.tn; }
    else if (c.type === 'bflange'){ mv = Math.PI / 4 * (c.A * c.A - c.B * c.B) * c.t + Math.PI * (c.B + (c.g0 + c.g1) / 2) * (c.g0 + c.g1) / 2 * c.h; vol = Math.PI / 4 * c.B * c.B * (c.t + c.h); }
    return { mass: mv * mm3 * rho, vol: vol * mm3 };
  }

  // ---------------- boquillas ----------------
  function calcNozzle(prj, n, L, compRes){
    var d = prj.design, host = prj.comps.filter(function(c){ return c.id === n.host; })[0];
    var out = { n: n, ok: true, checks: [], sec: [] };
    if (!host){ out.err = 'Componente anfitrión no encontrado'; out.ok = false; return out; }
    var hr = compRes[host.id], T = d.T, cc = host.c != null ? +host.c : +d.c;
    var mv = hr.mat, mn = V.mat(n.mat, T), mp = n.pad ? V.mat(n.pmat, T) : null;
    if (!mn){ out.err = 'Material del cuello no definido'; out.ok = false; return out; }
    out.mn = mn; out.mp = mp;
    var hostType = { shell: 'cyl', ellip: (n.rad <= 0.4 * host.D ? 'ellip' : 'ellipOut'), tori: 'tori', hemi: 'hemi', cone: 'cyl' }[host.type];
    if (!hostType){ out.err = 'Boquillas en ' + TYPES[host.type].toLowerCase() + ': no incluidas (UG-39 / brida)'; out.ok = false; return out; }
    var Dh = host.type === 'shell' ? (host.basis === 'od' ? host.D - 2 * host.tn : host.D) : host.D;
    if (host.type === 'cone'){ var p = L.pos[host.id]; Dh = 2 * innerR(host, p, p.s0 + Math.min(n.a, axLen(host))); out.checks.push({ t: 'Boquilla en cono: tr calculado como cilindro del diámetro local (simplificación); verificar UG-37(a) tr (b)', ok: true, warn: true }); }
    var P = hr.P;
    function run(Pv, ext){
      var inp = { host: hostType, P: Pv, D: Dh, ratio: host.ratio, L: host.type === 'tori' ? toriL(host) : null, t: host.tn, Sv: mv.S, c: cc,
        od: n.od, tn: n.tn, Sn: mn.S, pipe: n.pipe, hin: n.hin, ti: n.ti, E1: n.E1 || 1, pad: n.pad, Dp: n.Dp, te: n.te, Sp: mp ? mp.S : mv.S,
        leg41: n.leg41, leg42: n.leg42, leg43: n.leg43, access: n.access };
      if (ext) Object.assign(inp, ext);
      return C.nozzle(inp);
    }
    var I = run(P);
    out.int = I; out.P = P;
    out.okInt = I.out.ok;
    out.mawpReinf = V.bisect(function(Pv){ return run(Pv).out.ok; }, 1e-4, 100, 40);
    // presión exterior en virolas: UG-37(d) con 50 % del área
    if (d.Pext > 0 && host.type === 'shell' && mv.ch){
      var le = extLength(prj, host, L), ys = mv.ty ? mv.ty[1] : 0;
      var trE = V.treqExt(function(tt){ return V.cylPa({ Do: Dh + 2 * (tt + cc), t: tt, L: le.L, chart: mv.ch, T: T, S: mv.S, ys: ys }); }, d.Pext, host.tn);
      var trnE = mn.ch ? V.treqExt(function(tt){ return V.cylPa({ Do: n.od, t: tt, L: Math.max(n.proj, 50), chart: mn.ch, T: T, S: mn.S, ys: mn.ty ? mn.ty[1] : 0 }); }, d.Pext, n.tn) : null;
      if (trE){
        out.ext = run(d.Pext, { trOverride: trE, trnOverride: trnE || 0, extFactor: 0.5 });
        out.okExt = out.ext.out.ok;
      }
    }
    // brida
    var flr = null;
    if (n.fl && n.fl.type !== 'none'){
      var fm = V.mat(n.fl.mat, T); var grp = fm && fm.grp;
      var rat = grp ? V.b165rating(grp, n.fl.cls, T) : null;
      flr = { grp: grp, rating: rat, cls: n.fl.cls, type: n.fl.type, fm: fm };
      if (!grp) out.checks.push({ t: 'El material de la brida no tiene grupo B16.5 asignado (Tabla 1A de B16.5)', ok: false });
      else if (rat == null) out.checks.push({ t: 'Grupo ' + grp + ' clase ' + n.fl.cls + ': sin rating a ' + T + ' °C', ok: false });
      else out.checks.push({ t: 'Rating B16.5 grupo ' + grp + ', clase ' + n.fl.cls + ' a ' + T + ' °C = ' + rat.toFixed(2) + ' MPa ≥ P en boquilla ' + P.toFixed(3) + ' MPa', ok: rat >= P - 1e-9 });
      var dm = V.b165dims(n.fl.cls, n.nps);
      flr.dims = dm;
      if (n.fl.type === 'LWN' && dm){
        var id = n.od - 2 * n.tn;
        out.checks.push({ t: 'UG-44(j)(2): D.E. del cuello LWN ' + n.od.toFixed(1) + ' mm ≥ diámetro de cubo X = ' + dm.X + ' mm (brida lap joint, misma NPS y clase)', ok: n.od >= dm.X - 0.05 });
        if (dm.Blj) out.checks.push({ t: 'UG-44(j)(1): D.I. del cuello LWN ' + id.toFixed(1) + ' mm ≤ diámetro interior de la brida lap joint B = ' + dm.Blj + ' mm', ok: id <= dm.Blj + 0.05 });
      }
    }
    out.fl = flr;
    // MAWP de la boquilla referida a la parte superior
    var lim = [out.mawpReinf]; if (flr && flr.rating != null) lim.push(flr.rating);
    lim = lim.filter(function(x){ return x != null; });
    out.mawp = lim.length ? Math.min.apply(null, lim) : null;
    out.mawpTop = out.mawp != null ? out.mawp - hr.ph : null;
    // MDMT: uniones cuello-recipiente y refuerzo-recipiente (espesor del más delgado), brida B16.5/LWN exenta a −29 °C
    var mdl = [], tgN = Math.min(n.tn, host.tn);
    var a1 = V.mdmt({ mat: mn, tg: tgN, welded: true, normalized: false, pwhtVol: d.pwhtVol, ug20f: d.ug20f, MDMTreq: d.MDMT }); a1.lbl = 'Cuello (tg = ' + tgN.toFixed(1) + ' mm)'; mdl.push(a1);
    if (n.pad && mp){ var tgP = Math.min(n.te, host.tn); var a2 = V.mdmt({ mat: mp, tg: tgP, welded: true, normalized: d.normalized, pwhtVol: d.pwhtVol, ug20f: d.ug20f, MDMTreq: d.MDMT }); a2.lbl = 'Refuerzo (tg = ' + tgP.toFixed(1) + ' mm)'; mdl.push(a2); }
    if (flr && flr.fm){
      if (flr.fm.family === 'UCS'){ mdl.push({ lbl: 'Brida ' + (n.fl.type === 'LWN' ? 'LWN' : 'B16.5'), mdmt: -29, r: { steps: [{ k: 'MDMT brida', eq: n.fl.type === 'LWN' ? 'Brida de cuello largo (LWN) de acero al carbono o baja aleación' : 'Brida B16.5 de acero ferrítico', v: -29, u: 't', ref: n.fl.type === 'LWN' ? 'UCS-66(c)(4)' : 'UCS-66(c)(1)' }], checks: [] } }); }
      else { var a3 = V.mdmt({ mat: flr.fm, tg: n.tn, welded: true, MDMTreq: d.MDMT }); a3.lbl = 'Brida'; mdl.push(a3); }
    }
    out.mdl = mdl;
    var mm = mdl.map(function(x){ return x.mdmt; }).filter(function(x){ return x != null; });
    out.mdmt = mm.length ? Math.max.apply(null, mm) : null;
    out.ok = I.out.ok && (out.okExt !== false) && !out.checks.some(function(k){ return !k.ok && !k.warn; }) && (out.mdmt == null || out.mdmt <= d.MDMT + 1e-9);
    // masa aproximada del cuello
    out.mass = Math.PI / 4 * (n.od * n.od - Math.pow(n.od - 2 * n.tn, 2)) * (n.proj + host.tn + (n.hin || 0)) * 1e-9 * mn.rho +
      (n.pad ? Math.PI / 4 * (n.Dp * n.Dp - n.od * n.od) * n.te * 1e-9 * 7850 : 0);
    return out;
  }

  // ---------------- requisitos de END ----------------
  function ndtReq(prj, compRes){
    var d = prj.design, req = [], needRT1 = false;
    if (d.lethal){ needRT1 = true; req.push({ t: 'Servicio letal: radiografía total de todas las soldaduras a tope de virolas y fondos', ref: 'UW-11(a)(1), UW-2(a)', ok: d.rt === 'RT-1' }); req.push({ t: 'Servicio letal: TTPS obligatorio en aceros al carbono y baja aleación', ref: 'UW-2(a)(2)', ok: d.pwht, warn: !d.pwht }); }
    prj.comps.forEach(function(c){
      var r = compRes[c.id]; if (!r || !r.mat) return;
      if (!/shell|ellip|tori|hemi|cone/.test(c.type)) return;
      var p = (r.mat.pno || '').split(' ')[0], lim = 38;
      if (UCS57[p] != null) lim = Math.min(lim, UCS57[p]);
      if (r.mat.family === 'NI' && !/N02200|N02201|N04400|N06600/.test((r.mat.m.c || []).join(' '))) lim = Math.min(lim, 10);
      if (r.mat.family === 'TI') lim = 0;
      if (c.seamless && /ellip|tori|hemi/.test(c.type)) return;
      if (c.tn > lim){
        needRT1 = true;
        req.push({ t: c.name + ': espesor ' + c.tn + ' mm > ' + lim + ' mm → radiografía total obligatoria de las soldaduras a tope', ref: r.mat.family === 'TI' ? 'UNF-57(b)' : (UCS57[p] != null ? 'UW-11(a)(2), Tabla UCS-57' : 'UW-11(a)(2)'), ok: d.rt === 'RT-1' });
      }
      if (r.mat.family === 'TI') req.push({ t: c.name + ': titanio — líquidos penetrantes en todas las uniones', ref: 'UNF-58(b)', ok: d.ndt.PT });
    });
    if (d.ndt.UT) req.push({ t: 'UT como alternativa a RT admitida en soldaduras de espesor ≥ 6 mm (método de UW-53(b))', ref: 'UW-51(a)(4)', ok: true, info: true });
    if (d.rt !== 'RT-4' && !d.ndt.RT && !d.ndt.UT) req.push({ t: 'La designación ' + d.rt + ' exige examen volumétrico (RT o UT) y no está marcado en los END', ref: 'UW-11', ok: false });
    req.push({ t: 'Examen visual de todas las soldaduras', ref: 'UW-35, UW-38', ok: d.ndt.VT });
    req.push({ t: 'Prueba hidrostática', ref: 'UG-99', ok: true, info: true });
    return { req: req, needRT1: needRT1 };
  }

  // ---------------- cálculo del conjunto ----------------
  function compute(prj){
    var d = prj.design, L = layout(prj), cr = {}, list = [];
    prj.comps.forEach(function(c){ var r = calcComp(prj, c, L); cr[c.id] = r; list.push(r); });
    var nz = prj.nozzles.map(function(n){ return calcNozzle(prj, n, L, cr); });
    // continuidad de diámetros
    var warn = [];
    for (var i = 0; i < prj.comps.length - 1; i++){
      var a = prj.comps[i], b = prj.comps[i + 1];
      var da = endD(a, L.pos[a.id], 'hi'), db = endD(b, L.pos[b.id], 'lo');
      if (da && db && Math.abs(da - db) > 0.5) warn.push('Diámetros distintos en la unión ' + a.name + ' / ' + b.name + ': ' + da.toFixed(0) + ' / ' + db.toFixed(0) + ' mm');
    }
    prj.comps.forEach(function(c, i){
      if (/ellip|tori|hemi|flat/.test(c.type) && i !== 0 && i !== prj.comps.length - 1) warn.push(c.name + ' no está en un extremo del recipiente');
    });
    // MAWP del conjunto (parte superior)
    var cand = [];
    list.forEach(function(r){ if (r.mawpTop != null) cand.push({ v: r.mawpTop, who: r.c.name }); });
    nz.forEach(function(r){ if (r.mawpTop != null) cand.push({ v: r.mawpTop, who: 'Boquilla ' + r.n.mark }); });
    cand.sort(function(x, y){ return x.v - y.v; });
    var mawp = cand.length ? cand[0] : null;
    var mapc = list.filter(function(r){ return r.map != null; }).map(function(r){ return { v: r.map, who: r.c.name }; }).sort(function(x, y){ return x.v - y.v; });
    var maepc = list.filter(function(r){ return r.ext && r.ext.maep != null; }).map(function(r){ return { v: r.ext.maep, who: r.c.name }; }).sort(function(x, y){ return x.v - y.v; });
    // prueba hidrostática UG-99(b)
    var lsr = Infinity, lsrWho = '';
    list.forEach(function(r){ if (r.mat && r.mat.S > 0 && r.mat.Sa > 0){ var q = r.mat.Sa / r.mat.S; if (q < lsr){ lsr = q; lsrWho = r.c.name; } } });
    nz.forEach(function(r){ if (r.mn && r.mn.S > 0){ var q = r.mn.Sa / r.mn.S; if (q < lsr){ lsr = q; lsrWho = 'Boquilla ' + r.n.mark; } } });
    if (!isFinite(lsr)) lsr = 1;
    var basisP = d.testUseP ? d.P : (mawp ? mawp.v : d.P);
    var PT = 1.3 * basisP * lsr;
    var Htest = d.testPos === 'H' && d.orient === 'V' ? Math.max.apply(null, prj.comps.map(function(c){ return (c.D || 0) + 2 * c.tn; })) : (d.orient === 'V' ? L.smax - L.smin : Math.max.apply(null, prj.comps.map(function(c){ return c.D || 0; })));
    var PTbot = PT + hyd(1000, Htest);
    // MDMT del conjunto: la más caliente de las alcanzables
    var md = [];
    list.forEach(function(r){ if (r.md && r.md.mdmt != null) md.push({ v: r.md.mdmt, who: r.c.name }); if (r.md && r.md.bolt && r.md.bolt.mdmt != null) md.push({ v: r.md.bolt.mdmt, who: 'Pernos ' + r.c.name }); });
    nz.forEach(function(r){ if (r.mdmt != null) md.push({ v: r.mdmt, who: 'Boquilla ' + r.n.mark }); });
    md.sort(function(x, y){ return y.v - x.v; });
    var impact = list.filter(function(r){ return r.md && r.md.ok === false; }).map(function(r){ return r.c.name; })
      .concat(nz.filter(function(r){ return r.mdmt != null && r.mdmt > d.MDMT; }).map(function(r){ return 'Boquilla ' + r.n.mark; }));
    // masas
    var mE = 0, Vin = 0;
    list.forEach(function(r){ mE += r.mass || 0; Vin += r.vol || 0; });
    nz.forEach(function(r){ mE += r.mass || 0; });
    var nd = ndtReq(prj, cr);
    var allOk = list.every(function(r){ return r.ok; }) && nz.every(function(r){ return r.ok; }) && nd.req.every(function(q){ return q.ok || q.warn || q.info; });
    return { L: L, comps: list, byId: cr, nozzles: nz, warn: warn, mawp: mawp, mawpList: cand, map: mapc[0] || null, maep: maepc[0] || null,
      test: { PT: PT, PTbot: PTbot, lsr: lsr, lsrWho: lsrWho, basis: basisP, H: Htest }, mdmt: md[0] || null, mdmtList: md, impact: impact,
      mass: { empty: mE, oper: mE + Vin * (d.rho || 0), test: mE + Vin * 1000, vol: Vin }, ndt: nd, ok: allOk };
  }
  function endD(c, p, which){
    if (c.type === 'shell') return c.basis === 'od' ? c.D - 2 * c.tn : c.D;
    if (c.type === 'cone') return 2 * innerR(c, p, which === 'lo' ? p.s0 : p.s1);
    if (/ellip|tori|hemi/.test(c.type)) return c.D;
    if (c.type === 'bflange') return c.B;
    return null;
  }

  return { TYPES: TYPES, newProject: newProject, newComp: newComp, newNozzle: newNozzle, layout: layout, axLen: axLen, headDepth: headDepth,
    headProfile: headProfile, innerR: innerR, toriL: toriL, toriR: toriR, compute: compute, effFor: effFor, extLength: extLength, hyd: hyd };
})();

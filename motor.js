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
    r.out.treq = treq; r.out.t = t; r.out.C = C; r.out.d = d; r.out.bolted = !!sk.bolted;
    if (i.tn > 0){
      var te = i.tn - c;
      if (!sk.bolted) r.out.mawp = st(r, 'MAWP', 'S·E·(t/d)² / C,  t = t_nom − c', S * E * te * te / (d * d) / C, 'p', 'UG-34(c)(2) ec. (1)');
      ck(r, 'Espesor nominal ≥ requerido', i.tn >= treq - 1e-9);
      r.out.ok = i.tn >= treq - 1e-9 && r.out.okBolts !== false;
    }
    note(r, 'Solo tapas circulares. Las aberturas en la tapa se comprueban en cada boquilla (UG-39).');
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
    if (i.kd > 1.0001) d = st(r, 'd (plano del meridiano)', 'd / cos β  (boquilla no normal a la superficie del fondo)', d * i.kd, 'len', 'UG-37(a), Fig. UG-37');
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
      var Mk = i.Mk > 1 ? i.Mk : 1;
      tr = st(r, 'tr', 'P·L·M / (2·Sv − 0,2·P),  M = ' + Mk.toFixed(3) + (Mk > 1 ? '  (abertura en el rebordeo)' : '  (abertura en la zona esférica)'), P * (i.L + c) * Mk / (2 * Sv - 0.2 * P), 'len', Mk > 1 ? 'UG-37(a) tr (b), Ap. 1-4(d)' : 'UG-37(a) tr (a), Ap. 1-4(d)');
    } else if (i.host === 'flat'){
      tr = st(r, 'tr', 'espesor requerido de la tapa plana sin abertura (UG-34, sin corrosión)', i.trFlat, 'len', 'UG-39(b)(1)');
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
    var A = i.host === 'flat' ? st(r, 'A', '0,5·d·tr + tr·tn·(1 − fr1)', 0.5 * d * tr + tr * tn * (1 - fr1), 'a', 'UG-39(b)(1)')
      : st(r, 'A', (Af < 1 ? '0,5·' : '') + '[d·tr·F + 2·tn·tr·F·(1 − fr1)],  F = 1', Af * (d * tr * F + 2 * tn * tr * F * (1 - fr1)), 'a', Af < 1 ? 'UG-37(d)(1)' : 'UG-37(c), Fig. UG-37.1');
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
    r.out.A = A; r.out.Aav = Aav; r.out.t45 = t45; r.out.exempt = exempt; r.out.okA = okA; r.out.X = X; r.out.d = d; r.out.tr = tr;
    r.out.areas = { A: A, A1: A1, A2: A2, A3: A3, A41: A41, A42: A42, A43: A43, A5: A5, t: t, tn: tn, tr: tr, trn: trn, fr1: fr1, E1: E1, F: F, d: d };
    r.out.ok = ok45 && (okA || exempt);
    if (i.pad) note(r, 'UG-37(h): si el refuerzo va en segmentos sin cumplir sus condiciones, multiplicar A5 por 0,75.');
    note(r, 'Las cargas exteriores sobre la boquilla (UG-22) no se incluyen.');
    return r;
  }

  // ---------- SOLDADURAS DE BOQUILLA: UG-41 (resistencia) y UW-16 (tamaños mínimos) ----------
  // i: type 'setin'|'seton', od, tnNom, tNom, c, pad, Dp, teNom, leg41, leg42, leg43, tw (penetración en pared), twp (penetración refuerzo),
  //    Sv, Sn, Sp, full (penetración total sin refuerzo), exempt (UG-36(c)(3)) ; ar: áreas de nozzle()
  function nozzleWelds(i, ar){
    var r = R(), c = i.c || 0, Sv = i.Sv, Sn = i.Sn, Sp = i.Sp || Sv, pad = !!i.pad && i.Dp > i.od;
    var t = ar.t, tn = ar.tn, te = pad ? i.teNom : 0, od = i.od, d = ar.d;
    // UW-16 tamaños mínimos (espesores corroídos de las partes unidas)
    var tmin = Math.min(19, tn, pad ? te : t);
    var tc = Math.min(6, 0.7 * tmin);
    st(r, 'tmin', 'mín(19 mm ; espesor de la parte más delgada unida)', tmin, 'len', 'UW-16(b)');
    if (i.leg41 > 0) ck(r, 'UW-16: garganta del cordón exterior del cuello 0,7·' + FM.len(i.leg41) + ' = ' + FM.len(0.7 * i.leg41) + ' ≥ tc = mín(6 mm ; 0,7·tmin) = ' + FM.len(tc), 0.7 * i.leg41 >= tc - 1e-9);
    else if (!(i.tw > 0)) ck(r, 'UW-16: sin cordón exterior ni soldadura a tope declarada en el cuello', false);
    if (pad){
      var tminP = Math.min(19, te, t);
      st(r, 'tmin refuerzo', 'mín(19 mm ; te ; t)', tminP, 'len', 'UW-16(b)');
      ck(r, 'UW-16: garganta del cordón exterior del refuerzo 0,7·' + FM.len(i.leg42 || 0) + ' ≥ 0,5·tmin = ' + FM.len(0.5 * tminP), 0.7 * (i.leg42 || 0) >= 0.5 * tminP - 1e-9);
    }
    if (i.type === 'setin' && i.tw > 0 && i.tw < t + c - 1e-6) ck(r, 'Soldadura de penetración parcial en la pared: tw = ' + FM.len(i.tw) + ' ≥ 0,7·tmin = ' + FM.len(0.7 * tmin) + ' (Fig. UW-16.1)', i.tw >= 0.7 * tmin - 1e-9);
    // UG-41
    var fw = 0.49, gt = 0.74, gs = 0.60, ns = 0.70;
    var Swn = Math.min(Sn, pad ? Sp : Sv), Swe = Math.min(Sp, Sv), Sgn = Math.min(Sn, Sv), Sge = Math.min(Sn, Sp);
    var A = ar.A, A1 = ar.A1, A2 = ar.A2, A3 = ar.A3, A41 = ar.A41, A42 = ar.A42, A43 = ar.A43, A5 = ar.A5, fr1 = ar.fr1, tr = ar.tr, E1 = ar.E1, F = ar.F;
    var W = st(r, 'W', i.type === 'seton' ? '(A − A1)·Sv' : '[A − A1 + 2·tn·fr1·(E1·t − F·tr)]·Sv', Math.max(0, (A - A1 + (i.type === 'seton' ? 0 : 2 * tn * fr1 * (E1 * t - F * tr))) * Sv), 'f', 'UG-41(b)(2)');
    var paths = [], tw = i.tw > 0 ? Math.min(i.tw, t + c) : t + c, twp = i.twp > 0 ? i.twp : te;
    var full = tw >= t + c - 1e-6;
    var Dm = (od + d) / 2;
    var ONWS = (i.leg41 || 0) > 0 ? st(r, 'ONWS', 'π/2·D.E. cuello·cateto·0,49·S = π/2·' + FM.len(od) + '·' + FM.len(i.leg41) + '·0,49·' + FM.s(Swn), Math.PI / 2 * od * i.leg41 * fw * Swn, 'f', 'UW-15(c), UG-45(c)') : 0;
    var IFWS = (i.leg43 || 0) > 0 ? st(r, 'IFWS', 'π/2·D.E. cuello·cateto interior·0,49·S', Math.PI / 2 * od * i.leg43 * fw * Sgn, 'f', 'UW-15(c)') : 0;
    if (i.type === 'seton'){
      var GWS = st(r, 'GWS', 'π/2·(D.I. + tw)·tw·0,60·S  (cortante de la soldadura a tope del cuello)', Math.PI / 2 * (d + tw) * tw * gs * Sgn, 'f', 'UW-15(c)');
      var W11s = st(r, 'W1-1', '(A2 + A5 + A41 + A42)·Sv', (A2 + A5 + A41 + A42) * Sv, 'f', 'UG-41(b)(1), Fig. UG-41.1 (b)');
      paths.push({ k: '1-1', v: GWS + ONWS, w: W11s, eq: 'GWS + ONWS' });
      if (pad) note(r, 'Boquilla apoyada con chapa de refuerzo: caminos adicionales no incluidos.');
    } else {
      var NGWT = st(r, 'NGWT', 'π/2·D.E. cuello·tw·0,74·S  (tracción en la soldadura a tope cuello-pared)', Math.PI / 2 * od * tw * gt * Sgn, 'f', 'UW-15(c)');
      var NWS = st(r, 'NWS', 'π/2·Dm·tn·0,70·Sn,  Dm = (D.E. + d)/2 = ' + FM.len(Dm), Math.PI / 2 * Dm * tn * ns * Sn, 'f', 'UG-45(c)');
      var k22 = (A2 + A3 + A41 + A43 + 2 * tn * t * fr1) * Sv;
      if (pad){
        var OEWS = st(r, 'OEWS', 'π/2·Dp·cateto refuerzo·0,49·S', Math.PI / 2 * i.Dp * (i.leg42 || 0) * fw * Swe, 'f', 'UW-15(c)');
        var EGWT = st(r, 'EGWT', 'π/2·D.E. cuello·twp·0,74·S  (soldadura a tope refuerzo-cuello)', Math.PI / 2 * od * twp * gt * Sge, 'f', 'UW-15(c)');
        var W11 = st(r, 'W1-1', '(A2 + A5 + A41 + A42)·Sv', (A2 + A5 + A41 + A42) * Sv, 'f', 'UG-41(b)(1), Fig. UG-41.1 (a)');
        var W22 = st(r, 'W2-2', '(A2 + A3 + A41 + A43 + 2·tn·t·fr1)·Sv', k22, 'f', 'UG-41(b)(1)');
        var W33 = st(r, 'W3-3', '(A2 + A3 + A5 + A41 + A42 + A43 + 2·tn·t·fr1)·Sv', (A2 + A3 + A5 + A41 + A42 + A43 + 2 * tn * t * fr1) * Sv, 'f', 'UG-41(b)(1)');
        paths.push({ k: '1-1', v: OEWS + NWS, w: W11, eq: 'OEWS + NWS' });
        paths.push({ k: '2-2', v: ONWS + EGWT + NGWT + IFWS, w: W22, eq: 'ONWS + EGWT + NGWT' + (IFWS ? ' + IFWS' : '') });
        paths.push({ k: '3-3', v: OEWS + NGWT + IFWS, w: W33, eq: 'OEWS + NGWT' + (IFWS ? ' + IFWS' : '') });
      } else {
        var W11n = st(r, 'W1-1', '(A2 + A41)·Sv', (A2 + A41) * Sv, 'f', 'UG-41(b)(1)');
        var W22n = st(r, 'W2-2', '(A2 + A3 + A41 + A43 + 2·tn·t·fr1)·Sv', k22, 'f', 'UG-41(b)(1)');
        paths.push({ k: '1-1', v: ONWS + NWS, w: W11n, eq: 'ONWS + NWS' });
        paths.push({ k: '2-2', v: ONWS + NGWT + IFWS, w: W22n, eq: 'ONWS + NGWT' + (IFWS ? ' + IFWS' : '') });
      }
    }
    var exempt = i.exempt || (full && !pad && i.type === 'setin');
    var okW = true;
    paths.forEach(function(p){
      st(r, 'Camino ' + p.k, p.eq, p.v, 'f', 'Fig. UG-41.1');
      var need = Math.min(p.w, W), ok = p.v >= need - 1e-6; okW = okW && ok;
      ck(r, 'UG-41: camino ' + p.k + ' ≥ mín(W' + p.k + ' ; W) → ' + (p.v / 1000).toFixed(1) + ' kN ' + (ok ? '≥ ' : '< ') + (need / 1000).toFixed(1) + ' kN', ok, exempt);
    });
    if (exempt) note(r, i.exempt ? 'UW-15(b)(2): abertura exenta de refuerzo por UG-36(c)(3); cálculo de soldaduras informativo.' : 'UW-15(b)(1): unión de penetración total sin refuerzo (Fig. UW-16.1 (c)–(e)); cálculo de soldaduras informativo.');
    r.out.ok = okW || exempt; r.out.paths = paths; r.out.W = W;
    r.out.okSize = !r.checks.some(function(k){ return !k.ok && !k.warn && !k.info && /UW-16|penetración/.test(k.t); });
    r.out.ok = r.out.ok && r.out.okSize;
    return r;
  }


  // ---------- CARGAS EXTERIORES EN LA BOQUILLA: cuello (UG-45 cortante, UG-23(c)) ----------
  // i: od, tn (nominal), c, P, Sn, pipe, F (axial, + tracción), V (cortante), M (flector resultante), Mt (torsor), kS
  function nozzleLoads(i){
    var r = R(), c = i.c || 0, tn = (i.pipe ? 0.875 * i.tn : i.tn) - c, Ro = i.od / 2, Ri = Ro - (i.pipe ? 0.875 * i.tn : i.tn) + c;
    Ri = i.od / 2 - i.tn + c; var rn = Ri, kS = i.kS || 1;
    st(r, 'tn', (i.pipe ? '0,875·tn_nom − c' : 'tn_nom − c') + '  (cuello corroído)', tn, 'len', 'UG-16(d)');
    var A = Math.PI * ((Ri + tn) * (Ri + tn) - Ri * Ri), Ze = Math.PI / 4 * (Math.pow(Ri + tn, 4) - Math.pow(Ri, 4)) / (Ri + tn);
    var ssl = st(r, 'τ cortante', 'V / (π·Rn·tn)', i.V / (Math.PI * rn * tn), 's', 'PTB-4 E4.5.5, UG-45');
    var stl = st(r, 'τ torsión', 'Mt / (2·π·Rn²·tn)', i.Mt / (2 * Math.PI * rn * rn * tn), 's', 'PTB-4 E4.5.5, UG-45');
    var tau = ssl + stl;
    ck(r, 'UG-45: cortante total ' + tau.toFixed(1) + ' MPa ≤ 0,70·Sn = ' + (0.7 * kS * i.Sn).toFixed(1) + ' MPa', tau <= 0.7 * kS * i.Sn + 1e-9);
    var sh = st(r, 'σθ', 'P·Rn / tn', i.P * rn / tn, 's', 'UG-27');
    var sm = st(r, 'σl membrana', 'P·Rn/(2·tn) + F/A', i.P * rn / (2 * tn) + i.F / A, 's', 'UG-23(c)');
    var sb = st(r, 'σl flexión', 'M / Z,  Z = ' + (Ze / 1000).toFixed(1) + ' cm³', i.M / Ze, 's', 'UG-23(c)');
    var pm = Math.max(Math.abs(sh), Math.abs(sm));
    ck(r, 'Membrana: máx(σθ ; σl) = ' + pm.toFixed(1) + ' MPa ≤ S = ' + (kS * i.Sn).toFixed(1) + ' MPa', pm <= kS * i.Sn + 1e-9);
    var s1 = sm + sb, s2 = sm - sb, sint = Math.max(Math.abs(sh - s1), Math.abs(sh - s2), Math.sqrt(Math.pow(s1 - sh, 2) + 4 * tau * tau), Math.abs(s1), Math.abs(s2));
    st(r, 'Intensidad de tensión', 'Tresca con σθ, σl ± σb y τ', sint, 's', 'UG-23(c)');
    ck(r, 'Membrana + flexión: ' + sint.toFixed(1) + ' MPa ≤ 1,5·S = ' + (1.5 * kS * i.Sn).toFixed(1) + ' MPa', sint <= 1.5 * kS * i.Sn + 1e-9);
    note(r, 'Tensiones locales en la pared del recipiente: ver «Cargas locales WRC 107/537».');
    r.out.ok = !r.checks.some(function(k){ return !k.ok && !k.warn && !k.info; });
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

  return { setFmt: function(f){ FM = f; }, nozzleWelds: nozzleWelds, nozzleLoads: nozzleLoads, shell: shell, head: head, flat: flat, FLAT: FLAT, nozzle: nozzle, flange: flange, tuyz: tuyz, hubFactors: hubFactors, K1: K1, NPS: NPS };
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


  // Factor A a partir de B (cartas de II-D, lectura inversa). Devuelve { A, E, left, err }
  function factorAfromB(chart, T, B, ys){
    var f0 = factorB(chart, T, 1e-7, ys);
    if (f0.err) return { err: f0.err };
    var E = f0.E;
    // tramo elástico (a la izquierda de la curva): A = 2B/E
    var Aleft = (function(){ var lo = 1e-7, hi = 0.1; for (var k = 0; k < 60; k++){ var m = Math.sqrt(lo * hi); if (factorB(chart, T, m, ys).left) lo = m; else hi = m; } return lo; })();
    if (B <= Aleft * E / 2 + 1e-12) return { A: 2 * B / E, E: E, left: true };
    if (factorB(chart, T, 0.1, ys).B < B - 1e-9) return { err: 'B = ' + B.toFixed(1) + ' MPa por encima de la línea del material a ' + T + ' °C (U-2(g) o cambiar la configuración)' };
    var lo = Aleft, hi = 0.1;
    for (var k = 0; k < 70; k++){ var m = Math.sqrt(lo * hi); if (factorB(chart, T, m, ys).B >= B) hi = m; else lo = m; }
    return { A: hi, E: E, left: false };
  }
  // momento de inercia de un rectángulo de ancho axial b y altura radial h, y de secciones compuestas
  function compI(parts){ // parts: [{A, y, I}] y = posición radial del centroide
    var A = 0, Ay = 0; parts.forEach(function(p){ A += p.A; Ay += p.A * p.y; });
    var yc = Ay / A, I = 0; parts.forEach(function(p){ I += p.I + p.A * Math.pow(p.y - yc, 2); });
    return { A: A, yc: yc, I: I };
  }
  // ---------------- ANILLOS RIGIDIZADORES: UG-29(a) ----------------
  // i: Do, ts (corroído), Ls (separación), P (exterior), chart, T, ys, h, b (pletina: altura radial y ancho), side 'ext'|'int', Esh
  function ring29(i){
    var r = R(), As = i.h * i.b;
    st(r, 'Ls', 'separación entre anillos (o línea de soporte)', i.Ls, 'len', 'UG-29(a)');
    st(r, 'As', 'h·b = ' + i.h.toFixed(1) + ' × ' + i.b.toFixed(1) + ' mm (pletina)', As, 'a', 'UG-29(a)');
    var teq = i.ts + As / i.Ls;
    var B = st(r, 'B', '¾·[P·Do / (ts + As/Ls)]', 0.75 * i.P * i.Do / teq, 's', 'UG-29(a) paso 1');
    var fa = factorAfromB(i.chart, i.T, B, i.ys);
    if (fa.err){ ck(r, fa.err, false); return { r: r, ok: false }; }
    var A = st(r, 'A', fa.left ? '2·B/E  (B por debajo del extremo izquierdo de la curva)' : 'carta ' + i.chart + ' (lectura inversa)', fa.A, '', 'UG-29(a) pasos 2–5');
    var Is = st(r, 'Is', 'Do²·Ls·(ts + As/Ls)·A / 14', i.Do * i.Do * i.Ls * teq * A / 14, 'i4', 'UG-29(a) paso 6');
    var Isp = st(r, "I's", 'Do²·Ls·(ts + As/Ls)·A / 10,9', i.Do * i.Do * i.Ls * teq * A / 10.9, 'i4', 'UG-29(a) paso 6');
    var Ir = st(r, 'I (anillo)', 'b·h³/12', i.b * Math.pow(i.h, 3) / 12, 'i4', 'UG-29(a) paso 7');
    var w = Math.min(1.1 * Math.sqrt(i.Do * i.ts), i.Ls);
    var sgn = i.side === 'int' ? -1 : 1;
    var cmp = compI([{ A: w * i.ts, y: 0, I: w * Math.pow(i.ts, 3) / 12 }, { A: As, y: sgn * (i.ts / 2 + i.h / 2), I: Ir }]);
    var Ip = st(r, "I' (anillo + virola)", 'ancho de virola colaborante 1,10·√(Do·ts) = ' + w.toFixed(0) + ' mm', cmp.I, 'i4', 'UG-29(a) paso 7');
    var ok = Ir >= Is - 1e-6 || Ip >= Isp - 1e-6;
    ck(r, "UG-29(a): I = " + (Ir / 1e4).toFixed(1) + ' cm⁴ ≥ Is = ' + (Is / 1e4).toFixed(1) + " cm⁴  o  I' = " + (Ip / 1e4).toFixed(1) + " cm⁴ ≥ I's = " + (Isp / 1e4).toFixed(1) + ' cm⁴', ok);
    note(r, 'Uniones del anillo a la virola según UG-30 (soldadura continua o intermitente) y huecos según UG-29(c)/(d): no verificados.');
    return { r: r, ok: ok, Is: Is, Isp: Isp, I: Ir, Ip: Ip };
  }
  // ---------------- UNIONES CONO-CILINDRO ----------------
  var T151 = [[0.001,11],[0.002,15],[0.003,18],[0.004,21],[0.005,23],[0.006,25],[0.007,27],[0.008,28.5],[0.009,30]];
  var T152 = [[0.002,4],[0.005,6],[0.010,9],[0.02,12.5],[0.04,17.5],[0.08,24],[0.10,27],[0.125,30]];
  var T181 = [[0,0],[0.002,5],[0.005,7],[0.010,10],[0.02,15],[0.04,21],[0.08,29],[0.10,33],[0.125,37],[0.15,40],[0.20,47],[0.25,52],[0.30,57],[0.35,60]];
  function tab(Tb, x){ if (x <= Tb[0][0]) return Tb[0][1]; for (var k = 0; k < Tb.length - 1; k++){ if (x <= Tb[k+1][0]) return lerp(x, Tb[k][0], Tb[k+1][0], Tb[k][1], Tb[k+1][1]); } return Tb[Tb.length-1][1]; }
  // Ap. 1-5 (interior). i: end 'L'|'S', P, Ss, E1, R (radio interior corroído del cilindro), ts, t (requerido cilindro), tc, tr (requerido cono), alpha,
  //    Lcyl (longitud del cilindro adyacente), fT (máx. carga axial por unidad de circunferencia, tracción +), ringA, Sr
  function cone15(i){
    var r = R(), L = i.end === 'L', a = i.alpha, al = a * Math.PI / 180, ca = Math.cos(al), ta = Math.tan(al);
    var lim = L ? 2 * Math.sqrt(i.R * i.ts) : 1.4 * Math.sqrt(i.R * i.ts), hasCyl = i.Lcyl >= lim - 1e-9;
    st(r, 'Longitud mínima de cilindro', L ? '2,0·√(RL·ts)' : '1,4·√(Rs·ts)', lim, 'len', L ? '1-5(c)(1)' : '1-5(c)(2)');
    if (a > 30){ ck(r, 'α = ' + a + '° > 30°: la unión requiere análisis especial (1-5(g)) o toricónico; no incluido', false); return { r: r, ok: false }; }
    var x = st(r, 'P/(Ss·E1)', '', i.P / (i.Ss * i.E1), '', L ? '1-5(c)(1)' : '1-5(c)(2)');
    var D = hasCyl ? st(r, 'Δ', 'Tabla ' + (L ? '1-5.1' : '1-5.2') + ' (interpolación)', L ? (x >= 0.009 ? 30 : tab(T151, x)) : (x >= 0.125 ? 30 : tab(T152, x)), '', 'Tabla ' + (L ? '1-5.1' : '1-5.2')) : 0;
    if (hasCyl && D >= a){ ck(r, 'Δ = ' + D.toFixed(2) + '° ≥ α = ' + a + '°: no se requiere refuerzo en el extremo ' + (L ? 'mayor' : 'menor'), true); return { r: r, ok: true, need: false }; }
    var Q = st(r, L ? 'QL' : 'Qs', 'P·R/2 + f  (f = ' + (i.fT || 0).toFixed(1) + ' N/mm, carga axial más desfavorable)', i.P * i.R / 2 + (i.fT || 0), 'fl', '1-5(b)');
    if (Q < 0){ ck(r, 'Q en compresión: diseño según U-2(g) (1-5(d)/(e))', false, true); }
    var k = i.ringA > 0 ? Math.max(1, i.Ss / (i.Sr || i.Ss)) : 1;
    st(r, 'k', i.ringA > 0 ? 'y/(Sr·Er) ≥ 1, anillo en el cilindro' : '1  (sin anillo)', k, '', '1-5(c)(3)');
    var Ar = st(r, L ? 'ArL' : 'Ars', hasCyl ? 'k·Q·R/(Ss·E1)·(1 − Δ/α)·tan α' : 'k·Q·R·tan α/(Ss·E1)  (cilindro más corto que el mínimo)', k * Math.max(Q, 0) * i.R / (i.Ss * i.E1) * (hasCyl ? (1 - D / a) : 1) * ta, 'a', L ? (hasCyl ? '1-5(d)(1) ec. (1)' : '1-5(d)(2) ec. (3)') : (hasCyl ? '1-5(e)(1) ec. (5)' : '1-5(e)(2)'));
    var Ae;
    if (L) Ae = hasCyl ? st(r, 'AeL', '(ts − t)·√(RL·ts) + (tc − tr)·√(RL·tc/cos α)', Math.max(0, i.ts - i.t) * Math.sqrt(i.R * i.ts) + Math.max(0, i.tc - i.tr) * Math.sqrt(i.R * i.tc / ca), 'a', '1-5(d)(1) ec. (2)')
                       : st(r, 'AeL', '(tc − tr)·√(RL·tc/cos α)', Math.max(0, i.tc - i.tr) * Math.sqrt(i.R * i.tc / ca), 'a', '1-5(d)(2) ec. (4)');
    else Ae = hasCyl ? st(r, 'Aes', '0,78·√(Rs·ts)·[(ts − t) + (tc − tr)/cos α]', 0.78 * Math.sqrt(i.R * i.ts) * (Math.max(0, i.ts - i.t) + Math.max(0, i.tc - i.tr) / ca), 'a', '1-5(e)(1) ec. (6)')
                     : st(r, 'Aes', '0,78·√(Rs·tc/cos α)·(tc − tr)  (solo cono)', 0.78 * Math.sqrt(i.R * i.tc / ca) * Math.max(0, i.tc - i.tr), 'a', '1-5(e)(2)');
    if (i.ringA > 0) Ae = st(r, 'Ae + anillo', 'Ae + área del anillo', Ae + i.ringA, 'a', L ? '1-5(d)' : '1-5(e)');
    var ok = Ae >= Ar - 1e-9;
    ck(r, 'Ap. 1-5: área efectiva ' + Ae.toFixed(0) + ' mm² ≥ requerida ' + Ar.toFixed(0) + ' mm² (extremo ' + (L ? 'mayor' : 'menor') + ')', ok);
    if (!ok) note(r, 'El refuerzo adicional debe quedar a menos de √(R·ts) de la unión y su centroide a menos de 0,25·√(R·ts).');
    return { r: r, ok: ok, need: true, Ar: Ar, Ae: Ae };
  }
  // Ap. 1-8 (exterior). i: end, P (exterior), Ss, E1, R (radio exterior), ts (cil. corroído), t (requerido cil. ext), tc, tr (requerido cono ext.), alpha,
  //    Lcyl, fC (carga axial de compresión por unidad de circunferencia, +), Lsec (LL o Ls), Lc (generatriz del cono), RL, Rs (exteriores),
  //    ringA, ringI, ringH, ringB, chart, T, ys, Ex
  function cone18(i){
    var r = R(), L = i.end === 'L', a = i.alpha, al = a * Math.PI / 180, ca = Math.cos(al), ta = Math.tan(al), Dd = 2 * i.R;
    if (a > 60){ ck(r, 'α > 60°: análisis especial (1-8(e)); no incluido', false); return { r: r, ok: false }; }
    var lim = L ? 2 * Math.sqrt(i.R * i.ts) : 1.4 * Math.sqrt(i.R * i.ts), hasCyl = i.Lcyl >= lim - 1e-9;
    st(r, 'Longitud mínima de cilindro', L ? '2,0·√(RL·ts)' : '1,4·√(Rs·ts)', lim, 'len', L ? '1-8(b)(1)' : '1-8(c)(1)');
    var Q = st(r, L ? 'QL' : 'Qs', 'P·R/2 + f  (compresión, f = ' + (i.fC || 0).toFixed(1) + ' N/mm)', i.P * i.R / 2 + (i.fC || 0), 'fl', '1-8(a)');
    var k = i.ringA > 0 ? Math.max(1, i.Ss / (i.Sr || i.Ss)) : 1;
    var Ar, Ae, ok = true, okA = true;
    if (L){
      var x = st(r, 'P/(Ss·E1)', '', i.P / (i.Ss * i.E1), '', '1-8(b)(1)');
      var D = st(r, 'Δ', 'Tabla 1-8.1', x >= 0.35 ? 60 : tab(T181, x), '', 'Tabla 1-8.1');
      if (hasCyl && D >= a){ note(r, 'Δ ≥ α: no se requiere área de refuerzo en el extremo mayor'); }
      else {
        Ar = st(r, 'ArL', hasCyl ? 'k·QL·RL·tan α/(Ss·E1)·[1 − ¼·(P·RL − QL)/QL·Δ/α]' : 'k·QL·RL·tan α/(Ss·E1)', k * Q * i.R * ta / (i.Ss * i.E1) * (hasCyl ? (1 - 0.25 * (i.P * i.R - Q) / Q * D / a) : 1), 'a', hasCyl ? '1-8(b)(1) ec. (1)' : '1-8(b)(2)');
        Ae = hasCyl ? st(r, 'AeL', '0,55·√(DL·ts)·(ts + tc/cos α)', 0.55 * Math.sqrt(Dd * i.ts) * (i.ts + i.tc / ca), 'a', '1-8(b)(1) ec. (2)')
                    : st(r, 'AeL', '0,55·√(DL·tc/cos α)·(tc − tr)  (solo cono)', 0.55 * Math.sqrt(Dd * i.tc / ca) * Math.max(0, i.tc - i.tr), 'a', '1-8(b)(2)');
      }
    } else {
      Ar = st(r, 'Ars', 'k·Qs·Rs·tan α/(Ss·E1)', k * Q * i.R * ta / (i.Ss * i.E1), 'a', hasCyl ? '1-8(c)(1) ec. (3)' : '1-8(c)(2)');
      Ae = hasCyl ? st(r, 'Aes', '0,55·√(Ds·ts)·[(ts − t) + (tc − tr)/cos α]', 0.55 * Math.sqrt(Dd * i.ts) * (Math.max(0, i.ts - i.t) + Math.max(0, i.tc - i.tr) / ca), 'a', '1-8(c)(1) ec. (4)')
                  : st(r, 'Aes', '0,55·√(Ds·tc/cos α)·(tc − tr)  (solo cono)', 0.55 * Math.sqrt(Dd * i.tc / ca) * Math.max(0, i.tc - i.tr), 'a', '1-8(c)(2)');
    }
    if (Ar != null){
      if (i.ringA > 0) Ae = st(r, 'Ae + anillo', 'Ae + área del anillo', Ae + i.ringA, 'a', '1-8');
      okA = Ae >= Ar - 1e-9;
      ck(r, 'Ap. 1-8: área efectiva ' + Ae.toFixed(0) + ' mm² ≥ requerida ' + Ar.toFixed(0) + ' mm² (extremo ' + (L ? 'mayor' : 'menor') + ')', okA);
    }
    // momento de inercia (la unión es línea de soporte)
    var Ls = hasCyl ? i.Lsec : 0, AT = st(r, L ? 'ATL' : 'ATS', 'L·ts/2 + Lc·tc/2 + As', Ls * i.ts / 2 + i.Lc * i.tc / 2 + (i.ringA || 0), 'a', L ? '1-8(b)(3) paso 1' : '1-8(c)(3) paso 1');
    var MN = L ? st(r, 'M', '−RL·tan α/2 + LL/2 + (RL² − Rs²)/(3·RL·tan α)', -i.RL * ta / 2 + Ls / 2 + (i.RL * i.RL - i.Rs * i.Rs) / (3 * i.RL * ta), 'len', '1-8(b)(3)')
               : st(r, 'N', 'Rs·tan α/2 + Ls/2 + (RL² − Rs²)/(6·Rs·tan α)', i.Rs * ta / 2 + Ls / 2 + (i.RL * i.RL - i.Rs * i.Rs) / (6 * i.Rs * ta), 'len', '1-8(c)(3)');
    var Fq = st(r, L ? 'FL' : 'Fs', 'P·' + (L ? 'M' : 'N') + ' + f·tan α', i.P * MN + (i.fC || 0) * ta, 'fl', L ? '1-8(b)(3)' : '1-8(c)(3)');
    if (Fq < 0){ ck(r, 'F negativo: diseño según U-2(g)', false, true); return { r: r, ok: okA }; }
    var B = st(r, 'B', '¾·F·D/AT', 0.75 * Fq * Dd / AT, 's', 'paso 1');
    var fa = factorAfromB(i.chart, i.T, B, i.ys);
    if (fa.err){ ck(r, fa.err, false); return { r: r, ok: false }; }
    var A = st(r, 'A', fa.left ? '2·B/Ex' : 'carta ' + i.chart + ' (lectura inversa)', fa.left && i.Ex > 0 ? 2 * B / i.Ex : fa.A, '', 'pasos 2–5');
    var Is = st(r, 'Is', 'A·D²·AT / 14,0', A * Dd * Dd * AT / 14, 'i4', 'paso 6');
    var Isp = st(r, "I's", 'A·D²·AT / 10,9', A * Dd * Dd * AT / 10.9, 'i4', 'paso 6');
    // inercia disponible (aproximada): anillo + franjas de virola y cono de ancho 0,55·√(D·t)
    var ws = 0.55 * Math.sqrt(Dd * i.ts), wc = 0.55 * Math.sqrt(Dd * i.tc / ca);
    var parts = [{ A: ws * i.ts, y: 0, I: ws * Math.pow(i.ts, 3) / 12 }, { A: wc * i.tc, y: 0, I: wc * Math.pow(i.tc, 3) / 12 }];
    var Ir = 0;
    if (i.ringA > 0){ Ir = i.ringB * Math.pow(i.ringH, 3) / 12; parts.push({ A: i.ringA, y: i.ts / 2 + i.ringH / 2, I: Ir }); st(r, 'I (anillo)', 'b·h³/12', Ir, 'i4', 'paso 7'); }
    var Ip = st(r, "I' (anillo + virola + cono)", 'anchos colaborantes 0,55·√(D·ts) y 0,55·√(D·tc/cos α) (aproximación; VIII-1 no da procedimiento)', compI(parts).I, 'i4', 'paso 7');
    ok = okA && (Ir >= Is - 1e-6 || Ip >= Isp - 1e-6);
    ck(r, "Inercia: I = " + (Ir / 1e4).toFixed(1) + ' cm⁴ ≥ Is = ' + (Is / 1e4).toFixed(1) + " cm⁴  o  I' = " + (Ip / 1e4).toFixed(1) + " cm⁴ ≥ I's = " + (Isp / 1e4).toFixed(1) + ' cm⁴', Ir >= Is - 1e-6 || Ip >= Isp - 1e-6);
    return { r: r, ok: ok, Ar: Ar, Ae: Ae, Is: Is, Isp: Isp };
  }

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
    bisect: bisect, lerp: lerp, R: R, st: st, ck: ck, note: note, factorAfromB: factorAfromB, ring29: ring29, cone15: cone15, cone18: cone18, compI: compI };
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
    var p = {
      version: 1,
      info: { proyecto: '', equipo: '', tag: '', cliente: '', autor: '', rev: '0', fecha: new Date().toISOString().slice(0, 10) },
      design: { mfam: 'CS', wmin: 50, orient: orient || 'V', hdir: 'R', P: 1.0, T: 150, Pext: 0, c: 3, MDMT: -10, fluid: 'Agua', rho: 1000, level: null,
        lethal: false, rt: 'RT-1', jt: '1', ndt: { VT: true, RT: true, UT: false, MT: false, PT: false },
        pwht: false, pwhtVol: false, ug20f: true, normalized: false, testPos: 'oper', testUseP: false },
      comps: [ newComp('shell', null) ],
      base: 'C1', seq: 1, nseq: 0,
      nozzles: [],
      loads: typeof VLOADS !== 'undefined' ? VLOADS.defaults() : {},
      support: typeof VLOADS !== 'undefined' ? VLOADS.defSupport(orient || 'V') : { type: 'none' }
    };
    if (typeof FAB !== 'undefined') Object.assign(p, FAB.defaults(p));
    if (typeof FABDOC !== 'undefined') p.fab = FABDOC.defaults(p);
    return p;
  }
  // materiales por defecto según la familia del equipo
  var DEFMAT = { CS: { plate: 'sa516', pipe: 'sa106b', forge: 'sa105' }, LA: { plate: 'sa387_11', pipe: 'sa335_p11', forge: 'sa182_f11' },
    SS: { plate: 'sa240_304L', pipe: 'sa312_304L', forge: 'sa182_f304L' }, AL: { plate: 'sb209_5083', pipe: 'sb241_6061', forge: 'sb209_5083' },
    CU: { plate: 'sb171_c70600', pipe: 'sb466_c70600', forge: 'sb171_c70600' }, NI: { plate: 'sb127_n04400', pipe: 'sb165_n04400', forge: 'sb127_n04400' },
    TI: { plate: 'sb265_gr2', pipe: 'sb861_gr2', forge: 'sb265_gr2' } };
  function defMat(prj, form){ var f = (prj && prj.design && DEFMAT[prj.design.mfam]) || DEFMAT.CS; return { id: f[form] || DEFMAT.CS[form], vi: 0 }; }
  // B16.11 manguitos roscados: [NPS, A (longitud), D clase 3000, D clase 6000] (mm)
  var CPL = [['1/2', 48, 28, 38], ['3/4', 51, 35, 44], ['1', 60, 44, 57], ['1 1/4', 67, 57, 64], ['1 1/2', 79, 64, 76], ['2', 86, 76, 92], ['2 1/2', 92, 92, 108], ['3', 108, 108, 127], ['4', 121, 140, 159]];
  var CPL_SW = { '1/2': 21.95, '3/4': 27.3, '1': 34.05, '1 1/4': 42.8, '1 1/2': 48.9, '2': 61.35, '2 1/2': 74.2, '3': 90.15, '4': 115.8 };
  var PIPE_OD = { '1/2': 21.3, '3/4': 26.7, '1': 33.4, '1 1/4': 42.2, '1 1/2': 48.3, '2': 60.3, '2 1/2': 73.0, '3': 88.9, '4': 114.3 };
  function cplDims(n){
    var row = CPL.filter(function(r){ return r[0] === n.cnps; })[0] || CPL[2], D = +n.ccls === 6000 ? row[3] : row[2];
    var bore = n.cend === 'SW' ? CPL_SW[row[0]] : PIPE_OD[row[0]];
    return { A: row[1], D: D, bore: bore, tn: (D - bore) / 2, len: n.ctype === 'half' ? row[1] / 2 : row[1] };
  }
  function newComp(type, prj, near){
    var id = 'C' + (prj ? (++prj.seq) : 1);
    var D = near ? (near.Ds && near.largeAt === 'base' ? near.Ds : near.D) : 1500;
    var base = { id: id, type: type, name: TYPES[type], mat: defMat(prj, 'plate'), tn: 10, c: null, E: null, Ec: null, seam: 0 };
    if (type === 'shell') return Object.assign(base, { D: D || 1500, basis: 'id', L: 3000, Lext: null, rn: 0, rh: 100, rb: 12, rside: 'ext', rmat: defMat(prj, 'plate') });
    if (type === 'ellip') return Object.assign(base, { D: D || 1500, ratio: 2, sf: 50, seamless: true });
    if (type === 'tori') return Object.assign(base, { D: D || 1500, Lc: null, rk: null, sf: 50, seamless: true });
    if (type === 'hemi') return Object.assign(base, { D: D || 1500, sf: 0, seamless: true });
    if (type === 'cone') return Object.assign(base, { D: D || 1500, Ds: Math.round((D || 1500) * 0.6), alpha: 30, largeAt: 'base', ringLh: 0, ringLb: 0, ringSh: 0, ringSb: 0 });
    if (type === 'flat') return Object.assign(base, { sk: 'efg', d: D || 1500, tn: 40, ts: null });
    if (type === 'bflange') return Object.assign(base, { mat: defMat(prj, 'forge'), ftype: 'integral', B: D || 1500, A: (D || 1500) + 250, C: (D || 1500) + 160,
      t: 80, g0: 10, g1: 25, h: 60, Go: (D || 1500) + 60, Gi: (D || 1500) + 20, b0mode: 'N2', w: 0, Tg: 0, m: 2.75, y: 25.5,
      bmat: { id: 'sa193b7', vi: 0 }, n: 44, a: 22.2, Ar: 270.3, bsize: '7/8', Gfix: 0, Ed: 0, Ea: 0 });
    return base;
  }
  function letterMark(k){ var t = ''; k++; while (k > 0){ var m = (k - 1) % 26; t = String.fromCharCode(65 + m) + t; k = Math.floor((k - 1) / 26); } return t; }
  function nextMark(prj){ var used = {}; prj.nozzles.forEach(function(n){ used[String(n.mark).toUpperCase()] = 1; }); for (var k = 0; ; k++){ var m = letterMark(k); if (!used[m]) return m; } }
  function newNozzle(prj, kind){
    var id = 'N' + (++prj.nseq), mk = nextMark(prj);
    var host = prj.comps.filter(function(c){ return c.type === 'shell'; })[0] || prj.comps[0];
    var n = { id: id, kind: kind === 'cpl' ? 'cpl' : 'noz', mark: mk, service: '', host: host.id, a: 500, rad: 0, theta: 90, nps: '6', od: 168.3, tn: 7.11, pipe: true,
      mat: defMat(prj, 'pipe'), proj: 200, hin: 0, ti: 0, pad: false, Dp: 0, te: 0, pmat: defMat(prj, 'plate'),
      leg41: 10, leg42: 10, leg43: 0, E1: 1, access: false, hor: 'axial', wtype: 'setin', tw: null, twp: null, ld: { F: 0, V: 0, M: 0, Mt: 0, kS: 1 }, elb: [{ ang: 0, rt: 'LR', phi: 0, L: 200 }, { ang: 0, rt: 'LR', phi: 0, L: 200 }],
      fl: { type: 'WN', cls: 150, mat: defMat(prj, 'forge') } };
    if (n.kind === 'cpl'){ Object.assign(n, { cnps: '1', ccls: 3000, cend: 'NPT', ctype: 'full', pipe: false, mat: defMat(prj, 'forge'), fl: { type: 'none', cls: 150, mat: defMat(prj, 'forge') }, leg41: 6 });
      applyCpl(n); }
    return n;
  }
  function applyCpl(n, host){ var c = cplDims(n); n.od = c.D; n.tn = c.tn; n.nps = n.cnps; n.proj = Math.max(0, c.len - (n.wtype === 'seton' ? 0 : (host ? host.tn : 10) + (+n.hin || 0))); return c; }

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
  // Punto de la superficie interior del fondo a la distancia radial rr: q (desde la tangencia), normal exterior (Nq axial, Nr radial)
  function headSurfAt(c, rr){
    var pr = headProfile(c);
    if (rr >= pr[0][1] - 1e-9) return { q: 0, Nq: 0, Nr: 1 };
    for (var k = 1; k < pr.length; k++){
      if (pr[k][1] <= rr){
        var f = (pr[k-1][1] - rr) / ((pr[k-1][1] - pr[k][1]) || 1), q = pr[k-1][0] + f * (pr[k][0] - pr[k-1][0]);
        var dq = pr[k][0] - pr[k-1][0], dr = pr[k][1] - pr[k-1][1], L = Math.sqrt(dq * dq + dr * dr) || 1;
        return { q: q, Nq: -dr / L, Nr: dq / L };
      }
    }
    return { q: pr[pr.length - 1][0], Nq: 1, Nr: 0 };
  }
  // Eje de una boquilla en un fondo (coordenadas del meridiano: s axial, r radial). hor: 'axial' | 'normal'
  function headNoz(host, p, n){
    var dir = p.side === 'start' ? -1 : 1, isF = host.type === 'flat', Dh = isF ? host.d : host.D, rr = Math.max(0, Math.min(n.rad || 0, Dh / 2 - 1));
    if (isF){ var sF = p.side === 'start' ? p.s1 : p.s0; return { s: sF, r: rr, ds: dir, dr: 0, L0: host.tn + (n.hin || 0) + n.proj, cosb: 1, Nq: 1, Nr: 0 }; }
    var hs = headSurfAt(host, rr), sIn = p.side === 'start' ? p.s1 - hs.q : p.s0 + hs.q, sEnd = p.side === 'start' ? p.s0 : p.s1;
    if (n.hor === 'normal') return { s: sIn, r: rr, ds: dir * hs.Nq, dr: hs.Nr, L0: host.tn + (n.hin || 0) + n.proj, cosb: 1, Nq: hs.Nq, Nr: hs.Nr };
    return { s: sIn, r: rr, ds: dir, dr: 0, L0: (n.kind === 'cpl' ? host.tn / Math.max(hs.Nq, 0.2) : Math.abs(sEnd - sIn)) + (n.hin || 0) + n.proj, cosb: Math.max(hs.Nq, 1e-3), Nq: hs.Nq, Nr: hs.Nr };
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
  function cc0(prj, c){ return c.c != null ? +c.c : +prj.design.c; }
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
    var i = prj.comps.indexOf(c), Ltot = c.L, parts = [c.name], k, nr = +c.rn || 0;
    for (k = i - 1; k >= 0; k--){ var a = prj.comps[k]; if (a.type === 'shell'){ Ltot += a.L; nr += +a.rn || 0; parts.push(a.name); continue; } if (/ellip|tori|hemi/.test(a.type)){ Ltot += headDepth(a) / 3 + (a.sf || 0); parts.push('h/3 ' + a.name); } break; }
    for (k = i + 1; k < prj.comps.length; k++){ var b = prj.comps[k]; if (b.type === 'shell'){ Ltot += b.L; nr += +b.rn || 0; parts.push(b.name); continue; } if (/ellip|tori|hemi/.test(b.type)){ Ltot += headDepth(b) / 3 + (b.sf || 0); parts.push('h/3 ' + b.name); } break; }
    if (nr > 0) return { L: Ltot / (nr + 1), Ltot: Ltot, nr: nr, txt: '(' + parts.join(' + ') + ') / (' + nr + ' anillos + 1)' };
    return { L: Ltot, Ltot: Ltot, nr: 0, txt: parts.join(' + ') };
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
        if (le.nr > 0 && (+c.rn || 0) > 0){
          var rm = V.mat(c.rmat || c.mat, T) || m, best = null;
          [m, rm].forEach(function(mm){ if (!mm || !mm.ch) return; var q29 = V.ring29({ Do: Do, ts: t, Ls: le.L, P: Pe, chart: mm.ch, T: T, ys: mm.ty ? mm.ty[1] : 0, h: +c.rh || 0, b: +c.rb || 0, side: c.rside });
            if (!best || (q29.Is || 0) > (best.Is || 0)) best = q29; });
          if (best){ o.ring = best; o.ok = o.ok !== false && best.ok; }
        }
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
      if (Pe > 0){ var trc = V.treqExt(function(tt){ return V.cylPa({ Do: DL, t: tt * Math.cos(al), L: Le, chart: m.ch, T: T, S: m.S, ys: ys }); }, Pe, c.tn);
        if (trc){ V.st(r, 't requerido (exterior)', 'mínimo t con Pa ≥ P exterior, + c', trc + cc, 'len', 'UG-33(f)'); o.treq = trc + cc; } }
      V.note(r, 'Las uniones cono-cilindro se consideran líneas de soporte; su refuerzo e inercia (Ap. 1-8) se comprueban en «Uniones del cono».');
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
      if (+c.rn > 0) mv += (+c.rn) * Math.PI * (c.rside === 'int' ? Di - (+c.rh || 0) : Do + (+c.rh || 0)) * (+c.rh || 0) * (+c.rb || 0);
    } else if (/ellip|tori|hemi/.test(c.type)){
      var rv = revolve(headProfile(c)); mv = rv.A * c.tn; vol = rv.V;
    } else if (c.type === 'cone'){
      var L = axLen(c), r1 = c.D / 2, r2 = c.Ds / 2, sl = Math.sqrt(L * L + (r1 - r2) * (r1 - r2));
      mv = Math.PI * (r1 + r2) * sl * c.tn; vol = Math.PI * L * (r1 * r1 + r1 * r2 + r2 * r2) / 3;
    } else if (c.type === 'flat'){ mv = Math.PI / 4 * c.d * c.d * c.tn; }
    else if (c.type === 'bflange'){ mv = Math.PI / 4 * (c.A * c.A - c.B * c.B) * c.t + Math.PI * (c.B + (c.g0 + c.g1) / 2) * (c.g0 + c.g1) / 2 * c.h; vol = Math.PI / 4 * c.B * c.B * (c.t + c.h); }
    return { mass: mv * mm3 * rho, vol: vol * mm3 };
  }

  // cargas de tubería en la tubuladura: 6 componentes (FR radial, VC, VL cortantes, MC, ML flectores, MT torsor) y resultantes
  function nozLoads(n){
    var l = n.ld || {}, f = function(x){ return +x || 0; }, comp = l.VC != null || l.VL != null || l.MC != null || l.ML != null;
    var V = comp ? Math.hypot(f(l.VC), f(l.VL)) : f(l.V), Mm = comp ? Math.hypot(f(l.MC), f(l.ML)) : f(l.M);
    return { F: f(l.F), VC: comp ? f(l.VC) : 0, VL: comp ? f(l.VL) : f(l.V), MC: comp ? f(l.MC) : 0, ML: comp ? f(l.ML) : f(l.M), Mt: f(l.Mt), V: V, M: Mm, kS: f(l.kS) || 1 };
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
    if (n.kind === 'cpl'){ var cpd = applyCpl(n, host); out.cpl = cpd; out.checks.push({ t: 'Manguito ASME B16.11 clase ' + n.ccls + ' ' + (n.cend === 'SW' ? 'de enchufe y soldadura (SW)' : 'roscado NPT') + ' NPS ' + n.cnps + ': D.E. ' + cpd.D + ' mm, longitud ' + cpd.len + ' mm' + (n.cend !== 'SW' ? '; conexión roscada: UG-43(e) y Tabla UG-43 (hilos engranados)' : ''), ok: true, info: true }); }
    var hostType = { shell: 'cyl', ellip: ((n.rad || 0) + n.od / 2 <= 0.4 * host.D ? 'ellip' : 'ellipOut'), tori: 'tori', hemi: 'hemi', cone: 'cyl', flat: 'flat' }[host.type];
    var kd = 1, Mk = 1, hz = null;
    if (/ellip|tori|hemi/.test(host.type)){
      hz = headNoz(host, L.pos[host.id], n);
      if (n.hor !== 'normal' && hz.cosb < 0.9999){ kd = 1 / hz.cosb; out.checks.push({ t: 'Boquilla paralela al eje con inclinación β = ' + (Math.acos(hz.cosb) * 180 / Math.PI).toFixed(1) + '° respecto a la normal del fondo: d en el plano del meridiano = d/cos β (abertura elíptica)', ok: true, info: true }); if (hz.cosb < Math.cos(Math.PI / 4)) out.checks.push({ t: 'Inclinación > 45°: revisar la abertura no radial (U-2(g)); considerar orientarla normal a la superficie', ok: true, warn: true }); }
      if ((n.rad || 0) + n.od / 2 * kd > host.D / 2 + 1e-6) out.checks.push({ t: 'La abertura sobrepasa la línea de tangencia del fondo (r + d/2 > D/2)', ok: false });
      if (host.type === 'tori'){ var Lt = toriL(host), rt = toriR(host), aj = host.D / 2 - rt, rj = Lt * aj / (Lt - rt);
        if ((n.rad || 0) + n.od / 2 * kd > rj){ Mk = 0.25 * (3 + Math.sqrt((Lt + cc0(prj, host)) / (rt + cc0(prj, host)))); out.checks.push({ t: 'Abertura en el rebordeo (r + d/2 > ' + rj.toFixed(0) + ' mm): tr con M = ' + Mk.toFixed(3) + ' (UG-37(a) tr (b))', ok: true, info: true }); } }
      if (host.type === 'ellip' && hostType === 'ellipOut') out.checks.push({ t: 'Abertura fuera del círculo 0,8·D: tr del fondo completo (UG-37(a))', ok: true, info: true });
    }
    if (!hostType){ out.err = 'Boquillas en ' + TYPES[host.type].toLowerCase() + ': no incluidas (la abertura de una brida de cuerpo no es una boquilla)'; out.ok = false; return out; }
    var flatH = null;
    if (hostType === 'flat'){
      if (!hr.int || hr.int.out.t == null){ out.err = 'La tapa plana no tiene espesor requerido calculado (revisar la tapa)'; out.ok = false; return out; }
      flatH = { tr: hr.int.out.t, D: hr.int.out.d, C: hr.int.out.C, bolted: hr.int.out.bolted };
    }
    var Dh = host.type === 'shell' ? (host.basis === 'od' ? host.D - 2 * host.tn : host.D) : host.D;
    if (host.type === 'cone'){ var p = L.pos[host.id]; Dh = 2 * innerR(host, p, p.s0 + Math.min(n.a, axLen(host))); out.checks.push({ t: 'Boquilla en cono: tr calculado como cilindro del diámetro local (simplificación); verificar UG-37(a) tr (b)', ok: true, warn: true }); }
    var P = hr.P;
    function run(Pv, ext){
      var inp = { kd: kd, Mk: Mk, host: hostType, trFlat: flatH ? flatH.tr * Math.sqrt(Pv / P) : null, P: Pv, D: Dh, ratio: host.ratio, L: host.type === 'tori' ? toriL(host) : null, t: host.tn, Sv: mv.S, c: cc,
        od: n.od, tn: n.tn, Sn: mn.S, pipe: n.pipe, hin: n.hin, ti: n.ti, E1: n.E1 || 1, pad: n.pad, Dp: n.Dp, te: n.te, Sp: mp ? mp.S : mv.S,
        leg41: n.leg41, leg42: n.leg42, leg43: n.leg43, access: n.access };
      if (ext) Object.assign(inp, ext);
      return C.nozzle(inp);
    }
    var I = run(P);
    out.int = I; out.P = P;
    out.okInt = I.out.ok;
    if (flatH){
      var dO = I.out.d;
      out.checks.push({ t: 'UG-39(b): diámetro de la abertura d = ' + dO.toFixed(1) + ' mm ≤ D/2 = ' + (flatH.D / 2).toFixed(1) + ' mm (si no, Ap. 14 / U-2(g))', ok: dO <= flatH.D / 2 + 1e-9 });
      if (I.out.exempt && dO > flatH.D / 4){ I.out.exempt = false; out.checks.push({ t: 'UG-39(a): la exención de UG-36(c)(3) en tapas planas exige además d ≤ D/4', ok: true, info: true }); }
      // alternativa UG-39(d): aumentar el espesor de la tapa
      var cap = /^(b1|b2|efg|i)$/.test(host.sk) ? 0.50 : 0.75, tAlt;
      if (flatH.bolted) tAlt = Math.SQRT2 * flatH.tr + cc;
      else { var C2 = Math.min(2 * flatH.C, cap); tAlt = flatH.D * Math.sqrt(C2 * P / (mv.S * 1)) + cc; }
      out.flatAlt = { t: tAlt, ok: host.tn >= tAlt - 1e-9, cap: cap };
      out.checks.push({ t: 'UG-39(d) (alternativa al refuerzo): espesor de tapa ' + (flatH.bolted ? 'con el doble de la cantidad bajo la raíz' : 'con 2·C ≤ ' + cap.toFixed(2)) + ' = ' + tAlt.toFixed(1) + ' mm ' + (out.flatAlt.ok ? '≤' : '>') + ' nominal ' + host.tn + ' mm', ok: out.flatAlt.ok, warn: !out.flatAlt.ok });
      if (out.flatAlt.ok && !I.out.ok && I.out.t45 != null) out.okInt = I.checks.filter(function(k){ return /UG-45/.test(k.t); }).every(function(k){ return k.ok; });
    }
    // soldaduras de unión: UG-41 / UW-16
    var twN = n.tw > 0 ? +n.tw : host.tn;
    var ldn = nozLoads(n);
    if (ldn.F || ldn.V || ldn.M || ldn.Mt){
      out.nl = C.nozzleLoads({ od: n.od, tn: n.tn, c: cc, P: P, Sn: mn.S, pipe: n.pipe, F: ldn.F, V: ldn.V, M: ldn.M, Mt: ldn.Mt, kS: ldn.kS });
    }
    out.weld = C.nozzleWelds({ type: n.wtype || 'setin', od: n.od, c: cc, pad: n.pad, Dp: n.Dp, teNom: n.te, leg41: n.leg41, leg42: n.leg42, leg43: n.leg43,
      tw: twN, twp: n.twp > 0 ? +n.twp : n.te, Sv: mv.S, Sn: mn.S, Sp: mp ? mp.S : mv.S, exempt: I.out.exempt }, I.out.areas);
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
    out.ok = out.okInt && (out.okExt !== false) && !out.checks.some(function(k){ return !k.ok && !k.warn && !k.info; }) && (out.mdmt == null || out.mdmt <= d.MDMT + 1e-9) && out.weld.out.ok && (!out.nl || out.nl.out.ok);
    // masa aproximada del cuello
    var Lext = 0; (n.elb || []).forEach(function(eb){ if (eb && +eb.ang > 0){ var Re = (eb.rt === 'SR' ? 1.0 : 1.5) * n.od; Lext += Re * (+eb.ang) * Math.PI / 180 + (+eb.L || 0); } });
    out.mass = Math.PI / 4 * (n.od * n.od - Math.pow(n.od - 2 * n.tn, 2)) * (n.proj + host.tn + (n.hin || 0) + Lext) * 1e-9 * mn.rho +
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
  function compute(prj, opts){
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
    var ug42 = multiOpenings(prj, L, nz);
    var seams = weldSpacing(prj, L, nz);
    var out = { L: L, comps: list, byId: cr, nozzles: nz, warn: warn, mawp: mawp, mawpList: cand, map: mapc[0] || null, maep: maepc[0] || null,
      test: { PT: PT, PTbot: PTbot, lsr: lsr, lsrWho: lsrWho, basis: basisP, H: Htest }, mdmt: md[0] || null, mdmtList: md, impact: impact,
      mass: { empty: mE, oper: mE + Vin * (d.rho || 0), test: mE + Vin * 1000, vol: Vin }, ndt: nd, ug42: ug42, seams: seams };
    // fase 3: cargas exteriores y soportes
    if (typeof VLOADS !== 'undefined'){
      try { out.loads = VLOADS.run(prj, out); } catch (e){ out.loads = { err: 'Error en cargas exteriores: ' + e.message, ok: false }; if (typeof console !== 'undefined') console.error(e); }
    }
    // uniones cono-cilindro (Ap. 1-5 y 1-8)
    prj.comps.forEach(function(c){ if (c.type === 'cone') coneJunctions(prj, c, out); });
    // módulos complementarios (PED, EN 13445, camisas, placas tubulares, izado…) y documentación de fabricación
    if (typeof FAB !== 'undefined' && prj.ped) out.fab = FAB.run(prj, out);
    out.ok = list.every(function(r){ return r.ok; }) && nz.every(function(r){ return r.ok; }) && nd.req.every(function(q){ return q.ok || q.warn || q.info; }) && (!out.loads || out.loads.ok !== false) && (!out.fab || out.fab.ok !== false);
    if (typeof FABDOC !== 'undefined' && prj.fab && !(opts && opts.lite)) out.doc = FABDOC.run(prj, out);
    return out;
  }

  // ---------------- separación mínima entre soldaduras ----------------
  function toeR(n){ return (n.pad && n.Dp > n.od ? n.Dp / 2 + (+n.leg42 || 0) : n.od / 2 + (+n.leg41 || 0)); }
  function angDist(a, b){ var d = Math.abs(((a - b) % 360 + 360) % 360); return d > 180 ? 360 - d : d; }
  // ---------- virolas parciales y ángulos de las soldaduras longitudinales ----------
  // formatos de chapa del proyecto (fabricación): largo y ancho útiles
  function plateLim(prj){
    var fb = prj.fab; if (!fb || !fb.plates) return null;
    var sz = String(fb.plates).split(/[;,\n]/).map(function(t){ var q = t.trim().toLowerCase().split(/[x×*]/).map(function(v){ return +v.trim(); }); return q.length === 2 && q[0] > 0 && q[1] > 0 ? [Math.min(q[0], q[1]), Math.max(q[0], q[1])] : null; }).filter(Boolean);
    if (!sz.length) return null; var e = num(fb.edge, 10);
    return { L: Math.max.apply(null, sz.map(function(x){ return x[1]; })) - 2 * e, W: Math.max.apply(null, sz.map(function(x){ return x[0]; })) - 2 * e, rot: fb.rot !== false };
  }
  // división de una virola de diámetro medio Dm y longitud L en nL sectores por vuelta y nC virolas parciales
  function splitCyl(Dm, Lc, lim){
    if (!lim) return { nL: 1, nC: 1 };
    var dev = Math.PI * Dm, nL = Math.max(1, Math.ceil(dev / lim.L)), w = dev / nL;
    var fits = function(a, b){ return (a <= lim.L && b <= lim.W) || (lim.rot && a <= lim.W && b <= lim.L); };
    var nC = 1; while (!fits(w, Lc / nC) && nC < 20) nC++;
    if (!fits(w, Lc / nC)){ nL = Math.max(nL, Math.ceil(dev / lim.W)); w = dev / nL; nC = 1; while (!fits(w, Lc / nC) && nC < 20) nC++; }
    return { nL: nL, nC: nC };
  }
  // virolas parciales de una virola o cono: [{ k, z0, z1 (desde p.s0), ang: [ángulos de sus longitudinales] }]
  function courses(prj, c){
    var p = layout(prj).pos[c.id], Lx = p.s1 - p.s0, sp = { nL: 1, nC: 1 };
    if (c.type === 'shell'){ var Di = c.basis === 'od' ? c.D - 2 * c.tn : c.D; sp = splitCyl(Di + c.tn, c.L, plateLim(prj)); }
    else if (c.type === 'cone' && typeof FABDOC !== 'undefined' && prj.fab) sp = { nL: FABDOC.coneSegs(prj, c), nC: 1 };
    var list = [], base = +c.seam || 0, user = Array.isArray(c.seams) ? c.seams : [];
    for (var k = 0; k < sp.nC; k++){
      var a0 = user[k] != null && user[k] !== '' && !isNaN(+user[k]) ? +user[k] : (k === 0 ? base : base + (k % 2) * 180 / sp.nL), ang = [];
      for (var q = 0; q < sp.nL; q++) ang.push(((a0 + 360 * q / sp.nL) % 360 + 360) % 360);
      list.push({ k: k, z0: Lx * k / sp.nC, z1: Lx * (k + 1) / sp.nC, ang: ang });
    }
    return { nL: sp.nL, nC: sp.nC, list: list };
  }
  // menor distancia (en la superficie exterior) entre el borde del tubo de una conexión de virola y las longitudinales que atraviesan su altura
  function seamClear(prj, L, host, n, cs, angOverride){
    cs = cs || courses(prj, host);
    var p = L.pos[host.id], s = (n.a || 0), r = n.od / 2, Ro = innerR(host, p, p.s0 + s) + host.tn, best = null;
    var hw = Ro * Math.asin(Math.min(1, r / Ro)), hwp = n.pad && n.Dp > n.od ? Ro * Math.asin(Math.min(1, n.Dp / 2 / Ro)) : null;
    cs.list.forEach(function(cr, k){
      if (s + r < cr.z0 - 1e-6 || s - r > cr.z1 + 1e-6) return;
      (angOverride && angOverride[k] ? angOverride[k] : cr.ang).forEach(function(a){ var arc = Ro * angDist(n.theta || 0, a) * Math.PI / 180, d = arc - hw;
        if (!best || d < best.d) best = { d: d, pad: hwp != null ? arc - hwp : null, lbl: (cs.nC > 1 ? 'de la virola parcial ' + (k + 1) + ' ' : '') + 'a ' + Math.round(a) + '°' }; });
    });
    return best;
  }
  // colocación automática de las longitudinales: en cada virola parcial el ángulo más próximo al preferido que deja ≥ wmin a los tubos y a las longitudinales contiguas
  function autoSeams(prj){
    var L = layout(prj), wmin = +prj.design.wmin || 50, prevAng = null, changed = [];
    prj.comps.forEach(function(c){
      if (!/shell|cone/.test(c.type)){ prevAng = null; return; }
      var cs = courses(prj, c), p = L.pos[c.id], nzs = prj.nozzles.filter(function(n){ return n.host === c.id; }), res = [];
      var order = cs.list.map(function(x, i){ return i; }); if (p.side === 'start') order.reverse();
      var prev = prevAng;
      order.forEach(function(k){
        var cr = cs.list[k], Ro = innerR(c, p, p.s0 + (cr.z0 + cr.z1) / 2) + c.tn, pref = k === order[0] ? (+c.seam || 0) : ((res[order[order.indexOf(k) - 1]] || 0) + 180 / cs.nL), bestA = null, bestSc = -Infinity, bestD = Infinity;
        for (var st = 0; st < 360 / cs.nL; st += 1){
          var ang = []; for (var q = 0; q < cs.nL; q++) ang.push((st + 360 * q / cs.nL) % 360);
          var sc = Infinity;
          nzs.forEach(function(n){ var s2 = n.a || 0, r = n.od / 2; if (s2 + r < cr.z0 || s2 - r > cr.z1) return; var hw = Ro * Math.asin(Math.min(1, r / Ro)); ang.forEach(function(a){ sc = Math.min(sc, Ro * angDist(n.theta || 0, a) * Math.PI / 180 - hw - wmin); }); });
          if (prev) ang.forEach(function(a){ prev.forEach(function(b){ sc = Math.min(sc, Ro * angDist(a, b) * Math.PI / 180 - wmin); }); });
          var dp = Math.min.apply(null, ang.map(function(a){ return angDist(a, pref); })) + (st % 5 ? 400 : 0);
          var ok = sc >= 0;
          if ((ok && (bestSc < 0 || dp < bestD)) || (!ok && bestSc < 0 && sc > bestSc)){ bestA = st; bestSc = sc; bestD = dp; }
        }
        res[k] = bestA; prev = []; for (var q2 = 0; q2 < cs.nL; q2++) prev.push((bestA + 360 * q2 / cs.nL) % 360);
      });
      var old = JSON.stringify([c.seam, c.seams]);
      c.seam = res[0]; c.seams = cs.nC > 1 ? res.slice() : null;
      if (JSON.stringify([c.seam, c.seams]) !== old) changed.push(c.name);
      prevAng = prev;
    });
    return changed;
  }
  function weldSpacing(prj, L, nz){
    var wmin = +prj.design.wmin || 50, out = [];
    function add(t, ok, who){ var k = { t: t, ok: ok }; out.push(k); (who || []).forEach(function(z){ z.checks.push(k); if (!ok) z.ok = false; }); }
    // soldaduras longitudinales (por virola parcial) entre sí: en cada unión circunferencial
    var CS = {}; prj.comps.forEach(function(c){ if (/shell|cone/.test(c.type)) CS[c.id] = courses(prj, c); });
    function arcAt(c, sAbs){ var p = L.pos[c.id]; return innerR(c, p, Math.max(p.s0, Math.min(p.s1, sAbs))) + c.tn; }
    function minArc(A, B, R){ var m = Infinity; A.forEach(function(x){ B.forEach(function(y){ m = Math.min(m, R * angDist(x, y) * Math.PI / 180); }); }); return m; }
    prj.comps.forEach(function(c){ var cs = CS[c.id]; if (!cs) return; for (var k = 1; k < cs.list.length; k++){ var p = L.pos[c.id], R = arcAt(c, p.s0 + cs.list[k].z0), arc = minArc(cs.list[k - 1].ang, cs.list[k].ang, R);
      add('Longitudinales de ' + c.name + ', virolas parciales ' + k + '/' + (k + 1) + ': separación ' + arc.toFixed(0) + ' mm ' + (arc >= wmin ? '≥ ' : '< ') + wmin + ' mm', arc >= wmin - 1e-6); } });
    for (var i = 0; i < prj.comps.length - 1; i++){
      var a = prj.comps[i], b = prj.comps[i + 1];
      if (!CS[a.id] || !CS[b.id]) continue;
      var pa = L.pos[a.id], la = CS[a.id].list, lb = CS[b.id].list, Aang = (pa.side === 'start' ? la[0] : la[la.length - 1]).ang, Bang = (L.pos[b.id].side === 'start' ? lb[lb.length - 1] : lb[0]).ang;
      var arc = minArc(Aang, Bang, innerR(a, pa, pa.s1) + a.tn);
      add('Longitudinales ' + a.name + ' (' + Aang.map(function(x){ return Math.round(x); }).join('/') + '°) / ' + b.name + ' (' + Bang.map(function(x){ return Math.round(x); }).join('/') + '°): separación en la unión ' + arc.toFixed(0) + ' mm ' + (arc >= wmin ? '≥ ' : '< ') + wmin + ' mm', arc >= wmin - 1e-6);
    }
    // conexiones frente a soldaduras longitudinales (desde el borde del tubo) y circunferenciales
    nz.forEach(function(z){
      var n = z.n, host = prj.comps.filter(function(c){ return c.id === n.host; })[0]; if (!host || z.err) return;
      var p = L.pos[host.id], rt = toeR(n), lbl = (n.kind === 'cpl' ? 'Manguito ' : 'Conexión ') + n.mark;
      if (/shell|cone/.test(host.type)){
        var cl = seamClear(prj, L, host, n, CS[host.id]);
        if (cl) add(lbl + ': borde del tubo a la longitudinal ' + cl.lbl + ' de ' + host.name + ' = ' + (cl.d < 0 ? 'COINCIDE (' + cl.d.toFixed(0) + ')' : cl.d.toFixed(0)) + ' mm ' + (cl.d >= wmin ? '≥ ' : '< ') + wmin + ' mm', cl.d >= wmin - 1e-6, [z]);
        if (cl && cl.pad != null && cl.pad < 0) { var kp = { t: lbl + ': la longitudinal ' + cl.lbl + ' queda bajo la chapa de refuerzo; examinarla (RT/UT) y amolarla a ras antes de colocar el refuerzo', ok: true, warn: true }; out.push(kp); z.checks.push(kp); }
      var i2 = prj.comps.indexOf(host), dC = [];
        if (i2 > 0) dC.push((n.a || 0) - rt); if (i2 < prj.comps.length - 1) dC.push((p.s1 - p.s0) - (n.a || 0) - rt);
        var csH = CS[host.id]; if (csH) for (var kc = 1; kc < csH.list.length; kc++) dC.push(Math.abs((n.a || 0) - csH.list[kc].z0) - rt);
        if (dC.length){ var dm = Math.min.apply(null, dC); add(lbl + ': borde de su soldadura a la circunferencial más próxima = ' + dm.toFixed(0) + ' mm ' + (dm >= wmin ? '≥ ' : '< ') + wmin + ' mm', dm >= wmin - 1e-6, [z]); }
      } else if (/ellip|tori|hemi/.test(host.type)){
        var dh = host.D / 2 - (n.rad || 0) - rt + (host.sf || 0);
        add(lbl + ': borde de su soldadura a la circunferencial fondo-virola ≥ ' + dh.toFixed(0) + ' mm (en planta) ' + (dh >= wmin ? '≥ ' : '< ') + wmin + ' mm', dh >= wmin - 1e-6, [z]);
      } else if (host.type === 'flat'){
        var df = (host.d || 0) / 2 - (n.rad || 0) - rt;
        add(lbl + ': borde de su soldadura al borde de la tapa = ' + df.toFixed(0) + ' mm ' + (df >= wmin ? '≥ ' : '< ') + wmin + ' mm', df >= wmin - 1e-6, [z]);
      }
    });
    // entre conexiones del mismo componente
    for (var j = 0; j < nz.length; j++) for (var k2 = j + 1; k2 < nz.length; k2++){
      var A = nz[j], B = nz[k2]; if (A.err || B.err || A.n.host !== B.n.host) continue;
      var h2 = prj.comps.filter(function(c){ return c.id === A.n.host; })[0], ca = nozCenter(prj, L, A.n, h2), cb = nozCenter(prj, L, B.n, h2), dd;
      if (ca.cyl){ var dt = angDist(A.n.theta || 0, B.n.theta || 0) * Math.PI / 180, dx = ca.x - cb.x, dy = (ca.Rm + cb.Rm) / 2 * dt; dd = Math.sqrt(dx * dx + dy * dy); }
      else dd = Math.sqrt(Math.pow(ca.x - cb.x, 2) + Math.pow(ca.y - cb.y, 2));
      var gap = dd - toeR(A.n) - toeR(B.n);
      add(A.n.mark + ' / ' + B.n.mark + ': separación entre bordes de soldadura ' + gap.toFixed(0) + ' mm ' + (gap >= wmin ? '≥ ' : '< ') + wmin + ' mm', gap >= wmin - 1e-6, [A, B]);
    }
    return out;
  }
  // ---------------- aberturas múltiples: UG-42, UG-36(c)(3)(-c), UG-39(b)(2) ----------------
  function nozCenter(prj, L, n, host){
    var th = (n.theta || 0) * Math.PI / 180;
    if (host.type === 'shell' || host.type === 'cone'){ var p = L.pos[host.id], ri = innerR(host, p, p.s0 + (n.a || 0)); return { x: n.a || 0, th: th, Rm: ri + host.tn / 2, cyl: true }; }
    return { x: (n.rad || 0) * Math.cos(th), y: (n.rad || 0) * Math.sin(th), cyl: false };
  }
  function multiOpenings(prj, L, nz){
    var list = [];
    for (var i = 0; i < nz.length; i++) for (var j = i + 1; j < nz.length; j++){
      var a = nz[i], b = nz[j]; if (a.err || b.err || a.n.host !== b.n.host || !a.int || !b.int) continue;
      var host = prj.comps.filter(function(c){ return c.id === a.n.host; })[0], pa = nozCenter(prj, L, a.n, host), pb = nozCenter(prj, L, b.n, host), dist, cth = 1;
      if (pa.cyl){ var dth = Math.abs(pa.th - pb.th) % (2 * Math.PI); if (dth > Math.PI) dth = 2 * Math.PI - dth; var dx = pa.x - pb.x, dy = (pa.Rm + pb.Rm) / 2 * dth; dist = Math.sqrt(dx * dx + dy * dy); cth = dist > 0 ? Math.abs(dx) / dist : 1; }
      else dist = Math.sqrt(Math.pow(pa.x - pb.x, 2) + Math.pow(pa.y - pb.y, 2));
      var d1 = a.int.out.d, d2 = b.int.out.d, X1 = a.int.out.X, X2 = b.int.out.X, dav = (d1 + d2) / 2, item = { a: a.n.mark, b: b.n.mark, dist: dist, checks: [] };
      function add(t, ok, warn, info){ var k = { t: 'UG-42 ' + a.n.mark + '/' + b.n.mark + ': ' + t, ok: ok, warn: !!warn, info: !!info }; item.checks.push(k); a.checks.push(k); b.checks.push(k); if (!ok && !warn && !info){ a.ok = false; b.ok = false; } }
      if (dist < 1e-6){ add('las dos boquillas están en la misma posición', false); list.push(item); continue; }
      if (host.type === 'flat'){
        if (dist >= 2 * dav) add('separación ' + dist.toFixed(0) + ' mm ≥ 2·d medio: refuerzo individual (UG-39(b)(2))', true, false, true);
        else if (dist >= 1.25 * dav) add('separación entre 1,25 y 2 veces el d medio: sumar el refuerzo de ambas y colocar el 50 % entre ellas (UG-39(b)(2))', true, true);
        else add('separación ' + dist.toFixed(0) + ' mm < 1,25·d medio: U-2(g) (UG-39(b)(2))', false);
        var lig = dist - dav; add('ligamento ' + lig.toFixed(0) + ' mm ≥ ¼ del diámetro menor ' + (Math.min(d1, d2) / 4).toFixed(0) + ' mm (UG-39(b)(3))', lig >= Math.min(d1, d2) / 4 - 1e-9);
        list.push(item); continue;
      }
      if (a.int.out.exempt && b.int.out.exempt){
        var okc = dist >= d1 + d2 - 1e-9;
        add('aberturas sin refuerzo: separación entre centros ' + dist.toFixed(0) + ' mm ' + (okc ? '≥' : '<') + ' d1 + d2 = ' + (d1 + d2).toFixed(0) + ' mm (UG-36(c)(3)(-c))', okc, !okc);
        if (!okc){ [a, b].forEach(function(z){ z.int.out.exempt = false; z.exemptLost = true; if (!z.int.out.okA){ z.ok = false; z.checks.push({ t: 'Pierde la exención de UG-36(c)(3) y no cumple el área de refuerzo UG-37', ok: false }); } }); }
        list.push(item); continue;
      }
      if (dist < X1 + X2){
        var ok43 = dist >= 4 / 3 * dav - 1e-9;
        add('los límites de refuerzo se solapan (' + dist.toFixed(0) + ' mm < ' + (X1 + X2).toFixed(0) + ' mm): refuerzo combinado', true, false, true);
        add('separación ≥ 1⅓·d medio = ' + (4 / 3 * dav).toFixed(0) + ' mm', ok43);
        var ov = Math.min(X1 + X2 - dist, 2 * Math.min(X1, X2)), ex = Math.max(0, Math.min(a.int.out.areas.t - a.int.out.areas.tr, b.int.out.areas.t - b.int.out.areas.tr));
        var Aav = a.int.out.Aav + b.int.out.Aav - ov * ex, Areq = a.int.out.A + b.int.out.A;
        add('área combinada (sin contar dos veces la pared común, simplificado) ' + Aav.toFixed(0) + ' mm² ≥ ' + Areq.toFixed(0) + ' mm²', Aav >= Areq - 1e-9);
        if (pa.cyl) add('en cilindros y conos, el área entre aberturas debe ser ≥ 50 % del total requerido; si no, Ap. 1-7(a) y (c) (UG-42(a)(2))', true, false, true);
      }
      if (a.int.out.exempt !== b.int.out.exempt){
        var ex1 = a.int.out.exempt ? a : b, ot = a.int.out.exempt ? b : a, rf = ot.n.pad ? ot.n.Dp / 2 : ot.n.od / 2;
        var okR = dist - rf >= ex1.int.out.d - 1e-9;
        add('el eje de la abertura sin refuerzo ' + ex1.n.mark + ' dista ' + (dist - rf).toFixed(0) + ' mm del refuerzo de ' + ot.n.mark + ' (≥ d = ' + ex1.int.out.d.toFixed(0) + ' mm, UG-36(c)(3))', okR, !okR);
      }
      list.push(item);
    }
    return list;
  }

  // ---------------- uniones cono-cilindro ----------------
  function coneJunctions(prj, c, out){
    var d = prj.design, L = out.L, p = L.pos[c.id], i = prj.comps.indexOf(c), cr = out.byId[c.id];
    if (!cr || !cr.mat || !cr.int) return;
    var largeAtS0 = p.side === 'start' ? c.largeAt !== 'base' : c.largeAt === 'base';
    var ends = [{ end: 'L', s: largeAtS0 ? p.s0 : p.s1, nb: largeAtS0 ? prj.comps[i - 1] : prj.comps[i + 1], dir: largeAtS0 ? -1 : 1, Dc: c.D },
                { end: 'S', s: largeAtS0 ? p.s1 : p.s0, nb: largeAtS0 ? prj.comps[i + 1] : prj.comps[i - 1], dir: largeAtS0 ? 1 : -1, Dc: c.Ds }];
    var cc = c.c != null ? +c.c : +d.c, al = c.alpha * Math.PI / 180, ca = Math.cos(al), tc = c.tn - cc, P = cr.P, Sc = cr.mat.S, Ec = cr.eff ? cr.eff.EA : 1;
    var Lax = axLen(c), Ro = { L: c.D / 2 + c.tn, S: c.Ds / 2 + c.tn };
    var junc = { L: {}, S: {} };
    ends.forEach(function(e){
      var cyl = e.nb && e.nb.type === 'shell' ? e.nb : null, cyR = cyl ? out.byId[cyl.id] : null, ccy = cyl ? (cyl.c != null ? +cyl.c : +d.c) : cc;
      var Lcyl = 0; if (cyl){ for (var k = prj.comps.indexOf(cyl); k >= 0 && k < prj.comps.length && prj.comps[k].type === 'shell'; k += e.dir) Lcyl += prj.comps[k].L; }
      var Ri = cyl ? (cyl.basis === 'od' ? cyl.D / 2 - cyl.tn : cyl.D / 2) : e.Dc / 2, R = Ri + ccy;
      var ax = out.loads && out.loads.axialAt ? out.loads.axialAt(e.s, Ri + (cyl ? cyl.tn : c.tn) / 2) : { fT: 0, fC: 0 };
      var Ss = cyR && cyR.mat ? cyR.mat.S : Sc, E1 = cyR && cyR.eff ? cyR.eff.EA : 1;
      var tr = P * 2 * (e.Dc / 2 + cc) / (2 * ca * (Sc * Ec - 0.6 * P));
      junc[e.end].int = V.cone15({ end: e.end, P: P, Ss: Ss, E1: E1, R: R, ts: cyl ? cyl.tn - ccy : 0, t: cyR && cyR.int ? cyR.int.out.t : 0, tc: tc, tr: tr, alpha: c.alpha, Lcyl: Lcyl, fT: ax.fT,
        ringA: (+c['ring' + e.end + 'h'] || 0) * (+c['ring' + e.end + 'b'] || 0), Sr: Ss });
      if (d.Pext > 0 && cr.mat.ch){
        var RoC = cyl ? Ri + cyl.tn : Ro[e.end], RLo = Ro.L, RSo = Ro.S;
        var nbL = ends[0].nb && ends[0].nb.type === 'shell' ? ends[0].nb : null, nbS = ends[1].nb && ends[1].nb.type === 'shell' ? ends[1].nb : null;
        if (nbL) RLo = (nbL.basis === 'od' ? nbL.D / 2 : nbL.D / 2 + nbL.tn); if (nbS) RSo = (nbS.basis === 'od' ? nbS.D / 2 : nbS.D / 2 + nbS.tn);
        var mC = cyR && cyR.mat && cyR.mat.ch ? cyR.mat : cr.mat, Ex = Math.min(modulus(mC, d.T) || 2e5, modulus(cr.mat, d.T) || 2e5);
        var le = cyl ? extLength(prj, cyl, L) : { L: 0 };
        junc[e.end].ext = V.cone18({ end: e.end, P: d.Pext, Ss: Ss, E1: 1, R: RoC, ts: cyl ? cyl.tn - ccy : 0, t: cyR && cyR.ext && cyR.ext.treq ? cyR.ext.treq - ccy : 0, tc: tc,
          tr: cr.ext && cr.ext.treq ? cr.ext.treq - cc : 0, alpha: c.alpha, Lcyl: Lcyl, fC: Math.max(0, ax.fC), Lsec: le.L, Lc: Math.sqrt(Lax * Lax + Math.pow(RLo - RSo, 2)), RL: RLo, Rs: RSo,
          ringA: (+c['ring' + e.end + 'h'] || 0) * (+c['ring' + e.end + 'b'] || 0), ringH: +c['ring' + e.end + 'h'] || 0, ringB: +c['ring' + e.end + 'b'] || 0, Sr: Ss, chart: mC.ch, T: d.T, ys: mC.ty ? mC.ty[1] : 0, Ex: Ex });
      }
      junc[e.end].f = ax;
    });
    cr.junc = junc;
    var okJ = ['L', 'S'].every(function(k){ return (!junc[k].int || junc[k].int.ok !== false) && (!junc[k].ext || junc[k].ext.ok !== false); });
    cr.okJ = okJ; cr.ok = cr.ok && okJ;
  }
  function endD(c, p, which){
    if (c.type === 'shell') return c.basis === 'od' ? c.D - 2 * c.tn : c.D;
    if (c.type === 'cone') return 2 * innerR(c, p, which === 'lo' ? p.s0 : p.s1);
    if (/ellip|tori|hemi/.test(c.type)) return c.D;
    if (c.type === 'bflange') return c.B;
    return null;
  }

  return { TYPES: TYPES, newProject: newProject, newComp: newComp, newNozzle: newNozzle, defMat: defMat, DEFMAT: DEFMAT, CPL: CPL, applyCpl: applyCpl, layout: layout, axLen: axLen, headDepth: headDepth,
    headProfile: headProfile, headSurfAt: headSurfAt, headNoz: headNoz, innerR: innerR, toriL: toriL, toriR: toriR, compute: compute, nozLoads: nozLoads, courses: courses, splitCyl: splitCyl, plateLim: plateLim, seamClear: seamClear, autoSeams: autoSeams, effFor: effFor, extLength: extLength, hyd: hyd };
})();

/* ===================================================================
   Fase 3: cargas exteriores y soportes.
   Viento: EN 1991-1-4 (+ Anejo Nacional español / CTE DB SE-AE) o ASCE 7-16 cap. 29.
   Sismo: EN 1998-1 (espectro de cálculo, método de fuerzas laterales) o ASCE 7-16 cap. 15.
   Tensiones longitudinales por sección (VIII-2 4.3.10.2 con VIII-1 UG-23, como PTB-4 E4.3.6 / E4.15.2).
   Soportes: faldón, anillo base y pernos de anclaje; cunas por VIII-2 4.15.3 (Zick).
   Unidades internas: mm, N, MPa, kg, s.
   =================================================================== */
var VLOADS = (function(){
  'use strict';
  var V = VESSEL, M = VMODEL;
  var G = 9.80665, RHO_AIR = 1.25, NU_AIR = 15e-6;
  function R(){ return { steps: [], checks: [], out: {} }; }
  function st(r, k, eq, v, u, ref){ r.steps.push({ k: k, eq: eq, v: v, u: u || '', ref: ref || '' }); return v; }
  function ck(r, t, ok, warn){ r.checks.push({ t: t, ok: !!ok, warn: !!warn }); }
  function note(r, t){ r.checks.push({ t: t, ok: true, info: true }); }
  function lerp(x, x0, x1, y0, y1){ return x1 === x0 ? y0 : y0 + (y1 - y0) * (x - x0) / (x1 - x0); }
  function tab(T, x){ if (x <= T[0][0]) return T[0][1]; for (var k = 0; k < T.length - 1; k++){ if (x <= T[k+1][0]) return lerp(x, T[k][0], T[k+1][0], T[k][1], T[k+1][1]); } return T[T.length-1][1]; }
  function num(x, d){ return (x === null || x === undefined || x === '' || isNaN(+x)) ? d : +x; }

  // ---------------- valores por defecto ----------------
  var FAM = {
    EN:   { fp: 1.0, fw: 1.0, fe: 1.0, fd: 1.0, kS: 1.2, txt: 'UG-23(d): 1,2·S en combinaciones con viento o sismo; acciones características de viento y de cálculo de sismo' },
    ASCE: { fp: 0.9, fw: 0.6, fe: 0.7, fd: 0.6, kS: 1.0, txt: 'Combinaciones de VIII-2 Tabla 4.1.2 (0,9P + D + 0,6W ó 0,7E; 0,6D + 0,6W ó 0,7E) con S, como PTB-4 E4.3.6' }
  };
  function defaults(){
    return {
      code: 'EN', windOn: true, seisOn: false,
      en: { vb: 27, cat: 'II', c0: 1.0, cscd: 1.0, k: 0.05, psi: null, cfx: 2.0 },
      asce: { V: 51.4, exp: 'C', Kzt: 1.0, Kd: 0.95, Ke: 1.0, G: 0.85, surf: 'ms' },
      en8: { ag: 0.08, gI: 1.0, soil: 'B', type: 1, q: 1.5 },
      asce7: { SDS: 0.5, SD1: 0.2, S1: 0.1, TL: 8, Ie: 1.0, R: 2.0 },
      ins: { t: 0, rho: 150 }, dExtra: 0, extra: '', T: null,
      fp: null, fw: null, fe: null, fd: null, kS: null
    };
  }
  function defSupport(orient){
    return orient === 'H'
      ? { type: 'saddle', A: 600, theta: 120, b: 200, welded: true, h: 1200, wear: true, twp: 0, sstd: 'EN', sgrade: 'S275JR', bwp: 0, thwp: 0, wmat: { id: 'sa516', vi: 0 },
          tw: 12, tf: 12, Bb: 250, Lbp: null, tbp: 20, smat: { id: 'sa516', vi: 0 }, nbs: 2, eb: null, bsize: 'M24', Ar: 324.3, amat: { id: 'sa193b7', vi: 0 }, fc: 7 }
      : { type: 'legs', H: 2000, t: 10, D: null, mat: { id: 'sa516', vi: 0 }, c: 0, leg: 8, Dbo: null, Dbi: null, tb: 25, bmat: { id: 'sa516', vi: 0 },
          nb: 8, BC: null, bsize: 'M24', Ar: 324.3, amat: { id: 'sa193b7', vi: 0 }, fc: 7,
          lstd: 'EN', lgrade: 'S275JR', lprof: '160', lpt: 0, lpw: 0, lpl: 0, th0: null,
          nl: 'auto', Hl: 1500, Dl: null, lsec: 'pipe', lod: 168.3, lt: 7.11, lA: 0, lI: 0, lZ: 0, lb: 0, lmat: { id: 'sa106b', vi: 0 }, K: 2.0, nbl: 2, lbsize: 'M20', lAr: 225.2,
          zLug: null, Hg: 3000, nlug: 4, Dlug: null, nbg: 2, gbsize: 'M20', gAr: 225.2, nlD: 1000, th0g: null, mH: 250, mL: 200, mS: 150, mt: 12, mb: 20, gstd: 'EN', ggrade: 'S275JR', mpt: 0 };
  }

  // ---------------- aceros estructurales y perfiles europeos ----------------
  // EN 10025-2: [ReH t ≤ 16, t ≤ 40, t ≤ 63, Rm mín. (3 ≤ t ≤ 100)]
  var EN_GR = { S235JR: [235, 225, 215, 360], S275JR: [275, 265, 255, 410], S355JR: [355, 345, 335, 470], S355J2: [355, 345, 335, 470], S355J2H: [355, 345, 335, 470] };
  // HEA / HEB (EN 10365): h, b, tw, tf, r
  var PROF = { HEA: { 100: [96, 100, 5, 8, 12], 120: [114, 120, 5, 8, 12], 140: [133, 140, 5.5, 8.5, 12], 160: [152, 160, 6, 9, 15], 180: [171, 180, 6, 9.5, 15], 200: [190, 200, 6.5, 10, 18], 220: [210, 220, 7, 11, 18], 240: [230, 240, 7.5, 12, 21], 260: [250, 260, 7.5, 12.5, 24], 280: [270, 280, 8, 13, 24], 300: [290, 300, 8.5, 14, 27] },
    HEB: { 100: [100, 100, 6, 10, 12], 120: [120, 120, 6.5, 11, 12], 140: [140, 140, 7, 12, 12], 160: [160, 160, 8, 13, 15], 180: [180, 180, 8.5, 14, 15], 200: [200, 200, 9, 15, 18], 220: [220, 220, 9.5, 16, 18], 240: [240, 240, 10, 17, 21], 260: [260, 260, 10, 17.5, 24], 280: [280, 280, 10.5, 18, 24], 300: [300, 300, 11, 19, 27] } };
  // propiedades respecto al eje débil (pandeo y flexión del lado conservador)
  function profProps(kind, size){
    var g = (PROF[kind] || {})[size]; if (!g) return null;
    var h = g[0], b = g[1], tw = g[2], tf = g[3], r = g[4], hw = h - 2 * tf, af = (1 - Math.PI / 4) * r * r, yf = tw / 2 + r - 0.2234 * r;
    var A = 2 * b * tf + hw * tw + 4 * af, Iz = 2 * tf * b * b * b / 12 + hw * tw * tw * tw / 12 + 4 * af * yf * yf, Wz = 2 * tf * b * b / 4 + hw * tw * tw / 4 + 4 * af * yf;
    var Iy = b * h * h * h / 12 - (b - tw) * hw * hw * hw / 12;
    return { A: A, I: Iz, Iy: Iy, Z: Wz, b: Math.max(b, h), h: h, bf: b, tw: tw, tf: tf, t: tf, name: kind + ' ' + size };
  }
  // acero de un soporte: EN 10025 (perfiles y chapas europeos) o material ASME de II-D
  function steelOf(sp, pre, t){
    if (sp[pre + 'std'] === 'EN'){ var gr = EN_GR[sp[pre + 'grade']] || EN_GR.S275JR, tt = t || 10; return { name: 'EN 10025-2 ' + (sp[pre + 'grade'] || 'S275JR'), Fy: tt <= 16 ? gr[0] : tt <= 40 ? gr[1] : gr[2], Fu: gr[3], rho: 7850, pno: 'EN', en: true }; }
    var m = V.mat(sp[pre + 'mat'], 40); return { name: m ? m.name : '—', Fy: m && m.ty ? m.ty[1] : 240, Fu: m && m.ty ? m.ty[0] : 400, rho: m ? m.rho : 7850, pno: m ? String(m.pno || '').split(' ')[0] : '1', m: m };
  }
  // número de patas: 3 hasta el diámetro límite (D.E. de la virola), 4 por encima; o el impuesto
  function legsN(prj, sp){ if (sp.nl !== 'auto' && sp.nl != null && sp.nl !== '' && !isNaN(+sp.nl)) return Math.max(3, +sp.nl);
    var sh = prj.comps.filter(function(c){ return c.type === 'shell'; })[0], od = sh ? (sh.basis === 'od' ? sh.D : sh.D + 2 * sh.tn) : 1000; return od <= num(sp.nlD, 1000) ? 3 : 4; }
  // ---------------- tablas ----------------
  var CAT = { '0': [0.003, 1], 'I': [0.01, 1], 'II': [0.05, 2], 'III': [0.3, 5], 'IV': [1.0, 10] };            // EN 1991-1-4 Tabla 4.1
  var PSI1 = [[1, 0.60], [2, 0.63], [2.4, 0.65], [5, 0.68], [10, 0.71], [20, 0.77], [30, 0.82], [50, 0.87], [70, 0.91], [100, 0.95], [200, 1.0]]; // Fig. 7.36, φ = 1 (digitalizada)
  var EXP = { B: [7.0, 365.76], C: [9.5, 274.32], D: [11.5, 213.36] };                                           // ASCE 7-16 Tabla 26.11-1 (α, zg en m)
  var CF29 = { ms: [0.5, 0.6, 0.7], r: [0.7, 0.8, 0.9], vr: [0.8, 1.0, 1.2], low: [0.7, 0.8, 1.2] };             // ASCE 7-16 Fig. 29.4-1 (h/D = 1, 7, 25)
  var SOIL1 = { A: [1.0, 0.15, 0.4, 2.0], B: [1.2, 0.15, 0.5, 2.0], C: [1.15, 0.20, 0.6, 2.0], D: [1.35, 0.20, 0.8, 2.0], E: [1.4, 0.15, 0.5, 2.0] };
  var SOIL2 = { A: [1.0, 0.05, 0.25, 1.2], B: [1.35, 0.05, 0.25, 1.2], C: [1.5, 0.10, 0.25, 1.2], D: [1.8, 0.10, 0.30, 1.2], E: [1.6, 0.05, 0.25, 1.2] };

  // ---------------- viento EN 1991-1-4 ----------------
  function qpEN(w, z){ // z en m → N/m²
    var c = CAT[w.cat] || CAT.II, z0 = c[0], zmin = c[1], zz = Math.max(z, zmin);
    var kr = 0.19 * Math.pow(z0 / 0.05, 0.07), lnz = Math.log(zz / z0), cr = kr * lnz, c0 = num(w.c0, 1);
    var vm = cr * c0 * w.vb, Iv = 1 / (c0 * lnz);
    return { qp: (1 + 7 * Iv) * 0.5 * RHO_AIR * vm * vm, kr: kr, cr: cr, Iv: Iv, vm: vm, z0: z0, zmin: zmin };
  }
  function cfEN(w, b, l, ze, r){ // b, l en m
    var q = qpEN(w, ze), v = Math.sqrt(2 * q.qp / RHO_AIR), Re = b * v / NU_AIR, kb = Math.max(w.k, 1e-4) / 1000 / b, cf0;
    if (Re >= 4e5) cf0 = Math.min(1.2, 1.2 + 0.18 * Math.log10(10 * kb) / (1 + 0.4 * Math.log10(Re / 1e6)));
    else cf0 = 1.2;
    var l15 = Math.min(l / b, 70), l50 = Math.min(0.7 * l / b, 70);
    var lam = l <= 15 ? l15 : l >= 50 ? l50 : l15 + (l50 - l15) * (l - 15) / 35;
    var psi = w.psi > 0 ? +w.psi : tab(PSI1, lam);
    if (r){
      st(r, 'v(ze)', '√(2·qp(ze)/ρ),  ze = ' + ze.toFixed(1) + ' m', v, 'ms', 'EN 1991-1-4 7.9.2');
      st(r, 'Re', 'b·v(ze)/ν,  ν = 15·10⁻⁶ m²/s', Re, '', 'EN 1991-1-4 (7.15)');
      st(r, 'k/b', 'rugosidad equivalente ' + w.k + ' mm', kb, '', 'Tabla 7.13');
      st(r, 'cf,0', Re >= 4e5 ? '1,2 + 0,18·log(10k/b) / [1 + 0,4·log(Re/10⁶)]' : '1,2 (Re < 4·10⁵, valor del régimen subcrítico)', cf0, '', 'Fig. 7.28');
      st(r, 'λ', 'esbeltez efectiva, l = ' + l.toFixed(1) + ' m', lam, '', 'Tabla 7.16');
      st(r, 'ψλ', w.psi > 0 ? 'impuesto' : 'Fig. 7.36 con φ = 1 (curva digitalizada)', psi, '', '7.13');
      st(r, 'cf', 'cf,0·ψλ', cf0 * psi, '', '(7.19)');
    }
    return { cf: cf0 * psi, cf0: cf0, psi: psi, Re: Re, lam: lam, v: v };
  }
  // ---------------- viento ASCE 7-16 ----------------
  function qzASCE(w, z){ // z en m → N/m²
    var e = EXP[w.exp] || EXP.C, zz = Math.max(z, 4.6), Kz = 2.01 * Math.pow(Math.min(zz, e[1]) / e[1], 2 / e[0]);
    return { qz: 0.613 * Kz * num(w.Kzt, 1) * num(w.Kd, 0.95) * num(w.Ke, 1) * w.V * w.V, Kz: Kz };
  }
  function cfASCE(w, D, h, r){
    var qh = qzASCE(w, h).qz, hd = Math.max(1, Math.min(25, h / D)), row = D * Math.sqrt(qh) > 5.3 ? CF29[w.surf] || CF29.ms : CF29.low;
    var cf = hd <= 7 ? lerp(hd, 1, 7, row[0], row[1]) : lerp(hd, 7, 25, row[1], row[2]);
    if (r){
      st(r, 'qh', '0,613·Kz·Kzt·Kd·Ke·V²  (z = ' + h.toFixed(1) + ' m)', qh, 'pa', 'ASCE 7-16 (26.10-1)');
      st(r, 'D·√qz', D * Math.sqrt(qh) > 5.3 ? '> 5,3 (SI)' : '≤ 5,3 (SI)', D * Math.sqrt(qh), '', 'Fig. 29.4-1');
      st(r, 'Cf', 'Fig. 29.4-1, redondo, h/D = ' + (h / D).toFixed(2) + (D * Math.sqrt(qh) > 5.3 ? ', superficie ' + ({ ms: 'moderadamente lisa', r: 'rugosa', vr: 'muy rugosa' }[w.surf] || '') : ''), cf, '', 'ASCE 7-16 Fig. 29.4-1');
    }
    return cf;
  }
  // ---------------- espectros ----------------
  function sdEN(s, T){
    var p = (+s.type === 2 ? SOIL2 : SOIL1)[s.soil] || SOIL1.B, S = p[0], TB = p[1], TC = p[2], TD = p[3];
    var ag = s.ag * num(s.gI, 1) * G, q = num(s.q, 1.5), b = 0.2, Sd;
    if (T <= TB) Sd = ag * S * (2 / 3 + T / TB * (2.5 / q - 2 / 3));
    else if (T <= TC) Sd = ag * S * 2.5 / q;
    else if (T <= TD) Sd = Math.max(ag * S * 2.5 / q * TC / T, b * ag);
    else Sd = Math.max(ag * S * 2.5 / q * TC * TD / (T * T), b * ag);
    return { Sd: Sd, S: S, TB: TB, TC: TC, TD: TD, ag: ag, q: q };
  }
  function csASCE(s, T){
    var RI = s.R / num(s.Ie, 1), Cs = s.SDS / RI, lim = '';
    if (T != null && T < 0.06) return { Cs: 0.30 * s.SDS * num(s.Ie, 1), rigid: true, txt: 'T < 0,06 s: estructura rígida, V = 0,30·SDS·W·Ie (15.4-5)' };
    if (T != null){ var cmax = T <= s.TL ? s.SD1 / (T * RI) : s.SD1 * s.TL / (T * T * RI); if (cmax < Cs){ Cs = cmax; lim = 'limitado por SD1/(T·R/Ie)'; } }
    var cmin = Math.max(0.044 * s.SDS * num(s.Ie, 1), 0.03);
    if (s.S1 >= 0.6) cmin = Math.max(cmin, 0.8 * s.S1 / RI);
    if (Cs < cmin){ Cs = cmin; lim = 'mínimo (15.4-1/15.4-2)'; }
    return { Cs: Cs, rigid: false, txt: 'Cs = SDS/(R/Ie)' + (lim ? ', ' + lim : '') };
  }

  // ---------------- discretización del recipiente ----------------
  function geom(prj, base){
    var L = base.L, d = prj.design, H = d.orient === 'H';
    function compAt(s){ for (var k = 0; k < prj.comps.length; k++){ var c = prj.comps[k], p = L.pos[c.id]; if (s >= p.s0 - 1e-6 && s <= p.s1 + 1e-6) return c; } return null; }
    function radii(c, s){ // [r interior, r exterior] en s
      var p = L.pos[c.id];
      if (c.type === 'shell'){ var ri = M.innerR(c, p, s); return [ri, ri + c.tn]; }
      if (c.type === 'cone'){ var rc = M.innerR(c, p, s); return [rc, rc + c.tn / Math.cos(c.alpha * Math.PI / 180)]; }
      if (c.type === 'bflange') return [c.B / 2, c.A / 2];
      if (c.type === 'flat') return [0, (c.d || 0) / 2 + c.tn];
      var q = p.side === 'start' ? p.s1 - s : s - p.s0, pr = M.headProfile(c);
      var oc = Object.assign({}, c, { D: c.D + 2 * c.tn }); if (c.type === 'ellip') oc.ratio = (c.D + 2 * c.tn) / (2 * (M.headDepth(c) + c.tn)); if (c.type === 'tori'){ oc.Lc = M.toriL(c) + c.tn; oc.rk = M.toriR(c) + c.tn; }
      var po = M.headProfile(oc);
      function at(pp){ if (q <= pp[0][0]) return pp[0][1]; for (var k = 1; k < pp.length; k++){ if (q <= pp[k][0]) return lerp(q, pp[k-1][0], pp[k][0], pp[k-1][1], pp[k][1]); } return 0; }
      return [at(pr), at(po)];
    }
    return { compAt: compAt, radii: radii };
  }
  function parseExtra(txt){
    var out = [];
    String(txt || '').split(/\n/).forEach(function(l){
      var p = l.split(/[;\t]/).map(function(x){ return x.trim(); });
      if (p.length < 2 || isNaN(parseFloat(p[0].replace(',', '.')))) return;
      out.push({ s: parseFloat(p[0].replace(',', '.')), m: parseFloat((p[1] || '0').replace(',', '.')) || 0, A: parseFloat((p[2] || '0').replace(',', '.')) || 0, t: p[3] || '' });
    });
    return out;
  }

  // ---------------- tensiones en una sección (VIII-2 4.3.10.2, UG-23) ----------------
  // i: Di (corroído), Do (nominal), P (presión en la sección, + interior), Pl (presión para el término longitudinal), F (fuerza axial, + tracción), Mb, E (circ.), El (long.)
  function secStress(i){
    var D = i.Di, Do = i.Do, t = (Do - D) / 2, Rr = D / 2;
    var sth = (i.P * Rr / t + 0.6 * i.P) / (i.El || 1);
    var a = i.Pl * D * D / (Do * Do - D * D), b = 4 * i.F / (Math.PI * (Do * Do - D * D)), c = 32 * i.Mb * Do / (Math.PI * (Math.pow(Do, 4) - Math.pow(D, 4)));
    var smax = (a + b + c) / (i.E || 1), smin = a + b - c;
    return { sth: sth, smax: smax, smin: smin, t: t, sr: -0.5 * i.P };
  }
  function Bcomp(m, T, Ro, t){ // UG-23(b)
    if (!m || !m.ch) return { B: null };
    var A = 0.125 / (Ro / t), fb = V.factorB(m.ch, T, A, m.ty ? m.ty[1] : 0);
    if (fb.err) return { B: null, err: fb.err, A: A };
    return { B: Math.min(fb.B, m.S), A: A, Braw: fb.B };
  }

  // ---------------- Zick: VIII-2 4.15.3 ----------------
  // i: Q, L, a, Rm, t, h2, th, theta (°), b, P, S, Sh, E, k (0,1 soldada / 1), wear {tr, b1, th1, S}, Bc (compresión admisible), kS, Ph (presión en el fondo, membrana)
  function zick(i){
    var r = R(), Q = i.Q, L = i.L, a = i.a, Rm = i.Rm, t = i.t, h2 = i.h2, th = i.theta * Math.PI / 180, kS = i.kS || 1;
    st(r, 'Q', 'carga por cuna', Q, 'f', '4.15.3.2');
    ck(r, 'θ = ' + i.theta + '° ≥ 120° (apoyo continuo en al menos 1/3 de la circunferencia)', i.theta >= 120 - 1e-9);
    ck(r, 'a = ' + a.toFixed(0) + ' mm ≤ 0,25·L = ' + (0.25 * L).toFixed(0) + ' mm', a <= 0.25 * L + 1e-9);
    var M1 = st(r, 'M1', '−Q·a·[1 − (1 − a/L + (Rm² − h2²)/(2aL)) / (1 + 4h2/(3L))]', -Q * a * (1 - (1 - a / L + (Rm * Rm - h2 * h2) / (2 * a * L)) / (1 + 4 * h2 / (3 * L))), 'm', '(4.15.1)');
    var M2 = st(r, 'M2', '(Q·L/4)·[(1 + 2(Rm² − h2²)/L²)/(1 + 4h2/(3L)) − 4a/L]', Q * L / 4 * ((1 + 2 * (Rm * Rm - h2 * h2) / (L * L)) / (1 + 4 * h2 / (3 * L)) - 4 * a / L), 'm', '(4.15.2)');
    var T = st(r, 'T', 'Q·(L − 2a)/(L + 4h2/3)', Q * (L - 2 * a) / (L + 4 * h2 / 3), 'f', '(4.15.3)');
    var pm = i.P * Rm / (2 * t), Ilong = Math.PI * Rm * Rm * t;
    var s1 = st(r, 'σ1 (arriba, centro)', 'P·Rm/(2t) − M2/(π·Rm²·t)', pm - M2 / Ilong, 's', '(4.15.6)');
    var s2 = st(r, 'σ2 (abajo, centro)', 'P·Rm/(2t) + M2/(π·Rm²·t)', pm + M2 / Ilong, 's', '(4.15.7)');
    var stiff = a <= 0.5 * Rm, K1 = 1, K1s = 1;
    if (!stiff){
      var D = Math.PI / 6 + 5 * th / 12, sD = Math.sin(D), cD = Math.cos(D), num1 = D + sD * cD - 2 * sD * sD / D;
      K1 = st(r, 'K1', '(Δ + senΔ·cosΔ − 2sen²Δ/Δ) / [π·(senΔ/Δ − cosΔ)],  Δ = π/6 + 5θ/12 = ' + D.toFixed(4) + ' rad', num1 / (Math.PI * (sD / D - cD)), '', 'Tabla 4.15.1');
      K1s = st(r, 'K1*', '(Δ + senΔ·cosΔ − 2sen²Δ/Δ) / [π·(1 − senΔ/Δ)]', num1 / (Math.PI * (1 - sD / D)), '', 'Tabla 4.15.1');
    } else note(r, 'a ≤ 0,5·Rm: la virola se considera rigidizada por el fondo (K1 = K1* = 1).');
    var s3 = st(r, 'σ3* (puntos A y B)', 'P·Rm/(2t) − M1/(K1·π·Rm²·t)', pm - M1 / (K1 * Ilong), 's', '(4.15.10)');
    var s4 = st(r, 'σ4* (abajo, en la cuna)', 'P·Rm/(2t) + M1/(K1*·π·Rm²·t)', pm + M1 / (K1s * Ilong), 's', '(4.15.11)');
    var okL = true;
    [['σ1', s1], ['σ2', s2], ['σ3*', s3], ['σ4*', s4]].forEach(function(x){
      if (x[1] >= 0){ var ok = x[1] <= kS * i.S * i.E + 1e-9; okL = okL && ok; ck(r, x[0] + ' = ' + x[1].toFixed(1) + ' MPa ≤ ' + (kS !== 1 ? kS.toFixed(1) + '·' : '') + 'S·E = ' + (kS * i.S * i.E).toFixed(1) + ' MPa', ok); }
      else if (i.Bc != null){ var ok2 = -x[1] <= kS * i.Bc + 1e-9; okL = okL && ok2; ck(r, x[0] + ' = ' + x[1].toFixed(1) + ' MPa (compresión) ≤ ' + (kS !== 1 ? kS.toFixed(1) + '·' : '') + 'B = ' + (kS * i.Bc).toFixed(1) + ' MPa (UG-23(b))', ok2); }
      else ck(r, x[0] + ' en compresión: no se ha podido obtener B (UG-23(b))', false, true);
    });
    // cortante
    var al = 0.95 * (Math.PI - th / 2), sa = Math.sin(al), ca = Math.cos(al), den = Math.PI - al + sa * ca, tau, okT = true, Clim = 0.8;
    if (!stiff){
      var K2 = st(r, 'K2', 'sen α / (π − α + sen α·cos α),  α = 0,95·(π − θ/2) = ' + al.toFixed(4) + ' rad', sa / den, '', 'Tabla 4.15.1');
      tau = st(r, 'τ2', 'K2·T/(Rm·t)', K2 * T / (Rm * t), 's', '(4.15.14)');
      okT = tau <= Clim * kS * i.S + 1e-9; ck(r, 'τ2 = ' + tau.toFixed(1) + ' MPa ≤ 0,8·S = ' + (Clim * kS * i.S).toFixed(1) + ' MPa', okT);
    } else {
      var K3 = st(r, 'K3', '(sen α/π)·(α − sen α·cos α)/(π − α + sen α·cos α)', sa / Math.PI * (al - sa * ca) / den, '', 'Tabla 4.15.1');
      var K4 = st(r, 'K4', '(3/8)·sen²α/(π − α + sen α·cos α)', 3 / 8 * sa * sa / den, '', 'Tabla 4.15.1');
      tau = st(r, 'τ3 (virola)', 'K3·Q/(Rm·t)', K3 * Q / (Rm * t), 's', '(4.15.15)');
      var tauh = st(r, 'τ3* (fondo)', 'K3·Q/(Rm·th)', K3 * Q / (Rm * i.th), 's', '(4.15.16)');
      var s5 = st(r, 'σ5 (fondo)', 'K4·Q/(Rm·th) + tensión de membrana del fondo', K4 * Q / (Rm * i.th) + (i.Ph || 0), 's', '(4.15.17)');
      okT = tau <= Clim * kS * i.S + 1e-9 && tauh <= Clim * kS * i.Sh + 1e-9 && s5 <= 1.25 * kS * i.Sh + 1e-9;
      ck(r, 'τ3 = ' + tau.toFixed(1) + ' y τ3* = ' + tauh.toFixed(1) + ' MPa ≤ 0,8·S; σ5 = ' + s5.toFixed(1) + ' MPa ≤ 1,25·Sh', okT);
    }
    // circunferencial
    var bt = Math.PI - th / 2, sb = Math.sin(bt), cb = Math.cos(bt), x = sb / bt;
    var den6 = 2 * Math.PI * (x * x - 0.5 - Math.sin(2 * bt) / (4 * bt));
    var K6 = st(r, 'K6', 'Tabla 4.15.1, β = π − θ/2 = ' + bt.toFixed(4) + ' rad',
      (3 * cb / 4 * x * x - 5 * sb * cb * cb / (4 * bt) + Math.pow(cb, 3) / 2 - sb / (4 * bt) + cb / 4 - bt * sb * (x * x - 0.5 - Math.sin(2 * bt) / (4 * bt))) / den6, '', 'Tabla 4.15.1');
    var ar = a / Rm, K7 = st(r, 'K7', ar >= 1 ? 'K6  (a/Rm ≥ 1)' : ar <= 0.5 ? 'K6/4  (a/Rm ≤ 0,5)' : 'interpolado entre K6/4 y K6', ar >= 1 ? K6 : ar <= 0.5 ? K6 / 4 : lerp(ar, 0.5, 1, K6 / 4, K6), '', 'Tabla 4.15.1');
    var x1 = Math.min(0.78 * Math.sqrt(Rm * t), Math.max(0, a - 0.5 * i.b));
    st(r, 'x1 = x2', '0,78·√(Rm·t)' + (x1 < 0.78 * Math.sqrt(Rm * t) - 1e-6 ? ', limitado por a' : ''), x1, 'len', '4.15.3.5(b)');
    var K5 = st(r, 'K5', '(1 + cos α)/(π − α + sen α·cos α)', (1 + ca) / den, '', 'Tabla 4.15.1');
    var k = i.k != null ? i.k : 0.1, te = t, eta = 1, wp = i.wear && i.wear.tr > 0;
    if (wp){ eta = Math.min(1, (i.wear.S || i.S) / i.S); te = t + eta * i.wear.tr; st(r, 't + η·tr', 'chapa de desgaste, η = mín(Sr/S ; 1)', te, 'len', '4.15.3.5(c)'); }
    var wd = i.b + 2 * x1;
    var s6 = st(r, 'σ6', '−K5·Q·k / [t·(b + x1 + x2)],  k = ' + k, -K5 * Q * k / (te * wd), 's', '(4.15.23)');
    var s7 = L >= 8 * Rm ? st(r, 'σ7 (cuerno)', '−Q/[4t(b + x1 + x2)] − 3·K7·Q/(2t²)  (L ≥ 8Rm)', -Q / (4 * te * wd) - 3 * K7 * Q / (2 * te * te), 's', '(4.15.24)')
                         : st(r, 'σ7 (cuerno)', '−Q/[4t(b + x1 + x2)] − 12·K7·Q·Rm/(L·t²)  (L < 8Rm)', -Q / (4 * te * wd) - 12 * K7 * Q * Rm / (L * te * te), 's', '(4.15.25)');
    var okC = Math.abs(s6) <= kS * i.S + 1e-9 && Math.abs(s7) <= 1.25 * kS * i.S + 1e-9;
    ck(r, '|σ6| = ' + Math.abs(s6).toFixed(1) + ' MPa ≤ S = ' + (kS * i.S).toFixed(1) + ' MPa', Math.abs(s6) <= kS * i.S + 1e-9);
    ck(r, '|σ7| = ' + Math.abs(s7).toFixed(1) + ' MPa ≤ 1,25·S = ' + (1.25 * kS * i.S).toFixed(1) + ' MPa', Math.abs(s7) <= 1.25 * kS * i.S + 1e-9);
    if (wp){
      var th1 = (i.wear.th1 > 0 ? i.wear.th1 : i.theta + 12) * Math.PI / 180, b1 = i.wear.b1 > 0 ? i.wear.b1 : i.b + 1.56 * Math.sqrt(Rm * t);
      ck(r, 'Chapa de desgaste: ancho b1 ≥ b + 1,56·√(Rm·t) y ángulo θ1 ≥ θ + 12° (si no, no reduce σ6/σ7)', b1 >= i.b + 1.56 * Math.sqrt(Rm * t) - 1e-6 && th1 >= th + 12 * Math.PI / 180 - 1e-9, true);
      var b2 = Math.PI - th1 / 2, s2b = Math.sin(b2), c2b = Math.cos(b2), x2b = s2b / b2, d2 = 2 * Math.PI * (x2b * x2b - 0.5 - Math.sin(2 * b2) / (4 * b2));
      var K6e = (3 * c2b / 4 * x2b * x2b - 5 * s2b * c2b * c2b / (4 * b2) + Math.pow(c2b, 3) / 2 - s2b / (4 * b2) + c2b / 4 - b2 * s2b * (x2b * x2b - 0.5 - Math.sin(2 * b2) / (4 * b2))) / d2;
      var K7e = ar >= 1 ? K6e : ar <= 0.5 ? K6e / 4 : lerp(ar, 0.5, 1, K6e / 4, K6e), wd2 = b1 + 2 * x1;
      var s7e = st(r, 'σ7* (borde de la chapa)', 'como σ7 con θ1 y t de la virola', L >= 8 * Rm ? -Q / (4 * t * wd2) - 3 * K7e * Q / (2 * t * t) : -Q / (4 * t * wd2) - 12 * K7e * Q * Rm / (L * t * t), 's', '(4.15.29)–(4.15.30)');
      var ok7 = Math.abs(s7e) <= 1.25 * kS * i.S + 1e-9; okC = okC && ok7;
      ck(r, '|σ7*| = ' + Math.abs(s7e).toFixed(1) + ' MPa ≤ 1,25·S', ok7);
    }
    var Fh = st(r, 'Fh', 'Q·[(1 + cos β − 0,5·sen²β)/(π − β + sen β·cos β)]', Q * (1 + cb - 0.5 * sb * sb) / (Math.PI - bt + sb * cb), 'f', '(4.15.42)');
    note(r, 'Fh es la fuerza de separación horizontal en la sección mínima de la cuna; la cuna (alma, placa base) se dimensiona aparte.');
    return { r: r, ok: okL && okT && okC, M1: M1, M2: M2, T: T, s: [s1, s2, s3, s4], tau: tau, s6: s6, s7: s7, Fh: Fh, K6: K6 };
  }

  // ---------------- cálculo principal ----------------
  function run(prj, base){
    var d = prj.design, H = d.orient === 'H', Lr = base.L, gm = geom(prj, base);
    var ld = Object.assign(defaults(), prj.loads || {}), sp = prj.support || defSupport(d.orient);
    var fam = FAM[ld.code] || FAM.EN, fp = num(ld.fp, fam.fp), fw = num(ld.fw, fam.fw), fe = num(ld.fe, fam.fe), fd = num(ld.fd, fam.fd), kS = num(ld.kS, fam.kS);
    var out = { code: ld.code, fam: fam, f: { fp: fp, fw: fw, fe: fe, fd: fd, kS: kS }, r: R(), sec: [], ok: true, checks: [] };
    var r = out.r;
    // ---- rodajas a lo largo del eje
    var s0 = Lr.smin, s1 = Lr.smax, n = Math.max(40, Math.min(600, Math.ceil((s1 - s0) / 50))), ds = (s1 - s0) / n;
    var sl = [];
    for (var k = 0; k < n; k++){ var sm = s0 + (k + 0.5) * ds, c = gm.compAt(sm); sl.push({ s: sm, ds: ds, c: c, rr: c ? gm.radii(c, sm) : [0, 0], mM: 0, mL: 0, mT: 0, mI: 0, A: 0 }); }
    // metal: masa de cada componente repartida uniformemente en su longitud axial
    base.comps.forEach(function(cr){ var p = Lr.pos[cr.c.id], len = Math.max(p.s1 - p.s0, 1e-6);
      sl.forEach(function(x){ var ov = Math.max(0, Math.min(p.s1, x.s + ds / 2) - Math.max(p.s0, x.s - ds / 2)); if (ov > 0) x.mM += (cr.mass || 0) * ov / len; }); });
    // boquillas (masa puntual)
    var nzS = [];
    base.nozzles.forEach(function(nr){ var nz = nr.n, host = prj.comps.filter(function(c){ return c.id === nz.host; })[0]; if (!host) return; var p = Lr.pos[host.id];
      var s = host.type === 'shell' || host.type === 'cone' ? p.s0 + (nz.a || 0) : (p.side === 'start' ? p.s0 + 0.3 * (p.s1 - p.s0) : p.s1 - 0.3 * (p.s1 - p.s0)); nzS.push({ s: s, m: nr.mass || 0 }); });
    function addPoint(s, m, A){ var kk = Math.max(0, Math.min(n - 1, Math.floor((s - s0) / ds))); sl[kk].mM += m; sl[kk].A += A || 0; }
    nzS.forEach(function(x){ addPoint(x.s, x.m); });
    // aislamiento
    var ti = num(ld.ins.t, 0), rhoI = num(ld.ins.rho, 0);
    if (ti > 0) sl.forEach(function(x){ if (x.rr[1] > 0) x.mI = Math.PI * (2 * x.rr[1] + ti) * ti * ds * rhoI * 1e-9; });
    // cargas adicionales
    var extra = parseExtra(ld.extra);
    extra.forEach(function(e){ var s = H && d.hdir === 'L' ? -e.s : e.s; addPoint(Math.max(s0, Math.min(s1 - 1e-6, s)), e.m, e.A * 1e6); });
    // líquido (servicio) y agua (prueba)
    var zL = d.level != null && d.level !== '' ? +d.level : null;
    var Dmax = 0; prj.comps.forEach(function(c){ Dmax = Math.max(Dmax, c.D || 0); });
    sl.forEach(function(x){
      var ri = x.rr[0]; if (!(ri > 0) || !x.c || /flat/.test(x.c.type)) return;
      var Afull = Math.PI * ri * ri;
      x.mT = Afull * ds * 1000 * 1e-9;
      if (!H){ x.mL = (zL == null || x.s <= zL) ? Afull * ds * d.rho * 1e-9 : 0; }
      else {
        var hl = zL == null ? 2 * ri : Math.min(2 * ri, Math.max(0, zL - (Dmax / 2 - ri))), th = 2 * Math.acos(Math.max(-1, Math.min(1, (ri - hl) / ri)));
        x.mL = 0.5 * ri * ri * (th - Math.sin(th)) * ds * d.rho * 1e-9;
      }
    });
    var mEmpty = 0, mOper = 0, mTest = 0;
    sl.forEach(function(x){ mEmpty += x.mM + x.mI; mOper += x.mM + x.mI + x.mL; mTest += x.mM + x.mI + x.mT; });
    out.mass = { empty: mEmpty, oper: mOper, test: mTest };

    var res = H ? horizontal(prj, base, ld, sp, sl, out) : vertical(prj, base, ld, sp, sl, out);
    return res;
  }

  // ---------------- recipiente vertical ----------------
  function vertical(prj, base, ld, sp, sl, out){
    var d = prj.design, Lr = base.L, r = out.r, f = out.f;
    // unión del faldón: fondo del componente más bajo que sea virola (línea de tangencia del fondo inferior)
    var low = prj.comps[0], sAtt = Lr.pos[low.id].s0;
    for (var k = 0; k < prj.comps.length; k++){ var c = prj.comps[k]; if (c.type === 'shell' || c.type === 'cone' || c.type === 'bflange'){ sAtt = Lr.pos[c.id].s0; break; } }
    var skirt = sp && sp.type === 'skirt', legs = sp && sp.type === 'legs', lugs = sp && sp.type === 'lugs', supp = skirt || legs || lugs;
    var Hs = skirt ? num(sp.H, 0) : 0, Hl = legs ? num(sp.Hl, 1500) : 0;
    var shL = prj.comps.filter(function(c){ return c.type === 'shell'; })[0], sMid = (Lr.smin + Lr.smax) / 2;
    if (shL){ var csL = M.courses(prj, shL), crT = csL.list[csL.list.length - 1]; sMid = Lr.pos[shL.id].s0 + (crT.z0 + crT.z1) / 2 - num(sp.mH, 250) / 2; }
    var sB = lugs ? (sp.zLug != null && sp.zLug !== '' ? +sp.zLug : sMid) : supp ? sAtt : Lr.smin;
    var zg = skirt ? sAtt - Hs : legs ? sAtt - Hl : lugs ? sB - num(sp.Hg, 0) : Lr.smin; // cota (s) del suelo
    var zb = lugs ? sB : zg;                                                              // base del voladizo estructural
    out.sB = sB; out.supp = sp ? sp.type : 'none';
    if (skirt && zg > Lr.smin + 1e-6) ck(r, 'El fondo inferior queda por debajo de la base del faldón (altura del faldón < profundidad del fondo)', false, true);
    out.zg = zg; out.sAtt = sAtt; out.Hs = Hs;
    var shellAtt = prj.comps.filter(function(c){ return Lr.pos[c.id].s0 === sAtt; })[0] || low;
    var Ds = skirt ? (sp.D > 0 ? +sp.D : (shellAtt.D + (shellAtt.basis === 'od' ? 0 : 2 * shellAtt.tn))) : 0; // D.E. del faldón
    var mSk = skirt ? V.mat(sp.mat, d.T) : null, tsk = skirt ? num(sp.t, 10) : 0, csk = skirt ? num(sp.c, 0) : 0;
    // rodajas del faldón
    var nk = skirt ? Math.max(4, Math.ceil(Hs / 100)) : 0, dk = nk ? Hs / nk : 0, skS = [];
    for (var j = 0; j < nk; j++){ var s = zg + (j + 0.5) * dk; skS.push({ s: s, ds: dk, c: null, sk: true, rr: [Ds / 2 - tsk, Ds / 2], mM: Math.PI * (Ds - tsk) * tsk * dk * (mSk ? mSk.rho : 7850) * 1e-9, mL: 0, mT: 0, mI: 0, A: 0 }); }
    // patas: rodajas de soporte (masa, rigidez conjunta n·E·I y área al viento n·b)
    var LG = null;
    if (legs){
      var nl = legsN(prj, sp), lm = V.mat(sp.lmat, 40);
      if (sp.lsec === 'HEB' || sp.lsec === 'HEA') LG = profProps(sp.lsec, String(sp.lprof || '160')) || profProps('HEB', '160');
      else if (sp.lsec === 'user') LG = { A: num(sp.lA, 0), I: num(sp.lI, 0), Z: num(sp.lZ, 0), b: num(sp.lb, 100) };
      else { var lo = num(sp.lod, 168.3), li = lo - 2 * num(sp.lt, 7.11); LG = { A: Math.PI / 4 * (lo * lo - li * li), I: Math.PI / 64 * (Math.pow(lo, 4) - Math.pow(li, 4)), Z: (Math.pow(lo, 3) - Math.pow(li, 3)) / 6, b: lo }; }
      LG.r = Math.sqrt(LG.I / Math.max(LG.A, 1e-9)); LG.n = nl; LG.m = lm; LG.st = steelOf(sp, 'l', LG.t || num(sp.lt, 7.11));
      var nkl = Math.max(4, Math.ceil(Hl / 100)), dkl = Hl / nkl;
      for (var jl = 0; jl < nkl; jl++) skS.push({ s: zg + (jl + 0.5) * dkl, ds: dkl, c: null, sk: true, leg: true, rr: [0, nl * LG.b / 2], mM: nl * LG.A * dkl * (lm ? lm.rho : 7850) * 1e-9, mL: 0, mT: 0, mI: 0, A: 0 });
    }
    var all = skS.concat(sl.filter(function(x){ return x.s >= zg; }));
    var Htot = (Lr.smax - zg) / 1000; // m
    st(r, 'Altura total', 'desde la base del faldón hasta la parte superior', Htot * 1000, 'len');
    if (skirt) st(r, 'Masa del faldón', '', skS.reduce(function(a, x){ return a + x.mM; }, 0), 'kg');
    // rigidez
    function EI(x){
      var c = x.c, E = 2e5;
      if (x.leg) return 2e5 * LG.n * LG.I;
      if (x.sk){ var Rm = (Ds - tsk) / 2; if (mSk && mSk.ch){ var fb = V.factorB(mSk.ch, Math.min(d.T, 40), 1e-6, 0); if (fb && !fb.err) E = fb.E; } return E * Math.PI * Rm * Rm * Rm * tsk; }
      if (!c) return 1e30;
      var cr = base.byId[c.id], m = cr && cr.mat; if (m && m.ch){ var fb2 = V.factorB(m.ch, d.T, 1e-6, 0); if (fb2 && !fb2.err) E = fb2.E; }
      var t = c.type === 'shell' || c.type === 'cone' ? c.tn : (c.type === 'bflange' ? (c.A - c.B) / 2 : c.tn);
      var Rmx = (x.rr[0] + x.rr[1]) / 2;
      if (!/shell|cone/.test(c.type)){ var shl = prj.comps.filter(function(q){ return q.type === 'shell'; })[0]; if (shl){ Rmx = shl.D / 2 + shl.tn / 2; t = shl.tn * 10; } }
      return E * Math.PI * Rmx * Rmx * Rmx * Math.max(t, 1);
    }
    var order = all.map(function(x, i){ return i; }).sort(function(a, b){ return sEff(all[a]) - sEff(all[b]); });
    function sEff(x){ return supp && !x.sk ? Math.max(x.s, sB) : x.s; }
    function period(field){
      var z = all.map(function(x){ return sEff(x) - zb; }), mm = all.map(function(x){ return x.mM + x.mI + (field === 'L' ? x.mL : field === 'T' ? x.mT : 0); });
      var nn = all.length, Mz = new Array(nn), y = new Array(nn);
      for (var a1 = 0; a1 < nn; a1++){ var acc1 = 0; for (var b1 = 0; b1 < nn; b1++) if (z[b1] > z[a1]) acc1 += mm[b1] * G * (z[b1] - z[a1]); Mz[a1] = acc1; }
      var th = 0, yy = 0, zp = 0;
      order.forEach(function(a2){ if (!all[a2].sk && supp && all[a2].s < sB){ return; } var dz = z[a2] - zp, kap = Mz[a2] / EI(all[a2]); yy += th * dz + kap * dz * dz / 2; th += kap * dz; y[a2] = yy; zp = z[a2]; });
      order.forEach(function(a3){ if (y[a3] == null){ var best = 0; order.forEach(function(b3){ if (y[b3] != null && z[b3] <= z[a3] + 1e-6) best = y[b3]; }); y[a3] = best; } });
      var s1 = 0, s2 = 0; for (var c2 = 0; c2 < nn; c2++){ s1 += mm[c2] * y[c2] * y[c2]; s2 += mm[c2] * y[c2]; }
      return { T: 2 * Math.PI * Math.sqrt(s1 / (G * s2) / 1000), y: y, m: mm, z: z };
    }
    var pO = period('L'), pE = period('E');
    var Tuse = ld.T > 0 ? +ld.T : pO.T;
    st(r, 'T1 (servicio)', 'Rayleigh, voladizo empotrado en ' + (lugs ? 'las ménsulas (apoyo rígido)' : legs ? 'la base de las patas (patas en voladizo, n·E·I)' : 'la base') + ', masas en servicio' + (ld.T > 0 ? ' — se usa T impuesto = ' + (+ld.T).toFixed(3) + ' s' : ''), pO.T, 'sec', 'EN 1998-1 4.3.3.2.2(5) / ASCE 7-16 15.4.4');
    st(r, 'T1 (vacío)', 'Rayleigh, masas en vacío', pE.T, 'sec');
    // ---- viento
    var wind = { F: all.map(function(){ return 0; }) }, D_eff = function(x){ return 2 * (x.rr[1] + (x.sk ? 0 : num(ld.ins.t, 0))) + (x.sk ? 0 : num(ld.dExtra, 0)); };
    if (ld.windOn){
      var dm = 0, hh = 0; all.forEach(function(x){ dm += D_eff(x) * x.ds; hh += x.ds; }); dm = dm / hh / 1000; // diámetro medio (m)
      if (ld.code === 'EN'){
        var cq = qpEN(ld.en, Htot), cf = cfEN(ld.en, dm, Htot, Htot, r);
        st(r, 'qp(h)', '[1 + 7·Iv(z)]·½·ρ·vm²(z),  vb = ' + ld.en.vb + ' m/s, categoría ' + ld.en.cat + ', c0 = ' + num(ld.en.c0, 1), cq.qp, 'pa', 'EN 1991-1-4 (4.8)');
        st(r, 'cs·cd', ld.en.cscd != 1 ? 'impuesto' : '1,0 (procedimiento simplificado; verificar 6.3 si la estructura es sensible a efectos dinámicos)', num(ld.en.cscd, 1), '', 'EN 1991-1-4 6.2');
        all.forEach(function(x, i){ if (skirt && !x.sk && x.s < sAtt) return; var z = (x.s - zg) / 1000; wind.F[i] = num(ld.en.cscd, 1) * cf.cf * qpEN(ld.en, z).qp * D_eff(x) / 1000 * x.ds / 1000 + (x.A > 0 ? num(ld.en.cscd, 1) * num(ld.en.cfx, 2) * qpEN(ld.en, z).qp * x.A * 1e-6 : 0); });
        wind.info = { q: cq.qp, cf: cf.cf };
      } else {
        var cfA = cfASCE(ld.asce, dm, Htot, r);
        st(r, 'G', ld.asce.G != 0.85 ? 'impuesto' : '0,85 (estructura rígida, n1 ≥ 1 Hz)', num(ld.asce.G, 0.85), '', 'ASCE 7-16 26.11.1');
        if (1 / pO.T < 1) ck(r, 'Frecuencia propia ' + (1 / pO.T).toFixed(2) + ' Hz < 1 Hz: estructura flexible; G debe calcularse según 26.11.5 (introducir G)', ld.asce.G != 0.85, true);
        all.forEach(function(x, i){ if (skirt && !x.sk && x.s < sAtt) return; var z = (x.s - zg) / 1000, q = qzASCE(ld.asce, z).qz; wind.F[i] = q * num(ld.asce.G, 0.85) * cfA * D_eff(x) / 1000 * x.ds / 1000 + (x.A > 0 ? q * num(ld.asce.G, 0.85) * 2.0 * x.A * 1e-6 : 0); });
        wind.info = { q: qzASCE(ld.asce, Htot).qz, cf: cfA };
      }
      if (ld.code === 'EN' && 1 / pO.T < 1) ck(r, 'Frecuencia propia ' + (1 / pO.T).toFixed(2) + ' Hz < 1 Hz: comprobar el factor estructural cs·cd (EN 1991-1-4 6.3) y el desprendimiento de torbellinos (Anejo E)', ld.en.cscd != 1, true);
      wind.V = wind.F.reduce(function(a, b){ return a + b; }, 0);
      st(r, 'Cortante de viento en la base', 'Σ F(z)', wind.V, 'f', ld.code === 'EN' ? 'EN 1991-1-4 (5.3)' : 'ASCE 7-16 (29.4-1)');
    }
    // ---- sismo
    var seis = { F: all.map(function(){ return 0; }) };
    if (ld.seisOn){
      var mm = pO.m, y = pO.y, Mt = mm.reduce(function(a, b){ return a + b; }, 0), Fb;
      if (ld.code === 'EN'){
        var sd = sdEN(ld.en8, Tuse);
        st(r, 'Sd(T1)', 'espectro de cálculo tipo ' + ld.en8.type + ', suelo ' + ld.en8.soil + ' (S = ' + sd.S + ', TB = ' + sd.TB + ', TC = ' + sd.TC + ', TD = ' + sd.TD + ' s), ag = ' + (ld.en8.ag * num(ld.en8.gI, 1)).toFixed(3) + '·g, q = ' + sd.q, sd.Sd, 'acc', 'EN 1998-1 3.2.2.5');
        Fb = st(r, 'Fb', 'Sd(T1)·m·λ,  λ = 1', sd.Sd * Mt, 'f', 'EN 1998-1 (4.5)');
        var den = 0; mm.forEach(function(m, i){ den += m * y[i]; });
        seis.F = mm.map(function(m, i){ return Fb * m * y[i] / den; });
        note(r, 'Distribución de fuerzas sísmicas proporcional a m·s (forma modal de Rayleigh), EN 1998-1 4.3.3.2.3. Componente vertical no considerada.');
        seis.Ev = 0;
      } else {
        var cs = csASCE(ld.asce7, Tuse);
        st(r, 'Cs', cs.txt + ',  SDS = ' + ld.asce7.SDS + ', SD1 = ' + ld.asce7.SD1 + ', R = ' + ld.asce7.R + ', Ie = ' + num(ld.asce7.Ie, 1), cs.Cs, '', 'ASCE 7-16 15.4.1, 12.8');
        Fb = st(r, 'V', 'Cs·W', cs.Cs * Mt * G, 'f', 'ASCE 7-16 (12.8-1)');
        var kk = Tuse <= 0.5 ? 1 : Tuse >= 2.5 ? 2 : 1 + (Tuse - 0.5) / 2;
        var z = pO.z, den2 = 0; mm.forEach(function(m, i){ den2 += m * Math.pow(Math.max(z[i], 1), kk); });
        seis.F = mm.map(function(m, i){ return Fb * m * Math.pow(Math.max(z[i], 1), kk) / den2; });
        st(r, 'k', 'exponente de distribución vertical', kk, '', 'ASCE 7-16 (12.8-12)');
        seis.Ev = 0.2 * ld.asce7.SDS;
        note(r, 'Componente vertical Ev = 0,2·SDS·D incluida en las combinaciones (ASCE 7-16 12.4.2.2).');
      }
      seis.V = Fb;
    }
    // ---- esfuerzos por sección (cota s)
    function above(s, field){ var W = 0, Vw = 0, Mw = 0, Ve = 0, Me = 0;
      all.forEach(function(x, i){ if (x.s <= s) return; var m = x.mM + x.mI + (field === 'L' ? x.mL : field === 'T' ? x.mT : 0); W += m * G;
        Vw += wind.F[i]; Mw += wind.F[i] * (x.s - s); Ve += seis.F[i]; Me += seis.F[i] * (x.s - s); });
      return { W: W, Vw: Vw, Mw: Mw, Ve: Ve, Me: Me }; }
    function about(s0, field){ var W = 0, Vw = 0, Mw = 0, Ve = 0, Me = 0;
      all.forEach(function(x, i){ var m = x.mM + x.mI + (field === 'L' ? x.mL : field === 'T' ? x.mT : 0); W += m * G;
        Vw += wind.F[i]; Mw += wind.F[i] * (x.s - s0); Ve += seis.F[i]; Me += seis.F[i] * (x.s - s0); });
      return { W: W, Vw: Vw, Mw: Math.abs(Mw), Ve: Ve, Me: Math.abs(Me) }; }
    var sRef = lugs ? sB : zg;
    out.base = about(sRef, 'L'); out.baseE = about(sRef, 'E'); out.baseT = about(sRef, 'T');
    st(r, 'Momento de viento en ' + (lugs ? 'las ménsulas' : 'la base'), '', out.base.Mw, 'm');
    if (ld.seisOn) st(r, 'Momento sísmico en la base', '', out.base.Me, 'm');
    out.wind = wind; out.seis = seis; out.T = { oper: pO.T, empty: pE.T, used: Tuse };
    // combinaciones
    var combos = [
      { k: 'C1', t: 'Operación: P + D', p: 1, w: 0, e: 0, fd: 1, liq: 'L', kS: 1 },
      ld.windOn ? { k: 'C2', t: 'Operación con viento: ' + f.fp + '·P + D + ' + f.fw + '·W', p: f.fp, w: f.fw, e: 0, fd: 1, liq: 'L', kS: f.kS } : null,
      ld.seisOn ? { k: 'C3', t: 'Operación con sismo: ' + f.fp + '·P + D + ' + f.fe + '·E', p: f.fp, w: 0, e: f.fe, fd: 1, liq: 'L', kS: f.kS, ev: seis.Ev } : null,
      (ld.windOn || ld.seisOn) ? { k: 'C4', t: 'Vacío / montaje: ' + f.fd + '·D + máx(' + f.fw + '·W ; ' + f.fe + '·E)', p: 0, w: ld.windOn ? f.fw : 0, e: ld.seisOn ? f.fe : 0, fd: f.fd, liq: 'E', kS: f.kS, ev: seis.Ev ? -seis.Ev : 0 } : null,
      d.Pext > 0 ? { k: 'C5', t: 'Presión exterior: −Pe + D' + (ld.windOn || ld.seisOn ? ' + máx(' + f.fw + '·W ; ' + f.fe + '·E)' : ''), p: -1, ext: true, w: ld.windOn ? f.fw : 0, e: ld.seisOn ? f.fe : 0, fd: 1, liq: 'L', kS: (ld.windOn || ld.seisOn) ? f.kS : 1 } : null,
      d.testPos !== 'H' ? { k: 'C6', t: 'Prueba hidrostática en vertical: PT + D (agua)', p: 0, test: true, w: 0, e: 0, fd: 1, liq: 'T', kS: 1 } : null
    ].filter(Boolean);
    out.combos = combos;
    // secciones: base y unión del faldón, extremos de cada virola / cono
    var secs = [];
    if (skirt){ secs.push({ s: zg, lbl: 'Base del faldón', skirt: true }); secs.push({ s: sAtt - 1e-3, lbl: 'Unión faldón-recipiente (faldón)', skirt: true }); }
    prj.comps.forEach(function(c){ if (c.type !== 'shell' && c.type !== 'cone') return; var p = Lr.pos[c.id]; if (lugs && p.s1 <= sB) return; if (lugs && p.s0 < sB){ secs.push({ s: sB + 1e-3, lbl: c.name + ' · sobre las ménsulas', c: c }); secs.push({ s: p.s1 - 1e-3, lbl: c.name + ' · extremo superior', c: c }); return; } secs.push({ s: p.s0 + 1e-3, lbl: c.name + ' · extremo inferior', c: c }); secs.push({ s: p.s1 - 1e-3, lbl: c.name + ' · extremo superior', c: c }); });
    var PT = base.test ? base.test.PT : 0, okAll = true;
    secs.forEach(function(sc){
      var rows = [], c = sc.c, cr = c ? base.byId[c.id] : null;
      var m = sc.skirt ? mSk : cr && cr.mat, T = d.T;
      if (!m) return;
      var cc = sc.skirt ? csk : (c.c != null ? +c.c : +d.c), Di, Do, tc = 1, El = 1, Ec = 1;
      if (sc.skirt){ Do = Ds; Di = Ds - 2 * tsk + 2 * cc; }
      else {
        var ri = M.innerR(c, Lr.pos[c.id], sc.s); Di = 2 * ri + 2 * cc; Do = 2 * ri + 2 * c.tn;
        if (c.type === 'cone'){ tc = Math.cos(c.alpha * Math.PI / 180); Do = Di + 2 * (c.tn - cc) * tc; }
        El = cr.eff ? cr.eff.EA : 1; Ec = cr.eff ? cr.eff.EB : 1;
      }
      var tcor = (Do - Di) / 2, Bc = Bcomp(m, T, Do / 2, tcor);
      combos.forEach(function(cb){
        var fld = sc.skirt ? cb.liq : 'E';           // el líquido solo carga el faldón
        var ab = above(sc.s, sc.skirt ? cb.liq : (cb.liq === 'T' ? 'E' : 'E'));
        var W = ab.W * cb.fd * (1 + (cb.ev || 0)), Mw = ab.Mw * cb.w, Me = ab.Me * cb.e, Mb = Math.max(Mw, Me);
        var Ptop = 0, Pz = 0;
        if (!sc.skirt){
          var hL = cb.test ? Math.max(0, Lr.smax - sc.s) : (d.level != null && d.level !== '' ? Math.max(0, +d.level - sc.s) : Math.max(0, Lr.smax - sc.s));
          if (cb.test){ Ptop = PT; Pz = PT + M.hyd(1000, hL); }
          else if (cb.ext){ Ptop = -d.Pext; Pz = -d.Pext; }
          else { Ptop = cb.p * d.P; Pz = cb.p * d.P + M.hyd(d.rho || 0, hL); }
        }
        var ss = secStress({ Di: Di, Do: Do, P: Pz, Pl: Ptop, F: -W, Mb: Mb, E: Ec, El: El });
        var S = m.S, Sy = m.ty ? m.ty[1] : null;
        var lim = cb.test ? (Sy ? 0.9 * Sy : 1.3 * m.Sa) : cb.kS * S;
        var s1 = Math.max(ss.sth, ss.smax, ss.sr), okT = s1 <= lim + 1e-9, okC = true, comp = Math.min(ss.smin, ss.smax);
        if (comp < 0){ okC = Bc.B != null ? -comp <= (cb.test ? 1.0 : cb.kS) * Bc.B + 1e-9 : false; }
        rows.push({ k: cb.k, t: cb.t, W: W, M: Mb, P: Pz, sth: ss.sth, smax: ss.smax, smin: ss.smin, s1: s1, lim: lim, B: Bc.B != null ? (cb.test ? 1 : cb.kS) * Bc.B : null, okT: okT, okC: okC, ok: okT && okC });
        okAll = okAll && okT && okC;
      });
      out.sec.push({ lbl: sc.lbl, s: sc.s, z: sc.s - zg, Di: Di, Do: Do, t: tcor, mat: m.name, S: m.S, B: Bc.B, A: Bc.A, rows: rows, ok: rows.every(function(x){ return x.ok; }) });
    });
    // ---- faldón: soldadura, anillo base y pernos
    if (skirt){
      var sk = R(), cmb = combos.filter(function(x){ return x.w || x.e; });
      var Mmax = 0, Mmin = 0, Wmin = Infinity, Wmax = 0;
      combos.forEach(function(cb){ var ab = above(zg, cb.liq), Mb = Math.max(ab.Mw * cb.w, ab.Me * cb.e); Wmax = Math.max(Wmax, ab.W * cb.fd * (1 + Math.abs(cb.ev || 0))); if (cb.w || cb.e){ if (Mb > Mmax){ Mmax = Mb; } } });
      cmb.forEach(function(cb){ var ab = above(zg, cb.liq), Mb = Math.max(ab.Mw * cb.w, ab.Me * cb.e), W = ab.W * cb.fd * (1 + (cb.ev || 0)); if (W < Wmin){ Wmin = W; Mmin = Mb; } });
      if (!isFinite(Wmin)){ Wmin = above(zg, 'E').W; Mmin = 0; }
      var kSs = cmb.length ? f.kS : 1;
      // soldadura faldón-fondo
      var abt = above(sAtt - 1e-3, 'L'), Mt = Math.max(abt.Mw * f.fw * (ld.windOn ? 1 : 0), abt.Me * f.fe * (ld.seisOn ? 1 : 0)), Dw = Ds - tsk;
      var fwld = st(sk, 'f soldadura', '[4·M/(π·Dm²) + W/(π·Dm)] / (0,707·cateto),  cateto = ' + num(sp.leg, 0) + ' mm', (4 * Mt / (Math.PI * Dw * Dw) + abt.W / (Math.PI * Dw)) / (0.707 * Math.max(num(sp.leg, 1), 1e-3)), 's', 'UW-15(c)');
      var mBot = shellAtt && base.byId[shellAtt.id] ? base.byId[shellAtt.id].mat : mSk, Sw = Math.min(mSk.S, mBot ? mBot.S : mSk.S);
      ck(sk, 'Soldadura faldón-recipiente: ' + fwld.toFixed(1) + ' MPa ≤ ' + (kSs !== 1 ? kSs + '·' : '') + '0,49·S = ' + (kSs * 0.49 * Sw).toFixed(1) + ' MPa', fwld <= kSs * 0.49 * Sw + 1e-9);
      // pernos de anclaje
      var BC = sp.BC > 0 ? +sp.BC : Ds + 150, nb = Math.max(1, num(sp.nb, 8)), am = V.mat(sp.amat, 40), Sab = am ? am.Sa : 138;
      st(sk, 'M base (máx.)', 'máx. de las combinaciones con viento / sismo', Mmax, 'm');
      st(sk, 'W mín.', 'peso mínimo concomitante (' + f.fd + '·D en vacío)', Wmin, 'f');
      var Tb = st(sk, 'Tracción por perno', '4·M/(n·BC) − W/n,  BC = ' + BC.toFixed(0) + ' mm, n = ' + nb, 4 * Mmin / (nb * BC) - Wmin / nb, 'f', 'Brownell & Young (10.x) / Jawad & Farr');
      var Tb2 = 4 * Mmax / (nb * BC) - Wmin / nb; if (Tb2 > Tb){ Tb = st(sk, 'Tracción por perno (M máx.)', '4·Mmáx/(n·BC) − Wmín/n', Tb2, 'f'); }
      var Areq = st(sk, 'Área de raíz requerida', 'Tb / (' + (kSs !== 1 ? kSs + '·' : '') + 'S perno a T amb. = ' + Sab.toFixed(0) + ' MPa)', Math.max(0, Tb) / (kSs * Sab), 'a');
      ck(sk, Tb <= 0 ? 'Sin tracción en los pernos de anclaje (el peso estabiliza el vuelco)' : 'Pernos de anclaje: área de raíz ' + num(sp.Ar, 0).toFixed(0) + ' mm² ≥ ' + Areq.toFixed(0) + ' mm²', Tb <= 0 || num(sp.Ar, 0) >= Areq - 1e-9);
      // anillo base
      var Dbo = sp.Dbo > 0 ? +sp.Dbo : BC + 100, Dbi = sp.Dbi > 0 ? +sp.Dbi : Ds - 2 * tsk - 100;
      var Ab = Math.PI / 4 * (Dbo * Dbo - Dbi * Dbi), Zb = Math.PI * (Math.pow(Dbo, 4) - Math.pow(Dbi, 4)) / (32 * Dbo);
      var fcb = st(sk, 'fc', 'W/Ab + M/Zb  (W máx., M máx.)  Db = ' + Dbo.toFixed(0) + ' / ' + Dbi.toFixed(0) + ' mm', Wmax / Ab + Mmax / Zb, 's', 'Brownell & Young');
      ck(sk, 'Presión sobre el hormigón ' + fcb.toFixed(2) + ' MPa ≤ admisible ' + num(sp.fc, 7) + ' MPa', fcb <= num(sp.fc, 7) + 1e-9);
      var mb = V.mat(sp.bmat, 40), Sbr = 1.5 * (mb ? mb.Sa : 138) * kSs, lout = Math.max((Dbo - Ds) / 2, (Ds - 2 * tsk - Dbi) / 2);
      var tbr = st(sk, 'tb requerido', 'l·√(3·fc/Sb),  l = ' + lout.toFixed(0) + ' mm, Sb = 1,5·S = ' + Sbr.toFixed(0) + ' MPa', lout * Math.sqrt(3 * fcb / Sbr), 'len', 'Brownell & Young (10.x), UG-23(c)');
      ck(sk, 'Espesor del anillo base ' + num(sp.tb, 0) + ' mm ≥ ' + tbr.toFixed(1) + ' mm', num(sp.tb, 0) >= tbr - 1e-9);
      note(sk, 'Anillo base sin cartelas ni silla de pernos; con sillas o anillo superior el espesor se calcula aparte. Aberturas de acceso en el faldón no incluidas.');
      out.skirt = { r: sk, Ds: Ds, Hs: Hs, BC: BC, Dbo: Dbo, Dbi: Dbi, ok: !sk.checks.some(function(x){ return !x.ok && !x.warn && !x.info; }) };
      okAll = okAll && out.skirt.ok;
    }
    // ---- combinaciones para reacciones de soportes discretos
    function supCombos(){ var o = []; combos.forEach(function(cb){ var b2 = about(sRef, cb.liq); o.push({ k: cb.k, W: b2.W * cb.fd * (1 + (cb.ev || 0)), Wmin: b2.W * cb.fd * (1 - Math.abs(cb.ev || 0)), M: Math.max(b2.Mw * cb.w, b2.Me * cb.e), V: Math.max(b2.Vw * cb.w, b2.Ve * cb.e) }); }); return o; }
    var shOD = shellAtt.D + (shellAtt.basis === 'od' ? 0 : 2 * shellAtt.tn);
    if (legs){
      var shp = prj.comps.filter(function(c){ return c.type === 'shell'; })[0] || prj.comps[0], lpt0 = num(sp.lpt, 0) > 0 ? +sp.lpt : Math.max(6, shp.tn);
      var lg = R(), nl2 = LG.n, Dl = sp.Dl > 0 ? +sp.Dl : shOD + LG.b + 2 * lpt0, Fy = LG.st.Fy, Es = 2e5, Kf = num(sp.K, 2.0);
      st(lg, 'Sección de pata', sp.lsec === 'user' ? 'definida por el usuario' : LG.name ? LG.name + ' (eje débil)' : 'tubo ' + num(sp.lod, 0) + ' × ' + num(sp.lt, 0) + ' mm', LG.A, 'a');
      st(lg, 'r', '√(I/A)', LG.r, 'len'); st(lg, 'Fy', LG.st.en ? LG.st.name + ' (ReH según espesor)' : 'límite elástico a temperatura ambiente (II-D Tabla Y-1)', Fy, 's');
      // chapa intermedia (pad) entre pata y envolvente, del mismo material que la virola
      var sh0 = prj.comps.filter(function(c){ return c.type === 'shell'; })[0] || prj.comps[0], lpt = num(sp.lpt, 0) > 0 ? +sp.lpt : Math.max(6, sh0.tn), lpw = num(sp.lpw, 0) > 0 ? +sp.lpw : LG.b + 100, lpl = num(sp.lpl, 0) > 0 ? +sp.lpl : 400;
      var wmL = +prj.design.wmin || 50;
      LG.pad = { t: lpt, w: lpw, L: lpl, mat: sh0.mat, matName: (V.mat(sh0.mat, 40) || {}).name || '', z0: sAtt + wmL, z1: sAtt + wmL + lpl }; LG.top = LG.pad.z1 - 50;
      note(lg, 'Chapa intermedia desde ' + wmL + ' mm por encima de la línea de tangencia (separación a la circunferencial fondo-virola)');
      note(lg, 'Chapa intermedia pata-envolvente ' + lpl.toFixed(0) + ' × ' + lpw.toFixed(0) + ' × ' + lpt.toFixed(0) + ' mm de ' + LG.pad.matName + ' (mismo material que la virola): la pata ' + (LG.st.en ? 'de acero europeo ' : '') + 'no se suelda directamente a la parte a presión');
      ck(lg, 'Chapa intermedia: espesor ' + lpt.toFixed(0) + ' mm ≥ espesor de la virola ' + sh0.tn + ' mm (criterio habitual) y ≥ 6 mm', lpt >= Math.min(sh0.tn, 6) - 1e-9 && lpt >= 6, lpt < sh0.tn);
      ck(lg, 'Chapa intermedia: vuelo ≥ 50 mm a cada lado de la pata', lpw >= LG.b + 100 - 1e-9, true);
      var KLr = st(lg, 'K·L/r', 'K = ' + Kf + ', L = ' + Hl.toFixed(0) + ' mm', Kf * Hl / LG.r, '', 'AISC 360-16 E2');
      var Fe = Math.PI * Math.PI * Es / (KLr * KLr), Fcr = KLr <= 4.71 * Math.sqrt(Es / Fy) ? Math.pow(0.658, Fy / Fe) * Fy : 0.877 * Fe;
      st(lg, 'Fcr', KLr <= 4.71 * Math.sqrt(Es / Fy) ? '0,658^(Fy/Fe)·Fy' : '0,877·Fe', Fcr, 's', 'AISC 360-16 (E3-2)/(E3-3)');
      var Pc = st(lg, 'Pc', 'Fcr·A/1,67 (ASD)', Fcr * LG.A / 1.67, 'f', 'AISC 360-16 E1');
      var Mc = st(lg, 'Mc', sp.lsec === 'user' ? 'Fy·Z/1,67 (Z plástico)' : 'Fy·Z/1,67, Z = (Do³ − Di³)/6 (sección compacta)', Fy * LG.Z / 1.67, 'm', 'AISC 360-16 F8');
      var gov = null, worst = -1, upl = 0;
      supCombos().forEach(function(c){
        var Pr = c.W / nl2 + 4 * c.M / (nl2 * Dl), Vr = c.V / nl2, Mr = Vr * Hl, q = Pr / Pc >= 0.2 ? Pr / Pc + 8 / 9 * Mr / Mc : Pr / (2 * Pc) + Mr / Mc;
        if (q > worst){ worst = q; gov = { k: c.k, Pr: Pr, Vr: Vr, Mr: Mr, q: q }; }
        upl = Math.max(upl, 4 * c.M / (nl2 * Dl) - c.Wmin / nl2);
      });
      st(lg, 'Pr (pata más cargada)', 'W/n + 4·M/(n·Dl), comb. ' + gov.k + ', Dl = ' + Dl.toFixed(0) + ' mm', gov.Pr, 'f');
      st(lg, 'Mr', '(V/n)·L  (pata empotrada en el recipiente, base articulada)', gov.Mr, 'm');
      st(lg, 'Interacción', gov.Pr / Pc >= 0.2 ? 'Pr/Pc + 8/9·Mr/Mc' : 'Pr/(2Pc) + Mr/Mc', gov.q, '', 'AISC 360-16 (H1-1a)/(H1-1b)');
      ck(lg, 'Patas: interacción ' + gov.q.toFixed(3) + ' ≤ 1,0 (comb. ' + gov.k + ')', gov.q <= 1 + 1e-9);
      var amL = V.mat(sp.amat, 40), SaL = amL ? amL.Sa : 138, ArL = st(lg, 'Tracción por pata', '4·M/(n·Dl) − Wmín/n', upl, 'f');
      if (upl > 0){ var reqL = upl / num(sp.nbl, 2) / SaL; st(lg, 'Área de raíz requerida por perno', 'T / (n pernos·S)', reqL, 'a'); ck(lg, 'Pernos de anclaje de pata: ' + num(sp.lAr, 0).toFixed(0) + ' mm² ≥ ' + reqL.toFixed(0) + ' mm²', num(sp.lAr, 0) >= reqL - 1e-9); }
      else ck(lg, 'Sin tracción en las patas', true);
      note(lg, 'Tensiones locales en la virola en la unión de las patas (WRC 107/537) y placas base de las patas: no incluidas.');
      out.legs = { r: lg, Dl: Dl, n: nl2, LG: LG, pad: LG.pad, top: LG.top, ok: !lg.checks.some(function(x){ return !x.ok && !x.warn && !x.info; }) };
      okAll = okAll && out.legs.ok;
    }
    if (lugs){
      var lu = R(), ng = Math.max(2, num(sp.nlug, 4)), Dg = sp.Dlug > 0 ? +sp.Dlug : shOD + 200, Qm = 0, Tm = 0;
      supCombos().forEach(function(c){ Qm = Math.max(Qm, c.W / ng + 4 * c.M / (ng * Dg)); Tm = Math.max(Tm, 4 * c.M / (ng * Dg) - c.Wmin / ng); });
      st(lu, 'Cota de apoyo', 'Z de las ménsulas', sB, 'len');
      st(lu, 'Q por ménsula', 'W/n + 4·M/(n·Dg),  n = ' + ng + ', Dg = ' + Dg.toFixed(0) + ' mm', Qm, 'f', 'Bednar / Moss');
      st(lu, 'Tracción por ménsula', '4·M/(n·Dg) − Wmín/n', Tm, 'f');
      if (Tm > 0){ var amG = V.mat(sp.amat, 40), reqG = Tm / num(sp.nbg, 2) / (amG ? amG.Sa : 138); ck(lu, 'Pernos de ménsula: ' + num(sp.gAr, 0).toFixed(0) + ' mm² ≥ ' + reqG.toFixed(0) + ' mm²', num(sp.gAr, 0) >= reqG - 1e-9); }
      else ck(lu, 'Sin tracción en las ménsulas', true);
      var shG = shL || prj.comps[0], gpt = num(sp.mpt, 0) > 0 ? +sp.mpt : Math.max(6, shG.tn), gst = steelOf(sp, 'g', num(sp.mt, 12));
      var geo = { n: ng, H: num(sp.mH, 250), L: num(sp.mL, 200), S: num(sp.mS, 150), t: num(sp.mt, 12), tb: num(sp.mb, 20), pt: gpt, th0: sp.th0g != null && sp.th0g !== '' ? +sp.th0g : 45, st: gst, padMat: shG.mat };
      geo.pw = geo.S + 2 * geo.t + 100; geo.ph = geo.H + 100;
      note(lu, 'Ménsula: 2 cartelas ' + geo.H + ' × ' + geo.L + ' × ' + geo.t + ' mm separadas ' + geo.S + ' mm y placa de apoyo e = ' + geo.tb + ' mm (' + gst.name + '), soldadas a una chapa intermedia ' + geo.ph + ' × ' + geo.pw + ' × ' + gpt + ' mm del material de la virola');
      // cartelas: compresión excéntrica (criterio de Moss): fa = Q/(2·t·L) + 6·Q·(L/2)/(2·t·H²)… simplificado a flexión de la cartela como voladizo
      var fa = Qm / (2 * geo.t * geo.L), fb = 6 * Qm * geo.L / 2 / (2 * geo.t * geo.H * geo.H), Fyg = gst.Fy;
      st(lu, 'σ cartelas', 'Q/(2·t·L) + 6·Q·(L/2)/(2·t·H²)', fa + fb, 's', 'Moss, Pressure Vessel Design Manual');
      ck(lu, 'Cartelas: ' + (fa + fb).toFixed(1) + ' MPa ≤ 0,6·Fy = ' + (0.6 * Fyg).toFixed(1) + ' MPa', fa + fb <= 0.6 * Fyg + 1e-9);
      var tbq = Math.sqrt(6 * Qm * (geo.S / 2) / (4 * (geo.L) * 0.75 * Fyg)); st(lu, 'tb requerido', '√[6·Q·(S/2)/(4·L·0,75·Fy)] (placa entre cartelas)', tbq, 'len');
      ck(lu, 'Placa de apoyo: ' + geo.tb + ' mm ≥ ' + tbq.toFixed(1) + ' mm', geo.tb >= tbq - 1e-9);
      // separación de la chapa intermedia a las soldaduras de la envolvente
      var wminG = +prj.design.wmin || 50, z0p = sB - 50, z1p = z0p + geo.ph, seamsZ = [];
      prj.comps.forEach(function(c, ic){ var pc = Lr.pos[c.id]; if (ic > 0) seamsZ.push(pc.s0); if (/shell|cone/.test(c.type)) M.courses(prj, c).list.slice(1).forEach(function(cr){ seamsZ.push(pc.s0 + cr.z0); }); });
      var dzm = Math.min.apply(null, seamsZ.map(function(z){ return z < z0p ? z0p - z : z > z1p ? z - z1p : -1; }).concat([1e9]));
      ck(lu, 'Chapa intermedia de las ménsulas a la circunferencial más próxima: ' + (dzm < 0 ? 'la cruza' : dzm.toFixed(0) + ' mm') + ' (mínimo ' + wminG + ' mm)', dzm >= wminG);
      if (shL){ var Rg = (shL.basis === 'od' ? shL.D / 2 : shL.D / 2 + shL.tn), hwA = (geo.pw / 2) / Rg * 180 / Math.PI, worst = 1e9;
        M.courses(prj, shL).list.forEach(function(cr){ var zA = Lr.pos[shL.id].s0 + cr.z0, zB = Lr.pos[shL.id].s0 + cr.z1; if (z1p < zA || z0p > zB) return; cr.ang.forEach(function(an){ for (var q = 0; q < geo.n; q++){ var d0 = Math.abs(((geo.th0 + 360 * q / geo.n - an) % 360 + 540) % 360 - 180); worst = Math.min(worst, (d0 - hwA) * Math.PI / 180 * Rg); } }); });
        if (worst < 1e8) ck(lu, 'Chapa intermedia de las ménsulas a la longitudinal más próxima: ' + (worst < 0 ? 'la cruza' : worst.toFixed(0) + ' mm') + ' (mínimo ' + wminG + ' mm)', worst >= wminG); }
      note(lu, 'Tensiones locales en la virola bajo la chapa intermedia: «Cargas locales WRC 107/537».');
      out.lugs = { r: lu, Q: Qm, geo: geo, Dg: Dg, ok: !lu.checks.some(function(x){ return !x.ok && !x.warn && !x.info; }) };
      okAll = okAll && out.lugs.ok;
    }
    // f1/f2 en uniones de cono: carga axial por unidad de circunferencia (sin presión)
    out.axialAt = function(s, Rr){
      var ab = above(s, 'E'), M2 = 0; combos.forEach(function(cb){ if (cb.w || cb.e){ M2 = Math.max(M2, ab.Mw * cb.w, ab.Me * cb.e); } });
      return { fT: -ab.W / (2 * Math.PI * Rr) + M2 / (Math.PI * Rr * Rr), fC: ab.W / (2 * Math.PI * Rr) + M2 / (Math.PI * Rr * Rr), W: ab.W, M: M2 };
    };
    out.all = all; out.ok = okAll;
    if (!ld.windOn && !ld.seisOn) note(r, 'Viento y sismo desactivados: solo se comprueban presión y peso propio.');
    return out;
  }

  // ---------------- recipiente horizontal ----------------
  function horizontal(prj, base, ld, sp, sl, out){
    var d = prj.design, Lr = base.L, r = out.r, f = out.f;
    var saddle = sp && sp.type === 'saddle';
    var heads = prj.comps.filter(function(c){ return /ellip|tori|hemi/.test(c.type); });
    var body = prj.comps.filter(function(c){ return !/ellip|tori|hemi|flat/.test(c.type); });
    var Lt = body.reduce(function(a, c){ return a + M.axLen(c); }, 0), shell = prj.comps.filter(function(c){ return c.type === 'shell'; })[0];
    if (!shell){ ck(r, 'No hay virola para el cálculo de cunas', false); out.ok = false; return out; }
    var Dmax = 0; prj.comps.forEach(function(c){ Dmax = Math.max(Dmax, (c.D || 0) + 2 * c.tn); });
    var hAx = saddle ? num(sp.h, Dmax / 2 + 300) : Dmax / 2;
    st(r, 'L', 'longitud entre líneas de tangencia', Lt, 'len');
    var Ltot = (Lr.smax - Lr.smin);
    // viento transversal y longitudinal
    var Wt = 0, Wl = 0, De = Dmax + 2 * num(ld.ins.t, 0) + num(ld.dExtra, 0), ze = (hAx + De / 2) / 1000;
    if (ld.windOn){
      if (ld.code === 'EN'){ var q = qpEN(ld.en, ze).qp, cf = cfEN(ld.en, De / 1000, Ltot / 1000, ze, r).cf; st(r, 'qp(ze)', 'ze = cota superior', q, 'pa', 'EN 1991-1-4 (4.8)'); Wt = num(ld.en.cscd, 1) * cf * q * De * Ltot * 1e-6; Wl = num(ld.en.cscd, 1) * 1.0 * q * Math.PI * De * De / 4 * 1e-6; }
      else { var qz = qzASCE(ld.asce, ze).qz, cfa = cfASCE(ld.asce, De / 1000, Ltot / 1000, r); Wt = qz * num(ld.asce.G, 0.85) * cfa * De * Ltot * 1e-6; Wl = qz * num(ld.asce.G, 0.85) * 1.0 * Math.PI * De * De / 4 * 1e-6; }
      parseExtra(ld.extra).forEach(function(e){ Wt += (ld.code === 'EN' ? qpEN(ld.en, ze).qp * num(ld.en.cfx, 2) : qzASCE(ld.asce, ze).qz * 2.0) * e.A; });
      st(r, 'Viento transversal', 'cf·q·D·L', Wt, 'f'); st(r, 'Viento longitudinal', 'q·1,0·π·D²/4 (sobre los fondos, aproximado)', Wl, 'f');
    }
    var Es = 0;
    if (ld.seisOn){
      var Tu = ld.T > 0 ? +ld.T : null;
      if (ld.code === 'EN'){ var sd = sdEN(ld.en8, Tu != null ? Tu : sdEN(ld.en8, 0).TB); Es = st(r, 'Fb', 'Sd(T)·m' + (Tu != null ? '' : ' (T en la meseta del espectro: cunas consideradas rígidas)'), sd.Sd * out.mass.oper, 'f', 'EN 1998-1 (4.5)'); }
      else { var cs = csASCE(ld.asce7, Tu != null ? Tu : 0.05); Es = st(r, 'V', cs.txt + (Tu != null ? '' : ' (T < 0,06 s)'), cs.Cs * out.mass.oper * G, 'f', 'ASCE 7-16 15.4'); }
    }
    out.wind = { V: Wt, VL: Wl }; out.seis = { V: Es };
    if (!saddle){ note(r, 'Sin cunas definidas.'); out.ok = true; return out; }
    // cunas
    var a = num(sp.A, 500), Ls = Lt - 2 * a, h2s = heads.map(function(c){ return M.headDepth(c) + c.tn; }), h2 = h2s.length ? h2s.reduce(function(x, y){ return x + y; }, 0) / h2s.length : 0;
    var sr = base.byId[shell.id], ms = sr.mat, cc = shell.c != null ? +shell.c : +d.c, Di = (shell.basis === 'od' ? shell.D - 2 * shell.tn : shell.D) + 2 * cc;
    var t = shell.tn - cc, Rm = (Di + t) / 2, hd = heads[0], th = hd ? hd.tn - (hd.c != null ? +hd.c : +d.c) : t, Sh = hd && base.byId[hd.id] && base.byId[hd.id].mat ? base.byId[hd.id].mat.S : ms.S;
    var Bc = Bcomp(ms, d.T, (Di - 2 * cc) / 2 + shell.tn, t).B;
    var dQ = Math.max(Wl * f.fw, Es * f.fe) * hAx / Math.max(Ls, 1);
    var Qo = out.mass.oper * G / 2, Qt = out.mass.test * G / 2;
    st(r, 'Q (servicio)', 'W servicio / 2', Qo, 'f');
    if (ld.windOn || ld.seisOn) st(r, 'ΔQ', 'máx(' + f.fw + '·W long. ; ' + f.fe + '·E)·h / separación de cunas', dQ, 'f');
    st(r, 'Q (prueba)', 'W prueba / 2', Qt, 'f');
    sp.wear = true; sp.wmat = { id: shell.mat.id, vi: shell.mat.vi || 0 }; if (!(num(sp.twp, 0) > 0)) sp.twp = shell.tn;
    var wear = { tr: num(sp.twp, 0), b1: num(sp.bwp, 0), th1: num(sp.thwp, 0), S: ms.S };
    note(r, 'Chapa de desgaste (pad intermedio) de ' + ms.name + ', mismo material que la virola, e = ' + num(sp.twp, 0) + ' mm: la cuna ' + (sp.sstd === 'EN' ? 'de acero europeo ' : '') + 'no se suelda directamente a la parte a presión');
    var com = { L: Lt, a: a, Rm: Rm, t: t, h2: h2, th: th, theta: num(sp.theta, 120), b: num(sp.b, 200), S: ms.S, Sh: Sh, E: sr.eff ? sr.eff.EB : 1, k: sp.welded === false ? 1 : 0.1, wear: wear, Bc: Bc };
    var cases = [
      { k: 'Z1', t: 'Servicio: P + peso' + ((ld.windOn || ld.seisOn) ? ' + ΔQ por viento/sismo' : ''), Q: Qo + dQ, P: d.P, kS: (ld.windOn || ld.seisOn) ? f.kS : 1 },
      { k: 'Z2', t: 'Servicio sin presión (lleno, P = 0)', Q: Qo + dQ, P: 0, kS: (ld.windOn || ld.seisOn) ? f.kS : 1 },
      { k: 'Z3', t: 'Prueba hidrostática (PT, lleno de agua; admisible 0,9·Sy/S)', Q: Qt, P: base.test.PT, kS: ms.ty ? 0.9 * ms.ty[1] / ms.S : 1.3 },
      d.Pext > 0 ? { k: 'Z4', t: 'Vacío: −Pe + peso', Q: Qo + dQ, P: -d.Pext, kS: 1 } : null
    ].filter(Boolean);
    out.zick = cases.map(function(cs2){ var z = zick(Object.assign({}, com, { Q: cs2.Q, P: cs2.P, kS: cs2.kS, Ph: 0 })); z.k = cs2.k; z.t = cs2.t; z.Q = cs2.Q; return z; });
    out.saddle = { a: a, Ls: Ls, h2: h2, Rm: Rm, t: t, hAx: hAx, FT: Math.max(Wt * f.fw, Es * f.fe), FL: Math.max(Wl * f.fw, Es * f.fe) };
    st(r, 'Fuerza horizontal transversal', 'máx(' + f.fw + '·W ; ' + f.fe + '·E), a repartir entre las dos cunas', out.saddle.FT, 'f');
    st(r, 'Fuerza horizontal longitudinal', 'la toma la cuna fija', out.saddle.FL, 'f');
    note(r, 'Cunas sin anillos rigidizadores (VIII-2 4.15.3.5(c)(4)–(6) no incluidos).');
    // ---- estructura de la cuna: alma (fuerza de separación), placa base y pernos
    var stS = steelOf(sp, 's', Math.max(num(sp.tw, 12), num(sp.tbp, 20))), cs3 = R(), Sy = stS.Fy, Ss = stS.en ? stS.Fy / 1.5 : ((V.mat(sp.smat, 40) || {}).Sa || 138);
    st(cs3, 'Fy cuna', stS.name, Sy, 's');
    var Ro = (Di - 2 * cc) / 2 + shell.tn + (sp.wear ? num(sp.twp, 0) : 0), th2 = num(sp.theta, 120) * Math.PI / 180;
    var tw = num(sp.tw, 12), tf = num(sp.tf, 12), bS = num(sp.b, 200), Bb = num(sp.Bb, 250), tbp = num(sp.tbp, 20);
    var Lbp = sp.Lbp > 0 ? +sp.Lbp : 2 * Ro * Math.sin(th2 / 2) + 100, hs = Math.max(hAx - Ro - tf - tbp, 1);
    var Fh = Math.max.apply(null, out.zick.map(function(z){ return z.Fh; })), Qmx = Math.max.apply(null, out.zick.map(function(z){ return z.Q; }));
    st(cs3, 'Fh', 'fuerza de separación máxima (de los casos de Zick)', Fh, 'f', 'VIII-2 (4.15.42)');
    var parts = [{ A: Bb * tbp, y: tbp / 2, I: Bb * Math.pow(tbp, 3) / 12 }, { A: tw * hs, y: tbp + hs / 2, I: tw * Math.pow(hs, 3) / 12 }, { A: bS * tf, y: tbp + hs + tf / 2, I: bS * Math.pow(tf, 3) / 12 }];
    var cp = V.compI(parts), cc3 = Math.max(cp.yc, tbp + hs + tf - cp.yc);
    st(cs3, 'As', 'placa base + alma (altura ' + hs.toFixed(0) + ' mm en el punto bajo) + placa superior', cp.A, 'a', 'PTB-4 E4.15.1');
    st(cs3, 'I', 'sección compuesta en el punto bajo', cp.I, 'i4');
    var dd = st(cs3, 'd', 'altura del c.d.g. del arco de apoyo sobre la base = h − Ro·sen(θ/2)/(θ/2)', hAx - Ro * Math.sin(th2 / 2) / (th2 / 2), 'len');
    var sgt = st(cs3, 'σt', 'Fh/As', Fh / cp.A, 's'); ck(cs3, 'Alma: tracción ' + sgt.toFixed(1) + ' MPa ≤ 0,6·Sy = ' + (0.6 * Sy).toFixed(1) + ' MPa', sgt <= 0.6 * Sy + 1e-9);
    var sgb = st(cs3, 'σb', 'Fh·d·c/I,  c = ' + cc3.toFixed(0) + ' mm', Fh * dd * cc3 / cp.I, 's'); ck(cs3, 'Alma: flexión ' + sgb.toFixed(1) + ' MPa ≤ 0,66·Sy = ' + (0.66 * Sy).toFixed(1) + ' MPa', Math.abs(sgb) <= 0.66 * Sy + 1e-9);
    var FT = out.saddle.FT, FL = out.saddle.FL, Mt = FT / 2 * hAx;
    var fb = st(cs3, 'fb', 'Q/(Bb·Lb) + 6·(FT/2·h)/(Bb·Lb²),  Bb = ' + Bb + ', Lb = ' + Lbp.toFixed(0) + ' mm', Qmx / (Bb * Lbp) + 6 * Mt / (Bb * Lbp * Lbp), 's');
    ck(cs3, 'Presión sobre el hormigón ' + fb.toFixed(2) + ' MPa ≤ ' + num(sp.fc, 7) + ' MPa', fb <= num(sp.fc, 7) + 1e-9);
    var ebp = (Bb - tw) / 2, treq = st(cs3, 'tb requerido', 'e·√(3·fb/(0,75·Fy)),  e = (Bb − tw)/2 = ' + ebp.toFixed(0) + ' mm', ebp * Math.sqrt(3 * fb / (0.75 * Sy)), 'len', 'placa en voladizo (criterio AISC)');
    ck(cs3, 'Placa base: ' + tbp + ' mm ≥ ' + treq.toFixed(1) + ' mm', tbp >= treq - 1e-9);
    var nbs = Math.max(2, num(sp.nbs, 2)), am = V.mat(sp.amat, 40), Sab = am ? am.Sa : 138, eb = sp.eb > 0 ? +sp.eb : 0.8 * Lbp;
    var vsh = st(cs3, 'Cortante por perno', 'máx(FL (cuna fija) ; FT/2) / n', Math.max(FL, FT / 2) / nbs, 'f');
    var Ab = num(sp.Ar, 0); ck(cs3, 'Pernos: cortante ' + (vsh / Math.max(Ab, 1)).toFixed(1) + ' MPa ≤ 0,6·S = ' + (0.6 * Sab).toFixed(1) + ' MPa (criterio habitual)', vsh / Math.max(Ab, 1) <= 0.6 * Sab + 1e-9);
    var Tb = st(cs3, 'Tracción por perno', '[FT/2·h/eb − ' + f.fd + '·Wvacío/4] / (n/2),  eb = ' + eb.toFixed(0) + ' mm', Math.max(0, (Mt / eb - f.fd * out.mass.empty * G / 4) / (nbs / 2)), 'f');
    ck(cs3, Tb > 0 ? 'Pernos: área ' + Ab.toFixed(0) + ' mm² ≥ ' + (Tb / Sab).toFixed(0) + ' mm² a tracción' : 'Sin tracción en los pernos de la cuna', Tb <= 0 || Ab >= Tb / Sab - 1e-9);
    note(cs3, 'Cartelas, nervios y la soldadura alma-placa base no incluidos.');
    out.sstruct = { r: cs3, ok: !cs3.checks.some(function(x){ return !x.ok && !x.warn && !x.info; }) };
    out.ok = out.zick.every(function(z){ return z.ok; }) && out.sstruct.ok;
    return out;
  }

  return { legsN: legsN, steelOf: steelOf, profProps: profProps, PROF: PROF, EN_GR: EN_GR, run: run, defaults: defaults, defSupport: defSupport, FAM: FAM, zick: zick, secStress: secStress, qpEN: qpEN, cfEN: cfEN, qzASCE: qzASCE, cfASCE: cfASCE, sdEN: sdEN, csASCE: csASCE, Bcomp: Bcomp, parseExtra: parseExtra };
})();

/* ===================================================================
   Módulos complementarios de cálculo:
   - PED 2014/68/UE: categoría (anexo II, cuadros 1-4), módulos, requisitos esenciales y prueba (anexo I 7.4)
   - EN 13445-3: espesores comparativos (cl. 6, 7.4, 7.5, 7.6)
   - Camisas (VIII-1 Ap. 9) y media caña (Ap. EE)
   - Placas tubulares de tubos en U (UHX-12, configuraciones a y d), validado con PTB-4 E4.18.1 y E4.18.2
   - Cribado de fatiga (VIII-2 5.5.2.3, método A)
   - Orejetas de izado y comprobación del recipiente durante el izado
   - Boca de hombre: tapa ciega (UG-34) y pescante
   - Tensiones locales WRC 107/537: suma de tensiones con coeficientes introducidos por el usuario
   Unidades internas: mm, MPa, N, kg.
   =================================================================== */
var FAB = (function(){
  'use strict';
  var V = VESSEL, G = 9.80665;
  function R(){ return { steps: [], checks: [], out: {} }; }
  function st(r, k, eq, v, u, ref){ r.steps.push({ k: k, eq: eq, v: v, u: u || '', ref: ref || '' }); return v; }
  function ck(r, t, ok, warn, ref){ r.checks.push({ t: t, ok: !!ok, warn: !!warn, ref: ref || '' }); return ok; }
  function note(r, t, ref){ r.checks.push({ t: t, ok: true, info: true, ref: ref || '' }); }
  function num(x, d){ return (x === null || x === undefined || x === '' || isNaN(+x)) ? d : +x; }
  function f1(x){ return (Math.round(x * 10) / 10).toString().replace('.', ','); }
  function f2(x){ return (Math.round(x * 100) / 100).toFixed(2).replace('.', ','); }
  function f3(x){ return (Math.round(x * 1000) / 1000).toFixed(3).replace('.', ','); }
  function M(){ return VMODEL; }
  function compById(prj, id){ return prj.comps.filter(function(c){ return c.id === id; })[0]; }
  function shells(prj){ return prj.comps.filter(function(c){ return c.type === 'shell'; }); }

  // ---------------- valores por defecto ----------------
  function defaults(prj){
    var sh = prj && shells(prj)[0];
    return {
      ped: { on: true, group: '2', state: 'liq', unstable: false, PS: null, TSmin: null, TSmax: null, nb: '', A: 30, vol: null },
      en: { on: true, tol: 0.3, props: {} },
      jacket: { on: false, host: sh ? sh.id : 'C1', type: '1', closure: 'f', Dj: sh ? (sh.D + 2 * sh.tn + 100) : 1700, tj: 8, cj: 0, P: 0.6, T: 180, L: null, tc: 20,
        mat: { id: 'sa516', vi: 0 }, vac: false },
      hp: { on: false, host: sh ? sh.id : 'C1', nps: '3', tj: 5.49, cj: 0, P: 0.6, T: 180, mat: { id: 'sa106b', vi: 0 }, K: null, Fax: 0, Mb: 0, pitch: 150, turns: null },
      uhx: { on: false, cfg: 'a', pat: 'tri', A: 700, dt: 19.05, tt: 1.65, p: 25.4, ro: 300, UL1: 0, LL1: null, rho: 0, ct: 0, hg: 0, h: 50,
        mat: { id: 'sa516', vi: 0 }, tmat: { id: 'sa106b', vi: 0 }, smat: { id: 'sa516', vi: 0 }, cmat: { id: 'sa516', vi: 0 },
        Ds: 600, ts: 10, Dc: 600, tc: 12, Gs: 640, Gc: 640, W: 0, Psmax: 1.0, Psmin: 0, Ptmax: 1.5, Ptmin: 0, T: 150,
        E: null, Et: null, Es: null, Ec: null, S: null, St: null, Ss: null, Sc: null, Sman: false },
      fat: { on: true, constr: 'int', knuckle: false, NFP: 1000, NPO: 0, cycles: '', NTa: 0 },
      lift: { on: false, n: 2, Cd: 2.0, phi: 0, rig: 0, mode: 'tail', sLug: null, sTail: null, t: 25, b: 250, H: 150, R: 75, dh: 52, dp: 47, w: 10, Fexx: 480,
        mat: { id: 'sa516', vi: 0 } },
      mh: { on: false, noz: '', Dc: null, tc: null, mcover: null, Cd: 1.5, L: 600, pod: 88.9, pt: 7.62, s: 300, armOd: 60.3, armT: 5.54, mat: { id: 'sa106b', vi: 0 } },
      wrc: { on: false, mode: 'abs', list: [] }
    };
  }

  // ---------------- propiedades de material para EN y PED ----------------
  // Reducción genérica del límite elástico con la temperatura (relativa a 20 °C), tomada de EN 10028-2 (P265GH) y EN 10028-7 (1.4307, Rp1,0).
  var KT_FER = [[20, 1], [100, 0.909], [150, 0.842], [200, 0.774], [250, 0.709], [300, 0.653], [350, 0.604], [400, 0.566], [450, 0.53], [500, 0.49]];
  var KT_AUS = [[20, 1], [100, 0.769], [150, 0.692], [200, 0.636], [250, 0.596], [300, 0.564], [350, 0.544], [400, 0.528], [450, 0.512], [500, 0.5], [550, 0.488]];
  function ktab(t, T){ if (T <= t[0][0]) return 1; for (var k = 0; k < t.length - 1; k++) if (T <= t[k + 1][0]) return t[k][1] + (t[k + 1][1] - t[k][1]) * (T - t[k][0]) / (t[k + 1][0] - t[k][0]); return t[t.length - 1][1]; }
  function props(prj, ref, T, key){
    var m = V.mat(ref, T); if (!m) return null;
    var aus = m.family === 'UHA8', ty = m.ty || [m.Sa * 3.5, m.Sa * 1.5];
    var ov = (prj.en && prj.en.props && key && prj.en.props[key]) || {};
    var Rm = num(ov.Rm, ty[0]), Rp20 = aus ? ty[1] * 1.15 : ty[1];
    if (ov.Rp20 > 0) Rp20 = +ov.Rp20;
    var est = !(ov.RpT > 0) && T > 20, RpT = T <= 20 ? Rp20 : (ov.RpT > 0 ? +ov.RpT : Rp20 * ktab(aus ? KT_AUS : KT_FER, T));
    return { m: m, aus: aus, Rm: Rm, Rp20: Rp20, RpT: RpT, est: est, A: num(ov.A, aus ? 40 : 22), name: m.name };
  }
  // tensión nominal EN 13445-3 cl. 6 (condiciones de diseño y de prueba)
  function fEN(p, r, lbl){
    var f, ft, txt;
    if (p.aus && p.A >= 35){ f = Math.max(p.RpT / 1.5, Math.min(p.RpT / 1.2, p.Rm / 3)); ft = Math.max(p.Rp20 / 1.05, p.Rm / 2); txt = 'máx[Rp1,0/T/1,5 ; mín(Rp1,0/T/1,2 ; Rm/3)] (6.5, A ≥ 35 %)'; }
    else if (p.aus){ f = p.RpT / 1.5; ft = p.Rp20 / 1.05; txt = 'Rp1,0/T / 1,5 (6.4, 30 % ≤ A < 35 %)'; }
    else { f = Math.min(p.RpT / 1.5, p.Rm / 2.4); ft = p.Rp20 / 1.05; txt = 'mín(Rp0,2/T / 1,5 ; Rm/20 / 2,4) (6.2)'; }
    if (r){ st(r, 'f ' + (lbl || ''), txt + ' · Rm = ' + f1(p.Rm) + ', Rp/T = ' + f1(p.RpT) + (p.est ? ' (estimado)' : ''), f, 's', 'EN 13445-3 cl. 6'); }
    return { f: f, ft: ft };
  }

  // ---------------- PED 2014/68/UE ----------------
  function pedCat(t, PS, Vl){
    var PV = PS * Vl;
    if (PS <= 0.5) return 'excl';
    if (t === 1){ if (Vl <= 1) return PS <= 200 ? 'SEP' : PS <= 1000 ? 'III' : 'IV'; return PV <= 25 ? 'SEP' : PV <= 50 ? 'I' : PV <= 200 ? 'II' : PV <= 1000 ? 'III' : 'IV'; }
    if (t === 2){ if (Vl <= 1) return PS <= 1000 ? 'SEP' : 'III'; return PV <= 50 ? 'SEP' : PV <= 200 ? 'I' : PV <= 1000 ? 'II' : PV <= 3000 ? 'III' : 'IV'; }
    if (t === 3){ if (Vl <= 1) return PS <= 500 ? 'SEP' : 'II'; if (PV <= 200) return PS > 500 ? 'II' : 'SEP'; return PS <= 10 ? 'I' : 'II'; }
    if (PS > 10 && PV > 10000) return PS > 500 ? 'II' : 'I';
    return PS > 1000 ? 'I' : 'SEP';
  }
  var MODS = { SEP: 'Art. 4(3): buenas prácticas de ingeniería (sin marcado CE)', I: 'A', II: 'A2 · D1 · E1', III: 'B (tipo de diseño) + D · B (tipo de diseño) + F · B (tipo de producción) + E · B (tipo de producción) + C2 · H', IV: 'B (tipo de producción) + D · B (tipo de producción) + F · G · H1' };
  var CATN = { SEP: 0, I: 1, II: 2, III: 3, IV: 4 };
  function ped(prj, res){
    var p = prj.ped || defaults(prj).ped, d = prj.design, r = R();
    var PS = p.PS > 0 ? +p.PS : (res.mawp ? res.mawp.v : d.P), PSb = PS * 10, Vl = p.vol > 0 ? +p.vol : res.mass.vol * 1000;
    var t = p.state === 'gas' ? (p.group === '1' ? 1 : 2) : (p.group === '1' ? 3 : 4);
    st(r, 'PS', p.PS > 0 ? 'impuesta' : 'MAWP del recipiente (parte superior)', PS, 'p', 'art. 2(8)');
    st(r, 'PS', 'PS en bar', PSb, '', '');
    st(r, 'V', p.vol > 0 ? 'impuesto (L)' : 'volumen interior del recipiente (L)', Vl, '', 'art. 2(9)');
    st(r, 'PS·V', 'bar·L', PSb * Vl, '', 'anexo II');
    var cat = pedCat(t, PSb, Vl), up = '';
    if (t === 1 && p.unstable && (cat === 'I' || cat === 'II')){ cat = 'III'; up = ' (gas inestable: se eleva a III, nota del cuadro 1)'; }
    var TBL = { 1: 'Cuadro 1 · recipientes, gas grupo 1', 2: 'Cuadro 2 · recipientes, gas grupo 2', 3: 'Cuadro 3 · recipientes, líquido grupo 1', 4: 'Cuadro 4 · recipientes, líquido grupo 2' };
    note(r, TBL[t] + (p.state === 'liq' ? ' (líquido: presión de vapor a la TS ≤ 0,5 bar sobre la atmosférica)' : ' (gas, gas licuado, gas disuelto o vapor y líquidos con presión de vapor > 0,5 bar)'), 'art. 13, anexo II');
    var out = { table: t, cat: cat, PS: PS, V: Vl, PSV: PSb * Vl };
    if (cat === 'excl'){ note(r, 'PS ≤ 0,5 bar: fuera del ámbito de la directiva', 'art. 1(1)'); out.r = r; out.req = []; return out; }
    note(r, 'Categoría: ' + (cat === 'SEP' ? 'art. 4(3) (SEP)' : cat) + up + ' · módulos: ' + MODS[cat], 'art. 14');
    var n = CATN[cat], req = [];
    function rq(ref, t2, ok, warn, info){ req.push({ ref: ref, t: t2, ok: !!ok, warn: !!warn, info: !!info }); }
    // prueba hidrostática anexo I 7.4
    var fa = Infinity, ft = Infinity, who = '';
    res.comps.forEach(function(rc){ if (!rc.mat || !rc.mat.S) return; var q = rc.mat.Sa / rc.mat.S; if (q < fa){ fa = q; who = rc.c.name; } });
    if (!isFinite(fa)) fa = 1;
    var PTped = Math.max(1.25 * PS / fa, 1.43 * PS);
    // la relación fa/fT se toma con las tensiones admisibles ASME (coherente con UG-99)
    st(r, 'PT PED', 'máx[1,25·PS·fa/fT ; 1,43·PS],  fa/fT = ' + f3(1 / fa) + ' (' + who + ')', PTped, 'p', 'anexo I 7.4');
    st(r, 'PT ASME', '1,3·MAWP·LSR (UG-99(b))', res.test.PT, 'p', 'UG-99(b)');
    out.PT = Math.max(PTped, res.test.PT); st(r, 'PT a aplicar', 'mayor de ambas (en la parte superior)', out.PT, 'p', '');
    if (n >= 1){
      rq('anexo I 3.2.2', 'Prueba de presión final a ' + f2(out.PT) + ' MPa (mayor de PED 7.4 y UG-99)', true, false, true);
      rq('anexo I 3.1.2', 'Procedimientos de soldadura y soldadores cualificados' + (n >= 2 ? ' y aprobados por organismo notificado o entidad independiente reconocida' : ' (ASME IX o EN ISO 15614/9606)'), true, false, true);
      if (n >= 3) rq('anexo I 3.1.3', 'Personal de END aprobado por una entidad independiente reconocida (categorías III y IV)', true, false, true);
      rq('anexo I 4.3', n >= 2 ? 'Partes principales a presión con certificado de control específico (EN 10204 3.1) de fabricante con sistema de calidad certificado' : 'Documentación de materiales según 4.3', true, false, true);
      rq('anexo I 3.3 y 3.4', 'Marcado CE' + (n >= 2 ? ' con número del organismo notificado' : '') + ', placa de características e instrucciones de uso', true, false, true);
      rq('anexo I 2.10, 2.11', 'Dispositivos de protección contra sobrepresión (limitación a 1,1·PS)', true, false, true);
    }
    // 7.1: tensiones admisibles frente a las de la directiva
    var badS = [];
    res.comps.forEach(function(rc){ if (!rc.mat || !/shell|ellip|tori|hemi|cone|flat|bflange/.test(rc.c.type)) return; var pp = props(prj, rc.c.mat, d.T, rc.c.id); if (!pp) return; var fP = fEN(pp).f; if (rc.mat.S > fP * 1.0001) badS.push(rc.c.name + ' (S = ' + f1(rc.mat.S) + ' > f = ' + f1(fP) + ' MPa)'); });
    rq('anexo I 7.1.2', badS.length ? 'La tensión admisible ASME supera la de la directiva en: ' + badS.join(', ') + '. Justificar o usar f de 7.1.2' : 'Tensiones admisibles ASME ≤ límites del anexo I 7.1.2 (con Rp/T estimado salvo valores introducidos)', !badS.length, !!badS.length);
    // 7.5: energía de impacto 27 J
    if (n >= 1) rq('anexo I 7.5', 'Aceros: energía de impacto ≥ 27 J a la temperatura mínima prevista (≤ 20 °C). Las exenciones de UCS-66 no la justifican por sí solas: exigir ensayo Charpy en los certificados 3.1 o EAM/PMA', false, true);
    rq('anexo I 7.2', 'Coeficiente de junta: 1 con END total, 0,85 con END por muestreo, 0,7 sin END más allá del visual (equivale a E de UW-12 para ' + d.rt + ')', true, false, true);
    if (d.MDMT < -10 || (prj.ped.TSmin != null && prj.ped.TSmin !== '' && +prj.ped.TSmin < -10)) rq('anexo I 4.1(a)', 'Materiales con tenacidad adecuada a la TS mínima', false, true);
    out.req = req; out.r = r; out.fa = fa;
    out.TS = [prj.ped.TSmin != null && prj.ped.TSmin !== '' ? +prj.ped.TSmin : d.MDMT, prj.ped.TSmax != null && prj.ped.TSmax !== '' ? +prj.ped.TSmax : d.T];
    return out;
  }

  // ---------------- EN 13445-3 ----------------
  function betaTori(Y, X){
    Y = Math.min(Y, 0.04); var Z = Math.log(1 / Y) / Math.LN10, N = 1.006 - 1 / (6.2 + Math.pow(90 * Y, 4));
    var b06 = N * (-0.3635 * Z * Z * Z + 2.2124 * Z * Z - 3.2937 * Z + 1.8873), b1 = N * (-0.1833 * Z * Z * Z + 1.0383 * Z * Z - 1.2943 * Z + 0.837), b2 = Math.max(0.95 * (0.56 - 1.94 * Y - 82.5 * Y * Y), 0.5);
    if (X <= 0.06) return b06; if (X < 0.1) return 25 * ((0.1 - X) * b06 + (X - 0.06) * b1); if (X < 0.2) return 10 * ((0.2 - X) * b1 + (X - 0.1) * b2); return b2;
  }
  function en13445(prj, res){
    var d = prj.design, P = prj.en || defaults(prj).en, tol = num(P.tol, 0), z = { 'RT-1': 1, 'RT-2': 1, 'RT-3': 0.85, 'RT-4': 0.7 }[d.rt] || 0.7, rows = [];
    res.comps.forEach(function(rc){
      var c = rc.c, r = R(), pp = props(prj, c.mat, d.T, c.id), cc = rc.cc, Pc = rc.P, row = { c: c, r: r, asme: rc.treq, tn: c.tn };
      if (!pp){ row.err = 'material no definido'; rows.push(row); return; }
      var ff = fEN(pp, r), f = ff.f; row.f = f; row.est = pp.est;
      st(r, 'z', 'coeficiente de junta según el grupo de ensayo equivalente a ' + d.rt, z, '', 'EN 13445-3 tabla 5.6-1');
      st(r, 'P', 'presión de cálculo con columna (la misma que en ASME)', Pc, 'p', '');
      var e = null, emax = null, ea = c.tn - cc - tol;
      if (c.type === 'shell'){
        var Di = (c.basis === 'od' ? c.D - 2 * c.tn : c.D) + 2 * cc;
        e = st(r, 'e', 'P·Di / (2·f·z − P),  Di corroído = ' + f1(Di), Pc * Di / (2 * f * z - Pc), 'len', '7.4.2 ec. (7.4-1)');
        emax = 2 * f * z * ea / (Di + ea);
      } else if (c.type === 'hemi'){
        var Dh = c.D + 2 * cc; e = st(r, 'e', 'P·Di / (4·f·z − P)', Pc * Dh / (4 * f * z - Pc), 'len', '7.4.3 ec. (7.4-4)'); emax = 4 * f * z * ea / (Dh + ea);
      } else if (c.type === 'cone'){
        var al = c.alpha * Math.PI / 180, Dk = c.D + 2 * cc; e = st(r, 'e', 'P·Dk / (2·f·z − P) · 1/cos α  (Dk = diámetro mayor)', Pc * Dk / (2 * f * z - Pc) / Math.cos(al), 'len', '7.6.4 ec. (7.6-2)');
        note(r, 'Las uniones cono-cilindro (7.6.6 a 7.6.9) no se comparan');
        emax = 2 * f * z * ea * Math.cos(al) / (Dk + ea * Math.cos(al));
      } else if (c.type === 'ellip' || c.type === 'tori'){
        var Dd = c.D + 2 * cc, Rr, rr;
        if (c.type === 'ellip'){ var K = c.ratio || 2; if (K < 1.7 || K > 2.2) ck(r, 'K = Di/(2·hi) = ' + f2(K) + ' fuera de 1,7–2,2 (7.5.4)', false); Rr = Dd * (0.44 * K + 0.02); rr = Dd * (0.5 / K - 0.08); st(r, 'R, r', 'toriesférico equivalente: R = Di·(0,44·K + 0,02), r = Di·(0,5/K − 0,08)', Rr, 'len', '7.5.4'); }
        else { Rr = M().toriL(c) + cc; rr = M().toriR(c) + cc; st(r, 'R', 'radio de corona interior corroído', Rr, 'len', ''); st(r, 'r', 'radio de rebordeo interior corroído', rr, 'len', ''); }
        var es = st(r, 'es', 'P·R / (2·f·z − 0,5·P)', Pc * Rr / (2 * f * z - 0.5 * Pc), 'len', '7.5.3.2 ec. (7.5-1)');
        var ey = es, beta = 0;
        for (var it = 0; it < 40; it++){ beta = betaTori(Math.max(ey, 1e-3) / Rr, rr / Dd); var en2 = beta * Pc * (0.75 * Rr + 0.2 * Dd) / f; if (Math.abs(en2 - ey) < 1e-6){ ey = en2; break; } ey = en2; }
        st(r, 'β', 'procedimiento 7.5.3.5 con Y = mín(e/R ; 0,04), X = r/Di = ' + f3(rr / Dd), beta, '', '7.5.3.5');
        st(r, 'ey', 'β·P·(0,75·R + 0,2·Di) / f', ey, 'len', '7.5.3.2 ec. (7.5-2)');
        var fb = pp.RpT / 1.5, eb = st(r, 'eb', '(0,75·R + 0,2·Di)·[P/(111·fb)·(Di/r)^0,825]^(1/1,5),  fb = Rp/T/1,5', (0.75 * Rr + 0.2 * Dd) * Math.pow(Pc / (111 * fb) * Math.pow(Dd / rr, 0.825), 1 / 1.5), 'len', '7.5.3.2 ec. (7.5-3)');
        e = Math.max(es, ey, eb);
        ck(r, 'Límites de aplicación: r ≤ 0,2·Di, r ≥ 0,06·Di, r ≥ 2·e, e ≤ 0,08·De', rr <= 0.2 * Dd + 1e-6 && rr >= 0.06 * Dd - 1e-6 && rr >= 2 * e && e <= 0.08 * (Dd + 2 * c.tn), true, '7.5.3.1');
        // presión máxima por bisección
        var lo = 0, hi = Pc * 20;
        for (var k = 0; k < 60; k++){ var mid = (lo + hi) / 2, esm = mid * Rr / (2 * f * z - 0.5 * mid), bm = betaTori(Math.max(ea, 1e-3) / Rr, rr / Dd), eym = bm * mid * (0.75 * Rr + 0.2 * Dd) / f, ebm = (0.75 * Rr + 0.2 * Dd) * Math.pow(mid / (111 * fb) * Math.pow(Dd / rr, 0.825), 1 / 1.5); if (Math.max(esm, eym, ebm) <= ea) lo = mid; else hi = mid; }
        emax = lo;
      } else { row.na = c.type === 'flat' ? 'Tapas planas: EN 13445-3 cl. 10 (no comparado)' : 'Bridas: EN 13445-3 cl. 11 / anexo G (no comparado)'; rows.push(row); return; }
      row.e = e; row.ereq = e + cc + tol; row.Pmax = emax;
      st(r, 'e + c + δ', 'espesor de pedido mínimo (δ = tolerancia negativa ' + f2(tol) + ' mm)', row.ereq, 'len', '');
      st(r, 'Pmax', 'con ea = en − c − δ = ' + f2(ea) + ' mm', emax, 'p', '');
      ck(r, 'EN 13445-3: espesor de pedido ' + f2(row.ereq) + ' mm ≤ nominal ' + f2(c.tn) + ' mm', row.ereq <= c.tn + 1e-9);
      if (rc.treq != null){ row.dASME = rc.treq - row.ereq; note(r, 'ASME (requerido + c) = ' + f2(rc.treq) + ' mm · EN (e + c + δ) = ' + f2(row.ereq) + ' mm · diferencia ' + f2(row.dASME) + ' mm'); }
      if (pp.est) note(r, 'Rp/T estimado a partir del Sy ambiente de II-D con la curva genérica de EN 10028; introducir el valor del certificado o de EN 10028 para un cálculo definitivo');
      row.ok = row.ereq <= c.tn + 1e-9;
      rows.push(row);
    });
    // prueba EN 13445-5 10.2.3.3: máx[1,25·Pd·fa/fT ; 1,43·PS] con las tensiones nominales EN
    var q = 1, who = '';
    rows.forEach(function(x){ if (!x.f) return; var p20 = props(prj, x.c.mat, 20, x.c.id); if (!p20) return; var fa = fEN(p20).f, qq = fa / x.f; if (qq > q){ q = qq; who = x.c.name; } });
    var PS = res.mawp ? res.mawp.v : d.P, PTen = Math.max(1.25 * d.P * q, 1.43 * PS);
    return { rows: rows, z: z, PT: PTen, fafT: q, fWho: who, ok: rows.every(function(x){ return x.ok !== false; }) };
  }

  // ---------------- camisas (Ap. 9) ----------------
  function jacket(prj, res){
    var J = prj.jacket, d = prj.design, r = R(), host = compById(prj, J.host);
    if (!host || host.type !== 'shell'){ ck(r, 'La camisa debe apoyarse en una virola', false); return { r: r, ok: false }; }
    var mj = V.mat(J.mat, num(J.T, d.T)), ms = V.mat(host.mat, Math.max(num(J.T, d.T), d.T));
    if (!mj || !ms){ ck(r, 'Material no definido', false); return { r: r, ok: false }; }
    var cs = host.c != null ? +host.c : +d.c, cj = num(J.cj, 0), Pj = num(J.P, 0), Sj = mj.S, Ss = ms.S;
    var Dsi = host.basis === 'od' ? host.D - 2 * host.tn : host.D, Ro = Dsi / 2 + host.tn - cj, ts = host.tn - cs - cj;   // virola interior corroída por dentro (c) y por el lado de la camisa (cj)
    var Rj = st(r, 'Rj', 'radio interior de la camisa (corroído) = Dj/2 + cj', num(J.Dj, 0) / 2 + cj, 'len', '9-5(b)');
    var Rs = st(r, 'Rs', 'radio exterior de la virola interior (corroído por el lado de la camisa)', Ro, 'len', '9-5(b)');
    var j = st(r, 'j', 'Rj − Rs (espacio de la camisa)', Rj - Rs, 'len', '9-5(b)');
    var E = 1; // soldadura longitudinal de la camisa con RT según el diseño
    var trj = st(r, 'trj', 'Pj·Rj / (Sj·E − 0,6·Pj)', Pj * Rj / (Sj * E - 0.6 * Pj), 'len', 'UG-27(c)(1), 9-4(a)');
    ck(r, 'Camisa: tj − cj = ' + f2(J.tj - cj) + ' mm ≥ trj = ' + f2(trj) + ' mm', J.tj - cj >= trj - 1e-9, false, 'UG-27');
    var tjc = J.tj - cj, tc = num(J.tc, 0) - cj, trc = 0, P0 = Pj;
    // presión exterior en la virola interior
    var Lp = res.L.pos[host.id], Lj = J.L > 0 ? +J.L : (Lp.s1 - Lp.s0);
    var Pe = Pj + (J.vac ? 0.101325 : 0) + (d.Pext > 0 ? 0 : 0);
    st(r, 'Pext virola', 'Pj' + (J.vac ? ' + vacío interior total (0,101 MPa)' : ''), Pe, 'p', '9-1(c), UG-28');
    var mx = V.mat(host.mat, Math.max(num(J.T, d.T), d.T)), pa = V.cylPa({ Do: 2 * (Ro + cj), t: ts, L: Lj, chart: mx.ch, T: Math.max(num(J.T, d.T), d.T), ys: mx.ty ? mx.ty[1] : 0, S: mx.S }, r);
    if (pa.err) ck(r, pa.err, false); else ck(r, 'Virola interior a presión exterior (L = ' + f1(Lj) + ' mm): Pa = ' + f3(pa.Pa) + ' MPa ≥ ' + f3(Pe) + ' MPa', pa.Pa >= Pe - 1e-9, false, 'UG-28(c)');
    // cierres Fig. 9-5
    var cl = J.closure, type = String(J.type);
    if (cl === 'a'){
      trc = trj; ck(r, 'Cierre (a): tc ≥ trj', tc >= trc - 1e-9, false, '9-5(c)(1)'); ck(r, 'Cierre (a): tc ≤ 16 mm', J.tc <= 16, false, '9-5(c)(1)');
      if (type === '3') ck(r, 'El cierre (a) no se admite en camisas tipo 3', false, '9-5(c)(1)');
      note(r, 'Radio de rebordeo r ≥ 3·tc = ' + f1(3 * J.tc) + ' mm; soldadura Y ≥ ' + (type === '1' ? '0,7' : '0,83') + '·tc = ' + f1((type === '1' ? 0.7 : 0.83) * J.tc) + ' mm', '9-5(c)(1)');
    } else if (cl === 'b'){
      trc = trj; ck(r, 'Cierre (b-1/b-2): tc ≥ trj', tc >= trc - 1e-9, false, '9-5(c)(2)');
    } else if (cl === 'b3'){
      trc = Math.max(trj, st(r, 'trc (b-3)', '1,414·√(P·Rs·j/S)', 1.414 * Math.sqrt(Pj * Rs * j / Sj), 'len', '9-5(c)(2)')); ck(r, 'Cierre (b-3): tc ≥ trc = ' + f2(trc) + ' mm', tc >= trc - 1e-9, false, '9-5(c)(2)');
    } else if (cl === 'de'){
      if (type !== '1') ck(r, 'Los cierres (d) y (e) solo se admiten en camisas tipo 1', false, '9-5(c)(4)');
      ck(r, 'Cierres (d)/(e): trj ≤ 16 mm', trj <= 16, false, '9-5(c)(4)');
      trc = Math.max(st(r, 'trc₁', '2·trj', 2 * trj, 'len', '9-5(c)(4)'), st(r, 'trc₂', '0,707·j·√(P/S)', 0.707 * j * Math.sqrt(Pj / Sj), 'len', '9-5(c)(4)'));
      ck(r, 'Cierre (d)/(e): tc ≥ trc = ' + f2(trc) + ' mm', tc >= trc - 1e-9, false, '9-5(c)(4)');
      note(r, 'Soldaduras: Y ≥ mín(0,75·tc ; 0,75·ts) = ' + f1(Math.min(0.75 * J.tc, 0.75 * host.tn)) + ' mm; Z ≥ tj = ' + f1(J.tj) + ' mm', '9-5(c)(4)');
    } else { // f: barra de cierre
      if (type === '1'){
        trc = Math.max(st(r, 'trc₁', '2·trj', 2 * trj, 'len', '9-5(c)(5) → (4)'), st(r, 'trc₂', '0,707·j·√(P/S)', 0.707 * j * Math.sqrt(Pj / Sj), 'len', '9-5(c)(5) → (4)'));
      } else {
        trc = st(r, 'trc', '1,414·√(P·R·j/S),  R = máx(Rs ; Rj) (criterio de PTB-4 E4.11.1)', 1.414 * Math.sqrt(Pj * Math.max(Rs, Rj) * j / Sj), 'len', '9-5(c)(5)');
        var jmax = st(r, 'j máx', '2·S·ts² / (P·Rj) − 0,5·(ts + tj)', 2 * Sj * ts * ts / (Pj * Rj) - 0.5 * (ts + tjc), 'len', '9-5(c)(5), PTB-4 E4.11.1');
        ck(r, 'Espacio de la camisa j = ' + f1(j) + ' mm ≤ j máx = ' + f1(jmax) + ' mm', j <= jmax + 1e-9, false, '9-5(c)(5)');
      }
      ck(r, 'Barra de cierre (f): tc − c = ' + f2(tc) + ' mm ≥ trc = ' + f2(trc) + ' mm', tc >= trc - 1e-9, false, '9-5(c)(5)');
      var Y = Math.min(1.5 * tc, 1.5 * ts), ab = Math.min(6, tc, ts);
      st(r, 'Y = a + b', 'mín(1,5·tc ; 1,5·ts)', Y, 'len', '9-5(c)(5)'); st(r, 'a, b mín.', 'mín(6 mm ; tc ; ts)', ab, 'len', '9-5(c)(5)'); st(r, 'Z', 'Y − ts/2 (PTB-4 E4.11.1)', Y - ts / 2, 'len', '');
    }
    var sj0 = (Lp.s0 + Lp.s1) / 2 - Lj / 2, sj1 = sj0 + Lj;
    prj.nozzles.forEach(function(n){ if (n.host !== host.id) return; var sn = Lp.s0 + num(n.a, 0); if (sn + n.od / 2 > sj0 && sn - n.od / 2 < sj1) ck(r, 'La conexión ' + n.mark + ' atraviesa la camisa: diseñar el paso con un detalle de la Fig. 9-6 y el refuerzo según UG-37(d)(2)', false, true, '9-6, UG-37(d)(2)'); });
    var out = { r: r, ok: r.checks.every(function(k){ return k.ok || k.warn || k.info; }), trj: trj, trc: trc, j: j, Rj: Rj, Rs: Rs, L: Lj };
    // masa de la camisa
    var mjv = Math.PI * ((Rj + J.tj - cj) * (Rj + J.tj - cj) - (Rj - cj) * (Rj - cj)) * Lj * 1e-9 * (mj.rho || 7850);
    var mcl = 2 * Math.PI * ((Rj + Rs) / 2) * j * J.tc * 1e-9 * (mj.rho || 7850);
    out.mass = mjv + mcl; out.vol = Math.PI * (Rj * Rj - Rs * Rs) * Lj * 1e-9;
    note(r, 'Masa estimada de camisa y cierres: ' + f1(out.mass) + ' kg · volumen de la cámara ' + f3(out.vol) + ' m³');
    return out;
  }
  var HP_OD = { '2': 60.3, '3': 88.9, '4': 114.3 };
  function halfpipe(prj, res){
    var J = prj.hp, d = prj.design, r = R(), host = compById(prj, J.host);
    if (!host || host.type !== 'shell'){ ck(r, 'La media caña debe estar en una virola', false); return { r: r, ok: false }; }
    var mj = V.mat(J.mat, num(J.T, d.T)), ms = V.mat(host.mat, Math.max(num(J.T, d.T), d.T)); if (!mj || !ms){ ck(r, 'Material no definido', false); return { r: r, ok: false }; }
    var cs = host.c != null ? +host.c : +d.c, od = HP_OD[J.nps] || 88.9, rr = st(r, 'r', 'radio interior de la media caña = (D.E. − 2·tj)/2', (od - 2 * J.tj) / 2 + num(J.cj, 0), 'len', 'EE-1');
    var P1 = num(J.P, 0), S1 = mj.S;
    var T = st(r, 'T', 'P1·r / (0,85·S1 − 0,6·P1)', P1 * rr / (0.85 * S1 - 0.6 * P1), 'len', 'EE-1 ec. (1)');
    ck(r, 'Espesor de la media caña ' + f2(J.tj - num(J.cj, 0)) + ' mm ≥ T = ' + f2(T) + ' mm', J.tj - num(J.cj, 0) >= T - 1e-9, false, 'EE-1');
    ck(r, 'Tamaño NPS 2, 3 o 4 (alcance de las Figs. EE-1 a EE-3)', !!HP_OD[J.nps], false, 'EE-1');
    var Di = (host.basis === 'od' ? host.D - 2 * host.tn : host.D) + 2 * cs, ts = host.tn - cs, Do = Di + 2 * ts;
    var A = Math.PI / 4 * (Do * Do - Di * Di), I = Math.PI / 64 * (Do * Do * Do * Do - Di * Di * Di * Di);
    var Pin = d.P + (res.byId[host.id] ? res.byId[host.id].ph : 0);
    var Sp = st(r, "S'", 'P·D/(4·ts) + F/A + M·c/I,  F = ' + f1(num(J.Fax, 0) / 1000) + ' kN (+ tracción), M = ' + f1(num(J.Mb, 0) / 1e6) + ' kN·m', Math.max(0, Pin * Di / (4 * ts) + num(J.Fax, 0) / A + num(J.Mb, 0) * (Do / 2) / I), 's', 'EE-2');
    var S = ms.S, F = st(r, 'F', "mín(1,5·S − S' ; 1,5·S)", Math.min(1.5 * S - Sp, 1.5 * S), 's', 'EE-2');
    if (J.K > 0){ var Pp = st(r, "P'", 'F / K,  K = ' + f2(+J.K) + ' (Fig. EE-1, EE-2 o EE-3)', F / J.K, 'p', 'EE-2'); ck(r, "P' = " + f3(Pp) + ' MPa ≥ P1 = ' + f3(P1) + ' MPa', Pp >= P1 - 1e-9, false, 'EE-2'); }
    else ck(r, "Introducir K de las Figs. EE-1 a EE-3 (según NPS, D y ts) para obtener P' = F/K", false, true, 'EE-2');
    var pitch = num(J.pitch, 150), Lp = res.L.pos[host.id], turns = J.turns > 0 ? +J.turns : Math.max(1, Math.floor((Lp.s1 - Lp.s0 - 100) / pitch));
    var Lhp = turns * Math.sqrt(Math.pow(Math.PI * Do, 2) + pitch * pitch);
    var mass = Lhp * Math.PI / 2 * ((od / 2) * (od / 2) - (od / 2 - J.tj) * (od / 2 - J.tj)) * 1e-9 * (mj.rho || 7850);
    note(r, turns + ' vueltas con paso ' + f1(pitch) + ' mm · longitud desarrollada ' + f1(Lhp / 1000) + ' m · masa ' + f1(mass) + ' kg · soldadura 2 × ' + f1(Lhp / 1000) + ' m');
    return { r: r, ok: r.checks.every(function(k){ return k.ok || k.warn || k.info; }), T: T, Lhp: Lhp, mass: mass, turns: turns, od: od };
  }

  // ---------------- UHX-12: placa tubular de tubos en U ----------------
  var UHX_T = { // E*/E (α) y ν* (β) por h/p — Figuras UHX-11.3 (triangular) y UHX-11.4 (cuadrada)
    tri: { a: [[0.10, 0.0353, 1.2502, -0.0491, 0.3604, -0.6100], [0.25, 0.0135, 0.9910, 1.0080, -1.0498, 0.0184], [0.50, 0.0054, 0.5279, 3.0461, -4.3657, 1.9435], [2.00, -0.0029, 0.2126, 3.9906, -6.1730, 3.4307]],
      b: [[0.10, -0.0958, 0.6209, -0.8683, 2.1099, -1.6831], [0.15, 0.8897, -9.0855, 36.1435, -59.5425, 35.8223], [0.25, 0.7439, -4.4989, 12.5779, -14.2092, 5.7822], [0.50, 0.9100, -4.8901, 12.4325, -12.7039, 4.4298], [1.00, 0.9923, -4.8759, 12.3572, -13.7214, 5.7629], [2.00, 0.9966, -4.1978, 9.0478, -7.9955, 2.2398]] },
    sq: { a: [[0.10, 0.0676, 1.5756, -1.2119, 1.7715, -1.2628], [0.25, 0.0250, 1.9251, -3.5230, 6.9830, -5.0017], [0.50, 0.0394, 1.3024, -1.1041, 2.8714, -2.3994], [2.00, 0.0372, 1.0314, -0.6402, 2.6201, -2.1929]],
      b: [[0.10, -0.0791, 0.6008, -0.3468, 0.4858, -0.3606], [0.15, 0.3345, -2.8420, 10.9709, -15.8994, 8.3516], [0.25, 0.4296, -2.6350, 8.6864, -11.5227, 5.8544], [0.50, 0.3636, -0.8057, 2.0463, -2.2902, 1.1862], [1.00, 0.3527, -0.2842, 0.4354, -0.0901, -0.1590], [2.00, 0.3341, 0.1260, -0.6920, 0.6877, -0.0600]] } };
  function polyRow(row, x){ return row[1] + row[2] * x + row[3] * x * x + row[4] * x * x * x + row[5] * x * x * x * x; }
  function polyInterp(tab, hp, mu){
    hp = Math.max(0.1, Math.min(2, hp));
    for (var k = 0; k < tab.length - 1; k++) if (hp <= tab[k + 1][0]){ var a = polyRow(tab[k], mu), b = polyRow(tab[k + 1], mu); return a + (b - a) * (hp - tab[k][0]) / (tab[k + 1][0] - tab[k][0]); }
    return polyRow(tab[tab.length - 1], mu);
  }
  function modE(ref, T){ var m = V.mat(ref, T); if (!m || !m.ch) return null; var fb = V.factorB(m.ch, T, 1e-6, m.ty ? m.ty[1] : 0); return fb && !fb.err ? fb.E : null; }
  // i: geometría y propiedades ya resueltas (unidades coherentes: se acepta cualquier sistema)
  function uhx12core(i, Ps, Pt, h, r){
    var Do = 2 * i.ro + i.dt, ao = Do / 2, mu = (i.p - i.dt) / i.p;
    var dst = Math.max(i.dt - 2 * i.tt * (i.Et / i.E) * (i.St / i.S) * i.rho, i.dt - 2 * i.tt);
    var LL = i.LL1 > 0 ? i.LL1 : Do, AL = Math.min(i.UL1 * LL, 4 * Do * i.p);
    var pst = i.p / Math.sqrt(1 - 4 * AL / (Math.PI * Do * Do)), must = (pst - dst) / pst, hgp = Math.max(i.hg - i.ct, 0);
    var cfgA = i.cfg === 'a';
    var as = cfgA ? i.Ds / 2 : i.Gs / 2, ac = cfgA ? i.Dc / 2 : i.Gc / 2, rs = as / ao, rc = ac / ao;
    var MTS = ao * ao / 4 * ((rs - 1) * (rs * rs + 1) * Ps - (rc - 1) * (rc * rc + 1) * Pt);
    var hp = h / i.p, tab = UHX_T[i.pat === 'sq' ? 'sq' : 'tri'], EsE = polyInterp(tab.a, hp, must), nus = polyInterp(tab.b, hp, must), Es = EsE * i.E;
    var o = { Do: Do, ao: ao, mu: mu, dst: dst, AL: AL, pst: pst, must: must, hgp: hgp, rs: rs, rc: rc, MTS: MTS, hp: hp, EsE: EsE, nus: nus, Es: Es };
    var K = i.A / Do, F, Ms;
    if (cfgA){
      var nu = 0.3, w = Math.pow(12 * (1 - nu * nu), 0.25);
      var bs = w / Math.sqrt((i.Ds + i.ts) * i.ts), ks = bs * i.Es * Math.pow(i.ts, 3) / (6 * (1 - nu * nu)), ls = 6 * i.Ds / (h * h * h) * ks * (1 + h * bs + h * h * bs * bs / 2);
      var ds = i.Ds * i.Ds / (4 * i.Es * i.ts) * (1 - nu / 2), ws = rs * ks * bs * ds * (1 + h * bs);
      var bc = w / Math.sqrt((i.Dc + i.tc) * i.tc), kc = bc * i.Ec * Math.pow(i.tc, 3) / (6 * (1 - nu * nu)), lc = 6 * i.Dc / (h * h * h) * kc * (1 + h * bc + h * h * bc * bc / 2);
      var dc = i.Dc * i.Dc / (4 * i.Ec * i.tc) * (1 - nu / 2), wc = rc * kc * bc * dc * (1 + h * bc);
      F = (1 - nus) / Es * (ls + lc + i.E * Math.log(K)); Ms = MTS + wc * Pt - ws * Ps;
      Object.assign(o, { bs: bs, ks: ks, ls: ls, ds: ds, ws: ws, bc: bc, kc: kc, lc: lc, dc: dc, wc: wc });
    } else {
      F = (1 - nus) / Es * (i.E * Math.log(K)); Ms = MTS + i.W * (i.Gc - i.Gs) / (2 * Math.PI * Do);
    }
    var Mp = (Ms - ao * ao / 8 * F * (Ps - Pt)) / (1 + F), Mo = Mp + ao * ao / 16 * (3 + nus) * (Ps - Pt), Mx = Math.max(Math.abs(Mp), Math.abs(Mo));
    var sig = 6 * Mx / (must * (h - hgp) * (h - hgp)), tau = 1 / (4 * mu) * (Do / h) * Math.abs(Ps - Pt);
    Object.assign(o, { K: K, F: F, Ms: Ms, Mp: Mp, Mo: Mo, M: Mx, sig: sig, tau: tau });
    if (cfgA){
      var X = Mp + ao * ao / 8 * (Ps - Pt), kk = 12 * (1 - nus) / Es * (ao / (h * h * h));
      o.ssm = as * as * Ps / ((2 * as + i.ts) * i.ts);
      o.ssb = 6 * o.ks / (i.ts * i.ts) * (o.bs * o.ds * Ps + kk * (1 + h * o.bs / 2) * X);
      o.ss = Math.abs(o.ssm) + Math.abs(o.ssb);
      o.scm = ac * ac * Pt / ((2 * ac + i.tc) * i.tc);
      o.scb = 6 * o.kc / (i.tc * i.tc) * (o.bc * o.dc * Pt - kk * (1 + h * o.bc / 2) * X);
      o.sc = Math.abs(o.scm) + Math.abs(o.scb);
      o.Ls = 1.8 * Math.sqrt(i.Ds * i.ts); o.Lc = 1.8 * Math.sqrt(i.Dc * i.tc);
    }
    return o;
  }
  function uhxInputs(prj){
    var U = prj.uhx, T = num(U.T, prj.design.T);
    function SS(ref, man){ var m = V.mat(ref, T); return man > 0 ? +man : (m ? m.S : NaN); }
    function EE(ref, man){ return man > 0 ? +man : (modE(ref, T) || 195000); }
    var mt = V.mat(U.tmat, T), Stt = U.St > 0 ? +U.St : (mt ? mt.S / (/welded|soldad/i.test(mt.name) ? 0.85 : 1) : NaN);
    return { cfg: U.cfg === 'd' ? 'd' : 'a', pat: U.pat, A: +U.A, dt: +U.dt, tt: +U.tt, p: +U.p, ro: +U.ro, UL1: num(U.UL1, 0), LL1: num(U.LL1, 0), rho: num(U.rho, 0), ct: num(U.ct, 0), hg: num(U.hg, 0),
      E: EE(U.mat, U.E), Et: EE(U.tmat, U.Et), Es: EE(U.smat, U.Es), Ec: EE(U.cmat, U.Ec), S: SS(U.mat, U.S), St: Stt, Ss: SS(U.smat, U.Ss), Sc: SS(U.cmat, U.Sc),
      Ds: +U.Ds, ts: +U.ts, Dc: +U.Dc, tc: +U.tc, Gs: +U.Gs, Gc: +U.Gc, W: num(U.W, 0) };
  }
  function uhxCases(U){ return [{ k: '1', Ps: num(U.Psmin, 0), Pt: num(U.Ptmax, 0) }, { k: '2', Ps: num(U.Psmax, 0), Pt: num(U.Ptmin, 0) }, { k: '3', Ps: num(U.Psmax, 0), Pt: num(U.Ptmax, 0) }]; }
  function uhxEval(i, U, h){ var worst = null; uhxCases(U).forEach(function(cs){ var o = uhx12core(i, cs.Ps, cs.Pt, h); o.cs = cs; o.ratio = Math.max(o.sig / (2 * i.S), o.tau / (0.8 * i.S), i.cfg === 'a' ? Math.max(o.ss / (1.5 * i.Ss), o.sc / (1.5 * i.Sc)) : 0); if (!worst || o.ratio > worst.ratio) worst = o; }); return worst; }
  function uhx(prj){
    var U = prj.uhx, i = uhxInputs(prj), r = R();
    st(r, 'Configuración', i.cfg === 'a' ? 'a: integral con envolvente y canal' : 'd: con junta en envolvente y canal', i.cfg.toUpperCase(), '', 'Fig. UHX-12.1');
    if (!(i.S > 0)){ ck(r, 'Falta la tensión admisible de la placa', false); return { r: r, ok: false }; }
    var h = num(U.h, 0), all = uhxCases(U).map(function(cs){ var o = uhx12core(i, cs.Ps, cs.Pt, h); o.cs = cs; return o; });
    var g = all.reduce(function(a, b){ return b.sig > a.sig ? b : a; });
    st(r, 'Do', '2·ro + dt', g.Do, 'len', 'UHX-11.5.1'); st(r, 'μ', '(p − dt)/p', g.mu, '', 'UHX-11.5.1'); st(r, 'd*', 'máx[dt − 2·tt·(EtT/E)·(StT/S)·ρ ; dt − 2·tt]', g.dst, 'len', 'UHX-11.5.1');
    st(r, 'AL', 'UL1·LL1 (≤ 4·Do·p)', g.AL, 'a', 'UHX-11.3'); st(r, 'p*', 'p / √(1 − 4·AL/(π·Do²))', g.pst, 'len', 'UHX-11.5.1'); st(r, 'μ*', '(p* − d*)/p*', g.must, '', 'UHX-11.5.1');
    st(r, 'h/p', 'h = ' + f2(h) + ' mm', g.hp, '', 'UHX-12.5.3'); st(r, 'E*/E', 'polinomio de la Fig. ' + (i.pat === 'sq' ? 'UHX-11.4 (cuadrada)' : 'UHX-11.3 (triangular)'), g.EsE, '', 'UHX-11.5.2'); st(r, 'ν*', 'idem', g.nus, '', 'UHX-11.5.2');
    st(r, 'ρs, ρc', i.cfg === 'a' ? 'as/ao, ac/ao con as = Ds/2, ac = Dc/2' : 'Gs/Do, Gc/Do', g.rs, '', 'UHX-12.5.2'); st(r, 'K', 'A / Do', g.K, '', 'UHX-12.5.5'); st(r, 'F', i.cfg === 'a' ? '(1 − ν*)/E*·(λs + λc + E·ln K)' : '(1 − ν*)/E*·E·ln K', g.F, '', 'UHX-12.5.5');
    if (i.cfg === 'a'){ st(r, 'ks, kc', 'rigideces de envolvente y canal', g.ks, 'f', 'UHX-12.5.4'); st(r, 'λs', '', g.ls, 's', 'UHX-12.5.4'); st(r, 'λc', '', g.lc, 's', 'UHX-12.5.4'); st(r, 'ωs, ωc', '', g.ws, '', 'UHX-12.5.4'); }
    all.forEach(function(o){
      var k = 'Caso ' + o.cs.k + ' (Ps = ' + f3(o.cs.Ps) + ', Pt = ' + f3(o.cs.Pt) + ' MPa)';
      st(r, 'M* · ' + k, 'momento en el borde no perforado', o.Ms, 'fl', 'UHX-12.5.6'); st(r, 'Mp / Mo', '', o.Mp, 'fl', 'UHX-12.5.7'); st(r, 'Mo', '', o.Mo, 'fl', 'UHX-12.5.7');
      st(r, 'σ', '6·M / [μ*·(h − h′g)²]', o.sig, 's', 'UHX-12.5.8'); ck(r, k + ': σ = ' + f1(o.sig) + ' ≤ 2·S = ' + f1(2 * i.S) + ' MPa', o.sig <= 2 * i.S + 1e-9, false, 'UHX-12.5.8');
      st(r, 'τ', '(1/(4·μ))·(Do/h)·|Ps − Pt|', o.tau, 's', 'UHX-12.5.9'); ck(r, k + ': τ = ' + f1(o.tau) + ' ≤ 0,8·S = ' + f1(0.8 * i.S) + ' MPa', o.tau <= 0.8 * i.S + 1e-9, false, 'UHX-12.5.9');
      if (i.cfg === 'a'){ st(r, 'σs (m + b)', '|σs,m| + |σs,b|', o.ss, 's', 'UHX-12.5.10'); ck(r, k + ': envolvente σs = ' + f1(o.ss) + ' ≤ 1,5·Ss = ' + f1(1.5 * i.Ss) + ' MPa', o.ss <= 1.5 * i.Ss + 1e-9, false, 'UHX-12.5.10');
        st(r, 'σc (m + b)', '|σc,m| + |σc,b|', o.sc, 's', 'UHX-12.5.10'); ck(r, k + ': canal σc = ' + f1(o.sc) + ' ≤ 1,5·Sc = ' + f1(1.5 * i.Sc) + ' MPa', o.sc <= 1.5 * i.Sc + 1e-9, false, 'UHX-12.5.10'); }
    });
    if (i.cfg === 'a') note(r, 'Envolvente con espesor ts en ≥ 1,8·√(Ds·ts) = ' + f1(g.Ls) + ' mm y canal con tc en ≥ 1,8·√(Dc·tc) = ' + f1(g.Lc) + ' mm junto a la placa', 'UHX-12.5.10');
    // espesor mínimo por bisección
    var lo = 1, hi = 1000, ok0 = uhxEval(i, U, hi).ratio <= 1;
    if (ok0){ for (var k = 0; k < 60; k++){ var mid = (lo + hi) / 2; if (uhxEval(i, U, mid).ratio <= 1) hi = mid; else lo = mid; } st(r, 'h mínimo', 'menor espesor que cumple todos los casos', hi, 'len', 'UHX-12.5'); }
    return { r: r, ok: r.checks.every(function(k){ return k.ok || k.warn || k.info; }), hmin: ok0 ? hi : null, worst: g };
  }

  // ---------------- cribado de fatiga (VIII-2 5.5.2.3, método A) ----------------
  var DT_TAB = [[28, 0], [56, 1], [83, 2], [139, 4], [194, 8], [250, 12], [1e9, 20]];
  function fatigue(prj, res){
    var F = prj.fat, r = R(), integ = F.constr !== 'non', lim = integ ? (F.knuckle ? 350 : 1000) : (F.knuckle ? 60 : 400);
    var Su = 0, who = '';
    res.comps.forEach(function(rc){ if (rc.mat && rc.mat.ty && rc.mat.ty[0] > Su){ Su = rc.mat.ty[0]; who = rc.c.name; } });
    ck(r, 'Método A aplicable a materiales con Su ≤ 552 MPa (mayor: ' + f1(Su) + ' MPa, ' + who + ')', Su <= 552, false, '5.5.2.3');
    var NTE = 0, lines = String(F.cycles || '').split(/\n/).map(function(l){ return l.trim(); }).filter(Boolean);
    lines.forEach(function(l){ var q = l.split(/[;\t]/).map(function(s){ return +String(s).replace(',', '.'); }); if (q.length >= 2 && isFinite(q[0]) && isFinite(q[1])){ var fct = DT_TAB.filter(function(t){ return q[0] <= t[0]; })[0][1]; NTE += fct * q[1]; } });
    var NFP = num(F.NFP, 0), NPO = num(F.NPO, 0), NTa = num(F.NTa, 0);
    st(r, 'N ΔFP', 'ciclos de presión completos previstos (incluye arranques y paradas)', NFP, '', '5.5.2.3');
    st(r, 'N ΔPO', 'ciclos de presión de operación con rango > ' + (integ ? '20' : '15') + ' % de la presión de diseño', NPO, '', '5.5.2.3');
    st(r, 'N ΔTE', 'Σ (factor de la Tabla 5.8 según ΔT entre puntos adyacentes) × ciclos', NTE, '', 'Tabla 5.8');
    st(r, 'N ΔTα', 'ciclos de temperatura en uniones de materiales con distinto α y (α1 − α2)·ΔT > 0,00034', NTa, '', '5.5.2.3');
    var sum = NFP + NPO + NTE + NTa;
    st(r, 'Σ', 'N ΔFP + N ΔPO + N ΔTE + N ΔTα', sum, '', 'Tabla 5.9');
    ck(r, (integ ? 'Construcción integral' : 'Construcción no integral') + (F.knuckle ? ', boquillas o accesorios en la zona de rebordeo de fondos' : ', resto de componentes') + ': Σ = ' + Math.round(sum) + ' ≤ ' + lim + ' → no se requiere análisis de fatiga', sum <= lim, false, 'Tabla 5.9');
    if (sum > lim) note(r, 'No supera el cribado: realizar análisis de fatiga (VIII-2 5.5.3 elástico o 5.5.4 elastoplástico) o el método B (5.5.2.4)');
    return { r: r, ok: sum <= lim && Su <= 552, sum: sum, lim: lim };
  }

  // ---------------- izado ----------------
  function massLine(prj, res){ // distribución de masa a lo largo del eje [(s0, s1, kg)]
    var segs = [];
    res.comps.forEach(function(rc){ var p = res.L.pos[rc.c.id]; segs.push([Math.min(p.s0, p.s1), Math.max(p.s0, p.s1), rc.mass || 0]); });
    res.nozzles.forEach(function(rn){ var n = rn.n, host = compById(prj, n.host); if (!host) return; var p = res.L.pos[host.id], s = /ellip|tori|hemi|flat/.test(host.type) ? (p.side === 'start' ? p.s0 : p.s1) : p.s0 + num(n.a, 0); segs.push([s - 1, s + 1, rn.mass || 0]); });
    var L = res.loads, sp = prj.support || {};
    if (L && !L.err && L.skirt) segs.push([L.zg, L.sAtt, Math.PI * (L.skirt.Ds - (+sp.t || 10)) * (+sp.t || 10) * (L.sAtt - L.zg) * 7.85e-6]);
    if (L && !L.err && L.legs){ var LGm = L.legs.LG || { A: 3600, b: 168 }, pdm = L.legs.pad || { t: 10, w: 270, L: 400 }; segs.push([L.zg, L.sAtt + 300, L.legs.n * (LGm.A * (L.sAtt - L.zg + 300) + Math.pow(LGm.b + 120, 2) * 20 + pdm.t * pdm.w * pdm.L) * 7.85e-6]); }
    if (L && !L.err && L.saddle && sp.type === 'saddle'){ var sA = +sp.A || 0, body = prj.comps.filter(function(c){ return c.type === 'shell'; }); if (body.length){ var s0 = Math.min.apply(null, body.map(function(c){ return res.L.pos[c.id].s0; })), s1 = Math.max.apply(null, body.map(function(c){ return res.L.pos[c.id].s1; })), ms = typeof FABDOC !== 'undefined' ? FABDOC.saddleDims(prj, L, sp).mass : 150; [s0 + sA, s1 - sA].forEach(function(x){ segs.push([x - 1, x + 1, ms]); }); } }
    if (res.fab && res.fab.jacket && res.fab.jacket.mass){ var hj = compById(prj, prj.jacket.host); if (hj){ var pj = res.L.pos[hj.id]; segs.push([pj.s0, pj.s1, res.fab.jacket.mass]); } }
    return segs;
  }
  function lift(prj, res){
    var Lf = prj.lift, r = R(), m = V.mat(Lf.mat, 40), Sy = m && m.ty ? m.ty[1] : 240, segs = massLine(prj, res);
    var W0 = segs.reduce(function(a, s){ return a + s[2]; }, 0) + num(Lf.rig, 0), n = Math.max(1, +Lf.n || 2), Cd = num(Lf.Cd, 2);
    st(r, 'm izado', 'masa en vacío (envolvente, conexiones, faldón y camisa) + aparejos', W0, 'kg', '');
    var smin = Math.min.apply(null, segs.map(function(s){ return s[0]; })), smax = Math.max.apply(null, segs.map(function(s){ return s[1]; }));
    var sL = Lf.sLug != null && Lf.sLug !== '' ? +Lf.sLug : smax - 300, sT = Lf.sTail != null && Lf.sTail !== '' ? +Lf.sTail : smin + 200;
    var Wtot = W0 * G * Cd;
    // izado con orejetas (todas en sL) y orejeta de cola en sT, recipiente horizontal: viga apoyada en sL y sT
    var M = 0, Rl = Wtot, Rt = 0, mAt = 0;
    if (Lf.mode === 'tail' || Lf.mode === 'two'){
      var mom = segs.reduce(function(a, s){ return a + s[2] * G * Cd * (s[0] + s[1]) / 2; }, 0) + num(Lf.rig, 0) * G * Cd * sL;
      Rl = (mom - Wtot * sT) / (sL - sT); Rt = Wtot - Rl;
      // momento máximo por muestreo
      for (var k = 0; k <= 200; k++){ var x = smin + (smax - smin) * k / 200, Mx = 0;
        segs.forEach(function(s){ var w = s[2] * G * Cd, a = s[0], b = s[1]; if (x > a){ var frac = Math.min(1, (x - a) / Math.max(b - a, 1e-6)), wl = w * frac, xc = a + (Math.min(x, b) - a) / 2; Mx -= wl * (x - xc); } });
        if (x > sT) Mx += Rt * (x - sT); if (x > sL) Mx += Rl * (x - sL);
        if (Math.abs(Mx) > Math.abs(M)){ M = Mx; mAt = x; } }
      st(r, 'R orejetas', 'reacción en las orejetas principales (s = ' + f1(sL) + ' mm), con Cd = ' + f2(Cd), Rl, 'f', '');
      st(r, 'R cola', 'reacción en la orejeta de cola o segundo punto (s = ' + f1(sT) + ' mm)', Rt, 'f', '');
      st(r, 'M máx', 'momento flector máximo del recipiente en posición horizontal (s = ' + f1(mAt) + ' mm)', Math.abs(M), 'm', '');
      // tensión en la virola más débil
      var worst = null;
      res.comps.forEach(function(rc){ var c = rc.c; if (c.type !== 'shell') return; var Di = (c.basis === 'od' ? c.D - 2 * c.tn : c.D), Do = Di + 2 * c.tn, Z = Math.PI / 32 * (Math.pow(Do, 4) - Math.pow(Di, 4)) / Do, sg = Math.abs(M) / Z, ms = V.mat(c.mat, 40), Syv = ms && ms.ty ? ms.ty[1] : 240; if (!worst || sg / Syv > worst.q) worst = { c: c, sg: sg, Sy: Syv, q: sg / Syv }; });
      if (worst){ st(r, 'σb virola', 'M/Z en ' + worst.c.name, worst.sg, 's', ''); ck(r, 'Flexión global durante el izado: ' + f1(worst.sg) + ' MPa ≤ 0,66·Sy = ' + f1(0.66 * worst.Sy) + ' MPa', worst.sg <= 0.66 * worst.Sy, false, 'AISC 360 / ASME BTH-1 (criterio)'); }
    }
    var Fv = Rl / n, phi = num(Lf.phi, 0) * Math.PI / 180, F = st(r, 'F por orejeta', 'R / n / cos φ,  n = ' + n + ', φ = ' + f1(num(Lf.phi, 0)) + '° respecto a la vertical', Fv / Math.cos(phi), 'f', '');
    var Fh = F * Math.sin(phi), Fa = F * Math.cos(phi);
    var t = +Lf.t, b = +Lf.b, Hh = +Lf.H, Rr = +Lf.R, dh = +Lf.dh, dp = +Lf.dp, w = +Lf.w;
    var s1 = st(r, 'σ tracción', 'F / [(2·R − dh)·t]', F / ((2 * Rr - dh) * t), 's', 'BTH-1 3-3.3'); ck(r, 'Tracción en la sección neta del ojo ' + f1(s1) + ' ≤ 0,45·Sy = ' + f1(0.45 * Sy) + ' MPa', s1 <= 0.45 * Sy, false, 'AISC 360 D5 (ASD)');
    var s2 = st(r, 'τ desgarro', 'F / [2·t·(R − dh/2)]', F / (2 * t * (Rr - dh / 2)), 's', ''); ck(r, 'Desgarro por cortante ' + f1(s2) + ' ≤ 0,40·Sy = ' + f1(0.4 * Sy) + ' MPa', s2 <= 0.4 * Sy, false, 'AISC 360 D5');
    var s3 = st(r, 'σ aplastamiento', 'F / (dp·t)', F / (dp * t), 's', ''); ck(r, 'Aplastamiento del bulón ' + f1(s3) + ' ≤ 0,90·Sy = ' + f1(0.9 * Sy) + ' MPa', s3 <= 0.9 * Sy, false, 'AISC 360 J7');
    ck(r, 'Holgura del bulón: dh − dp = ' + f1(dh - dp) + ' mm (recomendado ≤ 0,1·dh y > 0)', dh > dp && dh - dp <= Math.max(0.1 * dh, 3), true);
    var sb = st(r, 'σ base', 'Fa/(b·t) + 6·Fh·H/(t·b²)', Fa / (b * t) + 6 * Fh * Hh / (t * b * b), 's', ''); ck(r, 'Base de la orejeta (tracción + flexión) ' + f1(sb) + ' ≤ 0,66·Sy = ' + f1(0.66 * Sy) + ' MPa', sb <= 0.66 * Sy, false, 'AISC 360 F11');
    var aw = 0.707 * w, Aw = aw * 2 * (b + t), Sw = aw * (b * b / 3 + b * t), fw = Math.sqrt(Math.pow(Fa / Aw + Fh * Hh / Sw, 2) + Math.pow(Fh / Aw, 2));
    st(r, 'f soldadura', '√[(Fa/Aw + Fh·H/Sw)² + (Fh/Aw)²],  a = 0,707·w, perímetro 2·(b + t)', fw, 's', 'AISC 360 J2.4');
    ck(r, 'Soldadura en ángulo de la orejeta ' + f1(fw) + ' ≤ 0,30·Fexx = ' + f1(0.3 * num(Lf.Fexx, 480)) + ' MPa', fw <= 0.3 * num(Lf.Fexx, 480), false, 'AISC 360 J2.5');
    note(r, 'Tensiones locales en la pared bajo la orejeta: comprobar con WRC 107/537 (introducir los coeficientes en «Cargas locales WRC»)');
    var mlug = (b * (Hh + Rr) * t) * 1e-9 * 7850;
    return { r: r, ok: r.checks.every(function(k){ return k.ok || k.warn || k.info; }), F: F, W: W0, mlug: mlug, sL: sL, sT: sT };
  }

  // ---------------- boca de hombre y pescante ----------------
  function manhole(prj, res){
    var H = prj.mh, r = R(), n = prj.nozzles.filter(function(x){ return x.id === H.noz || x.mark === H.noz; })[0];
    if (!n){ ck(r, 'Elegir la conexión que actúa como boca de hombre', false); return { r: r, ok: false }; }
    ck(r, 'Diámetro interior ' + f1(n.od - 2 * n.tn) + ' mm ≥ 380 mm para acceso de personas (≥ 400 mm recomendado)', n.od - 2 * n.tn >= 380, true, 'UG-46(g)');
    var dims = n.fl && n.fl.type !== 'none' ? V.b165dims(n.fl.cls, n.nps) : null, Dc = H.Dc > 0 ? +H.Dc : (dims ? dims.O : n.od + 150), tc = H.tc > 0 ? +H.tc : (dims ? dims.tf : 40);
    if (!dims && !(H.Dc > 0)) note(r, 'Brida mayor de NPS 24 o sin brida B16.5: introducir el diámetro y espesor de la tapa (las dimensiones de ASME B16.47 no están incluidas)');
    var mc = H.mcover > 0 ? +H.mcover : Math.PI / 4 * Dc * Dc * tc * 7.85e-6;
    st(r, 'Tapa', 'D = ' + f1(Dc) + ' mm, t = ' + f1(tc) + ' mm', mc, 'kg', dims ? 'ASME B16.5 (brida ciega)' : '');
    var W = st(r, 'W', 'm·g·Cd,  Cd = ' + f2(num(H.Cd, 1.5)), mc * G * num(H.Cd, 1.5), 'f', '');
    var m = V.mat(H.mat, 40), Sy = m && m.ty ? m.ty[1] : 240, Lr = num(H.L, 600);
    function pipeZ(od, t){ var di = od - 2 * t; return { Z: Math.PI / 32 * (Math.pow(od, 4) - Math.pow(di, 4)) / od, I: Math.PI / 64 * (Math.pow(od, 4) - Math.pow(di, 4)), A: Math.PI / 4 * (od * od - di * di) }; }
    var arm = pipeZ(+H.armOd, +H.armT), post = pipeZ(+H.pod, +H.pt), Mm = W * Lr;
    st(r, 'M', 'W·L (brazo L = ' + f1(Lr) + ' mm)', Mm, 'm', '');
    var sa = st(r, 'σ brazo', 'M / Z', Mm / arm.Z, 's', ''); ck(r, 'Brazo del pescante ' + f1(sa) + ' ≤ 0,66·Sy = ' + f1(0.66 * Sy) + ' MPa', sa <= 0.66 * Sy, false, 'AISC 360 F8');
    var sp = st(r, 'σ poste', 'M / Z del poste', Mm / post.Z, 's', ''); ck(r, 'Poste del pescante ' + f1(sp) + ' ≤ 0,66·Sy = ' + f1(0.66 * Sy) + ' MPa', sp <= 0.66 * Sy, false, 'AISC 360 F8');
    var Hg = st(r, 'H guías', 'M / s,  s = ' + f1(num(H.s, 300)) + ' mm entre soportes del poste', Mm / num(H.s, 300), 'f', '');
    var Es = 195000, dl = st(r, 'δ', 'W·L³/(3·E·I) del brazo', W * Math.pow(Lr, 3) / (3 * Es * arm.I), 'len', '');
    note(r, 'Las orejetas de los soportes del poste deben resistir H = ' + f1(Hg / 1000) + ' kN; comprobar con WRC 107 si se sueldan a la virola sin refuerzo');
    return { r: r, ok: r.checks.every(function(k){ return k.ok || k.warn || k.info; }), mc: mc, W: W, n: n };
  }

  // ---------------- WRC 107/537: suma de tensiones ----------------
  // coeficientes de las curvas (introducidos por el usuario): nphiP, mphiP, nxP, mxP, nphiMc, mphiMc, nxMc, mxMc, nphiML, mphiML, nxML, mxML
  var WRC_K = [['nphiP', 'Nφ/(P/Rm)', '3C o 4C'], ['mphiP', 'Mφ/P', '2C-1 o 1C'], ['nxP', 'Nx/(P/Rm)', '4C o 3C'], ['mxP', 'Mx/P', '1C-1 o 2C'],
    ['nphiMc', 'Nφ/[Mc/(Rm²·β)]', '3A'], ['mphiMc', 'Mφ/[Mc/(Rm·β)]', '1A'], ['nxMc', 'Nx/[Mc/(Rm²·β)]', '4A'], ['mxMc', 'Mx/[Mc/(Rm·β)]', '2A'],
    ['nphiML', 'Nφ/[ML/(Rm²·β)]', '3B'], ['mphiML', 'Mφ/[ML/(Rm·β)]', '1B o 1B-1'], ['nxML', 'Nx/[ML/(Rm²·β)]', '4B'], ['mxML', 'Mx/[ML/(Rm·β)]', '2B o 2B-1']];
  function newWrc(prj, n){ var o = { noz: n ? n.id : '', link: true, P: 0, Vc: 0, VL: 0, Mc: 0, ML: 0, MT: 0 }; WRC_K.forEach(function(k){ o[k[0]] = 0; }); return o; }
  function wrcOne(prj, res, w, mode){
    var r = R(), n = prj.nozzles.filter(function(x){ return x.id === w.noz; })[0], d = prj.design;
    if (!n){ ck(r, 'Conexión no encontrada', false); return { r: r, ok: false }; }
    var host = compById(prj, n.host), rc = res.byId[n.host];
    if (!host || host.type !== 'shell'){ ck(r, 'WRC 107/537 implementado para conexiones en virolas cilíndricas', false); return { r: r, ok: false, n: n }; }
    var cc = rc.cc, T = host.tn - cc, Di = (host.basis === 'od' ? host.D - 2 * host.tn : host.D) + 2 * cc, Rm = st(r, 'Rm', 'radio medio corroído', Di / 2 + T / 2, 'len', 'WRC 107');
    var ro = n.od / 2 + (n.pad && n.Dp > n.od ? (n.Dp - n.od) / 2 : 0), Te = T + (n.pad && n.Dp > n.od ? (+n.te || 0) : 0);
    if (n.pad && n.Dp > n.od) note(r, 'Con refuerzo: se evalúa en el borde del refuerzo (ro = Dp/2, T = t + te es el espesor en el cuello); comprobar ambos puntos con sus coeficientes');
    var gam = st(r, 'γ', 'Rm / T', Rm / T, '', 'WRC 107'), beta = st(r, 'β', '0,875·ro / Rm,  ro = ' + f1(ro) + ' mm', 0.875 * ro / Rm, '', 'WRC 107');
    var P, Mc, ML, Vc, VL, MT;
    if (w.link !== false){ var nl = VMODEL.nozLoads(n); P = nl.F; Mc = nl.MC; ML = nl.ML; Vc = nl.VC; VL = nl.VL; MT = nl.Mt; note(r, 'Cargas tomadas de la tubuladura ' + n.mark + ': FR ' + f1(P / 1000) + ' kN, VC ' + f1(Vc / 1000) + ', VL ' + f1(VL / 1000) + ' kN, MC ' + f1(Mc / 1e6) + ', ML ' + f1(ML / 1e6) + ', MT ' + f1(MT / 1e6) + ' kN·m'); }
    else { P = num(w.P, 0); Mc = num(w.Mc, 0); ML = num(w.ML, 0); Vc = num(w.Vc, 0); VL = num(w.VL, 0); MT = num(w.MT, 0); }
    var kS = VMODEL.nozLoads(n).kS;
    function K(k){ return num(w[k], 0); }
    // tensiones (MPa) por componente: membrana y flexión, direcciones φ (circ.) y x (long.)
    var mP = { phi: K('nphiP') * P / (Rm * T), x: K('nxP') * P / (Rm * T) }, bP = { phi: 6 * K('mphiP') * P / (T * T), x: 6 * K('mxP') * P / (T * T) };
    var mC = { phi: K('nphiMc') * Mc / (Rm * Rm * beta * T), x: K('nxMc') * Mc / (Rm * Rm * beta * T) }, bC = { phi: 6 * K('mphiMc') * Mc / (Rm * beta * T * T), x: 6 * K('mxMc') * Mc / (Rm * beta * T * T) };
    var mL = { phi: K('nphiML') * ML / (Rm * Rm * beta * T), x: K('nxML') * ML / (Rm * Rm * beta * T) }, bL = { phi: 6 * K('mphiML') * ML / (Rm * beta * T * T), x: 6 * K('mxML') * ML / (Rm * beta * T * T) };
    var Pi = rc.P, sPh = Pi * Rm / T, sPx = Pi * Rm / (2 * T);
    var tauT = MT / (2 * Math.PI * ro * ro * T), tauC = Vc / (Math.PI * ro * T), tauL = VL / (Math.PI * ro * T);
    // signos: P (+) tracción/salida; ML (+) tracciona A; Mc (+) tracciona C. Cara u = exterior, l = interior.
    var pts = [['Au', 'L', 1, 1], ['Al', 'L', 1, -1], ['Bu', 'L', -1, 1], ['Bl', 'L', -1, -1], ['Cu', 'C', 1, 1], ['Cl', 'C', 1, -1], ['Du', 'C', -1, 1], ['Dl', 'C', -1, -1]];
    var abs = mode === 'abs', rows = [], Smax = 0, Smm = 0;
    pts.forEach(function(q){
      var mm = q[1] === 'L' ? [mL, bL] : [mC, bC], sgn = q[2], face = q[3];
      function comb(dir){
        var memb = abs ? Math.abs(mP[dir]) + Math.abs(mm[0][dir]) : mP[dir] + sgn * mm[0][dir];
        var bend = abs ? Math.abs(bP[dir]) + Math.abs(mm[1][dir]) : face * (bP[dir] + sgn * mm[1][dir]);
        var pr = dir === 'phi' ? sPh : sPx;
        return { m: memb + pr, t: abs ? memb + Math.abs(bend) + pr : memb + bend + pr };
      }
      var sph = comb('phi'), sx = comb('x'), tau = Math.abs(tauT) + (q[1] === 'L' ? Math.abs(tauC) : Math.abs(tauL));
      function SI(a, b){ var c = (a + b) / 2, rad = Math.sqrt((a - b) * (a - b) / 4 + tau * tau), s1 = c + rad, s2 = c - rad; return Math.max(Math.abs(s1 - s2), Math.abs(s1), Math.abs(s2)); }
      var Sm = SI(sph.m, sx.m), St = SI(sph.t, sx.t); Smax = Math.max(Smax, St); Smm = Math.max(Smm, Sm);
      rows.push({ p: q[0], phiM: sph.m, xM: sx.m, phiT: sph.t, xT: sx.t, tau: tau, Sm: Sm, St: St });
    });
    var S = rc.mat ? rc.mat.S : 138;
    ck(r, 'Intensidad de tensión de membrana (Pm + PL) ' + f1(Smm) + ' MPa ≤ 1,5·S = ' + f1(1.5 * S * kS) + ' MPa', Smm <= 1.5 * S * kS + 1e-9, false, 'VIII-2 5.2.2 / WRC 107');
    ck(r, 'Intensidad total (PL + Pb + Q) ' + f1(Smax) + ' MPa ≤ 3·S = ' + f1(3 * S * kS) + ' MPa', Smax <= 3 * S * kS + 1e-9, false, 'VIII-2 5.5.6 / WRC 107');
    var zero = WRC_K.every(function(k){ return !K(k[0]); });
    if (zero) ck(r, 'Introducir los coeficientes leídos en las curvas de WRC 537/107 para γ = ' + f1(gam) + ' y β = ' + f3(beta), false, true);
    note(r, mode === 'abs' ? 'Combinación conservadora: se suman los valores absolutos de cada contribución' : 'Combinación con signos (P + saliente; ML + tracciona A; Mc + tracciona C)');
    return { r: r, ok: r.checks.every(function(k){ return k.ok || k.warn || k.info; }), rows: rows, n: n, gam: gam, beta: beta, Smax: Smax, Smm: Smm };
  }

  function run(prj, res){
    var out = {};
    function safe(k, fn){ try { out[k] = fn(); } catch (e){ out[k] = { err: e.message, ok: false, r: { steps: [], checks: [{ t: 'Error: ' + e.message, ok: false }] } }; if (typeof console !== 'undefined') console.error(e); } }
    if (!prj.ped) return out;
    if (prj.ped.on) safe('ped', function(){ return ped(prj, res); });
    res.peds = out.ped;
    if (prj.en && prj.en.on) safe('en', function(){ return en13445(prj, res); });
    if (prj.jacket && prj.jacket.on) safe('jacket', function(){ return jacket(prj, res); });
    if (prj.hp && prj.hp.on) safe('hp', function(){ return halfpipe(prj, res); });
    if (prj.uhx && prj.uhx.on) safe('uhx', function(){ return uhx(prj); });
    if (prj.fat && prj.fat.on) safe('fat', function(){ return fatigue(prj, res); });
    res.fab = out;
    if (prj.lift && prj.lift.on) safe('lift', function(){ return lift(prj, res); });
    if (prj.mh && prj.mh.on) safe('mh', function(){ return manhole(prj, res); });
    if (prj.wrc && prj.wrc.on) out.wrc = (prj.wrc.list || []).map(function(w){ try { return wrcOne(prj, res, w, prj.wrc.mode); } catch (e){ return { err: e.message, ok: false, r: { steps: [], checks: [{ t: e.message, ok: false }] } }; } });
    out.ok = ['jacket', 'hp', 'uhx', 'lift', 'mh'].every(function(k){ return !out[k] || out[k].ok !== false; }) && (!out.wrc || out.wrc.every(function(w){ return w.ok !== false; }));
    return out;
  }

  return { defaults: defaults, run: run, ped: ped, pedCat: pedCat, en13445: en13445, betaTori: betaTori, jacket: jacket, halfpipe: halfpipe, uhx: uhx, uhx12core: uhx12core,
    fatigue: fatigue, lift: lift, manhole: manhole, wrcOne: wrcOne, WRC_K: WRC_K, newWrc: newWrc, props: props, fEN: fEN, massLine: massLine, MODS: MODS, HP_OD: HP_OD };
})();

/* ===================================================================
   Fabricación y dossier:
   - Lista de materiales (BOM) con masas y tipo de certificado EN 10204
   - Mapa de soldaduras (categorías UW-3, END por UW-11) y asignación de WPS/PQR (ASME IX QW-451)
   - Plan de puntos de inspección (PPI / ITP) y placa de características (UG-116 + PED)
   - Desarrollo de chapas y aprovechamiento en formatos comerciales (MaxRects)
   - Presupuesto estimado y optimizador de espesores comerciales
   =================================================================== */
var FABDOC = (function(){
  'use strict';
  var V = VESSEL;
  function M(){ return VMODEL; }
  function num(x, d){ return (x === null || x === undefined || x === '' || isNaN(+x)) ? d : +x; }
  function f0(x){ return String(Math.round(x)); }
  function f1(x){ return (Math.round(x * 10) / 10).toString().replace('.', ','); }
  function compById(prj, id){ return prj.comps.filter(function(c){ return c.id === id; })[0]; }
  function matT(ref){ if (ref && /^EN:/.test(ref.id)) return 'EN 10025-2 ' + ref.id.slice(3); var m = ref && V.BYID[ref.id]; return m ? m.t : '—'; }
  function pno(ref){ if (ref && /^EN:/.test(ref.id)) return 'EN'; var m = ref && V.BYID[ref.id]; return m ? String(m.pno || '').split(' ')[0] || '?' : '?'; }
  function rhoOf(ref){ var m = V.mat(ref, 20); return m ? m.rho : 7850; }
  function famOf(ref){ var m = ref && V.BYID[ref.id]; if (!m) return 'CS'; var p = String(m.pno || '').split(' ')[0];
    if (p === '1') return 'CS'; if (/^(3|4|5A|5B|5C|15E)$/.test(p)) return 'LA'; if (/^(8|10H|10I|10J|10K)$/.test(p)) return 'SS'; if (/^2\d$/.test(p)) return 'AL'; if (/^3\d$/.test(p)) return 'CU'; if (/^4\d$/.test(p)) return 'NI'; if (/^5\d$/.test(p)) return 'TI'; return 'CS'; }

  var COMMERCIAL_T = [3, 4, 5, 6, 8, 10, 12, 14, 15, 16, 18, 20, 22, 25, 28, 30, 32, 35, 38, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 100, 110, 120, 130, 140, 150];
  function defaults(prj){
    var fam = (prj && prj.design && prj.design.mfam) || 'CS', P = fam === 'SS' ? '8' : fam === 'LA' ? '4' : fam === 'AL' ? '25' : fam === 'NI' ? '43' : fam === 'TI' ? '51' : fam === 'CU' ? '34' : '1';
    var proc = fam === 'SS' ? 'GTAW+SMAW' : 'SMAW';
    return {
      plates: '2000x6000; 2500x6000; 2500x8000; 3000x10000', kerf: 5, edge: 10, rot: true, nestHeads: false, thin: 10, tlist: COMMERCIAL_T.join('; '),
      wps: ['WPS-01 ; SAW ; butt ; ' + P + ' ; ' + P + ' ; 25 ; PQR-01', 'WPS-02 ; ' + proc + ' ; butt ; ' + P + ' ; ' + P + ' ; 12 ; PQR-02', 'WPS-03 ; GTAW ; butt ; ' + P + ' ; ' + P + ' ; 5 ; PQR-03',
        'WPS-04 ; ' + proc + ' ; fillet ; ' + P + ' ; ' + P + ' ; 12 ; PQR-02', 'WPS-05 ; SMAW ; fillet ; 1 ; ' + P + ' ; 12 ; PQR-04', 'WPS-06 ; SMAW ; fillet ; EN ; ' + P + ' ; 12 ; PQR-06 (acero EN 10025 a chapa ASME; metal sin P-No, QW-420)', 'WPS-07 ; GMAW ; fillet ; EN ; EN ; 12 ; WPQR-07 (estructura EN 10025, EN ISO 15614-1)'].join('\n'),
      wmap: {}, dossier: { doc: '', insp: 'AI', client: '', ndtCo: '' },
      plate: { mfr: '', serial: '', year: String(new Date().getFullYear()), nb: '' },
      price: { CS: 1.4, LA: 3.5, SS: 5.5, AL: 7, CU: 12, NI: 30, TI: 40, pipeF: 1.3, forge: 1.6, head: 1.35, bolt: 6, gasket: 45, labour: 42, fitup: 0.6, dep: { SAW: 4.0, SMAW: 1.2, GTAW: 0.4, 'GTAW+SMAW': 0.9, FCAW: 2.5, GMAW: 2.5 },
        RT: 35, UT: 25, PT: 8, MT: 8, VT: 2, hydro: 600, pwht: 0.9, paint: 22, eng: 40, engh: 24, ovh: 15, margin: 10 },
      revs: [{ rev: '0', date: new Date().toISOString().slice(0, 10), desc: 'Emisión inicial', by: '', chk: '', app: '' }]
    };
  }

  // ---------------- B16.5 pernos (clases 150, 300 y 600) ----------------
  var B165B = {
    150: { '1/2': [4, '1/2'], '3/4': [4, '1/2'], '1': [4, '1/2'], '1 1/4': [4, '1/2'], '1 1/2': [4, '1/2'], '2': [4, '5/8'], '2 1/2': [4, '5/8'], '3': [4, '5/8'], '3 1/2': [8, '5/8'], '4': [8, '5/8'], '5': [8, '3/4'], '6': [8, '3/4'], '8': [8, '3/4'], '10': [12, '7/8'], '12': [12, '7/8'], '14': [12, '1'], '16': [16, '1'], '18': [16, '1 1/8'], '20': [20, '1 1/8'], '24': [20, '1 1/4'] },
    300: { '1/2': [4, '1/2'], '3/4': [4, '5/8'], '1': [4, '5/8'], '1 1/4': [4, '5/8'], '1 1/2': [4, '3/4'], '2': [8, '5/8'], '2 1/2': [8, '3/4'], '3': [8, '3/4'], '3 1/2': [8, '3/4'], '4': [8, '3/4'], '5': [8, '3/4'], '6': [12, '3/4'], '8': [12, '7/8'], '10': [16, '1'], '12': [16, '1 1/8'], '14': [20, '1 1/8'], '16': [20, '1 1/4'], '18': [24, '1 1/4'], '20': [24, '1 1/4'], '24': [24, '1 1/2'] },
    600: { '1/2': [4, '1/2'], '3/4': [4, '5/8'], '1': [4, '5/8'], '1 1/4': [4, '5/8'], '1 1/2': [4, '3/4'], '2': [8, '5/8'], '2 1/2': [8, '3/4'], '3': [8, '3/4'], '3 1/2': [8, '7/8'], '4': [8, '7/8'], '5': [8, '1'], '6': [12, '1'], '8': [12, '1 1/8'], '10': [16, '1 1/4'], '12': [20, '1 1/4'], '14': [20, '1 3/8'], '16': [20, '1 1/2'], '18': [20, '1 5/8'], '20': [24, '1 5/8'], '24': [24, '1 7/8'] } };
  function legW(sp, L){ return L && L.legs && L.legs.LG ? L.legs.LG.b : (sp.lsec === 'user' ? (+sp.lb || 100) : (+sp.lod || 168)); }
  function legPlate(sp, L){ return legW(sp, L) + 120; }
  function supSteel(sp, pre, t){ return VLOADS.steelOf(sp, pre, t); }
  function saddleDims(prj, L, sp){ var sh = prj.comps.filter(function(c){ return c.type === 'shell'; })[0] || { D: 1000, tn: 10 }, Rr = sh.D / 2 + sh.tn, th = (+sp.theta || 120) * Math.PI / 180, Lb = sp.Lbp > 0 ? +sp.Lbp : 2 * Rr * Math.sin(th / 2) + 100, hw = Math.max(50, L.saddle.hAx - Rr * Math.cos(th / 2));
    var web = Lb * hw * (+sp.tw || 12), base = Lb * (+sp.Bb || 250) * (+sp.tbp || 20), top = (Rr * th + 50) * (+sp.b || 200) * (+sp.tf || 12), wL = Rr * ((+sp.thwp > 0 ? +sp.thwp : (+sp.theta || 120) + 12) * Math.PI / 180), wB = sp.bwp > 0 ? +sp.bwp : (+sp.b || 200) + 1.56 * Math.sqrt(Rr * sh.tn);
    return { Lb: Lb, hw: hw, Rr: Rr, th: th, mass: (web + base + top) * 7.85e-6 * 1.08, wL: wL, wB: wB, wmass: wL * wB * (+sp.twp || 10) * 7.85e-6 }; }
  function flangeMass(n, dm){ if (!dm) return 0; var id = n.od - 2 * n.tn, m = Math.PI / 4 * (dm.O * dm.O - id * id) * dm.tf;
    if (n.fl.type === 'WN' || n.fl.type === 'LWN') m += Math.PI / 4 * (((dm.X + dm.Ah) / 2) * ((dm.X + dm.Ah) / 2) - id * id) * Math.max(0, dm.Ywn - dm.tf); else m += Math.PI / 4 * (dm.X * dm.X - n.od * n.od) * Math.max(0, dm.Ythr - dm.tf);
    return m * 7.85e-6; }
  function nozNeckLen(prj, n){ var host = compById(prj, n.host); return (n.proj || 0) + (host ? host.tn : 10) + (n.hin || 0) + (n.elb || []).reduce(function(a, e){ return a + (+e.ang > 0 ? (+e.L || 0) : 0); }, 0); }

  // ---------------- BOM ----------------
  function bom(prj, res){
    var items = [], k = 0, ped = res.fab && res.fab.ped, cat = ped ? ped.cat : null, ncat = { SEP: 0, I: 1, II: 2, III: 3, IV: 4 }[cat] || 0;
    var certP = ncat >= 2 || !ped ? '3.1' : '3.1', certNP = '2.2';
    function add(o){ o.pos = ++k; o.qty = o.qty || 1; o.unit = o.unit || 'ud'; items.push(o); return o; }
    var d = prj.design;
    prj.comps.forEach(function(c){
      var rc = res.byId[c.id], m = rc && rc.mass || 0, desc;
      if (c.type === 'shell') desc = 'Virola D' + (c.basis === 'od' ? 'E ' : 'I ') + f0(c.D) + ' × ' + f1(c.tn) + ' × L ' + f0(c.L) + ' (chapa curvada)';
      else if (c.type === 'cone') desc = 'Cono D ' + f0(c.D) + ' / ' + f0(c.Ds) + ' × ' + f1(c.tn) + ', α = ' + f1(c.alpha) + '°';
      else if (c.type === 'ellip') desc = 'Fondo elíptico ' + f1(c.ratio || 2) + ':1 DI ' + f0(c.D) + ' × ' + f1(c.tn) + ' (mín. tras conformado), falda ' + f0(c.sf || 0);
      else if (c.type === 'tori') desc = 'Fondo torisférico DI ' + f0(c.D) + ' × ' + f1(c.tn) + ', L = ' + f0(M().toriL(c)) + ', r = ' + f0(M().toriR(c)) + ', falda ' + f0(c.sf || 0);
      else if (c.type === 'hemi') desc = 'Fondo hemisférico DI ' + f0(c.D) + ' × ' + f1(c.tn);
      else if (c.type === 'flat') desc = 'Tapa plana Ø ' + f0(c.d) + ' × ' + f1(c.tn);
      else desc = 'Brida de cuerpo A ' + f0(c.A) + ' / B ' + f0(c.B) + ' × ' + f1(c.t);
      add({ grp: 'Envolvente', ref: c.name, desc: desc, mat: matT(c.mat), form: c.type === 'bflange' ? 'Forja' : /ellip|tori|hemi/.test(c.type) ? 'Fondo conformado' : 'Chapa', t: c.type === 'bflange' ? c.t : c.tn, mass: m, cert: certP, press: true });
      if (c.type === 'shell' && +c.rn > 0){ var ri = (c.basis === 'od' ? c.D - 2 * c.tn : c.D) / 2, Dr = c.rside === 'int' ? 2 * ri - (+c.rh || 0) : 2 * (ri + c.tn) + (+c.rh || 0);
        add({ grp: 'Envolvente', ref: c.name, desc: 'Anillo rigidizador pletina ' + f0(+c.rh || 0) + ' × ' + f0(+c.rb || 0) + ', Ø medio ' + f0(Dr), qty: +c.rn, mat: matT(c.rmat), form: 'Pletina', t: +c.rb || 0, mass: Math.PI * Dr * (+c.rh || 0) * (+c.rb || 0) * 7.85e-6, cert: certP, press: false }); }
      if (c.type === 'bflange'){ add({ grp: 'Tornillería y juntas', ref: c.name, desc: 'Espárrago ' + (c.bsize || '') + ' (a = ' + f1(c.a) + ' mm) con 2 tuercas', qty: c.n, mat: matT(c.bmat), form: 'Perno', t: 0, mass: 0, cert: '3.1', press: true, unit: 'ud' });
        add({ grp: 'Tornillería y juntas', ref: c.name, desc: 'Junta ' + (c.gk || '') + ' Ø ' + f0(c.Gi || 0) + ' / ' + f0(c.Go || 0), qty: 1, mat: '—', form: 'Junta', t: 0, mass: 0, cert: '2.2', press: true }); }
    });
    prj.nozzles.forEach(function(n){
      var rn = res.nozzles.filter(function(x){ return x.n.id === n.id; })[0], mk = n.mark;
      if (n.kind === 'cpl'){ add({ grp: 'Conexiones', ref: mk, desc: (n.ctype === 'half' ? 'Medio manguito' : 'Manguito') + ' ASME B16.11 NPS ' + n.cnps + ' clase ' + n.ccls + ' ' + n.cend, mat: matT(n.mat), form: 'Forja', t: n.tn, mass: rn && rn.mass || 0.5, cert: certP, press: true }); return; }
      var Ln = nozNeckLen(prj, n), mkg = Math.PI / 4 * (n.od * n.od - Math.pow(n.od - 2 * n.tn, 2)) * Ln * 7.85e-6;
      add({ grp: 'Conexiones', ref: mk, desc: (n.fl && n.fl.type === 'LWN' ? 'Cuello LWN' : 'Tubo') + ' NPS ' + (n.nps || '—') + ' D.E. ' + f1(n.od) + ' × ' + f1(n.tn) + ' · L ' + f0(Ln), mat: matT(n.mat), form: n.fl && n.fl.type === 'LWN' ? 'Forja' : 'Tubo', t: n.tn, mass: mkg, cert: certP, press: true });
      (n.elb || []).forEach(function(e){ if (+e.ang > 0) add({ grp: 'Conexiones', ref: mk, desc: 'Codo ' + e.ang + '° ' + (e.rt === 'SR' ? 'radio corto' : 'radio largo') + ' ASME B16.9 NPS ' + (n.nps || '') + ' × ' + f1(n.tn), mat: matT(n.mat).replace(/SA-106/, 'SA-234 WPB (codo para SA-106)'), form: 'Accesorio', t: n.tn, mass: 0, cert: certP, press: true }); });
      if (n.pad && n.Dp > n.od) add({ grp: 'Conexiones', ref: mk, desc: 'Chapa de refuerzo Ø ' + f0(n.Dp) + ' × ' + f1(n.te) + ' con taladro testigo', mat: matT(n.pmat), form: 'Chapa', t: n.te, mass: Math.PI / 4 * (n.Dp * n.Dp - n.od * n.od) * n.te * 7.85e-6, cert: certP, press: true });
      if (n.fl && n.fl.type !== 'none'){
        var dm = V.b165dims(n.fl.cls, n.nps), bl = (B165B[n.fl.cls] || {})[n.nps];
        add({ grp: 'Conexiones', ref: mk, desc: 'Brida ' + n.fl.type + ' NPS ' + n.nps + ' clase ' + n.fl.cls + ' RF ASME B16.5', mat: matT(n.fl.mat), form: 'Forja', t: dm ? dm.tf : 0, mass: flangeMass(n, dm), cert: certP, press: true });
        add({ grp: 'Tornillería y juntas', ref: mk, desc: 'Junta espirometálica ASME B16.20 NPS ' + n.nps + ' clase ' + n.fl.cls, mat: '—', form: 'Junta', t: 0, mass: 0, cert: '2.2', press: true });
        if (bl) add({ grp: 'Tornillería y juntas', ref: mk, desc: 'Espárrago ' + bl[1] + '" con 2 tuercas (B16.5) — brida de contracara', qty: bl[0], mat: 'SA-193 B7 / SA-194 2H', form: 'Perno', t: 0, mass: 0, cert: '3.1', press: true });
      }
    });
    // soportes
    var L = res.loads, sp = prj.support || {};
    if (L && !L.err){
      if (L.skirt) { add({ grp: 'Soportes', ref: 'Faldón', desc: 'Faldón D.E. ' + f0(L.skirt.Ds) + ' × ' + f1(+sp.t || 0) + ' × H ' + f0(L.sAtt - L.zg), mat: matT(sp.mat), form: 'Chapa', t: +sp.t || 0, mass: Math.PI * (L.skirt.Ds - (+sp.t || 0)) * (+sp.t || 0) * (L.sAtt - L.zg) * 7.85e-6, cert: '3.1', press: false });
        add({ grp: 'Soportes', ref: 'Anillo base', desc: 'Anillo base Ø ' + f0(L.skirt.Dbo) + ' / ' + f0(L.skirt.Dbi) + ' × ' + f1(+sp.tb || 0), mat: matT(sp.bmat), form: 'Chapa', t: +sp.tb || 0, mass: Math.PI / 4 * (L.skirt.Dbo * L.skirt.Dbo - L.skirt.Dbi * L.skirt.Dbi) * (+sp.tb || 0) * 7.85e-6, cert: certNP, press: false });
        add({ grp: 'Soportes', ref: 'Anclajes', desc: 'Perno de anclaje ' + (sp.bsize || '') + ' con tuercas y arandelas', qty: +sp.nb || 0, mat: matT(sp.amat), form: 'Perno', t: 0, mass: 0, cert: certNP, press: false }); }
      if (L.legs){ var LG = L.legs.LG || {}, stl = supSteel(sp, 'l', LG.t || +sp.lt), Ll = L.legs.top ? L.legs.top - L.zg : (+sp.Hl || 0) + 300, pd = L.legs.pad;
        add({ grp: 'Soportes', ref: 'Patas', desc: 'Pata ' + (LG.name ? LG.name : sp.lsec === 'user' ? 'perfil definido por el usuario' : 'tubo Ø ' + f1(+sp.lod) + ' × ' + f1(+sp.lt)) + ' × L ' + f0(Ll), qty: L.legs.n, mat: stl.name, form: LG.name ? 'Perfil' : 'Tubo', t: LG.t || +sp.lt || 0, mass: (LG.A || 0) * Ll * 7.85e-6, cert: certNP, press: false });
        if (pd) add({ grp: 'Soportes', ref: 'Chapas intermedias', desc: 'Chapa intermedia pata-virola ' + f0(pd.L) + ' × ' + f0(pd.w) + ' × ' + f1(pd.t) + ' curvada al radio de la virola, con taladro de venteo', qty: L.legs.n, mat: matT(pd.mat), form: 'Chapa', t: pd.t, mass: pd.L * pd.w * pd.t * 7.85e-6, cert: '3.1', press: false });
        var bp = legPlate(sp, L); add({ grp: 'Soportes', ref: 'Placas base', desc: 'Placa base de pata ' + f0(bp) + ' × ' + f0(bp) + ' × 20 con ' + (+sp.nbl || 1) + ' taladros', qty: L.legs.n, mat: stl.name, form: 'Chapa', t: 20, mass: bp * bp * 20 * 7.85e-6, cert: certNP, press: false });
        add({ grp: 'Soportes', ref: 'Anclajes', desc: 'Perno de anclaje ' + (sp.lbsize || '') + ' con tuercas y arandelas', qty: L.legs.n * (+sp.nbl || 1), mat: matT(sp.amat), form: 'Perno', t: 0, mass: 0, cert: certNP, press: false }); }
      if (L.lugs && L.lugs.geo){ var Gm = L.lugs.geo;
        add({ grp: 'Soportes', ref: 'Ménsulas', desc: 'Cartela de ménsula ' + f0(Gm.H) + ' × ' + f0(Gm.L) + ' × ' + f1(Gm.t), qty: 2 * Gm.n, mat: Gm.st.name, form: 'Chapa', t: Gm.t, mass: Gm.H * Gm.L * Gm.t * 7.85e-6, cert: certNP, press: false });
        add({ grp: 'Soportes', ref: 'Ménsulas', desc: 'Placa de apoyo y placa superior de ménsula ' + f0(Gm.S + 2 * Gm.t + 50) + ' × ' + f0(Gm.L) + ' × ' + f1(Gm.tb) + ' (apoyo con ' + (+sp.nbg || 2) + ' taladros)', qty: 2 * Gm.n, mat: Gm.st.name, form: 'Chapa', t: Gm.tb, mass: (Gm.S + 2 * Gm.t + 50) * Gm.L * Gm.tb * 7.85e-6, cert: certNP, press: false });
        add({ grp: 'Soportes', ref: 'Ménsulas', desc: 'Chapa intermedia ménsula-virola ' + f0(Gm.ph) + ' × ' + f0(Gm.pw) + ' × ' + f1(Gm.pt) + ' curvada, con taladro de venteo', qty: Gm.n, mat: matT(Gm.padMat), form: 'Chapa', t: Gm.pt, mass: Gm.ph * Gm.pw * Gm.pt * 7.85e-6, cert: '3.1', press: false });
        add({ grp: 'Soportes', ref: 'Anclajes', desc: 'Perno de fijación ' + (sp.gbsize || '') + ' con tuercas y arandelas', qty: Gm.n * (+sp.nbg || 2), mat: matT(sp.amat), form: 'Perno', t: 0, mass: 0, cert: certNP, press: false }); }
      if (sp.type === 'saddle' && L.saddle){ var sd = saddleDims(prj, L, sp);
        add({ grp: 'Soportes', ref: 'Cunas', desc: 'Cuna θ = ' + f0(+sp.theta || 120) + '°, ancho ' + f0(+sp.b || 0) + ', alma ' + f1(+sp.tw || 0) + ', placa base ' + f0(sd.Lb) + ' × ' + f0(+sp.Bb || 250) + ' × ' + f1(+sp.tbp || 0), qty: 2, mat: supSteel(sp, 's', +sp.tw).name, form: 'Chapa', t: +sp.tw || 0, mass: sd.mass, cert: certNP, press: false });
        add({ grp: 'Soportes', ref: 'Anclajes', desc: 'Perno de anclaje ' + (sp.bsize || '') + ' con tuercas y arandelas', qty: 2 * (+sp.nbs || 2), mat: matT(sp.amat), form: 'Perno', t: 0, mass: 0, cert: certNP, press: false });
        add({ grp: 'Soportes', ref: 'Chapas de desgaste', desc: 'Chapa de desgaste (pad intermedio) ' + f0(sd.wL) + ' × ' + f0(sd.wB) + ' × ' + f1(+sp.twp || 0) + ', mismo material que la virola', qty: 2, mat: matT(sp.wmat), form: 'Chapa', t: +sp.twp || 0, mass: sd.wmass, cert: '3.1', press: false }); }
    }
    var F = res.fab || {};
    if (F.jacket && prj.jacket.on) add({ grp: 'Camisa', ref: 'Camisa', desc: 'Camisa DI ' + f0(prj.jacket.Dj) + ' × ' + f1(prj.jacket.tj) + ' con cierres e = ' + f1(prj.jacket.tc), mat: matT(prj.jacket.mat), form: 'Chapa', t: prj.jacket.tj, mass: F.jacket.mass || 0, cert: certP, press: true });
    if (F.hp && prj.hp.on) add({ grp: 'Camisa', ref: 'Media caña', desc: 'Media caña NPS ' + prj.hp.nps + ' × ' + f1(prj.hp.tj) + ' · ' + (F.hp.turns || 0) + ' vueltas, ' + f1((F.hp.Lhp || 0) / 1000) + ' m', mat: matT(prj.hp.mat), form: 'Tubo', t: prj.hp.tj, mass: F.hp.mass || 0, cert: certP, press: true });
    if (F.lift && prj.lift.on) add({ grp: 'Accesorios', ref: 'Orejetas de izado', desc: 'Orejeta de izado ' + f0(prj.lift.b) + ' × ' + f0(prj.lift.H + prj.lift.R) + ' × ' + f1(prj.lift.t) + ', taladro Ø ' + f0(prj.lift.dh), qty: +prj.lift.n || 2, mat: matT(prj.lift.mat), form: 'Chapa', t: prj.lift.t, mass: F.lift.mlug || 0, cert: '3.1', press: false });
    if (F.mh && prj.mh.on) add({ grp: 'Accesorios', ref: 'Pescante', desc: 'Pescante de boca de hombre: poste Ø ' + f1(prj.mh.pod) + ' × ' + f1(prj.mh.pt) + ', brazo ' + f0(prj.mh.L), mat: matT(prj.mh.mat), form: 'Tubo', t: prj.mh.pt, mass: (Math.PI * (prj.mh.pod - prj.mh.pt) * prj.mh.pt * (2 * (+prj.mh.s || 300) + 300) + Math.PI * (prj.mh.armOd - prj.mh.armT) * prj.mh.armT * (+prj.mh.L || 600) * 1.3) * 7.85e-6, cert: certNP, press: false });
    add({ grp: 'Accesorios', ref: 'Placa', desc: 'Placa de características inoxidable con soporte', mat: 'AISI 304', form: 'Chapa', t: 1.5, mass: 0.5, cert: '2.2', press: false });
    var tot = items.reduce(function(a, x){ return a + (x.mass || 0) * (x.unit === 'ud' && x.form !== 'Perno' && x.qty > 1 ? x.qty : 1); }, 0);
    return { items: items, total: tot, cert: certP };
  }

  // ---------------- WPS / PQR ----------------
  function parseWps(txt){ return String(txt || '').split(/\n/).map(function(l){ return l.trim(); }).filter(Boolean).map(function(l){ var q = l.split(/[;\t]/).map(function(s){ return s.trim(); });
    return { id: q[0], proc: q[1] || '', joint: /fil|áng|ang/i.test(q[2] || '') ? 'fillet' : 'butt', p1: q[3] || '1', p2: q[4] || q[3] || '1', T: +String(q[5] || '0').replace(',', '.') || 0, pqr: q[6] || '', pwht: /pwht|ttps|tt/i.test(q[7] || '') }; }); }
  function qw451(T){ // espesor de metal base cualificado [mín, máx] (QW-451.1)
    if (T < 1.5) return [T, 2 * T]; if (T <= 10) return [1.5, 2 * T]; if (T < 19) return [5, 2 * T]; if (T < 38) return [5, 2 * T]; if (T <= 150) return [5, 200]; return [5, 1.33 * T]; }
  function wpsFor(w, list, pwht, forced){
    var small = w.L < 1500 || w.cat === 'D' || w.cat === '—';
    var cand = forced ? list.filter(function(x){ return x.id === forced; }) : list.slice().sort(function(a, b){ function sc(x){ return (x.joint === w.joint ? 0 : 10) + (small && /SAW/i.test(x.proc) ? 5 : 0); } return sc(a) - sc(b); });
    var pp = [w.p1, w.p2].sort().join('-');
    for (var k = 0; k < cand.length; k++){ var x = cand[k], rng = qw451(x.T), pq = [x.p1, x.p2].sort().join('-');
      var okJ = x.joint === w.joint || (x.joint === 'butt' && w.joint === 'fillet'), okP = pq === pp, okT = w.joint === 'fillet' || (w.t1 >= rng[0] - 1e-9 && w.t1 <= rng[1] + 1e-9 && w.t2 >= rng[0] - 1e-9 && w.t2 <= rng[1] + 1e-9), okH = !pwht || x.pwht || true;
      if (okJ && okP && okT) return { w: x, rng: rng, ok: true };
      if (forced) return { w: x, rng: rng, ok: false, why: !okJ ? 'tipo de unión' : !okP ? 'P-No' : 'espesor fuera de ' + f1(rng[0]) + '–' + f1(rng[1]) + ' mm (QW-451.1)' };
    }
    return { w: null, ok: false, why: 'ninguna WPS cubre P-No ' + pp + (w.joint === 'butt' ? ' y espesores ' + f1(w.t1) + '/' + f1(w.t2) + ' mm' : '') };
  }
  // área de metal depositado (mm²)
  function depArea(w){ var t = Math.max(w.t1, w.t2);
    if (w.joint === 'fillet'){ var z = w.leg || 6; return 1.1 * z * z / 2; }
    if (w.prep === 'X') return 1.1 * (0.2887 * t * t + 2 * t); return 1.1 * (0.5774 * t * t + 2 * t); }

  // ---------------- mapa de soldaduras ----------------
  function weldMap(prj, res){
    var d = prj.design, list = [], cntL = 0, cntC = 0, wl = parseWps(prj.fab && prj.fab.wps), Lr = res.L, PC = pieces(prj, res), SPL = PC.split, SEC = {};
    PC.P.forEach(function(p){ if (p.shape === 'sector' && p.cid) SEC[p.cid] = (SEC[p.cid] || 0) + 1; });
    var rtA = d.rt === 'RT-1' || d.rt === 'RT-2' ? 'RT 100 %' : d.rt === 'RT-3' ? 'RT por puntos (UW-52)' : '—';
    var rtB = d.rt === 'RT-1' ? 'RT 100 %' : d.rt === 'RT-2' || d.rt === 'RT-3' ? 'RT por puntos (UW-52)' : '—';
    var vol = d.ndt.UT && !d.ndt.RT ? function(s){ return s.replace('RT', 'UT'); } : function(s){ return s; };
    var surf = d.ndt.MT ? 'MT' : d.ndt.PT ? 'LP' : '';
    function W(o){ o.p1 = o.p1 || '1'; o.p2 = o.p2 || o.p1; o.t2 = o.t2 == null ? o.t1 : o.t2; o.L = Math.max(0, o.L); o.A = depArea(o); o.kg = o.A * o.L * 7.85e-6; o.ndt = o.ndt || (o.joint === 'fillet' ? 'VT' + (surf ? ' + ' + surf : '') : 'VT'); list.push(o); return o; }
    function Dm(c){ var Di = c.type === 'shell' ? (c.basis === 'od' ? c.D - 2 * c.tn : c.D) : (c.D || c.B || c.d || 0); return Di + c.tn; }
    // longitudinales
    prj.comps.forEach(function(c){
      if (c.type === 'shell' || c.type === 'cone'){
        var L = c.type === 'shell' ? c.L : Math.hypot(M().axLen(c), (c.D - c.Ds) / 2), cs0 = M().courses(prj, c), sp0 = { nL: cs0.nL, nC: cs0.nC };
        for (var q2 = 0; q2 < sp0.nC; q2++){
          for (var q = 0; q < sp0.nL; q++) W({ id: 'L' + (++cntL), cat: 'A', desc: 'Longitudinal ' + c.name + (sp0.nC > 1 ? ' virola parcial ' + (q2 + 1) : '') + (sp0.nL > 1 ? ' (' + (q + 1) + '/' + sp0.nL + ')' : ''), joint: 'butt', prep: c.tn > 16 ? 'X' : 'V', t1: c.tn, p1: pno(c.mat), L: L / sp0.nC, ang: cs0.list[q2].ang[q], course: q2, ndt: vol('VT + ' + rtA).replace('VT + —', 'VT'), comp: c.id });
          if (q2 > 0) W({ id: 'C' + (++cntC), cat: 'B', desc: 'Circunferencial entre virolas parciales de ' + c.name, joint: 'butt', prep: c.tn > 16 ? 'X' : 'V', t1: c.tn, p1: pno(c.mat), L: Math.PI * Dm(c), ndt: vol(rtB === '—' ? 'VT' : 'VT + ' + rtB), comp: c.id });
        }
      }
      if (/ellip|tori|hemi/.test(c.type) && !c.seamless) W({ id: 'L' + (++cntL), cat: 'A', desc: 'Soldadura del disco de ' + c.name + ' (antes de conformar)', joint: 'butt', prep: c.tn > 16 ? 'X' : 'V', t1: c.tn, p1: pno(c.mat), L: c.D * 1.2, ndt: 'VT + RT 100 % (UW-11(a)(5)(-a) si E = 1)', comp: c.id });
    });
    // circunferenciales
    for (var i = 0; i < prj.comps.length - 1; i++){
      var a = prj.comps[i], b = prj.comps[i + 1], hemi = a.type === 'hemi' || b.type === 'hemi', cC = a.type === 'flat' || b.type === 'flat' || a.type === 'bflange' || b.type === 'bflange';
      var cat = cC ? 'C' : hemi ? 'A' : 'B', t1 = a.type === 'bflange' ? (a.g1 || a.tn) : a.tn, t2 = b.type === 'bflange' ? (b.g1 || b.tn) : b.tn, cs = a.type === 'shell' ? a : b;
      var rt = cat === 'A' ? rtA : cat === 'B' ? rtB : (a.type === 'flat' || b.type === 'flat' ? '—' : rtB);
      W({ id: 'C' + (++cntC), cat: cat, desc: a.name + ' / ' + b.name, joint: (a.type === 'flat' || b.type === 'flat') ? 'butt' : 'butt', prep: Math.max(t1, t2) > 16 ? 'X' : 'V', t1: t1, t2: t2, p1: pno(a.mat), p2: pno(b.mat), L: Math.PI * Dm(cs), ndt: vol((rt === '—' ? 'VT' : 'VT + ' + rt) + (cat === 'C' && surf ? ' + ' + surf : '')), comps: [a.id, b.id] });
    }
    // conexiones
    prj.nozzles.forEach(function(n){
      var host = compById(prj, n.host); if (!host) return;
      var hp = pno(host.mat), np = pno(n.mat), tw = n.tw > 0 ? +n.tw : host.tn;
      W({ id: 'N-' + n.mark, cat: 'D', desc: (n.kind === 'cpl' ? 'Manguito ' : 'Cuello ') + n.mark + ' a ' + host.name + (n.wtype === 'seton' ? ' (apoyado)' : ' (insertado)'), joint: 'butt', prep: 'V', t1: Math.min(host.tn, tw), t2: n.tn, p1: hp, p2: np, L: Math.PI * n.od, ndt: 'VT' + (surf ? ' + ' + surf : ''), noz: n.id });
      if (+n.leg41 > 0) W({ id: 'N-' + n.mark + 'f', cat: 'D', desc: 'Filete exterior ' + n.mark + ' (cateto ' + f1(n.leg41) + ')', joint: 'fillet', leg: +n.leg41, t1: host.tn, t2: n.tn, p1: hp, p2: np, L: Math.PI * (n.od + n.leg41), noz: n.id });
      if (n.pad && n.Dp > n.od){ var pp = pno(n.pmat);
        W({ id: 'R-' + n.mark + '1', cat: 'D', desc: 'Refuerzo ' + n.mark + ' a cuello', joint: 'butt', prep: 'V', t1: n.te, t2: n.tn, p1: pp, p2: np, L: Math.PI * n.od, noz: n.id });
        W({ id: 'R-' + n.mark + '2', cat: '—', desc: 'Refuerzo ' + n.mark + ' a ' + host.name + ' (filete exterior ' + f1(n.leg42 || 0) + ')', joint: 'fillet', leg: +n.leg42 || n.te, t1: n.te, t2: host.tn, p1: pp, p2: hp, L: Math.PI * n.Dp, noz: n.id }); }
      if (n.kind !== 'cpl' && n.fl && n.fl.type !== 'none'){
        var fp = pno(n.fl.mat);
        if (n.fl.type === 'SO'){ W({ id: 'F-' + n.mark + '1', cat: 'C', desc: 'Brida SO ' + n.mark + ': filete exterior', joint: 'fillet', leg: Math.min(1.4 * n.tn, n.tn + 6), t1: n.tn, p1: np, p2: fp, L: Math.PI * n.od, noz: n.id }); W({ id: 'F-' + n.mark + '2', cat: 'C', desc: 'Brida SO ' + n.mark + ': filete interior', joint: 'fillet', leg: n.tn, t1: n.tn, p1: np, p2: fp, L: Math.PI * n.od, noz: n.id }); }
        else if (n.fl.type === 'WN') W({ id: 'F-' + n.mark, cat: 'C', desc: 'Brida WN ' + n.mark + ' a tubo (a tope)', joint: 'butt', prep: 'V', t1: n.tn, p1: np, p2: fp, L: Math.PI * n.od, ndt: vol('VT + ' + (rtB === '—' ? 'RT por puntos recomendada' : rtB)), noz: n.id });
        (n.elb || []).forEach(function(e, q){ if (+e.ang > 0){ W({ id: 'E-' + n.mark + (2 * q + 1), cat: 'C', desc: 'Codo ' + (q + 1) + ' ' + n.mark + ' (entrada)', joint: 'butt', prep: 'V', t1: n.tn, p1: np, L: Math.PI * n.od, noz: n.id }); W({ id: 'E-' + n.mark + (2 * q + 2), cat: 'C', desc: 'Codo ' + (q + 1) + ' ' + n.mark + ' (salida)', joint: 'butt', prep: 'V', t1: n.tn, p1: np, L: Math.PI * n.od, noz: n.id }); } });
      }
    });
    // anillos y soportes
    prj.comps.forEach(function(c){ if (c.type === 'shell' && +c.rn > 0) for (var q = 0; q < +c.rn; q++) W({ id: 'X-' + c.id + 'R' + (q + 1), cat: '—', desc: 'Anillo ' + (q + 1) + ' de ' + c.name + ' (filete continuo a ambos lados)', joint: 'fillet', leg: Math.min(+c.rb || 10, c.tn), t1: c.tn, t2: +c.rb || 10, p1: pno(c.mat), p2: pno(c.rmat), L: 2 * Math.PI * Dm(c) }); });
    var L = res.loads, sp = prj.support || {}, sc = 0;
    if (L && !L.err){
      if (L.skirt){ W({ id: 'S' + (++sc), cat: '—', desc: 'Faldón a fondo inferior', joint: 'fillet', leg: +sp.leg || +sp.t || 10, t1: +sp.t || 10, t2: prj.comps[0].tn, p1: pno(sp.mat), p2: pno(prj.comps[0].mat), L: Math.PI * L.skirt.Ds });
        W({ id: 'S' + (++sc), cat: '—', desc: 'Faldón a anillo base (2 filetes)', joint: 'fillet', leg: Math.min(+sp.t || 10, 12), t1: +sp.t || 10, t2: +sp.tb || 20, p1: pno(sp.mat), p2: pno(sp.bmat), L: 2 * Math.PI * L.skirt.Ds }); }
      if (L.legs){ var lb0 = legW(sp, L), shL = prj.comps.filter(function(c){ return c.type === 'shell'; })[0] || prj.comps[0], stl2 = supSteel(sp, 'l', +sp.lt), pdl = L.legs.pad || { t: shL.tn, w: lb0 + 100, L: 400 }, tl = (L.legs.LG && L.legs.LG.t) || +sp.lt || 8;
        for (var q2 = 0; q2 < L.legs.n; q2++){
          W({ id: 'S' + (++sc), cat: '—', desc: 'Chapa intermedia pata ' + (q2 + 1) + ' a virola (perimetral)', joint: 'fillet', leg: Math.min(pdl.t, shL.tn), t1: pdl.t, t2: shL.tn, p1: pno(pdl.mat), p2: pno(shL.mat), L: 2 * (pdl.L + pdl.w) });
          W({ id: 'S' + (++sc), cat: '—', desc: 'Pata ' + (q2 + 1) + ' (' + stl2.name + ') a chapa intermedia', joint: 'fillet', leg: Math.min(tl, pdl.t), t1: tl, t2: pdl.t, p1: stl2.pno, p2: pno(pdl.mat), L: 2 * (pdl.L - 100) + lb0 });
          W({ id: 'S' + (++sc), cat: '—', desc: 'Pata ' + (q2 + 1) + ' a placa base (perimetral)', joint: 'fillet', leg: Math.min(tl, 10), t1: tl, t2: 20, p1: stl2.pno, p2: stl2.pno, L: (L.legs.LG && L.legs.LG.name ? 2 * (L.legs.LG.h + 2 * L.legs.LG.bf) : Math.PI * lb0) }); } }
      if (L.lugs && L.lugs.geo){ var Gw = L.lugs.geo, shM = prj.comps.filter(function(c){ return c.type === 'shell'; })[0] || prj.comps[0];
        for (var qg = 0; qg < Gw.n; qg++){ W({ id: 'S' + (++sc), cat: '—', desc: 'Chapa intermedia ménsula ' + (qg + 1) + ' a virola (perimetral)', joint: 'fillet', leg: Math.min(Gw.pt, shM.tn), t1: Gw.pt, t2: shM.tn, p1: pno(Gw.padMat), p2: pno(shM.mat), L: 2 * (Gw.pw + Gw.ph) });
          W({ id: 'S' + (++sc), cat: '—', desc: 'Cartelas y placas de ménsula ' + (qg + 1) + ' (' + Gw.st.name + ') a chapa intermedia', joint: 'fillet', leg: Math.min(Gw.t, Gw.pt), t1: Gw.t, t2: Gw.pt, p1: Gw.st.pno, p2: pno(Gw.padMat), L: 2 * 2 * Gw.H + 2 * (Gw.S + 2 * Gw.t + 50) });
          W({ id: 'S' + (++sc), cat: '—', desc: 'Cartelas a placas de ménsula ' + (qg + 1), joint: 'fillet', leg: Math.min(Gw.t, 8), t1: Gw.t, t2: Gw.tb, p1: Gw.st.pno, p2: Gw.st.pno, L: 2 * 2 * 2 * Gw.L }); } }
      if (sp.type === 'saddle') for (var q3 = 0; q3 < 2; q3++){ var shS = prj.comps.filter(function(c){ return c.type === 'shell'; })[0] || prj.comps[0], Ro = shS.D / 2 + shS.tn, stS = supSteel(sp, 's', +sp.tw), sdd = L.saddle ? saddleDims(prj, L, sp) : { wL: Ro * 2.3, wB: 300 };
        W({ id: 'S' + (++sc), cat: '—', desc: 'Chapa de desgaste cuna ' + (q3 + 1) + ' a virola (perimetral)', joint: 'fillet', leg: Math.min(+sp.twp || shS.tn, shS.tn), t1: +sp.twp || shS.tn, t2: shS.tn, p1: pno(shS.mat), p2: pno(shS.mat), L: 2 * (sdd.wL + sdd.wB) });
        W({ id: 'S' + (++sc), cat: '—', desc: 'Cuna ' + (q3 + 1) + ' (' + stS.name + ') a chapa de desgaste', joint: 'fillet', leg: Math.min(+sp.tf || 12, +sp.twp || shS.tn), t1: +sp.tf || 12, t2: +sp.twp || shS.tn, p1: stS.pno, p2: pno(shS.mat), L: 2 * ((+sp.theta || 120) * Math.PI / 180 * Ro) + 2 * (+sp.b || 200) }); }
    }
    var F = res.fab || {};
    if (F.jacket && prj.jacket.on){ var hj = compById(prj, prj.jacket.host); W({ id: 'J1', cat: 'A', desc: 'Longitudinal de la camisa', joint: 'butt', prep: 'V', t1: prj.jacket.tj, p1: pno(prj.jacket.mat), L: F.jacket.L, ndt: vol('VT + ' + rtA) });
      W({ id: 'J2', cat: 'C', desc: 'Cierres de camisa a virola (×2, ' + prj.jacket.closure + ')', joint: 'butt', prep: 'V', t1: prj.jacket.tc, t2: hj ? hj.tn : prj.jacket.tc, p1: pno(prj.jacket.mat), p2: hj ? pno(hj.mat) : '1', L: 2 * Math.PI * 2 * F.jacket.Rs });
      W({ id: 'J3', cat: 'C', desc: 'Camisa a cierres (×2)', joint: 'butt', prep: 'V', t1: prj.jacket.tj, t2: prj.jacket.tc, p1: pno(prj.jacket.mat), L: 2 * Math.PI * 2 * F.jacket.Rj }); }
    if (F.hp && prj.hp.on){ var hh = compById(prj, prj.hp.host); W({ id: 'H1', cat: '—', desc: 'Media caña a virola (2 cordones, EE-5)', joint: 'fillet', leg: prj.hp.tj, t1: prj.hp.tj, t2: hh ? hh.tn : 10, p1: pno(prj.hp.mat), p2: hh ? pno(hh.mat) : '1', L: 2 * (F.hp.Lhp || 0) }); }
    if (F.lift && prj.lift.on) for (var q4 = 0; q4 < (+prj.lift.n || 2); q4++) W({ id: 'X-OI' + (q4 + 1), cat: '—', desc: 'Orejeta de izado ' + (q4 + 1), joint: 'fillet', leg: +prj.lift.w, t1: +prj.lift.t, t2: prj.comps[0].tn, p1: pno(prj.lift.mat), p2: pno(prj.comps[0].mat), L: 2 * (+prj.lift.b + +prj.lift.t) });
    // WPS
    var forced = (prj.fab && prj.fab.wmap) || {}, bad = 0;
    list.forEach(function(w){ var a2 = wpsFor(w, wl, d.pwht, forced[w.id]); w.wps = a2.w ? a2.w.id : '—'; w.pqr = a2.w ? a2.w.pqr : ''; w.proc = a2.w ? a2.w.proc : ''; w.rng = a2.rng; w.ok = a2.ok; w.why = a2.why || ''; if (!a2.ok) bad++; });
    var kg = list.reduce(function(a, w){ return a + w.kg; }, 0), Lt = list.reduce(function(a, w){ return a + w.L; }, 0);
    var byWps = {}; list.forEach(function(w){ var k2 = w.wps; byWps[k2] = byWps[k2] || { L: 0, kg: 0, n: 0, proc: w.proc }; byWps[k2].L += w.L; byWps[k2].kg += w.kg; byWps[k2].n++; });
    return { list: list, kg: kg, L: Lt, bad: bad, wps: wl, byWps: byWps };
  }

  // ---------------- PPI / ITP ----------------
  function itp(prj, res, wm){
    var d = prj.design, F = res.fab || {}, ped = F.ped, cat = ped && ped.cat, n = { SEP: 0, I: 1, II: 2, III: 3, IV: 4 }[cat] || 0, AI = n >= 2 ? 'ON' : 'AI';
    var rows = [], k = 0;
    function R(phase, act, doc, crit, rec, mfr, cli, ins){ rows.push({ n: ++k, phase: phase, act: act, doc: doc, crit: crit, rec: rec, mfr: mfr, cli: cli, ins: ins }); }
    var hasRT = d.rt !== 'RT-4', imp = res.impact && res.impact.length;
    R('Documentación', 'Revisión de cálculo y planos', 'Memoria de cálculo, plano de fabricación', 'ASME VIII-1' + (ped ? '; PED anexo I' : ''), 'Planos aprobados', 'P', 'R', n >= 3 ? 'H' : 'R');
    R('Documentación', 'Aprobación de WPS/PQR y cualificación de soldadores (WPQ)', 'WPS ' + (wm ? Object.keys(wm.byWps).filter(function(x){ return x !== '—'; }).join(', ') : ''), 'ASME IX' + (n >= 2 ? '; PED anexo I 3.1.2' : ''), 'WPS, PQR, WPQ', 'P', 'R', n >= 2 ? 'H' : 'R');
    R('Documentación', 'Procedimientos y personal de END', 'Procedimientos RT/UT/MT/LP', 'ASME V; SNT-TC-1A / ISO 9712' + (n >= 3 ? '; PED 3.1.3' : ''), 'Certificados de personal', 'P', 'R', n >= 3 ? 'R' : 'R');
    R('Materiales', 'Recepción e identificación de materiales; revisión de certificados EN 10204 ' + (n >= 2 ? '3.1' : '3.1/2.2'), 'Lista de materiales', 'II-A / II-B; UG-93' + (ped ? '; PED 4.3' : ''), 'Certificados y registro de trazabilidad', 'P', 'R', 'R');
    if (imp) R('Materiales', 'Ensayos de impacto Charpy de: ' + res.impact.join(', '), 'Certificados', 'UG-84, UCS-66' + (ped ? '; PED 7.5 (27 J)' : ''), 'Informe de ensayo', 'P', 'W', 'W');
    R('Fabricación', 'Transferencia de marcas, corte y biselado', 'Plano y despiece', 'UG-77, UG-94', 'Registro de trazabilidad', 'P', '—', 'S');
    R('Fabricación', 'Conformado de virolas y fondos; espesor mínimo tras conformado', 'Certificado del fabricante de fondos', 'UG-79, UG-80, UG-81, UCS-79', 'Informe dimensional y de espesores', 'P', 'R', 'R');
    R('Fabricación', 'Presentación y armado de uniones (alineación y separación)', 'Plano', 'UW-33', 'Registro', 'P', '—', 'S');
    R('Soldadura', 'Soldadura de producción según WPS asignada en el mapa de soldaduras', 'Mapa de soldaduras', 'ASME IX, UW-26 a UW-37', 'Registro de soldador por cordón', 'P', 'S', 'S');
    R('END', 'Examen visual de todas las soldaduras', 'Procedimiento VT', 'UW-35, UW-38', 'Informe VT', 'P', 'R', 'R');
    if (hasRT) R('END', (d.ndt.UT && !d.ndt.RT ? 'UT' : 'RT') + ' según ' + d.rt + ' (cat. A: ' + (d.rt === 'RT-3' ? 'puntos' : '100 %') + '; cat. B: ' + (d.rt === 'RT-1' ? '100 %' : 'puntos') + ')', 'Mapa de soldaduras', d.ndt.UT && !d.ndt.RT ? 'UW-51(a)(4), Ap. 12' : 'UW-51 / UW-52, Ap. 4', 'Informes y placas', 'P', 'R', 'R');
    if (d.ndt.MT || d.ndt.PT) R('END', (d.ndt.MT ? 'MT' : 'LP') + ' de soldaduras de conexiones y accesorios', 'Mapa de soldaduras', d.ndt.MT ? 'Ap. 6' : 'Ap. 8', 'Informe', 'P', 'R', 'R');
    if (d.pwht) R('Tratamiento térmico', 'TTPS: ciclo, termopares y registro', 'Procedimiento de TTPS', 'UW-40, UCS-56', 'Gráfico de TTPS', 'P', 'R', 'R');
    R('Dimensional', 'Control dimensional final: orientaciones, cotas, ovalización (UG-80) y espesores', 'Plano de fabricación', 'UG-80, tolerancias de plano', 'Informe dimensional', 'P', 'W', 'R');
    R('Prueba', 'Prueba hidrostática a ' + (ped && ped.PT ? ped.PT : res.test.PT).toFixed(2).replace('.', ',') + ' MPa en la parte superior (' + ((ped && ped.PT ? ped.PT : res.test.PT) + res.test.PTbot - res.test.PT).toFixed(2).replace('.', ',') + ' MPa abajo), mantenimiento e inspección a ≥ PT/1,3', 'Procedimiento de prueba', 'UG-99' + (ped ? '; PED 3.2.2 / 7.4' : ''), 'Certificado de prueba', 'P', 'W', 'H');
    if (F.jacket && prj.jacket.on) R('Prueba', 'Prueba de la camisa (con el recipiente interior a la presión necesaria para la estabilidad)', 'Procedimiento', 'Ap. 9-10, UG-99', 'Certificado', 'P', 'W', 'H');
    R('Final', 'Placa de características y marcado ' + (ped && n >= 1 ? 'CE' + (n >= 2 ? ' + nº de organismo notificado' : '') + ' y ' : '') + (prj.fab && prj.fab.stamp === false ? '' : 'símbolo U'), 'Plano de placa', 'UG-115 a UG-119' + (ped ? '; PED 3.3' : ''), 'Calco de la placa', 'P', 'R', 'H');
    R('Final', 'Limpieza, pintura y protección de bridas', 'Especificación de pintura', 'Especificación del cliente', 'Informe de espesores de pintura', 'P', 'W', '—');
    R('Final', 'Dossier final: Formulario U-1A' + (ped && n >= 1 ? ', declaración UE de conformidad, instrucciones de uso' : '') + ', certificados, mapas, informes', 'Índice del dossier', 'UG-120' + (ped ? '; PED art. 17, anexo IV' : ''), 'Dossier', 'P', 'R', n >= 2 ? 'H' : 'R');
    return { rows: rows, legend: 'P = realiza · H = punto de espera · W = presencia · R = revisión documental · S = supervisión por muestreo', insp: AI };
  }
  function nameplate(prj, res){
    var d = prj.design, F = res.fab || {}, ped = F.ped, pl = (prj.fab && prj.fab.plate) || {};
    var rows = [['Fabricante', pl.mfr || '—'], ['Nº de fabricación', pl.serial || '—'], ['Año de fabricación', pl.year || ''], ['Equipo / TAG', (prj.info.equipo || '') + ' / ' + (prj.info.tag || '')],
      ['MAWP', (res.mawp ? res.mawp.v : d.P).toFixed(2).replace('.', ',') + ' MPa a ' + d.T + ' °C'], ['MDMT', (res.mdmt ? Math.max(res.mdmt.v, d.MDMT) : d.MDMT).toFixed(0) + ' °C a ' + (res.mawp ? res.mawp.v : d.P).toFixed(2).replace('.', ',') + ' MPa'],
      ['MAEP', d.Pext > 0 && res.maep ? res.maep.v.toFixed(3).replace('.', ',') + ' MPa' : '—'], ['Radiografía', d.rt], ['TTPS', d.pwht ? 'HT' : '—'], ['Prueba', 'HYDRO ' + (ped && ped.PT ? ped.PT : res.test.PT).toFixed(2).replace('.', ',') + ' MPa'],
      ['Volumen', (res.mass.vol * 1000).toFixed(0) + ' L'], ['Masa en vacío', (res.loads && res.loads.mass ? res.loads.mass.empty : res.mass.empty).toFixed(0) + ' kg']];
    if (ped && ped.cat && ped.cat !== 'excl'){ rows.push(['PED 2014/68/UE', 'PS ' + ped.PS.toFixed(2).replace('.', ',') + ' MPa · TS ' + ped.TS[0] + ' / ' + ped.TS[1] + ' °C']);
      rows.push(['', 'V ' + ped.V.toFixed(0) + ' L · fluido grupo ' + prj.ped.group + ' · ' + (ped.cat === 'SEP' ? 'art. 4(3)' : 'cat. ' + ped.cat) + (pl.nb || prj.ped.nb ? ' · CE ' + (pl.nb || prj.ped.nb) : '')]); }
    return rows;
  }

  // ---------------- desarrollo de chapas y aprovechamiento ----------------
  function plateSizes(prj){ return String((prj.fab && prj.fab.plates) || '2000x6000').split(/[;,\n]/).map(function(s){ var q = s.trim().toLowerCase().split(/[x×*]/).map(function(v){ return +v.trim(); }); return q.length === 2 && q[0] > 0 && q[1] > 0 ? [Math.min(q[0], q[1]), Math.max(q[0], q[1])] : null; }).filter(Boolean); }
  function maxPlateLen(prj){ var s = plateSizes(prj); return s.length ? Math.max.apply(null, s.map(function(x){ return x[1]; })) - 2 * num(prj.fab && prj.fab.edge, 10) : 6000; }
  function maxPlateW(prj){ var s = plateSizes(prj); return s.length ? Math.max.apply(null, s.map(function(x){ return x[0]; })) - 2 * num(prj.fab && prj.fab.edge, 10) : 2000; }
  function pieces(prj, res){
    var P = [], warn = [], split = {}, Lmax = maxPlateLen(prj), Wmax = maxPlateW(prj), fb = prj.fab || {};
    function add(o){ o.key = (o.mat.id || o.mat) + '|' + o.t; P.push(o); }
    function rect(ref, mat, t, w, h, nm, extra){ add(Object.assign({ ref: ref, mat: mat, t: t, w: w, h: h, name: nm, shape: 'rect' }, extra || {})); }
    function sectorBox(R1, R2, ang){ // anillo-sector (R1 > R2) con ángulo ang (rad): caja mínima girando
      var best = null; for (var k = 0; k <= 90; k++){ var a0 = k * Math.PI / 180, pts = []; for (var q = 0; q <= 24; q++){ var a = a0 + ang * q / 24; pts.push([R1 * Math.cos(a), R1 * Math.sin(a)]); pts.push([R2 * Math.cos(a), R2 * Math.sin(a)]); }
        var xs = pts.map(function(p){ return p[0]; }), ys = pts.map(function(p){ return p[1]; }), w = Math.max.apply(null, xs) - Math.min.apply(null, xs), h = Math.max.apply(null, ys) - Math.min.apply(null, ys);
        if (!best || w * h < best.w * best.h) best = { w: w, h: h, a0: a0, x0: Math.min.apply(null, xs), y0: Math.min.apply(null, ys) }; }
      return best; }
    function annulus(ref, mat, t, Do, Di, nm){
      // número de segmentos: el mínimo que cabe en la chapa, o el impuesto por el usuario (fab.ringSeg)
      var n = Math.max(1, Math.min(16, +fb.ringSeg || 1));
      while (n < 24){ var bk = sectorBox(Do / 2, Di / 2, 2 * Math.PI / n); if (Math.min(bk.w, bk.h) <= Wmax && Math.max(bk.w, bk.h) <= Lmax) break; n++; }
      if (n === 1) add({ ref: ref, mat: mat, t: t, w: Do, h: Do, name: nm, shape: 'ring', Do: Do, Di: Di });
      else { var bx2 = sectorBox(Do / 2, Di / 2, 2 * Math.PI / n); for (var q = 0; q < n; q++) add({ ref: ref, mat: mat, t: t, w: bx2.w, h: bx2.h, name: nm + ' seg. ' + (q + 1) + '/' + n, shape: 'sector', R1: Do / 2, R2: Di / 2, ang: 2 * Math.PI / n, bx: bx2 }); }
      return n;
    }
    // virola (cilindro de diámetro medio Dm y longitud L): virolas parciales de un ancho de chapa y sectores si el desarrollo no cabe
    function cyl(ref, mat, t, Dm, L, nm, cid){
      var dev = Math.PI * Dm, sc = M().splitCyl(Dm, L, { L: Lmax, W: Wmax, rot: fb.rot !== false }), nL = sc.nL, nC = sc.nC, w = dev / nL;
      for (var q = 0; q < nL; q++) for (var q2 = 0; q2 < nC; q2++) rect(ref, mat, t, w, L / nC, nm + (nL > 1 || nC > 1 ? ' (' + (q2 * nL + q + 1) + '/' + nL * nC + ')' : ''), { dev: dev, note: 'desarrollo π·Dm = ' + f0(dev) + ' mm' });
      if (nC > 1) warn.push(nm + ': longitud ' + f0(L) + ' mm mayor que el ancho de chapa; ' + nC + ' virolas parciales de ' + f0(L / nC) + ' mm (' + (nC - 1) + ' soldaduras circunferenciales adicionales)');
      if (nL > 1) warn.push(nm + ': desarrollo ' + f0(dev) + ' mm mayor que la chapa; ' + nL + ' sectores por virola parcial (' + nL + ' soldaduras longitudinales)');
      if (cid) split[cid] = { nL: nL, nC: nC };
      return { nL: nL, nC: nC };
    }
    prj.comps.forEach(function(c){
      var p = res.L.pos[c.id];
      if (c.type === 'shell'){
        var Di = c.basis === 'od' ? c.D - 2 * c.tn : c.D;
        cyl(c.name, c.mat, c.tn, Di + c.tn, c.L, c.name, c.id);
        if (+c.rn > 0){ var Dr = c.rside === 'int' ? Di - (+c.rh || 0) : Di + 2 * c.tn + (+c.rh || 0); for (var k2 = 0; k2 < +c.rn; k2++) annulus(c.name, c.rmat, +c.rb || 10, c.rside === 'int' ? Di : Dr + (+c.rh || 0), c.rside === 'int' ? Di - 2 * (+c.rh || 0) : Di + 2 * c.tn, 'Anillo ' + (k2 + 1) + ' ' + c.name); }
      } else if (c.type === 'cone'){
        var al = c.alpha * Math.PI / 180, R1 = (c.D + c.tn * Math.cos(al)) / 2 / Math.sin(al), R2 = (c.Ds + c.tn * Math.cos(al)) / 2 / Math.sin(al), ang = 2 * Math.PI * Math.sin(al), n = 1, bx;
        while (n < 24){ bx = sectorBox(R1, R2, ang / n); if (Math.min(bx.w, bx.h) <= Wmax && Math.max(bx.w, bx.h) <= Lmax) break; n++; }
        for (var q3 = 0; q3 < n; q3++) add({ ref: c.name, mat: c.mat, t: c.tn, w: bx.w, h: bx.h, name: c.name + (n > 1 ? ' (' + (q3 + 1) + '/' + n + ')' : ''), cid: c.id, shape: 'sector', R1: R1, R2: R2, ang: ang / n, bx: bx, note: 'sector de radios ' + f0(R1) + ' / ' + f0(R2) + ' mm y ' + f1(ang / n * 180 / Math.PI) + '°' });
        if (n > 1) warn.push(c.name + ': desarrollo en ' + n + ' sectores');
      } else if (/ellip|tori|hemi/.test(c.type)){
        var prof = M().headProfile(Object.assign({}, c, { D: c.D + c.tn })), A = 0; for (var k = 1; k < prof.length; k++){ var ds = prof[k][0] - prof[k - 1][0], r0 = prof[k - 1][1], r1 = prof[k][1]; A += Math.PI * (r0 + r1) * Math.hypot(ds, r1 - r0); }
        var Db = 2 * Math.sqrt(A / Math.PI) + 2 * c.tn, tb = Math.ceil(c.tn / (1 - num(fb.thin, 10) / 100));
        if (fb.nestHeads) add({ ref: c.name, mat: c.mat, t: tb, w: Db, h: Db, name: 'Disco ' + c.name, shape: 'disc', D: Db, note: 'disco Ø ' + f0(Db) + ' (área media + 2·t), chapa ' + tb + ' mm por adelgazamiento ' + num(fb.thin, 10) + ' %' });
        else warn.push(c.name + ': fondo conformado de proveedor · disco aproximado Ø ' + f0(Db) + ' mm, chapa de partida ' + tb + ' mm (' + num(fb.thin, 10) + ' % de adelgazamiento)' + (Db > Wmax ? '; requiere disco soldado (corona y gajos)' : ''));
      } else if (c.type === 'flat') add({ ref: c.name, mat: c.mat, t: c.tn, w: c.d + 2 * Math.max(c.tn * 0.4, 15), h: c.d + 2 * Math.max(c.tn * 0.4, 15), name: c.name, shape: 'disc', D: c.d + 2 * Math.max(c.tn * 0.4, 15) });
    });
    prj.nozzles.forEach(function(n){ if (n.pad && n.Dp > n.od) add({ ref: 'Refuerzo ' + n.mark, mat: n.pmat, t: n.te, w: n.Dp, h: n.Dp, name: 'Refuerzo ' + n.mark, shape: 'ring', Do: n.Dp, Di: n.od }); });
    var L = res.loads, sp = prj.support || {};
    if (L && !L.err){
      if (L.skirt){ cyl('Faldón', sp.mat, +sp.t || 10, L.skirt.Ds - (+sp.t || 10), L.sAtt - L.zg, 'Faldón');
        annulus('Anillo base', sp.bmat, +sp.tb || 20, L.skirt.Dbo, L.skirt.Dbi, 'Anillo base'); }
      if (L.lugs && L.lugs.geo){ var Gn = L.lugs.geo, gK = sp.gstd === 'EN' ? { id: 'EN:' + (sp.ggrade || 'S275JR') } : sp.gmat || sp.mat; for (var qn = 0; qn < Gn.n; qn++){ rect('Ménsula ' + (qn + 1), Gn.padMat, Gn.pt, Gn.pw, Gn.ph, 'Chapa intermedia ménsula ' + (qn + 1)); rect('Ménsula ' + (qn + 1), gK, Gn.t, Gn.L, Gn.H, 'Cartela ménsula ' + (qn + 1) + 'a'); rect('Ménsula ' + (qn + 1), gK, Gn.t, Gn.L, Gn.H, 'Cartela ménsula ' + (qn + 1) + 'b'); rect('Ménsula ' + (qn + 1), gK, Gn.tb, Gn.S + 2 * Gn.t + 50, Gn.L, 'Placas ménsula ' + (qn + 1) + 'a'); rect('Ménsula ' + (qn + 1), gK, Gn.tb, Gn.S + 2 * Gn.t + 50, Gn.L, 'Placas ménsula ' + (qn + 1) + 'b'); } }
      if (L.legs){ var bpl = legPlate(sp, L), pdn = L.legs.pad; for (var ql = 0; ql < L.legs.n; ql++){ if (pdn) rect('Pata ' + (ql + 1), pdn.mat, pdn.t, pdn.w, pdn.L, 'Chapa intermedia pata ' + (ql + 1)); rect('Pata ' + (ql + 1), sp.lstd === 'EN' ? { id: 'EN:' + (sp.lgrade || 'S275JR') } : sp.bmat, 20, bpl, bpl, 'Placa base pata ' + (ql + 1)); } }
      if (sp.type === 'saddle' && L.saddle){ var Ro = (prj.comps.filter(function(c){ return c.type === 'shell'; })[0] || { D: 1000, tn: 10 }), Rr = Ro.D / 2 + Ro.tn, th = (+sp.theta || 120) * Math.PI / 180, Lb = sp.Lbp > 0 ? +sp.Lbp : 2 * Rr * Math.sin(th / 2) + 100;
        var smK = sp.sstd === 'EN' ? { id: 'EN:' + (sp.sgrade || 'S275JR') } : sp.smat;
        for (var q5 = 0; q5 < 2; q5++){ rect('Cuna ' + (q5 + 1), smK, +sp.tw || 12, Lb, L.saddle.hAx - Rr * Math.cos(th / 2) + 50, 'Alma cuna ' + (q5 + 1)); rect('Cuna ' + (q5 + 1), smK, +sp.tbp || 20, Lb, +sp.Bb || 250, 'Placa base cuna ' + (q5 + 1)); rect('Cuna ' + (q5 + 1), smK, +sp.tf || 12, Rr * th + 50, +sp.b || 200, 'Placa superior cuna ' + (q5 + 1));
          rect('Cuna ' + (q5 + 1), sp.wmat, +sp.twp || 10, Rr * ((+sp.thwp > 0 ? +sp.thwp : +sp.theta + 12) * Math.PI / 180), sp.bwp > 0 ? +sp.bwp : (+sp.b || 200) + 1.56 * Math.sqrt(Rr * Ro.tn), 'Chapa de desgaste ' + (q5 + 1)); } }
    }
    var F = res.fab || {};
    if (F.jacket && prj.jacket.on){ cyl('Camisa', prj.jacket.mat, prj.jacket.tj, prj.jacket.Dj + prj.jacket.tj, F.jacket.L, 'Camisa');
      for (var q7 = 0; q7 < 2; q7++) annulus('Cierre camisa', prj.jacket.mat, prj.jacket.tc, prj.jacket.Dj + 2 * prj.jacket.tj, 2 * F.jacket.Rs, 'Cierre camisa ' + (q7 + 1)); }
    if (F.lift && prj.lift.on) for (var q8 = 0; q8 < (+prj.lift.n || 2); q8++) rect('Orejeta de izado', prj.lift.mat, prj.lift.t, prj.lift.b, prj.lift.H + prj.lift.R, 'Orejeta de izado ' + (q8 + 1), { shape: 'lug', R: prj.lift.R, dh: prj.lift.dh });
    return { P: P, warn: warn, split: split };
  }
  // MaxRects (mejor ajuste de lado corto) con rotación opcional
  function packOne(W, H, items, kerf, rot){
    var free = [{ x: 0, y: 0, w: W, h: H }], placed = [], rest = [];
    items.forEach(function(it){
      var w = it.w + kerf, h = it.h + kerf, best = null;
      free.forEach(function(f){ [[w, h, false], rot ? [h, w, true] : null].forEach(function(o){ if (!o || o[0] > f.w + 1e-6 || o[1] > f.h + 1e-6) return; var s = Math.min(f.w - o[0], f.h - o[1]), l = Math.max(f.w - o[0], f.h - o[1]); if (!best || s < best.s || (s === best.s && l < best.l)) best = { x: f.x, y: f.y, w: o[0], h: o[1], r: o[2], s: s, l: l }; }); });
      if (!best){ rest.push(it); return; }
      placed.push({ it: it, x: best.x, y: best.y, w: best.w - kerf, h: best.h - kerf, r: best.r });
      var nf = [];
      free.forEach(function(f){
        if (best.x >= f.x + f.w || best.x + best.w <= f.x || best.y >= f.y + f.h || best.y + best.h <= f.y){ nf.push(f); return; }
        if (best.x > f.x) nf.push({ x: f.x, y: f.y, w: best.x - f.x, h: f.h });
        if (best.x + best.w < f.x + f.w) nf.push({ x: best.x + best.w, y: f.y, w: f.x + f.w - best.x - best.w, h: f.h });
        if (best.y > f.y) nf.push({ x: f.x, y: f.y, w: f.w, h: best.y - f.y });
        if (best.y + best.h < f.y + f.h) nf.push({ x: f.x, y: best.y + best.h, w: f.w, h: f.y + f.h - best.y - best.h });
      });
      free = nf.filter(function(a, i){ return !nf.some(function(b, j){ return j !== i && a.x >= b.x - 1e-6 && a.y >= b.y - 1e-6 && a.x + a.w <= b.x + b.w + 1e-6 && a.y + a.h <= b.y + b.h + 1e-6 && (j < i || a.x !== b.x || a.y !== b.y || a.w !== b.w || a.h !== b.h); }); });
    });
    return { placed: placed, rest: rest };
  }
  function nest(prj, res){
    var pc = pieces(prj, res), fb = prj.fab || {}, kerf = num(fb.kerf, 5), edge = num(fb.edge, 10), sizes = plateSizes(prj), groups = {};
    pc.P.forEach(function(p){ (groups[p.key] = groups[p.key] || []).push(p); });
    var out = [], warn = pc.warn.slice();
    Object.keys(groups).forEach(function(k){
      var items = groups[k].slice().sort(function(a, b){ return Math.max(b.w, b.h) - Math.max(a.w, a.h) || b.w * b.h - a.w * a.h; });
      var best = null;
      sizes.forEach(function(sz){
        var plates = [], left = items.slice(), guard = 0;
        while (left.length && guard++ < 60){ var r = packOne(sz[1] - 2 * edge, sz[0] - 2 * edge, left, kerf, fb.rot !== false); if (!r.placed.length) break; plates.push({ W: sz[1], H: sz[0], placed: r.placed }); left = r.rest; }
        var area = plates.length * sz[0] * sz[1], used = plates.reduce(function(a, pl){ return a + pl.placed.reduce(function(b, q){ return b + q.w * q.h; }, 0); }, 0);
        var cand = { size: sz, plates: plates, unplaced: left, area: area, util: area ? used / area : 0 };
        if (!best || (cand.unplaced.length < best.unplaced.length) || (cand.unplaced.length === best.unplaced.length && cand.area < best.area - 1e-6)) best = cand;
      });
      // combinación de formatos: en cada chapa se elige el formato con mejor aprovechamiento
      (function(){
        var plates = [], left = items.slice(), guard = 0;
        while (left.length && guard++ < 60){
          var pick = null;
          sizes.forEach(function(sz){ var r = packOne(sz[1] - 2 * edge, sz[0] - 2 * edge, left, kerf, fb.rot !== false); if (!r.placed.length) return;
            var u = r.placed.reduce(function(a, q){ return a + q.w * q.h; }, 0) / (sz[0] * sz[1]), first = r.placed.some(function(q){ return q.it === left[0]; });
            var sc = u + (first ? 1 : 0); if (!pick || sc > pick.sc) pick = { sz: sz, r: r, sc: sc }; });
          if (!pick) break; plates.push({ W: pick.sz[1], H: pick.sz[0], placed: pick.r.placed }); left = pick.r.rest;
        }
        var area = plates.reduce(function(a, pl){ return a + pl.W * pl.H; }, 0), used = plates.reduce(function(a, pl){ return a + pl.placed.reduce(function(b, q){ return b + q.w * q.h; }, 0); }, 0);
        var cand = { size: plates.length ? [plates[0].H, plates[0].W] : sizes[0], mixed: true, plates: plates, unplaced: left, area: area, util: area ? used / area : 0 };
        if (best && plates.length && (cand.unplaced.length < best.unplaced.length || (cand.unplaced.length === best.unplaced.length && cand.area < best.area - 1e-6))) best = cand;
      })();
      if (!best) return;
      var g0 = groups[k][0], rho = rhoOf(g0.mat);
      best.mat = matT(g0.mat); best.matRef = g0.mat; best.t = g0.t; best.kg = best.area * g0.t * rho * 1e-9; best.net = items.reduce(function(a, p){ return a + (p.shape === 'disc' ? Math.PI / 4 * p.w * p.w : p.shape === 'ring' ? Math.PI / 4 * (p.Do * p.Do - p.Di * p.Di) : p.shape === 'sector' ? p.ang / 2 * (p.R1 * p.R1 - p.R2 * p.R2) : p.w * p.h); }, 0) * g0.t * rho * 1e-9;
      if (best.unplaced.length) warn.push(best.mat + ' e = ' + best.t + ': ' + best.unplaced.length + ' piezas no caben en ningún formato (' + best.unplaced.map(function(p){ return p.name; }).join(', ') + ')');
      out.push(best);
    });
    out.sort(function(a, b){ return a.t - b.t; });
    return { groups: out, warn: warn, kg: out.reduce(function(a, g){ return a + g.kg; }, 0), net: out.reduce(function(a, g){ return a + g.net; }, 0) };
  }

  // ---------------- presupuesto ----------------
  function cost(prj, res, B, WM, N){
    var pr = Object.assign({}, defaults(prj).price, (prj.fab && prj.fab.price) || {}), dep = Object.assign({}, defaults(prj).price.dep, pr.dep || {}), rows = [], d = prj.design;
    function row(grp, desc, q, u, pu){ rows.push({ grp: grp, desc: desc, q: q, u: u, pu: pu, imp: q * pu }); }
    // chapa por formatos
    N.groups.forEach(function(g){ var fam = famOf(g.matRef); row('Materiales', 'Chapa ' + g.mat + ' e = ' + g.t + ' mm · ' + fmtPlates(g), g.kg, 'kg', pr[fam] || pr.CS); });
    B.items.forEach(function(x){
      var q = x.qty || 1;
      if (x.form === 'Fondo conformado') row('Materiales', x.desc + ' · ' + x.mat, x.mass, 'kg', (pr[famOf({ id: idOf(x.mat) })] || pr.CS) * pr.head);
      else if (x.form === 'Tubo') row('Materiales', x.desc, x.mass * (x.unit === 'ud' ? q : 1), 'kg', (pr[famOf({ id: idOf(x.mat) })] || pr.CS) * pr.pipeF);
      else if (x.form === 'Forja') row('Materiales', x.desc, Math.max(x.mass, 1) * (x.unit === 'ud' ? q : 1), 'kg', (pr[famOf({ id: idOf(x.mat) })] || pr.CS) * pr.forge);
      else if (x.form === 'Accesorio') row('Materiales', x.desc, q, 'ud', 60);
      else if (x.form === 'Perno') row('Materiales', x.desc, q, 'ud', pr.bolt);
      else if (x.form === 'Junta') row('Materiales', x.desc, q, 'ud', pr.gasket);
      else if (x.form === 'Pletina') row('Materiales', x.desc, x.mass * q, 'kg', (pr[famOf({ id: idOf(x.mat) })] || pr.CS) * 1.1);
    });
    // soldadura por proceso
    var hw = 0;
    Object.keys(WM.byWps).forEach(function(k){ var g = WM.byWps[k], proc = (g.proc || 'SMAW').toUpperCase(), rate = dep[proc] || dep[proc.split('+')[0]] || 1.2, h = g.kg / rate * (1 + pr.fitup); hw += h;
      row('Soldadura', 'Soldadura ' + k + ' (' + (g.proc || '—') + '): ' + g.n + ' cordones, ' + f1(g.L / 1000) + ' m, ' + f1(g.kg) + ' kg de aporte a ' + rate + ' kg/h + ' + Math.round(pr.fitup * 100) + ' % de armado', h, 'h', pr.labour);
      row('Soldadura', 'Material de aporte ' + k + ' (rendimiento 60 %)', g.kg / 0.6, 'kg', (pr[d.mfam] || pr.CS) * 4); });
    // calderería (corte, curvado, montaje): estimación por masa
    var mass = res.loads && res.loads.mass ? res.loads.mass.empty : res.mass.empty;
    row('Calderería', 'Corte, biselado, curvado y montaje (≈ 25 h/t)', mass / 1000 * 25, 'h', pr.labour);
    // END
    var Lrt = 0, Lsp = 0, Lsurf = 0, Lvt = 0;
    WM.list.forEach(function(w){ Lvt += w.L; if (/RT 100|UT 100/.test(w.ndt)) Lrt += w.L; else if (/puntos/.test(w.ndt)) Lsp += Math.min(w.L, 300) + Math.floor(w.L / 15000) * 300; if (/MT|LP/.test(w.ndt)) Lsurf += w.L; });
    var vol = d.ndt.UT && !d.ndt.RT ? 'UT' : 'RT';
    if (Lrt + Lsp > 0) row('END', vol + ' ' + f1((Lrt + Lsp) / 1000) + ' m (100 % + puntos de 300 mm)', (Lrt + Lsp) / 1000, 'm', pr[vol]);
    if (Lsurf > 0) row('END', (d.ndt.MT ? 'MT' : 'LP') + ' de soldaduras de conexiones y accesorios', Lsurf / 1000, 'm', d.ndt.MT ? pr.MT : pr.PT);
    row('END', 'VT de todas las soldaduras', Lvt / 1000, 'm', pr.VT);
    if (d.pwht) row('Tratamiento', 'TTPS en horno', mass, 'kg', pr.pwht);
    row('Pruebas', 'Prueba hidrostática', 1, 'ud', pr.hydro);
    var area = 0; res.comps.forEach(function(rc){ var c = rc.c; if (c.type === 'shell') area += Math.PI * (c.D + 2 * c.tn) * c.L; else if (/ellip|tori|hemi/.test(c.type)) area += 1.1 * Math.PI * Math.pow((c.D + 2 * c.tn) / 2, 2) * 1.09; else if (c.type === 'cone') area += Math.PI * (c.D + c.Ds) / 2 * Math.hypot(M().axLen(c), (c.D - c.Ds) / 2); });
    row('Acabado', 'Chorreado y pintura exterior', area / 1e6, 'm²', pr.paint);
    row('Ingeniería', 'Ingeniería, planos y dossier', pr.engh, 'h', pr.eng);
    var sub = rows.reduce(function(a, r){ return a + r.imp; }, 0), ovh = sub * pr.ovh / 100, mg = (sub + ovh) * pr.margin / 100;
    return { rows: rows, sub: sub, ovh: ovh, margin: mg, total: sub + ovh + mg, hw: hw, eurkg: (sub + ovh + mg) / Math.max(mass, 1), pr: pr };
  }
  function fmtPlates(g){ var c = {}; g.plates.forEach(function(p){ var k = p.H + '×' + p.W; c[k] = (c[k] || 0) + 1; }); return Object.keys(c).map(function(k){ return c[k] + ' × ' + k; }).join(' + '); }
  function coneSegs(prj, c){ var Lmax = maxPlateLen(prj), Wmax = maxPlateW(prj), al = c.alpha * Math.PI / 180, R1 = (c.D + c.tn * Math.cos(al)) / 2 / Math.sin(al), R2 = (c.Ds + c.tn * Math.cos(al)) / 2 / Math.sin(al), ang = 2 * Math.PI * Math.sin(al), n = 1;
    while (n < 24){ var bx = sectorBoxG(R1, R2, ang / n); if (Math.min(bx.w, bx.h) <= Wmax && Math.max(bx.w, bx.h) <= Lmax) break; n++; } return n; }
  function sectorBoxG(R1, R2, ang){ var best = null; for (var k = 0; k <= 90; k++){ var a0 = k * Math.PI / 180, xs = [], ys = []; for (var q = 0; q <= 24; q++){ var a = a0 + ang * q / 24; xs.push(R1 * Math.cos(a), R2 * Math.cos(a)); ys.push(R1 * Math.sin(a), R2 * Math.sin(a)); }
    var w = Math.max.apply(null, xs) - Math.min.apply(null, xs), h = Math.max.apply(null, ys) - Math.min.apply(null, ys); if (!best || w * h < best.w * best.h) best = { w: w, h: h }; } return best; }
  function idOf(t){ var ids = Object.keys(V.BYID); for (var k = 0; k < ids.length; k++) if (V.BYID[ids[k]].t === t) return ids[k]; return 'sa516'; }

  // ---------------- optimizador de espesores ----------------
  function tlist(prj){ var s = String((prj.fab && prj.fab.tlist) || COMMERCIAL_T.join(';')).split(/[;,\s]+/).map(function(x){ return +String(x).replace(',', '.'); }).filter(function(x){ return x > 0; }); s.sort(function(a, b){ return a - b; }); return s.length ? s : COMMERCIAL_T; }
  function optimize(prj){
    var TL = tlist(prj), base = JSON.parse(JSON.stringify(prj)), M0 = M();
    // conformidad de lo que depende del espesor de un componente: el propio componente, sus conexiones, cargas exteriores, uniones y camisa
    function okFor(p, cid){ try { var r = M0.compute(p, { lite: true }), rc = r.byId[cid]; if (!rc || !rc.ok) return false;
        if (rc.mawpTop != null && rc.mawpTop < p.design.P - 1e-9) return false;
        if (r.nozzles.some(function(z){ return z.n.host === cid && (!z.ok || (z.mawpTop != null && z.mawpTop < p.design.P - 1e-9)); })) return false;
        if (loads0ok && r.loads && r.loads.ok === false) return false;
        if (r.fab && r.fab.jacket && p.jacket && p.jacket.on && p.jacket.host === cid && r.fab.jacket.ok === false) return false;
        return true; } catch (e){ return false; } }
    var r0 = M0.compute(base, { lite: true }), mass0 = r0.mass.empty, changes = [], loads0ok = !r0.loads || r0.loads.ok !== false;
    var targets = base.comps.filter(function(c){ return /shell|cone|ellip|tori|hemi|flat/.test(c.type); });
    // primero: si no cumple, subir cada componente que falla
    for (var pass = 0; pass < 1; pass++){
      targets.forEach(function(c){
        var cur = c.tn, rc = r0.byId[c.id], tmin = Math.max(rc && rc.treq ? rc.treq : 0, rc && rc.ext && rc.ext.treq ? rc.ext.treq : 0) - 1e-6, found = null;
        // barrido ascendente de la lista comercial (las comprobaciones de soldaduras UW-16 no son monótonas con el espesor)
        for (var k = 0; k < TL.length && !found; k++){ if (TL[k] < tmin) continue; c.tn = TL[k]; if (okFor(base, c.id)) found = TL[k]; }
        c.tn = found != null ? found : cur;
      });
    }
    var r1 = M0.compute(base, { lite: true });
    base.comps.forEach(function(c){ var o = prj.comps.filter(function(x){ return x.id === c.id; })[0]; if (o && Math.abs(o.tn - c.tn) > 1e-9){ var rc0 = r0.byId[c.id], rc1 = r1.byId[c.id]; changes.push({ id: c.id, name: c.name, from: o.tn, to: c.tn, treq: rc1 ? rc1.treq : null, dm: (rc1 ? rc1.mass : 0) - (rc0 ? rc0.mass : 0) }); } });
    var heads = base.comps.filter(function(c){ return /ellip|tori|hemi/.test(c.type); }).map(function(c){ var thin = num(prj.fab && prj.fab.thin, 10), need = c.tn / (1 - thin / 100), plate = TL.filter(function(t){ return t >= need - 1e-9; })[0] || need; return { name: c.name, tn: c.tn, plate: plate, thin: thin }; });
    return { changes: changes, mass0: mass0, mass1: r1.mass.empty, ok: r1.ok, unchanged: targets.filter(function(c){ return !changes.some(function(x){ return x.id === c.id; }); }).map(function(c){ return c.name; }), mawp: r1.mawp ? r1.mawp.v : null, heads: heads, prj: base };
  }

  function run(prj, res){
    if (!prj.fab) return null;
    var out = {};
    try { out.bom = bom(prj, res); } catch (e){ out.err = 'BOM: ' + e.message; if (typeof console !== 'undefined') console.error(e); }
    try { out.welds = weldMap(prj, res); } catch (e){ out.err = 'Soldaduras: ' + e.message; if (typeof console !== 'undefined') console.error(e); }
    try { out.itp = itp(prj, res, out.welds); out.plate = nameplate(prj, res); } catch (e){ out.err = 'PPI: ' + e.message; if (typeof console !== 'undefined') console.error(e); }
    try { out.nest = nest(prj, res); } catch (e){ out.err = 'Despiece: ' + e.message; if (typeof console !== 'undefined') console.error(e); }
    try { if (out.bom && out.welds && out.nest) out.cost = cost(prj, res, out.bom, out.welds, out.nest); } catch (e){ out.err = 'Presupuesto: ' + e.message; if (typeof console !== 'undefined') console.error(e); }
    return out;
  }
  return { legW: legW, saddleDims: saddleDims, coneSegs: coneSegs, fmtPlates: fmtPlates, defaults: defaults, run: run, bom: bom, weldMap: weldMap, itp: itp, nameplate: nameplate, nest: nest, pieces: pieces, packOne: packOne, cost: cost, optimize: optimize, parseWps: parseWps, qw451: qw451, plateSizes: plateSizes, B165B: B165B, COMMERCIAL_T: COMMERCIAL_T };
})();


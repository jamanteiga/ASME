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
    note(r, 'Tensiones locales en la pared del recipiente (WRC 107/537/297): no incluidas.');
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
    return {
      version: 1,
      info: { proyecto: '', equipo: '', tag: '', cliente: '', autor: '', rev: '0', fecha: new Date().toISOString().slice(0, 10) },
      design: { orient: orient || 'V', hdir: 'R', P: 1.0, T: 150, Pext: 0, c: 3, MDMT: -10, fluid: 'Agua', rho: 1000, level: null,
        lethal: false, rt: 'RT-1', jt: '1', ndt: { VT: true, RT: true, UT: false, MT: false, PT: false },
        pwht: false, pwhtVol: false, ug20f: true, normalized: false, testPos: 'oper', testUseP: false },
      comps: [ newComp('shell', null) ],
      base: 'C1', seq: 1, nseq: 0,
      nozzles: [],
      loads: typeof VLOADS !== 'undefined' ? VLOADS.defaults() : {},
      support: typeof VLOADS !== 'undefined' ? VLOADS.defSupport(orient || 'V') : { type: 'none' }
    };
  }
  function newComp(type, prj, near){
    var id = 'C' + (prj ? (++prj.seq) : 1);
    var D = near ? (near.Ds && near.largeAt === 'base' ? near.Ds : near.D) : 1500;
    var base = { id: id, type: type, name: TYPES[type], mat: { id: 'sa516', vi: 0 }, tn: 10, c: null, E: null, Ec: null };
    if (type === 'shell') return Object.assign(base, { D: D || 1500, basis: 'id', L: 3000, Lext: null, rn: 0, rh: 100, rb: 12, rside: 'ext', rmat: { id: 'sa516', vi: 0 } });
    if (type === 'ellip') return Object.assign(base, { D: D || 1500, ratio: 2, sf: 50, seamless: true });
    if (type === 'tori') return Object.assign(base, { D: D || 1500, Lc: null, rk: null, sf: 50, seamless: true });
    if (type === 'hemi') return Object.assign(base, { D: D || 1500, sf: 0, seamless: true });
    if (type === 'cone') return Object.assign(base, { D: D || 1500, Ds: Math.round((D || 1500) * 0.6), alpha: 30, largeAt: 'base', ringLh: 0, ringLb: 0, ringSh: 0, ringSb: 0 });
    if (type === 'flat') return Object.assign(base, { sk: 'efg', d: D || 1500, tn: 40, ts: null });
    if (type === 'bflange') return Object.assign(base, { mat: { id: 'sa105', vi: 0 }, ftype: 'integral', B: D || 1500, A: (D || 1500) + 250, C: (D || 1500) + 160,
      t: 80, g0: 10, g1: 25, h: 60, Go: (D || 1500) + 60, Gi: (D || 1500) + 20, b0mode: 'N2', w: 0, Tg: 0, m: 2.75, y: 25.5,
      bmat: { id: 'sa193b7', vi: 0 }, n: 44, a: 22.2, Ar: 270.3, bsize: '7/8', Gfix: 0, Ed: 0, Ea: 0 });
    return base;
  }
  function letterMark(k){ var t = ''; k++; while (k > 0){ var m = (k - 1) % 26; t = String.fromCharCode(65 + m) + t; k = Math.floor((k - 1) / 26); } return t; }
  function nextMark(prj){ var used = {}; prj.nozzles.forEach(function(n){ used[String(n.mark).toUpperCase()] = 1; }); for (var k = 0; ; k++){ var m = letterMark(k); if (!used[m]) return m; } }
  function newNozzle(prj){
    var id = 'N' + (++prj.nseq), mk = nextMark(prj);
    var host = prj.comps.filter(function(c){ return c.type === 'shell'; })[0] || prj.comps[0];
    return { id: id, mark: mk, service: '', host: host.id, a: 500, rad: 0, theta: 0, nps: '6', od: 168.3, tn: 7.11, pipe: true,
      mat: { id: 'sa106b', vi: 0 }, proj: 200, hin: 0, ti: 0, pad: false, Dp: 0, te: 0, pmat: { id: 'sa516', vi: 0 },
      leg41: 10, leg42: 10, leg43: 0, E1: 1, access: false, hor: 'axial', wtype: 'setin', tw: null, twp: null, ld: { F: 0, V: 0, M: 0, Mt: 0, kS: 1 }, elb: [{ ang: 0, rt: 'LR', phi: 0, L: 200 }, { ang: 0, rt: 'LR', phi: 0, L: 200 }],
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
    return { s: sIn, r: rr, ds: dir, dr: 0, L0: Math.abs(sEnd - sIn) + (n.hin || 0) + n.proj, cosb: Math.max(hs.Nq, 1e-3), Nq: hs.Nq, Nr: hs.Nr };
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

  // ---------------- boquillas ----------------
  function calcNozzle(prj, n, L, compRes){
    var d = prj.design, host = prj.comps.filter(function(c){ return c.id === n.host; })[0];
    var out = { n: n, ok: true, checks: [], sec: [] };
    if (!host){ out.err = 'Componente anfitrión no encontrado'; out.ok = false; return out; }
    var hr = compRes[host.id], T = d.T, cc = host.c != null ? +host.c : +d.c;
    var mv = hr.mat, mn = V.mat(n.mat, T), mp = n.pad ? V.mat(n.pmat, T) : null;
    if (!mn){ out.err = 'Material del cuello no definido'; out.ok = false; return out; }
    out.mn = mn; out.mp = mp;
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
    var ldn = n.ld || {};
    if ((+ldn.F || 0) || (+ldn.V || 0) || (+ldn.M || 0) || (+ldn.Mt || 0)){
      out.nl = C.nozzleLoads({ od: n.od, tn: n.tn, c: cc, P: P, Sn: mn.S, pipe: n.pipe, F: +ldn.F || 0, V: +ldn.V || 0, M: +ldn.M || 0, Mt: +ldn.Mt || 0, kS: +ldn.kS || 1 });
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
    var ug42 = multiOpenings(prj, L, nz);
    var out = { L: L, comps: list, byId: cr, nozzles: nz, warn: warn, mawp: mawp, mawpList: cand, map: mapc[0] || null, maep: maepc[0] || null,
      test: { PT: PT, PTbot: PTbot, lsr: lsr, lsrWho: lsrWho, basis: basisP, H: Htest }, mdmt: md[0] || null, mdmtList: md, impact: impact,
      mass: { empty: mE, oper: mE + Vin * (d.rho || 0), test: mE + Vin * 1000, vol: Vin }, ndt: nd, ug42: ug42 };
    // fase 3: cargas exteriores y soportes
    if (typeof VLOADS !== 'undefined'){
      try { out.loads = VLOADS.run(prj, out); } catch (e){ out.loads = { err: 'Error en cargas exteriores: ' + e.message, ok: false }; if (typeof console !== 'undefined') console.error(e); }
    }
    // uniones cono-cilindro (Ap. 1-5 y 1-8)
    prj.comps.forEach(function(c){ if (c.type === 'cone') coneJunctions(prj, c, out); });
    out.ok = list.every(function(r){ return r.ok; }) && nz.every(function(r){ return r.ok; }) && nd.req.every(function(q){ return q.ok || q.warn || q.info; }) && (!out.loads || out.loads.ok !== false);
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

  return { TYPES: TYPES, newProject: newProject, newComp: newComp, newNozzle: newNozzle, layout: layout, axLen: axLen, headDepth: headDepth,
    headProfile: headProfile, headSurfAt: headSurfAt, headNoz: headNoz, innerR: innerR, toriL: toriL, toriR: toriR, compute: compute, effFor: effFor, extLength: extLength, hyd: hyd };
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
      ? { type: 'saddle', A: 600, theta: 120, b: 200, welded: true, h: 1200, wear: false, twp: 0, bwp: 0, thwp: 0, wmat: { id: 'sa516', vi: 0 },
          tw: 12, tf: 12, Bb: 250, Lbp: null, tbp: 20, smat: { id: 'sa516', vi: 0 }, nbs: 2, eb: null, bsize: 'M24', Ar: 324.3, amat: { id: 'sa193b7', vi: 0 }, fc: 7 }
      : { type: 'skirt', H: 2000, t: 10, D: null, mat: { id: 'sa516', vi: 0 }, c: 0, leg: 8, Dbo: null, Dbi: null, tb: 25, bmat: { id: 'sa516', vi: 0 },
          nb: 8, BC: null, bsize: 'M24', Ar: 324.3, amat: { id: 'sa193b7', vi: 0 }, fc: 7,
          nl: 4, Hl: 1500, Dl: null, lsec: 'pipe', lod: 168.3, lt: 7.11, lA: 0, lI: 0, lZ: 0, lb: 0, lmat: { id: 'sa106b', vi: 0 }, K: 2.0, nbl: 2, lbsize: 'M20', lAr: 225.2,
          zLug: null, Hg: 3000, nlug: 4, Dlug: null, nbg: 2, gbsize: 'M20', gAr: 225.2 };
  }

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
    var sB = lugs ? (sp.zLug != null && sp.zLug !== '' ? +sp.zLug : (Lr.smin + Lr.smax) / 2) : supp ? sAtt : Lr.smin;
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
      var nl = Math.max(3, num(sp.nl, 4)), lm = V.mat(sp.lmat, 40);
      if (sp.lsec === 'user') LG = { A: num(sp.lA, 0), I: num(sp.lI, 0), Z: num(sp.lZ, 0), b: num(sp.lb, 100) };
      else { var lo = num(sp.lod, 168.3), li = lo - 2 * num(sp.lt, 7.11); LG = { A: Math.PI / 4 * (lo * lo - li * li), I: Math.PI / 64 * (Math.pow(lo, 4) - Math.pow(li, 4)), Z: (Math.pow(lo, 3) - Math.pow(li, 3)) / 6, b: lo }; }
      LG.r = Math.sqrt(LG.I / Math.max(LG.A, 1e-9)); LG.n = nl; LG.m = lm;
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
    st(r, 'T1 (servicio)', 'Rayleigh, voladizo empotrado en ' + (lugs ? 'las orejetas (apoyo rígido)' : legs ? 'la base de las patas (patas en voladizo, n·E·I)' : 'la base') + ', masas en servicio' + (ld.T > 0 ? ' — se usa T impuesto = ' + (+ld.T).toFixed(3) + ' s' : ''), pO.T, 'sec', 'EN 1998-1 4.3.3.2.2(5) / ASCE 7-16 15.4.4');
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
    st(r, 'Momento de viento en ' + (lugs ? 'las orejetas' : 'la base'), '', out.base.Mw, 'm');
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
    prj.comps.forEach(function(c){ if (c.type !== 'shell' && c.type !== 'cone') return; var p = Lr.pos[c.id]; if (lugs && p.s1 <= sB) return; if (lugs && p.s0 < sB){ secs.push({ s: sB + 1e-3, lbl: c.name + ' · sobre las orejetas', c: c }); secs.push({ s: p.s1 - 1e-3, lbl: c.name + ' · extremo superior', c: c }); return; } secs.push({ s: p.s0 + 1e-3, lbl: c.name + ' · extremo inferior', c: c }); secs.push({ s: p.s1 - 1e-3, lbl: c.name + ' · extremo superior', c: c }); });
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
      var lg = R(), nl2 = LG.n, Dl = sp.Dl > 0 ? +sp.Dl : shOD + LG.b, Fy = LG.m && LG.m.ty ? LG.m.ty[1] : 240, Es = 2e5, Kf = num(sp.K, 2.0);
      st(lg, 'Sección de pata', sp.lsec === 'user' ? 'definida por el usuario' : 'tubo ' + num(sp.lod, 0) + ' × ' + num(sp.lt, 0) + ' mm', LG.A, 'a');
      st(lg, 'r', '√(I/A)', LG.r, 'len'); st(lg, 'Fy', 'límite elástico a temperatura ambiente (II-D Tabla Y-1)', Fy, 's');
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
      out.legs = { r: lg, Dl: Dl, n: nl2, ok: !lg.checks.some(function(x){ return !x.ok && !x.warn && !x.info; }) };
      okAll = okAll && out.legs.ok;
    }
    if (lugs){
      var lu = R(), ng = Math.max(2, num(sp.nlug, 4)), Dg = sp.Dlug > 0 ? +sp.Dlug : shOD + 200, Qm = 0, Tm = 0;
      supCombos().forEach(function(c){ Qm = Math.max(Qm, c.W / ng + 4 * c.M / (ng * Dg)); Tm = Math.max(Tm, 4 * c.M / (ng * Dg) - c.Wmin / ng); });
      st(lu, 'Cota de apoyo', 'Z de las orejetas', sB, 'len');
      st(lu, 'Q por orejeta', 'W/n + 4·M/(n·Dg),  n = ' + ng + ', Dg = ' + Dg.toFixed(0) + ' mm', Qm, 'f', 'Bednar / Moss');
      st(lu, 'Tracción por orejeta', '4·M/(n·Dg) − Wmín/n', Tm, 'f');
      if (Tm > 0){ var amG = V.mat(sp.amat, 40), reqG = Tm / num(sp.nbg, 2) / (amG ? amG.Sa : 138); ck(lu, 'Pernos de orejeta: ' + num(sp.gAr, 0).toFixed(0) + ' mm² ≥ ' + reqG.toFixed(0) + ' mm²', num(sp.gAr, 0) >= reqG - 1e-9); }
      else ck(lu, 'Sin tracción en las orejetas', true);
      note(lu, 'Diseño de la orejeta (placa, cartelas) y tensiones locales en la virola (WRC 107/537): no incluidos; usar Q como carga de diseño.');
      out.lugs = { r: lu, Q: Qm, ok: !lu.checks.some(function(x){ return !x.ok && !x.warn && !x.info; }) };
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
    var wear = sp.wear ? { tr: num(sp.twp, 0), b1: num(sp.bwp, 0), th1: num(sp.thwp, 0), S: (V.mat(sp.wmat, d.T) || ms).S } : null;
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
    var cs3 = R(), smt = V.mat(sp.smat, 40), Sy = smt && smt.ty ? smt.ty[1] : 240, Ss = smt ? smt.Sa : 138;
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

  return { run: run, defaults: defaults, defSupport: defSupport, FAM: FAM, zick: zick, secStress: secStress, qpEN: qpEN, cfEN: cfEN, qzASCE: qzASCE, cfASCE: cfASCE, sdEN: sdEN, csASCE: csASCE, Bcomp: Bcomp, parseExtra: parseExtra };
})();


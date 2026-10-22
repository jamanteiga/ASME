/* Interfaz del programa de cálculo de recipientes ASME VIII-1 */
(function(){
  'use strict';
  var M = VMODEL, V = VESSEL, C = VIII, MATS = window.ASME_MATERIALS;
  var units = 'si';
  try { if (localStorage.getItem('asme-units') === 'us') units = 'us'; } catch (e) {}
  function deep(dst, src){ Object.keys(src).forEach(function(k){ var v = src[k]; if (v && typeof v === 'object' && !Array.isArray(v)){ if (!dst[k] || typeof dst[k] !== 'object') dst[k] = {}; deep(dst[k], v); } else if (dst[k] === undefined) dst[k] = v; }); return dst; }
  function ensure(p){
    if (!p) return p;
    p.loads = deep(p.loads || {}, VLOADS.defaults());
    var wantH = p.design.orient === 'H', isH = p.support && (p.support.type === 'saddle' || p.support.A != null);
    if (!p.support || wantH !== !!isH) p.support = VLOADS.defSupport(p.design.orient); else deep(p.support, VLOADS.defSupport(p.design.orient));
    var used = {}; p.nozzles.forEach(function(n){ if (!/^N\d+$/.test(n.mark)) used[n.mark] = 1; }); var li = 0; function nl(){ var t; do { var k = li++, m = ''; k++; while (k > 0){ var q = (k - 1) % 26; m = String.fromCharCode(65 + q) + m; k = Math.floor((k - 1) / 26); } t = m; } while (used[t]); used[t] = 1; return t; }
    p.nozzles.forEach(function(n){ if (/^N\d+$/.test(n.mark) && n.mark === n.id) n.mark = nl();
      if (!n.wtype) n.wtype = 'setin'; if (!n.hor) n.hor = 'axial'; if (!n.ld) n.ld = { F: 0, V: 0, M: 0, Mt: 0, kS: 1 }; if (!n.elb) n.elb = [{ ang: 0, rt: 'LR', phi: 0, L: 200 }, { ang: 0, rt: 'LR', phi: 0, L: 200 }]; });
    return p;
  }
  var prj = ensure(load()) || M.newProject('V');
  var sel = { kind: 'design', id: null };
  var res = null;

  // ---------------- unidades ----------------
  var UN = {
    len:  { si: ['mm', 1], us: ['in', 1 / 25.4] },
    p:    { si: ['MPa', 1], us: ['psi', 145.0377] },
    s:    { si: ['MPa', 1], us: ['ksi', 0.1450377] },
    f:    { si: ['kN', 1e-3], us: ['lbf', 0.2248089] },
    m:    { si: ['kN·m', 1e-6], us: ['lbf·in', 0.0088507] },
    a:    { si: ['mm²', 1], us: ['in²', 1 / 645.16] },
    rho:  { si: ['kg/m³', 1], us: ['lb/ft³', 0.0624280] },
    mod:  { si: ['MPa', 1], us: ['psi', 145.0377] },
    kg:   { si: ['kg', 1], us: ['lb', 2.2046226] },
    m3:   { si: ['m³', 1], us: ['ft³', 35.314667] },
    dt:   { si: ['°C', 1], us: ['°F', 1.8] },
    ms:   { si: ['m/s', 1], us: ['mph', 2.236936] },
    pa:   { si: ['N/m²', 1], us: ['psf', 0.0208854] },
    acc:  { si: ['m/s²', 1], us: ['ft/s²', 3.280840] },
    sec:  { si: ['s', 1], us: ['s', 1] },
    i4:   { si: ['cm⁴', 1e-4], us: ['in⁴', 1 / 416231.4] },
    fl:   { si: ['N/mm', 1], us: ['lb/in', 5.710147] },
    a2:   { si: ['m²', 1], us: ['ft²', 10.76391] },
    t:    { si: ['°C'], us: ['°F'] }
  };
  function uLbl(u){ return UN[u] ? UN[u][units][0] : ''; }
  function toU(v, u){ if (v == null || v === '' || isNaN(v)) return v; if (u === 't') return units === 'us' ? v * 9 / 5 + 32 : v; return UN[u] ? v * UN[u][units][1] : v; }
  function fromU(v, u){ if (v === '' || v == null || isNaN(v)) return v; if (u === 't') return units === 'us' ? (v - 32) * 5 / 9 : v; return UN[u] ? v / UN[u][units][1] : v; }
  function fx(v, d){ return (Math.round(v * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d).replace('.', ','); }
  function fmt(v, u){
    if (v == null || v === '' || (typeof v === 'number' && isNaN(v))) return '–';
    if (typeof v === 'string') return v;
    var x = toU(v, u), a = Math.abs(x), d;
    if (u === 'len') d = units === 'us' ? 3 : (a < 10 ? 2 : 1);
    else if (u === 'p') d = units === 'us' ? 1 : 3;
    else if (u === 's') d = units === 'us' ? 2 : 1;
    else if (u === 'f' || u === 'm') d = units === 'us' ? 0 : 2;
    else if (u === 'a') d = units === 'us' ? 3 : (a < 100 ? 1 : 0);
    else if (u === 't' || u === 'dt') d = 0;
    else if (u === 'kg') d = 0;
    else if (u === 'm3') d = 2;
    else if (u === 'sec') d = 3;
    else if (u === 'ms' || u === 'acc') d = 2;
    else if (u === 'pa') d = units === 'us' ? 1 : 0;
    else if (u === 'i4') d = 1;
    else if (u === 'fl') d = 1;
    else d = a >= 1000 ? 0 : a >= 10 ? 2 : a >= 0.01 ? 4 : 6;
    if (!u && a > 0 && a < 1e-3) return x.toExponential(3).replace('.', ',');
    return fx(x, d) + (uLbl(u) ? ' ' + uLbl(u) : '');
  }
  function inVal(v, u){ if (v == null || v === '') return ''; var x = toU(+v, u); return String(Math.round(x * 10000) / 10000); }
  C.setFmt({ s: function(x){ return fmt(x, 's'); }, len: function(x){ return fmt(x, 'len'); } });
  function esc(s){ return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }

  // ---------------- persistencia ----------------
  function save(){ try { localStorage.setItem('asme-vessel', JSON.stringify(prj)); } catch (e) {} }
  function load(){ try { var s = localStorage.getItem('asme-vessel'); return s ? JSON.parse(s) : null; } catch (e) { return null; } }

  // ---------------- datos auxiliares ----------------
  var GASKETS = [
    ['', 'Personalizado', null, null],
    ['O', 'Autoenergizante (junta tórica, metálica…)', 0, 0],
    ['E1', 'Elastómero < 75A Shore', 0.50, 0], ['E2', 'Elastómero ≥ 75A Shore', 1.00, 1.4],
    ['F3', 'Fibra mineral con aglomerante, 3,2 mm', 2.00, 11], ['F2', 'Fibra mineral con aglomerante, 1,6 mm', 2.75, 26], ['F1', 'Fibra mineral con aglomerante, 0,8 mm', 3.50, 45],
    ['EC', 'Elastómero con inserción de algodón', 1.25, 2.8],
    ['EM3', 'Elastómero con tejido de fibra mineral, 3 capas', 2.25, 15], ['EM2', 'Ídem, 2 capas', 2.50, 20], ['EM1', 'Ídem, 1 capa', 2.75, 26],
    ['VF', 'Fibra vegetal', 1.75, 7.6],
    ['SWC', 'Espirometálica con relleno mineral, acero al carbono', 2.50, 69], ['SWS', 'Espirometálica con relleno mineral, inox / Monel / Ni', 3.00, 69],
    ['CJ1', 'Metal corrugado con relleno o encamisado: aluminio blando', 2.50, 20], ['CJ2', 'Ídem: cobre o latón blando', 2.75, 26], ['CJ3', 'Ídem: hierro o acero dulce', 3.00, 31], ['CJ4', 'Ídem: Monel o 4–6 % Cr', 3.25, 38], ['CJ5', 'Ídem: inox y aleaciones de Ni', 3.50, 45],
    ['CM1', 'Metal corrugado: aluminio blando', 2.75, 26], ['CM2', 'Metal corrugado: cobre o latón', 3.00, 31], ['CM3', 'Metal corrugado: hierro o acero dulce', 3.25, 38], ['CM4', 'Metal corrugado: Monel o 4–6 % Cr', 3.50, 45], ['CM5', 'Metal corrugado: inox y aleaciones de Ni', 3.75, 52],
    ['FJ1', 'Metálica plana encamisada (relleno mineral): aluminio', 3.25, 38], ['FJ2', 'Ídem: cobre o latón', 3.50, 45], ['FJ3', 'Ídem: hierro o acero dulce', 3.75, 52], ['FJ4', 'Ídem: Monel', 3.50, 55], ['FJ5', 'Ídem: 4–6 % Cr', 3.75, 62], ['FJ6', 'Ídem: inox y aleaciones de Ni', 3.75, 62],
    ['GM1', 'Metal ranurado: aluminio', 3.25, 38], ['GM2', 'Metal ranurado: cobre o latón', 3.50, 45], ['GM3', 'Metal ranurado: hierro o acero dulce', 3.75, 52], ['GM4', 'Metal ranurado: Monel o 4–6 % Cr', 3.75, 62], ['GM5', 'Metal ranurado: inox y aleaciones de Ni', 4.25, 70],
    ['SM1', 'Metal macizo plano: aluminio', 4.00, 61], ['SM2', 'Metal macizo plano: cobre o latón', 4.75, 90], ['SM3', 'Metal macizo plano: hierro o acero dulce', 5.50, 124], ['SM4', 'Metal macizo plano: Monel o 4–6 % Cr', 6.00, 150], ['SM5', 'Metal macizo plano: inox y aleaciones de Ni', 6.50, 180],
    ['RJ1', 'Junta de anillo (RTJ): hierro o acero dulce', 5.50, 124], ['RJ2', 'RTJ: Monel o 4–6 % Cr', 6.00, 150], ['RJ3', 'RTJ: inox y aleaciones de Ni', 6.50, 180]
  ];
  // Área de raíz de pernos (no la da VIII-1): UNC/8UN con dr = d − 1,2990·p (criterio TEMA, Tabla D-5); métricos ISO con d3 = d − 1,2269·P (ISO 724)
  function frac(t){ return t.split(' ').reduce(function(a, p){ var q = p.split('/'); return a + (q.length > 1 ? +q[0] / +q[1] : +q[0]); }, 0); }
  var BOLTS = [['1/2', 13], ['5/8', 11], ['3/4', 10], ['7/8', 9], ['1', 8], ['1 1/8', 8], ['1 1/4', 8], ['1 3/8', 8], ['1 1/2', 8], ['1 5/8', 8], ['1 3/4', 8], ['1 7/8', 8], ['2', 8],
    ['2 1/4', 8], ['2 1/2', 8], ['2 3/4', 8], ['3', 8], ['3 1/4', 8], ['3 1/2', 8], ['3 3/4', 8], ['4', 8]].map(function(b){ var d = frac(b[0]) * 25.4, p = 25.4 / b[1], dr = d - 1.299038 * p;
      return [b[0], d, Math.PI / 4 * dr * dr, b[0] + '" ' + (frac(b[0]) > 1 ? '8UN' : 'UNC') + '-' + b[1]]; })
    .concat([[12, 1.75], [16, 2], [20, 2.5], [24, 3], [27, 3], [30, 3.5], [33, 3.5], [36, 4], [39, 4], [42, 4.5], [45, 4.5], [48, 5], [52, 5], [56, 5.5], [60, 5.5], [64, 6], [72, 6], [80, 6], [90, 6], [100, 6]]
      .map(function(b){ var d3 = b[0] - 1.226869 * b[1]; return ['M' + b[0], b[0], Math.PI / 4 * d3 * d3, 'M' + b[0] + '×' + String(b[1]).replace('.', ',')]; }));
  function boltOpts(){ return [['', 'Otra (introducir a y área)']].concat(BOLTS.map(function(b){ return [b[0], b[3] + ' · Ar = ' + fx(b[2], 1) + ' mm²']; })); }
  // Juntas espirometálicas ASME B16.20 (Tablas 9, 10 y 11): D.I. y D.E. del elemento de estanqueidad
  var NB = window.ASME_NORMAS.B1620 || null;
  function gasketOpts(){
    var o = [['', '— elegir para rellenar D.E./D.I. de contacto —']];
    if (!NB) return o;
    Object.keys(NB.b165).forEach(function(n){ [150, 300, 400, 600, 900, 1500, 2500].forEach(function(c){ var g = NB.b165[n]; if (g.id[c] != null) o.push(['9|' + n + '|' + c, 'B16.5 NPS ' + n + ' clase ' + c + ' · ' + g.id[c] + ' / ' + g.od[c] + ' mm']); }); });
    ['A', 'B'].forEach(function(se){ Object.keys(NB[se]).forEach(function(n){ Object.keys(NB[se][n]).forEach(function(c){ var g = NB[se][n][c]; o.push([se + '|' + n + '|' + c, 'B16.47 serie ' + se + ' NPS ' + n + ' clase ' + c + ' · ' + g[0] + ' / ' + g[1] + ' mm']); }); }); });
    return o;
  }
  var B0 = [['N2', '(1a)(1b) N/2'], ['wT', '(1c)(1d) mín[(w+T)/2 ; (w+N)/4]'], ['wN4', '(2) columna I: (w+N)/4'], ['w3N8', '(2) columna II: (w+3N)/8'],
    ['N4', '(3)(5) columna I: N/4'], ['3N8', '(3)(5) col. II / (4) col. I: 3N/8'], ['7N16', '(4) columna II: 7N/16'], ['w8', '(6) junta de anillo: w/8']];
  var PIPE_OD = { '1/2': 21.3, '3/4': 26.7, '1': 33.4, '1 1/4': 42.2, '1 1/2': 48.3, '2': 60.3, '2 1/2': 73.0, '3': 88.9, '3 1/2': 101.6, '4': 114.3, '5': 141.3, '6': 168.3,
    '8': 219.1, '10': 273.0, '12': 323.8, '14': 355.6, '16': 406.4, '18': 457.0, '20': 508.0, '24': 610.0 };

  // ---------------- formularios ----------------
  function matOptions(filter, cur){
    var cats = { plancha: 'Plancha', tubo: 'Tubo', forja: 'Forja', fittings: 'Accesorios', fundicion: 'Fundiciones', pernos: 'Pernos', noferrosos: 'No ferrosos' };
    var html = '';
    Object.keys(cats).forEach(function(k){
      var list = MATS.filter(function(m){ return m.cat === k && filter(m); });
      if (!list.length) return;
      html += '<optgroup label="' + cats[k] + '">' + list.map(function(m){ return '<option value="' + m.id + '"' + (m.id === cur ? ' selected' : '') + '>' + esc(m.t) + '</option>'; }).join('') + '</optgroup>';
    });
    return html;
  }
  function F(o){ return o; }
  // tipos: num (u), txt, sel (opts), chk, mat (filtro), h (subtítulo), info (html)
  function fieldHtml(obj, f){
    if (f.t === 'h') return '<div class="f-h">' + esc(f.l) + '</div>';
    if (f.t === 'info') return '<div class="f-info">' + f.html + '</div>';
    var v = getp(obj, f.k), id = 'f_' + f.k.replace(/\./g, '_');
    var lab = '<label for="' + id + '">' + esc(f.l) + (f.u ? ' <span>(' + uLbl(f.u) + ')</span>' : '') + '</label>';
    if (f.t === 'chk') return '<div class="fld chk"><input type="checkbox" id="' + id + '" data-k="' + f.k + '" data-t="chk"' + (v ? ' checked' : '') + (f.re ? ' data-re="1"' : '') + '><label for="' + id + '">' + esc(f.l) + '</label></div>';
    if (f.t === 'sel') return '<div class="fld">' + lab + '<select id="' + id + '" data-k="' + f.k + '" data-t="sel"' + (f.re ? ' data-re="1"' : '') + '>' +
      f.o.map(function(o){ return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(v) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></div>';
    if (f.t === 'txt') return '<div class="fld">' + lab + '<input type="text" id="' + id + '" data-k="' + f.k + '" data-t="txt" value="' + esc(v) + '"></div>';
    if (f.t === 'area') return '<div class="fld wide">' + lab + '<textarea id="' + id + '" data-k="' + f.k + '" data-t="txt" rows="' + (f.rows || 4) + '" placeholder="' + esc(f.ph || '') + '">' + esc(v) + '</textarea>' + (f.note ? '<div class="f-note">' + f.note + '</div>' : '') + '</div>';
    if (f.t === 'mat'){
      var m = V.BYID[v && v.id] || MATS[0], vi = (v && v.vi) || 0;
      var mi = V.mat({ id: m.id, vi: vi }, prj.design.T);
      var vsel = m.v.length > 1 ? '<select data-k="' + f.k + '.vi" data-t="seln" data-re="1">' + m.v.map(function(x, i){ return '<option value="' + i + '"' + (i === vi ? ' selected' : '') + '>' + esc(x.l) + '</option>'; }).join('') + '</select>' : '';
      var info = mi ? 'S(T) = ' + (mi.over ? 'T > ' + fmt(mi.tm, 't') : fmt(mi.S, 's')) + ' · S(amb.) = ' + fmt(mi.Sa, 's') + ' · ' + esc(mi.ref) + (mi.ch ? ' · carta ' + mi.ch : '') + (mi.grp ? ' · B16.5 grupo ' + mi.grp : '') : '';
      return '<div class="fld wide">' + lab + '<select id="' + id + '" data-k="' + f.k + '.id" data-t="matid" data-re="1">' + matOptions(f.filter || function(){ return true; }, m.id) + '</select>' + vsel +
        '<div class="f-note">' + info + '</div></div>';
    }
    var ph = f.ph ? ' placeholder="' + esc(f.ph) + '"' : '';
    return '<div class="fld">' + lab + '<input type="number" step="any" id="' + id + '" data-k="' + f.k + '" data-t="num" data-u="' + (f.u || '') + '"' + (f.re ? ' data-re="1"' : '') + ' value="' + inVal(v, f.u) + '"' + ph + '></div>';
  }
  function getp(o, k){ return k.split('.').reduce(function(a, b){ return a == null ? a : a[b]; }, o); }
  function setp(o, k, v){ var p = k.split('.'), l = p.pop(); var t = p.reduce(function(a, b){ if (a[b] == null) a[b] = {}; return a[b]; }, o); t[l] = v; }

  var notBolt = function(m){ return m.cat !== 'pernos' && !(m.sub === 'Pernos no ferrosos'); };
  var isBolt = function(m){ return m.cat === 'pernos' || m.sub === 'Pernos no ferrosos'; };
  var isForge = function(m){ return m.cat === 'forja' || m.cat === 'fundicion' || m.cat === 'plancha' || m.cat === 'noferrosos' && !isBolt(m); };
  var isPipe = function(m){ return m.cat === 'tubo' || m.cat === 'forja' || m.cat === 'fittings' || (m.cat === 'noferrosos' && !isBolt(m)); };

  function designFields(){
    var d = prj.design, H = d.orient === 'H';
    return [
      { t: 'h', l: 'Identificación' },
      { t: 'txt', k: 'info.proyecto', l: 'Proyecto' }, { t: 'txt', k: 'info.equipo', l: 'Equipo' }, { t: 'txt', k: 'info.tag', l: 'TAG' },
      { t: 'txt', k: 'info.cliente', l: 'Cliente' }, { t: 'txt', k: 'info.autor', l: 'Calculado por' }, { t: 'txt', k: 'info.rev', l: 'Revisión' },
      { t: 'h', l: 'Disposición' },
      { t: 'sel', k: 'design.orient', l: 'Orientación', o: [['V', 'Vertical (eje Z, origen en el centro inferior de la primera virola)'], ['H', 'Horizontal (eje X, origen en el centro del extremo de la primera virola)']], re: 1 },
      H ? { t: 'sel', k: 'design.hdir', l: 'Sentido de la primera virola', o: [['R', 'Hacia la derecha (+X)'], ['L', 'Hacia la izquierda (−X)']], re: 1 } : null,
      { t: 'h', l: 'Condiciones de diseño' },
      { t: 'num', k: 'design.P', l: 'Presión interior de diseño P (en la parte superior)', u: 'p' },
      { t: 'num', k: 'design.T', l: 'Temperatura de diseño', u: 't', re: 1 },
      { t: 'num', k: 'design.Pext', l: 'Presión exterior de diseño (0 = sin vacío)', u: 'p' },
      { t: 'num', k: 'design.c', l: 'Sobreespesor de corrosión general', u: 'len' },
      { t: 'num', k: 'design.MDMT', l: 'MDMT requerida', u: 't' },
      { t: 'h', l: 'Fluido' },
      { t: 'txt', k: 'design.fluid', l: 'Fluido' }, { t: 'num', k: 'design.rho', l: 'Densidad', u: 'rho' },
      { t: 'num', k: 'design.level', l: H ? 'Altura de líquido sobre el fondo (vacío = lleno)' : 'Cota Z de la superficie del líquido (vacío = lleno)', u: 'len', ph: 'lleno' },
      { t: 'chk', k: 'design.lethal', l: 'Servicio letal (UW-2(a))' },
      { t: 'h', l: 'Soldadura, END y tratamiento térmico' },
      { t: 'sel', k: 'design.rt', l: 'Designación radiográfica', o: [['RT-1', 'RT-1: RT total de todas las soldaduras a tope (UW-11(a))'], ['RT-2', 'RT-2: RT total cat. A + puntos cat. B (UW-11(a)(5)(-b))'], ['RT-3', 'RT-3: RT por puntos (UW-11(b))'], ['RT-4', 'RT-4: sin RT / parcial (UW-11(c))']] },
      { t: 'sel', k: 'design.jt', l: 'Tipo de junta a tope (Tabla UW-12)', o: [['1', 'Tipo 1: doble cordón o equivalente'], ['2', 'Tipo 2: un cordón con respaldo']] },
      { t: 'chk', k: 'design.ndt.VT', l: 'VT · examen visual' }, { t: 'chk', k: 'design.ndt.RT', l: 'RT · radiografía' }, { t: 'chk', k: 'design.ndt.UT', l: 'UT · ultrasonidos (UW-51(a)(4))' },
      { t: 'chk', k: 'design.ndt.MT', l: 'MT · partículas magnéticas' }, { t: 'chk', k: 'design.ndt.PT', l: 'LP · líquidos penetrantes' },
      { t: 'chk', k: 'design.pwht', l: 'TTPS realizado' }, { t: 'chk', k: 'design.pwhtVol', l: 'TTPS no exigido por el código (reduce MDMT 17 °C, UCS-68(c))' },
      { t: 'chk', k: 'design.normalized', l: 'Chapas SA-516 normalizadas (curva D)' },
      { t: 'chk', k: 'design.ug20f', l: 'Se cumplen las condiciones de UG-20(f) (sin choque térmico ni cíclico, prueba hidrostática)' },
      { t: 'h', l: 'Prueba hidrostática (UG-99)' },
      d.orient === 'V' ? { t: 'sel', k: 'design.testPos', l: 'Posición de prueba', o: [['oper', 'Vertical (posición de servicio)'], ['H', 'Horizontal (taller)']] } : null,
      { t: 'chk', k: 'design.testUseP', l: 'Usar la presión de diseño en lugar de la MAWP (nota 36 de UG-99)' }
    ].filter(Boolean);
  }
  function loadsFields(){
    var L = prj.loads, H = prj.design.orient === 'H', EN = L.code !== 'ASCE', fam = VLOADS.FAM[L.code] || VLOADS.FAM.EN, sp = prj.support || {};
    var CATS = [['0', '0 · mar o costa expuesta'], ['I', 'I · lagos o llano sin obstáculos'], ['II', 'II · vegetación baja, obstáculos aislados'], ['III', 'III · zona urbana, industrial o forestal'], ['IV', 'IV · urbana con edificios > 15 m']];
    var ROUGH = [['0.002', 'Metal pulido · 0,002 mm'], ['0.006', 'Pintura fina · 0,006 mm'], ['0.05', 'Pintura proyectada / acero brillante · 0,05 mm'], ['0.2', 'Acero galvanizado / fundición · 0,2 mm'], ['1', 'Hormigón rugoso · 1 mm'], ['2', 'Óxido · 2 mm']];
    var f = [
      { t: 'h', l: 'Normativa' },
      { t: 'sel', k: 'loads.code', l: 'Viento y sismo según', o: [['EN', 'EN 1991-1-4 + AN España (CTE DB SE-AE) y EN 1998-1'], ['ASCE', 'ASCE 7-16 (cap. 26–29 y 15)']], re: 1 },
      { t: 'chk', k: 'loads.windOn', l: 'Considerar viento', re: 1 }, { t: 'chk', k: 'loads.seisOn', l: 'Considerar sismo', re: 1 },
      { t: 'info', html: 'Combinaciones: ' + esc(fam.txt) + '.' }
    ];
    if (L.windOn){
      if (EN) f = f.concat([{ t: 'h', l: 'Viento · EN 1991-1-4' },
        { t: 'num', k: 'loads.en.vb', l: 'Velocidad básica vb (CTE: zona A 26, B 27, C 29 m/s)', u: 'ms' },
        { t: 'sel', k: 'loads.en.cat', l: 'Categoría de terreno (Tabla 4.1)', o: CATS },
        { t: 'num', k: 'loads.en.c0', l: 'Factor de orografía c0' }, { t: 'num', k: 'loads.en.cscd', l: 'Factor estructural cs·cd' },
        { t: 'sel', k: 'loads.en.k', l: 'Rugosidad equivalente k (Tabla 7.13)', o: ROUGH },
        { t: 'num', k: 'loads.en.psi', l: 'ψλ impuesto (vacío = Fig. 7.36)', ph: 'auto' }, { t: 'num', k: 'loads.en.cfx', l: 'cf de áreas adicionales (plataformas)' }]);
      else f = f.concat([{ t: 'h', l: 'Viento · ASCE 7-16' },
        { t: 'num', k: 'loads.asce.V', l: 'Velocidad básica V (3 s, mapas cap. 26)', u: 'ms' },
        { t: 'sel', k: 'loads.asce.exp', l: 'Exposición', o: [['B', 'B'], ['C', 'C'], ['D', 'D']] },
        { t: 'num', k: 'loads.asce.Kzt', l: 'Kzt (topografía)' }, { t: 'num', k: 'loads.asce.Kd', l: 'Kd (0,95 depósitos redondos)' }, { t: 'num', k: 'loads.asce.Ke', l: 'Ke (cota del terreno)' },
        { t: 'num', k: 'loads.asce.G', l: 'G (0,85 rígido)' },
        { t: 'sel', k: 'loads.asce.surf', l: 'Superficie (Fig. 29.4-1)', o: [['ms', 'Moderadamente lisa'], ['r', 'Rugosa (D′/D = 0,02)'], ['vr', 'Muy rugosa (D′/D = 0,08)']] }]);
    }
    if (L.seisOn){
      if (EN) f = f.concat([{ t: 'h', l: 'Sismo · EN 1998-1' },
        { t: 'num', k: 'loads.en8.ag', l: 'ag / g (en España: ab·ρ de NCSE-02 o AN)' }, { t: 'num', k: 'loads.en8.gI', l: 'Factor de importancia γI' },
        { t: 'sel', k: 'loads.en8.soil', l: 'Tipo de terreno', o: [['A', 'A'], ['B', 'B'], ['C', 'C'], ['D', 'D'], ['E', 'E']] },
        { t: 'sel', k: 'loads.en8.type', l: 'Espectro', o: [['1', 'Tipo 1 (Ms > 5,5)'], ['2', 'Tipo 2 (Ms ≤ 5,5)']] },
        { t: 'num', k: 'loads.en8.q', l: 'Coeficiente de comportamiento q (1,5 recomendado)' }]);
      else f = f.concat([{ t: 'h', l: 'Sismo · ASCE 7-16' },
        { t: 'num', k: 'loads.asce7.SDS', l: 'SDS (g)' }, { t: 'num', k: 'loads.asce7.SD1', l: 'SD1 (g)' }, { t: 'num', k: 'loads.asce7.S1', l: 'S1 (g)' },
        { t: 'num', k: 'loads.asce7.TL', l: 'TL (s)' }, { t: 'num', k: 'loads.asce7.Ie', l: 'Ie' },
        { t: 'num', k: 'loads.asce7.R', l: 'R (Tabla 15.4-2: faldón soldado 2 ó 3; cunas 3)' }]);
      f.push({ t: 'num', k: 'loads.T', l: 'Periodo impuesto (vacío = Rayleigh' + (H ? '; horizontal: meseta/rígido' : '') + ')', u: 'sec', ph: 'auto' });
    }
    f = f.concat([{ t: 'h', l: 'Aislamiento y accesorios' },
      { t: 'num', k: 'loads.ins.t', l: 'Espesor de aislamiento', u: 'len' }, { t: 'num', k: 'loads.ins.rho', l: 'Densidad del aislamiento', u: 'rho' },
      { t: 'num', k: 'loads.dExtra', l: 'Aumento del diámetro expuesto al viento (escaleras, tuberías)', u: 'len' },
      { t: 'area', k: 'loads.extra', l: 'Cargas adicionales: una por línea «' + (H ? 'X' : 'Z') + ' (mm) ; masa (kg) ; área al viento (m²) ; descripción»', ph: '8000 ; 350 ; 1,2 ; plataforma', rows: 3 },
      { t: 'h', l: 'Factores de combinación (vacío = valores de la normativa)' },
      { t: 'num', k: 'loads.fp', l: 'Factor de presión con W/E', ph: String(fam.fp) }, { t: 'num', k: 'loads.fw', l: 'Factor de viento', ph: String(fam.fw) },
      { t: 'num', k: 'loads.fe', l: 'Factor de sismo', ph: String(fam.fe) }, { t: 'num', k: 'loads.fd', l: 'Factor de peso favorable (vuelco)', ph: String(fam.fd) },
      { t: 'num', k: 'loads.kS', l: 'Multiplicador de S con W/E (UG-23(d): hasta 1,2)', ph: String(fam.kS) }]);
    if (!H){
      f = f.concat([{ t: 'h', l: 'Soporte' }, { t: 'sel', k: 'support.type', l: 'Tipo', o: [['skirt', 'Faldón cilíndrico'], ['legs', 'Patas'], ['lugs', 'Orejetas (apoyo en estructura)'], ['none', 'Sin soporte (empotrado en el fondo inferior)']], re: 1 }]);
      if (sp.type === 'legs') f = f.concat([
        { t: 'num', k: 'support.nl', l: 'Número de patas' }, { t: 'num', k: 'support.Hl', l: 'Longitud de las patas (base → línea de tangencia)', u: 'len' },
        { t: 'num', k: 'support.Dl', l: 'Diámetro del círculo de patas (vacío = D.E. + ancho de pata)', u: 'len', ph: 'auto' },
        { t: 'sel', k: 'support.lsec', l: 'Sección', o: [['pipe', 'Tubo'], ['user', 'Perfil definido por el usuario']], re: 1 },
        sp.lsec !== 'user' ? { t: 'num', k: 'support.lod', l: 'D.E. del tubo', u: 'len' } : null, sp.lsec !== 'user' ? { t: 'num', k: 'support.lt', l: 'Espesor del tubo', u: 'len' } : null,
        sp.lsec === 'user' ? { t: 'num', k: 'support.lA', l: 'Área A', u: 'a' } : null, sp.lsec === 'user' ? { t: 'num', k: 'support.lI', l: 'Inercia mínima I (mm⁴)' } : null,
        sp.lsec === 'user' ? { t: 'num', k: 'support.lZ', l: 'Módulo plástico Z (mm³)' } : null, sp.lsec === 'user' ? { t: 'num', k: 'support.lb', l: 'Ancho expuesto al viento', u: 'len' } : null,
        { t: 'num', k: 'support.K', l: 'Factor de longitud efectiva K (2,0 voladizo)' }, { t: 'mat', k: 'support.lmat', l: 'Material de las patas', filter: notBolt },
        { t: 'num', k: 'support.nbl', l: 'Pernos de anclaje por pata' }, { t: 'sel', k: 'support.lbsize', l: 'Tamaño del perno', o: boltOpts(), re: 1 }, { t: 'num', k: 'support.lAr', l: 'Área de raíz por perno', u: 'a' },
        { t: 'mat', k: 'support.amat', l: 'Material de los pernos', filter: isBolt }].filter(Boolean));
      if (sp.type === 'lugs') f = f.concat([
        { t: 'num', k: 'support.zLug', l: 'Cota Z del apoyo de las orejetas (vacío = mitad de altura)', u: 'len', ph: 'auto' },
        { t: 'num', k: 'support.Hg', l: 'Altura del apoyo sobre el terreno', u: 'len' }, { t: 'num', k: 'support.nlug', l: 'Número de orejetas' },
        { t: 'num', k: 'support.Dlug', l: 'Diámetro del círculo de apoyo (vacío = D.E. + 200)', u: 'len', ph: 'auto' },
        { t: 'num', k: 'support.nbg', l: 'Pernos por orejeta' }, { t: 'sel', k: 'support.gbsize', l: 'Tamaño del perno', o: boltOpts(), re: 1 }, { t: 'num', k: 'support.gAr', l: 'Área de raíz por perno', u: 'a' },
        { t: 'mat', k: 'support.amat', l: 'Material de los pernos', filter: isBolt }]);
      if (sp.type === 'skirt') f = f.concat([
        { t: 'num', k: 'support.H', l: 'Altura del faldón (base → línea de tangencia)', u: 'len' }, { t: 'num', k: 'support.t', l: 'Espesor del faldón', u: 'len' },
        { t: 'num', k: 'support.D', l: 'D.E. del faldón (vacío = D.E. de la virola)', u: 'len', ph: 'auto' }, { t: 'num', k: 'support.c', l: 'Corrosión del faldón', u: 'len' },
        { t: 'mat', k: 'support.mat', l: 'Material del faldón', filter: notBolt },
        { t: 'num', k: 'support.leg', l: 'Cateto de la soldadura faldón-fondo', u: 'len' },
        { t: 'h', l: 'Anillo base y pernos de anclaje' },
        { t: 'num', k: 'support.Dbo', l: 'D.E. del anillo base (vacío = BC + 100)', u: 'len', ph: 'auto' }, { t: 'num', k: 'support.Dbi', l: 'D.I. del anillo base (vacío = auto)', u: 'len', ph: 'auto' },
        { t: 'num', k: 'support.tb', l: 'Espesor del anillo base', u: 'len' }, { t: 'mat', k: 'support.bmat', l: 'Material del anillo base', filter: notBolt },
        { t: 'num', k: 'support.nb', l: 'Número de pernos de anclaje' }, { t: 'num', k: 'support.BC', l: 'Diámetro del círculo de pernos (vacío = D faldón + 150)', u: 'len', ph: 'auto' },
        { t: 'sel', k: 'support.bsize', l: 'Tamaño del perno', o: boltOpts(), re: 1 }, { t: 'num', k: 'support.Ar', l: 'Área de raíz por perno', u: 'a' },
        { t: 'mat', k: 'support.amat', l: 'Material de los pernos de anclaje', filter: isBolt },
        { t: 'num', k: 'support.fc', l: 'Presión admisible sobre el hormigón', u: 'p' }]);
    } else {
      f = f.concat([{ t: 'h', l: 'Cunas (VIII-2 4.15.3, Zick)' }, { t: 'sel', k: 'support.type', l: 'Tipo', o: [['saddle', 'Dos cunas simétricas'], ['none', 'Sin soporte']], re: 1 }]);
      if (sp.type === 'saddle') f = f.concat([
        { t: 'num', k: 'support.A', l: 'a · distancia línea de tangencia → eje de la cuna', u: 'len' }, { t: 'num', k: 'support.theta', l: 'θ · ángulo de contacto (°)' },
        { t: 'num', k: 'support.b', l: 'b · ancho de la cuna', u: 'len' }, { t: 'num', k: 'support.h', l: 'Altura del eje del recipiente sobre la base', u: 'len' },
        { t: 'chk', k: 'support.welded', l: 'Recipiente soldado a la cuna (k = 0,1)' }, { t: 'chk', k: 'support.wear', l: 'Con chapa de desgaste', re: 1 },
        sp.wear ? { t: 'num', k: 'support.twp', l: 'Espesor de la chapa de desgaste tr', u: 'len' } : null,
        sp.wear ? { t: 'num', k: 'support.bwp', l: 'Ancho de la chapa b1 (vacío = b + 1,56·√(Rm·t))', u: 'len', ph: 'auto' } : null,
        sp.wear ? { t: 'num', k: 'support.thwp', l: 'Ángulo de la chapa θ1 (°, vacío = θ + 12)', ph: 'auto' } : null,
        sp.wear ? { t: 'mat', k: 'support.wmat', l: 'Material de la chapa de desgaste', filter: notBolt } : null,
        { t: 'h', l: 'Estructura de la cuna' },
        { t: 'num', k: 'support.tw', l: 'Espesor del alma', u: 'len' }, { t: 'num', k: 'support.tf', l: 'Espesor de la placa superior (ancho = b)', u: 'len' },
        { t: 'num', k: 'support.Bb', l: 'Ancho de la placa base (axial)', u: 'len' }, { t: 'num', k: 'support.Lbp', l: 'Longitud de la placa base (vacío = cuerda del arco + 100)', u: 'len', ph: 'auto' },
        { t: 'num', k: 'support.tbp', l: 'Espesor de la placa base', u: 'len' }, { t: 'mat', k: 'support.smat', l: 'Material de la cuna', filter: notBolt },
        { t: 'num', k: 'support.fc', l: 'Presión admisible sobre el hormigón', u: 'p' },
        { t: 'num', k: 'support.nbs', l: 'Pernos de anclaje por cuna' }, { t: 'num', k: 'support.eb', l: 'Distancia transversal entre filas de pernos (vacío = 0,8·Lb)', u: 'len', ph: 'auto' },
        { t: 'sel', k: 'support.bsize', l: 'Tamaño del perno', o: boltOpts(), re: 1 }, { t: 'num', k: 'support.Ar', l: 'Área de raíz por perno', u: 'a' },
        { t: 'mat', k: 'support.amat', l: 'Material de los pernos', filter: isBolt }].filter(Boolean));
    }
    return f;
  }
  function compFields(c){
    var base = [{ t: 'txt', k: 'name', l: 'Denominación' }, { t: 'mat', k: 'mat', l: 'Material', filter: c.type === 'bflange' ? isForge : notBolt }];
    var tail = [{ t: 'num', k: 'c', l: 'Corrosión (vacío = general)', u: 'len', ph: 'general' },
      { t: 'num', k: 'E', l: 'Eficiencia E impuesta (vacío = automática)', ph: 'auto' }];
    var f;
    if (c.type === 'shell') f = [{ t: 'sel', k: 'basis', l: 'Diámetro dado como', o: [['id', 'Interior'], ['od', 'Exterior']], re: 1 },
      { t: 'num', k: 'D', l: c.basis === 'od' ? 'Diámetro exterior' : 'Diámetro interior', u: 'len' }, { t: 'num', k: 'L', l: 'Longitud', u: 'len' },
      { t: 'num', k: 'tn', l: 'Espesor nominal', u: 'len' }].concat(tail, [{ t: 'num', k: 'Ec', l: 'E junta circunferencial (vacío = auto)', ph: 'auto' }, { t: 'num', k: 'Lext', l: 'Longitud de cálculo a presión exterior (vacío = automática)', u: 'len', ph: 'auto' },
        { t: 'h', l: 'Anillos rigidizadores (UG-29)' }, { t: 'num', k: 'rn', l: 'Número de anillos intermedios (equidistantes)', re: 1 },
        (+c.rn > 0) ? { t: 'num', k: 'rh', l: 'Altura radial de la pletina h', u: 'len' } : null, (+c.rn > 0) ? { t: 'num', k: 'rb', l: 'Espesor (ancho axial) de la pletina b', u: 'len' } : null,
        (+c.rn > 0) ? { t: 'sel', k: 'rside', l: 'Posición', o: [['ext', 'Exterior'], ['int', 'Interior']] } : null,
        (+c.rn > 0) ? { t: 'mat', k: 'rmat', l: 'Material de los anillos', filter: notBolt } : null].filter(Boolean));
    else if (c.type === 'ellip') f = [{ t: 'num', k: 'D', l: 'Diámetro interior', u: 'len' }, { t: 'num', k: 'ratio', l: 'Relación D/2h' }, { t: 'num', k: 'sf', l: 'Faldón recto', u: 'len' },
      { t: 'num', k: 'tn', l: 'Espesor mínimo tras conformado', u: 'len' }, { t: 'chk', k: 'seamless', l: 'Fondo sin costura' }].concat(tail);
    else if (c.type === 'tori') f = [{ t: 'num', k: 'D', l: 'Diámetro interior', u: 'len' }, { t: 'num', k: 'Lc', l: 'Radio de corona L (vacío = D exterior)', u: 'len', ph: 'auto' },
      { t: 'num', k: 'rk', l: 'Radio de rebordeo r (vacío = 6 % D exterior)', u: 'len', ph: 'auto' }, { t: 'num', k: 'sf', l: 'Faldón recto', u: 'len' },
      { t: 'num', k: 'tn', l: 'Espesor mínimo tras conformado', u: 'len' }, { t: 'chk', k: 'seamless', l: 'Fondo sin costura' }].concat(tail);
    else if (c.type === 'hemi') f = [{ t: 'num', k: 'D', l: 'Diámetro interior', u: 'len' }, { t: 'num', k: 'sf', l: 'Faldón recto', u: 'len' },
      { t: 'num', k: 'tn', l: 'Espesor mínimo tras conformado', u: 'len' }, { t: 'chk', k: 'seamless', l: 'Fondo sin costura' }].concat(tail);
    else if (c.type === 'cone') f = [{ t: 'num', k: 'D', l: 'Diámetro interior extremo mayor', u: 'len' }, { t: 'num', k: 'Ds', l: 'Diámetro interior extremo menor', u: 'len' },
      { t: 'num', k: 'alpha', l: 'Semiángulo α (°)' }, { t: 'sel', k: 'largeAt', l: 'Extremo mayor hacia', o: [['base', 'la virola de origen'], ['away', 'el exterior']] },
      { t: 'num', k: 'tn', l: 'Espesor nominal', u: 'len' }].concat(tail, [
        { t: 'h', l: 'Anillos en las uniones (Ap. 1-5 / 1-8), pletina h × b; 0 = sin anillo' },
        { t: 'num', k: 'ringLh', l: 'Extremo mayor: altura h', u: 'len' }, { t: 'num', k: 'ringLb', l: 'Extremo mayor: espesor b', u: 'len' },
        { t: 'num', k: 'ringSh', l: 'Extremo menor: altura h', u: 'len' }, { t: 'num', k: 'ringSb', l: 'Extremo menor: espesor b', u: 'len' }]);
    else if (c.type === 'flat') f = [{ t: 'sel', k: 'sk', l: 'Tipo (Fig. UG-34)', o: Object.keys(C.FLAT).map(function(k){ return [k, C.FLAT[k].d + ' · C = ' + C.FLAT[k].C]; }), re: 1 },
      { t: 'num', k: 'd', l: 'Diámetro d (soldadas)', u: 'len' }, { t: 'num', k: 'tn', l: 'Espesor nominal', u: 'len' },
      { t: 'num', k: 'ts', l: 'Espesor de la virola ts (vacío = virola adyacente)', u: 'len', ph: 'auto' },
      (c.sk === 'jk' || c.sk === 'p') ? { t: 'info', html: 'Junta y pernos: se toman de la brida de cuerpo adyacente. d = G.' } : null,
      { t: 'num', k: 'c', l: 'Corrosión (vacío = general)', u: 'len', ph: 'general' }].filter(Boolean);
    else if (c.type === 'bflange') f = [{ t: 'sel', k: 'ftype', l: 'Tipo (2-4)', o: [['integral', 'Integral con cuello soldado (fig. 2-4 (6))'], ['optional', 'Opcional calculada como integral'], ['loosehub', 'Suelta con cubo'], ['ring', 'Suelta sin cubo (anillo)'], ['lap', 'Loca sobre solapa (fig. 2-4 (1))']], re: 1 },
      { t: 'num', k: 'A', l: 'A · diámetro exterior', u: 'len' }, { t: 'num', k: 'B', l: 'B · diámetro interior', u: 'len' }, { t: 'num', k: 'C', l: 'C · diámetro de taladros', u: 'len' },
      { t: 'num', k: 't', l: 't · espesor de brida', u: 'len' },
      (c.ftype !== 'ring' && c.ftype !== 'lap') ? { t: 'num', k: 'g0', l: 'g₀ · espesor del cubo en el extremo', u: 'len' } : null,
      (c.ftype !== 'ring' && c.ftype !== 'lap') ? { t: 'num', k: 'g1', l: 'g₁ · espesor del cubo en la brida', u: 'len' } : null,
      (c.ftype !== 'ring' && c.ftype !== 'lap') ? { t: 'num', k: 'h', l: 'h · longitud del cubo', u: 'len' } : null,
      { t: 'num', k: 'c', l: 'Corrosión (vacío = general)', u: 'len', ph: 'general' },
      { t: 'h', l: 'Junta (Tablas 2-5.1 y 2-5.2)' },
      { t: 'sel', k: 'gk', l: 'Material de junta', o: GASKETS.map(function(g){ return [g[0], g[1] + (g[2] != null ? ' · m = ' + g[2] + ', y = ' + g[3] + ' MPa' : '')]; }), re: 1 },
      { t: 'num', k: 'm', l: 'm · factor de junta' }, { t: 'num', k: 'y', l: 'y · tensión de asiento', u: 'p' },
      { t: 'sel', k: 'b1620', l: 'Junta espirometálica ASME B16.20 (D.I. / D.E. del elemento sellante)', o: gasketOpts(), re: 1 },
      { t: 'num', k: 'Go', l: 'D.E. de contacto de la junta', u: 'len' }, { t: 'num', k: 'Gi', l: 'D.I. de contacto de la junta', u: 'len' },
      { t: 'sel', k: 'b0mode', l: 'Ancho básico b₀ (Tabla 2-5.2)', o: B0, re: 1 },
      /w/.test(c.b0mode) ? { t: 'num', k: 'w', l: 'w · ancho del resalte', u: 'len' } : null,
      c.b0mode === 'wT' ? { t: 'num', k: 'Tg', l: 'T · espesor de la junta', u: 'len' } : null,
      { t: 'num', k: 'Gfix', l: 'G impuesto (0 = calcular)', u: 'len' },
      { t: 'h', l: 'Pernos' },
      { t: 'mat', k: 'bmat', l: 'Material de pernos', filter: isBolt },
      { t: 'sel', k: 'bsize', l: 'Tamaño de perno (área de raíz)', o: boltOpts(), re: 1 },
      { t: 'num', k: 'a', l: 'a · diámetro nominal', u: 'len' }, { t: 'num', k: 'Ar', l: 'Área de raíz por perno', u: 'a' }, { t: 'num', k: 'n', l: 'Número de pernos' },
      { t: 'h', l: 'Rigidez (2-14)' },
      { t: 'num', k: 'Ed', l: 'E a T de diseño (0 = de la carta del material)', u: 'mod' }, { t: 'num', k: 'Ea', l: 'E a T ambiente (0 = de la carta)', u: 'mod' }].filter(Boolean);
    return base.concat(f);
  }
  function nozFields(n){
    var host = prj.comps.filter(function(c){ return c.id === n.host; })[0], head = host && /ellip|tori|hemi|flat/.test(host.type);
    return [
      { t: 'txt', k: 'mark', l: 'Marca' }, { t: 'txt', k: 'service', l: 'Servicio' },
      { t: 'sel', k: 'host', l: 'Componente', o: prj.comps.map(function(c){ return [c.id, c.name]; }), re: 1 },
      head ? { t: 'num', k: 'rad', l: 'Distancia radial al eje del recipiente (0 = centro; hasta la línea de tangencia)', u: 'len' } : null,
      head && host.type !== 'flat' ? { t: 'sel', k: 'hor', l: 'Orientación del cuello', o: [['axial', 'Paralela al eje del recipiente'], ['normal', 'Normal a la superficie del fondo (radial)']], re: 1 } : null,
      head ? null : { t: 'num', k: 'a', l: 'Distancia axial desde el inicio del componente', u: 'len' },
      { t: 'num', k: 'theta', l: 'Orientación θ (°, 0 = +X / derecha en el esquema)' },
      { t: 'h', l: 'Cuello' },
      { t: 'sel', k: 'nps', l: 'Tamaño nominal', o: [['', 'No normalizado']].concat(Object.keys(PIPE_OD).map(function(k){ return [k, 'NPS ' + k + ' · D.E. ' + PIPE_OD[k] + ' mm']; })), re: 1 },
      { t: 'num', k: 'od', l: 'Diámetro exterior', u: 'len' }, { t: 'num', k: 'tn', l: 'Espesor nominal del cuello', u: 'len' },
      { t: 'chk', k: 'pipe', l: 'Tubería (tolerancia −12,5 %)' },
      { t: 'mat', k: 'mat', l: 'Material del cuello', filter: isPipe },
      { t: 'num', k: 'proj', l: head && host.type !== 'flat' && n.hor !== 'normal' ? 'Altura de la cara de brida (o del primer codo) sobre el extremo del fondo' : 'Tramo recto exterior (hasta el primer codo o la cara de brida)', u: 'len' },
      { t: 'num', k: 'hin', l: 'Proyección interior h', u: 'len' }, { t: 'num', k: 'ti', l: 'Espesor de la proyección interior', u: 'len' },
      { t: 'num', k: 'E1', l: 'E1 (1 si no atraviesa soldadura)' },
      { t: 'chk', k: 'access', l: 'Abertura de acceso o inspección (UG-45: t = ta)' },
      { t: 'h', l: 'Codos (ASME B16.9, radio largo 1,5·D o corto 1,0·D)' },
      { t: 'sel', k: 'elb.0.ang', l: 'Codo 1', o: [['0', 'Sin codo'], ['45', '45°'], ['90', '90°']], re: 1 },
      (+n.elb[0].ang > 0) ? { t: 'sel', k: 'elb.0.rt', l: 'Radio', o: [['LR', 'Largo (1,5·D)'], ['SR', 'Corto (1,0·D)']] } : null,
      (+n.elb[0].ang > 0) ? { t: 'num', k: 'elb.0.phi', l: 'Orientación del giro φ (°; 0 = hacia +eje del recipiente)' } : null,
      (+n.elb[0].ang > 0) ? { t: 'num', k: 'elb.0.L', l: 'Tramo recto tras el codo 1', u: 'len' } : null,
      (+n.elb[0].ang > 0) ? { t: 'sel', k: 'elb.1.ang', l: 'Codo 2', o: [['0', 'Sin codo'], ['45', '45°'], ['90', '90°']], re: 1 } : null,
      (+n.elb[0].ang > 0 && +n.elb[1].ang > 0) ? { t: 'sel', k: 'elb.1.rt', l: 'Radio', o: [['LR', 'Largo (1,5·D)'], ['SR', 'Corto (1,0·D)']] } : null,
      (+n.elb[0].ang > 0 && +n.elb[1].ang > 0) ? { t: 'num', k: 'elb.1.phi', l: 'Orientación del giro φ (° respecto al plano del codo 1)' } : null,
      (+n.elb[0].ang > 0 && +n.elb[1].ang > 0) ? { t: 'num', k: 'elb.1.L', l: 'Tramo recto tras el codo 2', u: 'len' } : null,
      { t: 'h', l: 'Refuerzo' },
      { t: 'chk', k: 'pad', l: 'Con chapa de refuerzo', re: 1 },
      n.pad ? { t: 'num', k: 'Dp', l: 'Diámetro exterior del refuerzo', u: 'len' } : null,
      n.pad ? { t: 'num', k: 'te', l: 'Espesor del refuerzo', u: 'len' } : null,
      n.pad ? { t: 'mat', k: 'pmat', l: 'Material del refuerzo', filter: notBolt } : null,
      { t: 'num', k: 'leg41', l: 'Cateto soldadura exterior cuello', u: 'len' },
      n.pad ? { t: 'num', k: 'leg42', l: 'Cateto soldadura exterior refuerzo', u: 'len' } : null,
      { t: 'num', k: 'leg43', l: 'Cateto soldadura interior', u: 'len' },
      { t: 'h', l: 'Cargas exteriores en la boquilla (en la unión con el recipiente)' },
      { t: 'num', k: 'ld.F', l: 'Fuerza axial F (+ tracción)', u: 'f' }, { t: 'num', k: 'ld.V', l: 'Cortante resultante V', u: 'f' },
      { t: 'num', k: 'ld.M', l: 'Momento flector resultante M', u: 'm' }, { t: 'num', k: 'ld.Mt', l: 'Momento torsor Mt', u: 'm' },
      { t: 'num', k: 'ld.kS', l: 'Multiplicador de S (UG-23(d): 1,2 con viento/sismo)' },
      { t: 'info', html: 'Se comprueba el cuello (cortante UG-45 ≤ 0,7·Sn, membrana ≤ S, membrana + flexión ≤ 1,5·S). Las tensiones locales en la pared (WRC 107/537) no se incluyen.' },
      { t: 'h', l: 'Soldaduras de unión (UG-41, UW-16)' },
      { t: 'sel', k: 'wtype', l: 'Tipo de unión', o: [['setin', 'Insertada (set-in), Fig. UG-41.1 (a)'], ['seton', 'Apoyada (set-on), Fig. UG-41.1 (b)']] },
      { t: 'num', k: 'tw', l: 'Penetración de la soldadura a tope en la pared (vacío = total)', u: 'len', ph: 'total' },
      n.pad ? { t: 'num', k: 'twp', l: 'Penetración de la soldadura refuerzo-cuello (vacío = te)', u: 'len', ph: 'te' } : null,
      { t: 'h', l: 'Brida (ASME B16.5)' },
      { t: 'sel', k: 'fl.type', l: 'Tipo', o: [['none', 'Sin brida'], ['WN', 'Welding neck'], ['SO', 'Slip-on'], ['LWN', 'Long welding neck (UG-44(j))']], re: 1 },
      n.fl.type !== 'none' ? { t: 'sel', k: 'fl.cls', l: 'Clase', o: V.CLASSES.map(function(c){ return [c, 'Clase ' + c]; }) } : null,
      n.fl.type !== 'none' ? { t: 'mat', k: 'fl.mat', l: 'Material de la brida', filter: function(m){ return !!m.grp; } } : null
    ].filter(Boolean);
  }

  // ---------------- renderizado ----------------
  var $ = function(id){ return document.getElementById(id); };
  function renderAll(){ renderTree(); renderEditor(); recompute(); }
  function recompute(){
    try { res = M.compute(prj); } catch (e) { res = null; console.error(e); $('summary').innerHTML = '<div class="bad">Error de cálculo: ' + esc(e.message) + '</div>'; }
    save();
    renderTreeStatus(); renderSummary(); renderSketch(); render3D(); renderResult();
  }
  function compLabel(c){ return M.TYPES[c.type]; }
  function renderTree(){
    var d = prj.design, H = d.orient === 'H';
    var endLbl = H ? (d.hdir === 'L' ? 'izquierda' : 'derecha') : 'arriba', startLbl = H ? (d.hdir === 'L' ? 'derecha' : 'izquierda') : 'abajo';
    var order = prj.comps.slice(); if (!H || d.hdir === 'L') order.reverse();
    if (H && d.hdir !== 'L') order = prj.comps.slice();
    var types = Object.keys(M.TYPES).map(function(k){ return '<option value="' + k + '">' + M.TYPES[k] + '</option>'; }).join('');
    var add = function(where, lbl){ return '<div class="addrow"><select id="add-' + where + '">' + types + '</select><button type="button" class="btn sm" onclick="APP.addComp(\'' + where + '\')">+ Añadir ' + lbl + '</button></div>'; };
    var firstAdd = (!H || d.hdir === 'L') ? add('end', endLbl) : add('start', startLbl);
    var lastAdd = (!H || d.hdir === 'L') ? add('start', startLbl) : add('end', endLbl);
    $('tree').innerHTML =
      '<button type="button" class="node' + (sel.kind === 'design' ? ' on' : '') + '" onclick="APP.select(\'design\')"><span class="dot" id="st-design"></span>Proyecto y condiciones de diseño</button>' +
      '<button type="button" class="node' + (sel.kind === 'loads' ? ' on' : '') + '" onclick="APP.select(\'loads\')"><span class="dot" id="st-loads"></span>Cargas exteriores y soportes<small>' + (prj.loads.windOn ? 'viento ' : '') + (prj.loads.seisOn ? 'sismo ' : '') + '· ' + ({ skirt: 'faldón', saddle: 'cunas', legs: 'patas', lugs: 'orejetas', none: 'sin soporte' }[(prj.support || {}).type] || '') + '</small></button>' +
      '<div class="tree-h">Componentes</div>' + firstAdd +
      order.map(function(c){ return '<div class="node-row"><button type="button" class="node' + (sel.kind === 'comp' && sel.id === c.id ? ' on' : '') + '" onclick="APP.select(\'comp\',\'' + c.id + '\')"><span class="dot" id="st-' + c.id + '"></span>' + esc(c.name) + '<small>' + compLabel(c) + (c.id === prj.base ? ' · origen' : '') + '</small></button>' +
        (c.id !== prj.base ? '<button type="button" class="del" title="Eliminar" onclick="APP.delComp(\'' + c.id + '\')">✕</button>' : '') + '</div>'; }).join('') +
      lastAdd +
      '<div class="tree-h">Conexiones</div>' +
      prj.nozzles.map(function(n){ return '<div class="node-row"><button type="button" class="node' + (sel.kind === 'noz' && sel.id === n.id ? ' on' : '') + '" onclick="APP.select(\'noz\',\'' + n.id + '\')"><span class="dot" id="st-' + n.id + '"></span>' + esc(n.mark) + '<small>' + (n.nps ? 'NPS ' + n.nps : fmt(n.od, 'len')) + (n.fl.type !== 'none' ? ' · ' + n.fl.type + ' ' + n.fl.cls : '') + '</small></button><button type="button" class="del" title="Eliminar" onclick="APP.delNoz(\'' + n.id + '\')">✕</button></div>'; }).join('') +
      '<div class="addrow"><button type="button" class="btn sm" onclick="APP.addNoz()">+ Añadir conexión</button></div>';
  }
  function renderTreeStatus(){
    if (!res) return;
    res.comps.forEach(function(r){ var e = $('st-' + r.c.id); if (e) e.className = 'dot ' + (r.ok ? 'ok' : 'ko'); });
    res.nozzles.forEach(function(r){ var e = $('st-' + r.n.id); if (e) e.className = 'dot ' + (r.ok ? 'ok' : 'ko'); });
    var e = $('st-design'); if (e) e.className = 'dot ' + (res.ok ? 'ok' : 'ko');
    var e2 = $('st-loads'); if (e2) e2.className = 'dot ' + (res.loads && res.loads.ok !== false ? 'ok' : 'ko');
  }
  function currentObj(){
    if (sel.kind === 'design' || sel.kind === 'loads') return prj;
    if (sel.kind === 'comp') return prj.comps.filter(function(c){ return c.id === sel.id; })[0];
    return prj.nozzles.filter(function(n){ return n.id === sel.id; })[0];
  }
  function renderEditor(){
    var o = currentObj(); if (!o){ sel = { kind: 'design' }; o = prj; }
    var fl = sel.kind === 'design' ? designFields() : sel.kind === 'loads' ? loadsFields() : sel.kind === 'comp' ? compFields(o) : nozFields(o);
    var title = sel.kind === 'design' ? 'Proyecto y condiciones de diseño' : sel.kind === 'loads' ? 'Cargas exteriores y soportes' : sel.kind === 'comp' ? (o.name + ' · ' + compLabel(o)) : ('Conexión ' + o.mark);
    $('editor').innerHTML = '<div class="ed-title">' + esc(title) + '</div><div class="fields">' + fl.map(function(f){ return fieldHtml(o, f); }).join('') + '</div>';
  }
  function onInput(e){
    var el = e.target, k = el.getAttribute('data-k'); if (!k) return;
    var o = currentObj(), t = el.getAttribute('data-t'), v;
    if (t === 'num'){ v = el.value === '' ? null : fromU(parseFloat(el.value), el.getAttribute('data-u')); if (v != null && isNaN(v)) return; }
    else if (t === 'chk') v = el.checked;
    else if (t === 'seln') v = parseInt(el.value, 10);
    else if (t === 'matid'){ setp(o, k, el.value); setp(o, k.replace(/\.id$/, '.vi'), 0); v = undefined; }
    else v = el.value;
    if (t === 'sel' && /^(fl\.cls)$/.test(k)) v = +v;
    if (v !== undefined) setp(o, k, v);
    // efectos secundarios
    if (k === 'gk'){ var g = GASKETS.filter(function(x){ return x[0] === v; })[0]; if (g && g[2] != null){ o.m = g[2]; o.y = g[3]; } }
    if (k === 'bsize'){ var b = BOLTS.filter(function(x){ return x[0] === v; })[0]; if (b){ o.a = Math.round(b[1] * 100) / 100; o.Ar = Math.round(b[2] * 10) / 10; } }
    if (/^support\.(b|lb|gb)size$/.test(k)){ var b2 = BOLTS.filter(function(x){ return x[0] === v; })[0]; if (b2) prj.support[{ 'support.bsize': 'Ar', 'support.lbsize': 'lAr', 'support.gbsize': 'gAr' }[k]] = Math.round(b2[2] * 10) / 10; }
    if (k === 'b1620' && v){ var q = v.split('|'), g = q[0] === '9' ? NB.b165[q[1]] : NB[q[0]][q[1]][q[2]];
      if (q[0] === '9'){ o.Go = g.od[q[2]]; o.Gi = g.id[q[2]]; } else { o.Go = g[1]; o.Gi = g[0]; }
      o.gk = 'SWS'; o.m = 3.00; o.y = 69; o.b0mode = 'N2'; }
    if (k === 'design.orient' && typeof VLOADS !== 'undefined'){ prj.support = VLOADS.defSupport(v); prj.loads.asce7.R = v === 'H' ? 3 : 2; }
    if (k === 'nps' && PIPE_OD[v]) o.od = PIPE_OD[v];
    if (k === 'design.orient'){ prj.design.level = null; }
    if (k === 'name' || k === 'mark') renderTree();
    if (e.type === 'change' && (el.getAttribute('data-re') || k === 'gk' || k === 'bsize' || k === 'nps' || k === 'b1620' || /size$/.test(k))){ renderTree(); renderEditor(); }
    recompute();
  }

  // ---------------- resultados ----------------
  function tile(l, v, sub, cls){ return '<div class="tile ' + (cls || '') + '"><div class="tl">' + l + '</div><div class="tv">' + v + '</div>' + (sub ? '<div class="ts">' + sub + '</div>' : '') + '</div>'; }
  function renderSummary(){
    if (!res) return;
    var d = prj.design;
    $('summary').innerHTML =
      tile('MAWP (parte superior)', res.mawp ? fmt(res.mawp.v, 'p') : '–', res.mawp ? 'gobierna: ' + esc(res.mawp.who) : '', res.mawp && res.mawp.v + 1e-9 >= d.P ? 'good' : 'bad') +
      tile('MAP (nuevo y frío)', res.map ? fmt(res.map.v, 'p') : '–', res.map ? esc(res.map.who) : '') +
      tile('MAEP (exterior)', res.maep ? fmt(res.maep.v, 'p') : '–', res.maep ? esc(res.maep.who) + (d.Pext > 0 ? ' · req. ' + fmt(d.Pext, 'p') : '') : '', d.Pext > 0 ? (res.maep && res.maep.v >= d.Pext ? 'good' : 'bad') : '') +
      tile('Prueba hidrostática', fmt(res.test.PT, 'p'), 'en la parte superior · ' + fmt(res.test.PTbot, 'p') + ' abajo') +
      tile('MDMT sin impacto', res.mdmt ? fmt(res.mdmt.v, 't') : '–', res.mdmt ? 'gobierna: ' + esc(res.mdmt.who) + ' · req. ' + fmt(d.MDMT, 't') : '', res.mdmt ? (res.mdmt.v <= d.MDMT ? 'good' : 'bad') : '') +
      tile('Masa', fmt(res.loads && res.loads.mass ? res.loads.mass.empty : res.mass.empty, 'kg'), 'vacío · ' + fmt(res.loads && res.loads.mass ? res.loads.mass.oper : res.mass.oper, 'kg') + ' servicio · ' + fmt(res.loads && res.loads.mass ? res.loads.mass.test : res.mass.test, 'kg') + ' prueba' + (res.loads && res.loads.mass ? ' (con aislamiento y accesorios, sin soportes)' : '')) +
      loadsTile();
    var w = res.warn.map(function(x){ return '<li class="warn">' + esc(x) + '</li>'; }).join('');
    $('warns').innerHTML = w ? '<ul class="checks">' + w + '</ul>' : '';
  }
  function loadsTile(){
    var L = res.loads; if (!L) return '';
    if (L.err) return tile('Cargas y soportes', 'error', esc(L.err), 'bad');
    var H = prj.design.orient === 'H', sub = [];
    if (L.T && prj.loads.seisOn) sub.push('T1 = ' + fmt(L.T.used, 'sec'));
    if (!H && L.base){ sub.push('M viento ' + fmt(L.base.Mw, 'm')); if (prj.loads.seisOn) sub.push('M sismo ' + fmt(L.base.Me, 'm')); }
    if (H && L.zick && L.zick.length) sub.push('Q = ' + fmt(L.zick[0].Q, 'f') + ' por cuna');
    return tile('Cargas y soportes', L.ok ? 'CUMPLE' : 'NO CUMPLE', sub.join(' · '), L.ok ? 'good' : 'bad');
  }
  function checksHtml(list){
    return '<ul class="checks">' + list.map(function(k){ return '<li class="' + (k.info ? 'info' : k.ok ? 'ok' : k.warn ? 'warn' : 'ko') + '">' + esc(k.t) + (k.ref ? ' <span class="ref">' + esc(k.ref) + '</span>' : '') + '</li>'; }).join('') + '</ul>';
  }
  function stepsHtml(r, title){
    if (!r || !r.steps || !r.steps.length) return '';
    return (title ? '<div class="st-h">' + esc(title) + '</div>' : '') + '<table class="steps"><thead><tr><th>Magnitud</th><th>Expresión</th><th>Valor</th><th>Referencia</th></tr></thead><tbody>' +
      r.steps.map(function(s){ return '<tr><td>' + esc(s.k) + '</td><td>' + esc(s.eq) + '</td><td class="num">' + (typeof s.v === 'string' ? esc(s.v) : fmt(s.v, s.u)) + '</td><td class="ref">' + esc(s.ref) + '</td></tr>'; }).join('') + '</tbody></table>';
  }
  function kv(rows){ return '<table class="kv">' + rows.filter(Boolean).map(function(r){ return '<tr><th>' + r[0] + '</th><td>' + r[1] + '</td></tr>'; }).join('') + '</table>'; }
  function compBlock(r, full){
    var c = r.c, d = prj.design, html = '';
    html += kv([
      ['Material', r.mat ? esc(r.mat.name) + ' <span class="ref">' + esc(r.mat.ref) + '</span>' : '–'],
      ['S a ' + fmt(d.T, 't') + ' / ambiente', r.mat ? fmt(r.mat.S, 's') + ' / ' + fmt(r.mat.Sa, 's') : '–'],
      ['Eficiencia de junta', r.eff ? esc(r.eff.txt) : '–'],
      ['Presión de cálculo', fmt(r.P, 'p') + ' <span class="ref">P + columna ' + fmt(r.ph, 'p') + ' (h = ' + fmt(r.hL, 'len') + ')</span>'],
      ['Posición', (prj.design.orient === 'V' ? 'Z' : 'X') + ' = ' + fmt(pos(r.pos.s0), 'len') + ' a ' + fmt(pos(r.pos.s1), 'len')],
      r.treq != null ? ['Espesor requerido (interior)', fmt(r.treq, 'len') + ' · nominal ' + fmt(c.tn, 'len')] : null,
      r.ext && r.ext.treq ? ['Espesor requerido (exterior)', fmt(r.ext.treq, 'len')] : null,
      ['MAWP en el componente / en cabeza', fmt(r.mawp, 'p') + ' / ' + fmt(r.mawpTop, 'p')],
      ['MAP (nuevo y frío)', fmt(r.map, 'p')],
      r.ext && r.ext.maep != null ? ['MAEP', fmt(r.ext.maep, 'p')] : null,
      r.md ? ['MDMT sin ensayo de impacto', r.md.mdmt != null ? fmt(r.md.mdmt, 't') + ' · tg = ' + fmt(r.md.tg, 'len') : 'requiere ensayo / no evaluada'] : null,
      ['Masa / volumen interior', fmt(r.mass, 'kg') + ' / ' + fmt(r.vol, 'm3')]
    ]);
    if (r.err) html += '<ul class="checks"><li class="ko">' + esc(r.err) + '</li></ul>';
    html += '<div class="st-h">Comprobaciones</div>' + checksHtml((r.int ? r.int.checks : []).concat(r.ext && prj.design.Pext > 0 ? r.ext.r.checks : []).concat(r.md ? r.md.r.checks : []));
    if (full){
      html += stepsHtml(r.int, 'Presión interior');
      if (r.ext && r.ext.r && r.ext.r.steps.length) html += stepsHtml(r.ext.r, 'Presión exterior' + (prj.design.Pext > 0 ? '' : ' (informativo: MAEP)'));
      if (r.md) html += stepsHtml(r.md.r, 'MDMT');
      if (r.md && r.md.bolt) html += stepsHtml(r.md.bolt.r, 'MDMT de los pernos');
    }
    if (r.ext && r.ext.ring){ html += '<div class="st-h">Anillos rigidizadores (UG-29)</div>' + checksHtml(r.ext.ring.r.checks) + (full ? stepsHtml(r.ext.ring.r) : ''); }
    if (r.junc){
      [['L', 'mayor'], ['S', 'menor']].forEach(function(k){ var j = r.junc[k[0]]; if (!j) return;
        if (j.int){ html += '<div class="st-h">Unión del extremo ' + k[1] + ' · presión interior (Ap. 1-5)</div>' + checksHtml(j.int.r.checks) + (full ? stepsHtml(j.int.r) : ''); }
        if (j.ext){ html += '<div class="st-h">Unión del extremo ' + k[1] + ' · presión exterior (Ap. 1-8)</div>' + checksHtml(j.ext.r.checks) + (full ? stepsHtml(j.ext.r) : ''); } });
    }
    return html;
  }
  function nozBlock(r, full){
    var n = r.n, html = '';
    if (r.err) return '<ul class="checks"><li class="ko">' + esc(r.err) + '</li></ul>';
    html += kv([
      ['Cuello', 'D.E. ' + fmt(n.od, 'len') + ' · tn ' + fmt(n.tn, 'len') + ' · ' + esc(r.mn.name)],
      n.pad ? ['Refuerzo', 'Dp ' + fmt(n.Dp, 'len') + ' · te ' + fmt(n.te, 'len') + (r.mp ? ' · ' + esc(r.mp.name) : '')] : null,
      ['Presión de cálculo', fmt(r.P, 'p')],
      ['Área requerida / disponible', fmt(r.int.out.A, 'a') + ' / ' + fmt(r.int.out.Aav, 'a')],
      ['t mínimo UG-45', fmt(r.int.out.t45, 'len')],
      r.fl ? ['Brida', n.fl.type + ' clase ' + n.fl.cls + (r.fl.grp ? ' · grupo ' + r.fl.grp : '') + ' · rating ' + fmt(r.fl.rating, 'p') + (r.fl.dims ? ' · O = ' + fmt(r.fl.dims.O, 'len') + ', tf = ' + fmt(r.fl.dims.tf, 'len') : '')] : null,
      ['MAWP refuerzo / boquilla / en cabeza', fmt(r.mawpReinf, 'p') + ' / ' + fmt(r.mawp, 'p') + ' / ' + fmt(r.mawpTop, 'p')],
      ['MDMT sin ensayo de impacto', r.mdmt != null ? fmt(r.mdmt, 't') : '–']
    ]);
    html += '<div class="st-h">Comprobaciones</div>' + checksHtml(r.int.checks.concat(r.checks).concat(r.ext ? r.ext.checks.filter(function(k){ return !k.info; }).map(function(k){ return { t: 'Presión exterior: ' + k.t, ok: k.ok, warn: k.warn }; }) : []));
    if (full){
      html += stepsHtml(r.int, 'Refuerzo y espesor del cuello (presión interior)');
      if (r.ext) html += stepsHtml(r.ext, 'Refuerzo a presión exterior (UG-37(d))');
      r.mdl.forEach(function(x){ html += stepsHtml(x.r, 'MDMT · ' + x.lbl); });
    }
    if (r.nl){ html += '<div class="st-h">Cargas exteriores en el cuello</div>' + checksHtml(r.nl.checks) + (full ? stepsHtml(r.nl) : ''); }
    if (r.weld){ html += '<div class="st-h">Soldaduras de unión (UG-41, UW-16)</div>' + checksHtml(r.weld.checks) + (full ? stepsHtml(r.weld) : ''); }
    return html;
  }
  function secTable(L, all){
    var head = '<table class="steps"><thead><tr><th>Sección</th><th>Cota sobre base</th><th>Comb.</th><th>Peso encima</th><th>Momento</th><th>σθ</th><th>σl máx / mín</th><th>Adm. tracción</th><th>Adm. compresión</th><th></th></tr></thead><tbody>';
    var body = '';
    L.sec.forEach(function(sc){
      var rows = sc.rows;
      if (!all){ var g = null, gr = -1; rows.forEach(function(x){ var q = Math.max(x.s1 / x.lim, x.B ? -Math.min(x.smin, x.smax, 0) / x.B : 0); if (!x.ok) q += 10; if (q > gr){ gr = q; g = x; } }); rows = g ? [g] : []; }
      rows.forEach(function(x, i){ body += '<tr><td>' + (i === 0 ? esc(sc.lbl) : '') + '</td><td class="num">' + (i === 0 ? fmt(sc.z, 'len') : '') + '</td><td title="' + esc(x.t) + '">' + x.k + '</td><td class="num">' + fmt(x.W, 'f') + '</td><td class="num">' + fmt(x.M, 'm') + '</td><td class="num">' + fmt(x.sth, 's') +
        '</td><td class="num">' + fmt(x.smax, 's') + ' / ' + fmt(x.smin, 's') + '</td><td class="num">' + fmt(x.lim, 's') + '</td><td class="num">' + (x.B != null ? fmt(x.B, 's') : '–') + '</td><td class="' + (x.ok ? 'okc' : 'koc') + '">' + (x.ok ? '✓' : '✕') + '</td></tr>'; });
    });
    return head + body + '</tbody></table>';
  }
  function loadsBlock(full){
    var L = res.loads, html = '';
    if (!L) return '<p>Módulo de cargas no disponible.</p>';
    if (L.err) return '<ul class="checks"><li class="ko">' + esc(L.err) + '</li></ul>';
    var H = prj.design.orient === 'H', ld = prj.loads;
    html += kv([
      ['Normativa', ld.code === 'EN' ? 'Viento EN 1991-1-4 con Anejo Nacional español (CTE DB SE-AE); sismo EN 1998-1' : 'ASCE 7-16: viento cap. 26–29, sismo cap. 15'],
      ['Combinaciones', esc(L.fam.txt) + ' · factores: P ' + L.f.fp + ', W ' + L.f.fw + ', E ' + L.f.fe + ', D favorable ' + L.f.fd + ', S × ' + L.f.kS],
      ['Masas', fmt(L.mass.empty, 'kg') + ' vacío · ' + fmt(L.mass.oper, 'kg') + ' servicio · ' + fmt(L.mass.test, 'kg') + ' prueba'],
      L.T ? ['Periodo fundamental', fmt(L.T.oper, 'sec') + ' en servicio · ' + fmt(L.T.empty, 'sec') + ' en vacío' + (ld.T > 0 ? ' · impuesto ' + fmt(+ld.T, 'sec') : '')] : null,
      ld.windOn ? ['Viento', 'cortante ' + fmt(L.wind.V, 'f') + (L.base ? ' · momento en la base ' + fmt(L.base.Mw, 'm') : ' transversal · ' + fmt(L.wind.VL, 'f') + ' longitudinal')] : ['Viento', 'no considerado'],
      ld.seisOn ? ['Sismo', 'cortante ' + fmt(L.seis.V, 'f') + (L.base ? ' · momento en la base ' + fmt(L.base.Me, 'm') : '')] : ['Sismo', 'no considerado']
    ]);
    html += '<div class="st-h">Acciones</div>' + checksHtml(L.r.checks) + stepsHtml(L.r);
    if (!H){
      if (L.combos) html += '<div class="st-h">Combinaciones</div><ul class="checks">' + L.combos.map(function(c){ return '<li class="info">' + c.k + ' · ' + esc(c.t) + '</li>'; }).join('') + '</ul>';
      html += '<div class="st-h">Tensiones longitudinales por sección' + (full ? '' : ' (combinación pésima)') + ' · VIII-2 4.3.10.2 con UG-23</div>' + secTable(L, full);
      html += '<div class="f-note">σθ con la eficiencia longitudinal y σl con la circunferencial; compresión admisible = mín(S ; B) de UG-23(b). Prueba: tracción ≤ 0,9·Sy. El peso encima de las secciones del recipiente no incluye el líquido (lo soporta el fondo inferior).</div>';
      if (L.skirt) html += '<div class="st-h">Faldón, anillo base y pernos de anclaje</div>' + checksHtml(L.skirt.r.checks) + stepsHtml(L.skirt.r);
      if (L.legs) html += '<div class="st-h">Patas (AISC 360-16, ASD) y pernos de anclaje</div>' + checksHtml(L.legs.r.checks) + stepsHtml(L.legs.r);
      if (L.lugs) html += '<div class="st-h">Orejetas</div>' + checksHtml(L.lugs.r.checks) + stepsHtml(L.lugs.r);
    } else if (L.zick){
      L.zick.forEach(function(z){ html += '<div class="st-h">' + z.k + ' · ' + esc(z.t) + ' — ' + (z.ok ? 'CUMPLE' : 'NO CUMPLE') + '</div>' + checksHtml(z.r.checks) + (full ? stepsHtml(z.r) : ''); });
      if (L.sstruct) html += '<div class="st-h">Estructura de la cuna: alma, placa base y pernos</div>' + checksHtml(L.sstruct.r.checks) + stepsHtml(L.sstruct.r);
    }
    return html;
  }
  function designBlock(){
    var d = prj.design, html = '';
    html += kv([
      ['MAWP del recipiente (cabeza)', res.mawp ? fmt(res.mawp.v, 'p') + ' · gobierna ' + esc(res.mawp.who) : '–'],
      ['Presión de prueba UG-99(b)', '1,3 × ' + fmt(res.test.basis, 'p') + ' × LSR ' + fx(res.test.lsr, 3) + ' (' + esc(res.test.lsrWho) + ') = ' + fmt(res.test.PT, 'p') + ' en cabeza; ' + fmt(res.test.PTbot, 'p') + ' en el punto más bajo (columna de agua ' + fmt(res.test.H, 'len') + ')'],
      ['MDMT del recipiente', res.mdmt ? fmt(res.mdmt.v, 't') + ' (la más caliente: ' + esc(res.mdmt.who) + ')' : '–'],
      ['Componentes que requieren ensayo de impacto', res.impact.length ? esc(res.impact.join(', ')) : 'ninguno'],
      ['Volumen interior', fmt(res.mass.vol, 'm3')]
    ]);
    html += '<div class="st-h">Requisitos de END y pruebas</div><ul class="checks">' + res.ndt.req.map(function(q){ return '<li class="' + (q.info ? 'info' : q.ok ? 'ok' : q.warn ? 'warn' : 'ko') + '">' + esc(q.t) + ' <span class="ref">' + esc(q.ref) + '</span></li>'; }).join('') + '</ul>';
    if (res.ug42 && res.ug42.length) html += '<div class="st-h">Aberturas próximas (UG-36(c)(3), UG-39, UG-42)</div>' + checksHtml([].concat.apply([], res.ug42.map(function(x){ return x.checks; })));
    html += '<div class="st-h">MAWP referida a la parte superior por elemento</div><table class="steps"><tbody>' + res.mawpList.map(function(x){ return '<tr><td>' + esc(x.who) + '</td><td class="num">' + fmt(x.v, 'p') + '</td></tr>'; }).join('') + '</tbody></table>';
    return html;
  }
  function renderResult(){
    if (!res) return;
    var box = $('result'), html;
    if (sel.kind === 'design') html = '<div class="ed-title">Resumen del recipiente</div>' + designBlock();
    else if (sel.kind === 'loads') html = '<div class="ed-title">Cargas exteriores y soportes ' + (res.loads ? '<span class="pill ' + (res.loads.ok ? 'ok' : 'ko') + '">' + (res.loads.ok ? 'CUMPLE' : 'NO CUMPLE') + '</span>' : '') + '</div>' + loadsBlock(false);
    else if (sel.kind === 'comp'){ var r = res.byId[sel.id]; html = '<div class="ed-title">Resultados · ' + esc(r.c.name) + ' <span class="pill ' + (r.ok ? 'ok' : 'ko') + '">' + (r.ok ? 'CUMPLE' : 'NO CUMPLE') + '</span></div>' + compBlock(r, true); }
    else { var z = res.nozzles.filter(function(x){ return x.n.id === sel.id; })[0]; html = '<div class="ed-title">Resultados · boquilla ' + esc(z.n.mark) + ' <span class="pill ' + (z.ok ? 'ok' : 'ko') + '">' + (z.ok ? 'CUMPLE' : 'NO CUMPLE') + '</span></div>' + nozBlock(z, true); }
    box.innerHTML = html;
  }
  function pos(s){ return prj.design.orient === 'H' && prj.design.hdir === 'L' ? -s : s; }

  // brida B16.5 en 2D: disco O × tf y cubo (WN/SO); devuelve polígonos en coordenadas (a lo largo, transversal)
  function flange2D(n){
    if (!n.fl || n.fl.type === 'none') return null;
    var dm = V.b165dims(n.fl.cls, n.nps), od = n.od, O = dm ? dm.O : od + 2 * Math.max(45, 0.35 * od), tf = dm ? dm.tf : Math.max(18, 0.12 * O), X = dm ? dm.X : 1.25 * od, Ah = dm ? (dm.Ah || od) : od;
    var Yh = n.fl.type === 'WN' ? (dm ? dm.Ywn : 2.2 * tf) : n.fl.type === 'SO' ? (dm ? dm.Ythr : 1.3 * tf) : tf;
    var polys = [[[0, -O / 2], [-tf, -O / 2], [-tf, O / 2], [0, O / 2]]];
    if (n.fl.type === 'WN' && Yh > tf) polys.push([[-tf, -X / 2], [-Yh, -Ah / 2], [-Yh, Ah / 2], [-tf, X / 2]]);
    if (n.fl.type === 'SO' && Yh > tf) polys.push([[-tf, -X / 2], [-Yh, -X / 2], [-Yh, X / 2], [-tf, X / 2]]);
    return polys;
  }
  // ---------------- esquema ----------------
  function renderSketch(){
    if (!res) return;
    var d = prj.design, H = d.orient === 'H', Lr = res.L, sign = H && d.hdir === 'L' ? -1 : 1;
    function num0(x){ return +x || 0; }
    var Rmax = 0; prj.comps.forEach(function(c){ Rmax = Math.max(Rmax, (c.type === 'bflange' ? c.A / 2 : ((c.D || c.d || 0) / 2 + c.tn))); });
    prj.nozzles.forEach(function(n){ Rmax = Math.max(Rmax, (prj.comps.filter(function(c){ return c.id === n.host; })[0] || {}).D / 2 + n.proj || 0); });
    var LD = res.loads && !res.loads.err ? res.loads : null, sp = prj.support || {}, zlo = Lr.smin, zhi = Lr.smax;
    if (!H && LD && LD.zg != null && sp.type !== 'lugs') zlo = Math.min(zlo, LD.zg - (sp.type === 'skirt' ? num0(sp.tb) : 0));
    if (!H && LD && LD.legs) Rmax = Math.max(Rmax, LD.legs.Dl / 2 + 100);
    if (!H && LD && LD.skirt) Rmax = Math.max(Rmax, LD.skirt.Dbo / 2);
    var hAx = H && sp.type === 'saddle' ? num0(sp.h) : 0; if (hAx) Rmax = Math.max(Rmax, hAx);
    var span = zhi - zlo, W = H ? 640 : 380, Hh = H ? 340 : 560, pad = 46;
    var sc = Math.min((H ? W : Hh) - 2 * pad, 1e9) / Math.max(span, 1), sr = ((H ? Hh : W) - 2 * pad) / (2 * Rmax || 1);
    sc = Math.min(sc, sr);
    // mapa (s, r) → pantalla
    var sCenter = (zlo + zhi) / 2;
    function P(s, r){ var a = (s - sCenter) * sc * sign, b = r * sc; return H ? [W / 2 + a, Hh / 2 - b] : [W / 2 + b, Hh / 2 - a]; }
    var out = '';
    function path(pts){ return 'M' + pts.map(function(p){ return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' L') + ' Z'; }
    function wallPoly(inner, t){ // inner: [[s, r]] ; dibuja ambos lados
      var o = '';
      [1, -1].forEach(function(sg){
        var a = inner.map(function(p){ return P(p[0], sg * p[1]); }), b = inner.slice().reverse().map(function(p){ return P(p[0], sg * (p[1] + t)); });
        o += path(a.concat(b));
      });
      return o;
    }
    var usedLbl = {};
    // eje
    var e0 = P(Lr.smin - 80 / sc, 0), e1 = P(Lr.smax + 80 / sc, 0);
    out += '<line class="axis" x1="' + e0[0] + '" y1="' + e0[1] + '" x2="' + e1[0] + '" y2="' + e1[1] + '"/>';
    prj.comps.forEach(function(c){
      var p = Lr.pos[c.id], on = sel.kind === 'comp' && sel.id === c.id, r = res.byId[c.id];
      var cls = 'wall' + (on ? ' on' : '') + (r && !r.ok ? ' bad' : ''), dpath = '';
      if (c.type === 'shell'){ var ri = M.innerR(c, p, p.s0); dpath = wallPoly([[p.s0, ri], [p.s1, ri]], c.tn); }
      else if (c.type === 'cone'){ dpath = wallPoly([[p.s0, M.innerR(c, p, p.s0)], [p.s1, M.innerR(c, p, p.s1)]], c.tn); }
      else if (/ellip|tori|hemi/.test(c.type)){
        var oc = Object.assign({}, c, { D: c.D + 2 * c.tn });
        if (c.type === 'ellip') oc.ratio = (c.D + 2 * c.tn) / (2 * (M.headDepth(c) + c.tn));
        if (c.type === 'tori'){ oc.Lc = M.toriL(c) + c.tn; oc.rk = M.toriR(c) + c.tn; }
        var mapS = function(q){ return [p.side === 'start' ? p.s1 - q[0] : p.s0 + q[0], q[1]]; };
        var pin = M.headProfile(c).map(mapS), pout = M.headProfile(oc).map(mapS);
        var loop = function(pr){ return pr.map(function(q){ return P(q[0], q[1]); }).concat(pr.slice().reverse().map(function(q){ return P(q[0], -q[1]); })); };
        out += '<path class="' + cls + '" data-id="' + c.id + '" fill-rule="evenodd" d="' + path(loop(pout)) + ' ' + path(loop(pin)) + '"/>';
      } else if (c.type === 'flat'){ var R0 = (c.d || 0) / 2 + 20; dpath = path([P(p.s0, -R0), P(p.s1, -R0), P(p.s1, R0), P(p.s0, R0)]); }
      else if (c.type === 'bflange'){
        var t0 = p.side === 'start' ? p.s0 : p.s1 - c.t, t1 = t0 + c.t, hub0 = p.side === 'start' ? p.s0 + c.t : p.s0;
        dpath = wallPoly([[t0, c.B / 2], [t1, c.B / 2]], (c.A - c.B) / 2) + wallPoly([[hub0, c.B / 2], [hub0 + c.h, c.B / 2]], (c.g0 + c.g1) / 2);
      }
      if (dpath) out += '<path class="' + cls + '" data-id="' + c.id + '" d="' + dpath + '"/>';
      // cota
      var tk = P(p.s0, -Rmax - 6 / sc);
      var key = Math.round((H ? tk[0] : tk[1]) / 13);
      if (!usedLbl[key]) usedLbl[key] = 1; else tk = null;
      if (tk) out += '<text class="dim" x="' + (H ? tk[0] : 6) + '" y="' + (H ? Hh - 8 : tk[1] + 3) + '" text-anchor="' + (H ? 'middle' : 'start') + '">' + fx(toU(pos(p.s0), 'len'), units === 'us' ? 1 : 0) + '</text>';
      var tk2 = P(p.s0, -Rmax); var tk3 = P(p.s0, Rmax);
      out += '<line class="tick" x1="' + tk2[0] + '" y1="' + tk2[1] + '" x2="' + tk3[0] + '" y2="' + tk3[1] + '"/>';
    });
    var last = P(Lr.smax, -Rmax - 6 / sc);
    out += '<text class="dim" x="' + (H ? last[0] : 6) + '" y="' + (H ? Hh - 8 : last[1] + 3) + '" text-anchor="' + (H ? 'middle' : 'start') + '">' + fx(toU(pos(Lr.smax), 'len'), units === 'us' ? 1 : 0) + '</text>';
    // nivel de líquido
    if (d.rho > 0){
      if (!H){ var zl = d.level != null && d.level !== '' ? +d.level : null; if (zl != null){ var l0 = P(zl, -Rmax * 0.9), l1 = P(zl, Rmax * 0.9); out += '<line class="liq" x1="' + l0[0] + '" y1="' + l0[1] + '" x2="' + l1[0] + '" y2="' + l1[1] + '"/><text class="liqt" x="' + (l1[0] + 4) + '" y="' + (l1[1] - 3) + '">NL</text>'; } }
      else if (d.level != null && d.level !== ''){ var Dm = Math.max.apply(null, prj.comps.map(function(c){ return c.D || 0; })); var yl = -Dm / 2 + (+d.level); var h0 = P(Lr.smin, yl), h1 = P(Lr.smax, yl); out += '<line class="liq" x1="' + h0[0] + '" y1="' + h0[1] + '" x2="' + h1[0] + '" y2="' + h1[1] + '"/>'; }
    }
    // boquillas
    prj.nozzles.forEach(function(n){
      var host = prj.comps.filter(function(c){ return c.id === n.host; })[0]; if (!host) return;
      var p = Lr.pos[host.id], on = sel.kind === 'noz' && sel.id === n.id, rz = res.nozzles.filter(function(x){ return x.n.id === n.id; })[0];
      var cls = 'noz' + (on ? ' on' : '') + (rz && !rz.ok ? ' bad' : ''), th = (n.theta || 0) * Math.PI / 180, ct = Math.cos(th), g = '';
      if (/ellip|tori|hemi|flat/.test(host.type)){
        var hz = M.headNoz(host, p, n), x0 = hz.r * ct, dxs = hz.ds, dxr = hz.dr * ct, nl = Math.sqrt(dxs * dxs + dxr * dxr) || 1; dxs /= nl; dxr /= nl;
        var px = -dxr, pr2 = dxs, Lx = hz.L0, sB = hz.s - dxs * (n.hin || 0), rB = x0 - dxr * (n.hin || 0), sE = sB + dxs * Lx, rE = rB + dxr * Lx, hw = n.od / 2;
        var a1 = P(sB + px * hw, rB + pr2 * hw), a2 = P(sE + px * hw, rE + pr2 * hw), a3 = P(sE - px * hw, rE - pr2 * hw), a4 = P(sB - px * hw, rB - pr2 * hw);
        g += '<path class="' + cls + '" data-nid="' + n.id + '" d="' + path([a1, a2, a3, a4]) + '"/>';
        var fp = flange2D(n); if (fp) fp.forEach(function(pl){ g += '<path class="fln" d="' + path(pl.map(function(q){ return P(sE + dxs * q[0] + px * q[1], rE + dxr * q[0] + pr2 * q[1]); })) + '"/>'; });
        var send = sE, dir = 1, x = rE; dir = 0;
        var lp = P(sE + dxs * 14 / sc, rE + dxr * 14 / sc); g += '<text class="nzt" x="' + lp[0] + '" y="' + lp[1] + '" text-anchor="middle">' + esc(n.mark) + '</text>';
      } else {
        var s = p.s0 + (n.a || 0), Rw = (host.type === 'shell' ? M.innerR(host, p, s) : M.innerR(host, p, s) || host.D / 2) + host.tn;
        if (Math.abs(ct) < 0.35){
          var cc = P(s, 0); g += '<circle class="' + cls + '" data-nid="' + n.id + '" cx="' + cc[0] + '" cy="' + cc[1] + '" r="' + Math.max(3, n.od / 2 * sc) + '"/>';
          g += '<text class="nzt" x="' + (cc[0] + n.od / 2 * sc + 3) + '" y="' + (cc[1] - 3) + '">' + esc(n.mark) + '</text>';
        } else {
          var sg = ct > 0 ? 1 : -1, r0 = sg * (Rw - host.tn), r1 = sg * (Rw + n.proj);
          var b1 = P(s - n.od / 2, r0), b2 = P(s - n.od / 2, r1), b3 = P(s + n.od / 2, r1), b4 = P(s + n.od / 2, r0);
          g += '<path class="' + cls + '" data-nid="' + n.id + '" d="' + path([b1, b2, b3, b4]) + '"/>';
          if (n.pad && n.Dp > n.od){ var q1 = P(s - n.Dp / 2, sg * Rw), q2 = P(s - n.Dp / 2, sg * (Rw + n.te)), q3 = P(s + n.Dp / 2, sg * (Rw + n.te)), q4 = P(s + n.Dp / 2, sg * Rw); g += '<path class="' + cls + '" data-nid="' + n.id + '" d="' + path([q1, q2, q3, q4]) + '"/>'; }
          var f1 = P(s - n.od / 2 - 15, r1), f2 = P(s + n.od / 2 + 15, r1);
          var fp2 = flange2D(n); if (fp2) fp2.forEach(function(pl){ g += '<path class="fln" d="' + path(pl.map(function(q){ return P(s + q[1], r1 + sg * q[0]); })) + '"/>'; });
          var tp = P(s, r1 + sg * 18 / sc); g += '<text class="nzt" x="' + tp[0] + '" y="' + (tp[1] + 3) + '" text-anchor="middle">' + esc(n.mark) + '</text>';
        }
      }
      out += g;
    });
    // anillos rigidizadores
    prj.comps.forEach(function(c){ if (c.type !== 'shell' || !(+c.rn > 0)) return; var p = Lr.pos[c.id], ri = M.innerR(c, p, p.s0), ro = ri + c.tn;
      for (var q = 1; q <= +c.rn; q++){ var sr = p.s0 + q * (p.s1 - p.s0) / (+c.rn + 1), hb = (+c.rb || 10) / 2, r0 = c.rside === 'int' ? ri - (+c.rh || 0) : ro, r1 = c.rside === 'int' ? ri : ro + (+c.rh || 0);
        out += '<path class="sup" d="' + path([P(sr - hb, r0), P(sr + hb, r0), P(sr + hb, r1), P(sr - hb, r1)]) + ' ' + path([P(sr - hb, -r0), P(sr + hb, -r0), P(sr + hb, -r1), P(sr - hb, -r1)]) + '"/>'; } });
    // soportes
    if (!H && LD && LD.skirt){
      var zg = LD.zg, za = LD.sAtt, Ds = LD.skirt.Ds, tk = num0(sp.t), tb = num0(sp.tb), Dbo = LD.skirt.Dbo, Dbi = LD.skirt.Dbi;
      out += '<path class="sup" d="' + wallPoly([[zg, Ds / 2 - tk], [za, Ds / 2 - tk]], tk) + '"/>';
      out += '<path class="sup" d="' + path([P(zg - tb, Dbi / 2), P(zg, Dbi / 2), P(zg, Dbo / 2), P(zg - tb, Dbo / 2)]) + ' ' + path([P(zg - tb, -Dbi / 2), P(zg, -Dbi / 2), P(zg, -Dbo / 2), P(zg - tb, -Dbo / 2)]) + '"/>';
      [-1, 1].forEach(function(sg){ var b0 = P(zg - tb - 120, sg * LD.skirt.BC / 2), b1 = P(zg + 60, sg * LD.skirt.BC / 2); out += '<line class="bolt" x1="' + b0[0] + '" y1="' + b0[1] + '" x2="' + b1[0] + '" y2="' + b1[1] + '"/>'; });
      var g0 = P(zg - tb, -Rmax * 1.05), g1 = P(zg - tb, Rmax * 1.05); out += '<line class="ground" x1="' + g0[0] + '" y1="' + g0[1] + '" x2="' + g1[0] + '" y2="' + g1[1] + '"/>';
      var gl = P(zg - tb, Rmax * 0.62); out += '<text class="dim" x="' + (gl[0] + 4) + '" y="' + (gl[1] + 12) + '">base ' + fx(toU(pos(zg - tb), 'len'), units === 'us' ? 1 : 0) + '</text>';
    }
    if (!H && LD && LD.legs){
      var zl = LD.zg, xl = LD.legs.Dl / 2, bl = sp.lsec === 'user' ? num0(sp.lb) || 100 : num0(sp.lod);
      [-1, 1].forEach(function(sg){ out += '<path class="sup" d="' + path([P(zl, sg * xl - bl / 2), P(LD.sAtt + 300, sg * xl - bl / 2), P(LD.sAtt + 300, sg * xl + bl / 2), P(zl, sg * xl + bl / 2)]) + '"/>'; });
      var gL0 = P(zl, -Rmax * 1.05), gL1 = P(zl, Rmax * 1.05); out += '<line class="ground" x1="' + gL0[0] + '" y1="' + gL0[1] + '" x2="' + gL1[0] + '" y2="' + gL1[1] + '"/>';
    }
    if (!H && LD && LD.lugs){
      var zs = LD.sB, xg = (sp.Dlug > 0 ? +sp.Dlug : 0) / 2 || Rmax * 0.8;
      [-1, 1].forEach(function(sg){ out += '<path class="sup" d="' + path([P(zs, sg * (xg - 120)), P(zs + 250, sg * (xg - 120)), P(zs + 250, sg * (xg + 60)), P(zs, sg * (xg + 60))]) + '"/>';
        var a0 = P(zs, sg * (xg - 200)), a1 = P(zs, sg * (xg + 260)); out += '<line class="ground" x1="' + a0[0] + '" y1="' + a0[1] + '" x2="' + a1[0] + '" y2="' + a1[1] + '"/>'; });
    }
    if (H && sp.type === 'saddle' && hAx){
      var body = prj.comps.filter(function(c){ return !/ellip|tori|hemi|flat/.test(c.type); });
      if (body.length){
        var sT0 = Math.min.apply(null, body.map(function(c){ return Lr.pos[c.id].s0; })), sT1 = Math.max.apply(null, body.map(function(c){ return Lr.pos[c.id].s1; }));
        var Ro = Math.max.apply(null, body.map(function(c){ return (c.D || 0) / 2 + c.tn; })), bw = num0(sp.b) || 200, aa = num0(sp.A);
        [sT0 + aa, sT1 - aa].forEach(function(sc0){ var yb = -hAx, yt = -Ro * Math.cos(num0(sp.theta) / 2 * Math.PI / 180), w2 = Math.max(bw / 2, Ro * 0.45);
          out += '<path class="sup" d="' + path([P(sc0 - w2, yb), P(sc0 + w2, yb), P(sc0 + bw / 2, yt), P(sc0 - bw / 2, yt)]) + '"/>'; });
        var h0 = P(Lr.smin - 60, -hAx), h1 = P(Lr.smax + 60, -hAx); out += '<line class="ground" x1="' + h0[0] + '" y1="' + h0[1] + '" x2="' + h1[0] + '" y2="' + h1[1] + '"/>';
      }
    }
    // origen
    var o0 = P(0, 0);
    out += '<circle class="orig" cx="' + o0[0] + '" cy="' + o0[1] + '" r="4"/><text class="dim" x="' + (o0[0] + 7) + '" y="' + (o0[1] + 14) + '">0,0,0</text>';
    var ax = H ? P(Lr.smin, 0) : P(Lr.smin, 0);
    out += '<text class="axl" x="' + (H ? W - 16 : W / 2 + 6) + '" y="' + (H ? Hh / 2 - 6 : 14) + '">' + (H ? 'X' : 'Z') + '</text>';
    $('sketch').setAttribute('viewBox', '0 0 ' + W + ' ' + Hh);
    $('sketch').innerHTML = out;
  }

  // ---------------- visor 3D ----------------
  var has3D = false, view = 'v3d';
  try { view = localStorage.getItem('asme-view') || 'v3d'; } catch (e) {}
  function render3D(){ if (has3D && view === 'v3d' && res) VISOR3D.update(prj, res, sel); }
  function setView(v){
    view = has3D ? v : '2d'; try { localStorage.setItem('asme-view', view); } catch (e) {}
    $('v3d').style.display = view === 'v3d' ? '' : 'none'; $('sketch').style.display = view === 'v3d' ? 'none' : '';
    ['bt3d', 'bt2d'].forEach(function(b){ $(b).classList.toggle('active', (b === 'bt3d') === (view === 'v3d')); });
    $('vtools').style.visibility = view === 'v3d' ? 'visible' : 'hidden';
    if (view === 'v3d'){ VISOR3D.resize(); render3D(); }
  }
  // ---------------- memoria ----------------
  function memoria(){
    var d = prj.design, i = prj.info, html = '';
    html += '<div class="m-head"><div><div class="m-t">Memoria de cálculo · ASME BPVC VIII División 1 (2017)</div><div class="m-s">' + esc(i.proyecto) + ' · ' + esc(i.equipo) + ' · TAG ' + esc(i.tag) + '</div></div>' +
      '<div class="m-r">Cliente: ' + esc(i.cliente) + '<br>Calculado por: ' + esc(i.autor) + '<br>Rev. ' + esc(i.rev) + ' · ' + esc(i.fecha) + '</div></div>';
    html += '<h2>1. Datos de diseño</h2>' + kv([
      ['Orientación', d.orient === 'V' ? 'Vertical (eje Z; origen en el centro inferior de la primera virola)' : 'Horizontal (eje X; origen en el centro del extremo de la primera virola, hacia ' + (d.hdir === 'L' ? '−X' : '+X') + ')'],
      ['Presión interior de diseño', fmt(d.P, 'p') + ' en la parte superior'], ['Temperatura de diseño', fmt(d.T, 't')],
      ['Presión exterior de diseño', d.Pext > 0 ? fmt(d.Pext, 'p') : 'no aplica'], ['Corrosión general', fmt(d.c, 'len')], ['MDMT requerida', fmt(d.MDMT, 't')],
      ['Fluido', esc(d.fluid) + ' · ' + fmt(d.rho, 'rho') + (d.lethal ? ' · servicio letal' : '') + ' · nivel ' + (d.level != null && d.level !== '' ? fmt(+d.level, 'len') : 'lleno')],
      ['Radiografía / junta', d.rt + ' · junta tipo ' + d.jt + ' (Tabla UW-12)'],
      ['END previstos', ['VT', 'RT', 'UT', 'MT', 'PT'].filter(function(k){ return d.ndt[k]; }).map(function(k){ return k === 'PT' ? 'LP' : k; }).join(', ') || '–'],
      ['TTPS', d.pwht ? 'sí' : 'no']
    ]);
    var img = has3D ? (render3D(), VISOR3D.snapshot()) : null;
    html += '<div class="m-sk">' + (img ? '<img class="m3d" src="' + img + '" alt="Vista 3D">' : '') + $('sketch').outerHTML.replace('id="sketch"', 'class="msk"').replace(/style="[^"]*"/, '') + '</div>';
    html += '<h2>2. Resumen</h2>' + designBlock();
    if (res.warn.length) html += '<ul class="checks">' + res.warn.map(function(w){ return '<li class="warn">' + esc(w) + '</li>'; }).join('') + '</ul>';
    html += '<h2>3. Componentes</h2>';
    res.comps.forEach(function(r, k){ html += '<h3>3.' + (k + 1) + ' ' + esc(r.c.name) + ' · ' + compLabel(r.c) + ' — ' + (r.ok ? 'CUMPLE' : 'NO CUMPLE') + '</h3>' + compBlock(r, true); });
    if (res.nozzles.length){ html += '<h2>4. Boquillas</h2>'; res.nozzles.forEach(function(r, k){ html += '<h3>4.' + (k + 1) + ' ' + esc(r.n.mark) + (r.n.service ? ' · ' + esc(r.n.service) : '') + ' — ' + (r.ok ? 'CUMPLE' : 'NO CUMPLE') + '</h3>' + nozBlock(r, true); }); }
    var hn = res.nozzles.length ? 5 : 4;
    html += '<h2>' + hn + '. Cargas exteriores y soportes</h2>' + loadsBlock(true);
    html += '<h2>' + (hn + 1) + '. Alcance y limitaciones</h2><ul class="lim">' +
      ['Presión interior (UG-27, UG-32, UG-34, Ap. 1 y 2) y exterior (UG-28, UG-33, II-D Subparte 3), anillos rigidizadores de pletina (UG-29) y uniones cono-cilindro sin rebordeo (Ap. 1-5 y 1-8, con α ≤ 30° / 60°); las uniones se tratan como líneas de soporte. La inercia combinada I′ de la unión cono-cilindro es aproximada (VIII-1 no da procedimiento).',
       'Boquillas: UG-37/UG-40, UG-45, UG-39 (tapas planas, d ≤ D/2), soldaduras UG-41 y tamaños UW-16; aberturas próximas UG-42 con área combinada simplificada.',
       'Viento: EN 1991-1-4 (+ AN / CTE) con cs·cd y ψλ (Fig. 7.36 digitalizada) o ASCE 7-16 con G = 0,85 salvo valor impuesto; sin desprendimiento de torbellinos ni ovalización. Sismo: método de fuerzas laterales (EN 1998-1 / ASCE 7-16 cap. 15), modo fundamental por Rayleigh.',
       'Tensiones combinadas según VIII-2 4.3.10.2 con admisibles de VIII-1 (UG-23), como en PTB-4 E4.3.6 y E4.15.2. Faldón: anillo base sin cartelas. Patas: AISC 360-16 (ASD). Orejetas: solo cargas y pernos. Cunas: VIII-2 4.15.3 (Zick) sin anillos, alma según PTB-4 E4.15.1, placa base y pernos. Cargas en boquillas: solo el cuello; sin tensiones locales WRC 107/537 en la pared.',
       'Tensiones admisibles: ASME II-D (Metric) 2015 (valores US convertidos). Ratings: ASME B16.5-2013; juntas: ASME B16.20-2012. MDMT: Fig. UCS-66.1M digitalizada. Áreas de raíz de pernos: UNC/8UN según criterio TEMA, métricos según ISO 724.',
       'Comprobar contra la edición y adenda vigentes del código antes de usar en fabricación.'].map(function(t){ return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>';
    return html;
  }

  // ---------------- acciones ----------------
  window.APP = {
    select: function(kind, id){ sel = { kind: kind, id: id || null }; renderTree(); renderEditor(); recompute(); },
    addComp: function(where){
      var type = $('add-' + where).value;
      var ref = where === 'end' ? prj.comps[prj.comps.length - 1] : prj.comps[0];
      if (/ellip|tori|hemi|flat/.test(ref.type)){ alert('El extremo ya está cerrado por ' + ref.name + '. Elimínalo o añade por el otro extremo.'); return; }
      var near = ref.type === 'cone' ? { D: ref.largeAt === (where === 'end' ? 'base' : 'away') ? ref.Ds : ref.D } : ref;
      var c = M.newComp(type, prj, near);
      if (ref.mat && type !== 'bflange') c.mat = { id: ref.mat.id, vi: ref.mat.vi };
      if (ref.tn && type !== 'flat' && type !== 'bflange') c.tn = ref.tn;
      if (where === 'end') prj.comps.push(c); else prj.comps.unshift(c);
      var cnt = prj.comps.filter(function(x){ return x.type === type; }).length; c.name = M.TYPES[type] + (cnt > 1 ? ' ' + cnt : '');
      sel = { kind: 'comp', id: c.id }; renderAll();
    },
    delComp: function(id){
      if (id === prj.base) return;
      if (prj.nozzles.some(function(n){ return n.host === id; }) && !confirm('Hay boquillas en este componente; se eliminarán también. ¿Continuar?')) return;
      prj.nozzles = prj.nozzles.filter(function(n){ return n.host !== id; });
      prj.comps = prj.comps.filter(function(c){ return c.id !== id; });
      sel = { kind: 'design' }; renderAll();
    },
    addNoz: function(){ var n = M.newNozzle(prj); prj.nozzles.push(n); sel = { kind: 'noz', id: n.id }; renderAll(); },
    delNoz: function(id){ prj.nozzles = prj.nozzles.filter(function(n){ return n.id !== id; }); sel = { kind: 'design' }; renderAll(); },
    nuevo: function(){ if (!confirm('¿Crear un recipiente nuevo? Se perderán los datos no guardados.')) return; prj = M.newProject(prj.design.orient); sel = { kind: 'design' }; renderAll(); },
    guardar: function(){
      var blob = new Blob([JSON.stringify(prj, null, 1)], { type: 'application/json' });
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = (prj.info.tag || prj.info.equipo || 'recipiente').replace(/[^\w.-]+/g, '_') + '.vessel.json';
      document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 500);
    },
    abrir: function(){ $('file').click(); },
    memoria: function(){ $('memoria').innerHTML = memoria(); window.print(); },
    setUnits: function(u){ units = u; try { localStorage.setItem('asme-units', u); } catch (e) {} $('u-si').classList.toggle('active', u === 'si'); $('u-us').classList.toggle('active', u === 'us'); renderAll(); },
    cerrar: function(){ window.location.href = 'index.html'; },
    view: function(v){ setView(v); },
    sm: function(){ if (!has3D) return; VISOR3D.connectHID(smShow).catch(function(e){ $('smst').textContent = e.message; }); },
    smSens: function(v){ if (has3D) VISOR3D.setSens(v); }, smInv: function(v){ if (has3D) VISOR3D.setInv(v); }, fit: function(v){ if (has3D) VISOR3D.fit(v); }, clip: function(on){ if (has3D){ VISOR3D.setClip(on); } },
    _prj: function(){ return prj; }, _res: function(){ return res; }
  };
  $('file').addEventListener('change', function(){
    var f = this.files[0]; if (!f) return;
    var rd = new FileReader();
    rd.onload = function(){ try { var p = JSON.parse(rd.result); if (!p.comps || !p.design) throw new Error('formato'); prj = ensure(p); sel = { kind: 'design' }; renderAll(); } catch (e) { alert('Archivo no válido: ' + e.message); } };
    rd.readAsText(f); this.value = '';
  });
  $('editor').addEventListener('change', onInput);
  $('editor').addEventListener('input', function(e){ if (e.target.getAttribute('data-t') === 'num' || e.target.getAttribute('data-t') === 'txt') onInput(e); });
  $('sketch').addEventListener('click', function(e){
    var t = e.target, id = t.getAttribute('data-id'), nid = t.getAttribute('data-nid');
    if (id) APP.select('comp', id); else if (nid) APP.select('noz', nid);
  });
  $('u-si').classList.toggle('active', units === 'si'); $('u-us').classList.toggle('active', units === 'us');
  try { has3D = typeof VISOR3D !== 'undefined' && VISOR3D.init($('v3d'), function(kind, id){ APP.select(kind, id); }); } catch (e) { has3D = false; if (window.console) console.error(e); }
  if (!has3D){ $('bt3d').disabled = true; $('bt3d').title = 'WebGL no disponible'; }
  setView(view);
  function smShow(name){ $('smst').textContent = 'Ratón 3D: ' + name; }
  if (has3D){ VISOR3D.smStatus(smShow); $('smsens').value = String(VISOR3D.getSens()); $('sminv').checked = VISOR3D.getInv(); }
  renderAll();
})();

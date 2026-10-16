/* Interfaz del programa de cálculo de recipientes ASME VIII-1 */
(function(){
  'use strict';
  var M = VMODEL, V = VESSEL, C = VIII, MATS = window.ASME_MATERIALS;
  var units = 'si';
  try { if (localStorage.getItem('asme-units') === 'us') units = 'us'; } catch (e) {}
  var prj = load() || M.newProject('V');
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
  // área de raíz de rosca (in² → mm²) — roscas UNC hasta 1" y 8UN por encima (no procede de VIII-1: verificar)
  var BOLTS = [['1/2', 12.7, 0.126], ['5/8', 15.9, 0.202], ['3/4', 19.05, 0.302], ['7/8', 22.2, 0.419], ['1', 25.4, 0.551], ['1 1/8', 28.6, 0.728],
    ['1 1/4', 31.75, 0.929], ['1 3/8', 34.9, 1.155], ['1 1/2', 38.1, 1.405], ['1 5/8', 41.3, 1.680], ['1 3/4', 44.45, 1.980], ['1 7/8', 47.6, 2.304], ['2', 50.8, 2.652]];
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
  function compFields(c){
    var base = [{ t: 'txt', k: 'name', l: 'Denominación' }, { t: 'mat', k: 'mat', l: 'Material', filter: c.type === 'bflange' ? isForge : notBolt }];
    var tail = [{ t: 'num', k: 'c', l: 'Corrosión (vacío = general)', u: 'len', ph: 'general' },
      { t: 'num', k: 'E', l: 'Eficiencia E impuesta (vacío = automática)', ph: 'auto' }];
    var f;
    if (c.type === 'shell') f = [{ t: 'sel', k: 'basis', l: 'Diámetro dado como', o: [['id', 'Interior'], ['od', 'Exterior']], re: 1 },
      { t: 'num', k: 'D', l: c.basis === 'od' ? 'Diámetro exterior' : 'Diámetro interior', u: 'len' }, { t: 'num', k: 'L', l: 'Longitud', u: 'len' },
      { t: 'num', k: 'tn', l: 'Espesor nominal', u: 'len' }].concat(tail, [{ t: 'num', k: 'Ec', l: 'E junta circunferencial (vacío = auto)', ph: 'auto' }, { t: 'num', k: 'Lext', l: 'Longitud de cálculo a presión exterior (vacío = automática)', u: 'len', ph: 'auto' }]);
    else if (c.type === 'ellip') f = [{ t: 'num', k: 'D', l: 'Diámetro interior', u: 'len' }, { t: 'num', k: 'ratio', l: 'Relación D/2h' }, { t: 'num', k: 'sf', l: 'Faldón recto', u: 'len' },
      { t: 'num', k: 'tn', l: 'Espesor mínimo tras conformado', u: 'len' }, { t: 'chk', k: 'seamless', l: 'Fondo sin costura' }].concat(tail);
    else if (c.type === 'tori') f = [{ t: 'num', k: 'D', l: 'Diámetro interior', u: 'len' }, { t: 'num', k: 'Lc', l: 'Radio de corona L (vacío = D exterior)', u: 'len', ph: 'auto' },
      { t: 'num', k: 'rk', l: 'Radio de rebordeo r (vacío = 6 % D exterior)', u: 'len', ph: 'auto' }, { t: 'num', k: 'sf', l: 'Faldón recto', u: 'len' },
      { t: 'num', k: 'tn', l: 'Espesor mínimo tras conformado', u: 'len' }, { t: 'chk', k: 'seamless', l: 'Fondo sin costura' }].concat(tail);
    else if (c.type === 'hemi') f = [{ t: 'num', k: 'D', l: 'Diámetro interior', u: 'len' }, { t: 'num', k: 'sf', l: 'Faldón recto', u: 'len' },
      { t: 'num', k: 'tn', l: 'Espesor mínimo tras conformado', u: 'len' }, { t: 'chk', k: 'seamless', l: 'Fondo sin costura' }].concat(tail);
    else if (c.type === 'cone') f = [{ t: 'num', k: 'D', l: 'Diámetro interior extremo mayor', u: 'len' }, { t: 'num', k: 'Ds', l: 'Diámetro interior extremo menor', u: 'len' },
      { t: 'num', k: 'alpha', l: 'Semiángulo α (°)' }, { t: 'sel', k: 'largeAt', l: 'Extremo mayor hacia', o: [['base', 'la virola de origen'], ['away', 'el exterior']] },
      { t: 'num', k: 'tn', l: 'Espesor nominal', u: 'len' }].concat(tail);
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
      { t: 'num', k: 'Go', l: 'D.E. de contacto de la junta', u: 'len' }, { t: 'num', k: 'Gi', l: 'D.I. de contacto de la junta', u: 'len' },
      { t: 'sel', k: 'b0mode', l: 'Ancho básico b₀ (Tabla 2-5.2)', o: B0, re: 1 },
      /w/.test(c.b0mode) ? { t: 'num', k: 'w', l: 'w · ancho del resalte', u: 'len' } : null,
      c.b0mode === 'wT' ? { t: 'num', k: 'Tg', l: 'T · espesor de la junta', u: 'len' } : null,
      { t: 'num', k: 'Gfix', l: 'G impuesto (0 = calcular)', u: 'len' },
      { t: 'h', l: 'Pernos' },
      { t: 'mat', k: 'bmat', l: 'Material de pernos', filter: isBolt },
      { t: 'sel', k: 'bsize', l: 'Métrica (área de raíz UNC/8UN)', o: [['', 'Otra']].concat(BOLTS.map(function(b){ return [b[0], b[0] + '" · ' + fx(b[2] * 645.16, 1) + ' mm²']; })), re: 1 },
      { t: 'num', k: 'a', l: 'a · diámetro nominal', u: 'len' }, { t: 'num', k: 'Ar', l: 'Área de raíz por perno', u: 'a' }, { t: 'num', k: 'n', l: 'Número de pernos' },
      { t: 'h', l: 'Rigidez (2-14)' },
      { t: 'num', k: 'Ed', l: 'E a T de diseño (0 = de la carta del material)', u: 'mod' }, { t: 'num', k: 'Ea', l: 'E a T ambiente (0 = de la carta)', u: 'mod' }].filter(Boolean);
    return base.concat(f);
  }
  function nozFields(n){
    var host = prj.comps.filter(function(c){ return c.id === n.host; })[0], head = host && /ellip|tori|hemi/.test(host.type);
    return [
      { t: 'txt', k: 'mark', l: 'Marca' }, { t: 'txt', k: 'service', l: 'Servicio' },
      { t: 'sel', k: 'host', l: 'Componente', o: prj.comps.map(function(c){ return [c.id, c.name]; }), re: 1 },
      head ? { t: 'num', k: 'rad', l: 'Distancia radial al eje', u: 'len' } : { t: 'num', k: 'a', l: 'Distancia axial desde el inicio del componente', u: 'len' },
      { t: 'num', k: 'theta', l: 'Orientación θ (°, 0 = +X / derecha en el esquema)' },
      { t: 'h', l: 'Cuello' },
      { t: 'sel', k: 'nps', l: 'Tamaño nominal', o: [['', 'No normalizado']].concat(Object.keys(PIPE_OD).map(function(k){ return [k, 'NPS ' + k + ' · D.E. ' + PIPE_OD[k] + ' mm']; })), re: 1 },
      { t: 'num', k: 'od', l: 'Diámetro exterior', u: 'len' }, { t: 'num', k: 'tn', l: 'Espesor nominal del cuello', u: 'len' },
      { t: 'chk', k: 'pipe', l: 'Tubería (tolerancia −12,5 %)' },
      { t: 'mat', k: 'mat', l: 'Material del cuello', filter: isPipe },
      { t: 'num', k: 'proj', l: 'Proyección exterior hasta la cara de brida', u: 'len' },
      { t: 'num', k: 'hin', l: 'Proyección interior h', u: 'len' }, { t: 'num', k: 'ti', l: 'Espesor de la proyección interior', u: 'len' },
      { t: 'num', k: 'E1', l: 'E1 (1 si no atraviesa soldadura)' },
      { t: 'chk', k: 'access', l: 'Abertura de acceso o inspección (UG-45: t = ta)' },
      { t: 'h', l: 'Refuerzo' },
      { t: 'chk', k: 'pad', l: 'Con chapa de refuerzo', re: 1 },
      n.pad ? { t: 'num', k: 'Dp', l: 'Diámetro exterior del refuerzo', u: 'len' } : null,
      n.pad ? { t: 'num', k: 'te', l: 'Espesor del refuerzo', u: 'len' } : null,
      n.pad ? { t: 'mat', k: 'pmat', l: 'Material del refuerzo', filter: notBolt } : null,
      { t: 'num', k: 'leg41', l: 'Cateto soldadura exterior cuello', u: 'len' },
      n.pad ? { t: 'num', k: 'leg42', l: 'Cateto soldadura exterior refuerzo', u: 'len' } : null,
      { t: 'num', k: 'leg43', l: 'Cateto soldadura interior', u: 'len' },
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
    renderTreeStatus(); renderSummary(); renderSketch(); renderResult();
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
      '<div class="tree-h">Componentes</div>' + firstAdd +
      order.map(function(c){ return '<div class="node-row"><button type="button" class="node' + (sel.kind === 'comp' && sel.id === c.id ? ' on' : '') + '" onclick="APP.select(\'comp\',\'' + c.id + '\')"><span class="dot" id="st-' + c.id + '"></span>' + esc(c.name) + '<small>' + compLabel(c) + (c.id === prj.base ? ' · origen' : '') + '</small></button>' +
        (c.id !== prj.base ? '<button type="button" class="del" title="Eliminar" onclick="APP.delComp(\'' + c.id + '\')">✕</button>' : '') + '</div>'; }).join('') +
      lastAdd +
      '<div class="tree-h">Boquillas</div>' +
      prj.nozzles.map(function(n){ return '<div class="node-row"><button type="button" class="node' + (sel.kind === 'noz' && sel.id === n.id ? ' on' : '') + '" onclick="APP.select(\'noz\',\'' + n.id + '\')"><span class="dot" id="st-' + n.id + '"></span>' + esc(n.mark) + '<small>' + (n.nps ? 'NPS ' + n.nps : fmt(n.od, 'len')) + (n.fl.type !== 'none' ? ' · ' + n.fl.type + ' ' + n.fl.cls : '') + '</small></button><button type="button" class="del" title="Eliminar" onclick="APP.delNoz(\'' + n.id + '\')">✕</button></div>'; }).join('') +
      '<div class="addrow"><button type="button" class="btn sm" onclick="APP.addNoz()">+ Añadir boquilla</button></div>';
  }
  function renderTreeStatus(){
    if (!res) return;
    res.comps.forEach(function(r){ var e = $('st-' + r.c.id); if (e) e.className = 'dot ' + (r.ok ? 'ok' : 'ko'); });
    res.nozzles.forEach(function(r){ var e = $('st-' + r.n.id); if (e) e.className = 'dot ' + (r.ok ? 'ok' : 'ko'); });
    var e = $('st-design'); if (e) e.className = 'dot ' + (res.ok ? 'ok' : 'ko');
  }
  function currentObj(){
    if (sel.kind === 'design') return prj;
    if (sel.kind === 'comp') return prj.comps.filter(function(c){ return c.id === sel.id; })[0];
    return prj.nozzles.filter(function(n){ return n.id === sel.id; })[0];
  }
  function renderEditor(){
    var o = currentObj(); if (!o){ sel = { kind: 'design' }; o = prj; }
    var fl = sel.kind === 'design' ? designFields() : sel.kind === 'comp' ? compFields(o) : nozFields(o);
    var title = sel.kind === 'design' ? 'Proyecto y condiciones de diseño' : sel.kind === 'comp' ? (o.name + ' · ' + compLabel(o)) : ('Boquilla ' + o.mark);
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
    if (k === 'bsize'){ var b = BOLTS.filter(function(x){ return x[0] === v; })[0]; if (b){ o.a = b[1]; o.Ar = Math.round(b[2] * 645.16 * 10) / 10; } }
    if (k === 'nps' && PIPE_OD[v]) o.od = PIPE_OD[v];
    if (k === 'design.orient'){ prj.design.level = null; }
    if (k === 'name' || k === 'mark') renderTree();
    if (e.type === 'change' && (el.getAttribute('data-re') || k === 'gk' || k === 'bsize' || k === 'nps')){ renderTree(); renderEditor(); }
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
      tile('Masa', fmt(res.mass.empty, 'kg'), 'vacío · ' + fmt(res.mass.oper, 'kg') + ' servicio · ' + fmt(res.mass.test, 'kg') + ' prueba');
    var w = res.warn.map(function(x){ return '<li class="warn">' + esc(x) + '</li>'; }).join('');
    $('warns').innerHTML = w ? '<ul class="checks">' + w + '</ul>' : '';
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
    html += '<div class="st-h">MAWP referida a la parte superior por elemento</div><table class="steps"><tbody>' + res.mawpList.map(function(x){ return '<tr><td>' + esc(x.who) + '</td><td class="num">' + fmt(x.v, 'p') + '</td></tr>'; }).join('') + '</tbody></table>';
    return html;
  }
  function renderResult(){
    if (!res) return;
    var box = $('result'), html;
    if (sel.kind === 'design') html = '<div class="ed-title">Resumen del recipiente</div>' + designBlock();
    else if (sel.kind === 'comp'){ var r = res.byId[sel.id]; html = '<div class="ed-title">Resultados · ' + esc(r.c.name) + ' <span class="pill ' + (r.ok ? 'ok' : 'ko') + '">' + (r.ok ? 'CUMPLE' : 'NO CUMPLE') + '</span></div>' + compBlock(r, true); }
    else { var z = res.nozzles.filter(function(x){ return x.n.id === sel.id; })[0]; html = '<div class="ed-title">Resultados · boquilla ' + esc(z.n.mark) + ' <span class="pill ' + (z.ok ? 'ok' : 'ko') + '">' + (z.ok ? 'CUMPLE' : 'NO CUMPLE') + '</span></div>' + nozBlock(z, true); }
    box.innerHTML = html;
  }
  function pos(s){ return prj.design.orient === 'H' && prj.design.hdir === 'L' ? -s : s; }

  // ---------------- esquema ----------------
  function renderSketch(){
    if (!res) return;
    var d = prj.design, H = d.orient === 'H', Lr = res.L, sign = H && d.hdir === 'L' ? -1 : 1;
    var Rmax = 0; prj.comps.forEach(function(c){ Rmax = Math.max(Rmax, (c.type === 'bflange' ? c.A / 2 : ((c.D || c.d || 0) / 2 + c.tn))); });
    prj.nozzles.forEach(function(n){ Rmax = Math.max(Rmax, (prj.comps.filter(function(c){ return c.id === n.host; })[0] || {}).D / 2 + n.proj || 0); });
    var span = Lr.smax - Lr.smin, W = H ? 640 : 380, Hh = H ? 340 : 560, pad = 46;
    var sc = Math.min((H ? W : Hh) - 2 * pad, 1e9) / Math.max(span, 1), sr = ((H ? Hh : W) - 2 * pad) / (2 * Rmax || 1);
    sc = Math.min(sc, sr);
    // mapa (s, r) → pantalla
    var sCenter = (Lr.smin + Lr.smax) / 2;
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
      if (/ellip|tori|hemi/.test(host.type)){
        var prof = M.headProfile(host), rr = Math.min(n.rad || 0, host.D / 2 * 0.95), sl = 0;
        for (var k = 1; k < prof.length; k++){ if (prof[k][1] <= rr){ var f = (prof[k-1][1] - rr) / (prof[k-1][1] - prof[k][1] || 1); sl = prof[k-1][0] + f * (prof[k][0] - prof[k-1][0]); break; } }
        var s0 = p.side === 'start' ? p.s1 - sl : p.s0 + sl, dir = p.side === 'start' ? -1 : 1, x = rr * ct;
        var send = (p.side === 'start' ? p.s0 : p.s1) + dir * n.proj;
        var a1 = P(s0, x - n.od / 2), a2 = P(send, x - n.od / 2), a3 = P(send, x + n.od / 2), a4 = P(s0, x + n.od / 2);
        g += '<path class="' + cls + '" data-nid="' + n.id + '" d="' + path([a1, a2, a3, a4]) + '"/>';
        var lp = P(send + dir * 10 / sc, x); g += '<text class="nzt" x="' + lp[0] + '" y="' + lp[1] + '" text-anchor="middle">' + esc(n.mark) + '</text>';
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
          if (n.fl.type !== 'none') g += '<line class="fl" x1="' + f1[0] + '" y1="' + f1[1] + '" x2="' + f2[0] + '" y2="' + f2[1] + '"/>';
          var tp = P(s, r1 + sg * 18 / sc); g += '<text class="nzt" x="' + tp[0] + '" y="' + (tp[1] + 3) + '" text-anchor="middle">' + esc(n.mark) + '</text>';
        }
      }
      out += g;
    });
    // origen
    var o0 = P(0, 0);
    out += '<circle class="orig" cx="' + o0[0] + '" cy="' + o0[1] + '" r="4"/><text class="dim" x="' + (o0[0] + 7) + '" y="' + (o0[1] + 14) + '">0,0,0</text>';
    var ax = H ? P(Lr.smin, 0) : P(Lr.smin, 0);
    out += '<text class="axl" x="' + (H ? W - 16 : W / 2 + 6) + '" y="' + (H ? Hh / 2 - 6 : 14) + '">' + (H ? 'X' : 'Z') + '</text>';
    $('sketch').setAttribute('viewBox', '0 0 ' + W + ' ' + Hh);
    $('sketch').innerHTML = out;
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
    html += '<div class="m-sk">' + $('sketch').outerHTML.replace('id="sketch"', 'class="msk"') + '</div>';
    html += '<h2>2. Resumen</h2>' + designBlock();
    if (res.warn.length) html += '<ul class="checks">' + res.warn.map(function(w){ return '<li class="warn">' + esc(w) + '</li>'; }).join('') + '</ul>';
    html += '<h2>3. Componentes</h2>';
    res.comps.forEach(function(r, k){ html += '<h3>3.' + (k + 1) + ' ' + esc(r.c.name) + ' · ' + compLabel(r.c) + ' — ' + (r.ok ? 'CUMPLE' : 'NO CUMPLE') + '</h3>' + compBlock(r, true); });
    if (res.nozzles.length){ html += '<h2>4. Boquillas</h2>'; res.nozzles.forEach(function(r, k){ html += '<h3>4.' + (k + 1) + ' ' + esc(r.n.mark) + (r.n.service ? ' · ' + esc(r.n.service) : '') + ' — ' + (r.ok ? 'CUMPLE' : 'NO CUMPLE') + '</h3>' + nozBlock(r, true); }); }
    html += '<h2>' + (res.nozzles.length ? 5 : 4) + '. Alcance y limitaciones</h2><ul class="lim">' +
      ['Presión interior (UG-27, UG-32, UG-34, Ap. 1 y 2) y exterior (UG-28, UG-33, II-D Subparte 3). Sin anillos rigidizadores (UG-29) ni uniones cono-cilindro (Ap. 1-5, 1-8).',
       'No incluye cargas de UG-22 distintas de la presión y la columna de líquido: viento, sismo, peso, soportes, cargas en boquillas (fase 3).',
       'Boquillas: área de refuerzo UG-37/UG-40 y espesor UG-45; no incluye resistencia de soldaduras (UG-41) ni aberturas múltiples (UG-42).',
       'Tensiones admisibles: ASME II-D (Metric) 2015. Ratings de bridas: ASME B16.5-2013. MDMT: Fig. UCS-66.1M digitalizada.',
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
    _prj: function(){ return prj; }, _res: function(){ return res; }
  };
  $('file').addEventListener('change', function(){
    var f = this.files[0]; if (!f) return;
    var rd = new FileReader();
    rd.onload = function(){ try { var p = JSON.parse(rd.result); if (!p.comps || !p.design) throw new Error('formato'); prj = p; sel = { kind: 'design' }; renderAll(); } catch (e) { alert('Archivo no válido: ' + e.message); } };
    rd.readAsText(f); this.value = '';
  });
  $('editor').addEventListener('change', onInput);
  $('editor').addEventListener('input', function(e){ if (e.target.getAttribute('data-t') === 'num' || e.target.getAttribute('data-t') === 'txt') onInput(e); });
  $('sketch').addEventListener('click', function(e){
    var t = e.target, id = t.getAttribute('data-id'), nid = t.getAttribute('data-nid');
    if (id) APP.select('comp', id); else if (nid) APP.select('noz', nid);
  });
  $('u-si').classList.toggle('active', units === 'si'); $('u-us').classList.toggle('active', units === 'us');
  renderAll();
})();

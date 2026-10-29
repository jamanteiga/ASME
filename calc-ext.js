/* Interfaz de los módulos complementarios: normativa europea, elementos adicionales y fabricación/dossier.
   calculo.js llama a CALCEXT(H) con sus utilidades (formato, tablas, filtros de material, acceso al proyecto). */
window.CALCEXT = function(H){
  'use strict';
  var esc = H.esc, fmt = H.fmt, kv = H.kv, checksHtml = H.checksHtml, stepsHtml = H.stepsHtml, fx = H.fx, V = H.V, M = H.M;
  function P(){ return H.prj(); } function RES(){ return H.res(); }
  function F(){ var r = RES(); return (r && r.fab) || {}; } function D(){ var r = RES(); return (r && r.doc) || {}; }
  function n0(x){ return x == null || isNaN(x) ? '–' : fx(x, 0); } function n1(x){ return x == null || isNaN(x) ? '–' : fx(x, 1); } function n2(x){ return x == null || isNaN(x) ? '–' : fx(x, 2); }
  var GROUPS = [
    { g: 'Normativa europea', items: [['eu', 'PED 2014/68/UE y EN 13445-3']] },
    { g: 'Elementos adicionales', items: [['jacket', 'Camisa y media caña'], ['uhx', 'Placa tubular (tubos en U)'], ['fat', 'Cribado de fatiga'], ['lift', 'Izado'], ['mh', 'Boca de hombre y pescante'], ['wrc', 'Cargas locales WRC 107/537']] },
    { g: 'Fabricación y dossier', items: [['bom', 'Lista de materiales'], ['welds', 'Mapa de soldaduras y WPS'], ['itp', 'PPI y placa de características'], ['nest', 'Desarrollos y aprovechamiento'], ['plano', 'Plano de fabricación'], ['cost', 'Presupuesto'], ['opt', 'Optimizador de espesores'], ['revs', 'Revisiones y firmas']] }
  ];
  var KINDS = {}; GROUPS.forEach(function(g){ g.items.forEach(function(i){ KINDS[i[0]] = i[1]; }); });
  function isKind(k){ return !!KINDS[k]; }
  function title(k){ return KINDS[k]; }
  function sub(k){
    var p = P(), f = F(), d = D();
    if (k === 'eu') return f.ped ? 'PED cat. ' + (f.ped.cat === 'SEP' ? 'art. 4(3)' : f.ped.cat === 'excl' ? 'excluido' : f.ped.cat) + (p.en.on ? ' · EN 13445' : '') : 'desactivado';
    if (k === 'jacket') return [p.jacket.on ? 'camisa' : '', p.hp.on ? 'media caña' : ''].filter(Boolean).join(' · ') || 'no';
    if (k === 'uhx') return p.uhx.on ? 'configuración ' + p.uhx.cfg : 'no';
    if (k === 'fat') return f.fat ? 'Σ ' + n0(f.fat.sum) + ' / ' + f.fat.lim : 'no';
    if (k === 'lift') return p.lift.on ? (f.lift ? n1(f.lift.F / 1000) + ' kN por orejeta' : '') : 'no';
    if (k === 'mh') return p.mh.on ? 'conexión ' + (f.mh && f.mh.n ? f.mh.n.mark : '?') : 'no';
    if (k === 'wrc') return p.wrc.on ? (p.wrc.list.length + ' conexiones') : 'no';
    if (k === 'bom') return d.bom ? d.bom.items.length + ' posiciones · ' + n0(d.bom.total) + ' kg' : '';
    if (k === 'welds') return d.welds ? d.welds.list.length + ' soldaduras · ' + n1(d.welds.kg) + ' kg' : '';
    if (k === 'itp') return d.itp ? d.itp.rows.length + ' actividades' : '';
    if (k === 'nest') return d.nest ? d.nest.groups.reduce(function(a, g){ return a + g.plates.length; }, 0) + ' chapas · ' + n0(d.nest.kg) + ' kg' : '';
    if (k === 'cost') return d.cost ? n0(d.cost.total) + ' €' : '';
    if (k === 'plano') return p.fab.sheet || 'A1';
    if (k === 'revs') return 'rev. ' + (p.fab.revs.length ? p.fab.revs[p.fab.revs.length - 1].rev : '0');
    return '';
  }
  function status(k){
    var p = P(), f = F(), d = D();
    function okv(o){ return o ? (o.ok === false ? 'ko' : 'ok') : ''; }
    if (k === 'eu') return f.en && f.en.ok === false ? 'ko' : f.ped ? (f.ped.req && f.ped.req.some(function(q){ return !q.ok && !q.warn && !q.info; }) ? 'ko' : 'ok') : '';
    if (k === 'jacket') return (f.jacket && f.jacket.ok === false) || (f.hp && f.hp.ok === false) ? 'ko' : (f.jacket || f.hp ? 'ok' : '');
    if (k === 'uhx') return okv(f.uhx); if (k === 'fat') return okv(f.fat); if (k === 'lift') return okv(f.lift); if (k === 'mh') return okv(f.mh);
    if (k === 'wrc') return f.wrc ? (f.wrc.every(function(w){ return w.ok !== false; }) ? 'ok' : 'ko') : '';
    if (k === 'welds') return d.welds ? (d.welds.bad ? 'ko' : 'ok') : '';
    if (k === 'nest') return d.nest ? (d.nest.groups.some(function(g){ return g.unplaced.length; }) ? 'ko' : 'ok') : '';
    if (d.err) return 'ko';
    return d.bom ? 'ok' : '';
  }
  function tree(sel){
    return GROUPS.map(function(g){
      return '<div class="tree-h">' + esc(g.g) + '</div>' + g.items.map(function(i){
        return '<button type="button" class="node' + (sel.kind === i[0] ? ' on' : '') + '" onclick="APP.select(\'' + i[0] + '\')"><span class="dot ' + status(i[0]) + '" id="st-x-' + i[0] + '"></span>' + esc(i[1]) + '<small>' + esc(sub(i[0])) + '</small></button>';
      }).join('<div style="height:5px"></div>');
    }).join('');
  }
  function treeStatus(){ Object.keys(KINDS).forEach(function(k){ var e = document.getElementById('st-x-' + k); if (e) e.className = 'dot ' + status(k); }); }

  // ---------------- formularios ----------------
  function shellOpts(){ return P().comps.filter(function(c){ return c.type === 'shell'; }).map(function(c){ return [c.id, c.name]; }); }
  function nozOpts(blank){ return (blank ? [['', '— elegir —']] : []).concat(P().nozzles.map(function(n){ return [n.id, n.mark + (n.service ? ' · ' + n.service : '') + (n.nps ? ' · NPS ' + n.nps : '')]; })); }
  function fields(k){
    var p = P(), f = [];
    if (k === 'eu'){
      var est = {};
      f = [{ t: 'h', l: 'PED 2014/68/UE · clasificación (art. 13 y anexo II)' }, { t: 'chk', k: 'ped.on', l: 'Clasificar según la Directiva de equipos a presión', re: 1 }];
      if (p.ped.on) f = f.concat([
        { t: 'sel', k: 'ped.state', l: 'Estado del fluido a la TS máxima', o: [['liq', 'Líquido (presión de vapor ≤ 0,5 bar sobre la atmosférica)'], ['gas', 'Gas, gas licuado, vapor o líquido con presión de vapor > 0,5 bar']], re: 1 },
        { t: 'sel', k: 'ped.group', l: 'Grupo del fluido (art. 13)', o: [['1', 'Grupo 1: peligrosos (explosivos, inflamables, tóxicos, comburentes…; CLP)'], ['2', 'Grupo 2: el resto (agua, vapor, aire, nitrógeno…)']], re: 1 },
        p.ped.state === 'gas' && p.ped.group === '1' ? { t: 'chk', k: 'ped.unstable', l: 'Gas inestable (mínimo categoría III)' } : null,
        { t: 'num', k: 'ped.PS', l: 'PS · presión máxima admisible (vacío = MAWP del recipiente)', u: 'p', ph: 'MAWP' },
        { t: 'num', k: 'ped.vol', l: 'V · volumen en litros (vacío = volumen interior calculado)', ph: 'auto' },
        { t: 'num', k: 'ped.TSmin', l: 'TS mínima (vacío = MDMT)', u: 't', ph: 'MDMT' }, { t: 'num', k: 'ped.TSmax', l: 'TS máxima (vacío = T de diseño)', u: 't', ph: 'T diseño' },
        { t: 'txt', k: 'ped.nb', l: 'Número del organismo notificado (marcado CE)' }]);
      f = f.concat([{ t: 'h', l: 'EN 13445-3 · cálculo comparativo' }, { t: 'chk', k: 'en.on', l: 'Comparar los espesores con EN 13445-3', re: 1 }]);
      if (p.en.on){
        f.push({ t: 'num', k: 'en.tol', l: 'Tolerancia negativa de la chapa δ (EN 10029 clase B: 0,3 mm)', u: 'len' });
        f.push({ t: 'info', html: 'Propiedades EN por componente: vacío = valores de II-D a 20 °C con reducción genérica de EN 10028 (P265GH ferrítico, 1.4307 austenítico). Introducir los del certificado o de la norma de producto para un cálculo definitivo.' });
        var res = RES();
        p.comps.forEach(function(c){ if (!/shell|cone|ellip|tori|hemi/.test(c.type)) return; var pp = FAB.props(p, c.mat, p.design.T, c.id); if (!pp) return;
          f.push({ t: 'num', k: 'en.props.' + c.id + '.RpT', l: c.name + ' · Rp' + (pp.aus ? '1,0' : '0,2') + '/T (vacío = ' + n0(pp.est ? pp.RpT : pp.Rp20 * 1) + ')', u: 's', ph: n0(pp.est ? pp.RpT : '') });
          f.push({ t: 'num', k: 'en.props.' + c.id + '.Rm', l: c.name + ' · Rm a 20 °C (vacío = ' + n0(pp.Rm) + ')', u: 's', ph: n0(pp.Rm) });
        });
      }
    }
    if (k === 'jacket'){
      f = [{ t: 'h', l: 'Camisa (VIII-1 Ap. 9)' }, { t: 'chk', k: 'jacket.on', l: 'Recipiente con camisa', re: 1 }];
      if (p.jacket.on) f = f.concat([{ t: 'sel', k: 'jacket.host', l: 'Virola encamisada', o: shellOpts() },
        { t: 'sel', k: 'jacket.type', l: 'Tipo (Fig. 9-2)', o: [['1', 'Tipo 1: solo virola'], ['2', 'Tipo 2: virola y un fondo'], ['4', 'Tipo 4: con anillos de rigidez'], ['5', 'Tipo 5: virola y parte de un fondo']], re: 1 },
        { t: 'sel', k: 'jacket.closure', l: 'Cierre (Fig. 9-5)', o: [['a', '(a) cierre rebordeado de la propia camisa'], ['b', '(b-1)/(b-2) cierre cónico o rebordeado'], ['b3', '(b-3) cierre con radio'], ['de', '(d)/(e) anillo de cierre soldado (solo tipo 1)'], ['f', '(f-1)…(f-3) barra de cierre']] },
        { t: 'num', k: 'jacket.Dj', l: 'Diámetro interior de la camisa', u: 'len' }, { t: 'num', k: 'jacket.tj', l: 'Espesor de la camisa', u: 'len' },
        { t: 'num', k: 'jacket.cj', l: 'Corrosión en la cámara (camisa y exterior de la virola)', u: 'len' }, { t: 'num', k: 'jacket.tc', l: 'Espesor del cierre tc', u: 'len' },
        { t: 'num', k: 'jacket.P', l: 'Presión de diseño de la camisa', u: 'p' }, { t: 'num', k: 'jacket.T', l: 'Temperatura de diseño de la camisa', u: 't' },
        { t: 'num', k: 'jacket.L', l: 'Longitud de cálculo L (vacío = longitud de la virola)', u: 'len', ph: 'auto' },
        { t: 'chk', k: 'jacket.vac', l: 'Vacío total en el recipiente interior simultáneo con la presión de la camisa' },
        { t: 'mat', k: 'jacket.mat', l: 'Material de la camisa y los cierres', filter: H.isPlate }]);
      f = f.concat([{ t: 'h', l: 'Media caña (VIII-1 Ap. EE)' }, { t: 'chk', k: 'hp.on', l: 'Serpentín exterior de media caña', re: 1 }]);
      if (p.hp.on) f = f.concat([{ t: 'sel', k: 'hp.host', l: 'Virola', o: shellOpts() }, { t: 'sel', k: 'hp.nps', l: 'Tamaño', o: [['2', 'NPS 2 (D.E. 60,3)'], ['3', 'NPS 3 (D.E. 88,9)'], ['4', 'NPS 4 (D.E. 114,3)']] },
        { t: 'num', k: 'hp.tj', l: 'Espesor de la media caña', u: 'len' }, { t: 'num', k: 'hp.cj', l: 'Corrosión', u: 'len' },
        { t: 'num', k: 'hp.P', l: 'Presión de diseño de la media caña P1', u: 'p' }, { t: 'num', k: 'hp.T', l: 'Temperatura de diseño', u: 't' },
        { t: 'num', k: 'hp.K', l: 'K de las Figs. EE-1 a EE-3 (según NPS, D y ts)' },
        { t: 'num', k: 'hp.Fax', l: 'Fuerza axial en la virola (+ tracción)', u: 'f' }, { t: 'num', k: 'hp.Mb', l: 'Momento flector en la virola', u: 'm' },
        { t: 'num', k: 'hp.pitch', l: 'Paso de la hélice', u: 'len' }, { t: 'num', k: 'hp.turns', l: 'Número de vueltas (vacío = las que caben)', ph: 'auto' },
        { t: 'mat', k: 'hp.mat', l: 'Material de la media caña (tubo)', filter: H.isPipe }]);
    }
    if (k === 'uhx'){
      var U = p.uhx;
      f = [{ t: 'h', l: 'Placa tubular de intercambiador de tubos en U (UHX-12)' }, { t: 'chk', k: 'uhx.on', l: 'Calcular placa tubular', re: 1 }];
      if (U.on) f = f.concat([
        { t: 'sel', k: 'uhx.cfg', l: 'Configuración (Fig. UHX-12.1)', o: [['a', 'a · integral con la envolvente y el canal'], ['d', 'd · con junta en la envolvente y el canal']], re: 1 },
        { t: 'sel', k: 'uhx.pat', l: 'Disposición de tubos', o: [['tri', 'Triangular equilátera'], ['sq', 'Cuadrada']] },
        { t: 'num', k: 'uhx.A', l: 'Diámetro exterior de la placa A', u: 'len' }, { t: 'num', k: 'uhx.h', l: 'Espesor de la placa h', u: 'len' },
        { t: 'num', k: 'uhx.dt', l: 'D.E. de los tubos dt', u: 'len' }, { t: 'num', k: 'uhx.tt', l: 'Espesor de los tubos tt', u: 'len' },
        { t: 'num', k: 'uhx.p', l: 'Paso p', u: 'len' }, { t: 'num', k: 'uhx.ro', l: 'Radio al centro del tubo más exterior ro', u: 'len' },
        { t: 'num', k: 'uhx.UL1', l: 'Distancia entre filas del pasillo sin tubos UL1 (0 = sin pasillo)', u: 'len' }, { t: 'num', k: 'uhx.LL1', l: 'Longitud del pasillo LL1 (vacío = Do)', u: 'len', ph: 'Do' },
        { t: 'num', k: 'uhx.rho', l: 'Relación de expandido ρ = ℓtx/h (0 a 1)' }, { t: 'num', k: 'uhx.ct', l: 'Corrosión de la placa, lado tubos', u: 'len' }, { t: 'num', k: 'uhx.hg', l: 'Profundidad de la ranura de partición hg', u: 'len' },
        { t: 'mat', k: 'uhx.mat', l: 'Material de la placa', filter: H.isForgePlate }, { t: 'mat', k: 'uhx.tmat', l: 'Material de los tubos', filter: H.isPipe },
        U.cfg === 'a' ? { t: 'num', k: 'uhx.Ds', l: 'D.I. de la envolvente Ds', u: 'len' } : null, U.cfg === 'a' ? { t: 'num', k: 'uhx.ts', l: 'Espesor de la envolvente ts', u: 'len' } : null,
        U.cfg === 'a' ? { t: 'mat', k: 'uhx.smat', l: 'Material de la envolvente', filter: H.isPlate } : null,
        U.cfg === 'a' ? { t: 'num', k: 'uhx.Dc', l: 'D.I. del canal Dc', u: 'len' } : null, U.cfg === 'a' ? { t: 'num', k: 'uhx.tc', l: 'Espesor del canal tc', u: 'len' } : null,
        U.cfg === 'a' ? { t: 'mat', k: 'uhx.cmat', l: 'Material del canal', filter: H.isPlate } : null,
        U.cfg === 'd' ? { t: 'num', k: 'uhx.Gs', l: 'Diámetro de reacción de la junta, envolvente Gs', u: 'len' } : null, U.cfg === 'd' ? { t: 'num', k: 'uhx.Gc', l: 'Diámetro de reacción de la junta, canal Gc', u: 'len' } : null,
        U.cfg === 'd' ? { t: 'num', k: 'uhx.W', l: 'Carga de pernos W* (Tabla UHX-8.1)', u: 'f' } : null,
        { t: 'num', k: 'uhx.Psmax', l: 'Presión de diseño lado envolvente máxima', u: 'p' }, { t: 'num', k: 'uhx.Psmin', l: 'Lado envolvente mínima (negativa si vacío)', u: 'p' },
        { t: 'num', k: 'uhx.Ptmax', l: 'Presión de diseño lado tubos máxima', u: 'p' }, { t: 'num', k: 'uhx.Ptmin', l: 'Lado tubos mínima (negativa si vacío)', u: 'p' },
        { t: 'num', k: 'uhx.T', l: 'Temperatura de diseño de la placa', u: 't' },
        { t: 'h', l: 'Valores impuestos (vacío = II-D)' }, { t: 'num', k: 'uhx.S', l: 'S placa', u: 's', ph: 'II-D' }, { t: 'num', k: 'uhx.St', l: 'St tubos (equivalente sin soldadura)', u: 's', ph: 'II-D' },
        { t: 'num', k: 'uhx.E', l: 'E placa', u: 'mod', ph: 'II-D' }, { t: 'num', k: 'uhx.Et', l: 'Et tubos', u: 'mod', ph: 'II-D' }]).filter(Boolean);
    }
    if (k === 'fat'){
      f = [{ t: 'h', l: 'Cribado de fatiga · VIII-2 5.5.2.3 (método A)' }, { t: 'chk', k: 'fat.on', l: 'Evaluar la necesidad de análisis de fatiga', re: 1 }];
      if (p.fat.on) f = f.concat([{ t: 'sel', k: 'fat.constr', l: 'Construcción', o: [['int', 'Integral (soldaduras de penetración total)'], ['non', 'No integral (refuerzos con chapa, penetración parcial)']] },
        { t: 'chk', k: 'fat.knuckle', l: 'Hay conexiones o accesorios en la zona de rebordeo de fondos' },
        { t: 'num', k: 'fat.NFP', l: 'Ciclos de presión completos previstos (vida útil)' }, { t: 'num', k: 'fat.NPO', l: 'Ciclos de operación con ΔP > 20 % (15 % no integral) de la presión de diseño' },
        { t: 'num', k: 'fat.NTa', l: 'Ciclos térmicos en uniones de materiales con distinto α' },
        { t: 'area', k: 'fat.cycles', l: 'Ciclos térmicos: una línea por tipo «ΔT entre puntos adyacentes (°C) ; número de ciclos»', ph: '60 ; 500', rows: 3 }]);
    }
    if (k === 'lift'){
      f = [{ t: 'h', l: 'Izado' }, { t: 'chk', k: 'lift.on', l: 'Comprobar orejetas de izado y el recipiente durante el izado', re: 1 }];
      if (p.lift.on) f = f.concat([{ t: 'sel', k: 'lift.mode', l: 'Maniobra', o: [['tail', 'Volteo: orejetas principales + orejeta de cola'], ['two', 'Horizontal con dos puntos de izado']] },
        { t: 'num', k: 'lift.n', l: 'Número de orejetas principales' }, { t: 'num', k: 'lift.Cd', l: 'Coeficiente dinámico (1,5 – 2,0)' },
        { t: 'num', k: 'lift.phi', l: 'Ángulo de la eslinga respecto a la vertical (°)' }, { t: 'num', k: 'lift.rig', l: 'Masa de aparejos y accesorios no modelados', u: 'kg' },
        { t: 'num', k: 'lift.sLug', l: 'Posición axial de las orejetas principales (vacío = extremo − 300)', u: 'len', ph: 'auto' }, { t: 'num', k: 'lift.sTail', l: 'Posición axial de la orejeta de cola o segundo punto (vacío = extremo + 200)', u: 'len', ph: 'auto' },
        { t: 'h', l: 'Orejeta' }, { t: 'num', k: 'lift.t', l: 'Espesor t', u: 'len' }, { t: 'num', k: 'lift.b', l: 'Longitud de la base b', u: 'len' },
        { t: 'num', k: 'lift.H', l: 'Altura base → centro del taladro H', u: 'len' }, { t: 'num', k: 'lift.R', l: 'Radio exterior del ojo R', u: 'len' },
        { t: 'num', k: 'lift.dh', l: 'Diámetro del taladro dh', u: 'len' }, { t: 'num', k: 'lift.dp', l: 'Diámetro del bulón del grillete dp', u: 'len' },
        { t: 'num', k: 'lift.w', l: 'Cateto de la soldadura w', u: 'len' }, { t: 'num', k: 'lift.Fexx', l: 'Resistencia del metal de aporte Fexx', u: 's' },
        { t: 'mat', k: 'lift.mat', l: 'Material de la orejeta', filter: H.isPlate }]);
    }
    if (k === 'mh'){
      f = [{ t: 'h', l: 'Boca de hombre y pescante' }, { t: 'chk', k: 'mh.on', l: 'Comprobar la tapa y el pescante', re: 1 }];
      if (p.mh.on) f = f.concat([{ t: 'sel', k: 'mh.noz', l: 'Conexión que actúa como boca de hombre', o: nozOpts(true) },
        { t: 'num', k: 'mh.Dc', l: 'Diámetro de la tapa (vacío = brida ciega B16.5)', u: 'len', ph: 'B16.5' }, { t: 'num', k: 'mh.tc', l: 'Espesor de la tapa (vacío = B16.5)', u: 'len', ph: 'B16.5' },
        { t: 'num', k: 'mh.mcover', l: 'Masa de la tapa (vacío = calculada)', u: 'kg', ph: 'auto' }, { t: 'num', k: 'mh.Cd', l: 'Coeficiente dinámico' },
        { t: 'num', k: 'mh.L', l: 'Alcance del brazo (eje del poste → centro de la tapa)', u: 'len' }, { t: 'num', k: 'mh.s', l: 'Distancia entre los soportes del poste', u: 'len' },
        { t: 'num', k: 'mh.pod', l: 'D.E. del poste', u: 'len' }, { t: 'num', k: 'mh.pt', l: 'Espesor del poste', u: 'len' },
        { t: 'num', k: 'mh.armOd', l: 'D.E. del brazo', u: 'len' }, { t: 'num', k: 'mh.armT', l: 'Espesor del brazo', u: 'len' },
        { t: 'mat', k: 'mh.mat', l: 'Material del pescante (tubo)', filter: H.isPipe },
        { t: 'info', html: 'Las dimensiones de ASME B16.47 (bridas > NPS 24) no están incluidas: para bocas mayores introducir el diámetro y el espesor de la tapa.' }]);
    }
    if (k === 'wrc'){
      f = [{ t: 'h', l: 'Tensiones locales en la virola · WRC 107 / WRC 537' }, { t: 'chk', k: 'wrc.on', l: 'Evaluar cargas locales en conexiones', re: 1 }];
      if (p.wrc.on){
        f.push({ t: 'sel', k: 'wrc.mode', l: 'Combinación de contribuciones', o: [['abs', 'Conservadora (suma de valores absolutos)'], ['sign', 'Con signos (P + saliente, ML + tracciona A, Mc + tracciona C)']] });
        f.push({ t: 'info', html: 'Los coeficientes adimensionales se leen en las curvas del boletín WRC 537 (o 107) para γ y β, que se muestran en los resultados. <button type="button" class="btn sm" onclick="APP.ext(\'wrcAdd\')">+ Añadir conexión</button> <button type="button" class="btn sm" onclick="APP.ext(\'wrcAll\')">+ Todas las tubuladuras con cargas</button>' });
        p.wrc.list.forEach(function(w, i){
          var b = 'wrc.list.' + i + '.';
          f = f.concat([{ t: 'h', l: 'Conexión ' + ((p.nozzles.filter(function(n){ return n.id === w.noz; })[0] || {}).mark || '?') }, { t: 'sel', k: b + 'noz', l: 'Conexión', o: nozOpts(), re: 1 },
            { t: 'info', html: '<button type="button" class="btn sm" onclick="APP.ext(\'wrcDel\',' + i + ')">✕ Quitar</button> ' },
            { t: 'chk', k: b + 'link', l: 'Usar las cargas introducidas en la tubuladura', re: 1 }]);
          if (w.link === false) f = f.concat([{ t: 'num', k: b + 'P', l: 'P radial (+ saliente)', u: 'f' }, { t: 'num', k: b + 'MT', l: 'MT torsor', u: 'm' },
            { t: 'num', k: b + 'Mc', l: 'Mc circunferencial', u: 'm' }, { t: 'num', k: b + 'ML', l: 'ML longitudinal', u: 'm' },
            { t: 'num', k: b + 'Vc', l: 'Vc cortante circunferencial', u: 'f' }, { t: 'num', k: b + 'VL', l: 'VL cortante longitudinal', u: 'f' }]);
          FAB.WRC_K.forEach(function(q){ f.push({ t: 'num', k: b + q[0], l: q[1] + ' · curva ' + q[2] }); });
        });
      }
    }
    if (k === 'bom') f = [{ t: 'h', l: 'Dossier' }, { t: 'txt', k: 'fab.dossier.doc', l: 'Nº de documento / pedido' }, { t: 'txt', k: 'fab.dossier.client', l: 'Pedido del cliente' },
      { t: 'info', html: 'Certificados: EN 10204 3.1 para partes a presión y accesorios soldados a ellas; 2.2 para el resto. <button type="button" class="btn sm" onclick="APP.ext(\'csv\',\'bom\')">Descargar CSV</button>' }];
    if (k === 'welds'){
      f = [{ t: 'h', l: 'Especificaciones de procedimiento (ASME IX)' },
        { t: 'area', k: 'fab.wps', l: 'Una WPS por línea: «WPS ; proceso ; butt|fillet ; P-No 1 ; P-No 2 ; espesor del cupón del PQR (mm) ; PQR ; PWHT»', rows: 6, note: 'Rango de espesor cualificado según QW-451.1 a partir del espesor del cupón. Las WPS a tope cualifican también uniones en ángulo (QW-202.2(c)).' },
        { t: 'info', html: '<button type="button" class="btn sm" onclick="APP.ext(\'csv\',\'welds\')">Descargar CSV</button>' }, { t: 'h', l: 'Asignación manual (vacío = automática)' }];
      var wl = FABDOC.parseWps(p.fab.wps), d = D();
      if (d.welds) d.welds.list.forEach(function(w){ f.push({ t: 'sel', k: 'fab.wmap.' + w.id, l: w.id + ' · ' + w.desc, o: [['', 'Automática' + (w.wps && w.wps !== '—' ? ' (' + w.wps + ')' : '')]].concat(wl.map(function(x){ return [x.id, x.id + ' · ' + x.proc + ' · ' + x.joint]; })) }); });
    }
    if (k === 'itp') f = [{ t: 'h', l: 'Placa de características (UG-116)' }, { t: 'txt', k: 'fab.plate.mfr', l: 'Fabricante' }, { t: 'txt', k: 'fab.plate.serial', l: 'Nº de fabricación' },
      { t: 'txt', k: 'fab.plate.year', l: 'Año' }, { t: 'txt', k: 'fab.plate.nb', l: 'Organismo notificado (CE xxxx)' }, { t: 'chk', k: 'fab.stamp', l: 'Equipo con símbolo de certificación ASME (U)' },
      { t: 'info', html: '<button type="button" class="btn sm" onclick="APP.ext(\'plateSvg\')">Descargar placa (SVG)</button> <button type="button" class="btn sm" onclick="APP.ext(\'csv\',\'itp\')">PPI en CSV</button>' }];
    if (k === 'nest') f = [{ t: 'h', l: 'Formatos y corte' }, { t: 'txt', k: 'fab.plates', l: 'Formatos comerciales disponibles (ancho×largo, separados por «;»)' },
      { t: 'num', k: 'fab.kerf', l: 'Ancho de corte (sangría)', u: 'len' }, { t: 'num', k: 'fab.edge', l: 'Saneado de bordes', u: 'len' },
      { t: 'chk', k: 'fab.rot', l: 'Permitir girar piezas 90° (dirección de laminación indiferente)' }, { t: 'chk', k: 'fab.nestHeads', l: 'Incluir los discos de los fondos (si no se compran conformados)' },
      { t: 'num', k: 'fab.thin', l: 'Adelgazamiento por conformado de fondos (%)' }, { t: 'num', k: 'fab.ringSeg', l: 'Segmentos mínimos de anillos y bridas planas (1 = entero si cabe)' },
      { t: 'info', html: '<button type="button" class="btn sm" onclick="APP.ext(\'nestDxf\')">Descargar despiece (DXF)</button> <button type="button" class="btn sm" onclick="APP.ext(\'csv\',\'nest\')">Lista de corte (CSV)</button>' }];
    if (k === 'plano') f = [{ t: 'h', l: 'Plano' }, { t: 'sel', k: 'fab.sheet', l: 'Formato', o: [['A1', 'A1 (841 × 594)'], ['A2', 'A2 (594 × 420)'], ['A3', 'A3 (420 × 297)'], ['A0', 'A0 (1189 × 841)']], re: 1 },
      { t: 'txt', k: 'fab.dwg', l: 'Nº de plano' }, { t: 'txt', k: 'fab.dossier.firm', l: 'Empresa (cajetín)' },
      { t: 'info', html: '<button type="button" class="btn sm" onclick="APP.ext(\'planoDxf\')">Descargar plano (DXF)</button> <button type="button" class="btn sm" onclick="APP.ext(\'planoSvg\')">Descargar plano (SVG)</button>' }];
    if (k === 'cost'){
      f = [{ t: 'h', l: 'Precios de material (€/kg)' }];
      [['CS', 'Acero al carbono'], ['LA', 'Baja aleación'], ['SS', 'Inoxidable'], ['AL', 'Aluminio'], ['CU', 'Cobre'], ['NI', 'Níquel'], ['TI', 'Titanio']].forEach(function(x){ f.push({ t: 'num', k: 'fab.price.' + x[0], l: x[1] }); });
      f = f.concat([{ t: 'num', k: 'fab.price.head', l: 'Factor de fondo conformado (× chapa)' }, { t: 'num', k: 'fab.price.pipeF', l: 'Factor de tubo (× chapa)' }, { t: 'num', k: 'fab.price.forge', l: 'Factor de forja (× chapa)' },
        { t: 'num', k: 'fab.price.bolt', l: 'Espárrago con tuercas (€/ud)' }, { t: 'num', k: 'fab.price.gasket', l: 'Junta (€/ud)' },
        { t: 'h', l: 'Mano de obra y servicios' }, { t: 'num', k: 'fab.price.labour', l: 'Mano de obra (€/h)' }, { t: 'num', k: 'fab.price.fitup', l: 'Armado y preparación (fracción del tiempo de arco)' },
        { t: 'num', k: 'fab.price.RT', l: 'RT (€/m)' }, { t: 'num', k: 'fab.price.UT', l: 'UT (€/m)' }, { t: 'num', k: 'fab.price.PT', l: 'LP (€/m)' }, { t: 'num', k: 'fab.price.MT', l: 'MT (€/m)' }, { t: 'num', k: 'fab.price.VT', l: 'VT (€/m)' },
        { t: 'num', k: 'fab.price.hydro', l: 'Prueba hidrostática (€)' }, { t: 'num', k: 'fab.price.pwht', l: 'TTPS (€/kg)' }, { t: 'num', k: 'fab.price.paint', l: 'Pintura (€/m²)' },
        { t: 'num', k: 'fab.price.engh', l: 'Horas de ingeniería' }, { t: 'num', k: 'fab.price.eng', l: 'Ingeniería (€/h)' }, { t: 'num', k: 'fab.price.ovh', l: 'Gastos generales (%)' }, { t: 'num', k: 'fab.price.margin', l: 'Margen (%)' },
        { t: 'info', html: '<button type="button" class="btn sm" onclick="APP.ext(\'csv\',\'cost\')">Descargar CSV</button>' }]);
    }
    if (k === 'opt') f = [{ t: 'h', l: 'Espesores comerciales' }, { t: 'txt', k: 'fab.tlist', l: 'Lista de espesores disponibles (mm, separados por «;»)' }, { t: 'num', k: 'fab.thin', l: 'Adelgazamiento por conformado de fondos (%)' },
      { t: 'info', html: 'Busca, para cada virola, cono, fondo y tapa, el menor espesor de la lista que mantiene conformes el componente, sus conexiones, las cargas exteriores y la camisa. <button type="button" class="btn sm" onclick="APP.ext(\'optRun\')">Calcular propuesta</button>' }];
    if (k === 'revs'){
      f = [{ t: 'h', l: 'Firmas' }, { t: 'txt', k: 'info.autor', l: 'Calculado por' }, { t: 'txt', k: 'fab.dossier.chk', l: 'Revisado por' }, { t: 'txt', k: 'fab.dossier.app', l: 'Aprobado por' },
        { t: 'h', l: 'Tabla de revisiones' }, { t: 'info', html: '<button type="button" class="btn sm" onclick="APP.ext(\'revAdd\')">+ Nueva revisión</button>' }];
      p.fab.revs.forEach(function(r, i){ var b = 'fab.revs.' + i + '.'; f = f.concat([{ t: 'txt', k: b + 'rev', l: 'Rev.' }, { t: 'txt', k: b + 'date', l: 'Fecha' }, { t: 'txt', k: b + 'desc', l: 'Descripción' }, { t: 'txt', k: b + 'by', l: 'Realizado' }, { t: 'txt', k: b + 'chk', l: 'Revisado' }, { t: 'txt', k: b + 'app', l: 'Aprobado' }]); });
    }
    return f.filter(Boolean);
  }

  // ---------------- resultados ----------------
  function tbl(head, rows, cls){ return '<div class="tw"><table class="steps' + (head.length > 6 ? ' wide' : '') + (cls ? ' ' + cls : '') + '"><thead><tr>' + head.map(function(h){ return '<th>' + esc(h) + '</th>'; }).join('') + '</tr></thead><tbody>' + rows.map(function(r){ return '<tr>' + r.map(function(c){ return typeof c === 'object' && c && c.h != null ? '<td class="' + (c.c || '') + '">' + c.h + '</td>' : '<td>' + esc(c) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>'; }
  function numc(v){ return { h: esc(v), c: 'num' }; }
  function rq(list){ return '<ul class="checks">' + list.map(function(q){ return '<li class="' + (q.info ? 'info' : q.ok ? 'ok' : q.warn ? 'warn' : 'ko') + '">' + esc(q.t) + ' <span class="ref">' + esc(q.ref) + '</span></li>'; }).join('') + '</ul>'; }
  function block(o, ttl, full){ if (!o) return ''; if (o.err) return '<div class="st-h">' + esc(ttl) + '</div><ul class="checks"><li class="ko">' + esc(o.err) + '</li></ul>'; return '<div class="st-h">' + esc(ttl) + (o.ok === false ? ' — NO CUMPLE' : '') + '</div>' + checksHtml(o.r.checks) + (full !== false ? stepsHtml(o.r) : ''); }
  function result(k, full){
    var p = P(), f = F(), d = D(), res = RES(), h = '';
    if (!res) return '';
    if (k === 'eu'){
      if (f.ped){ var pd = f.ped;
        h += kv([['Cuadro', esc({ 1: 'Cuadro 1 · gas, grupo 1', 2: 'Cuadro 2 · gas, grupo 2', 3: 'Cuadro 3 · líquido, grupo 1', 4: 'Cuadro 4 · líquido, grupo 2' }[pd.table])], ['PS · V', fmt(pd.PS, 'p') + ' × ' + n0(pd.V) + ' L = ' + n0(pd.PSV) + ' bar·L'],
          ['Categoría', '<b>' + esc(pd.cat === 'SEP' ? 'Art. 4(3) — buenas prácticas de ingeniería' : pd.cat === 'excl' ? 'Fuera del ámbito' : 'Categoría ' + pd.cat) + '</b>'], ['Módulos', esc(FAB.MODS[pd.cat] || '—')],
          pd.PT ? ['Presión de prueba', fmt(pd.PT, 'p') + ' (mayor de PED 7.4 y UG-99)'] : null]);
        h += '<div class="st-h">Requisitos esenciales (anexo I)</div>' + rq(pd.req) + stepsHtml(pd.r);
        h += pedChart(pd);
      }
      if (f.en){ h += '<div class="st-h">EN 13445-3 frente a ASME VIII-1 (z = ' + n2(f.en.z) + ')</div>' + tbl(['Componente', 'f EN', 'e EN', 'e + c + δ', 'ASME treq + c', 'Nominal', 'Pmax EN', ''], f.en.rows.map(function(x){
          if (x.na || x.err) return [x.c.name, { h: esc(x.na || x.err), c: '' }, '', '', '', '', '', ''];
          return [x.c.name, numc(fmt(x.f, 's') + (x.est ? '*' : '')), numc(fmt(x.e, 'len')), numc(fmt(x.ereq, 'len')), numc(fmt(x.asme, 'len')), numc(fmt(x.tn, 'len')), numc(fmt(x.Pmax, 'p')), { h: x.ok ? '✓' : '✕', c: x.ok ? 'okc' : 'koc' }]; }));
        h += '<div class="f-note">* Rp/T estimado. Prueba EN 13445-5: ' + fmt(f.en.PT, 'p') + ' (fa/fT = ' + n2(f.en.fafT) + '). Uniones cono-cilindro, tapas planas y bridas no se comparan.</div>';
        if (full) f.en.rows.forEach(function(x){ if (x.r && x.r.steps.length) h += '<div class="st-h">' + esc(x.c.name) + '</div>' + checksHtml(x.r.checks) + stepsHtml(x.r); });
      }
      if (!f.ped && !f.en) h = '<p class="f-note">Activar la clasificación PED o la comparación EN 13445-3.</p>';
    }
    if (k === 'jacket'){ h += block(f.jacket, 'Camisa (Ap. 9)', full !== false) + block(f.hp, 'Media caña (Ap. EE)', full !== false); if (!f.jacket && !f.hp) h = '<p class="f-note">Sin camisa ni media caña.</p>'; }
    if (k === 'uhx') h = f.uhx ? block(f.uhx, 'UHX-12 · placa tubular' + (f.uhx.hmin ? ' · h mínimo ' + fmt(f.uhx.hmin, 'len') : '')) : '<p class="f-note">Sin placa tubular.</p>';
    if (k === 'fat') h = f.fat ? block(f.fat, 'Cribado de fatiga') : '<p class="f-note">Cribado desactivado.</p>';
    if (k === 'lift') h = f.lift ? block(f.lift, 'Izado') : '<p class="f-note">Sin comprobación de izado.</p>';
    if (k === 'mh') h = f.mh ? block(f.mh, 'Boca de hombre y pescante') : '<p class="f-note">Sin comprobación.</p>';
    if (k === 'wrc'){
      if (!f.wrc || !f.wrc.length) h = '<p class="f-note">Añadir conexiones para evaluar.</p>';
      else f.wrc.forEach(function(w){ if (!w.n){ h += block(w, 'WRC'); return; } h += block(w, 'Conexión ' + w.n.mark + (w.gam ? ' · γ = ' + n1(w.gam) + ', β = ' + fx(w.beta, 3) : ''), false);
        if (w.rows) h += tbl(['Punto', 'σφ memb.', 'σx memb.', 'σφ total', 'σx total', 'τ', 'S memb.', 'S total'], w.rows.map(function(q){ return [q.p, numc(fmt(q.phiM, 's')), numc(fmt(q.xM, 's')), numc(fmt(q.phiT, 's')), numc(fmt(q.xT, 's')), numc(fmt(q.tau, 's')), numc(fmt(q.Sm, 's')), numc(fmt(q.St, 's'))]; }));
        if (full !== false) h += stepsHtml(w.r); });
    }
    if (k === 'bom' && d.bom){ h += tbl(['Pos.', 'Grupo', 'Ref.', 'Descripción', 'Material', 'Cant.', 'Masa', 'Cert.'], d.bom.items.map(function(x){ return [String(x.pos), x.grp, x.ref, x.desc, x.mat, numc(String(x.qty)), numc(x.mass ? fmt(x.mass * (x.qty > 1 && x.form !== 'Perno' ? x.qty : 1), 'kg') : '–'), x.cert]; }));
      h += '<div class="f-note">Masa total aproximada (sin tornillería ni juntas): ' + fmt(d.bom.total, 'kg') + '.</div>'; }
    if (k === 'welds' && d.welds){ var W = d.welds;
      h += kv([['Soldaduras', W.list.length + ' · ' + n1(W.L / 1000) + ' m · ' + n1(W.kg) + ' kg de metal depositado'], ['Sin WPS válida', W.bad ? '<span class="bad">' + W.bad + '</span>' : '0']]);
      h += tbl(['Nº', 'Cat.', 'Descripción', 'Unión', 'Espesores', 'P-No', 'Longitud', 'END', 'WPS / PQR', 'Rango QW-451', ''], W.list.map(function(w){ return [w.id, w.cat, w.desc + (w.ang != null ? ' · ' + n0(w.ang) + '°' : ''), w.joint === 'fillet' ? 'Ángulo' + (w.leg ? ' z' + n0(w.leg) : '') : 'Tope ' + (w.prep || ''), numc(n1(w.t1) + (w.t2 !== w.t1 ? ' / ' + n1(w.t2) : '')), w.p1 + '-' + w.p2, numc(n2(w.L / 1000) + ' m'), w.ndt, w.wps + (w.pqr ? ' / ' + w.pqr : ''), w.rng ? n1(w.rng[0]) + '–' + n1(w.rng[1]) : '', { h: w.ok ? '✓' : '✕ ' + esc(w.why), c: w.ok ? 'okc' : 'koc' }]; }));
      h += '<div class="st-h">Resumen por WPS</div>' + tbl(['WPS', 'Proceso', 'Cordones', 'Longitud', 'Metal depositado'], Object.keys(W.byWps).map(function(k2){ var g = W.byWps[k2]; return [k2, g.proc || '—', numc(String(g.n)), numc(n1(g.L / 1000) + ' m'), numc(n1(g.kg) + ' kg')]; }));
      h += weldSvg(); }
    if (k === 'itp' && d.itp){ h += tbl(['Nº', 'Fase', 'Actividad', 'Documento', 'Criterio', 'Registro', 'Fabr.', 'Cliente', d.itp.insp], d.itp.rows.map(function(r){ return [String(r.n), r.phase, r.act, r.doc, r.crit, r.rec, r.mfr, r.cli, r.ins]; }));
      h += '<div class="f-note">' + esc(d.itp.legend) + ' · ' + (d.itp.insp === 'ON' ? 'ON = organismo notificado' : 'AI = inspector autorizado') + '</div><div class="st-h">Placa de características</div>' + plateSvg(); }
    if (k === 'nest' && d.nest){ var N = d.nest;
      h += kv([['Chapa comprada', fmt(N.kg, 'kg') + ' · piezas ' + fmt(N.net, 'kg') + ' · aprovechamiento ' + n0(N.net / Math.max(N.kg, 1) * 100) + ' %']]);
      if (N.warn.length) h += '<ul class="checks">' + N.warn.map(function(w){ return '<li class="warn">' + esc(w) + '</li>'; }).join('') + '</ul>';
      h += tbl(['Material', 'e', 'Formatos', 'Masa', 'Aprov.', 'Sin colocar'], N.groups.map(function(g){ return [g.mat, numc(n1(g.t)), FABDOC.fmtPlates(g), numc(fmt(g.kg, 'kg')), numc(n0(g.util * 100) + ' %'), g.unplaced.length ? { h: g.unplaced.length + '', c: 'koc' } : '0']; }));
      N.groups.forEach(function(g){ g.plates.forEach(function(pl, i){ h += '<div class="st-h">' + esc(g.mat) + ' e = ' + n1(g.t) + ' · chapa ' + (i + 1) + ' (' + pl.H + ' × ' + pl.W + ')</div>' + nestSvg(pl, p.fab.edge); }); }); }
    if (k === 'plano'){ h += typeof PLANO !== 'undefined' ? '<div class="plano">' + PLANO.svg(p, res) + '</div><div class="f-note">Vista previa. El DXF contiene las mismas entidades por capas a escala real del formato.</div>' : '<p>Módulo de planos no cargado.</p>'; }
    if (k === 'cost' && d.cost){ var C = d.cost;
      h += kv([['Total estimado', '<b>' + n0(C.total) + ' €</b> · ' + n2(C.eurkg) + ' €/kg'], ['Subtotal / gastos generales / margen', n0(C.sub) + ' / ' + n0(C.ovh) + ' / ' + n0(C.margin) + ' €'], ['Horas de soldadura', n0(C.hw) + ' h']]);
      h += tbl(['Partida', 'Descripción', 'Cantidad', 'Ud.', '€/ud', 'Importe'], C.rows.map(function(r){ return [r.grp, r.desc, numc(n1(r.q)), r.u, numc(n2(r.pu)), numc(n0(r.imp) + ' €')]; }));
      h += '<div class="f-note">Estimación orientativa con precios configurables; no incluye transporte, embalaje ni impuestos.</div>'; }
    if (k === 'opt'){
      var o = H.optRes();
      if (!o) h = '<p class="f-note">Pulsar «Calcular propuesta».</p>';
      else { h += kv([['Masa en vacío', fmt(o.mass0, 'kg') + ' → ' + fmt(o.mass1, 'kg') + ' (' + (o.mass1 <= o.mass0 ? '−' : '+') + fmt(Math.abs(o.mass0 - o.mass1), 'kg') + ')'], ['Conforme con la propuesta', o.ok ? 'sí' : '<span class="bad">no (hay comprobaciones que no dependen del espesor)</span>'], ['MAWP', fmt(o.mawp, 'p')]]);
        h += o.changes.length ? tbl(['Componente', 'Actual', 'Propuesto', 'Δ masa'], o.changes.map(function(c){ return [c.name, numc(fmt(c.from, 'len')), numc(fmt(c.to, 'len')), numc(fmt(c.dm, 'kg'))]; })) : '<p>No hay cambios posibles con la lista de espesores.</p>';
        if (o.unchanged.length) h += '<div class="f-note">Sin cambio: ' + esc(o.unchanged.join(', ')) + '.</div>';
        if (o.heads.length) h += '<div class="st-h">Chapa de partida de los fondos</div>' + tbl(['Fondo', 'Mínimo tras conformado', 'Chapa de pedido'], o.heads.map(function(x){ return [x.name, numc(fmt(x.tn, 'len')), numc(fmt(x.plate, 'len') + ' (' + x.thin + ' %)')]; }));
        if (o.changes.length) h += '<p><button type="button" class="btn" onclick="APP.ext(\'optApply\')">Aplicar espesores propuestos</button></p>'; }
    }
    if (k === 'revs'){ h += revTable(); }
    return h;
  }
  function revTable(){ var p = P(); return tbl(['Rev.', 'Fecha', 'Descripción', 'Realizado', 'Revisado', 'Aprobado'], p.fab.revs.map(function(r){ return [r.rev, r.date, r.desc, r.by, r.chk, r.app]; })); }
  // diagrama PS-V
  function pedChart(pd){
    var W = 340, Hh = 230, x0 = 46, y0 = 200, lx = function(v){ return x0 + (Math.log(v) / Math.LN10 + 1) / 5 * (W - x0 - 10); }, ly = function(ps){ return y0 - (Math.log(ps) / Math.LN10 + 1) / 5 * (y0 - 10); };
    var lines = { 1: [25, 50, 200, 1000], 2: [50, 200, 1000, 3000], 3: [200], 4: [10000] }[pd.table], s = '<svg viewBox="0 0 ' + W + ' ' + Hh + '" style="width:100%;max-width:380px" role="img" aria-label="Diagrama PS-V"><rect x="' + x0 + '" y="10" width="' + (W - x0 - 10) + '" height="' + (y0 - 10) + '" fill="none" stroke="currentColor" stroke-opacity=".3"/>';
    [0.1, 1, 10, 100, 1000, 10000].forEach(function(v){ s += '<line x1="' + lx(v) + '" y1="10" x2="' + lx(v) + '" y2="' + y0 + '" stroke="currentColor" stroke-opacity=".12"/><text x="' + lx(v) + '" y="' + (y0 + 12) + '" font-size="8" text-anchor="middle" fill="currentColor">' + v + '</text>'; });
    [0.1, 1, 10, 100, 1000, 10000].forEach(function(v){ s += '<line x1="' + x0 + '" y1="' + ly(v) + '" x2="' + (W - 10) + '" y2="' + ly(v) + '" stroke="currentColor" stroke-opacity=".12"/><text x="' + (x0 - 3) + '" y="' + (ly(v) + 3) + '" font-size="8" text-anchor="end" fill="currentColor">' + v + '</text>'; });
    lines.forEach(function(c){ var pts = []; for (var e = -1; e <= 4; e += 0.05){ var V2 = Math.pow(10, e), PS = c / V2; if (PS >= 0.1 && PS <= 10000 && V2 >= 1) pts.push(lx(V2) + ',' + ly(PS)); } s += '<polyline points="' + pts.join(' ') + '" fill="none" stroke="#2a78d6" stroke-width="1"/>'; });
    s += '<line x1="' + lx(1) + '" y1="10" x2="' + lx(1) + '" y2="' + y0 + '" stroke="#2a78d6" stroke-dasharray="3 2"/><line x1="' + x0 + '" y1="' + ly(0.5) + '" x2="' + (W - 10) + '" y2="' + ly(0.5) + '" stroke="#c93a39" stroke-dasharray="3 2"/>';
    var px = lx(Math.max(0.1, Math.min(9999, pd.V))), py = ly(Math.max(0.1, Math.min(9999, pd.PS * 10)));
    s += '<circle cx="' + px + '" cy="' + py + '" r="4" fill="#c93a39"/><text x="' + (px + 6) + '" y="' + (py - 4) + '" font-size="9" fill="currentColor">cat. ' + esc(pd.cat) + '</text><text x="' + (W / 2 + 20) + '" y="' + (Hh - 4) + '" font-size="9" text-anchor="middle" fill="currentColor">V (L)</text><text x="10" y="14" font-size="9" fill="currentColor">PS (bar)</text></svg>';
    return '<div class="st-h">Diagrama del cuadro ' + pd.table + '</div>' + s;
  }
  function plateSvg(){
    var rows = D().plate || [], p = P(), F2 = F(), W = 420, Hh = 40 + rows.length * 17 + 30;
    var s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + Hh + '" style="width:100%;max-width:440px" font-family="IBM Plex Mono, monospace"><rect x="2" y="2" width="' + (W - 4) + '" height="' + (Hh - 4) + '" rx="8" fill="#e9edf1" stroke="#555" stroke-width="2"/>';
    [[12, 12], [W - 12, 12], [12, Hh - 12], [W - 12, Hh - 12]].forEach(function(c){ s += '<circle cx="' + c[0] + '" cy="' + c[1] + '" r="4" fill="#fff" stroke="#555"/>'; });
    s += '<text x="' + (W / 2) + '" y="28" text-anchor="middle" font-size="13" font-weight="700" fill="#111">' + (p.fab.stamp === false ? '' : 'Ⓤ  ') + 'ASME BPVC VIII-1' + (F2.ped && F2.ped.cat && /^(I|II|III|IV)$/.test(F2.ped.cat) ? '   CE ' + esc(p.fab.plate.nb || p.ped.nb || '') : '') + '</text>';
    rows.forEach(function(r, i){ var y = 50 + i * 17; s += '<text x="18" y="' + y + '" font-size="10" fill="#333">' + esc(r[0]) + '</text><text x="150" y="' + y + '" font-size="10" fill="#111" font-weight="600">' + esc(r[1]).slice(0, 60) + '</text>'; });
    return s + '</svg>';
  }
  function nestSvg(pl, edge){
    var sc = 520 / pl.W, W = pl.W * sc, Hh = pl.H * sc, e = (+edge || 0);
    var s = '<svg viewBox="0 0 ' + (W + 4) + ' ' + (Hh + 4) + '" style="width:100%;max-width:560px" font-family="IBM Plex Mono, monospace"><rect x="2" y="2" width="' + W + '" height="' + Hh + '" fill="none" stroke="currentColor" stroke-width="1.2"/>';
    pl.placed.forEach(function(q){ var x = 2 + (q.x + e) * sc, y = 2 + (q.y + e) * sc, w = q.w * sc, h = q.h * sc, it = q.it, cx = x + w / 2, cy = y + h / 2;
      if (it.shape === 'disc') s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + w / 2 + '" fill="rgba(42,120,214,.18)" stroke="#2a78d6"/>';
      else if (it.shape === 'ring') s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + w / 2 + '" fill="rgba(42,120,214,.18)" stroke="#2a78d6"/><circle cx="' + cx + '" cy="' + cy + '" r="' + it.Di / it.Do * w / 2 + '" fill="var(--card,#fff)" stroke="#2a78d6"/>';
      else if (it.shape === 'sector'){ var bx = it.bx, pts = [], k; for (k = 0; k <= 24; k++){ var a = bx.a0 + it.ang * k / 24; pts.push([it.R1 * Math.cos(a), it.R1 * Math.sin(a)]); } for (k = 24; k >= 0; k--){ var a2 = bx.a0 + it.ang * k / 24; pts.push([it.R2 * Math.cos(a2), it.R2 * Math.sin(a2)]); }
        s += '<polygon points="' + pts.map(function(p0){ var u = p0[0] - bx.x0, v = p0[1] - bx.y0; if (q.r){ var t = u; u = v; v = t; } return (x + u * sc) + ',' + (y + v * sc); }).join(' ') + '" fill="rgba(42,120,214,.18)" stroke="#2a78d6"/>'; }
      else s += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="rgba(42,120,214,.18)" stroke="#2a78d6"/>';
      s += '<text x="' + cx + '" y="' + (cy + 3) + '" font-size="' + Math.max(6, Math.min(10, w / 12)) + '" text-anchor="middle" fill="currentColor">' + esc(it.name) + '</text>'; });
    return s + '</svg>';
  }
  // croquis del mapa de soldaduras: desarrollo de la envolvente con longitudinales a su ángulo
  function weldSvg(){
    var p = P(), res = RES(), W = 520, s0 = res.L.smin, s1 = res.L.smax, Lx = s1 - s0 || 1, Hh = 200, sc = (W - 60) / Lx;
    var s = '<div class="st-h">Desarrollo de la envolvente (0° a 360° en planta)</div><svg viewBox="0 0 ' + W + ' ' + (Hh + 30) + '" style="width:100%" font-family="IBM Plex Mono, monospace" font-size="8">';
    function X(sv){ return 40 + (sv - s0) * sc; } function Y(a){ return 10 + (1 - a / 360) * Hh; }
    s += '<rect x="40" y="10" width="' + (W - 60) + '" height="' + Hh + '" fill="none" stroke="currentColor" stroke-opacity=".4"/>';
    [0, 90, 180, 270, 360].forEach(function(a){ s += '<line x1="40" y1="' + Y(a) + '" x2="' + (W - 20) + '" y2="' + Y(a) + '" stroke="currentColor" stroke-opacity=".12"/><text x="36" y="' + (Y(a) + 3) + '" text-anchor="end" fill="currentColor">' + a + '°</text>'; });
    var W2 = D().welds; if (!W2) return '';
    p.comps.forEach(function(c){ var ps = res.L.pos[c.id]; s += '<line x1="' + X(ps.s0) + '" y1="10" x2="' + X(ps.s0) + '" y2="' + (10 + Hh) + '" stroke="#b86b2c" stroke-width="1.5"/><text x="' + ((X(ps.s0) + X(ps.s1)) / 2) + '" y="' + (Hh + 24) + '" text-anchor="middle" fill="currentColor">' + esc(c.name) + '</text>'; });
    p.comps.forEach(function(c){ if (!/shell|cone/.test(c.type)) return; var cs = M.courses(p, c), ps = res.L.pos[c.id]; cs.list.slice(1).forEach(function(cr){ s += '<line x1="' + X(ps.s0 + cr.z0) + '" y1="10" x2="' + X(ps.s0 + cr.z0) + '" y2="' + (10 + Hh) + '" stroke="#b86b2c" stroke-width="1" stroke-dasharray="4 2"/>'; }); });
    W2.list.forEach(function(w){ if (w.ang == null || !w.comp) return; var c = p.comps.filter(function(x){ return x.id === w.comp; })[0], ps = res.L.pos[c.id];
      var cs = M.courses(p, c), cr = cs.list[w.course || 0] || cs.list[0], ca = ps.s0 + cr.z0, cb = ps.s0 + cr.z1;
      s += '<line x1="' + X(ca) + '" y1="' + Y(w.ang) + '" x2="' + X(cb) + '" y2="' + Y(w.ang) + '" stroke="#b86b2c" stroke-width="2"/><text x="' + (X(ca) + 2) + '" y="' + (Y(w.ang) - 2) + '" fill="#b86b2c">' + esc(w.id) + '</text>'; });
    p.nozzles.forEach(function(n){ var host = p.comps.filter(function(c){ return c.id === n.host; })[0]; if (!host || host.type !== 'shell') return; var ps = res.L.pos[host.id], sv = ps.s0 + (+n.a || 0), r = n.od / 2 * sc;
      s += '<circle cx="' + X(sv) + '" cy="' + Y(((+n.theta || 0) % 360 + 360) % 360) + '" r="' + Math.max(2, r) + '" fill="none" stroke="currentColor"/><text x="' + (X(sv) + Math.max(3, r) + 1) + '" y="' + (Y(((+n.theta || 0) % 360 + 360) % 360) + 3) + '" fill="currentColor" font-weight="700">' + esc(n.mark) + '</text>'; });
    return s + '</svg>';
  }

  // ---------------- memoria: secciones adicionales ----------------
  function memoria(){
    var p = P(), f = F(), d = D(), secs = [];
    if (f.ped || f.en) secs.push({ t: 'Normativa europea: PED 2014/68/UE y EN 13445-3', h: result('eu', true) });
    var ex = [];
    if (f.jacket || f.hp) ex.push(['Camisa y media caña', result('jacket', true)]);
    if (f.uhx) ex.push(['Placa tubular (UHX-12)', result('uhx', true)]);
    if (f.fat) ex.push(['Cribado de fatiga (VIII-2 5.5.2.3)', result('fat', true)]);
    if (f.lift) ex.push(['Izado', result('lift', true)]);
    if (f.mh) ex.push(['Boca de hombre y pescante', result('mh', true)]);
    if (f.wrc && f.wrc.length) ex.push(['Cargas locales WRC 107/537', result('wrc', true)]);
    if (ex.length) secs.push({ t: 'Elementos adicionales', subs: ex });
    if (d.bom) secs.push({ t: 'Fabricación y dossier', subs: [['Lista de materiales', result('bom')], ['Mapa de soldaduras y WPS', result('welds')], ['Plan de puntos de inspección y placa', result('itp')], ['Desarrollos y aprovechamiento', result('nest')]] });
    return secs;
  }

  // ---------------- acciones ----------------
  function dl(name, data, type){ var blob = data instanceof Blob ? data : new Blob([data], { type: type || 'text/plain;charset=utf-8' }), a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 800); }
  function nm(){ return String(P().info.tag || P().info.equipo || 'Recipiente').replace(/[^\w.-]+/g, '_'); }
  function csv(rows){ return '﻿' + rows.map(function(r){ return r.map(function(c){ var s = String(c == null ? '' : c); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(';'); }).join('\r\n'); }
  function n1c(x){ return x == null ? '' : String(Math.round(x * 10) / 10).replace('.', ','); }
  function nestDxf(){
    var N = D().nest, body = [], layers = {}, ox = 0, edge = +P().fab.edge || 0;
    function L(n){ layers[n] = 1; return n; }
    function line(a, b, ly){ body.push('0', 'LINE', '8', L(ly), '10', a[0].toFixed(2), '20', a[1].toFixed(2), '30', '0', '11', b[0].toFixed(2), '21', b[1].toFixed(2), '31', '0'); }
    function pl(pts, closed, ly){ body.push('0', 'POLYLINE', '8', L(ly), '66', '1', '70', closed ? '1' : '0'); pts.forEach(function(q){ body.push('0', 'VERTEX', '8', ly, '10', q[0].toFixed(2), '20', q[1].toFixed(2), '30', '0'); }); body.push('0', 'SEQEND', '8', ly); }
    function circ(c, r, ly){ body.push('0', 'CIRCLE', '8', L(ly), '10', c[0].toFixed(2), '20', c[1].toFixed(2), '30', '0', '40', r.toFixed(2)); }
    function txt(p0, h, s, ly){ body.push('0', 'TEXT', '8', L(ly), '10', p0[0].toFixed(2), '20', p0[1].toFixed(2), '30', '0', '40', h.toFixed(1), '1', String(s).normalize('NFD').replace(/[̀-ͯ]/g, '')); }
    N.groups.forEach(function(g){ var oy = 0, lyr = ('E' + g.t + '_' + g.mat).toUpperCase().replace(/[^A-Z0-9_-]+/g, '_').slice(0, 31);
      g.plates.forEach(function(plate, i){ pl([[ox, oy], [ox + plate.W, oy], [ox + plate.W, oy + plate.H], [ox, oy + plate.H]], true, 'CHAPA'); txt([ox, oy + plate.H + 40], 60, g.mat + ' e=' + g.t + ' chapa ' + (i + 1) + ' ' + plate.H + 'x' + plate.W, 'TEXTOS');
        plate.placed.forEach(function(q){ var x = ox + q.x + edge, y = oy + q.y + edge, it = q.it, cx = x + q.w / 2, cy = y + q.h / 2;
          if (it.shape === 'disc') circ([cx, cy], q.w / 2, lyr);
          else if (it.shape === 'ring'){ circ([cx, cy], it.Do / 2, lyr); circ([cx, cy], it.Di / 2, lyr); }
          else if (it.shape === 'sector'){ var bx = it.bx, pts = [], k; for (k = 0; k <= 48; k++){ var a = bx.a0 + it.ang * k / 48; pts.push([it.R1 * Math.cos(a), it.R1 * Math.sin(a)]); } for (k = 48; k >= 0; k--){ var a2 = bx.a0 + it.ang * k / 48; pts.push([it.R2 * Math.cos(a2), it.R2 * Math.sin(a2)]); }
            pl(pts.map(function(p0){ var u = p0[0] - bx.x0, v = p0[1] - bx.y0; if (q.r){ var t = u; u = v; v = t; } return [x + u, y + v]; }), true, lyr); }
          else { pl([[x, y], [x + q.w, y], [x + q.w, y + q.h], [x, y + q.h]], true, lyr); if (it.shape === 'lug') circ(q.r ? [x + q.w - it.R, cy] : [cx, y + q.h - it.R], it.dh / 2, lyr); }
          txt([x + 10, cy], Math.max(10, Math.min(60, q.w / 20)), it.name + ' ' + Math.round(q.w) + 'x' + Math.round(q.h), 'TEXTOS'); });
        oy += plate.H + 300; });
      ox += Math.max.apply(null, g.plates.map(function(pl2){ return pl2.W; }).concat([1000])) + 500; });
    var head = ['0', 'SECTION', '2', 'HEADER', '9', '$ACADVER', '1', 'AC1009', '9', '$INSUNITS', '70', '4', '0', 'ENDSEC', '0', 'SECTION', '2', 'TABLES', '0', 'TABLE', '2', 'LAYER', '70', String(Object.keys(layers).length)];
    Object.keys(layers).forEach(function(l, i){ head.push('0', 'LAYER', '2', l, '70', '0', '62', String(i % 6 + 1), '6', 'CONTINUOUS'); });
    head.push('0', 'ENDTAB', '0', 'ENDSEC', '0', 'SECTION', '2', 'ENTITIES');
    return head.concat(body, ['0', 'ENDSEC', '0', 'EOF']).join('\r\n');
  }
  function action(a, arg){
    var p = P(), d = D();
    if (a === 'wrcAdd'){ p.wrc.list.push(FAB.newWrc(p, p.nozzles[0])); return 're'; }
    if (a === 'wrcAll'){ p.nozzles.forEach(function(n){ var l = M.nozLoads(n); if ((l.F || l.V || l.M || l.Mt) && !p.wrc.list.some(function(w){ return w.noz === n.id; })) p.wrc.list.push(FAB.newWrc(p, n)); }); return 're'; }
    if (a === 'wrcDel'){ p.wrc.list.splice(arg, 1); return 're'; }
    if (a === 'wrcLoads'){ var w = p.wrc.list[arg], n = p.nozzles.filter(function(x){ return x.id === w.noz; })[0]; if (n && n.ld){ w.P = n.ld.F || 0; w.ML = n.ld.M || 0; w.Mc = 0; w.MT = n.ld.Mt || 0; w.VL = n.ld.V || 0; w.Vc = 0; } return 're'; }
    if (a === 'revAdd'){ var last = p.fab.revs[p.fab.revs.length - 1]; p.fab.revs.push({ rev: String(last && !isNaN(+last.rev) ? +last.rev + 1 : (p.fab.revs.length)), date: new Date().toISOString().slice(0, 10), desc: '', by: p.info.autor || '', chk: '', app: '' }); p.info.rev = p.fab.revs[p.fab.revs.length - 1].rev; return 're'; }
    if (a === 'optRun'){ H.setOpt(FABDOC.optimize(p)); return 'res'; }
    if (a === 'optApply'){ var o = H.optRes(); if (!o) return; o.changes.forEach(function(c){ var x = p.comps.filter(function(q){ return q.id === c.id; })[0]; if (x) x.tn = c.to; }); H.setOpt(null); return 're'; }
    if (a === 'csv'){
      var rows;
      if (arg === 'bom') rows = [['Pos.', 'Grupo', 'Referencia', 'Descripción', 'Material', 'Forma', 'Espesor (mm)', 'Cantidad', 'Masa (kg)', 'Certificado EN 10204', 'Parte a presión']].concat(d.bom.items.map(function(x){ return [x.pos, x.grp, x.ref, x.desc, x.mat, x.form, n1c(x.t), x.qty, n1c(x.mass * (x.qty > 1 && x.form !== 'Perno' ? x.qty : 1)), x.cert, x.press ? 'sí' : 'no']; }));
      if (arg === 'welds') rows = [['Nº', 'Categoría UW-3', 'Descripción', 'Unión', 'Preparación', 't1 (mm)', 't2 (mm)', 'P-No', 'Longitud (mm)', 'Ángulo (°)', 'END', 'WPS', 'PQR', 'Proceso', 'Rango QW-451 (mm)', 'Metal depositado (kg)', 'Estado']].concat(d.welds.list.map(function(w){ return [w.id, w.cat, w.desc, w.joint === 'fillet' ? 'ángulo' : 'tope', w.prep || (w.leg ? 'z' + w.leg : ''), n1c(w.t1), n1c(w.t2), w.p1 + '-' + w.p2, Math.round(w.L), w.ang != null ? Math.round(w.ang) : '', w.ndt, w.wps, w.pqr, w.proc, w.rng ? n1c(w.rng[0]) + '-' + n1c(w.rng[1]) : '', n1c(w.kg), w.ok ? 'OK' : w.why]; }));
      if (arg === 'itp') rows = [['Nº', 'Fase', 'Actividad', 'Documento', 'Criterio de aceptación', 'Registro', 'Fabricante', 'Cliente', d.itp.insp]].concat(d.itp.rows.map(function(r){ return [r.n, r.phase, r.act, r.doc, r.crit, r.rec, r.mfr, r.cli, r.ins]; }));
      if (arg === 'nest'){ rows = [['Material', 'Espesor', 'Chapa', 'Formato', 'Pieza', 'Ancho', 'Largo', 'X', 'Y', 'Girada']]; d.nest.groups.forEach(function(g){ g.plates.forEach(function(pl, i){ pl.placed.forEach(function(q){ rows.push([g.mat, g.t, i + 1, pl.H + 'x' + pl.W, q.it.name, Math.round(q.w), Math.round(q.h), Math.round(q.x), Math.round(q.y), q.r ? 'sí' : 'no']); }); }); }); }
      if (arg === 'cost') rows = [['Partida', 'Descripción', 'Cantidad', 'Unidad', 'Precio unitario (€)', 'Importe (€)']].concat(d.cost.rows.map(function(r){ return [r.grp, r.desc, n1c(r.q), r.u, n1c(r.pu), Math.round(r.imp)]; })).concat([['', 'Subtotal', '', '', '', Math.round(d.cost.sub)], ['', 'Gastos generales', '', '', '', Math.round(d.cost.ovh)], ['', 'Margen', '', '', '', Math.round(d.cost.margin)], ['', 'TOTAL', '', '', '', Math.round(d.cost.total)]]);
      dl(nm() + '_' + arg + '.csv', csv(rows), 'text/csv;charset=utf-8'); return;
    }
    if (a === 'plateSvg'){ dl(nm() + '_placa.svg', plateSvg().replace('style="width:100%;max-width:440px" ', ''), 'image/svg+xml'); return; }
    if (a === 'nestDxf'){ dl(nm() + '_despiece.dxf', nestDxf(), 'application/dxf'); return; }
    if (a === 'planoDxf'){ var o2 = PLANO.dxf(p, RES()); dl(o2.file, o2.text, 'application/dxf'); return; }
    if (a === 'planoSvg'){ dl(nm() + '_plano.svg', PLANO.svg(p, RES(), true), 'image/svg+xml'); return; }
  }
  return { tree: tree, treeStatus: treeStatus, isKind: isKind, title: title, fields: fields, result: result, memoria: memoria, action: action, revTable: revTable, plateSvg: plateSvg, nestDxf: nestDxf };
};

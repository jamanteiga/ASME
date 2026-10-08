(function(){
  'use strict';
  var MATERIALS = window.ASME_MATERIALS, PAGE = window.ASME_PAGE || {};

  var CATS = [
    {id:'plancha',   file:'plancha.html',     name:'Plancha / Chapa',       badge:'Plates',        desc:'Envolventes, fondos y componentes estructurales.'},
    {id:'tubo',      file:'tubo.html',        name:'Tubo',                  badge:'Pipes / Tubes', desc:'Tubería de proceso, calderas e intercambiadores.'},
    {id:'forja',     file:'forja.html',       name:'Forja',                 badge:'Forgings',      desc:'Bridas, boquillas y componentes macizos.'},
    {id:'bridas',    file:'bridas.html',      name:'Bridas',                badge:'Flanges',       desc:'Uniones desmontables (mismos materiales de forja).',
      refs:['sa105','sa350_lf2','sa182_f304','sa182_f304L','sa182_f316','sa182_f316L','sa182_f11','sa182_f22']},
    {id:'fittings',  file:'accesorios.html',  name:'Accesorios / Fittings', badge:'Fittings',      desc:'Codos, tes y reducciones.'},
    {id:'fundicion', file:'fundiciones.html', name:'Fundiciones',           badge:'Castings',      desc:'Cuerpos moldeados. Aplicar factor de calidad UG-24.'},
    {id:'pernos',    file:'pernos.html',      name:'Pernos y Espárragos',   badge:'Bolting',       desc:'Elementos de fijación (Tabla 3).',
      info:[{t:'SA-194 (tuercas)', tag:'Sin S tabulada', d:'La II-D no tabula tensión admisible para tuercas. Se seleccionan según UCS-11 (VIII-1), acordes al perno.'}]},
    {id:'noferrosos',file:'no-ferrosos.html', name:'Materiales no ferrosos',badge:'Nonferrous',    desc:'Aluminio, cobre, níquel y titanio (Tabla 1B) y pernos no ferrosos (Tabla 3).'}
  ];
  function catMats(c){ return c.refs ? c.refs.map(function(id){ return BYID[id]; }) : MATERIALS.filter(function(m){ return m.cat === c.id; }); }

  // Notas más habituales, parafraseadas de las notas de cada tabla.
  var NOTE_TXT = {
    'Tabla 1A': {
      G1:'Aplicar el factor de calidad de fundición de UG-24.',
      G3:'Incluye una eficiencia de junta de 0,85.',
      G5:'Valores altos (hasta el 90 % del límite elástico a temperatura): pueden producir deformación permanente. No recomendados para bridas con junta ni donde una ligera distorsión cause fugas.',
      G10:'Exposición prolongada por encima de 425 °C: posible grafitización del acero al carbono.',
      G12:'Por encima de 550 °C, válido solo con C ≥ 0,04 %.',
      G19:'Puede fragilizarse tras servicio a temperatura moderadamente elevada.',
      G24:'Factor 0,85 ya aplicado; dividir por 0,85 para la tensión longitudinal admisible.',
      H1:'Por encima de 550 °C, solo con el tratamiento térmico indicado en la nota.'
    },
    'Tabla 1B': {
      G5:'Valores altos (hasta el 90 % del límite elástico a temperatura): pueden producir deformación permanente. No recomendados para bridas con junta.',
      G14:'Factor 0,85 ya aplicado (VIII); dividir por 0,85 para la tensión longitudinal admisible.',
      G16:'Valores al 90 % de los del material del núcleo (Alclad).',
      G18:'Considerar el riesgo de corrosión bajo tensión.',
      G19:'Considerar el riesgo de corrosión bajo tensión; consultar al suministrador.',
      G23:'Pérdida severa de tenacidad a temperatura ambiente tras exposición entre 550 y 750 °C.',
      G24:'Para temples con alivio de tensiones (T451, T651…), usar los valores del temple básico.'
    },
    'Tabla 3': {
      G5:'Por encima de 550 °C, válido solo con C ≥ 0,04 %.',
      G6:'Por encima de 550 °C, solo si se trata térmicamente a 1040 °C mínimo.',
      G8:'Dureza máxima HRC 35 bajo la raíz de la rosca.'
    }
  };

  var KSI = 6.894757, IN = 25.4;
  var units = 'si';
  try { if (localStorage.getItem('asme-units') === 'us') units = 'us'; } catch (e) {}
  var BYID = {};
  MATERIALS.forEach(function(m){ BYID[m.id] = m; });
  var state = { mat: MATERIALS[0], vi: 0, T: 150, P: 1.5, D: 25.4 };

  function cToF(c){ return c * 9 / 5 + 32; }
  function fToC(f){ return (f - 32) * 5 / 9; }
  function decFor(x){ return x >= 100 ? 0 : (x >= 10 ? 1 : 2); }
  function fmtS(x){ return x.toFixed(decFor(x)).replace('.', ','); }
  function fmtT(x){ return String(Math.round(x)); }
  function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'); }

  // Curva de una variante en las unidades activas. official=true si los valores son tabulados.
  function curve(v){
    if (units === 'si') return { pts: v.p.map(function(p){ return [p[0], p[1]]; }), tm: v.tm, tc: v.tc, official: true };
    if (v.us) return { pts: v.us, tm: v.us[v.us.length-1][0], tc: null, official: true };
    return {
      pts: v.p.map(function(p){ return [cToF(p[0]), p[1] / KSI]; }),
      tm: cToF(v.tm), tc: v.tc ? cToF(v.tc) : null, official: false
    };
  }

  // Interpolación lineal; en SI se redondea a los decimales del valor tabulado a mayor temperatura (Nota General b).
  function interp(c, T){
    var pts = c.pts, tmin = pts[0][0], tmax = c.tm;
    var t = Math.min(Math.max(T, tmin), tmax);
    var i = pts.length - 2;
    for (var k = 0; k < pts.length - 1; k++){
      if (t >= pts[k][0] && t <= pts[k+1][0]){ i = k; break; }
    }
    var a = pts[i], b = pts[i+1];
    var f = b[0] === a[0] ? 0 : (t - a[0]) / (b[0] - a[0]);
    var s = a[1] + f * (b[1] - a[1]);
    if (units === 'si' && f > 0 && f < 1){ var d = decFor(b[1]); s = Math.round(s * Math.pow(10, d)) / Math.pow(10, d); }
    return { s: s, t: t, below: T < tmin, above: T > tmax, tmin: tmin, tmax: tmax };
  }


  var CAT = null;
  CATS.forEach(function(c){ if (c.id === PAGE.cat) CAT = c; });

  // ---------------- PORTADA (index.html) ----------------
  function buildHub(){
    var grid = document.getElementById('hub-grid');
    grid.innerHTML = CATS.map(function(c){
      var list = catMats(c), specs = [];
      list.forEach(function(m){ var s = m.t.split(' ')[0]; if (specs.indexOf(s) < 0) specs.push(s); });
      return '<a class="cat-card hub-card" href="'+c.file+'">' +
        '<h3>'+esc(c.name)+' <span class="badge">'+esc(c.badge)+'</span></h3>' +
        '<div class="subcat-desc">'+esc(c.desc)+'</div>' +
        '<div class="hub-specs">'+esc(specs.join(' · '))+'</div>' +
        '<div class="hub-foot"><span>'+list.length+' materiales</span><span class="action-hint">Abrir catálogo →</span></div>' +
      '</a>';
    }).join('');
  }

  // ---------------- CATÁLOGO DE LA PÁGINA ----------------
  function itemHtml(m){
    var n = m.v.length;
    return '<button type="button" class="material-item interactive" data-id="'+m.id+'" data-q="'+esc((m.t+' '+m.d+' '+m.c.join(' ')).toLowerCase())+'">' +
      '<div class="mat-title">'+esc(m.t)+' <span>'+esc(m.c[m.c.length-1])+'</span></div>' +
      '<div class="mat-details">'+esc(m.tab)+' · '+esc(m.d)+'</div>' +
      '<div class="action-hint">Ver curva S-T'+(n > 1 ? ' ('+n+' curvas)' : '')+' →</div>' +
    '</button>';
  }
  function buildCatalog(){
    var grid = document.getElementById('catalog-grid');
    var inner = '', lastSub = null;
    catMats(CAT).forEach(function(m){
      if (!CAT.refs && m.sub && m.sub !== lastSub){ inner += '<div class="subhead">'+esc(m.sub)+'</div>'; lastSub = m.sub; }
      inner += itemHtml(m);
    });
    (CAT.info || []).forEach(function(i){
      inner += '<div class="material-item" data-q="'+esc((i.t+' '+i.d).toLowerCase())+'"><div class="mat-title">'+esc(i.t)+' <span>'+esc(i.tag)+'</span></div><div class="mat-details">'+esc(i.d)+'</div></div>';
    });
    grid.innerHTML = inner;
    grid.addEventListener('click', function(e){
      var it = e.target.closest('.material-item.interactive');
      if (it) openMaterial(it.getAttribute('data-id'));
    });
    document.getElementById('search').addEventListener('input', function(){
      var q = this.value.trim().toLowerCase().replace(/\s+/g, ' ');
      var qq = q.replace(/[\s-]/g, ''), any = false;
      grid.querySelectorAll('.material-item').forEach(function(it){
        var hay = it.getAttribute('data-q');
        var ok = !q || hay.indexOf(q) >= 0 || hay.replace(/[\s-]/g, '').indexOf(qq) >= 0;
        it.hidden = !ok; if (ok) any = true;
      });
      grid.querySelectorAll('.subhead').forEach(function(s){ s.hidden = !!q; });
      document.getElementById('no-hits').hidden = any;
    });
  }

  // ---------------- NAVEGACIÓN ----------------
  window.cerrarPagina = function(){ window.location.href = 'index.html'; };
  window.switchView = function(view){
    document.getElementById('view-catalog').hidden = view !== 'catalog';
    document.getElementById('view-calc').hidden = view === 'catalog';
    if (view !== 'catalog') renderPanel();
  };
  window.openMaterial = function(id){
    selectMaterial(id);
    window.switchView('calc');
    window.scrollTo(0, 0);
  };
  function markUnits(){
    document.getElementById('u-si').classList.toggle('active', units === 'si');
    document.getElementById('u-us').classList.toggle('active', units === 'us');
  }
  window.setUnits = function(u){
    units = u;
    try { localStorage.setItem('asme-units', u); } catch (e) {}
    markUnits();
    if (!document.getElementById('view-calc').hidden) renderPanel();
  };

  var selMat = document.getElementById('sel-mat');
  function fillMats(){
    var html = '', lastSub = null, open = false;
    catMats(CAT).forEach(function(m){
      if (!CAT.refs && m.sub && m.sub !== lastSub){ if (open) html += '</optgroup>'; html += '<optgroup label="'+esc(m.sub)+'">'; open = true; lastSub = m.sub; }
      html += '<option value="'+m.id+'">'+esc(m.t)+'</option>';
    });
    if (open) html += '</optgroup>';
    selMat.innerHTML = html;
  }
  function selectMaterial(id){
    var m = BYID[id]; if (!m) return;
    state.mat = m; state.vi = 0;
    selMat.value = m.id;
    var v = m.v[0];
    if (state.T > v.tm || state.T < v.p[0][0]) state.T = Math.min(150, Math.round(v.tm));
    if (m.byD) pickByDiameter();
    if (!document.getElementById('view-calc').hidden) renderPanel();
  }

  function pickByDiameter(){
    var m = state.mat, found = -1;
    for (var i = 0; i < m.v.length; i++){ if (state.D <= m.v[i].dmax){ found = i; break; } }
    state.dOut = found < 0;
    state.vi = found < 0 ? m.v.length - 1 : found;
  }

  // ---------------- PANEL ----------------
  var panel = document.getElementById('panel');
  var NS = 'http://www.w3.org/2000/svg';
  function el(tag, attrs){
    var e = document.createElementNS(NS, tag);
    for (var k in attrs){ e.setAttribute(k, attrs[k]); }
    return e;
  }

  function renderPanel(){
    var m = state.mat, us = units === 'us';
    var uT = us ? '°F' : '°C', uS = us ? 'ksi' : 'MPa', uP = us ? 'psi' : 'MPa', uD = us ? 'in' : 'mm';
    document.getElementById('calc-sub').textContent = us
      ? 'Unidades US (°F / ksi). Salvo indicación, los valores son conversión de la tabla métrica.'
      : 'Unidades SI (°C / MPa), valores tabulados de la II-D Metric.';

    var tVal = us ? Math.round(cToF(state.T)) : Math.round(state.T * 10) / 10;
    var pVal = us ? Math.round(state.P * 145.0377) : Math.round(state.P * 100) / 100;
    var dVal = us ? Math.round(state.D / IN * 1000) / 1000 : Math.round(state.D * 10) / 10;

    var inputs = '' +
      '<div class="field"><label for="in-p">Presión de diseño P</label><div class="in-row">' +
        '<input type="number" id="in-p" value="'+pVal+'" step="'+(us ? 10 : 0.1)+'"><span class="unit">'+uP+'</span></div></div>' +
      '<div class="field"><label for="in-t">Temperatura de diseño T</label><div class="in-row">' +
        '<input type="number" id="in-t" value="'+tVal+'" step="'+(us ? 10 : 5)+'"><span class="unit">'+uT+'</span></div></div>';
    if (m.byD){
      inputs += '<div class="field"><label for="in-d">Diámetro del perno D</label><div class="in-row">' +
        '<input type="number" id="in-d" value="'+dVal+'" step="'+(us ? 0.125 : 1)+'"><span class="unit">'+uD+'</span></div></div>';
    } else if (m.v.length > 1){
      inputs += '<div class="field"><label for="in-v">Línea de la tabla / condición</label><select id="in-v">' +
        m.v.map(function(v, i){ return '<option value="'+i+'"'+(i === state.vi ? ' selected' : '')+'>'+esc(v.l)+'</option>'; }).join('') +
        '</select></div>';
    }
    inputs += '<div class="input-hint">P es un dato de registro; la curva S&#8209;T depende exclusivamente de la temperatura.</div>';

    panel.innerHTML =
      '<div class="card-top-row"><div>' +
          '<div class="card-eyebrow" id="p-ref"></div>' +
          '<div class="card-title">'+esc(m.t)+'</div>' +
          '<div class="idline">'+m.c.map(function(c){ return '<span>'+esc(c)+'</span>'; }).join('')+'</div>' +
        '</div>' +
        '<button class="back-btn" onclick="switchView(\'catalog\')">← Volver a la lista</button>' +
      '</div>' +
      '<div class="body-row">' +
        '<div class="side">' +
          '<div class="inputs">'+inputs+'</div>' +
          '<div class="result"><span class="r-label">S admisible</span><span class="r-value" id="p-res">–</span></div>' +
          '<div class="r-alt" id="p-alt"></div>' +
          (m.v.length > 1 ? '<div class="legend" id="p-legend"></div>' : '') +
          '<div class="status" id="p-status"></div>' +
        '</div>' +
        '<div class="chart-col"><svg id="p-chart" viewBox="0 0 600 300" role="img" aria-label="Curva S-T '+esc(m.t)+'"></svg></div>' +
      '</div>' +
      '<div class="notes" id="p-notes"></div>';

    document.getElementById('in-p').addEventListener('input', function(){
      var x = parseFloat(this.value) || 0; state.P = us ? x / 145.0377 : x; draw();
    });
    document.getElementById('in-t').addEventListener('input', function(){
      var x = parseFloat(this.value); if (isNaN(x)) x = 0; state.T = us ? fToC(x) : x; draw();
    });
    if (m.byD){
      document.getElementById('in-d').addEventListener('input', function(){
        var x = parseFloat(this.value) || 0; state.D = us ? x * IN : x; pickByDiameter(); draw();
      });
    } else if (m.v.length > 1){
      document.getElementById('in-v').addEventListener('change', function(){ state.vi = parseInt(this.value, 10); draw(); });
    }
    draw();
  }

  function niceStep(range, target){
    var raw = range / target, p = Math.pow(10, Math.floor(Math.log10(raw))), n = raw / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
  }

  function draw(){
    var m = state.mat, us = units === 'us';
    var uT = us ? '°F' : '°C', uS = us ? 'ksi' : 'MPa';
    var v = m.v[state.vi], curves = m.v.map(curve), c = curves[state.vi];
    var T = us ? cToF(state.T) : state.T;

    document.getElementById('p-ref').textContent = v.ref;

    // ---- gráfico
    var svg = document.getElementById('p-chart');
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    var W = 600, H = 300, Mg = { l: 48, r: 16, t: 14, b: 34 };
    var plotW = W - Mg.l - Mg.r, plotH = H - Mg.t - Mg.b;

    var tLo = Infinity, tHi = -Infinity, sHi = 0;
    curves.forEach(function(cv){
      tLo = Math.min(tLo, cv.pts[0][0]); tHi = Math.max(tHi, cv.tm);
      cv.pts.forEach(function(p){ if (p[0] <= cv.tm) sHi = Math.max(sHi, p[1]); });
    });
    var xStep = niceStep(tHi - tLo, 7);
    var xMin = Math.floor(tLo / 50) * 50, xMax = Math.ceil(tHi / xStep) * xStep;
    var yStep = niceStep(sHi * 1.1, 4), yMax = Math.ceil(sHi * 1.1 / yStep) * yStep;
    function sx(x){ return Mg.l + (x - xMin) / (xMax - xMin) * plotW; }
    function sy(y){ return Mg.t + plotH - y / yMax * plotH; }

    for (var yt = 0; yt <= yMax + 1e-9; yt += yStep){
      svg.appendChild(el('line', {class:'gridline', x1:Mg.l, x2:W-Mg.r, y1:sy(yt), y2:sy(yt)}));
      var yl = el('text', {class:'tick-label', x:Mg.l-8, y:sy(yt)+3, 'text-anchor':'end'});
      yl.textContent = String(Math.round(yt * 100) / 100).replace('.', ','); svg.appendChild(yl);
    }
    for (var xt = Math.ceil(xMin / xStep) * xStep; xt <= xMax + 1e-9; xt += xStep){
      var xl = el('text', {class:'tick-label', x:sx(xt), y:H-Mg.b+16, 'text-anchor':'middle'});
      xl.textContent = Math.round(xt); svg.appendChild(xl);
    }
    var xa = el('text', {class:'axis-label', x:Mg.l+plotW/2, y:H-3, 'text-anchor':'middle'});
    xa.textContent = 'Temperatura (' + uT + ')'; svg.appendChild(xa);
    var ya = el('text', {class:'axis-label', x:10, y:Mg.t+plotH/2, 'text-anchor':'middle', transform:'rotate(-90 10 '+(Mg.t+plotH/2)+')'});
    ya.textContent = 'S (' + uS + ')'; svg.appendChild(ya);
    svg.appendChild(el('line', {class:'baseline', x1:Mg.l, x2:W-Mg.r, y1:Mg.t+plotH, y2:Mg.t+plotH}));

    if (c.tc != null && c.tc < c.tm){
      svg.appendChild(el('line', {class:'creep-line', x1:sx(c.tc), x2:sx(c.tc), y1:Mg.t, y2:Mg.t+plotH}));
      var cl = el('text', {class:'creep-label', x:sx(c.tc)+4, y:Mg.t+9});
      cl.textContent = 'fluencia ≥ ' + fmtT(c.tc) + ' ' + uT; svg.appendChild(cl);
    }

    function pathFor(cv){
      var pts = cv.pts.filter(function(p){ return p[0] < cv.tm; });
      var end = interpRaw(cv, cv.tm);
      pts.push([cv.tm, end]);
      return 'M' + pts.map(function(p){ return sx(p[0]).toFixed(1) + ',' + sy(p[1]).toFixed(1); }).join(' L');
    }
    function interpRaw(cv, t){
      var pts = cv.pts;
      for (var k = 0; k < pts.length - 1; k++){
        if (t >= pts[k][0] && t <= pts[k+1][0]){
          var f = (t - pts[k][0]) / (pts[k+1][0] - pts[k][0]);
          return pts[k][1] + f * (pts[k+1][1] - pts[k][1]);
        }
      }
      return pts[pts.length-1][1];
    }
    // inactivas primero, activa encima
    curves.forEach(function(cv, i){
      if (i === state.vi) return;
      svg.appendChild(el('path', {d:pathFor(cv), class:'curve-line c-s'+(i+1), 'stroke-width':1.7, opacity:0.4}));
    });
    svg.appendChild(el('path', {d:pathFor(c), class:'curve-line c-s'+(state.vi+1), 'stroke-width':2.5}));

    // hover: punto tabulado más cercano de la curva activa
    var hp = c.pts.filter(function(p){ return p[0] <= c.tm; });
    var hoverLine = el('line', {class:'hover-line', x1:0, x2:0, y1:Mg.t, y2:Mg.t+plotH});
    var hoverDot = el('circle', {class:'hover-dot c-s'+(state.vi+1), r:4.5, cx:0, cy:0});
    var hoverBox = el('g', {class:'hover-box'});
    var hoverRect = el('rect', {x:0, y:0, width:96, height:32, rx:4});
    var hoverT = el('text', {class:'hb-t', x:7, y:13});
    var hoverS = el('text', {class:'hb-s', x:7, y:25});
    hoverBox.appendChild(hoverRect); hoverBox.appendChild(hoverT); hoverBox.appendChild(hoverS);
    var capture = el('rect', {class:'hover-capture', x:Mg.l, y:Mg.t, width:plotW, height:plotH});
    svg.appendChild(capture); svg.appendChild(hoverLine); svg.appendChild(hoverDot);

    // punto de diseño
    var res = interp(c, T);
    var show = !(m.byD && state.dOut);
    if (show){
      var dpx = sx(res.t), dpy = sy(res.s);
      svg.appendChild(el('line', {class:'design-line', x1:dpx, x2:dpx, y1:Mg.t+plotH, y2:dpy}));
      svg.appendChild(el('line', {class:'design-line', x1:Mg.l, x2:dpx, y1:dpy, y2:dpy}));
      svg.appendChild(el('circle', {class:'design-point', cx:dpx, cy:dpy, r:6}));
    }
    svg.appendChild(hoverBox);

    function onMove(evt){
      var rect = svg.getBoundingClientRect();
      var mx = (evt.clientX - rect.left) * (W / rect.width);
      var vx = xMin + (mx - Mg.l) / plotW * (xMax - xMin);
      var near = hp[0], best = Infinity;
      hp.forEach(function(p){ var d = Math.abs(p[0] - vx); if (d < best){ best = d; near = p; } });
      var px = sx(near[0]), py = sy(near[1]);
      hoverLine.setAttribute('x1', px); hoverLine.setAttribute('x2', px);
      hoverDot.setAttribute('cx', px); hoverDot.setAttribute('cy', py);
      hoverLine.style.opacity = 1; hoverDot.style.opacity = 1; hoverBox.style.opacity = 1;
      hoverBox.setAttribute('transform', 'translate('+Math.min(px + 8, W - Mg.r - 100)+','+Math.max(py - 38, Mg.t + 2)+')');
      hoverT.textContent = fmtT(near[0]) + ' ' + uT;
      hoverS.textContent = fmtS(near[1]) + ' ' + uS;
    }
    function onLeave(){ hoverLine.style.opacity = 0; hoverDot.style.opacity = 0; hoverBox.style.opacity = 0; }
    capture.addEventListener('mousemove', onMove);
    capture.addEventListener('mouseleave', onLeave);
    capture.addEventListener('touchmove', function(e){ onMove(e.touches[0]); }, {passive:true});
    capture.addEventListener('touchend', onLeave);

    // ---- resultado
    var resEl = document.getElementById('p-res'), altEl = document.getElementById('p-alt');
    if (!show){ resEl.innerHTML = '&ndash;'; altEl.textContent = ''; }
    else {
      resEl.innerHTML = fmtS(res.s) + ' <small>' + uS + (c.official ? '' : ' conv.') + '</small>';
      if (us){
        altEl.textContent = c.official ? 'Valor tabulado en unidades US.' : 'Convertido desde ' + fmtS(res.s * KSI) + ' MPa (II-D Metric).';
      } else {
        altEl.textContent = '≈ ' + fmtS(res.s / KSI) + ' ksi';
      }
    }

    // ---- leyenda
    var lg = document.getElementById('p-legend');
    if (lg){
      lg.innerHTML = m.v.map(function(x, i){
        return '<button type="button" class="lg'+(i === state.vi ? ' on' : '')+'" data-i="'+i+'"'+(m.byD ? ' disabled' : '')+'><span class="sw s'+(i+1)+'"></span>'+esc(x.l)+'</button>';
      }).join('');
      if (!m.byD){
        lg.querySelectorAll('.lg').forEach(function(b){
          b.addEventListener('click', function(){
            state.vi = parseInt(b.getAttribute('data-i'), 10);
            var sel = document.getElementById('in-v'); if (sel) sel.value = state.vi;
            draw();
          });
        });
      }
    }

    // ---- estado
    var msgs = [], warn = false;
    msgs.push('P = ' + (us ? Math.round(state.P * 145.0377) + ' psi' : state.P.toFixed(2).replace('.', ',') + ' MPa') + '.');
    if (res.below){
      msgs.push('T por debajo de ' + fmtT(res.tmin) + ' ' + uT + ': se usa el valor de la primera columna; comprobar tenacidad/MDMT.');
    } else if (res.above){
      warn = true;
      msgs.push('⚠ T supera el límite VIII-1 de este material (' + fmtT(res.tmax) + ' ' + uT + '). No extrapolar.');
    } else {
      msgs.push('T en rango VIII-1 (hasta ' + fmtT(res.tmax) + ' ' + uT + ').');
    }
    if (!res.above && c.tc != null && T >= c.tc){
      msgs.push('Zona de fluencia: S gobernada por propiedades dependientes del tiempo.');
    }
    if (m.byD){
      if (state.dOut){ warn = true; msgs.push('⚠ Diámetro fuera del rango tabulado.'); }
      else msgs.push('Clase por diámetro: ' + v.l + '.');
    }
    var st = document.getElementById('p-status');
    st.className = warn ? 'status warn' : 'status';
    st.textContent = msgs.join('  ');

    // ---- notas
    var nEl = document.getElementById('p-notes');
    var codes = v.n ? v.n.split(', ') : [];
    var dict = NOTE_TXT[m.tab] || {};
    var expl = codes.filter(function(k){ return dict[k]; }).map(function(k){ return '<li><b>'+k+'</b> — '+dict[k]+'</li>'; }).join('');
    var tnote = c.tc != null ? '<li><b>'+codes.filter(function(k){ return /^T\d+$/.test(k); }).join(', ')+'</b> — Valores obtenidos de propiedades dependientes del tiempo a partir de ' + fmtT(us ? cToF(v.tc) : v.tc) + ' ' + uT + '.</li>' : '';
    nEl.innerHTML = '<b>'+esc(v.ref)+'</b>' + (codes.length ? ' · Notas de la tabla: <b>'+esc(v.n)+'</b>' : ' · Sin notas.') +
      (expl || tnote ? '<ul>'+expl+tnote+'</ul>' : '') +
      (m.src === 'viii' ? '<ul><li>Valor único entre −29 y 345 °C (−20 a 650 °F). Aplicar el factor de calidad de fundición de UG-24.</li></ul>' : '');
  }


  if (!CAT){ buildHub(); return; }
  selMat.addEventListener('change', function(){ selectMaterial(selMat.value); });
  markUnits();
  buildCatalog();
  fillMats();
  selectMaterial(catMats(CAT)[0].id);
})();

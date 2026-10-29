/* Biblioteca de proyectos en la nube (Supabase): usuarios, proyectos compartidos con el equipo y revisiones.
   Usa la API REST de Supabase (GoTrue + PostgREST) sin dependencias. La seguridad la aplican las políticas RLS del script SQL. */
var NUBE = (function(){
  'use strict';
  var SQL = [
    '-- Ejecutar una vez en Supabase › SQL Editor',
    'create table if not exists public.vessels (',
    '  id uuid primary key default gen_random_uuid(),',
    '  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,',
    '  owner_email text, name text not null, tag text, client text,',
    '  shared boolean not null default false,',
    '  created_at timestamptz not null default now(), updated_at timestamptz not null default now()',
    ');',
    'create table if not exists public.vessel_revisions (',
    '  id bigserial primary key,',
    '  vessel_id uuid not null references public.vessels(id) on delete cascade,',
    '  rev text not null, note text,',
    '  author uuid not null default auth.uid() references auth.users(id),',
    '  author_email text, data jsonb not null,',
    '  created_at timestamptz not null default now()',
    ');',
    'alter table public.vessels enable row level security;',
    'alter table public.vessel_revisions enable row level security;',
    'create policy "vessels_select" on public.vessels for select to authenticated using (owner = auth.uid() or shared);',
    'create policy "vessels_insert" on public.vessels for insert to authenticated with check (owner = auth.uid());',
    'create policy "vessels_update" on public.vessels for update to authenticated using (owner = auth.uid() or shared);',
    'create policy "vessels_delete" on public.vessels for delete to authenticated using (owner = auth.uid());',
    'create policy "revs_select" on public.vessel_revisions for select to authenticated using (exists (select 1 from public.vessels v where v.id = vessel_id and (v.owner = auth.uid() or v.shared)));',
    'create policy "revs_insert" on public.vessel_revisions for insert to authenticated with check (author = auth.uid() and exists (select 1 from public.vessels v where v.id = vessel_id and (v.owner = auth.uid() or v.shared)));'
  ].join('\n');
  var KEY = 'asme-cloud', st = { url: '', key: '', session: null };
  try { var s0 = JSON.parse(localStorage.getItem(KEY) || '{}'); st.url = s0.url || ''; st.key = s0.key || ''; st.session = s0.session || null; } catch (e) {}
  function persist(){ try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} }
  function esc(s){ return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }
  function base(){ return st.url.replace(/\/+$/, ''); }
  function req(path, opt){
    opt = opt || {};
    var h = { apikey: st.key, 'Content-Type': 'application/json' };
    if (st.session && st.session.access_token && !opt.anon) h.Authorization = 'Bearer ' + st.session.access_token;
    Object.assign(h, opt.headers || {});
    return fetch(base() + path, { method: opt.method || 'GET', headers: h, body: opt.body ? JSON.stringify(opt.body) : undefined }).then(function(r){
      return r.text().then(function(t){ var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) { j = t; }
        if (r.status === 401 && st.session && st.session.refresh_token && !opt.retry) return refresh().then(function(){ opt.retry = true; return req(path, opt); });
        if (!r.ok) throw new Error((j && (j.msg || j.message || j.error_description || j.error)) || ('HTTP ' + r.status)); return j; });
    });
  }
  function refresh(){ return fetch(base() + '/auth/v1/token?grant_type=refresh_token', { method: 'POST', headers: { apikey: st.key, 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: st.session.refresh_token }) })
    .then(function(r){ return r.json().then(function(j){ if (!r.ok) { st.session = null; persist(); throw new Error('Sesión caducada: vuelve a entrar'); } st.session = j; persist(); }); }); }
  function login(email, pass){ return req('/auth/v1/token?grant_type=password', { method: 'POST', body: { email: email, password: pass }, anon: true }).then(function(j){ st.session = j; persist(); return j; }); }
  function signup(email, pass){ return req('/auth/v1/signup', { method: 'POST', body: { email: email, password: pass }, anon: true }).then(function(j){ if (j && j.access_token){ st.session = j; persist(); } return j; }); }
  function logout(){ var p = st.session ? req('/auth/v1/logout', { method: 'POST' }).catch(function(){}) : Promise.resolve(); st.session = null; persist(); return p; }
  function me(){ return st.session && st.session.user ? st.session.user : null; }
  function listVessels(){ return req('/rest/v1/vessels?select=*&order=updated_at.desc'); }
  function listRevs(id){ return req('/rest/v1/vessel_revisions?vessel_id=eq.' + encodeURIComponent(id) + '&select=id,rev,note,author_email,created_at&order=created_at.desc'); }
  function getRev(rid){ return req('/rest/v1/vessel_revisions?id=eq.' + rid + '&select=data,rev').then(function(a){ return a && a[0]; }); }
  function saveNew(prj, note, shared){
    var i = prj.info || {}, u = me();
    return req('/rest/v1/vessels', { method: 'POST', headers: { Prefer: 'return=representation' }, body: { name: (i.equipo || i.tag || 'Recipiente'), tag: i.tag || '', client: i.cliente || '', shared: !!shared, owner_email: u ? u.email : '' } })
      .then(function(a){ var v = a[0]; prj._cloud = { id: v.id, name: v.name }; return addRev(prj, note).then(function(){ return v; }); });
  }
  function addRev(prj, note){
    var u = me(), i = prj.info || {}, revs = (prj.fab && prj.fab.revs) || [], rev = revs.length ? revs[revs.length - 1].rev : (i.rev || '0');
    var data = JSON.parse(JSON.stringify(prj));
    return req('/rest/v1/vessel_revisions', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: { vessel_id: prj._cloud.id, rev: String(rev), note: note || '', author_email: u ? u.email : '', data: data } })
      .then(function(){ return req('/rest/v1/vessels?id=eq.' + prj._cloud.id, { method: 'PATCH', body: { updated_at: new Date().toISOString(), name: i.equipo || i.tag || prj._cloud.name, tag: i.tag || '', client: i.cliente || '' } }); });
  }
  function setShared(id, on){ return req('/rest/v1/vessels?id=eq.' + id, { method: 'PATCH', body: { shared: !!on } }); }
  function del(id){ return req('/rest/v1/vessels?id=eq.' + id, { method: 'DELETE' }); }
  // diferencias entre dos proyectos (rutas cambiadas)
  function diff(a, b, path, out){
    out = out || []; path = path || '';
    if (out.length > 300) return out;
    if (a && b && typeof a === 'object' && typeof b === 'object'){
      var keys = {}; Object.keys(a).forEach(function(k){ keys[k] = 1; }); Object.keys(b).forEach(function(k){ keys[k] = 1; });
      Object.keys(keys).forEach(function(k){ if (k === '_cloud') return; diff(a[k], b[k], path ? path + '.' + k : k, out); });
    } else if (JSON.stringify(a) !== JSON.stringify(b)) out.push({ p: path, a: a, b: b });
    return out;
  }
  // ---------- interfaz (ventana modal) ----------
  var host = null, cur = null, app = null;
  function css(){ if (document.getElementById('nube-css')) return; var s = document.createElement('style'); s.id = 'nube-css';
    s.textContent = '.nb-ov{position:fixed;inset:0;background:rgba(10,14,20,.45);z-index:50;display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:30px 12px}' +
      '.nb{background:var(--card,#fff);color:var(--ink,#111);border:1px solid var(--border,#ccd);border-radius:12px;max-width:860px;width:100%;padding:16px;box-shadow:0 10px 40px rgba(0,0,0,.25)}' +
      '.nb h3{margin:0 0 10px;font-size:17px;display:flex;justify-content:space-between;align-items:center}.nb .row{display:flex;gap:8px;flex-wrap:wrap;margin:6px 0}.nb input[type=text],.nb input[type=password],.nb input[type=email]{flex:1;min-width:180px;padding:7px;border:1px solid var(--border,#ccd);border-radius:6px;background:var(--card,#fff);color:inherit;font:inherit}' +
      '.nb table{width:100%;border-collapse:collapse;font-size:12.5px}.nb th,.nb td{border-bottom:1px solid var(--hairline,#e3e6ea);padding:5px;text-align:left;vertical-align:top}.nb .msg{font-size:12px;color:var(--ink-mute,#666);margin:6px 0}.nb .err{color:#c93a39}.nb pre{font-size:11px;max-height:220px;overflow:auto;background:var(--card-2,#f4f6f9);padding:8px;border-radius:6px;white-space:pre-wrap}.nb .tag{font-size:10.5px;padding:1px 6px;border-radius:4px;background:var(--accent-wash,#e8f0fb)}'; document.head.appendChild(s); }
  function open(a){ app = a; css(); if (!host){ host = document.createElement('div'); host.className = 'nb-ov'; host.addEventListener('click', function(e){ if (e.target === host) close(); }); document.body.appendChild(host); } host.style.display = 'flex'; render(); }
  function close(){ if (host) host.style.display = 'none'; }
  function msg(t, err){ var m = host.querySelector('.msg'); if (m){ m.textContent = t; m.className = 'msg' + (err ? ' err' : ''); } }
  function fail(e){ msg(e.message || String(e), true); }
  function render(){
    var h = '<div class="nb"><h3>Biblioteca de proyectos en la nube <button class="btn sm" data-a="close">✕</button></h3>';
    if (!st.url || !st.key || cur === 'cfg'){
      h += '<div class="msg">Conectar con un proyecto de Supabase (Project Settings › API: URL y clave «anon public»). Ejecutar antes el script SQL para crear las tablas y las políticas de seguridad.</div>' +
        '<div class="row"><input type="text" id="nb-url" placeholder="https://xxxx.supabase.co" value="' + esc(st.url) + '"></div><div class="row"><input type="text" id="nb-key" placeholder="clave anon public" value="' + esc(st.key) + '"></div>' +
        '<div class="row"><button class="btn" data-a="cfgsave">Guardar conexión</button><button class="btn" data-a="sql">Ver script SQL</button></div><pre id="nb-sql" style="display:none">' + esc(SQL) + '</pre>';
    } else if (!me()){
      h += '<div class="msg">Conectado a ' + esc(st.url) + '. Entra con tu usuario o crea uno (Supabase › Authentication: confirmar el correo si está activado).</div>' +
        '<div class="row"><input type="email" id="nb-mail" placeholder="correo"><input type="password" id="nb-pass" placeholder="contraseña"></div>' +
        '<div class="row"><button class="btn" data-a="login">Entrar</button><button class="btn" data-a="signup">Crear usuario</button><button class="btn" data-a="cfg">Cambiar conexión</button></div>';
    } else {
      var p = app.get(), linked = p._cloud && p._cloud.id;
      h += '<div class="row" style="justify-content:space-between"><span class="msg">Usuario: <b>' + esc(me().email) + '</b>' + (linked ? ' · proyecto actual vinculado a «' + esc(p._cloud.name) + '»' : ' · proyecto actual no guardado en la nube') + '</span><span><button class="btn sm" data-a="logout">Salir</button> <button class="btn sm" data-a="cfg">Conexión</button></span></div>' +
        '<div class="row"><input type="text" id="nb-note" placeholder="Nota de la revisión (qué ha cambiado)">' + (linked ? '<button class="btn" data-a="addrev">Guardar nueva revisión</button>' : '') + '<button class="btn" data-a="savenew">Guardar como proyecto nuevo</button><label class="msg"><input type="checkbox" id="nb-sh"> compartido con el equipo</label></div>' +
        '<div id="nb-list" class="msg">Cargando…</div><div id="nb-revs"></div>';
    }
    h += '<div class="msg"></div></div>';
    host.innerHTML = h;
    host.querySelectorAll('[data-a]').forEach(function(b){ b.addEventListener('click', function(){ act(b.getAttribute('data-a'), b.getAttribute('data-id'), b.getAttribute('data-x')); }); });
    if (me() && st.url && cur !== 'cfg') loadList();
  }
  function loadList(){
    listVessels().then(function(list){
      var u = me(), el = host.querySelector('#nb-list'); if (!el) return;
      if (!list.length){ el.textContent = 'Sin proyectos todavía.'; return; }
      el.innerHTML = '<table><thead><tr><th>Equipo</th><th>TAG</th><th>Cliente</th><th>Propietario</th><th>Actualizado</th><th></th></tr></thead><tbody>' + list.map(function(v){
        var mine = u && v.owner === u.id;
        return '<tr><td>' + esc(v.name) + (v.shared ? ' <span class="tag">compartido</span>' : '') + '</td><td>' + esc(v.tag) + '</td><td>' + esc(v.client) + '</td><td>' + esc(v.owner_email || (mine ? 'yo' : '')) + '</td><td>' + esc((v.updated_at || '').slice(0, 16).replace('T', ' ')) + '</td><td style="white-space:nowrap">' +
          '<button class="btn sm" data-a="revs" data-id="' + v.id + '" data-x="' + esc(v.name) + '">Revisiones</button>' + (mine ? ' <button class="btn sm" data-a="share" data-id="' + v.id + '" data-x="' + (v.shared ? '0' : '1') + '">' + (v.shared ? 'Dejar de compartir' : 'Compartir') + '</button> <button class="btn sm" data-a="del" data-id="' + v.id + '" data-x="' + esc(v.name) + '">Borrar</button>' : '') + '</td></tr>';
      }).join('') + '</tbody></table>';
      el.querySelectorAll('[data-a]').forEach(function(b){ b.addEventListener('click', function(){ act(b.getAttribute('data-a'), b.getAttribute('data-id'), b.getAttribute('data-x')); }); });
    }).catch(fail);
  }
  function showRevs(id, name){
    listRevs(id).then(function(revs){
      var el = host.querySelector('#nb-revs');
      el.innerHTML = '<h3 style="font-size:14px;margin-top:12px">Revisiones de «' + esc(name) + '»</h3><table><thead><tr><th>Rev.</th><th>Fecha</th><th>Autor</th><th>Nota</th><th></th></tr></thead><tbody>' + revs.map(function(r, k){
        return '<tr><td>' + esc(r.rev) + '</td><td>' + esc((r.created_at || '').slice(0, 16).replace('T', ' ')) + '</td><td>' + esc(r.author_email) + '</td><td>' + esc(r.note) + '</td><td style="white-space:nowrap"><button class="btn sm" data-a="open" data-id="' + r.id + '" data-x="' + id + '|' + esc(name) + '">Abrir</button>' +
          (k < revs.length - 1 ? ' <button class="btn sm" data-a="cmp" data-id="' + r.id + '" data-x="' + revs[k + 1].id + '">Comparar con la anterior</button>' : '') + '</td></tr>'; }).join('') + '</tbody></table><pre id="nb-diff" style="display:none"></pre>';
      el.querySelectorAll('[data-a]').forEach(function(b){ b.addEventListener('click', function(){ act(b.getAttribute('data-a'), b.getAttribute('data-id'), b.getAttribute('data-x')); }); });
    }).catch(fail);
  }
  function act(a, id, xx){
    if (a === 'close') return close();
    if (a === 'sql'){ var pre = host.querySelector('#nb-sql'); pre.style.display = pre.style.display === 'none' ? '' : 'none'; return; }
    if (a === 'cfg'){ cur = 'cfg'; return render(); }
    if (a === 'cfgsave'){ st.url = host.querySelector('#nb-url').value.trim(); st.key = host.querySelector('#nb-key').value.trim(); st.session = null; persist(); cur = null; return render(); }
    if (a === 'login' || a === 'signup'){ var em = host.querySelector('#nb-mail').value.trim(), pw = host.querySelector('#nb-pass').value; msg('Conectando…');
      (a === 'login' ? login(em, pw) : signup(em, pw)).then(function(j){ if (a === 'signup' && !(j && j.access_token)) msg('Usuario creado: confirma el correo y entra.'); else render(); }).catch(fail); return; }
    if (a === 'logout'){ logout().then(render); return; }
    var note = host.querySelector('#nb-note') ? host.querySelector('#nb-note').value : '';
    if (a === 'savenew'){ msg('Guardando…'); saveNew(app.get(), note, host.querySelector('#nb-sh').checked).then(function(){ render(); msg('Proyecto guardado en la nube.'); }).catch(fail); return; }
    if (a === 'addrev'){ msg('Guardando…'); addRev(app.get(), note).then(function(){ render(); msg('Revisión guardada.'); }).catch(fail); return; }
    if (a === 'revs') return showRevs(id, xx);
    if (a === 'share'){ setShared(id, xx === '1').then(loadList).catch(fail); return; }
    if (a === 'del'){ if (!confirm('¿Borrar «' + xx + '» y todas sus revisiones de la nube?')) return; del(id).then(function(){ host.querySelector('#nb-revs').innerHTML = ''; loadList(); }).catch(fail); return; }
    if (a === 'open'){ if (!confirm('¿Abrir esta revisión? Se sustituye el proyecto actual (guárdalo antes si tiene cambios).')) return;
      getRev(id).then(function(r){ var q = xx.split('|'); r.data._cloud = { id: q[0], name: q.slice(1).join('|') }; app.set(r.data); close(); }).catch(fail); return; }
    if (a === 'cmp'){ Promise.all([getRev(id), getRev(xx)]).then(function(r){ var dd = diff(r[1].data, r[0].data), pre = host.querySelector('#nb-diff'); pre.style.display = '';
      pre.textContent = dd.length ? 'Cambios de rev. ' + r[1].rev + ' a rev. ' + r[0].rev + ':\n' + dd.map(function(q){ return q.p + ': ' + JSON.stringify(q.a) + ' → ' + JSON.stringify(q.b); }).join('\n') : 'Sin diferencias.'; }).catch(fail); return; }
  }
  return { open: open, close: close, SQL: SQL, diff: diff, _st: st };
})();

/* =====================================================================
   FINAV · Control de Personal — Lógica del front end
   ===================================================================== */
(function () {
  'use strict';

  const CFG = window.FINAV_CONFIG || {};
  const TZ = CFG.TIMEZONE || 'America/Guayaquil';
  const DEMO = !CFG.API_URL;
  const $ = (id) => document.getElementById(id);

  // ------------------------------------------------------------------
  // Catálogo de eventos (orden de presentación)
  // ------------------------------------------------------------------
  const ICONS = {
    in:   '<svg viewBox="0 0 24 24"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/></svg>',
    out:  '<svg viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>',
    food: '<svg viewBox="0 0 24 24"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>',
    back: '<svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/></svg>',
    perm: '<svg viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 7h6M9 11h6M9 15h3"/></svg>',
    ret:  '<svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>',
    ask:  '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>'
  };
  const EVENTS = [
    { key: 'INGRESO',          name: 'Ingreso a turno',            short: 'Ingreso',          icon: ICONS.in },
    { key: 'SALIDA_ALMUERZO',  name: 'Salida a almuerzo',          short: 'Salida almuerzo',  icon: ICONS.food },
    { key: 'RETORNO_ALMUERZO', name: 'Retorno de almuerzo',        short: 'Retorno almuerzo', icon: ICONS.back },
    { key: 'SALIDA_PERMISO',   name: 'Salida con permiso temporal', short: 'Salida permiso',  icon: ICONS.perm },
    { key: 'RETORNO_PERMISO',  name: 'Retorno de permiso temporal', short: 'Retorno permiso', icon: ICONS.ret },
    { key: 'SALIDA',           name: 'Salida de turno',            short: 'Salida',           icon: ICONS.out }
  ];
  const EV = Object.fromEntries(EVENTS.map((e) => [e.key, e]));

  const STATUS = {
    SIN_JORNADA: { label: 'Sin jornada activa', cls: 'chip--idle' },
    EN_TURNO:    { label: 'En turno',           cls: 'chip--ok' },
    EN_ALMUERZO: { label: 'En almuerzo',        cls: 'chip--warn' },
    EN_PERMISO:  { label: 'En permiso',         cls: 'chip--warn' }
  };

  // ------------------------------------------------------------------
  // Estado de la UI
  // ------------------------------------------------------------------
  let session = null;      // { token, user, state }
  let pending = null;      // { evento, motivo }
  let idleTimer = null, idleLeft = 0;
  let okTimer = null;
  let serverOffset = 0;    // ms entre reloj del servidor y del equipo

  // ------------------------------------------------------------------
  // Reloj
  // ------------------------------------------------------------------
  const fmtTime = new Intl.DateTimeFormat('es-EC', { timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const fmtDate = new Intl.DateTimeFormat('es-EC', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const fmtDateShort = new Intl.DateTimeFormat('es-EC', { timeZone: TZ, weekday: 'short', day: '2-digit', month: 'short' });
  function tick() {
    const now = new Date(Date.now() + serverOffset);
    const [h, m, s] = fmtTime.format(now).split(':');
    $('bigTime').firstChild.nodeValue = h + ':' + m;
    $('bigSec').textContent = ':' + s;
    $('bigDate').textContent = fmtDate.format(now);
    $('tbTime').textContent = h + ':' + m;
    $('tbDate').textContent = fmtDateShort.format(now);
  }

  // ------------------------------------------------------------------
  // API
  // ------------------------------------------------------------------
  async function api(payload) {
    if (DEMO) return MockApi.call(payload);
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 30000);
    try {
      const res = await fetch(CFG.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // evita preflight CORS
        body: JSON.stringify(payload),
        redirect: 'follow',
        signal: ctrl.signal
      });
      const data = await res.json();
      setConn('ok');
      return data;
    } catch (err) {
      setConn('err');
      return { ok: false, error: err.name === 'AbortError'
        ? 'El servidor tardó demasiado en responder. Intente nuevamente.'
        : 'No se pudo conectar con el servidor. Verifique su conexión a internet.' };
    } finally { clearTimeout(t); }
  }

  function setConn(kind) {
    const b = $('connBadge');
    b.classList.remove('is-ok', 'is-err', 'is-demo');
    if (kind === 'ok') { b.classList.add('is-ok'); $('connText').textContent = 'En línea'; }
    else if (kind === 'demo') { b.classList.add('is-demo'); $('connText').textContent = 'Modo demo'; }
    else { b.classList.add('is-err'); $('connText').textContent = 'Sin conexión'; }
  }

  async function ping() {
    const r = await api({ action: 'ping' });
    if (r && r.ok && r.serverTime && r.serverTime.epoch) serverOffset = r.serverTime.epoch - Date.now();
    if (r && r.empresa) $('empresaNombre').textContent = r.empresa;
  }

  // ------------------------------------------------------------------
  // Paso 1: Login
  // ------------------------------------------------------------------
  function showLogin() {
    stopIdle();
    session = null; pending = null;
    $('stepEvents').hidden = true;
    $('stepLogin').hidden = false;
    $('loginForm').reset();
    $('loginError').hidden = true;
    $('inPass').type = 'password';
    $('togglePass').classList.remove('is-on');
    setTimeout(() => $('inUser').focus(), 50);
  }

  async function onLogin(e) {
    e.preventDefault();
    const usuario = $('inUser').value.trim().toLowerCase();
    const password = $('inPass').value;
    if (!usuario || !password) return showError('loginError', 'Ingrese su usuario y contraseña.');
    setLoading('btnLogin', true);
    const r = await api({ action: 'login', usuario, password });
    setLoading('btnLogin', false);
    if (!r.ok) {
      showError('loginError', r.error || 'No fue posible iniciar sesión.');
      $('inPass').value = ''; $('inPass').focus();
      return;
    }
    session = { token: r.token, user: r.user, state: r.state };
    if (r.serverTime && r.serverTime.epoch) serverOffset = r.serverTime.epoch - Date.now();
    showEvents();
  }

  // ------------------------------------------------------------------
  // Paso 2: Eventos
  // ------------------------------------------------------------------
  function showEvents() {
    const { user, state } = session;
    $('stepLogin').hidden = true;
    $('stepEvents').hidden = false;
    $('eventError').hidden = true;
    $('permisoBox').hidden = true;

    $('whoName').textContent = user.nombre;
    $('whoAvatar').textContent = initials(user.nombre);
    $('whoMeta').textContent = [user.cargo, user.area].filter(Boolean).join(' · ') || user.usuario;
    const st = STATUS[state.status] || STATUS.SIN_JORNADA;
    const chip = $('statusChip');
    chip.className = 'chip ' + st.cls;
    chip.textContent = st.label;

    renderTimeline(state);
    renderEvents(state);
    startIdle();
  }

  function renderTimeline(state) {
    const r = state.record || {};
    const nowKey = { EN_ALMUERZO: 'salidaAlmuerzo', EN_PERMISO: state.permisoAbierto === 2 ? 'salidaPermiso2' : 'salidaPermiso1' }[state.status];
    const slots = [
      ['Ingreso', 'ingreso'], ['Salida almuerzo', 'salidaAlmuerzo'], ['Retorno almuerzo', 'retornoAlmuerzo'], ['Salida turno', 'salida'],
      ['Permiso 1 · salida', 'salidaPermiso1', 'motivoPermiso1'], ['Permiso 1 · retorno', 'retornoPermiso1'],
      ['Permiso 2 · salida', 'salidaPermiso2', 'motivoPermiso2'], ['Permiso 2 · retorno', 'retornoPermiso2']
    ];
    const html = slots.map(([k, f, mf]) => {
      const v = r[f];
      const cls = ['tl', v ? 'is-done' : '', nowKey === f ? 'is-now' : ''].join(' ');
      const sub = mf && r[mf] ? `<div class="tl__sub" title="${esc(r[mf])}">${esc(r[mf])}</div>` : '';
      return `<div class="${cls}"><div class="tl__k">${k}</div><div class="tl__v">${v || '--:--:--'}</div>${sub}</div>`;
    }).join('');
    let header = '';
    if (state.status === 'SIN_JORNADA' && state.lastClosed) {
      header = `<div class="section-title" style="grid-column:1/-1;margin:0">Última jornada · ${esc(state.lastClosed.fecha)} — ${esc(state.lastClosed.estado || '')}</div>`;
    } else if (r.fecha) {
      header = `<div class="section-title" style="grid-column:1/-1;margin:0">Jornada del ${esc(r.fecha)}</div>`;
    } else {
      header = `<div class="section-title" style="grid-column:1/-1;margin:0">Jornada de hoy</div>`;
    }
    $('timeline').innerHTML = header + (state.status === 'SIN_JORNADA' ? emptyTimeline(slots) : html);
  }
  function emptyTimeline(slots) {
    return slots.slice(0, 4).map(([k]) => `<div class="tl"><div class="tl__k">${k}</div><div class="tl__v">--:--:--</div></div>`).join('');
  }

  function reasonFor(key, state) {
    const r = state.record || {};
    if (state.allowed.includes(key)) return 'Disponible';
    const s = state.status;
    switch (key) {
      case 'INGRESO': return 'Ya registró su ingreso';
      case 'SALIDA_ALMUERZO':
        if (s === 'SIN_JORNADA') return 'Requiere ingreso a turno';
        if (r.salidaAlmuerzo) return 'Ya registrado';
        if (s === 'EN_PERMISO') return 'Primero retorne del permiso';
        return 'No disponible';
      case 'RETORNO_ALMUERZO':
        if (r.retornoAlmuerzo) return 'Ya registrado';
        if (s === 'SIN_JORNADA') return 'Requiere ingreso a turno';
        return 'Requiere salida a almuerzo';
      case 'SALIDA_PERMISO':
        if (s === 'SIN_JORNADA') return 'Requiere ingreso a turno';
        if (s === 'EN_ALMUERZO') return 'Primero retorne de almuerzo';
        if (s === 'EN_PERMISO') return 'Ya se encuentra en permiso';
        return 'Límite de permisos alcanzado';
      case 'RETORNO_PERMISO':
        if (s === 'SIN_JORNADA') return 'Requiere ingreso a turno';
        return 'Requiere salida con permiso';
      case 'SALIDA':
        if (s === 'SIN_JORNADA') return 'Requiere ingreso a turno';
        if (s === 'EN_ALMUERZO') return 'Primero retorne de almuerzo';
        if (s === 'EN_PERMISO') return 'Primero retorne del permiso';
        return 'No disponible';
    }
    return '';
  }

  function renderEvents(state) {
    const grid = $('eventsGrid');
    const primary = state.allowed.length === 1 ? state.allowed[0] : null;
    grid.innerHTML = EVENTS.map((e) => {
      const ok = state.allowed.includes(e.key);
      return `<button type="button" class="evt ${primary === e.key ? 'is-primary' : ''}" data-evt="${e.key}" ${ok ? '' : 'disabled aria-disabled="true"'}>
        <span class="evt__icon">${e.icon}</span>
        <span class="evt__name">${e.name}</span>
        <span class="evt__hint">${reasonFor(e.key, state)}</span>
      </button>`;
    }).join('');
    const first = grid.querySelector('.evt:not(:disabled)');
    if (first) setTimeout(() => first.focus(), 60);
  }

  function onEventClick(e) {
    const btn = e.target.closest('.evt');
    if (!btn || btn.disabled) return;
    bumpIdle();
    const key = btn.dataset.evt;
    $('eventError').hidden = true;
    if (key === 'SALIDA_PERMISO') {
      openPermiso();
    } else {
      pending = { evento: key, motivo: '' };
      openConfirm();
    }
  }

  // Permiso temporal
  let motivoSel = '';
  function openPermiso() {
    motivoSel = '';
    $('motivoDetalle').value = '';
    document.querySelectorAll('#motivos button').forEach((b) => b.classList.remove('is-on'));
    $('btnPermisoOk').disabled = true;
    $('permisoBox').hidden = false;
    $('permisoBox').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  function validatePermiso() {
    const det = $('motivoDetalle').value.trim();
    $('btnPermisoOk').disabled = !motivoSel || (motivoSel === 'Otro' && det.length < 3);
  }
  function motivoText() {
    const det = $('motivoDetalle').value.trim();
    if (motivoSel === 'Otro') return det;
    return det ? `${motivoSel}: ${det}` : motivoSel;
  }

  // ------------------------------------------------------------------
  // Confirmación y registro
  // ------------------------------------------------------------------
  function openConfirm() {
    const ev = EV[pending.evento];
    $('cfIcon').innerHTML = ev.icon;
    $('cfText').innerHTML = `Registrar <strong>${ev.name}</strong> para <strong>${esc(session.user.nombre)}</strong>` +
      (pending.motivo ? `<br><small>Motivo: ${esc(pending.motivo)}</small>` : '');
    $('confirmModal').hidden = false;
    setTimeout(() => $('cfYes').focus(), 50);
  }
  function closeConfirm() { $('confirmModal').hidden = true; setLoading('cfYes', false); }

  async function doRegister() {
    if (!pending || !session) return;
    setLoading('cfYes', true);
    stopIdle();
    const r = await api({ action: 'register', token: session.token, evento: pending.evento, motivo: pending.motivo });
    closeConfirm();
    if (!r.ok) {
      if (r.expired) { toast(r.error); showLogin(); return; }
      if (r.state) { session.state = r.state; showEvents(); }
      else startIdle();
      showError('eventError', r.error || 'No fue posible registrar el evento.');
      return;
    }
    showSuccess(r);
  }

  function showSuccess(r) {
    $('stepEvents').hidden = true;
    $('okEvent').textContent = r.eventoLabel;
    $('okHora').textContent = r.hora;
    $('okFecha').textContent = r.fecha;
    $('okWho').textContent = r.nombre;
    $('okModal').hidden = false;
    setTimeout(() => $('okAccept').focus(), 60);
    let left = CFG.SEGUNDOS_AUTOCIERRE_MENSAJE || 30;
    $('okAuto').textContent = `Esta ventana se cerrará automáticamente en ${left} s`;
    clearInterval(okTimer);
    okTimer = setInterval(() => {
      left--;
      $('okAuto').textContent = `Esta ventana se cerrará automáticamente en ${left} s`;
      if (left <= 0) acceptSuccess();
    }, 1000);
  }
  function acceptSuccess() {
    clearInterval(okTimer);
    $('okModal').hidden = true;
    showLogin();
  }

  async function cancelSession() {
    if (session && !DEMO) api({ action: 'logout', token: session.token });
    showLogin();
  }

  // ------------------------------------------------------------------
  // Inactividad
  // ------------------------------------------------------------------
  function startIdle() {
    stopIdle();
    const total = CFG.SEGUNDOS_INACTIVIDAD || 90;
    idleLeft = total;
    renderIdle(total);
    idleTimer = setInterval(() => {
      idleLeft--;
      renderIdle(total);
      if (idleLeft <= 0) { toast('Sesión cerrada por inactividad'); cancelSession(); }
    }, 1000);
  }
  function bumpIdle() { if (idleTimer) idleLeft = CFG.SEGUNDOS_INACTIVIDAD || 90; }
  function stopIdle() { clearInterval(idleTimer); idleTimer = null; }
  function renderIdle(total) {
    $('sessionBar').style.width = Math.max(0, (idleLeft / total) * 100) + '%';
    $('sessionTxt').textContent = idleLeft + ' s';
  }

  // ------------------------------------------------------------------
  // Pestañas
  // ------------------------------------------------------------------
  const MAINT = {
    apertura: ['Apertura de Local', ['Checklist de apertura', 'Registro de responsable y hora', 'Verificación de equipos y temperatura', 'Fondo de caja inicial']],
    caja: ['Cierre de Caja', ['Arqueo por denominación', 'Conciliación de ventas y medios de pago', 'Registro de diferencias', 'Reporte de cierre firmado']],
    inventario: ['Inventario', ['Control de insumos', 'Alertas de stock mínimo', 'Registro de mermas']],
    reportes: ['Reportes', ['Asistencia por empleado y período', 'Horas trabajadas y atrasos', 'Exportación a Excel / PDF']]
  };
  function onTab(e) {
    const t = e.target.closest('.tab');
    if (!t) return;
    document.querySelectorAll('.tab').forEach((b) => { b.classList.toggle('is-active', b === t); b.setAttribute('aria-selected', b === t); });
    const key = t.dataset.tab;
    if (key === 'personal') {
      $('mod-maint').hidden = true; $('mod-personal').hidden = false;
      if (!session) setTimeout(() => $('inUser').focus(), 50);
    } else {
      if (session) cancelSession();
      const [title, items] = MAINT[key];
      $('maintTitle').textContent = title + ' — en mantenimiento';
      $('maintText').textContent = 'Este módulo se encuentra en desarrollo y estará disponible en una próxima entrega. Funcionalidades previstas:';
      $('maintList').innerHTML = items.map((i) => `<li>${i}</li>`).join('');
      $('mod-personal').hidden = true; $('mod-maint').hidden = false;
    }
  }

  // ------------------------------------------------------------------
  // Utilidades
  // ------------------------------------------------------------------
  function initials(n) { return String(n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase(); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function showError(id, msg) { const el = $(id); el.textContent = msg; el.hidden = false; }
  function setLoading(id, on) { const b = $(id); b.classList.toggle('is-loading', on); b.disabled = on; }
  let toastT;
  function toast(msg) { const t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 3500); }

  // ------------------------------------------------------------------
  // MODO DEMOSTRACIÓN (sin backend): misma lógica que el servidor
  // ------------------------------------------------------------------
  const MockApi = (() => {
    const KEY = 'finav_demo_db_v1';
    const USERS = {
      demo:  { pass: 'demo123',  nombre: 'Usuario Demostración', cargo: 'Barista', area: 'Local Principal', rol: 'EMPLEADO' },
      maria: { pass: 'maria123', nombre: 'María Fernanda López', cargo: 'Cajera',  area: 'Local Principal', rol: 'EMPLEADO' }
    };
    const tokens = {};
    const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } };
    const save = (d) => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {} };
    const hm = (d) => fmtTime.format(d);
    const fecha = (d) => new Intl.DateTimeFormat('es-EC', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
    const LABEL = { INGRESO: 'Ingreso a turno', SALIDA_ALMUERZO: 'Salida a almuerzo', RETORNO_ALMUERZO: 'Retorno de almuerzo',
      SALIDA_PERMISO: 'Salida con permiso temporal', RETORNO_PERMISO: 'Retorno de permiso temporal', SALIDA: 'Salida de turno' };

    function state(u) {
      const db = load();
      const mine = db.filter((r) => r.usuario === u);
      const last = mine[mine.length - 1];
      const open = last && last.estado !== 'FINALIZADA' && last.estado !== 'INCOMPLETA' ? last : null;
      if (!open) return { status: 'SIN_JORNADA', allowed: ['INGRESO'], lastClosed: last || null };
      const permisosUsados = (open.salidaPermiso1 ? 1 : 0) + (open.salidaPermiso2 ? 1 : 0);
      let permisoAbierto = 0;
      if (open.salidaPermiso1 && !open.retornoPermiso1) permisoAbierto = 1;
      if (open.salidaPermiso2 && !open.retornoPermiso2) permisoAbierto = 2;
      let status, allowed;
      if (open.salidaAlmuerzo && !open.retornoAlmuerzo) { status = 'EN_ALMUERZO'; allowed = ['RETORNO_ALMUERZO']; }
      else if (permisoAbierto) { status = 'EN_PERMISO'; allowed = ['RETORNO_PERMISO']; }
      else {
        status = 'EN_TURNO'; allowed = [];
        if (!open.salidaAlmuerzo) allowed.push('SALIDA_ALMUERZO');
        if (permisosUsados < 2) allowed.push('SALIDA_PERMISO');
        allowed.push('SALIDA');
      }
      return { status, allowed, permisosUsados, permisoAbierto, maxPermisos: 2, record: open, recordId: open.id };
    }

    async function call(p) {
      await new Promise((r) => setTimeout(r, 350));
      if (p.action === 'ping') return { ok: true, serverTime: { epoch: Date.now() } };
      if (p.action === 'logout') { delete tokens[p.token]; return { ok: true }; }
      if (p.action === 'login') {
        const u = USERS[p.usuario];
        if (!u || u.pass !== p.password) return { ok: false, error: 'Usuario o contraseña incorrectos.' };
        const token = Math.random().toString(36).slice(2);
        tokens[token] = p.usuario;
        return { ok: true, token, user: { usuario: p.usuario, nombre: u.nombre, cargo: u.cargo, area: u.area, rol: u.rol }, state: state(p.usuario) };
      }
      if (p.action === 'register') {
        const usuario = tokens[p.token];
        if (!usuario) return { ok: false, expired: true, error: 'Su sesión expiró. Vuelva a ingresar sus credenciales.' };
        const st = state(usuario);
        if (!st.allowed.includes(p.evento)) return { ok: false, error: 'Secuencia de eventos no permitida.', state: st };
        const now = new Date();
        const db = load();
        if (p.evento === 'INGRESO') {
          db.push({ id: 'REG-' + now.getTime(), usuario, fecha: fecha(now), ingreso: hm(now), estado: 'EN TURNO' });
        } else {
          const rec = db.find((r) => r.id === st.recordId);
          const map = { SALIDA_ALMUERZO: 'salidaAlmuerzo', RETORNO_ALMUERZO: 'retornoAlmuerzo', SALIDA: 'salida' };
          if (p.evento === 'SALIDA_PERMISO') {
            const n = st.permisosUsados === 0 ? 1 : 2;
            rec['salidaPermiso' + n] = hm(now); rec['motivoPermiso' + n] = p.motivo;
          } else if (p.evento === 'RETORNO_PERMISO') {
            rec['retornoPermiso' + st.permisoAbierto] = hm(now);
          } else rec[map[p.evento]] = hm(now);
          rec.estado = p.evento === 'SALIDA' ? 'FINALIZADA' : 'EN TURNO';
        }
        save(db);
        delete tokens[p.token];
        return { ok: true, evento: p.evento, eventoLabel: LABEL[p.evento], hora: hm(now), fecha: fecha(now), nombre: USERS[usuario].nombre };
      }
      return { ok: false, error: 'Acción no reconocida.' };
    }
    return { call };
  })();

  // ------------------------------------------------------------------
  // Inicio
  // ------------------------------------------------------------------
  function init() {
    $('year').textContent = new Date().getFullYear();
    if (CFG.EMPRESA) $('empresaNombre').textContent = CFG.EMPRESA;
    if (DEMO) { $('demoBanner').hidden = false; setConn('demo'); }
    tick(); setInterval(tick, 1000);
    ping(); setInterval(ping, 5 * 60 * 1000);

    $('loginForm').addEventListener('submit', onLogin);
    $('togglePass').addEventListener('click', () => {
      const i = $('inPass'); const show = i.type === 'password';
      i.type = show ? 'text' : 'password';
      $('togglePass').classList.toggle('is-on', show);
      $('togglePass').setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña');
      i.focus();
    });
    $('inPass').addEventListener('keyup', (e) => { $('capsWarn').hidden = !(e.getModifierState && e.getModifierState('CapsLock')); });
    $('inUser').addEventListener('input', () => ($('loginError').hidden = true));

    $('eventsGrid').addEventListener('click', onEventClick);
    $('btnCancel').addEventListener('click', cancelSession);
    $('stepEvents').addEventListener('pointerdown', bumpIdle);
    $('stepEvents').addEventListener('keydown', bumpIdle);

    $('motivos').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      motivoSel = b.dataset.m;
      document.querySelectorAll('#motivos button').forEach((x) => x.classList.toggle('is-on', x === b));
      if (motivoSel === 'Otro') $('motivoDetalle').focus();
      validatePermiso();
    });
    $('motivoDetalle').addEventListener('input', validatePermiso);
    $('btnPermisoCancel').addEventListener('click', () => ($('permisoBox').hidden = true));
    $('btnPermisoOk').addEventListener('click', () => { pending = { evento: 'SALIDA_PERMISO', motivo: motivoText() }; openConfirm(); });

    $('cfNo').addEventListener('click', () => { closeConfirm(); bumpIdle(); });
    $('cfYes').addEventListener('click', doRegister);
    $('okAccept').addEventListener('click', acceptSuccess);

    document.querySelector('.tabs').addEventListener('click', onTab);
    $('btnBackPersonal').addEventListener('click', () => document.querySelector('.tab[data-tab="personal"]').click());

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (!$('confirmModal').hidden) closeConfirm();
        else if (!$('okModal').hidden) acceptSuccess();
      }
    });

    showLogin();
  }

  document.addEventListener('DOMContentLoaded', init);
})();

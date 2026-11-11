/* =====================================================================
   FINAV · Control de Personal — Front end v1.1
   ===================================================================== */
(function () {
  'use strict';
  window.FINAV_APP_VERSION = '1.1.1';

  const CFG = window.FINAV_CONFIG || {};
  const TZ = CFG.TIMEZONE || 'America/Guayaquil';
  const TZ_OFFSET = CFG.TZ_OFFSET || '-05:00';
  const DEMO = !CFG.API_URL;
  const IDLE_TOTAL = CFG.SEGUNDOS_INACTIVIDAD || 90;
  const OK_TOTAL = CFG.SEGUNDOS_AUTOCIERRE_MENSAJE || 30;
  const $ = (id) => document.getElementById(id);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // ------------------------------------------------------------------
  // Íconos y catálogo de eventos
  // ------------------------------------------------------------------
  const I = {
    in:    '<svg viewBox="0 0 24 24"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="M10 17l5-5-5-5M15 12H3"/></svg>',
    out:   '<svg viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/></svg>',
    food:  '<svg viewBox="0 0 24 24"><path d="M3 2v7a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6a2 2 0 0 0 2 2h3zm0 0v7"/></svg>',
    back:  '<svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></svg>',
    perm:  '<svg viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 7h6M9 11h6M9 15h3"/></svg>',
    ret:   '<svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>',
    lock:  '<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>',
    arrow: '<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    cup:   '<svg viewBox="0 0 24 24"><path d="M4 8h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM17 10h1a3 3 0 0 1 0 6h-1M8 2v3M12 2v3"/></svg>',
    doc:   '<svg viewBox="0 0 24 24"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/></svg>'
  };

  const EVENTS = {
    INGRESO:          { name: 'Ingreso a turno',            short: 'Ingreso',          icon: I.in,   field: 'ingreso' },
    SALIDA:           { name: 'Salida de turno',            short: 'Salida',           icon: I.out,  field: 'salida' },
    SALIDA_ALMUERZO:  { name: 'Salida a almuerzo',          short: 'Salida almuerzo',  icon: I.food, field: 'salidaAlmuerzo' },
    RETORNO_ALMUERZO: { name: 'Retorno de almuerzo',        short: 'Retorno almuerzo', icon: I.back, field: 'retornoAlmuerzo' },
    SALIDA_PERMISO:   { name: 'Salida con permiso',         short: 'Salida permiso',   icon: I.perm },
    RETORNO_PERMISO:  { name: 'Retorno de permiso',         short: 'Retorno permiso',  icon: I.ret }
  };
  const GROUPS = [
    { title: 'Jornada',          icon: I.clock, keys: ['INGRESO', 'SALIDA'] },
    { title: 'Almuerzo',         icon: I.cup,   keys: ['SALIDA_ALMUERZO', 'RETORNO_ALMUERZO'] },
    { title: 'Permiso temporal', icon: I.doc,   keys: ['SALIDA_PERMISO', 'RETORNO_PERMISO'], counter: true }
  ];
  const STATUS = {
    SIN_JORNADA: { label: 'Sin jornada activa', cls: '' },
    EN_TURNO:    { label: 'En turno',           cls: 'pill--ok' },
    EN_ALMUERZO: { label: 'En almuerzo',        cls: 'pill--warn' },
    EN_PERMISO:  { label: 'En permiso',         cls: 'pill--warn' }
  };

  // ------------------------------------------------------------------
  // Estado
  // ------------------------------------------------------------------
  let session = null;
  let pending = null;
  let serverOffset = 0;
  let idleTimer = null, idleLeft = IDLE_TOTAL;
  let okTimer = null;
  let liveTimer = null;
  let motivoSel = '';

  const now = () => new Date(Date.now() + serverOffset);

  // ------------------------------------------------------------------
  // Reloj
  // ------------------------------------------------------------------
  const fTime = new Intl.DateTimeFormat('es-EC', { timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const fDate = new Intl.DateTimeFormat('es-EC', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const fDateS = new Intl.DateTimeFormat('es-EC', { timeZone: TZ, weekday: 'short', day: '2-digit', month: 'short' });
  const RING = 339.3;
  let lastSec = -1;

  function tick() {
    const n = now();
    const [h, m, s] = fTime.format(n).split(':');
    $('bigTime').textContent = h + ':' + m;
    $('bigSec').textContent = s;
    $('tbTime').textContent = h + ':' + m;
    $('tbDate').textContent = fDateS.format(n);
    $('bigDate').textContent = fDate.format(n);
    const hh = Number(h);
    $('greet').textContent = hh < 12 ? 'Buenos días' : hh < 19 ? 'Buenas tardes' : 'Buenas noches';
    const sec = Number(s);
    const ring = $('secRing');
    if (sec < lastSec) {
      ring.classList.add('is-reset');
      ring.style.strokeDashoffset = RING;
      void ring.getBoundingClientRect();
      ring.classList.remove('is-reset');
    }
    ring.style.strokeDashoffset = RING - (RING * (sec + 1)) / 60;
    lastSec = sec;
  }

  // ------------------------------------------------------------------
  // API
  // ------------------------------------------------------------------
  async function api(payload) {
    if (DEMO) return MockApi.call(payload);
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 25000);
    try {
      const res = await fetch(CFG.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        redirect: 'follow',
        signal: ctrl.signal
      });
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch (e) {
        setConn('err');
        console.error('Respuesta no JSON del servidor:', text.slice(0, 500));
        return { ok: false, error: 'El servidor respondió con un formato inesperado. Verifique que la Web App esté implementada con acceso "Cualquier usuario".' };
      }
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
    b.className = 'conn ' + ({ ok: 'is-ok', demo: 'is-demo', err: 'is-err' }[kind] || '');
    $('connText').textContent = { ok: 'En línea', demo: 'Modo demo', err: 'Sin conexión' }[kind] || '';
  }

  async function ping() {
    const r = await api({ action: 'ping' });
    if (r && r.ok && r.serverTime && r.serverTime.epoch) serverOffset = r.serverTime.epoch - Date.now();
    if (r && r.empresa) $('empresaNombre').textContent = r.empresa;
  }

  // ------------------------------------------------------------------
  // Stepper
  // ------------------------------------------------------------------
  function setStep(n) {
    $$('#stepper li').forEach((li) => {
      const s = Number(li.dataset.s);
      li.classList.toggle('is-done', s < n);
      li.classList.toggle('is-current', s === n);
    });
  }

  // ------------------------------------------------------------------
  // VISTA 1 · Login
  // ------------------------------------------------------------------
  function showLogin() {
    stopIdle(); stopLive();
    session = null; pending = null;
    $('vEvents').hidden = true;
    $('vLogin').hidden = false;
    restartAnim($('vLogin'));
    setStep(1);
    $('loginForm').reset();
    $('loginError').hidden = true;
    $('capsWarn').hidden = true;
    $('inPass').type = 'password';
    $('togglePass').classList.remove('is-on');
    if (!$('mod-personal').hidden) setTimeout(() => $('inUser').focus({ preventScroll: true }), 80);
  }

  async function onLogin(e) {
    e.preventDefault();
    const usuario = $('inUser').value.trim().toLowerCase();
    const password = $('inPass').value;
    $('loginError').hidden = true;
    if (!usuario || !password) {
      shake($('vLogin'));
      return showMsg('loginError', 'Ingrese su usuario y contraseña.');
    }
    setLoading('btnLogin', true);
    const slow = setTimeout(() => ($('loginSlow').hidden = false), 5000);
    let r;
    try {
      r = await api({ action: 'login', usuario, password });
    } catch (err) {
      r = { ok: false, error: 'Error inesperado: ' + err.message };
    } finally {
      clearTimeout(slow);
      $('loginSlow').hidden = true;
      setLoading('btnLogin', false);
    }
    if (!r || !r.ok) {
      shake($('vLogin'));
      showMsg('loginError', (r && r.error) || 'No fue posible iniciar sesión.');
      $('inPass').value = '';
      $('inPass').focus();
      return;
    }
    try {
      if (r.serverTime && r.serverTime.epoch) serverOffset = r.serverTime.epoch - Date.now();
      session = { token: r.token, user: r.user || {}, state: normState(r.state) };
      showEvents();
    } catch (err) {
      console.error(err);
      showLogin();
      showMsg('loginError', 'La respuesta del servidor no es válida. Verifique que el backend (Code.gs) esté actualizado e implementado como nueva versión.');
    }
  }

  function normState(st) {
    st = st || {};
    if (!Array.isArray(st.allowed)) st.allowed = ['INGRESO'];
    if (!st.status) st.status = 'SIN_JORNADA';
    st.record = st.record || {};
    return st;
  }

  // ------------------------------------------------------------------
  // VISTA 2 · Eventos
  // ------------------------------------------------------------------
  function showEvents() {
    const { user, state } = session;
    $('vLogin').hidden = true;
    $('vEvents').hidden = false;
    restartAnim($('vEvents'));
    $('eventError').hidden = true;
    setStep(2);

    $('whoAvatar').textContent = initials(user.nombre);
    $('whoName').textContent = user.nombre;
    $('whoMeta').textContent = [user.cargo, user.area].filter(Boolean).join(' · ') || '@' + user.usuario;

    const st = STATUS[state.status] || STATUS.SIN_JORNADA;
    $('statusPill').className = 'pill ' + st.cls;
    $('statusTxt').textContent = st.label;

    renderJourney(state);
    renderGroups(state);
    startLive(state);
    startIdle();
    if (window.innerWidth < 900) window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderJourney(state) {
    const r = state.record || {};
    const active = state.status !== 'SIN_JORNADA';
    $('journeyTitle').textContent = active ? `Jornada del ${r.fecha || 'día'}` : 'Jornada de hoy';

    const nodes = [
      { k: 'Ingreso', f: 'ingreso', icon: I.in },
      { k: 'Salida almuerzo', f: 'salidaAlmuerzo', icon: I.food },
      { k: 'Retorno almuerzo', f: 'retornoAlmuerzo', icon: I.back },
      { k: 'Salida', f: 'salida', icon: I.out }
    ];
    const done = nodes.map((n) => !!r[n.f]);
    const nowIdx = state.status === 'EN_ALMUERZO' ? 1 : -1;
    const nextKey = state.allowed.length === 1 ? EVENTS[state.allowed[0]].field : null;

    $('trackNodes').innerHTML = nodes.map((n, i) => {
      const cls = ['node', done[i] ? 'is-done' : '', i === nowIdx ? 'is-now' : '', nextKey === n.f ? 'is-next' : ''].join(' ');
      return `<div class="${cls}" style="animation-delay:${i * 0.08}s">
        <div class="node__dot">${done[i] && i !== nowIdx ? I.check : n.icon}</div>
        <div class="node__k">${n.k}</div>
        <div class="node__v">${r[n.f] ? r[n.f].slice(0, 5) : '--:--'}</div>
      </div>`;
    }).join('');

    // Progreso de la línea: hasta el último nodo marcado
    let last = -1;
    done.forEach((d, i) => { if (d) last = i; });
    $('trackFill').style.width = '0%';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      $('trackFill').style.width = last <= 0 ? '0%' : (last / 3) * 100 + '%';
    }));

    // Permisos
    const perms = [];
    [1, 2].forEach((n) => {
      const s = r['salidaPermiso' + n];
      if (!s) return;
      const e = r['retornoPermiso' + n];
      const mot = r['motivoPermiso' + n] || '';
      perms.push(`<span class="perm ${e ? '' : 'is-open'}">${I.doc.replace('<svg', '<svg style="width:14px;height:14px"')}
        <span>Permiso ${n}: <b>${s.slice(0, 5)}</b> → <b>${e ? e.slice(0, 5) : 'en curso'}</b></span>${mot ? `<em>· ${esc(mot)}</em>` : ''}</span>`);
    });
    let extra = perms.join('');
    if (!active && state.lastClosed) {
      const lc = state.lastClosed;
      extra = `<div class="lastday">Última jornada: <b>${esc(lc.fecha)}</b> · ${lc.ingreso ? lc.ingreso.slice(0, 5) : '--'} → ${lc.salida ? lc.salida.slice(0, 5) : '--'}${lc.horas ? ` · <b>${lc.horas} h</b>` : ''} · ${esc(lc.estado || '')}</div>`;
    }
    $('perms').innerHTML = extra;
  }

  function reasonFor(key, state) {
    const r = state.record || {};
    const s = state.status;
    if (state.allowed.includes(key)) return null;
    const done = (txt) => ({ done: true, txt });
    switch (key) {
      case 'INGRESO': return r.ingreso ? done('Registrado ' + r.ingreso.slice(0, 5)) : { txt: 'Jornada en curso' };
      case 'SALIDA':
        if (s === 'SIN_JORNADA') return { txt: 'Requiere ingreso' };
        if (s === 'EN_ALMUERZO') return { txt: 'Retorne de almuerzo' };
        if (s === 'EN_PERMISO') return { txt: 'Retorne del permiso' };
        return { txt: 'No disponible' };
      case 'SALIDA_ALMUERZO':
        if (r.salidaAlmuerzo) return done('Registrado ' + r.salidaAlmuerzo.slice(0, 5));
        if (s === 'SIN_JORNADA') return { txt: 'Requiere ingreso' };
        if (s === 'EN_PERMISO') return { txt: 'Retorne del permiso' };
        return { txt: 'No disponible' };
      case 'RETORNO_ALMUERZO':
        if (r.retornoAlmuerzo) return done('Registrado ' + r.retornoAlmuerzo.slice(0, 5));
        if (s === 'SIN_JORNADA') return { txt: 'Requiere ingreso' };
        return { txt: 'Requiere salida a almuerzo' };
      case 'SALIDA_PERMISO':
        if (s === 'SIN_JORNADA') return { txt: 'Requiere ingreso' };
        if (s === 'EN_ALMUERZO') return { txt: 'Retorne de almuerzo' };
        if (s === 'EN_PERMISO') return { txt: 'Permiso en curso' };
        return { txt: 'Límite de permisos' };
      case 'RETORNO_PERMISO':
        if (s === 'SIN_JORNADA') return { txt: 'Requiere ingreso' };
        return { txt: 'Requiere salida con permiso' };
    }
    return { txt: '' };
  }

  function renderGroups(state) {
    const single = state.allowed.length === 1 ? state.allowed[0] : null;
    const used = state.permisosUsados || 0;
    const max = state.maxPermisos || 2;
    $('groups').innerHTML = GROUPS.map((g) => `
      <div class="group">
        <div class="group__h">
          <span class="group__t">${g.icon}${g.title}</span>
          ${g.counter && state.status !== 'SIN_JORNADA' ? `<span class="group__c">${used}/${max} usados</span>` : ''}
        </div>
        <div class="group__b">
          ${g.keys.map((k) => {
            const e = EVENTS[k];
            const why = reasonFor(k, state);
            const ok = !why;
            const cls = ['evt', single === k ? 'is-go' : '', why && why.done ? 'is-done' : ''].join(' ');
            const sub = ok
              ? (single === k ? `Siguiente paso ${I.arrow}` : `Disponible ${I.arrow}`)
              : `${why.done ? I.check : I.lock}${esc(why.txt)}`;
            return `<button type="button" class="${cls}" data-evt="${k}" ${ok ? '' : 'disabled aria-disabled="true"'}>
              <span class="evt__i">${why && why.done ? I.check : e.icon}</span>
              <span class="evt__n">${e.name}</span>
              <span class="evt__s">${sub}</span>
            </button>`;
          }).join('')}
        </div>
      </div>`).join('');
    const go = $('groups').querySelector('.evt.is-go') || $('groups').querySelector('.evt:not(:disabled)');
    if (go && window.matchMedia('(pointer:fine)').matches) setTimeout(() => go.focus({ preventScroll: true }), 200);
  }

  // Contador en vivo
  function toDate(fecha, hora) {
    if (!fecha || !hora) return null;
    const [d, m, y] = String(fecha).split('/');
    const dt = new Date(`${y}-${m}-${d}T${hora}${TZ_OFFSET}`);
    return isNaN(dt) ? null : dt;
  }
  function since(fecha, hora) {
    const d = toDate(fecha, hora);
    if (!d) return 0;
    let ms = now() - d;
    if (ms < 0) ms += 86400000;
    return ms;
  }
  function hms(ms) {
    const t = Math.max(0, Math.floor(ms / 1000));
    return [Math.floor(t / 3600), Math.floor((t % 3600) / 60), t % 60].map((x) => String(x).padStart(2, '0')).join(':');
  }
  function mins(ms) {
    const m = Math.floor(ms / 60000);
    return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
  }
  function startLive(state) {
    stopLive();
    const r = state.record || {};
    const active = state.status !== 'SIN_JORNADA' && r.ingreso;
    $('journeyTimer').hidden = !active;
    const upd = () => {
      if (active) $('timerVal').textContent = hms(since(r.fecha, r.ingreso));
      let txt = '';
      if (state.status === 'EN_TURNO') txt = `Desde las ${r.ingreso.slice(0, 5)}`;
      else if (state.status === 'EN_ALMUERZO') txt = `Salió a las ${r.salidaAlmuerzo.slice(0, 5)} · ${mins(since(r.fecha, r.salidaAlmuerzo))}`;
      else if (state.status === 'EN_PERMISO') {
        const s = r['salidaPermiso' + state.permisoAbierto];
        txt = `Salió a las ${s.slice(0, 5)} · ${mins(since(r.fecha, s))}`;
      } else txt = 'Registre su ingreso para iniciar';
      $('statusSince').textContent = txt;
    };
    upd();
    liveTimer = setInterval(upd, 1000);
  }
  function stopLive() { clearInterval(liveTimer); liveTimer = null; }

  function onEventClick(e) {
    const btn = e.target.closest('.evt');
    if (!btn || btn.disabled) return;
    ripple(btn, e);
    bumpIdle();
    $('eventError').hidden = true;
    const key = btn.dataset.evt;
    if (key === 'SALIDA_PERMISO') openPerm();
    else { pending = { evento: key, motivo: '' }; openConfirm(); }
  }

  // ------------------------------------------------------------------
  // Hoja · Motivo de permiso
  // ------------------------------------------------------------------
  function openPerm() {
    motivoSel = '';
    $('motivoDetalle').value = '';
    $('motivoLbl').textContent = 'Detalle (opcional)';
    $$('#motivos button').forEach((b) => b.classList.remove('is-on'));
    $('permOk').disabled = true;
    openModal('permModal');
  }
  function validatePerm() {
    const det = $('motivoDetalle').value.trim();
    $('permOk').disabled = !motivoSel || (motivoSel === 'Otro' && det.length < 3);
  }
  function motivoText() {
    const det = $('motivoDetalle').value.trim();
    if (motivoSel === 'Otro') return det;
    return det ? `${motivoSel}: ${det}` : motivoSel;
  }

  // ------------------------------------------------------------------
  // Hoja · Confirmación
  // ------------------------------------------------------------------
  function openConfirm() {
    const ev = EVENTS[pending.evento];
    $('cfIcon').innerHTML = ev.icon;
    $('cfEvt').textContent = ev.name;
    $('cfWho').textContent = session.user.nombre;
    $('cfTime').textContent = fTime.format(now());
    $('cfMotivoRow').hidden = !pending.motivo;
    $('cfMotivo').textContent = pending.motivo || '';
    setStep(3);
    openModal('confirmModal', 'cfYes');
  }
  function closeConfirm() {
    closeModal('confirmModal');
    setLoading('cfYes', false);
    if (session) setStep(2);
  }

  async function doRegister() {
    if (!pending || !session) return;
    setLoading('cfYes', true);
    stopIdle();
    let r;
    try {
      r = await api({ action: 'register', token: session.token, evento: pending.evento, motivo: pending.motivo });
    } catch (err) {
      r = { ok: false, error: 'Error inesperado: ' + err.message };
    }
    closeConfirm();
    if (!r.ok) {
      if (r.expired) { toast(r.error); showLogin(); return; }
      if (r.state) { session.state = normState(r.state); showEvents(); } else startIdle();
      showMsg('eventError', r.error || 'No fue posible registrar el evento.');
      return;
    }
    showSuccess(r);
  }

  // ------------------------------------------------------------------
  // Éxito
  // ------------------------------------------------------------------
  function showSuccess(r) {
    stopLive();
    $$('#stepper li').forEach((li) => { li.classList.add('is-done'); li.classList.remove('is-current'); });
    $('okEvent').textContent = r.eventoLabel;
    $('okHora').textContent = r.hora;
    $('okFecha').textContent = r.fecha;
    $('okWho').textContent = r.nombre;
    openModal('okModal', 'okAccept');
    burst();

    const bar = $('okBar');
    bar.style.transition = 'none';
    bar.style.transform = 'scaleX(1)';
    void bar.offsetWidth;
    bar.style.transition = `transform ${OK_TOTAL}s linear`;
    bar.style.transform = 'scaleX(0)';

    let left = OK_TOTAL;
    const upd = () => ($('okAuto').textContent = `Se cerrará automáticamente en ${left} s`);
    upd();
    clearInterval(okTimer);
    okTimer = setInterval(() => { left--; upd(); if (left <= 0) acceptSuccess(); }, 1000);
  }
  function acceptSuccess() {
    clearInterval(okTimer);
    closeModal('okModal');
    showLogin();
  }
  function burst() {
    const box = $('burst');
    const colors = ['#B7842D', '#D9B36C', '#072B59', '#17845A', '#1B4F96'];
    box.innerHTML = Array.from({ length: 22 }, (_, i) => {
      const a = (Math.PI * 2 * i) / 22 + Math.random() * 0.3;
      const d = 90 + Math.random() * 70;
      return `<i style="background:${colors[i % 5]};--x:${Math.cos(a) * d}px;--y:${Math.sin(a) * d}px;--r:${Math.random() * 540}deg;animation-delay:${0.35 + Math.random() * 0.1}s"></i>`;
    }).join('');
  }

  function cancelSession() {
    if (session && !DEMO) api({ action: 'logout', token: session.token });
    showLogin();
  }

  // ------------------------------------------------------------------
  // Inactividad
  // ------------------------------------------------------------------
  function startIdle() {
    stopIdle();
    idleLeft = IDLE_TOTAL;
    renderIdle();
    idleTimer = setInterval(() => {
      idleLeft--;
      renderIdle();
      if (idleLeft <= 0) { toast('Sesión cerrada por inactividad'); cancelSession(); }
    }, 1000);
  }
  function bumpIdle() { if (idleTimer) { idleLeft = IDLE_TOTAL; renderIdle(); } }
  function stopIdle() { clearInterval(idleTimer); idleTimer = null; }
  function renderIdle() {
    $('idleTxt').textContent = idleLeft;
    $('idleRing').style.strokeDashoffset = 94.25 * (1 - idleLeft / IDLE_TOTAL);
    document.querySelector('.idle').classList.toggle('is-low', idleLeft <= 15);
  }

  // ------------------------------------------------------------------
  // Modales
  // ------------------------------------------------------------------
  let lastFocus = null;
  function openModal(id, focusId) {
    lastFocus = document.activeElement;
    $(id).hidden = false;
    document.body.style.overflow = 'hidden';
    const f = focusId ? $(focusId) : $(id).querySelector('button');
    if (f) setTimeout(() => f.focus({ preventScroll: true }), 60);
  }
  function closeModal(id) {
    $(id).hidden = true;
    if ($$('.modal').every((m) => m.hidden)) document.body.style.overflow = '';
    if (lastFocus && document.contains(lastFocus) && !$('vEvents').hidden) lastFocus.focus({ preventScroll: true });
  }

  // ------------------------------------------------------------------
  // Pestañas
  // ------------------------------------------------------------------
  const MAINT = {
    apertura:   ['Apertura de Local', ['Checklist de apertura', 'Responsable y hora de apertura', 'Verificación de equipos', 'Fondo de caja inicial']],
    caja:       ['Cierre de Caja', ['Arqueo por denominación', 'Conciliación de medios de pago', 'Registro de diferencias', 'Reporte de cierre']],
    inventario: ['Inventario', ['Control de insumos', 'Alertas de stock mínimo', 'Registro de mermas', 'Kardex por producto']],
    reportes:   ['Reportes', ['Asistencia por colaborador', 'Horas trabajadas y atrasos', 'Permisos por período', 'Exportación a Excel / PDF']]
  };
  function onTab(e) {
    const t = e.target.closest('.tab');
    if (!t) return;
    $$('.tab').forEach((b) => { b.classList.toggle('is-active', b === t); b.setAttribute('aria-selected', b === t); });
    const key = t.dataset.tab;
    if (key === 'personal') {
      $('mod-maint').hidden = true;
      $('mod-personal').hidden = false;
      if (!session) setTimeout(() => $('inUser').focus({ preventScroll: true }), 80);
    } else {
      if (session) cancelSession();
      const [title, items] = MAINT[key];
      $('maintTitle').textContent = title;
      $('maintList').innerHTML = items.map((x, i) => `<div class="maint__item" style="animation-delay:${0.1 + i * 0.06}s"><span>${i + 1}</span>${x}</div>`).join('');
      $('mod-personal').hidden = true;
      $('mod-maint').hidden = false;
      restartAnim($('mod-maint').firstElementChild);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ------------------------------------------------------------------
  // Utilidades
  // ------------------------------------------------------------------
  function initials(n) { return String(n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase(); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function showMsg(id, msg) { const el = $(id); el.textContent = msg; el.hidden = false; restartAnim(el); }
  function setLoading(id, on) { const b = $(id); b.classList.toggle('is-loading', on); b.disabled = on; }
  function restartAnim(el) { el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; }
  function shake(el) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }
  function ripple(el, e) {
    const r = el.getBoundingClientRect();
    const s = Math.max(r.width, r.height);
    const x = (e.clientX || r.left + r.width / 2) - r.left - s / 2;
    const y = (e.clientY || r.top + r.height / 2) - r.top - s / 2;
    const i = document.createElement('span');
    i.className = 'ripple';
    i.style.cssText = `width:${s}px;height:${s}px;left:${x}px;top:${y}px`;
    el.appendChild(i);
    setTimeout(() => i.remove(), 650);
  }
  let toastT;
  function toast(msg) { const t = $('toast'); t.textContent = msg; t.hidden = false; restartAnim(t); clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 3500); }

  // ------------------------------------------------------------------
  // MODO DEMOSTRACIÓN (sin backend) — replica la lógica del servidor
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
    const fFecha = new Intl.DateTimeFormat('es-EC', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' });
    const LABEL = { INGRESO: 'Ingreso a turno', SALIDA_ALMUERZO: 'Salida a almuerzo', RETORNO_ALMUERZO: 'Retorno de almuerzo',
      SALIDA_PERMISO: 'Salida con permiso temporal', RETORNO_PERMISO: 'Retorno de permiso temporal', SALIDA: 'Salida de turno' };

    function state(u) {
      const mine = load().filter((r) => r.usuario === u);
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
      await new Promise((r) => setTimeout(r, 450));
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
        const n = new Date();
        const hora = fTime.format(n);
        const db = load();
        if (p.evento === 'INGRESO') {
          db.push({ id: 'REG-' + n.getTime(), usuario, fecha: fFecha.format(n), ingreso: hora, estado: 'EN TURNO' });
        } else {
          const rec = db.find((r) => r.id === st.recordId);
          const map = { SALIDA_ALMUERZO: 'salidaAlmuerzo', RETORNO_ALMUERZO: 'retornoAlmuerzo', SALIDA: 'salida' };
          if (p.evento === 'SALIDA_PERMISO') {
            const k = st.permisosUsados === 0 ? 1 : 2;
            rec['salidaPermiso' + k] = hora; rec['motivoPermiso' + k] = p.motivo;
          } else if (p.evento === 'RETORNO_PERMISO') {
            rec['retornoPermiso' + st.permisoAbierto] = hora;
          } else rec[map[p.evento]] = hora;
          if (p.evento === 'SALIDA') {
            rec.estado = 'FINALIZADA';
            const a = toDate(rec.fecha, rec.ingreso), b = toDate(rec.fecha, rec.salida);
            if (a && b) rec.horas = Math.max(0, Math.round(((b - a) / 3600000) * 100) / 100);
          } else rec.estado = 'EN TURNO';
        }
        save(db);
        delete tokens[p.token];
        return { ok: true, evento: p.evento, eventoLabel: LABEL[p.evento], hora, fecha: fFecha.format(n), nombre: USERS[usuario].nombre };
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

    // Login
    $('loginForm').addEventListener('submit', onLogin);
    $('togglePass').addEventListener('click', () => {
      const i = $('inPass'); const show = i.type === 'password';
      i.type = show ? 'text' : 'password';
      $('togglePass').classList.toggle('is-on', show);
      $('togglePass').setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña');
      i.focus();
    });
    $('inPass').addEventListener('keyup', (e) => { $('capsWarn').hidden = !(e.getModifierState && e.getModifierState('CapsLock')); });
    ['inUser', 'inPass'].forEach((id) => $(id).addEventListener('input', () => ($('loginError').hidden = true)));
    $('btnLogin').addEventListener('pointerdown', (e) => ripple($('btnLogin'), e));

    // Eventos
    $('groups').addEventListener('click', onEventClick);
    $('btnCancel').addEventListener('click', cancelSession);
    ['pointerdown', 'keydown', 'scroll'].forEach((ev) => document.addEventListener(ev, bumpIdle, { passive: true }));

    // Permiso
    $('motivos').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      motivoSel = b.dataset.m;
      $$('#motivos button').forEach((x) => x.classList.toggle('is-on', x === b));
      $('motivoLbl').textContent = motivoSel === 'Otro' ? 'Describa el motivo (obligatorio)' : 'Detalle (opcional)';
      if (motivoSel === 'Otro') $('motivoDetalle').focus();
      validatePerm();
    });
    $('motivoDetalle').addEventListener('input', validatePerm);
    $('permCancel').addEventListener('click', () => closeModal('permModal'));
    $('permOk').addEventListener('click', () => {
      pending = { evento: 'SALIDA_PERMISO', motivo: motivoText() };
      closeModal('permModal');
      openConfirm();
    });

    // Confirmación / éxito
    $('cfNo').addEventListener('click', () => { closeConfirm(); bumpIdle(); });
    $('cfYes').addEventListener('click', doRegister);
    $('okAccept').addEventListener('click', acceptSuccess);

    // Cerrar hojas tocando el fondo
    $$('.modal').forEach((m) => m.addEventListener('click', (e) => {
      if (e.target !== m) return;
      if (m.id === 'permModal') closeModal('permModal');
      else if (m.id === 'confirmModal' && !$('cfYes').classList.contains('is-loading')) closeConfirm();
    }));

    // Pestañas
    $$('.tabs').forEach((t) => t.addEventListener('click', onTab));
    $('btnBackPersonal').addEventListener('click', () => document.querySelector('.tab[data-tab="personal"]').click());

    // Pantalla completa (modo kiosco)
    $('btnFull').addEventListener('click', () => {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(() => {});
      else document.exitFullscreen && document.exitFullscreen();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (!$('okModal').hidden) acceptSuccess();
      else if (!$('confirmModal').hidden) closeConfirm();
      else if (!$('permModal').hidden) closeModal('permModal');
    });

    showLogin();
  }

  document.addEventListener('DOMContentLoaded', init);
})();

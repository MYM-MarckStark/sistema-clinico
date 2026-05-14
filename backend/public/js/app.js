// ── INIT ─────────────────────────────────────────────
let currentPage = 'dashboard';
let reporteData = [];
let userRole = null;
let userId = null;
let userDoctorId = null;

document.addEventListener('DOMContentLoaded', async () => {
  // Verificar sesión
  const res = await fetch('/api/me');
  if (!res.ok) { window.location.href = '/'; return; }
  const user = await res.json();
  
  userRole = user.rol;
  userId = user.id_usuario;
  userDoctorId = user.id_doctor;
  
  document.getElementById('sidebarUser').textContent = user.username;
  const roles = { 1: 'Administrador', 2: 'Doctor', 3: 'Recepcionista' };
  document.getElementById('sidebarRole').textContent = roles[user.rol] || 'Usuario';

  // Ocultar menús según rol
  configurarMenuPorRol(user.rol);

  // Fecha en topbar
  const now = new Date();
  document.getElementById('topbarDate').textContent =
    now.toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  // Fecha por defecto en diagnóstico
  document.getElementById('diagFecha').value = now.toISOString().split('T')[0];

  // Fechas por defecto en reportes
  const primerDia = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  document.getElementById('reporteDesde').value = primerDia;
  document.getElementById('reporteHasta').value = now.toISOString().split('T')[0];

  // Cerrar modales al click fuera
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.remove('open');
    });
  });

  // Página inicial según rol
  if (user.rol === 2) navigate('pacientes'); // Doctor
  else navigate('dashboard'); // Admin/Recepcionista
});

function configurarMenuPorRol(rol) {
  const menuItems = {
    1: ['dashboard', 'pacientes', 'citas', 'expedientes', 'diagnostico', 'tickets', 'inasistencias', 'reportes'], // Admin
    2: ['pacientes', 'expedientes', 'diagnostico'], // Doctor
    3: ['dashboard', 'pacientes', 'citas', 'expedientes', 'tickets'] // Recepcionista
  };
  
  const permitidos = menuItems[rol] || [];
  document.querySelectorAll('.nav-item').forEach(item => {
    const page = item.getAttribute('data-page');
    if (!permitidos.includes(page)) {
      item.style.display = 'none';
    }
  });
}

// ── NAVEGACIÓN ────────────────────────────────────────
function navigate(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  document.getElementById(`page-${page}`).classList.add('active');
  document.querySelector(`[data-page="${page}"]`).classList.add('active');

  const titles = {
    dashboard: 'Dashboard', pacientes: 'Pacientes', citas: 'Citas',
    expedientes: 'Expedientes', diagnostico: 'Atención Médica',
    tickets: 'Tickets / Comprobantes', inasistencias: 'Inasistencias', reportes: 'Reportes'
  };
  document.getElementById('pageTitle').textContent = titles[page] || page;
  currentPage = page;

  const loaders = {
    dashboard: cargarDashboard,
    pacientes: cargarPacientes,
    citas: cargarCitas,
    expedientes: cargarExpedientes,
    diagnostico: cargarSelectsDiag,
    tickets: cargarTickets,
    inasistencias: cargarInasistencias,
    reportes: () => {}
  };
  if (loaders[page]) loaders[page]();
}

async function logout() {
  await fetch('/api/logout', { method: 'POST' });
  window.location.href = '/';
}

// ── MODALES ───────────────────────────────────────────
function openModal(id) {
  document.getElementById(id).classList.add('open');
  if (id === 'modalCita') cargarSelectsCita();
  if (id === 'modalTicket') cargarSelectsTicket();
}
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

// ── HELPERS ───────────────────────────────────────────
function showAlert(id, msg, type = 'error') {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.className = `alert alert-${type} show`;
  setTimeout(() => el.classList.remove('show'), 4000);
}

function badgeEstado(estado) {
  const map = {
    'Programada': 'badge-blue',
    'Completada': 'badge-green',
    'Cancelada': 'badge-red',
    'No asistió': 'badge-yellow'
  };
  return `<span class="badge ${map[estado] || 'badge-gray'}">${estado}</span>`;
}

function fmt(fecha) {
  if (!fecha) return '—';
  return new Date(fecha).toLocaleDateString('es-MX');
}

function fmtHora(hora) {
  if (!hora) return '—';
  // Si viene como datetime ISO, extraer solo HH:MM
  if (hora.includes('T')) {
    const h = new Date(hora);
    return h.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });
  }
  // Si ya viene como "HH:MM:SS" o "HH:MM"
  return hora.substring(0, 5);
}

function slugEstado(estado) {
  const map = {
    'Programada': 'programada',
    'Completada': 'completada',
    'Cancelada': 'cancelada',
    'No asistió': 'inasistencia',
    'En revisión': 'revision'
  };
  return map[estado] || 'programada';
}

async function cambiarEstadoCita(id, select) {
  const nuevoEstado = select.value;
  const endpoints = {
    'Cancelada':     `/api/citas/${id}/cancelar`,
    'No asistió':    `/api/citas/${id}/inasistencia`,
    'Completada':    `/api/citas/${id}/completar`,
    'Programada':    `/api/citas/${id}/reprogramar`,
    'En revisión':   `/api/citas/${id}/revision`,
  };
  const url = endpoints[nuevoEstado];
  if (!url) return;
  const res = await fetch(url, { method: 'PUT' });
  if (res.ok) {
    select.className = `estado-select estado-${slugEstado(nuevoEstado)}`;
    cargarDashboard(); // refresca stats
  } else {
    const d = await res.json();
    alert(d.error || 'Error al cambiar estado');
  }
}

// ── DASHBOARD ─────────────────────────────────────────
async function cargarDashboard() {
  try {
    const [stats, citas] = await Promise.all([
      fetch('/api/stats').then(r => r.json()),
      fetch('/api/citas').then(r => r.json())
    ]);
    document.getElementById('stat-citas').textContent = stats.citas_hoy ?? '—';
    document.getElementById('stat-pacientes').textContent = stats.total_pacientes ?? '—';
    document.getElementById('stat-completadas').textContent = stats.completadas_hoy ?? '—';
    document.getElementById('stat-inasistencias').textContent = stats.inasistencias_hoy ?? '—';

    const hoy = new Date().toISOString().split('T')[0];
    const citasHoy = citas.filter(c => c.fecha && c.fecha.startsWith(hoy));
    const tbody = document.getElementById('dashCitasBody');
    if (citasHoy.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="icon">📅</div><p>No hay citas para hoy</p></div></td></tr>`;
    } else {
      tbody.innerHTML = citasHoy.map(c => `
        <tr>
          <td>${c.paciente}</td>
          <td>${c.doctor}</td>
          <td>${fmtHora(c.hora)}</td>
          <td>${c.motivo || '—'}</td>
          <td>
            <select class="estado-select estado-${slugEstado(c.estado)}" onchange="cambiarEstadoCita(${c.id_cita}, this)">
              <option value="Programada"   ${c.estado==='Programada'   ? 'selected':''}>Programada</option>
              <option value="En revisión"  ${c.estado==='En revisión'  ? 'selected':''}>En revisión</option>
              <option value="Completada"   ${c.estado==='Completada'   ? 'selected':''}>Completada</option>
              <option value="Cancelada"    ${c.estado==='Cancelada'    ? 'selected':''}>Cancelada</option>
              <option value="No asistió"   ${c.estado==='No asistió'   ? 'selected':''}>No asistió</option>
            </select>
          </td>
        </tr>`).join('');
    }

    // Panel consultorios
    await cargarConsultorios();
  } catch (e) { console.error(e); }
}

async function cargarConsultorios() {
  const res = await fetch('/api/consultorios');
  const data = await res.json();
  const grid = document.getElementById('consultoriosGrid');
  const ahora = new Date();

  if (!data.length) {
    grid.innerHTML = `<p class="text-muted">No hay consultorios registrados</p>`;
    return;
  }

  grid.innerHTML = data.map((c, i) => {
    let clase = 'disponible';
    let estadoLabel = 'Disponible';

    if (c.hora && c.estado) {
      if (c.estado === 'En revisión') {
        clase = 'revision';
        estadoLabel = 'En revisión';
      } else if (c.estado === 'Completada') {
        clase = 'disponible';
        estadoLabel = 'Disponible';
      } else if (c.estado === 'Cancelada') {
        clase = 'disponible';
        estadoLabel = 'Disponible';
      } else {
        const horaStr = fmtHora(c.hora);
        const [hh, mm] = horaStr.split(':').map(Number);
        const horaCita = new Date();
        horaCita.setHours(hh, mm, 0, 0);
        const diff = (horaCita - ahora) / 60000; // minutos

        if (diff <= 0 && diff > -60) {
          clase = 'revision';
          estadoLabel = 'En revisión';
        } else if (diff > 0 && diff <= 30) {
          clase = 'proxima';
          estadoLabel = 'Próxima cita';
        } else if (diff > 30) {
          clase = 'disponible';
          estadoLabel = 'Disponible';
        }
      }
    }

    return `
      <div class="consultorio-card ${clase}">
        <div>
          <div class="cons-titulo">Consultorio ${i + 1}</div>
          <div class="cons-doctor">${c.doctor.toUpperCase()}</div>
          <div class="cons-hora">${c.hora ? 'Horario: ' + fmtHora(c.hora) + ' hrs.' : 'Sin cita asignada'}</div>
          <div class="cons-tipo">${c.especialidad || '—'}</div>
          ${c.motivo ? `<div class="cons-tipo" style="margin-top:4px;opacity:0.9">${c.motivo}</div>` : ''}
        </div>
        <div style="font-size:11px;opacity:0.7;margin-top:8px;text-transform:uppercase;letter-spacing:0.05em">${estadoLabel}</div>
      </div>`;
  }).join('');
}

// ── PACIENTES ─────────────────────────────────────────
async function cargarPacientes() {
  const res = await fetch('/api/pacientes');
  const data = await res.json();
  renderPacientes(data);
}

async function buscarPacientes() {
  const q = document.getElementById('searchPaciente').value.trim();
  if (!q) return cargarPacientes();
  const res = await fetch(`/api/pacientes/buscar?q=${encodeURIComponent(q)}`);
  const data = await res.json();
  renderPacientes(data);
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('searchPaciente')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') buscarPacientes();
  });
  document.getElementById('searchExpediente')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') buscarExpedientes();
  });
});

function renderPacientes(data) {
  const tbody = document.getElementById('pacientesBody');
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state"><div class="icon">👥</div><p>No se encontraron pacientes</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = data.map(p => `
    <tr>
      <td><strong>${p.nombre} ${p.apellido}</strong></td>
      <td>${p.telefono || '—'}</td>
      <td>${p.email || '—'}</td>
      <td>
        <button class="btn btn-outline btn-sm" onclick="verExpediente(${p.id_paciente})">📁 Expediente</button>
      </td>
    </tr>`).join('');
}

async function guardarPaciente() {
  const body = {
    nombre: document.getElementById('pNombre').value,
    apellido: document.getElementById('pApellido').value,
    fecha_nacimiento: document.getElementById('pFechaNac').value,
    telefono: document.getElementById('pTelefono').value,
    email: document.getElementById('pEmail').value,
    direccion: document.getElementById('pDireccion').value,
  };
  if (!body.nombre || !body.apellido || !body.telefono) {
    return showAlert('alertModalPaciente', 'Nombre, apellido y teléfono son obligatorios');
  }
  const res = await fetch('/api/pacientes', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) return showAlert('alertModalPaciente', data.error);
  closeModal('modalPaciente');
  document.getElementById('formPaciente').reset();
  cargarPacientes();
  showAlert('alertPacientes', 'Paciente registrado correctamente', 'success');
}

// ── CITAS ─────────────────────────────────────────────
async function cargarCitas() {
  const res = await fetch('/api/citas');
  const data = await res.json();
  const tbody = document.getElementById('citasBody');
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="icon">📅</div><p>No hay citas registradas</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = data.map(c => `
    <tr>
      <td>${c.paciente}</td>
      <td>${c.doctor}</td>
      <td>${fmt(c.fecha)}</td>
      <td>${fmtHora(c.hora)}</td>
      <td>${c.motivo || '—'}</td>
      <td>${badgeEstado(c.estado)}</td>
      <td>
        ${c.estado === 'Programada' ? `
          <button class="btn btn-outline btn-sm" onclick="editarCita(${c.id_cita})" style="margin-right:4px">✏️ Editar</button>
          <button class="btn btn-danger btn-sm" onclick="cancelarCita(${c.id_cita})">Cancelar</button>
        ` : '—'}
      </td>
    </tr>`).join('');
}

async function cargarSelectsCita() {
  const [pacientes, doctores] = await Promise.all([
    fetch('/api/pacientes').then(r => r.json()),
    fetch('/api/doctores').then(r => r.json())
  ]);
  const selP = document.getElementById('citaPaciente');
  const selD = document.getElementById('citaDoctor');
  selP.innerHTML = '<option value="">Seleccionar paciente...</option>' +
    pacientes.map(p => `<option value="${p.id_paciente}">${p.nombre} ${p.apellido}</option>`).join('');
  selD.innerHTML = '<option value="">Seleccionar doctor...</option>' +
    doctores.map(d => `<option value="${d.id_doctor}">${d.username} — ${d.especialidad}</option>`).join('');
  // Fecha mínima hoy
  document.getElementById('citaFecha').min = new Date().toISOString().split('T')[0];
}

async function guardarCita() {
  const body = {
    id_paciente: document.getElementById('citaPaciente').value,
    id_doctor: document.getElementById('citaDoctor').value,
    fecha: document.getElementById('citaFecha').value,
    hora: document.getElementById('citaHora').value,
    motivo: document.getElementById('citaMotivo').value,
  };
  if (!body.id_paciente || !body.id_doctor || !body.fecha || !body.hora) {
    return showAlert('alertModalCita', 'Todos los campos son obligatorios');
  }
  
  const url = citaEditandoId ? `/api/citas/${citaEditandoId}` : '/api/citas';
  const method = citaEditandoId ? 'PUT' : 'POST';
  
  const res = await fetch(url, {
    method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) return showAlert('alertModalCita', data.error);
  
  closeModal('modalCita');
  document.getElementById('formCita').reset();
  const mensaje = citaEditandoId ? 'Cita actualizada correctamente' : 'Cita agendada correctamente';
  citaEditandoId = null;
  document.querySelector('#modalCita .modal-header h3').textContent = 'Agendar Cita';
  cargarCitas();
  showAlert('alertCitas', mensaje, 'success');
}

async function cancelarCita(id) {
  if (!confirm('¿Cancelar esta cita?')) return;
  await fetch(`/api/citas/${id}/cancelar`, { method: 'PUT' });
  cargarCitas();
}

let citaEditandoId = null;

async function editarCita(id) {
  citaEditandoId = id;
  const cita = await fetch(`/api/citas/${id}`).then(r => r.json());
  
  // Cargar selects
  await cargarSelectsCita();
  
  // Llenar formulario
  document.getElementById('citaPaciente').value = cita.id_paciente;
  document.getElementById('citaDoctor').value = cita.id_doctor;
  document.getElementById('citaFecha').value = cita.fecha.split('T')[0];
  document.getElementById('citaHora').value = fmtHora(cita.hora);
  document.getElementById('citaMotivo').value = cita.motivo || '';
  
  // Cambiar título del modal
  document.querySelector('#modalCita .modal-header h3').textContent = 'Editar Cita';
  
  openModal('modalCita');
}

// ── EXPEDIENTES ───────────────────────────────────────
async function cargarExpedientes() {
  const res = await fetch('/api/expedientes');
  const data = await res.json();
  const tbody = document.getElementById('expedientesBody');
  
  document.getElementById('expedienteDetalle').classList.add('hidden');
  
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state"><div class="icon">📁</div><p>No hay expedientes creados</p></div></td></tr>`;
    return;
  }
  
  tbody.innerHTML = data.map(p => `
    <tr>
      <td><strong>${p.nombre} ${p.apellido}</strong><br><small class="text-muted">${p.total_diagnosticos} diagnóstico(s)</small></td>
      <td>${p.telefono || '—'}</td>
      <td>${p.email || '—'}</td>
      <td><button class="btn btn-primary btn-sm" onclick="verExpediente(${p.id_paciente})">Ver expediente</button></td>
    </tr>`).join('');
}

async function buscarExpedientes() {
  const q = document.getElementById('searchExpediente').value.trim();
  if (!q) return cargarExpedientes();
  const res = await fetch(`/api/pacientes/buscar?q=${encodeURIComponent(q)}`);
  const data = await res.json();
  const tbody = document.getElementById('expedientesBody');
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state"><div class="icon">🔍</div><p>Sin resultados</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = data.map(p => `
    <tr>
      <td><strong>${p.nombre} ${p.apellido}</strong></td>
      <td>${p.telefono || '—'}</td>
      <td>${p.email || '—'}</td>
      <td><button class="btn btn-primary btn-sm" onclick="verExpediente(${p.id_paciente})">Ver expediente</button></td>
    </tr>`).join('');
}

async function verExpediente(id) {
  const [paciente, historial] = await Promise.all([
    fetch(`/api/pacientes/${id}`).then(r => r.json()),
    fetch(`/api/historial/${id}`).then(r => r.json())
  ]);

  document.getElementById('expedienteNombre').textContent = `${paciente.nombre} ${paciente.apellido}`;
  document.getElementById('expedienteDatos').innerHTML = `
    <div class="form-group"><label>Fecha nacimiento</label><p>${fmt(paciente.fecha_nacimiento)}</p></div>
    <div class="form-group"><label>Teléfono</label><p>${paciente.telefono || '—'}</p></div>
    <div class="form-group"><label>Email</label><p>${paciente.email || '—'}</p></div>
    <div class="form-group full"><label>Dirección</label><p>${paciente.direccion || '—'}</p></div>
  `;

  const histDiv = document.getElementById('expedienteHistorial');
  if (!historial.length) {
    histDiv.innerHTML = `<div class="empty-state"><div class="icon">📋</div><p>Sin historial médico</p></div>`;
  } else {
    histDiv.innerHTML = historial.map(h => `
      <div class="historial-item">
        <h4>${fmt(h.fecha)} — ${h.doctor} (${h.especialidad})</h4>
        <div class="historial-meta">Diagnóstico #${h.id_diagnostico}</div>
        <div class="historial-field">
          <p style="white-space: pre-line;">${h.descripcion || '—'}</p>
        </div>
      </div>`).join('');
  }

  document.getElementById('expedienteDetalle').classList.remove('hidden');
  document.getElementById('expedienteDetalle').scrollIntoView({ behavior: 'smooth' });
}

function cerrarExpediente() {
  document.getElementById('expedienteDetalle').classList.add('hidden');
}

// ── DIAGNÓSTICO ───────────────────────────────────────
async function cargarSelectsDiag() {
  const [pacientes, doctores] = await Promise.all([
    fetch('/api/pacientes').then(r => r.json()),
    fetch('/api/doctores').then(r => r.json())
  ]);
  document.getElementById('diagPaciente').innerHTML =
    '<option value="">Seleccionar paciente...</option>' +
    pacientes.map(p => `<option value="${p.id_paciente}">${p.nombre} ${p.apellido}</option>`).join('');
  document.getElementById('diagDoctor').innerHTML =
    '<option value="">Seleccionar doctor...</option>' +
    doctores.map(d => `<option value="${d.id_doctor}">${d.username} — ${d.especialidad}</option>`).join('');
}

async function cargarCitasPaciente() {
  const id = document.getElementById('diagPaciente').value;
  if (!id) return;
  const res = await fetch('/api/citas');
  const citas = await res.json();
  const filtradas = citas.filter(c => c.id_paciente == id && c.estado === 'Programada');
  document.getElementById('diagCita').innerHTML =
    '<option value="">Sin cita asociada</option>' +
    filtradas.map(c => `<option value="${c.id_cita}">${fmt(c.fecha)} ${c.hora} — ${c.motivo}</option>`).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('formDiagnostico')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {
      id_paciente: document.getElementById('diagPaciente').value,
      id_doctor: document.getElementById('diagDoctor').value,
      id_cita: document.getElementById('diagCita').value || null,
      motivo: document.getElementById('diagMotivo').value,
      exploracion: document.getElementById('diagExploracion').value,
      diagnostico: document.getElementById('diagDiagnostico').value,
      tratamiento: document.getElementById('diagTratamiento').value,
      fecha: document.getElementById('diagFecha').value,
    };
    const res = await fetch('/api/diagnostico', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) return showAlert('alertDiag', data.error);
    showAlert('alertDiag', 'Diagnóstico guardado correctamente. El expediente ha sido creado/actualizado.', 'success');
    document.getElementById('formDiagnostico').reset();
    document.getElementById('diagFecha').value = new Date().toISOString().split('T')[0];
  });
});

// ── TICKETS ───────────────────────────────────────────
async function cargarTickets() {
  const res = await fetch('/api/tickets');
  const data = await res.json();
  const tbody = document.getElementById('ticketsBody');
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="icon">🧾</div><p>No hay tickets generados</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = data.map(t => `
    <tr>
      <td>#${t.id_factura}</td>
      <td>${t.paciente}</td>
      <td>${t.servicio || '—'}</td>
      <td>$${Number(t.monto).toFixed(2)}</td>
      <td>${t.metodo_pago}</td>
      <td>${fmt(t.fecha)}</td>
      <td>
        <button class="btn btn-outline btn-sm" onclick="imprimirTicket(${t.id_factura})">🖨️ Imprimir</button>
      </td>
    </tr>`).join('');
}

async function cargarSelectsTicket() {
  const res = await fetch('/api/citas');
  const citas = await res.json();
  
  // Obtener tickets existentes
  const ticketsRes = await fetch('/api/tickets');
  const tickets = await ticketsRes.json();
  const citasConTicket = tickets.map(t => t.id_cita);
  
  // Filtrar citas completadas o programadas que NO tengan ticket
  const citasSinTicket = citas.filter(c => 
    (c.estado === 'Completada' || c.estado === 'Programada') && 
    !citasConTicket.includes(c.id_cita)
  );
  
  document.getElementById('ticketCita').innerHTML =
    '<option value="">Seleccionar cita...</option>' +
    citasSinTicket.map(c => `<option value="${c.id_cita}">${c.paciente} — ${fmt(c.fecha)} ${fmtHora(c.hora)}</option>`).join('');
  
  // Autocompletar al seleccionar cita
  document.getElementById('ticketCita').addEventListener('change', async (e) => {
    const citaId = e.target.value;
    if (!citaId) return;
    const info = await fetch(`/api/citas/${citaId}/info-ticket`).then(r => r.json());
    if (info.monto) document.getElementById('ticketMonto').value = info.monto;
  });
}

async function guardarTicket() {
  const body = {
    id_cita: document.getElementById('ticketCita').value,
    monto: document.getElementById('ticketMonto').value,
    metodo_pago: document.getElementById('ticketMetodo').value,
  };
  if (!body.id_cita || !body.monto || !body.metodo_pago) {
    return showAlert('alertModalTicket', 'Todos los campos son obligatorios');
  }
  const res = await fetch('/api/tickets', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) return showAlert('alertModalTicket', data.error);
  closeModal('modalTicket');
  document.getElementById('formTicket').reset();
  cargarTickets();
  showAlert('alertTickets', 'Ticket generado correctamente', 'success');
}

// ── INASISTENCIAS ─────────────────────────────────────
async function cargarInasistencias() {
  const res = await fetch('/api/citas');
  const citas = await res.json();
  const hoy = new Date().toISOString().split('T')[0];
  const pasadas = citas.filter(c => c.fecha && c.fecha < hoy && c.estado === 'Programada');
  const tbody = document.getElementById('inasistenciasBody');
  if (!pasadas.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="icon">✅</div><p>No hay citas pendientes de marcar</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = pasadas.map(c => `
    <tr>
      <td>${c.paciente}</td>
      <td>${c.doctor}</td>
      <td>${fmt(c.fecha)}</td>
      <td>${c.hora}</td>
      <td>${badgeEstado(c.estado)}</td>
      <td>
        <button class="btn btn-danger btn-sm" onclick="marcarInasistencia(${c.id_cita})">No asistió</button>
      </td>
    </tr>`).join('');
}

async function marcarInasistencia(id) {
  await fetch(`/api/citas/${id}/inasistencia`, { method: 'PUT' });
  showAlert('alertInasistencias', 'Inasistencia registrada', 'success');
  cargarInasistencias();
}

// ── REPORTES ──────────────────────────────────────────
async function generarReporte() {
  const tipo = document.getElementById('reporteTipo').value;
  const periodo = document.getElementById('reportePeriodo').value;
  const desde = document.getElementById('reporteDesde').value;
  const hasta = document.getElementById('reporteHasta').value;

  let url = `/api/reportes?tipo=${tipo}`;
  if (periodo) {
    url += `&periodo=${periodo}`;
  } else {
    if (!desde || !hasta) return showAlert('alertReportes', 'Selecciona un rango de fechas o un período');
    url += `&desde=${desde}&hasta=${hasta}`;
  }

  const res = await fetch(url);
  const data = await res.json();
  reporteData = data;

  const head = document.getElementById('reporteHead');
  const tbody = document.getElementById('reporteBody');

  if (!data.length) {
    head.innerHTML = '';
    tbody.innerHTML = `<tr><td colspan="2"><div class="empty-state"><div class="icon">📊</div><p>Sin datos para el período seleccionado</p></div></td></tr>`;
    return;
  }

  const cols = Object.keys(data[0]);
  head.innerHTML = cols.map(c => `<th>${c}</th>`).join('');
  tbody.innerHTML = data.map(row =>
    `<tr>${cols.map(c => `<td>${row[c] ?? '—'}</td>`).join('')}</tr>`
  ).join('');
}

function exportarReporte() {
  if (!reporteData.length) return alert('Genera un reporte primero');
  const cols = Object.keys(reporteData[0]);
  const csv = [cols.join(','), ...reporteData.map(r => cols.map(c => `"${r[c] ?? ''}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `reporte_${Date.now()}.csv`; a.click();
  URL.revokeObjectURL(url);
}

function toggleFechasReporte() {
  const periodo = document.getElementById('reportePeriodo').value;
  const desdeGroup = document.getElementById('reporteDesdeGroup');
  const hastaGroup = document.getElementById('reporteHastaGroup');
  if (periodo) {
    desdeGroup.style.display = 'none';
    hastaGroup.style.display = 'none';
  } else {
    desdeGroup.style.display = 'flex';
    hastaGroup.style.display = 'flex';
  }
}

// ── IMPRIMIR TICKET ───────────────────────────────────
async function imprimirTicket(id) {
  const ticket = await fetch(`/api/tickets/${id}`).then(r => r.json());
  
  const ventana = window.open('', '_blank', 'width=800,height=600');
  ventana.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Ticket #${ticket.id_factura}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Arial', sans-serif;
          padding: 40px;
          background: #f5f5f5;
        }
        .ticket {
          max-width: 600px;
          margin: 0 auto;
          background: white;
          padding: 40px;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
          text-align: center;
          border-bottom: 3px solid #0d7377;
          padding-bottom: 20px;
          margin-bottom: 30px;
        }
        .header h1 {
          color: #0d7377;
          font-size: 28px;
          margin-bottom: 5px;
        }
        .header p {
          color: #6b7280;
          font-size: 14px;
        }
        .ticket-number {
          text-align: center;
          font-size: 18px;
          font-weight: bold;
          color: #1a1a1a;
          margin-bottom: 30px;
          padding: 10px;
          background: #f0f4f5;
          border-radius: 5px;
        }
        .section {
          margin-bottom: 25px;
        }
        .section-title {
          font-size: 12px;
          font-weight: bold;
          text-transform: uppercase;
          color: #6b7280;
          margin-bottom: 8px;
          letter-spacing: 0.5px;
        }
        .section-content {
          font-size: 16px;
          color: #1a1a1a;
          padding: 8px 0;
        }
        .row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 15px;
        }
        .row .label {
          font-weight: 600;
          color: #4b5563;
        }
        .row .value {
          color: #1a1a1a;
        }
        .total {
          border-top: 2px solid #e5e7eb;
          padding-top: 20px;
          margin-top: 30px;
        }
        .total-row {
          display: flex;
          justify-content: space-between;
          font-size: 24px;
          font-weight: bold;
          color: #0d7377;
        }
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          text-align: center;
          color: #6b7280;
          font-size: 12px;
        }
        @media print {
          body { background: white; padding: 0; }
          .ticket { box-shadow: none; }
        }
      </style>
    </head>
    <body>
      <div class="ticket">
        <div class="header">
          <h1>🏥 ClinicaSys</h1>
          <p>Sistema Clínico Digital</p>
        </div>
        
        <div class="ticket-number">
          TICKET #${ticket.id_factura}
        </div>
        
        <div class="section">
          <div class="section-title">Paciente</div>
          <div class="section-content">${ticket.paciente}</div>
          ${ticket.telefono ? `<div class="section-content" style="font-size:14px;color:#6b7280;">Tel: ${ticket.telefono}</div>` : ''}
        </div>
        
        <div class="section">
          <div class="section-title">Atención Médica</div>
          <div class="row">
            <span class="label">Doctor:</span>
            <span class="value">${ticket.doctor}</span>
          </div>
          <div class="row">
            <span class="label">Especialidad:</span>
            <span class="value">${ticket.especialidad}</span>
          </div>
          <div class="row">
            <span class="label">Fecha de cita:</span>
            <span class="value">${new Date(ticket.fecha_cita).toLocaleDateString('es-MX')}</span>
          </div>
          <div class="row">
            <span class="label">Motivo:</span>
            <span class="value">${ticket.motivo || '—'}</span>
          </div>
        </div>
        
        <div class="section">
          <div class="section-title">Pago</div>
          <div class="row">
            <span class="label">Método de pago:</span>
            <span class="value">${ticket.metodo_pago}</span>
          </div>
          <div class="row">
            <span class="label">Fecha de emisión:</span>
            <span class="value">${new Date(ticket.fecha).toLocaleDateString('es-MX')}</span>
          </div>
        </div>
        
        <div class="total">
          <div class="total-row">
            <span>TOTAL:</span>
            <span>$${Number(ticket.monto).toFixed(2)} MXN</span>
          </div>
        </div>
        
        <div class="footer">
          <p>Gracias por su preferencia</p>
          <p>Este documento es un comprobante de pago válido</p>
        </div>
      </div>
      
      <script>
        window.onload = () => {
          setTimeout(() => window.print(), 500);
        };
      </script>
    </body>
    </html>
  `);
  ventana.document.close();
}

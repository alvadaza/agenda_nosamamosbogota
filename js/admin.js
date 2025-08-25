import { supabase } from "./api.js";

// --- ELEMENTOS ---
const usersList = document.getElementById("usersList");
const createUserBtn = document.getElementById("createUserBtn");
const createUserMsg = document.getElementById("createUserMsg");
const newName = document.getElementById("new_nombre");
const newEmail = document.getElementById("new_email");
const newPassword = document.getElementById("new_password");
const newIsAdmin = document.getElementById("new_is_admin");
const assignedSelect = document.getElementById("task_assign");
const createTaskBtn = document.getElementById("createTaskBtn");
const createTaskMsg = document.getElementById("createTaskMsg");
const adminTasks = document.getElementById("adminTasks");

// --- FILTROS ---
const filterUser = document.getElementById("filterUser");
const filterStatus = document.getElementById("filterStatus");
const clearFiltersBtn = document.getElementById("clearFilters");

// --- FILTRO DE ESTADÍSTICAS ---
const userStatsFilter = document.getElementById("userStatsFilter");

// --- LOGOUT ---
document.getElementById("logoutBtn").addEventListener("click", async () => {
  await supabase.auth.signOut();
  window.location.href = "index.html";
});

// --- FUNCIONES DE ESTADO VISUAL ---
function getTaskClass(estado) {
  switch (estado) {
    case "pendiente":
      return "task-pendiente";
    case "realizada":
      return "task-realizada";
    case "aplazada":
      return "task-aplazada";
    case "cancelada":
      return "task-cancelada";
    default:
      return "task-pendiente";
  }
}
function getTaskIcon(estado) {
  switch (estado) {
    case "pendiente":
      return "⏳";
    case "realizada":
      return "✅";
    case "aplazada":
      return "🕒";
    case "cancelada":
      return "❌";
    default:
      return "⏳";
  }
}

// --- CARGAR USUARIOS ---
async function loadUsers() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, nombre, email, rol, is_admin")
    .order("nombre", { ascending: true });
  if (error) return console.error(error);

  usersList.innerHTML = data
    .map(
      (u) =>
        `<li>${u.nombre || u.email} — ${
          u.rol || (u.is_admin ? "admin" : "usuario")
        }</li>`
    )
    .join("");

  assignedSelect.innerHTML = data
    .map((u) => `<option value="${u.id}">${u.nombre || u.email}</option>`)
    .join("");

  if (filterUser) {
    filterUser.innerHTML =
      `<option value="">Todos los usuarios</option>` +
      data
        .map((u) => `<option value="${u.id}">${u.nombre || u.email}</option>`)
        .join("");
  }

  if (userStatsFilter) {
    userStatsFilter.innerHTML =
      `<option value="">Todos los usuarios</option>` +
      data
        .map((u) => `<option value="${u.id}">${u.nombre || u.email}</option>`)
        .join("");
  }
}

// --- CREAR USUARIO ---
createUserBtn.addEventListener("click", async () => {
  createUserMsg.textContent = "";
  const name = newName.value.trim(),
    email = newEmail.value.trim(),
    password = newPassword.value.trim(),
    isAdmin = newIsAdmin.checked;
  if (!email || !password) {
    createUserMsg.textContent = "Email y contraseña son obligatorios";
    return;
  }

  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error)
    return (createUserMsg.textContent =
      "Error creando usuario: " + error.message);

  const userId = data.user?.id;
  if (!userId)
    return (createUserMsg.textContent = "No se recuperó id del usuario");

  const rol = isAdmin ? "admin" : "usuario";
  const { error: pErr } = await supabase
    .from("profiles")
    .upsert([{ id: userId, nombre: name, email, rol, is_admin: isAdmin }], {
      onConflict: "id",
    });
  if (pErr) console.error("upsert profile error", pErr);

  createUserMsg.textContent = "Usuario creado.";
  newName.value = newEmail.value = newPassword.value = "";
  loadUsers();
});

// --- CREAR TAREA ---
createTaskBtn.addEventListener("click", async () => {
  createTaskMsg.textContent = "";
  const title = document.getElementById("task_title").value.trim();
  const description = document.getElementById("task_description").value.trim();
  const datetime = document.getElementById("task_datetime").value;
  const assigned_to = document.getElementById("task_assign").value;
  const { data: me } = await supabase.auth.getUser();

  if (!title || !datetime || !assigned_to) {
    createTaskMsg.textContent = "Título, fecha/hora y usuario son obligatorios";
    return;
  }

  const { error } = await supabase.from("tareas").insert([
    {
      titulo: title,
      descripcion: description,
      fecha: datetime,
      asignado_a: assigned_to,
      creado_por: me.user.id,
      estado: "pendiente",
    },
  ]);

  if (error)
    return (createTaskMsg.textContent =
      "Error creando tarea: " + error.message);

  createTaskMsg.textContent = "Tarea creada.";
  document.getElementById("task_title").value = "";
  document.getElementById("task_description").value = "";
  document.getElementById("task_datetime").value = "";
  loadTasks();
});

// --- CARGAR TAREAS ---
async function loadTasks() {
  const { data: tasks, error: taskErr } = await supabase
    .from("tareas")
    .select("*")
    .order("fecha", { ascending: false });
  const { data: users, error: usersErr } = await supabase
    .from("profiles")
    .select("id, nombre");

  if (taskErr || usersErr) return console.error(taskErr || usersErr);

  let tasksWithUserName = tasks.map((t) => ({
    ...t,
    nombreAsignado:
      users.find((u) => u.id === t.asignado_a)?.nombre || t.asignado_a,
  }));

  // aplicar filtros de lista
  const uFilter = filterUser?.value || "";
  const sFilter = filterStatus?.value || "";
  if (uFilter)
    tasksWithUserName = tasksWithUserName.filter(
      (t) => t.asignado_a === uFilter
    );
  if (sFilter)
    tasksWithUserName = tasksWithUserName.filter((t) => t.estado === sFilter);

  adminTasks.innerHTML = tasksWithUserName
    .map(
      (t) => `
    <li class="task-card ${getTaskClass(t.estado)}" data-id="${t.id}">
    
      <span class="task-icon">${getTaskIcon(t.estado)}</span>
      <strong>${t.titulo}</strong> — ${new Date(t.fecha).toLocaleString()}<br/>
      <small>Asignado: ${t.nombreAsignado} — Estado: ${
        t.estado || "pendiente"
      }</small> 
      <div><p><br>PUEDES CAMBIAR EL ESTADO</p></div>
      <div class="row">
        <button data-action="pendiente">Pendiente</button>
        <button data-action="realizada">Realizada</button>
        <button data-action="aplazada">Aplazada</button>
        <button data-action="cancelada">Cancelada</button>
      </div>
    </li>`
    )
    .join("");

  // aplicar filtro para estadísticas (separado del de tareas)
  let statsTasks = [...tasks];
  const statsUserFilter = userStatsFilter?.value || "";
  if (statsUserFilter)
    statsTasks = statsTasks.filter((t) => t.asignado_a === statsUserFilter);

  loadStatistics(statsTasks);

  // calendario
  const events = tasksWithUserName.map((t) => ({
    id: t.id,
    title: t.titulo,
    start: t.fecha,
    extendedProps: {
      descripcion: t.descripcion,
      asignado: t.nombreAsignado,
      estado: t.estado || "pendiente",
    },
  }));
  if (window.calendar) {
    window.calendar.removeAllEvents();
    window.calendar.addEventSource(events);
  }
}

// --- CAMBIAR ESTADO ---
adminTasks.addEventListener("click", async (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  const li = btn.closest("li");
  const id = li.getAttribute("data-id");
  const action = btn.getAttribute("data-action");
  const { error } = await supabase
    .from("tareas")
    .update({ estado: action })
    .eq("id", id);
  if (error) return alert("Error actualizando estado: " + error.message);
  li.style.opacity = 0.5;
  setTimeout(() => loadTasks(), 150);
});

// --- CALENDARIO ---
function initCalendar() {
  const calendarEl = document.getElementById("calendar");
  window.calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",
    locale: "es",
    headerToolbar: {
      left: "prev,next today",
      center: "title",
      right: "dayGridMonth,timeGridWeek,timeGridDay",
    },
    contentHeight: "auto",
    aspectRatio: 1.35,
    dayMaxEvents: true,
  });
  window.calendar.render();
}

// --- SUSCRIPCIÓN REALTIME ---
function subscribeRealtime() {
  supabase
    .channel("tareas-channel")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "tareas" },
      () => loadTasks()
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "tareas" },
      () => loadTasks()
    )
    .subscribe();
}

// --- ESTADÍSTICAS ---
function loadStatistics(tasks) {
  const stats = { pendiente: 0, realizada: 0, aplazada: 0, cancelada: 0 };

  tasks.forEach((t) => {
    if (stats[t.estado] !== undefined) stats[t.estado]++;
  });

  document.getElementById("stat-pendientes").textContent = stats.pendiente;
  document.getElementById("stat-realizadas").textContent = stats.realizada;
  document.getElementById("stat-aplazadas").textContent = stats.aplazada;
  document.getElementById("stat-canceladas").textContent = stats.cancelada;
}

// --- INICIALIZACIÓN ---
window.addEventListener("load", async () => {
  initCalendar();
  await loadUsers();
  await loadTasks();
  subscribeRealtime();

  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener("click", () => {
      if (filterUser) filterUser.value = "";
      if (filterStatus) filterStatus.value = "";
      loadTasks();
    });
  }
  if (filterUser) filterUser.addEventListener("change", loadTasks);
  if (filterStatus) filterStatus.addEventListener("change", loadTasks);
  if (userStatsFilter) userStatsFilter.addEventListener("change", loadTasks);
});

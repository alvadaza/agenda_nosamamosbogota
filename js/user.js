import { supabase } from "./api.js";

const ul = document.getElementById("userTasks");
const calendarEl = document.getElementById("calendar");
const progressBar = document.getElementById("progressBar");
let calendar;

// Inicialización
async function init() {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return (location.href = "index.html");

  const userId = userData.user.id;
  console.log("Usuario actual UUID:", userId);

  const userNameSpan = document.getElementById("userName");
  if (userData.user.user_metadata && userData.user.user_metadata.nombre) {
    userNameSpan.textContent = `Bienvenido ${userData.user.user_metadata.nombre}`;
  } else {
    userNameSpan.textContent = `Bienvenido ${
      userData.user.email.split("@")[0]
    }`;
  }
  initCalendar();
  await loadMyTasks(userId);
  subscribeRealtime(userId);

  // Logout

  document.getElementById("logoutBtn").addEventListener("click", async () => {
    await supabase.auth.signOut();
    location.href = "index.html";
  });
}

// Inicializar calendario
function initCalendar() {
  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",
    headerToolbar: {
      left: "prev,next today",
      center: "title",
      right: "dayGridMonth,timeGridWeek,timeGridDay",
    },
    height: "auto",
    events: [],
  });
  calendar.render();
}

// Obtener clase CSS según estado
function getTaskClass(estado) {
  switch (estado) {
    case "pendiente":
      return "task-card task-pendiente";
    case "realizada":
      return "task-card task-realizada";
    case "aplazada":
      return "task-card task-aplazada";
    case "cancelada":
      return "task-card task-cancelada";
    default:
      return "task-card task-pendiente";
  }
}

// Icono según estado
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

// Actualizar barra de progreso
function updateProgress(tasks) {
  if (!tasks || tasks.length === 0) {
    progressBar.style.width = "0%";
    return;
  }
  const completed = tasks.filter((t) => t.estado === "realizada").length;
  const percent = Math.round((completed / tasks.length) * 100);
  progressBar.style.width = percent + "%";
}

// Cargar tareas
async function loadMyTasks(userId) {
  const { data, error } = await supabase
    .from("tareas")
    .select("*")
    .eq("asignado_a", userId)
    .order("fecha", { ascending: true });

  if (error) return console.error("Error cargando tareas:", error);
  console.log("Tareas encontradas:", data);

  // Actualizar barra de progreso
  updateProgress(data);

  // Pintar lista de tareas
  ul.innerHTML = data
    .map(
      (t) => `
    <li class="${getTaskClass(t.estado)}" data-id="${t.id}">
      <span class="task-icon">${getTaskIcon(t.estado)}</span>
      <strong>${t.titulo}</strong>
      <small>${new Date(t.fecha).toLocaleString()}</small>
      <p>${t.descripcion || ""}</p>
      <div class="row">
        <button data-action="pendiente">Pendiente</button>
        <button data-action="realizada">Realizada</button>
        <button data-action="aplazada">Aplazada</button>
        <button data-action="cancelada">Cancelada</button>
      </div>
    </li>
  `
    )
    .join("");

  // Pintar calendario
  calendar.removeAllEvents();
  data.forEach((t) => {
    calendar.addEvent({
      id: t.id,
      title: t.titulo,
      start: t.fecha,
      allDay: false,
    });
  });
}

// Cambiar estado de tarea
ul.addEventListener("click", async (e) => {
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

  // Animación y actualización visual
  li.style.opacity = 0.5;
  setTimeout(() => {
    li.className = getTaskClass(action);
    li.querySelector(".task-icon").textContent = getTaskIcon(action);
    li.style.opacity = 1;

    // Actualizar barra de progreso
    const tasks = Array.from(ul.children).map((li) => {
      const classes = li.className;
      let estado = "pendiente";
      if (classes.includes("realizada")) estado = "realizada";
      else if (classes.includes("aplazada")) estado = "aplazada";
      else if (classes.includes("cancelada")) estado = "cancelada";
      return { estado };
    });
    updateProgress(tasks);
  }, 150);
});

// Suscripción en tiempo real
function subscribeRealtime(userId) {
  supabase
    .channel("tareas-user-" + userId)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "tareas" },
      (payload) => {
        if (payload.new.asignado_a === userId) loadMyTasks(userId);
      }
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "tareas" },
      (payload) => {
        if (payload.new.asignado_a === userId) loadMyTasks(userId);
      }
    )
    .subscribe();
}

window.addEventListener("load", init);

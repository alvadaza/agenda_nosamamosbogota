// user.js
import { supabase } from "./api.js";

const ul = document.getElementById("userTasks");
const calendarEl = document.getElementById("calendar");
const progressBar = document.getElementById("progressBar");
const filterStatus = document.getElementById("filterStatus");
let calendar;
let tasksChart = null;
let allTasks = [];
let openFormLi = null; // para controlar un solo form abierto

// ====== UTILIDADES ===========================================
function getTaskClass(estado) {
  switch ((estado || "pendiente").toLowerCase()) {
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

function getTaskIcon(estado) {
  switch ((estado || "pendiente").toLowerCase()) {
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

function updateProgress(tasks) {
  if (!tasks || tasks.length === 0) return (progressBar.style.width = "0%");
  const completed = tasks.filter(
    (t) => (t.estado || "pendiente") === "realizada"
  ).length;
  progressBar.style.width = Math.round((completed / tasks.length) * 100) + "%";
}

function renderTaskItem(t) {
  const motivoHtml = t.motivo
    ? `<small><strong>Motivo:</strong> ${t.motivo}</small>`
    : "";
  const reprogramadaHtml = t.aplazada_para
    ? `<small><strong>Reprogramada para:</strong> ${new Date(
        t.aplazada_para
      ).toLocaleString()}</small>`
    : "";
  const evidenciaHtml = t.evidencia_url
    ? `<p><strong>Evidencia:</strong> <a href="${t.evidencia_url}" target="_blank">Ver evidencia</a></p>`
    : "";

  return `
    <li class="${getTaskClass(t.estado)}" data-id="${t.id}">
      <span class="task-icon">${getTaskIcon(t.estado)}</span>
      <strong>${t.titulo}</strong>
      <small>${new Date(t.fecha).toLocaleString()}</small>
      <p>${t.descripcion || ""}</p>
      ${motivoHtml}
      ${reprogramadaHtml}
      ${evidenciaHtml}
      <div class="row two-cols">
        <button data-action="pendiente">Pendiente</button>
        <button data-action="realizada">Realizada</button>
        <button data-action="aplazada">Aplazada</button>
        <button data-action="cancelada">Cancelada</button>
      </div>
    </li>
  `;
}

// ====== CALENDARIO ===========================================
function renderCalendar(tasks) {
  if (!calendar) return;
  calendar.removeAllEvents();
  const estadoColor = {
    pendiente: "#ffb300",
    realizada: "#5cb85c",
    aplazada: "#5bc0de",
    cancelada: "#d9534f",
  };
  tasks.forEach((t) => {
    calendar.addEvent({
      id: t.id,
      title: t.titulo,
      start: t.aplazada_para || t.fecha,
      allDay: false,
      color: estadoColor[t.estado?.toLowerCase()] || "#ffeb3b",
    });
  });
}

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

// ====== ESTADÍSTICAS ========================================
function loadStatistics(tasks) {
  const estados = ["pendiente", "realizada", "aplazada", "cancelada"];
  const counts = estados.map(
    (e) =>
      tasks.filter((t) => (t.estado || "pendiente").toLowerCase() === e).length
  );

  document.getElementById("stat-pendientes").textContent = counts[0];
  document.getElementById("stat-realizadas").textContent = counts[1];
  document.getElementById("stat-aplazadas").textContent = counts[2];
  document.getElementById("stat-canceladas").textContent = counts[3];

  const ctx = document.getElementById("tasksChart")?.getContext("2d");
  if (!ctx) return;
  if (tasksChart) tasksChart.destroy();

  tasksChart = new Chart(ctx, {
    type: "pie",
    data: {
      labels: ["Pendientes", "Realizadas", "Aplazadas", "Canceladas"],
      datasets: [
        {
          data: counts,
          backgroundColor: ["#f0ad4e", "#5cb85c", "#5bc0de", "#d9534f"],
        },
      ],
    },
    options: { responsive: true, plugins: { legend: { position: "bottom" } } },
  });
}

// ====== CARGAR TAREAS =======================================
async function loadMyTasks(userId) {
  const { data, error } = await supabase
    .from("tareas")
    .select("*")
    .order("fecha", { ascending: true });
  if (error) return console.error(error);

  allTasks = data.map((t) => ({
    ...t,
    nombreAsignado: t.nombreAsignado || "Usuario",
  }));

  const myTasks = allTasks.filter(
    (t) => String(t.asignado_a) === String(userId)
  );

  ul.innerHTML = myTasks.map(renderTaskItem).join("");
  updateProgress(myTasks);
  renderCalendar(myTasks);
  loadStatistics(myTasks);
}

// ====== EVENTOS ESTADO ======================================
ul.addEventListener("click", async (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  const li = btn.closest("li");
  if (!li) return;

  const id = li.getAttribute("data-id");
  const action = btn.getAttribute("data-action");

  if (action === "pendiente") {
    await supabase.from("tareas").update({ estado: action }).eq("id", id);
    return loadMyTasks(window.currentUserId);
  }

  if (action === "aplazada" || action === "cancelada") {
    const exists = li.querySelector(".inline-form");
    if (exists) return exists.remove();

    const wrapper = document.createElement("div");
    wrapper.className = "inline-form";
    wrapper.innerHTML = `
      <textarea class="if-motivo" rows="3" placeholder="Escribe el motivo..." required></textarea>
      <input type="datetime-local" class="if-date" style="${
        action === "aplazada" ? "" : "display:none"
      }">
      <button class="if-save">Guardar</button>
      <button class="if-cancel">Cancelar</button>
    `;
    li.appendChild(wrapper);
    openFormLi = li;

    wrapper.querySelector(".if-save").addEventListener("click", async () => {
      const motivo = wrapper.querySelector(".if-motivo").value.trim();
      const aplazadaPara = wrapper.querySelector(".if-date")?.value || null;
      if (!motivo) return alert("Escribe el motivo");

      const payload = { estado: action, motivo };
      if (action === "aplazada") payload.aplazada_para = aplazadaPara;

      await supabase.from("tareas").update(payload).eq("id", id);
      await loadMyTasks(window.currentUserId);
      wrapper.remove();
    });

    wrapper
      .querySelector(".if-cancel")
      .addEventListener("click", () => wrapper.remove());
    return;
  }

  if (action === "realizada") {
    const exists = li.querySelector(".inline-form");
    if (exists) return exists.remove();

    const wrapper = document.createElement("div");
    wrapper.className = "inline-form";
    wrapper.innerHTML = `
      <input type="file" class="if-file" accept="image/*">
      <button class="if-save">Guardar</button>
      <button class="if-cancel">Cancelar</button>
    `;
    li.appendChild(wrapper);
    openFormLi = li;
    const CLOUDINARY = {
      cloudName: "dl7kjajkv", // tu cloud
      uploadPreset: "tareas_upload", // tu upload preset unsigned
    };
    wrapper.querySelector(".if-save").addEventListener("click", async () => {
      const file = wrapper.querySelector(".if-file").files[0];
      let evidenciaUrl = null;
      if (file) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", CLOUDINARY.uploadPreset);
        const res = await fetch(
          `https://api.cloudinary.com/v1_1/${CLOUDINARY.cloudName}/upload`,
          { method: "POST", body: formData }
        );
        const data = await res.json();
        evidenciaUrl = data.secure_url;
      }
      const payload = { estado: "realizada" };
      if (evidenciaUrl) payload.evidencia_url = evidenciaUrl;

      await supabase.from("tareas").update(payload).eq("id", id);
      await loadMyTasks(window.currentUserId);
      wrapper.remove();
    });

    wrapper
      .querySelector(".if-cancel")
      .addEventListener("click", () => wrapper.remove());
    return;
  }
});

// ====== REALTIME =============================================
function subscribeRealtime(userId) {
  supabase
    .channel("tareas-user-" + userId)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "tareas" },
      (payload) => payload.new.asignado_a === userId && loadMyTasks(userId)
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "tareas" },
      (payload) => payload.new.asignado_a === userId && loadMyTasks(userId)
    )
    .subscribe();
}

// ====== FILTRO POR ESTADO ====================================
filterStatus?.addEventListener("change", () => {
  const estado = filterStatus.value;
  const userId = window.currentUserId;
  const userTasks = allTasks.filter(
    (t) => String(t.asignado_a) === String(userId)
  );

  const filteredTasks = estado
    ? userTasks.filter((t) => (t.estado || "pendiente") === estado)
    : userTasks;

  ul.innerHTML = filteredTasks.map(renderTaskItem).join("");
  updateProgress(filteredTasks);
  renderCalendar(filteredTasks);
  loadStatistics(filteredTasks);
});

// --- BOTÓN LIMPIAR FILTRO ---
document.getElementById("clearFilters")?.addEventListener("click", () => {
  filterStatus.value = "";
  filterStatus.dispatchEvent(new Event("change"));
});

// ====== INIT ==================================================
async function init() {
  const { data: userData, error } = await supabase.auth.getUser();
  if (error || !userData.user) return (location.href = "index.html");

  const user = userData.user;
  window.currentUserId = user.id; // 🔹 guardamos userId global

  // Header
  document.getElementById("userName").textContent = `Bienvenido ${
    user.user_metadata?.nombre || user.email.split("@")[0]
  }`;

  // Logout
  document.getElementById("logoutBtn")?.addEventListener("click", async () => {
    await supabase.auth.signOut();
    location.href = "index.html";
  });

  // Calendario
  initCalendar();

  // Cargar tareas y suscribirse
  await loadMyTasks(user.id);
  subscribeRealtime(user.id);
}

window.addEventListener("load", init);

// user.js
import { supabase } from "./api.js";

const ul = document.getElementById("userTasks");
const calendarEl = document.getElementById("calendar");
const progressBar = document.getElementById("progressBar");
let calendar;
let openFormLi = null; // para asegurar solo un formulario abierto

// ====== CONFIG CLOUDINARY (rellena con tus valores) ============
const CLOUDINARY = {
  cloudName: "TU_CLOUD_NAME",
  uploadPreset: "TU_UPLOAD_PRESET", // unsigned
};

// helper subida a Cloudinary
async function uploadToCloudinary(file) {
  const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY.cloudName}/image/upload`;
  const fd = new FormData();
  fd.append("file", file);
  fd.append("upload_preset", CLOUDINARY.uploadPreset);
  const res = await fetch(url, { method: "POST", body: fd });
  if (!res.ok) throw new Error("Fallo subiendo imagen a Cloudinary");
  const json = await res.json();
  return json.secure_url; // URL pública
}

// ====== INIT ===================================================
async function init() {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    location.href = "index.html";
    return;
  }

  const user = userData.user;
  const userId = user.id;

  // Saludo en header
  const userNameSpan = document.getElementById("userName");
  if (userNameSpan) {
    const nombre =
      user.user_metadata?.nombre || user.email?.split("@")[0] || "Usuario";
    userNameSpan.textContent = `Bienvenido ${nombre}`;
  }

  // Logout
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      await supabase.auth.signOut();
      location.href = "index.html";
    });
  }

  // Calendario
  initCalendar();

  // Cargar y suscribir
  await loadMyTasks(userId);
  subscribeRealtime(userId);
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

// ====== RENDER / PROGRESO ======================================
function getTaskClass(estado) {
  switch (estado) {
    case "realizada":
      return "task-card task-realizada";
    case "aplazada":
      return "task-card task-aplazada";
    case "cancelada":
      return "task-card task-cancelada";
    case "pendiente":
    default:
      return "task-card task-pendiente";
  }
}

function getTaskIcon(estado) {
  switch (estado) {
    case "realizada":
      return "✅";
    case "aplazada":
      return "🕒";
    case "cancelada":
      return "❌";
    case "pendiente":
    default:
      return "⏳";
  }
}

function updateProgress(tasks) {
  if (!tasks || tasks.length === 0) {
    progressBar.style.width = "0%";
    return;
  }
  const completed = tasks.filter((t) => t.estado === "realizada").length;
  const percent = Math.round((completed / tasks.length) * 100);
  progressBar.style.width = percent + "%";
}

// ====== LOAD TASKS =============================================
async function loadMyTasks(userId) {
  const { data, error } = await supabase
    .from("tareas")
    .select("*")
    .eq("asignado_a", userId)
    .order("fecha", { ascending: true });

  if (error) {
    console.error("Error cargando tareas:", error);
    return;
  }

  // Progreso
  updateProgress(data);

  // Lista
  ul.innerHTML = data
    .map((t) => {
      const motivoHtml = t.motivo
        ? `<small><strong>Motivo:</strong> ${t.motivo}</small>`
        : "";
      const reprogramadaHtml = t.aplazada_para
        ? `<small><strong>Reprogramada para:</strong> ${new Date(
            t.aplazada_para
          ).toLocaleString()}</small>`
        : "";
      const evidenciaHtml = t.evidencia_url
        ? `<div class="evidencia"><a href="${t.evidencia_url}" target="_blank" rel="noopener"><img class="evidencia-thumb" src="${t.evidencia_url}" alt="evidencia"></a></div>`
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
            <button type="button" data-action="pendiente">Pendiente</button>
            <button type="button" data-action="realizada">Realizada</button>
            <button type="button" data-action="aplazada">Aplazada</button>
            <button type="button" data-action="cancelada">Cancelada</button>
          </div>
        </li>
      `;
    })
    .join("");

  // Calendario (usa aplazada_para si existe)
  const estadoColor = {
    pendiente: "#ffb300", // amarillo anaranjado
    aplazada: "#fff59d", // amarillo suave
    cancelada: "#ffc107", // dorado
    realizada: "#fdd835", // amarillo intenso
  };

  calendar.removeAllEvents();
  data.forEach((t) => {
    const start = t.aplazada_para || t.fecha;
    calendar.addEvent({
      id: t.id,
      title: t.titulo,
      start,
      allDay: false,
      color: estadoColor[t.estado] || "#ffeb3b",
    });
  });
}

// ====== INLINE FORMS ===========================================
function closeInlineForm() {
  if (openFormLi) {
    const f = openFormLi.querySelector(".inline-form");
    if (f) f.remove();
    openFormLi = null;
  }
}

function createInlineFormMotivo({ showDate }) {
  const wrapper = document.createElement("div");
  wrapper.className = "inline-form";
  wrapper.innerHTML = `
    <div class="inline-form-body">
      <label>Motivo</label>
      <textarea class="if-motivo" rows="3" placeholder="Escribe el motivo..." required></textarea>
      <div class="if-date-row" style="${showDate ? "" : "display:none"}">
        <label>Reprogramada para</label>
        <input type="datetime-local" class="if-date">
      </div>
      <div class="row two-cols">
        <button type="button" class="if-save">Guardar</button>
        <button type="button" class="if-cancel">Cancelar</button>
      </div>
    </div>
  `;
  return wrapper;
}

function createInlineFormRealizada() {
  const wrapper = document.createElement("div");
  wrapper.className = "inline-form";
  wrapper.innerHTML = `
    <div class="inline-form-body">
      <label>Evidencia (opcional)</label>
      <input type="file" class="if-file" accept="image/*">
      <div class="row two-cols">
        <button type="button" class="if-save">Guardar</button>
        <button type="button" class="if-cancel">Cancelar</button>
      </div>
    </div>
  `;
  return wrapper;
}

// ====== EVENTOS (delegación) ===================================
ul.addEventListener("click", async (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  const li = btn.closest("li");
  if (!li) return;

  const id = li.getAttribute("data-id");
  const action = btn.getAttribute("data-action"); // pendiente | realizada | aplazada | cancelada

  // Cerrar otro form abierto
  if (openFormLi && openFormLi !== li) closeInlineForm();

  // APLAZADA o CANCELADA -> motivo (y fecha si aplazada)
  if (action === "aplazada" || action === "cancelada") {
    // toggle
    const exists = li.querySelector(".inline-form");
    if (exists) {
      exists.remove();
      openFormLi = null;
      return;
    }
    const needsDate = action === "aplazada";
    const form = createInlineFormMotivo({ showDate: needsDate });
    li.appendChild(form);
    openFormLi = li;

    form.querySelector(".if-save").addEventListener("click", async () => {
      const motivo = form.querySelector(".if-motivo").value.trim();
      const dateInput = form.querySelector(".if-date");
      const aplazadaPara = needsDate ? dateInput?.value || null : null;

      if (!motivo) {
        alert("Por favor escribe el motivo.");
        return;
      }

      const payload = { estado: action, motivo };
      if (needsDate) payload.aplazada_para = aplazadaPara;

      const { error } = await supabase
        .from("tareas")
        .update(payload)
        .eq("id", id);
      if (error) {
        console.error(error);
        alert("Error actualizando la tarea");
        return;
      }

      const { data: userData } = await supabase.auth.getUser();
      await loadMyTasks(userData.user.id);
      closeInlineForm();
    });

    form.querySelector(".if-cancel").addEventListener("click", () => {
      closeInlineForm();
    });

    return;
  }

  // REALIZADA -> permitir adjuntar imagen a Cloudinary
  if (action === "realizada") {
    // toggle
    const exists = li.querySelector(".inline-form");
    if (exists) {
      exists.remove();
      openFormLi = null;
      return;
    }
    const form = createInlineFormRealizada();
    li.appendChild(form);
    openFormLi = li;

    form.querySelector(".if-save").addEventListener("click", async () => {
      const file = form.querySelector(".if-file").files[0];
      let evidenciaUrl = null;

      try {
        if (file) {
          evidenciaUrl = await uploadToCloudinary(file);
        }
        const payload = { estado: "realizada" };
        if (evidenciaUrl) payload.evidencia_url = evidenciaUrl;

        const { error } = await supabase
          .from("tareas")
          .update(payload)
          .eq("id", id);
        if (error) throw error;

        const { data: userData } = await supabase.auth.getUser();
        await loadMyTasks(userData.user.id);
        closeInlineForm();
      } catch (err) {
        console.error(err);
        alert("Error marcando como realizada / subiendo evidencia");
      }
    });

    form.querySelector(".if-cancel").addEventListener("click", () => {
      closeInlineForm();
    });

    return;
  }

  // PENDIENTE -> actualizar directo
  if (action === "pendiente") {
    const { error } = await supabase
      .from("tareas")
      .update({ estado: action })
      .eq("id", id);
    if (error) {
      alert("Error actualizando estado: " + error.message);
      return;
    }
    const { data: userData } = await supabase.auth.getUser();
    await loadMyTasks(userData.user.id);
  }
});

// ====== REALTIME ===============================================
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

// ====== GO! ====================================================
window.addEventListener("load", init);

/*************************************************
 * FOCUSWORK – app.js
 * RECONSTRUCCIÓ COMPLETA
 * PART 1 / 4
 *************************************************/

/* ================= CONFIG ================= */
const WHATSAPP_PHONE = "34649383847";
const APP_VERSION = "3.1";

/* ================= HELPERS ================= */
const $ = (id) => document.getElementById(id);

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function formatTime(sec = 0) {
  const h = String(Math.floor(sec / 3600)).padStart(2, "0");
  const m = String(Math.floor((sec % 3600) / 60)).padStart(2, "0");
  const s = String(sec % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

/* ================= ACTIVITATS ================= */
const ACTIVITIES = {
  WORK: "work",
  PHONE: "phone",
  CLIENT: "client",
  VISIT: "visit",
  OTHER: "other"
};

function activityLabel(act) {
  return {
    work: "Feina",
    phone: "Trucades",
    client: "Reunions",
    visit: "Visitant",
    other: "Altres"
  }[act] || act;
}

/* ================= ESTAT ================= */
let state = JSON.parse(localStorage.getItem("focowork_state")) || {
  isFull: false,
  license: null,
  day: todayKey(),
  currentClientId: null,
  currentActivity: null,
  lastTick: null,
  sessionElapsed: 0,
  clients: {},
  focus: {},
  focusSchedule: {
    enabled: false,
    start: "09:00",
    end: "17:00"
  }
};

function save() {
  localStorage.setItem("focowork_state", JSON.stringify(state));
}

/* ================= HORARI AVANÇAT ================= */
function isWithinFocusSchedule(date = new Date()) {
  if (!state.focusSchedule.enabled) return true;

  const [sh, sm] = state.focusSchedule.start.split(":").map(Number);
  const [eh, em] = state.focusSchedule.end.split(":").map(Number);

  const now = date.getHours() * 60 + date.getMinutes();
  const start = sh * 60 + sm;
  const end = eh * 60 + em;

  return now >= start && now < end;
}

/* ================= MODALS BÀSICS ================= */
function openModal(id) {
  $(id)?.classList.remove("hidden");
}

function closeModal(id) {
  $(id)?.classList.add("hidden");
}

function showAlert(title, text, icon = "ℹ️") {
  $("alertTitle").textContent = title;
  $("alertText").textContent = text;
  $("alertIcon").textContent = icon;
  openModal("modalAlert");
}

/* ===== FI PART 1 ===== *//*************************************************
 * PART 2 / 4
 * MOTOR DE TEMPS + UI + WORKPAD
 *************************************************/

/* ================= RESET DIARI ================= */
function resetDayIfNeeded() {
  if (state.day !== todayKey()) {
    state.day = todayKey();
    state.focus = {};
    save();
  }
}

/* ================= MOTOR DE TEMPS ================= */
function tick() {
  resetDayIfNeeded();

  const client = state.clients[state.currentClientId];
  if (!client || !client.active || !state.currentActivity) {
    state.lastTick = Date.now();
    return;
  }

  if (!state.lastTick) {
    state.lastTick = Date.now();
    return;
  }

  const now = Date.now();
  const diff = Math.floor((now - state.lastTick) / 1000);
  if (diff < 1) return;

  state.lastTick = now;

  // ⏱️ Temps total (sempre)
  state.sessionElapsed += diff;
  client.total += diff;

  client.activities[state.currentActivity] =
    (client.activities[state.currentActivity] || 0) + diff;

  // 💰 Facturable / 🎯 Focus (només dins horari)
  if (isWithinFocusSchedule()) {
    client.billableTime = (client.billableTime || 0) + diff;
    state.focus[state.currentActivity] =
      (state.focus[state.currentActivity] || 0) + diff;
  }

  save();
  updateUI();
}

setInterval(tick, 1000);

/* ================= WORKPAD (NOTES) ================= */
let workpadTimeout = null;
let isWorkpadInitialized = false;

function updateWorkpad() {
  const area = $("clientWorkpad");
  const client = state.clients[state.currentClientId];

  if (!area || !client) {
    isWorkpadInitialized = false;
    if (area) area.style.display = "none";
    return;
  }

  area.style.display = "block";

  if (!isWorkpadInitialized) {
    area.value = client.notes || "";

    area.oninput = (e) => {
      client.notes = e.target.value;
      clearTimeout(workpadTimeout);
      workpadTimeout = setTimeout(save, 1000);
    };

    isWorkpadInitialized = true;
  }
}

/* ================= UI ================= */
function updateUI() {
  const exitBtn = document.getElementById("exitClientFloating");
if (exitBtn) {
  exitBtn.classList.toggle("hidden", !state.currentClientId);
      }
  const client = state.clients[state.currentClientId] || null;

  if ($("clientName")) {
    $("clientName").textContent = client
      ? `Client: ${client.name}${client.active ? "" : " (tancat)"}`
      : "Sense client actiu";
  }

  if ($("activityName")) {
    $("activityName").textContent = state.currentActivity
      ? activityLabel(state.currentActivity)
      : "—";
  }

  if ($("timer")) {
    $("timer").textContent =
      client && client.active
        ? formatTime(state.sessionElapsed)
        : "00:00:00";
  }

  if ($("clientTotal")) {
    $("clientTotal").textContent = client
      ? `Total client: ${formatTime(client.total)}`
      : "";
  }

  // 💰 Facturable
  const billableBox = $("billableTimeBox");
  if (billableBox) {
    if (client && state.focusSchedule.enabled) {
      billableBox.textContent =
        `💰 Facturable: ${formatTime(client.billableTime || 0)}`;
      billableBox.style.display = "block";
    } else {
      billableBox.style.display = "none";
    }
  }

  // ⏳ Fora d'horari
  const status = $("focusScheduleStatus");
  if (status) {
    if (
      client &&
      state.focusSchedule.enabled &&
      !isWithinFocusSchedule()
    ) {
      status.textContent = "⏳ Fora d’horari d’enfocament";
      status.style.display = "block";
    } else {
      status.style.display = "none";
    }
  }

  updateWorkpad();
}

/* ===== FI PART 2 ===== *//*************************************************
 * PART 3 / 4
 * TASQUES + DATA LLIURAMENT + FOTOS
 *************************************************/

/* ================= TASQUES ================= */
let taskTimeouts = { urgent: null, important: null, later: null };
let areTasksInitialized = false;

function updateTasks() {
  const client = state.clients[state.currentClientId];
  const urgent = $("taskUrgent");
  const important = $("taskImportant");
  const later = $("taskLater");

  if (!client || !urgent || !important || !later) {
    areTasksInitialized = false;
    if (urgent) urgent.style.display = "none";
    if (important) important.style.display = "none";
    if (later) later.style.display = "none";
    return;
  }

  urgent.style.display = "block";
  important.style.display = "block";
  later.style.display = "block";

  if (!client.tasks) {
    client.tasks = { urgent: "", important: "", later: "" };
  }

  if (!areTasksInitialized) {
    urgent.value = client.tasks.urgent || "";
    important.value = client.tasks.important || "";
    later.value = client.tasks.later || "";

    urgent.oninput = (e) => handleTaskInput("urgent", e);
    important.oninput = (e) => handleTaskInput("important", e);
    later.oninput = (e) => handleTaskInput("later", e);

    areTasksInitialized = true;
  }
}

function handleTaskInput(type, e) {
  const client = state.clients[state.currentClientId];
  if (!client || !client.tasks) return;

  client.tasks[type] = e.target.value;
  clearTimeout(taskTimeouts[type]);
  taskTimeouts[type] = setTimeout(save, 1000);
}

/* ================= DATA DE LLIURAMENT ================= */
function setDeliveryDate() {
  const client = state.clients[state.currentClientId];
  if (!client) {
    showAlert("Sense client", "Selecciona un client primer", "⚠️");
    return;
  }

  $("inputDeliveryDate").value = client.deliveryDate || "";
  openModal("modalDeliveryDate");
}

function saveDeliveryDate() {
  const client = state.clients[state.currentClientId];
  if (!client) return;

  const value = $("inputDeliveryDate").value;
  client.deliveryDate = value || null;

  areTasksInitialized = false;
  save();
  updateUI();
  closeModal("modalDeliveryDate");

  showAlert(
    "Data desada",
    value ? "Data de lliurament establerta" : "Data eliminada",
    "✅"
  );
}

/* ================= FOTOS ================= */
let photoToDelete = null;

function addPhotoToClient() {
  const client = state.clients[state.currentClientId];
  if (!client) return;

  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.capture = "environment";

  input.onchange = () => {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const MAX = 1024;
        let { width, height } = img;

        if (width > MAX) {
          height *= MAX / width;
          width = MAX;
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);

        client.photos = client.photos || [];
        client.photos.push({
          id: uid(),
          date: new Date().toISOString(),
          data: canvas.toDataURL("image/jpeg", 0.7)
        });

        save();
        renderPhotoGallery();
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  input.click();
}

function renderPhotoGallery() {
  const gallery = $("photoGallery");
  const client = state.clients[state.currentClientId];

  if (!gallery || !client || !client.photos || !client.photos.length) {
    if (gallery) gallery.innerHTML = "";
    return;
  }

  gallery.innerHTML = "";

  [...client.photos]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .forEach(p => {
      const img = document.createElement("img");
      img.src = p.data;
      img.className = "photo-thumb";

      img.onclick = () => {
        const w = window.open();
        if (w) {
          w.document.write(
            `<img src="${p.data}" style="width:100%;background:#000">`
          );
        }
      };

      img.oncontextmenu = (e) => {
        e.preventDefault();
        photoToDelete = p.id;
        openModal("modalDeletePhoto");
      };

      gallery.appendChild(img);
    });
}

function confirmDeletePhoto() {
  const client = state.clients[state.currentClientId];
  if (!client || !photoToDelete) return;

  client.photos = client.photos.filter(p => p.id !== photoToDelete);
  photoToDelete = null;

  save();
  renderPhotoGallery();
  closeModal("modalDeletePhoto");
}

/* ===== FI PART 3 ===== *//*************************************************
 * PART 4 / 4
 * CLIENTS · HISTÒRIC · INFORMES · EXPORTS · INIT
 *************************************************/

/* ================= CLIENTS ================= */
function newClient() {
  $("inputNewClient").value = "";
  openModal("modalNewClient");
}

function confirmNewClient() {
  const name = $("inputNewClient").value.trim();
  if (!name) return;

  const id = uid();
  state.clients[id] = {
    id,
    name,
    active: true,
    total: 0,
    billableTime: 0,
    activities: {},
    photos: [],
    notes: "",
    deliveryDate: null,
    tasks: { urgent: "", important: "", later: "" },
    extraHours: []
  };

  state.currentClientId = id;
  state.currentActivity = ACTIVITIES.WORK;
  state.sessionElapsed = 0;
  state.lastTick = Date.now();
  isWorkpadInitialized = false;
  areTasksInitialized = false;

  save();
  updateUI();
  closeModal("modalNewClient");
}

function changeClient() {
  const list = $("activeClientsList");
  list.innerHTML = "";

  Object.values(state.clients)
    .filter(c => c.active)
    .forEach(client => {
      const item = document.createElement("div");
      item.className = "client-item";
      item.innerHTML = `
        <div class="client-name">${client.name}</div>
        <div class="client-time">Total: ${formatTime(client.total)}</div>
      `;
      item.onclick = () => selectClient(client.id);
      list.appendChild(item);
    });

  openModal("modalChangeClient");
}

function selectClient(id) {
  state.currentClientId = id;
  state.currentActivity = ACTIVITIES.WORK;
  state.sessionElapsed = 0;
  state.lastTick = Date.now();
  isWorkpadInitialized = false;
  areTasksInitialized = false;

  save();
  updateUI();
  closeModal("modalChangeClient");
}

function closeClient() {
  const client = state.clients[state.currentClientId];
  if (!client) return;

  client.active = false;
  state.currentClientId = null;
  state.currentActivity = null;
  state.lastTick = null;

  save();
  updateUI();
  showAlert("Client tancat", `${client.name} tancat`, "✅");
}

/* ================= HISTÒRIC ================= */
function showHistory() {
  const list = $("historyClientsList");
  list.innerHTML = "";

  Object.values(state.clients)
    .filter(c => !c.active)
    .forEach(client => {
      const item = document.createElement("div");
      item.className = "client-item";
      item.innerHTML = `
        <div class="client-name">${client.name}</div>
        <div class="client-time">
          ${formatTime(client.total)} · ${client.photos.length} fotos
        </div>
      `;
      item.onclick = () => {
        state.currentClientId = client.id;
        updateUI();
        closeModal("modalHistory");
      };
      list.appendChild(item);
    });

  openModal("modalHistory");
}

/* ================= HORES EXTRES ================= */
function addExtraHours() {
  openModal("modalExtraHours");
}

function saveExtraHours() {
  const client = state.clients[state.currentClientId];
  if (!client) return;

  const hours = parseFloat($("inputExtraHours").value);
  const desc = $("inputExtraDescription").value.trim();

  if (!hours || hours <= 0) {
    showAlert("Error", "Hores incorrectes", "⚠️");
    return;
  }

  client.extraHours.push({
    id: uid(),
    date: new Date().toISOString(),
    hours,
    seconds: Math.round(hours * 3600),
    description: desc || "Hores extres"
  });

  client.billableTime += Math.round(hours * 3600);

  save();
  closeModal("modalExtraHours");
  showAlert("Hores afegides", `${hours}h afegides`, "✅");
}

function showExtraHours() {
  const client = state.clients[state.currentClientId];
  const list = $("extraHoursList");
  list.innerHTML = "";

  let total = 0;
  client.extraHours.forEach(e => {
    total += e.seconds;
    const div = document.createElement("div");
    div.textContent = `${e.hours}h – ${e.description}`;
    list.appendChild(div);
  });

  $("extraHoursTotal").textContent = formatTime(total);
  openModal("modalViewExtraHours");
}

/* ================= INFORME ================= */
function generateReport() {
  const client = state.clients[state.currentClientId];
  if (!client) return;

  const text =
`📋 INFORME DE PROJECTE

Client: ${client.name}
Data: ${new Date().toLocaleDateString("ca-ES")}

Temps total: ${formatTime(client.total)}
Temps facturable: ${formatTime(client.billableTime)}

Fotos: ${client.photos.length}

Notes:
${client.notes || "-"}

Generat amb FocusWork v${APP_VERSION}`;

  $("reportContent").textContent = text;
  openModal("modalReport");
}

function copyReport() {
  navigator.clipboard.writeText($("reportContent").textContent);
  showAlert("Copiat", "Informe copiat", "✅");
}

/* ================= EXPORT / IMPORT ================= */
function exportCurrentWork() {
  const client = state.clients[state.currentClientId];
  if (!client) return;

  const data = {
    version: APP_VERSION,
    client
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json"
  });

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `focuswork_${client.name}.json`;
  a.click();
}

function importWork() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json";

  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;

    const text = await file.text();
    const data = JSON.parse(text);

    const id = uid();
    state.clients[id] = { ...data.client, id, active: true };
    state.currentClientId = id;

    save();
    updateUI();
    showAlert("Importat", "Client importat", "✅");
  };

  input.click();
}

/* ================= HORARI ================= */
function openScheduleModal() {
  $("scheduleEnabled").checked = state.focusSchedule.enabled;
  $("scheduleStart").value = state.focusSchedule.start;
  $("scheduleEnd").value = state.focusSchedule.end;
  $("scheduleConfig").style.display =
    state.focusSchedule.enabled ? "block" : "none";

  $("scheduleEnabled").onchange = e => {
    $("scheduleConfig").style.display =
      e.target.checked ? "block" : "none";
  };

  openModal("modalSchedule");
}

function saveScheduleConfig() {
  state.focusSchedule.enabled = $("scheduleEnabled").checked;
  state.focusSchedule.start = $("scheduleStart").value;
  state.focusSchedule.end = $("scheduleEnd").value;

  save();
  closeModal("modalSchedule");
  showAlert("Horari desat", "Configuració actualitzada", "✅");
}

/* ================= INIT ================= */
document.addEventListener("DOMContentLoaded", () => {

  const bind = (id, fn) => {
    const el = document.getElementById(id);
    if (el) el.onclick = fn;
  };

  /* CLIENTS */
  bind("newClientBtn", newClient);
  bind("changeClient", changeClient);
  bind("historyBtn", showHistory);

  bind("closeClient", () => {
    const client = state.clients[state.currentClientId];
    if (!client) return;

    document.getElementById("closeClientText").textContent =
      `Client: ${client.name}\nTemps total: ${formatTime(client.total)}`;

    openModal("modalCloseClient");
  });

  bind("deleteClientBtn", deleteCurrentClient);

  /* SORTIR CLIENT (floating) */
  bind("exitClientFloating", () => {
    state.currentClientId = null;
    state.currentActivity = null;
    state.lastTick = null;
    updateUI();
  });

  /* FOCUS */
  bind("focusBtn", showFocus);
  bind("focusPriorityBtn", () => {
    showAlert(
      "Focus prioritaris",
      "Funció en construcció: servirà per enfocar clients urgents 🔧",
      "🎯"
    );
  });

  /* ALTRES */
  bind("cameraBtn", addPhotoToClient);
  bind("setDeliveryDateBtn", setDeliveryDate);
  bind("addExtraHoursBtn", addExtraHours);
  bind("viewExtraHoursBtn", showExtraHours);
  bind("generateReportBtn", generateReport);
  bind("exportWorkBtn", exportCurrentWork);
  bind("importWorkBtn", importWork);
  bind("scheduleBtn", openScheduleModal);
  bind("todayBtn", exportTodayCSV);

  /* ACTIVITATS */
  document.querySelectorAll(".activity").forEach(btn => {
    btn.onclick = () => {
      state.currentActivity = btn.dataset.activity;
      updateUI();
    };
  });

  updateUI();
});

/* ===== FI PART 4 ===== */

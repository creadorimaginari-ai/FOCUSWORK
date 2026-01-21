/*************************************************
 * FOCUSWORK – app.js (V3.1 COMPLET I FUNCIONAL)
 *************************************************/

/* ================= CONFIG ================= */
const WHATSAPP_PHONE = "34649383847";
const APP_VERSION = "3.1";

/* ================= ACTIVITATS ================= */
const ACTIVITIES = {
  WORK: "work",
  PHONE: "phone",
  CLIENT: "client",
  VISIT: "visit",
  OTHER: "other"
};

function activityLabel(act) {
  const labels = {
    work: "Feina",
    phone: "Trucades",
    client: "Reunions",
    visit: "Visitant",
    other: "Altres"
  };
  return labels[act] || act;
}

/* ================= AJUDANTS ================= */
const $ = (id) => document.getElementById(id);

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function formatTime(sec) {
  const h = String(Math.floor(sec / 3600)).padStart(2, "0");
  const m = String(Math.floor((sec % 3600) / 60)).padStart(2, "0");
  const s = String(sec % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function isWithinFocusSchedule(date = new Date()) {
  if (!state.focusSchedule || !state.focusSchedule.enabled) return true;
  const [sh, sm] = state.focusSchedule.start.split(":").map(Number);
  const [eh, em] = state.focusSchedule.end.split(":").map(Number);
  const minutesNow = date.getHours() * 60 + date.getMinutes();
  const minutesStart = sh * 60 + sm;
  const minutesEnd = eh * 60 + em;
  return minutesNow >= minutesStart && minutesNow <= minutesEnd;
}

/* ================= MODALS ================= */
function openModal(id) {
  const modal = $(id);
  if (modal) modal.classList.remove('hidden');
}

function closeModal(id) {
  const modal = $(id);
  if (modal) modal.classList.add('hidden');
}

function showAlert(title, message, icon = 'ℹ️') {
  if ($('alertTitle')) $('alertTitle').textContent = title;
  if ($('alertText')) $('alertText').textContent = message;
  if ($('alertIcon')) $('alertIcon').textContent = icon;
  openModal('modalAlert');
}

/* ================= USUARI ================= */
let userName = localStorage.getItem("focowork_user_name") || "Usuari";

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
  focusSchedule: { enabled: false, start: "09:00", end: "17:00" }
};

function save() {
  localStorage.setItem("focowork_state", JSON.stringify(state));
}

/* ================= RESET DIARI ================= */
function resetDayIfNeeded() {
  if (state.day !== todayKey()) {
    state.day = todayKey();
    state.focus = {};
    save();
  }
}

/* ================= LLICÈNCIES ================= */
async function loadLicenseFile() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.focowork,.json';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const license = JSON.parse(text);
      state.isFull = true;
      state.license = license;
      save();
      updateUI();
      showAlert('Llicència activada!', 'FocusWork complet activat!', '🎉');
    } catch (err) {
      showAlert('Error', 'No s\'ha pogut llegir l\'arxiu', '❌');
    }
  };
  input.click();
}

function requestLicense() {
  const deviceId = "FW-" + Date.now().toString(36);
  const message = encodeURIComponent(`Hola! Voldria activar FocusWork.\n\nDevice ID: ${deviceId}`);
  window.location.href = `https://wa.me/${WHATSAPP_PHONE}?text=${message}`;
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
  const elapsed = Math.floor((now - state.lastTick) / 1000);
  if (elapsed < 1) return;
  
  state.lastTick = now;
  state.sessionElapsed += 1;
  client.total += 1;
  client.activities[state.currentActivity] = (client.activities[state.currentActivity] || 0) + 1;
  
  if (state.focusSchedule.enabled) {
    if (isWithinFocusSchedule()) {
      client.billableTime = (client.billableTime || 0) + 1;
      state.focus[state.currentActivity] = (state.focus[state.currentActivity] || 0) + 1;
    }
  } else {
    client.billableTime = (client.billableTime || 0) + 1;
    state.focus[state.currentActivity] = (state.focus[state.currentActivity] || 0) + 1;
  }
  
  save();
  updateUI();
}

setInterval(tick, 1000);

/* ================= WORKPAD ================= */
let workpadTimeout = null;
let isWorkpadInitialized = false;

function updateWorkpad() {
  const workpadArea = $('clientWorkpad');
  const client = state.clients[state.currentClientId];
  if (!workpadArea || !client) {
    isWorkpadInitialized = false;
    return;
  }
  const savedNote = client.notes || '';
  if (workpadArea.value !== savedNote && !isWorkpadInitialized) {
    workpadArea.value = savedNote;
  }
  if (!isWorkpadInitialized) {
    workpadArea.oninput = (e) => {
      if (!client) return;
      client.notes = e.target.value;
      clearTimeout(workpadTimeout);
      workpadTimeout = setTimeout(save, 1000);
    };
    isWorkpadInitialized = true;
  }
}

/* ================= TASQUES ================= */
let taskTimeouts = { urgent: null, important: null, later: null };
let areTasksInitialized = false;

function updateTasks() {
  const client = state.clients[state.currentClientId];
  const urgentArea = $('taskUrgent');
  const importantArea = $('taskImportant');
  const laterArea = $('taskLater');
  if (!urgentArea || !importantArea || !laterArea || !client) {
    areTasksInitialized = false;
    return;
  }
  if (!client.tasks) {
    client.tasks = { urgent: "", important: "", later: "" };
  }
  if (!areTasksInitialized) {
    urgentArea.value = client.tasks.urgent || '';
    importantArea.value = client.tasks.important || '';
    laterArea.value = client.tasks.later || '';
    
    const handleTaskInput = (taskType, e) => {
      if (!client.tasks) return;
      client.tasks[taskType] = e.target.value;
      clearTimeout(taskTimeouts[taskType]);
      taskTimeouts[taskType] = setTimeout(save, 1000);
    };
    
    urgentArea.oninput = (e) => handleTaskInput('urgent', e);
    importantArea.oninput = (e) => handleTaskInput('important', e);
    laterArea.oninput = (e) => handleTaskInput('later', e);
    areTasksInitialized = true;
  }
}

function setDeliveryDate() {
  const client = state.clients[state.currentClientId];
  if (!client) {
    showAlert('Sense client', 'Selecciona un client primer', '⚠️');
    return;
  }
  const currentDate = client.deliveryDate ? new Date(client.deliveryDate).toISOString().split('T')[0] : '';
  if ($('inputDeliveryDate')) $('inputDeliveryDate').value = currentDate;
  openModal('modalDeliveryDate');
}

function saveDeliveryDate() {
  const client = state.clients[state.currentClientId];
  if (!client) return;
  const dateValue = $('inputDeliveryDate').value;
  client.deliveryDate = dateValue || null;
  areTasksInitialized = false;
  save();
  updateUI();
  closeModal('modalDeliveryDate');
  showAlert('Data desada', dateValue ? 'Data establerta' : 'Data eliminada', '✅');
}

/* ================= UI ================= */
function updateUI() {
  const client = state.currentClientId ? state.clients[state.currentClientId] : null;
  
  if ($("clientName")) {
    $("clientName").textContent = client ? `Client: ${client.name}${client.active ? "" : " (tancat)"}` : "Sense client actiu";
  }
  if ($("activityName")) {
    $("activityName").textContent = state.currentActivity ? activityLabel(state.currentActivity) : "—";
  }
  if ($("timer")) {
    $("timer").textContent = client && client.active ? formatTime(state.sessionElapsed) : "00:00:00";
  }
  if ($("clientTotal")) {
    $("clientTotal").textContent = client ? `Total client: ${formatTime(client.total)}` : "";
  }
  
  if ($("billableTimeBox")) {
    if (client && state.focusSchedule.enabled) {
      $("billableTimeBox").textContent = `💰 Facturable: ${formatTime(client.billableTime || 0)}`;
      $("billableTimeBox").style.display = "block";
    } else {
      $("billableTimeBox").style.display = "none";
    }
  }
  
  if ($("versionBox")) {
    $("versionBox").style.display = state.isFull ? "none" : "block";
  }
  
  const exitBtn = $("exitClientFloating");
  if (exitBtn) {
    exitBtn.classList.toggle('hidden', !client);
  }
  
  const deletePanel = $("deleteClientPanel");
  if (deletePanel) {
    deletePanel.style.display = (client && !client.active) ? "block" : "none";
  }
  
  updateWorkpad();
  updateTasks();
  renderPhotoGallery();
}

/* ================= CLIENTS ================= */
function newClient() {
  const activeClients = Object.values(state.clients).filter(c => c.active);
  if (!state.isFull && activeClients.length >= 2) {
    showAlert('Versió demo', 'Màxim 2 clients actius.\n\nActiva la versió completa!', '🔒');
    return;
  }
  if ($('newClientInput')) $('newClientInput').value = '';
  openModal('modalNewClient');
}

function confirmNewClient() {
  const name = $('newClientInput').value.trim();
  if (!name) return;
  const id = uid();
  state.clients[id] = {
    id, name,
    createdAt: Date.now(),
    active: true,
    total: 0,
    billableTime: 0,
    activities: {},
    photos: [],
    notes: "",
    deliveryDate: null,
    extraHours: [],
    tasks: { urgent: "", important: "", later: "" }
  };
  state.currentClientId = id;
  state.currentActivity = ACTIVITIES.WORK;
  state.sessionElapsed = 0;
  state.lastTick = Date.now();
  isWorkpadInitialized = false;
  areTasksInitialized = false;
  save();
  updateUI();
  closeModal('modalNewClient');
}

function changeClient() {
  const actives = Object.values(state.clients).filter(c => c.active);
  if (!actives.length) {
    showAlert('Sense clients', 'No hi ha clients actius', '⚠️');
    return;
  }
  const list = $('activeClientsList');
  if (!list) return;
  list.innerHTML = '';
  actives.forEach(client => {
    const item = document.createElement('div');
    item.className = 'client-item';
    item.innerHTML = `
      <div class="client-name">${client.name}</div>
      <div class="client-time">Total: ${formatTime(client.total)}</div>
    `;
    item.onclick = () => selectClient(client.id);
    list.appendChild(item);
  });
  openModal('modalChangeClient');
}

function selectClient(clientId) {
  state.currentClientId = clientId;
  if (!state.currentActivity) {
    state.currentActivity = ACTIVITIES.WORK;
    state.sessionElapsed = 0;
    state.lastTick = Date.now();
  }
  isWorkpadInitialized = false;
  areTasksInitialized = false;
  save();
  updateUI();
  closeModal('modalChangeClient');
}

function closeClient() {
  const client = state.clients[state.currentClientId];
  if (!client) return;
  if ($('closeClientText')) {
    $('closeClientText').textContent = `Client: ${client.name}\nTemps total: ${formatTime(client.total)}`;
  }
  openModal('modalCloseClient');
}

function confirmCloseClient() {
  const client = state.clients[state.currentClientId];
  if (!client) return;
  client.active = false;
  state.currentClientId = null;
  state.currentActivity = null;
  state.lastTick = null;
  isWorkpadInitialized = false;
  areTasksInitialized = false;
  save();
  updateUI();
  closeModal('modalCloseClient');
  showAlert('Client tancat', `${client.name}\nTemps: ${formatTime(client.total)}`, '✅');
}

function exitClient() {
  state.currentClientId = null;
  state.currentActivity = null;
  state.lastTick = null;
  save();
  updateUI();
}

/* ================= HISTÈRIC ================= */
function showHistory() {
  const closed = Object.values(state.clients).filter(c => !c.active);
  if (!closed.length) {
    showAlert('Sense històric', 'No hi ha clients tancats', 'ℹ️');
    return;
  }
  const list = $('historyClientsList');
  if (!list) return;
  list.innerHTML = '';
  closed.forEach(client => {
    const item = document.createElement('div');
    item.className = 'client-item';
    item.innerHTML = `
      <div class="client-name">${client.name}</div>
      <div class="client-time">Total: ${formatTime(client.total)} • ${client.photos.length} fotos</div>
    `;
    item.onclick = () => {
      state.currentClientId = client.id;
      state.currentActivity = null;
      state.sessionElapsed = 0;
      state.lastTick = null;
      isWorkpadInitialized = false;
      areTasksInitialized = false;
      updateUI();
      closeModal('modalHistory');
    };
    list.appendChild(item);
  });
  openModal('modalHistory');
}

/* ================= ESBORRAR CLIENT ================= */
function deleteCurrentClient() {
  const client = state.clients[state.currentClientId];
  if (!client || client.active) return;
  if ($('deleteClientText')) {
    $('deleteClientText').textContent = `Client: ${client.name}\nTemps: ${formatTime(client.total)}\n\nAquesta acció no es pot desfer.`;
  }
  if ($('inputDeleteConfirm')) $('inputDeleteConfirm').value = '';
  openModal('modalDeleteClient');
}

function confirmDeleteClient() {
  const confirm = $('inputDeleteConfirm').value.trim().toUpperCase();
  if (confirm !== 'ESBORRAR') {
    showAlert('Error', 'Has d\'escriure ESBORRAR', '⚠️');
    return;
  }
  delete state.clients[state.currentClientId];
  state.currentClientId = null;
  state.currentActivity = null;
  save();
  updateUI();
  closeModal('modalDeleteClient');
  showAlert('Client eliminat', 'Eliminat definitivament', '🗑️');
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
  if (!gallery) return;
  gallery.innerHTML = "";
  const client = state.clients[state.currentClientId];
  if (!client || !client.photos.length) return;
  [...client.photos].sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(p => {
    const img = document.createElement("img");
    img.src = p.data;
    img.className = "photo-thumb";
    img.onclick = () => {
      const w = window.open();
      if (w) w.document.write(`<img src="${p.data}" style="width:100%;background:#000">`);
    };
    img.oncontextmenu = (e) => {
      e.preventDefault();
      photoToDelete = p.id;
      openModal('modalDeletePhoto');
    };
    gallery.appendChild(img);
  });
}

function confirmDeletePhoto() {
  if (!photoToDelete) return;
  const client = state.clients[state.currentClientId];
  if (!client) return;
  client.photos = client.photos.filter(f => f.id !== photoToDelete);
  photoToDelete = null;
  save();
  renderPhotoGallery();
  closeModal('modalDeletePhoto');
}

/* ================= ENFOCAMENT ================= */
function showFocus() {
  const total = Object.values(state.focus).reduce((a, b) => a + b, 0);
  if (!total) {
    showAlert('Sense dades', 'Encara no hi ha dades d\'enfocament avui', 'ℹ️');
    return;
  }
  if ($('modalUserName')) $('modalUserName').textContent = userName;
  if ($('modalTotalTime')) $('modalTotalTime').textContent = formatTime(total);
  const list = $('modalActivityList');
  if (list) {
    list.innerHTML = '';
    for (const act in state.focus) {
      const seconds = state.focus[act];
      const actPct = Math.round((seconds / total) * 100);
      const item = document.createElement('div');
      item.className = 'activity-item';
      item.innerHTML = `
        <span class="activity-name">${activityLabel(act)}</span>
        <div class="activity-stats">
          <span class="activity-time">${formatTime(seconds)}</span>
          <span class="activity-percent">${actPct}%</span>
        </div>
      `;
      list.appendChild(item);
    }
  }
  openModal('modalEnfoque');
}

/* ================= HORARI ================= */
function openScheduleModal() {
  const checkbox = $('scheduleEnabled');
  const config = $('scheduleConfig');
  if (checkbox) {
    checkbox.checked = state.focusSchedule.enabled;
    checkbox.onchange = () => {
      if (config) config.style.display = checkbox.checked ? 'block' : 'none';
    };
  }
  if ($('scheduleStart')) $('scheduleStart').value = state.focusSchedule.start;
  if ($('scheduleEnd')) $('scheduleEnd').value = state.focusSchedule.end;
  if (config) config.style.display = state.focusSchedule.enabled ? 'block' : 'none';
  openModal('modalSchedule');
}

function applyPreset(start, end) {
  if ($('scheduleStart')) $('scheduleStart').value = start;
  if ($('scheduleEnd')) $('scheduleEnd').value = end;
}

function saveScheduleConfig() {
  const enabled = $('scheduleEnabled')?.checked || false;
  const start = $('scheduleStart')?.value || "09:00";
  const end = $('scheduleEnd')?.value || "17:00";
  state.focusSchedule = { enabled, start, end };
  save();
  closeModal('modalSchedule');
  showAlert('Configuració desada', enabled ? `Horari: ${start} - ${end}` : 'Horari desactivat', '✅');
}

/* ================= CSV ================= */
function exportTodayCSV() {
  let csv = "Usuari,Client,Temps,Notes\n";
  Object.values(state.clients).forEach(c => {
    const notes = (c.notes || '').replace(/[\n\r]/g, ' ').replace(/"/g, '""');
    csv += `${userName},"${c.name}",${formatTime(c.total)},"${notes}"\n`;
  });
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `focowork_${todayKey()}.csv`;
  a.click();
  showAlert('CSV exportat', 'Arxiu descarregat', '📄');
}

/* ================= HORES EXTRES ================= */
function addExtraHours() {
  const client = state.clients[state.currentClientId];
  if (!client) {
    showAlert('Sense client', 'Selecciona un client primer', '⚠️');
    return;
  }
  if ($('inputExtraHours')) $('inputExtraHours').value = '';
  if ($('inputExtraDescription')) $('inputExtraDescription').value = '';
  openModal('modalExtraHours');
}

function saveExtraHours() {
  const client = state.clients[state.currentClientId];
  if (!client) return;
  const hours = parseFloat($('inputExtraHours').value);
  const description = $('inputExtraDescription').value.trim();
  if (!hours || hours <= 0) {
    showAlert('Error', 'Introdueix hores vàlides', '⚠️');
    return;
  }
  if (!client.extraHours) client.extraHours = [];
  const extraEntry = {
    id: uid(),
    date: new Date().toISOString(),
    hours: hours,
    seconds: Math.round(hours * 3600),
    description: description || 'Hores extres'
  };
  client.extraHours.push(extraEntry);
  client.billableTime = (client.billableTime || 0) + extraEntry.seconds;
  save();
  closeModal('modalExtraHours');
  showAlert('Hores afegides', `${hours}h afegides`, '✅');
}

function showExtraHours() {
  const client = state.clients[state.currentClientId];
  if (!client || !client.extraHours?.length) {
    showAlert('Sense hores extres', 'No hi ha hores registrades', 'ℹ️');
    return;
  }
  const list = $('extraHoursList');
  if (!list) return;
  list.innerHTML = '';
  let totalExtra = 0;
  client.extraHours.forEach(entry => {
    totalExtra += entry.seconds;
    const item = document.createElement('div');
    item.className = 'extra-hour-item';
    item.innerHTML = `
      <div>${entry.hours}h - ${entry.description}</div>
      <small>${new Date(entry.date).toLocaleDateString('ca-ES')}</small>
    `;
    list.appendChild(item);
  });
  if ($('extraHoursTotal')) $('extraHoursTotal').textContent = formatTime(totalExtra);
  openModal('modalViewExtraHours');
}

/* ================= INFORME ================= */
function generateReport() {
  const client = state.clients[state.currentClientId];
  if (!client) {
    showAlert('Sense client', 'Selecciona un client primer', '⚠️');
    return;
  }
  const reportText = 
    `📋 INFORME DE PROJECTE\n\n` +
    `👤 CLIENT: ${client.name}\n` +
    `📅 Data: ${new Date().toLocaleDateString('ca-ES')}\n` +
    `⏱️ TEMPS TOTAL: ${formatTime(client.total)}\n` +
    `💰 FACTURABLE: ${formatTime(client.billableTime || 0)}\n` +
    `📷 FOTOS: ${client.photos.length}\n` +
    (client.notes ? `\n📝 NOTES:\n${client.notes}\n` : '') +
    `\nGenerat amb FocoWork v${APP_VERSION}`;
  
  if ($('reportContent')) $('reportContent').textContent = reportText;
  openModal('modalReport');
}

function copyReport() {
  const reportText = $('reportContent').textContent;
  navigator.clipboard.writeText(reportText).then(() => {
    showAlert('Copiat', 'Informe copiat', '✅');
  }).catch(() => {
    showAlert('Error', 'No s\'ha pogut copiar', '⚠️');
  });
}

async function shareReport() {
  const reportText = $('reportContent').textContent;
  if (navigator.share) {
    try {
      await navigator.share({ text: reportText });
    } catch (err) {
      copyReport();
    }
  } else {
    copyReport();
  }
}

/* ================= EXPORTAR/IMPORTAR ================= */
function exportCurrentWork() {
  const client = state.clients[state.currentClientId];
  if (!client) {
    showAlert('Sense client', 'Selecciona un client', '⚠️');
    return;
  }
  const workData = {
    version: APP_VERSION,
    exportDate: new Date().toISOString(),
    client: client,
    userName: userName
  };
  const blob = new Blob([JSON.stringify(workData, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `treball_${client.name.replace(/[^a-z0-9]/gi, '_')}_${todayKey()}.focowork`;
  a.click();
  showAlert('Treball desat', 'Arxiu descarregat', '💾');
}

function importWork() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.focowork,.json';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const fileData = JSON.parse(text);
      if (fileData.type === 'full_backup') {
        handleBackupFile(fileData);
        return;
      }
      if (!fileData.client) {
        showAlert('Arxiu invàlid', 'Format incorrecte', '❌');
        return;
      }
      const newId = uid();
      state.clients[newId] = { ...fileData.client, id: newId, active: true };
      state.currentClientId = newId;
      state.currentActivity = ACTIVITIES.WORK;
      state.sessionElapsed = 0;
      state.lastTick = Date.now();
      isWorkpadInitialized = false;
      areTasksInitialized = false;
      save();
      updateUI();
      showAlert('Treball importat', 'Client recuperat correctament', '✅');
    } catch (err) {
      showAlert('Error', 'No s\'ha pogut llegir', '❌');
    }
  };
  input.click();
}

function exportAllData() {
  const exportData = {
    version: APP_VERSION,
    exportDate: new Date().toISOString(),
    userName: userName,
    state: state,
    license: state.license,
    type: 'full_backup'
  };


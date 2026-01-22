/*************************************************
 * FOCUSWORK – app.js (V3.1 COMPLET)
 *************************************************/

/* ================= CONFIG ================= */
const WHATSAPP_PHONE = "34649383847";
const APP_VERSION = "3.1";
const LICENSE_SECRET = "FW2025-SECURE-KEY-X7Y9Z";
const GOOGLE_CLIENT_ID = '339892728740-ghh878p6g57relsi79cprbti5vac1hd4.apps.googleusercontent.com';

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

/* ================= HELPERS ================= */
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
  focusSchedule: { enabled: false, start: "09:00", end: "17:00" },
  lastBackupDate: null,
  autoDriveBackup: false
};

function save() {
  localStorage.setItem("focowork_state", JSON.stringify(state));
  if (state.currentClientId) scheduleAutoBackup();
}

/* ================= RECORDATORI DE BACKUP ================= */
function updateBackupReminder() {
  const reminderEl = document.createElement('div');
  reminderEl.id = 'backupReminder';
  reminderEl.style.cssText = `
    font-size: 12px;
    text-align: center;
    margin-top: 8px;
    padding: 8px 12px;
    border-radius: 8px;
    transition: all 0.3s ease;
  `;
  
  const now = Date.now();
  const lastBackup = state.lastBackupDate ? new Date(state.lastBackupDate).getTime() : 0;
  const hoursSinceBackup = (now - lastBackup) / (1000 * 60 * 60);
  
  if (!state.lastBackupDate) {
    // Mai s'ha fet backup
    reminderEl.style.background = 'rgba(251, 191, 36, 0.15)';
    reminderEl.style.color = '#fbbf24';
    reminderEl.style.border = '1px solid rgba(251, 191, 36, 0.3)';
    reminderEl.innerHTML = '⚠️ No s\'ha fet mai còpia de seguretat';
  } else if (hoursSinceBackup >= 24) {
    // Fa més de 24h
    const daysSince = Math.floor(hoursSinceBackup / 24);
    reminderEl.style.background = 'rgba(239, 68, 68, 0.15)';
    reminderEl.style.color = '#ef4444';
    reminderEl.style.border = '1px solid rgba(239, 68, 68, 0.3)';
    reminderEl.innerHTML = `🔴 Última còpia fa ${daysSince} ${daysSince === 1 ? 'dia' : 'dies'}`;
  } else {
    // Menys de 24h
    const hoursLeft = Math.ceil(24 - hoursSinceBackup);
    reminderEl.style.background = 'rgba(16, 185, 129, 0.15)';
    reminderEl.style.color = '#10b981';
    reminderEl.style.border = '1px solid rgba(16, 185, 129, 0.3)';
    reminderEl.innerHTML = `✅ Última còpia fa ${Math.floor(hoursSinceBackup)}h`;
  }
  
  // Inserir abans dels botons d'acció
  const versionBox = document.querySelector('.version-box');
  if (versionBox) {
    const existingReminder = document.getElementById('backupReminder');
    if (existingReminder) existingReminder.remove();
    versionBox.insertBefore(reminderEl, versionBox.firstChild);
  }
}

function markBackupDone() {
  state.lastBackupDate = new Date().toISOString();
  save();
  updateBackupReminder();
}

/* ================= AUTO-BACKUP ================= */
let autoBackupTimeout = null;
let lastAutoBackupTime = 0;

const AUTO_BACKUP_INTERVAL = 5 * 60 * 1000;
const AUTO_BACKUP_DELAY = 60 * 1000;

function scheduleAutoBackup() {
  const now = Date.now();
  if (now - lastAutoBackupTime < AUTO_BACKUP_INTERVAL) return;
  clearTimeout(autoBackupTimeout);
  autoBackupTimeout = setTimeout(() => {
    if (state.currentClientId && state.clients[state.currentClientId]) {
      performAutoBackup();
      lastAutoBackupTime = Date.now();
    }
  }, AUTO_BACKUP_DELAY);
}

function performAutoBackup() {
  const client = state.clients[state.currentClientId];
  if (!client) return;
  const backup = {
    version: APP_VERSION,
    timestamp: new Date().toISOString(),
    clientId: client.id,
    client: client
  };
  try {
    localStorage.setItem(`focowork_autobackup_${client.id}`, JSON.stringify(backup));
    console.log('AUTO-BACKUP fet:', client.name, new Date().toLocaleTimeString());
  } catch (e) {
    console.warn('Auto-backup ha fallat:', e);
  }
}

/* ================= BACKUPS AUTOMÀTICS A MITJANIT ================= */
function performFullAutoBackup() {
  const backup = {
    version: APP_VERSION,
    timestamp: new Date().toISOString(),
    userName: userName,
    state: JSON.parse(JSON.stringify(state)),
    type: 'full_backup'
  };
  try {
    localStorage.setItem('focuswork_full_autobackup', JSON.stringify(backup));
  } catch (e) {
    console.warn('Backup complet automàtic ha fallat:', e);
  }
  if (state.autoDriveBackup && typeof exportAllToDrive === 'function') {
    exportAllToDrive(true);
  }
  setTimeout(performFullAutoBackup, 24 * 60 * 60 * 1000);
}

function scheduleFullAutoBackup() {
  const now = new Date();
  const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
  setTimeout(performFullAutoBackup, nextMidnight - now);
}

/* ================= CONFIGURACIÓ DE BACKUPS ================= */
function openBackupConfigModal() {
  const checkbox = $('autoDriveBackupCheckbox');
  if (checkbox) checkbox.checked = state.autoDriveBackup;
  openModal('modalBackupConfig');
}

function saveBackupConfig() {
  const checkbox = $('autoDriveBackupCheckbox');
  if (checkbox) {
    state.autoDriveBackup = checkbox.checked;
    save();
    closeModal('modalBackupConfig');
    showAlert('Configuració desada', state.autoDriveBackup ? 'Backups automàtics a Drive activats' : 'Backups automàtics a Drive desactivats', '✅');
  }
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
  closeModal('modalExportBeforeClose');
  showAlert('Client tancat', `${client.name}\nTemps: ${formatTime(client.total)}`, '✅');
}

function exitClient() {
  state.currentClientId = null;
  state.currentActivity = null;
  state.lastTick = null;
  save();
  updateUI();
}

/* ================= HISTÒRIC ================= */
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
  URL.revokeObjectURL(a.href);
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
  const dataSize = getStorageSize();
  const exportData = {
    version: APP_VERSION,
    exportDate: new Date().toISOString(),
    userName: userName,
    state: state,
    license: state.license,
    type: 'full_backup'
  };
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `focowork_complet_${todayKey()}.focowork`;
  a.click();
  URL.revokeObjectURL(a.href);
  markBackupDone();
  showAlert('Backup complet', `Totes les teves dades han estat exportades.\n\nMida: ${dataSize}\n\nGuarda aquest arxiu en un lloc segur!`, '💾');
}

function handleBackupFile(backupData) {
  if (!backupData.state) {
    showAlert('Arxiu invàlid', 'Backup corromput', '❌');
    return;
  }
  const clientCount = Object.keys(backupData.state.clients).length;
  const activeCount = Object.values(backupData.state.clients).filter(c => c.active).length;
  if ($('importBackupClients')) $('importBackupClients').textContent = clientCount;
  if ($('importBackupActive')) $('importBackupActive').textContent = activeCount;
  if ($('importBackupDate')) $('importBackupDate').textContent = new Date(backupData.exportDate).toLocaleDateString();
  if ($('importBackupLicense')) $('importBackupLicense').textContent = backupData.license ? '✔ Sí' : '– No';
  window.pendingBackup = backupData;
  openModal('modalImportBackup');
}

function confirmImportBackup() {
  if (!window.pendingBackup) return;
  const backupData = window.pendingBackup;
  if (backupData.state) state = backupData.state;
  if (backupData.userName) {
    userName = backupData.userName;
    localStorage.setItem("focowork_user_name", userName);
  }
  if (backupData.license) {
    state.license = backupData.license;
    state.isFull = true;
  }
  isWorkpadInitialized = false;
  areTasksInitialized = false;
  save();
  updateUI();
  closeModal('modalImportBackup');
  showAlert('Backup restaurat', 'Dades recuperades correctament', '🎉');
  window.pendingBackup = null;
  setTimeout(() => location.reload(), 2000);
}

/* ================= UTILITATS D'EMMAGATZEMATGE ================= */
function getStorageSize() {
  let total = 0;
  for (let key in localStorage) {
    if (localStorage.hasOwnProperty(key)) {
      total += localStorage[key].length + key.length;
    }
  }
  if (total < 1024) return total + ' bytes';
  if (total < 1024 * 1024) return (total / 1024).toFixed(2) + ' KB';
  return (total / (1024 * 1024)).toFixed(2) + ' MB';
}

function showStorageInfo() {
  const size = getStorageSize();
  const clientCount = Object.keys(state.clients).length;
  const activeCount = Object.values(state.clients).filter(c => c.active).length;
  const closedCount = clientCount - activeCount;
  let totalPhotos = 0;
  Object.values(state.clients).forEach(c => totalPhotos += c.photos.length);
  const avgPhotoSize = totalPhotos > 0 ? '~' + (parseFloat(size) / totalPhotos).toFixed(0) + ' KB/foto' : 'N/A';
  showAlert('Ús d\'emmagatzematge', `📊 Espai usat: ${size}\n\n👥 Clients totals: ${clientCount}\n   • Actius: ${activeCount}\n   • Tancats: ${closedCount}\n\n📷 Fotos totals: ${totalPhotos}\n   ${avgPhotoSize}\n\n💡 Consell: Exporta i esborra clients tancats per alliberar espai`, '📊');
}

function resetTodayFocus() {
  state.focus = {};
  state.day = todayKey();
  save();
  showAlert('Enfocament reiniciat', 'Les dades d\'enfocament d\'avui han estat reiniciades.\n\nAra només comptabilitzarà temps dins l\'horari configurat.', '✅');
}

function confirmImport() {
  if (!window.pendingImport) return;
  const workData = window.pendingImport;
  const newId = uid();
  state.clients[newId] = { ...workData.client, id: newId, active: true };
  state.currentClientId = newId;
  state.currentActivity = ACTIVITIES.WORK;
  state.sessionElapsed = 0;
  state.lastTick = Date.now();
  isWorkpadInitialized = false;
  areTasksInitialized = false;
  save();
  updateUI();
  closeModal('modalImportWork');
  showAlert('Treball importat', `Client "${workData.client.name}" importat correctament`, '✅');
  window.pendingImport = null;
}

function exportAndClose() {
  exportCurrentWork();
  setTimeout(confirmCloseClient, 500);
}

function exportAndClose() {
  exportCurrentWork();
  setTimeout(confirmCloseClient, 500);
}

/* ================= EVENT LISTENERS ================= */
document.addEventListener('DOMContentLoaded', () => {
  // BOTONS PRINCIPALS
  if ($('focusPriorityBtn')) $('focusPriorityBtn').onclick = changeClient;
  if ($('newClientBtn')) $('newClientBtn').onclick = newClient;
  if ($('changeClient')) $('changeClient').onclick = changeClient;
  if ($('historyBtn')) $('historyBtn').onclick = showHistory;
  if ($('closeClient')) $('closeClient').onclick = closeClient;
  if ($('exitClientFloating')) $('exitClientFloating').onclick = exitClient;
  if ($('setDeliveryDateBtn')) $('setDeliveryDateBtn').onclick = setDeliveryDate;
  if ($('addExtraHoursBtn')) $('addExtraHoursBtn').onclick = addExtraHours;
  if ($('viewExtraHoursBtn')) $('viewExtraHoursBtn').onclick = showExtraHours;
  if ($('generateReportBtn')) $('generateReportBtn').onclick = generateReport;
  if ($('cameraBtn')) $('cameraBtn').onclick = addPhotoToClient;
  if ($('deleteClientBtn')) $('deleteClientBtn').onclick = deleteCurrentClient;
  if ($('exportWorkBtn')) $('exportWorkBtn').onclick = exportCurrentWork;
  if ($('importWorkBtn')) $('importWorkBtn').onclick = importWork;
  if ($('exportAllBtn')) $('exportAllBtn').onclick = exportAllData;
  if ($('loadLicenseBtn')) $('loadLicenseBtn').onclick = loadLicenseFile;
  if ($('requestLicenseBtn')) $('requestLicenseBtn').onclick = requestLicense;
  if ($('focusBtn')) $('focusBtn').onclick = showFocus;
  if ($('scheduleBtn')) $('scheduleBtn').onclick = openScheduleModal;
  if ($('todayBtn')) $('todayBtn').onclick = exportTodayCSV;
  
  // TANCAR MODALS CLICANT FORA
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal(overlay.id);
    });
  });
  
  // INPUT NOU CLIENT
  if ($('newClientInput')) {
    $('newClientInput').addEventListener('keypress', e => {
      if (e.key === 'Enter') confirmNewClient();
    });
  }
  
  // INPUT ESBORRAR CLIENT
  if ($('inputDeleteConfirm')) {
    $('inputDeleteConfirm').addEventListener('keypress', e => {
      if (e.key === 'Enter') confirmDeleteClient();
    });
  }
  
  // CERCA A L'HISTÒRIC
  if ($('searchHistory')) {
    $('searchHistory').addEventListener('input', e => {
      const query = e.target.value.toLowerCase();
      const closed = Object.values(state.clients).filter(c => !c.active);
      const filtered = closed.filter(c =>
        c.name.toLowerCase().includes(query) ||
        (c.notes || '').toLowerCase().includes(query)
      );
      const list = $('historyClientsList');
      if (!list) return;
      list.innerHTML = '';
      if (!filtered.length) {
        list.innerHTML = '<p class="modal-text" style="opacity: 0.6; text-align: center;">Sense resultats</p>';
        return;
      }
      filtered.forEach(client => {
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
    });
  }
  
  // ACTUALITZAR UI INICIAL
  updateUI();
  updateBackupReminder();
  
  // Actualitzar recordatori cada hora
  setInterval(updateBackupReminder, 60 * 60 * 1000);
  
  // VERIFICAR LLICÈNCIA CADUCADA
  if (state.license && state.license.expiryDate) {
    const expiry = new Date(state.license.expiryDate);
    if (expiry < new Date()) {
      state.isFull = false;
      state.license = null;
      save();
      showAlert('Llicència caducada', 'La teva llicència ha caducat. Contacta per renovar-la.', '⏰');
    }
  }
  
  // PROGRAMAR BACKUP AUTOMÀTIC
  scheduleFullAutoBackup();
});

/* ================= FUNCIONS GLOBALS PER ALS MODALS ================= */
window.closeModal = closeModal;
window.confirmNewClient = confirmNewClient;
window.saveDeliveryDate = saveDeliveryDate;
window.saveExtraHours = saveExtraHours;
window.copyReport = copyReport;
window.shareReport = shareReport;
window.confirmCloseClient = confirmCloseClient;
window.confirmImport = confirmImport;
window.confirmImportBackup = confirmImportBackup;
window.confirmDeleteClient = confirmDeleteClient;
window.confirmDeletePhoto = confirmDeletePhoto;
window.applyPreset = applyPreset;
window.saveScheduleConfig = saveScheduleConfig;
window.exportAndClose = exportAndClose;

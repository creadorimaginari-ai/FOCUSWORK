/*************************************************
 * FOCUSWORK – app.js (V3.1 CORREGIT)
 * - Totes les funcions bàsiques restaurades
 * - Sistema de tasques funcional
 * - Workpad funcional
 * - Llicències, backups i Google Drive
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
  switch (act) {
    case ACTIVITIES.WORK: return "Feina";
    case ACTIVITIES.PHONE: return "Trucades";
    case ACTIVITIES.CLIENT: return "Reunions";
    case ACTIVITIES.VISIT: return "Visitant";
    case ACTIVITIES.OTHER: return "Altres";
    default: return act;
  }
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
  $('alertTitle').textContent = title;
  $('alertText').textContent = message;
  $('alertIcon').textContent = icon;
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
  autoDriveBackup: false
};

function save() {
  localStorage.setItem("focowork_state", JSON.stringify(state));
  if (state.currentClientId) scheduleAutoBackup();
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
    localStorage.setItem(
      `focowork_autobackup_${client.id}`,
      JSON.stringify(backup)
    );

    console.log(
      'AUTO-BACKUP fet:',
      client.name,
      new Date().toLocaleTimeString()
    );
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

  if (state.autoDriveBackup) exportAllToDrive(true);

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

/* ================= SISTEMA DE LLICÈNCIES ================= */
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

      if (!license.signature || !license.clientId) {
        showAlert('Arxiu invàlid', 'Aquest no és un arxiu de llicència vàlid', '❌');
        return;
      }

      if (license.expiryDate) {
        const expiry = new Date(license.expiryDate);
        if (expiry < new Date()) {
          showAlert('Llicència caducada', 'Aquesta llicència ha caducat el ' + expiry.toLocaleDateString(), '⏰');
          return;
        }
      }

      state.isFull = true;
      state.license = license;
      save();
      updateUI();

      const expiryText = license.expiryDate
        ? `Vàlida fins: ${new Date(license.expiryDate).toLocaleDateString()}`
        : 'Sense límit de temps';

      showAlert(
        'Llicència activada!',
        `FocoWork complet activat\n\nClient: ${license.clientName}\n${expiryText}\n\nGaudeix de clients il·limitats!`,
        '🎉'
      );
    } catch (err) {
      showAlert('Error', 'No s\'ha pogut llegir l\'arxiu de llicència', '❌');
    }
  };

  input.click();
}

function requestLicense() {
  const msg = `Hola, necessito una llicència de FocoWork complet`;
  window.open(`https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(msg)}`);
}

/* ================= EXPORTACIÓ/IMPORTACIÓ ================= */
function exportCurrentWork() {
  const client = state.clients[state.currentClientId];
  if (!client) {
    showAlert('Sense client', 'Selecciona un client primer', '⚠️');
    return;
  }

  const workData = {
    version: APP_VERSION,
    exportDate: new Date().toISOString(),
    client: client,
    userName: userName
  };

  const dataStr = JSON.stringify(workData, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `treball_${client.name.replace(/[^a-z0-9]/gi, '_')}_${todayKey()}.focowork`;
  a.click();

  URL.revokeObjectURL(url);

  showAlert('Treball desat', 'L\'arxiu s\'ha descarregat correctament.\n\nGuarda\'l en un lloc segur!', '💾');
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

      if (!fileData.client || !fileData.version) {
        showAlert('Arxiu invàlid', 'Aquest arxiu no és un treball vàlid de FocoWork', '❌');
        return;
      }

      $('importClientName').textContent = fileData.client.name;
      $('importClientTime').textContent = formatTime(fileData.client.total);
      $('importClientPhotos').textContent = fileData.client.photos.length;
      $('importClientNotes').textContent = fileData.client.notes ? '✓ Sí' : '— No';

      window.pendingImport = fileData;

      openModal('modalImportWork');
    } catch (err) {
      showAlert('Error', 'No s\'ha pogut llegir l\'arxiu', '❌');
    }
  };

  input.click();
}

function confirmImport() {
  if (!window.pendingImport) return;

  const workData = window.pendingImport;
  const newId = uid();

  state.clients[newId] = {
    ...workData.client,
    id: newId,
    active: true
  };

  state.currentClientId = newId;
  state.currentActivity = ACTIVITIES.WORK;
  state.sessionElapsed = 0;
  state.lastTick = Date.now();
  isWorkpadInitialized = false;
  areTasksInitialized = false;

  save();
  updateUI();
  closeModal('modalImportWork');

  showAlert('Treball importat', `Client "${workData.client.name}" importat correctament\n\nTemps: ${formatTime(workData.client.total)}\nFotos: ${workData.client.photos.length}`, '✅');

  window.pendingImport = null;
}

/* ================= BACKUP COMPLET ================= */
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

  const dataStr = JSON.stringify(exportData, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `focowork_complet_${todayKey()}.focowork`;
  a.click();

  URL.revokeObjectURL(url);

  showAlert('Backup complet', `Totes les teves dades han estat exportades.\n\nMida: ${dataSize}\n\nGuarda aquest arxiu en un lloc segur!`, '💾');
}

function handleBackupFile(backupData) {
  if (!backupData.state || !backupData.version) {
    showAlert('Arxiu invàlid', 'Aquest arxiu de backup està corromput', '❌');
    return;
  }

  const clientCount = Object.keys(backupData.state.clients).length;
  const activeCount = Object.values(backupData.state.clients).filter(c => c.active).length;

  $('importBackupClients').textContent = clientCount;
  $('importBackupActive').textContent = activeCount;
  $('importBackupDate').textContent = new Date(backupData.exportDate).toLocaleDateString();
  $('importBackupLicense').textContent = backupData.license ? '✓ Sí' : '— No';

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

  const clientCount = Object.keys(state.clients).length;
  showAlert('Backup restaurat', `✅ Backup complet restaurat correctament\n\n${clientCount} clients recuperats\nLlicència: ${state.license ? 'Activada' : 'No inclosa'}`, '🎉');

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

  showAlert(
    'Ús d\'emmagatzematge',
    `📊 Espai usat: ${size}\n\n` +
    `👥 Clients totals: ${clientCount}\n` +
    `   • Actius: ${activeCount}\n` +
    `   • Tancats: ${closedCount}\n\n` +
    `📷 Fotos totals: ${totalPhotos}\n` +
    `   ${avgPhotoSize}\n\n` +
    `💡 Consell: Exporta i esborra clients tancats per alliberar espai`,
    '📊'
  );
}

function resetTodayFocus() {
  state.focus = {};
  state.day = todayKey();
  save();
  showAlert('Enfocament reiniciat', 'Les dades d\'enfocament d\'avui han estat reiniciades.\n\nAra només comptabilitzarà temps dins l\'horari configurat.', '✅');
}

/* ================= MOTOR DE TEMPS ================= */
function tick() {
  resetDayIfNeeded();

  const client = state.clients[state.currentClientId];
  if (!client || !client.active || !state.currentActivity || !state.lastTick) {
    state.lastTick = Date.now();
    return;
  }

  const now = Date.now();
  const elapsed = Math.floor((now - state.lastTick) / 1000);
  if (elapsed <= 0) return;

  state.lastTick = now;
  state.sessionElapsed += elapsed;
  client.total += elapsed;

  client.activities[state.currentActivity] = (client.activities[state.currentActivity] || 0) + elapsed;

  if (state.focusSchedule.enabled) {
    if (isWithinFocusSchedule()) {
      client.billableTime = (client.billableTime || 0) + elapsed;
      state.focus[state.currentActivity] = (state.focus[state.currentActivity] || 0) + elapsed;
    }
  } else {
    client.billableTime = (client.billableTime || 0) + elapsed;
    state.focus[state.currentActivity] = (state.focus[state.currentActivity] || 0) + elapsed;
  }

  save();
  updateUI();
}

setInterval(tick, 1000);

/* ================= ACTIVITATS ================= */
function setActivity(activity) {
  const client = state.clients[state.currentClientId];
  if (!client || !client.active) {
    showAlert('Sense client', 'Primer selecciona un client actiu', '⚠️');
    return;
  }

  state.currentActivity = activity;
  state.sessionElapsed = 0;
  state.lastTick = Date.now();
  save();
  updateUI();
}

/* ================= WORKPAD ================= */
let workpadTimeout = null;
let isWorkpadInitialized = false;

function updateWorkpad() {
  const workpadArea = $('clientWorkpad');
  const workpadContainer = document.querySelector('.workpad-container');
  const client = state.clients[state.currentClientId];

  if (!workpadArea || !workpadContainer || !client) {
    if (workpadContainer) workpadContainer.style.display = 'none';
    isWorkpadInitialized = false;
    return;
  }

  workpadContainer.style.display = 'block';

  const savedNote = client.notes || '';
  if (workpadArea.value !== savedNote && !isWorkpadInitialized) {
    workpadArea.value = savedNote;
  }

  if (!isWorkpadInitialized) {
    workpadArea.oninput = handleWorkpadInput;
    isWorkpadInitialized = true;
  }
}

function handleWorkpadInput(e) {
  const client = state.clients[state.currentClientId];
  if (!client) return;

  client.notes = e.target.value;
  clearTimeout(workpadTimeout);
  workpadTimeout = setTimeout(save, 1000);
}

/* ================= TASQUES ================= */
let taskTimeouts = { urgent: null, important: null, later: null };
let areTasksInitialized = false;

function updateTasks() {
  const client = state.clients[state.currentClientId];
  
  const urgentArea = $('taskUrgent');
  const importantArea = $('taskImportant');
  const laterArea = $('taskLater');

  if (!urgentArea || !importantArea || !laterArea) return;

  if (!client) {
    urgentArea.style.display = 'none';
    importantArea.style.display = 'none';
    laterArea.style.display = 'none';
    areTasksInitialized = false;
    return;
  }

  urgentArea.style.display = 'block';
  importantArea.style.display = 'block';
  laterArea.style.display = 'block';

  if (!client.tasks) {
    client.tasks = { urgent: "", important: "", later: "" };
  }

  if (!areTasksInitialized) {
    let urgentText = client.tasks.urgent || '';
    
    if (client.deliveryDate) {
      const deliveryDate = new Date(client.deliveryDate);
      const dateStr = deliveryDate.toLocaleDateString('ca-ES', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
      });
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const delivery = new Date(deliveryDate);
      delivery.setHours(0, 0, 0, 0);
      
      const diffDays = Math.ceil((delivery - today) / (1000 * 60 * 60 * 24));
      
      let urgencyPrefix = '';
      if (diffDays < 0) {
        urgencyPrefix = `⚠️ VENÇUT (${Math.abs(diffDays)}d) - ${dateStr}\n`;
      } else if (diffDays === 0) {
        urgencyPrefix = `🔴 AVUI - ${dateStr}\n`;
      } else if (diffDays === 1) {
        urgencyPrefix = `🟡 DEMÀ - ${dateStr}\n`;
      } else if (diffDays <= 3) {
        urgencyPrefix = `🟡 ${diffDays} DIES - ${dateStr}\n`;
      } else {
        urgencyPrefix = `📅 Lliurament: ${dateStr}\n`;
      }
      
      urgentText = urgencyPrefix + (urgentText.replace(/^[⚠️🔴🟡📅].*\n/, ''));
    }
    
    urgentArea.value = urgentText;
    importantArea.value = client.tasks.important || '';
    laterArea.value = client.tasks.later || '';

    urgentArea.oninput = (e) => handleTaskInput('urgent', e);
    importantArea.oninput = (e) => handleTaskInput('important', e);
    laterArea.oninput = (e) => handleTaskInput('later', e);

    areTasksInitialized = true;
  }
}

function handleTaskInput(taskType, e) {
  const client = state.clients[state.currentClientId];
  if (!client || !client.tasks) return;

  client.tasks[taskType] = e.target.value;

  clearTimeout(taskTimeouts[taskType]);
  taskTimeouts[taskType] = setTimeout(save, 1000);
}

function setDeliveryDate() {
  const client = state.clients[state.currentClientId];
  if (!client) {
    showAlert('Sense client', 'Selecciona un client primer',
'⚠️');
    return;
  }

  const currentDate = client.deliveryDate 
    ? new Date(client.deliveryDate).toISOString().split('T')[0] 
    : '';

  $('inputDeliveryDate').value = currentDate;
  openModal('modalDeliveryDate');

  setTimeout(() => $('inputDeliveryDate').focus(), 300);
}

function saveDeliveryDate() {
  const client = state.clients[state.currentClientId];
  if (!client) return;

  const dateValue = $('inputDeliveryDate').value;
  
  if (dateValue) {
    client.deliveryDate = dateValue;
    showAlert('Data desada', `Data de lliurament establerta per al ${new Date(dateValue).toLocaleDateString('ca-ES')}`, '✅');
  } else {
    client.deliveryDate = null;
    showAlert('Data eliminada', 'S\'ha eliminat la data de lliurament', 'ℹ️');
  }

  areTasksInitialized = false;
  save();
  updateUI();
  closeModal('modalDeliveryDate');
}

/* ================= UI ================= */
function updateUI() {
  const activitiesPanel = $('activitiesPanel');
  const client = state.currentClientId ? state.clients[state.currentClientId] : null;

  if (!state.currentClientId) {
    activitiesPanel?.classList.add('single-activity');
  } else {
    activitiesPanel?.classList.remove('single-activity');
  }

  $("clientName").textContent = client
    ? `Client: ${client.name}${client.active ? "" : " (tancat)"}`
    : "Sense client actiu";

  $("activityName").textContent = state.currentActivity
    ? activityLabel(state.currentActivity)
    : "—";

  $("timer").textContent =
    client && client.active ? formatTime(state.sessionElapsed) : "00:00:00";

  if ($("clientTotal")) {
    $("clientTotal").textContent = client
      ? `Total client: ${formatTime(client.total)}`
      : "";
  }

  if (client && state.focusSchedule.enabled) {
    const billableBox = $("billableTimeBox");
    if (billableBox) {
      const billableTime = client.billableTime || 0;
      billableBox.textContent = `💰 Facturable: ${formatTime(billableTime)}`;
      billableBox.style.display = "block";
    }
  } else if ($("billableTimeBox")) {
    $("billableTimeBox").style.display = "none";
  }

  if (client && client.deliveryDate) {
    updateDeliveryDateDisplay(client);
  } else {
    const deliveryBox = $("deliveryDateBox");
    if (deliveryBox) {
      deliveryBox.style.display = "none";
      deliveryBox.classList.add("hidden");
    }
  }

  document.querySelectorAll(".activity").forEach(btn => {
    btn.classList.toggle(
      "active",
      btn.dataset.activity === state.currentActivity
    );
  });

  if ($("versionBox")) {
    $("versionBox").style.display = state.isFull ? "none" : "block";
  }

  if (state.isFull && state.license) {
    updateLicenseInfo();
  }

  updateFocusScheduleStatus();
  updateWorkpad();
  updateTasks();
  renderPhotoGallery();

  const exitContainer = $("exitClientContainer");
  if (exitContainer) {
    exitContainer.style.display = client ? "block" : "none";
  }
}

function updateDeliveryDateDisplay(client) {
  const deliveryBox = $("deliveryDateBox");
  if (!deliveryBox) {
    console.warn("deliveryDateBox no trobat");
    return;
  }

  if (!client || !client.deliveryDate) {
    deliveryBox.style.display = "none";
    deliveryBox.classList.add("hidden");
    return;
  }

  const deliveryDate = new Date(client.deliveryDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const delivery = new Date(deliveryDate);
  delivery.setHours(0, 0, 0, 0);

  const diffTime = delivery - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  let message = "";
  let className = "delivery-info";

  if (diffDays < 0) {
    message = `⚠️ Lliurament vençut (${Math.abs(diffDays)} dies)`;
    className = "delivery-overdue";
  } else if (diffDays === 0) {
    message = "🔴 Lliurament AVUI!";
    className = "delivery-today";
  } else if (diffDays === 1) {
    message = "🟡 Lliurament DEMÀ";
    className = "delivery-tomorrow";
  } else if (diffDays <= 3) {
    message = `🟡 Lliurament en ${diffDays} dies`;
    className = "delivery-soon";
  } else {
    message = `📅 Lliurament: ${deliveryDate.toLocaleDateString(
      "ca-ES",
      { day: "2-digit", month: "2-digit", year: "numeric" }
    )}`;
    className = "delivery-normal";
  }

  deliveryBox.textContent = message;
  deliveryBox.className = className;
  deliveryBox.classList.remove("hidden");
  deliveryBox.style.display = "block";
}

function updateLicenseInfo() {
  const infoEl = $("licenseInfo");
  if (!infoEl || !state.license) return;

  const expiryText = state.license.expiryDate
    ? `Vàlida fins: ${new Date(state.license.expiryDate).toLocaleDateString()}`
    : "Sense límit";

  infoEl.textContent = `✓ Llicència activa - ${state.license.clientName} - ${expiryText}`;
  infoEl.style.display = "block";
}

function updateFocusScheduleStatus() {
  const statusEl = $("focusScheduleStatus");
  if (!statusEl) return;

  if (state.focusSchedule.enabled && !isWithinFocusSchedule()) {
    statusEl.textContent = "⏳ Fora d'horari d'enfocament";
    statusEl.style.display = "block";
  } else {
    statusEl.style.display = "none";
  }
}

/* ================= CLIENTS ================= */
function newClient() {
  const activeClients = Object.values(state.clients).filter(c => c.active);
  if (!state.isFull && activeClients.length >= 2) {
    showAlert('Versió demo', 'Màxim 2 clients actius.\n\nActiva la versió completa per a clients il·limitats.', '🔒');
    return;
  }

  $('newClientInput').value = '';
  openModal('modalNewClient');

  setTimeout(() => $('newClientInput').focus(), 300);
}

function confirmNewClient() {
  const name = $('newClientInput').value.trim();
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
    extraHours: [],
    tasks: {
      urgent: "",
      important: "",
      later: ""
    }
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
  list.innerHTML = '';

  actives.forEach(client => {
    const item = document.createElement('div');
    item.className = 'client-item';
    
    let deliveryInfo = '';
    if (client.deliveryDate) {
      const deliveryDate = new Date(client.deliveryDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const delivery = new Date(deliveryDate);
      delivery.setHours(0, 0, 0, 0);
      
      const diffDays = Math.ceil((delivery - today) / (1000 * 60 * 60 * 24));
      
      if (diffDays < 0) {
        deliveryInfo = ` • <span style="color: #ef4444;">⚠️ Vençut</span>`;
      } else if (diffDays === 0) {
        deliveryInfo = ` • <span style="color: #ef4444;">🔴 AVUI</span>`;
      } else if (diffDays <= 3) {
        deliveryInfo = ` • <span style="color: #f59e0b;">🟡 ${diffDays}d</span>`;
      } else {
        deliveryInfo = ` • 📅 ${deliveryDate.toLocaleDateString('ca-ES', { day: '2-digit', month: '2-digit' })}`;
      }
    }
    
    item.innerHTML = `
      <div class="client-name">${client.name}</div>
      <div class="client-time">Total: ${formatTime(client.total)}${deliveryInfo}</div>
    `;
    item.onclick = () => selectClient(client.id);
    list.appendChild(item);
  });

  openModal('modalChangeClient');
}

function selectClient(clientId) {
  state.currentClientId = clientId;
  state.currentActivity = ACTIVITIES.WORK;
  state.sessionElapsed = 0;
  state.lastTick = Date.now();
  isWorkpadInitialized = false;
  areTasksInitialized = false;

  save();
  updateUI();
  closeModal('modalChangeClient');
}

function closeClient() {
  const client = state.clients[state.currentClientId];
  if (!client) return;

  if (client.photos.length > 0 || (client.notes && client.notes.trim())) {
    $('exportBeforeCloseText').textContent =
      `Aquest client té ${client.photos.length} fotos i notes.\n\nVols exportar el treball abans de tancar?`;

    window.clientToClose = client.id;
    openModal('modalExportBeforeClose');
    return;
  }

  $('closeClientText').textContent =
    `Client: ${client.name}\nTemps total: ${formatTime(client.total)}`;

  openModal('modalCloseClient');
}

function confirmCloseClient() {
  const clientId = window.clientToClose || state.currentClientId;
  const client = state.clients[clientId];
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

  showAlert('Client tancat', `${client.name}\nTemps total: ${formatTime(client.total)}`, '✅');

  window.clientToClose = null;
}

function exportAndClose() {
  exportCurrentWork();
  setTimeout(confirmCloseClient, 500);
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

  renderHistoryList(closed);
  openModal('modalHistory');
}

function renderHistoryList(clients) {
  const list = $('historyClientsList');
  list.innerHTML = '';

  if (!clients.length) {
    list.innerHTML = '<p class="modal-text" style="opacity: 0.6; text-align: center;">Sense resultats</p>';
    return;
  }

  clients.forEach(client => {
    const item = document.createElement('div');
    item.className = 'client-item';

    const notesPreview = client.notes && client.notes.trim()
      ? ` • ${client.notes.slice(0, 30)}${client.notes.length > 30 ? '...' : ''}`
      : '';

    item.innerHTML = `
      <div class="client-name">${client.name}</div>
      <div class="client-time">Total: ${formatTime(client.total)} • ${client.photos.length} fotos${notesPreview}</div>
    `;
    item.onclick = () => selectHistoryClient(client.id);
    list.appendChild(item);
  });
}

function selectHistoryClient(clientId) {
  state.currentClientId = clientId;
  state.currentActivity = null;
  state.sessionElapsed = 0;
  state.lastTick = null;
  isWorkpadInitialized = false;
  areTasksInitialized = false;

  updateUI();
  closeModal('modalHistory');
}

/* ================= ESBORRAR CLIENT ================= */
function deleteCurrentClient() {
  const client = state.clients[state.currentClientId];
  if (!client || client.active) return;

  $('deleteClientText').textContent =
    `Client: ${client.name}\nTemps: ${formatTime(client.total)}\nFotos: ${client.photos.length}\n\nAquesta acció no es pot desfer.`;

  $('inputDeleteConfirm').value = '';
  openModal('modalDeleteClient');

  setTimeout(() => $('inputDeleteConfirm').focus(), 300);
}

function confirmDeleteClient() {
  const confirm = $('inputDeleteConfirm').value.trim().toUpperCase();

  if (confirm !== 'ESBORRAR') {
    showAlert('Error', 'Has d\'escriure ESBORRAR per confirmar', '⚠️');
    return;
  }

  delete state.clients[state.currentClientId];
  state.currentClientId = null;
  state.currentActivity = null;
  state.lastTick = null;
  isWorkpadInitialized = false;
  areTasksInitialized = false;

  save();
  updateUI();
  closeModal('modalDeleteClient');

  showAlert('Client eliminat', 'El client ha estat eliminat definitivament', '🗑️');
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

  [...client.photos]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .forEach(p => {
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

  const trabajo = state.focus[ACTIVITIES.WORK] || 0;
  const pct = Math.round((trabajo / total) * 100);

  $('modalUserName').textContent = userName;
  $('modalTotalTime').textContent = formatTime(total);

  const list = $('modalActivityList');
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

  const focusState = $('modalFocusState');
  if (pct >= 64) {
    focusState.className = 'focus-state enfocado';
    focusState.innerHTML = '🟢 Enfocat';
  } else if (pct >= 40) {
    focusState.className = 'focus-state atencion';
    focusState.innerHTML = '🟡 Atenció';
  } else {
    focusState.className = 'focus-state disperso';
    focusState.innerHTML = '🔴 Dispers';
  }

  openModal('modalEnfoque');
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

  showAlert('CSV exportat', 'L\'arxiu s\'ha descarregat correctament', '📄');
}

/* ================= HORES EXTRES ================= */
function addExtraHours() {
  const client = state.clients[state.currentClientId];
  if (!client) {
    showAlert('Sense client', 'Selecciona un client primer', '⚠️');
    return;
  }

  $('inputExtraHours').value = '';
  $('inputExtraDescription').value = '';
  openModal('modalExtraHours');

  setTimeout(() => $('inputExtraHours').focus(), 300);
}

function saveExtraHours() {
  const client = state.clients[state.currentClientId];
  if (!client) return;

  const hours = parseFloat($('inputExtraHours').value);
  const description = $('inputExtraDescription').value.trim();

  if (!hours || hours <= 0) {
    showAlert('Error', 'Introdueix un nombre d\'hores vàlid', '⚠️');
    return;
  }

  if (!client.extraHours) client.extraHours = [];

  const extraEntry = {
    id: uid(),
    date: new Date().toISOString(),
    hours: hours,
    seconds: Math.round(hours * 3600),
    description: description || 'Hores extres',
    billable: true
  };

  client.extraHours.push(extraEntry);
  client.billableTime = (client.billableTime || 0) + extraEntry.seconds;

  save();
  closeModal('modalExtraHours');
  showAlert('Hores afegides', `${hours}h afegides correctament\n\n"${extraEntry.description}"`, '✅');
}

function showExtraHours() {
  const client = state.clients[state.currentClientId];
  if (!client) {
    showAlert('Sense client', 'Selecciona un client primer', '⚠️');
    return;
  }

  if (!client.extraHours || !client.extraHours.length) {
    showAlert('Sense hores extres', 'Aquest client no té hores extres registrades', 'ℹ️');
    return;
  }

  const list = $('extraHoursList');
  list.innerHTML = '';

  let totalExtra = 0;
  client.extraHours.forEach(entry => {
    totalExtra += entry.seconds;
    
    const item = document.createElement('div');
    item.className = 'extra-hour-item';
    item.innerHTML = `
      <div class="extra-hour-header">
        <span class="extra-hour-amount">⏱️ ${entry.hours}h</span>
        <span class="extra-hour-date">${new Date(entry.date).toLocaleDateString('ca-ES')}</span>
      </div>
      <div class="extra-hour-description">${entry.description}</div>
      <button class="btn-danger-small" onclick="deleteExtraHour('${entry.id}')">🗑️ Eliminar</button>
    `;
    list.appendChild(item);
  });

  $('extraHoursTotal').textContent = formatTime(totalExtra);

  openModal('modalViewExtraHours');
}

function deleteExtraHour(entryId) {
  const client = state.clients[state.currentClientId];
  if (!client || !client.extraHours) return;

  const entry = client.extraHours.find(e => e.id === entryId);
  if (!entry) return;

  if (!confirm(`Eliminar ${entry.hours}h d'hores extres?\n\n"${entry.description}"`)) return;

  client.extraHours = client.extraHours.filter(e => e.id !== entryId);
  client.billableTime = (client.billableTime || 0) - entry.seconds;

  save();
  closeModal('modalViewExtraHours');
  showAlert('Hora eliminada', 'L\'entrada d\'hores extres ha estat eliminada', '🗑️');
}

/* ================= INFORME MILLORAT ================= */
function generateReport() {
  const client = state.clients[state.currentClientId];
  if (!client) {
    showAlert('Sense client', 'Selecciona un client primer', '⚠️');
    return;
  }

  const billableTime = client.billableTime || 0;
  const extraHoursTotal = (client.extraHours || []).reduce((sum, e) => sum + e.seconds, 0);
  const totalBillable = billableTime;

  let activitiesBreakdown = '';
  
  if (state.focusSchedule.enabled) {
    activitiesBreakdown = '\n📊 DESGLOSSAMENT D\'ACTIVITATS FACTURABLES:\n';
    for (const act in client.activities) {
      const time = client.activities[act];
      activitiesBreakdown += `   • ${activityLabel(act)}: ${formatTime(time)}\n`;
    }
  }

  let extraHoursSection = '';
  if (client.extraHours && client.extraHours.length > 0) {
    extraHoursSection = '\n⏱️ HORES EXTRES:\n';
    client.extraHours.forEach(entry => {
      const date = new Date(entry.date).toLocaleDateString('ca-ES', { day: '2-digit', month: '2-digit' });
      extraHoursSection += `   • ${date}: ${entry.hours}h - ${entry.description}\n`;
    });
    extraHoursSection += `   TOTAL EXTRES: ${formatTime(extraHoursTotal)}\n`;
  }

  const notesSection = client.notes && client.notes.trim() 
    ? `\n📝 NOTES:\n${client.notes}\n` 
    : '';

  let deliverySection = '';
  if (client.deliveryDate) {
    const deliveryDate = new Date(client.deliveryDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const delivery = new Date(deliveryDate);
    delivery.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((delivery - today) / (1000 * 60 * 60 * 24));
    
    let status = '';
    if (diffDays < 0) status = '⚠️ VENÇUDA';
    else if (diffDays === 0) status = '🔴 AVUI';
    else if (diffDays <= 3) status = `🟡 ${diffDays} dies`;
    else status = '📅';
    
    deliverySection = `\n📅 DATA DE LLIURAMENT: ${deliveryDate.toLocaleDateString('ca-ES')} ${status}\n`;
  }

  const scheduleInfo = state.focusSchedule.enabled 
    ? `\n⏰ HORARI FACTURABLE: ${state.focusSchedule.start} - ${state.focusSchedule.end}\n` 
    : '\n⏰ Sense horari facturable configurat (tot el temps compta)\n';

  const reportText = 
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `       📋 INFORME DE PROJECTE\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `👤 CLIENT: ${client.name}\n` +
    `📅 Data: ${new Date().toLocaleDateString('ca-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}\n` +
    `👨‍💼 Responsable: ${userName}\n` +
    deliverySection +
    scheduleInfo +
    `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `⏱️ TEMPS TOTAL TREBALLAT: ${formatTime(client.total)}\n` +
    `💰 TEMPS FACTURABLE: ${formatTime(totalBillable)}\n` +
    `${extraHoursSection}` +
    activitiesBreakdown +
    `\n📷 FOTOGRAFIES: ${client.photos.length}\n` +
    notesSection +
    `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `Generat amb FocoWork v${APP_VERSION}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

  $('reportContent').textContent = reportText;
  openModal('modalReport');
}

function copyReport() {
  const reportText = $('reportContent').textContent;
  
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(reportText)
      .then(() => {
        showAlert('Copiat', 'Informe copiat al porta-retalls', '✅');
      })
      .catch(() => {
        fallbackCopy(reportText);
      });
  } else {
    fallbackCopy(reportText);
  }
}

function fallbackCopy(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  
  try {
    document.execCommand('copy');
    showAlert('Copiat', 'Informe copiat al porta-retalls', '✅');
  } catch (err) {
    showAlert('Error', 'No s\'ha pogut copiar. Copia manualment des del modal.', '⚠️');
  }
  
  document.body.removeChild(textarea);
}

async function shareReport() {
  const reportText = $('reportContent').textContent;
  const client = state.clients[state.currentClientId];
  if (!client) return;

  const files = [];
  for (let i = 0; i < client.photos.length; i++) {
    const p = client.photos[i];
    try {
      const res = await fetch(p.data);
      const blob = await res.blob();
      const file = new File(
        [blob],
        `foto_${i + 1}.jpg`,
        { type: blob.type }
      );
      files.push(file);
    } catch (err) {
      console.error('Error processant foto:', err);
    }
  }

  if (
    navigator.share &&
    (!files.length || navigator.canShare({ files }))
  ) {
    try {
      await navigator.share({
        title: `Informe - ${client.name}`,
        text: reportText,
        files: files
      });
    } catch (err) {
      copyReport();
    }
  } else {
    copyReport();
  }
}

/* ================= CONFIGURACIÓ D'HORARI ================= */
function openScheduleModal() {
  const checkbox = $('scheduleEnabled');
  const config = $('scheduleConfig');
  const startInput = $('scheduleStart');
  const endInput = $('scheduleEnd');

  checkbox.checked = state.focusSchedule.enabled;
  startInput.value = state.focusSchedule.start;
  endInput.value = state.focusSchedule.end;

  config.style.display = checkbox.checked ? 'block' : 'none';

  updateSchedulePreview();

  checkbox.onchange = () => {
    config.style.display = checkbox.checked ? 'block' : 'none';
  };

  startInput.oninput = updateSchedulePreview;
  endInput.oninput = updateSchedulePreview;

  openModal('modalSchedule');
}

function updateSchedulePreview() {
  const start = $('scheduleStart').value;
  const end = $('scheduleEnd').value;

  $('schedulePreview').textContent = `${start} - ${end}`;

  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);

  const startMinutes = sh * 60 + sm;
  const endMinutes = eh * 60 + em;
  const totalMinutes = endMinutes - startMinutes;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  $('scheduleDuration').textContent = `${hours}h ${minutes}m`;
}

function applyPreset(start, end) {
  $('scheduleStart').value = start;
  $('scheduleEnd').value = end;
  updateSchedulePreview();
}

function saveScheduleConfig() {
  const enabled = $('scheduleEnabled').checked;
  const start = $('scheduleStart').value;
  const end = $('scheduleEnd').value;

  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);

  if ((eh * 60 + em) <= (sh * 60 + sm)) {
    showAlert('Error', 'L\'hora de fi ha de ser posterior a l\'hora d\'inici', '⚠️');
    return;
  }

  state.focusSchedule.enabled = enabled;
  state.focusSchedule.start = start;
  state.focusSchedule.end = end;

  save();
  closeModal('modalSchedule');

  const message = enabled
    ? `Horari activat: ${start} - ${end}\n\nL'enfocament només comptabilitzarà temps dins d'aquest horari.`
    : 'Horari desactivat\n\nL\'enfocament comptabilitzarà tot el temps treballat.';

  showAlert('Configuració desada', message, '✅');
}

/* ================= EVENT LISTENERS ================= */

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await loadGoogleScript();
    initGoogleDrive();
  } catch (e) {
    console.error('Error inicialitzant Google Drive:', e);
  }
// --- ACCIÓ FOCUS PRIORITARI ---
$('focusPriorityBtn')?.addEventListener('click', () => {
  if (!state.currentClientId) {
    changeClient(); // obre selector si no hi ha client
  } else {
    state.currentActivity = ACTIVITIES.WORK;
    updateUI();
  }
});

// --- SORTIR DEL CLIENT ---
$('exitClientBtn')?.addEventListener('click', exitClient);

// --- DATA D’ENTREGA ---
$('setDeliveryDateBtn')?.addEventListener('click', setDeliveryDate);

// --- HORES EXTRES ---
$('addExtraHoursBtn')?.addEventListener('click', addExtraHours);
$('viewExtraHoursBtn')?.addEventListener('click', showExtraHours);

// --- INFORME ---
$('generateReportBtn')?.addEventListener('click', generateReport);

// --- CÀMERA ---
$('cameraBtn')?.addEventListener('click', addPhotoToClient);

// --- BACKUPS ---
$('exportWorkBtn')?.addEventListener('click', exportCurrentWork);
$('importWorkBtn')?.addEventListener('click', importWork);
$('exportAllBtn')?.addEventListener('click', exportAllData);

// --- FOOTER ---
$('focusBtn')?.addEventListener('click', showFocus);
$('scheduleBtn')?.addEventListener('click', openScheduleModal);
$('todayBtn')?.addEventListener('click', exportTodayCSV);

  // BOTONS PRINCIPALS - IDs CORREGITS
 $('focusPriorityBtn')?.addEventListener('click', () => {
  state.currentActivity = 'work';
  updateUI();
});

  if ($('newClientBtn')) $('newClientBtn').onclick = newClient;
  if ($('changeClient')) $('changeClient').onclick = changeClient;
  if ($('historyBtn')) $('historyBtn').onclick = showHistory;
  if ($('closeClient')) $('closeClient').onclick = closeClient;
  if ($('focusBtn')) $('focusBtn').onclick = showFocus;
  if ($('scheduleBtn')) $('scheduleBtn').onclick = openScheduleModal;
  if ($('todayBtn')) $('todayBtn').onclick = exportTodayCSV;
  if ($('cameraBtn')) $('cameraBtn').onclick = addPhotoToClient;
  if ($('deleteClientBtn')) $('deleteClientBtn').onclick = deleteCurrentClient;
  if ($('exitClientBtn')) $('exitClientBtn').onclick = exitClient;

  // BOTONS SECUNDARIS
  if ($('setDeliveryDateBtn')) $('setDeliveryDateBtn').onclick = setDeliveryDate;
  if ($('addExtraHoursBtn')) $('addExtraHoursBtn').onclick = addExtraHours;
  if ($('viewExtraHoursBtn')) $('viewExtraHoursBtn').onclick = showExtraHours;
  if ($('generateReportBtn')) $('generateReportBtn').onclick = generateReport;
  if ($('exportWorkBtn')) $('exportWorkBtn').onclick = exportCurrentWork;
  if ($('importWorkBtn')) $('importWorkBtn').onclick = importWork;
  if ($('exportAllBtn')) $('exportAllBtn').onclick = exportAllData;
  if ($('loadLicenseBtn')) $('loadLicenseBtn').onclick = loadLicenseFile;
  if ($('requestLicenseBtn')) $('requestLicenseBtn').onclick = requestLicense;
  if ($('exportToDriveBtn')) $('exportToDriveBtn').onclick = () => exportAllToDrive(false);
  if ($('backupConfigBtn')) $('backupConfigBtn').onclick = openBackupConfigModal;

  // LONG PRESS EN BOTÓ FOCUS
  let focusLongPressTimer;
  if ($('focusBtn')) {
    $('focusBtn').addEventListener('mousedown', () => {
      focusLongPressTimer = setTimeout(() => {
        if (confirm('Reiniciar dades d\'enfocament d\'avui?\n\nAixò NO afecta als temps de clients, només a les estadístiques d\'enfocament diari.')) {
          resetTodayFocus();
        }
      }, 2000);
    });
    $('focusBtn').addEventListener('mouseup', () => clearTimeout(focusLongPressTimer));
    $('focusBtn').addEventListener('touchstart', () => {
      focusLongPressTimer = setTimeout(() => {
        if (confirm('Reiniciar dades d\'enfocament d\'avui?\n\nAixò NO afecta als temps de clients, només a les estadístiques d\'enfocament diari.')) {
          resetTodayFocus();
        }
      }, 2000);
    });

  // ACTIVITATS
  document.querySelectorAll('.activity').forEach(btn => {
    btn.onclick = () => setActivity(btn.dataset.activity);
  });

  // TANCAR MODALS CLICANT FORA
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal(overlay.id);
    });
  });

  // INPUT NOU CLIENT - ID CORREGIT
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
      renderHistoryList(filtered);
    });
  }

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
  
  // ACTUALITZAR UI INICIAL
  updateUI();
});

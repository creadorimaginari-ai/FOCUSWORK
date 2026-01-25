
 * FOCUSWORK – app-core.js (V4.0 ARREGLAT)
 * IndexedDB + Cronòmetre suau + Optimitzacions


/* ================= CONFIG ================= */
const WHATSAPP_PHONE = "34649383847";
const APP_VERSION = "4.0";
const LICENSE_SECRET = "FW2025-SECURE-KEY-X7Y9Z";
const GOOGLE_CLIENT_ID = '339892728740-ghh878p6g57relsi79cprbti5vac1hd4.apps.googleusercontent.com';
const DB_NAME = 'FocusWorkDB';
const DB_VERSION = 1;

/* ================= INDEXEDDB ================= */
let db = null;

async function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };
    
    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      
      if (!database.objectStoreNames.contains('state')) {
        database.createObjectStore('state', { keyPath: 'id' });
      }
      
      if (!database.objectStoreNames.contains('clients')) {
        const clientStore = database.createObjectStore('clients', { keyPath: 'id' });
        clientStore.createIndex('active', 'active', { unique: false });
      }
      
      if (!database.objectStoreNames.contains('photos')) {
        const photoStore = database.createObjectStore('photos', { keyPath: 'id' });
        photoStore.createIndex('clientId', 'clientId', { unique: false });
      }
      
      if (!database.objectStoreNames.contains('backups')) {
        database.createObjectStore('backups', { keyPath: 'id' });
      }
    };
  });
}

async function dbGet(storeName, key) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function dbPut(storeName, data) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(data);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function dbDelete(storeName, key) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function dbGetAll(storeName) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function dbGetByIndex(storeName, indexName, value) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const index = store.index(indexName);
    const request = index.getAll(value);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
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
let state = {
  isFull: false,
  license: null,
  day: todayKey(),
  currentClientId: null,
  currentActivity: null,
  lastTick: null,
  sessionElapsed: 0,
  focus: {},
  focusSchedule: { enabled: false, start: "09:00", end: "17:00" },
  autoDriveBackup: false,
  lastBackupDate: null,
};

async function loadState() {
  try {
    const savedState = await dbGet('state', 'main');
    if (savedState) {
      state = { ...state, ...savedState.data };
    }
  } catch (e) {
    console.warn('No s\'ha pogut carregar l\'estat:', e);
  }
}

async function save() {
  try {
    await dbPut('state', {
      id: 'main',
      data: state,
      timestamp: Date.now()
    });
    
    if (state.currentClientId) scheduleAutoBackup();
    return true;
  } catch (e) {
    showAlert('Error', 'No s\'han pogut guardar les dades', '❌');
    return false;
  }
}

/* ================= GESTIÓ DE CLIENTS ================= */
async function saveClient(client) {
  try {
    const photos = client.photos || [];
    const clientData = { ...client };
    delete clientData.photos;
    
    await dbPut('clients', clientData);
    
    for (const photo of photos) {
      await dbPut('photos', {
        id: photo.id || uid(),
        clientId: client.id,
        data: photo.data,
        date: photo.date
      });
    }
    
    return true;
  } catch (e) {
    console.error('Error guardant client:', e);
    return false;
  }
}

async function loadClient(clientId) {
  try {
    const client = await dbGet('clients', clientId);
    if (!client) return null;
    
    const photos = await dbGetByIndex('photos', 'clientId', clientId);
    client.photos = photos.map(p => ({
      id: p.id,
      data: p.data,
      date: p.date
    }));
    
    return client;
  } catch (e) {
    console.error('Error carregant client:', e);
    return null;
  }
}

async function loadAllClients() {
  try {
    const clients = await dbGetAll('clients');
    const clientsObj = {};
    
    for (const client of clients) {
      const photos = await dbGetByIndex('photos', 'clientId', client.id);
      client.photos = photos.map(p => ({
        id: p.id,
        data: p.data,
        date: p.date
      }));
      clientsObj[client.id] = client;
    }
    
    return clientsObj;
  } catch (e) {
    console.error('Error carregant clients:', e);
    return {};
  }
}

async function deleteClient(clientId) {
  try {
    const photos = await dbGetByIndex('photos', 'clientId', clientId);
    for (const photo of photos) {
      await dbDelete('photos', photo.id);
    }
    
    await dbDelete('clients', clientId);
    return true;
  } catch (e) {
    console.error('Error esborrant client:', e);
    return false;
  }
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
  autoBackupTimeout = setTimeout(async () => {
    if (state.currentClientId) {
      const client = await loadClient(state.currentClientId);
      if (client) {
        await performAutoBackup(client);
        lastAutoBackupTime = Date.now();
      }
    }
  }, AUTO_BACKUP_DELAY);
}

async function performAutoBackup(client) {
  const backup = {
    id: `autobackup_${client.id}`,
    version: APP_VERSION,
    timestamp: new Date().toISOString(),
    clientId: client.id,
    client: client,
    type: 'auto'
  };
  
  try {
    await dbPut('backups', backup);
    console.log('AUTO-BACKUP fet:', client.name, new Date().toLocaleTimeString());
  } catch (e) {
    console.warn('Auto-backup ha fallat:', e);
  }
}

async function performFullAutoBackup() {
  const clients = await loadAllClients();
  const backup = {
    id: `full_autobackup_${Date.now()}`,
    version: APP_VERSION,
    timestamp: new Date().toISOString(),
    userName: userName,
    state: JSON.parse(JSON.stringify(state)),
    clients: clients,
    type: 'full_auto'
  };
  
  try {
    await dbPut('backups', backup);
    state.lastBackupDate = new Date().toISOString();
    await save();
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

function updateBackupButtonStatus() {
  const exportAllBtn = $('exportAllBtn');
  if (!exportAllBtn) return;
  
  const now = Date.now();
  const lastBackup = state.lastBackupDate ? new Date(state.lastBackupDate).getTime() : 0;
  const hoursSinceBackup = (now - lastBackup) / (1000 * 60 * 60);
  
  let statusText = '';
  let buttonColor = '';
  
  if (!state.lastBackupDate) {
    statusText = 'Mai s\'ha fet còpia';
    buttonColor = 'background: linear-gradient(135deg, #ef4444, #dc2626) !important;';
  } else if (hoursSinceBackup < 6) {
    const hours = Math.floor(hoursSinceBackup);
    const minutes = Math.floor((hoursSinceBackup - hours) * 60);
    statusText = hours > 0 ? `Còpia fa ${hours}h` : `Còpia fa ${minutes}m`;
    buttonColor = 'background: linear-gradient(135deg, #10b981, #059669) !important;';
  } else if (hoursSinceBackup < 24) {
    const hours = Math.floor(hoursSinceBackup);
    statusText = `Còpia fa ${hours}h`;
    buttonColor = 'background: linear-gradient(135deg, #f59e0b, #d97706) !important;';
  } else {
    const days = Math.floor(hoursSinceBackup / 24);
    statusText = `Còpia fa ${days} ${days === 1 ? 'dia' : 'dies'}`;
    buttonColor = 'background: linear-gradient(135deg, #ef4444, #dc2626) !important;';
  }
  
  exportAllBtn.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: center; gap: 2px;">
      <span style="font-size: 16px; font-weight: 600;">📦 Còpia de seguretat</span>
      <span style="font-size: 11px; opacity: 0.85; font-weight: 500;">${statusText}</span>
    </div>
  `;
  
  exportAllBtn.style.cssText = buttonColor + `
    border-radius: 20px;
    padding: 14px 16px;
    color: #ffffff;
    cursor: pointer;
    border: 1px solid rgba(255, 255, 255, 0.2);
    transition: all 0.3s ease;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  `;
}

function markBackupDone() {
  state.lastBackupDate = new Date().toISOString();
  save();
  updateBackupButtonStatus();
}

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
    showAlert('Configuració desada', state.autoDriveBackup ? 'Backups automàtics activats' : 'Backups automàtics desactivats', '✅');
  }
}

function resetDayIfNeeded() {
  if (state.day !== todayKey()) {
    state.day = todayKey();
    state.focus = {};
    save();
  }
}

async function getStorageEstimate() {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    return await navigator.storage.estimate();
  }
  return { usage: 0, quota: 0 };
}

async function showStorageInfo() {
  const estimate = await getStorageEstimate();
  const usageMB = (estimate.usage / (1024 * 1024)).toFixed(2);
  const quotaMB = (estimate.quota / (1024 * 1024)).toFixed(0);
  const percent = estimate.quota > 0 ? Math.round((estimate.usage / estimate.quota) * 100) : 0;
  
  const clients = await loadAllClients();
  const clientCount = Object.keys(clients).length;
  const activeCount = Object.values(clients).filter(c => c.active).length;
  
  let totalPhotos = 0;
  Object.values(clients).forEach(c => totalPhotos += (c.photos?.length || 0));
  
  let statusIcon = '🟢';
  let statusText = 'Espai disponible';
  if (percent >= 90) {
    statusIcon = '🔴';
    statusText = 'CRÍTIC';
  } else if (percent >= 75) {
    statusIcon = '🟡';
    statusText = 'ADVERTÈNCIA';
  }
  
  showAlert(
    'Ús d\'emmagatzematge', 
    `${statusIcon} ${statusText}\n\n` +
    `📊 Usat: ${usageMB}MB de ${quotaMB}MB (${percent}%)\n\n` +
    `👥 Clients: ${clientCount} (${activeCount} actius)\n` +
    `📷 Fotos: ${totalPhotos}\n\n` +
    `💡 IndexedDB permet molt més espai!`, 
    '📊'
  );
}

function resetTodayFocus() {
  state.focus = {};
  state.day = todayKey();
  save();
  showAlert('Enfocament reiniciat', 'Dades reiniciades', '✅');
}

/* ================= MOTOR DE TEMPS (OPTIMITZAT) ================= */
let lastSaveTime = 0;

// FUNCIÓ PRINCIPAL: Actualitza temps cada segon
async function tick() {
  resetDayIfNeeded();
  
  if (!state.currentClientId || !state.currentActivity || !state.lastTick) {
    state.lastTick = Date.now();
    updateTimerDisplay(); // Actualitzar display
    return;
  }
  
  const client = await loadClient(state.currentClientId);
  if (!client || !client.active) {
    state.lastTick = Date.now();
    updateTimerDisplay();
    return;
  }
  
  const now = Date.now();
  const elapsed = Math.floor((now - state.lastTick) / 1000);
  
  if (elapsed <= 0) {
    updateTimerDisplay(); // Actualitzar display fins i tot si elapsed=0
    return;
  }
  
  // Actualitzar temps
  state.lastTick = now;
  state.sessionElapsed += elapsed;
  client.total = (client.total || 0) + elapsed;
  client.activities = client.activities || {};
  client.activities[state.currentActivity] = (client.activities[state.currentActivity] || 0) + elapsed;
  
  // Temps facturable
  if (state.focusSchedule.enabled) {
    if (isWithinFocusSchedule()) {
      client.billableTime = (client.billableTime || 0) + elapsed;
      state.focus[state.currentActivity] = (state.focus[state.currentActivity] || 0) + elapsed;
    }
  } else {
    client.billableTime = (client.billableTime || 0) + elapsed;
    state.focus[state.currentActivity] = (state.focus[state.currentActivity] || 0) + elapsed;
  }
  
  // Guardar cada 5 segons (no cada segon)
  if (Date.now() - lastSaveTime > 5000) {
    await saveClient(client);
    await save();
    lastSaveTime = Date.now();
  }
  
  // Actualitzar NOMÉS el cronòmetre (no tota la UI)
  updateTimerDisplay();
}

// FUNCIÓ NOVA: Actualitza només el display del cronòmetre (no re-renderitza res més)
function updateTimerDisplay() {
  const timerEl = $("timer");
  if (!timerEl) return;
  
  if (state.currentClientId && state.currentActivity && state.lastTick) {
    // Calcular temps actual amb precisió
    const now = Date.now();
    const extraElapsed = Math.floor((now - state.lastTick) / 1000);
    const currentElapsed = state.sessionElapsed + extraElapsed;
    timerEl.textContent = formatTime(currentElapsed);
  } else {
    timerEl.textContent = "00:00:00";
  }
}

// NOVA FUNCIÓ: Actualitza total del client (crida cada 5 segons)
async function updateClientTotal() {
  if (!state.currentClientId) return;
  
  const client = await loadClient(state.currentClientId);
  if (!client) return;
  
  const clientTotalEl = $("clientTotal");
  if (clientTotalEl) {
    clientTotalEl.textContent = `Total client: ${formatTime(client.total)}`;
  }
}

// Timer principal: tick cada segon
setInterval(tick, 1000);

// Timer secundari: actualitzar total client cada 5 segons
setInterval(updateClientTotal, 5000);

// ... setInterval(tick, 1000);
// ... setInterval(updateClientTotal, 5000);

// 🔽 AQUÍ ÉS PERFECTE
function smoothTimerRender() {
  const timerEl = $("timer");
  if (!timerEl) {
    requestAnimationFrame(smoothTimerRender);
    return;
  }

  if (state.currentClientId && state.currentActivity && state.lastTick) {
    const now = Date.now();
    const extra = Math.floor((now - state.lastTick) / 1000);
    timerEl.textContent = formatTime(state.sessionElapsed + extra);
  }

  requestAnimationFrame(smoothTimerRender);
}

requestAnimationFrame(smoothTimerRender);


async function setActivity(activity) {
  const client = await loadClient(state.currentClientId);
  if (!client || !client.active) {
    showAlert('Sense client', 'Selecciona un client actiu', '⚠️');
    return;
  }
  state.currentActivity = activity;
  state.sessionElapsed = 0;
  state.lastTick = Date.now();
  await save();
  updateUI();
}

/* ================= MIGRACIÓ DESDE LOCALSTORAGE ================= */
async function migrateFromLocalStorage() {
  const oldState = localStorage.getItem("focowork_state");
  if (!oldState) return false;
  
  try {
    const parsed = JSON.parse(oldState);
    
    if (parsed.clients && Object.keys(parsed.clients).length > 0) {
      console.log('📄 Migrant dades de localStorage a IndexedDB...');
      showAlert('Migració detectada', 'Migrant dades a IndexedDB...', '📄');
      
      for (const clientId in parsed.clients) {
        await saveClient(parsed.clients[clientId]);
      }
      
      delete parsed.clients;
      state = { ...state, ...parsed };
      await save();
      
      localStorage.removeItem("focowork_state");
      
      showAlert('Migració completa', 'Dades migrades a IndexedDB amb èxit!\n\nAra tens molt més espai disponible.', '✅');
      return true;
    }
  } catch (e) {
    console.error('Error migrant dades:', e);
  }
  
  return false;
}

/* ================= INICIALITZACIÓ ================= */
async function initApp() {
  try {
    await initDB();
    await loadState();
    await migrateFromLocalStorage();
    
    updateUI();
    scheduleFullAutoBackup();
    
    console.log('✅ FocusWork V4.0 inicialitzat amb IndexedDB');
  } catch (e) {
    console.error('Error inicialitzant app:', e);
    showAlert('Error', 'No s\'ha pogut inicialitzar l\'aplicació', '❌');
  }
}

document.addEventListener('DOMContentLoaded', initApp);

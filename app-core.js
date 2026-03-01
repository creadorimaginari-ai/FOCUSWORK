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
  if (!db) return null; // ✅ DB no inicialitzada — retornar null silenciosament
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function dbPut(storeName, data) {
  if (!db) {
    try { await initDB(); } catch(e) { console.warn('dbPut: initDB falló', e); return null; }
  }
  if (!db) return null;
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(data);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    } catch(e) { reject(e); }
  });
}

async function dbDelete(storeName, key) {
  if (!db) return null;
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function dbGetAll(storeName) {
  if (!db) return [];
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
  // ✅ Generar UUID vàlid per Supabase
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Fallback per navegadors antics
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
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
  
  // Càlcul amb precisió de segons (no només minuts)
  const secondsNow = date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds();
  const secondsStart = sh * 3600 + sm * 60;
  const secondsEnd = eh * 3600 + em * 60;
  
  return secondsNow >= secondsStart && secondsNow < secondsEnd;
}

// Nova funció: Obtenir el següent canvi d'horari (inici o fi)
function getNextScheduleChange(date = new Date()) {
  if (!state.focusSchedule || !state.focusSchedule.enabled) return Infinity;
  
  const [sh, sm] = state.focusSchedule.start.split(":").map(Number);
  const [eh, em] = state.focusSchedule.end.split(":").map(Number);
  
  const secondsNow = date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds();
  const secondsStart = sh * 3600 + sm * 60;
  const secondsEnd = eh * 3600 + em * 60;
  
  // Si estem abans de l'inici, el proper canvi és l'inici
  if (secondsNow < secondsStart) {
    const nextChange = new Date(date);
    nextChange.setHours(sh, sm, 0, 0);
    return nextChange.getTime();
  }
  
  // Si estem dins l'horari, el proper canvi és la fi
  if (secondsNow < secondsEnd) {
    const nextChange = new Date(date);
    nextChange.setHours(eh, em, 0, 0);
    return nextChange.getTime();
  }
  
  // Si estem després de la fi, el proper canvi és l'inici del següent dia
  const nextChange = new Date(date);
  nextChange.setDate(nextChange.getDate() + 1);
  nextChange.setHours(sh, sm, 0, 0);
  return nextChange.getTime();
}

// Nova funció: Calcular temps facturable amb precisió absoluta
function calculateBillableSeconds(startTime, endTime) {
  if (!state.focusSchedule || !state.focusSchedule.enabled) {
    // Si no hi ha horari, tot el temps és facturable
    return Math.floor((endTime - startTime) / 1000);
  }
  
  let billableSeconds = 0;
  let currentTime = startTime;
  
  // Iterar per segments de temps que respectin els límits de l'horari
  while (currentTime < endTime) {
    const currentDate = new Date(currentTime);
    const isWithin = isWithinFocusSchedule(currentDate);
    
    // Calcular el següent canvi d'horari (inici o fi)
    const nextChange = getNextScheduleChange(currentDate);
    const segmentEnd = Math.min(endTime, nextChange);
    
if (isWithin) {
  billableSeconds += (segmentEnd - currentTime);
}

currentTime = segmentEnd;
}

return Math.floor(billableSeconds / 1000);
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
let userName = localStorage.getItem("focowork_user_name") || null;

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
    const user = window.getCurrentUser();
    const offline = typeof window.isOfflineMode === 'function' && window.isOfflineMode();
    
    if (user && !offline) {
      // 1. Carregar clients de Supabase (només si NO estem en mode offline)
      console.log('📥 Carregant clients des de Supabase...');
      
      try {
        const supabaseClients = await loadAllClientsSupabase();
        
        if (supabaseClients && Object.keys(supabaseClients).length > 0) {
          console.log(`✅ Carregats ${Object.keys(supabaseClients).length} clients de Supabase`);
          
          // Actualitzar estat amb clients de Supabase
          state.clients = supabaseClients;
          
          // Guardar també a IndexedDB local com a cache/backup
          for (const client of Object.values(supabaseClients)) {
            const clientData = { ...client };
            delete clientData.photos; // Les fotos ja estan a Supabase
            
            try {
              await dbPut('clients', clientData);
            } catch (e) {
              console.warn('Error guardant client local:', e);
            }
          }
          
          // Carregar estat general d'IndexedDB (userName, etc.)
          const savedState = await dbGet('state', 'main');
          if (savedState && savedState.data) {
            // Mantenir userName i altres dades, però NO sobrescriure clients
            const { clients, ...restState } = savedState.data;
            state = { ...state, ...restState };
          }
          
          console.log('✅ Estat sincronitzat amb Supabase');
          return;
        } else {
          console.log('ℹ️ No hi ha clients a Supabase');
        }
      } catch (error) {
        console.error('❌ Error carregant de Supabase:', error);
        console.log('📥 Carregant des d\'IndexedDB local com a fallback...');
      }
    } else {
      console.log('👤 Usuari no autenticat - carregant dades locals');
    }
    
    // 2. Si no hi ha usuari o error, carregar d'IndexedDB
    const savedState = await dbGet('state', 'main');
    if (savedState && savedState.data) {
      state = { ...state, ...savedState.data };
      console.log('✅ Estat carregat des d\'IndexedDB local');
    }

    // ✅ FIX MODE OFFLINE: si no hi ha clients a state, carregar tots de IndexedDB
    if (!state.clients || Object.keys(state.clients).length === 0) {
      try {
        const localClients = await dbGetAll('clients');
        if (localClients && localClients.length > 0) {
          state.clients = {};
          for (const c of localClients) {
            state.clients[c.id] = c;
          }
          console.log('✅ ' + localClients.length + ' clients carregats de IndexedDB (mode offline)');
        }
      } catch(e) {
        console.warn('⚠️ Error carregant clients locals:', e);
      }
    }
  } catch (e) {
    console.warn('⚠️ Error carregant estat:', e);
  }
}

async function save() {
  try {
    // ✅ Mai guardar 'clients' dins state — tenen el seu propi store a IndexedDB
    // Guardar-los dins state pot causar errors per volum excessiu (fotos base64)
    const { clients, ...stateToSave } = state;
    await dbPut('state', {
      id: 'main',
      data: stateToSave,
      timestamp: Date.now()
    });
    
    if (state.currentClientId) scheduleAutoBackup();
    return true;
  } catch (e) {
    console.error('Error guardant state:', e);
    showAlert('Error', 'No s\'han pogut guardar les dades', '❌');
    return false;
  }
}

/* ================= GESTIÓ DE CLIENTS ================= */
async function saveClient(client) {
  // Guardar a Supabase (només si NO estem en mode offline)
  if (!isOfflineMode()) {
    try {
      await saveClientSupabase(client);
    } catch (error) {
      console.error('Error guardant a Supabase:', error);
    }
  }
  
  // Guardar SEMPRE a IndexedDB local (fotos, total, billableTime, tasks...)
  try {
    const photos = client.photos || [];
    const clientData = { ...client };
    delete clientData.photos;
    
    await dbPut('clients', clientData);
    
    for (const photo of photos) {
      await dbPut('photos', {
        id:       photo.id || uid(),
        clientId: client.id,
        url:      photo.url  || null,   // ✅ preservar URL Supabase Storage
        data:     photo.data || null,   // ✅ preservar base64 local
        date:     photo.date,
        comment:  photo.comment || ""
      });
    }
    
    return true;
  } catch (e) {
    console.error('Error guardant client local:', e);
    return false;
  }
}

async function loadClient(clientId) {
  try {
    // 1. Intentar Supabase (només si NO estem en mode offline)
    let client = null;
    if (!isOfflineMode()) {
      try {
        client = await loadClientSupabase(clientId);
      } catch(e) {
        console.warn('Supabase no disponible');
      }
    }
    
    // 2. Si no, agafar de IndexedDB local
    if (!client) {
      client = await dbGet('clients', clientId);
      if (!client) return null;
    }
    
    // 3. Combinar amb dades locals que Supabase no té
    try {
      const local = await dbGet('clients', clientId);
      if (local) {
        client.total        = client.total        || local.total        || 0;
        client.billableTime = client.billableTime || local.billableTime || 0;
        client.tasks        = client.tasks        || local.tasks        || { urgent: "", important: "", later: "" };
        client.deliveryDate = client.deliveryDate || local.deliveryDate || null;
        client.extraHours   = client.extraHours   || local.extraHours   || [];

        // ✅ BUGFIX: restaurar base64 dels arxius (àudios/vocals) que Supabase
        // guarda sense data (data:null) però que sí tenim a IndexedDB local.
        // Supabase retalla el base64 per estalviar espai, però localment el tenim.
        if (local.files && local.files.length > 0) {
          const localFilesMap = {};
          local.files.forEach(f => { localFilesMap[f.id] = f; });

          client.files = (client.files || []).map(f => {
            const localF = localFilesMap[f.id];
            if (!f.data && localF && localF.data) {
              // Recuperar base64 local que Supabase no té
              return { ...f, data: localF.data };
            }
            return f;
          });

          // Afegir arxius locals que potser no han arribat a Supabase encara
          const supabaseIds = new Set((client.files || []).map(f => f.id));
          local.files.forEach(f => {
            if (!supabaseIds.has(f.id)) {
              client.files.push(f);
            }
          });
        }
      }
    } catch(e) {}
    
    // 4. Respectar l'estat real de Supabase (active/closed)
    // ✅ BUGFIX: NO forçar active=true — si Supabase diu que és closed, cal respectar-ho
    // Sense aquest fix, els clients tancats no es podien esborrar mai
    if (client.status !== undefined) {
      client.active = (client.status === 'active' || client.status === null || client.status === '' || client.status === undefined);
    } else {
      client.active = client.active !== false;
    }
    
    // 5. SEMPRE carregar fotos de IndexedDB
    try {
      const photos = await dbGetByIndex('photos', 'clientId', clientId);
      client.photos = photos.map(p => ({
        id:      p.id,
        url:     p.url  || null,   // ✅ restaurar URL Supabase Storage
        data:    p.data || null,   // ✅ restaurar base64 local
        date:    p.date,
        comment: p.comment || ""
      }));
      if (client.photos.length > 0) {
        console.log(`📷 ${client.photos.length} fotos per ${client.name}`);
      }
    } catch(e) {
      client.photos = client.photos || [];
    }
    
    return client;
  } catch (e) {
    console.error('Error carregant client:', e);
    return null;
  }
}

async function loadAllClients() {
  try {
    // ✅ Intentar carregar de Supabase primer (només si NO estem en mode offline)
    if (!isOfflineMode() && window.getCurrentUser && typeof loadAllClientsSupabase === 'function') {
      try {
        const supabaseClients = await loadAllClientsSupabase();
        if (supabaseClients && Object.keys(supabaseClients).length > 0) {
          return supabaseClients;
        }
      } catch (supabaseError) {
        console.error('Error carregant de Supabase:', supabaseError);
        // Continuar amb la càrrega local si falla
      }
    }
    
    // Carregar de local com a fallback
    const clients = await dbGetAll('clients');
    const clientsObj = {};
    
    for (const client of clients) {
      const photos = await dbGetByIndex('photos', 'clientId', client.id);
      client.photos = photos.map(p => ({
        id:      p.id,
        url:     p.url  || null,   // ✅ restaurar URL Supabase Storage
        data:    p.data || null,   // ✅ restaurar base64 local
        date:    p.date,
        comment: p.comment || ""
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
    // ✅ Esborrar de Supabase primer
    if (window.getCurrentUser && typeof deleteClientSupabase === 'function') {
      try {
        await deleteClientSupabase(clientId);
        console.log('✅ Client esborrat de Supabase');
      } catch (supabaseError) {
        console.error('Error esborrant de Supabase:', supabaseError);
        // Continuar amb l'esborrat local
      }
    }
    
    // Esborrar fotos locals
    const photos = await dbGetByIndex('photos', 'clientId', clientId);
    for (const photo of photos) {
      await dbDelete('photos', photo.id);
    }
    
    // Esborrar client local
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

/* ================= MOTOR DE TEMPS (PRECISIÓ ABSOLUTA) ================= */

let lastSaveTime = 0;

// Loop precís que evita drift
let lastPreciseTickTime = Date.now();

function preciseTickLoop() {
  const now = Date.now();
  const elapsed = now - lastPreciseTickTime;

  if (elapsed >= 1000) {
    // Compensar retard acumulat
    lastPreciseTickTime = now - (elapsed % 1000);
    tick();
  }

  requestAnimationFrame(preciseTickLoop);
}

// ✅ preciseTickLoop s'inicia des d'initApp (mode normal)
// o des d'offline-mode.js (mode offline)
// en ambdós casos DESPRÉS que initDB() hagi acabat


// ================= TICK PRINCIPAL =================
async function tick() {
  // ✅ FIX: no fer res si la DB no està inicialitzada
  if (!window.db) return;

  resetDayIfNeeded();

  if (!state.currentClientId || !state.currentActivity || !state.lastTick) {
    updateTimerDisplay();
    return;
  }

  const client = await loadClient(state.currentClientId);
  if (!client || !client.active) {
    updateTimerDisplay();
    return;
  }

  const now = Date.now();

  // Inicialitzar acumuladors si no existeixen
  if (!state._msRemainder) state._msRemainder = 0;
  if (!state._tickClock) state._tickClock = now;

  // Temps real passat des de l'últim tick real
  const deltaMs = now - state._tickClock;
  state._tickClock = now;

  if (deltaMs <= 0) {
    updateTimerDisplay();
    return;
  }

  // Acumular temps real
  state._msRemainder += deltaMs;

  // Segons complets disponibles
  const elapsedSeconds = Math.floor(state._msRemainder / 1000);

  if (elapsedSeconds <= 0) {
    updateTimerDisplay();
    return;
  }

  // Restar ms ja convertits
  state._msRemainder -= elapsedSeconds * 1000;

  // Avançar lastTick només pel temps real consumit
  state.lastTick += elapsedSeconds * 1000;

  // Temps sessió
  state.sessionElapsed += elapsedSeconds;

  // Temps client
  client.total = (client.total || 0) + elapsedSeconds;

  client.activities = client.activities || {};
  client.activities[state.currentActivity] =
    (client.activities[state.currentActivity] || 0) + elapsedSeconds;

  // Temps facturable exacte
  const billableElapsed = calculateBillableSeconds(
    state.lastTick - elapsedSeconds * 1000,
    state.lastTick
  );

  client.billableTime =
    (client.billableTime || 0) + billableElapsed;

  state.focus[state.currentActivity] =
    (state.focus[state.currentActivity] || 0) + billableElapsed;

  // Guardar cada 5 segons
  if (Date.now() - lastSaveTime > 5000) {
    await saveClient(client);
    await save();
    lastSaveTime = Date.now();
  }

  updateTimerDisplay();
}

// ================= DISPLAY DEL CRONÒMETRE =================
function updateTimerDisplay() {
  const timerEl = $("timer");
  if (!timerEl) return;

  if (state.currentClientId && state.currentActivity && state.lastTick) {
    const now = Date.now();

    // usar temps real acumulat, no floor visual
    const extraMs = now - state.lastTick;
    const extraSeconds = Math.round(extraMs / 1000);

    timerEl.textContent = formatTime(
      state.sessionElapsed + Math.max(0, extraSeconds)
    );
  } else {
    timerEl.textContent = "00:00:00";
  }
}



// ================= ACTUALITZAR TOTAL CLIENT =================
async function updateClientTotal() {
  if (!state.currentClientId) return;
  // En mode offline, llegir directament de IndexedDB sense tocar Supabase
  let client;
  if (isOfflineMode()) {
    client = await dbGet('clients', state.currentClientId);
  } else {
    client = await loadClient(state.currentClientId);
  }
  if (!client) return;

  const el = $("clientTotal");
  if (el) el.textContent = `Total client: ${formatTime(client.total)}`;
}

setInterval(updateClientTotal, 5000);

function smoothTimerRender() {
  updateTimerDisplay();
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
    // ✅ ESPERAR QUE SUPABASE ESTIGUI LLEST
    console.log('🔄 Iniciant FocusWork...');
    console.log('🔍 Comprovant disponibilitat de Supabase...');
    
    // Comprovar si la llibreria de Supabase s'ha carregat
    if (typeof window.supabase === 'undefined') {
      console.error('❌ ERROR: La llibreria de Supabase no s\'ha carregat');
      console.error('Verifica que el CDN estigui accessible: https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2');
      alert('Error: No s\'ha pogut carregar la llibreria de Supabase.\n\nComprova la teva connexió a Internet i recarrega la pàgina.');
      return;
    }
    
    console.log('✅ Llibreria Supabase carregada');
    
    // Esperar fins que initAuth estigui disponible (màxim 5 segons)
    console.log('🔄 Esperant que la configuració de Supabase estigui llesta...');
    let retries = 0;
    while (typeof window.initAuth !== 'function' && retries < 50) {
      await new Promise(resolve => setTimeout(resolve, 100));
      retries++;
    }
    
    if (typeof window.initAuth !== 'function') {
      console.error('❌ ERROR: La funció initAuth no està disponible');
      console.error('Verifica que supabase-config.js s\'hagi carregat correctament');
      alert('Error carregant la configuració d\'autenticació.\n\nRecarrega la pàgina o contacta amb suport tècnic.');
      return;
    }
    
    console.log('✅ Configuració de Supabase carregada');
    
    // 1. Inicialitzar autenticació
    console.log('🔐 Inicialitzant autenticació...');
    const user = await initAuth();
    
    // 2. Si no hi ha usuari, mostrar login
    if (!user) {
      console.log('👤 Usuari no autenticat - mostrant pantalla de login');
      showLoginScreen();
      return;
    }
    
    console.log('✅ Usuari autenticat:', user.email);
    
    // 3. Inicialitzar IndexedDB local (backup)
    console.log('💾 Inicialitzant base de dades local...');
    await initDB();
    await loadState();
    // ✅ Iniciar timer DESPRÉS que DB estigui llesta
    preciseTickLoop();
    
    // 4. Verificar si cal migrar dades locals
    // ✅ BUGFIX: checkMigration no existia — era migrateFromLocalStorage
    await migrateFromLocalStorage();
    
    // 5. Continuar com abans
    if (!userName) {
      showOnboardingScreen();
      return;
    }
    
    updateUI();
    scheduleFullAutoBackup();
    
    console.log('✅ FocusWork V4.0 inicialitzat amb Supabase');
  } catch (e) {
    console.error('Error inicialitzant app:', e);
    showAlert('Error', 'No s\'ha pogut inicialitzar l\'app', '❌');
  }
}

/* ================= ONBOARDING OBLIGATORI ================= */
function showOnboardingScreen() {
  // Crear pantalla d'onboarding
  const onboardingHTML = `
    <div id="onboardingScreen" style="
      position: fixed;
      inset: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      padding: 20px;
    ">
      <div style="
        background: white;
        border-radius: 20px;
        padding: 40px;
        max-width: 500px;
        width: 100%;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        text-align: center;
      ">
        <!-- Selector de llengua integrat a l'onboarding -->
        <div style="display:flex; justify-content:flex-end; gap:6px; margin-bottom:16px;">
          <button onclick="onboardSelectLang('ca')" id="ob_ca" style="padding:5px 10px;border-radius:6px;border:2px solid #667eea;background:#667eea;color:white;font-weight:700;font-size:12px;cursor:pointer;">CA</button>
          <button onclick="onboardSelectLang('es')" id="ob_es" style="padding:5px 10px;border-radius:6px;border:2px solid #e2e8f0;background:white;color:#64748b;font-weight:700;font-size:12px;cursor:pointer;">ES</button>
          <button onclick="onboardSelectLang('en')" id="ob_en" style="padding:5px 10px;border-radius:6px;border:2px solid #e2e8f0;background:white;color:#64748b;font-weight:700;font-size:12px;cursor:pointer;">EN</button>
        </div>
        <div style="font-size: 64px; margin-bottom: 20px;">👋</div>
        <h1 id="ob_title" style="
          font-size: 28px;
          font-weight: bold;
          color: #1e293b;
          margin-bottom: 12px;
        ">Benvingut a FocusWork!</h1>
        <p id="ob_subtitle" style="
          font-size: 16px;
          color: #64748b;
          margin-bottom: 30px;
          line-height: 1.5;
        ">
          Abans de començar, si us plau introdueix el teu nom.<br>
          Aquest nom apareixerà als informes que generis.
        </p>
        
        <div style="margin-bottom: 20px;">
          <input 
            type="text" 
            id="onboardingUserName" 
            placeholder="El teu nom..."
            maxlength="50"
            style="
              width: 100%;
              padding: 16px;
              font-size: 16px;
              border: 2px solid #e2e8f0;
              border-radius: 12px;
              outline: none;
              transition: all 0.2s;
              box-sizing: border-box;
            "
            autocomplete="name"
          />
          <div id="onboardingError" style="
            color: #ef4444;
            font-size: 14px;
            margin-top: 8px;
            display: none;
          ">❌ Si us plau, introdueix el teu nom</div>
        </div>
        
        <button 
          id="onboardingConfirm"
          style="
            width: 100%;
            padding: 16px;
            font-size: 18px;
            font-weight: 600;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 12px;
            cursor: pointer;
            transition: all 0.2s;
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
          "
          onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px rgba(102, 126, 234, 0.5)';"
          onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(102, 126, 234, 0.4)';"
        >
          <span id="ob_btn_text">✅ Començar a usar FocusWork</span>
        </button>
        
        <p id="ob_tip" style="
          font-size: 12px;
          color: #94a3b8;
          margin-top: 20px;
        ">
          💡 Pots canviar el teu nom més endavant des de Configuració
        </p>
      </div>
    </div>
  `;
  
  // Afegir a la pàgina
  document.body.insertAdjacentHTML('beforeend', onboardingHTML);

  // Funció per canviar idioma des de l'onboarding
  window.onboardSelectLang = function(lang) {
    // Aplicar idioma si i18n ja carregat
    if (typeof applyLang === 'function') applyLang(lang);
    else {
      localStorage.setItem('fw_lang', lang);
    }
    // Actualitzar botons visuals
    ['ca','es','en'].forEach(l => {
      const btn = document.getElementById('ob_' + l);
      if (!btn) return;
      if (l === lang) {
        btn.style.background = '#667eea';
        btn.style.color = 'white';
        btn.style.borderColor = '#667eea';
      } else {
        btn.style.background = 'white';
        btn.style.color = '#64748b';
        btn.style.borderColor = '#e2e8f0';
      }
    });
    // Traduir els textos de l'onboarding
    const texts = {
      ca: {
        title: 'Benvingut a FocusWork!',
        subtitle: 'Abans de començar, si us plau introdueix el teu nom.<br>Aquest nom apareixerà als informes que generis.',
        placeholder: 'El teu nom...',
        btn: '✅ Començar a usar FocusWork',
        tip: '💡 Pots canviar el teu nom més endavant des de Configuració',
        error: '❌ Si us plau, introdueix el teu nom',
      },
      es: {
        title: '¡Bienvenido a FocusWork!',
        subtitle: 'Antes de empezar, por favor introduce tu nombre.<br>Este nombre aparecerá en los informes que generes.',
        placeholder: 'Tu nombre...',
        btn: '✅ Empezar a usar FocusWork',
        tip: '💡 Puedes cambiar tu nombre más adelante desde Configuración',
        error: '❌ Por favor, introduce tu nombre',
      },
      en: {
        title: 'Welcome to FocusWork!',
        subtitle: 'Before we start, please enter your name.<br>This name will appear in the reports you generate.',
        placeholder: 'Your name...',
        btn: '✅ Start using FocusWork',
        tip: '💡 You can change your name later from Settings',
        error: '❌ Please enter your name',
      },
    };
    const tx = texts[lang] || texts.ca;
    const el = id => document.getElementById(id);
    if (el('ob_title'))    el('ob_title').textContent = tx.title;
    if (el('ob_subtitle')) el('ob_subtitle').innerHTML = tx.subtitle;
    if (el('ob_btn_text')) el('ob_btn_text').textContent = tx.btn;
    if (el('ob_tip'))      el('ob_tip').textContent = tx.tip;
    if (el('onboardingUserName')) el('onboardingUserName').placeholder = tx.placeholder;
    // Guardar el text d'error per a ús posterior
    window._obErrorText = tx.error;
  };

  // Marcar CA com actiu per defecte
  const savedLang = localStorage.getItem('fw_lang') || 'ca';
  window.onboardSelectLang(savedLang);

  const input = document.getElementById('onboardingUserName');
  const button = document.getElementById('onboardingConfirm');
  const error = document.getElementById('onboardingError');
  
  // Focus automàtic al camp
  setTimeout(() => input.focus(), 100);
  
  // Enter per confirmar
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      confirmOnboarding();
    }
  });
  
  // Click al botó
  button.addEventListener('click', confirmOnboarding);
  
  function confirmOnboarding() {
    const name = input.value.trim();
    
    if (!name) {
      // Mostrar error
      if (window._obErrorText) error.innerHTML = window._obErrorText;
      error.style.display = 'block';
      input.style.borderColor = '#ef4444';
      input.focus();
      
      // Animació d'error
      input.style.animation = 'shake 0.5s';
      setTimeout(() => {
        input.style.animation = '';
      }, 500);
      
      return;
    }
    
    // Guardar el nom
    userName = name;
    localStorage.setItem("focowork_user_name", userName);
    
    // Eliminar pantalla d'onboarding amb animació
    const screen = document.getElementById('onboardingScreen');
    screen.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    screen.style.opacity = '0';
    screen.style.transform = 'scale(0.95)';
    
    setTimeout(() => {
      screen.remove();
      
      // Ara sí, inicialitzar l'app
      updateUI();
      scheduleFullAutoBackup();
      
      // Missatge de benvinguda (traduït)
      const _wt = typeof t === 'function';
      showAlert(
        `${_wt ? '' : 'Hola '}${userName}! 👋`,
        _wt ? t('benvingut_missatge') : 'Benvingut a FocusWork.\n\nComença creant el teu primer encàrrec!',
        '🎉'
      );
      
      console.log(`✅ FocusWork inicialitzat per a ${userName}`);
    }, 300);
  }
}

// Afegir animació de shake al CSS global
if (!document.getElementById('onboardingStyles')) {
  const style = document.createElement('style');
  style.id = 'onboardingStyles';
  style.textContent = `
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      10%, 30%, 50%, 70%, 90% { transform: translateX(-10px); }
      20%, 40%, 60%, 80% { transform: translateX(10px); }
    }
  `;
  document.head.appendChild(style);
}

document.addEventListener('DOMContentLoaded', initApp);

/*************************************************
 * NETEJA ÚNICA DE DADES CONTAMINADES
 * Elimina clients acumulats a localStorage de
 * sessions anteriors (fix d'emergència antic).
 * S'executa una sola vegada gràcies a la flag.
 *************************************************/
(function purgeStaleLocalStorage() {
  try {
    if (!localStorage.getItem('fw_localStorage_purged_v1')) {
      localStorage.removeItem('focuswork_clients');
      localStorage.setItem('fw_localStorage_purged_v1', '1');
      console.log('🧹 localStorage de clients purgat (una sola vegada)');
    }
  } catch(e) {}
})();

/*
 * NOTA:
 * El bloc "FIX D'EMERGÈNCIA" que hi havia aquí ha estat eliminat.
 * Causava fins a 238 clients duplicats perquè:
 *   1. Carregava TOTS els clients sense filtrar per user_id
 *   2. Els acumulava a localStorage en cada sessió
 *   3. Sobreescrivia state.clients amb dades barrejades
 *
 * La font de veritat és ÚNICAMENT Supabase (RLS actiu).
 * Flux correcte: loadState() → loadAllClientsSupabase() → state.clients → UI
 */

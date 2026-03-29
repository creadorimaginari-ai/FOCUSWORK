/*************************************************
 * FOCUSWORK – app-ui.js (V4.0 FIXED) - PART 1/5
 * Llicències, Importació i Exportació
 *************************************************/

/*
 * CSS NECESSARI PER AL CORRECTE FUNCIONAMENT:
 * 
 * Afegeix aquest CSS al teu fitxer d'estils:
 * 
 * #photoGallery {
 *   position: relative;
 *   overflow: hidden;
 * }
 * 
 * .photo-thumb {
 *   position: relative;
 *   z-index: 1;
 * }
 * 
 * #photoContainer {
 *   position: relative;
 *   overflow: hidden;
 * }
 * 
 * #lightboxPhoto {
 *   position: absolute;
 *   inset: 0;
 *   z-index: 1;
 * }
 * 
 * #photoCanvas {
 *   position: absolute;
 *   inset: 0;
 *   z-index: 2;
 *   pointer-events: auto;
 * }
 */

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
      if (!license.signature || !license.clientId) {
        showAlert('Arxiu invàlid', 'Aquest no és un arxiu de llicència vàlid', '❌');
        return;
      }
      if (license.expiryDate) {
        const expiry = new Date(license.expiryDate);
        if (expiry < new Date()) {
          showAlert('Llicència caducada', 'Aquesta llicència ha caducat', '⏰');
          return;
        }
      }
      state.isFull = true;
      state.license = license;
      await save();
      updateUI();
      
      const expiryText = license.expiryDate
        ? `Vàlida fins: ${new Date(license.expiryDate).toLocaleDateString()}`
        : 'Sense límit de temps';
      showAlert('Llicència activada!', `FocusWork complet activat\n\nClient: ${license.clientName}\n${expiryText}\n\nGaudeix de clients il·limitats!`, '🎉');
    } catch (err) {
      showAlert('Error', 'No s\'ha pogut llegir l\'arxiu de llicència', '❌');
    }
  };
  input.click();
}

function getDeviceId() {
  let id = localStorage.getItem("focuswork_device_id");
  if (!id) {
    id = "FW-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    localStorage.setItem("focuswork_device_id", id);
  }
  return id;
}

function requestLicense() {
  const deviceId = getDeviceId();
  const message = encodeURIComponent(
    `Hola! Estic utilitzant FocusWork (versió de mostra) i voldria activar la llicència.\n\nDevice ID: ${deviceId}`
  );
  window.location.href = `https://wa.me/${WHATSAPP_PHONE}?text=${message}`;
}

/* ================= EXPORTACIÓ/IMPORTACIÓ ================= */
async function exportCurrentWork() {
  const client = await loadClient(state.currentClientId);
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
  showAlert('Treball desat', 'L\'arxiu s\'ha descarregat correctament.', '💾');
}

async function importWork() {
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
        showAlert('Arxiu invàlid', 'Aquest arxiu no és vàlid', '❌');
        return;
      }
      $('importClientName').textContent = fileData.client.name;
      $('importClientTime').textContent = formatTime(fileData.client.total);
      $('importClientPhotos').textContent = fileData.client.photos?.length || 0;
      $('importClientNotes').textContent = fileData.client.notes ? '✓ Sí' : '— No';
      window.pendingImport = fileData;
      openModal('modalImportWork');
    } catch (err) {
      showAlert('Error', 'No s\'ha pogut llegir l\'arxiu', '❌');
    }
  };
  input.click();
}

async function confirmImport() {
  if (!window.pendingImport) return;
  const workData = window.pendingImport;
  const newId = uid();
  const client = {
    ...workData.client,
    id: newId,
    active: true,
    activities: workData.client.activities || {},
    billableTime: workData.client.billableTime || 0,
    notes: workData.client.notes || '',
    tasks: workData.client.tasks || { urgent: "", important: "", later: "" }
  };
  
  await saveClient(client);
  state.currentClientId = newId;
  state.currentActivity = ACTIVITIES.WORK;
  state.sessionElapsed = 0;
  state.lastTick = Date.now();
  isWorkpadInitialized = false;
  areTasksInitialized = false;
  await save();
  
  await updateUI();
  closeModal('modalImportWork');
  showAlert('Treball importat', `Client "${workData.client.name}" importat correctament`, '✅');
  window.pendingImport = null;
}

function handleBackupFile(backupData) {
  if (!backupData.state || !backupData.version) {
    showAlert('Arxiu invàlid', 'Aquest arxiu està corromput', '❌');
    return;
  }
  const clientCount = Object.keys(backupData.clients || {}).length;
  const activeCount = Object.values(backupData.clients || {}).filter(c => c.active).length;
  $('importBackupClients').textContent = clientCount;
  $('importBackupActive').textContent = activeCount;
  $('importBackupDate').textContent = new Date(backupData.timestamp).toLocaleDateString();
  $('importBackupLicense').textContent = backupData.license ? '✓ Sí' : '— No';
  window.pendingBackup = backupData;
  openModal('modalImportBackup');
}

async function confirmImportBackup() {
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
  
  if (backupData.clients) {
    for (const clientId in backupData.clients) {
      await saveClient(backupData.clients[clientId]);
    }
  }
  
  await save();
  updateUI();
  closeModal('modalImportBackup');
  
  const clientCount = Object.keys(backupData.clients || {}).length;
  showAlert('Backup restaurat', `✅ ${clientCount} clients recuperats`, '🎉');
  window.pendingBackup = null;
  setTimeout(() => location.reload(), 2000);
}

async function exportAllData() {
  const clients = await loadAllClients();
  const exportData = {
    version: APP_VERSION,
    exportDate: new Date().toISOString(),
    timestamp: new Date().toISOString(),
    userName: userName,
    state: state,
    clients: clients,
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
  
  markBackupDone();
  
  const sizeMB = (blob.size / (1024 * 1024)).toFixed(2);
  showAlert('Backup complet', `Dades exportades: ${sizeMB}MB`, '💾');
}
/*************************************************
 * FOCUSWORK – app-ui.js (V4.0 FIXED) - PART 2/5
 * UI i Gestió de Clients
 *************************************************/
async function savePhotoComment(text) {
  const clientId = state.currentClientId;
  if (!clientId) return;

  const client = await loadClient(clientId);
  if (!client || !client.photos) return;

  const photo = client.photos.find(
    p => p.id === window.currentClientPhotos[currentLightboxIndex]?.id
  );
  if (!photo) return;

  photo.comment = text;

  // Guardar el client complet (inclou les fotos)
  await saveClient(client);

  // Actualitzar còpia en memòria perquè UI i dades coincideixin
  window.currentClientPhotos[currentLightboxIndex].comment = text;
  
  // AFEGIT: Guardar també la foto directament a IndexedDB per seguretat
  try {
    await dbPut('photos', {
      id: photo.id,
      clientId: clientId,
      data: photo.data,
      date: photo.date,
      comment: photo.comment || ""
    });
    console.log('💬 Comentari guardat correctament');
    
    // ✅ AFEGIT: Actualitzar badge 💬 de la miniatura
    updatePhotoBadge(photo.id, text);
    
  } catch (e) {
    console.error('Error guardant comentari a IndexedDB:', e);
  }
}

// Funció auxiliar per actualitzar el badge d'una foto específica
function updatePhotoBadge(photoId, comment) {
  const gallery = $("photoGallery");
  if (!gallery) return;
  
  // Buscar la miniatura corresponent
  const thumbnails = gallery.querySelectorAll('.photo-thumb');
  const photos = window.currentClientPhotos;
  
  photos.forEach((p, index) => {
    if (p.id === photoId) {
      const img = thumbnails[index];
      if (!img) return;
      
      const container = img.parentElement;
      if (!container) return;
      
      // Eliminar badge anterior si existeix
      const oldBadge = container.querySelector('.comment-badge');
      if (oldBadge) oldBadge.remove();
      
      // Afegir nou badge si hi ha comentari
      if (comment && comment.trim()) {
        const badge = document.createElement("div");
        badge.className = 'comment-badge';
        badge.style.cssText = `
          position: absolute;
          bottom: 5px;
          left: 5px;
          background: rgba(0,0,0,0.7);
          color: white;
          padding: 3px 8px;
          border-radius: 12px;
          font-size: 11px;
          backdrop-filter: blur(5px);
          pointer-events: none;
        `;
        badge.textContent = '💬';
        container.appendChild(badge);
      }
    }
  });
}
/* ================= UI OPTIMIZADO ================= */
async function updateUI(preloadedClient = null) {
  const activitiesPanel = $('activitiesPanel');
  
  const client = preloadedClient || (state.currentClientId ? await loadClient(state.currentClientId) : null);
  
  const updates = [];
  
  if (!state.currentClientId) {
    updates.push(() => activitiesPanel?.classList.add('single-activity'));
  } else {
    updates.push(() => activitiesPanel?.classList.remove('single-activity'));
  }

  updates.push(() => {
    $("clientName").textContent = client ? `Client: ${client.name}${client.active ? "" : " (tancat)"}` : "Cap encàrrec actiu";
    $("activityName").textContent = state.currentActivity ? activityLabel(state.currentActivity) : "—";
    $("timer").textContent = client && client.active ? formatTime(state.sessionElapsed) : "00:00:00";
    const headerTitle = $("clientHeaderTitle");
    if (headerTitle) headerTitle.textContent = client ? client.name : "Client";
  });

  if ($("clientTotal")) {
    updates.push(() => {
      $("clientTotal").textContent = client ? `Total client: ${formatTime(client.total)}` : "";
    });
  }
  
  if (client && state.focusSchedule.enabled) {
    const billableBox = $("billableTimeBox");
    if (billableBox) {
      updates.push(() => {
        const billableTime = client.billableTime || 0;
        billableBox.textContent = `💰 Facturable: ${formatTime(billableTime)}`;
        billableBox.style.display = "block";
      });
    }
  } else if ($("billableTimeBox")) {
    updates.push(() => {
      $("billableTimeBox").style.display = "none";
    });
  }
  
  if (client && client.deliveryDate) {
    updates.push(() => updateDeliveryDateDisplay(client));
  } else {
    const deliveryBox = $("deliveryDateBox");
    if (deliveryBox) {
      updates.push(() => {
        deliveryBox.style.display = "none";
        deliveryBox.classList.add("hidden");
      });
    }
  }
  
  updates.push(() => {
    document.querySelectorAll(".activity").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.activity === state.currentActivity);
    });
  });
  
  if ($("versionBox")) {
    updates.push(() => {
      $("versionBox").style.display = state.isFull ? "none" : "block";
    });
  }
  
  if (state.isFull && state.license) {
    updates.push(() => updateLicenseInfo());
  }
  
  updates.push(() => updateFocusScheduleStatus());
  
  const exitContainer = $("exitClientContainer");
  const deletePanel = $("deleteClientPanel");
  const clientActionsPanel = $("clientActionsPanel");
  const clientInfoPanel = $("clientInfoPanel");
  
  updates.push(() => {
if (clientInfoPanel) {
  clientInfoPanel.style.display = client ? 'block' : 'none';
}

const fixedBtns = $("clientFixedButtons");
if (fixedBtns) {
  fixedBtns.style.display = client ? "grid" : "none";
  fixedBtns.classList.remove("hidden");
}
    if (exitContainer) {
      if (client) {
        exitContainer.style.display = "block";
        exitContainer.style.height = "";
        exitContainer.style.margin = "";
        exitContainer.style.padding = "";
      } else {
        exitContainer.style.display = "none";
      }
    }
    
    if (deletePanel) {
      if (client && !client.active) {
        deletePanel.style.display = "block";
        deletePanel.style.height = "";
        deletePanel.style.margin = "";
        deletePanel.style.padding = "";
      } else {
        deletePanel.style.display = "none";
      }
    }

    if (clientActionsPanel) {
      if (client && client.active) {
        clientActionsPanel.style.display = 'block';
        clientActionsPanel.style.height = "";
        clientActionsPanel.style.margin = "";
        clientActionsPanel.style.padding = "";
      } else {
        clientActionsPanel.style.display = 'none';
      }
    }
  });
  
  requestAnimationFrame(() => {
    updates.forEach(fn => fn());
  });
  
  const asyncUpdate = async () => {
    try {
      updateWorkpad(client);
      updateTasks(client);
      await renderPhotoGallery(client);
      
      if (client && typeof initProjectStatus === 'function') {
        await initProjectStatus();
      }
    } catch (error) {
      console.error('Error in asyncUpdate:', error);
    }
  };
  
  // Ejecutar inmediatamente pero sin bloquear
  asyncUpdate().catch(err => console.error('asyncUpdate failed:', err));
}

function updateDeliveryDateDisplay(client) {
  const deliveryBox = $("deliveryDateBox");
  if (!deliveryBox) return;
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
  const diffDays = Math.ceil((delivery - today) / (1000 * 60 * 60 * 24));
  
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
    message = `📅 Lliurament: ${deliveryDate.toLocaleDateString("ca-ES")}`;
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
  const expiryText = state.license.expiryDate ? `Vàlida fins: ${new Date(state.license.expiryDate).toLocaleDateString()}` : "Sense límit";
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

/* ================= CLIENTS OPTIMIZADO ================= */
async function newClient() {
  const allClients = await loadAllClients();
  const activeClients = Object.values(allClients).filter(c => c.active);
  if (!state.isFull && activeClients.length >= 2) {
    showAlert('Versió demo', 'Màxim 2 clients actius.\n\nActiva la versió completa per clients il·limitats.', '🔒');
    return;
  }
  $('newClientInput').value = '';
  openModal('modalNewClient');
  setTimeout(() => $('newClientInput').focus(), 300);
}

async function confirmNewClient() {
  const name = $('newClientInput').value.trim();
  if (!name) return;
  const id = uid();
  const client = {
    id,
    name,
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
  
  await saveClient(client);
  state.currentClientId = id;
  state.currentActivity = ACTIVITIES.WORK;
  state.sessionElapsed = 0;
  state.lastTick = Date.now();
  isWorkpadInitialized = false;
  areTasksInitialized = false;
  await save();
  await updateUI();
  closeModal('modalNewClient');
}

async function changeClient() {
  const allClients = await loadAllClients();
  const actives = Object.values(allClients)
    .filter(c => c.active)
    .sort((a, b) => {
      const aHasDate = !!a.deliveryDate;
      const bHasDate = !!b.deliveryDate;
      if (aHasDate && !bHasDate) return -1;
      if (!aHasDate && bHasDate) return 1;
      if (aHasDate && bHasDate) {
        return new Date(a.deliveryDate) - new Date(b.deliveryDate);
      }
      return (a.createdAt || 0) - (b.createdAt || 0);
    });
    
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

async function selectClient(clientId) {
  const previousClient = state.currentClientId;
  
  if (state.currentClientId === clientId) {
    closeModal('modalChangeClient');
    return;
  }
  
  state.currentClientId = clientId;
  
  state.currentActivity = ACTIVITIES.WORK;
  state.sessionElapsed = 0;
  state.lastTick = Date.now();
  
  isWorkpadInitialized = false;
  areTasksInitialized = false;
  
  await save();
  
  const client = await loadClient(clientId);
  
await updateUI(client);

const clientInfoPanel = document.getElementById('clientInfoPanel');
if (clientInfoPanel) clientInfoPanel.style.display = 'block';

const btns = $("clientFixedButtons");
if (btns) btns.style.display = "grid";

closeModal('modalChangeClient');

}   // ← aquesta clau faltava

async function closeClient() {
  const client = await loadClient(state.currentClientId);
  if (!client) return;
  
  if (client.photos.length > 0 || (client.notes && client.notes.trim())) {
    $('exportBeforeCloseText').textContent = `Aquest client té ${client.photos.length} fotos i notes.\n\nVols exportar el treball abans de tancar?`;
    window.clientToClose = client.id;
    openModal('modalExportBeforeClose');
    return;
  }
  
  $('closeClientText').textContent = `Client: ${client.name}\nTemps total: ${formatTime(client.total)}`;
  window.clientToClose = client.id;
  openModal('modalCloseClient');
}

async function confirmCloseClient() {
  const clientId = window.clientToClose || state.currentClientId;
  const client = await loadClient(clientId);
  if (!client) return;

  // Si no s'ha confirmat via facturació, obrir modal de dades primer
  if (!window._billingConfirmed) {
    window.clientToClose = clientId;
    closeModal('modalCloseClient');
    closeModal('modalExportBeforeClose');
    if (typeof openBillingModal === 'function') {
      openBillingModal(clientId);
      return;
    }
  }
  window._billingConfirmed = false;

  client.active = false;
  client.closedAt = Date.now();
  await saveClient(client);

  // Actualitzar state.clients en memòria immediatament
  if (state.clients && state.clients[clientId]) {
    state.clients[clientId].active = false;
    state.clients[clientId].closedAt = client.closedAt;
  }

  state.currentClientId = null;
  state.currentActivity = null;
  state.lastTick = null;
  isWorkpadInitialized = false;
  areTasksInitialized = false;
  await save();
  await updateUI();
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
/*************************************************
 * FOCUSWORK – app-ui.js (V4.0 FIXED) - PART 3/5
 * Històric i Fotos - VERSIÓN CORREGIDA
 *************************************************/

/* ================= HISTÒRIC ================= */
async function showHistory() {
  const allClients = await loadAllClients();
  const closed = Object.values(allClients).filter(c => !c.active);
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
    list.innerHTML = '<p class="modal-text" style="opacity: 0.6;">Sense resultats</p>';
    return;
  }
  
  clients
    .sort((a, b) => (b.closedAt || b.createdAt || 0) - (a.closedAt || a.createdAt || 0))
    .forEach(client => {
      const item = document.createElement('div');
      item.className = 'client-item';
      
      const closedDate = client.closedAt 
        ? new Date(client.closedAt).toLocaleDateString('ca-ES', { day: '2-digit', month: '2-digit' })
        : '';
      
      const notesPreview = client.notes && client.notes.trim() 
        ? ` • ${client.notes.slice(0, 30)}...` 
        : '';
      
      item.innerHTML = `
        <div class="client-name">${client.name} ${closedDate ? `(${closedDate})` : ''}</div>
        <div class="client-time">
          Total: ${formatTime(client.total)} • 
          📷 ${client.photos?.length || 0} fotos${notesPreview}
        </div>
      `;
      
      item.onclick = () => selectHistoryClient(client.id);
      list.appendChild(item);
    });
}

async function selectHistoryClient(clientId) {
  state.currentClientId = clientId;
  state.currentActivity = ACTIVITIES.WORK;
  state.sessionElapsed = 0;
  state.lastTick = Date.now();
  isWorkpadInitialized = false;
  areTasksInitialized = false;
  
  const client = await loadClient(clientId);
await updateUI(client);

// assegurar panell del client visible
const clientInfoPanel = document.getElementById('clientInfoPanel');
if (clientInfoPanel) clientInfoPanel.style.display = 'block';

// assegurar botons visibles
const btns = $("clientFixedButtons");
if (btns) btns.style.display = "grid";

setTimeout(() => {
  renderPhotoGallery(client);
}, 100);

closeModal('modalHistory');

}   // ← tanca selectClient

/* ================= ESBORRAR CLIENT ================= */
async function deleteCurrentClient() {
  const client = await loadClient(state.currentClientId);
  if (!client || client.active) return;
  $('deleteClientText').textContent = `Client: ${client.name}\nTemps: ${formatTime(client.total)}\nFotos: ${client.photos.length}\n\nAquesta acció no es pot desfer.`;
  $('inputDeleteConfirm').value = '';
  openModal('modalDeleteClient');
  setTimeout(() => $('inputDeleteConfirm').focus(), 300);
}

async function confirmDeleteClient() {
  const confirm = $('inputDeleteConfirm').value.trim().toUpperCase();
  if (confirm !== 'ESBORRAR') {
    showAlert('Error', 'Has d\'escriure ESBORRAR per confirmar', '⚠️');
    return;
  }
  
  await deleteClient(state.currentClientId);
  state.currentClientId = null;
  state.currentActivity = null;
  state.lastTick = null;
  isWorkpadInitialized = false;
  areTasksInitialized = false;
  await save();
  await updateUI();
  closeModal('modalDeleteClient');
  showAlert('Client eliminat', 'El client ha estat eliminat definitivament', '🗑️');
}

/* ================= FOTOS OPTIMIZADO Y CORREGIDO - VERSIÓ FINAL ================= */
let photoToDelete = null;

async function addPhotoToClient() {
  if (!state.currentClientId) {
    showAlert('Error', 'Selecciona un client primer', '⚠️');
    return;
  }
  
  const client = await loadClient(state.currentClientId);
  if (!client) {
    showAlert('Error', 'Client no trobat', '⚠️');
    return;
  }
  
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  
  input.style.cssText = `
    position: absolute;
    left: -9999px;
    opacity: 0.01;
  `;
  document.body.appendChild(input);
  
  input.onchange = async () => {
    const file = input.files[0];
    
    if (input.parentNode) {
      document.body.removeChild(input);
    }
    
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      showAlert('Error', 'Si us plau, selecciona una imatge', '⚠️');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = async () => {
      const img = new Image();
      img.onload = async () => {
        const MAX = 1920;
        let width = img.width;
        let height = img.height;
        
        if (width > MAX || height > MAX) {
          const ratio = Math.min(MAX / width, MAX / height);
          width = Math.floor(width * ratio);
          height = Math.floor(height * ratio);
        }
        
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        
        const dataURL = canvas.toDataURL("image/jpeg", 0.85);
        
        const photoObj = {
          id: uid(),
          date: new Date().toISOString(),
          data: dataURL,
          comment: ""
        };
        
        const currentClient = await loadClient(state.currentClientId);
        if (!currentClient) {
          showAlert('Error', 'S\'ha perdut la referència al client', '⚠️');
          return;
        }
        
        currentClient.photos.push(photoObj);
        
        try {
          await saveClient(currentClient);
          renderPhotoGallery(currentClient);
          showAlert('Foto afegida', 'La foto s\'ha afegit correctament', '✅');
        } catch (e) {
          showAlert('Error', 'No s\'ha pogut guardar: ' + e.message, '❌');
        }
      };
      
      img.onerror = () => {
        showAlert('Error', 'No s\'ha pogut processar la imatge', '❌');
      };
      
      img.src = reader.result;
    };
    
    reader.onerror = () => {
      showAlert('Error', 'No s\'ha pogut llegir l\'arxiu', '❌');
    };
    
    reader.readAsDataURL(file);
  };
  
  input.oncancel = () => {
    if (input.parentNode) {
      document.body.removeChild(input);
    }
  };
  
  input.click();
}

// ✅ NOTA: renderPhotoGallery ara és un alias de renderFileGallery
// Això assegura que SEMPRE es mostrin tots els arxius (fotos + vídeos + PDFs + àudios)
async function renderPhotoGallery(preloadedClient = null) {
  return await renderFileGallery(preloadedClient);
}


async function confirmDeletePhoto() {
  if (!photoToDelete) return;
  
  const client = await loadClient(state.currentClientId);
  if (!client) {
    closeModal('modalDeletePhoto');
    showAlert('Error', 'Client no trobat', '⚠️');
    return;
  }
  
  try {
    await dbDelete('photos', photoToDelete);
    
    client.photos = client.photos.filter(f => f.id !== photoToDelete);
    
    await saveClient(client);
    
    closeModal('modalDeletePhoto');
    
    photoToDelete = null;
    
    await renderFileGallery(client);
    
    showAlert('Foto eliminada', 'La foto s\'ha eliminat correctament', '✅');
  } catch (e) {
    console.error('Error esborrant foto:', e);
    showAlert('Error', 'No s\'ha pogut esborrar la foto: ' + e.message, '❌');
    closeModal('modalDeletePhoto');
  }
}

// ✅ Funció per l'input amb label (iPad compatible)
async function handlePhotoInputiPad(input) {
  console.log('📸 handlePhotoInputiPad iniciada');
  
  const file = input.files[0];
  if (!file) {
    console.log('⚠️ Cap fitxer seleccionat');
    return;
  }
  
  console.log('✅ Fitxer rebut:', file.name, file.type);
  
  if (!state.currentClientId) {
    showAlert('Error', 'Selecciona un client primer', '⚠️');
    input.value = '';
    return;
  }
  
  if (!file.type.startsWith('image/')) {
    showAlert('Error', 'Si us plau, selecciona una imatge', '⚠️');
    input.value = '';
    return;
  }
  
  console.log('🔵 Processant imatge...');
  
  const reader = new FileReader();
  
  reader.onload = async () => {
    const img = new Image();
    
    img.onload = async () => {
      console.log('✅ Imatge carregada:', img.width, 'x', img.height);
      
      try {
        const MAX = 1920;
        let width = img.width;
        let height = img.height;
        
        if (width > MAX || height > MAX) {
          const ratio = Math.min(MAX / width, MAX / height);
          width = Math.floor(width * ratio);
          height = Math.floor(height * ratio);
        }
        
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        
        const dataURL = canvas.toDataURL("image/jpeg", 0.85);
        console.log('✅ JPEG generat');
        
        const photoObj = {
          id: uid(),
          date: new Date().toISOString(),
          data: dataURL,
          comment: ""
        };
        
        const client = await loadClient(state.currentClientId);
        if (!client) {
          showAlert('Error', 'Client no trobat', '⚠️');
          input.value = '';
          return;
        }
        
        client.photos.push(photoObj);
        
        await saveClient(client);
        console.log('✅ Client guardat amb', client.photos.length, 'fotos');
        
        await renderFileGallery(client);
        console.log('✅ Galeria actualitzada');
        
        showAlert('Foto afegida', 'La foto s\'ha afegit correctament', '✅');
        
      } catch (error) {
        console.error('❌ Error processant:', error);
        showAlert('Error', 'No s\'ha pogut processar la imatge: ' + error.message, '❌');
      }
      
      input.value = '';
    };
    
    img.onerror = () => {
      console.error('❌ Error carregant imatge');
      showAlert('Error', 'No s\'ha pogut carregar la imatge', '❌');
      input.value = '';
    };
    
    img.src = reader.result;
  };
  
  reader.onerror = () => {
    console.error('❌ Error llegint fitxer');
    showAlert('Error', 'No s\'ha pogut llegir el fitxer', '❌');
    input.value = '';
  };
  
  reader.readAsDataURL(file);
}/* ================= FUNCIÓ PER GESTIONAR ARXIUS A L'IPAD ================= */
/* AFEGEIX aquesta funció al fitxer app-ui.js (després de handlePhotoInputiPad) */

async function handleFileInputiPad(input) {
  console.log('📎 handleFileInputiPad iniciada');
  
  const file = input.files[0];
  if (!file) {
    console.log('⚠️ Cap fitxer seleccionat');
    return;
  }
  
  console.log('✅ Fitxer rebut:', file.name, file.type, formatFileSize(file.size));
  
  if (!state.currentClientId) {
    showAlert('Error', 'Selecciona un client primer', '⚠️');
    input.value = '';
    return;
  }
  
  const client = await loadClient(state.currentClientId);
  if (!client) {
    showAlert('Error', 'Client no trobat', '⚠️');
    input.value = '';
    return;
  }
  
  const fileType = getFileType(file.type);
  const maxSize = getMaxSize(fileType);
  
  // Validar mida
  if (file.size > maxSize) {
    showAlert('Arxiu massa gran', `Mida màxima per ${fileType}: ${formatFileSize(maxSize)}`, '⚠️');
    input.value = '';
    return;
  }
  
  console.log('🔵 Processant arxiu tipus:', fileType);
  
  // Processar segons el tipus
  if (fileType === 'image') {
    await processImageFile(file, client);
  } else if (fileType === 'video') {
    await processVideoFile(file, client);
  } else {
    await processGenericFile(file, client);
  }
  
  // Netejar input per permetre seleccionar el mateix arxiu de nou
  input.value = '';
}

// Exportar la funció globalment
window.handleFileInputiPad = handleFileInputiPad;

console.log('✅ handleFileInputiPad carregada');

/*************************************************
 * FOCUSWORK – app-ui.js (V4.0 FIXED) - PART 4/5
 * Workpad, Tasques, Hores Extra, Informe
 *************************************************/

/* ================= WORKPAD OPTIMIZADO ================= */
let workpadTimeout = null;
let isWorkpadInitialized = false;

async function updateWorkpad(preloadedClient = null) {
  const workpadArea = $('clientWorkpad');
  const workpadContainer = document.querySelector('.workpad-container');
  
  const client = preloadedClient || (state.currentClientId ? await loadClient(state.currentClientId) : null);
  
  if (!workpadArea || !workpadContainer || !client) {
    if (workpadContainer) workpadContainer.style.display = 'none';
    isWorkpadInitialized = false;
    return;
  }
  
  workpadContainer.style.display = 'block';
  const savedNote = client.notes || '';
  
  if (!workpadArea.matches(':focus')) {
    if (!isWorkpadInitialized || workpadArea.value !== savedNote) {
      workpadArea.value = savedNote;
    }
  }
  
  if (!isWorkpadInitialized) {
    workpadArea.oninput = handleWorkpadInput;
    isWorkpadInitialized = true;
  }
}

async function handleWorkpadInput(e) {
  const client = await loadClient(state.currentClientId);
  if (!client) return;
  
  client.notes = e.target.value;
  clearTimeout(workpadTimeout);
  workpadTimeout = setTimeout(async () => {
    await saveClient(client);
  }, 1000);
}

/* ================= TASQUES OPTIMIZADO ================= */
let taskTimeouts = { urgent: null, important: null, later: null };
let areTasksInitialized = false;

async function updateTasks(preloadedClient = null) {
  const client = preloadedClient || (state.currentClientId ? await loadClient(state.currentClientId) : null);
  
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
      const dateStr = deliveryDate.toLocaleDateString('ca-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
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
    
    if (!urgentArea.matches(':focus')) urgentArea.value = urgentText;
    if (!importantArea.matches(':focus')) importantArea.value = client.tasks.important || '';
    if (!laterArea.matches(':focus')) laterArea.value = client.tasks.later || '';
    
    urgentArea.oninput = (e) => handleTaskInput('urgent', e);
    importantArea.oninput = (e) => handleTaskInput('important', e);
    laterArea.oninput = (e) => handleTaskInput('later', e);
    areTasksInitialized = true;
  }
}

async function handleTaskInput(taskType, e) {
  const client = await loadClient(state.currentClientId);
  if (!client || !client.tasks) return;
  client.tasks[taskType] = e.target.value;
  clearTimeout(taskTimeouts[taskType]);
  taskTimeouts[taskType] = setTimeout(async () => {
    await saveClient(client);
  }, 1000);
}

async function setDeliveryDate() {
  const client = await loadClient(state.currentClientId);
  if (!client) {
    showAlert('Sense client', 'Selecciona un client primer', '⚠️');
    return;
  }
  const currentDate = client.deliveryDate ? new Date(client.deliveryDate).toISOString().split('T')[0] : '';
  $('inputDeliveryDate').value = currentDate;
  openModal('modalDeliveryDate');
  setTimeout(() => $('inputDeliveryDate').focus(), 300);
}

async function saveDeliveryDate() {
  const client = await loadClient(state.currentClientId);
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
  await saveClient(client);
  await updateUI();
  closeModal('modalDeliveryDate');
}

/* ================= HORES EXTRES ================= */
async function addExtraHours() {
  const client = await loadClient(state.currentClientId);
  if (!client) {
    showAlert('Sense client', 'Selecciona un client primer', '⚠️');
    return;
  }
  $('inputExtraHours').value = '';
  $('inputExtraDescription').value = '';
  openModal('modalExtraHours');
  setTimeout(() => $('inputExtraHours').focus(), 300);
}

async function saveExtraHours() {
  const client = await loadClient(state.currentClientId);
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
  await saveClient(client);
  closeModal('modalExtraHours');
  showAlert('Hores afegides', `${hours}h afegides correctament\n\n"${extraEntry.description}"`, '✅');
}

async function showExtraHours() {
  const client = await loadClient(state.currentClientId);
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

async function deleteExtraHour(entryId) {
  const client = await loadClient(state.currentClientId);
  if (!client || !client.extraHours) return;
  const entry = client.extraHours.find(e => e.id === entryId);
  if (!entry) return;
  if (!confirm(`Eliminar ${entry.hours}h d'hores extres?\n\n"${entry.description}"`)) return;
  client.extraHours = client.extraHours.filter(e => e.id !== entryId);
  client.billableTime = (client.billableTime || 0) - entry.seconds;
  await saveClient(client);
  closeModal('modalViewExtraHours');
  showAlert('Hora eliminada', 'L\'entrada d\'hores extres ha estat eliminada', '🗑️');
}

/* ================= INFORME ================= */
async function generateReport() {
  const client = await loadClient(state.currentClientId);
  if (!client) {
    showAlert('Sense client', 'Selecciona un client primer', '⚠️');
    return;
  }
  const billableTime = client.billableTime || 0;
  const extraHoursTotal = (client.extraHours || []).reduce((sum, e) => sum + e.seconds, 0);
  
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
  
  const notesSection = client.notes && client.notes.trim() ? `\n📝 NOTES:\n${client.notes}\n` : '';
  
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
  
  const scheduleInfo = state.focusSchedule.enabled ? `\n⏰ HORARI FACTURABLE: ${state.focusSchedule.start} - ${state.focusSchedule.end}\n` : '\n⏰ Sense horari facturable configurat (tot el temps compta)\n';

  let photosSection = '';

if (client.photos && client.photos.length > 0) {
  photosSection += '\n📷 FOTOGRAFIES\n\n';

  client.photos.forEach((photo, index) => {
    photosSection += `Foto ${index + 1}\n`;

    // només el comentari, no la imatge
    if (photo.comment && photo.comment.trim() !== '') {
      photosSection += photo.comment.trim() + '\n';
    }

    photosSection += '\n';
  });
}


  const reportText = 
    `┌────────────────────────────────┐\n` +
    `       📋 INFORME DE PROJECTE\n` +
    `└────────────────────────────────┘\n\n` +
    `👤 CLIENT: ${client.name}\n` +
    `📅 Data: ${new Date().toLocaleDateString('ca-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}\n` +
    `👨‍💼 Responsable: ${userName}\n` +
    deliverySection + scheduleInfo +
    `\n────────────────────────────────\n` +
    `⏱️ TEMPS TOTAL TREBALLAT: ${formatTime(client.total)}\n` +
    `💰 TEMPS FACTURABLE: ${formatTime(billableTime)}\n` +
    `${extraHoursSection}` + activitiesBreakdown +
    photosSection + notesSection +

    `\n────────────────────────────────\n` +
    `Generat amb FocoWork v${APP_VERSION}\n` +
    `────────────────────────────────`;
  
  $('reportContent').textContent = reportText;
  openModal('modalReport');
}

function copyReport() {
  const reportText = $('reportContent').textContent;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(reportText).then(() => {
      showAlert('Copiat', 'Informe copiat al porta-retalls', '✅');
    }).catch(() => fallbackCopy(reportText));
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
    showAlert('Error', 'No s\'ha pogut copiar', '⚠️');
  }
  document.body.removeChild(textarea);
}

async function shareReport() {
  const reportText = $('reportContent').textContent;
  const client = await loadClient(state.currentClientId);
  if (!client) return;
  const files = [];
  for (let i = 0; i < client.photos.length; i++) {
    const p = client.photos[i];
    try {
      const res = await fetch(p.data);
      const blob = await res.blob();
      const file = new File([blob], `foto_${i + 1}.jpg`, { type: blob.type });
      files.push(file);
    } catch (err) {
      console.error('Error processant foto:', err);
    }
  }
  if (navigator.share && (!files.length || navigator.canShare({ files }))) {
    try {
      await navigator.share({ title: `Informe - ${client.name}`, text: reportText, files: files });
    } catch (err) {
      copyReport();
    }
  } else {
    copyReport();
  }
}
/*************************************************
 * FOCUSWORK – app-ui.js (V4.0 FIXED) - PART 5/5
 * Enfocament, CSV, Horaris, Bulk Delete, Events i Lightbox
 *************************************************/

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
async function exportTodayCSV() {
  const allClients = await loadAllClients();
  let csv = "Usuari,Client,Temps,Notes\n";
  Object.values(allClients).forEach(c => {
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
  const message = enabled ? `Horari activat: ${start} - ${end}\n\nL'enfocament només comptabilitzarà temps dins d'aquest horari.` : 'Horari desactivat\n\nL\'enfocament comptabilitzarà tot el temps treballat.';
  showAlert('Configuració desada', message, '✅');
}

/* ================= ESBORRAT MASSIU ================= */
async function showBulkDeleteModal() {
  const allClients = await loadAllClients();
  const closedClients = Object.values(allClients).filter(c => !c.active);
  
  if (!closedClients.length) {
    showAlert('Sense clients tancats', 'No hi ha clients tancats per esborrar', 'ℹ️');
    return;
  }
  
  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;
  
  const lastWeek = closedClients.filter(c => {
    const closedDate = c.closedAt || c.createdAt || 0;
    return (now - closedDate) <= 7 * DAY;
  });
  
  const last2Weeks = closedClients.filter(c => {
    const closedDate = c.closedAt || c.createdAt || 0;
    return (now - closedDate) > 7 * DAY && (now - closedDate) <= 14 * DAY;
  });
  
  const lastMonth = closedClients.filter(c => {
    const closedDate = c.closedAt || c.createdAt || 0;
    return (now - closedDate) > 14 * DAY && (now - closedDate) <= 30 * DAY;
  });
  
  const older = closedClients.filter(c => {
    const closedDate = c.closedAt || c.createdAt || 0;
    return (now - closedDate) > 30 * DAY;
  });
  
  const list = $('bulkDeleteList');
  list.innerHTML = `
    <div style="margin-bottom: 20px; padding: 15px; background: #fef3c7; border-radius: 10px; border-left: 4px solid #f59e0b;">
      <strong>⚠️ Atenció:</strong> Aquesta acció NO es pot desfer.<br>
      <strong>Recomanació:</strong> Fes una còpia de seguretat abans d'esborrar.
    </div>
    
    <div style="display: flex; flex-direction: column; gap: 10px;">
      ${lastWeek.length > 0 ? `
        <button class="bulk-delete-btn" onclick="confirmBulkDelete(7)" style="background: #10b981; color: white; padding: 12px; border-radius: 8px; border: none; cursor: pointer; text-align: left;">
          <div style="font-weight: 600;">📅 Última setmana (${lastWeek.length} clients)</div>
          <div style="font-size: 13px; opacity: 0.9; margin-top: 4px;">Esborrar clients tancats fa menys de 7 dies</div>
        </button>
      ` : ''}
      
      ${last2Weeks.length > 0 ? `
        <button class="bulk-delete-btn" onclick="confirmBulkDelete(14)" style="background: #3b82f6; color: white; padding: 12px; border-radius: 8px; border: none; cursor: pointer; text-align: left;">
          <div style="font-weight: 600;">📅 Últimes 2 setmanes (${last2Weeks.length} clients)</div>
          <div style="font-size: 13px; opacity: 0.9; margin-top: 4px;">Esborrar clients entre 7 i 14 dies</div>
        </button>
      ` : ''}
      
      ${lastMonth.length > 0 ? `
        <button class="bulk-delete-btn" onclick="confirmBulkDelete(30)" style="background: #f59e0b; color: white; padding: 12px; border-radius: 8px; border: none; cursor: pointer; text-align: left;">
          <div style="font-weight: 600;">📅 Últim mes (${lastMonth.length} clients)</div>
          <div style="font-size: 13px; opacity: 0.9; margin-top: 4px;">Esborrar clients entre 14 i 30 dies</div>
        </button>
      ` : ''}
      
      ${older.length > 0 ? `
        <button class="bulk-delete-btn" onclick="confirmBulkDelete(999)" style="background: #ef4444; color: white; padding: 12px; border-radius: 8px; border: none; cursor: pointer; text-align: left;">
          <div style="font-weight: 600;">📅 Més antics (${older.length} clients)</div>
          <div style="font-size: 13px; opacity: 0.9; margin-top: 4px;">Esborrar clients de fa més de 30 dies</div>
        </button>
      ` : ''}
      
      <button class="bulk-delete-btn" onclick="confirmBulkDelete('all')" style="background: #dc2626; color: white; padding: 12px; border-radius: 8px; border: none; cursor: pointer; text-align: left; margin-top: 10px;">
        <div style="font-weight: 600;">🗑️ TOTS els clients tancats (${closedClients.length} clients)</div>
        <div style="font-size: 13px; opacity: 0.9; margin-top: 4px;">⚠️ PERILL: Esborra tot l'històric</div>
      </button>
    </div>
  `;
  
  openModal('modalBulkDelete');
}

async function confirmBulkDelete(period) {
  const allClients = await loadAllClients();
  const closedClients = Object.values(allClients).filter(c => !c.active);
  
  let toDelete = [];
  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;
  
  if (period === 'all') {
    toDelete = closedClients;
  } else if (period === 7) {
    toDelete = closedClients.filter(c => {
      const closedDate = c.closedAt || c.createdAt || 0;
      return (now - closedDate) <= 7 * DAY;
    });
  } else if (period === 14) {
    toDelete = closedClients.filter(c => {
      const closedDate = c.closedAt || c.createdAt || 0;
      return (now - closedDate) > 7 * DAY && (now - closedDate) <= 14 * DAY;
    });
  } else if (period === 30) {
    toDelete = closedClients.filter(c => {
      const closedDate = c.closedAt || c.createdAt || 0;
      return (now - closedDate) > 14 * DAY && (now - closedDate) <= 30 * DAY;
    });
  } else if (period === 999) {
    toDelete = closedClients.filter(c => {
      const closedDate = c.closedAt || c.createdAt || 0;
      return (now - closedDate) > 30 * DAY;
    });
  }
  
  if (!toDelete.length) {
    showAlert('Sense clients', 'No hi ha clients per esborrar en aquest període', 'ℹ️');
    return;
  }
  
  let totalPhotos = 0;
  toDelete.forEach(c => totalPhotos += c.photos?.length || 0);
  
  const periodText = period === 'all' ? 'TOTS els clients tancats' :
                     period === 7 ? 'clients de l\'última setmana' :
                     period === 14 ? 'clients de les últimes 2 setmanes' :
                     period === 30 ? 'clients de l\'últim mes' :
                     'clients de fa més de 30 dies';
  
  const confirmed = confirm(
    `⚠️ ATENCIÓ: Vols esborrar ${toDelete.length} clients (${periodText})?\n\n` +
    `📷 Total fotos: ${totalPhotos}\n\n` +
    `Aquesta acció NO es pot desfer.\n\n` +
    `Escriu OK per confirmar.`
  );
  
  if (!confirmed) return;
  
  const finalConfirm = prompt(
    `Escriu ESBORRAR (en majúscules) per confirmar l'eliminació de ${toDelete.length} clients:`
  );
  
  if (finalConfirm !== 'ESBORRAR') {
    showAlert('Cancel·lat', 'Operació cancel·lada', 'ℹ️');
    return;
  }
  
  closeModal('modalBulkDelete');
  showAlert('Esborrant...', `Esborrant ${toDelete.length} clients...`, '⏳');
  
  let deleted = 0;
  for (const client of toDelete) {
    try {
      await deleteClient(client.id);
      deleted++;
    } catch (e) {
      console.error('Error esborrant client:', client.name, e);
    }
  }
  
  setTimeout(() => {
    showAlert(
      'Esborrat complet', 
      `✅ S'han esborrat ${deleted} de ${toDelete.length} clients\n📷 ${totalPhotos} fotos eliminades`, 
      '🗑️'
    );
  }, 500);
  
  if (state.currentClientId) {
    const wasDeleted = toDelete.find(c => c.id === state.currentClientId);
    if (wasDeleted) {
      state.currentClientId = null;
      state.currentActivity = null;
      state.lastTick = null;
      await save();
      await updateUI();
    }
  }
}

/* ================= EVENT LISTENERS ================= */
document.addEventListener('DOMContentLoaded', () => {
  if ($('focusPriorityBtn')) $('focusPriorityBtn').onclick = () => { if (typeof showClientsOverview === 'function') showClientsOverview(); else changeClient(); };
  if ($('newClientBtn')) $('newClientBtn').onclick = newClient;
  if ($('changeClient')) $('changeClient').onclick = changeClient;
  if ($('historyBtn')) $('historyBtn').onclick = showHistory;
  if ($('closeClient')) $('closeClient').onclick = closeClient;
  if ($('exitClientBtn')) $('exitClientBtn').onclick = exitClient;
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
  
  document.querySelectorAll('.activity').forEach(btn => {
    btn.onclick = () => setActivity(btn.dataset.activity);
  });
  
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal(overlay.id);
    });
  });
  
  if ($('newClientInput')) {
    $('newClientInput').addEventListener('keypress', e => {
      if (e.key === 'Enter') confirmNewClient();
    });
  }
  
  if ($('inputDeleteConfirm')) {
    $('inputDeleteConfirm').addEventListener('keypress', e => {
      if (e.key === 'Enter') confirmDeleteClient();
    });
  }
  
  if ($('searchHistory')) {
    $('searchHistory').addEventListener('input', async (e) => {
      const query = e.target.value.toLowerCase();
      const allClients = await loadAllClients();
      const closed = Object.values(allClients).filter(c => !c.active);
      const filtered = closed.filter(c =>
        c.name.toLowerCase().includes(query) ||
        (c.notes || '').toLowerCase().includes(query)
      );
      renderHistoryList(filtered);
    });
  }
  
  let focusLongPressTimer;
  if ($('focusBtn')) {
    $('focusBtn').addEventListener('mousedown', () => {
      focusLongPressTimer = setTimeout(() => {
        if (confirm('Reiniciar dades d\'enfocament d\'avui?\n\nAixò NO afecta als temps de clients.')) {
          resetTodayFocus();
        }
      }, 2000);
    });
    $('focusBtn').addEventListener('mouseup', () => clearTimeout(focusLongPressTimer));
    $('focusBtn').addEventListener('touchstart', () => {
      focusLongPressTimer = setTimeout(() => {
        if (confirm('Reiniciar dades d\'enfocament d\'avui?\n\nAixò NO afecta als temps de clients.')) {
          resetTodayFocus();
        }
      }, 2000);
    });
    $('focusBtn').addEventListener('touchend', () => clearTimeout(focusLongPressTimer));
  }
  
  if (state.license && state.license.expiryDate) {
    const expiry = new Date(state.license.expiryDate);
    if (expiry < new Date()) {
      state.isFull = false;
      state.license = null;
      save();
      showAlert('Llicència caducada', 'La teva llicència ha caducat.', '⏰');
    }
  }
  
  // Nota: updateBackupButtonStatus ha estat eliminat per evitar canvis de color automàtics
});

/* ================= EXPORTAR FUNCIONS GLOBALS ================= */
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
window.showBulkDeleteModal = showBulkDeleteModal;
window.confirmBulkDelete = confirmBulkDelete;
window.deleteExtraHour = deleteExtraHour;
window.exitClient = exitClient;  // ⬅️ AFEGIT

/* ================= LIGHTBOX PER GALERIA ================= */
let currentLightboxIndex = 0;

function openLightbox(photos, index) {
  window.currentClientPhotos = photos;
  currentLightboxIndex = index;
  
  const lightbox = $('lightbox');
  if (lightbox) {
    lightbox.classList.add('active');
    
    // CANVI: Inicialitzar canvas PRIMER
    initPhotoCanvas();
    
    // Després mostrar foto
    updateLightboxDisplay();
    
    // Zoom al final amb més temps
    setTimeout(() => {
      if (typeof initZoomSystem === 'function') {
        initZoomSystem();
      }
    }, 300);
    
    document.body.style.overflow = 'hidden';
  }
}

// ✅ Nueva función que abre el lightbox por ID de foto
function openLightboxById(photoId) {
  const photos = window.currentClientPhotos;
  if (!photos || !photos.length) return;
  
  // Buscar el índice de la foto con este ID
  const index = photos.findIndex(p => p.id === photoId);
  
  if (index === -1) {
    console.error('Foto no trobada:', photoId);
    return;
  }
  
  // Llamar a la función original con el índice correcto
  openLightbox(photos, index);
}

function closeLightbox() {
  const lightbox = $('lightbox');
  if (lightbox) {
    lightbox.classList.remove('active');
    
    // Netejar sistema de zoom
    if (typeof cleanupZoomSystem === 'function') {
      cleanupZoomSystem();
    }
    
    document.body.style.overflow = 'auto';
  }
}

function updateLightboxDisplay() {
  const photos = window.currentClientPhotos;
  if (!photos || !photos.length) return;
  
  const photo = photos[currentLightboxIndex];
  if (!photo) return;
   // Reset zoom quan canviem de foto
  if (typeof resetZoom === 'function') {
    resetZoom();
  }
  
  // Actualitzar canvas amb la imatge
initPhotoCanvas();
if (photoCanvas && photoCtx) {
  const img = new Image();
  img.onload = () => {
    photoCanvas.width = img.width;
    photoCanvas.height = img.height;
    photoCtx.drawImage(img, 0, 0);

    // Inicialitzar drawingCanvas (capa de dibuix separada)
    const dc = document.getElementById('drawingCanvas');
    if (dc) {
      dc.width  = img.width;
      dc.height = img.height;
      // No forçar mides CSS en píxels fixos: el CSS max-width:100% ja escala correctament
      // Forçar-les causava desincronització entre mida visual i mida interna del canvas
      dc.style.width  = '';
      dc.style.height = '';
      window.drawingCanvas = dc;
      window.drawingCtx    = dc.getContext('2d');
      dc.style.pointerEvents = 'none'; // inactiu per defecte
    }

    // Guardar foto original
    originalPhotoData = photo.data || photo.url;

    // Iniciar historial
    drawHistory = [];
    saveDrawState();

    // Inicialitzar sistema de dibuix (sempre re-inicialitzar per netejar handlers antics)
    setupCanvasDrawing();
    delete photoCanvas._drawingInitialized;

    // Reset eina activa
    currentTool = 'none';
    drawingEnabled = false;
    fillModeEnabled = false;
    totalRotationDeg = 0;
    Object.values(TOOL_IDS).forEach(id => document.getElementById(id)?.classList.remove('active'));

    // Inicialitzar knob de rotació
    initRotateKnob();
  };
  img.src = photo.data || photo.url;
}
  const commentInput = $('lightboxComment');

if (commentInput) {
  const template =
`Projecte:
Lloc:
Mides:
Disseny:
Material:
Hores:
Entrega:
`;

  let commentText = photo.comment || '';

  // només plantilla a la primera foto visible
  if (!commentText.trim() && currentLightboxIndex === 0) {
    commentText = template;
    photo.comment = template;
  }

  commentInput.value = commentText;
  commentInput.oninput = () => savePhotoComment(commentInput.value);
}
  
  const counter = $('lightboxCounter');
  if (counter) {
    counter.textContent = `${currentLightboxIndex + 1} / ${photos.length}`;
  }
  
  const dateEl = $('lightboxDate');
  if (dateEl) {
    const date = new Date(photo.date);
    dateEl.textContent = date.toLocaleDateString('ca-ES', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
  
  const prevBtn = document.querySelector('.lightbox-nav-prev');
  const nextBtn = document.querySelector('.lightbox-nav-next');
  
  if (prevBtn) {
    if (currentLightboxIndex === 0) {
      prevBtn.classList.add('disabled');
    } else {
      prevBtn.classList.remove('disabled');
    }
  }
  
  if (nextBtn) {
    if (currentLightboxIndex === photos.length - 1) {
      nextBtn.classList.add('disabled');
    } else {
      nextBtn.classList.remove('disabled');
    }
  }
  // AFEGIR AIXÒ AQUÍ ↓
  
  // Forçar visibilitat del canvas
  setTimeout(() => {
    if (photoCanvas) {
      photoCanvas.style.display = 'block';
      photoCanvas.style.visibility = 'visible';
      photoCanvas.style.opacity = '1';
      console.log('✅ Canvas forçat visible');
    }
  }, 100);
 }  // ← Ara tanca la funció

function prevPhoto() {
  if (drawHistory.length > 1 && drawingEnabled) {
    const confirmed = confirm('⚠️ Tens dibuixos sense guardar. Vols canviar de foto igualment?\n\nPrem "Guardar canvis" abans de canviar de foto per no perdre els dibuixos.');
    if (!confirmed) return;
  }
  
  if (currentLightboxIndex > 0) {
    currentLightboxIndex--;
    updateLightboxDisplay();
  }
}

function nextPhoto() {
  if (drawHistory.length > 1 && drawingEnabled) {
    const confirmed = confirm('⚠️ Tens dibuixos sense guardar. Vols canviar de foto igualment?\n\nPrem "Guardar canvis" abans de canviar de foto per no perdre els dibuixos.');
    if (!confirmed) return;
  }
  
  const photos = window.currentClientPhotos;
  if (photos && currentLightboxIndex < photos.length - 1) {
    currentLightboxIndex++;
    updateLightboxDisplay();
  }
}
async function downloadCurrentPhoto() {
  const photos = window.currentClientPhotos;
  if (!photos || !photos[currentLightboxIndex]) return;
  
  const photo = photos[currentLightboxIndex];
  const a = document.createElement('a');
  a.href = photo.data;
  
  const client = await loadClient(state.currentClientId);
  const fileName = client ? 
    `${client.name.replace(/[^a-z0-9]/gi, '_')}_foto_${currentLightboxIndex + 1}.jpg` :
    `foto_${currentLightboxIndex + 1}.jpg`;
  
  a.download = fileName;
  a.click();
  
  showAlert('Foto descarregada', 'La foto s\'ha descarregat correctament', '📥');
}

async function shareCurrentPhoto() {
  const photos = window.currentClientPhotos;
  if (!photos || !photos[currentLightboxIndex]) return;
  
  const photo = photos[currentLightboxIndex];
  
  if (navigator.share && navigator.canShare) {
    try {
      const res = await fetch(photo.data);
      const blob = await res.blob();
      const file = new File([blob], `foto_${currentLightboxIndex + 1}.jpg`, { type: 'image/jpeg' });
      
      await navigator.share({
        title: 'FocusWork - Foto',
        files: [file]
      });
    } catch (e) {
      if (e.name !== 'AbortError') {
        showAlert('Error', 'No s\'ha pogut compartir la foto', '❌');
      }
    }
  } else {
    showAlert('No disponible', 'La compartició no està disponible en aquest navegador', 'ℹ️');
  }
}

async function deleteCurrentPhoto() {
  const photos = window.currentClientPhotos;
  if (!photos || !photos[currentLightboxIndex]) return;
  
  const photo = photos[currentLightboxIndex];
  
  const confirmed = confirm(
    `⚠️ Vols esborrar aquesta foto?\n\n` +
    `Foto ${currentLightboxIndex + 1} de ${photos.length}\n\n` +
    `Aquesta acció no es pot desfer.`
  );
  
  if (!confirmed) return;
  
  try {
    await dbDelete('photos', photo.id);
    
    window.currentClientPhotos.splice(currentLightboxIndex, 1);
    
    if (window.currentClientPhotos.length === 0) {
      closeLightbox();
      await renderPhotoGallery();
      showAlert('Foto esborrada', 'No queden més fotos', '🗑️');
      return;
    }
    
    if (currentLightboxIndex >= window.currentClientPhotos.length) {
      currentLightboxIndex = window.currentClientPhotos.length - 1;
    }
    
    updateLightboxDisplay();
    renderPhotoGallery();
    
    showAlert('Foto esborrada', 'La foto s\'ha eliminat correctament', '✅');
  } catch (e) {
    console.error('Error esborrant foto:', e);
    showAlert('Error', 'No s\'ha pogut esborrar la foto', '❌');
  }
}

// Teclat shortcuts
document.addEventListener('keydown', (e) => {
  const lightbox = $('lightbox');
  if (!lightbox || !lightbox.classList.contains('active')) return;
  
  switch(e.key) {
    case 'Escape':
      closeLightbox();
      break;
    case 'ArrowLeft':
      prevPhoto();
      break;
    case 'ArrowRight':
      nextPhoto();
      break;
    case 'Delete':
      deleteCurrentPhoto();
      break;
  }
});


// Touch swipe per mòbil - VARIABLES MILLORADES
let touchStartX = 0;
let touchEndX = 0;
let touchStartY = 0;
let touchEndY = 0;
let isTouchOnCanvas = false;

document.addEventListener('DOMContentLoaded', () => {
  const lightbox = $('lightbox');
  if (!lightbox) return;
  
  // CRÍTICO: Gestió millorada de touch events
  lightbox.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
    
    const canvas = $('photoCanvas');
    if (canvas && e.target === canvas) {
      isTouchOnCanvas = true;
    } else {
      isTouchOnCanvas = false;
    }
  }, { passive: false });
  
  lightbox.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    touchEndY = e.changedTouches[0].screenY;
    
    if (!drawingEnabled && !isTouchOnCanvas) {
      handleLightboxSwipe();
    }
    
    isTouchOnCanvas = false;
  }, { passive: false });
});

function handleLightboxSwipe() {
  const diffX = touchStartX - touchEndX;
  const diffY = Math.abs(touchStartY - touchEndY);
  const thresholdX = 50;
  const thresholdY = 30;
  
  if (Math.abs(diffX) < thresholdX || diffY > thresholdY) return;
  
  if (diffX > 0) {
    nextPhoto();
  } else {
    prevPhoto();
  }
}
/* ================= EDITOR DE DIBUIX PER FOTOS ================= */
let photoCanvas = null;
let photoCtx = null;
let isDrawingOnPhoto = false;
let drawingEnabled = false;
let drawColor = '#ef4444';
let drawSize = 3;
let drawHistory = [];
let originalPhotoData = null;
let currentTool = 'none';
let fillModeEnabled = false;
let totalRotationDeg = 0;

// Variables de zoom i pan
let currentZoom = 1;
let panX = 0;
let panY = 0;
let isPanning = false;
let startPanX = 0;
let startPanY = 0;
let lastTouchDistance = 0;

// Funcions de zoom
function zoomIn() {
  if (!photoCanvas) return;
  currentZoom = Math.min(currentZoom * 1.3, 5);
  applyZoomTransform();
}

function zoomOut() {
  if (!photoCanvas) return;
  currentZoom = Math.max(currentZoom / 1.3, 1);
  if (currentZoom === 1) {
    panX = 0;
    panY = 0;
  }
  applyZoomTransform();
}

function resetZoom() {
  if (!photoCanvas) return;
  currentZoom = 1;
  panX = 0;
  panY = 0;
  applyZoomTransform();
}

function applyZoomTransform() {
  if (!photoCanvas) return;
  const stack = document.getElementById('canvasStack');
  const target = stack || photoCanvas;
  const rotation = totalRotationDeg ? `rotate(${totalRotationDeg}deg) ` : '';
  target.style.transform = `${rotation}translate(${panX}px, ${panY}px) scale(${currentZoom})`;
  target.style.transformOrigin = 'center center';

  // Mostrar indicador de zoom
  const ind = document.getElementById('zoomIndicator');
  if (ind) {
    ind.textContent = currentZoom !== 1 ? currentZoom.toFixed(1) + '×' : '';
    ind.style.opacity = currentZoom !== 1 ? '1' : '0';
  }
}

// Sistema d'inicialització de zoom
function initZoomSystem() {
  if (!photoCanvas) return;
  
  // Mouse wheel zoom
  const wheelHandler = (e) => {
    if (drawingEnabled) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    currentZoom = Math.max(1, Math.min(5, currentZoom * delta));
    if (currentZoom === 1) {
      panX = 0;
      panY = 0;
    }
    applyZoomTransform();
  };
  
  // Mouse pan
  const mouseDownHandler = (e) => {
    if (drawingEnabled || currentZoom <= 1) return;
    isPanning = true;
    startPanX = e.clientX - panX;
    startPanY = e.clientY - panY;
    e.preventDefault();
  };
  
  const mouseMoveHandler = (e) => {
    if (!isPanning || drawingEnabled) return;
    panX = e.clientX - startPanX;
    panY = e.clientY - startPanY;
    applyZoomTransform();
  };
  
  const mouseUpHandler = () => {
    if (drawingEnabled) return;
    isPanning = false;
  };
  
  // Touch pinch zoom
  const touchStartHandler = (e) => {
    if (drawingEnabled) return;
    if (e.touches.length === 2) {
      e.preventDefault();
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      lastTouchDistance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
    } else if (e.touches.length === 1 && currentZoom > 1) {
      isPanning = true;
      startPanX = e.touches[0].clientX - panX;
      startPanY = e.touches[0].clientY - panY;
    }
  };
  
  const touchMoveHandler = (e) => {
    if (drawingEnabled) return;
    if (e.touches.length === 2) {
      e.preventDefault();
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const newDistance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      
      if (lastTouchDistance > 0) {
        const zoomDelta = newDistance / lastTouchDistance;
        currentZoom = Math.max(1, Math.min(5, currentZoom * zoomDelta));
        if (currentZoom === 1) {
          panX = 0;
          panY = 0;
        }
        applyZoomTransform();
      }
      lastTouchDistance = newDistance;
    } else if (isPanning && e.touches.length === 1) {
      e.preventDefault();
      panX = e.touches[0].clientX - startPanX;
      panY = e.touches[0].clientY - startPanY;
      applyZoomTransform();
    }
  };
  
  const touchEndHandler = () => {
    if (drawingEnabled) return;
    isPanning = false;
    lastTouchDistance = 0;
  };
  
  // Afegir event listeners
  photoCanvas.addEventListener('wheel', wheelHandler, { passive: false });
  photoCanvas.addEventListener('mousedown', mouseDownHandler);
  photoCanvas.addEventListener('mousemove', mouseMoveHandler);
  photoCanvas.addEventListener('mouseup', mouseUpHandler);
  photoCanvas.addEventListener('mouseleave', mouseUpHandler);
  photoCanvas.addEventListener('touchstart', touchStartHandler, { passive: false });
  photoCanvas.addEventListener('touchmove', touchMoveHandler, { passive: false });
  photoCanvas.addEventListener('touchend', touchEndHandler);
  photoCanvas.addEventListener('touchcancel', touchEndHandler);
  
  // Guardar referències per poder eliminar-les després
  photoCanvas._zoomHandlers = {
    wheel: wheelHandler,
    mousedown: mouseDownHandler,
    mousemove: mouseMoveHandler,
    mouseup: mouseUpHandler,
    mouseleave: mouseUpHandler,
    touchstart: touchStartHandler,
    touchmove: touchMoveHandler,
    touchend: touchEndHandler,
    touchcancel: touchEndHandler
  };
}

function cleanupZoomSystem() {
  if (!photoCanvas || !photoCanvas._zoomHandlers) return;
  
  const h = photoCanvas._zoomHandlers;
  photoCanvas.removeEventListener('wheel', h.wheel);
  photoCanvas.removeEventListener('mousedown', h.mousedown);
  photoCanvas.removeEventListener('mousemove', h.mousemove);
  photoCanvas.removeEventListener('mouseup', h.mouseup);
  photoCanvas.removeEventListener('mouseleave', h.mouseleave);
  photoCanvas.removeEventListener('touchstart', h.touchstart);
  photoCanvas.removeEventListener('touchmove', h.touchmove);
  photoCanvas.removeEventListener('touchend', h.touchend);
  photoCanvas.removeEventListener('touchcancel', h.touchcancel);
  
  delete photoCanvas._zoomHandlers;
  
  // Reset valors
  currentZoom = 1;
  panX = 0;
  panY = 0;
  isPanning = false;
}

// Exportar funcions globals de zoom
window.zoomIn = zoomIn;
window.zoomOut = zoomOut;
window.resetZoom = resetZoom;

function initPhotoCanvas() {
  photoCanvas = document.getElementById('photoCanvas');
  
  if (!photoCanvas) {
    console.error('❌ photoCanvas not found!');
    return;
  }
  
  // Assegurar visibilitat
  photoCanvas.style.display = 'block';
  photoCanvas.style.visibility = 'visible';
  photoCanvas.style.opacity = '1';
  
  photoCtx = photoCanvas.getContext('2d');
  
  if (!photoCtx) {
    console.error('❌ No canvas context!');
    return;
  }
  
  console.log('✅ Canvas OK');
}

// ── SISTEMA D'EINES DE DIBUIX (versió millorada) ──────────────────────────

const TOOL_IDS = {
  pencil: 'drawToggle',
  eraser: 'eraserToggle',
  fill:   'fillToggle',
  rect:   'rectToggle',
  circle: 'circleToggle',
  line:   'lineToggle',
  text:   'textToggle',
};

function setDrawTool(tool) {
  if (currentTool === tool) tool = 'none';
  currentTool = tool;
  drawingEnabled  = (tool === 'pencil' || tool === 'eraser');
  fillModeEnabled = (tool === 'fill');

  const dc = window.drawingCanvas;
  if (dc) {
    const active = tool !== 'none';
    dc.classList.toggle('tool-active', active);
    dc.style.pointerEvents = active ? 'auto' : 'none';
    dc.style.cursor = active ? 'crosshair' : 'default';
  }

  Object.entries(TOOL_IDS).forEach(([t, id]) => {
    document.getElementById(id)?.classList.toggle('active', t === tool);
  });
}
window.setDrawTool = setDrawTool;

function toggleDrawing() { setDrawTool(drawingEnabled ? 'none' : 'pencil'); }
function toggleFillMode() { setDrawTool(fillModeEnabled ? 'none' : 'fill'); }
window.toggleFillMode = toggleFillMode;

function setDrawColor(color) {
  drawColor = color;
  const picker = document.getElementById('rgbColorPicker');
  if (picker) picker.value = color;
}

function setDrawColorFromPicker(hex) {
  setDrawColor(hex);
}
window.setDrawColorFromPicker = setDrawColorFromPicker;

function updateDrawSize(size) {
  drawSize = parseInt(size);
}

function saveDrawState() {
  const dc = window.drawingCanvas || photoCanvas;
  if (!dc) return;
  drawHistory.push(dc.toDataURL());
  if (drawHistory.length > 20) drawHistory.shift();
}

function undoDraw() {
  const dc = window.drawingCanvas || photoCanvas;
  const dx = window.drawingCtx || photoCtx;
  if (!dc || !dx) return;
  if (drawHistory.length > 1) {
    drawHistory.pop();
    const img = new Image();
    img.onload = () => {
      dx.clearRect(0, 0, dc.width, dc.height);
      dx.drawImage(img, 0, 0);
    };
    img.src = drawHistory[drawHistory.length - 1];
  }
}

function clearDrawingLayer() {
  const dc = window.drawingCanvas;
  const dx = window.drawingCtx;
  if (!dc || !dx) return;
  if (!confirm('Netejar tots els dibuixos d\'aquesta capa?\n\nLa foto original no es veurà afectada.')) return;
  dx.clearRect(0, 0, dc.width, dc.height);
  drawHistory = [];
  saveDrawState();
}
window.clearDrawingLayer = clearDrawingLayer;

function clearDrawing() { clearDrawingLayer(); }

function toggleLayerVisibility() {
  const dc = window.drawingCanvas;
  if (!dc) return;
  const hidden = dc.style.opacity === '0';
  dc.style.opacity = hidden ? '1' : '0';
  document.getElementById('layerVisBtn')?.classList.toggle('layer-hidden', !hidden);
}
window.toggleLayerVisibility = toggleLayerVisibility;

// Flood fill sobre la capa de dibuix
function floodFillLayer(ctx, canvas, startX, startY, fillColor) {
  const w = canvas.width, h = canvas.height;
  const composite = document.createElement('canvas');
  composite.width = w; composite.height = h;
  const cx = composite.getContext('2d');
  if (photoCanvas) cx.drawImage(photoCanvas, 0, 0);
  cx.drawImage(canvas, 0, 0);
  const imgData = cx.getImageData(0, 0, w, h);
  const data = imgData.data;
  const idx = (startY * w + startX) * 4;
  const tR = data[idx], tG = data[idx+1], tB = data[idx+2], tA = data[idx+3];
  const tmp = document.createElement('canvas');
  tmp.width = tmp.height = 1;
  const tc = tmp.getContext('2d');
  tc.fillStyle = fillColor; tc.fillRect(0,0,1,1);
  const fc = tc.getImageData(0,0,1,1).data;
  const fR = fc[0], fG = fc[1], fB = fc[2];
  const TOL = 15;
  const match = i => Math.abs(data[i]-tR)<=TOL && Math.abs(data[i+1]-tG)<=TOL &&
                     Math.abs(data[i+2]-tB)<=TOL && Math.abs(data[i+3]-tA)<=TOL;
  const filled = new Uint8Array(w * h);
  const stack  = [[startX, startY]];
  const visited = new Uint8Array(w * h);
  visited[startY*w+startX] = 1;
  while (stack.length) {
    const [x, y] = stack.pop();
    const i = (y*w+x)*4;
    if (!match(i)) continue;
    filled[y*w+x] = 1;
    if (x>0   && !visited[y*w+x-1])   { visited[y*w+x-1]=1;   stack.push([x-1,y]); }
    if (x<w-1 && !visited[y*w+x+1])   { visited[y*w+x+1]=1;   stack.push([x+1,y]); }
    if (y>0   && !visited[(y-1)*w+x]) { visited[(y-1)*w+x]=1; stack.push([x,y-1]); }
    if (y<h-1 && !visited[(y+1)*w+x]) { visited[(y+1)*w+x]=1; stack.push([x,y+1]); }
  }
  const drawData = ctx.getImageData(0, 0, w, h);
  const dd = drawData.data;
  for (let i = 0; i < w*h; i++) {
    if (!filled[i]) continue;
    dd[i*4]=fR; dd[i*4+1]=fG; dd[i*4+2]=fB; dd[i*4+3]=255;
  }
  ctx.putImageData(drawData, 0, 0);
  saveDrawState();
}
window.floodFillLayer = floodFillLayer;

// Eina de text flotant
function showTextInput(screenX, screenY, canvasX, canvasY, ctx, canvas) {
  const old = document.getElementById('floatingTextInput');
  if (old) old.remove();
  const wrap = document.createElement('div');
  wrap.id = 'floatingTextInput';
  wrap.style.cssText = `position:fixed;left:${screenX}px;top:${screenY}px;z-index:99999;display:flex;flex-direction:column;gap:6px;background:rgba(15,23,42,0.95);border:1px solid rgba(255,255,255,0.2);border-radius:10px;padding:10px;box-shadow:0 8px 32px rgba(0,0,0,0.5);min-width:220px;`;
  const input = document.createElement('input');
  input.type = 'text'; input.placeholder = 'Escriu aquí...';
  input.style.cssText = `background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.2);border-radius:6px;color:#f1f5f9;padding:6px 10px;font-size:14px;outline:none;width:100%;box-sizing:border-box;`;
  const sizeRow = document.createElement('div');
  sizeRow.style.cssText = 'display:flex;align-items:center;gap:6px;';
  const sizeLabel = document.createElement('span');
  sizeLabel.textContent = 'Mida:';
  sizeLabel.style.cssText = 'font-size:11px;color:rgba(255,255,255,0.5);white-space:nowrap;';
  const sizeSlider = document.createElement('input');
  sizeSlider.type='range'; sizeSlider.min=10; sizeSlider.max=120; sizeSlider.value=28;
  sizeSlider.style.cssText = 'flex:1;accent-color:#f97316;';
  sizeRow.appendChild(sizeLabel); sizeRow.appendChild(sizeSlider);
  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:6px;';
  const okBtn = document.createElement('button');
  okBtn.textContent = 'Afegir';
  okBtn.style.cssText = `flex:1;padding:6px;border-radius:6px;border:none;cursor:pointer;background:#f97316;color:#fff;font-size:13px;font-weight:600;`;
  okBtn.onclick = () => {
    const text = input.value.trim();
    if (text) {
      ctx.globalCompositeOperation = 'source-over';
      const fontSize = parseInt(sizeSlider.value);
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.fillStyle = drawColor;
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = fontSize / 12;
      ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 4;
      ctx.strokeText(text, canvasX, canvasY);
      ctx.fillText(text, canvasX, canvasY);
      ctx.shadowBlur = 0;
      saveDrawState();
    }
    wrap.remove();
  };
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = '✕';
  cancelBtn.style.cssText = `padding:6px 10px;border-radius:6px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.07);color:#f1f5f9;cursor:pointer;font-size:13px;`;
  cancelBtn.onclick = () => wrap.remove();
  btnRow.appendChild(okBtn); btnRow.appendChild(cancelBtn);
  wrap.appendChild(input); wrap.appendChild(sizeRow); wrap.appendChild(btnRow);
  document.body.appendChild(wrap);
  requestAnimationFrame(() => {
    const r = wrap.getBoundingClientRect();
    if (r.right > window.innerWidth)  wrap.style.left = (window.innerWidth  - r.width  - 10) + 'px';
    if (r.bottom > window.innerHeight) wrap.style.top  = (window.innerHeight - r.height - 10) + 'px';
    input.focus();
  });
  input.addEventListener('keydown', e => { if (e.key === 'Enter') okBtn.click(); if (e.key === 'Escape') wrap.remove(); });
}
window.showTextInput = showTextInput;

// Knob de rotació (arrossegar esquerra/dreta)
function initRotateKnob() {
  const knob = document.getElementById('rotateKnob');
  if (!knob) return;
  if (knob._knobHandlers) {
    knob.removeEventListener('mousedown',  knob._knobHandlers.down);
    knob.removeEventListener('touchstart', knob._knobHandlers.down);
    if (knob._knobHandlers.move) { document.removeEventListener('mousemove', knob._knobHandlers.move); document.removeEventListener('touchmove', knob._knobHandlers.move); }
    if (knob._knobHandlers.up)   { document.removeEventListener('mouseup',   knob._knobHandlers.up);   document.removeEventListener('touchend',  knob._knobHandlers.up); }
  }
  let isDragging = false, startX = 0, totalDeg = 0;
  const showAngle = (deg) => {
    let badge = knob.querySelector('.rotate-angle-badge');
    if (!badge) { badge = document.createElement('span'); badge.className = 'rotate-angle-badge'; knob.appendChild(badge); }
    badge.textContent = (deg % 360 !== 0) ? Math.round(deg % 360) + '°' : '';
  };
  const onDown = (e) => {
    isDragging = true; knob.classList.add('rotating');
    startX = e.touches ? e.touches[0].clientX : e.clientX;
    e.preventDefault();
  };
  const onMove = (e) => {
    if (!isDragging) return;
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const delta = (cx - startX) * 0.5;
    totalDeg += delta; startX = cx;
    totalRotationDeg = totalDeg;
    showAngle(totalDeg);
    applyZoomTransform();
    e.preventDefault();
  };
  const onUp = () => { isDragging = false; knob.classList.remove('rotating'); };
  knob._knobHandlers = { down: onDown, move: onMove, up: onUp };
  knob.addEventListener('mousedown', onDown);
  knob.addEventListener('touchstart', onDown, { passive: false });
  document.addEventListener('mousemove', onMove);
  document.addEventListener('touchmove', onMove, { passive: false });
  document.addEventListener('mouseup', onUp);
  document.addEventListener('touchend', onUp);
}
window.initRotateKnob = initRotateKnob;

// Rotar foto en increments de 90°
function rotatePhoto(degrees) {
  totalRotationDeg = (totalRotationDeg + degrees) % 360;
  applyZoomTransform();
}
window.rotatePhoto = rotatePhoto;

async function saveEditedPhoto() {
  if (!photoCanvas || !window.currentClientPhotos) return;

  // Desactivar eines
  setDrawTool('none');

  const confirmed = confirm('💾 Vols guardar els canvis a aquesta foto?\n\nLa foto original serà substituïda.');
  if (!confirmed) return;

  try {
    // Fusionar foto base + capa de dibuix en un canvas de sortida
    const out = document.createElement('canvas');
    out.width  = photoCanvas.width;
    out.height = photoCanvas.height;
    const octx = out.getContext('2d');

    // Helper: dibuixa el drawingCanvas sempre escal·lat a les mides del photoCanvas
    // Això evita que el dibuix quedi petit/desplaçat si les mides internes han desincronitzat
    const drawDrawingLayer = (ctx, dx, dy) => {
      const dc = window.drawingCanvas;
      if (!dc) return;
      // Sempre fem drawImage amb les 9 params per forçar l'escalat correcte
      ctx.drawImage(dc, 0, 0, dc.width, dc.height, dx, dy, photoCanvas.width, photoCanvas.height);
    };

    // Aplicar rotació si n'hi ha
    if (totalRotationDeg && totalRotationDeg % 360 !== 0) {
      const rad = totalRotationDeg * Math.PI / 180;
      const cos = Math.abs(Math.cos(rad)), sin = Math.abs(Math.sin(rad));
      out.width  = Math.round(photoCanvas.height * sin + photoCanvas.width  * cos);
      out.height = Math.round(photoCanvas.height * cos + photoCanvas.width  * sin);
      octx.translate(out.width / 2, out.height / 2);
      octx.rotate(rad);
      octx.drawImage(photoCanvas, -photoCanvas.width / 2, -photoCanvas.height / 2);
      if (window.drawingCanvas) drawDrawingLayer(octx, -photoCanvas.width / 2, -photoCanvas.height / 2);
    } else {
      octx.drawImage(photoCanvas, 0, 0);
      if (window.drawingCanvas) drawDrawingLayer(octx, 0, 0);
    }

    const editedData = out.toDataURL('image/jpeg', 0.85);
    const photo = window.currentClientPhotos[currentLightboxIndex];
    photo.data = editedData;
    originalPhotoData = editedData;

    // Guardar a IndexedDB
    await dbPut('photos', {
      id: photo.id,
      clientId: state.currentClientId,
      data: photo.data,
      date: photo.date,
      comment: photo.comment || ""
    });

    // Recarregar la foto al canvas
    const img = new Image();
    img.onload = () => {
      photoCanvas.width  = img.width;
      photoCanvas.height = img.height;
      photoCtx.drawImage(img, 0, 0);
      if (window.drawingCanvas) {
        window.drawingCanvas.width  = img.width;
        window.drawingCanvas.height = img.height;
        // Reset CSS size overrides to avoid desync between CSS display size and internal canvas size
        window.drawingCanvas.style.width  = '';
        window.drawingCanvas.style.height = '';
        window.drawingCtx?.clearRect(0, 0, img.width, img.height);
      }
      totalRotationDeg = 0;
      applyZoomTransform();
      drawHistory = []; saveDrawState();
    };
    img.src = editedData;

    showAlert('Foto guardada', 'Els canvis s\'han guardat correctament', '✅');
  } catch (e) {
    console.error('Error guardant foto editada:', e);
    showAlert('Error', 'No s\'ha pogut guardar: ' + e.message, '❌');
  }
}

function getCanvasPoint(e) {
  const dc = window.drawingCanvas || photoCanvas;
  const rect = dc.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  const scaleX = dc.width / rect.width;
  const scaleY = dc.height / rect.height;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top)  * scaleY
  };
}

// Event listeners per dibuixar — suport dual-canvas + totes les eines
function setupCanvasDrawing() {
  if (!photoCanvas || !photoCtx) return;

  const dc = window.drawingCanvas || photoCanvas;
  const dx = window.drawingCtx    || photoCtx;

  if (dc._drawHandlers) {
    const h = dc._drawHandlers;
    ['mousedown','mousemove','mouseup','mouseleave'].forEach(ev => dc.removeEventListener(ev, h[ev]));
    dc.removeEventListener('touchstart', h.touchstart);
    dc.removeEventListener('touchmove',  h.touchmove);
    dc.removeEventListener('touchend',   h.touchend);
    dc.removeEventListener('click',      h.click);
    dc.removeEventListener('touchend',   h.fillTouch);
  }

  let isDrawing = false, shapeStart = null, snapShot = null;

  function getPoint(e) {
    const src = e.touches ? e.touches[0] : (e.changedTouches ? e.changedTouches[0] : null);
    const clientX = src ? src.clientX : e.clientX;
    const clientY = src ? src.clientY : e.clientY;
    const rect = dc.getBoundingClientRect();
    // Escala directa entre mida CSS visible i mida interna del canvas
    const scaleX = dc.width  / rect.width;
    const scaleY = dc.height / rect.height;
    // Si hi ha rotació, aplicar-la des del centre del canvas
    if (totalRotationDeg && totalRotationDeg % 360 !== 0) {
      const localX = (clientX - rect.left) * scaleX;
      const localY = (clientY - rect.top)  * scaleY;
      const cx = dc.width  / 2;
      const cy = dc.height / 2;
      const ddx = localX - cx, ddy = localY - cy;
      const rad = -(totalRotationDeg) * Math.PI / 180;
      return {
        x: cx + ddx * Math.cos(rad) - ddy * Math.sin(rad),
        y: cy + ddx * Math.sin(rad) + ddy * Math.cos(rad)
      };
    }
    // Cas normal (sense rotació): mapatge directe pixel a pixel
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top)  * scaleY
    };
  }

  function onStart(e) {
    if (e.touches && e.touches.length >= 2) return;
    const tool = currentTool;
    if (tool === 'none' || tool === 'fill' || tool === 'text') return;
    e.preventDefault(); e.stopPropagation();
    isDrawing = true;
    const { x, y } = getPoint(e);
    shapeStart = { x, y };
    dx.globalCompositeOperation = (tool === 'eraser') ? 'destination-out' : 'source-over';
    if (tool === 'pencil' || tool === 'eraser') {
      dx.strokeStyle = drawColor;
      dx.lineWidth   = (tool === 'eraser') ? drawSize * 3 : drawSize;
      dx.lineCap = 'round'; dx.lineJoin = 'round';
      dx.beginPath(); dx.moveTo(x, y);
    } else {
      snapShot = dx.getImageData(0, 0, dc.width, dc.height);
    }
  }

  function onMove(e) {
    if (e.touches && e.touches.length >= 2) { if (isDrawing) { isDrawing = false; shapeStart = null; snapShot = null; } return; }
    if (!isDrawing) return;
    const tool = currentTool;
    if (tool === 'none' || tool === 'fill' || tool === 'text') return;
    e.preventDefault(); e.stopPropagation();
    const { x, y } = getPoint(e);
    if (tool === 'pencil' || tool === 'eraser') {
      dx.lineTo(x, y); dx.stroke();
    } else if (shapeStart && snapShot) {
      dx.putImageData(snapShot, 0, 0);
      dx.globalCompositeOperation = 'source-over';
      dx.strokeStyle = drawColor; dx.lineWidth = drawSize;
      if (tool === 'rect') {
        dx.lineCap = 'square';
        dx.strokeRect(shapeStart.x, shapeStart.y, x - shapeStart.x, y - shapeStart.y);
      } else if (tool === 'circle') {
        const rx = (x - shapeStart.x) / 2, ry = (y - shapeStart.y) / 2;
        dx.beginPath();
        dx.ellipse(shapeStart.x + rx, shapeStart.y + ry, Math.abs(rx), Math.abs(ry), 0, 0, Math.PI*2);
        dx.stroke();
      } else if (tool === 'line') {
        dx.lineCap = 'round';
        dx.beginPath(); dx.moveTo(shapeStart.x, shapeStart.y); dx.lineTo(x, y); dx.stroke();
      }
    }
  }

  function onEnd(e) {
    if (e && e.touches && e.touches.length >= 2) return;
    if (!isDrawing) return;
    if (e) { e.preventDefault(); e.stopPropagation(); }
    isDrawing = false; shapeStart = null; snapShot = null;
    dx.globalCompositeOperation = 'source-over';
    dx.closePath();
    saveDrawState();
  }

  function onClickFill(e) {
    const tool = currentTool;
    if (tool !== 'fill' && tool !== 'text') return;
    e.preventDefault(); e.stopPropagation();
    const { x, y } = getPoint(e);
    const cx = Math.round(x), cy = Math.round(y);
    if (tool === 'fill') {
      if (cx >= 0 && cy >= 0 && cx < dc.width && cy < dc.height) floodFillLayer(dx, dc, cx, cy, drawColor);
    } else if (tool === 'text') {
      showTextInput(e.clientX, e.clientY, x, y, dx, dc);
    }
  }

  const fillTouchH = (e) => {
    if (currentTool !== 'fill' && currentTool !== 'text') return;
    if (e.changedTouches?.length !== 1) return;
    e.preventDefault();
    const t = e.changedTouches[0];
    onClickFill({ clientX: t.clientX, clientY: t.clientY, preventDefault:()=>{}, stopPropagation:()=>{} });
  };

  dc._drawHandlers = { mousedown: onStart, mousemove: onMove, mouseup: onEnd, mouseleave: onEnd,
    touchstart: onStart, touchmove: onMove, touchend: onEnd, click: onClickFill, fillTouch: fillTouchH };
  dc.addEventListener('mousedown',  onStart);
  dc.addEventListener('mousemove',  onMove);
  dc.addEventListener('mouseup',    onEnd);
  dc.addEventListener('mouseleave', onEnd);
  dc.addEventListener('touchstart', onStart,    { passive: false });
  dc.addEventListener('touchmove',  onMove,     { passive: false });
  dc.addEventListener('touchend',   onEnd,      { passive: false });
  dc.addEventListener('click',      onClickFill);
  dc.addEventListener('touchend',   fillTouchH, { passive: false });
}

// Exportar funcions
window.toggleDrawing = toggleDrawing;
window.setDrawColor = setDrawColor;
window.updateDrawSize = updateDrawSize;
window.undoDraw = undoDraw;
window.clearDrawing = clearDrawing;
window.saveEditedPhoto = saveEditedPhoto;
window.savePhotoComment = savePhotoComment;
  
// Exportar funcions globals
window.openLightbox = openLightbox;
window.closeLightbox = closeLightbox;
window.prevPhoto = prevPhoto;
window.nextPhoto = nextPhoto;
window.downloadCurrentPhoto = downloadCurrentPhoto;
window.shareCurrentPhoto = shareCurrentPhoto;
window.deleteCurrentPhoto = deleteCurrentPhoto;

/*************************************************
 * FOCUSWORK – Sistema d'Estats i Progrés
 * Funcions d'integració
 *************************************************/

// Inicialitzar la secció d'estat i progrés
async function initProjectStatus() {
  if (!state.currentClientId) return;
  
  const client = await loadClient(state.currentClientId);
  if (!client) return;
  
  // Inicialitzar estat per defecte si no existeix
  if (!client.state) {
    await setClientState(client.id, 'in_progress', 'Projecte iniciat');
  }
  
  // Inicialitzar progrés per defecte
  if (!client.progress) {
    await setClientProgress(client.id, 1);
  }
  
  // Renderitzar estat
  const stateContainer = document.getElementById('projectStateContainer');
  if (stateContainer && typeof renderStateSelector === 'function') {
    stateContainer.innerHTML = renderStateSelector(client);
    setupStateListeners();
  }
  
  // Renderitzar progrés
  const progressContainer = document.getElementById('projectProgressContainer');
  if (progressContainer && typeof renderProgressSelector === 'function') {
    progressContainer.innerHTML = renderProgressSelector(client);
    setupProgressListeners();
  }
  
  // Renderitzar historial
  const historyContainer = document.getElementById('projectHistoryContainer');
  if (historyContainer && client.stateHistory && client.stateHistory.length > 0 && typeof renderStateHistory === 'function') {
    historyContainer.innerHTML = renderStateHistory(client);
  }
}

// Event listeners per al selector d'estat
function setupStateListeners() {
  const changeStateBtn = document.getElementById('changeStateBtn');
  const stateDropdown = document.getElementById('stateDropdown');
  const stateOptions = document.querySelectorAll('.state-option');
  
  if (changeStateBtn) {
    changeStateBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      stateDropdown.classList.toggle('hidden');
    });
  }
  
  // Tancar dropdown si es clica fora
  document.addEventListener('click', (e) => {
    if (stateDropdown && !stateDropdown.contains(e.target) && e.target !== changeStateBtn) {
      stateDropdown.classList.add('hidden');
    }
  });
  
  // Canviar estat
  stateOptions.forEach(option => {
    option.addEventListener('click', async () => {
      const stateId = option.dataset.state;
      
      // Demanar nota opcional
      const note = prompt('Afegeix una nota (opcional):');
      
      // Actualitzar estat
      if (typeof setClientState === 'function') {
        await setClientState(state.currentClientId, stateId, note || '');
      }
      
      // Actualitzar UI
      await initProjectStatus();
      
      // Tancar dropdown
      stateDropdown.classList.add('hidden');
      
      // Mostrar confirmació
      const stateName = option.querySelector('.state-option-label').textContent;
      showAlert('Estat actualitzat', `Projecte marcat com: ${stateName}`, '✅');
    });
  });
}

// Event listeners per al selector de progrés
function setupProgressListeners() {
  const progressStars = document.querySelectorAll('.progress-star');
  
  progressStars.forEach(star => {
    star.addEventListener('click', async () => {
      const level = parseInt(star.dataset.level);
      
      // Actualitzar progrés
      if (typeof setClientProgress === 'function') {
        await setClientProgress(state.currentClientId, level);
      }
      
      // Actualitzar UI
      await initProjectStatus();
      
      // Mostrar confirmació
      if (typeof PROGRESS_LEVELS !== 'undefined' && PROGRESS_LEVELS[level]) {
        const progressLabel = PROGRESS_LEVELS[level].label;
        showAlert('Progrés actualitzat', `${progressLabel} (${level}/5)`, '⭐');
      }
    });
  });
}

// Exportar funcions
window.initProjectStatus = initProjectStatus;
window.setupStateListeners = setupStateListeners;
window.setupProgressListeners = setupProgressListeners;

console.log('✅ app-ui.js carregat amb suport per estats i progrés');
/* ================= SISTEMA D'ARXIUS UNIVERSAL (FOTOS + DOCUMENTS + VÍDEOS + ÀUDIO) ================= */
/* AFEGEIX AQUEST CODI AL FINAL DEL TEU app-ui.js (després de la línia 2779) */

// Configuració de tipus d'arxius i mides màximes
const FILE_CONFIG = {
  maxSizes: {
    image: 10 * 1024 * 1024,      // 10MB per imatges
    video: 50 * 1024 * 1024,      // 50MB per vídeos
    audio: 20 * 1024 * 1024,      // 20MB per àudio
    document: 25 * 1024 * 1024,   // 25MB per documents
    other: 15 * 1024 * 1024       // 15MB per altres
  },
  
  types: {
    image: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/heic'],
    video: ['video/mp4', 'video/quicktime', 'video/webm', 'video/avi'],
    audio: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/m4a'],
    pdf: ['application/pdf'],
    word: ['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    excel: ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    text: ['text/plain', 'text/csv']
  },
  
  icons: {
    pdf: '📄',
    word: '📝',
    excel: '📊',
    text: '📃',
    video: '🎥',
    audio: '🎵',
    image: '🖼️',
    other: '📎'
  }
};

// Determinar el tipus d'arxiu
function getFileType(mimeType) {
  for (const [type, mimes] of Object.entries(FILE_CONFIG.types)) {
    if (mimes.includes(mimeType)) {
      return type;
    }
  }
  return 'other';
}

// Obtenir icona segons tipus
function getFileIcon(fileType) {
  return FILE_CONFIG.icons[fileType] || FILE_CONFIG.icons.other;
}

// Obtenir mida màxima segons tipus
function getMaxSize(fileType) {
  const category = ['image', 'video', 'audio'].includes(fileType) 
    ? fileType 
    : ['pdf', 'word', 'excel', 'text'].includes(fileType) 
      ? 'document' 
      : 'other';
  return FILE_CONFIG.maxSizes[category];
}

// Formatear mida d'arxiu
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/* ================= FUNCIONS PER AFEGIR ARXIUS ================= */

// Funció universal per afegir qualsevol tipus d'arxiu
async function addFileToClient() {
  console.log('📎 addFileToClient iniciada');
  
  if (!state.currentClientId) {
    showAlert('Error', 'Selecciona un client primer', '⚠️');
    return;
  }
  
  const client = await loadClient(state.currentClientId);
  if (!client) {
    showAlert('Error', 'Client no trobat', '⚠️');
    return;
  }
  
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "*/*"; // Acceptar tots els tipus
  
  input.style.cssText = `
    position: absolute;
    left: -9999px;
    opacity: 0.01;
  `;
  document.body.appendChild(input);
  
  input.onchange = async () => {
    const file = input.files[0];
    
    if (input.parentNode) {
      document.body.removeChild(input);
    }
    
    if (!file) return;
    
    console.log('🔎 Arxiu seleccionat:', file.name, file.type, formatFileSize(file.size));
    
    const fileType = getFileType(file.type);
    const maxSize = getMaxSize(fileType);
    
    // Validar mida
    if (file.size > maxSize) {
      showAlert('Arxiu massa gran', `Mida màxima per ${fileType}: ${formatFileSize(maxSize)}`, '⚠️');
      return;
    }
    
    // Processar segons el tipus
    if (fileType === 'image') {
      await processImageFile(file, client);
    } else if (fileType === 'video') {
      await processVideoFile(file, client);
    } else {
      await processGenericFile(file, client);
    }
  };
  
  input.oncancel = () => {
    if (input.parentNode) {
      document.body.removeChild(input);
    }
  };
  
  input.click();
}

// Processar imatges (comprimir i optimitzar)
async function processImageFile(file, client) {
  const reader = new FileReader();
  
  reader.onload = async () => {
    const img = new Image();
    
    img.onload = async () => {
      try {
        const MAX = 1920;
        let width = img.width;
        let height = img.height;
        
        if (width > MAX || height > MAX) {
          const ratio = Math.min(MAX / width, MAX / height);
          width = Math.floor(width * ratio);
          height = Math.floor(height * ratio);
        }
        
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        
        const dataURL = canvas.toDataURL("image/jpeg", 0.85);
        
        const fileObj = {
          id: uid(),
          date: new Date().toISOString(),
          type: 'image',
          name: file.name,
          mimeType: 'image/jpeg',
          size: dataURL.length,
          data: dataURL,
          comment: ""
        };
        
        if (!client.files) client.files = [];
        client.files.push(fileObj);
        
        await saveClient(client);
        await renderFileGallery(client);
        
        showAlert('Imatge afegida', `${file.name} afegit correctament`, '✅');
      } catch (error) {
        console.error('Error processant imatge:', error);
        showAlert('Error', 'No s\'ha pogut processar la imatge', '❌');
      }
    };
    
    img.onerror = () => {
      showAlert('Error', 'No s\'ha pogut carregar la imatge', '❌');
    };
    
    img.src = reader.result;
  };
  
  reader.onerror = () => {
    showAlert('Error', 'No s\'ha pogut llegir l\'arxiu', '❌');
  };
  
  reader.readAsDataURL(file);
}

// Processar vídeos (crear thumbnail)
async function processVideoFile(file, client) {
  const reader = new FileReader();
  
  reader.onload = async () => {
    try {
      const video = document.createElement('video');
      video.preload = 'metadata';
      
      video.onloadedmetadata = async () => {
        // Crear thumbnail del primer frame
        video.currentTime = 0.1;
      };
      
      video.onseeked = async () => {
        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = 240;
        const ctx = canvas.getContext('2d');
        
        ctx.drawImage(video, 0, 0, 320, 240);
        const thumbnail = canvas.toDataURL('image/jpeg', 0.7);
        
        const fileObj = {
          id: uid(),
          date: new Date().toISOString(),
          type: 'video',
          name: file.name,
          mimeType: file.type,
          size: file.size,
          data: reader.result,
          thumbnail: thumbnail,
          duration: Math.round(video.duration),
          comment: ""
        };
        
        if (!client.files) client.files = [];
        client.files.push(fileObj);
        
        await saveClient(client);
        await renderFileGallery(client);
        
        showAlert('Vídeo afegit', `${file.name} afegit correctament`, '✅');
      };
      
      video.src = reader.result;
    } catch (error) {
      console.error('Error processant vídeo:', error);
      showAlert('Error', 'No s\'ha pogut processar el vídeo', '❌');
    }
  };
  
  reader.readAsDataURL(file);
}

// Processar altres arxius (PDFs, documents, àudio, etc.)
async function processGenericFile(file, client) {
  const reader = new FileReader();
  
  reader.onload = async () => {
    const fileType = getFileType(file.type);
    
    const fileObj = {
      id: uid(),
      date: new Date().toISOString(),
      type: fileType,
      name: file.name,
      mimeType: file.type,
      size: file.size,
      data: reader.result,
      comment: ""
    };
    
    if (!client.files) client.files = [];
    client.files.push(fileObj);
    
    await saveClient(client);
    await renderFileGallery(client);
    
    const icon = getFileIcon(fileType);
    showAlert('Arxiu afegit', `${icon} ${file.name} afegit correctament`, '✅');
  };
  
  reader.onerror = () => {
    showAlert('Error', 'No s\'ha pogut llegir l\'arxiu', '❌');
  };
  
  reader.readAsDataURL(file);
}

/* ================= RENDERITZACIÓ DE LA GALERIA D'ARXIUS ================= */

async function renderFileGallery(preloadedClient = null) {
  const gallery = $("photoGallery");
  if (!gallery) return;
  
  const client = preloadedClient || (state.currentClientId ? await loadClient(state.currentClientId) : null);
  
  // Combinar arxius vells (photos) amb nous (files)
  const allFiles = [];
  
  // Migrar fotos antigues a format nou si existeixen
  if (client && client.photos && client.photos.length > 0) {
    client.photos.forEach(photo => {
      allFiles.push({
        id: photo.id,
        date: photo.date,
        type: 'image',
        name: 'Imatge',
        mimeType: 'image/jpeg',
        data: photo.data,
        comment: photo.comment || ""
      });
    });
  }
  
  // Afegir arxius nous
  if (client && client.files && client.files.length > 0) {
    allFiles.push(...client.files);
  }
  
  // ✅ Ordenar y guardar el array ordenado globalmente
  const sortedFiles = allFiles.sort((a, b) => new Date(b.date) - new Date(a.date));
  window.currentClientFiles = sortedFiles;
  
  // ✅ Aplicar estilos de grid al contenedor principal
  gallery.style.cssText = `
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 12px;
    padding: 12px;
  `;
  
  const fragment = document.createDocumentFragment();
  
  if (sortedFiles.length > 0) {
    sortedFiles.forEach((file, index) => {
      const container = document.createElement("div");
      container.className = "file-item";
      // ✅ Estilos mejorados para grid consistente
      container.style.cssText = `
        position: relative;
        cursor: pointer;
        aspect-ratio: 1;
        overflow: hidden;
        border-radius: 8px;
        background: #1e293b;
      `;
      
      // ✅ LONG PRESS per esborrar (PER TOTS ELS ARXIUS incloent imatges)
      let pressTimer = null;
      let touchStartTime = null;
      
      const startPress = (e) => {
        touchStartTime = Date.now();
        container.style.transform = 'scale(0.95)';
        container.style.transition = 'transform 0.1s';
        
        pressTimer = setTimeout(() => {
          // Vibrar si està disponible
          if (navigator.vibrate) {
            navigator.vibrate(50);
          }
          
          // Mostrar confirmació
          confirmDeleteFile(file);
          
          // Reset visual
          container.style.transform = 'scale(1)';
        }, 800); // 800ms = 0.8 segons de pulsació
      };
      
      const cancelPress = () => {
        if (pressTimer) {
          clearTimeout(pressTimer);
          pressTimer = null;
        }
        container.style.transform = 'scale(1)';
        
        // Si és un click curt (menys de 300ms), obrir arxiu
        if (touchStartTime && (Date.now() - touchStartTime) < 300) {
          openFileViewer(allFiles, index);
        }
        touchStartTime = null;
      };
      
      // Event listeners per desktop i mòbil
      container.addEventListener('mousedown', startPress);
      container.addEventListener('touchstart', startPress, { passive: true });
      container.addEventListener('mouseup', cancelPress);
      container.addEventListener('mouseleave', cancelPress);
      container.addEventListener('touchend', cancelPress);
      container.addEventListener('touchcancel', cancelPress);
      
      if (file.type === 'image') {
        // Mostrar thumbnail d'imatge
        const img = document.createElement("img");
        img.src = file.data;
        img.className = "photo-thumb";
        img.style.cssText = `
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          pointer-events: none;
        `;
        container.appendChild(img);
      } else if (file.type === 'video' && file.thumbnail) {
        // Mostrar thumbnail de vídeo
        const img = document.createElement("img");
        img.src = file.thumbnail;
        img.style.cssText = "width: 100%; height: auto; border-radius: 4px;";
        container.appendChild(img);
        
        // Icona de play
        const playIcon = document.createElement("div");
        playIcon.textContent = '▶️';
        playIcon.style.cssText = `
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: 48px;
          pointer-events: none;
        `;
        container.appendChild(playIcon);
      } else {
        // Mostrar icona per altres tipus
        const icon = document.createElement("div");
        icon.textContent = getFileIcon(file.type);
        icon.style.cssText = `
          font-size: 64px;
          text-align: center;
          padding: 20px;
        `;
        container.appendChild(icon);
        
        const fileName = document.createElement("div");
        fileName.textContent = file.name;
        fileName.style.cssText = `
          font-size: 12px;
          text-align: center;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        `;
        container.appendChild(fileName);
        
        const fileSize = document.createElement("div");
        fileSize.textContent = formatFileSize(file.size);
        fileSize.style.cssText = `
          font-size: 10px;
          text-align: center;
          color: #666;
        `;
        container.appendChild(fileSize);
      }
      
      // Badge de comentari
      if (file.comment && file.comment.trim()) {
        const badge = document.createElement("div");
        badge.style.cssText = `
          position: absolute;
          bottom: 5px;
          left: 5px;
          background: rgba(0,0,0,0.7);
          color: white;
          padding: 3px 8px;
          border-radius: 12px;
          font-size: 11px;
          backdrop-filter: blur(5px);
          pointer-events: none;
        `;
        badge.textContent = '💬';
        container.appendChild(badge);
      }
      
      fragment.appendChild(container);
    });
  }
  
  gallery.innerHTML = "";
  gallery.appendChild(fragment);
}

/* ================= ESBORRAR ARXIUS ================= */

async function confirmDeleteFile(file) {
  const fileTypeLabel = {
    'image': 'foto',
    'video': 'vídeo',
    'audio': 'àudio',
    'pdf': 'PDF',
    'document': 'document',
    'other': 'arxiu'
  }[file.type] || 'arxiu';
  
  const fileName = file.name || (file.type === 'image' ? 'Foto' : 'Sense nom');
  const confirmMessage = `Vols esborrar aquesta ${fileTypeLabel}?\n\n${fileName}\n\nAquesta acció no es pot desfer.`;
  
  if (!confirm(confirmMessage)) {
    return;
  }
  
  try {
    const client = await loadClient(state.currentClientId);
    if (!client) {
      showAlert('Error', 'Client no trobat', '⚠️');
      return;
    }
    
    // Tancar lightbox si està obert
    closeLightbox();
    
    // Esborrar de la base de dades
    if (file.type === 'image') {
      // Si és una foto (del sistema antic)
      await dbDelete('photos', file.id);
      client.photos = client.photos.filter(f => f.id !== file.id);
    } else {
      // Si és un arxiu nou
      client.files = client.files ? client.files.filter(f => f.id !== file.id) : [];
    }
    
    // Guardar client actualitzat
    await saveClient(client);
    
    // Actualitzar galeria - ara sempre usem renderFileGallery
    await renderFileGallery(client);
    
    showAlert('Arxiu eliminat', `La ${fileTypeLabel} s'ha eliminat correctament`, '✅');
  } catch (e) {
    console.error('Error esborrant arxiu:', e);
    showAlert('Error', `No s'ha pogut esborrar l'arxiu: ${e.message}`, '❌');
  }
}

/* ================= VISOR D'ARXIUS ================= */

function openFileViewer(files, index) {
  const file = files[index];
  
  if (file.type === 'image') {
    // Usar lightbox existent per imatges
    openLightbox(files, index);
  } else if (file.type === 'video') {
    // Obrir modal per vídeo
    showVideoModal(file);
  } else if (file.type === 'pdf') {
    // Obrir PDF en nova pestanya
    const win = window.open();
    win.document.write(`<iframe src="${file.data}" style="width:100%; height:100%; border:none;"></iframe>`);
  } else if (file.type === 'audio') {
    // Reproduir àudio
    showAudioModal(file);
  } else {
    // Descarregar arxiu
    downloadFile(file);
  }
}

function showVideoModal(file) {
  // Crear modal per vídeo
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.9);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
  `;
  
  const video = document.createElement('video');
  video.src = file.data;
  video.controls = true;
  video.style.cssText = 'max-width: 90%; max-height: 80vh;';
  modal.appendChild(video);
  
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕ Tancar';
  closeBtn.style.cssText = 'margin-top: 20px; padding: 10px 20px; font-size: 16px;';
  closeBtn.onclick = () => document.body.removeChild(modal);
  modal.appendChild(closeBtn);
  
  document.body.appendChild(modal);
}

function showAudioModal(file) {
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    padding: 30px;
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.3);
    z-index: 10000;
  `;
  
  const title = document.createElement('h3');
  title.textContent = file.name;
  title.style.marginBottom = '20px';
  modal.appendChild(title);
  
  const audio = document.createElement('audio');
  audio.src = file.data;
  audio.controls = true;
  audio.style.width = '100%';
  modal.appendChild(audio);
  
  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Tancar';
  closeBtn.style.cssText = 'margin-top: 20px; padding: 10px 20px; width: 100%;';
  closeBtn.onclick = () => document.body.removeChild(modal);
  modal.appendChild(closeBtn);
  
  document.body.appendChild(modal);
}

function downloadFile(file) {
  const a = document.createElement('a');
  a.href = file.data;
  a.download = file.name;
  a.click();
}

/* ================= EXPORTAR FUNCIONS GLOBALS ================= */
window.addFileToClient = addFileToClient;
window.renderFileGallery = renderFileGallery;
window.openFileViewer = openFileViewer;

console.log('✅ Sistema d\'arxius universal carregat correctament');

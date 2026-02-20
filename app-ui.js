/*************************************************
 * FOCUSWORK – app-ui.js (V4.0 FIXED) - PART 1/5
 * Llicències, Importació i Exportació
 *************************************************/

/* ─────────────────────────────────────────────
   FUNCIÓ AUXILIAR: obtenir la font d'una foto
   Suporta tant URL Supabase Storage com base64 local.
   photos-storage.js guarda  data: null  quan té URL,
   per això cal mirar photo.url com a primer candidat.
───────────────────────────────────────────── */
function getPhotoSrc(photo) {
  return photo?.url || photo?.data || null;
}

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
  if (!client) return;

  const currentId = window.currentClientPhotos?.[currentLightboxIndex]?.id;
  if (!currentId) return;

  // ✅ BUGFIX: buscar tant a photos[] (antic) com a files[] (Supabase)
  // Abans només buscava a photos[] i perdia els comentaris de fotos noves
  let photo = (client.photos || []).find(p => p.id === currentId);
  let inFiles = false;
  if (!photo) {
    photo = (client.files || []).find(f => f.id === currentId);
    inFiles = true;
  }
  if (!photo) return;

  photo.comment = text;

  // Actualitzar còpia en memòria
  window.currentClientPhotos[currentLightboxIndex].comment = text;

  // Guardar client complet a Supabase + IndexedDB
  await saveClient(client);

  // Si era una foto de l'array antic (photos[]), actualitzar IndexedDB per seguretat
  if (!inFiles) {
    try {
      await dbPut('photos', {
        id:       photo.id,
        clientId: clientId,
        url:      photo.url  || null,
        data:     getPhotoSrc(photo),
        date:     photo.date,
        comment:  text
      });
    } catch (e) {
      console.error('Error guardant comentari a IndexedDB:', e);
    }
  }

  // Actualitzar badge visual a la galeria
  updatePhotoBadge(photo.id, text);
  console.log('💬 Comentari guardat correctament');
}

// Funció auxiliar per actualitzar el badge d'una foto específica
function updatePhotoBadge(photoId, comment) {
  const gallery = $("photoGallery");
  if (!gallery) return;
  
  // Buscar el contenidor per data-id o per índex
  const items = gallery.querySelectorAll('.file-item'); // ✅ FIX: era '.file-item, .photo-thumb' que barrejava contenidors i imatges
  const photos = window.currentClientPhotos || window.currentClientFiles;
  if (!photos) return;
  
  photos.forEach((p, index) => {
    if (p.id === photoId) {
      const container = items[index];
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

  // ✅ BUGFIX: refrescar la llista de clients SEMPRE que la UI s'actualitza
  // Sense això, tancar/esborrar un client no desapareix de la llista
  // perquè updateProjectList() mai era cridat per updateUI()
  if (typeof updateProjectList === 'function') {
    updateProjectList();
  }
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
  // ✅ Informació de llicència privada — no mostrar
  const infoEl = $("licenseInfo");
  if (infoEl) infoEl.style.display = "none";
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
  // ✅ Llicència completa activa — sense límit de clients
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

  // ✅ BUGFIX: afegir a state.clients en memòria immediatament
  // Sense això, el client nou no apareixia a la llista fins a recarregar
  if (!state.clients) state.clients = {};
  state.clients[id] = client;

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

  // ✅ Si s'ha cridat directament (no des de facturació), obrir modal de dades
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

  // ✅ BUGFIX: actualitzar state.clients en memòria immediatament
  // Sense això el client continuava apareixent com a actiu a la llista
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

  const clientId = state.currentClientId;

  await deleteClient(clientId);

  // ✅ BUGFIX: eliminar de state.clients en memòria immediatament
  // Sense això el client continuava apareixent a la llista fins a recarregar
  if (state.clients && state.clients[clientId]) {
    delete state.clients[clientId];
  }

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
    
    // ✅ BUGFIX: eliminar tant de photos[] com de files[]
    client.photos = (client.photos || []).filter(f => f.id !== photoToDelete);
    client.files  = (client.files  || []).filter(f => f.id !== photoToDelete);

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

  // Si photos-storage.js està carregat, usar-lo per pujar a Supabase Storage
  if (typeof window.processImageFile === 'function') {
    const client = await loadClient(state.currentClientId);
    if (!client) {
      showAlert('Error', 'Client no trobat', '⚠️');
      input.value = '';
      return;
    }
    input.value = '';
    await window.processImageFile(file, client);
    return;
  }
  
  // Fallback: guardar en local si Storage no disponible
  console.log('🔵 Processant imatge (mode local)...');
  
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
  if (!state.currentClientId) return;
  // ✅ BUGFIX: capturar el valor IMMEDIATAMENT (no en el timeout)
  // Si l'usuari escriu ràpid i loadClient tarda, el valor de e.target pot canviar
  const noteValue = e.target.value;
  clearTimeout(workpadTimeout);
  workpadTimeout = setTimeout(async () => {
    // Recarregar el client just abans de guardar per no sobreescriure
    // canvis que hagin pogut arribar de Supabase entremig
    const client = await loadClient(state.currentClientId);
    if (!client) return;
    client.notes = noteValue;
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
  if (!state.currentClientId) return;
  // ✅ BUGFIX: capturar el valor IMMEDIATAMENT igual que handleWorkpadInput
  const taskValue = e.target.value;
  clearTimeout(taskTimeouts[taskType]);
  taskTimeouts[taskType] = setTimeout(async () => {
    const client = await loadClient(state.currentClientId);
    if (!client || !client.tasks) return;
    client.tasks[taskType] = taskValue;
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

// ✅ BUGFIX: llegir tant photos[] (antic) com files[] (Supabase)
const allPhotosForReport = [
  ...(client.photos || []),
  ...(client.files  || []).filter(f => f.type === 'image')
];
// Deduplicar per id
const seenIds = new Set();
const uniquePhotos = allPhotosForReport.filter(p => {
  if (seenIds.has(p.id)) return false;
  seenIds.add(p.id);
  return true;
});

if (uniquePhotos.length > 0) {
  photosSection += '\n📷 FOTOGRAFIES\n\n';
  uniquePhotos.forEach((photo, index) => {
    photosSection += `Foto ${index + 1}\n`;
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
    <div style="margin-bottom: 20px; padding: 15px; background: rgba(245, 158, 11, 0.15); border-radius: 10px; border-left: 4px solid #f59e0b; color: #fde68a;">
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
      // ✅ BUGFIX: eliminar de state.clients en memòria
      if (state.clients && state.clients[client.id]) {
        delete state.clients[client.id];
      }
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
    
    // Assegurar scroll vertical al lightbox
    lightbox.style.overflowY = 'auto';
    lightbox.style.overflowX = 'hidden';
    
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
    
    // ✅ FIX: Guardar comentari pendent abans de tancar
    const commentInput = $('lightboxComment');
    if (commentInput) {
      if (commentInput._debounceTimer) clearTimeout(commentInput._debounceTimer);
      savePhotoComment(commentInput.value);
    }
    
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
  img.crossOrigin = 'anonymous'; // ✅ FIX: evitar canvas "tainted" amb URLs de Supabase Storage
  img.onload = () => {
    photoCanvas.width = img.width;
    photoCanvas.height = img.height;
    photoCtx.drawImage(img, 0, 0);
    
    // Guardar foto original
    originalPhotoData = getPhotoSrc(photo);   // ✅ suporta URL Supabase i base64 local
    
    // Iniciar historial
    currentRotation = 0;
    drawHistory = [];
    saveDrawState();
    
    // ✅ BUGFIX: sempre reinicialitzar els listeners de dibuix quan s'obre una foto
    // El flag _drawingInitialized causava que els listeners vells quedessin actius
    // sobre el canvas incorrecte si es reobria el lightbox amb una foto diferent
    setupCanvasDrawing();
    
    // Reset mode dibuix
    drawingEnabled = false;
    const btn = $('drawToggle');
    const text = $('drawToggleText');
    if (btn) btn.classList.remove('active');
    if (text) text.textContent = 'Dibuixar';
    photoCanvas.classList.remove('drawing-mode');
  };
  const src = getPhotoSrc(photo);
  console.log('📸 Foto src:', src ? src.substring(0, 80) : 'NULL', '| photo keys:', Object.keys(photo));
  if (!src) {
    console.error('❌ No hi ha src per aquesta foto:', photo);
    return;
  }
  img.src = src;
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
  
  // ✅ FIX: Debounce per evitar race conditions (oninput dispara a cada lletra)
  if (commentInput._debounceTimer) clearTimeout(commentInput._debounceTimer);
  commentInput.oninput = () => {
    // Actualitzar en memoria immediament
    const photos = window.currentClientPhotos;
    if (photos && photos[currentLightboxIndex]) {
      photos[currentLightboxIndex].comment = commentInput.value;
    }
    // Guardar a DB amb debounce
    if (commentInput._debounceTimer) clearTimeout(commentInput._debounceTimer);
    commentInput._debounceTimer = setTimeout(() => {
      savePhotoComment(commentInput.value);
    }, 600);
  };
  // ✅ FIX: Guardar immediatament quan es perd el focus (usuari surt del camp)
  commentInput.onblur = () => {
    if (commentInput._debounceTimer) clearTimeout(commentInput._debounceTimer);
    savePhotoComment(commentInput.value);
  };
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
  

  // ✅ FIX: Guardar comentari pendent
  const _ci = $('lightboxComment');
  if (_ci) { if (_ci._debounceTimer) clearTimeout(_ci._debounceTimer); savePhotoComment(_ci.value); }
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
  

  // ✅ FIX: Guardar comentari pendent
  const _ci = $('lightboxComment');
  if (_ci) { if (_ci._debounceTimer) clearTimeout(_ci._debounceTimer); savePhotoComment(_ci.value); }
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
  a.href = getPhotoSrc(photo);   // ✅ suporta URL Supabase i base64 local
  
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
      const res = await fetch(getPhotoSrc(photo));   // ✅ suporta URL Supabase i base64 local
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

// Variables de zoom i pan
let currentZoom = 1;
let panX = 0;
let panY = 0;
let isPanning = false;
let startPanX = 0;
let startPanY = 0;
let lastTouchDistance = 0;
let lastTouchAngle = null;       // ✅ Rotació amb dos dits
let accumulatedRotation = 0;     // Graus acumulats (per disparar cada 45°)

// ✅ Rotació de la imatge
let currentRotation = 0;         // rotació total acumulada (canvas)
let cssRotationAngle = 0;        // rotació CSS suau durant el gest
let isRotating = false;

// Aplicar rotació CSS temporal (suau, sense tocar el canvas)
function applyCSSSmoothRotation(angle) {
  if (!photoCanvas) return;
  const existingTransform = `translate(${panX}px, ${panY}px) scale(${currentZoom})`;
  photoCanvas.style.transform = existingTransform + ` rotate(${angle}deg)`;
}

// Cremar la rotació CSS al canvas (quan l'usuari deixa anar els dits)
function commitRotationToCanvas() {
  if (!photoCanvas || !photoCtx || cssRotationAngle === 0) {
    cssRotationAngle = 0;
    return;
  }

  const deg = cssRotationAngle;
  cssRotationAngle = 0;

  const rad = (deg * Math.PI) / 180;
  const oldW = photoCanvas.width;
  const oldH = photoCanvas.height;

  // Mida del nou canvas per contenir la imatge rotada
  const newW = Math.round(Math.abs(oldW * Math.cos(rad)) + Math.abs(oldH * Math.sin(rad)));
  const newH = Math.round(Math.abs(oldW * Math.sin(rad)) + Math.abs(oldH * Math.cos(rad)));

  const tmp = document.createElement('canvas');
  tmp.width  = oldW;
  tmp.height = oldH;
  tmp.getContext('2d').drawImage(photoCanvas, 0, 0);

  photoCanvas.width  = newW;
  photoCanvas.height = newH;
  photoCtx.save();
  photoCtx.translate(newW / 2, newH / 2);
  photoCtx.rotate(rad);
  photoCtx.drawImage(tmp, -oldW / 2, -oldH / 2);
  photoCtx.restore();

  // Treure CSS rotation (ja cremada)
  applyZoomTransform();
  saveDrawState();
}

// Botó manual (↺ ↻): gira 90° i crema directament
function rotatePhoto(degrees) {
  if (!photoCanvas || !photoCtx) return;
  cssRotationAngle = degrees;
  commitRotationToCanvas();
  resetZoom();
}
window.rotatePhoto = rotatePhoto;

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
  photoCanvas.style.transform = `translate(${panX}px, ${panY}px) scale(${currentZoom})`;
  photoCanvas.style.transformOrigin = 'center center';
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
  
  // Touch pinch zoom + rotació amb dos dits
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
      // Guardar angle inicial per detectar rotació
      lastTouchAngle = Math.atan2(
        touch2.clientY - touch1.clientY,
        touch2.clientX - touch1.clientX
      );
      accumulatedRotation = 0;
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
        if (currentZoom === 1) { panX = 0; panY = 0; }
        applyZoomTransform();
      }
      lastTouchDistance = newDistance;

      // ✅ Rotació CSS fluida amb dos dits (sense snap)
      if (lastTouchAngle !== null) {
        const newAngle = Math.atan2(
          touch2.clientY - touch1.clientY,
          touch2.clientX - touch1.clientX
        );
        const angleDelta = (newAngle - lastTouchAngle) * (180 / Math.PI);
        accumulatedRotation += angleDelta;
        lastTouchAngle = newAngle;
        cssRotationAngle = accumulatedRotation;
        isRotating = true;
        // Mostrar rotació CSS en temps real (suau)
        applyCSSSmoothRotation(accumulatedRotation);
      }
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
    // ✅ Cremar rotació CSS al canvas quan l'usuari deixa anar
    if (isRotating && Math.abs(accumulatedRotation) > 2) {
      commitRotationToCanvas();
    } else {
      cssRotationAngle = 0;
      applyZoomTransform(); // restaurar transform net
    }
    lastTouchAngle = null;
    accumulatedRotation = 0;
    isRotating = false;
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

function toggleDrawing() {
  drawingEnabled = !drawingEnabled;
  const btn = $('drawToggle');
  const text = $('drawToggleText');
  const canvas = $('photoCanvas');
  if (!canvas) return;
  
  if (drawingEnabled) {
    btn.classList.add('active');
    text.textContent = 'Activat';
    canvas.classList.add('drawing-mode');
    // ✅ CRÍTIC: activar pointer-events via JS perquè el canvas rebi clicks/touch
    // No dependre del CSS extern (drawing-mode) per a la funcionalitat crítica
    canvas.style.pointerEvents = 'auto';
    canvas.style.cursor = 'crosshair';
    // ✅ FIX: NO resetar zoom — getBoundingClientRect() ja calcula coords correctament
    // L'usuari pot ara dibuixar mentre està fet zoom sense perdre la posició
  } else {
    btn.classList.remove('active');
    text.textContent = 'Dibuixar';
    canvas.classList.remove('drawing-mode');
    // ✅ Desactivar pointer-events: el canvas torna transparent als events
    // perquè el swipe/zoom del lightbox torni a funcionar
    canvas.style.pointerEvents = 'none';
    canvas.style.cursor = '';
  }
}

function setDrawColor(color) {
  drawColor = color;
  document.querySelectorAll('.color-picker-mini').forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.color === color) {
      btn.classList.add('active');
    }
  });
}

function updateDrawSize(size) {
  drawSize = parseInt(size);
}

function saveDrawState() {
  if (!photoCanvas) return;
  drawHistory.push(photoCanvas.toDataURL());
  if (drawHistory.length > 20) {
    drawHistory.shift();
  }
}

function undoDraw() {
  if (drawHistory.length > 1) {
    drawHistory.pop();
    const previousState = drawHistory[drawHistory.length - 1];
    const img = new Image();
    img.onload = () => {
      photoCtx.clearRect(0, 0, photoCanvas.width, photoCanvas.height);
      photoCtx.drawImage(img, 0, 0);
    };
    img.src = previousState;
  }
}

function clearDrawing() {
  if (!confirm('🗑️ Vols esborrar tots els dibuixos i tornar a la foto original?')) return;
  
  if (originalPhotoData) {
    const img = new Image();
    img.onload = () => {
      photoCtx.clearRect(0, 0, photoCanvas.width, photoCanvas.height);
      photoCtx.drawImage(img, 0, 0);
      drawHistory = [];
      saveDrawState();
    };
    img.src = originalPhotoData;
  }
}


async function saveEditedPhoto() {
  if (!photoCanvas || !window.currentClientPhotos) return;
  
  // Desactivar mode dibuix abans de guardar
  if (drawingEnabled) {
    drawingEnabled = false;
    const btn = $('drawToggle');
    const text = $('drawToggleText');
    if (btn) btn.classList.remove('active');
    if (text) text.textContent = 'Dibuixar';
    photoCanvas.classList.remove('drawing-mode');
  }
  
  const confirmed = confirm('💾 Vols guardar els canvis a aquesta foto?\n\nLa foto original serà substituïda.');
  if (!confirmed) return;
  
  try {
    const editedData = photoCanvas.toDataURL('image/jpeg', 0.85);
    const photo = window.currentClientPhotos[currentLightboxIndex];
    const clientId = state.currentClientId;

    // Mostrar progrés
    showAlert('Guardant...', 'Pujant foto editada al núvol...', '⏳');

    // ✅ FIX: Pujar a Supabase Storage (substitueix la foto original al núvol)
    let newUrl = photo.url || null;
    if (typeof uploadPhotoToStorage === 'function') {
      const uploadedUrl = await uploadPhotoToStorage(editedData, photo.id, clientId);
      if (uploadedUrl) newUrl = uploadedUrl;
    }

    // Actualitzar dades en memòria
    photo.data = editedData;
    photo.url  = newUrl;
    originalPhotoData = editedData;

    // Guardar a IndexedDB
    await dbPut('photos', {
      id:       photo.id,
      clientId: clientId,
      url:      newUrl,
      data:     editedData,
      date:     photo.date,
      comment:  photo.comment || ""
    });

    // ✅ FIX: Actualitzar també el client (files[]) a Supabase
    const client = await loadClient(clientId);
    if (client) {
      const fileIdx = (client.files || []).findIndex(f => f.id === photo.id);
      if (fileIdx >= 0) {
        client.files[fileIdx].url  = newUrl;
        client.files[fileIdx].data = newUrl ? null : editedData;
      }
      await saveClient(client);
    }

    // Re-generar historial
    drawHistory = [];
    saveDrawState();

    showAlert('Foto guardada', 'Els canvis s\'han guardat al núvol', '✅');
  } catch (e) {
    console.error('Error guardant foto editada:', e);
    showAlert('Error', 'No s\'ha pogut guardar: ' + e.message, '❌');
  }
}

// Funció global per obtenir coordenades del canvas
function getCanvasPoint(e) {
  const rect = photoCanvas.getBoundingClientRect();

  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;

  // ✅ BUGFIX: getBoundingClientRect() retorna la mida visual (afectada pel
  // transform CSS scale/translate del zoom). Cal usar les mides internes del
  // canvas (photoCanvas.width/height) per convertir coordenades correctament.
  // Amb zoom = 1 el resultat és idèntic a l'anterior; amb zoom > 1 era erroni.
  const scaleX = photoCanvas.width  / rect.width;
  const scaleY = photoCanvas.height / rect.height;

  return {
    x: (clientX - rect.left)  * scaleX,
    y: (clientY - rect.top)   * scaleY
  };
}

// ─── POT DE PINTURA (Flood Fill) ───────────────────────────────────────────
let fillModeEnabled = false;

function toggleFillMode() {
  fillModeEnabled = !fillModeEnabled;
  const btn = document.getElementById('fillToggle');
  if (fillModeEnabled) {
    // Desactivar dibuix si estava actiu
    if (drawingEnabled) toggleDrawing();
    btn?.classList.add('paint-bucket-active');
    if (photoCanvas) {
      photoCanvas.style.cursor = 'crosshair';
      photoCanvas.style.pointerEvents = 'auto';
    }
  } else {
    btn?.classList.remove('paint-bucket-active');
    if (photoCanvas) {
      photoCanvas.style.cursor = 'default';
      photoCanvas.style.pointerEvents = 'none';
    }
  }
}
window.toggleFillMode = toggleFillMode;

function floodFill(startX, startY, fillColor) {
  if (!photoCanvas || !photoCtx) return;

  const imgData = photoCtx.getImageData(0, 0, photoCanvas.width, photoCanvas.height);
  const data    = imgData.data;
  const w       = photoCanvas.width;
  const h       = photoCanvas.height;

  // Color del punt inicial
  const idx = (startY * w + startX) * 4;
  const targetR = data[idx];
  const targetG = data[idx + 1];
  const targetB = data[idx + 2];
  const targetA = data[idx + 3];

  // Parse fill color hex → rgba
  const tmp = document.createElement('canvas');
  tmp.width = tmp.height = 1;
  const tc = tmp.getContext('2d');
  tc.fillStyle = fillColor;
  tc.fillRect(0, 0, 1, 1);
  const fc = tc.getImageData(0, 0, 1, 1).data;
  const fillR = fc[0], fillG = fc[1], fillB = fc[2], fillA = 255;

  // Si el color ja és igual, no fer res
  if (targetR === fillR && targetG === fillG && targetB === fillB && targetA === fillA) return;

  // Tolerància de color (per no ser massa precís)
  const TOLERANCE = 30;
  function colorMatch(i) {
    return Math.abs(data[i]   - targetR) <= TOLERANCE &&
           Math.abs(data[i+1] - targetG) <= TOLERANCE &&
           Math.abs(data[i+2] - targetB) <= TOLERANCE &&
           Math.abs(data[i+3] - targetA) <= TOLERANCE;
  }

  // Stack-based flood fill (iteratiu, no recursiu per evitar overflow)
  const stack = [[startX, startY]];
  const visited = new Uint8Array(w * h);
  visited[startY * w + startX] = 1;

  while (stack.length > 0) {
    const [x, y] = stack.pop();
    const i = (y * w + x) * 4;

    if (!colorMatch(i)) continue;

    data[i]   = fillR;
    data[i+1] = fillG;
    data[i+2] = fillB;
    data[i+3] = fillA;

    if (x > 0   && !visited[y*w + x-1])     { visited[y*w+x-1] = 1;     stack.push([x-1, y]); }
    if (x < w-1 && !visited[y*w + x+1])     { visited[y*w+x+1] = 1;     stack.push([x+1, y]); }
    if (y > 0   && !visited[(y-1)*w + x])   { visited[(y-1)*w+x] = 1;   stack.push([x, y-1]); }
    if (y < h-1 && !visited[(y+1)*w + x])   { visited[(y+1)*w+x] = 1;   stack.push([x, y+1]); }
  }

  photoCtx.putImageData(imgData, 0, 0);
  saveDrawState();
}

// Event listener per al fill — s'activa en setupCanvasDrawing
function handleFillClick(e) {
  if (!fillModeEnabled) return;
  e.preventDefault();
  e.stopPropagation();

  const { x, y } = getCanvasPoint(e);
  const cx = Math.round(x);
  const cy = Math.round(y);

  if (cx >= 0 && cy >= 0 && cx < photoCanvas.width && cy < photoCanvas.height) {
    floodFill(cx, cy, drawColor);
  }
}
// ─────────────────────────────────────────────────────────────────────────────

// Event listeners per dibuixar - VERSIÓ FINAL CORRECTA
function setupCanvasDrawing() {
  if (!photoCanvas || !photoCtx) return;

  // ✅ Netejar listeners anteriors per evitar duplicats en reobrir el lightbox
  if (photoCanvas._drawHandlers) {
    const h = photoCanvas._drawHandlers;
    photoCanvas.removeEventListener('mousedown',  h.startDraw);
    photoCanvas.removeEventListener('mousemove',  h.draw);
    photoCanvas.removeEventListener('mouseup',    h.endDraw);
    photoCanvas.removeEventListener('mouseleave', h.endDraw);
    photoCanvas.removeEventListener('touchstart', h.startDraw);
    photoCanvas.removeEventListener('touchmove',  h.draw);
    photoCanvas.removeEventListener('touchend',   h.endDraw);
  }

  let isDrawing = false;

  function startDraw(e) {
    if (!drawingEnabled) return;
    e.preventDefault();
    e.stopPropagation();

    isDrawing = true;
    const { x, y } = getCanvasPoint(e);
    
    photoCtx.strokeStyle = drawColor;
    photoCtx.lineWidth   = drawSize;
    photoCtx.lineCap     = 'round';
    photoCtx.lineJoin    = 'round';
    photoCtx.beginPath();
    photoCtx.moveTo(x, y);
  }

  function draw(e) {
    if (!isDrawing || !drawingEnabled) return;
    e.preventDefault();
    e.stopPropagation();

    const { x, y } = getCanvasPoint(e);
    photoCtx.lineTo(x, y);
    photoCtx.stroke();
  }

  function endDraw(e) {
    if (!isDrawing) return;
    if (e) { e.preventDefault(); e.stopPropagation(); }

    isDrawing = false;
    photoCtx.closePath();
    saveDrawState();
  }

  // Guardar referències per poder eliminar-les la propera vegada
  photoCanvas._drawHandlers = { startDraw, draw, endDraw };

  // Mouse
  photoCanvas.addEventListener('mousedown',  startDraw);
  photoCanvas.addEventListener('mousemove',  draw);
  photoCanvas.addEventListener('mouseup',    endDraw);
  photoCanvas.addEventListener('mouseleave', endDraw);

  // Touch (stopPropagation impedeix que el swipe del lightbox interfereixi)
  photoCanvas.addEventListener('touchstart', startDraw, { passive: false });
  photoCanvas.addEventListener('touchmove',  draw,      { passive: false });
  photoCanvas.addEventListener('touchend',   endDraw,   { passive: false });

  // ✅ Pot de pintura — click i touch
  photoCanvas.addEventListener('click', handleFillClick);
  photoCanvas.addEventListener('touchend', (e) => {
    if (!fillModeEnabled || e.changedTouches?.length !== 1) return;
    e.preventDefault();
    const t = e.changedTouches[0];
    handleFillClick({ clientX: t.clientX, clientY: t.clientY,
      preventDefault: ()=>{}, stopPropagation: ()=>{}, touches: null });
  }, { passive: false });
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
        url:  photo.url  || null,   // ✅ preservar URL Supabase si existeix
        data: photo.data || null,   // ✅ preservar base64 local si existeix
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
        img.src = file.url || file.data;
        img.className = "photo-thumb";
        img.style.cssText = `
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          pointer-events: none;
        `;
        container.appendChild(img);
        
        // Badge de comentari si en té
        if (file.comment && file.comment.trim()) {
          const badge = document.createElement('div');
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

/* ================= RENDERITZAT DE CLIENTS ================= */

/**
 * Renderitza la llista de clients al #projectList.
 * Utilitza state.clients que ja ha estat carregat per initApp/loadState.
 */
function updateProjectList() {
  const container = document.querySelector('#projectList');
  if (!container) return;

  container.innerHTML = '';

  const allClients = state.clients ? Object.values(state.clients) : [];
  const clients = allClients
    .filter(c => {
      const s = (c.status || '').toLowerCase();
      return s !== 'archived' && s !== 'deleted' && c.active !== false;
    })
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

  if (!clients.length) {
    container.innerHTML = `
      <div style="text-align:center;padding:40px;color:rgba(255,255,255,0.4)">
        <div style="font-size:48px;margin-bottom:16px">📋</div>
        <div style="font-size:16px;font-weight:600;margin-bottom:8px">No hi ha clients</div>
        <div style="font-size:13px">Crea el teu primer client amb el botó +</div>
      </div>`;
    return;
  }

  clients.forEach(function(client) {
    const card = document.createElement('div');
    card.className = 'project-card';
    card.style.cssText = `
      padding:15px;margin-bottom:10px;
      background:rgba(255,255,255,0.05);border-radius:8px;
      cursor:pointer;transition:all 0.2s;
      border-left:3px solid #4CAF50;
    `;
    card.onmouseover = () => { card.style.background = 'rgba(255,255,255,0.1)'; card.style.transform = 'translateX(4px)'; };
    card.onmouseout  = () => { card.style.background = 'rgba(255,255,255,0.05)'; card.style.transform = 'translateX(0)'; };

    const timeStr = client.total > 0 ? `<div style="font-size:11px;color:#4CAF50;margin-top:5px;">⏱️ ${formatTime(client.total)}</div>` : '';
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:start;">
        <div style="flex:1;min-width:0;">
          <div style="font-size:16px;font-weight:600;color:white;margin-bottom:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
            ${client.name || 'Sense nom'}
          </div>
          <div style="font-size:12px;color:#888;">
            ${[client.email, client.phone].filter(Boolean).join(' • ')}
          </div>
          ${client.company ? `<div style="font-size:12px;color:#666;margin-top:2px;">${client.company}</div>` : ''}
          ${timeStr}
        </div>
        <div style="font-size:20px;opacity:0.5;margin-left:10px;">✓</div>
      </div>`;

    card.onclick = () => selectClient(client.id);
    container.appendChild(card);
  });

  console.log(`✅ ${clients.length} clients renderitzats`);
}

/**
 * Selecciona un client: actualitza state, guarda a IndexedDB i mostra la vista.
 * NO fa location.reload() — mostra la vista directament.
 */
async function selectClient(clientId) {
  console.log('📌 Seleccionant client:', clientId);

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

  // Guardar a IndexedDB ABANS de qualsevol altra cosa
  await save();

  // Carregar client i actualitzar tota la UI
  const client = await loadClient(clientId);
  if (!client) {
    console.error('❌ No s\'ha pogut carregar el client:', clientId);
    return;
  }

  // Mostrar panells del client
  const clientInfoPanel = document.getElementById('clientInfoPanel');
  if (clientInfoPanel) clientInfoPanel.style.display = 'block';

  const fixedBtns = document.getElementById('clientFixedButtons');
  if (fixedBtns) { fixedBtns.style.display = 'grid'; fixedBtns.classList.remove('hidden'); }

  closeModal('modalChangeClient');

  // Cridar updateUI original (la completa, async, definida a l'inici del fitxer)
  await _originalUpdateUI(client);

  console.log('✅ Client seleccionat:', client.name);
}

// Guardar referència a la updateUI original CORRECTA (la de la línia ~338)
// per evitar que futures sobrescriptures la trenquin
const _originalUpdateUI = updateUI;

// Exposar al window
window.updateProjectList = updateProjectList;
window.selectClient = selectClient;

console.log('✅ Sistema de clients definitiu carregat');

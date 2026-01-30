/*************************************************
 * FOCUSWORK – app-client-view.js
 * Gestió de la nova vista de client
 *************************************************/

// Variables globals per la vista de client
let isUrgentTaskExpanded = true;
let isImportantTaskExpanded = false;
let isLaterTaskExpanded = false;

/* ================= INICIALITZACIÓ ================= */
function initClientView() {
  // Botó de tornar enrere
  const backBtn = $('backToMainBtn');
  if (backBtn) {
    backBtn.addEventListener('click', closeClientView);
  }

  // Toggles de tasques
  const urgentToggle = $('urgentTaskToggle');
  const importantToggle = $('importantTaskToggle');
  const laterToggle = $('laterTaskToggle');

  if (urgentToggle) {
    urgentToggle.addEventListener('click', () => toggleTaskSection('urgent'));
  }
  if (importantToggle) {
    importantToggle.addEventListener('click', () => toggleTaskSection('important'));
  }
  if (laterToggle) {
    laterToggle.addEventListener('click', () => toggleTaskSection('later'));
  }

  // Headers clicables
  const urgentHeader = $('urgentTaskHeader');
  const importantHeader = $('importantTaskHeader');
  const laterHeader = $('laterTaskHeader');

  if (urgentHeader) {
    urgentHeader.addEventListener('click', () => toggleTaskSection('urgent'));
  }
  if (importantHeader) {
    importantHeader.addEventListener('click', () => toggleTaskSection('important'));
  }
  if (laterHeader) {
    laterHeader.addEventListener('click', () => toggleTaskSection('later'));
  }

  // Botons d'acció ràpida
  const quickCallBtn = $('quickCallBtn');
  const quickEmailBtn = $('quickEmailBtn');
  const quickPhotoBtn = $('quickPhotoBtn');

  if (quickCallBtn) {
    quickCallBtn.addEventListener('click', handleQuickCall);
  }
  if (quickEmailBtn) {
    quickEmailBtn.addEventListener('click', handleQuickEmail);
  }
  if (quickPhotoBtn) {
    quickPhotoBtn.addEventListener('click', () => {
      const cameraBtn = $('cameraBtn');
      if (cameraBtn) cameraBtn.click();
    });
  }

  // Botons d'acció flotants
  const addNoteActionBtn = $('addNoteActionBtn');
  const addHoursActionBtn = $('addHoursActionBtn');
  const addPhotoActionBtn = $('addPhotoActionBtn');
  const changeStatusBtn = $('changeStatusBtn');

  if (addNoteActionBtn) {
    addNoteActionBtn.addEventListener('click', focusUrgentTask);
  }
  if (addHoursActionBtn) {
    addHoursActionBtn.addEventListener('click', () => {
      const addExtraHoursBtn = $('addExtraHoursBtn');
      if (addExtraHoursBtn) addExtraHoursBtn.click();
    });
  }
  if (addPhotoActionBtn) {
    addPhotoActionBtn.addEventListener('click', () => {
      const cameraBtn = $('cameraBtn');
      if (cameraBtn) cameraBtn.click();
    });
  }
  if (changeStatusBtn) {
    changeStatusBtn.addEventListener('click', handleChangeStatus);
  }

  // Botó FAB
  const fabBtn = $('fabAddBtn');
  if (fabBtn) {
    fabBtn.addEventListener('click', showFabMenu);
  }

  // Botons d'hores
  const addHoursBtn = $('addHoursBtn');
  const viewResumeBtn = $('viewResumeBtn');

  if (addHoursBtn) {
    addHoursBtn.addEventListener('click', () => {
      const addExtraHoursBtn = $('addExtraHoursBtn');
      if (addExtraHoursBtn) addExtraHoursBtn.click();
    });
  }
  if (viewResumeBtn) {
    viewResumeBtn.addEventListener('click', () => {
      const viewExtraHoursBtn = $('viewExtraHoursBtn');
      if (viewExtraHoursBtn) viewExtraHoursBtn.click();
    });
  }

  console.log('✅ Vista de client inicialitzada');
}

/* ================= MOSTRAR/OCULTAR VISTA ================= */
async function showClientView(client) {
  const clientView = $('clientInfoPanel');
  const activitiesPanel = $('activitiesPanel');

  if (!clientView) return;

  // Ocultar altres seccions
  if (activitiesPanel) activitiesPanel.style.display = 'none';

  // Mostrar vista de client
  clientView.style.display = 'block';

  // Actualitzar contingut
  updateClientViewContent(client);

  // Carregar estat de les tasques
  loadTaskStates();
}

function closeClientView() {
  // IMPORTANT: Aquesta funció NO tanca el client, només torna a la vista principal
  // El client segueix actiu però es pausa el temps
  
  const clientView = $('clientInfoPanel');
  const activitiesPanel = $('activitiesPanel');

  if (clientView) clientView.style.display = 'none';
  if (activitiesPanel) activitiesPanel.style.display = 'block';
  
  // Pausar el temps del client (sense perdre el progrés)
  // El client segueix sent state.currentClientId però s'atura el comptador
  if (state.currentClientId) {
    state.currentActivity = null;
    state.lastTick = null;
    save();
    updateUI();
  }
}

/* ================= ACTUALITZAR CONTINGUT ================= */
async function updateClientViewContent(client) {
  if (!client) {
    client = await loadClient(state.currentClientId);
  }
  
  if (!client) return;

  // Actualitzar títol
  const clientHeaderTitle = $('clientHeaderTitle');
  if (clientHeaderTitle) {
    clientHeaderTitle.textContent = client.name;
  }

  // Mostrar badge d'urgent si cal
  const urgentBadge = $('urgentBadge');
  if (urgentBadge) {
    // Aquí pots afegir lògica per detectar si és urgent
    const isUrgent = client.deliveryDate && isDeliveryUrgent(client.deliveryDate);
    urgentBadge.style.display = isUrgent ? 'inline-block' : 'none';
  }

  // Actualitzar data d'entrega
  updateDeliveryDateDisplay(client);

  // Actualitzar tasques (es carregaran des del workpad i tasks existents)
  const taskUrgent = $('taskUrgent');
  const taskImportant = $('taskImportant');
  const taskLater = $('taskLater');

  if (taskUrgent && client.workpad) {
    taskUrgent.value = client.workpad;
  }
  if (taskImportant && client.taskImportant) {
    taskImportant.value = client.taskImportant;
  }
  if (taskLater && client.taskLater) {
    taskLater.value = client.taskLater;
  }

  // Actualitzar data de la tasca urgent
  const urgentTaskDate = $('urgentTaskDate');
  if (urgentTaskDate) {
    urgentTaskDate.textContent = new Date().toLocaleDateString('ca-ES');
  }

  // Actualitzar display d'hores
  const clientTotalDisplay = $('clientTotalDisplay');
  if (clientTotalDisplay) {
    clientTotalDisplay.textContent = `Avui: ${formatTime(client.total || 0)}`;
  }

  // Renderitzar galeria de fotos
  renderPhotoGallery(client);
}

/* ================= TOGGLE DE SECCIONS DE TASQUES ================= */
function toggleTaskSection(section) {
  let isExpanded, content, toggle;

  if (section === 'urgent') {
    isUrgentTaskExpanded = !isUrgentTaskExpanded;
    isExpanded = isUrgentTaskExpanded;
    content = $('urgentTaskContent');
    toggle = $('urgentTaskToggle');
  } else if (section === 'important') {
    isImportantTaskExpanded = !isImportantTaskExpanded;
    isExpanded = isImportantTaskExpanded;
    content = $('importantTaskContent');
    toggle = $('importantTaskToggle');
  } else if (section === 'later') {
    isLaterTaskExpanded = !isLaterTaskExpanded;
    isExpanded = isLaterTaskExpanded;
    content = $('laterTaskContent');
    toggle = $('laterTaskToggle');
  }

  if (content) {
    content.style.display = isExpanded ? 'block' : 'none';
  }

  if (toggle) {
    if (isExpanded) {
      toggle.classList.add('expanded');
    } else {
      toggle.classList.remove('expanded');
    }
  }

  // Guardar estat
  saveTaskStates();
}

/* ================= GUARDAR/CARREGAR ESTATS DE TASQUES ================= */
function saveTaskStates() {
  localStorage.setItem('taskStates', JSON.stringify({
    urgent: isUrgentTaskExpanded,
    important: isImportantTaskExpanded,
    later: isLaterTaskExpanded
  }));
}

function loadTaskStates() {
  const saved = localStorage.getItem('taskStates');
  if (saved) {
    try {
      const states = JSON.parse(saved);
      isUrgentTaskExpanded = states.urgent !== undefined ? states.urgent : true;
      isImportantTaskExpanded = states.important !== undefined ? states.important : false;
      isLaterTaskExpanded = states.later !== undefined ? states.later : false;

      // Aplicar estats
      const urgentContent = $('urgentTaskContent');
      const urgentToggle = $('urgentTaskToggle');
      const importantContent = $('importantTaskContent');
      const importantToggle = $('importantTaskToggle');
      const laterContent = $('laterTaskContent');
      const laterToggle = $('laterTaskToggle');

      if (urgentContent) urgentContent.style.display = isUrgentTaskExpanded ? 'block' : 'none';
      if (urgentToggle) urgentToggle.classList.toggle('expanded', isUrgentTaskExpanded);
      
      if (importantContent) importantContent.style.display = isImportantTaskExpanded ? 'block' : 'none';
      if (importantToggle) importantToggle.classList.toggle('expanded', isImportantTaskExpanded);
      
      if (laterContent) laterContent.style.display = isLaterTaskExpanded ? 'block' : 'none';
      if (laterToggle) laterToggle.classList.toggle('expanded', isLaterTaskExpanded);
    } catch (e) {
      console.error('Error carregant estats de tasques:', e);
    }
  }
}

/* ================= ACCIONS RÀPIDES ================= */
function handleQuickCall() {
  // Aquí pots afegir la lògica per trucar al client
  showAlert('Trucada', 'Funció de trucada en desenvolupament', '📞');
}

function handleQuickEmail() {
  // Aquí pots afegir la lògica per enviar email
  showAlert('Email', 'Funció d\'email en desenvolupament', '📧');
}

function handleChangeStatus() {
  // Aquí pots afegir la lògica per canviar l'estat del client
  showAlert('Estat', 'Funció de canvi d\'estat en desenvolupament', '📝');
}

/* ================= FOCUS A TASCA URGENT ================= */
function focusUrgentTask() {
  const taskUrgent = $('taskUrgent');
  if (taskUrgent) {
    // Assegurar que la secció està expandida
    if (!isUrgentTaskExpanded) {
      toggleTaskSection('urgent');
    }
    
    // Fer scroll i focus
    setTimeout(() => {
      taskUrgent.scrollIntoView({ behavior: 'smooth', block: 'center' });
      taskUrgent.focus();
    }, 300);
  }
}

/* ================= MENÚ FAB ================= */
function showFabMenu() {
  // Mostrar un menú amb opcions
  // Pots implementar un menú desplegable aquí
  const options = [
    { icon: '📝', text: 'Afegir nota', action: focusUrgentTask },
    { icon: '⏱️', text: 'Afegir hores', action: () => $('addExtraHoursBtn')?.click() },
    { icon: '📷', text: 'Afegir foto', action: () => $('cameraBtn')?.click() },
    { icon: '📋', text: 'Generar informe', action: () => $('generateReportBtn')?.click() }
  ];

  // Aquí pots crear un menú contextual
  // Per simplificar, mostrem un alert amb les opcions
  const choice = prompt('Selecciona una opció:\n1. Afegir nota\n2. Afegir hores\n3. Afegir foto\n4. Generar informe');
  
  if (choice === '1') focusUrgentTask();
  else if (choice === '2') $('addExtraHoursBtn')?.click();
  else if (choice === '3') $('cameraBtn')?.click();
  else if (choice === '4') $('generateReportBtn')?.click();
}

/* ================= DETECCIÓ D'URGÈNCIA ================= */
function isDeliveryUrgent(deliveryDate) {
  if (!deliveryDate) return false;
  
  const delivery = new Date(deliveryDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  delivery.setHours(0, 0, 0, 0);
  
  const diffDays = Math.ceil((delivery - today) / (1000 * 60 * 60 * 24));
  
  return diffDays <= 1; // Urgent si és avui o demà
}

/* ================= AUTO-GUARDAT DE TASQUES ================= */
function initTaskAutoSave() {
  const taskUrgent = $('taskUrgent');
  const taskImportant = $('taskImportant');
  const taskLater = $('taskLater');

  if (taskUrgent) {
    taskUrgent.addEventListener('blur', async () => {
      const client = await loadClient(state.currentClientId);
      if (client) {
        client.workpad = taskUrgent.value;
        await saveClient(client);
      }
    });
  }

  if (taskImportant) {
    taskImportant.addEventListener('blur', async () => {
      const client = await loadClient(state.currentClientId);
      if (client) {
        client.taskImportant = taskImportant.value;
        await saveClient(client);
      }
    });
  }

  if (taskLater) {
    taskLater.addEventListener('blur', async () => {
      const client = await loadClient(state.currentClientId);
      if (client) {
        client.taskLater = taskLater.value;
        await saveClient(client);
      }
    });
  }
}

/* ================= INTEGRACIÓ AMB UPDATEUI EXISTENT ================= */
// Modificar la funció updateUI existent per usar la nova vista
const originalUpdateUI = window.updateUI;
if (originalUpdateUI) {
  window.updateUI = async function(preloadedClient = null) {
    await originalUpdateUI(preloadedClient);
    
    // Si hi ha un client actiu i està treballant, mostrar la nova vista
    if (state.currentClientId && state.currentActivity) {
      const client = preloadedClient || await loadClient(state.currentClientId);
      await showClientView(client);
    } else {
      // Si no hi ha activitat (temps parat), mostrar la vista principal
      closeClientView();
    }
  };
}

/* ================= INICIALITZACIÓ AL CARREGAR ================= */
document.addEventListener('DOMContentLoaded', () => {
  initClientView();
  initTaskAutoSave();
  console.log('✅ app-client-view.js carregat');
});

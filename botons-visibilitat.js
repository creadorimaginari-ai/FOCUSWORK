/* =====================================================
   VISIBILITAT BOTONS TANCAR/SORTIR CLIENT
   Només es mostren dins de la vista del client
   ===================================================== */

// Funció per controlar la visibilitat dels botons segons l'estat
function updateClientButtonsVisibility() {
  const closeClientBtn = document.getElementById('closeClient');
  const historyBtn = document.getElementById('historyBtn');
  const backToMainBtn = document.getElementById('backToMainBtn');
  const clientInfoPanel = document.getElementById('clientInfoPanel');
  const activitiesPanel = document.getElementById('activitiesPanel');
  
  // Comprovar si estem dins de la vista del client
  const isInClientView = clientInfoPanel && clientInfoPanel.style.display !== 'none' && state.currentClientId;
  
  // Mostrar/ocultar botons segons si estem dins del client o no
  if (closeClientBtn) {
    closeClientBtn.style.display = isInClientView ? 'flex' : 'none';
  }
  
  if (historyBtn) {
    historyBtn.style.display = isInClientView ? 'flex' : 'none';
  }
  
  if (backToMainBtn) {
    backToMainBtn.style.display = isInClientView ? 'flex' : 'none';
  }
}

// Modificar la funció showClientView per actualitzar visibilitat
const originalShowClientView = window.showClientView;
if (originalShowClientView) {
  window.showClientView = async function(client) {
    await originalShowClientView(client);
    updateClientButtonsVisibility();
  };
}

// Modificar la funció closeClientView per actualitzar visibilitat
const originalCloseClientView = window.closeClientView;
if (originalCloseClientView) {
  window.closeClientView = function() {
    originalCloseClientView();
    updateClientButtonsVisibility();
  };
}

// Modificar updateUI per actualitzar visibilitat
const originalUpdateUI = window.updateUI;
if (originalUpdateUI) {
  window.updateUI = async function(preloadedClient = null) {
    await originalUpdateUI(preloadedClient);
    updateClientButtonsVisibility();
  };
}

// Cridar al carregar la pàgina
document.addEventListener('DOMContentLoaded', () => {
  updateClientButtonsVisibility();
  console.log('✅ Visibilitat de botons de client configurada');
});

// També cridar quan canvia l'estat
if (window.state) {
  const originalSetState = window.state;
  Object.defineProperty(window, 'state', {
    get: () => originalSetState,
    set: (newState) => {
      originalSetState = newState;
      updateClientButtonsVisibility();
    }
  });
}

console.log('✅ Sistema de visibilitat de botons carregat');

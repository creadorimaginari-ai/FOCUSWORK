/* =====================================================
   EVENT LISTENERS PER ESTATS I PROGRÉS
   (SENSE demanar nota quan canvies l'estat)
   ===================================================== */

// Event listeners per al selector d'estat (SENSE prompt)
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
  
  // Canviar estat SENSE demanar nota
  stateOptions.forEach(option => {
    option.addEventListener('click', async () => {
      const stateId = option.dataset.state;
      
      // ⭐ ELIMINAT: const note = prompt('Afegeix una nota (opcional):');
      // Ara no demanem cap nota, simplement canviem l'estat
      
      // Actualitzar estat (sense nota)
      await setClientState(state.currentClientId, stateId, '');
      
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

// Event listeners per al selector de progrés (amb quadrats)
function setupProgressListeners() {
  const progressSquares = document.querySelectorAll('.progress-square');
  
  progressSquares.forEach(square => {
    square.addEventListener('click', async () => {
      const level = parseInt(square.dataset.level);
      
      // Actualitzar progrés
      await setClientProgress(state.currentClientId, level);
      
      // Actualitzar UI
      await initProjectStatus();
      
      // Mostrar confirmació
      const progressLabel = PROGRESS_LEVELS[level].label;
      showAlert('Progrés actualitzat', `${progressLabel} (${level}/5)`, '⭐');
    });
  });
}

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
  if (stateContainer) {
    stateContainer.innerHTML = renderStateSelector(client);
    setupStateListeners();
  }
  
  // Renderitzar progrés
  const progressContainer = document.getElementById('projectProgressContainer');
  if (progressContainer) {
    progressContainer.innerHTML = renderProgressSelector(client);
    setupProgressListeners();
  }
  
  // Renderitzar historial
  const historyContainer = document.getElementById('projectHistoryContainer');
  if (historyContainer && client.stateHistory && client.stateHistory.length > 0) {
    historyContainer.innerHTML = renderStateHistory(client);
  }
}

console.log('✅ Event listeners d\'estats configurats (sense prompt de nota)');

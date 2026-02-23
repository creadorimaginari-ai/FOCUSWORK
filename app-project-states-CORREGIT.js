/*************************************************
 * FOCUSWORK – Sistema d'Estats i Progrés
 * Gestió visual de l'estat dels projectes
 *************************************************/

// Helper per traduccions d'estats
function _stateLabel(key) {
  return (typeof t === 'function') ? t(key) : key;
}

// Estats disponibles del projecte
// Usem getters per retornar la label en l'idioma actiu cada vegada
const PROJECT_STATES = {
  WAITING_MATERIAL: {
    id: 'waiting_material',
    get label() { return _stateLabel('state_waiting_material_full'); },
    icon: '🟡',
    color: '#fbbf24',
  },
  IN_PROGRESS: {
    id: 'in_progress',
    get label() { return _stateLabel('state_in_progress_full'); },
    icon: '🔵',
    color: '#3b82f6',
  },
  WAITING_FEEDBACK: {
    id: 'waiting_feedback',
    get label() { return _stateLabel('state_waiting_feedback_full'); },
    icon: '✉️',
    color: '#a855f7',
  },
  PAUSED: {
    id: 'paused',
    get label() { return _stateLabel('state_paused_full'); },
    icon: '⏸️',
    color: '#6b7280',
  },
  READY_TO_DELIVER: {
    id: 'ready_to_deliver',
    get label() { return _stateLabel('state_ready_full'); },
    icon: '🟢',
    color: '#10b981',
  },
  BLOCKED: {
    id: 'blocked',
    get label() { return _stateLabel('state_blocked_full'); },
    icon: '🔴',
    color: '#ef4444',
  },
  WAITING_BUDGET: {
    id: 'waiting_budget',
    get label() { return _stateLabel('state_waiting_budget_full'); },
    icon: '💰',
    color: '#f97316',
  }
};

// Nivells de progrés (1-5 quadrats amb colors: vermell, vermell, taronja, taronja, verd)
const PROGRESS_LEVELS = {
  1: { get label() { return _stateLabel('prog_1'); }, percent: 20, color: '#ef4444' },
  2: { get label() { return _stateLabel('prog_2'); }, percent: 40, color: '#ef4444' },
  3: { get label() { return _stateLabel('prog_3'); }, percent: 60, color: '#f97316' },
  4: { get label() { return _stateLabel('prog_4'); }, percent: 80, color: '#f97316' },
  5: { get label() { return _stateLabel('prog_5'); }, percent: 100, color: '#10b981' }
};

/* ================= FUNCIONS D'ESTAT ================= */

// Establir l'estat d'un client (SENSE demanar nota)
async function setClientState(clientId, stateId, note = '') {
  const client = await loadClient(clientId);
  if (!client) return false;
  
  const state = Object.values(PROJECT_STATES).find(s => s.id === stateId);
  if (!state) return false;
  
  // Inicialitzar historial si no existeix
  if (!client.stateHistory) {
    client.stateHistory = [];
  }
  
  // Guardar estat actual
  client.state = stateId;
  client.stateLabel = state.label;
  client.stateIcon = state.icon;
  client.stateColor = state.color;
  client.stateUpdatedAt = Date.now();
  
  // Afegir a l'historial
  client.stateHistory.push({
    state: stateId,
    label: state.label,
    icon: state.icon,
    date: Date.now(),
    note: note,
    progress: client.progress || 1
  });
  
  // Guardar
  await saveClient(client);
  
  return true;
}

// Establir el nivell de progrés
async function setClientProgress(clientId, level) {
  if (level < 1 || level > 5) return false;
  
  const client = await loadClient(clientId);
  if (!client) return false;
  
  client.progress = level;
  client.progressLabel = PROGRESS_LEVELS[level].label;
  client.progressPercent = PROGRESS_LEVELS[level].percent;
  client.progressColor = PROGRESS_LEVELS[level].color;
  client.progressUpdatedAt = Date.now();
  
  await saveClient(client);
  
  return true;
}

// Obtenir temps des de l'última actualització d'estat
function getTimeSinceStateUpdate(client) {
  if (!client.stateUpdatedAt) return null;
  
  const now = Date.now();
  const diff = now - client.stateUpdatedAt;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  
  if (days > 0) {
    return `fa ${days} ${days === 1 ? 'dia' : 'dies'}`;
  } else if (hours > 0) {
    return `fa ${hours}h`;
  } else {
    return 'ara mateix';
  }
}

/* ================= RENDERITZACIÓ ================= */

// Renderitzar selector d'estat
function renderStateSelector(client) {
  const currentState = client.state || 'in_progress';
  const stateObj = Object.values(PROJECT_STATES).find(s => s.id === currentState) || PROJECT_STATES.IN_PROGRESS;
  
  return `
    <div class="project-state-section">
      <div class="project-state-current" id="currentProjectState">
        <div class="state-icon" style="background: ${stateObj.color}20; color: ${stateObj.color}">
          ${stateObj.icon}
        </div>
        <div class="state-info">
          <div class="state-label">${stateObj.label}</div>
          <div class="state-time">${getTimeSinceStateUpdate(client) || 'Actualitza l\'estat'}</div>
        </div>
        <button class="state-change-btn" id="changeStateBtn">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
      </div>
      
      <div class="state-dropdown hidden" id="stateDropdown">
        ${Object.values(PROJECT_STATES).map(state => `
          <button class="state-option ${state.id === currentState ? 'active' : ''}" data-state="${state.id}">
            <span class="state-option-icon" style="color: ${state.color}">${state.icon}</span>
            <div class="state-option-info">
              <div class="state-option-label">${state.label}</div>
              <div class="state-option-description">${state.description}</div>
            </div>
            ${state.id === currentState ? '<span class="state-check">✓</span>' : ''}
          </button>
        `).join('')}
      </div>
    </div>
  `;
}

// Renderitzar selector de progrés amb QUADRATS de colors
function renderProgressSelector(client) {
  const currentProgress = client.progress || 1;
  
  return `
    <div class="project-progress-section">
      <div class="progress-header">
        <span class="progress-label" data-i18n="progres_projecte">${(typeof t==='function')?t('progres_projecte'):'Progrés del projecte'}</span>
        <span class="progress-percent">${PROGRESS_LEVELS[currentProgress].percent}%</span>
      </div>
      
      <div class="progress-squares" id="progressSquares">
        ${[1, 2, 3, 4, 5].map(level => {
          const isActive = level <= currentProgress;
          const color = PROGRESS_LEVELS[level].color;
          return `
            <button 
              class="progress-square ${isActive ? 'active' : ''}" 
              data-level="${level}"
              style="${isActive ? `background: ${color}; border-color: ${color};` : ''}"
            >
            </button>
          `;
        }).join('')}
      </div>
      
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${PROGRESS_LEVELS[currentProgress].percent}%; background: ${PROGRESS_LEVELS[currentProgress].color};"></div>
      </div>
      
      <div class="progress-description">
        ${PROGRESS_LEVELS[currentProgress].label}
      </div>
    </div>
  `;
}

// Renderitzar historial d'estats (últims 3)
function renderStateHistory(client) {
  if (!client.stateHistory || client.stateHistory.length === 0) {
    return '';
  }
  
  const recent = client.stateHistory.slice(-3).reverse();
  
  return `
    <div class="state-history-section">
      <div class="state-history-header">
        <span>📝 Últims canvis d'estat</span>
        <button class="state-history-toggle" id="stateHistoryToggle">
          ${client.stateHistory.length > 3 ? `Veure tots (${client.stateHistory.length})` : ''}
        </button>
      </div>
      
      <div class="state-history-list">
        ${recent.map(entry => {
          const date = new Date(entry.date);
          const dateStr = date.toLocaleDateString('ca-ES', { day: '2-digit', month: 'short' });
          const timeStr = date.toLocaleTimeString('ca-ES', { hour: '2-digit', minute: '2-digit' });
          
          return `
            <div class="state-history-item">
              <span class="state-history-icon">${entry.icon}</span>
              <div class="state-history-content">
                <div class="state-history-label">${entry.label}</div>
                <div class="state-history-date">${dateStr} · ${timeStr} · ${entry.progress}/5</div>
                ${entry.note ? `<div class="state-history-note">${entry.note}</div>` : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

// Renderitzar targeta de client a la llista (vista compacta)
function renderClientCard(client) {
  const stateObj = Object.values(PROJECT_STATES).find(s => s.id === (client.state || 'in_progress')) || PROJECT_STATES.IN_PROGRESS;
  const progress = client.progress || 1;
  const progressInfo = PROGRESS_LEVELS[progress];
  
  // Generar quadrats visuals
  const progressSquares = [1, 2, 3, 4, 5].map(level => {
    const isActive = level <= progress;
    const color = PROGRESS_LEVELS[level].color;
    return `<span class="mini-square ${isActive ? 'active' : ''}" style="${isActive ? `background: ${color}; border-color: ${color};` : ''}"></span>`;
  }).join('');
  
  // Calcular urgència
  let urgencyClass = '';
  let urgencyLabel = '';
  if (client.deliveryDate) {
    const today = new Date();
    const delivery = new Date(client.deliveryDate);
    const diffDays = Math.ceil((delivery - today) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      urgencyClass = 'overdue';
      urgencyLabel = `⚠️ Vençut fa ${Math.abs(diffDays)} dies`;
    } else if (diffDays === 0) {
      urgencyClass = 'today';
      urgencyLabel = '🔴 Entrega AVUI';
    } else if (diffDays <= 3) {
      urgencyClass = 'urgent';
      urgencyLabel = `🟡 Entrega en ${diffDays} dies`;
    }
  }
  
  // Detectar si està bloquejat
  const isBlocked = client.state === 'blocked' || 
                    (client.state === 'waiting_material' && getTimeSinceStateUpdate(client)?.includes('dies'));
  
  return `
    <button class="client-card" data-client-id="${client.id}">
      <div class="client-card-header">
        <div class="client-card-name">${client.name}</div>
        ${isBlocked ? '<span class="client-card-blocked">⚠️</span>' : ''}
      </div>
      
      <div class="client-card-state">
        <span class="client-state-badge" style="background: ${stateObj.color}20; color: ${stateObj.color}">
          ${stateObj.icon} ${stateObj.label}
        </span>
        <span class="client-progress-badge">
          ${progressSquares} ${progress}/5
        </span>
      </div>
      
      <div class="client-card-info">
        ${client.deliveryDate ? `
          <span class="client-card-delivery ${urgencyClass}">
            ${urgencyLabel || `📅 ${new Date(client.deliveryDate).toLocaleDateString('ca-ES', { day: 'numeric', month: 'short' })}`}
          </span>
        ` : ''}
        <span class="client-card-time">
          ⏱️ ${formatTime(client.total || 0)}
        </span>
      </div>
      
      ${isBlocked ? `
        <div class="client-card-warning">
          ${getTimeSinceStateUpdate(client) ? `Bloquejat ${getTimeSinceStateUpdate(client)}` : 'Bloquejat'}
        </div>
      ` : ''}
    </button>
  `;
}

/* ================= EXPORTAR FUNCIONS ================= */
window.PROJECT_STATES = PROJECT_STATES;
window.PROGRESS_LEVELS = PROGRESS_LEVELS;
window.setClientState = setClientState;
window.setClientProgress = setClientProgress;
window.getTimeSinceStateUpdate = getTimeSinceStateUpdate;
window.renderStateSelector = renderStateSelector;
window.renderProgressSelector = renderProgressSelector;
window.renderStateHistory = renderStateHistory;
window.renderClientCard = renderClientCard;

console.log('✅ Sistema d\'estats i progrés carregat');

/*************************************************
 * FOCUSWORK — supabase-realtime.js
 * Sincronització en temps real entre dispositius
 * 
 * Com funciona:
 * - S'subscriu als canvis de la taula "clients" a Supabase
 * - Quan un altre dispositiu guarda/elimina un client,
 *   aquest dispositiu rep la notificació i actualitza la UI
 * - Evita processar els nostres propis canvis (debounce)
 *************************************************/

console.log('🔴 Supabase Realtime carregant...');

let _realtimeChannel = null;
let _lastSaveTs = 0; // timestamp de l'últim save propi (per evitar loop)
const SELF_SAVE_DEBOUNCE = 3000; // ignorar canvis durant 3s després de guardar nosaltres

/**
 * Iniciar la subscripció Realtime.
 * S'ha de cridar després que l'usuari estigui autenticat.
 */
function initRealtimeSync() {
  const userId = typeof window.getCurrentUser === 'function'
    ? (window.getCurrentUser()?.id || null)
    : null;

  if (!userId) {
    console.warn('⚠️ Realtime: no hi ha usuari autenticat, no s\'inicia la subscripció');
    return;
  }

  // Evitar subscripcions duplicades
  if (_realtimeChannel) {
    console.log('ℹ️ Realtime: ja hi ha una subscripció activa');
    return;
  }

  console.log('🔴 Iniciant Realtime per usuari:', userId);

  try {
    _realtimeChannel = window.supabase
      .channel('clients-sync-' + userId)
      .on(
        'postgres_changes',
        {
          event: '*',           // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'clients',
          filter: 'user_id=eq.' + userId
        },
        handleRemoteChange
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Realtime: subscripció activa — sincronització entre dispositius activada');
          _showSyncIndicator('connected');
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          console.warn('⚠️ Realtime: connexió tancada o error —', status);
          _showSyncIndicator('disconnected');
          _realtimeChannel = null;
          // Reintentar connexió després de 5 segons
          setTimeout(initRealtimeSync, 5000);
        } else {
          console.log('🔴 Realtime status:', status);
        }
      });

  } catch (err) {
    console.error('❌ Error iniciant Realtime:', err);
  }
}

/**
 * Processar un canvi rebut des d'un altre dispositiu
 */
async function handleRemoteChange(payload) {
  // Ignorar canvis que hem fet nosaltres mateixos (durant 3s)
  if (Date.now() - _lastSaveTs < SELF_SAVE_DEBOUNCE) {
    console.log('🔄 Realtime: ignorant canvi propi (debounce)');
    return;
  }

  const { eventType, new: newRecord, old: oldRecord } = payload;
  console.log('📡 Realtime: canvi rebut —', eventType, newRecord?.id || oldRecord?.id);

  try {
    if (eventType === 'INSERT' || eventType === 'UPDATE') {
      await _applyRemoteUpdate(newRecord);
    } else if (eventType === 'DELETE') {
      await _applyRemoteDelete(oldRecord?.id);
    }
  } catch (err) {
    console.error('❌ Realtime: error processant canvi:', err);
  }
}

/**
 * Aplicar una actualització remota a l'estat local
 */
async function _applyRemoteUpdate(record) {
  if (!record || !record.id) return;

  // Usar el mapper del supabase-db.js si existeix
  const mappedClient = typeof window._mapClientPublic === 'function'
    ? window._mapClientPublic(record)
    : _defaultMapClient(record);

  // Actualitzar l'estat de l'app
  if (typeof window.state !== 'undefined' && window.state.clients) {
    window.state.clients[record.id] = mappedClient;
    console.log('✅ Realtime: client actualitzat localment —', mappedClient.name);
  }

  // Invalidar la cache de Supabase DB i també IndexedDB per evitar llegir dades velles
  if (typeof window.invalidateClientsCache === 'function') {
    window.invalidateClientsCache();
  }

  // ✅ FIX: passar el client ja actualitzat directament a updateUI
  // sense passar-lo, updateUI fa loadClient() que pot retornar la versió en cache antiga
  _refreshUI(record.id, mappedClient);
}

/**
 * Aplicar una eliminació remota a l'estat local
 */
async function _applyRemoteDelete(clientId) {
  if (!clientId) return;

  if (typeof window.state !== 'undefined' && window.state.clients) {
    const clientName = window.state.clients[clientId]?.name || clientId;
    delete window.state.clients[clientId];
    console.log('✅ Realtime: client eliminat localment —', clientName);
    _showSyncToast('🗑️ Client "' + clientName + '" eliminat des d\'un altre dispositiu');
  }

  if (typeof window.invalidateClientsCache === 'function') {
    window.invalidateClientsCache();
  }

  _refreshUI(null);
}

/**
 * Mapper per defecte si _mapClientPublic no existeix
 */
function _defaultMapClient(client) {
  return {
    ...client,
    active:         (client.status === 'active' || !client.status),
    billableTime:   client.billable_time   || client.billableTime || 0,
    activities:     client.activities      || {},
    tasks:          client.tasks           || { urgent: '', important: '', later: '' },
    photos:         client.photos          || [],
    files:          client.files           || [],
    state:          client.state           || 'in_progress',
    stateLabel:     client.state_label     || null,
    stateIcon:      client.state_icon      || null,
    stateColor:     client.state_color     || null,
    stateUpdatedAt: client.state_updated_at ? new Date(client.state_updated_at).getTime() : null,
    stateHistory:   client.state_history   || [],
    progress:       client.progress        || 1,
    progressLabel:  client.progress_label  || null,
    progressPercent:client.progress_percent|| null,
    progressColor:  client.progress_color  || null
  };
}

/**
 * Refrescar la interfície d'usuari
 * @param {string|null} changedClientId - ID del client que ha canviat
 * @param {object|null} updatedClient - El client ja actualitzat (evita llegir cache antiga)
 */
function _refreshUI(changedClientId, updatedClient = null) {
  try {
    // Actualitzar llista de clients si existeix
    if (typeof window.renderClients === 'function') {
      window.renderClients();
    }

    // ✅ FIX SINCRONITZACIÓ: si el client canviat és el que es veu ara,
    // passar-lo directament a updateUI per evitar que llegeixi la cache antiga d'IndexedDB
    const isCurrentClient = changedClientId
      && typeof window.state !== 'undefined'
      && window.state.currentClientId === changedClientId;

    if (typeof window.updateUI === 'function') {
      if (isCurrentClient && updatedClient) {
        // Forçar reset dels flags d'inicialització per que updateWorkpad i updateTasks
        // actualitzin els textareas amb els valors nous
        if (typeof window.isWorkpadInitialized !== 'undefined') window.isWorkpadInitialized = false;
        if (typeof window.areTasksInitialized !== 'undefined') window.areTasksInitialized = false;
        window.updateUI(updatedClient);
      } else {
        window.updateUI();
      }
    }
  } catch (err) {
    console.warn('⚠️ Realtime: error refrescant UI:', err);
  }
}

/**
 * Marcar que acabem de guardar nosaltres (per evitar processar el nostre propi canvi)
 * Cridar aquesta funció des de saveClientSupabase
 */
function markSelfSave() {
  _lastSaveTs = Date.now();
}
window.markRealtimeSelfSave = markSelfSave;

/**
 * Aturar la subscripció Realtime (p.ex. quan l'usuari fa logout)
 */
function stopRealtimeSync() {
  if (_realtimeChannel) {
    window.supabase.removeChannel(_realtimeChannel);
    _realtimeChannel = null;
    console.log('🔴 Realtime: subscripció aturada');
    _showSyncIndicator('disconnected');
  }
}
window.stopRealtimeSync = stopRealtimeSync;

/**
 * Mostrar un toast/notificació de sincronització
 */
function _showSyncToast(message) {
  try {
    // Intentar usar el sistema de notificacions existent
    if (typeof window.showToast === 'function') {
      window.showToast(message);
      return;
    }
    if (typeof window.showAlert === 'function') {
      // No usar showAlert per canvis remots — massa intrusiu
    }
    // Crear toast simple si no n'hi ha cap
    const toast = document.createElement('div');
    toast.className = 'realtime-toast';
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(30,30,40,0.95);
      color: #fff;
      padding: 10px 20px;
      border-radius: 24px;
      font-size: 14px;
      z-index: 99999;
      box-shadow: 0 4px 20px rgba(0,0,0,0.4);
      border: 1px solid rgba(255,255,255,0.1);
      animation: fadeInUp 0.3s ease;
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
  } catch (e) { /* silenci */ }
}

/**
 * Indicador visual de l'estat de la connexió Realtime
 */
function _showSyncIndicator(status) {
  try {
    let indicator = document.getElementById('realtimeSyncDot');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'realtimeSyncDot';
      indicator.title = 'Sincronització en temps real';
      indicator.style.cssText = `
        position: fixed;
        bottom: 8px;
        right: 8px;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        z-index: 9999;
        transition: background 0.5s;
        opacity: 0.7;
      `;
      document.body.appendChild(indicator);
    }
    indicator.style.background = status === 'connected' ? '#22c55e' : '#ef4444';
    indicator.title = status === 'connected'
      ? '✅ Sincronitzat en temps real'
      : '🔴 Sense connexió en temps real';
  } catch (e) { /* silenci */ }
}

// Exportar
window.initRealtimeSync = initRealtimeSync;
window.stopRealtimeSync = stopRealtimeSync;

console.log('✅ supabase-realtime.js carregat');

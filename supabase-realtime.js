/*************************************************
 * FOCUSWORK — supabase-realtime.js
 * Sincronització en temps real — DOBLE CAPA
 *
 * CAPA 1 — Realtime WebSocket (Supabase)
 *   Instant quan funciona, però de vegades tarda o falla
 *
 * CAPA 2 — Polling actiu (backup)
 *   Cada 3s comprova si el client obert ha canviat a Supabase
 *   Si detecta canvi → actualitza la UI immediatament
 *   S'atura sol quan l'usuari escriu (per no interferir)
 *************************************************/

console.log('🔴 Supabase Realtime (doble capa) carregant...');

let _realtimeChannel  = null;
let _lastSaveTs       = 0;
let _pollingInterval  = null;
let _lastKnownHash    = {};
let _userIsTyping     = false;
let _typingTimer      = null;

const SELF_SAVE_DEBOUNCE = 3000;
const POLL_INTERVAL      = 3000;
const TYPING_COOLDOWN    = 2000;

/* ── CAPA 1: WEBSOCKET ── */

function initRealtimeSync() {
  const userId = typeof window.getCurrentUser === 'function'
    ? (window.getCurrentUser()?.id || null) : null;
  if (!userId) { console.warn('⚠️ Realtime: no hi ha usuari'); return; }
  if (_realtimeChannel) { _startPolling(); return; }

  try {
    _realtimeChannel = window.supabase
      .channel('clients-sync-' + userId)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'clients', filter: 'user_id=eq.' + userId },
        handleRemoteChange)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ WebSocket actiu');
          _showSyncIndicator('connected');
          _startPolling();
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          console.warn('⚠️ WebSocket tancat —', status);
          _showSyncIndicator('polling');
          _realtimeChannel = null;
          setTimeout(initRealtimeSync, 8000);
        }
      });
  } catch (err) {
    console.error('❌ Error WebSocket:', err);
    _startPolling();
  }
}

async function handleRemoteChange(payload) {
  if (Date.now() - _lastSaveTs < SELF_SAVE_DEBOUNCE) return;
  const { eventType, new: newRecord, old: oldRecord } = payload;
  console.log('📡 WebSocket: canvi —', eventType);
  if (eventType === 'INSERT' || eventType === 'UPDATE') await _applyRemoteUpdate(newRecord);
  else if (eventType === 'DELETE') await _applyRemoteDelete(oldRecord?.id);
}

/* ── CAPA 2: POLLING ── */

function _startPolling() {
  if (_pollingInterval) return;
  console.log('🔄 Polling iniciat (cada ' + POLL_INTERVAL/1000 + 's)');
  _pollingInterval = setInterval(_pollCurrentClient, POLL_INTERVAL);
  document.addEventListener('input',   _onUserTyping, { passive: true });
  document.addEventListener('keydown', _onUserTyping, { passive: true });
}

function _stopPolling() {
  if (_pollingInterval) { clearInterval(_pollingInterval); _pollingInterval = null; }
  document.removeEventListener('input',   _onUserTyping);
  document.removeEventListener('keydown', _onUserTyping);
}

function _onUserTyping() {
  _userIsTyping = true;
  clearTimeout(_typingTimer);
  _typingTimer = setTimeout(() => { _userIsTyping = false; }, TYPING_COOLDOWN);
}

async function _pollCurrentClient() {
  if (_userIsTyping) return;
  if (Date.now() - _lastSaveTs < SELF_SAVE_DEBOUNCE) return;

  const clientId = typeof window.state !== 'undefined' ? window.state.currentClientId : null;
  if (!clientId) return;

  const userId = typeof window.getCurrentUser === 'function'
    ? (window.getCurrentUser()?.id || null) : null;
  if (!userId) return;

  try {
    const { data, error } = await window.supabase
      .from('clients')
      .select('id, notes, tasks, updated_at')
      .eq('id', clientId)
      .eq('user_id', userId)
      .single();

    if (error || !data) return;

    const hash = _quickHash(data.notes, data.tasks, data.updated_at);
    const prev = _lastKnownHash[clientId];

    if (prev === undefined) { _lastKnownHash[clientId] = hash; return; }

    if (hash !== prev) {
      console.log('🔄 Polling: canvi detectat!');
      _lastKnownHash[clientId] = hash;
      const { data: full, error: e2 } = await window.supabase
        .from('clients').select('*').eq('id', clientId).single();
      if (!e2 && full) await _applyRemoteUpdate(full);
    }
  } catch (err) { /* silenci xarxa */ }
}

function _quickHash(notes, tasks, updatedAt) {
  const str = (notes || '') + JSON.stringify(tasks || {}) + (updatedAt || '');
  let h = 0;
  for (let i = 0; i < str.length; i++) h = Math.imul(31, h) + str.charCodeAt(i) | 0;
  return h;
}

/* ── APLICAR CANVIS ── */

async function _applyRemoteUpdate(record) {
  if (!record || !record.id) return;
  const mapped = typeof window._mapClientPublic === 'function'
    ? window._mapClientPublic(record) : _defaultMapClient(record);
  if (typeof window.state !== 'undefined' && window.state.clients)
    window.state.clients[record.id] = mapped;
  if (typeof window.invalidateClientsCache === 'function') window.invalidateClientsCache();
  _lastKnownHash[record.id] = _quickHash(record.notes, record.tasks, record.updated_at);
  _refreshUI(record.id, mapped);
}

async function _applyRemoteDelete(clientId) {
  if (!clientId) return;
  if (typeof window.state !== 'undefined' && window.state.clients) {
    const name = window.state.clients[clientId]?.name || clientId;
    delete window.state.clients[clientId];
    _showSyncToast('🗑️ Client "' + name + '" eliminat des d\'un altre dispositiu');
  }
  delete _lastKnownHash[clientId];
  if (typeof window.invalidateClientsCache === 'function') window.invalidateClientsCache();
  _refreshUI(null);
}

/* ── REFRESC UI ── */

function _refreshUI(changedClientId, updatedClient = null) {
  try {
    if (typeof window.renderClients === 'function') window.renderClients();
    const isCurrent = changedClientId
      && typeof window.state !== 'undefined'
      && window.state.currentClientId === changedClientId;
    if (typeof window.updateUI === 'function') {
      if (isCurrent && updatedClient) {
        if (typeof window.isWorkpadInitialized !== 'undefined') window.isWorkpadInitialized = false;
        if (typeof window.areTasksInitialized !== 'undefined')  window.areTasksInitialized  = false;
        window.updateUI(updatedClient);
      } else {
        window.updateUI();
      }
    }
  } catch (err) { console.warn('⚠️ _refreshUI error:', err); }
}

/* ── MAPPER ── */

function _defaultMapClient(c) {
  return {
    ...c,
    active:          (c.status === 'active' || !c.status),
    billableTime:    c.billable_time    || c.billableTime || 0,
    activities:      c.activities       || {},
    tasks:           c.tasks            || { urgent: '', important: '', later: '' },
    photos:          c.photos           || [],
    files:           c.files            || [],
    state:           c.state            || 'in_progress',
    stateLabel:      c.state_label      || null,
    stateIcon:       c.state_icon       || null,
    stateColor:      c.state_color      || null,
    stateUpdatedAt:  c.state_updated_at ? new Date(c.state_updated_at).getTime() : null,
    stateHistory:    c.state_history    || [],
    progress:        c.progress         || 1,
    progressLabel:   c.progress_label   || null,
    progressPercent: c.progress_percent || null,
    progressColor:   c.progress_color   || null,
    deliveryDate:    c.delivery_date    ? new Date(c.delivery_date).toISOString().split('T')[0] : (c.deliveryDate || null)
  };
}

/* ── EXPORTS I UTILS ── */

function markSelfSave() {
  _lastSaveTs = Date.now();
  const cid = typeof window.state !== 'undefined' ? window.state.currentClientId : null;
  if (cid) delete _lastKnownHash[cid];
}
window.markRealtimeSelfSave = markSelfSave;

function stopRealtimeSync() {
  if (_realtimeChannel) { window.supabase.removeChannel(_realtimeChannel); _realtimeChannel = null; }
  _stopPolling();
  _lastKnownHash = {};
  _showSyncIndicator('disconnected');
  console.log('🔴 Sync aturat');
}
window.stopRealtimeSync = stopRealtimeSync;

function _showSyncToast(msg) {
  try {
    if (typeof window.showToast === 'function') { window.showToast(msg); return; }
    const t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:rgba(30,30,40,0.95);color:#fff;padding:10px 20px;border-radius:24px;font-size:14px;z-index:99999;box-shadow:0 4px 20px rgba(0,0,0,0.4)';
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3500);
  } catch(e) {}
}

function _showSyncIndicator(status) {
  try {
    let dot = document.getElementById('realtimeSyncDot');
    if (!dot) {
      dot = document.createElement('div');
      dot.id = 'realtimeSyncDot';
      dot.style.cssText = 'position:fixed;bottom:8px;right:8px;width:8px;height:8px;border-radius:50%;z-index:9999;transition:background 0.5s;opacity:0.7';
      document.body.appendChild(dot);
    }
    dot.style.background = { connected:'#22c55e', polling:'#f59e0b', disconnected:'#ef4444' }[status] || '#ef4444';
    dot.title = {
      connected:    '✅ Realtime actiu (WebSocket + Polling 3s)',
      polling:      '🟡 Sincronitzant per Polling (3s)',
      disconnected: '🔴 Sense connexió'
    }[status] || '';
  } catch(e) {}
}

window.initRealtimeSync = initRealtimeSync;
window.stopRealtimeSync = stopRealtimeSync;

console.log('✅ supabase-realtime.js (doble capa) carregat');

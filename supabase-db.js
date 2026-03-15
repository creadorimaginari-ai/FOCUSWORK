/*************************************************
 * FOCUSWORK - SUPABASE DATABASE (VERSIÓ DEFINITIVA v2)
 * 
 * ✅ user_id per les polítiques RLS
 * ✅ billableTime (JS) ↔ billable_time (Supabase) correctament mapejat
 * ✅ Guarda files[] amb URLs de Storage (sincronitzable)
 * ✅ No guarda base64 si hi ha URL
 *************************************************/

console.log('🚀 Supabase DB v2 carregat');

function getCurrentUserId() {
  if (typeof window.getCurrentUser === 'function') {
    const u = window.getCurrentUser();
    return u ? u.id : null;
  }
  return null;
}

/* ── CACHE EN MEMÒRIA (redueix crides a Supabase) ── */
let _clientsCache = null;
let _clientsCacheTime = 0;
const CACHE_TTL = 8000; // 8 segons — evita crides duplicades en ràfegues

function _mapClient(client) {
  client.active         = (client.status === 'active' || !client.status);
  client.total          = client.total           || 0;
  client.billableTime   = client.billable_time   || client.billableTime || 0;
  client.activities     = client.activities      || {};
  client.tasks          = client.tasks           || { urgent: '', important: '', later: '' };
  client.photos         = client.photos          || [];
  client.files          = client.files           || [];
  client.state          = client.state           || 'in_progress';
  client.stateLabel     = client.state_label     || null;
  client.stateIcon      = client.state_icon      || null;
  client.stateColor     = client.state_color     || null;
  client.stateUpdatedAt = client.state_updated_at ? new Date(client.state_updated_at).getTime() : null;
  client.stateHistory   = client.state_history   || [];
  client.progress       = client.progress        || 1;
  client.progressLabel  = client.progress_label  || null;
  client.progressPercent= client.progress_percent|| null;
  client.progressColor  = client.progress_color  || null;
  // ✅ FIX URGENTS: recuperar deliveryDate de Supabase
  client.deliveryDate   = client.delivery_date   ? new Date(client.delivery_date).toISOString().split('T')[0] : (client.deliveryDate || null);
  return client;
}

function invalidateClientsCache() {
  _clientsCache = null;
  _clientsCacheTime = 0;
}
window.invalidateClientsCache = invalidateClientsCache;

/* ── CARREGAR TOTS ELS CLIENTS ── */
async function loadAllClientsSupabase() {
  // Retornar cache si és fresca
  if (_clientsCache && (Date.now() - _clientsCacheTime) < CACHE_TTL) {
    return _clientsCache;
  }

  const userId = getCurrentUserId();
  if (!userId) return {};

  try {
    const { data, error } = await window.supabase
      .from('clients')
      .select('*')
      .eq('user_id', userId)           // ✅ filtre per usuari — evita llegir tota la taula
      .order('created_at', { ascending: false });

    if (error) throw error;

    const clients = {};
    (data || []).forEach(client => {
      clients[client.id] = _mapClient(client);
    });

    // Guardar a cache
    _clientsCache = clients;
    _clientsCacheTime = Date.now();

    console.log('✅ ' + Object.keys(clients).length + ' clients carregats');
    return clients;
  } catch (error) {
    console.error('❌ Error carregant clients:', error.message);
    return _clientsCache || {};
  }
}

/* ── CARREGAR UN CLIENT ── */
async function loadClientSupabase(clientId) {
  try {
    const { data, error } = await window.supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single();

    if (error || !data) return null;
    return _mapClient(data);
  } catch (error) {
    console.error('❌ Error carregant client:', error.message);
    return null;
  }
}

/* ── GUARDAR CLIENT ── */
async function saveClientSupabase(client) {
  const userId = getCurrentUserId();
  if (!userId) {
    console.warn('⚠️ No hi ha usuari autenticat, no es pot guardar');
    return false;
  }

  // Guardar metadades dels arxius però NO el base64 (massa gran)
  // Les URLs de Supabase Storage sí es guarden (permeten sincronització)
  const files = (client.files || []).map(function(f) {
    return {
      id:       f.id,
      date:     f.date,
      type:     f.type,
      name:     f.name,
      mimeType: f.mimeType || '',
      comment:  f.comment  || '',
      url:      f.url      || null,
      data:     f.url      ? null : (f.data || null)
    };
  });

  const clientData = {
    id:            client.id,
    user_id:       userId,
    name:          client.name        || '',
    email:         client.email       || null,
    phone:         client.phone       || null,
    company:       client.company     || null,
    notes:         client.notes       || null,
    // ✅ BUGFIX: mapejar active (JS) → status (Supabase) correctament
    // Si active=false → 'closed'; si active=true o no definit → 'active'
    status:        client.active === false ? 'closed' : (client.status || 'active'),
    closed_at:     client.closedAt ? new Date(client.closedAt).toISOString() : null,
    total:         client.total       || 0,
    billable_time: client.billableTime || client.billable_time || 0,  // ← snake_case per Supabase
    activities:    client.activities  || {},
    tasks:         client.tasks       || {},
    tags:          client.tags        || [],
    files:         files,
    // ✅ FIX: Camps d'estat i progrés (abans no es guardaven!)
    state:              client.state              || 'in_progress',
    state_label:        client.stateLabel         || null,
    state_icon:         client.stateIcon          || null,
    state_color:        client.stateColor         || null,
    state_updated_at:   client.stateUpdatedAt     ? new Date(client.stateUpdatedAt).toISOString() : null,
    state_history:      client.stateHistory       || [],
    progress:           client.progress           || 1,
    progress_label:     client.progressLabel      || null,
    progress_percent:   client.progressPercent    || null,
    progress_color:     client.progressColor      || null,
    // ✅ FIX URGENTS: deliveryDate ha d'estar a Supabase per sincronitzar entre dispositius
    delivery_date:      client.deliveryDate       ? new Date(client.deliveryDate).toISOString() : null,
    created_at:         client.created_at         || new Date().toISOString(),
    updated_at:         new Date().toISOString()
  };

  try {
    // ✅ REALTIME: marcar que som nosaltres qui guardem (evita processar el nostre propi canvi)
    if (typeof window.markRealtimeSelfSave === 'function') {
      window.markRealtimeSelfSave();
    }

    const { error } = await window.supabase
      .from('clients')
      .upsert(clientData, { onConflict: 'id' });

    if (error) throw error;

    console.log('✅ Client guardat a Supabase:', client.name);
    invalidateClientsCache(); // ✅ Invalidar cache per forçar recàrrega fresca
    return true;
  } catch (error) {
    console.error('❌ Error guardant client:', error.message);
    return false;
  }
}

/* ── ELIMINAR CLIENT ── */
async function deleteClientSupabase(clientId) {
  try {
    const { error } = await window.supabase
      .from('clients')
      .delete()
      .eq('id', clientId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('❌ Error eliminant client:', error.message);
    return false;
  }
}

/* ── EXPORTAR ── */
window.loadAllClientsSupabase = loadAllClientsSupabase;
window.loadClientSupabase     = loadClientSupabase;
window.saveClientSupabase     = saveClientSupabase;
window.deleteClientSupabase   = deleteClientSupabase;

console.log('✅ Supabase DB v2 carregat correctament');

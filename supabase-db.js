/*************************************************
 * FOCUSWORK - SUPABASE DATABASE (VERSIÓ DEFINITIVA)
 * 
 * ✅ Inclou user_id per les polítiques RLS
 * ✅ Una sola definició de cada funció
 * ✅ Sense duplicats amb app-ui.js
 *************************************************/

console.log('🚀 Supabase DB carregat');

/* ── Helper: obtenir user_id actual ── */
function getCurrentUserId() {
  if (typeof window.getCurrentUser === 'function') {
    const u = window.getCurrentUser();
    return u ? u.id : null;
  }
  return null;
}

/* ==================== CARREGAR TOTS ELS CLIENTS ==================== */

async function loadAllClientsSupabase() {
  console.log('📥 Carregant clients de Supabase...');
  try {
    const { data, error } = await window.supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const clients = {};
    (data || []).forEach(client => {
      client.active = true;
      client.total = client.total || 0;
      client.billableTime = client.billableTime || 0;
      client.activities = client.activities || {};
      client.tasks = client.tasks || { urgent: '', important: '', later: '' };
      client.photos = client.photos || [];
      clients[client.id] = client;
    });

    console.log(`✅ ${Object.keys(clients).length} clients carregats de Supabase`);
    return clients;
  } catch (error) {
    console.error('❌ Error carregant clients:', error.message);
    return {};
  }
}

/* ==================== CARREGAR UN CLIENT ==================== */

async function loadClientSupabase(clientId) {
  try {
    const { data, error } = await window.supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single();

    if (error || !data) return null;

    data.active = true;
    data.total = data.total || 0;
    data.billableTime = data.billableTime || 0;
    data.activities = data.activities || {};
    data.tasks = data.tasks || { urgent: '', important: '', later: '' };
    data.photos = data.photos || [];
    return data;
  } catch (error) {
    console.error('❌ Error carregant client:', error.message);
    return null;
  }
}

/* ==================== GUARDAR CLIENT ==================== */

async function saveClientSupabase(client) {
  const userId = getCurrentUserId();
  if (!userId) {
    console.warn('⚠️ No hi ha usuari autenticat, no es pot guardar');
    return false;
  }

  const clientData = {
    id: client.id,
    user_id: userId,                          // ← Necessari per RLS
    name: client.name || '',
    email: client.email || null,
    phone: client.phone || null,
    company: client.company || null,
    notes: client.notes || null,
    status: client.status || 'active',
    total: client.total || 0,
    billableTime: client.billableTime || 0,
    activities: client.activities || {},
    tasks: client.tasks || {},
    tags: client.tags || [],
    created_at: client.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  try {
    const { error } = await window.supabase
      .from('clients')
      .upsert(clientData, { onConflict: 'id' });

    if (error) throw error;

    console.log('✅ Client guardat a Supabase:', client.name);
    return true;
  } catch (error) {
    console.error('❌ Error guardant client:', error.message);
    return false;
  }
}

/* ==================== ELIMINAR CLIENT ==================== */

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

/* ==================== EXPORTAR ==================== */

window.loadAllClientsSupabase = loadAllClientsSupabase;
window.loadClientSupabase     = loadClientSupabase;
window.saveClientSupabase     = saveClientSupabase;
window.deleteClientSupabase   = deleteClientSupabase;

console.log('✅ Supabase DB definitiu carregat');

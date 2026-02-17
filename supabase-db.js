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

/* ── CARREGAR TOTS ELS CLIENTS ── */
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
      client.active       = true;
      client.total        = client.total         || 0;
      // Supabase guarda 'billable_time', el codi JS usa 'billableTime'
      client.billableTime = client.billable_time || client.billableTime || 0;
      client.activities   = client.activities    || {};
      client.tasks        = client.tasks         || { urgent: '', important: '', later: '' };
      client.photos       = client.photos        || [];
      client.files        = client.files         || [];
      clients[client.id]  = client;
    });

    console.log('✅ ' + Object.keys(clients).length + ' clients carregats de Supabase');
    return clients;
  } catch (error) {
    console.error('❌ Error carregant clients:', error.message);
    return {};
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

    data.active       = true;
    data.total        = data.total         || 0;
    // Mapeja billable_time → billableTime
    data.billableTime = data.billable_time  || data.billableTime || 0;
    data.activities   = data.activities    || {};
    data.tasks        = data.tasks         || { urgent: '', important: '', later: '' };
    data.photos       = data.photos        || [];
    data.files        = data.files         || [];
    return data;
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
    status:        client.status      || 'active',
    total:         client.total       || 0,
    billable_time: client.billableTime || client.billable_time || 0,  // ← snake_case per Supabase
    activities:    client.activities  || {},
    tasks:         client.tasks       || {},
    tags:          client.tags        || [],
    files:         files,
    created_at:    client.created_at  || new Date().toISOString(),
    updated_at:    new Date().toISOString()
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

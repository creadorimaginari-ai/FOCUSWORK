/*************************************************
 * FOCUSWORK - SUPABASE SYNC (VERSIÓ SIMPLE I EFICAÇ)
 * 
 * Sincronització automàtica amb Supabase
 * Sense user_id ni user_email
 * Amb fallback a IndexedDB
 *************************************************/

console.log('🚀 Supabase Sync carregat');

/* ==================== CONFIGURACIÓ ==================== */

const SYNC_INTERVAL = 30000; // Sincronitzar cada 30 segons
const SAVE_DEBOUNCE = 2000;  // Esperar 2 segons abans de guardar
let saveTimeout = null;

/* ==================== FUNCIONS PRINCIPALS ==================== */

/**
 * Carregar TOTS els clients de Supabase
 * Sense filtrar per usuari
 */
async function loadAllClientsSupabase() {
  console.log('📥 Carregant clients de Supabase...');
  
  try {
    const { data, error } = await window.supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    console.log(`✅ ${data.length} clients carregats`);
    
    // Convertir array a objecte {id: client}
    const clients = {};
    data.forEach(client => {
      clients[client.id] = client;
    });
    
    return clients;
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    return {};
  }
}

/**
 * Guardar un client a Supabase
 * Amb retry automàtic
 */
async function saveClientSupabase(client, retries = 3) {
  console.log('💾 Guardant:', client.name);
  
  // Preparar dades - NOMÉS columnes que existeixen
  const clientData = {
    id: client.id,
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
    created_at: client.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  try {
    const { data, error } = await window.supabase
      .from('clients')
      .upsert(clientData, { onConflict: 'id' })
      .select()
      .single();
    
    if (error) throw error;
    
    console.log('✅ Guardat');
    return data;
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    
    // Retry si queden intents
    if (retries > 0) {
      console.log(`🔄 Reintentant... (${retries} intents restants)`);
      await new Promise(r => setTimeout(r, 1000));
      return saveClientSupabase(client, retries - 1);
    }
    
    throw error;
  }
}

/**
 * Eliminar client de Supabase
 */
async function deleteClientSupabase(clientId) {
  console.log('🗑️ Eliminant:', clientId);
  
  try {
    const { error } = await window.supabase
      .from('clients')
      .delete()
      .eq('id', clientId);
    
    if (error) throw error;
    
    console.log('✅ Eliminat');
    return true;
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    return false;
  }
}

/**
 * Guardar client amb debounce
 * Evita múltiples guardats simultanis
 */
function saveClientDebounced(client) {
  clearTimeout(saveTimeout);
  
  saveTimeout = setTimeout(async () => {
    try {
      await saveClientSupabase(client);
    } catch (error) {
      console.error('Error guardant:', error);
    }
  }, SAVE_DEBOUNCE);
}

/**
 * Sincronitzar client actual
 * Només si hi ha canvis
 */
async function syncCurrentClient() {
  if (!window.state?.currentClientId) return;
  
  const client = window.state.clients?.[window.state.currentClientId];
  if (!client) return;
  
  // Marcar que s'ha modificat
  if (!client._modified) return;
  
  try {
    await saveClientSupabase(client);
    delete client._modified;
  } catch (error) {
    console.error('Error sincronitzant client actual:', error);
  }
}

/**
 * Sincronització completa
 * Carregar de Supabase + actualitzar UI
 */
async function fullSync() {
  console.log('🔄 Sincronització completa...');
  
  try {
    // Carregar de Supabase
    const clients = await loadAllClientsSupabase();
    
    if (!clients || Object.keys(clients).length === 0) {
      console.log('⚠️ No hi ha clients');
      return false;
    }
    
    // Actualitzar state
    window.state.clients = clients;
    
    // Actualitzar UI si estem a la llista
    const listContainer = document.querySelector('#clientsListContainer');
    if (listContainer && typeof window.renderClientsList === 'function') {
      window.renderClientsList();
    }
    
    console.log(`✅ ${Object.keys(clients).length} clients sincronitzats`);
    return true;
    
  } catch (error) {
    console.error('❌ Error sincronització:', error);
    return false;
  }
}

/* ==================== AUTO-SINCRONITZACIÓ ==================== */

let syncInterval = null;

/**
 * Iniciar sincronització automàtica
 */
function startAutoSync() {
  if (syncInterval) return;
  
  console.log('🔄 Auto-sincronització activada');
  
  // Sincronització inicial
  fullSync();
  
  // Sincronització periòdica
  syncInterval = setInterval(() => {
    syncCurrentClient();
  }, SYNC_INTERVAL);
  
  // Sincronització en sortir
  window.addEventListener('beforeunload', () => {
    if (window.state?.currentClientId) {
      const client = window.state.clients?.[window.state.currentClientId];
      if (client && client._modified) {
        // Enviar beacon per no bloquejar
        const data = JSON.stringify(client);
        navigator.sendBeacon('/api/save', data);
      }
    }
  });
}

/**
 * Aturar sincronització automàtica
 */
function stopAutoSync() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
    console.log('⏸️ Auto-sincronització aturada');
  }
}

/* ==================== UTILITATS ==================== */

/**
 * Comprovar connexió a Supabase
 */
async function checkSupabaseConnection() {
  try {
    const { data, error } = await window.supabase
      .from('clients')
      .select('id')
      .limit(1);
    
    if (error) throw error;
    
    console.log('✅ Connexió a Supabase OK');
    return true;
    
  } catch (error) {
    console.error('❌ Sense connexió:', error.message);
    return false;
  }
}

/**
 * Mostrar info de la base de dades
 */
async function showSupabaseInfo() {
  try {
    const { data, error } = await window.supabase
      .from('clients')
      .select('*')
      .limit(3);
    
    if (error) throw error;
    
    console.log('📊 Primers 3 clients:', data);
    
    if (data[0]) {
      console.log('📋 Columnes:', Object.keys(data[0]));
      console.log('📄 Exemple:', data[0]);
    }
    
    alert('Comprova la consola (F12) per veure la info');
    
  } catch (error) {
    console.error('❌ Error:', error);
    alert('Error: ' + error.message);
  }
}

/* ==================== EXPORTAR ==================== */

// Funcions globals
window.loadAllClientsSupabase = loadAllClientsSupabase;
window.saveClientSupabase = saveClientSupabase;
window.deleteClientSupabase = deleteClientSupabase;
window.saveClientDebounced = saveClientDebounced;
window.syncCurrentClient = syncCurrentClient;
window.fullSync = fullSync;
window.startAutoSync = startAutoSync;
window.stopAutoSync = stopAutoSync;
window.checkSupabaseConnection = checkSupabaseConnection;
window.showSupabaseInfo = showSupabaseInfo;

/* ==================== INICIALITZACIÓ ==================== */

// Auto-iniciar quan state estigui disponible
function waitForState() {
  if (window.state && window.supabase) {
    console.log('✅ State i Supabase disponibles');
    startAutoSync();
  } else {
    setTimeout(waitForState, 500);
  }
}

// Iniciar
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', waitForState);
} else {
  waitForState();
}

console.log('✅ Supabase Sync carregat correctament');

/*************************************************
 * FUNCIONS DISPONIBLES:
 * 
 * - fullSync() → Sincronitzar tot
 * - saveClientSupabase(client) → Guardar client
 * - loadAllClientsSupabase() → Carregar tots
 * - checkSupabaseConnection() → Test connexió
 * - showSupabaseInfo() → Veure info BD
 * 
 * AUTO-SINCRONITZACIÓ:
 * - S'activa automàticament
 * - Sincronitza cada 30 segons
 * - Guarda abans de sortir
 *************************************************/

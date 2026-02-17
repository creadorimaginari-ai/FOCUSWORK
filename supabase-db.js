// ============================================
// SUPABASE DATABASE - FIXED
// Versió corregida sense user_email
// ============================================

console.log('✅ supabase-db.js FIXED carregat');

// Carregar TOTS els clients de Supabase
async function loadAllClientsSupabase() {
  console.log('📥 Carregant TOTS els clients de Supabase...');
  
  try {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('❌ Error carregant clients:', error);
      return {};
    }
    
    console.log(`✅ ${data.length} clients carregats de Supabase`);
    
    const clients = {};
    data.forEach(client => {
      clients[client.id] = client;
    });
    
    return clients;
  } catch (error) {
    console.error('❌ Error inesperat:', error);
    return {};
  }
}

// Guardar client a Supabase
async function saveClientSupabase(client) {
  try {
    const { data, error } = await supabase
      .from('clients')
      .upsert({
        id: client.id,
        name: client.name || '',
        email: client.email || null,
        phone: client.phone || null,
        company: client.company || null,
        notes: client.notes || null,
        status: client.status || 'active',
        activities: client.activities || {},
        tags: client.tags || [],
        created_at: client.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select();
    
    if (error) {
      console.error('❌ Error guardant client:', error);
      return false;
    }
    
    console.log('✅ Client guardat a Supabase:', client.name);
    return true;
  } catch (error) {
    console.error('❌ Error inesperat guardant:', error);
    return false;
  }
}

// Eliminar client de Supabase
async function deleteClientSupabase(clientId) {
  try {
    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', clientId);
    
    if (error) {
      console.error('❌ Error eliminant client:', error);
      return false;
    }
    
    console.log('✅ Client eliminat de Supabase');
    return true;
  } catch (error) {
    console.error('❌ Error inesperat eliminant:', error);
    return false;
  }
}

// Sincronitzar clients de Supabase
async function syncClientsFromSupabase() {
  console.log('🔄 Sincronitzant clients de Supabase...');
  
  const clients = await loadAllClientsSupabase();
  state.clients = clients;
  
  console.log(`✅ ${Object.keys(clients).length} clients sincronitzats`);
  
  // Renderitzar si estem a la vista de llista
  if (document.querySelector('#clientsListContainer')) {
    renderClientsList();
  }
  
  return clients;
}

// Exposar funcions globalment
window.loadAllClientsSupabase = loadAllClientsSupabase;
window.saveClientSupabase = saveClientSupabase;
window.deleteClientSupabase = deleteClientSupabase;
window.syncClientsFromSupabase = syncClientsFromSupabase;

console.log('🚀 Funcions Supabase disponibles globalment');

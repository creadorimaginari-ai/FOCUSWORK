/*************************************************
 * FOCUSWORK - supabase-db.js CORREGIT
 * 
 * FUNCIONA SENSE user_id i user_email
 * Carrega TOTS els clients sense filtrar per usuari
 *************************************************/

/* ================= CLIENTS ================= */

/**
 * Guardar o actualitzar client
 * SIN user_id (que no existeix a la taula)
 */
async function saveClientSupabase(client) {
  console.log('💾 Guardant client a Supabase:', client.name);
  
  // Preparar dades (NOMÉS columnes que existeixen a Supabase)
  const clientData = {
    id: client.id || crypto.randomUUID(),
    name: client.name || '',
    email: client.email || null,
    phone: client.phone || null,
    company: client.company || null,
    notes: client.notes || null,
    status: client.status || 'active',
    // Si la taula té aquestes columnes:
    total: client.total || 0,
    billableTime: client.billableTime || 0,
    activities: client.activities || {},
    tasks: client.tasks || { urgent: "", important: "", later: "" }
  };
  
  try {
    const { data, error } = await window.supabase
      .from('clients')
      .upsert(clientData, { onConflict: 'id' })
      .select()
      .single();
    
    if (error) {
      console.error('❌ Error guardant client:', error);
      throw error;
    }
    
    console.log('✅ Client guardat:', data.name);
    return data;
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

/**
 * Carregar un client per ID
 */
async function loadClientSupabase(clientId) {
  console.log('📥 Carregant client:', clientId);
  
  try {
    const { data, error } = await window.supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single();
    
    if (error) {
      console.error('❌ Error carregant client:', error);
      return null;
    }
    
    console.log('✅ Client carregat:', data.name);
    return data;
    
  } catch (error) {
    console.error('❌ Error:', error);
    return null;
  }
}

/**
 * Carregar TOTS els clients (sense filtrar per user_id)
 */
async function loadAllClientsSupabase() {
  console.log('📥 Carregant TOTS els clients de Supabase...');
  
  try {
    const { data, error } = await window.supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('❌ Error carregant clients:', error);
      return {};
    }
    
    if (!data || data.length === 0) {
      console.log('⚠️ No hi ha clients a Supabase');
      return {};
    }
    
    console.log(`✅ ${data.length} clients carregats de Supabase`);
    
    // Convertir array a objecte amb id com a clau
    const clientsObj = {};
    data.forEach(client => {
      clientsObj[client.id] = client;
    });
    
    return clientsObj;
    
  } catch (error) {
    console.error('❌ Error:', error);
    return {};
  }
}

/**
 * Esborrar client
 */
async function deleteClientSupabase(clientId) {
  console.log('🗑️ Esborrant client:', clientId);
  
  try {
    const { error } = await window.supabase
      .from('clients')
      .delete()
      .eq('id', clientId);
    
    if (error) {
      console.error('❌ Error esborrant client:', error);
      throw error;
    }
    
    console.log('✅ Client esborrat');
    return true;
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

/* ================= SINCRONITZACIÓ ================= */

/**
 * Sincronitzar clients de Supabase a state
 */
async function syncClientsFromSupabase() {
  console.log('🔄 Sincronitzant clients amb Supabase...');
  
  try {
    // Carregar clients de Supabase
    const clients = await loadAllClientsSupabase();
    
    if (!clients || Object.keys(clients).length === 0) {
      console.log('⚠️ No hi ha clients a Supabase');
      
      // Intentar carregar de localStorage com a fallback
      const saved = localStorage.getItem('focuswork_clients');
      if (saved) {
        const localClients = JSON.parse(saved);
        window.state.clients = localClients;
        console.log(`📦 ${Object.keys(localClients).length} clients carregats de localStorage`);
        return localClients;
      }
      
      window.state.clients = {};
      return {};
    }
    
    // Guardar a state
    window.state.clients = clients;
    
    // Guardar també a localStorage com a cache
    try {
      localStorage.setItem('focuswork_clients', JSON.stringify(clients));
    } catch (e) {
      console.warn('⚠️ No s\'ha pogut guardar a localStorage');
    }
    
    console.log(`✅ ${Object.keys(clients).length} clients sincronitzats`);
    return clients;
    
  } catch (error) {
    console.error('❌ Error sincronitzant:', error);
    
    // Fallback a localStorage
    try {
      const saved = localStorage.getItem('focuswork_clients');
      if (saved) {
        const localClients = JSON.parse(saved);
        window.state.clients = localClients;
        console.log(`📦 ${Object.keys(localClients).length} clients de localStorage (Supabase no disponible)`);
        return localClients;
      }
    } catch (e) {
      console.error('❌ Error amb localStorage');
    }
    
    return {};
  }
}

/**
 * Guardar client actual a Supabase
 */
async function saveCurrentClientToSupabase() {
  if (!window.state.currentClientId) {
    console.log('⚠️ No hi ha client actual');
    return;
  }
  
  try {
    const client = window.state.clients[window.state.currentClientId];
    if (!client) {
      console.log('⚠️ Client no trobat a state');
      return;
    }
    
    await saveClientSupabase(client);
    console.log('✅ Client actual guardat a Supabase');
    
  } catch (error) {
    console.error('❌ Error guardant client actual:', error);
  }
}

/* ================= RENDERITZAR LLISTA ================= */

/**
 * Renderitzar llista de clients
 */
function renderClientList() {
  console.log('🎨 Renderitzant llista de clients...');
  
  const container = document.querySelector('#projectList');
  
  if (!container) {
    console.warn('⚠️ No s\'ha trobat #projectList');
    return;
  }
  
  container.innerHTML = '';
  
  // Obtenir clients de state
  const clientsObj = window.state.clients || {};
  const clients = Object.values(clientsObj);
  
  // Filtrar clients actius
  const activeClients = clients.filter(c => {
    // Si NO té la columna 'status', mostrar tots
    if (!c.hasOwnProperty('status')) return true;
    // Si té 'status', només mostrar actius
    return c.status !== 'archived' && c.status !== 'deleted';
  });
  
  if (activeClients.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px; color: #888;">
        <div style="font-size: 48px; margin-bottom: 20px;">📋</div>
        <div style="font-size: 16px; font-weight: bold; margin-bottom: 10px;">
          No hi ha clients
        </div>
        <button onclick="window.syncClientsFromSupabase().then(() => window.renderClientList())" style="
          padding: 10px 20px;
          background: #2196F3;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          margin-top: 10px;
        ">
          🔄 Recarregar de Supabase
        </button>
        <button onclick="window.showSupabaseInfo()" style="
          padding: 10px 20px;
          background: #666;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          margin-top: 10px;
          margin-left: 10px;
        ">
          ℹ️ Info Supabase
        </button>
      </div>
    `;
    return;
  }
  
  // Ordenar per data de creació
  activeClients.sort((a, b) => {
    const dateA = new Date(a.created_at || 0);
    const dateB = new Date(b.created_at || 0);
    return dateB - dateA;
  });
  
  console.log(`📋 Renderitzant ${activeClients.length} clients`);
  
  // Renderitzar cada client
  activeClients.forEach(client => {
    const card = document.createElement('div');
    card.className = 'project-card';
    card.style.cssText = `
      padding: 15px;
      margin-bottom: 10px;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
      border-left: 3px solid #4CAF50;
    `;
    
    card.onmouseover = () => {
      card.style.background = 'rgba(255, 255, 255, 0.1)';
      card.style.transform = 'translateX(5px)';
    };
    
    card.onmouseout = () => {
      card.style.background = 'rgba(255, 255, 255, 0.05)';
      card.style.transform = 'translateX(0)';
    };
    
    const totalTime = window.formatTime ? window.formatTime(client.total || 0) : '0h';
    
    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: start;">
        <div style="flex: 1;">
          <div style="font-size: 16px; font-weight: bold; color: white; margin-bottom: 5px;">
            ${client.name || 'Sense nom'}
          </div>
          <div style="font-size: 12px; color: #888;">
            ${client.email || ''} ${client.phone ? '• ' + client.phone : ''}
          </div>
          ${client.company ? `<div style="font-size: 12px; color: #666; margin-top: 3px;">${client.company}</div>` : ''}
          ${client.total > 0 ? `<div style="font-size: 11px; color: #4CAF50; margin-top: 5px;">⏱️ ${totalTime}</div>` : ''}
        </div>
        <div style="font-size: 20px; opacity: 0.5;">✓</div>
      </div>
    `;
    
    card.onclick = () => {
      console.log('📌 Seleccionant client:', client.id);
      window.state.currentClientId = client.id;
      if (window.save) window.save();
      setTimeout(() => location.reload(), 300);
    };
    
    container.appendChild(card);
  });
  
  console.log(`✅ ${activeClients.length} clients renderitzats`);
}

/**
 * Mostrar informació de Supabase
 */
async function showSupabaseInfo() {
  console.log('ℹ️ Informació de Supabase');
  
  try {
    const { data, error } = await window.supabase
      .from('clients')
      .select('*')
      .limit(3);
    
    console.log('📊 Primers 3 clients:', data);
    
    if (data && data[0]) {
      console.log('📋 Columnes disponibles:', Object.keys(data[0]));
      console.log('📄 Exemple client:', data[0]);
    }
    
    console.log('❌ Error (si n\'hi ha):', error);
    
    alert('Comprova la consola (F12) per veure la informació de Supabase');
    
  } catch (error) {
    console.error('❌ Error:', error);
    alert('Error consultant Supabase. Comprova la consola.');
  }
}

/* ================= INICIALITZACIÓ ================= */

/**
 * Inicialitzar sistema de sincronització
 */
async function initSupabaseSync() {
  console.log('🚀 Inicialitzant sincronització amb Supabase...');
  
  // Esperar que state existeixi
  let attempts = 0;
  while (!window.state && attempts < 50) {
    await new Promise(r => setTimeout(r, 100));
    attempts++;
  }
  
  if (!window.state) {
    console.error('❌ state no disponible');
    return;
  }
  
  // Sincronitzar clients
  await syncClientsFromSupabase();
  
  // Renderitzar llista
  renderClientList();
  
  // Sincronització periòdica cada 30 segons
  setInterval(async () => {
    console.log('🔄 Sincronització automàtica...');
    await syncClientsFromSupabase();
  }, 30000);
  
  // Guardar client actual cada 10 segons
  setInterval(async () => {
    await saveCurrentClientToSupabase();
  }, 10000);
  
  console.log('✅ Sincronització inicialitzada');
}

/* ================= EXPORTAR FUNCIONS ================= */

window.saveClientSupabase = saveClientSupabase;
window.loadClientSupabase = loadClientSupabase;
window.loadAllClientsSupabase = loadAllClientsSupabase;
window.deleteClientSupabase = deleteClientSupabase;
window.syncClientsFromSupabase = syncClientsFromSupabase;
window.saveCurrentClientToSupabase = saveCurrentClientToSupabase;
window.renderClientList = renderClientList;
window.showSupabaseInfo = showSupabaseInfo;
window.initSupabaseSync = initSupabaseSync;

// Auto-inicialització
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initSupabaseSync, 1000);
  });
} else {
  setTimeout(initSupabaseSync, 1000);
}

console.log('✅ supabase-db.js CORREGIT carregat (sense user_id)');

/*************************************************
 * INSTRUCCIONS:
 * 
 * 1. REEMPLAÇA supabase-db.js a GitHub amb aquest fitxer
 * 2. Commit changes
 * 3. Neteja cache: Ctrl + Shift + Delete
 * 4. Recarrega: Ctrl + Shift + R
 * 5. Comprova consola: hauria de dir "✅ X clients carregats"
 * 
 * FUNCIONS DISPONIBLES:
 * - syncClientsFromSupabase() - Sincronitzar clients
 * - renderClientList() - Re-renderitzar llista
 * - showSupabaseInfo() - Veure info de la BD
 * - saveCurrentClientToSupabase() - Guardar client actual
 *************************************************/

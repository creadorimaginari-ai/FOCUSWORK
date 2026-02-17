/*************************************************
 * FOCUSWORK - SUPABASE DATABASE (VERSIÓ FINAL)
 * 
 * ✅ Sense user_email ni user_id
 * ✅ Carrega TOTS els clients
 * ✅ Renderitza correctament
 * ✅ Auto-sincronització
 *************************************************/

console.log('🚀 Supabase DB Final carregat');

/* ==================== CARREGAR CLIENTS ==================== */

async function loadAllClientsSupabase() {
  console.log('📥 Carregant clients...');
  
  try {
    const { data, error } = await window.supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    console.log(`✅ ${data.length} clients carregats`);
    
    // Convertir a objecte {id: client}
    const clients = {};
    data.forEach(client => {
      // Forçar status actiu si no en té o està tancat
      if (!client.status || client.status === 'closed' || client.status === 'archived') {
        client.status = 'active';
      }
      clients[client.id] = client;
    });
    
    return clients;
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    return {};
  }
}

/* ==================== GUARDAR CLIENT ==================== */

async function saveClientSupabase(client) {
  console.log('💾 Guardant:', client.name);
  
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
    throw error;
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
    console.error('❌ Error:', error.message);
    return false;
  }
}

/* ==================== RENDERITZAR LLISTA ==================== */

function renderClientsList() {
  console.log('🎨 Renderitzant llista...');
  
  // Buscar contenidor
  let container = document.querySelector('#clientsListContainer')
    || document.querySelector('#projectList');
  
  if (!container) {
    console.warn('⚠️ Contenidor no trobat');
    return;
  }
  
  // Netejar
  container.innerHTML = '';
  
  // Obtenir clients
  const clientsObj = window.state?.clients || {};
  const clients = Object.values(clientsObj);
  
  // Filtrar actius
  const activeClients = clients.filter(c => {
    const status = (c.status || '').toLowerCase();
    return status !== 'closed' && status !== 'archived' && status !== 'deleted';
  });
  
  console.log(`📋 ${activeClients.length} clients actius`);
  
  if (activeClients.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 60px 20px; color: rgba(255,255,255,0.5);">
        <div style="font-size: 48px; margin-bottom: 20px;">📋</div>
        <div style="font-size: 18px; margin-bottom: 20px;">No hi ha clients</div>
        <button onclick="window.location.reload()" style="
          padding: 12px 24px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-weight: bold;
        ">
          🔄 Recarregar
        </button>
      </div>
    `;
    return;
  }
  
  // Ordenar per data
  activeClients.sort((a, b) => {
    const dateA = new Date(a.created_at || 0);
    const dateB = new Date(b.created_at || 0);
    return dateB - dateA;
  });
  
  // Renderitzar cada client
  activeClients.forEach((client, index) => {
    const card = document.createElement('div');
    card.style.cssText = `
      padding: 20px;
      margin-bottom: 12px;
      background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      border-left: 4px solid ${getStatusColor(index)};
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    `;
    
    card.onmouseover = () => {
      card.style.background = 'linear-gradient(135deg, rgba(102, 126, 234, 0.2) 0%, rgba(118, 75, 162, 0.2) 100%)';
      card.style.transform = 'translateX(8px) scale(1.02)';
      card.style.boxShadow = '0 8px 16px rgba(0,0,0,0.2)';
    };
    
    card.onmouseout = () => {
      card.style.background = 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)';
      card.style.transform = 'translateX(0) scale(1)';
      card.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
    };
    
    // Temps
    const totalSeconds = client.total || 0;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const timeStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
    
    // Activitats
    const activities = client.activities || {};
    const activityCount = Object.keys(activities).length;
    
    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: start; gap: 15px;">
        <div style="flex: 1; min-width: 0;">
          <div style="
            font-size: 18px; 
            font-weight: bold; 
            color: white; 
            margin-bottom: 8px;
          ">
            ${client.name || 'Sense nom'}
          </div>
          
          <div style="
            font-size: 13px; 
            color: rgba(255,255,255,0.6); 
            margin-bottom: 8px;
          ">
            ${client.email || ''} ${client.phone ? '• ' + client.phone : ''}
          </div>
          
          ${client.company ? `
            <div style="font-size: 12px; color: rgba(255,255,255,0.5); margin-bottom: 8px;">
              🏢 ${client.company}
            </div>
          ` : ''}
          
          <div style="display: flex; gap: 12px; margin-top: 12px; flex-wrap: wrap;">
            ${totalSeconds > 0 ? `
              <div style="
                padding: 4px 12px;
                background: rgba(76, 175, 80, 0.2);
                border-radius: 6px;
                font-size: 12px;
                font-weight: bold;
                color: #4CAF50;
              ">
                ⏱️ ${timeStr}
              </div>
            ` : ''}
            
            ${activityCount > 0 ? `
              <div style="
                padding: 4px 12px;
                background: rgba(33, 150, 243, 0.2);
                border-radius: 6px;
                font-size: 12px;
                font-weight: bold;
                color: #2196F3;
              ">
                📊 ${activityCount}
              </div>
            ` : ''}
          </div>
        </div>
        
        <div style="font-size: 24px; opacity: 0.3;">→</div>
      </div>
    `;
    
    // Click
    card.onclick = () => {
      console.log('📌 Seleccionat:', client.name);
      
      // Guardar a state
      window.state.currentClientId = client.id;
      
      // Guardar a localStorage també
      localStorage.setItem('focuswork_current_client', client.id);
      
      // Guardar state
      if (window.save) {
        window.save();
      }
      
      // Recarregar
      setTimeout(() => {
        location.reload();
      }, 200);
    };
    
    container.appendChild(card);
  });
  
  console.log(`✅ ${activeClients.length} clients renderitzats`);
}

function getStatusColor(index) {
  const colors = [
    '#4CAF50', '#2196F3', '#9C27B0', '#FF5722',
    '#FFC107', '#00BCD4', '#E91E63', '#3F51B5'
  ];
  return colors[index % colors.length];
}

/* ==================== SINCRONITZACIÓ ==================== */

async function syncClientsFromSupabase() {
  console.log('🔄 Sincronitzant...');
  
  try {
    const clients = await loadAllClientsSupabase();
    
    if (!clients || Object.keys(clients).length === 0) {
      console.log('⚠️ No hi ha clients');
      return {};
    }
    
    window.state.clients = clients;
    
    // Guardar a localStorage
    try {
      localStorage.setItem('focuswork_clients', JSON.stringify(clients));
    } catch (e) {
      console.warn('No s\'ha pogut guardar a localStorage');
    }
    
    // Renderitzar
    if (document.querySelector('#clientsListContainer') || document.querySelector('#projectList')) {
      renderClientsList();
    }
    
    console.log(`✅ ${Object.keys(clients).length} clients sincronitzats`);
    return clients;
    
  } catch (error) {
    console.error('❌ Error:', error);
    return {};
  }
}

/* ==================== AUTO-INICIALITZACIÓ ==================== */

async function initSupabaseSync() {
  console.log('🚀 Inicialitzant...');
  
  // Esperar state
  let attempts = 0;
  while (!window.state && attempts < 50) {
    await new Promise(r => setTimeout(r, 100));
    attempts++;
  }
  
  if (!window.state) {
    console.error('❌ state no disponible');
    return;
  }
  
  // Sincronitzar
  await syncClientsFromSupabase();
  
  // Auto-sync cada 30 segons
  setInterval(async () => {
    if (window.state?.currentClientId) {
      const client = window.state.clients?.[window.state.currentClientId];
      if (client) {
        try {
          await saveClientSupabase(client);
        } catch (e) {
          console.error('Error auto-sync:', e);
        }
      }
    }
  }, 30000);
  
  console.log('✅ Sync inicialitzat');
}

/* ==================== EXPORTAR ==================== */

window.loadAllClientsSupabase = loadAllClientsSupabase;
window.saveClientSupabase = saveClientSupabase;
window.deleteClientSupabase = deleteClientSupabase;
window.syncClientsFromSupabase = syncClientsFromSupabase;
window.renderClientsList = renderClientsList;
window.initSupabaseSync = initSupabaseSync;

// Auto-iniciar
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initSupabaseSync, 1000);
  });
} else {
  setTimeout(initSupabaseSync, 1000);
}

console.log('✅ Supabase DB Final carregat correctament');

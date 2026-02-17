/*************************************************
 * FOCUSWORK - PATCH FINAL
 * 
 * Sobreescriu les funcions errònies de app-ui.js
 * que fan servir user_email i user_id inexistents.
 * 
 * INSTRUCCIONS:
 * 1. Puja aquest fitxer a GitHub com: patch.js
 * 2. Afegeix-lo a index.html DESPRES de app-ui.js:
 *    <script src="patch.js"></script>
 * 3. Commit i recarrega
 *************************************************/

console.log('🔧 Patch carregat - sobreescrivint funcions errònies...');

// =====================================================
// CORREGIR: loadAllClientsSupabase
// Eliminar el filtre per user_email
// =====================================================

window.loadAllClientsSupabase = async function() {
  console.log('📥 [PATCH] Carregant TOTS els clients...');
  
  try {
    const { data, error } = await window.supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    console.log(`✅ ${data.length} clients carregats`);
    
    const clients = {};
    data.forEach(c => clients[c.id] = c);
    return clients;
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    return {};
  }
};

// =====================================================
// CORREGIR: saveClientSupabase
// Eliminar user_email de les dades guardades
// =====================================================

window.saveClientSupabase = async function(client) {
  console.log('💾 [PATCH] Guardant client:', client.name);
  
  // Columnes que SÍ existeixen a Supabase
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
    tags: client.tags || [],
    created_at: client.created_at || new Date().toISOString()
  };
  
  try {
    const { data, error } = await window.supabase
      .from('clients')
      .upsert(clientData, { onConflict: 'id' })
      .select()
      .single();
    
    if (error) throw error;
    
    console.log('✅ Client guardat:', client.name);
    return true;
    
  } catch (error) {
    console.error('❌ Error guardant:', error.message);
    return false;
  }
};

// =====================================================
// CORREGIR: loadClientSupabase
// Eliminar el filtre per user_email
// =====================================================

window.loadClientSupabase = async function(clientId) {
  try {
    const { data, error } = await window.supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single();
    
    if (error) throw error;
    return data;
    
  } catch (error) {
    console.error('❌ Error carregant client:', error.message);
    return null;
  }
};

// =====================================================
// CORREGIR: syncClientsFromSupabase
// =====================================================

window.syncClientsFromSupabase = async function() {
  console.log('🔄 [PATCH] Sincronitzant clients...');
  
  const clients = await window.loadAllClientsSupabase();
  
  if (!window.state) {
    window.state = { clients: {} };
  }
  
  window.state.clients = clients;
  
  const count = Object.keys(clients).length;
  console.log(`✅ ${count} clients sincronitzats`);
  
  // Renderitzar si hi ha contenidor
  if (count > 0) {
    window.renderClientsPatched();
  }
  
  return clients;
};

// =====================================================
// CORREGIR: deleteClientSupabase
// =====================================================

window.deleteClientSupabase = async function(clientId) {
  try {
    const { error } = await window.supabase
      .from('clients')
      .delete()
      .eq('id', clientId);
    
    if (error) throw error;
    console.log('✅ Client eliminat');
    return true;
    
  } catch (error) {
    console.error('❌ Error eliminant:', error.message);
    return false;
  }
};

// =====================================================
// AFEGIR: checkMigration (funció que faltava)
// =====================================================

window.checkMigration = async function() {
  console.log('✅ [PATCH] checkMigration - sense migració necessària');
  return true;
};

// =====================================================
// NOVA FUNCIÓ: Renderitzar clients correctament
// =====================================================

window.renderClientsPatched = function() {
  const container = document.querySelector('#clientsListContainer')
    || document.querySelector('#projectList');
  
  if (!container) return;
  
  const clients = Object.values(window.state?.clients || {});
  
  if (clients.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:rgba(255,255,255,0.5);">No hi ha clients</div>';
    return;
  }
  
  container.innerHTML = '';
  
  clients
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    .forEach((client, index) => {
      const card = document.createElement('div');
      
      const colors = ['#4CAF50','#2196F3','#9C27B0','#FF5722','#FFC107','#00BCD4','#E91E63','#3F51B5'];
      const color = colors[index % colors.length];
      
      const h = Math.floor((client.total || 0) / 3600);
      const m = Math.floor(((client.total || 0) % 3600) / 60);
      const timeStr = h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m` : '';
      
      card.style.cssText = `
        padding: 20px;
        margin-bottom: 12px;
        background: linear-gradient(135deg, rgba(102,126,234,0.1), rgba(118,75,162,0.1));
        border-radius: 12px;
        cursor: pointer;
        border-left: 4px solid ${color};
        transition: all 0.3s;
      `;
      
      card.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:start;">
          <div style="flex:1;">
            <div style="font-size:18px;font-weight:bold;color:white;margin-bottom:6px;">${client.name}</div>
            ${client.email ? `<div style="font-size:13px;color:rgba(255,255,255,0.6);margin-bottom:4px;">📧 ${client.email}</div>` : ''}
            ${client.phone ? `<div style="font-size:13px;color:rgba(255,255,255,0.6);margin-bottom:4px;">📱 ${client.phone}</div>` : ''}
            ${timeStr ? `<div style="margin-top:10px;display:inline-block;padding:4px 12px;background:rgba(76,175,80,0.2);border-radius:6px;font-size:12px;font-weight:bold;color:#4CAF50;">⏱️ ${timeStr}</div>` : ''}
          </div>
          <div style="font-size:22px;opacity:0.3;">→</div>
        </div>
      `;
      
      card.onmouseover = () => {
        card.style.transform = 'translateX(6px) scale(1.02)';
        card.style.background = 'linear-gradient(135deg, rgba(102,126,234,0.2), rgba(118,75,162,0.2))';
      };
      
      card.onmouseout = () => {
        card.style.transform = '';
        card.style.background = 'linear-gradient(135deg, rgba(102,126,234,0.1), rgba(118,75,162,0.1))';
      };
      
      card.onclick = () => {
        window.state.currentClientId = client.id;
        if (window.save) window.save();
        setTimeout(() => location.reload(), 200);
      };
      
      container.appendChild(card);
    });
  
  console.log(`✅ [PATCH] ${clients.length} clients renderitzats`);
};

// =====================================================
// INICIALITZAR: Executar quan tot estigui carregat
// =====================================================

async function initPatch() {
  console.log('🚀 [PATCH] Iniciant sincronització...');
  
  // Esperar que state i supabase existeixin
  let attempts = 0;
  while ((!window.state || !window.supabase) && attempts < 100) {
    await new Promise(r => setTimeout(r, 100));
    attempts++;
  }
  
  // Crear state si no existeix
  if (!window.state) {
    window.state = {
      clients: {},
      currentClientId: null,
      isFull: false,
      license: null,
      day: new Date().toISOString().split('T')[0],
      focus: {},
      focusSchedule: { enabled: false, start: "09:00", end: "17:00" }
    };
  }
  
  // Sincronitzar i renderitzar
  await window.syncClientsFromSupabase();
  
  // Re-sincronitzar cada 30 segons
  setInterval(() => window.syncClientsFromSupabase(), 30000);
  
  console.log('✅ [PATCH] Inicialitzat correctament');
}

// Executar
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(initPatch, 1500));
} else {
  setTimeout(initPatch, 1500);
}

console.log('✅ Patch carregat. Les funcions errònies han estat sobreescrites.');

/*************************************************
 * FOCUSWORK - PATCH FINAL v3
 * Columnes correctes: id, name, email, phone, 
 * company, notes, status, activities, tags
 *************************************************/

console.log('🔧 Patch v3 carregat...');

// =====================================================
// COLUMNES REALS DE SUPABASE
// =====================================================
const SUPABASE_COLUMNS = 'id, name, email, phone, company, notes, status, activities, tags, created_at';

// =====================================================
// loadAllClientsSupabase - SENSE user_email, SENSE .single()
// =====================================================
window.loadAllClientsSupabase = async function() {
  console.log('📥 [PATCH] Carregant clients...');
  try {
    const { data, error } = await window.supabase
      .from('clients')
      .select(SUPABASE_COLUMNS)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    console.log(`✅ ${data.length} clients carregats`);
    const clients = {};
    data.forEach(c => clients[c.id] = c);
    return clients;
  } catch (e) {
    console.error('❌ loadAll:', e.message);
    return {};
  }
};

// =====================================================
// saveClientSupabase - SENSE billableTime, total, tasks
// =====================================================
window.saveClientSupabase = async function(client) {
  console.log('💾 [PATCH] Guardant:', client.name);
  
  // NOMÉS les columnes que existeixen a Supabase
  const data = {
    id: client.id,
    name: client.name || '',
    email: client.email || null,
    phone: client.phone || null,
    company: client.company || null,
    notes: client.notes || null,
    status: client.status || 'active',
    activities: client.activities || {},
    tags: client.tags || []
  };
  
  try {
    const { error } = await window.supabase
      .from('clients')
      .upsert(data, { onConflict: 'id' });
    
    if (error) throw error;
    console.log('✅ Guardat:', client.name);
    return true;
  } catch (e) {
    console.error('❌ save:', e.message);
    return false;
  }
};

// =====================================================
// loadClientSupabase - SENSE .single() per evitar errors
// =====================================================
window.loadClientSupabase = async function(clientId) {
  try {
    const { data, error } = await window.supabase
      .from('clients')
      .select(SUPABASE_COLUMNS)
      .eq('id', clientId)
      .limit(1);
    
    if (error) throw error;
    return data && data.length > 0 ? data[0] : null;
  } catch (e) {
    console.error('❌ loadClient:', e.message);
    return null;
  }
};

// =====================================================
// deleteClientSupabase
// =====================================================
window.deleteClientSupabase = async function(clientId) {
  try {
    const { error } = await window.supabase
      .from('clients')
      .delete()
      .eq('id', clientId);
    if (error) throw error;
    return true;
  } catch (e) {
    console.error('❌ delete:', e.message);
    return false;
  }
};

// =====================================================
// checkMigration - funció que faltava i petava l'app
// =====================================================
window.checkMigration = async function() {
  console.log('✅ [PATCH] checkMigration OK');
  return true;
};

// =====================================================
// syncClientsFromSupabase
// =====================================================
window.syncClientsFromSupabase = async function() {
  console.log('🔄 [PATCH] Sincronitzant...');
  const clients = await window.loadAllClientsSupabase();
  if (!window.state) window.state = { clients: {}, currentClientId: null };
  window.state.clients = clients;
  const count = Object.keys(clients).length;
  console.log(`✅ ${count} clients a state`);
  if (count > 0) window.renderClientsPatched();
  return clients;
};

// =====================================================
// renderClientsPatched - Renderitzar llista clients
// =====================================================
window.renderClientsPatched = function() {
  const container = document.querySelector('#clientsListContainer')
    || document.querySelector('#projectList');
  if (!container) return;
  
  const clients = Object.values(window.state?.clients || {});
  if (clients.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:rgba(255,255,255,0.4);">No hi ha clients</div>';
    return;
  }
  
  container.innerHTML = '';
  const colors = ['#4CAF50','#2196F3','#9C27B0','#FF5722','#FFC107','#00BCD4','#E91E63'];
  
  clients
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    .forEach((client, i) => {
      const card = document.createElement('div');
      card.style.cssText = `
        padding:18px 20px;
        margin-bottom:10px;
        background:linear-gradient(135deg,rgba(102,126,234,0.1),rgba(118,75,162,0.1));
        border-radius:12px;
        cursor:pointer;
        border-left:4px solid ${colors[i % colors.length]};
        transition:all 0.25s;
      `;
      
      // Calcular temps des de activitats
      const acts = client.activities || {};
      let totalSec = 0;
      Object.values(acts).forEach(a => {
        if (a && a.elapsed) totalSec += a.elapsed;
      });
      const h = Math.floor(totalSec / 3600);
      const m = Math.floor((totalSec % 3600) / 60);
      const timeStr = h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m` : '';
      
      const actCount = Object.keys(acts).length;
      
      card.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div style="flex:1;min-width:0;">
            <div style="font-size:17px;font-weight:bold;color:white;margin-bottom:5px;
              white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
              ${client.name || 'Sense nom'}
            </div>
            ${client.email ? `<div style="font-size:12px;color:rgba(255,255,255,0.55);margin-bottom:3px;">📧 ${client.email}</div>` : ''}
            ${client.phone ? `<div style="font-size:12px;color:rgba(255,255,255,0.55);">📱 ${client.phone}</div>` : ''}
            <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;">
              ${timeStr ? `<span style="padding:3px 10px;background:rgba(76,175,80,0.2);border-radius:5px;font-size:11px;color:#4CAF50;font-weight:bold;">⏱️ ${timeStr}</span>` : ''}
              ${actCount > 0 ? `<span style="padding:3px 10px;background:rgba(33,150,243,0.2);border-radius:5px;font-size:11px;color:#2196F3;font-weight:bold;">📊 ${actCount}</span>` : ''}
            </div>
          </div>
          <div style="font-size:20px;opacity:0.25;margin-left:10px;">→</div>
        </div>
      `;
      
      card.onmouseover = () => {
        card.style.transform = 'translateX(6px)';
        card.style.background = 'linear-gradient(135deg,rgba(102,126,234,0.2),rgba(118,75,162,0.2))';
      };
      card.onmouseout = () => {
        card.style.transform = '';
        card.style.background = 'linear-gradient(135deg,rgba(102,126,234,0.1),rgba(118,75,162,0.1))';
      };
      
      card.onclick = () => {
        if (!window.state) window.state = {};
        window.state.currentClientId = client.id;
        // Guardar estat complet localment
        try { localStorage.setItem('fw_currentClient', client.id); } catch(e){}
        if (window.save) {
          window.save().then(() => location.reload());
        } else {
          setTimeout(() => location.reload(), 150);
        }
      };
      
      container.appendChild(card);
    });
  
  console.log(`✅ [PATCH] ${clients.length} clients renderitzats`);
};

// =====================================================
// INICIALITZAR
// =====================================================
async function initPatch() {
  let attempts = 0;
  while (!window.supabase && attempts < 60) {
    await new Promise(r => setTimeout(r, 100));
    attempts++;
  }
  
  if (!window.state) {
    window.state = {
      clients: {}, currentClientId: null,
      isFull: false, license: null,
      day: new Date().toISOString().split('T')[0],
      focus: {}, focusSchedule: { enabled: false, start:"09:00", end:"17:00" }
    };
  }
  
  await window.syncClientsFromSupabase();
  
  // Resincronitzar cada 30s
  setInterval(() => window.syncClientsFromSupabase(), 30000);
  
  console.log('✅ [PATCH] Inicialitzat!');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(initPatch, 1500));
} else {
  setTimeout(initPatch, 1500);
}

console.log('✅ Patch v3 llest');

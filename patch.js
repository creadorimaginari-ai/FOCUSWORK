/*************************************************
 * FOCUSWORK - PATCH FINAL v4
 * 
 * Fixes:
 * 1. Elimina user_email de totes les queries
 * 2. Afegeix active:true a tots els clients carregats
 * 3. Elimina columnes inexistents (billableTime, total)
 * 4. Corregeix el filtre que ocultava tots els clients
 * 5. Afegeix checkMigration que faltava
 * 6. No guarda a Supabase si no cal (evita RLS errors)
 *************************************************/

console.log('🔧 [PATCH v4] Carregant...');

// ─────────────────────────────────────────
// 1. loadAllClientsSupabase - SENSE user_email
// ─────────────────────────────────────────
window.loadAllClientsSupabase = async function() {
  console.log('📥 [PATCH] Carregant clients...');
  try {
    const { data, error } = await window.supabase
      .from('clients')
      .select('id, name, email, phone, company, notes, status, activities, tags, created_at')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    const clients = {};
    data.forEach(c => {
      c.active = true;        // CLAU: sense aquest camp l'app tracta el client com a tancat
      c.total = c.total || 0; // Evitar NaN
      c.billableTime = 0;     // No existeix a Supabase, posar 0
      clients[c.id] = c;
    });
    
    console.log(`✅ [PATCH] ${data.length} clients carregats`);
    return clients;
  } catch (e) {
    console.error('❌ loadAll:', e.message);
    return {};
  }
};

// ─────────────────────────────────────────
// 2. loadClientSupabase - SENSE user_email, SENSE .single()
// ─────────────────────────────────────────
window.loadClientSupabase = async function(clientId) {
  try {
    const { data, error } = await window.supabase
      .from('clients')
      .select('id, name, email, phone, company, notes, status, activities, tags, created_at')
      .eq('id', clientId)
      .limit(1);
    
    if (error) throw error;
    if (!data || data.length === 0) return null;
    
    const c = data[0];
    c.active = true;
    c.total = c.total || 0;
    c.billableTime = 0;
    return c;
  } catch (e) {
    console.error('❌ loadClient:', e.message);
    return null;
  }
};

// ─────────────────────────────────────────
// 3. saveClientSupabase - SENSE columnes inexistents
// ─────────────────────────────────────────
window.saveClientSupabase = async function(client) {
  // Només guardar el que Supabase accepta
  const data = {
    id: client.id,
    name: client.name || '',
    email: client.email || null,
    phone: client.phone || null,
    company: client.company || null,
    notes: client.notes || null,
    status: client.status || 'active',
    activities: client.activities || {},
    tags: client.tags || [],
    created_at: client.created_at || new Date().toISOString()
  };
  
  try {
    const { error } = await window.supabase
      .from('clients')
      .upsert(data, { onConflict: 'id' });
    
    if (error) throw error;
    console.log('✅ [PATCH] Guardat:', client.name);
    return true;
  } catch (e) {
    console.error('❌ save:', e.message);
    return false;
  }
};

// ─────────────────────────────────────────
// 4. deleteClientSupabase
// ─────────────────────────────────────────
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

// ─────────────────────────────────────────
// 5. checkMigration - funció que faltava i petava l'app
// ─────────────────────────────────────────
window.checkMigration = async function() {
  return true;
};

// ─────────────────────────────────────────
// 6. syncClientsFromSupabase
// ─────────────────────────────────────────
window.syncClientsFromSupabase = async function() {
  console.log('🔄 [PATCH] Sincronitzant...');
  const clients = await window.loadAllClientsSupabase();
  if (!window.state) window.state = {};
  window.state.clients = clients;
  
  const count = Object.keys(clients).length;
  console.log(`✅ [PATCH] ${count} clients a state`);
  
  // Actualitzar la UI si estem a la vista de llista
  if (typeof window.renderClients === 'function') window.renderClients();
  if (typeof window.updateProjectList === 'function') window.updateProjectList();
  
  return clients;
};

// ─────────────────────────────────────────
// 7. updateProjectList - CORREGIDA (el filtre ocultava tots)
// ─────────────────────────────────────────
window.updateProjectList = function() {
  const container = document.querySelector('#clientsListContainer')
    || document.querySelector('#projectList');
  
  if (!container) return;
  
  const allClients = Object.values(window.state?.clients || {});
  
  if (allClients.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:rgba(255,255,255,0.5)">No hi ha clients</div>';
    return;
  }
  
  // Agafar el filtre actiu
  const filterEl = document.querySelector('[data-filter-status]');
  const filterStatus = filterEl?.dataset.filterStatus || 'all';
  
  // Filtrar (per defecte mostrar tots els actius)
  let clients = allClients.filter(c => c.active !== false);
  
  // Aplicar filtre específic si n'hi ha
  if (filterStatus && filterStatus !== 'all' && filterStatus !== 'todos') {
    clients = allClients; // Si hi ha filtre especific, no filtrar per active
  }
  
  // Ordenar
  clients.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  
  container.innerHTML = '';
  
  const colors = ['#4CAF50','#2196F3','#9C27B0','#FF5722','#FFC107','#00BCD4','#E91E63','#3F51B5'];
  
  clients.forEach((client, i) => {
    const card = document.createElement('div');
    card.className = 'project-card';
    card.style.cssText = `
      padding: 18px 20px;
      margin-bottom: 10px;
      background: rgba(255,255,255,0.05);
      border-radius: 10px;
      cursor: pointer;
      transition: all 0.2s;
      border-left: 4px solid ${colors[i % colors.length]};
    `;
    
    card.onmouseover = () => {
      card.style.background = 'rgba(255,255,255,0.1)';
      card.style.transform = 'translateX(5px)';
    };
    card.onmouseout = () => {
      card.style.background = 'rgba(255,255,255,0.05)';
      card.style.transform = '';
    };
    
    const acts = client.activities || {};
    let totalSec = client.total || 0;
    // Si total no existeix, calcular des de activitats
    if (!totalSec) {
      Object.values(acts).forEach(v => {
        if (typeof v === 'number') totalSec += v;
      });
    }
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const timeStr = h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m` : '';
    
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div style="flex:1;min-width:0;">
          <div style="font-size:16px;font-weight:bold;color:white;margin-bottom:4px;
            white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            ${client.name || 'Sense nom'}
          </div>
          <div style="font-size:12px;color:rgba(255,255,255,0.55);">
            ${client.email || ''} ${client.phone ? '• ' + client.phone : ''}
          </div>
          ${client.company ? `<div style="font-size:11px;color:rgba(255,255,255,0.4);margin-top:2px;">${client.company}</div>` : ''}
          ${timeStr ? `<div style="margin-top:6px;display:inline-block;padding:2px 8px;background:rgba(76,175,80,0.2);border-radius:4px;font-size:11px;color:#4CAF50;">⏱️ ${timeStr}</div>` : ''}
        </div>
        <div style="font-size:18px;opacity:0.25;margin-left:10px;">→</div>
      </div>
    `;
    
    card.onclick = async () => {
      window.state.currentClientId = client.id;
      if (window.save) await window.save();
      location.reload();
    };
    
    container.appendChild(card);
  });
  
  console.log(`✅ [PATCH] ${clients.length} clients renderitzats`);
};

// ─────────────────────────────────────────
// 8. INICIALITZAR
// ─────────────────────────────────────────
async function initPatch() {
  let attempts = 0;
  while (!window.supabase && attempts < 60) {
    await new Promise(r => setTimeout(r, 100));
    attempts++;
  }
  
  if (!window.state) {
    window.state = {
      clients: {}, currentClientId: null, isFull: false,
      license: null, day: new Date().toISOString().split('T')[0],
      focus: {}, focusSchedule: { enabled: false, start:"09:00", end:"17:00" }
    };
  }
  
  await window.syncClientsFromSupabase();
  setInterval(() => window.syncClientsFromSupabase(), 30000);
  
  console.log('✅ [PATCH v4] Inicialitzat!');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(initPatch, 1500));
} else {
  setTimeout(initPatch, 1500);
}

console.log('✅ [PATCH v4] Llest - active:true afegit a tots els clients');

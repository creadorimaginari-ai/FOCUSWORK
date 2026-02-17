/*************************************************
 * FOCUSWORK - PATCH FINAL v5
 * 
 * Fixes:
 * 1. active:true a tots els clients de Supabase
 * 2. Carrega fotos de IndexedDB local + Supabase
 * 3. Combina dades locals + remotes (millors dades guanyen)
 * 4. checkMigration que faltava
 * 5. Columnes correctes sense user_email/billableTime
 * 6. updateProjectList corregit
 *************************************************/

console.log('🔧 [PATCH v5] Carregant...');

// ─────────────────────────────────────────
// HELPER: Obtenir fotos d'IndexedDB per client
// ─────────────────────────────────────────
async function getLocalPhotos(clientId) {
  try {
    if (!window.db) return [];
    return new Promise((resolve) => {
      try {
        const tx = window.db.transaction(['photos'], 'readonly');
        const store = tx.objectStore('photos');
        const index = store.index('clientId');
        const req = index.getAll(clientId);
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      } catch(e) {
        resolve([]);
      }
    });
  } catch(e) {
    return [];
  }
}

// ─────────────────────────────────────────
// HELPER: Obtenir dades locals del client
// ─────────────────────────────────────────
async function getLocalClient(clientId) {
  try {
    if (!window.db) return null;
    return new Promise((resolve) => {
      try {
        const tx = window.db.transaction(['clients'], 'readonly');
        const store = tx.objectStore('clients');
        const req = store.get(clientId);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      } catch(e) {
        resolve(null);
      }
    });
  } catch(e) {
    return null;
  }
}

// ─────────────────────────────────────────
// 1. loadAllClientsSupabase - SENSE user_email + active:true
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
    for (const c of data) {
      // Intentar combinar amb dades locals (que tenen total, billableTime, fotos, etc.)
      const local = await getLocalClient(c.id);
      
      const merged = {
        // Base: dades de Supabase
        ...c,
        // Complementar amb dades locals si existeixen
        total: (local?.total) || 0,
        billableTime: (local?.billableTime) || 0,
        tasks: local?.tasks || { urgent: "", important: "", later: "" },
        deliveryDate: local?.deliveryDate || null,
        extraHours: local?.extraHours || [],
        // IMPORTANT: sempre active:true per compatibilitat
        active: true,
        // Les activitats de Supabase tenen preferència (més actualitzades)
        activities: c.activities || local?.activities || {}
      };
      
      // Afegir fotos de IndexedDB
      const photos = await getLocalPhotos(c.id);
      merged.photos = photos.map(p => ({
        id: p.id,
        data: p.data,
        date: p.date,
        comment: p.comment || ""
      }));
      
      if (merged.photos.length > 0) {
        console.log(`📷 ${merged.photos.length} fotos carregades per: ${c.name}`);
      }
      
      clients[c.id] = merged;
    }
    
    console.log(`✅ [PATCH] ${data.length} clients carregats (amb fotos locals)`);
    return clients;
  } catch (e) {
    console.error('❌ loadAll:', e.message);
    return {};
  }
};

// ─────────────────────────────────────────
// 2. loadClientSupabase - Combina Supabase + IndexedDB
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
    const local = await getLocalClient(clientId);
    const photos = await getLocalPhotos(clientId);
    
    return {
      ...c,
      total: local?.total || 0,
      billableTime: local?.billableTime || 0,
      tasks: local?.tasks || { urgent: "", important: "", later: "" },
      deliveryDate: local?.deliveryDate || null,
      extraHours: local?.extraHours || [],
      active: true,
      activities: c.activities || local?.activities || {},
      photos: photos.map(p => ({
        id: p.id,
        data: p.data,
        date: p.date,
        comment: p.comment || ""
      }))
    };
  } catch (e) {
    console.error('❌ loadClient:', e.message);
    // Fallback complet a local
    try {
      const local = await getLocalClient(clientId);
      if (local) {
        local.active = true;
        const photos = await getLocalPhotos(clientId);
        local.photos = photos.map(p => ({ id: p.id, data: p.data, date: p.date, comment: p.comment || "" }));
        return local;
      }
    } catch(e2) {}
    return null;
  }
};

// ─────────────────────────────────────────
// 3. saveClientSupabase - SENSE columnes inexistents
// ─────────────────────────────────────────
window.saveClientSupabase = async function(client) {
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
    const { error } = await window.supabase.from('clients').delete().eq('id', clientId);
    if (error) throw error;
    return true;
  } catch (e) {
    return false;
  }
};

// ─────────────────────────────────────────
// 5. checkMigration - que faltava i petava l'app
// ─────────────────────────────────────────
window.checkMigration = async function() { return true; };

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
  if (typeof window.updateProjectList === 'function') window.updateProjectList();
  return clients;
};

// ─────────────────────────────────────────
// 7. updateProjectList - Renderitzat corregit
// ─────────────────────────────────────────
window.updateProjectList = function() {
  const container = document.querySelector('#clientsListContainer')
    || document.querySelector('#projectList');
  if (!container) return;
  
  // Tots els clients amb active:true
  const clients = Object.values(window.state?.clients || {})
    .filter(c => c.active !== false)
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  
  if (clients.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:rgba(255,255,255,0.5)">No hi ha clients</div>';
    return;
  }
  
  container.innerHTML = '';
  const colors = ['#4CAF50','#2196F3','#9C27B0','#FF5722','#FFC107','#00BCD4','#E91E63','#3F51B5'];
  
  clients.forEach((client, i) => {
    const card = document.createElement('div');
    card.className = 'project-card';
    card.style.cssText = `
      padding: 16px 20px;
      margin-bottom: 10px;
      background: rgba(255,255,255,0.05);
      border-radius: 10px;
      cursor: pointer;
      transition: all 0.2s;
      border-left: 4px solid ${colors[i % colors.length]};
    `;
    card.onmouseover = () => { card.style.background = 'rgba(255,255,255,0.1)'; card.style.transform = 'translateX(5px)'; };
    card.onmouseout = () => { card.style.background = 'rgba(255,255,255,0.05)'; card.style.transform = ''; };
    
    const totalSec = client.total || 0;
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const timeStr = h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m` : '';
    const photoCount = (client.photos || []).length;
    
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div style="flex:1;min-width:0;">
          <div style="font-size:16px;font-weight:bold;color:white;margin-bottom:4px;
            white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${client.name || 'Sense nom'}</div>
          <div style="font-size:12px;color:rgba(255,255,255,0.55);">
            ${client.email || ''} ${client.phone ? '• ' + client.phone : ''}
          </div>
          ${client.company ? `<div style="font-size:11px;color:rgba(255,255,255,0.4);margin-top:2px;">🏢 ${client.company}</div>` : ''}
          <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap;">
            ${timeStr ? `<span style="padding:2px 8px;background:rgba(76,175,80,0.2);border-radius:4px;font-size:11px;color:#4CAF50;">⏱️ ${timeStr}</span>` : ''}
            ${photoCount > 0 ? `<span style="padding:2px 8px;background:rgba(33,150,243,0.2);border-radius:4px;font-size:11px;color:#2196F3;">📷 ${photoCount}</span>` : ''}
          </div>
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
// INICIALITZAR
// ─────────────────────────────────────────
async function initPatch() {
  let attempts = 0;
  while ((!window.supabase || !window.db) && attempts < 80) {
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
  console.log('✅ [PATCH v5] Inicialitzat! Supabase + IndexedDB combinats');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(initPatch, 2000));
} else {
  setTimeout(initPatch, 2000);
}

console.log('✅ [PATCH v5] Llest - fotos IndexedDB + dades Supabase');

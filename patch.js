/*************************************************
 * FOCUSWORK - PATCH DEFINITIU v6
 * 
 * ESTRATÈGIA: Esperar que TOT el codi original
 * acabi d'executar-se, llavors prendre el control
 * i no deixar que res sobreescrigui la llista.
 *************************************************/

console.log('🔧 [PATCH v6] Carregant...');

// ─── HELPERS IndexedDB ───────────────────────────
async function _getLocalPhotos(clientId) {
  try {
    if (!window.db) return [];
    return new Promise(resolve => {
      try {
        const tx = window.db.transaction(['photos'], 'readonly');
        const req = tx.objectStore('photos').index('clientId').getAll(clientId);
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      } catch(e) { resolve([]); }
    });
  } catch(e) { return []; }
}

async function _getLocalClient(clientId) {
  try {
    if (!window.db) return null;
    return new Promise(resolve => {
      try {
        const tx = window.db.transaction(['clients'], 'readonly');
        const req = tx.objectStore('clients').get(clientId);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      } catch(e) { resolve(null); }
    });
  } catch(e) { return null; }
}

// ─── SUPABASE: CARREGAR CLIENTS ──────────────────
window.loadAllClientsSupabase = async function() {
  try {
    const { data, error } = await window.supabase
      .from('clients')
      .select('id,name,email,phone,company,notes,status,activities,tags,created_at')
      .order('created_at', { ascending: false });
    if (error) throw error;
    const clients = {};
    for (const c of data) {
      const local = await _getLocalClient(c.id);
      clients[c.id] = {
        ...c,
        active: true,
        total: local?.total || 0,
        billableTime: local?.billableTime || 0,
        tasks: local?.tasks || { urgent:'', important:'', later:'' },
        deliveryDate: local?.deliveryDate || null,
        extraHours: local?.extraHours || [],
        photos: []
      };
    }
    return clients;
  } catch(e) {
    console.error('❌ loadAll:', e.message);
    return {};
  }
};

window.loadClientSupabase = async function(clientId) {
  try {
    const { data, error } = await window.supabase
      .from('clients')
      .select('id,name,email,phone,company,notes,status,activities,tags,created_at')
      .eq('id', clientId).limit(1);
    if (error) throw error;
    if (!data?.length) return null;
    const c = data[0];
    const local = await _getLocalClient(clientId);
    const photos = await _getLocalPhotos(clientId);
    return {
      ...c,
      active: true,
      total: local?.total || 0,
      billableTime: local?.billableTime || 0,
      tasks: local?.tasks || { urgent:'', important:'', later:'' },
      deliveryDate: local?.deliveryDate || null,
      extraHours: local?.extraHours || [],
      photos: photos.map(p => ({ id:p.id, data:p.data, date:p.date, comment:p.comment||'' }))
    };
  } catch(e) {
    const local = await _getLocalClient(clientId);
    if (!local) return null;
    local.active = true;
    local.photos = (await _getLocalPhotos(clientId)).map(p => ({ id:p.id, data:p.data, date:p.date, comment:p.comment||'' }));
    return local;
  }
};

window.saveClientSupabase = async function(client) {
  const d = {
    id: client.id, name: client.name||'',
    email: client.email||null, phone: client.phone||null,
    company: client.company||null, notes: client.notes||null,
    status: client.status||'active',
    activities: client.activities||{}, tags: client.tags||[],
    created_at: client.created_at||new Date().toISOString()
  };
  try {
    const { error } = await window.supabase.from('clients').upsert(d, { onConflict:'id' });
    if (error) throw error;
    return true;
  } catch(e) { return false; }
};

window.deleteClientSupabase = async function(id) {
  try {
    const { error } = await window.supabase.from('clients').delete().eq('id', id);
    return !error;
  } catch(e) { return false; }
};

window.checkMigration = async function() { return true; };

// ─── RENDERITZAR LLISTA (LA FUNCIÓ DEFINITIVA) ───
function _renderList() {
  const container = document.querySelector('#clientsListContainer')
    || document.querySelector('#projectList');
  if (!container) return false;

  const clients = Object.values(window.state?.clients || {})
    .filter(c => c.active !== false)
    .sort((a,b) => new Date(b.created_at||0) - new Date(a.created_at||0));

  if (!clients.length) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:rgba(255,255,255,0.4)">No hi ha clients</div>';
    return true;
  }

  container.innerHTML = '';
  const colors = ['#4CAF50','#2196F3','#9C27B0','#FF5722','#FFC107','#00BCD4','#E91E63','#3F51B5'];

  clients.forEach((client, i) => {
    const card = document.createElement('div');
    // Usar les classes CSS ORIGINALS de l'app
    card.className = 'project-card';
    card.dataset.clientId = client.id;

    const totalSec = client.total || 0;
    const h = Math.floor(totalSec/3600);
    const m = Math.floor((totalSec%3600)/60);
    const timeStr = h>0 ? `${h}h ${m}m` : m>0 ? `${m}m` : '';
    const photoCount = (client.photos||[]).length;

    // HTML que respecta l'estructura original de l'app
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 16px;">
        <div style="flex:1;min-width:0;">
          <div style="font-size:16px;font-weight:600;color:white;margin-bottom:3px;
            overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
            ${client.name||'Sense nom'}
          </div>
          <div style="font-size:12px;color:rgba(255,255,255,0.5);margin-bottom:4px;">
            ${[client.email, client.phone].filter(Boolean).join(' • ')}
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            ${timeStr ? `<span style="font-size:11px;padding:2px 7px;background:rgba(76,175,80,0.2);border-radius:4px;color:#4CAF50;">⏱ ${timeStr}</span>` : ''}
            ${photoCount ? `<span style="font-size:11px;padding:2px 7px;background:rgba(33,150,243,0.2);border-radius:4px;color:#64B5F6;">📷 ${photoCount}</span>` : ''}
          </div>
        </div>
        <div style="width:4px;height:40px;background:${colors[i%colors.length]};border-radius:2px;margin-left:12px;flex-shrink:0;"></div>
      </div>
    `;

    card.onclick = async (e) => {
      e.stopPropagation();
      if (!window.state) return;
      window.state.currentClientId = client.id;
      try { if (window.save) await window.save(); } catch(err) {}
      location.reload();
    };

    container.appendChild(card);
  });

  console.log(`✅ [PATCH] ${clients.length} clients renderitzats`);
  return true;
}

// ─── BLOQUEJAR updateProjectList ANTIGA ──────────
// Sobreescriure amb versió que usa _renderList
window.updateProjectList = function() {
  _renderList();
};

window.syncClientsFromSupabase = async function() {
  const clients = await window.loadAllClientsSupabase();
  if (!window.state) window.state = {};
  window.state.clients = clients;
  _renderList();
  return clients;
};

// ─── INICIALITZACIÓ: Esperar que TOT acabi ────────
async function _initPatch() {
  // Esperar que db i supabase estiguin llests
  let attempts = 0;
  while ((!window.supabase || !window.db || !window.state) && attempts < 100) {
    await new Promise(r => setTimeout(r, 100));
    attempts++;
  }

  if (!window.state) window.state = { clients:{}, currentClientId:null };

  // Carregar clients
  const clients = await window.loadAllClientsSupabase();
  window.state.clients = clients;

  // Esperar 500ms MÉS per assegurar que el codi original ha acabat
  // i llavors renderitzar PER DARRERA VEGADA (bloquejant)
  await new Promise(r => setTimeout(r, 500));
  _renderList();

  // Observar el DOM: si el contenidor es buida, tornar a renderitzar
  const container = document.querySelector('#clientsListContainer')
    || document.querySelector('#projectList');

  if (container) {
    const observer = new MutationObserver(() => {
      // Si el contenidor es buidà sense ser nosaltres, tornar a omplir
      if (container.children.length === 0 && Object.keys(window.state?.clients||{}).length > 0) {
        console.log('🔄 [PATCH] Contenidor buidat - tornant a renderitzar');
        _renderList();
      }
    });
    observer.observe(container, { childList: true });
  }

  // Sync cada 30s
  setInterval(() => window.syncClientsFromSupabase(), 30000);

  console.log('✅ [PATCH v6] Inicialitzat amb MutationObserver!');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(_initPatch, 2500));
} else {
  setTimeout(_initPatch, 2500);
}

console.log('✅ [PATCH v6] Llest');
                                      

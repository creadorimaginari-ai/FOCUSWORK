/*
 * PATCH DEFINITIU - FocusWork
 * Problema 1: Els cards de client fan location.reload() en lloc de cridar selectClient()
 * Problema 2: Les fotos venen d'IndexedDB però de vegades no es carreguen
 */
console.log('🔧 [PATCH] Carregant...');

window.checkMigration = async function() { return true; };

// ─────────────────────────────────────────────────────────────
// FIX 1: sobreescriure renderClientList de app-core.js
// perquè el clic cridi selectClient() en lloc de location.reload()
// ─────────────────────────────────────────────────────────────
function patchRenderClientList() {
  window.renderClientList = function() {
    const container = document.querySelector('#projectList');
    if (!container) return;

    container.innerHTML = '';

    const clientsObj = (window.state && window.state.clients) || {};
    let clients = Object.values(clientsObj).filter(c => {
      const s = (c.status || '').toLowerCase();
      return s !== 'archived' && s !== 'deleted' && c.active !== false;
    });

    if (clients.length === 0) {
      container.innerHTML = `
        <div style="text-align:center;padding:40px;color:#888;">
          <div style="font-size:48px;margin-bottom:20px;">📋</div>
          <div style="font-size:16px;margin-bottom:20px;">No hi ha clients</div>
          <button onclick="window.syncClients().then(()=>window.renderClientList())"
            style="padding:10px 20px;background:#2196F3;color:white;border:none;border-radius:6px;cursor:pointer;">
            🔄 Recarregar de Supabase
          </button>
        </div>`;
      return;
    }

    clients.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

    clients.forEach(client => {
      const card = document.createElement('div');
      card.className = 'project-card';
      card.style.cssText = `
        padding:15px; margin-bottom:10px;
        background:rgba(255,255,255,0.05); border-radius:8px;
        cursor:pointer; transition:all 0.2s;
        border-left:3px solid #4CAF50;`;

      card.onmouseover = () => { card.style.background = 'rgba(255,255,255,0.1)'; };
      card.onmouseout  = () => { card.style.background = 'rgba(255,255,255,0.05)'; };

      card.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:start;">
          <div style="flex:1;">
            <div style="font-size:16px;font-weight:bold;color:white;margin-bottom:5px;">
              ${client.name || 'Sense nom'}
            </div>
            <div style="font-size:12px;color:#888;">
              ${client.email || ''} ${client.phone ? '• ' + client.phone : ''}
            </div>
            ${client.company ? `<div style="font-size:12px;color:#666;margin-top:3px;">${client.company}</div>` : ''}
          </div>
          <div style="font-size:20px;opacity:0.5;">✓</div>
        </div>`;

      // ✅ Cridar selectClient() que ja existeix a app-ui.js
      card.onclick = () => {
        console.log('📌 [PATCH] Obrint client:', client.id, client.name);
        if (typeof selectClient === 'function') {
          selectClient(client.id);
        } else {
          // Fallback directe
          state.currentClientId = client.id;
          state.currentActivity = ACTIVITIES.WORK;
          state.sessionElapsed = 0;
          state.lastTick = Date.now();
          isWorkpadInitialized = false;
          areTasksInitialized = false;
          save().then(() => loadClient(client.id).then(c => updateUI(c)));
        }
      };

      container.appendChild(card);
    });

    console.log(`✅ [PATCH] ${clients.length} clients renderitzats`);
  };
  console.log('✅ [PATCH] renderClientList patchejat');
}

// ─────────────────────────────────────────────────────────────
// FIX 2: patchejar updateProjectList i variants d'app-ui.js
// que també fan location.reload() al clicar cards
// ─────────────────────────────────────────────────────────────
function patchUpdateProjectList() {
  ['updateProjectList', 'updateProjectListEnhanced'].forEach(fnName => {
    if (typeof window[fnName] !== 'function') return;
    const _orig = window[fnName];

    window[fnName] = async function(...args) {
      await _orig.apply(this, args);

      // Sobreescriure onclicks dels cards generats per la funció original
      const container = document.querySelector('#projectList');
      if (!container) return;

      container.querySelectorAll('.project-card:not([data-patched])').forEach(card => {
        card.dataset.patched = '1';
        const origOnclick = card.onclick;
        if (!origOnclick) return;

        card.onclick = async (e) => {
          // Interceptar location.reload temporalment
          const origReload = window.location.reload.bind(window.location);
          window.location.reload = () => console.log('🛑 [PATCH] reload() bloquejat');

          // Interceptar save() per capturar l'id que l'onclick assigna
          let capturedId = null;
          const origSave = window.save;
          window.save = async function() {
            capturedId = window.state ? window.state.currentClientId : null;
            return true; // No guardem res aquí, ho fa selectClient
          };

          try {
            await origOnclick.call(card, e);
          } catch(err) {}

          window.save = origSave;
          window.location.reload = origReload;

          const targetId = capturedId || (window.state ? window.state.currentClientId : null);
          if (targetId) {
            console.log('📌 [PATCH] Obrint client via updateProjectList:', targetId);
            if (typeof selectClient === 'function') {
              await selectClient(targetId);
            }
          }
        };
      });
    };

    console.log(`✅ [PATCH] ${fnName} patchejat`);
  });
}

// ─────────────────────────────────────────────────────────────
// FIX 3: garantir que loadClient sempre carrega fotos d'IndexedDB
// ─────────────────────────────────────────────────────────────
function patchLoadClientForPhotos() {
  if (typeof window.loadClient !== 'function') return false;

  const _orig = window.loadClient;

  window.loadClient = async function(clientId) {
    if (!clientId) return null;

    const client = await _orig(clientId);
    if (!client) return null;

    // Si ja té fotos no cal fer res
    if (client.photos && client.photos.length > 0) return client;

    // Carregar fotos d'IndexedDB directament
    if (window.db) {
      try {
        const photos = await new Promise(resolve => {
          try {
            const tx = window.db.transaction(['photos'], 'readonly');
            const req = tx.objectStore('photos').index('clientId').getAll(clientId);
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => resolve([]);
          } catch(e) { resolve([]); }
        });

        if (photos.length > 0) {
          client.photos = photos.map(p => ({
            id: p.id, data: p.data, date: p.date, comment: p.comment || ''
          }));
          console.log(`📷 [PATCH] ${photos.length} fotos per "${client.name}"`);
        }
      } catch(e) {}
    }

    client.photos       = client.photos || [];
    client.files        = client.files  || [];
    client.tasks        = client.tasks  || { urgent: '', important: '', later: '' };
    client.notes        = client.notes  || '';
    client.total        = client.total  || 0;
    client.billableTime = client.billableTime || 0;
    client.active       = true;

    return client;
  };

  console.log('✅ [PATCH] loadClient amb fotos activat');
  return true;
}

// ─────────────────────────────────────────────────────────────
// INICIALITZACIÓ
// ─────────────────────────────────────────────────────────────
async function initPatch() {
  // Esperar que loadClient existeixi (carregat per app-core.js)
  let tries = 0;
  while (typeof window.loadClient !== 'function' && tries < 80) {
    await new Promise(r => setTimeout(r, 100));
    tries++;
  }

  patchLoadClientForPhotos();
  patchRenderClientList();
  patchUpdateProjectList();

  // Sincronitzar clients i renderitzar llista
  if (typeof window.syncClients === 'function') {
    await window.syncClients();
  } else if (typeof window.syncClientsFromSupabase === 'function') {
    await window.syncClientsFromSupabase();
  }

  window.renderClientList();

  // Si hi havia un client actiu guardat, restaurar-lo sense reload
  if (window.state && window.state.currentClientId) {
    console.log('🔄 [PATCH] Restaurant client actiu:', window.state.currentClientId);
    const client = await window.loadClient(window.state.currentClientId);
    if (client && typeof updateUI === 'function') {
      await updateUI(client);
      const panel = document.getElementById('clientInfoPanel');
      const btns  = document.getElementById('clientFixedButtons');
      if (panel) panel.style.display = 'block';
      if (btns)  btns.style.display  = 'grid';
      console.log('✅ [PATCH] Client restaurat:', client.name);
    }
  }

  console.log('✅ [PATCH] Inicialització completada');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(initPatch, 1200));
} else {
  setTimeout(initPatch, 1200);
}

console.log('✅ [PATCH] Fitxer carregat');

/*
 * PATCH DEFINITIU - FocusWork
 * Soluciona:
 *   1. Els clients no s'obren al clicar (location.reload() trenca el flux)
 *   2. Les fotos i arxius no apareixen (venen d'IndexedDB, no de Supabase)
 */
console.log('🔧 [PATCH] Carregant...');

// checkMigration que petava l'app
window.checkMigration = async function() { return true; };

// ─────────────────────────────────────────────
// HELPER: carregar fotos + arxius d'IndexedDB
// ─────────────────────────────────────────────
async function _loadFilesFromIndexedDB(clientId) {
  const result = { photos: [], files: [] };
  if (!window.db || !clientId) return result;

  try {
    // Fotos
    result.photos = await new Promise(resolve => {
      try {
        const tx = window.db.transaction(['photos'], 'readonly');
        const req = tx.objectStore('photos').index('clientId').getAll(clientId);
        req.onsuccess = () => resolve((req.result || []).map(p => ({
          id: p.id, data: p.data, date: p.date, comment: p.comment || ''
        })));
        req.onerror = () => resolve([]);
      } catch(e) { resolve([]); }
    });
  } catch(e) { /* IndexedDB no disponible */ }

  try {
    // Arxius (si existeix l'objectStore 'files')
    const storeNames = Array.from(window.db.objectStoreNames);
    if (storeNames.includes('files')) {
      result.files = await new Promise(resolve => {
        try {
          const tx = window.db.transaction(['files'], 'readonly');
          const req = tx.objectStore('files').index('clientId').getAll(clientId);
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => resolve([]);
        } catch(e) { resolve([]); }
      });
    }
  } catch(e) { /* objectStore 'files' no existeix */ }

  return result;
}

// ─────────────────────────────────────────────
// SOBREESCRIURE loadClient
// S'executa quan app-core.js ja ha definit la seva versió
// ─────────────────────────────────────────────
function _patchLoadClient() {
  const _original = window.loadClient || async function() { return null; };

  window.loadClient = async function(clientId) {
    if (!clientId) return null;

    // 1. Obtenir dades base del client (Supabase via app-core)
    let client = await _original(clientId);

    // 2. Si app-core no el troba, intentar directament de Supabase
    if (!client && window.supabase) {
      try {
        const { data, error } = await window.supabase
          .from('clients')
          .select('*')
          .eq('id', clientId)
          .limit(1);
        if (!error && data && data[0]) {
          client = data[0];
        }
      } catch(e) {}
    }

    if (!client) return null;

    // 3. Assegurar camps base
    client.active = client.active !== false ? true : client.active;
    client.photos = client.photos || [];
    client.files  = client.files  || [];
    client.tasks  = client.tasks  || { urgent: '', important: '', later: '' };
    client.notes  = client.notes  || '';
    client.total  = client.total  || 0;
    client.billableTime = client.billableTime || 0;

    // 4. Si ja té fotos/arxius, no cal buscar a IndexedDB
    if (client.photos.length > 0 || client.files.length > 0) return client;

    // 5. Carregar fotos + arxius d'IndexedDB
    const { photos, files } = await _loadFilesFromIndexedDB(clientId);
    if (photos.length > 0) {
      client.photos = photos;
      console.log(`📷 [PATCH] ${photos.length} fotos carregades per "${client.name}"`);
    }
    if (files.length > 0) {
      client.files = files;
      console.log(`📎 [PATCH] ${files.length} arxius carregats per "${client.name}"`);
    }

    return client;
  };

  console.log('✅ [PATCH] loadClient amb fotos/arxius activat');
}

// ─────────────────────────────────────────────
// SOBREESCRIURE updateProjectList
// Elimina el location.reload() de tots els cards
// ─────────────────────────────────────────────
function _patchUpdateProjectList() {
  const _original = window.updateProjectList;
  if (!_original) {
    console.warn('⚠️ [PATCH] updateProjectList no disponible encara, reintentant...');
    return false;
  }

  window.updateProjectList = async function(...args) {
    // Executar la funció original per renderitzar els cards
    await _original.apply(this, args);

    // Ara sobreescriure el onclick de tots els cards per evitar location.reload()
    _fixProjectCardClicks();
  };

  console.log('✅ [PATCH] updateProjectList sense reload activat');
  return true;
}

// ─────────────────────────────────────────────
// FIXAR els onclicks dels cards ja renderitzats
// ─────────────────────────────────────────────
function _fixProjectCardClicks() {
  const container = document.querySelector('#projectList');
  if (!container) return;

  const cards = container.querySelectorAll('.project-card');
  cards.forEach(card => {
    // Clonar per eliminar el onclick original (que fa reload)
    const newCard = card.cloneNode(true);
    
    // Recuperar el client.id del contingut del card
    // S'extreu de l'atribut data-id si existeix, o del log que es va fer
    // Per seguretat, afegim data-id quan es renderitza (vegeu baix)
    const clientId = card.dataset.clientId || newCard.dataset.clientId;
    
    if (clientId) {
      newCard.onclick = async () => {
        console.log('📌 [PATCH] Obrint client:', clientId);
        await _openClientWithoutReload(clientId);
      };
      card.parentNode.replaceChild(newCard, card);
    }
  });
}

// ─────────────────────────────────────────────
// OBRIR CLIENT SENSE RELOAD
// ─────────────────────────────────────────────
async function _openClientWithoutReload(clientId) {
  // Guardar selecció
  state.currentClientId = clientId;
  state.currentActivity = state.currentActivity || (window.ACTIVITIES ? window.ACTIVITIES.WORK : 'work');
  state.sessionElapsed = state.sessionElapsed || 0;
  state.lastTick = Date.now();
  window.isWorkpadInitialized  = false;
  window.areTasksInitialized   = false;

  await (window.save ? window.save() : Promise.resolve());

  // Carregar client complet (amb fotos d'IndexedDB gràcies al patch de loadClient)
  const client = await window.loadClient(clientId);
  if (!client) {
    console.error('[PATCH] Client no trobat:', clientId);
    return;
  }

  // Actualitzar la UI
  await (window.updateUI ? window.updateUI(client) : Promise.resolve());

  // Mostrar panel del client si estava amagat
  const clientInfoPanel  = document.getElementById('clientInfoPanel');
  const clientFixedBtns  = document.getElementById('clientFixedButtons');
  if (clientInfoPanel) clientInfoPanel.style.display = 'block';
  if (clientFixedBtns)  clientFixedBtns.style.display = 'grid';
}

// ─────────────────────────────────────────────
// INTERCEPTAR el renderitzat dels cards per
// afegir data-client-id a cada card
// (necessari perquè _fixProjectCardClicks pugui
//  saber quin client és cada card)
// ─────────────────────────────────────────────
function _patchCardRendering() {
  // Observar quan s'afegeixen cards al #projectList
  const container = document.querySelector('#projectList');
  if (!container) return;

  const observer = new MutationObserver(() => {
    const cards = container.querySelectorAll('.project-card:not([data-patched])');
    cards.forEach(card => {
      // Intentar extreure l'id del client de l'onclick original via toString()
      if (card.onclick) {
        const fn = card.onclick.toString();
        const match = fn.match(/client\.id['"]*\s*[,)=]|['"]([a-zA-Z0-9_-]{10,})['"]/);
        // Si no podem extreure l'id del codi, buscar pel nom
        // Millor estratègia: guardar l'id al dataset quan es renderitza
      }
      card.dataset.patched = 'true';
    });
    _fixProjectCardClicks();
  });

  observer.observe(container, { childList: true, subtree: false });
}

// ─────────────────────────────────────────────
// PATCH PRINCIPAL de updateProjectList per
// afegir data-client-id a cada card DURANT el renderitzat
// ─────────────────────────────────────────────
function _deepPatchUpdateProjectList() {
  // Busquem totes les funcions globals que puguin ser updateProjectList
  const functionsToCheck = [
    'updateProjectList',
    'updateProjectListEnhanced',
    'initializeClientList'
  ];

  functionsToCheck.forEach(fnName => {
    if (typeof window[fnName] === 'function') {
      const _orig = window[fnName];
      window[fnName] = async function(...args) {
        const result = await _orig.apply(this, args);
        
        // Afegir data-client-id a tots els cards que no en tinguin
        const container = document.querySelector('#projectList');
        if (container) {
          const cards = container.querySelectorAll('.project-card');
          // Si els cards no tenen data-client-id, hem de fer-ho diferent:
          // sobreescrivim directament l'onclick de cada card
          cards.forEach(card => {
            if (!card.dataset.clientId && card.onclick) {
              // Reemplaçar l'onclick per la versió sense reload
              const originalOnclick = card.onclick;
              card.onclick = async (e) => {
                // Interceptar: capturar l'id que hauria de passar al reload
                const origSave   = window.save;
                const origReload = location.reload.bind(location);
                
                // Temporalment parchegem location.reload
                let capturedClientId = state.currentClientId;
                const savedReload = Object.getOwnPropertyDescriptor(window.location, 'reload');
                
                // Executar l'onclick original però interceptant el reload
                try {
                  // Guardar clientId antes que l'onclick el canviï
                  const prevId = state.currentClientId;
                  
                  // Sobreescriure save temporalment per capturar l'id
                  window.save = async function() {
                    capturedClientId = state.currentClientId;
                    if (origSave) return origSave();
                  };
                  
                  // Sobreescriure location.reload per evitar-lo
                  window._reloadBlocked = true;
                  
                  await originalOnclick.call(card, e);
                  
                } catch(err) {
                  console.warn('[PATCH] error onclick original:', err);
                } finally {
                  window.save = origSave;
                  window._reloadBlocked = false;
                }
                
                // Ara obrir el client correctament
                if (capturedClientId) {
                  await _openClientWithoutReload(capturedClientId);
                }
              };
            }
          });
        }
        
        return result;
      };
      console.log(`✅ [PATCH] ${fnName} patchejat`);
    }
  });
}

// ─────────────────────────────────────────────
// Interceptar location.reload globalment
// ─────────────────────────────────────────────
(function() {
  const originalReload = location.reload.bind(location);
  Object.defineProperty(window.location, 'reload', {
    configurable: true,
    writable: true,
    value: function() {
      if (window._reloadBlocked) {
        console.log('🛑 [PATCH] location.reload() bloquejat');
        return;
      }
      originalReload();
    }
  });
})();

// ─────────────────────────────────────────────
// INICIALITZACIÓ
// Esperem que app-core.js i app-ui.js estiguin carregats
// ─────────────────────────────────────────────
function _initPatch() {
  _patchLoadClient();
  _deepPatchUpdateProjectList();
  _patchCardRendering();

  // Si ja hi ha un currentClientId guardat, obrir-lo directament
  if (window.state && state.currentClientId) {
    console.log('🔄 [PATCH] Recuperant client actiu al inici:', state.currentClientId);
    setTimeout(async () => {
      const client = await window.loadClient(state.currentClientId);
      if (client && window.updateUI) {
        await window.updateUI(client);
        const clientInfoPanel = document.getElementById('clientInfoPanel');
        const clientFixedBtns = document.getElementById('clientFixedButtons');
        if (clientInfoPanel) clientInfoPanel.style.display = 'block';
        if (clientFixedBtns)  clientFixedBtns.style.display = 'grid';
        console.log('✅ [PATCH] Client actiu restaurat:', client.name);
      }
    }, 500);
  }

  console.log('✅ [PATCH] Tots els patches aplicats');
}

// Executar quan tot estigui carregat
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(_initPatch, 1500));
} else {
  setTimeout(_initPatch, 1500);
}

console.log('✅ [PATCH] Mínim carregat, esperant inicialització...');

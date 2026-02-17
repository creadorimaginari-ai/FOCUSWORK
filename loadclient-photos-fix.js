/*************************************************
 * FOCUSWORK - FIX FOTOS
 * 
 * Assegura que loadClient SEMPRE carrega les fotos
 * de IndexedDB local.
 * 
 * INSTRUCCIONS:
 * Afegir a index.html DESPRÉS de app-core.js:
 * <script src="loadclient-photos-fix.js"></script>
 *************************************************/

(function() {
  'use strict';
  
  console.log('📷 Fix fotos carregant...');
  
  // Esperar que db i loadClient existeixin
  let attempts = 0;
  const wait = setInterval(function() {
    attempts++;
    if (attempts > 100) {
      clearInterval(wait);
      return;
    }
    
    if (!window.db || typeof window.loadClient !== 'function') return;
    
    clearInterval(wait);
    patchLoadClient();
  }, 100);
  
  function patchLoadClient() {
    const _original = window.loadClient;
    
    window.loadClient = async function(clientId) {
      if (!clientId) return null;
      
      // Carregar client (de Supabase o local)
      let client = await _original(clientId);
      if (!client) return null;
      
      // Assegurar active:true
      client.active = true;
      
      // Carregar fotos de IndexedDB
      try {
        const photos = await new Promise(function(resolve) {
          try {
            const tx = window.db.transaction(['photos'], 'readonly');
            const store = tx.objectStore('photos');
            const index = store.index('clientId');
            const req = index.getAll(clientId);
            req.onsuccess = function() { resolve(req.result || []); };
            req.onerror = function() { resolve([]); };
          } catch(e) {
            resolve([]);
          }
        });
        
        client.photos = photos.map(function(p) {
          return {
            id: p.id,
            data: p.data,
            date: p.date,
            comment: p.comment || ''
          };
        });
        
        if (client.photos.length > 0) {
          console.log('📷 ' + client.photos.length + ' fotos per ' + client.name);
        }
      } catch(e) {
        client.photos = client.photos || [];
      }
      
      // Complementar amb dades locals que Supabase no té
      try {
        const local = await new Promise(function(resolve) {
          try {
            const tx = window.db.transaction(['clients'], 'readonly');
            const req = tx.objectStore('clients').get(clientId);
            req.onsuccess = function() { resolve(req.result || null); };
            req.onerror = function() { resolve(null); };
          } catch(e) {
            resolve(null);
          }
        });
        
        if (local) {
          client.total = client.total || local.total || 0;
          client.billableTime = client.billableTime || local.billableTime || 0;
          client.tasks = client.tasks || local.tasks || { urgent:'', important:'', later:'' };
          client.deliveryDate = client.deliveryDate || local.deliveryDate || null;
          client.extraHours = client.extraHours || local.extraHours || [];
        }
      } catch(e) {}
      
      return client;
    };
    
    console.log('✅ loadClient amb fotos activat');
  }
  
})();

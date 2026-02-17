/*
 * PATCH MINIMAL - Només afegeix checkMigration i fotos
 * NO fa rendering propi - deixa que app-ui.js ho gestioni
 */
console.log('🔧 [PATCH] Carregant...');

// Funció que faltava i petava l'app
window.checkMigration = async function() { return true; };

// Sobreescriure loadClient per afegir fotos de IndexedDB
// S'executa DESPRÉS que app-core.js defineixi la seva versió
setTimeout(function() {
  const _originalLoadClient = window.loadClient || async function() { return null; };
  
  window.loadClient = async function(clientId) {
    if (!clientId) return null;
    
    // Obtenir client (Supabase + dades locals de app-core)
    let client = await _originalLoadClient(clientId);
    
    if (!client) return null;
    
    // Assegurar active:true
    client.active = true;
    
    // Si ja té fotos, bé
    if (client.photos && client.photos.length > 0) return client;
    
    // Carregar fotos de IndexedDB si no en té
    try {
      if (window.db) {
        const photos = await new Promise(resolve => {
          try {
            const tx = window.db.transaction(['photos'], 'readonly');
            const req = tx.objectStore('photos').index('clientId').getAll(clientId);
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => resolve([]);
          } catch(e) { resolve([]); }
        });
        client.photos = photos.map(p => ({
          id: p.id, data: p.data, date: p.date, comment: p.comment || ''
        }));
        if (client.photos.length > 0) {
          console.log(`📷 ${client.photos.length} fotos per ${client.name}`);
        }
      }
    } catch(e) {
      client.photos = client.photos || [];
    }
    
    return client;
  };
  
  console.log('✅ [PATCH] loadClient amb fotos activat');
}, 3000);

console.log('✅ [PATCH] Mínim carregat');

/*************************************************
 * FOCUSWORK – supabase-db.js
 * Funcions de base de dades amb Supabase
 * VERSIÓ CORREGIDA - FUNCIONA AMB SUPABASE
 *************************************************/

/* ================= CLIENTS ================= */

// Guardar o actualitzar client
async function saveClientSupabase(client) {
  const user = window.getCurrentUser();
  if (!user) throw new Error('Usuari no autenticat');
  
  // ✅ IMPORTANT: Generar UUID vàlid per Supabase
  const clientData = {
    id: client.id && client.id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i) 
      ? client.id 
      : crypto.randomUUID(), // Generar UUID vàlid
    user_id: user.id,
    name: client.name || '',
    email: client.email || null,
    phone: client.phone || null,
    company: client.company || null,
    notes: client.notes || null,
    status: client.status || 'active',
    activities: client.activities || [],
    tags: client.tags || [],
    custom_fields: client.custom_fields || {}
  };
  
  console.log('💾 Guardant client a Supabase:', clientData);
  
  // Intentar actualitzar primer, si no existeix, insertar
  const { data, error } = await window.supabase
    .from('clients')
    .upsert(clientData, { onConflict: 'id' })
    .select()
    .single();
  
  if (error) {
    console.error('❌ Error guardant client a Supabase:', error);
    throw error;
  }
  
  console.log('✅ Client guardat a Supabase:', data);
  return data;
}

// Carregar un client per ID
async function loadClientSupabase(clientId) {
  const user = window.getCurrentUser();
  if (!user) throw new Error('Usuari no autenticat');
  
  console.log('📥 Carregant client de Supabase:', clientId);
  
  // ✅ Validar que el clientId és un UUID vàlid
  if (!clientId || !clientId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
    console.warn('⚠️ ID no és un UUID vàlid, intentant carregar de local:', clientId);
    return null;
  }
  
  // Carregar client
  const { data: client, error: clientError } = await window.supabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .eq('user_id', user.id)
    .single();
  
  if (clientError) {
    console.error('❌ Error carregant client de Supabase:', clientError);
    return null;
  }
  
  console.log('✅ Client carregat de Supabase:', client);
  
  // Carregar fotos del client (si existeix la taula)
  try {
    const { data: photos, error: photosError } = await window.supabase
      .from('photos')
      .select('*')
      .eq('client_id', clientId)
      .order('date', { ascending: false });
    
    if (!photosError && photos) {
      client.photos = photos;
    } else {
      client.photos = [];
    }
  } catch (e) {
    console.warn('⚠️ Taula photos no existeix, continuant sense fotos');
    client.photos = [];
  }
  
  // Carregar arxius del client (si existeix la taula)
  try {
    const { data: files, error: filesError } = await window.supabase
      .from('files')
      .select('*')
      .eq('client_id', clientId)
      .order('date', { ascending: false });
    
    if (!filesError && files) {
      client.files = files;
    } else {
      client.files = [];
    }
  } catch (e) {
    console.warn('⚠️ Taula files no existeix, continuant sense arxius');
    client.files = [];
  }
  
  return client;
}

// Carregar tots els clients de l'usuari
async function loadAllClientsSupabase() {
  const user = window.getCurrentUser();
  if (!user) throw new Error('Usuari no autenticat');
  
  console.log('📥 Carregant tots els clients de Supabase...');
  
  const { data, error } = await window.supabase
    .from('clients')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('❌ Error carregant clients de Supabase:', error);
    return {};
  }
  
  console.log(`✅ ${data.length} clients carregats de Supabase`);
  
  // Convertir array a objecte amb id com a clau
  const clientsObj = {};
  for (const client of data) {
    // Afegir arrays buides si no existeixen
    client.photos = client.photos || [];
    client.files = client.files || [];
    clientsObj[client.id] = client;
  }
  
  return clientsObj;
}

// Esborrar client
async function deleteClientSupabase(clientId) {
  const user = window.getCurrentUser();
  if (!user) throw new Error('Usuari no autenticat');
  
  console.log('🗑️ Esborrant client de Supabase:', clientId);
  
  const { error } = await window.supabase
    .from('clients')
    .delete()
    .eq('id', clientId)
    .eq('user_id', user.id);
  
  if (error) {
    console.error('❌ Error esborrant client de Supabase:', error);
    throw error;
  }
  
  console.log('✅ Client esborrat de Supabase');
  return true;
}

/* ================= FOTOS ================= */

// Guardar foto
async function savePhotoSupabase(photo, clientId) {
  const user = window.getCurrentUser();
  if (!user) throw new Error('Usuari no autenticat');
  
  const photoData = {
    id: photo.id && photo.id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
      ? photo.id
      : crypto.randomUUID(),
    client_id: clientId,
    user_id: user.id,
    data: photo.data,
    date: photo.date,
    comment: photo.comment || ''
  };
  
  const { data, error } = await window.supabase
    .from('photos')
    .upsert(photoData, { onConflict: 'id' })
    .select()
    .single();
  
  if (error) {
    console.error('❌ Error guardant foto:', error);
    throw error;
  }
  
  return data;
}

// Esborrar foto
async function deletePhotoSupabase(photoId) {
  const user = window.getCurrentUser();
  if (!user) throw new Error('Usuari no autenticat');
  
  const { error } = await window.supabase
    .from('photos')
    .delete()
    .eq('id', photoId)
    .eq('user_id', user.id);
  
  if (error) {
    console.error('❌ Error esborrant foto:', error);
    throw error;
  }
  
  return true;
}

/* ================= ARXIUS (PDFs, vídeos, etc.) ================= */

// Guardar arxiu
async function saveFileSupabase(file, clientId) {
  const user = window.getCurrentUser();
  if (!user) throw new Error('Usuari no autenticat');
  
  const fileData = {
    id: file.id && file.id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
      ? file.id
      : crypto.randomUUID(),
    client_id: clientId,
    user_id: user.id,
    name: file.name,
    type: file.type,
    data: file.data,
    date: file.date
  };
  
  const { data, error } = await window.supabase
    .from('files')
    .upsert(fileData, { onConflict: 'id' })
    .select()
    .single();
  
  if (error) {
    console.error('❌ Error guardant arxiu:', error);
    throw error;
  }
  
  return data;
}

// Esborrar arxiu
async function deleteFileSupabase(fileId) {
  const user = window.getCurrentUser();
  if (!user) throw new Error('Usuari no autenticat');
  
  const { error } = await window.supabase
    .from('files')
    .delete()
    .eq('id', fileId)
    .eq('user_id', user.id);
  
  if (error) {
    console.error('❌ Error esborrant arxiu:', error);
    throw error;
  }
  
  return true;
}

/* ================= FUNCIONS DE SINCRONITZACIÓ ================= */

// Variable global per evitar múltiples execucions
let migrationInProgress = false;
let migrationChecked = false;

// Migrar dades locals a Supabase (només una vegada)
async function migrateLocalToSupabase() {
  if (migrationInProgress) {
    console.log('⚠️ Migració ja en curs, esperant...');
    return;
  }
  
  migrationInProgress = true;
  
  try {
    console.log('🔄 Migrant dades locals a Supabase...');
    
    // Verificar que la base de dades local existeix
    if (typeof window.dbGetAll !== 'function') {
      console.log('ℹ️ No hi ha funcions de IndexedDB disponibles - saltant migració');
      localStorage.setItem('focuswork_migrated_to_supabase', 'no_local_data');
      return;
    }
    
    // Carregar clients locals d'IndexedDB
    let localClients;
    try {
      localClients = await window.dbGetAll('clients');
    } catch (error) {
      console.log('ℹ️ No s\'ha pogut accedir a IndexedDB:', error.message);
      localStorage.setItem('focuswork_migrated_to_supabase', 'no_local_data');
      return;
    }
    
    if (!localClients || localClients.length === 0) {
      console.log('ℹ️ No hi ha clients locals per migrar');
      localStorage.setItem('focuswork_migrated_to_supabase', 'no_local_data');
      return;
    }
    
    console.log(`📦 Migrant ${localClients.length} clients...`);
    
    for (const client of localClients) {
      try {
        // Guardar client a Supabase
        await saveClientSupabase(client);
        
        // Migrar fotos del client
        if (typeof window.dbGetByIndex === 'function') {
          try {
            const localPhotos = await window.dbGetByIndex('photos', 'clientId', client.id);
            if (localPhotos && localPhotos.length > 0) {
              console.log(`📸 Migrant ${localPhotos.length} fotos del client ${client.name}...`);
              for (const photo of localPhotos) {
                await savePhotoSupabase(photo, client.id);
              }
            }
          } catch (error) {
            console.warn('⚠️ Error migrant fotos del client:', client.name, error);
          }
        }
      } catch (error) {
        console.error('❌ Error migrant client:', client.name, error);
      }
    }
    
    console.log('✅ Migració completada!');
    localStorage.setItem('focuswork_migrated_to_supabase', 'true');
    
  } catch (error) {
    console.error('❌ Error durant la migració:', error);
    localStorage.setItem('focuswork_migrated_to_supabase', 'error');
    throw error;
  } finally {
    migrationInProgress = false;
  }
}

// Verificar si cal migrar (NOMÉS UNA VEGADA)
async function checkMigration() {
  // Evitar múltiples execucions
  if (migrationChecked) {
    console.log('ℹ️ Migració ja comprovada anteriorment');
    return;
  }
  
  migrationChecked = true;
  
  const migrated = localStorage.getItem('focuswork_migrated_to_supabase');
  const user = window.getCurrentUser();
  
  console.log('🔍 Estat de migració:', migrated);
  console.log('👤 Usuari actual:', user?.email);
  
  // Si ja s'ha migrat o saltat, no fer res
  if (migrated) {
    console.log('ℹ️ Migració ja gestionada:', migrated);
    return;
  }
  
  // Si no hi ha usuari, no fer res
  if (!user) {
    console.log('⚠️ No hi ha usuari autenticat - saltant migració');
    return;
  }
  
  // Preguntar només una vegada
  try {
    const shouldMigrate = confirm(
      '🔄 Vols migrar les teves dades locals al núvol?\n\n' +
      'Això permetrà sincronitzar-les entre dispositius.\n\n' +
      'Les dades locals no s\'esborraran.'
    );
    
    if (shouldMigrate) {
      await migrateLocalToSupabase();
      alert('✅ Dades migrades correctament!');
    } else {
      console.log('ℹ️ Usuari ha saltat la migració');
      localStorage.setItem('focuswork_migrated_to_supabase', 'skipped');
    }
  } catch (error) {
    console.error('❌ Error durant checkMigration:', error);
    localStorage.setItem('focuswork_migrated_to_supabase', 'error');
  }
}

// Exportar funcions
window.saveClientSupabase = saveClientSupabase;
window.loadClientSupabase = loadClientSupabase;
window.loadAllClientsSupabase = loadAllClientsSupabase;
window.deleteClientSupabase = deleteClientSupabase;
window.savePhotoSupabase = savePhotoSupabase;
window.deletePhotoSupabase = deletePhotoSupabase;
window.saveFileSupabase = saveFileSupabase;
window.deleteFileSupabase = deleteFileSupabase;
window.migrateLocalToSupabase = migrateLocalToSupabase;
window.checkMigration = checkMigration;

console.log('✅ Funcions de base de dades Supabase carregades (VERSIÓ CORREGIDA)');

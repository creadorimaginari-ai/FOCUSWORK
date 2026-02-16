/*************************************************
 * FOCUSWORK — supabase-db.js
 * Funcions de base de dades amb Supabase
 *************************************************/

/* ================= CLIENTS ================= */

// Guardar o actualitzar client
async function saveClientSupabase(client) {
  const user = window.getCurrentUser();
  if (!user) throw new Error('Usuari no autenticat');
  
  // Afegir user_id al client
  const clientData = {
    ...client,
    user_id: user.id
  };
  
  // Intentar actualitzar primer, si no existeix, insertar
  const { data, error } = await supabase
    .from('clients')
    .upsert(clientData, { onConflict: 'id' })
    .select()
    .single();
  
  if (error) {
    console.error('Error guardant client:', error);
    throw error;
  }
  
  return data;
}

// Carregar un client per ID
async function loadClientSupabase(clientId) {
  const user = window.getCurrentUser();
  if (!user) throw new Error('Usuari no autenticat');
  
  // Carregar client
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .eq('user_id', user.id)
    .single();
  
  if (clientError) {
    console.error('Error carregant client:', clientError);
    return null;
  }
  
  // Carregar fotos del client
  const { data: photos, error: photosError } = await supabase
    .from('photos')
    .select('*')
    .eq('client_id', clientId)
    .order('date', { ascending: false });
  
  if (!photosError && photos) {
    client.photos = photos;
  } else {
    client.photos = [];
  }
  
  // Carregar arxius del client
  const { data: files, error: filesError } = await supabase
    .from('files')
    .select('*')
    .eq('client_id', clientId)
    .order('date', { ascending: false });
  
  if (!filesError && files) {
    client.files = files;
  } else {
    client.files = [];
  }
  
  return client;
}

// Carregar tots els clients de l'usuari
async function loadAllClientsSupabase() {
  const user = window.getCurrentUser();
  if (!user) throw new Error('Usuari no autenticat');
  
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error carregant clients:', error);
    return {};
  }
  
  // Convertir array a objecte amb id com a clau
  const clientsObj = {};
  for (const client of data) {
    clientsObj[client.id] = client;
  }
  
  return clientsObj;
}

// Esborrar client
async function deleteClientSupabase(clientId) {
  const user = window.getCurrentUser();
  if (!user) throw new Error('Usuari no autenticat');
  
  const { error } = await supabase
    .from('clients')
    .delete()
    .eq('id', clientId)
    .eq('user_id', user.id);
  
  if (error) {
    console.error('Error esborrant client:', error);
    throw error;
  }
  
  return true;
}

/* ================= FOTOS ================= */

// Guardar foto
async function savePhotoSupabase(photo, clientId) {
  const user = window.getCurrentUser();
  if (!user) throw new Error('Usuari no autenticat');
  
  const photoData = {
    ...photo,
    client_id: clientId,
    user_id: user.id
  };
  
  const { data, error } = await supabase
    .from('photos')
    .upsert(photoData, { onConflict: 'id' })
    .select()
    .single();
  
  if (error) {
    console.error('Error guardant foto:', error);
    throw error;
  }
  
  return data;
}

// Esborrar foto
async function deletePhotoSupabase(photoId) {
  const user = window.getCurrentUser();
  if (!user) throw new Error('Usuari no autenticat');
  
  const { error } = await supabase
    .from('photos')
    .delete()
    .eq('id', photoId)
    .eq('user_id', user.id);
  
  if (error) {
    console.error('Error esborrant foto:', error);
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
    ...file,
    client_id: clientId,
    user_id: user.id
  };
  
  const { data, error } = await supabase
    .from('files')
    .upsert(fileData, { onConflict: 'id' })
    .select()
    .single();
  
  if (error) {
    console.error('Error guardant arxiu:', error);
    throw error;
  }
  
  return data;
}

// Esborrar arxiu
async function deleteFileSupabase(fileId) {
  const user = window.getCurrentUser();
  if (!user) throw new Error('Usuari no autenticat');
  
  const { error } = await supabase
    .from('files')
    .delete()
    .eq('id', fileId)
    .eq('user_id', user.id);
  
  if (error) {
    console.error('Error esborrant arxiu:', error);
    throw error;
  }
  
  return true;
}

/* ================= FUNCIONS DE SINCRONITZACIÓ ================= */

// Migrar dades locals a Supabase (només una vegada)
async function migrateLocalToSupabase() {
  console.log('🔄 Migrant dades locals a Supabase...');
  
  try {
    // Carregar clients locals d'IndexedDB
    const localClients = await dbGetAll('clients');
    
    if (!localClients || localClients.length === 0) {
      console.log('ℹ️ No hi ha clients locals per migrar');
      return;
    }
    
    console.log(`📦 Migrant ${localClients.length} clients...`);
    
    for (const client of localClients) {
      // Guardar client a Supabase
      await saveClientSupabase(client);
      
      // Migrar fotos del client
      const localPhotos = await dbGetByIndex('photos', 'clientId', client.id);
      if (localPhotos && localPhotos.length > 0) {
        console.log(`📸 Migrant ${localPhotos.length} fotos del client ${client.name}...`);
        for (const photo of localPhotos) {
          await savePhotoSupabase(photo, client.id);
        }
      }
    }
    
    console.log('✅ Migració completada!');
    
    // Marcar que ja s'ha migrat
    localStorage.setItem('focowork_migrated_to_supabase', 'true');
    
  } catch (error) {
    console.error('❌ Error migrant dades:', error);
    throw error;
  }
}

// Verificar si cal migrar
async function checkMigration() {
  const migrated = localStorage.getItem('focowork_migrated_to_supabase');
  
  if (!migrated && window.getCurrentUser()) {
    const shouldMigrate = confirm(
      '🔄 Vols migrar les teves dades locals al núvol?\n\n' +
      'Això permetrà sincronitzar-les entre dispositius.\n\n' +
      'Les dades locals no s\'esborraran.'
    );
    
    if (shouldMigrate) {
      await migrateLocalToSupabase();
      alert('✅ Dades migrades correctament!');
    } else {
      localStorage.setItem('focowork_migrated_to_supabase', 'skipped');
    }
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

console.log('✅ Funcions de base de dades Supabase carregades');

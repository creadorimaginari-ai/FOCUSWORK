/*************************************************
 * FOCUSWORK — app-db.js
 * Gestió d'IndexedDB per fotos
 *************************************************/

// Evitar redeclaració si ja està definit
if (typeof window.DB_NAME === 'undefined') {
  window.DB_NAME = 'FocusWorkDB';
  window.DB_VERSION = 1;
  window.db = null;
}

// Inicialitzar IndexedDB
async function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(window.DB_NAME, window.DB_VERSION);
    
    request.onerror = () => {
      console.error('❌ Error obrint IndexedDB:', request.error);
      reject(request.error);
    };
    
    request.onsuccess = () => {
      window.db = request.result;
      console.log('✅ IndexedDB inicialitzada correctament');
      resolve(window.db);
    };
    
    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      
      // Crear object store per fotos si no existeix
      if (!database.objectStoreNames.contains('photos')) {
        const photosStore = database.createObjectStore('photos', { keyPath: 'id' });
        photosStore.createIndex('clientId', 'clientId', { unique: false });
        photosStore.createIndex('date', 'date', { unique: false });
        console.log('✅ Object store "photos" creat');
      }
    };
  });
}

// Guardar objecte a IndexedDB
async function dbPut(storeName, data) {
  if (!window.db) await initDB();
  
  return new Promise((resolve, reject) => {
    try {
      const transaction = window.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(data);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    } catch (error) {
      reject(error);
    }
  });
}

// Obtenir objecte per ID
async function dbGet(storeName, id) {
  if (!window.db) await initDB();
  
  return new Promise((resolve, reject) => {
    try {
      const transaction = window.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(id);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    } catch (error) {
      reject(error);
    }
  });
}

// Obtenir tots els objectes (opcionalment filtrats per clientId)
async function dbGetAll(storeName, clientId = null) {
  if (!window.db) await initDB();
  
  return new Promise((resolve, reject) => {
    try {
      const transaction = window.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      
      let request;
      if (clientId && store.indexNames.contains('clientId')) {
        const index = store.index('clientId');
        request = index.getAll(clientId);
      } else {
        request = store.getAll();
      }
      
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    } catch (error) {
      reject(error);
    }
  });
}

// Eliminar objecte per ID
async function dbDelete(storeName, id) {
  if (!window.db) await initDB();
  
  return new Promise((resolve, reject) => {
    try {
      const transaction = window.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(id);
      
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    } catch (error) {
      reject(error);
    }
  });
}

// Exportar funcions
window.dbPut = dbPut;
window.dbGet = dbGet;
window.dbGetAll = dbGetAll;
window.dbDelete = dbDelete;
window.initDB = initDB;

console.log('✅ app-db.js carregat correctament');

// Inicialitzar automàticament només si no està ja inicialitzat
if (!window.db) {
  initDB().catch(err => console.error('❌ Error inicialitzant IndexedDB:', err));
}

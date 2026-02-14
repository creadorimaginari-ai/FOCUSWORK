/*************************************************
 * FOCUSWORK — app-db.js
 * Gestió d'IndexedDB per fotos
 *************************************************/

// Variables globals - declarar solo una vez
var DB_NAME, DB_VERSION, db;

if (typeof DB_NAME === 'undefined') {
  DB_NAME = 'FocusWorkDB';
  DB_VERSION = 1;
  db = null;
}

// Inicialitzar IndexedDB
async function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => {
      console.error('❌ Error obrint IndexedDB:', request.error);
      reject(request.error);
    };
    
    request.onsuccess = () => {
      db = request.result;
      window.db = db; // També fer-lo accessible via window
      console.log('✅ IndexedDB inicialitzada correctament');
      resolve(db);
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
  if (!db) await initDB();
  
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction([storeName], 'readwrite');
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
  if (!db) await initDB();
  
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction([storeName], 'readonly');
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
  if (!db) await initDB();
  
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction([storeName], 'readonly');
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
  if (!db) await initDB();
  
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction([storeName], 'readwrite');
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

// Inicialitzar automàticament
initDB().catch(err => console.error('❌ Error inicialitzant IndexedDB:', err));

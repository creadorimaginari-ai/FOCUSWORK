/*************************************************
 * FOCUSWORK — supabase-config.js
 * Configuració de connexió amb Supabase
 *************************************************/

// Credencials del teu projecte Supabase
const SUPABASE_URL = 'https://mhqdpslvowosxabuxcgw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ocWRwc2x2b3dvc3hhYnV4Y2d3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyMjMxOTQsImV4cCI6MjA4Njc5OTE5NH0.vMUW6qOV69DJJ0snaOIPgwiZo9TGGn3rPPNfESay48I';

// Crear client de Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Variable global per saber si l'usuari està autenticat
let currentUser = null;

// Inicialitzar estat d'autenticació
async function initAuth() {
  try {
    console.log('🔐 Inicialitzant autenticació amb Supabase...');
    
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('❌ Error obtenint sessió:', error.message);
      console.error('Detalls:', error);
      throw error;
    }
    
    if (session) {
      currentUser = session.user;
      console.log('✅ Usuari autenticat:', currentUser.email);
      return currentUser;
    } else {
      console.log('👤 Cap usuari autenticat');
      return null;
    }
  } catch (error) {
    console.error('❌ Error crític a initAuth:', error);
    throw error;
  }
}

// Escoltar canvis d'autenticació
supabase.auth.onAuthStateChange((event, session) => {
  console.log('🔄 Event d\'autenticació:', event);
  
  if (event === 'SIGNED_IN') {
    currentUser = session.user;
    console.log('✅ Login exitós:', currentUser.email);
    
    // Amagar pantalla de login
    if (typeof hideLoginScreen === 'function') {
      hideLoginScreen();
    }
    
    // Recarregar app després del login
    if (typeof initApp === 'function') {
      console.log('🔄 Reiniciant app després del login...');
      initApp();
    }
  } else if (event === 'SIGNED_OUT') {
    currentUser = null;
    console.log('🚪 Logout exitós');
    
    // Mostrar pantalla de login
    if (typeof showLoginScreen === 'function') {
      showLoginScreen();
    }
  } else if (event === 'USER_UPDATED') {
    console.log('👤 Usuari actualitzat');
  } else if (event === 'TOKEN_REFRESHED') {
    console.log('🔄 Token refrescat');
  }
});

// Exportar configuració
window.supabase = supabase;
window.getCurrentUser = () => currentUser;
window.initAuth = initAuth;

console.log('✅ Supabase configurat correctament');
console.log('📍 URL:', SUPABASE_URL);
console.log('🔑 API Key configurada');

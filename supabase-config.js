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
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    currentUser = session.user;
    console.log('✅ Usuari autenticat:', currentUser.email);
    return currentUser;
  } else {
    console.log('❌ Usuari no autenticat');
    return null;
  }
}

// Escoltar canvis d'autenticació
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN') {
    currentUser = session.user;
    console.log('✅ Login exitós:', currentUser.email);
    // Recarregar app després del login
    if (typeof initApp === 'function') {
      initApp();
    }
  } else if (event === 'SIGNED_OUT') {
    currentUser = null;
    console.log('❌ Logout exitós');
    // Mostrar pantalla de login
    showLoginScreen();
  }
});

// Exportar configuració
window.supabase = supabase;
window.getCurrentUser = () => currentUser;
window.initAuth = initAuth;

console.log('✅ Supabase configurat correctament');

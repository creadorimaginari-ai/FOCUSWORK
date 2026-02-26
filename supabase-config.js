/*************************************************
 * FOCUSWORK — supabase-config.js
 * Configuració de connexió amb Supabase
 * VERSIÓ SIMPLIFICADA I ROBUSTA
 *************************************************/

(function() {
  'use strict';
  
  console.log('📦 Carregant configuració de Supabase...');
  
  // Esperar que window.supabase (del CDN) estigui disponible
  function initSupabaseConfig() {
    // Verificar que el CDN s'hagi carregat
    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
      console.error('❌ La llibreria Supabase no està disponible!');
      console.error('Assegura\'t que el CDN estigui carregat abans:');
      console.error('<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>');
      return false;
    }
    
    console.log('✅ Llibreria Supabase detectada');
    
    // Credencials
    const SUPABASE_URL = 'https://mhqdpslvowosxabuxcgw.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ocWRwc2x2b3dvc3hhYnV4Y2d3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyMjMxOTQsImV4cCI6MjA4Njc5OTE5NH0.vMUW6qOV69DJJ0snaOIPgwiZo9TGGn3rPPNfESay48I';
    
    // Crear client (NO usar const per evitar conflictes, sobrescriure window.supabase)
    try {
      window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      console.log('✅ Client Supabase creat');
      console.log('📍 URL:', SUPABASE_URL);
    } catch (error) {
      console.error('❌ Error creant client:', error);
      return false;
    }
    
    // Variable per l'usuari actual
    let currentUser = null;
    let appInitializing = false; // 🔒 Guard anti-bucle
    
    // Funció d'inicialització d'auth
    window.initAuth = async function() {
      try {
        console.log('🔐 Inicialitzant autenticació...');
        
        const { data: { session }, error } = await window.supabase.auth.getSession();
        
        if (error) {
          console.error('❌ Error obtenint sessió:', error);
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
        console.error('❌ Error a initAuth:', error);
        throw error;
      }
    };
    
    // Getter per obtenir l'usuari actual
    window.getCurrentUser = function() {
      return currentUser;
    };
    
    // Escoltar canvis d'autenticació
    window.supabase.auth.onAuthStateChange((event, session) => {
      console.log('🔄 Event auth:', event);
      
      if (event === 'SIGNED_IN') {
        currentUser = session.user;
        console.log('✅ Login exitós:', currentUser.email);

        // 🔒 Evitar bucle: si ja s'està inicialitzant, no tornar a cridar initApp
        if (appInitializing) {
          console.log('⚠️ initApp ja en curs, ignorant SIGNED_IN duplicat');
          return;
        }
        appInitializing = true;
        
        if (typeof window.hideLoginScreen === 'function') {
          window.hideLoginScreen();
        }
        
        if (typeof window.initApp === 'function') {
          window.initApp().finally(() => { appInitializing = false; });
        }

        // ✅ REALTIME: iniciar sincronització en temps real
        setTimeout(() => {
          if (typeof window.initRealtimeSync === 'function') {
            window.initRealtimeSync();
          }
        }, 1500); // petit delay per assegurar que initApp hagi acabat

      } else if (event === 'SIGNED_OUT') {
        currentUser = null;
        console.log('🚪 Logout exitós');
        
        // ✅ REALTIME: aturar sincronització
        if (typeof window.stopRealtimeSync === 'function') {
          window.stopRealtimeSync();
        }

        if (typeof window.showLoginScreen === 'function') {
          window.showLoginScreen();
        }
      }
    });
    
    console.log('✅ Configuració Supabase completada');
    return true;
  }
  
  // Executar configuració
  if (document.readyState === 'loading') {
    // Si el document encara s'està carregant, esperar
    document.addEventListener('DOMContentLoaded', initSupabaseConfig);
  } else {
    // Si ja està carregat, executar ara
    initSupabaseConfig();
  }
  
})();

/*************************************************
 * FOCUSWORK — supabase-config.js
 *************************************************/

(function() {
  'use strict';

  const isOffline = localStorage.getItem('fw_offline_mode') === 'true';

  /* ── MODE OFFLINE: proxy fals, cap petició de xarxa ── */
  if (isOffline) {
    console.log('📴 Mode offline — Supabase desactivat completament');

    // Promise que sempre resol buit
    const ok   = (val) => Promise.resolve({ data: val, error: null });
    const okArr = () => ok([]);
    const okNull = () => ok(null);

    // Builder de queries encadenables que sempre resolen buit
    function noopBuilder() {
      const b = {
        select:  () => noopBuilder(),
        insert:  () => noopBuilder(),
        update:  () => noopBuilder(),
        upsert:  () => noopBuilder(),
        delete:  () => noopBuilder(),
        eq:      () => noopBuilder(),
        neq:     () => noopBuilder(),
        in:      () => noopBuilder(),
        order:   () => noopBuilder(),
        limit:   () => noopBuilder(),
        single:  () => okNull(),
        // Fer que el builder sigui awaitable (retorna { data: [], error: null })
        then:    (resolve, reject) => okArr().then(resolve, reject),
        catch:   (fn) => okArr().catch(fn),
      };
      return b;
    }

    window.supabase = {
      from:    () => noopBuilder(),
      rpc:     () => noopBuilder(),
      auth: {
        getSession:          () => ok({ session: null }),
        getUser:             () => ok({ user: null }),
        signInWithPassword:  () => Promise.resolve({ data: null, error: { message: 'offline' } }),
        signOut:             () => Promise.resolve({ error: null }),
        onAuthStateChange:   (cb) => {
          setTimeout(() => cb('INITIAL_SESSION', null), 0);
          return { data: { subscription: { unsubscribe: () => {} } } };
        },
      },
      storage: {
        from: () => ({
          upload:       () => Promise.resolve({ error: null }),
          getPublicUrl: () => ({ data: { publicUrl: '' } }),
        }),
      },
      channel:   () => ({ on: () => ({ subscribe: () => {} }) }),
      removeChannel: () => {},
      // Bloquejar createClient perquè no es sobreescrigui
      createClient: () => window.supabase,
    };

    // Definir getCurrentUser i getCurrentUserId per mode offline
    window.getCurrentUser = function() {
      try {
        const u = JSON.parse(localStorage.getItem('fw_offline_user') || '{}');
        const realId = localStorage.getItem('fw_real_user_id');
        if (realId) u.id = realId;
        return u.id ? u : { id: 'offline-user', email: 'offline@local' };
      } catch(e) {
        return { id: 'offline-user', email: 'offline@local' };
      }
    };
    window.getCurrentUserId = function() {
      return localStorage.getItem('fw_real_user_id') || 'offline-user';
    };

    console.log('✅ Proxy Supabase offline instal·lat');
    return; // ← sortir aquí, no inicialitzar Supabase real
  }

  /* ── MODE NORMAL: inicialitzar Supabase real ── */
  console.log('📦 Carregant configuració de Supabase...');

  function initSupabaseConfig() {
    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
      console.error('❌ La llibreria Supabase no està disponible!');
      return false;
    }

    console.log('✅ Llibreria Supabase detectada');

    const SUPABASE_URL = 'https://mhqdpslvowosxabuxcgw.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ocWRwc2x2b3dvc3hhYnV4Y2d3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyMjMxOTQsImV4cCI6MjA4Njc5OTE5NH0.vMUW6qOV69DJJ0snaOIPgwiZo9TGGn3rPPNfESay48I';

    try {
      window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      console.log('✅ Client Supabase creat');
    } catch (error) {
      console.error('❌ Error creant client:', error);
      return false;
    }

    let currentUser = null;

    window.initAuth = async function() {
      try {
        console.log('🔐 Inicialitzant autenticació...');
        const { data: { session }, error } = await window.supabase.auth.getSession();
        if (error) throw error;
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

    window.getCurrentUser   = function() { return currentUser; };
    window.getCurrentUserId = function() { return currentUser?.id || null; };

    window.supabase.auth.onAuthStateChange((event, session) => {
      console.log('🔄 Event auth:', event);
      if (event === 'SIGNED_IN') {
        currentUser = session.user;
        console.log('✅ Login exitós:', currentUser.email);
        if (typeof window.hideLoginScreen === 'function') window.hideLoginScreen();
        if (typeof window.initApp === 'function') window.initApp();
        setTimeout(() => {
          if (typeof window.initRealtimeSync === 'function') window.initRealtimeSync();
        }, 1500);
      } else if (event === 'SIGNED_OUT') {
        currentUser = null;
        if (typeof window.stopRealtimeSync === 'function') window.stopRealtimeSync();
        if (typeof window.showLoginScreen === 'function') window.showLoginScreen();
      }
    });

    console.log('✅ Configuració Supabase completada');
    return true;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSupabaseConfig);
  } else {
    initSupabaseConfig();
  }

})();

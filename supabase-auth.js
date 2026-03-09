/*************************************************
 * FOCUSWORK — supabase-auth.js
 * Sistema d'autenticació amb Supabase
 *************************************************/

/* ================= initAuth ================= */
// Funció que espera app-core.js. Gestiona online i offline.
async function initAuth() {
  const offline = !navigator.onLine || typeof window.supabase === 'undefined';

  if (offline) {
    console.log('📴 initAuth: mode offline — bypass Supabase');
    // Intentar recuperar sessió guardada
    try {
      const saved = localStorage.getItem('focuswork_offline_session');
      if (saved) {
        const parsed = JSON.parse(saved);
        const user = parsed?.user || null;
        if (user) {
          console.log('✅ Sessió offline restaurada:', user.email);
          window.getCurrentUser = () => user;
          return user;
        }
      }
    } catch(e) { /* res */ }

    // Sense sessió guardada → bypass igualment (IndexedDB pot estar buit o tenir dades)
    console.log('📴 Sense sessió guardada — entrant en mode offline pur');
    window.getCurrentUser = () => ({ email: 'offline', id: 'offline' });
    return { email: 'offline', id: 'offline' };
  }

  // ── MODE ONLINE ──
  return new Promise((resolve) => {
    let resolved = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (resolved) return;
      if (session?.user) {
        resolved = true;
        subscription.unsubscribe();
        // Guardar sessió per ús offline futur
        try {
          localStorage.setItem('focuswork_offline_session', JSON.stringify({ user: { email: session.user.email, id: session.user.id } }));
        } catch(e) { /* localStorage ple */ }
        resolve(session.user);
      }
    });

    // Comprovar sessió existent
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (resolved) return;
      if (session?.user) {
        resolved = true;
        subscription.unsubscribe();
        try {
          localStorage.setItem('focuswork_offline_session', JSON.stringify({ user: { email: session.user.email, id: session.user.id } }));
        } catch(e) { /* localStorage ple */ }
        resolve(session.user);
      } else {
        // No hi ha sessió → retornar null perquè app-core mostri login
        resolved = true;
        subscription.unsubscribe();
        resolve(null);
      }
    });

    // Safety timeout per Safari/iPad (3s)
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        subscription.unsubscribe();
        resolve(null);
      }
    }, 3000);
  });
}

window.initAuth = initAuth;

/* ================= FUNCIONS D'AUTENTICACIÓ ================= */

// Registrar nou usuari
async function signUp(email, password, name) {
  const { data, error } = await supabase.auth.signUp({
    email: email,
    password: password,
    options: {
      data: {
        name: name
      }
    }
  });
  
  if (error) {
    console.error('Error registrant usuari:', error);
    throw error;
  }
  
  return data;
}

// Fer login
async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email,
    password: password
  });
  
  if (error) {
    console.error('Error fent login:', error);
    throw error;
  }
  
  return data;
}

// Fer logout
async function signOut() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error('Error fent logout:', error);
    throw error;
  }

  // ✅ FIX: Netejar TOTA la informació de l'usuari anterior
  // Sense això, al canviar d'usuari es veu brevament la info de l'anterior
  try {
    // Reset estat global
    if (typeof state !== 'undefined') {
      state.currentClientId = null;
      state.clients = {};
      state.isFull = false;
      state.license = null;
      state.currentActivity = null;
      state.sessionElapsed = 0;
    }
    // Buidar cache de clients
    if (typeof invalidateClientsCache === 'function') {
      invalidateClientsCache();
    }
    // Netejar fotos en memòria
    if (typeof window !== 'undefined') {
      window.currentClientPhotos = [];
    }
    // Netejar UI: amagar panell client
    const clientInfoPanel = document.getElementById('clientInfoPanel');
    const activitiesPanel = document.getElementById('activitiesPanel');
    if (clientInfoPanel) clientInfoPanel.style.display = 'none';
    if (activitiesPanel) activitiesPanel.style.display = 'none';
  } catch(e) {
    console.warn('Error netejant estat:', e);
  }

  // Mostrar login
  if (typeof showLoginScreen === 'function') showLoginScreen();

  return true;
}

// Recuperar contrasenya
async function resetPassword(email) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin
  });
  
  if (error) {
    console.error('Error enviant email:', error);
    throw error;
  }
  
  return data;
}

/* ================= PANTALLA DE LOGIN ================= */

function showLoginScreen() {
  // Ocultar app principal
  const app = document.querySelector('.app');
  if (app) app.style.display = 'none';

  // Eliminar pantalla login anterior si existeix
  const oldLogin = document.getElementById('loginScreen');
  if (oldLogin) oldLogin.remove();

  const isOffline = !navigator.onLine || typeof window.supabase === 'undefined';

  // Crear pantalla de login
  const loginScreen = document.createElement('div');
  loginScreen.id = 'loginScreen';
  loginScreen.style.cssText = `
    position: fixed;
    inset: 0;
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  `;

  loginScreen.innerHTML = `
    <div style="
      background: rgba(30, 41, 59, 0.95);
      backdrop-filter: blur(10px);
      border-radius: 20px;
      padding: 40px;
      max-width: 400px;
      width: 90%;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
      border: 1px solid rgba(255, 255, 255, 0.1);
    ">
      <!-- Logo / Títol -->
      <div style="text-align: center; margin-bottom: 32px;">
        <h1 style="
          font-size: 32px;
          font-weight: 700;
          color: #e2e8f0;
          margin: 0 0 8px 0;
        ">FocusWork</h1>
        <p style="
          font-size: 14px;
          color: #94a3b8;
          margin: 0;
        ">Gestiona els teus projectes</p>
      </div>

      ${isOffline ? `
      <!-- Banner offline -->
      <div style="
        margin-bottom: 20px;
        padding: 12px 16px;
        background: rgba(251, 146, 60, 0.15);
        border: 1px solid rgba(251, 146, 60, 0.4);
        border-radius: 10px;
        color: #fdba74;
        font-size: 13px;
        text-align: center;
        line-height: 1.5;
      ">
        📴 <strong>Mode offline</strong><br>
        Sense connexió a internet. Pots entrar igualment per accedir a les teves dades locals o restaurar una còpia de seguretat.
      </div>
      ` : ''}

      <!-- Pestanyes -->
      <div style="
        display: flex;
        gap: 8px;
        margin-bottom: 24px;
        background: rgba(15, 23, 42, 0.5);
        border-radius: 12px;
        padding: 4px;
      ">
        <button id="tabLogin" onclick="switchTab('login')" style="
          flex: 1;
          padding: 12px;
          border: none;
          border-radius: 8px;
          background: rgba(59, 130, 246, 1);
          color: white;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        ">Login</button>
        <button id="tabRegister" onclick="switchTab('register')" style="
          flex: 1;
          padding: 12px;
          border: none;
          border-radius: 8px;
          background: transparent;
          color: #94a3b8;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        ">Registrar-se</button>
      </div>

      <!-- Formulari Login -->
      <div id="loginForm" style="display: block;">
        <div style="margin-bottom: 16px;">
          <label style="
            display: block;
            font-size: 14px;
            font-weight: 500;
            color: #e2e8f0;
            margin-bottom: 8px;
          ">Email</label>
          <input type="email" id="loginEmail" placeholder="nom@example.com" style="
            width: 100%;
            padding: 12px 16px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            background: rgba(15, 23, 42, 0.5);
            color: #e2e8f0;
            font-size: 16px;
            outline: none;
            transition: all 0.2s;
          ">
        </div>

        <div style="margin-bottom: 24px;">
          <label style="
            display: block;
            font-size: 14px;
            font-weight: 500;
            color: #e2e8f0;
            margin-bottom: 8px;
          ">Contrasenya</label>
          <input type="password" id="loginPassword" placeholder="••••••••" style="
            width: 100%;
            padding: 12px 16px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            background: rgba(15, 23, 42, 0.5);
            color: #e2e8f0;
            font-size: 16px;
            outline: none;
            transition: all 0.2s;
          ">
        </div>

        <button onclick="handleLogin()" style="
          width: 100%;
          padding: 14px;
          border: none;
          border-radius: 8px;
          background: linear-gradient(135deg, #3b82f6, #2563eb);
          color: white;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          margin-bottom: 12px;
        ">${isOffline ? '📴 Entrar (mode offline)' : 'Entrar'}</button>

        ${!isOffline ? `
        <button onclick="showResetPassword()" style="
          width: 100%;
          padding: 12px;
          border: none;
          background: transparent;
          color: #94a3b8;
          font-size: 14px;
          cursor: pointer;
        ">He oblidat la contrasenya</button>
        ` : ''}
      </div>

      <!-- Formulari Registre -->
      <div id="registerForm" style="display: none;">
        <div style="margin-bottom: 16px;">
          <label style="
            display: block;
            font-size: 14px;
            font-weight: 500;
            color: #e2e8f0;
            margin-bottom: 8px;
          ">Nom</label>
          <input type="text" id="registerName" placeholder="El teu nom" style="
            width: 100%;
            padding: 12px 16px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            background: rgba(15, 23, 42, 0.5);
            color: #e2e8f0;
            font-size: 16px;
            outline: none;
          ">
        </div>

        <div style="margin-bottom: 16px;">
          <label style="
            display: block;
            font-size: 14px;
            font-weight: 500;
            color: #e2e8f0;
            margin-bottom: 8px;
          ">Email</label>
          <input type="email" id="registerEmail" placeholder="nom@example.com" style="
            width: 100%;
            padding: 12px 16px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            background: rgba(15, 23, 42, 0.5);
            color: #e2e8f0;
            font-size: 16px;
            outline: none;
          ">
        </div>

        <div style="margin-bottom: 24px;">
          <label style="
            display: block;
            font-size: 14px;
            font-weight: 500;
            color: #e2e8f0;
            margin-bottom: 8px;
          ">Contrasenya</label>
          <input type="password" id="registerPassword" placeholder="Mínim 6 caràcters" style="
            width: 100%;
            padding: 12px 16px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            background: rgba(15, 23, 42, 0.5);
            color: #e2e8f0;
            font-size: 16px;
            outline: none;
          ">
        </div>

        <button onclick="handleRegister()" style="
          width: 100%;
          padding: 14px;
          border: none;
          border-radius: 8px;
          background: linear-gradient(135deg, #3b82f6, #2563eb);
          color: white;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        ">Crear compte</button>
      </div>

      <!-- Missatge d'error -->
      <div id="authError" style="
        display: none;
        margin-top: 16px;
        padding: 12px;
        background: rgba(239, 68, 68, 0.1);
        border: 1px solid rgba(239, 68, 68, 0.3);
        border-radius: 8px;
        color: #fca5a5;
        font-size: 14px;
        text-align: center;
      "></div>

      <!-- Missatge d'èxit -->
      <div id="authSuccess" style="
        display: none;
        margin-top: 16px;
        padding: 12px;
        background: rgba(34, 197, 94, 0.1);
        border: 1px solid rgba(34, 197, 94, 0.3);
        border-radius: 8px;
        color: #86efac;
        font-size: 14px;
        text-align: center;
      "></div>
    </div>
  `;

  document.body.appendChild(loginScreen);
}

function hideLoginScreen() {
  const loginScreen = document.getElementById('loginScreen');
  if (loginScreen) loginScreen.remove();

  const app = document.querySelector('.app');
  if (app) app.style.display = 'block';

  // ✅ FIX: Reiniciar app per al nou usuari — netejar qualsevol residu
  try {
    if (typeof state !== 'undefined') {
      state.currentClientId = null;
      state.clients = {};
    }
    if (typeof invalidateClientsCache === 'function') invalidateClientsCache();
    if (typeof updateUI === 'function') updateUI();
    if (typeof loadState === 'function') loadState();
  } catch(e) {
    console.warn('Error reiniciant per nou usuari:', e);
  }
}

function switchTab(tab) {
  const tabLogin = document.getElementById('tabLogin');
  const tabRegister = document.getElementById('tabRegister');
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const authError = document.getElementById('authError');
  const authSuccess = document.getElementById('authSuccess');
  
  // Ocultar missatges
  if (authError) authError.style.display = 'none';
  if (authSuccess) authSuccess.style.display = 'none';
  
  if (tab === 'login') {
    tabLogin.style.background = 'rgba(59, 130, 246, 1)';
    tabLogin.style.color = 'white';
    tabRegister.style.background = 'transparent';
    tabRegister.style.color = '#94a3b8';
    loginForm.style.display = 'block';
    registerForm.style.display = 'none';
  } else {
    tabRegister.style.background = 'rgba(59, 130, 246, 1)';
    tabRegister.style.color = 'white';
    tabLogin.style.background = 'transparent';
    tabLogin.style.color = '#94a3b8';
    registerForm.style.display = 'block';
    loginForm.style.display = 'none';
  }
}

async function handleLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const authError = document.getElementById('authError');
  const authSuccess = document.getElementById('authSuccess');

  if (!email || !password) {
    authError.textContent = 'Si us plau, emplena tots els camps';
    authError.style.display = 'block';
    return;
  }

  // ── MODE OFFLINE: bypass directe ──
  const offline = !navigator.onLine || typeof window.supabase === 'undefined';
  if (offline) {
    authSuccess.textContent = '📴 Mode offline — entrant sense verificació...';
    authSuccess.style.display = 'block';
    // Guardar sessió mínima per no tornar a demanar login offline
    try {
      localStorage.setItem('focuswork_offline_session', JSON.stringify({ user: { email: email, id: 'offline' } }));
    } catch(e) { /* res */ }
    setTimeout(() => {
      hideLoginScreen();
      if (typeof initApp === 'function') initApp();
    }, 800);
    return;
  }

  try {
    authError.style.display = 'none';
    authSuccess.textContent = 'Entrant...';
    authSuccess.style.display = 'block';

    await signIn(email, password);

    authSuccess.textContent = '✅ Login correcte!';

    setTimeout(() => {
      hideLoginScreen();
    }, 1000);

  } catch (error) {
    authSuccess.style.display = 'none';
    authError.textContent = 'Email o contrasenya incorrectes';
    authError.style.display = 'block';
  }
}

async function handleRegister() {
  const name = document.getElementById('registerName').value.trim();
  const email = document.getElementById('registerEmail').value.trim();
  const password = document.getElementById('registerPassword').value;
  const authError = document.getElementById('authError');
  const authSuccess = document.getElementById('authSuccess');
  
  if (!name || !email || !password) {
    authError.textContent = 'Si us plau, emplena tots els camps';
    authError.style.display = 'block';
    return;
  }
  
  if (password.length < 6) {
    authError.textContent = 'La contrasenya ha de tenir mínim 6 caràcters';
    authError.style.display = 'block';
    return;
  }
  
  try {
    authError.style.display = 'none';
    authSuccess.textContent = 'Creant compte...';
    authSuccess.style.display = 'block';
    
    await signUp(email, password, name);
    
    authSuccess.textContent = '✅ Compte creat! Revisa el teu email per confirmar.';
    
    // Canviar a pestanya login després de 3 segons
    setTimeout(() => {
      switchTab('login');
    }, 3000);
    
  } catch (error) {
    authSuccess.style.display = 'none';
    if (error.message.includes('already registered')) {
      authError.textContent = 'Aquest email ja està registrat';
    } else {
      authError.textContent = 'Error creant compte: ' + error.message;
    }
    authError.style.display = 'block';
  }
}

function showResetPassword() {
  const email = prompt('Introdueix el teu email per recuperar la contrasenya:');
  if (!email) return;
  
  resetPassword(email)
    .then(() => {
      alert('✅ Email enviat! Revisa la teva safata d\'entrada.');
    })
    .catch((error) => {
      alert('❌ Error: ' + error.message);
    });
}

// Exportar funcions
window.signUp = signUp;
/* ── LÍMIT DE CLIENTS PER USUARI ── */

// Llegir el límit de clients de l'usuari (des de user_metadata de Supabase)
// Per defecte: 5 clients. Admin pot canviar via Supabase Dashboard → Auth → Users
// Format: user_metadata.max_clients = 10 (o -1 per il·limitat)
async function getUserClientLimit() {
  // ✅ MODE OFFLINE: sense límit (no podem consultar Supabase)
  if (typeof window.isOfflineMode === 'function' && window.isOfflineMode()) return Infinity;
  if (window._offlineOverrideClientLimit) return Infinity;

  try {
    const { data } = await supabase.auth.getUser();
    const meta = data?.user?.user_metadata || {};
    if (meta.max_clients === -1 || meta.plan === 'full') return Infinity;
    return meta.max_clients || 5;
  } catch(e) {
    // Si Supabase no respon (quota exhaurida, etc.) → no bloquejar
    return Infinity;
  }
}

// Comprovar si l'usuari pot crear més clients
async function canCreateMoreClients() {
  const limit = await getUserClientLimit();
  if (limit === Infinity) return { ok: true };

  // ✅ En mode offline: comptar clients directament de IndexedDB sense carregar fotos
  if (typeof window.isOfflineMode === 'function' && window.isOfflineMode()) {
    try {
      const clients = await dbGetAll('clients');
      const active = clients.filter(c => c.active !== false).length;
      if (active >= limit) return { ok: false, current: active, limit };
      return { ok: true, current: active, limit };
    } catch(e) {
      return { ok: true }; // Si falla, deixar crear
    }
  }

  const allClients = await loadAllClients();
  const active = Object.values(allClients).filter(c => c.active).length;

  if (active >= limit) {
    return { ok: false, current: active, limit };
  }
  return { ok: true, current: active, limit };
}

window.getUserClientLimit = getUserClientLimit;
window.canCreateMoreClients = canCreateMoreClients;

window.signIn = signIn;
window.signOut = signOut;
window.showLoginScreen = showLoginScreen;
window.hideLoginScreen = hideLoginScreen;
window.switchTab = switchTab;
window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
window.showResetPassword = showResetPassword;

console.log('✅ Sistema d\'autenticació carregat');

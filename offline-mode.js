/*************************************************
 * FOCUSWORK — offline-mode.js
 *
 * Mode emergència: permet entrar a l'app usant
 * les dades guardades localment (IndexedDB)
 * quan Supabase no és accessible (quota esgotada,
 * sense internet, etc.)
 *
 * AFEGIR a index.html ABANS de supabase-auth.js:
 * <script src="offline-mode.js"></script>
 *************************************************/

const OFFLINE_MODE_KEY = 'fw_offline_mode';
const OFFLINE_USER_KEY = 'fw_offline_user';

/* ── Estat del mode offline ── */
function isOfflineMode() {
  return localStorage.getItem(OFFLINE_MODE_KEY) === 'true';
}

function activateOfflineMode() {
  localStorage.setItem(OFFLINE_MODE_KEY, 'true');
  console.log('📴 Mode offline activat');
}

function deactivateOfflineMode() {
  localStorage.removeItem(OFFLINE_MODE_KEY);
  console.log('🌐 Mode offline desactivat');
}

/* ── Usuari fals per mode offline ── */
function _getOfflineUser() {
  try {
    const saved = localStorage.getItem(OFFLINE_USER_KEY);
    if (saved) return JSON.parse(saved);
  } catch(e) {}
  return { id: 'offline-user', email: 'offline@local', name: 'Usuari local' };
}

function _saveOfflineUser(email) {
  const user = { id: 'offline-user', email: email || 'offline@local', name: 'Usuari local' };
  localStorage.setItem(OFFLINE_USER_KEY, JSON.stringify(user));
  return user;
}

/* ── Injectar botó d'emergència a la pantalla de login ── */
function _injectOfflineButton() {
  // Esperar que la pantalla de login existeixi
  const interval = setInterval(() => {
    const loginScreen = document.getElementById('loginScreen');
    if (!loginScreen || document.getElementById('offlineModeBtn')) return;
    clearInterval(interval);

    const loginForm = document.getElementById('loginForm');
    if (!loginForm) return;

    // Botó d'accés offline
    const btn = document.createElement('button');
    btn.id = 'offlineModeBtn';
    btn.innerHTML = '📴 Accedir sense connexió (dades locals)';
    btn.style.cssText = `
      width: 100%;
      padding: 12px;
      border: 1px solid rgba(251, 191, 36, 0.3);
      border-radius: 8px;
      background: rgba(251, 191, 36, 0.08);
      color: #fbbf24;
      font-size: 13px;
      cursor: pointer;
      margin-top: 8px;
      transition: all 0.2s;
    `;
    btn.onmouseover = () => btn.style.background = 'rgba(251, 191, 36, 0.15)';
    btn.onmouseout  = () => btn.style.background = 'rgba(251, 191, 36, 0.08)';
    btn.onclick = _handleOfflineAccess;

    loginForm.appendChild(btn);

    // Nota explicativa
    const nota = document.createElement('p');
    nota.style.cssText = 'text-align:center; font-size:11px; color:#64748b; margin-top:12px; line-height:1.4;';
    nota.textContent = '⚠️ El mode sense connexió usa les dades guardades en aquest dispositiu. Les dades de Supabase no estaran disponibles.';
    loginForm.appendChild(nota);

  }, 300);
}

/* ── Gestionar accés offline ── */
async function _handleOfflineAccess() {
  // En mode offline, canCreateMoreClients sempre retorna ok
  window._offlineOverrideClientLimit = true;
  // Verificar que hi ha dades locals
  let hasLocalData = false;
  try {
    const checkDB = await new Promise((resolve) => {
      const req = indexedDB.open('FocusWorkDB', 1);
      req.onsuccess = (e) => {
        const db = e.target.result;
        const tx = db.transaction(['clients'], 'readonly');
        const store = tx.objectStore('clients');
        const countReq = store.count();
        countReq.onsuccess = () => resolve(countReq.result);
        countReq.onerror = () => resolve(0);
      };
      req.onerror = () => resolve(0);
    });
    hasLocalData = checkDB > 0;
  } catch(e) {}

  if (!hasLocalData) {
    const authError = document.getElementById('authError');
    if (authError) {
      authError.textContent = '❌ No hi ha dades locals guardades en aquest dispositiu. Has d\'haver entrat almenys una vegada amb connexió.';
      authError.style.display = 'block';
    }
    return;
  }

  // Guardar email si s'ha escrit
  const emailInput = document.getElementById('loginEmail');
  if (emailInput && emailInput.value) {
    _saveOfflineUser(emailInput.value);
  }

  // Activar mode offline i entrar
  activateOfflineMode();

  const authSuccess = document.getElementById('authSuccess');
  if (authSuccess) {
    authSuccess.textContent = '📴 Entrant en mode offline...';
    authSuccess.style.display = 'block';
  }

  setTimeout(async () => {
    // 1. Substituir getCurrentUser temporalment
    _patchGetCurrentUser();

    // 2. Inicialitzar IndexedDB PRIMER (sense això db és null i tot falla)
    if (typeof initDB === 'function') {
      try {
        await initDB();
        console.log('✅ IndexedDB inicialitzat en mode offline');
      } catch(e) {
        console.warn('⚠️ Error inicialitzant IndexedDB:', e);
      }
    }

    // 3. Amagar pantalla de login i mostrar app
    if (typeof hideLoginScreen === 'function') {
      hideLoginScreen();
    } else {
      const loginScreen = document.getElementById('loginScreen');
      if (loginScreen) loginScreen.remove();
      const app = document.querySelector('.app');
      if (app) app.style.display = 'block';
    }

    // 4. Mostrar banner d'avís
    _showOfflineBanner();

    // 5. Carregar dades locals (ara que DB ja està inicialitzada)
    if (typeof loadState === 'function') await loadState();

    // 6. Actualitzar UI
    if (typeof updateUI === 'function') updateUI();

  }, 800);
}

/* ── Guardar user_id real quan Supabase funciona ── */
const REAL_USER_KEY = 'fw_real_user_id';
function _saveRealUserId(userId) {
  if (userId && userId !== 'offline-user') {
    localStorage.setItem(REAL_USER_KEY, userId);
  }
}
function _getRealUserId() {
  return localStorage.getItem(REAL_USER_KEY);
}

/* ── Sobreescriure getCurrentUser en mode offline ── */
function _patchGetCurrentUser() {
  // Usar el user_id real guardat per poder llegir IndexedDB correctament
  const realUserId = _getRealUserId();
  const offlineUser = _getOfflineUser();
  // Si tenim l'id real, usem-lo (permet llegir dades de Supabase-db filtrades per user_id)
  if (realUserId) offlineUser.id = realUserId;

  // Guardar original
  if (!window._originalGetCurrentUser && typeof window.getCurrentUser === 'function') {
    window._originalGetCurrentUser = window.getCurrentUser;
  }

  // Substituir per versió offline
  window.getCurrentUser = function() {
    return offlineUser;
  };

  // getCurrentUserId si existeix
  if (!window._originalGetCurrentUserId && typeof window.getCurrentUserId === 'function') {
    window._originalGetCurrentUserId = window.getCurrentUserId;
  }
  window.getCurrentUserId = function() {
    return offlineUser.id;
  };

  console.log('👤 getCurrentUser sobreescrit per mode offline');
}

/* ── Banner visible a tota l'app ── */
function _showOfflineBanner() {
  if (document.getElementById('offlineBanner')) return;

  const banner = document.createElement('div');
  banner.id = 'offlineBanner';
  banner.style.cssText = `
    position: fixed;
    top: 0; left: 0; right: 0;
    background: linear-gradient(135deg, #92400e, #b45309);
    color: #fef3c7;
    text-align: center;
    padding: 8px 16px;
    font-size: 13px;
    font-weight: 500;
    z-index: 99999;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
  `;
  banner.innerHTML = `
    <span>📴 Mode offline — mostrant dades locals d'aquest dispositiu</span>
    <button onclick="_exitOfflineMode()" style="
      background: rgba(255,255,255,0.2);
      border: 1px solid rgba(255,255,255,0.3);
      color: #fef3c7;
      padding: 3px 10px;
      border-radius: 20px;
      font-size: 12px;
      cursor: pointer;
    ">Tornar al login</button>
  `;
  document.body.prepend(banner);

  // Afegir marge a l'app per no tapar contingut
  const app = document.querySelector('.app');
  if (app) app.style.paddingTop = '36px';
}

/* ── Sortir del mode offline ── */
window._exitOfflineMode = function() {
  deactivateOfflineMode();

  // Restaurar getCurrentUser original
  if (window._originalGetCurrentUser) {
    window.getCurrentUser = window._originalGetCurrentUser;
  }
  if (window._originalGetCurrentUserId) {
    window.getCurrentUserId = window._originalGetCurrentUserId;
  }

  // Netejar banner
  const banner = document.getElementById('offlineBanner');
  if (banner) banner.remove();
  const app = document.querySelector('.app');
  if (app) app.style.paddingTop = '';

  // Tornar al login
  if (typeof showLoginScreen === 'function') showLoginScreen();
  _injectOfflineButton();
};

/* ── Init: si ja estava en mode offline, aplicar-ho directament ── */
(function init() {
  if (isOfflineMode()) {
    // Esperar que l'app i getCurrentUser estiguin carregats
    const wait = setInterval(() => {
      if (typeof window.getCurrentUser !== 'function') return;
      clearInterval(wait);

      _patchGetCurrentUser();
      console.log('📴 Mode offline restaurat de sessió anterior');

      // Mostrar banner quan el DOM estigui llest
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _showOfflineBanner);
      } else {
        setTimeout(_showOfflineBanner, 500);
      }
    }, 100);
  }

  // ── CLAU: escoltar quan Supabase autentica un usuari real ──
  // Si Supabase fa login correctament → desactivar mode offline automàticament
  // i restaurar getCurrentUser original. Així no hi ha cap conflicte.
  const _waitForSupabase = setInterval(() => {
    if (!window.supabase) return;
    clearInterval(_waitForSupabase);

    window.supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session && session.user) {
        // Guardar sempre l'id real per poder-lo usar en mode offline futur
        _saveRealUserId(session.user.id);
        if (isOfflineMode()) {
          console.log('✅ Supabase actiu — desactivant mode offline automàticament');
          deactivateOfflineMode();

          // Restaurar getCurrentUser original si estava sobreescrit
          // (supabase-config.js ja el redefineix, però per seguretat)
          if (window._originalGetCurrentUser) {
            // No cal restaurar — supabase-config.js ja sobreescriu amb la versió correcta
            window._originalGetCurrentUser = null;
          }

          // Treure banner si existeix
          const banner = document.getElementById('offlineBanner');
          if (banner) banner.remove();
          const app = document.querySelector('.app');
          if (app) app.style.paddingTop = '';
        }
      }

      if (event === 'SIGNED_OUT') {
        // Assegurar que mode offline queda net al fer logout
        deactivateOfflineMode();
      }
    });
  }, 200);

  // Injectar botó quan aparegui la pantalla de login
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _injectOfflineButton);
  } else {
    _injectOfflineButton();
  }

  // Observar si apareix la pantalla de login dinàmicament (la crea JS)
  const observer = new MutationObserver(() => {
    if (document.getElementById('loginScreen') && !document.getElementById('offlineModeBtn')) {
      _injectOfflineButton();
    }
  });
  observer.observe(document.body, { childList: true, subtree: false });

})();

/* ── Exports ── */
window.isOfflineMode       = isOfflineMode;
window.activateOfflineMode = activateOfflineMode;
window.deactivateOfflineMode = deactivateOfflineMode;

console.log('✅ offline-mode.js carregat');

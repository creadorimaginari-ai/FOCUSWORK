// ════════════════════════════════════════════════════════════════════════════
//  FOCUSWORK — Panell d'Administrador
//  Accessible només per l'usuari admin definit a ADMIN_EMAIL
// ════════════════════════════════════════════════════════════════════════════

const ADMIN_EMAIL = 'carlesglobalgrafic@gmail.com';

let _adminTargetUserId   = null;
let _adminTargetUserName = null;

// ── Inicialitzar: mostrar botó admin si és l'usuari correcte ────────────────
async function initAdminPanel() {
  try {
    const { data } = await window.supabase.auth.getUser();
    const email = data?.user?.email;
    if (email === ADMIN_EMAIL) {
      const btn = document.getElementById('adminPanelBtn');
      if (btn) btn.style.display = 'flex';
    }
  } catch(e) {
    console.log('Admin check error:', e);
  }
}

// ── Obrir panell admin ──────────────────────────────────────────────────────
async function openAdminPanel() {
  const panel = document.getElementById('adminPanel');
  if (!panel) return;
  panel.style.display = 'block';
  await loadAdminUsers();
}

function closeAdminPanel() {
  const panel = document.getElementById('adminPanel');
  if (panel) panel.style.display = 'none';
}

// ── Carregar llista d'usuaris via Supabase Admin API ───────────────────────
async function loadAdminUsers() {
  const container = document.getElementById('adminUsersList');
  if (!container) return;
  container.innerHTML = '<div style="color:#94a3b8;text-align:center;padding:40px;">Carregant...</div>';

  try {
    // Llegir usuaris des de auth.users via SQL (necessita service_role o RPC)
    const { data, error } = await window.supabase
      .rpc('admin_get_users');

    if (error) throw error;

    renderAdminUsers(data || []);
  } catch(e) {
    // Fallback: llegir des de la taula clients agrupant per user_id
    console.log('RPC no disponible, usant fallback:', e.message);
    await loadAdminUsersFallback(container);
  }
}

// Fallback: construir llista des de clients + usuari actual
async function loadAdminUsersFallback(container) {
  try {
    // Agafar tots els user_ids únics de la taula clients
    const { data: clientsData, error } = await window.supabase
      .from('clients')
      .select('user_id, name')
      .order('user_id');

    if (error) throw error;

    // Agrupar per user_id
    const userMap = {};
    (clientsData || []).forEach(c => {
      if (!userMap[c.user_id]) {
        userMap[c.user_id] = { user_id: c.user_id, client_count: 0 };
      }
      userMap[c.user_id].client_count++;
    });

    // Llegir metadades dels usuaris coneguts via auth.users (SQL)
    const { data: usersData } = await window.supabase
      .from('admin_users_view')
      .select('*')
      .catch(() => ({ data: null }));

    // Si tenim la vista, usar-la; si no, mostrar el que sabem
    const users = usersData || Object.values(userMap);
    renderAdminUsers(users, userMap);

  } catch(e) {
    // Últim recurs: mostrar panell SQL
    showAdminSQLPanel(container);
  }
}

function showAdminSQLPanel(container) {
  container.innerHTML = `
    <div style="background:#1e293b;border:1px solid #475569;border-radius:12px;padding:20px;">
      <p style="color:#f59e0b;font-size:14px;margin:0 0 16px;">
        ⚠️ Per gestionar usuaris cal crear una funció RPC a Supabase.
        Executa aquest SQL al SQL Editor:
      </p>
      <pre style="background:#0f172a;border:1px solid #334155;border-radius:8px;padding:16px;color:#10b981;font-size:12px;overflow-x:auto;white-space:pre-wrap;">
-- Funció que retorna tots els usuaris amb el seu límit
CREATE OR REPLACE FUNCTION admin_get_users()
RETURNS TABLE(
  id uuid, email text, display_name text,
  max_clients int, client_count bigint, created_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id,
    u.email,
    COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email,'@',1)) as display_name,
    COALESCE((u.raw_user_meta_data->>'max_clients')::int, 5) as max_clients,
    COUNT(c.id) as client_count,
    u.created_at
  FROM auth.users u
  LEFT JOIN public.clients c ON c.user_id = u.id
  GROUP BY u.id, u.email, u.raw_user_meta_data, u.created_at
  ORDER BY u.created_at;
END;
$$;

-- Funció per actualitzar el límit
CREATE OR REPLACE FUNCTION admin_set_user_limit(target_user_id uuid, new_limit int)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  UPDATE auth.users
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('max_clients', new_limit)
  WHERE id = target_user_id;
END;
$$;</pre>
      <button onclick="loadAdminUsers()" style="background:#7c3aed;border:none;color:white;padding:10px 20px;border-radius:8px;cursor:pointer;font-size:14px;margin-top:12px;width:100%;">
        🔄 Tornar a intentar
      </button>
    </div>
  `;
}

// ── Renderitzar llista d'usuaris ───────────────────────────────────────────
function renderAdminUsers(users, fallbackMap = {}) {
  const container = document.getElementById('adminUsersList');
  if (!container) return;

  if (!users || users.length === 0) {
    container.innerHTML = '<div style="color:#94a3b8;text-align:center;padding:40px;">No hi ha usuaris</div>';
    return;
  }

  container.innerHTML = users.map(u => {
    const limit      = u.max_clients ?? u.max_clients ?? 5;
    const limitLabel = limit === -1 ? '♾️ Il·limitat' : `${limit} clients`;
    const limitColor = limit === -1 ? '#10b981' : '#f59e0b';
    const count      = u.client_count ?? (fallbackMap[u.user_id || u.id]?.client_count ?? '?');
    const name       = u.display_name || u.email || u.user_id || 'Usuari';
    const email      = u.email || '';
    const userId     = u.id || u.user_id;

    return `
      <div class="admin-user-card">
        <div style="flex:1;min-width:0;">
          <div style="color:white;font-weight:600;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            ${name}
          </div>
          <div style="color:#64748b;font-size:12px;margin-top:2px;">${email}</div>
          <div style="color:#94a3b8;font-size:12px;margin-top:4px;">
            📁 ${count} clients actius
          </div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;flex-shrink:0;">
          <span style="color:${limitColor};font-weight:700;font-size:13px;">${limitLabel}</span>
          <button onclick="openAdminLimitModal('${userId}','${name.replace(/'/g,"\\'")}',${limit})"
            style="background:#7c3aed;border:none;color:white;padding:6px 14px;border-radius:8px;cursor:pointer;font-size:13px;">
            ✏️ Canviar
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// ── Modal canvi límit ──────────────────────────────────────────────────────
function openAdminLimitModal(userId, userName, currentLimit) {
  _adminTargetUserId   = userId;
  _adminTargetUserName = userName;

  const modal = document.getElementById('adminLimitModal');
  const nameEl = document.getElementById('adminLimitUserName');
  const input  = document.getElementById('adminCustomLimit');

  if (nameEl) nameEl.textContent = `Usuari: ${userName} | Límit actual: ${currentLimit === -1 ? 'Il·limitat' : currentLimit}`;
  if (input)  input.value = '';
  if (modal)  modal.style.display = 'flex';
}

function closeAdminLimitModal() {
  const modal = document.getElementById('adminLimitModal');
  if (modal) modal.style.display = 'none';
  _adminTargetUserId   = null;
  _adminTargetUserName = null;
}

async function setUserLimit(limit) {
  await applyUserLimit(limit);
}

async function setUserLimitCustom() {
  const input = document.getElementById('adminCustomLimit');
  const val   = parseInt(input?.value);
  if (!val || val < 1) { alert('Introdueix un número vàlid'); return; }
  await applyUserLimit(val);
}

async function applyUserLimit(limit) {
  if (!_adminTargetUserId) return;

  try {
    // Usar la funció RPC si existeix
    const { error } = await window.supabase
      .rpc('admin_set_user_limit', {
        target_user_id: _adminTargetUserId,
        new_limit: limit
      });

    if (error) throw error;

    closeAdminLimitModal();
    showAdminSuccess(`Límit actualitzat a ${limit === -1 ? 'il·limitat' : limit} per a ${_adminTargetUserName}`);
    await loadAdminUsers(); // Refrescar llista

  } catch(e) {
    // Si no hi ha RPC, mostrar SQL manual
    const sql = `UPDATE auth.users SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"max_clients": ${limit}}'::jsonb WHERE id = '${_adminTargetUserId}';`;
    closeAdminLimitModal();
    showAdminSQLFallback(sql, _adminTargetUserName, limit);
  }
}

function showAdminSuccess(msg) {
  const container = document.getElementById('adminUsersList');
  if (!container) return;
  const banner = document.createElement('div');
  banner.style.cssText = 'background:#064e3b;border:1px solid #10b981;border-radius:10px;padding:12px 16px;color:#10b981;font-weight:600;margin-bottom:12px;';
  banner.textContent = '✅ ' + msg;
  container.prepend(banner);
  setTimeout(() => banner.remove(), 4000);
}

function showAdminSQLFallback(sql, userName, limit) {
  const container = document.getElementById('adminUsersList');
  if (!container) return;
  container.innerHTML = `
    <div style="background:#1e293b;border:1px solid #f59e0b;border-radius:12px;padding:20px;margin-bottom:16px;">
      <p style="color:#f59e0b;font-weight:600;margin:0 0 8px;">
        ⚠️ Executa aquest SQL al Supabase SQL Editor per canviar el límit de <strong>${userName}</strong> a ${limit === -1 ? 'il·limitat' : limit}:
      </p>
      <pre style="background:#0f172a;border:1px solid #334155;border-radius:8px;padding:12px;color:#10b981;font-size:13px;overflow-x:auto;user-select:all;">${sql}</pre>
      <button onclick="navigator.clipboard.writeText(\`${sql}\`).then(()=>alert('SQL copiat!'))"
        style="background:#f59e0b;border:none;color:#0f172a;padding:8px 16px;border-radius:8px;cursor:pointer;font-weight:600;margin-top:10px;">
        📋 Copiar SQL
      </button>
    </div>
    <button onclick="loadAdminUsers()" style="background:#1e293b;border:1px solid #475569;color:white;padding:10px;border-radius:8px;cursor:pointer;width:100%;">
      ← Tornar a la llista
    </button>
  `;
}

// ── Exposar funcions globalment ────────────────────────────────────────────
window.openAdminPanel       = openAdminPanel;
window.closeAdminPanel      = closeAdminPanel;
window.openAdminLimitModal  = openAdminLimitModal;
window.closeAdminLimitModal = closeAdminLimitModal;
window.setUserLimit         = setUserLimit;
window.setUserLimitCustom   = setUserLimitCustom;
window.loadAdminUsers       = loadAdminUsers;
window.initAdminPanel       = initAdminPanel;

// Inicialitzar quan l'app carrega
document.addEventListener('DOMContentLoaded', () => {
  // Esperar que l'auth estigui llesta
  setTimeout(initAdminPanel, 1500);
});

/*************************************************
 * FOCUSWORK — admin-clients.js
 * Gestió massiva de clients (IndexedDB)
 * Selecció múltiple, per rang, i esborrat massiu
 *************************************************/

(function() {

// ── Injectar HTML del modal ──────────────────────────────────────────────────
function injectAdminClientsModal() {
  if (document.getElementById('adminClientsModal')) return;

  const modal = document.createElement('div');
  modal.id = 'adminClientsModal';
  modal.style.cssText = `
    display:none; position:fixed; inset:0; z-index:99999;
    background:rgba(0,0,0,0.75); backdrop-filter:blur(6px);
    align-items:center; justify-content:center;
  `;

  modal.innerHTML = `
    <div style="
      background:#0f172a; border:1px solid #334155; border-radius:16px;
      width:min(95vw,600px); max-height:85vh; display:flex; flex-direction:column;
      box-shadow:0 25px 60px rgba(0,0,0,0.6); overflow:hidden;
    ">
      <!-- Header -->
      <div style="padding:20px 24px 16px; border-bottom:1px solid #1e293b; display:flex; align-items:center; justify-content:space-between; flex-shrink:0;">
        <div>
          <div style="font-size:18px; font-weight:700; color:#f1f5f9;">🗂️ Gestió massiva de clients</div>
          <div id="adminClientsCount" style="font-size:12px; color:#64748b; margin-top:2px;">Carregant...</div>
        </div>
        <button onclick="closeAdminClientsModal()" style="
          background:rgba(255,255,255,0.07); border:1px solid #334155;
          color:#94a3b8; border-radius:8px; padding:6px 12px; cursor:pointer; font-size:18px;
        ">✕</button>
      </div>

      <!-- Controls -->
      <div style="padding:14px 24px; border-bottom:1px solid #1e293b; flex-shrink:0; display:flex; flex-direction:column; gap:10px;">
        <!-- Selecció ràpida -->
        <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
          <span style="font-size:12px; color:#64748b; white-space:nowrap;">Seleccionar:</span>
          <button onclick="adminSelectAll()" style="
            background:#1e293b; border:1px solid #334155; color:#94a3b8;
            border-radius:6px; padding:5px 12px; cursor:pointer; font-size:12px;
          ">Tots</button>
          <button onclick="adminSelectNone()" style="
            background:#1e293b; border:1px solid #334155; color:#94a3b8;
            border-radius:6px; padding:5px 12px; cursor:pointer; font-size:12px;
          ">Cap</button>
          <button onclick="adminSelectClosed()" style="
            background:#1e293b; border:1px solid #334155; color:#94a3b8;
            border-radius:6px; padding:5px 12px; cursor:pointer; font-size:12px;
          ">Tancats</button>
          <button onclick="adminSelectDuplicates()" style="
            background:rgba(234,179,8,0.15); border:1px solid rgba(234,179,8,0.3); color:#fbbf24;
            border-radius:6px; padding:5px 12px; cursor:pointer; font-size:12px;
          ">⚠️ Duplicats</button>
        </div>

        <!-- Selecció per rang -->
        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
          <span style="font-size:12px; color:#64748b; white-space:nowrap;">Rang:</span>
          <span style="font-size:12px; color:#94a3b8;">del</span>
          <input id="rangeFrom" type="number" min="1" value="1" style="
            width:60px; background:#1e293b; border:1px solid #334155; color:#f1f5f9;
            border-radius:6px; padding:5px 8px; font-size:12px; text-align:center;
          ">
          <span style="font-size:12px; color:#94a3b8;">fins al</span>
          <input id="rangeTo" type="number" min="1" value="999" style="
            width:60px; background:#1e293b; border:1px solid #334155; color:#f1f5f9;
            border-radius:6px; padding:5px 8px; font-size:12px; text-align:center;
          ">
          <button onclick="adminSelectRange()" style="
            background:#f97316; border:none; color:#fff;
            border-radius:6px; padding:5px 14px; cursor:pointer; font-size:12px; font-weight:600;
          ">Seleccionar rang</button>
        </div>
      </div>

      <!-- Llista de clients -->
      <div id="adminClientsList" style="
        flex:1; overflow-y:auto; padding:12px 24px;
      ">
        <div style="color:#64748b; text-align:center; padding:40px;">Carregant clients...</div>
      </div>

      <!-- Footer amb accions -->
      <div style="padding:16px 24px; border-top:1px solid #1e293b; flex-shrink:0; display:flex; align-items:center; justify-content:space-between; gap:12px;">
        <div id="adminSelectedInfo" style="font-size:13px; color:#64748b;">0 seleccionats</div>
        <div style="display:flex; gap:8px;">
          <button onclick="closeAdminClientsModal()" style="
            background:#1e293b; border:1px solid #334155; color:#94a3b8;
            border-radius:8px; padding:9px 18px; cursor:pointer; font-size:13px;
          ">Cancel·lar</button>
          <button onclick="adminDeleteSelected()" id="adminDeleteBtn" disabled style="
            background:#dc2626; border:none; color:#fff; opacity:0.4;
            border-radius:8px; padding:9px 18px; cursor:not-allowed; font-size:13px; font-weight:700;
          ">🗑️ Esborrar seleccionats</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
}

// ── Estat intern ─────────────────────────────────────────────────────────────
let _allClients = [];
let _selectedIds = new Set();

// ── Obrir modal ──────────────────────────────────────────────────────────────
window.openAdminClientsModal = async function() {
  injectAdminClientsModal();
  const modal = document.getElementById('adminClientsModal');
  modal.style.display = 'flex';
  _selectedIds.clear();
  await loadAdminClientsList();
};

window.closeAdminClientsModal = function() {
  const modal = document.getElementById('adminClientsModal');
  if (modal) modal.style.display = 'none';
};

// ── Carregar clients des de IndexedDB ────────────────────────────────────────
async function loadAdminClientsList() {
  const list = document.getElementById('adminClientsList');
  const countEl = document.getElementById('adminClientsCount');

  list.innerHTML = '<div style="color:#64748b;text-align:center;padding:40px;">Carregant...</div>';

  try {
    _allClients = await dbGetAll('clients');
    // Ordenar per nom
    _allClients.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    countEl.textContent = `${_allClients.length} clients en total`;
    document.getElementById('rangeTo').value = _allClients.length;

    if (_allClients.length === 0) {
      list.innerHTML = '<div style="color:#64748b;text-align:center;padding:40px;">No hi ha clients</div>';
      return;
    }

    renderAdminClientsList();
  } catch(e) {
    list.innerHTML = `<div style="color:#ef4444;text-align:center;padding:40px;">Error: ${e.message}</div>`;
  }
}

// ── Renderitzar llista ───────────────────────────────────────────────────────
function renderAdminClientsList() {
  const list = document.getElementById('adminClientsList');

  const rows = _allClients.map((client, index) => {
    const isClosed = !!client.closed_at || client.active === false;
    const isSelected = _selectedIds.has(client.id);
    const stateLabel = isClosed
      ? '<span style="font-size:10px;background:#1e293b;color:#64748b;padding:2px 7px;border-radius:10px;">tancat</span>'
      : '<span style="font-size:10px;background:#14532d;color:#86efac;padding:2px 7px;border-radius:10px;">actiu</span>';

    return `
      <div data-id="${client.id}" onclick="adminToggleClient('${client.id}')" style="
        display:flex; align-items:center; gap:12px; padding:10px 12px;
        border-radius:8px; cursor:pointer; margin-bottom:4px;
        background:${isSelected ? 'rgba(249,115,22,0.15)' : 'rgba(255,255,255,0.02)'};
        border:1px solid ${isSelected ? '#f97316' : 'transparent'};
        transition:all 0.15s;
      ">
        <div style="
          width:18px; height:18px; border-radius:4px; flex-shrink:0;
          border:2px solid ${isSelected ? '#f97316' : '#475569'};
          background:${isSelected ? '#f97316' : 'transparent'};
          display:flex; align-items:center; justify-content:center;
        ">${isSelected ? '<span style="color:#fff;font-size:11px;font-weight:900;">✓</span>' : ''}</div>
        <span style="font-size:12px; color:#64748b; width:28px; flex-shrink:0;">${index + 1}.</span>
        <span style="flex:1; font-size:14px; color:#f1f5f9; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${client.name || 'Sense nom'}</span>
        ${stateLabel}
      </div>
    `;
  }).join('');

  list.innerHTML = rows;
  updateAdminSelectionInfo();
}

// ── Toggle selecció individual ───────────────────────────────────────────────
window.adminToggleClient = function(id) {
  if (_selectedIds.has(id)) {
    _selectedIds.delete(id);
  } else {
    _selectedIds.add(id);
  }
  renderAdminClientsList();
};

// ── Seleccionar tots ─────────────────────────────────────────────────────────
window.adminSelectAll = function() {
  _allClients.forEach(c => _selectedIds.add(c.id));
  renderAdminClientsList();
};

// ── Desseleccionar tots ──────────────────────────────────────────────────────
window.adminSelectNone = function() {
  _selectedIds.clear();
  renderAdminClientsList();
};

// ── Seleccionar tancats ──────────────────────────────────────────────────────
window.adminSelectClosed = function() {
  _selectedIds.clear();
  _allClients.forEach(c => {
    if (c.closed_at || c.active === false) _selectedIds.add(c.id);
  });
  renderAdminClientsList();
};

// ── Seleccionar duplicats (manté el primer, selecciona la resta) ─────────────
window.adminSelectDuplicates = function() {
  _selectedIds.clear();
  const seen = {};
  _allClients.forEach(c => {
    const key = (c.name || '').trim().toLowerCase();
    if (!key) return;
    if (seen[key] === undefined) {
      seen[key] = c.id; // primer — es queda
    } else {
      _selectedIds.add(c.id); // duplicat — es marca per esborrar
    }
  });
  const n = _selectedIds.size;
  if (n === 0) {
    alert('No s'han trobat duplicats pel nom.');
  } else {
    // Mostrar avís amb els duplicats trobats
    const names = _allClients
      .filter(c => _selectedIds.has(c.id))
      .map(c => c.name)
      .join(', ');
    if (!confirm(`S'han trobat ${n} duplicat${n>1?'s':''} (es mantindrà el primer de cada nom):\n\n${names}\n\nVols seleccionar-los per esborrar?`)) {
      _selectedIds.clear();
    }
  }
  renderAdminClientsList();
};

// ── Seleccionar per rang ─────────────────────────────────────────────────────
window.adminSelectRange = function() {
  const from = parseInt(document.getElementById('rangeFrom').value) - 1;
  const to   = parseInt(document.getElementById('rangeTo').value) - 1;
  if (isNaN(from) || isNaN(to)) return;
  const start = Math.max(0, Math.min(from, to));
  const end   = Math.min(_allClients.length - 1, Math.max(from, to));
  _selectedIds.clear();
  for (let i = start; i <= end; i++) {
    _selectedIds.add(_allClients[i].id);
  }
  renderAdminClientsList();
};

// ── Actualitzar info de selecció ─────────────────────────────────────────────
function updateAdminSelectionInfo() {
  const n = _selectedIds.size;
  const info = document.getElementById('adminSelectedInfo');
  const btn  = document.getElementById('adminDeleteBtn');
  if (info) info.textContent = n === 0
    ? '0 seleccionats'
    : `${n} client${n > 1 ? 's' : ''} seleccionat${n > 1 ? 's' : ''}`;
  if (btn) {
    btn.disabled = n === 0;
    btn.style.opacity = n === 0 ? '0.4' : '1';
    btn.style.cursor  = n === 0 ? 'not-allowed' : 'pointer';
  }
}

// ── Esborrar seleccionats ────────────────────────────────────────────────────
window.adminDeleteSelected = async function() {
  const n = _selectedIds.size;
  if (n === 0) return;

  const confirmed = confirm(
    `⚠️ Vas a esborrar ${n} client${n > 1 ? 's' : ''}.\n\n` +
    `Això esborrarà també totes les seves fotos i dades.\n\n` +
    `Escriu OK per confirmar.`
  );
  if (!confirmed) return;

  const btn = document.getElementById('adminDeleteBtn');
  btn.textContent = 'Esborrant...';
  btn.disabled = true;
  btn.style.cursor = 'not-allowed';

  let deleted = 0;
  let errors = 0;

  for (const id of _selectedIds) {
    try {
      // Esborrar client
      await dbDelete('clients', id);
      // Esborrar fotos associades
      const photos = await dbGetAll('photos', id);
      for (const photo of photos) {
        await dbDelete('photos', photo.id);
      }
      deleted++;
    } catch(e) {
      console.error('Error esborrant client', id, e);
      errors++;
    }
  }

  _selectedIds.clear();

  // Resetear botó
  btn.textContent = '🗑️ Esborrar seleccionats';
  btn.disabled = false;
  btn.style.opacity = '0.4';
  btn.style.cursor = 'not-allowed';

  // Recarregar llista
  await loadAdminClientsList();

  const msg = errors > 0
    ? `✅ ${deleted} esborrats. ⚠️ ${errors} errors.`
    : `✅ ${deleted} client${deleted > 1 ? 's' : ''} esborrat${deleted > 1 ? 's' : ''} correctament.`;

  alert(msg);

  // Si l'app té funció per recarregar la llista principal, cridar-la
  if (typeof renderClientList === 'function') renderClientList();
  if (typeof loadClientsFromDB === 'function') loadClientsFromDB();
  if (typeof refreshUI === 'function') refreshUI();
};

// ── Tancar amb Escape ────────────────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const modal = document.getElementById('adminClientsModal');
    if (modal && modal.style.display !== 'none') closeAdminClientsModal();
  }
});

})();
    

/*************************************************
 * FOCUSWORK — local-photos-mode.js
 * 
 * Toggle per usar IndexedDB local en lloc de
 * Supabase Storage per les fotos.
 * 
 * Útil per estalviar egress de Supabase mentre
 * s'implementa Google Drive.
 * 
 * AFEGIR a index.html DESPRÉS de photos-storage.js:
 * <script src="local-photos-mode.js"></script>
 *************************************************/

const LOCAL_PHOTOS_KEY = 'fw_local_photos_mode';

/* ── Llegir estat actual ── */
function isLocalPhotosMode() {
  return localStorage.getItem(LOCAL_PHOTOS_KEY) === 'true';
}

/* ── Activar / desactivar ── */
function setLocalPhotosMode(enabled) {
  localStorage.setItem(LOCAL_PHOTOS_KEY, enabled ? 'true' : 'false');
  _applyMode(enabled);
  console.log(enabled ? '📱 Mode local activat (IndexedDB)' : '☁️ Mode Supabase Storage activat');
}

/* ── Aplicar mode: sobreescriu processImageFile ── */
function _applyMode(localMode) {
  if (localMode) {
    // Sobreescriu amb versió local (IndexedDB, sense pujar a Supabase)
    window.processImageFile = _processImageFileLocal;
    window.uploadPhotoToStorage = async () => null; // no puja res
  } else {
    // Restaurar les funcions originals si existeixen
    if (window._originalProcessImageFile) {
      window.processImageFile = window._originalProcessImageFile;
    }
    if (window._originalUploadPhotoToStorage) {
      window.uploadPhotoToStorage = window._originalUploadPhotoToStorage;
    }
  }
  _updateToggleUI(localMode);
}

/* ── processImageFile en mode local (guarda base64 a IndexedDB) ── */
async function _processImageFileLocal(file, client) {
  showAlert('Processant', '⏳ Processant imatge localment...', '📱');

  const reader = new FileReader();
  reader.onload = async () => {
    const img = new Image();
    img.onload = async () => {
      try {
        // Redimensionar igual que l'original
        const MAX = 1920;
        let w = img.width, h = img.height;
        if (w > MAX || h > MAX) {
          const r = Math.min(MAX / w, MAX / h);
          w = Math.floor(w * r);
          h = Math.floor(h * r);
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        const dataURL = canvas.toDataURL('image/jpeg', 0.80); // qualitat lleugerament menor per estalviar espai

        const photoId  = typeof uid === 'function' ? uid() : ('p_' + Date.now());
        const clientId = client.id;

        // Guardar a IndexedDB
        if (window.db) {
          try {
            await new Promise((resolve, reject) => {
              const tx = window.db.transaction(['photos'], 'readwrite');
              tx.objectStore('photos').put({
                id:       photoId,
                clientId: clientId,
                date:     new Date().toISOString(),
                type:     'image',
                name:     file.name,
                mimeType: 'image/jpeg',
                comment:  '',
                url:      null,
                data:     dataURL
              });
              tx.oncomplete = resolve;
              tx.onerror = reject;
            });
          } catch (e) {
            console.error('Error guardant a IndexedDB:', e);
          }
        }

        const fileObj = {
          id:       photoId,
          date:     new Date().toISOString(),
          type:     'image',
          name:     file.name,
          mimeType: 'image/jpeg',
          comment:  '',
          url:      null,
          data:     dataURL  // base64 local
        };

        // Recarregar client fresc
        const freshClient = await loadClient(clientId);
        if (!freshClient) return;
        if (!freshClient.files) freshClient.files = [];
        freshClient.files.push(fileObj);

        // Guardar SENSE el base64 a Supabase (evita egress)
        // El base64 queda NOMÉS a IndexedDB local
        const clientToSave = { ...freshClient };
        clientToSave.files = (freshClient.files || []).map(f => ({
          ...f,
          data: null // no guardar base64 a Supabase
        }));
        await saveClient(clientToSave);

        // Renderitzar amb la versió completa (amb base64 per mostrar)
        await renderFileGallery(freshClient);

        closeModal('modalAlert');
        showAlert('Imatge afegida', `${file.name} guardada localment 📱\n(visible en aquest dispositiu)`, '✅');

      } catch (err) {
        console.error('Error processant imatge local:', err);
        closeModal('modalAlert');
        showAlert('Error', "No s'ha pogut processar la imatge", '❌');
      }
    };
    img.onerror = () => showAlert('Error', "No s'ha pogut carregar la imatge", '❌');
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

/* ── UI: actualitzar toggle visual ── */
function _updateToggleUI(localMode) {
  const toggle = document.getElementById('localPhotosModeToggle');
  const status = document.getElementById('localPhotosModeStatus');
  if (toggle) toggle.checked = localMode;
  if (status) {
    status.textContent = localMode
      ? '📱 Mode local actiu — fotos guardades al dispositiu (estalvia dades)'
      : '☁️ Mode Supabase Storage — fotos sincronitzades entre dispositius';
    status.style.color = localMode ? '#86efac' : '#93c5fd';
  }
}

/* ── Injectar UI al modal de configuració ── */
function _injectToggleUI() {
  const modalBody = document.querySelector('#modalBackupConfig .modal-body');
  if (!modalBody || document.getElementById('localPhotosModeToggle')) return;

  const separator = document.createElement('hr');
  separator.style.cssText = 'border: none; border-top: 1px solid rgba(255,255,255,0.1); margin: 20px 0;';
  modalBody.appendChild(separator);

  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <label style="display:flex; align-items:center; gap:12px; margin-bottom:12px; cursor:pointer;">
      <div style="position:relative; width:48px; height:26px; flex-shrink:0;">
        <input type="checkbox" id="localPhotosModeToggle"
          style="opacity:0; width:0; height:0; position:absolute;"
          onchange="setLocalPhotosMode(this.checked)">
        <div id="localPhotosModeTrack" style="
          position:absolute; top:0; left:0; right:0; bottom:0;
          background: #334155; border-radius:13px; transition: background 0.2s;
          cursor:pointer;
        " onclick="document.getElementById('localPhotosModeToggle').click()">
          <div id="localPhotosModeThumb" style="
            position:absolute; top:3px; left:3px;
            width:20px; height:20px; background:white;
            border-radius:50%; transition: transform 0.2s;
          "></div>
        </div>
      </div>
      <span style="font-weight:500;">Mode local de fotos</span>
    </label>
    <p id="localPhotosModeStatus" style="margin:0; font-size:0.85rem; padding: 10px 12px; background:rgba(0,0,0,0.2); border-radius:8px; line-height:1.4;"></p>
    <p style="margin-top:8px; font-size:0.8rem; opacity:0.5;">
      ⚡ Activa això per estalviar dades de Supabase. Les fotos es guardaran en aquest dispositiu fins que s'implementi Google Drive.
    </p>
  `;
  modalBody.appendChild(wrapper);

  // Sincronitzar estat visual del toggle amb CSS
  const checkbox = document.getElementById('localPhotosModeToggle');
  const track    = document.getElementById('localPhotosModeTrack');
  const thumb    = document.getElementById('localPhotosModeThumb');

  function syncVisual(checked) {
    track.style.background = checked ? '#22c55e' : '#334155';
    thumb.style.transform  = checked ? 'translateX(22px)' : 'translateX(0)';
  }

  checkbox.addEventListener('change', () => syncVisual(checkbox.checked));

  // Aplicar estat inicial
  const current = isLocalPhotosMode();
  checkbox.checked = current;
  syncVisual(current);
  _updateToggleUI(current);
}

/* ── Init ── */
(function init() {
  // Guardar funcions originals abans de sobreescriure
  const waitForOriginals = setInterval(() => {
    if (typeof window.processImageFile === 'function' &&
        typeof window.uploadPhotoToStorage === 'function') {
      clearInterval(waitForOriginals);

      if (!window._originalProcessImageFile) {
        window._originalProcessImageFile      = window.processImageFile;
        window._originalUploadPhotoToStorage  = window.uploadPhotoToStorage;
      }

      // Aplicar mode guardat
      _applyMode(isLocalPhotosMode());

      // Injectar UI quan el DOM estigui llest
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _injectToggleUI);
      } else {
        _injectToggleUI();
      }

      console.log('✅ local-photos-mode.js carregat. Mode local:', isLocalPhotosMode());
    }
  }, 200);
})();

/* ── Exportar ── */
window.isLocalPhotosMode  = isLocalPhotosMode;
window.setLocalPhotosMode = setLocalPhotosMode;

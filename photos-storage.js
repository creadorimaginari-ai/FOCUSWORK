/*************************************************
 * FOCUSWORK - FOTOS A SUPABASE STORAGE
 * 
 * Substitueix el sistema de fotos local (IndexedDB/base64)
 * per Supabase Storage → sincronització entre dispositius.
 * 
 * AFEGIR a index.html DESPRÉS de app-ui.js:
 * <script src="photos-storage.js"></script>
 *************************************************/

const STORAGE_BUCKET = 'photos';
const SUPABASE_URL   = 'https://mhqdpslvowosxabuxcgw.supabase.co';

/* ─────────────────────────────────────────────
   PUJAR FOTO A SUPABASE STORAGE
   Retorna la URL pública o null si falla
───────────────────────────────────────────── */
async function uploadPhotoToStorage(dataURL, photoId, clientId) {
  try {
    // Convertir dataURL → Blob
    const res  = await fetch(dataURL);
    const blob = await res.blob();

    const path = `${clientId}/${photoId}.jpg`;

    const { error } = await window.supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, blob, {
        contentType: 'image/jpeg',
        upsert: true
      });

    if (error) throw error;

    // Obtenir URL pública
    const { data } = window.supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(path);

    return data.publicUrl;
  } catch (e) {
    console.error('❌ Error pujant foto a Storage:', e.message);
    return null;
  }
}

/* ─────────────────────────────────────────────
   ESBORRAR FOTO DE SUPABASE STORAGE
───────────────────────────────────────────── */
async function deletePhotoFromStorage(photoId, clientId) {
  try {
    const path = `${clientId}/${photoId}.jpg`;
    const { error } = await window.supabase.storage
      .from(STORAGE_BUCKET)
      .remove([path]);
    if (error) throw error;
    return true;
  } catch (e) {
    console.error('❌ Error esborrant foto de Storage:', e.message);
    return false;
  }
}

/* ─────────────────────────────────────────────
   PROCESSAR I PUJAR IMATGE (substitueix processImageFile)
───────────────────────────────────────────── */
async function processImageFile(file, client) {
  const loadingMsg = '⏳ Pujant imatge...';
  showAlert('Processant', loadingMsg, '📤');

  const reader = new FileReader();
  reader.onload = async () => {
    const img = new Image();
    img.onload = async () => {
      try {
        // Redimensionar
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
        const dataURL = canvas.toDataURL('image/jpeg', 0.85);

        const photoId   = uid();
        const clientId  = client.id;

        // Pujar a Supabase Storage
        const publicUrl = await uploadPhotoToStorage(dataURL, photoId, clientId);

        const fileObj = {
          id:       photoId,
          date:     new Date().toISOString(),
          type:     'image',
          name:     file.name,
          mimeType: 'image/jpeg',
          comment:  '',
          // Si tenim URL pública usem-la; si no (offline) guardem base64 temporalment
          url:      publicUrl || null,
          data:     publicUrl ? null : dataURL   // no guardar base64 si tenim URL
        };

        // Recarregar client fresc per no sobreescriure canvis simultanis
        const freshClient = await loadClient(clientId);
        if (!freshClient) return;
        if (!freshClient.files) freshClient.files = [];
        freshClient.files.push(fileObj);

        await saveClient(freshClient);
        await renderFileGallery(freshClient);

        closeModal('modalAlert');
        showAlert('Imatge afegida', `${file.name} sincronitzada a tots els dispositius ✅`, '🖼️');

      } catch (err) {
        console.error('Error processant imatge:', err);
        closeModal('modalAlert');
        showAlert('Error', 'No s\'ha pogut pujar la imatge', '❌');
      }
    };
    img.onerror = () => showAlert('Error', 'No s\'ha pogut carregar la imatge', '❌');
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

/* ─────────────────────────────────────────────
   ESBORRAR ARXIU (substitueix confirmDeleteFile)
───────────────────────────────────────────── */
async function confirmDeleteFile(file) {
  const labels = { image:'foto', video:'vídeo', audio:'àudio', pdf:'PDF', document:'document', other:'arxiu' };
  const label  = labels[file.type] || 'arxiu';
  const name   = file.name || (file.type === 'image' ? 'Foto' : 'Sense nom');

  if (!confirm(`Vols esborrar aquesta ${label}?\n\n${name}\n\nAquesta acció no es pot desfer.`)) return;

  try {
    const client = await loadClient(state.currentClientId);
    if (!client) { showAlert('Error', 'Client no trobat', '⚠️'); return; }

    closeLightbox();

    // Esborrar de Storage si té URL
    if (file.type === 'image' && file.url) {
      await deletePhotoFromStorage(file.id, client.id);
    }

    // Esborrar de IndexedDB local (compatibilitat)
    if (window.db) {
      try { await dbDelete('photos', file.id); } catch(e) {}
    }

    // Treure de les dues llistes (photos i files)
    client.photos = (client.photos || []).filter(f => f.id !== file.id);
    client.files  = (client.files  || []).filter(f => f.id !== file.id);

    await saveClient(client);
    await renderFileGallery(client);

    showAlert('Arxiu eliminat', `La ${label} s'ha eliminat correctament`, '✅');
  } catch (e) {
    console.error('Error esborrant arxiu:', e);
    showAlert('Error', `No s'ha pogut esborrar: ${e.message}`, '❌');
  }
}

/* ─────────────────────────────────────────────
   RENDERITZAR GALERIA (substitueix renderFileGallery)
   Suporta tant fotos amb URL com base64 antic
───────────────────────────────────────────── */
async function renderFileGallery(preloadedClient = null) {
  const gallery = document.getElementById('photoGallery');
  if (!gallery) return;

  const client = preloadedClient || (state.currentClientId ? await loadClient(state.currentClientId) : null);
  if (!client) { gallery.innerHTML = ''; return; }

  // Unificar photos (antic) i files (nou)
  const allFiles = [];

  (client.photos || []).forEach(p => allFiles.push({
    id:      p.id,
    date:    p.date,
    type:    'image',
    name:    'Imatge',
    mimeType:'image/jpeg',
    url:     p.url  || null,
    data:    p.data || null,
    comment: p.comment || ''
  }));

  (client.files || []).forEach(f => allFiles.push(f));

  const sorted = allFiles.sort((a, b) => new Date(b.date) - new Date(a.date));
  window.currentClientFiles  = sorted;
  window.currentClientPhotos = sorted.filter(f => f.type === 'image');

  gallery.style.cssText = `
    display:grid;
    grid-template-columns:repeat(auto-fill,minmax(150px,1fr));
    gap:12px;padding:12px;
  `;
  gallery.innerHTML = '';

  if (!sorted.length) {
    gallery.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:40px;color:rgba(255,255,255,0.4);">
        <div style="font-size:48px;margin-bottom:12px">📷</div>
        <div>Sense arxius. Afegeix una foto o document.</div>
      </div>`;
    return;
  }

  sorted.forEach((file, index) => {
    const wrap = document.createElement('div');
    wrap.className = 'file-item';
    wrap.style.cssText = `
      position:relative;cursor:pointer;aspect-ratio:1;
      overflow:hidden;border-radius:8px;background:#1e293b;
    `;

    // Contingut visual
    if (file.type === 'image') {
      const src = file.url || file.data || '';
      wrap.innerHTML = `
        <img src="${src}" alt="${file.name || 'Foto'}"
          style="width:100%;height:100%;object-fit:cover;"
          onerror="this.style.display='none';this.nextSibling.style.display='flex'">
        <div style="display:none;align-items:center;justify-content:center;height:100%;color:#888;font-size:30px;">🖼️</div>
        ${file.comment ? `<div style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,0.6);color:white;font-size:10px;padding:4px;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">💬 ${file.comment}</div>` : ''}
      `;
    } else {
      const icons = { video:'🎬', audio:'🎵', pdf:'📄', document:'📝', other:'📎' };
      const icon  = icons[file.type] || '📎';
      wrap.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:8px;padding:8px;">
          <div style="font-size:40px;">${icon}</div>
          <div style="font-size:11px;color:#94a3b8;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;width:100%;">${file.name}</div>
        </div>
      `;
    }

    // Long press → esborrar | click curt → obrir
    let pressTimer = null;
    let t0 = null;

    const startPress = () => {
      t0 = Date.now();
      wrap.style.transform = 'scale(0.95)';
      wrap.style.transition = 'transform 0.1s';
      pressTimer = setTimeout(() => {
        if (navigator.vibrate) navigator.vibrate(50);
        confirmDeleteFile(file);
        wrap.style.transform = 'scale(1)';
      }, 800);
    };

    const endPress = () => {
      clearTimeout(pressTimer);
      wrap.style.transform = 'scale(1)';
      if (t0 && (Date.now() - t0) < 300) openFileViewer(sorted, index);
      t0 = null;
    };

    const cancelPress = () => { clearTimeout(pressTimer); wrap.style.transform = 'scale(1)'; t0 = null; };

    wrap.addEventListener('mousedown',  startPress);
    wrap.addEventListener('mouseup',    endPress);
    wrap.addEventListener('mouseleave', cancelPress);
    wrap.addEventListener('touchstart', startPress, { passive: true });
    wrap.addEventListener('touchend',   endPress);
    wrap.addEventListener('touchcancel',cancelPress);

    gallery.appendChild(wrap);
  });
}

/* ─────────────────────────────────────────────
   GUARDAR COMENTARI DE FOTO (actualitzat)
───────────────────────────────────────────── */
async function savePhotoComment(text) {
  const clientId = state.currentClientId;
  if (!clientId) return;

  const client = await loadClient(clientId);
  if (!client) return;

  const currentFile = window.currentClientFiles?.[window.currentLightboxIndex];
  if (!currentFile) return;

  // Buscar i actualitzar tant a photos com a files
  const updateList = (list) => {
    const item = (list || []).find(p => p.id === currentFile.id);
    if (item) item.comment = text;
    return item;
  };

  updateList(client.photos);
  updateList(client.files);

  await saveClient(client);

  // Actualitzar còpia global
  if (window.currentClientFiles?.[window.currentLightboxIndex]) {
    window.currentClientFiles[window.currentLightboxIndex].comment = text;
  }

  // Actualitzar badge visual
  const gallery = document.getElementById('photoGallery');
  if (gallery) {
    const items = gallery.querySelectorAll('.file-item');
    const idx = window.currentLightboxIndex;
    if (items[idx]) {
      const badge = items[idx].querySelector('.comment-badge');
      if (text && !badge) {
        const b = document.createElement('div');
        b.className = 'comment-badge';
        b.style.cssText = 'position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,0.6);color:white;font-size:10px;padding:4px;text-align:center;';
        b.textContent = '💬 ' + text;
        items[idx].appendChild(b);
      } else if (badge) {
        badge.textContent = text ? '💬 ' + text : '';
      }
    }
  }

  console.log('💬 Comentari guardat');
}

/* ─────────────────────────────────────────────
   EXPOSAR FUNCIONS GLOBALS
───────────────────────────────────────────── */
window.uploadPhotoToStorage  = uploadPhotoToStorage;
window.deletePhotoFromStorage = deletePhotoFromStorage;
window.processImageFile      = processImageFile;
window.confirmDeleteFile     = confirmDeleteFile;
window.renderFileGallery     = renderFileGallery;
window.renderPhotoGallery    = renderFileGallery;
window.savePhotoComment      = savePhotoComment;

console.log('✅ Sistema de fotos Supabase Storage carregat');

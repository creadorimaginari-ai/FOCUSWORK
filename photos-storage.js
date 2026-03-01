/*************************************************
 * FOCUSWORK — photos-storage.js v3
 *
 * Sistema de fotos amb Cloudflare R2
 * ✅ Egress 100% gratuït
 * ✅ 10GB storage gratuïts, després 0,015$/GB
 * ✅ Compatible amb fotos antigues de Supabase (URLs segueixen funcionant)
 *
 * CONFIGURACIÓ: afegir a index.html abans dels scripts:
 *   <script>
 *     window.R2_CONFIG = {
 *       publicUrl: 'https://pub-XXXXXXXX.r2.dev',
 *       workerUrl: 'https://focuswork-upload.USUARI.workers.dev',
 *       uploadToken: 'TOKEN_SECRET'
 *     }
 *   </script>
 *************************************************/

function _getStorageSystem() {
  if (window.R2_CONFIG && window.R2_CONFIG.workerUrl) return 'r2';
  if (window.supabase && window.supabase.storage)     return 'supabase';
  return 'local';
}

async function uploadPhotoToStorage(dataURL, photoId, clientId) {
  const s = _getStorageSystem();
  if (s === 'r2')       return _uploadToR2(dataURL, photoId, clientId);
  if (s === 'supabase') return _uploadToSupabase(dataURL, photoId, clientId);
  return null;
}

async function _uploadToR2(dataURL, photoId, clientId) {
  try {
    const blob = await (await fetch(dataURL)).blob();
    const path = clientId + '/' + photoId + '.jpg';
    const r = await fetch(window.R2_CONFIG.workerUrl + '/upload', {
      method: 'POST',
      headers: {
        'Content-Type':  'image/jpeg',
        'X-File-Path':   path,
        'X-Upload-Token': window.R2_CONFIG.uploadToken || ''
      },
      body: blob
    });
    if (!r.ok) throw new Error('R2 ' + r.status);
    const url = window.R2_CONFIG.publicUrl + '/' + path;
    console.log('✅ Foto a R2:', url);
    return url;
  } catch (e) {
    console.error('❌ R2:', e.message);
    if (window.supabase && window.supabase.storage) {
      console.log('⚠️ Fallback Supabase...');
      return _uploadToSupabase(dataURL, photoId, clientId);
    }
    return null;
  }
}

async function _uploadToSupabase(dataURL, photoId, clientId) {
  try {
    const blob = await (await fetch(dataURL)).blob();
    const path = clientId + '/' + photoId + '.jpg';
    const { error } = await window.supabase.storage
      .from('photos').upload(path, blob, { contentType: 'image/jpeg', upsert: true });
    if (error) throw error;
    const { data } = window.supabase.storage.from('photos').getPublicUrl(path);
    return data.publicUrl;
  } catch (e) {
    console.error('❌ Supabase Storage:', e.message);
    return null;
  }
}

async function deletePhotoFromStorage(photoId, clientId, existingUrl) {
  const isR2 = existingUrl && window.R2_CONFIG &&
    existingUrl.includes(window.R2_CONFIG.publicUrl.replace('https://',''));
  if (isR2) return _deleteFromR2(photoId, clientId);
  return _deleteFromSupabase(photoId, clientId);
}

async function _deleteFromR2(photoId, clientId) {
  try {
    const r = await fetch(window.R2_CONFIG.workerUrl + '/delete', {
      method: 'DELETE',
      headers: {
        'X-File-Path': clientId + '/' + photoId + '.jpg',
        'X-Upload-Token': window.R2_CONFIG.uploadToken || ''
      }
    });
    return r.ok;
  } catch (e) { return false; }
}

async function _deleteFromSupabase(photoId, clientId) {
  try {
    const { error } = await window.supabase.storage
      .from('photos').remove([clientId + '/' + photoId + '.jpg']);
    return !error;
  } catch (e) { return false; }
}

async function processImageFile(file, client) {
  const s = _getStorageSystem();
  const label = {r2:'Cloudflare R2 ☁️', supabase:'Supabase', local:'local'}[s];
  showAlert('Processant', '⏳ Pujant imatge... (' + label + ')', '📤');

  const reader = new FileReader();
  reader.onload = async () => {
    const img = new Image();
    img.onload = async () => {
      try {
        const MAX = 1920;
        let w = img.width, h = img.height;
        if (w > MAX || h > MAX) {
          const r = Math.min(MAX/w, MAX/h);
          w = Math.floor(w*r); h = Math.floor(h*r);
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#FFF'; ctx.fillRect(0,0,w,h);
        ctx.drawImage(img, 0, 0, w, h);
        const dataURL = canvas.toDataURL('image/jpeg', 0.85);

        const photoId  = typeof uid === 'function' ? uid() : ('p_' + Date.now());
        const publicUrl = await uploadPhotoToStorage(dataURL, photoId, client.id);

        const fileObj = {
          id: photoId, date: new Date().toISOString(),
          type: 'image', name: file.name, mimeType: 'image/jpeg',
          comment: '', url: publicUrl || null,
          data: publicUrl ? null : dataURL
        };

        const freshClient = await loadClient(client.id);
        if (!freshClient) return;
        if (!freshClient.files) freshClient.files = [];
        freshClient.files.push(fileObj);

        await saveClient(freshClient);
        await renderFileGallery(freshClient);
        closeModal('modalAlert');
        showAlert('Imatge afegida',
          publicUrl ? file.name + ' sincronitzada ✅' : file.name + ' guardada localment',
          '🖼️');
      } catch (err) {
        console.error(err);
        closeModal('modalAlert');
        showAlert('Error', "No s'ha pogut pujar la imatge", '❌');
      }
    };
    img.onerror = () => showAlert('Error', "No s'ha pogut carregar la imatge", '❌');
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

async function confirmDeleteFile(file) {
  const labels = {image:'foto',video:'vídeo',audio:'àudio',pdf:'PDF',document:'document',other:'arxiu'};
  const label = labels[file.type] || 'arxiu';
  if (!confirm('Vols esborrar aquesta ' + label + '?\n\n' + (file.name||'') + '\n\nAquesta acció no es pot desfer.')) return;

  try {
    const client = await loadClient(state.currentClientId);
    if (!client) { showAlert('Error','Client no trobat','⚠️'); return; }
    closeLightbox();
    if (file.type === 'image' && (file.url || file.id))
      await deletePhotoFromStorage(file.id, client.id, file.url);
    if (window.db) { try { await dbDelete('photos', file.id); } catch(e){} }
    client.photos = (client.photos||[]).filter(f=>f.id!==file.id);
    client.files  = (client.files ||[]).filter(f=>f.id!==file.id);
    await saveClient(client);
    await renderFileGallery(client);
    showAlert('Arxiu eliminat', 'La ' + label + " s'ha eliminat correctament", '✅');
  } catch(e) {
    showAlert('Error', "No s'ha pogut esborrar: " + e.message, '❌');
  }
}

async function renderFileGallery(preloadedClient = null) {
  const gallery = document.getElementById('photoGallery');
  if (!gallery) return;
  const client = preloadedClient || (state.currentClientId ? await loadClient(state.currentClientId) : null);
  if (!client) { gallery.innerHTML = ''; return; }

  const allFiles = [];
  (client.photos||[]).forEach(p => allFiles.push({
    id:p.id, date:p.date, type:'image', name:'Imatge',
    mimeType:'image/jpeg', url:p.url||null, data:p.data||null, comment:p.comment||''
  }));
  (client.files||[]).forEach(f => allFiles.push(f));

  const sorted = allFiles.sort((a,b) => new Date(b.date)-new Date(a.date));
  window.currentClientFiles  = sorted;
  window.currentClientPhotos = sorted.filter(f=>f.type==='image');

  gallery.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;padding:12px;';
  gallery.innerHTML = '';

  if (!sorted.length) {
    gallery.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:rgba(255,255,255,0.4);"><div style="font-size:48px;margin-bottom:12px">📷</div><div>Sense arxius.</div></div>';
    return;
  }

  sorted.forEach((file, index) => {
    const wrap = document.createElement('div');
    wrap.className = 'file-item';
    wrap.style.cssText = 'position:relative;cursor:pointer;aspect-ratio:1;overflow:hidden;border-radius:8px;background:#1e293b;';

    if (file.type === 'image') {
      const src = file.url || file.data || '';
      wrap.innerHTML = '<img src="' + src + '" alt="' + (file.name||'Foto') + '" style="width:100%;height:100%;object-fit:cover;" loading="lazy" onerror="this.style.display=\'none\';var fb=this.parentElement.querySelector(\'.img-fallback\');if(fb)fb.style.display=\'flex\';"><div class="img-fallback" style="display:none;align-items:center;justify-content:center;height:100%;color:#888;font-size:30px;">🖼️</div>' + (file.comment ? '<div style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,0.6);color:white;font-size:10px;padding:4px;text-align:center;">💬 ' + file.comment + '</div>' : '');
    } else {
      const icons = {video:'🎬',audio:'🎵',pdf:'📄',document:'📝',other:'📎'};
      wrap.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:8px;padding:8px;"><div style="font-size:40px;">' + (icons[file.type]||'📎') + '</div><div style="font-size:11px;color:#94a3b8;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;width:100%;">' + file.name + '</div></div>';
    }

    let pressTimer=null, t0=null, longPressTriggered=false;
    const startPress=()=>{ t0=Date.now(); longPressTriggered=false; wrap.style.transform='scale(0.95)'; wrap.style.transition='transform 0.1s'; pressTimer=setTimeout(()=>{ longPressTriggered=true; if(navigator.vibrate)navigator.vibrate(50); confirmDeleteFile(file); wrap.style.transform='scale(1)'; },800); };
    const endPress=()=>{ clearTimeout(pressTimer); wrap.style.transform='scale(1)'; if(!longPressTriggered&&t0&&(Date.now()-t0)<300) openFileViewer(sorted,index); t0=null; longPressTriggered=false; };
    const cancelPress=()=>{ clearTimeout(pressTimer); wrap.style.transform='scale(1)'; t0=null; longPressTriggered=false; };
    wrap.addEventListener('mousedown',startPress); wrap.addEventListener('mouseup',endPress); wrap.addEventListener('mouseleave',cancelPress);
    wrap.addEventListener('touchstart',startPress,{passive:true}); wrap.addEventListener('touchend',endPress); wrap.addEventListener('touchcancel',cancelPress);
    gallery.appendChild(wrap);
  });
}

async function savePhotoComment(text) {
  const clientId = state.currentClientId;
  if (!clientId) return;
  const client = await loadClient(clientId);
  if (!client) return;
  const currentFile = window.currentClientFiles?.[window.currentLightboxIndex];
  if (!currentFile) return;
  const upd = list => { const i=(list||[]).find(p=>p.id===currentFile.id); if(i) i.comment=text; };
  upd(client.photos); upd(client.files);
  await saveClient(client);
  if (window.currentClientFiles?.[window.currentLightboxIndex])
    window.currentClientFiles[window.currentLightboxIndex].comment = text;
  const gallery=document.getElementById('photoGallery');
  if (gallery) {
    const items=gallery.querySelectorAll('.file-item');
    const idx=window.currentLightboxIndex;
    if (items[idx]) {
      const badge=items[idx].querySelector('.comment-badge');
      if (text&&!badge) { const b=document.createElement('div'); b.className='comment-badge'; b.style.cssText='position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,0.6);color:white;font-size:10px;padding:4px;text-align:center;'; b.textContent='💬 '+text; items[idx].appendChild(b); }
      else if (badge) badge.textContent = text ? '💬 '+text : '';
    }
  }
}

window.uploadPhotoToStorage   = uploadPhotoToStorage;
window.deletePhotoFromStorage = deletePhotoFromStorage;
window.processImageFile       = processImageFile;
window.confirmDeleteFile      = confirmDeleteFile;
window.renderFileGallery      = renderFileGallery;
window.renderPhotoGallery     = renderFileGallery;
window.savePhotoComment       = savePhotoComment;

console.log('✅ photos-storage v3 — sistema:', _getStorageSystem());

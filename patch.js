/*
 * patch.js — FocusWork
 * Soluciona:
 *  1. renderClientCard no existeix → error al llista de clients
 *  2. supabase-db.js fa location.reload() al clicar client → no obre res
 *  3. Fotos no carreguen
 */

window.checkMigration = async function() { return true; };

/* ─────────────────────────────────────────────
   1. renderClientCard  (usada per index.html l.822)
   ───────────────────────────────────────────── */
window.renderClientCard = function(client) {
  const stateColors = {
    in_progress:      '#3b82f6',
    waiting_feedback: '#8b5cf6',
    waiting_material: '#f59e0b',
    paused:           '#64748b',
    blocked:          '#ef4444',
    ready_to_deliver: '#10b981',
  };
  const stateLabels = {
    in_progress:      '🔵 En progrés',
    waiting_feedback: '✉️ Prova enviada',
    waiting_material: '🟡 Esperant',
    paused:           '⏸ Pausat',
    blocked:          '🔴 Bloquejat',
    ready_to_deliver: '✅ Llest',
  };

  const cs    = client.state || 'in_progress';
  const color = stateColors[cs] || '#3b82f6';
  const label = stateLabels[cs] || cs;
  const prog  = client.progress || 1;
  const dots  = Array.from({length:5}, (_,i) =>
    `<span style="width:9px;height:9px;border-radius:50%;display:inline-block;
      background:${i<prog ? color : 'rgba(255,255,255,0.15)'};margin-right:3px;"></span>`
  ).join('');

  let deliveryHtml = '';
  if (client.deliveryDate) {
    const del  = new Date(client.deliveryDate);
    const now  = new Date(); now.setHours(0,0,0,0); del.setHours(0,0,0,0);
    const diff = Math.ceil((del-now)/86400000);
    const [txt,col] = diff<0  ? [`⚠️ Vençut fa ${Math.abs(diff)}d`,'#ef4444']
                   : diff===0 ? ['🔴 AVUI','#ef4444']
                   : diff===1 ? ['🟡 DEMÀ','#f59e0b']
                   : diff<=3  ? [`🟡 ${diff} dies`,'#f59e0b']
                   :            [`📅 ${del.toLocaleDateString('ca-ES',{day:'2-digit',month:'2-digit'})}`,'#94a3b8'];
    deliveryHtml = `<span style="font-size:11px;color:${col};margin-left:8px;">${txt}</span>`;
  }

  const time = (client.total||0) > 0
    ? `<span style="font-size:12px;color:#4ade80;margin-top:4px;display:block;">⏱ ${formatTime(client.total)}</span>`
    : '';

  return `
    <div class="client-card" data-client-id="${client.id}" style="
      padding:16px; margin-bottom:12px;
      background:rgba(255,255,255,0.05); border-radius:12px;
      cursor:pointer; border-left:4px solid ${color}; transition:background 0.2s;
    "
    onmouseover="this.style.background='rgba(255,255,255,0.09)'"
    onmouseout="this.style.background='rgba(255,255,255,0.05)'"
    >
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
        <div style="flex:1;min-width:0;">
          <div style="font-size:16px;font-weight:700;color:#f1f5f9;margin-bottom:4px;">
            ${client.name||'Sense nom'}
          </div>
          <div style="font-size:12px;color:#94a3b8;">
            ${[client.email, client.phone, client.company].filter(Boolean).join(' · ')}
          </div>
          <div style="display:flex;align-items:center;flex-wrap:wrap;gap:4px;margin-top:6px;">
            <span style="font-size:11px;color:${color};background:${color}22;
              padding:2px 8px;border-radius:10px;">${label}</span>
            ${deliveryHtml}
          </div>
        </div>
        <div style="text-align:right;flex-shrink:0;">
          ${time}
          <div style="margin-top:6px;">${dots}</div>
        </div>
      </div>
    </div>`;
};

/* ─────────────────────────────────────────────
   2. Sobreescriure renderClientsList de supabase-db.js
      perquè NO faci location.reload() al clicar
   ───────────────────────────────────────────── */
function patchRenderClientsList() {
  window.renderClientsList = function() {
    const container = document.querySelector('#clientsListContainer')
                   || document.querySelector('#projectList');
    if (!container) return;

    container.innerHTML = '';

    const clients = Object.values(window.state?.clients || {}).filter(c => {
      const s = (c.status||'').toLowerCase();
      return s !== 'closed' && s !== 'archived' && s !== 'deleted';
    }).sort((a,b) => new Date(b.created_at||0) - new Date(a.created_at||0));

    if (clients.length === 0) {
      container.innerHTML = `
        <div style="text-align:center;padding:60px 20px;color:rgba(255,255,255,0.5);">
          <div style="font-size:48px;margin-bottom:20px;">📋</div>
          <div style="font-size:18px;">No hi ha clients</div>
        </div>`;
      return;
    }

    clients.forEach((client, i) => {
      const colors = ['#4CAF50','#2196F3','#9C27B0','#FF5722','#FFC107','#00BCD4','#E91E63','#3F51B5'];
      const card = document.createElement('div');
      card.style.cssText = `
        padding:20px; margin-bottom:12px;
        background:linear-gradient(135deg,rgba(102,126,234,0.1),rgba(118,75,162,0.1));
        border-radius:12px; cursor:pointer;
        border-left:4px solid ${colors[i%colors.length]};
        transition:all 0.2s;`;
      card.onmouseover = () => { card.style.transform='translateX(6px)'; card.style.background='linear-gradient(135deg,rgba(102,126,234,0.2),rgba(118,75,162,0.2))'; };
      card.onmouseout  = () => { card.style.transform=''; card.style.background='linear-gradient(135deg,rgba(102,126,234,0.1),rgba(118,75,162,0.1))'; };

      const h = Math.floor((client.total||0)/3600);
      const m = Math.floor(((client.total||0)%3600)/60);
      const timeStr = h>0 ? `${h}h ${m}m` : `${m}m`;

      card.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:start;gap:15px;">
          <div style="flex:1;">
            <div style="font-size:18px;font-weight:bold;color:white;margin-bottom:6px;">
              ${client.name||'Sense nom'}
            </div>
            <div style="font-size:13px;color:rgba(255,255,255,0.6);">
              ${[client.email, client.phone].filter(Boolean).join(' · ')}
            </div>
            ${client.company ? `<div style="font-size:12px;color:rgba(255,255,255,0.5);margin-top:4px;">🏢 ${client.company}</div>` : ''}
            ${(client.total||0)>0 ? `<div style="margin-top:8px;padding:3px 10px;background:rgba(76,175,80,0.2);border-radius:6px;display:inline-block;font-size:12px;color:#4CAF50;font-weight:bold;">⏱️ ${timeStr}</div>` : ''}
          </div>
          <div style="font-size:24px;opacity:0.3;">→</div>
        </div>`;

      // ✅ USA selectClient() — NO location.reload()
      card.onclick = () => {
        console.log('📌 Obrint client:', client.name);
        if (typeof selectClient === 'function') {
          selectClient(client.id);
        } else {
          openClientDirect(client.id);
        }
      };

      container.appendChild(card);
    });
  };
}

/* ─────────────────────────────────────────────
   3. Sobreescriure renderClientsOverview (index.html)
      el clic ja usa selectClient però per seguretat
      també els clicks de la llista millorada
   ───────────────────────────────────────────── */
function patchOverviewClicks() {
  // L'index.html usa selectClient directament al listener, ok.
  // Però supabase-db renderClientsList feia reload → ja patchejat a dalt.
  // Extra: si queda algun card sense patch, interceptar aquí.
  document.addEventListener('click', function(e) {
    const card = e.target.closest('.client-card[data-client-id]');
    if (!card) return;
    // Ja té listener des de renderClientsOverview (index.html l.826-831)
    // No fer res addicional.
  }, true);
}

/* ─────────────────────────────────────────────
   4. Obrir client directament (fallback)
   ───────────────────────────────────────────── */
async function openClientDirect(clientId) {
  state.currentClientId   = clientId;
  state.currentActivity   = state.currentActivity || ACTIVITIES.WORK;
  state.sessionElapsed    = 0;
  state.lastTick          = Date.now();
  window.isWorkpadInitialized  = false;
  window.areTasksInitialized   = false;
  await save();
  const client = await loadClient(clientId);
  if (client && typeof updateUI === 'function') {
    await updateUI(client);
    const panel = document.getElementById('clientInfoPanel');
    const btns  = document.getElementById('clientFixedButtons');
    if (panel) panel.style.display = 'block';
    if (btns)  btns.style.display  = 'grid';
  }
}

/* ─────────────────────────────────────────────
   5. Fotos d'IndexedDB
   ───────────────────────────────────────────── */
function patchLoadClientPhotos() {
  if (typeof window.loadClient !== 'function') return false;
  const _orig = window.loadClient;

  window.loadClient = async function(clientId) {
    if (!clientId) return null;
    const client = await _orig(clientId);
    if (!client) return null;
    if (client.photos && client.photos.length > 0) return client;

    if (window.db) {
      try {
        const photos = await new Promise(resolve => {
          try {
            const tx  = window.db.transaction(['photos'],'readonly');
            const req = tx.objectStore('photos').index('clientId').getAll(clientId);
            req.onsuccess = () => resolve(req.result||[]);
            req.onerror   = () => resolve([]);
          } catch(e) { resolve([]); }
        });
        if (photos.length > 0) {
          client.photos = photos.map(p=>({id:p.id,data:p.data,date:p.date,comment:p.comment||''}));
          console.log(`📷 [PATCH] ${photos.length} fotos per "${client.name}"`);
        }
      } catch(e) {}
    }

    client.photos       = client.photos       || [];
    client.files        = client.files        || [];
    client.tasks        = client.tasks        || {urgent:'',important:'',later:''};
    client.notes        = client.notes        || '';
    client.total        = client.total        || 0;
    client.billableTime = client.billableTime || 0;
    client.active       = true;
    return client;
  };

  console.log('✅ [PATCH] loadClient+fotos activat');
  return true;
}

/* ─────────────────────────────────────────────
   INIT
   ───────────────────────────────────────────── */
async function initPatch() {
  // Esperar loadClient
  for (let i=0; i<80 && typeof window.loadClient!=='function'; i++) {
    await new Promise(r=>setTimeout(r,100));
  }

  patchRenderClientsList();
  patchOverviewClicks();
  patchLoadClientPhotos();

  console.log('✅ [PATCH] Llest');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(initPatch, 800));
} else {
  setTimeout(initPatch, 800);
}

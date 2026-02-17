/*
 * PATCH.JS - FocusWork
 * 
 * PROBLEMA 1: renderClientCard() no existeix → error quan s'obre la llista de clients
 * PROBLEMA 2: fotos no apareixen al client
 */

console.log('🔧 [PATCH] Carregant...');

window.checkMigration = async function() { return true; };

// ─────────────────────────────────────────────
// FIX 1: renderClientCard — la funció que falta
// ─────────────────────────────────────────────
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
    waiting_material: '🟡 Esperant material',
    paused:           '⏸ Pausat',
    blocked:          '🔴 Bloquejat',
    ready_to_deliver: '✅ Llest per entregar',
  };

  const clientState  = client.state || 'in_progress';
  const color        = stateColors[clientState] || '#3b82f6';
  const stateLabel   = stateLabels[clientState] || clientState;
  const progress     = client.progress || 1;
  const progressDots = Array.from({length: 5}, (_, i) =>
    `<span style="
      width:10px; height:10px; border-radius:50%; display:inline-block;
      background:${i < progress ? color : 'rgba(255,255,255,0.15)'};
      margin-right:3px;
    "></span>`
  ).join('');

  // Data d'entrega
  let deliveryHtml = '';
  if (client.deliveryDate) {
    const delivery  = new Date(client.deliveryDate);
    const today     = new Date();
    today.setHours(0,0,0,0);
    delivery.setHours(0,0,0,0);
    const diffDays  = Math.ceil((delivery - today) / 86400000);
    let deliveryText, deliveryColor;
    if      (diffDays < 0)  { deliveryText = `⚠️ Vençut fa ${Math.abs(diffDays)}d`;  deliveryColor = '#ef4444'; }
    else if (diffDays === 0){ deliveryText = '🔴 Entrega AVUI';                       deliveryColor = '#ef4444'; }
    else if (diffDays === 1){ deliveryText = '🟡 Entrega DEMÀ';                       deliveryColor = '#f59e0b'; }
    else if (diffDays <= 3) { deliveryText = `🟡 Entrega en ${diffDays} dies`;        deliveryColor = '#f59e0b'; }
    else                    { deliveryText = `📅 ${delivery.toLocaleDateString('ca-ES',{day:'2-digit',month:'2-digit'})}`; deliveryColor = '#94a3b8'; }
    deliveryHtml = `<span style="font-size:11px;color:${deliveryColor};margin-left:8px;">${deliveryText}</span>`;
  }

  return `
    <div class="client-card" data-client-id="${client.id}" style="
      padding: 16px;
      margin-bottom: 12px;
      background: rgba(255,255,255,0.05);
      border-radius: 12px;
      cursor: pointer;
      border-left: 4px solid ${color};
      transition: all 0.2s;
    "
    onmouseover="this.style.background='rgba(255,255,255,0.09)'"
    onmouseout="this.style.background='rgba(255,255,255,0.05)'"
    >
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div style="flex:1;">
          <div style="font-size:16px;font-weight:700;color:#f1f5f9;margin-bottom:4px;">
            ${client.name || 'Sense nom'}
          </div>
          <div style="font-size:12px;color:#94a3b8;margin-bottom:6px;">
            ${client.email || ''} ${client.phone ? '· ' + client.phone : ''}
            ${client.company ? '· ' + client.company : ''}
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <span style="font-size:11px;color:${color};background:${color}22;
              padding:2px 8px;border-radius:10px;">${stateLabel}</span>
            ${deliveryHtml}
          </div>
        </div>
        <div style="text-align:right;margin-left:12px;flex-shrink:0;">
          <div style="font-size:12px;color:#4ade80;margin-bottom:6px;">
            ${client.total ? '⏱ ' + formatTime(client.total) : ''}
          </div>
          <div>${progressDots}</div>
        </div>
      </div>
    </div>`;
};

// ─────────────────────────────────────────────
// FIX 2: fotos d'IndexedDB
// S'executa quan loadClient ja existeix
// ─────────────────────────────────────────────
function patchLoadClient() {
  if (typeof window.loadClient !== 'function') return false;

  const _orig = window.loadClient;
  window.loadClient = async function(clientId) {
    if (!clientId) return null;
    const client = await _orig(clientId);
    if (!client) return null;

    // Si ja té fotos no cal fer res
    if (client.photos && client.photos.length > 0) return client;

    // Carregar fotos d'IndexedDB
    if (window.db) {
      try {
        const photos = await new Promise(resolve => {
          try {
            const tx  = window.db.transaction(['photos'], 'readonly');
            const req = tx.objectStore('photos').index('clientId').getAll(clientId);
            req.onsuccess = () => resolve(req.result || []);
            req.onerror   = () => resolve([]);
          } catch(e) { resolve([]); }
        });
        if (photos.length > 0) {
          client.photos = photos.map(p => ({
            id: p.id, data: p.data, date: p.date, comment: p.comment || ''
          }));
          console.log(`📷 [PATCH] ${photos.length} fotos per "${client.name}"`);
        }
      } catch(e) {}
    }

    client.photos       = client.photos       || [];
    client.files        = client.files        || [];
    client.tasks        = client.tasks        || { urgent:'', important:'', later:'' };
    client.notes        = client.notes        || '';
    client.total        = client.total        || 0;
    client.billableTime = client.billableTime || 0;
    client.active       = true;
    return client;
  };

  console.log('✅ [PATCH] loadClient amb fotos activat');
  return true;
}

// ─────────────────────────────────────────────
// INICIALITZACIÓ
// ─────────────────────────────────────────────
async function initPatch() {
  let tries = 0;
  while (typeof window.loadClient !== 'function' && tries < 80) {
    await new Promise(r => setTimeout(r, 100));
    tries++;
  }
  patchLoadClient();
  console.log('✅ [PATCH] Inicialitzat');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(initPatch, 500));
} else {
  setTimeout(initPatch, 500);
}

console.log('✅ [PATCH] Fitxer carregat');

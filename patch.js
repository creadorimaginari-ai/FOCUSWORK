/*
 * patch.js — FocusWork (versió mínima)
 * Els location.reload() ja estan arreglats a supabase-db.js i app-ui.js directament.
 * Aquest patch només cobreix:
 *  1. checkMigration
 *  2. renderClientCard (usada per index.html)
 *  3. Garantir photos=[] per evitar crashes
 */

window.checkMigration = async function() { return true; };

/* ── renderClientCard ── */
window.renderClientCard = function(client) {
  const stateColors = {
    in_progress:      '#3b82f6',
    waiting_feedback: '#8b5cf6',
    waiting_material: '#f59e0b',
    waiting_budget:   '#f97316',
    paused:           '#64748b',
    blocked:          '#ef4444',
    ready_to_deliver: '#10b981',
  };
  // Usar t() per traduccions si disponible
  const _t = (typeof t === 'function') ? t : (k => k);
  const stateLabels = {
    in_progress:      _t('state_in_progress'),
    waiting_feedback: _t('state_waiting_feedback'),
    waiting_material: _t('state_waiting_material'),
    waiting_budget:   _t('state_waiting_budget'),
    paused:           _t('state_paused'),
    blocked:          _t('state_blocked'),
    ready_to_deliver: _t('state_ready'),
  };
  const cs    = client.state || 'in_progress';
  const color = stateColors[cs] || '#3b82f6';
  const label = stateLabels[cs] || cs;
  const prog  = client.progress || 1;
  const dots  = Array.from({length:5},(_,i)=>
    `<span style="width:9px;height:9px;border-radius:50%;display:inline-block;
     background:${i<prog?color:'rgba(255,255,255,0.15)'};margin-right:3px;"></span>`
  ).join('');

  let deliveryHtml = '';
  if (client.deliveryDate) {
    const del = new Date(client.deliveryDate);
    const now = new Date(); now.setHours(0,0,0,0); del.setHours(0,0,0,0);
    const diff = Math.ceil((del-now)/86400000);
    const [txt,col] = diff<0  ? [`⚠️ Vençut fa ${Math.abs(diff)}d`,'#ef4444']
                    : diff===0? ['🔴 AVUI','#ef4444']
                    : diff===1? ['🟡 DEMÀ','#f59e0b']
                    : diff<=3 ? [`🟡 ${diff} dies`,'#f59e0b']
                    :           [`📅 ${del.toLocaleDateString('ca-ES',{day:'2-digit',month:'2-digit'})}`,'#94a3b8'];
    deliveryHtml = `<span style="font-size:11px;color:${col};margin-left:8px;">${txt}</span>`;
  }

  const timeStr = typeof formatTime==='function' && (client.total||0)>0
    ? `<span style="font-size:12px;color:#4ade80;margin-top:4px;display:block;">⏱ ${formatTime(client.total)}</span>`
    : '';

  return `
    <div class="client-card" data-client-id="${client.id}" style="
      padding:16px;margin-bottom:12px;background:rgba(255,255,255,0.05);
      border-radius:12px;cursor:pointer;border-left:4px solid ${color};transition:background 0.2s;"
      onmouseover="this.style.background='rgba(255,255,255,0.09)'"
      onmouseout="this.style.background='rgba(255,255,255,0.05)'">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
        <div style="flex:1;min-width:0;">
          <div style="font-size:16px;font-weight:700;color:#f1f5f9;margin-bottom:4px;">
            ${client.name||'Sense nom'}</div>
          <div style="font-size:12px;color:#94a3b8;">
            ${[client.email,client.phone,client.company].filter(Boolean).join(' · ')}</div>
          <div style="display:flex;align-items:center;flex-wrap:wrap;gap:4px;margin-top:6px;">
            <span style="font-size:11px;color:${color};background:${color}22;
              padding:2px 8px;border-radius:10px;">${label}</span>
            ${deliveryHtml}
          </div>
        </div>
        <div style="text-align:right;flex-shrink:0;">
          ${timeStr}
          <div style="margin-top:6px;">${dots}</div>
        </div>
      </div>
    </div>`;
};

/* ── Garantir photos=[] a loadClient per evitar crashes ── */
document.addEventListener('DOMContentLoaded', function() {
  const wait = setInterval(() => {
    if (typeof window.loadClient !== 'function') return;
    clearInterval(wait);

    const _orig = window.loadClient;
    window.loadClient = async function(clientId) {
      if (!clientId) return null;
      const client = await _orig(clientId);
      if (!client) return null;
      client.photos = client.photos || [];
      client.files  = client.files  || [];
      client.tasks  = client.tasks  || {urgent:'',important:'',later:''};
      client.notes  = client.notes  || '';
      client.active = true;
      // Fotos d'IndexedDB si no n'hi ha
      if (client.photos.length === 0 && window.db) {
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
            client.photos = photos.map(p=>({
              id:p.id, data:p.data, date:p.date, comment:p.comment||''
            }));
          }
        } catch(e) {}
      }
      return client;
    };
    console.log('✅ [PATCH] loadClient protegit');
  }, 100);
});

console.log('✅ [PATCH] Carregat');

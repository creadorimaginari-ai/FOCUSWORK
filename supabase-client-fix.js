/*************************************************
 * FOCUSWORK - SISTEMA DE CLIENTS DEFINITIU
 * 
 * Substitueix tot el codi conflictiu amb un sistema
 * simple, net i sense bucles.
 * 
 * INSTRUCCIONS:
 * 1. Afegir a index.html DESPRÉS de tots els scripts:
 *    <script src="supabase-client-fix.js"></script>
 * 2. Neteja cache i recarrega
 *************************************************/

(function() {
  'use strict';
  
  console.log('🔧 Sistema de clients definitiu carregant...');
  
  // Esperar que tot estigui carregat
  let initAttempts = 0;
  const waitForReady = setInterval(function() {
    initAttempts++;
    if (initAttempts > 100) {
      clearInterval(waitForReady);
      console.error('❌ Timeout esperant inicialització');
      return;
    }
    
    if (!window.supabase || !window.db || !window.state) return;
    
    clearInterval(waitForReady);
    init();
  }, 100);
  
  async function init() {
    console.log('✅ Sistema de clients iniciant...');
    
    // ═══════════════════════════════════════════════
    // DEFINIR FUNCIONS (sobreescriu les antigues)
    // ═══════════════════════════════════════════════
    
    window.checkMigration = async function() { return true; };
    
    window.loadAllClientsSupabase = async function() {
      try {
        const { data, error } = await window.supabase
          .from('clients')
          .select('id,name,email,phone,company,notes,status,activities,tags,created_at')
          .order('created_at', { ascending: false });
        if (error) throw error;
        
        const clients = {};
        data.forEach(c => {
          c.active = true;
          c.total = c.total || 0;
          c.billableTime = 0;
          clients[c.id] = c;
        });
        return clients;
      } catch(e) {
        console.error('Error loadAll:', e.message);
        return {};
      }
    };
    
    window.loadClientSupabase = async function(clientId) {
      try {
        const { data, error } = await window.supabase
          .from('clients')
          .select('id,name,email,phone,company,notes,status,activities,tags,created_at')
          .eq('id', clientId)
          .limit(1);
        if (error || !data || !data.length) return null;
        const c = data[0];
        c.active = true;
        c.total = c.total || 0;
        c.billableTime = 0;
        return c;
      } catch(e) {
        return null;
      }
    };
    
    window.saveClientSupabase = async function(client) {
      const d = {
        id: client.id,
        name: client.name || '',
        email: client.email || null,
        phone: client.phone || null,
        company: client.company || null,
        notes: client.notes || null,
        status: client.status || 'active',
        activities: client.activities || {},
        tags: client.tags || [],
        created_at: client.created_at || new Date().toISOString()
      };
      try {
        const { error } = await window.supabase.from('clients').upsert(d, { onConflict: 'id' });
        return !error;
      } catch(e) {
        return false;
      }
    };
    
    window.deleteClientSupabase = async function(id) {
      try {
        const { error } = await window.supabase.from('clients').delete().eq('id', id);
        return !error;
      } catch(e) {
        return false;
      }
    };
    
    // ═══════════════════════════════════════════════
    // RENDERITZAR LLISTA (només quan es demana)
    // ═══════════════════════════════════════════════
    
    window.updateProjectList = function() {
      const container = document.querySelector('#clientsListContainer')
        || document.querySelector('#projectList');
      
      if (!container) return;
      
      const allClients = Object.values(window.state?.clients || {});
      const clients = allClients
        .filter(c => {
          const s = (c.status||'').toLowerCase();
          return s !== 'archived' && s !== 'deleted';
        })
        .sort((a,b) => new Date(b.created_at||0) - new Date(a.created_at||0));
      
      if (!clients.length) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:rgba(255,255,255,0.4)">No hi ha clients</div>';
        return;
      }
      
      container.innerHTML = '';
      
      clients.forEach(function(client) {
        const card = document.createElement('div');
        card.className = 'project-card';
        
        const totalSec = client.total || 0;
        const h = Math.floor(totalSec / 3600);
        const m = Math.floor((totalSec % 3600) / 60);
        const timeStr = h > 0 ? h + 'h ' + m + 'm' : (m > 0 ? m + 'm' : '');
        
        card.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;padding:14px 16px;">' +
          '<div style="flex:1;min-width:0;">' +
            '<div style="font-size:16px;font-weight:600;color:white;margin-bottom:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' +
              (client.name || 'Sense nom') +
            '</div>' +
            '<div style="font-size:12px;color:rgba(255,255,255,0.5);margin-bottom:4px;">' +
              [client.email, client.phone].filter(Boolean).join(' • ') +
            '</div>' +
            (timeStr ? '<div style="font-size:11px;padding:2px 7px;background:rgba(76,175,80,0.2);border-radius:4px;color:#4CAF50;display:inline-block;">⏱ ' + timeStr + '</div>' : '') +
          '</div>' +
        '</div>';
        
        card.onclick = async function(e) {
          e.stopPropagation();
          window.state.currentClientId = client.id;
          try { if (window.save) await window.save(); } catch(err) {}
          location.reload();
        };
        
        container.appendChild(card);
      });
      
      console.log('✅ ' + clients.length + ' clients renderitzats');
    };
    
    // ═══════════════════════════════════════════════
    // CARREGAR CLIENTS UN COP
    // ═══════════════════════════════════════════════
    
    async function loadClients() {
      console.log('📥 Carregant clients...');
      const clients = await window.loadAllClientsSupabase();
      window.state.clients = clients;
      console.log('✅ ' + Object.keys(clients).length + ' clients carregats');
      
      // Només renderitzar si el contenidor és visible
      const container = document.querySelector('#clientsListContainer')
        || document.querySelector('#projectList');
      if (container && container.offsetParent !== null) {
        window.updateProjectList();
      }
    }
    
    // Carregar clients UN COP
    loadClients();
    
    console.log('✅ Sistema de clients definitiu actiu');
  }
  
})();

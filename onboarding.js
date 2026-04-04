/*************************************************
 * FOCUSWORK — onboarding.js
 * Modal de benvinguda amb slides visuals
 * S'activa la primera vegada (sense userName)
 * Sobreescriu _showNewOnboarding() de app-core.js
 *************************************************/

window._showNewOnboarding = function() {

  if (document.getElementById('fwOnboarding')) return;

  const SLIDES = [
    {
      isLangStep: true,
    },
    {
      emoji: '⏱️',
      title: 'Controla el teu temps',
      color: 'from #f97316 to #ea580c',
      features: [
        { icon: '▶️', text: 'Timer per client amb un sol toc' },
        { icon: '📊', text: 'Resum d\'hores i estadístiques' },
        { icon: '⏰', text: 'Horari de focus configurable' },
      ]
    },
    {
      emoji: '📷',
      title: 'Documenta cada projecte',
      color: 'from #8b5cf6 to #6d28d9',
      features: [
        { icon: '🖼️', text: 'Fotos amb anotacions i dibuix' },
        { icon: '📎', text: 'Adjunta arxius, PDFs i documents' },
        { icon: '📝', text: 'Notes i comentaris per cada treball' },
      ]
    },
    {
      emoji: '📋',
      title: 'Genera informes i factura',
      color: 'from #0ea5e9 to #0369a1',
      features: [
        { icon: '📄', text: 'Informe de projecte amb un clic' },
        { icon: '💶', text: 'Resum de material, hores i transport' },
        { icon: '🔄', text: 'Còpia de seguretat automàtica' },
      ]
    },
    {
      emoji: '👋',
      title: 'Com et diuen?',
      color: 'from #10b981 to #059669',
      isNameStep: true,
    }
  ];

  let current = 0;

  const overlay = document.createElement('div');
  overlay.id = 'fwOnboarding';
  overlay.style.cssText = `
    position:fixed; inset:0; z-index:99999;
    display:flex; align-items:flex-end; justify-content:center;
    background:rgba(0,0,0,0.6); backdrop-filter:blur(8px);
    padding:0;
  `;

  function buildSlide(s, idx) {
    if (s.isLangStep) {
      return `
        <div class="fw-slide${idx===0?' active':''}" data-idx="${idx}" style="width:100%;padding:40px 28px 24px;text-align:center;">
          <div style="font-size:48px;margin-bottom:16px;">🌐</div>
          <div style="font-size:22px;font-weight:800;color:#fff;margin-bottom:8px;">FocusWork</div>
          <div style="font-size:14px;color:rgba(255,255,255,0.6);margin-bottom:32px;">Tria el teu idioma · Elige tu idioma · Choose your language</div>
          <div style="display:flex;flex-direction:column;gap:12px;">
            <button class="fw-lang-btn" data-lang="ca" onclick="window._fwSetLang('ca')">
              🇪🇸 <span style="margin-left:4px;">Català</span>
            </button>
            <button class="fw-lang-btn" data-lang="es" onclick="window._fwSetLang('es')">
              🇪🇸 <span style="margin-left:4px;">Castellano</span>
            </button>
            <button class="fw-lang-btn" data-lang="en" onclick="window._fwSetLang('en')">
              🇬🇧 <span style="margin-left:4px;">English</span>
            </button>
          </div>
        </div>
      `;
    }
    if (s.isNameStep) {
      return `
        <div class="fw-slide${idx===0?' active':''}" data-idx="${idx}" style="width:100%;padding:32px 28px 20px;">
          <div style="font-size:56px;margin-bottom:8px;">${s.emoji}</div>
          <div style="font-size:22px;font-weight:800;color:#fff;margin-bottom:6px;">${s.title}</div>
          <div style="font-size:14px;color:rgba(255,255,255,0.6);margin-bottom:24px;">
            Aquest nom apareixerà als teus informes
          </div>
          <input class="fw-nameInput" id="fwNameInput" type="text" placeholder="El teu nom..." maxlength="50" autocomplete="name">
          <div id="fwNameError" style="color:#fca5a5;font-size:13px;margin-top:6px;display:none;">
            ❌ Introdueix el teu nom per continuar
          </div>
          <button class="fw-btn-primary" id="fwConfirmBtn" style="margin-top:16px;">
            🚀 Començar a usar FocusWork
          </button>
          <div style="font-size:11px;color:rgba(255,255,255,0.35);margin-top:10px;text-align:center;">
            Versió de prova · 2 clients gratuïts · Llicència completa 34€
          </div>
        </div>
      `;
    }
    return `
      <div class="fw-slide${idx===0?' active':''}" data-idx="${idx}" style="width:100%;padding:32px 28px 20px;">
        <div style="font-size:56px;margin-bottom:8px;">${s.emoji}</div>
        <div style="font-size:22px;font-weight:800;color:#fff;margin-bottom:20px;">${s.title}</div>
        ${s.features.map(f=>`
          <div class="fw-feat">
            <span style="font-size:20px;flex-shrink:0;">${f.icon}</span>
            <span style="font-size:14px;color:rgba(255,255,255,0.85);line-height:1.4;">${f.text}</span>
          </div>
        `).join('')}
        <button class="fw-btn-primary" onclick="window._fwNextSlide()" style="margin-top:16px;animation:none;">
          Següent →
        </button>
      </div>
    `;
  }

  const gradients = [
    'linear-gradient(160deg,#1e293b,#0f172a)',
    'linear-gradient(160deg,#f97316,#ea580c)',
    'linear-gradient(160deg,#8b5cf6,#6d28d9)',
    'linear-gradient(160deg,#0ea5e9,#0369a1)',
    'linear-gradient(160deg,#10b981,#059669)',
  ];

  overlay.innerHTML = `
    <div id="fwOnboardingCard" style="
      width:100%; max-width:480px;
      background:${gradients[0]};
      border-radius:24px 24px 0 0;
      overflow:hidden;
      transition: background 0.4s ease;
      position:relative;
    ">
      <!-- Skip -->
      <div style="display:flex;justify-content:flex-end;padding:16px 20px 0;">
        <button class="fw-skip" id="fwSkipBtn">Saltar introducció</button>
      </div>

      <!-- Slides -->
      <div id="fwSlidesContainer">
        ${SLIDES.map((s,i) => buildSlide(s,i)).join('')}
      </div>

      <!-- Dots -->
      <div style="display:flex;justify-content:center;gap:6px;padding:0 0 28px;">
        ${SLIDES.map((_,i)=>`<div class="fw-dot${i===0?' active':''}" onclick="window._fwGoSlide(${i})"></div>`).join('')}
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // ── Navegació ────────────────────────────────────────────────────────────────
  // Funció selecció d'idioma
  window._fwSetLang = function(lang) {
    if (typeof applyLang === 'function') applyLang(lang);
    // Marcar botó actiu
    overlay.querySelectorAll('.fw-lang-btn').forEach(b => {
      b.style.background = b.dataset.lang === lang
        ? 'rgba(249,115,22,0.9)'
        : 'rgba(255,255,255,0.1)';
      b.style.borderColor = b.dataset.lang === lang
        ? '#f97316'
        : 'rgba(255,255,255,0.2)';
      b.style.fontWeight = b.dataset.lang === lang ? '800' : '600';
    });
    // Avançar al següent slide després de 400ms
    setTimeout(() => window._fwNextSlide(), 400);
  };

  window._fwGoSlide = function(idx) {
    const slides = overlay.querySelectorAll('.fw-slide');
    const dots   = overlay.querySelectorAll('.fw-dot');
    const card   = document.getElementById('fwOnboardingCard');
    slides.forEach((s,i) => s.classList.toggle('active', i===idx));
    dots.forEach((d,i)   => d.classList.toggle('active', i===idx));
    card.style.background = gradients[idx];
    current = idx;
  };

  window._fwNextSlide = function() {
    if (current < SLIDES.length - 1) window._fwGoSlide(current + 1);
  };

  // ── Skip ─────────────────────────────────────────────────────────────────────
  document.getElementById('fwSkipBtn').addEventListener('click', () => {
    window._fwGoSlide(SLIDES.length - 1);
  });

  // ── Confirmar nom ─────────────────────────────────────────────────────────────
  function confirmName() {
    const input = document.getElementById('fwNameInput');
    const error = document.getElementById('fwNameError');
    const name  = input ? input.value.trim() : '';
    if (!name) {
      if (error) error.style.display = 'block';
      if (input) { input.style.borderColor='rgba(248,113,113,0.8)'; input.focus(); }
      return;
    }
    // Guardar
    window.userName = name;
    localStorage.setItem('focowork_user_name', name);

    // Tancar amb animació
    const card = document.getElementById('fwOnboardingCard');
    card.style.transition = 'transform 0.35s ease, opacity 0.35s ease';
    card.style.transform  = 'translateY(100%)';
    card.style.opacity    = '0';
    overlay.style.transition = 'opacity 0.35s ease';
    setTimeout(() => {
      overlay.remove();
      // Inicialitzar app
      if (typeof updateUI === 'function') updateUI();
      if (typeof scheduleFullAutoBackup === 'function') scheduleFullAutoBackup();
      // Missatge de benvinguda
      if (typeof showAlert === 'function') {
        showAlert(`Hola ${name}! 👋`, 'Comença creant el teu primer encàrrec amb el botó ➕', '🎉');
      }
    }, 350);
  }

  // Botó confirmar
  const confirmBtn = document.getElementById('fwConfirmBtn');
  if (confirmBtn) confirmBtn.addEventListener('click', confirmName);

  // Enter al camp nom
  overlay.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const input = document.getElementById('fwNameInput');
      if (input && document.activeElement === input) confirmName();
      else if (current < SLIDES.length - 1) window._fwNextSlide();
    }
  });

  // Swipe esquerra/dreta
  let tsX = 0;
  overlay.addEventListener('touchstart', e => { tsX = e.touches[0].clientX; }, { passive:true });
  overlay.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - tsX;
    if (Math.abs(dx) > 50) {
      if (dx < 0 && current < SLIDES.length-1) window._fwGoSlide(current+1);
      if (dx > 0 && current > 0)               window._fwGoSlide(current-1);
    }
  }, { passive:true });

  // Focus al camp de nom quan arribes a l'últim slide
  const observer = new MutationObserver(() => {
    const input = document.getElementById('fwNameInput');
    if (input && input.closest('.active')) {
      setTimeout(() => input.focus(), 100);
      observer.disconnect();
    }
  });
  observer.observe(overlay, { subtree:true, attributeFilter:['class'] });
};

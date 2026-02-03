/* ===============================
   EFECTE RIPPLE PER BOTONS
   Afegeix aquest script després de carregar el DOM
   =============================== */

(function() {
  'use strict';
  
  // Funció per crear l'efecte ripple
  function createRipple(event) {
    const button = event.currentTarget;
    
    // Crear element ripple
    const ripple = document.createElement('span');
    ripple.classList.add('ripple-circle');
    
    // Obtenir posició del clic
    const rect = button.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Posicionar el ripple
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';
    
    // Afegir al botó
    button.appendChild(ripple);
    
    // Eliminar després de l'animació
    setTimeout(() => {
      ripple.remove();
    }, 600);
  }
  
  // Aplicar a tots els botons principals
  function initRippleEffect() {
    const buttons = document.querySelectorAll(
      '#newClientBtn, ' +
      '#newClient, ' +
      '#focusPriorityBtn, ' +
      '.grid.centered button, ' +
      '#clientMainButtons button, ' +
      'button.primary'
    );
    
    buttons.forEach(button => {
      // Eliminar event listener anterior si existeix
      button.removeEventListener('click', createRipple);
      // Afegir nou event listener
      button.addEventListener('click', createRipple);
    });
  }
  
  // Inicialitzar quan el DOM estigui carregat
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initRippleEffect);
  } else {
    initRippleEffect();
  }
  
  // Re-inicialitzar si es creen nous botons dinàmicament
  // (útil si l'app crea botons després de carregar)
  const observer = new MutationObserver(() => {
    initRippleEffect();
  });
  
  // Observar canvis al DOM
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
})();

/* ===============================
   EFECTE DE VIBRACIÓ (opcional)
   Descomentar per afegir vibració al mòbil
   =============================== */

/*
function addVibrationFeedback() {
  const buttons = document.querySelectorAll(
    '#newClientBtn, #focusPriorityBtn, .grid.centered button'
  );
  
  buttons.forEach(button => {
    button.addEventListener('click', () => {
      // Vibrar 10ms si el dispositiu ho suporta
      if ('vibrate' in navigator) {
        navigator.vibrate(10);
      }
    });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', addVibrationFeedback);
} else {
  addVibrationFeedback();
}
*/

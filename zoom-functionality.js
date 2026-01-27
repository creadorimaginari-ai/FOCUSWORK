/* ================= ZOOM I PAN PER EDITOR DE FOTOS ================= */

// Variables globals per zoom i pan
let currentZoom = 1;
let minZoom = 1;
let maxZoom = 4;
let panX = 0;
let panY = 0;
let canvasWrapper = null;

// Variables per pinch-to-zoom
let initialDistance = 0;
let initialZoom = 1;

// Variables per doble tap
let lastTap = 0;
let doubleTapTimeout = null;

// Variables per pan (arrossegar)
let isPanning = false;
let panStartX = 0;
let panStartY = 0;
let lastPanX = 0;
let lastPanY = 0;

/**
 * Inicialitzar el sistema de zoom
 * Aquesta funció ha de cridar-se quan s'obre el lightbox
 */
function initZoomSystem() {
  const container = document.querySelector('.lightbox-canvas-container');
  if (!container) return;
  
  // Crear wrapper si no existeix
  if (!canvasWrapper) {
    canvasWrapper = document.createElement('div');
    canvasWrapper.className = 'canvas-wrapper';
    
    const canvas = document.getElementById('photoCanvas');
    if (!canvas) return;
    
    // Inserir wrapper entre container i canvas
    container.appendChild(canvasWrapper);
    canvasWrapper.appendChild(canvas);
  }
  
  // Crear controls de zoom si no existeixen
  createZoomControls(container);
  
  // Crear indicador de zoom
  createZoomIndicator(container);
  
  // Reset zoom quan s'obre una nova foto
  resetZoom();
  
  // Afegir event listeners per zoom
  setupZoomListeners();
}

/**
 * Crear botons de zoom (+/-)
 */
function createZoomControls(container) {
  if (document.querySelector('.zoom-controls')) return;
  
  const controls = document.createElement('div');
  controls.className = 'zoom-controls';
  controls.innerHTML = `
    <button class="zoom-btn" id="zoomInBtn" title="Ampliar (Doble tap)">+</button>
    <button class="zoom-btn" id="zoomOutBtn" title="Reduir">−</button>
    <button class="zoom-btn" id="zoomResetBtn" title="Reset" style="font-size: 16px;">⊙</button>
  `;
  
  container.appendChild(controls);
  
  // Event listeners dels botons
  document.getElementById('zoomInBtn').addEventListener('click', () => zoomIn());
  document.getElementById('zoomOutBtn').addEventListener('click', () => zoomOut());
  document.getElementById('zoomResetBtn').addEventListener('click', () => resetZoom());
}

/**
 * Crear indicador de zoom percentatge
 */
function createZoomIndicator(container) {
  if (document.querySelector('.zoom-indicator')) return;
  
  const indicator = document.createElement('div');
  indicator.className = 'zoom-indicator';
  indicator.id = 'zoomIndicator';
  indicator.textContent = '100%';
  
  container.appendChild(indicator);
}

/**
 * Actualitzar la visualització del zoom
 */
function updateZoomDisplay() {
  if (!canvasWrapper) return;
  
  // Aplicar transformació
  canvasWrapper.style.transform = `translate(${panX}px, ${panY}px) scale(${currentZoom})`;
  
  // Actualitzar indicador
  const indicator = document.getElementById('zoomIndicator');
  if (indicator) {
    indicator.textContent = `${Math.round(currentZoom * 100)}%`;
    indicator.classList.add('visible');
    
    // Amagar després de 1.5s
    clearTimeout(window.zoomIndicatorTimeout);
    window.zoomIndicatorTimeout = setTimeout(() => {
      indicator.classList.remove('visible');
    }, 1500);
  }
  
  // Actualitzar estat dels botons
  const zoomInBtn = document.getElementById('zoomInBtn');
  const zoomOutBtn = document.getElementById('zoomOutBtn');
  
  if (zoomInBtn) zoomInBtn.disabled = currentZoom >= maxZoom;
  if (zoomOutBtn) zoomOutBtn.disabled = currentZoom <= minZoom;
  
  // Canviar cursor segons zoom
  const canvas = document.getElementById('photoCanvas');
  if (canvas && !drawingEnabled) {
    if (currentZoom > 1) {
      canvas.classList.add('can-grab');
    } else {
      canvas.classList.remove('can-grab');
    }
  }
}

/**
 * Fer zoom in (ampliar)
 */
function zoomIn() {
  if (currentZoom >= maxZoom) return;
  
  const newZoom = Math.min(currentZoom * 1.3, maxZoom);
  setZoom(newZoom);
}

/**
 * Fer zoom out (reduir)
 */
function zoomOut() {
  if (currentZoom <= minZoom) return;
  
  const newZoom = Math.max(currentZoom / 1.3, minZoom);
  setZoom(newZoom);
}

/**
 * Establir un zoom específic
 */
function setZoom(zoom, centerX = null, centerY = null) {
  const oldZoom = currentZoom;
  currentZoom = Math.max(minZoom, Math.min(maxZoom, zoom));
  
  // Si s'especifica un punt central, ajustar pan per mantenir aquest punt fix
  if (centerX !== null && centerY !== null) {
    const zoomFactor = currentZoom / oldZoom;
    panX = centerX - (centerX - panX) * zoomFactor;
    panY = centerY - (centerY - panY) * zoomFactor;
  }
  
  // Limitar pan dins dels límits
  constrainPan();
  
  updateZoomDisplay();
}

/**
 * Reset zoom a 1x
 */
function resetZoom() {
  currentZoom = 1;
  panX = 0;
  panY = 0;
  updateZoomDisplay();
}

/**
 * Limitar el pan perquè la imatge no surti massa dels límits
 */
function constrainPan() {
  if (currentZoom <= 1) {
    panX = 0;
    panY = 0;
    return;
  }
  
  const canvas = document.getElementById('photoCanvas');
  const container = document.querySelector('.lightbox-canvas-container');
  if (!canvas || !container) return;
  
  const canvasRect = canvas.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  
  // Calcular límits màxims de pan
  const maxPanX = (canvasRect.width * currentZoom - canvasRect.width) / 2;
  const maxPanY = (canvasRect.height * currentZoom - canvasRect.height) / 2;
  
  // Aplicar límits amb una mica de marge (50px)
  const margin = 50;
  panX = Math.max(-maxPanX - margin, Math.min(maxPanX + margin, panX));
  panY = Math.max(-maxPanY - margin, Math.min(maxPanY + margin, panY));
}

/**
 * Configurar event listeners per zoom
 */
function setupZoomListeners() {
  const canvas = document.getElementById('photoCanvas');
  if (!canvas) return;
  
  // Pinch-to-zoom (mòbil)
  canvas.addEventListener('touchstart', handlePinchStart, { passive: false });
  canvas.addEventListener('touchmove', handlePinchMove, { passive: false });
  canvas.addEventListener('touchend', handlePinchEnd, { passive: false });
  
  // Doble tap per zoom (mòbil)
  canvas.addEventListener('touchend', handleDoubleTap, { passive: false });
  
  // Mouse wheel zoom (PC)
  canvas.addEventListener('wheel', handleWheelZoom, { passive: false });
  
  // Pan amb mouse (PC) - només si hi ha zoom
  canvas.addEventListener('mousedown', handlePanStart);
  canvas.addEventListener('mousemove', handlePanMove);
  canvas.addEventListener('mouseup', handlePanEnd);
  canvas.addEventListener('mouseleave', handlePanEnd);
  
  // Pan amb touch (mòbil) - només si hi ha zoom i NO es dibuixa
  canvas.addEventListener('touchstart', handleTouchPanStart, { passive: false });
  canvas.addEventListener('touchmove', handleTouchPanMove, { passive: false });
  canvas.addEventListener('touchend', handleTouchPanEnd, { passive: false });
}

/**
 * Gestió de pinch-to-zoom
 */
function handlePinchStart(e) {
  if (e.touches.length === 2) {
    e.preventDefault();
    
    const touch1 = e.touches[0];
    const touch2 = e.touches[1];
    
    initialDistance = Math.hypot(
      touch2.clientX - touch1.clientX,
      touch2.clientY - touch1.clientY
    );
    
    initialZoom = currentZoom;
  }
}

function handlePinchMove(e) {
  if (e.touches.length === 2) {
    e.preventDefault();
    
    const touch1 = e.touches[0];
    const touch2 = e.touches[1];
    
    const currentDistance = Math.hypot(
      touch2.clientX - touch1.clientX,
      touch2.clientY - touch1.clientY
    );
    
    const scale = currentDistance / initialDistance;
    const newZoom = initialZoom * scale;
    
    // Calcular punt central entre els dos dits
    const centerX = (touch1.clientX + touch2.clientX) / 2;
    const centerY = (touch1.clientY + touch2.clientY) / 2;
    
    // Convertir a coordenades relatives al canvas
    const canvas = document.getElementById('photoCanvas');
    const rect = canvas.getBoundingClientRect();
    const relX = centerX - rect.left - rect.width / 2;
    const relY = centerY - rect.top - rect.height / 2;
    
    setZoom(newZoom, relX, relY);
  }
}

function handlePinchEnd(e) {
  if (e.touches.length < 2) {
    initialDistance = 0;
  }
}

/**
 * Doble tap per fer zoom in/out
 */
function handleDoubleTap(e) {
  const now = Date.now();
  const timeSinceLastTap = now - lastTap;
  
  if (timeSinceLastTap < 300 && timeSinceLastTap > 0) {
    e.preventDefault();
    
    // Alternar entre zoom 1x i 2x
    if (currentZoom > 1.5) {
      resetZoom();
    } else {
      // Fer zoom al punt on s'ha fet doble tap
      const touch = e.changedTouches[0];
      const canvas = document.getElementById('photoCanvas');
      const rect = canvas.getBoundingClientRect();
      const relX = touch.clientX - rect.left - rect.width / 2;
      const relY = touch.clientY - rect.top - rect.height / 2;
      
      setZoom(2, relX, relY);
    }
    
    lastTap = 0;
  } else {
    lastTap = now;
  }
}

/**
 * Zoom amb mouse wheel (PC)
 */
function handleWheelZoom(e) {
  // Només fer zoom si es prem Ctrl o si ja hi ha zoom actiu
  if (!e.ctrlKey && currentZoom <= 1) return;
  
  e.preventDefault();
  
  const delta = e.deltaY > 0 ? 0.9 : 1.1;
  const newZoom = currentZoom * delta;
  
  // Calcular punt del mouse relatiu al canvas
  const canvas = document.getElementById('photoCanvas');
  const rect = canvas.getBoundingClientRect();
  const relX = e.clientX - rect.left - rect.width / 2;
  const relY = e.clientY - rect.top - rect.height / 2;
  
  setZoom(newZoom, relX, relY);
}

/**
 * Pan amb mouse (arrossegar quan hi ha zoom)
 */
function handlePanStart(e) {
  if (currentZoom <= 1 || drawingEnabled) return;
  
  isPanning = true;
  panStartX = e.clientX;
  panStartY = e.clientY;
  lastPanX = panX;
  lastPanY = panY;
  
  const canvas = document.getElementById('photoCanvas');
  canvas.classList.add('grabbing');
  canvas.classList.remove('can-grab');
  
  if (canvasWrapper) {
    canvasWrapper.classList.add('no-transition');
  }
}

function handlePanMove(e) {
  if (!isPanning) return;
  
  const deltaX = e.clientX - panStartX;
  const deltaY = e.clientY - panStartY;
  
  panX = lastPanX + deltaX;
  panY = lastPanY + deltaY;
  
  constrainPan();
  updateZoomDisplay();
}

function handlePanEnd(e) {
  if (!isPanning) return;
  
  isPanning = false;
  
  const canvas = document.getElementById('photoCanvas');
  canvas.classList.remove('grabbing');
  if (currentZoom > 1 && !drawingEnabled) {
    canvas.classList.add('can-grab');
  }
  
  if (canvasWrapper) {
    canvasWrapper.classList.remove('no-transition');
  }
}

/**
 * Pan amb touch (mòbil) - només quan hi ha zoom i NO es dibuixa
 */
function handleTouchPanStart(e) {
  if (e.touches.length !== 1 || currentZoom <= 1 || drawingEnabled) return;
  
  isPanning = true;
  panStartX = e.touches[0].clientX;
  panStartY = e.touches[0].clientY;
  lastPanX = panX;
  lastPanY = panY;
  
  if (canvasWrapper) {
    canvasWrapper.classList.add('no-transition');
  }
}

function handleTouchPanMove(e) {
  if (!isPanning || e.touches.length !== 1) return;
  
  e.preventDefault(); // Evitar scroll
  
  const deltaX = e.touches[0].clientX - panStartX;
  const deltaY = e.touches[0].clientY - panStartY;
  
  panX = lastPanX + deltaX;
  panY = lastPanY + deltaY;
  
  constrainPan();
  updateZoomDisplay();
}

function handleTouchPanEnd(e) {
  if (!isPanning) return;
  
  isPanning = false;
  
  if (canvasWrapper) {
    canvasWrapper.classList.remove('no-transition');
  }
}

/**
 * Netejar el sistema de zoom quan es tanca el lightbox
 */
function cleanupZoomSystem() {
  resetZoom();
  
  const controls = document.querySelector('.zoom-controls');
  const indicator = document.querySelector('.zoom-indicator');
  
  if (controls) controls.remove();
  if (indicator) indicator.remove();
}

// Exportar funcions globals
window.initZoomSystem = initZoomSystem;
window.cleanupZoomSystem = cleanupZoomSystem;
window.zoomIn = zoomIn;
window.zoomOut = zoomOut;
window.resetZoom = resetZoom;
window.setZoom = setZoom;

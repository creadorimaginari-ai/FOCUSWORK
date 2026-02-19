/*************************************************
 * FOCUSWORK – FACTURACIÓ + EMAILJS
 *
 * Quan es tanca un client, mostra un modal per
 * introduir les dades de facturació i envia un
 * correu automàtic via EmailJS.
 *
 * CONFIGURACIÓ:
 *  1. Registra't a https://www.emailjs.com (gratis fins 200/mes)
 *  2. Crea un "Email Service" (Gmail, Outlook...)
 *  3. Crea un "Email Template" amb les variables que veus a sendBillingEmail()
 *  4. Omple les constants de sota amb les teves claus
 *************************************************/

// ─── CONFIGURACIÓ EMAILJS (canvia aquests valors) ───────────────────────────
const EMAILJS_PUBLIC_KEY  = 'LA_TEVA_PUBLIC_KEY';   // Account > API Keys
const EMAILJS_SERVICE_ID  = 'service_xxxxxxx';       // Email Services > Service ID
const EMAILJS_TEMPLATE_ID = 'template_xxxxxxx';      // Email Templates > Template ID
const BILLING_EMAIL       = 'facturacio@empresa.com'; // Correu destinatari
// ────────────────────────────────────────────────────────────────────────────

// Inicialitzar EmailJS quan carregui la pàgina
(function initEmailJS() {
  const wait = setInterval(() => {
    if (typeof emailjs !== 'undefined') {
      emailjs.init(EMAILJS_PUBLIC_KEY);
      console.log('✅ EmailJS inicialitzat');
      clearInterval(wait);
    }
  }, 200);
})();

/* ─────────────────────────────────────────────
   MOSTRAR MODAL DE FACTURACIÓ
   Es crida des de confirmCloseClient() (app-ui.js)
───────────────────────────────────────────── */
function openBillingModal(clientId) {
  window._billingClientId = clientId;

  // Netejar camps
  const fields = ['billingHoresDisseny', 'billingHoresCollocacio',
                  'billingMaterial', 'billingDesplacament', 'billingNotes'];
  fields.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  // Mostrar modal
  const modal = document.getElementById('modalBillingDetails');
  if (modal) {
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
  }
}

/* ─────────────────────────────────────────────
   CONFIRMAR: recollir dades, enviar email i tancar
───────────────────────────────────────────── */
async function confirmBillingAndClose() {
  const clientId = window._billingClientId;
  if (!clientId) return;

  // Validació mínima
  const horesDisseny     = document.getElementById('billingHoresDisseny')?.value.trim() || '—';
  const horesCollocacio  = document.getElementById('billingHoresCollocacio')?.value.trim() || '—';
  const material         = document.getElementById('billingMaterial')?.value.trim();
  const desplacament     = document.getElementById('billingDesplacament')?.value.trim() || '—';
  const notes            = document.getElementById('billingNotes')?.value.trim() || '';

  if (!material) {
    alert('⚠️ Cal indicar el material i les mides abans de tancar.');
    document.getElementById('billingMaterial')?.focus();
    return;
  }

  // Tancar modal facturació
  closeBillingModal();

  // Carregar client per tenir el nom i temps total
  let client = null;
  try {
    client = await loadClient(clientId);
  } catch(e) {}

  const clientName  = client?.name || clientId;
  const totalHores  = client?.total ? formatTime(client.total) : '—';
  const tancarData  = new Date().toLocaleDateString('ca-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  // Enviar email
  try {
    await sendBillingEmail({
      client_name:       clientName,
      data_tancament:    tancarData,
      hores_disseny:     horesDisseny,
      hores_collocacio:  horesCollocacio,
      material_mides:    material,
      desplacament:      desplacament,
      total_hores:       totalHores,
      notes_addicionals: notes || '(sense notes)'
    });
    console.log('📧 Email de facturació enviat');
  } catch(e) {
    console.error('❌ Error enviant email:', e);
    // No bloquejar el tancament si l'email falla
    alert('⚠️ No s\'ha pogut enviar l\'email de facturació. El client es tancarà igualment.\n\nError: ' + e.message);
  }

  // Tancar el client (cridar la funció original d'app-ui.js)
  window._billingClientId = null;
  window._billingConfirmed = true;  // evitar bucle infinit
  window.clientToClose = clientId;
  await confirmCloseClient();
}

/* ─────────────────────────────────────────────
   ENVIAR EMAIL VIA EMAILJS
───────────────────────────────────────────── */
async function sendBillingEmail(params) {
  if (typeof emailjs === 'undefined') {
    throw new Error('EmailJS no carregat');
  }
  if (EMAILJS_PUBLIC_KEY === 'LA_TEVA_PUBLIC_KEY') {
    console.warn('⚠️ EmailJS no configurat. Simula enviament:', params);
    return; // En mode dev, no enviar
  }

  const templateParams = {
    to_email:          BILLING_EMAIL,
    client_name:       params.client_name,
    data_tancament:    params.data_tancament,
    hores_disseny:     params.hores_disseny,
    hores_collocacio:  params.hores_collocacio,
    material_mides:    params.material_mides,
    desplacament:      params.desplacament,
    total_hores:       params.total_hores,
    notes_addicionals: params.notes_addicionals
  };

  const response = await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams);
  if (response.status !== 200) {
    throw new Error('EmailJS status: ' + response.status);
  }
  return response;
}

/* ─────────────────────────────────────────────
   TANCAR MODAL (cancel·lar)
───────────────────────────────────────────── */
function closeBillingModal() {
  const modal = document.getElementById('modalBillingDetails');
  if (modal) {
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }
}

/* ─────────────────────────────────────────────
   MODE TREBALLADOR: amagar esborrar
   Afegeix ?worker=1 a la URL per activar-lo
───────────────────────────────────────────── */
(function applyWorkerMode() {
  const isWorker = new URLSearchParams(window.location.search).get('worker') === '1';
  if (!isWorker) return;

  document.addEventListener('DOMContentLoaded', () => hideDeleteButtons());

  // També aplicar si el DOM ja està llest
  if (document.readyState !== 'loading') hideDeleteButtons();

  function hideDeleteButtons() {
    const ids = ['deleteClientBtn', 'deleteClientPanel'];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });

    // Amagar també el botó d'esborrar del menú de bulk
    document.querySelectorAll('[onclick*="deleteClient"], [onclick*="bulkDelete"]')
      .forEach(el => el.style.display = 'none');

    console.log('🔒 Mode treballador actiu: borrat desactivat');
  }
})();

// Exportar funcions globals
window.openBillingModal     = openBillingModal;
window.confirmBillingAndClose = confirmBillingAndClose;
window.closeBillingModal    = closeBillingModal;

console.log('✅ Mòdul de facturació carregat');

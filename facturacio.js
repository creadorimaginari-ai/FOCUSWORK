/*************************************************
 * FOCUSWORK – FACTURACIÓ VIA GMAIL (mailto)
 *************************************************/

// ─── ÚNIC VALOR A CANVIAR ─────────────────────
const BILLING_EMAIL = 'carlesglobalgrafic@gmail.com';
// ──────────────────────────────────────────────

function openBillingModal(clientId) {
  window._billingClientId = clientId;

  ['billingHoresDisseny', 'billingHoresCollocacio',
   'billingMaterial', 'billingDesplacament', 'billingNotes']
    .forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });

  const modal = document.getElementById('modalBillingDetails');
  if (modal) {
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
  }
}

async function confirmBillingAndClose() {
  const clientId = window._billingClientId;
  if (!clientId) return;

  const horesDisseny    = document.getElementById('billingHoresDisseny')?.value.trim() || '—';
  const horesCollocacio = document.getElementById('billingHoresCollocacio')?.value.trim() || '—';
  const material        = document.getElementById('billingMaterial')?.value.trim();
  const desplacament    = document.getElementById('billingDesplacament')?.value.trim() || '—';
  const notes           = document.getElementById('billingNotes')?.value.trim() || '';

  if (!material) {
    alert('⚠️ Cal indicar el material i les mides abans de tancar.');
    document.getElementById('billingMaterial')?.focus();
    return;
  }

  let client = null;
  try { client = await loadClient(clientId); } catch(e) {}

  const clientName = client?.name || clientId;
  const totalHores = client?.total ? formatTime(client.total) : '—';
  const tancarData = new Date().toLocaleDateString('ca-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  const subject = `[FACTURACIÓ] ${clientName} – ${tancarData}`;
  const body =
`RESUM DE TREBALL TANCAT
═══════════════════════════════

Client:              ${clientName}
Data de tancament:   ${tancarData}
Temps total:         ${totalHores}

───────────────────────────────
DETALL DEL TREBALL
───────────────────────────────
Hores disseny:       ${horesDisseny}
Hores col·locació:   ${horesCollocacio}
Material i mides:    ${material}
Desplaçament:        ${desplacament}
${notes ? `\nNotes addicionals:\n${notes}` : ''}
═══════════════════════════════
Enviat des de FOCUSWORK`;

  // ✅ FIX: Sempre usar mailto: — funciona a mòbil i desktop sense bloqueig de popups
  const mailtoLink = `mailto:${BILLING_EMAIL}`
    + `?subject=${encodeURIComponent(subject)}`
    + `&body=${encodeURIComponent(body)}`;

  // ✅ FIX: Crear un <a> ocult i fer-li click — evita que el navegador bloquegi l'obertura
  const a = document.createElement('a');
  a.href = mailtoLink;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  // ✅ FIX: Esperar 800ms abans de tancar el client perquè Gmail tingui temps d'obrir-se
  await new Promise(resolve => setTimeout(resolve, 800));

  closeBillingModal();
  window._billingClientId  = null;
  window._billingConfirmed = true;
  window.clientToClose     = clientId;
  await confirmCloseClient();
}

function closeBillingModal() {
  const modal = document.getElementById('modalBillingDetails');
  if (modal) {
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }
}

/* MODE TREBALLADOR: afegeix ?worker=1 a la URL */
(function applyWorkerMode() {
  const isWorker = new URLSearchParams(window.location.search).get('worker') === '1';
  if (!isWorker) return;

  function hideDeleteButtons() {
    ['deleteClientBtn', 'deleteClientPanel'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
    document.querySelectorAll('[onclick*="deleteClient"], [onclick*="bulkDelete"]')
      .forEach(el => el.style.display = 'none');
    console.log('🔒 Mode treballador actiu: borrat desactivat');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hideDeleteButtons);
  } else {
    hideDeleteButtons();
  }
})();

window.openBillingModal       = openBillingModal;
window.confirmBillingAndClose = confirmBillingAndClose;
window.closeBillingModal      = closeBillingModal;

console.log('✅ Mòdul de facturació (Gmail) carregat');

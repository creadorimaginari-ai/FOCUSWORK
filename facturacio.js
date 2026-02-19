/*************************************************
 * FOCUSWORK – FACTURACIÓ VIA GMAIL (mailto)
 *
 * Quan es tanca un client, mostra un modal per
 * introduir les dades de facturació i obre Gmail
 * amb el correu ja preparat. El treballador només
 * ha de prémer "Enviar".
 *
 * CONFIGURACIÓ:
 *  Canvia únicament la línia BILLING_EMAIL de sota.
 *************************************************/

// ─── ÚNIC VALOR A CANVIAR ────────────────────────────────────────────────────
const BILLING_EMAIL = 'carlesglobalgrafic@gmail.com'; // ← posa el correu de facturació
// ────────────────────────────────────────────────────────────────────────────

/* ─────────────────────────────────────────────
   MOSTRAR MODAL DE FACTURACIÓ
───────────────────────────────────────────── */
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

/* ─────────────────────────────────────────────
   CONFIRMAR: recollir dades, obrir Gmail i tancar
───────────────────────────────────────────── */
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
${notes ? `\nNotes addicionals:\n${notes}\n` : ''}
═══════════════════════════════
Enviat automàticament des de FOCUSWORK`;

  // Mòbil → mailto (obre app Gmail directament)
  // Desktop → Gmail web en nova pestanya
  const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
  if (isMobile) {
    window.location.href = `mailto:${BILLING_EMAIL}`
      + `?subject=${encodeURIComponent(subject)}`
      + `&body=${encodeURIComponent(body)}`;
  } else {
    window.open(
      `https://mail.google.com/mail/?view=cm`
      + `&to=${encodeURIComponent(BILLING_EMAIL)}`
      + `&su=${encodeURIComponent(subject)}`
      + `&body=${encodeURIComponent(body)}`,
      '_blank'
    );
  }

  closeBillingModal();
  window._billingClientId  = null;
  window._billingConfirmed = true;
  window.clientToClose     = clientId;
  await confirmCloseClient();
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

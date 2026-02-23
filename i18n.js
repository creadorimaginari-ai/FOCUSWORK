/*
 * i18n.js — FocusWork
 * Sistema multiidioma: CA (català) · ES (español) · EN (English)
 * Ús: t('clau') → text en l'idioma actiu
 *     applyLang(lang) → canvia tot l'HTML
 */

// ─────────────────────────────────────────────────────────────────────────────
//  TRADUCCIONS
// ─────────────────────────────────────────────────────────────────────────────
const TRANSLATIONS = {
  ca: {
    // Header
    no_client: 'Cap encàrrec actiu',

    // Vista de projectes
    els_meus_projectes: '📊 Els meus projectes',
    tots: 'Tots',
    en_progres_filter: '🔵 En progrés',
    prova_enviada_filter: '✉️ Prova enviada',
    esperant_filter: '🟡 Esperant',
    pausats_filter: '⸚️ Pausats',
    urgents_filter: '🔴 Urgents',
    ordenar_per: 'Ordenar per:',
    urgencia: 'Urgència (entrega propera)',
    progres: 'Progrés (menys avançats)',
    temps_treballat: 'Temps treballat (més hores)',
    nom_az: 'Nom (A-Z)',
    estat: 'Estat',
    no_clients_filtre: 'No hi ha clients amb aquest filtre',

    // Client info panel
    notes_client: 'Notes del client',
    clients_tancats: '📂 Clients tancats',
    tancar_client: '✅ Tancar client',
    data_entrega: '📅 Data d\'entrega',
    afegir_hores: '⏱️ Afegir hores',
    veure_resum: '📊 Veure resum d\'hores',
    generar_informe: '📋 Generar informe',
    afegir_foto: '📷 Afegir foto',
    afegir_arxiu: '📎 Afegir arxiu',

    // Footer
    guardar_sessio: '💾 Guardar sessió',
    carregar_treball: '📂 Carregar treball',
    copia_seguretat: '📦 Còpia de seguretat',
    focus_btn: '🎯 Focus',
    activar_horari: '⏰ Activar Horari',
    sortir: '🚪 Sortir',
    carregar_llicencia: '📄 Carregar llicència',
    solicitar_whatsapp: '💬 Sol·licitar per WhatsApp',

    // Botó de projectes
    revisar_encarrecs: '👁️ Revisar encàrrecs',

    // Placeholders
    ph_nou_client: 'Ex: Joan - Targetes presentació',
    ph_notes: 'Apunts, tasques pendents, detalls del projecte…',
    ph_urgent: '🔴 Urgent (avui, bloquejant...)',
    ph_important: '🟠 Important (següent pas)',
    ph_despres: '🟢 Quan es pugui (no oblidar)',
    ph_buscar: '🔍 Buscar client o feina...',
    ph_hores: 'Ex: 2.5',
    ph_desc: 'Ex: Reunió amb client, correccions per correu...',
    ph_esborrar: 'ESBORRAR',

    // Modals — títols
    modal_nou_client: 'Nou client',
    modal_canviar: 'Canviar d\'encàrrec',
    modal_clients_tancats: 'Clients tancats',
    modal_esborrar_antics: 'Esborrar clients antics',
    modal_tancar_client: 'Tancar client',
    modal_guardar_tancar: 'Guardar abans de tancar',
    modal_informe: 'Informe del Projecte',
    modal_importar: 'Importar Feina',
    modal_restaurar: 'Restaurar còpia completa',
    modal_focus: 'Focus diari',
    modal_esborrar_client: 'Esborrar client',
    modal_data_entrega: 'Data d\'entrega',
    modal_afegir_hores: 'Afegir hores manuals',
    modal_configuracio: 'Configuració',

    // Modals — botons
    cancellar: 'Cancel·lar',
    crear: 'Crear',
    tancar: 'Tancar',
    importar: 'Importar',
    restaurar: 'Restaurar còpia',
    acceptar: 'Acceptar',
    esborrar: 'Esborrar',
    guardar: 'Guardar',
    esborrar_data: 'Esborrar data',
    copiar: '📋 Copiar',
    compartir: '📤 Compartir',
    esborrar_antics: '🗑️ Esborrar antics',
    no_tancar: 'No, tancar sense guardar',
    si_guardar: 'Sí, guardar i tancar',

    // Modals — textos
    tria_encarrecs: 'Tria un dels teus encàrrecs actius:',
    vols_importar: 'Vols importar aquest treball?',
    atencio_restaurar: '⚠️ ATENCIÓ: això restaurarà TOTES les teves dades des de la còpia de seguretat.',
    recarregara: 'La pàgina es recarregarà automàticament després de restaurar.',
    label_client: 'Client:',
    label_temps: 'Temps total:',
    label_fotos: 'Fotos:',
    label_notes: 'Notes:',
    label_total_clients: 'Total clients:',
    label_clients_actius: 'Clients actius:',
    label_data_copia: 'Data de la còpia:',
    label_llicencia: 'Llicència inclosa:',
    escriu_esborrar: 'Escriu ESBORRAR per confirmar',
    tria_data: 'Tria la data límit d\'entrega:',
    info_entrega: 'ℹ️ Podràs veure quants dies falten a la pantalla principal',
    hores_label: 'Hores:',
    desc_label: 'Descripció (opcional):',
    hores_externes: 'Per a feines fetes fora de l\'app (treball extern, reunions, correus...)',
    hores_nota: '💡 Aquestes hores s\'afegiran al temps total del client',
    label_client_desc: 'Client + descripció de la feina',

    // Alertes
    alert_foto_afegida: 'Foto afegida',
    alert_foto_eliminada: 'Foto eliminada',
    alert_foto_guardada: 'Foto guardada',
    alert_arxiu_afegit: 'Arxiu afegit',
    alert_arxiu_eliminat: 'Arxiu eliminat',
    alert_client_eliminat: 'Client eliminat',
    alert_client_tancat: 'Client tancat',
    alert_error: 'Error',
    alert_guardat: 'Treball desat',
    alert_importat: 'Treball importat',
    alert_hores_afegides: 'Hores afegides',
    alert_limit_clients: 'Límit de clients',
    alert_data_desada: 'Data desada',
    alert_data_eliminada: 'Data eliminada',
    alert_progres: 'Progrés actualitzat',
    alert_estat: 'Estat actualitzat',
    alert_backup: 'Backup complet',
    alert_restaurat: 'Backup restaurat',
    guardant: 'Guardant...',
    esborrant: 'Esborrant...',

    // Estats del projecte
    state_in_progress: '🔵 En progrés',
    state_waiting_feedback: '✉️ Prova enviada',
    state_waiting_material: '🟡 Esperant material',
    state_waiting_budget: '💰 Esperant pressupost',
    state_paused: '⏸ Pausat',
    state_blocked: '🔴 Bloquejat',
    state_ready: '✅ Llest',

    // Configuració
    config_drive: 'Activar còpies automàtiques a Drive',
    config_horari: 'Activar Horari de Focus diari',
    horari_inici: 'Hora inici',
    horari_fi: 'Hora fi',
    predefinits: 'Predefinits ràpids:',

    // Hores extra (resum)
    hores_extra: 'Hores Extra Registrades',
    total_treballat: 'Total treballat:',
    color_label: 'Color',
    mida_label: 'Mida',

    // Misc
    avui: 'AVUI',
    dema: 'DEMÀ',
    venut: 'Vençut fa',
    dies: 'dies',
  },

  // ─────────────────────────────────────────────────────────────────────────
  es: {
    no_client: 'Sin encargo activo',
    els_meus_projectes: '📊 Mis proyectos',
    tots: 'Todos',
    en_progres_filter: '🔵 En progreso',
    prova_enviada_filter: '✉️ Prueba enviada',
    esperant_filter: '🟡 Esperando',
    pausats_filter: '⸚️ Pausados',
    urgents_filter: '🔴 Urgentes',
    ordenar_per: 'Ordenar por:',
    urgencia: 'Urgencia (entrega próxima)',
    progres: 'Progreso (menos avanzados)',
    temps_treballat: 'Tiempo trabajado (más horas)',
    nom_az: 'Nombre (A-Z)',
    estat: 'Estado',
    no_clients_filtre: 'No hay clientes con este filtro',
    notes_client: 'Notas del cliente',
    clients_tancats: '📂 Clientes cerrados',
    tancar_client: '✅ Cerrar cliente',
    data_entrega: '📅 Fecha de entrega',
    afegir_hores: '⏱️ Añadir horas',
    veure_resum: '📊 Ver resumen de horas',
    generar_informe: '📋 Generar informe',
    afegir_foto: '📷 Añadir foto',
    afegir_arxiu: '📎 Añadir archivo',
    guardar_sessio: '💾 Guardar sesión',
    carregar_treball: '📂 Cargar trabajo',
    copia_seguretat: '📦 Copia de seguridad',
    focus_btn: '🎯 Focus',
    activar_horari: '⏰ Activar Horario',
    sortir: '🚪 Salir',
    carregar_llicencia: '📄 Cargar licencia',
    solicitar_whatsapp: '💬 Solicitar por WhatsApp',
    revisar_encarrecs: '👁️ Revisar encargos',
    ph_nou_client: 'Ej: Joan - Tarjetas presentación',
    ph_notes: 'Apuntes, tareas pendientes, detalles del proyecto…',
    ph_urgent: '🔴 Urgente (hoy, bloqueante...)',
    ph_important: '🟠 Importante (siguiente paso)',
    ph_despres: '🟢 Cuando se pueda (no olvidar)',
    ph_buscar: '🔍 Buscar cliente o trabajo...',
    ph_hores: 'Ej: 2.5',
    ph_desc: 'Ej: Reunión con cliente, correcciones por correo...',
    ph_esborrar: 'BORRAR',
    modal_nou_client: 'Nuevo cliente',
    modal_canviar: 'Cambiar de encargo',
    modal_clients_tancats: 'Clientes cerrados',
    modal_esborrar_antics: 'Borrar clientes antiguos',
    modal_tancar_client: 'Cerrar cliente',
    modal_guardar_tancar: 'Guardar antes de cerrar',
    modal_informe: 'Informe del Proyecto',
    modal_importar: 'Importar Trabajo',
    modal_restaurar: 'Restaurar copia completa',
    modal_focus: 'Focus diario',
    modal_esborrar_client: 'Borrar cliente',
    modal_data_entrega: 'Fecha de entrega',
    modal_afegir_hores: 'Añadir horas manuales',
    modal_configuracio: 'Configuración',
    cancellar: 'Cancelar',
    crear: 'Crear',
    tancar: 'Cerrar',
    importar: 'Importar',
    restaurar: 'Restaurar copia',
    acceptar: 'Aceptar',
    esborrar: 'Borrar',
    guardar: 'Guardar',
    esborrar_data: 'Borrar fecha',
    copiar: '📋 Copiar',
    compartir: '📤 Compartir',
    esborrar_antics: '🗑️ Borrar antiguos',
    no_tancar: 'No, cerrar sin guardar',
    si_guardar: 'Sí, guardar y cerrar',
    tria_encarrecs: 'Elige uno de tus encargos activos:',
    vols_importar: '¿Quieres importar este trabajo?',
    atencio_restaurar: '⚠️ ATENCIÓN: esto restaurará TODOS tus datos desde la copia de seguridad.',
    recarregara: 'La página se recargará automáticamente tras restaurar.',
    label_client: 'Cliente:',
    label_temps: 'Tiempo total:',
    label_fotos: 'Fotos:',
    label_notes: 'Notas:',
    label_total_clients: 'Total clientes:',
    label_clients_actius: 'Clientes activos:',
    label_data_copia: 'Fecha de la copia:',
    label_llicencia: 'Licencia incluida:',
    escriu_esborrar: 'Escribe BORRAR para confirmar',
    tria_data: 'Elige la fecha límite de entrega:',
    info_entrega: 'ℹ️ Podrás ver cuántos días faltan en la pantalla principal',
    hores_label: 'Horas:',
    desc_label: 'Descripción (opcional):',
    hores_externes: 'Para trabajos realizados fuera de la app (trabajo externo, reuniones, correos...)',
    hores_nota: '💡 Estas horas se añadirán al tiempo total del cliente',
    label_client_desc: 'Cliente + descripción del trabajo',
    alert_foto_afegida: 'Foto añadida',
    alert_foto_eliminada: 'Foto eliminada',
    alert_foto_guardada: 'Foto guardada',
    alert_arxiu_afegit: 'Archivo añadido',
    alert_arxiu_eliminat: 'Archivo eliminado',
    alert_client_eliminat: 'Cliente eliminado',
    alert_client_tancat: 'Cliente cerrado',
    alert_error: 'Error',
    alert_guardat: 'Trabajo guardado',
    alert_importat: 'Trabajo importado',
    alert_hores_afegides: 'Horas añadidas',
    alert_limit_clients: 'Límite de clientes',
    alert_data_desada: 'Fecha guardada',
    alert_data_eliminada: 'Fecha eliminada',
    alert_progres: 'Progreso actualizado',
    alert_estat: 'Estado actualizado',
    alert_backup: 'Backup completo',
    alert_restaurat: 'Backup restaurado',
    guardant: 'Guardando...',
    esborrant: 'Borrando...',
    state_in_progress: '🔵 En progreso',
    state_waiting_feedback: '✉️ Prueba enviada',
    state_waiting_material: '🟡 Esperando material',
    state_waiting_budget: '💰 Esperando presupuesto',
    state_paused: '⏸ Pausado',
    state_blocked: '🔴 Bloqueado',
    state_ready: '✅ Listo',
    config_drive: 'Activar copias automáticas en Drive',
    config_horari: 'Activar Horario de Focus diario',
    horari_inici: 'Hora inicio',
    horari_fi: 'Hora fin',
    predefinits: 'Predefinidos rápidos:',
    hores_extra: 'Horas Extra Registradas',
    total_treballat: 'Total trabajado:',
    color_label: 'Color',
    mida_label: 'Tamaño',
    avui: 'HOY',
    dema: 'MAÑANA',
    venut: 'Vencido hace',
    dies: 'días',
  },

  // ─────────────────────────────────────────────────────────────────────────
  en: {
    no_client: 'No active project',
    els_meus_projectes: '📊 My projects',
    tots: 'All',
    en_progres_filter: '🔵 In progress',
    prova_enviada_filter: '✉️ Proof sent',
    esperant_filter: '🟡 Waiting',
    pausats_filter: '⸚️ Paused',
    urgents_filter: '🔴 Urgent',
    ordenar_per: 'Sort by:',
    urgencia: 'Urgency (nearest deadline)',
    progres: 'Progress (least advanced)',
    temps_treballat: 'Time worked (most hours)',
    nom_az: 'Name (A-Z)',
    estat: 'Status',
    no_clients_filtre: 'No clients match this filter',
    notes_client: 'Client notes',
    clients_tancats: '📂 Closed clients',
    tancar_client: '✅ Close client',
    data_entrega: '📅 Delivery date',
    afegir_hores: '⏱️ Add hours',
    veure_resum: '📊 View hours summary',
    generar_informe: '📋 Generate report',
    afegir_foto: '📷 Add photo',
    afegir_arxiu: '📎 Add file',
    guardar_sessio: '💾 Save session',
    carregar_treball: '📂 Load work',
    copia_seguretat: '📦 Backup',
    focus_btn: '🎯 Focus',
    activar_horari: '⏰ Enable Schedule',
    sortir: '🚪 Sign out',
    carregar_llicencia: '📄 Load licence',
    solicitar_whatsapp: '💬 Request via WhatsApp',
    revisar_encarrecs: '👁️ Review projects',
    ph_nou_client: 'E.g.: Joan - Business cards',
    ph_notes: 'Notes, pending tasks, project details…',
    ph_urgent: '🔴 Urgent (today, blocking...)',
    ph_important: '🟠 Important (next step)',
    ph_despres: '🟢 When possible (don\'t forget)',
    ph_buscar: '🔍 Search client or job...',
    ph_hores: 'E.g.: 2.5',
    ph_desc: 'E.g.: Client meeting, email corrections...',
    ph_esborrar: 'DELETE',
    modal_nou_client: 'New client',
    modal_canviar: 'Switch project',
    modal_clients_tancats: 'Closed clients',
    modal_esborrar_antics: 'Delete old clients',
    modal_tancar_client: 'Close client',
    modal_guardar_tancar: 'Save before closing',
    modal_informe: 'Project Report',
    modal_importar: 'Import Work',
    modal_restaurar: 'Restore full backup',
    modal_focus: 'Daily focus',
    modal_esborrar_client: 'Delete client',
    modal_data_entrega: 'Delivery date',
    modal_afegir_hores: 'Add manual hours',
    modal_configuracio: 'Settings',
    cancellar: 'Cancel',
    crear: 'Create',
    tancar: 'Close',
    importar: 'Import',
    restaurar: 'Restore backup',
    acceptar: 'Accept',
    esborrar: 'Delete',
    guardar: 'Save',
    esborrar_data: 'Clear date',
    copiar: '📋 Copy',
    compartir: '📤 Share',
    esborrar_antics: '🗑️ Delete old',
    no_tancar: 'No, close without saving',
    si_guardar: 'Yes, save and close',
    tria_encarrecs: 'Choose one of your active projects:',
    vols_importar: 'Do you want to import this work?',
    atencio_restaurar: '⚠️ WARNING: this will restore ALL your data from the backup.',
    recarregara: 'The page will reload automatically after restoring.',
    label_client: 'Client:',
    label_temps: 'Total time:',
    label_fotos: 'Photos:',
    label_notes: 'Notes:',
    label_total_clients: 'Total clients:',
    label_clients_actius: 'Active clients:',
    label_data_copia: 'Backup date:',
    label_llicencia: 'Licence included:',
    escriu_esborrar: 'Type DELETE to confirm',
    tria_data: 'Choose the delivery deadline:',
    info_entrega: 'ℹ️ You\'ll see how many days are left on the main screen',
    hores_label: 'Hours:',
    desc_label: 'Description (optional):',
    hores_externes: 'For work done outside the app (external work, meetings, emails...)',
    hores_nota: '💡 These hours will be added to the client\'s total time',
    label_client_desc: 'Client + job description',
    alert_foto_afegida: 'Photo added',
    alert_foto_eliminada: 'Photo deleted',
    alert_foto_guardada: 'Photo saved',
    alert_arxiu_afegit: 'File added',
    alert_arxiu_eliminat: 'File deleted',
    alert_client_eliminat: 'Client deleted',
    alert_client_tancat: 'Client closed',
    alert_error: 'Error',
    alert_guardat: 'Work saved',
    alert_importat: 'Work imported',
    alert_hores_afegides: 'Hours added',
    alert_limit_clients: 'Client limit',
    alert_data_desada: 'Date saved',
    alert_data_eliminada: 'Date cleared',
    alert_progres: 'Progress updated',
    alert_estat: 'Status updated',
    alert_backup: 'Full backup',
    alert_restaurat: 'Backup restored',
    guardant: 'Saving...',
    esborrant: 'Deleting...',
    state_in_progress: '🔵 In progress',
    state_waiting_feedback: '✉️ Proof sent',
    state_waiting_material: '🟡 Waiting for material',
    state_waiting_budget: '💰 Waiting for budget',
    state_paused: '⏸ Paused',
    state_blocked: '🔴 Blocked',
    state_ready: '✅ Ready',
    config_drive: 'Enable automatic Drive backups',
    config_horari: 'Enable daily Focus schedule',
    horari_inici: 'Start time',
    horari_fi: 'End time',
    predefinits: 'Quick presets:',
    hores_extra: 'Registered Extra Hours',
    total_treballat: 'Total worked:',
    color_label: 'Color',
    mida_label: 'Size',
    avui: 'TODAY',
    dema: 'TOMORROW',
    venut: 'Overdue by',
    dies: 'days',
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  IDIOMA ACTIU
// ─────────────────────────────────────────────────────────────────────────────
let _currentLang = localStorage.getItem('fw_lang') || 'ca';

/** Retorna la traducció d'una clau en l'idioma actiu */
function t(key) {
  return (TRANSLATIONS[_currentLang] || TRANSLATIONS.ca)[key] || key;
}
window.t = t;

/** Idioma actiu */
function getLang() { return _currentLang; }
window.getLang = getLang;

// ─────────────────────────────────────────────────────────────────────────────
//  APLICAR IDIOMA A L'HTML
// ─────────────────────────────────────────────────────────────────────────────
function applyLang(lang) {
  if (!TRANSLATIONS[lang]) return;
  _currentLang = lang;
  localStorage.setItem('fw_lang', lang);

  // Actualitzar atribut HTML lang
  document.documentElement.lang = lang;

  // 1. Elements amb data-i18n (text)
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    const val = t(key);
    if (val) el.textContent = val;
  });

  // 2. Elements amb data-i18n-ph (placeholder)
  document.querySelectorAll('[data-i18n-ph]').forEach(el => {
    const key = el.dataset.i18nPh;
    const val = t(key);
    if (val) el.placeholder = val;
  });

  // 3. Elements amb data-i18n-title (title attribute)
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.dataset.i18nTitle;
    const val = t(key);
    if (val) el.title = val;
  });

  // 4. Actualitzar indicador visual del selector
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });

  // 5. Notificar a l'app per refrescar contingut dinàmic
  window.dispatchEvent(new CustomEvent('langchange', { detail: { lang } }));
}
window.applyLang = applyLang;

// ─────────────────────────────────────────────────────────────────────────────
//  CREAR EL SELECTOR DE LLENGUA (injectat al DOM)
// ─────────────────────────────────────────────────────────────────────────────
function createLangSelector() {
  const existing = document.getElementById('langSelector');
  if (existing) return;

  const sel = document.createElement('div');
  sel.id = 'langSelector';
  sel.innerHTML = `
    <button class="lang-btn${_currentLang === 'ca' ? ' active' : ''}" data-lang="ca">CA</button>
    <button class="lang-btn${_currentLang === 'es' ? ' active' : ''}" data-lang="es">ES</button>
    <button class="lang-btn${_currentLang === 'en' ? ' active' : ''}" data-lang="en">EN</button>
  `;
  sel.addEventListener('click', e => {
    const btn = e.target.closest('.lang-btn');
    if (btn) applyLang(btn.dataset.lang);
  });

  // Injectar al header
  const header = document.querySelector('header.header') || document.body;
  header.appendChild(sel);
}

// ─────────────────────────────────────────────────────────────────────────────
//  INICIALITZAR EN CARREGAR
// ─────────────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  createLangSelector();
  applyLang(_currentLang);
});

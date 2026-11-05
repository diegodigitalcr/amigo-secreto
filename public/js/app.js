/**
 * AMIGO INVISIBLE - LÓGICA PRINCIPAL DE LA APLICACIÓN
 */

// Estado global de la aplicación
const state = {
  step: 1,
  event: {
    name: 'Amigo Invisible 2026',
    budget: '',
    date: '',
    location: '',
    notes: ''
  },
  participants: [], // [{ id, name, phone, email, exclusions: [] }]
  results: [],      // [{ giverId, receiverId, giverName, receiverName, phone, email, sent: false }]
  preferences: {
    useRevealLinks: true
  },
  roomId: null,
  groupRoomUrl: '',
  groupRoomText: '',
  smtpConfig: null,
  showOrganizerView: false
};

// Clave para almacenamiento local
const STORAGE_KEY = 'amigo_invisible_app_state_v1';

// =============================================================================
// INICIALIZACIÓN
// =============================================================================
document.addEventListener('DOMContentLoaded', () => {
  loadFromLocalStorage();
  bindEvents();
  renderAll();
});

// =============================================================================
// PERSISTENCIA EN LOCALSTORAGE
// =============================================================================
function saveToLocalStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      step: state.step,
      event: state.event,
      participants: state.participants,
      results: state.results,
      preferences: state.preferences,
      roomId: state.roomId,
      groupRoomUrl: state.groupRoomUrl,
      groupRoomText: state.groupRoomText,
      smtpConfig: state.smtpConfig
    }));
  } catch (e) {
    console.error('Error guardando en LocalStorage:', e);
  }
}

function loadFromLocalStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed.event) state.event = { ...state.event, ...parsed.event };
    if (Array.isArray(parsed.participants)) state.participants = parsed.participants;
    if (Array.isArray(parsed.results)) state.results = parsed.results;
    if (parsed.preferences) state.preferences = { ...state.preferences, ...parsed.preferences };
    if (parsed.roomId) state.roomId = parsed.roomId;
    if (parsed.groupRoomUrl) state.groupRoomUrl = parsed.groupRoomUrl;
    if (parsed.groupRoomText) state.groupRoomText = parsed.groupRoomText;
    if (parsed.smtpConfig) state.smtpConfig = parsed.smtpConfig;
    if (parsed.step) state.step = parsed.step;
  } catch (e) {
    console.warn('Error cargando estado guardado:', e);
  }
}

// =============================================================================
// VINCULACIÓN DE EVENTOS (LISTENERS)
// =============================================================================
function bindEvents() {
  // Navegación de pasos
  document.querySelectorAll('.step-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const targetStep = parseInt(pill.dataset.step, 10);
      goToStep(targetStep);
    });
  });

  // Botón Nuevo Sorteo
  document.getElementById('btnNewGame').addEventListener('click', handleNewGame);

  // Paso 1: Formulario detalles del evento
  const eventNameInput = document.getElementById('eventName');
  const eventBudgetInput = document.getElementById('eventBudget');
  const eventDateInput = document.getElementById('eventDate');
  const eventLocationInput = document.getElementById('eventLocation');
  const eventNotesInput = document.getElementById('eventNotes');

  const updateEventState = () => {
    state.event.name = eventNameInput.value.trim() || 'Amigo Invisible';
    state.event.budget = eventBudgetInput.value.trim();
    state.event.date = eventDateInput.value;
    state.event.location = eventLocationInput.value.trim();
    state.event.notes = eventNotesInput.value.trim();
    saveToLocalStorage();
  };

  [eventNameInput, eventBudgetInput, eventDateInput, eventLocationInput, eventNotesInput].forEach(inp => {
    inp.addEventListener('input', updateEventState);
  });

  document.getElementById('btnGoToStep2').addEventListener('click', () => {
    updateEventState();
    goToStep(2);
  });

  // Paso 2: Participantes
  document.getElementById('formAddParticipant').addEventListener('submit', handleAddParticipant);
  document.getElementById('btnBulkImport').addEventListener('click', handleBulkImport);
  document.getElementById('btnClearAllParticipants').addEventListener('click', handleClearAllParticipants);
  document.getElementById('btnBackToStep1').addEventListener('click', () => goToStep(1));
  document.getElementById('btnGoToDraw').addEventListener('click', () => goToStep(3));

  // Paso 3: Sorteo
  const prefCheckbox = document.getElementById('prefUseRevealLinks');
  prefCheckbox.checked = state.preferences.useRevealLinks;
  prefCheckbox.addEventListener('change', (e) => {
    state.preferences.useRevealLinks = e.target.checked;
    saveToLocalStorage();
    if (state.results.length > 0) renderResultsCards();
  });

  document.getElementById('btnExecuteDraw').addEventListener('click', handleExecuteDraw);
  document.getElementById('btnReDraw').addEventListener('click', handleExecuteDraw);

  // Botón Copiar Mensaje del Grupo WhatsApp
  const btnCopyGroup = document.getElementById('btnCopyGroupMessage');
  if (btnCopyGroup) {
    btnCopyGroup.addEventListener('click', handleCopyGroupMessage);
  }

  // Visibilidad del organizador (spoiler)
  document.getElementById('btnToggleOrganizerView').addEventListener('click', () => {
    state.showOrganizerView = !state.showOrganizerView;
    const textEl = document.getElementById('organizerViewText');
    textEl.textContent = state.showOrganizerView ? 'Ocultar nombres (Modo sorpresa)' : 'Ver quién le tocó a quién';
    renderResultsCards();
  });

  // Modales
  document.getElementById('btnCloseExclusions').addEventListener('click', closeExclusionsModal);
  document.getElementById('btnSaveExclusions').addEventListener('click', saveExclusionsModal);

  // SMTP Modal
  document.getElementById('btnOpenSmtpModal').addEventListener('click', openSmtpModal);
  document.getElementById('btnCloseSmtpModal').addEventListener('click', closeSmtpModal);
  document.getElementById('smtpService').addEventListener('change', handleSmtpServiceChange);
  document.getElementById('btnTestSmtp').addEventListener('click', handleTestSmtp);
  document.getElementById('btnSaveSmtp').addEventListener('click', handleSaveSmtp);
  document.getElementById('btnSendAllEmails').addEventListener('click', handleSendAllEmails);
}

// =============================================================================
// NAVEGACIÓN ENTRE PASOS
// =============================================================================
function goToStep(stepNumber) {
  // Validaciones
  if (stepNumber === 3 && state.participants.length < 3) {
    showToast('Necesitas agregar al menos 3 participantes para ir al sorteo', 'error');
    return;
  }

  state.step = stepNumber;
  saveToLocalStorage();

  // Actualizar indicadores del stepper
  document.querySelectorAll('.step-pill').forEach(pill => {
    const s = parseInt(pill.dataset.step, 10);
    pill.classList.toggle('active', s === stepNumber);
    pill.classList.toggle('completed', s < stepNumber);
  });

  // Mostrar la sección correspondiente
  document.querySelectorAll('.step-section').forEach(sec => {
    sec.classList.remove('active');
  });
  const activeSection = document.getElementById(`step${stepNumber}`);
  if (activeSection) activeSection.classList.add('active');

  // Si entramos al paso 3 y ya hay resultados, renderizarlos
  if (stepNumber === 3) {
    if (state.results.length > 0) {
      document.getElementById('drawTriggerBanner').classList.add('hidden');
      document.getElementById('drawResultsContainer').classList.remove('hidden');
      renderGroupShareHeroCard();
      renderResultsCards();
    } else {
      document.getElementById('drawTriggerBanner').classList.remove('hidden');
      document.getElementById('drawResultsContainer').classList.add('hidden');
    }
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// =============================================================================
// GESTIÓN DE PARTICIPANTES
// =============================================================================
function handleAddParticipant(e) {
  e.preventDefault();
  const nameInput = document.getElementById('partName');
  const phoneInput = document.getElementById('partPhone');
  const emailInput = document.getElementById('partEmail');

  const name = nameInput.value.trim();
  const phone = phoneInput.value.trim();
  const email = emailInput.value.trim();

  if (!name) return;

  // Evitar nombres duplicados
  const exists = state.participants.some(p => p.name.toLowerCase() === name.toLowerCase());
  if (exists) {
    showToast(`Ya existe un participante con el nombre "${name}". Usa un distintivo (ej. ${name} G.)`, 'error');
    return;
  }

  const newParticipant = {
    id: 'p_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    name,
    phone,
    email,
    exclusions: []
  };

  state.participants.push(newParticipant);
  
  // Limpiar inputs
  nameInput.value = '';
  phoneInput.value = '';
  emailInput.value = '';
  nameInput.focus();

  // Si había un sorteo hecho, queda invalidado al cambiar la lista
  if (state.results.length > 0) {
    state.results = [];
  }

  saveToLocalStorage();
  renderParticipantsList();
  showToast(`¡${name} agregado con éxito!`, 'success');
}

function handleBulkImport() {
  const textarea = document.getElementById('bulkImportText');
  const text = textarea.value.trim();
  if (!text) return;

  const lines = text.split('\n');
  let addedCount = 0;

  lines.forEach(line => {
    const parts = line.split(',').map(s => s.trim());
    const name = parts[0];
    const phone = parts[1] || '';
    const email = parts[2] || '';

    if (name && !state.participants.some(p => p.name.toLowerCase() === name.toLowerCase())) {
      state.participants.push({
        id: 'p_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        name,
        phone,
        email,
        exclusions: []
      });
      addedCount++;
    }
  });

  textarea.value = '';
  if (state.results.length > 0) state.results = [];

  saveToLocalStorage();
  renderParticipantsList();
  showToast(`Se importaron ${addedCount} participantes.`, 'success');
}

function handleClearAllParticipants() {
  if (state.participants.length === 0) return;
  if (!confirm('¿Seguro que deseas eliminar todos los participantes de la lista?')) return;

  state.participants = [];
  state.results = [];
  saveToLocalStorage();
  renderParticipantsList();
  showToast('Lista de participantes vaciada.', 'success');
}

function deleteParticipant(id) {
  state.participants = state.participants.filter(p => p.id !== id);
  // Limpiar también de las exclusiones de los demás
  state.participants.forEach(p => {
    p.exclusions = p.exclusions.filter(exId => exId !== id);
  });

  if (state.results.length > 0) state.results = [];

  saveToLocalStorage();
  renderParticipantsList();
}

// =============================================================================
// MODAL DE EXCLUSIONES
// =============================================================================
let currentExclusionParticipantId = null;

function openExclusionsModal(id) {
  const participant = state.participants.find(p => p.id === id);
  if (!participant) return;

  currentExclusionParticipantId = id;
  document.getElementById('modalParticipantName').textContent = participant.name;

  const listContainer = document.getElementById('exclusionsCheckboxList');
  listContainer.innerHTML = '';

  const others = state.participants.filter(p => p.id !== id);

  if (others.length === 0) {
    listContainer.innerHTML = '<p class="text-sm text-muted">No hay otros participantes aún.</p>';
  } else {
    others.forEach(other => {
      const isExcluded = participant.exclusions.includes(other.id);
      const label = document.createElement('label');
      label.className = 'exclusion-item';
      label.innerHTML = `
        <input type="checkbox" value="${other.id}" ${isExcluded ? 'checked' : ''}>
        <span>${escapeHtml(other.name)}</span>
      `;
      listContainer.appendChild(label);
    });
  }

  document.getElementById('modalExclusions').classList.remove('hidden');
}

function closeExclusionsModal() {
  document.getElementById('modalExclusions').classList.add('hidden');
  currentExclusionParticipantId = null;
}

function saveExclusionsModal() {
  if (!currentExclusionParticipantId) return;
  const participant = state.participants.find(p => p.id === currentExclusionParticipantId);
  if (!participant) return;

  const checked = Array.from(document.querySelectorAll('#exclusionsCheckboxList input:checked')).map(i => i.value);
  participant.exclusions = checked;

  if (state.results.length > 0) state.results = [];

  saveToLocalStorage();
  renderParticipantsList();
  closeExclusionsModal();
  showToast(`Exclusiones actualizadas para ${participant.name}`, 'success');
}

// =============================================================================
// ALGORITMO DE SORTEO (DERANGEMENT 100% ALEATORIO Y JUSTO)
// =============================================================================
/**
 * Realiza el sorteo garantizando:
 * 1. Nadie se regala a sí mismo (derangement estricto).
 * 2. Se respetan las listas de exclusión configuradas.
 * 3. Cada persona da 1 regalo y recibe exactamente 1 regalo.
 * 4. Emparejamiento 100% aleatorio e imparcial.
 */
function solveSecretSanta(participants) {
  const n = participants.length;
  if (n < 3) return null;

  const maxAttempts = 2000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const receivers = [...participants];
    shuffleArray(receivers);

    let valid = true;
    for (let i = 0; i < n; i++) {
      const giver = participants[i];
      const receiver = receivers[i];

      // Regla 1: Nadie se regala a sí mismo
      if (giver.id === receiver.id) {
        valid = false;
        break;
      }

      // Regla 2: Respetar exclusiones manuales si existen
      if (giver.exclusions && giver.exclusions.includes(receiver.id)) {
        valid = false;
        break;
      }
    }

    if (valid) {
      // Éxito: mapear emparejamientos con token único de autodestrucción
      return participants.map((giver, idx) => ({
        giverId: giver.id,
        receiverId: receivers[idx].id,
        giverName: giver.name,
        receiverName: receivers[idx].name,
        phone: giver.phone,
        email: giver.email,
        token: 'sec_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36),
        sent: false
      }));
    }
  }

  return null; // Demasiadas restricciones incompatibles
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

async function handleExecuteDraw() {
  if (state.participants.length < 3) {
    showToast('Debes tener al menos 3 participantes.', 'error');
    return;
  }

  const results = solveSecretSanta(state.participants);

  if (!results) {
    showToast('¡No fue posible emparejar con las exclusiones actuales! Hay demasiadas restricciones cruzadas. Intenta quitar alguna exclusión.', 'error');
    return;
  }

  state.results = results;

  // Registrar los secretos en el servidor para permitir autodestrucción remota
  try {
    const secretsPayload = results.map(r => ({
      token: r.token,
      data: {
        to: r.giverName,
        secret: r.receiverName,
        event: state.event.name,
        budget: state.event.budget || '',
        date: state.event.date || '',
        location: state.event.location || '',
        notes: state.event.notes || '',
        ts: Date.now()
      }
    }));

    await fetch('/api/secrets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secrets: secretsPayload })
    });
  } catch (err) {
    console.warn('Servidor local no disponible para registrar secretos remotos (modo autónomo):', err);
  }

  // Crear la Sala Grupal con PIN
  let roomId = 'sala_' + Math.random().toString(36).substr(2, 7);
  try {
    const roomRes = await fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventDetails: {
          name: state.event.name,
          budget: state.event.budget || '',
          date: state.event.date || '',
          location: state.event.location || '',
          notes: state.event.notes || ''
        },
        pairings: results.map(r => ({
          giverId: r.giverId,
          giverName: r.giverName,
          receiverName: r.receiverName
        }))
      })
    });
    if (roomRes.ok) {
      const roomJson = await roomRes.json();
      if (roomJson.roomId) {
        roomId = roomJson.roomId;
      }
    }
  } catch (roomErr) {
    console.warn('Servidor local no disponible para sala, usando identificador local:', roomErr);
  }

  state.roomId = roomId;

  // Respaldo codificado en hash para compatibilidad con hosting estático (Netlify)
  const encodedRoom = encodePayload({
    id: roomId,
    event: {
      name: state.event.name,
      budget: state.event.budget || '',
      date: state.event.date || '',
      location: state.event.location || '',
      notes: state.event.notes || ''
    },
    members: results.map(r => ({
      id: r.giverId,
      name: r.giverName,
      secret: r.receiverName
    }))
  });

  state.groupRoomUrl = `${window.location.origin}/sala.html?id=${roomId}#room=${encodedRoom}`;
  state.groupRoomText = buildGroupNotificationText(state.groupRoomUrl);

  saveToLocalStorage();

  // Disparar celebración con confeti
  triggerConfetti();

  // Ocultar banner de sortear y mostrar resultados
  document.getElementById('drawTriggerBanner').classList.add('hidden');
  document.getElementById('drawResultsContainer').classList.remove('hidden');

  renderGroupShareHeroCard();
  renderResultsCards();
  showToast('🎉 ¡Sorteo completado con éxito!', 'success');
}

function buildGroupNotificationText(roomUrl) {
  const eventName = state.event.name || 'Amigo Secreto';
  let msg = `🎄🎁 *¡Sorteo de ${eventName} listo!* 🎁🎄\n\n`;
  msg += `¡Ya se realizó el sorteo oficial!\n`;
  msg += `Para descubrir a quién te tocó regalarle de forma 100% privada:\n\n`;
  msg += `1️⃣ Entra a este enlace: 👉 ${roomUrl}\n`;
  msg += `2️⃣ Toca tu nombre en la lista\n`;
  msg += `3️⃣ Crea tu PIN de 4 números para ver tu tarjeta (solo tú podrás verla)\n\n`;
  if (state.event.budget) msg += `💰 *Presupuesto sugerido:* ${state.event.budget}\n`;
  if (state.event.date) msg += `📅 *Fecha de entrega:* ${state.event.date}\n`;
  if (state.event.location) msg += `📍 *Lugar:* ${state.event.location}\n`;
  if (state.event.notes) msg += `📝 *Indicaciones:* ${state.event.notes}\n`;
  msg += `\n🤫 ¡Por favor guarda el secreto hasta el día del intercambio! 🎁`;
  return msg;
}

function renderGroupShareHeroCard() {
  if (!state.groupRoomUrl && state.results.length > 0) {
    const encodedRoom = encodePayload({
      id: state.roomId || 'sala_local',
      event: state.event,
      members: state.results.map(r => ({
        id: r.giverId,
        name: r.giverName,
        secret: r.receiverName
      }))
    });
    state.groupRoomUrl = `${window.location.origin}/sala.html?id=${state.roomId || 'sala_local'}#room=${encodedRoom}`;
    state.groupRoomText = buildGroupNotificationText(state.groupRoomUrl);
  }

  const btnShareWA = document.getElementById('btnShareGroupWhatsApp');
  const btnOpenRoom = document.getElementById('btnOpenRoomPreview');
  const previewBox = document.getElementById('groupMessagePreview');

  if (previewBox && state.groupRoomText) {
    previewBox.textContent = state.groupRoomText;
  }

  if (btnShareWA && state.groupRoomText) {
    btnShareWA.href = `https://wa.me/?text=${encodeURIComponent(state.groupRoomText)}`;
  }

  if (btnOpenRoom && state.groupRoomUrl) {
    btnOpenRoom.href = state.groupRoomUrl;
  }
}

function handleCopyGroupMessage() {
  if (!state.groupRoomText) return;
  navigator.clipboard.writeText(state.groupRoomText).then(() => {
    showToast('📋 ¡Mensaje del grupo copiado! Pégalo en tu grupo de WhatsApp.', 'success');
  }).catch(() => {
    showToast('No se pudo copiar automáticamente al portapapeles.', 'error');
  });
}

function triggerConfetti() {
  if (typeof confetti === 'function') {
    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.6 }
    });
    setTimeout(() => {
      confetti({
        particleCount: 60,
        angle: 60,
        spread: 55,
        origin: { x: 0 }
      });
      confetti({
        particleCount: 60,
        angle: 120,
        spread: 55,
        origin: { x: 1 }
      });
    }, 250);
  }
}

// =============================================================================
// GENERADOR DE ENLACES Y MENSAJES DE NOTIFICACIÓN
// =============================================================================
/**
 * Codificación URL-Safe en Base64 compatible con UTF-8 y Emojis
 */
function encodePayload(obj) {
  const jsonStr = JSON.stringify(obj);
  const bytes = new TextEncoder().encode(jsonStr);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Crea la URL secreta para revelar al amigo secreto (con token de autodestrucción)
 */
function generateRevealUrl(giverName, receiverName, token = '') {
  const payload = {
    to: giverName,
    secret: receiverName,
    event: state.event.name,
    budget: state.event.budget || '',
    date: state.event.date || '',
    location: state.event.location || '',
    notes: state.event.notes || '',
    token: token || '',
    ts: Date.now()
  };

  const encoded = encodePayload(payload);
  const origin = window.location.origin;

  if (token) {
    return `${origin}/revelar.html?token=${token}#data=${encoded}`;
  } else {
    return `${origin}/revelar.html#data=${encoded}`;
  }
}

/**
 * Genera el texto del mensaje para WhatsApp o Correo
 */
function buildNotificationText(giverName, receiverName, token = '', isDirect = false) {
  const eventName = state.event.name || 'Amigo Invisible';
  const revealUrl = generateRevealUrl(giverName, receiverName, token);

  if (!isDirect && state.preferences.useRevealLinks) {
    // Modo Tarjeta Mágica Autodestructible
    let msg = `¡Hola *${giverName}*! 🎁🎄\n\n`;
    msg += `Ya se realizó el sorteo para el intercambio de *${eventName}*.\n\n`;
    msg += `Para descubrir a quién te tocó regalarle, abre tu tarjeta secreta aquí:\n`;
    msg += `👉 ${revealUrl}\n\n`;
    msg += `🔒 *Nota de seguridad:* Por privacidad, este enlace se autodestruirá una vez que lo abras (para que nadie más pueda ver a quién te tocó). ¡Descarga tu imagen al abrirlo!\n\n`;
    if (state.event.budget) msg += `💰 *Presupuesto:* ${state.event.budget}\n`;
    if (state.event.date) msg += `📅 *Fecha:* ${state.event.date}\n`;
    if (state.event.location) msg += `📍 *Lugar:* ${state.event.location}\n`;
    msg += `\n🤫 ¡Recuerda mantener el secreto!`;
    return msg;
  } else {
    // Modo Directo (El nombre va en el texto)
    let msg = `¡Hola *${giverName}*! 🎁🎄\n\n`;
    msg += `Ya se realizó el sorteo oficial de *${eventName}*.\n\n`;
    msg += `🤫 Tu amigo secreto asignado es:\n👉 *${receiverName}*\n\n`;
    if (state.event.budget) msg += `💰 *Presupuesto sugerido:* ${state.event.budget}\n`;
    if (state.event.date) msg += `📅 *Fecha de entrega:* ${state.event.date}\n`;
    if (state.event.location) msg += `📍 *Lugar:* ${state.event.location}\n`;
    if (state.event.notes) msg += `📝 *Notas:* ${state.event.notes}\n`;
    msg += `\n🎁 ¡Guarda el secreto hasta el día del intercambio!`;
    return msg;
  }
}

/**
 * Genera el enlace de WhatsApp (wa.me)
 */
function getWhatsAppUrl(phone, giverName, receiverName, token = '') {
  const cleanPhone = (phone || '').replace(/[^0-9]/g, '');
  const text = buildNotificationText(giverName, receiverName, token);
  const encodedText = encodeURIComponent(text);

  if (cleanPhone) {
    return `https://wa.me/${cleanPhone}?text=${encodedText}`;
  } else {
    return `https://wa.me/?text=${encodedText}`;
  }
}

/**
 * Genera el enlace mailto
 */
function getMailtoUrl(email, giverName, receiverName, token = '') {
  const subject = encodeURIComponent(`🎁 Tu Amigo Secreto asignado para "${state.event.name || 'el intercambio'}" 🤫`);
  const body = encodeURIComponent(buildNotificationText(giverName, receiverName, token));
  return `mailto:${email || ''}?subject=${subject}&body=${body}`;
}

// Marcar un resultado como enviado
function markResultAsSent(giverId) {
  const item = state.results.find(r => r.giverId === giverId);
  if (item) {
    item.sent = true;
    saveToLocalStorage();
    renderResultsCards();
  }
}

// =============================================================================
// RENDERIZADO DE LA INTERFAZ
// =============================================================================
function renderAll() {
  // Rellenar formulario del Paso 1
  document.getElementById('eventName').value = state.event.name || '';
  document.getElementById('eventBudget').value = state.event.budget || '';
  document.getElementById('eventDate').value = state.event.date || '';
  document.getElementById('eventLocation').value = state.event.location || '';
  document.getElementById('eventNotes').value = state.event.notes || '';

  renderParticipantsList();
  goToStep(state.step);
}

function renderParticipantsList() {
  const count = state.participants.length;
  document.getElementById('stepParticipantCount').textContent = count;
  document.getElementById('listCount').textContent = count;

  const listContainer = document.getElementById('participantsList');
  listContainer.innerHTML = '';

  const needed = Math.max(0, 3 - count);
  const alertEl = document.getElementById('minParticipantsAlert');
  const btnGoToDraw = document.getElementById('btnGoToDraw');

  if (count < 3) {
    alertEl.classList.remove('hidden');
    document.getElementById('neededParticipants').textContent = needed;
    btnGoToDraw.disabled = true;
  } else {
    alertEl.classList.add('hidden');
    btnGoToDraw.disabled = false;
  }

  if (count === 0) {
    listContainer.innerHTML = `
      <div class="text-center text-muted" style="padding: 40px 10px;">
        <span style="font-size: 32px; display: block; margin-bottom: 8px;">👥</span>
        Aún no has agregado participantes.<br>Ingresa los nombres a la izquierda.
      </div>
    `;
    return;
  }

  state.participants.forEach((p, idx) => {
    const item = document.createElement('div');
    item.className = 'participant-item';
    
    const initials = p.name.split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase();
    const exclusionsCount = p.exclusions ? p.exclusions.length : 0;

    item.innerHTML = `
      <div style="display: flex; align-items: center; min-width: 0;">
        <div class="participant-avatar">${initials}</div>
        <div class="participant-info">
          <div class="participant-name" title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</div>
          <div class="participant-meta">
            ${p.phone ? `<span class="meta-pill has-phone">📱 ${escapeHtml(p.phone)}</span>` : '<span class="meta-pill">Sin WhatsApp</span>'}
            ${p.email ? `<span class="meta-pill has-email">✉️ ${escapeHtml(p.email)}</span>` : ''}
            ${exclusionsCount > 0 ? `<span class="meta-pill" style="background: #fef3c7; color: #92400e;">🚫 ${exclusionsCount} exclusión(es)</span>` : ''}
          </div>
        </div>
      </div>
      <div class="participant-actions">
        <button type="button" class="btn-icon-action" title="Configurar exclusiones" onclick="openExclusionsModal('${p.id}')">
          🛡️
        </button>
        <button type="button" class="btn-icon-action delete" title="Eliminar participante" onclick="deleteParticipant('${p.id}')">
          ✕
        </button>
      </div>
    `;

    listContainer.appendChild(item);
  });
}

function renderResultsCards() {
  const container = document.getElementById('resultsCardsGrid');
  container.innerHTML = '';

  const total = state.results.length;
  const sentCount = state.results.filter(r => r.sent).length;

  document.getElementById('totalDrawCount').textContent = total;
  document.getElementById('sentProgressCount').textContent = sentCount;
  
  const percentage = total > 0 ? Math.round((sentCount / total) * 100) : 0;
  document.getElementById('progressBarFill').style.width = `${percentage}%`;

  state.results.forEach(res => {
    const card = document.createElement('div');
    card.className = `result-card ${res.sent ? 'sent' : ''}`;

    const initials = res.giverName.split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase();
    const waUrl = getWhatsAppUrl(res.phone, res.giverName, res.receiverName, res.token);
    const mailtoUrl = getMailtoUrl(res.email, res.giverName, res.receiverName, res.token);
    const revealUrl = generateRevealUrl(res.giverName, res.receiverName, res.token);

    card.innerHTML = `
      <div class="result-card-header">
        <div class="result-recipient-info">
          <div class="recipient-avatar-large">${initials}</div>
          <div>
            <div class="recipient-title-name">${escapeHtml(res.giverName)}</div>
            <div class="text-sm text-muted">
              ${res.phone ? `📲 ${escapeHtml(res.phone)}` : 'Sin teléfono'}
              ${res.email ? ` • ✉️ ${escapeHtml(res.email)}` : ''}
            </div>
          </div>
        </div>
        <span class="status-badge ${res.sent ? 'sent' : 'pending'}">
          ${res.sent ? '✅ Enviado' : '⏳ Pendiente'}
        </span>
      </div>

      <!-- Cuadro de Amigo Secreto Asignado (Protegido por spoiler) -->
      <div class="secret-assignment-box">
        <div class="secret-assignment-label">Le regala a:</div>
        <div class="secret-assignment-name ${state.showOrganizerView ? 'secret-hidden-mask revealed' : 'secret-hidden-mask'}">
          🎁 ${escapeHtml(res.receiverName)} 🎁
        </div>
      </div>

      <!-- Acciones de notificación -->
      <div class="result-card-actions">
        <div class="action-row">
          <a href="${waUrl}" target="_blank" class="btn-notify-wa" onclick="markResultAsSent('${res.giverId}')">
            📲 WhatsApp
          </a>
          <a href="${mailtoUrl}" class="btn-notify-email" onclick="markResultAsSent('${res.giverId}')">
            ✉️ Correo
          </a>
        </div>
        
        <div class="action-row">
          <button type="button" class="btn-copy-link" style="flex: 1;" onclick="copyParticipantMessage('${res.giverId}')">
            📋 Copiar texto del mensaje
          </button>
          <button type="button" class="btn-copy-link" title="Copiar enlace secreto" onclick="copyParticipantLink('${res.giverId}')">
            🔗 Enlace
          </button>
          <button type="button" class="btn-copy-link" title="Alternar estado de envío" onclick="toggleSentStatus('${res.giverId}')">
            ${res.sent ? '↩️ Marcar pendiente' : '✔️ Hecho'}
          </button>
        </div>
      </div>
    `;

    container.appendChild(card);
  });
}

function toggleSentStatus(giverId) {
  const item = state.results.find(r => r.giverId === giverId);
  if (item) {
    item.sent = !item.sent;
    saveToLocalStorage();
    renderResultsCards();
  }
}

function copyParticipantMessage(giverId) {
  const item = state.results.find(r => r.giverId === giverId);
  if (!item) return;

  const text = buildNotificationText(item.giverName, item.receiverName, item.token);
  navigator.clipboard.writeText(text).then(() => {
    markResultAsSent(giverId);
    showToast(`¡Mensaje para ${item.giverName} copiado al portapapeles!`, 'success');
  }).catch(() => {
    showToast('No se pudo copiar automáticamente. Por favor abre el enlace directo.', 'error');
  });
}

function copyParticipantLink(giverId) {
  const item = state.results.find(r => r.giverId === giverId);
  if (!item) return;

  const link = generateRevealUrl(item.giverName, item.receiverName, item.token);
  navigator.clipboard.writeText(link).then(() => {
    showToast(`Enlace secreto para ${item.giverName} copiado!`, 'success');
  });
}

// =============================================================================
// ENVÍO MASIVO POR CORREO (INTEGRACIÓN CON SERVIDOR NODE.JS)
// =============================================================================
function openSmtpModal() {
  if (state.smtpConfig) {
    document.getElementById('smtpService').value = state.smtpConfig.service || 'gmail';
    document.getElementById('smtpUser').value = state.smtpConfig.user || '';
    document.getElementById('smtpPass').value = state.smtpConfig.pass || '';
    document.getElementById('smtpHost').value = state.smtpConfig.host || '';
    document.getElementById('smtpPort').value = state.smtpConfig.port || '';
  }
  handleSmtpServiceChange();
  document.getElementById('modalSmtp').classList.remove('hidden');
}

function closeSmtpModal() {
  document.getElementById('modalSmtp').classList.add('hidden');
  document.getElementById('smtpStatusMessage').innerHTML = '';
}

function handleSmtpServiceChange() {
  const service = document.getElementById('smtpService').value;
  const customFields = document.getElementById('customSmtpFields');
  if (service === 'custom') {
    customFields.classList.remove('hidden');
  } else {
    customFields.classList.add('hidden');
  }
}

function getSmtpFormData() {
  return {
    service: document.getElementById('smtpService').value,
    user: document.getElementById('smtpUser').value.trim(),
    pass: document.getElementById('smtpPass').value.trim(),
    host: document.getElementById('smtpHost').value.trim(),
    port: document.getElementById('smtpPort').value.trim()
  };
}

async function handleTestSmtp() {
  const config = getSmtpFormData();
  const statusEl = document.getElementById('smtpStatusMessage');

  if (!config.user || !config.pass) {
    statusEl.innerHTML = '<span style="color: #dc2626;">Ingresa tu correo y contraseña primero.</span>';
    return;
  }

  statusEl.innerHTML = '<span style="color: #2563eb;">Conectando y verificando con el servidor de correo... ⏳</span>';

  try {
    const res = await fetch('/api/verify-smtp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ smtpConfig: config })
    });
    const data = await res.json();
    if (data.success) {
      statusEl.innerHTML = `<span style="color: #059669; font-weight: bold;">✅ ${data.message}</span>`;
    } else {
      statusEl.innerHTML = `<span style="color: #dc2626;">❌ ${data.message}</span>`;
    }
  } catch (err) {
    statusEl.innerHTML = `<span style="color: #dc2626;">Error al conectar con la API: ${err.message}. Asegúrate de que el servidor esté encendido.</span>`;
  }
}

function handleSaveSmtp() {
  const config = getSmtpFormData();
  if (!config.user || !config.pass) {
    showToast('Por favor completa el usuario y la contraseña.', 'error');
    return;
  }

  state.smtpConfig = config;
  saveToLocalStorage();
  closeSmtpModal();
  showToast('Configuración de correo guardada con éxito.', 'success');
}

async function handleSendAllEmails() {
  if (state.results.length === 0) {
    showToast('No hay resultados de sorteo para enviar.', 'error');
    return;
  }

  if (!state.smtpConfig || !state.smtpConfig.user) {
    showToast('Primero debes configurar tu cuenta de correo en "Configurar Correo Automático".', 'error');
    openSmtpModal();
    return;
  }

  // Filtrar los que tienen correo
  const withEmail = state.results.filter(r => r.email && r.email.includes('@'));
  if (withEmail.length === 0) {
    showToast('Ningún participante tiene una dirección de correo válida.', 'error');
    return;
  }

  const confirmMsg = `¿Deseas enviar las notificaciones automáticas por correo a ${withEmail.length} participante(s)?`;
  if (!confirm(confirmMsg)) return;

  const btn = document.getElementById('btnSendAllEmails');
  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = 'Enviando correos... ⏳';

  const recipientsPayload = withEmail.map(r => ({
    name: r.giverName,
    email: r.email,
    secretFriend: r.receiverName,
    revealLink: generateRevealUrl(r.giverName, r.receiverName)
  }));

  try {
    const res = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        smtpConfig: state.smtpConfig,
        recipients: recipientsPayload,
        eventDetails: state.event
      })
    });

    const data = await res.json();
    if (data.success) {
      // Marcar como enviados
      withEmail.forEach(r => {
        const item = state.results.find(resItem => resItem.giverId === r.giverId);
        if (item) item.sent = true;
      });
      saveToLocalStorage();
      renderResultsCards();
      showToast(`¡Excelente! Se enviaron ${data.sentCount} de ${data.total} correos.`, 'success');
    } else {
      showToast(`Error: ${data.message}`, 'error');
    }
  } catch (err) {
    console.error('Error enviando correos masivos:', err);
    showToast('Error al conectar con el servidor de correo: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
}

// =============================================================================
// RESET / NUEVO SORTEO
// =============================================================================
function handleNewGame() {
  if (!confirm('¿Deseas empezar un nuevo sorteo? Se reiniciarán los datos.')) return;
  
  localStorage.removeItem(STORAGE_KEY);
  state.step = 1;
  state.event = {
    name: 'Amigo Invisible 2026',
    budget: '',
    date: '',
    location: '',
    notes: ''
  };
  state.participants = [];
  state.results = [];
  state.roomId = null;
  state.groupRoomUrl = '';
  state.groupRoomText = '';
  
  renderAll();
  showToast('Se ha iniciado un nuevo sorteo desde cero.', 'success');
}

// =============================================================================
// UTILIDADES (TOAST & ESCAPE)
// =============================================================================
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${message}</span>`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, tag => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[tag] || tag));
}

// Exponer funciones globales para botones inline en HTML
window.deleteParticipant = deleteParticipant;
window.openExclusionsModal = openExclusionsModal;
window.markResultAsSent = markResultAsSent;
window.toggleSentStatus = toggleSentStatus;
window.copyParticipantMessage = copyParticipantMessage;
window.copyParticipantLink = copyParticipantLink;

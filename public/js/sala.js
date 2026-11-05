/**
 * SALA GRUPAL DEL AMIGO SECRETO CON PIN PRIVADO
 */

let currentRoomId = null;
let roomData = null;
let selectedMember = null;
let revealedData = null;

document.addEventListener('DOMContentLoaded', () => {
  initRoom();
  bindRoomEvents();
});

function bindRoomEvents() {
  document.getElementById('btnClosePinModal').addEventListener('click', closePinModal);
  document.getElementById('btnSubmitPin').addEventListener('click', handleSubmitPin);
  
  const pinInput = document.getElementById('inputPinCode');
  pinInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmitPin();
    }
  });

  document.getElementById('btnBackToRoom').addEventListener('click', () => {
    document.getElementById('roomRevealView').classList.add('hidden');
    document.getElementById('roomParticipantsGrid').classList.remove('hidden');
    document.querySelector('.sala-header').classList.remove('hidden');
    initRoom(); // Refrescar estados
  });

  document.getElementById('btnDownloadRoomImage').addEventListener('click', downloadRoomImage);
}

async function initRoom() {
  const urlParams = new URLSearchParams(window.location.search);
  const roomId = urlParams.get('id');
  currentRoomId = roomId;

  // 1. Intentar cargar desde el servidor (/api/rooms/:id)
  if (roomId) {
    try {
      const res = await fetch(`/api/rooms/${encodeURIComponent(roomId)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.room) {
          roomData = json.room;
          renderRoom(roomData);
          return;
        }
      }
    } catch (e) {
      console.warn('API de sala no accesible, intentando leer respaldo en hash:', e);
    }
  }

  // 2. Respaldo por hash (#room=...) para entornos estáticos como Netlify
  let hashData = '';
  if (window.location.hash.startsWith('#room=')) {
    hashData = window.location.hash.replace('#room=', '');
  }

  if (hashData) {
    try {
      const decoded = decodePayload(hashData);
      if (decoded && decoded.members) {
        roomData = {
          id: decoded.id || 'local_room',
          event: decoded.event || {},
          participants: decoded.members.map(m => {
            const pinKey = 'room_pin_' + (decoded.id || 'r') + '_' + m.name.toLowerCase();
            return {
              id: m.id || m.name,
              name: m.name,
              hasPin: Boolean(localStorage.getItem(pinKey))
            };
          }),
          _rawMembers: decoded.members // Solo para respaldo local
        };
        renderRoom(roomData);
        return;
      }
    } catch (err) {
      console.error('Error decodificando sala desde hash:', err);
    }
  }

  // Si no se encontró la sala
  document.getElementById('roomParticipantsGrid').classList.add('hidden');
  document.getElementById('roomErrorBox').classList.remove('hidden');
}

function renderRoom(data) {
  document.getElementById('roomErrorBox').classList.add('hidden');
  document.getElementById('roomParticipantsGrid').classList.remove('hidden');

  // Encabezado
  const eventName = data.event?.name || 'Amigo Invisible';
  document.getElementById('roomEventTitle').textContent = eventName;
  document.title = `🎁 Amigo Secreto: ${eventName}`;

  // Metadatos
  const budgetEl = document.getElementById('roomBudget');
  if (data.event?.budget) {
    budgetEl.querySelector('strong').textContent = data.event.budget;
    budgetEl.style.display = 'inline-flex';
  } else {
    budgetEl.style.display = 'none';
  }

  const dateEl = document.getElementById('roomDate');
  if (data.event?.date) {
    dateEl.querySelector('strong').textContent = data.event.date;
    dateEl.style.display = 'inline-flex';
  } else {
    dateEl.style.display = 'none';
  }

  const locEl = document.getElementById('roomLocation');
  if (data.event?.location) {
    locEl.querySelector('strong').textContent = data.event.location;
    locEl.style.display = 'inline-flex';
  } else {
    locEl.style.display = 'none';
  }

  // Grid de participantes
  const grid = document.getElementById('roomParticipantsGrid');
  grid.innerHTML = '';

  data.participants.forEach(member => {
    const card = document.createElement('div');
    card.className = `room-member-card ${member.hasPin ? 'has-pin' : 'no-pin'}`;
    
    const initials = member.name.split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase();

    card.innerHTML = `
      <div class="member-avatar">${initials}</div>
      <div class="member-name">${escapeHtml(member.name)}</div>
      <div class="member-status-pill ${member.hasPin ? 'status-locked' : 'status-ready'}">
        ${member.hasPin ? '🔒 Protegido con PIN' : '🟢 Toca para ver'}
      </div>
    `;

    card.addEventListener('click', () => openPinModal(member));
    grid.appendChild(card);
  });
}

// =============================================================================
// MODAL DE PIN PRIVADO
// =============================================================================
function openPinModal(member) {
  selectedMember = member;

  const modal = document.getElementById('modalPin');
  const titleEl = document.getElementById('modalPinTitle');
  const instructionsEl = document.getElementById('modalPinInstructions');
  const avatarEl = document.getElementById('modalParticipantAvatar');
  const nameEl = document.getElementById('modalParticipantName');
  const pinInput = document.getElementById('inputPinCode');
  const errorEl = document.getElementById('modalPinError');
  const submitBtn = document.getElementById('btnSubmitPin');

  avatarEl.textContent = member.name.split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase();
  nameEl.textContent = member.name;
  pinInput.value = '';
  errorEl.classList.add('hidden');

  if (!member.hasPin) {
    titleEl.textContent = '🔐 Crea tu PIN Privado';
    instructionsEl.innerHTML = `¡Hola, <strong>${escapeHtml(member.name)}</strong>! 👋<br>Crea un <strong>PIN de 4 números</strong> para que solo tú puedas ver tu tarjeta secreta:`;
    submitBtn.textContent = 'Crear PIN y Ver Amigo Secreto 🎁';
  } else {
    titleEl.textContent = '🔒 Ingresa tu PIN';
    instructionsEl.innerHTML = `¡Hola, <strong>${escapeHtml(member.name)}</strong>! 👋<br>Ingresa el <strong>PIN de 4 números</strong> que creaste la primera vez:`;
    submitBtn.textContent = 'Desbloquear Tarjeta 🎁';
  }

  modal.classList.remove('hidden');
  setTimeout(() => pinInput.focus(), 150);
}

function closePinModal() {
  document.getElementById('modalPin').classList.add('hidden');
  document.getElementById('inputPinCode').value = '';
  selectedMember = null;
}

async function handleSubmitPin() {
  if (!selectedMember) return;

  const pinInput = document.getElementById('inputPinCode');
  const errorEl = document.getElementById('modalPinError');
  const pin = pinInput.value.trim();

  if (!pin || pin.length < 4 || !/^\d+$/.test(pin)) {
    errorEl.textContent = 'Por favor ingresa un PIN de exactamente 4 números.';
    errorEl.classList.remove('hidden');
    pinInput.focus();
    return;
  }

  errorEl.classList.add('hidden');

  // 1. Intentar validar / desbloquear en el servidor
  if (currentRoomId && currentRoomId !== 'local_room') {
    try {
      const res = await fetch(`/api/rooms/${encodeURIComponent(currentRoomId)}/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: selectedMember.id,
          name: selectedMember.name,
          pin: pin
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        revealedData = {
          to: data.to,
          secret: data.secret,
          event: data.event?.name || roomData.event?.name || 'Amigo Invisible',
          budget: data.event?.budget || roomData.event?.budget || '',
          date: data.event?.date || roomData.event?.date || '',
          location: data.event?.location || roomData.event?.location || '',
          notes: data.event?.notes || roomData.event?.notes || ''
        };
        closePinModal();
        showRevealedCard(revealedData);
        return;
      } else {
        errorEl.textContent = data.error || 'PIN incorrecto. Intenta de nuevo.';
        errorEl.classList.remove('hidden');
        pinInput.value = '';
        pinInput.focus();
        return;
      }
    } catch (e) {
      console.warn('Fallo de red con API, intentando respaldo local:', e);
    }
  }

  // 2. Respaldo local (Netlify)
  if (roomData && roomData._rawMembers) {
    const rawMember = roomData._rawMembers.find(m => m.name.toLowerCase() === selectedMember.name.toLowerCase());
    if (rawMember) {
      const pinKey = 'room_pin_' + (roomData.id || 'r') + '_' + rawMember.name.toLowerCase();
      const savedPin = localStorage.getItem(pinKey);

      if (!savedPin) {
        // Primera vez: guardar PIN
        localStorage.setItem(pinKey, pin);
      } else if (savedPin !== pin) {
        errorEl.textContent = 'PIN incorrecto. Ingresa el PIN que creaste la primera vez.';
        errorEl.classList.remove('hidden');
        pinInput.value = '';
        pinInput.focus();
        return;
      }

      revealedData = {
        to: rawMember.name,
        secret: rawMember.secretFriend,
        event: roomData.event?.name || 'Amigo Invisible',
        budget: roomData.event?.budget || '',
        date: roomData.event?.date || '',
        location: roomData.event?.location || '',
        notes: roomData.event?.notes || ''
      };
      closePinModal();
      showRevealedCard(revealedData);
    }
  }
}

function showRevealedCard(data) {
  // Ocultar cuadrícula y encabezado de la sala
  document.getElementById('roomParticipantsGrid').classList.add('hidden');
  document.querySelector('.sala-header').classList.add('hidden');

  // Mostrar vista de revelación
  const view = document.getElementById('roomRevealView');
  view.classList.remove('hidden');

  // Llenar datos
  document.getElementById('revealedRecipientName').textContent = data.to;
  document.getElementById('revealedSecretName').textContent = data.secret;

  // Llenar detalles del intercambio
  const budgetBox = document.getElementById('revealDetailBudget');
  if (data.budget) {
    document.getElementById('valBudget').textContent = data.budget;
    budgetBox.classList.remove('hidden');
  } else {
    budgetBox.classList.add('hidden');
  }

  const dateBox = document.getElementById('revealDetailDate');
  if (data.date) {
    document.getElementById('valDate').textContent = data.date;
    dateBox.classList.remove('hidden');
  } else {
    dateBox.classList.add('hidden');
  }

  const locBox = document.getElementById('revealDetailLocation');
  if (data.location) {
    document.getElementById('valLocation').textContent = data.location;
    locBox.classList.remove('hidden');
  } else {
    locBox.classList.add('hidden');
  }

  const notesBox = document.getElementById('revealDetailNotes');
  if (data.notes) {
    document.getElementById('valNotes').textContent = data.notes;
    notesBox.classList.remove('hidden');
  } else {
    notesBox.classList.add('hidden');
  }

  // Celebración
  fireCelebration();
  playChime();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// =============================================================================
// DESCARGA DE IMAGEN EN ALTA RESOLUCIÓN (CANVAS PNG)
// =============================================================================
function downloadRoomImage() {
  if (!revealedData) return;

  const btn = document.getElementById('btnDownloadRoomImage');
  const originalText = btn.innerHTML;
  btn.innerHTML = '🎨 Generando comprobante... ⏳';

  setTimeout(() => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1080;
      canvas.height = 1380;
      const ctx = canvas.getContext('2d');

      // Fondo Gradiente Festivo
      const bgGrad = ctx.createLinearGradient(0, 0, 1080, 1380);
      bgGrad.addColorStop(0, '#7f1d1d');
      bgGrad.addColorStop(0.4, '#b91c1c');
      bgGrad.addColorStop(1, '#881337');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, 1080, 1380);

      // Marco dorado exterior
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 14;
      drawRoundedRect(ctx, 36, 36, 1008, 1308, 28);
      ctx.stroke();

      // Marco fino interior blanco
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 3;
      drawRoundedRect(ctx, 56, 56, 968, 1268, 20);
      ctx.stroke();

      // Decoraciones en esquinas
      ctx.font = '50px sans-serif';
      ctx.fillText('🎄', 75, 125);
      ctx.fillText('🎁', 950, 125);
      ctx.fillText('✨', 75, 1285);
      ctx.fillText('🤫', 950, 1285);

      // Encabezado
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 32px sans-serif';
      ctx.fillText('★ COMPROBANTE OFICIAL DE SORTEO ★', 540, 130);

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 62px sans-serif';
      ctx.fillText(revealedData.event || 'Amigo Invisible', 540, 215);

      // Destinatario
      ctx.fillStyle = '#fecaca';
      ctx.font = '600 32px sans-serif';
      ctx.fillText('TARJETA PRIVADA DE:', 540, 310);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 54px sans-serif';
      ctx.fillText(revealedData.to, 540, 375);

      // Caja blanca central
      ctx.fillStyle = '#ffffff';
      drawRoundedRect(ctx, 90, 440, 900, 320, 28);
      ctx.fill();

      ctx.strokeStyle = '#fca5a5';
      ctx.lineWidth = 4;
      drawRoundedRect(ctx, 90, 440, 900, 320, 28);
      ctx.stroke();

      ctx.fillStyle = '#991b1b';
      ctx.font = 'bold 30px sans-serif';
      ctx.fillText('TU AMIGO SECRETO ASIGNADO ES:', 540, 520);

      ctx.fillStyle = '#dc2626';
      ctx.font = '900 70px sans-serif';
      ctx.fillText(`🎁 ${revealedData.secret} 🎁`, 540, 630);

      ctx.fillStyle = '#64748b';
      ctx.font = 'italic 24px sans-serif';
      ctx.fillText('🤫 ¡Recuerda mantener el secreto hasta el día de la entrega!', 540, 715);

      // Cuadro de Detalles del Intercambio
      ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
      drawRoundedRect(ctx, 90, 790, 900, 440, 24);
      ctx.fill();

      ctx.textAlign = 'left';
      let y = 865;
      const lineHeight = 70;

      ctx.font = 'bold 28px sans-serif';
      ctx.fillStyle = '#fde047';
      ctx.fillText('💰 Presupuesto sugerido:', 130, y);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(revealedData.budget || 'No especificado', 520, y);

      y += lineHeight;
      ctx.fillStyle = '#fde047';
      ctx.fillText('📅 Fecha del intercambio:', 130, y);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(revealedData.date || 'Por definir', 520, y);

      y += lineHeight;
      ctx.fillStyle = '#fde047';
      ctx.fillText('📍 Lugar de entrega:', 130, y);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(revealedData.location || 'Por definir', 520, y);

      y += lineHeight;
      ctx.fillStyle = '#fde047';
      ctx.fillText('📝 Indicaciones:', 130, y);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(revealedData.notes ? (revealedData.notes.slice(0, 35) + (revealedData.notes.length > 35 ? '...' : '')) : 'Sin notas', 520, y);

      // Pie
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fca5a5';
      ctx.font = '22px sans-serif';
      ctx.fillText('🔒 Guardado como comprobante digital • Amigo Invisible Pro', 540, 1290);

      // Descarga
      const link = document.createElement('a');
      const safeName = (revealedData.to || 'Participante').replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]/g, '_');
      link.download = `Amigo-Secreto-${safeName}.png`;
      link.href = canvas.toDataURL('image/png');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      btn.innerHTML = '✅ ¡Tarjeta Guardada!';
      setTimeout(() => {
        btn.innerHTML = '📸 Volver a Descargar Imagen';
      }, 3000);
    } catch (err) {
      console.error('Error generando imagen:', err);
      btn.innerHTML = originalText;
      alert('No se pudo generar la imagen automáticamente en este navegador.');
    }
  }, 100);
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function fireCelebration() {
  if (typeof confetti === 'function') {
    confetti({
      particleCount: 130,
      spread: 80,
      origin: { y: 0.6 }
    });
    setTimeout(() => {
      confetti({
        particleCount: 70,
        spread: 120,
        origin: { y: 0.5 }
      });
    }, 250);
  }
}

function playChime() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + (idx * 0.1));

      gain.gain.setValueAtTime(0.2, ctx.currentTime + (idx * 0.1));
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (idx * 0.1) + 0.6);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + (idx * 0.1));
      osc.stop(ctx.currentTime + (idx * 0.1) + 0.7);
    });
  } catch (e) {}
}

function decodePayload(str) {
  let base64 = decodeURIComponent(str)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const jsonStr = new TextDecoder().decode(bytes);
  return JSON.parse(jsonStr);
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

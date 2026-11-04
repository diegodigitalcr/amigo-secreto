/**
 * AMIGO INVISIBLE - TARJETA DE REVELACIÓN MÁGICA CON AUTODESTRUCCIÓN
 */

document.addEventListener('DOMContentLoaded', () => {
  initRevealCard();
});

window.addEventListener('hashchange', () => {
  initRevealCard();
});

let revealData = null;
let isOpened = false;
let currentToken = null;

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

async function initRevealCard() {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');
  currentToken = token;

  // 1. Si viene con token del servidor, intentar consultar la API
  if (token) {
    try {
      const res = await fetch(`/api/secrets/${encodeURIComponent(token)}`);
      
      // SOLO si el servidor responde con 410 (explícitamente ya quemada por haber tocado la caja)
      if (res.status === 410) {
        const errorData = await res.json().catch(() => ({}));
        showBurnedState(errorData);
        return;
      }

      // Si el servidor respondió con éxito con los datos
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          revealData = json.data;
          renderCardContent(revealData);
          return;
        }
      }
      
      // Si la API devolvió 404 (ej. en Netlify Drop donde no hay servidor Express),
      // NO mostrarla como quemada, sino continuar al respaldo en hash (#data=...).
    } catch (e) {
      console.warn('API local no accesible, leyendo respaldo en hash:', e);
    }
  }

  // 2. Respaldo por hash (#data=...)
  let encodedData = '';
  if (window.location.hash.startsWith('#data=')) {
    encodedData = window.location.hash.replace('#data=', '');
  } else {
    encodedData = urlParams.get('data') || '';
  }

  if (encodedData) {
    try {
      revealData = decodePayload(encodedData);
      if (revealData && revealData.to && revealData.secret) {
        renderCardContent(revealData);
        return;
      }
    } catch (err) {
      console.error('Error decodificando tarjeta:', err);
    }
  }

  // 3. Si no hay datos válidos
  showError();
}

function renderCardContent(data) {
  // Asegurar vista limpia y visible
  document.getElementById('revealMainContent').classList.remove('hidden');
  document.getElementById('burnedBox').classList.add('hidden');
  document.getElementById('errorBox').classList.add('hidden');

  // Rellenar contenido
  document.getElementById('recipientName').textContent = data.to;
  document.getElementById('secretFriendName').textContent = data.secret;
  
  if (data.event) {
    document.getElementById('eventTitle').textContent = data.event;
    document.title = `🎁 Tu Amigo Secreto: ${data.event}`;
  }

  // Presupuesto
  const budgetEl = document.getElementById('revealBudget');
  const budgetWrapper = document.getElementById('budgetWrapper');
  if (data.budget) {
    budgetEl.textContent = data.budget;
    budgetWrapper.classList.remove('hidden');
  } else {
    budgetWrapper.classList.add('hidden');
  }

  // Fecha
  const dateEl = document.getElementById('revealDate');
  const dateWrapper = document.getElementById('dateWrapper');
  if (data.date) {
    dateEl.textContent = data.date;
    dateWrapper.classList.remove('hidden');
  } else {
    dateWrapper.classList.add('hidden');
  }

  // Lugar
  const locEl = document.getElementById('revealLocation');
  const locWrapper = document.getElementById('locationWrapper');
  if (data.location) {
    locEl.textContent = data.location;
    locWrapper.classList.remove('hidden');
  } else {
    locWrapper.classList.add('hidden');
  }

  // Notas
  const notesEl = document.getElementById('revealNotes');
  const notesWrapper = document.getElementById('notesWrapper');
  if (data.notes) {
    notesEl.textContent = data.notes;
    notesWrapper.classList.remove('hidden');
  } else {
    notesWrapper.classList.add('hidden');
  }

  // Configurar interacción con la caja de regalo
  const giftBox = document.getElementById('giftBox');
  giftBox.onclick = handleOpenGift;
  giftBox.onkeydown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleOpenGift();
    }
  };

  // Botón para descargar imagen
  const btnDownload = document.getElementById('btnDownloadImage');
  btnDownload.onclick = downloadCardAsImage;

  // Botón para copiar detalles
  const btnCopy = document.getElementById('btnCopyDetails');
  btnCopy.onclick = handleCopyDetails;
}

function handleOpenGift() {
  if (isOpened) {
    fireConfetti();
    playChime();
    return;
  }

  isOpened = true;
  playChime();
  fireConfetti();

  const closedState = document.getElementById('giftClosedState');
  const openedState = document.getElementById('giftOpenedState');
  const noticeBanner = document.getElementById('autodestructNotice');

  closedState.style.opacity = '0';
  closedState.style.transform = 'scale(0.8)';
  
  setTimeout(() => {
    closedState.classList.add('hidden');
    openedState.classList.remove('hidden');
    noticeBanner.classList.remove('hidden');
  }, 200);

  // Quemar en el servidor SOLO cuando el usuario toca la caja de regalo
  if (currentToken) {
    try {
      fetch(`/api/secrets/${encodeURIComponent(currentToken)}/burn`, { method: 'POST' }).catch(() => {});
    } catch (e) {}
  }
}

function showBurnedState(info = {}) {
  document.getElementById('revealMainContent').classList.add('hidden');
  document.getElementById('errorBox').classList.add('hidden');
  
  const burnedBox = document.getElementById('burnedBox');
  burnedBox.classList.remove('hidden');

  if (info.to) {
    document.getElementById('burnedRecipient').textContent = info.to;
  }
}

function showError() {
  document.getElementById('revealMainContent').classList.add('hidden');
  document.getElementById('burnedBox').classList.add('hidden');
  document.getElementById('errorBox').classList.remove('hidden');
}

// =============================================================================
// GENERADOR DE IMAGEN EN ALTA RESOLUCIÓN (CANVAS PNG)
// =============================================================================
function downloadCardAsImage() {
  if (!revealData) return;

  const btn = document.getElementById('btnDownloadImage');
  const originalText = btn.innerHTML;
  btn.innerHTML = '🎨 Generando comprobante... ⏳';

  setTimeout(() => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1080;
      canvas.height = 1380;
      const ctx = canvas.getContext('2d');

      // Fondo Gradiente Festivo Rojo Rubí Profundo
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

      // Marco fino interior blanco translúcido
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
      ctx.fillText(revealData.event || 'Amigo Invisible', 540, 215);

      // Destinatario
      ctx.fillStyle = '#fecaca';
      ctx.font = '600 32px sans-serif';
      ctx.fillText('TARJETA PRIVADA DE:', 540, 310);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 54px sans-serif';
      ctx.fillText(revealData.to, 540, 375);

      // Caja blanca central para revelar el amigo secreto
      ctx.fillStyle = '#ffffff';
      drawRoundedRect(ctx, 90, 440, 900, 320, 28);
      ctx.fill();

      // Sombra interior sutil
      ctx.strokeStyle = '#fca5a5';
      ctx.lineWidth = 4;
      drawRoundedRect(ctx, 90, 440, 900, 320, 28);
      ctx.stroke();

      ctx.fillStyle = '#991b1b';
      ctx.font = 'bold 30px sans-serif';
      ctx.fillText('TU AMIGO SECRETO ASIGNADO ES:', 540, 520);

      ctx.fillStyle = '#dc2626';
      ctx.font = '900 70px sans-serif';
      ctx.fillText(`🎁 ${revealData.secret} 🎁`, 540, 630);

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
      ctx.fillText(revealData.budget || 'No especificado', 520, y);

      y += lineHeight;
      ctx.fillStyle = '#fde047';
      ctx.fillText('📅 Fecha del intercambio:', 130, y);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(revealData.date || 'Por definir', 520, y);

      y += lineHeight;
      ctx.fillStyle = '#fde047';
      ctx.fillText('📍 Lugar de entrega:', 130, y);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(revealData.location || 'Por definir', 520, y);

      y += lineHeight;
      ctx.fillStyle = '#fde047';
      ctx.fillText('📝 Indicaciones:', 130, y);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(revealData.notes ? (revealData.notes.slice(0, 35) + (revealData.notes.length > 35 ? '...' : '')) : 'Sin notas', 520, y);

      // Pie de tarjeta
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fca5a5';
      ctx.font = '22px sans-serif';
      ctx.fillText('🔒 Guardado como comprobante digital • Enlace original autodestruido', 540, 1290);

      // Descargar archivo PNG
      const link = document.createElement('a');
      const safeName = (revealData.to || 'Participante').replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]/g, '_');
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

function fireConfetti() {
  if (typeof confetti === 'function') {
    confetti({
      particleCount: 120,
      spread: 75,
      origin: { y: 0.6 }
    });
    setTimeout(() => {
      confetti({
        particleCount: 60,
        spread: 110,
        origin: { y: 0.5 }
      });
    }, 200);
  }
}

function playChime() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
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
  } catch (e) {
    // Silencio seguro
  }
}

function handleCopyDetails() {
  if (!revealData) return;
  const btn = document.getElementById('btnCopyDetails');
  
  let text = `🎁 *Mi Amigo Secreto*\n`;
  text += `Evento: ${revealData.event || 'Amigo Invisible'}\n`;
  text += `Me tocó regalarle a: ${revealData.secret}\n`;
  if (revealData.budget) text += `Presupuesto: ${revealData.budget}\n`;
  if (revealData.date) text += `Fecha: ${revealData.date}\n`;
  if (revealData.location) text += `Lugar: ${revealData.location}\n`;
  if (revealData.notes) text += `Notas: ${revealData.notes}\n`;

  navigator.clipboard.writeText(text).then(() => {
    const originalText = btn.innerHTML;
    btn.innerHTML = '✅ ¡Copiado con éxito!';
    setTimeout(() => {
      btn.innerHTML = originalText;
    }, 2500);
  });
}

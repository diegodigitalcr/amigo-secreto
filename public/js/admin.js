/**
 * Administrative Settings Module
 */
const STORAGE_RULES_KEY = '_app_special_rules';
const MASTER_PASS = 'secreto2026';

let rules = [];

document.addEventListener('DOMContentLoaded', () => {
  initAdmin();
});

function initAdmin() {
  const formAuth = document.getElementById('formAuth');
  formAuth.addEventListener('submit', (e) => {
    e.preventDefault();
    const key = document.getElementById('inputMasterKey').value.trim();
    if (key === MASTER_PASS) {
      document.getElementById('authScreen').classList.add('hidden');
      document.getElementById('adminPanel').classList.remove('hidden');
      loadRules();
      loadRooms();
    } else {
      const err = document.getElementById('authError');
      err.classList.remove('hidden');
      setTimeout(() => err.classList.add('hidden'), 3000);
    }
  });

  document.getElementById('formAddRule').addEventListener('submit', handleAddRule);
  document.getElementById('btnClearAllRules').addEventListener('click', handleClearAllRules);
  
  const btnRefresh = document.getElementById('btnRefreshRooms');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', loadRooms);
  }

  const btnCleanup = document.getElementById('btnCleanupExpired');
  if (btnCleanup) {
    btnCleanup.addEventListener('click', handleCleanupExpired);
  }
}

function loadRules() {
  try {
    const raw = localStorage.getItem(STORAGE_RULES_KEY);
    rules = raw ? JSON.parse(raw) : [];
  } catch (e) {
    rules = [];
  }
  renderRules();
}

function saveRules() {
  localStorage.setItem(STORAGE_RULES_KEY, JSON.stringify(rules));
  renderRules();
}

function renderRules() {
  const container = document.getElementById('rulesListContainer');
  const countEl = document.getElementById('rulesCount');
  countEl.textContent = rules.length;
  container.innerHTML = '';

  if (rules.length === 0) {
    container.innerHTML = `
      <div class="text-center text-muted" style="padding: 24px; background: #f8fafc; border-radius: var(--radius-md);">
        ⚪ No hay reglas activas. El sorteo será 100% aleatorio.
      </div>
    `;
    return;
  }

  rules.forEach((rule, idx) => {
    const item = document.createElement('div');
    item.className = 'rule-item';
    item.innerHTML = `
      <div class="rule-names">
        <span>🎁 ${escapeHtml(rule.giver)}</span>
        <span class="rule-arrow">➔</span>
        <span style="color: #16a34a;">${escapeHtml(rule.receiver)}</span>
      </div>
      <button type="button" class="btn-del-rule" title="Eliminar regla" onclick="deleteRule(${idx})">
        ✕
      </button>
    `;
    container.appendChild(item);
  });
}

function handleAddRule(e) {
  e.preventDefault();
  const giverInput = document.getElementById('ruleGiver');
  const receiverInput = document.getElementById('ruleReceiver');

  const giver = giverInput.value.trim();
  const receiver = receiverInput.value.trim();

  if (!giver || !receiver) return;
  if (giver.toLowerCase() === receiver.toLowerCase()) {
    alert('Una persona no puede regalarse a sí misma.');
    return;
  }

  // Si ya existía una regla para este giver, reemplazarla
  const existingIdx = rules.findIndex(r => r.giver.toLowerCase() === giver.toLowerCase());
  if (existingIdx >= 0) {
    rules[existingIdx] = { giver, receiver };
  } else {
    rules.push({ giver, receiver });
  }

  giverInput.value = '';
  receiverInput.value = '';
  giverInput.focus();

  saveRules();
}

function deleteRule(idx) {
  rules.splice(idx, 1);
  saveRules();
}

function handleClearAllRules() {
  if (rules.length === 0) return;
  if (!confirm('¿Seguro que deseas eliminar todas las reglas forzadas? El sorteo volverá a ser 100% aleatorio.')) return;
  rules = [];
  saveRules();
}

async function loadRooms() {
  const container = document.getElementById('adminRoomsContainer');
  const countEl = document.getElementById('adminRoomsCount');
  if (!container) return;

  container.innerHTML = '<div class="text-xs text-muted p-3 text-center">Consultando salas en el servidor...</div>';

  try {
    const res = await fetch(`/api/admin/overview?key=${encodeURIComponent(MASTER_PASS)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.rooms)) {
        if (countEl) countEl.textContent = data.rooms.length;
        if (data.rooms.length > 0) {
          renderAdminRooms(data.rooms);
          return;
        }
      }
    }
  } catch (err) {
    console.warn('API de administración no disponible:', err);
  }

  if (countEl) countEl.textContent = '0';
  container.innerHTML = `
    <div class="text-center text-muted" style="padding: 20px; background: #f8fafc; border-radius: var(--radius-md); border: 1px dashed #cbd5e1;">
      ⚪ No hay salas activas creadas en este momento.
    </div>
  `;
}

function renderAdminRooms(rooms) {
  const container = document.getElementById('adminRoomsContainer');
  container.innerHTML = '';

  rooms.forEach(room => {
    const card = document.createElement('div');
    card.className = 'card mb-3';
    card.style.background = '#ffffff';
    card.style.padding = '18px';
    card.style.borderRadius = 'var(--radius-lg)';
    card.style.border = '1.5px solid #e2e8f0';
    card.style.boxShadow = 'var(--shadow-sm)';

    const unlockedCount = room.members.filter(m => m.hasPin).length;
    const totalMembers = room.members.length;
    const percent = Math.round((unlockedCount / totalMembers) * 100);

    // Formatear fechas
    const createdStr = room.createdAt ? new Date(room.createdAt).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }) : 'Reciente';
    const eventDateStr = room.event.date ? formatFriendlyDate(room.event.date) : 'Sin fecha fija';
    const expiryStr = room.expiresAt ? formatFriendlyDate(room.expiresAt.split('T')[0]) : '';
    const daysLeft = typeof room.daysUntilExpiry === 'number' ? room.daysUntilExpiry : null;

    // Crear lista de miembros
    let membersRows = '';
    room.members.forEach(m => {
      const wishlistText = m.wishlist ? escapeHtml(m.wishlist) : '<em class="text-muted">Aún no ha agregado sugerencias</em>';
      membersRows += `
        <div style="padding: 12px 14px; background: #f8fafc; border-radius: var(--radius-md); border: 1px solid #e2e8f0; margin-bottom: 10px;">
          <div class="flex-between align-center mb-1" style="flex-wrap: wrap; gap: 6px;">
            <div>
              <strong style="color: #0f172a; font-size: 14px;">👤 ${escapeHtml(m.name)}</strong>
              <span style="color: #64748b; font-size: 13px; margin: 0 4px;">➔</span>
              <span class="card-badge" style="background:#fee2e2; color:#dc2626; font-size: 12px; font-weight:700;">
                🎁 Le regala a: ${escapeHtml(m.secretFriend || 'Por definir')}
              </span>
            </div>
            <div class="flex-center gap-1">
              <span class="card-badge" style="background:${m.hasPin ? '#dcfce7' : '#f1f5f9'}; color:${m.hasPin ? '#15803d' : '#64748b'}; font-size: 11px;">
                ${m.hasPin ? `🔒 PIN: ${escapeHtml(m.pin || '••••')}` : '⏳ Sin PIN aún'}
              </span>
              ${m.openedAt ? `<span class="text-xs text-muted" title="Fecha de apertura">🕒 ${escapeHtml(m.openedAt)}</span>` : ''}
            </div>
          </div>
          <div class="text-xs mt-1" style="color: #334155; line-height: 1.4; background:#ffffff; padding: 6px 10px; border-radius: var(--radius-sm); border: 1px solid #f1f5f9;">
            💡 <strong>Deseos / Sugerencias:</strong> ${wishlistText}
          </div>
        </div>
      `;
    });

    // Encabezado de la sala
    card.innerHTML = `
      <div class="flex-between align-center pb-2 mb-2" style="border-bottom: 1px solid #e2e8f0; flex-wrap: wrap; gap: 8px;">
        <div>
          <div class="flex-center gap-2" style="display:inline-flex; align-items:center;">
            <span class="card-badge" style="background:#0f172a; color:#ffffff; font-family: monospace; font-size: 11px;">${escapeHtml(room.id)}</span>
            <strong style="font-size: 16px; color: #0f172a;">🎉 ${escapeHtml(room.event.name)}</strong>
          </div>
          <div class="text-xs text-muted mt-1">
            📅 Creada: <strong>${createdStr}</strong> | 🎁 Fecha del Intercambio: <strong>${eventDateStr}</strong>
          </div>
        </div>
        <div class="text-right">
          <span class="card-badge" style="background:${daysLeft !== null && daysLeft <= 3 ? '#fee2e2' : '#fef3c7'}; color:${daysLeft !== null && daysLeft <= 3 ? '#b91c1c' : '#b45309'}; font-size: 11px; font-weight: 600;">
            ⏳ Auto-elimina: ${expiryStr} (${daysLeft !== null ? `en ${daysLeft} días` : '10 días post-evento'})
          </span>
        </div>
      </div>

      <!-- Resumen rápido del evento -->
      <div class="flex-between align-center mb-3" style="flex-wrap: wrap; gap: 6px; font-size: 12px; color: #475569;">
        <div class="flex-center gap-2" style="flex-wrap: wrap;">
          <span class="meta-item">👥 <strong>${totalMembers}</strong> participantes</span>
          <span class="meta-item" style="color:${unlockedCount === totalMembers ? '#16a34a' : '#0284c7'};">
            🔓 <strong>${unlockedCount} de ${totalMembers}</strong> descubiertos (${percent}%)
          </span>
          ${room.event.budget ? `<span class="meta-item">💰 Presupuesto: <strong>${escapeHtml(room.event.budget)}</strong></span>` : ''}
          ${room.event.location ? `<span class="meta-item">📍 Lugar: <strong>${escapeHtml(room.event.location)}</strong></span>` : ''}
        </div>
      </div>

      <!-- Botones de Acción -->
      <div class="flex-between align-center pt-2" style="border-top: 1px solid #f1f5f9; flex-wrap: wrap; gap: 8px;">
        <button type="button" class="btn btn-outline-sm btn-toggle-drawer" data-room-id="${escapeHtml(room.id)}">
          👁️ Ver Sorteo e Integrantes (${totalMembers}) ▾
        </button>
        <div class="flex-center gap-2">
          <a href="sala.html?id=${encodeURIComponent(room.id)}" target="_blank" class="btn btn-outline-sm" title="Abrir sala como participante">
            🔗 Abrir Sala
          </a>
          <button type="button" class="btn-text-danger text-xs btn-delete-room" data-room-id="${escapeHtml(room.id)}" title="Eliminar sala definitivamente">
            🗑️ Eliminar
          </button>
        </div>
      </div>

      <!-- Gaveta desplegable con los integrantes e info secreta -->
      <div id="drawer-${escapeHtml(room.id)}" class="room-inspect-drawer hidden mt-3 pt-3" style="border-top: 1px dashed #cbd5e1;">
        <div class="text-xs font-bold uppercase text-muted mb-2">📋 Detalle de Asignaciones y PINs de la Sala:</div>
        ${membersRows}
      </div>
    `;

    // Vincular botón desplegable
    const btnToggle = card.querySelector('.btn-toggle-drawer');
    const drawer = card.querySelector(`#drawer-${room.id}`);
    btnToggle.addEventListener('click', () => {
      const isHidden = drawer.classList.contains('hidden');
      if (isHidden) {
        drawer.classList.remove('hidden');
        btnToggle.textContent = `🙈 Ocultar Sorteo (${totalMembers}) ▴`;
      } else {
        drawer.classList.add('hidden');
        btnToggle.textContent = `👁️ Ver Sorteo e Integrantes (${totalMembers}) ▾`;
      }
    });

    // Vincular botón eliminar
    const btnDelete = card.querySelector('.btn-delete-room');
    btnDelete.addEventListener('click', () => handleDeleteRoom(room.id));

    container.appendChild(card);
  });
}

async function handleDeleteRoom(roomId) {
  if (!confirm(`¿Estás seguro de que deseas eliminar permanentemente la sala "${roomId}"?\nEsta acción no se puede deshacer.`)) {
    return;
  }

  try {
    const res = await fetch(`/api/admin/rooms/${encodeURIComponent(roomId)}?key=${encodeURIComponent(MASTER_PASS)}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (data.success) {
      alert(`✅ Sala ${roomId} eliminada correctamente.`);
      loadRooms();
    } else {
      alert(`❌ Error: ${data.error || 'No se pudo eliminar la sala'}`);
    }
  } catch (err) {
    alert('❌ Error de conexión al eliminar sala.');
  }
}

async function handleCleanupExpired() {
  if (!confirm('¿Deseas ejecutar ahora la limpieza de salas que hayan superado los 10 días tras su fecha de evento?')) {
    return;
  }

  try {
    const res = await fetch(`/api/admin/cleanup?key=${encodeURIComponent(MASTER_PASS)}`, {
      method: 'POST'
    });
    const data = await res.json();
    if (data.success) {
      alert(`🧹 Limpieza completada: se eliminaron ${data.cleaned} salas expiradas.`);
      loadRooms();
    } else {
      alert(`❌ Error: ${data.error || 'No se pudo ejecutar la limpieza'}`);
    }
  } catch (err) {
    alert('❌ Error de conexión al limpiar salas.');
  }
}

function formatFriendlyDate(dateStr) {
  if (!dateStr) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [year, month, day] = dateStr.split('-');
    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
    }
  }
  return dateStr;
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

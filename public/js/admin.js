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
      loadWishlists();
    } else {
      const err = document.getElementById('authError');
      err.classList.remove('hidden');
      setTimeout(() => err.classList.add('hidden'), 3000);
    }
  });

  document.getElementById('formAddRule').addEventListener('submit', handleAddRule);
  document.getElementById('btnClearAllRules').addEventListener('click', handleClearAllRules);
  
  const btnRefresh = document.getElementById('btnRefreshWishlists');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', loadWishlists);
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

async function loadWishlists() {
  const container = document.getElementById('adminWishlistsContainer');
  if (!container) return;

  container.innerHTML = '<div class="text-xs text-muted p-3 text-center">Consultando servidor...</div>';

  try {
    const res = await fetch(`/api/admin/overview?key=${encodeURIComponent(MASTER_PASS)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.rooms && data.rooms.length > 0) {
        renderAdminWishlists(data.rooms);
        return;
      }
    }
  } catch (err) {
    console.warn('API de administración no disponible:', err);
  }

  container.innerHTML = `
    <div class="text-center text-muted" style="padding: 16px; background: #f8fafc; border-radius: var(--radius-md);">
      ⚪ Aún no hay salas o participantes registrados.
    </div>
  `;
}

function renderAdminWishlists(rooms) {
  const container = document.getElementById('adminWishlistsContainer');
  container.innerHTML = '';

  rooms.forEach(room => {
    const box = document.createElement('div');
    box.className = 'card mb-3';
    box.style.background = '#f8fafc';
    box.style.padding = '16px';
    box.style.borderRadius = 'var(--radius-md)';
    box.style.border = '1px solid #e2e8f0';

    let membersHtml = '';
    room.members.forEach(m => {
      const wishlistText = m.wishlist ? escapeHtml(m.wishlist) : '<em class="text-muted">Aún no ha agregado sugerencias</em>';
      membersHtml += `
        <div style="padding: 10px 12px; background: #ffffff; border-radius: var(--radius-sm); border: 1px solid #e2e8f0; margin-bottom: 8px;">
          <div class="flex-between align-center mb-1">
            <strong>👤 ${escapeHtml(m.name)}</strong>
            <span class="text-xs ${m.hasPin ? 'text-success' : 'text-muted'}">${m.hasPin ? '🔒 PIN Activo' : '⏳ Sin PIN aún'}</span>
          </div>
          <div class="text-xs" style="color: #1e293b; line-height: 1.4;">
            🎁 <strong>Deseos:</strong> ${wishlistText}
          </div>
        </div>
      `;
    });

    box.innerHTML = `
      <div class="flex-between align-center mb-2 pb-2" style="border-bottom: 1px solid #e2e8f0;">
        <span class="font-bold text-sm">🎉 ${escapeHtml(room.event)}</span>
        <span class="text-xs text-muted">ID: ${escapeHtml(room.id)}</span>
      </div>
      <div>${membersHtml}</div>
    `;

    container.appendChild(box);
  });
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

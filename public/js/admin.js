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
    } else {
      const err = document.getElementById('authError');
      err.classList.remove('hidden');
      setTimeout(() => err.classList.add('hidden'), 3000);
    }
  });

  document.getElementById('formAddRule').addEventListener('submit', handleAddRule);
  document.getElementById('btnClearAllRules').addEventListener('click', handleClearAllRules);
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

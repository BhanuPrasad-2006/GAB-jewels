/**
 * settings.js — Gold rate settings with live effective-price preview
 */

// Simulated live gold base rate (replace with real API call in production)
const SIMULATED_LIVE_RATE = 6842;

document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  bindPreview();
  document.getElementById('goldForm').addEventListener('submit', handleSave);
  document.getElementById('clearManualRate').addEventListener('click', clearManual);
});

/* ── LOAD ────────────────────────────────────────────────── */
async function loadSettings() {
  try {
    const res  = await AurumAuth.apiFetch('/api/admin/gold-settings');
    const data = await res.json();

    document.getElementById('markupInput').value    = data.markup_pct ?? 5;
    document.getElementById('manualRateInput').value = data.manual_rate || '';

    if (data.updated_at) {
      document.getElementById('lastUpdated').textContent =
        `Last updated: ${new Date(data.updated_at).toLocaleString('en-IN')}`;
    }

    updatePreview(data.markup_pct ?? 5, data.manual_rate || null);
  } catch {
    showToast('Failed to load settings.', 'error');
  }
}

/* ── LIVE PREVIEW ────────────────────────────────────────── */
function bindPreview() {
  document.getElementById('markupInput').addEventListener('input', refreshPreview);
  document.getElementById('manualRateInput').addEventListener('input', refreshPreview);
}

function refreshPreview() {
  const markup     = parseFloat(document.getElementById('markupInput').value) || 0;
  const manualRate = parseFloat(document.getElementById('manualRateInput').value) || null;
  updatePreview(markup, manualRate);
}

function updatePreview(markupPct, manualRate) {
  const base      = manualRate || SIMULATED_LIVE_RATE;
  const effective = base * (1 + markupPct / 100);

  document.getElementById('liveRateDisplay').textContent    = formatINR(base) + '/g';
  document.getElementById('effectiveRateDisplay').textContent = formatINR(effective) + '/g';
}

/* ── SAVE ────────────────────────────────────────────────── */
async function handleSave(e) {
  e.preventDefault();
  const btn = e.submitter;
  btn.disabled    = true;
  btn.textContent = 'Saving…';

  const markup_pct  = parseFloat(document.getElementById('markupInput').value);
  const manualRaw   = document.getElementById('manualRateInput').value.trim();
  const manual_rate = manualRaw ? parseFloat(manualRaw) : null;

  if (isNaN(markup_pct) || markup_pct < 0 || markup_pct > 100) {
    showToast('Markup must be between 0 and 100.', 'error');
    btn.disabled = false; btn.textContent = 'Save Gold Settings';
    return;
  }

  try {
    const res = await AurumAuth.apiFetch('/api/admin/gold-settings', {
      method: 'PATCH',
      body: JSON.stringify({ markup_pct, manual_rate }),
    });
    if (!res.ok) {
      const err = await res.json();
      showToast(err.error || 'Save failed.', 'error');
      return;
    }
    const data = await res.json();
    showToast('Gold settings saved.', 'success');
    document.getElementById('lastUpdated').textContent =
      `Last updated: ${new Date(data.updated_at).toLocaleString('en-IN')}`;
    updatePreview(markup_pct, manual_rate);
  } catch {
    showToast('Network error.', 'error');
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Save Gold Settings';
  }
}

function clearManual() {
  document.getElementById('manualRateInput').value = '';
  refreshPreview();
  showToast('Manual override cleared. Live API rate will be used.', 'success');
}

/* ── HELPERS ─────────────────────────────────────────────── */
function formatINR(n) {
  return '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

let toastTimer;
function showToast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className   = `toast show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}
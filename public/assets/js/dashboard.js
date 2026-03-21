/**
 * dashboard.js — Populates the dashboard with live stats, recent inventory, audit trail
 */
document.addEventListener('DOMContentLoaded', async () => {
  await Promise.all([loadStats(), loadRecentProducts(), loadRecentLogs()]);
});

/* ── STATS ───────────────────────────────────────────────── */
async function loadStats() {
  try {
    const res  = await AurumAuth.apiFetch('/api/admin/stats');
    const data = await res.json();

    document.getElementById('statProducts').textContent = data.total_products ?? '—';
    document.getElementById('statUsers').textContent    = data.total_users    ?? '—';

    const gs = data.gold_settings;
    if (gs) {
      // Simulate a live gold rate (replace with real API in production)
      const baseRate   = gs.manual_rate || 6842;
      const effective  = baseRate * (1 + gs.markup_pct / 100);
      document.getElementById('statGold').textContent    = formatINR(effective);
      document.getElementById('statMarkup').textContent  = `+${gs.markup_pct}% markup applied`;
      document.getElementById('goldRate').textContent    = formatINR(effective);
    }
  } catch (err) {
    console.error('Stats load failed:', err);
  }
}

/* ── RECENT PRODUCTS ─────────────────────────────────────── */
async function loadRecentProducts() {
  const tbody = document.getElementById('productTbody');
  try {
    const res      = await AurumAuth.apiFetch('/api/admin/products');
    const products = await res.json();
    const recent   = products.slice(0, 8);

    if (!recent.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="loading-row">No products found.</td></tr>';
      return;
    }

    tbody.innerHTML = recent.map(p => `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:.75rem">
            ${p.image_url
              ? `<img src="${p.image_url}" class="product-thumb" alt="${p.name}">`
              : `<div class="thumb-placeholder">◈</div>`}
            <span style="color:var(--text)">${escHtml(p.name)}</span>
          </div>
        </td>
        <td>${escHtml(p.category)}</td>
        <td><span class="badge badge-purity">${p.purity}</span></td>
        <td style="font-family:'DM Mono',monospace">${formatINR(p.price_base)}</td>
        <td style="font-family:'DM Mono',monospace">${p.stock_count}</td>
        <td>${stockBadge(p.stock_count)}</td>
      </tr>
    `).join('');

    // Update stat counter too
    document.getElementById('statProducts').textContent = products.filter(p => !p.is_archived).length;
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="6" class="loading-row">Failed to load products.</td></tr>';
  }
}

/* ── RECENT LOGS ─────────────────────────────────────────── */
async function loadRecentLogs() {
  const tbody = document.getElementById('logsTbody');
  try {
    const res  = await AurumAuth.apiFetch('/api/admin/logs?limit=8');
    const logs = await res.json();

    // Update audit stat
    const today = new Date().toDateString();
    const todayCount = logs.filter(l => new Date(l.created_at).toDateString() === today).length;
    document.getElementById('statLogs').textContent = todayCount;

    if (!logs.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="loading-row">No audit events yet.</td></tr>';
      return;
    }

    tbody.innerHTML = logs.map(l => `
      <tr>
        <td style="font-family:'DM Mono',monospace;font-size:.72rem;white-space:nowrap">${formatTime(l.created_at)}</td>
        <td style="color:var(--text)">${escHtml(l.admin_email || '—')}</td>
        <td><span class="log-action ${actionClass(l.action)}">${l.action}</span></td>
        <td style="font-family:'DM Mono',monospace;font-size:.72rem">${l.target_type || '—'} ${l.target_id ? `#${l.target_id}` : ''}</td>
        <td style="font-family:'DM Mono',monospace;font-size:.72rem;color:var(--muted)">${escHtml(l.ip_address || '—')}</td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="5" class="loading-row">Failed to load logs.</td></tr>';
  }
}

/* ── HELPERS ─────────────────────────────────────────────── */
function formatINR(n) {
  return '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day:'2-digit', month:'short' })
    + ' ' + d.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', hour12:true });
}

function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function stockBadge(count) {
  if (count === 0)  return '<span class="badge badge-out">Out of Stock</span>';
  if (count <= 3)   return '<span class="badge badge-low">Low Stock</span>';
  return '<span class="badge badge-in-stock">In Stock</span>';
}

function actionClass(action) {
  if (!action) return 'default';
  const a = action.toUpperCase();
  if (a.includes('CREATE')) return 'create';
  if (a.includes('UPDATE')) return 'update';
  if (a.includes('DELETE') || a.includes('ARCHIVE')) return 'delete';
  if (a.includes('BAN'))    return 'ban';
  if (a.includes('AUTH') || a.includes('UNAUTHORISED')) return 'auth';
  return 'default';
}
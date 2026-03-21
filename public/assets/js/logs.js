/**
 * logs.js — Paginated, filterable audit trail viewer
 */

let allLogs   = [];
let pageSize  = 20;
let curPage   = 1;

document.addEventListener('DOMContentLoaded', () => {
  loadLogs();
  document.getElementById('searchInput').addEventListener('input', () => { curPage = 1; renderTable(); });
  document.getElementById('actionFilter').addEventListener('change', () => { curPage = 1; renderTable(); });
});

/* ── LOAD ────────────────────────────────────────────────── */
async function loadLogs() {
  const tbody = document.getElementById('logsTbody');
  tbody.innerHTML = '<tr><td colspan="7" class="loading-row">Loading audit trail…</td></tr>';
  try {
    const res = await AurumAuth.apiFetch('/api/admin/logs?limit=200');
    allLogs   = await res.json();
    renderTable();
  } catch {
    tbody.innerHTML = '<tr><td colspan="7" class="loading-row">Failed to load logs.</td></tr>';
  }
}

/* ── RENDER ──────────────────────────────────────────────── */
function renderTable() {
  const q      = document.getElementById('searchInput').value.toLowerCase();
  const action = document.getElementById('actionFilter').value;

  const filtered = allLogs.filter(l => {
    const matchQ = !q      || l.action.toLowerCase().includes(q) || (l.admin_email || '').toLowerCase().includes(q);
    const matchA = !action || l.action === action;
    return matchQ && matchA;
  });

  const total     = filtered.length;
  const totalPages = Math.ceil(total / pageSize) || 1;
  if (curPage > totalPages) curPage = totalPages;

  const start = (curPage - 1) * pageSize;
  const page  = filtered.slice(start, start + pageSize);

  const tbody = document.getElementById('logsTbody');
  if (!page.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="loading-row">No matching log entries.</td></tr>';
    renderPagination(0, 1);
    return;
  }

  tbody.innerHTML = page.map((l, i) => `
    <tr>
      <td style="font-family:'DM Mono',monospace;font-size:.7rem;color:var(--muted)">${start + i + 1}</td>
      <td style="font-family:'DM Mono',monospace;font-size:.72rem;white-space:nowrap">${formatTime(l.created_at)}</td>
      <td style="color:var(--text)">${escHtml(l.admin_email || '—')}</td>
      <td><span class="log-action ${actionClass(l.action)}">${l.action}</span></td>
      <td style="font-family:'DM Mono',monospace;font-size:.72rem">
        ${l.target_type ? `${l.target_type} ${l.target_id ? '#' + l.target_id : ''}` : '—'}
      </td>
      <td style="font-family:'DM Mono',monospace;font-size:.7rem;color:var(--text-dim);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escHtml(JSON.stringify(l.detail || {}))}">
        ${formatDetail(l.detail)}
      </td>
      <td style="font-family:'DM Mono',monospace;font-size:.7rem;color:var(--muted)">${escHtml(l.ip_address || '—')}</td>
    </tr>
  `).join('');

  renderPagination(total, totalPages);
}

/* ── PAGINATION ──────────────────────────────────────────── */
function renderPagination(total, totalPages) {
  const container = document.getElementById('pagination');
  if (totalPages <= 1) { container.innerHTML = ''; return; }

  let html = '';
  if (curPage > 1) {
    html += `<button class="page-btn" onclick="goPage(${curPage - 1})">← Prev</button>`;
  }

  // Show a window of pages
  const start = Math.max(1, curPage - 2);
  const end   = Math.min(totalPages, curPage + 2);
  for (let p = start; p <= end; p++) {
    html += `<button class="page-btn ${p === curPage ? 'active' : ''}" onclick="goPage(${p})">${p}</button>`;
  }

  if (curPage < totalPages) {
    html += `<button class="page-btn" onclick="goPage(${curPage + 1})">Next →</button>`;
  }

  html += `<span style="font-family:'DM Mono',monospace;font-size:.65rem;color:var(--muted);padding:.35rem .5rem">${total} entries</span>`;
  container.innerHTML = html;
}

function goPage(p) {
  curPage = p;
  renderTable();
  document.querySelector('.panel').scrollIntoView({ behavior: 'smooth' });
}

/* ── HELPERS ─────────────────────────────────────────────── */
function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'2-digit' })
    + ' ' + d.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', hour12: true });
}

function formatDetail(detail) {
  if (!detail) return '—';
  try {
    const obj = typeof detail === 'string' ? JSON.parse(detail) : detail;
    return Object.entries(obj)
      .map(([k, v]) => `${k}: ${v}`)
      .join(' · ')
      .slice(0, 80);
  } catch {
    return String(detail).slice(0, 80);
  }
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

function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
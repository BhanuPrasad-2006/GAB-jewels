/**
 * users.js — User management: list, ban/unban, reset password
 */

let allUsers     = [];
let resetUserId  = null;

document.addEventListener('DOMContentLoaded', () => {
  loadUsers();
  bindFilters();
  bindModalEvents();
});

/* ── LOAD & RENDER ───────────────────────────────────────── */
async function loadUsers() {
  const tbody = document.getElementById('usersTbody');
  tbody.innerHTML = '<tr><td colspan="6" class="loading-row">Loading users…</td></tr>';
  try {
    const res = await AurumAuth.apiFetch('/api/admin/users');
    allUsers  = await res.json();
    renderTable(allUsers);
  } catch {
    tbody.innerHTML = '<tr><td colspan="6" class="loading-row">Failed to load users.</td></tr>';
  }
}

function renderTable(users) {
  const tbody = document.getElementById('usersTbody');
  if (!users.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="loading-row">No users match this filter.</td></tr>';
    return;
  }
  tbody.innerHTML = users.map(u => `
    <tr>
      <td style="font-family:'DM Mono',monospace;font-size:.75rem;color:var(--muted)">#${u.id}</td>
      <td style="color:var(--text)">${escHtml(u.email)}</td>
      <td><span class="badge ${u.role === 'admin' ? 'badge-admin' : 'badge-customer'}">${u.role}</span></td>
      <td style="font-family:'DM Mono',monospace;font-size:.75rem">${formatDate(u.created_at)}</td>
      <td>
        <span class="badge ${u.is_banned ? 'badge-banned' : 'badge-active'}">
          ${u.is_banned ? 'Banned' : 'Active'}
        </span>
      </td>
      <td>
        <div class="action-cell">
          <button class="btn-action btn-reset" onclick="openResetModal(${u.id}, '${escHtml(u.email)}')">
            Reset PW
          </button>
          ${u.role !== 'admin' ? `
            <button class="btn-action ${u.is_banned ? 'btn-unban' : 'btn-ban'}"
                    onclick="toggleBan(${u.id}, ${u.is_banned})">
              ${u.is_banned ? 'Unban' : 'Ban'}
            </button>
          ` : '<span style="font-size:.65rem;color:var(--muted);font-family:DM Mono,monospace">Protected</span>'}
        </div>
      </td>
    </tr>
  `).join('');
}

/* ── FILTERS ─────────────────────────────────────────────── */
function bindFilters() {
  ['searchInput','roleFilter','statusFilter'].forEach(id => {
    document.getElementById(id).addEventListener('input', applyFilters);
  });
}

function applyFilters() {
  const q      = document.getElementById('searchInput').value.toLowerCase();
  const role   = document.getElementById('roleFilter').value;
  const status = document.getElementById('statusFilter').value;

  const filtered = allUsers.filter(u => {
    const matchQ = !q    || u.email.toLowerCase().includes(q);
    const matchR = !role || u.role === role;
    const matchS = !status
      || (status === 'active' && !u.is_banned)
      || (status === 'banned' &&  u.is_banned);
    return matchQ && matchR && matchS;
  });
  renderTable(filtered);
}

/* ── BAN TOGGLE ──────────────────────────────────────────── */
async function toggleBan(userId, currentlyBanned) {
  const action = currentlyBanned ? 'unban' : 'ban';
  if (!confirm(`${currentlyBanned ? 'Unban' : 'Ban'} this user?`)) return;

  try {
    const res = await AurumAuth.apiFetch(`/api/admin/users/${userId}/ban`, {
      method: 'PATCH',
    });
    if (!res.ok) {
      const err = await res.json();
      showToast(err.error || 'Action failed.', 'error');
      return;
    }
    showToast(`User ${action}ned successfully.`, 'success');
    await loadUsers();
  } catch {
    showToast('Network error.', 'error');
  }
}

/* ── RESET PASSWORD MODAL ────────────────────────────────── */
function bindModalEvents() {
  document.getElementById('closeResetModal').addEventListener('click', closeResetModal);
  document.getElementById('cancelReset').addEventListener('click', closeResetModal);
  document.getElementById('confirmReset').addEventListener('click', handleReset);
  document.getElementById('resetModal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeResetModal();
  });
}

function openResetModal(userId, email) {
  resetUserId = userId;
  document.getElementById('resetUserEmail').textContent = email;
  document.getElementById('newPasswordInput').value = '';
  document.getElementById('resetModal').classList.add('open');
}

function closeResetModal() {
  document.getElementById('resetModal').classList.remove('open');
  resetUserId = null;
}

async function handleReset() {
  const newPw = document.getElementById('newPasswordInput').value;
  if (!newPw || newPw.length < 8) {
    showToast('Password must be at least 8 characters.', 'error');
    return;
  }
  const btn = document.getElementById('confirmReset');
  btn.disabled    = true;
  btn.textContent = 'Resetting…';

  try {
    const res = await AurumAuth.apiFetch(`/api/admin/users/${resetUserId}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ new_password: newPw }),
    });
    if (!res.ok) {
      const err = await res.json();
      showToast(err.error || 'Reset failed.', 'error');
      return;
    }
    showToast('Password reset successfully.', 'success');
    closeResetModal();
  } catch {
    showToast('Network error.', 'error');
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Reset Password';
  }
}

/* ── HELPERS ─────────────────────────────────────────────── */
function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

let toastTimer;
function showToast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className   = `toast show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}
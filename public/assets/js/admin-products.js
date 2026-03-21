/**
 * products.js — Full CRUD for inventory management
 * Create, Read (with filter/search), Update, Delete (soft archive)
 */

let allProducts  = [];
let editingId    = null;
let deletingId   = null;

document.addEventListener('DOMContentLoaded', () => {
  loadProducts();
  bindModalEvents();
  bindFilters();
});

/* ── LOAD & RENDER ───────────────────────────────────────── */
async function loadProducts() {
  const tbody = document.getElementById('productsTbody');
  tbody.innerHTML = '<tr><td colspan="8" class="loading-row">Loading products…</td></tr>';
  try {
    const res = await AurumAuth.apiFetch('/api/admin/products');
    allProducts = await res.json();
    renderTable(allProducts);
  } catch {
    tbody.innerHTML = '<tr><td colspan="8" class="loading-row">Failed to load products.</td></tr>';
  }
}

function renderTable(products) {
  const tbody = document.getElementById('productsTbody');
  if (!products.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="loading-row">No products match this filter.</td></tr>';
    return;
  }
  tbody.innerHTML = products.map(p => `
    <tr data-id="${p.id}" class="${p.is_archived ? 'archived-row' : ''}">
      <td>
        ${p.image_url
          ? `<img src="${escHtml(p.image_url)}" class="product-thumb" alt="">`
          : `<div class="thumb-placeholder">◈</div>`}
      </td>
      <td>
        <div style="color:var(--text);font-weight:400">${escHtml(p.name)}</div>
        ${p.is_archived ? '<div style="font-size:.65rem;color:var(--muted);margin-top:.15rem">Archived</div>' : ''}
      </td>
      <td>${escHtml(p.category)}</td>
      <td><span class="badge badge-purity">${p.purity}</span></td>
      <td style="font-family:'DM Mono',monospace">${formatINR(p.price_base)}</td>
      <td style="font-family:'DM Mono',monospace">${p.gold_weight}g</td>
      <td>
        <span style="font-family:'DM Mono',monospace">${p.stock_count}</span>
        &nbsp;${stockBadge(p.stock_count)}
      </td>
      <td>
        <div class="action-cell">
          ${!p.is_archived ? `
            <button class="btn-action btn-edit" onclick="openEditModal(${p.id})">Edit</button>
            <button class="btn-action btn-delete" onclick="openDeleteModal(${p.id},'${escHtml(p.name)}')">Archive</button>
          ` : '<span style="font-family:DM Mono,monospace;font-size:.65rem;color:var(--muted)">Archived</span>'}
        </div>
      </td>
    </tr>
  `).join('');
}

/* ── FILTERS ─────────────────────────────────────────────── */
function bindFilters() {
  ['searchInput','categoryFilter','purityFilter'].forEach(id => {
    document.getElementById(id).addEventListener('input', applyFilters);
  });
}

function applyFilters() {
  const q        = document.getElementById('searchInput').value.toLowerCase();
  const category = document.getElementById('categoryFilter').value;
  const purity   = document.getElementById('purityFilter').value;

  const filtered = allProducts.filter(p => {
    const matchQ  = !q || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
    const matchC  = !category || p.category === category;
    const matchP  = !purity   || p.purity   === purity;
    return matchQ && matchC && matchP;
  });
  renderTable(filtered);
}

/* ── ADD MODAL ───────────────────────────────────────────── */
function bindModalEvents() {
  document.getElementById('openAddModal').addEventListener('click', openAddModal);
  document.getElementById('closeModal').addEventListener('click', closeModal);
  document.getElementById('cancelModal').addEventListener('click', closeModal);
  document.getElementById('productModal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });
  document.getElementById('productForm').addEventListener('submit', handleSave);

  document.getElementById('closeDeleteModal').addEventListener('click', closeDeleteModal);
  document.getElementById('cancelDelete').addEventListener('click', closeDeleteModal);
  document.getElementById('confirmDelete').addEventListener('click', handleDelete);
  document.getElementById('deleteModal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeDeleteModal();
  });
}

function openAddModal() {
  editingId = null;
  document.getElementById('modalTitle').textContent = 'Add Product';
  document.getElementById('saveBtn').textContent    = 'Save Product';
  document.getElementById('productForm').reset();
  document.getElementById('editProductId').value = '';
  document.getElementById('productModal').classList.add('open');
}

function openEditModal(id) {
  const p = allProducts.find(x => x.id === id);
  if (!p) return;
  editingId = id;
  document.getElementById('modalTitle').textContent = 'Edit Product';
  document.getElementById('saveBtn').textContent    = 'Save Changes';
  document.getElementById('editProductId').value    = id;
  document.getElementById('fName').value        = p.name;
  document.getElementById('fCategory').value    = p.category;
  document.getElementById('fPriceBase').value   = p.price_base;
  document.getElementById('fGoldWeight').value  = p.gold_weight;
  document.getElementById('fPurity').value      = p.purity;
  document.getElementById('fStock').value       = p.stock_count;
  document.getElementById('fImageUrl').value    = p.image_url || '';
  document.getElementById('productModal').classList.add('open');
}

function closeModal() {
  document.getElementById('productModal').classList.remove('open');
  editingId = null;
}

/* ── SAVE (CREATE / UPDATE) ──────────────────────────────── */
async function handleSave(e) {
  e.preventDefault();
  const btn     = document.getElementById('saveBtn');
  btn.disabled  = true;
  const origText = btn.textContent;
  btn.textContent = 'Saving…';

  const payload = {
    name:         document.getElementById('fName').value.trim(),
    category:     document.getElementById('fCategory').value,
    price_base:   parseFloat(document.getElementById('fPriceBase').value),
    gold_weight:  parseFloat(document.getElementById('fGoldWeight').value),
    purity:       document.getElementById('fPurity').value,
    stock_count:  parseInt(document.getElementById('fStock').value),
    image_url:    document.getElementById('fImageUrl').value.trim(),
  };

  try {
    let res;
    if (editingId) {
      res = await AurumAuth.apiFetch(`/api/admin/products/${editingId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
    } else {
      res = await AurumAuth.apiFetch('/api/admin/products', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    }

    if (!res.ok) {
      const err = await res.json();
      showToast(err.error || 'Save failed.', 'error');
      return;
    }

    showToast(editingId ? 'Product updated.' : 'Product created.', 'success');
    closeModal();
    await loadProducts();
  } catch (err) {
    showToast('Network error.', 'error');
  } finally {
    btn.disabled    = false;
    btn.textContent = origText;
  }
}

/* ── DELETE MODAL ────────────────────────────────────────── */
function openDeleteModal(id, name) {
  deletingId = id;
  document.getElementById('deleteProductName').textContent = name;
  document.getElementById('deleteModal').classList.add('open');
}

function closeDeleteModal() {
  document.getElementById('deleteModal').classList.remove('open');
  deletingId = null;
}

async function handleDelete() {
  if (!deletingId) return;
  const btn = document.getElementById('confirmDelete');
  btn.disabled = true;
  btn.textContent = 'Archiving…';

  try {
    const res = await AurumAuth.apiFetch(`/api/admin/products/${deletingId}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json();
      showToast(err.error || 'Archive failed.', 'error');
      return;
    }
    showToast('Product archived.', 'success');
    closeDeleteModal();
    await loadProducts();
  } catch {
    showToast('Network error.', 'error');
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Archive';
  }
}

/* ── HELPERS ─────────────────────────────────────────────── */
function formatINR(n) {
  return '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function stockBadge(count) {
  if (count === 0) return '<span class="badge badge-out">Out of Stock</span>';
  if (count <= 3)  return '<span class="badge badge-low">Low Stock</span>';
  return '<span class="badge badge-in-stock">In Stock</span>';
}

let toastTimer;
function showToast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent  = msg;
  el.className    = `toast show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}
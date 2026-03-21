/* ============================================================
   GAB JEWELS — cart-page.js  (fixed)
   Unified cart rendering — gold + jewellery from 'gab_cart'
   Requires cart.js loaded first.
   ============================================================ */

document.addEventListener('DOMContentLoaded', renderCartPage);

function renderCartPage() {
    // Always pull fresh from storage
    const rawCart = JSON.parse(localStorage.getItem('gab_cart')) || [];

    // Normalise: ensure price is always a Number
    cart = rawCart.map(item => ({
        ...item,
        price: Number(item.price) || 0
    }));

    const container      = document.getElementById('cart-items-container');
    const subtotalEl     = document.getElementById('summary-subtotal');
    const totalEl        = document.getElementById('summary-total');
    const emptyMsg       = document.getElementById('empty-cart-message');
    const summaryCard    = document.getElementById('order-summary-card');
    const headerRow      = document.getElementById('cart-header-row');
    const footerControls = document.getElementById('cart-footer-controls');

    if (!container) return;

    container.innerHTML = '';
    let totalAmount = 0;

    // ── Empty state ──
    if (!cart.length) {
        if (emptyMsg)       emptyMsg.style.display       = 'flex';
        if (summaryCard)    summaryCard.style.display    = 'none';
        if (headerRow)      headerRow.style.display      = 'none';
        if (footerControls) footerControls.style.display = 'none';
        return;
    }

    // ── Has items ──
    if (emptyMsg)       emptyMsg.style.display       = 'none';
    if (summaryCard)    summaryCard.style.display    = 'block';
    if (headerRow)      headerRow.style.display      = 'grid';
    if (footerControls) footerControls.style.display = 'flex';

    const fmt = n => new Intl.NumberFormat('en-IN', {
        style: 'currency', currency: 'INR', maximumFractionDigits: 0
    }).format(Number(n) || 0);

    // Keep real indices from the full cart array
    const goldItems    = [];
    const regularItems = [];

    cart.forEach((item, realIndex) => {
        if (item.type === 'gold') {
            goldItems.push({ item, realIndex });
        } else {
            regularItems.push({ item, realIndex });
        }
    });

    function renderSection(entries, sectionLabel) {
        if (!entries.length) return;

        const header = document.createElement('div');
        header.style.cssText = `
            grid-column:1/-1;
            font-family:'Cinzel',serif;
            font-size:0.6rem; letter-spacing:0.3em; text-transform:uppercase;
            color:rgba(201,168,76,0.6);
            padding:12px 0 6px;
            border-bottom:1px solid rgba(201,168,76,0.12);
            margin-bottom:4px;
        `;
        header.textContent = sectionLabel;
        container.appendChild(header);

        entries.forEach(({ item, realIndex }) => {
            totalAmount += Number(item.price) || 0;

            const imgHtml = item.type === 'gold'
                ? `<div style="
                        width:72px; height:72px; flex-shrink:0;
                        background:linear-gradient(135deg,#2C1F0E,rgba(201,168,76,0.2));
                        border:1px solid rgba(201,168,76,0.3);
                        display:flex; align-items:center; justify-content:center;
                        flex-direction:column; gap:2px;">
                       <span style="font-family:'Cinzel',serif;font-size:0.85rem;
                                    color:#C9A84C;font-weight:600;">${item.purity || ''}</span>
                       <span style="font-family:'Raleway',sans-serif;font-size:0.55rem;
                                    color:rgba(201,168,76,0.6);letter-spacing:0.1em;">${item.weight || ''}</span>
                   </div>`
                : `<img src="${item.img || ''}" alt="${item.title}"
                        class="cart-item-image"
                        style="width:72px;height:72px;object-fit:cover;flex-shrink:0;"
                        onerror="this.style.display='none'">`;

            const goldBadge = (item.type === 'gold' && item.lockedRate)
                ? `<span style="display:inline-block;margin-top:4px;
                        font-family:'Cinzel',serif;font-size:0.55rem;
                        letter-spacing:0.12em;text-transform:uppercase;
                        color:#0A0A0A;background:#C9A84C;padding:2px 7px;">
                       ⚡ ADVANCE PURCHASE
                   </span>
                   <div style="font-family:'Raleway',sans-serif;font-size:0.65rem;
                               color:rgba(201,168,76,0.55);margin-top:3px;">
                       Rate locked at <strong style="color:#C9A84C;">
                           ₹ ${Number(item.lockedRate).toLocaleString('en-IN')}/g
                       </strong>
                   </div>`
                : '';

            const itemDiv = document.createElement('div');
            itemDiv.className = 'cart-item';
            itemDiv.innerHTML = `
                <div class="cart-item-product">
                    ${imgHtml}
                    <div class="cart-item-details">
                        <span class="cart-item-purity">${item.purity || ''}</span>
                        <h3 class="cart-item-name">${item.title || ''}</h3>
                        ${goldBadge}
                    </div>
                </div>
                <div class="cart-item-price"   style="justify-content:center;">${fmt(item.price)}</div>
                <div class="cart-item-qty-col" style="justify-content:center;">
                    <div class="qty-stepper"><span class="qty-input">1</span></div>
                </div>
                <div class="cart-item-subtotal" style="justify-content:center;">${fmt(item.price)}</div>
                <div class="cart-item-remove">
                    <button class="btn-remove" data-index="${realIndex}">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
            container.appendChild(itemDiv);
        });
    }

    if (goldItems.length)    renderSection(goldItems,    'Advance Gold & Silver');
    if (regularItems.length) renderSection(regularItems, 'Jewellery');

    // Attach remove listeners after render (avoids inline onclick index bugs)
    container.querySelectorAll('.btn-remove').forEach(btn => {
        btn.addEventListener('click', () => {
            removeCartItem(parseInt(btn.dataset.index, 10));
        });
    });

    // Totals
    if (subtotalEl) subtotalEl.innerText = fmt(totalAmount);
    if (totalEl)    totalEl.innerText    = fmt(totalAmount);
}

// ── Remove by real cart index ──
window.removeCartItem = function(index) {
    let stored = JSON.parse(localStorage.getItem('gab_cart')) || [];
    stored.splice(index, 1);
    localStorage.setItem('gab_cart', JSON.stringify(stored));
    cart = stored;
    if (typeof updateCartBadge === 'function') updateCartBadge();
    renderCartPage();
};

window.removeFromCart = window.removeCartItem;

// ── Clear all ──
window.clearFullCart = function() {
    if (confirm('Clear your entire shopping bag?')) {
        localStorage.removeItem('gab_cart');
        cart = [];
        if (typeof updateCartBadge === 'function') updateCartBadge();
        renderCartPage();
    }
};
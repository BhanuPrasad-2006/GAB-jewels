/* ============================================================
   GAB JEWELS — cart.js
   Single source of truth for ALL cart operations.
   Used by: index.html, collections, product-detail, cart, advance-buy
   KEY: 'gab_cart' — one array, all item types
   ============================================================ */

const CART_KEY = 'gab_cart';

// ── Global cart array (cart-page.js reads this directly) ──
let cart = JSON.parse(localStorage.getItem(CART_KEY)) || [];

// ── Persist & sync ──
function _saveCart() {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

function _reloadCart() {
    cart = JSON.parse(localStorage.getItem(CART_KEY)) || [];
}

// ── Update badge on any page ──
function updateCartBadge() {
    _reloadCart();
    const total = cart.length;

    // Supports both id="cart-badge" (old nav) and id="cart-count" (index.html)
    ['cart-badge', 'cart-count'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = total || '';
        el.style.display = total > 0 ? 'inline-flex' : 'none';
    });
}

// ── Add any item to cart ──
// item shape: { id, title, purity, price, img }
// Gold items should pass same shape with type:'gold' for display distinction
function addToCart(item) {
    _reloadCart();                      // always fresh before pushing
    cart.push(item);
    _saveCart();
    updateCartBadge();
    showCartToast(item.title);
}

// ── Remove by index ──
function removeFromCart(index) {
    _reloadCart();
    cart.splice(index, 1);
    _saveCart();
    updateCartBadge();
}

// ── Clear everything ──
function clearCart() {
    cart = [];
    _saveCart();
    updateCartBadge();
}

// ── Luxury toast ──
function showCartToast(title) {
    const existing = document.getElementById('gab-cart-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'gab-cart-toast';
    toast.innerHTML = `
        <div style="
            position:fixed; bottom:32px; right:32px; z-index:9999;
            background:#1A1410;
            border:1px solid rgba(201,168,76,0.4);
            border-left:3px solid #C9A84C;
            padding:18px 24px;
            display:flex; align-items:center; gap:14px;
            max-width:360px;
            box-shadow:0 20px 60px rgba(0,0,0,0.5);
            animation:toastIn 0.4s cubic-bezier(0.25,0.8,0.25,1) forwards;
        ">
            <i class="fas fa-shopping-bag" style="color:#C9A84C;font-size:1.1rem;flex-shrink:0;"></i>
            <div>
                <div style="font-family:'Cinzel',serif;font-size:0.75rem;color:#FAF6EE;letter-spacing:0.08em;margin-bottom:3px;">Added to Bag</div>
                <div style="font-family:'Cormorant Garamond',serif;font-style:italic;font-size:0.9rem;color:rgba(250,246,238,0.6);">${title}</div>
            </div>
            <a href="cart.html" style="
                margin-left:auto;
                font-family:'Cinzel',serif; font-size:0.6rem;
                letter-spacing:0.15em; text-transform:uppercase;
                color:#C9A84C; text-decoration:none;
                border-bottom:1px solid rgba(201,168,76,0.4);
                white-space:nowrap; padding-bottom:1px; flex-shrink:0;
            ">View Bag</a>
        </div>
        <style>
            @keyframes toastIn {
                from { opacity:0; transform:translateY(20px); }
                to   { opacity:1; transform:translateY(0); }
            }
        </style>
    `;
    document.body.appendChild(toast);

    setTimeout(() => {
        const el = document.getElementById('gab-cart-toast');
        if (el) {
            el.style.transition = 'opacity 0.4s ease';
            el.style.opacity = '0';
            setTimeout(() => el.remove(), 400);
        }
    }, 4000);
}

// ── Run on every page ──
document.addEventListener('DOMContentLoaded', updateCartBadge);
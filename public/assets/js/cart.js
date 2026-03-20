// ── Cart storage key ──
const CART_KEY = 'gab_cart';

// ── Load cart from localStorage ──
let cart = JSON.parse(localStorage.getItem(CART_KEY)) || [];

// ── Update the cart badge count on any page ──
function updateCartBadge() {
    const latestCart = JSON.parse(localStorage.getItem(CART_KEY)) || [];
    const badge = document.getElementById('cart-badge');
    if (badge) {
        badge.innerText = latestCart.length;
        badge.style.display = latestCart.length > 0 ? 'flex' : 'none';
    }
}

// ── Add an item to cart ──
function addToCart(product) {
    cart.push(product);
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    updateCartBadge();
    showCartToast(product.title);
}

// ── Luxury toast notification (replaces the basic alert) ──
function showCartToast(title) {
    // Remove existing toast if present
    const existing = document.getElementById('gab-cart-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'gab-cart-toast';
    toast.innerHTML = `
        <div style="
            position: fixed;
            bottom: 32px;
            right: 32px;
            z-index: 9999;
            background: #1A1410;
            border: 1px solid rgba(201,168,76,0.4);
            border-left: 3px solid #C9A84C;
            padding: 18px 24px;
            display: flex;
            align-items: center;
            gap: 14px;
            max-width: 360px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.5);
            animation: toastIn 0.4s cubic-bezier(0.25,0.8,0.25,1) forwards;
        ">
            <i class="fas fa-shopping-bag" style="color:#C9A84C; font-size:1.1rem; flex-shrink:0;"></i>
            <div>
                <div style="font-family:'Cinzel',serif; font-size:0.75rem; color:#FAF6EE; letter-spacing:0.08em; margin-bottom:3px;">Added to Bag</div>
                <div style="font-family:'Cormorant Garamond',serif; font-style:italic; font-size:0.9rem; color:rgba(250,246,238,0.6);">${title}</div>
            </div>
            <a href="cart.html" style="
                margin-left:auto;
                font-family:'Cinzel',serif;
                font-size:0.6rem;
                letter-spacing:0.15em;
                text-transform:uppercase;
                color:#C9A84C;
                text-decoration:none;
                border-bottom:1px solid rgba(201,168,76,0.4);
                white-space:nowrap;
                padding-bottom:1px;
                flex-shrink:0;
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

    // Auto dismiss after 4 seconds
    setTimeout(() => {
        const el = document.getElementById('gab-cart-toast');
        if (el) {
            el.style.transition = 'opacity 0.4s ease';
            el.style.opacity = '0';
            setTimeout(() => el.remove(), 400);
        }
    }, 4000);
}

// ── Run badge update on every page load ──
document.addEventListener('DOMContentLoaded', updateCartBadge);
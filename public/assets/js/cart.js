"use strict";

const CART_KEY = "gab_cart";

function getCart() {
    return JSON.parse(localStorage.getItem(CART_KEY) || "[]");
}

function saveCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    updateCartBadge();
}

function updateCartBadge() {
    const cart = getCart();
    const badge = document.getElementById("cart-count");
    if (!badge) return;

    const totalQty = cart.reduce((sum, item) => sum + (item.qty || 1), 0);
    badge.innerText = totalQty;
    badge.style.display = totalQty > 0 ? "flex" : "none";
}

function getCartItem(productId) {
    return getCart().find(item => String(item.id) === String(productId));
}

function getCartItemQty(productId) {
    const item = getCartItem(productId);
    return item ? (item.qty || 1) : 0;
}

function addToCart(product) {
    if (!product || !product.id) return;

    const cart = getCart();
    const existing = cart.find(item => String(item.id) === String(product.id));

    if (existing) {
        existing.qty = (existing.qty || 1) + 1;
    } else {
        cart.push({
            id: product.id,
            title: product.title || product.name || "Item",
            name: product.name || product.title || "Item",
            price: product.price || 0,
            image: product.image || "",
            qty: 1
        });
    }

    saveCart(cart);
    showCartToast(product.title || product.name || "Item");
}

function increaseQty(productId) {
    const cart = getCart();
    const item = cart.find(i => String(i.id) === String(productId));

    if (!item) return;

    item.qty = (item.qty || 1) + 1;
    saveCart(cart);
}

function decreaseQty(productId) {
    let cart = getCart();
    const item = cart.find(i => String(i.id) === String(productId));

    if (!item) return;

    item.qty = (item.qty || 1) - 1;

    if (item.qty <= 0) {
        cart = cart.filter(i => String(i.id) !== String(productId));
    }

    saveCart(cart);
}

function removeFromCart(productId) {
    const cart = getCart().filter(i => String(i.id) !== String(productId));
    saveCart(cart);
}

function clearCart() {
    localStorage.removeItem(CART_KEY);
    updateCartBadge();
}

function showCartToast(title) {
    const existing = document.getElementById("gab-cart-toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.id = "gab-cart-toast";
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
            <a href="pages/cart.html" style="
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

    setTimeout(() => {
        const el = document.getElementById("gab-cart-toast");
        if (el) {
            el.style.transition = "opacity 0.4s ease";
            el.style.opacity = "0";
            setTimeout(() => el.remove(), 400);
        }
    }, 4000);
}

document.addEventListener("DOMContentLoaded", updateCartBadge);

"use strict";

/* ============================================================
   INDEX.JS — GAB Jewels Homepage
   ============================================================ */

// ── TODAY'S GOLD RATES (per gram) ────────────────────────────
const BASE_RATES = {
    "24K": 7350,
    "22K": 6738,
    "18K": 5513,
    silver: 92.5
};

let HOME_PRODUCTS = [];

// Calculate price from gold weight + purity + 15% making charge
function calcPrice(gold_weight, purity, price_base) {
    if (price_base && price_base > 0) return price_base;
    if (!gold_weight || !purity) return 0;

    const ratePerGram = BASE_RATES[purity] || BASE_RATES["22K"];
    const metalValue = gold_weight * ratePerGram;
    const making = metalValue * 0.15;
    const gst = (metalValue + making) * 0.03;

    return Math.round(metalValue + making + gst);
}

// ── LIVE GOLD RATES BAR ───────────────────────────────────────
async function loadRates() {
    let gold24 = BASE_RATES["24K"] * 10;
    let gold22 = BASE_RATES["22K"] * 10;
    let silver = BASE_RATES.silver * 1000;

    try {
        const r = await fetch("/api/rates", { signal: AbortSignal.timeout(3000) });
        if (r.ok) {
            const d = await r.json();
            if (d.gold24K) gold24 = d.gold24K;
            if (d.gold22K) gold22 = d.gold22K;
            if (d.silver) silver = d.silver;
        }
    } catch {}

    const el24 = document.getElementById("p-24k");
    const el22 = document.getElementById("p-22k");
    const elSil = document.getElementById("p-silver");
    const elUpd = document.getElementById("last-updated");

    if (el24) el24.textContent = "₹" + gold24.toLocaleString("en-IN");
    if (el22) el22.textContent = "₹" + gold22.toLocaleString("en-IN");
    if (elSil) elSil.textContent = "₹" + silver.toLocaleString("en-IN");

    if (elUpd) {
        const now = new Date();
        elUpd.textContent =
            "Updated " +
            now.toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit"
            }) +
            " IST";
    }

    setTimeout(loadRates, 5 * 60 * 1000);
}

// ── PRODUCT IMAGES ────────────────────────────────────────────
const FALLBACK_IMAGES = {
    Bracelets: "[images.pexels.com](https://images.pexels.com/photos/1454171/pexels-photo-1454171.jpeg?auto=compress&cs=tinysrgb&w=600&h=600&fit=crop)",
    Rings: "[images.pexels.com](https://images.pexels.com/photos/691046/pexels-photo-691046.jpeg?auto=compress&cs=tinysrgb&w=600&h=600&fit=crop)",
    Necklaces: "[images.pexels.com](https://images.pexels.com/photos/1458867/pexels-photo-1458867.jpeg?auto=compress&cs=tinysrgb&w=600&h=600&fit=crop)",
    Earrings: "[images.pexels.com](https://images.pexels.com/photos/1191531/pexels-photo-1191531.jpeg?auto=compress&cs=tinysrgb&w=600&h=600&fit=crop)",
    Pendants: "[images.pexels.com](https://images.pexels.com/photos/1464625/pexels-photo-1464625.jpeg?auto=compress&cs=tinysrgb&w=600&h=600&fit=crop)",
    default: "[images.pexels.com](https://images.pexels.com/photos/1413420/pexels-photo-1413420.jpeg?auto=compress&cs=tinysrgb&w=600&h=600&fit=crop)"
};

function getProductImage(p) {
    if (p.image_url) return p.image_url;
    return FALLBACK_IMAGES[p.category] || FALLBACK_IMAGES.default;
}

function escapeHtml(text) {
    return String(text || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function getCartQty(productId) {
    if (typeof getCartItemQty === "function") {
        return getCartItemQty(productId);
    }

    const cart = JSON.parse(localStorage.getItem("gab_cart") || "[]");
    const item = cart.find(i => String(i.id) === String(productId));
    return item ? (item.qty || 1) : 0;
}

function getActionMarkup(product) {
    const qty = getCartQty(product.id);

    if (qty > 0) {
        return `
            <div class="qty-control">
                <button type="button" class="qty-btn" onclick="decreaseItemQty(event, '${product.id}')">−</button>
                <span class="qty-count">${qty}</span>
                <button type="button" class="qty-btn" onclick="increaseItemQty(event, '${product.id}')">+</button>
            </div>
        `;
    }

    return `
        <button type="button" class="btn-quick-add" onclick="quickAdd(event, '${product.id}', '${escapeHtml(product.name)}', ${product.price}, '${escapeHtml(product.image || "")}')">
            <i class="fas fa-shopping-bag"></i> Add to Bag
        </button>
    `;
}

// ── FEATURED PRODUCTS ─────────────────────────────────────────
async function loadProducts() {
    const grid = document.getElementById("products-grid");
    if (!grid) return;

    try {
        const r = await fetch("/api/products");
        if (!r.ok) throw new Error("fetch failed");

        const products = await r.json();

        if (!products.length) {
            grid.innerHTML = `<div class="empty-state"><i class="fas fa-gem"></i><p>New collection arriving soon</p></div>`;
            return;
        }

        HOME_PRODUCTS = products.slice(0, 8).map(p => ({
            id: p.id,
            name: p.name,
            category: p.category || "",
            gold_weight: p.gold_weight,
            purity: p.purity || "",
            price: calcPrice(p.gold_weight, p.purity, p.price_base),
            image: getProductImage(p)
        }));

        renderProducts(HOME_PRODUCTS);
    } catch {
        HOME_PRODUCTS = [
            {
                id: "offline-1",
                name: "Classic Gold Bangle",
                category: "Bracelets",
                purity: "22K",
                gold_weight: 12.5,
                image: FALLBACK_IMAGES.Bracelets
            },
            {
                id: "offline-2",
                name: "Diamond Solitaire Ring",
                category: "Rings",
                purity: "18K",
                gold_weight: 4.2,
                image: FALLBACK_IMAGES.Rings
            },
            {
                id: "offline-3",
                name: "Temple Necklace Set",
                category: "Necklaces",
                purity: "22K",
                gold_weight: 22.8,
                image: FALLBACK_IMAGES.Necklaces
            },
            {
                id: "offline-4",
                name: "Twisted Hoop Earrings",
                category: "Earrings",
                purity: "22K",
                gold_weight: 3.1,
                image: FALLBACK_IMAGES.Earrings
            }
        ].map(p => ({
            ...p,
            price: calcPrice(p.gold_weight, p.purity, 0)
        }));

        renderProducts(HOME_PRODUCTS);
    }
}

function renderProducts(products) {
    const grid = document.getElementById("products-grid");
    if (!grid) return;

    grid.innerHTML = products.map(p => {
        const weight = p.gold_weight ? p.gold_weight + "g" : "";
        const purity = p.purity || "";
        const ratePerG = BASE_RATES[purity] || BASE_RATES["22K"];
        const rateStr = "₹" + ratePerG.toLocaleString("en-IN") + "/g";
        const priceStr = Number.isFinite(p.price) && p.price > 0
            ? "₹" + p.price.toLocaleString("en-IN")
            : "Price on request";

        return `
            <div class="product-card" onclick="goProduct('${p.id}')">
                <div class="product-image-wrapper">
                    <img
                        src="${p.image}"
                        alt="${escapeHtml(p.name)}"
                        loading="lazy"
                        onerror="this.src='${FALLBACK_IMAGES.default}'"
                    >
                    ${weight ? `<div class="product-weight-badge">${weight}</div>` : ""}
                    ${purity ? `<div class="product-purity-badge">${purity}</div>` : ""}
                </div>

                <div class="product-info">
                    <span class="product-category">${escapeHtml(p.category)}</span>
                    <h3 class="product-title">${escapeHtml(p.name)}</h3>

                    <div class="product-meta">
                        ${weight ? `<span class="product-gram"><i class="fas fa-balance-scale"></i> ${weight}</span>` : ""}
                        ${purity ? `<span class="product-karat">${purity}</span>` : ""}
                        <span class="product-rate-per-g">${rateStr}</span>
                    </div>

                    <p class="product-price">${priceStr}</p>

                    <div class="product-action-wrap" onclick="event.stopPropagation()">
                        ${getActionMarkup(p)}
                    </div>
                </div>
            </div>
        `;
    }).join("");
}

function rerenderHomeProducts() {
    if (!HOME_PRODUCTS.length) return;
    renderProducts(HOME_PRODUCTS);
}

function goProduct(id) {
    window.location.href = "pages/product-detail.html?id=" + id;
}

function quickAdd(e, id, name, price, image = "") {
    e.stopPropagation();

    if (localStorage.getItem("isLoggedIn") !== "true") {
        sessionStorage.setItem("login_redirect", "index.html");
        window.location.replace("login.html");
        return;
    }

    if (typeof addToCart === "function") {
        addToCart({
            id,
            title: name,
            name,
            price,
            image,
            qty: 1
        });
    } else {
        const cart = JSON.parse(localStorage.getItem("gab_cart") || "[]");
        const existing = cart.find(item => String(item.id) === String(id));

        if (existing) {
            existing.qty = (existing.qty || 1) + 1;
        } else {
            cart.push({ id, title: name, name, price, image, qty: 1 });
        }

        localStorage.setItem("gab_cart", JSON.stringify(cart));
        if (typeof updateCartBadge === "function") updateCartBadge();
    }

    rerenderHomeProducts();
}

function increaseItemQty(e, productId) {
    e.stopPropagation();

    if (typeof increaseQty === "function") {
        increaseQty(productId);
    } else {
        const cart = JSON.parse(localStorage.getItem("gab_cart") || "[]");
        const item = cart.find(i => String(i.id) === String(productId));
        if (item) {
            item.qty = (item.qty || 1) + 1;
            localStorage.setItem("gab_cart", JSON.stringify(cart));
            if (typeof updateCartBadge === "function") updateCartBadge();
        }
    }

    rerenderHomeProducts();
}

function decreaseItemQty(e, productId) {
    e.stopPropagation();

    if (typeof decreaseQty === "function") {
        decreaseQty(productId);
    } else {
        let cart = JSON.parse(localStorage.getItem("gab_cart") || "[]");
        const item = cart.find(i => String(i.id) === String(productId));

        if (item) {
            item.qty = (item.qty || 1) - 1;

            if (item.qty <= 0) {
                cart = cart.filter(i => String(i.id) !== String(productId));
            }

            localStorage.setItem("gab_cart", JSON.stringify(cart));
            if (typeof updateCartBadge === "function") updateCartBadge();
        }
    }

    rerenderHomeProducts();
}

// ── SCROLL REVEAL ─────────────────────────────────────────────
function initReveal() {
    const obs = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) entry.target.classList.add("visible");
        });
    }, { threshold: 0.05 });

    document.querySelectorAll(".reveal").forEach(el => obs.observe(el));
}

// ── INIT ──────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
    loadRates();
    loadProducts();
    initReveal();

    if (typeof renderNavProfile === "function") {
        renderNavProfile();
    }
});

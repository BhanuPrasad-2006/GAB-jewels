/* ============================================================
   GAB JEWELS — index.js
   Home page: live gold rates + featured products
   Depends on cart.js being loaded FIRST (for addToCart, updateCartBadge)
   ============================================================ */

/* ── GOLD RATES ─────────────────────────────────────────── */
async function fetchLiveRates() {
    const headers = new Headers({
        'x-access-token': 'goldapi-agsbx8smmz307y8-io',
        'Content-Type': 'application/json'
    });
    const opts = { method: 'GET', headers, redirect: 'follow' };

    try {
        const [goldRes, silverRes] = await Promise.all([
            fetch('https://www.goldapi.io/api/XAU/INR', opts),
            fetch('https://www.goldapi.io/api/XAG/INR', opts)
        ]);
        const goldData   = await goldRes.json();
        const silverData = await silverRes.json();

        const gold24k = Math.round(goldData.price_gram_24k * 10);
        const gold22k = Math.round(goldData.price_gram_22k * 10);
        const silver  = silverData.price_gram_24k;

        setEl('p-24k',      '₹' + gold24k.toLocaleString('en-IN'));
        setEl('p-22k',      '₹' + gold22k.toLocaleString('en-IN'));
        setEl('p-silver',   '₹' + silver.toFixed(2));
        setEl('last-updated', 'Updated: ' + new Date().toLocaleTimeString('en-IN', {
            hour: '2-digit', minute: '2-digit'
        }) + ' IST');

    } catch {
        console.warn('Gold API unavailable — using simulated rates.');
        useFallbackRates();
    }
}

function useFallbackRates() {
    const base = 73200 + Math.round((Math.random() - 0.5) * 600);
    setEl('p-24k',      '₹' + base.toLocaleString('en-IN'));
    setEl('p-22k',      '₹' + Math.round(base * 22/24).toLocaleString('en-IN'));
    setEl('p-silver',   '₹' + (92.50 + (Math.random() - 0.5)).toFixed(2));
    setEl('last-updated', 'Simulated · ' + new Date().toLocaleTimeString('en-IN', {
        hour: '2-digit', minute: '2-digit'
    }));
}

/* ── PRODUCTS ───────────────────────────────────────────── */
async function renderProducts() {
    const grid = document.getElementById('products-grid');
    if (!grid) return;

    grid.innerHTML = Array(4).fill('<div class="loading-shimmer"></div>').join('');

    let products = [];
    try {
        const res = await fetch('/api/products');
        if (res.ok) products = (await res.json()).slice(0, 4);
    } catch { /* server offline */ }

    if (!products.length) {
        products = [
            { id:1, name:'Classic Gold Bangle',    price_base:28000,  purity:'22K', image_url:'', category:'Bangles'   },
            { id:2, name:'Diamond Solitaire Ring', price_base:85000,  purity:'18K', image_url:'', category:'Rings'     },
            { id:3, name:'Pearl Drop Earrings',    price_base:14500,  purity:'22K', image_url:'', category:'Earrings'  },
            { id:4, name:'Heritage Necklace Set',  price_base:125000, purity:'22K', image_url:'', category:'Necklaces' },
        ];
    }

    grid.innerHTML = products.map(p => {
        const price = new Intl.NumberFormat('en-IN', {
            style: 'currency', currency: 'INR', maximumFractionDigits: 0
        }).format(p.price_base);

        const img = p.image_url
            ? `<img src="${p.image_url}" alt="${p.name}" loading="lazy">`
            : `<div class="no-img"><i class="fas fa-gem"></i></div>`;

        // Build cart item in same shape as products.js / product-detail.js
        const cartItem = JSON.stringify({
            id:     p.id,
            title:  p.name,
            purity: p.purity + ' · ' + p.category,
            price:  p.price_base,
            img:    p.image_url || ''
        }).replace(/"/g, '&quot;');

        return `
            <article class="product-card">
                <div class="product-image-wrapper">
                    <a href="pages/product-detail.html?id=${p.id}" style="display:block;height:100%">${img}</a>
                    <button class="btn-quick-add" onclick="addToCart(JSON.parse(this.dataset.item))"
                        data-item="${cartItem}">Add to Bag</button>
                </div>
                <div class="product-info">
                    <span class="product-purity">${p.purity} · ${p.category}</span>
                    <h3 class="product-title">${p.name}</h3>
                    <div class="product-price">${price}</div>
                </div>
            </article>
        `;
    }).join('');
}

/* ── CART SIDEBAR (index.html specific) ─────────────────── */
function renderIndexCartSidebar() {
    const body = document.getElementById('cart-body');
    if (!body) return;

    // Always read fresh from storage
    const items = JSON.parse(localStorage.getItem('gab_cart')) || [];

    if (!items.length) {
        body.innerHTML = `<p style="font-family:'Cormorant Garamond',serif;font-style:italic;color:rgba(250,246,238,.4)">Your bag is empty.</p>`;
        return;
    }

    let total = 0;
    const fmt = n => new Intl.NumberFormat('en-IN', {
        style: 'currency', currency: 'INR', maximumFractionDigits: 0
    }).format(n);

    const itemsHtml = items.map((item, i) => {
        total += item.price;
        return `
            <div style="display:flex;align-items:center;justify-content:space-between;
                        padding:0.9rem 0;border-bottom:1px solid rgba(201,168,76,.1)">
                <div>
                    <div style="font-family:'Cormorant Garamond',serif;font-size:1rem;
                                color:#FAF6EE;margin-bottom:3px">${item.title}</div>
                    <div style="font-family:'Cinzel',serif;font-size:0.8rem;color:#C9A84C">${fmt(item.price)}</div>
                </div>
                <button onclick="removeCartItem(${i}); renderIndexCartSidebar();"
                    style="background:none;border:none;color:rgba(250,246,238,.3);
                           cursor:pointer;font-size:0.85rem;padding:4px;transition:color .2s"
                    onmouseover="this.style.color='#E07070'"
                    onmouseout="this.style.color='rgba(250,246,238,.3)'">✕</button>
            </div>
        `;
    }).join('');

    body.innerHTML = itemsHtml + `
        <div style="display:flex;justify-content:space-between;align-items:center;
                    padding:1.1rem 0 0;margin-top:0.5rem">
            <span style="font-family:'Raleway',sans-serif;font-size:0.6rem;
                         letter-spacing:.2em;text-transform:uppercase;color:rgba(250,246,238,.4)">Total</span>
            <span style="font-family:'Cinzel',serif;font-size:1.1rem;color:#E8C97A">${fmt(total)}</span>
        </div>
    `;
}

/* ── HELPERS ─────────────────────────────────────────────── */
function setEl(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

/* ── INIT ────────────────────────────────────────────────── */
fetchLiveRates();
renderProducts();
renderIndexCartSidebar();

// Refresh rates every 15 min
setInterval(fetchLiveRates, 15 * 60 * 1000);

// Keep sidebar in sync when storage changes (other tabs / pages)
window.addEventListener('storage', renderIndexCartSidebar);
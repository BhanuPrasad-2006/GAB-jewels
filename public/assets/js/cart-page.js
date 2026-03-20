document.addEventListener('DOMContentLoaded', () => {
    renderCartPage();
});

function renderCartPage() {
    // 1. Sync local 'cart' variable with storage
    cart = JSON.parse(localStorage.getItem('gab_cart')) || [];

    const container = document.getElementById('cart-items-container');
    const subtotalEl = document.getElementById('summary-subtotal');
    const totalEl = document.getElementById('summary-total');
    const emptyMsg = document.getElementById('empty-cart-message');
    const summaryCard = document.getElementById('order-summary-card');
    const headerRow = document.getElementById('cart-header-row');
    const footerControls = document.getElementById('cart-footer-controls');

    container.innerHTML = '';
    let totalAmount = 0;

    // 2. Handle Empty State
    if (!cart || cart.length === 0) {
        emptyMsg.style.display = 'flex';
        summaryCard.style.display = 'none';
        headerRow.style.display = 'none';
        footerControls.style.display = 'none';
        return;
    }

    // 3. Show UI Elements
    emptyMsg.style.display = 'none';
    summaryCard.style.display = 'block';
    headerRow.style.display = 'grid';
    footerControls.style.display = 'flex';

    // 4. Render Items with precise Grid Classes from cart.css
    cart.forEach((item, index) => {
        totalAmount += item.price;

        const formattedPrice = new Intl.NumberFormat('en-IN', {
            style: 'currency', currency: 'INR', maximumFractionDigits: 0
        }).format(item.price);

        const itemDiv = document.createElement('div');
        itemDiv.className = 'cart-item'; // Matches .cart-item grid in CSS
        
        itemDiv.innerHTML = `
            <div class="cart-item-product">
                <img src="${item.img}" alt="${item.title}" class="cart-item-image">
                <div class="cart-item-details">
                    <span class="cart-item-purity">${item.purity}</span>
                    <h3 class="cart-item-name">${item.title}</h3>
                </div>
            </div>
            <div class="cart-item-price" style="justify-content: center;">${formattedPrice}</div>
            <div class="cart-item-qty-col" style="justify-content: center;">
                <div class="qty-stepper">
                    <span class="qty-input">1</span>
                </div>
            </div>
            <div class="cart-item-subtotal" style="justify-content: center;">${formattedPrice}</div>
            <div class="cart-item-remove">
                <button class="btn-remove" onclick="removeFromCart(${index})">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        container.appendChild(itemDiv);
    });

    // 5. Update Totals
    const finalTotal = new Intl.NumberFormat('en-IN', {
        style: 'currency', currency: 'INR', maximumFractionDigits: 0
    }).format(totalAmount);

    subtotalEl.innerText = finalTotal;
    totalEl.innerText = finalTotal;
}

// Global functions for buttons
window.removeFromCart = function(index) {
    cart.splice(index, 1);
    localStorage.setItem('gab_cart', JSON.stringify(cart));
    if (typeof updateCartBadge === 'function') updateCartBadge();
    renderCartPage();
};

window.clearFullCart = function() {
    if (confirm("Clear your entire shopping bag?")) {
        localStorage.removeItem('gab_cart');
        cart = [];
        if (typeof updateCartBadge === 'function') updateCartBadge();
        renderCartPage();
    }
};
document.addEventListener('DOMContentLoaded', () => {
    // Render the cart as soon as the page loads
    renderCartPage();
});

function renderCartPage() {
    const container = document.getElementById('cart-items-container');
    const summarySubtotal = document.getElementById('summary-subtotal');
    const summaryTotal = document.getElementById('summary-total');
    const emptyState = document.getElementById('empty-cart-message');
    const summaryCard = document.getElementById('order-summary-card');

    // Clear out the container before drawing
    container.innerHTML = '';
    let totalAmount = 0;

    // 1. Check if the cart is empty
    // Note: The 'cart' variable comes from cart.js, which must be linked before this file!
    if (!cart || cart.length === 0) {
        emptyState.style.display = 'block';
        summaryCard.style.display = 'none';
        return;
    }

    // 2. Hide empty state, show the summary card
    emptyState.style.display = 'none';
    summaryCard.style.display = 'block';

    // 3. Loop through the cart array and build the HTML for each item
    cart.forEach((item, index) => {
        totalAmount += item.price; // Add to running total

        // Format price to Indian Rupees (e.g., ₹ 1,25,000)
        const formattedPrice = new Intl.NumberFormat('en-IN', {
            style: 'currency', currency: 'INR', maximumFractionDigits: 0
        }).format(item.price);

        const itemDiv = document.createElement('div');
        itemDiv.className = 'cart-item';
        
        itemDiv.innerHTML = `
            <img src="${item.img}" alt="${item.title}" class="cart-item-img">
            <div class="cart-item-details">
                <span class="cart-item-purity">${item.purity}</span>
                <h3 class="cart-item-title">${item.title}</h3>
                <button class="btn-remove" onclick="removeFromCart(${index})">
                    <i class="fas fa-trash"></i> Remove
                </button>
            </div>
            <div class="cart-item-price">${formattedPrice}</div>
        `;
        container.appendChild(itemDiv);
    });

    // 4. Update the totals on the right side summary box
    const formattedTotal = new Intl.NumberFormat('en-IN', {
        style: 'currency', currency: 'INR', maximumFractionDigits: 0
    }).format(totalAmount);

    summarySubtotal.innerText = formattedTotal;
    summaryTotal.innerText = formattedTotal;
}

// Function to remove an item from the cart
window.removeFromCart = function(index) {
    // 1. Remove 1 item at the specific index from the array
    cart.splice(index, 1); 
    
    // 2. Save the updated array back to the browser's LocalStorage
    localStorage.setItem('gab_cart', JSON.stringify(cart)); 
    
    // 3. Update the red badge number in the navbar (this function is in cart.js)
    if (typeof updateCartBadge === 'function') {
        updateCartBadge(); 
    }
    
    // 4. Re-draw the page so the removed item instantly disappears from the screen
    renderCartPage(); 
};
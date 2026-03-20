// 1. Load the cart (this only happens once per page load)
let cart = JSON.parse(localStorage.getItem('gab_cart')) || [];

// 2. Modified Badge Function: Always check the LATEST memory
function updateCartBadge() {
    // We re-read localStorage here to ensure the number is ALWAYS accurate
    const latestCart = JSON.parse(localStorage.getItem('gab_cart')) || [];
    const badge = document.getElementById('cart-badge');
    
    if (badge) {
        badge.innerText = latestCart.length;
        badge.style.display = latestCart.length > 0 ? 'flex' : 'none'; 
    }
}

// 3. Function to add an item
function addToCart(product) {
    cart.push(product);
    localStorage.setItem('gab_cart', JSON.stringify(cart)); // Save to memory
    updateCartBadge();
    
    // A luxury notification instead of a basic alert
    alert(`✨ ${product.title} has been added to your shopping bag.`);
}

// Run this as soon as any page loads
document.addEventListener('DOMContentLoaded', updateCartBadge);
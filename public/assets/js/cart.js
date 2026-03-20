// assets/js/cart.js

// 1. Load the cart from the browser's memory (or create an empty one)
let cart = JSON.parse(localStorage.getItem('gab_cart')) || [];

// 2. Function to update the little red number on the shopping bag icon
function updateCartBadge() {
    const badge = document.getElementById('cart-badge');
    if (badge) {
        badge.innerText = cart.length;
        // Hide badge if cart is empty
        badge.style.display = cart.length > 0 ? 'flex' : 'none'; 
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
document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Get the Product ID from the URL
    const urlParams = new URLSearchParams(window.location.search);
    const productId = parseInt(urlParams.get('id'));

    // 2. The Database (Same as your products.js file)
    const mockDatabase = [
        { id: 1, title: "Royal Kundan Choker", purity: "22k Gold", price: 345000, img: "https://images.unsplash.com/photo-1599643478524-fb66f70362f6?auto=format&fit=crop&w=600&q=80" },
        { id: 2, title: "Diamond Tennis Necklace", purity: "18k White Gold", price: 850000, img: "https://images.unsplash.com/photo-1515562141207-7a8efd3e35a1?auto=format&fit=crop&w=600&q=80" },
        { id: 3, title: "Sapphire Halo Ring", purity: "18k White Gold", price: 125000, img: "https://images.unsplash.com/photo-1605100804763-247f67b2548e?auto=format&fit=crop&w=600&q=80" },
        // ... (Include your other products here)
    ];

    // 3. Find the exact product
    const product = mockDatabase.find(p => p.id === productId);

    if (!product) {
        document.querySelector('.product-detail-container').innerHTML = "<h2>Product not found.</h2>";
        return;
    }

    // 4. Inject data into the HTML
    document.getElementById('main-image').src = product.img;
    document.getElementById('thumb-1').src = product.img;
    document.getElementById('thumb-2').src = product.img; // Placeholder for a 2nd angle

    document.getElementById('detail-title').innerText = product.title;
    document.getElementById('detail-purity').innerText = product.purity;
    
    // Format Price
    document.getElementById('detail-price').innerText = new Intl.NumberFormat('en-IN', {
        style: 'currency', currency: 'INR', maximumFractionDigits: 0
    }).format(product.price);

    // 5. Wire up the "Add to Cart" Button
    document.getElementById('btn-add-to-cart').addEventListener('click', () => {
        // This function comes from cart.js!
        addToCart(product); 
    });
});
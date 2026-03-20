document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Get the Product ID from the URL (e.g., ?id=5)
    const urlParams = new URLSearchParams(window.location.search);
    const productId = parseInt(urlParams.get('id'));

    // 2. The FULL Database (All 9 items)
    const mockDatabase = [
        // WOMEN
        { id: 1, dept: 'women', cat: 'necklaces', title: "Royal Kundan Choker", purity: "22k Gold", price: 345000, img: "https://images.unsplash.com/photo-1599643478524-fb66f70362f6?auto=format&fit=crop&w=600&q=80" },
        { id: 2, dept: 'women', cat: 'necklaces', title: "Diamond Tennis Necklace", purity: "18k White Gold", price: 850000, img: "https://images.unsplash.com/photo-1515562141207-7a8efd3e35a1?auto=format&fit=crop&w=600&q=80" },
        { id: 3, dept: 'women', cat: 'rings', title: "Sapphire Halo Ring", purity: "18k White Gold", price: 125000, img: "https://images.unsplash.com/photo-1605100804763-247f67b2548e?auto=format&fit=crop&w=600&q=80" },
        { id: 4, dept: 'women', cat: 'earrings', title: "Polki Drop Jhumkas", purity: "22k Gold", price: 95000, img: "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=600&q=80" },
        
        // MEN
        { id: 5, dept: 'men', cat: 'chains', title: "Thick Cuban Link Chain", purity: "22k Yellow Gold", price: 450000, img: "https://images.unsplash.com/photo-1599643477877-530eb83abc8e?auto=format&fit=crop&w=600&q=80" },
        { id: 6, dept: 'men', cat: 'rings', title: "Black Onyx Signet", purity: "18k Gold", price: 85000, img: "https://images.unsplash.com/photo-1626497764746-6dc36546b388?auto=format&fit=crop&w=600&q=80" },
        { id: 7, dept: 'men', cat: 'bracelets', title: "Solid Gold Kada", purity: "22k Gold", price: 210000, img: "https://images.unsplash.com/photo-1523170335258-f5ed11844a49?auto=format&fit=crop&w=600&q=80" },

        // KIDS
        { id: 8, dept: 'kids', cat: 'infant', title: "Gold & Onyx Nazariya", purity: "18k Gold", price: 15000, img: "https://images.unsplash.com/photo-1602752250019-3507e155b9e0?auto=format&fit=crop&w=600&q=80" },
        { id: 9, dept: 'kids', cat: 'pendants', title: "Enamel Elephant Pendant", purity: "18k Gold", price: 12500, img: "https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?auto=format&fit=crop&w=600&q=80" }
    ];

    // 3. Find the exact product
    const product = mockDatabase.find(p => p.id === productId);

    // If no product is found, show an error message and STOP running
    if (!product) {
        document.querySelector('.product-detail-container').innerHTML = "<h2>Product not found.</h2><p>Please return to the gallery.</p>";
        return; 
    }

    // 4. Inject data into the HTML (This updates the Price and Title!)
    document.getElementById('main-image').src = product.img;
    document.getElementById('thumb-1').src = product.img;
    document.getElementById('thumb-2').src = product.img; 

    document.getElementById('detail-title').innerText = product.title;
    document.getElementById('detail-purity').innerText = product.purity;
    
    // Format Price nicely
    document.getElementById('detail-price').innerText = new Intl.NumberFormat('en-IN', {
        style: 'currency', currency: 'INR', maximumFractionDigits: 0
    }).format(product.price);

    // 5. Wire up the "Add to Cart" Button safely
    const addToCartBtn = document.getElementById('btn-add-to-cart');
    
    if (addToCartBtn) {
        addToCartBtn.addEventListener('click', () => {
            // Check if cart.js is linked properly
            if (typeof addToCart === 'function') {
                addToCart(product); 
            } else {
                console.error("cart.js is missing or not loading!");
                alert("Error: Shopping bag system is currently offline.");
            }
        });
    }
});
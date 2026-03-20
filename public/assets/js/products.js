document.addEventListener('DOMContentLoaded', () => {

    // 1. Read the URL parameters (What did the user click?)
    const urlParams = new URLSearchParams(window.location.search);
    const department = urlParams.get('dept'); // 'men', 'women', or 'kids'
    const category = urlParams.get('cat');    // 'rings', 'necklaces', etc.

    // 2. Update the Page Header dynamically
    const pageTitle = document.getElementById('page-title');
    if (department && category) {
        const deptCapitalized = department.charAt(0).toUpperCase() + department.slice(1);
        const catCapitalized = category.charAt(0).toUpperCase() + category.slice(1);
        pageTitle.innerText = `${deptCapitalized}'s ${catCapitalized}`;
    } else {
        pageTitle.innerText = "Complete Collection";
    }

    // 3. The Mock Database 
    // Attached to "window" so our quickAddToCart function can find it outside this block
    window.mockDatabase = [
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

    // 4. Filter the Database
    let filteredItems = window.mockDatabase;
    if (department) {
        filteredItems = filteredItems.filter(item => item.dept === department);
    }
    if (category) {
        filteredItems = filteredItems.filter(item => item.cat === category);
    }

    // 5. Render the HTML
    const grid = document.getElementById('products-grid');
    grid.innerHTML = ''; // Clear loading state

    if (filteredItems.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <h2>No pieces found</h2>
                <p>We are currently updating our collection for this category.</p>
            </div>
        `;
        return;
    }

    filteredItems.forEach(product => {
        // Format the price beautifully (e.g., 345000 -> ₹ 3,45,000)
        const formattedPrice = new Intl.NumberFormat('en-IN', {
            style: 'currency', currency: 'INR', maximumFractionDigits: 0
        }).format(product.price);

        const card = document.createElement('article');
        card.className = 'product-card';
        
        // UPDATE: The image is now wrapped in an <a> tag pointing to the detail page!
        card.innerHTML = `
            <div class="product-image-wrapper">
                <a href="product-detail.html?id=${product.id}">
                    <img src="${product.img}" alt="${product.title}">
                </a>
                <button class="btn-quick-add" onclick="quickAddToCart(${product.id})">Add to Bag</button>
            </div>
            <div class="product-info">
                <span class="product-purity">${product.purity}</span>
                <h3 class="product-title">${product.title}</h3>
                <div class="product-price">${formattedPrice}</div>
            </div>
        `;
        grid.appendChild(card);
    });
});

// --- NEW HELPER FUNCTION ---
// This grabs the product and sends it to your global cart.js file
function quickAddToCart(productId) {
    // 1. Find the product in the database using the ID
    const product = window.mockDatabase.find(p => p.id === productId);
    
    // 2. Send it to the global cart (if cart.js is linked)
    if (typeof addToCart === 'function') {
        addToCart(product); 
    } else {
        // Fallback just in case you haven't linked cart.js to products.html yet
        alert(`✨ ${product.title} added to your secure luxury vault.`);
    }
}
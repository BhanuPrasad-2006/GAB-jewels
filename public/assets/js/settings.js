document.addEventListener('DOMContentLoaded', () => {
    
    // --- 1. UI LOGIC: Tab Switching ---
    // ✅ FIXED: Added ':not(.logout-tab)' so the code ignores the logout button here
    const tabs = document.querySelectorAll('.nav-tabs li:not(.logout-tab)');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active class from all
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));
            
            // Add active class to clicked
            tab.classList.add('active');
            document.getElementById(tab.dataset.tab).classList.add('active');
        });
    });

    // --- 2. API LOGIC: Fetch Data on Load ---
    async function loadSettings() {
        try {
            const response = await fetch('http://localhost:3000/api/settings');
            const data = await response.json();

            // Populate Profile
            document.getElementById('user-name').value = data.name;
            document.getElementById('user-email').value = data.email;
            document.getElementById('user-phone').value = data.phone;

            // Populate Security
            document.getElementById('2fa-toggle').checked = data.twoFactor;

            // Populate Preferences
            document.getElementById('currency').value = data.currency;
            document.getElementById('price-alert').checked = data.priceAlerts;

        } catch (error) {
            console.error("Could not load settings:", error);
        }
    }
    
    // Call it immediately
    loadSettings();

    // --- 3. API LOGIC: Save Profile ---
    document.getElementById('profile-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const updateData = {
            name: document.getElementById('user-name').value,
            email: document.getElementById('user-email').value,
            phone: document.getElementById('user-phone').value
        };

        const response = await fetch('http://localhost:3000/api/settings/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData)
        });
        
        const result = await response.json();
        alert("✨ " + result.message);
    });

    // --- 4. API LOGIC: Instant Toggles ---
    document.getElementById('2fa-toggle').addEventListener('change', async (e) => {
        await fetch('http://localhost:3000/api/settings/security', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ twoFactor: e.target.checked })
        });
    });

    // --- 5. LOGOUT LOGIC (NEW) ---
    const logoutTab = document.querySelector('.logout-tab');
    if (logoutTab) {
        logoutTab.addEventListener('click', () => {
            // Clear the memory
            localStorage.removeItem("isLoggedIn");
            // Send back to the index page
            window.location.href = "../index.html";
        });
    }

});
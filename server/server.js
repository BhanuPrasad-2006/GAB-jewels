const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// Mock Database (Simulating a real database)
let userDB = {
    name: "Yatish",
    email: "Yatishb1980@gmail.com",
    phone: "+91 98765 43210",
    twoFactor: false,
    currency: "INR",
    priceAlerts: true,
    kycVerified: false
};

// 1. GET ROUTE: Send data to the frontend on load
app.get('/api/settings', (req, res) => {
    console.log("[API] Settings requested by client.");
    res.json(userDB);
});

// 2. POST ROUTE: Update Profile
app.post('/api/settings/profile', (req, res) => {
    const { name, email, phone } = req.body;

    // CYBERSECURITY: Strict Input Validation
    if (!email || !email.includes('@')) {
        return res.status(400).json({ message: "Invalid email format detected." });
    }

    // Save to "Database"
    userDB.name = name;
    userDB.email = email;
    userDB.phone = phone;

    console.log("[DB] Profile Updated:", userDB);
    res.status(200).json({ message: "Profile successfully updated." });
});

// 3. POST ROUTE: Update Security (2FA)
app.post('/api/settings/security', (req, res) => {
    const { twoFactor } = req.body;
    userDB.twoFactor = twoFactor;
    
    console.log(`[AUTH] 2FA Status changed to: ${twoFactor ? 'ENABLED' : 'DISABLED'}`);
    res.status(200).json({ message: "Security settings saved." });
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`\n💎 GAB Jewels Server running securely on http://localhost:${PORT}`);
    console.log(`🛡️  Ready to accept API requests...\n`);
});
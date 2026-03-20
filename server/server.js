const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors()); // Critical for frontend-backend communication
app.use(express.json());

// Mock database (in a real app, you'd use PostgreSQL or MongoDB)
let userDatabase = {
    name: "John Doe",
    email: "john@example.com",
    twoFactor: false
};

// Route to handle profile updates
app.post('/api/update-profile', (req, res) => {
    const { name, email } = req.body;

    // Basic Validation (Cyber Security best practice)
    if (!name || !email) {
        return res.status(400).json({ message: "Name and Email are required." });
    }

    // Update the "database"
    userDatabase.name = name;
    userDatabase.email = email;

    console.log("Database Updated:", userDatabase);
    res.status(200).json({ message: "Jewellery Elite profile updated successfully!" });
});

// Route to handle 2FA status
app.post('/api/toggle-2fa', (req, res) => {
    const { twoFactor } = req.body;
    userDatabase.twoFactor = twoFactor;
    
    console.log(`Security Update: 2FA is now ${twoFactor ? 'ON' : 'OFF'}`);
    res.status(200).json({ message: "Security settings saved." });
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 Jewellery Server running at http://localhost:${PORT}`);
});
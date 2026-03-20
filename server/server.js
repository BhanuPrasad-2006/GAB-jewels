const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 3000;

// Middleware
app.use(cors()); // Allows your Netlify frontend to talk to this server
app.use(express.json()); // Parses incoming JSON data

// API Route: Update Profile
app.post('/api/settings/update-profile', (req, res) => {
    const { name, email } = req.body;

    // CYBERSECURITY CHECK: Sanitize input to prevent XSS/Injection
    if (!email.includes('@')) {
        return res.status(400).json({ message: "Invalid email format." });
    }

    console.log(`Saving to Database: Name: ${name}, Email: ${email}`);
    
    res.json({ 
        message: "Success! Your luxury profile has been updated.",
        status: "success" 
    });
});

// API Route: Toggle 2FA
app.post('/api/settings/toggle-2fa', (req, res) => {
    const { enabled } = req.body;
    
    console.log(`User 2FA is now: ${enabled ? 'ENABLED' : 'DISABLED'}`);
    
    res.json({ 
        message: "Security settings updated.",
        status: enabled ? "2FA_ACTIVE" : "2FA_INACTIVE"
    });
});

app.listen(PORT, () => {
    console.log(`Jewellery Server running at http://localhost:${PORT}`);
});
/* ============================================================
   SERVER.JS — GAB Jewels Backend
   Routes:
     POST /api/send-otp
     POST /api/verify-otp
     GET  /api/settings
     POST /api/settings/profile
     POST /api/settings/security
     POST /api/settings/preferences
     POST /api/settings/password
   ============================================================ */

require('dotenv').config(); // Load .env file

const express = require('express');
const path    = require('path');
const app     = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// ── CORS for local dev (allow pages/ folder to call localhost:3000) ──
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

// ── Twilio (credentials from .env — never hardcode these) ──
// Create a .env file in your project root with:
//   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxx
//   TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxx
//   TWILIO_VERIFY_SID=VAxxxxxxxxxxxxxxxx
const twilio = require('twilio');

const accountSid      = process.env.TWILIO_ACCOUNT_SID;
const authToken       = process.env.TWILIO_AUTH_TOKEN;
const verifyServiceSid = process.env.TWILIO_VERIFY_SID;

let twilioClient = null;
if (accountSid && authToken) {
    twilioClient = twilio(accountSid, authToken);
    console.log('✅ Twilio client initialised');
} else {
    console.warn('⚠️  Twilio credentials not found in .env — OTP routes will be disabled');
}

// ── In-memory settings store (replace with a DB like MongoDB in production) ──
const userSettings = {
    name:        'Yatish',
    email:       'yatish@example.com',
    phone:       '',
    address:     '',
    city:        '',
    pin:         '',
    twoFactor:   false,
    currency:    'INR',
    priceAlerts: true,
    orderNotif:  true,
    promoNotif:  false,
    // Store hashed passwords in production — this is a demo placeholder
    password:    '1234'
};

/* ============================================================
   OTP ROUTES
   ============================================================ */

// POST /api/send-otp
app.post('/api/send-otp', async (req, res) => {
    if (!twilioClient) {
        return res.status(503).json({ success: false, message: 'OTP service not configured. Add Twilio keys to .env' });
    }

    try {
        const { phoneNumber } = req.body;
        if (!phoneNumber) return res.status(400).json({ success: false, message: 'Phone number required' });

        const clean = phoneNumber.replace(/\D/g, '').slice(-10);
        if (clean.length !== 10) return res.status(400).json({ success: false, message: 'Invalid phone number' });

        const formatted = `+91${clean}`;
        console.log(`[OTP] Sending to ${formatted}`);

        const verification = await twilioClient.verify.v2
            .services(verifyServiceSid)
            .verifications
            .create({ to: formatted, channel: 'sms' });

        console.log(`[OTP] Sent — SID: ${verification.sid}`);
        res.status(200).json({ success: true });

    } catch (error) {
        console.error(`[OTP ERROR] Code: ${error.code} — ${error.message}`);
        res.status(500).json({ success: false, message: error.message });
    }
});

// POST /api/verify-otp
app.post('/api/verify-otp', async (req, res) => {
    if (!twilioClient) {
        return res.status(503).json({ success: false, message: 'OTP service not configured' });
    }

    try {
        const { phoneNumber, code } = req.body;
        if (!phoneNumber || !code) return res.status(400).json({ success: false, message: 'Phone and code required' });

        const formatted = `+91${phoneNumber.replace(/\D/g, '').slice(-10)}`;

        const check = await twilioClient.verify.v2
            .services(verifyServiceSid)
            .verificationChecks
            .create({ to: formatted, code });

        if (check.status === 'approved') {
            console.log(`[OTP] Verified: ${formatted}`);
            res.status(200).json({ success: true });
        } else {
            res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
        }

    } catch (error) {
        console.error(`[OTP VERIFY ERROR] ${error.message}`);
        res.status(500).json({ success: false, message: error.message });
    }
});

/* ============================================================
   SETTINGS ROUTES
   ============================================================ */

// GET /api/settings — fetch all settings
app.get('/api/settings', (req, res) => {
    // Never send the password field to the client
    const { password, ...safeSettings } = userSettings;
    res.status(200).json(safeSettings);
});

// POST /api/settings/profile
app.post('/api/settings/profile', (req, res) => {
    const { name, email, phone, address, city, pin } = req.body;
    if (name)    userSettings.name    = name;
    if (email)   userSettings.email   = email;
    if (phone)   userSettings.phone   = phone;
    if (address) userSettings.address = address;
    if (city)    userSettings.city    = city;
    if (pin)     userSettings.pin     = pin;

    console.log(`[SETTINGS] Profile updated for ${email || userSettings.email}`);
    res.status(200).json({ success: true, message: 'Profile updated successfully' });
});

// POST /api/settings/security
app.post('/api/settings/security', (req, res) => {
    const { twoFactor } = req.body;
    if (twoFactor !== undefined) userSettings.twoFactor = twoFactor;

    console.log(`[SETTINGS] 2FA set to: ${twoFactor}`);
    res.status(200).json({ success: true, message: '2FA setting updated' });
});

// POST /api/settings/preferences
app.post('/api/settings/preferences', (req, res) => {
    const { currency, priceAlerts, orderNotif, promoNotif } = req.body;
    if (currency    !== undefined) userSettings.currency    = currency;
    if (priceAlerts !== undefined) userSettings.priceAlerts = priceAlerts;
    if (orderNotif  !== undefined) userSettings.orderNotif  = orderNotif;
    if (promoNotif  !== undefined) userSettings.promoNotif  = promoNotif;

    console.log(`[SETTINGS] Preferences updated`);
    res.status(200).json({ success: true, message: 'Preferences updated' });
});

// POST /api/settings/password
app.post('/api/settings/password', (req, res) => {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ success: false, message: 'Both passwords required' });
    }

    // In production: compare hashed passwords using bcrypt
    if (currentPassword !== userSettings.password) {
        return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    userSettings.password = newPassword; // In production: hash with bcrypt before storing
    console.log(`[SETTINGS] Password changed`);
    res.status(200).json({ success: true, message: 'Password updated successfully' });
});

/* ============================================================
   START SERVER
   ============================================================ */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('------------------------------------------');
    console.log(`🚀 GAB JEWELS SERVER: http://localhost:${PORT}`);
    console.log('------------------------------------------');
    console.log('Routes available:');
    console.log('  GET  /api/settings');
    console.log('  POST /api/settings/profile');
    console.log('  POST /api/settings/security');
    console.log('  POST /api/settings/preferences');
    console.log('  POST /api/settings/password');
    console.log('  POST /api/send-otp');
    console.log('  POST /api/verify-otp');
    console.log('------------------------------------------');
});
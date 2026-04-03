"use strict";

const express   = require("express");
const bcrypt    = require("bcryptjs");
const jwt       = require("jsonwebtoken");
const helmet    = require("helmet");
const rateLimit = require("express-rate-limit");
const xss       = require("xss");
const { body, param, validationResult } = require("express-validator");
const db        = require("./database");
const path      = require("path");
const https     = require("https");
const nodemailer= require("nodemailer");
const axios     = require("axios");
const cron      = require("node-cron");

require("dotenv").config();

const PORT         = process.env.PORT || 3000;
const JWT_SECRET   = process.env.JWT_SECRET || "gab_jewels_secret_change_in_production";
const JWT_EXPIRY   = process.env.JWT_EXPIRY || "7d";
const FAST2SMS_KEY = process.env.FAST2SMS_KEY || "";
const GOLD_API_KEY = process.env.GOLD_API_KEY || "";

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "50kb" }));

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.header("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
    if (req.method === "OPTIONS") return res.sendStatus(200);
    next();
});


// ── GOLD RATES ────────────────────────────────────────────────
let GOLD_RATES = {
    gold24K:   73500,
    gold22K:   67375,
    silver:    92500,
    updatedAt: new Date().toISOString(),
    source:    'manual'
};

// ✅ FIXED FUNCTION (USD → INR)
async function updateGoldRate() {
    try {
        if (!GOLD_API_KEY) {
            console.log("⚠ Gold API key missing");
            return;
        }

        const response = await axios.get("https://www.goldapi.io/api/XAU/USD", {
            headers: {
                "x-access-token": GOLD_API_KEY,
                "Content-Type": "application/json"
            }
        });

        const usdToInr = 83; // approx conversion
        const pricePerOunce = response.data.price * usdToInr;

        const pricePerGram = pricePerOunce / 31.1035;
        const pricePer10g  = pricePerGram * 10;

        GOLD_RATES.gold24K = Math.round(pricePer10g);
        GOLD_RATES.gold22K = Math.round(pricePer10g * 22 / 24);
        GOLD_RATES.updatedAt = new Date().toISOString();
        GOLD_RATES.source = "api";

        console.log("✅ Gold rate updated:", GOLD_RATES.gold24K);

    } catch (err) {
        console.error("❌ Gold API error:", err.message);
    }
}

// ⏰ Run at 12 AM & 12 PM IST
cron.schedule("0 0,12 * * *", updateGoldRate, {
    timezone: "Asia/Kolkata"
});

// 🚀 Run once on server start
updateGoldRate();


// ── ROUTES ────────────────────────────────────────────────

// Public API
app.get("/api/rates", (req, res) => {
    res.json(GOLD_RATES);
});


// ── STATIC ────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, "../public")));

app.get("/{*path}", (req, res) => {
    res.sendFile(path.join(__dirname, "../public/index.html"));
});


// ── SERVER START ───────────────────────────────────────────
app.listen(PORT, () => {
    console.log("─────────────────────────────────────────");
    console.log(`GAB Jewels  ->  http://localhost:${PORT}`);
    console.log(`Login       ->  http://localhost:${PORT}/login.html`);
    console.log(`Admin       ->  http://localhost:${PORT}/pages/admin/dashboard.html`);
    console.log("─────────────────────────────────────────");
    console.log(FAST2SMS_KEY ? "Fast2SMS ready" : "FAST2SMS_KEY not set — OTPs shown on screen");
});
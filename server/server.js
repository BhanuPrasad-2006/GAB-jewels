"use strict";

const express      = require("express");
const bcrypt       = require("bcryptjs");
const jwt          = require("jsonwebtoken");
const helmet       = require("helmet");
const rateLimit    = require("express-rate-limit");
const xss          = require("xss");
const { body, param, validationResult } = require("express-validator");
const db           = require("./database");
const path         = require("path");
const twilio       = require("twilio");
require("dotenv").config();

// ─── CONFIG ──────────────────────────────────────────
const PORT       = process.env.PORT        || 3000;
const JWT_SECRET = process.env.JWT_SECRET  || "gab_jewels_secret_change_in_production";
const JWT_EXPIRY = process.env.JWT_EXPIRY  || "2h";

const app = express();

// ─── MIDDLEWARE ───────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "50kb" }));

// ─── SQLITE HELPERS ───────────────────────────────────
const dbGet = (sql, params = []) => new Promise((res, rej) =>
    db.get(sql, params, (err, row) => err ? rej(err) : res(row))
);
const dbAll = (sql, params = []) => new Promise((res, rej) =>
    db.all(sql, params, (err, rows) => err ? rej(err) : res(rows))
);
const dbRun = (sql, params = []) => new Promise((res, rej) =>
    db.run(sql, params, function(err) {
        err ? rej(err) : res({ lastID: this.lastID, changes: this.changes });
    })
);

// ─── HELPERS ──────────────────────────────────────────
function sanitise(str) {
    return xss(String(str).trim());
}

async function auditLog(adminId, action, targetType, targetId, detail, ip) {
    try {
        await dbRun(
            `INSERT INTO admin_logs (admin_id, action, target_type, target_id, detail, ip_address)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [adminId, action, targetType, targetId, JSON.stringify(detail), ip]
        );
    } catch (err) {
        console.error("Audit log write failed:", err.message);
    }
}

function validateRequest(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(422).json({ errors: errors.array() });
        return false;
    }
    return true;
}

function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// In-memory OTP store — use Redis in production
const otpStore = new Map();

// ─── RATE LIMITERS ────────────────────────────────────
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, max: 100,
    message: { error: "Too many requests. Please slow down." },
});
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, max: 10,
    message: { error: "Too many login attempts. Try again in 15 minutes." },
});
const otpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, max: 5,
    message: { error: "Too many OTP requests. Try again in 15 minutes." },
});

// ─── AUTH MIDDLEWARE ──────────────────────────────────
function requireAuth(req, res, next) {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Authentication required." });
    }
    try {
        req.user = jwt.verify(auth.slice(7), JWT_SECRET);
        next();
    } catch {
        return res.status(401).json({ error: "Invalid or expired token." });
    }
}

function requireAdmin(req, res, next) {
    if (req.user?.role !== "admin") {
        auditLog(req.user?.id, "UNAUTHORISED_ACCESS_ATTEMPT",
                 "route", null, { path: req.originalUrl }, req.ip);
        return res.status(403).json({ error: "Forbidden. Administrator access required." });
    }
    next();
}

// ─────────────────────────────────────────────────────
//  AUTH ROUTES
// ─────────────────────────────────────────────────────

// POST /api/auth/send-otp
app.post("/api/auth/send-otp", otpLimiter,
    body("phone").notEmpty().withMessage("Phone number is required."),
    body("email").isEmail().normalizeEmail(),
    async (req, res) => {
        if (!validateRequest(req, res)) return;
        const { phone, email } = req.body;

        // Check email not already registered
        try {
            const existing = await dbGet("SELECT id FROM users WHERE email = ?", [email]);
            if (existing) {
                return res.status(409).json({ error: "Email already registered. Please sign in." });
            }
        } catch (err) {
            console.error("OTP check error:", err.message);
            return res.status(500).json({ error: "Server error." });
        }

        const otp     = generateOTP();
        const expires = Date.now() + 5 * 60 * 1000; // 5 min
        otpStore.set(phone, { otp, expires, verified: false });

        // Send via Twilio
        try {
            const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
            await client.messages.create({
                body: `Your GAB Jewels verification code is: ${otp}. Valid for 5 minutes.`,
                from: process.env.TWILIO_PHONE,
                to:   phone,
            });
            console.log(`✦ OTP sent to ${phone}`);
        } catch (err) {
            // In development, log to console so you can still test
            console.log(`✦ [DEV] OTP for ${phone} → ${otp}`);
        }

        res.json({ message: "OTP sent successfully." });
    }
);

// POST /api/auth/verify-otp
app.post("/api/auth/verify-otp",
    body("phone").notEmpty(),
    body("otp").isLength({ min: 6, max: 6 }).withMessage("OTP must be 6 digits."),
    async (req, res) => {
        if (!validateRequest(req, res)) return;
        const { phone, otp } = req.body;

        const record = otpStore.get(phone);
        if (!record) {
            return res.status(400).json({ error: "No OTP found. Please request a new one." });
        }
        if (Date.now() > record.expires) {
            otpStore.delete(phone);
            return res.status(400).json({ error: "OTP has expired. Please request a new one." });
        }
        if (record.otp !== otp) {
            return res.status(400).json({ error: "Incorrect OTP. Please try again." });
        }

        record.verified = true;
        otpStore.set(phone, record);
        res.json({ message: "OTP verified successfully." });
    }
);

// POST /api/auth/register
app.post("/api/auth/register", apiLimiter,
    body("email").isEmail().normalizeEmail(),
    body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters."),
    async (req, res) => {
        if (!validateRequest(req, res)) return;
        const { email, password, name, phone } = req.body;

        // If phone provided, verify OTP was completed
        if (phone) {
            const record = otpStore.get(phone);
            if (!record || !record.verified) {
                return res.status(400).json({ error: "Phone not verified. Please complete OTP verification." });
            }
        }

        try {
            const hash = await bcrypt.hash(password, 12);
            const result = await dbRun(
                `INSERT INTO users (email, password_hash, name, phone) VALUES (?, ?, ?, ?)`,
                [email, hash, sanitise(name || ""), phone || null]
            );
            if (phone) otpStore.delete(phone);
            res.status(201).json({ id: result.lastID, email, role: "customer" });
        } catch (err) {
            if (err.message.includes("UNIQUE")) {
                return res.status(409).json({ error: "Email already registered." });
            }
            console.error("Register error:", err.message);
            res.status(500).json({ error: "Registration failed." });
        }
    }
);

// POST /api/auth/login
app.post("/api/auth/login", loginLimiter,
    body("email").isEmail().normalizeEmail(),
    body("password").notEmpty(),
    async (req, res) => {
        if (!validateRequest(req, res)) return;
        const { email, password } = req.body;
        try {
            const user = await dbGet("SELECT * FROM users WHERE email = ?", [email]);
            if (!user || !(await bcrypt.compare(password, user.password_hash))) {
                return res.status(401).json({ error: "Invalid credentials." });
            }
            if (user.is_banned) {
                return res.status(403).json({ error: "Account suspended. Contact support." });
            }
            const token = jwt.sign(
                { id: user.id, email: user.email, role: user.role, name: user.name },
                JWT_SECRET, { expiresIn: JWT_EXPIRY }
            );
            res.json({ token, role: user.role, name: user.name });
        } catch (err) {
            console.error("Login error:", err.message);
            res.status(500).json({ error: "Login failed." });
        }
    }
);

// POST /api/auth/logout
app.post("/api/auth/logout", requireAuth, (req, res) => {
    res.json({ message: "Logged out successfully." });
});

// ─────────────────────────────────────────────────────
//  ADMIN — STATS
// ─────────────────────────────────────────────────────
app.get("/api/admin/stats", requireAuth, requireAdmin, async (req, res) => {
    try {
        const [products, users, settings, logs] = await Promise.all([
            dbGet("SELECT COUNT(*) AS count FROM products WHERE is_archived = 0"),
            dbGet("SELECT COUNT(*) AS count FROM users WHERE role = 'customer'"),
            dbGet("SELECT * FROM gold_settings WHERE id = 1"),
            dbGet(`SELECT COUNT(*) AS count FROM admin_logs WHERE created_at >= datetime('now','-1 day')`),
        ]);
        res.json({
            total_products: products.count,
            total_users:    users.count,
            gold_settings:  settings,
            logs_today:     logs.count,
        });
    } catch (err) {
        console.error("Stats error:", err.message);
        res.status(500).json({ error: "Could not fetch stats." });
    }
});

// ─────────────────────────────────────────────────────
//  ADMIN — PRODUCTS CRUD
// ─────────────────────────────────────────────────────

app.get("/api/admin/products", requireAuth, requireAdmin, async (req, res) => {
    try {
        const rows = await dbAll("SELECT * FROM products ORDER BY created_at DESC");
        res.json(rows);
    } catch (err) {
        console.error("Products error:", err.message);
        res.status(500).json({ error: "Could not fetch products." });
    }
});

app.post("/api/admin/products", requireAuth, requireAdmin,
    body("name").notEmpty().trim(),
    body("category").notEmpty().trim(),
    body("price_base").isFloat({ min: 0 }),
    body("gold_weight").isFloat({ min: 0 }),
    body("purity").isIn(["22K", "18K", "14K"]),
    body("stock_count").isInt({ min: 0 }),
    async (req, res) => {
        if (!validateRequest(req, res)) return;
        const name     = sanitise(req.body.name);
        const category = sanitise(req.body.category);
        const imageUrl = sanitise(req.body.image_url || "");
        const { price_base, gold_weight, purity, stock_count } = req.body;
        try {
            const result = await dbRun(
                `INSERT INTO products (name, category, price_base, gold_weight, purity, image_url, stock_count)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [name, category, price_base, gold_weight, purity, imageUrl, stock_count]
            );
            const product = await dbGet("SELECT * FROM products WHERE id = ?", [result.lastID]);
            await auditLog(req.user.id, "CREATE_PRODUCT", "product", result.lastID, { name }, req.ip);
            res.status(201).json(product);
        } catch (err) {
            console.error("Create product error:", err.message);
            res.status(500).json({ error: "Could not create product." });
        }
    }
);

app.patch("/api/admin/products/:id", requireAuth, requireAdmin,
    param("id").isInt(),
    async (req, res) => {
        if (!validateRequest(req, res)) return;
        const allowed = ["name","category","price_base","gold_weight","purity","image_url","stock_count"];
        const updates = {};
        for (const key of allowed) {
            if (req.body[key] !== undefined) {
                updates[key] = typeof req.body[key] === "string"
                    ? sanitise(req.body[key]) : req.body[key];
            }
        }
        if (!Object.keys(updates).length) {
            return res.status(400).json({ error: "No valid fields provided." });
        }
        const sets   = Object.keys(updates).map(k => `${k} = ?`).join(", ");
        const values = [...Object.values(updates), req.params.id];
        try {
            const result = await dbRun(
                `UPDATE products SET ${sets}, updated_at = datetime('now') WHERE id = ?`, values
            );
            if (!result.changes) return res.status(404).json({ error: "Product not found." });
            const product = await dbGet("SELECT * FROM products WHERE id = ?", [req.params.id]);
            await auditLog(req.user.id, "UPDATE_PRODUCT", "product",
                           Number(req.params.id), updates, req.ip);
            res.json(product);
        } catch (err) {
            console.error("Update product error:", err.message);
            res.status(500).json({ error: "Could not update product." });
        }
    }
);

app.delete("/api/admin/products/:id", requireAuth, requireAdmin,
    param("id").isInt(),
    async (req, res) => {
        if (!validateRequest(req, res)) return;
        try {
            const product = await dbGet("SELECT * FROM products WHERE id = ?", [req.params.id]);
            if (!product) return res.status(404).json({ error: "Product not found." });
            await dbRun(
                `UPDATE products SET is_archived = 1, updated_at = datetime('now') WHERE id = ?`,
                [req.params.id]
            );
            await auditLog(req.user.id, "DELETE_PRODUCT", "product",
                           Number(req.params.id), { name: product.name }, req.ip);
            res.json({ message: "Product archived.", id: product.id });
        } catch (err) {
            console.error("Archive error:", err.message);
            res.status(500).json({ error: "Could not archive product." });
        }
    }
);

// ─────────────────────────────────────────────────────
//  ADMIN — USERS
// ─────────────────────────────────────────────────────

app.get("/api/admin/users", requireAuth, requireAdmin, async (req, res) => {
    try {
        const rows = await dbAll(
            "SELECT id, email, name, phone, role, is_banned, created_at FROM users ORDER BY created_at DESC"
        );
        res.json(rows);
    } catch (err) {
        console.error("Users error:", err.message);
        res.status(500).json({ error: "Could not fetch users." });
    }
});

app.patch("/api/admin/users/:id/ban", requireAuth, requireAdmin,
    param("id").isInt(),
    async (req, res) => {
        if (!validateRequest(req, res)) return;
        if (Number(req.params.id) === req.user.id) {
            return res.status(400).json({ error: "Cannot ban yourself." });
        }
        try {
            const user = await dbGet("SELECT * FROM users WHERE id = ?", [req.params.id]);
            if (!user) return res.status(404).json({ error: "User not found." });
            const newBanned = user.is_banned ? 0 : 1;
            await dbRun("UPDATE users SET is_banned = ? WHERE id = ?", [newBanned, req.params.id]);
            const action = newBanned ? "BAN_USER" : "UNBAN_USER";
            await auditLog(req.user.id, action, "user",
                           Number(req.params.id), { email: user.email }, req.ip);
            res.json({ id: user.id, email: user.email, is_banned: newBanned });
        } catch (err) {
            console.error("Ban error:", err.message);
            res.status(500).json({ error: "Could not update user." });
        }
    }
);

app.post("/api/admin/users/:id/reset-password", requireAuth, requireAdmin,
    param("id").isInt(),
    body("new_password").isLength({ min: 8 }),
    async (req, res) => {
        if (!validateRequest(req, res)) return;
        try {
            const user = await dbGet("SELECT * FROM users WHERE id = ?", [req.params.id]);
            if (!user) return res.status(404).json({ error: "User not found." });
            const hash = await bcrypt.hash(req.body.new_password, 12);
            await dbRun("UPDATE users SET password_hash = ? WHERE id = ?", [hash, req.params.id]);
            await auditLog(req.user.id, "RESET_PASSWORD", "user",
                           Number(req.params.id), { email: user.email }, req.ip);
            res.json({ message: "Password reset successfully." });
        } catch (err) {
            console.error("Reset pw error:", err.message);
            res.status(500).json({ error: "Could not reset password." });
        }
    }
);

// ─────────────────────────────────────────────────────
//  ADMIN — GOLD SETTINGS
// ─────────────────────────────────────────────────────

app.get("/api/admin/gold-settings", requireAuth, requireAdmin, async (req, res) => {
    try {
        const row = await dbGet("SELECT * FROM gold_settings WHERE id = 1");
        res.json(row);
    } catch (err) {
        console.error("Gold settings error:", err.message);
        res.status(500).json({ error: "Could not fetch gold settings." });
    }
});

app.patch("/api/admin/gold-settings", requireAuth, requireAdmin,
    body("markup_pct").isFloat({ min: 0, max: 100 }),
    async (req, res) => {
        if (!validateRequest(req, res)) return;
        const { markup_pct, manual_rate } = req.body;
        try {
            await dbRun(
                `UPDATE gold_settings
                 SET markup_pct = ?, manual_rate = ?, updated_by = ?, updated_at = datetime('now')
                 WHERE id = 1`,
                [markup_pct, manual_rate || null, req.user.id]
            );
            const row = await dbGet("SELECT * FROM gold_settings WHERE id = 1");
            await auditLog(req.user.id, "UPDATE_GOLD_SETTINGS", "settings",
                           null, { markup_pct, manual_rate }, req.ip);
            res.json(row);
        } catch (err) {
            console.error("Update gold error:", err.message);
            res.status(500).json({ error: "Could not update gold settings." });
        }
    }
);

// ─────────────────────────────────────────────────────
//  ADMIN — AUDIT LOGS
// ─────────────────────────────────────────────────────

app.get("/api/admin/logs", requireAuth, requireAdmin, async (req, res) => {
    const limit  = Math.min(parseInt(req.query.limit)  || 50, 200);
    const offset = parseInt(req.query.offset) || 0;
    try {
        const rows = await dbAll(
            `SELECT l.*, u.email AS admin_email
             FROM admin_logs l
             JOIN users u ON u.id = l.admin_id
             ORDER BY l.created_at DESC
             LIMIT ? OFFSET ?`,
            [limit, offset]
        );
        res.json(rows);
    } catch (err) {
        console.error("Logs error:", err.message);
        res.status(500).json({ error: "Could not fetch logs." });
    }
});

// ─────────────────────────────────────────────────────
//  PUBLIC STOREFRONT API
// ─────────────────────────────────────────────────────

app.get("/api/products", async (req, res) => {
    try {
        const rows = await dbAll(
            "SELECT * FROM products WHERE is_archived = 0 ORDER BY created_at DESC"
        );
        res.json(rows);
    } catch (err) {
        console.error("Public products error:", err.message);
        res.status(500).json({ error: "Could not fetch products." });
    }
});

// ─────────────────────────────────────────────────────
//  STATIC + CATCH-ALL — must be LAST
// ─────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, "../public")));

app.get("/{*path}", (req, res) => {
    res.sendFile(path.join(__dirname, "../public/index.html"));
});

// ─────────────────────────────────────────────────────
//  START
// ─────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`✦ GAB Jewels server running  → http://localhost:${PORT}`);
    console.log(`✦ Admin dashboard            → http://localhost:${PORT}/pages/admin/dashboard.html`);
    console.log(`✦ Login page                 → http://localhost:${PORT}/login.html`);
});

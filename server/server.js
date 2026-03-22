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
require("dotenv").config();

const PORT         = process.env.PORT        || 3000;
const JWT_SECRET   = process.env.JWT_SECRET  || "gab_jewels_secret_change_in_production";
const JWT_EXPIRY   = process.env.JWT_EXPIRY  || "7d";
const FAST2SMS_KEY = process.env.FAST2SMS_KEY || "";

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

const dbGet = (sql, p = []) => new Promise((res, rej) =>
    db.get(sql, p, (err, row) => err ? rej(err) : res(row)));
const dbAll = (sql, p = []) => new Promise((res, rej) =>
    db.all(sql, p, (err, rows) => err ? rej(err) : res(rows)));
const dbRun = (sql, p = []) => new Promise((res, rej) =>
    db.run(sql, p, function(err) { err ? rej(err) : res({ lastID: this.lastID, changes: this.changes }); }));

function sanitise(str) { return xss(String(str || "").trim()); }
function generateOTP() { return Math.floor(100000 + Math.random() * 900000).toString(); }
function validateRequest(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(422).json({ error: errors.array()[0].msg }); return false; }
    return true;
}
async function auditLog(adminId, action, targetType, targetId, detail, ip) {
    try { await dbRun(`INSERT INTO admin_logs (admin_id,action,target_type,target_id,detail,ip_address) VALUES (?,?,?,?,?,?)`,
        [adminId, action, targetType, targetId, JSON.stringify(detail), ip]); }
    catch (err) { console.error("Audit:", err.message); }
}

const otpStore = new Map();

function sendSMS(mobileNumber, otp) {
    return new Promise((resolve) => {
        const digits = mobileNumber.replace(/\D/g, "").slice(-10);
        if (!FAST2SMS_KEY) {
            console.log(`[DEV OTP] ${digits} -> ${otp}`);
            return resolve({ sent: false, otp });
        }
        console.log(`Sending SMS to: ${digits}`);
        const postData = JSON.stringify({
            route: "q",
            message: `Your GAB Jewels OTP is ${otp}. Valid for 5 minutes. Do not share with anyone.`,
            numbers: digits,
            flash: 0,
        });
        const req = https.request({
            hostname: "www.fast2sms.com", path: "/dev/bulkV2", method: "POST",
            headers: { "authorization": FAST2SMS_KEY, "Content-Type": "application/json", "Content-Length": Buffer.byteLength(postData) },
        }, (res) => {
            let data = "";
            res.on("data", c => data += c);
            res.on("end", () => {
                try {
                    const p = JSON.parse(data);
                    console.log("Fast2SMS:", JSON.stringify(p));
                    if (p.return === true) { console.log("SMS sent to", digits); resolve({ sent: true }); }
                    else { console.warn("Fast2SMS failed:", p.message); resolve({ sent: false, otp }); }
                } catch { resolve({ sent: false, otp }); }
            });
        });
        req.on("error", (e) => { console.error("SMS error:", e.message); resolve({ sent: false, otp }); });
        req.write(postData); req.end();
    });
}

const apiLimiter   = rateLimit({ windowMs: 15*60*1000, max: 100, message: { error: "Too many requests." } });
const loginLimiter = rateLimit({ windowMs: 15*60*1000, max: 15,  message: { error: "Too many login attempts. Try again in 15 minutes." } });
const otpLimiter   = rateLimit({ windowMs: 15*60*1000, max: 5,   message: { error: "Too many OTP requests. Try again later." } });

function requireAuth(req, res, next) {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith("Bearer ")) return res.status(401).json({ error: "Authentication required." });
    try { req.user = jwt.verify(auth.slice(7), JWT_SECRET); next(); }
    catch { return res.status(401).json({ error: "Session expired. Please log in again." }); }
}
function requireAdmin(req, res, next) {
    if (req.user?.role !== "admin") {
        auditLog(req.user?.id, "UNAUTHORISED_ACCESS", "route", null, { path: req.originalUrl }, req.ip);
        return res.status(403).json({ error: "Administrator access required." });
    }
    next();
}

// CHECK EMAIL
app.post("/api/auth/check-email",
    body("email").isEmail().normalizeEmail(),
    async (req, res) => {
        if (!validateRequest(req, res)) return;
        try {
            const user = await dbGet("SELECT id FROM users WHERE email = ?", [req.body.email]);
            res.json({ exists: !!user });
        } catch { res.json({ exists: false }); }
    }
);

// SEND OTP
app.post("/api/auth/send-otp", otpLimiter,
    body("phone").notEmpty().withMessage("Phone number is required."),
    body("email").isEmail().normalizeEmail().withMessage("Valid email required."),
    async (req, res) => {
        if (!validateRequest(req, res)) return;
        const { phone, email } = req.body;
        try {
            const existing = await dbGet("SELECT id FROM users WHERE email = ?", [email]);
            if (existing) return res.status(409).json({
                error: "This email is already registered. Please sign in instead.",
                redirect: "login"
            });
        } catch (err) {
            return res.status(500).json({ error: "Server error. Please try again." });
        }
        const otp = generateOTP();
        otpStore.set(phone, { otp, expires: Date.now() + 5*60*1000, verified: false, email });
        const result = await sendSMS(phone, otp);
        if (result.sent) res.json({ message: "OTP sent to your mobile number." });
        else res.json({ message: "OTP generated.", dev_otp: result.otp });
    }
);

// VERIFY OTP
app.post("/api/auth/verify-otp",
    body("phone").notEmpty(),
    body("otp").isLength({ min: 6, max: 6 }).withMessage("OTP must be 6 digits."),
    async (req, res) => {
        if (!validateRequest(req, res)) return;
        const { phone, otp } = req.body;
        const record = otpStore.get(phone);
        if (!record) return res.status(400).json({ error: "No OTP found. Please request a new one." });
        if (Date.now() > record.expires) { otpStore.delete(phone); return res.status(400).json({ error: "OTP expired. Please request a new one." }); }
        if (record.otp !== otp) return res.status(400).json({ error: "Incorrect OTP. Please try again." });
        record.verified = true;
        otpStore.set(phone, record);
        res.json({ message: "Phone verified successfully." });
    }
);

// REGISTER
app.post("/api/auth/register", apiLimiter,
    body("name").notEmpty().trim().withMessage("Full name is required."),
    body("email").isEmail().normalizeEmail().withMessage("Valid email is required."),
    body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters."),
    async (req, res) => {
        if (!validateRequest(req, res)) return;
        const { name, email, password, phone } = req.body;
        try {
            const existing = await dbGet("SELECT id FROM users WHERE email = ?", [email]);
            if (existing) return res.status(409).json({
                error: "An account with this email already exists. Please sign in.",
                redirect: "login"
            });
        } catch (err) {
            return res.status(500).json({ error: "Server error. Please try again." });
        }
        if (phone) {
            const record = otpStore.get(phone);
            if (!record || !record.verified)
                return res.status(400).json({ error: "Phone not verified. Please complete OTP verification." });
        }
        try {
            const hash   = await bcrypt.hash(password, 12);
            const result = await dbRun(
                `INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, 'customer')`,
                [sanitise(name), email, phone || null, hash]
            );
            if (phone) otpStore.delete(phone);
            console.log(`New user: ${email}`);
            res.status(201).json({ id: result.lastID, email, role: "customer" });
        } catch (err) {
            if (err.message.includes("UNIQUE")) return res.status(409).json({
                error: "An account with this email already exists. Please sign in.",
                redirect: "login"
            });
            console.error("Register:", err.message);
            res.status(500).json({ error: "Registration failed. Please try again." });
        }
    }
);

// LOGIN
app.post("/api/auth/login", loginLimiter,
    body("email").isEmail().normalizeEmail().withMessage("Valid email is required."),
    body("password").notEmpty().withMessage("Password is required."),
    async (req, res) => {
        if (!validateRequest(req, res)) return;
        const { email, password } = req.body;
        try {
            const user = await dbGet("SELECT * FROM users WHERE email = ?", [email]);
            if (!user) return res.status(404).json({
                error: "No account found with this email. Please create an account first.",
                redirect: "signup"
            });
            const match = await bcrypt.compare(password, user.password_hash);
            if (!match) return res.status(401).json({ error: "Incorrect password. Please try again." });
            if (user.is_banned) return res.status(403).json({ error: "Your account has been suspended. Contact support." });
            const token = jwt.sign(
                { id: user.id, email: user.email, role: user.role, name: user.name },
                JWT_SECRET, { expiresIn: JWT_EXPIRY }
            );
            console.log(`Login: ${email} (${user.role})`);
            res.json({ token, role: user.role, name: user.name, email: user.email });
        } catch (err) {
            console.error("Login:", err.message);
            res.status(500).json({ error: "Login failed. Please try again." });
        }
    }
);

app.post("/api/auth/logout", requireAuth, (req, res) => {
    res.json({ message: "Logged out successfully." });
});

// SETTINGS
app.get("/api/settings", requireAuth, async (req, res) => {
    try { res.json(await dbGet("SELECT id,name,email,phone FROM users WHERE id=?", [req.user.id]) || {}); }
    catch { res.status(500).json({ error: "Could not fetch settings." }); }
});
app.post("/api/settings/profile", requireAuth,
    body("name").notEmpty().trim(), body("email").isEmail().normalizeEmail(),
    async (req, res) => {
        if (!validateRequest(req, res)) return;
        try {
            await dbRun(`UPDATE users SET name=?,email=?,phone=?,updated_at=datetime('now') WHERE id=?`,
                [sanitise(req.body.name), req.body.email, req.body.phone||null, req.user.id]);
            res.json({ success: true, message: "Profile updated." });
        } catch (err) { res.status(500).json({ error: "Could not update profile." }); }
    }
);
app.post("/api/settings/password", requireAuth,
    body("currentPassword").notEmpty(), body("newPassword").isLength({ min: 8 }),
    async (req, res) => {
        if (!validateRequest(req, res)) return;
        try {
            const user = await dbGet("SELECT * FROM users WHERE id=?", [req.user.id]);
            if (!user || !(await bcrypt.compare(req.body.currentPassword, user.password_hash)))
                return res.status(401).json({ error: "Current password is incorrect." });
            const hash = await bcrypt.hash(req.body.newPassword, 12);
            await dbRun("UPDATE users SET password_hash=?,updated_at=datetime('now') WHERE id=?", [hash, req.user.id]);
            res.json({ success: true, message: "Password updated." });
        } catch { res.status(500).json({ error: "Could not update password." }); }
    }
);

// ADMIN STATS
app.get("/api/admin/stats", requireAuth, requireAdmin, async (req, res) => {
    try {
        const [products, users, settings, logs] = await Promise.all([
            dbGet("SELECT COUNT(*) AS count FROM products WHERE is_archived=0"),
            dbGet("SELECT COUNT(*) AS count FROM users WHERE role='customer'"),
            dbGet("SELECT * FROM gold_settings WHERE id=1"),
            dbGet(`SELECT COUNT(*) AS count FROM admin_logs WHERE created_at>=datetime('now','-1 day')`),
        ]);
        res.json({ total_products: products?.count||0, total_users: users?.count||0, gold_settings: settings||{}, logs_today: logs?.count||0 });
    } catch (err) { res.status(500).json({ error: "Could not fetch stats." }); }
});

// ADMIN PRODUCTS
app.get("/api/admin/products", requireAuth, requireAdmin, async (req, res) => {
    try { res.json(await dbAll("SELECT * FROM products ORDER BY created_at DESC")); }
    catch { res.status(500).json({ error: "Could not fetch products." }); }
});
app.post("/api/admin/products", requireAuth, requireAdmin,
    body("name").notEmpty().trim(), body("category").notEmpty().trim(),
    body("price_base").isFloat({min:0}), body("gold_weight").isFloat({min:0}),
    body("purity").isIn(["22K","18K","14K"]), body("stock_count").isInt({min:0}),
    async (req, res) => {
        if (!validateRequest(req, res)) return;
        try {
            const result = await dbRun(
                `INSERT INTO products (name,category,price_base,gold_weight,purity,image_url,stock_count) VALUES (?,?,?,?,?,?,?)`,
                [sanitise(req.body.name),sanitise(req.body.category),req.body.price_base,req.body.gold_weight,req.body.purity,sanitise(req.body.image_url||""),req.body.stock_count]
            );
            const product = await dbGet("SELECT * FROM products WHERE id=?", [result.lastID]);
            await auditLog(req.user.id,"CREATE_PRODUCT","product",result.lastID,{name:product.name},req.ip);
            res.status(201).json(product);
        } catch (err) { res.status(500).json({ error: "Could not create product." }); }
    }
);
app.patch("/api/admin/products/:id", requireAuth, requireAdmin, param("id").isInt(), async (req, res) => {
    if (!validateRequest(req, res)) return;
    const allowed = ["name","category","price_base","gold_weight","purity","image_url","stock_count"];
    const updates = {};
    for (const key of allowed) if (req.body[key]!==undefined) updates[key]=typeof req.body[key]==="string"?sanitise(req.body[key]):req.body[key];
    if (!Object.keys(updates).length) return res.status(400).json({ error: "No valid fields." });
    try {
        const sets = Object.keys(updates).map(k=>`${k}=?`).join(",");
        const result = await dbRun(`UPDATE products SET ${sets},updated_at=datetime('now') WHERE id=?`,[...Object.values(updates),req.params.id]);
        if (!result.changes) return res.status(404).json({ error: "Product not found." });
        const product = await dbGet("SELECT * FROM products WHERE id=?", [req.params.id]);
        await auditLog(req.user.id,"UPDATE_PRODUCT","product",Number(req.params.id),updates,req.ip);
        res.json(product);
    } catch (err) { res.status(500).json({ error: "Could not update product." }); }
});
app.delete("/api/admin/products/:id", requireAuth, requireAdmin, param("id").isInt(), async (req, res) => {
    if (!validateRequest(req, res)) return;
    try {
        const product = await dbGet("SELECT * FROM products WHERE id=?", [req.params.id]);
        if (!product) return res.status(404).json({ error: "Product not found." });
        await dbRun(`UPDATE products SET is_archived=1,updated_at=datetime('now') WHERE id=?`,[req.params.id]);
        await auditLog(req.user.id,"DELETE_PRODUCT","product",Number(req.params.id),{name:product.name},req.ip);
        res.json({ message: "Product archived.", id: product.id });
    } catch { res.status(500).json({ error: "Could not archive product." }); }
});

// ADMIN USERS
app.get("/api/admin/users", requireAuth, requireAdmin, async (req, res) => {
    try { res.json(await dbAll("SELECT id,email,name,phone,role,is_banned,created_at FROM users ORDER BY created_at DESC")); }
    catch { res.status(500).json({ error: "Could not fetch users." }); }
});
app.patch("/api/admin/users/:id/ban", requireAuth, requireAdmin, param("id").isInt(), async (req, res) => {
    if (!validateRequest(req, res)) return;
    if (Number(req.params.id)===req.user.id) return res.status(400).json({ error: "Cannot ban yourself." });
    try {
        const user = await dbGet("SELECT * FROM users WHERE id=?", [req.params.id]);
        if (!user) return res.status(404).json({ error: "User not found." });
        const newBanned = user.is_banned ? 0 : 1;
        await dbRun("UPDATE users SET is_banned=? WHERE id=?", [newBanned, req.params.id]);
        await auditLog(req.user.id,newBanned?"BAN_USER":"UNBAN_USER","user",Number(req.params.id),{email:user.email},req.ip);
        res.json({ id: user.id, email: user.email, is_banned: newBanned });
    } catch { res.status(500).json({ error: "Could not update user." }); }
});
app.post("/api/admin/users/:id/reset-password", requireAuth, requireAdmin,
    param("id").isInt(), body("new_password").isLength({min:8}),
    async (req, res) => {
        if (!validateRequest(req, res)) return;
        try {
            const user = await dbGet("SELECT * FROM users WHERE id=?", [req.params.id]);
            if (!user) return res.status(404).json({ error: "User not found." });
            const hash = await bcrypt.hash(req.body.new_password, 12);
            await dbRun("UPDATE users SET password_hash=? WHERE id=?", [hash, req.params.id]);
            await auditLog(req.user.id,"RESET_PASSWORD","user",Number(req.params.id),{email:user.email},req.ip);
            res.json({ message: "Password reset." });
        } catch { res.status(500).json({ error: "Could not reset password." }); }
    }
);

// ADMIN GOLD SETTINGS
app.get("/api/admin/gold-settings", requireAuth, requireAdmin, async (req, res) => {
    try { res.json(await dbGet("SELECT * FROM gold_settings WHERE id=1")); }
    catch { res.status(500).json({ error: "Could not fetch gold settings." }); }
});
app.patch("/api/admin/gold-settings", requireAuth, requireAdmin,
    body("markup_pct").isFloat({min:0,max:100}),
    async (req, res) => {
        if (!validateRequest(req, res)) return;
        try {
            await dbRun(`UPDATE gold_settings SET markup_pct=?,manual_rate=?,updated_by=?,updated_at=datetime('now') WHERE id=1`,
                [req.body.markup_pct, req.body.manual_rate||null, req.user.id]);
            const row = await dbGet("SELECT * FROM gold_settings WHERE id=1");
            await auditLog(req.user.id,"UPDATE_GOLD_SETTINGS","settings",null,req.body,req.ip);
            res.json(row);
        } catch { res.status(500).json({ error: "Could not update gold settings." }); }
    }
);

// ADMIN LOGS
app.get("/api/admin/logs", requireAuth, requireAdmin, async (req, res) => {
    const limit=Math.min(parseInt(req.query.limit)||50,200), offset=parseInt(req.query.offset)||0;
    try {
        res.json(await dbAll(
            `SELECT l.*,u.email AS admin_email FROM admin_logs l JOIN users u ON u.id=l.admin_id ORDER BY l.created_at DESC LIMIT ? OFFSET ?`,
            [limit, offset]
        ));
    } catch { res.status(500).json({ error: "Could not fetch logs." }); }
});

// PUBLIC
app.get("/api/products", async (req, res) => {
    try { res.json(await dbAll("SELECT * FROM products WHERE is_archived=0 ORDER BY created_at DESC")); }
    catch { res.status(500).json({ error: "Could not fetch products." }); }
});

app.use(express.static(path.join(__dirname, "../public")));
app.get("/{*path}", (req, res) => {
    res.sendFile(path.join(__dirname, "../public/index.html"));
});

app.listen(PORT, () => {
    console.log("─────────────────────────────────────────");
    console.log(`GAB Jewels  ->  http://localhost:${PORT}`);
    console.log(`Login       ->  http://localhost:${PORT}/login.html`);
    console.log(`Admin       ->  http://localhost:${PORT}/pages/admin/dashboard.html`);
    console.log("─────────────────────────────────────────");
    console.log(FAST2SMS_KEY ? "Fast2SMS ready" : "FAST2SMS_KEY not set — OTPs shown on screen");
});
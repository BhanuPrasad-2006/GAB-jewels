"use strict";

const sqlite3 = require('sqlite3').verbose();
const bcrypt  = require('bcryptjs');
const path    = require('path');

const DB_PATH = path.join(__dirname, 'gab_jewels.db');

const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) { console.error('DB connection error:', err.message); process.exit(1); }
    console.log('Connected to SQLite database.');
});

db.serialize(() => {
    db.run('PRAGMA journal_mode = WAL');
    db.run('PRAGMA foreign_keys = ON');

    // ── USERS ─────────────────────────────────────────────────
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        name          TEXT    NOT NULL DEFAULT '',
        email         TEXT    UNIQUE NOT NULL COLLATE NOCASE,
        phone         TEXT,
        password_hash TEXT    NOT NULL,
        role          TEXT    NOT NULL DEFAULT 'customer'
                              CHECK(role IN ('customer','admin')),
        is_banned     INTEGER NOT NULL DEFAULT 0,
        created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
        updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    )`);

    // Add name/phone columns if upgrading from old schema (safe — ignored if exists)
    db.run(`ALTER TABLE users ADD COLUMN name TEXT NOT NULL DEFAULT ''`,  () => {});
    db.run(`ALTER TABLE users ADD COLUMN phone TEXT`,                     () => {});
    db.run(`ALTER TABLE users ADD COLUMN updated_at TEXT NOT NULL DEFAULT (datetime('now'))`, () => {});

    // ── PRODUCTS ──────────────────────────────────────────────
    db.run(`CREATE TABLE IF NOT EXISTS products (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        name        TEXT    NOT NULL,
        category    TEXT    NOT NULL,
        price_base  REAL    NOT NULL DEFAULT 0,
        gold_weight REAL    NOT NULL DEFAULT 0,
        purity      TEXT    NOT NULL DEFAULT '22K',
        image_url   TEXT,
        stock_count INTEGER NOT NULL DEFAULT 0,
        is_archived INTEGER NOT NULL DEFAULT 0,
        created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
        updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    )`);

    // ── GOLD SETTINGS ─────────────────────────────────────────
    db.run(`CREATE TABLE IF NOT EXISTS gold_settings (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        markup_pct  REAL    NOT NULL DEFAULT 5.0,
        manual_rate REAL,
        updated_by  INTEGER REFERENCES users(id),
        updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    )`);

    // ── ADMIN AUDIT LOG ───────────────────────────────────────
    db.run(`CREATE TABLE IF NOT EXISTS admin_logs (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        admin_id    INTEGER NOT NULL REFERENCES users(id),
        action      TEXT    NOT NULL,
        target_type TEXT,
        target_id   INTEGER,
        detail      TEXT,
        ip_address  TEXT,
        created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    )`);

    // ── TRANSACTIONS ──────────────────────────────────────────
    db.run(`CREATE TABLE IF NOT EXISTS transactions (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id    INTEGER NOT NULL REFERENCES users(id),
        product_id INTEGER NOT NULL REFERENCES products(id),
        quantity   INTEGER NOT NULL DEFAULT 1,
        price_paid REAL    NOT NULL,
        created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    )`);

    // ── SEED: gold settings ───────────────────────────────────
    db.run(`INSERT OR IGNORE INTO gold_settings (id, markup_pct) VALUES (1, 5.0)`);

    // ── SEED: admin account ───────────────────────────────────
    const adminHash = bcrypt.hashSync('Admin@1234', 12);
    db.run(
        `INSERT OR IGNORE INTO users (email, password_hash, role, name) VALUES (?, ?, 'admin', 'Admin')`,
        ['admin@gabjewels.com', adminHash]
    );

    // ── SEED: sample products ─────────────────────────────────
    const sampleProducts = [
        // price = gold_weight × rate_per_gram × 1.15 (making) × 1.03 (GST)
        // 22K = ₹6,738/g · 18K = ₹5,513/g (update daily from ibja.co)
        ['Classic Gold Bangle',    'Bracelets',  99500,  12.5, '22K', 15, 'https://images.pexels.com/photos/1454171/pexels-photo-1454171.jpeg?auto=compress&cs=tinysrgb&w=600&h=600&fit=crop'],
        ['Diamond Solitaire Ring', 'Rings',      27500,   4.2, '18K',  6, 'https://images.pexels.com/photos/691046/pexels-photo-691046.jpeg?auto=compress&cs=tinysrgb&w=600&h=600&fit=crop'],
        ['Temple Necklace Set',    'Necklaces', 182000,  22.8, '22K',  3, 'https://images.pexels.com/photos/1458867/pexels-photo-1458867.jpeg?auto=compress&cs=tinysrgb&w=600&h=600&fit=crop'],
        ['Twisted Hoop Earrings',  'Earrings',   24800,   3.1, '22K', 20, 'https://images.pexels.com/photos/1191531/pexels-photo-1191531.jpeg?auto=compress&cs=tinysrgb&w=600&h=600&fit=crop'],
        ['Men Kada Bracelet',      'Bracelets', 143500,  18.0, '22K',  8, 'https://images.pexels.com/photos/1413420/pexels-photo-1413420.jpeg?auto=compress&cs=tinysrgb&w=600&h=600&fit=crop'],
    ];
    const stmt = db.prepare(
        `INSERT OR IGNORE INTO products (name, category, price_base, gold_weight, purity, stock_count, image_url) VALUES (?,?,?,?,?,?,?)`
    );
    sampleProducts.forEach(p => stmt.run(...p));
    stmt.finalize();

    console.log('Database schema ready.');
});

module.exports = db;
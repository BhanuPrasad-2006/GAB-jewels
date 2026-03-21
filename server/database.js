const sqlite3 = require('sqlite3').verbose();
const bcrypt  = require('bcryptjs');

const db = new sqlite3.Database('./gab_jewels.db', (err) => {
    if (err) console.error('DB connection error:', err.message);
    else     console.log('✦ Connected to SQLite database.');
});

db.serialize(() => {

    db.run('PRAGMA foreign_keys = ON');

    // ── USERS ─────────────────────────────────────────────
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        email         TEXT    UNIQUE NOT NULL,
        password_hash TEXT    NOT NULL,
        name          TEXT    DEFAULT '',
        phone         TEXT,
        role          TEXT    NOT NULL DEFAULT 'customer'
                              CHECK(role IN ('customer','admin')),
        is_banned     INTEGER NOT NULL DEFAULT 0,
        created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    )`);

    // Backfill columns for existing DB files created before these fields existed.
    db.run(`ALTER TABLE users ADD COLUMN name TEXT DEFAULT ''`, (err) => {
        if (err && !err.message.includes("duplicate column name")) {
            console.error("Failed adding users.name:", err.message);
        }
    });
    db.run(`ALTER TABLE users ADD COLUMN phone TEXT`, (err) => {
        if (err && !err.message.includes("duplicate column name")) {
            console.error("Failed adding users.phone:", err.message);
        }
    });

    // ── PRODUCTS ──────────────────────────────────────────
    db.run(`CREATE TABLE IF NOT EXISTS products (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        name         TEXT    NOT NULL,
        category     TEXT    NOT NULL,
        price_base   REAL    NOT NULL DEFAULT 0,
        gold_weight  REAL    NOT NULL DEFAULT 0,
        purity       TEXT    NOT NULL DEFAULT '22K',
        image_url    TEXT,
        stock_count  INTEGER NOT NULL DEFAULT 0,
        is_archived  INTEGER NOT NULL DEFAULT 0,
        created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
        updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
    )`);

    // ── GOLD SETTINGS ─────────────────────────────────────
    db.run(`CREATE TABLE IF NOT EXISTS gold_settings (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        markup_pct  REAL    NOT NULL DEFAULT 5.0,
        manual_rate REAL,
        updated_by  INTEGER REFERENCES users(id),
        updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    )`);

    // ── ADMIN AUDIT LOG ───────────────────────────────────
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

    // ── TRANSACTIONS ──────────────────────────────────────
    db.run(`CREATE TABLE IF NOT EXISTS transactions (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id    INTEGER NOT NULL REFERENCES users(id),
        product_id INTEGER NOT NULL REFERENCES products(id),
        quantity   INTEGER NOT NULL DEFAULT 1,
        price_paid REAL    NOT NULL,
        created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    )`);

    // ── SEED: gold settings ───────────────────────────────
    db.run(`INSERT OR IGNORE INTO gold_settings (id, markup_pct) VALUES (1, 5.0)`);

    // ── SEED: admin account ───────────────────────────────
    const adminHash = bcrypt.hashSync('Admin@1234', 12);
    db.run(
        `INSERT OR IGNORE INTO users (email, password_hash, role) VALUES (?, ?, 'admin')`,
        ['admin@gabjewels.com', adminHash]
    );

    // ── SEED: demo customer ───────────────────────────────
    const demoHash = bcrypt.hashSync('1234', 10);
    db.run(
        `INSERT OR IGNORE INTO users (email, password_hash) VALUES (?, ?)`,
        ['demo@gabjewels.com', demoHash]
    );

    // ── SEED: sample products ─────────────────────────────
    const sampleProducts = [
        ['Classic Gold Bangle',    'Bracelets', 2800, 12.5, '22K', 15],
        ['Diamond Solitaire Ring', 'Rings',     8500,  4.2, '18K',  6],
        ['Temple Necklace Set',    'Necklaces', 5200, 22.8, '22K',  3],
        ['Twisted Hoop Earrings',  'Earrings',   950,  3.1, '22K', 20],
        ['Men Kada Bracelet',      'Bracelets', 3100, 18.0, '22K',  8],
    ];
    const stmt = db.prepare(
        `INSERT OR IGNORE INTO products
            (name, category, price_base, gold_weight, purity, stock_count)
         VALUES (?, ?, ?, ?, ?, ?)`
    );
    sampleProducts.forEach(p => stmt.run(...p));
    stmt.finalize();

    console.log('✦ Database schema ready.');
});

module.exports = db;
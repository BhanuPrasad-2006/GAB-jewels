# 💍 GAB Jewels — Online Jewellery Store

A web storefront for a jewellery business, with prices tied to the **live gold rate**. Customers can browse collections, view products, add to cart and check out, or book gold in advance at today's rate. Admins get a separate panel to manage products, users and the gold-price markup.

**Stack:** HTML · CSS · JavaScript · Node.js / Express · SQLite

---

## ✨ Features

**Storefront**
- Home page, men's / women's / kids' collections and product detail pages
- Cart, secure checkout and order confirmation
- **Advance gold buy** — reserve gold by metal and quantity at the current rate
- Contact page and account settings

**Live gold pricing**
- The server fetches the gold rate from GoldAPI twice a day (scheduled job) and serves it at `/api/rates`
- Prices follow `gold weight × rate per gram + making charges + GST`
- Admin can apply a markup or override the live price

**Admin panel** (`/pages/admin/`)
- Dashboard, product management, user management, gold settings and activity logs

**Security**
- Passwords hashed with bcrypt; JWT sessions
- Helmet headers, rate limiting, input validation and XSS sanitisation
- Phone OTP via Fast2SMS

## 🚀 Running locally

```bash
git clone https://github.com/BhanuPrasad-2006/GAB-jewels.git
cd GAB-jewels/server
npm install
cp .env.example .env      # then fill in your own keys
node server.js
```

Open http://localhost:3000. The SQLite database and sample products are created on first run.

## 📁 Project structure

```
GAB-jewels/
├── public/            Storefront and admin pages (HTML, CSS, JS)
│   ├── pages/         Collections, cart, checkout, advance buy, settings
│   └── pages/admin/   Admin dashboard, products, users, gold settings, logs
└── server/
    ├── server.js      Express server, live gold-rate job, static hosting
    ├── database.js    SQLite schema and seed data
    └── .env.example   Environment variables to configure
```

## 🚧 Status

The storefront pages and live gold-rate service are in place. The account (login, register, OTP) and product APIs that the pages call are still being wired into the server.

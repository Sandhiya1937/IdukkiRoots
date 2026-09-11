# Idukki Roots E-Commerce - Lite Edition

A lightweight, zero-cost initial deployment e-commerce platform built specifically for Idukki Roots.

## ⚠️ IMPORTANT: TEST / INITIAL DEPLOYMENT LIMITATIONS

This application is designed specifically for a **Render Free Web Service** deployment using **SQLite** to achieve zero hosting costs. 

### Ephemeral Storage Warning
Render Free Web Services use an **ephemeral filesystem**. This means that **every time the server restarts or a new deployment is triggered, all local file changes are permanently deleted.**

Because this version uses local SQLite databases and local file uploads:
- **Database records** (new users, orders, settings changes) will be lost on restart.
- **Payment screenshots** (uploaded UPI proofs) will be lost on restart.

### Future Migration
The codebase has been specifically architected with a database abstraction layer (`src/db/db.js` and repositories) and a file storage abstraction (`src/services/storage.js`). 
When you are ready for a persistent **Production Deployment**, you must:
1. Migrate the database connection from SQLite to PostgreSQL.
2. Migrate the storage service from local `multer` disk storage to an external object storage like AWS S3, Cloudinary, or Supabase Storage.

## Features

- **Frontend**: Vanilla HTML5, CSS3, JavaScript. Clean, modern, "wow" aesthetic design.
- **Backend**: Node.js & Express.
- **Database**: SQLite with strict parameterized queries.
- **Payments**: Manual UPI with UTR validation and screenshot upload (No paid gateways).
- **Security**: JWT authentication, bcrypt password hashing, rate limiting, and helmet HTTP headers.
- **Admin Panel**: Secure dashboard for verifying payments, updating settings, and managing orders.

## Local Development

1. Clone the repository.
2. Install dependencies: `npm install`
3. Copy the environment file: `cp .env.example .env`
4. Start the server: `npm run dev` (or `node index.js`)
5. Open `http://localhost:5000`

**Default Admin Credentials:**
- Email: `admin@idukkiroots.in`
- Password: `Admin@123`

## Documentation

- [Render Deployment Guide](RENDER_DEPLOYMENT_GUIDE.md)
- [Security Architecture](SECURITY.md)
- [Testing Checklist](TESTING_CHECKLIST.md)

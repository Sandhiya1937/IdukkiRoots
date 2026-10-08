

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

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const { getDb } = require('./src/db/db');

// Import API routes
const authRoutes = require('./src/routes/auth');
const productRoutes = require('./src/routes/products');
const orderRoutes = require('./src/routes/orders');
const adminRoutes = require('./src/routes/admin');
const cartRoutes = require('./src/routes/cart');
const wishlistRoutes = require('./src/routes/wishlist');
const settingsRoutes = require('./src/routes/settings');

const app = express();
const PORT = process.env.PORT || 5000;

// Render terminates HTTPS at one proxy; trust it so rate limits see each visitor's IP, not the proxy's
if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
}

// Security Middlewares
app.use(helmet({
    contentSecurityPolicy: false // Disable CSP for vanilla JS frontend flexibility
}));

const corsOptions = {
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files (Frontend & Uploads)
const distPath = path.join(__dirname, 'frontend', 'dist');
const publicPath = path.join(__dirname, 'public');

app.use(express.static(distPath));
// redirect:false so "/admin" reaches the React admin instead of redirecting to the legacy public/admin/ page
app.use(express.static(publicPath, { redirect: false }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health Check Endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', database: 'postgresql' });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/settings', settingsRoutes);

// 404 Handler for APIs
app.use('/api', (req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
});

// Catch-all route to serve the React SPA
app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(distPath, 'index.html'), (err) => {
        if (err) res.sendFile(path.join(publicPath, 'index.html'));
    });
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    const status = err.status || 500;
    res.status(status).json({
        error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message
    });
});

// Start Server & Initialize PostgreSQL DB
async function startServer() {
    try {
        await getDb(); // Connect & initialize PostgreSQL tables & Admin from .env

        app.listen(PORT, () => {
            console.log(`Server is running on http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();

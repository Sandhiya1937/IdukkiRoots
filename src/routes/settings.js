const express = require('express');
const router = express.Router();
const { getDb } = require('../db/db');

// Public store settings (shipping rules, UPI details, contact info) used by the storefront
router.get('/', async (req, res) => {
    try {
        const pool = await getDb();
        const settingsRes = await pool.query('SELECT key, value FROM settings');

        const settings = {};
        settingsRes.rows.forEach(row => {
            settings[row.key] = row.value;
        });

        res.json(settings);
    } catch (error) {
        console.error('Fetch settings error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Get active banners
router.get('/banners', async (req, res) => {
    try {
        const pool = await getDb();
        const banners = await pool.query('SELECT * FROM banners WHERE is_active = TRUE ORDER BY display_order ASC, id DESC');
        res.json(banners.rows);
    } catch (error) {
        console.error('Fetch banners error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { getDb } = require('../db/db');
const { authenticateToken } = require('../middlewares/auth');

// Get user wishlist
router.get('/', authenticateToken, async (req, res) => {
    try {
        const pool = await getDb();
        const wishlistRes = await pool.query(`
            SELECT 
                w.id as wishlist_id,
                w.product_id,
                p.name, p.slug, p.custom_tag, p.custom_discount_text, p.rating_avg, p.rating_count,
                v.id as variant_id, v.price, v.mrp, v.stock, v.weight_value, v.weight_unit,
                i.image_url
            FROM wishlists w
            JOIN products p ON w.product_id = p.id
            LEFT JOIN LATERAL (
                SELECT * FROM product_variants pv WHERE pv.product_id = p.id ORDER BY pv.price ASC LIMIT 1
            ) v ON true
            LEFT JOIN LATERAL (
                SELECT image_url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.is_primary DESC LIMIT 1
            ) i ON true
            WHERE w.user_id = $1
            ORDER BY w.created_at DESC
        `, [req.user.id]);

        res.json(wishlistRes.rows);
    } catch (error) {
        console.error('Fetch wishlist error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Toggle product in wishlist (add/remove)
router.post('/toggle', authenticateToken, async (req, res) => {
    try {
        const { product_id } = req.body;
        if (!product_id) {
            return res.status(400).json({ error: 'Product ID is required.' });
        }

        const pool = await getDb();
        const existing = await pool.query(
            'SELECT id FROM wishlists WHERE user_id = $1 AND product_id = $2',
            [req.user.id, product_id]
        );

        if (existing.rowCount > 0) {
            await pool.query('DELETE FROM wishlists WHERE id = $1', [existing.rows[0].id]);
            return res.json({ added: false, message: 'Removed from wishlist.' });
        } else {
            await pool.query(
                'INSERT INTO wishlists (user_id, product_id) VALUES ($1, $2)',
                [req.user.id, product_id]
            );
            return res.json({ added: true, message: 'Added to wishlist.' });
        }
    } catch (error) {
        console.error('Wishlist toggle error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Remove item from wishlist
router.delete('/:productId', authenticateToken, async (req, res) => {
    try {
        const pool = await getDb();
        await pool.query(
            'DELETE FROM wishlists WHERE user_id = $1 AND product_id = $2',
            [req.user.id, req.params.productId]
        );
        res.json({ success: true, message: 'Removed from wishlist.' });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error.' });
    }
});

module.exports = router;

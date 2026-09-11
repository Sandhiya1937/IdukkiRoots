const express = require('express');
const router = express.Router();
const { getDb } = require('../db/db');
const { authenticateToken } = require('../middlewares/auth');

const MAX_QTY_PER_ITEM = 10;

// NUMERIC columns come back as strings ("250.00"), so normalise them for the frontend
function formatCartItem(item) {
    const weight = item.weight_value != null ? parseFloat(item.weight_value) : '';
    return {
        variant_id: item.variant_id,
        product_id: item.product_id,
        product_name: item.product_name,
        variant_details: `${weight}${item.weight_unit || ''}`,
        weight_value: weight,
        weight_unit: item.weight_unit,
        price: parseFloat(item.price),
        mrp: parseFloat(item.mrp),
        stock: item.stock,
        image: item.image || '',
        image_url: item.image || '',
        quantity: item.quantity
    };
}

async function fetchCartItems(db, cartId) {
    const itemsRes = await db.query(`
        SELECT
            ci.variant_id,
            ci.quantity,
            pv.weight_value,
            pv.weight_unit,
            pv.price,
            pv.mrp,
            pv.stock,
            p.id as product_id,
            p.name as product_name,
            (SELECT image_url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.is_primary DESC LIMIT 1) as image
        FROM cart_items ci
        JOIN product_variants pv ON ci.variant_id = pv.id
        JOIN products p ON pv.product_id = p.id
        WHERE ci.cart_id = $1
        ORDER BY ci.created_at ASC
    `, [cartId]);
    return itemsRes.rows.map(formatCartItem);
}

async function getOrCreateCartId(db, userId) {
    const cartRes = await db.query(
        `INSERT INTO carts (user_id) VALUES ($1)
         ON CONFLICT (user_id) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
         RETURNING id`,
        [userId]
    );
    return cartRes.rows[0].id;
}

// Get cart for logged in user
router.get('/', authenticateToken, async (req, res) => {
    try {
        const pool = await getDb();

        const cartRes = await pool.query('SELECT id FROM carts WHERE user_id = $1', [req.user.id]);
        if (cartRes.rowCount === 0) {
            return res.json([]);
        }

        res.json(await fetchCartItems(pool, cartRes.rows[0].id));
    } catch (error) {
        console.error('Fetch cart error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Sync local (guest) cart into the user's PostgreSQL cart
router.post('/sync', authenticateToken, async (req, res) => {
    const pool = await getDb();
    const client = await pool.connect();
    try {
        const { localCart } = req.body;

        await client.query('BEGIN');
        const cartId = await getOrCreateCartId(client, req.user.id);

        if (Array.isArray(localCart)) {
            for (const item of localCart) {
                const variantId = parseInt(item.variant_id, 10);
                const qty = parseInt(item.quantity, 10);
                if (!variantId || !qty || qty < 1) continue;

                // Skip variants that were removed since the guest added them
                const variantRes = await client.query('SELECT id FROM product_variants WHERE id = $1', [variantId]);
                if (variantRes.rowCount === 0) continue;

                await client.query(
                    `INSERT INTO cart_items (cart_id, variant_id, quantity) VALUES ($1, $2, $3)
                     ON CONFLICT (cart_id, variant_id)
                     DO UPDATE SET quantity = LEAST(cart_items.quantity + EXCLUDED.quantity, $4)`,
                    [cartId, variantId, Math.min(qty, MAX_QTY_PER_ITEM), MAX_QTY_PER_ITEM]
                );
            }
        }

        await client.query('COMMIT');
        res.json(await fetchCartItems(client, cartId));
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Sync cart error:', error);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
});

// Set the quantity of a single item (0 removes it)
router.post('/', authenticateToken, async (req, res) => {
    try {
        const variantId = parseInt(req.body.variant_id, 10);
        const requested = parseInt(req.body.quantity, 10);

        if (!variantId || isNaN(requested)) {
            return res.status(400).json({ error: 'Variant ID and quantity required' });
        }

        const pool = await getDb();
        let quantity = Math.min(requested, MAX_QTY_PER_ITEM);
        let capped = false;

        if (quantity > 0) {
            const variantRes = await pool.query(
                `SELECT v.stock FROM product_variants v
                 JOIN products p ON p.id = v.product_id
                 WHERE v.id = $1 AND p.is_active = TRUE`,
                [variantId]
            );
            if (variantRes.rowCount === 0) {
                return res.status(404).json({ error: 'This product is no longer available.' });
            }
            const stock = variantRes.rows[0].stock;
            if (stock <= 0) {
                return res.status(400).json({ error: 'This item is out of stock.' });
            }
            if (quantity > stock) {
                quantity = stock;
                capped = true;
            }
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const cartId = await getOrCreateCartId(client, req.user.id);

            if (quantity <= 0) {
                await client.query('DELETE FROM cart_items WHERE cart_id = $1 AND variant_id = $2', [cartId, variantId]);
            } else {
                await client.query(
                    `INSERT INTO cart_items (cart_id, variant_id, quantity) VALUES ($1, $2, $3)
                     ON CONFLICT (cart_id, variant_id) DO UPDATE SET quantity = EXCLUDED.quantity`,
                    [cartId, variantId, quantity]
                );
            }

            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }

        res.json({ success: true, quantity: Math.max(quantity, 0), capped });
    } catch (error) {
        console.error('Update cart item error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Clear entire cart
router.delete('/', authenticateToken, async (req, res) => {
    try {
        const pool = await getDb();
        const userId = req.user.id;

        const cartRes = await pool.query('SELECT id FROM carts WHERE user_id = $1', [userId]);
        if (cartRes.rowCount > 0) {
            await pool.query('DELETE FROM cart_items WHERE cart_id = $1', [cartRes.rows[0].id]);
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Clear cart error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;

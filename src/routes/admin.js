const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { getDb } = require('../db/db');
const { authenticateToken, requireAdmin } = require('../middlewares/auth');
const { upload } = require('../services/storage');

// Require Admin privileges for all routes in this file
router.use(authenticateToken);
router.use(requireAdmin);

// Dashboard Stats
router.get('/dashboard', async (req, res) => {
    try {
        const pool = await getDb();

        const ordersCount = await pool.query('SELECT COUNT(*)::int as count FROM orders');
        const pendingPayments = await pool.query('SELECT COUNT(*)::int as count FROM orders WHERE status = \'PAYMENT_VERIFICATION_PENDING\'');
        const salesSum = await pool.query('SELECT COALESCE(SUM(total), 0)::numeric(10,2) as sum FROM orders WHERE status != \'CANCELLED\' AND payment_status = \'PAID\'');
        const customersCount = await pool.query('SELECT COUNT(*)::int as count FROM users WHERE role = \'customer\'');
        const lowStockCount = await pool.query('SELECT COUNT(*)::int as count FROM product_variants WHERE stock < 10');

        res.json({
            total_orders: ordersCount.rows[0].count,
            pending_payments: pendingPayments.rows[0].count,
            total_sales: parseFloat(salesSum.rows[0].sum),
            total_customers: customersCount.rows[0].count,
            low_stock_items: lowStockCount.rows[0].count
        });
    } catch (error) {
        console.error('Admin dashboard stats error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Customers Management
router.get('/users', async (req, res) => {
    try {
        const pool = await getDb();
        const users = await pool.query('SELECT id, first_name, last_name, email, phone, role, google_id, avatar_url, created_at FROM users WHERE role = \'customer\' ORDER BY created_at DESC');
        res.json(users.rows);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error.' });
    }
});

router.put('/users/:id', async (req, res) => {
    try {
        const { first_name, email, phone, password } = req.body;
        const last_name = req.body.last_name || ''; // Google sign-ups may have no last name
        const userId = parseInt(req.params.id, 10);
        const pool = await getDb();

        if (!first_name || !email) {
            return res.status(400).json({ error: 'Name and email are required.' });
        }

        const existingEmail = await pool.query('SELECT id FROM users WHERE email = $1 AND id != $2', [email.toLowerCase().trim(), userId]);
        if (existingEmail.rowCount > 0) {
            return res.status(409).json({ error: 'Email already in use by another user.' });
        }

        if (password && password.length >= 6) {
            const passwordHash = await bcrypt.hash(password, 10);
            await pool.query(
                'UPDATE users SET first_name = $1, last_name = $2, email = $3, phone = $4, password_hash = $5 WHERE id = $6',
                [first_name.trim(), last_name.trim(), email.toLowerCase().trim(), phone ? phone.trim() : null, passwordHash, userId]
            );
        } else {
            await pool.query(
                'UPDATE users SET first_name = $1, last_name = $2, email = $3, phone = $4 WHERE id = $5',
                [first_name.trim(), last_name.trim(), email.toLowerCase().trim(), phone ? phone.trim() : null, userId]
            );
        }

        res.json({ message: 'User updated successfully.' });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Categories Management
router.get('/categories', async (req, res) => {
    try {
        const pool = await getDb();
        const categories = await pool.query('SELECT * FROM categories ORDER BY display_order ASC, id DESC');
        const subcategories = await pool.query('SELECT * FROM subcategories ORDER BY id DESC');

        const result = categories.rows.map(cat => ({
            ...cat,
            subcategories: subcategories.rows.filter(sc => sc.category_id === cat.id)
        }));

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error.' });
    }
});

router.post('/categories', async (req, res) => {
    try {
        const pool = await getDb();
        const { name, slug, description, image_url, service_charge } = req.body;
        if (!name || !slug) return res.status(400).json({ error: 'Name and slug are required' });

        const result = await pool.query(
            `INSERT INTO categories (name, slug, description, image_url, service_charge) 
             VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [name.trim(), slug.trim().toLowerCase(), description || '', image_url || '', parseFloat(service_charge || 0)]
        );

        res.json({ id: result.rows[0].id, success: true });
    } catch (error) {
        if (error.message && error.message.includes('unique constraint')) {
            return res.status(400).json({ error: 'Category slug already exists' });
        }
        res.status(500).json({ error: 'Internal server error.' });
    }
});

router.put('/categories/:id', async (req, res) => {
    try {
        const pool = await getDb();
        const { name, slug, description, image_url, service_charge } = req.body;
        const id = parseInt(req.params.id, 10);

        if (!name || !slug) return res.status(400).json({ error: 'Name and slug are required' });

        await pool.query(
            'UPDATE categories SET name = $1, slug = $2, description = $3, image_url = COALESCE($4, image_url), service_charge = $5 WHERE id = $6',
            [name.trim(), slug.trim().toLowerCase(), description || '', image_url || null, parseFloat(service_charge || 0), id]
        );
        res.json({ success: true, message: 'Category updated.' });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error.' });
    }
});

router.delete('/categories/:id', async (req, res) => {
    try {
        const pool = await getDb();
        await pool.query('DELETE FROM categories WHERE id = $1', [req.params.id]);
        res.json({ success: true, message: 'Category deleted.' });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Subcategory Endpoints
router.post('/subcategories', async (req, res) => {
    try {
        const pool = await getDb();
        const { category_id, name, slug, description } = req.body;
        if (!category_id || !name || !slug) return res.status(400).json({ error: 'Category ID, name and slug are required' });

        const result = await pool.query(
            'INSERT INTO subcategories (category_id, name, slug, description) VALUES ($1, $2, $3, $4) RETURNING id',
            [parseInt(category_id, 10), name.trim(), slug.trim().toLowerCase(), description || '']
        );

        res.json({ id: result.rows[0].id, success: true });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error.' });
    }
});

router.delete('/subcategories/:id', async (req, res) => {
    try {
        const pool = await getDb();
        await pool.query('DELETE FROM subcategories WHERE id = $1', [req.params.id]);
        res.json({ success: true, message: 'Subcategory deleted.' });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Products & Variants Management
router.get('/products/list', async (req, res) => {
    try {
        const pool = await getDb();
        const products = await pool.query(`
            SELECT 
                p.id, p.name, p.slug, p.is_active, p.custom_tag, p.custom_discount_text, p.rating_avg, p.rating_count,
                c.name as category_name,
                v.price, v.mrp, v.stock, v.id as variant_id
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN LATERAL (
                SELECT * FROM product_variants pv WHERE pv.product_id = p.id ORDER BY pv.id ASC LIMIT 1
            ) v ON true
            ORDER BY p.created_at DESC
        `);
        res.json(products.rows);
    } catch (error) {
        console.error('Admin list products error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

router.get('/products/:id', async (req, res) => {
    try {
        const pool = await getDb();
        const productRes = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
        if (productRes.rowCount === 0) return res.status(404).json({ error: 'Product not found.' });

        const variantsRes = await pool.query('SELECT * FROM product_variants WHERE product_id = $1 ORDER BY id ASC', [req.params.id]);
        const imagesRes = await pool.query('SELECT * FROM product_images WHERE product_id = $1 ORDER BY is_primary DESC, display_order ASC', [req.params.id]);

        res.json({
            ...productRes.rows[0],
            variants: variantsRes.rows,
            images: imagesRes.rows
        });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Create Product
router.post('/products', async (req, res) => {
    const pool = await getDb();
    const client = await pool.connect();
    try {
        const { category_id, subcategory_id, name, slug, description, custom_tag, custom_discount_text, variants, image_url } = req.body;
        
        if (!name || !slug || !variants || variants.length === 0) {
            return res.status(400).json({ error: 'Missing required fields or variants.' });
        }

        await client.query('BEGIN');

        const productRes = await client.query(
            `INSERT INTO products (category_id, subcategory_id, name, slug, description, custom_tag, custom_discount_text) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
            [category_id ? parseInt(category_id, 10) : null, subcategory_id ? parseInt(subcategory_id, 10) : null, name.trim(), slug.trim().toLowerCase(), description || '', custom_tag || null, custom_discount_text || null]
        );
        const productId = productRes.rows[0].id;

        let variantCounter = 0;
        for (const v of variants) {
            variantCounter++;
            const sku = v.sku || `SKU-${Date.now()}-${variantCounter}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
            const weightVal = parseFloat(v.weight_value) || 0;
            const mrpVal = parseFloat(v.mrp) || 0;
            const priceVal = parseFloat(v.price) || 0;
            const stockVal = Math.max(0, parseInt(v.stock, 10) || 0);

            await client.query(
                `INSERT INTO product_variants (product_id, sku, weight_value, weight_unit, mrp, price, stock) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [productId, sku, weightVal, v.weight_unit || 'g', mrpVal, priceVal, stockVal]
            );
        }

        if (image_url) {
            await client.query(
                'INSERT INTO product_images (product_id, image_url, is_primary) VALUES ($1, $2, TRUE)',
                [productId, image_url]
            );
        }

        await client.query('COMMIT');
        res.status(201).json({ message: 'Product created successfully.', product_id: productId });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Create product error:', error);
        if (error.message && error.message.includes('unique constraint')) {
            return res.status(400).json({ error: 'Slug or SKU already exists.' });
        }
        res.status(500).json({ error: 'Internal server error.' });
    } finally {
        client.release();
    }
});

// Update Product
router.put('/products/:id', async (req, res) => {
    const pool = await getDb();
    const client = await pool.connect();
    try {
        const productId = parseInt(req.params.id, 10);
        const { category_id, subcategory_id, name, slug, description, custom_tag, custom_discount_text, is_active, variants, image_url } = req.body;
        
        if (!name || !slug || !variants || variants.length === 0) {
            return res.status(400).json({ error: 'Missing required fields or variants.' });
        }

        await client.query('BEGIN');

        await client.query(
            `UPDATE products 
             SET category_id = $1, subcategory_id = $2, name = $3, slug = $4, description = $5, custom_tag = $6, custom_discount_text = $7, is_active = $8, updated_at = CURRENT_TIMESTAMP 
             WHERE id = $9`,
            [category_id ? parseInt(category_id, 10) : null, subcategory_id ? parseInt(subcategory_id, 10) : null, name.trim(), slug.trim().toLowerCase(), description || '', custom_tag || null, custom_discount_text || null, is_active !== undefined ? Boolean(is_active) : true, productId]
        );

        // Update variants
        const existingVariants = await client.query('SELECT id FROM product_variants WHERE product_id = $1', [productId]);
        const existingIds = existingVariants.rows.map(v => v.id);
        const incomingIds = variants.map(v => parseInt(v.id, 10)).filter(id => !isNaN(id));

        const idsToDelete = existingIds.filter(id => !incomingIds.includes(id));
        if (idsToDelete.length > 0) {
            await client.query(`DELETE FROM product_variants WHERE id = ANY($1::int[])`, [idsToDelete]);
        }

        let variantCounter = 0;
        for (const v of variants) {
            const vId = parseInt(v.id, 10);
            const weightVal = parseFloat(v.weight_value) || 0;
            const mrpVal = parseFloat(v.mrp) || 0;
            const priceVal = parseFloat(v.price) || 0;
            const stockVal = Math.max(0, parseInt(v.stock, 10) || 0);

            if (!isNaN(vId) && vId > 0 && existingIds.includes(vId)) {
                await client.query(
                    'UPDATE product_variants SET weight_value = $1, weight_unit = $2, mrp = $3, price = $4, stock = $5 WHERE id = $6',
                    [weightVal, v.weight_unit || 'g', mrpVal, priceVal, stockVal, vId]
                );
            } else {
                variantCounter++;
                const sku = v.sku || `SKU-${Date.now()}-${variantCounter}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
                await client.query(
                    'INSERT INTO product_variants (product_id, sku, weight_value, weight_unit, mrp, price, stock) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                    [productId, sku, weightVal, v.weight_unit || 'g', mrpVal, priceVal, stockVal]
                );
            }
        }

        if (image_url) {
            const imgCount = await client.query('SELECT COUNT(*)::int as count FROM product_images WHERE product_id = $1', [productId]);
            if (imgCount.rows[0].count === 0) {
                await client.query('INSERT INTO product_images (product_id, image_url, is_primary) VALUES ($1, $2, TRUE)', [productId, image_url]);
            }
        }

        await client.query('COMMIT');
        res.json({ message: 'Product updated successfully.' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Update product error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    } finally {
        client.release();
    }
});

// Product Images Upload
router.post('/products/:id/images', upload.array('images', 10), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No images uploaded.' });
        
        const productId = parseInt(req.params.id, 10);
        const pool = await getDb();

        const imageCountRes = await pool.query('SELECT COUNT(*)::int as cnt FROM product_images WHERE product_id = $1', [productId]);
        let isPrimary = imageCountRes.rows[0].cnt === 0;

        for (const file of req.files) {
            const imageUrl = `/uploads/${file.filename}`;
            await pool.query(
                'INSERT INTO product_images (product_id, image_url, is_primary) VALUES ($1, $2, $3)',
                [productId, imageUrl, isPrimary]
            );
            isPrimary = false;
        }

        res.json({ message: 'Images uploaded successfully.' });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Soft Delete Product
router.delete('/products/:id', async (req, res) => {
    try {
        const pool = await getDb();
        await pool.query('UPDATE products SET is_active = FALSE WHERE id = $1', [req.params.id]);
        res.json({ message: 'Product deactivated successfully.' });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Inventory Stock Update
router.put('/variants/:id/stock', async (req, res) => {
    try {
        const { stock, reason } = req.body;
        const variantId = parseInt(req.params.id, 10);
        const newStock = parseInt(stock, 10);

        if (isNaN(newStock) || newStock < 0) {
            return res.status(400).json({ error: 'Valid stock count required.' });
        }

        const pool = await getDb();
        const variantRes = await pool.query('SELECT stock FROM product_variants WHERE id = $1', [variantId]);
        if (variantRes.rowCount === 0) return res.status(404).json({ error: 'Variant not found.' });

        const currentStock = variantRes.rows[0].stock;
        const diff = newStock - currentStock;

        await pool.query('UPDATE product_variants SET stock = $1 WHERE id = $2', [newStock, variantId]);
        await pool.query('INSERT INTO inventory (variant_id, change_amount, reason) VALUES ($1, $2, $3)', [variantId, diff, reason || 'Admin Adjustment']);

        res.json({ message: 'Stock updated successfully.' });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Order Management Endpoints
router.get('/orders', async (req, res) => {
    try {
        const pool = await getDb();
        const ordersRes = await pool.query(`
            SELECT o.*, u.first_name, u.last_name, u.email, u.phone as customer_phone
            FROM orders o
            LEFT JOIN users u ON o.user_id = u.id
            ORDER BY o.created_at DESC
        `);

        const orders = ordersRes.rows;
        for (let order of orders) {
            if (typeof order.address_snapshot === 'string') {
                try { order.address_snapshot = JSON.parse(order.address_snapshot); } catch(e){}
            }
            const itemsRes = await pool.query('SELECT * FROM order_items WHERE order_id = $1', [order.id]);
            order.items = itemsRes.rows;
        }

        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error.' });
    }
});

router.put('/orders/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        const validStatuses = ['PENDING', 'PAYMENT_VERIFICATION_PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
        
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status.' });
        }

        const pool = await getDb();
        await pool.query('UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [status, req.params.id]);
        
        res.json({ message: 'Order status updated successfully.' });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Pending Payment Verification Requests
router.get('/payments/pending', async (req, res) => {
    try {
        const pool = await getDb();
        const paymentsRes = await pool.query(`
            SELECT p.*, o.order_number, o.total, u.first_name, u.last_name, u.email
            FROM payments p
            JOIN orders o ON p.order_id = o.id
            LEFT JOIN users u ON o.user_id = u.id
            WHERE p.status = 'PENDING'
            ORDER BY p.created_at DESC
        `);
        res.json(paymentsRes.rows);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error.' });
    }
});

router.post('/payments/verify', async (req, res) => {
    const pool = await getDb();
    const client = await pool.connect();
    try {
        const { payment_id, action, notes } = req.body; // action = 'APPROVE' or 'REJECT'
        
        const paymentRes = await client.query('SELECT * FROM payments WHERE id = $1', [payment_id]);
        if (paymentRes.rowCount === 0) return res.status(404).json({ error: 'Payment record not found.' });
        const payment = paymentRes.rows[0];

        await client.query('BEGIN');
        
        if (action === 'APPROVE') {
            await client.query(
                'UPDATE payments SET status = \'APPROVED\', verified_by = $1, verified_at = CURRENT_TIMESTAMP, notes = $2 WHERE id = $3',
                [req.user.id, notes || 'Approved by Admin', payment_id]
            );
            await client.query(
                'UPDATE orders SET status = \'PROCESSING\', payment_status = \'PAID\' WHERE id = $1',
                [payment.order_id]
            );
        } else if (action === 'REJECT') {
            await client.query(
                'UPDATE payments SET status = \'REJECTED\', verified_by = $1, verified_at = CURRENT_TIMESTAMP, notes = $2 WHERE id = $3',
                [req.user.id, notes || 'Rejected by Admin', payment_id]
            );
            // Back to awaiting payment so the customer can resubmit a proof from My Orders
            await client.query(
                'UPDATE orders SET status = \'PENDING\', payment_status = \'FAILED\' WHERE id = $1',
                [payment.order_id]
            );
        }

        await client.query('COMMIT');
        res.json({ message: `Payment ${action}D successfully.` });
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: 'Internal server error.' });
    } finally {
        client.release();
    }
});

// Cancellation & Refund Requests
router.get('/orders/cancellations', async (req, res) => {
    try {
        const pool = await getDb();
        const cancelsRes = await pool.query(`
            SELECT c.*, o.order_number, o.total, o.payment_method, u.first_name, u.last_name, u.email
            FROM order_cancellations c
            JOIN orders o ON c.order_id = o.id
            LEFT JOIN users u ON o.user_id = u.id
            WHERE c.status = 'PENDING'
            ORDER BY c.requested_at DESC
        `);
        res.json(cancelsRes.rows);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error.' });
    }
});

router.post('/orders/cancellations/:id/approve', async (req, res) => {
    const pool = await getDb();
    const client = await pool.connect();
    try {
        const cancelRes = await client.query('SELECT * FROM order_cancellations WHERE id = $1', [req.params.id]);
        if (cancelRes.rowCount === 0) return res.status(404).json({ error: 'Cancellation request not found.' });

        const cancelReq = cancelRes.rows[0];

        await client.query('BEGIN');
        await client.query('UPDATE order_cancellations SET status = \'APPROVED\', resolved_at = CURRENT_TIMESTAMP WHERE id = $1', [req.params.id]);
        await client.query('UPDATE orders SET status = \'CANCELLED\', payment_status = \'REFUNDED\' WHERE id = $1', [cancelReq.order_id]);
        
        // Restore stock
        const itemsRes = await client.query('SELECT variant_id, quantity FROM order_items WHERE order_id = $1', [cancelReq.order_id]);
        for (const item of itemsRes.rows) {
            if (item.variant_id) {
                await client.query('UPDATE product_variants SET stock = stock + $1 WHERE id = $2', [item.quantity, item.variant_id]);
            }
        }

        await client.query('COMMIT');
        res.json({ message: 'Cancellation request approved & order refunded.' });
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: 'Internal server error.' });
    } finally {
        client.release();
    }
});

router.post('/orders/cancellations/:id/reject', async (req, res) => {
    try {
        const pool = await getDb();
        await pool.query('UPDATE order_cancellations SET status = \'REJECTED\', resolved_at = CURRENT_TIMESTAMP WHERE id = $1', [req.params.id]);
        res.json({ message: 'Cancellation request rejected.' });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Coupons Engine Endpoints
router.get('/coupons', async (req, res) => {
    try {
        const pool = await getDb();
        const couponsRes = await pool.query('SELECT * FROM coupons ORDER BY id DESC');
        res.json(couponsRes.rows);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error.' });
    }
});

router.post('/coupons', async (req, res) => {
    try {
        const { code, discount_type, discount_value, min_order_amount, max_discount_amount, is_active } = req.body;
        if (!code || !discount_type || !discount_value) {
            return res.status(400).json({ error: 'Code, discount type, and value are required.' });
        }

        const pool = await getDb();
        const result = await pool.query(
            `INSERT INTO coupons (code, discount_type, discount_value, min_order_amount, max_discount_amount, is_active) 
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
            [code.trim().toUpperCase(), discount_type, parseFloat(discount_value), parseFloat(min_order_amount || 0), max_discount_amount ? parseFloat(max_discount_amount) : null, is_active !== undefined ? Boolean(is_active) : true]
        );

        res.status(201).json({ id: result.rows[0].id, message: 'Coupon created successfully.' });
    } catch (error) {
        if (error.message && error.message.includes('unique constraint')) {
            return res.status(400).json({ error: 'Coupon code already exists.' });
        }
        res.status(500).json({ error: 'Internal server error.' });
    }
});

router.delete('/coupons/:id', async (req, res) => {
    try {
        const pool = await getDb();
        await pool.query('DELETE FROM coupons WHERE id = $1', [req.params.id]);
        res.json({ message: 'Coupon deleted successfully.' });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Reviews Management
router.get('/reviews', async (req, res) => {
    try {
        const pool = await getDb();
        const reviews = await pool.query(`
            SELECT r.*, p.name as product_name 
            FROM reviews r
            JOIN products p ON r.product_id = p.id
            ORDER BY r.created_at DESC
        `);
        res.json(reviews.rows);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Keep the product's rating summary in line with its visible (APPROVED) reviews
async function recalcProductRating(pool, productId) {
    const aggRes = await pool.query(
        'SELECT COALESCE(AVG(rating), 0)::numeric(3,2) as avg, COUNT(id)::int as count FROM reviews WHERE product_id = $1 AND status = \'APPROVED\'',
        [productId]
    );
    const { avg, count } = aggRes.rows[0];
    await pool.query('UPDATE products SET rating_avg = $1, rating_count = $2 WHERE id = $3', [avg, count, productId]);
}

router.put('/reviews/:id', async (req, res) => {
    try {
        const pool = await getDb();
        const { user_name, rating, comment, status } = req.body;
        const result = await pool.query(
            'UPDATE reviews SET user_name = $1, rating = $2, comment = $3, status = $4 WHERE id = $5 RETURNING product_id',
            [user_name, rating, comment, status, req.params.id]
        );
        if (result.rowCount > 0) await recalcProductRating(pool, result.rows[0].product_id);
        res.json({ success: true, message: 'Review updated.' });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error.' });
    }
});

router.delete('/reviews/:id', async (req, res) => {
    try {
        const pool = await getDb();
        const result = await pool.query('DELETE FROM reviews WHERE id = $1 RETURNING product_id', [req.params.id]);
        if (result.rowCount > 0) await recalcProductRating(pool, result.rows[0].product_id);
        res.json({ success: true, message: 'Review deleted.' });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Banner Management
router.get('/banners', async (req, res) => {
    try {
        const pool = await getDb();
        const banners = await pool.query('SELECT * FROM banners ORDER BY display_order ASC, id DESC');
        res.json(banners.rows);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error.' });
    }
});

router.post('/banners', upload.array('images', 10), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No images uploaded.' });
        
        const pool = await getDb();
        const title = req.body.title || '';
        const subtitle = req.body.subtitle || '';
        const link_url = req.body.link_url || '';

        for (const file of req.files) {
            const imageUrl = `/uploads/${file.filename}`;
            await pool.query(
                'INSERT INTO banners (title, subtitle, image_url, link_url, is_active) VALUES ($1, $2, $3, $4, TRUE)',
                [title, subtitle, imageUrl, link_url]
            );
        }

        res.json({ message: `${req.files.length} Banner(s) uploaded successfully.` });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error.' });
    }
});

router.delete('/banners/:id', async (req, res) => {
    try {
        const pool = await getDb();
        await pool.query('DELETE FROM banners WHERE id = $1', [req.params.id]);
        res.json({ success: true, message: 'Banner deleted.' });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Settings Management
router.get('/settings', async (req, res) => {
    try {
        const pool = await getDb();
        const settingsRes = await pool.query('SELECT key, value, description FROM settings');
        const settingsObj = {};
        settingsRes.rows.forEach(row => settingsObj[row.key] = row.value);
        res.json(settingsObj);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error.' });
    }
});

router.post('/settings', async (req, res) => {
    const pool = await getDb();
    const client = await pool.connect();
    try {
        const { settings } = req.body;
        if (!settings || typeof settings !== 'object') {
            return res.status(400).json({ error: 'Invalid settings object.' });
        }

        await client.query('BEGIN');
        for (const [key, value] of Object.entries(settings)) {
            await client.query(
                `INSERT INTO settings (key, value) VALUES ($1, $2)
                 ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
                [key, String(value)]
            );
        }
        await client.query('COMMIT');

        res.json({ message: 'Settings updated successfully.' });
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: 'Internal server error.' });
    } finally {
        client.release();
    }
});

router.post('/settings/upload-qr', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No image uploaded.' });
        
        const imageUrl = `/uploads/${req.file.filename}`;
        const pool = await getDb();
        await pool.query(
            `INSERT INTO settings (key, value) VALUES ('payment_qr_url', $1)
             ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
            [imageUrl]
        );

        res.json({ message: 'QR Code uploaded successfully.', image_url: imageUrl });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error.' });
    }
});

module.exports = router;

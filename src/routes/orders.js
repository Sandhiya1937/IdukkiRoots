const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { getDb } = require('../db/db');
const { authenticateToken, optionalAuthenticateToken } = require('../middlewares/auth');
const { upload } = require('../services/storage');

function generateOrderNumber() {
    return 'IDK-' + Date.now().toString().slice(-6) + crypto.randomBytes(2).toString('hex').toUpperCase();
}

// Shipping rule from the settings table; the storefront mirrors it (frontend/src/api/index.js calcShipping)
async function calculateShipping(db, subtotal) {
    const settingsRes = await db.query(
        "SELECT key, value FROM settings WHERE key IN ('shipping_charge', 'free_shipping_threshold')"
    );
    const settings = {};
    settingsRes.rows.forEach(row => { settings[row.key] = row.value; });

    const fee = parseFloat(settings.shipping_charge) || 0;
    const threshold = parseFloat(settings.free_shipping_threshold) || 0;
    if (subtotal <= 0 || (threshold > 0 && subtotal >= threshold)) return 0;
    return fee;
}

// Validate & apply coupon endpoint
router.post('/validate-coupon', optionalAuthenticateToken, async (req, res) => {
    try {
        const { coupon_code, subtotal } = req.body;
        if (!coupon_code) return res.status(400).json({ error: 'Coupon code required.' });

        const pool = await getDb();
        const couponRes = await pool.query(
            'SELECT * FROM coupons WHERE code = $1 AND is_active = TRUE',
            [coupon_code.trim().toUpperCase()]
        );

        if (couponRes.rowCount === 0) {
            return res.status(404).json({ error: 'Invalid or expired coupon code.' });
        }

        const coupon = couponRes.rows[0];
        const currentSubtotal = parseFloat(subtotal || 0);

        if (currentSubtotal < parseFloat(coupon.min_order_amount)) {
            return res.status(400).json({
                error: `Minimum order value of ₹${coupon.min_order_amount} required for this coupon.`
            });
        }

        let discount = 0;
        if (coupon.discount_type === 'percentage') {
            discount = (currentSubtotal * parseFloat(coupon.discount_value)) / 100;
            if (coupon.max_discount_amount && discount > parseFloat(coupon.max_discount_amount)) {
                discount = parseFloat(coupon.max_discount_amount);
            }
        } else {
            discount = parseFloat(coupon.discount_value);
        }

        discount = Math.min(discount, currentSubtotal);

        res.json({
            valid: true,
            coupon_id: coupon.id,
            code: coupon.code,
            discount_type: coupon.discount_type,
            discount_value: parseFloat(coupon.discount_value),
            discount_amount: discount
        });
    } catch (error) {
        console.error('Validate coupon error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Checkout / Create Order
router.post('/', optionalAuthenticateToken, async (req, res) => {
    const pool = await getDb();
    const client = await pool.connect();

    try {
        const { items, address_id, guest_address, payment_method, coupon_code } = req.body;

        if (!Array.isArray(items) || items.length === 0 || (!address_id && !guest_address) || !payment_method) {
            return res.status(400).json({ error: 'Missing required checkout fields.' });
        }

        if (!['COD', 'UPI', 'ONLINE'].includes(payment_method)) {
            return res.status(400).json({ error: 'Invalid payment method.' });
        }

        await client.query('BEGIN');

        // Address resolution
        let address;
        if (req.user && address_id) {
            const addrRes = await client.query('SELECT * FROM addresses WHERE id = $1 AND user_id = $2', [address_id, req.user.id]);
            if (addrRes.rowCount === 0) throw new Error('Selected address not found.');
            address = addrRes.rows[0];
        } else if (guest_address) {
            if (!guest_address.full_name || !guest_address.phone || !guest_address.address_line1 || !guest_address.city || !guest_address.state || !guest_address.postal_code) {
                throw new Error('Incomplete delivery address.');
            }
            address = guest_address;
        } else {
            throw new Error('Valid address required.');
        }

        let subtotal = 0;
        const orderItems = [];

        // Validate items and stock
        for (const item of items) {
            // A zero/negative quantity would otherwise increase stock below
            const quantity = parseInt(item.quantity, 10);
            if (!item.variant_id || !Number.isInteger(quantity) || quantity < 1) {
                throw new Error('Invalid item quantity.');
            }

            const variantRes = await client.query(`
                SELECT v.*, p.name as product_name, p.is_active
                FROM product_variants v
                JOIN products p ON p.id = v.product_id
                WHERE v.id = $1
            `, [item.variant_id]);

            if (variantRes.rowCount === 0) throw new Error(`Product variant not found.`);
            const variant = variantRes.rows[0];

            if (!variant.is_active) {
                throw new Error(`"${variant.product_name}" is no longer available.`);
            }

            if (variant.stock < quantity) {
                throw new Error(`Insufficient stock for "${variant.product_name}". Only ${variant.stock} available.`);
            }

            const itemPrice = parseFloat(variant.price);
            subtotal += itemPrice * quantity;

            const weight = variant.weight_value != null ? parseFloat(variant.weight_value) : '';
            orderItems.push({
                variant_id: variant.id,
                product_name: variant.product_name,
                variant_details: `${weight}${variant.weight_unit || ''}`,
                price: itemPrice,
                quantity
            });

            // Decrement stock in PostgreSQL
            await client.query('UPDATE product_variants SET stock = stock - $1 WHERE id = $2', [quantity, variant.id]);
            await client.query('INSERT INTO inventory (variant_id, change_amount, reason) VALUES ($1, $2, $3)', [variant.id, -quantity, 'Customer Order']);
        }

        // Coupon calculation
        let discount = 0;
        let coupon_id = null;
        if (coupon_code) {
            const couponRes = await client.query('SELECT * FROM coupons WHERE code = $1 AND is_active = TRUE', [coupon_code.trim().toUpperCase()]);
            if (couponRes.rowCount > 0) {
                const coupon = couponRes.rows[0];
                if (subtotal >= parseFloat(coupon.min_order_amount)) {
                    if (coupon.discount_type === 'percentage') {
                        discount = (subtotal * parseFloat(coupon.discount_value)) / 100;
                        if (coupon.max_discount_amount && discount > parseFloat(coupon.max_discount_amount)) {
                            discount = parseFloat(coupon.max_discount_amount);
                        }
                    } else {
                        discount = parseFloat(coupon.discount_value);
                    }
                    discount = Math.min(discount, subtotal);
                    coupon_id = coupon.id;
                }
            }
        }

        const shipping_charge = await calculateShipping(client, subtotal);
        const service_charge = 0;
        const cod_charge = payment_method === 'COD' ? 0 : 0;
        const total = subtotal + shipping_charge + cod_charge + service_charge - discount;
        const orderNumber = generateOrderNumber();
        const userId = req.user ? req.user.id : null;
        const initialStatus = payment_method === 'COD' ? 'PROCESSING' : 'PENDING';
        const initialPaymentStatus = payment_method === 'COD' ? 'UNPAID' : (payment_method === 'ONLINE' ? 'PAID' : 'UNPAID');

        const orderRes = await client.query(`
            INSERT INTO orders (order_number, user_id, address_snapshot, subtotal, discount, shipping_charge, cod_charge, service_charge, total, status, payment_method, payment_status, coupon_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            RETURNING id
        `, [orderNumber, userId, JSON.stringify(address), subtotal, discount, shipping_charge, cod_charge, service_charge, total, initialStatus, payment_method, initialPaymentStatus, coupon_id]);

        const orderId = orderRes.rows[0].id;

        for (const oi of orderItems) {
            await client.query(`
                INSERT INTO order_items (order_id, variant_id, product_name, variant_details, price, quantity)
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [orderId, oi.variant_id, oi.product_name, oi.variant_details, oi.price, oi.quantity]);
        }

        if (coupon_id && userId) {
            await client.query('INSERT INTO coupon_usage (coupon_id, user_id, order_id) VALUES ($1, $2, $3)', [coupon_id, userId, orderId]);
        }

        // Clear cart if logged in
        if (userId) {
            const cartRes = await client.query('SELECT id FROM carts WHERE user_id = $1', [userId]);
            if (cartRes.rowCount > 0) {
                await client.query('DELETE FROM cart_items WHERE cart_id = $1', [cartRes.rows[0].id]);
            }
        }

        await client.query('COMMIT');

        res.status(201).json({
            message: 'Order placed successfully!',
            order_id: orderId,
            order_number: orderNumber,
            total: total,
            payment_method: payment_method
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Checkout error:', error);
        res.status(400).json({ error: error.message || 'Checkout failed.' });
    } finally {
        client.release();
    }
});

// Upload Payment Proof (UPI)
router.post('/:id/payment-proof', optionalAuthenticateToken, upload.single('screenshot'), async (req, res) => {
    try {
        const { utr_number } = req.body;
        const orderId = parseInt(req.params.id, 10);

        if (!utr_number || !utr_number.trim()) {
            return res.status(400).json({ error: 'UTR number is required.' });
        }

        const pool = await getDb();
        const orderRes = await pool.query('SELECT * FROM orders WHERE id = $1', [orderId]);

        if (orderRes.rowCount === 0) {
            return res.status(404).json({ error: 'Order not found.' });
        }

        const order = orderRes.rows[0];

        // Account orders only accept proof from their owner (or an admin); guest orders have no owner
        if (order.user_id && (!req.user || (req.user.id !== order.user_id && req.user.role !== 'admin'))) {
            return res.status(403).json({ error: 'You are not allowed to update this order.' });
        }

        if (order.payment_method !== 'UPI') {
            return res.status(400).json({ error: 'Payment proof is only needed for UPI orders.' });
        }

        if (order.status === 'CANCELLED' || order.payment_status === 'PAID') {
            return res.status(400).json({ error: 'This order does not need a payment proof.' });
        }

        const proofUrl = req.file ? `/uploads/${req.file.filename}` : null;

        await pool.query(
            `INSERT INTO payments (order_id, utr_number, proof_image_url, status)
             VALUES ($1, $2, $3, 'PENDING')`,
            [orderId, utr_number.trim(), proofUrl]
        );

        await pool.query(
            'UPDATE orders SET status = \'PAYMENT_VERIFICATION_PENDING\', payment_status = \'PENDING_VERIFICATION\' WHERE id = $1',
            [orderId]
        );

        res.json({ message: 'Payment submitted for verification. Order status updated.' });
    } catch (error) {
        console.error('Payment proof error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Get user orders list
router.get('/my-orders', authenticateToken, async (req, res) => {
    try {
        const pool = await getDb();
        const ordersRes = await pool.query(`
            SELECT o.*, oc.status as cancel_request_status, oc.requested_at as cancel_requested_at,
                   (SELECT pm.notes FROM payments pm WHERE pm.order_id = o.id ORDER BY pm.id DESC LIMIT 1) as payment_notes
            FROM orders o
            LEFT JOIN order_cancellations oc ON o.id = oc.order_id
            WHERE o.user_id = $1
            ORDER BY o.created_at DESC
        `, [req.user.id]);

        const orders = ordersRes.rows;

        for (let order of orders) {
            const itemsRes = await pool.query('SELECT * FROM order_items WHERE order_id = $1', [order.id]);
            order.items = itemsRes.rows;
            if (typeof order.address_snapshot === 'string') {
                try { order.address_snapshot = JSON.parse(order.address_snapshot); } catch(e){}
            }
        }

        res.json(orders);
    } catch (error) {
        console.error('Fetch my-orders error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Request order cancellation / return
router.post('/:id/cancel-request', authenticateToken, async (req, res) => {
    try {
        const { refund_gpay_number, reason } = req.body;
        const orderId = parseInt(req.params.id, 10);

        if (!refund_gpay_number) {
            return res.status(400).json({ error: 'GPay/UPI number required for refund processing.' });
        }

        const pool = await getDb();
        const orderRes = await pool.query('SELECT * FROM orders WHERE id = $1 AND user_id = $2', [orderId, req.user.id]);

        if (orderRes.rowCount === 0) {
            return res.status(404).json({ error: 'Order not found.' });
        }

        const order = orderRes.rows[0];
        if (['DELIVERED', 'CANCELLED'].includes(order.status)) {
            return res.status(400).json({ error: 'Order cannot be cancelled at this stage.' });
        }

        await pool.query(
            'INSERT INTO order_cancellations (order_id, refund_gpay_number, reason) VALUES ($1, $2, $3)',
            [orderId, refund_gpay_number.trim(), reason ? reason.trim() : 'Customer Cancellation']
        );

        res.json({ message: 'Cancellation request submitted successfully.' });
    } catch (error) {
        if (error.message && error.message.includes('unique constraint')) {
            return res.status(400).json({ error: 'Cancellation request already submitted for this order.' });
        }
        console.error('Cancel request error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Get single order details with tracking timeline
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const pool = await getDb();
        const orderId = parseInt(req.params.id, 10);

        const orderRes = await pool.query('SELECT * FROM orders WHERE id = $1 AND user_id = $2', [orderId, req.user.id]);

        if (orderRes.rowCount === 0) {
            return res.status(404).json({ error: 'Order not found.' });
        }

        const order = orderRes.rows[0];
        if (typeof order.address_snapshot === 'string') {
            try { order.address_snapshot = JSON.parse(order.address_snapshot); } catch(e){}
        }

        const itemsRes = await pool.query('SELECT * FROM order_items WHERE order_id = $1', [order.id]);
        const paymentRes = await pool.query('SELECT utr_number, proof_image_url, status, notes, created_at FROM payments WHERE order_id = $1 ORDER BY id DESC LIMIT 1', [order.id]);
        const cancelRes = await pool.query('SELECT * FROM order_cancellations WHERE order_id = $1', [order.id]);

        res.json({
            ...order,
            items: itemsRes.rows,
            payment: paymentRes.rows[0] || null,
            cancellation: cancelRes.rows[0] || null
        });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error.' });
    }
});

module.exports = router;

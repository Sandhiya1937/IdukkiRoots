const express = require('express');
const router = express.Router();
const { getDb } = require('../db/db');

// Get categories & subcategories
router.get('/categories/all', async (req, res) => {
    try {
        const pool = await getDb();
        const categoriesRes = await pool.query('SELECT * FROM categories ORDER BY display_order ASC, name ASC');
        const subcategoriesRes = await pool.query('SELECT * FROM subcategories ORDER BY name ASC');

        const categories = categoriesRes.rows.map(cat => ({
            ...cat,
            subcategories: subcategoriesRes.rows.filter(sub => sub.category_id === cat.id)
        }));

        res.json(categories);
    } catch (error) {
        console.error('Fetch categories error:', error);
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
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Get products with search, multi-filter & sorting
router.get('/', async (req, res) => {
    try {
        const pool = await getDb();
        const { q, category, subcategory, min_price, max_price, min_rating, in_stock, sort, limit, page } = req.query;

        let whereClause = ['p.is_active = TRUE'];
        let params = [];
        let paramIdx = 1;

        // Search query
        if (q && q.trim()) {
            whereClause.push(`(p.name ILIKE $${paramIdx} OR p.description ILIKE $${paramIdx} OR p.custom_tag ILIKE $${paramIdx} OR c.name ILIKE $${paramIdx})`);
            params.push(`%${q.trim()}%`);
            paramIdx++;
        }

        // Category filter (slug or id)
        if (category) {
            if (/^\d+$/.test(category)) {
                whereClause.push(`p.category_id = $${paramIdx}`);
                params.push(parseInt(category, 10));
            } else {
                whereClause.push(`c.slug = $${paramIdx}`);
                params.push(category);
            }
            paramIdx++;
        }

        // Subcategory filter (slug or id)
        if (subcategory) {
            if (/^\d+$/.test(subcategory)) {
                whereClause.push(`p.subcategory_id = $${paramIdx}`);
                params.push(parseInt(subcategory, 10));
            } else {
                whereClause.push(`sc.slug = $${paramIdx}`);
                params.push(subcategory);
            }
            paramIdx++;
        }

        // Price range filter
        if (min_price && !isNaN(parseFloat(min_price))) {
            whereClause.push(`v.price >= $${paramIdx}`);
            params.push(parseFloat(min_price));
            paramIdx++;
        }
        if (max_price && !isNaN(parseFloat(max_price))) {
            whereClause.push(`v.price <= $${paramIdx}`);
            params.push(parseFloat(max_price));
            paramIdx++;
        }

        // Rating filter
        if (min_rating && !isNaN(parseFloat(min_rating))) {
            whereClause.push(`p.rating_avg >= $${paramIdx}`);
            params.push(parseFloat(min_rating));
            paramIdx++;
        }

        // In Stock filter
        if (in_stock === 'true' || in_stock === '1') {
            whereClause.push(`v.stock > 0`);
        }

        // Sorting
        let orderBy = 'p.created_at DESC';
        if (sort === 'price_asc') {
            orderBy = 'v.price ASC';
        } else if (sort === 'price_desc') {
            orderBy = 'v.price DESC';
        } else if (sort === 'rating') {
            orderBy = 'p.rating_avg DESC, p.rating_count DESC';
        } else if (sort === 'popularity') {
            orderBy = 'p.rating_count DESC, p.created_at DESC';
        } else if (sort === 'newest') {
            orderBy = 'p.created_at DESC';
        }

        const querySql = `
            SELECT 
                p.id, p.name, p.slug, p.description, p.custom_tag, p.custom_discount_text, 
                p.rating_avg, p.rating_count, p.category_id, p.subcategory_id,
                c.name as category_name, c.slug as category_slug,
                sc.name as subcategory_name, sc.slug as subcategory_slug,
                v.id as variant_id, v.price, v.mrp, v.sku, v.stock, v.weight_value, v.weight_unit,
                i.image_url
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN subcategories sc ON p.subcategory_id = sc.id
            LEFT JOIN LATERAL (
                SELECT * FROM product_variants pv 
                WHERE pv.product_id = p.id 
                ORDER BY pv.id ASC LIMIT 1
            ) v ON true
            LEFT JOIN LATERAL (
                SELECT image_url FROM product_images pi 
                WHERE pi.product_id = p.id 
                ORDER BY pi.is_primary DESC, pi.display_order ASC LIMIT 1
            ) i ON true
            WHERE ${whereClause.join(' AND ')}
            ORDER BY ${orderBy}
        `;

        const result = await pool.query(querySql, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Fetch products error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Get single product by slug or ID
router.get('/:slug', async (req, res) => {
    try {
        const pool = await getDb();
        const param = req.params.slug;
        const isId = /^\d+$/.test(param);

        const productQuery = `
            SELECT p.*, 
                   c.name as category_name, c.slug as category_slug, c.service_charge as category_service_charge,
                   sc.name as subcategory_name, sc.slug as subcategory_slug
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN subcategories sc ON p.subcategory_id = sc.id
            WHERE ${isId ? 'p.id = $1' : 'p.slug = $1'} AND p.is_active = TRUE
        `;

        const productRes = await pool.query(productQuery, [isId ? parseInt(param, 10) : param]);

        if (productRes.rowCount === 0) {
            return res.status(404).json({ error: 'Product not found.' });
        }

        const product = productRes.rows[0];

        // Fetch variants
        const variantsRes = await pool.query(
            'SELECT * FROM product_variants WHERE product_id = $1 ORDER BY price ASC',
            [product.id]
        );

        // Fetch images
        const imagesRes = await pool.query(
            'SELECT * FROM product_images WHERE product_id = $1 ORDER BY is_primary DESC, display_order ASC',
            [product.id]
        );

        // Fetch related / recommended products (same category or top rated)
        const recsRes = await pool.query(`
            SELECT 
                p.id, p.name, p.slug, p.custom_tag, p.custom_discount_text, p.rating_avg, p.rating_count,
                c.name as category_name,
                v.id as variant_id, v.price, v.mrp, v.stock, v.weight_value, v.weight_unit,
                i.image_url
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN LATERAL (
                SELECT * FROM product_variants pv WHERE pv.product_id = p.id ORDER BY pv.id ASC LIMIT 1
            ) v ON true
            LEFT JOIN LATERAL (
                SELECT image_url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.is_primary DESC LIMIT 1
            ) i ON true
            WHERE p.id != $1 AND p.category_id = $2 AND p.is_active = TRUE
            ORDER BY p.rating_avg DESC, p.created_at DESC
            LIMIT 6
        `, [product.id, product.category_id || 0]);

        res.json({
            ...product,
            variants: variantsRes.rows,
            images: imagesRes.rows,
            recommendations: recsRes.rows
        });
    } catch (error) {
        console.error('Fetch product detail error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Get reviews for a product
router.get('/:id/reviews', async (req, res) => {
    try {
        const pool = await getDb();
        const reviews = await pool.query(
            'SELECT id, user_name, rating, comment, created_at FROM reviews WHERE product_id = $1 AND status = \'APPROVED\' ORDER BY created_at DESC',
            [req.params.id]
        );

        const aggregate = await pool.query(
            'SELECT COALESCE(AVG(rating), 0)::numeric(3,2) as average, COUNT(id)::int as count FROM reviews WHERE product_id = $1 AND status = \'APPROVED\'',
            [req.params.id]
        );

        res.json({
            reviews: reviews.rows,
            aggregate: aggregate.rows[0]
        });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Submit a review
router.post('/:id/reviews', async (req, res) => {
    try {
        const pool = await getDb();
        const { user_name, rating, comment } = req.body;
        const productId = parseInt(req.params.id, 10);

        if (!user_name || !rating || rating < 1 || rating > 5) {
            return res.status(400).json({ error: 'Invalid input. Name and a rating between 1 and 5 are required.' });
        }

        await pool.query(
            `INSERT INTO reviews (product_id, user_name, rating, comment, status) 
             VALUES ($1, $2, $3, $4, 'APPROVED')`,
            [productId, user_name.trim(), rating, comment ? comment.trim() : '']
        );

        // Recalculate product rating summary
        const aggRes = await pool.query(
            'SELECT COALESCE(AVG(rating), 0)::numeric(3,2) as avg, COUNT(id)::int as count FROM reviews WHERE product_id = $1 AND status = \'APPROVED\'',
            [productId]
        );

        const { avg, count } = aggRes.rows[0];
        await pool.query(
            'UPDATE products SET rating_avg = $1, rating_count = $2 WHERE id = $3',
            [avg, count, productId]
        );

        res.json({ success: true, message: 'Review submitted successfully.' });
    } catch (error) {
        console.error('Submit review error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

module.exports = router;

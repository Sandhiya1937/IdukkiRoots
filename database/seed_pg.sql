-- Seed data for IdukkiRoots PostgreSQL Database

-- Clear existing data if any
TRUNCATE TABLE coupon_usage, order_cancellations, payments, order_items, orders, cart_items, carts, wishlists, reviews, inventory, product_images, product_variants, products, subcategories, categories, coupons, banners, settings, addresses, users CASCADE;

-- Default Categories
INSERT INTO categories (id, name, slug, description, image_url, service_charge, display_order) VALUES
(1, 'Spices & Condiments', 'spices-condiments', 'Authentic fresh handpicked spices direct from the high ranges of Idukki.', '/uploads/category-spices.jpg', 0, 1),
(2, 'Tea & Coffee', 'tea-coffee', 'Single-origin High-range Green Tea, CTC Tea & Premium Arabica Coffee.', '/uploads/category-tea.jpg', 0, 2),
(3, 'Essential Oils', 'essential-oils', '100% Pure, steam-distilled natural essential oils & aromatic extracts.', '/uploads/category-oils.jpg', 0, 3),
(4, 'Nuts & Dry Fruits', 'nuts-dry-fruits', 'Premium Grade Cashews, Almonds, Dates & Dehydrated Fruits.', '/uploads/category-nuts.jpg', 0, 4),
(5, 'Herbal & Wellness', 'herbal-wellness', 'Natural Ayurvedic herbs, honey, and wellness products.', '/uploads/category-wellness.jpg', 0, 5)
ON CONFLICT (id) DO NOTHING;

-- Subcategories
INSERT INTO subcategories (id, category_id, name, slug, description) VALUES
(1, 1, 'Whole Spices', 'whole-spices', 'Unprocessed whole cardamom, pepper, cloves, cinnamon'),
(2, 1, 'Ground Spices', 'ground-spices', 'Freshly ground spice powders'),
(3, 2, 'Green & Black Tea', 'green-black-tea', 'Specialty loose leaf and orthodox teas'),
(4, 2, 'Artisanal Coffee', 'artisanal-coffee', 'Freshly roasted Idukki coffee beans and powder'),
(5, 3, 'Aromatherapy Oils', 'aromatherapy-oils', 'Therapeutic pure essential oils'),
(6, 4, 'Premium Cashews', 'premium-cashews', 'Jumbo Grade W180 & W240 Whole Cashews')
ON CONFLICT (id) DO NOTHING;

-- Products
INSERT INTO products (id, category_id, subcategory_id, name, slug, description, custom_tag, custom_discount_text, is_active, rating_avg, rating_count) VALUES
(1, 1, 1, 'Idukki Green Cardamom (8mm+ Jumbo)', 'idukki-green-cardamom-8mm', 'Harvested from the lush green hills of Idukki, Kerala. Known as the King of Spices, our 8mm+ Jumbo Green Cardamom features an intense aroma, vibrant green pods, and unbeatable flavor.', 'Bestseller', '25% OFF', TRUE, 4.9, 128),
(2, 1, 1, 'Malabar Black Pepper (Tellicherry Garbled Supreme)', 'malabar-black-pepper-tgse', 'Handpicked, sun-dried Tellicherry Garbled Extra Bold (TGEB) black pepper. Strong pungent flavor, rich essential oil content, and high piperine density.', 'Hot Deal', '15% OFF', TRUE, 4.8, 95),
(3, 1, 1, 'Whole Cloves (Handpicked Lal Pari Quality)', 'whole-cloves-handpicked', 'Premium grade Lal Pari whole cloves with rich oil content. Deep brown color, strong warm aroma, free from stems and headless cloves.', 'Top Rated', '10% OFF', TRUE, 4.7, 64),
(4, 1, 1, 'Cinnamon Bark (True Ceylon Grade)', 'cinnamon-bark-ceylon', '100% Organic Ceylon Cinnamon Bark (Quills). Sweet aroma, low coumarin content, ideal for wellness teas, baking, and cooking.', 'Organic', '20% OFF', TRUE, 4.9, 42),
(5, 2, 3, 'High Range Orthodox Black Tea', 'high-range-orthodox-black-tea', 'Single estate orthodox black tea leaves grown at an altitude of 5,000 ft in Munnar/Idukki. Rich golden liquor with a smooth floral finish.', 'Fresh Arrival', '12% OFF', TRUE, 4.6, 51),
(6, 3, 5, 'Pure Eucalyptus Essential Oil (Steam Distilled)', 'eucalyptus-essential-oil', '100% Pure Eucalyptus Globulus essential oil extracted via steam distillation. Excellent for congestion relief, aromatherapy, and muscle comfort.', 'Pure Natural', '30% OFF', TRUE, 4.8, 88),
(7, 4, 6, 'Jumbo Whole Cashews (W180 King Size)', 'jumbo-cashews-w180', 'Export grade extra-large white whole cashews (W180). Creamy texture, natural sweet nuttiness, rich in healthy fats and proteins.', 'Super Value', '18% OFF', TRUE, 4.9, 110),
(8, 5, NULL, 'Raw Wild Forest Honey', 'raw-wild-forest-honey', 'Unfiltered, unpasteurized natural honey collected from wild stingless bees in the deep Idukki evergreen forests.', 'Limited Edition', '10% OFF', TRUE, 5.0, 77)
ON CONFLICT (id) DO NOTHING;

-- Product Variants
INSERT INTO product_variants (id, product_id, sku, weight_value, weight_unit, mrp, price, stock) VALUES
(1, 1, 'CARD-8MM-100G', 100, 'g', 450.00, 340.00, 150),
(2, 1, 'CARD-8MM-250G', 250, 'g', 1100.00, 790.00, 100),
(3, 1, 'CARD-8MM-500G', 500, 'g', 2100.00, 1550.00, 60),

(4, 2, 'PEP-TGSE-250G', 250, 'g', 320.00, 265.00, 200),
(5, 2, 'PEP-TGSE-500G', 500, 'g', 620.00, 499.00, 120),
(6, 2, 'PEP-TGSE-1KG', 1, 'kg', 1200.00, 950.00, 50),

(7, 3, 'CLOVE-100G', 100, 'g', 240.00, 199.00, 90),
(8, 3, 'CLOVE-250G', 250, 'g', 580.00, 475.00, 70),

(9, 4, 'CIN-CEY-100G', 100, 'g', 290.00, 220.00, 85),
(10, 4, 'CIN-CEY-250G', 250, 'g', 690.00, 520.00, 40),

(11, 5, 'TEA-ORTH-250G', 250, 'g', 280.00, 230.00, 130),
(12, 5, 'TEA-ORTH-500G', 500, 'g', 540.00, 430.00, 95),

(13, 6, 'OIL-EUC-30ML', 30, 'ml', 350.00, 245.00, 180),
(14, 6, 'OIL-EUC-100ML', 100, 'ml', 890.00, 650.00, 75),

(15, 7, 'CASH-W180-250G', 250, 'g', 420.00, 350.00, 160),
(16, 7, 'CASH-W180-500G', 500, 'g', 820.00, 680.00, 110),

(17, 8, 'HON-WILD-500G', 500, 'g', 490.00, 430.00, 80)
ON CONFLICT (id) DO NOTHING;

-- Product Images
INSERT INTO product_images (product_id, image_url, is_primary, display_order) VALUES
(1, 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=800&q=80', TRUE, 1),
(2, 'https://images.unsplash.com/photo-1509358271058-acd22cc93898?auto=format&fit=crop&w=800&q=80', TRUE, 1),
(3, 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=800&q=80', TRUE, 1),
(4, 'https://images.unsplash.com/photo-1509358271058-acd22cc93898?auto=format&fit=crop&w=800&q=80', TRUE, 1),
(5, 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=800&q=80', TRUE, 1),
(6, 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=800&q=80', TRUE, 1),
(7, 'https://images.unsplash.com/photo-1543339308-43e59d6b73a6?auto=format&fit=crop&w=800&q=80', TRUE, 1),
(8, 'https://images.unsplash.com/photo-1587049352847-4a222e784d38?auto=format&fit=crop&w=800&q=80', TRUE, 1);

-- Coupons
INSERT INTO coupons (id, code, discount_type, discount_value, min_order_amount, max_discount_amount, is_active) VALUES
(1, 'WELCOME10', 'percentage', 10, 300, 200, TRUE),
(2, 'IDUKKI100', 'fixed', 100, 800, 100, TRUE),
(3, 'FRESH50', 'fixed', 50, 400, 50, TRUE)
ON CONFLICT (id) DO NOTHING;

-- Banners
INSERT INTO banners (id, title, subtitle, image_url, link_url, display_order, is_active) VALUES
(1, 'Direct From Idukki Farms', 'Authentic Green Cardamom, Pepper & Spices Harvested Fresh', 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=1600&q=80', '/products.html?category=spices-condiments', 1, TRUE),
(2, 'Single Origin High Range Teas', 'Hand-picked Whole Leaf Orthodox Tea from Munnar Hills', 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=1600&q=80', '/products.html?category=tea-coffee', 2, TRUE),
(3, 'Pure Essential Oils & Wellness', 'Steam distilled pure extracts for health, mind & body', 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=1600&q=80', '/products.html?category=essential-oils', 3, TRUE)
ON CONFLICT (id) DO NOTHING;

-- Settings
INSERT INTO settings (key, value, description) VALUES
('site_name', 'IdukkiRoots', 'Store Name'),
('support_email', 'support@idukkiroots.in', 'Customer Support Email'),
('support_phone', '+91 98765 43210', 'Customer Support Phone'),
('free_shipping_threshold', '500', 'Order amount threshold for free shipping'),
('shipping_charge', '0', 'Standard shipping fee'),
('service_charge', '0', 'Standard service charge'),
('payment_qr_url', '/uploads/sample_qr.png', 'UPI Payment QR Code Image Path')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

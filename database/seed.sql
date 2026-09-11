-- Insert initial settings
INSERT OR IGNORE INTO settings (key, value, description) VALUES 
('business_name', 'Idukki Roots', 'Name of the business'),
('business_address', 'Kailasanadu Post, Parathode, Idukki District, Kerala - 685553, India', 'Physical address'),
('business_phone', '+910000000000', 'Contact phone number'),
('business_email', 'info.idukkiroots@gmail.com', 'Contact email'),
('business_website', 'www.idukkiroots.in', 'Website URL'),
('upi_id', 'idukkiroots@upi', 'Business UPI ID for payments'),
('upi_qr_url', '', 'URL to the UPI QR Code image'),
('shipping_charge', '50', 'Default shipping charge for orders below threshold'),
('free_shipping_threshold', '500', 'Minimum order amount for free shipping'),
('cod_enabled', 'true', 'Enable Cash on Delivery'),
('cod_minimum', '100', 'Minimum order amount for COD'),
('cod_maximum', '5000', 'Maximum order amount for COD'),
('cod_charge', '0', 'Additional charge for choosing COD'),
('social_facebook', '', 'Facebook link'),
('social_instagram', '', 'Instagram link');

-- Insert a default category
INSERT OR IGNORE INTO categories (name, slug, description) VALUES ('Spices', 'spices', 'Fresh and authentic spices from Idukki');

-- Insert some default products
INSERT OR IGNORE INTO products (category_id, name, slug, description, is_active) VALUES
((SELECT id FROM categories WHERE slug = 'spices'), 'Cardamom', 'cardamom', 'Premium quality green cardamom pods.', 1),
((SELECT id FROM categories WHERE slug = 'spices'), 'Black Pepper', 'black-pepper', 'Organically grown black pepper.', 1);

-- Insert variants for the products
INSERT OR IGNORE INTO product_variants (product_id, sku, weight_value, weight_unit, mrp, price, stock) VALUES
((SELECT id FROM products WHERE slug = 'cardamom'), 'CARD-250G', 250, 'g', 1000, 950, 100),
((SELECT id FROM products WHERE slug = 'black-pepper'), 'BP-500G', 500, 'g', 600, 550, 150);

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { OAuth2Client } = require('google-auth-library');
const { getDb } = require('../db/db');
const { JWT_SECRET, authenticateToken } = require('../middlewares/auth');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Rate limiting for auth routes
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50,
    message: { error: 'Too many requests, please try again later.' }
});

// Only throttle the credential endpoints; /me, /addresses and /config are routine calls on every page
router.use(['/login', '/register', '/google'], authLimiter);

// Auth Config Endpoint (returns public OAuth client ID)
router.get('/config', (req, res) => {
    res.json({
        googleClientId: process.env.GOOGLE_CLIENT_ID || ''
    });
});

// User Registration
router.post('/register', async (req, res) => {
    try {
        const { email, password, first_name, phone } = req.body;
        const last_name = req.body.last_name || ''; // optional on the sign-up form

        if (!email || !password || !first_name) {
            return res.status(400).json({ error: 'Missing required fields.' });
        }

        const pool = await getDb();

        const existingEmail = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()]);
        if (existingEmail.rowCount > 0) {
            return res.status(409).json({ error: 'Email already registered.' });
        }

        if (phone) {
            const existingPhone = await pool.query('SELECT id FROM users WHERE phone = $1', [phone.trim()]);
            if (existingPhone.rowCount > 0) {
                return res.status(409).json({ error: 'Phone number already registered.' });
            }
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const result = await pool.query(
            `INSERT INTO users (email, password_hash, first_name, last_name, phone, role) 
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, email, first_name, last_name, role`,
            [email.toLowerCase().trim(), passwordHash, first_name.trim(), last_name.trim(), phone ? phone.trim() : null, 'customer']
        );

        const newUser = result.rows[0];

        const token = jwt.sign(
            { id: newUser.id, email: newUser.email, role: newUser.role, name: newUser.first_name },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({
            message: 'User registered successfully.',
            token,
            user: newUser
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// User Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required.' });
        }

        const pool = await getDb();
        const userRes = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
        const user = userRes.rows[0];

        if (!user || !user.password_hash) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role, name: user.first_name },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            message: 'Login successful.',
            token,
            user: {
                id: user.id,
                email: user.email,
                first_name: user.first_name,
                last_name: user.last_name,
                role: user.role,
                avatar_url: user.avatar_url
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Google OAuth Verification & Login Endpoint
router.post('/google', async (req, res) => {
    try {
        const { credential } = req.body;

        if (!credential) {
            return res.status(400).json({ error: 'Google authentication credential is required.' });
        }

        // Only trust identity data from a Google-signed ID token, never from the request body
        let payload;
        try {
            const ticket = await googleClient.verifyIdToken({
                idToken: credential,
                audience: process.env.GOOGLE_CLIENT_ID
            });
            payload = ticket.getPayload();
        } catch (err) {
            console.warn('Google token verification failed:', err.message);
            return res.status(401).json({ error: 'Invalid Google token.' });
        }

        if (!payload || !payload.email || !payload.email_verified) {
            return res.status(401).json({ error: 'Google account email is not verified.' });
        }

        const google_id = payload['sub'];
        const email = payload['email'];
        const first_name = payload['given_name'] || payload['name'] || 'Google User';
        const last_name = payload['family_name'] || '';
        const avatar_url = payload['picture'] || '';

        const pool = await getDb();

        // Check if user exists by google_id or email
        let userRes = await pool.query(
            'SELECT * FROM users WHERE google_id = $1 OR email = $2',
            [google_id, email.toLowerCase().trim()]
        );
        let user = userRes.rows[0];

        if (!user) {
            // Create user
            const insertRes = await pool.query(
                `INSERT INTO users (email, first_name, last_name, role, google_id, avatar_url)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 RETURNING id, email, first_name, last_name, role, avatar_url`,
                [email.toLowerCase().trim(), first_name, last_name, 'customer', google_id, avatar_url]
            );
            user = insertRes.rows[0];
        } else {
            // Update Google info if needed
            await pool.query(
                'UPDATE users SET google_id = $1, avatar_url = COALESCE($2, avatar_url) WHERE id = $3',
                [google_id, avatar_url, user.id]
            );
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role, name: user.first_name },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            message: 'Google login successful.',
            token,
            user: {
                id: user.id,
                email: user.email,
                first_name: user.first_name,
                last_name: user.last_name,
                role: user.role,
                avatar_url: avatar_url || user.avatar_url
            }
        });
    } catch (error) {
        console.error('Google OAuth error:', error);
        res.status(500).json({ error: 'Google login failed.' });
    }
});

// Get Current User Profile
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const pool = await getDb();
        const userRes = await pool.query(
            'SELECT id, email, first_name, last_name, phone, role, google_id, avatar_url, created_at FROM users WHERE id = $1',
            [req.user.id]
        );

        if (userRes.rowCount === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }

        res.json(userRes.rows[0]);
    } catch (error) {
        console.error('Fetch profile error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Update Profile
router.put('/me', authenticateToken, async (req, res) => {
    try {
        const { first_name, last_name, phone } = req.body;
        const pool = await getDb();
        
        await pool.query(
            'UPDATE users SET first_name = $1, last_name = $2, phone = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4',
            [first_name, last_name, phone, req.user.id]
        );
        
        res.json({ message: 'Profile updated successfully.' });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Address Management Endpoints
router.get('/addresses', authenticateToken, async (req, res) => {
    try {
        const pool = await getDb();
        const addresses = await pool.query(
            'SELECT * FROM addresses WHERE user_id = $1 ORDER BY is_default DESC, id DESC',
            [req.user.id]
        );
        res.json(addresses.rows);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error.' });
    }
});

router.post('/addresses', authenticateToken, async (req, res) => {
    try {
        const { full_name, email, phone, address_line1, address_line2, city, state, postal_code, is_default } = req.body;
        const pool = await getDb();
        
        // If set as default or first address, unset previous defaults
        const countRes = await pool.query('SELECT COUNT(*)::int as cnt FROM addresses WHERE user_id = $1', [req.user.id]);
        const shouldBeDefault = is_default || countRes.rows[0].cnt === 0;

        if (shouldBeDefault) {
            await pool.query('UPDATE addresses SET is_default = FALSE WHERE user_id = $1', [req.user.id]);
        }
        
        const result = await pool.query(
            `INSERT INTO addresses (user_id, full_name, email, phone, address_line1, address_line2, city, state, postal_code, is_default) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
            [req.user.id, full_name, email || null, phone, address_line1, address_line2 || '', city, state, postal_code, shouldBeDefault]
        );
        
        res.status(201).json({ message: 'Address added successfully.', id: result.rows[0].id });
    } catch (error) {
        console.error('Add address error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

router.put('/address/:id', authenticateToken, async (req, res) => {
    try {
        const { full_name, email, phone, address_line1, address_line2, city, state, postal_code, is_default } = req.body;
        
        if (!full_name || !phone || !address_line1 || !city || !state || !postal_code) {
            return res.status(400).json({ error: 'Required address fields missing.' });
        }
        
        const pool = await getDb();

        if (is_default) {
            await pool.query('UPDATE addresses SET is_default = FALSE WHERE user_id = $1', [req.user.id]);
        }

        const result = await pool.query(
            `UPDATE addresses 
             SET full_name = $1, email = $2, phone = $3, address_line1 = $4, address_line2 = $5, city = $6, state = $7, postal_code = $8, is_default = COALESCE($9, is_default) 
             WHERE id = $10 AND user_id = $11`,
            [full_name, email || null, phone, address_line1, address_line2 || '', city, state, postal_code, is_default, req.params.id, req.user.id]
        );
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Address not found or unauthorized.' });
        }

        res.json({ message: 'Address updated successfully.' });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error.' });
    }
});

router.delete('/address/:id', authenticateToken, async (req, res) => {
    try {
        const pool = await getDb();
        await pool.query('DELETE FROM addresses WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
        res.json({ message: 'Address deleted successfully.' });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error.' });
    }
});

module.exports = router;

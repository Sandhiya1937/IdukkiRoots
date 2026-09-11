# Security Architecture

The Idukki Roots E-Commerce platform implements several security measures to protect against common vulnerabilities.

## 1. SQL Injection (SQLi) Prevention
- All database queries utilize the `sqlite3` driver's parameterized queries (e.g., `db.run('... WHERE id = ?', [id])`).
- No string concatenation is used to build SQL queries anywhere in the codebase.

## 2. Cross-Site Scripting (XSS) Prevention
- The Vanilla JS frontend utilizes `textContent` when injecting user-generated content (like names or addresses) into the DOM, which automatically escapes HTML entities.
- `helmet` is installed in Express to set secure HTTP headers, mitigating many XSS vectors.

## 3. Insecure Direct Object Reference (IDOR) Protection
- All customer endpoints (e.g., fetching orders, saving addresses) explicitly verify `user_id = req.user.id` against the authenticated JWT token.
- A user cannot modify or view another user's cart, addresses, or orders.

## 4. Authentication & Authorization
- Passwords are never stored in plaintext. They are hashed using `bcrypt` with a salt rounds factor of 10.
- Authentication relies on stateless JWT tokens. 
- Role-based Access Control (RBAC) is implemented via the `requireAdmin` middleware. Admin APIs are isolated under `/api/admin/*`.

## 5. File Upload Security
- Payment screenshots are restricted to specific MIME types (`image/jpeg`, `image/png`, `image/webp`).
- A strict 5MB size limit is enforced by `multer`.
- Original filenames are discarded. Files are renamed using `crypto.randomBytes(16)` to prevent path traversal and arbitrary file execution.

## 6. Price Manipulation
- The frontend price is never trusted during checkout.
- The backend recalculates the total order value dynamically by querying the `product_variants` table in the database and applying valid coupons and settings.

## 7. Rate Limiting
- `express-rate-limit` is applied to `/api/auth/*` routes to prevent brute-force login attacks.

## 8. Data Leakage
- Custom Express error handlers are configured. In `production`, stack traces are never exposed to the client.

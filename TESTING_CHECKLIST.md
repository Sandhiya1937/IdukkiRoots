# Manual Testing Checklist

Before going live, please manually verify the following flows in your local environment.

## 1. Customer Flow
- [ ] **Registration:** Register a new user account.
- [ ] **Login:** Login with the newly created account.
- [ ] **Browse:** Visit the homepage and ensure products load.
- [ ] **Product Details:** Click a product, select a variant, and verify the price updates.
- [ ] **Cart:** Add items to the cart. Change quantity to 2, then to 0 (should remove).
- [ ] **Address:** Go to checkout and add a new delivery address.
- [ ] **Checkout (COD):** Select COD. Verify COD charges apply. Submit order.
- [ ] **Checkout (UPI):** Select UPI. Upload a valid test image. Submit order.
- [ ] **Order History:** Check the orders page to ensure the orders exist.

## 2. Admin Flow
- [ ] **Login:** Login as `admin@idukkiroots.in`.
- [ ] **Dashboard:** Check if stats (Total Orders, Sales) reflect the test orders.
- [ ] **Payment Verification:** Go to Pending Payments. View the uploaded test image. Click Approve or Reject.
- [ ] **Orders:** View all orders in the Orders tab and verify the status reflects the payment approval.

## 3. Security Tests
- [ ] **File Upload Bypass:** Try uploading a `.txt` file instead of an image on the UPI payment step (should fail).
- [ ] **SQL Injection:** Attempt to enter `' OR 1=1 --` into the login email field (should fail safely).
- [ ] **Authorization:** Try accessing `/api/admin/dashboard` while logged in as a normal customer (should receive 403 Forbidden).

## 4. UI/UX
- [ ] **Mobile Responsive:** Open developer tools and check how the site looks on mobile dimensions.
- [ ] **Toasts:** Verify success and error messages pop up correctly.

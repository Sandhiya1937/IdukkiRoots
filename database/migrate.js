const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('./database/idukkiroots.sqlite');

const query = `
  CREATE TABLE IF NOT EXISTS order_cancellations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL UNIQUE,
      refund_gpay_number TEXT NOT NULL,
      status TEXT DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'APPROVED', 'REJECTED')),
      requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      resolved_at DATETIME,
      FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
  );
`;

db.run(query, (err) => {
  if (err) throw err;
  console.log('order_cancellations table created successfully.');
});

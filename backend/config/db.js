// backend/config/db.js
// Central MySQL connection pool used by all controllers.
const mysql = require("mysql2/promise");
require("dotenv").config();

// A pool reuses database connections instead of opening a new one per query.
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});

// Test the connection once on startup so setup issues appear immediately.
pool
  .getConnection()
  .then((conn) => {
    console.log("MySQL Connected");
    conn.release();
  })
  .catch((err) => {
    console.error("MySQL connection failed:", err.message);
  });

module.exports = pool;

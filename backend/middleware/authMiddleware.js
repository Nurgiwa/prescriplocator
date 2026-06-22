// backend/middleware/authMiddleware.js
// Verifies JWTs before protected routes are allowed to run.
const jwt = require("jsonwebtoken");
require("dotenv").config();

function verifyToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  // Authorization headers are expected to look like: Bearer <token>.
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Access denied. No token provided." });
  }

  try {
    // Attach token claims so controllers can identify the current user.
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    res.status(403).json({ message: "Invalid or expired token." });
  }
}

module.exports = verifyToken;

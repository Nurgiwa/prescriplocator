// This runs before any protected route to verify the token

const jwt = require('jsonwebtoken');
require('dotenv').config();

function verifyToken(req, res, next) {
const authHeader = req.headers['authorization'];
const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

if (!token) {
return res.status(401).json({ message: 'Access denied. No token provided.' });
}

try {
const decoded = jwt.verify(token, process.env.JWT_SECRET);
req.user = decoded; // { id, role, full_name }
next();
} catch (err) {
res.status(403).json({ message: 'Invalid or expired token.' });
}
}

module.exports = verifyToken;

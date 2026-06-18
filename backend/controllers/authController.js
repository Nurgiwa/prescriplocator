const db = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// REGISTER
async function register(req, res) {
const { full_name, email, phone, password, role } = req.body;

// Basic validation
if (!full_name || !email || !password || !role) {
return res.status(400).json({ message: 'Please fill all required fields.' });
}

const allowedRoles = ['doctor', 'patient', 'pharmacist', 'admin'];
if (!allowedRoles.includes(role)) {
return res.status(400).json({ message: 'Invalid role.' });
}

try {
// Check if email already exists
const [existing] = await db.query(
'SELECT id FROM users WHERE email = ?', [email]
);
if (existing.length > 0) {
return res.status(409).json({ message: 'Email already registered.' });
}

// Hash the password
const hashedPassword = await bcrypt.hash(password, 10);

// Insert into users table
const [result] = await db.query(
'INSERT INTO users (full_name, email, phone, password, role) VALUES (?, ?, ?, ?, ?)',
[full_name, email, phone, hashedPassword, role]
);

const userId = result.insertId;

// If doctor, create a doctors row too
if (role === 'doctor') {
const { specialization } = req.body;
await db.query(
'INSERT INTO doctors (user_id, specialization) VALUES (?, ?)',
[userId, specialization || 'General Physician']
);
}

res.status(201).json({ message: 'Registration successful.' });

} catch (err) {
res.status(500).json({ message: 'Server error.', error: err.message });
}
}

// LOGIN
async function login(req, res) {
const { email, password } = req.body;

if (!email || !password) {
return res.status(400).json({ message: 'Email and password are required.' });
}

try {
// Find user by email
const [rows] = await db.query(
'SELECT * FROM users WHERE email = ?', [email]
);
if (rows.length === 0) {
return res.status(401).json({ message: 'Invalid email or password.' });
}

const user = rows[0];

// Compare password
const match = await bcrypt.compare(password, user.password);
if (!match) {
return res.status(401).json({ message: 'Invalid email or password.' });
}

// Sign JWT — expires in 8 hours
const token = jwt.sign(
{ id: user.id, role: user.role, full_name: user.full_name },
process.env.JWT_SECRET,
{ expiresIn: '8h' }
);

res.json({
message: 'Login successful.',
token,
user: {
id: user.id,
full_name: user.full_name,
email: user.email,
role: user.role
}
});

} catch (err) {
res.status(500).json({ message: 'Server error.', error: err.message });
}
}

module.exports = { register, login };

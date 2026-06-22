// backend/controllers/authController.js
// Handles user registration and login for all supported roles.
const db = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config();

// Register a new account and create any role-specific companion records.
async function register(req, res) {
  const { full_name, email, phone, password, role } = req.body;

  // Require the fields needed to create a login identity.
  if (!full_name || !email || !password || !role) {
    return res.status(400).json({ message: "Please fill all required fields." });
  }

  // Keep roles constrained to values the rest of the app understands.
  const allowedRoles = ["doctor", "patient", "pharmacist", "admin"];
  if (!allowedRoles.includes(role)) {
    return res.status(400).json({ message: "Invalid role." });
  }

  try {
    // Emails are used as login identifiers, so duplicates are blocked.
    const [existing] = await db.query("SELECT id FROM users WHERE email = ?", [
      email,
    ]);
    if (existing.length > 0) {
      return res.status(409).json({ message: "Email already registered." });
    }

    // Hash passwords before storing them; never save plaintext credentials.
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create the base user record shared by every role.
    const [result] = await db.query(
      "INSERT INTO users (full_name, email, phone, password, role) VALUES (?, ?, ?, ?, ?)",
      [full_name, email, phone, hashedPassword, role],
    );

    const userId = result.insertId;

    // Doctors need a row in the doctors table for prescription ownership.
    if (role === "doctor") {
      const { specialization } = req.body;
      await db.query(
        "INSERT INTO doctors (user_id, specialization) VALUES (?, ?)",
        [userId, specialization || "General Physician"],
      );
    }

    res.status(201).json({ message: "Registration successful." });
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
}

// Authenticate a user and return a JWT for protected API requests.
async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required." });
  }

  try {
    // Load the user record so bcrypt can compare the submitted password.
    const [rows] = await db.query("SELECT * FROM users WHERE email = ?", [
      email,
    ]);
    if (rows.length === 0) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const user = rows[0];

    // Compare the submitted password against the stored hash.
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    // The frontend stores this token and sends it on protected API calls.
    const token = jwt.sign(
      { id: user.id, role: user.role, full_name: user.full_name },
      process.env.JWT_SECRET,
      { expiresIn: "8h" },
    );

    // Return only the user fields the browser needs for navigation/display.
    res.json({
      message: "Login successful.",
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
}

module.exports = { register, login };

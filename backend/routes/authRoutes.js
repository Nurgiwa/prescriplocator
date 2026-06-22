// backend/routes/authRoutes.js
// Public authentication endpoints.
const express = require("express");
const router = express.Router();
const { register, login } = require("../controllers/authController");

// Account creation and login do not require an existing token.
router.post("/register", register);
router.post("/login", login);

module.exports = router;

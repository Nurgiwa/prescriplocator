// backend/routes/search.js
const express = require("express");
const router = express.Router();
const { findNearbyPharmacies } = require("../controllers/searchController");
const verifyToken = require("../middleware/authMiddleware");

router.post("/pharmacies", verifyToken, findNearbyPharmacies);

module.exports = router;

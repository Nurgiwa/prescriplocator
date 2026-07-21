// backend/routes/search.js
const express = require("express");
const router = express.Router();
const { findNearbyPharmacies, findNearestNode } = require("../controllers/searchController");
const verifyToken = require("../middleware/authMiddleware");

router.post("/pharmacies", verifyToken, findNearbyPharmacies);
router.post("/nearest-node", verifyToken, findNearestNode);

module.exports = router;

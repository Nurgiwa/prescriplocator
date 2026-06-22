// backend/routes/drugs.js
// Routes for searching and maintaining the drug catalogue.
const express = require("express");
const router = express.Router();
const { searchDrugs, addDrug } = require("../controllers/drugController");
const verifyToken = require("../middleware/authMiddleware");

// Drug lookup is protected because it supports logged-in workflows.
router.get("/search", verifyToken, searchDrugs);

// Adding drugs is also protected; role checks can be added here later.
router.post("/", verifyToken, addDrug);

module.exports = router;

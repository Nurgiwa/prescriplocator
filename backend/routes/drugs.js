// backend/routes/drugs.js
const express = require("express");
const router = express.Router();
const { searchDrugs, addDrug } = require("../controllers/drugController");
const verifyToken = require("../middleware/authMiddleware");

router.get("/search", verifyToken, searchDrugs);
router.post("/", verifyToken, addDrug);

module.exports = router;

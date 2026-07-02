// backend/routes/pharmacy.js
// Routes for pharmacist pharmacy management and inventory operations
const express = require("express");
const router = express.Router();
const {
  registerPharmacy,
  getMyPharmacy,
  getInventory,
  addToInventory,
  updateStock,
} = require("../controllers/pharmacyController");
const verifyToken = require("../middleware/authMiddleware");

// POST / - Register a new pharmacy for the authenticated pharmacist
router.post("/", verifyToken, registerPharmacy);
// GET /mine - Retrieve details of the authenticated pharmacist's pharmacy
router.get("/mine", verifyToken, getMyPharmacy);
// GET /inventory - Get all drugs in stock for the pharmacist's pharmacy
router.get("/inventory", verifyToken, getInventory);
// POST /inventory - Add a drug to inventory or update existing entry
router.post("/inventory", verifyToken, addToInventory);
// PUT /inventory/:id - Update stock quantity and price for a specific inventory item
router.put("/inventory/:id", verifyToken, updateStock);

module.exports = router;

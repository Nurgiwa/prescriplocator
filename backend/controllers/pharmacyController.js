// backend/controllers/pharmacyController.js
const db = require("../config/db");

// Register a pharmacy and link it to the logged-in pharmacist
// Validates required fields, ensures no duplicate pharmacy per pharmacist, and creates pharmacy + pharmacist link
async function registerPharmacy(req, res) {
  const userId = req.user.id;
  // Extract pharmacy details from request body
  const {
    name,
    address,
    latitude,
    longitude,
    opening_time,
    closing_time,
    phone,
  } = req.body;

  // Validate all required fields are present
  if (
    !name ||
    !address ||
    !latitude ||
    !longitude ||
    !opening_time ||
    !closing_time
  ) {
    return res.status(400).json({ message: "All fields are required." });
  }

  try {
    // Check pharmacist doesn't already have a pharmacy (one-to-one relationship)
    const [existing] = await db.query(
      "SELECT id FROM pharmacists WHERE user_id = ?",
      [userId],
    );
    if (existing.length > 0) {
      return res
        .status(409)
        .json({ message: "You already have a registered pharmacy." });
    }

    // Insert new pharmacy record into database
    const [result] = await db.query(
      `INSERT INTO pharmacies (name, address, latitude, longitude, opening_time, closing_time, phone)
VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        address,
        latitude,
        longitude,
        opening_time,
        closing_time,
        phone || null,
      ],
    );
    // Get the newly created pharmacy ID
    const pharmacyId = result.insertId;

    // Create pharmacist record linking user to their pharmacy
    await db.query(
      "INSERT INTO pharmacists (user_id, pharmacy_id) VALUES (?, ?)",
      [userId, pharmacyId],
    );

    // Return success response with new pharmacy ID
    res.status(201).json({
      message: "Pharmacy registered successfully.",
      pharmacy_id: pharmacyId,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
}

// Get the pharmacy belonging to the logged-in pharmacist
// Joins pharmacies and pharmacists tables to retrieve current user's pharmacy details
async function getMyPharmacy(req, res) {
  const userId = req.user.id;

  try {
    // Query pharmacy details linked to the authenticated user
    const [rows] = await db.query(
      `SELECT ph.*
FROM pharmacies ph
JOIN pharmacists pm ON ph.id = pm.pharmacy_id
WHERE pm.user_id = ?`,
      [userId],
    );

    // Return 404 if user has no associated pharmacy
    if (rows.length === 0) {
      return res.status(404).json({ message: "No pharmacy found." });
    }

    // Return pharmacy details
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
}

// Get inventory for the pharmacist's pharmacy
// Retrieves all drugs in stock with pricing and quantity information
async function getInventory(req, res) {
  const userId = req.user.id;

  try {
    // First, get the pharmacy ID associated with the authenticated pharmacist
    const [pharmRows] = await db.query(
      "SELECT pharmacy_id FROM pharmacists WHERE user_id = ?",
      [userId],
    );
    if (pharmRows.length === 0) {
      return res
        .status(404)
        .json({ message: "No pharmacy found for this pharmacist." });
    }
    const pharmacyId = pharmRows[0].pharmacy_id;

    // Query all inventory items for this pharmacy with drug details, sorted by name
    const [rows] = await db.query(
      `SELECT i.id, d.name, d.category, i.price, i.stock_qty, d.id AS drug_id
FROM inventory i
JOIN drugs d ON i.drug_id = d.id
WHERE i.pharmacy_id = ?
ORDER BY d.name`,
      [pharmacyId],
    );

    // Return inventory list
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
}

// Add a drug to inventory or update stock if it already exists
// Uses UPSERT pattern: inserts new inventory entry or updates existing one if drug already stocked
async function addToInventory(req, res) {
  const userId = req.user.id;
  // Extract drug inventory details from request
  const { drug_id, price, stock_qty } = req.body;

  // Validate required fields (stock_qty can be 0, so check for undefined)
  if (!drug_id || price === undefined || stock_qty === undefined) {
    return res
      .status(400)
      .json({ message: "drug_id, price and stock_qty are required." });
  }

  try {
    // Get pharmacy ID for the authenticated pharmacist
    const [pharmRows] = await db.query(
      "SELECT pharmacy_id FROM pharmacists WHERE user_id = ?",
      [userId],
    );
    if (pharmRows.length === 0) {
      return res.status(404).json({ message: "No pharmacy found." });
    }
    const pharmacyId = pharmRows[0].pharmacy_id;

    // Insert new inventory record or update price/quantity if drug already exists in this pharmacy
    await db.query(
      `INSERT INTO inventory (pharmacy_id, drug_id, price, stock_qty)
VALUES (?, ?, ?, ?)
ON DUPLICATE KEY UPDATE price = VALUES(price), stock_qty = VALUES(stock_qty)`,
      [pharmacyId, drug_id, price, stock_qty],
    );

    res.json({ message: "Inventory updated." });
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
}

// Update stock quantity and/or price for a specific inventory item
// Ensures the inventory item belongs to the pharmacist's pharmacy (prevents cross-pharmacy modifications)
async function updateStock(req, res) {
  const userId = req.user.id;
  // inventory item ID from route parameter
  const { id } = req.params;
  // Updated stock quantity and price from request body
  const { stock_qty, price } = req.body;

  try {
    // Get pharmacy ID for the authenticated pharmacist
    const [pharmRows] = await db.query(
      "SELECT pharmacy_id FROM pharmacists WHERE user_id = ?",
      [userId],
    );
    if (pharmRows.length === 0) {
      return res.status(404).json({ message: "No pharmacy found." });
    }

    // Update inventory only if it belongs to this pharmacist's pharmacy (security check)
    await db.query(
      "UPDATE inventory SET stock_qty = ?, price = ? WHERE id = ? AND pharmacy_id = ?",
      [stock_qty, price, id, pharmRows[0].pharmacy_id],
    );

    res.json({ message: "Stock updated." });
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
}

module.exports = {
  registerPharmacy,
  getMyPharmacy,
  getInventory,
  addToInventory,
  updateStock,
};

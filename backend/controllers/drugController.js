// backend/controllers/drugController.js
// Drug catalogue actions used by the prescription form.
const db = require("../config/db");

// Search drugs by partial name for the doctor's autocomplete dropdown.
async function searchDrugs(req, res) {
  const q = req.query.q || "";
  try {
    // Parameter binding keeps the search safe while still allowing LIKE.
    const [rows] = await db.query(
      "SELECT id, name, category FROM drugs WHERE name LIKE ? LIMIT 10",
      [`%${q}%`],
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
}

// Add a new drug to the catalogue for seeding or future admin tools.
async function addDrug(req, res) {
  const { name, category } = req.body;
  if (!name) return res.status(400).json({ message: "Drug name is required." });

  try {
    // Category is optional, so empty values are stored as NULL.
    const [result] = await db.query(
      "INSERT INTO drugs (name, category) VALUES (?, ?)",
      [name, category || null],
    );
    res.status(201).json({ id: result.insertId, name, category });
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
}

module.exports = { searchDrugs, addDrug };

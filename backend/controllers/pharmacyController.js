// backend/controllers/pharmacyController.js
const db = require("../config/db");
const fetch = require("node-fetch");

// ── Geocode address using Nominatim (OpenStreetMap) — completely free ──
async function geocodeAddress(address) {
  const encoded = encodeURIComponent(address + ", Kaduna, Nigeria");
  const url = `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1`;

  try {
    const res = await fetch(url, {
      headers: {
        // Nominatim requires a User-Agent header identifying your app
        "User-Agent": "PrescripLocator/1.0 (student-project)",
      },
    });

    const data = await res.json();

    if (!data || data.length === 0) return null;

    return {
      latitude: parseFloat(data[0].lat),
      longitude: parseFloat(data[0].lon),
      formatted_address: data[0].display_name,
    };
  } catch (err) {
    console.error("Nominatim geocoding error:", err.message);
    return null;
  }
}

// ── Register pharmacy ──
// Pharmacist types name + address + hours only
// Coordinates are auto-detected via Nominatim
async function registerPharmacy(req, res) {
  const userId = req.user.id;
  const { name, address, opening_time, closing_time, phone } = req.body;

  if (!name || !address || !opening_time || !closing_time) {
    return res.status(400).json({
      message: "Name, address and opening hours are required.",
    });
  }

  try {
    // Check pharmacist doesn't already have a pharmacy
    const [existing] = await db.query(
      "SELECT id FROM pharmacists WHERE user_id = ?",
      [userId],
    );
    if (existing.length > 0) {
      return res.status(409).json({
        message: "You already have a registered pharmacy.",
      });
    }

    // Auto-detect coordinates from address using Nominatim
    const geo = await geocodeAddress(address);
    if (!geo) {
      return res.status(400).json({
        message:
          'Could not find this address. Please enter a more specific address e.g. "5c Alkali Road, Unguwar Sarki, Kaduna".',
      });
    }

    // Insert pharmacy with auto-detected coordinates
    const [result] = await db.query(
      `INSERT INTO pharmacies
(name, address, latitude, longitude, opening_time, closing_time, phone)
VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        geo.formatted_address,
        geo.latitude,
        geo.longitude,
        opening_time,
        closing_time,
        phone || null,
      ],
    );

    const pharmacyId = result.insertId;

    // Link pharmacist user to this pharmacy
    await db.query(
      "INSERT INTO pharmacists (user_id, pharmacy_id) VALUES (?, ?)",
      [userId, pharmacyId],
    );

    // Auto-assign nearest OSM graph node using bounding box
    const [nodes] = await db.query(
      `SELECT * FROM graph_nodes
WHERE latitude BETWEEN ? AND ?
AND longitude BETWEEN ? AND ?`,
      [
        geo.latitude - 0.05,
        geo.latitude + 0.05,
        geo.longitude - 0.05,
        geo.longitude + 0.05,
      ],
    );

    if (nodes.length > 0) {
      let nearestId = null;
      let minDist = Infinity;

      nodes.forEach((node) => {
        const dx = parseFloat(node.latitude) - geo.latitude;
        const dy = parseFloat(node.longitude) - geo.longitude;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < minDist) {
          minDist = d;
          nearestId = node.id;
        }
      });

      await db.query("UPDATE pharmacies SET node_id = ? WHERE id = ?", [
        nearestId,
        pharmacyId,
      ]);

      console.log(`${name} → assigned to graph node ${nearestId}`);
    }

    res.status(201).json({
      message: "Pharmacy registered successfully.",
      pharmacy_id: pharmacyId,
      coordinates: {
        latitude: geo.latitude,
        longitude: geo.longitude,
      },
      address: geo.formatted_address,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
}

// ── Get the pharmacy belonging to the logged-in pharmacist ──
async function getMyPharmacy(req, res) {
  const userId = req.user.id;

  try {
    const [rows] = await db.query(
      `SELECT ph.*
FROM pharmacies ph
JOIN pharmacists pm ON ph.id = pm.pharmacy_id
WHERE pm.user_id = ?`,
      [userId],
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "No pharmacy found." });
    }

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
}

// ── Get inventory for the pharmacist's pharmacy ──
async function getInventory(req, res) {
  const userId = req.user.id;

  try {
    const [pharmRows] = await db.query(
      "SELECT pharmacy_id FROM pharmacists WHERE user_id = ?",
      [userId],
    );
    if (pharmRows.length === 0) {
      return res.status(404).json({
        message: "No pharmacy found for this pharmacist.",
      });
    }

    const pharmacyId = pharmRows[0].pharmacy_id;

    const [rows] = await db.query(
      `SELECT i.id, d.id AS drug_id, d.name, d.category,
i.price, i.stock_qty
FROM inventory i
JOIN drugs d ON i.drug_id = d.id
WHERE i.pharmacy_id = ?
ORDER BY d.name`,
      [pharmacyId],
    );

    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
}

// ── Add a drug to inventory or update if it already exists ──
async function addToInventory(req, res) {
  const userId = req.user.id;
  const { drug_id, price, stock_qty } = req.body;

  if (!drug_id || price === undefined || stock_qty === undefined) {
    return res.status(400).json({
      message: "drug_id, price and stock_qty are required.",
    });
  }

  try {
    const [pharmRows] = await db.query(
      "SELECT pharmacy_id FROM pharmacists WHERE user_id = ?",
      [userId],
    );
    if (pharmRows.length === 0) {
      return res.status(404).json({ message: "No pharmacy found." });
    }

    const pharmacyId = pharmRows[0].pharmacy_id;

    // Insert or update if drug already exists in inventory
    await db.query(
      `INSERT INTO inventory (pharmacy_id, drug_id, price, stock_qty)
VALUES (?, ?, ?, ?)
ON DUPLICATE KEY UPDATE
price = VALUES(price),
stock_qty = VALUES(stock_qty)`,
      [pharmacyId, drug_id, price, stock_qty],
    );

    res.json({ message: "Inventory updated." });
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
}

// ── Update stock quantity and price for an inventory item ──
async function updateStock(req, res) {
  const userId = req.user.id;
  const { id } = req.params;
  const { stock_qty, price } = req.body;

  if (stock_qty === undefined || price === undefined) {
    return res.status(400).json({
      message: "stock_qty and price are required.",
    });
  }

  try {
    const [pharmRows] = await db.query(
      "SELECT pharmacy_id FROM pharmacists WHERE user_id = ?",
      [userId],
    );
    if (pharmRows.length === 0) {
      return res.status(404).json({ message: "No pharmacy found." });
    }

    await db.query(
      `UPDATE inventory
SET stock_qty = ?, price = ?
WHERE id = ? AND pharmacy_id = ?`,
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

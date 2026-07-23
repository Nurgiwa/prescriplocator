// backend/controllers/searchController.js
const { buildGraph } = require("../algorithm/graphBuilder");
const { astar } = require("../algorithm/astar");
const { rankPharmacies } = require("../algorithm/pharmacyRanker");
const db = require("../config/db");

// ── Find nearby pharmacies using A* algorithm ──
async function findNearbyPharmacies(req, res) {
  const { patient_node_id, drug_ids } = req.body;

  if (!patient_node_id || !drug_ids || drug_ids.length === 0) {
    return res
      .status(400)
      .json({ message: "patient_node_id and drug_ids are required." });
  }

  try {
    const graph = await buildGraph();

    if (!graph[String(patient_node_id)]) {
      return res.status(400).json({ message: "Invalid patient node." });
    }

    // Get all pharmacies that have a node assigned
    const [pharmacies] = await db.query(
      `SELECT id, name, address, latitude, longitude,
opening_time, closing_time, phone, node_id
FROM pharmacies
WHERE node_id IS NOT NULL`,
    );

    if (pharmacies.length === 0) {
      return res.status(404).json({ message: "No pharmacies found." });
    }

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const results = [];

    for (const pharmacy of pharmacies) {
      // ── Run A* from patient node to this pharmacy's node ──
      const result = astar(
        graph,
        String(patient_node_id),
        String(pharmacy.node_id),
      );

      // Skip pharmacy if no path found
      if (!result) continue;

      // ── Check opening hours ──
      const [oH, oM] = pharmacy.opening_time.split(":").map(Number);
      const [cH, cM] = pharmacy.closing_time.split(":").map(Number);
      const isOpen = currentTime >= oH * 60 + oM && currentTime <= cH * 60 + cM;

      // ── Check drug availability ──
      const [inventory] = await db.query(
        `SELECT drug_id FROM inventory
WHERE pharmacy_id = ? AND drug_id IN (?) AND stock_qty > 0`,
        [pharmacy.id, drug_ids],
      );

      const availableIds = inventory.map((i) => i.drug_id);
      const drugsAvailable = drug_ids.filter((id) =>
        availableIds.includes(id),
      ).length;
      const allDrugsAvailable = drugsAvailable === drug_ids.length;

      // ── Build path coordinates for map route drawing ──
      const pathCoords = result.path
        .map((nodeId) => {
          const node = graph[String(nodeId)];
          if (!node) return null;
          return { lat: node.latitude, lng: node.longitude };
        })
        .filter(Boolean);

      results.push({
        pharmacy_id: pharmacy.id,
        name: pharmacy.name,
        address: pharmacy.address,
        latitude: parseFloat(pharmacy.latitude),
        longitude: parseFloat(pharmacy.longitude),
        phone: pharmacy.phone,
        opening_time: pharmacy.opening_time,
        closing_time: pharmacy.closing_time,
        is_open: isOpen,
        distance_km: parseFloat(result.distance.toFixed(2)),
        path: result.path,
        path_coords: pathCoords,
        drugs_available: drugsAvailable,
        drugs_total: drug_ids.length,
        all_drugs_available: allDrugsAvailable,
      });
    }

    // ── Rank results using pharmacyRanker ──
    const ranked = rankPharmacies(results);
    res.json(ranked);
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
}

// ── Find nearest graph node to patient's GPS coordinates ──
async function findNearestNode(req, res) {
  const { latitude, longitude } = req.body;

  if (!latitude || !longitude) {
    return res
      .status(400)
      .json({ message: "latitude and longitude are required." });
  }

  try {
    // Only search nodes within a small bounding box for speed
    // instead of loading all 39K nodes
    const [nodes] = await db.query(
      `SELECT * FROM graph_nodes
WHERE latitude BETWEEN ? AND ?
AND longitude BETWEEN ? AND ?`,
      [
        parseFloat(latitude) - 0.05,
        parseFloat(latitude) + 0.05,
        parseFloat(longitude) - 0.05,
        parseFloat(longitude) + 0.05,
      ],
    );

    if (nodes.length === 0) {
      return res
        .status(404)
        .json({ message: "No graph nodes found near this location." });
    }

    let nearestNode = null;
    let minDistance = Infinity;

    nodes.forEach((node) => {
      const dx = parseFloat(node.latitude) - parseFloat(latitude);
      const dy = parseFloat(node.longitude) - parseFloat(longitude);
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < minDistance) {
        minDistance = d;
        nearestNode = node;
      }
    });

    res.json(nearestNode);
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
}

// ── Auto-assign nearest OSM node to each pharmacy ──
// Run once after seeding the OSM graph
async function assignPharmacyNodes() {
  const [pharmacies] = await db.query("SELECT * FROM pharmacies");

  for (const pharmacy of pharmacies) {
    // Search within small bounding box for speed
    const [nodes] = await db.query(
      `SELECT * FROM graph_nodes
WHERE latitude BETWEEN ? AND ?
AND longitude BETWEEN ? AND ?`,
      [
        parseFloat(pharmacy.latitude) - 0.05,
        parseFloat(pharmacy.latitude) + 0.05,
        parseFloat(pharmacy.longitude) - 0.05,
        parseFloat(pharmacy.longitude) + 0.05,
      ],
    );

    if (nodes.length === 0) {
      console.log(`No node found near ${pharmacy.name}`);
      continue;
    }

    let nearestId = null;
    let minDist = Infinity;

    nodes.forEach((node) => {
      const dx = parseFloat(node.latitude) - parseFloat(pharmacy.latitude);
      const dy = parseFloat(node.longitude) - parseFloat(pharmacy.longitude);
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < minDist) {
        minDist = d;
        nearestId = node.id;
      }
    });

    await db.query("UPDATE pharmacies SET node_id = ? WHERE id = ?", [
      nearestId,
      pharmacy.id,
    ]);

    console.log(`${pharmacy.name} → node ${nearestId}`);
  }

  console.log("Pharmacy nodes assigned.");
}

module.exports = { findNearbyPharmacies, findNearestNode, assignPharmacyNodes };

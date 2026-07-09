// backend/controllers/searchController.js
const db = require("../config/db");
const { astar } = require("../algorithm/astar");

// Build the graph from DB once per search request
async function buildGraph() {
  const [nodes] = await db.query("SELECT * FROM graph_nodes");
  const [edges] = await db.query("SELECT * FROM graph_edges");

  const graph = {};

  // Create node entries
  nodes.forEach((node) => {
    graph[node.id] = {
      id: node.id,
      label: node.label,
      latitude: parseFloat(node.latitude),
      longitude: parseFloat(node.longitude),
      neighbors: [],
    };
  });

  // Attach edges as neighbors
  edges.forEach((edge) => {
    if (graph[edge.from_node]) {
      graph[edge.from_node].neighbors.push({
        nodeId: edge.to_node,
        distance_km: parseFloat(edge.distance_km),
      });
    }
  });

  return graph;
}

// ── Main search function ──
// Accepts: patient's node id + list of drug ids from their prescription
async function findNearbyPharmacies(req, res) {
  const { patient_node_id, drug_ids } = req.body;
  // drug_ids = array of drug ids from the prescription e.g [1, 2]

  if (!patient_node_id || !drug_ids || drug_ids.length === 0) {
    return res
      .status(400)
      .json({ message: "patient_node_id and drug_ids are required." });
  }

  try {
    const graph = await buildGraph();

    if (!graph[patient_node_id]) {
      return res.status(400).json({ message: "Invalid patient node." });
    }

    // Get all pharmacies with their graph node, inventory, and hours
    const [pharmacies] = await db.query(
      `SELECT ph.id, ph.name, ph.address, ph.latitude, ph.longitude,
ph.opening_time, ph.closing_time, ph.phone,
gn.id AS node_id
FROM pharmacies ph
JOIN graph_nodes gn
ON ABS(gn.latitude - ph.latitude) < 0.0010
AND ABS(gn.longitude - ph.longitude) < 0.0010`,
    );

    if (pharmacies.length === 0) {
      return res
        .status(404)
        .json({ message: "No pharmacies found in the graph." });
    }

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes(); // minutes since midnight

    const results = [];

    for (const pharmacy of pharmacies) {
      // ── Run A* from patient node to this pharmacy's node ──
      const result = astar(
        graph,
        String(patient_node_id),
        String(pharmacy.node_id),
      );

      if (!result) continue; // No path found — skip this pharmacy

      // ── Check opening hours ──
      const [openH, openM] = pharmacy.opening_time.split(":").map(Number);
      const [closeH, closeM] = pharmacy.closing_time.split(":").map(Number);
      const openMinutes = openH * 60 + openM;
      const closeMinutes = closeH * 60 + closeM;
      const isOpen = currentTime >= openMinutes && currentTime <= closeMinutes;

      // ── Check drug availability ──
      const [inventory] = await db.query(
        `SELECT drug_id, stock_qty FROM inventory
WHERE pharmacy_id = ? AND drug_id IN (?) AND stock_qty > 0`,
        [pharmacy.id, drug_ids],
      );

      const availableDrugIds = inventory.map((i) => i.drug_id);
      const drugsAvailable = drug_ids.filter((id) =>
        availableDrugIds.includes(id),
      ).length;
      const drugsTotal = drug_ids.length;
      const allDrugsAvailable = drugsAvailable === drugsTotal;

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
        drugs_available: drugsAvailable,
        drugs_total: drugsTotal,
        all_drugs_available: allDrugsAvailable,
      });
    }

    // ── Rank by: all drugs available first, then by distance ──
    results.sort((a, b) => {
      if (b.all_drugs_available !== a.all_drugs_available) {
        return b.all_drugs_available - a.all_drugs_available;
      }
      return a.distance_km - b.distance_km;
    });

    res.json(results);
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
}

module.exports = { findNearbyPharmacies };

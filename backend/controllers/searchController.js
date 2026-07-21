// backend/controllers/searchController.js
const db        = require('../config/db');
const { astar } = require('../algorithm/astar');

async function buildGraph() {
  const [nodes] = await db.query('SELECT * FROM graph_nodes');
  const [edges] = await db.query('SELECT * FROM graph_edges');

  const graph = {};

  nodes.forEach(node => {
    graph[node.id] = {
      id:        node.id,
      label:     node.label,
      latitude:  parseFloat(node.latitude),
      longitude: parseFloat(node.longitude),
      neighbors: []
    };
  });

  edges.forEach(edge => {
    if (graph[edge.from_node]) {
      graph[edge.from_node].neighbors.push({
        nodeId:      edge.to_node,
        distance_km: parseFloat(edge.distance_km)
      });
    }
  });

  return graph;
}

async function findNearbyPharmacies(req, res) {
  const { patient_node_id, drug_ids } = req.body;

  if (!patient_node_id || !drug_ids || drug_ids.length === 0) {
    return res.status(400).json({ message: 'patient_node_id and drug_ids are required.' });
  }

  try {
    const graph = await buildGraph();

    if (!graph[patient_node_id]) {
      return res.status(400).json({ message: 'Invalid patient node.' });
    }

    // Use node_id column directly — no coordinate matching
    const [pharmacies] = await db.query(
      'SELECT id, name, address, latitude, longitude, opening_time, closing_time, phone, node_id FROM pharmacies WHERE node_id IS NOT NULL'
    );

    if (pharmacies.length === 0) {
      return res.status(404).json({ message: 'No pharmacies found in the graph.' });
    }

    const now         = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const results     = [];

    for (const pharmacy of pharmacies) {
      // Run A* from patient node to this pharmacy's node
      const result = astar(
        graph,
        String(patient_node_id),
        String(pharmacy.node_id)
      );

      if (!result) continue;

      // Check opening hours
      const [openH,  openM]  = pharmacy.opening_time.split(':').map(Number);
      const [closeH, closeM] = pharmacy.closing_time.split(':').map(Number);
      const isOpen = currentTime >= (openH * 60 + openM) &&
                     currentTime <= (closeH * 60 + closeM);

      // Check drug availability
      const [inventory] = await db.query(
        'SELECT drug_id FROM inventory WHERE pharmacy_id = ? AND drug_id IN (?) AND stock_qty > 0',
        [pharmacy.id, drug_ids]
      );

      const availableDrugIds  = inventory.map(i => i.drug_id);
      const drugsAvailable    = drug_ids.filter(id => availableDrugIds.includes(id)).length;
      const allDrugsAvailable = drugsAvailable === drug_ids.length;

      results.push({
        pharmacy_id:         pharmacy.id,
        name:                pharmacy.name,
        address:             pharmacy.address,
        latitude:            parseFloat(pharmacy.latitude),
        longitude:           parseFloat(pharmacy.longitude),
        phone:               pharmacy.phone,
        opening_time:        pharmacy.opening_time,
        closing_time:        pharmacy.closing_time,
        is_open:             isOpen,
        distance_km:         parseFloat(result.distance.toFixed(2)),
        path:                result.path,
        drugs_available:     drugsAvailable,
        drugs_total:         drug_ids.length,
        all_drugs_available: allDrugsAvailable
      });
    }

    // Rank: all drugs available first, then by distance
    results.sort((a, b) => {
      if (b.all_drugs_available !== a.all_drugs_available) {
        return b.all_drugs_available - a.all_drugs_available;
      }
      return a.distance_km - b.distance_km;
    });

    res.json(results);

  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
}

async function findNearestNode(req, res) {
  const { latitude, longitude } = req.body;

  if (!latitude || !longitude) {
    return res.status(400).json({ message: 'latitude and longitude are required.' });
  }

  try {
    const [nodes] = await db.query('SELECT * FROM graph_nodes');

    let nearestNode = null;
    let minDistance = Infinity;

    nodes.forEach(node => {
      const dx = parseFloat(node.latitude)  - parseFloat(latitude);
      const dy = parseFloat(node.longitude) - parseFloat(longitude);
      const d  = Math.sqrt(dx * dx + dy * dy);
      if (d < minDistance) {
        minDistance = d;
        nearestNode = node;
      }
    });

    res.json(nearestNode);

  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
}

module.exports = { findNearbyPharmacies, findNearestNode };
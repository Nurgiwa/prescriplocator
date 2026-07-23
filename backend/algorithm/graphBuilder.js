// backend/algorithm/graphBuilder.js
const fs = require("fs");
const path = require("path");
const db = require("../config/db");

// Load OSM GeoJSON and extract nodes + edges automatically
async function buildGraphFromOSM() {
  const filePath = path.join(__dirname, "../data/kadunaNorth.geojson");
  const raw = fs.readFileSync(filePath, "utf8");
  const geojson = JSON.parse(raw);

  const nodeMap = {}; // key: "lat,lng" → node id
  const nodes = [];
  const edges = [];
  let nodeId = 1;

  for (const feature of geojson.features) {
    if (feature.geometry.type !== "LineString") continue;

    const coords = feature.geometry.coordinates;
    const roadName =
      feature.properties?.name || feature.properties?.highway || "Road";
    let prevId = null;
    let prevCoord = null;

    for (const coord of coords) {
      const lng = coord[0];
      const lat = coord[1];
      const key = `${lat.toFixed(6)},${lng.toFixed(6)}`;

      // Reuse node if already exists at this coordinate
      if (!nodeMap[key]) {
        nodeMap[key] = nodeId;
        nodes.push({
          id: nodeId,
          label: roadName,
          latitude: lat,
          longitude: lng,
        });
        nodeId++;
      }

      const currentId = nodeMap[key];

      // Add edge between consecutive coords (bidirectional)
      if (prevId !== null) {
        const dist = euclideanKm(prevCoord[1], prevCoord[0], lat, lng);
        edges.push({ from: prevId, to: currentId, distance_km: dist });
        edges.push({ from: currentId, to: prevId, distance_km: dist });
      }

      prevId = currentId;
      prevCoord = coord;
    }
  }

  return { nodes, edges };
}

// Simple Euclidean distance in km between two lat/lng points
function euclideanKm(lat1, lng1, lat2, lng2) {
  const dx = (lat2 - lat1) * 111;
  const dy = (lng2 - lng1) * 111 * Math.cos((lat1 * Math.PI) / 180);
  return Math.sqrt(dx * dx + dy * dy);
}

// Seed the DB with OSM graph nodes and edges
async function seedGraphFromOSM() {
  console.log("Building graph from OSM data...");

  const { nodes, edges } = await buildGraphFromOSM();

  console.log(`Found ${nodes.length} nodes and ${edges.length} edges`);

  // Clear existing graph data
  await db.query("DELETE FROM graph_edges");
  await db.query("DELETE FROM graph_nodes");
  await db.query("ALTER TABLE graph_nodes AUTO_INCREMENT = 1");
  await db.query("ALTER TABLE graph_edges AUTO_INCREMENT = 1");

  // Insert nodes in batches of 500
  for (let i = 0; i < nodes.length; i += 500) {
    const batch = nodes.slice(i, i + 500);
    const values = batch.map((n) => [n.id, n.label, n.latitude, n.longitude]);
    await db.query(
      "INSERT INTO graph_nodes (id, label, latitude, longitude) VALUES ?",
      [values],
    );
  }

  // Insert edges in batches of 500
  for (let i = 0; i < edges.length; i += 500) {
    const batch = edges.slice(i, i + 500);
    const values = batch.map((e) => [e.from, e.to, e.distance_km]);
    await db.query(
      "INSERT INTO graph_edges (from_node, to_node, distance_km) VALUES ?",
      [values],
    );
  }

  console.log("Graph seeded successfully from OSM data.");
}

// Build graph from DB for A* (used at search time)
async function buildGraph() {
  const [nodes] = await db.query("SELECT * FROM graph_nodes");
  const [edges] = await db.query("SELECT * FROM graph_edges");

  const graph = {};

  nodes.forEach((node) => {
    graph[node.id] = {
      id: node.id,
      label: node.label,
      latitude: parseFloat(node.latitude),
      longitude: parseFloat(node.longitude),
      neighbors: [],
    };
  });

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

module.exports = { buildGraph, seedGraphFromOSM };

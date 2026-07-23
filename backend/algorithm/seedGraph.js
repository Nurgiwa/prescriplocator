// backend/algorithm/seedGraph.js
// Run this ONCE to seed the DB from OSM data
// Usage: node algorithm/seedGraph.js

const { seedGraphFromOSM } = require("./graphBuilder");

seedGraphFromOSM()
  .then(() => {
    console.log("Done. You can now run the server.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Seeding failed:", err.message);
    process.exit(1);
  });

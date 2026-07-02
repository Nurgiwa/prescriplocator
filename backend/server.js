// backend/server.js
// Entry point for the Express API and static frontend hosting.
// Initializes server, connects to database, sets up routes, and serves frontend files.
const express = require("express");
const cors = require("cors");
const path = require("path");
// Load environment variables from .env file
require("dotenv").config();

// Import database configuration and all API route modules.
const db = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const drugRoutes = require("./routes/drugs");
const prescriptionRoutes = require("./routes/prescriptions");
const pharmacyRoutes = require("./routes/pharmacy");
const app = express();

// Enable CORS for cross-origin requests and parse incoming JSON request bodies
app.use(cors());
app.use(express.json());

// Mount API routes - each route group handles a specific feature/resource
app.use("/api/auth", authRoutes);
app.use("/api/drugs", drugRoutes);
app.use("/api/prescriptions", prescriptionRoutes);
app.use("/api/pharmacy", pharmacyRoutes);

// Serve static frontend files (HTML, CSS, JS) from the frontend directory
app.use(express.static(path.join(__dirname, "../frontend")));

// Health check endpoint - verifies server and database connectivity
app.get("/api/health", async (req, res) => {
  try {
    // Test database connection with a simple query
    await db.query("SELECT 1");
    res.json({ status: "ok", message: "Server and database connected" });
  } catch (err) {
    // Return error if database is unreachable
    res.status(500).json({ status: "error", message: err.message });
  }
});

// Start server on PORT from environment or default to 5000 for local development
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`PrescripLocator backend running on port ${PORT}`);
});

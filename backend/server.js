// backend/server.js
// Entry point for the Express API and static frontend hosting.
const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

// Shared database pool and route modules.
const db = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const drugRoutes = require("./routes/drugs");
const prescriptionRoutes = require("./routes/prescriptions");
const app = express();

// Enable browser requests and JSON request bodies before mounting routes.
app.use(cors());
app.use(express.json());

// API route groups are kept separate by feature.
app.use("/api/auth", authRoutes);
app.use("/api/drugs", drugRoutes);
app.use("/api/prescriptions", prescriptionRoutes);

// Serve files from the frontend folder when the backend is running.
app.use(express.static(path.join(__dirname, "../frontend")));

// Quick health check: confirms both the server and database are reachable.
app.get("/api/health", async (req, res) => {
  try {
    await db.query("SELECT 1");
    res.json({ status: "ok", message: "Server and database connected" });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// Use the deployed PORT when available, otherwise default to local development.
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`PrescripLocator backend running on port ${PORT}`);
});

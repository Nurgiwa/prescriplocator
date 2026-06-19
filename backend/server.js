// backend/server.js
const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const db = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const drugRoutes = require("./routes/drugs");
const prescriptionRoutes = require("./routes/prescriptions");
const app = express();

app.use(cors());
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/drugs", drugRoutes);
app.use("/api/prescriptions", prescriptionRoutes);
app.use(express.static(path.join(__dirname, "../frontend")));

// Quick health check — open this in browser or Postman to confirm setup
app.get("/api/health", async (req, res) => {
  try {
    await db.query("SELECT 1");
    res.json({ status: "ok", message: "Server and database connected" });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`PrescripLocator backend running on port ${PORT}`);
});

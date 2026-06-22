// backend/routes/prescriptions.js
// Routes for creating and viewing prescriptions.
const express = require("express");
const router = express.Router();
const {
  createPrescription,
  getDoctorPrescriptions,
} = require("../controllers/prescriptionController");
const verifyToken = require("../middleware/authMiddleware");

// Doctors create prescriptions through the dashboard form.
router.post("/", verifyToken, createPrescription);

// The dashboard uses this to render recent prescriptions and stats.
router.get("/doctor", verifyToken, getDoctorPrescriptions);

module.exports = router;

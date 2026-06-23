// backend/routes/prescriptions.js
// Routes for creating and viewing prescriptions.
const express = require("express");
const router = express.Router();
const {
  createPrescription,
  getDoctorPrescriptions,
  getPrescriptionByCode,
} = require("../controllers/prescriptionController");
const verifyToken = require("../middleware/authMiddleware");

// Doctors create prescriptions through the dashboard form.
router.post("/", verifyToken, createPrescription);

// The dashboard uses this to render recent prescriptions and stats.
router.get("/doctor", verifyToken, getDoctorPrescriptions);

// Patients retrieve only their own prescription by the code their doctor gives them.
router.get("/code/:code", verifyToken, getPrescriptionByCode);

module.exports = router;

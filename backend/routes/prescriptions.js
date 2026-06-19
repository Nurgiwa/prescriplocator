// backend/routes/prescriptions.js
const express = require('express');
const router = express.Router();
const { createPrescription, getDoctorPrescriptions } = require('../controllers/prescriptionController');
const verifyToken = require('../middleware/authMiddleware');

router.post('/', verifyToken, createPrescription);
router.get('/doctor', verifyToken, getDoctorPrescriptions);

module.exports = router;

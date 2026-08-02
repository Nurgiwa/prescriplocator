// backend/routes/admin.js
const express    = require('express');
const router     = express.Router();
const { getDashboardStats, getUsers, getPharmacies } = require('../controllers/adminController');
const verifyToken = require('../middleware/authMiddleware');

router.get('/stats',      verifyToken, getDashboardStats);
router.get('/users',      verifyToken, getUsers);
router.get('/pharmacies', verifyToken, getPharmacies);

module.exports = router;

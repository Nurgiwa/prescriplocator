// backend/controllers/adminController.js
const db = require('../config/db');

async function getDashboardStats(req, res) {
  try {
    const [[{ total_users }]]         = await db.query('SELECT COUNT(*) AS total_users FROM users');
    const [[{ total_doctors }]]       = await db.query("SELECT COUNT(*) AS total_doctors FROM users WHERE role = 'doctor'");
    const [[{ total_pharmacists }]]   = await db.query("SELECT COUNT(*) AS total_pharmacists FROM users WHERE role = 'pharmacist'");
    const [[{ total_patients }]]      = await db.query("SELECT COUNT(*) AS total_patients FROM users WHERE role = 'patient'");
    const [[{ total_pharmacies }]]    = await db.query('SELECT COUNT(*) AS total_pharmacies FROM pharmacies');
    const [[{ total_prescriptions }]] = await db.query('SELECT COUNT(*) AS total_prescriptions FROM prescriptions');
    const [[{ total_drugs }]]         = await db.query('SELECT COUNT(*) AS total_drugs FROM drugs');

    // Prescriptions per day for the last 7 days
    const [dailyStats] = await db.query(
      `SELECT DATE(created_at) AS date, COUNT(*) AS count
       FROM prescriptions
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
       GROUP BY DATE(created_at)
       ORDER BY date ASC`
    );

    // Prescription status breakdown
    const [topPharmacies] = await db.query(
      `SELECT ph.name, COUNT(i.id) AS drug_count,
              SUM(i.stock_qty) AS total_stock
       FROM pharmacies ph
       LEFT JOIN inventory i ON ph.id = i.pharmacy_id
       GROUP BY ph.id, ph.name
       ORDER BY drug_count DESC
       LIMIT 5`
    );

    // Recent activity
    const [recentPrescriptions] = await db.query(
      `SELECT p.prescription_code, u.full_name AS patient_name,
              doc.full_name AS doctor_name, p.created_at
       FROM prescriptions p
       JOIN users u   ON p.patient_id = u.id
       JOIN doctors d ON p.doctor_id  = d.id
       JOIN users doc ON d.user_id    = doc.id
       ORDER BY p.created_at DESC
       LIMIT 8`
    );

    res.json({
      stats: {
        total_users,
        total_doctors,
        total_pharmacists,
        total_patients,
        total_pharmacies,
        total_prescriptions,
        total_drugs
      },
      dailyStats,
      topPharmacies,
      recentPrescriptions
    });

  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
}

// List all users
async function getUsers(req, res) {
  try {
    const [rows] = await db.query(
      `SELECT id, full_name, email, phone, role, created_at
       FROM users ORDER BY created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
}

// List all pharmacies
async function getPharmacies(req, res) {
  try {
    const [rows] = await db.query(
      `SELECT ph.id, ph.name, ph.address, ph.phone,
              ph.opening_time, ph.closing_time,
              COUNT(i.id) AS drug_count
       FROM pharmacies ph
       LEFT JOIN inventory i ON ph.id = i.pharmacy_id
       GROUP BY ph.id
       ORDER BY ph.name`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
}

module.exports = { getDashboardStats, getUsers, getPharmacies };
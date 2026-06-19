// backend/controllers/prescriptionController.js
const db = require("../config/db");

// Generates a code like RX7F2K9L1
function generateCode() {
  const random = Math.random().toString(36).substring(2, 9).toUpperCase();
  return `RX${random}`;
}

// CREATE prescription — doctor only
async function createPrescription(req, res) {
  const doctorUserId = req.user.id; // from JWT
  const { patient_email, drugs } = req.body;
  // drugs = [{ drug_id, dosage, duration, instructions }, ...]

  if (!patient_email || !drugs || drugs.length === 0) {
    return res
      .status(400)
      .json({ message: "Patient and at least one drug are required." });
  }

  try {
    // Find the doctor's row using their user id
    const [doctorRows] = await db.query(
      "SELECT id FROM doctors WHERE user_id = ?",
      [doctorUserId],
    );
    if (doctorRows.length === 0) {
      return res
        .status(403)
        .json({ message: "Only doctors can create prescriptions." });
    }
    const doctorId = doctorRows[0].id;

    // Find the patient by email
    const [patientRows] = await db.query(
      "SELECT id FROM users WHERE email = ? AND role = 'patient'",
      [patient_email],
    );
    if (patientRows.length === 0) {
      return res
        .status(404)
        .json({ message: "Patient not found with that email." });
    }
    const patientId = patientRows[0].id;

    // Generate a unique prescription code
    let code;
    let isUnique = false;
    while (!isUnique) {
      code = generateCode();
      const [existing] = await db.query(
        "SELECT id FROM prescriptions WHERE prescription_code = ?",
        [code],
      );
      if (existing.length === 0) isUnique = true;
    }

    // Insert the prescription
    const [presResult] = await db.query(
      "INSERT INTO prescriptions (prescription_code, doctor_id, patient_id) VALUES (?, ?, ?)",
      [code, doctorId, patientId],
    );
    const prescriptionId = presResult.insertId;

    // Insert each drug line
    for (const item of drugs) {
      await db.query(
        `INSERT INTO prescription_items (prescription_id, drug_id, dosage, duration, instructions)
VALUES (?, ?, ?, ?, ?)`,
        [
          prescriptionId,
          item.drug_id,
          item.dosage,
          item.duration,
          item.instructions || null,
        ],
      );
    }

    res
      .status(201)
      .json({ message: "Prescription created.", prescription_code: code });
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
}

// LIST prescriptions created by the logged-in doctor (for "Recent Prescriptions")
async function getDoctorPrescriptions(req, res) {
  const doctorUserId = req.user.id;

  try {
    const [doctorRows] = await db.query(
      "SELECT id FROM doctors WHERE user_id = ?",
      [doctorUserId],
    );
    if (doctorRows.length === 0) {
      return res.status(403).json({ message: "Only doctors can view this." });
    }
    const doctorId = doctorRows[0].id;

    const [rows] = await db.query(
      `SELECT p.prescription_code, p.created_at, u.full_name AS patient_name
FROM prescriptions p
JOIN users u ON p.patient_id = u.id
WHERE p.doctor_id = ?
ORDER BY p.created_at DESC
LIMIT 20`,
      [doctorId],
    );

    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
}

module.exports = { createPrescription, getDoctorPrescriptions };

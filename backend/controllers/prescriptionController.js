// backend/controllers/prescriptionController.js
// Creates and lists prescriptions for logged-in doctors.
const db = require("../config/db");

// Generate a short public code patients/pharmacists can reference.
function generateCode() {
  const random = Math.random().toString(36).substring(2, 9).toUpperCase();
  return `RX${random}`;
}

// Create a prescription for a patient. Access is enforced by JWT middleware.
async function createPrescription(req, res) {
  // req.user is set by authMiddleware after the JWT is verified.
  const doctorUserId = req.user.id;
  const { patient_email, drugs } = req.body;

  // Expected drugs shape:
  // [{ drug_id, dosage, duration, instructions }, ...]
  if (!patient_email || !drugs || drugs.length === 0) {
    return res
      .status(400)
      .json({ message: "Patient and at least one drug are required." });
  }

  try {
    // Convert the logged-in user id to the doctor table id.
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

    // Only registered patients can receive prescriptions.
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

    // Keep generating codes until there is no collision in the database.
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

    // Create the prescription header first so items can reference its id.
    const [presResult] = await db.query(
      "INSERT INTO prescriptions (prescription_code, doctor_id, patient_id) VALUES (?, ?, ?)",
      [code, doctorId, patientId],
    );
    const prescriptionId = presResult.insertId;

    // Store each selected drug as a separate prescription item.
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

// List the current doctor's most recent prescriptions for dashboard display.
async function getDoctorPrescriptions(req, res) {
  const doctorUserId = req.user.id;

  try {
    // Confirm the current user has a doctor profile before showing records.
    const [doctorRows] = await db.query(
      "SELECT id FROM doctors WHERE user_id = ?",
      [doctorUserId],
    );
    if (doctorRows.length === 0) {
      return res.status(403).json({ message: "Only doctors can view this." });
    }
    const doctorId = doctorRows[0].id;

    // Join patient names onto prescriptions so the frontend does not need
    // another request for each recent prescription.
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

// GET a single prescription by code — patient only, must be their own
async function getPrescriptionByCode(req, res) {
  const patientUserId = req.user.id;
  const { code } = req.params;

  try {
    const [presRows] = await db.query(
      `SELECT p.id, p.prescription_code, p.created_at,
doc_user.full_name AS doctor_name
FROM prescriptions p
JOIN doctors d ON p.doctor_id = d.id
JOIN users doc_user ON d.user_id = doc_user.id
WHERE p.prescription_code = ? AND p.patient_id = ?`,
      [code, patientUserId],
    );

    if (presRows.length === 0) {
      return res.status(404).json({ message: "Prescription not found." });
    }

    const prescription = presRows[0];

    const [items] = await db.query(
      `SELECT dr.name, dr.id AS drug_id, pi.dosage, pi.duration, pi.instructions
FROM prescription_items pi
JOIN drugs dr ON pi.drug_id = dr.id
WHERE pi.prescription_id = ?`,
      [prescription.id],
    );

    res.json({ ...prescription, drugs: items });
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
}

module.exports = {
  createPrescription,
  getDoctorPrescriptions,
  getPrescriptionByCode,
};

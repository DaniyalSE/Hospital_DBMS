export const DEFAULT_DB_NAME = process.env.MONGODB_DB || "HospitalDB";

export const HOSPITAL_COLLECTIONS = [
  "Patients",
  "Doctors",
  "Departments",
  "Appointments",
  "Treatments",
  "Medications",
  "Bills",
  "Nurses",
  "Rooms",
  "Admissions",
  "LabTests",
  "Allergies",
  "Insurance",
  "Surgeries",
  "Equipment",
  "Shifts",
  "Staff",
  "Feedback",
  "Pharmacy",
  "EmergencyContacts",
];

export const REALTIME_PATH = "/ws";
export const API_BASE_PATH = "/api";

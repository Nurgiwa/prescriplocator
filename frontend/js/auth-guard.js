// frontend/js/auth-guard.js
// Shared browser-side auth helpers for protected dashboard pages.

const API = "http://localhost:5000/api";

// The login page stores both values after a successful authentication.
const token = localStorage.getItem("token");
const user = JSON.parse(localStorage.getItem("user") || "null");

// If either value is missing, the dashboard should not be accessible.
if (!token || !user) {
  window.location.href = "login.html";
}

// Clear the local session and return the user to the login screen.
function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "login.html";
}

// Helper to call protected API routes with the saved JWT attached.
async function apiFetch(endpoint, options = {}) {
  const res = await fetch(`${API}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
  return res;
}

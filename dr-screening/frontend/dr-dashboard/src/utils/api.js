// src/utils/api.js
// Axios instance — all API calls go through here
// Base URL from env or localhost

import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL !== undefined ? import.meta.env.VITE_API_URL : "";

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
});

// ── Request interceptor (attach auth token) ──────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("retinai_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Response interceptor (handle errors globally) ────────────
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("retinai_token");
      localStorage.removeItem("retinai_user");
      // Dispatch global event for AuthContext to handle graceful logout
      window.dispatchEvent(new Event("jwt-expired"));
    }
    return Promise.reject(err);
  }
);

// ── API methods ───────────────────────────────────────────────

export const analyseImage = async (file, patientId = null, vitals = {}) => {
  const form = new FormData();
  form.append("file", file);
  if (patientId) form.append("patient_id", patientId);
  if (vitals?.age) form.append("age", vitals.age);
  if (vitals?.hba1c) form.append("hba1c", vitals.hba1c);
  if (vitals?.diabetes_years) form.append("diabetes_years", vitals.diabetes_years);
  if (vitals?.sys_bp) form.append("sys_bp", vitals.sys_bp);
  const res = await api.post("/api/analyse", form, { timeout: 120000 });
  return res.data;
};

export const validateScreening = async (screeningId, payload) => {
  const res = await api.post(`/api/validate/${screeningId}`, payload);
  return res.data;
};

export const getStats = async (params = {}) => {
  const res = await api.get("/api/stats", { params });
  return res.data;
};

export const createPatient = async (data) => {
  const res = await api.post("/api/patients", data);
  return res.data;
};

export const listPatients = async (params = {}) => {
  const res = await api.get("/api/patients", { params });
  return res.data;
};

export const getPatient = async (id) => {
  const res = await api.get(`/api/patients/${id}`);
  return res.data;
};

export const getReportUrl = (screeningId) =>
  `${API_BASE || ""}/api/report/${screeningId}`;

export const downloadReport = async (screeningId) => {
  const res = await api.get(`/api/report/${screeningId}`, { responseType: "blob" });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement("a");
  a.href = url;
  a.download = `RetinAI_Report_${screeningId}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const liveDemo = async (file, caseIndex = 0) => {
  const form = new FormData();
  form.append("file", file);
  form.append("case_index", caseIndex);
  const res = await api.post("/api/live-demo", form, { timeout: 120000 });
  return res.data;
};

export const healthCheck = async () => {
  const res = await api.get("/health");
  return res.data;
};

// ── Admin: User Management ─────────────────────────────────────
export const adminListUsers = async (role) => {
  const params = role ? { role } : {};
  const res = await api.get("/api/admin/users", { params });
  return res.data;
};

export const adminCreateUser = async (data) => {
  const res = await api.post("/api/admin/users", data);
  return res.data;
};

export const adminUpdateUser = async (userId, data) => {
  const res = await api.put(`/api/admin/users/${userId}`, data);
  return res.data;
};

export const adminDeleteUser = async (userId) => {
  const res = await api.delete(`/api/admin/users/${userId}`);
  return res.data;
};

// ── Doctor list (for ASHA share modal) ───────────────────────
export const listDoctors = async () => {
  const res = await api.get("/api/admin/doctors");
  return res.data;
};

// ── Doctor Review Workflow ────────────────────────────────────
export const shareReport = async (screeningId, doctorId, notes = "") => {
  const res = await api.post(`/api/reviews/share/${screeningId}`, {
    doctor_id: doctorId,
    notes,
  });
  return res.data;
};

export const getPendingReviews = async () => {
  const res = await api.get("/api/reviews/pending");
  return res.data;
};

export const submitDoctorReview = async (screeningId, payload) => {
  const res = await api.post(`/api/reviews/${screeningId}`, payload);
  return res.data;
};

export const getMyReports = async () => {
  const res = await api.get("/api/reviews/my-reports");
  return res.data;
};

// ── Admin self sign-up (public) ───────────────────────────────
export const adminRegisterSelf = async (data) => {
  const res = await api.post("/auth/register-admin", data);
  return res.data;
};

export default api;

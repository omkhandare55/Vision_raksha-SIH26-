// src/utils/api.js
// Axios instance — all API calls go through here
// Base URL from env or localhost

import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

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
      // Only reload if on protected admin dashboard
      if (window.location.pathname === "/dashboard") {
        window.location.reload();
      }
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
  const res = await api.post("/api/analyse", form);
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
  `${API_BASE}/api/report/${screeningId}`;

export const liveDemo = async (file, caseIndex = 0) => {
  const form = new FormData();
  form.append("file", file);
  form.append("case_index", caseIndex);
  const res = await api.post("/api/live-demo", form);
  return res.data;
};

export const healthCheck = async () => {
  const res = await api.get("/health");
  return res.data;
};

export default api;

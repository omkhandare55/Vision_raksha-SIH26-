// src/pages/PatientsPage.jsx
// Patient search, list, and history view
// Spec: PRD FR-028 to FR-033, US-015 to US-017

import { useState, useEffect, useCallback } from "react";
import {
  Search, UserPlus, X, ChevronRight,
  AlertTriangle, CheckCircle, Loader2
} from "lucide-react";
import { listPatients, getPatient, createPatient } from "../utils/api";

const GRADE_BADGE = {
  0: "bg-green-100 text-green-800",
  1: "bg-yellow-100 text-yellow-800",
  2: "bg-orange-100 text-orange-800",
  3: "bg-red-100 text-red-800",
  4: "bg-red-900 text-white",
};

export default function PatientsPage() {
  const [patients, setPatients]   = useState([]);
  const [total, setTotal]         = useState(0);
  const [search, setSearch]       = useState("");
  const [loading, setLoading]     = useState(false);
  const [selected, setSelected]   = useState(null);   // full patient object
  const [detailLoading, setDL]    = useState(false);
  const [showAdd, setShowAdd]     = useState(false);

  const fetchPatients = useCallback(async (q = "") => {
    setLoading(true);
    try {
      const res = await listPatients({ search: q || undefined, limit: 50 });
      setPatients(res.patients);
      setTotal(res.total);
    } catch { /* offline */ }
    finally { setLoading(false); }
  }, []);

  // Debounce search (also handles initial load)
  useEffect(() => {
    const t = setTimeout(() => fetchPatients(search), 350);
    return () => clearTimeout(t);
  }, [search, fetchPatients]);

  const openPatient = async (id) => {
    setDL(true);
    try {
      const data = await getPatient(id);
      setSelected(data);
    } finally { setDL(false); }
  };

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Left panel — list ──────────────────────────── */}
      <div className={`flex flex-col border-r border-gray-200 bg-white
        ${selected ? "hidden md:flex w-80" : "flex flex-1"}`}>

        {/* Header */}
        <div className="px-4 pt-5 pb-3 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-xl font-bold text-gray-800">Patients</h1>
            <button onClick={() => setShowAdd(true)}
              className="flex items-center gap-1 bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-blue-800 transition">
              <UserPlus size={13} /> Add
            </button>
          </div>
          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name, phone, ABHA ID..."
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg
                         focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
          <p className="text-xs text-gray-400 mt-2">{total} patient{total !== 1 ? "s" : ""}</p>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex justify-center p-6 text-gray-400">
              <Loader2 size={20} className="animate-spin" />
            </div>
          )}
          {!loading && patients.length === 0 && (
            <div className="p-6 text-center text-gray-400 text-sm">
              {search ? "No patients match your search" : "No patients yet — add one to begin"}
            </div>
          )}
          {patients.map(p => (
            <PatientRow
              key={p.patient_id}
              patient={p}
              active={selected?.patient_id === p.patient_id}
              onClick={() => openPatient(p.patient_id)}
            />
          ))}
        </div>
      </div>

      {/* ── Right panel — detail ───────────────────────── */}
      {(selected || detailLoading) && (
        <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
          <button
            className="md:hidden flex items-center gap-1 text-sm text-blue-600 mb-4"
            onClick={() => setSelected(null)}>
            ← Back to list
          </button>

          {detailLoading && (
            <div className="flex justify-center p-12 text-gray-400">
              <Loader2 size={28} className="animate-spin" />
            </div>
          )}

          {selected && !detailLoading && (
            <PatientDetail patient={selected} />
          )}
        </div>
      )}

      {/* ── Add patient modal ──────────────────────────── */}
      {showAdd && (
        <AddPatientModal
          onClose={() => setShowAdd(false)}
          onAdded={() => { setShowAdd(false); fetchPatients(search); }}
        />
      )}
    </div>
  );
}

// ── Patient row ───────────────────────────────────────────────
function PatientRow({ patient, active, onClick }) {
  const gradeClass = GRADE_BADGE[patient.last_grade ?? 0];
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-blue-50/40 transition
        ${active ? "bg-blue-50 border-l-2 border-l-blue-600" : ""}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-800">{patient.name}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            Age {patient.age} · {patient.village || "—"} · {patient.screening_count} screening{patient.screening_count !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {patient.last_grade != null && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${gradeClass}`}>
              G{patient.last_grade}
            </span>
          )}
          <ChevronRight size={14} className="text-gray-300" />
        </div>
      </div>
    </button>
  );
}

// ── Patient detail panel ──────────────────────────────────────
function PatientDetail({ patient }) {
  const [comparing, setComparing] = useState(false);
  const [baseIdx, setBaseIdx] = useState(0);
  const [followIdx, setFollowIdx] = useState(1);

  const screenings = patient.screenings || [];

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Info card */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-800">{patient.name}</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Age {patient.age} · {patient.gender === "M" ? "Male" : patient.gender === "F" ? "Female" : "Other"}
              {patient.village ? ` · ${patient.village}` : ""}
            </p>
          </div>
          <div className="text-right text-xs text-gray-400">
            <p>{patient.abha_id ? `ABHA: ${patient.abha_id}` : "No ABHA ID"}</p>
            <p>{patient.phone || ""}</p>
          </div>
        </div>
        {patient.diabetic_since && (
          <p className="mt-2 text-xs text-orange-600 font-medium">
            Diabetic since {patient.diabetic_since} ({new Date().getFullYear() - patient.diabetic_since} yrs)
          </p>
        )}
      </div>

      {/* Grade trend mini-chart */}
      {patient.grade_trend?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-gray-700">Grade Trend</p>
            {screenings.length >= 2 && (
              <button
                onClick={() => {
                  setBaseIdx(screenings.length - 1); // oldest
                  setFollowIdx(0); // newest
                  setComparing(true);
                }}
                className="text-xs bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-semibold px-2.5 py-1 rounded-md border border-indigo-200 transition"
              >
                🔬 Compare Visits Side-by-Side
              </button>
            )}
          </div>
          <div className="flex items-end gap-2 h-16">
            {patient.grade_trend.map((g, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className={`w-full rounded-t transition-all ${GRADE_BADGE[g]?.split(" ")[0] || "bg-gray-200"}`}
                  style={{ height: `${Math.max(8, (g + 1) * 12)}px` }}
                  title={`Grade ${g}`}
                />
                <span className="text-xs text-gray-400">{i + 1}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-1 text-center">Screening number →</p>
        </div>
      )}

      {/* Screenings history */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-700">
            Screening History ({screenings.length})
          </p>
          {screenings.length >= 2 && !comparing && (
            <button
              onClick={() => {
                setBaseIdx(screenings.length - 1);
                setFollowIdx(0);
                setComparing(true);
              }}
              className="text-xs text-blue-600 hover:underline font-medium"
            >
              Compare Visits
            </button>
          )}
        </div>
        {screenings.length === 0 && (
          <p className="px-4 py-6 text-center text-gray-400 text-sm">No screenings yet</p>
        )}
        {screenings.map((s) => (
          <div key={s.screening_id}
            className="px-4 py-3 border-b border-gray-50 flex items-center justify-between hover:bg-gray-50">
            <div className="flex items-center gap-3">
              {s.grade >= 2
                ? <AlertTriangle size={16} className="text-orange-500" />
                : <CheckCircle size={16} className="text-green-500" />}
              <div>
                <p className="text-sm font-medium text-gray-700">
                  Grade {s.grade} — {s.grade_label}
                </p>
                <p className="text-xs text-gray-400">{s.date} · {s.confidence}% confidence</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs">
              {s.validated
                ? <span className="text-green-600 font-medium">✓ Validated</span>
                : <span className="text-gray-400">Pending</span>}
              <span className={`px-2 py-0.5 rounded-full font-medium ${GRADE_BADGE[s.grade]}`}>
                G{s.grade}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Longitudinal Comparison Modal */}
      {comparing && screenings.length >= 2 && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-lg font-bold text-gray-800">Longitudinal Screening Comparison</h3>
                <p className="text-xs text-gray-500">{patient.name} · Tracking DR Progression Over Time</p>
              </div>
              <button onClick={() => setComparing(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            {/* Visit Selectors */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Baseline Visit (Earlier)</label>
                <select
                  value={baseIdx}
                  onChange={(e) => setBaseIdx(Number(e.target.value))}
                  className="w-full text-xs border border-gray-200 rounded-lg p-2 bg-gray-50"
                >
                  {screenings.map((s, idx) => (
                    <option key={s.screening_id} value={idx}>
                      {s.date || `Visit ${screenings.length - idx}`} — Grade {s.grade}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Follow-up Visit (Later)</label>
                <select
                  value={followIdx}
                  onChange={(e) => setFollowIdx(Number(e.target.value))}
                  className="w-full text-xs border border-gray-200 rounded-lg p-2 bg-gray-50"
                >
                  {screenings.map((s, idx) => (
                    <option key={s.screening_id} value={idx}>
                      {s.date || `Visit ${screenings.length - idx}`} — Grade {s.grade}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Comparison Cards */}
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="border rounded-xl p-4 bg-slate-50 space-y-2">
                <p className="text-xs font-bold text-gray-500 uppercase">Baseline</p>
                <p className="text-lg font-bold text-gray-800">
                  Grade {screenings[baseIdx]?.grade}
                </p>
                <p className="text-xs text-gray-600">{screenings[baseIdx]?.grade_label}</p>
                <p className="text-xs text-gray-400">{screenings[baseIdx]?.date} · {screenings[baseIdx]?.confidence}% Conf</p>
              </div>

              <div className="border rounded-xl p-4 bg-slate-50 space-y-2">
                <p className="text-xs font-bold text-gray-500 uppercase">Follow-up</p>
                <p className="text-lg font-bold text-gray-800">
                  Grade {screenings[followIdx]?.grade}
                </p>
                <p className="text-xs text-gray-600">{screenings[followIdx]?.grade_label}</p>
                <p className="text-xs text-gray-400">{screenings[followIdx]?.date} · {screenings[followIdx]?.confidence}% Conf</p>
              </div>
            </div>

            {/* Delta Progression Banner */}
            {(() => {
              const delta = (screenings[followIdx]?.grade ?? 0) - (screenings[baseIdx]?.grade ?? 0);
              return (
                <div className={`p-4 rounded-xl border text-sm font-semibold flex items-center justify-between ${
                  delta > 0
                    ? "bg-red-50 border-red-200 text-red-800"
                    : delta < 0
                    ? "bg-green-50 border-green-200 text-green-800"
                    : "bg-blue-50 border-blue-200 text-blue-800"
                }`}>
                  <span>
                    {delta > 0
                      ? `⚠️ Progression Alert: Disease progressed by +${delta} grade level(s)`
                      : delta < 0
                      ? `✓ Improvement: Disease severity regressed by ${Math.abs(delta)} grade level(s)`
                      : "✓ Stable: No change in DR severity between visits"}
                  </span>
                  <span className="text-xs font-mono font-normal">
                    Δ Grade = {delta > 0 ? `+${delta}` : delta}
                  </span>
                </div>
              );
            })()}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setComparing(false)}
                className="bg-gray-800 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-gray-900"
              >
                Close Comparison
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Add patient modal ─────────────────────────────────────────
function AddPatientModal({ onClose, onAdded }) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true); setError(null);
    const fd = new FormData(e.target);
    try {
      await createPatient({
        name:           fd.get("name"),
        age:            Number(fd.get("age")),
        gender:         fd.get("gender") || undefined,
        abha_id:        fd.get("abha_id") || undefined,
        phone:          fd.get("phone") || undefined,
        village:        fd.get("village") || undefined,
        diabetic_since: fd.get("diabetic_since") ? Number(fd.get("diabetic_since")) : undefined,
      });
      onAdded();
    } catch (err) {
      setError(err.response?.data?.detail?.message || "Registration failed");
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-800">Register New Patient</h2>
          <button onClick={onClose}><X size={18} className="text-gray-400 hover:text-gray-700" /></button>
        </div>
        <form onSubmit={submit} className="px-6 py-4 space-y-3">
          <Field label="Full Name *" name="name" required placeholder="Ramesh Kumar" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Age *" name="age" type="number" required min="1" max="120" placeholder="52" />
            <div>
              <label className="text-xs font-medium text-gray-600">Gender</label>
              <select name="gender"
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="M">Male</option>
                <option value="F">Female</option>
                <option value="O">Other</option>
              </select>
            </div>
          </div>
          <Field label="ABHA ID" name="abha_id" placeholder="1234-5678-9012" />
          <Field label="Phone" name="phone" placeholder="9876543210" />
          <Field label="Village / Area" name="village" placeholder="Pune Rural" />
          <Field label="Diabetic Since (year)" name="diabetic_since" type="number" min="1950" max={new Date().getFullYear()} placeholder="2018" />

          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-50 transition">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 bg-blue-700 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-800 disabled:opacity-50 transition flex items-center justify-center gap-2">
              {loading ? <Loader2 size={14} className="animate-spin" /> : null}
              Register
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, name, type = "text", required, ...rest }) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-600">{label}</label>
      <input name={name} type={type} required={required} {...rest}
        className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                   focus:outline-none focus:ring-2 focus:ring-blue-300" />
    </div>
  );
}

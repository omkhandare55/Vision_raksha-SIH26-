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
  0: "bg-emerald-50 text-emerald-700 border-emerald-200",
  1: "bg-amber-50 text-amber-700 border-amber-200",
  2: "bg-orange-50 text-orange-700 border-orange-200",
  3: "bg-rose-50 text-rose-700 border-rose-200",
  4: "bg-rose-900 text-white border-rose-800",
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
    <div className="d-flex flex-column flex-md-row h-[calc(100vh-64px)] overflow-hidden">

      {/* ── Left panel — list ──────────────────────────── */}
      <div className={`d-flex flex-column border-end border-[#E1E9EC] bg-white
        ${selected ? "d-none d-md-flex" : "d-flex flex-grow-1"}`} style={{ minWidth: selected ? '320px' : 'auto', width: selected ? '320px' : 'auto' }}>

        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-bottom border-[#E1E9EC]">
          <div className="d-flex align-items-center justify-content-between mb-3">
            <h1 className="text-xl font-bold text-[#1F2F42] m-0">Patients</h1>
            <button onClick={() => setShowAdd(true)} className="btn-primary text-xs py-2 px-3 gap-1 d-flex align-items-center">
              <UserPlus size={14} /> Add Patient
            </button>
          </div>
          {/* Search */}
          <div className="position-relative">
            <Search size={14} className="position-absolute text-[#22AEB0]" style={{ left: '14px', top: '14px' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name, phone, ABHA ID..."
              className="input-themed w-100"
              style={{ paddingLeft: '36px' }}
            />
          </div>
          <p className="text-xs text-[#94A1AB] mt-2 mb-0 font-medium">{total} patient{total !== 1 ? "s" : ""}</p>
        </div>

        {/* List */}
        <div className="flex-grow-1 overflow-y-auto">
          {loading && (
            <div className="d-flex justify-content-center p-4 text-[#22AEB0]">
              <Loader2 size={20} className="animate-spin" />
            </div>
          )}
          {!loading && patients.length === 0 && (
            <div className="p-4 text-center text-[#94A1AB] text-sm font-medium">
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
        <div className="flex-grow-1 overflow-y-auto bg-[#F7FAFB] p-4 p-md-5">
          <button
            className="d-md-none d-flex align-items-center gap-1 text-sm text-[#22AEB0] font-semibold mb-4 bg-transparent border-0 p-0"
            onClick={() => setSelected(null)}>
            ← Back to list
          </button>

          {detailLoading && (
            <div className="d-flex justify-content-center p-5 text-[#22AEB0]">
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
      className={`w-full text-left px-4 py-3.5 border-b border-[#E1E9EC]/50 hover:bg-[#F7FAFB] transition-all cursor-pointer
        ${active ? "bg-[#E8F7F6] border-l-3 border-l-[#22AEB0]" : ""}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-[#1F2F42]">{patient.name}</p>
          <p className="text-xs text-[#94A1AB] mt-0.5 font-medium">
            Age {patient.age} · {patient.village || "—"} · {patient.screening_count} screening{patient.screening_count !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {patient.last_grade != null && (
            <span className={`text-xs px-2.5 py-0.5 rounded-lg font-semibold border ${gradeClass}`}>
              G{patient.last_grade}
            </span>
          )}
          <ChevronRight size={14} className="text-[#94A1AB]" />
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
      <div className="card-static p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-[#1F2F42]">{patient.name}</h2>
            <p className="text-sm text-[#657685] mt-0.5 font-medium">
              Age {patient.age} · {patient.gender === "M" ? "Male" : patient.gender === "F" ? "Female" : "Other"}
              {patient.village ? ` · ${patient.village}` : ""}
            </p>
          </div>
          <div className="text-right text-xs text-[#94A1AB] font-medium">
            <p className="font-mono text-[#22AEB0] font-semibold">{patient.abha_id ? `ABHA: ${patient.abha_id}` : "No ABHA ID"}</p>
            <p>{patient.phone || ""}</p>
          </div>
        </div>
        {patient.diabetic_since && (
          <p className="mt-2.5 text-xs text-[#22AEB0] font-semibold bg-[#E8F7F6] px-3.5 py-1 rounded-lg border border-[#22AEB0]/15 inline-block">
            Diabetic since {patient.diabetic_since} ({new Date().getFullYear() - patient.diabetic_since} yrs)
          </p>
        )}
      </div>

      {/* Grade trend mini-chart */}
      {patient.grade_trend?.length > 0 && (
        <div className="card-static p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-[#1F2F42] uppercase tracking-wider">Grade Trend</p>
            {screenings.length >= 2 && (
              <button
                onClick={() => {
                  setBaseIdx(screenings.length - 1); // oldest
                  setFollowIdx(0); // newest
                  setComparing(true);
                }}
                className="btn-outline text-xs py-1.5 px-3.5"
              >
                🔬 Compare Visits Side-by-Side
              </button>
            )}
          </div>
          <div className="flex items-end gap-2 h-16">
            {patient.grade_trend.map((g, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className={`w-full rounded-t-lg transition-all ${GRADE_BADGE[g]?.split(" ")[0] || "bg-[#E1E9EC]"}`}
                  style={{ height: `${Math.max(8, (g + 1) * 12)}px` }}
                  title={`Grade ${g}`}
                />
                <span className="text-xs text-[#94A1AB] font-mono">{i + 1}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-[#94A1AB] mt-2 text-center font-medium">Screening number →</p>
        </div>
      )}

      {/* Screenings history */}
      <div className="card-static overflow-hidden p-0">
        <div className="px-5 py-3.5 border-b border-[#E1E9EC] bg-[#F7FAFB] flex items-center justify-between">
          <p className="text-xs font-bold text-[#1F2F42] uppercase tracking-wider">
            Screening History ({screenings.length})
          </p>
          {screenings.length >= 2 && !comparing && (
            <button
              onClick={() => {
                setBaseIdx(screenings.length - 1);
                setFollowIdx(0);
                setComparing(true);
              }}
              className="text-xs text-[#22AEB0] hover:underline font-semibold"
            >
              Compare Visits
            </button>
          )}
        </div>
        {screenings.length === 0 && (
          <p className="px-4 py-6 text-center text-[#94A1AB] text-sm font-medium">No screenings yet</p>
        )}
        {screenings.map((s) => (
          <div key={s.screening_id}
            className="px-5 py-3.5 border-b border-[#E1E9EC]/50 flex items-center justify-between hover:bg-[#F7FAFB] transition">
            <div className="flex items-center gap-3">
              {s.grade >= 2
                ? <AlertTriangle size={16} className="text-orange-500" />
                : <CheckCircle size={16} className="text-emerald-500" />}
              <div>
                <p className="text-sm font-semibold text-[#263746]">
                  Grade {s.grade} — {s.grade_label}
                </p>
                <p className="text-xs text-[#94A1AB] font-medium">{s.date} · {s.confidence}% confidence</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs">
              {s.validated
                ? <span className="text-[#22AEB0] font-semibold">✓ Validated</span>
                : <span className="text-[#94A1AB] font-medium">Pending</span>}
              <span className={`px-2.5 py-0.5 rounded-lg font-semibold border ${GRADE_BADGE[s.grade]}`}>
                G{s.grade}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Longitudinal Comparison Modal */}
      {comparing && screenings.length >= 2 && (
        <div className="position-fixed top-0 start-0 w-100 h-100 bg-[#1F2F42]/60 backdrop-blur-sm z-50 d-flex align-items-center justify-content-center p-3" style={{ zIndex: 1050 }}>
          <div className="bg-white rounded-3xl max-w-2xl w-100 p-4 p-md-5 d-flex flex-column gap-4 shadow-lg border border-[#E1E9EC]">
            <div className="d-flex align-items-center justify-content-between border-bottom border-[#E1E9EC] pb-3">
              <div>
                <h3 className="text-lg font-bold text-[#1F2F42] m-0">Longitudinal Screening Comparison</h3>
                <p className="text-xs text-[#657685] font-medium m-0 mt-1">{patient.name} · Tracking DR Progression Over Time</p>
              </div>
              <button onClick={() => setComparing(false)} className="text-[#94A1AB] hover:text-[#657685] cursor-pointer bg-transparent border-0">
                <X size={20} />
              </button>
            </div>

            {/* Visit Selectors */}
            <div className="row g-3">
              <div className="col-12 col-md-6">
                <label className="text-xs font-semibold text-[#657685] block mb-1">Baseline Visit (Earlier)</label>
                <select
                  value={baseIdx}
                  onChange={(e) => setBaseIdx(Number(e.target.value))}
                  className="input-themed text-xs py-2 w-100"
                >
                  {screenings.map((s, idx) => (
                    <option key={s.screening_id} value={idx}>
                      {s.date || `Visit ${screenings.length - idx}`} — Grade {s.grade}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-12 col-md-6">
                <label className="text-xs font-semibold text-[#657685] block mb-1">Follow-up Visit (Later)</label>
                <select
                  value={followIdx}
                  onChange={(e) => setFollowIdx(Number(e.target.value))}
                  className="input-themed text-xs py-2 w-100"
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
            <div className="row g-3">
              <div className="col-12 col-md-6">
                <div className="border border-[#E1E9EC] rounded-2xl p-4 bg-[#F7FAFB] d-flex flex-column gap-1 h-100">
                  <p className="text-xs font-bold text-[#94A1AB] text-uppercase tracking-wider m-0">Baseline</p>
                  <p className="text-lg font-bold text-[#1F2F42] m-0">
                    Grade {screenings[baseIdx]?.grade}
                  </p>
                  <p className="text-xs text-[#657685] font-medium m-0">{screenings[baseIdx]?.grade_label}</p>
                  <p className="text-xs text-[#94A1AB] font-mono mt-auto pt-2 m-0">{screenings[baseIdx]?.date} · {screenings[baseIdx]?.confidence}% Conf</p>
                </div>
              </div>

              <div className="col-12 col-md-6">
                <div className="border border-[#E1E9EC] rounded-2xl p-4 bg-[#F7FAFB] d-flex flex-column gap-1 h-100">
                  <p className="text-xs font-bold text-[#94A1AB] text-uppercase tracking-wider m-0">Follow-up</p>
                  <p className="text-lg font-bold text-[#1F2F42] m-0">
                    Grade {screenings[followIdx]?.grade}
                  </p>
                  <p className="text-xs text-[#657685] font-medium m-0">{screenings[followIdx]?.grade_label}</p>
                  <p className="text-xs text-[#94A1AB] font-mono mt-auto pt-2 m-0">{screenings[followIdx]?.date} · {screenings[followIdx]?.confidence}% Conf</p>
                </div>
              </div>
            </div>

            {/* Delta Progression Banner */}
            {(() => {
              const delta = (screenings[followIdx]?.grade ?? 0) - (screenings[baseIdx]?.grade ?? 0);
              return (
                <div className={`p-3 rounded-2xl border text-sm font-semibold d-flex flex-wrap align-items-center justify-content-between gap-2 ${
                  delta > 0
                    ? "bg-rose-50 border-rose-200 text-rose-800"
                    : delta < 0
                    ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                    : "bg-[#F7FAFB] border-[#E1E9EC] text-[#1F2F42]"
                }`}>
                  <span>
                    {delta > 0
                      ? `⚠️ Progression Alert: Disease progressed by +${delta} grade level(s)`
                      : delta < 0
                      ? `✓ Improvement: Disease severity regressed by ${Math.abs(delta)} grade level(s)`
                      : "✓ Stable: No change in DR severity between visits"}
                  </span>
                  <span className="text-xs font-mono font-bold">
                    Δ Grade = {delta > 0 ? `+${delta}` : delta}
                  </span>
                </div>
              );
            })()}

            <div className="d-flex justify-content-end">
              <button
                onClick={() => setComparing(false)}
                className="btn-primary text-xs py-2 px-4"
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
    <div className="position-fixed top-0 start-0 w-100 h-100 z-50 d-flex align-items-center justify-content-center bg-[#1F2F42]/60 backdrop-blur-sm p-3" style={{ zIndex: 1050 }}>
      <div className="bg-white rounded-3xl shadow-lg w-100 max-w-md border border-[#E1E9EC]">
        <div className="d-flex align-items-center justify-content-between px-4 py-3 border-bottom border-[#E1E9EC]">
          <h2 className="font-bold text-[#1F2F42] m-0">Register New Patient</h2>
          <button onClick={onClose} className="bg-transparent border-0"><X size={18} className="text-[#94A1AB] hover:text-[#657685] cursor-pointer" /></button>
        </div>
        <form onSubmit={submit} className="px-4 py-4 d-flex flex-column gap-3">
          <Field label="Full Name *" name="name" required placeholder="Ramesh Kumar" />
          <div className="row g-3">
            <div className="col-12 col-sm-6">
              <Field label="Age *" name="age" type="number" required min="1" max="120" placeholder="52" />
            </div>
            <div className="col-12 col-sm-6">
              <label className="text-xs font-semibold text-[#657685]">Gender</label>
              <select name="gender" className="input-themed mt-1 text-sm py-2 px-3 w-100">
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

          {error && <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 font-medium m-0">{error}</p>}

          <div className="d-flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-outline flex-grow-1 text-xs py-2">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary flex-grow-1 text-xs py-2 gap-2 d-flex align-items-center justify-content-center">
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
    <div className="w-100">
      <label className="text-xs font-semibold text-[#657685]">{label}</label>
      <input name={name} type={type} required={required} {...rest} className="input-themed mt-1 text-sm py-2 w-100" />
    </div>
  );
}

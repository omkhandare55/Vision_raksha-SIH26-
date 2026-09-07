// src/pages/ScreenPage.jsx
// Full clinical screening flow:
// Step 1: Patient Intake (ABHA ID, Age, Gender, HbA1c, Diabetes Duration, BP)
// Step 2: Fundus Camera Image Import (No generic webcam)
// Step 3: Multi-Modal AI Diagnosis & Doctor Triage

import { useState, useEffect } from "react";
import { Loader2, UserPlus, WifiOff, Clock, ShieldCheck, HeartPulse, Activity, Eye, FileText, ArrowRight } from "lucide-react";
import ImageCapture   from "../components/ImageCapture";
import ResultSection  from "../components/ResultSection";
import { analyseImage, validateScreening, createPatient } from "../utils/api";
import { enqueueImage, getPendingCount } from "../utils/offlineQueue";

const STEPS = ["Patient Intake", "Fundus Import", "AI Diagnostic Report"];

export default function ScreenPage() {
  const [step, setStep]         = useState(0);
  const [patient, setPatient]   = useState(null);
  const [vitals, setVitals]     = useState({
    abha_id: "",
    age: "",
    gender: "M",
    diabetes_years: "",
    hba1c: "",
    sys_bp: "",
    phone: "",
    village: "",
  });
  const [imageFile, setImageFile] = useState(null);
  const [result, setResult]     = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);
  const [queued, setQueued]     = useState(false);
  const [pendingCount, setPending] = useState(0);

  useEffect(() => {
    getPendingCount().then(setPending).catch(() => {});
  }, [queued]);

  // ── Step 0 — Patient Intake & Clinical Vitals ───────────
  const handlePatientSubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const parsedVitals = {
      name: fd.get("name"),
      abha_id: fd.get("abha_id") || `ABHA-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`,
      age: fd.get("age") ? Number(fd.get("age")) : null,
      gender: fd.get("gender") || "M",
      diabetes_years: fd.get("diabetes_years") ? Number(fd.get("diabetes_years")) : null,
      hba1c: fd.get("hba1c") ? Number(fd.get("hba1c")) : null,
      sys_bp: fd.get("sys_bp") ? Number(fd.get("sys_bp")) : null,
      phone: fd.get("phone") || "",
      village: fd.get("village") || "",
    };

    setVitals(parsedVitals);

    try {
      const res = await createPatient({
        name: parsedVitals.name,
        age: parsedVitals.age || 45,
        gender: parsedVitals.gender,
        abha_id: parsedVitals.abha_id,
        phone: parsedVitals.phone,
        village: parsedVitals.village,
        diabetic_since: parsedVitals.diabetes_years ? new Date().getFullYear() - parsedVitals.diabetes_years : null,
      });
      setPatient(res);
    } catch (err) {
      // Continue locally even if offline / DB conflict
      setPatient({ patient_id: null, name: parsedVitals.name });
    }

    setStep(1);
  };

  // ── Step 1 — Analyse Fundus Image ──────────────────────
  const handleAnalyse = async () => {
    if (!imageFile) return;
    setLoading(true);
    setError(null);
    setQueued(false);

    try {
      const data = await analyseImage(imageFile, patient?.patient_id, vitals);
      setResult(data);
      setStep(2);
    } catch (err) {
      // Offline fallback
      if (!navigator.onLine) {
        await enqueueImage({
          file: imageFile,
          patientId: patient?.patient_id,
          patientName: vitals?.name || "Unknown",
          vitals: vitals,
        });
        setQueued(true);
        setError(null);
      } else {
        const msg = err.response?.data?.detail?.message
                 || err.response?.data?.message
                 || err.message
                 || "Analysis failed — please ensure a valid fundus image is uploaded.";
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2 — Doctor Validation ─────────────────────────
  const handleValidate = async ({ action, override_reason, note, screening_id }) => {
    try {
      await validateScreening(screening_id, {
        action, override_reason, note, doctor_id: "dr_specialist"
      });
    } catch (err) {
      console.error("Validation error:", err);
    }
  };

  const reset = () => {
    setStep(0);
    setPatient(null);
    setImageFile(null);
    setResult(null);
    setError(null);
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* ── Step Indicator ─────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-6">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2 flex-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition
              ${i < step  ? "bg-emerald-600 text-white"
              : i === step ? "bg-blue-700 text-white ring-4 ring-blue-100"
              : "bg-gray-100 text-gray-400"}`}>
              {i < step ? "✓" : i + 1}
            </div>
            <span className={`text-xs md:text-sm font-medium ${i === step ? "text-blue-800 font-semibold" : "text-gray-400"}`}>
              {label}
            </span>
            {i < STEPS.length - 1 && <div className="flex-1 h-0.5 bg-gray-200" />}
          </div>
        ))}
        {step > 0 && (
          <button onClick={reset} className="text-xs text-gray-500 hover:text-red-600 font-medium ml-2 transition">
            ↺ Reset
          </button>
        )}
      </div>

      {/* ── STEP 0: PATIENT INTAKE & CLINICAL VITALS ──────── */}
      {step === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">
          <div className="border-b border-gray-100 pb-4">
            <div className="flex items-center gap-2 text-blue-700">
              <UserPlus size={22} />
              <h2 className="text-lg font-bold text-gray-900">Patient Registration & Clinical Intake</h2>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Compliant with Ayushman Bharat Digital Mission (ABDM). Collect patient demographics and metabolic biomarkers for multi-modal DR risk scoring.
            </p>
          </div>

          <form onSubmit={handlePatientSubmit} className="space-y-4">
            {/* Primary Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Full Patient Name *</label>
                <input
                  name="name"
                  required
                  placeholder="e.g. Ramesh Chandra Verma"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center justify-between">
                  <span>ABHA / Aadhaar ID</span>
                  <span className="text-[10px] text-emerald-600 font-mono flex items-center gap-0.5">
                    <ShieldCheck size={11} /> ABDM Linked
                  </span>
                </label>
                <input
                  name="abha_id"
                  placeholder="e.g. 91-4521-8902-1134"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Demographics */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Age (Years) *</label>
                <input
                  name="age"
                  type="number"
                  required
                  min="1"
                  max="120"
                  placeholder="58"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Gender *</label>
                <select
                  name="gender"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                  <option value="O">Other</option>
                </select>
              </div>

              <div className="col-span-2 md:col-span-1">
                <label className="block text-xs font-semibold text-gray-700 mb-1">Phone (SMS Triage)</label>
                <input
                  name="phone"
                  placeholder="+91 98765 43210"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Clinical Biomarkers Section */}
            <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-amber-900 font-semibold text-xs">
                <HeartPulse size={16} className="text-amber-700" />
                <span>Multi-Modal Diabetic Risk Biomarkers (Optional but Recommended)</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-amber-900 mb-1">
                    Diabetes Duration (Years)
                  </label>
                  <input
                    name="diabetes_years"
                    type="number"
                    min="0"
                    max="60"
                    placeholder="e.g. 10"
                    className="w-full bg-white border border-amber-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-amber-700 mt-0.5 block">&gt;10 yrs increases risk 3x</span>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-amber-900 mb-1">
                    HbA1c Level (%)
                  </label>
                  <input
                    name="hba1c"
                    type="number"
                    step="0.1"
                    min="4"
                    max="20"
                    placeholder="e.g. 8.5"
                    className="w-full bg-white border border-amber-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-amber-700 mt-0.5 block">&ge;8.0% elevates microvascular risk</span>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-amber-900 mb-1">
                    Systolic BP (mmHg)
                  </label>
                  <input
                    name="sys_bp"
                    type="number"
                    min="60"
                    max="260"
                    placeholder="e.g. 135"
                    className="w-full bg-white border border-amber-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-amber-700 mt-0.5 block">&ge;140 aggravates edema</span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Village / PHC Center</label>
              <input
                name="village"
                placeholder="e.g. PHC Shivpuri, Vidisha District"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-blue-700 text-white py-3 rounded-lg text-sm font-bold hover:bg-blue-800 transition flex items-center justify-center gap-2 shadow-sm"
            >
              <span>Save & Proceed to Fundus Camera Import</span>
              <ArrowRight size={16} />
            </button>
          </form>

          <button
            onClick={() => {
              setVitals({ name: "Anonymous Patient", age: 55, abha_id: "ANON-DEMO" });
              setStep(1);
            }}
            className="w-full text-center text-xs text-gray-400 hover:text-gray-600 transition"
          >
            Skip registration (Quick anonymous screening mode)
          </button>
        </div>
      )}

      {/* ── STEP 1: FUNDUS IMAGE IMPORT ───────────────────── */}
      {step === 1 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
          {/* Patient Header Badge */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div>
              <span className="text-gray-500">Patient: </span>
              <strong className="text-gray-900 font-semibold">{vitals.name || "Anonymous"}</strong>
              {vitals.age && <span className="text-gray-600"> ({vitals.age}y / {vitals.gender})</span>}
            </div>
            {vitals.abha_id && (
              <div className="font-mono bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-[11px]">
                ABHA: {vitals.abha_id}
              </div>
            )}
            <button
              onClick={() => setStep(0)}
              className="text-blue-600 hover:underline text-[11px]"
            >
              Edit Vitals
            </button>
          </div>

          <ImageCapture onImageReady={setImageFile} disabled={loading} />

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {queued && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-800 flex items-center gap-2">
              <WifiOff size={16} className="text-orange-600 flex-shrink-0" />
              <span>
                <strong>Saved to Offline Queue.</strong> Image will be analysed and synced when connectivity is restored.
              </span>
            </div>
          )}

          {pendingCount > 0 && !queued && (
            <div className="flex items-center gap-2 text-xs text-orange-600 bg-orange-50/50 p-2 rounded">
              <Clock size={14} />
              <span>{pendingCount} screening(s) queued for offline sync.</span>
            </div>
          )}

          <button
            onClick={handleAnalyse}
            disabled={!imageFile || loading}
            className="w-full bg-blue-700 text-white py-3.5 rounded-lg text-sm font-bold
                       hover:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed transition
                       flex items-center justify-center gap-2 shadow-md"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>Running AI Preprocessing & Multi-Modal Diagnostics...</span>
              </>
            ) : (
              <>
                <Eye size={18} />
                <span>Run Diagnostic Screening</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* ── STEP 2: RESULTS & DOCTOR TRIAGE ───────────────── */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 p-4">
            <div>
              <h2 className="text-base font-bold text-gray-900">Screening Complete</h2>
              <p className="text-xs text-gray-500">
                Patient: <span className="font-semibold text-gray-800">{vitals.name}</span> | ABHA: <span className="font-mono text-gray-700">{vitals.abha_id}</span>
              </p>
            </div>
            <button
              onClick={reset}
              className="bg-blue-50 text-blue-700 hover:bg-blue-100 px-3 py-1.5 rounded-lg text-xs font-semibold transition"
            >
              + Screen Next Patient
            </button>
          </div>

          <ResultSection result={result} onValidate={handleValidate} />
        </div>
      )}
    </div>
  );
}

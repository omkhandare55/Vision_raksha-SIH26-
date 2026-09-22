// src/pages/ScreenPage.jsx
// Full clinical screening flow:
// Step 1: Patient Intake (ABHA ID, Age, Gender, HbA1c, Diabetes Duration, BP)
// Step 2: Fundus Camera Image Import (No generic webcam)
// Step 3: Multi-Modal AI Diagnosis & Doctor Triage

import { useState, useEffect } from "react";
import { Loader2, UserPlus, WifiOff, Clock, ShieldCheck, HeartPulse, Activity, Eye, FileText, ArrowRight, Send, X, ChevronDown, Download } from "lucide-react";
import ImageCapture   from "../components/ImageCapture";
import ResultSection  from "../components/ResultSection";
import { analyseImage, validateScreening, createPatient, listDoctors, shareReport, downloadReport } from "../utils/api";
import { enqueueImage, getPendingCount } from "../utils/offlineQueue";
import { useAuth } from "../context/AuthContext";

const STEPS = ["Patient Intake", "Fundus Import", "AI Diagnostic Report"];

export default function ScreenPage() {
  const { user } = useAuth();
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

  // Share report modal state
  const [shareModal, setShareModal]   = useState(false);
  const [doctors, setDoctors]         = useState([]);
  const [selectedDoc, setSelectedDoc] = useState("");
  const [ashaNotes, setAshaNotes]     = useState("");
  const [sharing, setSharing]         = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);

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

  const openShareModal = async () => {
    setShareModal(true);
    setShareSuccess(false);
    try {
      const docs = await listDoctors();
      setDoctors(docs);
      if (docs.length > 0) setSelectedDoc(docs[0].user_id);
    } catch {
      setDoctors([]);
    }
  };

  const handleShare = async () => {
    if (!selectedDoc || !result?.screening_id) return;
    setSharing(true);
    try {
      await shareReport(result.screening_id, selectedDoc, ashaNotes);
      setShareSuccess(true);
    } catch (err) {
      console.error("Share failed:", err);
    } finally {
      setSharing(false);
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
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      {/* ── Step Indicator ─────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-6 card-static p-4">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2 flex-1">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold transition-all
              ${i < step  ? "bg-emerald-500 text-white"
              : i === step ? "bg-[#22AEB0] text-white ring-4 ring-[#22AEB0]/15 shadow-btn"
              : "bg-[#F7FAFB] text-[#94A1AB] border border-[#E1E9EC]"}`}>
              {i < step ? "✓" : i + 1}
            </div>
            <span className={`text-xs md:text-sm font-semibold ${i === step ? "text-[#1F2F42]" : "text-[#94A1AB]"}`}>
              {label}
            </span>
            {i < STEPS.length - 1 && <div className="flex-1 h-[2px] bg-[#E1E9EC]" />}
          </div>
        ))}
        {step > 0 && (
          <button onClick={reset} className="text-xs text-[#94A1AB] hover:text-rose-600 font-semibold ml-2 transition bg-[#F7FAFB] hover:bg-rose-50 px-3 py-1.5 rounded-xl border border-[#E1E9EC] cursor-pointer">
            ↺ Reset
          </button>
        )}
      </div>

      {/* ── STEP 0: PATIENT INTAKE & CLINICAL VITALS ──────── */}
      {step === 0 && (
        <div className="card-static p-6 space-y-5">
          <div className="border-b border-[#E1E9EC] pb-4">
            <div className="flex items-center gap-2 text-[#22AEB0]">
              <UserPlus size={22} />
              <h2 className="text-lg font-bold text-[#1F2F42]">Patient Registration & Clinical Intake</h2>
            </div>
            <p className="text-xs text-[#657685] font-medium mt-1">
              Compliant with Ayushman Bharat Digital Mission (ABDM). Collect patient demographics and metabolic biomarkers for multi-modal DR risk scoring.
            </p>
          </div>

          <form onSubmit={handlePatientSubmit} className="space-y-4">
            {/* Primary Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#657685] mb-1.5">Full Patient Name *</label>
                <input
                  name="name"
                  required
                  placeholder="e.g. Ramesh Chandra Verma"
                  className="input-themed"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#657685] mb-1.5 flex items-center justify-between">
                  <span>ABHA / Aadhaar ID</span>
                  <span className="text-[10px] text-[#22AEB0] font-mono flex items-center gap-0.5">
                    <ShieldCheck size={11} /> ABDM Linked
                  </span>
                </label>
                <input
                  name="abha_id"
                  placeholder="e.g. 91-4521-8902-1134"
                  className="input-themed font-mono"
                />
              </div>
            </div>

            {/* Demographics */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#657685] mb-1.5">Age (Years) *</label>
                <input
                  name="age"
                  type="number"
                  required
                  min="1"
                  max="120"
                  placeholder="58"
                  className="input-themed"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#657685] mb-1.5">Gender *</label>
                <select
                  name="gender"
                  className="input-themed"
                >
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                  <option value="O">Other</option>
                </select>
              </div>

              <div className="col-span-2 md:col-span-1">
                <label className="block text-xs font-semibold text-[#657685] mb-1.5">Phone (SMS Triage)</label>
                <input
                  name="phone"
                  placeholder="+91 98765 43210"
                  className="input-themed"
                />
              </div>
            </div>

            {/* Clinical Biomarkers Section */}
            <div className="bg-[#E8F7F6] border border-[#22AEB0]/15 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-[#1F2F42] font-bold text-xs">
                <HeartPulse size={16} className="text-[#22AEB0]" />
                <span>Multi-Modal Diabetic Risk Biomarkers (Optional but Recommended)</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#657685] mb-1">
                    Diabetes Duration (Years)
                  </label>
                  <input
                    name="diabetes_years"
                    type="number"
                    min="0"
                    max="60"
                    placeholder="e.g. 10"
                    className="input-themed py-2.5 bg-white"
                  />
                  <span className="text-[10px] text-[#94A1AB] mt-0.5 block">&gt;10 yrs increases risk 3x</span>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#657685] mb-1">
                    HbA1c Level (%)
                  </label>
                  <input
                    name="hba1c"
                    type="number"
                    step="0.1"
                    min="4"
                    max="20"
                    placeholder="e.g. 8.5"
                    className="input-themed py-2.5 bg-white"
                  />
                  <span className="text-[10px] text-[#94A1AB] mt-0.5 block">&ge;8.0% elevates microvascular risk</span>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#657685] mb-1">
                    Systolic BP (mmHg)
                  </label>
                  <input
                    name="sys_bp"
                    type="number"
                    min="60"
                    max="260"
                    placeholder="e.g. 135"
                    className="input-themed py-2.5 bg-white"
                  />
                  <span className="text-[10px] text-[#94A1AB] mt-0.5 block">&ge;140 aggravates edema</span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#657685] mb-1.5">Village / PHC Center</label>
              <input
                name="village"
                placeholder="e.g. PHC Shivpuri, Vidisha District"
                className="input-themed"
              />
            </div>

            <button
              type="submit"
              className="btn-primary w-full py-3.5 text-sm gap-2"
            >
              <span>Save & Proceed to Fundus Camera Import</span>
              <ArrowRight size={16} />
            </button>
          </form>

          <button
            onClick={() => {
              setVitals({ name: "Anonymous Patient", age: 55, abha_id: "ANON-CLINICAL" });
              setStep(1);
            }}
            className="w-full text-center text-xs text-[#94A1AB] hover:text-[#22AEB0] transition font-semibold cursor-pointer"
          >
            Skip registration (Quick anonymous screening mode)
          </button>
        </div>
      )}

      {/* ── STEP 1: FUNDUS IMAGE IMPORT ───────────────────── */}
      {step === 1 && (
        <div className="card-static p-6 space-y-5">
          {/* Patient Header Badge */}
          <div className="bg-[#F7FAFB] border border-[#E1E9EC] rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div>
              <span className="text-[#94A1AB] font-medium">Patient: </span>
              <strong className="text-[#1F2F42] font-semibold">{vitals.name || "Anonymous"}</strong>
              {vitals.age && <span className="text-[#657685]"> ({vitals.age}y / {vitals.gender})</span>}
            </div>
            {vitals.abha_id && (
              <div className="font-mono bg-white text-[#22AEB0] px-3 py-1 rounded-lg border border-[#E1E9EC] font-semibold text-[11px]">
                ABHA: {vitals.abha_id}
              </div>
            )}
            <button
              onClick={() => setStep(0)}
              className="text-[#22AEB0] hover:underline font-semibold text-[11px] cursor-pointer"
            >
              Edit Vitals
            </button>
          </div>

          <ImageCapture onImageReady={setImageFile} disabled={loading} />

          {error && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-sm text-rose-700 font-medium">
              {error}
            </div>
          )}

          {queued && (
            <div className="bg-[#E8F7F6] border border-[#22AEB0]/20 rounded-xl p-4 text-sm text-[#1F2F42] flex items-center gap-2 font-medium">
              <WifiOff size={16} className="text-[#22AEB0] flex-shrink-0" />
              <span>
                <strong>Saved to Offline Queue.</strong> Image will be analysed and synced when connectivity is restored.
              </span>
            </div>
          )}

          {pendingCount > 0 && !queued && (
            <div className="flex items-center gap-2 text-xs text-[#657685] bg-[#F7FAFB] p-3 rounded-xl border border-[#E1E9EC] font-medium">
              <Clock size={14} className="text-[#22AEB0]" />
              <span>{pendingCount} screening(s) queued for offline sync.</span>
            </div>
          )}

          <button
            onClick={handleAnalyse}
            disabled={!imageFile || loading}
            className="btn-primary w-full py-3.5 text-sm gap-2"
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
          <div className="flex items-center justify-between card-static p-4">
            <div>
              <h2 className="text-base font-bold text-[#1F2F42]">Screening Complete</h2>
              <p className="text-xs text-[#657685] font-medium">
                Patient: <span className="font-semibold text-[#263746]">{vitals.name}</span> | ABHA: <span className="font-mono text-[#263746]">{vitals.abha_id}</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              {result?.screening_id && (
                <button
                  onClick={() => downloadReport(result.screening_id)}
                  className="btn-outline text-xs py-2 px-4 gap-2"
                >
                  <Download size={14} />
                  Download PDF
                </button>
              )}
              <button
                onClick={openShareModal}
                className="btn-primary text-xs py-2 px-4 gap-2 bg-[#22AEB0] hover:bg-[#1d9ea0]"
              >
                <Send size={14} />
                Share with Doctor
              </button>
              <button onClick={reset} className="btn-outline text-xs py-2 px-4">
                + Screen Next
              </button>
            </div>
          </div>

          <ResultSection result={result} onValidate={(user?.role === "doctor" || user?.role === "admin") ? handleValidate : null} />
        </div>
      )}

      {/* ── Share Report Modal ──────────────────────────────── */}
      {shareModal && (
        <div className="fixed inset-0 bg-[#1F2F42]/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-[#E1E9EC] w-full max-w-md p-8 relative">
            <button
              onClick={() => setShareModal(false)}
              className="absolute top-5 right-5 text-[#94A1AB] hover:text-[#1F2F42] transition cursor-pointer"
            >
              <X size={20} />
            </button>

            {shareSuccess ? (
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-[#E8F7F6] rounded-full flex items-center justify-center mx-auto mb-4">
                  <Send size={28} className="text-[#22AEB0]" />
                </div>
                <h3 className="text-lg font-bold text-[#1F2F42] mb-2">Report Shared!</h3>
                <p className="text-sm text-[#657685]">
                  The report has been sent to the doctor for review. You'll see their response in <strong>My Reports</strong>.
                </p>
                <button
                  onClick={() => setShareModal(false)}
                  className="btn-primary w-full mt-6 py-3 text-sm"
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2.5 bg-[#E8F7F6] rounded-xl">
                    <Send size={20} className="text-[#22AEB0]" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-[#1F2F42]">Share Report with Doctor</h2>
                    <p className="text-xs text-[#94A1AB]">Select a doctor and add optional notes</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#657685] mb-1.5">Select Doctor *</label>
                    {doctors.length === 0 ? (
                      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700 font-medium">
                        No doctors available. Ask your admin to add doctor accounts.
                      </div>
                    ) : (
                      <select
                        className="input-themed"
                        value={selectedDoc}
                        onChange={e => setSelectedDoc(e.target.value)}
                      >
                        {doctors.map(d => (
                          <option key={d.user_id} value={d.user_id}>
                            {d.name}{d.phc_id ? ` — ${d.phc_id}` : ""}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#657685] mb-1.5">
                      Notes to Doctor <span className="text-[#94A1AB] font-normal">(optional)</span>
                    </label>
                    <textarea
                      rows={3}
                      className="input-themed resize-none"
                      placeholder="e.g. Patient complained of blurring vision for 2 months..."
                      value={ashaNotes}
                      onChange={e => setAshaNotes(e.target.value)}
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setShareModal(false)}
                      className="flex-1 px-4 py-3 text-sm font-semibold text-[#657685] bg-[#F7FAFB] border border-[#E1E9EC] rounded-xl hover:bg-[#E1E9EC] transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleShare}
                      disabled={sharing || !selectedDoc}
                      className="flex-1 btn-primary py-3 text-sm gap-2"
                    >
                      {sharing ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <><Send size={14} /> Send to Doctor</>
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

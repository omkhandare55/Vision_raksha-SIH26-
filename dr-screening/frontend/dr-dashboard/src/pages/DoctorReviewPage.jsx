// src/pages/DoctorReviewPage.jsx
// Doctor's review queue — see reports shared by ASHA workers, submit full clinical review

import { useState, useEffect } from "react";
import {
  ClipboardList, CheckCircle, AlertTriangle, Clock,
  RefreshCw, Send, ChevronDown, ChevronUp, Eye
} from "lucide-react";
import { getPendingReviews, submitDoctorReview } from "../utils/api";

const GRADE_OPTIONS = [
  { value: 0, label: "Grade 0 — No DR",           color: "text-emerald-600" },
  { value: 1, label: "Grade 1 — Mild DR",          color: "text-yellow-600"  },
  { value: 2, label: "Grade 2 — Moderate DR",      color: "text-orange-500"  },
  { value: 3, label: "Grade 3 — Severe DR",        color: "text-red-600"     },
  { value: 4, label: "Grade 4 — Proliferative DR", color: "text-red-900"     },
];

const URGENCY_OPTIONS = [
  { value: "routine",   label: "Routine",   icon: "🟢", desc: "Follow-up in 6–12 months" },
  { value: "urgent",    label: "Urgent",    icon: "🟡", desc: "Refer within 2–4 weeks"   },
  { value: "emergency", label: "Emergency", icon: "🔴", desc: "Immediate ophthalmologist" },
];

const GRADE_COLOR = ["bg-emerald-50 border-emerald-200 text-emerald-700", "bg-yellow-50 border-yellow-200 text-yellow-700", "bg-orange-50 border-orange-200 text-orange-700", "bg-red-50 border-red-200 text-red-700", "bg-rose-100 border-rose-300 text-rose-800"];

export default function DoctorReviewPage() {
  const [reports, setReports]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [expanded, setExpanded]   = useState(null);  // screening_id of expanded card
  const [submitting, setSubmitting] = useState(null);
  const [toast, setToast]         = useState(null);
  const [reviews, setReviews]     = useState({});   // { screening_id: form state }

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchReports = async () => {
    setLoading(true);
    try {
      const data = await getPendingReviews();
      setReports(data);
      // Init form state for each report
      const init = {};
      data.forEach(r => {
        init[r.screening_id] = {
          confirmed_grade:          r.grade ?? 0,
          review_description:       "",
          treatment_recommendation: "",
          urgency:                  "routine",
        };
      });
      setReviews(init);
    } catch {
      showToast("Failed to load review queue", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReports(); }, []);

  const handleReviewSubmit = async (screeningId) => {
    const form = reviews[screeningId];
    if (!form?.review_description?.trim()) {
      showToast("Please enter a clinical review description", "error");
      return;
    }
    setSubmitting(screeningId);
    try {
      await submitDoctorReview(screeningId, form);
      showToast("Review submitted successfully!");
      setReports(prev => prev.filter(r => r.screening_id !== screeningId));
      setExpanded(null);
    } catch (err) {
      showToast(err.response?.data?.detail?.message || "Failed to submit review", "error");
    } finally {
      setSubmitting(null);
    }
  };

  const updateForm = (screeningId, field, value) => {
    setReviews(prev => ({
      ...prev,
      [screeningId]: { ...prev[screeningId], [field]: value }
    }));
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl border text-sm font-semibold
          ${toast.type === "error"
            ? "bg-rose-50 border-rose-200 text-rose-700"
            : "bg-[#E8F7F6] border-[#22AEB0]/30 text-[#1F2F42]"}`}
        >
          {toast.type === "error" ? <AlertTriangle size={18} /> : <CheckCircle size={18} className="text-[#22AEB0]" />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1F2F42] tracking-tight">Review Queue</h1>
          <p className="text-xs text-[#94A1AB] font-medium mt-0.5">
            Reports shared by ASHA workers awaiting your clinical review
          </p>
        </div>
        <button onClick={fetchReports} disabled={loading} className="btn-primary gap-2 text-xs py-2.5 px-4">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card-static p-4 flex items-center gap-3">
          <div className="p-2.5 bg-amber-50 rounded-xl"><Clock size={18} className="text-amber-500" /></div>
          <div>
            <p className="text-xl font-bold text-[#1F2F42]">{reports.length}</p>
            <p className="text-xs text-[#657685] font-semibold">Pending Review</p>
          </div>
        </div>
        <div className="card-static p-4 flex items-center gap-3">
          <div className="p-2.5 bg-rose-50 rounded-xl"><AlertTriangle size={18} className="text-rose-500" /></div>
          <div>
            <p className="text-xl font-bold text-[#1F2F42]">{reports.filter(r => r.grade >= 3).length}</p>
            <p className="text-xs text-[#657685] font-semibold">High Severity</p>
          </div>
        </div>
        <div className="card-static p-4 flex items-center gap-3">
          <div className="p-2.5 bg-[#E8F7F6] rounded-xl"><ClipboardList size={18} className="text-[#22AEB0]" /></div>
          <div>
            <p className="text-xl font-bold text-[#1F2F42]">{reports.filter(r => r.grade >= 2).length}</p>
            <p className="text-xs text-[#657685] font-semibold">Referral Needed</p>
          </div>
        </div>
      </div>

      {/* Empty state */}
      {!loading && reports.length === 0 && (
        <div className="card-static p-12 text-center">
          <CheckCircle size={48} className="text-[#22AEB0]/30 mx-auto mb-4" />
          <h3 className="font-bold text-[#1F2F42] mb-1">All caught up!</h3>
          <p className="text-sm text-[#94A1AB]">No reports pending review right now.</p>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="card-static p-5 animate-pulse">
              <div className="flex gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#E1E9EC]" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-1/3 bg-[#E1E9EC] rounded" />
                  <div className="h-3 w-1/2 bg-[#E1E9EC] rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Report Cards */}
      <div className="space-y-4">
        {reports.map(report => {
          const isExpanded = expanded === report.screening_id;
          const form = reviews[report.screening_id] || {};

          return (
            <div
              key={report.screening_id}
              className={`card-static border transition-all duration-200 overflow-hidden
                ${isExpanded ? "border-[#22AEB0]/40 shadow-card" : "border-[#E1E9EC]"}`}
            >
              {/* Card Header */}
              <div
                className="p-5 flex items-start justify-between cursor-pointer hover:bg-[#F7FAFB] transition-colors"
                onClick={() => setExpanded(isExpanded ? null : report.screening_id)}
              >
                <div className="flex items-start gap-4">
                  {/* Grade badge */}
                  <div className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex-shrink-0 ${GRADE_COLOR[report.grade] ?? GRADE_COLOR[0]}`}>
                    G{report.grade}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-[#1F2F42]">{report.patient_name}</span>
                      {report.patient_age && (
                        <span className="text-xs text-[#94A1AB]">
                          {report.patient_age}y {report.patient_gender}
                        </span>
                      )}
                      <span className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full border ${GRADE_COLOR[report.grade] ?? GRADE_COLOR[0]}`}>
                        {report.grade_label}
                      </span>
                    </div>
                    <p className="text-xs text-[#657685] mt-1">
                      Screened {new Date(report.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                    {report.asha_notes && (
                      <p className="text-xs text-[#657685] mt-1 italic">
                        📝 ASHA note: "{report.asha_notes}"
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="hidden sm:inline text-xs text-amber-600 font-semibold bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                    ⏳ Pending Review
                  </span>
                  {isExpanded ? <ChevronUp size={18} className="text-[#94A1AB]" /> : <ChevronDown size={18} className="text-[#94A1AB]" />}
                </div>
              </div>

              {/* Expanded Review Form */}
              {isExpanded && (
                <div className="border-t border-[#E1E9EC] p-6 space-y-5 bg-[#FAFCFD]">
                  {/* Images */}
                  {(report.image_url || report.heatmap_url) && (
                    <div className="grid grid-cols-2 gap-3">
                      {report.image_url && (
                        <div>
                          <p className="text-xs font-semibold text-[#657685] mb-2 flex items-center gap-1.5">
                            <Eye size={12} /> Fundus Image
                          </p>
                          <img
                            src={report.image_url}
                            alt="Fundus"
                            className="w-full aspect-square object-cover rounded-xl border border-[#E1E9EC]"
                          />
                        </div>
                      )}
                      {report.heatmap_url && (
                        <div>
                          <p className="text-xs font-semibold text-[#657685] mb-2">🔥 Grad-CAM Heatmap</p>
                          <img
                            src={report.heatmap_url}
                            alt="Heatmap"
                            className="w-full aspect-square object-cover rounded-xl border border-[#E1E9EC]"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* AI Findings */}
                  {report.findings?.length > 0 && (
                    <div className="bg-[#E8F7F6] border border-[#22AEB0]/20 rounded-xl p-4">
                      <p className="text-xs font-bold text-[#1F2F42] mb-2">🤖 AI Findings</p>
                      <ul className="space-y-1">
                        {report.findings.map((f, i) => (
                          <li key={i} className="text-xs text-[#657685] flex items-start gap-1.5">
                            <span className="text-[#22AEB0] font-bold mt-0.5">•</span>
                            {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Review Form */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-[#1F2F42] flex items-center gap-2">
                      <ClipboardList size={16} className="text-[#22AEB0]" />
                      Your Clinical Review
                    </h3>

                    {/* Confirmed Grade */}
                    <div>
                      <label className="block text-xs font-semibold text-[#657685] mb-2">Confirmed DR Grade *</label>
                      <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                        {GRADE_OPTIONS.map(opt => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => updateForm(report.screening_id, "confirmed_grade", opt.value)}
                            className={`px-3 py-2.5 text-xs font-semibold rounded-xl border transition-all cursor-pointer text-left
                              ${form.confirmed_grade === opt.value
                                ? "bg-[#22AEB0] text-white border-[#22AEB0] shadow-btn"
                                : "bg-white text-[#657685] border-[#E1E9EC] hover:border-[#22AEB0]/50"}`}
                          >
                            Grade {opt.value}
                            <span className="block text-[10px] opacity-75 font-normal">{opt.label.split(" — ")[1]}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Review Description */}
                    <div>
                      <label className="block text-xs font-semibold text-[#657685] mb-1.5">
                        Clinical Review Description * <span className="text-[#94A1AB] font-normal">(visible to ASHA worker)</span>
                      </label>
                      <textarea
                        rows={5}
                        className="input-themed resize-none leading-relaxed"
                        placeholder="Describe your clinical findings, assessment, and observations about the retinal images. This will be shared back to the ASHA worker."
                        value={form.review_description}
                        onChange={e => updateForm(report.screening_id, "review_description", e.target.value)}
                      />
                    </div>

                    {/* Treatment Recommendation */}
                    <div>
                      <label className="block text-xs font-semibold text-[#657685] mb-1.5">Treatment Recommendation</label>
                      <textarea
                        rows={3}
                        className="input-themed resize-none leading-relaxed"
                        placeholder="e.g. Refer to ophthalmologist, lifestyle modifications, follow-up schedule..."
                        value={form.treatment_recommendation}
                        onChange={e => updateForm(report.screening_id, "treatment_recommendation", e.target.value)}
                      />
                    </div>

                    {/* Urgency */}
                    <div>
                      <label className="block text-xs font-semibold text-[#657685] mb-2">Urgency Level *</label>
                      <div className="grid grid-cols-3 gap-2">
                        {URGENCY_OPTIONS.map(opt => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => updateForm(report.screening_id, "urgency", opt.value)}
                            className={`px-3 py-3 text-xs font-semibold rounded-xl border transition-all cursor-pointer text-left
                              ${form.urgency === opt.value
                                ? "bg-[#22AEB0] text-white border-[#22AEB0] shadow-btn"
                                : "bg-white text-[#657685] border-[#E1E9EC] hover:border-[#22AEB0]/50"}`}
                          >
                            <span className="text-base block mb-0.5">{opt.icon}</span>
                            {opt.label}
                            <span className="block text-[10px] opacity-75 font-normal mt-0.5">{opt.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Submit */}
                    <button
                      onClick={() => handleReviewSubmit(report.screening_id)}
                      disabled={submitting === report.screening_id}
                      className="btn-primary w-full py-3.5 text-sm gap-2"
                    >
                      {submitting === report.screening_id ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <Send size={16} />
                          Submit Review & Notify ASHA Worker
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

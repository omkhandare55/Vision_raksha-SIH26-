// src/pages/ReportsPage.jsx
// ASHA Worker's report history — see sent reports and doctor responses

import { useState, useEffect } from "react";
import {
  ClipboardList, Clock, CheckCircle, Send,
  RefreshCw, ChevronDown, ChevronUp, Eye, Download
} from "lucide-react";
import { getMyReports, getReportUrl } from "../utils/api";

const STATUS_META = {
  draft:          { label: "Draft",          icon: Clock,          color: "bg-gray-50 text-gray-600 border-gray-200",   dot: "bg-gray-400" },
  pending_review: { label: "Pending Review", icon: Clock,          color: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  reviewed:       { label: "Reviewed",       icon: CheckCircle,    color: "bg-[#E8F7F6] text-[#22AEB0] border-[#22AEB0]/30", dot: "bg-[#22AEB0]" },
};

const URGENCY_META = {
  routine:   { label: "Routine",   color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  urgent:    { label: "Urgent",    color: "text-amber-700   bg-amber-50   border-amber-200"   },
  emergency: { label: "Emergency", color: "text-rose-700    bg-rose-50    border-rose-200"     },
};

const GRADE_COLORS = ["bg-emerald-50 border-emerald-200 text-emerald-700", "bg-yellow-50 border-yellow-200 text-yellow-700", "bg-orange-50 border-orange-200 text-orange-700", "bg-red-50 border-red-200 text-red-700", "bg-rose-100 border-rose-300 text-rose-800"];

export default function ReportsPage() {
  const [reports, setReports]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [filter, setFilter]     = useState("all");

  const fetchReports = async () => {
    setLoading(true);
    try {
      const data = await getMyReports();
      setReports(data);
    } catch {
      // Silently fail if backend is offline
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReports(); }, []);

  const filtered = filter === "all"
    ? reports
    : reports.filter(r => r.report_status === filter);

  const counts = {
    all:            reports.length,
    draft:          reports.filter(r => r.report_status === "draft").length,
    pending_review: reports.filter(r => r.report_status === "pending_review").length,
    reviewed:       reports.filter(r => r.report_status === "reviewed").length,
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1F2F42] tracking-tight">My Reports</h1>
          <p className="text-xs text-[#94A1AB] font-medium mt-0.5">
            Track your screening reports and doctor reviews
          </p>
        </div>
        <button onClick={fetchReports} disabled={loading} className="btn-primary gap-2 text-xs py-2.5 px-4">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card-static p-4 text-center">
          <p className="text-2xl font-bold text-[#22AEB0]">{counts.all}</p>
          <p className="text-xs text-[#657685] font-semibold mt-0.5">Total Reports</p>
        </div>
        <div className="card-static p-4 text-center">
          <p className="text-2xl font-bold text-amber-500">{counts.pending_review}</p>
          <p className="text-xs text-[#657685] font-semibold mt-0.5">Awaiting Doctor</p>
        </div>
        <div className="card-static p-4 text-center">
          <p className="text-2xl font-bold text-emerald-500">{counts.reviewed}</p>
          <p className="text-xs text-[#657685] font-semibold mt-0.5">Doctor Reviewed</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {[
          { key: "all",            label: "All Reports"     },
          { key: "reviewed",       label: "✅ Reviewed"     },
          { key: "pending_review", label: "⏳ Pending"      },
          { key: "draft",          label: "📋 Draft"        },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-4 py-2 text-xs font-semibold rounded-xl border transition-all whitespace-nowrap cursor-pointer
              ${filter === tab.key
                ? "bg-[#22AEB0] text-white border-[#22AEB0] shadow-btn"
                : "bg-white text-[#657685] border-[#E1E9EC] hover:border-[#22AEB0]/40"}`}
          >
            {tab.label}
            <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-bold
              ${filter === tab.key ? "bg-white/20" : "bg-[#F7FAFB] text-[#94A1AB]"}`}
            >
              {counts[tab.key]}
            </span>
          </button>
        ))}
      </div>

      {/* Empty */}
      {!loading && filtered.length === 0 && (
        <div className="card-static p-12 text-center">
          <ClipboardList size={48} className="text-[#E1E9EC] mx-auto mb-4" />
          <h3 className="font-bold text-[#1F2F42] mb-1">No reports here</h3>
          <p className="text-sm text-[#94A1AB]">
            {filter === "all"
              ? "Screen a patient to generate your first report."
              : `No ${filter.replace("_", " ")} reports found.`}
          </p>
        </div>
      )}

      {/* Loading */}
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

      {/* Report cards */}
      <div className="space-y-3">
        {filtered.map(report => {
          const isExpanded = expanded === report.screening_id;
          const statusMeta = STATUS_META[report.report_status] || STATUS_META.draft;

          return (
            <div
              key={report.screening_id}
              className={`card-static border overflow-hidden transition-all duration-200
                ${isExpanded ? "border-[#22AEB0]/40 shadow-card" : "border-[#E1E9EC]"}
                ${report.report_status === "reviewed" ? "ring-1 ring-[#22AEB0]/20" : ""}`}
            >
              {/* Card Header */}
              <div
                className="p-5 flex items-start justify-between cursor-pointer hover:bg-[#F7FAFB] transition-colors"
                onClick={() => setExpanded(isExpanded ? null : report.screening_id)}
              >
                <div className="flex items-start gap-4">
                  <div className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex-shrink-0 ${GRADE_COLORS[report.grade] ?? GRADE_COLORS[0]}`}>
                    G{report.grade}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-[#1F2F42]">{report.patient_name}</span>
                      {report.patient_age && (
                        <span className="text-xs text-[#94A1AB]">{report.patient_age}y</span>
                      )}
                      <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${statusMeta.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dot}`} />
                        {statusMeta.label}
                      </span>
                    </div>
                    <p className="text-xs text-[#657685] mt-1">
                      {report.grade_label} · {new Date(report.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {report.report_status === "reviewed" && (
                    <span className="hidden sm:flex items-center gap-1 text-xs font-semibold text-[#22AEB0]">
                      <CheckCircle size={14} /> Doctor reviewed
                    </span>
                  )}
                  <a
                    href={getReportUrl(report.screening_id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1.5 text-xs font-semibold text-[#657685] hover:text-[#22AEB0] bg-[#F7FAFB] hover:bg-[#E8F7F6] border border-[#E1E9EC] rounded-lg px-3 py-1.5 transition no-underline"
                    title="Download PDF Report"
                  >
                    <Download size={13} />
                    <span className="hidden sm:inline">PDF</span>
                  </a>
                  {isExpanded ? <ChevronUp size={18} className="text-[#94A1AB]" /> : <ChevronDown size={18} className="text-[#94A1AB]" />}
                </div>
              </div>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="border-t border-[#E1E9EC] p-6 space-y-5 bg-[#FAFCFD]">
                  {/* AI Result */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    <div className="space-y-3">
                      <div className="bg-white border border-[#E1E9EC] rounded-xl p-4">
                        <p className="text-xs font-bold text-[#657685] mb-1">AI Result</p>
                        <p className={`font-bold text-sm ${GRADE_COLORS[report.grade]?.split(" ")[2] ?? ""}`}>{report.grade_label}</p>
                        <p className="text-xs text-[#94A1AB] mt-0.5">Confidence: {(report.confidence ?? 0).toFixed(1)}%</p>
                      </div>
                      {report.findings?.length > 0 && (
                        <div className="bg-[#E8F7F6] border border-[#22AEB0]/20 rounded-xl p-4">
                          <p className="text-xs font-bold text-[#1F2F42] mb-2">AI Findings</p>
                          <ul className="space-y-1">
                            {report.findings.map((f, i) => (
                              <li key={i} className="text-xs text-[#657685] flex items-start gap-1.5">
                                <span className="text-[#22AEB0] font-bold">•</span> {f}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Doctor Review Response */}
                  {report.doctor_review ? (
                    <div className="bg-white border-2 border-[#22AEB0]/30 rounded-2xl p-5 space-y-4">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle size={18} className="text-[#22AEB0]" />
                        <h3 className="font-bold text-[#1F2F42]">Doctor's Review</h3>
                        {report.doctor_review.doctor_name && (
                          <span className="text-xs text-[#94A1AB]">— {report.doctor_review.doctor_name}</span>
                        )}
                        {report.doctor_review.urgency && (
                          <span className={`ml-auto text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${URGENCY_META[report.doctor_review.urgency]?.color ?? ""}`}>
                            {URGENCY_META[report.doctor_review.urgency]?.label}
                          </span>
                        )}
                      </div>

                      {/* Confirmed grade */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[#657685] font-semibold">Confirmed Grade:</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-lg border ${GRADE_COLORS[report.doctor_review.confirmed_grade] ?? GRADE_COLORS[0]}`}>
                          {report.doctor_review.confirmed_grade_label ?? `Grade ${report.doctor_review.confirmed_grade}`}
                        </span>
                      </div>

                      {/* Review description */}
                      <div>
                        <p className="text-xs font-bold text-[#657685] mb-1.5">Clinical Review</p>
                        <p className="text-sm text-[#263746] leading-relaxed bg-[#F7FAFB] rounded-xl p-4 border border-[#E1E9EC]">
                          {report.doctor_review.review_description}
                        </p>
                      </div>

                      {/* Treatment */}
                      {report.doctor_review.treatment_recommendation && (
                        <div>
                          <p className="text-xs font-bold text-[#657685] mb-1.5">Treatment Recommendation</p>
                          <p className="text-sm text-[#263746] leading-relaxed bg-[#F7FAFB] rounded-xl p-4 border border-[#E1E9EC]">
                            {report.doctor_review.treatment_recommendation}
                          </p>
                        </div>
                      )}

                      <p className="text-[10px] text-[#94A1AB]">
                        Reviewed {report.doctor_review.reviewed_at
                          ? new Date(report.doctor_review.reviewed_at).toLocaleString("en-IN")
                          : "—"}
                      </p>
                    </div>
                  ) : report.report_status === "pending_review" ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
                      <Clock size={20} className="text-amber-500 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-bold text-amber-800">Awaiting Doctor Review</p>
                        <p className="text-xs text-amber-600 mt-0.5">The doctor will review and send back their clinical assessment shortly.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-[#F7FAFB] border border-[#E1E9EC] rounded-xl p-4 text-center">
                      <Send size={20} className="text-[#94A1AB] mx-auto mb-2" />
                      <p className="text-sm text-[#94A1AB]">Use the <strong>Screen</strong> page to share this report with a doctor.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

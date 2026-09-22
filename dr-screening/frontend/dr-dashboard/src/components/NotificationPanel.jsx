// src/components/NotificationPanel.jsx
// Notification bell + dropdown panel — role-aware
// Doctors see new reports pending review
// ASHA workers see doctor review responses
// Admin sees both

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Bell, X, Check, CheckCheck, Send,
  AlertTriangle, Clock, Trash2, BellOff
} from "lucide-react";
import { getPendingReviews, getMyReports } from "../utils/api";
import { useAuth } from "../context/AuthContext";

const GRADE_LABELS = {
  0: "No DR", 1: "Mild DR", 2: "Moderate DR",
  3: "Severe DR", 4: "Proliferative DR",
};

const URGENCY_STYLE = {
  routine:   "bg-emerald-50 text-emerald-700 border-emerald-200",
  urgent:    "bg-amber-50 text-amber-700 border-amber-200",
  emergency: "bg-rose-50 text-rose-700 border-rose-200",
};

// Persist read notifications in localStorage
function getReadIds() {
  try {
    return JSON.parse(localStorage.getItem("vr_read_notifications") || "[]");
  } catch { return []; }
}

function saveReadIds(ids) {
  localStorage.setItem("vr_read_notifications", JSON.stringify(ids));
}

export default function NotificationPanel() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [readIds, setReadIds] = useState(getReadIds);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef(null);

  const role = user?.role;

  // Build notification list from API data
  const fetchNotifications = useCallback(async () => {
    if (!role) return;
    setLoading(true);
    const items = [];

    try {
      // Doctors / Admin — pending reviews assigned to them
      if (role === "doctor" || role === "admin") {
        try {
          const pending = await getPendingReviews();
          (pending || []).forEach((s) => {
            items.push({
              id: `review_pending_${s.screening_id}`,
              type: "review_pending",
              icon: Send,
              title: "New Report for Review",
              message: `${s.patient_name || "Patient"} (${GRADE_LABELS[s.grade] || "Grade " + s.grade}) — shared by ${s.screened_by || "ASHA worker"}`,
              detail: s.asha_notes ? `Notes: "${s.asha_notes}"` : null,
              grade: s.grade,
              time: s.created_at,
              link: "/reviews",
            });
          });
        } catch { /* endpoint may 403 */ }
      }

      // ASHA workers / Admin — reports that got doctor feedback
      if (role === "asha" || role === "field_worker" || role === "admin") {
        try {
          const reports = await getMyReports();
          (reports || []).forEach((s) => {
            if (s.doctor_review) {
              const rev = s.doctor_review;
              items.push({
                id: `review_done_${s.screening_id}`,
                type: "review_completed",
                icon: Check,
                title: "Doctor Review Received",
                message: `Dr. ${rev.doctor_name || "Doctor"} reviewed ${s.patient_name || "patient"} — ${rev.confirmed_grade_label || GRADE_LABELS[rev.confirmed_grade]}`,
                detail: rev.treatment_recommendation || null,
                urgency: rev.urgency,
                grade: rev.confirmed_grade,
                time: rev.reviewed_at || s.created_at,
                link: "/reports",
              });
            }

            // Pending review notifications for ASHA
            if (s.report_status === "pending_review" && !s.doctor_review) {
              items.push({
                id: `shared_pending_${s.screening_id}`,
                type: "shared_pending",
                icon: Clock,
                title: "Report Awaiting Review",
                message: `${s.patient_name || "Patient"} — sent for doctor review`,
                detail: null,
                grade: s.grade,
                time: s.created_at,
                link: "/reports",
              });
            }
          });
        } catch { /* endpoint may 403 */ }
      }
    } catch { /* network error */ }

    // Sort by time (newest first)
    items.sort((a, b) => {
      const ta = a.time ? new Date(a.time).getTime() : 0;
      const tb = b.time ? new Date(b.time).getTime() : 0;
      return tb - ta;
    });

    setNotifications(items);
    setLoading(false);
  }, [role]);

  // Fetch on mount and every 60s
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    function handleEsc(e) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [open]);

  // Derived state
  const unreadCount = notifications.filter((n) => !readIds.includes(n.id)).length;

  const markAsRead = (id) => {
    const next = [...new Set([...readIds, id])];
    setReadIds(next);
    saveReadIds(next);
  };

  const markAllRead = () => {
    const next = [...new Set([...readIds, ...notifications.map((n) => n.id)])];
    setReadIds(next);
    saveReadIds(next);
  };

  const dismissNotification = (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    markAsRead(id);
  };

  const clearAll = () => {
    markAllRead();
    setNotifications([]);
  };

  const formatTime = (isoStr) => {
    if (!isoStr) return "";
    const d = new Date(isoStr);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  };

  const gradeColor = (grade) => {
    if (grade >= 3) return "text-rose-600";
    if (grade === 2) return "text-orange-600";
    if (grade === 1) return "text-amber-600";
    return "text-emerald-600";
  };

  const typeStyle = {
    review_pending:   { bg: "bg-blue-50", iconColor: "text-blue-600", border: "border-blue-100" },
    review_completed: { bg: "bg-emerald-50", iconColor: "text-emerald-600", border: "border-emerald-100" },
    shared_pending:   { bg: "bg-amber-50", iconColor: "text-amber-600", border: "border-amber-100" },
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Button */}
      <button
        onClick={() => {
          setOpen(!open);
          if (!open) fetchNotifications();
        }}
        className="relative text-[#94A1AB] hover:text-white transition p-2 rounded-lg hover:bg-white/5 cursor-pointer"
        aria-label="Notifications"
        id="notification-bell"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-[#22AEB0] text-white text-[10px] font-bold rounded-full px-1 shadow-lg animate-bounce"
            style={{ animationDuration: "2s", animationIterationCount: 3 }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
        {unreadCount === 0 && notifications.length > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#76D6D2] rounded-full" />
        )}
      </button>

      {/* Dropdown Panel */}
      {open && (
        <div
          className="absolute right-0 mt-2 w-[380px] max-h-[520px] bg-white rounded-2xl shadow-2xl border border-[#E1E9EC] z-50 overflow-hidden flex flex-col"
          style={{
            animation: "notifSlideDown 0.2s ease-out",
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#E1E9EC] bg-gradient-to-r from-[#F7FAFB] to-white">
            <div className="flex items-center gap-2">
              <Bell size={16} className="text-[#22AEB0]" />
              <h3 className="text-sm font-bold text-[#1F2F42]">Notifications</h3>
              {unreadCount > 0 && (
                <span className="bg-[#22AEB0] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {notifications.length > 0 && (
                <>
                  <button
                    onClick={markAllRead}
                    className="text-xs text-[#22AEB0] hover:text-[#1D9A9C] font-semibold px-2 py-1 rounded-lg hover:bg-[#E8F7F6] transition cursor-pointer"
                    title="Mark all as read"
                  >
                    <CheckCheck size={14} />
                  </button>
                  <button
                    onClick={clearAll}
                    className="text-xs text-[#94A1AB] hover:text-rose-500 font-semibold px-2 py-1 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                    title="Clear all"
                  >
                    <Trash2 size={14} />
                  </button>
                </>
              )}
              <button
                onClick={() => setOpen(false)}
                className="text-[#94A1AB] hover:text-[#1F2F42] p-1 rounded-lg hover:bg-[#F7FAFB] transition cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Notification List */}
          <div className="flex-1 overflow-y-auto overscroll-contain">
            {loading && notifications.length === 0 ? (
              <div className="p-8 flex flex-col items-center gap-3">
                <div className="w-6 h-6 border-2 border-[#E8F7F6] border-t-[#22AEB0] rounded-full animate-spin" />
                <p className="text-xs text-[#94A1AB] font-medium">Loading notifications…</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 flex flex-col items-center gap-3 text-center">
                <div className="w-14 h-14 rounded-2xl bg-[#F7FAFB] flex items-center justify-center">
                  <BellOff size={24} className="text-[#94A1AB]" />
                </div>
                <p className="text-sm font-semibold text-[#657685]">All caught up!</p>
                <p className="text-xs text-[#94A1AB] max-w-[220px] leading-relaxed">
                  No new notifications. Reports and reviews will appear here.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#E1E9EC]/60">
                {notifications.map((n) => {
                  const isRead = readIds.includes(n.id);
                  const style = typeStyle[n.type] || typeStyle.review_pending;
                  const Icon = n.icon || Bell;

                  return (
                    <div
                      key={n.id}
                      className={`group relative px-4 py-3 transition-all duration-200 cursor-pointer hover:bg-[#F7FAFB] ${
                        !isRead ? "bg-[#E8F7F6]/30" : ""
                      }`}
                      onClick={() => markAsRead(n.id)}
                    >
                      <div className="flex gap-3">
                        {/* Icon */}
                        <div className={`flex-shrink-0 w-9 h-9 rounded-xl ${style.bg} border ${style.border} flex items-center justify-center`}>
                          <Icon size={16} className={style.iconColor} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className={`text-xs font-bold leading-tight ${!isRead ? "text-[#1F2F42]" : "text-[#657685]"}`}>
                              {n.title}
                              {!isRead && (
                                <span className="inline-block w-1.5 h-1.5 bg-[#22AEB0] rounded-full ml-1.5 -translate-y-0.5" />
                              )}
                            </p>
                            <span className="text-[10px] text-[#94A1AB] font-medium whitespace-nowrap flex-shrink-0">
                              {formatTime(n.time)}
                            </span>
                          </div>

                          <p className={`text-[11px] mt-0.5 leading-relaxed ${!isRead ? "text-[#263746]" : "text-[#94A1AB]"} font-medium`}>
                            {n.message}
                          </p>

                          {n.detail && (
                            <p className="text-[10px] text-[#94A1AB] mt-1 italic line-clamp-2">
                              {n.detail}
                            </p>
                          )}

                          {/* Badges */}
                          <div className="flex items-center gap-1.5 mt-1.5">
                            {n.grade !== undefined && n.grade !== null && (
                              <span className={`text-[9px] font-bold ${gradeColor(n.grade)} bg-white border border-current/10 px-1.5 py-0.5 rounded-md`}>
                                {GRADE_LABELS[n.grade] || `Grade ${n.grade}`}
                              </span>
                            )}
                            {n.urgency && n.urgency !== "routine" && (
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${URGENCY_STYLE[n.urgency] || ""}`}>
                                <AlertTriangle size={8} className="inline mr-0.5 -mt-0.5" />
                                {n.urgency.charAt(0).toUpperCase() + n.urgency.slice(1)}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Dismiss */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            dismissNotification(n.id);
                          }}
                          className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-rose-50 text-[#94A1AB] hover:text-rose-500 cursor-pointer"
                          title="Dismiss"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t border-[#E1E9EC] px-4 py-2.5 bg-[#F7FAFB]/50">
              <p className="text-[10px] text-center text-[#94A1AB] font-medium">
                {notifications.length} notification{notifications.length !== 1 ? "s" : ""} · Auto-refreshes every 60s
              </p>
            </div>
          )}
        </div>
      )}

      {/* Animation keyframes (injected once) */}
      <style>{`
        @keyframes notifSlideDown {
          from { opacity: 0; transform: translateY(-8px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)  scale(1);     }
        }
      `}</style>
    </div>
  );
}

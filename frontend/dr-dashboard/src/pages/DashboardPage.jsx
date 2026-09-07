// src/pages/DashboardPage.jsx
// Analytics dashboard — live stats + charts
// Spec: PRD FR-034 to FR-036, US-018

import { useEffect, useState } from "react";
import { getStats } from "../utils/api";
import {
  Activity, Users, AlertTriangle,
  CheckCircle, Clock, RefreshCw
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie
} from "recharts";

const GRADE_COLORS = {
  "No DR":           "#16a34a",
  "Mild NPDR":         "#ca8a04",
  "Moderate NPDR":     "#ea580c",
  "Severe NPDR":       "#dc2626",
  "Proliferative DR":"#7f1d1d",
};

export default function DashboardPage() {
  const [stats, setStats]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLR]  = useState(new Date());

  const fetch = async () => {
    setLoading(true);
    try {
      const data = await getStats();
      setStats(data);
      setLR(new Date());
    } catch { /* offline */ }
    finally { setLoading(false); }
  };

  useEffect(() => {
    let active = true;
    getStats()
      .then(data => {
        if (active) {
          setStats(data);
          setLR(new Date());
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const gradeBar = stats
    ? Object.entries(stats.by_grade).map(([name, value]) => ({ name, value }))
    : [];

  const gradePie = gradeBar.filter(d => d.value > 0);

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Analytics Dashboard</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            RetinAI · SIH26038 · Last updated {lastRefresh.toLocaleTimeString()}
          </p>
        </div>
        <button onClick={fetch} disabled={loading}
          className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 transition disabled:opacity-50">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          icon={Users}
          label="Total Screened"
          value={stats?.total_screened ?? "—"}
          sub="All time"
          color="blue"
          loading={loading}
        />
        <KPICard
          icon={AlertTriangle}
          label="Referrals Needed"
          value={stats?.referral_needed ?? "—"}
          sub={`${stats?.referral_rate_pct ?? 0}% referral rate`}
          color="orange"
          loading={loading}
        />
        <KPICard
          icon={CheckCircle}
          label="Validated"
          value={stats?.validated ?? "—"}
          sub={`${stats?.validation_rate_pct ?? 0}% validation rate`}
          color="green"
          loading={loading}
        />
        <KPICard
          icon={Activity}
          label="Avg Confidence"
          value={stats ? `${stats.avg_confidence}%` : "—"}
          sub={`~${stats?.avg_processing_ms ?? 0}ms / scan`}
          color="purple"
          loading={loading}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Grade distribution bar */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm font-semibold text-gray-700 mb-4">Grade Distribution</p>
          {loading ? <ChartSkeleton /> :
           gradeBar.every(d => d.value === 0)
            ? <EmptyChart message="No screenings yet" />
            : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={gradeBar} barSize={40}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(val) => [val, "Patients"]}
                    contentStyle={{ borderRadius: 8, fontSize: 12 }}
                  />
                  <Bar dataKey="value" radius={[5, 5, 0, 0]}>
                    {gradeBar.map(entry => (
                      <Cell key={entry.name} fill={GRADE_COLORS[entry.name] ?? "#6b7280"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )
          }
        </div>

        {/* Pie chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm font-semibold text-gray-700 mb-4">Severity Breakdown</p>
          {loading ? <ChartSkeleton /> :
           gradePie.length === 0
            ? <EmptyChart message="No data yet" />
            : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={gradePie}
                    dataKey="value"
                    nameKey="name"
                    cx="50%" cy="50%"
                    outerRadius={70}
                    label={({ name, percent }) =>
                      `${name.replace(" DR","")}: ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                    fontSize={9}
                  >
                    {gradePie.map(entry => (
                      <Cell key={entry.name} fill={GRADE_COLORS[entry.name] ?? "#6b7280"} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )
          }
        </div>
      </div>

      {/* System status row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Model status */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm font-semibold text-gray-700 mb-3">System Status</p>
          <div className="space-y-2">
            {[
              { label: "AI Model",       status: "ok",     note: "EfficientNet-B5 loaded"      },
              { label: "Database",       status: "ok",     note: "SQLite (dev mode)"           },
              { label: "Grad-CAM",       status: "ok",     note: "Heatmaps active"             },
              { label: "PDF Reports",    status: "ok",     note: "ReportLab ready"             },
              { label: "Eye Detection",  status: "ok",     note: "OpenCV Haar cascade"         },
            ].map(({ label, status, note }) => (
              <div key={label} className="flex items-center justify-between text-sm">
                <span className="text-gray-600">{label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">{note}</span>
                  <span className={`w-2 h-2 rounded-full ${
                    status === "ok" ? "bg-green-500" :
                    status === "demo" ? "bg-yellow-400" : "bg-red-500"
                  }`} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick stats / SIH info */}
        <div className="bg-gradient-to-br from-blue-700 to-blue-900 rounded-xl p-5 text-white">
          <p className="text-sm font-semibold mb-3 text-blue-200">SIH 2026 · SIH26038</p>
          <p className="font-bold text-lg leading-tight mb-3">
            Explainable AI for Diabetic Retinopathy Screening
          </p>
          <div className="space-y-1.5 text-sm">
            {[
              "Organisation: MathWorks",
              "Category: MedTech / AI",
              "Model: EfficientNet-B5 + Grad-CAM",
              "Dataset: APTOS 2019 + IDRiD",
              "Target: Sensitivity >90%, Specificity >85%",
            ].map(line => (
              <p key={line} className="text-blue-200 text-xs">{line}</p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────

function KPICard({ icon: Icon, label, value, sub, color, loading }) {
  const colors = {
    blue:   "bg-blue-50   text-blue-700   border-blue-200",
    orange: "bg-orange-50 text-orange-700 border-orange-200",
    green:  "bg-green-50  text-green-700  border-green-200",
    purple: "bg-purple-50 text-purple-700 border-purple-200",
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <Icon size={18} className="mb-2 opacity-60" />
      {loading
        ? <div className="h-8 w-16 bg-current opacity-10 rounded animate-pulse" />
        : <p className="text-2xl font-bold">{value}</p>
      }
      <p className="text-xs font-semibold mt-1">{label}</p>
      <p className="text-xs opacity-60 mt-0.5">{sub}</p>
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="h-48 flex items-end gap-2 px-2 animate-pulse">
      {[40,70,55,30,20].map((h, i) => (
        <div key={i} className="flex-1 bg-gray-100 rounded-t" style={{ height: `${h}%` }} />
      ))}
    </div>
  );
}

function EmptyChart({ message }) {
  return (
    <div className="h-48 flex items-center justify-center text-gray-300 text-sm">
      {message}
    </div>
  );
}

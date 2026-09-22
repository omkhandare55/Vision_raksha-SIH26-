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
  "Mild DR":         "#ca8a04",
  "Moderate DR":     "#ea580c",
  "Severe DR":       "#dc2626",
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
    <div className="max-w-7xl mx-auto p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1F2F42] tracking-tight">Analytics Dashboard</h1>
          <p className="text-xs text-[#94A1AB] font-medium mt-0.5">
            VisionRaksha · Last updated {lastRefresh.toLocaleTimeString()}
          </p>
        </div>
        <button onClick={fetch} disabled={loading} className="btn-primary gap-2 text-xs py-2.5 px-4">
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
          color="teal"
          loading={loading}
        />
        <KPICard
          icon={AlertTriangle}
          label="Referrals Needed"
          value={stats?.referral_needed ?? "—"}
          sub={`${stats?.referral_rate_pct ?? 0}% referral rate`}
          color="amber"
          loading={loading}
        />
        <KPICard
          icon={CheckCircle}
          label="Validated"
          value={stats?.validated ?? "—"}
          sub={`${stats?.validation_rate_pct ?? 0}% validation rate`}
          color="emerald"
          loading={loading}
        />
        <KPICard
          icon={Activity}
          label="Avg Confidence"
          value={stats ? `${stats.avg_confidence}%` : "—"}
          sub={`~${stats?.avg_processing_ms ?? 0}ms / scan`}
          color="teal-bright"
          loading={loading}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Grade distribution bar */}
        <div className="lg:col-span-2 card-static p-5">
          <p className="text-sm font-bold text-[#1F2F42] mb-4">Grade Distribution</p>
          {loading ? <ChartSkeleton /> :
           gradeBar.every(d => d.value === 0)
            ? <EmptyChart message="No screenings yet" />
            : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={gradeBar} barSize={40}>
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#657685' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#657685' }} />
                  <Tooltip
                    formatter={(val) => [val, "Patients"]}
                    contentStyle={{ borderRadius: 12, fontSize: 12, border: '1px solid #E1E9EC' }}
                  />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                    {gradeBar.map(entry => (
                      <Cell key={entry.name} fill={GRADE_COLORS[entry.name] ?? "#76D6D2"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )
          }
        </div>

        {/* Pie chart */}
        <div className="card-static p-5">
          <p className="text-sm font-bold text-[#1F2F42] mb-4">Severity Breakdown</p>
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
                      <Cell key={entry.name} fill={GRADE_COLORS[entry.name] ?? "#76D6D2"} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12, border: '1px solid #E1E9EC' }} />
                </PieChart>
              </ResponsiveContainer>
            )
          }
        </div>
      </div>

      {/* System status row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Model status */}
        <div className="card-static p-5">
          <p className="text-sm font-bold text-[#1F2F42] mb-3">System Status</p>
          <div className="space-y-2.5">
            {[
              { label: "AI Model",       status: "ok", note: "EfficientNet-B5 Active" },
              { label: "Grad-CAM",       status: "ok", note: "Aperture Masked (conv_head)" },
              { label: "Quality Gate",   status: "ok", note: "Laplacian & Photometric Gate" },
              { label: "Database",       status: "ok", note: "SQLite / PACS Synced" },
              { label: "PDF Reports",    status: "ok", note: "ReportLab + HL7 FHIR LOINC" },
            ].map(({ label, status, note }) => (
              <div key={label} className="flex items-center justify-between text-sm">
                <span className="text-[#263746] font-medium">{label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#94A1AB] font-mono">{note}</span>
                  <span className={`w-2.5 h-2.5 rounded-full ${
                    status === "ok" ? "bg-[#22AEB0]" :
                    status === "demo" ? "bg-[#38C4C4]" : "bg-rose-500"
                  }`} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick stats / SIH info */}
        <div className="relative bg-cover bg-center rounded-2xl p-6 text-white shadow-card overflow-hidden" style={{ backgroundImage: 'url(/ai_dashboard.jpg)' }}>
          <div className="absolute inset-0 bg-[#1F2F42]/85 z-0" />
          <div className="relative z-10">
            <p className="text-xs font-semibold mb-2 text-[#76D6D2] uppercase tracking-wider">SIH 2026 · SIH26038</p>
            <p className="font-bold text-lg leading-tight mb-3 text-white">
              Explainable AI for Diabetic Retinopathy Screening
            </p>
            <div className="space-y-1.5 text-xs">
              {[
                "Organisation: MathWorks",
                "Category: MedTech / AI",
                "Model: EfficientNet-B5 Ordinal Regressor",
                "Dataset: Multi-Center (APTOS 2019 + IDRiD)",
                "Target: Sensitivity >90%, Specificity >85%",
              ].map(line => (
                <p key={line} className="text-[#94A1AB] text-xs font-medium">{line}</p>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Demo mode notice */}
      <div className="bg-[#E8F7F6] border border-[#22AEB0]/20 rounded-2xl p-4 flex items-start gap-3">
        <Clock size={18} className="text-[#22AEB0] flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-bold text-[#1F2F42] uppercase tracking-wider">Demo Mode Active</p>
          <p className="text-xs text-[#657685] mt-0.5 leading-relaxed font-medium">
            Running without trained model — all Grade 2 results are pre-set.
            Train EfficientNet-B4 on Kaggle (P100 GPU, ~3–4 hrs) to activate real AI grading.
            See <code className="bg-[#F7FAFB] px-2 py-0.5 rounded-lg text-[#1F2F42] font-mono text-[11px] border border-[#E1E9EC]">notebooks/train_dr_model.ipynb</code>
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────

function KPICard({ icon: Icon, label, value, sub, color, loading }) {
  const iconColors = {
    teal:          "text-[#22AEB0] bg-[#E8F7F6] border-[#22AEB0]/15",
    "teal-bright": "text-[#38C4C4] bg-[#E8F7F6] border-[#38C4C4]/15",
    amber:         "text-amber-600 bg-amber-50 border-amber-200/50",
    emerald:       "text-emerald-600 bg-emerald-50 border-emerald-200/50",
  };
  return (
    <div className="card-static p-5 transition-all hover:shadow-card-hover hover:border-[#22AEB0]/20">
      <div className={`p-2.5 rounded-xl border w-fit mb-3 ${iconColors[color] || iconColors.teal}`}>
        <Icon size={20} strokeWidth={1.5} />
      </div>
      {loading
        ? <div className="h-8 w-16 bg-[#E1E9EC] rounded-xl animate-pulse" />
        : <p className="text-2xl font-bold text-[#1F2F42]">{value}</p>
      }
      <p className="text-xs font-semibold mt-1 text-[#263746]">{label}</p>
      <p className="text-xs text-[#94A1AB] mt-0.5 font-medium">{sub}</p>
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="h-48 flex items-end gap-2 px-2 animate-pulse">
      {[40,70,55,30,20].map((h, i) => (
        <div key={i} className="flex-1 bg-[#E1E9EC] rounded-t" style={{ height: `${h}%` }} />
      ))}
    </div>
  );
}

function EmptyChart({ message }) {
  return (
    <div className="h-48 flex items-center justify-center text-[#94A1AB] text-sm">
      {message}
    </div>
  );
}

// src/App.jsx — Root app with routing + layout + auth gate
import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  Eye, LayoutDashboard, Users,
  Activity, Menu, X, Wifi, WifiOff, LogOut
} from "lucide-react";

import { AuthProvider, useAuth } from "./context/AuthContext";
import LoginPage from "./pages/LoginPage";

// Pages
import ScreenPage    from "./pages/ScreenPage";
import DashboardPage from "./pages/DashboardPage";
import PatientsPage  from "./pages/PatientsPage";

const NAV = [
  { to: "/",        icon: LayoutDashboard, label: "Dashboard"  },
  { to: "/screen",  icon: Eye,             label: "Screen"     },
  { to: "/patients",icon: Users,           label: "Patients"   },
];

function AuthenticatedApp() {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [online, setOnline]           = useState(navigator.onLine);

  // Track online/offline status
  useEffect(() => {
    const on  = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online",  on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  const roleBadge = {
    asha:   { label: "ASHA Worker", color: "bg-green-500" },
    doctor: { label: "Doctor",      color: "bg-blue-500" },
    admin:  { label: "Admin",       color: "bg-purple-500" },
  }[user?.role] || { label: user?.role, color: "bg-gray-500" };

  return (
    <div className="flex h-screen overflow-hidden">

      {/* ── Sidebar ──────────────────────────────────────── */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-blue-800 text-white
        transform transition-transform duration-200
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        md:relative md:translate-x-0 md:flex md:flex-col
      `}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-blue-700">
          <Activity className="text-blue-300" size={28} />
          <div>
            <h1 className="font-bold text-lg leading-tight">RetinAI</h1>
            <p className="text-blue-300 text-xs">DR Screening</p>
          </div>
          <button className="ml-auto md:hidden" onClick={() => setSidebarOpen(false)}>
            <X size={20} />
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors
                 ${isActive
                   ? "bg-blue-600 text-white"
                   : "text-blue-200 hover:bg-blue-700 hover:text-white"}`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User info + logout */}
        <div className="px-4 py-3 border-t border-blue-700">
          <div className="flex items-center gap-2 mb-2">
            <span className={`w-2 h-2 rounded-full ${roleBadge.color}`} />
            <span className="text-sm text-blue-100 font-medium truncate">
              {user?.name || user?.user_id}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-blue-400">{roleBadge.label}</span>
            <button
              onClick={logout}
              className="flex items-center gap-1 text-xs text-blue-300 hover:text-white transition-colors"
            >
              <LogOut size={14} />
              Logout
            </button>
          </div>
        </div>

        {/* SIH badge */}
        <div className="px-6 py-4 border-t border-blue-700 text-xs text-blue-400">
          <p className="font-semibold">SIH 2026 · SIH26038</p>
          <p>MathWorks · MedTech</p>
        </div>
      </aside>

      {/* Overlay (mobile) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Main content ─────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Top bar */}
        <header className="flex items-center gap-4 px-4 py-3 bg-white border-b border-gray-200 shadow-sm">
          <button
            className="md:hidden text-gray-600 hover:text-gray-900"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={22} />
          </button>

          <h2 className="font-semibold text-gray-700 text-sm">
            Explainable AI for Diabetic Retinopathy
          </h2>

          <div className="ml-auto flex items-center gap-2">
            {/* Connectivity indicator */}
            {online
              ? <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                  <Wifi size={14} /> Online
                </span>
              : <span className="flex items-center gap-1 text-xs text-orange-500 font-medium">
                  <WifiOff size={14} /> Offline — queuing
                </span>
            }
          </div>
        </header>

        {/* Offline banner */}
        {!online && (
          <div className="bg-orange-50 border-b border-orange-200 px-4 py-2 text-xs text-orange-700 text-center">
            ⚠ You are offline. Images captured will sync automatically when connected.
          </div>
        )}

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/"         element={<DashboardPage />} />
            <Route path="/screen"   element={<ScreenPage />} />
            <Route path="/patients" element={<PatientsPage />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function AppGate() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <LoginPage />;

  return (
    <BrowserRouter>
      <AuthenticatedApp />
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppGate />
    </AuthProvider>
  );
}

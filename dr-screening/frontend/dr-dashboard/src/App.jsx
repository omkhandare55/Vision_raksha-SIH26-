// src/App.jsx — VisionRaksha: Root app with public landing + auth-gated dashboard
import { BrowserRouter, Routes, Route, NavLink, useLocation, Navigate } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  Eye, LayoutDashboard, Users, Home as HomeIcon,
  Menu, X, Wifi, WifiOff, LogOut, ChevronDown,
  Send, ClipboardList, ShieldCheck
} from "lucide-react";

import NotificationPanel from "./components/NotificationPanel";

import { AuthProvider, useAuth } from "./context/AuthContext";
import LoginPage from "./pages/LoginPage";

// Pages
import HomePage        from "./pages/HomePage";
import ScreenPage      from "./pages/ScreenPage";
import DashboardPage   from "./pages/DashboardPage";
import PatientsPage    from "./pages/PatientsPage";
import AdminPage       from "./pages/AdminPage";
import DoctorReviewPage from "./pages/DoctorReviewPage";
import ReportsPage     from "./pages/ReportsPage";

/* ── VisionRaksha Eye + AI Logo SVG ── */
function VRLogo({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 24C4 24 12 10 24 10C36 10 44 24 44 24C44 24 36 38 24 38C12 38 4 24 4 24Z"
        stroke="#22AEB0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="24" cy="24" r="7" stroke="#22AEB0" strokeWidth="2" fill="none" />
      <circle cx="24" cy="24" r="3" fill="#22AEB0" />
      <line x1="24" y1="17" x2="24" y2="14" stroke="#38C4C4" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="24" y1="31" x2="24" y2="34" stroke="#38C4C4" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="17" y1="24" x2="14" y2="24" stroke="#38C4C4" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="31" y1="24" x2="34" y2="24" stroke="#38C4C4" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="24" cy="13" r="1.5" fill="#38C4C4" />
      <circle cx="24" cy="35" r="1.5" fill="#38C4C4" />
      <circle cx="13" cy="24" r="1.5" fill="#38C4C4" />
      <circle cx="35" cy="24" r="1.5" fill="#38C4C4" />
    </svg>
  );
}

// Role-based navigation
const NAV_ASHA = [
  { to: "/screen",   icon: Eye,           label: "Screen"      },
  { to: "/patients", icon: Users,         label: "Patients"    },
  { to: "/reports",  icon: ClipboardList, label: "My Reports"  },
];

const NAV_DOCTOR = [
  { to: "/dashboard",  icon: LayoutDashboard, label: "Dashboard"    },
  { to: "/reviews",    icon: Send,            label: "Review Queue" },
];

const NAV_ADMIN = [
  { to: "/dashboard",   icon: LayoutDashboard, label: "Dashboard"    },
  { to: "/admin",       icon: ShieldCheck,     label: "Manage Users" },
  { to: "/screen",      icon: Eye,             label: "Screen"       },
  { to: "/patients",    icon: Users,           label: "Patients"     },
  { to: "/reviews",     icon: Send,            label: "Reviews"      },
];

function getNavForRole(role) {
  if (role === "doctor")  return NAV_DOCTOR;
  if (role === "admin")   return NAV_ADMIN;
  return NAV_ASHA; // asha / field_worker / default
}

function AuthenticatedApp() {
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [profileOpen, setProfileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const on  = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
    setProfileOpen(false);
  }, [location.pathname]);

  const navItems = getNavForRole(user?.role);

  const roleBadge = {
    asha:         { label: "ASHA Worker",  color: "bg-teal-soft text-navy" },
    field_worker: { label: "ASHA Worker",  color: "bg-teal-soft text-navy" },
    doctor:       { label: "Doctor",       color: "bg-teal-light text-teal" },
    admin:        { label: "Admin",        color: "bg-teal/10 text-teal-bright" },
  }[user?.role] || { label: user?.role, color: "bg-gray-100 text-gray-600" };

  const displayName = user?.name || user?.user_id || "User";

  return (
    <div className="min-h-screen flex flex-col bg-[#F7FAFB]">
      {/* ── Top Navigation Bar ── */}
      <nav className="sticky top-0 z-50 bg-[#1F2F42] shadow-nav">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">

            {/* Left: Logo */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <VRLogo size={36} />
              <div className="hidden sm:block">
                <h1 className="text-white font-bold text-lg leading-tight tracking-wide">
                  Vision<span className="text-[#22AEB0]">Raksha</span>
                </h1>
                <p className="text-[#76D6D2] text-[10px] font-medium tracking-wider uppercase leading-none">
                  AI for Healthier Tomorrows
                </p>
              </div>
            </div>

            {/* Center: Nav Links (desktop) */}
            <div className="hidden md:flex items-center gap-1">
              {navItems.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === "/"}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
                     ${isActive
                       ? "text-[#22AEB0] bg-white/10 nav-active"
                       : "text-[#94A1AB] hover:text-white hover:bg-white/5"}`
                  }
                >
                  <Icon size={16} />
                  {label}
                </NavLink>
              ))}
            </div>

            {/* Right: Status + Profile */}
            <div className="flex items-center gap-3">
              {online
                ? <span className="hidden sm:flex items-center gap-1.5 text-xs text-emerald-400 font-medium bg-emerald-400/10 px-3 py-1.5 rounded-lg">
                    <Wifi size={12} /> Online
                  </span>
                : <span className="hidden sm:flex items-center gap-1.5 text-xs text-amber-400 font-medium bg-amber-400/10 px-3 py-1.5 rounded-lg">
                    <WifiOff size={12} /> Offline
                  </span>
              }

              <NotificationPanel />

              <div className="relative">
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center gap-2 text-white hover:bg-white/5 px-3 py-2 rounded-lg transition cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-full bg-[#22AEB0] flex items-center justify-center text-white text-xs font-bold">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                  <div className="hidden sm:block text-left">
                    <p className="text-sm font-semibold text-white leading-tight">{displayName}</p>
                    <p className="text-[10px] text-[#76D6D2]">{roleBadge.label}</p>
                  </div>
                  <ChevronDown size={14} className="text-[#94A1AB]" />
                </button>

                {profileOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-[#E1E9EC] py-2 z-50">
                    <div className="px-4 py-2 border-b border-[#E1E9EC]">
                      <p className="text-sm font-semibold text-[#263746]">{displayName}</p>
                      <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full mt-1 ${roleBadge.color}`}>
                        {roleBadge.label}
                      </span>
                    </div>
                    <button
                      onClick={logout}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                    >
                      <LogOut size={14} />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>

              <button
                className="md:hidden text-[#94A1AB] hover:text-white p-2"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
            </div>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden bg-[#26394D] border-t border-white/10 px-4 py-3 space-y-1">
            {navItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all
                   ${isActive
                     ? "text-[#22AEB0] bg-[#22AEB0]/10"
                     : "text-[#94A1AB] hover:text-white hover:bg-white/5"}`
                }
              >
                <Icon size={18} />
                {label}
              </NavLink>
            ))}
          </div>
        )}
      </nav>

      {!online && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-700 text-center font-medium">
          ⚠ You are offline. Images captured will sync automatically when connected.
        </div>
      )}

      <main className="flex-1">
        <Routes>
          {/* Shared */}
          <Route path="/" element={<Navigate to={user?.role === "doctor" ? "/dashboard" : user?.role === "admin" ? "/dashboard" : "/screen"} replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />

          {/* ASHA worker routes */}
          <Route path="/screen"   element={<ScreenPage />} />
          <Route path="/patients" element={<PatientsPage />} />
          <Route path="/reports"  element={<ReportsPage />} />

          {/* Doctor routes */}
          <Route path="/reviews"  element={<DoctorReviewPage />} />

          {/* Admin routes */}
          <Route path="/admin"    element={<AdminPage />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

/* ── Public Nav Bar (for non-authenticated users) ── */
function PublicNav() {
  return (
    <nav className="sticky top-0 z-50 bg-[#1F2F42] shadow-nav">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <VRLogo size={36} />
            <div>
              <h1 className="text-white font-bold text-lg leading-tight tracking-wide">
                Vision<span className="text-[#22AEB0]">Raksha</span>
              </h1>
              <p className="text-[#76D6D2] text-[10px] font-medium tracking-wider uppercase leading-none">
                AI for Healthier Tomorrows
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a href="#features" className="hidden sm:block text-sm text-[#94A1AB] hover:text-white transition font-medium">Features</a>
            <a href="#workflow" className="hidden sm:block text-sm text-[#94A1AB] hover:text-white transition font-medium">How It Works</a>
            <a href="#about" className="hidden sm:block text-sm text-[#94A1AB] hover:text-white transition font-medium">About</a>
            <NavLink to="/login" className="btn-primary text-xs py-2 px-5 ml-2">
              Sign In
            </NavLink>
          </div>
        </div>
      </div>
    </nav>
  );
}

function PublicApp() {
  return (
    <div className="min-h-screen flex flex-col bg-[#F7FAFB]">
      <PublicNav />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function AppGate() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7FAFB]">
        <div className="flex flex-col items-center gap-4">
          <VRLogo size={48} />
          <div className="w-8 h-8 border-3 border-[#E8F7F6] border-t-[#22AEB0] rounded-full animate-spin" />
          <p className="text-sm text-[#657685] font-medium">Loading VisionRaksha...</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      {user ? <AuthenticatedApp /> : <PublicApp />}
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

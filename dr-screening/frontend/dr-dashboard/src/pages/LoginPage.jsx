// src/pages/LoginPage.jsx — VisionRaksha Login Screen
// ASHA workers & doctors: Sign In only (admin creates their accounts)
// Admin: can self Sign Up OR Sign In
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Eye, EyeOff, LogIn, AlertCircle, ShieldCheck, UserPlus, ArrowLeft } from "lucide-react";
import { adminRegisterSelf } from "../utils/api";

// ── Helper: extract a readable message from an axios error ──────
// FastAPI detail can be:
//   object → { error: "CODE", message: "..." }
//   array  → [{ loc, msg, type }]  (422 validation errors)
const getErrMsg = (err, fallback = "Something went wrong. Please try again.") => {
  const detail = err?.response?.data?.detail;
  if (!detail) return err?.response?.data?.message || fallback;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    // Pick the first validation error message
    return detail.map(d => d.msg || d.message || JSON.stringify(d)).join("; ");
  }
  return detail.message || detail.error || fallback;
};

const VRLogo = () => (
  <svg width="36" height="36" viewBox="0 0 48 48" fill="none">
    <path d="M4 24C4 24 12 10 24 10C36 10 44 24 44 24C44 24 36 38 24 38C12 38 4 24 4 24Z"
      stroke="#22AEB0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <circle cx="24" cy="24" r="7" stroke="#22AEB0" strokeWidth="2" fill="none" />
    <circle cx="24" cy="24" r="3" fill="#22AEB0" />
    <line x1="24" y1="17" x2="24" y2="14" stroke="#38C4C4" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="24" y1="31" x2="24" y2="34" stroke="#38C4C4" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="17" y1="24" x2="14" y2="24" stroke="#38C4C4" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="31" y1="24" x2="34" y2="24" stroke="#38C4C4" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export default function LoginPage() {
  const { login } = useAuth();

  // mode: "signin" | "admin-signup"
  const [mode, setMode]           = useState("signin");

  // Sign In state
  const [username, setUsername]   = useState("");
  const [password, setPassword]   = useState("");
  const [showPass, setShowPass]   = useState(false);
  const [error, setError]         = useState("");
  const [loading, setLoading]     = useState(false);

  // Admin Sign Up state
  const [regName, setRegName]     = useState("");
  const [regUser, setRegUser]     = useState("");
  const [regPass, setRegPass]     = useState("");
  const [regPass2, setRegPass2]   = useState("");
  const [showRegPass, setShowRegPass] = useState(false);
  const [regError, setRegError]   = useState("");
  const [regLoading, setRegLoading] = useState(false);

  const switchMode = (m) => {
    setMode(m);
    setError("");
    setRegError("");
  };

  /* ── Sign In ── */
  const handleSignIn = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username, password);
    } catch (err) {
      setError(getErrMsg(err, "Login failed. Please check your credentials."));
    } finally {
      setLoading(false);
    }
  };

  /* ── Admin Sign Up ── */
  const handleAdminSignUp = async (e) => {
    e.preventDefault();
    setRegError("");
    if (regPass !== regPass2) {
      setRegError("Passwords do not match.");
      return;
    }
    if (regPass.length < 6) {
      setRegError("Password must be at least 6 characters.");
      return;
    }
    setRegLoading(true);
    try {
      const data = await adminRegisterSelf({ name: regName, username: regUser, password: regPass });
      // Auto-login with returned token
      localStorage.setItem("retinai_token", data.access_token);
      const userData = { user_id: data.user_id, role: data.role, name: data.name, phc_id: data.phc_id };
      localStorage.setItem("retinai_user", JSON.stringify(userData));
      window.location.reload(); // triggers AuthContext to pick up the token
    } catch (err) {
      setRegError(getErrMsg(err, "Registration failed. Please try again."));
    } finally {
      setRegLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-cover bg-center bg-no-repeat flex items-center justify-center p-4 relative overflow-hidden"
      style={{ backgroundImage: "url(/bg_login.jpg)" }}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-[#1F2F42]/72 backdrop-blur-[2px] z-0" />
      <div className="absolute top-20 left-1/4 w-96 h-96 bg-[#22AEB0]/20 rounded-full blur-3xl pointer-events-none z-0" />
      <div className="absolute bottom-20 right-1/4 w-80 h-80 bg-[#38C4C4]/20 rounded-full blur-3xl pointer-events-none z-0" />

      <div className="container z-10">
        <div className="row justify-content-center">
          <div className="col-12 col-md-8 col-lg-6 col-xl-5 mx-auto">
            {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="p-3.5 bg-[#22AEB0]/15 rounded-2xl backdrop-blur-md border border-[#22AEB0]/20 shadow-lg">
              <VRLogo />
            </div>
            <div className="text-left">
              <h1 className="text-3xl font-bold text-white tracking-wide">
                Vision<span className="text-[#22AEB0]">Raksha</span>
              </h1>
              <p className="text-[#76D6D2] text-xs font-semibold uppercase tracking-wider">AI for Healthier Tomorrows</p>
            </div>
          </div>
          <p className="text-[#94A1AB] text-sm font-medium">
            Explainable AI for Diabetic Retinopathy Screening
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-2xl border border-[#E1E9EC] overflow-hidden">

          {/* ── Mode Tabs ── */}
          <div className="flex border-b border-[#E1E9EC]">
            <button
              onClick={() => switchMode("signin")}
              className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer
                ${mode === "signin"
                  ? "text-[#22AEB0] border-b-2 border-[#22AEB0] bg-white"
                  : "text-[#94A1AB] hover:text-[#657685] bg-[#F7FAFB]"}`}
            >
              <LogIn size={16} /> Sign In
            </button>
            <button
              onClick={() => switchMode("admin-signup")}
              className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer
                ${mode === "admin-signup"
                  ? "text-[#22AEB0] border-b-2 border-[#22AEB0] bg-white"
                  : "text-[#94A1AB] hover:text-[#657685] bg-[#F7FAFB]"}`}
            >
              <UserPlus size={16} /> Admin Sign Up
            </button>
          </div>

          <div className="p-8">

            {/* ══ SIGN IN ══════════════════════════════════════ */}
            {mode === "signin" && (
              <>
                <div className="flex items-start gap-2 bg-[#E8F7F6] border border-[#22AEB0]/20 rounded-xl px-4 py-3 mb-6">
                  <ShieldCheck size={15} className="text-[#22AEB0] flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-[#657685] font-medium leading-relaxed">
                    <strong className="text-[#263746]">All users</strong> — ASHA workers, Doctors &amp; Admins — sign in with your credentials.
                    <br />
                    <span className="text-[#94A1AB]">Admin? If you don't have an account yet, <button type="button" onClick={() => switchMode('admin-signup')} className="text-[#22AEB0] hover:underline font-semibold cursor-pointer">create one here</button>.</span>
                  </p>
                </div>

                {error && (
                  <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-sm text-rose-700 font-medium">
                    <AlertCircle size={18} className="flex-shrink-0" />
                    {error}
                  </div>
                )}

                <form onSubmit={handleSignIn} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#657685] mb-1.5">Username</label>
                    <input
                      id="login-username"
                      type="text"
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      className="input-themed"
                      placeholder="Enter your username"
                      required
                      autoFocus
                      autoComplete="username"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#657685] mb-1.5">Password</label>
                    <div className="relative">
                      <input
                        id="login-password"
                        type={showPass ? "text" : "password"}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="input-themed pr-11"
                        placeholder="Enter your password"
                        required
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass(!showPass)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A1AB] hover:text-[#22AEB0] transition cursor-pointer"
                        tabIndex={-1}
                      >
                        {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    id="login-submit"
                    disabled={loading}
                    className="btn-primary w-full py-3.5 text-sm gap-2 mt-2"
                  >
                    {loading
                      ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      : <><LogIn size={18} /> Sign In</>
                    }
                  </button>
                </form>
              </>
            )}

            {/* ══ ADMIN SIGN UP ════════════════════════════════ */}
            {mode === "admin-signup" && (
              <>
                {regError && (
                  <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-sm text-rose-700 font-medium">
                    <AlertCircle size={18} className="flex-shrink-0" />
                    {regError}
                  </div>
                )}

                <form onSubmit={handleAdminSignUp} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#657685] mb-1.5">Full Name *</label>
                    <input
                      id="reg-name"
                      type="text"
                      value={regName}
                      onChange={e => setRegName(e.target.value)}
                      className="input-themed"
                      placeholder="e.g. Dr. Anita Gupta"
                      required
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#657685] mb-1.5">Username *</label>
                    <input
                      id="reg-username"
                      type="text"
                      value={regUser}
                      onChange={e => setRegUser(e.target.value.toLowerCase().replace(/\s/g, "_"))}
                      className="input-themed font-mono"
                      placeholder="e.g. admin_anita"
                      required
                      autoComplete="username"
                    />
                    <p className="text-[10px] text-[#94A1AB] mt-1">This will be your login username</p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#657685] mb-1.5">Password *</label>
                    <div className="relative">
                      <input
                        id="reg-password"
                        type={showRegPass ? "text" : "password"}
                        value={regPass}
                        onChange={e => setRegPass(e.target.value)}
                        className="input-themed pr-11"
                        placeholder="Minimum 6 characters"
                        required
                        minLength={6}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegPass(!showRegPass)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A1AB] hover:text-[#22AEB0] transition cursor-pointer"
                        tabIndex={-1}
                      >
                        {showRegPass ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#657685] mb-1.5">Confirm Password *</label>
                    <input
                      id="reg-password2"
                      type={showRegPass ? "text" : "password"}
                      value={regPass2}
                      onChange={e => setRegPass2(e.target.value)}
                      className="input-themed"
                      placeholder="Re-enter password"
                      required
                      autoComplete="new-password"
                    />
                  </div>

                  <button
                    type="submit"
                    id="reg-submit"
                    disabled={regLoading}
                    className="btn-primary w-full py-3.5 text-sm gap-2 mt-2"
                  >
                    {regLoading
                      ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      : <><UserPlus size={18} /> Create Admin Account</>
                    }
                  </button>
                </form>

                <p className="text-center text-xs text-[#94A1AB] font-medium mt-5">
                  Already have an admin account?{" "}
                  <button type="button" onClick={() => switchMode('signin')} className="text-[#22AEB0] hover:underline font-semibold cursor-pointer">
                    Sign In instead
                  </button>
                </p>
              </>
            )}

          </div>
        </div>
        </div>
        </div>
      </div>
    </div>
  );
}

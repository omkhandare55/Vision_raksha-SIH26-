// src/pages/LoginPage.jsx — RetinAI Login Screen
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Activity, Eye, LogIn, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username, password);
    } catch (err) {
      const msg = err.response?.data?.message || "Login failed. Please check your credentials.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = async (user, pass) => {
    setUsername(user);
    setPassword(pass);
    setError("");
    setLoading(true);
    try {
      await login(user, pass);
    } catch (err) {
      setError(err.response?.data?.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="p-3 bg-blue-600/30 rounded-xl backdrop-blur-sm">
              <Activity className="text-blue-300" size={36} />
            </div>
            <div className="text-left">
              <h1 className="text-3xl font-bold text-white">RetinAI</h1>
              <p className="text-blue-300 text-sm">DR Screening Platform</p>
            </div>
          </div>
          <p className="text-blue-200/70 text-sm">
            Explainable AI for Diabetic Retinopathy Screening
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-6 text-center">
            Sign In
          </h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                placeholder="Enter username"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                placeholder="Enter password"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn size={18} />
                  Sign In
                </>
              )}
            </button>
          </form>

          {/* Quick Login for SIH Demo */}
          <div className="mt-6 pt-6 border-t border-gray-100">
            <p className="text-xs text-gray-400 text-center mb-3">
              SIH Demo — Quick Login
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => quickLogin("asha_demo", "asha123")}
                className="px-3 py-2 text-xs bg-green-50 hover:bg-green-100 text-green-700 rounded-lg border border-green-200 font-medium transition-colors"
              >
                👩‍⚕️ ASHA
              </button>
              <button
                onClick={() => quickLogin("doctor_demo", "doctor123")}
                className="px-3 py-2 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg border border-blue-200 font-medium transition-colors"
              >
                🩺 Doctor
              </button>
              <button
                onClick={() => quickLogin("admin", "admin123")}
                className="px-3 py-2 text-xs bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg border border-purple-200 font-medium transition-colors"
              >
                🔧 Admin
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-blue-300/50 text-xs mt-6">
          SIH 2026 · SIH26038 · MathWorks · MedTech
        </p>
      </div>
    </div>
  );
}

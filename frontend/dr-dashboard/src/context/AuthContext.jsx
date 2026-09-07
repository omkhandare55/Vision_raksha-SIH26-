// src/context/AuthContext.jsx — Authentication state management
import { createContext, useContext, useState, useEffect } from "react";
import api from "../utils/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check for existing token on mount
  useEffect(() => {
    const token = localStorage.getItem("retinai_token");
    const saved = localStorage.getItem("retinai_user");
    if (token && saved) {
      try {
        setUser(JSON.parse(saved));
      } catch {
        localStorage.removeItem("retinai_token");
        localStorage.removeItem("retinai_user");
      }
    }
    setLoading(false);
  }, []);

  const login = async (username, password) => {
    const res = await api.post("/auth/login", { username, password });
    const { access_token, user_id, role, name, phc_id } = res.data;
    localStorage.setItem("retinai_token", access_token);
    const userData = { user_id, role, name, phc_id };
    localStorage.setItem("retinai_user", JSON.stringify(userData));
    setUser(userData);
    return userData;
  };

  const logout = () => {
    localStorage.removeItem("retinai_token");
    localStorage.removeItem("retinai_user");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import api from "../services/api";

// ─── Context ────────────────────────────────────────────────────────────────
const AuthContext = createContext(null);

// ─── Provider ───────────────────────────────────────────────────────────────
export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);   // { _id, name, email, level, xp, … }
  const [token, setToken]     = useState(() => localStorage.getItem("sp_token") || null);
  const [loading, setLoading] = useState(true);   // true while verifying stored token

  // ── Persist token to localStorage whenever it changes ───────────────────
  useEffect(() => {
    if (token) {
      localStorage.setItem("sp_token", token);
    } else {
      localStorage.removeItem("sp_token");
    }
  }, [token]);

  // ── On mount: if a token exists, fetch the current user profile ──────────
  useEffect(() => {
    const verify = async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await api.get("/auth/me");
        setUser(res.data.user);
      } catch {
        // Token invalid / expired — clear everything
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    verify();
  }, []); // run once on mount

  // ── Register ─────────────────────────────────────────────────────────────
  const register = useCallback(async ({ name, email, password }) => {
    const res = await api.post("/auth/register", { name, email, password });
    const { token: newToken, user: newUser } = res.data;
    setToken(newToken);
    setUser(newUser);
    return newUser;
  }, []);

  // ── Login ────────────────────────────────────────────────────────────────
  const login = useCallback(async ({ email, password }) => {
    const res = await api.post("/auth/login", { email, password });
    const { token: newToken, user: newUser } = res.data;
    setToken(newToken);
    setUser(newUser);
    return newUser;
  }, []);

  // ── Logout ───────────────────────────────────────────────────────────────
  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  // ── Update user in state (e.g. after XP change or profile edit) ──────────
  const refreshUser = useCallback(async () => {
    try {
      const res = await api.get("/auth/me");
      setUser(res.data.user);
    } catch {
      logout();
    }
  }, [logout]);

  const value = {
    user,
    token,
    loading,
    isAuthenticated: !!user,
    register,
    login,
    logout,
    refreshUser,
    setUser, // allow optimistic updates
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ─── Hook ────────────────────────────────────────────────────────────────────
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
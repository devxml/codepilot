"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { fetchProfile, clearToken, User, Workspace } from "@/lib/api";

interface AuthContextValue {
  user: User | null;
  workspaces: Workspace[];
  loading: boolean;
  setUser: (user: User | null) => void;
  setWorkspaces: (workspaces: Workspace[]) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("codepilot_token");
    if (!token) {
      setLoading(false);
      return;
    }

    fetchProfile()
      .then((profile) => {
        setUser(profile);
        setWorkspaces(profile.workspaces || []);
      })
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  }, []);

  const logout = () => {
    clearToken();
    setUser(null);
    setWorkspaces([]);
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider value={{ user, workspaces, loading, setUser, setWorkspaces, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

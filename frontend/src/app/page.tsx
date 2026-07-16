"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

/**
 * The application entry point is intentionally only a route guard. The
 * dashboard owns the authenticated application experience; this avoids
 * exposing the old repository UI before a user has authenticated.
 */
export default function HomePage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading) router.replace(user ? "/dashboard" : "/login");
  }, [loading, router, user]);

  return (
    <div className="flex h-screen items-center justify-center bg-bg">
      <Loader2 size={32} className="animate-spin text-accent" />
    </div>
  );
}

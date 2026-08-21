"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getUserProfile } from "@/actions/user-actions";

import { Loader2 } from "lucide-react";

export type UserRole = "admin" | "manager" | "employee" | "qc" | "operator" | "inspeksi" | "mending";

export interface User {
  id: string;
  fullName: string;
  employeeId: string;
  role: UserRole;
  email?: string;
  forcePasswordChange?: boolean;
}

interface AuthContextType {
  user: User | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  switchRole: (role: UserRole) => void; // Keep for legacy/debug purposes
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  useEffect(() => {
    // Restore cached user right after hydration to guarantee 0 hydration mismatch (Fix React Error #418)
    try {
      const saved = localStorage.getItem("dji_cached_user");
      if (saved) {
        setUser(JSON.parse(saved));
        setIsLoggedIn(true);
        setIsLoading(false);
      }
    } catch (e) {}
    const fetchUser = async (session: any) => {
      try {
        if (session?.user) {
          // Fetch role from user_profiles table via server action to bypass RLS issues
          const result = await getUserProfile(session.user.id);
          const profile = result.success ? result.data : null;

          // Fallback to user_metadata if profile row in user_profiles table is not yet populated
          const meta = session.user.user_metadata || {};
          const role = (profile?.role || meta.role || "operator") as UserRole;
          const fullName = profile?.full_name || meta.full_name || session.user.email?.split("@")[0] || "User";
          const employeeId = profile?.employee_id || meta.employee_id || session.user.email?.split("@")[0] || "";
          const forcePasswordChange = profile?.force_password_change || false;

          const authUser: User = {
            id: session.user.id,
            email: session.user.email,
            fullName,
            employeeId,
            role,
            forcePasswordChange,
          };
          setUser(authUser);
          setIsLoggedIn(true);
          try {
            localStorage.setItem("dji_cached_user", JSON.stringify(authUser));
          } catch (e) {}
        } else {
          setUser(null);
          setIsLoggedIn(false);
          try {
            localStorage.removeItem("dji_cached_user");
          } catch (e) {}
        }
      } catch (err) {
        console.error("Failed to fetch user:", err);
      } finally {
        setIsLoading(false);
      }
    };

    // Check initial session
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        fetchUser(session);
      })
      .catch((err) => {
        console.warn("Auth getSession network fetch failed:", err);
        fetchUser(null);
      });

    // Listen for auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
          await fetchUser(session);
          
          if (event === "SIGNED_IN") {
            const currentPath = window.location.pathname;
            if (currentPath === "/login") {
              let role = "operator";
              let forceChange = false;
              if (session?.user) {
                const result = await getUserProfile(session.user.id);
                if (result.success && result.data) {
                  role = result.data.role;
                  forceChange = !!result.data.force_password_change;
                } else if (session.user.user_metadata?.role) {
                  role = session.user.user_metadata.role;
                }
                
                // Cek jika butuh ganti password
                if (forceChange) {
                  window.location.href = "/change-password";
                  return; // Hentikan eksekusi redirect normal
                }
              }
              
              let targetRoute = "/";
              if (role === "operator") {
                targetRoute = "/input";
              } else if (role === "inspeksi") {
                targetRoute = "/qc";
              } else if (role === "mending") {
                targetRoute = "/mending";
              } else {
                targetRoute = "/";
              }

              // Gunakan window.location.href agar cookies dan storage tersinkronisasi penuh dan mencegah bounce-back
              window.location.href = targetRoute;
            }
          }
        } else if (event === "SIGNED_OUT") {
          setUser(null);
          setIsLoggedIn(false);
          setIsLoading(false);
          try {
            localStorage.removeItem("dji_cached_user");
          } catch (e) {}
          window.location.href = "/login";
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [supabase, router]);

  const isPublic = pathname === "/login" || pathname === "/change-password" || pathname.includes("/print");

  useEffect(() => {
    if (!isLoading && !isLoggedIn && !isPublic) {
      // Cek apakah ada cached user di localStorage sebelum redirect untuk mencegah false negative di localhost
      try {
        const cached = localStorage.getItem("dji_cached_user");
        if (cached) return;
      } catch (e) {}
      router.push("/login");
    }
  }, [isLoading, isLoggedIn, isPublic, pathname, router]);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setIsLoading(false);
      return { success: false, error: error.message };
    }
    
    // session will be picked up by onAuthStateChange listener
    return { success: true };
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      localStorage.removeItem("dji_cached_user");
    } catch (e) {}
    await supabase.auth.signOut();
  };

  // Switch role for debug toolbar
  const switchRole = (role: UserRole) => {
    console.warn("switchRole is disabled when using real Supabase Auth. Please login with a different account.");
  };

  const showLoadingScreen = (isLoading || (!isLoggedIn && !isPublic)) && !isPublic;

  return (
    <AuthContext.Provider value={{ user, isLoggedIn, isLoading, login, logout, switchRole }}>
      {showLoadingScreen ? (
        <div className="fixed inset-0 min-h-screen w-full flex flex-col items-center justify-center p-6 z-50 bg-white select-none animate-fadeIn">
          <div className="flex flex-col items-center">
            {/* Transparent Logo */}
            <div className="mb-4">
              <img
                src="/assets/dji_logo_transparent.png"
                alt="DJI Logo"
                className="w-14 h-14 object-contain"
              />
            </div>

            {/* Minimal Spinner & Text */}
            <div className="flex items-center gap-2.5">
              <Loader2 className="w-4 h-4 text-[#0070bc] animate-spin" />
              <span className="text-xs font-bold tracking-wider uppercase text-slate-500">
                Memverifikasi Sesi...
              </span>
            </div>
          </div>
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

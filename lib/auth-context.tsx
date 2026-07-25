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
        } else {
          setUser(null);
          setIsLoggedIn(false);
        }
      } catch (err) {
        console.error("Failed to fetch user:", err);
        setUser(null);
        setIsLoggedIn(false);
      } finally {
        setIsLoading(false);
      }
    };

    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      fetchUser(session);
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
                  router.push("/change-password");
                  return; // Hentikan eksekusi redirect normal
                }
              }
              
              if (role === "operator") {
                router.push("/input");
              } else if (role === "inspeksi") {
                router.push("/qc");
              } else if (role === "mending") {
                router.push("/mending");
              } else {
                router.push("/");
              }
            }
          }
        } else if (event === "SIGNED_OUT") {
          setUser(null);
          setIsLoggedIn(false);
          setIsLoading(false);
          router.push("/login");
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [supabase, router]);

  const isPublic = pathname === "/login" || pathname === "/change-password" || pathname.includes("/print");

  useEffect(() => {
    if (!isLoading) {
      if (!isLoggedIn && !isPublic) {
        router.push("/login");
      }
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
        <div className="min-h-screen w-full bg-slate-900 flex flex-col items-center justify-center p-4 z-50">
          <div className="flex flex-col items-center gap-4 animate-fadeIn">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#0070bc] to-sky-500 flex items-center justify-center shadow-lg shadow-sky-500/30">
              <Loader2 className="w-6 h-6 text-white animate-spin" />
            </div>
            <p className="text-xs font-bold tracking-widest text-slate-400 uppercase">
              Memverifikasi Sesi...
            </p>
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

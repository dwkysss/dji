"use server";

import { createAdminClient, getAuthenticatedUser } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

export async function getUserProfile(userId: string) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    
    // Gunakan service role key untuk bypass RLS jika policy belum ada
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
      .from("user_profiles")
      .select("full_name, employee_id, role, force_password_change")
      .eq("id", userId)
      .single();

    if (error) {
      console.error("Error fetching user profile in server action:", error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err: any) {
    console.error("Exception in getUserProfile:", err);
    return { success: false, error: err.message };
  }
}

export async function resolveLoginEmail(identifier: string): Promise<string> {
  const clean = identifier.trim();
  if (!clean) return "";
  if (clean.includes("@")) return clean.toLowerCase();

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Search in user_profiles by employee_id (case-insensitive)
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("id")
      .ilike("employee_id", clean)
      .maybeSingle();

    if (profile && profile.id && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const adminSupabase = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
      });
      const { data: authUser } = await adminSupabase.auth.admin.getUserById(profile.id);
      if (authUser?.user?.email) {
        return authUser.user.email;
      }
    }
  } catch (e) {}

  return `${clean.toLowerCase()}@dji.local`;
}

export async function listAdminUsers() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false }
    });
    
    // 1. Fetch all users from auth
    const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();
    if (authError) throw authError;

    // 2. Fetch all profiles
    const { data: profiles, error: profileError } = await supabase
      .from("user_profiles")
      .select("*");
    if (profileError) throw profileError;

    // 3. Map/Join them in memory
    const combined = users.map(user => {
      const profile = profiles?.find(p => p.id === user.id);
      return {
        id: user.id,
        email: user.email,
        full_name: profile?.full_name || user.user_metadata?.full_name || "Tanpa Nama",
        employee_id: profile?.employee_id || user.user_metadata?.employee_id || "-",
        role: profile?.role || "operator",
        created_at: profile?.created_at || user.created_at
      };
    });

    return { success: true, data: combined };
  } catch (err: any) {
    console.error("Error listing admin users:", err);
    return { success: false, error: err.message };
  }
}

export async function createAdminUser(payload: {
  email: string;
  password: string;
  fullName: string;
  employeeId: string;
  role: string;
}) {
  try {
    // 🔐 Hanya admin yang boleh membuat akun baru
    const { user: caller, role: callerRole } = await getAuthenticatedUser();
    if (!caller || callerRole !== "admin") {
      return { success: false, error: "Unauthorized: hanya admin yang dapat membuat akun." };
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false }
    });

    // 1. Create user in auth
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: payload.email,
      password: payload.password,
      email_confirm: true,
      user_metadata: {
        full_name: payload.fullName,
        employee_id: payload.employeeId,
        role: payload.role,
      }
    });

    if (authError) throw authError;
    if (!authUser.user) throw new Error("Gagal membuat user auth");

    // 2. Upsert profile in user_profiles
    const { error: profileError } = await supabase
      .from("user_profiles")
      .upsert({
        id: authUser.user.id,
        full_name: payload.fullName,
        employee_id: payload.employeeId,
        role: payload.role,
        force_password_change: true
      });

    if (profileError) {
      // Rollback auth user creation if profile creation fails
      await supabase.auth.admin.deleteUser(authUser.user.id);
      throw profileError;
    }

    return { success: true };
  } catch (err: any) {
    console.error("Error creating admin user:", err);
    return { success: false, error: err.message };
  }
}

export async function updateAdminUser(userId: string, payload: {
  email: string;
  password?: string;
  fullName: string;
  employeeId: string;
  role: string;
}) {
  try {
    // 🔐 Hanya admin yang boleh mengubah akun
    const { user: caller, role: callerRole } = await getAuthenticatedUser();
    if (!caller || callerRole !== "admin") {
      return { success: false, error: "Unauthorized: hanya admin yang dapat mengubah akun." };
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false }
    });

    // 1. Update user in auth
    const authUpdatePayload: any = {
      email: payload.email,
      user_metadata: {
        full_name: payload.fullName,
        employee_id: payload.employeeId,
        role: payload.role,
      }
    };
    if (payload.password) {
      authUpdatePayload.password = payload.password;
    }

    const { error: authError } = await supabase.auth.admin.updateUserById(userId, authUpdatePayload);
    if (authError) throw authError;

    // 2. Update profile
    const profileUpdatePayload: any = {
      full_name: payload.fullName,
      employee_id: payload.employeeId,
      role: payload.role
    };
    if (payload.password) {
      profileUpdatePayload.force_password_change = true;
    }

    const { error: profileError } = await supabase
      .from("user_profiles")
      .update(profileUpdatePayload)
      .eq("id", userId);

    if (profileError) throw profileError;

    return { success: true };
  } catch (err: any) {
    console.error("Error updating admin user:", err);
    return { success: false, error: err.message };
  }
}

export async function deleteAdminUser(userId: string) {
  try {
    // 🔐 Hanya admin yang boleh menghapus akun
    const { user: caller, role: callerRole } = await getAuthenticatedUser();
    if (!caller || callerRole !== "admin") {
      return { success: false, error: "Unauthorized: hanya admin yang dapat menghapus akun." };
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false }
    });

    // Delete user from auth (profile cascades or deletes manually)
    const { error: profileError } = await supabase
      .from("user_profiles")
      .delete()
      .eq("id", userId);

    if (profileError) {
      console.warn("Failed to delete user profile explicitly:", profileError.message);
    }

    const { error: authError } = await supabase.auth.admin.deleteUser(userId);
    if (authError) throw authError;

    return { success: true };
  } catch (err: any) {
    console.error("Error deleting admin user:", err);
    return { success: false, error: err.message };
  }
}

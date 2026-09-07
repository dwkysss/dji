import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const SESSION_MAX_AGE = 60 * 60 * 8; // 8 jam

export async function createClient() {
  let cookieStore: any = null;
  try {
    cookieStore = await cookies();
  } catch {
    // Outside request context (e.g. scripts, background tasks)
  }

  return createServerClient<any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore ? cookieStore.getAll() : [];
        },
        setAll(cookiesToSet) {
          if (!cookieStore) return;
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              const sessionOptions = { ...options, maxAge: SESSION_MAX_AGE };
              cookieStore.set(name, value, sessionOptions);
            });
          } catch {
            // Metode `setAll` dipanggil dari Server Component.
          }
        },
      },
    }
  );
}

export async function createAdminClient() {
  let cookieStore: any = null;
  try {
    cookieStore = await cookies();
  } catch {
    // Outside request context
  }

  return createServerClient<any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore ? cookieStore.getAll() : [];
        },
        setAll(cookiesToSet) {
          if (!cookieStore) return;
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              const sessionOptions = { ...options, maxAge: SESSION_MAX_AGE };
              cookieStore.set(name, value, sessionOptions);
            });
          } catch {
            // Metode `setAll` dipanggil dari Server Component.
          }
        },
      },
    }
  );
}

/**
 * Helper: Dapatkan user yang sedang login beserta role-nya dari database.
 * Gunakan fungsi ini di API routes dan Server Actions untuk memvalidasi akses.
 */
export async function getAuthenticatedUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { user: null, role: null };

  const admin = await createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  return { user, role: profile?.role ?? null };
}

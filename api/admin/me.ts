import { createClient } from "@supabase/supabase-js";

export default async function handler(request: any, response: any) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");

    return response.status(405).json({
      error: "Method not allowed",
    });
  }

  const {
    SUPABASE_URL,
    SUPABASE_SECRET_KEY,
    SUPABASE_SERVICE_ROLE_KEY,
    VITE_SUPABASE_PUBLISHABLE_KEY,
  } = process.env;

  const SUPABASE_ADMIN_KEY =
    SUPABASE_SECRET_KEY ?? SUPABASE_SERVICE_ROLE_KEY;

  const SUPABASE_PUBLIC_KEY =
    VITE_SUPABASE_PUBLISHABLE_KEY;

  if (
    !SUPABASE_URL ||
    !SUPABASE_ADMIN_KEY ||
    !SUPABASE_PUBLIC_KEY
  ) {
    console.error("Missing admin API environment variables");

    return response.status(500).json({
      error: "Admin service is not configured correctly",
    });
  }

  const authorization = request.headers.authorization;

  if (
    typeof authorization !== "string" ||
    !authorization.startsWith("Bearer ")
  ) {
    return response.status(401).json({
      error: "Authentication required",
      isAdmin: false,
    });
  }

  const accessToken = authorization
    .slice("Bearer ".length)
    .trim();

  if (!accessToken) {
    return response.status(401).json({
      error: "Authentication required",
      isAdmin: false,
    });
  }

  const authClient = createClient(
    SUPABASE_URL,
    SUPABASE_PUBLIC_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );

  const adminClient = createClient(
    SUPABASE_URL,
    SUPABASE_ADMIN_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );

  try {
    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser(accessToken);

    if (userError || !user) {
      return response.status(401).json({
        error: "Invalid or expired session",
        isAdmin: false,
      });
    }

    const {
      data: adminRecord,
      error: adminError,
    } = await adminClient
      .from("zisto_admins")
      .select("user_id, created_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (adminError) {
      console.error("Admin lookup failed:", adminError);

      return response.status(500).json({
        error: "Could not verify admin access",
        isAdmin: false,
      });
    }

    if (!adminRecord) {
      return response.status(403).json({
        error: "Zisto admin access required",
        isAdmin: false,
      });
    }

    return response.status(200).json({
      isAdmin: true,
      user: {
        id: user.id,
        email: user.email ?? null,
      },
    });
  } catch (error) {
    console.error("Unexpected admin verification error:", error);

    return response.status(500).json({
      error: "Unexpected admin verification error",
      isAdmin: false,
    });
  }
}

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseSecretKey) {
  throw new Error("Missing Supabase server environment variables");
}

const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseSecretKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  },
);

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  if (req.method !== "GET") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  const authorizationHeader = req.headers.authorization;

  if (!authorizationHeader?.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "Missing authorization token",
    });
  }

  const accessToken = authorizationHeader.slice(
    "Bearer ".length,
  );

  const {
    data: { user },
    error: userError,
  } = await supabaseAdmin.auth.getUser(accessToken);

  if (userError || !user) {
    return res.status(401).json({
      error: "Invalid or expired session",
    });
  }

  const { data: adminRecord, error: adminError } =
    await supabaseAdmin
      .from("zisto_admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

  if (adminError) {
    console.error("Admin lookup failed:", adminError);

    return res.status(500).json({
      error: "Could not verify admin access",
    });
  }

  if (!adminRecord) {
    return res.status(403).json({
      error: "Admin access required",
    });
  }

  const { data: businesses, error: businessesError } =
    await supabaseAdmin
      .from("businesses")
      .select(
        "id, name, slug, timezone, created_at, updated_at",
      )
      .order("created_at", {
        ascending: true,
      });

  if (businessesError) {
    console.error(
      "Businesses lookup failed:",
      businessesError,
    );

    return res.status(500).json({
      error: "Could not load businesses",
    });
  }

  return res.status(200).json({
    businesses: businesses ?? [],
  });
}

import { createClient } from "@supabase/supabase-js";

const ALLOWED_ROLES = new Set([
  "owner",
  "manager",
  "staff",
]);

function getAdminEmails() {
  return new Set(
    (process.env.ZISTO_ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "POST, OPTIONS",
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization",
  );

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseSecretKey =
    process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseSecretKey) {
    return res.status(500).json({
      error: "Server configuration error",
    });
  }

  const authorization =
    req.headers.authorization ?? "";

  const accessToken =
    authorization.startsWith("Bearer ")
      ? authorization.slice(7)
      : null;

  if (!accessToken) {
    return res.status(401).json({
      error: "Authentication required",
    });
  }

  const supabaseAdmin = createClient(
    supabaseUrl,
    supabaseSecretKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    },
  );

  try {
    const {
      data: { user: adminUser },
      error: adminUserError,
    } = await supabaseAdmin.auth.getUser(
      accessToken,
    );

    if (
      adminUserError ||
      !adminUser?.email
    ) {
      return res.status(401).json({
        error: "Invalid or expired session",
      });
    }

    const adminEmails = getAdminEmails();

    if (
      !adminEmails.has(
        adminUser.email.toLowerCase(),
      )
    ) {
      return res.status(403).json({
        error: "Admin permission required",
      });
    }

    const {
      email,
      full_name = "",
      business_id,
      role = "owner",
    } = req.body ?? {};

    if (
      typeof email !== "string" ||
      !email.trim() ||
      typeof business_id !== "string" ||
      !business_id.trim()
    ) {
      return res.status(400).json({
        error:
          "email and business_id are required",
      });
    }

    if (!ALLOWED_ROLES.has(role)) {
      return res.status(400).json({
        error: "Invalid role",
      });
    }

    const {
      data: business,
      error: businessError,
    } = await supabaseAdmin
      .from("businesses")
      .select("id, name")
      .eq("id", business_id)
      .single();

    if (businessError || !business) {
      return res.status(404).json({
        error: "Business not found",
      });
    }

    const {
      data: inviteData,
      error: inviteError,
    } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(
        email.trim().toLowerCase(),
        {
          redirectTo:
            "https://zistogr.vercel.app/?invite=1",
          data: {
            full_name: full_name.trim(),
            business_name: business.name,
          },
        },
      );

    if (
      inviteError ||
      !inviteData.user
    ) {
      console.error(
        "Invite failed:",
        inviteError,
      );

      return res.status(400).json({
        error:
          inviteError?.message ??
          "Could not send invitation",
      });
    }

    const { error: membershipError } =
      await supabaseAdmin
        .from("business_members")
        .upsert(
          {
            business_id,
            user_id: inviteData.user.id,
            role,
          },
          {
            onConflict:
              "business_id,user_id",
          },
        );

    if (membershipError) {
      console.error(
        "Membership assignment failed:",
        membershipError,
      );

      return res.status(500).json({
        error:
          "Invitation sent, but business access could not be assigned",
      });
    }

    return res.status(201).json({
      success: true,
      user_id: inviteData.user.id,
      business_id,
      business_name: business.name,
      role,
    });
  } catch (error) {
    console.error(
      "Invite API error:",
      error,
    );

    return res.status(500).json({
      error: "Internal server error",
    });
  }
}

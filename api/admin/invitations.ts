import type {
  VercelRequest,
  VercelResponse,
} from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  response.setHeader("Cache-Control", "no-store");

  if (
    request.method !== "GET" &&
    request.method !== "PATCH"
  ) {
    return response.status(405).json({
      error: "Method not allowed",
    });
  }

  const supabaseUrl = process.env.SUPABASE_URL;

  const supabaseAdminKey =
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAdminKey) {
    return response.status(500).json({
      error: "Missing Supabase server configuration",
    });
  }

  const authorization =
    request.headers.authorization ?? "";

  if (!authorization.startsWith("Bearer ")) {
    return response.status(401).json({
      error: "Authentication required",
    });
  }

  const accessToken = authorization
    .slice("Bearer ".length)
    .trim();

  const supabaseAdmin = createClient(
    supabaseUrl,
    supabaseAdminKey,
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
    } = await supabaseAdmin.auth.getUser(accessToken);

    if (userError || !user) {
      return response.status(401).json({
        error: "Invalid or expired session",
      });
    }

    if (request.method === "PATCH") {
      const body = request.body ?? {};
      const action =
        typeof body.action === "string"
          ? body.action.trim()
          : "";

      const businessId =
        typeof body.business_id === "string"
          ? body.business_id.trim()
          : "";

      if (
        action !== "accept" ||
        !businessId
      ) {
        return response.status(400).json({
          error: "Invalid invitation action",
        });
      }

      const now =
        new Date().toISOString();

      const {
        data: acceptedInvitations,
        error: acceptError,
      } = await supabaseAdmin
        .from("invitations")
        .update({
          status: "accepted",
          accepted_at: now,
          error_message: null,
        })
        .eq("invited_user_id", user.id)
        .eq("business_id", businessId)
        .in("status", [
          "pending",
          "accepted",
        ])
        .select(
          "id, business_id, role, status, accepted_at",
        );

      if (acceptError) {
        console.error(
          "Invitation acceptance failed:",
          acceptError,
        );

        return response.status(500).json({
          error:
            "Could not mark invitation as accepted",
        });
      }

      if (
        !acceptedInvitations ||
        acceptedInvitations.length === 0
      ) {
        return response.status(404).json({
          error:
            "No pending invitation found for this account",
        });
      }

      return response.status(200).json({
        success: true,
        invitations: acceptedInvitations,
      });
    }

    const {
      data: adminRecord,
      error: adminError,
    } = await supabaseAdmin
      .from("zisto_admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (adminError) {
      console.error(
        "Admin verification failed:",
        adminError,
      );

      return response.status(500).json({
        error: "Could not verify admin access",
      });
    }

    if (!adminRecord) {
      return response.status(403).json({
        error: "Zisto admin access required",
      });
    }

    const {
      data: invitations,
      error: invitationsError,
    } = await supabaseAdmin
      .from("invitations")
      .select(`
        id,
        email,
        full_name,
        role,
        status,
        email_id,
        error_message,
        expires_at,
        accepted_at,
        created_at,
        business_id,
        businesses (
          id,
          name,
          slug
        )
      `)
      .order("created_at", {
        ascending: false,
      });

    if (invitationsError) {
      console.error(
        "Invitations loading failed:",
        invitationsError,
      );

      return response.status(500).json({
        error: "Could not load invitations",
      });
    }

    return response.status(200).json({
      invitations: invitations ?? [],
    });
  } catch (error) {
    console.error(
      "Admin invitations API error:",
      error,
    );

    return response.status(500).json({
      error: "Unexpected invitations error",
    });
  }
}

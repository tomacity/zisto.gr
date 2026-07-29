import type {
  VercelRequest,
  VercelResponse,
} from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

type ClientRole = "owner" | "member" | "staff";

type MembershipRow = {
  user_id: string;
  business_id: string;
  role: ClientRole;
  businesses:
    | {
        id: string;
        name: string;
        slug: string;
      }
    | {
        id: string;
        name: string;
        slug: string;
      }[]
    | null;
};

const ALLOWED_ROLES = new Set<ClientRole>([
  "owner",
  "member",
  "staff",
]);

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader(
    "Access-Control-Allow-Methods",
    "GET, PATCH, DELETE, OPTIONS",
  );
  response.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization",
  );

  if (request.method === "OPTIONS") {
    return response.status(204).end();
  }

  if (
    request.method !== "GET" &&
    request.method !== "PATCH" &&
    request.method !== "DELETE"
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
      data: { user: requestingUser },
      error: userError,
    } = await supabaseAdmin.auth.getUser(accessToken);

    if (userError || !requestingUser) {
      return response.status(401).json({
        error: "Invalid or expired session",
      });
    }

    const {
      data: adminRecord,
      error: adminError,
    } = await supabaseAdmin
      .from("zisto_admins")
      .select("user_id")
      .eq("user_id", requestingUser.id)
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

    if (request.method === "GET") {
      const {
        data: memberships,
        error: membershipsError,
      } = await supabaseAdmin
        .from("business_members")
        .select(`
          user_id,
          business_id,
          role,
          businesses (
            id,
            name,
            slug
          )
        `)
        .order("business_id", {
          ascending: true,
        });

      if (membershipsError) {
        console.error(
          "Membership loading failed:",
          membershipsError,
        );

        return response.status(500).json({
          error: "Could not load client memberships",
        });
      }

      const {
        data: usersResult,
        error: usersError,
      } = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });

      if (usersError) {
        console.error(
          "Auth users loading failed:",
          usersError,
        );

        return response.status(500).json({
          error: "Could not load client accounts",
        });
      }

      const usersById = new Map(
        usersResult.users.map((user) => [
          user.id,
          user,
        ]),
      );

      const clients = (
        (memberships ?? []) as MembershipRow[]
      ).map((membership) => {
        const user = usersById.get(
          membership.user_id,
        );

        const businessRelation =
          Array.isArray(membership.businesses)
            ? membership.businesses[0] ?? null
            : membership.businesses;

        return {
          id: membership.user_id,
          email: user?.email ?? "",
          full_name:
            typeof user?.user_metadata?.full_name ===
            "string"
              ? user.user_metadata.full_name
              : "",
          role: membership.role,
          business_id: membership.business_id,
          business: businessRelation,
          created_at: user?.created_at ?? null,
          last_sign_in_at:
            user?.last_sign_in_at ?? null,
          invited_at: user?.invited_at ?? null,
          email_confirmed_at:
            user?.email_confirmed_at ?? null,
          status: user?.last_sign_in_at
            ? "active"
            : "invited",
        };
      });

      return response.status(200).json({
        clients,
      });
    }

    const body = request.body ?? {};

    const userId =
      typeof body.user_id === "string"
        ? body.user_id.trim()
        : "";

    const businessId =
      typeof body.business_id === "string"
        ? body.business_id.trim()
        : "";

    if (!userId || !businessId) {
      return response.status(400).json({
        error: "user_id and business_id are required",
      });
    }

    const {
      data: membership,
      error: membershipError,
    } = await supabaseAdmin
      .from("business_members")
      .select("user_id, business_id, role")
      .eq("user_id", userId)
      .eq("business_id", businessId)
      .maybeSingle();

    if (membershipError) {
      console.error(
        "Membership verification failed:",
        membershipError,
      );

      return response.status(500).json({
        error: "Could not verify membership",
      });
    }

    if (!membership) {
      return response.status(404).json({
        error: "Client membership not found",
      });
    }

    if (request.method === "PATCH") {
      const role =
        typeof body.role === "string"
          ? body.role
          : "";

      if (!ALLOWED_ROLES.has(role as ClientRole)) {
        return response.status(400).json({
          error: "Invalid client role",
        });
      }

      const {
        data: updatedMembership,
        error: updateError,
      } = await supabaseAdmin
        .from("business_members")
        .update({
          role,
        })
        .eq("user_id", userId)
        .eq("business_id", businessId)
        .select("user_id, business_id, role")
        .single();

      if (updateError) {
        console.error(
          "Membership update failed:",
          updateError,
        );

        return response.status(500).json({
          error: "Could not update client role",
        });
      }

      await supabaseAdmin
        .from("invitations")
        .update({
          role,
        })
        .eq("invited_user_id", userId)
        .eq("business_id", businessId);

      return response.status(200).json({
        success: true,
        membership: updatedMembership,
      });
    }

    const {
      error: deleteMembershipError,
    } = await supabaseAdmin
      .from("business_members")
      .delete()
      .eq("user_id", userId)
      .eq("business_id", businessId);

    if (deleteMembershipError) {
      console.error(
        "Membership deletion failed:",
        deleteMembershipError,
      );

      return response.status(500).json({
        error: "Could not remove client access",
      });
    }

    await supabaseAdmin
      .from("invitations")
      .update({
        status: "cancelled",
      })
      .eq("invited_user_id", userId)
      .eq("business_id", businessId)
      .eq("status", "pending");

    const {
      data: remainingMemberships,
      error: remainingMembershipsError,
    } = await supabaseAdmin
      .from("business_members")
      .select("business_id")
      .eq("user_id", userId)
      .limit(1);

    if (remainingMembershipsError) {
      console.error(
        "Remaining memberships lookup failed:",
        remainingMembershipsError,
      );

      return response.status(500).json({
        error:
          "Access removed, but account cleanup could not be verified",
      });
    }

    let accountDeleted = false;

    if ((remainingMemberships ?? []).length === 0) {
      const {
        error: deleteUserError,
      } = await supabaseAdmin.auth.admin.deleteUser(
        userId,
      );

      if (deleteUserError) {
        console.error(
          "Auth user deletion failed:",
          deleteUserError,
        );
      } else {
        accountDeleted = true;
      }
    }

    return response.status(200).json({
      success: true,
      accountDeleted,
    });
  } catch (error) {
    console.error(
      "Admin clients API error:",
      error,
    );

    return response.status(500).json({
      error: "Unexpected clients error",
    });
  }
}

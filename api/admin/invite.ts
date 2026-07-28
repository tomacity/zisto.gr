import { createClient } from "@supabase/supabase-js";

type InviteRole = "owner" | "manager" | "staff";

type RequestBody = {
  email?: string;
  full_name?: string;
  business_id?: string;
  role?: InviteRole;
};

const ALLOWED_ROLES = new Set<InviteRole>([
  "owner",
  "manager",
  "staff",
]);

export default async function handler(
  request: any,
  response: any,
) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader(
    "Access-Control-Allow-Methods",
    "POST, OPTIONS",
  );
  response.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization",
  );

  if (request.method === "OPTIONS") {
    return response.status(204).end();
  }

  if (request.method !== "POST") {
    return response.status(405).json({
      error: "Method not allowed",
    });
  }

  const {
    SUPABASE_URL,
    SUPABASE_SECRET_KEY,
    SUPABASE_SERVICE_ROLE_KEY,
    VITE_SUPABASE_PUBLISHABLE_KEY,
    RESEND_API_KEY,
    APP_URL,
  } = process.env;

  const supabaseAdminKey =
    SUPABASE_SECRET_KEY ?? SUPABASE_SERVICE_ROLE_KEY;

  const supabasePublicKey =
    VITE_SUPABASE_PUBLISHABLE_KEY;

  if (
    !SUPABASE_URL ||
    !supabaseAdminKey ||
    !supabasePublicKey ||
    !RESEND_API_KEY
  ) {
    console.error("Missing invitation environment variables", {
      hasSupabaseUrl: Boolean(SUPABASE_URL),
      hasAdminKey: Boolean(supabaseAdminKey),
      hasPublicKey: Boolean(supabasePublicKey),
      hasResendKey: Boolean(RESEND_API_KEY),
    });

    return response.status(500).json({
      error: "Missing server environment variables",
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

  const body = (request.body ?? {}) as RequestBody;

  const email = body.email?.trim().toLowerCase();
  const fullName = body.full_name?.trim();
  const businessId = body.business_id?.trim();
  const role = body.role ?? "owner";

  if (
    !email ||
    !fullName ||
    !businessId ||
    !ALLOWED_ROLES.has(role)
  ) {
    return response.status(400).json({
      error: "Invalid invitation data",
    });
  }

  const authClient = createClient(
    SUPABASE_URL,
    supabasePublicKey,
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
    } = await authClient.auth.getUser(accessToken);

    if (userError || !requestingUser) {
      console.error("Invitation session error:", userError);

      return response.status(401).json({
        error: "Invalid or expired session",
      });
    }

    const {
      data: zistoAdmin,
      error: adminCheckError,
    } = await adminClient
      .from("zisto_admins")
      .select("user_id")
      .eq("user_id", requestingUser.id)
      .maybeSingle();

    if (adminCheckError) {
      console.error(
        "Admin verification failed:",
        adminCheckError,
      );

      return response.status(500).json({
        error: "Could not verify admin access",
      });
    }

    if (!zistoAdmin) {
      return response.status(403).json({
        error: "Zisto admin access required",
      });
    }

    const {
      data: business,
      error: businessError,
    } = await adminClient
      .from("businesses")
      .select("id, name")
      .eq("id", businessId)
      .maybeSingle();

    if (businessError) {
      console.error(
        "Business verification failed:",
        businessError,
      );

      return response.status(500).json({
        error: "Could not verify business",
      });
    }

    if (!business) {
      return response.status(404).json({
        error: "Business not found",
      });
    }

    const businessName = business.name;

    const baseUrl = (
      APP_URL ?? "https://zisto.app"
    ).replace(/\/$/, "");

    const redirectTo = `${baseUrl}/?invite=1`;

    const {
      data: inviteData,
      error: inviteError,
    } = await adminClient.auth.admin.generateLink({
      type: "invite",
      email,
      options: {
        redirectTo,
        data: {
          full_name: fullName,
          business_id: businessId,
          business_name: businessName,
          role,
        },
      },
    });

    if (inviteError) {
      console.error(
        "Supabase invitation failed:",
        inviteError,
      );

      return response.status(500).json({
        error: inviteError.message,
      });
    }

    const invitedUserId = inviteData.user?.id;
    const invitationLink =
      inviteData.properties?.action_link;

    if (!invitedUserId || !invitationLink) {
      return response.status(500).json({
        error: "Incomplete invitation data",
      });
    }

    const {
      error: membershipError,
    } = await adminClient
      .from("business_members")
      .insert({
        user_id: invitedUserId,
        business_id: businessId,
        role,
      });

    if (membershipError) {
      console.error(
        "Membership creation failed:",
        membershipError,
      );

      await adminClient.auth.admin.deleteUser(
        invitedUserId,
      );

      return response.status(500).json({
        error: "Could not create business membership",
      });
    }

    const emailResponse = await fetch(
      "https://api.resend.com/emails",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Zisto <hello@mail.zisto.app>",
          to: [email],
          reply_to: "zisto.gr@gmail.com",
          subject: `Η πρόσκλησή σου για το ${businessName}`,
          html: `
            <div style="font-family:Arial,sans-serif;background:#f4f4f2;padding:40px 16px;">
              <div style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:24px;padding:40px;">
                <h2 style="margin:0;font-size:28px;color:#222222;">
                  ZISTO<span style="color:#DC2727;">.</span>
                </h2>

                <h1 style="font-size:42px;line-height:1;margin-top:28px;color:#222222;">
                  Καλώς ήρθες<br />στο Zisto.
                </h1>

                <p style="font-size:16px;line-height:1.7;color:#666666;">
                  Γεια σου ${fullName},
                </p>

                <p style="font-size:16px;line-height:1.7;color:#666666;">
                  Δημιουργήθηκε πρόσβαση για την επιχείρηση
                  <strong>${businessName}</strong>.
                </p>

                <a
                  href="${invitationLink}"
                  style="display:inline-block;margin-top:24px;background:#222222;color:#ffffff;padding:16px 26px;border-radius:999px;text-decoration:none;font-weight:bold;"
                >
                  Αποδοχή πρόσκλησης →
                </a>
              </div>
            </div>
          `,
        }),
      },
    );

    const emailResult = await emailResponse.json();

    if (!emailResponse.ok) {
      console.error(
        "Resend invitation failed:",
        emailResult,
      );

      /*
       * Ο χρήστης και το membership έχουν ήδη
       * δημιουργηθεί. Επιστρέφουμε σαφές error
       * για να γνωρίζουμε ότι απέτυχε μόνο το email.
       */
      return response.status(502).json({
        error: "User created, but email failed",
        details: emailResult,
      });
    }

    return response.status(201).json({
      success: true,
      userId: invitedUserId,
      emailId: emailResult.id ?? null,
      business: {
        id: business.id,
        name: businessName,
      },
      role,
    });
  } catch (error) {
    console.error(
      "Unexpected invitation error:",
      error,
    );

    return response.status(500).json({
      error: "Unexpected invitation error",
    });
  }
}

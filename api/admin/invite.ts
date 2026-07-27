import { createClient } from "@supabase/supabase-js";

type InviteRole = "owner" | "manager";

type RequestBody = {
  email?: string;
  fullName?: string;
  businessId?: string;
  businessName?: string;
  role?: InviteRole;
};

export default async function handler(request: any, response: any) {
  if (request.method !== "POST") {
    return response.status(405).json({
      error: "Method not allowed",
    });
  }

  const {
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY,
    RESEND_API_KEY,
    ZISTO_ADMIN_EMAILS,
    APP_URL,
  } = process.env;

  if (
    !SUPABASE_URL ||
    !SUPABASE_ANON_KEY ||
    !SUPABASE_SERVICE_ROLE_KEY ||
    !RESEND_API_KEY ||
    !ZISTO_ADMIN_EMAILS
  ) {
    return response.status(500).json({
      error: "Missing server environment variables",
    });
  }

  const authorization = request.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    return response.status(401).json({
      error: "Authentication required",
    });
  }

  const accessToken = authorization.replace("Bearer ", "").trim();

  const body = (request.body ?? {}) as RequestBody;

  const email = body.email?.trim().toLowerCase();
  const fullName = body.fullName?.trim();
  const businessId = body.businessId?.trim();
  const businessName = body.businessName?.trim();
  const role = body.role;

  if (
    !email ||
    !fullName ||
    !businessId ||
    !businessName ||
    !role ||
    !["owner", "manager"].includes(role)
  ) {
    return response.status(400).json({
      error: "Invalid invitation data",
    });
  }

  const authClient = createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );

  const adminClient = createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );

  try {
    const {
      data: { user: requestingUser },
      error: userError,
    } = await authClient.auth.getUser(accessToken);

    if (userError || !requestingUser?.email) {
      return response.status(401).json({
        error: "Invalid session",
      });
    }

    const adminEmails = ZISTO_ADMIN_EMAILS
      .split(",")
      .map((value) => value.trim().toLowerCase());

    if (!adminEmails.includes(requestingUser.email.toLowerCase())) {
      return response.status(403).json({
        error: "Admin access required",
      });
    }

    const { data: business, error: businessError } =
      await adminClient
        .from("businesses")
        .select("id, name")
        .eq("id", businessId)
        .maybeSingle();

    if (businessError) {
      console.error(businessError);

      return response.status(500).json({
        error: "Could not verify business",
      });
    }

    if (!business) {
      return response.status(404).json({
        error: "Business not found",
      });
    }

    const redirectTo =
      `${(APP_URL ?? "https://zisto.app").replace(/\/$/, "")}/?invite=1`;

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
          business_name: businessName,
          role,
        },
      },
    });

    if (inviteError) {
      console.error(inviteError);

      return response.status(500).json({
        error: inviteError.message,
      });
    }

    const invitedUserId = inviteData.user?.id;
    const invitationLink = inviteData.properties?.action_link;

    if (!invitedUserId || !invitationLink) {
      return response.status(500).json({
        error: "Incomplete invitation data",
      });
    }

    const { error: membershipError } =
      await adminClient
        .from("business_members")
        .insert({
          user_id: invitedUserId,
          business_id: businessId,
          role,
        });

    if (membershipError) {
      console.error(membershipError);

      await adminClient.auth.admin.deleteUser(invitedUserId);

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
              <div style="max-width:620px;margin:0 auto;background:white;border-radius:24px;padding:40px;">
                <h2 style="margin:0;font-size:28px;color:#222;">
                  ZISTO<span style="color:#DC2727;">.</span>
                </h2>

                <h1 style="font-size:42px;line-height:1;margin-top:28px;color:#222;">
                  Καλώς ήρθες<br />στο Zisto.
                </h1>

                <p style="font-size:16px;line-height:1.7;color:#666;">
                  Γεια σου ${fullName},
                </p>

                <p style="font-size:16px;line-height:1.7;color:#666;">
                  Δημιουργήθηκε πρόσβαση για την επιχείρηση
                  <strong>${businessName}</strong>.
                </p>

                <a
                  href="${invitationLink}"
                  style="display:inline-block;margin-top:24px;background:#222;color:white;padding:16px 26px;border-radius:999px;text-decoration:none;font-weight:bold;"
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
      console.error(emailResult);

      return response.status(502).json({
        error: "User created, but email failed",
        details: emailResult,
      });
    }

    return response.status(201).json({
      success: true,
      userId: invitedUserId,
      emailId: emailResult.id ?? null,
    });
  } catch (error) {
    console.error(error);

    return response.status(500).json({
      error: "Unexpected invitation error",
    });
  }
}

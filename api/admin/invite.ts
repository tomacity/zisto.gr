import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

type InviteRole = "owner" | "manager";

type InviteRequestBody = {
  email?: unknown;
  fullName?: unknown;
  businessId?: unknown;
  businessName?: unknown;
  role?: unknown;
};

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY =
  process.env.SUPABASE_SECRET_KEY ??
  process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const ZISTO_ADMIN_EMAILS = process.env.ZISTO_ADMIN_EMAILS;
const APP_URL = process.env.APP_URL ?? "https://zisto.app";

function getRequiredEnvironmentVariables() {
  const missing: string[] = [];

  if (!SUPABASE_URL) missing.push("SUPABASE_URL");
  if (!SUPABASE_SECRET_KEY) {
    missing.push("SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY");
  }
  if (!SUPABASE_ANON_KEY) missing.push("SUPABASE_ANON_KEY");
  if (!RESEND_API_KEY) missing.push("RESEND_API_KEY");
  if (!ZISTO_ADMIN_EMAILS) missing.push("ZISTO_ADMIN_EMAILS");

  return missing;
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const email = value.trim().toLowerCase();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return null;
  }

  return email;
}

function normalizeRequiredString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim();

  return normalizedValue.length > 0 ? normalizedValue : null;
}

function normalizeRole(value: unknown): InviteRole | null {
  return value === "owner" || value === "manager" ? value : null;
}

function getBearerToken(request: VercelRequest): string | null {
  const authorization = request.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  return authorization.slice("Bearer ".length).trim() || null;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildInvitationEmail({
  fullName,
  businessName,
  role,
  invitationLink,
}: {
  fullName: string;
  businessName: string;
  role: InviteRole;
  invitationLink: string;
}) {
  const safeName = escapeHtml(fullName);
  const safeBusinessName = escapeHtml(businessName);
  const roleLabel = role === "owner" ? "Ιδιοκτήτης" : "Manager";

  return `
    <!doctype html>
    <html lang="el">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Πρόσκληση στο Zisto</title>
      </head>

      <body style="margin:0;background:#f4f4f2;font-family:Arial,Helvetica,sans-serif;color:#222222;">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
          <tr>
            <td align="center" style="padding:40px 16px;">
              <table
                width="100%"
                cellpadding="0"
                cellspacing="0"
                role="presentation"
                style="max-width:620px;background:#ffffff;border:1px solid #e5e5e1;border-radius:24px;overflow:hidden;"
              >
                <tr>
                  <td style="padding:42px 42px 20px;">
                    <div style="font-size:24px;font-weight:900;letter-spacing:-1px;">
                      ZISTO<span style="color:#DC2727;">.</span>
                    </div>
                  </td>
                </tr>

                <tr>
                  <td style="padding:10px 42px 42px;">
                    <div
                      style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#DC2727;"
                    >
                      Πρόσκληση συνεργάτη
                    </div>

                    <h1
                      style="margin:18px 0 0;font-size:42px;line-height:1;letter-spacing:-2px;color:#222222;"
                    >
                      Καλώς ήρθες<br />στο Zisto.
                    </h1>

                    <p style="margin:28px 0 0;font-size:16px;line-height:1.7;color:#666666;">
                      Γεια σου ${safeName},
                    </p>

                    <p style="margin:14px 0 0;font-size:16px;line-height:1.7;color:#666666;">
                      Έχει δημιουργηθεί πρόσβαση για την επιχείρηση
                      <strong style="color:#222222;">${safeBusinessName}</strong>
                      με ρόλο
                      <strong style="color:#222222;">${roleLabel}</strong>.
                    </p>

                    <p style="margin:14px 0 0;font-size:16px;line-height:1.7;color:#666666;">
                      Πάτησε το παρακάτω κουμπί για να ορίσεις τον προσωπικό σου
                      κωδικό και να ανοίξεις το dashboard σου.
                    </p>

                    <table cellpadding="0" cellspacing="0" role="presentation" style="margin-top:32px;">
                      <tr>
                        <td
                          align="center"
                          bgcolor="#222222"
                          style="border-radius:999px;"
                        >
                          <a
                            href="${invitationLink}"
                            style="display:inline-block;padding:17px 28px;color:#ffffff;text-decoration:none;font-size:13px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;"
                          >
                            Αποδοχή πρόσκλησης →
                          </a>
                        </td>
                      </tr>
                    </table>

                    <p style="margin:30px 0 0;font-size:12px;line-height:1.6;color:#999999;">
                      Αν δεν περίμενες αυτή την πρόσκληση, μπορείς να αγνοήσεις
                      αυτό το email.
                    </p>
                  </td>
                </tr>

                <tr>
                  <td
                    style="padding:20px 42px;border-top:1px solid #eeeeea;font-size:11px;color:#999999;"
                  >
                    © 2026 Zisto · Ένα άγγιγμα. Όλη η εικόνα σου.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");

    return response.status(405).json({
      error: "Method not allowed.",
    });
  }

  const missingEnvironmentVariables = getRequiredEnvironmentVariables();

  if (missingEnvironmentVariables.length > 0) {
    console.error(
      "Missing invite API environment variables:",
      missingEnvironmentVariables,
    );

    return response.status(500).json({
      error: "The invitation service is not configured correctly.",
    });
  }

  const accessToken = getBearerToken(request);

  if (!accessToken) {
    return response.status(401).json({
      error: "Authentication required.",
    });
  }

  const body = (request.body ?? {}) as InviteRequestBody;

  const email = normalizeEmail(body.email);
  const fullName = normalizeRequiredString(body.fullName);
  const businessId = normalizeRequiredString(body.businessId);
  const businessName = normalizeRequiredString(body.businessName);
  const role = normalizeRole(body.role);

  if (!email || !fullName || !businessId || !businessName || !role) {
    return response.status(400).json({
      error:
        "email, fullName, businessId, businessName and a valid role are required.",
    });
  }

  const adminSupabase = createClient(
    SUPABASE_URL!,
    SUPABASE_SECRET_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    },
  );

  const authSupabase = createClient(
    SUPABASE_URL!,
    SUPABASE_ANON_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    },
  );

  try {
    /*
     * 1. Validate the caller's Supabase JWT.
     */
    const {
      data: { user: requestingUser },
      error: requestingUserError,
    } = await authSupabase.auth.getUser(accessToken);

    if (requestingUserError || !requestingUser?.email) {
      return response.status(401).json({
        error: "Invalid or expired session.",
      });
    }

    /*
     * 2. Temporary super-admin authorization.
     *
     * Later we will replace this email allow-list with an admin_roles table.
     */
    const allowedAdminEmails = ZISTO_ADMIN_EMAILS!
      .split(",")
      .map((adminEmail) => adminEmail.trim().toLowerCase())
      .filter(Boolean);

    if (!allowedAdminEmails.includes(requestingUser.email.toLowerCase())) {
      return response.status(403).json({
        error: "You do not have permission to invite users.",
      });
    }

    /*
     * 3. Verify the business exists.
     */
    const { data: business, error: businessError } = await adminSupabase
      .from("businesses")
      .select("id, name")
      .eq("id", businessId)
      .maybeSingle();

    if (businessError) {
      console.error("Business lookup failed:", businessError);

      return response.status(500).json({
        error: "The business could not be verified.",
      });
    }

    if (!business) {
      return response.status(404).json({
        error: "Business not found.",
      });
    }

    /*
     * 4. Generate the Supabase invitation link.
     */
    const redirectTo = `${APP_URL.replace(/\/$/, "")}/?invite=1`;

    const {
      data: invitationData,
      error: invitationError,
    } = await adminSupabase.auth.admin.generateLink({
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

    if (invitationError) {
      console.error("Supabase invitation generation failed:", invitationError);

      const isExistingUser =
        invitationError.message.toLowerCase().includes("already") ||
        invitationError.message.toLowerCase().includes("registered");

      return response.status(isExistingUser ? 409 : 500).json({
        error: isExistingUser
          ? "A user with this email already exists."
          : "The invitation link could not be created.",
      });
    }

    const invitedUser = invitationData.user;
    const actionLink = invitationData.properties?.action_link;

    if (!invitedUser?.id || !actionLink) {
      console.error("Incomplete invitation data:", invitationData);

      return response.status(500).json({
        error: "Supabase returned an incomplete invitation.",
      });
    }

    /*
     * 5. Create the business membership.
     *
     * This assumes business_members has:
     * user_id, business_id and role.
     */
    const { error: membershipError } = await adminSupabase
      .from("business_members")
      .insert({
        user_id: invitedUser.id,
        business_id: businessId,
        role,
      });

    if (membershipError) {
      console.error("Membership creation failed:", membershipError);

      /*
       * Roll back the newly invited Auth user when membership creation fails.
       */
      const { error: rollbackError } =
        await adminSupabase.auth.admin.deleteUser(invitedUser.id);

      if (rollbackError) {
        console.error("Invite rollback failed:", rollbackError);
      }

      return response.status(500).json({
        error: "The user could not be connected to the business.",
      });
    }

    /*
     * 6. Send the branded email with Resend.
     */
    const resend = new Resend(RESEND_API_KEY);

    const { data: emailData, error: emailError } =
      await resend.emails.send({
        from: "Zisto <hello@mail.zisto.app>",
        to: email,
        replyTo: "zisto.gr@gmail.com",
        subject: `Η πρόσκλησή σου για το ${businessName}`,
        html: buildInvitationEmail({
          fullName,
          businessName,
          role,
          invitationLink: actionLink,
        }),
      });

    if (emailError) {
      console.error("Resend invitation email failed:", emailError);

      /*
       * Keep the user and membership because the invite link was created.
       * Later an admin can resend the invitation.
       */
      return response.status(502).json({
        error:
          "The account was created, but the invitation email could not be sent.",
        userId: invitedUser.id,
      });
    }

    return response.status(201).json({
      success: true,
      invitation: {
        userId: invitedUser.id,
        email,
        businessId,
        role,
        emailId: emailData?.id ?? null,
      },
    });
  } catch (error) {
    console.error("Unexpected invite API error:", error);

    return response.status(500).json({
      error: "An unexpected error occurred while creating the invitation.",
    });
  }
}

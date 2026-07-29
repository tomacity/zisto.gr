import type {
  VercelRequest,
  VercelResponse,
} from "@vercel/node";

import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

type InvitationStatus =
  | "pending"
  | "accepted"
  | "expired"
  | "failed"
  | "cancelled";

type ResendInvitationBody = {
  invitation_id?: unknown;
};

const RESENDABLE_STATUSES =
  new Set<InvitationStatus>([
    "pending",
    "expired",
    "failed",
  ]);

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
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

  const supabaseUrl =
    process.env.SUPABASE_URL;

  const supabaseSecretKey =
    process.env.SUPABASE_SECRET_KEY;

  const resendApiKey =
    process.env.RESEND_API_KEY;

  const appUrl = (
    process.env.APP_URL ||
    "https://zisto.app"
  ).replace(/\/$/, "");

  if (
    !supabaseUrl ||
    !supabaseSecretKey ||
    !resendApiKey
  ) {
    return response.status(500).json({
      error: "Missing server configuration",
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

  const body = (request.body ??
    {}) as ResendInvitationBody;

  const invitationId =
    typeof body.invitation_id === "string"
      ? body.invitation_id.trim()
      : "";

  if (!invitationId) {
    return response.status(400).json({
      error: "Invitation ID is required",
    });
  }

  const supabaseAdmin = createClient(
    supabaseUrl,
    supabaseSecretKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );

  const resend = new Resend(resendApiKey);

  try {
    /*
     * Verify the logged-in user.
     */
    const {
      data: { user: requestingUser },
      error: userError,
    } = await supabaseAdmin.auth.getUser(
      accessToken,
    );

    if (userError || !requestingUser) {
      return response.status(401).json({
        error: "Invalid or expired session",
      });
    }

    /*
     * Verify Zisto admin access.
     */
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

    /*
     * Load the existing invitation.
     */
    const {
      data: invitation,
      error: invitationError,
    } = await supabaseAdmin
      .from("invitations")
      .select(`
        id,
        email,
        full_name,
        role,
        status,
        business_id,
        businesses (
          id,
          name,
          slug
        )
      `)
      .eq("id", invitationId)
      .maybeSingle();

    if (invitationError) {
      console.error(
        "Invitation loading failed:",
        invitationError,
      );

      return response.status(500).json({
        error: "Could not load invitation",
      });
    }

    if (!invitation) {
      return response.status(404).json({
        error: "Invitation not found",
      });
    }

    const invitationStatus =
      invitation.status as InvitationStatus;

    if (
      !RESENDABLE_STATUSES.has(
        invitationStatus,
      )
    ) {
      return response.status(409).json({
        error:
          invitationStatus === "accepted"
            ? "This invitation has already been accepted"
            : "This invitation cannot be resent",
      });
    }

    const businessRelation =
      invitation.businesses;

    const business = Array.isArray(
      businessRelation,
    )
      ? businessRelation[0] ?? null
      : businessRelation;

    if (!business) {
      return response.status(404).json({
        error:
          "The invitation business could not be found",
      });
    }

    /*
     * Generate a fresh Supabase invitation link.
     */
    const {
      data: linkData,
      error: linkError,
    } =
      await supabaseAdmin.auth.admin.generateLink(
        {
          type: "invite",
          email: invitation.email,
          options: {
            redirectTo: `${appUrl}/?invite=1`,
            data: {
              full_name:
                invitation.full_name ?? "",
              business_name: business.name,
              business_id:
                invitation.business_id,
              role: invitation.role,
            },
          },
        },
      );

    if (
      linkError ||
      !linkData.properties?.action_link
    ) {
      console.error(
        "Invitation link generation failed:",
        linkError,
      );

      return response.status(400).json({
        error:
          linkError?.message ||
          "Could not generate a new invitation link",
      });
    }

    const inviteLink =
      linkData.properties.action_link;

    const fullName =
      invitation.full_name?.trim() ||
      "συνεργάτη";

    const logoUrl =
      `${appUrl}/images/zisto-wordmark.png`;

    /*
     * Send the new email through Resend.
     */
    const {
      data: emailData,
      error: emailError,
    } = await resend.emails.send({
      from: "Zisto <hello@mail.zisto.app>",
      to: invitation.email,
      subject:
        "Η πρόσκλησή σου στο Zisto",
      html: `
        <div style="font-family:Arial,sans-serif;background:#f4f4f2;padding:40px 16px;">
          <div style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:24px;padding:40px;">

            <a
              href="${appUrl}"
              target="_blank"
              style="display:inline-block;text-decoration:none;"
            >
              <img
                src="${logoUrl}"
                alt="Zisto"
                width="130"
                style="display:block;width:130px;height:auto;border:0;outline:none;"
              />
            </a>

            <h1 style="font-size:42px;line-height:1;margin:28px 0 0;color:#222222;">
              Η πρόσκλησή σου<br />είναι ακόμα εδώ.
            </h1>

            <p style="font-size:16px;line-height:1.7;color:#666666;margin-top:28px;">
              Γεια σου ${fullName},
            </p>

            <p style="font-size:16px;line-height:1.7;color:#666666;">
              Σου στέλνουμε ξανά την πρόσκληση για πρόσβαση
              στο Zisto dashboard της επιχείρησης
              <strong style="color:#222222;">
                ${business.name}
              </strong>.
            </p>

            <div style="margin-top:32px;">
              <a
                href="${inviteLink}"
                target="_blank"
                style="
                  display:inline-block;
                  background:#222222;
                  color:#ffffff;
                  padding:16px 26px;
                  border-radius:14px;
                  font-size:15px;
                  font-weight:700;
                  text-decoration:none;
                "
              >
                Αποδοχή πρόσκλησης
              </a>
            </div>

            <p style="margin-top:32px;font-size:13px;line-height:1.6;color:#999999;">
              Αν δεν περίμενες αυτή την πρόσκληση, μπορείς να
              αγνοήσεις το email.
            </p>
          </div>
        </div>
      `,
    });

    if (emailError) {
      console.error(
        "Invitation resend email failed:",
        emailError,
      );

      await supabaseAdmin
        .from("invitations")
        .update({
          status: "failed",
          error_message:
            emailError.message ||
            "Email resend failed",
        })
        .eq("id", invitation.id);

      return response.status(500).json({
        error:
          emailError.message ||
          "Could not resend invitation email",
      });
    }

    /*
     * Update the existing invitation record.
     */
    const expiresAt = new Date(
      Date.now() + 60 * 60 * 1000,
    ).toISOString();

    const {
      data: updatedInvitation,
      error: updateError,
    } = await supabaseAdmin
      .from("invitations")
      .update({
        status: "pending",
        email_id: emailData?.id ?? null,
        error_message: null,
        expires_at: expiresAt,
      })
      .eq("id", invitation.id)
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
      .single();

    if (updateError) {
      console.error(
        "Invitation update failed:",
        updateError,
      );

      return response.status(500).json({
        error:
          "Email sent, but invitation status could not be updated",
      });
    }

    return response.status(200).json({
      success: true,
      invitation: updatedInvitation,
    });
  } catch (error) {
    console.error(
      "Invitation resend API error:",
      error,
    );

    return response.status(500).json({
      error:
        "Unexpected invitation resend error",
    });
  }
}

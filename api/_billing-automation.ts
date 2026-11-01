import type { SupabaseClient } from "@supabase/supabase-js";

function addDays(
  isoDate: string,
  days: number,
) {
  const date = new Date(isoDate);

  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  date.setUTCDate(
    date.getUTCDate() + days,
  );

  return date.toISOString();
}

async function sendBillingEmail({
  apiKey,
  to,
  subject,
  html,
}: {
  apiKey: string;
  to: string;
  subject: string;
  html: string;
}) {
  const response = await fetch(
    "https://api.resend.com/emails",
    {
      method: "POST",
      headers: {
        Authorization:
          `Bearer ${apiKey}`,
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify({
        from:
          process.env.ZISTO_FROM_EMAIL ||
          "Zisto <hello@mail.zisto.app>",
        to: [to],
        reply_to: "zisto.gr@gmail.com",
        subject,
        html,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Resend error: ${await response.text()}`,
    );
  }
}

export async function runBillingAutomation({
  supabaseAdmin,
  resendApiKey,
  now = new Date(),
}: {
  supabaseAdmin: SupabaseClient;
  resendApiKey: string;
  now?: Date;
}) {
  const {
    data: dueSubscriptions,
    error: dueError,
  } = await supabaseAdmin
    .from("subscriptions")
    .select(`
      id,
      business_id,
      billing_email,
      billing_status,
      access_status,
      payment_due_at,
      grace_until,
      overdue_email_sent_at,
      suspended_at,
      suspension_email_sent_at,
      businesses (
        id,
        name
      )
    `)
    .eq(
      "billing_status",
      "past_due",
    )
    .not(
      "payment_due_at",
      "is",
      null,
    );

  if (dueError) {
    throw new Error(
      `Could not load due subscriptions: ${dueError.message}`,
    );
  }

  let remindersSent = 0;
  let suspended = 0;
  let suspensionEmailsSent = 0;

  for (
    const subscription of
      dueSubscriptions ?? []
  ) {
    const dueAt =
      subscription.payment_due_at
        ? new Date(
            subscription.payment_due_at,
          )
        : null;

    if (
      !dueAt ||
      Number.isNaN(
        dueAt.getTime(),
      )
    ) {
      continue;
    }

    const businessRelation =
      Array.isArray(
        subscription.businesses,
      )
        ? subscription.businesses[0]
        : subscription.businesses;

    const businessName =
      businessRelation?.name ??
      "την επιχείρησή σου";

    const graceUntilIso =
      subscription.grace_until ??
      addDays(
        dueAt.toISOString(),
        10,
      );

    if (!graceUntilIso) {
      continue;
    }

    if (
      !subscription.grace_until
    ) {
      const {
        error: graceError,
      } = await supabaseAdmin
        .from("subscriptions")
        .update({
          access_status:
            "grace_period",
          grace_until:
            graceUntilIso,
          updated_at:
            now.toISOString(),
        })
        .eq(
          "id",
          subscription.id,
        );

      if (graceError) {
        console.error(
          "Grace-period sync failed:",
          graceError,
        );
        continue;
      }
    }

    if (
      subscription.billing_email &&
      !subscription.overdue_email_sent_at
    ) {
      try {
        await sendBillingEmail({
          apiKey: resendApiKey,
          to:
            subscription.billing_email,
          subject:
            `Εκκρεμής πληρωμή Zisto — ${businessName}`,
          html: `
            <div style="font-family:Arial,sans-serif;background:#f4f4f2;padding:40px 16px;">
              <div style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:24px;padding:40px;">
                <p style="margin:0 0 12px;color:#dc2727;font-size:12px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;">Zisto Billing</p>
                <h1 style="margin:0 0 18px;font-size:28px;line-height:1.1;color:#222;">Υπάρχει εκκρεμής πληρωμή.</h1>
                <p style="margin:0;color:#555;line-height:1.7;">Η συνδρομή για <strong>${businessName}</strong> έχει αποτυχημένη πληρωμή. Έχεις περίοδο χάριτος 10 ημερών για να την τακτοποιήσεις.</p>
                <p style="margin:22px 0 0;color:#777;font-size:13px;line-height:1.6;">Αν η πληρωμή ολοκληρωθεί μέσα στην περίοδο χάριτος, η υπηρεσία συνεχίζει κανονικά χωρίς παρέμβαση από τη Zisto.</p>
              </div>
            </div>
          `,
        });

        await supabaseAdmin
          .from("subscriptions")
          .update({
            overdue_email_sent_at:
              now.toISOString(),
            updated_at:
              now.toISOString(),
          })
          .eq(
            "id",
            subscription.id,
          );

        remindersSent += 1;
      } catch (error) {
        console.error(
          "Overdue email failed:",
          error,
        );
      }
    }

    if (
      now.getTime() >=
      new Date(
        graceUntilIso,
      ).getTime()
    ) {
      const {
        error: suspendError,
      } = await supabaseAdmin
        .from("subscriptions")
        .update({
          billing_status:
            "past_due",
          access_status:
            "suspended",
          suspended_at:
            subscription.suspended_at ??
            now.toISOString(),
          grace_until:
            graceUntilIso,
          updated_at:
            now.toISOString(),
        })
        .eq(
          "id",
          subscription.id,
        );

      if (!suspendError) {
        suspended += 1;
      }

      if (
        subscription.billing_email &&
        !subscription
          .suspension_email_sent_at
      ) {
        try {
          await sendBillingEmail({
            apiKey: resendApiKey,
            to:
              subscription.billing_email,
            subject:
              `Η συνδρομή Zisto τέθηκε σε παύση — ${businessName}`,
            html: `
              <div style="font-family:Arial,sans-serif;background:#f4f4f2;padding:40px 16px;">
                <div style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:24px;padding:40px;">
                  <p style="margin:0 0 12px;color:#dc2727;font-size:12px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;">Zisto Billing</p>
                  <h1 style="margin:0 0 18px;font-size:28px;line-height:1.1;color:#222;">Η συνδρομή τέθηκε προσωρινά σε παύση.</h1>
                  <p style="margin:0;color:#555;line-height:1.7;">Η πληρωμή για <strong>${businessName}</strong> παραμένει εκκρεμής μετά την περίοδο χάριτος. Η πρόσβαση στο Zisto έχει τεθεί προσωρινά σε παύση.</p>
                  <p style="margin:22px 0 0;color:#777;font-size:13px;line-height:1.6;">Μόλις η Stripe επιβεβαιώσει επιτυχημένη πληρωμή, η υπηρεσία επανενεργοποιείται αυτόματα.</p>
                </div>
              </div>
            `,
          });

          await supabaseAdmin
            .from("subscriptions")
            .update({
              suspension_email_sent_at:
                now.toISOString(),
              updated_at:
                now.toISOString(),
            })
            .eq(
              "id",
              subscription.id,
            );

          suspensionEmailsSent += 1;
        } catch (error) {
          console.error(
            "Suspension email failed:",
            error,
          );
        }
      }
    }
  }

  return {
    success: true,
    checked:
      dueSubscriptions?.length ?? 0,
    reminders_sent:
      remindersSent,
    suspended,
    suspension_emails_sent:
      suspensionEmailsSent,
  };
}

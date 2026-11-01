import type {
  VercelRequest,
  VercelResponse,
} from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const BILLING_STATUSES = new Set([
  "draft",
  "active",
  "past_due",
  "cancelled",
]);

const ACCESS_STATUSES = new Set([
  "active",
  "grace_period",
  "suspended",
]);

function cleanText(
  value: unknown,
  maxLength = 500,
) {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value.trim();

  return cleaned
    ? cleaned.slice(0, maxLength)
    : null;
}

function parseDate(value: unknown) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date.toISOString();
}

function addMonths(
  isoDate: string,
  months: number,
) {
  const date = new Date(isoDate);

  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  const originalDay = date.getUTCDate();

  date.setUTCDate(1);
  date.setUTCMonth(
    date.getUTCMonth() + months,
  );

  const lastDayOfTargetMonth =
    new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth() + 1,
        0,
      ),
    ).getUTCDate();

  date.setUTCDate(
    Math.min(
      originalDay,
      lastDayOfTargetMonth,
    ),
  );

  return date.toISOString();
}

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

function nextFutureBillingDate(
  baseIsoDate: string,
  intervalMonths: number,
  now: Date,
) {
  let candidate =
    addMonths(baseIsoDate, intervalMonths);

  while (
    candidate &&
    new Date(candidate).getTime() <=
      now.getTime()
  ) {
    candidate =
      addMonths(
        candidate,
        intervalMonths,
      );
  }

  return candidate;
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
  const emailResponse = await fetch(
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
          "Zisto <hello@mail.zisto.app>",
        to: [to],
        reply_to: "zisto.gr@gmail.com",
        subject,
        html,
      }),
    },
  );

  if (!emailResponse.ok) {
    const error =
      await emailResponse.text();

    throw new Error(
      `Resend error: ${error}`,
    );
  }
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PATCH, OPTIONS",
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
    request.method !== "POST" &&
    request.method !== "PATCH"
  ) {
    return response.status(405).json({
      error: "Method not allowed",
    });
  }

  const supabaseUrl =
    process.env.SUPABASE_URL;

  const supabaseAdminKey =
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAdminKey) {
    return response.status(500).json({
      error:
        "Missing Supabase server configuration",
    });
  }

  const authorization =
    request.headers.authorization ?? "";

  const cronSecret =
    process.env.CRON_SECRET;

  const isCronRequest =
    request.method === "GET" &&
    Boolean(cronSecret) &&
    authorization ===
      `Bearer ${cronSecret}`;

  if (
    !isCronRequest &&
    !authorization.startsWith("Bearer ")
  ) {
    return response.status(401).json({
      error: "Authentication required",
    });
  }

  const accessToken =
    isCronRequest
      ? null
      : authorization
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
    if (isCronRequest) {
      const resendApiKey =
        process.env.RESEND_API_KEY;

      if (!resendApiKey) {
        return response.status(500).json({
          error:
            "Missing RESEND_API_KEY",
        });
      }

      const now = new Date();

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
        console.error(
          "Subscription cron load failed:",
          dueError,
        );

        return response.status(500).json({
          error:
            "Could not load due subscriptions",
        });
      }

      let markedPastDue = 0;
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

        const overdueDays =
          Math.floor(
            (now.getTime() -
              dueAt.getTime()) /
              86_400_000,
          );

        const businessRelation =
          Array.isArray(
            subscription.businesses,
          )
            ? subscription.businesses[0]
            : subscription.businesses;

        const businessName =
          businessRelation?.name ??
          "την επιχείρησή σου";

        const graceUntil =
          subscription.grace_until
            ? new Date(
                subscription.grace_until,
              )
            : addDays(
                dueAt.toISOString(),
                10,
              );

        const graceUntilIso =
          graceUntil instanceof Date
            ? graceUntil.toISOString()
            : graceUntil;

        if (
          !subscription.grace_until
        ) {
          const { error: graceError } =
            await supabaseAdmin
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
                    <p style="margin:0;color:#555;line-height:1.7;">Η συνδρομή για <strong>${businessName}</strong> έχει περάσει την ημερομηνία χρέωσης. Παρακαλούμε επικοινώνησε μαζί μας για την τακτοποίηση της πληρωμής.</p>
                    <p style="margin:22px 0 0;color:#777;font-size:13px;line-height:1.6;">Μετά από 10 ημέρες καθυστέρησης η πρόσβαση στην υπηρεσία μπορεί να τεθεί προσωρινά σε παύση.</p>
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
          } catch (emailError) {
            console.error(
              "Overdue email failed:",
              emailError,
            );
          }
        }

        if (
          now.getTime() >=
          new Date(
            graceUntilIso,
          ).getTime()
        ) {
          const { error: suspendError } =
            await supabaseAdmin
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
                      <p style="margin:0;color:#555;line-height:1.7;">Η πληρωμή για <strong>${businessName}</strong> παραμένει εκκρεμής για 10 ημέρες. Η πρόσβαση στο Zisto έχει τεθεί προσωρινά σε παύση.</p>
                      <p style="margin:22px 0 0;color:#777;font-size:13px;line-height:1.6;">Μόλις τακτοποιηθεί η πληρωμή, η υπηρεσία μπορεί να ενεργοποιηθεί ξανά άμεσα.</p>
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
            } catch (emailError) {
              console.error(
                "Suspension email failed:",
                emailError,
              );
            }
          }
        }
      }

      return response.status(200).json({
        success: true,
        checked:
          dueSubscriptions?.length ?? 0,
        webhook_past_due_only: true,
        marked_past_due:
          markedPastDue,
        reminders_sent:
          remindersSent,
        suspended,
        suspension_emails_sent:
          suspensionEmailsSent,
      });
    }

    const {
      data: { user },
      error: userError,
    } =
      await supabaseAdmin.auth.getUser(
        accessToken!,
      );

    if (userError || !user) {
      return response.status(401).json({
        error:
          "Invalid or expired session",
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
        "Subscription admin verification failed:",
        adminError,
      );

      return response.status(500).json({
        error:
          "Could not verify admin access",
      });
    }

    if (!adminRecord) {
      return response.status(403).json({
        error:
          "Zisto admin access required",
      });
    }

    if (request.method === "GET") {
      const {
        data,
        error,
      } = await supabaseAdmin
        .from("subscriptions")
        .select(`
          id,
          business_id,
          billing_email,
          amount_cents,
          currency,
          vat_rate,
          billing_interval_months,
          billing_status,
          access_status,
          starts_at,
          next_billing_at,
          payment_due_at,
          grace_until,
          last_paid_at,
          notes,
          stripe_customer_id,
          stripe_subscription_id,
          overdue_email_sent_at,
          suspended_at,
          suspension_email_sent_at,
          created_at,
          updated_at,
          businesses (
            id,
            name,
            slug,
            status
          )
        `)
        .order("created_at", {
          ascending: false,
        });

      if (error) {
        console.error(
          "Subscriptions loading failed:",
          error,
        );

        return response.status(500).json({
          error:
            "Could not load subscriptions",
        });
      }

      return response.status(200).json({
        subscriptions: data ?? [],
      });
    }

    const body = request.body ?? {};

    if (
      request.method === "POST" &&
      body.action === "create_checkout"
    ) {
      const stripeSecretKey =
        process.env.STRIPE_SECRET_KEY;

      if (!stripeSecretKey) {
        return response.status(500).json({
          error:
            "Stripe is not configured yet",
        });
      }

      const subscriptionId =
        cleanText(body.id, 100);

      if (!subscriptionId) {
        return response.status(400).json({
          error:
            "Subscription ID is required",
        });
      }

      const {
        data: subscription,
        error: subscriptionError,
      } = await supabaseAdmin
        .from("subscriptions")
        .select(`
          id,
          business_id,
          billing_email,
          amount_cents,
          currency,
          vat_rate,
          billing_interval_months,
          stripe_customer_id,
          stripe_subscription_id,
          businesses (
            id,
            name,
            slug
          )
        `)
        .eq("id", subscriptionId)
        .single();

      if (
        subscriptionError ||
        !subscription
      ) {
        return response.status(404).json({
          error:
            "Subscription not found",
        });
      }

      if (
        subscription.stripe_subscription_id
      ) {
        return response.status(409).json({
          error:
            "Stripe subscription is already connected",
        });
      }

      if (!subscription.billing_email) {
        return response.status(400).json({
          error:
            "Billing email is required before creating checkout",
        });
      }

      const businessRelation =
        Array.isArray(
          subscription.businesses,
        )
          ? subscription.businesses[0]
          : subscription.businesses;

      const businessName =
        businessRelation?.name ??
        "Zisto subscription";

      const totalAmountCents =
        Math.round(
          subscription.amount_cents *
            (1 +
              Number(
                subscription.vat_rate,
              ) /
                100),
        );

      const appUrl = (
        process.env.APP_URL ??
        "https://zisto.app"
      ).replace(/\/$/, "");

      const form =
        new URLSearchParams();

      form.set("mode", "subscription");
      form.set(
        "consent_collection[terms_of_service]",
        "required",
      );
      form.set(
        "custom_text[terms_of_service_acceptance][message]",
        "Με την εγγραφή αποδέχεσαι την Πολιτική Πληρωμών & Συνδρομών του Zisto: https://zisto.app/#/payments",
      );
      form.set(
        "custom_text[submit][message]",
        "Η συνδρομή ανανεώνεται αυτόματα σύμφωνα με τη συμφωνημένη περίοδο χρέωσης. Σε αποτυχημένη πληρωμή ισχύει περίοδος χάριτος 10 ημερών.",
      );
      form.set(
        "client_reference_id",
        subscription.business_id,
      );
      form.set(
        "customer_email",
        subscription.billing_email,
      );
      form.set(
        "success_url",
        `${appUrl}/#/dashboard?billing=success&session_id={CHECKOUT_SESSION_ID}`,
      );
      form.set(
        "cancel_url",
        `${appUrl}/#/dashboard?billing=cancelled`,
      );
      form.set(
        "line_items[0][quantity]",
        "1",
      );
      form.set(
        "line_items[0][price_data][currency]",
        (
          subscription.currency ??
          "EUR"
        ).toLowerCase(),
      );
      form.set(
        "line_items[0][price_data][unit_amount]",
        String(totalAmountCents),
      );
      form.set(
        "line_items[0][price_data][product_data][name]",
        `Zisto — ${businessName}`,
      );
      form.set(
        "line_items[0][price_data][product_data][description]",
        `Custom Zisto subscription · ${subscription.billing_interval_months} month billing interval`,
      );
      form.set(
        "line_items[0][price_data][recurring][interval]",
        "month",
      );
      form.set(
        "line_items[0][price_data][recurring][interval_count]",
        String(
          subscription.billing_interval_months,
        ),
      );
      form.set(
        "metadata[business_id]",
        subscription.business_id,
      );
      form.set(
        "metadata[zisto_subscription_id]",
        subscription.id,
      );
      form.set(
        "subscription_data[metadata][business_id]",
        subscription.business_id,
      );
      form.set(
        "subscription_data[metadata][zisto_subscription_id]",
        subscription.id,
      );

      if (
        subscription.stripe_customer_id
      ) {
        form.delete("customer_email");
        form.set(
          "customer",
          subscription.stripe_customer_id,
        );
      }

      const stripeResponse =
        await fetch(
          "https://api.stripe.com/v1/checkout/sessions",
          {
            method: "POST",
            headers: {
              Authorization:
                `Bearer ${stripeSecretKey}`,
              "Content-Type":
                "application/x-www-form-urlencoded",
            },
            body: form.toString(),
          },
        );

      const stripeResult =
        await stripeResponse.json();

      if (!stripeResponse.ok) {
        console.error(
          "Stripe checkout creation failed:",
          stripeResult,
        );

        return response.status(502).json({
          error:
            stripeResult?.error?.message ??
            "Could not create Stripe checkout",
        });
      }

      return response.status(200).json({
        checkout_url:
          stripeResult.url,
        checkout_session_id:
          stripeResult.id,
      });
    }

    const businessId =
      cleanText(body.business_id, 100);

    const billingEmail =
      cleanText(body.billing_email, 180);

    const amountCents =
      Number(body.amount_cents);

    const vatRate =
      body.vat_rate === undefined
        ? 24
        : Number(body.vat_rate);

    const billingIntervalMonths =
      Number(
        body.billing_interval_months ?? 1,
      );

    const billingStatus =
      cleanText(body.billing_status, 30) ??
      "active";

    const accessStatus =
      cleanText(body.access_status, 30) ??
      "active";

    const startsAt =
      parseDate(body.starts_at) ??
      new Date().toISOString();

    const paymentDueAt =
      parseDate(body.payment_due_at);

    const graceUntil =
      parseDate(body.grace_until);

    const notes =
      cleanText(body.notes, 3000);

    if (!businessId) {
      return response.status(400).json({
        error: "Business is required",
      });
    }

    if (
      !Number.isInteger(amountCents) ||
      amountCents < 0
    ) {
      return response.status(400).json({
        error:
          "A valid subscription amount is required",
      });
    }

    if (
      !Number.isFinite(vatRate) ||
      vatRate < 0 ||
      vatRate > 100
    ) {
      return response.status(400).json({
        error: "Invalid VAT rate",
      });
    }

    if (
      !Number.isInteger(
        billingIntervalMonths,
      ) ||
      billingIntervalMonths < 1 ||
      billingIntervalMonths > 60
    ) {
      return response.status(400).json({
        error:
          "Billing interval must be between 1 and 60 months",
      });
    }

    if (
      !BILLING_STATUSES.has(
        billingStatus,
      )
    ) {
      return response.status(400).json({
        error:
          "Invalid billing status",
      });
    }

    if (
      !ACCESS_STATUSES.has(
        accessStatus,
      )
    ) {
      return response.status(400).json({
        error:
          "Invalid access status",
      });
    }

    if (
      startsAt === undefined ||
      paymentDueAt === undefined ||
      graceUntil === undefined
    ) {
      return response.status(400).json({
        error: "Invalid billing date",
      });
    }

    const nextBillingAt =
      addMonths(
        startsAt,
        billingIntervalMonths,
      );

    if (!nextBillingAt) {
      return response.status(400).json({
        error:
          "Could not calculate next billing date",
      });
    }

    const payload = {
      business_id: businessId,
      billing_email: billingEmail,
      amount_cents: amountCents,
      currency: "EUR",
      vat_rate: vatRate,
      billing_interval_months:
        billingIntervalMonths,
      billing_status: billingStatus,
      access_status: accessStatus,
      starts_at: startsAt,
      next_billing_at: nextBillingAt,
      payment_due_at: paymentDueAt,
      grace_until: graceUntil,
      notes,
      updated_at:
        new Date().toISOString(),
    };

    if (request.method === "POST") {
      const {
        data,
        error,
      } = await supabaseAdmin
        .from("subscriptions")
        .insert(payload)
        .select(`
          *,
          businesses (
            id,
            name,
            slug,
            status
          )
        `)
        .single();

      if (error) {
        console.error(
          "Subscription creation failed:",
          error,
        );

        if (error.code === "23505") {
          return response.status(409).json({
            error:
              "This business already has a subscription",
          });
        }

        return response.status(500).json({
          error:
            "Could not create subscription",
        });
      }

      return response.status(201).json({
        subscription: data,
      });
    }

    const id =
      cleanText(body.id, 100);

    if (!id) {
      return response.status(400).json({
        error:
          "Subscription ID is required",
      });
    }

    const {
      data,
      error,
    } = await supabaseAdmin
      .from("subscriptions")
      .update(payload)
      .eq("id", id)
      .select(`
        *,
        businesses (
          id,
          name,
          slug,
          status
        )
      `)
      .single();

    if (error) {
      console.error(
        "Subscription update failed:",
        error,
      );

      return response.status(500).json({
        error:
          "Could not update subscription",
      });
    }

    return response.status(200).json({
      subscription: data,
    });
  } catch (error) {
    console.error(
      "Admin subscriptions API error:",
      error,
    );

    return response.status(500).json({
      error:
        "Unexpected subscriptions error",
    });
  }
}

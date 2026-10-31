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

  if (!authorization.startsWith("Bearer ")) {
    return response.status(401).json({
      error: "Authentication required",
    });
  }

  const accessToken =
    authorization
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
    } =
      await supabaseAdmin.auth.getUser(
        accessToken,
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

    const nextBillingAt =
      parseDate(body.next_billing_at);

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
      nextBillingAt === undefined ||
      paymentDueAt === undefined ||
      graceUntil === undefined
    ) {
      return response.status(400).json({
        error: "Invalid billing date",
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

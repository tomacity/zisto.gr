import type {
  VercelRequest,
  VercelResponse,
} from "@vercel/node";
import {
  createHmac,
  timingSafeEqual,
} from "node:crypto";
import { createClient } from "@supabase/supabase-js";

export const config = {
  api: {
    bodyParser: false,
  },
};

async function readRawBody(
  request: VercelRequest,
) {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(
      Buffer.isBuffer(chunk)
        ? chunk
        : Buffer.from(chunk),
    );
  }

  return Buffer.concat(chunks);
}

function verifyStripeSignature(
  rawBody: Buffer,
  header: string,
  secret: string,
) {
  const parts =
    header.split(",");

  const timestampPart =
    parts.find((part) =>
      part.startsWith("t="),
    );

  const signatureParts =
    parts
      .filter((part) =>
        part.startsWith("v1="),
      )
      .map((part) =>
        part.slice(3),
      );

  if (
    !timestampPart ||
    signatureParts.length === 0
  ) {
    return false;
  }

  const timestamp =
    timestampPart.slice(2);

  const timestampNumber =
    Number(timestamp);

  if (
    !Number.isFinite(timestampNumber)
  ) {
    return false;
  }

  const ageSeconds =
    Math.abs(
      Math.floor(Date.now() / 1000) -
        timestampNumber,
    );

  if (ageSeconds > 300) {
    return false;
  }

  const signedPayload =
    `${timestamp}.${rawBody.toString(
      "utf8",
    )}`;

  const expected =
    createHmac("sha256", secret)
      .update(signedPayload)
      .digest("hex");

  return signatureParts.some(
    (signature) => {
      if (
        signature.length !==
        expected.length
      ) {
        return false;
      }

      return timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expected),
      );
    },
  );
}

function objectId(
  value: unknown,
) {
  if (
    typeof value === "string"
  ) {
    return value;
  }

  if (
    value &&
    typeof value === "object" &&
    "id" in value &&
    typeof (value as any).id ===
      "string"
  ) {
    return (value as any).id;
  }

  return null;
}

function subscriptionIdFromInvoice(
  invoice: any,
) {
  return (
    objectId(invoice.subscription) ??
    objectId(
      invoice.parent
        ?.subscription_details
        ?.subscription,
    )
  );
}

function invoicePeriodStart(
  invoice: any,
) {
  const line =
    invoice.lines?.data?.[0];

  const timestamp =
    line?.period?.start ??
    invoice.created;

  return typeof timestamp ===
    "number"
    ? new Date(
        timestamp * 1000,
      ).toISOString()
    : new Date().toISOString();
}

function invoicePeriodEnd(
  invoice: any,
) {
  const periodEnds =
    (invoice.lines?.data ?? [])
      .map(
        (line: any) =>
          line?.period?.end,
      )
      .filter(
        (value: unknown) =>
          typeof value ===
          "number",
      );

  if (
    periodEnds.length === 0
  ) {
    return null;
  }

  return new Date(
    Math.max(...periodEnds) *
      1000,
  ).toISOString();
}

function addDays(
  isoDate: string,
  days: number,
) {
  const date =
    new Date(isoDate);

  date.setUTCDate(
    date.getUTCDate() + days,
  );

  return date.toISOString();
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  response.setHeader(
    "Cache-Control",
    "no-store",
  );

  if (request.method !== "POST") {
    response.setHeader(
      "Allow",
      "POST",
    );

    return response
      .status(405)
      .json({
        error:
          "Method not allowed",
      });
  }

  const {
    STRIPE_WEBHOOK_SECRET,
    SUPABASE_URL,
    SUPABASE_SECRET_KEY,
    SUPABASE_SERVICE_ROLE_KEY,
  } = process.env;

  const supabaseAdminKey =
    SUPABASE_SECRET_KEY ??
    SUPABASE_SERVICE_ROLE_KEY;

  if (
    !STRIPE_WEBHOOK_SECRET ||
    !SUPABASE_URL ||
    !supabaseAdminKey
  ) {
    console.error(
      "Stripe webhook is not configured",
    );

    return response
      .status(500)
      .json({
        error:
          "Webhook configuration missing",
      });
  }

  const signatureHeader =
    request.headers[
      "stripe-signature"
    ];

  if (
    typeof signatureHeader !==
    "string"
  ) {
    return response
      .status(400)
      .json({
        error:
          "Missing Stripe signature",
      });
  }

  const rawBody =
    await readRawBody(request);

  if (
    !verifyStripeSignature(
      rawBody,
      signatureHeader,
      STRIPE_WEBHOOK_SECRET,
    )
  ) {
    return response
      .status(400)
      .json({
        error:
          "Invalid Stripe signature",
      });
  }

  let event: any;

  try {
    event = JSON.parse(
      rawBody.toString("utf8"),
    );
  } catch {
    return response
      .status(400)
      .json({
        error:
          "Invalid JSON payload",
      });
  }

  const supabaseAdmin =
    createClient(
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
    const eventType =
      event.type;

    const object =
      event.data?.object;

    if (
      eventType ===
        "checkout.session.completed" ||
      eventType ===
        "checkout.session.async_payment_succeeded"
    ) {
      const zistoSubscriptionId =
        object?.metadata
          ?.zisto_subscription_id;

      const businessId =
        object?.metadata
          ?.business_id ??
        object?.client_reference_id;

      const stripeCustomerId =
        objectId(
          object?.customer,
        );

      const stripeSubscriptionId =
        objectId(
          object?.subscription,
        );

      let query =
        supabaseAdmin
          .from(
            "subscriptions",
          )
          .update({
            stripe_customer_id:
              stripeCustomerId,
            stripe_subscription_id:
              stripeSubscriptionId,
            updated_at:
              new Date()
                .toISOString(),
          });

      if (
        typeof zistoSubscriptionId ===
          "string" &&
        zistoSubscriptionId
      ) {
        query = query.eq(
          "id",
          zistoSubscriptionId,
        );
      } else if (
        typeof businessId ===
          "string" &&
        businessId
      ) {
        query = query.eq(
          "business_id",
          businessId,
        );
      } else {
        return response
          .status(200)
          .json({
            received: true,
            ignored: true,
          });
      }

      const { error } =
        await query;

      if (error) {
        throw error;
      }
    }

    if (
      eventType ===
      "checkout.session.async_payment_failed"
    ) {
      const zistoSubscriptionId =
        object?.metadata
          ?.zisto_subscription_id;

      const businessId =
        object?.metadata
          ?.business_id ??
        object?.client_reference_id;

      let query =
        supabaseAdmin
          .from(
            "subscriptions",
          )
          .update({
            billing_status:
              "past_due",
            access_status:
              "grace_period",
            payment_due_at:
              new Date()
                .toISOString(),
            grace_until:
              addDays(
                new Date()
                  .toISOString(),
                10,
              ),
            overdue_email_sent_at:
              null,
            suspended_at:
              null,
            suspension_email_sent_at:
              null,
            updated_at:
              new Date()
                .toISOString(),
          });

      if (
        typeof zistoSubscriptionId ===
          "string" &&
        zistoSubscriptionId
      ) {
        query = query.eq(
          "id",
          zistoSubscriptionId,
        );
      } else if (
        typeof businessId ===
          "string" &&
        businessId
      ) {
        query = query.eq(
          "business_id",
          businessId,
        );
      } else {
        return response
          .status(200)
          .json({
            received: true,
            ignored: true,
          });
      }

      const { error } =
        await query;

      if (error) {
        throw error;
      }
    }

    if (
      eventType ===
      "invoice.paid"
    ) {
      const invoice =
        object;

      const stripeSubscriptionId =
        subscriptionIdFromInvoice(
          invoice,
        );

      if (
        stripeSubscriptionId
      ) {
        const nextBillingAt =
          invoicePeriodEnd(
            invoice,
          );

        const payload: Record<
          string,
          unknown
        > = {
          stripe_customer_id:
            objectId(
              invoice.customer,
            ),
          billing_status:
            "active",
          access_status:
            "active",
          last_paid_at:
            new Date()
              .toISOString(),
          payment_due_at:
            null,
          grace_until: null,
          overdue_email_sent_at:
            null,
          suspended_at: null,
          suspension_email_sent_at:
            null,
          updated_at:
            new Date()
              .toISOString(),
        };

        if (nextBillingAt) {
          payload.next_billing_at =
            nextBillingAt;
        }

        const { error } =
          await supabaseAdmin
            .from(
              "subscriptions",
            )
            .update(payload)
            .eq(
              "stripe_subscription_id",
              stripeSubscriptionId,
            );

        if (error) {
          throw error;
        }
      }
    }

    if (
      eventType ===
        "invoice.payment_failed" ||
      eventType ===
        "invoice.payment_action_required"
    ) {
      const invoice =
        object;

      const stripeSubscriptionId =
        subscriptionIdFromInvoice(
          invoice,
        );

      if (
        stripeSubscriptionId
      ) {
        const dueAt =
          invoicePeriodStart(
            invoice,
          );

        const { error } =
          await supabaseAdmin
            .from(
              "subscriptions",
            )
            .update({
              stripe_customer_id:
                objectId(
                  invoice.customer,
                ),
              billing_status:
                "past_due",
              access_status:
                "grace_period",
              next_billing_at:
                dueAt,
              payment_due_at:
                dueAt,
              grace_until:
                addDays(
                  dueAt,
                  10,
                ),
              overdue_email_sent_at:
                null,
              suspended_at:
                null,
              suspension_email_sent_at:
                null,
              updated_at:
                new Date()
                  .toISOString(),
            })
            .eq(
              "stripe_subscription_id",
              stripeSubscriptionId,
            );

        if (error) {
          throw error;
        }
      }
    }

    if (
      eventType ===
        "customer.subscription.deleted" ||
      eventType ===
        "customer.subscription.paused"
    ) {
      const stripeSubscriptionId =
        objectId(object);

      if (
        stripeSubscriptionId
      ) {
        const { error } =
          await supabaseAdmin
            .from(
              "subscriptions",
            )
            .update({
              billing_status:
                "cancelled",
              access_status:
                "suspended",
              suspended_at:
                new Date()
                  .toISOString(),
              updated_at:
                new Date()
                  .toISOString(),
            })
            .eq(
              "stripe_subscription_id",
              stripeSubscriptionId,
            );

        if (error) {
          throw error;
        }
      }
    }

    return response
      .status(200)
      .json({
        received: true,
      });
  } catch (error) {
    console.error(
      "Stripe webhook processing failed:",
      error,
    );

    return response
      .status(500)
      .json({
        error:
          "Webhook processing failed",
      });
  }
}

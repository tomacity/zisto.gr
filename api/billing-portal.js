const ALLOWED_ORIGINS = new Set([
  "https://zistogr.vercel.app",
  "https://zisto.app",
  "https://www.zisto.app",
]);

function setCorsHeaders(req, res) {
  const origin = req.headers.origin;

  if (
    origin &&
    (
      ALLOWED_ORIGINS.has(origin) ||
      /^https:\/\/zisto-[a-z0-9-]+-tomacitys-projects\.vercel\.app$/i.test(
        origin,
      )
    )
  ) {
    res.setHeader(
      "Access-Control-Allow-Origin",
      origin,
    );
  }

  res.setHeader("Vary", "Origin");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "POST, OPTIONS",
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization",
  );
  res.setHeader("Cache-Control", "no-store");
}

async function fetchWithTimeout(
  url,
  options = {},
  timeoutMs = 8000,
) {
  const controller =
    new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    timeoutMs,
  );

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function supabaseRequest({
  supabaseUrl,
  supabaseSecretKey,
  path,
  method = "GET",
  headers = {},
}) {
  return fetchWithTimeout(
    `${supabaseUrl}${path}`,
    {
      method,
      headers: {
        apikey:
          supabaseSecretKey,
        Authorization:
          `Bearer ${supabaseSecretKey}`,
        "Content-Type":
          "application/json",
        ...headers,
      },
    },
    8000,
  );
}

async function stripeJson(
  path,
  secretKey,
  options = {},
) {
  const response =
    await fetchWithTimeout(
      `https://api.stripe.com${path}`,
      {
        ...options,
        headers: {
          Authorization:
            `Bearer ${secretKey}`,
          ...(
            options.headers ?? {}
          ),
        },
      },
      8000,
    );

  const result =
    await response.json();

  if (!response.ok) {
    const error =
      new Error(
        result?.error?.message ??
          `Stripe request failed (${response.status})`,
      );

    error.status =
      response.status;
    throw error;
  }

  return result;
}

async function getPortalConfiguration(
  stripeSecretKey,
) {
  const configurations =
    await stripeJson(
      "/v1/billing_portal/configurations?active=true&limit=100",
      stripeSecretKey,
    );

  const existing =
    configurations?.data?.find(
      (configuration) =>
        configuration?.metadata
          ?.zisto_portal_version ===
        "1",
    );

  if (existing) {
    return existing.id;
  }

  const form =
    new URLSearchParams();

  form.set(
    "features[invoice_history][enabled]",
    "true",
  );
  form.set(
    "features[payment_method_update][enabled]",
    "true",
  );
  form.set(
    "features[customer_update][enabled]",
    "false",
  );
  form.set(
    "features[subscription_cancel][enabled]",
    "false",
  );
  form.set(
    "features[subscription_update][enabled]",
    "false",
  );
  form.set(
    "business_profile[headline]",
    "Διαχείριση πληρωμών Zisto",
  );
  form.set(
    "business_profile[privacy_policy_url]",
    "https://zisto.app/#/privacy",
  );
  form.set(
    "business_profile[terms_of_service_url]",
    "https://zisto.app/#/payments",
  );
  form.set(
    "metadata[zisto_portal_version]",
    "1",
  );
  form.set(
    "name",
    "Zisto Billing Portal",
  );

  const created =
    await stripeJson(
      "/v1/billing_portal/configurations",
      stripeSecretKey,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded",
        },
        body:
          form.toString(),
      },
    );

  return created.id;
}

export default async function handler(
  req,
  res,
) {
  setCorsHeaders(req, res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  const supabaseUrl =
    process.env.SUPABASE_URL;

  const supabaseSecretKey =
    process.env.SUPABASE_SECRET_KEY;

  const stripeSecretKey =
    process.env.STRIPE_SECRET_KEY;

  if (
    !supabaseUrl ||
    !supabaseSecretKey ||
    !stripeSecretKey
  ) {
    return res.status(500).json({
      error:
        "Billing portal is not configured",
    });
  }

  const authorization =
    req.headers.authorization ?? "";

  const accessToken =
    authorization.startsWith(
      "Bearer ",
    )
      ? authorization.slice(7)
      : null;

  const businessId =
    typeof req.query.business_id ===
    "string"
      ? req.query.business_id
      : null;

  if (!accessToken) {
    return res.status(401).json({
      error:
        "Authentication required",
    });
  }

  if (!businessId) {
    return res.status(400).json({
      error:
        "Business is required",
    });
  }

  try {
    const userResponse =
      await supabaseRequest({
        supabaseUrl,
        supabaseSecretKey,
        path: "/auth/v1/user",
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
        },
      });

    if (!userResponse.ok) {
      return res.status(401).json({
        error:
          "Invalid or expired session",
      });
    }

    const user =
      await userResponse.json();

    const adminQuery =
      new URLSearchParams({
        user_id:
          `eq.${user.id}`,
        select: "user_id",
        limit: "1",
      });

    const membershipQuery =
      new URLSearchParams({
        user_id:
          `eq.${user.id}`,
        business_id:
          `eq.${businessId}`,
        select:
          "business_id,role",
        limit: "1",
      });

    const [
      adminResponse,
      membershipResponse,
    ] = await Promise.all([
      supabaseRequest({
        supabaseUrl,
        supabaseSecretKey,
        path:
          `/rest/v1/zisto_admins?${adminQuery.toString()}`,
      }),
      supabaseRequest({
        supabaseUrl,
        supabaseSecretKey,
        path:
          `/rest/v1/business_members?${membershipQuery.toString()}`,
      }),
    ]);

    if (
      !adminResponse.ok ||
      !membershipResponse.ok
    ) {
      return res.status(500).json({
        error:
          "Could not verify billing access",
      });
    }

    const admins =
      await adminResponse.json();

    const memberships =
      await membershipResponse.json();

    const isAdmin =
      admins.length > 0;

    const membership =
      memberships[0] ?? null;

    if (
      !isAdmin &&
      membership?.role !== "owner"
    ) {
      return res.status(403).json({
        error:
          "Only the business owner can manage billing",
      });
    }

    const subscriptionQuery =
      new URLSearchParams({
        business_id:
          `eq.${businessId}`,
        select:
          "id,stripe_customer_id,stripe_subscription_id",
        limit: "1",
      });

    const subscriptionResponse =
      await supabaseRequest({
        supabaseUrl,
        supabaseSecretKey,
        path:
          `/rest/v1/subscriptions?${subscriptionQuery.toString()}`,
      });

    if (!subscriptionResponse.ok) {
      return res.status(500).json({
        error:
          "Could not load subscription",
      });
    }

    const subscriptions =
      await subscriptionResponse.json();

    const subscription =
      subscriptions[0];

    if (!subscription) {
      return res.status(404).json({
        error:
          "Subscription not found",
      });
    }

    if (
      !subscription.stripe_customer_id
    ) {
      return res.status(400).json({
        error:
          "Stripe customer is not connected yet",
      });
    }

    const configurationId =
      await getPortalConfiguration(
        stripeSecretKey,
      );

    const requestOrigin =
      typeof req.headers.origin ===
        "string" &&
      /^https?:\/\//.test(
        req.headers.origin,
      )
        ? req.headers.origin
        : null;

    const appUrl = (
      requestOrigin ??
      process.env.APP_URL ??
      "https://zisto.app"
    ).replace(/\/$/, "");

    const returnUrl =
      `${appUrl}/#/dashboard?business=${encodeURIComponent(
        businessId,
      )}&settings=subscription`;

    const portalForm =
      new URLSearchParams();

    portalForm.set(
      "customer",
      subscription.stripe_customer_id,
    );
    portalForm.set(
      "configuration",
      configurationId,
    );
    portalForm.set(
      "return_url",
      returnUrl,
    );
    portalForm.set(
      "locale",
      "auto",
    );

    const portal =
      await stripeJson(
        "/v1/billing_portal/sessions",
        stripeSecretKey,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/x-www-form-urlencoded",
          },
          body:
            portalForm.toString(),
        },
      );

    return res.status(200).json({
      portal_url: portal.url,
    });
  } catch (error) {
    console.error(
      "Billing portal API error:",
      error,
    );

    const isAbort =
      error?.name ===
      "AbortError";

    return res.status(
      isAbort ? 504 : 500,
    ).json({
      error: isAbort
        ? "Το Stripe άργησε να απαντήσει. Δοκίμασε ξανά."
        : error instanceof Error
          ? error.message
          : "Δεν ήταν δυνατό να ανοίξει η διαχείριση πληρωμών.",
    });
  }
}

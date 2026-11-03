const ALLOWED_ORIGINS = new Set([
  "https://zistogr.vercel.app",
  "https://zisto.app",
  "https://www.zisto.app",
]);

function isAllowedOrigin(origin) {
  return (
    ALLOWED_ORIGINS.has(origin) ||
    /^https:\/\/zisto-[a-z0-9-]+-tomacitys-projects\.vercel\.app$/i.test(
      origin,
    )
  );
}

function setCorsHeaders(req, res) {
  const origin = req.headers.origin;

  if (origin && isAllowedOrigin(origin)) {
    res.setHeader(
      "Access-Control-Allow-Origin",
      origin,
    );
  }

  res.setHeader("Vary", "Origin");

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PATCH, OPTIONS",
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization",
  );

  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate",
  );
}

async function fetchWithTimeout(
  url,
  options = {},
  timeoutMs = 7000,
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
  body,
}) {
  return fetch(`${supabaseUrl}${path}`, {
    method,

    headers: {
      apikey: supabaseSecretKey,

      Authorization:
        `Bearer ${supabaseSecretKey}`,

      "Content-Type": "application/json",

      ...headers,
    },

    body:
      body === undefined
        ? undefined
        : JSON.stringify(body),
  });
}

function getEventName(eventType) {
  /*
   * Το dashboard χρησιμοποιεί ακόμη review_click.
   * Στη νέα βάση το event αποθηκεύεται ως review_open.
   */
  if (eventType === "review_open") {
    return "review_click";
  }

  return eventType;
}

function getEventSource(event) {
  const metadata =
    event.metadata &&
    typeof event.metadata === "object" &&
    !Array.isArray(event.metadata)
      ? event.metadata
      : {};

  const source =
    typeof metadata.source === "string"
      ? metadata.source.toLowerCase()
      : "unknown";

  const allowedSources = new Set([
    "nfc",
    "qr",
    "direct",
    "unknown",
  ]);

  return allowedSources.has(source)
    ? source
    : "unknown";
}

function normalizeEvent(event) {
  return {
    event_name: getEventName(
      event.event_type,
    ),

    source: getEventSource(event),

    session_id:
      event.session_id ?? null,

    visitor_id:
      event.visitor_id ?? null,

    metadata:
      event.metadata &&
      typeof event.metadata === "object" &&
      !Array.isArray(event.metadata)
        ? event.metadata
        : {},

    created_at: event.created_at,
  };
}

function getUniqueVisitorCount(events) {
  const identifiers = events
    .map(
      (event) =>
        event.visitor_id ||
        event.session_id,
    )
    .filter(Boolean);

  return new Set(identifiers).size;
}

function countEvent(events, eventName) {
  return events.filter(
    (event) =>
      event.event_name === eventName,
  ).length;
}

function getStartOfToday(now) {
  const date = new Date(now);

  date.setHours(0, 0, 0, 0);

  return date;
}

function getStartOfWeek(now) {
  const date = new Date(now);

  date.setDate(now.getDate() - 6);
  date.setHours(0, 0, 0, 0);

  return date;
}

function getStartOfMonth(now) {
  return new Date(
    now.getFullYear(),
    now.getMonth(),
    1,
  );
}


function dateKeyInTimeZone(
  value,
  timeZone = "Europe/Athens",
) {
  const parts =
    new Intl.DateTimeFormat(
      "en-GB",
      {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      },
    ).formatToParts(
      new Date(value),
    );

  const values = Object.fromEntries(
    parts.map((part) => [
      part.type,
      part.value,
    ]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

export default async function handler(
  req,
  res,
) {
  setCorsHeaders(req, res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (
    req.method !== "GET" &&
    req.method !== "PATCH" &&
    req.method !== "POST"
  ) {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  const supabaseUrl =
    process.env.SUPABASE_URL;

  const supabaseSecretKey =
    process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseSecretKey) {
    return res.status(500).json({
      error: "Server configuration error",
    });
  }

  const authorization =
    req.headers.authorization ?? "";

  const accessToken =
    authorization.startsWith("Bearer ")
      ? authorization.slice(7)
      : null;

  const requestedBusinessId =
    typeof req.query.business_id ===
    "string"
      ? req.query.business_id
      : null;

  const requestedView =
    typeof req.query.view === "string"
      ? req.query.view
      : null;

  if (!accessToken) {
    return res.status(401).json({
      error: "Authentication required",
    });
  }

  try {
    /*
     * 1. Επιβεβαίωση Supabase session.
     */
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

    const user = await userResponse.json();

    /*
     * 2. Έλεγχος αν ο χρήστης είναι admin.
     */
    const adminQuery =
      new URLSearchParams({
        user_id: `eq.${user.id}`,
        select: "user_id",
        limit: "1",
      });

    const adminResponse =
      await supabaseRequest({
        supabaseUrl,
        supabaseSecretKey,

        path:
          `/rest/v1/zisto_admins?${adminQuery.toString()}`,
      });

    if (!adminResponse.ok) {
      const errorText =
        await adminResponse.text();

      console.error(
        "Admin query failed:",
        errorText,
      );

      return res.status(500).json({
        error: "Failed to verify admin",
      });
    }

    const admins =
      await adminResponse.json();

    const isAdmin = admins.length > 0;

    /*
     * 3. Φόρτωση business membership.
     */
    const membershipQuery =
      new URLSearchParams({
        user_id: `eq.${user.id}`,
        select: "business_id,role",
        limit: "1",
      });

    const membershipResponse =
      await supabaseRequest({
        supabaseUrl,
        supabaseSecretKey,

        path:
          `/rest/v1/business_members?${membershipQuery.toString()}`,
      });

    if (!membershipResponse.ok) {
      const errorText =
        await membershipResponse.text();

      console.error(
        "Membership query failed:",
        errorText,
      );

      return res.status(500).json({
        error:
          "Failed to load membership",
      });
    }

    const memberships =
      await membershipResponse.json();

    const membership =
      memberships[0] ?? null;

    let businessId;

    if (
      isAdmin &&
      requestedBusinessId
    ) {
      businessId =
        requestedBusinessId;
    } else {
      if (!membership) {
        return res.status(403).json({
          error:
            "This user is not assigned to a business",
        });
      }

      businessId =
        membership.business_id;
    }

    if (!isAdmin && membership) {
      try {
        await supabaseRequest({
          supabaseUrl,
          supabaseSecretKey,
          path:
            `/rest/v1/invitations?invited_user_id=eq.${encodeURIComponent(
              user.id,
            )}&status=eq.pending`,
          method: "PATCH",
          headers: {
            Prefer: "return=minimal",
          },
          body: {
            status: "accepted",
            accepted_at:
              new Date().toISOString(),
          },
        });
      } catch (invitationAcceptError) {
        console.error(
          "Invitation acceptance update failed:",
          invitationAcceptError,
        );
      }
    }

    if (
      requestedView === "billing-history" &&
      req.method === "GET"
    ) {
      if (
        !isAdmin &&
        membership?.role !== "owner"
      ) {
        return res.status(403).json({
          error:
            "Only the business owner can view billing history",
        });
      }

      const subscriptionParams =
        new URLSearchParams({
          business_id:
            `eq.${businessId}`,
          select:
            "id,business_id,amount_cents,currency,vat_rate,stripe_customer_id,stripe_subscription_id",
          limit: "1",
        });

      const subscriptionResponse =
        await supabaseRequest({
          supabaseUrl,
          supabaseSecretKey,
          path:
            `/rest/v1/subscriptions?${subscriptionParams.toString()}`,
        });

      if (!subscriptionResponse.ok) {
        return res.status(500).json({
          error:
            "Could not load subscription",
        });
      }

      const subscriptionRows =
        await subscriptionResponse.json();

      const subscription =
        subscriptionRows[0] ?? null;

      const stripeSecretKey =
        process.env.STRIPE_SECRET_KEY;

      if (
        subscription?.stripe_customer_id &&
        stripeSecretKey
      ) {
        const invoiceParams =
          new URLSearchParams({
            customer:
              subscription.stripe_customer_id,
            limit: "50",
          });

        const stripeResponse =
          await fetchWithTimeout(
            `https://api.stripe.com/v1/invoices?${invoiceParams.toString()}`,
            {
              headers: {
                Authorization:
                  `Bearer ${stripeSecretKey}`,
              },
            },
          );

        if (stripeResponse.ok) {
          const stripeResult =
            await stripeResponse.json();

          const invoices =
            Array.isArray(
              stripeResult?.data,
            )
              ? stripeResult.data
              : [];

          const toIso = (
            unixValue,
          ) =>
            typeof unixValue ===
            "number"
              ? new Date(
                  unixValue * 1000,
                ).toISOString()
              : null;

          const statusMap = {
            draft: "draft",
            open: "open",
            paid: "paid",
            void: "void",
            uncollectible:
              "uncollectible",
          };

          for (
            const invoice of invoices
          ) {
            const stripeStatus =
              typeof invoice?.status ===
              "string"
                ? invoice.status
                : "open";

            const documentStatus =
              statusMap[stripeStatus] ??
              "open";

            const firstLine =
              Array.isArray(
                invoice?.lines?.data,
              )
                ? invoice.lines.data[0]
                : null;

            const stripeTaxCents =
              Array.isArray(
                invoice?.total_tax_amounts,
              )
                ? invoice.total_tax_amounts.reduce(
                    (
                      sum,
                      item,
                    ) =>
                      sum +
                      (typeof item?.amount ===
                      "number"
                        ? item.amount
                        : 0),
                    0,
                  )
                : 0;

            const stripeTotalCents =
              typeof invoice?.total ===
              "number"
                ? invoice.total
                : 0;

            const configuredNetCents =
              Math.max(
                0,
                Number(
                  subscription.amount_cents ??
                    0,
                ),
              );

            const configuredVatRate =
              Math.max(
                0,
                Number(
                  subscription.vat_rate ??
                    0,
                ),
              );

            const configuredVatCents =
              Math.round(
                configuredNetCents *
                  configuredVatRate /
                  100,
              );

            const configuredGrossCents =
              configuredNetCents +
              configuredVatCents;

            let subtotalCents =
              typeof invoice?.subtotal ===
              "number"
                ? invoice.subtotal
                : configuredNetCents;

            let taxCents =
              stripeTaxCents;

            let totalCents =
              stripeTotalCents > 0
                ? stripeTotalCents
                : subtotalCents +
                  taxCents;

            if (
              taxCents === 0 &&
              configuredVatRate > 0 &&
              totalCents > 0
            ) {
              if (
                configuredNetCents > 0 &&
                configuredGrossCents ===
                  totalCents
              ) {
                subtotalCents =
                  configuredNetCents;
                taxCents =
                  configuredVatCents;
              } else {
                subtotalCents =
                  Math.round(
                    totalCents /
                      (1 +
                        configuredVatRate /
                          100),
                  );

                taxCents =
                  Math.max(
                    0,
                    totalCents -
                      subtotalCents,
                  );
              }
            }

            const documentPayload = {
              business_id:
                businessId,
              subscription_id:
                subscription.id,
              document_type:
                "invoice",
              status:
                documentStatus,
              source: "stripe",
              currency:
                (
                  invoice?.currency ??
                  subscription.currency ??
                  "EUR"
                ).toUpperCase(),
              subtotal_cents:
                Math.max(
                  0,
                  subtotalCents,
                ),
              vat_cents:
                Math.max(
                  0,
                  taxCents,
                ),
              total_cents:
                Math.max(
                  0,
                  totalCents,
                ),
              document_number:
                invoice?.number ??
                null,
              stripe_invoice_id:
                invoice?.id ??
                null,
              stripe_payment_intent_id:
                typeof invoice
                  ?.payment_intent ===
                  "string"
                  ? invoice.payment_intent
                  : invoice
                      ?.payment_intent
                      ?.id ??
                    null,
              hosted_url:
                invoice
                  ?.hosted_invoice_url ??
                null,
              pdf_url:
                invoice?.invoice_pdf ??
                null,
              issued_at:
                toIso(
                  invoice?.created,
                ),
              due_at:
                toIso(
                  invoice?.due_date,
                ),
              paid_at:
                documentStatus ===
                "paid"
                  ? toIso(
                      invoice
                        ?.status_transitions
                        ?.paid_at,
                    )
                  : null,
              period_start:
                toIso(
                  firstLine
                    ?.period
                    ?.start,
                ),
              period_end:
                toIso(
                  firstLine
                    ?.period
                    ?.end,
                ),
              metadata: {
                stripe_status:
                  stripeStatus,
                billing_reason:
                  invoice
                    ?.billing_reason ??
                  null,
              },
              updated_at:
                new Date()
                  .toISOString(),
            };

            const upsertResponse =
              await supabaseRequest({
                supabaseUrl,
                supabaseSecretKey,
                path:
                  "/rest/v1/billing_documents?on_conflict=stripe_invoice_id",
                method: "POST",
                headers: {
                  Prefer:
                    "resolution=merge-duplicates",
                },
                body:
                  documentPayload,
              });

            if (!upsertResponse.ok) {
              console.error(
                "Billing history backfill failed:",
                await upsertResponse.text(),
              );
            }
          }
        } else {
          console.error(
            "Stripe invoice history load failed:",
            await stripeResponse.text(),
          );
        }
      }

      const historyParams =
        new URLSearchParams({
          business_id:
            `eq.${businessId}`,
          select:
            "id,document_type,status,source,currency,subtotal_cents,vat_cents,total_cents,document_number,stripe_invoice_id,provider_name,provider_document_id,provider_mark,provider_uid,hosted_url,pdf_url,issued_at,due_at,paid_at,period_start,period_end,created_at,metadata",
          order:
            "issued_at.desc.nullslast,created_at.desc",
          limit: "50",
        });

      const historyResponse =
        await supabaseRequest({
          supabaseUrl,
          supabaseSecretKey,
          path:
            `/rest/v1/billing_documents?${historyParams.toString()}`,
        });

      if (!historyResponse.ok) {
        console.error(
          "Billing history query failed:",
          await historyResponse.text(),
        );

        return res.status(500).json({
          error:
            "Could not load billing history",
        });
      }

      const [
        billingProfileResponse,
        issuerProfileResponse,
      ] = await Promise.all([
        supabaseRequest({
          supabaseUrl,
          supabaseSecretKey,
          path:
            `/rest/v1/billing_profiles?business_id=eq.${encodeURIComponent(
              businessId,
            )}&select=customer_type,legal_name,trade_name,tax_id,tax_country,tax_office,activity,invoice_email,address_line1,address_line2,city,region,postal_code,country_code&limit=1`,
        }),
        supabaseRequest({
          supabaseUrl,
          supabaseSecretKey,
          path:
            "/rest/v1/billing_issuer_profile?id=eq.1&select=legal_name,trade_name,tax_id,tax_country,tax_office,activity,address_line1,address_line2,city,region,postal_code,country_code,invoice_provider,provider_account_id,live_billing_enabled&limit=1",
        }),
      ]);

      const billingProfiles =
        billingProfileResponse.ok
          ? await billingProfileResponse.json()
          : [];

      const issuerProfiles =
        issuerProfileResponse.ok
          ? await issuerProfileResponse.json()
          : [];

      return res.status(200).json({
        documents:
          await historyResponse.json(),
        billing_profile:
          billingProfiles[0] ?? null,
        issuer_profile:
          issuerProfiles[0] ?? null,
      });
    }

    if (
      requestedView === "billing-profile" &&
      (req.method === "GET" ||
        req.method === "PATCH")
    ) {
      if (
        !isAdmin &&
        membership?.role !== "owner"
      ) {
        return res.status(403).json({
          error:
            "Only the business owner can manage billing details",
        });
      }

      const profileParams =
        new URLSearchParams({
          business_id:
            `eq.${businessId}`,
          select:
            "id,business_id,customer_type,legal_name,trade_name,tax_id,tax_country,tax_office,activity,invoice_email,address_line1,address_line2,city,region,postal_code,country_code,created_at,updated_at",
          limit: "1",
        });

      if (req.method === "GET") {
        const profileResponse =
          await supabaseRequest({
            supabaseUrl,
            supabaseSecretKey,
            path:
              `/rest/v1/billing_profiles?${profileParams.toString()}`,
          });

        if (!profileResponse.ok) {
          const errorText =
            await profileResponse.text();

          console.error(
            "Billing profile load failed:",
            errorText,
          );

          return res.status(500).json({
            error:
              "Could not load billing profile",
          });
        }

        const rows =
          await profileResponse.json();

        return res.status(200).json({
          billing_profile:
            rows[0] ?? null,
        });
      }

      const body =
        req.body ?? {};

      const cleanText = (
        value,
        maxLength = 180,
      ) => {
        if (
          typeof value !== "string"
        ) {
          return null;
        }

        const cleaned =
          value.trim();

        return cleaned
          ? cleaned.slice(
              0,
              maxLength,
            )
          : null;
      };

      const customerType =
        body.customer_type ===
        "individual"
          ? "individual"
          : "business";

      const taxCountry =
        (
          cleanText(
            body.tax_country,
            2,
          ) ?? "GR"
        ).toUpperCase();

      const countryCode =
        (
          cleanText(
            body.country_code,
            2,
          ) ?? "GR"
        ).toUpperCase();

      const invoiceEmail =
        cleanText(
          body.invoice_email,
          254,
        );

      if (
        invoiceEmail &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
          invoiceEmail,
        )
      ) {
        return res.status(400).json({
          error:
            "Το email παραστατικών δεν είναι έγκυρο.",
        });
      }

      const payload = {
        business_id:
          businessId,
        customer_type:
          customerType,
        legal_name:
          cleanText(
            body.legal_name,
          ),
        trade_name:
          cleanText(
            body.trade_name,
          ),
        tax_id:
          cleanText(
            body.tax_id,
            40,
          )?.toUpperCase() ??
          null,
        tax_country:
          taxCountry,
        tax_office:
          cleanText(
            body.tax_office,
            120,
          ),
        activity:
          cleanText(
            body.activity,
            180,
          ),
        invoice_email:
          invoiceEmail,
        address_line1:
          cleanText(
            body.address_line1,
          ),
        address_line2:
          cleanText(
            body.address_line2,
          ),
        city:
          cleanText(
            body.city,
            120,
          ),
        region:
          cleanText(
            body.region,
            120,
          ),
        postal_code:
          cleanText(
            body.postal_code,
            30,
          ),
        country_code:
          countryCode,
        updated_at:
          new Date()
            .toISOString(),
      };

      const upsertResponse =
        await supabaseRequest({
          supabaseUrl,
          supabaseSecretKey,
          path:
            "/rest/v1/billing_profiles?on_conflict=business_id",
          method: "POST",
          headers: {
            Prefer:
              "resolution=merge-duplicates,return=representation",
          },
          body: payload,
        });

      if (!upsertResponse.ok) {
        const errorText =
          await upsertResponse.text();

        console.error(
          "Billing profile save failed:",
          errorText,
        );

        return res.status(500).json({
          error:
            "Could not save billing profile",
        });
      }

      const rows =
        await upsertResponse.json();

      if (invoiceEmail) {
        const subscriptionEmailUpdate =
          await supabaseRequest({
            supabaseUrl,
            supabaseSecretKey,
            path:
              `/rest/v1/subscriptions?business_id=eq.${encodeURIComponent(
                businessId,
              )}`,
            method: "PATCH",
            headers: {
              Prefer:
                "return=minimal",
            },
            body: {
              billing_email:
                invoiceEmail,
              updated_at:
                new Date().toISOString(),
            },
          });

        if (!subscriptionEmailUpdate.ok) {
          console.error(
            "Subscription billing email sync failed:",
            await subscriptionEmailUpdate.text(),
          );

          return res.status(500).json({
            error:
              "Could not sync billing email",
          });
        }
      }

      return res.status(200).json({
        billing_profile:
          rows[0] ?? payload,
      });
    }

    if (
      requestedView === "billing-portal" &&
      req.method === "POST"
    ) {
      if (
        !isAdmin &&
        membership?.role !== "owner"
      ) {
        return res.status(403).json({
          error:
            "Only the business owner can manage billing",
        });
      }

      const subscriptionParams =
        new URLSearchParams({
          business_id:
            `eq.${businessId}`,
          select:
            "id,business_id,stripe_customer_id,stripe_subscription_id",
          limit: "1",
        });

      const subscriptionResponse =
        await supabaseRequest({
          supabaseUrl,
          supabaseSecretKey,
          path:
            `/rest/v1/subscriptions?${subscriptionParams.toString()}`,
        });

      if (!subscriptionResponse.ok) {
        return res.status(500).json({
          error:
            "Could not load subscription",
        });
      }

      const subscriptionRows =
        await subscriptionResponse.json();

      const subscription =
        subscriptionRows[0];

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

      const stripeSecretKey =
        process.env.STRIPE_SECRET_KEY;

      if (!stripeSecretKey) {
        return res.status(500).json({
          error:
            "Stripe is not configured",
        });
      }

      const stripeHeaders = {
        Authorization:
          `Bearer ${stripeSecretKey}`,
        "Content-Type":
          "application/x-www-form-urlencoded",
      };

      const configurationsResponse =
        await fetchWithTimeout(
          "https://api.stripe.com/v1/billing_portal/configurations?active=true&limit=100",
          {
            headers: {
              Authorization:
                `Bearer ${stripeSecretKey}`,
            },
          },
        );

      const configurationsResult =
        await configurationsResponse.json();

      if (!configurationsResponse.ok) {
        console.error(
          "Stripe portal configuration lookup failed:",
          configurationsResult,
        );

        return res.status(502).json({
          error:
            configurationsResult?.error?.message ??
            "Could not load Stripe billing portal",
        });
      }

      let portalConfiguration =
        configurationsResult?.data?.find(
          (configuration) =>
            configuration?.metadata
              ?.zisto_portal_version ===
              "1",
        );

      const configurationForm =
        new URLSearchParams();

      configurationForm.set(
        "features[invoice_history][enabled]",
        "true",
      );
      configurationForm.set(
        "features[payment_method_update][enabled]",
        "true",
      );
      configurationForm.set(
        "features[customer_update][enabled]",
        "false",
      );
      configurationForm.set(
        "features[subscription_cancel][enabled]",
        "false",
      );
      configurationForm.set(
        "features[subscription_update][enabled]",
        "false",
      );
      configurationForm.set(
        "business_profile[headline]",
        "Διαχείριση πληρωμών Zisto",
      );
      configurationForm.set(
        "business_profile[privacy_policy_url]",
        "https://zisto.app/#/privacy",
      );
      configurationForm.set(
        "business_profile[terms_of_service_url]",
        "https://zisto.app/#/payments",
      );
      configurationForm.set(
        "metadata[zisto_portal_version]",
        "1",
      );

      if (!portalConfiguration) {
        configurationForm.set(
          "name",
          "Zisto Billing Portal",
        );

        const createConfigurationResponse =
          await fetchWithTimeout(
            "https://api.stripe.com/v1/billing_portal/configurations",
            {
              method: "POST",
              headers: stripeHeaders,
              body:
                configurationForm.toString(),
            },
          );

        const createConfigurationResult =
          await createConfigurationResponse.json();

        if (
          !createConfigurationResponse.ok
        ) {
          console.error(
            "Stripe portal configuration creation failed:",
            createConfigurationResult,
          );

          return res.status(502).json({
            error:
              createConfigurationResult?.error?.message ??
              "Could not configure Stripe billing portal",
          });
        }

        portalConfiguration =
          createConfigurationResult;
      }

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
        portalConfiguration.id,
      );
      portalForm.set(
        "return_url",
        returnUrl,
      );
      portalForm.set(
        "locale",
        "auto",
      );

      const portalResponse =
        await fetchWithTimeout(
          "https://api.stripe.com/v1/billing_portal/sessions",
          {
            method: "POST",
            headers: stripeHeaders,
            body:
              portalForm.toString(),
          },
        );

      const portalResult =
        await portalResponse.json();

      if (!portalResponse.ok) {
        console.error(
          "Stripe billing portal session creation failed:",
          portalResult,
        );

        return res.status(502).json({
          error:
            portalResult?.error?.message ??
            "Could not open Stripe billing portal",
        });
      }

      return res.status(200).json({
        portal_url:
          portalResult.url,
      });
    }

    if (
      requestedView === "subscription" &&
      req.method === "PATCH"
    ) {
      if (
        !isAdmin &&
        membership?.role !== "owner"
      ) {
        return res.status(403).json({
          error:
            "Only the business owner can manage the subscription",
        });
      }

      const body = req.body ?? {};

      const action =
        typeof body.action === "string"
          ? body.action
          : "";

      if (
        action !== "cancel_subscription" &&
        action !== "resume_renewal"
      ) {
        return res.status(400).json({
          error:
            "Invalid subscription action",
        });
      }

      const subscriptionParams =
        new URLSearchParams({
          business_id:
            `eq.${businessId}`,
          select:
            "id,business_id,billing_email,amount_cents,currency,vat_rate,billing_interval_months,billing_status,access_status,stripe_customer_id,stripe_subscription_id,cancel_at_period_end,businesses(name)",
          limit: "1",
        });

      const subscriptionResponse =
        await supabaseRequest({
          supabaseUrl,
          supabaseSecretKey,
          path:
            `/rest/v1/subscriptions?${subscriptionParams.toString()}`,
        });

      if (!subscriptionResponse.ok) {
        return res.status(500).json({
          error:
            "Could not load subscription",
        });
      }

      const subscriptionRows =
        await subscriptionResponse.json();

      const subscription =
        subscriptionRows[0];

      if (!subscription) {
        return res.status(404).json({
          error:
            "Subscription not found",
        });
      }

      if (
        !subscription
          .stripe_subscription_id
      ) {
        if (
          action ===
          "cancel_subscription"
        ) {
          const localUpdateResponse =
            await supabaseRequest({
              supabaseUrl,
              supabaseSecretKey,
              path:
                `/rest/v1/subscriptions?id=eq.${subscription.id}`,
              method: "PATCH",
              headers: {
                Prefer:
                  "return=representation",
              },
              body: {
                billing_status:
                  "cancelled",
                access_status:
                  "suspended",
                cancel_at_period_end:
                  false,
                cancellation_requested_at:
                  new Date()
                    .toISOString(),
                updated_at:
                  new Date()
                    .toISOString(),
              },
            });

          if (
            !localUpdateResponse.ok
          ) {
            return res.status(500).json({
              error:
                "Could not update subscription",
            });
          }

          const localRows =
            await localUpdateResponse.json();

          return res.status(200).json({
            subscription:
              localRows[0] ?? null,
          });
        }

        if (!subscription.billing_email) {
          return res.status(400).json({
            error:
              "Billing email is required before creating checkout",
          });
        }

        const stripeSecretKey =
          process.env.STRIPE_SECRET_KEY;

        if (!stripeSecretKey) {
          return res.status(500).json({
            error:
              "Stripe is not configured",
          });
        }

        const totalAmountCents =
          Math.round(
            Number(
              subscription.amount_cents,
            ) *
              (1 +
                Number(
                  subscription.vat_rate,
                ) /
                  100),
          );

        const businessRelation =
          Array.isArray(
            subscription.businesses,
          )
            ? subscription.businesses[0]
            : subscription.businesses;

        const businessName =
          businessRelation?.name ??
          "Zisto subscription";

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

        const form =
          new URLSearchParams();

        form.set(
          "mode",
          "subscription",
        );
        form.set(
          "consent_collection[terms_of_service]",
          "required",
        );
        form.set(
          "custom_text[terms_of_service_acceptance][message]",
          `Με την εγγραφή αποδέχεσαι την Πολιτική Πληρωμών & Συνδρομών του Zisto: ${appUrl}/#/payments`,
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
          `${appUrl}/#/dashboard?business=${encodeURIComponent(
            subscription.business_id,
          )}&billing=success&session_id={CHECKOUT_SESSION_ID}`,
        );
        form.set(
          "cancel_url",
          `${appUrl}/#/dashboard?business=${encodeURIComponent(
            subscription.business_id,
          )}&billing=cancelled`,
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
          form.delete(
            "customer_email",
          );
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
              body:
                form.toString(),
            },
          );

        const stripeResult =
          await stripeResponse.json();

        if (!stripeResponse.ok) {
          console.error(
            "Client Stripe checkout creation failed:",
            stripeResult,
          );

          return res.status(502).json({
            error:
              stripeResult?.error?.message ??
              "Could not create Stripe checkout",
          });
        }

        return res.status(200).json({
          checkout_url:
            stripeResult.url,
          checkout_session_id:
            stripeResult.id,
        });
      }

      const stripeSecretKey =
        process.env.STRIPE_SECRET_KEY;

      if (!stripeSecretKey) {
        return res.status(500).json({
          error:
            "Stripe is not configured",
        });
      }

      const stripeBody =
        new URLSearchParams();

      stripeBody.set(
        "cancel_at_period_end",
        action === "cancel_subscription"
          ? "true"
          : "false",
      );

      const stripeResponse =
        await fetch(
          `https://api.stripe.com/v1/subscriptions/${encodeURIComponent(
            subscription
              .stripe_subscription_id,
          )}`,
          {
            method: "POST",
            headers: {
              Authorization:
                `Bearer ${stripeSecretKey}`,
              "Content-Type":
                "application/x-www-form-urlencoded",
            },
            body:
              stripeBody.toString(),
          },
        );

      const stripeResult =
        await stripeResponse.json();

      if (!stripeResponse.ok) {
        console.error(
          "Stripe subscription update failed:",
          stripeResult,
        );

        return res.status(502).json({
          error:
            stripeResult?.error?.message ??
            "Could not update subscription",
        });
      }

      const cancelAtPeriodEnd =
        Boolean(
          stripeResult
            .cancel_at_period_end,
        );

      const updateResponse =
        await supabaseRequest({
          supabaseUrl,
          supabaseSecretKey,
          path:
            `/rest/v1/subscriptions?id=eq.${subscription.id}`,
          method: "PATCH",
          headers: {
            Prefer:
              "return=representation",
          },
          body: {
            cancel_at_period_end:
              cancelAtPeriodEnd,
            cancellation_requested_at:
              cancelAtPeriodEnd
                ? new Date()
                    .toISOString()
                : null,
            updated_at:
              new Date()
                .toISOString(),
          },
        });

      if (!updateResponse.ok) {
        console.error(
          "Subscription state sync failed:",
          await updateResponse.text(),
        );

        return res.status(500).json({
          error:
            "Stripe was updated but Zisto could not sync the subscription",
        });
      }

      const updatedRows =
        await updateResponse.json();

      return res.status(200).json({
        subscription:
          updatedRows[0] ?? null,
      });
    }

    if (
      requestedView === "business-avatar-upload" &&
      req.method === "POST"
    ) {
      if (
        !isAdmin &&
        !["owner", "manager"].includes(
          membership?.role ?? "",
        )
      ) {
        return res.status(403).json({
          error:
            "You cannot upload an image for this business",
        });
      }

      const body = req.body ?? {};

      const contentType =
        typeof body.content_type === "string"
          ? body.content_type
          : "";

      const extensionByType = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
      };

      const extension =
        extensionByType[contentType];

      if (!extension) {
        return res.status(400).json({
          error:
            "Only JPG, PNG and WebP images are supported",
        });
      }

      const randomPart =
        Math.random()
          .toString(36)
          .slice(2, 10);

      const objectPath =
        `${businessId}/avatar-${Date.now()}-${randomPart}.${extension}`;

      const encodedObjectPath =
        objectPath
          .split("/")
          .map(encodeURIComponent)
          .join("/");

      const signedUploadResponse =
        await fetch(
          `${supabaseUrl}/storage/v1/object/upload/sign/business-avatars/${encodedObjectPath}`,
          {
            method: "POST",
            headers: {
              apikey:
                supabaseSecretKey,
              Authorization:
                `Bearer ${supabaseSecretKey}`,
              "Content-Type":
                "application/json",
            },
            body: "{}",
          },
        );

      const signedUploadResult =
        await signedUploadResponse.json();

      if (!signedUploadResponse.ok) {
        console.error(
          "Signed avatar upload URL creation failed:",
          signedUploadResult,
        );

        return res.status(502).json({
          error:
            signedUploadResult?.message ??
            signedUploadResult?.error ??
            "Could not create avatar upload URL",
        });
      }

      const relativeSignedUrl =
        signedUploadResult.url;

      if (
        typeof relativeSignedUrl !==
        "string"
      ) {
        return res.status(502).json({
          error:
            "Supabase did not return an upload token",
        });
      }

      const signedUrl =
        new URL(
          relativeSignedUrl,
          `${supabaseUrl}/storage/v1`,
        );

      const token =
        signedUrl.searchParams.get(
          "token",
        );

      if (!token) {
        return res.status(502).json({
          error:
            "Supabase did not return an upload token",
        });
      }

      return res.status(200).json({
        path: objectPath,
        token,
      });
    }

    if (
      requestedView === "business-profile" &&
      req.method === "PATCH"
    ) {
      if (
        !isAdmin &&
        membership?.role !== "owner"
      ) {
        return res.status(403).json({
          error:
            "Only the business owner can update the business profile",
        });
      }

      const body = req.body ?? {};

      const profileImageUrl =
        typeof body.profile_image_url ===
        "string"
          ? body.profile_image_url
              .trim()
              .slice(0, 2000)
          : null;

      const updateResponse =
        await supabaseRequest({
          supabaseUrl,
          supabaseSecretKey,
          path:
            `/rest/v1/businesses?id=eq.${businessId}`,
          method: "PATCH",
          headers: {
            Prefer:
              "return=representation",
          },
          body: {
            profile_image_url:
              profileImageUrl || null,
          },
        });

      if (!updateResponse.ok) {
        return res.status(500).json({
          error:
            "Could not update business profile",
        });
      }

      const updatedRows =
        await updateResponse.json();

      return res.status(200).json({
        business:
          updatedRows[0] ?? null,
      });
    }

    if (requestedView === "appointments") {
      const start =
        typeof req.query.start === "string"
          ? req.query.start
          : null;

      const end =
        typeof req.query.end === "string"
          ? req.query.end
          : null;

      if (req.method === "GET") {
        const appointmentParams =
          new URLSearchParams({
            business_id: `eq.${businessId}`,
            select: [
              "id",
              "public_token",
              "business_id",
              "service_id",
              "staff_id",
              "customer_name",
              "customer_email",
              "customer_phone",
              "starts_at",
              "ends_at",
              "status",
              "source",
              "notes",
              "created_at",
            ].join(","),
            order: "starts_at.asc",
            limit: "1000",
          });

        if (start) {
          appointmentParams.set(
            "starts_at",
            `gte.${start}`,
          );
        }

        if (end) {
          appointmentParams.append(
            "starts_at",
            `lt.${end}`,
          );
        }

        const serviceParams =
          new URLSearchParams({
            business_id: `eq.${businessId}`,
            select:
              "id,name,duration_minutes,price_cents,currency,is_active,sort_order",
            order: "sort_order.asc",
          });

        const staffParams =
          new URLSearchParams({
            business_id: `eq.${businessId}`,
            select:
              "id,name,email,phone,is_active,sort_order",
            order: "sort_order.asc",
          });

        const [
          appointmentsResponse,
          servicesResponse,
          staffResponse,
        ] = await Promise.all([
          supabaseRequest({
            supabaseUrl,
            supabaseSecretKey,
            path:
              `/rest/v1/appointments?${appointmentParams.toString()}`,
          }),
          supabaseRequest({
            supabaseUrl,
            supabaseSecretKey,
            path:
              `/rest/v1/appointment_services?${serviceParams.toString()}`,
          }),
          supabaseRequest({
            supabaseUrl,
            supabaseSecretKey,
            path:
              `/rest/v1/appointment_staff?${staffParams.toString()}`,
          }),
        ]);

        if (
          !appointmentsResponse.ok ||
          !servicesResponse.ok ||
          !staffResponse.ok
        ) {
          console.error("Appointments loading failed", {
            appointments:
              await appointmentsResponse.text(),
            services:
              await servicesResponse.text(),
            staff:
              await staffResponse.text(),
          });

          return res.status(500).json({
            error:
              "Failed to load appointments",
          });
        }

        return res.status(200).json({
          business_id: businessId,
          appointments:
            await appointmentsResponse.json(),
          services:
            await servicesResponse.json(),
          staff:
            await staffResponse.json(),
        });
      }

      if (req.method === "PATCH") {
        const body = req.body ?? {};
        const appointmentId =
          typeof body.id === "string"
            ? body.id
            : "";

        const action =
          typeof body.action === "string"
            ? body.action
            : "";

        if (
          !appointmentId ||
          action !== "cancel"
        ) {
          return res.status(400).json({
            error:
              "Valid appointment id and cancel action are required",
          });
        }

        const appointmentParams =
          new URLSearchParams({
            id: `eq.${appointmentId}`,
            business_id:
              `eq.${businessId}`,
            select: [
              "id",
              "customer_name",
              "customer_email",
              "starts_at",
              "service_id",
              "status",
            ].join(","),
            limit: "1",
          });

        const businessParams =
          new URLSearchParams({
            id: `eq.${businessId}`,
            select: "id,name,timezone",
            limit: "1",
          });

        const [
          appointmentResponse,
          businessResponse,
        ] = await Promise.all([
          supabaseRequest({
            supabaseUrl,
            supabaseSecretKey,
            path:
              `/rest/v1/appointments?${appointmentParams.toString()}`,
          }),
          supabaseRequest({
            supabaseUrl,
            supabaseSecretKey,
            path:
              `/rest/v1/businesses?${businessParams.toString()}`,
          }),
        ]);

        if (
          !appointmentResponse.ok ||
          !businessResponse.ok
        ) {
          console.error(
            "Appointment cancellation lookup failed",
            {
              appointment:
                await appointmentResponse.text(),
              business:
                await businessResponse.text(),
            },
          );

          return res.status(500).json({
            error:
              "Failed to load appointment",
          });
        }

        const [
          appointmentRows,
          businessRows,
        ] = await Promise.all([
          appointmentResponse.json(),
          businessResponse.json(),
        ]);

        const appointment =
          appointmentRows[0];

        const business =
          businessRows[0];

        if (!appointment || !business) {
          return res.status(404).json({
            error:
              "Appointment not found",
          });
        }

        if (
          appointment.status ===
          "cancelled"
        ) {
          return res.status(409).json({
            error:
              "Appointment is already cancelled",
          });
        }

        let serviceName =
          "Ραντεβού";

        if (appointment.service_id) {
          const serviceParams =
            new URLSearchParams({
              id:
                `eq.${appointment.service_id}`,
              business_id:
                `eq.${businessId}`,
              select: "name",
              limit: "1",
            });

          const serviceResponse =
            await supabaseRequest({
              supabaseUrl,
              supabaseSecretKey,
              path:
                `/rest/v1/appointment_services?${serviceParams.toString()}`,
            });

          if (serviceResponse.ok) {
            const serviceRows =
              await serviceResponse.json();

            serviceName =
              serviceRows[0]?.name ||
              serviceName;
          }
        }

        const updateParams =
          new URLSearchParams({
            id: `eq.${appointmentId}`,
            business_id:
              `eq.${businessId}`,
            select: "*",
          });

        const updateResponse =
          await supabaseRequest({
            supabaseUrl,
            supabaseSecretKey,
            path:
              `/rest/v1/appointments?${updateParams.toString()}`,
            method: "PATCH",
            headers: {
              Prefer: "return=representation",
            },
            body: {
              status: "cancelled",
              updated_at:
                new Date().toISOString(),
            },
          });

        if (!updateResponse.ok) {
          console.error(
            "Appointment cancellation failed:",
            await updateResponse.text(),
          );

          return res.status(500).json({
            error:
              "Failed to cancel appointment",
          });
        }

        const rows =
          await updateResponse.json();

        let emailSent = false;
        let emailError = null;

        if (appointment.customer_email) {
          const resendApiKey =
            process.env.RESEND_API_KEY;

          const fromEmail =
            process.env.ZISTO_FROM_EMAIL ||
            "Zisto <hello@mail.zisto.app>";

          if (!resendApiKey) {
            emailError =
              "Email service is not configured";
          } else {
            const timezone =
              business.timezone ||
              "Europe/Athens";

            const startsAt =
              new Date(
                appointment.starts_at,
              );

            const formattedDate =
              new Intl.DateTimeFormat(
                "el-GR",
                {
                  timeZone: timezone,
                  weekday: "long",
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                },
              ).format(startsAt);

            const formattedTime =
              new Intl.DateTimeFormat(
                "el-GR",
                {
                  timeZone: timezone,
                  hour: "2-digit",
                  minute: "2-digit",
                },
              ).format(startsAt);

            const safeBusinessName =
              String(business.name)
                .replaceAll("&", "&amp;")
                .replaceAll("<", "&lt;")
                .replaceAll(">", "&gt;");

            const safeCustomerName =
              String(
                appointment.customer_name ||
                "",
              )
                .replaceAll("&", "&amp;")
                .replaceAll("<", "&lt;")
                .replaceAll(">", "&gt;");

            const safeServiceName =
              String(serviceName)
                .replaceAll("&", "&amp;")
                .replaceAll("<", "&lt;")
                .replaceAll(">", "&gt;");

            try {
              const emailResponse =
                await fetch(
                  "https://api.resend.com/emails",
                  {
                    method: "POST",
                    headers: {
                      "Content-Type":
                        "application/json",
                      Authorization:
                        `Bearer ${resendApiKey}`,
                    },
                    body: JSON.stringify({
                      from: fromEmail,
                      to: [
                        appointment.customer_email,
                      ],
                      subject:
                        `Ακύρωση ραντεβού — ${business.name}`,
                      html: `
                        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#222;line-height:1.6">
                          <div style="padding:28px 0;border-bottom:3px solid #DC2727">
                            <div style="font-size:12px;font-weight:700;letter-spacing:2px;color:#DC2727">ZISTO APPOINTMENTS</div>
                            <h1 style="font-size:28px;margin:10px 0 0">Το ραντεβού σου ακυρώθηκε.</h1>
                          </div>
                          <div style="padding:28px 0">
                            <p>Γεια σου ${safeCustomerName || "!"}</p>
                            <p>Το <strong>${safeBusinessName}</strong> ακύρωσε το παρακάτω ραντεβού:</p>
                            <div style="margin:24px 0;padding:18px;background:#f6f6f4;border-radius:14px">
                              <div><strong>Υπηρεσία:</strong> ${safeServiceName}</div>
                              <div><strong>Ημερομηνία:</strong> ${formattedDate}</div>
                              <div><strong>Ώρα:</strong> ${formattedTime}</div>
                            </div>
                            <p>Αν θέλεις, μπορείς να επιστρέψεις στο Smart Link της επιχείρησης και να επιλέξεις νέο διαθέσιμο ραντεβού.</p>
                          </div>
                          <div style="padding:18px 0;border-top:1px solid #eee;color:#888;font-size:12px">
                            Εστάλη μέσω Zisto.
                          </div>
                        </div>
                      `,
                    }),
                  },
                );

              if (emailResponse.ok) {
                emailSent = true;
              } else {
                emailError =
                  await emailResponse.text();

                console.error(
                  "Cancellation email failed:",
                  emailError,
                );
              }
            } catch (error) {
              emailError =
                error instanceof Error
                  ? error.message
                  : "Email delivery failed";

              console.error(
                "Cancellation email error:",
                error,
              );
            }
          }
        } else {
          emailError =
            "Customer has no email address";
        }

        return res.status(200).json({
          appointment: rows[0] ?? null,
          email_sent: emailSent,
          email_error:
            emailSent
              ? null
              : emailError,
        });
      }
    }

    /*
     * 4. Queries για business, location
     *    και τα νέα analytics events.
     */
    const businessQuery =
      new URLSearchParams({
        id: `eq.${businessId}`,

        select:
          "id,name,slug,timezone,dashboard_modules,status,profile_image_url",

        limit: "1",
      });

    const locationQuery =
      new URLSearchParams({
        business_id:
          `eq.${businessId}`,

        select: "name",

        order: "created_at.asc",

        limit: "1",
      });

    const eventsQuery =
      new URLSearchParams({
        business_id:
          `eq.${businessId}`,

        select: [
          "event_type",
          "session_id",
          "visitor_id",
          "metadata",
          "created_at",
        ].join(","),

        order: "created_at.desc",

        limit: "10000",
      });

    const [
      businessResponse,
      locationResponse,
      eventsResponse,
    ] = await Promise.all([
      supabaseRequest({
        supabaseUrl,
        supabaseSecretKey,

        path:
          `/rest/v1/businesses?${businessQuery.toString()}`,
      }),

      supabaseRequest({
        supabaseUrl,
        supabaseSecretKey,

        path:
          `/rest/v1/locations?${locationQuery.toString()}`,
      }),

      supabaseRequest({
        supabaseUrl,
        supabaseSecretKey,

        path:
          `/rest/v1/analytics_events?${eventsQuery.toString()}`,
      }),
    ]);

    if (
      !businessResponse.ok ||
      !locationResponse.ok ||
      !eventsResponse.ok
    ) {
      const businessError =
        await businessResponse.text();

      const locationError =
        await locationResponse.text();

      const eventsError =
        await eventsResponse.text();

      console.error(
        "Analytics data query failed",
        {
          business: businessError,
          location: locationError,
          events: eventsError,
        },
      );

      return res.status(500).json({
        error:
          "Failed to load analytics",
      });
    }

    const [
      businesses,
      locations,
      rawEvents,
    ] = await Promise.all([
      businessResponse.json(),
      locationResponse.json(),
      eventsResponse.json(),
    ]);

    const business =
      businesses[0];

    if (!business) {
      return res.status(404).json({
        error: "Business not found",
      });
    }

    const subscriptionQuery =
      new URLSearchParams({
        business_id:
          `eq.${businessId}`,
        select:
          "id,billing_email,amount_cents,currency,vat_rate,billing_interval_months,billing_status,access_status,starts_at,next_billing_at,payment_due_at,grace_until,last_paid_at,notes,stripe_customer_id,stripe_subscription_id,cancel_at_period_end,cancellation_requested_at",
        limit: "1",
      });

    const subscriptionResponse =
      await supabaseRequest({
        supabaseUrl,
        supabaseSecretKey,
        path:
          `/rest/v1/subscriptions?${subscriptionQuery.toString()}`,
      });

    let subscriptionState = null;

    if (subscriptionResponse.ok) {
      const subscriptionRows =
        await subscriptionResponse.json();

      subscriptionState =
        subscriptionRows[0] ?? null;
    }


    let appointmentAnalytics = null;
    let appointmentRowsForAnalytics = [];

    const enabledDashboardModules =
      Array.isArray(business.dashboard_modules)
        ? business.dashboard_modules
        : ["analytics", "reviews", "menu", "nfc"];

    if (
      enabledDashboardModules.includes(
        "appointments",
      )
    ) {
      const appointmentAnalyticsQuery =
        new URLSearchParams({
          business_id:
            `eq.${businessId}`,
          select:
            "starts_at,status,created_at",
          order: "starts_at.asc",
          limit: "10000",
        });

      const appointmentAnalyticsResponse =
        await supabaseRequest({
          supabaseUrl,
          supabaseSecretKey,
          path:
            `/rest/v1/appointments?${appointmentAnalyticsQuery.toString()}`,
        });

      if (!appointmentAnalyticsResponse.ok) {
        console.error(
          "Appointment analytics query failed",
          await appointmentAnalyticsResponse.text(),
        );
      } else {
        const appointmentRows =
          await appointmentAnalyticsResponse.json();

        appointmentRowsForAnalytics =
          appointmentRows;

        const analyticsNow = new Date();
        const analyticsTodayStart =
          getStartOfToday(analyticsNow);
        const analyticsTomorrow =
          new Date(analyticsTodayStart);
        analyticsTomorrow.setDate(
          analyticsTomorrow.getDate() + 1,
        );

        const analyticsWeekStart =
          getStartOfWeek(analyticsNow);
        const analyticsNextWeek =
          new Date(analyticsWeekStart);
        analyticsNextWeek.setDate(
          analyticsNextWeek.getDate() + 7,
        );

        const analyticsMonthStart =
          getStartOfMonth(analyticsNow);
        const analyticsNextMonth =
          new Date(analyticsMonthStart);
        analyticsNextMonth.setMonth(
          analyticsNextMonth.getMonth() + 1,
        );

        const upcomingSevenDaysEnd =
          new Date(analyticsNow);
        upcomingSevenDaysEnd.setDate(
          upcomingSevenDaysEnd.getDate() + 7,
        );

        const confirmedAppointments =
          appointmentRows.filter(
            (appointment) =>
              appointment.status !==
              "cancelled",
          );

        const inRange = (
          appointment,
          start,
          end,
        ) => {
          const startsAt =
            new Date(appointment.starts_at);

          return (
            startsAt >= start &&
            startsAt < end
          );
        };

        const hourCounts =
          confirmedAppointments.reduce(
            (accumulator, appointment) => {
              const startsAt =
                new Date(
                  appointment.starts_at,
                );

              if (startsAt < analyticsNow) {
                return accumulator;
              }

              const hour =
                startsAt.getHours();

              accumulator[hour] =
                (accumulator[hour] || 0) +
                1;

              return accumulator;
            },
            {},
          );

        const busiestHourEntry =
          Object.entries(hourCounts)
            .sort(
              (a, b) =>
                Number(b[1]) -
                Number(a[1]),
            )[0] ?? null;

        appointmentAnalytics = {
          today:
            confirmedAppointments.filter(
              (appointment) =>
                inRange(
                  appointment,
                  analyticsTodayStart,
                  analyticsTomorrow,
                ),
            ).length,
          week:
            confirmedAppointments.filter(
              (appointment) =>
                inRange(
                  appointment,
                  analyticsWeekStart,
                  analyticsNextWeek,
                ),
            ).length,
          month:
            confirmedAppointments.filter(
              (appointment) =>
                inRange(
                  appointment,
                  analyticsMonthStart,
                  analyticsNextMonth,
                ),
            ).length,
          cancelled_month:
            appointmentRows.filter(
              (appointment) =>
                appointment.status ===
                  "cancelled" &&
                inRange(
                  appointment,
                  analyticsMonthStart,
                  analyticsNextMonth,
                ),
            ).length,
          upcoming_7_days:
            confirmedAppointments.filter(
              (appointment) => {
                const startsAt =
                  new Date(
                    appointment.starts_at,
                  );

                return (
                  startsAt >= analyticsNow &&
                  startsAt <
                    upcomingSevenDaysEnd
                );
              },
            ).length,
          busiest_hour:
            busiestHourEntry
              ? Number(
                  busiestHourEntry[0],
                )
              : null,
        };
      }
    }

    if (
      subscriptionState?.billing_status ===
        "draft" &&
      !subscriptionState
        ?.stripe_subscription_id
    ) {
      return res.status(402).json({
        error:
          membership?.role === "owner"
            ? "subscription_setup_required"
            : "subscription_pending_owner_activation",
        message:
          membership?.role === "owner"
            ? "Η συνδρομή χρειάζεται ενεργοποίηση πριν ανοίξει το dashboard."
            : "Η συνδρομή της επιχείρησης δεν έχει ενεργοποιηθεί ακόμη από τον ιδιοκτήτη.",
        membership_role:
          membership?.role ?? null,
        subscription:
          subscriptionState,
        business: {
          id: business.id,
          name: business.name,
          dashboard_modules:
            business.dashboard_modules ?? [],
        },
      });
    }

    if (
      subscriptionState?.access_status ===
      "suspended"
    ) {
      const isCancelled =
        subscriptionState.billing_status ===
        "cancelled";

      return res.status(402).json({
        error: isCancelled
          ? "subscription_cancelled"
          : "subscription_suspended",
        message: isCancelled
          ? "Η συνδρομή σας έχει ακυρωθεί."
          : "Η συνδρομή σας έχει τεθεί προσωρινά σε παύση λόγω εκκρεμούς πληρωμής.",
        billing_status:
          subscriptionState.billing_status,
        access_status:
          subscriptionState.access_status,
        grace_until:
          subscriptionState.grace_until,
      });
    }

    /*
     * Μετατροπή του νέου schema στο format
     * που ήδη περιμένει το React dashboard.
     */
    const events =
      rawEvents.map(normalizeEvent);

    const now = new Date();

    const startOfToday =
      getStartOfToday(now);

    const startOfWeek =
      getStartOfWeek(now);

    const startOfMonth =
      getStartOfMonth(now);

    const todayEvents =
      events.filter(
        (event) =>
          new Date(event.created_at) >=
          startOfToday,
      );

    const weekEvents =
      events.filter(
        (event) =>
          new Date(event.created_at) >=
          startOfWeek,
      );

    const monthEvents =
      events.filter(
        (event) =>
          new Date(event.created_at) >=
          startOfMonth,
      );

    const pageViewsToday =
      countEvent(
        todayEvents,
        "page_view",
      );

    const menuOpensToday =
      countEvent(
        todayEvents,
        "menu_open",
      );

    const reviewClicksToday =
      countEvent(
        todayEvents,
        "review_click",
      );

    const reviewConversionRate =
      pageViewsToday > 0
        ? Number(
            (
              (
                reviewClicksToday /
                pageViewsToday
              ) * 100
            ).toFixed(1),
          )
        : 0;

    const menuConversionRate =
      pageViewsToday > 0
        ? Number(
            (
              (
                menuOpensToday /
                pageViewsToday
              ) * 100
            ).toFixed(1),
          )
        : 0;

    /*
     * Οι πηγές υπολογίζονται μόνο από page views.
     * Έτσι ένα menu click δεν μετράει ξανά
     * σαν δεύτερη επίσκεψη NFC.
     */
    const pageViewEvents =
      events.filter(
        (event) =>
          event.event_name ===
          "page_view",
      );

    const sourceCounts =
      pageViewEvents.reduce(
        (accumulator, event) => {
          const source =
            event.source || "unknown";

          accumulator[source] =
            (accumulator[source] || 0) +
            1;

          return accumulator;
        },
        {},
      );

    /*
     * Δραστηριότητα τελευταίων 7 ημερών.
     */
    const dailyActivity = [];

    for (
      let offset = 6;
      offset >= 0;
      offset -= 1
    ) {
      const day = new Date(now);

      day.setDate(
        now.getDate() - offset,
      );

      day.setHours(0, 0, 0, 0);

      const nextDay =
        new Date(day);

      nextDay.setDate(
        day.getDate() + 1,
      );

      const dayEvents =
        events.filter((event) => {
          const createdAt =
            new Date(event.created_at);

          return (
            createdAt >= day &&
            createdAt < nextDay
          );
        });

      dailyActivity.push({
        date:
          day
            .toISOString()
            .slice(0, 10),

        page_views:
          countEvent(
            dayEvents,
            "page_view",
          ),

        menu_opens:
          countEvent(
            dayEvents,
            "menu_open",
          ),

        review_clicks:
          countEvent(
            dayEvents,
            "review_click",
          ),
      });
    }

    if (
      appointmentAnalytics &&
      appointmentRowsForAnalytics.length > 0
    ) {
      appointmentAnalytics.daily_activity =
        dailyActivity.map((item) => ({
          date: item.date,
          count:
            appointmentRowsForAnalytics.filter(
              (appointment) =>
                appointment.status !==
                  "cancelled" &&
                dateKeyInTimeZone(
                  appointment.starts_at,
                  business.timezone ||
                    "Europe/Athens",
                ) === item.date,
            ).length,
        }));
    } else if (appointmentAnalytics) {
      appointmentAnalytics.daily_activity =
        dailyActivity.map((item) => ({
          date: item.date,
          count: 0,
        }));
    }

    return res.status(200).json({
      business_id: businessId,

      membership_role: isAdmin
        ? "owner"
        : membership.role,

      business: {
        name: business.name,

        location_name:
          locations[0]?.name ?? null,

        dashboard_modules:
          enabledDashboardModules,

        profile_image_url:
          business.profile_image_url ?? null,
      },

      subscription:
        subscriptionState ?? null,

      totals: {
        page_views_today:
          pageViewsToday,

        page_views_week:
          countEvent(
            weekEvents,
            "page_view",
          ),

        page_views_month:
          countEvent(
            monthEvents,
            "page_view",
          ),

        unique_visitors_today:
          getUniqueVisitorCount(
            todayEvents,
          ),

        unique_visitors_week:
          getUniqueVisitorCount(
            weekEvents,
          ),

        unique_visitors_month:
          getUniqueVisitorCount(
            monthEvents,
          ),

        menu_opens_today:
          menuOpensToday,

        review_clicks_today:
          reviewClicksToday,

        menu_conversion_rate:
          menuConversionRate,

        review_conversion_rate:
          reviewConversionRate,
      },

      sources: {
        nfc:
          sourceCounts.nfc || 0,

        qr:
          sourceCounts.qr || 0,

        direct:
          sourceCounts.direct || 0,

        unknown:
          sourceCounts.unknown || 0,
      },

      daily_activity:
        dailyActivity,

      recent_activity:
        events.slice(0, 10),

      appointments:
        appointmentAnalytics,
    });
  } catch (error) {
    console.error(
      "Analytics API error:",
      error,
    );

    return res.status(500).json({
      error: "Internal server error",
    });
  }
}

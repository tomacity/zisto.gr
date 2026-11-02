import type { SupabaseClient } from "@supabase/supabase-js";
import QRCode from "qrcode";

const NOVUS_SANDBOX =
  "https://provider-dev.timologisi.online";
const NOVUS_PRODUCTION =
  "https://provider.timologisi.online";
const NOVUS_PROVIDER_NAME =
  "Novus Conceptus";
const NOVUS_PROVIDER_WEBSITE =
  "https://timologisi.online";
const NOVUS_LICENSE =
  "2020_11_105Novus Conceptus _001_ timologisi.online_V1_181120";

function cents(value: number | null | undefined) {
  return Math.round(Number(value ?? 0)) / 100;
}

function greekDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: "Europe/Athens",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    },
  ).formatToParts(date);

  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}:${get("second")}`,
  };
}

function vatCategory(rate: number) {
  const normalized = Number(rate);

  if (normalized === 24) return 1;
  if (normalized === 13) return 2;
  if (normalized === 6) return 3;

  throw new Error(
    `Unsupported VAT rate for automatic provider issuance: ${normalized}%`,
  );
}

function nonEmpty(value: unknown) {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : null;
}

function providerBaseUrl() {
  const explicit =
    nonEmpty(process.env.ZISTO_EINVOICE_BASE_URL);

  if (explicit) return explicit.replace(/\/$/, "");

  return process.env.ZISTO_EINVOICE_MODE === "production"
    ? NOVUS_PRODUCTION
    : NOVUS_SANDBOX;
}

function providerApiKey() {
  return nonEmpty(process.env.ZISTO_EINVOICE_API_KEY);
}

function providerEnabled() {
  return (
    (process.env.ZISTO_EINVOICE_PROVIDER ?? "novus") === "novus" &&
    Boolean(providerApiKey())
  );
}

function buildAddressLine(
  street: string | null | undefined,
  number: string | null | undefined,
) {
  return [street, number].filter(Boolean).join(" ").trim();
}

async function issueNovusDocument({
  document,
  issuer,
  customer,
  businessName,
  series,
  aa,
  now,
}: {
  document: any;
  issuer: any;
  customer: any;
  businessName: string;
  series: string;
  aa: string;
  now: Date;
}) {
  const apiKey = providerApiKey();

  if (!apiKey) {
    throw new Error("Missing ZISTO_EINVOICE_API_KEY");
  }

  const issue = greekDateParts(now);
  const vatRate = Number(
    document.subscription_vat_rate ??
      document.metadata?.vat_rate ??
      24,
  );
  const vatCode = vatCategory(vatRate);
  const net = cents(document.subtotal_cents);
  const vat = cents(document.vat_cents);
  const gross = cents(document.total_cents);
  const isBusiness =
    (customer?.customer_type ?? "business") === "business";

  if (!issuer?.tax_id) {
    throw new Error("Issuer VAT number is missing");
  }

  if (
    !issuer?.legal_name ||
    !issuer?.tax_office ||
    !issuer?.activity ||
    !issuer?.address_line1 ||
    !issuer?.postal_code ||
    !issuer?.city
  ) {
    throw new Error(
      "Issuer legal profile is incomplete for fiscal issuance",
    );
  }

  if (
    isBusiness &&
    !customer?.tax_id
  ) {
    throw new Error(
      "Customer VAT number is required for a B2B service invoice",
    );
  }

  const invoiceType =
    isBusiness ? "2.1" : "11.2";

  const classificationType =
    isBusiness
      ? "E3_561_001"
      : "E3_561_003";

  const classificationCategory =
    "category1_3";

  const incomeClassification = [
    {
      classificationType,
      classificationCategory,
      amount: net,
    },
  ];

  const payload: any = {
    invoice: [
      {
        issuer: {
          vatNumber: issuer.tax_id,
          country: issuer.tax_country || "GR",
          branch: 0,
        },
        ...(isBusiness
          ? {
              counterpart: {
                vatNumber: customer.tax_id,
                country: customer.tax_country || "GR",
                branch: 0,
              },
            }
          : {}),
        invoiceHeader: {
          series,
          aa,
          issueDate: issue.date,
          invoiceType,
          currency: document.currency || "EUR",
        },
        paymentMethods: [
          {
            type: 7,
            amount: gross,
          },
        ],
        invoiceDetails: [
          {
            lineNumber: 1,
            lineCode: "ZISTO-SUB",
            quantity: 1,
            measurementUnitLabel: "ΥΠΗΡ.",
            lineUnitPrice: net,
            totalNetPriceBeforeDiscount: net,
            totalDiscountValue: 0,
            netValue: net,
            vatCategory: vatCode,
            vatCategoryPercent: vatRate,
            vatAmount: vat,
            lineDescription:
              `Συνδρομητική υπηρεσία Zisto — ${businessName}`,
            incomeClassification,
          },
        ],
        invoiceSummary: {
          totalNetValue: net,
          totalVatAmount: vat,
          totalWithheldAmount: 0,
          totalFeesAmount: 0,
          totalStampDutyAmount: 0,
          totalOtherTaxesAmount: 0,
          totalDeductionsAmount: 0,
          totalGrossValue: gross,
          incomeClassification,
        },
        providerAdditionalInvoiceDetails: {
          issuer: {
            name:
              issuer.legal_name ||
              issuer.trade_name ||
              "Zisto",
            profession: issuer.activity,
            taxoffice: issuer.tax_office,
            addressStreet: issuer.address_line1,
            addressNumber: issuer.address_number || "",
            addressPostalCode: issuer.postal_code,
            addressCity: issuer.city,
            addressCountry: "Ελλάδα",
            ...(issuer.phone
              ? { phone: issuer.phone }
              : {}),
            ...(issuer.email
              ? { email: issuer.email }
              : {}),
            ...(issuer.website
              ? { webSite: issuer.website }
              : {}),
            ...(issuer.registry_number
              ? { registryNumber: issuer.registry_number }
              : {}),
          },
          ...(isBusiness
            ? {
                counterpart: {
                  name:
                    customer.legal_name ||
                    customer.trade_name ||
                    businessName,
                  profession:
                    customer.activity || "",
                  taxoffice:
                    customer.tax_office || "",
                  addressStreet:
                    customer.address_line1 || "",
                  addressNumber:
                    customer.address_number || "",
                  addressPostalCode:
                    customer.postal_code || "",
                  addressCity:
                    customer.city || "",
                  addressCountry:
                    customer.country_code === "GR"
                      ? "Ελλάδα"
                      : customer.country_code || "",
                  ...(customer.phone
                    ? { phone: customer.phone }
                    : {}),
                  ...(customer.invoice_email
                    ? { email: customer.invoice_email }
                    : {}),
                },
              }
            : {}),
          additionalDetails: {
            documentLabel:
              isBusiness
                ? "Τιμολόγιο Παροχής Υπηρεσιών"
                : "Απόδειξη Παροχής Υπηρεσιών",
            documentLanguageCode: "EL",
            documentSizeCode: 0,
            paymentMethodInvoiceLabel:
              "Κάρτα / ηλεκτρονική πληρωμή",
            documentComments:
              "Εξοφλημένο μέσω Stripe.",
            ...(customer?.invoice_email
              ? {
                  recipients: {
                    email: customer.invoice_email,
                  },
                }
              : {}),
          },
        },
      },
    ],
  };

  const response = await fetch(
    `${providerBaseUrl()}/api/v1/Provider/SendInvoices?skipSignature=true`,
    {
      method: "POST",
      headers: {
        "API-KEY": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(65000),
    },
  );

  const raw = await response.text();

  let parsed: any = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }

  if (!response.ok) {
    const error = new Error(
      `Novus HTTP ${response.status}: ${raw.slice(0, 1200)}`,
    ) as Error & { ambiguous?: boolean };

    error.ambiguous =
      response.status >= 500;

    throw error;
  }

  const result =
    parsed?.response?.[0];

  if (!result) {
    throw new Error(
      "Novus returned an empty document response",
    );
  }

  if (
    result.statusCode !== "Success" &&
    result.statusCode !== "Offline"
  ) {
    throw new Error(
      `Novus ${result.statusCode}: ${JSON.stringify(
        result.errors ?? [],
      ).slice(0, 1600)}`,
    );
  }

  const qrTarget =
    result.qrUrl ||
    result.invoiceUrl ||
    result.aadeQrUrl ||
    "";

  const qrImage =
    qrTarget
      ? await QRCode.toDataURL(qrTarget, {
          margin: 1,
          width: 320,
        })
      : null;

  return {
    payload,
    result,
    issue,
    qrTarget,
    qrImage,
  };
}

export async function issuePendingFiscalDocuments({
  supabaseAdmin,
  now = new Date(),
  limit = 5,
}: {
  supabaseAdmin: SupabaseClient;
  now?: Date;
  limit?: number;
}) {
  if (!providerEnabled()) {
    return {
      enabled: false,
      checked: 0,
      issued: 0,
      failed: 0,
      unknown: 0,
    };
  }

  const {
    data: issuer,
    error: issuerError,
  } = await supabaseAdmin
    .from("billing_issuer_profile")
    .select(
      "legal_name,trade_name,tax_id,tax_country,tax_office,activity,address_line1,address_line2,address_number,city,region,postal_code,country_code,phone,email,website,registry_number,invoice_provider,provider_account_id,provider_series,live_billing_enabled",
    )
    .eq("id", 1)
    .maybeSingle();

  if (issuerError) {
    throw new Error(
      `Could not load billing issuer profile: ${issuerError.message}`,
    );
  }

  if (
    !issuer?.live_billing_enabled ||
    issuer.invoice_provider !== "licensed_provider" ||
    !issuer.tax_id
  ) {
    return {
      enabled: false,
      checked: 0,
      issued: 0,
      failed: 0,
      unknown: 0,
    };
  }

  const {
    data: documents,
    error: documentsError,
  } = await supabaseAdmin
    .from("billing_documents")
    .select(
      "id,business_id,subscription_id,status,currency,subtotal_cents,vat_cents,total_cents,provider_series,provider_aa,provider_attempts,metadata,paid_at,created_at,businesses(name),subscriptions(vat_rate)",
    )
    .eq("status", "paid")
    .in("fiscal_status", [
      "pending",
      "failed",
    ])
    .lt("provider_attempts", 5)
    .order("paid_at", {
      ascending: true,
      nullsFirst: false,
    })
    .limit(limit);

  if (documentsError) {
    throw new Error(
      `Could not load fiscal queue: ${documentsError.message}`,
    );
  }

  let issued = 0;
  let failed = 0;
  let unknown = 0;

  for (const document of documents ?? []) {
    const {
      data: customer,
      error: customerError,
    } = await supabaseAdmin
      .from("billing_profiles")
      .select(
        "customer_type,legal_name,trade_name,tax_id,tax_country,tax_office,activity,invoice_email,address_line1,address_line2,address_number,city,region,postal_code,country_code,phone",
      )
      .eq("business_id", document.business_id)
      .maybeSingle();

    if (customerError) {
      console.error(
        "Fiscal customer profile load failed:",
        customerError,
      );
      continue;
    }

    const businessRelation =
      Array.isArray((document as any).businesses)
        ? (document as any).businesses[0]
        : (document as any).businesses;

    const subscriptionRelation =
      Array.isArray((document as any).subscriptions)
        ? (document as any).subscriptions[0]
        : (document as any).subscriptions;

    const businessName =
      businessRelation?.name || "Zisto πελάτης";

    const {
      data: reservation,
      error: reservationError,
    } = await supabaseAdmin.rpc(
      "reserve_billing_invoice_number",
      {
        p_document_id: document.id,
        p_series:
          issuer.provider_series || "Z",
      },
    );

    if (reservationError) {
      console.error(
        "Fiscal number reservation failed:",
        reservationError,
      );
      continue;
    }

    const reserved =
      Array.isArray(reservation)
        ? reservation[0]
        : reservation;

    const series =
      String(
        reserved?.series ??
          document.provider_series ??
          issuer.provider_series ??
          "Z",
      );

    const aa =
      String(
        reserved?.aa ??
          document.provider_aa,
      );

    await supabaseAdmin
      .from("billing_documents")
      .update({
        fiscal_status: "issuing",
        provider_last_attempt_at:
          now.toISOString(),
        provider_attempts:
          Number(document.provider_attempts ?? 0) + 1,
        updated_at:
          now.toISOString(),
      })
      .eq("id", document.id);

    try {
      const richDocument = {
        ...document,
        subscription_vat_rate:
          Number(
            subscriptionRelation?.vat_rate ??
              document.metadata?.vat_rate ??
              24,
          ),
      };

      const issuance =
        await issueNovusDocument({
          document: richDocument,
          issuer,
          customer,
          businessName,
          series,
          aa,
          now,
        });

      const result =
        issuance.result;

      const offline =
        result.statusCode === "Offline";

      const metadata = {
        ...(document.metadata ?? {}),
        fiscal_provider: "novus",
        provider_status_code:
          result.statusCode,
        provider_auth_string:
          result.authenticationCode || null,
        provider_qr_url:
          issuance.qrTarget || null,
        provider_qr_image_url:
          issuance.qrImage || null,
        provider_aade_qr_url:
          result.aadeQrUrl || null,
        provider_website:
          NOVUS_PROVIDER_WEBSITE,
        provider_software_license:
          NOVUS_LICENSE,
        provider_issue_time:
          issuance.issue.time,
        provider_request:
          issuance.payload,
        provider_response:
          result,
      };

      const {
        error: updateError,
      } = await supabaseAdmin
        .from("billing_documents")
        .update({
          source: "licensed_provider",
          fiscal_status:
            offline ? "offline" : "issued",
          document_number:
            `${series}-${aa}`,
          provider_name:
            NOVUS_PROVIDER_NAME,
          provider_document_id:
            result.invoiceUid || null,
          provider_mark:
            result.invoiceMark
              ? String(result.invoiceMark)
              : null,
          provider_uid:
            result.invoiceUid || null,
          hosted_url:
            result.invoiceUrl || null,
          pdf_url:
            result.invoiceUrl || null,
          issued_at:
            now.toISOString(),
          provider_last_error:
            null,
          metadata,
          updated_at:
            now.toISOString(),
        })
        .eq("id", document.id);

      if (updateError) {
        throw updateError;
      }

      issued += 1;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : String(error);

      const ambiguous =
        Boolean(
          (error as any)?.ambiguous,
        );

      await supabaseAdmin
        .from("billing_documents")
        .update({
          fiscal_status:
            ambiguous
              ? "unknown"
              : "failed",
          provider_last_error:
            message.slice(0, 4000),
          updated_at:
            new Date().toISOString(),
        })
        .eq("id", document.id);

      if (ambiguous) {
        unknown += 1;
      } else {
        failed += 1;
      }

      console.error(
        "Fiscal issuance failed:",
        document.id,
        message,
      );
    }
  }

  return {
    enabled: true,
    checked:
      documents?.length ?? 0,
    issued,
    failed,
    unknown,
  };
}

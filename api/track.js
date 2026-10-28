import { createClient } from "@supabase/supabase-js";

const ALLOWED_EVENT_TYPES = new Set([
  "page_view",
  "nfc_tap",
  "qr_scan",
  "button_click",
  "menu_open",
  "review_open",
]);

function cleanText(value, maxLength = 500) {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value.trim();

  if (!cleaned) {
    return null;
  }

  return cleaned.slice(0, maxLength);
}

function cleanMetadata(value) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return {};
  }

  const serialized = JSON.stringify(value);

  // Αποφεύγουμε υπερβολικά μεγάλα payloads.
  if (serialized.length > 5000) {
    return {};
  }

  return value;
}

function getPagePath(pageUrl, suppliedPath) {
  const cleanPath = cleanText(suppliedPath, 500);

  if (cleanPath) {
    return cleanPath;
  }

  try {
    return new URL(pageUrl).pathname;
  } catch {
    return null;
  }
}

function cleanList(value, maxItems = 12) {
  return Array.isArray(value)
    ? value
        .filter((item) => typeof item === "string")
        .map((item) => item.trim().slice(0, 120))
        .filter(Boolean)
        .slice(0, maxItems)
    : [];
}

function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[char] ?? char,
  );
}

function leadChips(items) {
  return items
    .map(
      (item) =>
        `<span style="display:inline-block;margin:4px 6px 4px 0;padding:8px 12px;border-radius:999px;background:#f4f4f2;font-size:13px;font-weight:700;color:#222;">${escapeHtml(item)}</span>`,
    )
    .join("");
}

async function handleLead(body, response) {
  const { RESEND_API_KEY } = process.env;

  if (!RESEND_API_KEY) {
    console.error("Missing RESEND_API_KEY for lead form");
    return response.status(500).json({
      error: "Η φόρμα δεν είναι διαθέσιμη αυτή τη στιγμή.",
    });
  }

  // Honeypot: αληθινοί επισκέπτες δεν συμπληρώνουν αυτό το πεδίο.
  if (cleanText(body.website, 200)) {
    return response.status(200).json({ success: true });
  }

  const lead = {
    businessType: cleanText(body.businessType, 120) ?? "",
    goals: cleanList(body.goals),
    placements: cleanList(body.placements),
    quantity: cleanText(body.quantity, 120) ?? "",
    tracking: cleanText(body.tracking, 180) ?? "",
    customization: cleanText(body.customization, 180) ?? "",
    fullName: cleanText(body.fullName, 120) ?? "",
    businessName: cleanText(body.businessName, 160) ?? "",
    email: (cleanText(body.email, 180) ?? "").toLowerCase(),
    phone: cleanText(body.phone, 80) ?? "",
    notes: cleanText(body.notes, 1200) ?? "",
  };

  if (
    !lead.businessType ||
    lead.goals.length === 0 ||
    lead.placements.length === 0 ||
    !lead.quantity ||
    !lead.tracking ||
    !lead.customization ||
    !lead.fullName ||
    !lead.businessName ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)
  ) {
    return response.status(400).json({
      error: "Λείπουν απαραίτητα στοιχεία.",
    });
  }

  const internalHtml = `
    <div style="font-family:Arial,sans-serif;background:#f4f4f2;padding:36px 16px;color:#222;">
      <div style="max-width:680px;margin:0 auto;background:#fff;border-radius:24px;padding:36px;">
        <img src="https://zisto.app/images/zisto-wordmark.png" alt="Zisto" width="120" style="display:block;width:120px;height:auto;" />
        <p style="margin:28px 0 8px;font-size:12px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:#DC2727;">Νέο Zisto lead</p>
        <h1 style="margin:0;font-size:36px;line-height:1.05;">${escapeHtml(lead.businessName)}</h1>
        <p style="margin:12px 0 28px;color:#666;font-size:16px;">${escapeHtml(lead.fullName)} · ${escapeHtml(lead.email)}${lead.phone ? ` · ${escapeHtml(lead.phone)}` : ""}</p>
        <p><strong>Κατηγορία:</strong> ${escapeHtml(lead.businessType)}</p>
        <p><strong>Κάρτες:</strong> ${escapeHtml(lead.quantity)}</p>
        <p><strong>Tracking:</strong> ${escapeHtml(lead.tracking)}</p>
        <p><strong>Customization:</strong> ${escapeHtml(lead.customization)}</p>
        <div style="margin-top:20px;"><strong>Στόχοι</strong><div>${leadChips(lead.goals)}</div></div>
        <div style="margin-top:20px;"><strong>Τοποθέτηση</strong><div>${leadChips(lead.placements)}</div></div>
        <div style="margin-top:22px;padding:18px;border-radius:16px;background:#f7f5f1;">
          <strong>Σημείωση</strong>
          <p style="white-space:pre-wrap;line-height:1.65;color:#444;">${escapeHtml(lead.notes || "—")}</p>
        </div>
      </div>
    </div>
  `;

  const customerHtml = `
    <div style="font-family:Arial,sans-serif;background:#f4f4f2;padding:36px 16px;color:#222;">
      <div style="max-width:620px;margin:0 auto;background:#fff;border-radius:24px;padding:36px;">
        <img src="https://zisto.app/images/zisto-wordmark.png" alt="Zisto" width="120" style="display:block;width:120px;height:auto;" />
        <p style="margin:28px 0 8px;font-size:12px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:#DC2727;">Η πρότασή σου</p>
        <h1 style="margin:0;font-size:38px;line-height:1.05;">Το Zisto που σου ταιριάζει.</h1>
        <p style="margin:20px 0 0;color:#666;line-height:1.7;">Γεια σου ${escapeHtml(lead.fullName)}, λάβαμε το setup για το <strong>${escapeHtml(lead.businessName)}</strong>.</p>
        <p style="margin:22px 0 0;font-size:20px;font-weight:800;line-height:1.45;">Θα επικοινωνήσουμε μαζί σου για να το ζήσουμε μαζί!</p>
      </div>
    </div>
  `;

  try {
    const internalResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Zisto <hello@mail.zisto.app>",
        to: ["zisto.gr@gmail.com"],
        reply_to: lead.email,
        subject: `Νέο Zisto lead — ${lead.businessName}`,
        html: internalHtml,
      }),
    });

    const internalResult = await internalResponse.json();

    if (!internalResponse.ok) {
      console.error("Lead notification email failed:", internalResult);
      return response.status(502).json({
        error: "Δεν ήταν δυνατή η αποστολή της πρότασης.",
      });
    }

    const customerResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Zisto <hello@mail.zisto.app>",
        to: [lead.email],
        reply_to: "zisto.gr@gmail.com",
        subject: `Το Zisto για το ${lead.businessName}`,
        html: customerHtml,
      }),
    });

    if (!customerResponse.ok) {
      console.error(
        "Lead confirmation email failed:",
        await customerResponse.json(),
      );
    }

    return response.status(201).json({
      success: true,
      emailId: internalResult.id ?? null,
    });
  } catch (error) {
    console.error("Lead form error:", error);
    return response.status(500).json({
      error: "Κάτι πήγε στραβά. Δοκίμασε ξανά σε λίγο.",
    });
  }
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  /*
   * Το endpoint καλείται από ανεξάρτητα custom domains,
   * επομένως πρέπει να επιτρέπει cross-origin requests.
   */
  response.setHeader(
    "Access-Control-Allow-Origin",
    "*",
  );

  response.setHeader(
    "Access-Control-Allow-Methods",
    "POST, OPTIONS",
  );

  response.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type",
  );

  if (request.method === "OPTIONS") {
    return response.status(204).end();
  }

  if (request.method !== "POST") {
    return response.status(405).json({
      error: "Method not allowed",
    });
  }

  const incomingBody = request.body ?? {};

  if (incomingBody.action === "lead") {
    return handleLead(incomingBody, response);
  }

  const supabaseUrl =
    process.env.SUPABASE_URL;

  const supabaseSecretKey =
    process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseSecretKey) {
    return response.status(500).json({
      error: "Missing server configuration",
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

  try {
    const body = incomingBody;

    const projectKey =
      cleanText(body.project_key, 100);

    const eventType =
      cleanText(body.event_type, 50) ??
      "page_view";

    const sessionId =
      cleanText(body.session_id, 150);

    const visitorId =
      cleanText(body.visitor_id, 150);

    const pageUrl =
      cleanText(body.page_url, 1500);

    if (!projectKey) {
      return response.status(400).json({
        error: "project_key is required",
      });
    }

    if (!sessionId) {
      return response.status(400).json({
        error: "session_id is required",
      });
    }

    if (!ALLOWED_EVENT_TYPES.has(eventType)) {
      return response.status(400).json({
        error: "Invalid event_type",
      });
    }

    /*
     * Βρίσκουμε το project αποκλειστικά από το project_key.
     * Το frontend δεν επιλέγει μόνο του business_id/project_id.
     */
    const {
      data: project,
      error: projectError,
    } = await supabaseAdmin
      .from("connected_projects")
      .select(`
        id,
        business_id,
        status,
        live_url
      `)
      .eq("project_key", projectKey)
      .maybeSingle();

    if (projectError) {
      console.error(
        "Tracking project lookup failed:",
        projectError,
      );

      return response.status(500).json({
        error: "Could not verify project",
      });
    }

    if (!project) {
      return response.status(404).json({
        error: "Connected project not found",
      });
    }

    if (project.status !== "active") {
      return response.status(403).json({
        error: "Connected project is inactive",
      });
    }

    const country =
      cleanText(
        request.headers["x-vercel-ip-country"],
        100,
      ) ??
      cleanText(body.country, 100);

    const city =
      cleanText(
        request.headers["x-vercel-ip-city"],
        150,
      ) ??
      cleanText(body.city, 150);

    const pagePath = getPagePath(
      pageUrl,
      body.page_path,
    );

    const metadata =
      cleanMetadata(body.metadata);
    
    const cardToken =
      cleanText(
        metadata.card_token,
        100,
      );
    
    let resolvedCardId = null;
    
    if (cardToken) {
      const {
        data: card,
        error: cardError,
      } = await supabaseAdmin
        .from("cards")
        .select(`
          id,
          landing_page_id,
          is_active
        `)
        .eq("public_token", cardToken)
        .maybeSingle();
    
      if (cardError) {
        console.error(
          "Card lookup failed:",
          cardError,
        );
    
        return response.status(500).json({
          error: "Could not verify card",
        });
      }
    
      if (!card) {
        return response.status(404).json({
          error: "NFC card not found",
        });
      }
    
      if (!card.is_active) {
        return response.status(403).json({
          error: "NFC card is inactive",
        });
      }
    
      resolvedCardId = card.id;
    }

    const eventRecord = {
      project_id: project.id,
      business_id: project.business_id,
      event_type: eventType,
      card_id: resolvedCardId,

      session_id: sessionId,
      visitor_id: visitorId,

      page_url: pageUrl,
      page_path: pagePath,

      referrer: cleanText(
        body.referrer,
        1500,
      ),

      device_type: cleanText(
        body.device_type,
        50,
      ),

      browser: cleanText(
        body.browser,
        100,
      ),

      operating_system: cleanText(
        body.operating_system,
        100,
      ),

      country,
      city,

      utm_source: cleanText(
        body.utm_source,
        200,
      ),

      utm_medium: cleanText(
        body.utm_medium,
        200,
      ),

      utm_campaign: cleanText(
        body.utm_campaign,
        200,
      ),

      utm_content: cleanText(
        body.utm_content,
        200,
      ),

      utm_term: cleanText(
        body.utm_term,
        200,
      ),

      metadata,
    };

    const {
      data: analyticsEvent,
      error: insertError,
    } = await supabaseAdmin
      .from("analytics_events")
      .insert(eventRecord)
      .select("id, event_type, created_at")
      .single();

    if (insertError) {
      console.error(
        "Analytics event insert failed:",
        insertError,
      );

      return response.status(500).json({
        error: "Could not record analytics event",
      });
    }

    return response.status(201).json({
      success: true,
      event: analyticsEvent,
    });
  } catch (error) {
    console.error("Tracking API error:", error);

    return response.status(500).json({
      error: "Unexpected tracking error",
    });
  }
}

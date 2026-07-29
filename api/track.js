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
    const body = request.body ?? {};

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

    const eventRecord = {
      project_id: project.id,
      business_id: project.business_id,
      event_type: eventType,

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

      metadata: cleanMetadata(
        body.metadata,
      ),
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

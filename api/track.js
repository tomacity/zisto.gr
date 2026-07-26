const ALLOWED_EVENTS = new Set([
  "page_view",
  "menu_open",
  "review_click",
  "wifi_open",
  "social_open",
]);

const ALLOWED_SOURCES = new Set([
  "nfc",
  "qr",
  "direct",
  "unknown",
]);

const ALLOWED_ORIGINS = new Set([
  "https://tomacity.github.io",
]);

export default async function handler(req, res) {
  const origin = req.headers.origin;

  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  try {
    const {
      business_id,
      location_id = null,
      landing_page_id,
      card_id = null,
      event_name,
      session_id = null,
      source = "direct",
      metadata = {},
    } = req.body ?? {};

    if (!business_id || !landing_page_id || !event_name) {
      return res.status(400).json({
        error:
          "business_id, landing_page_id and event_name are required",
      });
    }

    if (!ALLOWED_EVENTS.has(event_name)) {
      return res.status(400).json({
        error: "Invalid event_name",
      });
    }

    if (!ALLOWED_SOURCES.has(source)) {
      return res.status(400).json({
        error: "Invalid source",
      });
    }

    if (
      metadata === null ||
      Array.isArray(metadata) ||
      typeof metadata !== "object"
    ) {
      return res.status(400).json({
        error: "metadata must be an object",
      });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

    if (!supabaseUrl || !supabaseSecretKey) {
      console.error("Missing Supabase environment variables");

      return res.status(500).json({
        error: "Server configuration error",
      });
    }

    const supabaseResponse = await fetch(
      `${supabaseUrl}/rest/v1/events`,
      {
        method: "POST",
        headers: {
          apikey: supabaseSecretKey,
          Authorization: `Bearer ${supabaseSecretKey}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          business_id,
          location_id,
          landing_page_id,
          card_id,
          event_name,
          session_id,
          source,
          metadata,
        }),
      }
    );

    if (!supabaseResponse.ok) {
      const errorText = await supabaseResponse.text();

      console.error("Supabase insert failed:", errorText);

      return res.status(500).json({
        error: "Failed to save event",
      });
    }

    return res.status(201).json({
      success: true,
    });
  } catch (error) {
    console.error("Tracking API error:", error);

    return res.status(500).json({
      error: "Internal server error",
    });
  }
}

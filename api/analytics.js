const ALLOWED_ORIGINS = new Set([
  "https://zistogr.vercel.app",
]);

function setCorsHeaders(req, res) {
  const origin = req.headers.origin;

  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");
}

export default async function handler(req, res) {
  setCorsHeaders(req, res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseSecretKey) {
    return res.status(500).json({
      error: "Server configuration error",
    });
  }

  const businessId = req.query.business_id;

  if (!businessId) {
    return res.status(400).json({
      error: "business_id is required",
    });
  }

  try {
    const query = new URLSearchParams({
      business_id: `eq.${businessId}`,
      select: "event_name,source,session_id,metadata,created_at",
      order: "created_at.desc",
      limit: "10000",
    });

    const supabaseResponse = await fetch(
      `${supabaseUrl}/rest/v1/events?${query.toString()}`,
      {
        method: "GET",
        headers: {
          apikey: supabaseSecretKey,
          "Content-Type": "application/json",
        },
      }
    );

    if (!supabaseResponse.ok) {
      const errorText = await supabaseResponse.text();

      console.error("Supabase analytics query failed:", errorText);

      return res.status(500).json({
        error: "Failed to load analytics",
      });
    }

    const events = await supabaseResponse.json();

    const now = new Date();

    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 6);
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      1
    );

    const todayEvents = events.filter(
      (event) => new Date(event.created_at) >= startOfToday
    );

    const weekEvents = events.filter(
      (event) => new Date(event.created_at) >= startOfWeek
    );

    const monthEvents = events.filter(
      (event) => new Date(event.created_at) >= startOfMonth
    );

    const countEvent = (list, eventName) =>
      list.filter((event) => event.event_name === eventName).length;

    const uniqueSessions = (list) =>
      new Set(
        list
          .map((event) => event.session_id)
          .filter(Boolean)
      ).size;

    const pageViewsToday = countEvent(todayEvents, "page_view");
    const menuOpensToday = countEvent(todayEvents, "menu_open");
    const reviewClicksToday = countEvent(todayEvents, "review_click");

    const reviewConversionRate =
      pageViewsToday > 0
        ? Number(
            ((reviewClicksToday / pageViewsToday) * 100).toFixed(1)
          )
        : 0;

    const menuConversionRate =
      pageViewsToday > 0
        ? Number(
            ((menuOpensToday / pageViewsToday) * 100).toFixed(1)
          )
        : 0;

    const sourceCounts = events.reduce((accumulator, event) => {
      const source = event.source || "unknown";

      accumulator[source] =
        (accumulator[source] || 0) + 1;

      return accumulator;
    }, {});

    const dailyActivity = [];

    for (let offset = 6; offset >= 0; offset -= 1) {
      const day = new Date(now);
      day.setDate(now.getDate() - offset);
      day.setHours(0, 0, 0, 0);

      const nextDay = new Date(day);
      nextDay.setDate(day.getDate() + 1);

      const dayEvents = events.filter((event) => {
        const createdAt = new Date(event.created_at);

        return createdAt >= day && createdAt < nextDay;
      });

      dailyActivity.push({
        date: day.toISOString().slice(0, 10),
        page_views: countEvent(dayEvents, "page_view"),
        menu_opens: countEvent(dayEvents, "menu_open"),
        review_clicks: countEvent(dayEvents, "review_click"),
      });
    }

    return res.status(200).json({
      business_id: businessId,

      totals: {
        page_views_today: pageViewsToday,
        page_views_week: countEvent(weekEvents, "page_view"),
        page_views_month: countEvent(monthEvents, "page_view"),

        unique_visitors_today: uniqueSessions(todayEvents),
        unique_visitors_week: uniqueSessions(weekEvents),
        unique_visitors_month: uniqueSessions(monthEvents),

        menu_opens_today: menuOpensToday,
        review_clicks_today: reviewClicksToday,

        menu_conversion_rate: menuConversionRate,
        review_conversion_rate: reviewConversionRate,
      },

      sources: {
        nfc: sourceCounts.nfc || 0,
        qr: sourceCounts.qr || 0,
        direct: sourceCounts.direct || 0,
        unknown: sourceCounts.unknown || 0,
      },

      daily_activity: dailyActivity,

      recent_activity: events.slice(0, 10),
    });
  } catch (error) {
    console.error("Analytics API error:", error);

    return res.status(500).json({
      error: "Internal server error",
    });
  }
}

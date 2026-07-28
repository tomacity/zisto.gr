const ALLOWED_ORIGINS = new Set([
  "https://zistogr.vercel.app",
  "https://zisto.app",
  "https://www.zisto.app",
]);

function setCorsHeaders(req, res) {
  const origin = req.headers.origin;

  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization",
  );
  res.setHeader("Cache-Control", "no-store");
}

async function supabaseRequest({
  supabaseUrl,
  supabaseSecretKey,
  path,
  method = "GET",
  headers = {},
}) {
  return fetch(`${supabaseUrl}${path}`, {
    method,
    headers: {
      apikey: supabaseSecretKey,
      Authorization: `Bearer ${supabaseSecretKey}`,
      "Content-Type": "application/json",
      ...headers,
    },
  });
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

  const authorization = req.headers.authorization ?? "";

  const accessToken = authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : null;

  const requestedBusinessId =
    typeof req.query.business_id === "string"
      ? req.query.business_id
      : null;

  if (!accessToken) {
    return res.status(401).json({
      error: "Authentication required",
    });
  }

  try {
    const userResponse = await supabaseRequest({
      supabaseUrl,
      supabaseSecretKey,
      path: "/auth/v1/user",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!userResponse.ok) {
      return res.status(401).json({
        error: "Invalid or expired session",
      });
    }

    const user = await userResponse.json();

    const adminQuery = new URLSearchParams({
      user_id: `eq.${user.id}`,
      select: "user_id",
      limit: "1",
    });

    const adminResponse = await supabaseRequest({
      supabaseUrl,
      supabaseSecretKey,
      path: `/rest/v1/zisto_admins?${adminQuery.toString()}`,
    });

    if (!adminResponse.ok) {
      const errorText = await adminResponse.text();

      console.error("Admin query failed:", errorText);

      return res.status(500).json({
        error: "Failed to verify admin",
      });
    }

    const admins = await adminResponse.json();
    const isAdmin = admins.length > 0;

    const membershipQuery = new URLSearchParams({
      user_id: `eq.${user.id}`,
      select: "business_id,role",
      limit: "1",
    });

    const membershipResponse = await supabaseRequest({
      supabaseUrl,
      supabaseSecretKey,
      path: `/rest/v1/business_members?${membershipQuery.toString()}`,
    });

    if (!membershipResponse.ok) {
      const errorText = await membershipResponse.text();

      console.error("Membership query failed:", errorText);

      return res.status(500).json({
        error: "Failed to load membership",
      });
    }

    const memberships = await membershipResponse.json();
    const membership = memberships[0] ?? null;

    let businessId;

    if (isAdmin && requestedBusinessId) {
      businessId = requestedBusinessId;
    } else {
      if (!membership) {
        return res.status(403).json({
          error: "This user is not assigned to a business",
        });
      }

      businessId = membership.business_id;
    }

    const businessQuery = new URLSearchParams({
      id: `eq.${businessId}`,
      select: "id,name,slug,timezone",
      limit: "1",
    });

    const locationQuery = new URLSearchParams({
      business_id: `eq.${businessId}`,
      select: "name",
      order: "created_at.asc",
      limit: "1",
    });

    const eventsQuery = new URLSearchParams({
      business_id: `eq.${businessId}`,
      select:
        "event_name,source,session_id,metadata,created_at",
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
        path: `/rest/v1/businesses?${businessQuery.toString()}`,
      }),
      supabaseRequest({
        supabaseUrl,
        supabaseSecretKey,
        path: `/rest/v1/locations?${locationQuery.toString()}`,
      }),
      supabaseRequest({
        supabaseUrl,
        supabaseSecretKey,
        path: `/rest/v1/events?${eventsQuery.toString()}`,
      }),
    ]);

    if (
      !businessResponse.ok ||
      !locationResponse.ok ||
      !eventsResponse.ok
    ) {
      console.error("Analytics data query failed", {
        business: await businessResponse.text(),
        location: await locationResponse.text(),
        events: await eventsResponse.text(),
      });

      return res.status(500).json({
        error: "Failed to load analytics",
      });
    }

    const [businesses, locations, events] =
      await Promise.all([
        businessResponse.json(),
        locationResponse.json(),
        eventsResponse.json(),
      ]);

    const business = businesses[0];

    if (!business) {
      return res.status(404).json({
        error: "Business not found",
      });
    }

    const now = new Date();

    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 6);
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      1,
    );

    const todayEvents = events.filter(
      (event) => new Date(event.created_at) >= startOfToday,
    );

    const weekEvents = events.filter(
      (event) => new Date(event.created_at) >= startOfWeek,
    );

    const monthEvents = events.filter(
      (event) => new Date(event.created_at) >= startOfMonth,
    );

    const countEvent = (list, eventName) =>
      list.filter(
        (event) => event.event_name === eventName,
      ).length;

    const uniqueSessions = (list) =>
      new Set(
        list
          .map((event) => event.session_id)
          .filter(Boolean),
      ).size;

    const pageViewsToday = countEvent(
      todayEvents,
      "page_view",
    );

    const menuOpensToday = countEvent(
      todayEvents,
      "menu_open",
    );

    const reviewClicksToday = countEvent(
      todayEvents,
      "review_click",
    );

    const reviewConversionRate =
      pageViewsToday > 0
        ? Number(
            (
              (reviewClicksToday / pageViewsToday) *
              100
            ).toFixed(1),
          )
        : 0;

    const menuConversionRate =
      pageViewsToday > 0
        ? Number(
            (
              (menuOpensToday / pageViewsToday) *
              100
            ).toFixed(1),
          )
        : 0;

    const sourceCounts = events.reduce(
      (accumulator, event) => {
        const source = event.source || "unknown";

        accumulator[source] =
          (accumulator[source] || 0) + 1;

        return accumulator;
      },
      {},
    );

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

        page_views: countEvent(
          dayEvents,
          "page_view",
        ),

        menu_opens: countEvent(
          dayEvents,
          "menu_open",
        ),

        review_clicks: countEvent(
          dayEvents,
          "review_click",
        ),
      });
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
      },

      totals: {
        page_views_today: pageViewsToday,

        page_views_week: countEvent(
          weekEvents,
          "page_view",
        ),

        page_views_month: countEvent(
          monthEvents,
          "page_view",
        ),

        unique_visitors_today:
          uniqueSessions(todayEvents),

        unique_visitors_week:
          uniqueSessions(weekEvents),

        unique_visitors_month:
          uniqueSessions(monthEvents),

        menu_opens_today: menuOpensToday,

        review_clicks_today:
          reviewClicksToday,

        menu_conversion_rate:
          menuConversionRate,

        review_conversion_rate:
          reviewConversionRate,
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

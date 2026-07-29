const ALLOWED_ORIGINS = new Set([
  "https://zistogr.vercel.app",
  "https://zisto.app",
  "https://www.zisto.app",
]);

function setCorsHeaders(req, res) {
  const origin = req.headers.origin;

  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader(
      "Access-Control-Allow-Origin",
      origin,
    );
  }

  res.setHeader("Vary", "Origin");

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, OPTIONS",
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

      Authorization:
        `Bearer ${supabaseSecretKey}`,

      "Content-Type": "application/json",

      ...headers,
    },
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

export default async function handler(
  req,
  res,
) {
  setCorsHeaders(req, res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "GET") {
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

    /*
     * 4. Queries για business, location
     *    και τα νέα analytics events.
     */
    const businessQuery =
      new URLSearchParams({
        id: `eq.${businessId}`,

        select:
          "id,name,slug,timezone",

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

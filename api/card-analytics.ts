const ALLOWED_ORIGINS = new Set([
  "https://zistogr.vercel.app",
  "https://zisto.app",
  "https://www.zisto.app",
  "https://zisto.gr",
  "https://www.zisto.gr",
]);

const ATHENS_TIME_ZONE = "Europe/Athens";

type AnalyticsPeriod =
  | "today"
  | "7d"
  | "30d"
  | "year"
  | "all";

function setCorsHeaders(req: any, res: any) {
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
    "no-store",
  );
}

async function supabaseRequest({
  supabaseUrl,
  supabaseSecretKey,
  path,
  method = "GET",
  headers = {},
  body,
}: {
  supabaseUrl: string;
  supabaseSecretKey: string;
  path: string;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
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
      body !== undefined
        ? JSON.stringify(body)
        : undefined,
  });
}

function getAthensParts(date: Date) {
  const parts =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone: ATHENS_TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
      },
    ).formatToParts(date);

  const values = Object.fromEntries(
    parts
      .filter(
        (part) =>
          part.type !== "literal",
      )
      .map((part) => [
        part.type,
        part.value,
      ]),
  );

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

function getAthensDateKey(date: Date) {
  const parts = getAthensParts(date);

  return [
    parts.year,
    String(parts.month).padStart(2, "0"),
    String(parts.day).padStart(2, "0"),
  ].join("-");
}

function shiftDateKey(
  dateKey: string,
  days: number,
) {
  const [year, month, day] =
    dateKey.split("-").map(Number);

  const shifted = new Date(
    Date.UTC(
      year,
      month - 1,
      day + days,
    ),
  );

  return [
    shifted.getUTCFullYear(),
    String(
      shifted.getUTCMonth() + 1,
    ).padStart(2, "0"),
    String(
      shifted.getUTCDate(),
    ).padStart(2, "0"),
  ].join("-");
}

function athensMidnightToUtc(
  dateKey: string,
) {
  const [year, month, day] =
    dateKey.split("-").map(Number);

  const targetLocalTime = Date.UTC(
    year,
    month - 1,
    day,
    0,
    0,
    0,
  );

  let guess = targetLocalTime;

  for (let index = 0; index < 3; index += 1) {
    const parts =
      getAthensParts(
        new Date(guess),
      );

    const representedLocalTime =
      Date.UTC(
        parts.year,
        parts.month - 1,
        parts.day,
        parts.hour,
        parts.minute,
        parts.second,
      );

    guess +=
      targetLocalTime -
      representedLocalTime;
  }

  return new Date(guess).toISOString();
}

function getPeriodStartDateKey(
  period: AnalyticsPeriod,
  todayKey: string,
) {
  if (period === "today") {
    return todayKey;
  }

  if (period === "7d") {
    return shiftDateKey(
      todayKey,
      -6,
    );
  }

  if (period === "30d") {
    return shiftDateKey(
      todayKey,
      -29,
    );
  }

  if (period === "year") {
    return `${todayKey.slice(0, 4)}-01-01`;
  }

  return null;
}

function createDateRange(
  startKey: string,
  endKey: string,
) {
  const result: string[] = [];

  let current = startKey;

  while (current <= endKey) {
    result.push(current);

    current =
      shiftDateKey(
        current,
        1,
      );
  }

  return result;
}

export default async function handler(
  req: any,
  res: any,
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

  if (
    !supabaseUrl ||
    !supabaseSecretKey
  ) {
    return res.status(500).json({
      error:
        "Server configuration error",
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

  if (!accessToken) {
    return res.status(401).json({
      error:
        "Authentication required",
    });
  }

  const cardId =
    typeof req.query.card_id ===
    "string"
      ? req.query.card_id
      : null;

  if (!cardId) {
    return res.status(400).json({
      error: "Λείπει το card_id",
    });
  }

  const requestedBusinessId =
    typeof req.query.business_id ===
    "string"
      ? req.query.business_id
      : null;

  const requestedPeriod =
    typeof req.query.period === "string"
      ? req.query.period
      : "7d";

  const allowedPeriods =
    new Set<AnalyticsPeriod>([
      "today",
      "7d",
      "30d",
      "year",
      "all",
    ]);

  const period: AnalyticsPeriod =
    allowedPeriods.has(
      requestedPeriod as AnalyticsPeriod,
    )
      ? (
          requestedPeriod as AnalyticsPeriod
        )
      : "today";

  try {
    /*
     * Επιβεβαίωση χρήστη
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

    const user =
      await userResponse.json();

    /*
     * Έλεγχος admin
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
      return res.status(500).json({
        error:
          "Failed to verify admin",
      });
    }

    const admins =
      await adminResponse.json();

    const isAdmin =
      admins.length > 0;

    /*
     * Membership
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
      return res.status(500).json({
        error:
          "Failed to load membership",
      });
    }

    const memberships =
      await membershipResponse.json();

    const membership =
      memberships[0] ?? null;

    let businessId: string;

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
     * Locations
     */
    const locationsQuery =
      new URLSearchParams({
        business_id:
          `eq.${businessId}`,
        select: "id",
      });

    const locationsResponse =
      await supabaseRequest({
        supabaseUrl,
        supabaseSecretKey,
        path:
          `/rest/v1/locations?${locationsQuery.toString()}`,
      });

    if (!locationsResponse.ok) {
      return res.status(500).json({
        error:
          "Failed to load locations",
      });
    }

    const locations =
      await locationsResponse.json();

    const locationIds =
      locations.map(
        (location: { id: string }) =>
          location.id,
      );

    if (
      locationIds.length === 0
    ) {
      return res.status(404).json({
        error:
          "Δεν βρέθηκε η επιχείρηση.",
      });
    }

    /*
     * Landing pages
     */
    const landingPagesQuery =
      new URLSearchParams({
        location_id:
          `in.(${locationIds.join(",")})`,
        select: "id",
      });

    const landingPagesResponse =
      await supabaseRequest({
        supabaseUrl,
        supabaseSecretKey,
        path:
          `/rest/v1/landing_pages?${landingPagesQuery.toString()}`,
      });

    if (!landingPagesResponse.ok) {
      return res.status(500).json({
        error:
          "Failed to load landing pages",
      });
    }

    const landingPages =
      await landingPagesResponse.json();

    const landingPageIds =
      landingPages.map(
        (page: { id: string }) =>
          page.id,
      );

    if (
      landingPageIds.length === 0
    ) {
      return res.status(404).json({
        error:
          "Δεν βρέθηκε landing page.",
      });
    }

    /*
     * Επιβεβαίωση ότι το τραπέζι
     * ανήκει στη συγκεκριμένη επιχείρηση
     */
    const cardQuery =
      new URLSearchParams({
        id: `eq.${cardId}`,
        landing_page_id:
          `in.(${landingPageIds.join(",")})`,
        select: [
          "id",
          "name",
          "is_active",
          "public_token",
          "created_at",
        ].join(","),
        limit: "1",
      });

    const cardResponse =
      await supabaseRequest({
        supabaseUrl,
        supabaseSecretKey,
        path:
          `/rest/v1/cards?${cardQuery.toString()}`,
      });

    if (!cardResponse.ok) {
      return res.status(500).json({
        error:
          "Failed to load card",
      });
    }

    const cards =
      await cardResponse.json();

    const card =
      cards[0] ?? null;

    if (!card) {
      return res.status(404).json({
        error:
          "Το τραπέζι δεν βρέθηκε.",
      });
    }

    /*
     * Χρονική περίοδος
     */
    const now = new Date();

    const todayKey =
      getAthensDateKey(now);

    const startDateKey =
      getPeriodStartDateKey(
        period,
        todayKey,
      );

    const startIso =
      startDateKey
        ? athensMidnightToUtc(
            startDateKey,
          )
        : null;

    /*
     * Φόρτωση ΟΛΩΝ των events
     * του συγκεκριμένου τραπεζιού.
     *
     * Γίνεται pagination ανά 1000
     * ώστε να μη χαθεί ιστορικό.
     */
    const analyticsEvents: any[] =
      [];

    const pageSize = 1000;

    let offset = 0;

    while (true) {
      const eventsQuery =
        new URLSearchParams({
          business_id:
            `eq.${businessId}`,

          or: [
            "(",
            `card_id.eq.${card.id},`,
            `metadata->>card_token.eq.${card.public_token}`,
            ")",
          ].join(""),

          select: [
            "event_type",
            "card_id",
            "visitor_id",
            "session_id",
            "metadata",
            "created_at",
          ].join(","),

          order: "created_at.asc",

          limit:
            String(pageSize),

          offset:
            String(offset),
        });

      if (startIso) {
        eventsQuery.set(
          "created_at",
          `gte.${startIso}`,
        );
      }

      const eventsResponse =
        await supabaseRequest({
          supabaseUrl,
          supabaseSecretKey,
          path:
            `/rest/v1/analytics_events?${eventsQuery.toString()}`,
        });

      if (!eventsResponse.ok) {
        const errorText =
          await eventsResponse.text();

        console.error(
          "Card analytics query failed:",
          errorText,
        );

        return res.status(500).json({
          error:
            "Failed to load card analytics",
        });
      }

      const pageEvents =
        await eventsResponse.json();

      analyticsEvents.push(
        ...pageEvents,
      );

      if (
        pageEvents.length <
        pageSize
      ) {
        break;
      }

      offset += pageSize;
    }

    /*
     * Event categories
     */
    const tapTypes =
      new Set([
        "page_view",
      ]);

    const menuTypes =
      new Set([
        "menu_open",
        "menu_click",
      ]);

    const reviewTypes =
      new Set([
        "review_open",
        "review_click",
      ]);

    /*
     * Συνολικά metrics
     */
    const tapEvents =
      analyticsEvents.filter(
        (event) =>
          tapTypes.has(
            event.event_type,
          ),
      );

    const menuEvents =
      analyticsEvents.filter(
        (event) =>
          menuTypes.has(
            event.event_type,
          ),
      );

    const reviewEvents =
      analyticsEvents.filter(
        (event) =>
          reviewTypes.has(
            event.event_type,
          ),
      );

    const uniqueVisitors =
      new Set(
        tapEvents
          .map(
            (event) =>
              event.visitor_id ||
              event.session_id,
          )
          .filter(Boolean),
      ).size;

    /*
     * Analytics ανά ημέρα
     */
    const dailyMap =
      new Map<
        string,
        {
          date: string;
          taps: number;
          menu_opens: number;
          review_clicks: number;
          visitors: Set<string>;
        }
      >();

    for (
      const event of
      analyticsEvents
    ) {
      const dateKey =
        getAthensDateKey(
          new Date(
            event.created_at,
          ),
        );

      if (
        !dailyMap.has(dateKey)
      ) {
        dailyMap.set(
          dateKey,
          {
            date: dateKey,
            taps: 0,
            menu_opens: 0,
            review_clicks: 0,
            visitors:
              new Set<string>(),
          },
        );
      }

      const day =
        dailyMap.get(
          dateKey,
        )!;

      if (
        tapTypes.has(
          event.event_type,
        )
      ) {
        day.taps += 1;

        const visitor =
          event.visitor_id ||
          event.session_id;

        if (visitor) {
          day.visitors.add(
            visitor,
          );
        }
      }

      if (
        menuTypes.has(
          event.event_type,
        )
      ) {
        day.menu_opens += 1;
      }

      if (
        reviewTypes.has(
          event.event_type,
        )
      ) {
        day.review_clicks += 1;
      }
    }

    /*
     * Γεμίζουμε και τις ημέρες
     * που είχαν μηδενική κίνηση.
     */
    let rangeStartKey =
      startDateKey;

    if (
      period === "all"
    ) {
      rangeStartKey =
        analyticsEvents.length > 0
          ? getAthensDateKey(
              new Date(
                analyticsEvents[0]
                  .created_at,
              ),
            )
          : todayKey;
    }

    const dateKeys =
      createDateRange(
        rangeStartKey ??
          todayKey,
        todayKey,
      );

    const dailyActivity =
      dateKeys.map(
        (dateKey) => {
          const day =
            dailyMap.get(
              dateKey,
            );

          return {
            date: dateKey,

            taps:
              day?.taps ?? 0,

            menu_opens:
              day?.menu_opens ?? 0,

            review_clicks:
              day?.review_clicks ??
              0,

            unique_visitors:
              day?.visitors.size ??
              0,
          };
        },
      );

    const lastUsedAt =
      analyticsEvents.length > 0
        ? analyticsEvents[
            analyticsEvents.length -
              1
          ].created_at
        : null;

    const recentActivity =
      [...analyticsEvents]
        .reverse()
        .slice(0, 50)
        .map((event) => ({
          event_type:
            event.event_type,

          created_at:
            event.created_at,

          visitor_id:
            event.visitor_id,

          session_id:
            event.session_id,

          metadata:
            event.metadata ?? {},
        }));

    return res.status(200).json({
      business_id:
        businessId,

      card: {
        id: card.id,
        name: card.name,
        is_active:
          card.is_active,
        public_token:
          card.public_token,
      },

      period,

      range: {
        start:
          rangeStartKey,
        end:
          todayKey,
      },

      totals: {
        taps:
          tapEvents.length,

        menu_opens:
          menuEvents.length,

        review_clicks:
          reviewEvents.length,

        unique_visitors:
          uniqueVisitors,
      },

      daily_activity:
        dailyActivity,

      recent_activity:
        recentActivity,

      last_used_at:
        lastUsedAt,
    });
  } catch (error) {
    console.error(
      "Card analytics API error:",
      error,
    );

    return res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : String(error),
    });
  }
}

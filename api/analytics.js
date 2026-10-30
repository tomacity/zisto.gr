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
    req.method !== "PATCH"
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
          "id,name,slug,timezone,dashboard_modules",

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

    const appointmentsAnalyticsQuery =
      new URLSearchParams({
        business_id:
          `eq.${businessId}`,

        select: [
          "starts_at",
          "status",
          "created_at",
          "updated_at",
        ].join(","),

        order: "created_at.desc",

        limit: "10000",
      });

    const [
      businessResponse,
      locationResponse,
      eventsResponse,
      appointmentsAnalyticsResponse,
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

      supabaseRequest({
        supabaseUrl,
        supabaseSecretKey,

        path:
          `/rest/v1/appointments?${appointmentsAnalyticsQuery.toString()}`,
      }),
    ]);

    if (
      !businessResponse.ok ||
      !locationResponse.ok ||
      !eventsResponse.ok ||
      !appointmentsAnalyticsResponse.ok
    ) {
      const businessError =
        await businessResponse.text();

      const locationError =
        await locationResponse.text();

      const eventsError =
        await eventsResponse.text();

      const appointmentsError =
        await appointmentsAnalyticsResponse.text();

      console.error(
        "Analytics data query failed",
        {
          business: businessError,
          location: locationError,
          events: eventsError,
          appointments:
            appointmentsError,
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
      analyticsAppointments,
    ] = await Promise.all([
      businessResponse.json(),
      locationResponse.json(),
      eventsResponse.json(),
      appointmentsAnalyticsResponse.json(),
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

    const activeAppointments =
      analyticsAppointments.filter(
        (appointment) =>
          appointment.status !==
          "cancelled",
      );

    const appointmentStartsToday =
      activeAppointments.filter(
        (appointment) => {
          const startsAt =
            new Date(
              appointment.starts_at,
            );

          return (
            startsAt >= startOfToday &&
            startsAt <
              new Date(
                startOfToday.getTime() +
                  24 * 60 * 60 * 1000,
              )
          );
        },
      );

    const appointmentStartsWeek =
      activeAppointments.filter(
        (appointment) =>
          new Date(
            appointment.starts_at,
          ) >= startOfWeek,
      );

    const appointmentStartsMonth =
      activeAppointments.filter(
        (appointment) =>
          new Date(
            appointment.starts_at,
          ) >= startOfMonth,
      );

    const bookingsCreatedToday =
      analyticsAppointments.filter(
        (appointment) =>
          new Date(
            appointment.created_at,
          ) >= startOfToday,
      );

    const cancelledThisMonth =
      analyticsAppointments.filter(
        (appointment) =>
          appointment.status ===
            "cancelled" &&
          new Date(
            appointment.updated_at ||
              appointment.created_at,
          ) >= startOfMonth,
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

    const bookingConversionRate =
      pageViewsToday > 0
        ? Number(
            (
              (
                bookingsCreatedToday.length /
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

      const nextDayAppointments =
        new Date(nextDay);

      const dayAppointments =
        activeAppointments.filter(
          (appointment) => {
            const startsAt =
              new Date(
                appointment.starts_at,
              );

            return (
              startsAt >= day &&
              startsAt <
                nextDayAppointments
            );
          },
        );

      const dayCancelledAppointments =
        analyticsAppointments.filter(
          (appointment) => {
            if (
              appointment.status !==
              "cancelled"
            ) {
              return false;
            }

            const updatedAt =
              new Date(
                appointment.updated_at ||
                  appointment.created_at,
              );

            return (
              updatedAt >= day &&
              updatedAt <
                nextDayAppointments
            );
          },
        );

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

        appointments:
          dayAppointments.length,

        cancelled_appointments:
          dayCancelledAppointments.length,
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

        dashboard_modules:
          Array.isArray(business.dashboard_modules)
            ? business.dashboard_modules
            : ["analytics", "reviews", "menu", "nfc"],
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

        appointments_today:
          appointmentStartsToday.length,

        appointments_week:
          appointmentStartsWeek.length,

        appointments_month:
          appointmentStartsMonth.length,

        appointments_cancelled_month:
          cancelledThisMonth.length,

        bookings_created_today:
          bookingsCreatedToday.length,

        booking_conversion_rate:
          bookingConversionRate,
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

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


async function resolveBookingProject(
  supabaseAdmin,
  {
    projectKey,
    liveUrl,
  },
) {
  let query =
    supabaseAdmin
      .from("connected_projects")
      .select(`
        id,
        business_id,
        status,
        live_url,
        businesses (
          id,
          name,
          timezone,
          dashboard_modules
        )
      `);

  if (projectKey) {
    query = query.eq(
      "project_key",
      projectKey,
    );
  } else if (liveUrl) {
    query = query.eq(
      "live_url",
      liveUrl,
    );
  } else {
    return null;
  }

  const { data: project, error } =
    await query.maybeSingle();

  if (error) {
    throw error;
  }

  if (!project || project.status !== "active") {
    return null;
  }

  const business = project.businesses;

  if (
    !business ||
    !Array.isArray(business.dashboard_modules) ||
    !business.dashboard_modules.includes(
      "appointments",
    )
  ) {
    return null;
  }

  return {
    project,
    business,
  };
}

function getZonedDayAndMinutes(
  date,
  timeZone,
) {
  const formatter =
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });

  const parts =
    formatter.formatToParts(date);

  const weekday =
    parts.find(
      (part) => part.type === "weekday",
    )?.value ?? "Sun";

  const hour = Number(
    parts.find(
      (part) => part.type === "hour",
    )?.value ?? 0,
  );

  const minute = Number(
    parts.find(
      (part) => part.type === "minute",
    )?.value ?? 0,
  );

  const dayMap = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return {
    weekday: dayMap[weekday] ?? 0,
    minutes: hour * 60 + minute,
  };
}

function timeStringToMinutes(value) {
  if (typeof value !== "string") {
    return null;
  }

  const [hours, minutes] =
    value.split(":").map(Number);

  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes)
  ) {
    return null;
  }

  return hours * 60 + minutes;
}

function getRequestIp(request) {
  const forwarded =
    cleanText(
      request.headers["x-forwarded-for"],
      300,
    );

  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  return (
    cleanText(
      request.headers["x-real-ip"],
      120,
    ) ||
    cleanText(
      request.headers["x-vercel-forwarded-for"],
      120,
    ) ||
    "unknown"
  );
}

async function checkAppointmentRateLimit(
  supabaseAdmin,
  rateKey,
  limit,
  windowSeconds,
) {
  const { data, error } =
    await supabaseAdmin.rpc(
      "check_appointment_rate_limit",
      {
        p_key: rateKey,
        p_limit: limit,
        p_window_seconds:
          windowSeconds,
      },
    );

  if (error) {
    console.error(
      "Appointment rate-limit check failed:",
      error,
    );

    // Fail closed for anonymous booking creation.
    return false;
  }

  return data === true;
}

async function sendAppointmentEmail({
  to,
  subject,
  html,
}) {
  const resendApiKey =
    process.env.RESEND_API_KEY;

  if (!resendApiKey || !to) {
    return {
      sent: false,
      error:
        !resendApiKey
          ? "Email service is not configured"
          : "Missing recipient email",
    };
  }

  try {
    const emailResponse =
      await fetch(
        "https://api.resend.com/emails",
        {
          method: "POST",
          headers: {
            Authorization:
              `Bearer ${resendApiKey}`,
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            from:
              process.env.ZISTO_FROM_EMAIL ||
              "Zisto <hello@mail.zisto.app>",
            to: [to],
            subject,
            html,
          }),
        },
      );

    if (!emailResponse.ok) {
      const error =
        await emailResponse.text();

      console.error(
        "Appointment email failed:",
        error,
      );

      return {
        sent: false,
        error,
      };
    }

    return {
      sent: true,
      error: null,
    };
  } catch (error) {
    console.error(
      "Appointment email error:",
      error,
    );

    return {
      sent: false,
      error:
        error instanceof Error
          ? error.message
          : "Email delivery failed",
    };
  }
}

function appointmentManageUrl(
  liveUrl,
  token,
  action,
) {
  try {
    const url = new URL(liveUrl);

    url.searchParams.set(
      "appointment_token",
      token,
    );
    url.searchParams.set(
      "appointment_action",
      action,
    );

    return url.toString();
  } catch {
    return null;
  }
}

function escapeAppointmentHtml(value) {
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

async function handleAppointmentBootstrap(
  supabaseAdmin,
  body,
  response,
) {
  const projectKey =
    cleanText(body.project_key, 100);

  const liveUrl =
    cleanText(body.live_url, 1000);

  if (!projectKey && !liveUrl) {
    return response.status(400).json({
      error:
        "project_key or live_url is required",
    });
  }

  try {
    const resolved =
      await resolveBookingProject(
        supabaseAdmin,
        {
          projectKey,
          liveUrl,
        },
      );

    if (!resolved) {
      return response.status(404).json({
        error:
          "Appointments are not enabled for this Smart Link",
      });
    }

    const { business, project } = resolved;

    const busyWindowStart =
      new Date();

    const busyWindowEnd =
      new Date(
        busyWindowStart.getTime() +
          35 * 24 * 60 * 60 * 1000,
      );

    const [
      servicesResult,
      staffResult,
      availabilityResult,
      busyResult,
    ] = await Promise.all([
      supabaseAdmin
        .from("appointment_services")
        .select(
          "id,name,duration_minutes,price_cents,currency,sort_order",
        )
        .eq("business_id", business.id)
        .eq("is_active", true)
        .order("sort_order", {
          ascending: true,
        }),
      supabaseAdmin
        .from("appointment_staff")
        .select(
          "id,name,sort_order",
        )
        .eq("business_id", business.id)
        .eq("is_active", true)
        .order("sort_order", {
          ascending: true,
        }),
      supabaseAdmin
        .from("appointment_availability")
        .select(
          "id,staff_id,weekday,starts_at,ends_at",
        )
        .eq("business_id", business.id)
        .eq("is_active", true)
        .order("weekday", {
          ascending: true,
        }),
      supabaseAdmin
        .from("appointments")
        .select(
          "staff_id,starts_at,ends_at",
        )
        .eq("business_id", business.id)
        .neq("status", "cancelled")
        .gte(
          "starts_at",
          busyWindowStart.toISOString(),
        )
        .lt(
          "starts_at",
          busyWindowEnd.toISOString(),
        )
        .order("starts_at", {
          ascending: true,
        }),
    ]);

    if (
      servicesResult.error ||
      staffResult.error ||
      availabilityResult.error ||
      busyResult.error
    ) {
      console.error(
        "Appointment bootstrap failed",
        {
          services:
            servicesResult.error,
          staff: staffResult.error,
          availability:
            availabilityResult.error,
          busy:
            busyResult.error,
        },
      );

      const failedResource =
        servicesResult.error
          ? "appointment_services"
          : staffResult.error
            ? "appointment_staff"
            : availabilityResult.error
            ? "appointment_availability"
            : "appointments";

      const failedCode =
        servicesResult.error?.code ||
        staffResult.error?.code ||
        availabilityResult.error?.code ||
        busyResult.error?.code ||
        null;

      return response.status(500).json({
        error:
          `Booking setup error: ${failedResource}${failedCode ? ` (${failedCode})` : ""}`,
        diagnostic: {
          resource: failedResource,
          code: failedCode,
        },
      });
    }

    return response.status(200).json({
      business: {
        id: business.id,
        name: business.name,
        timezone:
          business.timezone ||
          "Europe/Athens",
      },
      services:
        servicesResult.data ?? [],
      staff:
        staffResult.data ?? [],
      availability:
        availabilityResult.data ?? [],
      busy:
        busyResult.data ?? [],
    });
  } catch (error) {
    console.error(
      "Appointment bootstrap error:",
      error,
    );

    return response.status(500).json({
      error:
        "Booking setup error: project resolution",
      diagnostic: {
        code:
          typeof error?.code === "string"
            ? error.code
            : null,
      },
    });
  }
}

async function handleAppointmentBooking(
  supabaseAdmin,
  body,
  request,
  response,
) {
  const projectKey =
    cleanText(body.project_key, 100);

  const liveUrl =
    cleanText(body.live_url, 1000);

  const serviceId =
    cleanText(body.service_id, 100);

  const staffId =
    cleanText(body.staff_id, 100);

  const customerName =
    cleanText(body.customer_name, 160);

  const customerEmail =
    cleanText(body.customer_email, 180);

  const customerPhone =
    cleanText(body.customer_phone, 80);

  const notes =
    cleanText(body.notes, 1200);

  const startsAtRaw =
    cleanText(body.starts_at, 100);

  if (
    (!projectKey && !liveUrl) ||
    !serviceId ||
    !customerName ||
    !customerEmail ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      customerEmail,
    ) ||
    !startsAtRaw
  ) {
    return response.status(400).json({
      error:
        "project_key or live_url, plus service_id, customer_name, valid customer_email and starts_at are required",
    });
  }

  const startsAt =
    new Date(startsAtRaw);

  if (
    Number.isNaN(startsAt.getTime()) ||
    startsAt <= new Date()
  ) {
    return response.status(400).json({
      error:
        "Appointment start must be a valid future date",
    });
  }

  try {
    const resolved =
      await resolveBookingProject(
        supabaseAdmin,
        {
          projectKey,
          liveUrl,
        },
      );

    if (!resolved) {
      return response.status(404).json({
        error:
          "Appointments are not enabled for this Smart Link",
      });
    }

    const { business, project } = resolved;

    const requestIp =
      getRequestIp(request);

    const normalizedEmail =
      customerEmail.toLowerCase();

    const [ipAllowed, emailAllowed] =
      await Promise.all([
        checkAppointmentRateLimit(
          supabaseAdmin,
          `booking:ip:${business.id}:${requestIp}`,
          12,
          15 * 60,
        ),
        checkAppointmentRateLimit(
          supabaseAdmin,
          `booking:email:${business.id}:${normalizedEmail}`,
          6,
          60 * 60,
        ),
      ]);

    if (!ipAllowed || !emailAllowed) {
      return response.status(429).json({
        error:
          "Too many booking attempts. Please try again later.",
      });
    }

    const {
      data: service,
      error: serviceError,
    } = await supabaseAdmin
      .from("appointment_services")
      .select(
        "id,name,duration_minutes,is_active",
      )
      .eq("id", serviceId)
      .eq("business_id", business.id)
      .maybeSingle();

    if (
      serviceError ||
      !service ||
      !service.is_active
    ) {
      return response.status(400).json({
        error:
          "Invalid appointment service",
      });
    }

    const {
      data: activeStaff,
      error: activeStaffError,
    } = await supabaseAdmin
      .from("appointment_staff")
      .select("id")
      .eq("business_id", business.id)
      .eq("is_active", true);

    if (activeStaffError) {
      return response.status(500).json({
        error:
          "Could not validate appointment staff",
      });
    }

    const requiresStaff =
      (activeStaff ?? []).length > 0;

    if (
      requiresStaff &&
      !staffId
    ) {
      return response.status(400).json({
        error:
          "A staff member is required",
      });
    }

    if (staffId) {
      const validStaff =
        (activeStaff ?? []).some(
          (member) =>
            member.id === staffId,
        );

      if (!validStaff) {
        return response.status(400).json({
          error:
            "Invalid appointment staff member",
        });
      }
    }

    const durationMinutes =
      Number(service.duration_minutes);

    const endsAt =
      new Date(
        startsAt.getTime() +
          durationMinutes * 60_000,
      );

    const timeZone =
      business.timezone ||
      "Europe/Athens";

    const startLocal =
      getZonedDayAndMinutes(
        startsAt,
        timeZone,
      );

    const endLocal =
      getZonedDayAndMinutes(
        endsAt,
        timeZone,
      );

    if (
      startLocal.weekday !==
      endLocal.weekday
    ) {
      return response.status(400).json({
        error:
          "Appointment must fit inside one availability window",
      });
    }

    let availabilityQuery =
      supabaseAdmin
        .from("appointment_availability")
        .select(
          "staff_id,weekday,starts_at,ends_at",
        )
        .eq("business_id", business.id)
        .eq(
          "weekday",
          startLocal.weekday,
        )
        .eq("is_active", true);

    if (staffId) {
      availabilityQuery =
        availabilityQuery.or(
          `staff_id.eq.${staffId},staff_id.is.null`,
        );
    } else {
      availabilityQuery =
        availabilityQuery.is(
          "staff_id",
          null,
        );
    }

    const {
      data: windows,
      error: availabilityError,
    } = await availabilityQuery;

    if (availabilityError) {
      console.error(
        "Availability validation failed:",
        availabilityError,
      );

      return response.status(500).json({
        error:
          "Could not validate availability",
      });
    }

    const fitsAvailability =
      (windows ?? []).some((window) => {
        const windowStart =
          timeStringToMinutes(
            window.starts_at,
          );

        const windowEnd =
          timeStringToMinutes(
            window.ends_at,
          );

        if (
          windowStart === null ||
          windowEnd === null
        ) {
          return false;
        }

        return (
          startLocal.minutes >=
            windowStart &&
          endLocal.minutes <= windowEnd
        );
      });

    if (!fitsAvailability) {
      return response.status(409).json({
        error:
          "The selected time is outside available booking hours",
      });
    }

    let conflictQuery =
      supabaseAdmin
        .from("appointments")
        .select("id")
        .eq("business_id", business.id)
        .neq("status", "cancelled")
        .lt(
          "starts_at",
          endsAt.toISOString(),
        )
        .gt(
          "ends_at",
          startsAt.toISOString(),
        )
        .limit(1);

    if (staffId) {
      conflictQuery =
        conflictQuery.eq(
          "staff_id",
          staffId,
        );
    } else {
      conflictQuery =
        conflictQuery.is(
          "staff_id",
          null,
        );
    }

    const {
      data: conflicts,
      error: conflictError,
    } = await conflictQuery;

    if (conflictError) {
      console.error(
        "Booking conflict lookup failed:",
        conflictError,
      );

      return response.status(500).json({
        error:
          "Could not verify appointment availability",
      });
    }

    if ((conflicts ?? []).length > 0) {
      return response.status(409).json({
        error:
          "This time is no longer available",
      });
    }

    const {
      data: appointment,
      error: insertError,
    } = await supabaseAdmin
      .from("appointments")
      .insert({
        business_id: business.id,
        service_id: service.id,
        staff_id: staffId || null,
        customer_name: customerName,
        customer_email:
          customerEmail || null,
        customer_phone:
          customerPhone || null,
        starts_at:
          startsAt.toISOString(),
        ends_at:
          endsAt.toISOString(),
        status: "confirmed",
        source: "smart_link",
        notes: notes || null,
      })
      .select(
        "id,public_token,starts_at,ends_at,status",
      )
      .single();

    if (insertError) {
      console.error(
        "Appointment insert failed:",
        insertError,
      );

      if (
        insertError.code === "23P01"
      ) {
        return response.status(409).json({
          error:
            "This time is no longer available",
        });
      }

      return response.status(500).json({
        error:
          "Could not create appointment",
      });
    }

    const changeUrl =
      appointmentManageUrl(
        project.live_url,
        appointment.public_token,
        "reschedule",
      );

    const cancelUrl =
      appointmentManageUrl(
        project.live_url,
        appointment.public_token,
        "cancel",
      );

    const formattedDate =
      new Intl.DateTimeFormat(
        "el-GR",
        {
          timeZone,
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
          timeZone,
          hour: "2-digit",
          minute: "2-digit",
        },
      ).format(startsAt);

    const safeBusinessName =
      escapeAppointmentHtml(
        business.name,
      );

    const safeCustomerName =
      escapeAppointmentHtml(
        customerName,
      );

    const safeServiceName =
      escapeAppointmentHtml(
        service.name,
      );

    const confirmationEmail =
      await sendAppointmentEmail({
        to: customerEmail,
        subject:
          `Επιβεβαίωση ραντεβού — ${business.name}`,
        html: `
          <div style="font-family:Arial,sans-serif;background:#f4f4f2;padding:36px 16px;color:#222;">
            <div style="max-width:620px;margin:0 auto;background:#fff;border-radius:24px;padding:36px;">
              <div style="font-size:12px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:#DC2727;">ZISTO APPOINTMENTS</div>
              <h1 style="margin:12px 0 0;font-size:32px;line-height:1.08;">Το ραντεβού σου επιβεβαιώθηκε.</h1>
              <p style="margin:22px 0 0;color:#555;line-height:1.7;">Γεια σου ${safeCustomerName}, το ραντεβού σου στο <strong>${safeBusinessName}</strong> καταχωρήθηκε επιτυχώς.</p>

              <div style="margin:26px 0;padding:20px;background:#f6f6f4;border-radius:16px;line-height:1.8;">
                <div><strong>Υπηρεσία:</strong> ${safeServiceName}</div>
                <div><strong>Ημερομηνία:</strong> ${formattedDate}</div>
                <div><strong>Ώρα:</strong> ${formattedTime}</div>
              </div>

              <p style="margin:0 0 14px;font-size:13px;font-weight:700;color:#555;">Χρειάζεσαι κάποια αλλαγή;</p>

              <div style="display:block;margin-top:12px;">
                ${changeUrl ? `<a href="${escapeAppointmentHtml(changeUrl)}" style="display:block;text-align:center;text-decoration:none;background:#222;color:#fff;padding:15px 18px;border-radius:12px;font-weight:800;margin-bottom:10px;">Αλλαγή ημερομηνίας</a>` : ""}
                ${cancelUrl ? `<a href="${escapeAppointmentHtml(cancelUrl)}" style="display:block;text-align:center;text-decoration:none;background:#fff;color:#DC2727;padding:14px 18px;border-radius:12px;font-weight:800;border:1px solid #DC2727;">Ακύρωση ραντεβού</a>` : ""}
              </div>

              <p style="margin:26px 0 0;color:#999;font-size:12px;line-height:1.6;">Τα παραπάνω links είναι προσωπικά για το συγκεκριμένο ραντεβού. Μην τα προωθήσεις σε τρίτους.</p>
              <div style="margin-top:28px;padding-top:18px;border-top:1px solid #eee;color:#999;font-size:12px;">Εστάλη μέσω Zisto.</div>
            </div>
          </div>
        `,
      });

    return response.status(201).json({
      success: true,
      email_sent:
        confirmationEmail.sent,
      appointment,
      service: {
        id: service.id,
        name: service.name,
        duration_minutes:
          service.duration_minutes,
      },
      business: {
        name: business.name,
        timezone: timeZone,
      },
    });
  } catch (error) {
    console.error(
      "Appointment booking error:",
      error,
    );

    return response.status(500).json({
      error:
        "Could not create appointment",
    });
  }
}


async function resolveAppointmentByToken(
  supabaseAdmin,
  token,
) {
  const {
    data: appointment,
    error,
  } = await supabaseAdmin
    .from("appointments")
    .select(`
      id,
      public_token,
      business_id,
      service_id,
      staff_id,
      customer_name,
      customer_email,
      starts_at,
      ends_at,
      status,
      appointment_services (
        id,
        name,
        duration_minutes,
        price_cents,
        currency
      ),
      appointment_staff (
        id,
        name
      ),
      businesses (
        id,
        name,
        timezone
      )
    `)
    .eq("public_token", token)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return appointment ?? null;
}

async function handleAppointmentManage(
  supabaseAdmin,
  body,
  response,
) {
  const token =
    cleanText(
      body.appointment_token,
      100,
    );

  if (!token) {
    return response.status(400).json({
      error:
        "appointment_token is required",
    });
  }

  try {
    const appointment =
      await resolveAppointmentByToken(
        supabaseAdmin,
        token,
      );

    if (!appointment) {
      return response.status(404).json({
        error:
          "Appointment not found",
      });
    }

    const business =
      appointment.businesses;

    const startsAt =
      new Date(
        appointment.starts_at,
      );

    const canManage =
      ["pending", "confirmed"].includes(
        appointment.status,
      ) &&
      startsAt > new Date();

    const timeZone =
      business?.timezone ||
      "Europe/Athens";

    const {
      data: availability,
      error: availabilityError,
    } = await supabaseAdmin
      .from("appointment_availability")
      .select(
        "id,staff_id,weekday,starts_at,ends_at,is_active",
      )
      .eq(
        "business_id",
        appointment.business_id,
      )
      .eq("is_active", true);

    const busyWindowEnd =
      new Date(
        Date.now() +
          35 * 24 * 60 * 60 * 1000,
      );

    const {
      data: busy,
      error: busyError,
    } = await supabaseAdmin
      .from("appointments")
      .select(
        "staff_id,starts_at,ends_at",
      )
      .eq(
        "business_id",
        appointment.business_id,
      )
      .neq("id", appointment.id)
      .neq("status", "cancelled")
      .gte(
        "starts_at",
        new Date().toISOString(),
      )
      .lt(
        "starts_at",
        busyWindowEnd.toISOString(),
      )
      .order("starts_at", {
        ascending: true,
      });

    if (
      availabilityError ||
      busyError
    ) {
      console.error(
        "Manage appointment availability failed:",
        availabilityError || busyError,
      );

      return response.status(500).json({
        error:
          "Could not load appointment availability",
      });
    }

    return response.status(200).json({
      appointment: {
        id: appointment.id,
        public_token:
          appointment.public_token,
        starts_at:
          appointment.starts_at,
        ends_at:
          appointment.ends_at,
        status:
          appointment.status,
        service:
          appointment.appointment_services,
        staff:
          appointment.appointment_staff,
      },
      business: {
        id:
          appointment.business_id,
        name:
          business?.name || "",
        timezone: timeZone,
      },
      availability:
        availability ?? [],
      busy: busy ?? [],
      can_manage: canManage,
    });
  } catch (error) {
    console.error(
      "Appointment manage error:",
      error,
    );

    return response.status(500).json({
      error:
        "Could not load appointment",
    });
  }
}

async function handleAppointmentPublicCancel(
  supabaseAdmin,
  body,
  response,
) {
  const token =
    cleanText(
      body.appointment_token,
      100,
    );

  if (!token) {
    return response.status(400).json({
      error:
        "appointment_token is required",
    });
  }

  try {
    const appointment =
      await resolveAppointmentByToken(
        supabaseAdmin,
        token,
      );

    if (!appointment) {
      return response.status(404).json({
        error:
          "Appointment not found",
      });
    }

    if (
      appointment.status ===
      "cancelled"
    ) {
      return response.status(200).json({
        success: true,
        already_cancelled: true,
      });
    }

    if (
      !["pending", "confirmed"].includes(
        appointment.status,
      ) ||
      new Date(
        appointment.starts_at,
      ) <= new Date()
    ) {
      return response.status(409).json({
        error:
          "This appointment can no longer be cancelled",
      });
    }

    const {
      data: updated,
      error,
    } = await supabaseAdmin
      .from("appointments")
      .update({
        status: "cancelled",
        updated_at:
          new Date().toISOString(),
      })
      .eq("id", appointment.id)
      .eq(
        "public_token",
        token,
      )
      .select(
        "id,status,starts_at",
      )
      .single();

    if (error) {
      console.error(
        "Public appointment cancellation failed:",
        error,
      );

      return response.status(500).json({
        error:
          "Could not cancel appointment",
      });
    }

    return response.status(200).json({
      success: true,
      appointment: updated,
    });
  } catch (error) {
    console.error(
      "Public appointment cancellation error:",
      error,
    );

    return response.status(500).json({
      error:
        "Could not cancel appointment",
    });
  }
}

async function handleAppointmentPublicReschedule(
  supabaseAdmin,
  body,
  response,
) {
  const token =
    cleanText(
      body.appointment_token,
      100,
    );

  const startsAtRaw =
    cleanText(
      body.starts_at,
      100,
    );

  if (!token || !startsAtRaw) {
    return response.status(400).json({
      error:
        "appointment_token and starts_at are required",
    });
  }

  const startsAt =
    new Date(startsAtRaw);

  if (
    Number.isNaN(startsAt.getTime()) ||
    startsAt <= new Date()
  ) {
    return response.status(400).json({
      error:
        "Appointment start must be a valid future date",
    });
  }

  try {
    const appointment =
      await resolveAppointmentByToken(
        supabaseAdmin,
        token,
      );

    if (!appointment) {
      return response.status(404).json({
        error:
          "Appointment not found",
      });
    }

    if (
      !["pending", "confirmed"].includes(
        appointment.status,
      ) ||
      new Date(
        appointment.starts_at,
      ) <= new Date()
    ) {
      return response.status(409).json({
        error:
          "This appointment can no longer be changed",
      });
    }

    const service =
      appointment.appointment_services;

    if (!service) {
      return response.status(400).json({
        error:
          "Appointment service is unavailable",
      });
    }

    const durationMinutes =
      Number(
        service.duration_minutes,
      );

    const endsAt =
      new Date(
        startsAt.getTime() +
          durationMinutes * 60_000,
      );

    const timeZone =
      appointment.businesses
        ?.timezone ||
      "Europe/Athens";

    const startLocal =
      getZonedDayAndMinutes(
        startsAt,
        timeZone,
      );

    const endLocal =
      getZonedDayAndMinutes(
        endsAt,
        timeZone,
      );

    if (
      startLocal.weekday !==
      endLocal.weekday
    ) {
      return response.status(409).json({
        error:
          "Appointment must fit inside one availability window",
      });
    }

    let availabilityQuery =
      supabaseAdmin
        .from(
          "appointment_availability",
        )
        .select(
          "staff_id,weekday,starts_at,ends_at",
        )
        .eq(
          "business_id",
          appointment.business_id,
        )
        .eq(
          "weekday",
          startLocal.weekday,
        )
        .eq("is_active", true);

    if (appointment.staff_id) {
      availabilityQuery =
        availabilityQuery.or(
          `staff_id.eq.${appointment.staff_id},staff_id.is.null`,
        );
    } else {
      availabilityQuery =
        availabilityQuery.is(
          "staff_id",
          null,
        );
    }

    const {
      data: windows,
      error: availabilityError,
    } = await availabilityQuery;

    if (availabilityError) {
      console.error(
        "Reschedule availability validation failed:",
        availabilityError,
      );

      return response.status(500).json({
        error:
          "Could not validate availability",
      });
    }

    const fitsAvailability =
      (windows ?? []).some(
        (window) => {
          const windowStart =
            timeStringToMinutes(
              window.starts_at,
            );

          const windowEnd =
            timeStringToMinutes(
              window.ends_at,
            );

          return (
            windowStart !== null &&
            windowEnd !== null &&
            startLocal.minutes >=
              windowStart &&
            endLocal.minutes <=
              windowEnd
          );
        },
      );

    if (!fitsAvailability) {
      return response.status(409).json({
        error:
          "The selected time is outside available booking hours",
      });
    }

    let conflictQuery =
      supabaseAdmin
        .from("appointments")
        .select("id")
        .eq(
          "business_id",
          appointment.business_id,
        )
        .neq(
          "id",
          appointment.id,
        )
        .neq(
          "status",
          "cancelled",
        )
        .lt(
          "starts_at",
          endsAt.toISOString(),
        )
        .gt(
          "ends_at",
          startsAt.toISOString(),
        )
        .limit(1);

    if (appointment.staff_id) {
      conflictQuery =
        conflictQuery.eq(
          "staff_id",
          appointment.staff_id,
        );
    } else {
      conflictQuery =
        conflictQuery.is(
          "staff_id",
          null,
        );
    }

    const {
      data: conflicts,
      error: conflictError,
    } = await conflictQuery;

    if (conflictError) {
      console.error(
        "Reschedule conflict lookup failed:",
        conflictError,
      );

      return response.status(500).json({
        error:
          "Could not verify appointment availability",
      });
    }

    if ((conflicts ?? []).length) {
      return response.status(409).json({
        error:
          "This time is no longer available",
      });
    }

    const {
      data: updated,
      error: updateError,
    } = await supabaseAdmin
      .from("appointments")
      .update({
        starts_at:
          startsAt.toISOString(),
        ends_at:
          endsAt.toISOString(),
        updated_at:
          new Date().toISOString(),
      })
      .eq("id", appointment.id)
      .eq(
        "public_token",
        token,
      )
      .select(
        "id,starts_at,ends_at,status",
      )
      .single();

    if (updateError) {
      console.error(
        "Appointment reschedule failed:",
        updateError,
      );

      if (
        updateError.code === "23P01"
      ) {
        return response.status(409).json({
          error:
            "This time is no longer available",
        });
      }

      return response.status(500).json({
        error:
          "Could not change appointment",
      });
    }

    const businessName =
      appointment.businesses?.name ||
      "η επιχείρηση";

    const formattedDate =
      new Intl.DateTimeFormat(
        "el-GR",
        {
          timeZone,
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
          timeZone,
          hour: "2-digit",
          minute: "2-digit",
        },
      ).format(startsAt);

    const rescheduleEmail =
      appointment.customer_email
        ? await sendAppointmentEmail({
            to:
              appointment.customer_email,
            subject:
              `Αλλαγή ραντεβού — ${businessName}`,
            html: `
              <div style="font-family:Arial,sans-serif;background:#f4f4f2;padding:36px 16px;color:#222;">
                <div style="max-width:620px;margin:0 auto;background:#fff;border-radius:24px;padding:36px;">
                  <div style="font-size:12px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:#DC2727;">ZISTO APPOINTMENTS</div>
                  <h1 style="margin:12px 0 0;font-size:32px;line-height:1.08;">Το ραντεβού σου άλλαξε.</h1>
                  <p style="margin:22px 0 0;color:#555;line-height:1.7;">Η νέα ημερομηνία και ώρα για το ραντεβού σου στο <strong>${escapeAppointmentHtml(businessName)}</strong> είναι:</p>
                  <div style="margin:26px 0;padding:20px;background:#f6f6f4;border-radius:16px;line-height:1.8;">
                    <div><strong>Υπηρεσία:</strong> ${escapeAppointmentHtml(service.name)}</div>
                    <div><strong>Ημερομηνία:</strong> ${formattedDate}</div>
                    <div><strong>Ώρα:</strong> ${formattedTime}</div>
                  </div>
                  <div style="margin-top:28px;padding-top:18px;border-top:1px solid #eee;color:#999;font-size:12px;">Εστάλη μέσω Zisto.</div>
                </div>
              </div>
            `,
          })
        : {
            sent: false,
            error:
              "Missing recipient email",
          };

    return response.status(200).json({
      success: true,
      email_sent:
        rescheduleEmail.sent,
      appointment: updated,
    });
  } catch (error) {
    console.error(
      "Public appointment reschedule error:",
      error,
    );

    return response.status(500).json({
      error:
        "Could not change appointment",
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


  const appointmentAction =
    incomingBody.action ===
      "appointment_bootstrap" ||
    incomingBody.action ===
      "appointment_book" ||
    incomingBody.action ===
      "appointment_manage" ||
    incomingBody.action ===
      "appointment_public_cancel" ||
    incomingBody.action ===
      "appointment_public_reschedule";

  if (appointmentAction) {
    const supabaseUrl =
      process.env.SUPABASE_URL;

    const supabaseSecretKey =
      process.env.SUPABASE_SECRET_KEY;

    if (!supabaseUrl || !supabaseSecretKey) {
      return response.status(500).json({
        error:
          "Missing server configuration",
      });
    }

    const supabaseAdmin =
      createClient(
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

    if (
      incomingBody.action ===
      "appointment_bootstrap"
    ) {
      return handleAppointmentBootstrap(
        supabaseAdmin,
        incomingBody,
        response,
      );
    }

    if (
      incomingBody.action ===
      "appointment_manage"
    ) {
      return handleAppointmentManage(
        supabaseAdmin,
        incomingBody,
        response,
      );
    }

    if (
      incomingBody.action ===
      "appointment_public_cancel"
    ) {
      return handleAppointmentPublicCancel(
        supabaseAdmin,
        incomingBody,
        response,
      );
    }

    if (
      incomingBody.action ===
      "appointment_public_reschedule"
    ) {
      return handleAppointmentPublicReschedule(
        supabaseAdmin,
        incomingBody,
        response,
      );
    }

    return handleAppointmentBooking(
      supabaseAdmin,
      incomingBody,
      request,
      response,
    );
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

    const liveUrl =
      cleanText(body.live_url, 1000);

    const eventType =
      cleanText(body.event_type, 50) ??
      "page_view";

    const sessionId =
      cleanText(body.session_id, 150);

    const visitorId =
      cleanText(body.visitor_id, 150);

    const pageUrl =
      cleanText(body.page_url, 1500);

    if (!projectKey && !liveUrl) {
      return response.status(400).json({
        error:
          "project_key or live_url is required",
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
    let projectQuery =
      supabaseAdmin
        .from("connected_projects")
        .select(`
          id,
          business_id,
          status,
          live_url
        `);

    if (projectKey) {
      projectQuery =
        projectQuery.eq(
          "project_key",
          projectKey,
        );
    } else {
      projectQuery =
        projectQuery.eq(
          "live_url",
          liveUrl,
        );
    }

    const {
      data: project,
      error: projectError,
    } = await projectQuery.maybeSingle();

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

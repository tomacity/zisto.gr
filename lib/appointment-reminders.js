import { createHash } from "node:crypto";

const THIRTY_MINUTES = 30 * 60 * 1000;
const MAX_SCHEDULE_DELAY = 30 * 24 * 60 * 60 * 1000 - 5 * 60 * 1000;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[ch]);
}

function localAppointmentTime(value, timeZone) {
  const date = new Date(value);
  const zone = timeZone || "Europe/Athens";
  return {
    date: new Intl.DateTimeFormat("el-GR", {
      timeZone: zone, weekday: "long", day: "2-digit",
      month: "long", year: "numeric",
    }).format(date),
    time: new Intl.DateTimeFormat("el-GR", {
      timeZone: zone, hour: "2-digit", minute: "2-digit",
      hourCycle: "h23",
    }).format(date),
  };
}

function resendHeaders(key, idempotencyKey) {
  return {
    Authorization: "Bearer " + key,
    "Content-Type": "application/json",
    ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
  };
}

async function cancelResendEmail(id) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, reason: "missing_email_config" };
  try {
    const result = await fetch(
      "https://api.resend.com/emails/" + encodeURIComponent(id) + "/cancel",
      { method: "POST", headers: resendHeaders(key),
        signal: AbortSignal.timeout(8000) },
    );
    if (!result.ok) {
      console.error("Appointment reminder cancellation failed", {
        httpStatus: result.status,
      });
      return { ok: false, reason: "provider_cancel_failed" };
    }
    return { ok: true };
  } catch (error) {
    console.error("Appointment reminder cancellation error", {
      name: error instanceof Error ? error.name : "unknown",
    });
    return { ok: false, reason: "provider_unavailable" };
  }
}

/**
 * Cancel a future reminder BEFORE changing the appointment.
 * If the reminder has already been sent (or was never scheduled), it is safe to continue.
 */
export async function cancelAppointmentReminder(appointment) {
  const id = appointment?.reminder_email_id;
  if (!id) return { ok: true, status: "nothing_scheduled" };
  if (appointment.reminder_scheduled_for &&
      Date.parse(appointment.reminder_scheduled_for) <= Date.now()) {
    return { ok: true, status: "already_due" };
  }
  return cancelResendEmail(id);
}

/**
 * Schedules an additional email exactly 30 minutes before the appointment.
 * The provider accepts scheduling at most 30 days ahead; older future bookings
 * stay unscheduled and the existing daily Zisto cron picks them up later.
 */
export async function scheduleAppointmentReminder(supabaseAdmin, appointment, business, serviceName) {
  if (process.env.ZISTO_APPOINTMENT_REMINDERS_ENABLED !== "true") {
    return { scheduled: false, reason: "disabled" };
  }
  const email = typeof appointment?.customer_email === "string"
    ? appointment.customer_email.trim() : "";
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { scheduled: false, reason: "no_valid_email" };
  }
  if (!appointment?.id || !appointment?.starts_at ||
      appointment.status === "cancelled" || appointment.reminder_email_id) {
    return { scheduled: false, reason: "not_eligible" };
  }

  const scheduledAtMs = Date.parse(appointment.starts_at) - THIRTY_MINUTES;
  const lead = scheduledAtMs - Date.now();
  if (!Number.isFinite(lead) || lead < 90_000) {
    return { scheduled: false, reason: "too_close" };
  }
  if (lead > MAX_SCHEDULE_DELAY) {
    return { scheduled: false, reason: "outside_30_day_window" };
  }
  const key = process.env.RESEND_API_KEY;
  if (!key) return { scheduled: false, reason: "email_not_configured" };

  const timeZone = business?.timezone || "Europe/Athens";
  let time;
  try { time = localAppointmentTime(appointment.starts_at, timeZone); }
  catch { return { scheduled: false, reason: "invalid_timezone" }; }

  const businessName = business?.name || "το κατάστημα";
  const customer = appointment.customer_name || "φίλε μας";
  const safeBusiness = escapeHtml(businessName);
  const safeCustomer = escapeHtml(customer);
  const safeService = escapeHtml(serviceName || "Κούρεμα");
  const scheduledAt = new Date(scheduledAtMs).toISOString();
  const html = [
    '<div style="font-family:Arial,sans-serif;background:#f4f4f2;padding:32px 16px;color:#222">',
    '<div style="max-width:620px;margin:0 auto;background:#fff;border-radius:20px;padding:32px">',
    '<div style="font-size:12px;font-weight:800;letter-spacing:0.15em;color:#DC2727">ZISTO APPOINTMENTS</div>',
    '<h1 style="font-size:30px;line-height:1.18;margin:15px 0">Σε 30 λεπτά έχεις ραντεβού!</h1>',
    '<p style="font-size:16px;line-height:1.7">Γεια σου ' + safeCustomer + ', σου υπενθυμίζουμε το ραντεβού σου στο <strong>' + safeBusiness + '</strong>.</p>',
    '<div style="padding:18px;background:#f6f6f4;border-radius:14px;line-height:1.9">',
    '<div><strong>Υπηρεσία:</strong> ' + safeService + '</div>',
    '<div><strong>Ημερομηνία:</strong> ' + escapeHtml(time.date) + '</div>',
    '<div><strong>Ώρα:</strong> ' + escapeHtml(time.time) + '</div>',
    '</div><p style="line-height:1.7">Σε περιμένουμε! ✂️</p>',
    '<p style="border-top:1px solid #eee;padding-top:18px;color:#888;font-size:12px">Αυτή είναι αυτόματη υπενθύμιση της κράτησής σου μέσω Zisto.</p>',
    '</div></div>',
  ].join("");
  const idempotencyKey = "zisto-appt-reminder-" +
    createHash("sha256").update(appointment.id + ":" + appointment.starts_at)
      .digest("hex").slice(0, 32);

  try {
    const result = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: resendHeaders(key, idempotencyKey),
      body: JSON.stringify({
        from: process.env.ZISTO_FROM_EMAIL || "Zisto <hello@mail.zisto.app>",
        to: [email],
        subject: "Υπενθύμιση: Το ραντεβού σου σε 30 λεπτά — " + businessName,
        html,
        scheduled_at: scheduledAt,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!result.ok) {
      console.error("Appointment reminder scheduling rejected", { httpStatus: result.status });
      return { scheduled: false, reason: "provider_error" };
    }
    const providerResult = await result.json();
    if (!providerResult.id) {
      return { scheduled: false, reason: "provider_missing_id" };
    }

    const update = await supabaseAdmin.from("appointments")
      .update({ reminder_email_id: providerResult.id, reminder_scheduled_for: scheduledAt })
      .eq("id", appointment.id)
      .eq("status", "confirmed")
      .eq("starts_at", appointment.starts_at)
      .is("reminder_email_id", null)
      .select("id")
      .maybeSingle();
    if (update.error || !update.data) {
      await cancelResendEmail(providerResult.id);
      console.error("Appointment reminder could not be linked to appointment", {
        code: update.error?.code || "stale_appointment",
      });
      return { scheduled: false, reason: "save_failed" };
    }
    return { scheduled: true };
  } catch (error) {
    console.error("Appointment reminder scheduling failed", {
      name: error instanceof Error ? error.name : "unknown",
    });
    return { scheduled: false, reason: "network_error" };
  }
}

/**
 * Called by the existing authenticated daily Zisto cron.
 * Picks up bookings created more than 30 days in advance and transient failures.
 * Sends no email immediately: only schedules reminders in Resend.
 */
export async function queuePendingAppointmentReminders(supabaseAdmin) {
  if (process.env.ZISTO_APPOINTMENT_REMINDERS_ENABLED !== "true") {
    return { scanned: 0, scheduled: 0, disabled: true };
  }
  const now = Date.now();
  const minStart = new Date(now + THIRTY_MINUTES + 120_000).toISOString();
  const maxStart = new Date(now + MAX_SCHEDULE_DELAY + THIRTY_MINUTES).toISOString();
  const { data, error } = await supabaseAdmin.from("appointments")
    .select("id,business_id,customer_name,customer_email,starts_at,status,reminder_email_id,businesses(name,timezone,dashboard_modules),appointment_services(name)")
    .eq("status", "confirmed")
    .is("reminder_email_id", null)
    .gte("starts_at", minStart)
    .lte("starts_at", maxStart)
    .order("starts_at", { ascending: true })
    .limit(50);
  if (error) {
    console.error("Pending appointment reminders lookup failed", { code: error.code });
    return { scanned: 0, scheduled: 0, error: true };
  }
  let scheduled = 0;
  let scanned = 0;
  for (const appointment of data || []) {
    if (!appointment.businesses?.dashboard_modules?.includes("appointments")) continue;
    scanned++;
    const result = await scheduleAppointmentReminder(supabaseAdmin, appointment,
      appointment.businesses, appointment.appointment_services?.name);
    if (result.scheduled) scheduled++;
  }
  return { scanned, scheduled };
}

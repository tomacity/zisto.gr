import { createHash } from "node:crypto";

/**
 * Customer booking notifications via iSMS.gr.
 * This module is server-only and keeps the API key out of client bundles.
 * Failures never invalidate an already saved appointment.
 */
export function normalizeSmsPhone(raw) {
  if (typeof raw !== "string" || !raw.trim()) return null;
  let value = raw.trim().replace(/[\s().-]/g, "");
  if (value.startsWith("00")) value = "+" + value.slice(2);
  if (/^69\d{8}$/.test(value)) return "30" + value;
  if (/^(?:\+30|30)69\d{8}$/.test(value)) return value.replace(/^\+/, "");
  // International recipients must explicitly include their country code.
  if (/^\+[1-9]\d{7,14}$/.test(value) && !value.startsWith("+30")) {
    return value.slice(1);
  }
  return null;
}

function bookingDateTime(iso, timeZone) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const zone = timeZone || "Europe/Athens";
  try {
    return {
      date: new Intl.DateTimeFormat("el-GR", {
        timeZone: zone, day: "2-digit", month: "2-digit", year: "2-digit",
      }).format(date),
      time: new Intl.DateTimeFormat("el-GR", {
        timeZone: zone, hour: "2-digit", minute: "2-digit", hourCycle: "h23",
      }).format(date),
    };
  } catch {
    return null;
  }
}

export async function sendAppointmentSms({
  businessId,
  appointmentId,
  phone,
  businessName,
  startsAt,
  timeZone,
  event,
}) {
  const allowedEvents = ["booked", "rescheduled", "cancelled"];
  if (!allowedEvents.includes(event) || !appointmentId || !businessId) {
    return { queued: false, status: "invalid_request" };
  }

  const allowedBusinesses = (process.env.ZISTO_SMS_BUSINESS_IDS || "")
    .split(",").map((id) => id.trim()).filter(Boolean);
  if (process.env.ZISTO_SMS_ENABLED !== "true" ||
      !allowedBusinesses.includes(businessId)) {
    return { queued: false, status: "disabled" };
  }

  const apiKey = process.env.ISMS_API_KEY;
  const sender = process.env.ISMS_SENDER_ID;
  if (!apiKey || !sender || !/^[A-Za-z0-9.]{1,11}$/.test(sender)) {
    console.warn("SMS notifications are enabled but provider is not configured");
    return { queued: false, status: "not_configured" };
  }

  const mobile = normalizeSmsPhone(phone);
  if (!mobile) return { queued: false, status: "missing_or_invalid_phone" };

  const formatted = bookingDateTime(startsAt, timeZone);
  if (!formatted) return { queued: false, status: "invalid_date" };

  const venue = String(businessName || "Barber")
    .replace(/[\r\n]/g, " ").trim().slice(0, 24);
  const when = `${formatted.date} ${formatted.time}`;
  const texts = {
    booked: `Zisto: Ραντεβού στο ${venue}, ${when}. Επιβεβαιώθηκε.`,
    rescheduled: `Zisto: Αλλαγή ραντεβού στο ${venue}, ${when}.`,
    cancelled: `Zisto: Το ραντεβού στο ${venue}, ${when} ακυρώθηκε.`,
  };
  // iSMS client_ref makes retried requests idempotent and prevents duplicate charges.
  const clientRef = "zisto-" + createHash("sha256")
    .update(`${businessId}:${appointmentId}:${event}:${startsAt}`)
    .digest("hex").slice(0, 40);

  try {
    const result = await fetch("https://api.isms.gr/v1/messages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender,
        to: [mobile],
        text: texts[event],
        unicode: true,
        client_ref: clientRef,
      }),
      signal: AbortSignal.timeout(8000),
    });
    const payload = await result.json().catch(() => ({}));
    if (!result.ok || !payload.id) {
      console.error("Appointment SMS rejected", {
        httpStatus: result.status,
        providerError: String(payload.error || "unknown").slice(0, 100),
      });
      return { queued: false, status: "provider_error" };
    }
    return { queued: true, status: payload.status || "queued" };
  } catch (error) {
    console.error("Appointment SMS request failed", {
      name: error instanceof Error ? error.name : "unknown",
    });
    return { queued: false, status: "network_error" };
  }
}

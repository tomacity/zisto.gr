/**
 * Optional, server-only customer appointment SMS via textbee.
 * Free textbee tier requires a connected Android phone and SIM plan.
 * SMS failures are non-blocking for appointment saves.
 */
export function normalizeSmsPhone(raw) {
  if (typeof raw !== "string" || !raw.trim()) return null;
  let value = raw.trim().replace(/[\\s().-]/g, "");
  if (value.startsWith("00")) value = "+" + value.slice(2);
  if (/^69\\d{8}$/.test(value)) return "+30" + value;
  if (/^30(69\\d{8})$/.test(value)) return "+" + value;
  if (/^\\+3069\\d{8}$/.test(value)) return value;
  if (/^\\+[1-9]\\d{7,14}$/.test(value) && !value.startsWith("+30")) return value;
  return null;
}

function appointmentDateTime(iso, timeZone) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  try {
    const tz = timeZone || "Europe/Athens";
    return {
      date: new Intl.DateTimeFormat("el-GR", {
        timeZone: tz, day: "2-digit", month: "2-digit", year: "2-digit",
      }).format(date),
      time: new Intl.DateTimeFormat("el-GR", {
        timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23",
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
  if (!["booked", "rescheduled", "cancelled"].includes(event) ||
      !appointmentId || !businessId) {
    return { queued: false, status: "invalid_request" };
  }

  // Keep the SMS channel OFF until an owner enables specific pilot businesses.
  const allowedBusinesses = (process.env.ZISTO_SMS_BUSINESS_IDS || "")
    .split(",").map(x => x.trim()).filter(Boolean);
  if (process.env.ZISTO_SMS_ENABLED !== "true" ||
      !allowedBusinesses.includes(String(businessId))) {
    return { queued: false, status: "disabled" };
  }

  const apiKey = process.env.TEXTBEE_API_KEY;
  if (!apiKey) return { queued: false, status: "not_configured" };
  const recipient = normalizeSmsPhone(phone);
  if (!recipient) return { queued: false, status: "invalid_phone" };
  const formatted = appointmentDateTime(startsAt, timeZone);
  if (!formatted) return { queued: false, status: "invalid_date" };

  const venue = String(businessName || "Barber").replace(/[\\r\\n]/g, " ").trim().slice(0, 35);
  const when = formatted.date + " " + formatted.time;
  const message = {
    booked: `Zisto: Το ραντεβού σου στο ${venue} επιβεβαιώθηκε για ${when}.`,
    rescheduled: `Zisto: Το ραντεβού σου στο ${venue} μεταφέρθηκε για ${when}.`,
    cancelled: `Zisto: Το ραντεβού σου στο ${venue} για ${when} ακυρώθηκε.`,
  }[event];

  // Textbee sends from a connected Android device; no sender name can be set.
  const payload = { recipients: [recipient], message };
  if (process.env.TEXTBEE_DEVICE_ID) payload.deviceId = process.env.TEXTBEE_DEVICE_ID;

  try {
    const resp = await fetch("https://api.textbee.dev/api/v1/gateway/send-sms", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });
    const result = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      console.error("Appointment SMS provider rejected request", { status: resp.status });
      return { queued: false, status: "provider_error" };
    }
    // Provider API accepts/queues SMS, but delivery must be confirmed via a webhook.
    return { queued: true, status: "queued" };
  } catch (error) {
    console.error("Appointment SMS request failed", {
      name: error instanceof Error ? error.name : "unknown",
    });
    return { queued: false, status: "network_error" };
  }
}

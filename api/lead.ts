type LeadBody = {
  businessType?: unknown;
  goals?: unknown;
  placements?: unknown;
  quantity?: unknown;
  tracking?: unknown;
  customization?: unknown;
  fullName?: unknown;
  businessName?: unknown;
  email?: unknown;
  phone?: unknown;
  notes?: unknown;
  website?: unknown;
};

function text(value: unknown, max = 500) {
  return typeof value === "string"
    ? value.trim().slice(0, max)
    : "";
}

function list(value: unknown, maxItems = 12) {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim().slice(0, 120))
        .filter(Boolean)
        .slice(0, maxItems)
    : [];
}

function escapeHtml(value: string) {
  return value.replace(
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

function chips(items: string[]) {
  return items
    .map(
      (item) =>
        `<span style="display:inline-block;margin:4px 6px 4px 0;padding:8px 12px;border-radius:999px;background:#f4f4f2;font-size:13px;font-weight:700;color:#222;">${escapeHtml(item)}</span>`,
    )
    .join("");
}

export default async function handler(
  request: any,
  response: any,
) {
  response.setHeader("Cache-Control", "no-store");
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

  const { RESEND_API_KEY } = process.env;

  if (!RESEND_API_KEY) {
    console.error("Missing RESEND_API_KEY for lead form");

    return response.status(500).json({
      error:
        "Η φόρμα δεν είναι διαθέσιμη αυτή τη στιγμή.",
    });
  }

  const body = (request.body ?? {}) as LeadBody;

  // Honeypot field. Real visitors never see it.
  if (text(body.website, 200)) {
    return response.status(200).json({
      success: true,
    });
  }

  const lead = {
    businessType: text(body.businessType, 120),
    goals: list(body.goals),
    placements: list(body.placements),
    quantity: text(body.quantity, 120),
    tracking: text(body.tracking, 180),
    customization: text(body.customization, 180),
    fullName: text(body.fullName, 120),
    businessName: text(body.businessName, 160),
    email: text(body.email, 180).toLowerCase(),
    phone: text(body.phone, 80),
    notes: text(body.notes, 1200),
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

        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr><td style="padding:12px 0;color:#888;width:180px;">Κατηγορία</td><td style="padding:12px 0;font-weight:700;">${escapeHtml(lead.businessType)}</td></tr>
          <tr><td style="padding:12px 0;color:#888;">Κάρτες</td><td style="padding:12px 0;font-weight:700;">${escapeHtml(lead.quantity)}</td></tr>
          <tr><td style="padding:12px 0;color:#888;">Tracking</td><td style="padding:12px 0;font-weight:700;">${escapeHtml(lead.tracking)}</td></tr>
          <tr><td style="padding:12px 0;color:#888;">Customization</td><td style="padding:12px 0;font-weight:700;">${escapeHtml(lead.customization)}</td></tr>
        </table>

        <div style="margin-top:24px;">
          <p style="margin:0 0 8px;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.14em;color:#888;">Στόχοι</p>
          <div>${chips(lead.goals)}</div>
        </div>

        <div style="margin-top:22px;">
          <p style="margin:0 0 8px;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.14em;color:#888;">Τοποθέτηση</p>
          <div>${chips(lead.placements)}</div>
        </div>

        <div style="margin-top:24px;padding:18px;border-radius:16px;background:#f7f5f1;">
          <p style="margin:0 0 8px;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.14em;color:#888;">Σημείωση</p>
          <p style="margin:0;white-space:pre-wrap;line-height:1.65;color:#444;">${escapeHtml(lead.notes || "—")}</p>
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
        <div style="margin-top:24px;padding:18px;border-radius:16px;background:#f7f5f1;">
          <p style="margin:0 0 8px;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.14em;color:#888;">Οι βασικές επιλογές σου</p>
          <p style="margin:0 0 6px;"><strong>${escapeHtml(lead.businessType)}</strong> · ${escapeHtml(lead.quantity)} κάρτες</p>
          <p style="margin:0;color:#555;">${escapeHtml(lead.tracking)} · ${escapeHtml(lead.customization)}</p>
        </div>
      </div>
    </div>
  `;

  try {
    const internalResponse = await fetch(
      "https://api.resend.com/emails",
      {
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
      },
    );

    const internalResult = await internalResponse.json();

    if (!internalResponse.ok) {
      console.error(
        "Lead notification email failed:",
        internalResult,
      );

      return response.status(502).json({
        error:
          "Δεν ήταν δυνατή η αποστολή της πρότασης.",
      });
    }

    const customerResponse = await fetch(
      "https://api.resend.com/emails",
      {
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
      },
    );

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
      error:
        "Κάτι πήγε στραβά. Δοκίμασε ξανά σε λίγο.",
    });
  }
}

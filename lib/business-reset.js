import { cancelAppointmentReminder } from "./appointment-reminders.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Called only after the API has verified the session and Zisto admin membership. */
export async function resetBusinessActivity(request, response, client, actorId, cancelReminder = cancelAppointmentReminder) {
  const body = request.body ?? {};
  const id = typeof body.id === "string" ? body.id.trim() : "";
  const confirmSlug = typeof body.confirm_slug === "string" ? body.confirm_slug.trim() : "";
  if (!UUID.test(id) || !confirmSlug || body.confirm_reset !== true) {
    return response.status(400).json({ error: "Επιβεβαίωσε την επαναφορά με το slug της επιχείρησης." });
  }

  const lookup = await client.from("businesses").select("id,name,slug").eq("id", id).maybeSingle();
  if (lookup.error) return response.status(500).json({ error: "Απέτυχε ο έλεγχος της επιχείρησης." });
  if (!lookup.data) return response.status(404).json({ error: "Η επιχείρηση δεν βρέθηκε." });
  if (lookup.data.slug !== confirmSlug) {
    return response.status(400).json({ error: "Το slug επιβεβαίωσης δεν ταιριάζει." });
  }

  // A cutoff preserves real activity that arrives while old reminders are being cancelled.
  const cutoff = new Date().toISOString();
  let cancelledReminders = 0;
  for (;;) {
    const pending = await client.from("appointments")
      .select("id,reminder_email_id,reminder_scheduled_for")
      .eq("business_id", id).lte("created_at", cutoff)
      .not("reminder_email_id", "is", null)
      .or("reminder_scheduled_for.is.null,reminder_scheduled_for.gt." + cutoff)
      .order("id", { ascending: true }).limit(50);
    if (pending.error) {
      return response.status(500).json({ error: "Απέτυχε ο έλεγχος των υπενθυμίσεων. Δεν έγινε επαναφορά." });
    }
    if (!pending.data?.length) break;
    for (const appointment of pending.data) {
      const cancellation = await cancelReminder(appointment);
      if (!cancellation.ok) {
        return response.status(502).json({ error: "Δεν ακυρώθηκαν όλες οι υπενθυμίσεις. Δεν διαγράφηκαν δεδομένα. Δοκίμασε ξανά." });
      }
      // Clearing each cancelled ID makes a retry safe if a later provider call fails.
      const cleared = await client.from("appointments")
        .update({ reminder_email_id: null, reminder_scheduled_for: null })
        .eq("business_id", id).eq("id", appointment.id)
        .eq("reminder_email_id", appointment.reminder_email_id)
        .select("id").maybeSingle();
      if (cleared.error || !cleared.data) {
        return response.status(409).json({ error: "Ένα ραντεβού άλλαξε κατά την επαναφορά. Δοκίμασε ξανά." });
      }
      cancelledReminders++;
    }
  }

  const result = await client.rpc("reset_business_activity", {
    p_business_id: id, p_confirm_slug: confirmSlug, p_actor_id: actorId, p_cutoff: cutoff,
  });
  if (result.error) {
    const code = result.error.code;
    const status = code === "P0002" ? 404 : code === "42501" ? 403 :
      ["22023", "P0001"].includes(code) ? 409 : 500;
    console.error("Business reset failed", { business_id: id, code });
    return response.status(status).json({ error: "Η επαναφορά δεν ολοκληρώθηκε. Έλεγξε την επιβεβαίωση και δοκίμασε ξανά." });
  }
  console.info("Business activity reset", { business_id: id, actor_id: actorId, deleted: result.data?.deleted });
  return response.status(200).json({ success: true, ...result.data, cancelled_reminders: cancelledReminders });
}

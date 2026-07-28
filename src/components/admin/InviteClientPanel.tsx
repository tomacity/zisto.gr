import {
  useState,
  type FormEvent,
} from "react";
import { supabase } from "../../lib/supabase";

type Business = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  created_at: string;
  updated_at: string;
};

type InviteRole = "owner" | "manager" | "staff";

export function InviteClientPanel({
  businesses,
}: {
  businesses: Business[];
}) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [businessId, setBusinessId] = useState(
    businesses[0]?.id ?? "",
  );
  const [role, setRole] =
    useState<InviteRole>("owner");

  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] =
    useState("");
  const [errorMessage, setErrorMessage] =
    useState("");

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    try {
      setLoading(true);
      setSuccessMessage("");
      setErrorMessage("");

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      if (!session) {
        window.location.hash = "/login";
        return;
      }

      const response = await fetch(
        "/api/admin/invite",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization:
              `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            email: email.trim(),
            full_name: fullName.trim(),
            business_id: businessId,
            role,
          }),
        },
      );

      const result = await response.json();

      if (response.status === 401) {
        await supabase.auth.signOut();
        window.location.hash = "/login";
        return;
      }

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Δεν ήταν δυνατή η αποστολή της πρόσκλησης.",
        );
      }

      const selectedBusiness =
        businesses.find(
          (business) => business.id === businessId,
        );

      setSuccessMessage(
        `Η πρόσκληση στάλθηκε στο ${email.trim()} για την επιχείρηση ${
          selectedBusiness?.name ?? ""
        }.`,
      );

      setEmail("");
      setFullName("");
      setRole("owner");
    } catch (error) {
      console.error("Invite client failed:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Δεν ήταν δυνατή η αποστολή της πρόσκλησης.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (businesses.length === 0) {
    return (
      <div className="rounded-[24px] border border-dashed border-black/15 bg-[#F7F5F1] p-8 text-center">
        <h3 className="text-2xl font-black tracking-[-0.03em]">
          Δεν υπάρχει διαθέσιμη επιχείρηση
        </h3>

        <p className="mt-3 text-sm leading-6 text-[#666]">
          Πρέπει πρώτα να υπάρχει μία επιχείρηση πριν
          προσκαλέσεις client.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <form
        onSubmit={handleSubmit}
        className="rounded-[28px] border border-black/10 bg-white p-6 sm:p-8"
      >
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#DC2727]">
            New invitation
          </p>

          <h3 className="mt-3 text-3xl font-black tracking-[-0.04em]">
            Πρόσκληση νέου client
          </h3>

          <p className="mt-3 max-w-xl text-sm leading-6 text-[#666]">
            Ο client θα λάβει email, θα δημιουργήσει
            τον κωδικό του και θα συνδεθεί με την
            επιλεγμένη επιχείρηση.
          </p>
        </div>

        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#777]">
              Ονοματεπώνυμο
            </span>

            <input
              type="text"
              value={fullName}
              onChange={(event) =>
                setFullName(event.target.value)
              }
              placeholder="π.χ. Μυρσίνη Παπαδοπούλου"
              className="mt-3 w-full rounded-2xl border border-black/10 bg-[#F7F5F1] px-4 py-4 text-sm font-medium outline-none transition focus:border-[#222] focus:bg-white"
            />
          </label>

          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#777]">
              Email
            </span>

            <input
              type="email"
              required
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              placeholder="client@business.gr"
              className="mt-3 w-full rounded-2xl border border-black/10 bg-[#F7F5F1] px-4 py-4 text-sm font-medium outline-none transition focus:border-[#222] focus:bg-white"
            />
          </label>

          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#777]">
              Επιχείρηση
            </span>

            <select
              required
              value={businessId}
              onChange={(event) =>
                setBusinessId(event.target.value)
              }
              className="mt-3 w-full rounded-2xl border border-black/10 bg-[#F7F5F1] px-4 py-4 text-sm font-bold outline-none transition focus:border-[#222] focus:bg-white"
            >
              {businesses.map((business) => (
                <option
                  key={business.id}
                  value={business.id}
                >
                  {business.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#777]">
              Ρόλος
            </span>

            <select
              value={role}
              onChange={(event) =>
                setRole(
                  event.target.value as InviteRole,
                )
              }
              className="mt-3 w-full rounded-2xl border border-black/10 bg-[#F7F5F1] px-4 py-4 text-sm font-bold outline-none transition focus:border-[#222] focus:bg-white"
            >
              <option value="owner">
                Owner
              </option>

              <option value="manager">
                Manager
              </option>

              <option value="staff">
                Staff
              </option>
            </select>
          </label>
        </div>

        {errorMessage && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 px-5 py-4 text-sm font-semibold text-green-700">
            {successMessage}
          </div>
        )}

        <button
          type="submit"
          disabled={
            loading ||
            !email.trim() ||
            !businessId
          }
          className="mt-8 flex w-full items-center justify-between rounded-2xl bg-[#222] px-6 py-4 text-sm font-bold text-white transition hover:bg-[#DC2727] disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto sm:min-w-[240px]"
        >
          <span>
            {loading
              ? "Αποστολή..."
              : "Αποστολή πρόσκλησης"}
          </span>

          <span>→</span>
        </button>
      </form>

      <aside className="rounded-[28px] bg-[#222] p-7 text-white">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/40">
          Invitation flow
        </p>

        <h3 className="mt-4 text-2xl font-black tracking-[-0.03em]">
          Τι θα συμβεί μετά;
        </h3>

        <div className="mt-8 space-y-6">
          {[
            [
              "01",
              "Αποστολή email",
              "Ο client λαμβάνει το invitation link.",
            ],
            [
              "02",
              "Δημιουργία κωδικού",
              "Ορίζει τον προσωπικό κωδικό πρόσβασής του.",
            ],
            [
              "03",
              "Σύνδεση",
              "Μπαίνει στο dashboard της επιχείρησής του.",
            ],
          ].map(([number, title, description]) => (
            <div
              key={number}
              className="border-t border-white/10 pt-5"
            >
              <p className="font-mono text-[10px] text-[#DC2727]">
                {number}
              </p>

              <p className="mt-2 text-sm font-bold">
                {title}
              </p>

              <p className="mt-2 text-xs leading-5 text-white/50">
                {description}
              </p>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}

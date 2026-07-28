import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type AdminTab =
  | "home"
  | "businesses"
  | "clients"
  | "invitations"
  | "invite";

type Business = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  created_at: string;
  updated_at: string;
};

export function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [error, setError] = useState("");
  const [activeAdminTab, setActiveAdminTab] =
  useState<AdminTab>("home");
  
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [businessesLoading, setBusinessesLoading] = useState(false);
  const [businessesError, setBusinessesError] = useState("");

  useEffect(() => {
    let active = true;

    async function verifyAdmin() {
      try {
        setLoading(true);
        setError("");

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

        const response = await fetch("/api/admin/me", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        const result = await response.json();

        if (!response.ok || !result.isAdmin) {
          if (active) {
            setIsAdmin(false);
            setError(
              result.error ||
                "Δεν έχεις δικαίωμα πρόσβασης στο Zisto Admin.",
            );
          }

          return;
        }

        if (active) {
          setIsAdmin(true);
          setAdminEmail(
            result.user?.email ??
              session.user.email ??
              "",
          );
        }
      } catch (verificationError) {
        console.error(
          "Admin verification failed:",
          verificationError,
        );

        if (active) {
          setIsAdmin(false);
          setError(
            "Δεν ήταν δυνατή η επαλήθευση του λογαριασμού διαχειριστή.",
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    verifyAdmin();

    return () => {
      active = false;
    };
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.hash = "/login";
  }

  useEffect(() => {
  if (!isAdmin || activeAdminTab !== "businesses") {
    return;
  }

  let active = true;

  async function loadBusinesses() {
    try {
      setBusinessesLoading(true);
      setBusinessesError("");

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

      const response = await fetch("/api/admin/businesses", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const result = await response.json();

      if (response.status === 401) {
        await supabase.auth.signOut();
        window.location.hash = "/login";
        return;
      }

      if (!response.ok) {
        throw new Error(
          result.error || "Could not load businesses",
        );
      }

      if (active) {
        setBusinesses(result.businesses ?? []);
      }
    } catch (loadError) {
      console.error("Businesses loading failed:", loadError);

      if (active) {
        setBusinessesError(
          loadError instanceof Error
            ? loadError.message
            : "Δεν ήταν δυνατή η φόρτωση των επιχειρήσεων.",
        );
      }
    } finally {
      if (active) {
        setBusinessesLoading(false);
      }
    }
  }

  loadBusinesses();

  return () => {
    active = false;
  };
}, [isAdmin, activeAdminTab]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F7F5F1] px-6">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-[#222] border-t-transparent" />

          <p className="mt-5 text-sm font-medium text-[#666]">
            Έλεγχος πρόσβασης διαχειριστή...
          </p>
        </div>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F7F5F1] px-6">
        <div className="w-full max-w-md rounded-[32px] border border-black/10 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-2xl">
            🔒
          </div>

          <p className="mt-6 text-xs font-bold uppercase tracking-[0.25em] text-[#DC2727]">
            Access denied
          </p>

          <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] text-[#222]">
            Δεν έχεις πρόσβαση
          </h1>

          <p className="mt-4 text-sm leading-6 text-[#666]">
            {error}
          </p>

          <button
            type="button"
            onClick={() => {
              window.location.hash = "/dashboard";
            }}
            className="mt-8 w-full rounded-2xl bg-[#222] px-5 py-4 text-sm font-bold text-white transition hover:bg-[#DC2727]"
          >
            Επιστροφή στο dashboard
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="mt-3 w-full rounded-2xl border border-black/10 px-5 py-4 text-sm font-bold text-[#222] transition hover:border-[#222]"
          >
            Αποσύνδεση
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F7F5F1] px-5 py-6 text-[#222] sm:px-8 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-6 border-b border-black/10 pb-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <button
              type="button"
              onClick={() => setActiveAdminTab("home")}
              className="text-left"
            >
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#DC2727]">
                Zisto Admin
              </p>

              <h1 className="mt-3 text-4xl font-black tracking-[-0.05em] sm:text-5xl lg:text-6xl">
                Platform Dashboard
              </h1>
            </button>

            <p className="mt-4 max-w-2xl text-sm leading-6 text-[#666] sm:text-base">
              Διαχείριση επιχειρήσεων, clients, invitations
              και smart links.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden rounded-2xl border border-black/10 bg-white px-4 py-3 sm:block">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#999]">
                Logged in as
              </p>

              <p className="mt-1 text-sm font-semibold">
                {adminEmail}
              </p>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="rounded-2xl border border-black/10 bg-white px-5 py-4 text-sm font-bold transition hover:border-[#222]"
            >
              Αποσύνδεση
            </button>
          </div>
        </header>

        <section className="mt-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <AdminCard
            eyebrow="Management"
            title="Επιχειρήσεις"
            description="Δημιουργία και διαχείριση όλων των businesses του Zisto."
            onClick={() => setActiveAdminTab("businesses")}
          />

          <AdminCard
            eyebrow="Accounts"
            title="Clients"
            description="Όλοι οι πελάτες και οι επιχειρήσεις στις οποίες έχουν πρόσβαση."
            onClick={() => setActiveAdminTab("clients")}
          />

          <AdminCard
            eyebrow="Invitations"
            title="Προσκλήσεις"
            description="Έλεγχος ενεργών, ολοκληρωμένων και εκκρεμών invitations."
            onClick={() => setActiveAdminTab("invitations")}
          />

          <AdminCard
            eyebrow="New client"
            title="+ Invite Client"
            description="Στείλε invitation email και σύνδεσε τον client με την επιχείρησή του."
            onClick={() => setActiveAdminTab("invite")}
            dark
          />
        </section>

        {activeAdminTab !== "home" && (
          <section className="mt-10 rounded-[32px] border border-black/10 bg-white p-6 sm:p-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#DC2727]">
                  Admin workspace
                </p>

                <h2 className="mt-3 text-3xl font-black tracking-[-0.04em]">
                  {activeAdminTab === "businesses" &&
                    "Επιχειρήσεις"}

                  {activeAdminTab === "clients" &&
                    "Clients"}

                  {activeAdminTab === "invitations" &&
                    "Προσκλήσεις"}

                  {activeAdminTab === "invite" &&
                    "Πρόσκληση Client"}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setActiveAdminTab("home")}
                className="rounded-2xl border border-black/10 px-4 py-3 text-sm font-bold transition hover:border-[#222]"
              >
                Κλείσιμο
              </button>
            </div>

            {activeAdminTab === "businesses" && (
              <BusinessesPanel
                businesses={businesses}
                loading={businessesLoading}
                error={businessesError}
              />
            )}

              {activeAdminTab === "clients" && (
                <AdminPlaceholder
                  title="Δεν υπάρχουν ακόμη clients"
                  description="Οι clients που θα προσκαλείς θα εμφανίζονται εδώ."
                />
              )}

              {activeAdminTab === "invitations" && (
                <AdminPlaceholder
                  title="Δεν υπάρχουν ακόμη προσκλήσεις"
                  description="Εδώ θα βλέπεις την κατάσταση κάθε invitation."
                />
              )}

              {activeAdminTab === "invite" && (
                <AdminPlaceholder
                  title="Invite Client"
                  description="Η πραγματική φόρμα πρόσκλησης θα προστεθεί αφού δημιουργήσουμε τη διαχείριση επιχειρήσεων."
                />
              )}
          </section>
        )}
      </div>
    </main>
  );
}

function AdminCard({
  eyebrow,
  title,
  description,
  onClick,
  dark = false,
}: {
  eyebrow: string;
  title: string;
  description: string;
  onClick: () => void;
  dark?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group min-h-[210px] rounded-[28px] p-7 text-left transition hover:-translate-y-1 hover:shadow-lg ${
        dark
          ? "bg-[#222] text-white hover:bg-[#DC2727]"
          : "border border-black/10 bg-white text-[#222] hover:border-[#222]"
      }`}
    >
      <p
        className={`text-xs font-bold uppercase tracking-[0.22em] ${
          dark ? "text-white/50" : "text-[#999]"
        }`}
      >
        {eyebrow}
      </p>

      <h2 className="mt-6 text-2xl font-black tracking-[-0.03em]">
        {title}
      </h2>

      <p
        className={`mt-3 text-sm leading-6 ${
          dark ? "text-white/70" : "text-[#666]"
        }`}
      >
        {description}
      </p>

      <p className="mt-7 text-sm font-bold transition group-hover:translate-x-1">
        Προβολή →
      </p>
    </button>
  );
}

function BusinessesPanel({
  businesses,
  loading,
  error,
}: {
  businesses: Business[];
  loading: boolean;
  error: string;
}) {
  if (loading) {
    return (
      <div className="rounded-[24px] border border-black/10 bg-[#F7F5F1] p-10 text-center">
        <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-[#222] border-t-transparent" />

        <p className="mt-4 text-sm font-medium text-[#666]">
          Φόρτωση επιχειρήσεων...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-[24px] border border-red-200 bg-red-50 p-8 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#DC2727]">
          Loading error
        </p>

        <h3 className="mt-4 text-2xl font-black tracking-[-0.03em]">
          Δεν φορτώθηκαν οι επιχειρήσεις
        </h3>

        <p className="mt-3 text-sm text-red-700">
          {error}
        </p>
      </div>
    );
  }

  if (businesses.length === 0) {
    return (
      <div className="rounded-[24px] border border-dashed border-black/15 bg-[#F7F5F1] p-8 text-center">
        <h3 className="text-2xl font-black tracking-[-0.03em]">
          Δεν υπάρχει επιχείρηση
        </h3>

        <p className="mt-3 text-sm text-[#666]">
          Δεν βρέθηκε κάποια εγγραφή στον πίνακα businesses.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#DC2727]">
            Live businesses
          </p>

          <p className="mt-2 text-sm text-[#666]">
            {businesses.length} ενεργή επιχείρηση
          </p>
        </div>

        <button
          type="button"
          disabled
          className="cursor-not-allowed rounded-2xl bg-[#222] px-6 py-4 text-sm font-bold text-white opacity-40"
        >
          + Νέα Επιχείρηση
        </button>
      </div>

      <div className="grid gap-5">
        {businesses.map((business) => (
          <article
            key={business.id}
            className="overflow-hidden rounded-[28px] border border-black/10 bg-white"
          >
            <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-2 rounded-full bg-green-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-green-700">
                    <span className="h-2 w-2 rounded-full bg-green-500" />
                    Active
                  </span>

                  <span className="rounded-full bg-[#F7F5F1] px-3 py-1.5 font-mono text-[10px] font-bold text-[#666]">
                    /{business.slug}
                  </span>
                </div>

                <h3 className="mt-5 text-2xl font-black tracking-[-0.04em] sm:text-3xl">
                  {business.name}
                </h3>

                <div className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
                  <div className="rounded-2xl bg-[#F7F5F1] p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#999]">
                      Timezone
                    </p>

                    <p className="mt-2 font-semibold">
                      {business.timezone}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-[#F7F5F1] p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#999]">
                      Analytics
                    </p>

                    <p className="mt-2 flex items-center gap-2 font-semibold">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-[#DC2727]" />
                      Live
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  window.location.hash = `/dashboard?business=${business.id}`;
                }}
                className="w-full rounded-2xl bg-[#222] px-7 py-4 text-sm font-bold text-white transition hover:bg-[#DC2727] lg:w-auto"
              >
                Άνοιγμα Dashboard →
              </button>
            </div>

            <div className="border-t border-black/8 bg-[#F7F5F1] px-6 py-4 sm:px-8">
              <p className="font-mono text-[10px] text-[#999]">
                Business ID: {business.id}
              </p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function AdminPlaceholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[24px] border border-dashed border-black/15 bg-[#F7F5F1] p-8 text-center">
      <h3 className="text-2xl font-black tracking-[-0.03em]">
        {title}
      </h3>

      <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-[#666]">
        {description}
      </p>
    </div>
  );
}

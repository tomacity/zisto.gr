import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { InviteClientPanel } from "../components/admin/InviteClientPanel";

type AdminTab =
  | "home"
  | "businesses"
  | "projects"
  | "clients"
  | "invitations"
  | "invite";

type Business = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
};

type ConnectedProject = {
  id: string;
  business_id: string;
  name: string;
  live_url: string;
  github_url: string | null;
  project_key: string;
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
  businesses:
    | {
        id: string;
        name: string;
        slug: string;
      }
    | {
        id: string;
        name: string;
        slug: string;
      }[]
    | null;
};

type Client = {
  id: string;
  email: string;
  full_name: string;
  role: "owner" | "manager" | "staff";
  business_id: string;
  business: {
    id: string;
    name: string;
    slug: string;
  } | null;
  created_at: string | null;
  last_sign_in_at: string | null;
  invited_at: string | null;
  email_confirmed_at: string | null;
  status: "active" | "invited";
};

type Invitation = {
  id: string;
  email: string;
  full_name: string | null;
  role: "owner" | "manager" | "staff";
  status:
    | "pending"
    | "accepted"
    | "expired"
    | "failed"
    | "cancelled";
  email_id: string | null;
  error_message: string | null;
  expires_at: string | null;
  accepted_at: string | null;
  created_at: string;
  business_id: string;
  businesses:
    | {
        id: string;
        name: string;
        slug: string;
      }
    | {
        id: string;
        name: string;
        slug: string;
      }[]
    | null;
};

export function AdminPage() {
  const [projects, setProjects] =
    useState<ConnectedProject[]>([]);
  
  const [projectsLoading, setProjectsLoading] =
    useState(false);
  
  const [projectsError, setProjectsError] =
    useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [clientsError, setClientsError] = useState("");
  const [invitations, setInvitations] =
  useState<Invitation[]>([]);

const [invitationsLoading, setInvitationsLoading] =
  useState(false);

const [invitationsError, setInvitationsError] =
  useState("");
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
    if (!isAdmin || activeAdminTab !== "projects") {
      return;
    }
  
    let active = true;
  
    async function loadProjects() {
      try {
        setProjectsLoading(true);
        setProjectsError("");
  
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
          "/api/admin/projects",
          {
            method: "GET",
            headers: {
              Authorization:
                `Bearer ${session.access_token}`,
            },
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
              "Could not load connected projects",
          );
        }
  
        if (active) {
          setProjects(result.projects ?? []);
        }
      } catch (loadError) {
        console.error(
          "Connected projects loading failed:",
          loadError,
        );
  
        if (active) {
          setProjectsError(
            loadError instanceof Error
              ? loadError.message
              : "Δεν ήταν δυνατή η φόρτωση των projects.",
          );
        }
      } finally {
        if (active) {
          setProjectsLoading(false);
        }
      }
    }
  
    loadProjects();
  
    return () => {
      active = false;
    };
  }, [isAdmin, activeAdminTab]);

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

useEffect(() => {
  if (!isAdmin || activeAdminTab !== "clients") {
    return;
  }

  let active = true;

  async function loadClients() {
    try {
      setClientsLoading(true);
      setClientsError("");

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

      const response = await fetch("/api/admin/clients", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        cache: "no-store",
      });

      const result = await response.json();

      if (response.status === 401) {
        await supabase.auth.signOut();
        window.location.hash = "/login";
        return;
      }

      if (!response.ok) {
        throw new Error(
          result.error || "Could not load clients",
        );
      }

      if (active) {
        setClients(result.clients ?? []);
      }
    } catch (error) {
      console.error("Clients loading failed:", error);

      if (active) {
        setClientsError(
          error instanceof Error
            ? error.message
            : "Δεν ήταν δυνατή η φόρτωση των clients.",
        );
      }
    } finally {
      if (active) {
        setClientsLoading(false);
      }
    }
  }

  loadClients();

  return () => {
    active = false;
  };
}, [isAdmin, activeAdminTab]);

useEffect(() => {
  if (!isAdmin || activeAdminTab !== "invitations") {
    return;
  }

  let active = true;

  async function loadInvitations() {
    try {
      setInvitationsLoading(true);
      setInvitationsError("");

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
        "/api/admin/invitations",
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          cache: "no-store",
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
            "Could not load invitations",
        );
      }

      if (active) {
        setInvitations(result.invitations ?? []);
      }
    } catch (error) {
      console.error(
        "Invitations loading failed:",
        error,
      );

      if (active) {
        setInvitationsError(
          error instanceof Error
            ? error.message
            : "Δεν ήταν δυνατή η φόρτωση των προσκλήσεων.",
        );
      }
    } finally {
      if (active) {
        setInvitationsLoading(false);
      }
    }
  }

  loadInvitations();

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

        <section className="mt-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-5">
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
            eyebrow="Custom projects"
            title="Projects"
            description="Σύνδεση ανεξάρτητων React και Vite landing pages με το Zisto."
            onClick={() => setActiveAdminTab("projects")}
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

                  {activeAdminTab === "projects" &&
                    "Connected Projects"}

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
              onBusinessCreated={(business) => {
                setBusinesses((currentBusinesses) => [
                  business,
                  ...currentBusinesses,
                ]);
              }}
              onBusinessUpdated={(updatedBusiness) => {
                setBusinesses((currentBusinesses) =>
                  currentBusinesses.map((business) =>
                    business.id === updatedBusiness.id
                      ? updatedBusiness
                      : business,
                  ),
                );
              }}
              onBusinessDeleted={(businessId) => {
                setBusinesses((currentBusinesses) =>
                  currentBusinesses.filter(
                    (business) => business.id !== businessId,
                  ),
                );
              }}
            />
            )}

            {activeAdminTab === "clients" && (
              <ClientsPanel
                clients={clients}
                loading={clientsLoading}
                error={clientsError}
                onClientRoleChanged={(
                  userId,
                  businessId,
                  role,
                ) => {
                  setClients((currentClients) =>
                    currentClients.map((client) =>
                      client.id === userId &&
                      client.business_id === businessId
                        ? {
                            ...client,
                            role,
                          }
                        : client,
                    ),
                  );
                }}
                onClientRemoved={(userId, businessId) => {
                  setClients((currentClients) =>
                    currentClients.filter(
                      (client) =>
                        !(
                          client.id === userId &&
                          client.business_id === businessId
                        ),
                    ),
                  );
                }}
              />
            )}

            {activeAdminTab === "projects" && (
              <ProjectsPanel
                projects={projects}
                businesses={businesses}
                loading={projectsLoading}
                error={projectsError}
                onProjectCreated={(project) => {
                  setProjects((currentProjects) => [
                    project,
                    ...currentProjects,
                  ]);
                }}
              />
            )}

            {activeAdminTab === "invitations" && (
              <InvitationsPanel
                invitations={invitations}
                loading={invitationsLoading}
                error={invitationsError}
                onInvitationUpdated={(updatedInvitation) => {
                  setInvitations((currentInvitations) =>
                    currentInvitations.map((invitation) =>
                      invitation.id === updatedInvitation.id
                        ? updatedInvitation
                        : invitation,
                    ),
                  );
                }}
              />
            )}

              {activeAdminTab === "invite" && (
                <InviteClientPanel
                  businesses={businesses}
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
  onBusinessCreated,
  onBusinessUpdated,
}: {
  businesses: Business[];
  loading: boolean;
  error: string;
  onBusinessCreated: (business: Business) => void;
  onBusinessUpdated: (business: Business) => void;
}) {
  const [showCreateForm, setShowCreateForm] = useState(false);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [timezone, setTimezone] = useState("Europe/Athens");
  const [status, setStatus] =
    useState<Business["status"]>("active");

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [editingBusinessId, setEditingBusinessId] =
    useState<string | null>(null);
  
  const [editName, setEditName] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editTimezone, setEditTimezone] =
    useState("Europe/Athens");
  
  const [editStatus, setEditStatus] =
    useState<Business["status"]>("active");
  
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  const [deletingBusiness, setDeletingBusiness] =
    useState<Business | null>(null);
  
  const [deleteConfirmation, setDeleteConfirmation] =
    useState("");
  const [deleteSaving, setDeleteSaving] =
    useState(false);
  const [deleteError, setDeleteError] =
    useState("");

  function generateSlug(value: string) {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\u0370-\u03ff]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/-+/g, "-");
  }

  function resetForm() {
    setName("");
    setSlug("");
    setTimezone("Europe/Athens");
    setStatus("active");
    setFormError("");
    setSuccessMessage("");
  }

  function closeCreateForm() {
    resetForm();
    setShowCreateForm(false);
  }

  async function createBusiness(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    try {
      setSaving(true);
      setFormError("");
      setSuccessMessage("");

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
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
          timezone: timezone.trim(),
          status,
        }),
      });

      const result = await response.json();

      if (response.status === 401) {
        await supabase.auth.signOut();
        window.location.hash = "/login";
        return;
      }

      if (!response.ok) {
        throw new Error(
          result.error || "Could not create business",
        );
      }

      onBusinessCreated(result.business);

      setSuccessMessage(
        "Η επιχείρηση δημιουργήθηκε επιτυχώς.",
      );

      setName("");
      setSlug("");
      setTimezone("Europe/Athens");
      setStatus("active");

      window.setTimeout(() => {
        setShowCreateForm(false);
        setSuccessMessage("");
      }, 900);
    } catch (createError) {
      console.error(
        "Business creation failed:",
        createError,
      );

      setFormError(
        createError instanceof Error
          ? createError.message
          : "Δεν ήταν δυνατή η δημιουργία της επιχείρησης.",
      );
    } finally {
      setSaving(false);
    }
  }

  function startEditingBusiness(business: Business) {
  setEditingBusinessId(business.id);
  setEditName(business.name);
  setEditSlug(business.slug);
  setEditTimezone(business.timezone);
  setEditStatus(business.status);
  setEditError("");
}

function cancelEditingBusiness() {
  setEditingBusinessId(null);
  setEditName("");
  setEditSlug("");
  setEditTimezone("Europe/Athens");
  setEditStatus("active");
  setEditError("");
}

async function updateBusiness(
  businessId: string,
) {
  try {
    setEditSaving(true);
    setEditError("");

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
      "/api/admin/businesses",
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          id: businessId,
          name: editName.trim(),
          slug: editSlug.trim(),
          timezone: editTimezone.trim(),
          status: editStatus,
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
        result.error || "Could not update business",
      );
    }

    onBusinessUpdated(result.business);
    cancelEditingBusiness();
  } catch (updateError) {
    console.error(
      "Business update failed:",
      updateError,
    );

    setEditError(
      updateError instanceof Error
        ? updateError.message
        : "Δεν ήταν δυνατή η ενημέρωση της επιχείρησης.",
    );
  } finally {
    setEditSaving(false);
  }
}

  function startDeletingBusiness(business: Business) {
    setDeletingBusiness(business);
    setDeleteConfirmation("");
    setDeleteError("");
  }
  
  function cancelDeletingBusiness() {
    if (deleteSaving) {
      return;
    }
  
    setDeletingBusiness(null);
    setDeleteConfirmation("");
    setDeleteError("");
  }
  
  async function deleteBusiness() {
    if (!deletingBusiness) {
      return;
    }
  
    try {
      setDeleteSaving(true);
      setDeleteError("");
  
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
        "/api/admin/businesses",
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            id: deletingBusiness.id,
            confirm_slug: deleteConfirmation.trim(),
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
          result.error || "Could not delete business",
        );
      }
  
      onBusinessDeleted(deletingBusiness.id);
      cancelDeletingBusiness();
    } catch (deleteBusinessError) {
      console.error(
        "Business deletion failed:",
        deleteBusinessError,
      );
  
      setDeleteError(
        deleteBusinessError instanceof Error
          ? deleteBusinessError.message
          : "Δεν ήταν δυνατή η διαγραφή της επιχείρησης.",
      );
    } finally {
      setDeleteSaving(false);
    }
  }
  
  const activeBusinesses = businesses.filter(
    (business) => business.status === "active",
  ).length;

  if (loading) {
    return (
      <div className="mt-8 rounded-[24px] border border-black/10 bg-[#F7F5F1] p-10 text-center">
        <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-[#222] border-t-transparent" />

        <p className="mt-4 text-sm font-medium text-[#666]">
          Φόρτωση επιχειρήσεων...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-8 rounded-[24px] border border-red-200 bg-red-50 p-8 text-center">
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

  return (
    <div className="mt-8 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#DC2727]">
            Businesses
          </p>

          <p className="mt-2 text-sm text-[#666]">
            {businesses.length} συνολικά ·{" "}
            {activeBusinesses} ενεργές
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setFormError("");
            setSuccessMessage("");
            setShowCreateForm((current) => !current);
          }}
          className="rounded-2xl bg-[#222] px-6 py-4 text-sm font-bold text-white transition hover:bg-[#DC2727]"
        >
          {showCreateForm
            ? "Κλείσιμο φόρμας"
            : "+ Νέα Επιχείρηση"}
        </button>
      </div>

      {showCreateForm && (
        <form
          onSubmit={createBusiness}
          className="rounded-[28px] border border-black/10 bg-[#F7F5F1] p-6 sm:p-8"
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#DC2727]">
              Create business
            </p>

            <h3 className="mt-3 text-2xl font-black tracking-[-0.04em]">
              Νέα Επιχείρηση
            </h3>

            <p className="mt-2 text-sm leading-6 text-[#666]">
              Δημιούργησε μία νέα επιχείρηση στο Zisto.
              Ο client μπορεί να προστεθεί αργότερα μέσω
              πρόσκλησης.
            </p>
          </div>

          <div className="mt-7 grid gap-5 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#666]">
                Business name
              </span>

              <input
                type="text"
                value={name}
                onChange={(event) => {
                  const nextName = event.target.value;

                  setName(nextName);

                  if (!slug) {
                    setSlug(generateSlug(nextName));
                  }
                }}
                required
                maxLength={120}
                placeholder="π.χ. Το Τσιπουράδικο της Μυρσίνης"
                className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-4 py-4 text-sm outline-none transition placeholder:text-[#AAA] focus:border-[#222]"
              />
            </label>

            <label className="block">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#666]">
                Slug
              </span>

              <div className="mt-2 flex overflow-hidden rounded-2xl border border-black/10 bg-white focus-within:border-[#222]">
                <span className="flex items-center border-r border-black/10 bg-[#EFEDE8] px-4 font-mono text-sm text-[#888]">
                  /
                </span>

                <input
                  type="text"
                  value={slug}
                  onChange={(event) => {
                    setSlug(
                      generateSlug(event.target.value),
                    );
                  }}
                  required
                  maxLength={100}
                  placeholder="business-slug"
                  className="min-w-0 flex-1 bg-white px-4 py-4 font-mono text-sm outline-none"
                />
              </div>
            </label>

            <label className="block">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#666]">
                Timezone
              </span>

              <select
                value={timezone}
                onChange={(event) =>
                  setTimezone(event.target.value)
                }
                className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-4 py-4 text-sm outline-none transition focus:border-[#222]"
              >
                <option value="Europe/Athens">
                  Europe/Athens
                </option>

                <option value="Europe/London">
                  Europe/London
                </option>

                <option value="Europe/Paris">
                  Europe/Paris
                </option>

                <option value="America/New_York">
                  America/New_York
                </option>

                <option value="America/Los_Angeles">
                  America/Los_Angeles
                </option>
              </select>
            </label>

            <label className="block sm:col-span-2">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#666]">
                Status
              </span>

              <select
                value={status}
                onChange={(event) =>
                  setStatus(
                    event.target.value as Business["status"],
                  )
                }
                className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-4 py-4 text-sm outline-none transition focus:border-[#222]"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
          </div>

          {formError && (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-semibold text-red-700">
                {formError}
              </p>
            </div>
          )}

          {successMessage && (
            <div className="mt-5 rounded-2xl border border-green-200 bg-green-50 p-4">
              <p className="text-sm font-semibold text-green-700">
                {successMessage}
              </p>
            </div>
          )}

          <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={closeCreateForm}
              disabled={saving}
              className="rounded-2xl border border-black/10 bg-white px-6 py-4 text-sm font-bold transition hover:border-[#222] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Ακύρωση
            </button>

            <button
              type="submit"
              disabled={
                saving ||
                !name.trim() ||
                !slug.trim() ||
                !timezone.trim()
              }
              className="rounded-2xl bg-[#222] px-6 py-4 text-sm font-bold text-white transition hover:bg-[#DC2727] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving
                ? "Δημιουργία..."
                : "Δημιουργία Επιχείρησης"}
            </button>
          </div>
        </form>
      )}

      {businesses.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-black/15 bg-[#F7F5F1] p-8 text-center">
          <h3 className="text-2xl font-black tracking-[-0.03em]">
            Δεν υπάρχει επιχείρηση
          </h3>

          <p className="mt-3 text-sm text-[#666]">
            Πάτησε «+ Νέα Επιχείρηση» για να δημιουργήσεις
            την πρώτη επιχείρηση.
          </p>
        </div>
      ) : (
        <div className="grid gap-5">
          {businesses.map((business) => {
            const isActive =
              business.status === "active";

            return (
              <article
                key={business.id}
                className="overflow-hidden rounded-[28px] border border-black/10 bg-white"
              >
                <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <span
                        className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] ${
                          isActive
                            ? "bg-green-50 text-green-700"
                            : "bg-black/5 text-[#777]"
                        }`}
                      >
                        <span
                          className={`h-2 w-2 rounded-full ${
                            isActive
                              ? "bg-green-500"
                              : "bg-[#999]"
                          }`}
                        />

                        {isActive
                          ? "Active"
                          : "Inactive"}
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
                          <span
                            className={`h-2 w-2 rounded-full ${
                              isActive
                                ? "animate-pulse bg-[#DC2727]"
                                : "bg-[#999]"
                            }`}
                          />

                          {isActive
                            ? "Live"
                            : "Paused"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex w-full flex-col gap-3 lg:w-auto">
                    <button
                      type="button"
                      onClick={() =>
                        startEditingBusiness(business)
                      }
                      className="w-full rounded-2xl border border-black/10 bg-white px-7 py-4 text-sm font-bold transition hover:border-[#222] lg:w-auto"
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        startDeletingBusiness(business)
                      }
                      className="w-full rounded-2xl border border-red-200 bg-red-50 px-7 py-4 text-sm font-bold text-[#DC2727] transition hover:border-[#DC2727] lg:w-auto"
                    >
                      Delete
                    </button>
                  
                    <button
                      type="button"
                      onClick={() => {
                        window.location.hash =
                          `/dashboard?business=${business.id}`;
                      }}
                      className="w-full rounded-2xl bg-[#222] px-7 py-4 text-sm font-bold text-white transition hover:bg-[#DC2727] lg:w-auto"
                    >
                      Άνοιγμα Dashboard →
                    </button>
                  </div>
                </div>

                {editingBusinessId === business.id && (
                <div className="border-t border-black/10 bg-white p-6 sm:p-8">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#DC2727]">
                      Edit business
                    </p>
              
                    <h4 className="mt-3 text-2xl font-black tracking-[-0.04em]">
                      Επεξεργασία Επιχείρησης
                    </h4>
                  </div>
              
                  <div className="mt-6 grid gap-5 sm:grid-cols-2">
                    <label className="block sm:col-span-2">
                      <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#666]">
                        Business name
                      </span>
              
                      <input
                        type="text"
                        value={editName}
                        onChange={(event) =>
                          setEditName(event.target.value)
                        }
                        maxLength={120}
                        className="mt-2 w-full rounded-2xl border border-black/10 bg-[#F7F5F1] px-4 py-4 text-sm outline-none transition focus:border-[#222]"
                      />
                    </label>
              
                    <label className="block">
                      <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#666]">
                        Slug
                      </span>
              
                      <div className="mt-2 flex overflow-hidden rounded-2xl border border-black/10 bg-[#F7F5F1] focus-within:border-[#222]">
                        <span className="flex items-center border-r border-black/10 px-4 font-mono text-sm text-[#888]">
                          /
                        </span>
              
                        <input
                          type="text"
                          value={editSlug}
                          onChange={(event) =>
                            setEditSlug(
                              generateSlug(event.target.value),
                            )
                          }
                          maxLength={100}
                          className="min-w-0 flex-1 bg-transparent px-4 py-4 font-mono text-sm outline-none"
                        />
                      </div>
                    </label>
              
                    <label className="block">
                      <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#666]">
                        Timezone
                      </span>
              
                      <select
                        value={editTimezone}
                        onChange={(event) =>
                          setEditTimezone(event.target.value)
                        }
                        className="mt-2 w-full rounded-2xl border border-black/10 bg-[#F7F5F1] px-4 py-4 text-sm outline-none transition focus:border-[#222]"
                      >
                        <option value="Europe/Athens">
                          Europe/Athens
                        </option>
              
                        <option value="Europe/London">
                          Europe/London
                        </option>
              
                        <option value="Europe/Paris">
                          Europe/Paris
                        </option>
              
                        <option value="America/New_York">
                          America/New_York
                        </option>
              
                        <option value="America/Los_Angeles">
                          America/Los_Angeles
                        </option>
                      </select>
                    </label>
              
                    <label className="block sm:col-span-2">
                      <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#666]">
                        Status
                      </span>
              
                      <select
                        value={editStatus}
                        onChange={(event) =>
                          setEditStatus(
                            event.target.value as Business["status"],
                          )
                        }
                        className="mt-2 w-full rounded-2xl border border-black/10 bg-[#F7F5F1] px-4 py-4 text-sm outline-none transition focus:border-[#222]"
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </label>
                  </div>
              
                  {editError && (
                    <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4">
                      <p className="text-sm font-semibold text-red-700">
                        {editError}
                      </p>
                    </div>
                  )}
              
                  <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={cancelEditingBusiness}
                      disabled={editSaving}
                      className="rounded-2xl border border-black/10 px-6 py-4 text-sm font-bold transition hover:border-[#222] disabled:opacity-50"
                    >
                      Ακύρωση
                    </button>
              
                    <button
                      type="button"
                      onClick={() =>
                        updateBusiness(business.id)
                      }
                      disabled={
                        editSaving ||
                        !editName.trim() ||
                        !editSlug.trim() ||
                        !editTimezone.trim()
                      }
                      className="rounded-2xl bg-[#222] px-6 py-4 text-sm font-bold text-white transition hover:bg-[#DC2727] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {editSaving
                        ? "Αποθήκευση..."
                        : "Αποθήκευση αλλαγών"}
                    </button>
                  </div>
                </div>
              )}

                <div className="border-t border-black/8 bg-[#F7F5F1] px-6 py-4 sm:px-8">
                  <p className="font-mono text-[10px] text-[#999]">
                    Business ID: {business.id}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {deletingBusiness && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-5 py-8">
          <div className="w-full max-w-lg rounded-[28px] bg-white p-6 shadow-2xl sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#DC2727]">
              Permanent deletion
            </p>
      
            <h3 className="mt-4 text-3xl font-black tracking-[-0.04em]">
              Διαγραφή επιχείρησης;
            </h3>
      
            <p className="mt-4 text-sm leading-6 text-[#666]">
              Πρόκειται να διαγράψεις οριστικά την επιχείρηση{" "}
              <strong className="text-[#222]">
                {deletingBusiness.name}
              </strong>
              .
            </p>
      
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-semibold text-red-700">
                Η ενέργεια δεν μπορεί να αναιρεθεί.
              </p>
            </div>
      
            <label className="mt-6 block">
              <span className="text-xs font-bold uppercase tracking-[0.15em] text-[#666]">
                Πληκτρολόγησε το slug για επιβεβαίωση
              </span>
      
              <div className="mt-2 rounded-2xl bg-[#F7F5F1] px-4 py-3">
                <code className="text-sm font-bold">
                  {deletingBusiness.slug}
                </code>
              </div>
      
              <input
                type="text"
                value={deleteConfirmation}
                onChange={(event) =>
                  setDeleteConfirmation(event.target.value)
                }
                autoComplete="off"
                placeholder={deletingBusiness.slug}
                className="mt-3 w-full rounded-2xl border border-black/10 px-4 py-4 font-mono text-sm outline-none transition focus:border-[#DC2727]"
              />
            </label>
      
            {deleteError && (
              <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4">
                <p className="text-sm font-semibold text-red-700">
                  {deleteError}
                </p>
              </div>
            )}
      
            <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={cancelDeletingBusiness}
                disabled={deleteSaving}
                className="rounded-2xl border border-black/10 px-6 py-4 text-sm font-bold transition hover:border-[#222] disabled:opacity-50"
              >
                Ακύρωση
              </button>
      
              <button
                type="button"
                onClick={deleteBusiness}
                disabled={
                  deleteSaving ||
                  deleteConfirmation.trim() !==
                    deletingBusiness.slug
                }
                className="rounded-2xl bg-[#DC2727] px-6 py-4 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {deleteSaving
                  ? "Διαγραφή..."
                  : "Οριστική διαγραφή"}
              </button>
            </div>
          </div>
        </div>
      )}
      
    </div>
  );
}

function ProjectsPanel({
  projects,
  businesses,
  loading,
  error,
  onProjectCreated,
}: {
  projects: ConnectedProject[];
  businesses: Business[];
  loading: boolean;
  error: string;
  onProjectCreated: (
    project: ConnectedProject,
  ) => void;
}) {
  const [showCreateForm, setShowCreateForm] =
    useState(false);

  const [businessId, setBusinessId] =
    useState("");

  const [name, setName] = useState("");
  const [liveUrl, setLiveUrl] = useState("");
  const [githubUrl, setGithubUrl] = useState("");

  const [status, setStatus] =
    useState<ConnectedProject["status"]>(
      "active",
    );

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] =
    useState("");

  const [successMessage, setSuccessMessage] =
    useState("");

  function resetForm() {
    setBusinessId("");
    setName("");
    setLiveUrl("");
    setGithubUrl("");
    setStatus("active");
    setFormError("");
    setSuccessMessage("");
  }

  function closeCreateForm() {
    resetForm();
    setShowCreateForm(false);
  }

  function getProjectBusiness(
    project: ConnectedProject,
  ) {
    if (Array.isArray(project.businesses)) {
      return project.businesses[0] ?? null;
    }

    return project.businesses;
  }

  async function createProject(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    try {
      setSaving(true);
      setFormError("");
      setSuccessMessage("");

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
        "/api/admin/projects",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization:
              `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            business_id: businessId,
            name: name.trim(),
            live_url: liveUrl.trim(),
            github_url: githubUrl.trim(),
            status,
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
            "Could not connect custom project",
        );
      }

      onProjectCreated(result.project);

      setSuccessMessage(
        "Το custom project συνδέθηκε επιτυχώς.",
      );

      setBusinessId("");
      setName("");
      setLiveUrl("");
      setGithubUrl("");
      setStatus("active");

      window.setTimeout(() => {
        setShowCreateForm(false);
        setSuccessMessage("");
      }, 900);
    } catch (createError) {
      console.error(
        "Project creation failed:",
        createError,
      );

      setFormError(
        createError instanceof Error
          ? createError.message
          : "Δεν ήταν δυνατή η σύνδεση του project.",
      );
    } finally {
      setSaving(false);
    }
  }

  const activeProjects = projects.filter(
    (project) => project.status === "active",
  ).length;

  if (loading) {
    return (
      <div className="mt-8 rounded-[24px] border border-black/10 bg-[#F7F5F1] p-10 text-center">
        <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-[#222] border-t-transparent" />

        <p className="mt-4 text-sm font-medium text-[#666]">
          Φόρτωση connected projects...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-8 rounded-[24px] border border-red-200 bg-red-50 p-8 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#DC2727]">
          Loading error
        </p>

        <h3 className="mt-4 text-2xl font-black tracking-[-0.03em]">
          Δεν φορτώθηκαν τα projects
        </h3>

        <p className="mt-3 text-sm text-red-700">
          {error}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#DC2727]">
            Connected custom projects
          </p>

          <p className="mt-2 text-sm text-[#666]">
            {projects.length} συνολικά ·{" "}
            {activeProjects} ενεργά
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setFormError("");
            setSuccessMessage("");
            setShowCreateForm(
              (current) => !current,
            );
          }}
          className="rounded-2xl bg-[#222] px-6 py-4 text-sm font-bold text-white transition hover:bg-[#DC2727]"
        >
          {showCreateForm
            ? "Κλείσιμο φόρμας"
            : "+ Connect Project"}
        </button>
      </div>

      {showCreateForm && (
        <form
          onSubmit={createProject}
          className="rounded-[28px] border border-black/10 bg-[#F7F5F1] p-6 sm:p-8"
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#DC2727]">
              Connect custom page
            </p>

            <h3 className="mt-3 text-2xl font-black tracking-[-0.04em]">
              Νέο Connected Project
            </h3>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#666]">
              Σύνδεσε ένα ανεξάρτητο React ή Vite
              project με μία επιχείρηση του Zisto.
            </p>
          </div>

          <div className="mt-7 grid gap-5 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#666]">
                Business
              </span>

              <select
                value={businessId}
                onChange={(event) =>
                  setBusinessId(event.target.value)
                }
                required
                className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-4 py-4 text-sm outline-none transition focus:border-[#222]"
              >
                <option value="">
                  Επίλεξε επιχείρηση
                </option>

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

            <label className="block sm:col-span-2">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#666]">
                Project name
              </span>

              <input
                type="text"
                value={name}
                onChange={(event) =>
                  setName(event.target.value)
                }
                required
                maxLength={120}
                placeholder="π.χ. Myrsini NFC Landing Page"
                className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-4 py-4 text-sm outline-none transition placeholder:text-[#AAA] focus:border-[#222]"
              />
            </label>

            <label className="block sm:col-span-2">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#666]">
                Live URL
              </span>

              <input
                type="url"
                value={liveUrl}
                onChange={(event) =>
                  setLiveUrl(event.target.value)
                }
                required
                placeholder="https://project.vercel.app"
                className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-4 py-4 text-sm outline-none transition placeholder:text-[#AAA] focus:border-[#222]"
              />
            </label>

            <label className="block sm:col-span-2">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#666]">
                GitHub URL
              </span>

              <input
                type="url"
                value={githubUrl}
                onChange={(event) =>
                  setGithubUrl(event.target.value)
                }
                placeholder="https://github.com/username/project"
                className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-4 py-4 text-sm outline-none transition placeholder:text-[#AAA] focus:border-[#222]"
              />
            </label>

            <label className="block sm:col-span-2">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#666]">
                Status
              </span>

              <select
                value={status}
                onChange={(event) =>
                  setStatus(
                    event.target
                      .value as ConnectedProject["status"],
                  )
                }
                className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-4 py-4 text-sm outline-none transition focus:border-[#222]"
              >
                <option value="active">
                  Active
                </option>

                <option value="inactive">
                  Inactive
                </option>
              </select>
            </label>
          </div>

          {businesses.length === 0 && (
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-800">
                Πρέπει πρώτα να δημιουργήσεις μία
                επιχείρηση.
              </p>
            </div>
          )}

          {formError && (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-semibold text-red-700">
                {formError}
              </p>
            </div>
          )}

          {successMessage && (
            <div className="mt-5 rounded-2xl border border-green-200 bg-green-50 p-4">
              <p className="text-sm font-semibold text-green-700">
                {successMessage}
              </p>
            </div>
          )}

          <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={closeCreateForm}
              disabled={saving}
              className="rounded-2xl border border-black/10 bg-white px-6 py-4 text-sm font-bold transition hover:border-[#222] disabled:opacity-50"
            >
              Ακύρωση
            </button>

            <button
              type="submit"
              disabled={
                saving ||
                !businessId ||
                !name.trim() ||
                !liveUrl.trim()
              }
              className="rounded-2xl bg-[#222] px-6 py-4 text-sm font-bold text-white transition hover:bg-[#DC2727] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving
                ? "Σύνδεση..."
                : "Connect Project"}
            </button>
          </div>
        </form>
      )}

      {projects.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-black/15 bg-[#F7F5F1] p-8 text-center">
          <h3 className="text-2xl font-black tracking-[-0.03em]">
            Δεν υπάρχει connected project
          </h3>

          <p className="mt-3 text-sm text-[#666]">
            Πάτησε «+ Connect Project» για να
            συνδέσεις το πρώτο custom project.
          </p>
        </div>
      ) : (
        <div className="grid gap-5">
          {projects.map((project) => {
            const isActive =
              project.status === "active";

            const business =
              getProjectBusiness(project);

            return (
              <article
                key={project.id}
                className="overflow-hidden rounded-[28px] border border-black/10 bg-white"
              >
                <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <span
                        className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] ${
                          isActive
                            ? "bg-green-50 text-green-700"
                            : "bg-black/5 text-[#777]"
                        }`}
                      >
                        <span
                          className={`h-2 w-2 rounded-full ${
                            isActive
                              ? "bg-green-500"
                              : "bg-[#999]"
                          }`}
                        />

                        {isActive
                          ? "Active"
                          : "Inactive"}
                      </span>

                      {business && (
                        <span className="rounded-full bg-[#F7F5F1] px-3 py-1.5 text-[10px] font-bold text-[#666]">
                          {business.name}
                        </span>
                      )}
                    </div>

                    <h3 className="mt-5 text-2xl font-black tracking-[-0.04em] sm:text-3xl">
                      {project.name}
                    </h3>

                    <div className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
                      <div className="rounded-2xl bg-[#F7F5F1] p-4">
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#999]">
                          Project key
                        </p>

                        <p className="mt-2 break-all font-mono text-xs font-semibold">
                          {project.project_key}
                        </p>
                      </div>

                      <div className="rounded-2xl bg-[#F7F5F1] p-4">
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#999]">
                          Tracker
                        </p>

                        <p className="mt-2 flex items-center gap-2 font-semibold">
                          <span
                            className={`h-2 w-2 rounded-full ${
                              isActive
                                ? "animate-pulse bg-[#DC2727]"
                                : "bg-[#999]"
                            }`}
                          />

                          {isActive
                            ? "Ready"
                            : "Paused"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex w-full flex-col gap-3 lg:w-auto">
                    <a
                      href={project.live_url}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full rounded-2xl bg-[#222] px-7 py-4 text-center text-sm font-bold text-white transition hover:bg-[#DC2727] lg:w-auto"
                    >
                      Άνοιγμα Live Site →
                    </a>

                    {project.github_url && (
                      <a
                        href={project.github_url}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full rounded-2xl border border-black/10 bg-white px-7 py-4 text-center text-sm font-bold transition hover:border-[#222] lg:w-auto"
                      >
                        GitHub Repository
                      </a>
                    )}
                  </div>
                </div>

                <div className="border-t border-black/8 bg-[#F7F5F1] px-6 py-4 sm:px-8">
                  <p className="break-all font-mono text-[10px] text-[#999]">
                    Project ID: {project.id}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ClientsPanel({
  clients,
  loading,
  error,
  onClientRoleChanged,
  onClientRemoved,
}: {
  clients: Client[];
  loading: boolean;
  error: string;
  onClientRoleChanged: (
    userId: string,
    businessId: string,
    role: Client["role"],
  ) => void;
  onClientRemoved: (
    userId: string,
    businessId: string,
  ) => void;
}) {
  const [editingClientKey, setEditingClientKey] =
    useState<string | null>(null);

  const [selectedRole, setSelectedRole] =
    useState<Client["role"]>("staff");

  const [savingClientKey, setSavingClientKey] =
    useState<string | null>(null);

  const [actionError, setActionError] = useState("");

  function getClientKey(client: Client) {
    return `${client.id}-${client.business_id}`;
  }

  function startEditing(client: Client) {
    setActionError("");
    setSelectedRole(client.role);
    setEditingClientKey(getClientKey(client));
  }

  function cancelEditing() {
    setEditingClientKey(null);
    setActionError("");
  }

  async function getAccessToken() {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      throw sessionError;
    }

    if (!session) {
      window.location.hash = "/login";
      throw new Error("Authentication required");
    }

    return session.access_token;
  }

  async function updateClientRole(client: Client) {
    const clientKey = getClientKey(client);

    try {
      setSavingClientKey(clientKey);
      setActionError("");

      const accessToken = await getAccessToken();

      const response = await fetch("/api/admin/clients", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: client.id,
          business_id: client.business_id,
          role: selectedRole,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Could not update client role",
        );
      }

      onClientRoleChanged(
        client.id,
        client.business_id,
        selectedRole,
      );

      setEditingClientKey(null);
    } catch (updateError) {
      console.error(
        "Client role update failed:",
        updateError,
      );

      setActionError(
        updateError instanceof Error
          ? updateError.message
          : "Δεν ήταν δυνατή η αλλαγή του ρόλου.",
      );
    } finally {
      setSavingClientKey(null);
    }
  }

  async function removeClient(client: Client) {
    const confirmed = window.confirm(
      `Θέλεις σίγουρα να αφαιρέσεις την πρόσβαση του ${client.email} από την επιχείρηση "${client.business?.name ?? "Άγνωστη επιχείρηση"}";`,
    );

    if (!confirmed) {
      return;
    }

    const clientKey = getClientKey(client);

    try {
      setSavingClientKey(clientKey);
      setActionError("");

      const accessToken = await getAccessToken();

      const response = await fetch("/api/admin/clients", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: client.id,
          business_id: client.business_id,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Could not remove client access",
        );
      }

      onClientRemoved(
        client.id,
        client.business_id,
      );

      setEditingClientKey(null);
    } catch (removeError) {
      console.error(
        "Client removal failed:",
        removeError,
      );

      setActionError(
        removeError instanceof Error
          ? removeError.message
          : "Δεν ήταν δυνατή η αφαίρεση του client.",
      );
    } finally {
      setSavingClientKey(null);
    }
  }

  if (loading) {
    return (
      <div className="rounded-[24px] border border-black/10 bg-[#F7F5F1] p-10 text-center">
        <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-[#222] border-t-transparent" />

        <p className="mt-4 text-sm font-medium text-[#666]">
          Φόρτωση clients...
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
          Δεν φορτώθηκαν οι clients
        </h3>

        <p className="mt-3 text-sm text-red-700">
          {error}
        </p>
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <div className="rounded-[24px] border border-dashed border-black/15 bg-[#F7F5F1] p-8 text-center">
        <h3 className="text-2xl font-black tracking-[-0.03em]">
          Δεν υπάρχουν clients
        </h3>

        <p className="mt-3 text-sm text-[#666]">
          Οι clients που προσκαλείς θα εμφανίζονται εδώ.
        </p>
      </div>
    );
  }

  const activeClients = clients.filter(
    (client) => client.status === "active",
  ).length;

  const invitedClients = clients.filter(
    (client) => client.status === "invited",
  ).length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <ClientSummaryCard
          label="Σύνολο clients"
          value={clients.length}
        />

        <ClientSummaryCard
          label="Ενεργοί"
          value={activeClients}
        />

        <ClientSummaryCard
          label="Invited"
          value={invitedClients}
        />
      </div>

      {actionError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
          {actionError}
        </div>
      )}

      {resendSuccess && (
        <div className="rounded-2xl border border-green-200 bg-green-50 px-5 py-4 text-sm font-semibold text-green-700">
          {resendSuccess}
        </div>
      )}
      
      {resendError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
          {resendError}
        </div>
      )}

      <div className="overflow-hidden rounded-[28px] border border-black/10 bg-white">
        <div className="hidden grid-cols-[1.4fr_1.1fr_0.65fr_0.7fr_0.9fr] gap-4 border-b border-black/8 bg-[#F7F5F1] px-6 py-4 text-[10px] font-bold uppercase tracking-[0.18em] text-[#777] xl:grid">
          <span>Client</span>
          <span>Επιχείρηση</span>
          <span>Ρόλος</span>
          <span>Status</span>
          <span>Ενέργειες</span>
        </div>

        <div className="divide-y divide-black/8">
          {clients.map((client) => {
            const clientKey = getClientKey(client);

            const isEditing =
              editingClientKey === clientKey;

            const isSaving =
              savingClientKey === clientKey;

            const displayName =
              client.full_name.trim() ||
              client.email.split("@")[0] ||
              "Client";

            const initials = displayName
              .split(" ")
              .filter(Boolean)
              .slice(0, 2)
              .map((part) =>
                part.charAt(0).toUpperCase(),
              )
              .join("");

            return (
              <article
                key={clientKey}
                className="grid gap-5 px-6 py-6 xl:grid-cols-[1.4fr_1.1fr_0.65fr_0.7fr_0.9fr] xl:items-center"
              >
                <div className="flex min-w-0 items-center gap-4">
                  <div className="grid h-12 w-12 flex-shrink-0 place-items-center rounded-full bg-[#222] text-sm font-black text-white">
                    {initials || "C"}
                  </div>

                  <div className="min-w-0">
                    <p className="truncate font-black">
                      {displayName}
                    </p>

                    <p className="mt-1 truncate text-sm text-[#666]">
                      {client.email}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#999] xl:hidden">
                    Επιχείρηση
                  </p>

                  <p className="mt-1 font-semibold xl:mt-0">
                    {client.business?.name ??
                      "Άγνωστη επιχείρηση"}
                  </p>

                  {client.business?.slug && (
                    <p className="mt-1 font-mono text-[10px] text-[#999]">
                      /{client.business.slug}
                    </p>
                  )}
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#999] xl:hidden">
                    Ρόλος
                  </p>

                  {isEditing ? (
                    <select
                      value={selectedRole}
                      disabled={isSaving}
                      onChange={(event) =>
                        setSelectedRole(
                          event.target
                            .value as Client["role"],
                        )
                      }
                      className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-bold outline-none transition focus:border-[#222] xl:mt-0"
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
                  ) : (
                    <span className="mt-2 inline-flex rounded-full bg-[#F7F5F1] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#555] xl:mt-0">
                      {client.role}
                    </span>
                  )}
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#999] xl:hidden">
                    Status
                  </p>

                  <span
                    className={`mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] xl:mt-0 ${
                      client.status === "active"
                        ? "bg-green-50 text-green-700"
                        : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        client.status === "active"
                          ? "bg-green-500"
                          : "bg-amber-500"
                      }`}
                    />

                    {client.status === "active"
                      ? "Active"
                      : "Invited"}
                  </span>
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#999] xl:hidden">
                    Ενέργειες
                  </p>

                  {isEditing ? (
                    <div className="mt-2 flex flex-wrap gap-2 xl:mt-0">
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() =>
                          updateClientRole(client)
                        }
                        className="rounded-xl bg-[#222] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#DC2727] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isSaving
                          ? "Αποθήκευση..."
                          : "Save"}
                      </button>

                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={cancelEditing}
                        className="rounded-xl border border-black/10 px-4 py-2.5 text-xs font-bold transition hover:border-[#222] disabled:opacity-50"
                      >
                        Cancel
                      </button>

                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() =>
                          removeClient(client)
                        }
                        className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => startEditing(client)}
                      className="mt-2 rounded-xl border border-black/10 bg-white px-4 py-2.5 text-xs font-bold transition hover:border-[#222] hover:bg-[#F7F5F1] xl:mt-0"
                    >
                      Edit
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ClientSummaryCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-[24px] border border-black/10 bg-[#F7F5F1] p-6">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#888]">
        {label}
      </p>

      <p className="mt-4 text-4xl font-black tracking-[-0.05em]">
        {value}
      </p>
    </div>
  );
}

function InvitationsPanel({
  invitations,
  loading,
  error,
  onInvitationUpdated,
}: {
  invitations: Invitation[];
  loading: boolean;
  error: string;
  onInvitationUpdated: (
    invitation: Invitation,
  ) => void;
}) {

  const [resendingId, setResendingId] =
    useState<string | null>(null);
  
  const [resendError, setResendError] =
    useState("");
  
  const [resendSuccess, setResendSuccess] =
    useState("");
  
  if (loading) {
    return (
      <div className="rounded-[24px] border border-black/10 bg-[#F7F5F1] p-10 text-center">
        <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-[#222] border-t-transparent" />

        <p className="mt-4 text-sm font-medium text-[#666]">
          Φόρτωση προσκλήσεων...
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
          Δεν φορτώθηκαν οι προσκλήσεις
        </h3>

        <p className="mt-3 text-sm text-red-700">
          {error}
        </p>
      </div>
    );
  }

  if (invitations.length === 0) {
    return (
      <div className="rounded-[24px] border border-dashed border-black/15 bg-[#F7F5F1] p-8 text-center">
        <h3 className="text-2xl font-black tracking-[-0.03em]">
          Δεν υπάρχουν προσκλήσεις
        </h3>

        <p className="mt-3 text-sm text-[#666]">
          Οι νέες προσκλήσεις θα εμφανίζονται εδώ.
        </p>
      </div>
    );
  }

  const pendingCount = invitations.filter(
    (invitation) => invitation.status === "pending",
  ).length;

  const acceptedCount = invitations.filter(
    (invitation) => invitation.status === "accepted",
  ).length;

  const failedCount = invitations.filter(
    (invitation) => invitation.status === "failed",
  ).length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <ClientSummaryCard
          label="Pending"
          value={pendingCount}
        />

        <ClientSummaryCard
          label="Accepted"
          value={acceptedCount}
        />

        <ClientSummaryCard
          label="Failed"
          value={failedCount}
        />
      </div>

      <div className="overflow-hidden rounded-[28px] border border-black/10 bg-white">
        <div className="hidden grid-cols-[1.4fr_1.2fr_0.7fr_0.8fr_0.9fr] gap-4 border-b border-black/8 bg-[#F7F5F1] px-6 py-4 text-[10px] font-bold uppercase tracking-[0.18em] text-[#777] xl:grid">
          <span>Παραλήπτης</span>
          <span>Επιχείρηση</span>
          <span>Ρόλος</span>
          <span>Status</span>
          <span>Ημερομηνία</span>
        </div>

        <div className="divide-y divide-black/8">
          {invitations.map((invitation) => {
            const businessRelation =
              Array.isArray(invitation.businesses)
                ? invitation.businesses[0] ?? null
                : invitation.businesses;

            const displayName =
              invitation.full_name?.trim() ||
              invitation.email.split("@")[0] ||
              "Client";

            const createdDate = new Intl.DateTimeFormat(
              "el-GR",
              {
                dateStyle: "medium",
                timeStyle: "short",
              },
            ).format(new Date(invitation.created_at));

            return (
              <article
                key={invitation.id}
                className="grid gap-5 px-6 py-6 xl:grid-cols-[1.4fr_1.2fr_0.7fr_0.8fr_0.9fr] xl:items-center"
              >
                <div className="min-w-0">
                  <p className="truncate font-black">
                    {displayName}
                  </p>

                  <p className="mt-1 truncate text-sm text-[#666]">
                    {invitation.email}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#999] xl:hidden">
                    Επιχείρηση
                  </p>

                  <p className="mt-1 font-semibold xl:mt-0">
                    {businessRelation?.name ??
                      "Άγνωστη επιχείρηση"}
                  </p>

                  {businessRelation?.slug && (
                    <p className="mt-1 font-mono text-[10px] text-[#999]">
                      /{businessRelation.slug}
                    </p>
                  )}
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#999] xl:hidden">
                    Ρόλος
                  </p>

                  <span className="mt-2 inline-flex rounded-full bg-[#F7F5F1] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#555] xl:mt-0">
                    {invitation.role}
                  </span>
                </div>

                <InvitationStatusBadge
                  status={invitation.status}
                />

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#999] xl:hidden">
                    Ημερομηνία
                  </p>

                  <p className="mt-1 text-sm font-semibold xl:mt-0">
                    {createdDate}
                  </p>
                </div>

                {invitation.error_message && (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 xl:col-span-5">
                    {invitation.error_message}
                  </div>
                )}

                <div className="flex justify-start xl:justify-end">
                  {["pending", "expired", "failed"].includes(
                    invitation.status,
                  ) ? (
                    <button
                      type="button"
                      onClick={() =>
                        resendInvitation(invitation)
                      }
                      disabled={resendingId !== null}
                      className="w-full rounded-2xl border border-black/10 bg-white px-5 py-3 text-sm font-bold transition hover:border-[#222] hover:bg-[#F7F5F1] disabled:cursor-not-allowed disabled:opacity-50 xl:w-auto"
                    >
                      {resendingId === invitation.id
                        ? "Αποστολή..."
                        : "Επαναποστολή"}
                    </button>
                  ) : (
                    <span className="text-xs font-semibold text-[#AAA]">
                      —
                    </span>
                  )}
                </div>
                
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function InvitationStatusBadge({
  status,
}: {
  status: Invitation["status"];
}) {
  const styles: Record<
    Invitation["status"],
    string
  > = {
    pending: "bg-amber-50 text-amber-700",
    accepted: "bg-green-50 text-green-700",
    expired: "bg-slate-100 text-slate-600",
    failed: "bg-red-50 text-red-700",
    cancelled: "bg-slate-100 text-slate-600",
  };

  async function resendInvitation(
    invitation: Invitation,
  ) {
    try {
      setResendingId(invitation.id);
      setResendError("");
      setResendSuccess("");
  
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
        "/api/admin/resend-invitation",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization:
              `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            invitation_id: invitation.id,
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
            "Could not resend invitation",
        );
      }
  
      onInvitationUpdated(result.invitation);
  
      setResendSuccess(
        `Η πρόσκληση στάλθηκε ξανά στο ${invitation.email}.`,
      );
    } catch (resendInvitationError) {
      console.error(
        "Invitation resend failed:",
        resendInvitationError,
      );
  
      setResendError(
        resendInvitationError instanceof Error
          ? resendInvitationError.message
          : "Δεν ήταν δυνατή η επαναποστολή της πρόσκλησης.",
      );
    } finally {
      setResendingId(null);
    }
  }

  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#999] xl:hidden">
        Status
      </p>

      <span
        className={`mt-2 inline-flex rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] xl:mt-0 ${styles[status]}`}
      >
        {status}
      </span>
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

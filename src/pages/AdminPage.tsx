import { GlobalLoader } from "../components/ui/GlobalLoader";
import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { InviteClientPanel } from "../components/admin/InviteClientPanel";
import { SubscriptionsPanel, type AdminSubscription } from "../components/admin/SubscriptionsPanel";

type AdminTab =
  | "home"
  | "businesses"
  | "projects"
  | "clients"
  | "invitations"
  | "subscriptions"
  | "invite";

const ADMIN_TABS: {
  id: AdminTab;
  label: string;
  description: string;
}[] = [
  {
    id: "home",
    label: "Επισκόπηση",
    description:
      "Κεντρική εικόνα και γρήγορη πρόσβαση σε όλες τις λειτουργίες του Zisto Admin.",
  },
  {
    id: "businesses",
    label: "Επιχειρήσεις",
    description:
      "Δημιουργία και διαχείριση όλων των businesses του Zisto.",
  },
  {
    id: "projects",
    label: "Συνδεδεμένα έργα",
    description:
      "Σύνδεση και διαχείριση των public Smart Links και των GitHub repositories τους.",
  },
  {
    id: "clients",
    label: "Πελάτες",
    description:
      "Διαχείριση των clients και της πρόσβασής τους στις επιχειρήσεις.",
  },
  {
    id: "invitations",
    label: "Προσκλήσεις",
    description:
      "Έλεγχος ενεργών, ολοκληρωμένων και εκκρεμών προσκλήσεων.",
  },
  {
    id: "subscriptions",
    label: "Συνδρομές",
    description:
      "Custom χρεώσεις, billing status, επόμενες πληρωμές και πρόσβαση ανά επιχείρηση.",
  },
  {
    id: "invite",
    label: "Πρόσκληση πελάτη",
    description:
      "Αποστολή νέας πρόσκλησης και σύνδεση client με επιχείρηση.",
  },
];

function adminTabFromHash(): AdminTab {
  if (typeof window === "undefined") {
    return "home";
  }

  const rawHash =
    window.location.hash.replace(/^#/, "");

  const [, search = ""] =
    rawHash.split("?");

  const tab =
    new URLSearchParams(
      search,
    ).get("tab");

  return ADMIN_TABS.some(
    (item) => item.id === tab,
  )
    ? (tab as AdminTab)
    : "home";
}


type DashboardModule =
  | "analytics"
  | "reviews"
  | "menu"
  | "nfc"
  | "appointments";

const DASHBOARD_MODULE_OPTIONS: {
  id: DashboardModule;
  label: string;
  description: string;
}[] = [
  {
    id: "analytics",
    label: "Analytics",
    description: "Επισκέψεις, conversions και δραστηριότητα.",
  },
  {
    id: "reviews",
    label: "Αξιολογήσεις",
    description: "Review clicks και review performance.",
  },
  {
    id: "menu",
    label: "Μενού",
    description: "Ψηφιακό menu και menu analytics.",
  },
  {
    id: "nfc",
    label: "NFC κάρτες",
    description: "Κάρτες, tracking URLs και taps ανά κάρτα.",
  },
  {
    id: "appointments",
    label: "Ραντεβού",
    description: "Booking, ημερολόγιο και υπενθυμίσεις.",
  },
];

type Business = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  status: "active" | "inactive";
  dashboard_modules: DashboardModule[];
  setup_status: "active" | "setup_required";
  smart_link: {
    id: string;
    name: string;
    live_url: string;
    github_url: string | null;
    project_key: string;
  } | null;
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

type AdminAccount = {
  id: string;
  email: string;
  full_name: string;
  created_at: string | null;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const lockedScrollYRef = useRef(0);
  const [projects, setProjects] =
    useState<ConnectedProject[]>([]);
  
  const [projectsLoading, setProjectsLoading] =
    useState(false);
  
  const [projectsError, setProjectsError] =
    useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [admins, setAdmins] = useState<AdminAccount[]>([]);
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
  const [activeAdminTab, setΕνεργόAdminTab] =
    useState<AdminTab>(
      adminTabFromHash,
    );
  
  const [businesses, setΕπιχειρήσεις] = useState<Business[]>([]);
  const [businessesLoading, setΕπιχειρήσειςLoading] = useState(false);
  const [businessesError, setΕπιχειρήσειςError] = useState("");

  const [subscriptions, setSubscriptions] =
    useState<AdminSubscription[]>([]);
  const [subscriptionsLoading, setSubscriptionsLoading] =
    useState(false);
  const [subscriptionsError, setSubscriptionsError] =
    useState("");

  useEffect(() => {
    const syncAdminTabFromHash =
      () => {
        setΕνεργόAdminTab(
          adminTabFromHash(),
        );
      };

    window.addEventListener(
      "hashchange",
      syncAdminTabFromHash,
    );

    return () => {
      window.removeEventListener(
        "hashchange",
        syncAdminTabFromHash,
      );
    };
  }, []);

  function handleAdminTabChange(
    tab: AdminTab,
  ) {
    setΕνεργόAdminTab(tab);

    const nextHash =
      tab === "home"
        ? "/admin"
        : `/admin?tab=${tab}`;

    if (
      window.location.hash !==
      `#${nextHash}`
    ) {
      window.location.hash =
        nextHash;
    }
  }

  useEffect(() => {
    if (!isAdmin || (activeAdminTab !== "home" && activeAdminTab !== "projects")) {
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
  
        const responseText = await response.text();
        
        let result: {
          error?: string;
          invitation?: Invitation;
        } = {};
        
        try {
          result = responseText
            ? JSON.parse(responseText)
            : {};
        } catch {
          throw new Error(
            responseText ||
              `Server error (${response.status})`,
          );
        }
  
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

        const response = await fetch("/api/admin/clients?view=me", {
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

  useEffect(() => {
    if (!sidebarOpen) {
      return;
    }

    lockedScrollYRef.current = window.scrollY;

    const body = document.body;
    const previous = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
    };

    body.style.position = "fixed";
    body.style.top = `-${lockedScrollYRef.current}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overflow = "hidden";

    return () => {
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.left = previous.left;
      body.style.right = previous.right;
      body.style.width = previous.width;
      body.style.overflow = previous.overflow;

      window.scrollTo(0, lockedScrollYRef.current);
    };
  }, [sidebarOpen]);

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.hash = "/login";
  }

  useEffect(() => {
  if (!isAdmin || (activeAdminTab !== "home" && activeAdminTab !== "businesses")) {
    return;
  }

  let active = true;

  async function loadΕπιχειρήσεις() {
    try {
      setΕπιχειρήσειςLoading(true);
      setΕπιχειρήσειςError("");

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
        setΕπιχειρήσεις(result.businesses ?? []);
      }
    } catch (loadError) {
      console.error("Επιχειρήσεις loading failed:", loadError);

      if (active) {
        setΕπιχειρήσειςError(
          loadError instanceof Error
            ? loadError.message
            : "Δεν ήταν δυνατή η φόρτωση των επιχειρήσεων.",
        );
      }
    } finally {
      if (active) {
        setΕπιχειρήσειςLoading(false);
      }
    }
  }

  loadΕπιχειρήσεις();

  return () => {
    active = false;
  };
}, [isAdmin, activeAdminTab]);

useEffect(() => {
  if (!isAdmin || (activeAdminTab !== "home" && activeAdminTab !== "clients")) {
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
        setAdmins(result.admins ?? []);
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
  if (!isAdmin || (activeAdminTab !== "home" && activeAdminTab !== "invitations")) {
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

useEffect(() => {
  if (
    !isAdmin ||
    (
      activeAdminTab !== "home" &&
      activeAdminTab !== "subscriptions"
    )
  ) {
    return;
  }

  let active = true;

  async function loadSubscriptions() {
    try {
      setSubscriptionsLoading(true);
      setSubscriptionsError("");

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
        "/api/admin/subscriptions",
        {
          method: "GET",
          headers: {
            Authorization:
              `Bearer ${session.access_token}`,
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
            "Could not load subscriptions",
        );
      }

      if (active) {
        setSubscriptions(
          result.subscriptions ?? [],
        );
      }
    } catch (loadError) {
      console.error(
        "Subscriptions loading failed:",
        loadError,
      );

      if (active) {
        setSubscriptionsError(
          loadError instanceof Error
            ? loadError.message
            : "Δεν ήταν δυνατή η φόρτωση των συνδρομών.",
        );
      }
    } finally {
      if (active) {
        setSubscriptionsLoading(false);
      }
    }
  }

  loadSubscriptions();

  return () => {
    active = false;
  };
}, [isAdmin, activeAdminTab]);
  
  if (loading) {
    return (
      <GlobalLoader
        fullScreen
        message="Έλεγχος πρόσβασης διαχειριστή..."
      />
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

  const activeTabDetails =
  ADMIN_TABS.find(
    (tab) => tab.id === activeAdminTab,
  ) ?? ADMIN_TABS[0];

  return (
    <main className="min-h-screen bg-[#F7F5F1] text-[#222]">
      <div className="min-h-screen">
        <AdminSidebar
          activeTab={activeAdminTab}
          adminEmail={adminEmail}
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          onTabChange={handleAdminTabChange}
          onLogout={handleLogout}
        />

        {sidebarOpen && (
          <button
            type="button"
            aria-label="Κλείσιμο μενού"
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          />
        )}
  
          <section className="min-w-0 px-5 py-8 sm:px-8 lg:ml-[280px] lg:px-10 lg:py-10">
            <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-black/5 bg-[#F7F5F1]/90 px-5 backdrop-blur-xl sm:px-8 lg:hidden">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="grid h-11 w-11 place-items-center rounded-full border border-black/10 bg-white text-xl"
                aria-label="Άνοιγμα μενού"
                aria-expanded={sidebarOpen}
              >
                ☰
              </button>
          
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#222]/35">
                Πίνακας διαχείρισης
              </p>
          
              <div className="grid h-10 w-10 place-items-center rounded-full bg-[#222] text-xs font-black uppercase text-white">
                {adminEmail.charAt(0) || "A"}
              </div>
            </header>
          
            <div className="px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
              <div className="mx-auto w-full max-w-[1250px]">
        
            <header className="border-b border-black/10 pb-8">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#DC2727]">
                Χώρος διαχείρισης
              </p>
  
              <h1 className="mt-4 text-4xl font-black tracking-[-0.05em] sm:text-5xl">
                {activeTabDetails.label}
              </h1>
  
              <p className="mt-4 max-w-3xl text-sm leading-7 text-[#666] sm:text-base">
                {activeTabDetails.description}
              </p>
            </header>
  
            <div className="mt-8">
              {activeAdminTab === "home" && (
                <AdminOverview
                  businesses={businesses}
                  clients={clients}
                  invitations={invitations}
                  projects={projects}
                  subscriptions={subscriptions}
                  businessesLoading={businessesLoading}
                  clientsLoading={clientsLoading}
                  invitationsLoading={invitationsLoading}
                  projectsLoading={projectsLoading}
                  subscriptionsLoading={subscriptionsLoading}
                  onTabChange={handleAdminTabChange}
                />
              )}
  
              {activeAdminTab === "businesses" && (
                <ΕπιχειρήσειςPanel
                  businesses={businesses}
                  loading={businessesLoading}
                  error={businessesError}
                  onBusinessCreated={(business) => {
                    setΕπιχειρήσεις((currentΕπιχειρήσεις) => [
                      business,
                      ...currentΕπιχειρήσεις,
                    ]);
                  }}
                  onBusinessUpdated={(updatedBusiness) => {
                    setΕπιχειρήσεις((currentΕπιχειρήσεις) =>
                      currentΕπιχειρήσεις.map((business) =>
                        business.id === updatedBusiness.id
                          ? updatedBusiness
                          : business,
                      ),
                    );
                  }}
                  onProjectCreated={(project) => {
                    setProjects((currentProjects) => [
                      project,
                      ...currentProjects,
                    ]);
                  }}
                  onBusinessDeleted={(businessId) => {
                    setΕπιχειρήσεις((currentΕπιχειρήσεις) =>
                      currentΕπιχειρήσεις.filter(
                        (business) =>
                          business.id !== businessId,
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
                  onProjectUpdated={(updatedProject) => {
                    setProjects((currentProjects) =>
                      currentProjects.map((project) =>
                        project.id === updatedProject.id
                          ? updatedProject
                          : project,
                      ),
                    );
                  }}
                />
              )}
  
              {activeAdminTab === "clients" && (
                <ClientsPanel
                  clients={clients}
                  admins={admins}
                  loading={clientsLoading}
                  error={clientsError}
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
                        invitation.id ===
                        updatedInvitation.id
                          ? updatedInvitation
                          : invitation,
                      ),
                    );
                  }}
                />
              )}

              {activeAdminTab === "subscriptions" && (
                <SubscriptionsPanel
                  subscriptions={subscriptions}
                  businesses={businesses}
                  loading={subscriptionsLoading}
                  error={subscriptionsError}
                  onSubscriptionSaved={(savedSubscription) => {
                    setSubscriptions((currentSubscriptions) => {
                      const exists = currentSubscriptions.some(
                        (subscription) =>
                          subscription.id === savedSubscription.id,
                      );

                      if (exists) {
                        return currentSubscriptions.map(
                          (subscription) =>
                            subscription.id === savedSubscription.id
                              ? savedSubscription
                              : subscription,
                        );
                      }

                      return [
                        savedSubscription,
                        ...currentSubscriptions,
                      ];
                    });
                  }}
                />
              )}
  
                {activeAdminTab === "invite" && (
                  <InviteClientPanel
                    businesses={businesses}
                  />
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function AdminSidebar({
  activeTab,
  adminEmail,
  sidebarOpen,
  setSidebarOpen,
  onTabChange,
  onLogout,
}: {
  activeTab: AdminTab;
  adminEmail: string;
  sidebarOpen: boolean;
  setSidebarOpen: (value: boolean) => void;
  onTabChange: (tab: AdminTab) => void;
  onLogout: () => void;
}) {
  return (
    <aside
      className={`fixed left-0 top-0 z-50 flex h-[100dvh] w-[280px] flex-col overflow-y-auto overscroll-contain bg-[#222] text-white shadow-2xl transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] lg:inset-y-0 lg:h-screen lg:overflow-hidden lg:overscroll-none lg:translate-x-0 lg:shadow-none ${
        sidebarOpen
          ? "translate-x-0"
          : "-translate-x-full"
      }`}
    >
      <div className="flex min-h-0 flex-1 flex-col p-5 sm:p-7 lg:h-screen">
       <div>
        <div className="flex items-center justify-between">
          <a
            href="https://zisto.app"
            className="inline-flex"
          >
            <img
              src="/images/zisto-wordmark-white.png"
              alt="Zisto"
              className="h-7 w-auto"
            />
          </a>
      
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="grid h-10 w-10 place-items-center rounded-full border border-white/10 text-[24px] font-light text-white lg:hidden"
          >
            ×
          </button>
        </div>
      
        <p className="mt-8 text-[10px] font-bold uppercase tracking-[0.24em] text-white/40">
          Admin dashboard
        </p>
      </div>

        <nav className="mt-8 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
          {ADMIN_TABS.map((tab) => {
            const isΕνεργό =
              activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"

                onClick={() => {
                  onTabChange(tab.id);
                  setSidebarOpen(false);
                }}
                
                className={`flex w-full items-center justify-between rounded-2xl px-4 py-4 text-left text-sm font-bold transition ${
                  isΕνεργό
                    ? "bg-white text-[#222]"
                    : "text-white/65 hover:bg-white/10 hover:text-white"
                }`}
              >
                <span>{tab.label}</span>

                <span
                  className={
                    isΕνεργό
                      ? "text-[#DC2727]"
                      : "text-white/25"
                  }
                >
                  →
                </span>
              </button>
            );
          })}
        </nav>

        <div className="mt-8 border-t border-white/10 pt-6 lg:mt-auto">
          <p className="truncate text-xs font-semibold text-white/70">
            {adminEmail}
          </p>

          <button
            type="button"
            onClick={onLogout}
            className="mt-4 w-full rounded-2xl border border-white/15 px-4 py-3 text-sm font-bold transition hover:bg-white hover:text-[#222]"
          >
            Αποσύνδεση
          </button>
        </div>
      </div>
    </aside>
  );
}

function AdminOverview({
  businesses,
  clients,
  invitations,
  projects,
  subscriptions,
  businessesLoading,
  clientsLoading,
  invitationsLoading,
  projectsLoading,
  subscriptionsLoading,
  onTabChange,
}: {
  businesses: Business[];
  clients: Client[];
  invitations: Invitation[];
  projects: ConnectedProject[];
  subscriptions: AdminSubscription[];
  businessesLoading: boolean;
  clientsLoading: boolean;
  invitationsLoading: boolean;
  projectsLoading: boolean;
  subscriptionsLoading: boolean;
  onTabChange: (tab: AdminTab) => void;
}) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-5">
      <AdminCard
        eyebrow="Management"
        title="Επιχειρήσεις"
        description={businessesLoading ? "Φόρτωση…" : `${businesses.length} συνολικά`}
        onClick={() =>
          onTabChange("businesses")
        }
      />

      <AdminCard
        eyebrow="Accounts"
        title="Πελάτες"
        description={clientsLoading ? "Φόρτωση…" : `${clients.length} συνολικά`}
        onClick={() =>
          onTabChange("clients")
        }
      />

      <AdminCard
        eyebrow="Custom projects"
        title="Συνδεδεμένα έργα"
        description={projectsLoading ? "Φόρτωση…" : `${projects.length} συνολικά`}
        onClick={() =>
          onTabChange("projects")
        }
      />

      <AdminCard
        eyebrow="Προσκλήσεις"
        title="Προσκλήσεις"
        description={invitationsLoading ? "Φόρτωση…" : `${invitations.length} συνολικά`}
        onClick={() =>
          onTabChange("invitations")
        }
      />

      <AdminCard
        eyebrow="Χρεώσεις"
        title="Συνδρομές"
        description={subscriptionsLoading ? "Φόρτωση…" : `${subscriptions.length} συνολικά`}
        onClick={() =>
          onTabChange("subscriptions")
        }
        dark
      />
    </div>
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

function ΕπιχειρήσειςPanel({
  businesses,
  loading,
  error,
  onBusinessCreated,
  onBusinessUpdated,
  onProjectCreated,
}: {
  businesses: Business[];
  loading: boolean;
  error: string;
  onBusinessCreated: (business: Business) => void;
  onBusinessUpdated: (business: Business) => void;
  onProjectCreated: (
    project: ConnectedProject,
  ) => void;
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
  const [editingBusinessId, setΕπεξεργασίαingBusinessId] =
    useState<string | null>(null);
  
  const [editName, setΕπεξεργασίαName] = useState("");
  const [editSlug, setΕπεξεργασίαSlug] = useState("");
  const [editTimezone, setΕπεξεργασίαTimezone] =
    useState("Europe/Athens");
  
  const [editStatus, setΕπεξεργασίαStatus] =
    useState<Business["status"]>("active");
  
  const [editDashboardModules, setΕπεξεργασίαDashboardModules] =
    useState<DashboardModule[]>([]);
  
  const [editSaving, setΕπεξεργασίαSaving] = useState(false);
  const [editError, setΕπεξεργασίαError] = useState("");

  const [deletingBusiness, setDeletingBusiness] =
    useState<Business | null>(null);
  
  const [deleteConfirmation, setDeleteConfirmation] =
    useState("");
  const [deleteSaving, setDeleteSaving] =
    useState(false);
  const [deleteError, setDeleteError] =
    useState("");

  const [connectingBusiness, setConnectingBusiness] =
    useState<Business | null>(null);
  const [smartLinkLiveUrl, setSmartLinkLiveUrl] =
    useState("");
  const [smartLinkGithubUrl, setSmartLinkGithubUrl] =
    useState("");
  const [smartLinkSaving, setSmartLinkSaving] =
    useState(false);
  const [smartLinkError, setSmartLinkError] =
    useState("");

  function startConnectingSmartLink(
    business: Business,
  ) {
    setConnectingBusiness(business);
    setSmartLinkLiveUrl("");
    setSmartLinkGithubUrl("");
    setSmartLinkError("");
  }

  function cancelConnectingSmartLink() {
    if (smartLinkSaving) {
      return;
    }

    setConnectingBusiness(null);
    setSmartLinkLiveUrl("");
    setSmartLinkGithubUrl("");
    setSmartLinkError("");
  }

  async function connectSmartLink(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!connectingBusiness) {
      return;
    }

    try {
      setSmartLinkSaving(true);
      setSmartLinkError("");

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
            business_id: connectingBusiness.id,
            name:
              `${connectingBusiness.name} Smart Link`,
            live_url: smartLinkLiveUrl.trim(),
            github_url:
              smartLinkGithubUrl.trim(),
            status: "active",
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
            "Could not connect Smart Link",
        );
      }

      onProjectCreated(result.project);

      onBusinessUpdated({
        ...connectingBusiness,
        setup_status: "active",
        smart_link: {
          id: result.project.id,
          name: result.project.name,
          live_url: result.project.live_url,
          github_url:
            result.project.github_url,
          project_key:
            result.project.project_key,
        },
      });

      cancelConnectingSmartLink();
    } catch (connectError) {
      console.error(
        "Smart Link connection failed:",
        connectError,
      );

      setSmartLinkError(
        connectError instanceof Error
          ? connectError.message
          : "Δεν ήταν δυνατή η σύνδεση του Smart Link.",
      );
    } finally {
      setSmartLinkSaving(false);
    }
  }

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
          dashboard_modules: [
            "analytics",
            "reviews",
            "menu",
            "nfc",
          ],
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

  function startΕπεξεργασίαingBusiness(business: Business) {
  setΕπεξεργασίαingBusinessId(business.id);
  setΕπεξεργασίαName(business.name);
  setΕπεξεργασίαSlug(business.slug);
  setΕπεξεργασίαTimezone(business.timezone);
  setΕπεξεργασίαStatus(business.status);
  setΕπεξεργασίαDashboardModules(
    business.dashboard_modules ?? [
      "analytics",
      "reviews",
      "menu",
      "nfc",
    ],
  );
  setΕπεξεργασίαError("");
}

function cancelΕπεξεργασίαingBusiness() {
  setΕπεξεργασίαingBusinessId(null);
  setΕπεξεργασίαName("");
  setΕπεξεργασίαSlug("");
  setΕπεξεργασίαTimezone("Europe/Athens");
  setΕπεξεργασίαStatus("active");
  setΕπεξεργασίαDashboardModules([]);
  setΕπεξεργασίαError("");
}

async function updateBusiness(
  businessId: string,
) {
  try {
    setΕπεξεργασίαSaving(true);
    setΕπεξεργασίαError("");

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
          dashboard_modules: editDashboardModules,
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
    cancelΕπεξεργασίαingBusiness();
  } catch (updateError) {
    console.error(
      "Business update failed:",
      updateError,
    );

    setΕπεξεργασίαError(
      updateError instanceof Error
        ? updateError.message
        : "Δεν ήταν δυνατή η ενημέρωση της επιχείρησης.",
    );
  } finally {
    setΕπεξεργασίαSaving(false);
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
  
  const editingBusiness =
    editingBusinessId
      ? businesses.find(
          (business) =>
            business.id === editingBusinessId,
        ) ?? null
      : null;

  const activeΕπιχειρήσεις = businesses.filter(
    (business) =>
      business.status === "active" &&
      business.setup_status === "active",
  ).length;

  if (loading) {
    return (
      <GlobalLoader
        fullScreen={false}
        message="Φόρτωση επιχειρήσεων..."
      />
    );
  }

  if (error) {
    return (
      <div className="mt-8 rounded-[24px] border border-red-200 bg-red-50 p-8 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#DC2727]">
          Σφάλμα φόρτωσης
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
            Επιχειρήσεις
          </p>

          <p className="mt-2 text-sm text-[#666]">
            {businesses.length} συνολικά ·{" "}
            {activeΕπιχειρήσεις} ενεργές
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
                <option value="active">Ενεργό</option>
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
            const isΕνεργό =
              business.status === "active" &&
              business.setup_status === "active";

            const setupRequired =
              business.setup_status ===
              "setup_required";

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
                          isΕνεργό
                            ? "bg-green-50 text-green-700"
                            : "bg-black/5 text-[#777]"
                        }`}
                      >
                        <span
                          className={`h-2 w-2 rounded-full ${
                            isΕνεργό
                              ? "bg-green-500"
                              : "bg-[#999]"
                          }`}
                        />

                        {setupRequired
                          ? "Setup required"
                          : isΕνεργό
                            ? "Ενεργός"
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
                              isΕνεργό
                                ? "animate-pulse bg-[#DC2727]"
                                : "bg-[#999]"
                            }`}
                          />

                          {setupRequired
                            ? "Setup required"
                            : isΕνεργό
                              ? "Live"
                              : "Paused"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex w-full items-center gap-3 lg:w-auto">
                    <button
                      type="button"
                      onClick={() =>
                        startΕπεξεργασίαingBusiness(business)
                      }
                      className="grid h-14 w-14 flex-shrink-0 place-items-center rounded-2xl border border-black/10 bg-white text-[#222] transition hover:border-[#222] hover:bg-[#F7F5F1]"
                      aria-label={`Επεξεργασία ${business.name}`}
                      title="Επεξεργασία επιχείρησης"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="h-5 w-5"
                        fill="none"
                        aria-hidden="true"
                      >
                        <path
                          d="M4 20h4l11-11a2.828 2.828 0 0 0-4-4L4 16v4Z"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="m13.5 6.5 4 4"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>
                  
                    <button
                      type="button"
                      onClick={() => {
                        window.location.hash =
                          `/dashboard?business=${business.id}`;
                      }}
                      className="min-h-14 flex-1 rounded-2xl bg-[#222] px-7 py-4 text-sm font-bold text-white transition hover:bg-[#DC2727] lg:flex-none"
                    >
                      Άνοιγμα πίνακα →
                    </button>
                  </div>
                </div>

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

      {editingBusiness && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 py-6 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !editSaving
            ) {
              cancelΕπεξεργασίαingBusiness();
            }
          }}
        >
          <div className="max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-[30px] bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-5 border-b border-black/8 bg-white/95 px-6 py-5 backdrop-blur-xl sm:px-8">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#DC2727]">
                  Επεξεργασία επιχείρησης
                </p>

                <h3 className="mt-2 text-2xl font-black tracking-[-0.04em] sm:text-3xl">
                  {editingBusiness.name}
                </h3>
              </div>

              <button
                type="button"
                onClick={cancelΕπεξεργασίαingBusiness}
                disabled={editSaving}
                className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-full border border-black/10 text-xl transition hover:bg-[#F7F5F1] disabled:opacity-50"
                aria-label="Κλείσιμο"
              >
                ×
              </button>
            </div>

            <div className="p-6 sm:p-8">
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#666]">
                    Business name
                  </span>

                  <input
                    type="text"
                    value={editName}
                    onChange={(event) =>
                      setΕπεξεργασίαName(event.target.value)
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
                        setΕπεξεργασίαSlug(
                          generateSlug(
                            event.target.value,
                          ),
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
                      setΕπεξεργασίαTimezone(
                        event.target.value,
                      )
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
                      setΕπεξεργασίαStatus(
                        event.target
                          .value as Business["status"],
                      )
                    }
                    className="mt-2 w-full rounded-2xl border border-black/10 bg-[#F7F5F1] px-4 py-4 text-sm outline-none transition focus:border-[#222]"
                  >
                    <option value="active">
                      Ενεργό
                    </option>
                    <option value="inactive">
                      Inactive
                    </option>
                  </select>
                </label>
              </div>

              <section className="mt-8 border-t border-black/8 pt-7">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#666]">
                      Ενότητες πίνακα
                    </p>
                    <p className="mt-2 max-w-xl text-sm leading-6 text-[#888]">
                      Διάλεξε ακριβώς ποιες ενότητες θα βλέπει ο client στο dashboard του.
                    </p>
                  </div>

                  <span className="w-fit rounded-full bg-[#222] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white">
                    {editDashboardModules.length} ενεργά
                  </span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {DASHBOARD_MODULE_OPTIONS.map(
                    (module) => {
                      const enabled =
                        editDashboardModules.includes(
                          module.id,
                        );

                      return (
                        <button
                          key={module.id}
                          type="button"
                          onClick={() => {
                            setΕπεξεργασίαDashboardModules(
                              (current) =>
                                current.includes(
                                  module.id,
                                )
                                  ? current.filter(
                                      (item) =>
                                        item !==
                                        module.id,
                                    )
                                  : [
                                      ...current,
                                      module.id,
                                    ],
                            );
                          }}
                          className={`rounded-2xl border p-4 text-left transition ${
                            enabled
                              ? "border-[#222] bg-[#222] text-white"
                              : "border-black/10 bg-[#F7F5F1] text-[#222] hover:border-[#222]/40"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-black">
                              {module.label}
                            </p>

                            <span
                              className={`grid h-6 w-6 place-items-center rounded-full text-[11px] font-black ${
                                enabled
                                  ? "bg-[#DC2727] text-white"
                                  : "border border-black/10 text-transparent"
                              }`}
                            >
                              ✓
                            </span>
                          </div>

                          <p
                            className={`mt-2 text-xs leading-5 ${
                              enabled
                                ? "text-white/55"
                                : "text-[#777]"
                            }`}
                          >
                            {module.description}
                          </p>
                        </button>
                      );
                    },
                  )}
                </div>

                <p className="mt-3 text-xs leading-5 text-[#999]">
                  Οι Ρυθμίσεις παραμένουν πάντα διαθέσιμες ως system tab.
                </p>
              </section>

              <section className="mt-8 border-t border-black/8 pt-7">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#666]">
                  Smart Link
                </p>

                {editingBusiness.setup_status ===
                "setup_required" ? (
                  <div className="mt-4 flex flex-col gap-4 rounded-2xl bg-[#F7F5F1] p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-black">
                        Δεν έχει συνδεθεί Smart Link
                      </p>
                      <p className="mt-1 text-xs leading-5 text-[#777]">
                        Σύνδεσέ το για να ενεργοποιηθεί πλήρως η επιχείρηση.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        startConnectingSmartLink(
                          editingBusiness,
                        );
                      }}
                      className="rounded-2xl bg-[#DC2727] px-5 py-3.5 text-sm font-bold text-white transition hover:bg-red-700"
                    >
                      + Σύνδεση Smart Link
                    </button>
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl bg-[#F7F5F1] p-5">
                    <p className="text-sm font-black">
                      {editingBusiness.smart_link?.name ??
                        "Smart Link connected"}
                    </p>
                    <p className="mt-1 break-all text-xs text-[#777]">
                      {editingBusiness.smart_link?.live_url}
                    </p>
                  </div>
                )}
              </section>

              {editError && (
                <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4">
                  <p className="text-sm font-semibold text-red-700">
                    {editError}
                  </p>
                </div>
              )}

              <section className="mt-8 border-t border-red-100 pt-7">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#DC2727]">
                  Danger zone
                </p>

                <div className="mt-4 flex flex-col gap-4 rounded-2xl border border-red-200 bg-red-50 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-black text-red-700">
                      Διαγραφή επιχείρησης
                    </p>
                    <p className="mt-1 text-xs leading-5 text-red-600/70">
                      Η ενέργεια χρειάζεται επιβεβαίωση και δεν μπορεί να αναιρεθεί.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      startDeletingBusiness(
                        editingBusiness,
                      )
                    }
                    className="rounded-2xl border border-red-200 bg-white px-5 py-3.5 text-sm font-bold text-[#DC2727] transition hover:border-[#DC2727]"
                  >
                    Delete
                  </button>
                </div>
              </section>

              <div className="mt-8 flex flex-col-reverse gap-3 border-t border-black/8 pt-6 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={cancelΕπεξεργασίαingBusiness}
                  disabled={editSaving}
                  className="rounded-2xl border border-black/10 px-6 py-4 text-sm font-bold transition hover:border-[#222] disabled:opacity-50"
                >
                  Ακύρωση
                </button>

                <button
                  type="button"
                  onClick={() =>
                    updateBusiness(
                      editingBusiness.id,
                    )
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
          </div>
        </div>
      )}

      {connectingBusiness && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 px-5 py-8">
          <form
            onSubmit={connectSmartLink}
            className="w-full max-w-xl rounded-[28px] bg-white p-6 shadow-2xl sm:p-8"
          >
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#DC2727]">
              Smart Link setup
            </p>

            <h3 className="mt-4 text-3xl font-black tracking-[-0.04em]">
              Σύνδεση Smart Link
            </h3>

            <p className="mt-3 text-sm leading-6 text-[#666]">
              Συνδέεις το custom Smart Link με την επιχείρηση{" "}
              <strong className="text-[#222]">
                {connectingBusiness.name}
              </strong>
              .
            </p>

            <div className="mt-6 grid gap-5">
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#666]">
                  Smart Link URL *
                </span>

                <input
                  type="url"
                  value={smartLinkLiveUrl}
                  onChange={(event) =>
                    setSmartLinkLiveUrl(
                      event.target.value,
                    )
                  }
                  required
                  placeholder="https://username.github.io/project/"
                  className="mt-2 w-full rounded-2xl border border-black/10 bg-[#F7F5F1] px-4 py-4 text-sm outline-none transition placeholder:text-[#AAA] focus:border-[#222]"
                />
              </label>

              <label className="block">
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#666]">
                  GitHub URL
                </span>

                <input
                  type="url"
                  value={smartLinkGithubUrl}
                  onChange={(event) =>
                    setSmartLinkGithubUrl(
                      event.target.value,
                    )
                  }
                  placeholder="https://github.com/username/project"
                  className="mt-2 w-full rounded-2xl border border-black/10 bg-[#F7F5F1] px-4 py-4 text-sm outline-none transition placeholder:text-[#AAA] focus:border-[#222]"
                />
              </label>
            </div>

            {smartLinkError && (
              <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4">
                <p className="text-sm font-semibold text-red-700">
                  {smartLinkError}
                </p>
              </div>
            )}

            <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={cancelConnectingSmartLink}
                disabled={smartLinkSaving}
                className="rounded-2xl border border-black/10 px-6 py-4 text-sm font-bold transition hover:border-[#222] disabled:opacity-50"
              >
                Ακύρωση
              </button>

              <button
                type="submit"
                disabled={
                  smartLinkSaving ||
                  !smartLinkLiveUrl.trim()
                }
                className="rounded-2xl bg-[#222] px-6 py-4 text-sm font-bold text-white transition hover:bg-[#DC2727] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {smartLinkSaving
                  ? "Σύνδεση..."
                  : "Σύνδεση Smart Link"}
              </button>
            </div>
          </form>
        </div>
      )}

      {deletingBusiness && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 px-5 py-8">
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
  onProjectUpdated,
}: {
  projects: ConnectedProject[];
  businesses: Business[];
  loading: boolean;
  error: string;
  onProjectCreated: (
    project: ConnectedProject,
  ) => void;
  onProjectUpdated: (
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

  const [editingProject, setΕπεξεργασίαingProject] =
    useState<ConnectedProject | null>(null);
  const [editName, setΕπεξεργασίαName] = useState("");
  const [editLiveUrl, setΕπεξεργασίαLiveUrl] = useState("");
  const [editGithubUrl, setΕπεξεργασίαGithubUrl] =
    useState("");
  const [editStatus, setΕπεξεργασίαStatus] =
    useState<ConnectedProject["status"]>("active");
  const [editSaving, setΕπεξεργασίαSaving] =
    useState(false);
  const [editError, setΕπεξεργασίαError] = useState("");

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

  function startΕπεξεργασίαingProject(
    project: ConnectedProject,
  ) {
    setΕπεξεργασίαingProject(project);
    setΕπεξεργασίαName(project.name);
    setΕπεξεργασίαLiveUrl(project.live_url);
    setΕπεξεργασίαGithubUrl(project.github_url ?? "");
    setΕπεξεργασίαStatus(project.status);
    setΕπεξεργασίαError("");
  }

  function cancelΕπεξεργασίαingProject() {
    if (editSaving) {
      return;
    }

    setΕπεξεργασίαingProject(null);
    setΕπεξεργασίαName("");
    setΕπεξεργασίαLiveUrl("");
    setΕπεξεργασίαGithubUrl("");
    setΕπεξεργασίαStatus("active");
    setΕπεξεργασίαError("");
  }

  async function updateProject(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!editingProject) {
      return;
    }

    try {
      setΕπεξεργασίαSaving(true);
      setΕπεξεργασίαError("");

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
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization:
              `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            id: editingProject.id,
            name: editName.trim(),
            live_url: editLiveUrl.trim(),
            github_url: editGithubUrl.trim(),
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
          result.error ||
            "Could not update connected project",
        );
      }

      onProjectUpdated(result.project);
      cancelΕπεξεργασίαingProject();
    } catch (updateError) {
      console.error(
        "Project update failed:",
        updateError,
      );

      setΕπεξεργασίαError(
        updateError instanceof Error
          ? updateError.message
          : "Δεν ήταν δυνατή η ενημέρωση του project.",
      );
    } finally {
      setΕπεξεργασίαSaving(false);
    }
  }

  const activeProjects = projects.filter(
    (project) => project.status === "active",
  ).length;

  if (loading) {
    return (
      <GlobalLoader
        fullScreen
        message="Φόρτωση admin workspace..."
      />
    );
  }

  if (error) {
    return (
      <div className="mt-8 rounded-[24px] border border-red-200 bg-red-50 p-8 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#DC2727]">
          Σφάλμα φόρτωσης
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
            Συνδεδεμένα προσαρμοσμένα έργα
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
              Νέο συνδεδεμένο έργο
            </h3>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#666]">
              Σύνδεσε το public Smart Link URL και το GitHub
              repository με μία επιχείρηση του Zisto.
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
                Smart Link URL
              </span>

              <input
                type="url"
                value={liveUrl}
                onChange={(event) =>
                  setLiveUrl(event.target.value)
                }
                required
                placeholder="https://username.github.io/project/"
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
                  Ενεργό
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
            const isΕνεργό =
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
                          isΕνεργό
                            ? "bg-green-50 text-green-700"
                            : "bg-black/5 text-[#777]"
                        }`}
                      >
                        <span
                          className={`h-2 w-2 rounded-full ${
                            isΕνεργό
                              ? "bg-green-500"
                              : "bg-[#999]"
                          }`}
                        />

                        {isΕνεργό
                          ? "Ενεργός"
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
                              isΕνεργό
                                ? "animate-pulse bg-[#DC2727]"
                                : "bg-[#999]"
                            }`}
                          />

                          {isΕνεργό
                            ? "Ready"
                            : "Paused"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex w-full flex-col gap-3 lg:w-auto">
                    <button
                      type="button"
                      onClick={() =>
                        startΕπεξεργασίαingProject(project)
                      }
                      className="w-full rounded-2xl border border-black/10 bg-white px-7 py-4 text-center text-sm font-bold transition hover:border-[#222] lg:w-auto"
                    >
                      Επεξεργασία
                    </button>

                    <a
                      href={project.live_url}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full rounded-2xl bg-[#222] px-7 py-4 text-center text-sm font-bold text-white transition hover:bg-[#DC2727] lg:w-auto"
                    >
                      Άνοιγμα Smart Link →
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

      {editingProject && (
        <div className="fixed inset-0 z-[300] grid place-items-center bg-black/55 p-5 backdrop-blur-sm">
          <section className="w-full max-w-[560px] rounded-[28px] bg-white p-7 shadow-2xl md:p-9">
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#DC2727]">
                  Επεξεργασία συνδεδεμένου έργου
                </p>

                <h3 className="mt-3 text-3xl font-black tracking-[-0.04em]">
                  Επεξεργασία Project
                </h3>
              </div>

              <button
                type="button"
                onClick={cancelΕπεξεργασίαingProject}
                disabled={editSaving}
                className="grid h-10 w-10 place-items-center rounded-full bg-[#F4F4F2] text-lg font-bold disabled:opacity-50"
                aria-label="Κλείσιμο"
              >
                ×
              </button>
            </div>

            <form
              onSubmit={updateProject}
              className="mt-8 grid gap-5"
            >
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#666]">
                  Project name
                </span>

                <input
                  type="text"
                  value={editName}
                  onChange={(event) =>
                    setΕπεξεργασίαName(event.target.value)
                  }
                  required
                  maxLength={120}
                  disabled={editSaving}
                  className="mt-2 w-full rounded-2xl border border-black/10 bg-[#F7F5F1] px-4 py-4 text-sm outline-none transition focus:border-[#222] disabled:opacity-60"
                />
              </label>

              <label className="block">
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#666]">
                  Smart Link URL
                </span>

                <input
                  type="url"
                  value={editLiveUrl}
                  onChange={(event) =>
                    setΕπεξεργασίαLiveUrl(event.target.value)
                  }
                  required
                  disabled={editSaving}
                  placeholder="https://username.github.io/project/"
                  className="mt-2 w-full rounded-2xl border border-black/10 bg-[#F7F5F1] px-4 py-4 text-sm outline-none transition focus:border-[#222] disabled:opacity-60"
                />
              </label>

              <label className="block">
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#666]">
                  GitHub URL
                </span>

                <input
                  type="url"
                  value={editGithubUrl}
                  onChange={(event) =>
                    setΕπεξεργασίαGithubUrl(event.target.value)
                  }
                  disabled={editSaving}
                  placeholder="https://github.com/username/project"
                  className="mt-2 w-full rounded-2xl border border-black/10 bg-[#F7F5F1] px-4 py-4 text-sm outline-none transition focus:border-[#222] disabled:opacity-60"
                />
              </label>

              <label className="block">
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#666]">
                  Status
                </span>

                <select
                  value={editStatus}
                  onChange={(event) =>
                    setΕπεξεργασίαStatus(
                      event.target
                        .value as ConnectedProject["status"],
                    )
                  }
                  disabled={editSaving}
                  className="mt-2 w-full rounded-2xl border border-black/10 bg-[#F7F5F1] px-4 py-4 text-sm outline-none transition focus:border-[#222] disabled:opacity-60"
                >
                  <option value="active">
                    Ενεργό
                  </option>

                  <option value="inactive">
                    Inactive
                  </option>
                </select>
              </label>

              {editError && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                  <p className="text-sm font-semibold text-red-700">
                    {editError}
                  </p>
                </div>
              )}

              <div className="mt-2 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={cancelΕπεξεργασίαingProject}
                  disabled={editSaving}
                  className="rounded-2xl border border-black/10 px-6 py-4 text-sm font-bold transition hover:border-[#222] disabled:opacity-50"
                >
                  Ακύρωση
                </button>

                <button
                  type="submit"
                  disabled={
                    editSaving ||
                    !editName.trim() ||
                    !editLiveUrl.trim()
                  }
                  className="rounded-2xl bg-[#222] px-6 py-4 text-sm font-bold text-white transition hover:bg-[#DC2727] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {editSaving
                    ? "Αποθήκευση..."
                    : "Αποθήκευση αλλαγών"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

function ClientsPanel({
  clients,
  admins,
  loading,
  error,
  onClientRoleChanged = () => {},
  onClientΑφαίρεσηd = () => {},
}: {
  clients: Client[];
  admins: AdminAccount[];
  loading: boolean;
  error: string;
  onClientRoleChanged?: (
    userId: string,
    businessId: string,
    role: Client["role"],
  ) => void;
  onClientΑφαίρεσηd?: (
    userId: string,
    businessId: string,
  ) => void;
}) {
  const [editingClientKey, setΕπεξεργασίαingClientKey] =
    useState<string | null>(null);

  const [selectedRole, setSelectedRole] =
    useState<Client["role"]>("staff");

  const [savingClientKey, setSavingClientKey] =
    useState<string | null>(null);

  const [actionError, setActionError] = useState("");

  function getClientKey(client: Client) {
    return `${client.id}-${client.business_id}`;
  }

  function startΕπεξεργασίαing(client: Client) {
    setActionError("");
    setSelectedRole(client.role);
    setΕπεξεργασίαingClientKey(getClientKey(client));
  }

  function cancelΕπεξεργασίαing() {
    setΕπεξεργασίαingClientKey(null);
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

      setΕπεξεργασίαingClientKey(null);
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

      onClientΑφαίρεσηd(
        client.id,
        client.business_id,
      );

      setΕπεξεργασίαingClientKey(null);
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
      <GlobalLoader
        fullScreen={false}
        message="Φόρτωση clients..."
      />
    );
  }

  if (error) {
    return (
      <div className="rounded-[24px] border border-red-200 bg-red-50 p-8 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#DC2727]">
          Σφάλμα φόρτωσης
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

  const activeClients = clients.filter(
    (client) => client.status === "active",
  ).length;

  const invitedClients = clients.filter(
    (client) => client.status === "invited",
  ).length;

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[28px] border border-black/10 bg-[#222] text-white">
        <div className="flex flex-col gap-3 border-b border-white/10 px-6 py-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#DC2727]">
              Ομάδα Zisto
            </p>
            <h3 className="mt-2 text-2xl font-black tracking-[-0.035em]">
              Διαχειριστές Zisto
            </h3>
            <p className="mt-2 text-sm text-white/55">
              Εσωτερικοί διαχειριστές της πλατφόρμας. Δεν υπολογίζονται ως clients.
            </p>
          </div>

          <span className="inline-flex w-fit rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white/65">
            {admins.length} admins
          </span>
        </div>

        {admins.length === 0 ? (
          <div className="px-6 py-8 text-sm text-white/50">
            Δεν υπάρχουν καταχωρημένοι Zisto admins.
          </div>
        ) : (
          <div className="grid gap-px bg-white/10 sm:grid-cols-2">
            {admins.map((admin) => {
              const displayName =
                admin.full_name.trim() ||
                admin.email.split("@")[0] ||
                "Admin";

              const initials = displayName
                .split(" ")
                .filter(Boolean)
                .slice(0, 2)
                .map((part) =>
                  part.charAt(0).toUpperCase(),
                )
                .join("");

              const isΕνεργό =
                Boolean(admin.last_sign_in_at);

              return (
                <article
                  key={admin.id}
                  className="bg-[#222] p-6"
                >
                  <div className="flex items-start gap-4">
                    <div className="grid h-12 w-12 flex-shrink-0 place-items-center rounded-full bg-[#DC2727] text-sm font-black text-white">
                      {initials || "A"}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-black">
                          {displayName}
                        </p>
                        <span className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-white/60">
                          Admin
                        </span>
                      </div>

                      <p className="mt-1 truncate text-sm text-white/50">
                        {admin.email}
                      </p>

                      <div className="mt-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em]">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            isΕνεργό
                              ? "bg-green-400"
                              : "bg-white/25"
                          }`}
                        />
                        <span className="text-white/45">
                          {isΕνεργό
                            ? "Ενεργός λογαριασμός"
                            : "Χωρίς σύνδεση ακόμη"}
                        </span>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

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
          label="Προσκεκλημένοι"
          value={invitedClients}
        />
      </div>

      {actionError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
          {actionError}
        </div>
      )}

      {clients.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-black/15 bg-[#F7F5F1] p-8 text-center">
          <h3 className="text-2xl font-black tracking-[-0.03em]">
            Δεν υπάρχουν clients
          </h3>
          <p className="mt-3 text-sm text-[#666]">
            Οι clients που προσκαλείς θα εμφανίζονται εδώ.
          </p>
        </div>
      ) : (
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

            const isΕπεξεργασίαing =
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

                  {isΕπεξεργασίαing ? (
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
                      ? "Ενεργός"
                      : "Προσκεκλημένος"}
                  </span>
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#999] xl:hidden">
                    Ενέργειες
                  </p>

                  {isΕπεξεργασίαing ? (
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
                          : "Αποθήκευση"}
                      </button>

                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={cancelΕπεξεργασίαing}
                        className="rounded-xl border border-black/10 px-4 py-2.5 text-xs font-bold transition hover:border-[#222] disabled:opacity-50"
                      >
                        Ακύρωση
                      </button>

                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() =>
                          removeClient(client)
                        }
                        className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                      >
                        Αφαίρεση
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => startΕπεξεργασίαing(client)}
                      className="mt-2 rounded-xl border border-black/10 bg-white px-4 py-2.5 text-xs font-bold transition hover:border-[#222] hover:bg-[#F7F5F1] xl:mt-0"
                    >
                      Επεξεργασία
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>
      )}
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

      console.log(result);
  
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
  
  if (loading) {
    return (
      <GlobalLoader
        fullScreen={false}
        message="Φόρτωση προσκλήσεων..."
      />
    );
  }

  if (error) {
    return (
      <div className="rounded-[24px] border border-red-200 bg-red-50 p-8 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#DC2727]">
          Σφάλμα φόρτωσης
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

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { GlobalLoader } from "../ui/GlobalLoader";
import { supabase } from "../../lib/supabase";

export type AdminSubscription = {
  id: string;
  business_id: string;
  billing_email: string | null;
  amount_cents: number;
  currency: string;
  vat_rate: number;
  billing_interval_months: number;
  billing_status:
    | "draft"
    | "active"
    | "past_due"
    | "cancelled";
  access_status:
    | "active"
    | "grace_period"
    | "suspended";
  starts_at: string;
  next_billing_at: string | null;
  payment_due_at: string | null;
  grace_until: string | null;
  last_paid_at: string | null;
  notes: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  overdue_email_sent_at: string | null;
  suspended_at: string | null;
  suspension_email_sent_at: string | null;
  created_at: string;
  updated_at: string;
  businesses:
    | {
        id: string;
        name: string;
        slug: string;
        status: string;
      }
    | {
        id: string;
        name: string;
        slug: string;
        status: string;
      }[]
    | null;
};

type BusinessOption = {
  id: string;
  name: string;
  slug: string;
};

function businessOf(
  subscription: AdminSubscription,
) {
  return Array.isArray(subscription.businesses)
    ? subscription.businesses[0] ?? null
    : subscription.businesses;
}

function formatMoney(
  cents: number,
  currency = "EUR",
) {
  return new Intl.NumberFormat("el-GR", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

function formatDate(
  value: string | null,
) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("el-GR", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function intervalLabel(months: number) {
  if (months === 1) return "Κάθε μήνα";
  if (months === 3) return "Κάθε 3 μήνες";
  if (months === 6) return "Κάθε 6 μήνες";
  if (months === 12) return "Κάθε χρόνο";
  return `Κάθε ${months} μήνες`;
}

function billingStatusLabel(
  value: AdminSubscription["billing_status"],
) {
  const labels = {
    draft: "Draft",
    active: "Ενεργή",
    past_due: "Σε καθυστέρηση",
    cancelled: "Ακυρωμένη",
  };

  return labels[value];
}

function accessStatusLabel(
  value: AdminSubscription["access_status"],
) {
  const labels = {
    active: "Active",
    grace_period: "Grace period",
    suspended: "Suspended",
  };

  return labels[value];
}

export function SubscriptionsPanel({
  subscriptions,
  businesses,
  loading,
  error,
  onSubscriptionSaved,
}: {
  subscriptions: AdminSubscription[];
  businesses: BusinessOption[];
  loading: boolean;
  error: string;
  onSubscriptionSaved: (
    subscription: AdminSubscription,
  ) => void;
}) {
  const [showForm, setShowForm] =
    useState(false);
  const [businessId, setBusinessId] =
    useState("");
  const [billingEmail, setBillingEmail] =
    useState("");
  const [amount, setAmount] =
    useState("");
  const [vatRate, setVatRate] =
    useState("24");
  const [
    billingIntervalMonths,
    setBillingIntervalMonths,
  ] = useState("1");
  const [startsAt, setStartsAt] =
    useState(() =>
      new Date().toISOString().slice(0, 10),
    );
  const [notes, setNotes] =
    useState("");
  const [saving, setSaving] =
    useState(false);
  const [
    openingCheckoutId,
    setOpeningCheckoutId,
  ] = useState<string | null>(null);
  const [formError, setFormError] =
    useState("");
  const [
    runningBillingCheck,
    setRunningBillingCheck,
  ] = useState(false);
  const [
    billingCheckResult,
    setBillingCheckResult,
  ] = useState<{
    checked: number;
    reminders_sent: number;
    suspended: number;
    suspension_emails_sent: number;
  } | null>(null);

  const [
    billingDocuments,
    setBillingDocuments,
  ] = useState<any[]>([]);
  const [
    billingEvents,
    setBillingEvents,
  ] = useState<any[]>([]);
  const [
    loadingBillingHistory,
    setLoadingBillingHistory,
  ] = useState(false);
  const [
    billingHistoryError,
    setBillingHistoryError,
  ] = useState("");

  async function loadAdminBillingHistory() {
    try {
      setLoadingBillingHistory(true);
      setBillingHistoryError("");

      const {
        data: { session },
      } =
        await supabase.auth.getSession();

      if (!session) {
        return;
      }

      const response =
        await fetch(
          "/api/admin/subscriptions?view=billing-history",
          {
            headers: {
              Authorization:
                `Bearer ${session.access_token}`,
            },
            cache: "no-store",
          },
        );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Δεν φορτώθηκε το billing history.",
        );
      }

      setBillingDocuments(
        Array.isArray(result.documents)
          ? result.documents
          : [],
      );
      setBillingEvents(
        Array.isArray(result.events)
          ? result.events
          : [],
      );
    } catch (historyError) {
      setBillingHistoryError(
        historyError instanceof Error
          ? historyError.message
          : "Δεν φορτώθηκε το billing history.",
      );
    } finally {
      setLoadingBillingHistory(false);
    }
  }

  useEffect(() => {
    void loadAdminBillingHistory();
  }, []);


  const subscribedBusinessIds =
    useMemo(
      () =>
        new Set(
          subscriptions.map(
            (subscription) =>
              subscription.business_id,
          ),
        ),
      [subscriptions],
    );

  const availableBusinesses =
    businesses.filter(
      (business) =>
        !subscribedBusinessIds.has(
          business.id,
        ),
    );

  const activeCount =
    subscriptions.filter(
      (subscription) =>
        subscription.billing_status ===
          "active" &&
        subscription.access_status ===
          "active",
    ).length;

  const overdueCount =
    subscriptions.filter(
      (subscription) =>
        subscription.billing_status ===
        "past_due",
    ).length;

  const suspendedCount =
    subscriptions.filter(
      (subscription) =>
        subscription.access_status ===
        "suspended",
    ).length;

  const monthlyEquivalentCents =
    subscriptions
      .filter(
        (subscription) =>
          subscription.billing_status ===
          "active",
      )
      .reduce(
        (sum, subscription) =>
          sum +
          subscription.amount_cents /
            Math.max(
              subscription.billing_interval_months,
              1,
            ),
        0,
      );

  async function runBillingCheck() {
    try {
      setRunningBillingCheck(true);
      setFormError("");
      setBillingCheckResult(null);

      const {
        data: { session },
        error: sessionError,
      } =
        await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      if (!session) {
        window.location.hash = "/login";
        return;
      }

      const controller =
        new AbortController();
      const timeout = window.setTimeout(
        () => controller.abort(),
        12000,
      );

      let response: Response;

      try {
        response = await fetch(
          "/api/admin/subscriptions",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
              Authorization:
                `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              action:
                "run_billing_check",
            }),
            signal:
              controller.signal,
          },
        );
      } finally {
        window.clearTimeout(
          timeout,
        );
      }

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Δεν ήταν δυνατός ο έλεγχος billing.",
        );
      }

      setBillingCheckResult({
        checked:
          Number(result.checked) || 0,
        reminders_sent:
          Number(
            result.reminders_sent,
          ) || 0,
        suspended:
          Number(result.suspended) || 0,
        suspension_emails_sent:
          Number(
            result.suspension_emails_sent,
          ) || 0,
      });

      const refreshResponse =
        await fetch(
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

      const refreshResult =
        await refreshResponse.json();

      if (refreshResponse.ok) {
        for (
          const subscription of
          refreshResult.subscriptions ??
          []
        ) {
          onSubscriptionSaved(
            subscription,
          );
        }
      }
    } catch (runError) {
      setFormError(
        runError instanceof DOMException &&
          runError.name ===
            "AbortError"
          ? "Ο έλεγχος billing άργησε να απαντήσει. Δοκίμασε ξανά."
          : runError instanceof Error
            ? runError.message
            : "Δεν ήταν δυνατός ο έλεγχος billing.",
      );
    } finally {
      setRunningBillingCheck(false);
    }
  }

  function resetForm() {
    setBusinessId("");
    setBillingEmail("");
    setAmount("");
    setVatRate("24");
    setBillingIntervalMonths("1");
    setStartsAt(
      new Date().toISOString().slice(0, 10),
    );
    setNotes("");
    setFormError("");
  }

  async function createSubscription(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const parsedAmount =
      Number.parseFloat(
        amount.replace(",", "."),
      );

    if (
      !Number.isFinite(parsedAmount) ||
      parsedAmount < 0
    ) {
      setFormError(
        "Βάλε ένα έγκυρο ποσό συνδρομής.",
      );
      return;
    }

    try {
      setSaving(true);
      setFormError("");

      const {
        data: { session },
        error: sessionError,
      } =
        await supabase.auth.getSession();

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
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
            Authorization:
              `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            business_id: businessId,
            billing_email:
              billingEmail.trim() || null,
            amount_cents:
              Math.round(
                parsedAmount * 100,
              ),
            vat_rate:
              Number(vatRate),
            billing_interval_months:
              Number(
                billingIntervalMonths,
              ),
            billing_status: "draft",
            access_status: "active",
            starts_at:
              new Date(
                `${startsAt}T00:00:00`,
              ).toISOString(),
            notes: notes.trim() || null,
          }),
        },
      );

      const result =
        await response.json();

      if (response.status === 401) {
        await supabase.auth.signOut();
        window.location.hash = "/login";
        return;
      }

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Could not create subscription",
        );
      }

      onSubscriptionSaved(
        result.subscription,
      );
      resetForm();
      setShowForm(false);
    } catch (createError) {
      setFormError(
        createError instanceof Error
          ? createError.message
          : "Δεν ήταν δυνατή η δημιουργία της συνδρομής.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function openStripeCheckout(
    subscription: AdminSubscription,
  ) {
    try {
      setOpeningCheckoutId(
        subscription.id,
      );
      setFormError("");

      const {
        data: { session },
        error: sessionError,
      } =
        await supabase.auth.getSession();

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
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
            Authorization:
              `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            action:
              "create_checkout",
            id: subscription.id,
          }),
        },
      );

      const result =
        await response.json();

      if (response.status === 401) {
        await supabase.auth.signOut();
        window.location.hash = "/login";
        return;
      }

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Δεν ήταν δυνατή η δημιουργία του Stripe Checkout.",
        );
      }

      if (!result.checkout_url) {
        throw new Error(
          "Η Stripe δεν επέστρεψε Checkout URL.",
        );
      }

      window.location.href =
        result.checkout_url;
    } catch (checkoutError) {
      setFormError(
        checkoutError instanceof Error
          ? checkoutError.message
          : "Δεν ήταν δυνατό να ανοίξει το Stripe Checkout.",
      );
      setOpeningCheckoutId(null);
    }
  }

  if (loading) {
    return (
      <GlobalLoader
        fullScreen={false}
        message="Φόρτωση συνδρομών..."
      />
    );
  }

  if (error) {
    return (
      <div className="rounded-[24px] border border-red-200 bg-red-50 p-8 text-center">
        <h3 className="text-2xl font-black">
          Δεν φορτώθηκαν οι συνδρομές
        </h3>
        <p className="mt-3 text-sm text-red-700">
          {error}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Ενεργές",
            value: activeCount,
          },
          {
            label: "Σε καθυστέρηση",
            value: overdueCount,
          },
          {
            label: "Suspended",
            value: suspendedCount,
          },
          {
            label: "Monthly equivalent",
            value: formatMoney(
              Math.round(
                monthlyEquivalentCents,
              ),
            ),
          },
        ].map((item) => (
          <article
            key={item.label}
            className="rounded-[24px] border border-black/10 bg-white p-6"
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#888]">
              {item.label}
            </p>
            <p className="mt-4 text-4xl font-black tracking-[-0.05em]">
              {item.value}
            </p>
          </article>
        ))}
      </section>

      <section className="rounded-[28px] border border-black/10 bg-white p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#DC2727]">
              Billing
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.04em]">
              Custom συνδρομές
            </h2>
            <p className="mt-2 text-sm text-[#666]">
              Κάθε επιχείρηση έχει τη δική της συμφωνημένη τιμή και περίοδο χρέωσης.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => {
                void runBillingCheck();
              }}
              disabled={
                runningBillingCheck
              }
              className="rounded-2xl border border-black/10 bg-white px-5 py-4 text-sm font-bold text-[#222] transition hover:border-[#222] disabled:opacity-50"
            >
              {runningBillingCheck
                ? "Έλεγχος billing..."
                : "Run billing check"}
            </button>

            <button
              type="button"
              onClick={() => {
                setShowForm(
                  (current) => !current,
                );
                setFormError("");
              }}
              className="rounded-2xl bg-[#222] px-6 py-4 text-sm font-bold text-white transition hover:bg-[#DC2727]"
            >
              {showForm
                ? "Κλείσιμο"
                : "+ Νέα συνδρομή"}
            </button>
          </div>
        </div>

        {billingCheckResult && (
          <div className="mt-6 grid gap-3 rounded-[20px] border border-black/8 bg-[#F7F5F1] p-5 text-sm sm:grid-cols-4">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#888]">
                Checked
              </p>
              <p className="mt-2 text-xl font-black">
                {billingCheckResult.checked}
              </p>
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#888]">
                Reminders
              </p>
              <p className="mt-2 text-xl font-black">
                {billingCheckResult.reminders_sent}
              </p>
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#888]">
                Suspended
              </p>
              <p className="mt-2 text-xl font-black">
                {billingCheckResult.suspended}
              </p>
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#888]">
                Suspension emails
              </p>
              <p className="mt-2 text-xl font-black">
                {
                  billingCheckResult
                    .suspension_emails_sent
                }
              </p>
            </div>
          </div>
        )}

        {showForm && (
          <form
            onSubmit={createSubscription}
            className="mt-7 grid gap-5 border-t border-black/10 pt-7 sm:grid-cols-2"
          >
            <label className="block sm:col-span-2">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#666]">
                Επιχείρηση
              </span>
              <select
                value={businessId}
                onChange={(event) =>
                  setBusinessId(
                    event.target.value,
                  )
                }
                required
                className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-4 py-4 text-sm outline-none focus:border-[#222]"
              >
                <option value="">
                  Επιλογή επιχείρησης
                </option>
                {availableBusinesses.map(
                  (business) => (
                    <option
                      key={business.id}
                      value={business.id}
                    >
                      {business.name}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label>
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#666]">
                Ποσό χωρίς ΦΠΑ
              </span>
              <div className="mt-2 flex rounded-2xl border border-black/10 bg-white focus-within:border-[#222]">
                <input
                  value={amount}
                  onChange={(event) =>
                    setAmount(
                      event.target.value,
                    )
                  }
                  inputMode="decimal"
                  required
                  placeholder="35.00"
                  className="min-w-0 flex-1 bg-transparent px-4 py-4 text-sm outline-none"
                />
                <span className="flex items-center px-4 text-sm font-bold text-[#777]">
                  €
                </span>
              </div>
            </label>

            <label>
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#666]">
                ΦΠΑ %
              </span>
              <input
                value={vatRate}
                onChange={(event) =>
                  setVatRate(
                    event.target.value,
                  )
                }
                inputMode="decimal"
                required
                className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-4 py-4 text-sm outline-none focus:border-[#222]"
              />
            </label>

            <label>
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#666]">
                Περίοδος χρέωσης
              </span>
              <select
                value={
                  billingIntervalMonths
                }
                onChange={(event) =>
                  setBillingIntervalMonths(
                    event.target.value,
                  )
                }
                className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-4 py-4 text-sm outline-none focus:border-[#222]"
              >
                <option value="1">
                  Κάθε μήνα
                </option>
                <option value="3">
                  Κάθε 3 μήνες
                </option>
                <option value="6">
                  Κάθε 6 μήνες
                </option>
                <option value="12">
                  Κάθε χρόνο
                </option>
              </select>
            </label>

            <label>
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#666]">
                Billing email
              </span>
              <input
                type="email"
                value={billingEmail}
                onChange={(event) =>
                  setBillingEmail(
                    event.target.value,
                  )
                }
                placeholder="billing@example.com"
                className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-4 py-4 text-sm outline-none focus:border-[#222]"
              />
            </label>

            <label>
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#666]">
                Έναρξη
              </span>
              <input
                type="date"
                value={startsAt}
                onChange={(event) =>
                  setStartsAt(
                    event.target.value,
                  )
                }
                required
                className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-4 py-4 text-sm outline-none focus:border-[#222]"
              />
            </label>

            <label className="sm:col-span-2">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#666]">
                Σημειώσεις συμφωνίας
              </span>
              <textarea
                value={notes}
                onChange={(event) =>
                  setNotes(
                    event.target.value,
                  )
                }
                rows={3}
                placeholder="π.χ. Review + Appointments, custom onboarding..."
                className="mt-2 w-full resize-none rounded-2xl border border-black/10 bg-white px-4 py-4 text-sm outline-none focus:border-[#222]"
              />
            </label>

            {formError && (
              <p className="sm:col-span-2 rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {formError}
              </p>
            )}

            <div className="sm:col-span-2 flex justify-end">
              <button
                type="submit"
                disabled={
                  saving || !businessId
                }
                className="rounded-2xl bg-[#DC2727] px-6 py-4 text-sm font-bold text-white transition hover:bg-[#222] disabled:opacity-50"
              >
                {saving
                  ? "Αποθήκευση..."
                  : "Δημιουργία συνδρομής"}
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="overflow-hidden rounded-[22px] border border-black/10 bg-white sm:rounded-[28px]">
        {subscriptions.length === 0 ? (
          <div className="p-10 text-center">
            <h3 className="text-xl font-black">
              Δεν υπάρχουν συνδρομές ακόμη
            </h3>
            <p className="mt-2 text-sm text-[#666]">
              Δημιούργησε την πρώτη custom συμφωνία.
            </p>
          </div>
        ) : (
          <>
            <table className="hidden w-full table-fixed border-collapse xl:table">
              <colgroup>
                <col style={{ width: "16%" }} />
                <col style={{ width: "15%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "19%" }} />
                <col style={{ width: "12%" }} />
              </colgroup>

              <thead className="bg-[#F7F5F1] text-left text-[10px] font-bold uppercase tracking-[0.18em] text-[#777]">
                <tr className="border-b border-black/[0.06]">
                  <th className="h-14 px-6 font-bold">
                    Επιχείρηση
                  </th>
                  <th className="h-14 border-l border-black/[0.05] px-5 font-bold">
                    Χρέωση
                  </th>
                  <th className="h-14 border-l border-black/[0.05] px-5 font-bold">
                    Billing
                  </th>
                  <th className="h-14 border-l border-black/[0.05] px-5 font-bold">
                    Access
                  </th>
                  <th className="h-14 border-l border-black/[0.05] px-5 font-bold">
                    Επόμενη
                  </th>
                  <th className="h-14 border-l border-black/[0.05] px-5 font-bold">
                    Email
                  </th>
                  <th className="h-14 border-l border-black/[0.05] px-5 font-bold">
                    Stripe
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-black/[0.06]">
                {subscriptions.map(
                  (subscription) => {
                    const business =
                      businessOf(
                        subscription,
                      );

                    const totalCents =
                      subscription.amount_cents *
                      (1 +
                        Number(
                          subscription.vat_rate,
                        ) /
                          100);

                    return (
                      <tr
                        key={subscription.id}
                        className="align-middle"
                      >
                        <td className="h-[96px] px-6">
                          <p className="font-black">
                            {business?.name ??
                              "Άγνωστη επιχείρηση"}
                          </p>
                          <p className="mt-1 font-mono text-[10px] text-[#999]">
                            {business?.slug
                              ? `/${business.slug}`
                              : subscription.business_id}
                          </p>
                        </td>

                        <td className="h-[96px] border-l border-black/[0.05] px-5">
                          <p className="font-black">
                            {formatMoney(
                              subscription.amount_cents,
                              subscription.currency,
                            )}
                          </p>
                          <p className="mt-1 text-xs leading-4 text-[#777]">
                            {intervalLabel(
                              subscription.billing_interval_months,
                            )}{" "}
                            · {subscription.vat_rate}% ΦΠΑ
                          </p>
                          <p className="mt-1 text-[10px] text-[#999]">
                            Σύνολο{" "}
                            {formatMoney(
                              Math.round(
                                totalCents,
                              ),
                              subscription.currency,
                            )}
                          </p>
                        </td>

                        <td className="h-[96px] border-l border-black/[0.05] px-5">
                          <span className={`inline-flex max-w-full items-center justify-center whitespace-normal break-words rounded-full px-2.5 py-1.5 text-center text-[9px] font-black uppercase leading-4 tracking-[0.08em] ${
                            subscription.billing_status ===
                            "past_due"
                              ? "bg-red-100 text-red-700"
                              : subscription.billing_status ===
                                "active"
                                ? "bg-green-100 text-green-700"
                                : "bg-[#F1F1EF] text-[#666]"
                          }`}>
                            {billingStatusLabel(
                              subscription.billing_status,
                            )}
                          </span>
                        </td>

                        <td className="h-[96px] border-l border-black/[0.05] px-5">
                          <span className={`inline-flex max-w-full items-center justify-center whitespace-normal break-words rounded-full px-2.5 py-1.5 text-center text-[9px] font-black uppercase leading-4 tracking-[0.08em] ${
                            subscription.access_status ===
                            "suspended"
                              ? "bg-red-100 text-red-700"
                              : subscription.access_status ===
                                "grace_period"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-[#F1F1EF] text-[#555]"
                          }`}>
                            {accessStatusLabel(
                              subscription.access_status,
                            )}
                          </span>
                        </td>

                        <td className="h-[96px] border-l border-black/[0.05] px-5">
                          <p className="text-sm font-bold leading-5">
                            {formatDate(
                              subscription.next_billing_at,
                            )}
                          </p>
                          {subscription.payment_due_at && (
                            <p className="mt-1 text-[10px] leading-4 text-[#999]">
                              Due{" "}
                              {formatDate(
                                subscription.payment_due_at,
                              )}
                            </p>
                          )}
                        </td>

                        <td className="h-[96px] border-l border-black/[0.05] px-5">
                          <p className="truncate text-sm text-[#666]">
                            {subscription.billing_email ??
                              "—"}
                          </p>
                        </td>

                        <td className="h-[96px] border-l border-black/[0.05] px-5">
                          {subscription.stripe_subscription_id ? (
                            <span className="inline-flex rounded-full bg-green-100 px-3 py-2 text-[9px] font-black uppercase tracking-[0.1em] text-green-700">
                              Connected
                            </span>
                          ) : subscription.billing_status === "draft" ? (
                            <button
                              type="button"
                              onClick={() =>
                                openStripeCheckout(
                                  subscription,
                                )
                              }
                              disabled={
                                openingCheckoutId ===
                                subscription.id
                              }
                              className="rounded-xl bg-[#635BFF] px-3 py-2.5 text-[10px] font-black text-white transition hover:bg-[#222] disabled:opacity-50"
                            >
                              {openingCheckoutId ===
                              subscription.id
                                ? "Άνοιγμα..."
                                : "Stripe Checkout"}
                            </button>
                          ) : (
                            <span className="text-xs text-[#999]">
                              —
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  },
                )}
              </tbody>
            </table>

            <div className="divide-y divide-black/[0.06] xl:hidden">
              {subscriptions.map(
                (subscription) => {
                  const business =
                    businessOf(
                      subscription,
                    );

                  const totalCents =
                    subscription.amount_cents *
                    (1 +
                      Number(
                        subscription.vat_rate,
                      ) /
                        100);

                  return (
                    <article
                      key={subscription.id}
                      className="space-y-4 p-4 sm:space-y-5 sm:p-6"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#999]">
                            Επιχείρηση
                          </p>
                          <p className="mt-1.5 break-words text-lg font-black leading-tight sm:text-xl">
                            {business?.name ??
                              "Άγνωστη επιχείρηση"}
                          </p>
                          <p className="mt-1 font-mono text-[10px] text-[#999]">
                            {business?.slug
                              ? `/${business.slug}`
                              : subscription.business_id}
                          </p>
                        </div>

                        <div className="flex shrink-0 flex-col items-end gap-1.5">
                          <span className={`inline-flex rounded-full px-2.5 py-1.5 text-[8px] font-black uppercase tracking-[0.08em] ${
                            subscription.billing_status ===
                            "past_due"
                              ? "bg-red-100 text-red-700"
                              : subscription.billing_status ===
                                  "active"
                                ? "bg-green-100 text-green-700"
                                : "bg-[#F1F1EF] text-[#666]"
                          }`}>
                            {billingStatusLabel(
                              subscription.billing_status,
                            )}
                          </span>
                          <span className={`inline-flex rounded-full px-2.5 py-1.5 text-[8px] font-black uppercase tracking-[0.08em] ${
                            subscription.access_status ===
                            "suspended"
                              ? "bg-red-100 text-red-700"
                              : subscription.access_status ===
                                  "grace_period"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-[#F1F1EF] text-[#555]"
                          }`}>
                            {accessStatusLabel(
                              subscription.access_status,
                            )}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 rounded-2xl bg-[#F7F5F1] p-3.5 sm:gap-5 sm:p-4">
                        <div className="min-w-0">
                          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#999]">
                            Χρέωση
                          </p>
                          <p className="mt-1.5 text-xl font-black tracking-[-0.03em]">
                            {formatMoney(
                              subscription.amount_cents,
                              subscription.currency,
                            )}
                          </p>
                          <p className="mt-1 text-[11px] leading-4 text-[#777]">
                            {intervalLabel(
                              subscription.billing_interval_months,
                            )}{" "}
                            · {subscription.vat_rate}% ΦΠΑ
                          </p>
                          <p className="mt-1 text-[10px] text-[#999]">
                            Σύνολο{" "}
                            {formatMoney(
                              Math.round(
                                totalCents,
                              ),
                              subscription.currency,
                            )}
                          </p>
                        </div>

                        <div className="min-w-0 border-l border-black/[0.06] pl-3 sm:pl-5">
                          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#999]">
                            Επόμενη
                          </p>
                          <p className="mt-1.5 text-sm font-black leading-5">
                            {formatDate(
                              subscription.next_billing_at,
                            )}
                          </p>
                          {subscription.payment_due_at && (
                            <p className="mt-1 text-[10px] leading-4 text-[#999]">
                              Due{" "}
                              {formatDate(
                                subscription.payment_due_at,
                              )}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="min-w-0 border-t border-black/[0.06] pt-4">
                        <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#999]">
                          Billing email
                        </p>
                        <p className="mt-1.5 break-words text-[13px] leading-5 text-[#666] [overflow-wrap:anywhere]">
                          {subscription.billing_email ??
                            "—"}
                        </p>
                      </div>

                      <div className="border-t border-black/[0.06] pt-4">
                        <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.16em] text-[#999]">
                          Stripe
                        </p>

                        {subscription.stripe_subscription_id ? (
                          <span className="inline-flex rounded-full bg-green-100 px-3 py-2 text-[9px] font-black uppercase tracking-[0.1em] text-green-700">
                            Connected
                          </span>
                        ) : subscription.billing_status === "draft" ? (
                          <button
                            type="button"
                            onClick={() =>
                              openStripeCheckout(
                                subscription,
                              )
                            }
                            disabled={
                              openingCheckoutId ===
                              subscription.id
                            }
                            className="w-full rounded-xl bg-[#635BFF] px-4 py-3.5 text-[11px] font-black text-white transition active:scale-[0.99] disabled:opacity-50"
                          >
                            {openingCheckoutId ===
                            subscription.id
                              ? "Άνοιγμα..."
                              : "Stripe Checkout"}
                          </button>
                        ) : (
                          <span className="text-xs text-[#999]">
                            —
                          </span>
                        )}
                      </div>
                    </article>
                  );
                },
              )}
            </div>
          </>
        )}
      </section>

      <section className="rounded-[28px] border border-black/10 bg-white p-6 sm:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#DC2727]">
              Billing history
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.04em]">
              Παραστατικά
            </h2>
            <p className="mt-2 text-sm text-[#666]">
              Οι πιο πρόσφατες χρεώσεις όλων των πελατών.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              void loadAdminBillingHistory()
            }
            disabled={loadingBillingHistory}
            className="rounded-2xl border border-black/10 px-4 py-3 text-xs font-bold transition hover:border-[#222] disabled:opacity-50"
          >
            Ανανέωση
          </button>
        </div>

        {billingHistoryError && (
          <p className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {billingHistoryError}
          </p>
        )}

        {loadingBillingHistory ? (
          <p className="mt-6 text-sm font-semibold text-[#777]">
            Φόρτωση ιστορικού...
          </p>
        ) : billingDocuments.length === 0 ? (
          <p className="mt-6 text-sm text-[#777]">
            Δεν υπάρχουν παραστατικά ακόμη.
          </p>
        ) : (
          <div className="mt-6 overflow-hidden rounded-[20px] border border-black/8">
            <div className="divide-y divide-black/[0.06]">
              {billingDocuments.map(
                (document) => {
                  const business =
                    Array.isArray(
                      document.businesses,
                    )
                      ? document.businesses[0]
                      : document.businesses;

                  return (
                    <div
                      key={document.id}
                      className="grid gap-4 p-5 md:grid-cols-[1.2fr_1fr_0.8fr_auto] md:items-center"
                    >
                      <div>
                        <p className="font-black">
                          {business?.name ??
                            "Άγνωστη επιχείρηση"}
                        </p>
                        <p className="mt-1 text-[10px] text-[#999]">
                          {document.document_number ??
                            document.stripe_invoice_id ??
                            "Χωρίς αριθμό"}
                        </p>
                      </div>

                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#999]">
                          Ημερομηνία
                        </p>
                        <p className="mt-1 text-sm font-bold">
                          {formatDate(
                            document.issued_at ??
                              document.created_at,
                          )}
                        </p>
                      </div>

                      <div>
                        <p className="font-black">
                          {formatMoney(
                            document.total_cents,
                            document.currency,
                          )}
                        </p>
                        <span className={`mt-1 inline-flex rounded-full px-3 py-1.5 text-[8px] font-black uppercase tracking-[0.1em] ${
                          document.status === "paid"
                            ? "bg-green-100 text-green-700"
                            : document.status === "open"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-[#F1F1EF] text-[#666]"
                        }`}>
                          {document.status}
                        </span>
                      </div>

                      {document.pdf_url ||
                      document.hosted_url ? (
                        <a
                          href={
                            document.pdf_url ??
                            document.hosted_url
                          }
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-xl border border-black/10 px-4 py-3 text-center text-[9px] font-bold uppercase tracking-[0.12em] transition hover:bg-[#222] hover:text-white"
                        >
                          Άνοιγμα
                        </a>
                      ) : (
                        <span className="text-[10px] text-[#999]">
                          —
                        </span>
                      )}
                    </div>
                  );
                },
              )}
            </div>
          </div>
        )}
      </section>

      <section className="rounded-[28px] border border-black/10 bg-white p-6 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#DC2727]">
          Audit trail
        </p>
        <h2 className="mt-2 text-2xl font-black tracking-[-0.04em]">
          Billing activity
        </h2>
        <p className="mt-2 text-sm text-[#666]">
          Stripe webhook events και κατάσταση επεξεργασίας.
        </p>

        {billingEvents.length === 0 ? (
          <p className="mt-6 text-sm text-[#777]">
            Δεν υπάρχουν καταγεγραμμένα billing events ακόμη.
          </p>
        ) : (
          <div className="mt-6 space-y-2">
            {billingEvents
              .slice(0, 30)
              .map((event) => {
                const business =
                  Array.isArray(
                    event.businesses,
                  )
                    ? event.businesses[0]
                    : event.businesses;

                return (
                  <div
                    key={event.id}
                    className="grid gap-3 rounded-[16px] border border-black/[0.06] bg-[#FAF9F7] px-4 py-4 sm:grid-cols-[1.2fr_1fr_auto] sm:items-center"
                  >
                    <div>
                      <p className="text-sm font-black">
                        {event.event_type}
                      </p>
                      <p className="mt-1 text-[10px] text-[#999]">
                        {business?.name ??
                          event.object_id ??
                          "Stripe"}
                      </p>
                    </div>

                    <p className="text-xs font-semibold text-[#666]">
                      {formatDate(
                        event.received_at,
                      )}
                    </p>

                    <span className={`inline-flex w-fit rounded-full px-3 py-1.5 text-[8px] font-black uppercase tracking-[0.1em] ${
                      event.status === "processed"
                        ? "bg-green-100 text-green-700"
                        : event.status === "failed"
                          ? "bg-red-100 text-red-700"
                          : "bg-[#EEEDEA] text-[#666]"
                    }`}>
                      {event.status}
                    </span>
                  </div>
                );
              })}
          </div>
        )}
      </section>


    </div>
  );
}

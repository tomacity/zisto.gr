import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

type ConfiguratorAnswers = {
  businessType: string;
  goals: string[];
  placements: string[];
  quantity: string;
  tracking: string;
  customization: string;
  fullName: string;
  businessName: string;
  email: string;
  phone: string;
  notes: string;
  website: string;
};

const BUSINESS_TYPES = [
  "Εστιατόριο",
  "Καφέ",
  "Bar",
  "Take away / Delivery",
  "Ξενοδοχείο",
  "Airbnb / Κατάλυμα",
  "Taxi / Μεταφορές",
  "Retail / Κατάστημα",
  "Υπηρεσίες",
  "Άλλο",
];

const GOALS = [
  "Περισσότερα Google Reviews",
  "Ψηφιακό menu / κατάλογος",
  "Social media & links",
  "Wi-Fi πρόσβαση",
  "Κρατήσεις / booking",
  "WhatsApp / επικοινωνία",
  "Πληροφορίες για τον πελάτη",
  "Κάτι custom",
];

const PLACEMENTS = [
  "Τραπέζια",
  "Reception",
  "Δωμάτια",
  "Ταμείο",
  "Πάγκος",
  "Αυτοκίνητο",
  "Πακέτα / delivery",
  "Διαφορετικά σημεία",
];

const QUANTITIES = [
  "1–5",
  "6–10",
  "11–20",
  "21–50",
  "50+",
  "Δεν ξέρω ακόμη",
];

const TRACKING_OPTIONS = [
  "Όλες στο ίδιο Smart Link",
  "Ξεχωριστό tracking ανά κάρτα",
  "Δεν ξέρω — πρότεινέ μου",
];

const CUSTOMIZATION_OPTIONS = [
  "Στα χρώματα της επιχείρησης",
  "Πλήρως custom Smart Link",
  "Δεν ξέρω — θέλω πρόταση",
];

const INITIAL_ANSWERS: ConfiguratorAnswers = {
  businessType: "",
  goals: [],
  placements: [],
  quantity: "",
  tracking: "",
  customization: "",
  fullName: "",
  businessName: "",
  email: "",
  phone: "",
  notes: "",
  website: "",
};

function toggleValue(values: string[], value: string) {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

function ChoiceButton({
  selected,
  children,
  onClick,
}: {
  selected: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex min-h-[64px] w-full items-center justify-between gap-4 rounded-[18px] border px-5 py-4 text-left text-[14px] font-bold transition-all duration-300 ${
        selected
          ? "border-[#222] bg-[#222] text-white shadow-[0_18px_45px_-25px_rgba(0,0,0,0.65)]"
          : "border-black/10 bg-white text-[#222] hover:border-[#222]/45 hover:-translate-y-0.5"
      }`}
    >
      <span>{children}</span>
      <span
        className={`grid h-6 w-6 flex-shrink-0 place-items-center rounded-full border text-[12px] transition ${
          selected
            ? "border-[#DC2727] bg-[#DC2727] text-white"
            : "border-black/15 text-transparent group-hover:text-[#222]/35"
        }`}
      >
        ✓
      </span>
    </button>
  );
}

export function ZistoConfigurator({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] =
    useState<ConfiguratorAnswers>(INITIAL_ANSWERS);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const totalSteps = 7;
  const progress = submitted
    ? 100
    : ((step + 1) / totalSteps) * 100;

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose, submitting]);

  useEffect(() => {
    if (!open) {
      setStep(0);
      setAnswers(INITIAL_ANSWERS);
      setSubmitting(false);
      setSubmitError("");
      setSubmitted(false);
    }
  }, [open]);

  const canContinue = useMemo(() => {
    if (step === 0) return Boolean(answers.businessType);
    if (step === 1) return answers.goals.length > 0;
    if (step === 2) return answers.placements.length > 0;
    if (step === 3) return Boolean(answers.quantity);
    if (step === 4) return Boolean(answers.tracking);
    if (step === 5) return Boolean(answers.customization);

    return (
      answers.fullName.trim().length >= 2 &&
      answers.businessName.trim().length >= 2 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        answers.email.trim(),
      )
    );
  }, [answers, step]);

  function next() {
    if (!canContinue || step >= totalSteps - 1) return;
    setStep((current) => current + 1);
  }

  function back() {
    if (step === 0 || submitting) return;
    setSubmitError("");
    setStep((current) => current - 1);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canContinue) return;

    try {
      setSubmitting(true);
      setSubmitError("");

      const response = await fetch("/api/track", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "lead",
          ...answers,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Δεν ήταν δυνατή η αποστολή της πρότασης.",
        );
      }

      setSubmitted(true);
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Κάτι πήγε στραβά. Δοκίμασε ξανά.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[500] flex items-end justify-center bg-black/60 p-0 backdrop-blur-md md:items-center md:p-6"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget &&
          !submitting
        ) {
          onClose();
        }
      }}
    >
      <section className="relative flex max-h-[94vh] w-full max-w-[820px] flex-col overflow-hidden rounded-t-[28px] bg-[#F7F5F1] shadow-2xl md:max-h-[90vh] md:rounded-[32px]">
        <div className="h-1.5 w-full bg-black/5">
          <div
            className="h-full bg-[#DC2727] transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-center justify-between gap-4 border-b border-black/8 px-6 py-5 md:px-9">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.26em] text-[#DC2727]">
              Φτιάξε το Zisto σου
            </p>
            {!submitted && (
              <p className="mt-1 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#222]/35">
                Βήμα {step + 1} / {totalSteps}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="grid h-11 w-11 place-items-center rounded-full bg-white text-[22px] font-light text-[#222] transition hover:bg-[#222] hover:text-white disabled:opacity-40"
            aria-label="Κλείσιμο"
          >
            ×
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-7 md:px-10 md:py-10">
          {submitted ? (
            <div className="py-3 md:py-8">
              <span className="inline-flex rounded-full bg-[#DC2727] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-white">
                Έτοιμο
              </span>

              <h2 className="mt-6 max-w-[12ch] text-[42px] font-black leading-[0.92] tracking-[-0.045em] text-[#222] md:text-[62px]">
                Το Zisto που σου ταιριάζει.
              </h2>

              <div className="mt-9 grid gap-3 sm:grid-cols-2">
                <SummaryItem
                  label="Επιχείρηση"
                  value={answers.businessType}
                />
                <SummaryItem
                  label="Κάρτες"
                  value={answers.quantity}
                />
                <SummaryItem
                  label="Tracking"
                  value={answers.tracking}
                />
                <SummaryItem
                  label="Design"
                  value={answers.customization}
                />
              </div>

              <div className="mt-3 rounded-[20px] bg-white p-5">
                <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#222]/35">
                  Τι θα κάνει
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {answers.goals.map((goal) => (
                    <span
                      key={goal}
                      className="rounded-full bg-[#F2F0EC] px-3 py-2 text-[11px] font-bold text-[#222]/70"
                    >
                      {goal}
                    </span>
                  ))}
                </div>
              </div>

              <p className="mt-8 max-w-xl text-[20px] font-bold leading-relaxed tracking-[-0.02em] text-[#222]">
                Θα επικοινωνήσουμε μαζί σου για να το ζήσουμε μαζί!
              </p>

              <p className="mt-2 text-[13px] leading-relaxed text-[#222]/50">
                Στείλαμε και μια επιβεβαίωση στο{" "}
                <strong className="text-[#222]">
                  {answers.email}
                </strong>
                .
              </p>

              <button
                type="button"
                onClick={onClose}
                className="mt-8 rounded-full bg-[#222] px-7 py-4 text-[12px] font-bold uppercase tracking-[0.16em] text-white transition hover:bg-[#DC2727]"
              >
                Τέλεια, κλείσιμο
              </button>
            </div>
          ) : (
            <form onSubmit={submit}>
              {step === 0 && (
                <StepShell
                  eyebrow="Ας γνωριστούμε"
                  title="Τι είδους επιχείρηση έχεις;"
                  subtitle="Διάλεξε αυτό που είναι πιο κοντά σε εσένα."
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    {BUSINESS_TYPES.map((item) => (
                      <ChoiceButton
                        key={item}
                        selected={
                          answers.businessType === item
                        }
                        onClick={() =>
                          setAnswers((current) => ({
                            ...current,
                            businessType: item,
                          }))
                        }
                      >
                        {item}
                      </ChoiceButton>
                    ))}
                  </div>
                </StepShell>
              )}

              {step === 1 && (
                <StepShell
                  eyebrow="Ο στόχος σου"
                  title="Τι θέλεις να πετύχεις με το Zisto;"
                  subtitle="Μπορείς να επιλέξεις περισσότερα από ένα."
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    {GOALS.map((item) => (
                      <ChoiceButton
                        key={item}
                        selected={answers.goals.includes(
                          item,
                        )}
                        onClick={() =>
                          setAnswers((current) => ({
                            ...current,
                            goals: toggleValue(
                              current.goals,
                              item,
                            ),
                          }))
                        }
                      >
                        {item}
                      </ChoiceButton>
                    ))}
                  </div>
                </StepShell>
              )}

              {step === 2 && (
                <StepShell
                  eyebrow="Στον χώρο σου"
                  title="Πού θέλεις να τοποθετήσεις τις Zisto κάρτες;"
                  subtitle="Επίλεξε όλα τα σημεία που σε ενδιαφέρουν."
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    {PLACEMENTS.map((item) => (
                      <ChoiceButton
                        key={item}
                        selected={answers.placements.includes(
                          item,
                        )}
                        onClick={() =>
                          setAnswers((current) => ({
                            ...current,
                            placements: toggleValue(
                              current.placements,
                              item,
                            ),
                          }))
                        }
                      >
                        {item}
                      </ChoiceButton>
                    ))}
                  </div>
                </StepShell>
              )}

              {step === 3 && (
                <StepShell
                  eyebrow="Μέγεθος"
                  title="Πόσες κάρτες περίπου χρειάζεσαι;"
                  subtitle="Δεν χρειάζεται να είναι ο τελικός αριθμός."
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    {QUANTITIES.map((item) => (
                      <ChoiceButton
                        key={item}
                        selected={answers.quantity === item}
                        onClick={() =>
                          setAnswers((current) => ({
                            ...current,
                            quantity: item,
                          }))
                        }
                      >
                        {item}
                      </ChoiceButton>
                    ))}
                  </div>
                </StepShell>
              )}

              {step === 4 && (
                <StepShell
                  eyebrow="Analytics"
                  title="Πώς θέλεις να λειτουργούν οι κάρτες;"
                  subtitle="Αν δεν είσαι σίγουρος, θα σου προτείνουμε εμείς το σωστό setup."
                >
                  <div className="grid gap-3">
                    {TRACKING_OPTIONS.map((item) => (
                      <ChoiceButton
                        key={item}
                        selected={answers.tracking === item}
                        onClick={() =>
                          setAnswers((current) => ({
                            ...current,
                            tracking: item,
                          }))
                        }
                      >
                        {item}
                      </ChoiceButton>
                    ))}
                  </div>
                </StepShell>
              )}

              {step === 5 && (
                <StepShell
                  eyebrow="Η εικόνα σου"
                  title="Πόσο custom θέλεις να είναι;"
                  subtitle="Το Smart Link μπορεί να είναι από απλό branded setup μέχρι τελείως custom εμπειρία."
                >
                  <div className="grid gap-3">
                    {CUSTOMIZATION_OPTIONS.map((item) => (
                      <ChoiceButton
                        key={item}
                        selected={
                          answers.customization === item
                        }
                        onClick={() =>
                          setAnswers((current) => ({
                            ...current,
                            customization: item,
                          }))
                        }
                      >
                        {item}
                      </ChoiceButton>
                    ))}
                  </div>
                </StepShell>
              )}

              {step === 6 && (
                <StepShell
                  eyebrow="Τελευταίο βήμα"
                  title="Πού να σου στείλουμε την πρόταση;"
                  subtitle="Και αν έχεις κάτι συγκεκριμένο στο μυαλό σου, γράψ’ το μας."
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <TextField
                      label="Όνομα"
                      value={answers.fullName}
                      onChange={(value) =>
                        setAnswers((current) => ({
                          ...current,
                          fullName: value,
                        }))
                      }
                      placeholder="Το όνομά σου"
                      required
                    />

                    <TextField
                      label="Επιχείρηση"
                      value={answers.businessName}
                      onChange={(value) =>
                        setAnswers((current) => ({
                          ...current,
                          businessName: value,
                        }))
                      }
                      placeholder="Όνομα επιχείρησης"
                      required
                    />

                    <TextField
                      label="Email"
                      type="email"
                      value={answers.email}
                      onChange={(value) =>
                        setAnswers((current) => ({
                          ...current,
                          email: value,
                        }))
                      }
                      placeholder="hello@example.com"
                      required
                    />

                    <TextField
                      label="Τηλέφωνο / WhatsApp"
                      type="tel"
                      value={answers.phone}
                      onChange={(value) =>
                        setAnswers((current) => ({
                          ...current,
                          phone: value,
                        }))
                      }
                      placeholder="Προαιρετικό"
                    />
                  </div>

                  <label className="mt-4 block">
                    <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#222]/45">
                      Πες μας δύο λόγια παραπάνω
                    </span>
                    <textarea
                      value={answers.notes}
                      onChange={(event) =>
                        setAnswers((current) => ({
                          ...current,
                          notes: event.target.value,
                        }))
                      }
                      rows={4}
                      maxLength={1200}
                      placeholder="π.χ. Θέλω οι πελάτες να βλέπουν menu και μετά να μπορούν εύκολα να αφήσουν review..."
                      className="mt-2 w-full resize-none rounded-[18px] border border-black/10 bg-white px-4 py-4 text-[14px] font-semibold outline-none transition placeholder:font-normal placeholder:text-[#222]/25 focus:border-[#222]/40"
                    />
                  </label>

                  <input
                    type="text"
                    value={answers.website}
                    onChange={(event) =>
                      setAnswers((current) => ({
                        ...current,
                        website: event.target.value,
                      }))
                    }
                    tabIndex={-1}
                    autoComplete="off"
                    aria-hidden="true"
                    className="hidden"
                  />

                  {submitError && (
                    <p className="mt-4 rounded-[16px] bg-red-50 px-4 py-3 text-[12px] font-bold text-red-700">
                      {submitError}
                    </p>
                  )}
                </StepShell>
              )}

              <div className="mt-8 flex items-center justify-between gap-3 border-t border-black/8 pt-6">
                <button
                  type="button"
                  onClick={back}
                  disabled={step === 0 || submitting}
                  className="rounded-full px-5 py-3 text-[11px] font-bold uppercase tracking-[0.16em] text-[#222]/55 transition hover:text-[#222] disabled:pointer-events-none disabled:opacity-0"
                >
                  ← Πίσω
                </button>

                {step < totalSteps - 1 ? (
                  <button
                    type="button"
                    onClick={next}
                    disabled={!canContinue}
                    className="rounded-full bg-[#222] px-7 py-4 text-[11px] font-bold uppercase tracking-[0.16em] text-white transition hover:bg-[#DC2727] disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    Συνέχεια →
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!canContinue || submitting}
                    className="rounded-full bg-[#DC2727] px-7 py-4 text-[11px] font-bold uppercase tracking-[0.16em] text-white transition hover:bg-[#222] disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    {submitting
                      ? "Δημιουργία..."
                      : "Δημιούργησε την πρότασή μου →"}
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      </section>
    </div>,
    document.body,
  );
}

function StepShell({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#DC2727]">
        {eyebrow}
      </p>
      <h2 className="mt-3 max-w-[16ch] text-[34px] font-black leading-[0.96] tracking-[-0.04em] text-[#222] md:text-[48px]">
        {title}
      </h2>
      <p className="mt-4 max-w-xl text-[13px] leading-relaxed text-[#222]/50 md:text-[14px]">
        {subtitle}
      </p>
      <div className="mt-7">{children}</div>
    </div>
  );
}

function SummaryItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[20px] bg-white p-5">
      <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#222]/35">
        {label}
      </p>
      <p className="mt-2 text-[14px] font-black leading-snug text-[#222]">
        {value}
      </p>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#222]/45">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        required={required}
        className="mt-2 w-full rounded-[18px] border border-black/10 bg-white px-4 py-4 text-[14px] font-semibold outline-none transition placeholder:font-normal placeholder:text-[#222]/25 focus:border-[#222]/40"
        placeholder={placeholder}
      />
    </label>
  );
}

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { ConfettiBurst } from "./ConfettiBurst";

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
  quantity: "1",
  tracking: "",
  customization: "",
  fullName: "",
  businessName: "",
  email: "",
  phone: "",
  notes: "",
  website: "",
};

const CARD_COUNTS = Array.from(
  { length: 200 },
  (_, index) => index + 1,
);

function toggleValue(values: string[], value: string) {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

function CardCountWheel({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const itemHeight = 56;
  const selectedValue = Math.min(
    200,
    Math.max(1, Number(value) || 1),
  );

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const frame = window.requestAnimationFrame(() => {
      scroller.scrollTop =
        (selectedValue - 1) * itemHeight;
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  function handleScroll() {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
    }

    frameRef.current = window.requestAnimationFrame(() => {
      const nextValue = Math.min(
        200,
        Math.max(
          1,
          Math.round(scroller.scrollTop / itemHeight) + 1,
        ),
      );

      if (nextValue !== selectedValue) {
        onChange(String(nextValue));
      }
    });
  }

  return (
    <div className="mx-auto w-full max-w-[340px]">
      <div className="relative overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.04] px-5">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-5 top-1/2 z-10 h-14 -translate-y-1/2 rounded-[15px] border border-[#DC2727]/30 bg-[#DC2727]/10"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 z-20 h-24 bg-gradient-to-b from-[#222] via-[#222]/90 to-transparent"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-24 bg-gradient-to-t from-[#222] via-[#222]/90 to-transparent"
        />

        <div
          ref={scrollerRef}
          onScroll={handleScroll}
          role="listbox"
          aria-label="Αριθμός καρτών"
          aria-activedescendant={`inline-card-count-${selectedValue}`}
          tabIndex={0}
          className="relative h-[280px] snap-y snap-mandatory overflow-y-auto py-[112px] text-center outline-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ overscrollBehavior: "contain" }}
        >
          {CARD_COUNTS.map((count) => {
            const distance = Math.abs(count - selectedValue);

            return (
              <div
                key={count}
                id={`inline-card-count-${count}`}
                role="option"
                aria-selected={count === selectedValue}
                className={`flex h-14 snap-center items-center justify-center transition-all duration-150 ${
                  count === selectedValue
                    ? "scale-110 text-[34px] font-black text-white"
                    : distance === 1
                      ? "text-[22px] font-bold text-white/35"
                      : "text-[18px] font-semibold text-white/15"
                }`}
              >
                {count}
              </div>
            );
          })}
        </div>
      </div>

      <p className="mt-4 text-center text-[10px] font-bold uppercase tracking-[0.18em] text-white/30">
        {selectedValue === 1 ? "κάρτα" : "κάρτες"} · σύρε πάνω ή κάτω
      </p>
    </div>
  );
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
      className={`group flex min-h-[58px] w-full items-center justify-between gap-4 rounded-[16px] border px-4 py-3.5 text-left text-[13px] font-bold transition-all duration-300 ${
        selected
          ? "border-[#DC2727] bg-[#DC2727] text-white"
          : "border-white/10 bg-white/[0.045] text-white/75 hover:border-white/25 hover:bg-white/[0.075]"
      }`}
    >
      <span>{children}</span>
      <span
        className={`grid h-5 w-5 flex-shrink-0 place-items-center rounded-full border text-[10px] transition ${
          selected
            ? "border-white/30 bg-white text-[#DC2727]"
            : "border-white/20 text-transparent"
        }`}
      >
        ✓
      </span>
    </button>
  );
}

export function ZistoConfiguratorInline() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] =
    useState<ConfiguratorAnswers>(INITIAL_ANSWERS);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [showSuccessConfetti, setShowSuccessConfetti] =
    useState(false);

  const totalSteps = 7;
  const progress = submitted
    ? 100
    : ((step + 1) / totalSteps) * 100;

  useEffect(() => {
    if (!submitted) return;

    setShowSuccessConfetti(true);
    const timer = window.setTimeout(
      () => setShowSuccessConfetti(false),
      2400,
    );

    return () => window.clearTimeout(timer);
  }, [submitted]);

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

  function restart() {
    setStep(0);
    setAnswers(INITIAL_ANSWERS);
    setSubmitting(false);
    setSubmitError("");
    setSubmitted(false);
    setShowSuccessConfetti(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canContinue) return;

    try {
      setSubmitting(true);
      setSubmitError("");

      const response = await fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

  return (
    <div
      id="zisto-form"
      className="relative min-h-[680px] overflow-hidden rounded-[30px] border border-white/10 bg-[#222] text-white shadow-[0_40px_100px_-55px_rgba(0,0,0,0.7)]"
    >
      {showSuccessConfetti && <ConfettiBurst />}

      <div className="h-1.5 w-full bg-white/8">
        <div
          className="h-full bg-[#DC2727] transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex items-center justify-between border-b border-white/10 px-6 py-5 md:px-7">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.24em] text-[#DC2727]">
            Φτιάξε το Zisto σου
          </p>
          {!submitted && (
            <p className="mt-1 font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-white/30">
              Βήμα {step + 1} / {totalSteps}
            </p>
          )}
        </div>

        <img
          src="/images/zisto-monogram.png"
          alt=""
          className="h-9 w-9 object-contain brightness-0 invert"
          draggable={false}
        />
      </div>

      <div className="px-6 py-7 md:px-7 md:py-8">
        {submitted ? (
          <div className="py-3">
            <span className="inline-flex rounded-full bg-[#DC2727] px-4 py-2 text-[9px] font-bold uppercase tracking-[0.18em] text-white">
              Έτοιμο
            </span>

            <h3 className="mt-6 max-w-[11ch] text-[40px] font-black leading-[0.92] tracking-[-0.045em] text-white md:text-[50px]">
              Το Zisto που σου ταιριάζει.
            </h3>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <SummaryItem label="Επιχείρηση" value={answers.businessType} />
              <SummaryItem
                label="Κάρτες"
                value={`${answers.quantity} ${answers.quantity === "1" ? "κάρτα" : "κάρτες"}`}
              />
              <SummaryItem label="Tracking" value={answers.tracking} />
              <SummaryItem label="Design" value={answers.customization} />
            </div>

            <div className="mt-3 rounded-[18px] border border-white/10 bg-white/[0.045] p-5">
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/30">
                Τι θα κάνει
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {answers.goals.map((goal) => (
                  <span
                    key={goal}
                    className="rounded-full bg-white/10 px-3 py-2 text-[10px] font-bold text-white/75"
                  >
                    {goal}
                  </span>
                ))}
              </div>
            </div>

            <p className="mt-8 text-[19px] font-bold leading-relaxed tracking-[-0.02em] text-white">
              Θα επικοινωνήσουμε μαζί σου για να το ζήσουμε μαζί!
            </p>

            <p className="mt-2 text-[12px] leading-relaxed text-white/40">
              Στείλαμε και μια επιβεβαίωση στο{" "}
              <strong className="text-white/80">
                {answers.email}
              </strong>
              .
            </p>

            <button
              type="button"
              onClick={restart}
              className="mt-7 rounded-full border border-white/15 bg-white/10 px-6 py-3.5 text-[10px] font-bold uppercase tracking-[0.16em] text-white transition hover:bg-white hover:text-[#222]"
            >
              Νέα πρόταση ↻
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
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {BUSINESS_TYPES.map((item) => (
                    <ChoiceButton
                      key={item}
                      selected={answers.businessType === item}
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
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {GOALS.map((item) => (
                    <ChoiceButton
                      key={item}
                      selected={answers.goals.includes(item)}
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
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {PLACEMENTS.map((item) => (
                    <ChoiceButton
                      key={item}
                      selected={answers.placements.includes(item)}
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
                subtitle="Διάλεξε έναν αριθμό από 1 έως 200. Μπορούμε να τον προσαρμόσουμε αργότερα."
              >
                <CardCountWheel
                  value={answers.quantity}
                  onChange={(value) =>
                    setAnswers((current) => ({
                      ...current,
                      quantity: value,
                    }))
                  }
                />
              </StepShell>
            )}

            {step === 4 && (
              <StepShell
                eyebrow="Analytics"
                title="Πώς θέλεις να λειτουργούν οι κάρτες;"
                subtitle="Αν δεν είσαι σίγουρος, θα σου προτείνουμε εμείς το σωστό setup."
              >
                <div className="grid gap-2.5">
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
                subtitle="Από branded setup μέχρι τελείως custom Smart Link."
              >
                <div className="grid gap-2.5">
                  {CUSTOMIZATION_OPTIONS.map((item) => (
                    <ChoiceButton
                      key={item}
                      selected={answers.customization === item}
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
                <div className="grid gap-3 sm:grid-cols-2">
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

                <label className="mt-3 block">
                  <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/35">
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
                    placeholder="π.χ. Θέλω menu και μετά εύκολο review..."
                    className="mt-2 w-full resize-none rounded-[16px] border border-white/10 bg-white/[0.055] px-4 py-4 text-[13px] font-semibold text-white outline-none transition placeholder:font-normal placeholder:text-white/20 focus:border-[#DC2727]/60"
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
                  <p className="mt-4 rounded-[14px] border border-red-500/20 bg-red-500/10 px-4 py-3 text-[11px] font-bold text-red-200">
                    {submitError}
                  </p>
                )}
              </StepShell>
            )}

            <div className="mt-7 flex items-center justify-between gap-3 border-t border-white/10 pt-5">
              <button
                type="button"
                onClick={back}
                disabled={step === 0 || submitting}
                className="rounded-full px-3 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-white/45 transition hover:text-white disabled:pointer-events-none disabled:opacity-0"
              >
                ← Πίσω
              </button>

              {step < totalSteps - 1 ? (
                <button
                  type="button"
                  onClick={next}
                  disabled={!canContinue}
                  className="rounded-full bg-white px-6 py-3.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#222] transition hover:bg-[#DC2727] hover:text-white disabled:cursor-not-allowed disabled:opacity-25"
                >
                  Συνέχεια →
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!canContinue || submitting}
                  className="rounded-full bg-[#DC2727] px-6 py-3.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white transition hover:bg-white hover:text-[#222] disabled:cursor-not-allowed disabled:opacity-25"
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
    </div>
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
      <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#DC2727]">
        {eyebrow}
      </p>
      <h3 className="mt-3 max-w-[15ch] text-[30px] font-black leading-[0.96] tracking-[-0.04em] text-white md:text-[36px]">
        {title}
      </h3>
      <p className="mt-3 max-w-xl text-[12px] leading-relaxed text-white/40 md:text-[13px]">
        {subtitle}
      </p>
      <div className="mt-6">{children}</div>
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
    <div className="rounded-[18px] border border-white/10 bg-white/[0.045] p-4">
      <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-white/30">
        {label}
      </p>
      <p className="mt-2 text-[13px] font-black leading-snug text-white">
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
      <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/35">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        placeholder={placeholder}
        className="mt-2 w-full rounded-[16px] border border-white/10 bg-white/[0.055] px-4 py-3.5 text-[13px] font-semibold text-white outline-none transition placeholder:font-normal placeholder:text-white/20 focus:border-[#DC2727]/60"
      />
    </label>
  );
}

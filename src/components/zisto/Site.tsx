import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type CSSProperties,
} from "react";

const WORDMARK = "/images/zisto-wordmark.png";
const MONOGRAM = "/images/zisto-monogram.png";

const RED = "#DC2727";
const INK = "#222222";

/* ------------------------------------------------------------------ */
/*  Shared: reveal on scroll                                          */
/* ------------------------------------------------------------------ */
function useReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setOn(true);
            io.disconnect();
          }
        });
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return { ref, on };
}

function Reveal({
  children,
  delay = 0,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: any;
}) {
  const { ref, on } = useReveal<HTMLDivElement>();
  return (
    <Tag
      ref={ref}
      className={className}
      style={{
        opacity: on ? 1 : 0,
        transform: on ? "translateY(0)" : "translateY(28px)",
        filter: on ? "blur(0)" : "blur(6px)",
        transition: `opacity 900ms cubic-bezier(0.22,1,0.36,1) ${delay}ms, transform 900ms cubic-bezier(0.22,1,0.36,1) ${delay}ms, filter 700ms ease-out ${delay}ms`,
        willChange: "opacity, transform",
      }}
    >
      {children}
    </Tag>
  );
}

/* ------------------------------------------------------------------ */
/*  Magnetic wrapper                                                  */
/* ------------------------------------------------------------------ */
function Magnetic({ children, strength = 0.3 }: { children: ReactNode; strength?: number }) {
  const [t, setT] = useState({ x: 0, y: 0 });
  return (
    <div
      onMouseMove={(e) => {
        const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
        const x = e.clientX - (r.left + r.width / 2);
        const y = e.clientY - (r.top + r.height / 2);
        setT({ x: x * strength, y: y * strength });
      }}
      onMouseLeave={() => setT({ x: 0, y: 0 })}
      style={{
        transform: `translate3d(${t.x}px, ${t.y}px, 0)`,
        transition: "transform 400ms cubic-bezier(0.22,1,0.36,1)",
      }}
      className="inline-block will-change-transform"
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Steam SVG (brand motif) — 3 curls, middle is red                  */
/* ------------------------------------------------------------------ */
function Steam({
  className = "",
  stroke = INK,
  redStroke = RED,
  strokeWidth = 6,
  animate = false,
}: {
  className?: string;
  stroke?: string;
  redStroke?: string;
  strokeWidth?: number;
  animate?: boolean;
}) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <g
        fill="none"
        strokeLinecap="round"
        strokeWidth={strokeWidth}
        style={
          animate
            ? { transformOrigin: "50% 100%", animation: "zisto-steam 4.2s ease-in-out infinite" }
            : undefined
        }
      >
        <path d="M22 88 C28 66 16 56 26 36 C34 48 22 24 34 8" stroke={stroke} opacity={0.85} />
        <path d="M50 92 C58 66 42 52 56 30 C66 46 50 18 66 4" stroke={redStroke} />
        <path d="M78 88 C84 66 72 56 82 36 C90 48 78 24 90 8" stroke={stroke} opacity={0.85} />
      </g>
    </svg>
  );
}

/* ================================================================== */
/*  NAV                                                               */
/* ================================================================== */
const NAV_LINKS = [
  { label: "Υπηρεσίες", href: "#services" },
  { label: "Πώς δουλεύει", href: "#how" },
  { label: "Παράδειγμα", href: "#case" },
  { label: "Τιμές", href: "#pricing" },
];

function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
          scrolled
            ? "border-b border-black/5 bg-white/80 backdrop-blur-xl"
            : "border-b border-transparent bg-transparent"
        }`}
      >
        <div className="mx-auto grid h-16 w-full max-w-[1400px] grid-cols-[1fr_auto] items-center gap-4 px-5 md:h-20 md:grid-cols-[auto_1fr_auto] md:px-10">
          <a href="#top" className="flex items-center gap-2" aria-label="Zisto — αρχική">
            <img
              src={WORDMARK}
              alt="Zisto"
              className="hidden h-6 w-auto md:block"
              draggable={false}
            />
            <img
              src={MONOGRAM}
              alt="Zisto"
              className="h-8 w-auto md:hidden"
              draggable={false}
            />
          </a>

          <nav className="hidden justify-center md:flex">
            <div className="flex items-center gap-9">
              {NAV_LINKS.map((l) => (
                <a
                  key={l.label}
                  href={l.href}
                  className="group relative text-[11.5px] font-semibold uppercase tracking-[0.18em] text-[#222]/70 transition-colors hover:text-[#222]"
                >
                  {l.label}
                  <span className="absolute -bottom-1 left-0 h-[2px] w-full origin-right scale-x-0 bg-[#DC2727] transition-transform duration-500 group-hover:origin-left group-hover:scale-x-100" />
                </a>
              ))}
            </div>
          </nav>

          <div className="hidden justify-end md:flex">
            <Magnetic strength={0.25}>
              <a
                href="#contact"
                className="group inline-flex items-center gap-2 rounded-full bg-[#222] px-5 py-2.5 text-[12px] font-bold uppercase tracking-[0.16em] text-white transition-colors hover:bg-[#DC2727]"
              >
                Ξεκίνα
                <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
              </a>
            </Magnetic>
          </div>

          <button
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Κλείσιμο μενού" : "Άνοιγμα μενού"}
            aria-expanded={open}
            className="justify-self-end grid h-11 w-11 place-items-center rounded-full border border-black/10 bg-white/80 backdrop-blur md:hidden"
          >
            <span className="relative block h-3 w-5">
              <span
                className={`absolute left-0 top-0 h-[2px] w-full bg-[#222] transition-transform duration-300 ${
                  open ? "translate-y-[5px] rotate-45" : ""
                }`}
              />
              <span
                className={`absolute left-0 top-[10px] h-[2px] w-full bg-[#222] transition-transform duration-300 ${
                  open ? "-translate-y-[5px] -rotate-45" : ""
                }`}
              />
            </span>
          </button>
        </div>
      </header>

      {/* Mobile fullscreen overlay */}
      <div
        className={`fixed inset-0 z-40 flex flex-col bg-[#222] text-white transition-all duration-500 md:hidden ${
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        style={{ transform: open ? "translateY(0)" : "translateY(-2%)" }}
      >
        <div className="flex-1 overflow-y-auto px-6 pb-10 pt-24">
          <ul className="flex flex-col gap-5">
            {NAV_LINKS.map((l, i) => (
              <li
                key={l.label}
                style={{
                  transitionDelay: `${open ? 120 + i * 70 : 0}ms`,
                  opacity: open ? 1 : 0,
                  transform: open ? "translateY(0)" : "translateY(20px)",
                  transition: "opacity 500ms ease, transform 600ms cubic-bezier(0.22,1,0.36,1)",
                }}
              >
                <a
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="block text-[11vw] font-black leading-[0.95] tracking-[-0.03em] text-white"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-14">
            <a
              href="#contact"
              onClick={() => setOpen(false)}
              className="inline-flex items-center gap-3 rounded-full bg-[#DC2727] px-6 py-4 text-sm font-bold uppercase tracking-[0.18em] text-white"
            >
              Ξεκίνα <span>→</span>
            </a>
          </div>
        </div>
        <div className="border-t border-white/10 px-6 py-5 text-[10px] uppercase tracking-[0.24em] text-white/50">
          hello@zisto.gr
        </div>
      </div>
    </>
  );
}
/* ================================================================== */
/*  RATING SYSTEM                                                              */
/* ================================================================== */
function StarRating() {
  const [hoveredStar, setHoveredStar] = useState(0);
  const [selectedStar, setSelectedStar] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);

  const handleStarClick = (star: number) => {
    setSelectedStar(star);

    if (star >= 4) {
      setShowConfetti(false);

      window.setTimeout(() => {
        setShowConfetti(true);
      }, 10);

      window.setTimeout(() => {
        setShowConfetti(false);
      }, 1800);
    }
  };

  const activeStars = hoveredStar || selectedStar;

  return (
    <>
      <div
        className="relative z-[100] mt-5 flex items-center justify-center gap-2 pointer-events-auto"
        onMouseLeave={() => setHoveredStar(0)}
        aria-label="Αξιολόγηση με αστέρια"
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onMouseEnter={() => setHoveredStar(star)}
            onFocus={() => setHoveredStar(star)}
            onMouseLeave={() => setHoveredStar(0)}
            onBlur={() => setHoveredStar(0)}
            onClick={() => handleStarClick(star)}
            className="relative z-[101] cursor-pointer border-0 bg-transparent p-1 pointer-events-auto"
            aria-label={`${star} αστέρια`}
            aria-pressed={selectedStar === star}
          >
            <svg
              viewBox="0 0 24 24"
              className={`h-8 w-8 transition-all duration-200 ${
                star <= activeStars
                  ? "scale-110 fill-[#DC2727] stroke-[#DC2727]"
                  : "fill-transparent stroke-[#222222]"
              }`}
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 2.75l2.85 5.78 6.38.93-4.62 4.5 1.09 6.35L12 17.32l-5.7 2.99 1.09-6.35-4.62-4.5 6.38-.93L12 2.75z" />
            </svg>
          </button>
        ))}
      </div>

      {showConfetti && <ConfettiBurst />}
    </>
  );
}
/* ================================================================== */
/*  HERO                                                              */
/* ================================================================== */
function Hero() {
  const [scrollY, setScrollY] = useState(0);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    const onMove = (e: MouseEvent) => {
      setMouse({
        x: (e.clientX / window.innerWidth - 0.5) * 2,
        y: (e.clientY / window.innerHeight - 0.5) * 2,
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("mousemove", onMove);
    };
  }, []);

  return (
    <section
      id="top"
      className="relative flex min-h-screen w-full items-center overflow-hidden bg-white pt-28 md:pt-32"
    >
      {/* Background layers */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(1200px 700px at 88% 8%, rgba(220,39,39,0.10), transparent 60%), radial-gradient(900px 700px at -10% 90%, rgba(34,34,34,0.05), transparent 60%)",
          }}
        />
        {/* Grid */}
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              "linear-gradient(to right, #222 1px, transparent 1px), linear-gradient(to bottom, #222 1px, transparent 1px)",
            backgroundSize: "72px 72px",
            maskImage: "radial-gradient(ellipse at center, black 40%, transparent 78%)",
          }}
        />
        {/* Giant background wordmark */}
        <div
          className="absolute inset-x-0 bottom-[-4vw] flex justify-center"
          style={{ transform: `translateY(${scrollY * 0.12}px)` }}
        >
          <span
            className="select-none text-[36vw] font-black leading-none tracking-[-0.06em] text-[#222]"
            style={{ opacity: 0.035 }}
          >
            ZISTO
          </span>
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-[1400px] grid-cols-1 items-center gap-12 px-5 pb-24 md:px-10 md:pb-32 lg:grid-cols-12 lg:gap-8">
        {/* Left: headline */}
        <div className="lg:col-span-8">
          <Reveal delay={80}>
            <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/70 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.24em] text-[#222]/70 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-[#DC2727]" />
              Ζήσ' το · zisto
            </div>
          </Reveal>

          <h1 className="mt-7 font-black leading-[0.86] tracking-[-0.045em] text-[#222]">
            <Reveal delay={180} as="span" className="block text-[16vw] sm:text-[13vw] lg:text-[10.5vw] xl:text-[11.5rem]">
              Ένα άγγιγμα.
            </Reveal>
            <Reveal delay={340} as="span" className="block text-[16vw] sm:text-[13vw] lg:text-[10.5vw] xl:text-[11.5rem]">
              <span className="text-[#DC2727]">Όλη</span> η
            </Reveal>
            <Reveal delay={480} as="span" className="block text-[16vw] sm:text-[13vw] lg:text-[10.5vw] xl:text-[11.5rem]">
              εικόνα σου.
            </Reveal>
          </h1>

          <div className="mt-10 grid max-w-2xl grid-cols-1 gap-8 md:grid-cols-[1fr_auto] md:items-end">
            <Reveal delay={640}>
              <p className="text-[15px] leading-relaxed text-[#222]/70 md:text-[17px]">
                Φτιάχνουμε το φυσικό &amp; ψηφιακό kit που μετατρέπει κάθε
                ικανοποιημένο πελάτη της επιχείρησής σου σε 5άστερο review — χωρίς
                να σηκωθεί από το τραπέζι.
              </p>
            </Reveal>
          </div>

          <Reveal delay={780}>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Magnetic>
                <a
                  href="#contact"
                  className="group inline-flex items-center gap-3 rounded-full bg-[#222] px-7 py-4 text-[13px] font-bold uppercase tracking-[0.16em] text-white shadow-[0_20px_40px_-15px_rgba(34,34,34,0.55)] transition-all duration-300 hover:bg-[#DC2727] hover:shadow-[0_30px_60px_-15px_rgba(220,39,39,0.55)]"
                >
                  Ξεκίνα το δικό σου kit
                  <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
                </a>
              </Magnetic>
              <Magnetic>
                <a
                  href="#how"
                  className="group inline-flex items-center gap-3 rounded-full border border-black/15 bg-white/60 px-7 py-4 text-[13px] font-bold uppercase tracking-[0.16em] text-[#222] backdrop-blur transition-all duration-300 hover:border-[#222] hover:bg-white"
                >
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-[#222] text-[9px] text-white">
                    ▶
                  </span>
                  Δες πώς δουλεύει
                </a>
              </Magnetic>
            </div>
          </Reveal>
        </div>

        {/* Right: steam mark */}
        <div className="relative lg:col-span-4">
          <div
            className="relative mx-auto aspect-square w-full max-w-[380px]"
            style={{
              transform: `translate3d(${mouse.x * -18}px, ${mouse.y * -18 + scrollY * -0.05}px, 0)`,
              transition: "transform 700ms cubic-bezier(0.22,1,0.36,1)",
            }}
          >
            <div
              aria-hidden
              className="absolute -inset-10 -z-10 rounded-full blur-3xl"
              style={{
                background:
                  "radial-gradient(circle, rgba(220,39,39,0.22), transparent 65%)",
              }}
            />
            <img
              src={MONOGRAM}
              alt=""
              className="pointer-events-none absolute inset-0 h-full w-full select-none object-contain"
              draggable={false}
              style={{ animation: "zisto-float 6s ease-in-out infinite" }}
            />
            
            <StarRating />
          </div>
        </div>
      </div>

      {/* Scroll cue */}
      <div className="pointer-events-none absolute bottom-8 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 text-[10px] font-bold uppercase tracking-[0.32em] text-[#222]/40">
        <span>scroll</span>
        <span className="relative block h-7 w-px overflow-hidden bg-[#222]/15">
          <span
            className="absolute inset-x-0 top-0 block h-1/2 bg-[#DC2727]"
            style={{ animation: "zisto-scrollcue 1.8s ease-in-out infinite" }}
          />
        </span>
      </div>
    </section>
  );
}

/* ================================================================== */
/*  SERVICES                                                          */
/* ================================================================== */
const SERVICES = [
  {
    n: "01",
    title: "NFC Κάρτες",
    body: "Custom σχεδιασμένες κάρτες που στέλνουν τον πελάτη κατευθείαν στο review ή στο menu, με ένα άγγιγμα.",
    span: "md:col-span-7",
    big: true,
  },
  {
    n: "02",
    title: "Smart Link",
    body: "Μια σελίδα φτιαγμένη στα χρώματα & τη ταυτότητα του μαγαζιού σου, με routing σε menu ή review.",
    span: "md:col-span-5",
  },
  {
    n: "03",
    title: "Ψηφιακό Μενού",
    body: "Δίγλωσσο, εύκολο στην πλοήγηση μενού — χωρίς ατέλειωτο scroll, με κατηγορίες σε ένα tap.",
    span: "md:col-span-5",
  },
  {
    n: "04",
    title: "Custom Branding",
    body: "Όνομα, λογότυπο, χρώματα — μια ταυτότητα φτιαγμένη στα μέτρα της κάθε επιχείρησης, όχι template.",
    span: "md:col-span-7",
    big: true,
  },
];

function Services() {
  return (
    <section id="services" className="relative bg-white py-28 md:py-40">
      <div className="mx-auto w-full max-w-[1400px] px-5 md:px-10">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#DC2727]">
                Τι φτιάχνουμε
              </p>
              <h2 className="mt-5 max-w-[16ch] text-[10vw] font-black leading-[0.9] tracking-[-0.035em] text-[#222] md:text-[6.5vw] lg:text-[5.2vw]">
                Ένα ενιαίο kit, όχι σκόρπια κομμάτια.
              </h2>
            </div>
            <div className="hidden text-right text-[11px] font-bold uppercase tracking-[0.24em] text-[#222]/40 md:block">
              04 — Υπηρεσίες
            </div>
          </div>
        </Reveal>

        <div className="mt-16 grid grid-cols-1 gap-px overflow-hidden rounded-[6px] border border-black/10 bg-black/10 md:mt-24 md:grid-cols-12">
          {SERVICES.map((s, i) => (
            <ServiceCard key={s.n} s={s} i={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ServiceCard({
  s,
  i,
}: {
  s: (typeof SERVICES)[number];
  i: number;
}) {
  const [hover, setHover] = useState(false);
  const { ref, on } = useReveal<HTMLDivElement>();
  return (
    <div
      ref={ref}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={`group relative overflow-hidden bg-white p-8 transition-colors duration-500 md:p-12 ${s.span} ${
        hover ? "bg-[#222] text-white" : ""
      }`}
      style={{
        opacity: on ? 1 : 0,
        transform: on ? "translateY(0)" : "translateY(28px)",
        transition: `background-color 500ms ease, color 500ms ease, opacity 800ms cubic-bezier(0.22,1,0.36,1) ${i * 80}ms, transform 800ms cubic-bezier(0.22,1,0.36,1) ${i * 80}ms`,
        minHeight: s.big ? "320px" : "260px",
      }}
    >
      {/* Red sweep on hover */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 origin-bottom-left scale-y-0 bg-[#DC2727] transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-y-100"
        style={{ mixBlendMode: "normal", opacity: 0.9 }}
      />
      <div className="relative z-10 flex h-full flex-col justify-between gap-8">
        <div className="flex items-start justify-between">
          <span className="font-mono text-[11px] font-bold uppercase tracking-[0.28em]">
            {s.n}
          </span>
          <span className="grid h-8 w-8 place-items-center rounded-full border border-current opacity-70 transition-transform duration-500 group-hover:rotate-45">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path
                d="M2 10L10 2M10 2H4M10 2V8"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </span>
        </div>

        <div>
          <h3
            className={`font-black tracking-[-0.02em] ${
              s.big ? "text-[9vw] md:text-[4vw]" : "text-[8vw] md:text-[2.6vw]"
            }`}
          >
            {s.title}
          </h3>
          <p
            className={`mt-4 max-w-md text-[14px] leading-relaxed md:text-[15px] ${
              hover ? "text-white/75" : "text-[#222]/60"
            }`}
          >
            {s.body}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  HOW IT WORKS                                                      */
/* ================================================================== */
const STEPS = [
  {
    n: "01",
    title: "Ο πελάτης κάνει tap",
    body: "Ακουμπάει το κινητό στην κάρτα πάνω στο τραπέζι — καμία εφαρμογή, κανένα login.",
  },
  {
    n: "02",
    title: "Ανοίγει η δική σου σελίδα",
    body: "Το smart link σου εμφανίζεται αμέσως, με το λογότυπο & τα χρώματά σου.",
  },
  {
    n: "03",
    title: "Διαλέγει menu ή review",
    body: "Δύο καθαρά κουμπιά. Ο πελάτης αφήνει αξιολόγηση σε δευτερόλεπτα.",
  },
];

function HowItWorks() {
  const [active, setActive] = useState(1);

  useEffect(() => {
    const t = setInterval(() => {
      setActive((n) => (n % 3) + 1);
    }, 3200);
    return () => clearInterval(t);
  }, []);

  const setStep = (n: number) => setActive(n);

  return (
    <section id="how" className="relative overflow-hidden bg-[#222] py-28 text-white md:py-40">
      {/* Background giant number */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-6 top-24 select-none font-black leading-none tracking-[-0.06em] text-white/[0.04]"
        style={{ fontSize: "40vw" }}
      >
        0{active}
      </div>

      <div className="relative mx-auto w-full max-w-[1400px] px-5 md:px-10">
        <Reveal>
          <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#DC2727]">
            Πώς δουλεύει
          </p>
          <h2 className="mt-5 max-w-[18ch] text-[10vw] font-black leading-[0.9] tracking-[-0.035em] md:text-[6vw] lg:text-[4.8vw]">
            Από το τραπέζι στ' αστέρια, σε τρία βήματα.
          </h2>
        </Reveal>

        <div className="mt-16 grid grid-cols-1 items-start gap-16 md:mt-24 lg:grid-cols-12 lg:gap-20">
          {/* Steps */}
          <div className="lg:col-span-7">
            <ul>
              {STEPS.map((s, i) => {
                const isActive = active === i + 1;
                return (
                  <li key={s.n}>
                    <button
                      type="button"
                      onClick={() => setStep(i + 1)}
                      className="group relative flex w-full items-start gap-6 border-t border-white/10 py-8 text-left transition-colors md:gap-10 md:py-10"
                    >
                      {/* progress accent */}
                      <span
                        aria-hidden
                        className="absolute left-0 top-0 h-[2px] bg-[#DC2727] transition-all duration-700"
                        style={{ width: isActive ? "100%" : "0%" }}
                      />
                      <span
                        className={`font-mono text-[13px] font-bold tracking-[0.2em] transition-colors ${
                          isActive ? "text-[#DC2727]" : "text-white/40"
                        }`}
                      >
                        {s.n}
                      </span>
                      <div className="flex-1">
                        <h3
                          className={`text-[7vw] font-black leading-[0.95] tracking-[-0.025em] transition-colors md:text-[3.4vw] lg:text-[2.8vw] ${
                            isActive ? "text-white" : "text-white/35"
                          }`}
                        >
                          {s.title}
                        </h3>
                        <p
                          className={`mt-3 max-w-md text-[14px] leading-relaxed transition-all duration-500 md:text-[15px] ${
                            isActive
                              ? "max-h-40 opacity-90"
                              : "max-h-0 overflow-hidden opacity-0"
                          } text-white/70`}
                        >
                          {s.body}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
              <li className="border-t border-white/10" />
            </ul>
          </div>

          {/* Phone (sticky-ish) */}
          <div className="lg:col-span-5">
            <div className="lg:sticky lg:top-28">
              <PhoneDemo scene={active} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PhoneDemo({ scene }: { scene: number }) {
  return (
    <div className="relative mx-auto flex w-full max-w-[300px] justify-center">
      <div
        aria-hidden
        className="absolute -inset-10 -z-10 rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(220,39,39,0.18), transparent 65%)",
        }}
      />
      <div
        className="relative h-[560px] w-[280px] overflow-hidden rounded-[42px] border-[10px] border-black bg-white shadow-[0_40px_80px_-20px_rgba(0,0,0,0.55)]"
        style={{ animation: "zisto-float 7s ease-in-out infinite" }}
      >
        {/* Notch */}
        <div className="absolute left-1/2 top-2 z-20 h-5 w-24 -translate-x-1/2 rounded-full bg-black" />

        {/* Scenes */}
        <Scene active={scene === 1}>
          <div className="relative flex flex-col items-center gap-6">
            <div className="relative grid h-24 w-24 place-items-center">
              <span
                aria-hidden
                className="absolute inset-0 rounded-full border-2 border-[#DC2727]"
                style={{ animation: "zisto-ripple 1.6s ease-out infinite" }}
              />
              <span
                aria-hidden
                className="absolute inset-0 rounded-full border-2 border-[#DC2727]"
                style={{ animation: "zisto-ripple 1.6s ease-out .5s infinite" }}
              />
              <svg width="46" height="46" viewBox="0 0 24 24" fill="none">
                <path d="M6 8c3 2 3 6 0 8" stroke="#222" strokeWidth="1.6" strokeLinecap="round" />
                <path d="M10 5c5 3 5 11 0 14" stroke="#222" strokeWidth="1.6" strokeLinecap="round" />
                <path d="M14 2c7 4 7 16 0 20" stroke="#DC2727" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#222]/50">
              tap to continue
            </p>
          </div>
        </Scene>

        <Scene active={scene === 2}>
          <div className="flex w-full flex-col items-center gap-5 px-6 text-center">
            <img src={MONOGRAM} alt="" className="h-12 w-auto" draggable={false} />
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#222]/60">
              το Μαγαζί σου
            </p>
            <div className="mt-2 flex w-full flex-col gap-3">
              <span className="w-full rounded-md bg-[#222] px-4 py-3 text-[12px] font-bold text-white">
                📋 Δείτε το μενού
              </span>
              <span className="w-full rounded-md border border-[#222]/20 px-4 py-3 text-[12px] font-bold text-[#222]">
                ⭐ Αφήστε αξιολόγηση
              </span>
            </div>
          </div>
        </Scene>

        <Scene active={scene === 3}>
          <div className="flex flex-col items-center gap-5 px-6 text-center">
            <div className="flex gap-1.5">
              {[0, 1, 2, 3, 4].map((i) => (
                <svg
                  key={i}
                  width="22"
                  height="22"
                  viewBox="0 0 20 20"
                  fill="#DC2727"
                  style={{
                    animation: `zisto-pop 1.6s ${i * 120}ms ease-in-out infinite`,
                  }}
                >
                  <path d="M10 1l2.6 5.9 6.4.6-4.8 4.3 1.4 6.3L10 15l-5.6 3.1 1.4-6.3L1 7.5l6.4-.6z" />
                </svg>
              ))}
            </div>
            <p className="text-[13px] leading-relaxed text-[#222]/70">
              Ένα review μέσα σε δευτερόλεπτα.
            </p>
          </div>
        </Scene>
      </div>
    </div>
  );
}

function Scene({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center px-4 pt-8"
      style={{
        opacity: active ? 1 : 0,
        transform: active ? "translateY(0)" : "translateY(12px)",
        transition: "opacity 500ms ease, transform 600ms cubic-bezier(0.22,1,0.36,1)",
        pointerEvents: active ? "auto" : "none",
      }}
    >
      {children}
    </div>
  );
}

/* ================================================================== */
/*  CASE STUDY                                                        */
/* ================================================================== */
function CaseStudy() {
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });
  return (
    <section id="case" className="relative overflow-hidden bg-white py-28 md:py-40">
      <div className="mx-auto w-full max-w-[1400px] px-5 md:px-10">
        <Reveal>
          <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#DC2727]">
            Πρώτο πιλοτικό project
          </p>
        </Reveal>

        <div className="mt-10 grid grid-cols-1 items-center gap-14 lg:grid-cols-12 lg:gap-16">
          <Reveal delay={120} className="lg:col-span-7">
            <h2 className="text-[10vw] font-black leading-[0.9] tracking-[-0.035em] text-[#222] md:text-[6.5vw] lg:text-[5.4vw]">
              το Τσιπουράδικο <span className="text-[#DC2727]">της</span> Μυρσίνης
            </h2>
            <p className="mt-8 max-w-xl text-[15px] leading-relaxed text-[#222]/65 md:text-[17px]">
              Το πρώτο μας πραγματικό kit — custom NFC κάρτα, smart link με
              vintage ταυτότητα, και πλήρες δίγλωσσο ψηφιακό μενού με πλοήγηση
              ανά κατηγορία. Χτισμένο από την αρχή γύρω από τη δική του ιστορία,
              όχι από ένα template.
            </p>
            <div className="mt-10">
              <Magnetic>
                <a
                  href="#contact"
                  className="group inline-flex items-center gap-3 rounded-full bg-[#222] px-7 py-4 text-[13px] font-bold uppercase tracking-[0.16em] text-white transition-all duration-300 hover:bg-[#DC2727]"
                >
                  Θέλω κάτι σαν αυτό
                  <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
                </a>
              </Magnetic>
            </div>
          </Reveal>

          {/* Mock card with tilt */}
          <Reveal delay={220} className="lg:col-span-5">
            <div
              className="mx-auto w-full max-w-[380px] [perspective:1400px]"
              onMouseMove={(e) => {
                const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                const dx = (e.clientX - (r.left + r.width / 2)) / r.width;
                const dy = (e.clientY - (r.top + r.height / 2)) / r.height;
                setTilt({ ry: dx * 14, rx: -dy * 10 });
              }}
              onMouseLeave={() => setTilt({ rx: 0, ry: 0 })}
            >
              <div
                className="relative overflow-hidden rounded-[26px] border border-black/10 bg-white p-8 shadow-[0_40px_80px_-30px_rgba(34,34,34,0.35)]"
                style={{
                  transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
                  transformStyle: "preserve-3d",
                  transition: "transform 400ms cubic-bezier(0.22,1,0.36,1)",
                }}
              >
                {/* Corner tag */}
                <div className="flex items-start justify-between">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#DC2727]/10 px-3 py-1 text-[9px] font-bold uppercase tracking-[0.24em] text-[#DC2727]">
                    <span className="h-1 w-1 rounded-full bg-[#DC2727]" />
                    Live
                  </span>
                  <img src={MONOGRAM} alt="" className="h-8 w-auto" draggable={false} />
                </div>

                <p className="mt-8 text-[22px] font-black leading-[1.05] tracking-[-0.02em] text-[#222]">
                  το Τσιπουράδικο
                  <br />
                  της Μυρσίνης
                </p>

                <div className="mt-8 flex flex-col gap-3">
                  <span className="w-full rounded-lg bg-[#222] px-4 py-3.5 text-center text-[13px] font-bold text-white">
                    📋 Δείτε το μενού
                  </span>
                  <span className="w-full rounded-lg border border-[#222]/15 px-4 py-3.5 text-center text-[13px] font-bold text-[#222]">
                    ⭐ Αφήστε αξιολόγηση
                  </span>
                </div>

                <div className="mt-8 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.24em] text-[#222]/40">
                  <span>zisto.gr</span>
                  <span>NFC · Tap</span>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ================================================================== */
/*  PRICING                                                           */
/* ================================================================== */
const PACKAGES = [
  {
    tier: "Starter",
    title: "Κάρτα + Smart Link",
    features: ["Custom NFC κάρτα", "Smart link σελίδα", "Routing σε review & menu"],
    featured: false,
  },
  {
    tier: "Growth",
    title: "+ Ψηφιακό Μενού",
    features: [
      "Ό,τι έχει το Starter",
      "Πλήρες δίγλωσσο μενού",
      "Sticky πλοήγηση κατηγοριών",
    ],
    featured: true,
  },
  {
    tier: "Custom",
    title: "+ Πλήρες Branding",
    features: [
      "Ό,τι έχει το Growth",
      "Όνομα & λογότυπο από το μηδέν",
      "Πολλαπλά καταστήματα",
    ],
    featured: false,
  },
];

function Pricing() {
  return (
    <section id="pricing" className="relative bg-white py-28 md:py-40">
      <div className="mx-auto w-full max-w-[1400px] px-5 md:px-10">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#DC2727]">
                Τιμές
              </p>
              <h2 className="mt-5 max-w-[16ch] text-[10vw] font-black leading-[0.9] tracking-[-0.035em] text-[#222] md:text-[6.2vw] lg:text-[5vw]">
                Τρία πακέτα, ανάλογα με το πόσο μακριά θες να πας.
              </h2>
            </div>
          </div>
        </Reveal>

        <div className="mt-16 grid grid-cols-1 gap-5 md:mt-24 md:grid-cols-3">
          {PACKAGES.map((p, i) => (
            <PriceCard key={p.tier} p={p} i={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

function PriceCard({
  p,
  i,
}: {
  p: (typeof PACKAGES)[number];
  i: number;
}) {
  const { ref, on } = useReveal<HTMLDivElement>();
  const isFeatured = p.featured;
  return (
    <div
      ref={ref}
      className={`group relative flex flex-col justify-between overflow-hidden rounded-[10px] border p-8 transition-all duration-500 md:p-10 ${
        isFeatured
          ? "border-[#222] bg-[#222] text-white md:-my-4 md:py-14"
          : "border-black/10 bg-white text-[#222] hover:border-[#222]"
      }`}
      style={{
        opacity: on ? 1 : 0,
        transform: on ? "translateY(0)" : "translateY(28px)",
        transition: `opacity 800ms cubic-bezier(0.22,1,0.36,1) ${i * 100}ms, transform 800ms cubic-bezier(0.22,1,0.36,1) ${i * 100}ms, border-color 300ms ease, background-color 300ms ease`,
        minHeight: 420,
      }}
    >
      {isFeatured && (
        <span
          aria-hidden
          className="absolute -right-16 -top-16 h-56 w-56 rounded-full opacity-70 blur-3xl"
          style={{ background: "radial-gradient(circle, #DC2727 0%, transparent 65%)" }}
        />
      )}

      <div className="relative">
        <div className="flex items-center justify-between">
          <span
            className={`text-[10px] font-bold uppercase tracking-[0.28em] ${
              isFeatured ? "text-[#DC2727]" : "text-[#DC2727]"
            }`}
          >
            {p.tier}
          </span>
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.24em] opacity-40">
            0{i + 1} / 03
          </span>
        </div>
        <h3
          className={`mt-6 text-[8vw] font-black leading-[0.95] tracking-[-0.025em] md:text-[2.6vw] lg:text-[2vw]`}
        >
          {p.title}
        </h3>

        <ul className="mt-8 flex flex-col gap-3.5">
          {p.features.map((f) => (
            <li key={f} className="flex items-start gap-3 text-[14px] leading-relaxed">
              <span
                className={`mt-2 block h-[2px] w-4 flex-shrink-0 ${
                  isFeatured ? "bg-[#DC2727]" : "bg-[#DC2727]"
                }`}
              />
              <span className={isFeatured ? "text-white/85" : "text-[#222]/70"}>{f}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="relative mt-10">
        <Magnetic strength={0.2}>
          <a
            href="#contact"
            className={`group/btn inline-flex items-center gap-3 rounded-full px-6 py-3.5 text-[12px] font-bold uppercase tracking-[0.16em] transition-all duration-300 ${
              isFeatured
                ? "bg-[#DC2727] text-white hover:bg-white hover:text-[#222]"
                : "border border-[#222]/20 bg-white text-[#222] hover:border-[#222] hover:bg-[#222] hover:text-white"
            }`}
          >
            Ρώτα μας
            <span className="transition-transform duration-300 group-hover/btn:translate-x-1">→</span>
          </a>
        </Magnetic>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  FOOTER                                                            */
/* ================================================================== */
function Footer() {
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  return (
    <footer
      id="contact"
      className="relative flex min-h-screen flex-col overflow-hidden bg-[#222] text-white"
      onMouseMove={(e) => {
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
        setMouse({
          x: (e.clientX - r.left) / r.width - 0.5,
          y: (e.clientY - r.top) / r.height - 0.5,
        });
      }}
    >
      {/* Steam elements */}

      {/* Red glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[60%]"
        style={{
          background:
            "radial-gradient(70% 70% at 50% 100%, rgba(220,39,39,0.28), transparent 65%)",
        }}
      />

      <div className="relative flex flex-1 flex-col items-center justify-center px-5 py-24 text-center md:px-10">
        <Reveal>
          <p className="text-[11px] font-bold uppercase tracking-[0.32em] text-[#DC2727]">
            Έτοιμος να ξεκινήσεις;
          </p>
        </Reveal>

        <Reveal delay={120}>
          <h2 className="mt-8 text-[14vw] font-black leading-[0.86] tracking-[-0.04em] md:text-[9vw] lg:text-[7.5vw]">
            Ζέστανε την
            <br />
            <span className="text-[#DC2727]">παρουσία</span> σου.
          </h2>
        </Reveal>

        <Reveal delay={280}>
          <div className="mt-14">
            <Magnetic strength={0.35}>
              <a
                href="mailto:zisto.gr@gmail.com"
                className="group inline-flex items-center gap-4 rounded-full bg-white px-8 py-5 text-[15px] font-bold tracking-[-0.01em] text-[#222] shadow-[0_30px_60px_-15px_rgba(220,39,39,0.5)] transition-all duration-300 hover:bg-[#DC2727] hover:text-white"
              >
                <span className="h-2 w-2 rounded-full bg-[#DC2727] transition-colors group-hover:bg-white" />
                zisto.gr@gmail.com
                <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
              </a>
            </Magnetic>
          </div>
        </Reveal>

        <Reveal delay={420}>
          <img
            src={WORDMARK}
            alt="Zisto"
            className="mt-20 h-10 w-auto opacity-90 invert md:h-14"
            draggable={false}
          />
        </Reveal>
      </div>

      <div className="relative mx-auto flex w-full max-w-[1400px] flex-wrap items-center justify-between gap-3 border-t border-white/10 px-5 py-6 text-[10px] font-bold uppercase tracking-[0.24em] text-white/40 md:px-10">
        <span>© 2026 Zisto</span>
        <span>Ένα άγγιγμα. Όλη η εικόνα σου.</span>
      </div>
    </footer>
  );
}

/* ================================================================== */
/*  ROOT                                                              */
/* ================================================================== */
export function ZistoSite() {
  return (
    <div className="bg-white font-sans text-[#222] antialiased">
      <Nav />
      <Hero />
      <Services />
      <HowItWorks />
      <CaseStudy />
      <Pricing />
      <Footer />
    </div>
  );
}

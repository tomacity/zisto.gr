import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type CSSProperties,
  type FormEvent,
} from "react";
import { createPortal } from "react-dom";
import { supabase } from "../../lib/supabase";
import { AdminPage } from "../../pages/AdminPage";

const WORDMARK = "/images/zisto-wordmark.png";
const WORDMARKWHITE = "/images/zisto-wormark-white.png";
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

          <div className="hidden items-center justify-end gap-3 md:flex">
            <a
              href="/#/login"
              className="group relative px-3 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#222]/65 transition-colors hover:text-[#222]"
            >
              Σύνδεση
              <span className="absolute inset-x-3 bottom-0 h-[2px] origin-right scale-x-0 bg-[#DC2727] transition-transform duration-500 group-hover:origin-left group-hover:scale-x-100" />
            </a>
          
            <Magnetic strength={0.25}>
              <a
                href="#contact"
                className="group inline-flex items-center gap-2 rounded-full bg-[#222] px-5 py-2.5 text-[12px] font-bold uppercase tracking-[0.16em] text-white transition-colors hover:bg-[#DC2727]"
              >
                Ξεκίνα
                <span className="transition-transform duration-300 group-hover:translate-x-1">
                  →
                </span>
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
          <div className="mt-14 flex flex-wrap gap-3">
            <a
              href="/#/login"
              onClick={() => setOpen(false)}
              className="inline-flex items-center gap-3 rounded-full border border-white/20 px-6 py-4 text-sm font-bold uppercase tracking-[0.18em] text-white"
            >
              Σύνδεση
            </a>
          
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

function ConfettiBurst() {
  if (typeof document === "undefined") {
    return null;
  }

  const pieces = Array.from({ length: 70 }, (_, index) => index);

  const colors = [
    "#DC2727",
    "#222222",
    "#FFFFFF",
    "#FFB800",
    "#FF6B6B",
  ];

  return createPortal(
    <div
      className="pointer-events-none fixed inset-0 h-screen w-screen overflow-hidden"
      style={{ zIndex: 2147483647 }}
      aria-hidden="true"
    >
      {pieces.map((piece) => {
        const isLeft = piece % 2 === 0;

        const horizontalDistance = isLeft
          ? 180 + Math.random() * 650
          : -180 - Math.random() * 650;

        return (
          <span
            key={piece}
            className="absolute block rounded-sm"
            style={
              {
                width: `${6 + Math.random() * 7}px`,
                height: `${10 + Math.random() * 10}px`,

                left: isLeft ? `${Math.random() * 10}%` : "auto",
                right: isLeft ? "auto" : `${Math.random() * 10}%`,

                top: `${35 + Math.random() * 55}%`,

                backgroundColor: colors[piece % colors.length],
                opacity: 0,

                animation: `zisto-confetti ${
                  1.2 + Math.random() * 0.8
                }s cubic-bezier(0.2, 0.7, 0.3, 1) ${
                  Math.random() * 0.18
                }s forwards`,

                "--confetti-x": `${horizontalDistance}px`,
                "--confetti-y": `${-300 - Math.random() * 600}px`,
                "--confetti-rotation": `${
                  (isLeft ? 1 : -1) * (360 + Math.random() * 900)
                }deg`,
              } as CSSProperties
            }
          />
        );
      })}
    </div>,
    document.body,
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
            src={WORDMARKWHITE}
            alt="Zisto"
            className="mt-20 h-10 w-auto opacity-90 md:h-14"
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
/*  LOGIN PAGE                                                        */
/* ================================================================== */

function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);

    useEffect(() => {
      let active = true;
    
      async function checkExistingSession() {
        const {
          data: { session },
        } = await supabase.auth.getSession();
    
        if (!active || !session) {
          return;
        }
    
        await redirectLoggedInUser(session.access_token);
      }
    
      checkExistingSession();
    
      return () => {
        active = false;
      };
    }, []);

    async function redirectLoggedInUser(accessToken: string) {
    try {
      const response = await fetch("/api/admin/me", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      });
  
      const result = await response.json();
  
      if (response.ok && result.isAdmin) {
        window.location.hash = "/admin";
        return;
      }
  
      window.location.hash = "/dashboard";
    } catch (error) {
      console.error("Role check failed:", error);
  
      window.location.hash = "/dashboard";
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setLoading(true);
      setLoginError(null);

    const { data, error } =
      await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
    
    if (error) {
      throw error;
    }
    
    if (!data.session) {
      throw new Error("No session returned after login");
    }
    
    await redirectLoggedInUser(
      data.session.access_token,
    );
      
    } catch (error) {
      console.error("Login failed:", error);
      setLoginError("Το email ή ο κωδικός δεν είναι σωστός.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-white font-sans text-[#222]">
      {/* Background grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #222 1px, transparent 1px), linear-gradient(to bottom, #222 1px, transparent 1px)",
          backgroundSize: "72px 72px",
          maskImage:
            "radial-gradient(ellipse at center, black 30%, transparent 78%)",
        }}
      />

      {/* Red glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(220,39,39,0.20), transparent 68%)",
        }}
      />

      <header className="relative z-10 mx-auto flex h-20 w-full max-w-[1400px] items-center justify-between px-5 md:px-10">
        <a href="/#/" aria-label="Επιστροφή στην αρχική">
          <img
            src={WORDMARK}
            alt="Zisto"
            className="h-7 w-auto"
            draggable={false}
          />
        </a>

        <a
          href="/#/"
          className="group inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#222]/60 transition-colors hover:text-[#222]"
        >
          <span className="transition-transform duration-300 group-hover:-translate-x-1">
            ←
          </span>
          Αρχική
        </a>
      </header>

      <div className="relative z-10 mx-auto grid min-h-[calc(100vh-80px)] w-full max-w-[1400px] grid-cols-1 items-center gap-16 px-5 pb-16 pt-8 md:px-10 lg:grid-cols-12">
        <section className="lg:col-span-7">
          <Reveal delay={60}>
            <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/80 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.24em] text-[#222]/60 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-[#DC2727]" />
              Client portal
            </div>
          </Reveal>

          <h1 className="mt-8 font-black leading-[0.84] tracking-[-0.05em]">
            <Reveal
              delay={140}
              as="span"
              className="block text-[16vw] sm:text-[12vw] lg:text-[8vw] xl:text-[8rem]"
            >
              Welcome
            </Reveal>

            <Reveal
              delay={260}
              as="span"
              className="block text-[16vw] text-[#DC2727] sm:text-[12vw] lg:text-[8vw] xl:text-[8rem]"
            >
              back.
            </Reveal>

            <Reveal
              delay={380}
              as="span"
              className="block text-[16vw] sm:text-[12vw] lg:text-[8vw] xl:text-[8rem]"
            >
              Συνέχισε.
            </Reveal>
          </h1>

          <Reveal delay={500}>
            <p className="mt-8 max-w-xl text-[15px] leading-relaxed text-[#222]/60 md:text-[17px]">
              Συνδέσου για να δεις τα πραγματικά δεδομένα, τις κάρτες και την
              απόδοση της επιχείρησής σου.
            </p>
          </Reveal>
        </section>

        <Reveal delay={300} className="lg:col-span-5">
          <section className="relative overflow-hidden rounded-[28px] border border-black/10 bg-white p-6 shadow-[0_40px_100px_-35px_rgba(34,34,34,0.28)] md:p-9">
            <div
              aria-hidden
              className="pointer-events-none absolute right-0 top-0 h-40 w-40 -translate-y-1/2 translate-x-1/2 rounded-full bg-[#DC2727]/15 blur-3xl"
            />

            <div className="relative">
              <img
                src={MONOGRAM}
                alt=""
                className="h-12 w-auto"
                draggable={false}
              />

              <p className="mt-8 text-[10px] font-bold uppercase tracking-[0.26em] text-[#DC2727]">
                Καλώς ήρθες πίσω
              </p>

              <h2 className="mt-3 text-[38px] font-black leading-[0.94] tracking-[-0.04em]">
                Μπες στο
                <br />
                dashboard σου.
              </h2>
              
              <form onSubmit={handleSubmit} className="mt-10">
                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#222]/45">
                    Email
                  </span>
              
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    autoComplete="email"
                    placeholder="name@business.gr"
                    className="mt-3 w-full border-0 border-b border-black/15 bg-transparent px-0 py-4 text-[16px] font-medium text-[#222] outline-none transition-colors placeholder:text-[#222]/25 focus:border-[#DC2727]"
                  />
                </label>
              
                <label className="mt-8 block">
                  <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#222]/45">
                    Κωδικός
                  </span>
              
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                      autoComplete="current-password"
                      placeholder="••••••••"
                      className="mt-3 w-full border-0 border-b border-black/15 bg-transparent px-0 py-4 pr-20 text-[16px] font-medium text-[#222] outline-none transition-colors placeholder:text-[#222]/25 focus:border-[#DC2727]"
                    />
              
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute bottom-4 right-0 text-[9px] font-bold uppercase tracking-[0.18em] text-[#222]/45 transition-colors hover:text-[#DC2727]"
                    >
                      {showPassword ? "Απόκρυψη" : "Εμφάνιση"}
                    </button>
                  </div>
                </label>
              
                <button
                  type="submit"
                  disabled={loading}
                  className="group mt-10 flex w-full items-center justify-between rounded-full bg-[#222] px-6 py-4 text-[12px] font-bold uppercase tracking-[0.18em] text-white transition-all duration-300 hover:bg-[#DC2727] disabled:cursor-wait disabled:opacity-60"
                >
                  <span>{loading ? "Γίνεται σύνδεση..." : "Σύνδεση"}</span>
                  <span className="transition-transform duration-300 group-hover:translate-x-1">
                    →
                  </span>
                </button>
              
                {loginError && (
                  <p className="mt-5 rounded-[10px] bg-red-50 px-4 py-3 text-center text-[12px] font-semibold text-red-700">
                    {loginError}
                  </p>
                )}
              
                <div className="mt-7 border-t border-black/8 pt-6 text-center">
                  <p className="mt-2 text-[11px] leading-relaxed text-[#222]/45">
                    Η πρόσβαση δημιουργείται μόνο μέσω προσωπικής πρόσκλησης από το Zisto.
                  </p>
                </div>
              </form>
            </div>
          </section>
        </Reveal>
      </div>

    </main>
  );
}

/* ================================================================== */
/*  INVITATION SETUP PAGE                                             */
/* ================================================================== */

function InvitationSetupPage() {
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function initializeInvitation() {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          throw error;
        }

        if (!session) {
          throw new Error(
            "Η πρόσκληση δεν είναι έγκυρη ή έχει λήξει. Ζήτησε νέα πρόσκληση από το Zisto.",
          );
        }

        if (active) {
          setFullName(
            typeof session.user.user_metadata?.full_name === "string"
              ? session.user.user_metadata.full_name
              : "",
          );
          setSessionReady(true);
        }
      } catch (error) {
        if (active) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Δεν ήταν δυνατή η επιβεβαίωση της πρόσκλησης.",
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    initializeInvitation();

    return () => {
      active = false;
    };
  }, []);

  const handleInvitationSetup = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    try {
      setSaving(true);
      setErrorMessage(null);

      if (password.length < 8) {
        throw new Error(
          "Ο κωδικός πρέπει να περιέχει τουλάχιστον 8 χαρακτήρες.",
        );
      }

      if (password !== confirmPassword) {
        throw new Error("Οι δύο κωδικοί δεν ταιριάζουν.");
      }

      const { error } = await supabase.auth.updateUser({
        password,
        data: {
          full_name: fullName.trim(),
          onboarding_completed: true,
        },
      });

      if (error) {
        throw error;
      }

      window.history.replaceState({}, "", window.location.origin);
      window.location.hash = "/dashboard";
    } catch (error) {
      console.error("Invitation setup failed:", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Δεν ήταν δυνατή η ολοκλήρωση της πρόσκλησης.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[#F6F6F4] px-5 py-12 font-sans text-[#222]">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-36 -top-36 h-[520px] w-[520px] rounded-full bg-[#DC2727]/15 blur-3xl"
      />

      <section className="relative w-full max-w-[620px] rounded-[28px] border border-black/10 bg-white p-7 shadow-[0_40px_100px_-35px_rgba(34,34,34,0.28)] md:p-11">
        <img
          src={WORDMARK}
          alt="Zisto"
          className="h-7 w-auto"
          draggable={false}
        />

        <p className="mt-10 text-[10px] font-bold uppercase tracking-[0.26em] text-[#DC2727]">
          Accept invitation
        </p>

        <h1 className="mt-4 text-[44px] font-black leading-[0.9] tracking-[-0.045em] md:text-[62px]">
          Καλώς ήρθες
          <br />
          στο Zisto.
        </h1>

        <p className="mt-6 max-w-lg text-[14px] leading-relaxed text-[#222]/55">
          Ολοκλήρωσε το προφίλ σου και δημιούργησε τον προσωπικό σου κωδικό.
        </p>

        {loading && (
          <div className="mt-10 h-24 animate-pulse rounded-[16px] bg-[#F3F3F1]" />
        )}

        {!loading && errorMessage && !sessionReady && (
          <div className="mt-9 rounded-[14px] border border-red-200 bg-red-50 p-5 text-[13px] font-semibold leading-relaxed text-red-700">
            {errorMessage}
          </div>
        )}

        {!loading && sessionReady && (
          <form onSubmit={handleInvitationSetup} className="mt-10">
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#222]/45">
                Ονοματεπώνυμο
              </span>
              <input
                type="text"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                required
                autoComplete="name"
                className="mt-3 w-full border-0 border-b border-black/15 bg-transparent px-0 py-4 text-[16px] font-semibold outline-none focus:border-[#DC2727]"
              />
            </label>

            <label className="mt-8 block">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#222]/45">
                Νέος κωδικός
              </span>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  autoComplete="new-password"
                  placeholder="Τουλάχιστον 8 χαρακτήρες"
                  className="mt-3 w-full border-0 border-b border-black/15 bg-transparent px-0 py-4 pr-24 text-[16px] font-semibold outline-none placeholder:text-[#222]/20 focus:border-[#DC2727]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute bottom-4 right-0 text-[9px] font-bold uppercase tracking-[0.16em] text-[#222]/40"
                >
                  {showPassword ? "Απόκρυψη" : "Εμφάνιση"}
                </button>
              </div>
            </label>

            <label className="mt-8 block">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#222]/45">
                Επιβεβαίωση κωδικού
              </span>
              <input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                autoComplete="new-password"
                className="mt-3 w-full border-0 border-b border-black/15 bg-transparent px-0 py-4 text-[16px] font-semibold outline-none focus:border-[#DC2727]"
              />
            </label>

            {errorMessage && (
              <p className="mt-6 rounded-[12px] bg-red-50 px-4 py-3 text-[12px] font-semibold text-red-700">
                {errorMessage}
              </p>
            )}

            <button
              type="submit"
              disabled={saving}
              className="group mt-10 flex w-full items-center justify-between rounded-full bg-[#222] px-6 py-4 text-[11px] font-bold uppercase tracking-[0.18em] text-white transition hover:bg-[#DC2727] disabled:opacity-60"
            >
              <span>
                {saving ? "Ολοκλήρωση..." : "Ολοκλήρωση λογαριασμού"}
              </span>
              <span>→</span>
            </button>
          </form>
        )}
      </section>
    </main>
  );
}

/* ================================================================== */
/*  DASHBOARD DATA                                                    */
/* ================================================================== */

type AnalyticsEvent = {
  event_name: string;
  source: string;
  session_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

type DailyActivity = {
  date: string;
  page_views: number;
  menu_opens: number;
  review_clicks: number;
};

type AnalyticsResponse = {
  business_id: string;
  membership_role: "owner" | "manager" | "staff";
  business: {
    name: string;
    location_name: string | null;
  };
  totals: {
    page_views_today: number;
    page_views_week: number;
    page_views_month: number;
    unique_visitors_today: number;
    unique_visitors_week: number;
    unique_visitors_month: number;
    menu_opens_today: number;
    review_clicks_today: number;
    menu_conversion_rate: number;
    review_conversion_rate: number;
  };
  sources: {
    nfc: number;
    qr: number;
    direct: number;
    unknown: number;
  };
  daily_activity: DailyActivity[];
  recent_activity: AnalyticsEvent[];
};

class AnalyticsRequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function fetchAnalytics(
  accessToken: string,
  businessId?: string | null,
): Promise<AnalyticsResponse> {
  const query = businessId
    ? `?business_id=${encodeURIComponent(businessId)}`
    : "";

  const response = await fetch(`/api/analytics${query}`, {
    
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (response.status === 401) {
    await supabase.auth.signOut();
    window.location.hash = "/login";
    throw new Error("Session expired");
  }

  if (!response.ok) {
    let message = `Analytics request failed: ${response.status}`;

    try {
      const payload = await response.json();
      message = payload.error ?? message;
    } catch {
      // Keep the fallback message.
    }

    throw new AnalyticsRequestError(response.status, message);
  }

  return response.json();
}

const numberFormatter = new Intl.NumberFormat("el-GR");
const percentFormatter = new Intl.NumberFormat("el-GR", {
  maximumFractionDigits: 1,
});

function formatEventName(eventName: string) {
  const names: Record<string, string> = {
    page_view: "Επίσκεψη στη σελίδα",
    menu_open: "Άνοιγμα μενού",
    review_click: "Review click",
    wifi_open: "Άνοιγμα Wi-Fi",
    social_open: "Άνοιγμα social",
  };

  return names[eventName] ?? eventName;
}

function formatSource(source: string) {
  const sources: Record<string, string> = {
    nfc: "NFC",
    qr: "QR code",
    direct: "Direct",
    unknown: "Άγνωστο",
  };

  return sources[source] ?? source;
}

/* ================================================================== */
/*  DASHBOARD COMPONENTS                                              */
/* ================================================================== */

function DashboardMetric({
  label,
  value,
  change,
  note,
  index,
}: {
  label: string;
  value: string;
  change: string;
  note: string;
  index: number;
}) {
  return (
    <article
      className={`relative min-h-[260px] overflow-hidden rounded-[20px] border p-6 md:p-8 ${
        index === 0
          ? "border-[#222] bg-[#222] text-white"
          : "border-black/10 bg-white text-[#222]"
      }`}
    >
      {index === 0 && (
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(circle, rgba(220,39,39,0.55), transparent 66%)",
          }}
        />
      )}

      <div className="relative flex h-full flex-col justify-between">
        <div className="flex items-start justify-between gap-4">
          <p
            className={`text-[10px] font-bold uppercase tracking-[0.22em] ${
              index === 0 ? "text-white/55" : "text-[#222]/45"
            }`}
          >
            {label}
          </p>

          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[9px] font-bold uppercase tracking-[0.12em] ${
              change.startsWith("-")
                ? "bg-red-100 text-red-600"
                : "bg-green-100 text-green-700"
            }`}
          >
            {change}
          
            {change.startsWith("-") ? (
              <svg
                viewBox="0 0 16 16"
                className="h-3 w-3"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M8 3v10M4 9l4 4 4-4"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <svg
                viewBox="0 0 16 16"
                className="h-3 w-3"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M8 13V3M4 7l4-4 4 4"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </span>
        </div>

        <div className="mt-14">
          <p className="text-[15vw] font-black leading-none tracking-[-0.06em] sm:text-[10vw] md:text-[6vw] lg:text-[4.2vw]">
            {value}
          </p>

          <p
            className={`mt-4 text-[11px] leading-relaxed ${
              index === 0 ? "text-white/45" : "text-[#222]/40"
            }`}
          >
            {note}
          </p>
        </div>
      </div>
    </article>
  );
}

function DashboardChart({ data }: { data: DailyActivity[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const dayFormatter = new Intl.DateTimeFormat("el-GR", {
    weekday: "short",
  });

  const chartData = data.map((item) => {
    const date = new Date(`${item.date}T12:00:00`);

    return {
      isoDate: item.date,
      day: dayFormatter.format(date).replace(".", ""),
      date: String(date.getDate()),
      value: item.page_views,
      menu: item.menu_opens,
      reviews: item.review_clicks,
    };
  });

  const maxValue = Math.max(1, ...chartData.map((item) => item.value));
  const totalViews = chartData.reduce((sum, item) => sum + item.value, 0);
  const activeItem =
    activeIndex !== null ? chartData[activeIndex] : null;

  return (
    <section className="rounded-[20px] border border-black/10 bg-white p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#DC2727]">
            Δραστηριότητα
          </p>

          <h2 className="mt-3 text-[28px] font-black tracking-[-0.04em] md:text-[38px]">
            Τελευταίες 7 ημέρες
          </h2>
        </div>

        <div className="text-right">
          <p className="text-[32px] font-black tracking-[-0.04em]">
            {numberFormatter.format(totalViews)}
          </p>

          <p className="text-[10px] uppercase tracking-[0.2em] text-[#222]/40">
            επισκέψεις
          </p>
        </div>
      </div>

      <div className="relative mt-12">
        {activeItem && (
          <div
            className="pointer-events-none absolute top-0 z-20 w-[160px] -translate-x-1/2 rounded-[12px] bg-[#222] p-3 text-white shadow-[0_18px_40px_-18px_rgba(0,0,0,0.6)]"
            style={{
              left: `${(((activeIndex ?? 0) + 0.5) / chartData.length) * 100}%`,
              transform: "translate(-50%, -115%)",
            }}
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/50">
              {new Intl.DateTimeFormat("el-GR", {
                day: "numeric",
                month: "short",
              }).format(new Date(`${activeItem.isoDate}T12:00:00`))}
            </p>

            <p className="mt-2 text-[18px] font-black">
              {activeItem.value} επισκέψεις
            </p>

            <div className="mt-3 space-y-1 text-[10px] text-white/65">
              <p className="flex justify-between gap-4">
                <span>Menu opens</span>
                <strong className="text-white">{activeItem.menu}</strong>
              </p>

              <p className="flex justify-between gap-4">
                <span>Review clicks</span>
                <strong className="text-white">{activeItem.reviews}</strong>
              </p>
            </div>
          </div>
        )}

        <div className="flex h-[260px] items-end gap-2 md:gap-3">
          {chartData.map((item, index) => {
            const height =
              item.value === 0 ? 3 : Math.max(12, (item.value / maxValue) * 100);
            const isActive = activeIndex === index;

            return (
              <button
                key={item.isoDate}
                type="button"
                onMouseEnter={() => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
                onFocus={() => setActiveIndex(index)}
                onBlur={() => setActiveIndex(null)}
                className="group relative flex h-full flex-1 items-end outline-none"
                aria-label={`${item.isoDate}, ${item.value} επισκέψεις`}
              >
                <span
                  className={`block w-full origin-bottom rounded-t-[5px] transition-all duration-300 ${
                    isActive
                      ? "bg-[#DC2727]"
                      : "bg-[#222] group-hover:bg-[#DC2727]"
                  }`}
                  style={{
                    height: `${height}%`,
                    opacity: item.value === 0 ? 0.12 : 1,
                    transform: isActive ? "scaleY(1.03)" : "scaleY(1)",
                  }}
                />
              </button>
            );
          })}
        </div>

        <div
          className="mt-5 grid gap-2 md:gap-3"
          style={{
            gridTemplateColumns: `repeat(${Math.max(chartData.length, 1)}, minmax(0, 1fr))`,
          }}
        >
          {chartData.map((item, index) => {
            const isActive = activeIndex === index;

            return (
              <button
                key={`${item.isoDate}-label`}
                type="button"
                onMouseEnter={() => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
                onFocus={() => setActiveIndex(index)}
                onBlur={() => setActiveIndex(null)}
                className="flex min-w-0 flex-col items-center gap-1 outline-none"
              >
                <span
                  className={`text-[9px] font-bold uppercase tracking-[0.08em] transition-colors ${
                    isActive ? "text-[#DC2727]" : "text-[#222]/30"
                  }`}
                >
                  {item.day}
                </span>

                <span
                  className={`grid h-7 w-7 place-items-center rounded-full text-[10px] font-bold transition-all duration-300 ${
                    isActive
                      ? "bg-[#DC2727] text-white"
                      : "text-[#222]/55"
                  }`}
                >
                  {item.date}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function BusinessHealth({
  analytics,
}: {
  analytics: AnalyticsResponse | null;
}) {
  const sevenDayMenuOpens =
    analytics?.daily_activity.reduce(
      (sum, item) => sum + item.menu_opens,
      0,
    ) ?? 0;

  const sevenDayReviewClicks =
    analytics?.daily_activity.reduce(
      (sum, item) => sum + item.review_clicks,
      0,
    ) ?? 0;

  const smartLinkOnline = (analytics?.totals.page_views_month ?? 0) > 0;
  const menuActive = sevenDayMenuOpens > 0;
  const trackingActive = (analytics?.totals.unique_visitors_month ?? 0) > 0;
  const nfcOrQrActive =
    ((analytics?.sources.nfc ?? 0) + (analytics?.sources.qr ?? 0)) > 0;

  const reviewRate = analytics?.totals.review_conversion_rate ?? 0;

  const healthScore = Math.min(
    100,
    (smartLinkOnline ? 30 : 0) +
      (menuActive ? 25 : 0) +
      (trackingActive ? 20 : 0) +
      (nfcOrQrActive ? 15 : (analytics?.sources.direct ?? 0) > 0 ? 5 : 0) +
      Math.min(10, Math.round(reviewRate)),
  );

  const healthMessage =
    healthScore >= 85
      ? "Η ψηφιακή εμπειρία λειτουργεί πολύ καλά."
      : healthScore >= 65
        ? "Η βασική εμπειρία λειτουργεί σωστά. Υπάρχει περιθώριο βελτίωσης."
        : "Χρειάζονται περισσότερα δεδομένα ή ενεργοποίηση επιπλέον καναλιών.";

  const statusItems = [
    {
      label: "Smart link online",
      active: smartLinkOnline,
    },
    {
      label: "Μενού ενεργό",
      active: menuActive,
    },
    {
      label: "Analytics tracking",
      active: trackingActive,
    },
    {
      label: "NFC / QR traffic",
      active: nfcOrQrActive,
    },
    {
      label: `${sevenDayReviewClicks} review clicks / 7 ημέρες`,
      active: sevenDayReviewClicks > 0,
    },
  ];

  return (
    <section className="relative overflow-hidden rounded-[20px] bg-[#DC2727] p-6 text-white md:p-8">
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-28 -right-28 h-72 w-72 rounded-full border-[50px] border-white/10"
      />

      <div className="relative">
        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/60">
          Business health
        </p>

        <div className="mt-6 flex items-end gap-3">
          <span className="text-[84px] font-black leading-none tracking-[-0.07em]">
            {healthScore}
          </span>
          <span className="mb-2 text-[20px] font-bold text-white/45">/100</span>
        </div>

        <p className="mt-4 max-w-xs text-[14px] leading-relaxed text-white/75">
          {healthMessage}
        </p>

        <div className="mt-8 flex flex-col gap-3 text-[12px] font-semibold">
          {statusItems.map((item) => (
            <p key={item.label} className="flex items-center gap-3">
              <span
                className={`grid h-5 w-5 place-items-center rounded-full text-[10px] ${
                  item.active
                    ? "bg-white text-[#DC2727]"
                    : "border border-white/30 text-white/55"
                }`}
              >
                {item.active ? "✓" : "–"}
              </span>
              <span className={item.active ? "text-white" : "text-white/55"}>
                {item.label}
              </span>
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}

function RecentActivity({ events }: { events: AnalyticsEvent[] }) {
  return (
    <section className="rounded-[20px] border border-black/10 bg-white p-6 md:p-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#DC2727]">
            Live feed
          </p>
          <h2 className="mt-3 text-[28px] font-black tracking-[-0.04em]">
            Πρόσφατη δραστηριότητα
          </h2>
        </div>

        <span className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.18em] text-[#222]/35">
          <span className="h-2 w-2 animate-pulse rounded-full bg-[#DC2727]" />
          Live
        </span>
      </div>

      <div className="mt-8">
        {events.length === 0 ? (
          <p className="py-8 text-[13px] text-[#222]/40">
            Δεν υπάρχει ακόμη δραστηριότητα.
          </p>
        ) : (
          events.map((item, index) => (
            <div
              key={`${item.created_at}-${item.event_name}-${index}`}
              className={`grid grid-cols-[60px_1fr_auto] items-center gap-4 py-4 ${
                index !== 0 ? "border-t border-black/8" : ""
              }`}
            >
              <span className="font-mono text-[11px] font-bold text-[#222]/35">
                {new Intl.DateTimeFormat("el-GR", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                  timeZone: "Europe/Athens",
                }).format(new Date(item.created_at))}
              </span>

              <span className="text-[13px] font-bold text-[#222]">
                {formatEventName(item.event_name)}
              </span>

              <span className="text-right text-[10px] text-[#222]/35">
                {formatSource(item.source)}
              </span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

/* ================================================================== */
/*  DASHBOARD PAGE                                                    */
/* ================================================================== */

function DashboardTabPlaceholder({
  tab,
  analytics,
}: {
  tab: Exclude<DashboardTab, "overview">;
  analytics: AnalyticsResponse | null;
}) {
  const content: Record<
    Exclude<DashboardTab, "overview">,
    { eyebrow: string; title: string; description: string }
  > = {
    analytics: {
      eyebrow: "Analytics",
      title: "Αναλυτικά δεδομένα",
      description:
        "Εδώ θα μπουν φίλτρα ημερομηνιών, σύγκριση NFC με QR, ώρες αιχμής και αναλυτικά conversion rates.",
    },
    reviews: {
      eyebrow: "Αξιολογήσεις",
      title: "Review performance",
      description:
        "Εδώ θα εμφανίζονται τα review clicks, το review rate και οι ευκαιρίες βελτίωσης.",
    },
    menu: {
      eyebrow: "Μενού",
      title: "Απόδοση ψηφιακού μενού",
      description:
        "Εδώ θα εμφανίζονται τα ανοίγματα μενού, οι δημοφιλείς κατηγορίες και η δραστηριότητα του menu.",
    },
    nfc: {
      eyebrow: "NFC κάρτες",
      title: "Διαχείριση καρτών",
      description:
        "Εδώ θα προστεθούν οι κάρτες, η κατάστασή τους και τα taps ανά κάρτα ή τοποθεσία.",
    },
    settings: {
      eyebrow: "Ρυθμίσεις",
      title: "Ρυθμίσεις επιχείρησης",
      description:
        "Εδώ θα διαχειρίζεσαι στοιχεία επιχείρησης, smart links, integrations και λογαριασμό.",
    },
  };

  const selected = content[tab];

  return (
    <section className="rounded-[24px] border border-black/10 bg-white p-8 md:p-12">
      <p className="text-[10px] font-bold uppercase tracking-[0.26em] text-[#DC2727]">
        {selected.eyebrow}
      </p>

      <h1 className="mt-5 max-w-[14ch] text-[11vw] font-black leading-[0.9] tracking-[-0.05em] sm:text-[7vw] lg:text-[4.8vw]">
        {selected.title}
      </h1>

      <p className="mt-7 max-w-2xl text-[15px] leading-relaxed text-[#222]/55">
        {selected.description}
      </p>

      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-[16px] bg-[#F6F6F4] p-5">
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#222]/35">
            Επισκέψεις μήνα
          </p>
          <p className="mt-3 text-[34px] font-black">
            {numberFormatter.format(analytics?.totals.page_views_month ?? 0)}
          </p>
        </div>

        <div className="rounded-[16px] bg-[#F6F6F4] p-5">
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#222]/35">
            Menu opens σήμερα
          </p>
          <p className="mt-3 text-[34px] font-black">
            {numberFormatter.format(analytics?.totals.menu_opens_today ?? 0)}
          </p>
        </div>

        <div className="rounded-[16px] bg-[#F6F6F4] p-5">
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#222]/35">
            Review clicks σήμερα
          </p>
          <p className="mt-3 text-[34px] font-black">
            {numberFormatter.format(analytics?.totals.review_clicks_today ?? 0)}
          </p>
        </div>
      </div>

      <div className="mt-10 inline-flex rounded-full bg-[#222] px-5 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white">
        Η πλήρης ενότητα έρχεται στο επόμενο στάδιο
      </div>
    </section>
  );
}

function PendingApproval({
  email,
  onSignOut,
}: {
  email: string;
  onSignOut: () => Promise<void>;
}) {
  return (
    <section className="relative overflow-hidden rounded-[24px] border border-black/10 bg-white p-8 md:p-12">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#DC2727]/10 blur-3xl"
      />

      <div className="relative max-w-3xl">
        <p className="text-[10px] font-bold uppercase tracking-[0.26em] text-[#DC2727]">
          Account review
        </p>

        <h1 className="mt-5 text-[11vw] font-black leading-[0.88] tracking-[-0.055em] sm:text-[7vw] lg:text-[5.4vw]">
          Ο λογαριασμός σου δημιουργήθηκε.
        </h1>

        <p className="mt-7 max-w-2xl text-[15px] leading-relaxed text-[#222]/55">
          Το αίτημα για το <strong className="text-[#222]">Zisto dashboard</strong>{" "}
          περιμένει έγκριση και σύνδεση με την επιχείρησή σου. Μόλις εγκριθεί,
          θα εμφανιστούν αυτόματα τα πραγματικά στατιστικά.
        </p>

        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
          {[
            ["01", "Εγγραφή", "Ο λογαριασμός δημιουργήθηκε."],
            ["02", "Έγκριση Zisto", "Συνδέουμε τον χρήστη με την επιχείρηση."],
            ["03", "Live analytics", "Ξεκλειδώνουν τα πραγματικά δεδομένα."],
          ].map(([number, title, body], index) => (
            <div
              key={number}
              className={`rounded-[18px] border p-5 ${
                index === 0
                  ? "border-green-200 bg-green-50"
                  : index === 1
                    ? "border-[#DC2727]/25 bg-[#DC2727]/5"
                    : "border-black/8 bg-[#F6F6F4]"
              }`}
            >
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#222]/35">
                {number}
              </p>
              <p className="mt-4 text-[16px] font-black">{title}</p>
              <p className="mt-2 text-[12px] leading-relaxed text-[#222]/45">
                {body}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-8 text-[11px] text-[#222]/40">
          Συνδεδεμένο email: <strong>{email}</strong>
        </p>

        <button
          type="button"
          onClick={onSignOut}
          className="mt-8 rounded-full bg-[#222] px-6 py-4 text-[10px] font-bold uppercase tracking-[0.18em] text-white transition hover:bg-[#DC2727]"
        >
          Αποσύνδεση
        </button>
      </div>
    </section>
  );
}

function DashboardTutorial({
  step,
  onNext,
  onBack,
  onSkip,
}: {
  step: number;
  onNext: () => void | Promise<void>;
  onBack: () => void;
  onSkip: () => void | Promise<void>;
}) {
  const steps = [
    {
      eyebrow: "Βήμα 1 από 3",
      title: "Καλωσήρθες στο Zisto.",
      body: "Στην Επισκόπηση βλέπεις τις βασικές μετρήσεις της επιχείρησής σου σε πραγματικό χρόνο.",
    },
    {
      eyebrow: "Βήμα 2 από 3",
      title: "Κατανόησε τη διαδρομή.",
      body: "Οι επισκέψεις, τα ανοίγματα μενού και τα review clicks δείχνουν τι κάνει ο πελάτης μετά το NFC ή το QR.",
    },
    {
      eyebrow: "Βήμα 3 από 3",
      title: "Βελτίωσε τα αποτελέσματα.",
      body: "Χρησιμοποίησε τα Analytics και το Business Health για να εντοπίζεις ευκαιρίες και προβλήματα.",
    },
  ];

  const current = steps[step];

  return (
    <div className="fixed inset-0 z-[200] grid place-items-center bg-black/55 p-5 backdrop-blur-sm">
      <section className="w-full max-w-[620px] overflow-hidden rounded-[24px] bg-white shadow-2xl">
        <div className="h-2 bg-[#DC2727]">
          <div
            className="h-full bg-[#222] transition-all duration-500"
            style={{ width: `${((step + 1) / steps.length) * 100}%` }}
          />
        </div>

        <div className="p-8 md:p-12">
          <p className="text-[10px] font-bold uppercase tracking-[0.26em] text-[#DC2727]">
            {current.eyebrow}
          </p>

          <h2 className="mt-5 text-[40px] font-black leading-[0.9] tracking-[-0.045em] md:text-[58px]">
            {current.title}
          </h2>

          <p className="mt-7 text-[15px] leading-relaxed text-[#222]/55">
            {current.body}
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-between gap-4">
            <button
              type="button"
              onClick={onSkip}
              className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#222]/40 hover:text-[#222]"
            >
              Παράλειψη
            </button>

            <div className="flex gap-3">
              {step > 0 && (
                <button
                  type="button"
                  onClick={onBack}
                  className="rounded-full border border-black/10 px-5 py-3 text-[10px] font-bold uppercase tracking-[0.16em]"
                >
                  Πίσω
                </button>
              )}

              <button
                type="button"
                onClick={onNext}
                className="rounded-full bg-[#222] px-6 py-3 text-[10px] font-bold uppercase tracking-[0.16em] text-white hover:bg-[#DC2727]"
              >
                {step === steps.length - 1 ? "Ολοκλήρωση" : "Επόμενο"}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

type DashboardTab =
  | "overview"
  | "analytics"
  | "reviews"
  | "menu"
  | "nfc"
  | "settings";

function DashboardPage({
  businessId,
}: {
  businessId?: string | null;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [awaitingApproval, setAwaitingApproval] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let refreshTimer: number | null = null;

    async function loadProtectedDashboard() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        window.location.hash = "/login";
        return;
      }

      if (active) {
        setUserEmail(session.user.email ?? "");
      }

      async function loadAnalytics() {
        try {
          setAnalyticsLoading(true);
          setAnalyticsError(null);

          const data = await fetchAnalytics(
            session.access_token,
            businessId,
          );

          if (active) {
            setAnalytics(data);
            setAwaitingApproval(false);

            const tutorialKey = `zisto_tutorial_${session.user.id}`;

            if (!window.localStorage.getItem(tutorialKey)) {
              setShowTutorial(true);
              setTutorialStep(0);
            }
          }
        } catch (error) {
          console.error(error);

          if (active) {
            if (
              error instanceof AnalyticsRequestError &&
              error.status === 403
            ) {
              setAwaitingApproval(true);
              setAnalyticsError(null);
            } else {
              setAnalyticsError("Δεν ήταν δυνατή η φόρτωση των analytics.");
            }
          }
        } finally {
          if (active) {
            setAnalyticsLoading(false);
          }
        }
      }

      await loadAnalytics();

      refreshTimer = window.setInterval(loadAnalytics, 60_000);
    }

    loadProtectedDashboard();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        window.location.hash = "/login";
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();

      if (refreshTimer !== null) {
        window.clearInterval(refreshTimer);
      }
    };
  }, [businessId]);

  const dashboardMetrics = analytics
    ? [
        {
          label: "Επισκέψεις μήνα",
          value: numberFormatter.format(analytics.totals.page_views_month),
          change: "Live",
          note: `${numberFormatter.format(analytics.totals.unique_visitors_month)} μοναδικοί επισκέπτες`,
        },
        {
          label: "Ανοίγματα μενού σήμερα",
          value: numberFormatter.format(analytics.totals.menu_opens_today),
          change: "Live",
          note: `${percentFormatter.format(analytics.totals.menu_conversion_rate)}% των σημερινών επισκέψεων`,
        },
        {
          label: "Review clicks σήμερα",
          value: numberFormatter.format(analytics.totals.review_clicks_today),
          change: "Live",
          note: `${percentFormatter.format(analytics.totals.review_conversion_rate)}% των σημερινών επισκέψεων`,
        },
        {
          label: "Μοναδικοί σήμερα",
          value: numberFormatter.format(analytics.totals.unique_visitors_today),
          change: "Live",
          note: `${numberFormatter.format(analytics.totals.page_views_today)} συνολικές επισκέψεις σήμερα`,
        },
      ]
    : [];

  const sevenDayViews =
    analytics?.daily_activity.reduce(
      (sum, item) => sum + item.page_views,
      0,
    ) ?? 0;

  const sevenDayReviewClicks =
    analytics?.daily_activity.reduce(
      (sum, item) => sum + item.review_clicks,
      0,
    ) ?? 0;

  const reviewOpportunity = Math.max(
    0,
    sevenDayViews - sevenDayReviewClicks,
  );

  const clientDisplayName =
    userEmail.split("@")[0]?.trim() || "Πελάτης";

  const clientInitial =
    clientDisplayName.charAt(0).toLocaleUpperCase("el-GR") || "Z";

  const businessName =
    analytics?.business.name ?? "Η επιχείρησή σου";

  const businessLocation =
    analytics?.business.location_name ?? "Zisto client";

  return (
    <main className="min-h-screen bg-[#F6F6F4] font-sans text-[#222]">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col bg-[#222] p-6 text-white transition-transform duration-500 lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between">
          <a href="/">
            <img
              src={WORDMARKWHITE}
              alt="Zisto"
              className="h-8 w-auto"
              draggable={false}
            />
          </a>

          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="grid h-10 w-10 place-items-center rounded-full border border-white/10 text-white lg:hidden"
            aria-label="Κλείσιμο μενού"
          >
            ×
          </button>
        </div>

        <div className="mt-12 rounded-[16px] border border-white/10 bg-white/[0.04] p-4">
          <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/35">
            Επιχείρηση
          </p>

          <div className="mt-4 flex items-center gap-3">
            <div className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-full bg-[#DC2727] text-[15px] font-black">
              {clientInitial}
            </div>

            <div className="min-w-0">
              <p className="truncate text-[13px] font-bold">
                {businessName}
              </p>
              <p className="mt-1 text-[10px] text-white/40">{businessLocation}</p>
            </div>
          </div>
        </div>

        <nav className="mt-10 flex flex-col gap-2">
          {[
            { id: "overview" as const, icon: "▦", label: "Επισκόπηση" },
            { id: "analytics" as const, icon: "↗", label: "Analytics" },
            { id: "reviews" as const, icon: "★", label: "Αξιολογήσεις" },
            { id: "menu" as const, icon: "☰", label: "Μενού" },
            { id: "nfc" as const, icon: "⌁", label: "NFC κάρτες" },
            { id: "settings" as const, icon: "⚙", label: "Ρυθμίσεις" },
          ].map((item) => {
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveTab(item.id);
                  setSidebarOpen(false);
                }}
                className={`flex w-full items-center gap-4 rounded-[12px] px-4 py-3.5 text-left text-[12px] font-bold transition-colors ${
                  isActive
                    ? "bg-[#DC2727] text-white"
                    : "text-white/50 hover:bg-white/[0.06] hover:text-white"
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                <span className="w-4 text-center">{item.icon}</span>
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="mt-auto space-y-4">
          <button
            type="button"
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.hash = "/login";
            }}
            className="flex w-full items-center gap-3 border-t border-white/10 pt-6 text-left text-[10px] font-bold uppercase tracking-[0.18em] text-white/40 transition-colors hover:text-white"
          >
            ↪ Αποσύνδεση
          </button>

          <a
            href="/"
            className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/40 transition-colors hover:text-white"
          >
            ← Επιστροφή στο site
          </a>
        </div>
      </aside>

      {sidebarOpen && (
        <button
          type="button"
          aria-label="Κλείσιμο overlay"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/35 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* Main content */}
      <div className="min-h-screen lg:pl-[280px]">
        <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-black/5 bg-[#F6F6F4]/85 px-5 backdrop-blur-xl md:px-8 lg:px-10">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="grid h-11 w-11 place-items-center rounded-full border border-black/10 bg-white lg:hidden"
            aria-label="Άνοιγμα μενού"
          >
            ☰
          </button>

          <p className="hidden text-[10px] font-bold uppercase tracking-[0.22em] text-[#222]/35 sm:block">
            {new Intl.DateTimeFormat("el-GR", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
              timeZone: "Europe/Athens",
            }).format(new Date())}
          </p>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="max-w-[150px] truncate text-[11px] font-bold">{clientDisplayName}</p>
              <p className="text-[9px] uppercase tracking-[0.15em] text-[#222]/35">
                {analytics?.membership_role ?? "client"}
              </p>
            </div>

            <div className="grid h-10 w-10 place-items-center rounded-full bg-[#222] text-[12px] font-black text-white">
              {clientInitial}
            </div>
          </div>
        </header>

        <div className="mx-auto w-full max-w-[1600px] px-5 py-10 md:px-8 lg:px-10 lg:py-14">
          {awaitingApproval ? (
            <PendingApproval
              email={userEmail}
              onSignOut={async () => {
                await supabase.auth.signOut();
                window.location.hash = "/login";
              }}
            />
          ) : activeTab === "overview" ? (
            <>
          <section className="flex flex-wrap items-end justify-between gap-8">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.26em] text-[#DC2727]">
                Dashboard
              </p>

              <h1 className="mt-4 max-w-[12ch] text-[12vw] font-black leading-[0.86] tracking-[-0.055em] sm:text-[8vw] lg:text-[5.8vw] xl:text-[5.8rem]">
                Καλησπέρα,
                <br />
                <span className="text-[#DC2727]">{clientDisplayName}.</span>
              </h1>
            </div>

            <div className="max-w-sm">
              <p className="text-[14px] leading-relaxed text-[#222]/55">
                Τα δεδομένα ενημερώνονται αυτόματα από το smart link.
                {analytics && (
                  <>
                    {" "}Αυτόν τον μήνα καταγράφηκαν{" "}
                    <strong className="text-[#222]">
                      {numberFormatter.format(analytics.totals.page_views_month)}
                    </strong>{" "}
                    επισκέψεις.
                  </>
                )}
              </p>
            </div>
          </section>

          <section className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {analyticsLoading &&
              Array.from({ length: 4 }, (_, index) => (
                <div
                  key={index}
                  className="min-h-[260px] animate-pulse rounded-[20px] border border-black/5 bg-white"
                />
              ))}

            {analyticsError && (
              <div className="rounded-[20px] border border-red-200 bg-red-50 p-6 text-sm text-red-700 sm:col-span-2 xl:col-span-4">
                {analyticsError}
              </div>
            )}

            {!analyticsLoading &&
              !analyticsError &&
              dashboardMetrics.map((metric, index) => (
                <DashboardMetric
                  key={metric.label}
                  {...metric}
                  index={index}
                />
              ))}
          </section>

          <section className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-12">
            <div className="xl:col-span-8">
              <DashboardChart data={analytics?.daily_activity ?? []} />
            </div>

            <div className="xl:col-span-4">
              <BusinessHealth analytics={analytics} />
            </div>
          </section>

          <section className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-12">
            <div className="xl:col-span-7">
              <RecentActivity events={analytics?.recent_activity ?? []} />
            </div>

            <section className="rounded-[20px] border border-black/10 bg-white p-6 md:p-8 xl:col-span-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#DC2727]">
                Review opportunity
              </p>

              <h2 className="mt-3 text-[28px] font-black leading-[0.95] tracking-[-0.04em] md:text-[38px]">
                {numberFormatter.format(reviewOpportunity)} επισκέψεις χωρίς review click.
              </h2>

              <p className="mt-5 max-w-md text-[13px] leading-relaxed text-[#222]/50">
                Η μέτρηση αφορά τις τελευταίες 7 ημέρες. Δεν σημαίνει ότι κάθε
                επίσκεψη θα γινόταν αξιολόγηση, αλλά δείχνει το περιθώριο βελτίωσης
                της διαδρομής προς το Google Review.
              </p>

              <button
                type="button"
                className="group mt-10 inline-flex items-center gap-3 rounded-full bg-[#222] px-6 py-4 text-[11px] font-bold uppercase tracking-[0.16em] text-white transition-colors hover:bg-[#DC2727]"
              >
                Βελτίωσε το review rate
                <span className="transition-transform group-hover:translate-x-1">
                  →
                </span>
              </button>
            </section>
          </section>
            </>
          ) : (
            <DashboardTabPlaceholder tab={activeTab} analytics={analytics} />
          )}
        </div>
      </div>
      {showTutorial && analytics && (
        <DashboardTutorial
          step={tutorialStep}
          onNext={async () => {
            if (tutorialStep < 2) {
              setTutorialStep((value) => value + 1);
              return;
            }

            const {
              data: { session },
            } = await supabase.auth.getSession();

            if (session) {
              window.localStorage.setItem(
                `zisto_tutorial_${session.user.id}`,
                "completed",
              );
            }

            setShowTutorial(false);
          }}
          onBack={() =>
            setTutorialStep((value) => Math.max(0, value - 1))
          }
          onSkip={async () => {
            const {
              data: { session },
            } = await supabase.auth.getSession();

            if (session) {
              window.localStorage.setItem(
                `zisto_tutorial_${session.user.id}`,
                "completed",
              );
            }

            setShowTutorial(false);
          }}
        />
      )}
    </main>
  );
}

/* ================================================================== */
/*  ROOT                                                              */
/* ================================================================== */
function LandingPage() {
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

export function ZistoSite() {
  const isInvitationRoute = () => {
    if (typeof window === "undefined") {
      return false;
    }

    return new URLSearchParams(window.location.search).get("invite") === "1";
  };

  const getHashLocation = () => {
  if (typeof window === "undefined") {
    return {
      pathname: "/",
      searchParams: new URLSearchParams(),
    };
  }

  const rawHash =
    window.location.hash.replace(/^#/, "") || "/";

  const [pathname, search = ""] = rawHash.split("?");

  return {
    pathname,
    searchParams: new URLSearchParams(search),
  };
};

  const [hashLocation, setHashLocation] =
  useState(getHashLocation);

const route = hashLocation.pathname;
const selectedBusinessId =
  hashLocation.searchParams.get("business");

  useEffect(() => {
    const handleHashChange = () => {
      setHashLocation(getHashLocation());
      window.scrollTo(0, 0);
    };

    window.addEventListener("hashchange", handleHashChange);

    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, []);

  if (isInvitationRoute()) {
    return <InvitationSetupPage />;
  }

  if (route === "/login") {
    return <LoginPage />;
  }

  if (route === "/dashboard") {
    return (
      <DashboardPage
        businessId={selectedBusinessId}
      />
    );
  }
  
  if (route === "/admin") {
  return <AdminPage />;
  }

  return <LandingPage />;
}

import { useEffect, useState } from "react";
import { MagneticButton } from "./Nav";
import { NfcCard } from "./NfcCard";

function Reveal({
  children,
  delay = 0,
  as: Tag = "div",
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  as?: any;
  className?: string;
}) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setOn(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  return (
    <Tag
      className={className}
      style={{
        opacity: on ? 1 : 0,
        transform: `translateY(${on ? 0 : 22}px)`,
        filter: on ? "blur(0px)" : "blur(6px)",
        transition:
          "opacity 900ms cubic-bezier(0.22,1,0.36,1), transform 900ms cubic-bezier(0.22,1,0.36,1), filter 900ms ease-out",
      }}
    >
      {children}
    </Tag>
  );
}

export function Hero() {
  const [scrollY, setScrollY] = useState(0);
  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <section className="relative overflow-hidden bg-white pt-28 md:pt-32">
      {/* Background: soft gradient + blurred shapes */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(1200px 700px at 85% -10%, rgba(220,39,39,0.10), transparent 60%), radial-gradient(900px 600px at -10% 20%, rgba(34,34,34,0.06), transparent 60%), linear-gradient(180deg, #ffffff 0%, #fafafa 100%)",
          }}
        />
        <div
          className="absolute -left-32 top-40 h-[420px] w-[420px] rounded-full opacity-40 blur-3xl"
          style={{
            background: "radial-gradient(circle, rgba(220,39,39,0.28), transparent 60%)",
            transform: `translateY(${scrollY * 0.15}px)`,
          }}
        />
        <div
          className="absolute right-[-10%] bottom-[-20%] h-[520px] w-[520px] rounded-full opacity-40 blur-3xl"
          style={{
            background: "radial-gradient(circle, rgba(34,34,34,0.18), transparent 60%)",
            transform: `translateY(${scrollY * -0.1}px)`,
          }}
        />
        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              "linear-gradient(to right, #222 1px, transparent 1px), linear-gradient(to bottom, #222 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage:
              "radial-gradient(ellipse at center, black 40%, transparent 75%)",
          }}
        />
      </div>

      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-16 px-6 pb-24 md:px-10 md:pb-32 lg:grid-cols-12 lg:gap-10">
        {/* Left: copy */}
        <div className="lg:col-span-7">
          <Reveal delay={100}>
            <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/70 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-[#222]/70 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-[#DC2727]" />
              Introducing ZISTO
            </div>
          </Reveal>

          <h1 className="mt-7 text-[15vw] font-black leading-[0.88] tracking-[-0.045em] text-[#222] sm:text-[9vw] lg:text-[7.2vw] xl:text-[8rem]">
            <Reveal delay={200} as="span" className="block">
              One tap.
            </Reveal>
            <Reveal delay={340} as="span" className="block">
              <span className="italic font-black text-[#DC2727]">Endless</span> reach.
            </Reveal>
          </h1>

          <Reveal delay={520}>
            <p className="mt-8 max-w-xl text-lg leading-relaxed text-[#222]/65 md:text-xl">
              ZISTO turns a single NFC card into your entire digital identity —
              share contacts, links and payments in a single, effortless tap.
            </p>
          </Reveal>

          <Reveal delay={680}>
            <div className="mt-10 flex flex-wrap items-center gap-4" id="get-started">
              <MagneticButton>
                <a
                  href="#"
                  className="group inline-flex items-center gap-3 rounded-full bg-[#222] px-7 py-4 text-[15px] font-semibold text-white shadow-[0_20px_40px_-15px_rgba(34,34,34,0.55)] transition-all duration-300 hover:bg-black hover:shadow-[0_30px_60px_-20px_rgba(34,34,34,0.7)]"
                >
                  Get Started
                  <span className="inline-block transition-transform duration-300 group-hover:translate-x-1">
                    →
                  </span>
                </a>
              </MagneticButton>

              <MagneticButton>
                <a
                  href="#"
                  className="group inline-flex items-center gap-3 rounded-full border border-black/15 bg-white/60 px-7 py-4 text-[15px] font-semibold text-[#222] backdrop-blur transition-all duration-300 hover:border-black/40 hover:bg-white"
                >
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-[#222] text-[10px] text-white">
                    ▶
                  </span>
                  Watch the film
                </a>
              </MagneticButton>
            </div>
          </Reveal>

          <Reveal delay={860}>
            <div className="mt-14 flex items-center gap-6 text-[11px] uppercase tracking-[0.22em] text-[#222]/50">
              <span>Trusted by teams at</span>
              <div className="flex flex-wrap items-center gap-x-7 gap-y-2 font-bold tracking-[0.28em] text-[#222]/70">
                <span>NORTH·CO</span>
                <span>LUMEN</span>
                <span>FIELD/OS</span>
                <span>ORBIS</span>
              </div>
            </div>
          </Reveal>
        </div>

        {/* Right: NFC card */}
        <div
          className="relative lg:col-span-5"
          style={{ transform: `translateY(${scrollY * -0.08}px)` }}
        >
          <NfcCard />
        </div>
      </div>

      {/* Scroll hint */}
      <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-[0.35em] text-[#222]/40">
        Scroll
      </div>
    </section>
  );
}
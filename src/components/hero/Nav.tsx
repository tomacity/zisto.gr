import { useEffect, useState } from "react";

const links = [
  { label: "Home", href: "#" },
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
  { label: "Contact", href: "#contact" },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
        scrolled ? "backdrop-blur-xl bg-white/70 border-b border-black/5" : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-6 md:h-20 md:px-10">
        <a href="#" className="flex items-center gap-2" aria-label="ZISTO home">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#222]">
            <span className="block h-2.5 w-2.5 rounded-full bg-[#DC2727]" />
          </span>
          <span className="text-[15px] font-extrabold tracking-[0.22em] text-[#222]">
            ZISTO
          </span>
        </a>

        <nav className="hidden items-center gap-9 md:flex">
          {links.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className="group relative text-[13px] font-medium text-[#222]/70 transition-colors hover:text-[#222]"
            >
              {l.label}
              <span className="absolute -bottom-1 left-0 h-px w-full origin-right scale-x-0 bg-[#222] transition-transform duration-300 group-hover:origin-left group-hover:scale-x-100" />
            </a>
          ))}
        </nav>

        <div className="hidden md:block">
          <MagneticButton>
            <a
              href="#get-started"
              className="inline-flex items-center gap-2 rounded-full bg-[#222] px-5 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-black"
            >
              Get Started
              <span aria-hidden>→</span>
            </a>
          </MagneticButton>
        </div>

        <button
          className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/10"
          aria-label="Toggle menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="relative block h-3 w-4">
            <span
              className={`absolute left-0 top-0 h-[2px] w-full bg-[#222] transition-transform ${
                open ? "translate-y-[5px] rotate-45" : ""
              }`}
            />
            <span
              className={`absolute left-0 top-[10px] h-[2px] w-full bg-[#222] transition-transform ${
                open ? "-translate-y-[5px] -rotate-45" : ""
              }`}
            />
          </span>
        </button>
      </div>

      <div
        className={`overflow-hidden border-t border-black/5 bg-white/90 backdrop-blur-xl md:hidden ${
          open ? "max-h-96" : "max-h-0"
        } transition-[max-height] duration-500`}
      >
        <div className="flex flex-col gap-1 px-6 py-4">
          {links.map((l) => (
            <a
              key={l.label}
              href={l.href}
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-3 text-sm font-medium text-[#222] hover:bg-black/5"
            >
              {l.label}
            </a>
          ))}
          <a
            href="#get-started"
            onClick={() => setOpen(false)}
            className="mt-2 inline-flex items-center justify-center rounded-full bg-[#222] px-5 py-3 text-sm font-semibold text-white"
          >
            Get Started
          </a>
        </div>
      </div>
    </header>
  );
}

export function MagneticButton({ children }: { children: React.ReactNode }) {
  const [t, setT] = useState({ x: 0, y: 0 });
  return (
    <div
      onMouseMove={(e) => {
        const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
        const x = e.clientX - (r.left + r.width / 2);
        const y = e.clientY - (r.top + r.height / 2);
        setT({ x: x * 0.25, y: y * 0.35 });
      }}
      onMouseLeave={() => setT({ x: 0, y: 0 })}
      style={{
        transform: `translate3d(${t.x}px, ${t.y}px, 0)`,
        transition: "transform 300ms cubic-bezier(0.22, 1, 0.36, 1)",
      }}
      className="inline-block will-change-transform"
    >
      {children}
    </div>
  );
}
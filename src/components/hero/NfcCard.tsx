import { useEffect, useRef, useState } from "react";

export function NfcCard() {
  const wrap = useRef<HTMLDivElement>(null);
  const [t, setT] = useState({ rx: 0, ry: 0, mx: 50, my: 50 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const el = wrap.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = (e.clientX - cx) / window.innerWidth;
      const dy = (e.clientY - cy) / window.innerHeight;
      const mx = ((e.clientX - r.left) / r.width) * 100;
      const my = ((e.clientY - r.top) / r.height) * 100;
      setT({
        ry: Math.max(-14, Math.min(14, dx * 22)),
        rx: Math.max(-12, Math.min(12, -dy * 18)),
        mx: isFinite(mx) ? mx : 50,
        my: isFinite(my) ? my : 50,
      });
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  return (
    <div
      ref={wrap}
      className="relative mx-auto aspect-[1.586/1] w-full max-w-[440px] [perspective:1400px] sm:max-w-[520px]"
      style={{
        opacity: mounted ? 1 : 0,
        transform: `translateY(${mounted ? 0 : 24}px)`,
        transition: "opacity 900ms ease-out 200ms, transform 900ms cubic-bezier(0.22,1,0.36,1) 200ms",
      }}
    >
      {/* Ambient glow */}
      <div
        aria-hidden
        className="absolute -inset-16 -z-10 rounded-[48px] opacity-70 blur-3xl"
        style={{
          background:
            "radial-gradient(60% 60% at 30% 30%, rgba(220,39,39,0.18), transparent 60%), radial-gradient(60% 60% at 70% 70%, rgba(34,34,34,0.14), transparent 60%)",
        }}
      />

      {/* Float wrapper */}
      <div className="h-full w-full animate-[zisto-float_7s_ease-in-out_infinite] will-change-transform">
        {/* Tilt wrapper */}
        <div
          className="relative h-full w-full will-change-transform"
          style={{
            transform: `rotateX(${t.rx}deg) rotateY(${t.ry}deg)`,
            transformStyle: "preserve-3d",
            transition: "transform 400ms cubic-bezier(0.22,1,0.36,1)",
          }}
        >
          {/* Soft floor shadow */}
          <div
            aria-hidden
            className="absolute left-1/2 top-full h-10 w-3/4 -translate-x-1/2 rounded-[100%] bg-black/25 blur-2xl"
            style={{ transform: "translate(-50%, 12px) rotateX(75deg)" }}
          />

          {/* Card */}
          <div
            className="relative h-full w-full overflow-hidden rounded-[28px] border border-white/10"
            style={{
              background:
                "linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 50%, #0d0d0d 100%)",
              boxShadow:
                "0 40px 80px -20px rgba(0,0,0,0.55), 0 20px 40px -12px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08)",
              transformStyle: "preserve-3d",
            }}
          >
            {/* Subtle radial sheen */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background: `radial-gradient(600px circle at ${t.mx}% ${t.my}%, rgba(255,255,255,0.14), transparent 40%)`,
                transition: "background 200ms ease-out",
              }}
            />

            {/* Glass reflection stripe */}
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-y-8 -left-1/3 w-1/2 rotate-12 opacity-60"
              style={{
                background:
                  "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.10) 45%, rgba(255,255,255,0.22) 50%, rgba(255,255,255,0.10) 55%, transparent 100%)",
                transform: `translateX(${(t.mx - 50) * 1.6}px) rotate(12deg)`,
                transition: "transform 300ms ease-out",
              }}
            />

            {/* Red accent orb */}
            <div
              aria-hidden
              className="absolute -right-16 -top-16 h-56 w-56 rounded-full opacity-70 blur-2xl"
              style={{ background: "radial-gradient(circle, #DC2727 0%, transparent 65%)" }}
            />

            {/* Content */}
            <div className="relative flex h-full flex-col justify-between p-7 sm:p-8">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 backdrop-blur">
                    <span className="block h-2 w-2 rounded-full bg-[#DC2727]" />
                  </span>
                  <span className="text-[11px] font-bold tracking-[0.28em] text-white/85">
                    ZISTO
                  </span>
                </div>
                {/* NFC wave */}
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="text-white/70"
                  aria-hidden
                >
                  <path d="M6 8c3 2 3 6 0 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M10 5c5 3 5 11 0 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M14 2c7 4 7 16 0 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>

              {/* Chip */}
              <div className="flex items-end justify-between">
                <div
                  className="h-10 w-14 rounded-md"
                  style={{
                    background:
                      "linear-gradient(135deg, #d4a95a 0%, #b3873a 50%, #8a6524 100%)",
                    boxShadow:
                      "inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -1px 0 rgba(0,0,0,0.3)",
                  }}
                  aria-hidden
                />
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-[0.24em] text-white/50">
                    Tap · Pay · Go
                  </div>
                  <div className="mt-1 font-mono text-[13px] tracking-[0.18em] text-white/85">
                    •••• 2049
                  </div>
                </div>
              </div>
            </div>

            {/* Top edge highlight */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-px"
              style={{
                background:
                  "linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
import { useState } from "react";
import { ZistoConfigurator } from "./ZistoConfigurator";

export function ZistoConfiguratorSection() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <section
        id="configure"
        className="relative overflow-hidden bg-white py-28 md:py-40"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 top-10 h-[420px] w-[420px] rounded-full opacity-40 blur-3xl"
          style={{
            background:
              "radial-gradient(circle, rgba(220,39,39,0.22), transparent 68%)",
          }}
        />

        <div className="relative mx-auto w-full max-w-[1400px] px-5 md:px-10">
          <div className="grid gap-10 border-y border-black/10 py-12 md:grid-cols-12 md:items-end md:py-16">
            <div className="md:col-span-8">
              <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#DC2727]">
                Φτιάξε το Zisto σου
              </p>

              <h2 className="mt-5 max-w-[13ch] text-[11vw] font-black leading-[0.88] tracking-[-0.045em] text-[#222] md:text-[6.4vw] lg:text-[5.2vw]">
                Δεν χρειάζεσαι πακέτο. Χρειάζεσαι το σωστό Zisto.
              </h2>
            </div>

            <div className="md:col-span-4 md:pb-2">
              <p className="max-w-md text-[14px] leading-relaxed text-[#222]/55 md:text-[15px]">
                Απάντησε σε λίγες σύντομες ερωτήσεις και θα καταλάβουμε ακριβώς τι χρειάζεται η επιχείρησή σου — από reviews και menu μέχρι tracking, NFC κάρτες και custom Smart Link.
              </p>

              <button
                type="button"
                onClick={() => setOpen(true)}
                className="group mt-7 inline-flex items-center gap-3 rounded-full bg-[#222] px-7 py-4 text-[12px] font-bold uppercase tracking-[0.16em] text-white shadow-[0_24px_50px_-24px_rgba(34,34,34,0.65)] transition-all duration-300 hover:bg-[#DC2727] hover:shadow-[0_28px_60px_-24px_rgba(220,39,39,0.55)]"
              >
                Ξεκίνα το δικό σου Zisto
                <span className="transition-transform duration-300 group-hover:translate-x-1">
                  →
                </span>
              </button>

              <p className="mt-4 font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[#222]/30">
                7 βήματα · περίπου 2 λεπτά
              </p>
            </div>
          </div>

          <div className="grid gap-px overflow-hidden border-b border-black/10 bg-black/10 sm:grid-cols-3">
            {[
              ["01", "Πες μας τι έχεις"],
              ["02", "Διάλεξε τι χρειάζεσαι"],
              ["03", "Πάρε τη δική σου πρόταση"],
            ].map(([number, label]) => (
              <div
                key={number}
                className="bg-white px-5 py-6 md:px-7 md:py-8"
              >
                <p className="font-mono text-[9px] font-bold uppercase tracking-[0.24em] text-[#DC2727]">
                  {number}
                </p>
                <p className="mt-3 text-[15px] font-black tracking-[-0.02em] text-[#222]">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <ZistoConfigurator
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

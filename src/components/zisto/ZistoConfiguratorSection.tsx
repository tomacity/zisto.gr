import { useState } from "react";
import { ZistoConfigurator } from "./ZistoConfigurator";

const PREVIEW_CHOICES = [
  "Εστιατόριο",
  "Ξενοδοχείο",
  "Airbnb",
  "Άλλο",
];

const PREVIEW_RESULT = [
  "Google Reviews",
  "Digital Menu",
  "Smart Link",
];

export function ZistoConfiguratorSection() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <section
        id="configure"
        className="relative overflow-hidden bg-white py-24 md:py-36"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 top-8 h-[460px] w-[460px] rounded-full opacity-45 blur-3xl"
          style={{
            background:
              "radial-gradient(circle, rgba(220,39,39,0.18), transparent 68%)",
          }}
        />

        <div className="relative mx-auto w-full max-w-[1400px] px-5 md:px-10">
          <div className="grid gap-12 border-y border-black/10 py-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:gap-16 lg:py-16">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#DC2727]">
                Φτιάξε το Zisto σου
              </p>

              <h2 className="mt-5 max-w-[11ch] text-[12vw] font-black leading-[0.9] tracking-[-0.045em] text-[#222] sm:text-[9vw] lg:text-[4.7vw] xl:text-[4.2rem]">
                Πες μας τι χρειάζεσαι. Θα σου φτιάξουμε το σωστό Zisto.
              </h2>

              <p className="mt-7 max-w-xl text-[15px] leading-7 text-[#222]/55 md:text-[16px]">
                Δεν χρειάζεται να ξέρεις ποιο πακέτο σου ταιριάζει.
                Απάντησε σε 7 γρήγορες ερωτήσεις και θα καταλάβουμε
                τι χρειάζεται η επιχείρησή σου — από reviews και menu
                μέχρι NFC κάρτες, tracking και custom Smart Link.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={() => setOpen(true)}
                  className="group inline-flex items-center gap-3 rounded-full bg-[#DC2727] px-7 py-4 text-[12px] font-bold uppercase tracking-[0.16em] text-white shadow-[0_24px_50px_-24px_rgba(220,39,39,0.55)] transition-all duration-300 hover:bg-[#222] hover:shadow-[0_28px_60px_-24px_rgba(34,34,34,0.55)]"
                >
                  Ξεκίνα το δικό σου Zisto
                  <span className="transition-transform duration-300 group-hover:translate-x-1">
                    →
                  </span>
                </button>

              </div>
            </div>

            <div className="relative mx-auto w-full max-w-[650px]">
              <div
                aria-hidden
                className="absolute -left-8 -top-8 h-28 w-28 rounded-full border border-[#DC2727]/20"
              />

              <div className="relative overflow-hidden rounded-[28px] border border-black/10 bg-[#F7F5F1] p-4 shadow-[0_30px_80px_-45px_rgba(34,34,34,0.45)] sm:p-6">
                <div className="rounded-[22px] bg-white p-5 sm:p-7">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-[#DC2727]">
                        Φτιάξε το Zisto σου
                      </p>
                      <p className="mt-1 font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-[#222]/30">
                        Βήμα 1 / 7
                      </p>
                    </div>

                    <div className="grid h-11 w-11 place-items-center rounded-full bg-[#222]">
                      <img
                        src="/images/zisto-monogram.png"
                        alt=""
                        className="h-7 w-7 object-contain brightness-0 invert"
                        draggable={false}
                      />
                    </div>
                  </div>

                  <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-black/5">
                    <div className="h-full w-[16%] rounded-full bg-[#DC2727]" />
                  </div>

                  <p className="mt-7 text-[26px] font-black leading-[1] tracking-[-0.035em] text-[#222] sm:text-[32px]">
                    Τι είδους επιχείρηση έχεις;
                  </p>

                  <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
                    {PREVIEW_CHOICES.map((choice, index) => (
                      <div
                        key={choice}
                        className={`flex min-h-[54px] items-center justify-between rounded-[16px] border px-4 py-3 text-[12px] font-bold ${
                          index === 0
                            ? "border-[#222] bg-[#222] text-white"
                            : "border-black/10 bg-[#F7F5F1] text-[#222]/70"
                        }`}
                      >
                        <span>{choice}</span>
                        <span
                          className={`grid h-5 w-5 place-items-center rounded-full border text-[10px] ${
                            index === 0
                              ? "border-[#DC2727] bg-[#DC2727] text-white"
                              : "border-black/10 text-transparent"
                          }`}
                        >
                          ✓
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 flex justify-end">
                    <div className="rounded-full bg-[#222] px-5 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-white">
                      Συνέχεια →
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div className="rounded-[18px] bg-[#222] p-5 text-white">
                    <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/40">
                      Στο τέλος
                    </p>
                    <p className="mt-2 text-[16px] font-black tracking-[-0.02em]">
                      Παίρνεις τη δική σου πρόταση.
                    </p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {PREVIEW_RESULT.map((item) => (
                        <span
                          key={item}
                          className="rounded-full bg-white/10 px-3 py-2 text-[9px] font-bold uppercase tracking-[0.08em] text-white/80"
                        >
                          ✓ {item}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="grid min-w-[118px] place-items-center rounded-[18px] bg-[#DC2727] px-5 py-6 text-center text-white">
                    <span className="text-[28px] font-black leading-none">
                      2'
                    </span>
                    <span className="mt-2 text-[8px] font-bold uppercase tracking-[0.16em] text-white/75">
                      περίπου
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-px overflow-hidden border-b border-black/10 bg-black/10 sm:grid-cols-3">
            {[
              ["01", "Μας λες τι επιχείρηση έχεις"],
              ["02", "Διαλέγεις τι χρειάζεσαι"],
              ["03", "Παίρνεις τη δική σου πρόταση"],
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

import { ZistoConfiguratorInline } from "./ZistoConfiguratorInline";

export function ZistoConfiguratorSection() {
  return (
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
        <div className="grid gap-12 border-y border-black/10 py-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-start lg:gap-16 lg:py-16">
          <div className="lg:sticky lg:top-28">
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

            <a
              href="#zisto-form"
              className="group mt-8 inline-flex items-center gap-3 rounded-full bg-[#DC2727] px-7 py-4 text-[12px] font-bold uppercase tracking-[0.16em] text-white shadow-[0_24px_50px_-24px_rgba(220,39,39,0.55)] transition-all duration-300 hover:bg-[#222] hover:shadow-[0_28px_60px_-24px_rgba(34,34,34,0.55)] lg:hidden"
            >
              Ξεκίνα το δικό σου Zisto
              <span className="transition-transform duration-300 group-hover:translate-x-1">
                →
              </span>
            </a>
          </div>

          <div className="w-full">
            <ZistoConfiguratorInline />
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
  );
}

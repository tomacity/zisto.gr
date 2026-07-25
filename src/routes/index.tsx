import { createFileRoute } from "@tanstack/react-router";
import { ZistoSite } from "@/components/zisto/Site";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Zisto — Ένα άγγιγμα. Όλη η εικόνα σου." },
      {
        name: "description",
        content:
          "Το Zisto φτιάχνει το φυσικό & ψηφιακό kit που μετατρέπει κάθε πελάτη σου σε 5άστερο review — με ένα άγγιγμα.",
      },
      { property: "og:title", content: "Zisto — Ένα άγγιγμα. Όλη η εικόνα σου." },
      {
        property: "og:description",
        content:
          "NFC κάρτες, smart links και ψηφιακά μενού σχεδιασμένα από το μηδέν για το μαγαζί σου.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return <ZistoSite />;
}

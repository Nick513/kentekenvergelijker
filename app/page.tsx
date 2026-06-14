import { KentekenForm } from "@/components/kenteken-form";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

const faqItems = [
  {
    question: "Wat is Kentekenvergelijker?",
    answer:
      "Kentekenvergelijker is een tool waarmee je meerdere Nederlandse kentekens naast elkaar legt. Je ziet niet alleen merk en model, maar ook de uitrusting en opties van de exacte auto's op de weg.",
  },
  {
    question: "Hoeveel kentekens kan ik vergelijken?",
    answer:
      "Je kunt tussen de 2 en 4 kentekens tegelijk invoeren. Zo houd je de vergelijking overzichtelijk en gericht op de auto's die je echt overweegt.",
  },
  {
    question: "Welke gegevens zie ik per auto?",
    answer:
      "Denk aan uitvoering, pakketten, veiligheidsopties, comfortuitrusting en andere specificaties, zover die gekoppeld zijn aan het voertuig achter het kenteken.",
  },
  {
    question: "Werkt dit alleen voor Nederlandse kentekens?",
    answer:
      "Ja. We starten met de Nederlandse markt. Andere landen volgen later, maar de focus ligt nu op kentekens uit Nederland.",
  },
];

export default function Home() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Kentekenvergelijker",
    url: "https://kentekenvergelijker.nl",
    description:
      "Vergelijk Nederlandse auto's op kenteken. Zie model, uitrusting en opties van exacte voertuigen naast elkaar.",
    applicationCategory: "AutomotiveApplication",
    operatingSystem: "Web",
    inLanguage: "nl-NL",
  };

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <SiteHeader />

      <main>
        <section className="relative overflow-hidden bg-kv-bg">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_0%,rgb(245_197_24_/_14%),transparent_42%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_100%,rgb(21_34_56_/_8%),transparent_50%)]" />

          <div className="relative mx-auto grid max-w-6xl gap-12 px-6 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:py-24">
            <div className="space-y-6">
              <p className="kv-badge">Vergelijk auto&apos;s op kenteken</p>

              <h1 className="max-w-xl text-4xl font-bold tracking-tight text-kv-navy sm:text-5xl sm:leading-tight">
                Ontdek precies welke auto&apos;s je vergelijkt, tot in de uitrusting
              </h1>

              <p className="max-w-xl text-lg leading-8 text-kv-muted">
                Voer een paar Nederlandse kentekens in en krijg een overzichtelijke
                vergelijking van model, uitvoering en specificaties. Geen algemene
                brochure-informatie, maar de auto&apos;s achter de kentekens.
              </p>

              <ul className="grid gap-3 text-sm text-kv-navy sm:grid-cols-2">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 font-bold text-kv-yellow-hover">✓</span>
                  <span>2 tot 4 kentekens tegelijk vergelijken</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 font-bold text-kv-yellow-hover">✓</span>
                  <span>Opties zoals stoelverwarming & rijassistentie</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 font-bold text-kv-yellow-hover">✓</span>
                  <span>Gebouwd voor de Nederlandse markt</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 font-bold text-kv-yellow-hover">✓</span>
                  <span>Duidelijke vergelijkingstabel per voertuig</span>
                </li>
              </ul>
            </div>

            <div id="vergelijken" className="scroll-mt-24">
              <KentekenForm />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-16">
          <div className="mb-10 max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-tight text-kv-navy">
              Waarom vergelijken op kenteken?
            </h2>
            <p className="mt-4 text-lg leading-8 text-kv-muted">
              Twee auto&apos;s kunnen hetzelfde model hebben, maar totaal verschillend
              uitgerust zijn. Door te vergelijken op kenteken zie je welke pakketten,
              opties en uitrusting echt op het voertuig zitten.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                title: "Exacte voertuigen",
                description:
                  "Vergelijk de specifieke auto's achter de kentekens, niet twee generieke configuraties uit een brochure.",
              },
              {
                title: "Uitrusting in detail",
                description:
                  "Van assistentiesystemen tot comfortopties: alles netjes naast elkaar in één tabel.",
              },
              {
                title: "Snelle keuze",
                description:
                  "Ideaal als je tussen meerdere occasions of leaseauto's twijfelt en snel wilt zien wat het verschil is.",
              },
            ].map((item) => (
              <article
                key={item.title}
                className="kv-card border-l-4 border-l-kv-yellow p-6"
              >
                <h3 className="text-lg font-semibold text-kv-navy">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-kv-muted">{item.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-t border-kv-border bg-kv-bg-alt">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <div className="mb-10 max-w-2xl">
              <h2 className="text-3xl font-semibold tracking-tight text-kv-navy">
                Veelgestelde vragen
              </h2>
              <p className="mt-4 text-kv-muted">
                Alles wat je moet weten over het vergelijken van auto&apos;s via kenteken.
              </p>
            </div>

            <div className="grid gap-4">
              {faqItems.map((item) => (
                <details
                  key={item.question}
                  className="group kv-card p-6 open:border-kv-navy/20"
                >
                  <summary className="list-none text-lg font-medium text-kv-navy marker:content-none">
                    <span className="flex items-center justify-between gap-4">
                      {item.question}
                      <span className="text-kv-muted transition group-open:rotate-45">
                        +
                      </span>
                    </span>
                  </summary>
                  <p className="mt-4 text-sm leading-7 text-kv-muted">{item.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}

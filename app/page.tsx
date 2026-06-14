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
        <section className="relative overflow-hidden bg-gradient-to-b from-slate-50 via-white to-blue-50/40">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(29,78,216,0.12),transparent_45%)]" />

          <div className="relative mx-auto grid max-w-6xl gap-12 px-6 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:py-24">
            <div className="space-y-6">
              <p className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800">
                Vergelijk auto&apos;s op kenteken
              </p>

              <h1 className="max-w-xl text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl sm:leading-tight">
                Ontdek precies welke auto&apos;s je vergelijkt, tot in de uitrusting
              </h1>

              <p className="max-w-xl text-lg leading-8 text-slate-600">
                Voer een paar Nederlandse kentekens in en krijg een overzichtelijke
                vergelijking van model, uitvoering en specificaties. Geen algemene
                brochure-informatie, maar de auto&apos;s achter de kentekens.
              </p>

              <ul className="grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
                <li className="flex items-start gap-2">
                  <span className="mt-1 text-blue-700">✓</span>
                  <span>2 tot 4 kentekens tegelijk vergelijken</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 text-blue-700">✓</span>
                  <span>Opties zoals stoelverwarming & rijassistentie</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 text-blue-700">✓</span>
                  <span>Gebouwd voor de Nederlandse markt</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 text-blue-700">✓</span>
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
            <h2 className="text-3xl font-semibold tracking-tight text-slate-900">
              Waarom vergelijken op kenteken?
            </h2>
            <p className="mt-4 text-lg leading-8 text-slate-600">
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
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <h3 className="text-lg font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{item.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-t border-slate-200 bg-slate-50">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <div className="mb-10 max-w-2xl">
              <h2 className="text-3xl font-semibold tracking-tight text-slate-900">
                Veelgestelde vragen
              </h2>
              <p className="mt-4 text-slate-600">
                Alles wat je moet weten over het vergelijken van auto&apos;s via kenteken.
              </p>
            </div>

            <div className="grid gap-4">
              {faqItems.map((item) => (
                <details
                  key={item.question}
                  className="group rounded-2xl border border-slate-200 bg-white p-6"
                >
                  <summary className="cursor-pointer list-none text-lg font-medium text-slate-900 marker:content-none">
                    <span className="flex items-center justify-between gap-4">
                      {item.question}
                      <span className="text-slate-400 transition group-open:rotate-45">+</span>
                    </span>
                  </summary>
                  <p className="mt-4 text-sm leading-7 text-slate-600">{item.answer}</p>
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

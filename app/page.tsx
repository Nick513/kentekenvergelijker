import type { Metadata } from "next";
import { HomeDemoComparison } from "@/components/home-demo-comparison";
import { JsonLd } from "@/components/json-ld";
import { KentekenForm } from "@/components/kenteken-form";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { buildHomeStructuredData } from "@/lib/structured-data";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  alternates: {
    canonical: SITE_URL,
  },
};

const howItWorksSteps = [
  {
    step: "1",
    title: "Voer kentekens in",
    description:
      "Typ de kentekens van de auto's die je overweegt. Minimaal twee, maximaal acht tegelijk.",
  },
  {
    step: "2",
    title: "Bekijk de vergelijking",
    description:
      "Alle specificaties en opties staan naast elkaar in één duidelijke tabel per voertuig.",
  },
  {
    step: "3",
    title: "Maak je keuze",
    description:
      "Zie direct welke auto beter uitgerust is en waar de echte verschillen zitten.",
  },
];

const faqItems = [
  {
    question: "Wat is Kentekenvergelijker?",
    answer:
      "Kentekenvergelijker is een gratis tool om meerdere Nederlandse kentekens naast elkaar te vergelijken. Je vergelijkt niet alleen merk en model, maar ook de uitrusting en opties van de exacte auto's achter elk kenteken.",
  },
  {
    question: "Hoe vergelijk ik auto's op kenteken?",
    answer:
      "Voer twee tot acht Nederlandse kentekens in op Kentekenvergelijker en start de vergelijking. Binnen enkele seconden zie je merk, model, uitvoering, motorgegevens en opties naast elkaar in één overzichtelijke tabel.",
  },
  {
    question: "Hoeveel kentekens kan ik tegelijk vergelijken?",
    answer:
      "Je kunt tussen de 2 en 8 kentekens tegelijk vergelijken. Zo houd je de vergelijking overzichtelijk en gericht op de occasions of auto's die je echt overweegt.",
  },
  {
    question: "Welke specificaties en opties zie ik per kenteken?",
    answer:
      "Per kenteken zie je onder meer merk, model, uitvoering, motorgegevens, veiligheidsopties, comfortuitrusting en pakketten. Denk aan stoelverwarming, rijassistentie, parkeersensoren en adaptieve cruise control.",
  },
  {
    question: "Waarom occasions vergelijken via kenteken?",
    answer:
      "Twee occasions van hetzelfde merk en model kunnen sterk verschillen in uitrusting. Door kentekens naast elkaar te vergelijken zie je direct welke auto de opties en specificaties heeft die voor jou tellen.",
  },
  {
    question: "Is Kentekenvergelijker gratis?",
    answer:
      "Ja. Kentekenvergelijker is gratis te gebruiken. Je hebt geen account nodig om kentekens te vergelijken en een overzichtelijke vergelijkingstabel te bekijken.",
  },
  {
    question: "Kan ik alleen Nederlandse kentekens vergelijken?",
    answer:
      "Ja. Kentekenvergelijker is gebouwd voor de Nederlandse markt en werkt met Nederlandse kentekens. Voer de kentekens in zoals ze op de kentekenplaat staan.",
  },
  {
    question: "Waarom hebben twee auto's van hetzelfde model verschillende opties?",
    answer:
      "Fabrikanten bieden verschillende uitvoeringen, pakketten en losse opties aan. Twee auto's met dezelfde merk- en modelnaam kunnen daardoor sterk verschillen in uitrusting, vermogen en veiligheidssystemen. Kenteken vergelijken maakt die verschillen inzichtelijk.",
  },
  {
    question: "Hoe betrouwbaar is de getoonde uitrusting?",
    answer:
      "De getoonde specificaties zijn een schatting en kunnen afwijken van de werkelijke uitrusting. Gebruik de vergelijking als indicatie, niet als garantie. Neem altijd contact op met de verkoper of plan een proefrit om alles te verifiëren voordat je koopt.",
  },
];

function HowItWorks() {
  return (
    <section
      aria-labelledby="how-it-works-heading"
      className="border-t border-kv-border bg-kv-bg-alt"
    >
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="mb-10 max-w-2xl">
          <h2
            id="how-it-works-heading"
            className="text-3xl font-semibold tracking-tight text-kv-navy"
          >
            Hoe werkt het?
          </h2>
        </div>

        <ol className="grid list-none gap-6 md:grid-cols-3">
          {howItWorksSteps.map((item) => (
            <li key={item.step} className="kv-card p-6">
              <span className="mb-4 flex h-8 w-8 items-center justify-center rounded-full bg-kv-teal text-sm font-bold text-white">
                {item.step}
              </span>
              <h3 className="text-lg font-semibold text-kv-navy">{item.title}</h3>
              <p className="mt-3 text-sm leading-7 text-kv-muted">{item.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function SeoContent() {
  return (
    <section
      aria-labelledby="seo-content-heading"
      className="border-t border-kv-border bg-kv-surface"
    >
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="max-w-3xl space-y-8">
          <div className="space-y-4">
            <h2
              id="seo-content-heading"
              className="text-3xl font-semibold tracking-tight text-kv-navy"
            >
              Auto&apos;s vergelijken via kenteken
            </h2>
            <p className="text-base leading-8 text-kv-muted">
              Zoek je een occasion en twijfel je tussen meerdere auto&apos;s? Met
              Kentekenvergelijker leg je 2 tot 8 Nederlandse kentekens naast elkaar en
              zie je direct welke voertuigen beter uitgerust zijn. Je vergelijkt de
              exacte auto&apos;s achter de kentekenplaten, niet alleen merk en model.
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-semibold tracking-tight text-kv-navy">
              Waarom kentekens vergelijken bij een occasion?
            </h3>
            <p className="text-base leading-8 text-kv-muted">
              Twee auto&apos;s van hetzelfde type kunnen sterk verschillen in
              uitrusting. De ene heeft stoelverwarming en adaptieve cruise control, de
              andere niet. Door kentekens naast elkaar te leggen, zie je die
              verschillen in één overzicht. Dat helpt als je twee occasions van hetzelfde
              model vergelijkt, een leaseauto afzet tegen een koopauto, of import en
              Nederlandse uitvoering wilt afwegen.
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-semibold tracking-tight text-kv-navy">
              Welke uitrusting en opties vergelijk je?
            </h3>
            <p className="text-base leading-8 text-kv-muted">
              Per voertuig zie je onder andere uitvoering, motor, veiligheidspakketten,
              rijassistentie en comfortopties in één tabel. Zo ontdek je snel welke auto
              de specificaties heeft die voor jou tellen, van parkeersensoren tot
              verwarmbare voorstoelen.
            </p>
          </div>

          <p className="text-base leading-8 text-kv-muted">
            Kentekenvergelijker is gratis, werkt zonder account en is gebouwd om
            auto&apos;s op uitrusting en specificaties te vergelijken.{" "}
            <a href="#vergelijken" className="font-medium text-kv-teal hover:underline">
              Voer je kentekens in
            </a>{" "}
            en start direct met vergelijken.
          </p>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <>
      <JsonLd data={buildHomeStructuredData(faqItems)} />

      <SiteHeader />

      <main>
        <section
          id="vergelijken"
          aria-labelledby="hero-heading"
          className="kv-scroll-anchor relative overflow-hidden bg-kv-bg"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_0%,rgb(8_168_160_/_16%),transparent_42%)] dark:bg-[radial-gradient(circle_at_80%_0%,rgb(40_184_200_/_12%),transparent_42%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_100%,rgb(24_56_120_/_10%),transparent_50%)] dark:bg-[radial-gradient(circle_at_0%_100%,rgb(24_56_120_/_18%),transparent_50%)]" />

          <div className="relative mx-auto grid max-w-6xl gap-12 px-6 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:py-24">
            <div className="space-y-6">
              <p className="kv-badge">Vergelijk auto&apos;s op kenteken</p>

              <h1
                id="hero-heading"
                className="max-w-xl text-4xl font-bold tracking-tight text-kv-navy sm:text-5xl sm:leading-tight"
              >
                Vergelijk auto&apos;s op kenteken, tot in de uitrusting
              </h1>

              <p className="max-w-xl text-lg leading-8 text-kv-muted">
                Voer een paar Nederlandse kentekens in en krijg een overzichtelijke
                vergelijking van model, uitvoering en specificaties van de exacte
                auto&apos;s achter die kentekens.
              </p>

              <ul className="grid gap-3 text-sm text-kv-navy sm:grid-cols-2">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 font-bold text-kv-green">✓</span>
                  <span>2 tot 8 kentekens tegelijk vergelijken</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 font-bold text-kv-green">✓</span>
                  <span>Opties zoals stoelverwarming & rijassistentie</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 font-bold text-kv-green">✓</span>
                  <span>Gratis, geen account nodig</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 font-bold text-kv-green">✓</span>
                  <span>Duidelijke vergelijkingstabel per voertuig</span>
                </li>
              </ul>
            </div>

            <div>
              <KentekenForm />
            </div>
          </div>
        </section>

        <HomeDemoComparison />

        <HowItWorks />

        <SeoContent />

        <section
          id="faq"
          aria-labelledby="faq-heading"
          className="kv-scroll-anchor border-t border-kv-border bg-kv-bg"
        >
          <div className="mx-auto max-w-6xl px-6 py-16">
            <div className="mb-10 max-w-2xl">
              <h2
                id="faq-heading"
                className="text-3xl font-semibold tracking-tight text-kv-navy"
              >
                Veelgestelde vragen over kenteken vergelijken
              </h2>
            </div>

            <div className="grid gap-4">
              {faqItems.map((item) => (
                <details
                  key={item.question}
                  className="group kv-card p-6 open:border-kv-teal/30"
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

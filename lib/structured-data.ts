import { absoluteUrl, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

type FaqItem = {
  question: string;
  answer: string;
};

export function buildHomeStructuredData(faqItems: FaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: SITE_NAME,
        url: SITE_URL,
        logo: absoluteUrl("/logo.png"),
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: SITE_NAME,
        description: SITE_DESCRIPTION,
        inLanguage: "nl-NL",
        publisher: { "@id": `${SITE_URL}/#organization` },
      },
      {
        "@type": "WebApplication",
        "@id": `${SITE_URL}/#webapp`,
        name: SITE_NAME,
        url: SITE_URL,
        description: SITE_DESCRIPTION,
        applicationCategory: "AutomotiveApplication",
        operatingSystem: "Web",
        inLanguage: "nl-NL",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "EUR",
        },
        featureList: [
          "Vergelijk 2 tot 4 Nederlandse kentekens tegelijk",
          "Vergelijk uitrusting en opties per voertuig",
          "Vergelijk merk, model en uitvoering side-by-side",
          "Gratis te gebruiken zonder account",
        ],
        isPartOf: { "@id": `${SITE_URL}/#website` },
      },
      {
        "@type": "FAQPage",
        "@id": `${SITE_URL}/#faq`,
        mainEntity: faqItems.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.answer,
          },
        })),
      },
    ],
  };
}

export function buildComparisonStructuredData(kentekens: string[], path: string) {
  const title = `Vergelijk ${kentekens.join(", ")}`;
  const description = `Vergelijk de auto's achter ${kentekens.join(", ")}. Zie model, uitrusting en opties naast elkaar.`;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": absoluteUrl(path),
        url: absoluteUrl(path),
        name: title,
        description,
        inLanguage: "nl-NL",
        isPartOf: { "@id": `${SITE_URL}/#website` },
        about: kentekens.map((kenteken) => ({
          "@type": "Vehicle",
          identifier: kenteken,
          identifierProperty: "licensePlate",
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: SITE_NAME,
            item: SITE_URL,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: title,
            item: absoluteUrl(path),
          },
        ],
      },
    ],
  };
}

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ComparisonPreview } from "@/components/comparison-preview";
import { JsonLd } from "@/components/json-ld";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { buildComparisonPath, parseComparisonSlugs } from "@/lib/kenteken";
import { buildComparisonStructuredData } from "@/lib/structured-data";
import { absoluteUrl } from "@/lib/site";
import { buildComparison } from "@/lib/vehicles/compare";

type ComparisonPageProps = {
  params: Promise<{ kentekens: string[] }>;
};

export async function generateMetadata({
  params,
}: ComparisonPageProps): Promise<Metadata> {
  const { kentekens: slugs } = await params;
  const parsed = parseComparisonSlugs(slugs);

  if (!parsed) {
    return {
      title: "Vergelijking niet gevonden",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const kentekenList = parsed.kentekens.join(", ");
  const title = `Kenteken vergelijken: ${kentekenList}`;
  const description = `Vergelijk de auto's achter ${kentekenList}. Bekijk model, uitvoering, opties en uitrusting naast elkaar in één tabel.`;
  const canonicalPath = buildComparisonPath(parsed.kentekens);

  return {
    title,
    description,
    alternates: {
      canonical: absoluteUrl(canonicalPath),
    },
    openGraph: {
      title,
      description,
      url: absoluteUrl(canonicalPath),
    },
    twitter: {
      title,
      description,
    },
  };
}

export default async function ComparisonPage({ params }: ComparisonPageProps) {
  const { kentekens: slugs } = await params;
  const parsed = parseComparisonSlugs(slugs);

  if (!parsed) {
    notFound();
  }

  const canonicalPath = buildComparisonPath(parsed.kentekens);
  const currentPath = `/${slugs.join("/")}`;

  if (currentPath !== canonicalPath) {
    redirect(canonicalPath);
  }

  const comparison = await buildComparison(parsed.kentekens);

  return (
    <>
      <JsonLd
        data={buildComparisonStructuredData(parsed.kentekens, canonicalPath)}
      />

      <SiteHeader />

      <main className="mx-auto max-w-6xl px-6 py-10 sm:py-14">
        <header className="mb-8 max-w-3xl space-y-3">
          <h1 className="text-3xl font-bold tracking-tight text-kv-navy sm:text-4xl">
            Kenteken vergelijken: {parsed.kentekens.join(", ")}
          </h1>
          <p className="text-lg leading-8 text-kv-muted">
            Vergelijk de auto&apos;s achter de kentekens. Zie model, uitvoering,
            opties en uitrusting naast elkaar in één overzichtelijke tabel.
          </p>
        </header>

        <ComparisonPreview
          kentekens={parsed.kentekens}
          groups={comparison.groups}
          hasNotFound={comparison.hasNotFound}
          hasErrors={comparison.hasErrors}
        />
      </main>

      <SiteFooter />
    </>
  );
}

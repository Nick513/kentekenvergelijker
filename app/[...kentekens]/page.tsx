import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ComparisonPreview } from "@/components/comparison-preview";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { buildComparisonPath, parseComparisonSlugs } from "@/lib/kenteken";

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
    };
  }

  const title = `Vergelijk ${parsed.kentekens.join(", ")}`;
  const description = `Vergelijk de auto's achter ${parsed.kentekens.join(", ")}. Zie model, uitrusting en opties naast elkaar.`;

  return {
    title,
    description,
    openGraph: {
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

  return (
    <>
      <SiteHeader />

      <main className="mx-auto max-w-6xl px-6 py-10 sm:py-14">
        <ComparisonPreview kentekens={parsed.kentekens} />
      </main>

      <SiteFooter />
    </>
  );
}

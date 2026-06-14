import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function ComparisonNotFound() {
  return (
    <>
      <SiteHeader />

      <main className="mx-auto flex min-h-[60vh] max-w-6xl flex-col items-center justify-center px-6 py-16 text-center">
        <h1 className="text-3xl font-semibold text-kv-navy">Vergelijking niet gevonden</h1>
        <p className="mt-4 max-w-md text-kv-muted">
          Deze vergelijking bestaat niet of bevat ongeldige kentekens. Voer 2 tot 4 geldige
          Nederlandse kentekens in om te vergelijken.
        </p>
        <Link
          href="/#vergelijken"
          className="kv-btn-primary mt-8 rounded-xl px-6 py-3 text-sm shadow-md shadow-kv-navy/20"
        >
          Naar homepage
        </Link>
      </main>

      <SiteFooter />
    </>
  );
}

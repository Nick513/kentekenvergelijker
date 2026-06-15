import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-kv-navy-bg bg-kv-navy-bg text-white/80">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p>&copy; {new Date().getFullYear()} Kentekenvergelijker</p>

        <nav aria-label="Footer navigatie" className="flex flex-wrap gap-x-6 gap-y-2">
          <Link href="/#vergelijken" className="text-white/80 transition hover:text-white">
            Kentekens vergelijken
          </Link>
          <Link href="/#voorbeeld" className="text-white/80 transition hover:text-white">
            Voorbeeld
          </Link>
          <Link href="/#faq" className="text-white/80 transition hover:text-white">
            Veelgestelde vragen
          </Link>
        </nav>
      </div>
    </footer>
  );
}

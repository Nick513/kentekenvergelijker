import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="border-b border-kv-border bg-kv-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center px-6 py-4">
        <Link href="/" className="flex items-center gap-3 transition-opacity hover:opacity-90">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-kv-navy text-sm font-bold text-kv-yellow shadow-sm">
            KV
          </div>
          <div>
            <p className="font-semibold text-kv-navy">Kentekenvergelijker</p>
            <p className="text-xs text-kv-muted">kentekenvergelijker.nl</p>
          </div>
        </Link>
      </div>
    </header>
  );
}

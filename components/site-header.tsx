import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="border-b border-kv-border bg-kv-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center px-6 py-4">
        <Link href="/" className="flex items-center gap-3 transition-opacity hover:opacity-90">
          {/* Native img avoids Next/Image optimizer flattening transparent PNGs */}
          <img
            src="/logo.png"
            alt="Kentekenvergelijker"
            width={48}
            height={48}
            className="h-12 w-12 shrink-0 object-contain"
            decoding="async"
          />
          <div>
            <p className="font-semibold text-kv-navy">Kentekenvergelijker</p>
            <p className="text-xs text-kv-muted">kentekenvergelijker.nl</p>
          </div>
        </Link>
      </div>
    </header>
  );
}

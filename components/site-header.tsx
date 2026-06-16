import Link from "next/link";
import { SiteHeaderHeight } from "@/components/site-header-height";
import { ThemeToggle } from "@/components/theme-toggle";
import { SITE_TAGLINE } from "@/lib/site";

const navItems = [
  { href: "/#vergelijken", label: "Vergelijken" },
  { href: "/#voorbeeld", label: "Voorbeeld" },
  { href: "/#faq", label: "FAQ" },
];

export function SiteHeader() {
  return (
    <>
      <SiteHeaderHeight />
      <header className="sticky top-0 z-50 border-b border-kv-border bg-kv-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
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
              <p className="text-xs text-kv-muted">{SITE_TAGLINE}</p>
            </div>
          </Link>

          <div className="flex items-center gap-1">
            <ThemeToggle />

            <nav aria-label="Hoofdnavigatie" className="hidden items-center gap-1 sm:flex">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="kv-btn-ghost text-kv-navy"
                >
                  {item.label}
                </Link>
              ))}
              <Link
                href="/#vergelijken"
                className="kv-btn-primary ml-2 rounded-lg px-4 py-2 text-sm shadow-md shadow-kv-teal/20"
              >
                Start vergelijking
              </Link>
            </nav>
          </div>
        </div>
      </header>
    </>
  );
}

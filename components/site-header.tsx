import Link from "next/link";
import { MobileNav } from "@/components/mobile-nav";
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
      <header className="sticky top-0 z-50 border-b border-kv-border bg-kv-surface/95 backdrop-blur supports-[padding:max(0px)]:pt-[env(safe-area-inset-top)]">
        <div className="kv-container relative flex items-center justify-between gap-4 py-3 sm:gap-6 sm:py-4">
          <Link href="/" className="flex min-w-0 items-center gap-2.5 transition-opacity hover:opacity-90 sm:gap-3">
            {/* Native img avoids Next/Image optimizer flattening transparent PNGs */}
            <img
              src="/logo.png"
              alt="Kentekenvergelijker"
              width={48}
              height={48}
              className="h-10 w-10 shrink-0 object-contain sm:h-12 sm:w-12"
              decoding="async"
            />
            <div className="min-w-0">
              <p className="truncate font-semibold text-kv-navy">Kentekenvergelijker</p>
              <p className="hidden text-xs text-kv-muted sm:block">{SITE_TAGLINE}</p>
            </div>
          </Link>

          <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
            <ThemeToggle />
            <MobileNav items={navItems} />

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

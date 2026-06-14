export function SiteFooter() {
  return (
    <footer className="border-t border-kv-navy bg-kv-navy text-white/80">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-8 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p>&copy; {new Date().getFullYear()} Kentekenvergelijker</p>
        <p className="text-white/60">
          Vergelijk Nederlandse auto&apos;s op kenteken: model, uitrusting & opties.
        </p>
      </div>
    </footer>
  );
}

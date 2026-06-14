export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <p>&copy; {new Date().getFullYear()} Kentekenvergelijker</p>
        <p>Vergelijk Nederlandse auto&apos;s op kenteken: model, uitrusting & opties.</p>
      </div>
    </footer>
  );
}

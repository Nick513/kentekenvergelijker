export function SiteFooter() {
  return (
    <footer className="border-t border-kv-navy-bg bg-kv-navy-bg text-white/80">
      <div className="mx-auto max-w-6xl px-6 py-8 text-sm">
        <p>&copy; {new Date().getFullYear()} Kentekenvergelijker</p>
      </div>
    </footer>
  );
}

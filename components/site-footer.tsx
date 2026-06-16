export function SiteFooter() {
  return (
    <footer className="border-t border-kv-navy-bg bg-kv-navy-bg text-white/80">
      <div className="kv-container py-6 text-sm supports-[padding:max(0px)]:pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:py-8">
        <p>&copy; {new Date().getFullYear()} Kentekenvergelijker</p>
      </div>
    </footer>
  );
}

import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="border-b border-slate-200/70 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center px-6 py-4">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-700 text-sm font-bold text-white">
            KV
          </div>
          <div>
            <p className="font-semibold text-slate-900">Kentekenvergelijker</p>
            <p className="text-xs text-slate-500">kentekenvergelijker.nl</p>
          </div>
        </Link>
      </div>
    </header>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { useEscapeKey } from "@/hooks/use-escape-key";

type NavItem = {
  href: string;
  label: string;
};

type MobileNavProps = {
  items: NavItem[];
};

function MenuIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  );
}

export function MobileNav({ items }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const panelId = useId();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEscapeKey(() => setOpen(false), open);

  function closeMenu() {
    setOpen(false);
  }

  return (
    <div className="sm:hidden">
      <button
        type="button"
        className="kv-btn-ghost -mr-1 rounded-lg p-2 text-kv-navy"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? "Menu sluiten" : "Menu openen"}
        onClick={() => setOpen((current) => !current)}
      >
        {open ? <CloseIcon /> : <MenuIcon />}
      </button>

      {open ? (
        <>
          {mounted
            ? createPortal(
                <button
                  type="button"
                  className="fixed inset-0 z-40 bg-kv-navy-bg/40 backdrop-blur-[1px] dark:bg-black/60"
                  aria-label="Menu sluiten"
                  onClick={closeMenu}
                />,
                document.body,
              )
            : null}
          <nav
            id={panelId}
            aria-label="Mobiele navigatie"
            className="absolute top-full right-0 left-0 z-50 border-b border-kv-border bg-kv-surface px-4 py-4 shadow-lg"
          >
            <ul className="space-y-1">
              {items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="kv-btn-ghost block w-full rounded-lg px-3 py-3 text-left text-base text-kv-navy"
                    onClick={closeMenu}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              href="/#vergelijken"
              className="kv-btn-primary mt-3 block w-full rounded-xl px-4 py-3 text-center text-sm shadow-md shadow-kv-teal/20"
              onClick={closeMenu}
            >
              Start vergelijking
            </Link>
          </nav>
        </>
      ) : null}
    </div>
  );
}

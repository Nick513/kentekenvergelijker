"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type FetchingModalProps = {
  open: boolean;
  onDismiss: () => void;
};

export function FetchingModal({ open, onDismiss }: FetchingModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-kv-navy-bg/50 backdrop-blur-[2px] dark:bg-black/75"
        aria-label="Sluiten"
        onClick={onDismiss}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="fetching-modal-title"
        className="relative z-10 w-full max-w-md rounded-2xl border border-kv-border bg-kv-surface p-8 shadow-xl"
      >
        <div className="flex flex-col items-center gap-5 text-center">
          <div
            aria-hidden="true"
            className="size-10 animate-spin rounded-full border-4 border-kv-teal/20 border-t-kv-teal"
          />
          <div className="space-y-2">
            <h2
              id="fetching-modal-title"
              className="text-lg font-semibold text-kv-navy"
            >
              Gegevens worden opgehaald
            </h2>
            <p className="text-sm leading-6 text-kv-muted">
              We zoeken de specificaties op voor jouw kentekens. Dit duurt
              meestal maar een paar seconden.
            </p>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="text-sm text-kv-muted underline decoration-kv-teal/60 underline-offset-2 hover:text-kv-teal"
          >
            Sluiten en alvast kijken
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

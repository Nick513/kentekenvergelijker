"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type SpecVerificationModalProps = {
  open: boolean;
  onClose: () => void;
};

export function SpecVerificationModal({
  open,
  onClose,
}: SpecVerificationModalProps) {
  const [mounted, setMounted] = useState(false);

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

  if (!open || !mounted) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-kv-navy-bg/50 backdrop-blur-[2px] dark:bg-black/75"
        aria-label="Sluiten"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="spec-verification-title"
        className="relative z-10 w-full max-w-md rounded-2xl border border-kv-border bg-kv-surface p-6 shadow-xl"
      >
        <h2
          id="spec-verification-title"
          className="text-lg font-semibold text-kv-navy"
        >
          Ongeverifieerd
        </h2>
        <p className="mt-3 text-sm leading-7 text-kv-muted">
          Sommige specificaties kunnen we niet met 100% zekerheid bevestigen voor
          deze exacte auto. We hebben geen directe bevestiging gevonden dat dit
          voertuig deze uitrusting wel of niet heeft.
        </p>
        <p className="mt-3 text-sm leading-7 text-kv-muted">
          Gebruik deze gegevens als indicatie bij het vergelijken. Controleer
          belangrijke opties bij de verkoper of in de advertentie voordat je een
          beslissing neemt.
        </p>
        <div className="mt-8 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="kv-btn-primary rounded-xl px-6 py-2.5 text-sm shadow-md shadow-kv-teal/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kv-teal"
          >
            Begrepen
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { SpecVerification } from "@/lib/enrichment/types";

type SpecVerificationModalProps = {
  open: boolean;
  onClose: () => void;
  sourceUrl?: string | null;
  verification?: SpecVerification | null;
};

export function SpecVerificationModal({
  open,
  onClose,
  sourceUrl,
  verification,
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
          Mogelijk onjuist
        </h2>
        {verification === "listing_claim_single" ? (
          <>
            <p className="mt-3 text-sm leading-7 text-kv-muted">
              Deze waarde is gevonden in één advertentie en is niet bevestigd
              door een tweede onafhankelijke bron. Het is mogelijk dat de waarde
              afwijkt van de werkelijke uitrusting van dit voertuig.
            </p>
            <p className="mt-3 text-sm leading-7 text-kv-muted">
              Controleer dit altijd bij de verkoper of in de advertentie voordat
              je een beslissing neemt.
            </p>
          </>
        ) : (
          <>
            <p className="mt-3 text-sm leading-7 text-kv-muted">
              Deze waarde is afgeleid van de typespecificaties van dit model en
              uitvoering - niet bevestigd voor dit specifieke voertuig. De
              werkelijke uitrusting kan afwijken afhankelijk van de gekozen
              opties.
            </p>
            <p className="mt-3 text-sm leading-7 text-kv-muted">
              Gebruik deze gegevens als indicatie. Controleer belangrijke opties
              bij de verkoper of in de advertentie voordat je een beslissing
              neemt.
            </p>
          </>
        )}
        {sourceUrl ? (
          <p className="mt-3 text-sm leading-7 text-kv-muted">
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-kv-teal/60 underline-offset-2 hover:text-kv-teal"
              onClick={onClose}
            >
              Bekijk de typespecificaties
            </a>
          </p>
        ) : null}
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

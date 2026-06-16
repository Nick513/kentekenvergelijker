"use client";

type SpecVerificationModalProps = {
  open: boolean;
  onClose: () => void;
};

export function SpecVerificationModal({
  open,
  onClose,
}: SpecVerificationModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-kv-navy/40"
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
        <button
          type="button"
          onClick={onClose}
          className="kv-btn-primary mt-6 w-full"
        >
          Begrepen
        </button>
      </div>
    </div>
  );
}

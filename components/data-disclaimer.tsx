type DataDisclaimerProps = {
  className?: string;
};

function InfoIcon() {
  return (
    <svg
      aria-hidden="true"
      className="mt-0.5 size-5 shrink-0 text-kv-teal"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z"
      />
    </svg>
  );
}

export function DataDisclaimer({ className = "" }: DataDisclaimerProps) {
  const copy =
    "De informatie op Kentekenvergelijker is een schatting op basis van beschikbare gegevens en is niet gegarandeerd 100% juist. Dit zijn indicaties, geen feiten. Neem altijd contact op met de verkoper of plan een proefrit om de uitrusting en specificaties te verifiëren.";

  return (
    <aside
      className={`kv-alert-info rounded-lg px-4 py-3 text-sm leading-relaxed ${className}`.trim()}
      role="note"
    >
      <div className="flex items-start gap-3">
        <InfoIcon />
        <p>
          <strong className="font-semibold text-kv-navy">Let op:</strong> {copy}
        </p>
      </div>
    </aside>
  );
}

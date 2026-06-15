type DataDisclaimerProps = {
  className?: string;
};

export function DataDisclaimer({ className = "" }: DataDisclaimerProps) {
  const copy =
    "De informatie op Kentekenvergelijker is een schatting op basis van beschikbare gegevens en is niet gegarandeerd 100% juist. Dit zijn indicaties, geen feiten. Neem altijd contact op met de verkoper of plan een proefrit om de uitrusting en specificaties te verifiëren.";

  return (
    <aside
      className={`kv-alert-info rounded-lg px-4 py-3 text-sm leading-relaxed ${className}`.trim()}
      role="note"
    >
      <strong className="font-semibold text-kv-navy">Let op:</strong> {copy}
    </aside>
  );
}

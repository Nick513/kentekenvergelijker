type DataDisclaimerProps = {
  variant?: "default" | "footer";
  className?: string;
};

export function DataDisclaimer({
  variant = "default",
  className = "",
}: DataDisclaimerProps) {
  const copy =
    "De informatie op Kentekenvergelijker is een schatting op basis van beschikbare gegevens en is niet gegarandeerd 100% juist. Dit zijn indicaties, geen feiten. Neem altijd contact op met de verkoper of plan een proefrit om de uitrusting en specificaties te verifiëren.";

  if (variant === "footer") {
    return (
      <p
        className={`text-xs leading-relaxed text-white/70 ${className}`.trim()}
        role="note"
      >
        {copy}
      </p>
    );
  }

  return (
    <aside
      className={`kv-alert-info rounded-lg px-4 py-3 text-sm leading-relaxed ${className}`.trim()}
      role="note"
    >
      <strong className="font-semibold text-kv-navy">Let op:</strong> {copy}
    </aside>
  );
}

"use client";

import { useState } from "react";
import { ComparisonPreview } from "@/components/comparison-preview";
import { KentekenForm } from "@/components/kenteken-form";

export function HeroWithForm() {
  const [kentekens, setKentekens] = useState<string[] | null>(null);

  function handleCompare(nextKentekens: string[]) {
    setKentekens(nextKentekens);
    requestAnimationFrame(() => {
      document.getElementById("vergelijking")?.scrollIntoView({ behavior: "smooth" });
    });
  }

  return (
    <>
      <KentekenForm onCompare={handleCompare} />
      {kentekens && (
        <div className="mt-10">
          <ComparisonPreview kentekens={kentekens} />
        </div>
      )}
    </>
  );
}

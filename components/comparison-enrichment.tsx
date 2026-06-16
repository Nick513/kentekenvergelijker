"use client";

import { useCallback, useEffect, useState } from "react";
import type { ComparisonGroup } from "@/components/comparison-table";
import { ComparisonPreview } from "@/components/comparison-preview";

type ComparisonEnrichmentProps = {
  kentekens: string[];
  initialGroups: ComparisonGroup[];
  hasNotFound?: boolean;
  hasErrors?: boolean;
};

type EnrichResponse = {
  groups: ComparisonGroup[];
  status: string;
};

export function ComparisonEnrichment({
  kentekens,
  initialGroups,
  hasNotFound = false,
  hasErrors = false,
}: ComparisonEnrichmentProps) {
  const [groups, setGroups] = useState(initialGroups);
  const [isEnriching, setIsEnriching] = useState(true);
  const [enrichError, setEnrichError] = useState(false);

  const runEnrichment = useCallback(async (refresh = false) => {
    setIsEnriching(true);
    setEnrichError(false);

    try {
      const response = await fetch("/api/comparison/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kentekens, refresh }),
      });

      if (!response.ok) {
        setEnrichError(true);
        return;
      }

      const payload = (await response.json()) as EnrichResponse;
      if (payload.groups) {
        setGroups(payload.groups);
      }
    } catch {
      setEnrichError(true);
    } finally {
      setIsEnriching(false);
    }
  }, [kentekens]);

  useEffect(() => {
    void runEnrichment();
  }, [runEnrichment]);

  return (
    <ComparisonPreview
      kentekens={kentekens}
      groups={groups}
      hasNotFound={hasNotFound}
      hasErrors={hasErrors}
      isEnriching={isEnriching}
      enrichError={enrichError}
      onRetryEnrichment={() => void runEnrichment(true)}
    />
  );
}

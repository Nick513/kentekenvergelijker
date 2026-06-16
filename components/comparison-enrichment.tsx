"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ComparisonGroup } from "@/components/comparison-table";
import { ComparisonPreview } from "@/components/comparison-preview";
import { FetchingModal } from "@/components/fetching-modal";

type ComparisonEnrichmentProps = {
  kentekens: string[];
  initialGroups: ComparisonGroup[];
  initiallyEnriched: boolean;
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
  initiallyEnriched,
  hasNotFound = false,
  hasErrors = false,
}: ComparisonEnrichmentProps) {
  const [groups, setGroups] = useState(initialGroups);
  const [showModal, setShowModal] = useState(!initiallyEnriched);
  const [isEnriching, setIsEnriching] = useState(!initiallyEnriched);
  const [enrichError, setEnrichError] = useState(false);
  const hasRun = useRef(false);

  const runEnrichment = useCallback(
    async (updateState: boolean, refresh: boolean) => {
      try {
        const response = await fetch("/api/comparison/enrich", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kentekens, refresh }),
        });

        if (!response.ok) {
          if (updateState) setEnrichError(true);
          return;
        }

        const payload = (await response.json()) as EnrichResponse;
        if (updateState && payload.groups) {
          setGroups(payload.groups);
        }
      } catch {
        if (updateState) setEnrichError(true);
      } finally {
        if (updateState) {
          setIsEnriching(false);
          setShowModal(false);
        }
      }
    },
    [kentekens],
  );

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    if (initiallyEnriched) {
      // Cache hit: show table immediately, refresh in background for next visit
      void runEnrichment(false, true);
    } else {
      // Cache miss: block with modal until enrichment completes
      void runEnrichment(true, false);
    }
  }, [initiallyEnriched, runEnrichment]);

  return (
    <>
      <FetchingModal
        open={showModal}
        onDismiss={() => setShowModal(false)}
      />
      <ComparisonPreview
        kentekens={kentekens}
        groups={groups}
        hasNotFound={hasNotFound}
        hasErrors={hasErrors}
        isEnriching={isEnriching && !showModal}
        enrichError={enrichError}
        onRetryEnrichment={() => {
          setIsEnriching(true);
          setEnrichError(false);
          void runEnrichment(true, true);
        }}
      />
    </>
  );
}

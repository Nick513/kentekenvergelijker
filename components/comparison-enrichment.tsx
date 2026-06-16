"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ComparisonGroup } from "@/components/comparison-table";
import { ComparisonPreview } from "@/components/comparison-preview";
import { FetchingModal } from "@/components/fetching-modal";

type ComparisonEnrichmentProps = {
  kentekens: string[];
  initialGroups: ComparisonGroup[];
  initiallyEnriched: boolean;
  hasErrors?: boolean;
};

type SsePayload = { groups: ComparisonGroup[]; done: boolean };

export function ComparisonEnrichment({
  kentekens,
  initialGroups,
  initiallyEnriched,
  hasErrors = false,
}: ComparisonEnrichmentProps) {
  const [groups, setGroups] = useState(initialGroups);
  const [showModal, setShowModal] = useState(!initiallyEnriched);
  const [isEnriching, setIsEnriching] = useState(!initiallyEnriched);
  const [enrichError, setEnrichError] = useState(false);
  const hasRun = useRef(false);

  const runStream = useCallback(
    async (skipCache: boolean) => {
      setEnrichError(false);
      try {
        const response = await fetch("/api/comparison/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kentekens, skipCache }),
        });

        if (!response.ok || !response.body) {
          setEnrichError(true);
          setShowModal(false);
          setIsEnriching(false);
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // SSE events are separated by double newlines
          const events = buffer.split("\n\n");
          buffer = events.pop() ?? "";

          for (const event of events) {
            if (!event.startsWith("data: ")) continue;
            let payload: SsePayload;
            try {
              payload = JSON.parse(event.slice(6)) as SsePayload;
            } catch {
              continue;
            }

            // First event: remove modal and show table (even if no extra specs yet)
            setShowModal(false);
            if (payload.groups.length > 0) {
              setGroups(payload.groups);
            }
            if (payload.done) {
              setIsEnriching(false);
              return;
            }
          }
        }
      } catch {
        setEnrichError(true);
      } finally {
        setShowModal(false);
        setIsEnriching(false);
      }
    },
    [kentekens],
  );

  const runBackgroundRefresh = useCallback(() => {
    // Fire-and-forget: keeps the existing JSON endpoint for background refresh.
    // Results are saved to DB and served on the next page load.
    void fetch("/api/comparison/enrich", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kentekens, refresh: true }),
    });
  }, [kentekens]);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    if (initiallyEnriched) {
      runBackgroundRefresh();
    } else {
      void runStream(false);
    }
  }, [initiallyEnriched, runStream, runBackgroundRefresh]);

  return (
    <>
      <FetchingModal
        open={showModal}
        onDismiss={() => setShowModal(false)}
      />
      <ComparisonPreview
        kentekens={kentekens}
        groups={groups}
        hasErrors={hasErrors}
        isEnriching={isEnriching && !showModal}
        enrichError={enrichError}
        onRetryEnrichment={() => {
          setIsEnriching(true);
          setEnrichError(false);
          void runStream(true);
        }}
      />
    </>
  );
}

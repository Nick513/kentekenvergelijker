"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ComparisonGroup } from "@/components/comparison-table";
import { ComparisonPreview } from "@/components/comparison-preview";
import { FetchingModal } from "@/components/fetching-modal";
import { useToast } from "@/components/toast";

const ENRICH_ERROR_MESSAGE =
  "Extra specificaties zijn niet geladen.";
const DATA_ERROR_MESSAGE =
  "Sommige gegevens zijn tijdelijk niet beschikbaar. Probeer het later opnieuw.";

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
  const hasRun = useRef(false);
  const dataErrorShown = useRef(false);
  const retryEnrichmentRef = useRef<() => void>(() => {});
  const { showToast } = useToast();

  const runStream = useCallback(
    async (skipCache: boolean) => {
      try {
        const response = await fetch("/api/comparison/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kentekens, skipCache }),
        });

        if (!response.ok || !response.body) {
          showToast(ENRICH_ERROR_MESSAGE, {
            action: {
              label: "Opnieuw proberen",
              onClick: () => retryEnrichmentRef.current(),
            },
          });
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
        showToast(ENRICH_ERROR_MESSAGE, {
          action: {
            label: "Opnieuw proberen",
            onClick: () => retryEnrichmentRef.current(),
          },
        });
      } finally {
        setShowModal(false);
        setIsEnriching(false);
      }
    },
    [kentekens, showToast],
  );

  const retryEnrichment = useCallback(() => {
    setIsEnriching(true);
    void runStream(true);
  }, [runStream]);

  retryEnrichmentRef.current = retryEnrichment;

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

  useEffect(() => {
    if (!hasErrors || dataErrorShown.current) return;
    dataErrorShown.current = true;
    showToast(DATA_ERROR_MESSAGE);
  }, [hasErrors, showToast]);

  return (
    <>
      <FetchingModal
        open={showModal}
        onDismiss={() => setShowModal(false)}
      />
      <ComparisonPreview
        kentekens={kentekens}
        groups={groups}
        isEnriching={isEnriching && !showModal}
      />
    </>
  );
}

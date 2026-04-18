"use client";

// Middle column: suggestion refresh controls, batches of structured cards, and status messaging.

import { useEffect, useState, type ReactElement, type ReactNode } from "react";
import useSuggestions from "@/hooks/useSuggestions";
import type { Suggestion } from "@/types/suggestions";
import SuggestionCard from "@/components/SuggestionCard";

interface InfoCardProps {
  children: ReactNode;
}

function InfoCard({ children }: InfoCardProps): ReactElement {
  return (
    <div className="rounded-lg border border-neutral-800/90 bg-neutral-900/40 p-4 text-sm leading-relaxed text-neutral-500">
      {children}
    </div>
  );
}

interface LiveSuggestionsProps {
  transcriptChunks: string[];
  isRecording: boolean;
  onSuggestionSelect: (suggestion: Suggestion) => void;
}

export function LiveSuggestions({
  transcriptChunks,
  isRecording,
  onSuggestionSelect,
}: LiveSuggestionsProps): ReactElement {
  const { batches, isLoading, triggerRefresh, error } = useSuggestions({
    transcriptChunks,
    isRecording,
  });

  const [countdownSeconds, setCountdownSeconds] = useState(30);

  useEffect(() => {
    setCountdownSeconds(30);
  }, [batches.length]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCountdownSeconds((previous) =>
        previous <= 0 ? 0 : previous - 1,
      );
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col border-r border-neutral-800">
      <header className="flex shrink-0 items-center justify-between border-b border-neutral-800 px-5 py-4">
        <h2 className="text-xs font-medium uppercase tracking-widest text-neutral-500">
          2. LIVE SUGGESTIONS
        </h2>
        <span className="rounded-full border border-neutral-700 bg-neutral-900/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
          {batches.length} BATCHES
        </span>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-neutral-400">
          <button
            type="button"
            onClick={() => {
              triggerRefresh();
            }}
            disabled={isLoading}
            className={`rounded-md border border-neutral-700 bg-neutral-900/60 px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-neutral-300 transition-colors hover:border-neutral-500 hover:bg-neutral-800/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 ${
              isLoading
                ? "cursor-not-allowed opacity-40"
                : ""
            }`}
          >
            ↺ Reload suggestions
          </button>
          <span className="text-xs text-neutral-500">
            auto-refresh in {countdownSeconds}s
          </span>
        </div>

        {error ? (
          <p className="text-xs text-red-500">{error}</p>
        ) : null}

        <InfoCard>
          Suggestions are short, contextual nudges—talking points, clarifying
          questions, or risks—generated from the latest transcript window. Each
          refresh may surface up to three cards grouped as one batch.
        </InfoCard>

        {isLoading ? (
          <p className="animate-pulse text-center text-sm text-neutral-500">
            Generating suggestions...
          </p>
        ) : null}

        {!isLoading && batches.length === 0 ? (
          <p className="text-center text-sm text-neutral-600">
            Suggestions appear here once recording starts.
          </p>
        ) : null}

        {!isLoading && batches.length > 0 ? (
          <div className="flex flex-col gap-6">
            {batches.map((batch, batchIndex) => (
              <div key={batch.id} className="flex flex-col gap-3">
                {batch.suggestions.map((suggestion, suggestionIndex) => (
                  <SuggestionCard
                    key={`${batch.id}-${suggestionIndex}`}
                    suggestion={suggestion}
                    onSelect={onSuggestionSelect}
                    isLatestBatch={batchIndex === 0}
                  />
                ))}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

"use client";

// Fetches /api/summarize then /api/suggestions using windowed transcript text while recording (plus manual refresh).

import { useCallback, useEffect, useRef, useState } from "react";
import { loadTwinmindSettings } from "@/hooks/useSettings";
import { isErrorResponseBody } from "@/lib/api-response";
import { GROQ_API_KEY_HEADER } from "@/lib/prompts";
import type { Suggestion, SuggestionBatch } from "@/types/suggestions";

const GROQ_STORAGE_KEY = "groq_api_key";
const REFRESH_INTERVAL_MS = 30000;

interface UseSuggestionsArgs {
  transcriptChunks: string[];
  isRecording: boolean;
}

interface SummarizeSuccessResponse {
  summary: string;
}

interface SuggestionsSuccessResponse {
  suggestions: Suggestion[];
}

function isSummarizeSuccess(
  value: unknown,
): value is SummarizeSuccessResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "summary" in value &&
    typeof (value as SummarizeSuccessResponse).summary === "string"
  );
}

function isSuggestionsSuccess(
  value: unknown,
): value is SuggestionsSuccessResponse {
  if (
    typeof value !== "object" ||
    value === null ||
    !("suggestions" in value) ||
    !Array.isArray((value as SuggestionsSuccessResponse).suggestions)
  ) {
    return false;
  }
  return (value as SuggestionsSuccessResponse).suggestions.length === 3;
}

function buildContextStrings(
  chunks: readonly string[],
  recentContextChars: number,
  earlierContextChars: number,
): {
  recentText: string;
  earlierText: string;
} {
  const fullText = chunks.join("\n");
  if (fullText.length === 0) {
    return { recentText: "", earlierText: "" };
  }
  const recentText = fullText.slice(-recentContextChars);
  const earlierPart = fullText.slice(
    0,
    Math.max(0, fullText.length - recentText.length),
  );
  const earlierText =
    earlierPart.length <= earlierContextChars
      ? earlierPart
      : earlierPart.slice(-earlierContextChars);
  return { recentText, earlierText };
}

function previousPreviewsLine(batches: SuggestionBatch[]): string {
  if (batches.length === 0) {
    return "";
  }
  const latest = batches[0];
  return latest.suggestions.map((suggestion) => suggestion.preview).join("\n");
}

export default function useSuggestions({
  transcriptChunks,
  isRecording,
}: UseSuggestionsArgs): {
  batches: SuggestionBatch[];
  isLoading: boolean;
  triggerRefresh: () => void;
  error: string | null;
} {
  const [batches, setBatches] = useState<SuggestionBatch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const batchesRef = useRef<SuggestionBatch[]>(batches);
  const transcriptRef = useRef<string[]>(transcriptChunks);
  const isLoadingRef = useRef<boolean>(false);

  useEffect(() => {
    batchesRef.current = batches;
  }, [batches]);

  useEffect(() => {
    transcriptRef.current = transcriptChunks;
  }, [transcriptChunks]);

  const runCycle = useCallback(async (): Promise<void> => {
    if (typeof window === "undefined") {
      return;
    }

    const chunks = transcriptRef.current;
    if (chunks.length === 0) {
      return;
    }

    if (isLoadingRef.current) {
      return;
    }

    const settings = loadTwinmindSettings();
    const apiKey = settings.groqApiKey.trim() || localStorage.getItem(GROQ_STORAGE_KEY)?.trim();
    if (!apiKey) {
      setError("No Groq API key set — open Settings to add one");
      return;
    }

    isLoadingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      const { recentText, earlierText } = buildContextStrings(
        chunks,
        settings.recentContextChars,
        settings.earlierContextChars,
      );

      let earlierSummary = "";
      if (earlierText.length > 0) {
        const summarizeResponse = await fetch("/api/summarize", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            [GROQ_API_KEY_HEADER]: apiKey,
          },
          body: JSON.stringify({
            earlierTranscript: earlierText,
            summarizationPrompt: settings.summarizationPrompt,
          }),
        });
        const summarizePayload: unknown = await summarizeResponse.json();
        if (!summarizeResponse.ok) {
          const message = isErrorResponseBody(summarizePayload)
            ? summarizePayload.error
            : "Summarization failed";
          setError(message);
          return;
        }
        if (!isSummarizeSuccess(summarizePayload)) {
          setError("Invalid summarization response");
          return;
        }
        earlierSummary = summarizePayload.summary;
      }

      const previousSuggestions = previousPreviewsLine(batchesRef.current);

      const suggestionsResponse = await fetch("/api/suggestions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [GROQ_API_KEY_HEADER]: apiKey,
        },
        body: JSON.stringify({
          recentTranscript: recentText,
          earlierSummary,
          previousSuggestions,
          suggestionsPrompt: settings.suggestionsPrompt,
        }),
      });

      const suggestionsPayload: unknown = await suggestionsResponse.json();
      if (!suggestionsResponse.ok) {
        const message = isErrorResponseBody(suggestionsPayload)
          ? suggestionsPayload.error
          : "Suggestions failed";
        setError(message);
        return;
      }
      if (!isSuggestionsSuccess(suggestionsPayload)) {
        setError("Invalid suggestions response");
        return;
      }

      const batch: SuggestionBatch = {
        id: crypto.randomUUID(),
        timestamp: new Date(),
        suggestions: suggestionsPayload.suggestions,
      };
      setBatches((previous) => [batch, ...previous]);
    } catch {
      setError("Network error while fetching suggestions.");
    } finally {
      isLoadingRef.current = false;
      setIsLoading(false);
    }
  }, []);

  const triggerRefresh = useCallback((): void => {
    void runCycle();
  }, [runCycle]);

  const immediateCycleFiredRef = useRef(false);

  useEffect(() => {
    if (!isRecording) {
      immediateCycleFiredRef.current = false;
      return;
    }
    if (transcriptChunks.length === 0) {
      return;
    }
    if (immediateCycleFiredRef.current) {
      return;
    }
    immediateCycleFiredRef.current = true;
    void runCycle();
  }, [isRecording, transcriptChunks.length, runCycle]);

  useEffect(() => {
    if (!isRecording) {
      return;
    }
    const intervalId = window.setInterval(() => {
      if (transcriptRef.current.length === 0) {
        return;
      }
      void runCycle();
    }, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [isRecording, runCycle]);

  return {
    batches,
    isLoading,
    triggerRefresh,
    error,
  };
}

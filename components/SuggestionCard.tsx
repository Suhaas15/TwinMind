// One tappable suggestion tile with type chip, preview, and muted styling for older batches.

import type { ReactElement } from "react";
import type { Suggestion } from "@/types/suggestions";

interface SuggestionCardProps {
  suggestion: Suggestion;
  onSelect: (suggestion: Suggestion) => void;
  isLatestBatch: boolean;
}

function typeBadgeClasses(type: Suggestion["type"]): string {
  switch (type) {
    case "question":
      return "bg-blue-900 text-blue-300";
    case "talking_point":
      return "bg-purple-900 text-purple-300";
    case "answer":
      return "bg-green-900 text-green-300";
    case "fact_check":
      return "bg-yellow-900 text-yellow-300";
    case "clarify":
      return "bg-orange-900 text-orange-300";
    default: {
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }
}

export default function SuggestionCard({
  suggestion,
  onSelect,
  isLatestBatch,
}: SuggestionCardProps): ReactElement {
  const dimmed = !isLatestBatch ? "opacity-50" : "";

  return (
    <button
      type="button"
      onClick={() => {
        onSelect(suggestion);
      }}
      className={`w-full cursor-pointer rounded-lg border border-neutral-700 bg-neutral-900/50 p-4 text-left transition-colors hover:bg-neutral-800 ${dimmed}`}
    >
      <span
        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium uppercase ${typeBadgeClasses(suggestion.type)}`}
      >
        {suggestion.type.replaceAll("_", " ")}
      </span>
      <p className="mt-2 text-sm text-white">{suggestion.preview}</p>
    </button>
  );
}

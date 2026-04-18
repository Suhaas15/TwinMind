// Shared types for structured meeting suggestions and batches.

export type SuggestionType =
  | "question"
  | "talking_point"
  | "answer"
  | "fact_check"
  | "clarify";

export interface Suggestion {
  type: SuggestionType;
  preview: string;
  detail: string;
}

export interface SuggestionBatch {
  id: string;
  timestamp: Date;
  suggestions: Suggestion[];
}

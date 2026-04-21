// Generates exactly three structured meeting suggestions from transcript context via Groq.
// Flow: validate x-groq-api-key → validate JSON body → call Groq chat → return { suggestions } or { error }.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  GROQ_API_KEY_HEADER,
  MODELS,
  SUGGESTIONS_MAX_TOKENS,
  SUGGESTIONS_PROMPT,
  SUGGESTIONS_TEMPERATURE,
} from "@/lib/prompts";
import type { Suggestion, SuggestionType } from "@/types/suggestions";

const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";

const SUGGESTIONS_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    suggestions: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          type: {
            type: "string",
            enum: [
              "question",
              "talking_point",
              "answer",
              "fact_check",
              "clarify",
            ],
          },
          preview: { type: "string" },
          detail: { type: "string" },
        },
        required: ["type", "preview", "detail"],
      },
    },
  },
  required: ["suggestions"],
} as const;

const SUGGESTION_TYPES: readonly SuggestionType[] = [
  "question",
  "talking_point",
  "answer",
  "fact_check",
  "clarify",
];

function isSuggestionType(value: string): value is SuggestionType {
  return (SUGGESTION_TYPES as readonly string[]).includes(value);
}

function groqChatFailureMessage(parsed: unknown): string {
  if (typeof parsed !== "object" || parsed === null || !("error" in parsed)) {
    return "Suggestions request failed";
  }
  const container = parsed as { error?: { message?: unknown } };
  const message = container.error?.message;
  return typeof message === "string" ? message : "Suggestions request failed";
}

function extractAssistantText(parsed: unknown): string | null {
  if (typeof parsed !== "object" || parsed === null) {
    return null;
  }
  const root = parsed as {
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  const content = root.choices?.[0]?.message?.content;
  return typeof content === "string" ? content : null;
}

function parseSuggestionsPayload(raw: string): Suggestion[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("suggestions" in parsed) ||
    !Array.isArray((parsed as { suggestions: unknown }).suggestions)
  ) {
    return null;
  }
  const items = (parsed as { suggestions: unknown[] }).suggestions;
  if (items.length !== 3) {
    return null;
  }
  const result: Suggestion[] = [];
  for (const item of items) {
    if (typeof item !== "object" || item === null) {
      return null;
    }
    const o = item as Record<string, unknown>;
    const type = o.type;
    const preview = o.preview;
    const detail = o.detail;
    if (
      typeof type !== "string" ||
      !isSuggestionType(type) ||
      typeof preview !== "string" ||
      typeof detail !== "string"
    ) {
      return null;
    }
    result.push({ type, preview, detail });
  }
  return result;
}

export async function POST(
  request: NextRequest,
): Promise<
  NextResponse<{ suggestions: Suggestion[] } | { error: string }>
> {
  const apiKey = request.headers.get(GROQ_API_KEY_HEADER);
  if (!apiKey?.trim()) {
    return NextResponse.json(
      { error: "No API key provided" },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = (await request.json()) as unknown;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  const record = body as Record<string, unknown>;
  const recentTranscript =
    typeof record.recentTranscript === "string" ? record.recentTranscript : "";
  const earlierSummary =
    typeof record.earlierSummary === "string" ? record.earlierSummary : "";
  const previousSuggestions =
    typeof record.previousSuggestions === "string"
      ? record.previousSuggestions
      : "";
  const suggestionsPrompt =
    typeof record.suggestionsPrompt === "string"
      ? record.suggestionsPrompt
      : undefined;

  const activePrompt =
    typeof suggestionsPrompt === "string" &&
    suggestionsPrompt.trim().length > 0
      ? suggestionsPrompt
      : SUGGESTIONS_PROMPT;

  const userMessage = `RECENT TRANSCRIPT:
${recentTranscript}

EARLIER CONTEXT SUMMARY:
${earlierSummary || "None"}

PREVIOUS SUGGESTIONS:
${previousSuggestions || "None"}`;

  const groqResponse = await fetch(GROQ_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODELS.suggestions,
      messages: [
        { role: "system", content: activePrompt },
        { role: "user", content: userMessage },
      ],
      temperature: SUGGESTIONS_TEMPERATURE,
      max_tokens: SUGGESTIONS_MAX_TOKENS,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "meeting_suggestions",
          strict: true,
          schema: SUGGESTIONS_JSON_SCHEMA,
        },
      },
    }),
  });

  const rawText = await groqResponse.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText) as unknown;
  } catch {
    return NextResponse.json(
      { error: "Invalid response from suggestions service" },
      { status: 502 },
    );
  }

  if (!groqResponse.ok) {
    const message = groqChatFailureMessage(parsed);
    return NextResponse.json({ error: message }, { status: groqResponse.status });
  }

  const assistantText = extractAssistantText(parsed);
  if (assistantText === null) {
    return NextResponse.json(
      { error: "Invalid suggestions response" },
      { status: 502 },
    );
  }

  const suggestions = parseSuggestionsPayload(assistantText);
  if (suggestions === null) {
    return NextResponse.json(
      { error: "Could not parse suggestions" },
      { status: 502 },
    );
  }

  return NextResponse.json({ suggestions });
}

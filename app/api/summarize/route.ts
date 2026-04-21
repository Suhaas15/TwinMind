// Summarizes earlier transcript text via Groq for the live suggestions context window.
// Flow: validate x-groq-api-key → validate JSON body → call Groq chat → return { summary } or { error }.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  GROQ_API_KEY_HEADER,
  MODELS,
  SUMMARIZATION_MAX_TOKENS,
  SUMMARIZATION_PROMPT,
  SUMMARIZATION_TEMPERATURE,
} from "@/lib/prompts";

const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";

interface SummarizeBody {
  earlierTranscript?: unknown;
}

function groqChatFailureMessage(parsed: unknown): string {
  if (typeof parsed !== "object" || parsed === null || !("error" in parsed)) {
    return "Summarization failed";
  }
  const container = parsed as { error?: { message?: unknown } };
  const message = container.error?.message;
  return typeof message === "string" ? message : "Summarization failed";
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

export async function POST(
  request: NextRequest,
): Promise<NextResponse<{ summary: string } | { error: string }>> {
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

  const earlierTranscript =
    typeof body === "object" &&
    body !== null &&
    "earlierTranscript" in body &&
    typeof (body as SummarizeBody).earlierTranscript === "string"
      ? (body as { earlierTranscript: string }).earlierTranscript
      : "";

  const record =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)
      : {};
  const summarizationPrompt =
    typeof record.summarizationPrompt === "string"
      ? record.summarizationPrompt
      : undefined;
  const activePrompt =
    typeof summarizationPrompt === "string" &&
    summarizationPrompt.trim().length > 0
      ? summarizationPrompt
      : SUMMARIZATION_PROMPT;

  if (earlierTranscript === "") {
    return NextResponse.json({ summary: "" });
  }

  const groqResponse = await fetch(GROQ_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODELS.summarization,
      messages: [
        { role: "system", content: activePrompt },
        { role: "user", content: earlierTranscript },
      ],
      max_tokens: SUMMARIZATION_MAX_TOKENS,
      temperature: SUMMARIZATION_TEMPERATURE,
    }),
  });

  const rawText = await groqResponse.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText) as unknown;
  } catch {
    return NextResponse.json(
      { error: "Invalid response from summarization service" },
      { status: 502 },
    );
  }

  if (!groqResponse.ok) {
    const message = groqChatFailureMessage(parsed);
    return NextResponse.json({ error: message }, { status: groqResponse.status });
  }

  const text = extractAssistantText(parsed);
  if (text === null) {
    return NextResponse.json(
      { error: "Invalid summarization response" },
      { status: 502 },
    );
  }

  return NextResponse.json({ summary: text.trim() });
}

// Summarizes earlier transcript text via Groq for the live suggestions context window.
// Flow: validate x-groq-api-key → validate JSON body → call Groq chat → return { summary } or { error }.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  extractGroqChatAssistantContent,
  GROQ_CHAT_COMPLETIONS_URL,
  groqApiErrorMessage,
} from "@/lib/groq-route-helpers";
import {
  GROQ_API_KEY_HEADER,
  MODELS,
  SUMMARIZATION_MAX_TOKENS,
  SUMMARIZATION_PROMPT,
  SUMMARIZATION_TEMPERATURE,
} from "@/lib/prompts";

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

  if (
    typeof body !== "object" ||
    body === null ||
    Array.isArray(body)
  ) {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  const record = body as Record<string, unknown>;

  const earlierTranscript =
    typeof record.earlierTranscript === "string"
      ? record.earlierTranscript
      : "";

  const summarizationPrompt =
    typeof record.summarizationPrompt === "string"
      ? record.summarizationPrompt
      : undefined;
  const activePrompt =
    summarizationPrompt !== undefined && summarizationPrompt.trim().length > 0
      ? summarizationPrompt
      : SUMMARIZATION_PROMPT;

  if (earlierTranscript === "") {
    return NextResponse.json({ summary: "" });
  }

  let groqResponse: Response;
  try {
    groqResponse = await fetch(GROQ_CHAT_COMPLETIONS_URL, {
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
  } catch {
    return NextResponse.json(
      { error: "Could not reach summarization service" },
      { status: 502 },
    );
  }

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
    const message = groqApiErrorMessage(parsed, "Summarization failed");
    return NextResponse.json({ error: message }, { status: groqResponse.status });
  }

  const text = extractGroqChatAssistantContent(parsed);
  if (text === null) {
    return NextResponse.json(
      { error: "Invalid summarization response" },
      { status: 502 },
    );
  }

  return NextResponse.json({ summary: text.trim() });
}

// Streams Groq chat completions (SSE) for the meeting copilot using transcript context and capped history.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  GROQ_CHAT_COMPLETIONS_URL,
  groqApiErrorMessage,
} from "@/lib/groq-route-helpers";
import {
  CHAT_CONTEXT_CHARS,
  CHAT_HISTORY_MAX_MESSAGES,
  CHAT_MAX_TOKENS,
  CHAT_PROMPT,
  GROQ_API_KEY_HEADER,
  MODELS,
} from "@/lib/prompts";

interface ChatHistoryEntry {
  role: "user" | "assistant";
  content: string;
}

function parseChatHistory(raw: unknown): ChatHistoryEntry[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const entries: ChatHistoryEntry[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) {
      continue;
    }
    const record = item as Record<string, unknown>;
    const role = record.role;
    const content = record.content;
    if (role !== "user" && role !== "assistant") {
      continue;
    }
    if (typeof content !== "string") {
      continue;
    }
    entries.push({ role, content });
  }
  return entries.slice(-CHAT_HISTORY_MAX_MESSAGES);
}

export async function POST(
  request: NextRequest,
): Promise<Response | NextResponse<{ error: string }>> {
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
  const message = typeof record.message === "string" ? record.message : "";
  if (message === "") {
    return NextResponse.json(
      { error: "Message is required" },
      { status: 400 },
    );
  }

  const transcriptContextRaw =
    typeof record.transcriptContext === "string" ? record.transcriptContext : "";

  const contextCap =
    typeof record.chatContextChars === "number" &&
    Number.isFinite(record.chatContextChars) &&
    record.chatContextChars > 0
      ? Math.floor(record.chatContextChars)
      : CHAT_CONTEXT_CHARS;

  const transcriptContext =
    transcriptContextRaw.length > contextCap
      ? transcriptContextRaw.slice(-contextCap)
      : transcriptContextRaw;

  const chatPromptText =
    typeof record.chatPrompt === "string" && record.chatPrompt.trim() !== ""
      ? record.chatPrompt
      : CHAT_PROMPT;

  const chatHistory = parseChatHistory(record.chatHistory);

  const groqMessages: Array<{ role: string; content: string }> = [
    { role: "system", content: chatPromptText },
    { role: "system", content: `MEETING TRANSCRIPT:\n${transcriptContext}` },
    ...chatHistory.map((entry) => ({
      role: entry.role,
      content: entry.content,
    })),
    { role: "user", content: message },
  ];

  let groqResponse: Response;
  try {
    groqResponse = await fetch(GROQ_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODELS.chat,
        messages: groqMessages,
        stream: true,
        max_tokens: CHAT_MAX_TOKENS,
      }),
    });
  } catch {
    return NextResponse.json(
      { error: "Could not reach chat service" },
      { status: 502 },
    );
  }

  if (!groqResponse.ok) {
    const rawText = await groqResponse.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText) as unknown;
    } catch {
      return NextResponse.json(
        { error: "Chat request failed" },
        { status: groqResponse.status },
      );
    }
    const errText = groqApiErrorMessage(parsed, "Chat request failed");
    return NextResponse.json({ error: errText }, { status: groqResponse.status });
  }

  if (!groqResponse.body) {
    return NextResponse.json(
      { error: "Empty response from chat service" },
      { status: 502 },
    );
  }

  return new Response(groqResponse.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

// Proxies multipart audio to Groq Whisper and returns JSON text for chunked client uploads.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const GROQ_TRANSCRIBE_URL =
  "https://api.groq.com/openai/v1/audio/transcriptions";
/** Audio smaller than this is treated as noise and skipped without calling Groq. */
const MIN_AUDIO_BYTES_FOR_GROQ = 1000;

function groqFailureMessage(parsed: unknown): string {
  if (typeof parsed !== "object" || parsed === null || !("error" in parsed)) {
    return "Transcription failed";
  }
  const container = parsed as { error?: { message?: unknown } };
  const message = container.error?.message;
  return typeof message === "string" ? message : "Transcription failed";
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse<{ text: string } | { error: string }>> {
  const apiKey = request.headers.get("x-groq-api-key");
  if (!apiKey?.trim()) {
    return NextResponse.json(
      { error: "No API key provided" },
      { status: 401 },
    );
  }

  let incoming: FormData;
  try {
    incoming = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Invalid multipart body" },
      { status: 400 },
    );
  }

  const audio = incoming.get("audio");
  if (!(audio instanceof Blob)) {
    return NextResponse.json(
      { error: "No audio file provided" },
      { status: 400 },
    );
  }

  if (audio.size < MIN_AUDIO_BYTES_FOR_GROQ) {
    return NextResponse.json({ text: "" });
  }

  const outbound = new FormData();
  outbound.append("file", audio, "chunk.webm");
  outbound.append("model", "whisper-large-v3");
  outbound.append("response_format", "json");

  const groqResponse = await fetch(GROQ_TRANSCRIBE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey.trim()}`,
    },
    body: outbound,
  });

  const rawText = await groqResponse.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText) as unknown;
  } catch {
    return NextResponse.json(
      { error: "Invalid response from transcription service" },
      { status: 502 },
    );
  }

  if (!groqResponse.ok) {
    const message = groqFailureMessage(parsed);
    return NextResponse.json({ error: message }, { status: groqResponse.status });
  }

  if (
    typeof parsed === "object" &&
    parsed !== null &&
    "text" in parsed &&
    typeof (parsed as { text: unknown }).text === "string"
  ) {
    return NextResponse.json({ text: (parsed as { text: string }).text });
  }

  return NextResponse.json(
    { error: "Invalid transcription response" },
    { status: 502 },
  );
}

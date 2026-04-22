// Shared Groq OpenAI-compatible REST helpers for Next.js route handlers (non-streaming JSON responses).

export const GROQ_CHAT_COMPLETIONS_URL =
  "https://api.groq.com/openai/v1/chat/completions";

/** Parses Groq `{ error: { message } }` bodies (OpenAI-compatible). */
export function groqApiErrorMessage(parsed: unknown, fallback: string): string {
  if (typeof parsed !== "object" || parsed === null || !("error" in parsed)) {
    return fallback;
  }
  // Groq uses the same error envelope as OpenAI-compatible APIs.
  const container = parsed as { error?: { message?: unknown } };
  const message = container.error?.message;
  return typeof message === "string" ? message : fallback;
}

/** Non-streaming chat/completions: first assistant message string, or null if missing. */
export function extractGroqChatAssistantContent(
  parsed: unknown,
): string | null {
  if (typeof parsed !== "object" || parsed === null) {
    return null;
  }
  const root = parsed as {
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  const content = root.choices?.[0]?.message?.content;
  return typeof content === "string" ? content : null;
}

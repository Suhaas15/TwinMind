// Exports current TwinMind session state as a downloadable JSON file.
import type { ChatMessage } from "@/types/chat";
import type { SuggestionBatch } from "@/types/suggestions";

export function exportSession({
  transcriptChunks,
  suggestionBatches,
  chatMessages,
}: {
  transcriptChunks: string[];
  suggestionBatches: SuggestionBatch[];
  chatMessages: ChatMessage[];
}): void {
  const exportData = {
    exportedAt: new Date().toISOString(),
    transcript: transcriptChunks.map((text, index) => ({
      chunk: index + 1,
      text,
    })),
    suggestionBatches: suggestionBatches.map((batch) => ({
      id: batch.id,
      timestamp: batch.timestamp.toISOString(),
      suggestions: batch.suggestions.map((s) => ({
        type: s.type,
        preview: s.preview,
        detail: s.detail,
      })),
    })),
    chat: chatMessages
      .filter((m) => !m.isDetail)
      .map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: new Date().toISOString(),
      })),
  };

  const serialized = JSON.stringify(exportData, null, 2);
  const blob = new Blob([serialized], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const date = new Date().toISOString().split("T")[0];
  link.href = url;
  link.download = `twinmind-session-${date}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

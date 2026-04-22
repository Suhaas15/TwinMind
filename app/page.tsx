"use client";

// Client shell: owns mic + transcript state, suggestion handoff into chat, and three-column layout.

import { useCallback, useState, type ReactElement } from "react";
import ChatPanel from "@/components/ChatPanel";
import LiveSuggestions from "@/components/LiveSuggestions";
import MicTranscript from "@/components/MicTranscript";
import SettingsModal from "@/components/SettingsModal";
import useChat from "@/hooks/useChat";
import useMicRecorder from "@/hooks/useMicRecorder";
import useSuggestions from "@/hooks/useSuggestions";
import { exportSession } from "@/lib/export";
import type { Suggestion } from "@/types/suggestions";

export default function Home(): ReactElement {
  const {
    transcriptChunks,
    isRecording,
    startRecording,
    stopRecording,
    flushCurrentChunk,
    error: recordingError,
  } = useMicRecorder();

  const [pendingSuggestion, setPendingSuggestion] =
    useState<Suggestion | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { batches, isLoading, triggerRefresh, error } = useSuggestions({
    transcriptChunks,
    isRecording,
  });
  const {
    messages,
    isStreaming,
    sendMessage,
    addSuggestionToChat,
    error: chatError,
  } = useChat({ transcriptChunks });

  const handleRecordingChange = useCallback(
    (nextRecording: boolean): void => {
      if (nextRecording) {
        void startRecording();
      } else {
        stopRecording();
      }
    },
    [startRecording, stopRecording],
  );

  const handleSuggestionSelect = useCallback((suggestion: Suggestion): void => {
    setPendingSuggestion({ ...suggestion });
  }, []);

  const handleSuggestionHandled = useCallback((): void => {
    setPendingSuggestion(null);
  }, []);

  const handleManualRefresh = useCallback((): void => {
    flushCurrentChunk();
    setTimeout(() => {
      triggerRefresh();
    }, 500);
  }, [flushCurrentChunk, triggerRefresh]);

  const exportDisabled =
    transcriptChunks.length === 0 && batches.length === 0;

  return (
    <div className="flex h-dvh min-h-0 w-full flex-col bg-[#0a0a0a] text-neutral-200">
      <div className="flex h-12 w-full items-center justify-between border-b border-neutral-800 bg-neutral-950 px-4">
        <span className="min-w-0 flex-1 truncate pr-2 text-sm font-medium tracking-widest uppercase text-neutral-400">
          TwinMind Live Suggestions
        </span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              exportSession({
                transcriptChunks,
                suggestionBatches: batches,
                chatMessages: messages,
              });
            }}
            disabled={exportDisabled}
            aria-label="Export session as JSON"
            aria-disabled={exportDisabled}
            className={`rounded border border-neutral-700 px-3 py-1 text-xs uppercase tracking-widest text-neutral-400 transition-colors hover:border-neutral-500 hover:text-white ${
              exportDisabled ? "cursor-not-allowed opacity-40" : ""
            }`}
          >
            Export Session
          </button>
          <button
            type="button"
            onClick={() => {
              setIsSettingsOpen((open) => !open);
            }}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-800 text-neutral-400 transition-colors hover:bg-neutral-700 hover:text-white"
            aria-label="Open settings"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="h-5 w-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.281Z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
              />
            </svg>
          </button>
        </div>
      </div>
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => {
          setIsSettingsOpen(false);
        }}
      />
      <div className="flex min-h-0 w-full flex-1 flex-col lg:flex-row">
        <MicTranscript
          transcriptChunks={transcriptChunks}
          isRecording={isRecording}
          onRecordingChange={handleRecordingChange}
          recordingError={recordingError}
        />
        <LiveSuggestions
          batches={batches}
          isLoading={isLoading}
          onManualRefresh={handleManualRefresh}
          error={error}
          onSuggestionSelect={handleSuggestionSelect}
        />
        <ChatPanel
          messages={messages}
          isStreaming={isStreaming}
          sendMessage={sendMessage}
          addSuggestionToChat={addSuggestionToChat}
          error={chatError}
          pendingSuggestion={pendingSuggestion}
          onSuggestionHandled={handleSuggestionHandled}
        />
      </div>
    </div>
  );
}

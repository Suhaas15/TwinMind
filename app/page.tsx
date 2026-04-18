"use client";

// Composes the three-column meeting copilot shell on the home route.

import { useCallback, type ReactElement } from "react";
import useMicRecorder from "@/hooks/useMicRecorder";
import { ChatPanel } from "@/components/ChatPanel";
import { LiveSuggestions } from "@/components/LiveSuggestions";
import { MicTranscript } from "@/components/MicTranscript";
import type { Suggestion } from "@/types/suggestions";

export default function Home(): ReactElement {
  const {
    transcriptChunks,
    isRecording,
    startRecording,
    stopRecording,
    error: recordingError,
  } = useMicRecorder();

  const handleTranscriptUpdate = useCallback((chunks: string[]): void => {
    void chunks;
  }, []);

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
    console.log(suggestion);
  }, []);

  return (
    <div className="flex h-dvh min-h-0 w-full flex-row bg-[#0a0a0a] text-neutral-200">
      <MicTranscript
        transcriptChunks={transcriptChunks}
        isRecording={isRecording}
        onTranscriptUpdate={handleTranscriptUpdate}
        onRecordingChange={handleRecordingChange}
        recordingError={recordingError}
      />
      <LiveSuggestions
        transcriptChunks={transcriptChunks}
        isRecording={isRecording}
        onSuggestionSelect={handleSuggestionSelect}
      />
      <ChatPanel />
    </div>
  );
}

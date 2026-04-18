"use client";

// Left column: mic recording controls, errors, guidance, and scrolling transcript chunks.

import { useEffect, useRef, type ReactElement, type ReactNode } from "react";

interface MicButtonProps {
  isRecording: boolean;
  onToggle: () => void;
}

function MicButton({ isRecording, onToggle }: MicButtonProps): ReactElement {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={isRecording}
      aria-label={isRecording ? "Stop recording" : "Start recording"}
      className={`flex size-28 items-center justify-center rounded-full border-2 shadow-lg transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-400 ${
        isRecording
          ? "animate-pulse border-red-400/60 bg-red-600 text-white"
          : "border-blue-500/40 bg-blue-600 text-white hover:bg-blue-500"
      }`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="size-11"
        aria-hidden
      >
        <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
      </svg>
    </button>
  );
}

interface InfoCardProps {
  children: ReactNode;
}

function InfoCard({ children }: InfoCardProps): ReactElement {
  return (
    <div className="rounded-lg border border-neutral-800/90 bg-neutral-900/40 p-4 text-sm leading-relaxed text-neutral-500">
      {children}
    </div>
  );
}

interface MicTranscriptProps {
  transcriptChunks: string[];
  isRecording: boolean;
  onTranscriptUpdate: (chunks: string[]) => void;
  onRecordingChange: (nextRecording: boolean) => void;
  recordingError: string | null;
}

export function MicTranscript({
  transcriptChunks,
  isRecording,
  onTranscriptUpdate,
  onRecordingChange,
  recordingError,
}: MicTranscriptProps): ReactElement {
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    onTranscriptUpdate(transcriptChunks);
  }, [transcriptChunks, onTranscriptUpdate]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcriptChunks.length]);

  function handleMicToggle(): void {
    onRecordingChange(!isRecording);
  }

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col border-r border-neutral-800">
      <header className="flex shrink-0 items-center justify-between border-b border-neutral-800 px-5 py-4">
        <h2 className="text-xs font-medium uppercase tracking-widest text-neutral-500">
          1. MIC & TRANSCRIPT
        </h2>
        <span
          className={`rounded-full border border-neutral-700 bg-neutral-900/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${
            isRecording ? "text-red-500" : "text-neutral-400"
          }`}
        >
          {isRecording ? "RECORDING" : "IDLE"}
        </span>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-5 py-6">
        <div className="flex flex-col items-center gap-3">
          <MicButton isRecording={isRecording} onToggle={handleMicToggle} />
          {recordingError ? (
            <p className="max-w-xs text-center text-xs text-red-500">
              {recordingError}
            </p>
          ) : null}
          <p className="max-w-xs text-center text-sm text-neutral-400">
            Click mic to start. Transcript appends every ~30s.
          </p>
        </div>

        <InfoCard>
          Transcript chunks roll in on a timer so you can skim the room without
          chasing every word. Later, each block will land here in order—think
          lightweight notes, not a verbatim court record.
        </InfoCard>

        <div className="flex flex-1 flex-col gap-0">
          {transcriptChunks.map((chunk, index) => (
            <p
              key={`transcript-chunk-${index}`}
              className={`py-3 text-sm leading-relaxed text-neutral-300 ${
                index > 0 ? "border-t border-neutral-800" : ""
              }`}
            >
              {chunk}
            </p>
          ))}
          {transcriptChunks.length === 0 ? (
            <p className="text-center text-sm text-neutral-600">
              No transcript yet — start the mic.
            </p>
          ) : null}
          <div ref={transcriptEndRef} aria-hidden />
        </div>
      </div>
    </section>
  );
}

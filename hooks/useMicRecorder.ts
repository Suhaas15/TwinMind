"use client";

// Captures mic audio via MediaRecorder (30s slices) and POSTs each blob to /api/transcribe, accumulating text chunks.

import { useCallback, useRef, useState } from "react";

const TIMESLICE_MS = 30000;
const GROQ_STORAGE_KEY = "groq_api_key";
/** Blobs at or below this size are skipped client-side (e.g. trailing MediaRecorder flush). */
const MIN_SENDABLE_CHUNK_BYTES = 10001;

interface TranscribeSuccessResponse {
  text: string;
}

interface TranscribeErrorResponse {
  error: string;
}

interface UseMicRecorderResult {
  isRecording: boolean;
  transcriptChunks: string[];
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  error: string | null;
}

function isTranscribeSuccess(
  value: unknown,
): value is TranscribeSuccessResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "text" in value &&
    typeof (value as TranscribeSuccessResponse).text === "string"
  );
}

function isTranscribeError(value: unknown): value is TranscribeErrorResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof (value as TranscribeErrorResponse).error === "string"
  );
}

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") {
    return undefined;
  }
  if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
    return "audio/webm;codecs=opus";
  }
  if (MediaRecorder.isTypeSupported("audio/webm")) {
    return "audio/webm";
  }
  return undefined;
}

export function useMicRecorder(): UseMicRecorderResult {
  const [isRecording, setIsRecording] = useState(false);
  const [transcriptChunks, setTranscriptChunks] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const cleanupStream = useCallback((): void => {
    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const stopRecording = useCallback((): void => {
    const recorder = mediaRecorderRef.current;
    setIsRecording(false);

    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    } else {
      cleanupStream();
      mediaRecorderRef.current = null;
    }
  }, [cleanupStream]);

  const startRecording = useCallback(async (): Promise<void> => {
    setError(null);

    if (typeof window === "undefined") {
      return;
    }

    const apiKey = localStorage.getItem(GROQ_STORAGE_KEY);
    if (!apiKey?.trim()) {
      setError("No Groq API key set — open Settings to add one");
      return;
    }

    if (typeof MediaRecorder === "undefined") {
      setError("MediaRecorder is not supported in this browser.");
      return;
    }

    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "NotAllowedError") {
        setError("Microphone permission denied.");
      } else {
        setError("Could not access the microphone.");
      }
      return;
    }

    streamRef.current = stream;

    const mimeType = pickMimeType();
    let recorder: MediaRecorder;
    try {
      recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
    } catch {
      cleanupStream();
      setError("Could not create MediaRecorder for this device.");
      return;
    }

    recorder.ondataavailable = (event: BlobEvent): void => {
      if (!event.data || event.data.size === 0) {
        return;
      }

      if (event.data.size < MIN_SENDABLE_CHUNK_BYTES) {
        return;
      }

      const key = localStorage.getItem(GROQ_STORAGE_KEY);
      if (!key?.trim()) {
        return;
      }

      const formData = new FormData();
      formData.append("audio", event.data, "chunk.webm");

      // Upload runs outside the MediaRecorder callback stack; errors surface via setError.
      void (async (): Promise<void> => {
        try {
          const response = await fetch("/api/transcribe", {
            method: "POST",
            body: formData,
            headers: {
              "x-groq-api-key": key,
            },
          });

          const payload: unknown = await response.json();

          if (!response.ok) {
            const message = isTranscribeError(payload)
              ? payload.error
              : "Transcription failed";
            setError(message);
            return;
          }

          if (isTranscribeSuccess(payload) && payload.text.trim() !== "") {
            setTranscriptChunks((previous) => [...previous, payload.text]);
          }
        } catch {
          setError("Network error while transcribing.");
        }
      })();
    };

    recorder.onerror = (): void => {
      setError("Recording error.");
    };

    recorder.onstop = (): void => {
      cleanupStream();
      mediaRecorderRef.current = null;
    };

    mediaRecorderRef.current = recorder;
    recorder.start(TIMESLICE_MS);
    setIsRecording(true);
  }, [cleanupStream]);

  return {
    isRecording,
    transcriptChunks,
    startRecording,
    stopRecording,
    error,
  };
}

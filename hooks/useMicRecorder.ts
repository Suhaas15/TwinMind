"use client";

// Captures mic audio via MediaRecorder: full WebM blobs every ~30s (stop/restart on one stream) and POSTs each to /api/transcribe.

import { useCallback, useRef, useState } from "react";

const CHUNK_INTERVAL_MS = 30000;
const GROQ_STORAGE_KEY = "groq_api_key";
/** Final segment blobs below this size skip transcription (e.g. empty flush). */
const MIN_TRANSCRIBE_BYTES = 1000;

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

export default function useMicRecorder(): UseMicRecorderResult {
  const [isRecording, setIsRecording] = useState(false);
  const [transcriptChunks, setTranscriptChunks] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isStoppingRef = useRef(false);
  const chunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef<string | undefined>(undefined);

  const cleanupStream = useCallback((): void => {
    if (chunkIntervalRef.current !== null) {
      clearInterval(chunkIntervalRef.current);
      chunkIntervalRef.current = null;
    }
    isStoppingRef.current = false;
    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const stopRecording = useCallback((): void => {
    if (chunkIntervalRef.current !== null) {
      clearInterval(chunkIntervalRef.current);
      chunkIntervalRef.current = null;
    }
    isStoppingRef.current = true;
    const recorder = mediaRecorderRef.current;
    setIsRecording(false);

    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    } else {
      isStoppingRef.current = false;
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
    mimeTypeRef.current = mimeType;
    chunksRef.current = [];
    isStoppingRef.current = false;

    const attachRecorder = (recorder: MediaRecorder): void => {
      recorder.ondataavailable = (event: BlobEvent): void => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onerror = (): void => {
        setError("Recording error.");
      };

      recorder.onstop = (): void => {
        void (async (): Promise<void> => {
          const parts = [...chunksRef.current];
          chunksRef.current = [];
          const mime = mimeTypeRef.current ?? "audio/webm";
          const blob = new Blob(parts, { type: mime });

          const key = localStorage.getItem(GROQ_STORAGE_KEY);
          if (blob.size >= MIN_TRANSCRIBE_BYTES && key?.trim()) {
            const formData = new FormData();
            formData.append("audio", blob, "chunk.webm");

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
              } else if (
                isTranscribeSuccess(payload) &&
                payload.text.trim() !== ""
              ) {
                setTranscriptChunks((previous) => [...previous, payload.text]);
              }
            } catch {
              setError("Network error while transcribing.");
            }
          }

          if (isStoppingRef.current) {
            cleanupStream();
            mediaRecorderRef.current = null;
            return;
          }

          const activeStream = streamRef.current;
          if (!activeStream) {
            mediaRecorderRef.current = null;
            return;
          }

          let nextRecorder: MediaRecorder;
          try {
            nextRecorder = mimeTypeRef.current
              ? new MediaRecorder(activeStream, {
                  mimeType: mimeTypeRef.current,
                })
              : new MediaRecorder(activeStream);
          } catch {
            setError("Could not create MediaRecorder for this device.");
            cleanupStream();
            mediaRecorderRef.current = null;
            return;
          }

          mediaRecorderRef.current = nextRecorder;
          attachRecorder(nextRecorder);
          nextRecorder.start();
        })();
      };
    };

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

    attachRecorder(recorder);
    mediaRecorderRef.current = recorder;
    recorder.start();

    chunkIntervalRef.current = setInterval(() => {
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    }, CHUNK_INTERVAL_MS);

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

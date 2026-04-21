"use client";

// Persists Groq key, prompt templates, and context window sizes in localStorage for the TwinMind session.

import { useCallback, useEffect, useState } from "react";
import {
  CHAT_CONTEXT_CHARS,
  CHAT_PROMPT,
  EARLIER_CONTEXT_CHARS,
  RECENT_CONTEXT_CHARS,
  SUGGESTIONS_PROMPT,
  SUMMARIZATION_PROMPT,
} from "@/lib/prompts";
import type { Settings } from "@/types/settings";

const STORAGE_KEY = "twinmind_settings";
const LEGACY_GROQ_KEY = "groq_api_key";

function clampPositiveInt(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  const n = Math.floor(value);
  if (n < 1) {
    return fallback;
  }
  return n;
}

export function getDefaultSettings(): Settings {
  return {
    groqApiKey: "",
    suggestionsPrompt: SUGGESTIONS_PROMPT,
    chatPrompt: CHAT_PROMPT,
    summarizationPrompt: SUMMARIZATION_PROMPT,
    recentContextChars: RECENT_CONTEXT_CHARS,
    earlierContextChars: EARLIER_CONTEXT_CHARS,
    chatContextChars: CHAT_CONTEXT_CHARS,
  };
}

/** Reads and merges saved settings; migrates legacy `groq_api_key` when no JSON blob exists. */
export function loadTwinmindSettings(): Settings {
  if (typeof window === "undefined") {
    return getDefaultSettings();
  }

  const legacyKey = localStorage.getItem(LEGACY_GROQ_KEY) ?? "";
  const raw = localStorage.getItem(STORAGE_KEY);
  const defaults = getDefaultSettings();

  if (raw === null) {
    return { ...defaults, groqApiKey: legacyKey };
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) {
      return { ...defaults, groqApiKey: legacyKey };
    }
    const o = parsed as Record<string, unknown>;
    const fromSaved =
      typeof o.groqApiKey === "string" ? o.groqApiKey : "";
    const groqApiKey = fromSaved !== "" ? fromSaved : legacyKey;

    return {
      groqApiKey,
      suggestionsPrompt:
        typeof o.suggestionsPrompt === "string"
          ? o.suggestionsPrompt
          : defaults.suggestionsPrompt,
      chatPrompt:
        typeof o.chatPrompt === "string" ? o.chatPrompt : defaults.chatPrompt,
      summarizationPrompt:
        typeof o.summarizationPrompt === "string"
          ? o.summarizationPrompt
          : defaults.summarizationPrompt,
      recentContextChars: clampPositiveInt(
        o.recentContextChars,
        defaults.recentContextChars,
      ),
      earlierContextChars: clampPositiveInt(
        o.earlierContextChars,
        defaults.earlierContextChars,
      ),
      chatContextChars: clampPositiveInt(
        o.chatContextChars,
        defaults.chatContextChars,
      ),
    };
  } catch {
    return { ...defaults, groqApiKey: legacyKey };
  }
}

function persistSettings(settings: Settings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  localStorage.setItem(LEGACY_GROQ_KEY, settings.groqApiKey);
}

export default function useSettings(): {
  settings: Settings;
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  saveSettings: () => void;
  resetToDefaults: () => void;
} {
  const [settings, setSettings] = useState<Settings>(() =>
    getDefaultSettings(),
  );

  useEffect(() => {
    setSettings(loadTwinmindSettings());
  }, []);

  const updateSetting = useCallback(
    <K extends keyof Settings>(key: K, value: Settings[K]): void => {
      setSettings((previous) => ({ ...previous, [key]: value }));
    },
    [],
  );

  const saveSettings = useCallback((): void => {
    persistSettings(settings);
  }, [settings]);

  const resetToDefaults = useCallback((): void => {
    setSettings(getDefaultSettings());
  }, []);

  return {
    settings,
    updateSetting,
    saveSettings,
    resetToDefaults,
  };
}

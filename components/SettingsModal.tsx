"use client";

// Full-screen overlay for editing Groq key, transcript context sizes, and prompt templates stored in localStorage.

import { useCallback, useEffect, type ReactElement } from "react";
import useSettings from "@/hooks/useSettings";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({
  isOpen,
  onClose,
}: SettingsModalProps): ReactElement | null {
  const { settings, updateSetting, saveSettings, resetToDefaults } =
    useSettings();

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  const handleSave = useCallback((): void => {
    saveSettings();
    onClose();
  }, [saveSettings, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-neutral-900"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="shrink-0 border-b border-neutral-800 p-8 pb-6">
          <div className="flex items-start justify-between gap-4">
            <h2
              id="settings-title"
              className="text-lg font-semibold text-neutral-100"
            >
              Settings
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-transparent px-2 py-1 text-neutral-400 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
              aria-label="Close settings"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-8 pt-6">
          <div className="flex flex-col gap-8">
            <section className="flex flex-col gap-3 border-b border-neutral-800 pb-8">
              <label
                htmlFor="settings-groq-key"
                className="text-sm font-medium text-neutral-200"
              >
                Groq API Key
              </label>
              <input
                id="settings-groq-key"
                type="password"
                autoComplete="off"
                value={settings.groqApiKey}
                onChange={(event) => {
                  updateSetting("groqApiKey", event.target.value);
                }}
                className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2.5 text-sm text-neutral-200 placeholder:text-neutral-600 focus-visible:border-blue-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
                placeholder="Paste your Groq API key"
              />
              <p className="text-xs leading-relaxed text-neutral-500">
                Your key is stored locally and never sent to our servers — only
                to Groq directly.
              </p>
            </section>

            <section className="flex flex-col gap-4 border-b border-neutral-800 pb-8">
              <h3 className="text-sm font-medium text-neutral-200">
                Context Window Sizes
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="settings-recent-chars"
                    className="text-xs font-medium text-neutral-400"
                  >
                    Recent transcript (chars)
                  </label>
                  <input
                    id="settings-recent-chars"
                    type="number"
                    min={1}
                    value={settings.recentContextChars}
                    onChange={(event) => {
                      const n = Number.parseInt(event.target.value, 10);
                      if (!Number.isNaN(n) && n >= 1) {
                        updateSetting("recentContextChars", n);
                      }
                    }}
                    className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-200 focus-visible:border-blue-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
                  />
                  <p className="text-[11px] leading-snug text-neutral-600">
                    Verbatim tail of the transcript sent to live suggestions.
                  </p>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="settings-earlier-chars"
                    className="text-xs font-medium text-neutral-400"
                  >
                    Earlier context (chars)
                  </label>
                  <input
                    id="settings-earlier-chars"
                    type="number"
                    min={1}
                    value={settings.earlierContextChars}
                    onChange={(event) => {
                      const n = Number.parseInt(event.target.value, 10);
                      if (!Number.isNaN(n) && n >= 1) {
                        updateSetting("earlierContextChars", n);
                      }
                    }}
                    className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-200 focus-visible:border-blue-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
                  />
                  <p className="text-[11px] leading-snug text-neutral-600">
                    Older transcript summarized before the recent window.
                  </p>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="settings-chat-chars"
                    className="text-xs font-medium text-neutral-400"
                  >
                    Chat transcript (chars)
                  </label>
                  <input
                    id="settings-chat-chars"
                    type="number"
                    min={1}
                    value={settings.chatContextChars}
                    onChange={(event) => {
                      const n = Number.parseInt(event.target.value, 10);
                      if (!Number.isNaN(n) && n >= 1) {
                        updateSetting("chatContextChars", n);
                      }
                    }}
                    className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-200 focus-visible:border-blue-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
                  />
                  <p className="text-[11px] leading-snug text-neutral-600">
                    Full transcript tail passed into chat as meeting context.
                  </p>
                </div>
              </div>
            </section>

            <section className="flex flex-col gap-4">
              <div>
                <h3 className="text-sm font-medium text-neutral-200">
                  Prompt Templates
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-neutral-500">
                  These are sent to the model on every request. Edit carefully —
                  they directly affect suggestion and chat quality.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <label
                  htmlFor="settings-suggestions-prompt"
                  className="text-xs font-medium text-neutral-400"
                >
                  Live Suggestions Prompt
                </label>
                <textarea
                  id="settings-suggestions-prompt"
                  rows={6}
                  value={settings.suggestionsPrompt}
                  onChange={(event) => {
                    updateSetting("suggestionsPrompt", event.target.value);
                  }}
                  className="w-full resize-y rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 font-mono text-xs leading-relaxed text-neutral-200 focus-visible:border-blue-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label
                  htmlFor="settings-chat-prompt"
                  className="text-xs font-medium text-neutral-400"
                >
                  Chat Prompt
                </label>
                <textarea
                  id="settings-chat-prompt"
                  rows={6}
                  value={settings.chatPrompt}
                  onChange={(event) => {
                    updateSetting("chatPrompt", event.target.value);
                  }}
                  className="w-full resize-y rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 font-mono text-xs leading-relaxed text-neutral-200 focus-visible:border-blue-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label
                  htmlFor="settings-summarize-prompt"
                  className="text-xs font-medium text-neutral-400"
                >
                  Summarization Prompt
                </label>
                <textarea
                  id="settings-summarize-prompt"
                  rows={6}
                  value={settings.summarizationPrompt}
                  onChange={(event) => {
                    updateSetting("summarizationPrompt", event.target.value);
                  }}
                  className="w-full resize-y rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 font-mono text-xs leading-relaxed text-neutral-200 focus-visible:border-blue-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
                />
              </div>
            </section>
          </div>
        </div>

        <div className="shrink-0 border-t border-neutral-800 bg-neutral-900 p-8 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={resetToDefaults}
              className="rounded-md border border-neutral-600 bg-transparent px-4 py-2.5 text-sm font-medium text-neutral-200 transition-colors hover:border-neutral-500 hover:bg-neutral-800/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            >
              Reset to Defaults
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Right column: chat guidance, empty thread, and pinned message composer.

import type { ReactElement, ReactNode } from "react";

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

export function ChatPanel(): ReactElement {
  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <header className="flex shrink-0 items-center justify-between border-b border-neutral-800 px-5 py-4">
        <h2 className="text-xs font-medium uppercase tracking-widest text-neutral-500">
          3. CHAT (DETAILED ANSWERS)
        </h2>
        <span className="rounded-full border border-neutral-700 bg-neutral-900/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
          SESSION-ONLY
        </span>
      </header>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-6">
          <InfoCard>
            Chat keeps longer answers and follow-ups in one thread. Use it when
            a suggestion needs depth, or type a fresh question—everything here
            stays in this session until you clear it.
          </InfoCard>
          <p className="text-center text-sm text-neutral-600">
            Click a suggestion or type a question below.
          </p>
        </div>

        <footer className="shrink-0 border-t border-neutral-800 bg-[#0a0a0a]/95 px-5 py-4 backdrop-blur-sm">
          <div className="flex gap-3">
            <label htmlFor="chat-input" className="sr-only">
              Ask anything
            </label>
            <input
              id="chat-input"
              name="message"
              type="text"
              placeholder="Ask anything..."
              className="min-w-0 flex-1 rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2.5 text-sm text-neutral-200 placeholder:text-neutral-600 focus-visible:border-blue-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
            />
            <button
              type="button"
              className="shrink-0 rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
            >
              Send
            </button>
          </div>
        </footer>
      </div>
    </section>
  );
}

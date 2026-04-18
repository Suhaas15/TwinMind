// Composes the three-column meeting copilot shell on the home route.

import type { ReactElement } from "react";
import { ChatPanel } from "@/components/ChatPanel";
import { LiveSuggestions } from "@/components/LiveSuggestions";
import { MicTranscript } from "@/components/MicTranscript";

export default function Home(): ReactElement {
  return (
    <div className="flex h-dvh min-h-0 w-full flex-row bg-[#0a0a0a] text-neutral-200">
      <MicTranscript />
      <LiveSuggestions />
      <ChatPanel />
    </div>
  );
}

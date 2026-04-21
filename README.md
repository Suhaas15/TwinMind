# TwinMind Live Suggestions

## What This Is

TwinMind Live Suggestions is a **meeting copilot**: three columns, one conversation, and a stubborn belief that the best nudge is the one that arrives *while you’re still in the sentence*, not five minutes later.

I built this as a **take-home for TwinMind**. The product bet is simple: during a live call, people do not need more noise - they need the *right* suggestion at the *right* moment. This repo is my answer: live transcription on a fixed cadence, contextual suggestion batches every ~30 seconds, streaming chat grounded in the same transcript, runtime prompt/settings control from a modal, and one-click JSON session export.

---

## Getting Started

**Live demo:** https://twinmind-live-suggestions-jet.vercel.app

You need **Node 18+** and a **Groq API key**.
1. Clone the repo and install dependencies: `npm install`
2. Start the app: `npm run dev`
3. Open **Settings** (gear icon, top right) and paste your Groq API key
4. Click the mic and start talking
5. Transcript chunks and live suggestions refresh automatically every ~30s
6. Click any suggestion card to open it in chat (instant preview + streamed answer)
7. Use **Export Session** to download transcript + suggestions + chat as JSON

---

## Stack & Architecture

**Next.js 15 (App Router)** — I chose this because route handlers are a natural place to sit between the browser and Groq: the client never needs a hardcoded secret in the bundle, and a Vercel deploy is mostly “connect repo, set nothing exotic, go.” The App Router also keeps the UI and API colocated in a way that matches how I think about the product: pages compose panels; `/api/*` composes providers.

**Tailwind CSS** — No component library. I wanted speed and a dark, dense UI without fighting a design system I didn’t own. Tailwind let me iterate on spacing and borders until the three columns *felt* like a control room, not a slide deck.

**No database, no auth** — For this assignment, persistence would be a distraction. Everything interesting lives in **React state for the session**: recording, transcript chunks, suggestion batches, and chat messages. If you refresh, you’re starting a new mental session anyway—that matches how I’d use a copilot in a real meeting.

**Three Groq call families** — The architecture lines up like this:

1. **Whisper** (via Groq’s OpenAI-compatible transcription endpoint) for chunked speech-to-text.
2. **GPT-OSS 120B** for **summarization + live suggestions** — a small summarize hop, then structured suggestion batches in the middle column.
3. **GPT-OSS 120B** again for **chat**—longer answers when a suggestion isn’t enough.

Transcription, the suggestion pipeline (summarize + suggest), and streaming chat are all live against Groq.

---

## How the Transcription Works

The browser’s **MediaRecorder** runs on a **30 second stop/restart cycle** on the **same** `MediaStream`: I `start()` with **no timeslice**, let audio accumulate, then **`stop()`** so the recorder emits a **single, self-contained WebM/Opus blob** for that window. That blob goes to **`POST /api/transcribe`**, which forwards multipart data to Groq’s **Whisper Large V3** endpoint. Immediately after `onstop` (unless you’ve pressed stop for real), I spin up a **fresh** `MediaRecorder` on the same stream and `start()` again—rinse and repeat. I’m not re-encoding: Chrome/Firefox already give us WebM + Opus, and Whisper is fine with it.

**Why I walked away from timeslice.** With `start(timeslice)`, **`ondataavailable` only carries the full WebM container header in the first chunk**; later chunks are mostly codec deltas without a valid standalone header. Whisper quite reasonably **400**s those “orphan” blobs. You can try to glue the header onto every delta (I did for a while), but then Whisper happily **re-transcribes the same opening audio** on every request—duplicate transcript hell. The stop/restart pattern sidesteps both problems: each upload is a real file.

**The honest cost: a small gap.** Stopping the recorder, finalizing the blob, POSTing, and starting again isn’t free in wall-clock time. In practice I see on the order of **~1–2 seconds of dead air per ~30 second cycle**—call it **roughly 6% of the timeline** if you’re feeling statistical. That’s a deliberate tradeoff: **I’d rather lose a sliver of continuity than ship garbage audio or duplicate text.** If that gap ever matters for a productized version, the next levers are overlapping recorders or a native pipeline—not going back to naive timeslice uploads.

**Tiny blobs still happen.** The tail of a segment can still be effectively empty. On the client I **skip the transcribe call** if the finalized blob is under **1KB**; on the server **`/api/transcribe`** still returns **`{ text: "" }` with 200** for sub-1KB uploads so Groq never sees noise. Same spirit as before, updated for “one blob per segment” instead of “every timeslice tick.”

---

## Prompt Strategy

**Context windowing — two layers.** I split context into a **recent** verbatim tail and an **earlier** region. Recent is about **3,000 chars** (~last 3 minutes), because that is what people are reacting to right now. Earlier is up to **4,000 chars** from the end of the older transcript so background stays fresh. The cost is that this is character-window based, not speaker-turn aware, which is simpler and fast but can cut conversational boundaries.

**Why summarize instead of truncate.** I summarize the earlier slice before suggestion generation because truncation destroys context at sentence and entity boundaries. A short 3-5 sentence summary keeps decisions, names, numbers, and commitments coherent enough for the model to reason on. That gives better signal than shoving a broken raw chunk into the prompt. The cost is that summarization is lossy by design.

**The two-call latency tradeoff.** Suggestion refresh is sequential: first `/api/summarize`, then `/api/suggestions`. I accept that because the summary is capped at **200 tokens**, so the added latency is usually tens to low hundreds of milliseconds, while quality gains are obvious in longer meetings. This keeps the suggestion model focused instead of context-confused. The cost is one extra network/model hop per refresh.

**Suggestion types — five labels, not a bingo card.** I use five labels (`question`, `talking_point`, `answer`, `fact_check`, `clarify`) as vocabulary, not quotas. The prompt explicitly forbids one-of-each output and asks for the three best fits for the current moment. That keeps batches useful instead of formulaic—type distribution is intentionally uneven across refreshes.

**JSON Schema mode.** Suggestions run in structured-output mode with a strict schema: exactly three items, each with `type`, `preview`, and `detail`. That gives me stable UI contracts and avoids regex cleanup or brittle post-processing. I still validate at the route boundary, but schema-first keeps the wire format predictable. The risk is that strict schema can reject otherwise reasonable free-form output.

**Previous suggestions in the loop.** Each refresh includes the last batch previews as anti-repeat context. That simple addition noticeably reduces duplicate nudges when conversation stalls or loops. It is cheap, explicit, and model-friendly. The risk is that if previous suggestions were wrong, they still influence the next pass.

**Chat — transcript as ground truth.** Chat always receives meeting transcript context as a separate system block, distinct from instruction text. That keeps answers anchored to what was actually said instead of drifting into generic assistant behavior. The model can infer and synthesize, but it is not asked to invent missing meeting facts—if the transcript misses speech, chat inherits that blind spot.

**Instant detail preview + streaming.** Clicking a suggestion inserts its `detail` immediately, then streams a fuller answer underneath. This makes interaction feel responsive in live-call conditions where dead time kills trust. Users get immediate value plus richer follow-up without waiting on full completion—users may read the preview as final before the stream finishes.

---

## Tradeoffs & Decisions

**We skip audio conversion** because WebM/Opus is already what Whisper accepts in practice, and every conversion step adds latency and failure modes. This keeps the transcription path short and debuggable. If mobile Safari constraints force a format bridge later, I will add it with clear justification.

**The Groq key lives in `localStorage`** for this assignment because account systems and vault management are outside scope. The key is not committed and not hardcoded server-side; it is provided by the user in Settings and forwarded per request header. That is a pragmatic local-dev security posture, not an enterprise auth model.

**All state in React** keeps the mental model small: one session, one tab, one source of truth. This avoids persistence complexity, migrations, and sync bugs for a workflow that is naturally session-oriented. The cost is explicit: refresh resets runtime state, which is acceptable for this scope.

**Stop/restart transcription vs MediaRecorder timeslice.** Timeslice produced non-standalone chunks that Whisper rejected (or duplicated when header-glued). Stop/restart gives one valid WebM per segment and removes duplicate transcript failure modes. The cost is a small **~1-2s** gap per **~30s** cycle (~6% timeline).

**Two Groq calls per suggestion refresh (summarize, then suggest).** The summarize hop buys coherent earlier context without flooding the suggestion prompt with raw transcript. Sequential latency is real, but bounded because the summary output is capped at 200 tokens. If latency becomes the top bottleneck, collapsing into one call is the straightforward optimization.

**Streaming chat responses.** Chat uses SSE so first token latency is typically **~200-400ms** instead of waiting several seconds for full completion. In a live meeting, that response shape materially improves usability. Tradeoff: stream parsing/state handling is more complex than one-shot JSON.

**Chat history limit (20 turns).** I cap chat history at 20 turns and rely on transcript context as long-term memory. That keeps prompt size controlled without adding another summarization hop before every chat request. Tradeoff: very long side-thread nuance can fall out of chat history while transcript grounding remains.

**Settings and prompt customization.** Prompts and context windows are editable at runtime in Settings, then sent on each request body. Routes prefer request values and fall back to `lib/prompts.ts` defaults, so reset behavior is deterministic. Tradeoff: prompt quality can degrade if users enter poor instructions, which is expected by design.

---

## What’s Left / Roadmap (for now)

- [x] **Transcription hardening (Phase 2)** — fixed invalid timeslice chunks for Whisper, killed the “init segment + every delta” duplication bug, moved to **30s stop/restart** self-contained WebM segments.
- [x] **Suggestion engine (Phase 3)** — batch suggestions off transcript windows, prepend batches in the middle column.
- [x] **Chat panel wiring (Phase 4)** — thread messages, streaming send pipeline, suggestion handoff with instant detail preview + streamed follow-up.
- [x] **Settings modal (Phase 5)** — first-class Groq key entry, editable prompts and context sizes, persisted locally; API routes prefer body overrides over `lib/prompts.ts` defaults.
- [x] **Export (Phase 6)** — one-click session export (`transcript`, `suggestionBatches`, `chat`) as structured JSON.
- [ ] **Prompt tuning (Phase 7)** — keep pressure-testing summarization + suggestion prompts as real meetings surface edge cases.

The core app is complete and working end-to-end; what remains is iterative prompt tuning against real meeting transcripts.

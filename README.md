# TwinMind Live Suggestions

## What This Is

TwinMind Live Suggestions is a **meeting copilot**: three columns, one conversation, and a stubborn belief that the best nudge is the one that arrives *while you’re still in the sentence*, not five minutes later.

I built this as a **take-home for TwinMind**. The product bet is simple: during a live call, people don’t need more noise—they need the *right* suggestion at the *right* moment. This repo is my working answer to that: capture what’s being said, turn it into text on a cadence you can trust, and leave room for richer “live suggestions” and chat layers to grow on top.

Right now you’ll see the shell, the mic pipeline, live suggestion batches (with the context windowing and prompts described below), and the chat column still waiting for wiring. The foundation and the middle column are doing real work; chat is the next big hook-up.

---

## Getting Started

You’ll need **Node 18+** and a **Groq API key** (Whisper + the OSS models I plan to call all live on Groq’s stack).

Clone the repo, install, and run:

```bash
npm install
npm run dev
```

Open the URL from the dev server (Next defaults to port **3000**). In the **Settings** flow (once the modal ships), paste your Groq key so the app can authorize transcription requests. Until that UI lands, you can do the same thing manually: in devtools, `localStorage.setItem("groq_api_key", "<your key>")`, refresh, hit the mic, and **start talking**. You should see transcript chunks appear every ~30 seconds as each self-contained recording segment finishes and Whisper turns it into text.

If nothing happens, check the mic permission prompt and the network tab on `/api/transcribe`—those two tell most of the story.

---

## Stack & Architecture

**Next.js 15 (App Router)** — I chose this because route handlers are a natural place to sit between the browser and Groq: the client never needs a hardcoded secret in the bundle, and a Vercel deploy is mostly “connect repo, set nothing exotic, go.” The App Router also keeps the UI and API colocated in a way that matches how I think about the product: pages compose panels; `/api/*` composes providers.

**Tailwind CSS** — No component library. I wanted speed and a dark, dense UI without fighting a design system I didn’t own. Tailwind let me iterate on spacing and borders until the three columns *felt* like a control room, not a slide deck.

**No database, no auth** — For this assignment, persistence would be a distraction. Everything interesting lives in **React state for the session**: recording, transcript chunks, suggestion batches, and (soon) chat messages. If you refresh, you’re starting a new mental session anyway—that matches how I’d use a copilot in a real meeting.

**Three Groq call families** — The architecture lines up like this:

1. **Whisper** (via Groq’s OpenAI-compatible transcription endpoint) for chunked speech-to-text.
2. **GPT-OSS 120B** for **summarization + live suggestions** — a small summarize hop, then structured suggestion batches in the middle column.
3. **GPT-OSS 120B** again for **chat**—longer answers when a suggestion isn’t enough.

Transcription and the suggestion pipeline (summarize + suggest) are live; chat is still the column waiting on Phase 4.

---

## How the Transcription Works

The browser’s **MediaRecorder** runs on a **30 second stop/restart cycle** on the **same** `MediaStream`: I `start()` with **no timeslice**, let audio accumulate, then **`stop()`** so the recorder emits a **single, self-contained WebM/Opus blob** for that window. That blob goes to **`POST /api/transcribe`**, which forwards multipart data to Groq’s **Whisper Large V3** endpoint. Immediately after `onstop` (unless you’ve pressed stop for real), I spin up a **fresh** `MediaRecorder` on the same stream and `start()` again—rinse and repeat. I’m not re-encoding: Chrome/Firefox already give us WebM + Opus, and Whisper is fine with it.

**Why I walked away from timeslice.** With `start(timeslice)`, **`ondataavailable` only carries the full WebM container header in the first chunk**; later chunks are mostly codec deltas without a valid standalone header. Whisper quite reasonably **400**s those “orphan” blobs. You can try to glue the header onto every delta (I did for a while), but then Whisper happily **re-transcribes the same opening audio** on every request—duplicate transcript hell. The stop/restart pattern sidesteps both problems: each upload is a real file.

**The honest cost: a small gap.** Stopping the recorder, finalizing the blob, POSTing, and starting again isn’t free in wall-clock time. In practice I see on the order of **~1–2 seconds of dead air per ~30 second cycle**—call it **roughly 6% of the timeline** if you’re feeling statistical. That’s a deliberate tradeoff: **I’d rather lose a sliver of continuity than ship garbage audio or duplicate text.** If that gap ever matters for a productized version, the next levers are overlapping recorders or a native pipeline—not going back to naive timeslice uploads.

**Tiny blobs still happen.** The tail of a segment can still be effectively empty. On the client I **skip the transcribe call** if the finalized blob is under **1KB**; on the server **`/api/transcribe`** still returns **`{ text: "" }` with 200** for sub-1KB uploads so Groq never sees noise. Same spirit as before, updated for “one blob per segment” instead of “every timeslice tick.”

---

## Prompt Strategy

This is the part I expect to keep tuning, but the **shape** of the system is set: how we window context, why we burn two Groq calls before we ever ask for suggestions, and how we keep the model from sounding like a mail-merge template.

**Context windowing — two layers, not one wall of text.** I split the transcript into a **recent** slice and an **earlier** slice. The **recent** layer is the **last ~3 minutes of speech**, passed **verbatim** — in code that’s about **3,000 characters** of joined transcript, i.e. what people in the room are *actually* reacting to right now. Everything **before** that tail is the **earlier** layer: I take up to **4,000 characters** from the **end** of that older stretch (so I keep the freshest “background,” not the meeting opener from an hour ago) and **do not** send that raw wall straight into the suggestion model.

Instead, that earlier slice goes to **`/api/summarize`** first. The system prompt asks for a **3–5 sentence** compression: **key topics, decisions, names, numbers, commitments** — the stuff you’d actually want in working memory. That string becomes **EARLIER CONTEXT SUMMARY** in the suggestion call; the verbatim tail becomes **RECENT TRANSCRIPT**.

**Why summarize instead of blunt truncation.** I could have hard-truncated the earlier region to a token budget, but truncation loves to **cut mid-sentence, mid-thought, mid-name**. You get grammatically broken context the model will happily hallucinate on top of. A short summary **preserves the narrative threads** in a shape the model can *use*: “they committed to X by Friday,” “budget cap is Y,” “Person A owns the follow-up.” It’s lossy in the good way—like good meeting notes, not like a shredded fax.

**The latency tradeoff (summarize, then suggest).** Before **`/api/suggestions`** fires, **`/api/summarize`** runs on the earlier slice—**sequential**, no parallel cheat code. I’m okay with that because the summary is **capped at 200 output tokens**, and Groq’s stack routinely runs on the order of **~500 tokens/s** for this class of model, so the extra hop is usually **tens to low hundreds of milliseconds** in practice—not a second-long detour. The gain is **contextual quality** on long meetings: the suggestion model isn’t guessing what “earlier” meant from a mangled paste. If production ever screams about milliseconds, we can **collapse summarize + suggestions into a single call**; I’d rather start with clarity and simplify than start fuzzy and debug why suggestions drift.

**Suggestion types — five labels, not a bingo card.** I defined five types — **question**, **talking_point**, **answer**, **fact_check**, **clarify** — and I’m explicit in the prompt: **do not** produce one of each mechanically. The model picks the **three** types that actually fit *this* moment. That single rule is a lot of what keeps output from feeling formulaic; the types are vocabulary for the model, not a checklist it has to tick every refresh.

**JSON Schema mode — trust the wire format.** Suggestions run on **GPT-OSS 120B** with Groq’s **structured output** (`json_schema`) so the response has to match our object shape: exactly three items, each with `type`, `preview`, and `detail`. If the HTTP call succeeds, I treat the payload as structurally valid — no defensive regex archaeology. The route still sanity-checks because I’m not reckless, but the contract is “schema or bust,” which lines up cleanly with our TypeScript types.

**Previous suggestions in the loop.** Every suggestion request includes the **previews** from the last batch (newline-separated). That’s how we tell the model: don’t recycle the same three blurbs every 30 seconds when the room hasn’t actually moved. It’s cheap context, and it makes the refresh cadence feel less like a broken record.

**Chat** — the **`CHAT_PROMPT`** in `lib/prompts.ts` is wired for Phase 4: ground answers in the full transcript, admit when something wasn’t said, stay practical. I’ll deepen that section once the panel talks to the API.

---

## Tradeoffs & Decisions

**We skip audio conversion** because WebM/Opus is already what Whisper expects in practice, and every conversion step is latency + risk. If we ever need universal mobile Safari behavior, we’ll revisit—but not before we have a reason.

**The Groq key lives in `localStorage`** for this assignment because I’m not building account systems or vaults here. The key is **not** checked into the repo and **not** baked into server env as a global secret—you supply it per browser session, and the server route reads it from a header on each request when calling Groq. That’s a pragmatic compromise: good enough for a take-home, not how I’d ship to paying enterprises without a proper auth story.

**All state in React** keeps the mental model small: one session, one tab, one source of truth. No migrations, no “why is my local DB out of sync with production,” no surprise GDPR footguns. The cost is obvious—you lose everything on refresh—and I’m fine with that for v0.

**Stop/restart transcription vs MediaRecorder timeslice.** Timeslice chunks were seductive until Whisper started **400**ing every “tail” file without a WebM header—or, worse, accepting **header-glued** tails and **re-transcribing the same opening audio** on every upload. Stop/restart trades **~1–2 seconds of gap per ~30s** (~6% timeline loss in the back-of-the-envelope math) for **one valid WebM per segment** and **no duplicate transcript**. Gap over duplication. If I ever need gapless, I’ll design for it explicitly; I won’t pretend timeslice blobs were “good enough.”

**Two Groq calls per suggestion refresh (summarize, then suggest).** The summarize hop buys **coherent earlier context** without dumping 20 minutes of raw transcript into the suggestion prompt. The cost is **sequential latency**, but the summary is **tiny (200 tokens max)** and **fast to generate** in practice—worth it until real profiling says otherwise. If latency ever becomes the bottleneck, **collapsing into one call** is an honest future lever; it’s not a moral failure, just an optimization.

---

## What’s Left / Roadmap (for now)

- [x] **Transcription hardening (Phase 2)** — fixed invalid timeslice chunks for Whisper, killed the “init segment + every delta” duplication bug, moved to **30s stop/restart** self-contained WebM segments.
- [x] **Suggestion engine (Phase 3)** — batch suggestions off transcript windows, prepend batches in the middle column.
- [ ] **Chat panel wiring (Phase 4)** — thread messages, send pipeline, tie-ins to suggestions.
- [ ] **Settings modal (Phase 5)** — first-class Groq key entry instead of devtools/localStorage yoga.
- [ ] **Export (Phase 6)** — transcript + suggestions out of the browser in a format people actually use.
- [ ] **Prompt tuning (Phase 7)** — keep pressure-testing summarization + suggestion prompts as real meetings surface edge cases.

If you’re reading this README while half the roadmap is still open, you’re not late—you’re just watching the thing get built in public.

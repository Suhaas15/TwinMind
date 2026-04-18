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

Open the URL from the dev server (Next defaults to port **3000**). In the **Settings** flow (once the modal ships), paste your Groq key so the app can authorize transcription requests. Until that UI lands, you can do the same thing manually: in devtools, `localStorage.setItem("groq_api_key", "<your key>")`, refresh, hit the mic, and **start talking**. You should see transcript chunks appear as the recorder slices audio and Whisper turns each slice into text.

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

The browser’s **MediaRecorder** captures audio with a **30 second timeslice**. Every time `ondataavailable` fires, we ship that blob to **`POST /api/transcribe`**, which forwards multipart form data to Groq’s **Whisper Large V3** endpoint. I’m not re-encoding: Chrome/Firefox give us **WebM + Opus** by default, and Whisper is happy to eat it—skipping conversion saves CPU on the client and avoids an extra failure mode.

There’s one sharp edge: when you stop recording, MediaRecorder often emits a **tiny final chunk** that isn’t real audio. Groq (rightfully) returns **400** for junk. I fixed that two ways: **skip blobs under ~10KB on the client** so we don’t even bother the API, and on the server, **if a blob is under 1KB, return `{ text: "" }` with 200** as a safety net. Net effect: no more phantom errors at the end of an otherwise clean take.

---

## Prompt Strategy

This is the part I expect to keep tuning, but the **shape** of the system is set: how we window context, why we burn two Groq calls before we ever ask for suggestions, and how we keep the model from sounding like a mail-merge template.

**Context windowing — two layers, not one wall of text.** I split the transcript into a **recent** slice and an **earlier** slice. The last chunk of text (roughly the last few minutes — about **3,000 characters** verbatim) is what the suggestion model should lean on hardest: that’s the live edge of the conversation. Everything *before* that tail gets a different job. I take up to **4,000 characters** from the end of that “earlier” region — i.e. the most relevant older material — and run it through a **dedicated summarization call** first. The prompt asks for a tight **3–5 sentence** summary: topics, decisions, names, numbers, commitments. That summary becomes **EARLIER CONTEXT SUMMARY** in the suggestion prompt; the verbatim tail becomes **RECENT TRANSCRIPT**. Net effect: the model always gets crisp, recent detail *plus* a compressed memory of what came before, without drowning in ancient transcript nobody in the room is thinking about anymore.

**Why two sequential Groq calls for suggestions.** I made this tradeoff on purpose. A fast **summarize** step (`/api/summarize`) before **`/api/suggestions`** buys noticeably better situational awareness once a meeting has been running for a while — the suggestion model isn’t inventing “what happened earlier” from a truncated paste. The summary is capped at **200 tokens**, so the extra hop stays small in latency. If production ever screams about milliseconds, we can collapse summarize + suggestions into a single call; I’d rather start with clarity and simplify than start fuzzy and debug why suggestions drift.

**Suggestion types — five labels, not a bingo card.** I defined five types — **question**, **talking_point**, **answer**, **fact_check**, **clarify** — and I’m explicit in the prompt: **do not** produce one of each mechanically. The model picks the **three** types that actually fit *this* moment. That single rule is a lot of what keeps output from feeling formulaic; the types are vocabulary for the model, not a checklist it has to tick every refresh.

**JSON Schema mode — trust the wire format.** Suggestions run on **GPT-OSS 120B** with Groq’s **structured output** (`json_schema`) so the response has to match our object shape: exactly three items, each with `type`, `preview`, and `detail`. If the HTTP call succeeds, I treat the payload as structurally valid — no defensive regex archaeology. The route still sanity-checks because I’m not reckless, but the contract is “schema or bust,” which lines up cleanly with our TypeScript types.

**Previous suggestions in the loop.** Every suggestion request includes the **previews** from the last batch (newline-separated). That’s how we tell the model: don’t recycle the same three blurbs every 30 seconds when the room hasn’t actually moved. It’s cheap context, and it makes the refresh cadence feel less like a broken record.

**Chat** — the **`CHAT_PROMPT`** in `lib/prompts.ts` is wired for Phase 4: ground answers in the full transcript, admit when something wasn’t said, stay practical. I’ll deepen that section once the panel talks to the API.

---

## Tradeoffs & Decisions

**We skip audio conversion** because WebM/Opus is already what Whisper expects in practice, and every conversion step is latency + risk. If we ever need universal mobile Safari behavior, we’ll revisit—but not before we have a reason.

**The Groq key lives in `localStorage`** for this assignment because I’m not building account systems or vaults here. The key is **not** checked into the repo and **not** baked into server env as a global secret—you supply it per browser session, and the server route reads it from a header on each request when calling Groq. That’s a pragmatic compromise: good enough for a take-home, not how I’d ship to paying enterprises without a proper auth story.

**All state in React** keeps the mental model small: one session, one tab, one source of truth. No migrations, no “why is my local DB out of sync with production,” no surprise GDPR footguns. The cost is obvious—you lose everything on refresh—and I’m fine with that for v0.

---

## What’s Left / Roadmap (for now)

- [x] **Suggestion engine (Phase 3)** — batch suggestions off transcript windows, prepend batches in the middle column.
- [ ] **Chat panel wiring (Phase 4)** — thread messages, send pipeline, tie-ins to suggestions.
- [ ] **Settings modal (Phase 5)** — first-class Groq key entry instead of devtools/localStorage yoga.
- [ ] **Export (Phase 6)** — transcript + suggestions out of the browser in a format people actually use.
- [ ] **Prompt tuning (Phase 7)** — keep pressure-testing summarization + suggestion prompts as real meetings surface edge cases.

If you’re reading this README while half the roadmap is still open, you’re not late—you’re just watching the thing get built in public.

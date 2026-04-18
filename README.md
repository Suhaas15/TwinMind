# TwinMind Live Suggestions

## What This Is

TwinMind Live Suggestions is a **meeting copilot**: three columns, one conversation, and a stubborn belief that the best nudge is the one that arrives *while you’re still in the sentence*, not five minutes later.

I built this as a **take-home for TwinMind**. The product bet is simple: during a live call, people don’t need more noise—they need the *right* suggestion at the *right* moment. This repo is my working answer to that: capture what’s being said, turn it into text on a cadence you can trust, and leave room for richer “live suggestions” and chat layers to grow on top.

Right now you’ll see the shell, the mic pipeline, and the bones of where suggestions and chat will sit. The fun part (prompting, batching, context) is still ahead—but the foundation is honest about what it’s trying to do.

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

**No database, no auth** — For this assignment, persistence would be a distraction. Everything interesting lives in **React state for the session**: recording, transcript chunks, and (soon) suggestion batches and chat messages. If you refresh, you’re starting a new mental session anyway—that matches how I’d use a copilot in a real meeting.

**Three Groq calls (where we’re headed)** — The architecture assumes three touchpoints:

1. **Whisper** (via Groq’s OpenAI-compatible transcription endpoint) for chunked speech-to-text.
2. **GPT-OSS 120B** for **live suggestions** (batched, fast, biased toward usefulness over cleverness).
3. **GPT-OSS 120B** again for **chat**—longer answers when a suggestion isn’t enough.

Only the first is wired end-to-end today; the other two are deliberate placeholders in the layout so the UI doesn’t lie about what’s coming.

---

## How the Transcription Works

The browser’s **MediaRecorder** captures audio with a **30 second timeslice**. Every time `ondataavailable` fires, we ship that blob to **`POST /api/transcribe`**, which forwards multipart form data to Groq’s **Whisper Large V3** endpoint. I’m not re-encoding: Chrome/Firefox give us **WebM + Opus** by default, and Whisper is happy to eat it—skipping conversion saves CPU on the client and avoids an extra failure mode.

There’s one sharp edge: when you stop recording, MediaRecorder often emits a **tiny final chunk** that isn’t real audio. Groq (rightfully) returns **400** for junk. I fixed that two ways: **skip blobs under ~10KB on the client** so we don’t even bother the API, and on the server, **if a blob is under 1KB, return `{ text: "" }` with 200** as a safety net. Net effect: no more phantom errors at the end of an otherwise clean take.

---

## Prompt Strategy (we’ll grow this)

This section is intentionally a **skeleton**. As the suggestion engine and chat panel land, I’ll document the actual prompts, negative constraints, and “what we inject from transcript vs. what we leave out” rules here.

For now, the placeholders I owe future-me (and you):

- **Suggestions prompt** — tone, length limits, how we cite uncertainty, and how we avoid repeating what the room already said.
- **Chat prompt** — when to be verbose, when to refuse, and how we relate back to the active suggestion (if any).
- **Context window strategy** — how much transcript we keep “hot,” how we summarize older chunks, and when we reset context between meetings.

Check back after Phase 3–4; that’s when this file stops being polite fiction and starts being a spec.

---

## Tradeoffs & Decisions

**We skip audio conversion** because WebM/Opus is already what Whisper expects in practice, and every conversion step is latency + risk. If we ever need universal mobile Safari behavior, we’ll revisit—but not before we have a reason.

**The Groq key lives in `localStorage`** for this assignment because I’m not building account systems or vaults here. The key is **not** checked into the repo and **not** baked into server env as a global secret—you supply it per browser session, and the server route reads it from a header on each request when calling Groq. That’s a pragmatic compromise: good enough for a take-home, not how I’d ship to paying enterprises without a proper auth story.

**All state in React** keeps the mental model small: one session, one tab, one source of truth. No migrations, no “why is my local DB out of sync with production,” no surprise GDPR footguns. The cost is obvious—you lose everything on refresh—and I’m fine with that for v0.

---

## What’s Left / Roadmap (for now)

- [ ] **Suggestion engine (Phase 3)** — batch suggestions off transcript windows, prepend batches in the middle column.
- [ ] **Chat panel wiring (Phase 4)** — thread messages, send pipeline, tie-ins to suggestions.
- [ ] **Settings modal (Phase 5)** — first-class Groq key entry instead of devtools/localStorage yoga.
- [ ] **Export (Phase 6)** — transcript + suggestions out of the browser in a format people actually use.
- [ ] **Prompt tuning (Phase 7)** — turn the “Prompt Strategy” section from outline to gospel.

If you’re reading this README before those boxes are checked, you’re early—and honestly, that’s the best time to send feedback.

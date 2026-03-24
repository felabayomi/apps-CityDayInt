# Play for Livestream — Feature Documentation

A complete reference for how the AI voice reader, auto-play countdown, and scroll-to-reading-position features were built for Expedition America. Use this as a blueprint to implement the same system elsewhere.

---

## Overview

When an admin opens any article page, they see a **voice player** that:

1. Generates an AI voice reading of the full article (title + summary + body) using the Onyx voice
2. Caches the audio in the database so it never regenerates unnecessarily
3. Shows a live countdown to **12:00 PM ET** and auto-fires playback at that exact moment
4. Smoothly auto-scrolls the page in sync with the audio as it plays

Public visitors see a **"Tune In"** card instead, directing them to the livestream URL.

---

## Architecture

```
Browser (admin)
  └─ Checks localStorage / sessionStorage for "ea_admin_token"
  └─ On play: POST /api/tts/:articleId  (Authorization: Bearer <token>)
       └─ Server checks token against ADMIN_CODE env var
       └─ If article.audioUrl exists → return cached MP3
       └─ Else → call textToSpeech() → cache in DB → return MP3
  └─ Audio element plays the MP3 blob URL
  └─ timeupdate event → update progress bar + auto-scroll page
  └─ Countdown tick → auto-fire at 12:00 PM ET
```

---

## Part 1 — Backend: TTS Endpoint

**File:** `server/routes.ts`

### How it works

- Route: `POST /api/tts/:id`
- Requires `Authorization: Bearer <token>` header
- The token is validated against `process.env.ADMIN_CODE` (hashed with SHA-256)
- If the article already has `audioUrl` in the database, the cached MP3 is returned immediately
- If not, the full article text is cleaned of Markdown symbols, split into 2000-character chunks (to stay within model limits), passed to `textToSpeech()` one chunk at a time, concatenated, stored as a base64 data URL in the `audioUrl` DB column, and returned as an MP3 response

### Why chunking?

The AI model has a token limit per request. Long articles are split at sentence boundaries (`. `) to avoid cutting words mid-sentence.

```typescript
function splitChunks(text: string, max = 2000): string[] {
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > max) {
    let cut = remaining.lastIndexOf(". ", max);
    if (cut === -1) cut = remaining.lastIndexOf(" ", max);
    if (cut === -1) cut = max;
    else cut += 1;
    chunks.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }
  if (remaining.length > 0) chunks.push(remaining);
  return chunks;
}
```

### Full text assembly

Markdown formatting is stripped before sending to TTS:

```typescript
const cleanContent = (article.content || "")
  .replace(/#{1,6}\s+/g, "")
  .replace(/\*\*(.+?)\*\*/g, "$1")
  .replace(/\*(.+?)\*/g, "$1")
  .replace(/^[-*]\s+/gm, "")
  .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
  .replace(/\n{3,}/g, "\n\n")
  .trim();

const fullText = [article.title, article.summary, cleanContent]
  .filter(Boolean)
  .join("\n\n");
```

### Token authentication

```typescript
import crypto from "crypto";

function makeAdminToken(): string {
  return crypto
    .createHash("sha256")
    .update(process.env.ADMIN_CODE || "")
    .digest("hex");
}

// In the route handler:
const authHeader = req.headers.authorization || "";
const token = authHeader.replace("Bearer ", "");
if (!token || token !== makeAdminToken()) {
  return res.status(401).json({ error: "Unauthorized" });
}
```

---

## Part 2 — TTS Client

**File:** `server/replit_integrations/audio/client.ts`

### Critical note

Replit's OpenAI proxy does **not** support the `/audio/speech` endpoint directly. You must use the **chat completions** route with the `gpt-audio` model instead:

```typescript
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export async function textToSpeech(
  text: string,
  voice: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer" = "alloy",
  format: "wav" | "mp3" | "flac" | "opus" | "pcm16" = "wav"
): Promise<Buffer> {
  const response = await openai.chat.completions.create({
    model: "gpt-audio",
    modalities: ["text", "audio"],
    audio: { voice, format },
    messages: [
      { role: "system", content: "You are an assistant that performs text-to-speech." },
      { role: "user", content: `Repeat the following text verbatim: ${text}` },
    ],
  });
  const audioData = (response.choices[0]?.message as any)?.audio?.data ?? "";
  return Buffer.from(audioData, "base64");
}
```

**Voice used:** `onyx` (deep, authoritative broadcast voice)
**Format used:** `mp3`

---

## Part 3 — Database: audioUrl Column

**File:** `shared/schema.ts`

Add an `audioUrl` column to the articles table to cache generated audio:

```typescript
audioUrl: text("audio_url"),
```

After adding the column, run:

```bash
npm run db:push
```

In `server/storage.ts`, ensure `updateArticle` accepts and saves the `audioUrl` field. The value stored is a full base64 data URL:

```
data:audio/mpeg;base64,//uQxAAAAA...
```

---

## Part 4 — Frontend: Voice Player Component

**File:** `client/src/pages/article.tsx`

### Admin detection

```typescript
const adminToken =
  typeof window !== "undefined"
    ? (localStorage.getItem("ea_admin_token") || sessionStorage.getItem("ea_admin_token"))
    : null;
const isAdmin = !!adminToken;
```

The token is stored in `localStorage` or `sessionStorage` when the admin logs in. The key must be `"ea_admin_token"`.

### State

```typescript
const [audioState, setAudioState] = useState<"idle" | "loading" | "playing" | "paused">("idle");
const [progress, setProgress] = useState(0);           // 0–100 percent
const audioRef = useRef<HTMLAudioElement | null>(null);
const audioBlobUrlRef = useRef<string | null>(null);   // revoked on cleanup
```

### handleListen function

```typescript
async function handleListen() {
  // Toggle pause/resume
  if (audioState === "playing") {
    audioRef.current?.pause();
    setAudioState("paused");
    return;
  }
  if (audioState === "paused" && audioRef.current) {
    audioRef.current.play();
    setAudioState("playing");
    return;
  }

  if (!article) return;
  setAudioState("loading");

  try {
    const res = await fetch(`/api/tts/${article.id}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (!res.ok) throw new Error("TTS failed");

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    audioBlobUrlRef.current = url;

    const audio = new Audio(url);
    audioRef.current = audio;

    let lastScrolledAt = -5;
    audio.addEventListener("timeupdate", () => {
      if (!audio.duration) return;
      const prog = (audio.currentTime / audio.duration) * 100;
      setProgress(prog);
      // Auto-scroll every 3 seconds of audio
      if (audio.currentTime - lastScrolledAt >= 3) {
        lastScrolledAt = audio.currentTime;
        autoScrollToProgress(prog);
      }
    });

    audio.addEventListener("ended", () => {
      setAudioState("idle");
      setProgress(0);
    });

    await audio.play();
    setAudioState("playing");
  } catch {
    setAudioState("idle");
  }
}
```

### handleStop function

```typescript
function handleStop() {
  audioRef.current?.pause();
  if (audioBlobUrlRef.current) {
    URL.revokeObjectURL(audioBlobUrlRef.current);
    audioBlobUrlRef.current = null;
  }
  audioRef.current = null;
  setAudioState("idle");
  setProgress(0);
}
```

Always revoke the blob URL to free memory.

---

## Part 5 — Auto-Scroll as Audio Plays

### Refs

Place two refs in the component — one on the article title, one at the end of the content:

```typescript
const titleRef = useRef<HTMLHeadingElement>(null);
const contentEndRef = useRef<HTMLDivElement>(null);
```

In JSX:

```tsx
<h1 ref={titleRef}>...</h1>

{/* At the very bottom of the article content */}
<div ref={contentEndRef} />
```

### Scroll function

```typescript
function autoScrollToProgress(prog: number) {
  if (!titleRef.current || !contentEndRef.current) return;

  const titleTop = titleRef.current.getBoundingClientRect().top + window.scrollY - 90;
  const endBottom = contentEndRef.current.getBoundingClientRect().bottom + window.scrollY;
  const scrollRange = endBottom - titleTop - window.innerHeight * 0.45;
  const targetY = titleTop + scrollRange * (prog / 100);

  window.scrollTo({ top: Math.max(0, targetY), behavior: "smooth" });
}
```

- The `- 90` offsets for a fixed header height. Adjust to match your layout.
- `window.innerHeight * 0.45` keeps the current reading position in the upper half of the viewport.
- Called every 3 seconds of audio (debounced by `lastScrolledAt` inside the `timeupdate` listener).

---

## Part 6 — 12pm ET Auto-Play Countdown

### Get seconds until target time (Eastern Time)

```typescript
function getSecsUntilNoon(): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => parseInt(parts.find(p => p.type === t)?.value || "0");
  const nowSecs = get("hour") * 3600 + get("minute") * 60 + get("second");
  const targetSecs = 12 * 3600; // 12:00:00
  return nowSecs <= targetSecs ? targetSecs - nowSecs : -1; // -1 = past target today
}
```

### Format countdown display

```typescript
function formatCountdown(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
```

### State and refs

```typescript
const [secsLeft, setSecsLeft] = useState(() => getSecsUntilNoon());
const autoPlayFiredRef = useRef(false); // prevents double-firing on re-renders
```

### Tick every second (admin only)

```typescript
useEffect(() => {
  if (!isAdmin) return;
  const interval = setInterval(() => setSecsLeft(getSecsUntilNoon()), 1000);
  return () => clearInterval(interval);
}, [isAdmin]);
```

### Auto-fire when countdown hits zero

```typescript
useEffect(() => {
  if (!isAdmin || audioState !== "idle" || autoPlayFiredRef.current) return;
  if (secsLeft === 0) {
    autoPlayFiredRef.current = true;
    handleListen();
  }
}, [secsLeft, isAdmin, audioState]);
```

### UI logic

```tsx
{/* More than 5 minutes away — show static label */}
{audioState === "idle" && secsLeft > 300 && (
  <span>Auto-plays at 12:00 PM ET</span>
)}

{/* Within 5 minutes — show live countdown */}
{audioState === "idle" && secsLeft > 0 && secsLeft <= 300 && (
  <span className="animate-pulse text-red-500">
    Auto-plays in {formatCountdown(secsLeft)}
  </span>
)}
```

---

## Part 7 — Public "Tune In" Card

Shown to all non-admin visitors in place of the player:

```tsx
{!isAdmin && (
  <div className="flex items-center gap-3 p-3 rounded-md bg-primary/5 border border-primary/10">
    <Radio className="h-5 w-5 text-primary shrink-0" />
    <div>
      <p className="text-sm font-semibold">Hear This Dispatch Read Live</p>
      <p className="text-xs text-muted-foreground">
        Tune in every day at <strong>12pm EST</strong> on{" "}
        <a href="https://eacd.us" target="_blank" rel="noopener noreferrer">
          eacd.us
        </a>
      </p>
    </div>
  </div>
)}
```

---

## Environment Variables Required

| Variable | Purpose |
|---|---|
| `ADMIN_CODE` | Plain-text admin password. Hashed with SHA-256 server-side. Set via Replit Secrets. |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | Provided automatically by Replit AI Integrations (OpenAI). |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | Provided automatically by Replit AI Integrations (OpenAI). |

---

## Key Decisions & Gotchas

| Topic | Decision |
|---|---|
| TTS model | `gpt-audio` via chat completions — the `/audio/speech` endpoint is NOT supported on Replit's OpenAI proxy |
| Voice | `onyx` — deep broadcast quality |
| Format | `mp3` |
| Chunk size | 2000 characters, split at sentence boundaries |
| Caching | First generation saved as base64 in `audioUrl` DB column; all subsequent plays are instant |
| Blob URL cleanup | Always call `URL.revokeObjectURL()` when stopping or unmounting |
| Auto-play guard | `autoPlayFiredRef` prevents double-firing if the component re-renders at exactly midnight |
| Scroll debounce | Every 3 seconds of audio time (not wall-clock time) — avoids conflicting smooth-scroll calls |
| ET timezone | Uses `Intl.DateTimeFormat` with `timeZone: "America/New_York"` — correctly handles EST/EDT daylight saving automatically |

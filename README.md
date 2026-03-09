# cf_ai_edge_debugger

> AI-powered log analysis tool built entirely on Cloudflare's edge stack — Workers, Durable Objects, and Workers AI (Llama 3.1).

Paste any application log and get instant, structured debugging insights: root causes, highlighted errors and warnings, and concrete fix suggestions — all running at the edge with persistent session memory.

---

## Architecture

```
Browser (frontend/)
    │
    ├── POST /analyze  ──► Cloudflare Worker (src/index.ts)
    │                          ├── Fetch session history  ──► Durable Object (src/durableObject.ts)
    │                          ├── Call Workers AI (Llama 3.1 8B)
    │                          └── Persist log + response ──► Durable Object
    │
    ├── GET  /history  ──► Worker ──► Durable Object
    └── DELETE /history ──► Worker ──► Durable Object
```

| Layer | Technology | Role |
|-------|-----------|------|
| Frontend | Vanilla HTML/CSS/JS | Log input, AI output, session sidebar |
| Worker | Cloudflare Workers (TypeScript) | API routing, AI orchestration |
| Memory | Cloudflare Durable Objects | Persistent per-session log + response storage |
| AI | Workers AI — `@cf/meta/llama-3.1-8b-instruct` | Log analysis, root cause detection, fix suggestions |

---

## Features

- **Instant AI analysis** — paste any log, get structured output in seconds
- **Session memory** — the AI has context from your previous logs in the same session, enabling context-aware debugging
- **Color-coded output** — errors (red), warnings (yellow), fixes (green), info (blue)
- **Session history sidebar** — browse and reload previous analyses from the Durable Object
- **Keyboard shortcut** — `Ctrl+Enter` / `Cmd+Enter` to analyze
- **Persistent storage** — logs and AI responses stored server-side via Durable Objects, survive page reloads

---

## Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) v4+ — `npm install -g wrangler`
- A Cloudflare account (free tier works)
- Logged in: `wrangler login`

---

## Running Locally

```bash
# 1. Clone the repo
git clone https://github.com/<your-username>/cf_ai_edge_debugger
cd cf_ai_edge_debugger

# 2. Install dependencies
npm install

# 3. Start local dev server (Workers AI runs remotely even in dev mode)
npm run dev
# or: wrangler dev
```

Open your browser at **http://localhost:8787**.

> **Note:** Workers AI always calls Cloudflare's remote inference API even during local development. You must be logged in with `wrangler login` for it to work.

---

## Deploying to Cloudflare

```bash
npm run deploy
# or: wrangler deploy
```

Wrangler will print your live Worker URL, e.g. `https://cf-ai-edge-debugger.<your-subdomain>.workers.dev`.

---

## Project Structure

```
cf_ai_edge_debugger/
├── src/
│   ├── index.ts          # Worker entry point — routing, AI orchestration
│   └── durableObject.ts  # Durable Object — session log storage
├── frontend/
│   ├── index.html        # UI layout and styles
│   └── main.js           # Fetch calls, color-coding, session sidebar
├── wrangler.jsonc         # Cloudflare Worker config (DO, AI, Assets bindings)
├── tsconfig.json
├── PROMPTS.md            # AI prompts used during development
└── README.md
```

---

## API Reference

| Method | Path | Body | Description |
|--------|------|------|-------------|
| `POST` | `/analyze` | `{ "log": "..." }` | Analyze a log with AI, store in session |
| `GET` | `/history` | — | Return all session entries from Durable Object |
| `DELETE` | `/history` | — | Clear the current session |

---

## How It Works

1. User pastes a log and clicks **Analyze Logs**
2. `POST /analyze` is sent to the Cloudflare Worker
3. The Worker fetches the last 5 session entries from the Durable Object for context
4. It builds a message history and calls `@cf/meta/llama-3.1-8b-instruct` via Workers AI
5. The AI returns structured analysis (Root Cause / Errors & Warnings / Suggested Fixes)
6. The Worker persists the log + response back to the Durable Object
7. The frontend renders the color-coded output and refreshes the session sidebar

---

## Tech Stack

- **Runtime:** Cloudflare Workers (TypeScript)
- **State:** Cloudflare Durable Objects with SQLite storage
- **AI:** Cloudflare Workers AI — Meta Llama 3.1 8B Instruct
- **Frontend:** Vanilla HTML + CSS + JavaScript
- **Tooling:** Wrangler 4, TypeScript 5

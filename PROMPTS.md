# AI Prompts Used in Development

This file documents the prompts used with Claude (claude-sonnet-4-6) to build `cf_ai_edge_debugger`. The project was developed interactively using Claude Code (Anthropic's CLI).

---

## 1. Diagnosing the Durable Object Export Error

**Prompt:**
> why are we getting `Your Worker depends on the following Durable Objects, which are not exported in your entrypoint file: MyDurableObject` when I run our project?

**What it solved:**
- Identified the mismatch between the exported class name (`DurableObjectSession`) and the `class_name` in `wrangler.jsonc` (`MyDurableObject`)
- Fixed by re-exporting: `export { DurableObjectSession as MyDurableObject }`
- Also caught a binding name mismatch (`LOG_SESSION` vs `MY_DURABLE_OBJECT`) in the `Env` interface

---

## 2. Fixing the "Not Found" Frontend Issue

**Prompt:**
> fix all the issues with my code because when I run it the frontend says Not Found

**What it solved:**
- Stray `x` character before `<!DOCTYPE html>` in `index.html`
- Worker only handled `POST /analyze` and returned 404 for all other routes — the frontend was never served
- Added `assets` binding in `wrangler.jsonc` pointing to `./frontend/`
- Updated the Worker catch-all to call `env.ASSETS.fetch(request)` instead of returning 404
- Fixed AI response field: `aiResponse.output_text` → `aiResponse.response`

---

## 3. Building the Frontend UI

**Prompt:**
> Work on the frontend so I can submit this:
> - Core Idea: log analyzer interface, paste/type logs, hit Analyze, see AI output, view previous logs
> - Layout: header, textarea input, output section with color-coding, session history sidebar
> - UX: Cloudflare developer-tool aesthetic, loading spinner, monospace fonts, scrollable output
> - Color-coded AI suggestions: errors = red, warnings = yellow, suggestions = green
> - Auto-scroll, session history, clear session button

**What was built:**
- Full dark-theme developer UI in `frontend/index.html` with CSS variables, responsive layout, sidebar
- `frontend/main.js` with: color-coded line classification, loading spinner, shake animation on empty submit, `Ctrl+Enter` shortcut, session history with click-to-restore

---

## 4. Completing the Backend (Worker + Durable Object + AI Integration)

**Prompt:**
> Backend Overview (Worker + Durable Object + AI):
> - POST /analyze → save log in DO → call Workers AI Llama 3.3 → return AI response
> - GET /history → retrieve previous logs from Durable Object
> - Durable Object stores previous logs; AI uses session history for context-aware debugging
> - Recruiter-ready: real-time AI analysis, persistent session memory, clean separation

**What was built:**
- Upgraded `durableObject.ts` to store rich `{ log, response, timestamp }` entries and added `DELETE /history`
- Updated `index.ts` to: fetch DO history, inject last 5 entries as AI conversation context, save log+response together, expose `GET /history` and `DELETE /history`
- Updated `frontend/main.js` to load server-side history on page load and sync after each analysis

---

## 5. Fixing the 500 Error (Missing AI Binding)

**Prompt:**
> We got: `❌ Error: Server error 500` — AI analysis isn't producing text.
> The AI binding might not be working / misconfigured. Make sure wrangler.toml includes the Workers AI binding.

**What it solved:**
- Added the missing `"ai": { "binding": "AI" }` block to `wrangler.jsonc` — without this `env.AI` was `undefined` at runtime
- Added top-level try/catch in the Worker returning JSON error responses instead of blank 500s
- Made Durable Object history fetch fault-tolerant (won't crash the request if DO is unavailable)
- Made DO save non-blocking (fire-and-forget with `.catch()`)

---

## 6. Fixing the Invalid Model Error

**Prompt:**
> We got: `❌ Error: 5007: No such model @cf/meta/llama-3.3-70b-instruct or task` — fix it.

**What it solved:**
- `@cf/meta/llama-3.3-70b-instruct` does not exist in the Workers AI catalog
- Replaced with `@cf/meta/llama-3.1-8b-instruct`, the correct available Llama model on Cloudflare Workers AI

---

## System Prompt Used for AI Log Analysis (in Worker)

The following prompt is sent to `@cf/meta/llama-3.1-8b-instruct` on every `/analyze` request:

```
You are an expert developer AI helping debug logs.
Analyze the log provided, identify root causes, highlight errors and warnings,
and suggest concrete fixes. Structure your response with these sections:
## Root Cause
## Errors & Warnings
## Suggested Fixes
```

When session history exists, previous logs and responses are prepended as conversation context (up to the last 5 entries), allowing the AI to give context-aware debugging advice across multiple submissions.

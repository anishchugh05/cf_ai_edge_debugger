import DurableObjectSession from "./durableObject";
import type { LogEntry } from "./durableObject";

export interface Env {
  MY_DURABLE_OBJECT: DurableObjectNamespace;
  AI: Ai;
  ASSETS: Fetcher;
}

export { DurableObjectSession as MyDurableObject };

const JSON_HEADERS = { "Content-Type": "application/json" };

function getStub(env: Env) {
  const id = env.MY_DURABLE_OBJECT.idFromName("main-session");
  return env.MY_DURABLE_OBJECT.get(id);
}

function errorResponse(message: string, status = 500) {
  return new Response(JSON.stringify({ error: message }), { status, headers: JSON_HEADERS });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);

      // ── POST /analyze ───────────────────────────────────────────
      if (request.method === "POST" && url.pathname === "/analyze") {
        const body = await request.json() as { log?: string };
        const logText = body.log?.trim();

        if (!logText) {
          return errorResponse("Missing log field", 400);
        }

        const stub = getStub(env);

        // Fetch previous entries for context-aware AI conversation
        let entries: LogEntry[] = [];
        try {
          const historyRes = await stub.fetch("http://do/history");
          const data: { entries: LogEntry[] } = await historyRes.json();
          entries = data.entries ?? [];
        } catch (e) {
          console.error("Failed to fetch DO history:", e);
        }

        // Build messages with up to 5 previous entries as context
        const messages: { role: string; content: string }[] = [
          {
            role: "system",
            content:
              "You are an expert developer AI helping debug logs. " +
              "Analyze the log provided, identify root causes, highlight errors and warnings, " +
              "and suggest concrete fixes. Structure your response with these sections:\n" +
              "## Root Cause\n## Errors & Warnings\n## Suggested Fixes",
          },
        ];

        const recentEntries = entries.slice(-5);
        if (recentEntries.length > 0) {
          const context = recentEntries
            .map((e, i) => `[Previous log ${i + 1}]:\n${e.log}\n[Previous analysis ${i + 1}]:\n${e.response}`)
            .join("\n\n");
          messages.push({ role: "user", content: `Context from this session:\n\n${context}` });
          messages.push({ role: "assistant", content: "Understood. Ready for the new log." });
        }

        messages.push({ role: "user", content: logText });

        // Call Workers AI
        const aiResponse = await env.AI.run("@cf/meta/llama-3.1-8b-instruct" as any, { messages });
        const responseText: string = (aiResponse as any).response ?? "No response from AI.";

        // Persist log + response to Durable Object (non-blocking on failure)
        stub.fetch("http://do/save", {
          method: "POST",
          body: JSON.stringify({ log: logText, response: responseText }),
        }).catch(e => console.error("Failed to save to DO:", e));

        return new Response(JSON.stringify({ response: responseText }), { headers: JSON_HEADERS });
      }

      // ── GET /history ──────────────────────────────────────────
      if (request.method === "GET" && url.pathname === "/history") {
        const stub = getStub(env);
        const res = await stub.fetch("http://do/history");
        const data = await res.json();
        return new Response(JSON.stringify(data), { headers: JSON_HEADERS });
      }

      // ── DELETE /history ───────────────────────────────────────
      if (request.method === "DELETE" && url.pathname === "/history") {
        const stub = getStub(env);
        await stub.fetch("http://do/history", { method: "DELETE" });
        return new Response(JSON.stringify({ ok: true }), { headers: JSON_HEADERS });
      }

      // ── Serve static frontend assets ──────────────────────────
      return env.ASSETS.fetch(request);

    } catch (err: any) {
      console.error("Worker error:", err);
      return errorResponse(err?.message ?? "Internal server error");
    }
  },
};

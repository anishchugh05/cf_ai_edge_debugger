export interface LogEntry {
  log: string;
  response: string;
  timestamp: string;
}

export default class DurableObjectSession {
  state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // POST /save — persist { log, response } entry
    if (request.method === "POST" && url.pathname === "/save") {
      const data = await request.json() as { log: string; response: string };
      const entries = (await this.state.storage.get<LogEntry[]>("entries")) || [];
      entries.push({ log: data.log, response: data.response, timestamp: new Date().toISOString() });
      await this.state.storage.put("entries", entries);
      return new Response("Saved");
    }

    // GET /history — return all entries
    if (request.method === "GET" && url.pathname === "/history") {
      const entries = (await this.state.storage.get<LogEntry[]>("entries")) || [];
      return new Response(JSON.stringify({ entries }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // DELETE /history — clear all entries
    if (request.method === "DELETE" && url.pathname === "/history") {
      await this.state.storage.delete("entries");
      return new Response("Cleared");
    }

    return new Response("Not Found", { status: 404 });
  }
}

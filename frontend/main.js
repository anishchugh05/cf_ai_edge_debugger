const logInput        = document.getElementById("logInput");
const analyzeBtn      = document.getElementById("analyzeBtn");
const clearBtn        = document.getElementById("clearBtn");
const clearSessionBtn = document.getElementById("clearSessionBtn");
const output          = document.getElementById("output");
const spinner         = document.getElementById("spinner");
const btnText         = document.getElementById("btnText");
const statusDot       = document.getElementById("statusDot");
const charCount       = document.getElementById("charCount");
const sessionList     = document.getElementById("sessionList");

// ── Boot: load server-side session history ───────────────────────
loadHistory();

// ── Character counter ────────────────────────────────────────────
logInput.addEventListener("input", () => {
  const len = logInput.value.length;
  charCount.textContent = `${len.toLocaleString()} character${len !== 1 ? "s" : ""}`;
});

// ── Clear input ──────────────────────────────────────────────────
clearBtn.addEventListener("click", () => {
  logInput.value = "";
  charCount.textContent = "0 characters";
  logInput.focus();
});

// ── Clear session (server + sidebar) ────────────────────────────
clearSessionBtn.addEventListener("click", async () => {
  await fetch("/history", { method: "DELETE" });
  renderHistory([]);
});

// ── Analyze (click or Ctrl+Enter) ───────────────────────────────
analyzeBtn.addEventListener("click", analyze);
logInput.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") analyze();
});

async function analyze() {
  const log = logInput.value.trim();
  if (!log) { shakeInput(); return; }

  setLoading(true);
  renderOutput("⏳ Analyzing your logs…", "loading");

  try {
    const res = await fetch("/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ log }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Server error ${res.status}`);
    }

    const { response } = await res.json();
    renderOutput(response, "success");

    // Refresh sidebar from server so it stays in sync
    await loadHistory();
  } catch (err) {
    renderOutput(`❌ Error: ${err.message}`, "error");
    console.error(err);
  } finally {
    setLoading(false);
  }
}

// ── Fetch history from server ────────────────────────────────────
async function loadHistory() {
  try {
    const res = await fetch("/history");
    if (!res.ok) return;
    const { entries } = await res.json();
    renderHistory((entries || []).slice().reverse()); // newest first
  } catch {
    // Non-fatal: sidebar just stays empty
  }
}

// ── Loading state ────────────────────────────────────────────────
function setLoading(on) {
  analyzeBtn.disabled = on;
  spinner.style.display = on ? "block" : "none";
  btnText.textContent = on ? "Analyzing…" : "Analyze Logs";
  statusDot.className = "status-dot" + (on ? " loading" : "");
}

// ── Render AI output with color-coding ───────────────────────────
function renderOutput(text, state) {
  if (state === "loading") {
    output.innerHTML = `<div style="color:var(--text-muted);font-style:italic;">${text}</div>`;
    return;
  }

  statusDot.className = "status-dot" + (state === "success" ? " active" : "");

  output.innerHTML = text.split("\n").map(line => {
    return `<div class="${classifyLine(line)}">${escapeHtml(line)}</div>`;
  }).join("");

  output.scrollTop = output.scrollHeight;
}

// ── Classify lines for color-coding ─────────────────────────────
function classifyLine(line) {
  const l = line.toLowerCase();
  if (/\b(error|err|exception|traceback|fatal|critical|failed|failure|refused|crash|undefined|null pointer)\b/.test(l))
    return "line-error";
  if (/\b(warn|warning|deprecated|slow|timeout|retry|caution|missing)\b/.test(l))
    return "line-warning";
  if (/\b(fix|suggest|recommend|resolved|ok|success|solution|should|try|consider|tip|use )\b/.test(l))
    return "line-success";
  if (/\b(root cause|cause|reason|info|note|step|found|detected|→|##|#)\b/.test(l))
    return "line-info";
  return "line-normal";
}

// ── Render session history sidebar ───────────────────────────────
function renderHistory(entries) {
  if (!entries || entries.length === 0) {
    sessionList.innerHTML = `<div class="session-empty">No logs analyzed yet.<br/>Your session history will appear here.</div>`;
    return;
  }

  sessionList.innerHTML = entries.map((item, i) => {
    const time = new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const preview = item.log.replace(/\n/g, " ").slice(0, 60);
    return `
      <div class="session-item" data-index="${i}">
        <div class="item-time">${time}</div>
        <div class="item-preview">${escapeHtml(preview)}${item.log.length > 60 ? "…" : ""}</div>
      </div>
    `;
  }).join("");

  // Bind clicks: restore log + response into view
  sessionList.querySelectorAll(".session-item").forEach(el => {
    el.addEventListener("click", () => {
      const item = entries[parseInt(el.dataset.index)];
      logInput.value = item.log;
      charCount.textContent = `${item.log.length.toLocaleString()} characters`;
      renderOutput(item.response, "success");
    });
  });
}

// ── Helpers ──────────────────────────────────────────────────────
function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function shakeInput() {
  const wrap = logInput.closest(".input-wrap");
  [5, -5, 3, 0].forEach((x, i) =>
    setTimeout(() => { wrap.style.transform = `translateX(${x}px)`; }, i * 80)
  );
  logInput.focus();
}

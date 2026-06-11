/**
 * frontend/src/lib/api.ts
 * Typed API client for the FastAPI backend.
 */

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface Project {
  id: string;
  name: string;
  source_type: "zip" | "github";
  source_url: string | null;
  status: "processing" | "ready" | "failed";
  created_at: string;
}

export interface ConversationTurn {
  id: string;
  question: string;
  answer: string;
  agents_used: string[];
  created_at: string;
}

// ── Projects ────────────────────────────────────────────────────────────────

export async function fetchProjects(): Promise<Project[]> {
  const res = await fetch(`${BASE}/api/upload/projects`);
  if (!res.ok) throw new Error("Failed to fetch projects");
  return res.json();
}

export async function uploadZip(file: File, projectName?: string): Promise<Project> {
  const form = new FormData();
  form.append("file", file);
  form.append("project_name", projectName || file.name.replace(".zip", ""));
  const res = await fetch(`${BASE}/api/upload/zip`, { method: "POST", body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Upload failed");
  }
  return res.json();
}

export async function uploadGitHub(url: string): Promise<Project> {
  const form = new FormData();
  form.append("github_url", url);
  const res = await fetch(`${BASE}/api/upload/github`, { method: "POST", body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Clone failed");
  }
  return res.json();
}

// ── Chat history ─────────────────────────────────────────────────────────────

export async function fetchHistory(projectId: string): Promise<ConversationTurn[]> {
  const res = await fetch(`${BASE}/api/chat/history/${projectId}`);
  if (!res.ok) throw new Error("Failed to fetch history");
  return res.json();
}

// ── Streaming chat ───────────────────────────────────────────────────────────

export type SSEEventType = "status" | "chunk" | "done" | "error";

export interface SSEEvent {
  type: SSEEventType;
  message?: string;   // status, error
  token?: string;     // chunk
  agents_used?: string[]; // done
}

/**
 * Sends a chat question and returns an EventSource-style async iterator.
 * Uses fetch + ReadableStream so we can POST (EventSource only supports GET).
 */
export async function* streamChat(
  projectId: string,
  question: string,
): AsyncGenerator<SSEEvent> {
  const res = await fetch(`${BASE}/api/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project_id: projectId, question }),
  });

  if (!res.ok || !res.body) {
    throw new Error("Stream failed to start");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE lines end with \n\n
    const parts = buffer.split("\n\n");
    buffer = parts.pop() || "";

    for (const part of parts) {
      const line = part.replace(/^data: /, "").trim();
      if (!line) continue;
      try {
        yield JSON.parse(line) as SSEEvent;
      } catch {
        // malformed line, skip
      }
    }
  }
}

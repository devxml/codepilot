/**
 * CodePilot API client — talks to the Express backend.
 */

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("codepilot_token");
}

export function setToken(token: string) {
  localStorage.setItem("codepilot_token", token);
}

export function clearToken() {
  localStorage.removeItem("codepilot_token");
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token) headers.Authorization = `Bearer ${token}`;
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
  }

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    clearToken();
    if (typeof window !== "undefined") window.location.href = "/login";
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string; detail?: string };
    throw new Error(err.error || err.detail || `Request failed (${res.status})`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  repositoryCount?: number;
  createdAt: string;
}

export interface Repository {
  id: string;
  workspaceId: string;
  aiProjectId: string | null;
  name: string;
  description: string | null;
  sourceType: "zip" | "github";
  sourceUrl: string | null;
  status: "processing" | "ready" | "failed";
  languages: Record<string, number> | null;
  fileCount: number;
  functionCount: number;
  classCount: number;
  apiRouteCount: number;
  initialReport: string | null;
  reportGeneratedAt: string | null;
  lastIndexedAt: string | null;
  validationError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChatSession {
  id: string;
  title: string;
  repositoryId: string;
  createdAt: string;
  updatedAt: string;
  _count?: { messages: number };
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  fileReferences?: { filepath: string; lineStart?: number; lineEnd?: number }[];
  agentsUsed?: string[];
  createdAt: string;
}

export interface DashboardStats {
  stats: {
    repositories: number;
    totalChats: number;
  };
  workspaces: Workspace[];
  recentChats: ChatSession[];
  recentActivity: { action: string; createdAt: string }[];
}

// Legacy alias for existing components
export type Project = Repository;

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function register(email: string, password: string, name?: string) {
  const result = await apiFetch<{ token: string; user: User & { workspaces: Workspace[] } }>(
    "/api/auth/register",
    { method: "POST", body: JSON.stringify({ email, password, name }) },
  );
  setToken(result.token);
  return result;
}

export async function login(email: string, password: string) {
  const result = await apiFetch<{ token: string; user: User & { workspaces: Workspace[] } }>(
    "/api/auth/login",
    { method: "POST", body: JSON.stringify({ email, password }) },
  );
  setToken(result.token);
  return result;
}

export function logout() {
  clearToken();
  window.location.href = "/login";
}

export async function fetchProfile() {
  return apiFetch<User & { workspaces: Workspace[]; subscription: unknown }>("/api/auth/profile");
}

// ── Workspaces ────────────────────────────────────────────────────────────────

export async function fetchWorkspaces() {
  return apiFetch<Workspace[]>("/api/workspaces");
}

export async function createWorkspace(name: string, description?: string) {
  return apiFetch<Workspace>("/api/workspaces", {
    method: "POST",
    body: JSON.stringify({ name, description }),
  });
}

export async function updateWorkspace(id: string, name: string, description?: string) {
  return apiFetch<Workspace>(`/api/workspaces/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ name, description }),
  });
}

export async function deleteWorkspace(id: string) {
  return apiFetch<void>(`/api/workspaces/${id}`, { method: "DELETE" });
}

// ── Repositories ──────────────────────────────────────────────────────────────

export async function fetchRepositories(workspaceId: string) {
  return apiFetch<Repository[]>(`/api/workspaces/${workspaceId}/repositories`);
}

export async function fetchRepository(workspaceId: string, repoId: string) {
  return apiFetch<Repository>(`/api/workspaces/${workspaceId}/repositories/${repoId}`);
}

export async function uploadZip(workspaceId: string, file: File, projectName?: string) {
  const form = new FormData();
  form.append("file", file);
  form.append("project_name", projectName || file.name.replace(".zip", ""));
  return apiFetch<Repository>(`/api/workspaces/${workspaceId}/repositories/upload/zip`, {
    method: "POST",
    body: form,
  });
}

export async function uploadGitHub(workspaceId: string, url: string) {
  return apiFetch<Repository>(`/api/workspaces/${workspaceId}/repositories/upload/github`, {
    method: "POST",
    body: JSON.stringify({ github_url: url }),
  });
}

// ── Chat ──────────────────────────────────────────────────────────────────────

export async function fetchChatSessions(workspaceId: string, repositoryId: string) {
  return apiFetch<ChatSession[]>(
    `/api/workspaces/${workspaceId}/repositories/${repositoryId}/chats`,
  );
}

export async function createChatSession(workspaceId: string, repositoryId: string, title?: string) {
  return apiFetch<ChatSession>(
    `/api/workspaces/${workspaceId}/repositories/${repositoryId}/chats`,
    { method: "POST", body: JSON.stringify({ title }) },
  );
}

export async function renameChatSession(
  workspaceId: string,
  repositoryId: string,
  sessionId: string,
  title: string,
) {
  return apiFetch<ChatSession>(
    `/api/workspaces/${workspaceId}/repositories/${repositoryId}/chats/${sessionId}`,
    { method: "PATCH", body: JSON.stringify({ title }) },
  );
}

export async function deleteChatSession(
  workspaceId: string,
  repositoryId: string,
  sessionId: string,
) {
  return apiFetch<void>(
    `/api/workspaces/${workspaceId}/repositories/${repositoryId}/chats/${sessionId}`,
    { method: "DELETE" },
  );
}

export async function fetchChatHistory(
  workspaceId: string,
  repositoryId: string,
  sessionId: string,
) {
  const session = await apiFetch<ChatSession & { messages: ChatMessage[] }>(
    `/api/workspaces/${workspaceId}/repositories/${repositoryId}/chats/${sessionId}`,
  );
  return session.messages;
}

export async function fetchSuggestedQuestions(
  workspaceId: string,
  repositoryId: string,
) {
  return apiFetch<string[]>(
    `/api/workspaces/${workspaceId}/repositories/${repositoryId}/chats/suggestions`,
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export async function fetchDashboard() {
  return apiFetch<DashboardStats>("/api/dashboard");
}

// ── Subscriptions ─────────────────────────────────────────────────────────────

// ── Streaming chat ────────────────────────────────────────────────────────────

export type SSEEventType = "status" | "chunk" | "done" | "error";

export interface SSEEvent {
  type: SSEEventType;
  message?: string;
  token?: string;
  agents_used?: string[];
}

export async function* streamChat(
  workspaceId: string,
  repositoryId: string,
  sessionId: string,
  question: string,
): AsyncGenerator<SSEEvent> {
  const token = getToken();
  const res = await fetch(
    `${BASE}/api/workspaces/${workspaceId}/repositories/${repositoryId}/chats/${sessionId}/stream`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ question }),
    },
  );

  if (!res.ok || !res.body) {
    const details = await res.json().catch(() => null) as { error?: string; detail?: string } | null;
    throw new Error(details?.error || details?.detail || `Stream failed to start (${res.status})`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE servers and proxies may use either LF or CRLF line endings.
    const parts = buffer.split(/\r?\n\r?\n/);
    buffer = parts.pop() || "";

    for (const part of parts) {
      const line = part.replace(/^data: /, "").trim();
      if (!line) continue;
      try {
        yield JSON.parse(line) as SSEEvent;
      } catch {
        // skip malformed
      }
    }
  }
}


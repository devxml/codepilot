import { env } from "../config/env";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { Prisma } from "@prisma/client";

export async function uploadZipToAI(file: Buffer, projectName: string) {
  const form = new FormData();
  form.append(
    "file",
    new Blob([file], { type: "application/zip" }),
    "repo.zip",
  );
  form.append("project_name", projectName);

  const res = await fetch(`${env.aiServiceUrl}/api/upload/zip`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { detail?: string };
    throw new AppError(res.status, err.detail || "AI ingestion failed");
  }

  return res.json() as Promise<{ project_id: string; name: string; status: string }>;
}

export async function uploadGitHubToAI(githubUrl: string) {
  const form = new FormData();
  form.append("github_url", githubUrl);

  const res = await fetch(`${env.aiServiceUrl}/api/upload/github`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { detail?: string };
    throw new AppError(res.status, err.detail || "AI ingestion failed");
  }

  return res.json() as Promise<{ project_id: string; status: string }>;
}

export interface AIRepositorySync {
  project_id: string;
  file_count: number;
  function_count: number;
  class_count: number;
  api_route_count: number;
  repo_size_bytes: number;
  languages: Record<string, number>;
  files: Array<{
    filename: string;
    filepath: string;
    language: string | null;
    content: string;
    size_bytes: number;
  }>;
  api_routes: Array<{
    method: string;
    path: string;
    filepath: string;
    line_number: number;
  }>;
}

export async function getAIRepositorySync(projectId: string) {
  const res = await fetch(`${env.aiServiceUrl}/api/upload/projects/${projectId}/sync`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { detail?: string };
    throw new AppError(res.status, err.detail || "Could not synchronize repository metadata");
  }
  return res.json() as Promise<AIRepositorySync>;
}

export async function generateAIRepositoryReport(projectId: string) {
  const res = await fetch(`${env.aiServiceUrl}/api/reports/repository`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project_id: projectId }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { detail?: string };
    throw new AppError(res.status, err.detail || "Could not generate repository report");
  }

  return res.json() as Promise<{ report: string; agents_used: string[] }>;
}

export async function streamChatFromAI(projectId: string, question: string) {
  const res = await fetch(`${env.aiServiceUrl}/api/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project_id: projectId, question }),
  });

  if (!res.ok || !res.body) {
    throw new AppError(502, "AI chat stream failed to start");
  }

  return res;
}

export async function getAIProjects() {
  const res = await fetch(`${env.aiServiceUrl}/api/upload/projects`);
  if (!res.ok) return [];
  return res.json();
}

export async function logActivity(
  userId: string,
  action: string,
  repositoryId?: string,
  metadata?: Record<string, unknown>,
) {
  await prisma.activityLog.create({
    data: {
      userId,
      repositoryId,
      action,
      metadata: metadata as Prisma.InputJsonValue | undefined,
    },
  });
}

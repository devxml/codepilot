import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import {
  uploadZipToAI,
  uploadGitHubToAI,
  getAIRepositorySync,
  generateAIRepositoryReport,
  logActivity,
} from "./ai.service";

export async function listRepositories(userId: string, workspaceId: string) {
  const workspace = await prisma.workspace.findFirst({
    where: { id: workspaceId, userId },
  });
  if (!workspace) throw new AppError(404, "Workspace not found");

  return prisma.repository.findMany({
    where: { workspaceId },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getRepository(userId: string, repositoryId: string) {
  const repo = await prisma.repository.findFirst({
    where: { id: repositoryId, workspace: { userId } },
    include: {
      apiRoutes: { orderBy: [{ method: "asc" }, { path: "asc" }] },
      workspace: { select: { id: true, name: true } },
    },
  });

  if (!repo) throw new AppError(404, "Repository not found");
  return repo;
}

export async function uploadZipRepository(
  userId: string,
  workspaceId: string,
  file: Buffer,
  projectName: string,
) {
  const workspace = await prisma.workspace.findFirst({
    where: { id: workspaceId, userId },
  });
  if (!workspace) throw new AppError(404, "Workspace not found");

  const repo = await prisma.repository.create({
    data: {
      workspaceId,
      name: projectName,
      sourceType: "zip",
      status: "processing",
    },
  });

  try {
    const result = await uploadZipToAI(file, projectName);

    await synchronizeIndexedRepository(repo.id, result.project_id, result.status);
    const report = await generateAIRepositoryReport(result.project_id);
    const updated = await markRepositoryReady(repo.id, report.report);

    await logActivity(userId, "repository.indexed", repo.id, { sourceType: "zip", reportGenerated: true });
    return updated;
  } catch (err) {
    const message = err instanceof AppError ? err.message : "Ingestion failed";
    await prisma.repository.update({
      where: { id: repo.id },
      data: { status: "failed", validationError: message },
    });
    throw err;
  }
}

export async function uploadGitHubRepository(
  userId: string,
  workspaceId: string,
  githubUrl: string,
) {
  const workspace = await prisma.workspace.findFirst({
    where: { id: workspaceId, userId },
  });
  if (!workspace) throw new AppError(404, "Workspace not found");

  const name =
    githubUrl.replace(/\/$/, "").split("/").pop()?.replace(".git", "") || "github-repo";

  const repo = await prisma.repository.create({
    data: {
      workspaceId,
      name,
      sourceType: "github",
      sourceUrl: githubUrl,
      status: "processing",
    },
  });

  try {
    const result = await uploadGitHubToAI(githubUrl);

    await synchronizeIndexedRepository(repo.id, result.project_id, result.status);
    const report = await generateAIRepositoryReport(result.project_id);
    const updated = await markRepositoryReady(repo.id, report.report);

    await logActivity(userId, "repository.indexed", repo.id, { sourceType: "github", url: githubUrl, reportGenerated: true });
    return updated;
  } catch (err) {
    const message = err instanceof AppError ? err.message : "Ingestion failed";
    await prisma.repository.update({
      where: { id: repo.id },
      data: { status: "failed", validationError: message },
    });
    throw err;
  }
}

async function synchronizeIndexedRepository(
  repositoryId: string,
  aiProjectId: string,
  aiStatus: string,
) {
  if (aiStatus !== "ready") {
    return prisma.repository.update({
      where: { id: repositoryId },
      data: { aiProjectId, status: "processing" },
    });
  }

  const sync = await getAIRepositorySync(aiProjectId);

  return prisma.$transaction(async (tx) => {
    await tx.repoFile.deleteMany({ where: { repositoryId } });
    await tx.apiRoute.deleteMany({ where: { repositoryId } });

    if (sync.files.length) {
      await tx.repoFile.createMany({
        data: sync.files.map((file) => ({
          repositoryId,
          filename: file.filename,
          filepath: file.filepath,
          language: file.language,
          content: file.content,
          sizeBytes: file.size_bytes,
        })),
      });
    }

    if (sync.api_routes.length) {
      await tx.apiRoute.createMany({
        data: sync.api_routes.map((route) => ({
          repositoryId,
          method: route.method,
          path: route.path,
          filepath: route.filepath,
          lineNumber: route.line_number,
        })),
      });
    }

    return tx.repository.update({
      where: { id: repositoryId },
      data: {
        aiProjectId,
        // The initial report must be complete before chat is enabled.
        status: "processing",
        fileCount: sync.file_count,
        functionCount: sync.function_count,
        classCount: sync.class_count,
        apiRouteCount: sync.api_route_count,
        repoSizeBytes: BigInt(sync.repo_size_bytes),
        languages: sync.languages,
        lastIndexedAt: new Date(),
        validationError: null,
      },
    });
  });
}

async function markRepositoryReady(repositoryId: string, report: string) {
  return prisma.repository.update({
    where: { id: repositoryId },
    data: {
      status: "ready",
      initialReport: report,
      reportGeneratedAt: new Date(),
    },
  });
}

export async function searchRepository(
  userId: string,
  repositoryId: string,
  query: string,
  type?: "file" | "function" | "class" | "api" | "model",
) {
  const repo = await prisma.repository.findFirst({
    where: { id: repositoryId, workspace: { userId } },
  });
  if (!repo) throw new AppError(404, "Repository not found");

  const q = query.toLowerCase();

  if (type === "api" || !type) {
    const routes = await prisma.apiRoute.findMany({
      where: {
        repositoryId,
        OR: [
          { path: { contains: q, mode: "insensitive" } },
          { method: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 50,
    });
    if (type === "api") return { type: "api", results: routes };
  }

  const files = await prisma.repoFile.findMany({
    where: {
      repositoryId,
      OR: [
        { filepath: { contains: q, mode: "insensitive" } },
        { filename: { contains: q, mode: "insensitive" } },
        ...(type !== "file" ? [{ content: { contains: q, mode: "insensitive" as const } }] : []),
      ],
    },
    select: {
      id: true,
      filepath: true,
      filename: true,
      language: true,
      sizeBytes: true,
    },
    take: 50,
  });

  return { type: type || "all", results: files };
}

export async function getFileContent(userId: string, repositoryId: string, filepath: string) {
  const repo = await prisma.repository.findFirst({
    where: { id: repositoryId, workspace: { userId } },
  });
  if (!repo) throw new AppError(404, "Repository not found");

  const file = await prisma.repoFile.findFirst({
    where: { repositoryId, filepath },
  });

  if (!file) throw new AppError(404, "File not found");
  return file;
}

export async function getFileTree(userId: string, repositoryId: string) {
  const repo = await prisma.repository.findFirst({
    where: { id: repositoryId, workspace: { userId } },
  });
  if (!repo) throw new AppError(404, "Repository not found");

  const files = await prisma.repoFile.findMany({
    where: { repositoryId },
    select: { filepath: true, filename: true, language: true, sizeBytes: true },
    orderBy: { filepath: "asc" },
  });

  return buildFileTree(files);
}

interface FileEntry {
  filepath: string;
  filename: string;
  language: string | null;
  sizeBytes: number;
}

interface TreeNode {
  name: string;
  path: string;
  type: "file" | "folder";
  language?: string | null;
  sizeBytes?: number;
  children?: TreeNode[];
}

function buildFileTree(files: FileEntry[]): TreeNode[] {
  const root: TreeNode[] = [];

  for (const file of files) {
    const parts = file.filepath.split("/");
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1;
      const path = parts.slice(0, i + 1).join("/");

      let node = current.find((n) => n.name === part);
      if (!node) {
        node = {
          name: part,
          path,
          type: isFile ? "file" : "folder",
          ...(isFile
            ? { language: file.language, sizeBytes: file.sizeBytes }
            : { children: [] }),
        };
        current.push(node);
      }

      if (!isFile && node.children) {
        current = node.children;
      }
    }
  }

  return root;
}

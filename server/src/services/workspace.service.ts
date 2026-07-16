import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { slugify } from "./auth.service";

export async function listWorkspaces(userId: string) {
  return prisma.workspace.findMany({
    where: { userId },
    include: { _count: { select: { repositories: true, chatSessions: true } } },
    orderBy: { createdAt: "asc" },
  });
}

export async function createWorkspace(userId: string, name: string, description?: string) {
  const baseSlug = slugify(name);
  let slug = baseSlug;
  let counter = 1;

  while (await prisma.workspace.findFirst({ where: { userId, slug } })) {
    slug = `${baseSlug}-${counter++}`;
  }

  return prisma.workspace.create({
    data: { userId, name, slug, description },
  });
}

export async function getWorkspace(userId: string, workspaceId: string) {
  const workspace = await prisma.workspace.findFirst({
    where: { id: workspaceId, userId },
    include: {
      repositories: { orderBy: { updatedAt: "desc" } },
      _count: { select: { chatSessions: true } },
    },
  });

  if (!workspace) {
    throw new AppError(404, "Workspace not found");
  }

  return workspace;
}

export async function updateWorkspace(
  userId: string,
  workspaceId: string,
  data: { name?: string; description?: string },
) {
  const workspace = await prisma.workspace.findFirst({
    where: { id: workspaceId, userId },
  });

  if (!workspace) {
    throw new AppError(404, "Workspace not found");
  }

  return prisma.workspace.update({
    where: { id: workspaceId },
    data,
  });
}

export async function deleteWorkspace(userId: string, workspaceId: string) {
  const workspace = await prisma.workspace.findFirst({
    where: { id: workspaceId, userId },
  });

  if (!workspace) {
    throw new AppError(404, "Workspace not found");
  }

  await prisma.workspace.delete({ where: { id: workspaceId } });
}

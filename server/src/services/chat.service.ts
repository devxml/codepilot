import { prisma } from "../lib/prisma";
import { Prisma } from "@prisma/client";
import { AppError } from "../middleware/errorHandler";
import { streamChatFromAI } from "./ai.service";

export async function listChatSessions(userId: string, repositoryId: string) {
  const repo = await prisma.repository.findFirst({
    where: { id: repositoryId, workspace: { userId } },
  });
  if (!repo) throw new AppError(404, "Repository not found");

  return prisma.chatSession.findMany({
    where: { repositoryId, userId },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { messages: true } } },
  });
}

export async function createChatSession(
  userId: string,
  workspaceId: string,
  repositoryId: string,
  title?: string,
) {
  const repo = await prisma.repository.findFirst({
    where: { id: repositoryId, workspaceId, workspace: { userId } },
  });
  if (!repo) throw new AppError(404, "Repository not found");

  return prisma.chatSession.create({
    data: {
      userId,
      workspaceId,
      repositoryId,
      title: title || "New Chat",
    },
  });
}

export async function getChatSession(userId: string, sessionId: string) {
  const session = await prisma.chatSession.findFirst({
    where: { id: sessionId, userId },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      repository: { select: { id: true, name: true, aiProjectId: true } },
    },
  });

  if (!session) throw new AppError(404, "Chat session not found");
  return session;
}

export async function renameChatSession(userId: string, sessionId: string, title: string) {
  const session = await prisma.chatSession.findFirst({
    where: { id: sessionId, userId },
  });
  if (!session) throw new AppError(404, "Chat session not found");

  return prisma.chatSession.update({
    where: { id: sessionId },
    data: { title },
  });
}

export async function deleteChatSession(userId: string, sessionId: string) {
  const session = await prisma.chatSession.findFirst({
    where: { id: sessionId, userId },
  });
  if (!session) throw new AppError(404, "Chat session not found");

  await prisma.chatSession.delete({ where: { id: sessionId } });
}

export async function streamChat(
  userId: string,
  sessionId: string,
  question: string,
) {
  const session = await prisma.chatSession.findFirst({
    where: { id: sessionId, userId },
    include: { repository: true },
  });

  if (!session) throw new AppError(404, "Chat session not found");
  if (!session.repository.aiProjectId) {
    throw new AppError(400, "Repository is not indexed yet");
  }
  if (session.repository.status !== "ready") {
    throw new AppError(400, "Repository is not ready for chat");
  }

  await prisma.chatMessage.create({
    data: { sessionId, role: "user", content: question },
  });

  const aiResponse = await streamChatFromAI(session.repository.aiProjectId, question);

  return {
    aiResponse,
    sessionId,
    onComplete: async (answer: string, agentsUsed?: string[], fileRefs?: unknown[]) => {
      await prisma.chatMessage.create({
        data: {
          sessionId,
          role: "assistant",
          content: answer,
          agentsUsed: agentsUsed as Prisma.InputJsonValue | undefined,
          fileReferences: fileRefs as Prisma.InputJsonValue | undefined,
        },
      });

      await prisma.chatSession.update({
        where: { id: sessionId },
        data: { updatedAt: new Date() },
      });

    },
  };
}

export const SUGGESTED_QUESTIONS = [
  "Explain the overall architecture of this codebase",
  "What are the main API endpoints and how do they work?",
  "Find potential security vulnerabilities",
  "How does authentication work in this project?",
  "What database models are defined and how do they relate?",
  "Walk me through the folder structure and key modules",
];

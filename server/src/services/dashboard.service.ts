import { prisma } from "../lib/prisma";

export async function getDashboardStats(userId: string) {
  const [repoCount, chatCount, recentChats, recentActivity] = await Promise.all([
    prisma.repository.count({ where: { workspace: { userId } } }),
    prisma.chatMessage.count({
      where: { session: { userId }, role: "assistant" },
    }),
    prisma.chatSession.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: 5,
      include: {
        repository: { select: { id: true, name: true } },
        messages: { take: 1, orderBy: { createdAt: "desc" } },
      },
    }),
    prisma.activityLog.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { repository: { select: { id: true, name: true } } },
    }),
  ]);

  const workspaces = await prisma.workspace.findMany({
    where: { userId },
    include: {
      _count: { select: { repositories: true } },
      repositories: {
        orderBy: { updatedAt: "desc" },
        take: 3,
        select: {
          id: true,
          name: true,
          status: true,
          sourceType: true,
          languages: true,
          fileCount: true,
          lastIndexedAt: true,
          updatedAt: true,
        },
      },
    },
  });

  return {
    stats: {
      repositories: repoCount,
      totalChats: chatCount,
    },
    workspaces,
    recentChats,
    recentActivity,
  };
}

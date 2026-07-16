import { prisma } from "../lib/prisma";

export async function getDashboardStats(userId: string) {
  const [repoCount, chatCount, recentChats, recentActivity, subscription] = await Promise.all([
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
    prisma.userSubscription.findUnique({
      where: { userId },
      include: { plan: true },
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
      chatsUsedThisMonth: subscription?.chatsUsedThisMonth ?? 0,
      chatLimit: subscription?.plan.maxChatsPerMonth ?? null,
      repoLimit: subscription?.plan.maxRepositories ?? null,
      plan: subscription?.plan.displayName ?? "Free",
    },
    workspaces,
    recentChats,
    recentActivity,
  };
}

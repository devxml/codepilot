import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { signToken } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";

const SALT_ROUNDS = 12;

const FREE_PLAN = {
  name: "free",
  displayName: "Free",
  priceMonthly: 0,
  maxRepositories: 3,
  maxChatsPerMonth: 100,
  maxZipSizeMb: 25,
  maxExtractedSizeMb: 100,
  maxSourceFiles: 2000,
  maxSourceFileSizeMb: 1,
};

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50) || "workspace";
}

export async function registerUser(email: string, password: string, name?: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AppError(409, "Email already registered");
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  // A user must always be able to register on a fresh local database. The
  // normal seed remains useful, but registration cannot depend on it running.
  const freePlan = await prisma.subscriptionPlan.upsert({
    where: { name: FREE_PLAN.name },
    update: {},
    create: FREE_PLAN,
  });

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: name || email.split("@")[0],
      subscription: {
        create: {
          planId: freePlan.id,
          status: "active",
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      },
      workspaces: {
        create: {
          name: "My Workspace",
          slug: "my-workspace",
          description: "Default workspace",
        },
      },
    },
    include: {
      workspaces: true,
      subscription: { include: { plan: true } },
    },
  });

  const token = signToken({ userId: user.id, email: user.email });

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      subscription: user.subscription,
      workspaces: user.workspaces,
    },
  };
}

export async function loginUser(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      workspaces: true,
      subscription: { include: { plan: true } },
    },
  });

  if (!user) {
    throw new AppError(401, "Invalid email or password");
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new AppError(401, "Invalid email or password");
  }

  const token = signToken({ userId: user.id, email: user.email });

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      subscription: user.subscription,
      workspaces: user.workspaces,
    },
  };
}

export async function getUserProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      workspaces: { include: { _count: { select: { repositories: true } } } },
      subscription: { include: { plan: true } },
    },
  });

  if (!user) {
    throw new AppError(404, "User not found");
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
    subscription: user.subscription,
    workspaces: user.workspaces.map((w) => ({
      id: w.id,
      name: w.name,
      slug: w.slug,
      description: w.description,
      repositoryCount: w._count.repositories,
      createdAt: w.createdAt,
    })),
  };
}

export async function updateUserProfile(userId: string, data: { name?: string; avatarUrl?: string }) {
  const user = await prisma.user.update({
    where: { id: userId },
    data,
    select: { id: true, email: true, name: true, avatarUrl: true },
  });
  return user;
}

export { slugify };

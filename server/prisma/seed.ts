import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const plans = [
    {
      name: "free",
      displayName: "Free",
      priceMonthly: 0,
      maxRepositories: 3,
      maxChatsPerMonth: 100,
      maxZipSizeMb: 25,
      maxExtractedSizeMb: 100,
      maxSourceFiles: 2000,
      maxSourceFileSizeMb: 1,
    },
    {
      name: "pro",
      displayName: "Pro",
      priceMonthly: 99900, // ₹999 in paise
      maxRepositories: null,
      maxChatsPerMonth: null,
      maxZipSizeMb: 100,
      maxExtractedSizeMb: 500,
      maxSourceFiles: 10000,
      maxSourceFileSizeMb: 5,
    },
  ];

  for (const plan of plans) {
    await prisma.subscriptionPlan.upsert({
      where: { name: plan.name },
      update: plan,
      create: plan,
    });
  }

  console.log("Seeded subscription plans:", plans.map((p) => p.name).join(", "));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

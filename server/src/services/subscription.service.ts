import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { RazorpayProvider } from "./payment/razorpay.provider";

const paymentProvider = new RazorpayProvider();

export async function getPlans() {
  return prisma.subscriptionPlan.findMany({
    orderBy: { priceMonthly: "asc" },
  });
}

export async function getUserSubscription(userId: string) {
  const sub = await prisma.userSubscription.findUnique({
    where: { userId },
    include: { plan: true },
  });

  if (!sub) throw new AppError(404, "Subscription not found");
  return sub;
}

export async function createCheckoutOrder(userId: string, planName: string) {
  const plan = await prisma.subscriptionPlan.findUnique({ where: { name: planName } });
  if (!plan) throw new AppError(404, "Plan not found");
  if (plan.name === "free") throw new AppError(400, "Free plan does not require payment");

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, "User not found");

  const order = await paymentProvider.createOrder({
    amount: plan.priceMonthly,
    currency: "INR",
    receipt: `plan_${plan.name}_${userId.slice(0, 8)}`,
    notes: { userId, planId: plan.id, planName: plan.name },
  });

  await prisma.billingRecord.create({
    data: {
      userId,
      razorpayOrderId: order.id,
      amount: plan.priceMonthly,
      status: "pending",
      description: `Upgrade to ${plan.displayName}`,
    },
  });

  return {
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    keyId: paymentProvider.getKeyId(),
    plan,
  };
}

export async function verifyPayment(
  userId: string,
  orderId: string,
  paymentId: string,
  signature: string,
) {
  const valid = paymentProvider.verifyPayment({ orderId, paymentId, signature });
  if (!valid) throw new AppError(400, "Payment verification failed");

  const billing = await prisma.billingRecord.findFirst({
    where: { userId, razorpayOrderId: orderId },
  });
  if (!billing) throw new AppError(404, "Billing record not found");

  const proPlan = await prisma.subscriptionPlan.findUnique({ where: { name: "pro" } });
  if (!proPlan) throw new AppError(500, "Pro plan not configured");

  await prisma.$transaction([
    prisma.billingRecord.update({
      where: { id: billing.id },
      data: { status: "paid", razorpayPaymentId: paymentId },
    }),
    prisma.userSubscription.update({
      where: { userId },
      data: {
        planId: proPlan.id,
        status: "active",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        chatsUsedThisMonth: 0,
      },
    }),
  ]);

  return getUserSubscription(userId);
}

export async function cancelSubscription(userId: string) {
  const sub = await prisma.userSubscription.findUnique({
    where: { userId },
    include: { plan: true },
  });

  if (!sub) throw new AppError(404, "Subscription not found");
  if (sub.plan.name === "free") throw new AppError(400, "Cannot cancel free plan");

  const freePlan = await prisma.subscriptionPlan.findUnique({ where: { name: "free" } });
  if (!freePlan) throw new AppError(500, "Free plan not configured");

  if (sub.razorpaySubId) {
    await paymentProvider.cancelSubscription(sub.razorpaySubId);
  }

  return prisma.userSubscription.update({
    where: { userId },
    data: {
      planId: freePlan.id,
      status: "cancelled",
      razorpaySubId: null,
    },
    include: { plan: true },
  });
}

export async function getBillingHistory(userId: string) {
  return prisma.billingRecord.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

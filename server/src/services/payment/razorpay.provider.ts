import crypto from "crypto";
import Razorpay from "razorpay";
import { env } from "../../config/env";
import { AppError } from "../../middleware/errorHandler";
import {
  CreateOrderParams,
  PaymentProvider,
  PaymentVerificationParams,
} from "./payment-provider.interface";

export class RazorpayProvider implements PaymentProvider {
  private client: Razorpay | null = null;

  private getClient(): Razorpay {
    if (!env.razorpayKeyId || !env.razorpayKeySecret) {
      throw new AppError(503, "Payment provider not configured");
    }
    if (!this.client) {
      this.client = new Razorpay({
        key_id: env.razorpayKeyId,
        key_secret: env.razorpayKeySecret,
      });
    }
    return this.client;
  }

  getKeyId(): string {
    return env.razorpayKeyId;
  }

  async createOrder(params: CreateOrderParams) {
    const order = await this.getClient().orders.create({
      amount: params.amount,
      currency: params.currency,
      receipt: params.receipt,
      notes: params.notes,
    });

    return {
      id: order.id,
      amount: Number(order.amount),
      currency: order.currency,
    };
  }

  verifyPayment(params: PaymentVerificationParams): boolean {
    const body = `${params.orderId}|${params.paymentId}`;
    const expected = crypto
      .createHmac("sha256", env.razorpayKeySecret)
      .update(body)
      .digest("hex");
    return expected === params.signature;
  }

  async cancelSubscription(subscriptionId: string): Promise<void> {
    await this.getClient().subscriptions.cancel(subscriptionId);
  }
}

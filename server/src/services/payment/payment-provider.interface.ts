export interface CreateOrderParams {
  amount: number;
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
}

export interface PaymentVerificationParams {
  orderId: string;
  paymentId: string;
  signature: string;
}

export interface PaymentProvider {
  getKeyId(): string;
  createOrder(params: CreateOrderParams): Promise<{ id: string; amount: number; currency: string }>;
  verifyPayment(params: PaymentVerificationParams): boolean;
  cancelSubscription(subscriptionId: string): Promise<void>;
}

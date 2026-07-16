import { Router } from "express";
import { AuthRequest, authenticate } from "../middleware/auth";
import {
  getPlans,
  getUserSubscription,
  createCheckoutOrder,
  verifyPayment,
  cancelSubscription,
  getBillingHistory,
} from "../services/subscription.service";

const router = Router();

router.get("/plans", async (_req, res, next) => {
  try {
    const plans = await getPlans();
    res.json(plans);
  } catch (err) {
    next(err);
  }
});

router.use(authenticate);

router.get("/current", async (req: AuthRequest, res, next) => {
  try {
    const sub = await getUserSubscription(req.user!.userId);
    res.json(sub);
  } catch (err) {
    next(err);
  }
});

router.post("/checkout", async (req: AuthRequest, res, next) => {
  try {
    const order = await createCheckoutOrder(req.user!.userId, req.body.plan || "pro");
    res.json(order);
  } catch (err) {
    next(err);
  }
});

router.post("/verify", async (req: AuthRequest, res, next) => {
  try {
    const { orderId, paymentId, signature } = req.body;
    const sub = await verifyPayment(req.user!.userId, orderId, paymentId, signature);
    res.json(sub);
  } catch (err) {
    next(err);
  }
});

router.post("/cancel", async (req: AuthRequest, res, next) => {
  try {
    const sub = await cancelSubscription(req.user!.userId);
    res.json(sub);
  } catch (err) {
    next(err);
  }
});

router.get("/billing", async (req: AuthRequest, res, next) => {
  try {
    const history = await getBillingHistory(req.user!.userId);
    res.json(history);
  } catch (err) {
    next(err);
  }
});

export default router;

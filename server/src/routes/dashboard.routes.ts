import { Router } from "express";
import { AuthRequest, authenticate } from "../middleware/auth";
import { getDashboardStats } from "../services/dashboard.service";

const router = Router();

router.use(authenticate);

router.get("/", async (req: AuthRequest, res, next) => {
  try {
    const stats = await getDashboardStats(req.user!.userId);
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

export default router;

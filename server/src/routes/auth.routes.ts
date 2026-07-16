import { Router, Request, Response, NextFunction } from "express";
import { body, validationResult } from "express-validator";
import { AuthRequest, authenticate } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";
import {
  registerUser,
  loginUser,
  getUserProfile,
  updateUserProfile,
} from "../services/auth.service";

const router = Router();

function validate(req: AuthRequest, _res: Response, next: NextFunction) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    next(new AppError(400, errors.array()[0].msg));
    return;
  }
  next();
}

router.post(
  "/register",
  [
    body("email").isEmail().withMessage("Valid email required"),
    body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters"),
    body("name").optional().isString(),
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await registerUser(req.body.email, req.body.password, req.body.name);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Valid email required"),
    body("password").notEmpty().withMessage("Password required"),
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await loginUser(req.body.email, req.body.password);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

router.get("/profile", authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const profile = await getUserProfile(req.user!.userId);
    res.json(profile);
  } catch (err) {
    next(err);
  }
});

router.patch("/profile", authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const profile = await updateUserProfile(req.user!.userId, {
      name: req.body.name,
      avatarUrl: req.body.avatarUrl,
    });
    res.json(profile);
  } catch (err) {
    next(err);
  }
});

export default router;

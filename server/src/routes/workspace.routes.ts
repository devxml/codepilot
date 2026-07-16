import { NextFunction, Response, Router } from "express";
import { body } from "express-validator";
import { AuthRequest, authenticate } from "../middleware/auth";
import {
  listWorkspaces,
  createWorkspace,
  getWorkspace,
  updateWorkspace,
  deleteWorkspace,
} from "../services/workspace.service";

const router = Router();

router.use(authenticate);

router.get("/", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const workspaces = await listWorkspaces(req.user!.userId);
    res.json(workspaces);
  } catch (err) {
    next(err);
  }
});

router.post(
  "/",
  [body("name").trim().notEmpty().withMessage("Name required")],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const workspace = await createWorkspace(
        req.user!.userId,
        req.body.name,
        req.body.description,
      );
      res.status(201).json(workspace);
    } catch (err) {
      next(err);
    }
  },
);

router.get("/:id", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const workspace = await getWorkspace(req.user!.userId, req.params.id);
    res.json(workspace);
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const workspace = await updateWorkspace(req.user!.userId, req.params.id, {
      name: req.body.name,
      description: req.body.description,
    });
    res.json(workspace);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await deleteWorkspace(req.user!.userId, req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;

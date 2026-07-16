import { Router } from "express";
import multer from "multer";
import { AuthRequest, authenticate } from "../middleware/auth";
import {
  listRepositories,
  getRepository,
  uploadZipRepository,
  uploadGitHubRepository,
  searchRepository,
  getFileContent,
  getFileTree,
} from "../services/repository.service";

const router = Router({ mergeParams: true });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

router.use(authenticate);

router.get("/", async (req: AuthRequest, res, next) => {
  try {
    const repos = await listRepositories(req.user!.userId, req.params.workspaceId);
    res.json(repos);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req: AuthRequest, res, next) => {
  try {
    const repo = await getRepository(req.user!.userId, req.params.id);
    res.json(repo);
  } catch (err) {
    next(err);
  }
});

router.post(
  "/upload/zip",
  upload.single("file"),
  async (req: AuthRequest, res, next) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "ZIP file required" });
        return;
      }
      const repo = await uploadZipRepository(
        req.user!.userId,
        req.params.workspaceId,
        req.file.buffer,
        req.body.project_name || req.file.originalname.replace(".zip", ""),
      );
      res.status(201).json(repo);
    } catch (err) {
      next(err);
    }
  },
);

router.post("/upload/github", async (req: AuthRequest, res, next) => {
  try {
    const { github_url } = req.body;
    if (!github_url?.startsWith("https://github.com")) {
      res.status(400).json({ error: "Only https://github.com URLs are accepted" });
      return;
    }
    const repo = await uploadGitHubRepository(
      req.user!.userId,
      req.params.workspaceId,
      github_url,
    );
    res.status(201).json(repo);
  } catch (err) {
    next(err);
  }
});

router.get("/:id/files", async (req: AuthRequest, res, next) => {
  try {
    const tree = await getFileTree(req.user!.userId, req.params.id);
    res.json(tree);
  } catch (err) {
    next(err);
  }
});

router.get("/:id/files/*", async (req: AuthRequest, res, next) => {
  try {
    const filepath = (req.params as Record<string, string>)["0"] || req.params[0];
    const file = await getFileContent(req.user!.userId, req.params.id, filepath);
    res.json(file);
  } catch (err) {
    next(err);
  }
});

router.get("/:id/search", async (req: AuthRequest, res, next) => {
  try {
    const q = (req.query.q as string) || "";
    const type = req.query.type as "file" | "function" | "class" | "api" | "model" | undefined;
    const results = await searchRepository(req.user!.userId, req.params.id, q, type);
    res.json(results);
  } catch (err) {
    next(err);
  }
});

export default router;

import { Router } from "express";
import { AuthRequest, authenticate } from "../middleware/auth";
import {
  listChatSessions,
  createChatSession,
  getChatSession,
  renameChatSession,
  deleteChatSession,
  streamChat,
  SUGGESTED_QUESTIONS,
} from "../services/chat.service";

const router = Router({ mergeParams: true });

router.use(authenticate);

router.get("/suggestions", (_req, res) => {
  res.json(SUGGESTED_QUESTIONS);
});

router.get("/", async (req: AuthRequest, res, next) => {
  try {
    const sessions = await listChatSessions(req.user!.userId, req.params.repositoryId);
    res.json(sessions);
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req: AuthRequest, res, next) => {
  try {
    const session = await createChatSession(
      req.user!.userId,
      req.params.workspaceId,
      req.params.repositoryId,
      req.body.title,
    );
    res.status(201).json(session);
  } catch (err) {
    next(err);
  }
});

router.get("/:sessionId", async (req: AuthRequest, res, next) => {
  try {
    const session = await getChatSession(req.user!.userId, req.params.sessionId);
    res.json(session);
  } catch (err) {
    next(err);
  }
});

router.patch("/:sessionId", async (req: AuthRequest, res, next) => {
  try {
    const session = await renameChatSession(
      req.user!.userId,
      req.params.sessionId,
      req.body.title,
    );
    res.json(session);
  } catch (err) {
    next(err);
  }
});

router.delete("/:sessionId", async (req: AuthRequest, res, next) => {
  try {
    await deleteChatSession(req.user!.userId, req.params.sessionId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.post("/:sessionId/stream", async (req: AuthRequest, res, next) => {
  try {
    const { question } = req.body;
    if (!question?.trim()) {
      res.status(400).json({ error: "Question required" });
      return;
    }

    const { aiResponse, onComplete } = await streamChat(
      req.user!.userId,
      req.params.sessionId,
      question.trim(),
    );

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const reader = aiResponse.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullAnswer = "";
    let agentsUsed: string[] = [];

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;
      res.write(chunk);

      const lines = buffer.split("\n\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const data = line.replace(/^data: /, "").trim();
        if (!data) continue;
        try {
          const event = JSON.parse(data) as {
            type: string;
            token?: string;
            agents_used?: string[];
          };
          if (event.type === "chunk" && event.token) {
            fullAnswer += event.token;
          }
          if (event.type === "done" && event.agents_used) {
            agentsUsed = event.agents_used;
          }
        } catch {
          // skip malformed SSE
        }
      }
    }

    await onComplete(fullAnswer.trim(), agentsUsed);
    res.end();
  } catch (err) {
    next(err);
  }
});

export default router;

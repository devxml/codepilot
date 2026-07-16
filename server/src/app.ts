import express from "express";
import cors from "cors";
import { env } from "./config/env";
import { errorHandler } from "./middleware/errorHandler";
import authRoutes from "./routes/auth.routes";
import workspaceRoutes from "./routes/workspace.routes";
import repositoryRoutes from "./routes/repository.routes";
import chatRoutes from "./routes/chat.routes";
import subscriptionRoutes from "./routes/subscription.routes";
import dashboardRoutes from "./routes/dashboard.routes";

const app = express();

app.use(cors({ origin: env.corsOrigins, credentials: true }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "codepilot-api" });
});

app.use("/api/auth", authRoutes);
app.use("/api/workspaces", workspaceRoutes);
app.use("/api/workspaces/:workspaceId/repositories", repositoryRoutes);
app.use(
  "/api/workspaces/:workspaceId/repositories/:repositoryId/chats",
  chatRoutes,
);
app.use("/api/subscriptions", subscriptionRoutes);
app.use("/api/dashboard", dashboardRoutes);

app.use(errorHandler);

export default app;

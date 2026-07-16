"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bot,
  Boxes,
  GitBranch,
  Loader2,
  LogOut,
  MessageSquare,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  Zap,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import UploadPanel from "@/components/UploadPanel";
import ProjectSelector from "@/components/ProjectSelector";
import ChatInterface from "@/components/ChatInterface";
import {
  createWorkspace,
  deleteWorkspace,
  fetchDashboard,
  fetchWorkspaces,
  updateWorkspace,
  DashboardStats,
  Project,
} from "@/lib/api";

export default function DashboardPage() {
  const router = useRouter();
  const { user, workspaces, loading: authLoading, logout, setWorkspaces } = useAuth();
  const [dashboard, setDashboard] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceError, setWorkspaceError] = useState("");
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [repositoryRefreshKey, setRepositoryRefreshKey] = useState(0);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }

    fetchDashboard()
      .then(setDashboard)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user, authLoading, router]);

  if (authLoading || loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 size={32} className="animate-spin text-accent" />
      </div>
    );
  }

  const stats = dashboard?.stats;

  const refreshWorkspaceData = async () => {
    const [nextWorkspaces, nextDashboard] = await Promise.all([
      fetchWorkspaces(),
      fetchDashboard(),
    ]);
    setWorkspaces(nextWorkspaces);
    setDashboard(nextDashboard);
  };

  const handleCreateWorkspace = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = workspaceName.trim();
    if (!name) return;

    setWorkspaceError("");
    try {
      await createWorkspace(name);
      setWorkspaceName("");
      setCreatingWorkspace(false);
      await refreshWorkspaceData();
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : "Could not create workspace");
    }
  };

  const handleRenameWorkspace = async (id: string, currentName: string) => {
    const name = window.prompt("Workspace name", currentName)?.trim();
    if (!name || name === currentName) return;
    try {
      await updateWorkspace(id, name);
      await refreshWorkspaceData();
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : "Could not rename workspace");
    }
  };

  const handleDeleteWorkspace = async (id: string) => {
    if (!window.confirm("Delete this workspace and all of its repositories?")) return;
    try {
      await deleteWorkspace(id);
      if (selectedWorkspaceId === id) setSelectedWorkspaceId(null);
      await refreshWorkspaceData();
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : "Could not delete workspace");
    }
  };

  const selectedWorkspace = workspaces.find((workspace) => workspace.id === selectedWorkspaceId);

  return (
    <div className="min-h-screen bg-bg text-text">
      <div className="pointer-events-none fixed inset-0 code-grid opacity-40" />

      <header className="sticky top-0 z-30 border-b border-white/10 bg-bg/72 px-6 py-4 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06]">
            <Bot size={20} className="text-cyan" />
          </div>
          <div>
            <h1 className="text-base font-bold">CodePilot</h1>
            <p className="text-xs text-text-dim">Developer Intelligence Platform</p>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <span className="hidden rounded-full border border-accent/20 bg-accent/10 px-3 py-1.5 text-xs font-semibold text-violet-200 sm:inline-flex">
              <Zap size={12} className="mr-1.5" />
              {stats?.plan || "Free"} Plan
            </span>
            <span className="text-sm text-text-dim">{user?.name || user?.email}</span>
            <button
              onClick={logout}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-text-dim hover:text-text"
              title="Sign out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold">
            Welcome back{user?.name ? `, ${user.name}` : ""}
          </h2>
          <p className="mt-1 text-text-dim">Your developer intelligence dashboard</p>
        </div>

        {/* Stats */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Repositories", value: stats?.repositories ?? 0, icon: GitBranch },
            {
              label: "AI Chats",
              value: stats?.totalChats ?? 0,
              icon: MessageSquare,
            },
            {
              label: "Chats This Month",
              value: `${stats?.chatsUsedThisMonth ?? 0}${stats?.chatLimit ? ` / ${stats.chatLimit}` : ""}`,
              icon: Sparkles,
            },
            { label: "Workspaces", value: workspaces.length, icon: Boxes },
          ].map((stat) => (
            <div key={stat.label} className="premium-card rounded-2xl p-5">
              <stat.icon size={18} className="text-accent" />
              <p className="mt-3 text-2xl font-bold">{stat.value}</p>
              <p className="text-sm text-text-dim">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Workspaces */}
        <div className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-bold">Workspaces</h3>
            <button
              onClick={() => {
                setCreatingWorkspace((value) => !value);
                setWorkspaceError("");
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium transition hover:bg-white/[0.08]"
            >
              <Plus size={14} />
              Create Workspace
            </button>
          </div>

          {(creatingWorkspace || workspaces.length === 0) && (
            <form onSubmit={handleCreateWorkspace} className="mb-4 flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
              <input
                autoFocus
                value={workspaceName}
                onChange={(event) => setWorkspaceName(event.target.value)}
                placeholder="Workspace name"
                className="min-w-[220px] flex-1 rounded-xl border border-white/10 bg-bg/60 px-3 py-2 text-sm outline-none focus:border-accent/50"
              />
              <button type="submit" className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white">
                Create
              </button>
              {workspaceError && <p className="w-full text-sm text-red-300">{workspaceError}</p>}
            </form>
          )}

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {workspaces.map((ws) => {
              const wsData = dashboard?.workspaces.find((w) => w.id === ws.id);
              const repos = (wsData as { repositories?: Repository[] })?.repositories || [];

              return (
                <div
                  key={ws.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setSelectedWorkspaceId(ws.id);
                    setSelectedProject(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") setSelectedWorkspaceId(ws.id);
                  }}
                  className={`premium-card cursor-pointer rounded-2xl p-5 transition hover:-translate-y-0.5 hover:border-accent/30 ${
                    selectedWorkspaceId === ws.id ? "border-accent/50 bg-accent/10" : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <Boxes size={18} className="text-cyan" />
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-text-dim">{ws.repositoryCount ?? 0} repos</span>
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          handleRenameWorkspace(ws.id, ws.name);
                        }}
                        className="text-text-dim hover:text-text"
                        title="Rename workspace"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          handleDeleteWorkspace(ws.id);
                        }}
                        className="text-text-dim hover:text-red-300"
                        title="Delete workspace"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <h4 className="mt-3 font-bold">{ws.name}</h4>
                  {ws.description && (
                    <p className="mt-1 text-sm text-text-dim line-clamp-2">{ws.description}</p>
                  )}
                  {repos.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {repos.slice(0, 2).map((repo) => (
                        <div
                          key={repo.id}
                          className="flex items-center gap-2 rounded-lg bg-white/[0.04] px-3 py-2 text-xs"
                        >
                          <GitBranch size={12} className="text-text-dim" />
                          <span className="truncate">{repo.name}</span>
                          <span
                            className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              repo.status === "ready"
                                ? "bg-green/10 text-green"
                                : repo.status === "failed"
                                  ? "bg-red-500/10 text-red-300"
                                  : "bg-yellow/10 text-yellow"
                            }`}
                          >
                            {repo.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {workspaceError && !creatingWorkspace && <p className="mt-3 text-sm text-red-300">{workspaceError}</p>}
        </div>

        {selectedWorkspace && (
          <section className="mb-8 rounded-2xl border border-white/10 bg-white/[0.025] p-5">
            <div className="mb-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-dim">Selected workspace</p>
              <h3 className="mt-1 text-lg font-bold">{selectedWorkspace.name}</h3>
            </div>
            <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
              <UploadPanel
                workspaceId={selectedWorkspace.id}
                onProjectReady={(project) => {
                  setSelectedProject(project);
                  setRepositoryRefreshKey((value) => value + 1);
                  refreshWorkspaceData().catch(console.error);
                }}
              />
              <ProjectSelector
                key={`${selectedWorkspace.id}-${repositoryRefreshKey}`}
                workspaceId={selectedWorkspace.id}
                selectedId={selectedProject?.id ?? null}
                onSelect={setSelectedProject}
              />
            </div>
          </section>
        )}

        {selectedProject && selectedWorkspace && (
          <section className="mb-8 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025]">
            {selectedProject.status === "ready" ? (
              <div className="h-[720px]">
                <ChatInterface
                  key={selectedProject.id}
                  projectId={selectedProject.id}
                  projectName={selectedProject.name}
                  workspaceId={selectedWorkspace.id}
                />
              </div>
            ) : (
              <div className="p-6">
                <h3 className="font-bold">{selectedProject.name}</h3>
                <p className="mt-2 text-sm text-text-dim">
                  {selectedProject.status === "processing"
                    ? "Repository indexing is in progress. Chat will become available when indexing finishes."
                    : selectedProject.validationError || "Repository indexing failed. Please import it again."}
                </p>
              </div>
            )}
          </section>
        )}

        {/* Recent Activity */}
        {dashboard?.recentActivity && dashboard.recentActivity.length > 0 && (
          <div>
            <h3 className="mb-4 text-lg font-bold">Recent Activity</h3>
            <div className="glass-panel rounded-2xl divide-y divide-white/5">
              {dashboard.recentActivity.map((activity, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3 text-sm">
                  <Sparkles size={14} className="text-accent" />
                  <span>{activity.action.replace(/\./g, " ")}</span>
                  <span className="ml-auto text-xs text-text-dim">
                    {new Date(activity.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

interface Repository {
  id: string;
  name: string;
  status: string;
}

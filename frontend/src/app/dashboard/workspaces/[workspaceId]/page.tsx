"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Bot, FileText, Loader2, LogOut } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useAuth } from "@/context/AuthContext";
import UploadPanel from "@/components/UploadPanel";
import ProjectSelector from "@/components/ProjectSelector";
import ChatInterface from "@/components/ChatInterface";
import { fetchWorkspaces, Project } from "@/lib/api";

export default function WorkspacePage() {
  const params = useParams<{ workspaceId: string }>();
  const router = useRouter();
  const { user, workspaces, loading: authLoading, logout, setWorkspaces } = useAuth();
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [repositoryRefreshKey, setRepositoryRefreshKey] = useState(0);
  const workspace = workspaces.find((item) => item.id === params.workspaceId);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login");
    } else if (!workspace) {
      router.replace("/dashboard");
    }
  }, [authLoading, router, user, workspace]);

  if (authLoading || !workspace) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg">
        <Loader2 size={32} className="animate-spin text-accent" />
      </div>
    );
  }

  const refreshWorkspaces = async () => setWorkspaces(await fetchWorkspaces());

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
            <p className="text-xs text-text-dim">Workspace</p>
          </div>
          <div className="ml-auto flex items-center gap-3">
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
        <button
          onClick={() => router.push("/dashboard")}
          className="mb-5 inline-flex items-center gap-2 text-sm text-text-dim transition hover:text-text"
        >
          <ArrowLeft size={16} /> Back to dashboard
        </button>
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-dim">Workspace</p>
          <h2 className="mt-1 text-2xl font-bold">{workspace.name}</h2>
          {workspace.description && <p className="mt-1 text-text-dim">{workspace.description}</p>}
        </div>

        <section className="mb-8 grid gap-5 lg:grid-cols-[360px_1fr]">
          <UploadPanel
            workspaceId={workspace.id}
            onProjectReady={(project) => {
              setSelectedProject(project);
              setRepositoryRefreshKey((value) => value + 1);
              refreshWorkspaces().catch(console.error);
            }}
          />
          <ProjectSelector
            key={`${workspace.id}-${repositoryRefreshKey}`}
            workspaceId={workspace.id}
            selectedId={selectedProject?.id ?? null}
            onSelect={setSelectedProject}
          />
        </section>

        {selectedProject && (
          <section className="mb-8 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025]">
            {selectedProject.status === "ready" ? (
              <div>
                <article className="border-b border-white/10 bg-white/[0.025] px-5 py-6 sm:px-7">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan/20 bg-cyan/10 text-cyan">
                      <FileText size={18} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-dim">Repository report</p>
                      <h3 className="mt-1 text-base font-bold">{selectedProject.name}</h3>
                    </div>
                  </div>
                  <div className="prose-dark max-w-none text-sm leading-6 text-text">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {selectedProject.initialReport || "The repository was indexed, but its initial report is unavailable."}
                    </ReactMarkdown>
                  </div>
                </article>
                <div className="h-[720px]">
                  <ChatInterface
                    key={selectedProject.id}
                    projectId={selectedProject.id}
                    projectName={selectedProject.name}
                    workspaceId={workspace.id}
                  />
                </div>
              </div>
            ) : (
              <div className="p-6">
                <h3 className="font-bold">{selectedProject.name}</h3>
                <p className="mt-2 text-sm text-text-dim">
                  {selectedProject.status === "processing"
                    ? "Indexing and generating the repository report. Chat will become available once the report is ready."
                    : selectedProject.validationError || "Repository indexing failed. Please import it again."}
                </p>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

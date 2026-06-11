"use client";

import { useState } from "react";
import {
  Bot,
  Boxes,
  BrainCircuit,
  CheckCircle2,
  Code2,
  Github,
  Layers3,
  MessageSquareText,
  SearchCode,
  Sparkles,
  Zap,
} from "lucide-react";
import UploadPanel from "@/components/UploadPanel";
import ProjectSelector from "@/components/ProjectSelector";
import ChatInterface from "@/components/ChatInterface";
import { Project } from "@/lib/api";

export default function HomePage() {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleProjectReady = (project: Project) => {
    setSelectedProject(project);
    setRefreshKey((k) => k + 1);
  };

  return (
    <div className="h-screen overflow-hidden bg-bg text-text">
      <div className="pointer-events-none fixed inset-0 code-grid opacity-40" />

      <header className="sticky top-0 z-30 border-b border-white/10 bg-bg/72 px-4 py-3 backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex max-w-[1500px] items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] shadow-lg shadow-accent/10">
            <Bot size={20} className="text-cyan" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-bold leading-tight tracking-normal text-text">
              CodePilot
            </h1>
            <p className="hidden text-xs font-medium text-text-dim sm:block">
              Understand Any Codebase Instantly
            </p>
          </div>

          <div className="ml-auto hidden items-center gap-2 lg:flex">
            <span className="inline-flex items-center gap-2 rounded-full border border-green/20 bg-green/10 px-3 py-1.5 text-xs font-semibold text-green">
              <span className="h-1.5 w-1.5 rounded-full bg-green shadow-[0_0_12px_rgba(52,211,153,0.9)]" />
              {selectedProject ? "Repository ready" : "No repository selected"}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-3 py-1.5 text-xs font-semibold text-violet-200">
              <Zap size={13} className="text-yellow" />
              Groq LLaMA 3
            </span>
          </div>

          <a
            href="https://github.com"
            target="_blank"
            rel="noopener"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-text-dim transition hover:border-white/20 hover:bg-white/[0.08] hover:text-text"
            title="Open GitHub"
          >
            <Github size={18} />
          </a>
        </div>
      </header>

      <div className="relative z-10 mx-auto flex h-[calc(100vh-65px)] max-w-[1500px] flex-col gap-4 p-4 md:flex-row md:p-5">
        <aside className="glass-panel flex max-h-[42vh] w-full flex-col gap-4 overflow-y-auto rounded-2xl p-4 md:max-h-none md:w-[360px] md:flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-dim">
                Workspace
              </p>
              <h2 className="mt-1 text-lg font-bold text-text">
                Repositories
              </h2>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-accent/20 bg-accent/10 text-accent">
              <Boxes size={18} />
            </div>
          </div>
          <UploadPanel onProjectReady={handleProjectReady} />
          <ProjectSelector
            key={refreshKey}
            selectedId={selectedProject?.id ?? null}
            onSelect={setSelectedProject}
          />
        </aside>

        <main className="glass-panel min-h-0 flex-1 overflow-hidden rounded-2xl">
          {selectedProject ? (
            <ChatInterface
              key={selectedProject.id}
              projectId={selectedProject.id}
              projectName={selectedProject.name}
            />
          ) : (
            <Onboarding />
          )}
        </main>
      </div>
    </div>
  );
}

function Onboarding() {
  const steps = [
    { icon: Github, title: "Import Repository", body: "Connect a GitHub URL or upload a ZIP archive." },
    { icon: BrainCircuit, title: "AI Indexes Code", body: "CodePilot chunks, embeds, and prepares your codebase context." },
    { icon: MessageSquareText, title: "Chat With Your Codebase", body: "Ask architecture, security, and implementation questions." },
  ];

  const features = [
    { icon: SearchCode, title: "Semantic code retrieval", body: "Find relevant files and symbols without hunting through folders." },
    { icon: Code2, title: "Engineering-grade answers", body: "Markdown responses, code blocks, and agent context stay readable." },
    { icon: CheckCircle2, title: "Production workflow", body: "Built around ingestion status, repository history, and streaming chat." },
  ];

  return (
    <div className="flex h-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-5xl flex-col justify-center gap-10 px-6 py-10 sm:px-10">
        <div className="grid items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="animate-slide-up">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-3 py-1.5 text-xs font-semibold text-violet-200">
              <Sparkles size={14} className="text-cyan" />
              AI repository intelligence
            </div>
            <h2 className="max-w-3xl text-4xl font-extrabold leading-tight tracking-normal text-text sm:text-5xl">
              Understand Any Codebase Instantly
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-text-dim">
              CodePilot turns repositories into conversational knowledge. Import a project, let the indexing pipeline prepare the context, then ask deep technical questions with source-aware AI.
            </p>
          </div>

          <div className="premium-card relative overflow-hidden rounded-2xl p-6">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan/60 to-transparent" />
            <div className="flex items-center justify-between border-b border-white/10 pb-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-dim">
                  CodePilot graph
                </p>
                <p className="mt-1 text-sm font-semibold text-text">
                  Retrieval pipeline active
                </p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/15 text-accent">
                <Bot size={22} />
              </div>
            </div>
            <div className="mt-6 space-y-4">
              {["Repository parsed", "Embeddings stored", "Agents ready"].map((label, index) => (
                <div key={label} className="flex items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full border border-green/25 bg-green/10 text-xs font-bold text-green">
                    {index + 1}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-accent to-cyan"
                      style={{ width: `${92 - index * 14}%` }}
                    />
                  </div>
                  <span className="w-28 text-right text-xs font-medium text-text-dim">
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {steps.map((step, index) => (
            <div key={step.title} className="premium-card rounded-2xl p-5 transition hover:-translate-y-0.5 hover:border-accent/30">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.06] text-cyan">
                  <step.icon size={19} />
                </div>
                <span className="text-xs font-bold text-text-dim">0{index + 1}</span>
              </div>
              <h3 className="text-sm font-bold text-text">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-text-dim">{step.body}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {features.map((feature) => (
            <div key={feature.title} className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
              <feature.icon size={19} className="text-accent" />
              <h3 className="mt-4 text-sm font-bold text-text">{feature.title}</h3>
              <p className="mt-2 text-sm leading-6 text-text-dim">{feature.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

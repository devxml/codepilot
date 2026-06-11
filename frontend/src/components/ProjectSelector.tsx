"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  FolderArchive,
  FolderOpen,
  Github,
  RefreshCw,
} from "lucide-react";
import { fetchProjects, Project } from "@/lib/api";
import clsx from "clsx";

interface Props {
  selectedId: string | null;
  onSelect: (project: Project) => void;
}

export default function ProjectSelector({ selectedId, onSelect }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchProjects();
      setProjects(data);
    } catch {
      // Keep the existing quiet failure behavior.
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (projects.length === 0 && !loading) {
    return (
      <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 text-center">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-white/[0.05] text-text-dim">
          <FolderOpen size={18} />
        </div>
        <p className="text-sm font-semibold text-text">No recent repositories</p>
        <p className="mt-1 text-xs leading-5 text-text-dim">
          Imported repositories will appear here.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-text">Recent Repositories</h3>
          <p className="mt-1 text-xs text-text-dim">{projects.length} indexed workspace{projects.length === 1 ? "" : "s"}</p>
        </div>
        <button
          onClick={load}
          className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-text-dim transition hover:border-accent/30 hover:text-text"
          title="Refresh repositories"
        >
          <RefreshCw size={14} className={clsx(loading && "animate-spin")} />
        </button>
      </div>

      <div className="space-y-2">
        {loading && projects.length === 0
          ? Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-[74px] animate-pulse rounded-2xl border border-white/10 bg-white/[0.035]" />
            ))
          : projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                selected={selectedId === project.id}
                onSelect={onSelect}
              />
            ))}
      </div>
    </section>
  );
}

function ProjectCard({
  project,
  selected,
  onSelect,
}: {
  project: Project;
  selected: boolean;
  onSelect: (project: Project) => void;
}) {
  const isGithub = project.source_type === "github";
  const statusMeta = {
    ready: { icon: CheckCircle2, label: "Ready", className: "border-green/20 bg-green/10 text-green" },
    processing: { icon: Clock3, label: "Indexing", className: "border-yellow/20 bg-yellow/10 text-yellow" },
    failed: { icon: AlertCircle, label: "Failed", className: "border-red/20 bg-red/10 text-red" },
  }[project.status];
  const StatusIcon = statusMeta.icon;

  return (
    <button
      onClick={() => onSelect(project)}
      className={clsx(
        "group w-full rounded-2xl border p-3 text-left transition",
        selected
          ? "border-accent/45 bg-accent/12 shadow-lg shadow-accent/10"
          : "border-white/10 bg-white/[0.035] hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.06]",
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={clsx(
            "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border transition",
            selected
              ? "border-accent/35 bg-accent/15 text-accent"
              : "border-white/10 bg-bg/45 text-text-dim group-hover:text-cyan",
          )}
        >
          {isGithub ? <Github size={18} /> : <FolderArchive size={18} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-sm font-bold text-text">{project.name}</p>
            <span className={clsx("inline-flex flex-shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold", statusMeta.className)}>
              <StatusIcon size={11} />
              {statusMeta.label}
            </span>
          </div>
          <p className="mt-1 truncate text-xs text-text-dim">
            {isGithub ? project.source_url || "GitHub repository" : "Uploaded ZIP archive"}
          </p>
        </div>
      </div>
    </button>
  );
}

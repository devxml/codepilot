"use client";

import { useRef, useState, DragEvent } from "react";
import {
  AlertCircle,
  CheckCircle2,
  FolderArchive,
  Github,
  Loader2,
  Upload,
} from "lucide-react";
import { uploadGitHub, uploadZip, Project } from "@/lib/api";
import clsx from "clsx";

interface Props {
  onProjectReady: (project: Project) => void;
  workspaceId?: string;
}

export default function UploadPanel({ onProjectReady, workspaceId }: Props) {
  const [tab, setTab] = useState<"github" | "zip">("github");
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [githubUrl, setGithubUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped?.name.endsWith(".zip")) {
      setError("");
      setSuccess("");
      setFile(dropped);
    } else {
      setError("Please drop a .zip file.");
    }
  };

  const handleSubmit = async () => {
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      if (!workspaceId) throw new Error("Create a workspace before importing a repository.");
      let project: Project;
      if (tab === "zip") {
        if (!file) throw new Error("Select a .zip file first.");
        project = await uploadZip(workspaceId, file);
      } else {
        if (!githubUrl.trim()) throw new Error("Enter a GitHub URL.");
        project = await uploadGitHub(workspaceId, githubUrl.trim());
      }

      setSuccess(`${project.name} is ready.`);
      onProjectReady(project);
    } catch (e: any) {
      setError(e.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-text">Import Repository</h3>
          <p className="mt-1 text-xs leading-5 text-text-dim">
            Add a GitHub repo or upload a ZIP archive.
          </p>
        </div>
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-accent/12 text-accent">
          <Upload size={17} />
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-bg/50 p-1">
        {(["github", "zip"] as const).map((type) => (
          <button
            key={type}
            onClick={() => {
              setTab(type);
              setError("");
              setSuccess("");
            }}
            className={clsx(
              "flex h-9 items-center justify-center gap-2 rounded-lg text-xs font-semibold transition",
              tab === type
                ? "bg-white/[0.09] text-text shadow-sm"
                : "text-text-dim hover:bg-white/[0.04] hover:text-text",
            )}
          >
            {type === "github" ? <Github size={14} /> : <FolderArchive size={14} />}
            {type === "github" ? "GitHub URL" : "ZIP Upload"}
          </button>
        ))}
      </div>

      {tab === "github" ? (
        <div className="space-y-2">
          <label className="text-xs font-semibold text-text-dim" htmlFor="github-url">
            Repository URL
          </label>
          <div className="group flex items-center gap-2 rounded-xl border border-white/10 bg-bg/55 px-3 transition focus-within:border-accent/60 focus-within:bg-bg/80">
            <Github size={16} className="text-text-dim transition group-focus-within:text-accent" />
            <input
              id="github-url"
              type="url"
              placeholder="https://github.com/owner/repo"
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              className="min-w-0 flex-1 bg-transparent py-3 text-sm text-text outline-none placeholder:text-muted"
            />
          </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={clsx(
            "group flex cursor-pointer flex-col items-center rounded-2xl border border-dashed px-4 py-7 text-center transition",
            dragging && "border-accent bg-accent/10",
            file && !dragging && "border-green/35 bg-green/10",
            !file && !dragging && "border-white/15 bg-bg/40 hover:border-accent/45 hover:bg-white/[0.04]",
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip"
            className="hidden"
            onChange={(e) => {
              const nextFile = e.target.files?.[0];
              if (nextFile) {
                setError("");
                setSuccess("");
                setFile(nextFile);
              }
            }}
          />
          <div className={clsx(
            "mb-3 flex h-11 w-11 items-center justify-center rounded-2xl transition",
            file ? "bg-green/15 text-green" : "bg-white/[0.06] text-text-dim group-hover:text-accent",
          )}>
            {file ? <CheckCircle2 size={22} /> : <FolderArchive size={22} />}
          </div>
          {file ? (
            <>
              <p className="max-w-full truncate text-sm font-semibold text-text">{file.name}</p>
              <p className="mt-1 text-xs text-text-dim">{(file.size / 1024).toFixed(1)} KB selected</p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-text">Drop ZIP here</p>
              <p className="mt-1 text-xs text-text-dim">or click to browse your files</p>
            </>
          )}
        </div>
      )}

      {(error || success) && (
        <div
          className={clsx(
            "mt-4 flex items-start gap-2 rounded-xl border px-3 py-2 text-xs leading-5",
            error
              ? "border-red/20 bg-red/10 text-red"
              : "border-green/20 bg-green/10 text-green",
          )}
        >
          {error ? <AlertCircle size={15} className="mt-0.5 flex-shrink-0" /> : <CheckCircle2 size={15} className="mt-0.5 flex-shrink-0" />}
          <span>{error || success}</span>
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={loading}
        className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent-strong to-accent px-4 text-sm font-bold text-white shadow-lg shadow-accent/20 transition hover:-translate-y-0.5 hover:shadow-accent/30 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-55"
      >
        {loading ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Indexing repository
          </>
        ) : (
          <>
            <Upload size={16} />
            Ingest Repository
          </>
        )}
      </button>

      {loading && (
        <div className="mt-3 overflow-hidden rounded-full bg-white/[0.06]">
          <div className="h-1.5 w-2/3 animate-soft-pulse rounded-full bg-gradient-to-r from-accent to-cyan" />
        </div>
      )}
    </section>
  );
}

"use client";

import { Activity, Terminal } from "lucide-react";

interface Props {
  updates: string[];
}

export default function StatusBar({ updates }: Props) {
  if (updates.length === 0) return null;

  return (
    <div className="rounded-2xl border border-cyan/15 bg-cyan/[0.06] p-4 animate-fade-in">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-cyan">
          <Terminal size={13} />
          Agent Activity
        </p>
        <Activity size={15} className="animate-soft-pulse text-cyan" />
      </div>
      <div className="space-y-2">
        {updates.map((message, index) => (
          <div key={`${message}-${index}`} className="flex items-start gap-2 text-xs leading-5 text-text-dim">
            <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-cyan" />
            <p>{message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

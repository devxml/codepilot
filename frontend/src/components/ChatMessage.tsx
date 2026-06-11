"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Bot, Code2, Shield, User } from "lucide-react";
import clsx from "clsx";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  agents_used?: string[];
  isStreaming?: boolean;
}

interface Props {
  message: Message;
}

const AGENT_ICONS: Record<string, React.ReactNode> = {
  code_analysis: <Code2 size={12} />,
  security: <Shield size={12} />,
};

export default function ChatMessage({ message }: Props) {
  const isUser = message.role === "user";

  return (
    <article className={clsx("flex gap-3 animate-slide-up", isUser && "flex-row-reverse")}>
      <div
        className={clsx(
          "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl border",
          isUser
            ? "border-accent/35 bg-accent text-white shadow-lg shadow-accent/20"
            : "border-white/10 bg-white/[0.06] text-cyan",
        )}
      >
        {isUser ? <User size={16} /> : <Bot size={17} />}
      </div>

      <div className={clsx("flex max-w-[88%] flex-col gap-2", isUser && "items-end")}>
        {!isUser && message.agents_used && message.agents_used.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {message.agents_used.map((agent) => (
              <span
                key={agent}
                className="inline-flex items-center gap-1 rounded-full border border-accent/20 bg-accent/10 px-2.5 py-1 text-[11px] font-semibold capitalize text-violet-200"
              >
                {AGENT_ICONS[agent] || <Code2 size={12} />}
                {agent.replace("_", " ")}
              </span>
            ))}
          </div>
        )}

        <div
          className={clsx(
            "rounded-2xl px-4 py-3 text-sm leading-6 shadow-lg",
            isUser
              ? "rounded-tr-md bg-gradient-to-br from-accent-strong to-accent text-white shadow-accent/15"
              : "prose-dark rounded-tl-md border border-white/10 bg-white/[0.055] text-text shadow-black/10",
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ inline, className, children, ...props }: any) {
                  const match = /language-(\w+)/.exec(className || "");
                  return !inline && match ? (
                    <SyntaxHighlighter
                      style={oneDark as any}
                      language={match[1]}
                      PreTag="div"
                      customStyle={{
                        background: "#090b14",
                        border: "1px solid rgba(148, 163, 184, 0.16)",
                        borderRadius: "14px",
                        fontSize: "0.82rem",
                        lineHeight: "1.7",
                        margin: "0.85rem 0",
                        padding: "1rem",
                      }}
                      {...props}
                    >
                      {String(children).replace(/\n$/, "")}
                    </SyntaxHighlighter>
                  ) : (
                    <code className={className} {...props}>
                      {children}
                    </code>
                  );
                },
              }}
            >
              {message.content}
            </ReactMarkdown>
          )}
          {message.isStreaming && (
            <span className="ml-1 inline-block h-4 w-2 animate-blink rounded-full bg-cyan align-middle" />
          )}
        </div>
      </div>
    </article>
  );
}

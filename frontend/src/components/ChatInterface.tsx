"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bot,
  Braces,
  Loader2,
  MessageSquareText,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { streamChat, fetchHistory } from "@/lib/api";
import ChatMessage, { Message } from "./ChatMessage";
import StatusBar from "./StatusBar";

const uid = () => Math.random().toString(36).slice(2);

interface Props {
  projectId: string;
  projectName: string;
}

const SUGGESTED_QUERIES = [
  "Explain the overall architecture of this codebase",
  "Find any security vulnerabilities",
  "Explain the authentication flow",
  "Describe the database schema and data models",
  "Are there any hardcoded secrets or API keys?",
];

export default function ChatInterface({ projectId, projectName }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [statusUpdates, setStatusUpdates] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setMessages([]);
    setStatusUpdates([]);
    fetchHistory(projectId)
      .then((turns) => {
        const nextMessages: Message[] = [];
        turns.forEach((turn) => {
          nextMessages.push({ id: uid(), role: "user", content: turn.question });
          nextMessages.push({
            id: uid(),
            role: "assistant",
            content: turn.answer,
            agents_used: turn.agents_used,
          });
        });
        setMessages(nextMessages);
      })
      .catch(() => {});
  }, [projectId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, statusUpdates]);

  const send = async (question: string) => {
    if (!question.trim() || sending) return;
    setInput("");
    setSending(true);
    setStatusUpdates([]);

    const userMsg: Message = { id: uid(), role: "user", content: question };
    setMessages((prev) => [...prev, userMsg]);

    const assistantId = uid();
    const assistantMsg: Message = {
      id: assistantId,
      role: "assistant",
      content: "",
      isStreaming: true,
      agents_used: [],
    };
    setMessages((prev) => [...prev, assistantMsg]);

    let fullAnswer = "";
    let finalAgents: string[] = [];

    try {
      for await (const event of streamChat(projectId, question)) {
        if (event.type === "status" && event.message) {
          setStatusUpdates((prev) => [...prev, event.message!]);
        } else if (event.type === "chunk" && event.token) {
          fullAnswer += event.token;
          setMessages((prev) =>
            prev.map((message) =>
              message.id === assistantId ? { ...message, content: fullAnswer } : message,
            ),
          );
        } else if (event.type === "done") {
          finalAgents = event.agents_used || [];
        } else if (event.type === "error") {
          fullAnswer = `Warning: ${event.message}`;
          setMessages((prev) =>
            prev.map((message) =>
              message.id === assistantId ? { ...message, content: fullAnswer } : message,
            ),
          );
        }
      }
    } catch (e: any) {
      fullAnswer = `Connection error: ${e.message}`;
      setMessages((prev) =>
        prev.map((message) =>
          message.id === assistantId ? { ...message, content: fullAnswer } : message,
        ),
      );
    }

    setMessages((prev) =>
      prev.map((message) =>
        message.id === assistantId
          ? { ...message, isStreaming: false, agents_used: finalAgents }
          : message,
      ),
    );
    setStatusUpdates([]);
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-white/10 bg-white/[0.025] px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl border border-accent/25 bg-accent/12 text-accent">
              <MessageSquareText size={20} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-dim">
                Repository Chat
              </p>
              <h2 className="mt-1 truncate text-base font-bold text-text">
                {projectName}
              </h2>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan/20 bg-cyan/10 px-3 py-1.5 text-xs font-semibold text-cyan">
              <Braces size={13} />
              Context-aware
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-green/20 bg-green/10 px-3 py-1.5 text-xs font-semibold text-green">
              <ShieldCheck size={13} />
              Agents ready
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        {messages.length === 0 && !sending ? (
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 py-10 text-center animate-fade-in">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-accent shadow-lg shadow-accent/10">
              <Bot size={30} />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-text">Ask CodePilot anything</h3>
              <p className="mt-2 max-w-xl text-sm leading-6 text-text-dim">
                The assistant will retrieve relevant repository context and stream a response as it works through the codebase.
              </p>
            </div>
            <div className="grid w-full gap-2 sm:grid-cols-2">
              {SUGGESTED_QUERIES.map((query) => (
                <button
                  key={query}
                  onClick={() => send(query)}
                  className="group rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-left text-sm font-medium leading-6 text-text-dim transition hover:-translate-y-0.5 hover:border-accent/35 hover:bg-accent/10 hover:text-text"
                >
                  <span className="mb-3 flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.06] text-accent transition group-hover:bg-accent/20">
                    <Sparkles size={15} />
                  </span>
                  {query}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto flex max-w-4xl flex-col gap-5">
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
          </div>
        )}

        {statusUpdates.length > 0 && (
          <div className="mx-auto mt-5 max-w-4xl">
            <StatusBar updates={statusUpdates} />
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="border-t border-white/10 bg-bg/35 p-3 backdrop-blur-xl sm:p-4">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-end gap-3 rounded-2xl border border-white/10 bg-white/[0.05] p-2 shadow-2xl shadow-black/20 transition focus-within:border-accent/55 focus-within:bg-white/[0.07]">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about architecture, risks, data flow, or a specific file..."
              rows={1}
              disabled={sending}
              className="max-h-36 min-h-[44px] flex-1 resize-none bg-transparent px-3 py-3 text-sm leading-6 text-text outline-none placeholder:text-muted disabled:opacity-50"
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = "auto";
                el.style.height = Math.min(el.scrollHeight, 144) + "px";
              }}
            />
            <button
              onClick={() => send(input)}
              disabled={sending || !input.trim()}
              className="mb-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent-strong to-accent text-white shadow-lg shadow-accent/20 transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-35"
              title="Send message"
            >
              {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
          <p className="mt-2 text-center text-xs text-text-dim">
            Powered by Groq, LangGraph, Pinecone, and sentence-transformers
          </p>
        </div>
      </div>
    </div>
  );
}

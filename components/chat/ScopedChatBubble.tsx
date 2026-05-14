"use client";

import { useEffect, useRef, useState } from "react";
import { MessageSquare, X, Send, Check, Sparkles } from "lucide-react";
import { toast } from "@/components/ui/toaster";
import type { Proposal, ScopedChatContext } from "@/lib/ai/scoped-chat-tools";

type ChatMessage =
  | { id: string; role: "user"; content: string }
  | { id: string; role: "assistant"; content: string; proposals: ProposalState[] };

type ProposalState = {
  id: string;
  proposal: Proposal;
  status: "pending" | "applying" | "applied" | "rejected" | "error";
  errorMsg?: string;
};

interface Props {
  projectId: string;
  context: ScopedChatContext;
  /** Called when a proposal applies successfully, so the host page can refetch. */
  onApplied?: (proposal: Proposal) => void;
}

export function ScopedChatBubble({ projectId, context, onApplied }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput("");

    const userMsg: ChatMessage = { id: randId(), role: "user", content: text };
    const assistantId = randId();
    const assistantMsg: ChatMessage = { id: assistantId, role: "assistant", content: "", proposals: [] };
    setMessages((m) => [...m, userMsg, assistantMsg]);

    // Build conversation history for the model (exclude the just-added empty assistant turn).
    const history = messages.map((m) => ({
      role: m.role,
      content:
        m.role === "assistant"
          ? `${m.content}${m.proposals.length ? `\n[proposed ${m.proposals.length} change(s)]` : ""}`
          : m.content,
    }));

    try {
      const res = await fetch("/api/ai/scoped-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId, context, message: text, history }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        updateAssistant(assistantId, (m) => ({
          ...m,
          content: `Error: ${err.error || "request failed"}`,
        }));
        setSending(false);
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.text) {
              updateAssistant(assistantId, (m) => ({ ...m, content: m.content + data.text }));
            }
            if (data.proposal) {
              updateAssistant(assistantId, (m) => ({
                ...m,
                proposals: [
                  ...m.proposals,
                  { id: randId(), proposal: data.proposal as Proposal, status: "pending" },
                ],
              }));
            }
            if (data.error) {
              updateAssistant(assistantId, (m) => ({
                ...m,
                content: (m.content || "") + `\n\nError: ${data.error}`,
              }));
            }
          } catch {}
        }
      }
    } catch (e) {
      updateAssistant(assistantId, (m) => ({
        ...m,
        content: `Network error: ${e instanceof Error ? e.message : String(e)}`,
      }));
    } finally {
      setSending(false);
    }
  };

  const updateAssistant = (id: string, fn: (m: Extract<ChatMessage, { role: "assistant" }>) => Extract<ChatMessage, { role: "assistant" }>) => {
    setMessages((prev) =>
      prev.map((m) => (m.role === "assistant" && m.id === id ? fn(m) : m))
    );
  };

  const applyProposal = async (assistantId: string, proposalId: string) => {
    const target = messages.find((m) => m.role === "assistant" && m.id === assistantId) as
      | Extract<ChatMessage, { role: "assistant" }>
      | undefined;
    const ps = target?.proposals.find((p) => p.id === proposalId);
    if (!ps || ps.status !== "pending") return;

    setProposalStatus(assistantId, proposalId, "applying");

    try {
      const r = await fetch("/api/proposals/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId, proposal: ps.proposal }),
      });
      const body = await r.json();
      if (!r.ok || body.error) {
        setProposalStatus(assistantId, proposalId, "error", body.error || `HTTP ${r.status}`);
        toast({ title: body.error || "Apply failed", variant: "error" });
        return;
      }
      setProposalStatus(assistantId, proposalId, "applied");
      toast({ title: `Applied: ${proposalSummary(ps.proposal)}`, variant: "success" });
      onApplied?.(ps.proposal);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setProposalStatus(assistantId, proposalId, "error", msg);
      toast({ title: msg, variant: "error" });
    }
  };

  const rejectProposal = (assistantId: string, proposalId: string) => {
    setProposalStatus(assistantId, proposalId, "rejected");
  };

  const setProposalStatus = (
    assistantId: string,
    proposalId: string,
    status: ProposalState["status"],
    errorMsg?: string
  ) => {
    updateAssistant(assistantId, (m) => ({
      ...m,
      proposals: m.proposals.map((p) =>
        p.id === proposalId ? { ...p, status, errorMsg } : p
      ),
    }));
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title="Open Atlas chat"
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          width: 52,
          height: 52,
          borderRadius: "50%",
          background: "var(--ac-1)",
          color: "white",
          border: "none",
          cursor: "pointer",
          boxShadow: "0 6px 20px rgba(0,0,0,0.25)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
        }}
      >
        <Sparkles size={22} />
      </button>
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        width: 380,
        maxWidth: "calc(100vw - 32px)",
        height: 560,
        maxHeight: "calc(100vh - 48px)",
        background: "var(--bg-1)",
        border: "1px solid var(--bd-1)",
        borderRadius: 12,
        boxShadow: "0 12px 40px rgba(0,0,0,0.3)",
        display: "flex",
        flexDirection: "column",
        zIndex: 1000,
      }}
    >
      <div
        style={{
          padding: "12px 14px",
          borderBottom: "1px solid var(--bd-1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Sparkles size={16} style={{ color: "var(--ac-1)" }} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>Atlas — {scopeLabel(context)}</span>
        </div>
        <button
          onClick={() => setOpen(false)}
          style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--tx-2)" }}
        >
          <X size={16} />
        </button>
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "12px 14px" }}>
        {messages.length === 0 && (
          <p style={{ fontSize: 12, color: "var(--tx-3)" }}>
            Ask me to edit or add things on this page. I&apos;ll propose changes — you confirm.
            <br />
            <br />
            Examples:
            <br />
            {context.type === "prd" && (
              <>
                &quot;Tighten the goals section&quot;
                <br />
                &quot;Add a non-functional requirement for accessibility&quot;
              </>
            )}
            {context.type === "backlog" && (
              <>
                &quot;Add a story about offline glucose logging&quot;
                <br />
                &quot;Make the onboarding story a must-have&quot;
              </>
            )}
          </p>
        )}

        {messages.map((m) => (
          <div key={m.id} style={{ marginBottom: 14 }}>
            <div
              style={{
                fontSize: 11,
                color: "var(--tx-3)",
                marginBottom: 4,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              {m.role}
            </div>
            <div
              style={{
                fontSize: 13,
                color: "var(--tx-1)",
                whiteSpace: "pre-wrap",
                lineHeight: 1.5,
              }}
            >
              {m.content}
            </div>
            {m.role === "assistant" &&
              m.proposals.map((p) => (
                <ProposalCard
                  key={p.id}
                  state={p}
                  onApply={() => applyProposal(m.id, p.id)}
                  onReject={() => rejectProposal(m.id, p.id)}
                />
              ))}
          </div>
        ))}
      </div>

      <div style={{ padding: "10px 12px", borderTop: "1px solid var(--bd-1)", display: "flex", gap: 8 }}>
        <textarea
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={sending ? "Thinking..." : "Ask Atlas to change this page..."}
          disabled={sending}
          style={{
            flex: 1,
            resize: "none",
            border: "1px solid var(--bd-1)",
            borderRadius: 8,
            padding: "8px 10px",
            fontSize: 13,
            background: "var(--bg-2)",
            color: "var(--tx-1)",
            outline: "none",
            fontFamily: "inherit",
          }}
        />
        <button
          onClick={send}
          disabled={sending || !input.trim()}
          style={{
            background: "var(--ac-1)",
            color: "white",
            border: "none",
            borderRadius: 8,
            padding: "0 12px",
            cursor: sending ? "default" : "pointer",
            opacity: sending || !input.trim() ? 0.5 : 1,
            display: "flex",
            alignItems: "center",
          }}
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}

function ProposalCard({
  state,
  onApply,
  onReject,
}: {
  state: ProposalState;
  onApply: () => void;
  onReject: () => void;
}) {
  const p = state.proposal;
  return (
    <div
      style={{
        marginTop: 8,
        padding: 10,
        background: "var(--bg-2)",
        border: "1px solid var(--bd-1)",
        borderRadius: 8,
      }}
    >
      <div style={{ fontSize: 11, color: "var(--ac-1)", fontWeight: 600, marginBottom: 4 }}>
        PROPOSAL · {p.kind.replace(/_/g, " ")}
      </div>
      <div style={{ fontSize: 12, color: "var(--tx-1)", marginBottom: 6 }}>
        {proposalSummary(p)}
      </div>
      <div style={{ fontSize: 11, color: "var(--tx-3)", marginBottom: 8, fontStyle: "italic" }}>
        {p.rationale}
      </div>
      <ProposalPreview proposal={p} />
      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        {state.status === "pending" && (
          <>
            <button
              onClick={onApply}
              style={{
                background: "var(--ac-1)",
                color: "white",
                border: "none",
                borderRadius: 6,
                padding: "4px 10px",
                fontSize: 12,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Check size={12} /> Apply
            </button>
            <button
              onClick={onReject}
              style={{
                background: "transparent",
                color: "var(--tx-2)",
                border: "1px solid var(--bd-1)",
                borderRadius: 6,
                padding: "4px 10px",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Reject
            </button>
          </>
        )}
        {state.status === "applying" && (
          <span style={{ fontSize: 11, color: "var(--tx-3)" }}>Applying...</span>
        )}
        {state.status === "applied" && (
          <span style={{ fontSize: 11, color: "var(--green, #16a34a)" }}>✓ Applied</span>
        )}
        {state.status === "rejected" && (
          <span style={{ fontSize: 11, color: "var(--tx-3)" }}>Rejected</span>
        )}
        {state.status === "error" && (
          <span style={{ fontSize: 11, color: "var(--red, #dc2626)" }}>
            ✗ {state.errorMsg || "Failed"}
          </span>
        )}
      </div>
    </div>
  );
}

function ProposalPreview({ proposal }: { proposal: Proposal }) {
  const style: React.CSSProperties = {
    fontSize: 11,
    color: "var(--tx-2)",
    background: "var(--bg-1)",
    border: "1px solid var(--bd-1)",
    borderRadius: 6,
    padding: 6,
    maxHeight: 120,
    overflow: "auto",
    whiteSpace: "pre-wrap",
    fontFamily: "ui-monospace, SFMono-Regular, monospace",
  };
  switch (proposal.kind) {
    case "edit_prd_section":
      return <div style={style}>{proposal.new_content.slice(0, 600)}{proposal.new_content.length > 600 ? "..." : ""}</div>;
    case "create_epic":
      return (
        <div style={style}>
          {proposal.title}
          {proposal.description ? `\n\n${proposal.description}` : ""}
          {proposal.phase ? `\nphase: ${proposal.phase}` : ""}
        </div>
      );
    case "edit_epic":
    case "edit_story":
    case "edit_task":
      return <div style={style}>{JSON.stringify(proposal.changes, null, 2)}</div>;
    case "create_story":
      return (
        <div style={style}>
          {proposal.title}
          {proposal.description ? `\n\n${proposal.description}` : ""}
          {proposal.acceptance_criteria?.length ? `\n\nAC: ${proposal.acceptance_criteria.length} criteria` : ""}
        </div>
      );
    case "create_task":
      return (
        <div style={style}>
          {proposal.title}
          {proposal.description ? `\n\n${proposal.description}` : ""}
        </div>
      );
    default:
      return null;
  }
}

function proposalSummary(p: Proposal): string {
  switch (p.kind) {
    case "edit_prd_section":
      return `Replace PRD section: ${p.section_key}`;
    case "create_epic":
      return `Create epic: ${p.title}`;
    case "edit_epic":
      return `Update epic ${p.id.slice(0, 8)}`;
    case "create_story":
      return `Create story under epic ${p.epic_id.slice(0, 8)}: ${p.title}`;
    case "edit_story":
      return `Update story ${p.id.slice(0, 8)}`;
    case "create_task":
      return `Create task under story ${p.story_id.slice(0, 8)}: ${p.title}`;
    case "edit_task":
      return `Update task ${p.id.slice(0, 8)}`;
  }
}

function scopeLabel(ctx: ScopedChatContext): string {
  if (ctx.type === "prd") return "PRD";
  if (ctx.type === "backlog") return "Backlog";
  return "Chat";
}

function randId(): string {
  return Math.random().toString(36).slice(2, 10);
}

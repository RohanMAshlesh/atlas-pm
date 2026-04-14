"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Send, Bot, User, Sparkles } from "lucide-react";
import { toast } from "@/components/ui/toaster";

interface Message { id: string; role: "user" | "assistant"; content: string; created_at: string; }

const SUGGESTED = [
  "Summarize this project for my VP",
  "What are the riskiest parts of Phase 1?",
  "Find gaps in our PRD",
  "What did we deprioritize and why?",
  "What stories cover the admin dashboard?",
  "What open questions remain?",
];

function formatContent(content: string) {
  return content.replace(
    /\[((?:EPIC|US|TASK|OBJ|KR)-\d+)\]/g,
    '<span style="font-family:var(--font-mono);font-size:11px;color:var(--ac-1);background:var(--ac-3);padding:1px 5px;border-radius:4px;border:1px solid var(--bd-ac)">[$1]</span>'
  );
}

export default function ChatPage() {
  const { id } = useParams<{ id: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchMessages = () => fetch(`/api/projects/${id}/chat`).then(r => r.json()).then(d => setMessages(Array.isArray(d) ? d : []));

  useEffect(() => { fetchMessages(); }, [id]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, streamContent]);

  const send = async (text?: string) => {
    const msg = text || input.trim();
    if (!msg || streaming) return;
    setInput(""); setStreaming(true); setStreamContent("");
    setMessages(p => [...p, { id: "tmp", role: "user", content: msg, created_at: new Date().toISOString() }]);
    try {
      const res = await fetch("/api/ai/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ project_id: id, message: msg }) });
      const reader = res.body!.getReader(); const dec = new TextDecoder(); let buf = ""; let full = "";
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n"); buf = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.text) { full += data.text; setStreamContent(full); }
            if (data.done) { fetchMessages(); setStreamContent(""); }
            if (data.error) toast({ title: data.error, variant: "error" });
          } catch {}
        }
      }
    } catch { toast({ title: "Failed to send", variant: "error" }); }
    finally { setStreaming(false); setStreamContent(""); }
  };

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "var(--bg-base)" }}>

      {/* Header */}
      <div className="page-header" style={{ flexShrink: 0 }}>
        <div>
          <h1 className="page-title">PM Co-pilot</h1>
          <p className="page-subtitle">Ask anything about this project.</p>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 32px" }}>
        {messages.length === 0 && !streaming ? (
          <div style={{ maxWidth: "560px", margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: "32px" }}>
              <div style={{
                width: "48px", height: "48px", borderRadius: "50%",
                background: "var(--ac-3)", border: "1px solid var(--bd-ac)",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 14px",
              }}>
                <Sparkles size={20} style={{ color: "var(--ac-1)" }} />
              </div>
              <p style={{ fontSize: "14px", color: "var(--tx-2)", marginBottom: "6px" }}>Atlas knows everything about this project.</p>
              <p style={{ fontSize: "12px", color: "var(--tx-4)" }}>Ask about trade-offs, risks, gaps, or get a stakeholder summary.</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {SUGGESTED.map(p => (
                <button
                  key={p}
                  onClick={() => send(p)}
                  className="card card-interactive card-p-sm"
                  style={{ textAlign: "left", fontSize: "12px", color: "var(--tx-2)", background: "none" }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ maxWidth: "640px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "20px" }}>
            {messages.map(msg => (
              <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                <div style={{
                  width: "28px", height: "28px", borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  background: msg.role === "assistant" ? "var(--ac-3)" : "var(--bg-3)",
                  border: `1px solid ${msg.role === "assistant" ? "var(--bd-ac)" : "var(--bd-2)"}`,
                }}>
                  {msg.role === "assistant"
                    ? <Bot size={13} style={{ color: "var(--ac-1)" }} />
                    : <User size={13} style={{ color: "var(--tx-2)" }} />}
                </div>
                <div className={msg.role === "user" ? "chat-bubble-user" : "chat-bubble-ai"}>
                  <p
                    style={{ fontSize: "13px", color: "var(--tx-1)", lineHeight: 1.7 }}
                    dangerouslySetInnerHTML={{ __html: formatContent(msg.content) }}
                  />
                </div>
              </div>
            ))}

            {streamContent && (
              <div className="flex gap-3">
                <div style={{
                  width: "28px", height: "28px", borderRadius: "50%",
                  background: "var(--ac-3)", border: "1px solid var(--bd-ac)",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <Bot size={13} style={{ color: "var(--ac-1)" }} />
                </div>
                <div className="chat-bubble-ai">
                  <p
                    style={{ fontSize: "13px", color: "var(--tx-1)", lineHeight: 1.7 }}
                    dangerouslySetInnerHTML={{ __html: formatContent(streamContent) }}
                  />
                  <span className="dot-pulse" style={{ marginLeft: "4px", display: "inline-block" }} />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input bar */}
      <div style={{ borderTop: "1px solid var(--bd-1)", padding: "16px 32px", flexShrink: 0, background: "var(--bg-1)" }}>
        <div style={{ maxWidth: "640px", margin: "0 auto" }}>
          <div className="flex gap-2" style={{ marginBottom: messages.length > 0 ? "10px" : "0" }}>
            <input
              className="input"
              placeholder="Ask about this project..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())}
              disabled={streaming}
            />
            <button
              onClick={() => send()}
              disabled={!input.trim() || streaming}
              className="btn btn-primary btn-icon"
              style={{ width: "38px", height: "38px", flexShrink: 0 }}
            >
              <Send size={14} />
            </button>
          </div>

          {messages.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {SUGGESTED.slice(0, 3).map(p => (
                <button
                  key={p}
                  onClick={() => send(p)}
                  style={{
                    fontSize: "11px", color: "var(--tx-4)",
                    padding: "3px 10px", borderRadius: "var(--r-full)",
                    border: "1px solid var(--bd-1)", background: "none",
                    cursor: "pointer", transition: "all 120ms",
                  }}
                  onMouseOver={e => { (e.currentTarget as HTMLElement).style.color = "var(--tx-2)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--bd-2)"; }}
                  onMouseOut={e => { (e.currentTarget as HTMLElement).style.color = "var(--tx-4)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--bd-1)"; }}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

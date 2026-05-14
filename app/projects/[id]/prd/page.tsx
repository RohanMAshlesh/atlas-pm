"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Zap, RefreshCw, Download, ChevronDown, ChevronUp, Edit3, Check, X } from "lucide-react";
import { toast } from "@/components/ui/toaster";
import { ScopedChatBubble } from "@/components/chat/ScopedChatBubble";

interface PRDSection {
  title: string;
  content: string;
  last_updated?: string;
}

interface PRDContent {
  [key: string]: PRDSection;
}

const SECTION_ORDER = [
  "overview", "background", "problem_statement", "goals", "personas",
  "scope", "requirements", "user_flows", "technical", "dependencies",
  "release", "appendix",
];

export default function PRDPage() {
  const { id } = useParams<{ id: string }>();
  const [prd, setPrd] = useState<PRDContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["overview"]));
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [regeneratingSection, setRegeneratingSection] = useState<string | null>(null);

  const fetchPRD = () => {
    fetch(`/api/projects/${id}/prd`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.content) setPrd(data.content);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchPRD(); }, [id]);

  const generatePRD = async () => {
    setGenerating(true);
    setStreamText("");
    try {
      const res = await fetch("/api/ai/prd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: id }),
      });
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.text) setStreamText((p) => p + data.text);
              if (data.done) { fetchPRD(); toast({ title: "PRD generated!", variant: "success" }); }
              if (data.error) toast({ title: data.error, variant: "error" });
            } catch {}
          }
        }
      }
    } catch { toast({ title: "Generation failed", variant: "error" }); }
    finally { setGenerating(false); setStreamText(""); }
  };

  const regenerateSection = async (sectionKey: string) => {
    setRegeneratingSection(sectionKey);
    try {
      const res = await fetch("/api/ai/prd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: id, section_key: sectionKey }),
      });
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let newContent = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.text) newContent += data.text;
              if (data.done) { fetchPRD(); toast({ title: "Section regenerated", variant: "success" }); }
            } catch {}
          }
        }
      }
    } catch { toast({ title: "Regeneration failed", variant: "error" }); }
    finally { setRegeneratingSection(null); }
  };

  const saveSection = async (sectionKey: string) => {
    await fetch(`/api/projects/${id}/prd`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ section_key: sectionKey, content: editContent }),
    });
    fetchPRD();
    setEditingSection(null);
    toast({ title: "Section saved", variant: "success" });
  };

  const exportMarkdown = () => {
    if (!prd) return;
    const md = SECTION_ORDER
      .filter((k) => prd[k])
      .map((k) => `# ${prd[k].title}\n\n${prd[k].content}`)
      .join("\n\n---\n\n");
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "prd.md";
    a.click();
  };

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  if (loading) return (
    <div style={{ padding: "32px", maxWidth: "896px" }}>
      <div className="skeleton" style={{ height: "32px", width: "25%", marginBottom: "16px", borderRadius: "6px" }} />
      {[1, 2, 3].map((i) => (
        <div key={i} className="skeleton" style={{ height: "96px", borderRadius: "8px", marginBottom: "12px" }} />
      ))}
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-1)" }}>
      <div className="page-header" style={{ padding: "24px 32px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", maxWidth: "896px", width: "100%" }}>
          <div>
            <h1 className="page-title">PRD</h1>
            <p className="page-subtitle">Product Requirements Document</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {prd && (
              <button onClick={exportMarkdown} className="btn btn-secondary" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Download style={{ width: "16px", height: "16px" }} /> Export
              </button>
            )}
            <button onClick={generatePRD} disabled={generating} className="btn btn-primary" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {generating ? (
                <><span className="dot-pulse" /> Generating...</>
              ) : (
                <><Zap style={{ width: "16px", height: "16px" }} /> {prd ? "Regenerate" : "Generate PRD"}</>
              )}
            </button>
          </div>
        </div>
      </div>

      <div style={{ padding: "24px 32px", maxWidth: "896px" }}>
        {generating && streamText && (
          <div className="stream-box" style={{ marginBottom: "24px" }}>
            <div className="stream-header">
              <span className="dot-pulse" />
              <span style={{ fontSize: "12px", color: "var(--ac-1)", fontWeight: 500 }}>Generating PRD...</span>
            </div>
            <p className="stream-text">{streamText}</p>
          </div>
        )}

        {!prd && !generating && (
          <div className="empty-state">
            <div className="empty-state-icon">
              <Zap style={{ width: "24px", height: "24px", color: "var(--ac-1)" }} />
            </div>
            <p className="empty-state-title">No PRD yet</p>
            <p className="empty-state-desc">Run discovery synthesis first, then generate your PRD.</p>
            <button onClick={generatePRD} className="btn btn-primary">Generate PRD</button>
          </div>
        )}

        {prd && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {SECTION_ORDER.filter((k) => prd[k]).map((sectionKey) => {
              const section = prd[sectionKey];
              const isExpanded = expandedSections.has(sectionKey);
              const isEditing = editingSection === sectionKey;
              const isRegenerating = regeneratingSection === sectionKey;

              return (
                <div key={sectionKey} className="section-card">
                  <div
                    role="button"
                    tabIndex={0}
                    className="section-card-header"
                    onClick={() => !isEditing && toggleSection(sectionKey)}
                    onKeyDown={(e) => {
                      if (!isEditing && (e.key === "Enter" || e.key === " ")) {
                        e.preventDefault();
                        toggleSection(sectionKey);
                      }
                    }}
                  >
                    <span style={{ fontSize: "14px", fontWeight: 500, color: "var(--tx-1)" }}>{section.title}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }} onClick={(e) => e.stopPropagation()}>
                      {!isEditing && (
                        <>
                          <button
                            onClick={() => {
                              setEditingSection(sectionKey);
                              setEditContent(section.content);
                              if (!isExpanded) setExpandedSections((p) => new Set([...p, sectionKey]));
                            }}
                            className="btn btn-ghost btn-icon"
                            title="Edit"
                          >
                            <Edit3 style={{ width: "14px", height: "14px" }} />
                          </button>
                          <button
                            onClick={() => regenerateSection(sectionKey)}
                            disabled={isRegenerating}
                            className="btn btn-ghost btn-icon"
                            title="Regenerate"
                          >
                            <RefreshCw style={{ width: "14px", height: "14px" }} className={isRegenerating ? "spin" : ""} />
                          </button>
                        </>
                      )}
                      {isExpanded
                        ? <ChevronUp style={{ width: "16px", height: "16px", color: "var(--tx-3)" }} />
                        : <ChevronDown style={{ width: "16px", height: "16px", color: "var(--tx-3)" }} />
                      }
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="section-card-body">
                      {isEditing ? (
                        <div>
                          <textarea
                            className="input"
                            rows={15}
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            style={{ fontFamily: "monospace", fontSize: "12px", resize: "vertical" }}
                          />
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "12px" }}>
                            <button onClick={() => saveSection(sectionKey)} className="btn btn-primary btn-sm" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <Check style={{ width: "14px", height: "14px" }} /> Save
                            </button>
                            <button onClick={() => setEditingSection(null)} className="btn btn-secondary btn-sm" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <X style={{ width: "14px", height: "14px" }} /> Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="prose-atlas">
                          <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: "14px", color: "var(--tx-2)", lineHeight: 1.7, margin: 0 }}>
                            {section.content}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ScopedChatBubble
        projectId={id}
        context={{ type: "prd" }}
        onApplied={() => fetchPRD()}
      />
    </div>
  );
}

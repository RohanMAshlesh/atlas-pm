"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Upload, FileText, Zap, ChevronDown, ChevronUp, AlertCircle, CheckCircle2, ArrowRight } from "lucide-react";
import { toast } from "@/components/ui/toaster";
import { formatDate } from "@/lib/utils";
import Link from "next/link";

const DOC_TYPES = [
  { value: "discovery_call", label: "Discovery Call" },
  { value: "meeting_notes", label: "Meeting Notes" },
  { value: "customer_interview", label: "Customer Interview" },
  { value: "market_research", label: "Market Research" },
  { value: "architecture", label: "Architecture Doc" },
  { value: "support_data", label: "Support Data" },
  { value: "analytics", label: "Analytics" },
  { value: "other", label: "Other" },
];

interface Doc { id: string; filename: string; type: string; content: string | null; created_at: string; }
interface SynthesisContent {
  key_themes?: Array<{ theme: string; frequency: string; sources: string[] }>;
  pain_points?: Array<{ point: string; severity: string; evidence: string }>;
  opportunities?: Array<{ opportunity: string; rationale: string }>;
  stakeholders?: Array<{ name: string; role: string; concerns: string[] }>;
  contradictions?: Array<{ tension: string; sources: string[] }>;
  open_questions?: string[];
  next_steps?: string[];
  raw_summary?: string;
}

export default function DiscoveryPage() {
  const { id } = useParams<{ id: string }>();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [uploading, setUploading] = useState(false);
  const [synthesizing, setSynthesizing] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [synthesis, setSynthesis] = useState<SynthesisContent | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["key_themes", "pain_points"]));
  const [dragOver, setDragOver] = useState(false);
  const [docType, setDocType] = useState("other");
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchDocs = () => fetch(`/api/projects/${id}/documents`).then(r => r.json()).then(d => setDocs(Array.isArray(d) ? d : []));
  const fetchSynthesis = () => fetch(`/api/projects/${id}/synthesis`).then(r => r.json()).then(d => {
    if (d?.content) setSynthesis(typeof d.content === "string" ? JSON.parse(d.content) : d.content);
  }).catch(() => {});

  useEffect(() => { fetchDocs(); fetchSynthesis(); }, [id]);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      const form = new FormData();
      form.append("file", file); form.append("project_id", id); form.append("type", docType);
      try {
        const res = await fetch("/api/upload", { method: "POST", body: form });
        if (!res.ok) throw new Error();
        toast({ title: `Uploaded ${file.name}`, variant: "success" });
      } catch { toast({ title: `Failed: ${file.name}`, variant: "error" }); }
    }
    fetchDocs(); setUploading(false);
  };

  const synthesize = async () => {
    if (!docs.length) { toast({ title: "Upload documents first", variant: "error" }); return; }
    setSynthesizing(true); setStreamText(""); setSynthesis(null);
    try {
      const res = await fetch("/api/ai/synthesize", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ project_id: id }) });
      const reader = res.body!.getReader(); const dec = new TextDecoder(); let buf = "";
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n"); buf = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.text) setStreamText(p => p + data.text);
            if (data.done) { fetchSynthesis(); toast({ title: "Synthesis complete!", variant: "success" }); }
            if (data.error) toast({ title: data.error, variant: "error" });
          } catch {}
        }
      }
    } catch { toast({ title: "Synthesis failed", variant: "error" }); }
    finally { setSynthesizing(false); setStreamText(""); }
  };

  const toggle = (k: string) => setExpanded(p => { const n = new Set(p); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  const sevBadgeClass = (s: string) =>
    s === "critical" ? "badge badge-red" :
    s === "high"     ? "badge badge-orange" :
    s === "medium"   ? "badge badge-yellow" :
                       "badge badge-default";

  const sections = [
    { key: "key_themes",    label: "Key Themes",      count: synthesis?.key_themes?.length },
    { key: "pain_points",   label: "Pain Points",     count: synthesis?.pain_points?.length },
    { key: "opportunities", label: "Opportunities",   count: synthesis?.opportunities?.length },
    { key: "stakeholders",  label: "Stakeholders",    count: synthesis?.stakeholders?.length },
    { key: "contradictions",label: "Contradictions",  count: synthesis?.contradictions?.length },
    { key: "open_questions",label: "Open Questions",  count: synthesis?.open_questions?.length },
    { key: "next_steps",    label: "Next Steps",      count: synthesis?.next_steps?.length },
  ];

  return (
    <div style={{ minHeight: "100vh" }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Discovery</h1>
          <p className="page-subtitle">Upload inputs and synthesize insights.</p>
        </div>
        {docs.length > 0 && (
          <button onClick={synthesize} disabled={synthesizing} className="btn btn-primary">
            {synthesizing ? <><span className="dot-pulse" /> Synthesizing...</> : <><Zap size={14} /> Synthesize</>}
          </button>
        )}
      </div>

      <div style={{ padding: "24px 32px", maxWidth: "820px" }}>

        {/* Upload */}
        <div style={{ marginBottom: "24px" }}>
          <div className="flex items-center gap-3" style={{ marginBottom: "10px" }}>
            <select value={docType} onChange={e => setDocType(e.target.value)} className="input" style={{ width: "200px" }}>
              {DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <p style={{ fontSize: "12px", color: "var(--tx-3)" }}>Select type before uploading</p>
          </div>

          <div
            style={{
              border: `2px dashed ${dragOver ? "var(--ac-1)" : "var(--bd-1)"}`,
              borderRadius: "var(--r-lg)",
              padding: "36px",
              textAlign: "center",
              cursor: "pointer",
              transition: "all 150ms",
              background: dragOver ? "var(--ac-4)" : "var(--bg-2)",
            }}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); upload(e.dataTransfer.files); }}
            onClick={() => fileRef.current?.click()}
          >
            <Upload size={24} style={{ color: dragOver ? "var(--ac-1)" : "var(--tx-4)", margin: "0 auto 12px" }} />
            <p style={{ fontSize: "14px", color: dragOver ? "var(--ac-1)" : "var(--tx-2)", fontWeight: 500, marginBottom: "4px" }}>
              {uploading ? "Uploading..." : "Drop files here or click to upload"}
            </p>
            <p style={{ fontSize: "12px", color: "var(--tx-4)" }}>PDF, DOCX, TXT, MD, SRT, VTT, CSV, images</p>
            <input
              ref={fileRef}
              type="file"
              multiple
              style={{ display: "none" }}
              accept=".pdf,.docx,.txt,.md,.srt,.vtt,.csv,.png,.jpg,.jpeg"
              onChange={e => upload(e.target.files)}
            />
          </div>
        </div>

        {/* Docs list */}
        {docs.length > 0 && (
          <div style={{ marginBottom: "24px" }}>
            <p className="input-label" style={{ marginBottom: "10px" }}>
              {docs.length} document{docs.length !== 1 ? "s" : ""}
            </p>
            <div className="flex flex-col gap-2">
              {docs.map(doc => (
                <div key={doc.id} className="card card-p-sm flex items-center gap-3">
                  <FileText size={14} style={{ color: "var(--tx-3)", flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: "13px", color: "var(--tx-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.filename}</p>
                    <p style={{ fontSize: "11px", color: "var(--tx-3)", marginTop: "1px" }}>
                      {DOC_TYPES.find(t => t.value === doc.type)?.label || doc.type} · {formatDate(doc.created_at)}
                    </p>
                  </div>
                  <CheckCircle2 size={14} style={{ color: "var(--green)", flexShrink: 0 }} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Streaming */}
        {synthesizing && streamText && (
          <div className="stream-box">
            <div className="stream-header"><span className="dot-pulse" /> Synthesizing...</div>
            <div className="stream-text">{streamText}</div>
          </div>
        )}

        {/* Synthesis output */}
        {synthesis && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between" style={{ marginBottom: "4px" }}>
              <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "20px", color: "var(--tx-1)" }}>Synthesis</h2>
              <button onClick={synthesize} className="btn btn-ghost btn-sm">Re-synthesize</button>
            </div>

            {synthesis.raw_summary && (
              <div className="card card-p">
                <p style={{ fontSize: "13px", color: "var(--tx-2)", lineHeight: 1.8 }}>{synthesis.raw_summary}</p>
              </div>
            )}

            {sections.map(({ key, label, count }) => (
              <div key={key} className="section-card">
                <div className="section-card-header" onClick={() => toggle(key)}>
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--tx-1)" }}>{label}</span>
                    {count !== undefined && <span className="badge badge-default">{count}</span>}
                  </div>
                  {expanded.has(key)
                    ? <ChevronUp size={14} style={{ color: "var(--tx-3)" }} />
                    : <ChevronDown size={14} style={{ color: "var(--tx-3)" }} />}
                </div>

                {expanded.has(key) && (
                  <div className="section-card-body flex flex-col gap-3">

                    {key === "key_themes" && synthesis.key_themes?.map((t, i) => (
                      <div key={i} className="flex items-start gap-3" style={{ paddingBottom: "10px", borderBottom: "1px solid var(--bd-1)" }}>
                        <span className={t.frequency === "high" ? "badge badge-accent" : "badge badge-default"}>{t.frequency}</span>
                        <div>
                          <p style={{ fontSize: "13px", color: "var(--tx-1)" }}>{t.theme}</p>
                          {t.sources?.length > 0 && <p style={{ fontSize: "11px", color: "var(--tx-4)", marginTop: "2px" }}>Sources: {t.sources.join(", ")}</p>}
                        </div>
                      </div>
                    ))}

                    {key === "pain_points" && synthesis.pain_points?.map((p, i) => (
                      <div key={i} className="flex items-start gap-3" style={{ paddingBottom: "10px", borderBottom: "1px solid var(--bd-1)" }}>
                        <span className={sevBadgeClass(p.severity)} style={{ flexShrink: 0, marginTop: "2px" }}>{p.severity.toUpperCase()}</span>
                        <div>
                          <p style={{ fontSize: "13px", color: "var(--tx-1)" }}>{p.point}</p>
                          {p.evidence && <p style={{ fontSize: "12px", color: "var(--tx-3)", marginTop: "3px", fontStyle: "italic" }}>"{p.evidence}"</p>}
                        </div>
                      </div>
                    ))}

                    {key === "opportunities" && synthesis.opportunities?.map((o, i) => (
                      <div key={i} style={{ paddingBottom: "10px", borderBottom: "1px solid var(--bd-1)" }}>
                        <p style={{ fontSize: "13px", color: "var(--tx-1)", fontWeight: 500 }}>{o.opportunity}</p>
                        <p style={{ fontSize: "12px", color: "var(--tx-3)", marginTop: "3px" }}>{o.rationale}</p>
                      </div>
                    ))}

                    {key === "stakeholders" && synthesis.stakeholders?.map((s, i) => (
                      <div key={i} style={{ paddingBottom: "10px", borderBottom: "1px solid var(--bd-1)" }}>
                        <div className="flex items-center gap-2" style={{ marginBottom: "4px" }}>
                          <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--tx-1)" }}>{s.name}</span>
                          <span style={{ fontSize: "12px", color: "var(--tx-3)" }}>— {s.role}</span>
                        </div>
                        {s.concerns?.map((c, j) => <p key={j} style={{ fontSize: "12px", color: "var(--tx-2)" }}>• {c}</p>)}
                      </div>
                    ))}

                    {key === "contradictions" && synthesis.contradictions?.map((c, i) => (
                      <div key={i} className="flex items-start gap-2" style={{ paddingBottom: "10px", borderBottom: "1px solid var(--bd-1)" }}>
                        <AlertCircle size={13} style={{ color: "var(--yellow)", flexShrink: 0, marginTop: "2px" }} />
                        <div>
                          <p style={{ fontSize: "13px", color: "var(--tx-1)" }}>{c.tension}</p>
                          {c.sources?.length > 0 && <p style={{ fontSize: "11px", color: "var(--tx-4)", marginTop: "2px" }}>From: {c.sources.join(", ")}</p>}
                        </div>
                      </div>
                    ))}

                    {key === "open_questions" && synthesis.open_questions?.map((q, i) => (
                      <div key={i} className="flex items-start gap-2" style={{ paddingBottom: "8px", borderBottom: "1px solid var(--bd-1)" }}>
                        <span style={{ color: "var(--tx-4)", marginTop: "1px", fontSize: "12px" }}>?</span>
                        <p style={{ fontSize: "13px", color: "var(--tx-2)" }}>{q}</p>
                      </div>
                    ))}

                    {key === "next_steps" && synthesis.next_steps?.map((s, i) => (
                      <div key={i} className="flex items-start gap-3" style={{ paddingBottom: "8px", borderBottom: "1px solid var(--bd-1)" }}>
                        <div style={{
                          width: "20px", height: "20px", borderRadius: "50%",
                          background: "var(--ac-3)", border: "1px solid var(--bd-ac)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          flexShrink: 0, fontSize: "10px", fontWeight: 700, color: "var(--ac-1)",
                        }}>{i + 1}</div>
                        <p style={{ fontSize: "13px", color: "var(--tx-2)" }}>{s}</p>
                      </div>
                    ))}

                  </div>
                )}
              </div>
            ))}

            <Link href={`/projects/${id}/prd`} className="btn btn-primary" style={{ alignSelf: "flex-start", marginTop: "8px" }}>
              Proceed to PRD <ArrowRight size={14} />
            </Link>
          </div>
        )}

        {/* Empty state */}
        {!synthesis && !synthesizing && docs.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">
              <Upload size={22} />
            </div>
            <p className="empty-state-title">No documents yet</p>
            <p className="empty-state-desc">Upload discovery documents to begin. Call transcripts, meeting notes, research PDFs...</p>
          </div>
        )}

      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Plus, Search, Zap, TrendingUp, TrendingDown, Building2 } from "lucide-react";
import { toast } from "@/components/ui/toaster";

interface CompetitorData {
  overview: string;
  product_offering: string;
  pricing: string;
  strengths: string[];
  weaknesses: string[];
  market_position: string;
  target_customers: string;
  founded?: string;
  funding?: string;
  website?: string;
}

interface Competitor {
  id: string;
  name: string;
  data: CompetitorData;
  created_at: string;
}

export default function ResearchPage() {
  const { id } = useParams<{ id: string }>();
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCompetitor, setNewCompetitor] = useState("");
  const [researching, setResearching] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [selected, setSelected] = useState<Competitor | null>(null);

  const fetchCompetitors = () => {
    fetch(`/api/projects/${id}/competitors`)
      .then((r) => r.json())
      .then((data) => { setCompetitors(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchCompetitors(); }, [id]);

  const research = async () => {
    if (!newCompetitor.trim()) return;
    setResearching(true);
    setStreamText("");
    const name = newCompetitor.trim();
    setNewCompetitor("");

    try {
      const res = await fetch("/api/ai/competitor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: id, competitor_name: name }),
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
              if (data.done) { fetchCompetitors(); toast({ title: `${name} profiled!`, variant: "success" }); setStreamText(""); }
              if (data.error) toast({ title: data.error, variant: "error" });
            } catch {}
          }
        }
      }
    } catch { toast({ title: "Research failed", variant: "error" }); }
    finally { setResearching(false); setStreamText(""); }
  };

  return (
    <div className="split-layout">
      {/* Main */}
      <div className="split-main">
        <div className="page-header">
          <div>
            <h1 className="page-title">Research</h1>
            <p className="page-subtitle">Competitive intelligence and market analysis.</p>
          </div>
        </div>

        <div style={{ padding: "24px 32px" }}>
          {/* Add competitor */}
          <div style={{ display: "flex", gap: "12px", marginBottom: "24px" }}>
            <div className="search-wrap" style={{ flex: 1, maxWidth: "448px" }}>
              <Search className="search-icon" style={{ width: "16px", height: "16px" }} />
              <input
                className="input search-input"
                placeholder="Enter competitor name (e.g. Notion, Linear, Jira)..."
                value={newCompetitor}
                onChange={(e) => setNewCompetitor(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && research()}
                disabled={researching}
              />
            </div>
            <button
              onClick={research}
              disabled={!newCompetitor.trim() || researching}
              className="btn btn-primary"
            >
              {researching
                ? <><span className="dot-pulse" /> Researching...</>
                : <><Zap style={{ width: "16px", height: "16px" }} /> Research</>
              }
            </button>
          </div>

          {researching && streamText && (
            <div className="stream-box" style={{ maxWidth: "640px", marginBottom: "24px" }}>
              <div className="stream-header">
                <span className="dot-pulse" />
                Profiling competitor...
              </div>
              <p className="stream-text">{streamText}</p>
            </div>
          )}

          {loading ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              {[1, 2, 3].map((i) => (
                <div key={i} className="skeleton" style={{ height: "160px", borderRadius: "12px" }} />
              ))}
            </div>
          ) : competitors.length === 0 ? (
            <div className="empty-state" style={{ maxWidth: "448px" }}>
              <div className="empty-state-icon">
                <Building2 style={{ width: "22px", height: "22px" }} />
              </div>
              <p className="empty-state-title">No competitors profiled yet</p>
              <p className="empty-state-desc">Enter a competitor name above to research them.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", maxWidth: "800px" }}>
              {competitors.map((comp) => {
                const isSelected = selected?.id === comp.id;
                return (
                  <button
                    key={comp.id}
                    onClick={() => setSelected(isSelected ? null : comp)}
                    className={`card card-interactive card-p${isSelected ? " card-accent" : ""}`}
                    style={{
                      textAlign: "left",
                      width: "100%",
                      background: "none",
                      fontFamily: "inherit",
                      ...(isSelected ? { borderColor: "var(--bd-ac)" } : {}),
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "12px" }}>
                      <div>
                        <p style={{ fontSize: "13px", fontWeight: 500, color: "var(--tx-1)" }}>{comp.name}</p>
                        {comp.data.founded && (
                          <p style={{ fontSize: "11px", color: "var(--tx-3)" }}>Founded {comp.data.founded}</p>
                        )}
                      </div>
                      <Building2 style={{ width: "16px", height: "16px", color: "var(--tx-3)" }} />
                    </div>
                    <p style={{ fontSize: "11px", color: "var(--tx-2)", marginBottom: "12px", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {comp.data.overview}
                    </p>
                    <div style={{ display: "flex", gap: "12px" }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: "11px", color: "var(--green)", fontWeight: 500, marginBottom: "4px", display: "flex", alignItems: "center", gap: "4px" }}>
                          <TrendingUp style={{ width: "12px", height: "12px" }} /> Strengths
                        </p>
                        <ul style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          {comp.data.strengths?.slice(0, 2).map((s, i) => (
                            <li key={i} style={{ fontSize: "11px", color: "var(--tx-2)" }}>• {s}</li>
                          ))}
                        </ul>
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: "11px", color: "var(--red)", fontWeight: 500, marginBottom: "4px", display: "flex", alignItems: "center", gap: "4px" }}>
                          <TrendingDown style={{ width: "12px", height: "12px" }} /> Weaknesses
                        </p>
                        <ul style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          {comp.data.weaknesses?.slice(0, 2).map((w, i) => (
                            <li key={i} style={{ fontSize: "11px", color: "var(--tx-2)" }}>• {w}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Detail Panel */}
      {selected && (
        <div className="split-panel animate-in">
          <div style={{ padding: "24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "8px",
                  background: "var(--bg-hover)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "var(--font-mono)",
                  fontSize: "13px",
                  color: "var(--tx-2)",
                }}
              >
                {selected.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h2 className="font-serif" style={{ fontSize: "20px", color: "var(--tx-1)" }}>{selected.name}</h2>
                {selected.data.website && (
                  <p style={{ fontSize: "11px", color: "var(--ac-1)" }}>{selected.data.website}</p>
                )}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <InfoItem label="Overview" value={selected.data.overview} />
              <InfoItem label="Product" value={selected.data.product_offering} />
              <InfoItem label="Pricing" value={selected.data.pricing} />
              <InfoItem label="Market Position" value={selected.data.market_position} />
              <InfoItem label="Target Customers" value={selected.data.target_customers} />
              {selected.data.funding && <InfoItem label="Funding" value={selected.data.funding} />}

              <div>
                <p className="input-label" style={{ marginBottom: "8px", color: "var(--green)" }}>Strengths</p>
                <ul style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  {selected.data.strengths?.map((s, i) => (
                    <li key={i} style={{ fontSize: "11px", color: "var(--tx-2)", display: "flex", gap: "6px" }}>
                      <span style={{ color: "var(--green)" }}>+</span>{s}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="input-label" style={{ marginBottom: "8px", color: "var(--red)" }}>Weaknesses</p>
                <ul style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  {selected.data.weaknesses?.map((w, i) => (
                    <li key={i} style={{ fontSize: "11px", color: "var(--tx-2)", display: "flex", gap: "6px" }}>
                      <span style={{ color: "var(--red)" }}>−</span>{w}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div>
      <p className="input-label" style={{ marginBottom: "4px" }}>{label}</p>
      <p style={{ fontSize: "11px", color: "var(--tx-2)", lineHeight: 1.6 }}>{value}</p>
    </div>
  );
}

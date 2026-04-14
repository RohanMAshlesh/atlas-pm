"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Map, Calendar, Layers } from "lucide-react";
import { toast } from "@/components/ui/toaster";

interface Epic {
  id: string;
  title: string;
  phase: string | null;
  status: string;
  stories: { id: string; story_points: number | null; status: string }[];
}

const PHASES = [
  { id: "mvp",    label: "MVP",    pillClass: "phase-mvp",    borderColor: "var(--bd-ac)" },
  { id: "v1.0",   label: "v1.0",   pillClass: "phase-v1",     borderColor: "rgba(96,165,250,0.3)" },
  { id: "v1.1",   label: "v1.1",   pillClass: "phase-v11",    borderColor: "rgba(74,222,128,0.3)" },
  { id: "future", label: "Future", pillClass: "phase-future",  borderColor: "var(--bd-1)" },
];

export default function RoadmapPage() {
  const { id } = useParams<{ id: string }>();
  const [epics, setEpics] = useState<Epic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/projects/${id}/backlog`)
      .then((r) => r.json())
      .then((data) => { setEpics(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  const epicsByPhase = PHASES.map((phase) => ({
    ...phase,
    epics: epics.filter((e) => e.phase === phase.id || (!e.phase && phase.id === "future")),
  }));

  const totalPoints = (phaseEpics: Epic[]) =>
    phaseEpics.reduce((sum, e) => sum + e.stories.reduce((s2, s) => s2 + (s.story_points || 0), 0), 0);

  if (loading) return (
    <div style={{ padding: "32px" }}>
      <div className="skeleton" style={{ height: "32px", width: "25%", borderRadius: "6px", marginBottom: "24px" }} />
      <div style={{ display: "flex", gap: "16px" }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton" style={{ flex: 1, height: "256px", borderRadius: "8px" }} />
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-1)" }}>
      <div className="page-header" style={{ padding: "24px 32px" }}>
        <h1 className="page-title">Roadmap</h1>
        <p className="page-subtitle">Release phases and planning.</p>
      </div>

      <div style={{ padding: "24px 32px" }}>
        {epics.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <Map style={{ width: "24px", height: "24px", color: "var(--tx-3)" }} />
            </div>
            <p className="empty-state-title">No epics yet</p>
            <p className="empty-state-desc">Generate your backlog first, then phases will appear here.</p>
          </div>
        ) : (
          <>
            {/* Phase summary */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "32px" }}>
              {epicsByPhase.map((phase) => (
                <div
                  key={phase.id}
                  className="card card-p"
                  style={{ borderTop: `2px solid ${phase.borderColor}` }}
                >
                  <div style={{ marginBottom: "4px" }}>
                    <span className={`badge ${phase.pillClass}`}>{phase.label}</span>
                  </div>
                  <p className="font-serif" style={{ fontSize: "24px", color: "var(--tx-1)", margin: "8px 0 2px" }}>
                    {phase.epics.length}
                  </p>
                  <p style={{ fontSize: "12px", color: "var(--tx-3)" }}>
                    epics · {totalPoints(phase.epics)} pts
                  </p>
                </div>
              ))}
            </div>

            {/* Phase columns */}
            <div style={{ display: "flex", gap: "16px", overflowX: "auto", paddingBottom: "16px" }}>
              {epicsByPhase.map((phase) => (
                <div key={phase.id} style={{ flexShrink: 0, width: "288px" }}>
                  <div
                    className={`badge ${phase.pillClass}`}
                    style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px", padding: "6px 12px", borderRadius: "8px" }}
                  >
                    <Calendar style={{ width: "14px", height: "14px" }} />
                    <span style={{ fontSize: "12px", fontWeight: 500 }}>{phase.label}</span>
                    <span style={{ marginLeft: "auto", fontSize: "12px", opacity: 0.7 }}>{phase.epics.length}</span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {phase.epics.length === 0 ? (
                      <div className="card card-p" style={{ textAlign: "center" }}>
                        <p style={{ fontSize: "12px", color: "var(--tx-3)" }}>No epics in {phase.label}</p>
                      </div>
                    ) : (
                      phase.epics.map((epic) => {
                        const points = epic.stories.reduce((s, st) => s + (st.story_points || 0), 0);
                        const doneCount = epic.stories.filter((s) => s.status === "done").length;
                        return (
                          <div key={epic.id} className="card" style={{ padding: "12px" }}>
                            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px", marginBottom: "4px" }}>
                              <span className="item-id">{epic.id}</span>
                              <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", color: "var(--tx-3)" }}>
                                <Layers style={{ width: "12px", height: "12px" }} />
                                {epic.stories.length}
                              </div>
                            </div>
                            <p style={{ fontSize: "12px", color: "var(--tx-1)", lineHeight: 1.4, marginBottom: "8px" }}>
                              {epic.title}
                            </p>
                            {points > 0 && (
                              <p style={{ fontSize: "12px", color: "var(--tx-3)", fontFamily: "monospace" }}>{points} pts</p>
                            )}
                            {epic.stories.length > 0 && (
                              <div style={{ marginTop: "8px", width: "100%", height: "4px", background: "var(--bg-hover)", borderRadius: "9999px", overflow: "hidden" }}>
                                <div
                                  style={{
                                    height: "100%",
                                    background: "var(--green)",
                                    borderRadius: "9999px",
                                    width: `${(doneCount / epic.stories.length) * 100}%`,
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

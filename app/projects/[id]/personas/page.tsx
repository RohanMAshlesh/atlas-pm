"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Zap, User, Target, Frown, Lightbulb } from "lucide-react";
import { toast } from "@/components/ui/toaster";

interface PersonaData {
  role: string;
  company_size: string;
  industry: string;
  tech_sophistication: string;
  goals: string[];
  frustrations: string[];
  jtbd: string[];
  behavioral_patterns: string[];
  quote: string;
  empathy_map: { think: string[]; feel: string[]; say: string[]; do: string[] };
  buying_role: string;
}

interface Persona {
  id: string;
  name: string;
  archetype: string | null;
  data: PersonaData;
}

const buyingRoleStyle = (role: string): { color: string; background: string } => {
  if (role === "decision_maker") return { color: "var(--ac-1)", background: "var(--ac-3)" };
  if (role === "influencer") return { color: "var(--blue)", background: "var(--blue-dim)" };
  return { color: "var(--tx-2)", background: "var(--bg-3)" };
};

const avatarStyles = [
  { background: "var(--ac-3)", color: "var(--ac-1)" },
  { background: "var(--blue-dim)", color: "var(--blue)" },
  { background: "var(--green-dim)", color: "var(--green)" },
  { background: "rgba(249,115,22,0.1)", color: "var(--orange)" },
];

const avatarStyle = (name: string) => avatarStyles[name.charCodeAt(0) % avatarStyles.length];

export default function PersonasPage() {
  const { id } = useParams<{ id: string }>();
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selected, setSelected] = useState<Persona | null>(null);

  const fetchPersonas = () => {
    fetch(`/api/projects/${id}/personas`)
      .then((r) => r.json())
      .then((data) => { setPersonas(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchPersonas(); }, [id]);

  const generate = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/ai/personas", {
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
              if (data.done) { fetchPersonas(); toast({ title: `${data.count} personas generated!`, variant: "success" }); }
              if (data.error) toast({ title: data.error, variant: "error" });
            } catch {}
          }
        }
      }
    } catch { toast({ title: "Generation failed", variant: "error" }); }
    finally { setGenerating(false); }
  };

  if (loading) {
    return (
      <div style={{ padding: "32px", maxWidth: "800px" }}>
        <div className="skeleton" style={{ height: "32px", width: "25%", marginBottom: "16px" }} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton" style={{ height: "160px", borderRadius: "12px" }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="split-layout">
      {/* Main */}
      <div className="split-main">
        <div className="page-header">
          <div>
            <h1 className="page-title">Personas</h1>
            <p className="page-subtitle">User archetypes grounded in discovery data.</p>
          </div>
          <button onClick={generate} disabled={generating} className="btn btn-primary">
            {generating
              ? <><span className="dot-pulse" /> Generating...</>
              : <><Zap className="w-4 h-4" /> {personas.length ? "Regenerate" : "Generate Personas"}</>
            }
          </button>
        </div>

        <div style={{ padding: "24px 32px", maxWidth: "800px" }}>
          {personas.length === 0 && !generating ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                <User style={{ width: "22px", height: "22px" }} />
              </div>
              <p className="empty-state-title">No personas yet</p>
              <p className="empty-state-desc">Run discovery synthesis first, then generate personas.</p>
              <button onClick={generate} className="btn btn-primary">Generate Personas</button>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              {personas.map((persona) => {
                const isSelected = selected?.id === persona.id;
                const av = avatarStyle(persona.name);
                const roleStyle = buyingRoleStyle(persona.data.buying_role);
                return (
                  <button
                    key={persona.id}
                    onClick={() => setSelected(isSelected ? null : persona)}
                    className={`card card-interactive card-p${isSelected ? " card-accent" : ""}`}
                    style={{
                      textAlign: "left",
                      width: "100%",
                      background: "none",
                      fontFamily: "inherit",
                      ...(isSelected ? { borderColor: "var(--bd-ac)" } : {}),
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", marginBottom: "16px" }}>
                      <div
                        style={{
                          width: "40px",
                          height: "40px",
                          borderRadius: "9999px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "13px",
                          fontWeight: 500,
                          flexShrink: 0,
                          background: av.background,
                          color: av.color,
                        }}
                      >
                        {persona.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                      </div>
                      <div>
                        <p style={{ fontSize: "13px", fontWeight: 500, color: "var(--tx-1)" }}>{persona.name}</p>
                        {persona.archetype && (
                          <p style={{ fontSize: "11px", color: "var(--ac-1)" }}>{persona.archetype}</p>
                        )}
                        <p style={{ fontSize: "11px", color: "var(--tx-3)" }}>
                          {persona.data.role} · {persona.data.company_size}
                        </p>
                      </div>
                      <span
                        className="badge"
                        style={{
                          marginLeft: "auto",
                          flexShrink: 0,
                          color: roleStyle.color,
                          background: roleStyle.background,
                        }}
                      >
                        {persona.data.buying_role.replace("_", " ")}
                      </span>
                    </div>

                    {persona.data.quote && (
                      <p
                        style={{
                          fontSize: "11px",
                          color: "var(--tx-2)",
                          fontStyle: "italic",
                          borderLeft: "2px solid var(--bd-2)",
                          paddingLeft: "12px",
                          marginBottom: "12px",
                        }}
                      >
                        "{persona.data.quote}"
                      </p>
                    )}

                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      <div>
                        <p style={{ fontSize: "11px", color: "var(--tx-3)", marginBottom: "4px" }}>Goals</p>
                        <ul style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          {persona.data.goals?.slice(0, 2).map((g, i) => (
                            <li key={i} style={{ fontSize: "11px", color: "var(--tx-2)", display: "flex", alignItems: "flex-start", gap: "6px" }}>
                              <Target style={{ width: "12px", height: "12px", color: "var(--green)", marginTop: "2px", flexShrink: 0 }} />{g}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p style={{ fontSize: "11px", color: "var(--tx-3)", marginBottom: "4px" }}>Frustrations</p>
                        <ul style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          {persona.data.frustrations?.slice(0, 2).map((f, i) => (
                            <li key={i} style={{ fontSize: "11px", color: "var(--tx-2)", display: "flex", alignItems: "flex-start", gap: "6px" }}>
                              <Frown style={{ width: "12px", height: "12px", color: "var(--red)", marginTop: "2px", flexShrink: 0 }} />{f}
                            </li>
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

      {/* Detail panel */}
      {selected && (
        <div className="split-panel animate-in">
          <div style={{ padding: "24px" }}>
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "9999px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "18px",
                fontWeight: 500,
                marginBottom: "16px",
                ...avatarStyle(selected.name),
              }}
            >
              {selected.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
            </div>
            <h2 className="font-serif" style={{ fontSize: "20px", color: "var(--tx-1)" }}>{selected.name}</h2>
            {selected.archetype && (
              <p style={{ fontSize: "13px", color: "var(--ac-1)", marginBottom: "4px" }}>{selected.archetype}</p>
            )}
            <p style={{ fontSize: "13px", color: "var(--tx-2)" }}>
              {selected.data.role} at {selected.data.company_size} {selected.data.industry}
            </p>
            <p style={{ fontSize: "11px", color: "var(--tx-3)", marginTop: "4px" }}>
              Tech sophistication: {selected.data.tech_sophistication}
            </p>

            {selected.data.quote && (
              <div
                style={{
                  margin: "16px 0",
                  borderLeft: "2px solid var(--ac-1)",
                  paddingLeft: "12px",
                }}
              >
                <p style={{ fontSize: "13px", color: "var(--tx-2)", fontStyle: "italic" }}>
                  "{selected.data.quote}"
                </p>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "20px", marginTop: "16px" }}>
              <Section title="Goals" items={selected.data.goals} itemColor="var(--green)" />
              <Section title="Frustrations" items={selected.data.frustrations} itemColor="var(--red)" />
              <Section title="Jobs to Be Done" items={selected.data.jtbd} itemColor="var(--ac-1)" />
              <Section title="Behavioral Patterns" items={selected.data.behavioral_patterns} />

              {selected.data.empathy_map && (
                <div>
                  <p className="input-label" style={{ marginBottom: "12px" }}>Empathy Map</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    {(["think", "feel", "say", "do"] as const).map((k) => (
                      <div key={k} style={{ background: "var(--bg-3)", borderRadius: "8px", padding: "12px" }}>
                        <p style={{ fontSize: "10px", fontWeight: 600, color: "var(--tx-3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "4px" }}>
                          {k}
                        </p>
                        <ul style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          {selected.data.empathy_map[k]?.map((item, i) => (
                            <li key={i} style={{ fontSize: "11px", color: "var(--tx-2)" }}>• {item}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  items,
  itemColor = "var(--tx-2)",
}: {
  title: string;
  items?: string[];
  itemColor?: string;
}) {
  if (!items?.length) return null;
  return (
    <div>
      <p className="input-label" style={{ marginBottom: "8px" }}>{title}</p>
      <ul style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        {items.map((item, i) => (
          <li key={i} style={{ fontSize: "11px", color: itemColor, display: "flex", alignItems: "flex-start", gap: "6px" }}>
            <span style={{ color: "var(--tx-3)", marginTop: "1px" }}>•</span>{item}
          </li>
        ))}
      </ul>
    </div>
  );
}

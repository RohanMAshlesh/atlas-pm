"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Inbox, FileText, Users, FlaskConical, Layers, Map, MessageSquare, ArrowRight, ChevronRight } from "lucide-react";

interface Project { id: string; name: string; description: string | null; company_context: string | null; status: string; created_at: string; }

const sections = [
  { href: "discovery", icon: Inbox, label: "Discovery", desc: "Upload docs, synthesize insights", color: "var(--ac-1)" },
  { href: "prd", icon: FileText, label: "PRD", desc: "Product requirements document", color: "var(--blue)" },
  { href: "personas", icon: Users, label: "Personas", desc: "User archetypes from real data", color: "var(--green)" },
  { href: "research", icon: FlaskConical, label: "Research", desc: "Competitive intelligence", color: "var(--orange)" },
  { href: "backlog", icon: Layers, label: "Backlog", desc: "Epics, stories, and tasks", color: "var(--blue)" },
  { href: "roadmap", icon: Map, label: "Roadmap", desc: "Release phases and planning", color: "var(--green)" },
  { href: "chat", icon: MessageSquare, label: "Chat", desc: "Your AI PM co-pilot", color: "var(--ac-1)" },
];

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/projects/${id}`).then(r => r.json())
      .then(d => { setProject(d); setLoading(false); }).catch(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div style={{ padding: "32px" }}>
      <div className="skeleton" style={{ height: "80px", borderRadius: "12px", marginBottom: "24px" }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
        {[1, 2, 3, 4, 5, 6, 7].map(i => <div key={i} className="skeleton" style={{ height: "100px", borderRadius: "12px" }} />)}
      </div>
    </div>
  );

  if (!project) return <div style={{ padding: "32px", color: "var(--tx-3)" }}>Project not found.</div>;

  return (
    <div style={{ minHeight: "100vh" }}>
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{
            width: "36px", height: "36px", borderRadius: "10px",
            background: "var(--ac-3)", border: "1px solid var(--bd-ac)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: 700, color: "var(--ac-1)",
          }}>
            {project.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h1 className="page-title" style={{ fontSize: "18px" }}>{project.name}</h1>
            {project.description && <p className="page-subtitle">{project.description}</p>}
          </div>
        </div>
        <Link href={`/projects/${id}/chat`} className="btn btn-secondary" style={{ gap: "6px" }}>
          <MessageSquare size={13} /> Open Chat
        </Link>
      </div>

      <div style={{ padding: "32px", maxWidth: "900px" }}>
        {/* Breadcrumb */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "28px", fontSize: "12px", color: "var(--tx-3)" }}>
          <Link href="/projects" style={{ color: "var(--tx-3)", textDecoration: "none" }}>Projects</Link>
          <ChevronRight size={12} />
          <span style={{ color: "var(--tx-1)" }}>{project.name}</span>
        </div>

        {/* Section grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "12px" }}>
          {sections.map((s) => (
            <Link
              key={s.href}
              href={`/projects/${id}/${s.href}`}
              className="card card-interactive"
              style={{ padding: "20px", textDecoration: "none", display: "block" }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "14px" }}>
                <div style={{
                  width: "34px", height: "34px", borderRadius: "9px",
                  background: "var(--bg-3)", border: "1px solid var(--bd-1)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: s.color,
                }}>
                  <s.icon size={15} />
                </div>
                <ArrowRight size={13} style={{ color: "var(--tx-4)", marginTop: "2px" }} />
              </div>
              <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--tx-1)", marginBottom: "3px" }}>{s.label}</p>
              <p style={{ fontSize: "12px", color: "var(--tx-3)", lineHeight: 1.5 }}>{s.desc}</p>
            </Link>
          ))}
        </div>

        {/* Getting started CTA */}
        <div className="card" style={{ marginTop: "24px", padding: "18px 20px", display: "flex", alignItems: "center", gap: "16px", background: "var(--ac-4)", borderColor: "var(--bd-ac)" }}>
          <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "var(--ac-3)", border: "1px solid var(--bd-ac)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Inbox size={15} style={{ color: "var(--ac-1)" }} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: "13px", fontWeight: 500, color: "var(--tx-1)", marginBottom: "2px" }}>Start with Discovery</p>
            <p style={{ fontSize: "12px", color: "var(--tx-3)" }}>Upload call transcripts, research docs, or meeting notes to get started.</p>
          </div>
          <Link href={`/projects/${id}/discovery`} className="btn btn-primary btn-sm" style={{ flexShrink: 0 }}>
            Upload docs →
          </Link>
        </div>
      </div>
    </div>
  );
}

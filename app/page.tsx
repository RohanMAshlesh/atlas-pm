"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, ArrowRight, Clock, FolderOpen, Zap, Lock } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface Project {
  id: string;
  name: string;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => { setProjects(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-base)" }}>
      {/* Hero header */}
      <div style={{
        padding: "48px 40px 32px",
        background: "linear-gradient(180deg, var(--bg-1) 0%, var(--bg-base) 100%)",
        borderBottom: "1px solid var(--bd-1)",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Grid pattern */}
        <div style={{
          position: "absolute", inset: 0, opacity: 0.4,
          backgroundImage: "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }} />
        {/* Glow */}
        <div style={{
          position: "absolute", top: "-40px", left: "40px",
          width: "300px", height: "200px",
          background: "radial-gradient(ellipse, rgba(232,168,76,0.08) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />
        <div style={{ position: "relative", maxWidth: "880px" }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
            <div>
              <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--ac-1)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "10px" }}>
                Atlas PM Agent
              </p>
              <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "36px", color: "var(--tx-1)", lineHeight: 1.15, marginBottom: "10px" }}>
                Good to see you.
              </h1>
              <p style={{ fontSize: "14px", color: "var(--tx-2)", maxWidth: "400px", lineHeight: 1.6 }}>
                {projects.length > 0
                  ? `You have ${projects.length} active project${projects.length !== 1 ? "s" : ""}. Where are we picking up?`
                  : "Your PM workspace is ready. Start by creating a project."}
              </p>
            </div>
            <Link href="/projects/new" className="btn btn-primary btn-lg">
              <Plus size={15} /> New Project
            </Link>
          </div>
        </div>
      </div>

      <div style={{ padding: "32px 40px", maxWidth: "920px" }}>
        {/* Quick actions */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "40px" }}>
          {[
            { href: "/projects/new", icon: Plus, label: "New Project", desc: "Start from scratch", accent: true },
            { href: "/projects", icon: FolderOpen, label: "All Projects", desc: `${projects.length} workspace${projects.length !== 1 ? "s" : ""}`, accent: false },
            { href: "/settings", icon: Zap, label: "Configure AI", desc: "Set your API keys", accent: false },
          ].map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="card card-interactive card-p"
              style={{
                display: "flex", gap: "14px", alignItems: "flex-start",
                ...(a.accent ? { background: "var(--ac-4)", borderColor: "var(--bd-ac)" } : {}),
              }}
            >
              <div style={{
                width: "36px", height: "36px", borderRadius: "10px",
                background: a.accent ? "var(--ac-3)" : "var(--bg-3)",
                border: `1px solid ${a.accent ? "var(--bd-ac)" : "var(--bd-1)"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, color: a.accent ? "var(--ac-1)" : "var(--tx-2)",
              }}>
                <a.icon size={16} />
              </div>
              <div>
                <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--tx-1)", marginBottom: "2px" }}>{a.label}</p>
                <p style={{ fontSize: "12px", color: "var(--tx-3)" }}>{a.desc}</p>
              </div>
            </Link>
          ))}
        </div>

        {/* Recent projects */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
            <p style={{ fontSize: "11px", fontWeight: 600, color: "var(--tx-3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Recent Projects
            </p>
            <Link href="/projects" style={{ fontSize: "12px", color: "var(--ac-1)", display: "flex", alignItems: "center", gap: "4px", textDecoration: "none" }}>
              View all <ArrowRight size={12} />
            </Link>
          </div>

          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {[1, 2, 3].map((i) => (
                <div key={i} className="skeleton" style={{ height: "72px", borderRadius: "12px" }} />
              ))}
            </div>
          ) : projects.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: "56px 32px" }}>
              <div className="empty-state-icon" style={{ margin: "0 auto 16px" }}><FolderOpen size={20} /></div>
              <p className="empty-state-title">No projects yet</p>
              <p className="empty-state-desc">Create your first project to start working with Atlas.</p>
              <Link href="/projects/new" className="btn btn-primary">
                <Plus size={14} /> Create Project
              </Link>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {projects.slice(0, 5).map((p) => (
                <Link
                  key={p.id}
                  href={`/projects/${p.id}`}
                  className="card card-interactive"
                  style={{ display: "flex", alignItems: "center", gap: "14px", padding: "14px 18px", textDecoration: "none" }}
                >
                  <div style={{
                    width: "36px", height: "36px", borderRadius: "10px",
                    background: "var(--bg-3)", border: "1px solid var(--bd-1)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--tx-2)",
                    flexShrink: 0, fontWeight: 600,
                  }}>
                    {p.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: "13px", fontWeight: 500, color: "var(--tx-1)", marginBottom: "2px" }}>{p.name}</p>
                    {p.description && (
                      <p style={{ fontSize: "12px", color: "var(--tx-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.description}</p>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--tx-3)", fontSize: "12px", flexShrink: 0 }}>
                    <Clock size={11} />
                    {formatDate(p.updated_at || p.created_at)}
                  </div>
                  <ArrowRight size={14} style={{ color: "var(--tx-4)", flexShrink: 0 }} />
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Privacy notice */}
        <div style={{ marginTop: "48px", paddingTop: "24px", borderTop: "1px solid var(--bd-1)", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
          <Lock size={11} style={{ color: "var(--tx-4)" }} />
          <p style={{ fontSize: "11px", color: "var(--tx-4)" }}>Your data stays on your machine. Only AI API calls leave this device.</p>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, FolderOpen, Search, Trash2, ArrowRight } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { toast } from "@/components/ui/toaster";

interface Project {
  id: string; name: string; description: string | null;
  status: string; created_at: string; updated_at: string;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetch_ = () => {
    fetch("/api/projects").then(r => r.json())
      .then(d => { setProjects(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  };
  useEffect(() => { fetch_(); }, []);

  const del = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    toast({ title: "Project deleted" });
    fetch_();
  };

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.description || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ minHeight: "100vh" }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Projects</h1>
          <p className="page-subtitle">{projects.length} workspace{projects.length !== 1 ? "s" : ""}</p>
        </div>
        <Link href="/projects/new" className="btn btn-primary">
          <Plus size={14} /> New Project
        </Link>
      </div>

      <div style={{ padding: "24px 32px", maxWidth: "860px" }}>
        {/* Search */}
        <div className="search-wrap" style={{ marginBottom: "20px", maxWidth: "380px" }}>
          <Search size={14} className="search-icon" />
          <input
            className="input search-input"
            placeholder="Search projects..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {[1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ height: "76px", borderRadius: "12px" }} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="card" style={{ padding: "56px", textAlign: "center" }}>
            <div className="empty-state-icon" style={{ margin: "0 auto 16px" }}><FolderOpen size={20} /></div>
            <p className="empty-state-title">{search ? "No matches" : "No projects yet"}</p>
            <p className="empty-state-desc">{search ? "Try a different search term." : "Create your first project to get started."}</p>
            {!search && <Link href="/projects/new" className="btn btn-primary"><Plus size={14} /> Create Project</Link>}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {filtered.map(p => (
              <div
                key={p.id}
                className="card"
                style={{ display: "flex", alignItems: "center", gap: "14px", padding: "14px 18px" }}
              >
                <Link href={`/projects/${p.id}`} style={{ display: "flex", alignItems: "center", gap: "14px", flex: 1, minWidth: 0, textDecoration: "none" }}>
                  <div style={{
                    width: "38px", height: "38px", borderRadius: "10px",
                    background: "var(--bg-3)", border: "1px solid var(--bd-1)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: 700,
                    color: "var(--tx-2)", flexShrink: 0,
                  }}>
                    {p.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--tx-1)" }}>{p.name}</p>
                      {p.status === "archived" && <span className="badge badge-default">archived</span>}
                    </div>
                    {p.description && (
                      <p style={{ fontSize: "12px", color: "var(--tx-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.description}</p>
                    )}
                    <p style={{ fontSize: "11px", color: "var(--tx-4)", marginTop: "2px" }}>{formatDate(p.created_at)}</p>
                  </div>
                </Link>
                <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
                  <button className="btn btn-icon btn-ghost btn-danger" onClick={() => del(p.id, p.name)}>
                    <Trash2 size={13} />
                  </button>
                  <Link href={`/projects/${p.id}`} className="btn btn-icon btn-ghost">
                    <ArrowRight size={13} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

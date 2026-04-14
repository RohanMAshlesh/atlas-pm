"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Zap } from "lucide-react";
import Link from "next/link";
import { toast } from "@/components/ui/toaster";

export default function NewProjectPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", description: "", company_context: "" });
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const p = await res.json();
      if (p.id) { toast({ title: "Project created!", variant: "success" }); router.push(`/projects/${p.id}`); }
    } catch { toast({ title: "Failed", variant: "error" }); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: "100vh" }}>
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <Link href="/projects" className="btn btn-ghost btn-icon"><ArrowLeft size={15} /></Link>
          <div>
            <h1 className="page-title">New Project</h1>
            <p className="page-subtitle">Set up your product workspace</p>
          </div>
        </div>
      </div>

      <div style={{ padding: "40px 32px", maxWidth: "520px" }}>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div>
            <label className="input-label">Project Name *</label>
            <input className="input" placeholder="e.g. Atlas Payments Platform" value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })} required autoFocus />
          </div>
          <div>
            <label className="input-label">Description</label>
            <textarea className="input" rows={3} placeholder="What are you building?"
              value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          </div>
          <div>
            <label className="input-label">Company Context</label>
            <textarea className="input" rows={3}
              placeholder="Company stage, target market, industry... This is injected into every AI prompt."
              value={form.company_context} onChange={e => setForm({ ...form, company_context: e.target.value })} />
            <p style={{ fontSize: "11px", color: "var(--tx-4)", marginTop: "6px" }}>
              Helps Atlas generate more relevant outputs for your specific context.
            </p>
          </div>
          <button type="submit" disabled={loading || !form.name.trim()} className="btn btn-primary btn-lg" style={{ width: "100%", justifyContent: "center" }}>
            {loading ? <><span className="dot-pulse" /> Creating...</> : <><Zap size={15} /> Create Project</>}
          </button>
        </form>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Save, Eye, EyeOff, Zap, Search, Box, Settings, ExternalLink } from "lucide-react";
import { toast } from "@/components/ui/toaster";

const MODELS = [
  "anthropic/claude-sonnet-4", "anthropic/claude-opus-4", "anthropic/claude-haiku-4-5",
  "openai/gpt-4o", "openai/gpt-4o-mini", "google/gemini-pro-1.5", "meta-llama/llama-3.1-70b-instruct",
];

const SEARCH_PROVIDERS = [
  { value: "none",   label: "None (disabled)" },
  { value: "tavily", label: "Tavily" },
  { value: "serper", label: "Serper" },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    openrouter_api_key: "", default_model: "anthropic/claude-sonnet-4",
    temperature: "0.3", search_provider: "none", search_api_key: "",
    default_pm_tool: "generic", story_point_scale: "fibonacci", company_name: "",
  });
  const [showKey, setShowKey] = useState(false);
  const [showSearchKey, setShowSearchKey] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/settings").then(r => r.json()).then(d => {
      if (d && typeof d === "object") setSettings(p => ({ ...p, ...d }));
    });
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) });
      toast({ title: "Settings saved", variant: "success" });
    } catch { toast({ title: "Failed to save", variant: "error" }); }
    finally { setSaving(false); }
  };

  const set = (k: string, v: string) => setSettings(p => ({ ...p, [k]: v }));

  const SectionHeader = ({ icon: Icon, title }: { icon: React.ElementType; title: string }) => (
    <div className="flex items-center gap-2" style={{ marginBottom: "14px" }}>
      <div style={{
        width: "28px", height: "28px", borderRadius: "var(--r-md)",
        background: "var(--ac-3)", border: "1px solid var(--bd-ac)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Icon size={13} style={{ color: "var(--ac-1)" }} />
      </div>
      <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--tx-1)" }}>{title}</span>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh" }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Configure your Atlas workspace.</p>
        </div>
        <button onClick={save} disabled={saving} className="btn btn-primary">
          {saving ? <><span className="dot-pulse" /> Saving...</> : <><Save size={14} /> Save</>}
        </button>
      </div>

      <div className="flex flex-col gap-6" style={{ padding: "32px", maxWidth: "560px" }}>

        {/* AI Configuration */}
        <div className="card card-p">
          <SectionHeader icon={Zap} title="AI Configuration" />
          <div className="flex flex-col gap-4">
            <div>
              <label className="input-label">OpenRouter API Key</label>
              <div style={{ position: "relative" }}>
                <input
                  type={showKey ? "text" : "password"}
                  className="input"
                  placeholder="sk-or-..."
                  value={settings.openrouter_api_key}
                  onChange={e => set("openrouter_api_key", e.target.value)}
                  style={{ paddingRight: "40px" }}
                />
                <button
                  onClick={() => setShowKey(!showKey)}
                  style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--tx-3)", cursor: "pointer" }}
                >
                  {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <p style={{ fontSize: "11px", color: "var(--tx-4)", marginTop: "6px", display: "flex", alignItems: "center", gap: "4px" }}>
                Get your key at openrouter.ai — stored locally only.
                <a href="https://openrouter.ai/keys" target="_blank" rel="noopener" style={{ color: "var(--ac-1)" }}>
                  <ExternalLink size={10} />
                </a>
              </p>
            </div>

            <div>
              <label className="input-label">Model</label>
              <select className="input" value={settings.default_model} onChange={e => set("default_model", e.target.value)}>
                {MODELS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            <div>
              <label className="input-label">Temperature — {settings.temperature}</label>
              <input
                type="range" min="0" max="1" step="0.1"
                value={settings.temperature}
                onChange={e => set("temperature", e.target.value)}
                style={{ width: "100%", accentColor: "var(--ac-1)" }}
              />
              <div className="flex justify-between" style={{ fontSize: "11px", color: "var(--tx-4)", marginTop: "4px" }}>
                <span>0 — Precise</span><span>1 — Creative</span>
              </div>
            </div>
          </div>
        </div>

        {/* Search Configuration */}
        <div className="card card-p">
          <SectionHeader icon={Search} title="Search Configuration" />
          <div className="flex flex-col gap-4">
            <div>
              <label className="input-label">Search Provider</label>
              <select className="input" value={settings.search_provider} onChange={e => set("search_provider", e.target.value)}>
                {SEARCH_PROVIDERS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            {settings.search_provider !== "none" && (
              <div>
                <label className="input-label">Search API Key</label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showSearchKey ? "text" : "password"}
                    className="input"
                    placeholder="API key..."
                    value={settings.search_api_key}
                    onChange={e => set("search_api_key", e.target.value)}
                    style={{ paddingRight: "40px" }}
                  />
                  <button
                    onClick={() => setShowSearchKey(!showSearchKey)}
                    style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--tx-3)", cursor: "pointer" }}
                  >
                    {showSearchKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Export Defaults */}
        <div className="card card-p">
          <SectionHeader icon={Box} title="Export Defaults" />
          <div className="flex flex-col gap-4">
            <div>
              <label className="input-label">Default PM Tool</label>
              <select className="input" value={settings.default_pm_tool} onChange={e => set("default_pm_tool", e.target.value)}>
                {["Jira", "Linear", "Asana", "Shortcut", "Generic"].map(t => (
                  <option key={t} value={t.toLowerCase()}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="input-label">Story Point Scale</label>
              <select className="input" value={settings.story_point_scale} onChange={e => set("story_point_scale", e.target.value)}>
                <option value="fibonacci">Fibonacci (1,2,3,5,8,13)</option>
                <option value="linear">Linear (1–10)</option>
                <option value="tshirt">T-shirt (XS, S, M, L, XL)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Project Defaults */}
        <div className="card card-p">
          <SectionHeader icon={Settings} title="Project Defaults" />
          <div>
            <label className="input-label">Company / Product Context</label>
            <textarea
              className="input"
              rows={3}
              placeholder="Company name, product stage, target market... injected into every AI prompt."
              value={settings.company_name}
              onChange={e => set("company_name", e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center justify-between" style={{ paddingTop: "4px" }}>
          <p style={{ fontSize: "11px", color: "var(--tx-4)" }}>All data stored locally. Nothing sent to servers except AI calls.</p>
          <button onClick={save} disabled={saving} className="btn btn-primary">
            {saving ? <><span className="dot-pulse" /> Saving...</> : <><Save size={14} /> Save Settings</>}
          </button>
        </div>

      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  Zap, ChevronDown, ChevronRight, Plus, Download,
  LayoutList, Columns, Circle, CheckCircle2, Clock, AlertCircle
} from "lucide-react";
import { toast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";
import { ScopedChatBubble } from "@/components/chat/ScopedChatBubble";

interface Task {
  id: string;
  title: string;
  description: string | null;
  technical_details: string | null;
  estimated_hours: number | null;
  labels: string[];
  status: string;
}

interface AcceptanceCriteria {
  given: string;
  when: string;
  then: string;
}

interface Story {
  id: string;
  title: string;
  description: string | null;
  acceptance_criteria: AcceptanceCriteria[];
  story_points: number | null;
  priority: string;
  moscow: string;
  rice_score: { reach: number; impact: number; confidence: number; effort: number; total: number } | null;
  status: string;
  edge_cases: string[];
  tasks: Task[];
}

interface Epic {
  id: string;
  title: string;
  description: string | null;
  objective_ids: string[];
  phase: string | null;
  status: string;
  stories: Story[];
}

const PRIORITY_BAR_CLASS: Record<string, string> = {
  critical: "priority-bar-critical",
  high: "priority-bar-high",
  medium: "priority-bar-medium",
  low: "priority-bar-low",
};

const MOSCOW_LABELS: Record<string, { label: string; style: React.CSSProperties }> = {
  must_have: { label: "Must", style: { color: "var(--red)" } },
  should_have: { label: "Should", style: { color: "var(--yellow)" } },
  could_have: { label: "Could", style: { color: "var(--blue)" } },
  wont_have: { label: "Won't", style: { color: "var(--tx-3)" } },
};

const STATUS_ICON = {
  backlog: Circle,
  in_progress: Clock,
  review: AlertCircle,
  done: CheckCircle2,
};

function getLabelStyle(label: string): React.CSSProperties {
  switch (label) {
    case "frontend": return { background: "var(--blue-dim)", color: "var(--blue)" };
    case "backend": return { background: "var(--green-dim)", color: "var(--green)" };
    case "design": return { background: "var(--ac-3)", color: "var(--ac-1)" };
    case "qa": return { background: "rgba(251,191,36,0.12)", color: "var(--yellow)" };
    case "devops": return { background: "rgba(251,146,60,0.12)", color: "var(--orange)" };
    default: return { background: "var(--bg-3)", color: "var(--tx-2)" };
  }
}

type ViewMode = "list" | "board";

export default function BacklogPage() {
  const { id } = useParams<{ id: string }>();
  const [epics, setEpics] = useState<Epic[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingEpics, setGeneratingEpics] = useState(false);
  const [generatingStories, setGeneratingStories] = useState<string | null>(null);
  const [generatingTasks, setGeneratingTasks] = useState<string | null>(null);
  const [generatingFull, setGeneratingFull] = useState(false);
  const [fullProgress, setFullProgress] = useState<string | null>(null);
  const [expandedEpics, setExpandedEpics] = useState<Set<string>>(new Set());
  const [expandedStories, setExpandedStories] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  const fetchBacklog = () => {
    fetch(`/api/projects/${id}/backlog`)
      .then((r) => r.json())
      .then((data) => { setEpics(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchBacklog(); }, [id]);

  const streamHelper = async (
    url: string,
    body: object,
    onDone: (data: any) => void,
    onError?: (msg: string) => void
  ) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
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
            if (data.done) onDone(data);
            if (data.error) onError?.(data.error);
          } catch {}
        }
      }
    }
  };

  const generateEpics = async () => {
    setGeneratingEpics(true);
    try {
      await streamHelper(
        "/api/ai/epics",
        { project_id: id },
        (data) => {
          toast({ title: `${data.count} epics generated!`, variant: "success" });
          fetchBacklog();
        },
        (err) => toast({ title: err, variant: "error" })
      );
    } catch { toast({ title: "Failed to generate epics", variant: "error" }); }
    finally { setGeneratingEpics(false); }
  };

  const generateStories = async (epicId: string) => {
    setGeneratingStories(epicId);
    try {
      await streamHelper(
        "/api/ai/stories",
        { project_id: id, epic_id: epicId },
        (data) => {
          toast({ title: `${data.count} stories generated!`, variant: "success" });
          fetchBacklog();
        },
        (err) => toast({ title: err, variant: "error" })
      );
    } catch { toast({ title: "Failed to generate stories", variant: "error" }); }
    finally { setGeneratingStories(null); }
  };

  const generateFullBacklog = async () => {
    setGeneratingFull(true);
    setFullProgress("Starting...");
    try {
      const res = await fetch("/api/ai/full-backlog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        toast({ title: err.error || "Failed to start generation", variant: "error" });
        return;
      }
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
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.error) {
              toast({ title: data.error, variant: "error" });
              continue;
            }
            if (data.stage === "epics" && data.status === "start") setFullProgress("Generating epics...");
            if (data.stage === "epics" && data.status === "done") setFullProgress(`${data.count} epics created. Generating stories...`);
            if (data.stage === "stories" && data.status === "start") setFullProgress(`Stories for "${data.epic?.title}"...`);
            if (data.stage === "stories" && data.status === "done") setFullProgress(`${data.count} stories for "${data.epic?.title}"`);
            if (data.stage === "tasks" && data.status === "start") setFullProgress(`Tasks for "${data.story?.title}"...`);
            if (data.done) {
              const s = data.summary || {};
              toast({ title: `Backlog generated: ${s.epics} epics, ${s.stories} stories, ${s.tasks} tasks`, variant: "success" });
              fetchBacklog();
            }
          } catch {}
        }
      }
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Failed to generate backlog", variant: "error" });
    } finally {
      setGeneratingFull(false);
      setFullProgress(null);
    }
  };

  const generateTasks = async (storyId: string) => {
    setGeneratingTasks(storyId);
    try {
      await streamHelper(
        "/api/ai/tasks",
        { project_id: id, story_id: storyId },
        (data) => {
          toast({ title: `${data.count} tasks generated!`, variant: "success" });
          fetchBacklog();
        },
        (err) => toast({ title: err, variant: "error" })
      );
    } catch { toast({ title: "Failed to generate tasks", variant: "error" }); }
    finally { setGeneratingTasks(null); }
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(epics, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "backlog.json"; a.click();
  };

  const exportJiraCSV = () => {
    const rows = ["Issue Type,Summary,Description,Story Points,Priority,Labels,Epic Link"];
    for (const epic of epics) {
      rows.push(`Epic,${epic.title},${epic.description || ""},,,,`);
      for (const story of epic.stories) {
        rows.push(`Story,${story.title},"${story.description || ""}",${story.story_points || ""},${story.priority},,${epic.id}`);
        for (const task of story.tasks) {
          rows.push(`Sub-task,${task.title},"${task.description || ""}",,,,`);
        }
      }
    }
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "backlog-jira.csv"; a.click();
  };

  const totalStories = epics.reduce((sum, e) => sum + e.stories.length, 0);
  const totalPoints = epics.reduce((sum, e) => sum + e.stories.reduce((s2, st) => s2 + (st.story_points || 0), 0), 0);

  if (loading) return (
    <div style={{ padding: "2rem", maxWidth: "56rem" }}>
      {[1, 2, 3].map((i) => (
        <div key={i} className="skeleton" style={{ height: "4rem", borderRadius: "0.5rem", marginBottom: "0.75rem" }} />
      ))}
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-1)" }}>
      {/* Page header */}
      <div style={{ borderBottom: "1px solid var(--bd-1)", padding: "1.25rem 2rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", maxWidth: "64rem" }}>
          <div>
            <h1 className="font-serif" style={{ fontSize: "1.5rem", color: "var(--tx-1)" }}>Backlog</h1>
            <p style={{ color: "var(--tx-2)", fontSize: "0.875rem", marginTop: "0.125rem" }}>
              {epics.length} epic{epics.length !== 1 ? "s" : ""} · {totalStories} stories · {totalPoints} pts
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {/* View mode toggle */}
            <div style={{ display: "flex", alignItems: "center", border: "1px solid var(--bd-1)", borderRadius: "0.5rem", overflow: "hidden" }}>
              <button
                onClick={() => setViewMode("list")}
                style={{
                  padding: "0.375rem 0.75rem",
                  fontSize: "0.75rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.375rem",
                  background: viewMode === "list" ? "var(--ac-3)" : "transparent",
                  color: viewMode === "list" ? "var(--ac-1)" : "var(--tx-2)",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                <LayoutList style={{ width: "0.875rem", height: "0.875rem" }} /> List
              </button>
              <button
                onClick={() => setViewMode("board")}
                style={{
                  padding: "0.375rem 0.75rem",
                  fontSize: "0.75rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.375rem",
                  borderLeft: "1px solid var(--bd-1)",
                  background: viewMode === "board" ? "var(--ac-3)" : "transparent",
                  color: viewMode === "board" ? "var(--ac-1)" : "var(--tx-2)",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                <Columns style={{ width: "0.875rem", height: "0.875rem" }} /> Board
              </button>
            </div>
            {epics.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                <button onClick={exportJiraCSV} className="btn btn-secondary" style={{ fontSize: "0.75rem" }}>Jira CSV</button>
                <button onClick={exportJSON} className="btn btn-secondary" style={{ fontSize: "0.75rem" }}>JSON</button>
              </div>
            )}
            {epics.length === 0 ? (
              <button
                onClick={generateFullBacklog}
                disabled={generatingFull}
                className="btn btn-primary"
                style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
                title="Generate epics, stories, and tasks in one pass"
              >
                {generatingFull
                  ? <><span className="dot-pulse" /> {fullProgress || "Generating..."}</>
                  : <><Zap style={{ width: "1rem", height: "1rem" }} /> Generate Full Backlog</>
                }
              </button>
            ) : (
              <button onClick={generateEpics} disabled={generatingEpics} className="btn btn-primary" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                {generatingEpics
                  ? <><span className="dot-pulse" /> Generating...</>
                  : <><Zap style={{ width: "1rem", height: "1rem" }} /> Regen Epics</>
                }
              </button>
            )}
          </div>
        </div>
      </div>

      <div style={{ padding: "1.5rem 2rem", maxWidth: "64rem" }}>
        {epics.length === 0 ? (
          /* Empty state */
          <div className="card card-p" style={{ textAlign: "center" }}>
            <div style={{
              width: "3rem",
              height: "3rem",
              borderRadius: "50%",
              background: "var(--ac-3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 1rem",
            }}>
              <Zap style={{ width: "1.5rem", height: "1.5rem", color: "var(--ac-1)" }} />
            </div>
            <p style={{ color: "var(--tx-2)", marginBottom: "0.5rem" }}>No backlog yet.</p>
            <p style={{ fontSize: "0.75rem", color: "var(--tx-3)", marginBottom: "1rem" }}>
              Generate a PRD first, then break it into epics → stories → tasks.
            </p>
            <button onClick={generateEpics} disabled={generatingEpics} className="btn btn-primary">
              {generatingEpics ? "Generating..." : "Generate Backlog"}
            </button>
          </div>
        ) : viewMode === "list" ? (
          /* List View */
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {epics.map((epic) => {
              const epicExpanded = expandedEpics.has(epic.id);
              return (
                <div key={epic.id} className="card" style={{ overflow: "hidden" }}>
                  {/* Epic header */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.75rem",
                      padding: "1rem 1.25rem",
                      cursor: "pointer",
                    }}
                    className="card-interactive"
                    onClick={() => {
                      setExpandedEpics((prev) => {
                        const next = new Set(prev);
                        if (next.has(epic.id)) next.delete(epic.id); else next.add(epic.id);
                        return next;
                      });
                    }}
                  >
                    {epicExpanded
                      ? <ChevronDown style={{ width: "1rem", height: "1rem", color: "var(--tx-3)", flexShrink: 0 }} />
                      : <ChevronRight style={{ width: "1rem", height: "1rem", color: "var(--tx-3)", flexShrink: 0 }} />
                    }
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span className="item-id">{epic.id}</span>
                        <span style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--tx-1)" }}>{epic.title}</span>
                        {epic.phase && (
                          <span style={{
                            fontSize: "0.75rem",
                            padding: "0.125rem 0.375rem",
                            borderRadius: "0.25rem",
                            background: "var(--bg-3)",
                            color: "var(--tx-2)",
                            border: "1px solid var(--bd-1)",
                          }}>
                            {epic.phase}
                          </span>
                        )}
                      </div>
                      {epic.description && (
                        <p style={{ fontSize: "0.75rem", color: "var(--tx-2)", marginTop: "0.125rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {epic.description}
                        </p>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexShrink: 0 }}>
                      <span style={{ fontSize: "0.75rem", color: "var(--tx-3)" }}>{epic.stories.length} stories</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); generateStories(epic.id); }}
                        disabled={!!generatingStories}
                        className="btn btn-ghost btn-sm"
                        style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}
                      >
                        {generatingStories === epic.id
                          ? <><span className="dot-pulse" /> Generating...</>
                          : <><Plus style={{ width: "0.875rem", height: "0.875rem" }} /> Stories</>
                        }
                      </button>
                    </div>
                  </div>

                  {/* Stories */}
                  {epicExpanded && (
                    <div style={{ borderTop: "1px solid var(--bd-1)" }}>
                      {epic.stories.length === 0 ? (
                        <div style={{ padding: "1rem 1.25rem", fontSize: "0.75rem", color: "var(--tx-3)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <Circle style={{ width: "0.875rem", height: "0.875rem" }} />
                          No stories yet.
                          <button
                            onClick={() => generateStories(epic.id)}
                            disabled={!!generatingStories}
                            style={{ color: "var(--ac-1)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
                          >
                            Generate stories →
                          </button>
                        </div>
                      ) : (
                        <div>
                          {epic.stories.map((story, idx) => {
                            const storyExpanded = expandedStories.has(story.id);
                            const moscow = MOSCOW_LABELS[story.moscow] || { label: story.moscow, style: { color: "var(--tx-3)" } };
                            const priorityBarClass = PRIORITY_BAR_CLASS[story.priority];
                            return (
                              <div key={story.id} style={{ borderTop: idx === 0 ? undefined : "1px solid var(--bd-1)" }}>
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "0.75rem",
                                    padding: "0.75rem 1.25rem 0.75rem 2.5rem",
                                    cursor: "pointer",
                                  }}
                                  className="card-interactive"
                                  onClick={() => {
                                    setExpandedStories((prev) => {
                                      const next = new Set(prev);
                                      if (next.has(story.id)) next.delete(story.id); else next.add(story.id);
                                      return next;
                                    });
                                  }}
                                >
                                  <div className={priorityBarClass || ""} style={priorityBarClass ? { width: "0.25rem", height: "2rem", borderRadius: "9999px", flexShrink: 0 } : { width: "0.25rem", height: "2rem", borderRadius: "9999px", flexShrink: 0, background: "var(--bg-hover)" }} />
                                  {storyExpanded
                                    ? <ChevronDown style={{ width: "0.875rem", height: "0.875rem", color: "var(--tx-3)" }} />
                                    : <ChevronRight style={{ width: "0.875rem", height: "0.875rem", color: "var(--tx-3)" }} />
                                  }
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                      <span className="item-id">{story.id}</span>
                                      <span style={{ fontSize: "0.875rem", color: "var(--tx-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{story.title}</span>
                                    </div>
                                    {story.description && (
                                      <p style={{ fontSize: "0.75rem", color: "var(--tx-3)", marginTop: "0.125rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        {story.description}
                                      </p>
                                    )}
                                  </div>
                                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
                                    <span style={{ fontSize: "0.75rem", fontWeight: 500, ...moscow.style }}>{moscow.label}</span>
                                    {story.story_points && (
                                      <span className="font-mono" style={{ fontSize: "0.75rem", padding: "0.125rem 0.375rem", borderRadius: "0.25rem", background: "var(--bg-3)", color: "var(--tx-2)" }}>
                                        {story.story_points}pt
                                      </span>
                                    )}
                                    {story.rice_score && (
                                      <span style={{ fontSize: "0.75rem", color: "var(--tx-3)" }}>RICE: {story.rice_score.total}</span>
                                    )}
                                    <button
                                      onClick={(e) => { e.stopPropagation(); generateTasks(story.id); }}
                                      disabled={!!generatingTasks}
                                      className="btn btn-ghost btn-sm"
                                    >
                                      {generatingTasks === story.id
                                        ? <span className="dot-pulse" />
                                        : <Plus style={{ width: "0.75rem", height: "0.75rem" }} />
                                      }
                                    </button>
                                  </div>
                                </div>

                                {/* Story detail */}
                                {storyExpanded && (
                                  <div style={{ background: "var(--bg-3)", borderTop: "1px solid var(--bd-1)", padding: "1rem 1.25rem 1rem 4rem" }}>
                                    {story.acceptance_criteria?.length > 0 && (
                                      <div style={{ marginBottom: "0.75rem" }}>
                                        <p className="input-label" style={{ marginBottom: "0.5rem" }}>Acceptance Criteria</p>
                                        {story.acceptance_criteria.map((ac, i) => (
                                          <div key={i} style={{ marginBottom: "0.5rem", fontSize: "0.75rem" }}>
                                            <span style={{ color: "var(--tx-3)" }}>Given</span>{" "}
                                            <span style={{ color: "var(--tx-2)" }}>{ac.given}</span><br />
                                            <span style={{ color: "var(--tx-3)" }}>When</span>{" "}
                                            <span style={{ color: "var(--tx-2)" }}>{ac.when}</span><br />
                                            <span style={{ color: "var(--tx-3)" }}>Then</span>{" "}
                                            <span style={{ color: "var(--tx-2)" }}>{ac.then}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                    {story.edge_cases?.length > 0 && (
                                      <div style={{ marginBottom: "0.75rem" }}>
                                        <p className="input-label" style={{ marginBottom: "0.5rem" }}>Edge Cases</p>
                                        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                                          {story.edge_cases.map((ec, i) => (
                                            <li key={i} style={{ fontSize: "0.75rem", color: "var(--tx-2)" }}>⚠ {ec}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}

                                    {/* Tasks */}
                                    {story.tasks.length > 0 && (
                                      <div>
                                        <p className="input-label" style={{ marginBottom: "0.5rem" }}>Tasks ({story.tasks.length})</p>
                                        <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                                          {story.tasks.map((task) => (
                                            <div key={task.id} style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", background: "var(--bg-2)", borderRadius: "0.375rem", padding: "0.5rem 0.75rem" }}>
                                              <span className="item-id" style={{ marginTop: "0.125rem" }}>{task.id}</span>
                                              <div style={{ flex: 1, minWidth: 0 }}>
                                                <p style={{ fontSize: "0.75rem", color: "var(--tx-1)" }}>{task.title}</p>
                                                {task.estimated_hours && (
                                                  <p style={{ fontSize: "0.75rem", color: "var(--tx-3)" }}>{task.estimated_hours}h</p>
                                                )}
                                              </div>
                                              <div style={{ display: "flex", gap: "0.25rem" }}>
                                                {task.labels?.map((label) => (
                                                  <span key={label} style={{ fontSize: "0.75rem", padding: "0.125rem 0.375rem", borderRadius: "0.25rem", ...getLabelStyle(label) }}>
                                                    {label}
                                                  </span>
                                                ))}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    {story.tasks.length === 0 && (
                                      <button
                                        onClick={() => generateTasks(story.id)}
                                        disabled={!!generatingTasks}
                                        className="btn btn-ghost btn-sm"
                                      >
                                        {generatingTasks === story.id ? "Generating tasks..." : "+ Generate tasks"}
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* Board View */
          <div style={{ display: "flex", gap: "1rem", overflowX: "auto", paddingBottom: "1rem" }}>
            {["backlog", "in_progress", "review", "done"].map((status) => {
              const statusStories = epics.flatMap((e) => e.stories.filter((s) => s.status === status));
              return (
                <div key={status} style={{ flexShrink: 0, width: "18rem" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                    <h3 style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--tx-2)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      {status.replace("_", " ")}
                    </h3>
                    <span style={{ fontSize: "0.75rem", background: "var(--bg-3)", color: "var(--tx-3)", padding: "0.125rem 0.375rem", borderRadius: "0.25rem" }}>
                      {statusStories.length}
                    </span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {statusStories.map((story) => {
                      const priorityBarClass = PRIORITY_BAR_CLASS[story.priority];
                      return (
                        <div key={story.id} className="card card-p">
                          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem", marginBottom: "0.25rem" }}>
                            <span className="item-id">{story.id}</span>
                            {story.story_points && (
                              <span className="font-mono" style={{ fontSize: "0.75rem", background: "var(--bg-3)", color: "var(--tx-2)", padding: "0.125rem 0.25rem", borderRadius: "0.25rem" }}>
                                {story.story_points}p
                              </span>
                            )}
                          </div>
                          <p style={{ fontSize: "0.75rem", color: "var(--tx-1)", lineHeight: "1.5" }}>{story.title}</p>
                          <div className={priorityBarClass || ""} style={{ width: "100%", height: "0.125rem", marginTop: "0.5rem", borderRadius: "9999px", ...(priorityBarClass ? {} : { background: "var(--bg-hover)" }) }} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ScopedChatBubble
        projectId={id}
        context={{ type: "backlog" }}
        onApplied={() => fetchBacklog()}
      />
    </div>
  );
}

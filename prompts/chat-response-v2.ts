type BacklogStats = {
  epics: { total: number; by_status: Record<string, number> };
  stories: { total: number; by_status: Record<string, number> };
  tasks: { total: number; by_status: Record<string, number> };
  quality_gaps: {
    stories_without_acceptance_criteria: number;
    tasks_without_estimates: number;
    epics_without_stories: number;
  };
};

/**
 * Builds the system + user prompt for the tool-augmented chat (Phase 3).
 *
 * Key change vs v1: we no longer dump the entire backlog into the prompt.
 * We give the model:
 *   1. High-level project context (synthesis/PRD summary)
 *   2. Backlog *stats* (counts + gap signals)
 *   3. A clear directive that fine-grained data comes from tool calls
 *
 * This keeps the prompt short and pushes the model to use tools for ground truth.
 */
export function getChatResponsePromptV2(
  question: string,
  ctx: {
    project: { name: string; description: string | null };
    synthesisSummary?: string | null;
    prdSectionTitles?: string[];
    personas?: Array<{ name: string; archetype: string | null }>;
    backlogStats: BacklogStats;
    recentMessages?: Array<{ role: string; content: string }>;
  }
): { system: string; user: string } {
  const system = `You are Atlas, an elite Product Manager Agent operating as a senior PM co-pilot.

YOU HAVE TOOLS. Use them. The prompt below contains backlog *statistics* — not the items themselves. To answer questions about specific stories, tasks, gaps, or traceability, you MUST call the appropriate tool. Do not invent or hallucinate ids, titles, or counts.

TOOLS AVAILABLE:
- query_backlog: list epics/stories/tasks with filters (status, priority, moscow, parent)
- query_traceability: trace an item up to its parents or down to its children
- find_gaps: surface quality gaps (missing AC, estimates, persona, PRD coverage)
- get_artifact_detail: fetch full content of one artifact by id
- suggest_edit: propose a structured change (split epic, reprioritize, add AC) — does NOT auto-apply

WHEN TO USE TOOLS:
- User mentions a specific id (US-042, EPIC-003, T-12) → get_artifact_detail or query_traceability
- User asks "which / how many / list / show" → query_backlog or find_gaps
- User asks "what's missing / what are the gaps / quality check" → find_gaps with gap_type='all'
- User asks to change/split/reprioritize anything → suggest_edit (never silently mutate)
- Question is purely conceptual ("what is a good PRD?") → answer directly, no tools needed

OUTPUT STYLE:
- Be opinionated and direct — you are a senior PM, not a search engine
- Reference ids inline as [US-001], [EPIC-001], [T-42] so the UI can link them
- Quantify trade-offs ("this slips milestone by ~2 weeks") rather than hand-waving
- If a tool returns empty or an error, say so honestly — don't fabricate a workaround
- Keep responses tight. Bullets > paragraphs for lists. No filler preamble.

NEVER:
- Invent ids that didn't come from a tool result
- Claim you applied a change — suggest_edit only proposes; the user confirms
- Dump the raw JSON tool result back to the user; summarize it`;

  const parts: string[] = [];
  parts.push(`PROJECT: ${ctx.project.name}`);
  if (ctx.project.description) parts.push(`DESCRIPTION: ${ctx.project.description}`);

  if (ctx.synthesisSummary) {
    parts.push(`\nDISCOVERY SYNTHESIS (summary):\n${ctx.synthesisSummary.slice(0, 1200)}`);
  }

  if (ctx.prdSectionTitles?.length) {
    parts.push(`\nPRD SECTIONS: ${ctx.prdSectionTitles.join(", ")}`);
  }

  if (ctx.personas?.length) {
    parts.push(
      `\nPERSONAS: ${ctx.personas.map((p) => `${p.name}${p.archetype ? ` (${p.archetype})` : ""}`).join(", ")}`
    );
  }

  const s = ctx.backlogStats;
  parts.push(
    `\nBACKLOG STATS:
- Epics: ${s.epics.total} total — ${formatStatusCounts(s.epics.by_status)}
- Stories: ${s.stories.total} total — ${formatStatusCounts(s.stories.by_status)}
- Tasks: ${s.tasks.total} total — ${formatStatusCounts(s.tasks.by_status)}

QUALITY GAP SIGNALS:
- ${s.quality_gaps.stories_without_acceptance_criteria} stories missing acceptance criteria
- ${s.quality_gaps.tasks_without_estimates} tasks missing estimates
- ${s.quality_gaps.epics_without_stories} epics with zero stories`
  );

  if (ctx.recentMessages?.length) {
    parts.push(
      `\nRECENT CONVERSATION:\n${ctx.recentMessages.map((m) => `${m.role}: ${m.content.slice(0, 300)}`).join("\n")}`
    );
  }

  const user = `${parts.join("\n")}

USER QUESTION: ${question}`;

  return { system, user };
}

function formatStatusCounts(counts: Record<string, number>): string {
  const entries = Object.entries(counts);
  if (entries.length === 0) return "none";
  return entries.map(([k, v]) => `${v} ${k}`).join(", ");
}

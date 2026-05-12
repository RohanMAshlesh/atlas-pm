import { getDb } from "@/lib/db";
import {
  epics,
  stories,
  tasks,
  personas,
  objectives,
  key_results,
  prds,
} from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

/**
 * Executes a tool call from the chat model against the project's Turso DB.
 * Always returns a JSON-serializable object; the route hands it back to the model
 * as a tool message so the model can reason over the result.
 *
 * Error contract: never throw. Return `{ error: string }` so the model can recover
 * (e.g. by trying a different tool or telling the user the id was wrong).
 */
export async function executeChatTool(
  name: string,
  args: Record<string, unknown>,
  projectId: string
): Promise<unknown> {
  try {
    switch (name) {
      case "query_backlog":
        return await queryBacklog(args, projectId);
      case "query_traceability":
        return await queryTraceability(args, projectId);
      case "find_gaps":
        return await findGaps(args, projectId);
      case "get_artifact_detail":
        return await getArtifactDetail(args, projectId);
      case "suggest_edit":
        return suggestEdit(args);
      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

// ---------- query_backlog ----------

async function queryBacklog(
  args: Record<string, unknown>,
  projectId: string
) {
  const db = await getDb();
  const entity = args.entity as string;
  const limit = (args.limit as number) || 50;

  if (entity === "epic") {
    const rows = await db.select().from(epics).where(eq(epics.project_id, projectId)).all();
    let filtered = rows;
    if (args.status) filtered = filtered.filter((r) => r.status === args.status);
    return {
      count: filtered.length,
      epics: filtered.slice(0, limit).map((e) => ({
        id: e.id,
        title: e.title,
        status: e.status,
        phase: e.phase,
        description: e.description?.slice(0, 200),
      })),
    };
  }

  if (entity === "story") {
    const rows = await db.select().from(stories).where(eq(stories.project_id, projectId)).all();
    let filtered = rows;
    if (args.status) filtered = filtered.filter((r) => r.status === args.status);
    if (args.priority) filtered = filtered.filter((r) => r.priority === args.priority);
    if (args.moscow) filtered = filtered.filter((r) => r.moscow === args.moscow);
    if (args.epic_id) filtered = filtered.filter((r) => r.epic_id === args.epic_id);
    return {
      count: filtered.length,
      stories: filtered.slice(0, limit).map((s) => ({
        id: s.id,
        title: s.title,
        epic_id: s.epic_id,
        status: s.status,
        priority: s.priority,
        moscow: s.moscow,
        story_points: s.story_points,
        has_acceptance_criteria: parseJsonArray(s.acceptance_criteria).length > 0,
      })),
    };
  }

  if (entity === "task") {
    const rows = await db.select().from(tasks).where(eq(tasks.project_id, projectId)).all();
    let filtered = rows;
    if (args.status) filtered = filtered.filter((r) => r.status === args.status);
    if (args.story_id) filtered = filtered.filter((r) => r.story_id === args.story_id);
    return {
      count: filtered.length,
      tasks: filtered.slice(0, limit).map((t) => ({
        id: t.id,
        title: t.title,
        story_id: t.story_id,
        status: t.status,
        estimated_hours: t.estimated_hours,
        arch_component: t.arch_component,
      })),
    };
  }

  return { error: `Unknown entity: ${entity}` };
}

// ---------- query_traceability ----------

async function queryTraceability(
  args: Record<string, unknown>,
  projectId: string
) {
  const db = await getDb();
  const id = args.id as string;
  const direction = (args.direction as string) || "both";
  if (!id) return { error: "id is required" };

  // Find what kind of artifact this id is
  const epic = await db.select().from(epics).where(and(eq(epics.id, id), eq(epics.project_id, projectId))).get();
  const story = await db.select().from(stories).where(and(eq(stories.id, id), eq(stories.project_id, projectId))).get();
  const task = await db.select().from(tasks).where(and(eq(tasks.id, id), eq(tasks.project_id, projectId))).get();

  if (task) {
    const result: Record<string, unknown> = { type: "task", task: { id: task.id, title: task.title } };
    if (direction === "up" || direction === "both") {
      const parentStory = task.story_id
        ? await db.select().from(stories).where(eq(stories.id, task.story_id)).get()
        : null;
      const parentEpic = parentStory?.epic_id
        ? await db.select().from(epics).where(eq(epics.id, parentStory.epic_id)).get()
        : null;
      result.parent_story = parentStory && { id: parentStory.id, title: parentStory.title };
      result.parent_epic = parentEpic && { id: parentEpic.id, title: parentEpic.title };
      result.linked_objective_ids = parentEpic ? parseJsonArray(parentEpic.objective_ids) : [];
    }
    return result;
  }

  if (story) {
    const result: Record<string, unknown> = {
      type: "story",
      story: { id: story.id, title: story.title, moscow: story.moscow, priority: story.priority },
    };
    if (direction === "up" || direction === "both") {
      const parentEpic = story.epic_id
        ? await db.select().from(epics).where(eq(epics.id, story.epic_id)).get()
        : null;
      result.parent_epic = parentEpic && { id: parentEpic.id, title: parentEpic.title };
      result.linked_objective_ids = parentEpic ? parseJsonArray(parentEpic.objective_ids) : [];
    }
    if (direction === "down" || direction === "both") {
      const childTasks = await db.select().from(tasks).where(eq(tasks.story_id, story.id)).all();
      result.tasks = childTasks.map((t) => ({ id: t.id, title: t.title, status: t.status }));
    }
    return result;
  }

  if (epic) {
    const result: Record<string, unknown> = { type: "epic", epic: { id: epic.id, title: epic.title } };
    if (direction === "up" || direction === "both") {
      result.linked_objective_ids = parseJsonArray(epic.objective_ids);
    }
    if (direction === "down" || direction === "both") {
      const childStories = await db.select().from(stories).where(eq(stories.epic_id, epic.id)).all();
      result.stories = childStories.map((s) => ({
        id: s.id,
        title: s.title,
        status: s.status,
        moscow: s.moscow,
      }));
    }
    return result;
  }

  return { error: `No epic, story, or task found with id "${id}" in this project` };
}

// ---------- find_gaps ----------

async function findGaps(args: Record<string, unknown>, projectId: string) {
  const gapType = args.gap_type as string;
  const db = await getDb();

  const checkStoriesWithoutAC = async () => {
    const rows = await db.select().from(stories).where(eq(stories.project_id, projectId)).all();
    const gaps = rows.filter((s) => parseJsonArray(s.acceptance_criteria).length === 0);
    return {
      count: gaps.length,
      total: rows.length,
      items: gaps.slice(0, 25).map((s) => ({ id: s.id, title: s.title })),
    };
  };

  const checkTasksWithoutEstimates = async () => {
    const rows = await db.select().from(tasks).where(eq(tasks.project_id, projectId)).all();
    const gaps = rows.filter((t) => t.estimated_hours == null);
    return {
      count: gaps.length,
      total: rows.length,
      items: gaps.slice(0, 25).map((t) => ({ id: t.id, title: t.title })),
    };
  };

  const checkEpicsWithoutStories = async () => {
    const epicRows = await db.select().from(epics).where(eq(epics.project_id, projectId)).all();
    const storyRows = await db.select().from(stories).where(eq(stories.project_id, projectId)).all();
    const epicsWithStories = new Set(storyRows.map((s) => s.epic_id).filter(Boolean));
    const gaps = epicRows.filter((e) => !epicsWithStories.has(e.id));
    return {
      count: gaps.length,
      total: epicRows.length,
      items: gaps.slice(0, 25).map((e) => ({ id: e.id, title: e.title })),
    };
  };

  const checkStoriesWithoutPersona = async () => {
    const rows = await db.select().from(stories).where(eq(stories.project_id, projectId)).all();
    const gaps = rows.filter((s) => !s.persona_id);
    return {
      count: gaps.length,
      total: rows.length,
      items: gaps.slice(0, 25).map((s) => ({ id: s.id, title: s.title })),
    };
  };

  const checkPrdCoverage = async () => {
    const prd = await db.select().from(prds).where(eq(prds.project_id, projectId)).get();
    if (!prd) return { count: 0, total: 0, items: [], note: "No PRD exists for this project yet" };
    const storyRows = await db.select().from(stories).where(eq(stories.project_id, projectId)).all();

    // Heuristic: extract requirement-like bullets from PRD sections and check if any story title
    // or description references them. Free-text matching is fuzzy by design.
    let prdContent: Record<string, { title?: string; content?: string }> = {};
    try {
      prdContent = JSON.parse(prd.content);
    } catch {
      return { count: 0, total: 0, items: [], note: "PRD content not parseable as JSON" };
    }

    const requirements: string[] = [];
    for (const section of Object.values(prdContent)) {
      const text = section?.content || "";
      const bullets = text
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => /^[-*•]\s+/.test(l))
        .map((l) => l.replace(/^[-*•]\s+/, "").slice(0, 120));
      requirements.push(...bullets);
    }

    const storyText = storyRows
      .map((s) => `${s.title} ${s.description || ""}`.toLowerCase())
      .join(" \n ");

    const uncovered = requirements.filter((req) => {
      const keywords = req
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 4)
        .slice(0, 3);
      if (keywords.length === 0) return false;
      return !keywords.every((k) => storyText.includes(k));
    });

    return {
      count: uncovered.length,
      total: requirements.length,
      items: uncovered.slice(0, 15).map((r) => ({ requirement: r })),
      note: "Coverage is fuzzy keyword-matching — treat as a starting point, not a definitive list",
    };
  };

  if (gapType === "stories_without_acceptance_criteria") return await checkStoriesWithoutAC();
  if (gapType === "tasks_without_estimates") return await checkTasksWithoutEstimates();
  if (gapType === "epics_without_stories") return await checkEpicsWithoutStories();
  if (gapType === "stories_without_persona") return await checkStoriesWithoutPersona();
  if (gapType === "prd_coverage") return await checkPrdCoverage();
  if (gapType === "all") {
    const [ac, est, eps, pers, cov] = await Promise.all([
      checkStoriesWithoutAC(),
      checkTasksWithoutEstimates(),
      checkEpicsWithoutStories(),
      checkStoriesWithoutPersona(),
      checkPrdCoverage(),
    ]);
    return {
      stories_without_acceptance_criteria: { count: ac.count, total: ac.total },
      tasks_without_estimates: { count: est.count, total: est.total },
      epics_without_stories: { count: eps.count, total: eps.total },
      stories_without_persona: { count: pers.count, total: pers.total },
      prd_coverage: { uncovered: cov.count, total_requirements: cov.total },
    };
  }
  return { error: `Unknown gap_type: ${gapType}` };
}

// ---------- get_artifact_detail ----------

async function getArtifactDetail(args: Record<string, unknown>, projectId: string) {
  const db = await getDb();
  const id = args.id as string;
  if (!id) return { error: "id is required" };

  const epic = await db.select().from(epics).where(and(eq(epics.id, id), eq(epics.project_id, projectId))).get();
  if (epic) {
    return {
      type: "epic",
      ...epic,
      objective_ids: parseJsonArray(epic.objective_ids),
    };
  }

  const story = await db.select().from(stories).where(and(eq(stories.id, id), eq(stories.project_id, projectId))).get();
  if (story) {
    return {
      type: "story",
      ...story,
      acceptance_criteria: parseJsonArray(story.acceptance_criteria),
      edge_cases: parseJsonArray(story.edge_cases),
      rice_score: story.rice_score ? safeParseJson(story.rice_score) : null,
    };
  }

  const task = await db.select().from(tasks).where(and(eq(tasks.id, id), eq(tasks.project_id, projectId))).get();
  if (task) {
    return { type: "task", ...task, labels: parseJsonArray(task.labels) };
  }

  const persona = await db
    .select()
    .from(personas)
    .where(and(eq(personas.id, id), eq(personas.project_id, projectId)))
    .get();
  if (persona) {
    return { type: "persona", ...persona, data: safeParseJson(persona.data) };
  }

  const objective = await db
    .select()
    .from(objectives)
    .where(and(eq(objectives.id, id), eq(objectives.project_id, projectId)))
    .get();
  if (objective) {
    const krs = await db.select().from(key_results).where(eq(key_results.objective_id, id)).all();
    return { type: "objective", ...objective, key_results: krs };
  }

  return { error: `No artifact found with id "${id}" in this project` };
}

// ---------- suggest_edit ----------

function suggestEdit(args: Record<string, unknown>) {
  // This intentionally does NOT mutate the DB. It returns a structured proposal
  // that the chat UI surfaces to the user; the user confirms via existing edit endpoints.
  return {
    status: "proposed",
    proposal: {
      target_id: args.target_id,
      edit_type: args.edit_type,
      payload: args.proposal,
      rationale: args.rationale,
    },
    note: "This edit has been proposed but NOT applied. The user must confirm to execute.",
  };
}

// ---------- helpers ----------

function parseJsonArray(value: string | null | undefined): unknown[] {
  if (!value) return [];
  try {
    const v = JSON.parse(value);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function safeParseJson(value: string | null | undefined): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

// ---------- backlog stats (used by chat-response-v2 prompt) ----------

export async function getBacklogStats(projectId: string) {
  const db = await getDb();
  const [epicRows, storyRows, taskRows] = await Promise.all([
    db.select().from(epics).where(eq(epics.project_id, projectId)).all(),
    db.select().from(stories).where(eq(stories.project_id, projectId)).all(),
    db.select().from(tasks).where(eq(tasks.project_id, projectId)).all(),
  ]);

  const storiesWithoutAC = storyRows.filter((s) => parseJsonArray(s.acceptance_criteria).length === 0).length;
  const tasksWithoutEstimates = taskRows.filter((t) => t.estimated_hours == null).length;
  const epicIdsWithStories = new Set(storyRows.map((s) => s.epic_id).filter(Boolean));
  const epicsWithoutStories = epicRows.filter((e) => !epicIdsWithStories.has(e.id)).length;

  const byStatus = (rows: { status: string | null }[]) => {
    const counts: Record<string, number> = {};
    for (const r of rows) counts[r.status || "unknown"] = (counts[r.status || "unknown"] || 0) + 1;
    return counts;
  };

  return {
    epics: { total: epicRows.length, by_status: byStatus(epicRows) },
    stories: { total: storyRows.length, by_status: byStatus(storyRows) },
    tasks: { total: taskRows.length, by_status: byStatus(taskRows) },
    quality_gaps: {
      stories_without_acceptance_criteria: storiesWithoutAC,
      tasks_without_estimates: tasksWithoutEstimates,
      epics_without_stories: epicsWithoutStories,
    },
  };
}

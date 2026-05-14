import { NextResponse } from "next/server";
import { createAIClient, SYSTEM_PROMPT } from "@/lib/ai/client";
import { getEpicGenerationPrompt } from "@/prompts/epic-generation";
import { getStoryGenerationPrompt } from "@/prompts/story-generation";
import { getTaskGenerationPrompt } from "@/prompts/task-generation";
import { getDb } from "@/lib/db";
import { prds, projects, personas, epics, stories, tasks } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

/**
 * Orchestrator: PRD → epics → stories per epic → tasks per story, in a single SSE stream.
 *
 * Emits stage events the client can use to render progress:
 *   {stage: "epics", status: "start"}
 *   {stage: "epics", status: "done", count: 5}
 *   {stage: "stories", epic: {id, title}, status: "start"}
 *   {stage: "stories", epic: {id, title}, status: "done", count: 6}
 *   {stage: "tasks", story: {id, title}, status: "start"}
 *   {stage: "tasks", story: {id, title}, status: "done", count: 4}
 *   {done: true, summary: {epics, stories, tasks}}
 *
 * Bounded by MAX_EPICS / MAX_STORIES_PER_EPIC so a wild model response can't blow timeouts.
 */

const MAX_EPICS = 8;
const MAX_STORIES_PER_EPIC = 8;
const MAX_TASKS_PER_STORY = 6;

export const maxDuration = 300; // Fluid Compute default; explicit for clarity

export async function POST(request: Request) {
  const { project_id } = await request.json();
  if (!project_id) return NextResponse.json({ error: "project_id required" }, { status: 400 });

  const db = await getDb();
  const project = await db.select().from(projects).where(eq(projects.id, project_id)).get();
  const prd = await db.select().from(prds).where(eq(prds.project_id, project_id)).get();
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  if (!prd) return NextResponse.json({ error: "No PRD found. Generate a PRD first." }, { status: 400 });

  const projectPersonas = await db.select().from(personas).where(eq(personas.project_id, project_id)).all();
  const personaList = projectPersonas.map((p) => ({ id: p.id, name: p.name, archetype: p.archetype }));
  // The model often returns the persona's *name* instead of its UUID. Build a lookup
  // so we can resolve either form to a valid id (or null) before insert — otherwise
  // the FK on stories.persona_id rejects the row.
  const personaIdSet = new Set(personaList.map((p) => p.id));
  const personaNameToId = new Map(personaList.map((p) => [p.name.toLowerCase(), p.id]));
  const resolvePersonaId = (raw: unknown): string | null => {
    if (typeof raw !== "string" || !raw) return null;
    if (personaIdSet.has(raw)) return raw;
    return personaNameToId.get(raw.toLowerCase()) ?? null;
  };
  const prdContent = JSON.parse(prd.content);

  const { client, model } = await createAIClient();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));

      const summary = { epics: 0, stories: 0, tasks: 0 };

      try {
        // ---------- Stage 1: Epics ----------
        send({ stage: "epics", status: "start" });

        const epicsResp = await client.chat.completions.create({
          model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: getEpicGenerationPrompt(prdContent, project.name) },
          ],
          temperature: 0.3,
          max_tokens: 3000,
        });
        const epicsRaw = epicsResp.choices[0]?.message?.content || "";
        const epicsData = parseJsonArray(epicsRaw);
        if (!epicsData) {
          send({ stage: "epics", status: "error", error: "Model returned invalid JSON for epics" });
          controller.close();
          return;
        }

        const savedEpics: Array<{ id: string; title: string; description: string }> = [];
        const epicsToInsert = epicsData.slice(0, MAX_EPICS);
        for (let i = 0; i < epicsToInsert.length; i++) {
          const e = epicsToInsert[i];
          const id = uuidv4();
          await db
            .insert(epics)
            .values({
              id,
              project_id,
              title: e.title,
              description: e.description || null,
              objective_ids: JSON.stringify(e.objective_ids || []),
              status: "backlog",
              phase: e.phase || "mvp",
              sort_order: i,
              technical_context: e.technical_context || null,
              created_at: new Date().toISOString(),
            })
            .run();
          savedEpics.push({ id, title: e.title, description: e.description || "" });
        }
        summary.epics = savedEpics.length;
        send({ stage: "epics", status: "done", count: savedEpics.length });

        // ---------- Stage 2 & 3: Stories per epic, then tasks per story ----------
        for (const epic of savedEpics) {
          send({ stage: "stories", epic: { id: epic.id, title: epic.title }, status: "start" });

          const storiesResp = await client.chat.completions.create({
            model,
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              {
                role: "user",
                content: getStoryGenerationPrompt(
                  { id: epic.id, title: epic.title, description: epic.description },
                  prdContent,
                  personaList
                ),
              },
            ],
            temperature: 0.3,
            max_tokens: 4000,
          });
          const storiesRaw = storiesResp.choices[0]?.message?.content || "";
          const storiesData = parseJsonArray(storiesRaw);
          if (!storiesData) {
            send({
              stage: "stories",
              epic: { id: epic.id, title: epic.title },
              status: "error",
              error: "Invalid JSON for stories",
            });
            continue; // skip this epic but keep going
          }

          const savedStories: Array<{ id: string; title: string; ac: object[] }> = [];
          const storiesToInsert = storiesData.slice(0, MAX_STORIES_PER_EPIC);
          for (let i = 0; i < storiesToInsert.length; i++) {
            const s = storiesToInsert[i];
            const id = uuidv4();
            try {
              await db
                .insert(stories)
                .values({
                  id,
                  epic_id: epic.id,
                  project_id,
                  title: s.title,
                  description: s.description || null,
                  acceptance_criteria: JSON.stringify(s.acceptance_criteria || []),
                  story_points: s.story_points || null,
                  priority: s.priority || "medium",
                  moscow: s.moscow || "should_have",
                  rice_score: s.rice_score ? JSON.stringify(s.rice_score) : null,
                  persona_id: resolvePersonaId(s.persona_id),
                  edge_cases: JSON.stringify(s.edge_cases || []),
                  status: "backlog",
                  sort_order: i,
                  created_at: new Date().toISOString(),
                })
                .run();
              savedStories.push({ id, title: s.title, ac: s.acceptance_criteria || [] });
            } catch (insertErr) {
              console.error("[full-backlog] story insert failed:", insertErr);
              // Skip this story; the orchestrator continues with the next.
            }
          }
          summary.stories += savedStories.length;
          send({
            stage: "stories",
            epic: { id: epic.id, title: epic.title },
            status: "done",
            count: savedStories.length,
          });

          // Tasks per story (in this epic)
          for (const story of savedStories) {
            send({ stage: "tasks", story: { id: story.id, title: story.title }, status: "start" });

            const tasksResp = await client.chat.completions.create({
              model,
              messages: [
                { role: "system", content: SYSTEM_PROMPT },
                {
                  role: "user",
                  content: getTaskGenerationPrompt({
                    id: story.id,
                    title: story.title,
                    description: null,
                    acceptance_criteria: story.ac,
                  }),
                },
              ],
              temperature: 0.2,
              max_tokens: 2000,
            });
            const tasksRaw = tasksResp.choices[0]?.message?.content || "";
            const tasksData = parseJsonArray(tasksRaw);
            if (!tasksData) {
              send({
                stage: "tasks",
                story: { id: story.id, title: story.title },
                status: "error",
                error: "Invalid JSON for tasks",
              });
              continue;
            }
            const tasksToInsert = tasksData.slice(0, MAX_TASKS_PER_STORY);
            let insertedTasks = 0;
            for (let i = 0; i < tasksToInsert.length; i++) {
              const t = tasksToInsert[i];
              try {
                await db
                  .insert(tasks)
                  .values({
                    id: uuidv4(),
                    story_id: story.id,
                    project_id,
                    title: t.title,
                    description: t.description || null,
                    technical_details: t.technical_details || null,
                    estimated_hours: t.estimated_hours || null,
                    labels: JSON.stringify(t.labels || []),
                    arch_component: t.arch_component || null,
                    status: "todo",
                    sort_order: i,
                    created_at: new Date().toISOString(),
                  })
                  .run();
                insertedTasks++;
              } catch (insertErr) {
                console.error("[full-backlog] task insert failed:", insertErr);
              }
            }
            summary.tasks += insertedTasks;
            send({
              stage: "tasks",
              story: { id: story.id, title: story.title },
              status: "done",
              count: insertedTasks,
            });
          }
        }

        send({ done: true, summary });
        controller.close();
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error("[full-backlog] error:", msg);
        send({ error: msg, summary });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
  });
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Strips markdown fences and parses the model's JSON array output.
 * Returns null on any failure so the caller can emit a stage error
 * without aborting the whole orchestrator. Returns `any[]` because the
 * shape comes from the model and is validated structurally on insert.
 */
function parseJsonArray(raw: string): any[] | null {
  if (!raw) return null;
  const cleaned = raw
    .replace(/```json\s*/g, "")
    .replace(/```\s*/g, "")
    .trim();
  try {
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    // Fallback: try to extract the first [...] block
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (!match) return null;
    try {
      const parsed = JSON.parse(match[0]);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
}

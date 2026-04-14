import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { epics, stories, tasks } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const db = await getDb();
    const projectEpics = await db.select().from(epics).where(eq(epics.project_id, id)).all();
    const projectStories = await db.select().from(stories).where(eq(stories.project_id, id)).all();
    const projectTasks = await db.select().from(tasks).where(eq(tasks.project_id, id)).all();

    const parse = (s: string | null) => {
      try { return JSON.parse(s || "[]"); } catch { return []; }
    };

    const enrichedEpics = projectEpics.map((e) => ({
      ...e,
      objective_ids: parse(e.objective_ids as string),
      stories: projectStories
        .filter((s) => s.epic_id === e.id)
        .map((s) => ({
          ...s,
          acceptance_criteria: parse(s.acceptance_criteria as string),
          edge_cases: parse(s.edge_cases as string),
          rice_score: s.rice_score ? JSON.parse(s.rice_score as string) : null,
          tasks: projectTasks
            .filter((t) => t.story_id === s.id)
            .map((t) => ({
              ...t,
              labels: parse(t.labels as string),
            })),
        })),
    }));

    return NextResponse.json(enrichedEpics);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch backlog" }, { status: 500 });
  }
}

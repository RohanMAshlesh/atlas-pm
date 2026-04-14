import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

export async function GET() {
  try {
    const db = await getDb();
    const allProjects = await db.select().from(projects).orderBy(desc(projects.created_at)).all();
    return NextResponse.json(allProjects);
  } catch (error: any) {
    console.error("Error fetching projects:", error);
    return NextResponse.json({ error: "Failed to fetch projects", detail: error?.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();
    const { name, description, company_context } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "Project name is required" }, { status: 400 });
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    await db.insert(projects).values({
      id,
      name: name.trim(),
      description: description?.trim() || null,
      company_context: company_context?.trim() || null,
      status: "active",
      created_at: now,
      updated_at: now,
    }).run();

    const project = await db.select().from(projects).where(eq(projects.id, id)).get();
    return NextResponse.json(project, { status: 201 });
  } catch (error: any) {
    console.error("Error creating project:", error);
    return NextResponse.json({ error: "Failed to create project", detail: error?.message }, { status: 500 });
  }
}

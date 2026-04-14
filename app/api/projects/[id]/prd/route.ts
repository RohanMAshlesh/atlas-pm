import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { prds } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const db = await getDb();
    const prd = await db.select().from(prds).where(eq(prds.project_id, id)).get();
    if (!prd) return NextResponse.json(null);
    return NextResponse.json({
      ...prd,
      content: typeof prd.content === "string" ? JSON.parse(prd.content) : prd.content,
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch PRD" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const db = await getDb();
    const body = await request.json();
    const { section_key, content } = body;
    const prd = await db.select().from(prds).where(eq(prds.project_id, id)).get();
    if (!prd) return NextResponse.json({ error: "PRD not found" }, { status: 404 });
    const currentContent = JSON.parse(prd.content as string);
    currentContent[section_key] = { ...currentContent[section_key], content };
    await db.update(prds).set({ content: JSON.stringify(currentContent) }).where(eq(prds.project_id, id)).run();
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update PRD" }, { status: 500 });
  }
}

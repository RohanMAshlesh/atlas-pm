import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { syntheses } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const db = await getDb();
    const synthesis = await db.select().from(syntheses).where(eq(syntheses.project_id, id)).get();
    if (!synthesis) return NextResponse.json(null);
    return NextResponse.json({
      ...synthesis,
      content: typeof synthesis.content === "string" ? JSON.parse(synthesis.content) : synthesis.content,
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch synthesis" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { competitors } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const db = await getDb();
    const data = await db.select().from(competitors).where(eq(competitors.project_id, id)).orderBy(desc(competitors.created_at)).all();
    return NextResponse.json(data.map((c) => ({
      ...c,
      data: typeof c.data === "string" ? JSON.parse(c.data) : c.data,
    })));
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch competitors" }, { status: 500 });
  }
}

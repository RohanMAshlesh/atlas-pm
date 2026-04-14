import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const db = await getDb();
    const docs = await db
      .select()
      .from(documents)
      .where(eq(documents.project_id, id))
      .orderBy(desc(documents.created_at))
      .all();
    return NextResponse.json(docs);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch documents" }, { status: 500 });
  }
}

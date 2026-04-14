import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { personas } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const db = await getDb();
    const data = await db.select().from(personas).where(eq(personas.project_id, id)).all();
    return NextResponse.json(data.map((p) => ({
      ...p,
      data: typeof p.data === "string" ? JSON.parse(p.data) : p.data,
    })));
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch personas" }, { status: 500 });
  }
}

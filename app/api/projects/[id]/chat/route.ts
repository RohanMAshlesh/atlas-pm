import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { chat_messages } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const db = await getDb();
    const messages = await db.select().from(chat_messages)
      .where(eq(chat_messages.project_id, id))
      .orderBy(asc(chat_messages.created_at))
      .all();
    return NextResponse.json(messages);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
  }
}

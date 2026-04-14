import { NextResponse } from "next/server";
import { createAIClient, SYSTEM_PROMPT } from "@/lib/ai/client";
import { getChatResponsePrompt } from "@/prompts/chat-response";
import { getDb } from "@/lib/db";
import { projects, syntheses, prds, personas, epics, stories, chat_messages } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: Request) {
  const { project_id, message } = await request.json();
  if (!project_id || !message) return NextResponse.json({ error: "project_id and message required" }, { status: 400 });

  const db = await getDb();

  // Save user message
  await db.insert(chat_messages).values({
    id: uuidv4(),
    project_id,
    role: "user",
    content: message,
    references: "[]",
    created_at: new Date().toISOString(),
  }).run();

  // Gather project context
  const project = await db.select().from(projects).where(eq(projects.id, project_id)).get();
  const synthesis = await db.select().from(syntheses).where(eq(syntheses.project_id, project_id)).get();
  const prd = await db.select().from(prds).where(eq(prds.project_id, project_id)).get();
  const projectPersonas = await db.select().from(personas).where(eq(personas.project_id, project_id)).all();
  const projectEpics = await db.select().from(epics).where(eq(epics.project_id, project_id)).all();
  const projectStories = await db.select().from(stories).where(eq(stories.project_id, project_id)).all();
  const recentMessages = (await db.select().from(chat_messages)
    .where(eq(chat_messages.project_id, project_id))
    .orderBy(desc(chat_messages.created_at))
    .limit(6)
    .all())
    .reverse();

  const { client, model } = await createAIClient();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const context = {
          project: { name: project?.name || "Unknown", description: project?.description || null },
          synthesis: synthesis ? JSON.parse(synthesis.content) : null,
          prd: prd ? JSON.parse(prd.content) : null,
          personas: projectPersonas.map((p) => ({ name: p.name, archetype: p.archetype })),
          epics: projectEpics.map((e) => ({ id: e.id, title: e.title })),
          stories: projectStories.map((s) => ({ id: s.id, title: s.title, status: s.status || "backlog" })),
          recentMessages: recentMessages.slice(0, -1).map((m) => ({ role: m.role, content: m.content })),
        };

        const prompt = getChatResponsePrompt(message, context);

        const completion = await client.chat.completions.create({
          model: model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: prompt },
          ],
          stream: true,
          temperature: 0.5,
          max_tokens: 1500,
        });

        let fullContent = "";
        for await (const chunk of completion) {
          const text = chunk.choices[0]?.delta?.content || "";
          if (text) {
            fullContent += text;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
          }
        }

        // Save assistant message
        const assistantId = uuidv4();
        await db.insert(chat_messages).values({
          id: assistantId,
          project_id,
          role: "assistant",
          content: fullContent,
          references: "[]",
          created_at: new Date().toISOString(),
        }).run();

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, id: assistantId })}\n\n`));
        controller.close();
      } catch (error: any) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: error.message })}\n\n`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
  });
}

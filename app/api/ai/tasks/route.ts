import { NextResponse } from "next/server";
import { createAIClient, SYSTEM_PROMPT } from "@/lib/ai/client";
import { getTaskGenerationPrompt } from "@/prompts/task-generation";
import { getDb } from "@/lib/db";
import { stories, tasks } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: Request) {
  const { project_id, story_id } = await request.json();
  if (!project_id || !story_id) return NextResponse.json({ error: "project_id and story_id required" }, { status: 400 });

  const db = await getDb();
  const story = await db.select().from(stories).where(eq(stories.id, story_id)).get();

  if (!story) return NextResponse.json({ error: "Story not found" }, { status: 404 });

  const { client, model } = await createAIClient();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const ac = JSON.parse(story.acceptance_criteria || "[]");
        const prompt = getTaskGenerationPrompt({
          id: story.id,
          title: story.title,
          description: story.description,
          acceptance_criteria: ac,
        });

        const completion = await client.chat.completions.create({
          model: model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: prompt },
          ],
          stream: true,
          temperature: 0.2,
          max_tokens: 2000,
        });

        let fullContent = "";
        for await (const chunk of completion) {
          const text = chunk.choices[0]?.delta?.content || "";
          if (text) {
            fullContent += text;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
          }
        }

        try {
          const cleanJson = fullContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
          const tasksData = JSON.parse(cleanJson);

          const savedTasks = [];
          for (let i = 0; i < tasksData.length; i++) {
            const t = tasksData[i];
            const id = uuidv4();
            await db.insert(tasks).values({
              id,
              story_id,
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
            }).run();
            savedTasks.push({ id, ...t });
          }

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, count: savedTasks.length })}\n\n`));
        } catch (e) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "Failed to parse tasks" })}\n\n`));
        }

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

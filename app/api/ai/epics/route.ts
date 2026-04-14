import { NextResponse } from "next/server";
import { createAIClient, SYSTEM_PROMPT } from "@/lib/ai/client";
import { getEpicGenerationPrompt } from "@/prompts/epic-generation";
import { getDb } from "@/lib/db";
import { prds, epics, projects } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: Request) {
  const { project_id } = await request.json();
  if (!project_id) return NextResponse.json({ error: "project_id required" }, { status: 400 });

  const db = await getDb();
  const project = await db.select().from(projects).where(eq(projects.id, project_id)).get();
  const prd = await db.select().from(prds).where(eq(prds.project_id, project_id)).get();

  if (!prd) return NextResponse.json({ error: "No PRD found. Generate a PRD first." }, { status: 400 });

  const { client, model } = await createAIClient();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const prdContent = JSON.parse(prd.content);
        const prompt = getEpicGenerationPrompt(prdContent, project?.name || "Product");

        const completion = await client.chat.completions.create({
          model: model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: prompt },
          ],
          stream: true,
          temperature: 0.3,
          max_tokens: 3000,
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
          const epicsData = JSON.parse(cleanJson);

          const savedEpics = [];
          for (let i = 0; i < epicsData.length; i++) {
            const e = epicsData[i];
            const id = uuidv4();
            await db.insert(epics).values({
              id,
              project_id,
              title: e.title,
              description: e.description || null,
              objective_ids: JSON.stringify(e.objective_ids || []),
              status: "backlog",
              phase: e.phase || "mvp",
              sort_order: i,
              technical_context: e.technical_context || null,
              created_at: new Date().toISOString(),
            }).run();
            savedEpics.push({ id, ...e });
          }

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, count: savedEpics.length, epics: savedEpics })}\n\n`));
        } catch (e) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "Failed to parse epics" })}\n\n`));
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

import { NextResponse } from "next/server";
import { createAIClient, SYSTEM_PROMPT } from "@/lib/ai/client";
import { getPersonaGenerationPrompt } from "@/prompts/persona-generation";
import { getDb } from "@/lib/db";
import { syntheses, prds, personas } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: Request) {
  const { project_id } = await request.json();
  if (!project_id) return NextResponse.json({ error: "project_id required" }, { status: 400 });

  const db = await getDb();
  const synthesis = await db.select().from(syntheses).where(eq(syntheses.project_id, project_id)).get();
  const prd = await db.select().from(prds).where(eq(prds.project_id, project_id)).get();

  if (!synthesis) return NextResponse.json({ error: "No synthesis found. Run discovery synthesis first." }, { status: 400 });

  const { client, model } = await createAIClient();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const synthesisContent = JSON.parse(synthesis.content);
        const prdContent = prd ? JSON.parse(prd.content) : undefined;

        const prompt = getPersonaGenerationPrompt(synthesisContent, prdContent ? JSON.stringify(prdContent) : undefined);

        const completion = await client.chat.completions.create({
          model: model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: prompt },
          ],
          stream: true,
          temperature: 0.4,
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
          const personasData = JSON.parse(cleanJson);

          // Delete existing personas for this project
          await db.delete(personas).where(eq(personas.project_id, project_id)).run();

          const savedPersonas = [];
          for (const p of personasData) {
            const id = uuidv4();
            await db.insert(personas).values({
              id,
              project_id,
              name: p.name,
              archetype: p.archetype || null,
              data: JSON.stringify(p.data),
              created_at: new Date().toISOString(),
            }).run();
            savedPersonas.push({ id, ...p });
          }

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, count: savedPersonas.length })}\n\n`));
        } catch (e) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "Failed to parse personas" })}\n\n`));
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

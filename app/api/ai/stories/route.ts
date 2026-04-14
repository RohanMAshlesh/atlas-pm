import { NextResponse } from "next/server";
import { createAIClient, SYSTEM_PROMPT } from "@/lib/ai/client";
import { getStoryGenerationPrompt } from "@/prompts/story-generation";
import { getDb } from "@/lib/db";
import { epics, stories, prds, personas } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: Request) {
  const { project_id, epic_id } = await request.json();
  if (!project_id || !epic_id) return NextResponse.json({ error: "project_id and epic_id required" }, { status: 400 });

  const db = await getDb();
  const epic = await db.select().from(epics).where(eq(epics.id, epic_id)).get();
  const prd = await db.select().from(prds).where(eq(prds.project_id, project_id)).get();
  const projectPersonas = await db.select().from(personas).where(eq(personas.project_id, project_id)).all();

  if (!epic) return NextResponse.json({ error: "Epic not found" }, { status: 404 });

  const { client, model } = await createAIClient();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const prdContent = prd ? JSON.parse(prd.content) : {};
        const personaList = projectPersonas.map((p) => ({ id: p.id, name: p.name, archetype: p.archetype }));

        const prompt = getStoryGenerationPrompt(
          { id: epic.id, title: epic.title, description: epic.description || "" },
          prdContent,
          personaList
        );

        const completion = await client.chat.completions.create({
          model: model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: prompt },
          ],
          stream: true,
          temperature: 0.3,
          max_tokens: 4000,
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
          const storiesData = JSON.parse(cleanJson);

          const savedStories = [];
          for (let i = 0; i < storiesData.length; i++) {
            const s = storiesData[i];
            const id = uuidv4();
            await db.insert(stories).values({
              id,
              epic_id,
              project_id,
              title: s.title,
              description: s.description || null,
              acceptance_criteria: JSON.stringify(s.acceptance_criteria || []),
              story_points: s.story_points || null,
              priority: s.priority || "medium",
              moscow: s.moscow || "should_have",
              rice_score: s.rice_score ? JSON.stringify(s.rice_score) : null,
              persona_id: s.persona_id || null,
              edge_cases: JSON.stringify(s.edge_cases || []),
              status: "backlog",
              sort_order: i,
              created_at: new Date().toISOString(),
            }).run();
            savedStories.push({ id, ...s });
          }

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, count: savedStories.length })}\n\n`));
        } catch (e) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "Failed to parse stories" })}\n\n`));
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

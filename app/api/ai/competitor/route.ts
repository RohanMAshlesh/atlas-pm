import { NextResponse } from "next/server";
import { createAIClient, SYSTEM_PROMPT } from "@/lib/ai/client";
import { getCompetitorResearchPrompt } from "@/prompts/competitor-research";
import { getDb } from "@/lib/db";
import { competitors } from "@/lib/db/schema";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: Request) {
  const { project_id, competitor_name } = await request.json();
  if (!project_id || !competitor_name) return NextResponse.json({ error: "project_id and competitor_name required" }, { status: 400 });

  const db = await getDb();
  const { client, model } = await createAIClient();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const prompt = getCompetitorResearchPrompt(competitor_name);

        const completion = await client.chat.completions.create({
          model: model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: prompt },
          ],
          stream: true,
          temperature: 0.3,
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

        try {
          const cleanJson = fullContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
          const competitorData = JSON.parse(cleanJson);

          const id = uuidv4();
          await db.insert(competitors).values({
            id,
            project_id,
            name: competitor_name,
            data: JSON.stringify(competitorData),
            created_at: new Date().toISOString(),
          }).run();

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, id, data: competitorData })}\n\n`));
        } catch (e) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "Failed to parse competitor data" })}\n\n`));
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

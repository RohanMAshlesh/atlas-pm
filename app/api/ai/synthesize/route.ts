import { NextResponse } from "next/server";
import { createAIClient, SYSTEM_PROMPT } from "@/lib/ai/client";
import { getDiscoverySynthesisPrompt } from "@/prompts/discovery-synthesis";
import { getDb } from "@/lib/db";
import { documents, syntheses } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: Request) {
  const { project_id } = await request.json();

  if (!project_id) {
    return NextResponse.json({ error: "project_id required" }, { status: 400 });
  }

  const db = await getDb();
  const docs = await db.select().from(documents).where(eq(documents.project_id, project_id)).all();

  if (!docs.length) {
    return NextResponse.json({ error: "No documents found for this project" }, { status: 400 });
  }

  const { client, model } = await createAIClient();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const docData = docs
          .filter((d) => d.content)
          .map((d) => ({
            filename: d.filename,
            type: d.type,
            content: d.content!.slice(0, 20000), // limit per doc
          }));

        const prompt = getDiscoverySynthesisPrompt(docData);

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

        // Parse and save
        try {
          const cleanJson = fullContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
          const synthesisContent = JSON.parse(cleanJson);

          const id = uuidv4();

          // Check for existing synthesis
          const existing = await db.select().from(syntheses).where(eq(syntheses.project_id, project_id)).get();

          if (existing) {
            await db.update(syntheses)
              .set({
                content: JSON.stringify(synthesisContent),
                version: (existing.version || 1) + 1,
              })
              .where(eq(syntheses.project_id, project_id))
              .run();
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, id: existing.id })}\n\n`));
          } else {
            await db.insert(syntheses).values({
              id,
              project_id,
              content: JSON.stringify(synthesisContent),
              version: 1,
              created_at: new Date().toISOString(),
            }).run();
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, id })}\n\n`));
          }
        } catch (e) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "Failed to parse synthesis" })}\n\n`));
        }

        controller.close();
      } catch (error: any) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: error.message || "AI generation failed" })}\n\n`)
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

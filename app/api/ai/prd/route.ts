import { NextResponse } from "next/server";
import { createAIClient, SYSTEM_PROMPT } from "@/lib/ai/client";
import { getPRDGenerationPrompt, getPRDSectionRegeneratePrompt } from "@/prompts/prd-generation";
import { getDb } from "@/lib/db";
import { syntheses, prds, prd_versions, projects } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: Request) {
  const body = await request.json();
  const { project_id, section_key, user_guidance } = body;

  if (!project_id) {
    return NextResponse.json({ error: "project_id required" }, { status: 400 });
  }

  const db = await getDb();
  const project = await db.select().from(projects).where(eq(projects.id, project_id)).get();
  const synthesis = await db.select().from(syntheses).where(eq(syntheses.project_id, project_id)).get();

  if (!synthesis && !section_key) {
    return NextResponse.json({ error: "No synthesis found. Please synthesize discovery docs first." }, { status: 400 });
  }

  const { client, model } = await createAIClient();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        let prompt: string;

        if (section_key) {
          // Regenerate a single section
          const existingPrd = await db.select().from(prds).where(eq(prds.project_id, project_id)).get();
          const prdContent = existingPrd ? JSON.parse(existingPrd.content) : {};
          const currentSection = prdContent[section_key];
          const otherSections = Object.entries(prdContent)
            .filter(([k]) => k !== section_key)
            .map(([k, v]: [string, any]) => `### ${v.title}\n${v.content?.slice(0, 300)}`)
            .join("\n\n");

          prompt = getPRDSectionRegeneratePrompt(
            section_key,
            currentSection?.title || section_key,
            currentSection?.content || "",
            otherSections,
            user_guidance
          );
        } else {
          const synthesisContent = JSON.parse(synthesis!.content);
          prompt = getPRDGenerationPrompt(synthesisContent, project?.name || "Product", project?.company_context || undefined);
        }

        const completion = await client.chat.completions.create({
          model: model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: prompt },
          ],
          stream: true,
          temperature: 0.3,
          max_tokens: 6000,
        });

        let fullContent = "";

        for await (const chunk of completion) {
          const text = chunk.choices[0]?.delta?.content || "";
          if (text) {
            fullContent += text;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
          }
        }

        // Save
        try {
          const cleanJson = fullContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
          const existing = await db.select().from(prds).where(eq(prds.project_id, project_id)).get();

          let newContent: object;

          if (section_key && existing) {
            const currentContent = JSON.parse(existing.content);
            newContent = { ...currentContent, [section_key]: { title: section_key, content: fullContent } };
          } else {
            newContent = JSON.parse(cleanJson);
          }

          if (existing) {
            // Save version
            await db.insert(prd_versions).values({
              id: uuidv4(),
              prd_id: existing.id,
              content: existing.content,
              version: existing.version || 1,
              change_summary: section_key ? `Regenerated ${section_key}` : "Full regeneration",
              created_at: new Date().toISOString(),
            }).run();

            await db.update(prds).set({
              content: JSON.stringify(newContent),
              version: (existing.version || 1) + 1,
            }).where(eq(prds.project_id, project_id)).run();

            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, id: existing.id })}\n\n`));
          } else {
            const id = uuidv4();
            await db.insert(prds).values({
              id,
              project_id,
              content: JSON.stringify(newContent),
              version: 1,
              created_at: new Date().toISOString(),
            }).run();
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, id })}\n\n`));
          }
        } catch (e) {
          console.error("PRD save error:", e);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "Failed to save PRD" })}\n\n`));
        }

        controller.close();
      } catch (error: any) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: error.message || "AI generation failed" })}\n\n`));
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

import { NextResponse } from "next/server";
import { createAIClient } from "@/lib/ai/client";
import { getChatResponsePromptV2 } from "@/prompts/chat-response-v2";
import { CHAT_TOOLS } from "@/lib/ai/chat-tools";
import { executeChatTool, getBacklogStats } from "@/lib/ai/chat-tool-executor";
import { getDb } from "@/lib/db";
import { projects, syntheses, prds, personas, chat_messages } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import type OpenAI from "openai";

const MAX_TOOL_ITERATIONS = 5;

export async function POST(request: Request) {
  const { project_id, message } = await request.json();
  if (!project_id || !message)
    return NextResponse.json({ error: "project_id and message required" }, { status: 400 });

  const db = await getDb();

  // Persist the user turn first so chat history is intact even if the model errors.
  await db
    .insert(chat_messages)
    .values({
      id: uuidv4(),
      project_id,
      role: "user",
      content: message,
      created_at: new Date().toISOString(),
    })
    .run();

  // Gather lightweight context — full backlog access is via tools.
  const project = await db.select().from(projects).where(eq(projects.id, project_id)).get();
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  const synthesis = await db.select().from(syntheses).where(eq(syntheses.project_id, project_id)).get();
  const prd = await db.select().from(prds).where(eq(prds.project_id, project_id)).get();
  const projectPersonas = await db.select().from(personas).where(eq(personas.project_id, project_id)).all();
  const recentMessages = (
    await db
      .select()
      .from(chat_messages)
      .where(eq(chat_messages.project_id, project_id))
      .orderBy(desc(chat_messages.created_at))
      .limit(8)
      .all()
  ).reverse();

  const backlogStats = await getBacklogStats(project_id);

  // Build a short synthesis summary string (the JSON-blob form bloats context).
  let synthesisSummary: string | null = null;
  if (synthesis) {
    try {
      const parsed = JSON.parse(synthesis.content);
      synthesisSummary = typeof parsed === "string" ? parsed : JSON.stringify(parsed).slice(0, 1500);
    } catch {
      synthesisSummary = synthesis.content.slice(0, 1500);
    }
  }

  let prdSectionTitles: string[] = [];
  if (prd) {
    try {
      const parsed = JSON.parse(prd.content) as Record<string, { title?: string }>;
      prdSectionTitles = Object.values(parsed)
        .map((s) => s?.title)
        .filter((t): t is string => !!t);
    } catch {}
  }

  const { system, user } = getChatResponsePromptV2(message, {
    project: { name: project.name, description: project.description },
    synthesisSummary,
    prdSectionTitles,
    personas: projectPersonas.map((p) => ({ name: p.name, archetype: p.archetype })),
    backlogStats,
    // Exclude the just-saved user turn so it doesn't appear twice in the prompt.
    recentMessages: recentMessages.slice(0, -1).map((m) => ({ role: m.role, content: m.content })),
  });

  const { client, model } = await createAIClient();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));

      try {
        const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
          { role: "system", content: system },
          { role: "user", content: user },
        ];

        const toolCallsExecuted: Array<{ name: string; args: unknown; result: unknown }> = [];
        let finalContent = "";

        // Tool-calling loop. We don't stream the intermediate (tool-deciding) turns
        // because they're typically empty content. We only stream the final assistant turn.
        for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
          const completion = await client.chat.completions.create({
            model,
            messages,
            tools: CHAT_TOOLS,
            tool_choice: "auto",
            temperature: 0.4,
            max_tokens: 1500,
          });

          const choice = completion.choices[0];
          const msg = choice.message;

          // If the model asked for tools, execute them and loop.
          if (msg.tool_calls && msg.tool_calls.length > 0) {
            // Push the assistant's tool-request turn so the API has the matching call ids.
            messages.push({
              role: "assistant",
              content: msg.content ?? "",
              tool_calls: msg.tool_calls,
            });

            for (const call of msg.tool_calls) {
              if (call.type !== "function") continue;
              let parsedArgs: Record<string, unknown> = {};
              try {
                parsedArgs = JSON.parse(call.function.arguments || "{}");
              } catch {
                parsedArgs = {};
              }
              send({ tool_call: { name: call.function.name, args: parsedArgs } });

              const result = await executeChatTool(call.function.name, parsedArgs, project_id);
              toolCallsExecuted.push({ name: call.function.name, args: parsedArgs, result });

              messages.push({
                role: "tool",
                tool_call_id: call.id,
                content: JSON.stringify(result).slice(0, 8000),
              });
            }
            continue; // re-enter loop so the model can reason over tool output
          }

          // No tool calls — this is the final answer. Re-issue as a streamed call
          // so we can deliver tokens incrementally to the client.
          // Append a synthetic "produce the final answer now" cue to keep the model's plan
          // intact and avoid it re-deciding to call more tools.
          finalContent = msg.content || "";

          // If we already have the content from the non-streaming call, just chunk it.
          // (OpenRouter free models often don't preserve identical output across two calls,
          // so prefer chunking what we already have over re-prompting.)
          const chunkSize = 80;
          for (let i = 0; i < finalContent.length; i += chunkSize) {
            send({ text: finalContent.slice(i, i + chunkSize) });
          }
          break;
        }

        if (!finalContent) {
          // Loop exhausted without a final assistant message — model kept asking for tools.
          finalContent =
            "I gathered some context but couldn't synthesize a final answer within the tool-call limit. Try rephrasing or asking a narrower question.";
          send({ text: finalContent });
        }

        const assistantId = uuidv4();
        await db
          .insert(chat_messages)
          .values({
            id: assistantId,
            project_id,
            role: "assistant",
            content: finalContent,
            created_at: new Date().toISOString(),
          })
          .run();

        send({ done: true, id: assistantId, tool_calls: toolCallsExecuted });
        controller.close();
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.error("[chat] error:", errMsg);
        send({ error: errMsg });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
  });
}

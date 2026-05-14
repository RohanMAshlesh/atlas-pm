import { NextResponse } from "next/server";
import { createAIClient } from "@/lib/ai/client";
import {
  getToolsForContext,
  TOOL_TO_PROPOSAL_KIND,
  type ScopedChatContext,
  type Proposal,
} from "@/lib/ai/scoped-chat-tools";
import { getDb } from "@/lib/db";
import { projects, prds, epics, stories, tasks } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type OpenAI from "openai";

/**
 * Scoped chat endpoint. Unlike /api/ai/chat (the full-page co-pilot), this one:
 *  - Knows what page the user is on (via `context: {type, ...}`)
 *  - Only exposes tools relevant to that scope
 *  - Returns ALL tool calls as proposals (the apply endpoint applies them)
 *  - Does NOT persist messages — this chat is ephemeral, per-session
 *
 * SSE event types:
 *   {text: string}            — streamed model commentary
 *   {proposal: Proposal}      — a proposed change for the UI to render as a card
 *   {done: true}              — turn finished
 *   {error: string}           — fatal
 */

const MAX_TOOL_ITERATIONS = 3;

export async function POST(request: Request) {
  const { project_id, context, message, history } = (await request.json()) as {
    project_id: string;
    context: ScopedChatContext;
    message: string;
    history?: Array<{ role: "user" | "assistant"; content: string }>;
  };

  if (!project_id || !context?.type || !message) {
    return NextResponse.json(
      { error: "project_id, context, and message required" },
      { status: 400 }
    );
  }

  const db = await getDb();
  const project = await db.select().from(projects).where(eq(projects.id, project_id)).get();
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  // Build a tight context block based on scope. We deliberately keep this small —
  // the page already shows the artifact; the model needs identifiers + a small slice.
  let contextBlock = "";

  if (context.type === "prd") {
    const prd = await db.select().from(prds).where(eq(prds.project_id, project_id)).get();
    if (prd) {
      try {
        const parsed = JSON.parse(prd.content) as Record<
          string,
          { title?: string; content?: string }
        >;
        const sectionLines = Object.entries(parsed)
          .map(([key, s]) => {
            const preview = (s?.content || "").slice(0, 400).replace(/\s+/g, " ");
            return `[${key}] ${s?.title || key}\n  ${preview}${(s?.content?.length || 0) > 400 ? "..." : ""}`;
          })
          .join("\n");
        contextBlock = `PRD SECTIONS (preview, first 400 chars each):\n${sectionLines}`;
        if (context.section_key && parsed[context.section_key]) {
          // Give the model the FULL text of the focused section.
          contextBlock += `\n\nCURRENT FOCUSED SECTION [${context.section_key}] — full content:\n${parsed[context.section_key].content || ""}`;
        }
      } catch {
        contextBlock = "PRD exists but content failed to parse.";
      }
    } else {
      contextBlock = "No PRD exists yet for this project.";
    }
  } else if (context.type === "backlog") {
    const projectEpics = await db.select().from(epics).where(eq(epics.project_id, project_id)).all();
    const projectStories = await db.select().from(stories).where(eq(stories.project_id, project_id)).all();
    const projectTasks = await db.select().from(tasks).where(eq(tasks.project_id, project_id)).all();
    const lines: string[] = ["BACKLOG TREE (id, title):"];
    for (const e of projectEpics) {
      lines.push(`EPIC ${e.id} — ${e.title} [${e.phase || "?"}, ${e.status}]`);
      for (const s of projectStories.filter((s) => s.epic_id === e.id)) {
        lines.push(`  STORY ${s.id} — ${s.title} [${s.moscow}, ${s.priority}, ${s.status}]`);
        for (const t of projectTasks.filter((t) => t.story_id === s.id)) {
          lines.push(`    TASK ${t.id} — ${t.title} [${t.status}]`);
        }
      }
    }
    contextBlock = lines.join("\n").slice(0, 6000);
    if (context.focus_epic_id) {
      const e = projectEpics.find((x) => x.id === context.focus_epic_id);
      if (e) contextBlock += `\n\nFOCUSED EPIC: ${e.id} — ${e.title}\nDescription: ${e.description || "(none)"}`;
    }
  }

  const system = buildSystemPrompt(context);
  const user = `${contextBlock}\n\nPROJECT: ${project.name}\n\nUSER REQUEST: ${message}`;

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: system },
    ...(history || []).map(
      (h): OpenAI.Chat.Completions.ChatCompletionMessageParam => ({
        role: h.role,
        content: h.content,
      })
    ),
    { role: "user", content: user },
  ];

  const tools = getToolsForContext(context);
  const { client, model } = await createAIClient();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));

      try {
        let finalContent = "";

        for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
          const completion = await client.chat.completions.create({
            model,
            messages,
            tools,
            tool_choice: "auto",
            temperature: 0.4,
            max_tokens: 1500,
          });
          const msg = completion.choices[0].message;

          if (msg.tool_calls && msg.tool_calls.length > 0) {
            // Convert each tool call to a Proposal, stream it as a card,
            // and feed back a synthetic tool result so the model can wrap up.
            messages.push({
              role: "assistant",
              content: msg.content ?? "",
              tool_calls: msg.tool_calls,
            });

            for (const call of msg.tool_calls) {
              if (call.type !== "function") continue;
              const kind = TOOL_TO_PROPOSAL_KIND[call.function.name];
              if (!kind) {
                messages.push({
                  role: "tool",
                  tool_call_id: call.id,
                  content: JSON.stringify({ error: `Unknown tool: ${call.function.name}` }),
                });
                continue;
              }
              let args: Record<string, unknown> = {};
              try {
                args = JSON.parse(call.function.arguments || "{}");
              } catch {
                args = {};
              }
              const proposal = { kind, ...args } as Proposal;
              send({ proposal });

              messages.push({
                role: "tool",
                tool_call_id: call.id,
                content: JSON.stringify({
                  status: "proposed",
                  note: "Proposal queued for user confirmation; do not call again.",
                }),
              });
            }
            continue;
          }

          finalContent = msg.content || "";
          // Stream the finalContent in chunks so the UI feels live.
          const chunk = 60;
          for (let i = 0; i < finalContent.length; i += chunk) {
            send({ text: finalContent.slice(i, i + chunk) });
          }
          break;
        }

        if (!finalContent) {
          send({
            text:
              "I proposed the changes above — review each one and apply or reject. Let me know if you want adjustments.",
          });
        }

        send({ done: true });
        controller.close();
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.error("[scoped-chat] error:", errMsg);
        send({ error: errMsg });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
  });
}

function buildSystemPrompt(context: ScopedChatContext): string {
  const common = `You are Atlas, an elite Product Manager Agent operating in SCOPED EDIT mode.

You are embedded on a specific page of the app. Your job:
1. Read the user's request.
2. If it can be satisfied by a tool call (edit or create), CALL THE TOOL. Do NOT explain what you would do — propose it.
3. If the request is conceptual or out of scope, answer briefly in plain text.

Rules:
- Every tool call is a PROPOSAL. It is NOT applied until the user confirms in the UI.
- ALWAYS include a clear, specific rationale on every proposal.
- Use real ids from the context block. Never invent ids.
- If the user is vague ("improve the PRD"), pick the single highest-impact change and propose it — don't dump 10 proposals.
- Stay in scope. Refuse off-topic edits politely.
- Do not call the same tool twice for the same target in one turn.
- After proposing, do NOT keep talking — let the proposal cards speak for themselves.`;

  if (context.type === "prd") {
    return `${common}

SCOPE: PRD editing. The only tool available is propose_edit_prd_section.
- Section keys: overview, background, problem_statement, goals, personas, scope, requirements, user_flows, technical, dependencies, release, appendix.
- The full content you propose REPLACES the existing section — include everything the section should contain.
- Keep markdown formatting consistent with the existing PRD.
${context.section_key ? `\n- The user is currently viewing the [${context.section_key}] section — prefer edits to that section unless they specify otherwise.` : ""}`;
  }

  if (context.type === "backlog") {
    return `${common}

SCOPE: Backlog editing. You can create or edit epics, stories, and tasks.
- Use propose_create_* when the user asks to add something new.
- Use propose_edit_* when modifying existing items (look up the id from the BACKLOG TREE).
- For stories, acceptance_criteria MUST be in Given/When/Then format.
- moscow values: must_have, should_have, could_have, wont_have.
- priority values: critical, high, medium, low.
- phase values: mvp, v1.0, v1.1, future.
${context.focus_epic_id ? `\n- The user is focused on epic ${context.focus_epic_id} — default new stories to this epic unless they specify otherwise.` : ""}`;
  }

  return common;
}

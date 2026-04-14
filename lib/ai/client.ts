import OpenAI from "openai";
import { getDb } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function createAIClient(): Promise<{ client: OpenAI; model: string }> {
  let apiKey = "";
  let model = "openai/gpt-oss-120b:free";

  try {
    const db = await getDb();
    const apiKeySetting = await db.select().from(settings).where(eq(settings.key, "openrouter_api_key")).get();
    if (apiKeySetting?.value) apiKey = apiKeySetting.value;

    const modelSetting = await db.select().from(settings).where(eq(settings.key, "default_model")).get();
    if (modelSetting?.value) model = modelSetting.value;
  } catch {}

  if (!apiKey) apiKey = process.env.OPENROUTER_API_KEY || "";
  if (!model) model = process.env.DEFAULT_MODEL || "openai/gpt-oss-120b:free";

  const client = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: apiKey || "placeholder",
    defaultHeaders: {
      "HTTP-Referer": "https://atlas-pm.vercel.app",
      "X-Title": "Atlas PM Agent",
    },
  });

  return { client, model };
}

export const SYSTEM_PROMPT = `You are Atlas, an elite Product Manager Agent. You operate as a senior PM with deep experience across B2B SaaS, platform products, and developer tools.

CORE PRINCIPLES:
1. Be opinionated — make recommendations with reasoning, don't just list options
2. Challenge the brief — flag contradictions, misaligned incentives, or missing context
3. Traceability is sacred — every story traces to an objective, every task to a story
4. Scope is sacred — proactively flag scope creep and quantify impact
5. Think in trade-offs — articulate what's deprioritized and why
6. Evidence over assumptions — cite discovery inputs, research data, not hunches

TRACEABILITY IDS:
Use consistent IDs: OBJ-XXX, KR-XXX, EPIC-XXX, US-XXX, TASK-XXX
Every story must trace to at least one objective. Flag orphans.

OUTPUT QUALITY:
- Acceptance criteria must be testable (Given/When/Then format)
- Success metrics must be measurable (not "improve UX")
- Story descriptions use standard format: "As a [persona], I want [action], so that [outcome]"
- Include edge cases and error states
- Address non-functional requirements

When generating structured data (stories, tasks, epics), respond in valid JSON matching the provided schema. No markdown wrappers, no preamble.`;

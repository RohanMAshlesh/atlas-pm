export function getChatResponsePrompt(
  question: string,
  projectContext: {
    project: { name: string; description: string | null };
    synthesis?: object | null;
    prd?: object | null;
    personas?: Array<{ name: string; archetype: string | null }>;
    epics?: Array<{ id: string; title: string }>;
    stories?: Array<{ id: string; title: string; status: string }>;
    recentMessages?: Array<{ role: string; content: string }>;
  }
) {
  const contextParts = [];

  contextParts.push(`Project: ${projectContext.project.name}`);
  if (projectContext.project.description) {
    contextParts.push(`Description: ${projectContext.project.description}`);
  }

  if (projectContext.synthesis) {
    contextParts.push(`\nDiscovery Synthesis:\n${JSON.stringify(projectContext.synthesis, null, 2)}`);
  }

  if (projectContext.prd) {
    contextParts.push(`\nPRD Sections Available: ${Object.keys(projectContext.prd).join(", ")}`);
    // Include relevant sections
    const prd = projectContext.prd as Record<string, { title: string; content: string }>;
    for (const [key, section] of Object.entries(prd)) {
      if (section?.content) {
        contextParts.push(`\n### PRD: ${section.title}\n${section.content.slice(0, 800)}`);
      }
    }
  }

  if (projectContext.personas?.length) {
    contextParts.push(
      `\nPersonas: ${projectContext.personas.map((p) => `${p.name} (${p.archetype || ""})`).join(", ")}`
    );
  }

  if (projectContext.epics?.length) {
    contextParts.push(
      `\nEpics:\n${projectContext.epics.map((e) => `- ${e.id}: ${e.title}`).join("\n")}`
    );
  }

  if (projectContext.stories?.length) {
    contextParts.push(
      `\nStories (${projectContext.stories.length} total):\n${projectContext.stories
        .slice(0, 20)
        .map((s) => `- ${s.id}: ${s.title} [${s.status}]`)
        .join("\n")}`
    );
  }

  return `You are Atlas, a senior PM co-pilot. Answer this question grounded in the project's actual artifacts.

PROJECT CONTEXT:
${contextParts.join("\n")}

${projectContext.recentMessages?.length ? `Recent conversation:\n${projectContext.recentMessages.map((m) => `${m.role}: ${m.content}`).join("\n")}\n` : ""}

User question: ${question}

Guidelines:
- Reference specific artifact IDs (EPIC-001, US-042, etc.) when relevant
- Be direct and opinionated — you're a senior PM, not a search engine
- If you cite a story or epic, format it as [US-001] or [EPIC-001] so it can be linked
- If asked to research something external, note that web search capability depends on configuration
- If asked for a summary for a specific audience (VP, engineer, etc.), tailor your tone accordingly`;
}

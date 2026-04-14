export function getTaskGenerationPrompt(
  story: { id: string; title: string; description: string | null; acceptance_criteria: object[] },
  archContext?: string
) {
  return `Generate implementation tasks for this user story.

Story:
- ID: ${story.id}
- Title: ${story.title}
- Description: ${story.description || ""}
- Acceptance Criteria: ${JSON.stringify(story.acceptance_criteria)}

${archContext ? `Architecture Context:\n${archContext}` : ""}

Generate 3-6 specific implementation tasks covering frontend, backend, and QA as needed.

Return a JSON array:
[
  {
    "id": "TASK-001",
    "title": "Implement X component",
    "description": "What needs to be built. Specific, actionable.",
    "technical_details": "Implementation notes, API endpoints to create/use, data models to update",
    "estimated_hours": 4,
    "labels": ["frontend", "backend", "design", "qa", "devops"],
    "arch_component": "auth-service|api-gateway|user-db|frontend|etc"
  }
]

Labels can be: frontend, backend, design, qa, devops. Pick the relevant ones.
Return ONLY valid JSON array.`;
}

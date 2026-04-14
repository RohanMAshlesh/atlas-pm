export function getEpicGenerationPrompt(prdContent: object, projectName: string) {
  return `You are a senior PM breaking down a PRD into epics for "${projectName}".

PRD Content:
${JSON.stringify(prdContent, null, 2)}

Generate 4-8 epics that cover all functional requirements in the PRD. Each epic should be a logical grouping of related functionality.

Return a JSON array:
[
  {
    "id": "EPIC-001",
    "title": "Short epic title",
    "description": "What this epic covers and why it matters. 2-3 sentences.",
    "objective_ids": ["OBJ-001"],
    "status": "backlog",
    "phase": "mvp|v1.0|v1.1|future",
    "technical_context": "Key technical implications or architecture notes"
  }
]

Phase guidelines:
- mvp: Core functionality needed for first launch
- v1.0: Important features for initial public release
- v1.1: Enhancements after initial feedback
- future: Nice-to-have, not time-bound

Return ONLY valid JSON array.`;
}

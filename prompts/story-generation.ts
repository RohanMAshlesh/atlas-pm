export function getStoryGenerationPrompt(
  epic: { id: string; title: string; description: string },
  prdContent: object,
  personas: Array<{ id: string; name: string; archetype: string | null }>
) {
  return `You are a senior PM generating user stories for this epic.

Epic:
- ID: ${epic.id}
- Title: ${epic.title}
- Description: ${epic.description}

PRD Context:
${JSON.stringify(prdContent, null, 2)}

Available Personas:
${personas.map((p) => `- ${p.id}: ${p.name} (${p.archetype || ""})`).join("\n")}

Generate 4-8 user stories for this epic. Be specific about acceptance criteria.

Return a JSON array:
[
  {
    "id": "US-001",
    "title": "Short story title",
    "description": "As a [persona role], I want [specific action], so that [clear outcome].",
    "acceptance_criteria": [
      {
        "given": "the user is on the X page",
        "when": "they click Y",
        "then": "Z happens and the system shows A"
      }
    ],
    "story_points": 3,
    "priority": "critical|high|medium|low",
    "moscow": "must_have|should_have|could_have|wont_have",
    "rice_score": {
      "reach": 8,
      "impact": 9,
      "confidence": 80,
      "effort": 3,
      "total": 24
    },
    "persona_id": "use actual persona id from list or null",
    "edge_cases": [
      "What happens when the user has no data?",
      "What if the network request fails?"
    ]
  }
]

RICE score = (Reach * Impact * Confidence%) / Effort. Use 1-10 for Reach/Impact, 1-100 for Confidence%, 1-10 for Effort.
Return ONLY valid JSON array.`;
}

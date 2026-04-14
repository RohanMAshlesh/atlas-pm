export function getPersonaGenerationPrompt(synthesis: object, prdContent?: string) {
  return `Generate 2-4 distinct user personas based on this discovery synthesis and PRD context.

Discovery Synthesis:
${JSON.stringify(synthesis, null, 2)}

${prdContent ? `PRD Context:\n${prdContent}` : ""}

Return a JSON array of personas:
[
  {
    "name": "Full Name",
    "archetype": "The Overwhelmed Ops Lead",
    "data": {
      "role": "Operations Manager",
      "company_size": "50-200 employees",
      "industry": "B2B SaaS",
      "tech_sophistication": "medium",
      "goals": ["goal 1", "goal 2", "goal 3"],
      "frustrations": ["frustration with direct evidence from discovery", "..."],
      "jtbd": ["When I..., I want to..., so I can..."],
      "behavioral_patterns": ["pattern 1", "pattern 2"],
      "quote": "A direct or representative quote from discovery documents",
      "empathy_map": {
        "think": ["what they think about"],
        "feel": ["what they feel"],
        "say": ["what they say out loud"],
        "do": ["what they actually do"]
      },
      "buying_role": "decision_maker|influencer|end_user"
    }
  }
]

Ground each persona in the actual discovery data. Use real quotes where possible. Return ONLY valid JSON array.`;
}

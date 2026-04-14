export function getPRDGenerationPrompt(synthesis: object, projectName: string, companyContext?: string) {
  return `You are generating a comprehensive Product Requirements Document for "${projectName}".
${companyContext ? `Company context: ${companyContext}` : ""}

Discovery synthesis:
${JSON.stringify(synthesis, null, 2)}

Generate a complete PRD as a JSON object with these sections. Each section has "title" and "content" (markdown formatted):

{
  "overview": {
    "title": "Overview",
    "content": "## Product Name\\n\\n## Executive Summary\\n..."
  },
  "background": {
    "title": "Background & Context",
    "content": "..."
  },
  "problem_statement": {
    "title": "Problem Statement",
    "content": "..."
  },
  "goals": {
    "title": "Goals & Success Metrics",
    "content": "Include OBJ-001, OBJ-002... and KR-001, KR-002... format. North star metric. Measurable KRs only."
  },
  "personas": {
    "title": "User Personas",
    "content": "..."
  },
  "scope": {
    "title": "Scope",
    "content": "### In Scope\\n- item\\n\\n### Out of Scope\\n- item\\n\\n### Future Considerations\\n- item"
  },
  "requirements": {
    "title": "Requirements",
    "content": "### Functional Requirements\\n...\\n### Non-Functional Requirements\\n..."
  },
  "user_flows": {
    "title": "User Flows",
    "content": "..."
  },
  "technical": {
    "title": "Technical Considerations",
    "content": "..."
  },
  "dependencies": {
    "title": "Dependencies & Risks",
    "content": "### DACR Matrix\\n#### Dependencies\\n...\\n#### Assumptions\\n...\\n#### Constraints\\n...\\n#### Risks\\n..."
  },
  "release": {
    "title": "Release Strategy",
    "content": "### MVP Definition\\n...\\n### Phase Plan\\n...\\n### Launch Checklist\\n..."
  },
  "appendix": {
    "title": "Appendix",
    "content": "### Glossary\\n...\\n### References\\n...\\n### Change Log\\n- v1.0 - Initial draft"
  }
}

Be thorough, specific, and opinionated. Return ONLY valid JSON.`;
}

export function getPRDSectionRegeneratePrompt(
  sectionKey: string,
  sectionTitle: string,
  currentContent: string,
  fullPRDContext: string,
  userGuidance?: string
) {
  return `Regenerate the "${sectionTitle}" section of this PRD.

Full PRD context (other sections):
${fullPRDContext}

Current content of this section:
${currentContent}

${userGuidance ? `User guidance for this regeneration: ${userGuidance}` : ""}

Return ONLY the new markdown content for this section. No JSON wrapper, no preamble. Be more specific and actionable than the current version.`;
}

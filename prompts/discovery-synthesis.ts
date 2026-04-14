export function getDiscoverySynthesisPrompt(documents: Array<{ filename: string; type: string; content: string }>) {
  const docText = documents
    .map((d) => `--- Document: ${d.filename} (${d.type}) ---\n${d.content}\n`)
    .join("\n\n");

  return `You are analyzing discovery documents for a product team. Read ALL of the following documents carefully and produce a comprehensive synthesis.

DOCUMENTS:
${docText}

Produce a JSON synthesis with this exact structure:
{
  "key_themes": [
    { "theme": "string", "frequency": "high|medium|low", "sources": ["filename1", "filename2"] }
  ],
  "pain_points": [
    { "point": "string", "severity": "critical|high|medium|low", "evidence": "direct quote or paraphrase from docs" }
  ],
  "opportunities": [
    { "opportunity": "string", "rationale": "string" }
  ],
  "stakeholders": [
    { "name": "string", "role": "string", "concerns": ["string"] }
  ],
  "contradictions": [
    { "tension": "string", "sources": ["filename1", "filename2"] }
  ],
  "open_questions": ["string"],
  "next_steps": ["string"],
  "raw_summary": "A 3-4 paragraph narrative summary of all findings"
}

Be specific. Quote directly from the documents. Identify 5-8 key themes, 5-10 pain points. Return ONLY valid JSON.`;
}

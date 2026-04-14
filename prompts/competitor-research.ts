export function getCompetitorResearchPrompt(competitorName: string, searchResults?: string) {
  return `Research and profile this competitor: ${competitorName}

${searchResults ? `Web search results:\n${searchResults}\n` : "Use your training knowledge about this company."}

Return a JSON competitor profile:
{
  "overview": "2-3 sentence company overview",
  "product_offering": "What their product does, key features",
  "pricing": "Pricing model and tiers if known",
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "weaknesses": ["weakness 1", "weakness 2"],
  "market_position": "How they position themselves in the market",
  "target_customers": "Who they sell to",
  "founded": "year or unknown",
  "funding": "funding stage/amount or unknown",
  "website": "website URL if known"
}

Be specific and factual. Note if information is from training data vs. search results. Return ONLY valid JSON.`;
}

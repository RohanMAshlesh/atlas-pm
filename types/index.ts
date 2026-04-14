export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: "active" | "archived";
  company_context: string | null;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  project_id: string;
  filename: string;
  type: DocumentType;
  content: string | null;
  file_path: string | null;
  created_at: string;
}

export type DocumentType =
  | "discovery_call"
  | "meeting_notes"
  | "customer_interview"
  | "market_research"
  | "architecture"
  | "support_data"
  | "analytics"
  | "other";

export interface Synthesis {
  id: string;
  project_id: string;
  content: SynthesisContent;
  version: number;
  created_at: string;
}

export interface SynthesisContent {
  key_themes: Array<{ theme: string; frequency: string; sources: string[] }>;
  pain_points: Array<{ point: string; severity: string; evidence: string }>;
  opportunities: Array<{ opportunity: string; rationale: string }>;
  stakeholders: Array<{ name: string; role: string; concerns: string[] }>;
  contradictions: Array<{ tension: string; sources: string[] }>;
  open_questions: string[];
  next_steps: string[];
  raw_summary?: string;
}

export interface PRD {
  id: string;
  project_id: string;
  content: PRDContent;
  version: number;
  created_at: string;
}

export interface PRDContent {
  overview?: PRDSection;
  background?: PRDSection;
  problem_statement?: PRDSection;
  goals?: PRDSection;
  personas?: PRDSection;
  scope?: PRDSection;
  requirements?: PRDSection;
  user_flows?: PRDSection;
  technical?: PRDSection;
  dependencies?: PRDSection;
  release?: PRDSection;
  appendix?: PRDSection;
}

export interface PRDSection {
  title: string;
  content: string;
  last_updated?: string;
}

export interface Persona {
  id: string;
  project_id: string;
  name: string;
  archetype: string | null;
  data: PersonaData;
  created_at: string;
}

export interface PersonaData {
  role: string;
  company_size: string;
  industry: string;
  tech_sophistication: string;
  goals: string[];
  frustrations: string[];
  jtbd: string[];
  behavioral_patterns: string[];
  quote: string;
  empathy_map: {
    think: string[];
    feel: string[];
    say: string[];
    do: string[];
  };
  buying_role: "decision_maker" | "influencer" | "end_user";
}

export interface Epic {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  objective_ids: string[];
  status: "backlog" | "in_progress" | "done";
  phase: string | null;
  sort_order: number;
  technical_context: string | null;
  created_at: string;
}

export interface Story {
  id: string;
  epic_id: string;
  project_id: string;
  title: string;
  description: string | null;
  acceptance_criteria: AcceptanceCriteria[];
  story_points: number | null;
  priority: "critical" | "high" | "medium" | "low";
  moscow: "must_have" | "should_have" | "could_have" | "wont_have";
  rice_score: RICEScore | null;
  persona_id: string | null;
  edge_cases: string[];
  status: string;
  sort_order: number;
  created_at: string;
}

export interface AcceptanceCriteria {
  given: string;
  when: string;
  then: string;
}

export interface RICEScore {
  reach: number;
  impact: number;
  confidence: number;
  effort: number;
  total: number;
}

export interface Task {
  id: string;
  story_id: string;
  project_id: string;
  title: string;
  description: string | null;
  technical_details: string | null;
  estimated_hours: number | null;
  labels: string[];
  arch_component: string | null;
  status: "todo" | "in_progress" | "review" | "done";
  sort_order: number;
  created_at: string;
}

export interface Competitor {
  id: string;
  project_id: string;
  name: string;
  data: CompetitorData;
  created_at: string;
}

export interface CompetitorData {
  overview: string;
  product_offering: string;
  pricing: string;
  strengths: string[];
  weaknesses: string[];
  market_position: string;
  target_customers: string;
  founded?: string;
  funding?: string;
  website?: string;
}

export interface ChatMessage {
  id: string;
  project_id: string;
  role: "user" | "assistant";
  content: string;
  references: string[];
  created_at: string;
}

export interface Phase {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  sort_order: number;
  target_date: string | null;
  created_at: string;
}

export interface Objective {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  sort_order: number;
}

export interface KeyResult {
  id: string;
  objective_id: string;
  project_id: string;
  title: string;
  target: string | null;
  measurement: string | null;
  sort_order: number;
}

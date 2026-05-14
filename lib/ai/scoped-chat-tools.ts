import type OpenAI from "openai";

/**
 * Scoped-chat context. Determines which tools the model can call.
 * - "prd": user is on the PRD page; only PRD-section edits available
 * - "backlog": user is on the backlog page; full epic/story/task editing + creation
 */
export type ScopedChatContext =
  | { type: "prd"; section_key?: string }
  | { type: "backlog"; focus_epic_id?: string };

/**
 * The proposal object the apply endpoint understands. The chat tools return
 * objects of this shape (wrapped); apply() dispatches on `kind`.
 */
export type Proposal =
  | {
      kind: "edit_prd_section";
      section_key: string;
      new_content: string;
      rationale: string;
    }
  | {
      kind: "create_epic";
      title: string;
      description?: string;
      phase?: string;
      rationale: string;
    }
  | {
      kind: "edit_epic";
      id: string;
      changes: {
        title?: string;
        description?: string;
        phase?: string;
        status?: string;
        technical_context?: string;
      };
      rationale: string;
    }
  | {
      kind: "create_story";
      epic_id: string;
      title: string;
      description?: string;
      acceptance_criteria?: Array<{ given: string; when: string; then: string }>;
      story_points?: number;
      priority?: string;
      moscow?: string;
      rationale: string;
    }
  | {
      kind: "edit_story";
      id: string;
      changes: {
        title?: string;
        description?: string;
        acceptance_criteria?: Array<{ given: string; when: string; then: string }>;
        story_points?: number;
        priority?: string;
        moscow?: string;
        status?: string;
      };
      rationale: string;
    }
  | {
      kind: "create_task";
      story_id: string;
      title: string;
      description?: string;
      technical_details?: string;
      estimated_hours?: number;
      labels?: string[];
      rationale: string;
    }
  | {
      kind: "edit_task";
      id: string;
      changes: {
        title?: string;
        description?: string;
        technical_details?: string;
        estimated_hours?: number;
        labels?: string[];
        status?: string;
      };
      rationale: string;
    };

// ---------- Tool definitions ----------

const editPrdSection: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: "function",
  function: {
    name: "propose_edit_prd_section",
    description:
      "Propose a full rewrite of one PRD section. Use when the user asks to revise, expand, tighten, or correct a section. The change is NOT applied — the user must confirm. Always include the full intended section content (not a diff).",
    parameters: {
      type: "object",
      properties: {
        section_key: {
          type: "string",
          description:
            "PRD section key. One of: overview, background, problem_statement, goals, personas, scope, requirements, user_flows, technical, dependencies, release, appendix.",
        },
        new_content: {
          type: "string",
          description: "The complete replacement markdown content for this section.",
        },
        rationale: {
          type: "string",
          description: "Why this edit improves the PRD — one or two sentences.",
        },
      },
      required: ["section_key", "new_content", "rationale"],
    },
  },
};

const createEpic: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: "function",
  function: {
    name: "propose_create_epic",
    description:
      "Propose creating a new epic in the backlog. Use when the user asks to add a new high-level capability.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        phase: {
          type: "string",
          description: "One of: mvp, v1.0, v1.1, future",
        },
        rationale: { type: "string" },
      },
      required: ["title", "rationale"],
    },
  },
};

const editEpic: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: "function",
  function: {
    name: "propose_edit_epic",
    description: "Propose updating fields on an existing epic (title, description, phase, status, technical_context).",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "The epic id" },
        changes: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            phase: { type: "string" },
            status: { type: "string" },
            technical_context: { type: "string" },
          },
        },
        rationale: { type: "string" },
      },
      required: ["id", "changes", "rationale"],
    },
  },
};

const createStory: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: "function",
  function: {
    name: "propose_create_story",
    description:
      "Propose creating a new user story under an epic. Use 'As a [persona], I want [action], so that [outcome]' format for description. Acceptance criteria use Given/When/Then.",
    parameters: {
      type: "object",
      properties: {
        epic_id: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        acceptance_criteria: {
          type: "array",
          items: {
            type: "object",
            properties: {
              given: { type: "string" },
              when: { type: "string" },
              then: { type: "string" },
            },
            required: ["given", "when", "then"],
          },
        },
        story_points: { type: "number" },
        priority: { type: "string", description: "critical, high, medium, or low" },
        moscow: { type: "string", description: "must_have, should_have, could_have, or wont_have" },
        rationale: { type: "string" },
      },
      required: ["epic_id", "title", "rationale"],
    },
  },
};

const editStory: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: "function",
  function: {
    name: "propose_edit_story",
    description: "Propose updating fields on an existing story.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string" },
        changes: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            acceptance_criteria: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  given: { type: "string" },
                  when: { type: "string" },
                  then: { type: "string" },
                },
                required: ["given", "when", "then"],
              },
            },
            story_points: { type: "number" },
            priority: { type: "string" },
            moscow: { type: "string" },
            status: { type: "string" },
          },
        },
        rationale: { type: "string" },
      },
      required: ["id", "changes", "rationale"],
    },
  },
};

const createTask: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: "function",
  function: {
    name: "propose_create_task",
    description: "Propose creating a new implementation task under a story.",
    parameters: {
      type: "object",
      properties: {
        story_id: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        technical_details: { type: "string" },
        estimated_hours: { type: "number" },
        labels: {
          type: "array",
          items: { type: "string" },
          description: "Subset of: frontend, backend, design, qa, devops",
        },
        rationale: { type: "string" },
      },
      required: ["story_id", "title", "rationale"],
    },
  },
};

const editTask: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: "function",
  function: {
    name: "propose_edit_task",
    description: "Propose updating fields on an existing task.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string" },
        changes: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            technical_details: { type: "string" },
            estimated_hours: { type: "number" },
            labels: { type: "array", items: { type: "string" } },
            status: { type: "string" },
          },
        },
        rationale: { type: "string" },
      },
      required: ["id", "changes", "rationale"],
    },
  },
};

export function getToolsForContext(
  ctx: ScopedChatContext
): OpenAI.Chat.Completions.ChatCompletionTool[] {
  if (ctx.type === "prd") return [editPrdSection];
  if (ctx.type === "backlog")
    return [createEpic, editEpic, createStory, editStory, createTask, editTask];
  return [];
}

/**
 * Maps a function name to a Proposal `kind` discriminator.
 * The chat route uses this to convert tool_call args into a Proposal.
 */
export const TOOL_TO_PROPOSAL_KIND: Record<string, Proposal["kind"]> = {
  propose_edit_prd_section: "edit_prd_section",
  propose_create_epic: "create_epic",
  propose_edit_epic: "edit_epic",
  propose_create_story: "create_story",
  propose_edit_story: "edit_story",
  propose_create_task: "create_task",
  propose_edit_task: "edit_task",
};

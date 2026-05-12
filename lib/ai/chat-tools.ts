import type OpenAI from "openai";

/**
 * OpenAI-format tool definitions that the chat model can call.
 * The executor in `chat-tool-executor.ts` implements each one against the live Turso DB.
 *
 * Keep descriptions short but specific — the model decides which tool to use from these alone.
 */
export const CHAT_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "query_backlog",
      description:
        "List backlog items (epics, stories, or tasks) for the current project with optional filters. Use this to answer questions like 'what stories are in progress?' or 'show me high-priority tasks'.",
      parameters: {
        type: "object",
        properties: {
          entity: {
            type: "string",
            enum: ["epic", "story", "task"],
            description: "Which entity type to list",
          },
          status: {
            type: "string",
            description: "Optional status filter (e.g. 'backlog', 'in_progress', 'done', 'todo')",
          },
          priority: {
            type: "string",
            description: "Optional priority filter for stories: 'low', 'medium', 'high', 'critical'",
          },
          moscow: {
            type: "string",
            description: "Optional MoSCoW filter for stories: 'must_have', 'should_have', 'could_have', 'wont_have'",
          },
          epic_id: {
            type: "string",
            description: "Optional: restrict stories to a specific epic id",
          },
          story_id: {
            type: "string",
            description: "Optional: restrict tasks to a specific story id",
          },
          limit: {
            type: "number",
            description: "Max items to return (default 50)",
          },
        },
        required: ["entity"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "query_traceability",
      description:
        "Trace a backlog item up or down the hierarchy. For example, given a task id, return the parent story, parent epic, and any linked objectives. Given an epic, return all its stories and their tasks. Use this when the user asks 'trace X back to the PRD' or 'what's downstream of this epic?'.",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "The id of the epic, story, or task to trace",
          },
          direction: {
            type: "string",
            enum: ["up", "down", "both"],
            description: "Trace up to parents, down to children, or both",
          },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "find_gaps",
      description:
        "Identify backlog quality gaps: stories without acceptance criteria, tasks without estimates, epics without stories, stories without a persona, PRD requirements not covered by any story. Use this when the user asks 'what's missing?' or 'find gaps' or 'how's the backlog quality?'.",
      parameters: {
        type: "object",
        properties: {
          gap_type: {
            type: "string",
            enum: [
              "stories_without_acceptance_criteria",
              "tasks_without_estimates",
              "epics_without_stories",
              "stories_without_persona",
              "prd_coverage",
              "all",
            ],
            description: "Which gap type to check; 'all' returns a summary of every category",
          },
        },
        required: ["gap_type"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_artifact_detail",
      description:
        "Fetch the full content of a specific artifact by id — including description, acceptance criteria, edge cases, technical details. Use when the user asks about a specific item like 'tell me about US-042' or 'what's in EPIC-003?'.",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "The artifact id (epic, story, task, persona, or objective)",
          },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "suggest_edit",
      description:
        "Propose a structured edit to an existing backlog item — splitting an epic, reprioritizing a story, adding acceptance criteria, changing MoSCoW, etc. This DOES NOT execute the change; it returns a structured proposal the UI surfaces to the user for confirmation. Use whenever the user implies they want a change ('split this epic', 'make X a must-have', 'reprioritize Y').",
      parameters: {
        type: "object",
        properties: {
          target_id: {
            type: "string",
            description: "The id of the item to edit",
          },
          edit_type: {
            type: "string",
            enum: [
              "split_epic",
              "update_priority",
              "update_moscow",
              "update_status",
              "add_acceptance_criteria",
              "add_edge_case",
              "update_title",
              "update_description",
            ],
            description: "Kind of edit being proposed",
          },
          proposal: {
            type: "object",
            description:
              "The proposed change payload. Shape varies by edit_type. e.g. split_epic: { new_epics: [{title, description}] }; update_priority: { priority: 'high' }; add_acceptance_criteria: { criteria: ['Given...When...Then...'] }",
          },
          rationale: {
            type: "string",
            description: "Why this edit is being proposed — the PM reasoning",
          },
        },
        required: ["target_id", "edit_type", "proposal", "rationale"],
      },
    },
  },
];

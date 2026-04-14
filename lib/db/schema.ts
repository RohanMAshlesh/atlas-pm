import { sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  real,
} from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").default("active"),
  company_context: text("company_context"),
  created_at: text("created_at").default(sql`CURRENT_TIMESTAMP`),
  updated_at: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

export const documents = sqliteTable("documents", {
  id: text("id").primaryKey(),
  project_id: text("project_id").references(() => projects.id),
  filename: text("filename").notNull(),
  type: text("type").notNull(),
  content: text("content"),
  file_path: text("file_path"),
  created_at: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const syntheses = sqliteTable("syntheses", {
  id: text("id").primaryKey(),
  project_id: text("project_id").references(() => projects.id),
  content: text("content").notNull(), // JSON
  version: integer("version").default(1),
  created_at: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const prds = sqliteTable("prds", {
  id: text("id").primaryKey(),
  project_id: text("project_id").references(() => projects.id),
  content: text("content").notNull(), // JSON
  version: integer("version").default(1),
  created_at: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const prd_versions = sqliteTable("prd_versions", {
  id: text("id").primaryKey(),
  prd_id: text("prd_id").references(() => prds.id),
  content: text("content").notNull(), // JSON
  version: integer("version").notNull(),
  change_summary: text("change_summary"),
  created_at: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const personas = sqliteTable("personas", {
  id: text("id").primaryKey(),
  project_id: text("project_id").references(() => projects.id),
  name: text("name").notNull(),
  archetype: text("archetype"),
  data: text("data").notNull(), // JSON
  created_at: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const objectives = sqliteTable("objectives", {
  id: text("id").primaryKey(),
  project_id: text("project_id").references(() => projects.id),
  title: text("title").notNull(),
  description: text("description"),
  sort_order: integer("sort_order").default(0),
});

export const key_results = sqliteTable("key_results", {
  id: text("id").primaryKey(),
  objective_id: text("objective_id").references(() => objectives.id),
  project_id: text("project_id").references(() => projects.id),
  title: text("title").notNull(),
  target: text("target"),
  measurement: text("measurement"),
  sort_order: integer("sort_order").default(0),
});

export const epics = sqliteTable("epics", {
  id: text("id").primaryKey(),
  project_id: text("project_id").references(() => projects.id),
  title: text("title").notNull(),
  description: text("description"),
  objective_ids: text("objective_ids").default("[]"), // JSON array
  status: text("status").default("backlog"),
  phase: text("phase"),
  sort_order: integer("sort_order").default(0),
  technical_context: text("technical_context"),
  created_at: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const stories = sqliteTable("stories", {
  id: text("id").primaryKey(),
  epic_id: text("epic_id").references(() => epics.id),
  project_id: text("project_id").references(() => projects.id),
  title: text("title").notNull(),
  description: text("description"),
  acceptance_criteria: text("acceptance_criteria").default("[]"), // JSON
  story_points: integer("story_points"),
  priority: text("priority").default("medium"),
  moscow: text("moscow").default("should_have"),
  rice_score: text("rice_score"), // JSON
  persona_id: text("persona_id").references(() => personas.id),
  edge_cases: text("edge_cases").default("[]"), // JSON
  status: text("status").default("backlog"),
  sort_order: integer("sort_order").default(0),
  created_at: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  story_id: text("story_id").references(() => stories.id),
  project_id: text("project_id").references(() => projects.id),
  title: text("title").notNull(),
  description: text("description"),
  technical_details: text("technical_details"),
  estimated_hours: real("estimated_hours"),
  labels: text("labels").default("[]"), // JSON
  arch_component: text("arch_component"),
  status: text("status").default("todo"),
  sort_order: integer("sort_order").default(0),
  created_at: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const competitors = sqliteTable("competitors", {
  id: text("id").primaryKey(),
  project_id: text("project_id").references(() => projects.id),
  name: text("name").notNull(),
  data: text("data").notNull(), // JSON
  created_at: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const feature_matrix = sqliteTable("feature_matrix", {
  id: text("id").primaryKey(),
  project_id: text("project_id").references(() => projects.id),
  features: text("features").notNull(), // JSON
  created_at: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const chat_messages = sqliteTable("chat_messages", {
  id: text("id").primaryKey(),
  project_id: text("project_id").references(() => projects.id),
  role: text("role").notNull(),
  content: text("content").notNull(),
  references: text("references").default("[]"), // JSON
  created_at: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const phases = sqliteTable("phases", {
  id: text("id").primaryKey(),
  project_id: text("project_id").references(() => projects.id),
  name: text("name").notNull(),
  description: text("description"),
  sort_order: integer("sort_order").default(0),
  target_date: text("target_date"),
  created_at: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

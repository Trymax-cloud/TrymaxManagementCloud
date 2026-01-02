import { type TaskCategory } from "@/lib/constants";

// Base profile type
export interface Profile {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

// Project type
export interface Project {
  id: string;
  name: string;
  client_name: string;
  created_at: string;
  created_by: string | null;
  description: string | null;
  end_date: string | null;
  start_date: string;
  stage: string;
  status: string;
  updated_at: string;
}

// Base assignment type (from database)
export interface BaseAssignment {
  id: string;
  title: string;
  description: string | null;
  creator_id: string;
  assignee_id: string;
  project_id: string | null;
  created_date: string;
  due_date: string | null;
  completion_date: string | null;
  status: "not_started" | "in_progress" | "completed" | "on_hold";
  priority: "normal" | "high" | "emergency";
  category: TaskCategory;
  remark: string | null;
  created_at: string;
  updated_at: string;
  // Time tracking fields
  start_time: string | null;
  end_time: string | null;
  total_duration_minutes: number | null;
}

// Assignment with joined profile data
export interface AssignmentWithProfiles extends BaseAssignment {
  creator: Profile | null;
  assignee: Profile | null;
  project: Project | null;
}

// Legacy Assignment type for backward compatibility
export interface Assignment extends BaseAssignment {
  creator?: { name: string; email: string } | null;
  assignee?: { name: string; email: string } | null;
  project?: { name: string; client_name: string } | null;
}

export interface AssignmentFilters {
  status?: string;
  priority?: string;
  projectId?: string;
  assigneeId?: string;
  category?: string;
  search?: string;
}

export interface CreateAssignmentInput {
  title: string;
  description?: string;
  assignee_ids: string[]; // Changed to support multiple assignees
  project_id?: string;
  due_date?: string;
  priority: "normal" | "high" | "emergency";
  category?: TaskCategory;
  remark?: string;
}

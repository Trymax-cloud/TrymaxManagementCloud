import { Database } from "@/integrations/supabase/types";

// Base assignment row type from Supabase
type AssignmentRow = Database["public"]["Tables"]["assignments"]["Row"];

// Assignment with joined relations
export interface AssignmentWithRelations extends AssignmentRow {
  creator: { name: string; email: string } | null;
  assignee: { name: string; email: string } | null;
  project?: { name: string } | null;
}

// Assignment filters type
export interface AssignmentFilters {
  status?: string;
  priority?: string;
  projectId?: string;
  assigneeId?: string;
  category?: string;
  search?: string;
}

// Create assignment input type
export interface CreateAssignmentInput {
  title: string;
  description?: string;
  assignee_ids: string[];
  project_id?: string;
  due_date?: string;
  priority: "normal" | "high" | "emergency";
  category?: string;
  remark?: string;
}

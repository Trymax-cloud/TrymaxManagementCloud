import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import type { Project } from "./useProjects";
import type { Assignment } from "./useAssignments";

export interface ProjectProgress {
  projectId: string;
  projectName: string;
  clientName: string;
  status: string;
  totalAssignments: number;
  completedAssignments: number;
  inProgressAssignments: number;
  pendingAssignments: number;
  progressPercentage: number;
  startDate: string;
  endDate: string | null;
  daysRemaining: number | null;
  isAtRisk: boolean;
  overdueAssignments: number;
}

export interface ProjectAnalytics {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  atRiskProjects: number;
  averageProgress: number;
  projectsWithDeadlineThisWeek: number;
  projectsWithDeadlineThisMonth: number;
}

// Calculate project progress from assignments
function calculateProjectProgress(
  project: Project,
  assignments: Assignment[]
): ProjectProgress {
  const projectAssignments = assignments.filter((a) => a.project_id === project.id);
  const now = new Date();
  
  const total = projectAssignments.length;
  const completed = projectAssignments.filter((a) => a.status === "completed").length;
  const inProgress = projectAssignments.filter((a) => a.status === "in_progress").length;
  const pending = projectAssignments.filter((a) => a.status === "not_started").length;
  const overdue = projectAssignments.filter(
    (a) => a.due_date && new Date(a.due_date) < now && a.status !== "completed"
  ).length;

  const progressPercentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Calculate days remaining
  let daysRemaining: number | null = null;
  if (project.end_date) {
    const endDate = new Date(project.end_date);
    daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }

  // Determine if project is at risk
  // At risk if: has deadline, <10 days remaining, and progress < 80%
  const isAtRisk =
    daysRemaining !== null &&
    daysRemaining <= 10 &&
    daysRemaining > 0 &&
    progressPercentage < 80;

  return {
    projectId: project.id,
    projectName: project.name,
    clientName: project.client_name,
    status: project.status,
    totalAssignments: total,
    completedAssignments: completed,
    inProgressAssignments: inProgress,
    pendingAssignments: pending,
    progressPercentage,
    startDate: project.start_date,
    endDate: project.end_date,
    daysRemaining,
    isAtRisk,
    overdueAssignments: overdue,
  };
}

// Hook to get all projects' progress
export function useProjectsProgress() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["projects-progress"],
    queryFn: async () => {
      const [projectsResponse, assignmentsResponse] = await Promise.all([
        supabase.from("projects").select("*").order("created_at", { ascending: false }),
        supabase.from("assignments").select("*"),
      ]);

      if (projectsResponse.error) throw projectsResponse.error;
      if (assignmentsResponse.error) throw assignmentsResponse.error;

      const projects = projectsResponse.data as Project[];
      const assignments = assignmentsResponse.data as Assignment[];

      return projects.map((project) => calculateProjectProgress(project, assignments));
    },
    enabled: !!user,
  });
}

// Hook to get single project progress
export function useProjectProgress(projectId: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["project-progress", projectId],
    queryFn: async () => {
      const [projectResponse, assignmentsResponse] = await Promise.all([
        supabase.from("projects").select("*").eq("id", projectId).single(),
        supabase.from("assignments").select("*").eq("project_id", projectId),
      ]);

      if (projectResponse.error) throw projectResponse.error;
      if (assignmentsResponse.error) throw assignmentsResponse.error;

      return calculateProjectProgress(
        projectResponse.data as Project,
        assignmentsResponse.data as Assignment[]
      );
    },
    enabled: !!user && !!projectId,
  });
}

// Hook to get project analytics summary
export function useProjectAnalytics() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["project-analytics"],
    queryFn: async () => {
      const [projectsResponse, assignmentsResponse] = await Promise.all([
        supabase.from("projects").select("*"),
        supabase.from("assignments").select("*"),
      ]);

      if (projectsResponse.error) throw projectsResponse.error;
      if (assignmentsResponse.error) throw assignmentsResponse.error;

      const projects = projectsResponse.data as Project[];
      const assignments = assignmentsResponse.data as Assignment[];
      const now = new Date();
      const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const oneMonthFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const progressList = projects.map((p) => calculateProjectProgress(p, assignments));

      const analytics: ProjectAnalytics = {
        totalProjects: projects.length,
        activeProjects: projects.filter((p) => p.status === "active").length,
        completedProjects: projects.filter((p) => p.status === "completed").length,
        atRiskProjects: progressList.filter((p) => p.isAtRisk).length,
        averageProgress:
          progressList.length > 0
            ? Math.round(
                progressList.reduce((sum, p) => sum + p.progressPercentage, 0) /
                  progressList.length
              )
            : 0,
        projectsWithDeadlineThisWeek: projects.filter(
          (p) => p.end_date && new Date(p.end_date) <= oneWeekFromNow && new Date(p.end_date) >= now
        ).length,
        projectsWithDeadlineThisMonth: projects.filter(
          (p) => p.end_date && new Date(p.end_date) <= oneMonthFromNow && new Date(p.end_date) >= now
        ).length,
      };

      return analytics;
    },
    enabled: !!user,
  });
}

// Hook to get at-risk projects
export function useAtRiskProjects() {
  const { data: progress } = useProjectsProgress();

  return {
    data: progress?.filter((p) => p.isAtRisk) || [],
    isLoading: !progress,
  };
}

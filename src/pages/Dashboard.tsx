import { useState } from "react";
import { Plus, ClipboardList, CheckCircle2, Clock, AlertTriangle, Users, FolderKanban, CreditCard } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { TodayAssignments } from "@/components/dashboard/TodayAssignments";
import { OverdueAssignments } from "@/components/dashboard/OverdueAssignments";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { AttendanceWidget } from "@/components/dashboard/AttendanceWidget";
import { AttendanceCard } from "@/components/attendance/AttendanceCard";
import { CreateAssignmentModal } from "@/components/assignments/CreateAssignmentModal";
import { AssignmentDetailModal } from "@/components/assignments/AssignmentDetailModal";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useAssignmentStats, useAssignments, type Assignment } from "@/hooks/useAssignments";
import { useProjects } from "@/hooks/useProjects";
import { useProfiles } from "@/hooks/useProfiles";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

export default function Dashboard() {
  const { user } = useAuth();
  const { isDirector, isLoading: roleLoading } = useUserRole();
  const { data: stats, isLoading: statsLoading } = useAssignmentStats();
  const { data: allAssignments } = useAssignments();
  const { data: projects } = useProjects();
  const { data: profiles } = useProfiles();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);

  const userName = user?.user_metadata?.name || "there";

  // Director stats
  const directorStats = {
    totalEmployees: profiles?.length || 0,
    activeProjects: projects?.filter(p => p.status === "active").length || 0,
    overdueAssignments: allAssignments?.filter(a => 
      a.due_date && new Date(a.due_date) < new Date() && a.status !== "completed"
    ).length || 0,
  };

  if (roleLoading) {
    return (
      <AppLayout title="Dashboard">
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner size="lg" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Dashboard">
      <div className="space-y-6 animate-fade-in">
        {/* Welcome Section */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold text-foreground">
              Good {getGreeting()}, {userName}! 👋
            </h2>
            <p className="text-muted-foreground">
              Here's what's happening with your {isDirector ? "team" : "work"} today.
            </p>
          </div>
          <Button className="gap-2" onClick={() => setShowCreateModal(true)}>
            <Plus className="h-4 w-4" />
            New Assignment
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {isDirector ? (
            <>
              <StatsCard
                title="Total Employees"
                value={directorStats.totalEmployees}
                icon={Users}
                subtitle="in your organization"
              />
              <StatsCard
                title="Active Projects"
                value={directorStats.activeProjects}
                icon={FolderKanban}
                variant="info"
              />
              <StatsCard
                title="Total Assignments"
                value={allAssignments?.length || 0}
                icon={ClipboardList}
              />
              <StatsCard
                title="Overdue Tasks"
                value={directorStats.overdueAssignments}
                icon={AlertTriangle}
                variant="danger"
                subtitle="require attention"
              />
            </>
          ) : (
            <>
              <StatsCard
                title="Total Assignments"
                value={stats?.total || 0}
                icon={ClipboardList}
                trend={stats?.total ? { value: "+3", isPositive: true } : undefined}
                subtitle="this week"
              />
              <StatsCard
                title="Completed"
                value={stats?.completed || 0}
                icon={CheckCircle2}
                variant="success"
                subtitle={stats?.total ? `${Math.round((stats.completed / stats.total) * 100)}% completion` : ""}
              />
              <StatsCard
                title="In Progress"
                value={stats?.inProgress || 0}
                icon={Clock}
                variant="info"
              />
              <StatsCard
                title="Emergency"
                value={stats?.emergency || 0}
                icon={AlertTriangle}
                variant="danger"
                subtitle="urgent tasks"
              />
            </>
          )}
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            {/* Overdue Assignments Alert */}
            <OverdueAssignments onAssignmentClick={setSelectedAssignment} />
            
            {/* Today's Assignments */}
            <TodayAssignments onAssignmentClick={setSelectedAssignment} />
          </div>

          {/* Quick Actions Sidebar */}
          <div className="space-y-6">
            {/* Attendance Card for employees, Widget for directors */}
            {isDirector ? (
              <AttendanceWidget />
            ) : (
              <AttendanceCard />
            )}
            
            <QuickActions
              isDirector={isDirector}
              onCreateSelfAssignment={() => setShowCreateModal(true)}
              onAssignToOthers={() => setShowAssignModal(true)}
            />
          </div>
        </div>
      </div>

      {/* Modals */}
      <CreateAssignmentModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        isSelfAssignment
      />
      <CreateAssignmentModal
        open={showAssignModal}
        onOpenChange={setShowAssignModal}
        isSelfAssignment={false}
      />
      <AssignmentDetailModal
        assignment={selectedAssignment}
        open={!!selectedAssignment}
        onOpenChange={(open) => !open && setSelectedAssignment(null)}
      />
    </AppLayout>
  );
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

import { AppLayout } from "@/components/layout/AppLayout";
import { useUserRole } from "@/hooks/useUserRole";
import { AttendanceCard } from "@/components/attendance/AttendanceCard";
import { AttendanceHistoryTable } from "@/components/attendance/AttendanceHistoryTable";
import { DirectorAttendanceView } from "@/components/attendance/DirectorAttendanceView";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

export default function Attendance() {
  const { isDirector, isLoading } = useUserRole();

  if (isLoading) {
    return (
      <AppLayout title="Attendance">
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner size="lg" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Attendance">
      <div className="space-y-6 animate-fade-in">
        <p className="text-muted-foreground">
          {isDirector
            ? "View and manage team attendance records"
            : "Track your daily check-in and check-out times"}
        </p>

        {isDirector ? (
          // Director View: Team attendance overview
          <DirectorAttendanceView />
        ) : (
          // Employee View: Personal attendance
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <AttendanceCard />
            </div>
            <div className="lg:col-span-2">
              <AttendanceHistoryTable />
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

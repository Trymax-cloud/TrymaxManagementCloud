import { format } from "date-fns";
import { Users, UserCheck, UserX, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAttendanceStats } from "@/hooks/useAttendance";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

export function AttendanceWidget() {
  const today = format(new Date(), "yyyy-MM-dd");
  const { data: stats, isLoading } = useAttendanceStats(today);

  if (isLoading) {
    return (
      <Card className="border-0 shadow-soft">
        <CardContent className="flex items-center justify-center py-8">
          <LoadingSpinner />
        </CardContent>
      </Card>
    );
  }

  const items = [
    {
      label: "Present",
      value: stats?.present || 0,
      icon: UserCheck,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      label: "Absent",
      value: stats?.absent || 0,
      icon: UserX,
      color: "text-red-600",
      bg: "bg-red-50",
    },
    {
      label: "Half Day",
      value: stats?.halfDay || 0,
      icon: Clock,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
  ];

  return (
    <Card className="border-0 shadow-soft">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4 text-primary" />
          Today's Attendance
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3">
          {items.map((item) => (
            <div
              key={item.label}
              className={`rounded-lg ${item.bg} p-3 text-center`}
            >
              <item.icon className={`h-5 w-5 mx-auto mb-1 ${item.color}`} />
              <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
              <p className="text-xs text-muted-foreground">{item.label}</p>
            </div>
          ))}
        </div>
        {stats && stats.total > 0 && (
          <p className="text-xs text-muted-foreground text-center mt-3">
            {stats.total} employee{stats.total !== 1 ? "s" : ""} tracked today
          </p>
        )}
      </CardContent>
    </Card>
  );
}

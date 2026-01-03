import { memo, useMemo, useCallback } from "react";
import { format, isToday, endOfDay } from "date-fns";
import { ArrowRight, Calendar as CalendarIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AssignmentCard } from "@/components/assignments/AssignmentCard";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useMyAssignments, type Assignment } from "@/hooks/useAssignments";
import { useMyAssignmentsWithProfiles } from "@/hooks/useAssignmentsWithProfiles";

interface TodayAssignmentsProps {
  onAssignmentClick: (assignment: Assignment) => void;
}

export const TodayAssignments = memo(function TodayAssignments({ 
  onAssignmentClick 
}: TodayAssignmentsProps) {
  const { data: assignments, isLoading } = useMyAssignmentsWithProfiles();

  const todayAssignments = useMemo(() => 
    assignments?.filter((a) => {
      if (!a.due_date) return false;
      return isToday(new Date(a.due_date));
    }) || [],
    [assignments]
  );

  const upcomingAssignments = useMemo(() => 
    assignments?.filter((a) => {
      if (!a.due_date) return false;
      const dueDate = new Date(a.due_date);
      return dueDate > endOfDay(new Date()) && a.status !== "completed";
    }).slice(0, 3) || [],
    [assignments]
  );

  const formattedDate = useMemo(() => 
    format(new Date(), "EEEE, MMMM d, yyyy"),
    []
  );

  const handleAssignmentClick = useCallback(
    (assignment: Assignment) => () => onAssignmentClick(assignment),
    [onAssignmentClick]
  );

  return (
    <Card className="border-0 shadow-soft">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-primary" />
            Today's Assignments
          </CardTitle>
          <CardDescription>{formattedDate}</CardDescription>
        </div>
        <Button variant="ghost" size="sm" asChild className="gap-2">
          <Link to="/assignments">
            View All <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : todayAssignments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CalendarIcon className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No assignments due today</p>
            <p className="text-sm mt-1">
              {upcomingAssignments.length > 0
                ? `${upcomingAssignments.length} upcoming assignments`
                : "You're all caught up!"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {todayAssignments.slice(0, 5).map((assignment) => (
              <AssignmentCard
                key={assignment.id}
                assignment={assignment}
                onClick={handleAssignmentClick(assignment)}
              />
            ))}
            {todayAssignments.length > 5 && (
              <p className="text-sm text-center text-muted-foreground pt-2">
                +{todayAssignments.length - 5} more assignments
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
});

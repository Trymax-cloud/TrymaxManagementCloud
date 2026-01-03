import { memo, useCallback } from "react";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AssignmentCard } from "@/components/assignments/AssignmentCard";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useOverdueAssignments, type Assignment } from "@/hooks/useAssignments";
import { useOverdueAssignmentsWithProfiles } from "@/hooks/useAssignmentsWithProfiles";

interface OverdueAssignmentsProps {
  onAssignmentClick: (assignment: Assignment) => void;
}

export const OverdueAssignments = memo(function OverdueAssignments({ 
  onAssignmentClick 
}: OverdueAssignmentsProps) {
  const { data: overdueAssignments, isLoading } = useOverdueAssignmentsWithProfiles();

  const handleAssignmentClick = useCallback(
    (assignment: Assignment) => () => onAssignmentClick(assignment),
    [onAssignmentClick]
  );

  if (isLoading) {
    return (
      <Card className="border-0 shadow-soft border-l-4 border-l-destructive">
        <CardContent className="flex justify-center py-8">
          <LoadingSpinner />
        </CardContent>
      </Card>
    );
  }

  if (!overdueAssignments || overdueAssignments.length === 0) {
    return null;
  }

  return (
    <Card className="border-0 shadow-soft border-l-4 border-l-destructive">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Overdue Assignments
          </CardTitle>
          <CardDescription>
            {overdueAssignments.length} task{overdueAssignments.length !== 1 ? "s" : ""} past due date
          </CardDescription>
        </div>
        <Button variant="ghost" size="sm" asChild className="gap-2">
          <Link to="/assignments?status=overdue">
            View All <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {overdueAssignments.slice(0, 3).map((assignment) => (
            <AssignmentCard
              key={assignment.id}
              assignment={assignment}
              onClick={handleAssignmentClick(assignment)}
            />
          ))}
          {overdueAssignments.length > 3 && (
            <p className="text-sm text-center text-muted-foreground pt-2">
              +{overdueAssignments.length - 3} more overdue
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
});

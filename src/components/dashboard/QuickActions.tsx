import {
  Plus,
  ClipboardList,
  TrendingUp,
  Users,
  FolderKanban,
  FileText,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface QuickActionsProps {
  isDirector: boolean;
  onCreateSelfAssignment: () => void;
  onAssignToOthers?: () => void;
}

export function QuickActions({
  isDirector,
  onCreateSelfAssignment,
  onAssignToOthers,
}: QuickActionsProps) {
  return (
    <Card className="border-0 shadow-soft">
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
        <CardDescription>Common tasks at your fingertips</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button
          variant="outline"
          className="w-full justify-start gap-2"
          onClick={onCreateSelfAssignment}
        >
          <Plus className="h-4 w-4" />
          Create Self Assignment
        </Button>

        <Button variant="outline" className="w-full justify-start gap-2" asChild>
          <Link to="/daily-summary">
            <FileText className="h-4 w-4" />
            View Daily Summary
          </Link>
        </Button>

        <Button variant="outline" className="w-full justify-start gap-2" asChild>
          <Link to="/ratings">
            <TrendingUp className="h-4 w-4" />
            Check My Ratings
          </Link>
        </Button>

        {isDirector && (
          <>
            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={onAssignToOthers}
            >
              <Users className="h-4 w-4" />
              Assign to Employee
            </Button>

            <Button variant="outline" className="w-full justify-start gap-2" asChild>
              <Link to="/projects">
                <FolderKanban className="h-4 w-4" />
                Manage Projects
              </Link>
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

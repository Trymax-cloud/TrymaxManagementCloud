import { useState } from "react";
import { useAssignmentsWithProfiles, useMyAssignmentsWithProfiles } from "@/hooks/useAssignmentsWithProfiles";
import { useSimpleDeleteAssignment } from "@/hooks/useSimpleDeleteAssignment";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

export function AssignmentDebugTest() {
  const { user } = useAuth();
  const { data: allAssignments, isLoading: allLoading, error: allError } = useAssignmentsWithProfiles();
  const { data: myAssignments, isLoading: myLoading, error: myError } = useMyAssignmentsWithProfiles();
  const deleteAssignment = useSimpleDeleteAssignment();

  console.log("🔍 DEBUG TEST - User:", user);
  console.log("🔍 DEBUG TEST - All assignments:", { data: allAssignments, loading: allLoading, error: allError });
  console.log("🔍 DEBUG TEST - My assignments:", { data: myAssignments, loading: myLoading, error: myError });

  const handleTestDelete = (assignmentId: string) => {
    console.log("🗑️ DEBUG TEST - Deleting assignment:", assignmentId);
    deleteAssignment.mutate(assignmentId);
  };

  if (allLoading || myLoading) {
    return <LoadingSpinner />;
  }

  if (allError || myError) {
    return (
      <Card className="border-red-500">
        <CardHeader>
          <CardTitle className="text-red-500">Error Loading Assignments</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-500">
            All Error: {allError?.message}
          </p>
          <p className="text-red-500">
            My Error: {myError?.message}
          </p>
        </CardContent>
      </Card>
    );
  }

  const assignments = user ? allAssignments : myAssignments;

  return (
    <div className="space-y-4 p-4">
      <h2 className="text-2xl font-bold">Assignment Debug Test</h2>
      
      <Card>
        <CardHeader>
          <CardTitle>User Info</CardTitle>
        </CardHeader>
        <CardContent>
          <p>User ID: {user?.id}</p>
          <p>User Email: {user?.email}</p>
          <p>Total Assignments: {assignments?.length || 0}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Assignments ({assignments?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {assignments && assignments.length > 0 ? (
            <div className="space-y-2">
              {assignments.map((assignment) => (
                <div key={assignment.id} className="border p-2 rounded">
                  <p><strong>ID:</strong> {assignment.id}</p>
                  <p><strong>Title:</strong> {assignment.title}</p>
                  <p><strong>Status:</strong> {assignment.status}</p>
                  <p><strong>Creator:</strong> {assignment.creator?.name || 'Not loaded'}</p>
                  <p><strong>Assignee:</strong> {assignment.assignee?.name || 'Not loaded'}</p>
                  <Button 
                    onClick={() => handleTestDelete(assignment.id)}
                    disabled={deleteAssignment.isPending}
                    className="mt-2"
                  >
                    {deleteAssignment.isPending ? 'Deleting...' : 'Delete This Assignment'}
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p>No assignments found</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Delete Hook Status</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Is Pending: {deleteAssignment.isPending ? 'Yes' : 'No'}</p>
          <p>Is Success: {deleteAssignment.isSuccess ? 'Yes' : 'No'}</p>
          <p>Is Error: {deleteAssignment.isError ? 'Yes' : 'No'}</p>
          {deleteAssignment.error && (
            <p className="text-red-500">Error: {deleteAssignment.error.message}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

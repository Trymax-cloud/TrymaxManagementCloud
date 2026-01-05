import { useState, useEffect, useCallback } from "react";
import { format, addDays, subDays, startOfDay, endOfDay, isToday } from "date-fns";
import { CalendarIcon, ChevronLeft, ChevronRight, CheckCircle2, Clock, AlertTriangle, Save, Users } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useMyAssignmentsWithProfiles, useAssignmentsWithProfiles } from "@/hooks/useAssignmentsWithProfiles";
import { useSaveDailySummary, useDailySummaries, useAllEmployeeDailySummaries } from "@/hooks/useDailySummaryData";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useProfiles } from "@/hooks/useProfiles";
import { cn } from "@/lib/utils";
import type { AssignmentPriority, AssignmentStatus } from "@/types";

export default function DailySummary() {
  const { user } = useAuth();
  const { isDirector } = useUserRole();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [notes, setNotes] = useState("");
  const [hasUnsavedNotes, setHasUnsavedNotes] = useState(false);
  const [expandedEmployees, setExpandedEmployees] = useState<Set<string>>(new Set());

  const { data: myAssignments, isLoading: myLoading } = useMyAssignmentsWithProfiles();
  const { data: allAssignments, isLoading: allLoading } = useAssignmentsWithProfiles();
  const { data: profiles } = useProfiles();
  const { data: employeeSummaries, isLoading: summariesLoading } = useAllEmployeeDailySummaries(selectedDate);
  const { data: savedSummaries } = useDailySummaries(selectedDate, selectedDate, user?.id);
  const saveSummary = useSaveDailySummary();

  const assignments = isDirector ? allAssignments : myAssignments;
  const isLoading = isDirector ? allLoading : myLoading;
  const userName = user?.user_metadata?.name || "User";

  // Load saved notes when date changes
  useEffect(() => {
    const savedSummary = savedSummaries?.find(s => s.date === format(selectedDate, "yyyy-MM-dd"));
    setNotes(savedSummary?.notes || "");
    setHasUnsavedNotes(false);
  }, [savedSummaries, selectedDate]);

  // Filter assignments for selected date
  const dateStart = startOfDay(selectedDate);
  const dateEnd = endOfDay(selectedDate);

  const todayAssignments = assignments?.filter(a => {
    if (!a.due_date) return false;
    const dueDate = new Date(a.due_date);
    return dueDate >= dateStart && dueDate <= dateEnd;
  }) || [];

  const completedToday = assignments?.filter(a => {
    if (!a.completion_date) return false;
    const completionDate = new Date(a.completion_date);
    return completionDate >= dateStart && completionDate <= dateEnd;
  }) || [];

  // Clean stats - no time tracking, no duplicates
  const stats = {
    dueToday: todayAssignments.length,
    completed: completedToday.length,
    inProgress: todayAssignments.filter(a => a.status === "in_progress").length,
    pending: todayAssignments.filter(a => a.status === "not_started").length,
    emergency: todayAssignments.filter(a => a.priority === "emergency").length,
    completionRate: todayAssignments.length > 0 ? Math.round((completedToday.length / todayAssignments.length) * 100) : 0,
  };

  const navigateDate = (direction: "prev" | "next") => {
    setSelectedDate(prev => direction === "prev" ? subDays(prev, 1) : addDays(prev, 1));
  };

  const handleSaveNotes = () => {
    saveSummary.mutate({
      date: selectedDate,
      notes,
      tasksCompleted: stats.completed,
      tasksPending: stats.pending,
      tasksInProgress: stats.inProgress,
      emergencyTasks: stats.emergency,
    });
    setHasUnsavedNotes(false);
  };

  const handleNotesChange = (value: string) => {
    setNotes(value);
    setHasUnsavedNotes(true);
  };

  const getProfileName = (userId: string) => {
    return profiles?.find(p => p.id === userId)?.name || "Unknown";
  };

  const toggleEmployeeExpanded = useCallback((userId: string) => {
    setExpandedEmployees(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  }, []);

  // Director View
  if (isDirector) {
    return (
      <AppLayout title="Daily Summary">
        <div className="space-y-6 animate-fade-in">
          {/* Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-muted-foreground">
              View daily reports for all employees
            </p>
          </div>

          {/* Date Navigation */}
          <Card className="border-0 shadow-soft">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="icon" onClick={() => navigateDate("prev")}>
                  <ChevronLeft className="h-5 w-5" />
                </Button>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="gap-2 min-w-[200px]">
                      <CalendarIcon className="h-4 w-4" />
                      <span className="font-semibold">{format(selectedDate, "EEEE, MMMM d, yyyy")}</span>
                      {isToday(selectedDate) && (
                        <Badge variant="secondary" className="ml-2">Today</Badge>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="center">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => date && setSelectedDate(date)}
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigateDate("next")}
                  disabled={isToday(selectedDate)}
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Director's Own Summary */}
          <Card className="border-0 shadow-soft">
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                <span>My Daily Summary</span>
                {hasUnsavedNotes && (
                  <Badge variant="outline" className="text-xs">Unsaved</Badge>
                )}
              </CardTitle>
              <CardDescription>Your personal daily report for {format(selectedDate, "MMMM d, yyyy")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Director's Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <p className="text-lg font-bold text-green-600">{stats.completed}</p>
                  <p className="text-xs text-muted-foreground">Completed</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-blue-600">{stats.inProgress}</p>
                  <p className="text-xs text-muted-foreground">In Progress</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-amber-600">{stats.pending}</p>
                  <p className="text-xs text-muted-foreground">Pending</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-red-600">{stats.emergency}</p>
                  <p className="text-xs text-muted-foreground">Emergency</p>
                </div>
              </div>
              
              {/* Director's Notes */}
              <div className="space-y-3">
                <p className="font-medium">Daily Notes</p>
                <Textarea
                  placeholder="Write your notes for today..."
                  value={notes}
                  onChange={(e) => handleNotesChange(e.target.value)}
                  className="min-h-[100px] resize-none"
                />
                <Button 
                  onClick={handleSaveNotes} 
                  disabled={saveSummary.isPending || !hasUnsavedNotes}
                  className="gap-2"
                >
                  {saveSummary.isPending ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save Notes
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Team Daily Reports */}
          <Card className="border-0 shadow-soft">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                Team Daily Reports
              </CardTitle>
              <CardDescription>
                Work report for all team members on {format(selectedDate, "MMMM d, yyyy")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {summariesLoading ? (
                <div className="flex justify-center py-8">
                  <LoadingSpinner />
                </div>
              ) : !employeeSummaries || employeeSummaries.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No employee data available</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {employeeSummaries.map((summary) => {
                    const isExpanded = expandedEmployees.has(summary.userId);
                    const hasNotes = !!summary.notes;
                    const isDirector = summary.userRole === 'director';
                    
                    return (
                      <div key={summary.userId} className="rounded-lg border bg-card overflow-hidden">
                        <button
                          className={cn(
                            "w-full flex items-center justify-between p-4 hover:bg-accent/50 transition-colors text-left",
                            isExpanded && "bg-accent/30"
                          )}
                          onClick={() => toggleEmployeeExpanded(summary.userId)}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{summary.userName}</p>
                              {isDirector && (
                                <Badge variant="default" className="text-xs bg-purple-100 text-purple-800 border-purple-200">Director</Badge>
                              )}
                              {hasNotes && (
                                <Badge variant="secondary" className="text-xs">Notes</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">{summary.userEmail}</p>
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <div className="text-center">
                              <p className="text-lg font-bold text-green-600">{summary.tasksCompleted}</p>
                              <p className="text-xs text-muted-foreground">Completed</p>
                            </div>
                            <div className="text-center">
                              <p className="text-lg font-bold text-blue-600">{summary.tasksInProgress}</p>
                              <p className="text-xs text-muted-foreground">In Progress</p>
                            </div>
                            <div className="text-center">
                              <p className="text-lg font-bold text-amber-600">{summary.tasksPending}</p>
                              <p className="text-xs text-muted-foreground">Pending</p>
                            </div>
                            <div className="text-center">
                              <p className="text-lg font-bold text-red-600">{summary.emergencyTasks}</p>
                              <p className="text-xs text-muted-foreground">Emergency</p>
                            </div>
                          </div>
                        </button>
                        
                        {isExpanded && (
                          <div className="px-4 pb-4 pt-2 border-t bg-muted/30">
                            <div className="text-sm">
                              <p className="font-medium mb-1">Daily Notes</p>
                              {summary.notes ? (
                                <p className="text-muted-foreground whitespace-pre-wrap">
                                  {summary.notes}
                                </p>
                              ) : (
                                <p className="text-muted-foreground italic">
                                  No notes added for this day
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  // Employee View
  return (
    <AppLayout title="Daily Summary">
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground">Your daily work summary</p>
        </div>

        {/* Date Navigation */}
        <Card className="border-0 shadow-soft">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="icon" onClick={() => navigateDate("prev")}>
                <ChevronLeft className="h-5 w-5" />
              </Button>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="gap-2 min-w-[200px]">
                    <CalendarIcon className="h-4 w-4" />
                    <span className="font-semibold">{format(selectedDate, "EEEE, MMMM d, yyyy")}</span>
                    {isToday(selectedDate) && (
                      <Badge variant="secondary" className="ml-2">Today</Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="center">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && setSelectedDate(date)}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigateDate("next")}
                disabled={isToday(selectedDate)}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Clean Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-0 shadow-soft">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.completed}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-soft">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.inProgress}</p>
                <p className="text-xs text-muted-foreground">In Progress</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-soft">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.pending}</p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-soft">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.emergency}</p>
                <p className="text-xs text-muted-foreground">Emergency</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Notes Section */}
        <Card className="border-0 shadow-soft">
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              <span>Daily Notes</span>
              {hasUnsavedNotes && (
                <Badge variant="outline" className="text-xs">Unsaved</Badge>
              )}
            </CardTitle>
            <CardDescription>Add your notes and observations for the day</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="Write your notes for today..."
              value={notes}
              onChange={(e) => handleNotesChange(e.target.value)}
              className="min-h-[100px] resize-none"
            />
            <Button 
              onClick={handleSaveNotes} 
              disabled={saveSummary.isPending || !hasUnsavedNotes}
              className="gap-2"
            >
              {saveSummary.isPending ? (
                <LoadingSpinner size="sm" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Notes
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

import { useState, useEffect, useCallback } from "react";
import { format, addDays, subDays, startOfDay, endOfDay, isToday } from "date-fns";
import { CalendarIcon, ChevronLeft, ChevronRight, Download, Printer, CheckCircle2, Clock, AlertTriangle, FileText, Save, Users, ChevronDown, ChevronUp, StickyNote, TrendingUp, Target, Activity } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge, PriorityBadge } from "@/components/ui/status-badge";
import { CategoryBadge } from "@/components/ui/category-badge";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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

  // Assignments WORKED ON today (based on start_time)
  const workedOnToday = assignments?.filter(a => {
    if (!a.start_time) return false;
    const startTime = new Date(a.start_time);
    return startTime >= dateStart && startTime <= dateEnd;
  }) || [];

  // Stats for the day
  const stats = {
    dueToday: todayAssignments.length,
    completed: completedToday.length,
    inProgress: todayAssignments.filter(a => a.status === "in_progress").length,
    pending: todayAssignments.filter(a => a.status === "not_started").length,
    emergency: todayAssignments.filter(a => a.priority === "emergency").length,
    workedOn: workedOnToday.length,
    totalTimeMinutes: workedOnToday.reduce((sum, a) => sum + (a.total_duration_minutes || 0), 0),
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
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-2">
                <Download className="h-4 w-4" />
                Export
              </Button>
              <Button variant="outline" size="sm" className="gap-2">
                <Printer className="h-4 w-4" />
                Print
              </Button>
            </div>
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

          {/* Employee-wise Summary */}
          <Card className="border-0 shadow-soft">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                Employee Work Summary
              </CardTitle>
              <CardDescription>
                Work report for {format(selectedDate, "MMMM d, yyyy")}
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
                    
                    return (
                      <Collapsible
                        key={summary.userId}
                        open={isExpanded}
                        onOpenChange={() => toggleEmployeeExpanded(summary.userId)}
                      >
                        <div className="rounded-lg border bg-card overflow-hidden">
                          <CollapsibleTrigger asChild>
                            <button
                              className={cn(
                                "w-full flex items-center justify-between p-4 hover:bg-accent/50 transition-colors text-left",
                                isExpanded && "bg-accent/30"
                              )}
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <p className="font-medium">{summary.userName}</p>
                                  {hasNotes && (
                                    <Badge variant="secondary" className="text-xs gap-1">
                                      <StickyNote className="h-3 w-3" />
                                      Notes
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground">{summary.userEmail}</p>
                              </div>
                              <div className="flex items-center gap-4 text-sm">
                                <div className="text-center">
                                  <p className="text-lg font-bold text-success">{summary.tasksCompleted}</p>
                                  <p className="text-xs text-muted-foreground">Completed</p>
                                </div>
                                <div className="text-center">
                                  <p className="text-lg font-bold text-info">{summary.tasksInProgress}</p>
                                  <p className="text-xs text-muted-foreground">In Progress</p>
                                </div>
                                <div className="text-center">
                                  <p className="text-lg font-bold">{summary.tasksPending}</p>
                                  <p className="text-xs text-muted-foreground">Pending</p>
                                </div>
                                <div className="text-center">
                                  <p className="text-lg font-bold">{summary.tasksDue}</p>
                                  <p className="text-xs text-muted-foreground">Due</p>
                                </div>
                                <div className="ml-2">
                                  {isExpanded ? (
                                    <ChevronUp className="h-5 w-5 text-muted-foreground" />
                                  ) : (
                                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                                  )}
                                </div>
                              </div>
                            </button>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="px-4 pb-4 pt-2 border-t bg-muted/30">
                              <div className="flex items-start gap-2">
                                <StickyNote className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                                <div className="flex-1">
                                  <p className="text-sm font-medium mb-1">Daily Notes</p>
                                  {summary.notes ? (
                                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                      {summary.notes}
                                    </p>
                                  ) : (
                                    <p className="text-sm text-muted-foreground italic">
                                      No notes added for this day
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
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
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-2">
              <Download className="h-4 w-4" />
              Export
            </Button>
            <Button variant="outline" size="sm" className="gap-2">
              <Printer className="h-4 w-4" />
              Print
            </Button>
          </div>
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

        {/* Productivity Metrics */}
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
                <Activity className="h-5 w-5 text-blue-500" />
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
                <Clock className="h-5 w-5 text-amber-500" />
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
                <Target className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{(stats.completed + stats.inProgress + stats.pending) > 0 ? Math.round((stats.completed / (stats.completed + stats.inProgress + stats.pending)) * 100) : 0}%</p>
                <p className="text-xs text-muted-foreground">Completion Rate</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Stats Overview */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <Card className="border-0 shadow-soft">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.dueToday}</p>
                <p className="text-xs text-muted-foreground">Due Today</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-soft">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold text-success">{stats.completed}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-soft">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-info/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-info" />
              </div>
              <div>
                <p className="text-2xl font-bold text-info">{stats.inProgress}</p>
                <p className="text-xs text-muted-foreground">In Progress</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-soft">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                <Clock className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.pending}</p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-soft">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-emergency/10 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-emergency" />
              </div>
              <div>
                <p className="text-2xl font-bold text-emergency">{stats.emergency}</p>
                <p className="text-xs text-muted-foreground">Emergency</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-soft">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.emergency}</p>
                <p className="text-xs text-muted-foreground">Emergency Tasks</p>
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

        {/* Summary Content */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Task Status Overview */}
          <Card className="border-0 shadow-soft">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                Task Status {isToday(selectedDate) ? "Today" : `for ${format(selectedDate, "MMM d")}`}
              </CardTitle>
              <CardDescription>{assignments?.length || 0} task(s) with status tracking</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <LoadingSpinner />
                </div>
              ) : !assignments || assignments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No tasks for this date</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {assignments.map((assignment) => (
                    <div
                      key={assignment.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <div className="space-y-1 flex-1">
                        <p className="font-medium">{assignment.title}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <CategoryBadge category={assignment.category} />
                          {assignment.due_date && (
                            <span>Due: {format(new Date(assignment.due_date), "MMM d")}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <PriorityBadge priority={assignment.priority as AssignmentPriority} />
                        <StatusBadge status={assignment.status as AssignmentStatus} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Completed Today */}
          <Card className="border-0 shadow-soft">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-success" />
                Completed {isToday(selectedDate) ? "Today" : `on ${format(selectedDate, "MMM d")}`}
              </CardTitle>
              <CardDescription>{completedToday.length} task(s) completed</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <LoadingSpinner />
                </div>
              ) : completedToday.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No tasks completed on this date</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {completedToday.map((assignment) => (
                    <div
                      key={assignment.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-success/5 border-success/20"
                    >
                      <div className="space-y-1">
                        <p className="font-medium flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-success" />
                          {assignment.title}
                        </p>
                        {assignment.total_duration_minutes && assignment.total_duration_minutes > 0 && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Timer className="h-3 w-3" />
                            {formatDuration(assignment.total_duration_minutes)}
                          </p>
                        )}
                      </div>
                      <PriorityBadge priority={assignment.priority as AssignmentPriority} />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Print-friendly summary */}
        <Card className="border-0 shadow-soft print:shadow-none">
          <CardHeader>
            <CardTitle className="text-lg">Daily Summary Report</CardTitle>
            <CardDescription>
              Report for {userName} - {format(selectedDate, "MMMM d, yyyy")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Total Due:</span>
                  <span className="font-medium ml-2">{stats.dueToday}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Completed:</span>
                  <span className="font-medium ml-2 text-success">{stats.completed}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">In Progress:</span>
                  <span className="font-medium ml-2 text-info">{stats.inProgress}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Time Tracked:</span>
                  <span className="font-medium ml-2">{formatDuration(stats.totalTimeMinutes)}</span>
                </div>
              </div>
              <Separator />
              <p className="text-sm text-muted-foreground">
                Completion Rate: {stats.dueToday > 0 ? Math.round((stats.completed / stats.dueToday) * 100) : 0}%
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

import { useState, useMemo, useCallback } from "react";
import { Search, Plus, Grid3X3, List, ChevronLeft, ChevronRight, Archive, ArchiveRestore, Tag, Trash2 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AssignmentCard } from "@/components/assignments/AssignmentCard";
import { CreateAssignmentModal } from "@/components/assignments/CreateAssignmentModal";
import { AssignmentDetailModal } from "@/components/assignments/AssignmentDetailModal";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { AssignmentDebugTest } from "@/components/debug/AssignmentDebugTest";
import { StatusBadge, PriorityBadge } from "@/components/ui/status-badge";
import { CategoryBadge } from "@/components/ui/category-badge";
import { useAssignments, useMyAssignments, type Assignment, type AssignmentFilters } from "@/hooks/useAssignments";
import { type AssignmentWithRelations } from "@/types/assignment-relations";
import { useSimpleAssignments, useSimpleMyAssignments } from "@/hooks/useSimpleAssignments";
import { useAssignmentsWithProfiles, useMyAssignmentsWithProfiles } from "@/hooks/useAssignmentsWithProfiles";
import { useActiveProjects } from "@/hooks/useProjects";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/hooks/useAuth";
import { useAutoArchive, useManualArchive } from "@/hooks/useAutoArchive";
import { useDebouncedValue } from "@/hooks/useVirtualScroll";
import { useDirectDeleteAssignment } from "@/hooks/useDirectDeleteAssignment";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { TASK_CATEGORIES } from "@/lib/constants";
import type { AssignmentPriority, AssignmentStatus } from "@/types";

const ITEMS_PER_PAGE = 12;

type ArchiveFilter = "active" | "archived" | "all";

export default function Assignments() {
  const { isDirector } = useUserRole();
  const { user } = useAuth();
  const deleteAssignment = useDirectDeleteAssignment();
  const [filters, setFilters] = useState<AssignmentFilters>({});
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilter>("active");
  const [currentPage, setCurrentPage] = useState(1);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<AssignmentWithRelations | null>(null);

  const { data: projects } = useActiveProjects();
  
  // Debounce search for better performance
  const debouncedSearch = useDebouncedValue(search, 300);
  
  // Use production-ready hooks with profiles
  const { data: allAssignments, isLoading: allLoading } = useAssignmentsWithProfiles({ ...filters, search: debouncedSearch });
  const { data: myAssignments, isLoading: myLoading } = useMyAssignmentsWithProfiles({ ...filters });

  const assignments = isDirector ? allAssignments : myAssignments;
  const isLoading = isDirector ? allLoading : myLoading;

  // Auto-archive hook - runs on assignment list changes
  const { filterArchived, getArchivedOnly, isTaskArchived } = useAutoArchive(assignments);
  const { manualArchive, manualUnarchive } = useManualArchive();

  // Memoized filtering
  const searchFiltered = useMemo(() => 
    (assignments || []).filter(a => 
      !debouncedSearch || a.title.toLowerCase().includes(debouncedSearch.toLowerCase())
    ),
    [assignments, debouncedSearch]
  );

  const archiveFiltered = useMemo(() => {
    switch (archiveFilter) {
      case "active":
        return filterArchived(searchFiltered);
      case "archived":
        return getArchivedOnly(searchFiltered);
      case "all":
        return searchFiltered;
    }
  }, [archiveFilter, filterArchived, getArchivedOnly, searchFiltered]);

  const filteredAssignments = archiveFiltered;
  const archivedCount = useMemo(() => getArchivedOnly(searchFiltered).length, [getArchivedOnly, searchFiltered]);

  // Pagination
  const totalPages = Math.ceil(filteredAssignments.length / ITEMS_PER_PAGE);
  const paginatedAssignments = useMemo(() => 
    filteredAssignments.slice(
      (currentPage - 1) * ITEMS_PER_PAGE,
      currentPage * ITEMS_PER_PAGE
    ),
    [filteredAssignments, currentPage]
  );

  const handleFilterChange = useCallback((key: keyof AssignmentFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value === "all" ? undefined : value }));
    setCurrentPage(1);
  }, []);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setCurrentPage(1);
  }, []);

  const handleArchiveFilterChange = useCallback((v: ArchiveFilter) => {
    setArchiveFilter(v);
    setCurrentPage(1);
  }, []);

  const handleArchiveToggle = useCallback((assignmentId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isTaskArchived(assignmentId)) {
      manualUnarchive(assignmentId);
    } else {
      manualArchive(assignmentId);
    }
  }, [isTaskArchived, manualArchive, manualUnarchive]);

  const handleDelete = useCallback((assignmentId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row click (modal opening)
    deleteAssignment.mutate(assignmentId);
  }, [deleteAssignment]);

  const handleAssignmentClick = useCallback((assignment: AssignmentWithRelations) => {
    setSelectedAssignment(assignment);
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters({});
    setSearch("");
    setArchiveFilter("active");
  }, []);

  const handlePrevPage = useCallback(() => setCurrentPage(p => p - 1), []);
  const handleNextPage = useCallback(() => setCurrentPage(p => p + 1), []);

  return (
    <AppLayout title={isDirector ? "All Assignments" : "My Assignments"}>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-muted-foreground">
              {isDirector 
                ? `Manage and track all team assignments`
                : `View and manage your assigned tasks`}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowCreateModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Self Assignment
            </Button>
            {isDirector && (
              <Button onClick={() => setShowAssignModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Assign Task
              </Button>
            )}
          </div>
        </div>

        {/* Filters Bar */}
        <Card className="border-0 shadow-soft">
          <CardContent className="p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
              {/* Search */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search assignments..."
                  value={search}
                  onChange={handleSearchChange}
                  className="pl-10"
                />
              </div>

              {/* Filter Dropdowns */}
              <div className="flex flex-wrap gap-3">
                <Select value={filters.status || "all"} onValueChange={(v) => handleFilterChange("status", v)}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="not_started">Not Started</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="on_hold">On Hold</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filters.priority || "all"} onValueChange={(v) => handleFilterChange("priority", v)}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priority</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="emergency">Emergency</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filters.projectId || "all"} onValueChange={(v) => handleFilterChange("projectId", v)}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Project" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Projects</SelectItem>
                    {projects?.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Category Filter */}
                <Select value={filters.category || "all"} onValueChange={(v) => handleFilterChange("category", v)}>
                  <SelectTrigger className="w-[140px]">
                    <Tag className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {TASK_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Archive Filter */}
                <Select value={archiveFilter} onValueChange={handleArchiveFilterChange}>
                  <SelectTrigger className="w-[140px]">
                    <Archive className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Archive" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active Only</SelectItem>
                    <SelectItem value="archived">
                      Archived {archivedCount > 0 && `(${archivedCount})`}
                    </SelectItem>
                    <SelectItem value="all">All Tasks</SelectItem>
                  </SelectContent>
                </Select>

                {/* View Toggle */}
                <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "grid" | "list")}>
                  <TabsList className="h-10">
                    <TabsTrigger value="grid" className="px-3">
                      <Grid3X3 className="h-4 w-4" />
                    </TabsTrigger>
                    <TabsTrigger value="list" className="px-3">
                      <List className="h-4 w-4" />
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results Count */}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Showing {paginatedAssignments.length} of {filteredAssignments.length} assignments
            {archiveFilter === "archived" && " (archived)"}
          </span>
          {(filters.status || filters.priority || filters.projectId || filters.category || search || archiveFilter !== "active") && (
            <Button variant="ghost" size="sm" onClick={handleClearFilters}>
              Clear filters
            </Button>
          )}
        </div>

        {/* Assignments Grid/List */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : paginatedAssignments.length === 0 ? (
          <Card className="border-0 shadow-soft">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                {archiveFilter === "archived" ? (
                  <Archive className="h-8 w-8 text-muted-foreground" />
                ) : (
                  <Search className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              <h3 className="font-semibold text-lg mb-2">
                {archiveFilter === "archived" ? "No archived assignments" : "No assignments found"}
              </h3>
              <p className="text-muted-foreground text-center max-w-sm">
                {archiveFilter === "archived"
                  ? "Archived assignments will appear here"
                  : search || Object.keys(filters).length > 0
                    ? "Try adjusting your search or filters"
                    : "Create your first assignment to get started"}
              </p>
              {archiveFilter !== "archived" && (
                <Button className="mt-4" onClick={() => setShowCreateModal(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Assignment
                </Button>
              )}
            </CardContent>
          </Card>
        ) : viewMode === "grid" ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {paginatedAssignments.map((assignment) => (
              <div key={assignment.id} className="relative group">
                <AssignmentCard
                  assignment={assignment}
                  onClick={() => handleAssignmentClick(assignment)}
                  showAssignee={isDirector}
                />
                {/* Archive/Unarchive button overlay */}
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity",
                    "bg-background/80 backdrop-blur-sm hover:bg-background"
                  )}
                  onClick={(e) => handleArchiveToggle(assignment.id, e)}
                  title={isTaskArchived(assignment.id) ? "Unarchive" : "Archive"}
                >
                  {isTaskArchived(assignment.id) ? (
                    <ArchiveRestore className="h-4 w-4" />
                  ) : (
                    <Archive className="h-4 w-4" />
                  )}
                </Button>
                {isTaskArchived(assignment.id) && (
                  <Badge variant="secondary" className="absolute top-2 left-2">
                    Archived
                  </Badge>
                )}
              </div>
            ))}
          </div>
        ) : (
          <Card className="border-0 shadow-soft overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Title</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Priority</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Category</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Due Date</th>
                    {isDirector && <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Assignee</th>}
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {paginatedAssignments.map((assignment) => (
                    <tr
                      key={assignment.id}
                      className="hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => handleAssignmentClick(assignment)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{assignment.title}</span>
                          {isTaskArchived(assignment.id) && (
                            <Badge variant="secondary" className="text-xs">Archived</Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={assignment.status as AssignmentStatus} />
                      </td>
                      <td className="px-4 py-3">
                        <PriorityBadge priority={assignment.priority as AssignmentPriority} />
                      </td>
                      <td className="px-4 py-3">
                        <CategoryBadge category={assignment.category} />
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {assignment.due_date ? format(new Date(assignment.due_date), "MMM d, yyyy") : "—"}
                      </td>
                      {isDirector && (
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {assignment.assignee_id.slice(0, 8)}...
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => handleArchiveToggle(assignment.id, e)}
                            title={isTaskArchived(assignment.id) ? "Unarchive" : "Archive"}
                          >
                            {isTaskArchived(assignment.id) ? (
                              <ArchiveRestore className="h-4 w-4" />
                            ) : (
                              <Archive className="h-4 w-4" />
                            )}
                          </Button>
                          {isDirector && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => handleDelete(assignment.id, e)}
                              title="Delete assignment"
                              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              disabled={deleteAssignment.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="icon"
              disabled={currentPage === 1}
              onClick={handlePrevPage}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                .map((page, idx, arr) => (
                  <div key={page} className="flex items-center">
                    {idx > 0 && arr[idx - 1] !== page - 1 && (
                      <span className="px-2 text-muted-foreground">...</span>
                    )}
                    <Button
                      variant={currentPage === page ? "default" : "outline"}
                      size="icon"
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </Button>
                  </div>
                ))}
            </div>
            <Button
              variant="outline"
              size="icon"
              disabled={currentPage === totalPages}
              onClick={handleNextPage}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Modals - conditionally render to avoid Radix ref conflicts */}
      {showCreateModal && (
        <CreateAssignmentModal open={showCreateModal} onOpenChange={setShowCreateModal} isSelfAssignment />
      )}
      {showAssignModal && (
        <CreateAssignmentModal open={showAssignModal} onOpenChange={setShowAssignModal} isSelfAssignment={false} />
      )}
      {selectedAssignment && (
        <AssignmentDetailModal
          assignment={selectedAssignment}
          open={!!selectedAssignment}
          onOpenChange={(open) => !open && setSelectedAssignment(null)}
        />
      )}
      
      {/* DEBUG COMPONENT - TEMPORARY */}
      {/* <AssignmentDebugTest /> */}
    </AppLayout>
  );
}

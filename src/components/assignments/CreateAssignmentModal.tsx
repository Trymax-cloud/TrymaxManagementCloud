import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { CalendarIcon, AlertTriangle, Check, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useCreateAssignment } from "@/hooks/useAssignments";
import { useActiveProjects } from "@/hooks/useProjects";
import { useProfiles } from "@/hooks/useProfiles";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { cn } from "@/lib/utils";
import { TASK_CATEGORIES, DEFAULT_CATEGORY, type TaskCategory } from "@/lib/constants";

const assignmentSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(2000).optional(),
  project_id: z.string().optional(),
  priority: z.enum(["normal", "high", "emergency"]),
  category: z.enum(["general", "inspection", "production", "delivery", "admin", "other"]),
  remark: z.string().max(1000).optional(),
});

type AssignmentFormData = z.infer<typeof assignmentSchema>;

interface CreateAssignmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSelfAssignment?: boolean;
}

export function CreateAssignmentModal({ open, onOpenChange, isSelfAssignment = false }: CreateAssignmentModalProps) {
  const { user } = useAuth();
  const { isDirector } = useUserRole();
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const createAssignment = useCreateAssignment();
  const { data: projects } = useActiveProjects();
  const { data: profiles } = useProfiles();

  const form = useForm<AssignmentFormData>({
    resolver: zodResolver(assignmentSchema),
    defaultValues: {
      title: "",
      description: "",
      project_id: "",
      priority: "normal",
      category: DEFAULT_CATEGORY,
      remark: "",
    },
  });

  const handleAssigneeToggle = (profileId: string) => {
    setSelectedAssignees(prev => 
      prev.includes(profileId) 
        ? prev.filter(id => id !== profileId)
        : [...prev, profileId]
    );
  };

  const removeAssignee = (profileId: string) => {
    setSelectedAssignees(prev => prev.filter(id => id !== profileId));
  };

  const selectAllAssignees = () => {
    if (profiles) {
      setSelectedAssignees(profiles.map(p => p.id));
    }
  };

  const clearAllAssignees = () => {
    setSelectedAssignees([]);
  };

  const resetForm = () => {
    form.reset();
    setDueDate(undefined);
    setSelectedAssignees([]);
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      resetForm();
    }
    onOpenChange(isOpen);
  };

  const onSubmit = async (data: AssignmentFormData) => {
    const assigneeIds = isSelfAssignment ? [user?.id || ""] : selectedAssignees;
    
    if (assigneeIds.length === 0) {
      return;
    }

    try {
      await createAssignment.mutateAsync({
        title: data.title,
        description: data.description,
        assignee_ids: assigneeIds,
        project_id: data.project_id || undefined,
        due_date: dueDate?.toISOString(),
        priority: data.priority,
        category: data.category as TaskCategory,
        remark: data.remark,
      });
      handleOpenChange(false);
    } catch {
      // Error handled by mutation
    }
  };

  const getProfileName = (id: string) => {
    return profiles?.find(p => p.id === id)?.name || "Unknown";
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isSelfAssignment ? "Create Self Assignment" : "Assign Task"}</DialogTitle>
          <DialogDescription>
            {isSelfAssignment 
              ? "Create a new task for yourself" 
              : "Create and assign a task to one or multiple employees"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input id="title" placeholder="Enter assignment title" {...form.register("title")} />
            {form.formState.errors.title && (
              <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea placeholder="Describe the assignment..." rows={3} {...form.register("description")} />
          </div>

          {!isSelfAssignment && isDirector && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Assign To * <span className="text-muted-foreground text-xs">(Select one or more employees)</span></Label>
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={selectAllAssignees}>
                    Select All
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={clearAllAssignees}>
                    Clear
                  </Button>
                </div>
              </div>
              
              {/* Selected assignees badges */}
              {selectedAssignees.length > 0 && (
                <div className="flex flex-wrap gap-1 p-2 bg-muted/50 rounded-md">
                  {selectedAssignees.map(id => (
                    <Badge key={id} variant="secondary" className="gap-1">
                      {getProfileName(id)}
                      <button 
                        type="button" 
                        onClick={() => removeAssignee(id)}
                        className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              
              {/* Employee list with checkboxes */}
              <div className="h-[150px] border rounded-md overflow-y-auto">
                <div className="p-2 space-y-1">
                  {profiles?.map((profile) => (
                    <div 
                      key={profile.id} 
                      className={cn(
                        "flex items-center gap-3 p-2 rounded-md cursor-pointer hover:bg-muted transition-colors",
                        selectedAssignees.includes(profile.id) && "bg-primary/10"
                      )}
                      onClick={() => handleAssigneeToggle(profile.id)}
                    >
                      <input 
                        type="checkbox"
                        checked={selectedAssignees.includes(profile.id)}
                        onChange={() => handleAssigneeToggle(profile.id)}
                        className="h-4 w-4 rounded border-input accent-primary"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{profile.name}</p>
                        <p className="text-xs text-muted-foreground">{profile.email}</p>
                      </div>
                      {selectedAssignees.includes(profile.id) && (
                        <Check className="h-4 w-4 text-primary" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
              
              {selectedAssignees.length === 0 && (
                <p className="text-sm text-destructive">Please select at least one assignee</p>
              )}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Project (Optional)</Label>
              <Select value={form.watch("project_id") || "none"} onValueChange={(v) => form.setValue("project_id", v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No project</SelectItem>
                  {projects?.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Category *</Label>
              <Select value={form.watch("category")} onValueChange={(v) => form.setValue("category", v as TaskCategory)}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {TASK_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Due Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start", !dueDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dueDate ? format(dueDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar 
                  mode="single" 
                  selected={dueDate} 
                  onSelect={setDueDate} 
                  className="pointer-events-auto"
                  disabled={undefined}
                  defaultMonth={dueDate || new Date()}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-3">
            <Label>Priority *</Label>
            <RadioGroup
              value={form.watch("priority")}
              onValueChange={(v) => form.setValue("priority", v as "normal" | "high" | "emergency")}
              className="grid grid-cols-3 gap-3"
            >
              {["normal", "high", "emergency"].map((p) => (
                <div key={p}>
                  <RadioGroupItem value={p} id={`p-${p}`} className="peer sr-only" />
                  <Label htmlFor={`p-${p}`} className={cn(
                    "flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-3 cursor-pointer peer-data-[state=checked]:border-primary",
                    p === "emergency" && "peer-data-[state=checked]:border-emergency"
                  )}>
                    {p === "emergency" && <AlertTriangle className="h-4 w-4 text-emergency mb-1" />}
                    <span className="text-sm font-medium capitalize">{p}</span>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t mt-2">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
            <Button
              type="submit" 
              disabled={createAssignment.isPending || (!isSelfAssignment && selectedAssignees.length === 0)}
            >
              {createAssignment.isPending && <LoadingSpinner size="sm" className="mr-2" />}
              {!isSelfAssignment && selectedAssignees.length > 1 
                ? `Create ${selectedAssignees.length} Assignments` 
                : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
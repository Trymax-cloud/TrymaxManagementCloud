// Task Categories - used throughout the app
export const TASK_CATEGORIES = [
  { value: "general", label: "General", color: "bg-slate-500" },
  { value: "inspection", label: "Inspection", color: "bg-blue-500" },
  { value: "production", label: "Production", color: "bg-green-500" },
  { value: "delivery", label: "Delivery", color: "bg-amber-500" },
  { value: "admin", label: "Admin", color: "bg-purple-500" },
  { value: "other", label: "Other", color: "bg-gray-500" },
] as const;

export type TaskCategory = typeof TASK_CATEGORIES[number]["value"];

export const DEFAULT_CATEGORY: TaskCategory = "general";

export function getCategoryConfig(category: string) {
  return TASK_CATEGORIES.find(c => c.value === category) || TASK_CATEGORIES[0];
}

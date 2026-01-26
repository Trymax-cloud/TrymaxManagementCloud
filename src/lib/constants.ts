// Task Categories - used throughout the app
export const TASK_CATEGORIES = [
  { value: "general", label: "General", color: "bg-slate-500" },
  { value: "inspection", label: "Inspection", color: "bg-blue-500" },
  { value: "production", label: "Production", color: "bg-green-500" },
  { value: "delivery", label: "Delivery", color: "bg-amber-500" },
  { value: "operation", label: "Operation", color: "bg-purple-500" },
  { value: "proposal", label: "Proposal", color: "bg-pink-500" },
] as const;

export type TaskCategory = typeof TASK_CATEGORIES[number]["value"];

export const DEFAULT_CATEGORY: TaskCategory = "general";

export function getCategoryConfig(category: string) {
  // Handle legacy categories by mapping them to new ones
  const mappedCategory = LEGACY_CATEGORY_MAPPING[category] || category;
  return TASK_CATEGORIES.find(c => c.value === mappedCategory) || TASK_CATEGORIES[0];
}

// Legacy category mapping for migration
export const LEGACY_CATEGORY_MAPPING: Record<string, TaskCategory> = {
  "admin": "general",
  "other": "general",
};

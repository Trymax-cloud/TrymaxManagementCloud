import { Badge } from "@/components/ui/badge";
import { getCategoryConfig } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface CategoryBadgeProps {
  category: string;
  className?: string;
}

export function CategoryBadge({ category, className }: CategoryBadgeProps) {
  const config = getCategoryConfig(category);
  
  return (
    <Badge 
      variant="secondary" 
      className={cn(
        "text-xs font-medium",
        // Use a subtle background with colored left border
        "border-l-2 rounded-l-none",
        config.value === "general" && "border-l-slate-500 bg-slate-500/10 text-slate-700 dark:text-slate-300",
        config.value === "inspection" && "border-l-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-300",
        config.value === "production" && "border-l-green-500 bg-green-500/10 text-green-700 dark:text-green-300",
        config.value === "delivery" && "border-l-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300",
        config.value === "admin" && "border-l-purple-500 bg-purple-500/10 text-purple-700 dark:text-purple-300",
        config.value === "other" && "border-l-gray-500 bg-gray-500/10 text-gray-700 dark:text-gray-300",
        className
      )}
    >
      {config.label}
    </Badge>
  );
}

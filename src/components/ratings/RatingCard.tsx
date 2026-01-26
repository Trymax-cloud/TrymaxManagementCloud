import { memo, useMemo } from "react";
import { format, parse } from "date-fns";
import { Star, MessageSquare } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { EmployeeRating } from "@/hooks/useRatings";

interface RatingCardProps {
  rating: EmployeeRating & { creator?: { id: string; name: string; email: string } };
  employeeName?: string;
  showEmployee?: boolean;
}

export const RatingCard = memo(function RatingCard({ 
  rating, 
  employeeName, 
  showEmployee = false 
}: RatingCardProps) {
  const formattedPeriod = useMemo(() => {
    if (rating.period_type === "monthly") {
      const date = parse(rating.period_value, "yyyy-MM", new Date());
      return format(date, "MMMM yyyy");
    }
    return rating.period_value;
  }, [rating.period_type, rating.period_value]);

  const scoreColor = useMemo(() => {
    if (rating.score >= 4.5) return "text-green-600 bg-green-50 dark:bg-green-950";
    if (rating.score >= 3.5) return "text-blue-600 bg-blue-50 dark:bg-blue-950";
    if (rating.score >= 2.5) return "text-yellow-600 bg-yellow-50 dark:bg-yellow-950";
    return "text-red-600 bg-red-50 dark:bg-red-950";
  }, [rating.score]);

  const formattedDate = useMemo(() => 
    format(new Date(rating.created_at), "PPP"),
    [rating.created_at]
  );

  return (
    <Card className="border-0 shadow-soft">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            {showEmployee && employeeName && (
              <p className="font-semibold">{employeeName}</p>
            )}
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="capitalize">
                {rating.period_type}
              </Badge>
              <span className="text-sm text-muted-foreground">{formattedPeriod}</span>
            </div>
          </div>
          <div className={cn("px-3 py-1 rounded-full flex items-center gap-1", scoreColor)}>
            <Star className="h-4 w-4 fill-current" />
            <span className="font-semibold">{rating.score.toFixed(1)}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-1 mb-3">
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              className={cn(
                "h-5 w-5",
                star <= rating.score
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-muted-foreground/30"
              )}
            />
          ))}
        </div>
        {rating.remarks && (
          <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
            <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5" />
            <p className="text-sm text-muted-foreground">{rating.remarks}</p>
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-3">
          Submitted on {formattedDate}
        </p>
        {rating.creator && (
          <p className="text-xs text-muted-foreground mt-1">
            Rating given by {rating.creator.name || "Director"}
          </p>
        )}
      </CardContent>
    </Card>
  );
});

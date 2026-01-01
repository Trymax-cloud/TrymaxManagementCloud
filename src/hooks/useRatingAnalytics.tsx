import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import type { EmployeeRating } from "./useRatings";

export interface RatingTrend {
  period: string;
  score: number;
  periodType: string;
}

export interface EmployeeRatingSummary {
  userId: string;
  userName: string;
  averageScore: number;
  totalRatings: number;
  latestScore: number;
  trend: "up" | "down" | "stable";
  monthlyAverage: number;
  yearlyAverage: number;
}

// Calculate average score from ratings
function calculateAverage(ratings: EmployeeRating[]): number {
  if (ratings.length === 0) return 0;
  const sum = ratings.reduce((acc, r) => acc + r.score, 0);
  return Math.round((sum / ratings.length) * 10) / 10;
}

// Determine trend based on recent ratings
function determineTrend(ratings: EmployeeRating[]): "up" | "down" | "stable" {
  if (ratings.length < 2) return "stable";
  
  const sorted = [...ratings].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  
  const latest = sorted[0].score;
  const previous = sorted[1].score;
  
  if (latest > previous) return "up";
  if (latest < previous) return "down";
  return "stable";
}

// Hook to get rating trends for current user
export function useMyRatingTrends() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["my-rating-trends", user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data: ratingsData, error } = await supabase
        .from("employee_ratings")
        .select("*")
        .eq("user_id", user.id)
        .order("period_value", { ascending: true });

      if (error) throw error;

      const ratings = ratingsData as EmployeeRating[];

      const trends: RatingTrend[] = ratings.map((r) => ({
        period: r.period_value,
        score: r.score,
        periodType: r.period_type,
      }));

      const monthlyRatings = ratings.filter((r) => r.period_type === "monthly");
      const yearlyRatings = ratings.filter((r) => r.period_type === "yearly");

      return {
        trends,
        averageScore: calculateAverage(ratings),
        monthlyAverage: calculateAverage(monthlyRatings),
        yearlyAverage: calculateAverage(yearlyRatings),
        totalRatings: ratings.length,
        trend: determineTrend(ratings),
        latestRating: ratings.length > 0 ? ratings[ratings.length - 1] : null,
      };
    },
    enabled: !!user,
  });
}

// Hook to get all employees' rating summaries (Director view)
export function useAllEmployeeRatingSummaries() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["employee-rating-summaries"],
    queryFn: async () => {
      // Fetch all ratings
      const { data: ratingsData, error: ratingsError } = await supabase
        .from("employee_ratings")
        .select("*")
        .order("created_at", { ascending: false });

      if (ratingsError) throw ratingsError;

      // Cast to EmployeeRating type
      const ratings = ratingsData as EmployeeRating[];

      // Fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, name, email");

      if (profilesError) throw profilesError;

      // Group ratings by user
      const userRatings: Record<string, EmployeeRating[]> = {};
      ratings.forEach((r) => {
        if (!userRatings[r.user_id]) {
          userRatings[r.user_id] = [];
        }
        userRatings[r.user_id].push(r as EmployeeRating);
      });

      // Build summaries
      const summaries: EmployeeRatingSummary[] = Object.entries(userRatings).map(
        ([userId, userRatingList]) => {
          const profile = profiles.find((p) => p.id === userId);
          const monthlyRatings = userRatingList.filter((r) => r.period_type === "monthly");
          const yearlyRatings = userRatingList.filter((r) => r.period_type === "yearly");
          
          // Sort to get latest
          const sorted = [...userRatingList].sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );

          return {
            userId,
            userName: profile?.name || "Unknown",
            averageScore: calculateAverage(userRatingList),
            totalRatings: userRatingList.length,
            latestScore: sorted[0]?.score || 0,
            trend: determineTrend(userRatingList),
            monthlyAverage: calculateAverage(monthlyRatings),
            yearlyAverage: calculateAverage(yearlyRatings),
          };
        }
      );

      // Sort by average score descending
      return summaries.sort((a, b) => b.averageScore - a.averageScore);
    },
    enabled: !!user,
  });
}

// Hook to calculate suggested rating based on assignment performance
export function useSuggestedRating(userId: string, periodType: "monthly" | "yearly", periodValue: string) {
  return useQuery({
    queryKey: ["suggested-rating", userId, periodType, periodValue],
    queryFn: async () => {
      // Determine date range based on period
      let startDate: Date;
      let endDate: Date;

      if (periodType === "monthly") {
        const [year, month] = periodValue.split("-").map(Number);
        startDate = new Date(year, month - 1, 1);
        endDate = new Date(year, month, 0, 23, 59, 59);
      } else {
        const year = parseInt(periodValue);
        startDate = new Date(year, 0, 1);
        endDate = new Date(year, 11, 31, 23, 59, 59);
      }

      // Fetch assignments for the user in the period
      const { data: assignments, error } = await supabase
        .from("assignments")
        .select("*")
        .eq("assignee_id", userId)
        .gte("created_date", startDate.toISOString())
        .lte("created_date", endDate.toISOString());

      if (error) throw error;

      if (assignments.length === 0) {
        return { suggestedScore: 0, metrics: null };
      }

      const total = assignments.length;
      const completed = assignments.filter((a) => a.status === "completed").length;
      const onTime = assignments.filter((a) => {
        if (a.status !== "completed" || !a.completion_date || !a.due_date) return false;
        return new Date(a.completion_date) <= new Date(a.due_date);
      }).length;
      const emergency = assignments.filter((a) => a.priority === "emergency").length;
      const emergencyCompleted = assignments.filter(
        (a) => a.priority === "emergency" && a.status === "completed"
      ).length;

      // Calculate score (out of 5)
      const completionRate = total > 0 ? (completed / total) * 100 : 0;
      const onTimeRate = completed > 0 ? (onTime / completed) * 100 : 0;
      const emergencyRate = emergency > 0 ? (emergencyCompleted / emergency) * 100 : 100;

      // Weighted score calculation
      const score = Math.min(
        5,
        Math.round(
          ((completionRate * 0.4 + onTimeRate * 0.4 + emergencyRate * 0.2) / 100) * 5 * 10
        ) / 10
      );

      return {
        suggestedScore: score,
        metrics: {
          totalAssignments: total,
          completed,
          completionRate: Math.round(completionRate),
          onTimeRate: Math.round(onTimeRate),
          emergencyHandled: emergencyCompleted,
          emergencyTotal: emergency,
        },
      };
    },
    enabled: !!userId && !!periodValue,
  });
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useToast } from "./use-toast";
import { format } from "date-fns";

export type AttendanceStatus = "present" | "absent" | "half_day";

export interface Attendance {
  id: string;
  user_id: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  status: AttendanceStatus;
  remarks: string | null;
  created_at: string;
  updated_at: string;
}

export interface AttendanceWithProfile extends Attendance {
  profiles?: {
    name: string;
    email: string;
  };
}

// Get today's attendance for current user
export function useTodayAttendance() {
  const { user } = useAuth();
  const today = format(new Date(), "yyyy-MM-dd");

  return useQuery({
    queryKey: ["attendance", "today", user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from("attendance")
        .select("*")
        .eq("user_id", user.id)
        .eq("date", today)
        .maybeSingle();

      if (error) throw error;
      return data as Attendance | null;
    },
    enabled: !!user,
  });
}

// Get attendance history for current user
export function useAttendanceHistory(startDate?: string, endDate?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["attendance", "history", user?.id, startDate, endDate],
    queryFn: async () => {
      if (!user) return [];

      let query = supabase
        .from("attendance")
        .select("*")
        .eq("user_id", user.id)
        .order("date", { ascending: false });

      if (startDate) {
        query = query.gte("date", startDate);
      }
      if (endDate) {
        query = query.lte("date", endDate);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Attendance[];
    },
    enabled: !!user,
  });
}

// Get all attendance records (for directors)
export function useAllAttendance(date?: string) {
  return useQuery({
    queryKey: ["attendance", "all", date],
    queryFn: async () => {
      // First get attendance records
      let query = supabase
        .from("attendance")
        .select("*")
        .order("date", { ascending: false });

      if (date) {
        query = query.eq("date", date);
      }

      const { data: attendanceData, error: attendanceError } = await query;
      if (attendanceError) throw attendanceError;

      if (!attendanceData || attendanceData.length === 0) {
        return [] as AttendanceWithProfile[];
      }

      // Get unique user IDs
      const userIds = [...new Set(attendanceData.map((a) => a.user_id))];

      // Fetch profiles for these users
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, name, email")
        .in("id", userIds);

      if (profilesError) throw profilesError;

      // Create a map of user_id to profile
      const profileMap = new Map(
        profilesData?.map((p) => [p.id, { name: p.name, email: p.email }]) || []
      );

      // Merge attendance with profiles
      const result: AttendanceWithProfile[] = attendanceData.map((a) => ({
        ...a,
        profiles: profileMap.get(a.user_id),
      }));

      return result;
    },
  });
}

// Get attendance summary stats
export function useAttendanceStats(date?: string) {
  const targetDate = date || format(new Date(), "yyyy-MM-dd");

  return useQuery({
    queryKey: ["attendance", "stats", targetDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select("status")
        .eq("date", targetDate);

      if (error) throw error;

      const stats = {
        present: 0,
        absent: 0,
        halfDay: 0,
        total: data?.length || 0,
      };

      data?.forEach((record) => {
        if (record.status === "present") stats.present++;
        else if (record.status === "absent") stats.absent++;
        else if (record.status === "half_day") stats.halfDay++;
      });

      return stats;
    },
  });
}

// Check-in mutation
export function useCheckIn() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const today = format(new Date(), "yyyy-MM-dd");

  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");

      const now = new Date().toISOString();

      // Try to insert new attendance record
      const { data, error } = await supabase
        .from("attendance")
        .upsert(
          {
            user_id: user.id,
            date: today,
            check_in: now,
            status: "present" as AttendanceStatus,
          },
          {
            onConflict: "user_id,date",
          }
        )
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      toast({
        title: "Checked In",
        description: `You checked in at ${format(new Date(), "hh:mm a")}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Check-in Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

// Check-out mutation
export function useCheckOut() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const today = format(new Date(), "yyyy-MM-dd");

  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");

      const now = new Date().toISOString();

      const { data, error } = await supabase
        .from("attendance")
        .update({
          check_out: now,
        })
        .eq("user_id", user.id)
        .eq("date", today)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      toast({
        title: "Checked Out",
        description: `You checked out at ${format(new Date(), "hh:mm a")}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Check-out Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

// Update attendance remarks
export function useUpdateAttendanceRemarks() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, remarks }: { id: string; remarks: string }) => {
      const { data, error } = await supabase
        .from("attendance")
        .update({ remarks })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      toast({
        title: "Remarks Updated",
        description: "Attendance remarks have been saved.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

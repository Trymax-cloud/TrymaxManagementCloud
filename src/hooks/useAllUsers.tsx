import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface User {
  id: string;
  name: string;
  email: string;
  user_roles: {
    role: string;
  };
}

export function useAllUsers() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["all-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(`
          id,
          name,
          email,
          user_roles(role)
        `)
        .order("name");

      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useUserMeetings() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["user-meetings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetings")
        .select(`
          *,
          meeting_participants!inner(user_id)
        `)
        .or(`
          created_by.eq.${user?.id},
          meeting_participants.user_id.eq.${user?.id}
        `)
        .order("meeting_date")
        .order("meeting_time");

      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function useMessages() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["messages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .or(`
          sender_id.eq.${user?.id},
          receiver_id.eq.${user?.id}
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!user,
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}

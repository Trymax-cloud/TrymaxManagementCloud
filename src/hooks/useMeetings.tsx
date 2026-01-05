import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';

export interface Meeting {
  id: string;
  title: string;
  note: string | null;
  meeting_date: string;
  meeting_time: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  creator?: {
    id: string;
    name: string;
    email: string;
  };
  participants?: MeetingParticipant[];
}

export interface MeetingParticipant {
  id: string;
  meeting_id: string;
  user_id: string;
  created_at: string;
  user?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface CreateMeetingInput {
  title: string;
  note?: string;
  meeting_date: string;
  meeting_time: string;
  participant_ids: string[];
}

export function useMeetings() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['meetings', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      // Get meetings
      const { data: meetings, error } = await supabase
        .from('meetings')
        .select('*')
        .order('meeting_date', { ascending: true })
        .order('meeting_time', { ascending: true });

      if (error) throw error;

      // Get participants for all meetings
      const meetingIds = meetings?.map(m => m.id) || [];
      
      let participants: any[] = [];
      if (meetingIds.length > 0) {
        const { data: participantsData, error: participantsError } = await supabase
          .from('meeting_participants')
          .select('*')
          .in('meeting_id', meetingIds);

        if (participantsError) throw participantsError;
        participants = participantsData || [];
      }

      // Get all unique user IDs (creators + participants)
      const userIds = new Set<string>();
      meetings?.forEach(m => userIds.add(m.created_by));
      participants.forEach(p => userIds.add(p.user_id));

      // Get profiles
      let profiles: any[] = [];
      if (userIds.size > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, name, email')
          .in('id', Array.from(userIds));

        if (profilesError) throw profilesError;
        profiles = profilesData || [];
      }

      const profileMap = new Map(profiles.map(p => [p.id, p]));

      // Build enriched meetings
      return meetings?.map(meeting => ({
        ...meeting,
        creator: profileMap.get(meeting.created_by),
        participants: participants
          .filter(p => p.meeting_id === meeting.id)
          .map(p => ({
            ...p,
            user: profileMap.get(p.user_id)
          }))
      })) as Meeting[];
    },
    enabled: !!user?.id,
  });
}

export function useCreateMeeting() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateMeetingInput) => {
      // Check authenticated user
      if (!user?.id) throw new Error('Not authenticated');

      console.log('Creating meeting with RPC:', input);

      // Call RPC for atomic meeting creation - ONLY RPC, no direct inserts
      const { data, error } = await supabase.rpc('create_meeting_with_participants', {
        p_meeting_title: input.title,
        p_meeting_note: input.note ?? null,
        p_meeting_date: input.meeting_date,
        p_meeting_time: input.meeting_time,
        p_participant_ids: input.participant_ids ?? []
      });

      if (error) {
        console.error('Meeting creation failed', error);
        throw new Error(error.message || 'Failed to create meeting');
      }

      if (!data) throw new Error('Failed to create meeting');

      return data;
    },
    onSuccess: () => {
      // Refetch meetings list on success
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      queryClient.invalidateQueries({ queryKey: ['user-meetings'] });
    },
    onError: (error) => {
      // Show RPC error message directly
      console.error('Meeting creation failed', error);
    }
  });
}

export function useUpdateMeeting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Meeting> & { id: string }) => {
      const { data, error } = await supabase
        .from('meetings')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      toast({
        title: 'Meeting updated'
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error updating meeting',
        description: error.message,
        variant: 'destructive'
      });
    }
  });
}

export function useDeleteMeeting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Simple delete - cascade should handle participants
      const { error } = await supabase
        .from('meetings')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      toast({
        title: 'Meeting deleted',
        description: 'Meeting and all participants have been removed.'
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error deleting meeting',
        description: error.message,
        variant: 'destructive'
      });
    }
  });
}

export function useUpcomingMeetings() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['upcoming-meetings', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const today = new Date().toISOString().split('T')[0];

      const { data: meetings, error } = await supabase
        .from('meetings')
        .select('*')
        .gte('meeting_date', today)
        .order('meeting_date', { ascending: true })
        .order('meeting_time', { ascending: true })
        .limit(5);

      if (error) throw error;
      return meetings as Meeting[];
    },
    enabled: !!user?.id,
  });
}

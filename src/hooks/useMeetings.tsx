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
      if (!user?.id) throw new Error('Not authenticated');

      // Create meeting
      const { data: meeting, error: meetingError } = await supabase
        .from('meetings')
        .insert({
          title: input.title,
          note: input.note || null,
          meeting_date: input.meeting_date,
          meeting_time: input.meeting_time,
          created_by: user.id
        })
        .select()
        .single();

      if (meetingError) throw meetingError;

      // Add participants (including creator)
      const allParticipantIds = [...new Set([...input.participant_ids, user.id])];
      
      const participantsToInsert = allParticipantIds.map(userId => ({
        meeting_id: meeting.id,
        user_id: userId
      }));

      const { error: participantsError } = await supabase
        .from('meeting_participants')
        .insert(participantsToInsert);

      if (participantsError) throw participantsError;

      return meeting;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      toast({
        title: 'Meeting created',
        description: 'Participants have been notified.'
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error creating meeting',
        description: error.message,
        variant: 'destructive'
      });
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
      // First delete all participants for this meeting
      const { error: participantsError } = await supabase
        .from('meeting_participants')
        .delete()
        .eq('meeting_id', id);

      if (participantsError) {
        console.error('Error deleting meeting participants:', participantsError);
        // Continue with meeting deletion even if participant deletion fails
        // since the database should handle cascade deletion
      }

      // Then delete the meeting
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

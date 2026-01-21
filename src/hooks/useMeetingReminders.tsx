import { useEffect, useRef } from 'react';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';
import { format, parseISO, differenceInMinutes, isToday } from 'date-fns';
import { desktopNotify } from '@/utils/desktopNotify';
import { useUpcomingMeetings } from './useMeetings';

export function useMeetingReminders() {
  const { user, isLoading } = useAuth();
  const { data: meetings, isLoading: meetingsLoading } = useUpcomingMeetings();
  const notifiedMeetings = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user || isLoading || meetingsLoading || !meetings) return;

    const checkMeetingReminders = () => {
      const now = new Date();

      meetings.forEach((meeting) => {
        if (!meeting.meeting_date || !meeting.meeting_time) return;

        const meetingDateTime = parseISO(`${meeting.meeting_date}T${meeting.meeting_time}`);
        const minutesUntilMeeting = differenceInMinutes(meetingDateTime, now);

        // Only remind for meetings in the future
        if (minutesUntilMeeting <= 0) return;

        // Remind 1 hour (60 minutes) before
        if (minutesUntilMeeting <= 60 && minutesUntilMeeting > 59) {
          const reminderId = `${meeting.id}-60`;
          if (!notifiedMeetings.current.has(reminderId)) {
            notifiedMeetings.current.add(reminderId);
            const message = `"${meeting.title}" starts in 1 hour at ${format(meetingDateTime, 'h:mm a')}`;
            
            toast({
              title: '📅 Meeting in 1 Hour',
              description: message,
              duration: 10000,
            });
            
            // Use Electron native notification
            desktopNotify('📅 Meeting in 1 Hour', message, '/meetings', {
              tag: reminderId,
              requireInteraction: false,
              urgency: 'normal'
            });
          }
        }

        // Remind 15 minutes before
        if (minutesUntilMeeting <= 15 && minutesUntilMeeting > 0) {
          const reminderId = `${meeting.id}-15`;
          if (!notifiedMeetings.current.has(reminderId)) {
            notifiedMeetings.current.add(reminderId);
            const message = `"${meeting.title}" starts in ${minutesUntilMeeting} minutes at ${format(meetingDateTime, 'h:mm a')}`;
            
            toast({
              title: '📅 Meeting Reminder',
              description: message,
              duration: 10000,
            });
            
            // Use Electron native notification
            desktopNotify('📅 Meeting Reminder', message, '/meetings', {
              tag: reminderId,
              requireInteraction: false,
              urgency: 'normal'
            });
          }
        }

        // Remind at meeting time
        if (minutesUntilMeeting <= 0 && minutesUntilMeeting > -1) {
          const reminderId = `${meeting.id}-now`;
          if (!notifiedMeetings.current.has(reminderId)) {
            notifiedMeetings.current.add(reminderId);
            const message = `"${meeting.title}" is starting now!`;
            
            toast({
              title: '🔔 Meeting Starting Now',
              description: message,
              duration: 15000,
            });
            
            // Use Electron native notification with higher urgency
            desktopNotify('🔔 Meeting Starting Now', message, '/meetings', {
              tag: reminderId,
              requireInteraction: true,
              urgency: 'critical'
            });
          }
        }
      });
    };

    // Check immediately and then every minute
    checkMeetingReminders();
    const interval = setInterval(checkMeetingReminders, 60000);

    return () => clearInterval(interval);
  }, [user, isLoading, meetingsLoading, meetings]);

  return null;
}
